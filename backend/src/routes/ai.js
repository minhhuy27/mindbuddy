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

const DAILY_REVIEW_FALLBACK = {
  summary: 'MindBuddy đã ghi nhận dữ liệu trong ngày này.',
  bestMoment: 'Chưa có đủ dữ liệu rõ ràng để xác định khoảnh khắc ổn nhất.',
  stressor: 'Chưa có đủ dữ liệu rõ ràng để xác định điều làm bạn căng hơn.',
  tomorrowStep: 'Ngày mai hãy thử ghi một check-in ngắn và chọn một việc nhỏ dễ bắt đầu.',
};

const COUNSELING_MODES = {
  listen: {
    label: 'Lắng nghe',
    instruction: 'Phản hồi như một người đồng hành đang lắng nghe: phản chiếu cảm xúc, gọi tên điều người dùng đang chịu, hỏi tối đa 1 câu nhẹ.',
  },
  reframe: {
    label: 'Gỡ rối suy nghĩ',
    instruction: 'Giúp người dùng tách sự kiện, suy nghĩ, cảm xúc và một cách nhìn cân bằng hơn. Không tranh luận gay gắt, không phủ nhận cảm xúc.',
  },
  plan: {
    label: 'Kế hoạch 24h',
    instruction: 'Đề xuất một kế hoạch 24 giờ rất nhỏ, có 2-3 bước cụ thể, ưu tiên ăn ngủ, nghỉ, học/làm nhẹ và nhờ hỗ trợ khi cần.',
  },
  prepare: {
    label: 'Nói với người thật',
    instruction: 'Giúp người dùng chuẩn bị nói chuyện với bạn bè, gia đình, cố vấn hoặc chuyên gia: đưa câu mở lời ngắn và điều nên nói rõ.',
  },
};

function stripAiNoise(text) {
  return String(text || '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .trim();
}

function tryParseJson(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === 'string') return tryParseJson(parsed);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function extractJsonCandidates(text) {
  const candidates = [];
  const source = String(text || '');
  for (let start = 0; start < source.length; start++) {
    if (source[start] !== '{') continue;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < source.length; i++) {
      const ch = source[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === '{') depth++;
      if (ch === '}') depth--;
      if (depth === 0) {
        candidates.push(source.slice(start, i + 1));
        break;
      }
    }
  }
  return candidates;
}

