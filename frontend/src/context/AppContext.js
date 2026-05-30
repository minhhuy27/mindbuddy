import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, increment, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { deleteObject, ref as storageRef } from 'firebase/storage';
import { storage } from '../firebase';
import { normalizeMoodAttachments, normalizeMoodImages } from '../utils/moodImages';

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
  { id: 'community_helper', name: 'Tự nâng đỡ', icon: '💝', desc: 'Tự ôm mình trong góc nhẹ lòng' },
];

export const DEFAULT_GOALS = [
  { id: 'stress', icon: '🌿', label: 'Giảm stress', desc: 'Ưu tiên hạ căng thẳng và ổn định cảm xúc.' },
  { id: 'sleep', icon: '🌙', label: 'Ngủ tốt hơn', desc: 'Ưu tiên nhịp nghỉ ngơi, phục hồi và năng lượng.' },
  { id: 'study', icon: '🍅', label: 'Tập trung học tập', desc: 'Ưu tiên năng lượng, Pomodoro và kế hoạch học.' },
];

const DEFAULT_DATA = {
  moodLogs: [],
  pomodoroCount: 0,
  gardenLevel: 0,
  earnedBadges: [],
  emergencyContact: '',
  todayAI: null,
  aiMemory: [],
  meditateCount: 0,
  customMoods: [],
  causeOptions: null,
  userGoal: 'stress',
  goalOptions: null,
  dailyReviews: {},
  weeklyInsight: null, // { text, logCount, savedAt }
  confessions: [
    { id: 1, text: 'Thi trượt môn Toán, không biết nói với ba mẹ thế nào...', hugs: 12, time: '2h trước', x: 20, y: 30 },
    { id: 2, text: 'Xa nhà 3 năm rồi, nhớ mẹ quá 😢', hugs: 8, time: '5h trước', x: 60, y: 50 },
    { id: 3, text: 'Hôm nay bảo vệ đồ án thành công! 🎉', hugs: 25, time: '1 ngày trước', x: 40, y: 70 },
  ],
};

const USER_CACHE_PREFIX = 'mb_user_cache_';
const MAX_FIRESTORE_BACKUPS = 10;
const BACKUP_COLLECTION = 'userBackups';

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function cacheKey(uid) {
  return `${USER_CACHE_PREFIX}${uid}`;
}

