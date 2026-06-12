import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { format, isToday, isYesterday, subDays } from 'date-fns';
import { vi } from 'date-fns/locale';
import { analyzeMood, createChat, detectDanger, summarizeDay } from '../utils/aiService';
import { exportMoodPDF as exportMoodPDFBase, exportAllMoodPDF as exportAllMoodPDFBase } from '../utils/exportPDF';
import { uploadMoodFiles } from '../utils/imageUpload';
import { displayAttachmentName, normalizeMoodAttachments } from '../utils/moodImages';
import { causeTagStyle, causeTagTitle } from '../utils/causeTags';
import CrisisPanel from '../components/CrisisPanel';
import RichText from '../components/RichText';
import MediaAttachments from '../components/MediaAttachments';
import './MoodTracker.css';

const VISUAL_CAUSES = ['Học tập', 'Gia đình', 'Sức khỏe', 'Thời tiết', 'Tài chính', 'Quan hệ', 'Riêng tư'];
const DEFAULT_CAUSES = [...VISUAL_CAUSES, 'Thi cử', 'Bạn bè', 'Tình yêu', 'Khác'];
const CAUSE_TAG_SCHEMA_VERSION = 'v2-color-tags';

const METRIC_FIELDS = [
  { id: 'stress', label: 'Stress', low: 'Rất nhẹ', high: 'Rất căng', invert: true },
  { id: 'energy', label: 'Năng lượng', low: 'Cạn pin', high: 'Đầy năng lượng' },
  { id: 'sleep', label: 'Giấc ngủ', low: 'Rất kém', high: 'Rất tốt' },
  { id: 'focus', label: 'Tập trung', low: 'Rất khó', high: 'Rất rõ' },
];

const DEFAULT_METRICS = {
  stress: 3,
  energy: 3,
  sleep: 3,
  focus: 3,
};

const VALID_TABS = ['today', 'history', 'insight', 'export'];
const AUDIO_RECORDING_LIMIT = 10 * 60;
const HISTORY_RANGE_OPTIONS = [
  { value: 7, label: '7 ngày' },
  { value: 14, label: '14 ngày' },
  { value: 30, label: '30 ngày' },
  { value: 'all', label: 'Tất cả' },
];

function historyRangeLabel(range) {
  return range === 'all' ? 'toàn bộ' : `${range} ngày`;
}

function normalizeTab(tab) {
  return VALID_TABS.includes(tab) ? tab : 'today';
}

function normalizeMetrics(metrics) {
  return METRIC_FIELDS.reduce((acc, field) => {
    const value = Number(metrics?.[field.id]);
    acc[field.id] = Number.isFinite(value) ? Math.min(5, Math.max(1, value)) : DEFAULT_METRICS[field.id];
    return acc;
  }, {});
}

function getBestAudioMimeType() {
  if (typeof window === 'undefined' || !window.MediaRecorder?.isTypeSupported) return '';
  return [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/mpeg',
  ].find(type => window.MediaRecorder.isTypeSupported(type)) || '';
}

function getAudioExtension(type = '') {
  if (type.includes('mp4')) return 'm4a';
  if (type.includes('mpeg')) return 'mp3';
  return 'webm';
}

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

function metricSummary(metrics) {
  if (!metrics) return '';
  const normalized = normalizeMetrics(metrics);
  return METRIC_FIELDS.map(field => `${field.label}: ${normalized[field.id]}/5`).join(', ');
}

const logAttachments = normalizeMoodAttachments;

function extractLogCauses(note = '') {
  return note.match(/\[(.+)\]$/)?.[1]?.split(', ').filter(Boolean) || [];
}

function cleanLogNote(note = '') {
  return String(note).replace(/\s*\[.+\]$/, '').trim();
}

function metricValue(metrics, id) {
  const value = Number(metrics?.[id]);
  return Number.isFinite(value) ? Math.min(5, Math.max(1, value)) : null;
}

function normalizeSearchText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

function attachmentSearchText(attachment) {
  const kindLabels = {
    image: 'anh hinh anh photo image',
    video: 'video clip',
    audio: 'audio am thanh ghi am voice',
    file: 'tep file dinh kem',
  };
  return [
    attachment?.name,
    attachment?.kind,
    kindLabels[attachment?.kind] || '',
  ].filter(Boolean).join(' ');
}

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

