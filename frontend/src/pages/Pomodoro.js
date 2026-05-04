import React, { useState, useEffect, useRef } from 'react';
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

export default function Pomodoro() {
  const { incrementPomodoro, pomodoroCount } = useApp();
  const [mode, setMode] = useState('work'); // work | break
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [workMin, setWorkMin] = useState(25);
  const [breakMin, setBreakMin] = useState(5);
  const [sound, setSound] = useState('none');
  const [breakTip, setBreakTip] = useState(null);
  const [sessions, setSessions] = useState(() => {
    // Khôi phục số phiên hôm nay từ localStorage
    const savedDate = localStorage.getItem('mb_pomodoro_date');
    const savedSessions = parseInt(localStorage.getItem('mb_pomodoro_sessions') || '0');
    if (savedDate === new Date().toDateString()) return savedSessions;
    return 0;
  });
  const intervalRef = useRef(null);
  const audioRef = useRef(null);

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

  const toggle = () => setRunning(r => !r);
  const reset = () => {
    setRunning(false);
    setMode('work');
    setTimeLeft(workMin * 60);
    setBreakTip(null);
  };

  const mm = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const ss = String(timeLeft % 60).padStart(2, '0');
  const progress = mode === 'work'
    ? ((workMin * 60 - timeLeft) / (workMin * 60)) * 100
    : ((breakMin * 60 - timeLeft) / (breakMin * 60)) * 100;
  const remainingForBadge = Math.max(0, 10 - pomodoroCount);

  return (
    <div className="pomodoro-page">
      <h2 className="mb-4">🍅 Smart Pomodoro</h2>

      <div className="pomodoro-layout">
        <div className="card timer-card">
          <div className="mode-tabs">
            <button className={`mode-tab ${mode === 'work' ? 'active' : ''}`} onClick={() => { setMode('work'); setTimeLeft(workMin * 60); setRunning(false); }}>
              🎯 Tập trung
            </button>
            <button className={`mode-tab ${mode === 'break' ? 'active' : ''}`} onClick={() => { setMode('break'); setTimeLeft(breakMin * 60); setRunning(false); }}>
              ☕ Nghỉ giải lao
            </button>
          </div>

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
          <div className="pomodoro-badge-progress">
            <div className="mini-progress" role="progressbar" aria-valuemin="0" aria-valuemax="10" aria-valuenow={Math.min(pomodoroCount, 10)} aria-label="Tiến trình huy hiệu Pomodoro">
              <span style={{ width: `${Math.min(100, (pomodoroCount / 10) * 100)}%` }} />
            </div>
            <p>{remainingForBadge === 0 ? 'Bạn đã đủ điều kiện huy hiệu Bậc thầy tập trung.' : `Còn ${remainingForBadge} phiên để mở huy hiệu Bậc thầy tập trung.`}</p>
          </div>
        </div>

        <div className="side-panel">
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
