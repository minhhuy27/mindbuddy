import React from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import './Needs.css';

const NEEDS = [
  {
    id: 'stress',
    icon: '🫁',
    label: 'Căng thẳng',
    title: 'Mình cần hạ nhịp',
    desc: 'Ưu tiên làm dịu cơ thể trước, rồi mới xử lý vấn đề.',
  },
  {
    id: 'focus',
    icon: '🎯',
    label: 'Mất tập trung',
    title: 'Mình cần bắt đầu nhẹ',
    desc: 'Chọn một phiên ngắn, rõ việc, không ép mình phải hoàn hảo.',
  },
  {
    id: 'sad',
    icon: '🌧️',
    label: 'Buồn',
    title: 'Mình cần được giữ lại',
    desc: 'Viết cho mình, quay về hiện tại, và bớt phải chịu một mình.',
  },
  {
    id: 'okay',
    icon: '🌿',
    label: 'Ổn',
    title: 'Mình cần ghi nhận điều tốt',
    desc: 'Khi đang ổn, lưu lại một tín hiệu tốt để ngày sau có thứ quay về.',
  },
];

const BREATHING_STEPS = [
  { label: 'Hít vào', seconds: 4 },
  { label: 'Giữ hơi', seconds: 7 },
  { label: 'Thở ra', seconds: 8 },
];

const GROUNDING_STEPS = [
  '5 thứ mình nhìn thấy',
  '4 thứ mình chạm được',
  '3 âm thanh mình nghe được',
  '2 mùi mình nhận ra',
  '1 điều mình muốn nói nhẹ với bản thân',
];

function userKey(user, name) {
  return `mb_${name}_${user?.uid || user?.email || 'guest'}`;
}

function getTodayLogs(moodLogs) {
  const today = new Date().toDateString();
  return moodLogs.filter(log => new Date(log.date).toDateString() === today);
}

function inferNeed(latestMood, latestLog) {
  const metrics = latestLog?.metrics || {};
  const stress = Number(metrics.stress);
  const focus = Number(metrics.focus);
  const label = (latestMood?.label || '').toLowerCase();

  if (Number.isFinite(stress) && stress >= 4) return 'stress';
  if (label.includes('căng') || label.includes('lo') || label.includes('áp lực')) return 'stress';
  if (Number.isFinite(focus) && focus <= 2) return 'focus';
  if (label.includes('mất tập trung') || label.includes('phân tán')) return 'focus';
  if ((latestMood?.score || 0) <= 2 || label.includes('buồn') || label.includes('mệt')) return 'sad';
  if ((latestMood?.score || 0) >= 3) return 'okay';
  return 'stress';
}

function readLetters(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
}

