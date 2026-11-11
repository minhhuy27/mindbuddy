import React, { useState } from 'react';
import { causeTagStyle, causeTagTitle } from '../../utils/causeTags';
import { DEFAULT_CAUSES } from './constants';

export default function CauseTagPicker({
  activeCauses,
  causes,
  onToggleCause,
  onUpdateCauses,
  saveCauseOptions,
}) {
  const [causeEditorOpen, setCauseEditorOpen] = useState(false);
  const [newCause, setNewCause] = useState('');
  const [editingCause, setEditingCause] = useState('');
  const [editingCauseValue, setEditingCauseValue] = useState('');
  const [causeError, setCauseError] = useState('');

  const saveCausesSafely = async (next) => {
    setCauseError('');
    await saveCauseOptions(next);
  };

  const addCauseOption = async () => {
    const value = newCause.trim();
    if (!value) return;
    if (activeCauses.some(c => c.toLowerCase() === value.toLowerCase())) {
      setCauseError('Nguyên nhân này đã có trong danh sách.');
      return;
    }
    await saveCausesSafely([...activeCauses, value]);
    setNewCause('');
  };

  const startEditCause = (cause) => {
    setEditingCause(cause);
    setEditingCauseValue(cause);
    setCauseError('');
  };

  const saveEditedCause = async () => {
    const value = editingCauseValue.trim();
    if (!editingCause || !value) return;
    if (activeCauses.some(c => c !== editingCause && c.toLowerCase() === value.toLowerCase())) {
      setCauseError('Tên nguyên nhân này đã tồn tại.');
      return;
    }
    const next = activeCauses.map(c => c === editingCause ? value : c);
    await saveCausesSafely(next);
    onUpdateCauses(prev => prev.map(c => c === editingCause ? value : c));
    setEditingCause('');
    setEditingCauseValue('');
  };

  const deleteCauseOption = async (cause) => {
    const next = activeCauses.filter(c => c !== cause);
    await saveCausesSafely(next);
    onUpdateCauses(prev => prev.filter(c => c !== cause));
    if (editingCause === cause) {
      setEditingCause('');
      setEditingCauseValue('');
    }
  };

  const resetCauseOptions = async () => {
    await saveCausesSafely(DEFAULT_CAUSES);
    onUpdateCauses(prev => prev.filter(c => DEFAULT_CAUSES.includes(c)));
    setEditingCause('');
    setEditingCauseValue('');
    setNewCause('');
  };

  return (
    <div className="mt-4">
      <div className="cause-heading-row">
        <label className="form-label">Nguyên nhân (tùy chọn)</label>
        <button
          type="button"
          className={`cause-manage-toggle ${causeEditorOpen ? 'active' : ''}`}
          onClick={() => setCauseEditorOpen(open => !open)}
        >
          Tùy chỉnh
        </button>
      </div>
      <div className="causes-grid">
        {activeCauses.map(c => (
          <div key={c} className="cause-chip-wrap">
            <button
              type="button"
              className={`cause-btn ${causes.includes(c) ? 'active' : ''}`}
              style={causeTagStyle(c)}
              title={causeTagTitle(c)}
              aria-pressed={causes.includes(c)}
              aria-label={`Chọn nguyên nhân ${c}`}
              onClick={() => onToggleCause(c)}
            >
              {c}
            </button>
            {causeEditorOpen && (
              <div className="cause-chip-actions">
                <button type="button" onClick={() => startEditCause(c)} aria-label={`Sửa nguyên nhân ${c}`}>✎</button>
                <button type="button" onClick={() => deleteCauseOption(c)} aria-label={`Xóa nguyên nhân ${c}`}>×</button>
              </div>
            )}
          </div>
        ))}
      </div>
      {causeEditorOpen && (
        <div className="cause-editor-panel">
          <div className="cause-editor-row">
            <input
              value={newCause}
              onChange={e => {
                setNewCause(e.target.value);
                setCauseError('');
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCauseOption();
                }
              }}
              placeholder="Thêm nguyên nhân mới..."
              maxLength={28}
            />
            <button type="button" className="btn btn-secondary" onClick={addCauseOption}>Thêm</button>
          </div>
          {editingCause && (
            <div className="cause-editor-row">
              <input
                value={editingCauseValue}
                onChange={e => {
                  setEditingCauseValue(e.target.value);
                  setCauseError('');
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    saveEditedCause();
                  }
                  if (e.key === 'Escape') {
                    setEditingCause('');
                    setEditingCauseValue('');
                  }
                }}
                maxLength={28}
                aria-label={`Sửa nguyên nhân ${editingCause}`}
              />
              <button type="button" className="btn btn-primary" onClick={saveEditedCause}>Lưu</button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => { setEditingCause(''); setEditingCauseValue(''); }}
              >
                Hủy
              </button>
            </div>
          )}
          <div className="cause-editor-footer">
            <span>{activeCauses.length} nguyên nhân</span>
            <button type="button" onClick={resetCauseOptions}>Đặt lại mặc định</button>
          </div>
          {causeError && <p className="cause-error" role="alert">{causeError}</p>}
        </div>
      )}
    </div>
  );
}
