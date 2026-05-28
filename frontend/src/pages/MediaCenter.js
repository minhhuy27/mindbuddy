import React from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useApp } from '../context/AppContext';
import { displayAttachmentName, normalizeMoodAttachments } from '../utils/moodImages';
import RichText from '../components/RichText';
import './MediaCenter.css';

const POSITIVE_WORDS = [
  'vui', 'ổn', 'tốt', 'tuyệt', 'thích', 'may mắn', 'biết ơn', 'nhẹ',
  'dễ chịu', 'bình yên', 'xong', 'hoàn thành', 'tiến bộ', 'đẹp', 'ngon',
  'cười', 'thành công', 'hài lòng', 'đỡ hơn',
];

const FILTERS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'image', label: 'Ảnh' },
  { id: 'video', label: 'Video' },
  { id: 'audio', label: 'Âm thanh' },
  { id: 'good', label: 'Khoảnh khắc tốt' },
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

function formatBytes(bytes = 0) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return '';
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(value >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

function isGoodMoment(log, mood, note) {
  const lowerNote = note.toLowerCase();
  const metrics = log.metrics || {};
  const stress = normalizeMetric(metrics.stress);
  const energy = normalizeMetric(metrics.energy);
  const focus = normalizeMetric(metrics.focus);
  const sleep = normalizeMetric(metrics.sleep);

  return (
    (mood?.score || 0) >= 4 ||
    POSITIVE_WORDS.some(word => lowerNote.includes(word)) ||
    (stress !== null && stress <= 2) ||
    (energy !== null && energy >= 4) ||
    (focus !== null && focus >= 4) ||
    (sleep !== null && sleep >= 4)
  );
}

function attachmentIcon(kind) {
  if (kind === 'image') return '🖼️';
  if (kind === 'video') return '🎬';
  if (kind === 'audio') return '🎧';
  return '📎';
}

function monthKey(date) {
  return format(new Date(date), 'yyyy-MM');
}

export default function MediaCenter() {
  const { moodLogs, MOODS, customMoods } = useApp();
  const [filter, setFilter] = React.useState('all');
  const [monthFilter, setMonthFilter] = React.useState('all');
  const [selectedItem, setSelectedItem] = React.useState(null);

  const allMoods = React.useMemo(
    () => [...MOODS, ...(customMoods || [])],
    [MOODS, customMoods]
  );

  const mediaItems = React.useMemo(() => (
    moodLogs.flatMap(log => {
      const mood = allMoods.find(item => item.id === log.mood);
      const note = cleanNote(log.note || '');
      const causes = extractCauses(log.note || '');
      const attachments = normalizeMoodAttachments(log);
      const good = isGoodMoment(log, mood, note);

      return attachments.map((attachment, index) => ({
        id: `${log.id || log.date}-${index}-${attachment.url}`,
        attachment,
        attachmentIndex: index,
        attachments,
        date: log.date,
        dayKey: format(new Date(log.date), 'yyyy-MM-dd'),
        monthKey: monthKey(log.date),
        mood,
        note,
        causes,
        metrics: log.metrics || null,
        good,
      }));
    }).sort((a, b) => new Date(b.date) - new Date(a.date))
  ), [allMoods, moodLogs]);

  const monthOptions = React.useMemo(() => {
    const grouped = mediaItems.reduce((acc, item) => {
      if (!acc[item.monthKey]) {
        acc[item.monthKey] = {
          key: item.monthKey,
          label: format(new Date(item.date), 'MMMM yyyy', { locale: vi }),
          count: 0,
        };
      }
      acc[item.monthKey].count += 1;
      return acc;
    }, {});
    return Object.values(grouped).sort((a, b) => b.key.localeCompare(a.key));
  }, [mediaItems]);

  const filteredItems = React.useMemo(() => (
    mediaItems.filter(item => {
      if (monthFilter !== 'all' && item.monthKey !== monthFilter) return false;
      if (filter === 'good') return item.good;
      if (filter === 'all') return true;
      return item.attachment.kind === filter;
    })
  ), [filter, mediaItems, monthFilter]);

  const groupedByDay = React.useMemo(() => (
    filteredItems.reduce((acc, item) => {
      if (!acc[item.dayKey]) {
        acc[item.dayKey] = {
          key: item.dayKey,
          date: item.date,
          items: [],
        };
      }
      acc[item.dayKey].items.push(item);
      return acc;
    }, {})
  ), [filteredItems]);

  const dayGroups = React.useMemo(() => (
    Object.values(groupedByDay).sort((a, b) => new Date(b.date) - new Date(a.date))
  ), [groupedByDay]);

  const stats = React.useMemo(() => {
    const counts = mediaItems.reduce((acc, item) => {
      acc.total += 1;
      acc[item.attachment.kind] = (acc[item.attachment.kind] || 0) + 1;
      acc.good += item.good ? 1 : 0;
      acc.size += Number(item.attachment.size || 0);
      return acc;
    }, { total: 0, image: 0, video: 0, audio: 0, file: 0, good: 0, size: 0 });
    return counts;
  }, [mediaItems]);

  React.useEffect(() => {
    if (!selectedItem) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setSelectedItem(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItem]);

  return (
    <div className="media-center-page">
      <section className="media-hero">
        <div>
          <span className="media-kicker">Ký ức</span>
          <h1>Trung tâm media của những ngày đã ghi lại</h1>
          <p>Ảnh, video và âm thanh từ các lần check-in được gom theo ngày để bạn mở lại đúng ngữ cảnh, cảm xúc và ghi chú đi kèm.</p>
        </div>
        <div className="media-hero-stats" aria-label="Tổng quan media">
          <div><strong>{stats.total}</strong><span>Tệp</span></div>
          <div><strong>{stats.image}</strong><span>Ảnh</span></div>
          <div><strong>{stats.video}</strong><span>Video</span></div>
          <div><strong>{stats.audio}</strong><span>Âm thanh</span></div>
        </div>
      </section>

      <section className="media-toolbar">
        <div className="media-filter-tabs" aria-label="Lọc media">
          {FILTERS.map(item => (
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
        <label className="media-month-select">
          <span>Tháng</span>
          <select value={monthFilter} onChange={event => setMonthFilter(event.target.value)}>
            <option value="all">Tất cả</option>
            {monthOptions.map(item => (
              <option key={item.key} value={item.key}>
                {item.label} · {item.count}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="media-summary-strip" aria-label="Tóm tắt thư viện">
        <div><span>Dung lượng đã ghi nhận</span><strong>{formatBytes(stats.size) || 'Chưa rõ'}</strong></div>
        <div><span>Khoảnh khắc tốt</span><strong>{stats.good}</strong></div>
        <div><span>Số tháng có media</span><strong>{monthOptions.length}</strong></div>
      </section>

      {mediaItems.length === 0 ? (
        <section className="media-empty">
          <div aria-hidden="true">🖼️</div>
          <h2>Chưa có ký ức media nào</h2>
          <p>Thêm ảnh, video hoặc ghi âm vào check-in. MindBuddy sẽ tự gom chúng vào đây theo ngày.</p>
          <Link to="/mood" className="btn btn-primary">Thêm check-in</Link>
        </section>
      ) : dayGroups.length === 0 ? (
        <section className="media-empty">
          <div aria-hidden="true">🔎</div>
          <h2>Không có media trong bộ lọc này</h2>
          <p>Thử đổi loại media hoặc chọn tháng khác.</p>
        </section>
      ) : (
        <section className="media-timeline">
          {dayGroups.map(group => (
            <article key={group.key} className="media-day-section">
              <header>
                <div>
                  <h2>{format(new Date(group.date), 'EEEE, dd/MM/yyyy', { locale: vi })}</h2>
                  <p>{group.items.length} tệp từ các lần check-in trong ngày</p>
                </div>
                <span>{group.items.some(item => item.good) ? 'Có khoảnh khắc tốt' : 'Ký ức thường ngày'}</span>
              </header>

              <div className="media-grid">
                {group.items.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    className={`media-memory-card ${item.attachment.kind}`}
                    onClick={() => setSelectedItem(item)}
                    style={{ '--media-color': item.mood?.color || '#a29bfe' }}
                    title={item.attachment.name || ''}
                  >
                    <div className="media-preview">
                      {item.attachment.kind === 'image' && (
                        <img src={item.attachment.url} alt={displayAttachmentName(item.attachment, { date: item.date, index: item.attachmentIndex, total: item.attachments.length })} loading="lazy" />
                      )}
                      {item.attachment.kind === 'video' && (
                        <video src={item.attachment.url} muted preload="metadata" />
                      )}
                      {item.attachment.kind === 'audio' && (
                        <div className="media-audio-preview">
                          <span>🎧</span>
                          <strong title={item.attachment.name || ''}>{displayAttachmentName(item.attachment, { date: item.date, index: item.attachmentIndex, total: item.attachments.length })}</strong>
                        </div>
                      )}
                      {!['image', 'video', 'audio'].includes(item.attachment.kind) && (
                        <div className="media-audio-preview">
                          <span>📎</span>
                          <strong title={item.attachment.name || ''}>{displayAttachmentName(item.attachment, { date: item.date, index: item.attachmentIndex, total: item.attachments.length })}</strong>
                        </div>
                      )}
                      <i>{attachmentIcon(item.attachment.kind)}</i>
                    </div>
                    <div className="media-card-body">
                      <span>{format(new Date(item.date), 'HH:mm')} · {item.mood?.emoji} {item.mood?.label || 'Không rõ'}</span>
                      <strong title={item.attachment.name || ''}>{displayAttachmentName(item.attachment, { date: item.date, index: item.attachmentIndex, total: item.attachments.length })}</strong>
                      <p>{item.note || 'Không có ghi chú đi kèm.'}</p>
                      <div>
                        {item.good && <em>Khoảnh khắc tốt</em>}
                        {item.attachments.length > 1 && <em>{item.attachmentIndex + 1}/{item.attachments.length}</em>}
                        {formatBytes(item.attachment.size) && <em>{formatBytes(item.attachment.size)}</em>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </article>
          ))}
        </section>
      )}

      {selectedItem && (
        <div className="media-modal-overlay" onClick={event => event.target === event.currentTarget && setSelectedItem(null)}>
          <div className="media-modal" role="dialog" aria-modal="true" aria-label="Chi tiết ký ức">
            <header>
              <div>
                <span>{format(new Date(selectedItem.date), 'EEEE, dd/MM/yyyy HH:mm', { locale: vi })}</span>
                <h2>{selectedItem.mood?.emoji} {selectedItem.mood?.label || 'Không rõ'}</h2>
              </div>
              <button type="button" onClick={() => setSelectedItem(null)} aria-label="Đóng">×</button>
            </header>

            <div className="media-modal-body">
              <div className="media-modal-viewer">
                {selectedItem.attachment.kind === 'image' && (
                  <img src={selectedItem.attachment.url} alt={displayAttachmentName(selectedItem.attachment, { date: selectedItem.date, index: selectedItem.attachmentIndex, total: selectedItem.attachments.length })} />
                )}
                {selectedItem.attachment.kind === 'video' && (
                  <video src={selectedItem.attachment.url} controls preload="metadata" />
                )}
                {selectedItem.attachment.kind === 'audio' && (
                  <div className="media-modal-audio">
                    <span>🎧</span>
                    <audio src={selectedItem.attachment.url} controls preload="metadata" />
                  </div>
                )}
                {!['image', 'video', 'audio'].includes(selectedItem.attachment.kind) && (
                  <a href={selectedItem.attachment.url} target="_blank" rel="noreferrer" className="btn btn-secondary">
                    Mở tệp
                  </a>
                )}
              </div>

              <aside className="media-modal-note" style={{ '--media-color': selectedItem.mood?.color || '#a29bfe' }}>
                <div>
                  <span>Tệp</span>
                  <strong title={selectedItem.attachment.name || ''}>{displayAttachmentName(selectedItem.attachment, { date: selectedItem.date, index: selectedItem.attachmentIndex, total: selectedItem.attachments.length })}</strong>
                  <p>{formatBytes(selectedItem.attachment.size) || 'Chưa rõ dung lượng'}</p>
                </div>
                <div>
                  <span>Ghi chú đi kèm</span>
                  <RichText text={selectedItem.note} fallback="Không có ghi chú đi kèm." />
                </div>
                {selectedItem.causes.length > 0 && (
                  <div className="media-cause-tags">
                    {selectedItem.causes.map(cause => <i key={cause}>{cause}</i>)}
                  </div>
                )}
                <Link to="/mood?tab=history" className="btn btn-secondary">Mở lịch sử cảm xúc</Link>
              </aside>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
