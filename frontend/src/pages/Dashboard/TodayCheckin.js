import React from 'react';
import { Link } from 'react-router-dom';
import RichText from '../../components/RichText';
import { displayAttachmentName } from '../../utils/moodImages';
import { detectDanger } from '../../utils/aiService';

const QUICK_FORMAT_TOOLS = [
  { id: 'bold', label: 'B', title: 'Bôi đậm', prefix: '**', suffix: '**', sample: 'nội dung quan trọng' },
  { id: 'underline', label: 'U', title: 'Gạch chân', prefix: '<u>', suffix: '</u>', sample: 'điều cần nhớ' },
  { id: 'heading', label: 'H', title: 'Tiêu đề', linePrefix: '## ', sample: 'Tiêu đề nhỏ' },
  { id: 'checklist', label: '☑', title: 'Checklist', linePrefix: '- [ ] ', sample: 'việc nhỏ cần làm' },
  { id: 'quote', label: '❝', title: 'Trích dẫn', linePrefix: '> ', sample: 'một câu mình muốn giữ lại' },
];

export default function TodayCheckin({
  visibleQuickMoods,
  quickMood,
  quickNote,
  quickMoodListExpanded,
  extraQuickMoods,
  quickAnalyzing,
  quickSaveStatus,
  quickFeedback,
  quickAiPreview,
  quickAiPreviewStatus,
  quickImagePreviews,
  quickImageError,
  quickImageInputRef,
  quickNoteRef,
  onMoodSelect,
  onToggleQuickMoods,
  onNoteChange,
  onApplyFormat,
  onImageSelect,
  onRemoveImage,
  onCheckin,
  onSaveAiPreview,
  onHideAiPreview,
  onRegenerateAiPreview,
  onImageBtnClick,
  setShowCrisis,
}) {
  return (
    <div className="card today-checkin-card">
      <div className="section-heading-row">
        <div>
          <h3>Check-in nhanh</h3>
          <p className="text-muted">Chọn cảm xúc hiện tại và ghi một dòng nếu bạn muốn.</p>
        </div>
        <Link to="/mood" className="quick-link">Ghi đầy đủ</Link>
      </div>

      <div className="quick-mood-row">
        {visibleQuickMoods.map(m => (
          <button
            key={m.id}
            className={`quick-mood-btn ${quickMood === m.id ? 'selected' : ''}`}
            style={{ '--mood-color': m.color }}
            aria-label={`Chọn cảm xúc ${m.label}`}
            aria-pressed={quickMood === m.id}
            onClick={() => onMoodSelect(m.id)}
          >
            <span aria-hidden="true">{m.emoji}</span>
            <small>{m.label}</small>
          </button>
        ))}
      </div>

      {extraQuickMoods.length > 0 && (
        <div className="quick-mood-more-row">
          <button
            type="button"
            className={`quick-mood-more-btn ${quickMoodListExpanded ? 'active' : ''}`}
            onClick={onToggleQuickMoods}
            aria-expanded={quickMoodListExpanded}
          >
            {quickMoodListExpanded ? 'Thu gọn cảm xúc' : `Xem thêm ${extraQuickMoods.length} cảm xúc`}
          </button>
        </div>
      )}

      <textarea
        ref={quickNoteRef}
        value={quickNote}
        onChange={e => {
          onNoteChange(e.target.value);
          if (detectDanger(e.target.value)) setShowCrisis(true);
        }}
        rows={3}
        placeholder="Điều gì đang ảnh hưởng tới bạn hôm nay?"
        aria-label="Ghi chú cảm xúc nhanh"
      />
      <div className="quick-format-toolbar" aria-label="Định dạng ghi chú nhanh">
        {QUICK_FORMAT_TOOLS.map(tool => (
          <button
            key={tool.id}
            type="button"
            className={`quick-format-btn ${tool.id}`}
            onClick={() => onApplyFormat(tool)}
            title={tool.title}
            aria-label={tool.title}
          >
            {tool.label}
          </button>
        ))}
      </div>
      {quickNote.trim() && (
        <div className="quick-note-preview">
          <span>Xem trước ghi chú</span>
          <RichText text={quickNote} className="quick-note-preview-content" />
        </div>
      )}
      <div className="quick-photo-field">
        <input
          ref={quickImageInputRef}
          type="file"
          accept="image/*,video/*,audio/*"
          multiple
          onChange={onImageSelect}
          hidden
        />
        <button type="button" className="quick-photo-btn" onClick={onImageBtnClick}>
          Thêm tệp
        </button>
        {quickImagePreviews.length > 0 && (
          <div className="quick-photo-preview-grid">
            {quickImagePreviews.map((preview, index) => (
              <div key={preview.id} className="quick-photo-preview">
                {preview.file?.type.startsWith('video/') ? (
                  <video src={preview.url} muted preload="metadata" />
                ) : preview.file?.type.startsWith('audio/') ? (
                  <div className="media-file-preview">
                    <span title={preview.file.name}>{displayAttachmentName({ type: preview.file.type, kind: 'audio' }, { date: new Date() })}</span>
                  </div>
                ) : (
                  <img src={preview.url} alt={`Tệp check-in xem trước ${index + 1}`} />
                )}
                <button type="button" onClick={() => onRemoveImage(index)}>Bỏ tệp</button>
              </div>
            ))}
          </div>
        )}
        {quickImageError && <p className="quick-photo-error" role="alert">{quickImageError}</p>}
      </div>
      <button className="btn btn-primary w-full" onClick={onCheckin} disabled={!quickMood || quickAnalyzing}>
        {quickAnalyzing ? (quickSaveStatus || 'Đang phân tích...') : 'Lưu check-in hôm nay'}
      </button>
      {quickFeedback && <p className="quick-feedback" role="status">{quickFeedback}</p>}
      {quickAiPreview && (
        <div className="quick-ai-preview">
          <div className="quick-ai-preview-header">
            <span>✨ Phân tích AI nháp</span>
            <strong>Chưa lưu</strong>
          </div>
          <p>{quickAiPreview.advice}</p>
          {quickAiPreviewStatus && <small>{quickAiPreviewStatus}</small>}
          <div className="quick-ai-preview-actions">
            <button type="button" className="btn btn-primary" onClick={onSaveAiPreview}>
              Lưu phân tích này
            </button>
            <button type="button" className="btn btn-secondary" onClick={onHideAiPreview}>
              Ẩn khỏi lịch sử
            </button>
            <button type="button" className="btn btn-secondary" onClick={onRegenerateAiPreview} disabled={quickAnalyzing}>
              Tạo lại
            </button>
          </div>
        </div>
      )}
      {!quickAiPreview && quickAiPreviewStatus && (
        <p className="quick-ai-preview-status" role="status">{quickAiPreviewStatus}</p>
      )}
    </div>
  );
}
