import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, increment } from 'firebase/firestore';

const AppContext = createContext();

export const MOODS = [
  { id: 1, emoji: '😄', label: 'Tuyệt vời', color: '#55efc4', score: 5 },
  { id: 2, emoji: '😊', label: 'Vui', color: '#74b9ff', score: 4 },
  { id: 3, emoji: '😐', label: 'Bình thường', color: '#fdcb6e', score: 3 },
  { id: 4, emoji: '😔', label: 'Buồn', color: '#fd79a8', score: 2 },
  { id: 5, emoji: '😰', label: 'Căng thẳng', color: '#e17055', score: 1 },
];

export const BADGES = [
  { id: 'first_checkin', name: 'Bước đầu tiên', icon: '🌱', desc: 'Check-in lần đầu' },
  { id: 'week_streak', name: 'Chiến binh bền bỉ', icon: '⚔️', desc: '7 ngày liên tiếp' },
  { id: 'pomodoro_master', name: 'Bậc thầy tập trung', icon: '🍅', desc: 'Hoàn thành 10 pomodoro' },
  { id: 'meditation_master', name: 'Bậc thầy thiền định', icon: '🧘', desc: 'Thiền 5 lần' },
  { id: 'community_helper', name: 'Người truyền cảm hứng', icon: '💝', desc: 'Gửi 10 lời động viên' },
];

const DEFAULT_DATA = {
  moodLogs: [],
  pomodoroCount: 0,
  gardenLevel: 0,
  earnedBadges: [],
  emergencyContact: '',
  todayAI: null,       // { date, advice, moodLabel, chatMessages }
  aiMemory: [],        // [{ date, summary, moods }] — tối đa 7 ngày gần nhất
  meditateCount: 0,
  customMoods: [],
  confessions: [
    { id: 1, text: 'Thi trượt môn Toán, không biết nói với ba mẹ thế nào...', hugs: 12, time: '2h trước', x: 20, y: 30 },
    { id: 2, text: 'Xa nhà 3 năm rồi, nhớ mẹ quá 😢', hugs: 8, time: '5h trước', x: 60, y: 50 },
    { id: 3, text: 'Hôm nay bảo vệ đồ án thành công! 🎉', hugs: 25, time: '1 ngày trước', x: 40, y: 70 },
  ],
};

