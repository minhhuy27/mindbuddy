import React from 'react';

export default function MoodExport({
  exportOptions,
  setExportOptions,
  exportMonth,
  setExportMonth,
  exportYear,
  setExportYear,
  exporting,
  moodLogsCount,
  onExportMonth,
  onExportAll,
}) {
  return (
    <div className="tracker-tab-panel export-tab-panel">
      <div className="card export-panel-card">
        <div>
          <h3>Xuất nhật ký cảm xúc</h3>
          <p className="text-muted">Tạo file PDF để lưu lại hoặc đọc lại ngoài MindBuddy.</p>
        </div>
        <div className="export-filters-panel">
          <div className="export-filters-head">
            <h4>Tùy chọn xuất</h4>
            <p className="text-muted">Chọn phạm vi và mức chi tiết trước khi tạo PDF.</p>
          </div>
          <div className="export-filter-grid">
            <label>
              <span>Riêng tư</span>
              <select
                value={exportOptions.privacy}
                onChange={e => setExportOptions(prev => ({ ...prev, privacy: e.target.value }))}
              >
                <option value="all">Xuất tất cả note</option>
                <option value="nonPrivate">Chỉ note không riêng tư AI</option>
              </select>
            </label>
            <label>
              <span>Thời gian</span>
              <select
                value={exportOptions.range}
                onChange={e => setExportOptions(prev => ({ ...prev, range: e.target.value }))}
              >
                <option value="selected">Theo lựa chọn bên dưới</option>
                <option value="currentMonth">Chỉ tháng này</option>
              </select>
            </label>
            <label>
              <span>Nội dung</span>
              <select
                value={exportOptions.detail}
                onChange={e => setExportOptions(prev => ({ ...prev, detail: e.target.value }))}
              >
                <option value="full">Mood, chỉ số và nội dung note</option>
                <option value="metricsOnly">Chỉ mood + chỉ số</option>
              </select>
            </label>
            <label className="export-check-option">
              <input
                type="checkbox"
                checked={exportOptions.includeImages}
                onChange={e => setExportOptions(prev => ({ ...prev, includeImages: e.target.checked }))}
              />
              <span>Xuất kèm ảnh</span>
            </label>
          </div>
        </div>
        <div className="export-panel-grid">
          <div className="export-option">
            <h4>Xuất theo tháng</h4>
            <p className="text-muted">Phù hợp khi bạn muốn nhìn lại một giai đoạn ngắn.</p>
            <div className="export-row">
              <select value={exportMonth} onChange={e => setExportMonth(+e.target.value)}>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i} value={i}>Tháng {i + 1}</option>
                ))}
              </select>
              <select value={exportYear} onChange={e => setExportYear(+e.target.value)}>
                {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <button
              className="btn btn-primary w-full"
              onClick={onExportMonth}
              disabled={!!exporting}
            >
              {exporting === 'month' ? 'Đang xuất...' : 'Xuất PDF tháng'}
            </button>
          </div>

          <div className="export-option">
            <h4>Xuất toàn bộ</h4>
            <p className="text-muted">Gồm tất cả ghi chú cảm xúc hiện có trong tài khoản.</p>
            <div className="export-total">
              <strong>{moodLogsCount}</strong>
              <span>ghi chú cảm xúc</span>
            </div>
            <button
              className="btn btn-secondary w-full"
              onClick={onExportAll}
              disabled={!!exporting || moodLogsCount === 0}
            >
              {exporting === 'all' ? 'Đang xuất...' : 'Xuất tất cả'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
