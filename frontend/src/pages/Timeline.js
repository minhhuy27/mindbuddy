import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useApp } from '../context/AppContext';
import RichText from '../components/RichText';
import { causeTagStyle, causeTagTitle } from '../utils/causeTags';
import { displayAttachmentName, normalizeMoodAttachments } from '../utils/moodImages';
import './Timeline.css';

const FILTERS = [
  { id: 'all', icon: '🧭', label: 'Tất cả' },
  { id: 'mood', icon: '💭', label: 'Check-in' },
  { id: 'media', icon: '🖼️', label: 'Ký ức' },
  { id: 'positive', icon: '✨', label: 'Điều tốt' },
  { id: 'review', icon: '🪞', label: 'Nhìn lại' },
  { id: 'pomodoro', icon: '🍅', label: 'Pomodoro' },
  { id: 'pinned', icon: '★', label: 'Đã ghim' },
];

const VIEW_DETAILS = {
  all: {
    title: 'Trục thời gian cuộc sống trong MindBuddy',
    description: 'Gom check-in, note, ảnh/video/audio, Pomodoro và bản nhìn lại ngày vào một dòng thời gian duy nhất để bạn đọc lại đúng bối cảnh.',
    note: 'Timeline là nơi xem tổng hợp. Ký ức, Điều tốt và Nhìn lại giờ là các bộ lọc nhanh trong cùng một màn hình.',
  },
  mood: {
    title: 'Lịch sử check-in theo dòng thời gian',
    description: 'Chỉ hiển thị các lần ghi cảm xúc, nguyên nhân, chỉ số phụ và note trong ngày.',
    note: 'Dùng view này khi bạn muốn đọc nhật ký cảm xúc liên tục mà không bị lẫn media hoặc Pomodoro.',
  },
  media: {
    title: 'Ký ức bằng ảnh, video và âm thanh',
    description: 'Lọc các check-in có tệp đính kèm để xem lại bối cảnh sống động hơn.',
    note: 'Đây là view thay cho việc phải mở riêng trang Ký ức khi bạn chỉ muốn xem media.',
  },
  positive: {
    title: 'Điều mình cần nhớ',
    description: 'Gom các check-in tích cực, note đã ghim và những khoảnh khắc có tín hiệu tốt.',
    note: 'Khi thấy xuống tinh thần, mở view này để đọc lại các ngày mình đã ổn hơn.',
  },
  review: {
    title: 'Nhìn lại ngày trong Timeline',
    description: 'Hiển thị các bản tóm tắt ngày đã tạo và gợi ý tạo review cho ngày có check-in.',
    note: 'View này thay cho việc phải nhớ mở riêng trang Nhìn lại để kiểm tra từng ngày.',
  },
  pomodoro: {
    title: 'Các phiên tập trung trong ngày',
    description: 'Xem Pomodoro cùng cảm nhận sau phiên để hiểu nhịp tập trung của mình.',
    note: 'Pomodoro nằm cùng Timeline để bạn thấy việc học và trạng thái tinh thần liên quan ra sao.',
  },
  pinned: {
    title: 'Các note quan trọng đã ghim',
    description: 'Chỉ hiển thị những check-in bạn chủ động đánh dấu là cần nhớ.',
    note: 'Đây là view gọn cho những điều bạn muốn giữ lại lâu hơn.',
  },
};

const POSITIVE_WORDS = [
  'vui', 'ổn', 'tốt', 'tuyệt', 'thích', 'may mắn', 'biết ơn', 'nhẹ',
  'dễ chịu', 'bình yên', 'xong', 'hoàn thành', 'tiến bộ', 'đẹp', 'ngon',
  'cười', 'thành công', 'hài lòng', 'đỡ hơn',
];

function normalizeFilter(value) {
  return FILTERS.some(item => item.id === value) ? value : 'all';
}
const METRIC_LABELS = {
  stress: 'Stress',
  energy: 'Năng lượng',
  sleep: 'Giấc ngủ',
  focus: 'Tập trung',
};

const AFTER_FEELINGS = {
  clearer: 'Rõ hơn',
  calmer: 'Bình tĩnh hơn',
  tired: 'Mệt',
  distracted: 'Vẫn phân tán',
};

function keyForDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return format(date, 'yyyy-MM-dd');
}