export function AppProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading
  const [data, setData] = useState(DEFAULT_DATA);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('mb_dark') === '1');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('mb_dark', darkMode ? '1' : '0');
  }, [darkMode]);

  // Listen to auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        await loadUserData(firebaseUser.uid);
      } else {
        setUser(null);
        setData(DEFAULT_DATA);
      }
    });
    return unsub;
  }, []);

  const userRef = (uid) => doc(db, 'users', uid);

  const loadUserData = async (uid) => {
    try {
      const snap = await getDoc(userRef(uid));
      if (snap.exists()) {
        setData({ ...DEFAULT_DATA, ...snap.data() });
      } else {
        await setDoc(userRef(uid), DEFAULT_DATA);
      }
    } catch (err) {
      console.warn('Firestore offline, dùng dữ liệu cục bộ:', err.message);
    }
  };

  const save = async (updates) => {
    setData(prev => ({ ...prev, ...updates }));
    if (user) {
      try { await updateDoc(userRef(user.uid), updates); }
      catch (err) { console.warn('Lưu thất bại:', err.message); }
    }
  };

  const logout = () => signOut(auth);

  const getStreak = (logs) => {
    let streak = 0;
    const today = new Date();
    const todayStr = today.toDateString();
    const hasToday = logs.some(l => new Date(l.date).toDateString() === todayStr);
    // Nếu hôm nay chưa check-in, bắt đầu tính từ hôm qua
    const startOffset = hasToday ? 0 : 1;
    for (let i = startOffset; i < 30; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      if (logs.some(l => new Date(l.date).toDateString() === d.toDateString())) streak++;
      else break;
    }
    return streak;
  };

  const checkBadge = async (id) => {
    if (data.earnedBadges.includes(id)) return;
    const next = [...data.earnedBadges, id];
    setData(prev => ({ ...prev, earnedBadges: next }));
    if (user) await updateDoc(userRef(user.uid), { earnedBadges: arrayUnion(id) });
  };

  const growGarden = async (points) => {
    const next = Math.min(data.gardenLevel + points, 100);
    setData(prev => ({ ...prev, gardenLevel: next }));
    if (user) await updateDoc(userRef(user.uid), { gardenLevel: next });
  };

  const addMoodLog = async (mood, note) => {
    const log = { id: Date.now(), mood, note, date: new Date().toISOString() };
    const next = [log, ...data.moodLogs];
    setData(prev => ({ ...prev, moodLogs: next }));
    if (user) await updateDoc(userRef(user.uid), { moodLogs: next });
    // Chỉ cộng điểm vườn cho lần đầu ghi trong ngày
    const todayStr = new Date().toDateString();
    const alreadyToday = data.moodLogs.some(l => new Date(l.date).toDateString() === todayStr);
    if (!alreadyToday) {
      growGarden(5);
      checkBadge('first_checkin');
      if (getStreak(next) >= 7) checkBadge('week_streak');
    }
  };

  // Cập nhật một log cụ thể theo id
  const updateMoodLog = async (id, mood, note) => {
    const next = data.moodLogs.map(l => l.id === id ? { ...l, mood, note } : l);
    setData(prev => ({ ...prev, moodLogs: next }));
    if (user) await updateDoc(userRef(user.uid), { moodLogs: next });
  };

  // Xóa một log theo id
  const deleteMoodLog = async (id) => {
    const next = data.moodLogs.filter(l => l.id !== id);
    setData(prev => ({ ...prev, moodLogs: next }));
    if (user) await updateDoc(userRef(user.uid), { moodLogs: next });
  };

  // Giữ lại updateTodayMood để tương thích
  const updateTodayMood = async (mood, note) => {
    const todayLogs = data.moodLogs.filter(l => new Date(l.date).toDateString() === new Date().toDateString());
    if (todayLogs.length === 0) return;
    await updateMoodLog(todayLogs[0].id, mood, note);
  };

  const incrementPomodoro = async () => {
    const next = data.pomodoroCount + 1;
    setData(prev => ({ ...prev, pomodoroCount: next }));
    if (user) await updateDoc(userRef(user.uid), { pomodoroCount: increment(1) });
    growGarden(10);
    if (next >= 10) checkBadge('pomodoro_master');
  };

  const incrementMeditate = async () => {
    const next = (data.meditateCount || 0) + 1;
    setData(prev => ({ ...prev, meditateCount: next }));
    if (user) await updateDoc(userRef(user.uid), { meditateCount: increment(1) });
    if (next >= 5) checkBadge('meditation_master');
  };

  const addConfession = async (text) => {
    const c = { id: Date.now(), text, hugs: 0, time: 'Vừa xong', x: Math.random() * 70 + 10, y: Math.random() * 70 + 10 };
    const next = [c, ...data.confessions];
    setData(prev => ({ ...prev, confessions: next }));
    if (user) await updateDoc(userRef(user.uid), { confessions: next });
  };

  const hugConfession = async (id) => {
    const next = data.confessions.map(c => c.id === id ? { ...c, hugs: c.hugs + 1 } : c);
    setData(prev => ({ ...prev, confessions: next }));
    if (user) await updateDoc(userRef(user.uid), { confessions: next });
    checkBadge('community_helper');
  };

  // ── Custom moods ──
  const addCustomMood = async (mood) => {
    // mood: { emoji, label, color, score }
    const newMood = { ...mood, id: `custom_${Date.now()}` };
    const next = [...(data.customMoods || []), newMood];
    setData(prev => ({ ...prev, customMoods: next }));
    if (user) await updateDoc(userRef(user.uid), { customMoods: next });
    return newMood;
  };

  const deleteCustomMood = async (id) => {
    const next = (data.customMoods || []).filter(m => m.id !== id);
    setData(prev => ({ ...prev, customMoods: next }));
    if (user) await updateDoc(userRef(user.uid), { customMoods: next });
  };

  const todayMood = data.moodLogs.find(l => new Date(l.date).toDateString() === new Date().toDateString());

  if (user === undefined) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>
      🧠
    </div>
  );

  return (
    <AppContext.Provider value={{
      user, logout,
      ...data,
      MOODS, BADGES,
      addMoodLog, updateTodayMood, updateMoodLog, deleteMoodLog, todayMood,
      incrementPomodoro,
      incrementMeditate,
      addConfession, hugConfession,
      addCustomMood, deleteCustomMood,
      growGarden,
      setEmergencyContact: (v) => save({ emergencyContact: v }),
      saveTodayAI: (aiData) => save({ todayAI: { ...aiData, date: new Date().toDateString() } }),
      saveAiMemory: (entry) => {
        // entry: { date, summary, moods }
        // Giữ tối đa 7 ngày, không trùng ngày
        const existing = data.aiMemory || [];
        const filtered = existing.filter(e => e.date !== entry.date);
        const next = [entry, ...filtered].slice(0, 7);
        save({ aiMemory: next });
      },
      getStreak,
      checkBadge,
      darkMode, setDarkMode,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
