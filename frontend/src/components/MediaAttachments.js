import React from 'react';
import { normalizeMoodAttachments } from '../utils/moodImages';
import './MediaAttachments.css';

export default function MediaAttachments({ attachments, label = 'Tệp check-in', onOpenImage, compact = false }) {
  const items = normalizeMoodAttachments(attachments);
  if (!items.length) return null;

  return (
    <div className={`media-attachments ${compact ? 'compact' : ''}`}>
      {items.map((item, index) => {
        const itemLabel = `${label} ${index + 1}`;
        if (item.kind === 'image') {
          const content = <img src={item.url} alt={itemLabel} />;
          return onOpenImage ? (
            <button
              key={`${item.url}-${index}`}
              type="button"
              className="media-attachment image"
              onClick={() => onOpenImage(item, itemLabel)}
              aria-label={`Xem ${itemLabel} ở dạng lớn`}
            >
              {content}
            </button>
          ) : (
            <div key={`${item.url}-${index}`} className="media-attachment image static">
              {content}
            </div>
          );
        }
        if (item.kind === 'video') {
          return (
            <div key={`${item.url}-${index}`} className="media-attachment video">
              <video src={item.url} controls preload="metadata" />
              <span>{item.name || itemLabel}</span>
            </div>
          );
        }
        if (item.kind === 'audio') {
          return (
            <div key={`${item.url}-${index}`} className="media-attachment audio">
              <span>Âm thanh: {item.name || itemLabel}</span>
              <audio src={item.url} controls preload="metadata" />
            </div>
          );
        }
        return (
          <a key={`${item.url}-${index}`} className="media-attachment file" href={item.url} target="_blank" rel="noreferrer">
            Tệp: {item.name || itemLabel}
          </a>
        );
      })}
    </div>
  );
}