function cleanNote(note = '') {
  return String(note || '').replace(/\s*\[.+\]$/, '').trim();
}

function extractCauses(note = '') {
  return String(note || '').match(/\[(.+)\]$/)?.[1]?.split(', ').filter(Boolean) || [];
}

function normalizeReview(value) {
  const review = value?.review || value || {};
  return {
    summary: review.summary || '',
    bestMoment: review.bestMoment || '',
    stressor: review.stressor || '',
    tomorrowStep: review.tomorrowStep || '',
    source: value?.source || '',
    savedAt: value?.savedAt || null,
  };
}

function readPomodoroSessions(user) {
  const key = `mb_pomodoro_mood_sessions_${user?.uid || user?.email || 'guest'}`;
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--:--';
  return format(date, 'HH:mm');
}

function formatDay(value) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return format(date, 'EEEE, dd/MM/yyyy', { locale: vi });
}

function attachmentIcon(kind) {
  if (kind === 'image') return '🖼️';
  if (kind === 'video') return '🎬';
  if (kind === 'audio') return '🎧';
  return '📎';
}

function mediaLabel(attachments) {
  if (!attachments.length) return '';
  const counts = attachments.reduce((acc, item) => {
    acc[item.kind] = (acc[item.kind] || 0) + 1;
    return acc;
  }, {});
  return [
    counts.image ? `${counts.image} ảnh` : '',
    counts.video ? `${counts.video} video` : '',
    counts.audio ? `${counts.audio} audio` : '',
    counts.file ? `${counts.file} tệp` : '',
  ].filter(Boolean).join(', ');
}

function buildMoodEvents(moodLogs, allMoods) {
  return moodLogs.map(log => {
    const mood = allMoods.find(item => item.id === log.mood);
    const attachments = normalizeMoodAttachments(log);
    return {
      id: `mood-${log.id || log.date}`,
      type: 'mood',
      date: log.date,
      dayKey: keyForDate(log.date),
      time: formatTime(log.date),
      mood,
      moodScore: Number(mood?.score) || 0,
      note: cleanNote(log.note || ''),
      causes: extractCauses(log.note || ''),
      metrics: log.metrics || null,
      attachments,
      pinned: !!log.pinned,
      privateAI: !!log.excludeFromAI,
      color: mood?.color || '#a29bfe',
    };
  }).filter(event => event.dayKey);
}

function buildPomodoroEvents(sessions) {
  return sessions.map(session => {
    const date = session.completedAt || session.reviewedAt || session.date;
    return {
      id: `pomodoro-${session.id || date}`,
      type: 'pomodoro',
      date,
      dayKey: keyForDate(date),
      time: formatTime(date),
      durationMin: session.durationMin || 25,
      focusBefore: session.focusBefore,
      focusAfter: session.focusAfter,
      afterFeeling: AFTER_FEELINGS[session.afterFeeling] || session.afterFeeling || '',
      afterNote: session.afterNote || '',
      color: '#fd79a8',
    };
  }).filter(event => event.dayKey);
}

function buildReviewEvents(dailyReviews) {
  return Object.entries(dailyReviews || {}).map(([dayKey, stored]) => {
    const review = normalizeReview(stored);
    return {
      id: `review-${dayKey}`,
      type: 'review',
      dayKey,
      date: `${dayKey}T23:58:00`,
      time: 'Nhìn lại',
      review,
      color: '#00b894',
    };
  }).filter(event => event.review.summary || event.review.bestMoment || event.review.stressor || event.review.tomorrowStep);
}

function buildReviewPromptEvents(moodEvents, reviewEvents) {
  const reviewedDays = new Set(reviewEvents.map(event => event.dayKey));
  const dayMap = new Map();

  moodEvents.forEach(event => {
    if (reviewedDays.has(event.dayKey)) return;
    if (!dayMap.has(event.dayKey)) {
      dayMap.set(event.dayKey, {
        dayKey: event.dayKey,
        moodCount: 0,
        mediaCount: 0,
      });
    }
    const day = dayMap.get(event.dayKey);
    day.moodCount += 1;
    day.mediaCount += event.attachments?.length || 0;
  });

  return Array.from(dayMap.values()).map(day => ({
    id: `review-prompt-${day.dayKey}`,
    type: 'review-prompt',
    dayKey: day.dayKey,
    date: `${day.dayKey}T23:57:00`,
    time: 'Chưa nhìn lại',
    moodCount: day.moodCount,
    mediaCount: day.mediaCount,
    color: '#00b894',
  }));
}

