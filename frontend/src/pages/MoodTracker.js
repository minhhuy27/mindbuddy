import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { format, isToday, isYesterday, subDays } from 'date-fns';
import { vi } from 'date-fns/locale';
import { analyzeMood, createChat, detectDanger, summarizeDay } from '../utils/aiService';
import { exportMoodPDF, exportAllMoodPDF } from '../utils/exportPDF';
import CrisisPanel from '../components/CrisisPanel';
import './MoodTracker.css';

const CAUSES = ['Học tập', 'Thi cử', 'Tài chính', 'Bạn bè', 'Gia đình', 'Sức khỏe', 'Tình yêu', 'Khác'];

// Bảng emoji gợi ý cho custom mood
const EMOJI_SUGGESTIONS = [
  '😤','😡','🤬','😠','😒','🙄','😑','😶',
  '😩','😫','🥱','😴','🤒','🤕','🥴','😵',
  '🤯','😱','😨','😰','😥','😓','🤧','😷',
  '🥺','😢','😭','😞','😟','😕','🙁','☹️',
  '😌','😏','🤔','🤗','🥰','😍','🤩','😎',
  '🥳','😋','😜','🤪','😝','🤑','🤠','👻',
  '💪','🔥','⚡','🌊','🌈','✨','💫','🎯',
];

const SCORE_OPTIONS = [
  { value: 5, label: 'Rất tích cực', color: '#55efc4' },
  { value: 4, label: 'Tích cực',     color: '#74b9ff' },
  { value: 3, label: 'Trung tính',   color: '#fdcb6e' },
  { value: 2, label: 'Tiêu cực',     color: '#fd79a8' },
  { value: 1, label: 'Rất tiêu cực', color: '#e17055' },
];

const COLOR_PRESETS = [
  '#55efc4','#74b9ff','#a29bfe','#fdcb6e','#fd79a8',
  '#e17055','#00cec9','#6c5ce7','#e84393','#f9ca24',
  '#f0932b','#6ab04c','#eb4d4b','#7ed6df','#c7ecee',
];

function groupByDay(logs) {
  const map = {};
  [...logs]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .forEach(log => {
      const key = new Date(log.date).toDateString();
      if (!map[key]) map[key] = [];
      map[key].push(log);
    });
  return Object.entries(map);
}

function dayLabel(dateStr) {
  const d = new Date(dateStr);
  if (isToday(d)) return 'Hôm nay';
  if (isYesterday(d)) return 'Hôm qua';
  return format(d, 'EEEE, dd/MM/yyyy', { locale: vi });
}

