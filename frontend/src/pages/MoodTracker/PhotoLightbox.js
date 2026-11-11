import React, { useState, useCallback, useEffect } from 'react';
import { PHOTO_ZOOM_MAX, PHOTO_ZOOM_MIN, PHOTO_ZOOM_STEP } from './constants';

export default function PhotoLightbox({ photoLightbox, onClose, onMove }) {
  const [photoZoom, setPhotoZoom] = useState(1);
  const [photoZoomOrigin, setPhotoZoomOrigin] = useState({ x: 50, y: 50 });

  const resetPhotoZoom = useCallback(() => {
    setPhotoZoom(1);
    setPhotoZoomOrigin({ x: 50, y: 50 });
  }, []);

  const closeLightbox = useCallback(() => {
    resetPhotoZoom();
    onClose();
  }, [onClose, resetPhotoZoom]);

  const moveLightbox = useCallback((direction) => {
    resetPhotoZoom();
    onMove(direction);
  }, [onMove, resetPhotoZoom]);

  useEffect(() => {
    resetPhotoZoom();
  }, [photoLightbox?.index, photoLightbox?.items, resetPhotoZoom]);

  const handlePhotoLightboxWheel = useCallback((event) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width && rect.height) {
      setPhotoZoomOrigin({
        x: Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100)),
        y: Math.min(100, Math.max(0, ((event.clientY - rect.top) / rect.height) * 100)),
      });
    }

    const direction = event.deltaY < 0 ? 1 : -1;
    setPhotoZoom(current => {
      const next = current + direction * PHOTO_ZOOM_STEP;
      return Math.min(PHOTO_ZOOM_MAX, Math.max(PHOTO_ZOOM_MIN, Number(next.toFixed(2))));
    });
  }, []);

  useEffect(() => {
    if (!photoLightbox) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeLightbox();
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        moveLightbox(-1);
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        moveLightbox(1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeLightbox, moveLightbox, photoLightbox]);

  if (!photoLightbox) return null;

  const lightboxItems = photoLightbox.items || [];
  const activeLightboxItem = lightboxItems[photoLightbox.index || 0] || null;
  const lightboxCount = lightboxItems.length;
  const lightboxPosition = (photoLightbox.index || 0) + 1;
  const activeLightboxLabel = `${photoLightbox.label}${lightboxCount > 1 ? ` · ${lightboxPosition}/${lightboxCount}` : ''}`;

  return (
    <div className="photo-lightbox-overlay" onClick={e => e.target === e.currentTarget && closeLightbox()}>
      <div className="photo-lightbox" role="dialog" aria-modal="true" aria-label={activeLightboxLabel}>
        <div className="photo-lightbox-header">
          <span>{activeLightboxLabel}</span>
          <button type="button" onClick={closeLightbox} aria-label="Đóng ảnh lớn">×</button>
        </div>
        <div
          className={`photo-lightbox-stage ${photoZoom > 1 ? 'is-zoomed' : ''}`}
          onWheel={handlePhotoLightboxWheel}
        >
          {lightboxCount > 1 && (
            <button
              type="button"
              className="photo-lightbox-nav prev"
              onClick={() => moveLightbox(-1)}
              aria-label="Xem ảnh trước"
            >
              ‹
            </button>
          )}
          {activeLightboxItem && (
            <img
              src={activeLightboxItem.url}
              alt={activeLightboxLabel}
              style={{
                '--photo-zoom': photoZoom,
                '--photo-origin-x': `${photoZoomOrigin.x}%`,
                '--photo-origin-y': `${photoZoomOrigin.y}%`,
              }}
            />
          )}
          {lightboxCount > 1 && (
            <button
              type="button"
              className="photo-lightbox-nav next"
              onClick={() => moveLightbox(1)}
              aria-label="Xem ảnh tiếp theo"
            >
              ›
            </button>
          )}
          {lightboxCount > 1 && (
            <div className="photo-lightbox-counter" aria-hidden="true">
              {lightboxPosition}/{lightboxCount}
            </div>
          )}
          <div className="photo-lightbox-zoom" aria-hidden="true">
            {Math.round(photoZoom * 100)}%
          </div>
        </div>
      </div>
    </div>
  );
}
