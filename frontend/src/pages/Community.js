import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import './Community.css';

export default function Community() {
  const { confessions, addConfession, hugConfession, user } = useApp();
  const [text, setText] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [view, setView] = useState('map'); // map | list
  const [buddy, setBuddy] = useState(() => {
    try {
      const saved = localStorage.getItem('mb_buddy');
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      // Xóa buddy nếu đã quá 21 ngày
      const startDate = new Date(parsed.startDate);
      const daysPassed = Math.floor((Date.now() - startDate) / (1000 * 60 * 60 * 24));
      if (daysPassed >= 21) {
        localStorage.removeItem('mb_buddy');
        return null;
      }
      return { ...parsed, daysPassed };
    } catch {
      return null;
    }
  });

  const BUDDIES = ['Minh Anh', 'Thanh Hà', 'Quốc Bảo', 'Thu Trang', 'Hoàng Nam', 'Linh Chi'];
  const CHALLENGES = ['Ngủ trước 11h tối', 'Uống đủ 2L nước', 'Học 2 tiếng không điện thoại', 'Đi bộ 15 phút', 'Viết nhật ký'];

  const handlePost = () => {
    if (text.trim()) {
      addConfession(text.trim());
      setText('');
      setShowForm(false);
    }
  };

  const findBuddy = () => {
    const b = BUDDIES[Math.floor(Math.random() * BUDDIES.length)];
    const c = CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)];
    const newBuddy = { name: b, challenge: c, startDate: new Date().toISOString(), daysPassed: 0 };
    setBuddy(newBuddy);
    localStorage.setItem('mb_buddy', JSON.stringify(newBuddy));
  };

  const clearBuddy = () => {
    setBuddy(null);
    localStorage.removeItem('mb_buddy');
  };

  return (
    <div className="community-page">
      <h2 className="mb-4">🌍 Cộng đồng chữa lành</h2>

      <div className="community-layout">
        <div className="main-section">
          <div className="view-tabs card" style={{ padding: '8px', display: 'flex', gap: '8px', marginBottom: 16 }}>
            <button className={`view-tab ${view === 'map' ? 'active' : ''}`} onClick={() => setView('map')}>
              🗺️ Confession Map
            </button>
            <button className={`view-tab ${view === 'list' ? 'active' : ''}`} onClick={() => setView('list')}>
              📋 Danh sách
            </button>
          </div>

          {view === 'map' ? (
            <div className="card confession-map">
              <div className="map-area">
                {confessions.map(c => (
                  <div key={c.id} className="map-pin" style={{ left: `${c.x}%`, top: `${c.y}%` }}>
                    <div className="pin-bubble">
                      <p>{c.text.length > 60 ? c.text.slice(0, 60) + '...' : c.text}</p>
                      <div className="pin-actions">
                        <button className="hug-btn" onClick={() => hugConfession(c.id)}>
                          🤗 {c.hugs}
                        </button>
                        <span className="pin-time">{c.time}</span>
                      </div>
                    </div>
                    <div className="pin-dot" />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="confession-list">
              {confessions.map(c => (
                <div key={c.id} className="card confession-card">
                  <p className="confession-text">{c.text}</p>
                  <div className="confession-footer">
                    <span className="text-muted">{c.time}</span>
                    <button className="hug-btn-lg" onClick={() => hugConfession(c.id)}>
                      🤗 Gửi cái ôm ({c.hugs})
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button className="btn btn-primary mt-3" onClick={() => setShowForm(!showForm)}>
            ✍️ Chia sẻ tâm tư ẩn danh
          </button>

          {showForm && (
            <div className="card mt-3">
              <h3 className="mb-2">Chia sẻ ẩn danh</h3>
              <p className="text-muted mb-3">Không ai biết đây là bạn. Hãy nói ra điều bạn đang cảm thấy.</p>
              <textarea value={text} onChange={e => setText(e.target.value)}
                placeholder="Hôm nay tôi cảm thấy..." rows={4} />
              <div className="flex gap-2 mt-3">
                <button className="btn btn-primary" onClick={handlePost}>Đăng ẩn danh 🌟</button>
                <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Hủy</button>
              </div>
            </div>
          )}
        </div>

        <div className="side-section">
          <div className="card buddy-card">
            <h3 className="mb-2">👥 Buddy System</h3>
            <p className="text-muted mb-3">Ghép cặp ngẫu nhiên để cùng thực hiện thử thách 21 ngày sống khỏe.</p>
            {buddy ? (
              <div className="buddy-result">
                <div className="buddy-avatar">👤</div>
                <div className="buddy-name">{buddy.name}</div>
                <div className="buddy-challenge">
                  <span className="badge" style={{ background: '#ede9ff', color: '#6c63ff' }}>Thử thách</span>
                  <p className="mt-2">{buddy.challenge}</p>
                </div>
                <div className="buddy-progress mt-3">
                  <div className="flex justify-between" style={{ fontSize: 12, marginBottom: 4 }}>
                    <span>Ngày {buddy.daysPassed + 1}/21</span>
                    <span>{21 - buddy.daysPassed - 1} ngày còn lại</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${((buddy.daysPassed + 1) / 21) * 100}%` }} />
                  </div>
                </div>
                <button className="btn btn-secondary w-full mt-3" onClick={clearBuddy}>
                  Tìm buddy khác
                </button>
              </div>
            ) : (
              <button className="btn btn-primary w-full" onClick={findBuddy}>
                🎲 Tìm Buddy ngẫu nhiên
              </button>
            )}
          </div>

          <div className="card">
            <h3 className="mb-3">🏆 Thử thách 21 ngày</h3>
            {[
              { icon: '😴', name: 'Ngủ đủ giấc', progress: 14, total: 21 },
              { icon: '💧', name: 'Uống đủ nước', progress: 7, total: 21 },
              { icon: '📚', name: 'Học tập trung', progress: 10, total: 21 },
            ].map((ch, i) => (
              <div key={i} className="challenge-item">
                <div className="flex items-center gap-2 mb-2">
                  <span>{ch.icon}</span>
                  <span className="challenge-name">{ch.name}</span>
                  <span className="text-muted" style={{ marginLeft: 'auto' }}>{ch.progress}/{ch.total}</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${(ch.progress / ch.total) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