const JOURNAL_ICON_GROUPS = [
  {
    label: 'Mặt cười',
    icons: ['😀', '😃', '😄', '😁', '😊', '🙂', '😉', '😍', '🥰', '😘', '😋', '😎', '🤩', '🥳', '😇', '🤗'],
  },
  {
    label: 'Tâm trạng',
    icons: ['😌', '🥲', '😐', '😶', '🙃', '😔', '😞', '😢', '😭', '🥺', '😤', '😡', '😰', '😱', '🤯', '😴'],
  },
  {
    label: 'Cử chỉ',
    icons: ['👍', '👎', '👌', '✌️', '🤞', '👏', '🙌', '🙏', '💪', '🫶', '🤝', '👀', '💅', '🤌', '🤙', '🫰'],
  },
  {
    label: 'Trái tim',
    icons: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🩷', '🤍', '🖤', '💕', '💞', '💓', '💗', '💖', '💘', '💝'],
  },
  {
    label: 'Học tập',
    icons: ['📚', '📖', '📝', '✏️', '📌', '📎', '💡', '🎯', '⏳', '✅', '📅', '🧠', '💻', '🖥️', '🔬', '🏆'],
  },
  {
    label: 'Nghỉ ngơi',
    icons: ['🌿', '🍃', '☕', '🧋', '🍵', '🛏️', '🎧', '🎵', '🧘', '🚶', '🏃', '🌙', '⭐', '✨', '🌈', '🕯️'],
  },
  {
    label: 'Đồ ăn',
    icons: ['🍚', '🍜', '🍲', '🍱', '🥗', '🍞', '🥐', '🍔', '🍟', '🍕', '🍰', '🍫', '🍎', '🍓', '🥤', '🍽️'],
  },
  {
    label: 'Hoạt động',
    icons: ['🏠', '🏫', '🏥', '🚌', '🏍️', '🚗', '🌧️', '☀️', '🌤️', '🎉', '🎁', '🎮', '📱', '💬', '👥', '🆘'],
  },
  {
    label: 'Biểu tượng',
    icons: ['🔥', '⚡', '💫', '🌊', '💭', '💤', '💦', '💥', '💯', '❗', '❓', '🔔', '🔒', '🔑', '🚩', '🧩'],
  },
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

const FORMAT_TOOLS = [
  { id: 'bold', label: 'B', title: 'Bôi đậm', prefix: '**', suffix: '**', sample: 'nội dung quan trọng' },
  { id: 'underline', label: 'U', title: 'Gạch chân', prefix: '<u>', suffix: '</u>', sample: 'điều cần nhớ' },
  { id: 'heading', label: 'H', title: 'Tiêu đề', linePrefix: '## ', sample: 'Tiêu đề nhỏ' },
  { id: 'checklist', label: '☑', title: 'Checklist', linePrefix: '- [ ] ', sample: 'việc nhỏ cần làm' },
  { id: 'quote', label: '❝', title: 'Trích dẫn', linePrefix: '> ', sample: 'một câu mình muốn giữ lại' },
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
    addMoodLog, updateMoodLog, deleteMoodLog, toggleMoodLogPinned,
    addCustomMood, deleteCustomMood,
    user, todayAI, saveTodayAI, aiMemory, saveAiMemory, userGoal, currentGoal,
    causeOptions, saveCauseOptions,
  } = useApp();

  // Tất cả moods = built-in + custom
  const allMoods = [...MOODS, ...(customMoods || [])];

  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => normalizeTab(searchParams.get('tab')));
  const selectTab = React.useCallback((tab) => {
    const next = normalizeTab(tab);
    setActiveTab(next);
    setSearchParams(next === 'today' ? {} : { tab: next }, { replace: true });
  }, [setSearchParams]);
  const todayDraftKey = React.useMemo(() => {
    const uid = user?.uid || user?.email || 'guest';
    return `mb_mood_draft_${uid}_${format(new Date(), 'yyyy-MM-dd')}`;
  }, [user?.uid, user?.email]);

  // ── Form state ──
  const [selected, setSelected] = useState(null);
  const [note, setNote] = useState('');
  const [causes, setCauses] = useState([]);
  const [metrics, setMetrics] = useState(DEFAULT_METRICS);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [checkinFeedback, setCheckinFeedback] = useState('');
  const [draftStatus, setDraftStatus] = useState('');
  const [draftReady, setDraftReady] = useState(false);
  const [showNoteIcons, setShowNoteIcons] = useState(false);
  const [causeEditorOpen, setCauseEditorOpen] = useState(false);
  const [newCause, setNewCause] = useState('');
  const [editingCause, setEditingCause] = useState('');
  const [editingCauseValue, setEditingCauseValue] = useState('');
  const [causeError, setCauseError] = useState('');
  const [excludeFromAI, setExcludeFromAI] = useState(false);
  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [removeExistingImage, setRemoveExistingImage] = useState(false);
  const [imageError, setImageError] = useState('');
  const [mediaDropActive, setMediaDropActive] = useState(false);
  const [photoLightbox, setPhotoLightbox] = useState(null);
  const [recordingState, setRecordingState] = useState('idle');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const noteTextareaRef = React.useRef(null);
  const imageInputRef = React.useRef(null);
  const imagePreviewsRef = React.useRef([]);
  const mediaRecorderRef = React.useRef(null);
  const recordingStreamRef = React.useRef(null);
  const recordingChunksRef = React.useRef([]);
  const recordingTimerRef = React.useRef(null);
  const mediaDropDepthRef = React.useRef(0);

  // ── Custom mood modal ──
  const [showModal, setShowModal] = useState(false);

  // ── AI state ──
  const todayAIData = todayAI?.date === new Date().toDateString() ? todayAI : null;
  const [aiAdvice, setAiAdvice] = useState(todayAIData?.advice || '');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [lastAnalysisRequest, setLastAnalysisRequest] = useState(null);
  const [aiPreview, setAiPreview] = useState(null);
  const [aiPreviewStatus, setAiPreviewStatus] = useState('');
  const [chatMessages, setChatMessages] = useState(todayAIData?.chatMessages || []);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [chatError, setChatError] = useState('');
  const [failedChatMessage, setFailedChatMessage] = useState('');
  const [showSOS, setShowSOS] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const chatFnRef = React.useRef(null);
  const chatEndRef = React.useRef(null);

  React.useEffect(() => {
    setActiveTab(normalizeTab(searchParams.get('tab')));
  }, [searchParams]);

  // ── Export state ──
  const now = new Date();
  const [exportMonth, setExportMonth] = useState(now.getMonth());
  const [exportYear, setExportYear] = useState(now.getFullYear());
  const [exportOptions, setExportOptions] = useState({
    privacy: 'all',
    range: 'selected',
    detail: 'full',
    includeImages: true,
  });
  const [exporting, setExporting] = useState(false); // 'month' | 'all' | false
  const exportMoodPDF = React.useCallback((payload) => (
    exportMoodPDFBase({ ...payload, options: exportOptions })
  ), [exportOptions]);
  const exportAllMoodPDF = React.useCallback((payload) => (
    exportAllMoodPDFBase({ ...payload, options: exportOptions })
  ), [exportOptions]);
  const [historyRange, setHistoryRange] = useState(14);
  const [historyFilters, setHistoryFilters] = useState({
    search: '',
    mood: 'all',
    cause: 'all',
    media: 'all',
    stressHigh: false,
    sleepLow: false,
    from: '',
    to: '',
  });
  const [selectedDayDetail, setSelectedDayDetail] = useState(null);
  const activeCauses = React.useMemo(() => (
    Array.isArray(causeOptions) ? causeOptions : DEFAULT_CAUSES
  ), [causeOptions]);

  React.useEffect(() => {
    if (!user || !Array.isArray(causeOptions)) return;
    const userKey = user.uid || user.email || 'guest';
    const storageKey = `mb_cause_tags_seeded_${CAUSE_TAG_SCHEMA_VERSION}_${userKey}`;

    try {
      if (localStorage.getItem(storageKey) === '1') return;
    } catch (error) {
      void error;
      return;
    }

    const normalized = causeOptions.map(c => String(c || '').trim()).filter(Boolean);
    const normalizedLower = new Set(normalized.map(c => c.toLowerCase()));
    const missing = VISUAL_CAUSES.filter(c => !normalizedLower.has(c.toLowerCase()));

    if (!missing.length) {
      try { localStorage.setItem(storageKey, '1'); } catch (error) { void error; }
      return;
    }

    saveCauseOptions([...normalized, ...missing])
      .then(() => {
        try { localStorage.setItem(storageKey, '1'); } catch (error) { void error; }
      })
      .catch(error => { void error; });
  }, [causeOptions, saveCauseOptions, user]);

  const viewedMonth = new Date(exportYear, exportMonth, 1);
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const isCurrentMonthSelected = viewedMonth.getTime() === currentMonth.getTime();
  const isAtOrAfterCurrentMonth = viewedMonth.getTime() >= currentMonth.getTime();
  const hasMetricDraft = Object.keys(DEFAULT_METRICS).some(key => metrics[key] !== DEFAULT_METRICS[key]);
  const hasImageDraft = imageFiles.length > 0;
  const hasDraftContent = !editingId && (!!selected || note.trim().length > 0 || causes.length > 0 || hasMetricDraft || hasImageDraft);

  const moveCalendarMonth = (offset) => {
    const next = new Date(exportYear, exportMonth + offset, 1);
    const capped = next > currentMonth ? currentMonth : next;
    setExportMonth(capped.getMonth());
    setExportYear(capped.getFullYear());
  };

  const resetCalendarMonth = () => {
    setExportMonth(now.getMonth());
    setExportYear(now.getFullYear());
  };

  const updateHistoryFilter = (key, value) => {
    setHistoryFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetHistoryFilters = () => {
    setHistoryFilters({
      search: '',
      mood: 'all',
      cause: 'all',
      media: 'all',
      stressHigh: false,
      sleepLow: false,
      from: '',
      to: '',
    });
  };

  React.useEffect(() => {
    if (todayAIData?.advice && todayAIData?.moodLabel) {
      chatFnRef.current = createChat(
        todayAIData.advice,
        todayAIData.moodLabel,
        todayAIData.chatMessages || [],
        aiMemory || [],
        currentGoal?.label || userGoal
      );
      setAiAdvice(todayAIData.advice);
      setChatMessages(todayAIData.chatMessages || []);
    }
  }, [todayAI, userGoal, currentGoal?.label]);

  React.useEffect(() => {
    setDraftReady(false);
    setDraftStatus('');
    try {
      const raw = localStorage.getItem(todayDraftKey);
      if (raw) {
        const draft = JSON.parse(raw);
        setSelected(draft.selected || null);
        setNote(draft.note || '');
        setCauses(Array.isArray(draft.causes) ? draft.causes : []);
        setMetrics(normalizeMetrics(draft.metrics));
        setExcludeFromAI(!!draft.excludeFromAI);
        setDraftStatus('Đã khôi phục nháp hôm nay.');
      } else {
        setSelected(null);
        setNote('');
        setCauses([]);
        setMetrics(DEFAULT_METRICS);
        setExcludeFromAI(false);
      }
    } catch {
      localStorage.removeItem(todayDraftKey);
    } finally {
      setDraftReady(true);
    }
  }, [todayDraftKey]);

  React.useEffect(() => {
    if (!draftReady || editingId) return undefined;

    const timeout = window.setTimeout(() => {
      if (!selected && !note.trim() && causes.length === 0 && !hasMetricDraft) {
        localStorage.removeItem(todayDraftKey);
        setDraftStatus('');
        return;
      }

      localStorage.setItem(todayDraftKey, JSON.stringify({
        selected,
        note,
        causes,
        metrics,
        excludeFromAI,
        savedAt: Date.now(),
      }));
      setDraftStatus('Đã tự lưu nháp.');
    }, 450);

    return () => window.clearTimeout(timeout);
  }, [selected, note, causes, metrics, excludeFromAI, hasMetricDraft, imageFiles, editingId, draftReady, todayDraftKey]);

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
        l => !l.excludeFromAI && new Date(l.date).toDateString() === yesterdayStr
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
          metrics: l.metrics,
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

  const saveCausesSafely = async (next) => {
    setCauseError('');
    await saveCauseOptions(next);
  };

  const addCauseOption = async () => {
    const value = newCause.trim();
    if (!value) return;
    if (activeCauses.some(c => c.toLowerCase() === value.toLowerCase())) {
      setCauseError('Nguyên nhân này đã có trong danh sách.');
      return;
    }
    await saveCausesSafely([...activeCauses, value]);
    setNewCause('');
  };

  const startEditCause = (cause) => {
    setEditingCause(cause);
    setEditingCauseValue(cause);
    setCauseError('');
  };

  const saveEditedCause = async () => {
    const value = editingCauseValue.trim();
    if (!editingCause || !value) return;
    if (activeCauses.some(c => c !== editingCause && c.toLowerCase() === value.toLowerCase())) {
      setCauseError('Tên nguyên nhân này đã tồn tại.');
      return;
    }
    const next = activeCauses.map(c => c === editingCause ? value : c);
    await saveCausesSafely(next);
    setCauses(prev => prev.map(c => c === editingCause ? value : c));
    setEditingCause('');
    setEditingCauseValue('');
  };

  const deleteCauseOption = async (cause) => {
    const next = activeCauses.filter(c => c !== cause);
    await saveCausesSafely(next);
    setCauses(prev => prev.filter(c => c !== cause));
    if (editingCause === cause) {
      setEditingCause('');
      setEditingCauseValue('');
    }
  };

  const resetCauseOptions = async () => {
    await saveCausesSafely(DEFAULT_CAUSES);
    setCauses(prev => prev.filter(c => DEFAULT_CAUSES.includes(c)));
    setEditingCause('');
    setEditingCauseValue('');
    setNewCause('');
  };

  const updateMetric = (id, value) => {
    setMetrics(prev => ({ ...prev, [id]: Number(value) }));
  };

  const clearRecordingTimer = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const stopRecordingStream = () => {
    recordingStreamRef.current?.getTracks().forEach(track => track.stop());
    recordingStreamRef.current = null;
  };

  const discardActiveRecording = () => {
    clearRecordingTimer();
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null;
      recorder.stop();
    }
    mediaRecorderRef.current = null;
    recordingChunksRef.current = [];
    stopRecordingStream();
    setRecordingState('idle');
    setRecordingSeconds(0);
  };

  const addRecordedAudio = (file) => {
    const preview = {
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
      file,
      url: URL.createObjectURL(file),
    };
    setImageFiles(prev => [...prev, file]);
    setImagePreviews(prev => [...prev, preview]);
    setRemoveExistingImage(false);
  };

  const resetForm = () => {
    discardActiveRecording();
    setSelected(null);
    setNote('');
    setCauses([]);
    setMetrics(DEFAULT_METRICS);
    setExcludeFromAI(false);
    setEditingId(null);
    setShowNoteIcons(false);
    imagePreviews.forEach(item => URL.revokeObjectURL(item.url));
    setImageFiles([]);
    setImagePreviews([]);
    setExistingImages([]);
    setRemoveExistingImage(false);
    setImageError('');
    setMediaDropActive(false);
    mediaDropDepthRef.current = 0;
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  React.useEffect(() => {
    imagePreviewsRef.current = imagePreviews;
  }, [imagePreviews]);

  React.useEffect(() => () => {
    imagePreviewsRef.current.forEach(item => URL.revokeObjectURL(item.url));
    clearRecordingTimer();
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null;
      recorder.stop();
    }
    mediaRecorderRef.current = null;
    recordingChunksRef.current = [];
    stopRecordingStream();
  }, []);

  React.useEffect(() => {
    if (!photoLightbox) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setPhotoLightbox(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [photoLightbox]);

  const handleImageSelect = (event) => {
    const files = Array.from(event.target.files || []);
    setImageError('');
    if (!files.length) return;
    const invalid = files.find(file => !file.type.startsWith('image/') && !file.type.startsWith('video/') && !file.type.startsWith('audio/'));
    if (invalid) {
      setImageError('Chỉ hỗ trợ ảnh, video hoặc tệp âm thanh.');
      return;
    }
    const tooLarge = files.find(file => (
      (file.type.startsWith('image/') && file.size > 8 * 1024 * 1024) ||
      (file.type.startsWith('audio/') && file.size > 25 * 1024 * 1024) ||
      (file.type.startsWith('video/') && file.size > 100 * 1024 * 1024)
    ));
    if (tooLarge) {
      setImageError('Dung lượng tối đa: ảnh 8MB, audio 25MB, video 100MB.');
      return;
    }
    const largeVideo = files.find(file => file.type.startsWith('video/') && file.size > 50 * 1024 * 1024);
    if (largeVideo) {
      setImageError('Video trên 50MB có thể làm đầy Firebase nhanh. MindBuddy sẽ thử nén qua backend, nhưng bạn nên dùng video ngắn nếu có thể.');
    }
    const previews = files.map(file => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
      file,
      url: URL.createObjectURL(file),
    }));
    setImageFiles(prev => [...prev, ...files]);
    setImagePreviews(prev => [...prev, ...previews]);
    setRemoveExistingImage(false);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const extractMediaFiles = (source) => {
    const itemFiles = Array.from(source?.items || [])
      .filter(item => item.kind === 'file')
      .map(item => item.getAsFile())
      .filter(Boolean);
    const directFiles = Array.from(source?.files || []);
    return [...itemFiles, ...directFiles].filter((file, index, files) => (
      files.findIndex(item => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified) === index
    ));
  };

  const hasMediaItems = (source) => (
    Array.from(source?.items || []).some(item => item.kind === 'file') ||
    Array.from(source?.files || []).length > 0
  );

  const addMediaFilesFromExternalSource = (files) => {
    if (recordingState !== 'idle') {
      setImageError('Vui lòng dừng ghi âm trước khi thêm tệp khác.');
      return;
    }
    handleImageSelect({ target: { files } });
  };

  const handleMediaDragEnter = (event) => {
    if (!hasMediaItems(event.dataTransfer)) return;
    event.preventDefault();
    mediaDropDepthRef.current += 1;
    setMediaDropActive(true);
  };

  const handleMediaDragOver = (event) => {
    if (!hasMediaItems(event.dataTransfer)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = recordingState === 'idle' ? 'copy' : 'none';
    setMediaDropActive(true);
  };

  const handleMediaDragLeave = (event) => {
    event.preventDefault();
    mediaDropDepthRef.current = Math.max(0, mediaDropDepthRef.current - 1);
    if (mediaDropDepthRef.current === 0) setMediaDropActive(false);
  };

  const handleMediaDrop = (event) => {
    if (!hasMediaItems(event.dataTransfer)) return;
    event.preventDefault();
    mediaDropDepthRef.current = 0;
    setMediaDropActive(false);
    addMediaFilesFromExternalSource(extractMediaFiles(event.dataTransfer));
  };

  const handleMediaPaste = (event) => {
    const files = extractMediaFiles(event.clipboardData);
    if (!files.length) return;
    event.preventDefault();
    addMediaFilesFromExternalSource(files);
  };

  const removeSelectedImage = (index) => {
    setImagePreviews(prev => {
      const target = prev[index];
      if (target?.url) URL.revokeObjectURL(target.url);
      return prev.filter((_, i) => i !== index);
    });
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setImageError('');
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const startAudioRecording = async () => {
    setImageError('');
    if (recordingState !== 'idle') return;
    if (!navigator.mediaDevices?.getUserMedia || typeof window === 'undefined' || !window.MediaRecorder) {
      setImageError('Trình duyệt này chưa hỗ trợ ghi âm trực tiếp. Bạn có thể chọn tệp audio có sẵn.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getBestAudioMimeType();
      const recorder = new window.MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recordingStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      recordingChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) recordingChunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        clearRecordingTimer();
        const finalType = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(recordingChunksRef.current, { type: finalType });
        recordingChunksRef.current = [];
        mediaRecorderRef.current = null;
        stopRecordingStream();
        setRecordingState('idle');
        setRecordingSeconds(0);

        if (!blob.size) {
          setImageError('Bản ghi âm quá ngắn hoặc micro chưa cấp dữ liệu.');
          return;
        }
        if (blob.size > 25 * 1024 * 1024) {
          setImageError('File ghi âm vượt 25MB. Hãy thử ghi ngắn hơn hoặc chọn tệp đã nén.');
          return;
        }

        const extension = getAudioExtension(finalType);
        const file = new File([blob], `mindbuddy-ghi-am-${format(new Date(), 'yyyyMMdd-HHmmss')}.${extension}`, {
          type: finalType,
          lastModified: Date.now(),
        });
        addRecordedAudio(file);
      };

      recorder.onerror = () => {
        clearRecordingTimer();
        recordingChunksRef.current = [];
        mediaRecorderRef.current = null;
        stopRecordingStream();
        setRecordingState('idle');
        setRecordingSeconds(0);
        setImageError('Không thể ghi âm. Hãy kiểm tra quyền micro của trình duyệt.');
      };

      recorder.start(1000);
      setRecordingState('recording');
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(prev => {
          const next = prev + 1;
          if (next >= AUDIO_RECORDING_LIMIT) {
            window.setTimeout(() => stopAudioRecording(), 0);
          }
          return next;
        });
      }, 1000);
    } catch (error) {
      console.error('Audio recording error:', error);
      clearRecordingTimer();
      recordingChunksRef.current = [];
      mediaRecorderRef.current = null;
      stopRecordingStream();
      setRecordingState('idle');
      setRecordingSeconds(0);
      setImageError('Không truy cập được micro. Hãy cho phép quyền micro rồi thử lại.');
    }
  };

  function stopAudioRecording() {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      discardActiveRecording();
      return;
    }
    setRecordingState('stopping');
    recorder.stop();
  }

  const removeExistingImageAt = (index) => {
    setExistingImages(prev => prev.filter((_, i) => i !== index));
    setRemoveExistingImage(true);
  };

  const openPhotoLightbox = (image, label) => {
    if (!image?.url) return;
    setPhotoLightbox({
      url: image.url,
      name: displayAttachmentName(image),
      label: label || 'Ảnh check-in',
    });
  };

  const clearDraft = () => {
    localStorage.removeItem(todayDraftKey);
    resetForm();
    setDraftStatus('Đã xóa nháp.');
    window.setTimeout(() => setDraftStatus(''), 1800);
  };

  const insertNoteIcon = (icon) => {
    const textarea = noteTextareaRef.current;
    if (!textarea) {
      setNote(prev => `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}${icon} `);
      return;
    }

    const start = textarea.selectionStart ?? note.length;
    const end = textarea.selectionEnd ?? note.length;
    const before = note.slice(0, start);
    const after = note.slice(end);
    const spacingBefore = before && !/\s$/.test(before) ? ' ' : '';
    const insertText = `${spacingBefore}${icon} `;
    const nextNote = `${before}${insertText}${after}`;

    setNote(nextNote);
    window.setTimeout(() => {
      textarea.focus();
      const nextPosition = start + insertText.length;
      textarea.setSelectionRange(nextPosition, nextPosition);
    }, 0);
  };

  const applyNoteFormat = (tool) => {
    const textarea = noteTextareaRef.current;
    const currentNote = note || '';
    const start = textarea?.selectionStart ?? currentNote.length;
    const end = textarea?.selectionEnd ?? currentNote.length;
    const selectedText = currentNote.slice(start, end);
    let insertText = '';
    let nextCursorStart = start;
    let nextCursorEnd = start;

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

    const nextNote = `${currentNote.slice(0, start)}${insertText}${currentNote.slice(end)}`;
    setNote(nextNote);
    window.setTimeout(() => {
      textarea?.focus();
      textarea?.setSelectionRange(nextCursorStart, nextCursorEnd);
    }, 0);
  };

  const startEdit = (log) => {
    const causesInNote = log.note?.match(/\[(.+)\]/)?.[1]?.split(', ') || [];
    const cleanNote = log.note?.replace(/\s*\[.+\]$/, '') || '';
    setSelected(log.mood);
    setNote(cleanNote);
    setCauses(causesInNote);
    setMetrics(normalizeMetrics(log.metrics));
    setExcludeFromAI(!!log.excludeFromAI);
    setExistingImages(logAttachments(log));
    imagePreviews.forEach(item => URL.revokeObjectURL(item.url));
    setImageFiles([]);
    setImagePreviews([]);
    setRemoveExistingImage(false);
    setImageError('');
    if (imageInputRef.current) imageInputRef.current.value = '';
    setEditingId(log.id);
    selectTab('today');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const runMoodAnalysis = async (request) => {
    setAiLoading(true);
    setAiError('');
    setAiPreview(null);
    setAiPreviewStatus('');
    setAiAdvice('');
    setChatMessages([]);
    chatFnRef.current = null;
    setLastAnalysisRequest(request);
    try {
      const advice = await analyzeMood({
        moodLabel: request.moodLabel,
        note: request.note,
        causes: request.causes,
        metrics: request.metrics,
        recentMoods: request.recentMoods,
        aiMemory: request.aiMemory,
        userGoal: request.userGoal,
      });

      if (!advice) {
        setAiError('MindBuddy AI chưa phản hồi được. Bạn có thể thử lại mà không cần ghi cảm xúc lại.');
        return;
      }

      setAiPreview({ advice, request });
      setAiPreviewStatus('AI đã tạo bản phân tích nháp. Bạn có thể lưu, ẩn hoặc tạo lại trước khi đưa vào Insight.');
      setChatOpen(false);
    } catch (err) {
      console.error('AI error:', err);
      setAiError('MindBuddy AI phản hồi quá lâu hoặc đang lỗi. Vui lòng thử lại sau.');
    } finally {
      setAiLoading(false);
    }
  };

  const saveAnalysisPreview = async () => {
    if (!aiPreview?.advice || !aiPreview?.request) return;
    const { advice, request } = aiPreview;
    setAiAdvice(advice);
    setChatMessages([]);
    setChatOpen(true);
    setChatError('');
    setFailedChatMessage('');
    chatFnRef.current = createChat(advice, request.moodLabel, [], request.aiMemory || [], request.userGoal);
    saveTodayAI({ advice, moodLabel: request.moodLabel, chatMessages: [] });
    setAiPreview(null);
    setAiPreviewStatus('Đã lưu phân tích AI vào Insight hôm nay.');
    window.setTimeout(() => setAiPreviewStatus(''), 2600);

    const todayLabel = format(new Date(), 'dd/MM/yyyy');
    const todayLogs = moodLogs
      .filter(l => !l.excludeFromAI && new Date(l.date).toDateString() === new Date().toDateString());
    const hasRequestLog = todayLogs.some(l => l.mood === request.moodId && l.note === request.fullNote);
    const logsForMemory = hasRequestLog
      ? todayLogs
      : [...todayLogs, {
        mood: request.moodId,
        note: request.fullNote,
        metrics: request.metrics,
        date: new Date().toISOString(),
      }];
    const entries = logsForMemory.map(l => {
      const m = allMoods.find(x => x.id === l.mood);
      const causesInNote = l.note?.match(/\[(.+)\]/)?.[1]?.split(', ') || [];
      const cleanNote = l.note?.replace(/\s*\[.+\]$/, '') || '';
      return { moodLabel: m?.label || 'Không rõ', note: cleanNote, causes: causesInNote, metrics: l.metrics };
    });
    const summary = await summarizeDay({ date: todayLabel, entries });
    if (summary !== null) {
      saveAiMemory({
        date: todayLabel,
        summary: summary || '',
        moods: entries.map(e => e.moodLabel),
      });
    }
  };

  const hideAnalysisPreview = () => {
    setAiPreview(null);
    setAiPreviewStatus('Đã ẩn phân tích AI. Check-in vẫn được giữ trong nhật ký.');
    window.setTimeout(() => setAiPreviewStatus(''), 2600);
  };

  const regenerateAnalysisPreview = () => {
    const request = aiPreview?.request || lastAnalysisRequest;
    if (request) runMoodAnalysis(request);
  };

  const handleSave = async () => {
    if (!selected || saving) return;
    if (recordingState !== 'idle') {
      setImageError('Hãy dừng ghi âm trước khi lưu check-in.');
      return;
    }
    setSaving(true);
    setSaveStatus('');
    setImageError('');
    const moodId = selected;
    const rawNote = note;
    const selectedCauses = causes;
    const mood = allMoods.find(m => m.id === moodId);
    const fullNote = rawNote + (selectedCauses.length ? ` [${selectedCauses.join(', ')}]` : '');
    if (detectDanger(fullNote)) setShowSOS(true);
    const currentMetrics = normalizeMetrics(metrics);

    try {
      let imagePayload;
      if (imageFiles.length > 0) {
        const uploadedImages = await uploadMoodFiles({
          files: imageFiles,
          user,
          onStatus: setSaveStatus,
        });
        imagePayload = editingId ? [...existingImages, ...uploadedImages] : uploadedImages;
      } else if (editingId && removeExistingImage) {
        imagePayload = existingImages.length ? existingImages : null;
      }

      setSaveStatus('Đang lưu check-in...');

      if (editingId) {
        await updateMoodLog(editingId, moodId, fullNote, currentMetrics, imagePayload, { excludeFromAI });
        setCheckinFeedback('Đã cập nhật ghi chú cảm xúc.');
        resetForm();
      } else {
        await addMoodLog(moodId, fullNote, currentMetrics, imagePayload || null, { excludeFromAI });
        setCheckinFeedback(imagePayload?.length
          ? 'Đã lưu cảm xúc cùng ảnh check-in.'
          : 'Đã lưu cảm xúc. Vườn, streak và huy hiệu của bạn đang được cập nhật.');
        resetForm();
      }
      window.setTimeout(() => setCheckinFeedback(''), 3200);
      setSaving(false);
      setSaveStatus('');
      if (excludeFromAI) {
        setCheckinFeedback('Đã lưu ghi chú riêng tư. MindBuddy sẽ không gửi dòng này cho AI.');
        window.setTimeout(() => setCheckinFeedback(''), 3600);
        return;
      }
      selectTab('insight');

      const recentMoods = moodLogs.filter(l => !l.excludeFromAI).slice(0, 7)
        .map(l => allMoods.find(m => m.id === l.mood))
        .filter(Boolean);
      await runMoodAnalysis({
        moodId,
        moodLabel: mood.label,
        note: rawNote,
        causes: selectedCauses,
        metrics: currentMetrics,
        fullNote,
        recentMoods,
        aiMemory: aiMemory || [],
        userGoal: currentGoal?.label || userGoal,
      });
    } catch (err) {
      console.error('Save mood image/check-in error:', err);
      setImageError(err.message || 'Không thể lưu ảnh check-in. Vui lòng thử lại.');
      setSaving(false);
      setSaveStatus('');
    }
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

  const availableHistoryCauses = React.useMemo(() => {
    const fromLogs = moodLogs.flatMap(log => extractLogCauses(log.note || ''));
    return Array.from(new Set([...activeCauses, ...fromLogs])).filter(Boolean);
  }, [activeCauses, moodLogs]);

  const hasAdvancedHistoryFilters = (
    !!historyFilters.search.trim() ||
    historyFilters.mood !== 'all' ||
    historyFilters.cause !== 'all' ||
    historyFilters.media !== 'all' ||
    historyFilters.stressHigh ||
    historyFilters.sleepLow ||
    !!historyFilters.from ||
    !!historyFilters.to
  );

  const matchesHistoryFilters = (log) => {
    const logDate = new Date(log.date);
    const attachments = logAttachments(log);
    const logCauses = extractLogCauses(log.note || '');
    const mood = allMoods.find(item => item.id === log.mood);
    const searchQuery = normalizeSearchText(historyFilters.search);

    if (searchQuery) {
      const dateLabels = [
        format(logDate, 'dd/MM/yyyy'),
        format(logDate, 'dd/MM'),
        format(logDate, 'yyyy-MM-dd'),
        format(logDate, 'EEEE dd/MM/yyyy', { locale: vi }),
        format(logDate, 'HH:mm dd/MM/yyyy'),
      ];
      const haystack = normalizeSearchText([
        log.note,
        cleanLogNote(log.note || ''),
        mood?.label,
        mood?.emoji,
        ...logCauses,
        ...dateLabels,
        ...attachments.map(attachmentSearchText),
      ].filter(Boolean).join(' '));
      if (!haystack.includes(searchQuery)) return false;
    }

    if (historyFilters.from) {
      const fromDate = new Date(`${historyFilters.from}T00:00:00`);
      if (logDate < fromDate) return false;
    }
    if (historyFilters.to) {
      const toDate = new Date(`${historyFilters.to}T23:59:59`);
      if (logDate > toDate) return false;
    }
    if (historyFilters.mood !== 'all' && String(log.mood) !== historyFilters.mood) return false;

    if (historyFilters.cause !== 'all' && !logCauses.includes(historyFilters.cause)) return false;

    if (historyFilters.media === 'any' && attachments.length === 0) return false;
    if (historyFilters.media === 'none' && attachments.length > 0) return false;
    if (['image', 'video', 'audio'].includes(historyFilters.media) && !attachments.some(item => item.kind === historyFilters.media)) {
      return false;
    }

    if (historyFilters.stressHigh && (metricValue(log.metrics, 'stress') ?? 0) < 4) return false;
    if (historyFilters.sleepLow && (metricValue(log.metrics, 'sleep') ?? 5) > 2) return false;
    return true;
  };

  const historyFilteredAllLogs = moodLogs.filter(matchesHistoryFilters);

  const filteredMoodLogs = (() => {
    if (historyRange === 'all') return historyFilteredAllLogs;
    const cutoff = subDays(new Date(), historyRange - 1);
    cutoff.setHours(0, 0, 0, 0);
    return historyFilteredAllLogs.filter(l => new Date(l.date) >= cutoff);
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
    const chartLogs = historyRange === 'all' ? unique : unique.slice(0, historyRange);
    return chartLogs.reverse().map(l => ({
      date: format(new Date(l.date), 'dd/MM', { locale: vi }),
      score: allMoods.find(m => m.id === l.mood)?.score ?? 0,
      color: allMoods.find(m => m.id === l.mood)?.color || '#ccc',
    }));
  })();

  const monthHeatmap = (() => {
    const monthLogs = historyFilteredAllLogs
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
  const todaysLogs = moodLogs.filter(l => new Date(l.date).toDateString() === new Date().toDateString());
  const moodTabs = [
    { id: 'today', label: 'Ghi hôm nay', count: todaysLogs.length },
    { id: 'history', label: 'Lịch sử', count: moodLogs.length },
    { id: 'insight', label: 'Insight', count: (aiAdvice || aiLoading || aiError) ? 1 : 0 },
    { id: 'export', label: 'Xuất dữ liệu', count: 0 },
  ];

  return (
    <div className="mood-tracker">
      <div className="mood-page-header">
        <div>
          <h2>💭 Theo dõi cảm xúc</h2>
          <p className="text-muted">Ghi nhanh hôm nay, xem lại lịch sử, trò chuyện với AI và xuất nhật ký khi cần.</p>
        </div>
      </div>

      <div className="mood-tabs" role="tablist" aria-label="Các phần trong trang theo dõi cảm xúc">
        {moodTabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`mood-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => selectTab(tab.id)}
          >
            <span>{tab.label}</span>
            {tab.count > 0 && <small>{tab.count}</small>}
          </button>
        ))}
      </div>

      <div className="tracker-layout tracker-tabbed-layout">
        {activeTab === 'today' && (
        <div className="tracker-form-col tracker-tab-panel">
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
                  <div className="cause-heading-row">
                    <label className="form-label">Nguyên nhân (tùy chọn)</label>
                    <button
                      type="button"
                      className={`cause-manage-toggle ${causeEditorOpen ? 'active' : ''}`}
                      onClick={() => setCauseEditorOpen(open => !open)}
                    >
                      Tùy chỉnh
                    </button>
                  </div>
                  <div className="causes-grid">
                    {activeCauses.map(c => (
                      <div key={c} className="cause-chip-wrap">
                        <button
                          type="button"
                          className={`cause-btn ${causes.includes(c) ? 'active' : ''}`}
                          style={causeTagStyle(c)}
                          title={causeTagTitle(c)}
                          aria-pressed={causes.includes(c)}
                          aria-label={`Chọn nguyên nhân ${c}`}
                          onClick={() => toggleCause(c)}
                        >
                          {c}
                        </button>
                        {causeEditorOpen && (
                          <div className="cause-chip-actions">
                            <button type="button" onClick={() => startEditCause(c)} aria-label={`Sửa nguyên nhân ${c}`}>✎</button>
                            <button type="button" onClick={() => deleteCauseOption(c)} aria-label={`Xóa nguyên nhân ${c}`}>×</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {causeEditorOpen && (
                    <div className="cause-editor-panel">
                      <div className="cause-editor-row">
                        <input
                          value={newCause}
                          onChange={e => {
                            setNewCause(e.target.value);
                            setCauseError('');
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addCauseOption();
                            }
                          }}
                          placeholder="Thêm nguyên nhân mới..."
                          maxLength={28}
                        />
                        <button type="button" className="btn btn-secondary" onClick={addCauseOption}>Thêm</button>
                      </div>
                      {editingCause && (
                        <div className="cause-editor-row">
                          <input
                            value={editingCauseValue}
                            onChange={e => {
                              setEditingCauseValue(e.target.value);
                              setCauseError('');
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                saveEditedCause();
                              }
                              if (e.key === 'Escape') {
                                setEditingCause('');
                                setEditingCauseValue('');
                              }
                            }}
                            maxLength={28}
                            aria-label={`Sửa nguyên nhân ${editingCause}`}
                          />
                          <button type="button" className="btn btn-primary" onClick={saveEditedCause}>Lưu</button>
                          <button type="button" className="btn btn-secondary" onClick={() => { setEditingCause(''); setEditingCauseValue(''); }}>Hủy</button>
                        </div>
                      )}
                      <div className="cause-editor-footer">
                        <span>{activeCauses.length} nguyên nhân</span>
                        <button type="button" onClick={resetCauseOptions}>Đặt lại mặc định</button>
                      </div>
                      {causeError && <p className="cause-error" role="alert">{causeError}</p>}
                    </div>
                  )}
                </div>
                <div className="mt-4">
                  <div className="metrics-heading">
                    <label className="form-label">Chỉ số nhanh</label>
                    <span>1 thấp • 5 cao</span>
                  </div>
                  <div className="metrics-grid">
                    {METRIC_FIELDS.map(field => (
                      <div key={field.id} className="metric-slider">
                        <div className="metric-slider-head">
                          <strong>{field.label}</strong>
                          <span>{metrics[field.id]}/5</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="5"
                          step="1"
                          value={metrics[field.id]}
                          onChange={e => updateMetric(field.id, e.target.value)}
                          aria-label={`${field.label} ${metrics[field.id]} trên 5`}
                        />
                        <div className="metric-slider-scale">
                          <small>{field.low}</small>
                          <small>{field.high}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-3" onPaste={handleMediaPaste}>
                  <div className="note-label-row">
                    <label className="form-label" htmlFor="mood-note-input">Ghi chú thêm</label>
                    <button
                      type="button"
                      className={`note-icon-toggle ${showNoteIcons ? 'active' : ''}`}
                      onClick={() => setShowNoteIcons(v => !v)}
                      aria-expanded={showNoteIcons}
                      aria-controls="journal-icon-picker"
                    >
                      ✨ Chèn icon
                    </button>
                  </div>
                  {showNoteIcons && (
                    <div className="journal-icon-picker" id="journal-icon-picker">
                      {JOURNAL_ICON_GROUPS.map(group => (
                        <div className="journal-icon-group" key={group.label}>
                          <span>{group.label}</span>
                          <div className="journal-icon-row">
                            {group.icons.map(icon => (
                              <button
                                key={`${group.label}-${icon}`}
                                type="button"
                                className="journal-icon-btn"
                                onClick={() => insertNoteIcon(icon)}
                                aria-label={`Chèn icon ${icon} vào ghi chú`}
                              >
                                {icon}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="note-format-toolbar" aria-label="Định dạng ghi chú">
                    {FORMAT_TOOLS.map(tool => (
                      <button
                        key={tool.id}
                        type="button"
                        className={`format-tool-btn ${tool.id}`}
                        onClick={() => applyNoteFormat(tool)}
                        title={tool.title}
                        aria-label={tool.title}
                      >
                        {tool.label}
                      </button>
                    ))}
                  </div>
                  <textarea
                    id="mood-note-input"
                    ref={noteTextareaRef}
                    value={note}
                    onChange={e => {
                      setNote(e.target.value);
                      if (detectDanger(e.target.value)) setShowSOS(true);
                    }}
                    placeholder="Hôm nay có chuyện gì xảy ra..."
                    rows={4}
                  />
                  {note.trim() && (
                    <div className="note-preview-box">
                      <span>Xem trước ghi chú</span>
                      <RichText text={note} className="note-preview-content" />
                    </div>
                  )}
                  <label className={`ai-privacy-toggle ${excludeFromAI ? 'active' : ''}`}>
                    <input
                      type="checkbox"
                      checked={excludeFromAI}
                      onChange={e => setExcludeFromAI(e.target.checked)}
                    />
                    <span className="ai-privacy-icon" aria-hidden="true">🔒</span>
                    <span>
                      <strong>Không gửi dòng này cho AI</strong>
                      <small>Vẫn lưu trong nhật ký, nhưng bỏ qua khi tạo insight, chat memory và nhìn lại ngày bằng AI.</small>
                    </span>
                  </label>
                  <div
                    className={`checkin-photo-field ${mediaDropActive ? 'drop-active' : ''}`}
                    onDragEnter={handleMediaDragEnter}
                    onDragOver={handleMediaDragOver}
                    onDragLeave={handleMediaDragLeave}
                    onDrop={handleMediaDrop}
                  >
                    <div className="photo-field-head">
                      <div>
                        <strong>Tệp check-in</strong>
                        <span>Thêm ảnh, video hoặc âm thanh để sau này nhớ ngữ cảnh hơn. Có thể kéo thả hoặc dán tệp vào đây.</span>
                      </div>
                      <button type="button" className="btn-photo-select" onClick={() => imageInputRef.current?.click()} disabled={recordingState !== 'idle'}>
                        📎 Chọn tệp
                      </button>
                    </div>
                    <div className="quick-record-row">
                      <button
                        type="button"
                        className={`btn-audio-record ${recordingState === 'recording' ? 'recording' : ''}`}
                        onClick={recordingState === 'recording' ? stopAudioRecording : startAudioRecording}
                        disabled={saving || recordingState === 'stopping'}
                      >
                        {recordingState === 'recording'
                          ? `Dừng ${formatDuration(recordingSeconds)}`
                          : recordingState === 'stopping'
                            ? 'Đang xử lý...'
                            : '🎙️ Ghi âm nhanh'}
                      </button>
                      {recordingState !== 'idle' && (
                        <div className="recording-status" role="status">
                          <span className="recording-pulse" />
                          <strong>{recordingState === 'recording' ? 'Đang ghi âm' : 'Đang tạo tệp ghi âm'}</strong>
                          <small>{formatDuration(recordingSeconds)} / {formatDuration(AUDIO_RECORDING_LIMIT)}</small>
                        </div>
                      )}
                    </div>
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*,video/*,audio/*"
                      multiple
                      onChange={handleImageSelect}
                      hidden
                    />
                    {mediaDropActive && (
                      <div className="media-drop-overlay" aria-hidden="true">
                        Thả tệp vào đây
                      </div>
                    )}
                    {(existingImages.length > 0 || imagePreviews.length > 0) && (
                      <div className="checkin-photo-grid">
                        {existingImages.map((image, index) => (
                          <div key={`${image.url}-${index}`} className="checkin-photo-preview">
                            {image.kind === 'image' && <img src={image.url} alt={`Ảnh check-in đã lưu ${index + 1}`} />}
                            {image.kind === 'video' && <video src={image.url} muted preload="metadata" />}
                            {image.kind === 'audio' && (
                              <div className="media-file-preview audio-preview">
                                🎧
                                <span title={image.name}>{displayAttachmentName(image)}</span>
                                <audio src={image.url} controls preload="metadata" />
                              </div>
                            )}
                            <button type="button" onClick={() => removeExistingImageAt(index)}>Bỏ tệp</button>
                          </div>
                        ))}
                        {imagePreviews.map((preview, index) => (
                          <div key={preview.id} className="checkin-photo-preview">
                            {preview.file.type.startsWith('image/') && <img src={preview.url} alt={`Ảnh check-in xem trước ${index + 1}`} />}
                            {preview.file.type.startsWith('video/') && <video src={preview.url} muted preload="metadata" />}
                            {preview.file.type.startsWith('audio/') && (
                              <div className="media-file-preview audio-preview">
                                🎧
                                <span title={preview.file.name}>{displayAttachmentName({ type: preview.file.type, kind: preview.file.type?.startsWith('audio/') ? 'audio' : 'file' }, { date: new Date() })}</span>
                                <audio src={preview.url} controls preload="metadata" />
                              </div>
                            )}
                            <button type="button" onClick={() => removeSelectedImage(index)}>
                              Bỏ tệp
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {imageError && <p className="photo-error" role="alert">{imageError}</p>}
                  </div>
                  {(draftStatus || hasDraftContent) && !editingId && (
                    <div className="draft-status-row" role="status">
                      <span>{draftStatus || 'Nháp hôm nay đang được giữ lại.'}</span>
                      {hasDraftContent && (
                        <button type="button" onClick={clearDraft}>
                          Xóa nháp
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <button
                  className="btn btn-primary mt-4 w-full"
                  onClick={handleSave}
                  disabled={saving || recordingState !== 'idle'}
                >
                  {saving
                    ? <span className="btn-loading">⏳ {saveStatus || 'Đang lưu...'}</span>
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
        </div>
        )}

        {activeTab === 'insight' && (
        <div className="tracker-tab-panel insight-tab-panel">
          {/* AI Advice & Chat */}
          {(aiLoading || aiPreview || aiAdvice || aiError || aiPreviewStatus) ? (
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
              {aiPreview && !aiLoading && (
                <div className="ai-advice ai-preview-card">
                  <div className="ai-advice-header">
                    <span>✨ Bản phân tích nháp</span>
                    <span className="memory-badge">Chưa lưu</span>
                  </div>
                  <p>{aiPreview.advice}</p>
                  {aiPreviewStatus && <p className="ai-preview-note">{aiPreviewStatus}</p>}
                  <div className="ai-preview-actions">
                    <button className="btn btn-primary" onClick={saveAnalysisPreview}>
                      Lưu phân tích này
                    </button>
                    <button className="btn btn-secondary" onClick={hideAnalysisPreview}>
                      Ẩn khỏi lịch sử
                    </button>
                    <button className="btn btn-secondary" onClick={regenerateAnalysisPreview} disabled={aiLoading}>
                      Tạo lại
                    </button>
                  </div>
                </div>
              )}
              {!aiPreview && aiPreviewStatus && !aiLoading && (
                <p className="ai-preview-saved-status">{aiPreviewStatus}</p>
              )}
              {aiAdvice && !aiLoading && !aiPreview && (
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
                            chatFnRef.current = createChat(aiAdvice, todayAI?.moodLabel || '', [], aiMemory || [], currentGoal?.label || userGoal);
                            saveTodayAI({ advice: aiAdvice, moodLabel: todayAI?.moodLabel || '', chatMessages: [] });
                          }}>🔄 Mới</button>
                        )}
                        <button className="chat-action-btn" onClick={() => {
                          if (!chatFnRef.current)
                            chatFnRef.current = createChat(aiAdvice, todayAI?.moodLabel || '', chatMessages, aiMemory || [], currentGoal?.label || userGoal);
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
          ) : (
            <div className="card insight-empty-card">
              <div className="empty-timeline">
                <div style={{ fontSize: 40 }} aria-hidden="true">✨</div>
                <h3>Chưa có insight hôm nay</h3>
                <p className="text-muted">Ghi một cảm xúc mới để MindBuddy phân tích và gợi ý bước tiếp theo.</p>
                <button className="btn btn-primary mt-2" onClick={() => selectTab('today')}>
                  Ghi cảm xúc ngay
                </button>
              </div>
            </div>
          )}
        </div>
        )}

        {activeTab === 'history' && (
        <div className="tracker-timeline-col tracker-tab-panel">
          <div className="history-toolbar card mb-4">
            <div>
              <h3>Lịch sử cảm xúc</h3>
              <p className="text-muted">Xem nhanh theo khoảng thời gian và mở từng ngày để xem chi tiết.</p>
            </div>
            <div className="history-filters" role="tablist" aria-label="Lọc lịch sử cảm xúc">
              {HISTORY_RANGE_OPTIONS.map(option => (
                <button
                  key={option.value}
                  className={`history-filter-btn ${historyRange === option.value ? 'active' : ''}`}
                  onClick={() => setHistoryRange(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="history-advanced-filters card mb-4">
            <div className="history-advanced-head">
              <div>
                <h3>Bộ lọc lịch sử</h3>
                <p className="text-muted">
                  Đang hiển thị {filteredMoodLogs.length}/{moodLogs.length} ghi chú
                  {hasAdvancedHistoryFilters ? ' theo bộ lọc hiện tại.' : historyRange === 'all' ? ' trong toàn bộ lịch sử.' : ' trong khoảng đã chọn.'}
                </p>
              </div>
              {hasAdvancedHistoryFilters && (
                <button type="button" className="btn btn-secondary" onClick={resetHistoryFilters}>
                  Xóa lọc
                </button>
              )}
            </div>

            <label className="history-search-field">
              <span>Tìm kiếm nhật ký</span>
              <div>
                <input
                  type="search"
                  value={historyFilters.search}
                  onChange={e => updateHistoryFilter('search', e.target.value)}
                  placeholder="Tìm note, nguyên nhân, mood, ngày, ảnh/video/audio..."
                />
                {historyFilters.search && (
                  <button type="button" onClick={() => updateHistoryFilter('search', '')} aria-label="Xóa tìm kiếm">
                    ×
                  </button>
                )}
              </div>
            </label>

            <div className="history-filter-grid">
              <label>
                <span>Mood</span>
                <select value={historyFilters.mood} onChange={e => updateHistoryFilter('mood', e.target.value)}>
                  <option value="all">Tất cả mood</option>
                  {allMoods.map(mood => (
                    <option key={mood.id} value={String(mood.id)}>
                      {mood.emoji ? `${mood.emoji} ` : ''}{mood.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Nguyên nhân</span>
                <select value={historyFilters.cause} onChange={e => updateHistoryFilter('cause', e.target.value)}>
                  <option value="all">Tất cả nguyên nhân</option>
                  {availableHistoryCauses.map(cause => (
                    <option key={cause} value={cause}>{cause}</option>
                  ))}
                </select>
              </label>

              <label>
                <span>Media</span>
                <select value={historyFilters.media} onChange={e => updateHistoryFilter('media', e.target.value)}>
                  <option value="all">Tất cả</option>
                  <option value="any">Có tệp đính kèm</option>
                  <option value="image">Có ảnh</option>
                  <option value="video">Có video</option>
                  <option value="audio">Có âm thanh</option>
                  <option value="none">Không có tệp</option>
                </select>
              </label>

              <label>
                <span>Từ ngày</span>
                <input
                  type="date"
                  value={historyFilters.from}
                  onChange={e => updateHistoryFilter('from', e.target.value)}
                />
              </label>

              <label>
                <span>Đến ngày</span>
                <input
                  type="date"
                  value={historyFilters.to}
                  onChange={e => updateHistoryFilter('to', e.target.value)}
                />
              </label>
            </div>

            <div className="history-quick-toggles" aria-label="Lọc nhanh chỉ số">
              <button
                type="button"
                className={historyFilters.stressHigh ? 'active' : ''}
                onClick={() => updateHistoryFilter('stressHigh', !historyFilters.stressHigh)}
              >
                Stress cao ≥ 4/5
              </button>
              <button
                type="button"
                className={historyFilters.sleepLow ? 'active' : ''}
                onClick={() => updateHistoryFilter('sleepLow', !historyFilters.sleepLow)}
              >
                Ngủ thấp ≤ 2/5
              </button>
            </div>
          </div>

          <div className="card mood-calendar-card mb-4">
            <div className="mood-calendar-header">
              <div>
                <h3>🗓️ Mood calendar</h3>
                <p className="text-muted">Màu mỗi ngày lấy theo check-in mới nhất, có kèm nhãn cảm xúc.</p>
              </div>
              <div className="mood-calendar-controls" aria-label="Điều hướng tháng mood calendar">
                <button
                  type="button"
                  className="calendar-nav-btn"
                  onClick={() => moveCalendarMonth(-1)}
                  aria-label="Xem tháng trước"
                >
                  ‹
                </button>
                <strong>Tháng {exportMonth + 1}/{exportYear}</strong>
                <button
                  type="button"
                  className="calendar-nav-btn"
                  onClick={() => moveCalendarMonth(1)}
                  disabled={isAtOrAfterCurrentMonth}
                  aria-label="Xem tháng sau"
                >
                  ›
                </button>
                <button
                  type="button"
                  className="calendar-today-btn"
                  onClick={resetCalendarMonth}
                  disabled={isCurrentMonthSelected}
                >
                  Hôm nay
                </button>
              </div>
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
              <h3 className="mb-3">📊 Biểu đồ cảm xúc {historyRangeLabel(historyRange)}</h3>
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
                <p>Chưa có biểu đồ cho {historyRangeLabel(historyRange)}.</p>
                <Link to="/mood" className="btn btn-primary">Ghi cảm xúc đầu tiên</Link>
              </div>
            </div>
          )}

          <div className="card">
            <div className="flex justify-between items-center mb-3">
              <h3>📝 Nhật ký cảm xúc</h3>
              <button className="btn btn-secondary" onClick={() => selectTab('export')}>
                Xuất dữ liệu
              </button>
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
                          const logMetrics = log.metrics ? normalizeMetrics(log.metrics) : null;
                          const attachments = logAttachments(log);
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
                                  {log.excludeFromAI && (
                                    <span className="ai-private-badge" title="Dòng này không được gửi cho AI">riêng tư AI</span>
                                  )}
                                  {log.pinned && (
                                    <span className="pinned-badge" title="Ghi chú quan trọng">quan trọng</span>
                                  )}
                                  <div className="entry-actions">
                                    <button
                                      className={`entry-btn pin ${log.pinned ? 'active' : ''}`}
                                      onClick={() => toggleMoodLogPinned(log.id)}
                                      title={log.pinned ? 'Bỏ ghim' : 'Ghim ghi chú'}
                                      aria-label={`${log.pinned ? 'Bỏ ghim' : 'Ghim'} ghi chú lúc ${format(new Date(log.date), 'HH:mm')}`}
                                    >
                                      {log.pinned ? '★' : '☆'}
                                    </button>
                                    <button className="entry-btn edit"
                                      onClick={() => startEdit(log)} title="Chỉnh sửa" aria-label={`Chỉnh sửa ghi chú lúc ${format(new Date(log.date), 'HH:mm')}`}>✏️</button>
                                    <button className="entry-btn delete"
                                      onClick={() => handleDelete(log.id)} title="Xóa" aria-label={`Xóa ghi chú lúc ${format(new Date(log.date), 'HH:mm')}`}>🗑️</button>
                                  </div>
                                </div>
                                {causeTags.length > 0 && (
                                  <div className="entry-causes">
                                    {causeTags.map(t => (
                                      <span
                                        key={t}
                                        className="entry-cause-tag"
                                        style={causeTagStyle(t)}
                                        title={causeTagTitle(t)}
                                      >
                                        {t}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {logMetrics && (
                                  <div className="entry-metrics" aria-label={`Chỉ số phụ: ${metricSummary(logMetrics)}`}>
                                    {METRIC_FIELDS.map(field => (
                                      <span key={field.id} className={`entry-metric metric-${field.id}`}>
                                        {field.label}: {logMetrics[field.id]}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                <MediaAttachments
                                  attachments={attachments}
                                  label={`Tệp check-in lúc ${format(new Date(log.date), 'HH:mm')}`}
                                  date={log.date}
                                  onOpenImage={openPhotoLightbox}
                                />
                                {cleanNote && <RichText text={cleanNote} className="entry-note" />}
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
                    <p>
                      {hasAdvancedHistoryFilters
                        ? 'Không có ghi chú nào khớp với bộ lọc hiện tại.'
                        : historyRange === 'all'
                          ? 'Không có ghi chú nào trong toàn bộ lịch sử.'
                          : `Không có ghi chú trong ${historyRange} ngày gần đây.`}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        )}

        {activeTab === 'export' && (
          <div className="tracker-tab-panel export-tab-panel">
            <div className="card export-panel-card">
              <div>
                <h3>Xuất nhật ký cảm xúc</h3>
                <p className="text-muted">Tạo file PDF để lưu lại hoặc đọc lại ngoài MindBuddy.</p>
              </div>
              <div className="export-filters-panel">
                <div className="export-filters-head">
                  <h4>Tùy chọn xuất</h4>
                  <p className="text-muted">Chọn phạm vi và mức chi tiết trước khi tạo PDF.</p>
                </div>
                <div className="export-filter-grid">
                  <label>
                    <span>Riêng tư</span>
                    <select
                      value={exportOptions.privacy}
                      onChange={e => setExportOptions(prev => ({ ...prev, privacy: e.target.value }))}
                    >
                      <option value="all">Xuất tất cả note</option>
                      <option value="nonPrivate">Chỉ note không riêng tư AI</option>
                    </select>
                  </label>
                  <label>
                    <span>Thời gian</span>
                    <select
                      value={exportOptions.range}
                      onChange={e => setExportOptions(prev => ({ ...prev, range: e.target.value }))}
                    >
                      <option value="selected">Theo lựa chọn bên dưới</option>
                      <option value="currentMonth">Chỉ tháng này</option>
                    </select>
                  </label>
                  <label>
                    <span>Nội dung</span>
                    <select
                      value={exportOptions.detail}
                      onChange={e => setExportOptions(prev => ({ ...prev, detail: e.target.value }))}
                    >
                      <option value="full">Mood, chỉ số và nội dung note</option>
                      <option value="metricsOnly">Chỉ mood + chỉ số</option>
                    </select>
                  </label>
                  <label className="export-check-option">
                    <input
                      type="checkbox"
                      checked={exportOptions.includeImages}
                      onChange={e => setExportOptions(prev => ({ ...prev, includeImages: e.target.checked }))}
                    />
                    <span>Xuất kèm ảnh</span>
                  </label>
                </div>
              </div>
              <div className="export-panel-grid">
                <div className="export-option">
                  <h4>Xuất theo tháng</h4>
                  <p className="text-muted">Phù hợp khi bạn muốn nhìn lại một giai đoạn ngắn.</p>
                  <div className="export-row">
                    <select value={exportMonth} onChange={e => setExportMonth(+e.target.value)}>
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i} value={i}>Tháng {i + 1}</option>
                      ))}
                    </select>
                    <select value={exportYear} onChange={e => setExportYear(+e.target.value)}>
                      {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                  <button
                    className="btn btn-primary w-full"
                    onClick={handleExport}
                    disabled={!!exporting}
                  >
                    {exporting === 'month' ? 'Đang xuất...' : 'Xuất PDF tháng'}
                  </button>
                </div>

                <div className="export-option">
                  <h4>Xuất toàn bộ</h4>
                  <p className="text-muted">Gồm tất cả ghi chú cảm xúc hiện có trong tài khoản.</p>
                  <div className="export-total">
                    <strong>{moodLogs.length}</strong>
                    <span>ghi chú cảm xúc</span>
                  </div>
                  <button
                    className="btn btn-secondary w-full"
                    onClick={handleExportAll}
                    disabled={!!exporting || moodLogs.length === 0}
                  >
                    {exporting === 'all' ? 'Đang xuất...' : 'Xuất tất cả'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
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
                const logMetrics = log.metrics ? normalizeMetrics(log.metrics) : null;
                const attachments = logAttachments(log);
                return (
                  <div key={log.id} className="day-detail-entry" style={{ '--entry-color': mood?.color || '#ccc' }}>
                    <div className="day-detail-entry-head">
                      <span className="day-detail-mood">{mood?.emoji} {mood?.label}</span>
                      <span className="day-detail-time">{format(new Date(log.date), 'HH:mm')}</span>
                    </div>
                    {causeTags.length > 0 && (
                      <div className="entry-causes">
                        {causeTags.map(t => (
                          <span
                            key={t}
                            className="entry-cause-tag"
                            style={causeTagStyle(t)}
                            title={causeTagTitle(t)}
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    {logMetrics && (
                      <div className="entry-metrics">
                        {METRIC_FIELDS.map(field => (
                          <span key={field.id} className={`entry-metric metric-${field.id}`}>
                            {field.label}: {logMetrics[field.id]}
                          </span>
                        ))}
                      </div>
                    )}
                    <MediaAttachments
                      attachments={attachments}
                      label={`Tệp check-in lúc ${format(new Date(log.date), 'HH:mm')}`}
                      date={log.date}
                      onOpenImage={openPhotoLightbox}
                    />
                    <RichText text={cleanNote} fallback="Không có ghi chú thêm." className="entry-note" />
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

      {photoLightbox && (
        <div className="photo-lightbox-overlay" onClick={e => e.target === e.currentTarget && setPhotoLightbox(null)}>
          <div className="photo-lightbox" role="dialog" aria-modal="true" aria-label={photoLightbox.label}>
            <div className="photo-lightbox-header">
              <span>{photoLightbox.label}</span>
              <button type="button" onClick={() => setPhotoLightbox(null)} aria-label="Đóng ảnh lớn">×</button>
            </div>
            <img src={photoLightbox.url} alt={photoLightbox.label} />
          </div>
        </div>
      )}
    </div>
  );
}
