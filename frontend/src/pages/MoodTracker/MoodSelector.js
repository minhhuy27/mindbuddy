import React from 'react';

export default function MoodSelector({
  moods,
  customMoods,
  selected,
  onSelect,
  onOpenModal,
  onDeleteCustomMood,
}) {
  return (
    <>
      {/* Built-in moods */}
      <label className="form-label">Cảm xúc có sẵn</label>
      <div className="mood-options">
        {moods.map(m => (
          <button
            key={m.id}
            className={`mood-btn ${selected === m.id ? 'selected' : ''}`}
            style={{ '--mood-color': m.color }}
            aria-pressed={selected === m.id}
            aria-label={`Chọn cảm xúc ${m.label}`}
            onClick={() => onSelect(m.id)}
          >
            <span className="mood-emoji">{m.emoji}</span>
            <span className="mood-label">{m.label}</span>
          </button>
        ))}
      </div>

      {/* Custom moods */}
      <div className="custom-moods-section mt-3">
        <div className="custom-moods-header">
          <label className="form-label" style={{ margin: 0 }}>Cảm xúc của tôi</label>
          <button
            className="btn-add-mood"
            onClick={onOpenModal}
            title="Thêm cảm xúc mới"
            aria-label="Thêm cảm xúc mới"
          >
            + Thêm
          </button>
        </div>

        {(!customMoods || customMoods.length === 0) ? (
          <p className="custom-moods-empty">
            Chưa có cảm xúc tùy chỉnh.{' '}
            <button className="link-btn" onClick={onOpenModal}>
              Thêm ngay →
            </button>
          </p>
        ) : (
          <div className="mood-options mt-2">
            {customMoods.map(m => (
              <div key={m.id} className="mood-btn-wrapper">
                <button
                  className={`mood-btn ${selected === m.id ? 'selected' : ''}`}
                  style={{ '--mood-color': m.color }}
                  aria-pressed={selected === m.id}
                  aria-label={`Chọn cảm xúc tùy chỉnh ${m.label}`}
                  onClick={() => onSelect(m.id)}
                >
                  <span className="mood-emoji">{m.emoji}</span>
                  <span className="mood-label">{m.label}</span>
                </button>
                <button
                  className="mood-btn-delete"
                  onClick={(e) => onDeleteCustomMood(m.id, e)}
                  title="Xóa cảm xúc này"
                  aria-label={`Xóa cảm xúc ${m.label}`}
                >✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
