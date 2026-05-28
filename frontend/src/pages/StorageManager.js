import React from 'react';
import { Link } from 'react-router-dom';
import { format, differenceInDays } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useApp } from '../context/AppContext';
import { displayAttachmentName, normalizeMoodAttachments } from '../utils/moodImages';
import './StorageManager.css';

const FREE_STORAGE_BYTES = 1024 * 1024 * 1024;
const LARGE_VIDEO_BYTES = 50 * 1024 * 1024;
const OLD_FILE_DAYS = 60;

function formatBytes(bytes = 0) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return 'Chưa rõ';
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(value >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function attachmentIcon(kind) {
  if (kind === 'image') return '🖼️';
  if (kind === 'video') return '🎬';
  if (kind === 'audio') return '🎧';
  return '📎';
}

function cleanNote(note = '') {
  return note.replace(/\s*\[.+\]$/, '').trim();
}

function buildStorageItems(logs, allMoods) {
  return logs.flatMap(log => {
    const mood = allMoods.find(item => item.id === log.mood);
    const attachments = normalizeMoodAttachments(log);
    return attachments.map((attachment, index) => ({
      id: `${log.id || log.date}-${index}-${attachment.path || attachment.url}`,
      log,
      attachment,
      index,
      displayName: displayAttachmentName(attachment, { date: log.date, index, total: attachments.length }),
      date: log.date,
      mood,
      note: cleanNote(log.note || ''),
      size: Number(attachment.size || 0),
      ageDays: differenceInDays(new Date(), new Date(log.date)),
      hasStoragePath: Boolean(attachment.path),
    }));
  }).sort((a, b) => b.size - a.size || new Date(a.date) - new Date(b.date));
}

export default function StorageManager() {
  const { moodLogs, MOODS, customMoods, updateMoodLog } = useApp();
  const [kindFilter, setKindFilter] = React.useState('all');
  const [sortMode, setSortMode] = React.useState('largest');
  const [deletingId, setDeletingId] = React.useState('');
  const [notice, setNotice] = React.useState('');

  const allMoods = React.useMemo(
    () => [...MOODS, ...(customMoods || [])],
    [MOODS, customMoods]
  );

  const items = React.useMemo(() => buildStorageItems(moodLogs, allMoods), [allMoods, moodLogs]);

  const stats = React.useMemo(() => (
    items.reduce((acc, item) => {
      acc.total += item.size;
      acc.count += 1;
      acc[item.attachment.kind] = (acc[item.attachment.kind] || 0) + 1;
      if (item.attachment.kind === 'video') acc.videoBytes += item.size;
      if (item.ageDays >= OLD_FILE_DAYS) acc.oldCount += 1;
      return acc;
    }, { total: 0, count: 0, image: 0, video: 0, audio: 0, file: 0, videoBytes: 0, oldCount: 0 })
  ), [items]);

  const filteredItems = React.useMemo(() => {
    const filtered = items.filter(item => {
      if (kindFilter === 'all') return true;
      if (kindFilter === 'old') return item.ageDays >= OLD_FILE_DAYS;
      if (kindFilter === 'large-video') return item.attachment.kind === 'video' && item.size >= LARGE_VIDEO_BYTES;
      return item.attachment.kind === kindFilter;
    });

    return [...filtered].sort((a, b) => {
      if (sortMode === 'oldest') return new Date(a.date) - new Date(b.date);
      if (sortMode === 'newest') return new Date(b.date) - new Date(a.date);
      return b.size - a.size;
    });
  }, [items, kindFilter, sortMode]);

  const largestVideos = React.useMemo(() => (
    items.filter(item => item.attachment.kind === 'video').slice(0, 5)
  ), [items]);

  const oldFiles = React.useMemo(() => (
    items.filter(item => item.ageDays >= OLD_FILE_DAYS)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 5)
  ), [items]);

  const usagePercent = Math.min(100, Math.round((stats.total / FREE_STORAGE_BYTES) * 100));

  const removeMedia = async (item) => {
    const confirmed = window.confirm(
      `Xóa tệp "${item.displayName}" khỏi Firebase và giữ lại ghi chú?`
    );
    if (!confirmed) return;

    setDeletingId(item.id);
    setNotice('');
    try {
      const currentAttachments = normalizeMoodAttachments(item.log);
      const remaining = currentAttachments.filter((attachment, index) => (
        !(index === item.index && attachment.url === item.attachment.url)
      ));
      await updateMoodLog(
        item.log.id,
        item.log.mood,
        item.log.note,
        item.log.metrics,
        remaining.length ? remaining : null
      );
      setNotice('Đã xóa media khỏi check-in, ghi chú vẫn được giữ lại.');
    } catch (error) {
      console.error('Remove media failed:', error);
      setNotice('Không xóa được media. Hãy thử lại sau.');
    } finally {
      setDeletingId('');
    }
  };

  return (
    <div className="storage-page">
      <section className="storage-hero">
        <div>
          <span className="storage-kicker">Dung lượng Firebase</span>
          <h1>Quản lý media để không đầy 1GB quá nhanh</h1>
          <p>Xem tệp nào đang chiếm nhiều dung lượng, rà lại video lớn hoặc file cũ, rồi xóa media khỏi check-in mà vẫn giữ nguyên ghi chú.</p>
        </div>
        <div className="storage-usage-card">
          <span>Đã ghi nhận</span>
          <strong>{formatBytes(stats.total)}</strong>
          <div className="storage-progress">
            <i style={{ width: `${usagePercent}%` }} />
          </div>
          <small>{usagePercent}% của 1GB miễn phí</small>
        </div>
      </section>

      <section className="storage-stats-grid">
        <div><span>Tổng tệp</span><strong>{stats.count}</strong></div>
        <div><span>Ảnh</span><strong>{stats.image || 0}</strong></div>
        <div><span>Video</span><strong>{stats.video || 0}</strong></div>
        <div><span>Âm thanh</span><strong>{stats.audio || 0}</strong></div>
      </section>

      <section className="storage-warning-card">
        <div>
          <strong>Video là nhóm dễ làm đầy Storage nhất</strong>
          <p>MindBuddy sẽ cảnh báo khi bạn chọn video trên 50MB. Với video dài, nên cắt ngắn hoặc để backend nén trước khi upload.</p>
        </div>
        <Link to="/mood" className="btn btn-primary">Thêm check-in</Link>
      </section>

      <section className="storage-highlights">
        <article className="storage-panel">
          <div className="storage-panel-head">
            <h2>Video lớn nhất</h2>
            <button type="button" onClick={() => setKindFilter('large-video')}>Xem video lớn</button>
          </div>
          {largestVideos.length ? largestVideos.map(item => (
            <div key={item.id} className="storage-mini-row">
              <span>{attachmentIcon(item.attachment.kind)}</span>
              <div>
                <strong title={item.attachment.name || ''}>{item.displayName}</strong>
                <small>{format(new Date(item.date), 'dd/MM/yyyy HH:mm')} · {formatBytes(item.size)}</small>
              </div>
            </div>
          )) : <p className="storage-muted">Chưa có video nào.</p>}
        </article>

        <article className="storage-panel">
          <div className="storage-panel-head">
            <h2>File cũ</h2>
            <button type="button" onClick={() => setKindFilter('old')}>Xem file cũ</button>
          </div>
          {oldFiles.length ? oldFiles.map(item => (
            <div key={item.id} className="storage-mini-row">
              <span>{attachmentIcon(item.attachment.kind)}</span>
              <div>
                <strong title={item.attachment.name || ''}>{item.displayName}</strong>
                <small>{item.ageDays} ngày trước · {formatBytes(item.size)}</small>
              </div>
            </div>
          )) : <p className="storage-muted">Chưa có file nào cũ hơn {OLD_FILE_DAYS} ngày.</p>}
        </article>
      </section>

      <section className="storage-list-card">
        <div className="storage-list-head">
          <div>
            <h2>Danh sách media</h2>
            <p>{filteredItems.length}/{items.length} tệp đang được hiển thị.</p>
          </div>
          <div className="storage-controls">
            <select value={kindFilter} onChange={event => setKindFilter(event.target.value)}>
              <option value="all">Tất cả</option>
              <option value="image">Ảnh</option>
              <option value="video">Video</option>
              <option value="audio">Âm thanh</option>
              <option value="large-video">Video ≥ 50MB</option>
              <option value="old">File cũ</option>
            </select>
            <select value={sortMode} onChange={event => setSortMode(event.target.value)}>
              <option value="largest">Dung lượng lớn nhất</option>
              <option value="oldest">Cũ nhất</option>
              <option value="newest">Mới nhất</option>
            </select>
          </div>
        </div>

        {notice && <p className="storage-notice">{notice}</p>}

        {filteredItems.length ? (
          <div className="storage-file-list">
            {filteredItems.map(item => (
              <article key={item.id} className="storage-file-row">
                <div className="storage-file-preview">
                  {item.attachment.kind === 'image' ? (
                    <img src={item.attachment.url} alt={item.displayName} loading="lazy" />
                  ) : item.attachment.kind === 'video' ? (
                    <video src={item.attachment.url} muted preload="metadata" />
                  ) : (
                    <span>{attachmentIcon(item.attachment.kind)}</span>
                  )}
                </div>
                <div className="storage-file-main">
                  <div>
                    <strong title={item.attachment.name || ''}>{item.displayName}</strong>
                    <span>{item.mood?.emoji} {item.mood?.label || 'Không rõ'} · {format(new Date(item.date), 'EEEE, dd/MM/yyyy HH:mm', { locale: vi })}</span>
                  </div>
                  <p>{item.note || 'Không có ghi chú đi kèm.'}</p>
                  <div className="storage-file-tags">
                    <i>{formatBytes(item.size)}</i>
                    <i>{attachmentIcon(item.attachment.kind)} {item.attachment.kind}</i>
                    {item.ageDays >= OLD_FILE_DAYS && <i>{item.ageDays} ngày trước</i>}
                    {!item.hasStoragePath && <i>Không có path Firebase</i>}
                  </div>
                </div>
                <div className="storage-file-actions">
                  <a href={item.attachment.url} target="_blank" rel="noreferrer" className="btn btn-secondary">Mở</a>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => removeMedia(item)}
                    disabled={deletingId === item.id}
                  >
                    {deletingId === item.id ? 'Đang xóa...' : 'Xóa media'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="storage-empty">
            <div aria-hidden="true">🧹</div>
            <h2>Không có media trong bộ lọc này</h2>
            <p>Thử đổi bộ lọc hoặc thêm ảnh/video/audio vào check-in.</p>
          </div>
        )}
      </section>
    </div>
  );
}
