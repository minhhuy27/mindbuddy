import React from 'react';
import { format } from 'date-fns';
import { causeTagStyle, causeTagTitle } from '../../utils/causeTags';
import RichText from '../../components/RichText';
import MediaAttachments from '../../components/MediaAttachments';
import { METRIC_FIELDS, dayLabel, logAttachments, normalizeMetrics } from './constants';

export default function DayDetailModal({
  selectedDayDetail,
  allMoods,
  onClose,
  onOpenPhotoLightbox,
}) {
  if (!selectedDayDetail) return null;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box day-detail-modal">
        <div className="modal-header">
          <h3>Chi tiết {dayLabel(selectedDayDetail.dayKey)}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Đóng chi tiết ngày">✕</button>
        </div>
        <div className="day-detail-list">
          {selectedDayDetail.logs.map(log => {
            const mood = allMoods.find(m => m.id === log.mood);
            const cleanNote = log.note?.replace(/\s*\[.+\]$/, '') || '';
            const causeTags = log.note?.match(/\[(.+)\]/)?.[1]?.split(', ') || [];
            const logMetrics = log.metrics ? normalizeMetrics(log.metrics) : null;
            const attachments = logAttachments(log);
            return (
              <div key={log.id} className="day-detail-entry" style={{ '--entry-color': mood?.color || '#ccc' }}>
                <div className="day-detail-entry-head">
                  <span className="day-detail-mood">{mood?.emoji} {mood?.label}</span>
                  <span className="day-detail-time">{format(new Date(log.date), 'HH:mm')}</span>
                </div>
                {causeTags.length > 0 && (
                  <div className="entry-causes">
                    {causeTags.map(t => (
                      <span
                        key={t}
                        className="entry-cause-tag"
                        style={causeTagStyle(t)}
                        title={causeTagTitle(t)}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                {logMetrics && (
                  <div className="entry-metrics">
                    {METRIC_FIELDS.map(field => (
                      <span key={field.id} className={`entry-metric metric-${field.id}`}>
                        {field.label}: {logMetrics[field.id]}
                      </span>
                    ))}
                  </div>
                )}
                <MediaAttachments
                  attachments={attachments}
                  label={`Tệp check-in lúc ${format(new Date(log.date), 'HH:mm')}`}
                  date={log.date}
                  onOpenImage={onOpenPhotoLightbox}
                />
                <RichText text={cleanNote} fallback="Không có ghi chú thêm." className="entry-note" />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
