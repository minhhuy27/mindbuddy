import React from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useApp } from '../context/AppContext';
import './GoodMoments.css';

const POSITIVE_WORDS = [
  'vui', 'ổn', 'tốt', 'tuyệt', 'thích', 'may mắn', 'biết ơn', 'nhẹ',
  'dễ chịu', 'bình yên', 'xong', 'hoàn thành', 'tiến bộ', 'đẹp', 'ngon',
  'cười', 'thành công', 'hài lòng', 'đỡ hơn',
];

function cleanNote(note = '') {
  return note.replace(/\s*\[.+\]$/, '').trim();
}

function extractCauses(note = '') {
  return note.match(/\[(.+)\]$/)?.[1]?.split(', ').filter(Boolean) || [];
}

function normalizeMetric(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(5, Math.max(1, number)) : null;
}

function getMomentSignals(log, mood) {
  const note = cleanNote(log.note || '');
  const lowerNote = note.toLowerCase();
  const metrics = log.metrics || {};
  const stress = normalizeMetric(metrics.stress);
  const energy = normalizeMetric(metrics.energy);
  const focus = normalizeMetric(metrics.focus);
  const sleep = normalizeMetric(metrics.sleep);
  const hasPhoto = Boolean(log.image?.url || log.imageUrl);
  const signals = [];

  if ((mood?.score || 0) >= 4) signals.push('Mood cao');
  if (POSITIVE_WORDS.some(word => lowerNote.includes(word))) signals.push('Note tích cực');
  if (hasPhoto && (mood?.score || 0) >= 3) signals.push('Có ảnh đáng nhớ');
  if (stress !== null && stress <= 2) signals.push('Stress thấp');
  if (energy !== null && energy >= 4) signals.push('Năng lượng tốt');
  if (focus !== null && focus >= 4) signals.push('Tập trung rõ');
  if (sleep !== null && sleep >= 4) signals.push('Ngủ ổn');

  return signals;
}

function getMomentScore(log, mood, signals) {
  const metrics = log.metrics || {};
  const stress = normalizeMetric(metrics.stress);
  const energy = normalizeMetric(metrics.energy);
  const focus = normalizeMetric(metrics.focus);
  const sleep = normalizeMetric(metrics.sleep);
  const hasPhoto = Boolean(log.image?.url || log.imageUrl);
  return (
    (mood?.score || 3) * 1.2 +
    signals.length * 0.7 +
    (hasPhoto ? 0.8 : 0) +
    (stress !== null ? (6 - stress) * 0.22 : 0) +
    (energy || 0) * 0.18 +
    (focus || 0) * 0.14 +
    (sleep || 0) * 0.1
  );
}

