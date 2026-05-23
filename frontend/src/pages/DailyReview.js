import React from 'react';
import { Link } from 'react-router-dom';
import { format, subDays } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useApp } from '../context/AppContext';
import { reviewDay } from '../utils/aiService';
import './DailyReview.css';

const METRIC_FIELDS = [
  { id: 'stress', label: 'Stress', goodLow: true },
  { id: 'energy', label: 'Năng lượng' },
  { id: 'sleep', label: 'Giấc ngủ' },
  { id: 'focus', label: 'Tập trung' },
];

const AFTER_FEELING_LABELS = {
  clearer: 'Rõ hơn',
  same: 'Như cũ',
  tired: 'Mệt hơn',
  stressed: 'Căng hơn',
};

function keyForDate(date) {
  return format(date, 'yyyy-MM-dd');
}

function sameDateKey(value, dateKey) {
  if (!value) return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime()) && keyForDate(d) === dateKey;
}

function formatTime(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '--:--' : format(d, 'HH:mm');
}

function normalizeMetrics(metrics) {
  if (!metrics) return null;
  return METRIC_FIELDS.reduce((acc, field) => {
    const value = Number(metrics[field.id]);
    if (Number.isFinite(value)) acc[field.id] = Math.min(5, Math.max(1, value));
    return acc;
  }, {});
}

