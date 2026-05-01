/**
 * aiClient.js — Dual AI provider với tự động fallback
 *
 * Primary  : Groq (qwen/qwen3-32b)  — nhanh, miễn phí
 * Fallback : Gemini 2.5 Flash       — tiếng Việt tốt hơn, dùng khi Groq lỗi/rate limit
 */

const Groq = require('groq-sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const GROQ_MODEL   = 'qwen/qwen3-32b';
const GEMINI_MODEL = 'gemini-2.5-flash';

// Xóa phần <think>...</think> mà Qwen3 sinh ra
function stripThinking(text) {
  return (text || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

// Xóa Markdown formatting (**, *, ##, ###, v.v.) từ response Gemini
function stripMarkdown(text) {
  return (text || '')
    .replace(/\*\*([^*\n]+)\*\*/g, '$1') // **bold** → bold (không cross line)
    .replace(/\*([^*\n]+)\*/g, '$1')      // *italic* → italic
    .replace(/^#{1,6} /gm, '')            // ### heading → bỏ dấu #
    .replace(/`{1,3}[^`\n]*`{1,3}/g, '') // `code` → xóa
    .replace(/[ \t]+\n/g, '\n')           // xóa trailing space trước newline
    .replace(/\n{3,}/g, '\n\n')           // gộp nhiều dòng trống
    .trim();
}

function cleanResponse(text) {
  return stripMarkdown(stripThinking(text));
}

// ── Groq call ──────────────────────────────────────────────────────────────
async function callGroq(messages) {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY not set');
  const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const response = await client.chat.completions.create({
    model: GROQ_MODEL,
    messages,
  });
  return stripThinking(response.choices[0].message.content);
}

// ── Gemini call ────────────────────────────────────────────────────────────
async function callGemini(messages) {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  // Chuyển đổi format OpenAI → Gemini
  // Tách system prompt ra khỏi messages
  const systemMsg = messages.find(m => m.role === 'system');
  const chatMsgs  = messages.filter(m => m.role !== 'system');

  // Gemini dùng systemInstruction riêng
  const modelWithSystem = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: systemMsg?.content || '',
  });

  // Chuyển history (tất cả trừ tin cuối) sang format Gemini
  const history = chatMsgs.slice(0, -1).map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const lastMsg = chatMsgs[chatMsgs.length - 1];
  const chat = modelWithSystem.startChat({ history });
  const result = await chat.sendMessage(lastMsg?.content || '');
  return result.response.text();
}

// ── Hàm chính: gọi Groq trước, fallback Gemini nếu lỗi ───────────────────
async function chat(messages, { maxTokens } = {}) {
  const groqMessages = messages;

  try {
    if (process.env.GROQ_API_KEY) {
      const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
      const opts = {
        model: GROQ_MODEL,
        messages: groqMessages,
      };
      if (maxTokens) opts.max_tokens = maxTokens;

      const response = await client.chat.completions.create(opts);
      const text = cleanResponse(response.choices[0].message.content);
      return { text, provider: 'groq' };
    }
    throw new Error('No Groq key');
  } catch (groqErr) {
    console.warn(`[AI] Groq failed (${groqErr.message}), falling back to Gemini...`);

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
      throw new Error(`Groq failed and Gemini API key not configured. Groq error: ${groqErr.message}`);
    }

    try {
      const text = await callGemini(messages);
      return { text: cleanResponse(text), provider: 'gemini' };
    } catch (geminiErr) {
      console.error(`[AI] Gemini also failed: ${geminiErr.message}`);
      throw new Error(`Both providers failed. Groq: ${groqErr.message} | Gemini: ${geminiErr.message}`);
    }
  }
}

// ── Hàm dùng Gemini trực tiếp (cho tác vụ phân tích sâu), fallback Groq ──
async function chatGemini(messages, { maxTokens } = {}) {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
    console.warn('[AI] Gemini key not configured, using Groq instead...');
    return chat(messages, { maxTokens });
  }

  try {
    const text = await callGemini(messages);
    return { text: cleanResponse(text), provider: 'gemini' };
  } catch (geminiErr) {
    console.warn(`[AI] Gemini failed (${geminiErr.message}), falling back to Groq...`);
    try {
      const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
      const opts = { model: GROQ_MODEL, messages };
      if (maxTokens) opts.max_tokens = maxTokens;
      const response = await client.chat.completions.create(opts);
      const text = cleanResponse(response.choices[0].message.content);
      return { text, provider: 'groq-fallback' };
    } catch (groqErr) {
      console.error(`[AI] Groq fallback also failed: ${groqErr.message}`);
      throw new Error(`Both providers failed. Gemini: ${geminiErr.message} | Groq: ${groqErr.message}`);
    }
  }
}

module.exports = { chat, chatGemini, stripThinking };
