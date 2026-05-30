import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import CrisisPanel from '../components/CrisisPanel';
import { useApp } from '../context/AppContext';
import { counselMindBuddy, detectDanger } from '../utils/aiService';
import './Counseling.css';

const MODES = [
  {
    id: 'listen',
    icon: '🫶',
    label: 'Lắng nghe',
    desc: 'Khi bạn chỉ cần được giữ nhịp và nói ra điều đang nặng.',
    prompt: 'Mình đang muốn được lắng nghe về...',
  },
  {
    id: 'reframe',
    icon: '🧩',
    label: 'Gỡ rối',
    desc: 'Tách sự kiện, suy nghĩ và cảm xúc để nhìn lại mềm hơn.',
    prompt: 'Chuyện làm mình bị kẹt trong suy nghĩ là...',
  },
  {
    id: 'plan',
    icon: '🗓️',
    label: 'Kế hoạch 24h',
    desc: 'Chọn một bước rất nhỏ cho hôm nay hoặc ngày mai.',
    prompt: 'Trong 24 giờ tới mình cần xử lý...',
  },
  {
    id: 'prepare',
    icon: '💬',
    label: 'Nói với người thật',
    desc: 'Chuẩn bị câu mở lời với bạn bè, gia đình hoặc cố vấn.',
    prompt: 'Mình muốn nói với một người rằng...',
  },
];

const QUICK_PROMPTS = [
  'Mình đang căng và không biết bắt đầu từ đâu.',
  'Giúp mình nhìn chuyện này bớt cực đoan hơn.',
  'Mình cần một kế hoạch nhẹ cho tối nay.',
  'Mình nên mở lời với người khác như thế nào?',
];

const DISTRESS = [
  { value: 1, label: 'Nhẹ' },
  { value: 2, label: 'Hơi khó' },
  { value: 3, label: 'Đáng chú ý' },
  { value: 4, label: 'Nặng' },
  { value: 5, label: 'Không an toàn' },
];

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: '', time: '' };
  return {
    date: date.toLocaleDateString('vi-VN'),
    time: date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
  };
}

function buildJournalContext(moodLogs, allMoods) {
  return [...moodLogs]
    .filter(log => !log.excludeFromAI)
    .slice(0, 6)
    .map(log => {
      const mood = allMoods.find(item => item.id === log.mood);
      const dateTime = formatDateTime(log.date);
      return {
        date: dateTime.date,
        time: dateTime.time,
        moodLabel: mood?.label || 'Không rõ',
        metrics: log.metrics || null,
        note: log.note || '',
      };
    });
}

function safeMessage(text) {
  return String(text || '').replace(/\n{3,}/g, '\n\n').trim();
}