function average(values) {
  const valid = values.map(Number).filter(Number.isFinite);
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function cleanNote(note = '') {
  return note.replace(/\s*\[.+\]$/, '').trim();
}

function extractCauses(note = '') {
  return note.match(/\[(.+)\]$/)?.[1]?.split(', ').filter(Boolean) || [];
}

function buildPomodoroKey(user) {
  return `mb_pomodoro_mood_sessions_${user?.uid || user?.email || 'guest'}`;
}

function readPomodoroSessions(user) {
  try {
    return JSON.parse(localStorage.getItem(buildPomodoroKey(user)) || '[]');
  } catch {
    return [];
  }
}

function buildSignature(entries, pomodoros) {
  return JSON.stringify({
    entries: entries.map(e => ({
      time: e.time,
      moodLabel: e.moodLabel,
      moodScore: e.moodScore,
      note: e.note,
      causes: e.causes,
      metrics: e.metrics,
    })),
    pomodoros: pomodoros.map(p => ({
      time: p.time,
      durationMin: p.durationMin,
      focusBefore: p.focusBefore,
      focusAfter: p.focusAfter,
      afterFeeling: p.afterFeeling,
      afterNote: p.afterNote,
    })),
  });
}

function stripAiNoise(text) {
  return String(text || '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .trim();
}

function tryParseJson(value) {
  if (!value || typeof value !== 'string') return null;
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

function parseReviewObject(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  const cleaned = stripAiNoise(value);
  const direct = tryParseJson(cleaned);
  if (direct) return direct;
  const candidates = extractJsonCandidates(cleaned);
  for (let i = candidates.length - 1; i >= 0; i--) {
    const parsed = tryParseJson(candidates[i]);
    if (parsed && (parsed.summary || parsed.bestMoment || parsed.stressor || parsed.tomorrowStep)) return parsed;
  }
  return null;
}

function cleanReviewField(value) {
  if (typeof value !== 'string') return '';
  const cleaned = stripAiNoise(value)
    .replace(/^["']|["']$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned || /<think/i.test(cleaned)) return '';
  if (cleaned.startsWith('{') || cleaned.endsWith('}')) return '';
  return cleaned;
}

function normalizeReview(value, fallback) {
  let source = parseReviewObject(value);
  if (source?.summary && !source.bestMoment && !source.stressor && !source.tomorrowStep) {
    source = parseReviewObject(source.summary) || source;
  }
  source = source && typeof source === 'object' ? source : {};
  return {
    summary: cleanReviewField(source.summary) || fallback.summary,
    bestMoment: cleanReviewField(source.bestMoment) || fallback.bestMoment,
    stressor: cleanReviewField(source.stressor) || fallback.stressor,
    tomorrowStep: cleanReviewField(source.tomorrowStep) || fallback.tomorrowStep,
  };
}

function buildLocalReview(entries, pomodoros) {
  if (!entries.length && !pomodoros.length) {
    return {
      summary: 'Chưa có dữ liệu để nhìn lại ngày này.',
      bestMoment: 'Hãy ghi một check-in ngắn hoặc hoàn thành một phiên tập trung để MindBuddy có dữ liệu.',
      stressor: 'Chưa thấy yếu tố gây căng thẳng rõ ràng.',
      tomorrowStep: 'Ngày mai thử ghi cảm xúc một lần vào buổi sáng và một lần vào buổi tối.',
    };
  }

  const scoredEntries = entries.map(entry => {
    const metrics = entry.metrics || {};
    const moodScore = Number(entry.moodScore) || 3;
    const stress = Number(metrics.stress);
    const energy = Number(metrics.energy);
    const focus = Number(metrics.focus);
    const sleep = Number(metrics.sleep);
    return {
      ...entry,
      positiveScore:
        moodScore +
        (Number.isFinite(energy) ? energy * 0.18 : 0) +
        (Number.isFinite(focus) ? focus * 0.12 : 0) +
        (Number.isFinite(sleep) ? sleep * 0.08 : 0) -
        (Number.isFinite(stress) ? stress * 0.14 : 0),
      pressureScore:
        (Number.isFinite(stress) ? stress : 3) +
        (6 - moodScore) * 0.45 +
        (Number.isFinite(energy) ? (5 - energy) * 0.16 : 0) +
        (Number.isFinite(focus) ? (5 - focus) * 0.12 : 0),
    };
  });

  const bestEntry = [...scoredEntries].sort((a, b) => b.positiveScore - a.positiveScore)[0];
  const pressureEntry = [...scoredEntries].sort((a, b) => b.pressureScore - a.pressureScore)[0];
  const reviewedPomodoros = pomodoros.filter(p => Number.isFinite(Number(p.focusAfter)));
  const bestPomodoro = [...reviewedPomodoros]
    .sort((a, b) => (Number(b.focusAfter) - Number(b.focusBefore || 0)) - (Number(a.focusAfter) - Number(a.focusBefore || 0)))[0];

  const avgStress = average(entries.map(e => e.metrics?.stress));
  const avgEnergy = average(entries.map(e => e.metrics?.energy));
  const avgSleep = average(entries.map(e => e.metrics?.sleep));
  const avgFocus = average(entries.map(e => e.metrics?.focus));

  const bestMoment = bestEntry
    ? `${bestEntry.time}, bạn có vẻ ổn nhất với cảm xúc “${bestEntry.moodLabel}”${bestPomodoro && Number(bestPomodoro.focusAfter) > Number(bestPomodoro.focusBefore || 0) ? `; phiên Pomodoro lúc ${bestPomodoro.time} cũng giúp tập trung tăng từ ${bestPomodoro.focusBefore}/5 lên ${bestPomodoro.focusAfter}/5` : ''}.`
    : bestPomodoro
      ? `Phiên Pomodoro lúc ${bestPomodoro.time} là điểm sáng, tập trung tăng từ ${bestPomodoro.focusBefore}/5 lên ${bestPomodoro.focusAfter}/5.`
      : 'Chưa có khoảnh khắc tích cực rõ ràng, nhưng việc bạn ghi lại ngày hôm nay đã là một tín hiệu tốt.';

  const causeText = pressureEntry?.causes?.length ? `, liên quan tới ${pressureEntry.causes.join(', ')}` : '';
  const stressor = pressureEntry
    ? `${pressureEntry.time} có vẻ là đoạn căng hơn trong ngày với “${pressureEntry.moodLabel}”${causeText}${pressureEntry.metrics?.stress ? `, stress ${pressureEntry.metrics.stress}/5` : ''}.`
    : avgStress && avgStress >= 4
      ? `Stress trung bình hôm nay khá cao (${avgStress.toFixed(1)}/5), nhưng chưa có ghi chú đủ rõ để xác định nguyên nhân.`
      : 'Chưa thấy yếu tố làm bạn căng hơn một cách rõ ràng.';

  let tomorrowStep = 'Ngày mai thử ghi một check-in ngắn sau bữa trưa để bắt được nhịp cảm xúc giữa ngày.';
  if (avgSleep && avgSleep <= 2.5) {
    tomorrowStep = 'Ngày mai ưu tiên một việc nhỏ cho giấc ngủ: đặt giờ dừng màn hình sớm hơn 20 phút.';
  } else if (avgStress && avgStress >= 4) {
    tomorrowStep = 'Ngày mai thử chèn một khoảng thở 2 phút trước việc dễ gây áp lực nhất.';
  } else if (avgFocus && avgFocus <= 2.5) {
    tomorrowStep = 'Ngày mai bắt đầu bằng một Pomodoro 15 phút thay vì ép mình học dài ngay từ đầu.';
  } else if (avgEnergy && avgEnergy <= 2.5) {
    tomorrowStep = 'Ngày mai chọn một việc nhẹ nhất để khởi động, rồi mới quyết định có làm tiếp hay không.';
  }

  return {
    summary: `Ngày này có ${entries.length} check-in${pomodoros.length ? ` và ${pomodoros.length} phiên Pomodoro` : ''}. ${avgStress ? `Stress trung bình ${avgStress.toFixed(1)}/5.` : 'Chỉ số phụ chưa đủ nhiều.'}`,
    bestMoment,
    stressor,
    tomorrowStep,
  };
}

export default function DailyReview() {
  const {
    user, moodLogs, MOODS, customMoods, userGoal,
    dailyReviews, saveDailyReview,
  } = useApp();
  const [selectedDateKey, setSelectedDateKey] = React.useState(keyForDate(new Date()));
  const [loading, setLoading] = React.useState(false);
  const [attemptedKey, setAttemptedKey] = React.useState('');
  const [notice, setNotice] = React.useState('');

  const allMoods = React.useMemo(
    () => [...MOODS, ...(customMoods || [])],
    [MOODS, customMoods]
  );

  const pomodoroSessions = React.useMemo(() => readPomodoroSessions(user), [user]);

  const dateOptions = React.useMemo(() => (
    Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), i);
      return {
        key: keyForDate(date),
        label: i === 0 ? 'Hôm nay' : i === 1 ? 'Hôm qua' : format(date, 'EEE dd/MM', { locale: vi }),
      };
    })
  ), []);

  const selectedDate = React.useMemo(() => {
    const date = new Date(`${selectedDateKey}T12:00:00`);
    return Number.isNaN(date.getTime()) ? new Date() : date;
  }, [selectedDateKey]);

  const dayLogs = React.useMemo(() => (
    moodLogs
      .filter(log => sameDateKey(log.date, selectedDateKey))
      .sort((a, b) => new Date(a.date) - new Date(b.date))
  ), [moodLogs, selectedDateKey]);

  const dayPomodoros = React.useMemo(() => (
    pomodoroSessions
      .filter(session => sameDateKey(session.completedAt || session.date, selectedDateKey))
      .sort((a, b) => new Date(a.completedAt || a.date) - new Date(b.completedAt || b.date))
      .map(session => ({
        id: session.id,
        time: formatTime(session.completedAt || session.date),
        durationMin: session.durationMin || 25,
        focusBefore: session.focusBefore,
        focusAfter: session.focusAfter,
        afterFeeling: AFTER_FEELING_LABELS[session.afterFeeling] || session.afterFeeling || '',
        afterNote: session.afterNote || '',
      }))
  ), [pomodoroSessions, selectedDateKey]);

  const entries = React.useMemo(() => (
    dayLogs.map(log => {
      const mood = allMoods.find(m => m.id === log.mood);
      return {
        id: log.id,
        time: formatTime(log.date),
        moodLabel: mood?.label || 'Không rõ',
        moodEmoji: mood?.emoji || '',
        moodColor: mood?.color || '#a29bfe',
        moodScore: mood?.score || 3,
        note: cleanNote(log.note || ''),
        causes: extractCauses(log.note || ''),
        metrics: normalizeMetrics(log.metrics),
        imageUrl: log.image?.url || log.imageUrl || '',
      };
    })
  ), [dayLogs, allMoods]);

  const signature = React.useMemo(() => buildSignature(entries, dayPomodoros), [entries, dayPomodoros]);
  const cached = dailyReviews?.[selectedDateKey];
  const hasFreshCache = cached?.signature === signature;
  const localReview = React.useMemo(() => buildLocalReview(entries, dayPomodoros), [entries, dayPomodoros]);
  const review = React.useMemo(
    () => hasFreshCache ? normalizeReview(cached.review, localReview) : localReview,
    [cached, hasFreshCache, localReview]
  );
  const hasData = entries.length > 0 || dayPomodoros.length > 0;

  const averages = React.useMemo(() => (
    METRIC_FIELDS.map(field => ({
      ...field,
      value: average(entries.map(e => e.metrics?.[field.id])),
    }))
  ), [entries]);

  const timeline = React.useMemo(() => {
    const moodEvents = entries.map(entry => ({
      type: 'mood',
      time: entry.time,
      sortTime: entry.time,
      title: `${entry.moodEmoji} ${entry.moodLabel}`,
      detail: entry.note || 'Không có ghi chú thêm.',
      color: entry.moodColor,
      imageUrl: entry.imageUrl,
    }));
    const pomodoroEvents = dayPomodoros.map(session => ({
      type: 'pomodoro',
      time: session.time,
      sortTime: session.time,
      title: `🍅 Pomodoro ${session.durationMin} phút`,
      detail: session.focusAfter
        ? `Tập trung ${session.focusBefore || '-'}/5 → ${session.focusAfter}/5${session.afterFeeling ? `, ${session.afterFeeling.toLowerCase()}` : ''}.`
        : `Tập trung trước phiên ${session.focusBefore || '-'}/5, chưa ghi cảm nhận sau phiên.`,
      color: '#fd79a8',
    }));
    return [...moodEvents, ...pomodoroEvents].sort((a, b) => a.sortTime.localeCompare(b.sortTime));
  }, [entries, dayPomodoros]);

  const generateAiReview = React.useCallback(async (manual = false) => {
    if (!hasData || loading) return;
    setLoading(true);
    setNotice(manual ? 'Đang tạo lại bản nhìn ngày bằng AI...' : '');
    const aiReview = await reviewDay({
      date: format(selectedDate, 'dd/MM/yyyy'),
      entries,
      pomodoros: dayPomodoros,
      userGoal,
    });
    if (aiReview) {
      const normalizedReview = normalizeReview(aiReview, localReview);
      await saveDailyReview(selectedDateKey, {
        review: normalizedReview,
        signature,
        source: 'ai',
        savedAt: Date.now(),
      });
      setNotice(manual ? 'Đã cập nhật bản nhìn lại ngày.' : '');
    } else if (manual) {
      setNotice('AI chưa phản hồi được, MindBuddy đang dùng bản tóm tắt nhanh từ dữ liệu của bạn.');
    }
    setLoading(false);
  }, [dayPomodoros, entries, hasData, loading, localReview, saveDailyReview, selectedDate, selectedDateKey, signature, userGoal]);

  React.useEffect(() => {
    if (!hasData || hasFreshCache) return;
    const key = `${selectedDateKey}|${signature}`;
    if (attemptedKey === key) return;
    setAttemptedKey(key);
    generateAiReview(false);
  }, [attemptedKey, generateAiReview, hasData, hasFreshCache, selectedDateKey, signature]);

  return (
    <div className="daily-review-page">
      <section className="daily-review-hero">
        <div>
          <span className="daily-review-kicker">Nhìn lại ngày</span>
          <h1>{format(selectedDate, "EEEE, dd/MM/yyyy", { locale: vi })}</h1>
          <p>MindBuddy gom check-in, chỉ số phụ và Pomodoro để rút ra điều đáng nhớ nhất trong ngày.</p>
        </div>
        <div className="daily-review-hero-stats" aria-label="Tổng quan dữ liệu ngày">
          <div><strong>{entries.length}</strong><span>Check-in</span></div>
          <div><strong>{dayPomodoros.length}</strong><span>Pomodoro</span></div>
          <div><strong>{hasFreshCache ? 'AI' : 'Nhanh'}</strong><span>Bản tóm tắt</span></div>
        </div>
      </section>

      <div className="daily-review-date-strip" aria-label="Chọn ngày để nhìn lại">
        {dateOptions.map(option => (
          <button
            key={option.key}
            className={selectedDateKey === option.key ? 'active' : ''}
            onClick={() => {
              setSelectedDateKey(option.key);
              setNotice('');
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      {!hasData ? (
        <section className="card daily-review-empty">
          <div className="empty-icon" aria-hidden="true">🪞</div>
          <h3>Ngày này chưa có gì để nhìn lại</h3>
          <p>Ghi một check-in hoặc hoàn thành Pomodoro, trang này sẽ tự tạo bản tóm tắt cho bạn.</p>
          <div className="daily-review-empty-actions">
            <Link className="btn btn-primary" to="/mood">Ghi cảm xúc</Link>
            <Link className="btn btn-secondary" to="/pomodoro">Bắt đầu Pomodoro</Link>
          </div>
        </section>
      ) : (
        <>
          <section className="daily-review-grid">
            <div className="card daily-review-summary-card">
              <div className="daily-review-card-head">
                <div>
                  <h3>Tóm tắt ngắn</h3>
                  <p className="text-muted">{hasFreshCache ? 'Đã tinh chỉnh bằng AI.' : 'Bản tóm tắt nhanh từ dữ liệu hiện có.'}</p>
                </div>
                <button className="btn btn-secondary" onClick={() => generateAiReview(true)} disabled={loading}>
                  {loading ? 'Đang tạo...' : 'Tạo lại bằng AI'}
                </button>
              </div>
              <p className="daily-review-summary">{review.summary}</p>
              {notice && <p className="daily-review-notice" role="status">{notice}</p>}
            </div>

            <div className="daily-review-metrics">
              {averages.map(metric => (
                <div key={metric.id} className="metric-tile">
                  <span>{metric.label}</span>
                  <strong>{metric.value ? metric.value.toFixed(1) : '-'}/5</strong>
                  <div className="metric-tile-bar" aria-hidden="true">
                    <i style={{ width: `${metric.value ? (metric.value / 5) * 100 : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="daily-review-answer-grid">
            <article className="review-answer-card best">
              <span>Ổn nhất lúc nào?</span>
              <p>{review.bestMoment}</p>
            </article>
            <article className="review-answer-card pressure">
              <span>Điều gì làm căng hơn?</span>
              <p>{review.stressor}</p>
            </article>
            <article className="review-answer-card next">
              <span>Thử ngày mai</span>
              <p>{review.tomorrowStep}</p>
            </article>
          </section>

          <section className="daily-review-detail-grid">
            <div className="card">
              <h3 className="mb-3">Dòng thời gian</h3>
              <div className="daily-review-timeline">
                {timeline.map((event, index) => (
                  <div key={`${event.type}-${event.time}-${index}`} className="timeline-item" style={{ '--event-color': event.color }}>
                    <time>{event.time}</time>
                    <div>
                      <strong>{event.title}</strong>
                      <p>{event.detail}</p>
                      {event.imageUrl && <img className="daily-timeline-photo" src={event.imageUrl} alt={`Ảnh check-in lúc ${event.time}`} />}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card daily-review-notes-card">
              <h3 className="mb-3">Ghi chú trong ngày</h3>
              {entries.length === 0 ? (
                <p className="text-muted">Không có ghi chú cảm xúc trong ngày này.</p>
              ) : (
                <div className="daily-note-list">
                  {entries.map(entry => (
                    <div key={entry.id} className="daily-note-item" style={{ '--note-color': entry.moodColor }}>
                      <div>
                        <strong>{entry.moodEmoji} {entry.moodLabel}</strong>
                        <span>{entry.time}</span>
                      </div>
                      {entry.causes.length > 0 && (
                        <div className="daily-note-tags">
                          {entry.causes.map(cause => <span key={cause}>{cause}</span>)}
                        </div>
                      )}
                      <p>{entry.note || 'Không có ghi chú thêm.'}</p>
                      {entry.imageUrl && <img className="daily-note-photo" src={entry.imageUrl} alt={`Ảnh check-in lúc ${entry.time}`} />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