function includeByFilter(event, filter) {
  if (filter === 'all') return true;
  if (filter === 'media') return event.type === 'mood' && event.attachments.length > 0;
  if (filter === 'positive') return event.type === 'mood' && (
    event.pinned ||
    Number(event.moodScore) >= 4 ||
    POSITIVE_WORDS.some(word => String(event.note || '').toLowerCase().includes(word))
  );
  if (filter === 'pinned') return event.type === 'mood' && event.pinned;
  if (filter === 'review') return event.type === 'review' || event.type === 'review-prompt';
  return event.type === filter;
}

function DayReviewCard({ event }) {
  const { review } = event;
  return (
    <article className="life-event review-event" style={{ '--event-color': event.color }}>
      <div className="life-event-time">🪞</div>
      <div className="life-event-body">
        <div className="life-event-head">
          <div>
            <span className="life-event-type">Nhìn lại ngày</span>
            <h3>{review.summary || 'Đã có bản nhìn lại cho ngày này.'}</h3>
          </div>
          <Link to={`/daily-review?date=${event.dayKey}`}>Mở</Link>
        </div>
        <div className="review-grid">
          <div><span>Ổn nhất</span><p>{review.bestMoment || 'Chưa rõ.'}</p></div>
          <div><span>Căng hơn</span><p>{review.stressor || 'Chưa rõ.'}</p></div>
          <div><span>Ngày mai</span><p>{review.tomorrowStep || 'Chưa có gợi ý.'}</p></div>
        </div>
      </div>
    </article>
  );
}

function DayReviewPromptCard({ event }) {
  return (
    <article className="life-event review-prompt-event" style={{ '--event-color': event.color }}>
      <div className="life-event-time">🪞</div>
      <div className="life-event-body">
        <div className="life-event-head">
          <div>
            <span className="life-event-type">Chưa nhìn lại ngày</span>
            <h3>Ngày này có {event.moodCount} check-in{event.mediaCount ? ` và ${event.mediaCount} media` : ''}.</h3>
          </div>
          <Link to={`/daily-review?date=${event.dayKey}`}>Tạo</Link>
        </div>
        <p className="review-prompt-copy">
          Mở trang Nhìn lại để MindBuddy gom dữ liệu trong ngày và tạo bản tóm tắt.
        </p>
      </div>
    </article>
  );
}

function MediaStrip({ attachments, date }) {
  if (!attachments.length) return null;
  return (
    <div className="timeline-media-strip">
      {attachments.map((attachment, index) => (
        <a
          key={`${attachment.url}-${index}`}
          href={attachment.url}
          target="_blank"
          rel="noreferrer"
          className={`timeline-media-item ${attachment.kind}`}
          title={attachment.name || displayAttachmentName(attachment, { date, index, total: attachments.length })}
        >
          {attachment.kind === 'image' && <img src={attachment.url} alt={displayAttachmentName(attachment, { date, index, total: attachments.length })} loading="lazy" />}
          {attachment.kind === 'video' && <video src={attachment.url} muted preload="metadata" />}
          {attachment.kind === 'audio' && <div><span>🎧</span><strong>{displayAttachmentName(attachment, { date, index, total: attachments.length })}</strong></div>}
          {attachment.kind === 'file' && <div><span>📎</span><strong>{attachment.name || 'Tệp đính kèm'}</strong></div>}
          <i>{attachmentIcon(attachment.kind)}</i>
        </a>
      ))}
    </div>
  );
}

