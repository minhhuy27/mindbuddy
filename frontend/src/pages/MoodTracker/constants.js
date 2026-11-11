import { format, isToday, isYesterday } from 'date-fns';
import { vi } from 'date-fns/locale';
import { normalizeMoodAttachments } from '../../utils/moodImages';

export const VISUAL_CAUSES = ['Học tập', 'Gia đình', 'Sức khỏe', 'Thời tiết', 'Tài chính', 'Quan hệ', 'Riêng tư'];
export const DEFAULT_CAUSES = [...VISUAL_CAUSES, 'Thi cử', 'Bạn bè', 'Tình yêu', 'Khác'];
export const CAUSE_TAG_SCHEMA_VERSION = 'v2-color-tags';

export const METRIC_FIELDS = [
  { id: 'stress', label: 'Stress', low: 'Rất nhẹ', high: 'Rất căng', invert: true },
  { id: 'energy', label: 'Năng lượng', low: 'Cạn pin', high: 'Đầy năng lượng' },
  { id: 'sleep', label: 'Giấc ngủ', low: 'Rất kém', high: 'Rất tốt' },
  { id: 'focus', label: 'Tập trung', low: 'Rất khó', high: 'Rất rõ' },
];

export const DEFAULT_METRICS = {
  stress: 3,
  energy: 3,
  sleep: 3,
  focus: 3,
};

export const VALID_TABS = ['today', 'history', 'insight', 'export'];
export const AUDIO_RECORDING_LIMIT = 10 * 60;
export const PHOTO_ZOOM_MIN = 1;
export const PHOTO_ZOOM_MAX = 4;
export const PHOTO_ZOOM_STEP = 0.18;
export const HISTORY_RANGE_OPTIONS = [
  { value: 7, label: '7 ngày' },
  { value: 14, label: '14 ngày' },
  { value: 30, label: '30 ngày' },
  { value: 'all', label: 'Tất cả' },
];

export function historyRangeLabel(range) {
  return range === 'all' ? 'toàn bộ' : `${range} ngày`;
}

export function normalizeTab(tab) {
  return VALID_TABS.includes(tab) ? tab : 'today';
}

export function normalizeMetrics(metrics) {
  return METRIC_FIELDS.reduce((acc, field) => {
    const value = Number(metrics?.[field.id]);
    acc[field.id] = Number.isFinite(value) ? Math.min(5, Math.max(1, value)) : DEFAULT_METRICS[field.id];
    return acc;
  }, {});
}

export function getBestAudioMimeType() {
  if (typeof window === 'undefined' || !window.MediaRecorder?.isTypeSupported) return '';
  return [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/mpeg',
  ].find(type => window.MediaRecorder.isTypeSupported(type)) || '';
}

export function getAudioExtension(type = '') {
  if (type.includes('mp4')) return 'm4a';
  if (type.includes('mpeg')) return 'mp3';
  return 'webm';
}

export function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

export function metricSummary(metrics) {
  if (!metrics) return '';
  const normalized = normalizeMetrics(metrics);
  return METRIC_FIELDS.map(field => `${field.label}: ${normalized[field.id]}/5`).join(', ');
}

export const logAttachments = normalizeMoodAttachments;

export function extractLogCauses(note = '') {
  return note.match(/\[(.+)\]$/)?.[1]?.split(', ').filter(Boolean) || [];
}

export function cleanLogNote(note = '') {
  return String(note).replace(/\s*\[.+\]$/, '').trim();
}

export function metricValue(metrics, id) {
  const value = Number(metrics?.[id]);
  return Number.isFinite(value) ? Math.min(5, Math.max(1, value)) : null;
}

export function normalizeSearchText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

export function attachmentSearchText(attachment) {
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
export const EMOJI_SUGGESTIONS = [
  '😤','😡','🤬','😠','😒','🙄','😑','😶',
  '😩','😫','🥱','😴','🤒','🤕','🥴','😵',
  '🤯','😱','😨','😰','😥','😓','🤧','😷',
  '🥺','😢','😭','😞','😟','😕','🙁','☹️',
  '😌','😏','🤔','🤗','🥰','😍','🤩','😎',
  '🥳','😋','😜','🤪','😝','🤑','🤠','👻',
  '💪','🔥','⚡','🌊','🌈','✨','💫','🎯',
];

export const JOURNAL_ICON_GROUPS = [
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

export const SCORE_OPTIONS = [
  { value: 5, label: 'Rất tích cực', color: '#55efc4' },
  { value: 4, label: 'Tích cực',     color: '#74b9ff' },
  { value: 3, label: 'Trung tính',   color: '#fdcb6e' },
  { value: 2, label: 'Tiêu cực',     color: '#fd79a8' },
  { value: 1, label: 'Rất tiêu cực', color: '#e17055' },
];

export const COLOR_PRESETS = [
  '#55efc4','#74b9ff','#a29bfe','#fdcb6e','#fd79a8',
  '#e17055','#00cec9','#6c5ce7','#e84393','#f9ca24',
  '#f0932b','#6ab04c','#eb4d4b','#7ed6df','#c7ecee',
];

export const FORMAT_TOOLS = [
  { id: 'bold', label: 'B', title: 'Bôi đậm', prefix: '**', suffix: '**', sample: 'nội dung quan trọng' },
  { id: 'underline', label: 'U', title: 'Gạch chân', prefix: '<u>', suffix: '</u>', sample: 'điều cần nhớ' },
  { id: 'heading', label: 'H', title: 'Tiêu đề', linePrefix: '## ', sample: 'Tiêu đề nhỏ' },
  { id: 'checklist', label: '☑', title: 'Checklist', linePrefix: '- [ ] ', sample: 'việc nhỏ cần làm' },
  { id: 'quote', label: '❝', title: 'Trích dẫn', linePrefix: '> ', sample: 'một câu mình muốn giữ lại' },
];

export function groupByDay(logs) {
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

export function dayLabel(dateStr) {
  const d = new Date(dateStr);
  if (isToday(d)) return 'Hôm nay';
  if (isYesterday(d)) return 'Hôm qua';
  return format(d, 'EEEE, dd/MM/yyyy', { locale: vi });
}
