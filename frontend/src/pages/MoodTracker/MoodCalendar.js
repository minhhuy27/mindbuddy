import React from 'react';

export default function MoodCalendar({
  exportMonth,
  exportYear,
  isCurrentMonthSelected,
  isAtOrAfterCurrentMonth,
  monthHeatmap,
  onMoveMonth,
  onResetMonth,
  onSelectDay,
}) {
  return (
    <div className="card mood-calendar-card mb-4">
      <div className="mood-calendar-header">
        <div>
          <h3>🗓️ Mood calendar</h3>
          <p className="text-muted">Màu mỗi ngày lấy theo check-in mới nhất, có kèm nhãn cảm xúc.</p>
        </div>
        <div className="mood-calendar-controls" aria-label="Điều hướng tháng mood calendar">
          <button
            type="button"
            className="calendar-nav-btn"
            onClick={() => onMoveMonth(-1)}
            aria-label="Xem tháng trước"
          >
            ‹
          </button>
          <strong>Tháng {exportMonth + 1}/{exportYear}</strong>
          <button
            type="button"
            className="calendar-nav-btn"
            onClick={() => onMoveMonth(1)}
            disabled={isAtOrAfterCurrentMonth}
            aria-label="Xem tháng sau"
          >
            ›
          </button>
          <button
            type="button"
            className="calendar-today-btn"
            onClick={onResetMonth}
            disabled={isCurrentMonthSelected}
          >
            Hôm nay
          </button>
        </div>
      </div>
      <div className="mood-calendar-weekdays" aria-hidden="true">
        {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map(day => <span key={day}>{day}</span>)}
      </div>
      <div className="mood-calendar-grid">
        {monthHeatmap.blanks.map(blank => (
          <span key={`blank-${blank}`} className="mood-calendar-blank" />
        ))}
        {monthHeatmap.days.map(day => (
          <button
            key={day.key}
            className={`mood-calendar-day ${day.logs.length ? 'has-mood' : ''}`}
            style={{ '--day-color': day.mood?.color || 'var(--border)' }}
            disabled={!day.logs.length}
            onClick={() => onSelectDay({ dayKey: day.key, logs: day.logs })}
            aria-label={day.logs.length
              ? `${day.day}/${exportMonth + 1}: ${day.mood?.label}, ${day.logs.length} ghi chú`
              : `${day.day}/${exportMonth + 1}: chưa có ghi chú`}
          >
            <span className="mood-calendar-number">{day.day}</span>
            {day.mood ? (
              <>
                <span className="mood-calendar-emoji" aria-hidden="true">{day.mood.emoji}</span>
                <small>{day.mood.label}</small>
              </>
            ) : (
              <small>Trống</small>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
