import React from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subDays } from 'date-fns';
import { vi } from 'date-fns/locale';
import NotificationSettings from '../components/NotificationSettings';
import WeeklyInsight from '../components/WeeklyInsight';
import './Dashboard.css';

export default function Dashboard() {
  const { user, moodLogs, todayMood, MOODS, pomodoroCount, gardenLevel, earnedBadges, BADGES, getStreak } = useApp();

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(new Date(), 6 - i);
    const dayStr = d.toDateString();
    // Lấy log mới nhất trong ngày (moodLogs đã sort mới nhất trước)
    const log = moodLogs.find(l => new Date(l.date).toDateString() === dayStr);
    return {
      date: format(d, 'EEE', { locale: vi }),
      score: log ? (MOODS.find(m => m.id === log.mood)?.score ?? 0) : null,
      hasData: !!log,
    };
  });

  const streak = getStreak(moodLogs);
  const gardenEmoji = gardenLevel < 20 ? '🌱' : gardenLevel < 50 ? '🌿' : gardenLevel < 80 ? '🌳' : '🌸';
  const todayLogs = moodLogs.filter(l => new Date(l.date).toDateString() === new Date().toDateString());
  const latestTodayMood = todayLogs[0]; // moodLogs đã sort mới nhất trước
  const latestMood = latestTodayMood ? MOODS.find(m => m.id === latestTodayMood.mood) : null;

  return (
    <div className="dashboard">
      <section className="dashboard-hero">
        <div className="hero-copy">
          <span className="hero-kicker">MindBuddy hôm nay</span>
          <h1>Xin chào, {user?.displayName || user?.email}!</h1>
          <p>
            {latestTodayMood
              ? <>Bạn đã check-in <strong>{todayLogs.length}</strong> lần hôm nay. Lần gần nhất: <strong>{latestMood?.label}</strong> {latestMood?.emoji}</>
              : 'Bắt đầu bằng một check-in ngắn để MindBuddy hiểu trạng thái hiện tại của bạn.'}
          </p>
          <Link to="/mood" className="btn btn-primary hero-cta">
            {latestTodayMood ? '+ Ghi thêm cảm xúc' : 'Ghi cảm xúc hôm nay'}
          </Link>
        </div>
        <div className="hero-status">
          <div className="hero-status-icon">{latestMood?.emoji || '💭'}</div>
          <div>
            <span className="hero-status-label">Trạng thái gần nhất</span>
            <strong>{latestMood?.label || 'Chưa check-in'}</strong>
          </div>
          <div className="hero-status-meta">
            <span>{streak} ngày liên tiếp</span>
            <span>{gardenLevel}% vườn</span>
          </div>
        </div>
      </section>

      <div className="quick-actions">
        <h3 className="mb-3">⚡ Truy cập nhanh</h3>
        <div className="actions-grid">
          {[
            { to: '/mood', icon: '💭', label: latestTodayMood ? 'Ghi thêm cảm xúc' : 'Ghi cảm xúc', color: '#a29bfe', primary: true },
            { to: '/pomodoro', icon: '🍅', label: 'Bắt đầu học', color: '#fd79a8' },
            { to: '/community', icon: '🌍', label: 'Cộng đồng', color: '#74b9ff' },
            { to: '/garden', icon: '🌱', label: 'Vườn tâm hồn', color: '#55efc4' },
            { to: '/sos', icon: '🆘', label: 'Hỗ trợ khẩn cấp', color: '#e17055' },
          ].map(a => (
            <Link key={a.to} to={a.to} className={`action-card ${a.primary ? 'primary-action' : ''}`} style={{ '--action-color': a.color }}>
              <span className="action-icon">{a.icon}</span>
              <span className="action-label">{a.label}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">🔥</div>
          <div className="stat-value">{streak}</div>
          <div className="stat-label">Ngày liên tiếp</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🍅</div>
          <div className="stat-value">{pomodoroCount}</div>
          <div className="stat-label">Pomodoro hoàn thành</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">{gardenEmoji}</div>
          <div className="stat-value">{gardenLevel}%</div>
          <div className="stat-label">Sức khỏe vườn</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🏅</div>
          <div className="stat-value">{earnedBadges.length}</div>
          <div className="stat-label">Huy hiệu đạt được</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h3 className="mb-3">📈 Cảm xúc 7 ngày qua</h3>
          {moodLogs.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={last7}>
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 5]} hide />
                <Tooltip formatter={(v, name, props) => {
                  if (!props.payload.hasData) return ['Chưa có dữ liệu', ''];
                  const m = MOODS.find(m => m.score === v);
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
            <div className="empty-state">Chưa có dữ liệu. Hãy check-in hôm nay!</div>
          )}
        </div>

        <div className="card">
          <h3 className="mb-3">🏅 Huy hiệu của bạn</h3>
          <div className="badges-grid">
            {BADGES.map(b => (
              <div key={b.id} className={`badge-item ${earnedBadges.includes(b.id) ? 'earned' : 'locked'}`}>
                <span className="badge-icon">{earnedBadges.includes(b.id) ? b.icon : '🔒'}</span>
                <span className="badge-name">{b.name}</span>
                <span className="badge-desc">{b.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <WeeklyInsight />
      <NotificationSettings />
    </div>
  );
}