export default function GoodMoments() {
  const { moodLogs, MOODS, customMoods } = useApp();
  const [filter, setFilter] = React.useState('all');
  const [selectedMoment, setSelectedMoment] = React.useState(null);

  const allMoods = React.useMemo(
    () => [...MOODS, ...(customMoods || [])],
    [MOODS, customMoods]
  );

  const moments = React.useMemo(() => (
    moodLogs
      .map(log => {
        const mood = allMoods.find(item => item.id === log.mood);
        const note = cleanNote(log.note || '');
        const signals = getMomentSignals(log, mood);
        const imageUrl = log.image?.url || log.imageUrl || '';
        return {
          id: log.id,
          date: log.date,
          mood,
          note,
          causes: extractCauses(log.note || ''),
          imageUrl,
          signals,
          score: getMomentScore(log, mood, signals),
          metrics: log.metrics || null,
        };
      })
      .filter(moment => moment.signals.length > 0)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
  ), [allMoods, moodLogs]);

  const filteredMoments = React.useMemo(() => {
    if (filter === 'photo') return moments.filter(moment => moment.imageUrl);
    if (filter === 'mood') return moments.filter(moment => (moment.mood?.score || 0) >= 4);
    if (filter === 'note') return moments.filter(moment => moment.signals.includes('Note tích cực'));
    return moments;
  }, [filter, moments]);

  const bestDays = React.useMemo(() => {
    const grouped = moments.reduce((acc, moment) => {
      const key = format(new Date(moment.date), 'yyyy-MM-dd');
      if (!acc[key]) {
        acc[key] = {
          key,
          date: moment.date,
          count: 0,
          totalScore: 0,
          photos: 0,
        };
      }
      acc[key].count += 1;
      acc[key].totalScore += moment.mood?.score || 3;
      if (moment.imageUrl) acc[key].photos += 1;
      return acc;
    }, {});

    return Object.values(grouped)
      .map(day => ({
        ...day,
        average: day.totalScore / day.count,
      }))
      .sort((a, b) => b.average - a.average || b.count - a.count)
      .slice(0, 5);
  }, [moments]);

  const topMoment = React.useMemo(() => (
    [...moments].sort((a, b) => b.score - a.score)[0]
  ), [moments]);

  React.useEffect(() => {
    if (!selectedMoment) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setSelectedMoment(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedMoment]);

  return (
    <div className="good-moments-page">
      <section className="good-moments-hero">
        <div>
          <span className="good-moments-kicker">Khoảnh khắc tốt</span>
          <h1>Nơi cất lại những ngày mình đã ổn</h1>
          <p>MindBuddy gom note tích cực, ảnh check-in và những ngày mood cao để bạn có thể mở lại khi cần một điểm tựa nhẹ.</p>
        </div>
        <div className="good-moments-stats" aria-label="Tổng quan khoảnh khắc tốt">
          <div><strong>{moments.length}</strong><span>Khoảnh khắc</span></div>
          <div><strong>{moments.filter(moment => moment.imageUrl).length}</strong><span>Có ảnh</span></div>
          <div><strong>{bestDays.length}</strong><span>Ngày ổn</span></div>
        </div>
      </section>

      {moments.length === 0 ? (
        <section className="card good-moments-empty">
          <div className="empty-icon" aria-hidden="true">✨</div>
          <h3>Chưa có khoảnh khắc nào được gom lại</h3>
          <p>Ghi một check-in khi thấy ổn hơn, thêm ảnh hoặc vài dòng tích cực. MindBuddy sẽ tự lưu vào mục này.</p>
          <Link to="/mood" className="btn btn-primary">Ghi cảm xúc</Link>
        </section>
      ) : (
        <>
          <section className="good-moments-overview">
            {topMoment && (
              <article className="card good-featured-moment">
                <div>
                  <span>Gợi ý mở lại hôm nay</span>
                  <h3>{topMoment.mood?.emoji} {topMoment.mood?.label || 'Không rõ'}</h3>
                  <p>{topMoment.note || 'Một khoảnh khắc ổn đã được ghi lại.'}</p>
                  <button type="button" className="btn btn-primary" onClick={() => setSelectedMoment(topMoment)}>
                    Mở khoảnh khắc
                  </button>
                </div>
                {topMoment.imageUrl ? (
                  <img src={topMoment.imageUrl} alt={`Ảnh khoảnh khắc ${topMoment.mood?.label || 'không rõ'}`} />
                ) : (
                  <div className="featured-placeholder" aria-hidden="true">✨</div>
                )}
              </article>
            )}

            <aside className="card good-days-card">
              <h3>Ngày mood cao</h3>
              <div className="good-days-list">
                {bestDays.map(day => (
                  <div key={day.key} className="good-day-row">
                    <div>
                      <strong>{format(new Date(day.date), 'EEEE, dd/MM', { locale: vi })}</strong>
                      <span>{day.count} khoảnh khắc{day.photos ? `, ${day.photos} ảnh` : ''}</span>
                    </div>
                    <b>{day.average.toFixed(1)}/5</b>
                  </div>
                ))}
              </div>
            </aside>
          </section>

          <section className="card good-moments-list-card">
            <div className="section-heading-row">
              <div>
                <h3>Bộ sưu tập khoảnh khắc</h3>
                <p className="text-muted">Bấm vào một mục để xem lại ghi chú, ảnh và tín hiệu tích cực.</p>
              </div>
              <div className="good-filter-tabs" aria-label="Lọc khoảnh khắc tốt">
                {[
                  { id: 'all', label: 'Tất cả' },
                  { id: 'photo', label: 'Có ảnh' },
                  { id: 'mood', label: 'Mood cao' },
                  { id: 'note', label: 'Note tốt' },
                ].map(item => (
                  <button
                    key={item.id}
                    type="button"
                    className={filter === item.id ? 'active' : ''}
                    onClick={() => setFilter(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredMoments.length > 0 ? (
              <div className="good-moment-grid">
                {filteredMoments.map(moment => (
                  <button
                    key={moment.id}
                    type="button"
                    className="good-moment-card"
                    style={{ '--moment-color': moment.mood?.color || '#a29bfe' }}
                    onClick={() => setSelectedMoment(moment)}
                  >
                    {moment.imageUrl && <img src={moment.imageUrl} alt={`Ảnh khoảnh khắc lúc ${format(new Date(moment.date), 'HH:mm')}`} />}
                    <div className="good-moment-body">
                      <span>{format(new Date(moment.date), 'dd/MM/yyyy, HH:mm')}</span>
                      <strong>{moment.mood?.emoji} {moment.mood?.label || 'Không rõ'}</strong>
                      <p>{moment.note || 'Một khoảnh khắc ổn đã được ghi lại.'}</p>
                      <div className="good-signal-row">
                        {moment.signals.slice(0, 3).map(signal => <i key={signal}>{signal}</i>)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="good-filter-empty">
                <strong>Không có mục nào trong bộ lọc này.</strong>
                <p>Thử đổi bộ lọc hoặc ghi thêm check-in có ảnh/note tích cực.</p>
              </div>
            )}
          </section>
        </>
      )}

      {selectedMoment && (
        <div className="good-moment-modal-overlay" onClick={e => e.target === e.currentTarget && setSelectedMoment(null)}>
          <div className="good-moment-modal" role="dialog" aria-modal="true" aria-label="Chi tiết khoảnh khắc tốt">
            <div className="good-modal-header">
              <div>
                <span>{format(new Date(selectedMoment.date), 'EEEE, dd/MM/yyyy', { locale: vi })}</span>
                <h3>{selectedMoment.mood?.emoji} {selectedMoment.mood?.label || 'Không rõ'} lúc {format(new Date(selectedMoment.date), 'HH:mm')}</h3>
              </div>
              <button type="button" onClick={() => setSelectedMoment(null)} aria-label="Đóng khoảnh khắc">×</button>
            </div>
            <div className="good-modal-body">
              {selectedMoment.imageUrl && <img src={selectedMoment.imageUrl} alt="Ảnh khoảnh khắc tốt" />}
              <div className="good-modal-note" style={{ '--moment-color': selectedMoment.mood?.color || '#a29bfe' }}>
                <p>{selectedMoment.note || 'Một khoảnh khắc ổn đã được ghi lại.'}</p>
                {selectedMoment.causes.length > 0 && (
                  <div className="good-cause-tags">
                    {selectedMoment.causes.map(cause => <span key={cause}>{cause}</span>)}
                  </div>
                )}
                <div className="good-signal-row">
                  {selectedMoment.signals.map(signal => <i key={signal}>{signal}</i>)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
