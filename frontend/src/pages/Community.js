import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import './Community.css';

const RELEASE_PROMPTS = [
  'Điều mình đang giữ trong lòng là...',
  'Nếu được nói thật mà không cần giải thích, mình muốn nói...',
  'Một áp lực mình muốn đặt xuống hôm nay là...',
  'Mình mong ai đó hiểu rằng...',
];

const FUTURE_DELAYS = [
  { days: 7, label: '1 tuần' },
  { days: 30, label: '1 tháng' },
  { days: 90, label: '3 tháng' },
];

const BUDDY_CHALLENGES = [
  { id: 'sleep', title: 'Ngủ tử tế hơn', daily: 'Tắt màn hình sớm hơn 20 phút và ghi lại chất lượng ngủ.' },
  { id: 'water', title: 'Chăm cơ thể nhỏ nhẹ', daily: 'Uống một ly nước và đứng dậy giãn cơ 2 phút.' },
  { id: 'focus', title: 'Tập trung không tự ép', daily: 'Làm một phiên Pomodoro hoặc 15 phút học không điện thoại.' },
  { id: 'journal', title: 'Viết để nhẹ lòng', daily: 'Ghi 3 dòng: điều nặng, điều ổn, điều tiếp theo.' },
  { id: 'walk', title: 'Ra khỏi vòng lặp', daily: 'Đi bộ 10 phút hoặc ra ngoài hít thở không cầm điện thoại.' },
];

function userKey(user, name) {
  return `mb_${name}_${user?.uid || user?.email || 'guest'}`;
}

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('vi-VN');
}

function daysBetween(start, end = new Date()) {
  const startDate = new Date(start);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(end);
  endDate.setHours(0, 0, 0, 0);
  return Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24));
}