// ── Modal tạo / chỉnh sửa custom mood ──
function CustomMoodModal({ onClose, onSave }) {
  const [emoji, setEmoji] = useState('😤');
  const [label, setLabel] = useState('');
  const [score, setScore] = useState(2);
  const [color, setColor] = useState('#fd79a8');
  const [customEmoji, setCustomEmoji] = useState('');
  const [error, setError] = useState('');

  const activeEmoji = customEmoji || emoji;
  const activeColor = SCORE_OPTIONS.find(s => s.value === score)?.color || color;

  const handleSave = () => {
    if (!label.trim()) { setError('Vui lòng đặt tên cho cảm xúc.'); return; }
    if (!activeEmoji) { setError('Vui lòng chọn emoji.'); return; }
    onSave({ emoji: activeEmoji, label: label.trim(), color: activeColor, score });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <h3>✨ Thêm cảm xúc mới</h3>
          <button className="modal-close" onClick={onClose} aria-label="Đóng hộp thoại thêm cảm xúc">✕</button>
        </div>

        {/* Preview */}
        <div className="mood-preview" style={{ '--mood-color': activeColor }}>
          <span className="preview-emoji">{activeEmoji}</span>
          <span className="preview-label">{label || 'Tên cảm xúc'}</span>
        </div>

        {/* Emoji picker */}
        <div className="modal-section">
          <label className="modal-label">Chọn emoji</label>
          <div className="emoji-grid">
            {EMOJI_SUGGESTIONS.map(e => (
              <button
                key={e}
                className={`emoji-btn ${emoji === e && !customEmoji ? 'active' : ''}`}
                onClick={() => { setEmoji(e); setCustomEmoji(''); }}
              >{e}</button>
            ))}
          </div>
          <div className="custom-emoji-row">
            <input
              value={customEmoji}
              onChange={e => setCustomEmoji(e.target.value)}
              placeholder="Hoặc nhập emoji bất kỳ..."
              maxLength={4}
              style={{ width: 180 }}
            />
            {customEmoji && (
              <button className="btn btn-secondary" style={{ padding: '6px 12px' }}
                onClick={() => setCustomEmoji('')}>Xóa</button>
            )}
          </div>
        </div>

        {/* Tên cảm xúc */}
        <div className="modal-section">
          <label className="modal-label">Tên cảm xúc <span style={{ color: 'var(--danger)' }}>*</span></label>
          <input
            value={label}
            onChange={e => { setLabel(e.target.value); setError(''); }}
            placeholder="Ví dụ: Tức giận, Mệt mỏi, Hào hứng..."
            maxLength={20}
          />
          <span className="char-count">{label.length}/20</span>
        </div>

        {/* Mức độ cảm xúc */}
        <div className="modal-section">
          <label className="modal-label">Mức độ cảm xúc</label>
          <div className="score-options">
            {SCORE_OPTIONS.map(s => (
              <button
                key={s.value}
                className={`score-btn ${score === s.value ? 'active' : ''}`}
                style={{ '--score-color': s.color }}
                onClick={() => setScore(s.value)}
              >
                <span className="score-dot" />
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="modal-error">{error}</p>}

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Hủy</button>
          <button className="btn btn-primary" onClick={handleSave}>Thêm cảm xúc</button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ──
export default function MoodTracker() {
  const {
    MOODS, customMoods, moodLogs,
    addMoodLog, updateMoodLog, deleteMoodLog,
    addCustomMood, deleteCustomMood,
    user, todayAI, saveTodayAI, aiMemory, saveAiMemory, userGoal,
  } = useApp();

  // Tất cả moods = built-in + custom
  const allMoods = [...MOODS, ...(customMoods || [])];

  // ── Form state ──
  const [selected, setSelected] = useState(null);
  const [note, setNote] = useState('');
  const [causes, setCauses] = useState([]);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [checkinFeedback, setCheckinFeedback] = useState('');

  // ── Custom mood modal ──
  const [showModal, setShowModal] = useState(false);

  // ── AI state ──
  const todayAIData = todayAI?.date === new Date().toDateString() ? todayAI : null;
  const [aiAdvice, setAiAdvice] = useState(todayAIData?.advice || '');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [lastAnalysisRequest, setLastAnalysisRequest] = useState(null);
  const [chatMessages, setChatMessages] = useState(todayAIData?.chatMessages || []);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [chatError, setChatError] = useState('');
  const [failedChatMessage, setFailedChatMessage] = useState('');
  const [showSOS, setShowSOS] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const chatFnRef = React.useRef(null);
  const chatEndRef = React.useRef(null);

  // ── Export state ──
  const now = new Date();
  const [exportMonth, setExportMonth] = useState(now.getMonth());
  const [exportYear, setExportYear] = useState(now.getFullYear());
  const [exporting, setExporting] = useState(false); // 'month' | 'all' | false
  const [historyRange, setHistoryRange] = useState(14);
  const [selectedDayDetail, setSelectedDayDetail] = useState(null);

  React.useEffect(() => {
    if (todayAIData?.advice && todayAIData?.moodLabel) {
      chatFnRef.current = createChat(
        todayAIData.advice,
        todayAIData.moodLabel,
        todayAIData.chatMessages || [],
        aiMemory || [],
        userGoal
      );
      setAiAdvice(todayAIData.advice);
      setChatMessages(todayAIData.chatMessages || []);
    }
  }, [todayAI, userGoal]);

  // Tự động tóm tắt ngày hôm qua nếu chưa có trong memory
  React.useEffect(() => {
    const autoSummarizeYesterday = async () => {
      const yesterday = subDays(new Date(), 1);
      const yesterdayStr = yesterday.toDateString();
      const yesterdayLabel = format(yesterday, 'dd/MM/yyyy');

      // Kiểm tra đã có trong memory chưa
      const alreadySaved = (aiMemory || []).some(e => e.date === yesterdayLabel);
      if (alreadySaved) return;

      // Lấy logs của hôm qua
      const yesterdayLogs = moodLogs.filter(
        l => new Date(l.date).toDateString() === yesterdayStr
      );
      if (yesterdayLogs.length === 0) return;

      // Build entries để gửi lên summarize
      const entries = yesterdayLogs.map(l => {
        const mood = allMoods.find(m => m.id === l.mood);
        const causesInNote = l.note?.match(/\[(.+)\]/)?.[1]?.split(', ') || [];
        const cleanNote = l.note?.replace(/\s*\[.+\]$/, '') || '';
        return {
          moodLabel: mood?.label || 'Không rõ',
          note: cleanNote,
          causes: causesInNote,
        };
      });

      const moods = entries.map(e => e.moodLabel);
      const summary = await summarizeDay({ date: yesterdayLabel, entries });

      if (summary) {
        saveAiMemory({ date: yesterdayLabel, summary, moods });
      } else {
        // Fallback: lưu không có summary text
        saveAiMemory({ date: yesterdayLabel, summary: '', moods });
      }
    };

    if (moodLogs.length > 0) {
      autoSummarizeYesterday();
    }
  }, [moodLogs.length]); // eslint-disable-line

  const toggleCause = (c) => setCauses(prev =>
    prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
  );

  const resetForm = () => {
    setSelected(null);
    setNote('');
    setCauses([]);
    setEditingId(null);
  };

  const startEdit = (log) => {
    const causesInNote = log.note?.match(/\[(.+)\]/)?.[1]?.split(', ') || [];
    const cleanNote = log.note?.replace(/\s*\[.+\]$/, '') || '';
    setSelected(log.mood);
    setNote(cleanNote);
    setCauses(causesInNote);
    setEditingId(log.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const runMoodAnalysis = async (request) => {
    setAiLoading(true);
    setAiError('');
    setLastAnalysisRequest(request);
    try {
      const advice = await analyzeMood({
        moodLabel: request.moodLabel,
        note: request.note,
        causes: request.causes,
        recentMoods: request.recentMoods,
        aiMemory: request.aiMemory,
        userGoal: request.userGoal,
      });

      if (!advice) {
        setAiError('MindBuddy AI chưa phản hồi được. Bạn có thể thử lại mà không cần ghi cảm xúc lại.');
        return;
      }

      setAiAdvice(advice);
      setChatMessages([]);
      setChatOpen(true);
      setChatError('');
      setFailedChatMessage('');
      chatFnRef.current = createChat(advice, request.moodLabel, [], request.aiMemory || [], request.userGoal);
      saveTodayAI({ advice, moodLabel: request.moodLabel, chatMessages: [] });

      const todayLabel = format(new Date(), 'dd/MM/yyyy');
      const todayLogs = [...moodLogs, {
        mood: request.moodId,
        note: request.fullNote,
        date: new Date().toISOString(),
      }].filter(l => new Date(l.date).toDateString() === new Date().toDateString());
      const entries = todayLogs.map(l => {
        const m = allMoods.find(x => x.id === l.mood);
        const causesInNote = l.note?.match(/\[(.+)\]/)?.[1]?.split(', ') || [];
        const cleanNote = l.note?.replace(/\s*\[.+\]$/, '') || '';
        return { moodLabel: m?.label || 'Không rõ', note: cleanNote, causes: causesInNote };
      });
      summarizeDay({ date: todayLabel, entries }).then(summary => {
        if (summary !== null) {
          saveAiMemory({
            date: todayLabel,
            summary: summary || '',
            moods: entries.map(e => e.moodLabel),
          });
        }
      });
    } catch (err) {
      console.error('AI error:', err);
      setAiError('MindBuddy AI phản hồi quá lâu hoặc đang lỗi. Vui lòng thử lại sau.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selected || saving) return;
    setSaving(true);
    const mood = allMoods.find(m => m.id === selected);
    const fullNote = note + (causes.length ? ` [${causes.join(', ')}]` : '');
    if (detectDanger(fullNote)) setShowSOS(true);

    if (editingId) {
      await updateMoodLog(editingId, selected, fullNote);
      setCheckinFeedback('Đã cập nhật ghi chú cảm xúc.');
      resetForm();
    } else {
      await addMoodLog(selected, fullNote);
      setCheckinFeedback('Đã lưu cảm xúc. Vườn, streak và huy hiệu của bạn đang được cập nhật.');
      resetForm();
    }
    window.setTimeout(() => setCheckinFeedback(''), 3200);

    setSaving(false);

    const recentMoods = moodLogs.slice(0, 7)
      .map(l => allMoods.find(m => m.id === l.mood))
      .filter(Boolean);
    await runMoodAnalysis({
      moodId: selected,
      moodLabel: mood.label,
      note,
      causes,
      fullNote,
      recentMoods,
      aiMemory: aiMemory || [],
      userGoal,
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Xóa ghi chú này?')) return;
    await deleteMoodLog(id);
    if (editingId === id) resetForm();
  };

  const handleDeleteCustomMood = async (moodId, e) => {
    e.stopPropagation();
    if (selected === moodId) setSelected(null);
    await deleteCustomMood(moodId);
  };

  const sendChat = async (retryMessage) => {
    const userMsg = (retryMessage || chatInput).trim();
    if (!userMsg || !chatFnRef.current || chatSending) return;
    if (!retryMessage) setChatInput('');
    setChatError('');
    setFailedChatMessage('');
    if (detectDanger(userMsg)) setShowSOS(true);
    const baseMessages = retryMessage
      ? chatMessages.filter((m, index) => !(index === chatMessages.length - 1 && m.role === 'user' && m.text === retryMessage))
      : chatMessages;
    const next = [...baseMessages, { role: 'user', text: userMsg }];
    setChatMessages(next);
    saveTodayAI({ advice: aiAdvice, moodLabel: todayAI?.moodLabel || '', chatMessages: next });
    setChatSending(true);
    try {
      const reply = await chatFnRef.current(userMsg);
      if (detectDanger(reply)) setShowSOS(true);
      const next2 = [...next, { role: 'ai', text: reply }];
      setChatMessages(next2);
      saveTodayAI({ advice: aiAdvice, moodLabel: todayAI?.moodLabel || '', chatMessages: next2 });
    } catch {
      setFailedChatMessage(userMsg);
      setChatError('MindBuddy AI phản hồi quá lâu hoặc đang lỗi. Tin nhắn của bạn chưa được gửi lại cho AI.');
    } finally {
      setChatSending(false);
    }
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const handleExport = async () => {
    if (exporting) return;
    setExporting('month');
    try {
      await exportMoodPDF({
        userName: user?.displayName || user?.email || 'Người dùng',
        moodLogs,
        month: exportMonth,
        year: exportYear,
        allMoods,
      });
    } finally {
      setExporting(false);
    }
  };

  const handleExportAll = async () => {
    if (exporting) return;
    setExporting('all');
    try {
      await exportAllMoodPDF({
        userName: user?.displayName || user?.email || 'Người dùng',
        moodLogs,
        allMoods,
      });
    } finally {
      setExporting(false);
    }
  };

  const filteredMoodLogs = (() => {
    const cutoff = subDays(new Date(), historyRange - 1);
    cutoff.setHours(0, 0, 0, 0);
    return moodLogs.filter(l => new Date(l.date) >= cutoff);
  })();

  // Chart: log mới nhất mỗi ngày
  const chartData = (() => {
    const sorted = [...filteredMoodLogs].sort((a, b) => new Date(b.date) - new Date(a.date));
    const seen = new Set();
    const unique = [];
    sorted.forEach(l => {
      const key = new Date(l.date).toDateString();
      if (!seen.has(key)) { seen.add(key); unique.push(l); }
    });
    return unique.slice(0, historyRange).reverse().map(l => ({
      date: format(new Date(l.date), 'dd/MM', { locale: vi }),
      score: allMoods.find(m => m.id === l.mood)?.score ?? 0,
      color: allMoods.find(m => m.id === l.mood)?.color || '#ccc',
    }));
  })();

  const monthHeatmap = (() => {
    const monthLogs = moodLogs
      .filter(log => {
        const d = new Date(log.date);
        return d.getMonth() === exportMonth && d.getFullYear() === exportYear;
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    const logsByDay = monthLogs.reduce((acc, log) => {
      const key = new Date(log.date).toDateString();
      if (!acc[key]) acc[key] = [];
      acc[key].push(log);
      return acc;
    }, {});

    const first = new Date(exportYear, exportMonth, 1);
    const daysInMonth = new Date(exportYear, exportMonth + 1, 0).getDate();
    const blanks = Array.from({ length: first.getDay() }, (_, index) => index);
    const days = Array.from({ length: daysInMonth }, (_, index) => {
      const date = new Date(exportYear, exportMonth, index + 1);
      const key = date.toDateString();
      const logs = logsByDay[key] || [];
      const latest = logs[0];
      const mood = latest ? allMoods.find(m => m.id === latest.mood) : null;
      return { key, day: index + 1, logs, mood };
    });

    return { blanks, days };
  })();

  const grouped = groupByDay(filteredMoodLogs);
  const visibleGroups = grouped;

  return (
    <div className="mood-tracker">
      <h2 className="mb-4">💭 Theo dõi cảm xúc</h2>

      <div className="tracker-layout">
        {/* ── CỘT TRÁI: Form ── */}
        <div className="tracker-form-col">
          <div className="card checkin-card">
            <h3 className="mb-1">
              {editingId ? '✏️ Chỉnh sửa ghi chú' : '+ Ghi cảm xúc mới'}
            </h3>
            <p className="text-muted mb-4" style={{ fontSize: 13 }}>
              {format(new Date(), 'EEEE, dd/MM/yyyy – HH:mm', { locale: vi })}
            </p>

            {/* Built-in moods */}
            <label className="form-label">Cảm xúc có sẵn</label>
            <div className="mood-options">
              {MOODS.map(m => (
                <button key={m.id}
                  className={`mood-btn ${selected === m.id ? 'selected' : ''}`}
                  style={{ '--mood-color': m.color }}
                  aria-pressed={selected === m.id}
                  aria-label={`Chọn cảm xúc ${m.label}`}
                  onClick={() => setSelected(m.id)}>
                  <span className="mood-emoji">{m.emoji}</span>
                  <span className="mood-label">{m.label}</span>
                </button>
              ))}
            </div>

            {/* Custom moods */}
            <div className="custom-moods-section mt-3">
              <div className="custom-moods-header">
                <label className="form-label" style={{ margin: 0 }}>Cảm xúc của tôi</label>
                <button
                  className="btn-add-mood"
                  onClick={() => setShowModal(true)}
                  title="Thêm cảm xúc mới"
                  aria-label="Thêm cảm xúc mới"
                >
                  + Thêm
                </button>
              </div>

              {(!customMoods || customMoods.length === 0) ? (
                <p className="custom-moods-empty">
                  Chưa có cảm xúc tùy chỉnh.{' '}
                  <button className="link-btn" onClick={() => setShowModal(true)}>
                    Thêm ngay →
                  </button>
                </p>
              ) : (
                <div className="mood-options mt-2">
                  {customMoods.map(m => (
                    <div key={m.id} className="mood-btn-wrapper">
                      <button
                        className={`mood-btn ${selected === m.id ? 'selected' : ''}`}
                        style={{ '--mood-color': m.color }}
                        aria-pressed={selected === m.id}
                        aria-label={`Chọn cảm xúc tùy chỉnh ${m.label}`}
                        onClick={() => setSelected(m.id)}>
                        <span className="mood-emoji">{m.emoji}</span>
                        <span className="mood-label">{m.label}</span>
                      </button>
                      <button
                        className="mood-btn-delete"
                        onClick={(e) => handleDeleteCustomMood(m.id, e)}
                        title="Xóa cảm xúc này"
                        aria-label={`Xóa cảm xúc ${m.label}`}
                      >✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selected && (
              <>
                <div className="mt-4">
                  <label className="form-label">Nguyên nhân (tùy chọn)</label>
                  <div className="causes-grid">
                    {CAUSES.map(c => (
                      <button key={c}
                        className={`cause-btn ${causes.includes(c) ? 'active' : ''}`}
                        aria-pressed={causes.includes(c)}
                        aria-label={`Chọn nguyên nhân ${c}`}
                        onClick={() => toggleCause(c)}>{c}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-3">
                  <label className="form-label">Ghi chú thêm</label>
                  <textarea
                    value={note}
                    onChange={e => {
                      setNote(e.target.value);
                      if (detectDanger(e.target.value)) setShowSOS(true);
                    }}
                    placeholder="Hôm nay có chuyện gì xảy ra..."
                    rows={4}
                  />
                </div>
                <button
                  className="btn btn-primary mt-4 w-full"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving
                    ? <span className="btn-loading">⏳ Đang lưu...</span>
                    : editingId ? '💾 Cập nhật ghi chú' : '✨ Lưu cảm xúc'
                  }
                </button>
                {editingId && (
                  <button className="btn btn-secondary mt-2 w-full" onClick={resetForm}>
                    Hủy chỉnh sửa
                  </button>
                )}
              </>
            )}
          </div>
          {checkinFeedback && (
            <div className="checkin-feedback" role="status">
              <span aria-hidden="true">✨</span>
              <span>{checkinFeedback}</span>
            </div>
          )}
          {showSOS && <CrisisPanel onDismiss={() => setShowSOS(false)} />}

          {/* AI Advice & Chat */}
          {(aiLoading || aiAdvice || aiError) && (
            <div className="card mt-4">
              {aiLoading && (
                <div className="ai-loading ai-status">
                  <span className="ai-status-title">AI đang phân tích cảm xúc của bạn</span>
                  <span className="ai-status-detail">Thường mất vài chục giây. Bạn có thể tiếp tục xem nhật ký trong lúc chờ.</span>
                </div>
              )}
              {aiError && !aiLoading && (
                <div className="ai-error">
                  <div>
                    <strong>Chưa lấy được lời khuyên AI</strong>
                    <p>{aiError}</p>
                  </div>
                  {lastAnalysisRequest && (
                    <button className="btn btn-secondary" onClick={() => runMoodAnalysis(lastAnalysisRequest)}>
                      Thử lại
                    </button>
                  )}
                </div>
              )}
              {aiAdvice && !aiLoading && (
                <>
                  <div className="ai-advice">
                    <div className="ai-advice-header">
                      <span>✨ Lời khuyên từ AI</span>
                      {aiMemory && aiMemory.length > 0 && (
                        <span className="memory-badge" title={`AI nhớ ${aiMemory.length} ngày gần đây`}>
                          🧠 Nhớ {aiMemory.length} ngày
                        </span>
                      )}
                    </div>
                    <p>{aiAdvice}</p>
                  </div>
                  <div className="ai-chat mt-3">
                    <div className="ai-chat-header">
                      <span>💬 Trò chuyện với MindBuddy AI</span>
                      <div className="chat-header-actions">
                        {chatMessages.length > 0 && (
                          <button className="chat-action-btn" onClick={() => {
                            setChatMessages([]);
                            setChatError('');
                            setFailedChatMessage('');
                            chatFnRef.current = createChat(aiAdvice, todayAI?.moodLabel || '', [], aiMemory || [], userGoal);
                            saveTodayAI({ advice: aiAdvice, moodLabel: todayAI?.moodLabel || '', chatMessages: [] });
                          }}>🔄 Mới</button>
                        )}
                        <button className="chat-action-btn" onClick={() => {
                          if (!chatFnRef.current)
                            chatFnRef.current = createChat(aiAdvice, todayAI?.moodLabel || '', chatMessages, aiMemory || [], userGoal);
                          setChatOpen(o => !o);
                        }}>
                          {chatOpen ? '▲' : '▼'}
                        </button>
                      </div>
                    </div>
                    {chatOpen && (
                      <>
                        <div className="chat-messages">
                          {chatMessages.map((m, i) => (
                            <div key={i} className={`chat-bubble ${m.role}`}>
                              <span className="chat-avatar">{m.role === 'ai' ? '🤖' : '👤'}</span>
                              <span className="chat-text">{m.text}</span>
                            </div>
                          ))}
                          {chatSending && (
                            <div className="chat-bubble ai">
                              <span className="chat-avatar">🤖</span>
                              <span className="chat-text typing">Đang trả lời, vui lòng đợi trong giây lát...</span>
                            </div>
                          )}
                          <div ref={chatEndRef} />
                        </div>
                        {chatError && (
                          <div className="chat-error">
                            <span>{chatError}</span>
                            {failedChatMessage && (
                              <button className="chat-retry-btn" onClick={() => sendChat(failedChatMessage)}>
                                Thử lại
                              </button>
                            )}
                          </div>
                        )}
                        <div className="chat-input-row">
                          <input
                            value={chatInput}
                            onChange={e => setChatInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && sendChat()}
                            placeholder="Nhắn tin với AI..."
                            disabled={chatSending}
                          />
                          <button className="btn btn-primary" onClick={() => sendChat()}
                            disabled={chatSending || !chatInput.trim()}>Gửi</button>
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── CỘT PHẢI: Timeline ── */}
        <div className="tracker-timeline-col">
          <div className="history-toolbar card mb-4">
            <div>
              <h3>Lịch sử cảm xúc</h3>
              <p className="text-muted">Xem nhanh theo khoảng thời gian và mở từng ngày để xem chi tiết.</p>
            </div>
            <div className="history-filters" role="tablist" aria-label="Lọc lịch sử cảm xúc">
              {[7, 14, 30].map(days => (
                <button
                  key={days}
                  className={`history-filter-btn ${historyRange === days ? 'active' : ''}`}
                  onClick={() => setHistoryRange(days)}
                >
                  {days} ngày
                </button>
              ))}
            </div>
          </div>

          <div className="card mood-calendar-card mb-4">
            <div className="mood-calendar-header">
              <div>
                <h3>🗓️ Mood calendar</h3>
                <p className="text-muted">Màu mỗi ngày lấy theo check-in mới nhất, có kèm nhãn cảm xúc.</p>
              </div>
              <span>Tháng {exportMonth + 1}/{exportYear}</span>
            </div>
            <div className="mood-calendar-weekdays" aria-hidden="true">
              {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map(day => <span key={day}>{day}</span>)}
            </div>
            <div className="mood-calendar-grid">
              {monthHeatmap.blanks.map(blank => (
                <span key={`blank-${blank}`} className="mood-calendar-blank" />
              ))}
              {monthHeatmap.days.map(day => (
                <button
                  key={day.key}
                  className={`mood-calendar-day ${day.logs.length ? 'has-mood' : ''}`}
                  style={{ '--day-color': day.mood?.color || 'var(--border)' }}
                  disabled={!day.logs.length}
                  onClick={() => setSelectedDayDetail({ dayKey: day.key, logs: day.logs })}
                  aria-label={day.logs.length
                    ? `${day.day}/${exportMonth + 1}: ${day.mood?.label}, ${day.logs.length} ghi chú`
                    : `${day.day}/${exportMonth + 1}: chưa có ghi chú`}
                >
                  <span className="mood-calendar-number">{day.day}</span>
                  {day.mood ? (
                    <>
                      <span className="mood-calendar-emoji" aria-hidden="true">{day.mood.emoji}</span>
                      <small>{day.mood.label}</small>
                    </>
                  ) : (
                    <small>Trống</small>
                  )}
                </button>
              ))}
            </div>
          </div>

          {chartData.length > 0 ? (
            <div className="card mb-4">
              <h3 className="mb-3">📊 Biểu đồ cảm xúc {historyRange} ngày</h3>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={chartData} barSize={20}>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 5]} hide />
                  <Tooltip formatter={(v) => {
                    const m = allMoods.find(m => m.score === v);
                    return [m ? `${m.emoji} ${m.label}` : v, 'Cảm xúc'];
                  }} />
                  <Bar dataKey="score" radius={[6, 6, 0, 0]}>
                    {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="card mb-4">
              <div className="empty-timeline chart-empty">
                <div style={{ fontSize: 36 }} aria-hidden="true">📊</div>
                <p>Chưa có biểu đồ cho {historyRange} ngày gần đây.</p>
                <Link to="/mood" className="btn btn-primary">Ghi cảm xúc đầu tiên</Link>
              </div>
            </div>
          )}

          <div className="card">
            <div className="flex justify-between items-center mb-3">
              <h3>📝 Nhật ký cảm xúc</h3>
              <div className="export-row">
                <select value={exportMonth} onChange={e => setExportMonth(+e.target.value)}
                  style={{ width: 'auto', padding: '6px 10px' }}>
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i} value={i}>Tháng {i + 1}</option>
                  ))}
                </select>
                <select value={exportYear} onChange={e => setExportYear(+e.target.value)}
                  style={{ width: 'auto', padding: '6px 10px' }}>
                  {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <button
                  className="btn btn-primary"
                  onClick={handleExport}
                  disabled={!!exporting}
                  style={{ whiteSpace: 'nowrap' }}
                  title="Xuất PDF tháng đã chọn"
                >
                  {exporting === 'month' ? '⏳' : '📄'} Xuất tháng
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={handleExportAll}
                  disabled={!!exporting || moodLogs.length === 0}
                  style={{ whiteSpace: 'nowrap' }}
                  title="Xuất toàn bộ nhật ký"
                >
                  {exporting === 'all' ? '⏳ Đang xuất...' : '📦 Xuất tất cả'}
                </button>
              </div>
            </div>

            {moodLogs.length === 0 ? (
              <div className="empty-timeline">
                <div style={{ fontSize: 40 }} aria-hidden="true">📭</div>
                <p>Chưa có ghi chú nào.</p>
                <p className="text-muted">Hãy ghi lại cảm xúc đầu tiên của bạn!</p>
                <Link to="/mood" className="btn btn-primary mt-2">Ghi cảm xúc đầu tiên</Link>
              </div>
            ) : (
              <>
                {grouped.length > 0 && (
                  <div className="history-calendar">
                    {grouped.map(([dayKey, logs]) => {
                      const latestLog = logs[0];
                      const mood = allMoods.find(m => m.id === latestLog.mood);
                      return (
                        <button
                          key={dayKey}
                          className="history-day-chip"
                          style={{ '--day-color': mood?.color || '#ccc' }}
                          onClick={() => setSelectedDayDetail({ dayKey, logs })}
                          title={`Xem chi tiết ${dayLabel(dayKey)}`}
                        >
                          <span className="history-day-date">{format(new Date(dayKey), 'dd/MM')}</span>
                          <span className="history-day-dot" />
                          <span className="history-day-count">{logs.length}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="timeline">
                  {visibleGroups.map(([dayKey, logs]) => (
                    <div key={dayKey} className="timeline-day">
                      <div className="timeline-day-header">
                        <button className="timeline-day-label day-detail-link" onClick={() => setSelectedDayDetail({ dayKey, logs })}>
                          {dayLabel(dayKey)}
                        </button>
                        <button className="timeline-day-count" onClick={() => setSelectedDayDetail({ dayKey, logs })}>
                          {logs.length} ghi chú
                        </button>
                      </div>
                      <div className="timeline-entries">
                        {logs.map(log => {
                          const mood = allMoods.find(m => m.id === log.mood);
                          const cleanNote = log.note?.replace(/\s*\[.+\]$/, '') || '';
                          const causeTags = log.note?.match(/\[(.+)\]/)?.[1]?.split(', ') || [];
                          return (
                            <div key={log.id}
                              className={`timeline-entry ${editingId === log.id ? 'editing' : ''}`}
                              style={{ '--entry-color': mood?.color || '#ccc' }}>
                              <div className="entry-time-col">
                                <span className="entry-time">
                                  {format(new Date(log.date), 'HH:mm')}
                                </span>
                                <div className="entry-dot" />
                              </div>
                              <div className="entry-body">
                                <div className="entry-header">
                                  <span className="entry-emoji">{mood?.emoji}</span>
                                  <span className="entry-mood" style={{ color: mood?.color }}>
                                    {mood?.label}
                                  </span>
                                  {mood?.id?.toString().startsWith('custom_') && (
                                    <span className="custom-badge">tùy chỉnh</span>
                                  )}
                                  <div className="entry-actions">
                                    <button className="entry-btn edit"
                                      onClick={() => startEdit(log)} title="Chỉnh sửa" aria-label={`Chỉnh sửa ghi chú lúc ${format(new Date(log.date), 'HH:mm')}`}>✏️</button>
                                    <button className="entry-btn delete"
                                      onClick={() => handleDelete(log.id)} title="Xóa" aria-label={`Xóa ghi chú lúc ${format(new Date(log.date), 'HH:mm')}`}>🗑️</button>
                                  </div>
                                </div>
                                {causeTags.length > 0 && (
                                  <div className="entry-causes">
                                    {causeTags.map(t => (
                                      <span key={t} className="entry-cause-tag">{t}</span>
                                    ))}
                                  </div>
                                )}
                                {cleanNote && <p className="entry-note">{cleanNote}</p>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                {grouped.length === 0 && (
                  <div className="empty-timeline">
                    <p>Không có ghi chú trong {historyRange} ngày gần đây.</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {selectedDayDetail && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSelectedDayDetail(null)}>
          <div className="modal-box day-detail-modal">
            <div className="modal-header">
              <h3>Chi tiết {dayLabel(selectedDayDetail.dayKey)}</h3>
              <button className="modal-close" onClick={() => setSelectedDayDetail(null)} aria-label="Đóng chi tiết ngày">✕</button>
            </div>
            <div className="day-detail-list">
              {selectedDayDetail.logs.map(log => {
                const mood = allMoods.find(m => m.id === log.mood);
                const cleanNote = log.note?.replace(/\s*\[.+\]$/, '') || '';
                const causeTags = log.note?.match(/\[(.+)\]/)?.[1]?.split(', ') || [];
                return (
                  <div key={log.id} className="day-detail-entry" style={{ '--entry-color': mood?.color || '#ccc' }}>
                    <div className="day-detail-entry-head">
                      <span className="day-detail-mood">{mood?.emoji} {mood?.label}</span>
                      <span className="day-detail-time">{format(new Date(log.date), 'HH:mm')}</span>
                    </div>
                    {causeTags.length > 0 && (
                      <div className="entry-causes">
                        {causeTags.map(t => <span key={t} className="entry-cause-tag">{t}</span>)}
                      </div>
                    )}
                    {cleanNote ? <p className="entry-note">{cleanNote}</p> : <p className="entry-note">Không có ghi chú thêm.</p>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal thêm custom mood */}
      {showModal && (
        <CustomMoodModal
          onClose={() => setShowModal(false)}
          onSave={addCustomMood}
        />
      )}
    </div>
  );
}
