/**
 * aiClient.js — Dual AI provider với tự động fallback
 *
 * Primary  : Gemini 3.6 Flash
 * Fallback : Groq (openai/gpt-oss-20b) — phản hồi nhanh khi Gemini lỗi hoặc quá tải
 */

const Groq = require('groq-sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

// Xóa phần suy luận nội bộ nếu model trả về trong thẻ <think>.
function stripThinking(text) {
  return (text || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

// Xóa Markdown formatting — áp dụng cho cả Groq lẫn Gemini
function stripMarkdown(text) {
  if (!text) return '';
  // Xử lý **bold**: split theo '**', các phần lẻ (index 1,3,5...) là nội dung bold → giữ lại
  const parts = text.split('**');
  let result = parts.join(''); // bỏ tất cả dấu **

  // Xử lý *italic* (single star, không phải **)
  result = result.replace(/(?<!\*)\*(?!\*)([^*\n]+?)(?<!\*)\*(?!\*)/g, '$1');

  return result
    .replace(/^#{1,6}\s+/gm, '')   // xóa heading ##
    .replace(/`[^`]+`/g, '')        // xóa inline code
    .replace(/[ \t]+\n/g, '\n')     // trailing spaces
    .replace(/\n{3,}/g, '\n\n')     // dòng trống thừa
    .trim();
}

function cleanResponse(text) {
  return stripMarkdown(stripThinking(text));
}

// ── Gemini call ────────────────────────────────────────────────────────────
async function callGemini(messages) {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  // Chuyển đổi format chat chuẩn sang Gemini
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

// ── Hàm chính: gọi Gemini trước, fallback Groq nếu lỗi/rate limit ────────
async function chat(messages, { maxTokens } = {}) {
  try {
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
      throw new Error('Gemini API key not configured');
    }
    const text = await callGemini(messages);
    return { text: cleanResponse(text), provider: 'gemini', model: GEMINI_MODEL };
  } catch (geminiErr) {
    console.warn(`[AI] Gemini failed (${geminiErr.message}), falling back to Groq...`);

    if (!process.env.GROQ_API_KEY) {
      throw new Error(`Gemini failed and Groq API key not configured. Gemini error: ${geminiErr.message}`);
    }

    try {
      const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
      const opts = { model: GROQ_MODEL, messages };
      if (maxTokens) opts.max_tokens = maxTokens;
      const response = await client.chat.completions.create(opts);
      const text = cleanResponse(response.choices[0].message.content);
      return { text, provider: 'groq', model: GROQ_MODEL };
    } catch (groqErr) {
      console.error(`[AI] Groq fallback also failed: ${groqErr.message}`);
      throw new Error(`Both providers failed. Gemini: ${geminiErr.message} | Groq: ${groqErr.message}`);
    }
  }
}

// ── Phân tích sâu dùng cùng policy Gemini -> Groq ────────────────────────
async function chatAnalyze(messages, { maxTokens } = {}) {
  return chat(messages, { maxTokens });
}

async function chatGemini(messages, { maxTokens } = {}) {
  return chat(messages, { maxTokens });
}

module.exports = { chat, chatAnalyze, chatGemini, stripThinking };
