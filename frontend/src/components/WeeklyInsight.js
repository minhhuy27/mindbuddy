import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { analyzeWeeklyTrend } from '../utils/aiService';
import './WeeklyInsight.css';

export default function WeeklyInsight() {
  const { moodLogs, MOODS } = useApp();
  const [insight, setInsight] = useState(() => sessionStorage.getItem('mb_weekly_insight') || '');
  const [loading, setLoading] = useState(false);

  // Tự động phân tích nếu chưa có insight tuần này
  useEffect(() => {
    const weekKey = `mb_insight_week_${getWeekKey()}`;
    if (!sessionStorage.getItem(weekKey) && moodLogs.length >= 3 && !insight) {
      fetchInsight(weekKey);
    }
  }, [moodLogs.length]);

  function getWeekKey() {
    const d = new Date();
    const start = new Date(d.setDate(d.getDate() - d.getDay()));
    return start.toDateString();
  }

  const fetchInsight = async (weekKey) => {
    setLoading(true);
    const result = await analyzeWeeklyTrend(moodLogs, MOODS);
    if (result) {
      setInsight(result);
      sessionStorage.setItem('mb_weekly_insight', result);
      sessionStorage.setItem(weekKey || `mb_insight_week_${getWeekKey()}`, '1');
    }
    setLoading(false);
  };

  if (moodLogs.length < 3) return null;

  return (
    <div className="card weekly-insight">
      <div className="insight-header">
        <h3>🔍 Phân tích xu hướng AI</h3>
        <button className="btn btn-secondary" style={{ fontSize: 12, padding: '5px 12px' }}
          onClick={() => fetchInsight()} disabled={loading}>
          {loading ? '⏳' : '🔄 Cập nhật'}
        </button>
      </div>
      {loading && <p className="text-muted" style={{ fontSize: 13, fontStyle: 'italic' }}>🤖 AI đang phân tích cảm xúc của bạn...</p>}
      {insight && !loading && <p className="insight-text">{insight}</p>}
    </div>
  );
}
