import React from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subDays } from 'date-fns';
import { vi } from 'date-fns/locale';
import NotificationSettings from '../components/NotificationSettings';
import WeeklyInsight from '../components/WeeklyInsight';
import CrisisPanel from '../components/CrisisPanel';
import { analyzeMood, detectDanger, summarizeDay } from '../utils/aiService';
import './Dashboard.css';

const GOALS = [
  { id: 'stress', label: 'Giảm stress', desc: 'Ưu tiên hạ căng thẳng và ổn định cảm xúc.' },
  { id: 'sleep', label: 'Ngủ tốt hơn', desc: 'Ưu tiên nhịp sinh hoạt và nghỉ ngơi.' },
  { id: 'study', label: 'Tập trung học tập', desc: 'Ưu tiên năng lượng, Pomodoro và kế hoạch học.' },
];

function getFirstName(user) {
  const source = user?.displayName || user?.email || 'bạn';
  return source.split('@')[0].split(' ')[0];
}

export default function Dashboard() {
  const {
    user, moodLogs, MOODS, pomodoroCount, gardenLevel, earnedBadges, BADGES,
    getStreak, addMoodLog, userGoal, setUserGoal,
    saveTodayAI, aiMemory, saveAiMemory,
  } = useApp();
  const [quickMood, setQuickMood] = React.useState(null);
  const [quickNote, setQuickNote] = React.useState('');
  const [quickFeedback, setQuickFeedback] = React.useState('');
  const [quickAnalyzing, setQuickAnalyzing] = React.useState(false);
  const [showCrisis, setShowCrisis] = React.useState(false);
  const [selectedDayDetail, setSelectedDayDetail] = React.useState(null);

  const today = new Date();
  const todayStr = today.toDateString();
  const todayLogs = moodLogs.filter(l => new Date(l.date).toDateString() === todayStr);
  const latestTodayMood = todayLogs[0];
  const latestMood = latestTodayMood ? MOODS.find(m => m.id === latestTodayMood.mood) : null;
  const latestMoodScore = latestMood?.score || 0;
  const currentGoal = GOALS.find(g => g.id === userGoal) || GOALS[0];

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(today, 6 - i);
    const dayStr = d.toDateString();
    const dayLogs = moodLogs
      .filter(l => new Date(l.date).toDateString() === dayStr)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    const log = dayLogs[0];
    const mood = log ? MOODS.find(m => m.id === log.mood) : null;
    return {
      key: dayStr,
      date: format(d, 'EEE', { locale: vi }),
      fullDate: format(d, 'dd/MM'),
      score: mood?.score ?? null,
      hasData: !!log,
      mood,
      logs: dayLogs,
    };
  });

  const weekLogs = last7.filter(d => d.hasData);
  const weekAverage = weekLogs.length
    ? (weekLogs.reduce((sum, d) => sum + d.score, 0) / weekLogs.length).toFixed(1)
    : null;
  const weekDirection = weekLogs.length >= 2
    ? weekLogs[weekLogs.length - 1].score - weekLogs[0].score
    : 0;

  const streak = getStreak(moodLogs);
  const gardenEmoji = gardenLevel < 20 ? '🌱' : gardenLevel < 50 ? '🌿' : gardenLevel < 80 ? '🌳' : '🌸';
  const nextPomodoro = Math.max(0, 10 - pomodoroCount);
  const pomodoroProgress = Math.min(100, (pomodoroCount / 10) * 100);
  const streakProgress = Math.min(100, (streak / 7) * 100);
  const nextGardenMilestone = gardenLevel < 20 ? 20 : gardenLevel < 50 ? 50 : gardenLevel < 80 ? 80 : 100;
  const gardenRemaining = Math.max(0, nextGardenMilestone - gardenLevel);
  const gardenProgress = Math.min(100, gardenLevel);
  const badgeProgress = BADGES.length ? Math.min(100, (earnedBadges.length / BADGES.length) * 100) : 0;

  const nextAction = (() => {
    if (!latestTodayMood) {
      return {
        icon: '💭',
        title: 'Ghi cảm xúc đầu tiên hôm nay',
        text: 'Một check-in ngắn là đủ để MindBuddy hiểu ngày của bạn đang bắt đầu thế nào.',
        to: '/mood',
        label: 'Mở trang cảm xúc',
      };
    }
    if (latestMoodScore <= 2) {
      return {
        icon: '🫁',
        title: 'Hạ nhịp trong 2 phút',
        text: 'Mood gần nhất khá nặng. Hãy mở S.O.S và thử một vòng thở 4-7-8 trước khi làm tiếp.',
        to: '/sos',
        label: 'Thở cùng MindBuddy',
      };
    }
    if (userGoal === 'study' && pomodoroCount === 0) {
      return {
        icon: '🍅',
        title: 'Bắt đầu một phiên tập trung',
        text: 'Bạn đã check-in rồi. Một Pomodoro ngắn sẽ giúp biến trạng thái hiện tại thành hành động.',
        to: '/pomodoro',
        label: 'Bắt đầu Pomodoro',
      };
    }
    if (gardenLevel < nextGardenMilestone) {
      return {
        icon: gardenEmoji,
        title: 'Chăm vườn bằng một thói quen nhỏ',
        text: `Còn ${gardenRemaining}% để tới mốc ${nextGardenMilestone}%. Chọn một việc nhẹ như thở, uống nước hoặc viết vài dòng.`,
        to: '/garden',
        label: 'Chăm vườn',
      };
    }
    return {
      icon: '✨',
      title: 'Nhìn lại xu hướng tuần này',
      text: 'Bạn đã có dữ liệu hôm nay. Xem insight để chọn một điều nhỏ cho ngày mai.',
      to: '/mood?tab=history',
      label: 'Xem lịch sử',
    };
  })();

  const handleQuickCheckin = async () => {
    if (!quickMood || quickAnalyzing) return;
    if (detectDanger(quickNote)) setShowCrisis(true);
    const mood = MOODS.find(m => m.id === quickMood);
    const note = quickNote;
    const recentMoods = moodLogs.slice(0, 7)
      .map(l => MOODS.find(m => m.id === l.mood))
      .filter(Boolean);

    setQuickAnalyzing(true);
    await addMoodLog(quickMood, note);
    setQuickMood(null);
    setQuickNote('');
    setQuickFeedback('Đã ghi lại hôm nay. MindBuddy đang phân tích nhanh cho bạn...');

    try {
      const advice = await analyzeMood({
        moodLabel: mood?.label || 'Không rõ',
        note,
        causes: [],
        metrics: null,
        recentMoods,
        aiMemory: aiMemory || [],
        userGoal,
      });

      if (advice) {
        saveTodayAI({ advice, moodLabel: mood?.label || '', chatMessages: [] });
      }

      const todayLabel = format(new Date(), 'dd/MM/yyyy');
      const todayEntries = [
        { moodLabel: mood?.label || 'Không rõ', note, causes: [] },
        ...moodLogs
          .filter(l => new Date(l.date).toDateString() === new Date().toDateString())
          .map(l => {
            const m = MOODS.find(x => x.id === l.mood);
            const causesInNote = l.note?.match(/\[(.+)\]/)?.[1]?.split(', ') || [];
            const cleanNote = l.note?.replace(/\s*\[.+\]$/, '') || '';
            return { moodLabel: m?.label || 'Không rõ', note: cleanNote, causes: causesInNote, metrics: l.metrics };
          }),
      ];
      summarizeDay({ date: todayLabel, entries: todayEntries }).then(summary => {
        if (summary !== null) {
          saveAiMemory({
            date: todayLabel,
            summary: summary || '',
            moods: todayEntries.map(e => e.moodLabel),
          });
        }
      });

      setQuickFeedback(advice
        ? 'Đã ghi lại và tạo lời khuyên AI. Mở tab Insight trong trang Cảm xúc để xem.'
        : 'Đã ghi lại hôm nay. AI chưa phản hồi được, bạn có thể thử lại trong trang Cảm xúc.');
    } catch (err) {
      console.error('Dashboard quick AI error:', err);
      setQuickFeedback('Đã ghi lại hôm nay. AI đang bận, bạn có thể xem lại trong trang Cảm xúc.');
    } finally {
      setQuickAnalyzing(false);
    }
    window.setTimeout(() => setQuickFeedback(''), 3200);
  };

  return (
    <div className="dashboard">
      <section className="today-hero">
        <div className="today-hero-copy">
          <span className="today-date">{format(today, "EEEE, dd/MM/yyyy", { locale: vi })}</span>
          <h1>Hôm nay của {getFirstName(user)}</h1>
          <p>
            {latestTodayMood
              ? <>Bạn đã check-in <strong>{todayLogs.length}</strong> lần. Trạng thái mới nhất là <strong>{latestMood?.label}</strong> {latestMood?.emoji}.</>
              : 'Bắt đầu bằng một check-in ngắn, rồi chọn một việc nhỏ đủ làm ngay.'}
          </p>
        </div>

        <div className="today-hero-status" aria-label="Tóm tắt hôm nay">
          <div className="today-mood-orb" style={{ '--mood-color': latestMood?.color || '#a29bfe' }}>
            {latestMood?.emoji || '💭'}
          </div>
          <div>
            <span>Trạng thái gần nhất</span>
            <strong>{latestMood?.label || 'Chưa check-in'}</strong>
          </div>
          <div className="today-mini-metrics">
            <span>{streak} ngày streak</span>
            <span>{gardenLevel}% vườn</span>
          </div>
        </div>
      </section>

      {showCrisis && <CrisisPanel onDismiss={() => setShowCrisis(false)} />}

      <section className="today-grid">
        <div className="card today-checkin-card">
          <div className="section-heading-row">
            <div>
              <h3>Check-in nhanh</h3>
              <p className="text-muted">Chọn cảm xúc hiện tại và ghi một dòng nếu bạn muốn.</p>
            </div>
            <Link to="/mood" className="quick-link">Ghi đầy đủ</Link>
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
            rows={3}
            placeholder="Điều gì đang ảnh hưởng tới bạn hôm nay?"
            aria-label="Ghi chú cảm xúc nhanh"
          />
          <button className="btn btn-primary w-full" onClick={handleQuickCheckin} disabled={!quickMood || quickAnalyzing}>
            {quickAnalyzing ? 'Đang phân tích...' : 'Lưu check-in hôm nay'}
          </button>
          {quickFeedback && <p className="quick-feedback" role="status">{quickFeedback}</p>}
        </div>

        <aside className="card next-action-card">
          <span className="next-action-kicker">Việc nhỏ tiếp theo</span>
          <div className="next-action-icon" aria-hidden="true">{nextAction.icon}</div>
          <h3>{nextAction.title}</h3>
          <p>{nextAction.text}</p>
          <Link to={nextAction.to} className="btn btn-primary w-full">{nextAction.label}</Link>
          <div className="goal-pill">
            <span>Mục tiêu hiện tại</span>
            <strong>{currentGoal.label}</strong>
          </div>
        </aside>
      </section>

      <section className="card week-overview-card">
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
              onClick={() => setSelectedDayDetail({ dayKey: day.key, logs: day.logs })}
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

      <section className="quick-actions today-tools">
        <div className="section-heading-row mb-3">
          <div>
            <h3>Công cụ cho hôm nay</h3>
            <p className="text-muted">Các lối tắt bạn có thể dùng ngay trong ngày.</p>
          </div>
        </div>
        <div className="actions-grid">
          {[
            { to: '/mood', icon: '💭', label: latestTodayMood ? 'Ghi thêm cảm xúc' : 'Ghi cảm xúc', color: '#a29bfe', primary: true },
            { to: '/pomodoro', icon: '🍅', label: 'Tập trung', color: '#fd79a8' },
            { to: '/garden', icon: '🌱', label: 'Chăm vườn', color: '#55efc4' },
            { to: '/community', icon: '🌍', label: 'Góc chia sẻ', color: '#74b9ff' },
            { to: '/sos', icon: '🆘', label: 'S.O.S', color: '#e17055' },
          ].map(a => (
            <Link key={a.to} to={a.to} className={`action-card ${a.primary ? 'primary-action' : ''}`} style={{ '--action-color': a.color }} aria-label={a.label}>
              <span className="action-icon" aria-hidden="true">{a.icon}</span>
              <span className="action-label">{a.label}</span>
            </Link>
          ))}
        </div>
      </section>

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

      <section className="dashboard-focus-grid secondary-dashboard-grid">
        <div className="card mood-chart-card">
          <h3 className="mb-3">Biểu đồ cảm xúc 7 ngày</h3>
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

      <div className="card">
        <h3 className="mb-3">Huy hiệu của bạn</h3>
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

      <WeeklyInsight />
      <NotificationSettings />

      {selectedDayDetail && (
        <div className="dashboard-modal-overlay" onClick={e => e.target === e.currentTarget && setSelectedDayDetail(null)}>
          <div className="dashboard-day-modal">
            <div className="dashboard-modal-header">
              <h3>Chi tiết {format(new Date(selectedDayDetail.dayKey), 'EEEE, dd/MM/yyyy', { locale: vi })}</h3>
              <button onClick={() => setSelectedDayDetail(null)} aria-label="Đóng chi tiết ngày">×</button>
            </div>
            <div className="dashboard-day-list">
              {selectedDayDetail.logs.map(log => {
                const mood = MOODS.find(m => m.id === log.mood);
                const cleanNote = log.note?.replace(/\s*\[.+\]$/, '') || '';
                const causeTags = log.note?.match(/\[(.+)\]/)?.[1]?.split(', ') || [];
                return (
                  <div key={log.id} className="dashboard-day-entry" style={{ '--entry-color': mood?.color || '#ccc' }}>
                    <div className="dashboard-day-entry-head">
                      <span>{mood?.emoji} {mood?.label || 'Không rõ'}</span>
                      <strong>{format(new Date(log.date), 'HH:mm')}</strong>
                    </div>
                    {causeTags.length > 0 && (
                      <div className="dashboard-day-causes">
                        {causeTags.map(tag => <span key={tag}>{tag}</span>)}
                      </div>
                    )}
                    <p>{cleanNote || 'Không có ghi chú thêm.'}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
