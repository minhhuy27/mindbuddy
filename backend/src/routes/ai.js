const express = require('express');
const { chat, chatGemini } = require('../aiClient');
const router = express.Router();

const SYSTEM_PROMPT = `Bạn là trợ lý sức khỏe tâm thần thân thiện tên MindBuddy, hỗ trợ sinh viên Việt Nam.
Luôn đồng cảm, tích cực, thực tế. Không chẩn đoán bệnh. Nếu người dùng có dấu hiệu nguy hiểm, hướng dẫn gọi hotline 1800 599 920.
Trả lời bằng tiếng Việt, ngắn gọn (dưới 150 từ mỗi tin).
Khi người dùng nhắc đến cảm xúc trước đây, hãy liên kết với lịch sử đã được cung cấp để phản hồi có chiều sâu hơn.`;

const METRIC_LABELS = {
  stress: 'stress',
  energy: 'năng lượng',
  sleep: 'giấc ngủ',
  focus: 'tập trung',
};

function formatMetrics(metrics) {
  if (!metrics) return 'chưa ghi';
  return Object.entries(METRIC_LABELS)
    .map(([key, label]) => {
      const value = Number(metrics[key]);
      return Number.isFinite(value) ? `${label}: ${value}/5` : null;
    })
    .filter(Boolean)
    .join(', ') || 'chưa ghi';
}

function buildMemoryBlock(aiMemory) {
  if (!aiMemory || aiMemory.length === 0) return '';
  const lines = aiMemory
    .slice(0, 7)
    .map(entry => {
      const moodList = entry.moods?.length ? entry.moods.join(', ') : 'không rõ';
      return `- ${entry.date}: cảm xúc [${moodList}]${entry.summary ? ` — ${entry.summary}` : ''}`;
    })
    .join('\n');
  return `\n\n=== LỊCH SỬ CẢM XÚC GẦN ĐÂY CỦA NGƯỜI DÙNG ===\n${lines}\n(Hãy tham chiếu lịch sử này khi phù hợp để phản hồi có chiều sâu hơn.)`;
}

// POST /api/ai/analyze — phân tích cảm xúc sau check-in
router.post('/analyze', async (req, res) => {
  const { moodLabel, note, causes, metrics, recentMoods, aiMemory } = req.body;
  if (!moodLabel) return res.status(400).json({ error: 'moodLabel is required' });

  const recentSummary = recentMoods?.length > 0
    ? `Cảm xúc 7 ngày gần đây: ${recentMoods.map(m => m.label).join(', ')}.`
    : '';

  const systemWithMemory = SYSTEM_PROMPT + buildMemoryBlock(aiMemory);

  try {
    const { text, provider } = await chat([
      { role: 'system', content: systemWithMemory },
      {
        role: 'user',
        content: `Tôi vừa ghi cảm xúc:
- Cảm xúc hiện tại: ${moodLabel}
- Nguyên nhân: ${causes?.length ? causes.join(', ') : 'không rõ'}
- Chỉ số phụ: ${formatMetrics(metrics)}
- Ghi chú: ${note || 'không có'}
- ${recentSummary}

Hãy: đồng cảm ngắn (1-2 câu, có thể nhắc đến xu hướng từ những ngày trước nếu liên quan), nhận xét nhẹ nếu stress/năng lượng/giấc ngủ/tập trung có điểm đáng chú ý, đưa 2-3 lời khuyên thực tế, kết bằng câu động viên.`,
      },
    ]);
    console.log(`[analyze] provider: ${provider}`);
    res.json({ content: text, provider });
  } catch (err) {
    console.error('AI analyze error:', err.message);
    res.status(500).json({ error: 'AI service error' });
  }
});

// POST /api/ai/chat — gửi tin nhắn trong chat
router.post('/chat', async (req, res) => {
  const { messages, aiMemory } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  const systemWithMemory = SYSTEM_PROMPT + buildMemoryBlock(aiMemory);

  try {
    const { text, provider } = await chat([
      { role: 'system', content: systemWithMemory },
      ...messages,
    ]);
    console.log(`[chat] provider: ${provider}`);
    res.json({ content: text, provider });
  } catch (err) {
    console.error('AI chat error:', err.message);
    res.status(500).json({ error: 'AI service error' });
  }
});

// POST /api/ai/weekly — phân tích xu hướng tuần (dùng Gemini trực tiếp)
router.post('/weekly', async (req, res) => {
  const { moodSummary } = req.body;
  if (!moodSummary) return res.status(400).json({ error: 'moodSummary is required' });

  try {
    const { text, provider } = await chatGemini([
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Dưới đây là nhật ký cảm xúc gần đây của tôi:\n${moodSummary}\n\nHãy phân tích ngắn gọn, tối đa 150 từ, trả lời đúng 3 mục với tiêu đề sau:\nXu hướng chính:\nĐiểm cần chú ý:\nGợi ý hôm nay:`,
      },
    ]);
    console.log(`[weekly] provider: ${provider}`);
    res.json({ content: text, provider });
  } catch (err) {
    console.error('AI weekly error:', err.message);
    res.status(500).json({ error: 'AI service error' });
  }
});

// POST /api/ai/summarize — tóm tắt 1 ngày để lưu vào memory
router.post('/summarize', async (req, res) => {
  const { date, entries } = req.body;
  if (!entries || entries.length === 0) {
    return res.status(400).json({ error: 'entries is required' });
  }

  const entryText = entries.map((e, i) =>
    `${i + 1}. Cảm xúc: ${e.moodLabel}${e.causes?.length ? `, nguyên nhân: ${e.causes.join(', ')}` : ''}${e.metrics ? `, chỉ số: ${formatMetrics(e.metrics)}` : ''}${e.note ? `, ghi chú: "${e.note}"` : ''}`
  ).join('\n');

  try {
    const { text, provider } = await chat([
      {
        role: 'system',
        content: 'Bạn là trợ lý tóm tắt nhật ký cảm xúc. Hãy tóm tắt ngắn gọn (1-2 câu, tối đa 60 từ) trạng thái cảm xúc chính của người dùng trong ngày dựa trên các ghi chú sau. Trả lời bằng tiếng Việt.',
      },
      {
        role: 'user',
        content: `Ngày ${date}, người dùng đã ghi:\n${entryText}\n\nTóm tắt trạng thái cảm xúc ngày này:`,
      },
    ], { maxTokens: 120 });
    console.log(`[summarize] provider: ${provider}`);
    res.json({ summary: text, provider });
  } catch (err) {
    console.error('AI summarize error:', err.message);
    res.status(500).json({ error: 'AI service error' });
  }
});

// GET /api/ai/status — kiểm tra trạng thái các provider
router.get('/status', (req, res) => {
  res.json({
    groq: !!process.env.GROQ_API_KEY,
    gemini: !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here'),
  });
});

module.exports = router;
