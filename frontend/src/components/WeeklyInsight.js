import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { analyzeWeeklyTrend } from '../utils/aiService';
import './WeeklyInsight.css';

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 giờ

export default function WeeklyInsight() {
  const { moodLogs, MOODS, weeklyInsight, saveWeeklyInsight } = useApp();
  const [insight, setInsight] = useState(weeklyInsight?.text || '');
  const [loading, setLoading] = useState(false);

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
    if (loading) return;
    setLoading(true);
    try {
      const result = await analyzeWeeklyTrend(moodLogs, MOODS);
      if (result) {
        setInsight(result);
        saveWeeklyInsight(result, moodLogs.length);
      }
    } catch (err) {
      console.error('WeeklyInsight error:', err);
    }
    setLoading(false);
  };

  if (moodLogs.length < 3) return null;

  const savedAt = weeklyInsight?.savedAt;
  const hoursAgo = savedAt ? Math.floor((Date.now() - savedAt) / (1000 * 60 * 60)) : null;

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
            title="Phân tích lại bằng Gemini AI"
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
