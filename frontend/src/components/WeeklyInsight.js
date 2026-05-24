import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { analyzeWeeklyTrend } from '../utils/aiService';
import './WeeklyInsight.css';

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 giờ
const METRIC_LABELS = {
  stress: 'stress',
  energy: 'năng lượng',
  sleep: 'giấc ngủ',
  focus: 'tập trung',
};
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

function dateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function average(values) {
  const valid = values.map(Number).filter(Number.isFinite);
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function normalizeMetric(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(5, Math.max(1, number)) : null;
}

function buildDailyMetricRows(moodLogs) {
  const grouped = moodLogs.reduce((acc, log) => {
    const key = dateKey(log.date);
    if (!key || !log.metrics) return acc;
    if (!acc[key]) {
      acc[key] = {
        key,
        date: log.date,
        stress: [],
        energy: [],
        sleep: [],
        focus: [],
      };
    }
    Object.keys(METRIC_LABELS).forEach(metric => {
      const value = normalizeMetric(log.metrics?.[metric]);
      if (value !== null) acc[key][metric].push(value);
    });
    return acc;
  }, {});

  return Object.values(grouped)
    .map(day => ({
      key: day.key,
      date: day.date,
      stress: average(day.stress),
      energy: average(day.energy),
      sleep: average(day.sleep),
      focus: average(day.focus),
    }))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 21);
}

function buildEvidenceItem(rows, config) {
  const matching = rows.filter(config.when);
  if (matching.length < 2) return null;
  const targetValues = matching.map(row => row[config.target]).filter(Number.isFinite);
  if (targetValues.length < 2) return null;
  const targetAvg = average(targetValues);
  const baselineAvg = average(rows.map(row => row[config.target]).filter(Number.isFinite));
  if (targetAvg === null) return null;
  const difference = baselineAvg === null ? 0 : Math.abs(targetAvg - baselineAvg);
  const directionText = baselineAvg !== null && difference >= 0.25
    ? targetAvg > baselineAvg
      ? `cao hơn mức chung ${baselineAvg.toFixed(1)}/5`
      : `thấp hơn mức chung ${baselineAvg.toFixed(1)}/5`
    : `mức chung ${baselineAvg?.toFixed(1) || '-'}/5`;

  return {
    id: config.id,
    title: config.title,
    text: `${matching.length} ngày gần đây ${config.conditionText} thì ${METRIC_LABELS[config.target]} trung bình ${targetAvg.toFixed(1)}/5, ${directionText}.`,
    detail: config.detail,
    count: matching.length,
    strength: matching.length + difference,
    tone: config.tone,
  };
}

function buildMetricEvidence(moodLogs) {
  const rows = buildDailyMetricRows(moodLogs);
  if (rows.length < 3) return [];

  const configs = [
    {
      id: 'low-sleep-high-stress',
      title: 'Ngủ kém và stress',
      conditionText: 'ngủ <= 2/5',
      target: 'stress',
      tone: 'watch',
      detail: 'Dùng để kiểm tra nhận định kiểu “ngủ kém đi kèm stress cao”.',
      when: row => Number.isFinite(row.sleep) && row.sleep <= 2,
    },
    {
      id: 'high-stress-low-sleep',
      title: 'Stress cao và giấc ngủ',
      conditionText: 'stress >= 4/5',
      target: 'sleep',
      tone: 'watch',
      detail: 'Nếu số này thấp, stress cao có thể đang đi cùng giấc ngủ kém.',
      when: row => Number.isFinite(row.stress) && row.stress >= 4,
    },
    {
      id: 'low-focus-high-stress',
      title: 'Mất tập trung và stress',
      conditionText: 'tập trung <= 2/5',
      target: 'stress',
      tone: 'watch',
      detail: 'Giúp xem những ngày khó tập trung có đang căng hơn bình thường không.',
      when: row => Number.isFinite(row.focus) && row.focus <= 2,
    },
    {
      id: 'low-energy-low-focus',
      title: 'Mệt và tập trung',
      conditionText: 'năng lượng <= 2/5',
      target: 'focus',
      tone: 'neutral',
      detail: 'Có ích để quyết định khi nào nên dùng Pomodoro ngắn.',
      when: row => Number.isFinite(row.energy) && row.energy <= 2,
    },
    {
      id: 'good-energy-good-focus',
      title: 'Năng lượng tốt và tập trung',
      conditionText: 'năng lượng >= 4/5',
      target: 'focus',
      tone: 'good',
      detail: 'Nếu mẫu này rõ, đây là khung dữ liệu tốt cho kế hoạch học.',
      when: row => Number.isFinite(row.energy) && row.energy >= 4,
    },
    {
      id: 'good-sleep-lower-stress',
      title: 'Ngủ ổn và stress',
      conditionText: 'ngủ >= 4/5',
      target: 'stress',
      tone: 'good',
      detail: 'Giúp xem ngủ ổn có đi cùng stress thấp hơn không.',
      when: row => Number.isFinite(row.sleep) && row.sleep >= 4,
    },
  ];

  return configs
    .map(config => buildEvidenceItem(rows, config))
    .filter(Boolean)
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 3);
}

export default function WeeklyInsight() {
  const { moodLogs, MOODS, weeklyInsight, saveWeeklyInsight, userGoal } = useApp();
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
    const goalChanged = cache && cache.goal !== userGoal;

    if (noCache || hasNewLog || expired || goalChanged) {
      fetchInsight();
    }
  }, [moodLogs.length, userGoal]); // eslint-disable-line

  const fetchInsight = async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setLoading(true);
    setError('');
    try {
      const result = await analyzeWeeklyTrend(moodLogs, MOODS, userGoal);
      if (result) {
        setInsight(result);
        saveWeeklyInsight(result, moodLogs.length, userGoal);
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
  const cacheLabel = savedAt
    ? hoursAgo === 0 ? 'Đang dùng kết quả đã lưu - vừa cập nhật' : `Đang dùng kết quả đã lưu - ${hoursAgo}h trước`
    : '';
  const insightSections = buildInsightSections(insight);
  const metricEvidence = buildMetricEvidence(moodLogs);

  return (
    <div className="card weekly-insight">
      <div className="insight-header">
        <h3>🔍 Phân tích xu hướng AI</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {cacheLabel && !loading && (
            <span className="cache-indicator">
              {cacheLabel}
            </span>
          )}
          <button
            className="btn btn-secondary"
            style={{ fontSize: 12, padding: '5px 12px' }}
            onClick={fetchInsight}
            disabled={loading}
            title="Phân tích lại bằng Gemini"
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
        <>
          <div className="insight-section-grid">
            {insightSections.map(section => (
              <div key={section.label} className={`insight-section ${section.tone}`}>
                <h4>{section.label}</h4>
                <p>{section.content}</p>
              </div>
            ))}
          </div>
          <div className="insight-evidence">
            <div className="insight-evidence-head">
              <h4>📌 Bằng chứng từ dữ liệu</h4>
              <span>Không khẳng định nguyên nhân, chỉ là mẫu lặp trong nhật ký.</span>
            </div>
            {metricEvidence.length > 0 ? (
              <div className="evidence-grid">
                {metricEvidence.map(item => (
                  <div key={item.id} className={`evidence-card ${item.tone}`}>
                    <strong>{item.title}</strong>
                    <p>{item.text}</p>
                    <small>{item.detail}</small>
                  </div>
                ))}
              </div>
            ) : (
              <p className="evidence-empty">
                Chưa đủ ngày có chỉ số phụ để tạo bằng chứng đáng tin. Ghi thêm stress, năng lượng, giấc ngủ và tập trung trong vài ngày nữa.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