function MoodEvent({ event }) {
  const metricEntries = Object.entries(METRIC_LABELS)
    .map(([key, label]) => {
      const value = Number(event.metrics?.[key]);
      return Number.isFinite(value) ? { key, label, value } : null;
    })
    .filter(Boolean);

  return (
    <article className={`life-event mood-event ${event.pinned ? 'pinned' : ''}`} style={{ '--event-color': event.color }}>
      <div className="life-event-time">{event.time}</div>
      <div className="life-event-body">
        <div className="life-event-head">
          <div>
            <span className="life-event-type">Check-in</span>
            <h3>{event.mood?.emoji} {event.mood?.label || 'Không rõ'}</h3>
          </div>
          <Link to="/mood?tab=history">Mở</Link>
        </div>
        <div className="life-badge-row">
          {event.pinned && <span className="pin">★ Quan trọng</span>}
          {event.privateAI && <span>Riêng tư AI</span>}
          {event.attachments.length > 0 && <span>{mediaLabel(event.attachments)}</span>}
        </div>
        {event.causes.length > 0 && (
          <div className="life-cause-row">
            {event.causes.map(cause => (
              <span
                key={cause}
                style={causeTagStyle(cause)}
                title={causeTagTitle(cause)}
              >
                {cause}
              </span>
            ))}
          </div>
        )}
        {metricEntries.length > 0 && (
          <div className="life-metric-row">
            {metricEntries.map(item => (
              <span key={item.key} className={item.key}>{item.label}: {item.value}/5</span>
            ))}
          </div>
        )}
        <MediaStrip attachments={event.attachments} date={event.date} />
        <RichText text={event.note} fallback="Không có ghi chú thêm." className="life-note" />
      </div>
    </article>
  );
}

function PomodoroEvent({ event }) {
  return (
    <article className="life-event pomodoro-event" style={{ '--event-color': event.color }}>
      <div className="life-event-time">{event.time}</div>
      <div className="life-event-body">
        <div className="life-event-head">
          <div>
            <span className="life-event-type">Pomodoro</span>
            <h3>🍅 Phiên {event.durationMin} phút</h3>
          </div>
          <Link to="/pomodoro">Mở</Link>
        </div>
        <p className="pomodoro-summary">
          Tập trung {event.focusBefore || '-'}/5 → {event.focusAfter || '-'}/5
          {event.afterFeeling ? ` · ${event.afterFeeling}` : ''}
        </p>
        {event.afterNote && <p className="pomodoro-note">{event.afterNote}</p>}
      </div>
    </article>
  );
}

