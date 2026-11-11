import React from 'react';
import RichText from '../../components/RichText';
import { displayAttachmentName } from '../../utils/moodImages';
import {
  AUDIO_RECORDING_LIMIT,
  FORMAT_TOOLS,
  JOURNAL_ICON_GROUPS,
  formatDuration,
} from './constants';

export default function MoodNoteEditor({
  note,
  onSetNote,
  onTextareaChange,
  noteTextareaRef,
  showNoteIcons,
  onToggleNoteIcons,
  excludeFromAI,
  onExcludeFromAIChange,
  media,
  saving,
  editingId,
  draftStatus,
  hasDraftContent,
  onClearDraft,
}) {
  const insertNoteIcon = (icon) => {
    const textarea = noteTextareaRef.current;
    if (!textarea) {
      onSetNote(prev => `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}${icon} `);
      return;
    }

    const start = textarea.selectionStart ?? note.length;
    const end = textarea.selectionEnd ?? note.length;
    const before = note.slice(0, start);
    const after = note.slice(end);
    const spacingBefore = before && !/\s$/.test(before) ? ' ' : '';
    const insertText = `${spacingBefore}${icon} `;
    const nextNote = `${before}${insertText}${after}`;

    onSetNote(nextNote);
    window.setTimeout(() => {
      textarea.focus();
      const nextPosition = start + insertText.length;
      textarea.setSelectionRange(nextPosition, nextPosition);
    }, 0);
  };

  const applyNoteFormat = (tool) => {
    const textarea = noteTextareaRef.current;
    const currentNote = note || '';
    const start = textarea?.selectionStart ?? currentNote.length;
    const end = textarea?.selectionEnd ?? currentNote.length;
    const selectedText = currentNote.slice(start, end);
    let insertText = '';
    let nextCursorStart = start;
    let nextCursorEnd = start;

    if (tool.linePrefix) {
      const lineStart = currentNote.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
      const needsNewLine = lineStart !== start && currentNote.slice(lineStart, start).trim().length > 0;
      const prefix = needsNewLine ? `\n${tool.linePrefix}` : tool.linePrefix;
      insertText = `${prefix}${selectedText || tool.sample}`;
      nextCursorStart = start + prefix.length;
      nextCursorEnd = nextCursorStart + (selectedText || tool.sample).length;
    } else {
      insertText = `${tool.prefix}${selectedText || tool.sample}${tool.suffix}`;
      nextCursorStart = start + tool.prefix.length;
      nextCursorEnd = nextCursorStart + (selectedText || tool.sample).length;
    }

    const nextNote = `${currentNote.slice(0, start)}${insertText}${currentNote.slice(end)}`;
    onSetNote(nextNote);
    window.setTimeout(() => {
      textarea?.focus();
      textarea?.setSelectionRange(nextCursorStart, nextCursorEnd);
    }, 0);
  };

  return (
    <div className="mt-3" onPaste={media.handleMediaPaste}>
      <div className="note-label-row">
        <label className="form-label" htmlFor="mood-note-input">Ghi chú thêm</label>
        <button
          type="button"
          className={`note-icon-toggle ${showNoteIcons ? 'active' : ''}`}
          onClick={onToggleNoteIcons}
          aria-expanded={showNoteIcons}
          aria-controls="journal-icon-picker"
        >
          ✨ Chèn icon
        </button>
      </div>
      {showNoteIcons && (
        <div className="journal-icon-picker" id="journal-icon-picker">
          {JOURNAL_ICON_GROUPS.map(group => (
            <div className="journal-icon-group" key={group.label}>
              <span>{group.label}</span>
              <div className="journal-icon-row">
                {group.icons.map(icon => (
                  <button
                    key={`${group.label}-${icon}`}
                    type="button"
                    className="journal-icon-btn"
                    onClick={() => insertNoteIcon(icon)}
                    aria-label={`Chèn icon ${icon} vào ghi chú`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="note-format-toolbar" aria-label="Định dạng ghi chú">
        {FORMAT_TOOLS.map(tool => (
          <button
            key={tool.id}
            type="button"
            className={`format-tool-btn ${tool.id}`}
            onClick={() => applyNoteFormat(tool)}
            title={tool.title}
            aria-label={tool.title}
          >
            {tool.label}
          </button>
        ))}
      </div>
      <textarea
        id="mood-note-input"
        ref={noteTextareaRef}
        value={note}
        onChange={e => onTextareaChange(e.target.value)}
        placeholder="Hôm nay có chuyện gì xảy ra..."
        rows={4}
      />
      {note.trim() && (
        <div className="note-preview-box">
          <span>Xem trước ghi chú</span>
          <RichText text={note} className="note-preview-content" />
        </div>
      )}
      <label className={`ai-privacy-toggle ${excludeFromAI ? 'active' : ''}`}>
        <input
          type="checkbox"
          checked={excludeFromAI}
          onChange={e => onExcludeFromAIChange(e.target.checked)}
        />
        <span className="ai-privacy-icon" aria-hidden="true">🔒</span>
        <span>
          <strong>Không gửi dòng này cho AI</strong>
          <small>Vẫn lưu trong nhật ký, nhưng bỏ qua khi tạo insight, chat memory và nhìn lại ngày bằng AI.</small>
        </span>
      </label>
      <div
        className={`checkin-photo-field ${media.mediaDropActive ? 'drop-active' : ''}`}
        onDragEnter={media.handleMediaDragEnter}
        onDragOver={media.handleMediaDragOver}
        onDragLeave={media.handleMediaDragLeave}
        onDrop={media.handleMediaDrop}
      >
        <div className="photo-field-head">
          <div>
            <strong>Tệp check-in</strong>
            <span>Thêm ảnh, video hoặc âm thanh để sau này nhớ ngữ cảnh hơn. Có thể kéo thả hoặc dán tệp vào đây.</span>
          </div>
          <div className="photo-field-actions">
            <button
              type="button"
              className="btn-photo-select"
              onClick={() => media.cameraInputRef.current?.click()}
              disabled={media.recordingState !== 'idle'}
            >
              📸 Chụp ảnh
            </button>
            <button
              type="button"
              className="btn-photo-select"
              onClick={() => media.imageInputRef.current?.click()}
              disabled={media.recordingState !== 'idle'}
            >
              📎 Chọn tệp
            </button>
          </div>
        </div>
        <div className="quick-record-row">
          <button
            type="button"
            className={`btn-audio-record ${media.recordingState === 'recording' ? 'recording' : ''}`}
            onClick={media.recordingState === 'recording' ? media.stopAudioRecording : media.startAudioRecording}
            disabled={saving || media.recordingState === 'stopping'}
          >
            {media.recordingState === 'recording'
              ? `Dừng ${formatDuration(media.recordingSeconds)}`
              : media.recordingState === 'stopping'
                ? 'Đang xử lý...'
                : '🎙️ Ghi âm nhanh'}
          </button>
          {media.recordingState !== 'idle' && (
            <div className="recording-status" role="status">
              <span className="recording-pulse" />
              <strong>{media.recordingState === 'recording' ? 'Đang ghi âm' : 'Đang tạo tệp ghi âm'}</strong>
              <small>{formatDuration(media.recordingSeconds)} / {formatDuration(AUDIO_RECORDING_LIMIT)}</small>
            </div>
          )}
        </div>
        <input
          ref={media.cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={media.handleImageSelect}
          hidden
        />
        <input
          ref={media.imageInputRef}
          type="file"
          accept="image/*,video/*,audio/*"
          multiple
          onChange={media.handleImageSelect}
          hidden
        />
        {media.mediaDropActive && (
          <div className="media-drop-overlay" aria-hidden="true">
            Thả tệp vào đây
          </div>
        )}
        {(media.existingImages.length > 0 || media.imagePreviews.length > 0) && (
          <div className="checkin-photo-grid">
            {media.existingImages.map((image, index) => (
              <div key={`${image.url}-${index}`} className="checkin-photo-preview">
                {image.kind === 'image' && <img src={image.url} alt={`Ảnh check-in đã lưu ${index + 1}`} />}
                {image.kind === 'video' && <video src={image.url} muted preload="metadata" />}
                {image.kind === 'audio' && (
                  <div className="media-file-preview audio-preview">
                    🎧
                    <span title={image.name}>{displayAttachmentName(image)}</span>
                    <audio src={image.url} controls preload="metadata" />
                  </div>
                )}
                <button type="button" onClick={() => media.removeExistingImageAt(index)}>Bỏ tệp</button>
              </div>
            ))}
            {media.imagePreviews.map((preview, index) => (
              <div key={preview.id} className="checkin-photo-preview">
                {preview.file.type.startsWith('image/') && <img src={preview.url} alt={`Ảnh check-in xem trước ${index + 1}`} />}
                {preview.file.type.startsWith('video/') && <video src={preview.url} muted preload="metadata" />}
                {preview.file.type.startsWith('audio/') && (
                  <div className="media-file-preview audio-preview">
                    🎧
                    <span title={preview.file.name}>{displayAttachmentName({ type: preview.file.type, kind: preview.file.type?.startsWith('audio/') ? 'audio' : 'file' }, { date: new Date() })}</span>
                    <audio src={preview.url} controls preload="metadata" />
                  </div>
                )}
                <button type="button" onClick={() => media.removeSelectedImage(index)}>
                  Bỏ tệp
                </button>
              </div>
            ))}
          </div>
        )}
        {media.imageError && <p className="photo-error" role="alert">{media.imageError}</p>}
      </div>
      {(draftStatus || hasDraftContent) && !editingId && (
        <div className="draft-status-row" role="status">
          <span>{draftStatus || 'Nháp hôm nay đang được giữ lại.'}</span>
          {hasDraftContent && (
            <button type="button" onClick={onClearDraft}>
              Xóa nháp
            </button>
          )}
        </div>
      )}
    </div>
  );
}
