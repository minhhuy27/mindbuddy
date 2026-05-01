import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { analyzeWeeklyTrend } from '../utils/aiService';
import './WeeklyInsight.css';

const CACHE_KEY   = 'mb_weekly_insight';
const CACHE_TTL   = 24 * 60 * 60 * 1000; // 24 giờ tính bằng ms

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { text, savedAt, logCount } = JSON.parse(raw);
    const expired = Date.now() - savedAt > CACHE_TTL;
    if (expired) { localStorage.removeItem(CACHE_KEY); return null; }
    return { text, logCount };
  } catch {
    return null;
  }
}

function saveCache(text, logCount) {
  localStorage.setItem(CACHE_KEY, JSON.stringify({
    text,
    logCount,
    savedAt: Date.now(),
  }));
}

export default function WeeklyInsight() {
  const { moodLogs, MOODS } = useApp();
  const [insight, setInsight] = useState('');
  const [loading, setLoading] = useState(false);
  const [cachedAt, setCachedAt] = useState(null);

  // Khởi tạo từ cache khi mount
  useEffect(() => {
    const cache = loadCache();
    if (cache) {
      setInsight(cache.text);
      try {
        const { savedAt } = JSON.parse(localStorage.getItem(CACHE_KEY));
        setCachedAt(savedAt);
      } catch {}
    }
  }, []);

  // Tự động gọi AI khi có log mới (moodLogs.length tăng)
  // Vẫn dùng cache để tránh gọi lại khi chỉ reload trang
  useEffect(() => {
    if (moodLogs.length < 3) return;

    const cache = loadCache();
    const noCache = !cache;
    const hasNewLog = cache && moodLogs.length > cache.logCount;

    if (noCache || hasNewLog) {
      fetchInsight();
    }
  }, [moodLogs.length]); // eslint-disable-line

  const fetchInsight = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const result = await analyzeWeeklyTrend(moodLogs, MOODS);
      if (result) {
        setInsight(result);
        saveCache(result, moodLogs.length);
        setCachedAt(Date.now());
      }
    } catch (err) {
      console.error('WeeklyInsight error:', err);
    }
    setLoading(false);
  };

  if (moodLogs.length < 3) return null;

  const hoursAgo = cachedAt
    ? Math.floor((Date.now() - cachedAt) / (1000 * 60 * 60))
    : null;

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
            title="Gọi Gemini AI để phân tích lại (tốn quota)"
          >
            {loading ? '⏳' : '🔄 Cập nhật'}
          </button>
        </div>
      </div>
      {loading && (
        <p className="text-muted" style={{ fontSize: 13, fontStyle: 'italic' }}>
          🤖 AI đang phân tích cảm xúc của bạn...
        </p>
      )}
      {insight && !loading && <p className="insight-text">{insight}</p>}
    </div>
  );
}