export default function Timeline() {
  const { user, moodLogs, MOODS, customMoods, dailyReviews } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filter, setFilter] = React.useState(() => normalizeFilter(searchParams.get('view')));
  const [query, setQuery] = React.useState('');
  const [visibleDays, setVisibleDays] = React.useState(14);
  const activeView = VIEW_DETAILS[filter] || VIEW_DETAILS.all;

  React.useEffect(() => {
    setFilter(normalizeFilter(searchParams.get('view')));
  }, [searchParams]);

  React.useEffect(() => {
    setVisibleDays(14);
  }, [filter, query]);

  const selectFilter = (nextFilter) => {
    const normalized = normalizeFilter(nextFilter);
    const nextParams = new URLSearchParams(searchParams);
    if (normalized === 'all') nextParams.delete('view');
    else nextParams.set('view', normalized);
    setSearchParams(nextParams);
  };

  const allMoods = React.useMemo(
    () => [...MOODS, ...(customMoods || [])],
    [MOODS, customMoods]
  );

  const pomodoroSessions = React.useMemo(() => readPomodoroSessions(user), [user]);

  const events = React.useMemo(() => {
    const moodEvents = buildMoodEvents(moodLogs, allMoods);
    const pomodoroEvents = buildPomodoroEvents(pomodoroSessions);
    const reviewEvents = buildReviewEvents(dailyReviews);
    const reviewPromptEvents = buildReviewPromptEvents(moodEvents, reviewEvents);
    return [...moodEvents, ...pomodoroEvents, ...reviewEvents, ...reviewPromptEvents]
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [allMoods, dailyReviews, moodLogs, pomodoroSessions]);

  const filteredEvents = React.useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return events.filter(event => {
      if (!includeByFilter(event, filter)) return false;
      if (!keyword) return true;
      const haystack = [
        event.type,
        event.mood?.label,
        event.note,
        event.causes?.join(' '),
        event.afterFeeling,
        event.afterNote,
        event.review?.summary,
        event.review?.bestMoment,
        event.review?.stressor,
        event.review?.tomorrowStep,
        event.type === 'review-prompt' ? 'chưa nhìn lại ngày tạo review' : '',
        event.attachments?.map(item => item.name).join(' '),
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(keyword);
    });
  }, [events, filter, query]);

  const dayGroups = React.useMemo(() => {
    const map = new Map();
    filteredEvents.forEach(event => {
      if (!map.has(event.dayKey)) {
        map.set(event.dayKey, {
          dayKey: event.dayKey,
          events: [],
          moodCount: 0,
          mediaCount: 0,
          pomodoroCount: 0,
          reviewCount: 0,
          reviewPromptCount: 0,
        });
      }
      const group = map.get(event.dayKey);
      group.events.push(event);
      if (event.type === 'mood') {
        group.moodCount += 1;
        group.mediaCount += event.attachments?.length || 0;
      }
      if (event.type === 'pomodoro') group.pomodoroCount += 1;
      if (event.type === 'review') group.reviewCount += 1;
      if (event.type === 'review-prompt') group.reviewPromptCount += 1;
    });
    return Array.from(map.values())
      .sort((a, b) => b.dayKey.localeCompare(a.dayKey))
      .slice(0, visibleDays);
  }, [filteredEvents, visibleDays]);

  const stats = React.useMemo(() => {
    const realEvents = events.filter(event => event.type !== 'review-prompt');
    const mediaCount = realEvents.reduce((sum, event) => sum + (event.type === 'mood' ? event.attachments.length : 0), 0);
    return {
      days: new Set(realEvents.map(event => event.dayKey)).size,
      events: realEvents.length,
      media: mediaCount,
      pomodoros: realEvents.filter(event => event.type === 'pomodoro').length,
    };
  }, [events]);

  return (
    <div className="timeline-page">
      <section className="timeline-hero">
        <div>
          <span className="timeline-kicker">Timeline trung tâm</span>
          <h1>{activeView.title}</h1>
          <p>{activeView.description}</p>
          <div className="timeline-view-note">{activeView.note}</div>
        </div>
        <div className="timeline-hero-stats" aria-label="Tổng quan timeline">
          <div><strong>{stats.days}</strong><span>Ngày</span></div>
          <div><strong>{stats.events}</strong><span>Sự kiện</span></div>
          <div><strong>{stats.media}</strong><span>Media</span></div>
          <div><strong>{stats.pomodoros}</strong><span>Pomodoro</span></div>
        </div>
      </section>

      <section className="timeline-toolbar card">
        <div className="timeline-filter-tabs" aria-label="Lọc timeline">
          {FILTERS.map(item => (
            <button
              key={item.id}
              type="button"
              className={filter === item.id ? 'active' : ''}
              onClick={() => selectFilter(item.id)}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Tìm trong note, nguyên nhân, review, tên file..."
        />
      </section>

      {dayGroups.length === 0 ? (
        <section className="timeline-empty card">
          <div>🗂️</div>
          <h2>Chưa có dữ liệu phù hợp</h2>
          <p>Thử đổi bộ lọc hoặc quay lại ghi thêm một check-in mới.</p>
          <Link className="btn btn-primary" to="/mood">Ghi cảm xúc</Link>
        </section>
      ) : (
        <section className="life-timeline">
          {dayGroups.map(group => (
            <div key={group.dayKey} className="life-day">
              <header className="life-day-head">
                <div>
                  <span>{formatDay(group.dayKey)}</span>
                  <h2>{group.moodCount} check-in · {group.mediaCount} media · {group.pomodoroCount} Pomodoro</h2>
                </div>
                {group.reviewCount > 0
                  ? <em>Đã nhìn lại</em>
                  : group.reviewPromptCount > 0 && <em className="pending">Chưa nhìn lại</em>}
              </header>
              <div className="life-event-list">
                {group.events.map(event => {
                  if (event.type === 'review') return <DayReviewCard key={event.id} event={event} />;
                  if (event.type === 'review-prompt') return <DayReviewPromptCard key={event.id} event={event} />;
                  if (event.type === 'pomodoro') return <PomodoroEvent key={event.id} event={event} />;
                  return <MoodEvent key={event.id} event={event} />;
                })}
              </div>
            </div>
          ))}
          {dayGroups.length < new Set(filteredEvents.map(event => event.dayKey)).size && (
            <button className="timeline-load-more" type="button" onClick={() => setVisibleDays(days => days + 14)}>
              Xem thêm 14 ngày
            </button>
          )}
        </section>
      )}
    </div>
  );
}
