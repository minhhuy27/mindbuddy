import React, { useState } from 'react';
import { EMOJI_SUGGESTIONS, SCORE_OPTIONS } from './constants';

// Modal tạo / chỉnh sửa custom mood
export default function CustomMoodModal({ onClose, onSave }) {
  const [emoji, setEmoji] = useState('😤');
  const [label, setLabel] = useState('');
  const [score, setScore] = useState(2);
  const [color] = useState('#fd79a8');
  const [customEmoji, setCustomEmoji] = useState('');
  const [error, setError] = useState('');

  const activeEmoji = customEmoji || emoji;
  const activeColor = SCORE_OPTIONS.find(s => s.value === score)?.color || color;

  const handleSave = () => {
    if (!label.trim()) { setError('Vui lòng đặt tên cho cảm xúc.'); return; }
    if (!activeEmoji) { setError('Vui lòng chọn emoji.'); return; }
    onSave({ emoji: activeEmoji, label: label.trim(), color: activeColor, score });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <h3>✨ Thêm cảm xúc mới</h3>
          <button className="modal-close" onClick={onClose} aria-label="Đóng hộp thoại thêm cảm xúc">✕</button>
        </div>

        {/* Preview */}
        <div className="mood-preview" style={{ '--mood-color': activeColor }}>
          <span className="preview-emoji">{activeEmoji}</span>
          <span className="preview-label">{label || 'Tên cảm xúc'}</span>
        </div>

        {/* Emoji picker */}
        <div className="modal-section">
          <label className="modal-label">Chọn emoji</label>
          <div className="emoji-grid">
            {EMOJI_SUGGESTIONS.map(e => (
              <button
                key={e}
                className={`emoji-btn ${emoji === e && !customEmoji ? 'active' : ''}`}
                onClick={() => { setEmoji(e); setCustomEmoji(''); }}
              >{e}</button>
            ))}
          </div>
          <div className="custom-emoji-row">
            <input
              value={customEmoji}
              onChange={e => setCustomEmoji(e.target.value)}
              placeholder="Hoặc nhập emoji bất kỳ..."
              maxLength={4}
              style={{ width: 180 }}
            />
            {customEmoji && (
              <button className="btn btn-secondary" style={{ padding: '6px 12px' }}
                onClick={() => setCustomEmoji('')}>Xóa</button>
            )}
          </div>
        </div>

        {/* Tên cảm xúc */}
        <div className="modal-section">
          <label className="modal-label">Tên cảm xúc <span style={{ color: 'var(--danger)' }}>*</span></label>
          <input
            value={label}
            onChange={e => { setLabel(e.target.value); setError(''); }}
            placeholder="Ví dụ: Tức giận, Mệt mỏi, Hào hứng..."
            maxLength={20}
          />
          <span className="char-count">{label.length}/20</span>
        </div>

        {/* Mức độ cảm xúc */}
        <div className="modal-section">
          <label className="modal-label">Mức độ cảm xúc</label>
          <div className="score-options">
            {SCORE_OPTIONS.map(s => (
              <button
                key={s.value}
                className={`score-btn ${score === s.value ? 'active' : ''}`}
                style={{ '--score-color': s.color }}
                onClick={() => setScore(s.value)}
              >
                <span className="score-dot" />
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="modal-error">{error}</p>}

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Hủy</button>
          <button className="btn btn-primary" onClick={handleSave}>Thêm cảm xúc</button>
        </div>
      </div>
    </div>
  );
}
