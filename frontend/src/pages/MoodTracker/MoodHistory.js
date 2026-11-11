import React from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { format } from 'date-fns';
import { causeTagStyle, causeTagTitle } from '../../utils/causeTags';
import RichText from '../../components/RichText';
import MediaAttachments from '../../components/MediaAttachments';
import MoodCalendar from './MoodCalendar';
import {
  HISTORY_RANGE_OPTIONS,
  METRIC_FIELDS,
  dayLabel,
  historyRangeLabel,
  logAttachments,
  metricSummary,
  normalizeMetrics,
} from './constants';

export default function MoodHistory({
  moodLogs,
  filteredMoodLogs,
  allMoods,
  availableHistoryCauses,
  historyRange,
  onChangeHistoryRange,
  historyFilters,
  hasAdvancedHistoryFilters,
  onUpdateHistoryFilter,
  onResetHistoryFilters,
  exportMonth,
  exportYear,
  isCurrentMonthSelected,
  isAtOrAfterCurrentMonth,
  monthHeatmap,
  onMoveCalendarMonth,
  onResetCalendarMonth,
  chartData,
  grouped,
  editingId,
  onSelectDayDetail,
  onTogglePinned,
  onStartEdit,
  onDelete,
  onOpenPhotoLightbox,
  onGoToExport,
}) {
  const visibleGroups = grouped;

  return (
    <div className="tracker-timeline-col tracker-tab-panel">
      <div className="history-toolbar card mb-4">
        <div>
          <h3>Lịch sử cảm xúc</h3>
          <p className="text-muted">Xem nhanh theo khoảng thời gian và mở từng ngày để xem chi tiết.</p>
        </div>
        <div className="history-filters" role="tablist" aria-label="Lọc lịch sử cảm xúc">
          {HISTORY_RANGE_OPTIONS.map(option => (
            <button
              key={option.value}
              className={`history-filter-btn ${historyRange === option.value ? 'active' : ''}`}
              onClick={() => onChangeHistoryRange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="history-advanced-filters card mb-4">
        <div className="history-advanced-head">
          <div>
            <h3>Bộ lọc lịch sử</h3>
            <p className="text-muted">
              Đang hiển thị {filteredMoodLogs.length}/{moodLogs.length} ghi chú
              {hasAdvancedHistoryFilters ? ' theo bộ lọc hiện tại.' : historyRange === 'all' ? ' trong toàn bộ lịch sử.' : ' trong khoảng đã chọn.'}
            </p>
          </div>
          {hasAdvancedHistoryFilters && (
            <button type="button" className="btn btn-secondary" onClick={onResetHistoryFilters}>
              Xóa lọc
            </button>
          )}
        </div>

        <label className="history-search-field">
          <span>Tìm kiếm nhật ký</span>
          <div>
            <input
              type="search"
              value={historyFilters.search}
              onChange={e => onUpdateHistoryFilter('search', e.target.value)}
              placeholder="Tìm note, nguyên nhân, mood, ngày, ảnh/video/audio..."
            />
            {historyFilters.search && (
              <button type="button" onClick={() => onUpdateHistoryFilter('search', '')} aria-label="Xóa tìm kiếm">
                ×
              </button>
            )}
          </div>
        </label>

        <div className="history-filter-grid">
          <label>
            <span>Mood</span>
            <select value={historyFilters.mood} onChange={e => onUpdateHistoryFilter('mood', e.target.value)}>
              <option value="all">Tất cả mood</option>
              {allMoods.map(mood => (
                <option key={mood.id} value={String(mood.id)}>
                  {mood.emoji ? `${mood.emoji} ` : ''}{mood.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Nguyên nhân</span>
            <select value={historyFilters.cause} onChange={e => onUpdateHistoryFilter('cause', e.target.value)}>
              <option value="all">Tất cả nguyên nhân</option>
              {availableHistoryCauses.map(cause => (
                <option key={cause} value={cause}>{cause}</option>
              ))}
            </select>
          </label>

          <label>
            <span>Media</span>
            <select value={historyFilters.media} onChange={e => onUpdateHistoryFilter('media', e.target.value)}>
              <option value="all">Tất cả</option>
              <option value="any">Có tệp đính kèm</option>
              <option value="image">Có ảnh</option>
              <option value="video">Có video</option>
              <option value="audio">Có âm thanh</option>
              <option value="none">Không có tệp</option>
            </select>
          </label>

          <label>
            <span>Từ ngày</span>
            <input
              type="date"
              value={historyFilters.from}
              onChange={e => onUpdateHistoryFilter('from', e.target.value)}
            />
          </label>

          <label>
            <span>Đến ngày</span>
            <input
              type="date"
              value={historyFilters.to}
              onChange={e => onUpdateHistoryFilter('to', e.target.value)}
            />
          </label>
        </div>

        <div className="history-quick-toggles" aria-label="Lọc nhanh chỉ số">
          <button
            type="button"
            className={historyFilters.stressHigh ? 'active' : ''}
            onClick={() => onUpdateHistoryFilter('stressHigh', !historyFilters.stressHigh)}
          >
            Stress cao ≥ 4/5
          </button>
          <button
            type="button"
            className={historyFilters.sleepLow ? 'active' : ''}
            onClick={() => onUpdateHistoryFilter('sleepLow', !historyFilters.sleepLow)}
          >
            Ngủ thấp ≤ 2/5
          </button>
        </div>
      </div>

      <MoodCalendar
        exportMonth={exportMonth}
        exportYear={exportYear}
        isCurrentMonthSelected={isCurrentMonthSelected}
        isAtOrAfterCurrentMonth={isAtOrAfterCurrentMonth}
        monthHeatmap={monthHeatmap}
        onMoveMonth={onMoveCalendarMonth}
        onResetMonth={onResetCalendarMonth}
        onSelectDay={onSelectDayDetail}
      />

      {chartData.length > 0 ? (
        <div className="card mb-4">
          <h3 className="mb-3">📊 Biểu đồ cảm xúc {historyRangeLabel(historyRange)}</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData} barSize={20}>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 5]} hide />
              <Tooltip formatter={(v) => {
                const m = allMoods.find(item => item.score === v);
                return [m ? `${m.emoji} ${m.label}` : v, 'Cảm xúc'];
              }} />
              <Bar dataKey="score" radius={[6, 6, 0, 0]}>
                {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="card mb-4">
          <div className="empty-timeline chart-empty">
            <div style={{ fontSize: 36 }} aria-hidden="true">📊</div>
            <p>Chưa có biểu đồ cho {historyRangeLabel(historyRange)}.</p>
            <Link to="/mood" className="btn btn-primary">Ghi cảm xúc đầu tiên</Link>
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex justify-between items-center mb-3">
          <h3>📝 Nhật ký cảm xúc</h3>
          <button className="btn btn-secondary" onClick={onGoToExport}>
            Xuất dữ liệu
          </button>
        </div>

        {moodLogs.length === 0 ? (
          <div className="empty-timeline">
            <div style={{ fontSize: 40 }} aria-hidden="true">📭</div>
            <p>Chưa có ghi chú nào.</p>
            <p className="text-muted">Hãy ghi lại cảm xúc đầu tiên của bạn!</p>
            <Link to="/mood" className="btn btn-primary mt-2">Ghi cảm xúc đầu tiên</Link>
          </div>
        ) : (
          <>
            {grouped.length > 0 && (
              <div className="history-calendar">
                {grouped.map(([dayKey, logs]) => {
                  const latestLog = logs[0];
                  const mood = allMoods.find(m => m.id === latestLog.mood);
                  return (
                    <button
                      key={dayKey}
                      className="history-day-chip"
                      style={{ '--day-color': mood?.color || '#ccc' }}
                      onClick={() => onSelectDayDetail({ dayKey, logs })}
                      title={`Xem chi tiết ${dayLabel(dayKey)}`}
                    >
                      <span className="history-day-date">{format(new Date(dayKey), 'dd/MM')}</span>
                      <span className="history-day-dot" />
                      <span className="history-day-count">{logs.length}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="timeline">
              {visibleGroups.map(([dayKey, logs]) => (
                <div key={dayKey} className="timeline-day">
                  <div className="timeline-day-header">
                    <button className="timeline-day-label day-detail-link" onClick={() => onSelectDayDetail({ dayKey, logs })}>
                      {dayLabel(dayKey)}
                    </button>
                    <button className="timeline-day-count" onClick={() => onSelectDayDetail({ dayKey, logs })}>
                      {logs.length} ghi chú
                    </button>
                  </div>
                  <div className="timeline-entries">
                    {logs.map(log => {
                      const mood = allMoods.find(m => m.id === log.mood);
                      const cleanNote = log.note?.replace(/\s*\[.+\]$/, '') || '';
                      const causeTags = log.note?.match(/\[(.+)\]/)?.[1]?.split(', ') || [];
                      const logMetrics = log.metrics ? normalizeMetrics(log.metrics) : null;
                      const attachments = logAttachments(log);
                      return (
                        <div
                          key={log.id}
                          className={`timeline-entry ${editingId === log.id ? 'editing' : ''}`}
                          style={{ '--entry-color': mood?.color || '#ccc' }}
                        >
                          <div className="entry-time-col">
                            <span className="entry-time">
                              {format(new Date(log.date), 'HH:mm')}
                            </span>
                            <div className="entry-dot" />
                          </div>
                          <div className="entry-body">
                            <div className="entry-header">
                              <span className="entry-emoji">{mood?.emoji}</span>
                              <span className="entry-mood" style={{ color: mood?.color }}>
                                {mood?.label}
                              </span>
                              {mood?.id?.toString().startsWith('custom_') && (
                                <span className="custom-badge">tùy chỉnh</span>
                              )}
                              {log.excludeFromAI && (
                                <span className="ai-private-badge" title="Dòng này không được gửi cho AI">riêng tư AI</span>
                              )}
                              {log.pinned && (
                                <span className="pinned-badge" title="Ghi chú quan trọng">quan trọng</span>
                              )}
                              <div className="entry-actions">
                                <button
                                  className={`entry-btn pin ${log.pinned ? 'active' : ''}`}
                                  onClick={() => onTogglePinned(log.id)}
                                  title={log.pinned ? 'Bỏ ghim' : 'Ghim ghi chú'}
                                  aria-label={`${log.pinned ? 'Bỏ ghim' : 'Ghim'} ghi chú lúc ${format(new Date(log.date), 'HH:mm')}`}
                                >
                                  {log.pinned ? '★' : '☆'}
                                </button>
                                <button
                                  className="entry-btn edit"
                                  onClick={() => onStartEdit(log)}
                                  title="Chỉnh sửa"
                                  aria-label={`Chỉnh sửa ghi chú lúc ${format(new Date(log.date), 'HH:mm')}`}
                                >✏️</button>
                                <button
                                  className="entry-btn delete"
                                  onClick={() => onDelete(log.id)}
                                  title="Xóa"
                                  aria-label={`Xóa ghi chú lúc ${format(new Date(log.date), 'HH:mm')}`}
                                >🗑️</button>
                              </div>
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
                              <div className="entry-metrics" aria-label={`Chỉ số phụ: ${metricSummary(logMetrics)}`}>
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
                            {cleanNote && <RichText text={cleanNote} className="entry-note" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            {grouped.length === 0 && (
              <div className="empty-timeline">
                <p>
                  {hasAdvancedHistoryFilters
                    ? 'Không có ghi chú nào khớp với bộ lọc hiện tại.'
                    : historyRange === 'all'
                      ? 'Không có ghi chú nào trong toàn bộ lịch sử.'
                      : `Không có ghi chú trong ${historyRange} ngày gần đây.`}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
