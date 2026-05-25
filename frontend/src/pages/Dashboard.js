import React from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { format, subDays } from 'date-fns';
import { vi } from 'date-fns/locale';
import NotificationSettings from '../components/NotificationSettings';
import WeeklyInsight from '../components/WeeklyInsight';
import CrisisPanel from '../components/CrisisPanel';
import RichText from '../components/RichText';
import MediaAttachments from '../components/MediaAttachments';
import { analyzeMood, detectDanger, summarizeDay } from '../utils/aiService';
import { uploadMoodFiles } from '../utils/imageUpload';
import { normalizeMoodAttachments } from '../utils/moodImages';
import './Dashboard.css';

const GOALS = [
  { id: 'stress', label: 'Giảm stress', desc: 'Ưu tiên hạ căng thẳng và ổn định cảm xúc.' },
  { id: 'sleep', label: 'Ngủ tốt hơn', desc: 'Ưu tiên nhịp sinh hoạt và nghỉ ngơi.' },
  { id: 'study', label: 'Tập trung học tập', desc: 'Ưu tiên năng lượng, Pomodoro và kế hoạch học.' },
];

const QUICK_FORMAT_TOOLS = [
  { id: 'bold', label: 'B', title: 'Bôi đậm', prefix: '**', suffix: '**', sample: 'nội dung quan trọng' },
  { id: 'underline', label: 'U', title: 'Gạch chân', prefix: '<u>', suffix: '</u>', sample: 'điều cần nhớ' },
  { id: 'heading', label: 'H', title: 'Tiêu đề', linePrefix: '## ', sample: 'Tiêu đề nhỏ' },
  { id: 'checklist', label: '☑', title: 'Checklist', linePrefix: '- [ ] ', sample: 'việc nhỏ cần làm' },
  { id: 'quote', label: '❝', title: 'Trích dẫn', linePrefix: '> ', sample: 'một câu mình muốn giữ lại' },
];

const ENERGY_BUCKETS = [
  { id: 'morning', label: 'Sáng', short: 'Sáng', range: '05:00-11:59' },
  { id: 'afternoon', label: 'Chiều', short: 'Chiều', range: '12:00-17:59' },
  { id: 'evening', label: 'Tối', short: 'Tối', range: '18:00-04:59' },
];

function getFirstName(user) {
  const source = user?.displayName || user?.email || 'bạn';
  return source.split('@')[0].split(' ')[0];
}

function getDayBucket(value) {
  const date = new Date(value);
  const hour = Number.isNaN(date.getTime()) ? 12 : date.getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  return 'evening';
}