function readUserCache(uid) {
  try {
    const raw = localStorage.getItem(cacheKey(uid));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeUserCache(uid, value) {
  if (!uid) return;
  try {
    localStorage.setItem(cacheKey(uid), JSON.stringify({
      savedAt: Date.now(),
      data: value,
    }));
  } catch (err) {
    console.warn('Không thể lưu cache cục bộ:', err.message);
  }
}

function normalizeListField(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.values(value);
  return [];
}

function mergeUserData(value = {}) {
  return {
    ...DEFAULT_DATA,
    ...value,
    moodLogs: normalizeListField(value.moodLogs),
    aiMemory: normalizeListField(value.aiMemory),
    customMoods: normalizeListField(value.customMoods),
    earnedBadges: normalizeListField(value.earnedBadges),
    confessions: value.confessions === undefined ? DEFAULT_DATA.confessions : normalizeListField(value.confessions),
    causeOptions: value.causeOptions === undefined || value.causeOptions === null ? value.causeOptions : normalizeListField(value.causeOptions),
    goalOptions: value.goalOptions === undefined || value.goalOptions === null ? value.goalOptions : normalizeListField(value.goalOptions),
  };
}

function summarizeFirestoreValue(value) {
  if (Array.isArray(value)) return `array(${value.length})`;
  if (value && typeof value === 'object') return `object(${Object.keys(value).length})`;
  return typeof value;
}

function parseStoredSignature(value) {
  if (!value || typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function moodIdFromEntry(entry, moods) {
  const label = String(entry?.moodLabel || '').trim().toLowerCase();
  const score = Number(entry?.moodScore);
  const byLabel = moods.find(mood => String(mood.label || '').trim().toLowerCase() === label);
  if (byLabel) return byLabel.id;
  const byScore = moods.find(mood => Number(mood.score) === score);
  return byScore?.id || 3;
}

function noteWithCauses(note = '', causes = []) {
  const cleanNote = String(note || '').trim();
  const cleanCauses = [...new Set((causes || []).map(cause => String(cause).trim()).filter(Boolean))];
  if (!cleanCauses.length) return cleanNote;
  return `${cleanNote}${cleanNote ? ' ' : ''}[${cleanCauses.join(', ')}]`;
}

function buildDateFromReviewEntry(dateKey, time) {
  const safeTime = /^\d{2}:\d{2}$/.test(String(time || '')) ? time : '12:00';
  const date = new Date(`${dateKey}T${safeTime}:00`);
  return Number.isNaN(date.getTime()) ? new Date(`${dateKey}T12:00:00`).toISOString() : date.toISOString();
}

function dateKeyFromMemoryDate(value) {
  const text = String(value || '').trim();
  const vnMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (vnMatch) {
    const [, day, month, year] = vnMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function recoverLogsFromDailyReviews(reviews = {}, moods = []) {
  return Object.entries(reviews || {}).flatMap(([dateKey, stored]) => {
    const signature = parseStoredSignature(stored?.signature);
    const entries = Array.isArray(signature?.entries) ? signature.entries : [];
    return entries.map((entry, index) => {
      const date = buildDateFromReviewEntry(dateKey, entry.time);
      const attachments = normalizeMoodAttachments(entry.attachments || []);
      const images = normalizeMoodImages(attachments);
      const image = images[0] || null;
      return {
        id: `review_${dateKey}_${String(entry.time || index).replace(/\W/g, '')}_${index}`,
        mood: moodIdFromEntry(entry, moods),
        note: noteWithCauses(entry.note, entry.causes),
        metrics: entry.metrics || null,
        date,
        attachments,
        images,
        image,
        imageUrl: image?.url || '',
        imagePath: image?.path || '',
        recoveredFrom: 'dailyReviews',
      };
    });
  });
}

function recoverLogsFromAiMemory(memory = [], moods = [], coveredDateKeys = new Set()) {
  return normalizeListField(memory).flatMap((entry) => {
    const dateKey = dateKeyFromMemoryDate(entry?.date);
    if (!dateKey || coveredDateKeys.has(dateKey)) return [];
    const memoryMoods = normalizeListField(entry?.moods);
    const summary = String(entry?.summary || '')
      .replace(/<think>/gi, '')
      .replace(/<\/think>/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    const labels = memoryMoods.length ? memoryMoods : ['Không rõ'];

    return labels.map((label, index) => ({
      id: `memory_${dateKey}_${index}`,
      mood: moodIdFromEntry({ moodLabel: label }, moods),
      note: summary || `Khôi phục gần đúng từ trí nhớ AI: ${label}`,
      metrics: null,
      date: buildDateFromReviewEntry(dateKey, `${String(12 + Math.min(index, 6)).padStart(2, '0')}:00`),
      attachments: [],
      images: [],
      image: null,
      imageUrl: '',
      imagePath: '',
      recoveredFrom: 'aiMemory',
    }));
  });
}

function recordKey(item = {}) {
  const date = new Date(item.date || 0);
  const datePart = Number.isNaN(date.getTime()) ? String(item.date || '') : date.toISOString().slice(0, 16);
  return `${datePart}_${String(item.mood || '')}_${String(item.note || '').slice(0, 140)}`;
}

function mergeRecords(current = [], incoming = []) {
  const map = new Map();
  [...incoming, ...current].forEach(item => {
    if (!item) return;
    map.set(recordKey(item), item);
  });
  return Array.from(map.values()).sort((a, b) => {
    const aTime = new Date(a?.date || 0).getTime() || 0;
    const bTime = new Date(b?.date || 0).getTime() || 0;
    return bTime - aTime;
  });
}

function mergeByIdOrLabel(current = [], incoming = []) {
  const map = new Map();
  [...incoming, ...current].forEach(item => {
    if (!item) return;
    const key = String(item.id || item.label || item.name || JSON.stringify(item)).toLowerCase();
    map.set(key, item);
  });
  return Array.from(map.values());
}

function mergeStringList(current = [], incoming = []) {
  return [...new Set([...(incoming || []), ...(current || [])].map(item => String(item).trim()).filter(Boolean))];
}

function mergeImportedData(currentRaw, incomingRaw) {
  const current = mergeUserData(currentRaw);
  const incoming = mergeUserData(incomingRaw);
  const goalOptions = mergeByIdOrLabel(current.goalOptions || DEFAULT_GOALS, incoming.goalOptions || DEFAULT_GOALS);
  const userGoal = goalOptions.some(goal => goal.id === current.userGoal)
    ? current.userGoal
    : (goalOptions.some(goal => goal.id === incoming.userGoal) ? incoming.userGoal : goalOptions[0]?.id || 'stress');

  return {
    ...incoming,
    ...current,
    moodLogs: mergeRecords(current.moodLogs, incoming.moodLogs),
    aiMemory: mergeRecords(current.aiMemory, incoming.aiMemory).slice(0, 14),
    confessions: mergeRecords(current.confessions, incoming.confessions),
    customMoods: mergeByIdOrLabel(current.customMoods, incoming.customMoods),
    causeOptions: mergeStringList(current.causeOptions, incoming.causeOptions),
    goalOptions,
    userGoal,
    dailyReviews: { ...(incoming.dailyReviews || {}), ...(current.dailyReviews || {}) },
    earnedBadges: mergeStringList(current.earnedBadges, incoming.earnedBadges),
    pomodoroCount: Math.max(Number(current.pomodoroCount || 0), Number(incoming.pomodoroCount || 0)),
    gardenLevel: Math.max(Number(current.gardenLevel || 0), Number(incoming.gardenLevel || 0)),
    meditateCount: Math.max(Number(current.meditateCount || 0), Number(incoming.meditateCount || 0)),
    emergencyContact: current.emergencyContact || incoming.emergencyContact || '',
    todayAI: current.todayAI || incoming.todayAI || null,
    weeklyInsight: current.weeklyInsight || incoming.weeklyInsight || null,
  };
}

function buildBackupPayload(value = {}) {
  const normalized = mergeUserData(value);
  return {
    moodLogs: normalized.moodLogs || [],
    dailyReviews: normalized.dailyReviews || {},
    aiMemory: normalized.aiMemory || [],
    customMoods: normalized.customMoods || [],
    causeOptions: normalized.causeOptions || null,
    goalOptions: normalized.goalOptions || null,
    userGoal: normalized.userGoal || 'stress',
    weeklyInsight: normalized.weeklyInsight || null,
    todayAI: normalized.todayAI || null,
    pomodoroCount: normalized.pomodoroCount || 0,
    gardenLevel: normalized.gardenLevel || 0,
    earnedBadges: normalized.earnedBadges || [],
    meditateCount: normalized.meditateCount || 0,
    emergencyContact: normalized.emergencyContact || '',
    confessions: normalized.confessions || [],
  };
}

function backupSignature(value = {}) {
  return JSON.stringify(buildBackupPayload(value));
}

function normalizeGoalOptions(goals) {
  const source = Array.isArray(goals) && goals.length ? goals : DEFAULT_GOALS;
  const seen = new Set();
  const normalized = source
    .map((goal, index) => {
      const label = String(goal?.label || '').trim();
      if (!label) return null;
      let id = String(goal?.id || `goal_${Date.now()}_${index}`).trim();
      if (!id || seen.has(id)) id = `goal_${Date.now()}_${index}`;
      seen.add(id);
      return {
        id,
        icon: String(goal?.icon || '🎯').trim().slice(0, 4) || '🎯',
        label,
        desc: String(goal?.desc || 'Theo dõi điều này trong các check-in và insight.').trim(),
      };
    })
    .filter(Boolean);
  return normalized.length ? normalized : DEFAULT_GOALS;
}

export function AppProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading
  const [data, setData] = useState(DEFAULT_DATA);
  const [dataReady, setDataReady] = useState(false);
  const [syncNotice, setSyncNotice] = useState(null);
  const [backupState, setBackupState] = useState({ status: 'idle', lastBackupDate: '', error: '' });
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('mb_dark') === '1');
  const backupTimerRef = useRef(null);
  const lastBackupSignatureRef = useRef('');
  const backupErrorNotifiedRef = useRef(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('mb_dark', darkMode ? '1' : '0');
  }, [darkMode]);

  // Listen to auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        setDataReady(false);
        setSyncNotice(null);
        await loadUserData(firebaseUser.uid);
      } else {
        setUser(null);
        setData(DEFAULT_DATA);
        setDataReady(false);
        setSyncNotice(null);
      }
    });
    return unsub;
  }, []);

  const userRef = (uid) => doc(db, 'users', uid);

  const loadUserData = async (uid) => {
    try {
      const snap = await getDoc(userRef(uid));
      if (snap.exists()) {
        const nextData = mergeUserData(snap.data());
        setData(nextData);
        setDataReady(true);
        writeUserCache(uid, nextData);
      } else {
        const nextData = mergeUserData(DEFAULT_DATA);
        await setDoc(userRef(uid), nextData);
        setData(nextData);
        setDataReady(true);
        writeUserCache(uid, nextData);
      }
    } catch (err) {
      console.warn('Firestore load failed:', err.message);
      const cached = readUserCache(uid);
      if (cached?.data) {
        setData(mergeUserData(cached.data));
        setDataReady(true);
        setSyncNotice({
          type: 'warning',
          message: 'Không tải được Firestore, MindBuddy đang dùng bản cache cục bộ gần nhất.',
          detail: err.message,
        });
      } else {
        setData(DEFAULT_DATA);
        setDataReady(true);
        setSyncNotice({
          type: 'error',
          message: 'Không tải được dữ liệu Firestore và chưa có cache cục bộ trên máy này.',
          detail: err.message,
        });
      }
    }
  };

  const save = async (updates) => {
    const nextData = { ...data, ...updates };
    setData(nextData);
    if (user?.uid) writeUserCache(user.uid, nextData);
    if (user) {
      try {
        await setDoc(userRef(user.uid), updates, { merge: true });
        setSyncNotice(null);
      }
      catch (err) {
        console.warn('Lưu thất bại:', err.message);
        setSyncNotice({
          type: 'warning',
          message: 'Thay đổi đã được giữ tạm trên máy này nhưng chưa đồng bộ được lên Firestore.',
          detail: err.message,
        });
      }
    }
  };

  const backupRef = (uid, dateKey) => doc(db, BACKUP_COLLECTION, uid, 'snapshots', dateKey);
  const backupsCollectionRef = (uid) => collection(db, BACKUP_COLLECTION, uid, 'snapshots');

  const pruneOldBackups = async (uid) => {
    const snap = await getDocs(backupsCollectionRef(uid));
    const backups = snap.docs
      .map(item => ({
        id: item.id,
        ref: item.ref,
        createdAt: item.data()?.createdAt || item.id,
      }))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

    const oldBackups = backups.slice(MAX_FIRESTORE_BACKUPS);
    if (oldBackups.length) {
      await Promise.all(oldBackups.map(item => deleteDoc(item.ref)));
    }
  };

  const createFirestoreBackup = async (snapshotData = data, source = 'auto-daily') => {
    if (!user?.uid) throw new Error('Bạn cần đăng nhập trước khi backup.');
    const dateKey = localDateKey();
    const payload = buildBackupPayload(snapshotData);
    const createdAt = new Date().toISOString();
    await setDoc(backupRef(user.uid, dateKey), {
      uid: user.uid,
      dateKey,
      createdAt,
      source,
      schemaVersion: 1,
      app: 'MindBuddy',
      counts: {
        moodLogs: payload.moodLogs.length,
        dailyReviews: Object.keys(payload.dailyReviews || {}).length,
        aiMemory: payload.aiMemory.length,
        customMoods: payload.customMoods.length,
      },
      data: payload,
    });
    await pruneOldBackups(user.uid);
    setBackupState({ status: 'ok', lastBackupDate: dateKey, error: '' });
    backupErrorNotifiedRef.current = false;
    return { dateKey, createdAt };
  };

  useEffect(() => {
    if (!user?.uid || !dataReady) return undefined;
    const dateKey = localDateKey();
    const signature = `${dateKey}:${backupSignature(data)}`;
    if (lastBackupSignatureRef.current === signature) return undefined;

    if (backupTimerRef.current) clearTimeout(backupTimerRef.current);
    backupTimerRef.current = setTimeout(async () => {
      try {
        await createFirestoreBackup(data, 'auto-daily');
        lastBackupSignatureRef.current = signature;
      } catch (err) {
        console.warn('Firestore backup failed:', err.message);
        setBackupState({ status: 'error', lastBackupDate: '', error: err.message });
        if (!backupErrorNotifiedRef.current) {
          backupErrorNotifiedRef.current = true;
          setSyncNotice({
            type: 'warning',
            message: 'Backup Firestore tự động chưa chạy được.',
            detail: err.message,
          });
        }
      }
    }, 2500);

    return () => {
      if (backupTimerRef.current) clearTimeout(backupTimerRef.current);
    };
  }, [user?.uid, dataReady, data]);

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

  const formatImageFields = (imageInput) => {
    if (!imageInput) return {};
    const attachments = normalizeMoodAttachments(Array.isArray(imageInput) ? imageInput : [imageInput]);
    const images = normalizeMoodImages(attachments);
    const image = images[0] || null;
    if (!attachments.length) return {};
    return {
      attachments,
      images,
      image,
      imageUrl: image?.url || '',
      imagePath: image?.path || '',
    };
  };

  const deleteMoodImage = async (path) => {
    if (!path) return;
    try {
      await deleteObject(storageRef(storage, path));
    } catch (err) {
      console.warn('Xóa ảnh check-in thất bại:', err.message);
    }
  };

  const addMoodLog = async (mood, note, metrics = null, images = null, options = {}) => {
    const log = {
      id: Date.now(),
      mood,
      note,
      metrics,
      ...formatImageFields(images),
      date: new Date().toISOString(),
      excludeFromAI: !!options.excludeFromAI,
    };
    const next = [log, ...data.moodLogs];
    setData(prev => ({ ...prev, moodLogs: next }));
    if (user?.uid) writeUserCache(user.uid, { ...data, moodLogs: next });
    if (user) await setDoc(userRef(user.uid), { moodLogs: next }, { merge: true });
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
  const updateMoodLog = async (id, mood, note, metrics = null, images, options = {}) => {
    const current = data.moodLogs.find(l => l.id === id);
    const currentAttachments = normalizeMoodAttachments(current);
    const nextAttachments = images && images !== null ? normalizeMoodAttachments(Array.isArray(images) ? images : [images]) : [];
    const hasPrivacyOption = Object.prototype.hasOwnProperty.call(options, 'excludeFromAI');
    const next = data.moodLogs.map(l => {
      if (l.id !== id) return l;
      const base = { ...l, mood, note, metrics, excludeFromAI: hasPrivacyOption ? !!options.excludeFromAI : !!l.excludeFromAI };
      if (images === undefined) return base;
      if (images === null) {
        const { attachments: _attachments, images: _images, image: _image, imageUrl: _imageUrl, imagePath: _imagePath, ...withoutImage } = base;
        return withoutImage;
      }
      return { ...base, ...formatImageFields(nextAttachments) };
    });
    setData(prev => ({ ...prev, moodLogs: next }));
    if (user?.uid) writeUserCache(user.uid, { ...data, moodLogs: next });
    if (user) await setDoc(userRef(user.uid), { moodLogs: next }, { merge: true });
    if (images === undefined) return;
    const nextPaths = new Set(nextAttachments.map(attachment => attachment.path).filter(Boolean));
    currentAttachments.forEach(attachment => {
      if (attachment.path && !nextPaths.has(attachment.path)) deleteMoodImage(attachment.path);
    });
  };

  // Xóa một log theo id
  const deleteMoodLog = async (id) => {
    const current = data.moodLogs.find(l => l.id === id);
    const next = data.moodLogs.filter(l => l.id !== id);
    setData(prev => ({ ...prev, moodLogs: next }));
    if (user?.uid) writeUserCache(user.uid, { ...data, moodLogs: next });
    if (user) await setDoc(userRef(user.uid), { moodLogs: next }, { merge: true });
    normalizeMoodAttachments(current).forEach(attachment => {
      if (attachment.path) deleteMoodImage(attachment.path);
    });
  };

  // Giữ lại updateTodayMood để tương thích
  const updateTodayMood = async (mood, note, metrics = null, images) => {
    const todayLogs = data.moodLogs.filter(l => new Date(l.date).toDateString() === new Date().toDateString());
    if (todayLogs.length === 0) return;
    await updateMoodLog(todayLogs[0].id, mood, note, metrics, images);
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

  const saveCauseOptions = async (next) => {
    const normalized = [...new Set((next || []).map(c => String(c).trim()).filter(Boolean))];
    await save({ causeOptions: normalized });
  };

  const importDataFromUid = async (sourceUid) => {
    const uid = String(sourceUid || '').trim();
    if (!user?.uid) throw new Error('Bạn cần đăng nhập trước khi khôi phục dữ liệu.');
    if (!uid) throw new Error('Hãy nhập UID cũ trong Firestore.');
    if (uid === user.uid) throw new Error('UID này đang là tài khoản hiện tại.');

    const snap = await getDoc(userRef(uid));
    if (!snap.exists()) {
      throw new Error(`Không tìm thấy document users/${uid}.`);
    }

    const imported = mergeImportedData(data, snap.data());
    setData(imported);
    writeUserCache(user.uid, imported);
    await setDoc(userRef(user.uid), imported, { merge: true });
    setSyncNotice(null);
    return {
      moodLogs: imported.moodLogs?.length || 0,
      sourceUid: uid,
      targetUid: user.uid,
    };
  };

  const reloadUserData = async () => {
    if (!user?.uid) return;
    await loadUserData(user.uid);
  };

  const inspectCurrentUserData = async () => {
    if (!user?.uid) throw new Error('Bạn cần đăng nhập trước khi kiểm tra Firestore.');
    const snap = await getDoc(userRef(user.uid));
    if (!snap.exists()) {
      return {
        exists: false,
        uid: user.uid,
        fields: [],
        counts: {},
      };
    }
    const raw = snap.data();
    return {
      exists: true,
      uid: user.uid,
      fields: Object.keys(raw).sort().map(key => ({
        key,
        type: summarizeFirestoreValue(raw[key]),
      })),
      counts: {
        moodLogs: normalizeListField(raw.moodLogs).length,
        aiMemory: normalizeListField(raw.aiMemory).length,
        customMoods: normalizeListField(raw.customMoods).length,
        dailyReviews: raw.dailyReviews && typeof raw.dailyReviews === 'object' ? Object.keys(raw.dailyReviews).length : 0,
      },
    };
  };

  const getCurrentUserRawData = async () => {
    if (!user?.uid) throw new Error('Bạn cần đăng nhập trước khi tải dữ liệu Firestore.');
    const snap = await getDoc(userRef(user.uid));
    if (!snap.exists()) throw new Error(`Không tìm thấy document users/${user.uid}.`);
    const raw = snap.data();
    return {
      exportedAt: new Date().toISOString(),
      uid: user.uid,
      path: `users/${user.uid}`,
      fieldSummary: Object.keys(raw).sort().reduce((acc, key) => {
        acc[key] = summarizeFirestoreValue(raw[key]);
        return acc;
      }, {}),
      data: raw,
    };
  };

  const recoverMoodLogsFromReviews = async () => {
    if (!user?.uid) throw new Error('Bạn cần đăng nhập trước khi khôi phục nhật ký.');
    const snap = await getDoc(userRef(user.uid));
    if (!snap.exists()) throw new Error(`Không tìm thấy document users/${user.uid}.`);

    const raw = snap.data();
    const allMoods = [...MOODS, ...normalizeListField(raw.customMoods)];
    const fromReviews = recoverLogsFromDailyReviews(raw.dailyReviews, allMoods);
    const coveredDateKeys = new Set([
      ...normalizeListField(raw.moodLogs).map(log => dateKeyFromMemoryDate(log?.date)),
      ...fromReviews.map(log => dateKeyFromMemoryDate(log?.date)),
    ].filter(Boolean));
    const fromMemory = recoverLogsFromAiMemory(raw.aiMemory, allMoods, coveredDateKeys);
    const recovered = [...fromReviews, ...fromMemory];
    if (!recovered.length) {
      throw new Error('Không tìm thấy entry check-in nào trong dailyReviews hoặc aiMemory để dựng lại.');
    }

    const current = mergeUserData(raw);
    const nextLogs = mergeRecords(current.moodLogs, recovered);
    const nextData = { ...current, moodLogs: nextLogs };
    setData(nextData);
    writeUserCache(user.uid, nextData);
    await setDoc(userRef(user.uid), { moodLogs: nextLogs }, { merge: true });
    setSyncNotice(null);
    return {
      recovered: recovered.length,
      fromReviews: fromReviews.length,
      fromMemory: fromMemory.length,
      total: nextLogs.length,
    };
  };

  const goalOptions = normalizeGoalOptions(data.goalOptions);
  const currentGoal = goalOptions.find(goal => goal.id === data.userGoal) || goalOptions[0] || DEFAULT_GOALS[0];

  const saveGoalOptions = async (next) => {
    const normalized = normalizeGoalOptions(next);
    const nextGoal = normalized.some(goal => goal.id === data.userGoal)
      ? data.userGoal
      : normalized[0].id;
    await save({
      goalOptions: normalized,
      userGoal: nextGoal,
      weeklyInsight: null,
      todayAI: null,
    });
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
      saveCauseOptions,
      importDataFromUid,
      reloadUserData,
      inspectCurrentUserData,
      getCurrentUserRawData,
      recoverMoodLogsFromReviews,
      backupState,
      createFirestoreBackup,
      goalOptions,
      currentGoal,
      saveGoalOptions,
      syncNotice,
      clearSyncNotice: () => setSyncNotice(null),
      growGarden,
      setEmergencyContact: (v) => save({ emergencyContact: v }),
      setUserGoal: (v) => save({ userGoal: v, weeklyInsight: null, todayAI: null }),
      saveTodayAI: (aiData) => save({ todayAI: { ...aiData, date: new Date().toDateString() } }),
      saveWeeklyInsight: (text, logCount, goal) => save({
        weeklyInsight: { text, logCount, goal, savedAt: Date.now() },
      }),
      saveDailyReview: (dateKey, review) => save({
        dailyReviews: { ...(data.dailyReviews || {}), [dateKey]: review },
      }),
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