export default function Counseling() {
  const { moodLogs, MOODS, customMoods, userGoal, currentGoal } = useApp();
  const [mode, setMode] = useState('listen');
  const [distressLevel, setDistressLevel] = useState(3);
  const [useJournalContext, setUseJournalContext] = useState(true);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCrisis, setShowCrisis] = useState(false);
  const [provider, setProvider] = useState('');

  const allMoods = useMemo(
    () => [...MOODS, ...(customMoods || [])],
    [MOODS, customMoods]
  );

  const journalContext = useMemo(
    () => buildJournalContext(moodLogs, allMoods),
    [allMoods, moodLogs]
  );

  const selectedMode = MODES.find(item => item.id === mode) || MODES[0];
  const latestMood = journalContext[0];
  const aiGoal = currentGoal?.label || userGoal || '';

  const sendMessage = async (messageText = input) => {
    const text = safeMessage(messageText);
    if (!text || loading) return;

    const userMessage = { role: 'user', text, createdAt: Date.now() };
    const priorHistory = messages.slice(-8);
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setError('');

    if (detectDanger(text)) {
      setShowCrisis(true);
      setMessages(prev => [
        ...prev,
        {
          role: 'ai',
          text: 'Mình không muốn bạn phải ở một mình với cảm giác này. Hãy mở S.O.S, gọi một người tin cậy hoặc liên hệ hỗ trợ khẩn cấp ngay. Nếu bạn đang ở Mỹ, có thể gọi hoặc nhắn 988.',
          createdAt: Date.now(),
          local: true,
        },
      ]);
      return;
    }

    if (distressLevel >= 5) setShowCrisis(true);

    setLoading(true);
    try {
      const result = await counselMindBuddy({
        mode,
        distressLevel,
        message: text,
        history: priorHistory,
        journalContext: useJournalContext ? journalContext : [],
        userGoal: aiGoal,
      });
      setProvider(result.provider || '');
      setMessages(prev => [
        ...prev,
        {
          role: 'ai',
          text: result.content || 'Mình đang ở đây với bạn. Hãy thử viết lại điều đang nặng nhất trong một câu ngắn.',
          createdAt: Date.now(),
        },
      ]);
    } catch (err) {
      setError('Không gọi được AI tư vấn. Hãy thử lại sau hoặc mở S.O.S nếu bạn đang không an toàn.');
    } finally {
      setLoading(false);
    }
  };

  const clearSession = () => {
    setMessages([]);
    setError('');
    setProvider('');
    setShowCrisis(false);
  };

  return (
    <div className="counseling-page">
      {showCrisis && <CrisisPanel onDismiss={() => setShowCrisis(false)} />}

      <section className="counseling-hero">
        <div>
          <span className="counseling-kicker">Tư vấn tự hỗ trợ</span>
          <h1>Gỡ nhẹ điều đang ở trong đầu</h1>
          <p>MindBuddy có thể lắng nghe, giúp bạn nhìn lại suy nghĩ và chọn một bước nhỏ. Những dòng đã đánh dấu riêng tư sẽ không được gửi cho AI.</p>
        </div>
        <div className="counseling-status-card">
          <span>Gần nhất</span>
          <strong>{latestMood ? latestMood.moodLabel : 'Chưa có dữ liệu'}</strong>
          <small>{useJournalContext ? `${journalContext.length} check-in được phép dùng` : 'Không dùng nhật ký'}</small>
        </div>
      </section>

      <section className="counseling-layout">
        <aside className="counseling-sidebar card">
          <div className="counseling-block">
            <h2>Chế độ</h2>
            <div className="counseling-mode-list">
              {MODES.map(item => (
                <button
                  key={item.id}
                  type="button"
                  className={mode === item.id ? 'active' : ''}
                  onClick={() => setMode(item.id)}
                >
                  <span>{item.icon}</span>
                  <div>
                    <strong>{item.label}</strong>
                    <small>{item.desc}</small>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="counseling-block">
            <h2>Mức khó chịu</h2>
            <div className="distress-grid">
              {DISTRESS.map(item => (
                <button
                  key={item.value}
                  type="button"
                  className={distressLevel === item.value ? 'active' : ''}
                  onClick={() => setDistressLevel(item.value)}
                >
                  <strong>{item.value}</strong>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          <label className={`journal-context-toggle ${useJournalContext ? 'active' : ''}`}>
            <input
              type="checkbox"
              checked={useJournalContext}
              onChange={event => setUseJournalContext(event.target.checked)}
            />
            <span>
              <strong>Dùng nhật ký gần đây</strong>
              <small>Bỏ qua các dòng đã đặt không gửi AI.</small>
            </span>
          </label>

          <Link className="counseling-sos-link" to="/sos">Mở S.O.S</Link>
        </aside>

        <section className="counseling-chat card">
          <header className="counseling-chat-head">
            <div>
              <span>{selectedMode.icon} {selectedMode.label}</span>
              <h2>Phiên tư vấn</h2>
            </div>
            <button type="button" className="btn btn-secondary" onClick={clearSession} disabled={!messages.length && !error}>
              Xóa phiên
            </button>
          </header>

          <div className="counseling-thread" aria-live="polite">
            {messages.length === 0 ? (
              <div className="counseling-empty">
                <strong>Bắt đầu bằng một câu thật ngắn.</strong>
                <p>{selectedMode.prompt}</p>
                <div>
                  {QUICK_PROMPTS.map(prompt => (
                    <button key={prompt} type="button" onClick={() => setInput(prompt)}>
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map(message => (
                <article key={`${message.createdAt}-${message.role}-${message.text.slice(0, 12)}`} className={`counseling-message ${message.role}`}>
                  <span>{message.role === 'user' ? 'Bạn' : 'MindBuddy'}</span>
                  <p>{message.text}</p>
                </article>
              ))
            )}
            {loading && (
              <article className="counseling-message ai loading">
                <span>MindBuddy</span>
                <p>Đang suy nghĩ...</p>
              </article>
            )}
          </div>

          {error && <p className="counseling-error" role="alert">{error}</p>}

          <form
            className="counseling-composer"
            onSubmit={event => {
              event.preventDefault();
              sendMessage();
            }}
          >
            <textarea
              value={input}
              rows={4}
              placeholder={selectedMode.prompt}
              onChange={event => {
                setInput(event.target.value);
                if (detectDanger(event.target.value)) setShowCrisis(true);
              }}
              onKeyDown={event => {
                if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                  event.preventDefault();
                  sendMessage();
                }
              }}
            />
            <div>
              <small>{provider ? `AI: ${provider}` : 'Ctrl + Enter để gửi nhanh'}</small>
              <button className="btn btn-primary" type="submit" disabled={!input.trim() || loading}>
                {loading ? 'Đang gửi...' : 'Gửi'}
              </button>
            </div>
          </form>
        </section>
      </section>
    </div>
  );
}