export default function Community() {
  const { confessions, addConfession, hugConfession, user } = useApp();
  const [text, setText] = useState('');
  const [promptIndex, setPromptIndex] = useState(0);
  const [letterText, setLetterText] = useState('');
  const [letterDelay, setLetterDelay] = useState(30);

  const lettersKey = useMemo(() => userKey(user, 'future_letters'), [user]);
  const buddyKey = useMemo(() => userKey(user, 'virtual_buddy'), [user]);

  const [letters, setLetters] = useState(() => readJSON(lettersKey, []));
  const [buddy, setBuddy] = useState(() => {
    const saved = readJSON(buddyKey, null);
    if (!saved) return null;
    const daysPassed = daysBetween(saved.startDate);
    if (daysPassed >= 21) {
      localStorage.removeItem(buddyKey);
      return null;
    }
    return { ...saved, daysPassed };
  });

  const privateReleases = (confessions || []).filter(item => item.id > 3 || item.createdAt || item.time === 'Vừa xong');
  const todayKey = new Date().toDateString();
  const todayDone = !!buddy?.checkins?.[todayKey];
  const completedDays = buddy ? Object.keys(buddy.checkins || {}).length : 0;
  const activeChallenge = buddy ? BUDDY_CHALLENGES.find(c => c.id === buddy.challengeId) : null;
  const openLetters = letters.filter(letter => new Date(letter.openAt) <= new Date());
  const lockedLetters = letters.filter(letter => new Date(letter.openAt) > new Date());

  const saveLetters = (next) => {
    setLetters(next);
    localStorage.setItem(lettersKey, JSON.stringify(next));
  };

  const saveBuddy = (next) => {
    setBuddy(next);
    if (next) localStorage.setItem(buddyKey, JSON.stringify(next));
    else localStorage.removeItem(buddyKey);
  };

  const handleRelease = () => {
    const value = text.trim();
    if (!value) return;
    addConfession(value);
    setText('');
    setPromptIndex((index) => (index + 1) % RELEASE_PROMPTS.length);
  };

  const createLetter = () => {
    const value = letterText.trim();
    if (!value) return;
    const openAt = new Date();
    openAt.setDate(openAt.getDate() + Number(letterDelay));
    const next = [{
      id: Date.now(),
      text: value,
      createdAt: new Date().toISOString(),
      openAt: openAt.toISOString(),
    }, ...letters];
    saveLetters(next);
    setLetterText('');
  };

  const deleteLetter = (id) => {
    saveLetters(letters.filter(letter => letter.id !== id));
  };

  const startBuddy = () => {
    const challenge = BUDDY_CHALLENGES[Math.floor(Math.random() * BUDDY_CHALLENGES.length)];
    saveBuddy({
      challengeId: challenge.id,
      startDate: new Date().toISOString(),
      checkins: {},
      daysPassed: 0,
    });
  };

  const completeBuddyToday = () => {
    if (!buddy || todayDone) return;
    const next = {
      ...buddy,
      checkins: { ...(buddy.checkins || {}), [todayKey]: new Date().toISOString() },
    };
    saveBuddy(next);
  };

  const resetBuddy = () => saveBuddy(null);

  return (
    <div className="community-page">
      <div className="community-hero card">
        <div>
          <span className="community-kicker">Không gian riêng</span>
          <h2>Góc nhẹ lòng</h2>
          <p className="text-muted">Một nơi để xả ra, gửi lời cho chính mình và đi cùng một buddy ảo trong 21 ngày.</p>
        </div>
      </div>

      <div className="personal-space-layout">
        <section className="main-section">
          <div className="card release-card">
            <div className="section-heading">
              <div>
                <h3>Góc xả lòng</h3>
                <p className="text-muted">Chỉ dành cho bạn. Viết ra để giảm tải, không cần làm hay giải thích gì thêm.</p>
              </div>
              <button className="prompt-shuffle" onClick={() => setPromptIndex((promptIndex + 1) % RELEASE_PROMPTS.length)}>
                Gợi ý khác
              </button>
            </div>
            <label className="release-prompt" htmlFor="release-text">{RELEASE_PROMPTS[promptIndex]}</label>
            <textarea
              id="release-text"
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Viết vài dòng ở đây..."
              rows={5}
            />
            <div className="release-actions">
              <button className="btn btn-primary" onClick={handleRelease} disabled={!text.trim()}>
                Lưu vào góc xả lòng
              </button>
              <span>{text.length}/1000</span>
            </div>
          </div>

          <div className="release-list">
            {privateReleases.length === 0 ? (
              <div className="card empty-personal-card">
                <div aria-hidden="true">📝</div>
                <h3>Chưa có dòng xả lòng nào</h3>
                <p className="text-muted">Khi có điều khó gọi tên, bạn có thể để nó ở đây trước.</p>
              </div>
            ) : (
              privateReleases.map(entry => (
                <article key={entry.id} className="card release-entry">
                  <p>{entry.text}</p>
                  <div className="release-entry-footer">
                    <span className="text-muted">{entry.time || 'Đã lưu'}</span>
                    <button onClick={() => hugConfession(entry.id)}>
                      Tự ôm mình ({entry.hugs || 0})
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <aside className="side-section">
          <div className="card future-letter-card">
            <h3>Thư gửi mình của tương lai</h3>
            <p className="text-muted">Viết cho một phiên bản của bạn sau này, khi mọi thứ đã đổi khác một chút.</p>
            <textarea
              value={letterText}
              onChange={e => setLetterText(e.target.value)}
              placeholder="Gửi mình của tương lai..."
              rows={4}
            />
            <div className="letter-delay-row">
              {FUTURE_DELAYS.map(delay => (
                <button
                  key={delay.days}
                  className={Number(letterDelay) === delay.days ? 'active' : ''}
                  onClick={() => setLetterDelay(delay.days)}
                >
                  {delay.label}
                </button>
              ))}
            </div>
            <button className="btn btn-primary w-full" onClick={createLetter} disabled={!letterText.trim()}>
              Gửi tới tương lai
            </button>

            <div className="letters-summary">
              <span>{openLetters.length} thư có thể mở</span>
              <span>{lockedLetters.length} thư đang chờ</span>
            </div>
          </div>

          <div className="card letters-list-card">
            <h3>Hộp thư tương lai</h3>
            {letters.length === 0 ? (
              <p className="text-muted">Chưa có thư nào. Một lá thư ngắn cũng đủ.</p>
            ) : (
              <div className="letters-list">
                {letters.map(letter => {
                  const isOpen = new Date(letter.openAt) <= new Date();
                  return (
                    <div key={letter.id} className={`letter-item ${isOpen ? 'open' : 'locked'}`}>
                      <div>
                        <strong>{isOpen ? 'Có thể mở' : `Mở ngày ${formatDate(letter.openAt)}`}</strong>
                        <span>Viết ngày {formatDate(letter.createdAt)}</span>
                      </div>
                      {isOpen ? <p>{letter.text}</p> : <p>Thư đang được giữ lại cho bạn của tương lai.</p>}
                      <button onClick={() => deleteLetter(letter.id)}>Xóa</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="card buddy-card">
            <h3>Buddy ảo 21 ngày</h3>
            <p className="text-muted">Không phải người lạ. Chỉ là một lời nhắc ổn định để bạn quay lại với một thói quen nhỏ.</p>
            {buddy && activeChallenge ? (
              <div className="buddy-result">
                <div className="buddy-avatar">🧭</div>
                <div className="buddy-name">{activeChallenge.title}</div>
                <div className="buddy-challenge">
                  <span className="badge" style={{ background: '#ede9ff', color: '#6c63ff' }}>Hôm nay</span>
                  <p className="mt-2">{activeChallenge.daily}</p>
                </div>
                <div className="buddy-progress mt-3">
                  <div className="flex justify-between" style={{ fontSize: 12, marginBottom: 4 }}>
                    <span>Ngày {buddy.daysPassed + 1}/21</span>
                    <span>{completedDays} ngày đã đánh dấu</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${Math.min(100, ((buddy.daysPassed + 1) / 21) * 100)}%` }} />
                  </div>
                </div>
                <button className="btn btn-primary w-full mt-3" onClick={completeBuddyToday} disabled={todayDone}>
                  {todayDone ? 'Đã xong hôm nay' : 'Đánh dấu hôm nay'}
                </button>
                <button className="btn btn-secondary w-full mt-2" onClick={resetBuddy}>
                  Chọn thử thách khác
                </button>
              </div>
            ) : (
              <button className="btn btn-primary w-full" onClick={startBuddy}>
                Bắt đầu buddy ảo
              </button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
