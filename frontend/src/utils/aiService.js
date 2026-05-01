const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Từ khóa nguy hiểm cần phát hiện
const DANGER_KEYWORDS = [
  'tự tử', 'muốn chết', 'không muốn sống', 'kết thúc tất cả', 'không còn ý nghĩa',
  'tự làm đau', 'cắt tay', 'uống thuốc ngủ', 'nhảy xuống', 'biến mất mãi mãi',
  'không ai quan tâm', 'gánh nặng cho mọi người', 'thà chết còn hơn',
];

export function detectDanger(text) {
  const lower = text.toLowerCase();
  return DANGER_KEYWORDS.some(kw => lower.includes(kw));
}

/**
 * Phân tích cảm xúc sau check-in.
 * aiMemory: [{ date, summary, moods }] — lịch sử các ngày trước
 */
export async function analyzeMood({ moodLabel, note, causes, recentMoods, aiMemory }) {
  try {
    const res = await fetch(`${API_BASE}/ai/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moodLabel, note, causes, recentMoods, aiMemory }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.content || null;
  } catch (err) {
    console.error('analyzeMood error:', err);
    return null;
  }
}

/**
 * Tạo chat function với memory context.
 * aiMemory: [{ date, summary, moods }]
 */
export function createChat(initialAdvice, moodContext, existingMessages = [], aiMemory = []) {
  const history = [
    { role: 'user', content: `Tôi cảm thấy ${moodContext} hôm nay.` },
    { role: 'assistant', content: initialAdvice },
    ...existingMessages.map(m => ({
      role: m.role === 'ai' ? 'assistant' : 'user',
      content: m.text,
    })),
  ];

  return async (message) => {
    history.push({ role: 'user', content: message });
    try {
      const res = await fetch(`${API_BASE}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, aiMemory }),
      });
      if (!res.ok) throw new Error('Server error');
      const data = await res.json();
      const reply = data.content;
      history.push({ role: 'assistant', content: reply });
      return reply;
    } catch (err) {
      console.error('createChat error:', err);
      throw err;
    }
  };
}

/**
 * Tóm tắt 1 ngày để lưu vào aiMemory.
 * entries: [{ moodLabel, note, causes }]
 * Trả về chuỗi tóm tắt ngắn.
 */
export async function summarizeDay({ date, entries }) {
  if (!entries || entries.length === 0) return null;
  try {
    const res = await fetch(`${API_BASE}/ai/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, entries }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.summary || null;
  } catch (err) {
    console.error('summarizeDay error:', err);
    return null;
  }
}

/**
 * Phân tích xu hướng tuần.
 */
export async function analyzeWeeklyTrend(moodLogs, MOODS) {
  if (moodLogs.length < 3) return null;

  const recent = moodLogs.slice(0, 14).map(l => {
    const mood = MOODS.find(m => m.id === l.mood);
    const d = new Date(l.date);
    const days = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    return `${days[d.getDay()]} ${d.toLocaleDateString('vi-VN')}: ${mood?.label || ''}${l.note ? ` (${l.note.slice(0, 50)})` : ''}`;
  }).join('\n');

  try {
    const res = await fetch(`${API_BASE}/ai/weekly`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moodSummary: recent }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.content || null;
  } catch (err) {
    console.error('analyzeWeeklyTrend error:', err);
    return null;
  }
}