export default function Needs() {
  const {
    user, moodLogs, MOODS, customMoods,
    addConfession, addMoodLog,
  } = useApp();

  const allMoods = React.useMemo(
    () => [...MOODS, ...(customMoods || [])],
    [MOODS, customMoods]
  );
  const todayLogs = React.useMemo(() => getTodayLogs(moodLogs), [moodLogs]);
  const latestLog = todayLogs[0] || moodLogs[0];
  const latestMood = latestLog ? allMoods.find(mood => mood.id === latestLog.mood) : null;
  const inferredNeed = inferNeed(latestMood, latestLog);

  const [selectedNeed, setSelectedNeed] = React.useState(inferredNeed);
  const [releaseText, setReleaseText] = React.useState('');
  const [futureLetter, setFutureLetter] = React.useState('');
  const [goodThing, setGoodThing] = React.useState('');
  const [savedMessage, setSavedMessage] = React.useState('');
  const [groundingDone, setGroundingDone] = React.useState([]);
  const [breathing, setBreathing] = React.useState(false);
  const [breathStep, setBreathStep] = React.useState(0);
  const [timeLeft, setTimeLeft] = React.useState(BREATHING_STEPS[0].seconds);
  const timerRef = React.useRef(null);

  React.useEffect(() => {
    setSelectedNeed(inferredNeed);
  }, [inferredNeed]);

  React.useEffect(() => {
    if (!breathing) return undefined;
    timerRef.current = window.setTimeout(() => {
      if (timeLeft > 1) {
        setTimeLeft(timeLeft - 1);
        return;
      }
      const next = (breathStep + 1) % BREATHING_STEPS.length;
      setBreathStep(next);
      setTimeLeft(BREATHING_STEPS[next].seconds);
    }, 1000);

    return () => window.clearTimeout(timerRef.current);
  }, [breathing, breathStep, timeLeft]);

  const activeNeed = NEEDS.find(need => need.id === selectedNeed) || NEEDS[0];
  const lettersKey = React.useMemo(() => userKey(user, 'future_letters'), [user]);

  const showSaved = (message) => {
    setSavedMessage(message);
    window.setTimeout(() => setSavedMessage(''), 2400);
  };

  const startBreathing = () => {
    setBreathStep(0);
    setTimeLeft(BREATHING_STEPS[0].seconds);
    setBreathing(true);
  };

  const stopBreathing = () => {
    setBreathing(false);
    setBreathStep(0);
    setTimeLeft(BREATHING_STEPS[0].seconds);
    window.clearInterval(timerRef.current);
  };

  const saveRelease = async () => {
    const value = releaseText.trim();
    if (!value) return;
    await addConfession(value);
    setReleaseText('');
    showSaved('Đã lưu vào Góc xả lòng.');
  };

  const saveFutureLetter = () => {
    const value = futureLetter.trim();
    if (!value) return;
    const openAt = new Date();
    openAt.setDate(openAt.getDate() + 30);
    const next = [{
      id: Date.now(),
      text: value,
      createdAt: new Date().toISOString(),
      openAt: openAt.toISOString(),
    }, ...readLetters(lettersKey)];
    localStorage.setItem(lettersKey, JSON.stringify(next));
    setFutureLetter('');
    showSaved('Đã gửi thư tới bạn của 30 ngày sau.');
  };

  const saveGoodThing = async () => {
    const value = goodThing.trim();
    if (!value) return;
    const positiveMood = allMoods.find(mood => mood.score >= 4) || allMoods[0];
    await addMoodLog(positiveMood.id, `Điều tốt hôm nay: ${value}`, {
      stress: 2,
      energy: 4,
      sleep: 3,
      focus: 4,
    });
    setGoodThing('');
    showSaved('Đã ghi nhận điều tốt hôm nay.');
  };

  const toggleGroundingStep = (index) => {
    setGroundingDone(done => (
      done.includes(index) ? done.filter(item => item !== index) : [...done, index]
    ));
  };

  return (
    <div className="needs-page">
      <section className="needs-hero">
        <div>
          <span className="needs-kicker">Mình đang cần gì?</span>
          <h1>{activeNeed.title}</h1>
          <p>{activeNeed.desc}</p>
        </div>
        <div className="needs-current-card">
          <span>Trạng thái gần nhất</span>
          <strong>{latestMood ? `${latestMood.emoji} ${latestMood.label}` : 'Chưa có check-in'}</strong>
          <small>{latestLog?.metrics?.stress ? `Stress ${latestLog.metrics.stress}/5` : 'Bạn có thể chọn trạng thái thủ công bên dưới.'}</small>
        </div>
      </section>

      <section className="need-picker" aria-label="Chọn trạng thái hiện tại">
        {NEEDS.map(need => (
          <button
            key={need.id}
            className={selectedNeed === need.id ? 'active' : ''}
            onClick={() => setSelectedNeed(need.id)}
            aria-pressed={selectedNeed === need.id}
          >
            <span>{need.icon}</span>
            <strong>{need.label}</strong>
          </button>
        ))}
      </section>

      {savedMessage && <p className="needs-saved-message" role="status">{savedMessage}</p>}

      <section className="needs-content-grid">
        {selectedNeed === 'stress' && (
          <>
            <div className="card need-tool-card breathing-need-card">
              <div className="need-tool-head">
                <div>
                  <h3>Thở 4-7-8</h3>
                  <p className="text-muted">Một vòng ngắn để cơ thể hạ nhịp trước.</p>
                </div>
                <span>🫁</span>
              </div>
              <div className={`need-breath-circle ${breathing ? 'running' : ''}`}>
                <strong>{BREATHING_STEPS[breathStep].label}</strong>
                <b>{timeLeft}</b>
              </div>
              <button className="btn btn-primary w-full" onClick={breathing ? stopBreathing : startBreathing}>
                {breathing ? 'Dừng thở' : 'Bắt đầu thở'}
              </button>
            </div>

            <div className="card need-tool-card">
              <div className="need-tool-head">
                <div>
                  <h3>Viết xả</h3>
                  <p className="text-muted">Đặt điều đang nặng xuống vài dòng.</p>
                </div>
                <span>📝</span>
              </div>
              <textarea value={releaseText} onChange={e => setReleaseText(e.target.value)} rows={5} placeholder="Điều đang làm mình căng là..." />
              <button className="btn btn-primary w-full" onClick={saveRelease} disabled={!releaseText.trim()}>Lưu vào Góc xả lòng</button>
            </div>

            <Link className="need-action-link sos" to="/sos">
              <span>🆘</span>
              <div>
                <strong>Mở S.O.S</strong>
                <p>Hotline, liên hệ khẩn cấp và bài thở đầy đủ.</p>
              </div>
            </Link>
          </>
        )}

        {selectedNeed === 'focus' && (
          <>
            <div className="card need-tool-card focus-plan-card">
              <div className="need-tool-head">
                <div>
                  <h3>Pomodoro nhẹ</h3>
                  <p className="text-muted">Đặt mục tiêu chỉ 15 phút: mở tài liệu, làm một bước nhỏ.</p>
                </div>
                <span>🍅</span>
              </div>
              <div className="focus-steps">
                <span>1. Chọn việc nhỏ nhất</span>
                <span>2. Tắt bớt tab gây nhiễu</span>
                <span>3. Bắt đầu Pomodoro ngắn</span>
              </div>
              <Link className="btn btn-primary w-full" to="/pomodoro">Mở Pomodoro</Link>
            </div>

            <div className="card need-tool-card">
              <h3>Gợi ý bắt đầu</h3>
              <p className="need-large-copy">“Mình chỉ cần làm 15 phút, không cần giải quyết hết hôm nay.”</p>
              <Link className="btn btn-secondary w-full" to="/mood">Ghi nhanh vì sao mình khó tập trung</Link>
            </div>
          </>
        )}

        {selectedNeed === 'sad' && (
          <>
            <div className="card need-tool-card">
              <div className="need-tool-head">
                <div>
                  <h3>Thư gửi mình của tương lai</h3>
                  <p className="text-muted">Gửi một lá thư mở sau 30 ngày.</p>
                </div>
                <span>💌</span>
              </div>
              <textarea value={futureLetter} onChange={e => setFutureLetter(e.target.value)} rows={5} placeholder="Mình của tương lai ơi..." />
              <button className="btn btn-primary w-full" onClick={saveFutureLetter} disabled={!futureLetter.trim()}>Gửi thư</button>
            </div>

            <div className="card need-tool-card grounding-card">
              <div className="need-tool-head">
                <div>
                  <h3>Grounding 5-4-3-2-1</h3>
                  <p className="text-muted">Đưa sự chú ý quay về căn phòng hiện tại.</p>
                </div>
                <span>🧭</span>
              </div>
              <div className="grounding-list">
                {GROUNDING_STEPS.map((step, index) => (
                  <button key={step} className={groundingDone.includes(index) ? 'done' : ''} onClick={() => toggleGroundingStep(index)}>
                    <span>{groundingDone.includes(index) ? '✓' : index + 1}</span>
                    {step}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {selectedNeed === 'okay' && (
          <>
            <div className="card need-tool-card">
              <div className="need-tool-head">
                <div>
                  <h3>Ghi nhận điều tốt</h3>
                  <p className="text-muted">Lưu lại một điều nhỏ đang ổn.</p>
                </div>
                <span>✨</span>
              </div>
              <textarea value={goodThing} onChange={e => setGoodThing(e.target.value)} rows={4} placeholder="Một điều tốt hôm nay là..." />
              <button className="btn btn-primary w-full" onClick={saveGoodThing} disabled={!goodThing.trim()}>Ghi nhận</button>
            </div>

            <Link className="need-action-link garden" to="/garden">
              <span>🌱</span>
              <div>
                <strong>Chăm vườn</strong>
                <p>Đánh dấu một thói quen nhỏ để giữ nhịp tốt.</p>
              </div>
            </Link>

            <Link className="need-action-link review" to="/daily-review">
              <span>🪞</span>
              <div>
                <strong>Nhìn lại ngày</strong>
                <p>Xem điều gì đang giúp hôm nay nhẹ hơn.</p>
              </div>
            </Link>
          </>
        )}
      </section>
    </div>
  );
}
