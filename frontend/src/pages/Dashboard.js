import React from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subDays } from 'date-fns';
import { vi } from 'date-fns/locale';
import NotificationSettings from '../components/NotificationSettings';
import WeeklyInsight from '../components/WeeklyInsight';
import CrisisPanel from '../components/CrisisPanel';
import { detectDanger } from '../utils/aiService';
import './Dashboard.css';

const GOALS = [
  { id: 'stress', label: 'Giảm stress', desc: 'Ưu tiên hạ căng thẳng và ổn định cảm xúc.' },
  { id: 'sleep', label: 'Ngủ tốt hơn', desc: 'Ưu tiên nhịp sinh hoạt và nghỉ ngơi.' },
  { id: 'study', label: 'Tập trung học tập', desc: 'Ưu tiên năng lượng, Pomodoro và kế hoạch học.' },
];

export default function Dashboard() {
  const {
    user, moodLogs, MOODS, pomodoroCount, gardenLevel, earnedBadges, BADGES,
    getStreak, addMoodLog, userGoal, setUserGoal,
  } = useApp();
  const [quickMood, setQuickMood] = React.useState(null);
  const [quickNote, setQuickNote] = React.useState('');
  const [quickFeedback, setQuickFeedback] = React.useState('');
  const [showCrisis, setShowCrisis] = React.useState(false);

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
  const nextPomodoro = Math.max(0, 10 - pomodoroCount);
  const pomodoroProgress = Math.min(100, (pomodoroCount / 10) * 100);
  const streakProgress = Math.min(100, (streak / 7) * 100);
  const nextGardenMilestone = gardenLevel < 20 ? 20 : gardenLevel < 50 ? 50 : gardenLevel < 80 ? 80 : 100;
  const gardenRemaining = Math.max(0, nextGardenMilestone - gardenLevel);
  const gardenProgress = Math.min(100, gardenLevel);
  const badgeProgress = BADGES.length ? Math.min(100, (earnedBadges.length / BADGES.length) * 100) : 0;

  const handleQuickCheckin = async () => {
    if (!quickMood) return;
    if (detectDanger(quickNote)) setShowCrisis(true);
    await addMoodLog(quickMood, quickNote);
    setQuickMood(null);
    setQuickNote('');
    setQuickFeedback('Đã ghi cảm xúc nhanh. Bạn có thể xem chi tiết trong trang Cảm xúc.');
    window.setTimeout(() => setQuickFeedback(''), 3200);
  };

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
          <Link to="/mood" className="btn btn-primary hero-cta" aria-label={latestTodayMood ? 'Ghi thêm cảm xúc hôm nay' : 'Ghi cảm xúc đầu tiên hôm nay'}>
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

      {showCrisis && <CrisisPanel onDismiss={() => setShowCrisis(false)} />}

      <section className="dashboard-focus-grid">
        <div className="card quick-checkin-widget">
          <div className="section-heading-row">
            <div>
              <h3>Ghi cảm xúc nhanh</h3>
              <p className="text-muted">Chọn mood và ghi một dòng ngắn ngay trên Dashboard.</p>
            </div>
            <Link to="/mood" className="quick-link">Mở đầy đủ</Link>
          </div>
          <div className="quick-mood-row">
            {MOODS.map(m => (
              <button
                key={m.id}
                className={`quick-mood-btn ${quickMood === m.id ? 'selected' : ''}`}
                style={{ '--mood-color': m.color }}
                aria-label={`Chọn cảm xúc ${m.label}`}
                aria-pressed={quickMood === m.id}
                onClick={() => setQuickMood(m.id)}
              >
                <span aria-hidden="true">{m.emoji}</span>
                <small>{m.label}</small>
              </button>
            ))}
          </div>
          <textarea
            value={quickNote}
            onChange={e => {
              setQuickNote(e.target.value);
              if (detectDanger(e.target.value)) setShowCrisis(true);
            }}
            rows={2}
            placeholder="Điều gì đang diễn ra?"
            aria-label="Ghi chú cảm xúc nhanh"
          />
          <button className="btn btn-primary w-full" onClick={handleQuickCheckin} disabled={!quickMood}>
            Lưu check-in nhanh
          </button>
          {quickFeedback && <p className="quick-feedback" role="status">{quickFeedback}</p>}
        </div>

        <div className="card goal-widget">
          <div className="section-heading-row">
            <div>
              <h3>Mục tiêu cá nhân</h3>
              <p className="text-muted">MindBuddy sẽ ưu tiên insight và lời khuyên theo mục tiêu này.</p>
            </div>
          </div>
          <div className="goal-options">
            {GOALS.map(goal => (
              <button
                key={goal.id}
                className={`goal-option ${userGoal === goal.id ? 'active' : ''}`}
                onClick={() => setUserGoal(goal.id)}
                aria-pressed={userGoal === goal.id}
              >
                <strong>{goal.label}</strong>
                <span>{goal.desc}</span>
              </button>
            ))}
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
            <Link key={a.to} to={a.to} className={`action-card ${a.primary ? 'primary-action' : ''}`} style={{ '--action-color': a.color }} aria-label={a.label}>
              <span className="action-icon" aria-hidden="true">{a.icon}</span>
              <span className="action-label">{a.label}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card progress-card">
          <div className="stat-icon" aria-hidden="true">🔥</div>
          <div className="stat-value">{streak}</div>
          <div className="stat-label">Ngày liên tiếp</div>
          <div className="mini-progress" role="progressbar" aria-valuemin="0" aria-valuemax="7" aria-valuenow={Math.min(streak, 7)} aria-label="Tiến trình streak">
            <span style={{ width: `${streakProgress}%` }} />
          </div>
          <p className="progress-hint">{streak >= 7 ? 'Đã mở mốc 7 ngày liên tiếp' : `Còn ${7 - streak} ngày để đạt mốc 7 ngày`}</p>
        </div>
        <div className="stat-card progress-card">
          <div className="stat-icon" aria-hidden="true">🍅</div>
          <div className="stat-value">{pomodoroCount}</div>
          <div className="stat-label">Pomodoro hoàn thành</div>
          <div className="mini-progress" role="progressbar" aria-valuemin="0" aria-valuemax="10" aria-valuenow={Math.min(pomodoroCount, 10)} aria-label="Tiến trình huy hiệu Pomodoro">
            <span style={{ width: `${pomodoroProgress}%` }} />
          </div>
          <p className="progress-hint">{nextPomodoro === 0 ? 'Đã đủ điều kiện huy hiệu tập trung' : `Còn ${nextPomodoro} lần Pomodoro để mở huy hiệu`}</p>
        </div>
        <div className="stat-card progress-card">
          <div className="stat-icon" aria-hidden="true">{gardenEmoji}</div>
          <div className="stat-value">{gardenLevel}%</div>
          <div className="stat-label">Sức khỏe vườn</div>
          <div className="mini-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={gardenLevel} aria-label="Sức khỏe vườn">
            <span style={{ width: `${gardenProgress}%` }} />
          </div>
          <p className="progress-hint">{gardenLevel >= 100 ? 'Vườn đã đạt mức cao nhất' : `Còn ${gardenRemaining}% tới mốc ${nextGardenMilestone}%`}</p>
        </div>
        <div className="stat-card progress-card">
          <div className="stat-icon" aria-hidden="true">🏅</div>
          <div className="stat-value">{earnedBadges.length}</div>
          <div className="stat-label">Huy hiệu đạt được</div>
          <div className="mini-progress" role="progressbar" aria-valuemin="0" aria-valuemax={BADGES.length} aria-valuenow={earnedBadges.length} aria-label="Tiến trình huy hiệu">
            <span style={{ width: `${badgeProgress}%` }} />
          </div>
          <p className="progress-hint">{earnedBadges.length >= BADGES.length ? 'Đã sưu tập toàn bộ huy hiệu' : `${earnedBadges.length}/${BADGES.length} huy hiệu đã mở`}</p>
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
            <div className="empty-state rich-empty">
              <div className="empty-icon" aria-hidden="true">💭</div>
              <h4>Chưa có dữ liệu cảm xúc</h4>
              <p>Ghi cảm xúc đầu tiên để biểu đồ bắt đầu có ý nghĩa.</p>
              <Link to="/mood" className="btn btn-primary">Ghi cảm xúc đầu tiên</Link>
            </div>
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
