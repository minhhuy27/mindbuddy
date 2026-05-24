import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { notifyPomodoroBreak, notifyPomodoroResume } from '../utils/notifications';
import './Pomodoro.css';

const SOUNDS = [
  { id: 'none', label: '🔇 Yên tĩnh', url: null },
  { id: 'lofi', label: '🎵 Lo-fi', url: 'https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3' },
  { id: 'rain', label: '🌧️ Tiếng mưa', url: 'https://cdn.pixabay.com/audio/2022/03/10/audio_270f49d3e6.mp3' },
  { id: 'wave', label: '🌊 Sóng biển', url: 'https://cdn.pixabay.com/audio/2021/09/06/audio_6f5b5e5e5e.mp3' },
];

const BREAKS = [
  { icon: '🫁', title: 'Hít thở 4-7-8', desc: 'Hít vào 4 giây, giữ 7 giây, thở ra 8 giây. Lặp lại 3 lần.' },
  { icon: '🙆', title: 'Giãn cơ cổ vai', desc: 'Xoay cổ nhẹ nhàng 5 vòng mỗi chiều. Nâng vai lên tai rồi thả xuống.' },
  { icon: '👁️', title: 'Nghỉ mắt 20-20-20', desc: 'Nhìn vào vật cách 6m trong 20 giây. Lặp lại 3 lần.' },
  { icon: '🚶', title: 'Đứng dậy đi lại', desc: 'Đứng dậy, đi lại trong phòng 2-3 phút để tăng tuần hoàn máu.' },
];

const AFTER_FEELINGS = [
  { id: 'clearer', icon: '✨', label: 'Rõ hơn' },
  { id: 'same', icon: '➖', label: 'Như cũ' },
  { id: 'tired', icon: '😮‍💨', label: 'Mệt hơn' },
  { id: 'stressed', icon: '🌧️', label: 'Căng hơn' },
];

function todayKey() {
  return new Date().toDateString();
}

function normalizeMetric(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(5, Math.max(1, number)) : null;
}

function buildSmartRecommendation(metrics) {
  if (!metrics) {
    return {
      type: 'neutral',
      icon: '🍅',
      title: 'Bắt đầu nhẹ nhàng',
      text: 'Chưa có chỉ số gần nhất. Một phiên 25 phút là mặc định ổn để thử nhịp hôm nay.',
      duration: 25,
      actionLabel: 'Dùng 25 phút',
      chips: [],
    };
  }

  const focus = normalizeMetric(metrics.focus);
  const stress = normalizeMetric(metrics.stress);
  const energy = normalizeMetric(metrics.energy);

  if (energy !== null && energy <= 2) {
    return {
      type: 'tired',
      icon: '🪫',
      title: 'Đang mệt: chỉ làm một việc nhỏ',
      text: 'Năng lượng gần nhất thấp. Đừng ép phiên dài, chỉ chọn một việc nhỏ có thể xong trong 5 phút.',
      duration: 5,
      actionLabel: 'Đặt 5 phút',
      chips: [`Năng lượng ${energy}/5`],
    };
  }

  if (stress !== null && stress >= 4) {
    return {
      type: 'stress',
      icon: '🫁',
      title: 'Stress cao: thở 5 phút trước',
      text: 'Căng thẳng gần nhất khá cao. Hạ nhịp trước rồi hãy vào phiên học sẽ dễ bám việc hơn.',
      duration: 25,
      actionLabel: 'Chuẩn bị 25 phút',
      chips: [`Stress ${stress}/5`, focus ? `Tập trung ${focus}/5` : null].filter(Boolean),
      sos: true,
    };
  }

  if (focus !== null && focus <= 2) {
    return {
      type: 'low-focus',
      icon: '🎯',
      title: 'Focus thấp: Pomodoro 15 phút',
      text: 'Mức tập trung gần nhất thấp. Một phiên ngắn đủ để vào guồng mà không tạo áp lực.',
      duration: 15,
      actionLabel: 'Đặt 15 phút',
      chips: [`Tập trung ${focus}/5`],
    };
  }

  if ((energy === null || energy >= 3) && (focus === null || focus >= 3)) {
    return {
      type: 'steady',
      icon: '⚡',
      title: 'Năng lượng ổn: Pomodoro 25 phút',
      text: 'Chỉ số gần nhất đủ ổn để dùng phiên tiêu chuẩn. Giữ một mục tiêu rõ trước khi bấm bắt đầu.',
      duration: 25,
      actionLabel: 'Đặt 25 phút',
      chips: [
        energy ? `Năng lượng ${energy}/5` : null,
        focus ? `Tập trung ${focus}/5` : null,
      ].filter(Boolean),
    };
  }

  return {
    type: 'neutral',
    icon: '🍅',
    title: 'Bắt đầu vừa sức',
    text: 'Chọn một phiên vừa đủ và ghi lại cảm nhận sau phiên để MindBuddy học nhịp tập trung của bạn.',
    duration: 20,
    actionLabel: 'Đặt 20 phút',
    chips: [],
  };
}