function asCleanString(value) {
  if (typeof value !== 'string') return '';
  return stripAiNoise(value)
    .replace(/^["']|["']$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeDailyReview(value) {
  const source = typeof value === 'string' ? parseJsonObject(value) : value;
  const review = source && typeof source === 'object' ? source : {};
  return {
    summary: asCleanString(review.summary) || DAILY_REVIEW_FALLBACK.summary,
    bestMoment: asCleanString(review.bestMoment) || DAILY_REVIEW_FALLBACK.bestMoment,
    stressor: asCleanString(review.stressor) || DAILY_REVIEW_FALLBACK.stressor,
    tomorrowStep: asCleanString(review.tomorrowStep) || DAILY_REVIEW_FALLBACK.tomorrowStep,
  };
}

function parseJsonObject(text) {
  if (!text) return null;
  const cleaned = stripAiNoise(text);
  const direct = tryParseJson(cleaned);
  if (direct) return direct;

  const candidates = extractJsonCandidates(cleaned);
  for (let i = candidates.length - 1; i >= 0; i--) {
    const parsed = tryParseJson(candidates[i]);
    if (parsed && (parsed.summary || parsed.bestMoment || parsed.stressor || parsed.tomorrowStep)) {
      return parsed;
    }
  }
  return null;
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

function normalizeCounselingHistory(history) {
  if (!Array.isArray(history)) return [];
  const normalized = history
    .slice(-8)
    .map(message => ({
      role: message.role === 'ai' || message.role === 'assistant' ? 'assistant' : 'user',
      content: String(message.text || message.content || '').slice(0, 900),
    }))
    .filter(message => message.content.trim());
  while (normalized[0]?.role === 'assistant') normalized.shift();
  return normalized.filter((message, index) => index === 0 || message.role !== normalized[index - 1].role);
}

function buildCounselingContextBlock(journalContext) {
  if (!Array.isArray(journalContext) || journalContext.length === 0) {
    return 'Người dùng không bật ngữ cảnh nhật ký.';
  }

  return journalContext
    .slice(0, 6)
    .map((entry, index) => {
      const metrics = formatMetrics(entry.metrics);
      const causes = Array.isArray(entry.causes) && entry.causes.length
        ? `; nguyên nhân: ${entry.causes.join(', ')}`
        : '';
      const note = entry.note ? `; ghi chú: "${String(entry.note).slice(0, 260)}"` : '';
      return `${index + 1}. ${entry.date || ''} ${entry.time || ''}: ${entry.moodLabel || 'không rõ'}; chỉ số: ${metrics}${causes}${note}`;
    })
    .join('\n');
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

// POST /api/ai/daily-review — tạo bản nhìn lại ngày có cấu trúc
router.post('/daily-review', async (req, res) => {
  const { date, entries = [], pomodoros = [], userGoal } = req.body;
  if ((!entries || entries.length === 0) && (!pomodoros || pomodoros.length === 0)) {
    return res.status(400).json({ error: 'entries or pomodoros is required' });
  }

  const entryText = entries.length
    ? entries.map((e, i) =>
      `${i + 1}. ${e.time || ''} - cảm xúc: ${e.moodLabel || 'không rõ'}${Number.isFinite(Number(e.moodScore)) ? ` (${e.moodScore}/5)` : ''}${e.causes?.length ? `, nguyên nhân: ${e.causes.join(', ')}` : ''}${e.metrics ? `, chỉ số: ${formatMetrics(e.metrics)}` : ''}${e.note ? `, ghi chú: "${e.note}"` : ''}`
    ).join('\n')
    : 'Không có check-in cảm xúc.';

  const pomodoroText = pomodoros.length
    ? pomodoros.map((p, i) =>
      `${i + 1}. ${p.time || ''} - ${p.durationMin || 25} phút, tập trung trước: ${p.focusBefore || 'chưa ghi'}/5, sau: ${p.focusAfter || 'chưa ghi'}/5${p.afterFeeling ? `, cảm nhận: ${p.afterFeeling}` : ''}${p.afterNote ? `, ghi chú: "${p.afterNote}"` : ''}`
    ).join('\n')
    : 'Không có Pomodoro.';

  try {
    const { text, provider } = await chatGemini([
      {
        role: 'system',
        content: `Bạn là MindBuddy, trợ lý nhìn lại ngày cho một người dùng cá nhân. Không chẩn đoán bệnh. Trả lời bằng tiếng Việt, ngắn, cụ thể, dịu nhưng thực tế.
Không được viết quá trình suy nghĩ, không dùng thẻ <think>, không Markdown.
Chỉ trả về JSON hợp lệ. JSON phải có đúng các khóa:
{
  "summary": "1 câu tổng quan ngày hôm nay",
  "bestMoment": "trả lời câu: Hôm nay mình ổn nhất lúc nào?",
  "stressor": "trả lời câu: Điều gì làm mình căng hơn?",
  "tomorrowStep": "một điều nhỏ nên thử ngày mai"
}`,
      },
      {
        role: 'user',
        content: `Ngày: ${date}
Mục tiêu hiện tại: ${userGoal || 'không rõ'}

Check-in:
${entryText}

Pomodoro:
${pomodoroText}

Hãy tạo bản nhìn lại ngày dựa trên dữ liệu trên. Trả về JSON ngắn, hoàn chỉnh, không có chữ nào ngoài JSON.`,
      },
    ], { maxTokens: 900 });

    const parsed = parseJsonObject(text);
    const review = normalizeDailyReview(parsed || text);

    console.log(`[daily-review] provider: ${provider}`);
    res.json({ review, provider });
  } catch (err) {
    console.error('AI daily-review error:', err.message);
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

// POST /api/ai/counsel — phản hồi tư vấn tự hỗ trợ có giới hạn an toàn
router.post('/counsel', async (req, res) => {
  const {
    mode = 'listen',
    distressLevel = 3,
    message,
    history = [],
    journalContext = [],
    userGoal,
  } = req.body;

  const trimmedMessage = String(message || '').trim();
  if (!trimmedMessage) return res.status(400).json({ error: 'message is required' });

  const selectedMode = COUNSELING_MODES[mode] || COUNSELING_MODES.listen;
  const safeDistressLevel = Math.max(1, Math.min(5, Number(distressLevel) || 3));
  const contextBlock = buildCounselingContextBlock(journalContext);
  const normalizedHistory = normalizeCounselingHistory(history);

  try {
    const { text, provider } = await chatGemini([
      {
        role: 'system',
        content: `Bạn là MindBuddy trong mục Tư vấn tâm lý tự hỗ trợ. Bạn không phải bác sĩ, nhà trị liệu hay dịch vụ khẩn cấp.
Mục tiêu: giúp người dùng bình tĩnh hơn, hiểu tình huống hơn và chọn một bước nhỏ tiếp theo.
Ranh giới bắt buộc:
- Không chẩn đoán bệnh, không kê thuốc, không khẳng định người dùng mắc rối loạn.
- Không đưa lời khuyên nguy hiểm, không khuyến khích quyết định lớn khi đang kích động.
- Nếu người dùng nói muốn tự tử, tự làm hại bản thân, làm hại người khác hoặc đang không an toàn: ưu tiên bảo đảm an toàn ngay, khuyên mở S.O.S trong app, gọi người tin cậy, gọi cấp cứu địa phương hoặc 988 nếu ở Mỹ. Không tiếp tục phân tích dài.
- Tôn trọng riêng tư: chỉ dùng ngữ cảnh nhật ký được cung cấp, không suy đoán quá mức.
Phong cách: tiếng Việt, ấm, rõ, thực tế, tối đa 180 từ. Không Markdown phức tạp. Không viết quá trình suy nghĩ.`,
      },
      ...normalizedHistory,
      {
        role: 'user',
        content: `Chế độ tư vấn: ${selectedMode.label}
Hướng phản hồi: ${selectedMode.instruction}
Mức khó chịu hiện tại: ${safeDistressLevel}/5
Mục tiêu hiện tại: ${userGoal || 'không rõ'}

Ngữ cảnh nhật ký gần đây được phép dùng:
${contextBlock}

Tin nhắn hiện tại của người dùng:
"${trimmedMessage}"

Hãy trả lời theo cấu trúc tự nhiên gồm: ghi nhận cảm xúc, một góc nhìn hoặc câu hỏi nhẹ phù hợp chế độ, và một bước nhỏ có thể làm ngay.`,
      },
    ], { maxTokens: 700 });

    console.log(`[counsel] provider: ${provider}`);
    res.json({ content: text, provider });
  } catch (err) {
    console.error('AI counsel error:', err.message);
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