function averageNumbers(values) {
  const valid = values.map(Number).filter(Number.isFinite);
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function readPomodoroMoodSessions(user) {
  try {
    const key = `mb_pomodoro_mood_sessions_${user?.uid || user?.email || 'guest'}`;
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
}

export default function Dashboard() {
  const {
    user, moodLogs, MOODS, customMoods, pomodoroCount, gardenLevel, earnedBadges, BADGES,
    getStreak, addMoodLog, userGoal, setUserGoal,
    saveTodayAI, aiMemory, saveAiMemory,
  } = useApp();
  const [quickMood, setQuickMood] = React.useState(null);
  const [quickNote, setQuickNote] = React.useState('');
  const [quickFeedback, setQuickFeedback] = React.useState('');
  const [quickAnalyzing, setQuickAnalyzing] = React.useState(false);
  const [showCrisis, setShowCrisis] = React.useState(false);
  const [selectedDayDetail, setSelectedDayDetail] = React.useState(null);
  const [selectedMemory, setSelectedMemory] = React.useState(null);
  const [quickImageFiles, setQuickImageFiles] = React.useState([]);
  const [quickImagePreviews, setQuickImagePreviews] = React.useState([]);
  const [quickImageError, setQuickImageError] = React.useState('');
  const quickImageInputRef = React.useRef(null);
  const quickImagePreviewsRef = React.useRef([]);
  const quickNoteRef = React.useRef(null);

  const today = new Date();
  const allMoods = React.useMemo(
    () => [...MOODS, ...(customMoods || [])],
    [MOODS, customMoods]
  );
  const todayStr = today.toDateString();
  const todayLogs = moodLogs.filter(l => new Date(l.date).toDateString() === todayStr);
  const latestTodayMood = todayLogs[0];
  const latestMood = latestTodayMood ? allMoods.find(m => m.id === latestTodayMood.mood) : null;
  const latestMoodScore = latestMood?.score || 0;
  const currentGoal = GOALS.find(g => g.id === userGoal) || GOALS[0];

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(today, 6 - i);
    const dayStr = d.toDateString();
    const dayLogs = moodLogs
      .filter(l => new Date(l.date).toDateString() === dayStr)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    const log = dayLogs[0];
    const mood = log ? allMoods.find(m => m.id === log.mood) : null;
    return {
      key: dayStr,
      date: format(d, 'EEE', { locale: vi }),
      fullDate: format(d, 'dd/MM'),
      score: mood?.score ?? null,
      hasData: !!log,
      mood,
      logs: dayLogs,
    };
  });

  const weekLogs = last7.filter(d => d.hasData);
  const weekAverage = weekLogs.length
    ? (weekLogs.reduce((sum, d) => sum + d.score, 0) / weekLogs.length).toFixed(1)
    : null;
  const weekDirection = weekLogs.length >= 2
    ? weekLogs[weekLogs.length - 1].score - weekLogs[0].score
    : 0;

  const recentPhotoLogs = React.useMemo(() => (
    moodLogs
      .flatMap(log => {
        const mood = allMoods.find(m => m.id === log.mood);
        const attachments = normalizeMoodAttachments(log);
        const cleanNote = log.note?.replace(/\s*\[.+\]$/, '') || '';
        const causeTags = log.note?.match(/\[(.+)\]$/)?.[1]?.split(', ') || [];
        return attachments.map((attachment, attachmentIndex) => ({
          ...log,
          photoId: `${log.id}-${attachmentIndex}`,
          mood,
          imageUrl: attachment.url,
          attachment,
          attachmentIndex,
          attachments,
          cleanNote,
          causeTags,
        }));
      })
      .filter(log => log.imageUrl)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 10)
  ), [allMoods, moodLogs]);

  const pomodoroMoodSessions = React.useMemo(() => readPomodoroMoodSessions(user), [user]);

  const energyMap = React.useMemo(() => {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const buckets = ENERGY_BUCKETS.reduce((acc, bucket) => {
      acc[bucket.id] = {
        ...bucket,
        stressValues: [],
        energyValues: [],
        focusValues: [],
        pomodoroFocusAfter: [],
        pomodoroDelta: [],
      };
      return acc;
    }, {});

    moodLogs.forEach(log => {
      const date = new Date(log.date);
      if (Number.isNaN(date.getTime()) || date < since || !log.metrics) return;
      const bucket = buckets[getDayBucket(date)];
      ['stress', 'energy', 'focus'].forEach(key => {
        const value = Number(log.metrics?.[key]);
        if (Number.isFinite(value)) bucket[`${key}Values`].push(Math.min(5, Math.max(1, value)));
      });
    });

    pomodoroMoodSessions.forEach(session => {
      const date = new Date(session.completedAt || session.date);
      if (Number.isNaN(date.getTime()) || date < since) return;
      const bucket = buckets[getDayBucket(date)];
      const focusAfter = Number(session.focusAfter);
      const focusBefore = Number(session.focusBefore);
      if (Number.isFinite(focusAfter)) bucket.pomodoroFocusAfter.push(Math.min(5, Math.max(1, focusAfter)));
      if (Number.isFinite(focusAfter) && Number.isFinite(focusBefore)) bucket.pomodoroDelta.push(focusAfter - focusBefore);
    });

    const data = ENERGY_BUCKETS.map(bucket => {
      const item = buckets[bucket.id];
      const stress = averageNumbers(item.stressValues);
      const energy = averageNumbers(item.energyValues);
      const focus = averageNumbers(item.focusValues);
      const pomodoroFocus = averageNumbers(item.pomodoroFocusAfter);
      const pomodoroDelta = averageNumbers(item.pomodoroDelta);
      return {
        id: bucket.id,
        label: bucket.label,
        range: bucket.range,
        stress: stress ? Number(stress.toFixed(1)) : null,
        energy: energy ? Number(energy.toFixed(1)) : null,
        focus: focus ? Number(focus.toFixed(1)) : null,
        checkins: Math.max(item.stressValues.length, item.energyValues.length, item.focusValues.length),
        pomodoros: item.pomodoroFocusAfter.length,
        pomodoroFocus: pomodoroFocus ? Number(pomodoroFocus.toFixed(1)) : null,
        pomodoroDelta: pomodoroDelta ? Number(pomodoroDelta.toFixed(1)) : null,
      };
    });

    const hasMetrics = data.some(item => item.checkins > 0);
    const bestFocus = [...data]
      .filter(item => item.focus !== null || item.pomodoroFocus !== null)
      .sort((a, b) => Math.max(b.focus || 0, b.pomodoroFocus || 0) - Math.max(a.focus || 0, a.pomodoroFocus || 0))[0];
    const highestStress = [...data]
      .filter(item => item.stress !== null)
      .sort((a, b) => b.stress - a.stress)[0];
    const bestEnergy = [...data]
      .filter(item => item.energy !== null)
      .sort((a, b) => b.energy - a.energy)[0];

    return { data, hasMetrics, bestFocus, highestStress, bestEnergy };
  }, [moodLogs, pomodoroMoodSessions]);

  const streak = getStreak(moodLogs);
  const gardenEmoji = gardenLevel < 20 ? '🌱' : gardenLevel < 50 ? '🌿' : gardenLevel < 80 ? '🌳' : '🌸';
  const nextPomodoro = Math.max(0, 10 - pomodoroCount);
  const pomodoroProgress = Math.min(100, (pomodoroCount / 10) * 100);
  const streakProgress = Math.min(100, (streak / 7) * 100);
  const nextGardenMilestone = gardenLevel < 20 ? 20 : gardenLevel < 50 ? 50 : gardenLevel < 80 ? 80 : 100;
  const gardenRemaining = Math.max(0, nextGardenMilestone - gardenLevel);
  const gardenProgress = Math.min(100, gardenLevel);
  const badgeProgress = BADGES.length ? Math.min(100, (earnedBadges.length / BADGES.length) * 100) : 0;

  const nextAction = (() => {
    if (!latestTodayMood) {
      return {
        icon: '💭',
        title: 'Ghi cảm xúc đầu tiên hôm nay',
        text: 'Một check-in ngắn là đủ để MindBuddy hiểu ngày của bạn đang bắt đầu thế nào.',
        to: '/mood',
        label: 'Mở trang cảm xúc',
      };
    }
    if (latestMoodScore <= 2) {
      return {
        icon: '🫁',
        title: 'Hạ nhịp trong 2 phút',
        text: 'Mood gần nhất khá nặng. Hãy mở S.O.S và thử một vòng thở 4-7-8 trước khi làm tiếp.',
        to: '/sos',
        label: 'Thở cùng MindBuddy',
      };
    }
    if (userGoal === 'study' && pomodoroCount === 0) {
      return {
        icon: '🍅',
        title: 'Bắt đầu một phiên tập trung',
        text: 'Bạn đã check-in rồi. Một Pomodoro ngắn sẽ giúp biến trạng thái hiện tại thành hành động.',
        to: '/pomodoro',
        label: 'Bắt đầu Pomodoro',
      };
    }
    if (gardenLevel < nextGardenMilestone) {
      return {
        icon: gardenEmoji,
        title: 'Chăm vườn bằng một thói quen nhỏ',
        text: `Còn ${gardenRemaining}% để tới mốc ${nextGardenMilestone}%. Chọn một việc nhẹ như thở, uống nước hoặc viết vài dòng.`,
        to: '/garden',
        label: 'Chăm vườn',
      };
    }
    return {
      icon: '✨',
      title: 'Nhìn lại xu hướng tuần này',
      text: 'Bạn đã có dữ liệu hôm nay. Xem insight để chọn một điều nhỏ cho ngày mai.',
      to: '/mood?tab=history',
      label: 'Xem lịch sử',
    };
  })();

  React.useEffect(() => {
    quickImagePreviewsRef.current = quickImagePreviews;
  }, [quickImagePreviews]);

  React.useEffect(() => () => {
    quickImagePreviewsRef.current.forEach(item => URL.revokeObjectURL(item.url));
  }, []);

  const handleQuickImageSelect = (event) => {
    const files = Array.from(event.target.files || []);
    setQuickImageError('');
    if (!files.length) return;
    const isSupported = file => file.type.startsWith('image/') || file.type.startsWith('video/') || file.type.startsWith('audio/');
    if (files.some(file => !isSupported(file))) {
      setQuickImageError('Vui lòng chọn ảnh, video hoặc âm thanh.');
      return;
    }
    if (files.some(file => file.type.startsWith('image/') && file.size > 8 * 1024 * 1024)) {
      setQuickImageError('Mỗi ảnh tối đa 8MB.');
      return;
    }
    if (files.some(file => file.type.startsWith('audio/') && file.size > 25 * 1024 * 1024)) {
      setQuickImageError('Mỗi tệp âm thanh tối đa 25MB.');
      return;
    }
    if (files.some(file => file.type.startsWith('video/') && file.size > 100 * 1024 * 1024)) {
      setQuickImageError('Mỗi video tối đa 100MB.');
      return;
    }
    const previews = files.map(file => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
      url: URL.createObjectURL(file),
      file,
    }));
    setQuickImageFiles(prev => [...prev, ...files]);
    setQuickImagePreviews(prev => [...prev, ...previews]);
    if (quickImageInputRef.current) quickImageInputRef.current.value = '';
  };

  const removeQuickImage = (index) => {
    setQuickImagePreviews(prev => {
      const target = prev[index];
      if (target?.url) URL.revokeObjectURL(target.url);
      return prev.filter((_, i) => i !== index);
    });
    setQuickImageFiles(prev => prev.filter((_, i) => i !== index));
    setQuickImageError('');
    if (quickImageInputRef.current) quickImageInputRef.current.value = '';
  };

  const clearQuickImages = () => {
    quickImagePreviews.forEach(item => URL.revokeObjectURL(item.url));
    setQuickImageFiles([]);
    setQuickImagePreviews([]);
    setQuickImageError('');
    if (quickImageInputRef.current) quickImageInputRef.current.value = '';
  };

  const applyQuickNoteFormat = (tool) => {
    const textarea = quickNoteRef.current;
    const currentNote = quickNote || '';
    const start = textarea?.selectionStart ?? currentNote.length;
    const end = textarea?.selectionEnd ?? currentNote.length;
    const selectedText = currentNote.slice(start, end);
    let insertText;
    let nextCursorStart;
    let nextCursorEnd;

    if (tool.linePrefix) {
      const lineStart = currentNote.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
      const needsNewLine = lineStart !== start && currentNote.slice(lineStart, start).trim().length > 0;
      const prefix = needsNewLine ? `\n${tool.linePrefix}` : tool.linePrefix;
      insertText = `${prefix}${selectedText || tool.sample}`;
      nextCursorStart = start + prefix.length;
      nextCursorEnd = nextCursorStart + (selectedText || tool.sample).length;
    } else {
      insertText = `${tool.prefix}${selectedText || tool.sample}${tool.suffix}`;
      nextCursorStart = start + tool.prefix.length;
      nextCursorEnd = nextCursorStart + (selectedText || tool.sample).length;
    }

    setQuickNote(`${currentNote.slice(0, start)}${insertText}${currentNote.slice(end)}`);
    window.setTimeout(() => {
      textarea?.focus();
      textarea?.setSelectionRange(nextCursorStart, nextCursorEnd);
    }, 0);
  };

  const handleQuickCheckin = async () => {
    if (!quickMood || quickAnalyzing) return;
    if (detectDanger(quickNote)) setShowCrisis(true);
    const mood = allMoods.find(m => m.id === quickMood);
    const note = quickNote;
    const recentMoods = moodLogs.slice(0, 7)
      .map(l => allMoods.find(m => m.id === l.mood))
      .filter(Boolean);

    setQuickAnalyzing(true);
    setQuickImageError('');
    let imagePayload = null;
    try {
      if (quickImageFiles.length > 0) {
        imagePayload = await uploadMoodFiles({ files: quickImageFiles, user, namespace: 'quick-checkins' });
      }
    } catch (err) {
      console.error('Quick media upload error:', err);
      setQuickImageError(err.message || 'Không thể lưu tệp check-in.');
      setQuickAnalyzing(false);
      return;
    }
    await addMoodLog(quickMood, note, null, imagePayload);
    setQuickMood(null);
    setQuickNote('');
    clearQuickImages();
    setQuickFeedback('Đã ghi lại hôm nay. MindBuddy đang phân tích nhanh cho bạn...');

    try {
      const advice = await analyzeMood({
        moodLabel: mood?.label || 'Không rõ',
        note,
        causes: [],
        metrics: null,
        recentMoods,
        aiMemory: aiMemory || [],
        userGoal,
      });

      if (advice) {
        saveTodayAI({ advice, moodLabel: mood?.label || '', chatMessages: [] });
      }

      const todayLabel = format(new Date(), 'dd/MM/yyyy');
      const todayEntries = [
        { moodLabel: mood?.label || 'Không rõ', note, causes: [] },
        ...moodLogs
          .filter(l => new Date(l.date).toDateString() === new Date().toDateString())
          .map(l => {
            const m = allMoods.find(x => x.id === l.mood);
            const causesInNote = l.note?.match(/\[(.+)\]/)?.[1]?.split(', ') || [];
            const cleanNote = l.note?.replace(/\s*\[.+\]$/, '') || '';
            return { moodLabel: m?.label || 'Không rõ', note: cleanNote, causes: causesInNote, metrics: l.metrics };
          }),
      ];
      summarizeDay({ date: todayLabel, entries: todayEntries }).then(summary => {
        if (summary !== null) {
          saveAiMemory({
            date: todayLabel,
            summary: summary || '',
            moods: todayEntries.map(e => e.moodLabel),
          });
        }
      });

      setQuickFeedback(advice
        ? 'Đã ghi lại và tạo lời khuyên AI. Mở tab Insight trong trang Cảm xúc để xem.'
        : 'Đã ghi lại hôm nay. AI chưa phản hồi được, bạn có thể thử lại trong trang Cảm xúc.');
    } catch (err) {
      console.error('Dashboard quick AI error:', err);
      setQuickFeedback('Đã ghi lại hôm nay. AI đang bận, bạn có thể xem lại trong trang Cảm xúc.');
    } finally {
      setQuickAnalyzing(false);
    }
    window.setTimeout(() => setQuickFeedback(''), 3200);
  };

  return (
    <div className="dashboard">
      <section className="today-hero">
        <div className="today-hero-copy">
          <span className="today-date">{format(today, "EEEE, dd/MM/yyyy", { locale: vi })}</span>
          <h1>Hôm nay của {getFirstName(user)}</h1>
          <p>
            {latestTodayMood
              ? <>Bạn đã check-in <strong>{todayLogs.length}</strong> lần. Trạng thái mới nhất là <strong>{latestMood?.label}</strong> {latestMood?.emoji}.</>
              : 'Bắt đầu bằng một check-in ngắn, rồi chọn một việc nhỏ đủ làm ngay.'}
          </p>
        </div>

        <div className="today-hero-status" aria-label="Tóm tắt hôm nay">
          <div className="today-mood-orb" style={{ '--mood-color': latestMood?.color || '#a29bfe' }}>
            {latestMood?.emoji || '💭'}
          </div>
          <div>
            <span>Trạng thái gần nhất</span>
            <strong>{latestMood?.label || 'Chưa check-in'}</strong>
          </div>
          <div className="today-mini-metrics">
            <span>{streak} ngày streak</span>
            <span>{gardenLevel}% vườn</span>
          </div>
        </div>
      </section>

      {showCrisis && <CrisisPanel onDismiss={() => setShowCrisis(false)} />}

      <section className="today-grid">
        <div className="card today-checkin-card">
          <div className="section-heading-row">
            <div>
              <h3>Check-in nhanh</h3>
              <p className="text-muted">Chọn cảm xúc hiện tại và ghi một dòng nếu bạn muốn.</p>
            </div>
            <Link to="/mood" className="quick-link">Ghi đầy đủ</Link>
          </div>

          <div className="quick-mood-row">
            {allMoods.map(m => (
              <button
                key={m.id}
                className={`quick-mood-btn ${quickMood === m.id ? 'selected' : ''}`}
                style={{ '--mood-color': m.color }}
                aria-label={`Chọn cảm xúc ${m.label}`}
                aria-pressed={quickMood === m.id}
                onClick={() => setQuickMood(m.id)}
              >
                <span aria-hidden="true">{m.emoji}</span>
                <small>{m.label}</small>
              </button>
            ))}
          </div>

          <textarea
            ref={quickNoteRef}
            value={quickNote}
            onChange={e => {
              setQuickNote(e.target.value);
              if (detectDanger(e.target.value)) setShowCrisis(true);
            }}
            rows={3}
            placeholder="Điều gì đang ảnh hưởng tới bạn hôm nay?"
            aria-label="Ghi chú cảm xúc nhanh"
          />
          <div className="quick-format-toolbar" aria-label="Định dạng ghi chú nhanh">
            {QUICK_FORMAT_TOOLS.map(tool => (
              <button
                key={tool.id}
                type="button"
                className={`quick-format-btn ${tool.id}`}
                onClick={() => applyQuickNoteFormat(tool)}
                title={tool.title}
                aria-label={tool.title}
              >
                {tool.label}
              </button>
            ))}
          </div>
          {quickNote.trim() && (
            <div className="quick-note-preview">
              <span>Xem trước ghi chú</span>
              <RichText text={quickNote} className="quick-note-preview-content" />
            </div>
          )}
          <div className="quick-photo-field">
            <input
              ref={quickImageInputRef}
              type="file"
              accept="image/*,video/*,audio/*"
              multiple
              onChange={handleQuickImageSelect}
              hidden
            />
            <button type="button" className="quick-photo-btn" onClick={() => quickImageInputRef.current?.click()}>
              Thêm tệp
            </button>
            {quickImagePreviews.length > 0 && (
              <div className="quick-photo-preview-grid">
                {quickImagePreviews.map((preview, index) => (
                  <div key={preview.id} className="quick-photo-preview">
                    {preview.file?.type.startsWith('video/') ? (
                      <video src={preview.url} muted preload="metadata" />
                    ) : preview.file?.type.startsWith('audio/') ? (
                      <div className="media-file-preview"><span>{preview.file.name}</span></div>
                    ) : (
                      <img src={preview.url} alt={`Tệp check-in xem trước ${index + 1}`} />
                    )}
                    <button type="button" onClick={() => removeQuickImage(index)}>Bỏ tệp</button>
                  </div>
                ))}
              </div>
            )}
            {quickImageError && <p className="quick-photo-error" role="alert">{quickImageError}</p>}
          </div>
          <button className="btn btn-primary w-full" onClick={handleQuickCheckin} disabled={!quickMood || quickAnalyzing}>
            {quickAnalyzing ? 'Đang phân tích...' : 'Lưu check-in hôm nay'}
          </button>
          {quickFeedback && <p className="quick-feedback" role="status">{quickFeedback}</p>}
        </div>

        <aside className="card next-action-card">
          <span className="next-action-kicker">Việc nhỏ tiếp theo</span>
          <div className="next-action-icon" aria-hidden="true">{nextAction.icon}</div>
          <h3>{nextAction.title}</h3>
          <p>{nextAction.text}</p>
          <Link to={nextAction.to} className="btn btn-primary w-full">{nextAction.label}</Link>
          <div className="goal-pill">
            <span>Mục tiêu hiện tại</span>
            <strong>{currentGoal.label}</strong>
          </div>
        </aside>
      </section>

      <section className="card week-overview-card">
        <div className="section-heading-row">
          <div>
            <h3>Tuần này nhìn nhanh</h3>
            <p className="text-muted">
              {weekAverage
                ? `Điểm mood trung bình ${weekAverage}/5${weekDirection > 0 ? ', đang đi lên.' : weekDirection < 0 ? ', đang giảm nhẹ.' : ', khá ổn định.'}`
                : 'Chưa đủ dữ liệu để thấy xu hướng.'}
            </p>
          </div>
          <Link to="/mood?tab=history" className="quick-link">Xem lịch sử</Link>
        </div>

        <div className="week-strip" aria-label="Cảm xúc 7 ngày qua">
          {last7.map(day => (
            <button
              key={day.fullDate}
              type="button"
              className={`week-day ${day.hasData ? 'has-data' : ''}`}
              style={{ '--mood-color': day.mood?.color || 'var(--border)' }}
              disabled={!day.logs.length}
              onClick={() => setSelectedDayDetail({ dayKey: day.key, logs: day.logs })}
              aria-label={day.hasData
                ? `Xem ${day.logs.length} ghi chú ngày ${day.fullDate}, cảm xúc mới nhất ${day.mood?.label}`
                : `Ngày ${day.fullDate} chưa có ghi chú`}
            >
              <span className="week-label">{day.date}</span>
              <span
                className="week-dot"
                style={{ '--mood-color': day.mood?.color || 'var(--border)' }}
                title={day.hasData ? `${day.fullDate}: ${day.mood?.label}` : `${day.fullDate}: chưa ghi`}
              >
                {day.mood?.emoji || ''}
              </span>
              <small>{day.fullDate}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="card recent-memories-card">
        <div className="section-heading-row">
          <div>
            <h3>Tệp gần đây</h3>
            <p className="text-muted">Bấm vào tệp để mở lại cảm xúc và ghi chú đi kèm.</p>
          </div>
          <Link to="/mood?tab=history" className="quick-link">Mở lịch sử</Link>
        </div>

        {recentPhotoLogs.length > 0 ? (
          <div className="memory-photo-strip" aria-label="Tệp check-in gần đây">
            {recentPhotoLogs.map(log => (
              <button
                key={log.photoId}
                type="button"
                className="memory-photo-tile"
                onClick={() => setSelectedMemory(log)}
                aria-label={`Mở ghi chú tệp ngày ${format(new Date(log.date), 'dd/MM/yyyy')} lúc ${format(new Date(log.date), 'HH:mm')}`}
              >
                {log.attachment?.kind === 'video' ? (
                  <video src={log.imageUrl} muted preload="metadata" />
                ) : log.attachment?.kind === 'audio' ? (
                  <div className="memory-media-placeholder">Audio</div>
                ) : (
                  <img src={log.imageUrl} alt={`Tệp check-in ${log.mood?.label || 'không rõ'} lúc ${format(new Date(log.date), 'HH:mm')}`} />
                )}
                <span>{format(new Date(log.date), 'dd/MM')}{log.attachments.length > 1 ? ` · ${log.attachmentIndex + 1}/${log.attachments.length}` : ''}</span>
                <strong>{log.mood?.emoji} {log.mood?.label || 'Không rõ'}</strong>
              </button>
            ))}
          </div>
        ) : (
          <div className="memory-empty">
            <span aria-hidden="true">🖼️</span>
            <div>
              <strong>Chưa có tệp check-in</strong>
              <p>Lần tới khi ghi cảm xúc, thêm một ảnh, video hoặc ghi âm ngắn để MindBuddy lưu lại ngữ cảnh của ngày đó.</p>
            </div>
          </div>
        )}
      </section>

      <section className="quick-actions today-tools">
        <div className="section-heading-row mb-3">
          <div>
            <h3>Công cụ cho hôm nay</h3>
            <p className="text-muted">Các lối tắt bạn có thể dùng ngay trong ngày.</p>
          </div>
        </div>
        <div className="actions-grid">
          {[
            { to: '/mood', icon: '💭', label: latestTodayMood ? 'Ghi thêm cảm xúc' : 'Ghi cảm xúc', color: '#a29bfe', primary: true },
            { to: '/needs', icon: '🧭', label: 'Mình cần gì?', color: '#00cec9' },
            { to: '/daily-review', icon: '🪞', label: 'Nhìn lại ngày', color: '#00cec9' },
            { to: '/good-moments', icon: '✨', label: 'Khoảnh khắc tốt', color: '#fdcb6e' },
            { to: '/pomodoro', icon: '🍅', label: 'Tập trung', color: '#fd79a8' },
            { to: '/garden', icon: '🌱', label: 'Chăm vườn', color: '#55efc4' },
            { to: '/community', icon: '🌍', label: 'Góc chia sẻ', color: '#74b9ff' },
            { to: '/sos', icon: '🆘', label: 'S.O.S', color: '#e17055' },
          ].map(a => (
            <Link key={a.to} to={a.to} className={`action-card ${a.primary ? 'primary-action' : ''}`} style={{ '--action-color': a.color }} aria-label={a.label}>
              <span className="action-icon" aria-hidden="true">{a.icon}</span>
              <span className="action-label">{a.label}</span>
            </Link>
          ))}
        </div>
      </section>

      <div className="stats-grid">
        <div className="stat-card progress-card">
          <div className="stat-icon" aria-hidden="true">🔥</div>
          <div className="stat-value">{streak}</div>
          <div className="stat-label">Ngày liên tiếp</div>
          <div className="mini-progress" role="progressbar" aria-valuemin="0" aria-valuemax="7" aria-valuenow={Math.min(streak, 7)} aria-label="Tiến trình streak">
            <span style={{ width: `${streakProgress}%` }} />
          </div>
          <p className="progress-hint">{streak >= 7 ? 'Đã mở mốc 7 ngày liên tiếp' : `Còn ${7 - streak} ngày để đạt mốc 7 ngày`}</p>
        </div>
        <div className="stat-card progress-card">
          <div className="stat-icon" aria-hidden="true">🍅</div>
          <div className="stat-value">{pomodoroCount}</div>
          <div className="stat-label">Pomodoro hoàn thành</div>
          <div className="mini-progress" role="progressbar" aria-valuemin="0" aria-valuemax="10" aria-valuenow={Math.min(pomodoroCount, 10)} aria-label="Tiến trình huy hiệu Pomodoro">
            <span style={{ width: `${pomodoroProgress}%` }} />
          </div>
          <p className="progress-hint">{nextPomodoro === 0 ? 'Đã đủ điều kiện huy hiệu tập trung' : `Còn ${nextPomodoro} lần Pomodoro để mở huy hiệu`}</p>
        </div>
        <div className="stat-card progress-card">
          <div className="stat-icon" aria-hidden="true">{gardenEmoji}</div>
          <div className="stat-value">{gardenLevel}%</div>
          <div className="stat-label">Sức khỏe vườn</div>
          <div className="mini-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={gardenLevel} aria-label="Sức khỏe vườn">
            <span style={{ width: `${gardenProgress}%` }} />
          </div>
          <p className="progress-hint">{gardenLevel >= 100 ? 'Vườn đã đạt mức cao nhất' : `Còn ${gardenRemaining}% tới mốc ${nextGardenMilestone}%`}</p>
        </div>
        <div className="stat-card progress-card">
          <div className="stat-icon" aria-hidden="true">🏅</div>
          <div className="stat-value">{earnedBadges.length}</div>
          <div className="stat-label">Huy hiệu đạt được</div>
          <div className="mini-progress" role="progressbar" aria-valuemin="0" aria-valuemax={BADGES.length} aria-valuenow={earnedBadges.length} aria-label="Tiến trình huy hiệu">
            <span style={{ width: `${badgeProgress}%` }} />
          </div>
          <p className="progress-hint">{earnedBadges.length >= BADGES.length ? 'Đã sưu tập toàn bộ huy hiệu' : `${earnedBadges.length}/${BADGES.length} huy hiệu đã mở`}</p>
        </div>
      </div>

      <section className="card energy-map-card">
        <div className="section-heading-row">
          <div>
            <h3>Bản đồ năng lượng trong ngày</h3>
            <p className="text-muted">Trung bình 30 ngày gần nhất theo check-in và phản hồi Pomodoro.</p>
          </div>
          <Link to="/mood" className="quick-link">Thêm chỉ số</Link>
        </div>

        {energyMap.hasMetrics ? (
          <div className="energy-map-layout">
            <div className="energy-chart-wrap" aria-label="Biểu đồ stress, năng lượng và tập trung theo khung giờ">
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={energyMap.data} barSize={16}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.22)" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} width={24} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value, name) => [`${value}/5`, name]}
                    labelFormatter={(label) => {
                      const bucket = energyMap.data.find(item => item.label === label);
                      return bucket ? `${bucket.label} (${bucket.range})` : label;
                    }}
                  />
                  <Bar dataKey="stress" name="Stress" fill="#ff7675" radius={[5, 5, 0, 0]} />
                  <Bar dataKey="energy" name="Năng lượng" fill="#55efc4" radius={[5, 5, 0, 0]} />
                  <Bar dataKey="focus" name="Tập trung" fill="#a29bfe" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="energy-legend" aria-label="Chú giải biểu đồ">
                <span><i className="stress" />Stress</span>
                <span><i className="energy" />Năng lượng</span>
                <span><i className="focus" />Tập trung</span>
              </div>
            </div>

            <div className="energy-insights">
              {energyMap.bestFocus && (
                <div className="energy-insight-item focus">
                  <span>Tập trung tốt nhất</span>
                  <strong>{energyMap.bestFocus.label}</strong>
                  <p>
                    Check-in {energyMap.bestFocus.focus || '-'}/5
                    {energyMap.bestFocus.pomodoroFocus ? `, Pomodoro sau phiên ${energyMap.bestFocus.pomodoroFocus}/5` : ''}.
                  </p>
                </div>
              )}
              {energyMap.highestStress && (
                <div className="energy-insight-item stress">
                  <span>Dễ căng hơn</span>
                  <strong>{energyMap.highestStress.label}</strong>
                  <p>Stress trung bình {energyMap.highestStress.stress}/5 trong {energyMap.highestStress.checkins} check-in.</p>
                </div>
              )}
              {energyMap.bestEnergy && (
                <div className="energy-insight-item energy">
                  <span>Nhiều năng lượng nhất</span>
                  <strong>{energyMap.bestEnergy.label}</strong>
                  <p>Năng lượng trung bình {energyMap.bestEnergy.energy}/5.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="energy-map-empty">
            <span aria-hidden="true">⚡</span>
            <div>
              <strong>Chưa đủ dữ liệu chỉ số phụ</strong>
              <p>Ghi thêm stress, năng lượng và tập trung trong vài check-in để MindBuddy vẽ nhịp trong ngày.</p>
            </div>
            <Link to="/mood" className="btn btn-primary">Ghi cảm xúc</Link>
          </div>
        )}
      </section>

      <section className="dashboard-focus-grid secondary-dashboard-grid">
        <div className="card mood-chart-card">
          <h3 className="mb-3">Biểu đồ cảm xúc 7 ngày</h3>
          {moodLogs.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={last7}>
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 5]} hide />
                <Tooltip formatter={(v, name, props) => {
                  if (!props.payload.hasData) return ['Chưa có dữ liệu', ''];
                  const m = props.payload.mood || allMoods.find(m => m.score === v);
                  return [m ? `${m.emoji} ${m.label}` : v, 'Cảm xúc'];
                }} />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#6c63ff"
                  strokeWidth={2.5}
                  dot={(props) => {
                    const { cx, cy, payload } = props;
                    if (!payload.hasData) return null;
                    return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={4} fill="#6c63ff" />;
                  }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state rich-empty">
              <div className="empty-icon" aria-hidden="true">💭</div>
              <h4>Chưa có dữ liệu cảm xúc</h4>
              <p>Ghi cảm xúc đầu tiên để biểu đồ bắt đầu có ý nghĩa.</p>
              <Link to="/mood" className="btn btn-primary">Ghi cảm xúc đầu tiên</Link>
            </div>
          )}
        </div>

        <div className="card goal-widget">
          <div className="section-heading-row">
            <div>
              <h3>Mục tiêu cá nhân</h3>
              <p className="text-muted">MindBuddy sẽ ưu tiên insight và lời khuyên theo mục tiêu này.</p>
            </div>
          </div>
          <div className="goal-options">
            {GOALS.map(goal => (
              <button
                key={goal.id}
                className={`goal-option ${userGoal === goal.id ? 'active' : ''}`}
                onClick={() => setUserGoal(goal.id)}
                aria-pressed={userGoal === goal.id}
              >
                <strong>{goal.label}</strong>
                <span>{goal.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="card">
        <h3 className="mb-3">Huy hiệu của bạn</h3>
        <div className="badges-grid">
          {BADGES.map(b => (
            <div key={b.id} className={`badge-item ${earnedBadges.includes(b.id) ? 'earned' : 'locked'}`}>
              <span className="badge-icon">{earnedBadges.includes(b.id) ? b.icon : '🔒'}</span>
              <span className="badge-name">{b.name}</span>
              <span className="badge-desc">{b.desc}</span>
            </div>
          ))}
        </div>
      </div>

      <WeeklyInsight />
      <NotificationSettings />

      {selectedDayDetail && (
        <div className="dashboard-modal-overlay" onClick={e => e.target === e.currentTarget && setSelectedDayDetail(null)}>
          <div className="dashboard-day-modal">
            <div className="dashboard-modal-header">
              <h3>Chi tiết {format(new Date(selectedDayDetail.dayKey), 'EEEE, dd/MM/yyyy', { locale: vi })}</h3>
              <button onClick={() => setSelectedDayDetail(null)} aria-label="Đóng chi tiết ngày">×</button>
            </div>
            <div className="dashboard-day-list">
              {selectedDayDetail.logs.map(log => {
                const mood = allMoods.find(m => m.id === log.mood);
                const cleanNote = log.note?.replace(/\s*\[.+\]$/, '') || '';
                const causeTags = log.note?.match(/\[(.+)\]/)?.[1]?.split(', ') || [];
                const attachments = normalizeMoodAttachments(log);
                return (
                  <div key={log.id} className="dashboard-day-entry" style={{ '--entry-color': mood?.color || '#ccc' }}>
                    <div className="dashboard-day-entry-head">
                      <span>{mood?.emoji} {mood?.label || 'Không rõ'}</span>
                      <strong>{format(new Date(log.date), 'HH:mm')}</strong>
                    </div>
                    {causeTags.length > 0 && (
                      <div className="dashboard-day-causes">
                        {causeTags.map(tag => <span key={tag}>{tag}</span>)}
                      </div>
                    )}
                    <MediaAttachments
                      attachments={attachments}
                      label={`Tệp check-in lúc ${format(new Date(log.date), 'HH:mm')}`}
                      compact
                    />
                    <RichText text={cleanNote} fallback="Không có ghi chú thêm." className="dashboard-note-text" />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {selectedMemory && (
        <div className="dashboard-modal-overlay" onClick={e => e.target === e.currentTarget && setSelectedMemory(null)}>
          <div className="dashboard-day-modal memory-detail-modal">
            <div className="dashboard-modal-header">
              <h3>{format(new Date(selectedMemory.date), 'EEEE, dd/MM/yyyy', { locale: vi })}</h3>
              <button onClick={() => setSelectedMemory(null)} aria-label="Đóng ảnh ký ức">×</button>
            </div>
            <div className="memory-detail-body">
              <MediaAttachments
                attachments={selectedMemory.attachments?.length ? selectedMemory.attachments : [selectedMemory.attachment]}
                label={`Tệp check-in lúc ${format(new Date(selectedMemory.date), 'HH:mm')}`}
              />
              <div className="memory-detail-note" style={{ '--entry-color': selectedMemory.mood?.color || '#a29bfe' }}>
                <div className="dashboard-day-entry-head">
                  <span>{selectedMemory.mood?.emoji} {selectedMemory.mood?.label || 'Không rõ'}</span>
                  <strong>{format(new Date(selectedMemory.date), 'HH:mm')}</strong>
                </div>
                {selectedMemory.causeTags.length > 0 && (
                  <div className="dashboard-day-causes">
                    {selectedMemory.causeTags.map(tag => <span key={tag}>{tag}</span>)}
                  </div>
                )}
                <RichText text={selectedMemory.cleanNote} fallback="Không có ghi chú thêm." className="dashboard-note-text" />
                <Link to="/mood?tab=history" className="quick-link" onClick={() => setSelectedMemory(null)}>Xem trong lịch sử</Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
