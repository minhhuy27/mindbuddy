import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { analyzeWeeklyTrend } from '../utils/aiService';
import './WeeklyInsight.css';

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 giờ
const SECTION_CONFIG = [
  {
    label: 'Xu hướng chính',
    tone: 'trend',
    aliases: ['xu hướng chính', 'xu hướng', 'nhận xét xu hướng', 'tổng quan'],
  },
  {
    label: 'Điểm cần chú ý',
    tone: 'watch',
    aliases: ['điểm cần chú ý', 'điểm chú ý', 'cần chú ý', 'thời điểm thường căng thẳng/vui', 'thời điểm vui', 'thời điểm căng thẳng'],
  },
  {
    label: 'Gợi ý hôm nay',
    tone: 'suggestion',
    aliases: ['gợi ý hôm nay', 'gợi ý', 'gợi ý cải thiện', 'cải thiện'],
  },
];

function normalizeInsightLine(line) {
  return line
    .replace(/^[-•\d.)\s]+/, '')
    .replace(/^phân tích nhanh:\s*/i, '')
    .replace(/\*\*/g, '')
    .trim();
}

function matchSectionLine(line) {
  const normalized = normalizeInsightLine(line);
  for (let index = 0; index < SECTION_CONFIG.length; index += 1) {
    const config = SECTION_CONFIG[index];
    const alias = config.aliases.find(a => normalized.toLowerCase().startsWith(a.toLowerCase()));
    if (alias) {
      return {
        index,
        content: normalized.slice(alias.length).replace(/^[:：\-\s]+/, '').trim(),
      };
    }
  }
  return null;
}

function buildInsightSections(text) {
  if (!text) return [];
  const lines = text
    .split(/\n+/)
    .map(normalizeInsightLine)
    .filter(Boolean)
    .filter(line => !/^phân tích nhanh:?$/i.test(line));

  const sectionContents = SECTION_CONFIG.map(() => []);
  const unmatched = [];
  let currentIndex = -1;

  lines.forEach(line => {
    const match = matchSectionLine(line);
    if (match) {
      currentIndex = match.index;
      if (match.content) sectionContents[currentIndex].push(match.content);
      return;
    }

    if (currentIndex >= 0) {
      sectionContents[currentIndex].push(line);
    } else {
      unmatched.push(line);
    }
  });

  if (sectionContents.some(parts => parts.length > 0)) {
    return SECTION_CONFIG.map((config, index) => ({
      label: config.label,
      tone: config.tone,
      content: sectionContents[index].join(' ').trim() || 'Chưa có dữ liệu đủ rõ cho mục này.',
    }));
  }

  const parts = lines.join(' ')
    .split(/\n+|(?<=[.!?])\s+/)
    .map(part => part.trim())
    .filter(Boolean);

  const fallbackParts = unmatched.length ? unmatched : parts;

  return SECTION_CONFIG.map((config, index) => ({
    label: config.label,
    tone: config.tone,
    content: fallbackParts[index] || (index === 2 ? fallbackParts.slice(2).join(' ') : '') || 'Chưa có dữ liệu đủ rõ cho mục này.',
  }));
}

export default function WeeklyInsight() {
  const { moodLogs, MOODS, weeklyInsight, saveWeeklyInsight } = useApp();
  const [insight, setInsight] = useState(weeklyInsight?.text || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inFlightRef = useRef(false);

  // Đồng bộ khi Firestore load xong (weeklyInsight thay đổi từ null → có data)
  useEffect(() => {
    if (weeklyInsight?.text && !insight) {
      setInsight(weeklyInsight.text);
    }
  }, [weeklyInsight]); // eslint-disable-line

  // Gọi AI khi có log mới hoặc cache hết hạn
  useEffect(() => {
    if (moodLogs.length < 3) return;

    const cache = weeklyInsight;
    const noCache = !cache?.text;
    const hasNewLog = cache && moodLogs.length > (cache.logCount || 0);
    const expired = cache && (Date.now() - (cache.savedAt || 0)) > CACHE_TTL;

    if (noCache || hasNewLog || expired) {
      fetchInsight();
    }
  }, [moodLogs.length]); // eslint-disable-line

  const fetchInsight = async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setLoading(true);
    setError('');
    try {
      const result = await analyzeWeeklyTrend(moodLogs, MOODS);
      if (result) {
        setInsight(result);
        saveWeeklyInsight(result, moodLogs.length);
      } else {
        setError('Chưa thể phân tích lúc này. Vui lòng thử lại sau.');
      }
    } catch (err) {
      console.error('WeeklyInsight error:', err);
      setError('AI phản hồi quá lâu hoặc đang lỗi. Vui lòng thử lại sau.');
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  };

  if (moodLogs.length < 3) return null;

  const savedAt = weeklyInsight?.savedAt;
  const hoursAgo = savedAt ? Math.floor((Date.now() - savedAt) / (1000 * 60 * 60)) : null;
  const insightSections = buildInsightSections(insight);

  return (
    <div className="card weekly-insight">
      <div className="insight-header">
        <h3>🔍 Phân tích xu hướng AI</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {hoursAgo !== null && !loading && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {hoursAgo === 0 ? 'Vừa cập nhật' : `${hoursAgo}h trước`}
            </span>
          )}
          <button
            className="btn btn-secondary"
            style={{ fontSize: 12, padding: '5px 12px' }}
            onClick={fetchInsight}
            disabled={loading}
            title="Phân tích lại bằng DeepSeek V4 Flash"
          >
            {loading ? '⏳' : '🔄 Cập nhật'}
          </button>
        </div>
      </div>
      {loading && (
        <div className="weekly-status">
          <span className="weekly-status-title">AI đang phân tích cảm xúc của bạn</span>
          <span>Việc này có thể mất vài chục giây nếu model đang bận.</span>
        </div>
      )}
      {error && !loading && (
        <div className="weekly-error">
          <span>{error}</span>
          <button className="btn btn-secondary" onClick={fetchInsight}>Thử lại</button>
        </div>
      )}
      {insight && !loading && (
        <div className="insight-section-grid">
          {insightSections.map(section => (
            <div key={section.label} className={`insight-section ${section.tone}`}>
              <h4>{section.label}</h4>
              <p>{section.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
