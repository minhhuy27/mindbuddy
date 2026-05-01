import React, { useState, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import './SOS.css';

const HOTLINES = [
  { name: 'Đường dây hỗ trợ sức khỏe tâm thần', number: '1800 599 920', icon: '🧠', free: true },
  { name: 'Tổng đài tư vấn tâm lý trẻ em', number: '1800 1567', icon: '👶', free: true },
  { name: 'Đường dây hỗ trợ khủng hoảng', number: '1800 599 920', icon: '🆘', free: true },
  { name: 'Bệnh viện Tâm thần TW1', number: '024 3825 3556', icon: '🏥', free: false },
];

const BREATHING_STEPS = [
  { label: 'Hít vào', duration: 4, color: '#74b9ff' },
  { label: 'Giữ hơi', duration: 7, color: '#a29bfe' },
  { label: 'Thở ra', duration: 8, color: '#55efc4' },
];

export default function SOS() {
  const { emergencyContact, setEmergencyContact } = useApp();
  const [contact, setContact] = useState(emergencyContact);
  const [saved, setSaved] = useState(false);
  const [breathing, setBreathing] = useState(false);
  const [breathStep, setBreathStep] = useState(0);
  const [breathCount, setBreathCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef(null);
  const stoppedRef = useRef(false); // cờ dừng để tránh memory leak

  const saveContact = () => {
    setEmergencyContact(contact);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const stopBreathing = useCallback(() => {
    stoppedRef.current = true;
    clearInterval(timerRef.current);
    setBreathing(false);
    setBreathStep(0);
    setBreathCount(0);
    setTimeLeft(0);
  }, []);

  const runStep = useCallback((step, count) => {
    if (stoppedRef.current) return;
    const s = BREATHING_STEPS[step];
    setBreathStep(step);
    setTimeLeft(s.duration);
    let t = s.duration;
    timerRef.current = setInterval(() => {
      if (stoppedRef.current) {
        clearInterval(timerRef.current);
        return;
      }
      t--;
      setTimeLeft(t);
      if (t <= 0) {
        clearInterval(timerRef.current);
        const nextStep = (step + 1) % 3;
        const nextCount = nextStep === 0 ? count + 1 : count;
        setBreathCount(nextCount);
        if (nextCount >= 3 && nextStep === 0) {
          setBreathing(false);
        } else {
          runStep(nextStep, nextCount);
        }
      }
    }, 1000);
  }, []);

  const startBreathing = () => {
    stoppedRef.current = false;
    clearInterval(timerRef.current);
    setBreathing(true);
    setBreathStep(0);
    setBreathCount(0);
    runStep(0, 0);
  };

  // Cleanup khi unmount
  React.useEffect(() => {
    return () => {
      stoppedRef.current = true;
      clearInterval(timerRef.current);
    };
  }, []);

  const step = BREATHING_STEPS[breathStep];

  return (
    <div className="sos-page">
      <div className="sos-banner">
        <h2>🆘 Hỗ trợ khẩn cấp</h2>
        <p>Bạn không đơn độc. Luôn có người sẵn sàng lắng nghe bạn.</p>
      </div>

      <div className="sos-layout">
        <div className="left-col">
          <div className="card">
            <h3 className="mb-3">📞 Hotline tư vấn tâm lý</h3>
            <div className="hotlines">
              {HOTLINES.map((h, i) => (
                <div key={i} className="hotline-item">
                  <span className="hotline-icon">{h.icon}</span>
                  <div className="hotline-info">
                    <div className="hotline-name">{h.name}</div>
                    <a href={`tel:${h.number}`} className="hotline-number">{h.number}</a>
                  </div>
                  {h.free && <span className="badge" style={{ background: '#e8f5e9', color: '#2e7d32' }}>Miễn phí</span>}
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h3 className="mb-2">👤 Liên hệ khẩn cấp</h3>
            <p className="text-muted mb-3">Khi bạn nhấn S.O.S, người này sẽ được thông báo.</p>
            <input value={contact} onChange={e => setContact(e.target.value)}
              placeholder="Số điện thoại người thân..." />
            <button className="btn btn-primary mt-3" onClick={saveContact}>
              {saved ? '✅ Đã lưu!' : 'Lưu liên hệ'}
            </button>
            {emergencyContact && (
              <a href={`tel:${emergencyContact}`} className="btn btn-danger w-full mt-2"
                style={{ display: 'block', textAlign: 'center', textDecoration: 'none', padding: '10px' }}>
                📞 Gọi ngay cho {emergencyContact}
              </a>
            )}
          </div>
        </div>

        <div className="right-col">
          <div className="card breathing-card">
            <h3 className="mb-2">🫁 Bài tập hít thở 4-7-8</h3>
            <p className="text-muted mb-4">Kỹ thuật giúp giảm lo âu và căng thẳng ngay lập tức.</p>

            {!breathing ? (
              <button className="btn btn-primary w-full" style={{ padding: '14px' }} onClick={startBreathing}>
                Bắt đầu hít thở 🌬️
              </button>
            ) : (
              <div className="breathing-exercise">
                <div className="breath-circle" style={{ '--breath-color': step.color }}>
                  <div className="breath-label">{step.label}</div>
                  <div className="breath-count">{timeLeft}</div>
                  <div className="breath-round">Vòng {breathCount + 1}/3</div>
                </div>
                <div className="breath-steps">
                  {BREATHING_STEPS.map((s, i) => (
                    <div key={i} className={`breath-step ${breathStep === i ? 'active' : ''}`}>
                      <span>{s.label}</span>
                      <span>{s.duration}s</span>
                    </div>
                  ))}
                </div>
                <button className="btn btn-secondary w-full mt-3" onClick={stopBreathing}>Dừng lại</button>
              </div>
            )}
          </div>

          <div className="card">
            <h3 className="mb-3">💬 Lời nhắn nhủ</h3>
            <div className="affirmations">
              {[
                '💙 Cảm xúc của bạn là hoàn toàn hợp lệ.',
                '🌟 Bạn đã vượt qua nhiều thứ khó khăn hơn thế này.',
                '🤝 Tìm kiếm sự giúp đỡ là dấu hiệu của sức mạnh.',
                '🌈 Sau cơn mưa trời lại sáng. Hãy kiên nhẫn với bản thân.',
                '💪 Bạn quan trọng hơn bạn nghĩ rất nhiều.',
              ].map((msg, i) => (
                <div key={i} className="affirmation">{msg}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
