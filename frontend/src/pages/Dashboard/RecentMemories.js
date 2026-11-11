import React from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

export default function RecentMemories({ recentPhotoLogs, onMemoryClick }) {
  return (
    <section className="card recent-memories-card dashboard-custom-block">
      <div className="section-heading-row">
        <div>
          <h3>Tệp gần đây</h3>
          <p className="text-muted">Bấm vào tệp để mở lại cảm xúc và ghi chú đi kèm.</p>
        </div>
        <Link to="/mood?tab=history" className="quick-link">Mở lịch sử</Link>
      </div>

      {recentPhotoLogs.length > 0 ? (
        <div className="memory-photo-strip" aria-label="Tệp check-in gần đây">
          {recentPhotoLogs.map(log => (
            <button
              key={log.photoId}
              type="button"
              className="memory-photo-tile"
              onClick={() => onMemoryClick(log)}
              aria-label={`Mở ghi chú tệp ngày ${format(new Date(log.date), 'dd/MM/yyyy')} lúc ${format(new Date(log.date), 'HH:mm')}`}
            >
              {log.attachment?.kind === 'video' ? (
                <video src={log.imageUrl} muted preload="metadata" />
              ) : log.attachment?.kind === 'audio' ? (
                <div className="memory-media-placeholder">Audio</div>
              ) : (
                <img src={log.imageUrl} alt={`Tệp check-in ${log.mood?.label || 'không rõ'} lúc ${format(new Date(log.date), 'HH:mm')}`} />
              )}
              <span>{format(new Date(log.date), 'dd/MM')}{log.attachments.length > 1 ? ` · ${log.attachmentIndex + 1}/${log.attachments.length}` : ''}</span>
              <strong>{log.mood?.emoji} {log.mood?.label || 'Không rõ'}</strong>
            </button>
          ))}
        </div>
      ) : (
        <div className="memory-empty">
          <span aria-hidden="true">🖼️</span>
          <div>
            <strong>Chưa có tệp check-in</strong>
            <p>Lần tới khi ghi cảm xúc, thêm một ảnh, video hoặc ghi âm ngắn để MindBuddy lưu lại ngữ cảnh của ngày đó.</p>
          </div>
        </div>
      )}
    </section>
  );
}
