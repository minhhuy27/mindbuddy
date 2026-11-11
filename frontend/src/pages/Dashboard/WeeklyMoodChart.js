import React from 'react';
import { Link } from 'react-router-dom';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export default function WeeklyMoodChart({ last7, weekAverage, weekDirection, onDayClick }) {
  return (
    <section className="card week-overview-card dashboard-custom-block">
      <div className="section-heading-row">
        <div>
          <h3>Tuần này nhìn nhanh</h3>
          <p className="text-muted">
            {weekAverage
              ? `Điểm mood trung bình ${weekAverage}/5${weekDirection > 0 ? ', đang đi lên.' : weekDirection < 0 ? ', đang giảm nhẹ.' : ', khá ổn định.'}`
              : 'Chưa đủ dữ liệu để thấy xu hướng.'}
          </p>
        </div>
        <Link to="/mood?tab=history" className="quick-link">Xem lịch sử</Link>
      </div>

      <div className="week-strip" aria-label="Cảm xúc 7 ngày qua">
        {last7.map(day => (
          <button
            key={day.fullDate}
            type="button"
            className={`week-day ${day.hasData ? 'has-data' : ''}`}
            style={{ '--mood-color': day.mood?.color || 'var(--border)' }}
            disabled={!day.logs.length}
            onClick={() => onDayClick({ dayKey: day.key, logs: day.logs })}
            aria-label={day.hasData
              ? `Xem ${day.logs.length} ghi chú ngày ${day.fullDate}, cảm xúc mới nhất ${day.mood?.label}`
              : `Ngày ${day.fullDate} chưa có ghi chú`}
          >
            <span className="week-label">{day.date}</span>
            <span
              className="week-dot"
              style={{ '--mood-color': day.mood?.color || 'var(--border)' }}
              title={day.hasData ? `${day.fullDate}: ${day.mood?.label}` : `${day.fullDate}: chưa ghi`}
            >
              {day.mood?.emoji || ''}
            </span>
            <small>{day.fullDate}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

export function MoodLineChart({ last7, allMoods, hasMoodLogs }) {
  const showChart = hasMoodLogs !== undefined ? hasMoodLogs : last7.some(d => d.hasData);
  return (
    <div className="card mood-chart-card">
      <h3 className="mb-3">Biểu đồ cảm xúc 7 ngày</h3>
      {showChart ? (
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={last7}>
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis domain={[0, 5]} hide />
            <Tooltip formatter={(v, name, props) => {
              if (!props.payload.hasData) return ['Chưa có dữ liệu', ''];
              const m = props.payload.mood || allMoods.find(m => m.score === v);
              return [m ? `${m.emoji} ${m.label}` : v, 'Cảm xúc'];
            }} />
            <Line
              type="monotone"
              dataKey="score"
              stroke="#6c63ff"
              strokeWidth={2.5}
              dot={(props) => {
                const { cx, cy, payload } = props;
                if (!payload.hasData) return null;
                return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={4} fill="#6c63ff" />;
              }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="empty-state rich-empty">
          <div className="empty-icon" aria-hidden="true">💭</div>
          <h4>Chưa có dữ liệu cảm xúc</h4>
          <p>Ghi cảm xúc đầu tiên để biểu đồ bắt đầu có ý nghĩa.</p>
          <Link to="/mood" className="btn btn-primary">Ghi cảm xúc đầu tiên</Link>
        </div>
      )}
    </div>
  );
}