export default function Pomodoro() {
  const { incrementPomodoro, pomodoroCount, user, moodLogs } = useApp();
  const [mode, setMode] = useState('work'); // work | break
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [workMin, setWorkMin] = useState(25);
  const [breakMin, setBreakMin] = useState(5);
  const [sound, setSound] = useState('none');
  const [breakTip, setBreakTip] = useState(null);
  const [focusBefore, setFocusBefore] = useState(3);
  const [focusAfter, setFocusAfter] = useState(3);
  const [afterFeeling, setAfterFeeling] = useState('clearer');
  const [afterNote, setAfterNote] = useState('');
  const sessionKey = `mb_pomodoro_mood_sessions_${user?.uid || user?.email || 'guest'}`;
  const [pomodoroMoodSessions, setPomodoroMoodSessions] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(sessionKey) || '[]');
    } catch {
      return [];
    }
  });
  const [activeSession, setActiveSession] = useState(null);
  const [pendingReview, setPendingReview] = useState(null);
  const [sessions, setSessions] = useState(() => {
    // Khôi phục số phiên hôm nay từ localStorage
    const savedDate = localStorage.getItem('mb_pomodoro_date');
    const savedSessions = parseInt(localStorage.getItem('mb_pomodoro_sessions') || '0');
    if (savedDate === new Date().toDateString()) return savedSessions;
    return 0;
  });
  const intervalRef = useRef(null);
  const audioRef = useRef(null);
  const activeSessionRef = useRef(null);
  const latestMoodLog = React.useMemo(() => (
    [...moodLogs]
      .filter(log => log.metrics)
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0] || null
  ), [moodLogs]);
  const latestMetrics = latestMoodLog?.metrics || null;
  const smartRecommendation = React.useMemo(() => buildSmartRecommendation(latestMetrics), [latestMetrics]);

  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  useEffect(() => {
    try {
      const next = JSON.parse(localStorage.getItem(sessionKey) || '[]');
      setPomodoroMoodSessions(next);
    } catch {
      setPomodoroMoodSessions([]);
    }
  }, [sessionKey]);

  useEffect(() => {
    const latestFocus = normalizeMetric(latestMetrics?.focus);
    if (!latestFocus || running || activeSessionRef.current) return;
    setFocusBefore(latestFocus);
  }, [latestMetrics, running]);

  const savePomodoroMoodSessions = (next) => {
    const capped = next.slice(0, 30);
    setPomodoroMoodSessions(capped);
    localStorage.setItem(sessionKey, JSON.stringify(capped));
  };

  const createWorkSession = () => {
    const session = {
      id: Date.now(),
      date: new Date().toISOString(),
      durationMin: workMin,
      focusBefore,
      status: 'running',
    };
    setActiveSession(session);
    return session;
  };

  const finishWorkSession = () => {
    const current = activeSessionRef.current || {
      id: Date.now(),
      date: new Date().toISOString(),
      durationMin: workMin,
      focusBefore,
    };
    const completed = {
      ...current,
      status: 'completed',
      completedAt: new Date().toISOString(),
    };
    setPendingReview(completed);
    setFocusAfter(current.focusBefore || 3);
    setAfterFeeling('clearer');
    setAfterNote('');
    setActiveSession(null);
    savePomodoroMoodSessions([completed, ...pomodoroMoodSessions.filter(s => s.id !== completed.id)]);
  };

  const saveSessionReview = () => {
    if (!pendingReview) return;
    const reviewed = {
      ...pendingReview,
      focusAfter,
      afterFeeling,
      afterNote: afterNote.trim(),
      reviewedAt: new Date().toISOString(),
    };
    savePomodoroMoodSessions([reviewed, ...pomodoroMoodSessions.filter(s => s.id !== reviewed.id)]);
    setPendingReview(null);
    setAfterNote('');
  };

  // Khởi tạo và quản lý audio khi sound thay đổi
  useEffect(() => {
    // Dừng audio cũ
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    const selected = SOUNDS.find(s => s.id === sound);
    if (selected?.url && running) {
      const audio = new Audio(selected.url);
      audio.loop = true;
      audio.volume = 0.4;
      audio.play().catch(() => {}); // ignore autoplay policy errors
      audioRef.current = audio;
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [sound, running]);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) {
            clearInterval(intervalRef.current);
            setRunning(false);
            if (mode === 'work') {
              incrementPomodoro();
              setSessions(s => {
                const next = s + 1;
                localStorage.setItem('mb_pomodoro_sessions', next);
                localStorage.setItem('mb_pomodoro_date', new Date().toDateString());
                return next;
              });
              finishWorkSession();
              setBreakTip(BREAKS[Math.floor(Math.random() * BREAKS.length)]);
              notifyPomodoroBreak();
              setMode('break');
              setTimeLeft(breakMin * 60);
            } else {
              notifyPomodoroResume();
              setMode('work');
              setTimeLeft(workMin * 60);
              setBreakTip(null);
            }
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [running, mode, workMin, breakMin]);

  const toggle = () => {
    setRunning(r => {
      const next = !r;
      if (next && mode === 'work' && !activeSessionRef.current) {
        createWorkSession();
      }
      return next;
    });
  };
  const reset = () => {
    setRunning(false);
    setMode('work');
    setTimeLeft(workMin * 60);
    setBreakTip(null);
    setActiveSession(null);
  };

  const applySmartRecommendation = () => {
    const nextDuration = smartRecommendation.duration || 25;
    setWorkMin(nextDuration);
    if (mode === 'work' && !running) setTimeLeft(nextDuration * 60);
  };

  const mm = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const ss = String(timeLeft % 60).padStart(2, '0');
  const progress = mode === 'work'
    ? ((workMin * 60 - timeLeft) / (workMin * 60)) * 100
    : ((breakMin * 60 - timeLeft) / (breakMin * 60)) * 100;
  const remainingForBadge = Math.max(0, 10 - pomodoroCount);
  const todayMoodSessions = pomodoroMoodSessions.filter(s => new Date(s.date).toDateString() === todayKey());
  const reviewedToday = todayMoodSessions.filter(s => s.focusAfter);
  const avgFocusBefore = todayMoodSessions.length
    ? (todayMoodSessions.reduce((sum, s) => sum + Number(s.focusBefore || 0), 0) / todayMoodSessions.length).toFixed(1)
    : null;
  const avgFocusAfter = reviewedToday.length
    ? (reviewedToday.reduce((sum, s) => sum + Number(s.focusAfter || 0), 0) / reviewedToday.length).toFixed(1)
    : null;

  return (
    <div className="pomodoro-page">
      <h2 className="mb-4">🍅 Smart Pomodoro</h2>

      <div className="pomodoro-layout">
        <div className="card timer-card">
          <div className="mode-tabs">
            <button className={`mode-tab ${mode === 'work' ? 'active' : ''}`} onClick={() => { setMode('work'); setTimeLeft(workMin * 60); setRunning(false); setActiveSession(null); }}>
              🎯 Tập trung
            </button>
            <button className={`mode-tab ${mode === 'break' ? 'active' : ''}`} onClick={() => { setMode('break'); setTimeLeft(breakMin * 60); setRunning(false); setActiveSession(null); }}>
              ☕ Nghỉ giải lao
            </button>
          </div>

          {mode === 'work' && !running && (
            <>
              <div className={`smart-pomodoro-card ${smartRecommendation.type}`}>
                <div className="smart-pomodoro-icon" aria-hidden="true">{smartRecommendation.icon}</div>
                <div className="smart-pomodoro-copy">
                  <span>Gợi ý phiên này</span>
                  <strong>{smartRecommendation.title}</strong>
                  <p>{smartRecommendation.text}</p>
                  {latestMoodLog && (
                    <small>Dựa trên check-in gần nhất lúc {new Date(latestMoodLog.date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}.</small>
                  )}
                  {smartRecommendation.chips.length > 0 && (
                    <div className="smart-pomodoro-chips">
                      {smartRecommendation.chips.map(chip => <i key={chip}>{chip}</i>)}
                    </div>
                  )}
                </div>
                <div className="smart-pomodoro-actions">
                  {smartRecommendation.sos && <Link className="btn btn-secondary" to="/sos">Mở S.O.S</Link>}
                  <button type="button" className="btn btn-primary" onClick={applySmartRecommendation}>
                    {smartRecommendation.actionLabel}
                  </button>
                </div>
              </div>

              <div className="focus-check-card">
                <div className="focus-check-head">
                  <div>
                    <strong>Mức tập trung hiện tại?</strong>
                    <span>Chọn nhanh trước khi bắt đầu phiên học.</span>
                  </div>
                  <b>{focusBefore}/5</b>
                </div>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="1"
                  value={focusBefore}
                  onChange={e => setFocusBefore(Number(e.target.value))}
                  aria-label={`Mức tập trung trước phiên ${focusBefore} trên 5`}
                />
                <div className="focus-scale">
                  <span>Rất phân tán</span>
                  <span>Rất rõ</span>
                </div>
              </div>
            </>
          )}

          <div className="timer-circle" style={{ '--progress': progress }}>
            <svg viewBox="0 0 200 200" className="timer-svg">
              <circle cx="100" cy="100" r="90" fill="none" stroke="#e0e6ff" strokeWidth="8" />
              <circle cx="100" cy="100" r="90" fill="none"
                stroke={mode === 'work' ? '#6c63ff' : '#55efc4'} strokeWidth="8"
                strokeDasharray={`${2 * Math.PI * 90}`}
                strokeDashoffset={`${2 * Math.PI * 90 * (1 - progress / 100)}`}
                strokeLinecap="round" transform="rotate(-90 100 100)" />
            </svg>
            <div className="timer-display">
              <div className="timer-time">{mm}:{ss}</div>
              <div className="timer-mode">{mode === 'work' ? 'Tập trung' : 'Nghỉ ngơi'}</div>
            </div>
          </div>

          <div className="timer-controls">
            <button className="btn btn-secondary" onClick={reset}>↺ Reset</button>
            <button className={`btn ${running ? 'btn-danger' : 'btn-primary'} btn-lg`} onClick={toggle}>
              {running ? '⏸ Tạm dừng' : '▶ Bắt đầu'}
            </button>
          </div>

          <div className="session-count">
            Phiên hôm nay: {sessions} 🍅 | Tổng: {pomodoroCount} 🍅
          </div>
          {(avgFocusBefore || avgFocusAfter) && (
            <div className="focus-summary">
              <span>Trước phiên: {avgFocusBefore || '-'}/5</span>
              <span>Sau phiên: {avgFocusAfter || 'chưa có'}/5</span>
            </div>
          )}
          <div className="pomodoro-badge-progress">
            <div className="mini-progress" role="progressbar" aria-valuemin="0" aria-valuemax="10" aria-valuenow={Math.min(pomodoroCount, 10)} aria-label="Tiến trình huy hiệu Pomodoro">
              <span style={{ width: `${Math.min(100, (pomodoroCount / 10) * 100)}%` }} />
            </div>
            <p>{remainingForBadge === 0 ? 'Bạn đã đủ điều kiện huy hiệu Bậc thầy tập trung.' : `Còn ${remainingForBadge} phiên để mở huy hiệu Bậc thầy tập trung.`}</p>
          </div>
        </div>

        <div className="side-panel">
          {pendingReview && (
            <div className="card session-review-card">
              <h3 className="mb-2">Sau {pendingReview.durationMin} phút, mình thấy thế nào?</h3>
              <p className="text-muted mb-3">Phản hồi ngắn này giúp MindBuddy nhận ra lúc nào bạn tập trung tốt hơn.</p>
              <div className="focus-review-score">
                <div className="focus-check-head">
                  <div>
                    <strong>Tập trung sau phiên</strong>
                    <span>So với trước phiên: {pendingReview.focusBefore}/5</span>
                  </div>
                  <b>{focusAfter}/5</b>
                </div>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="1"
                  value={focusAfter}
                  onChange={e => setFocusAfter(Number(e.target.value))}
                  aria-label={`Mức tập trung sau phiên ${focusAfter} trên 5`}
                />
              </div>
              <div className="after-feeling-grid">
                {AFTER_FEELINGS.map(feeling => (
                  <button
                    key={feeling.id}
                    className={afterFeeling === feeling.id ? 'active' : ''}
                    onClick={() => setAfterFeeling(feeling.id)}
                  >
                    <span>{feeling.icon}</span>
                    {feeling.label}
                  </button>
                ))}
              </div>
              <textarea
                value={afterNote}
                onChange={e => setAfterNote(e.target.value)}
                rows={3}
                placeholder="Điều gì giúp hoặc cản trở phiên này?"
              />
              <button className="btn btn-primary w-full" onClick={saveSessionReview}>
                Lưu cảm nhận sau phiên
              </button>
            </div>
          )}

          <div className="card">
            <h3 className="mb-3">⚙️ Cài đặt</h3>
            <div className="setting-row">
              <label>Thời gian tập trung</label>
              <div className="flex items-center gap-2">
                <input type="range" min="5" max="60" value={workMin}
                  onChange={e => { setWorkMin(+e.target.value); if (mode === 'work' && !running) setTimeLeft(+e.target.value * 60); }}
                  style={{ width: '100%' }} />
                <span className="min-label">{workMin}p</span>
              </div>
            </div>
            <div className="setting-row mt-3">
              <label>Thời gian nghỉ</label>
              <div className="flex items-center gap-2">
                <input type="range" min="1" max="30" value={breakMin}
                  onChange={e => { setBreakMin(+e.target.value); if (mode === 'break' && !running) setTimeLeft(+e.target.value * 60); }}
                  style={{ width: '100%' }} />
                <span className="min-label">{breakMin}p</span>
              </div>
            </div>
            <div className="mt-3">
              <label className="setting-label">🎵 Âm thanh nền</label>
              <div className="sound-options">
                {SOUNDS.map(s => (
                  <button key={s.id} className={`sound-btn ${sound === s.id ? 'active' : ''}`}
                    onClick={() => setSound(s.id)}>{s.label}</button>
                ))}
              </div>
            </div>
          </div>

          {breakTip && (
            <div className="card break-tip">
              <h3 className="mb-2">💆 Gợi ý nghỉ ngơi</h3>
              <div className="tip-icon">{breakTip.icon}</div>
              <h4>{breakTip.title}</h4>
              <p className="text-muted mt-2">{breakTip.desc}</p>
            </div>
          )}

          <div className="card focus-history-card">
            <h3 className="mb-3">🧠 Dữ liệu tập trung</h3>
            {pomodoroMoodSessions.length === 0 ? (
              <p className="text-muted">Hoàn thành một phiên để bắt đầu thấy lúc nào bạn tập trung tốt hơn.</p>
            ) : (
              <div className="focus-session-list">
                {pomodoroMoodSessions.slice(0, 5).map(session => {
                  const feeling = AFTER_FEELINGS.find(f => f.id === session.afterFeeling);
                  return (
                    <div key={session.id} className="focus-session-item">
                      <div>
                        <strong>{new Date(session.date).toLocaleDateString('vi-VN')}</strong>
                        <span>{session.durationMin} phút</span>
                      </div>
                      <div className="focus-session-scores">
                        <span>Trước {session.focusBefore}/5</span>
                        <span>Sau {session.focusAfter ? `${session.focusAfter}/5` : 'chưa ghi'}</span>
                      </div>
                      {feeling && <p>{feeling.icon} {feeling.label}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="card">
            <h3 className="mb-3">📚 Kho nội dung</h3>
            {[
              { icon: '🎧', title: 'Podcast: Vượt qua áp lực thi cử', type: 'Podcast' },
              { icon: '📖', title: 'Kỹ thuật quản lý thời gian hiệu quả', type: 'Bài viết' },
              { icon: '🎵', title: 'Nhạc thiền tập trung - 1 giờ', type: 'Âm nhạc' },
              { icon: '🧘', title: 'Thiền 5 phút cho sinh viên', type: 'Thiền' },
            ].map((item, i) => (
              <div key={i} className="content-item">
                <span className="content-icon">{item.icon}</span>
                <div>
                  <div className="content-title">{item.title}</div>
                  <span className="badge" style={{ background: '#ede9ff', color: '#6c63ff' }}>{item.type}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
