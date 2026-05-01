import React from 'react';
import { useApp } from '../context/AppContext';
import './Garden.css';

const HABITS = [
  { id: 'sleep', icon: '😴', label: 'Ngủ trước 11h', points: 15 },
  { id: 'water', icon: '💧', label: 'Uống đủ nước', points: 10 },
  { id: 'exercise', icon: '🏃', label: 'Vận động 15 phút', points: 15 },
  { id: 'journal', icon: '📝', label: 'Viết nhật ký', points: 10 },
  { id: 'meditate', icon: '🧘', label: 'Thiền 5 phút', points: 20 },
  { id: 'nophone', icon: '📵', label: 'Không điện thoại 1h', points: 15 },
];

export default function Garden() {
  const { gardenLevel, growGarden, earnedBadges, BADGES, checkBadge, incrementMeditate } = useApp();
  const [checkedToday, setCheckedToday] = React.useState(() => {
    const saved = localStorage.getItem('mb_habits_today');
    const date = localStorage.getItem('mb_habits_date');
    if (date === new Date().toDateString()) return JSON.parse(saved || '[]');
    return [];
  });

  const doHabit = (habit) => {
    if (checkedToday.includes(habit.id)) return;
    const next = [...checkedToday, habit.id];
    setCheckedToday(next);
    localStorage.setItem('mb_habits_today', JSON.stringify(next));
    localStorage.setItem('mb_habits_date', new Date().toDateString());
    growGarden(habit.points);
    if (habit.id === 'meditate') incrementMeditate();
  };

  const treeStage = gardenLevel < 10 ? 0 : gardenLevel < 30 ? 1 : gardenLevel < 60 ? 2 : gardenLevel < 90 ? 3 : 4;
  const TREES = ['🌱', '🌿', '🌳', '🌲', '🌸'];
  const TREE_LABELS = ['Hạt giống', 'Cây non', 'Cây trưởng thành', 'Cây lớn', 'Cây nở hoa'];

  return (
    <div className="garden-page">
      <h2 className="mb-4">🌱 Vườn tâm hồn</h2>

      <div className="garden-layout">
        <div className="card garden-main">
          <div className="garden-scene">
            <div className="sky">
              {gardenLevel > 50 && <span className="cloud">☁️</span>}
              {gardenLevel > 70 && <span className="sun">☀️</span>}
              {gardenLevel > 30 && <span className="bird">🦋</span>}
            </div>
            <div className="tree-display">
              <div className="tree-emoji">{TREES[treeStage]}</div>
              <div className="tree-label">{TREE_LABELS[treeStage]}</div>
            </div>
            <div className="ground">
              {gardenLevel > 20 && <span>🌼</span>}
              {gardenLevel > 40 && <span>🌻</span>}
              {gardenLevel > 60 && <span>🌺</span>}
              {gardenLevel > 80 && <span>🌹</span>}
            </div>
          </div>

          <div className="health-bar-section">
            <div className="flex justify-between items-center mb-2">
              <span className="health-label">Sức khỏe vườn</span>
              <span className="health-value">{gardenLevel}%</span>
            </div>
            <div className="health-bar">
              <div className="health-fill" style={{ width: `${gardenLevel}%` }} />
            </div>
            <p className="text-muted mt-2" style={{ fontSize: 13 }}>
              {gardenLevel < 30 ? '🥺 Cây đang cần được chăm sóc. Hãy thực hiện thói quen tốt!' :
               gardenLevel < 70 ? '😊 Cây đang phát triển tốt. Tiếp tục duy trì nhé!' :
               '🎉 Vườn của bạn đang rất tươi tốt! Tuyệt vời!'}
            </p>
          </div>
        </div>

        <div className="side-panel">
          <div className="card">
            <h3 className="mb-3">✅ Thói quen hôm nay</h3>
            <div className="habits-list">
              {HABITS.map(h => (
                <button key={h.id}
                  className={`habit-item ${checkedToday.includes(h.id) ? 'done' : ''}`}
                  onClick={() => doHabit(h)}
                  disabled={checkedToday.includes(h.id)}>
                  <span className="habit-icon">{h.icon}</span>
                  <span className="habit-label">{h.label}</span>
                  <span className="habit-points">+{h.points}</span>
                  {checkedToday.includes(h.id) && <span className="habit-check">✓</span>}
                </button>
              ))}
            </div>
            <p className="text-muted mt-3" style={{ fontSize: 12 }}>
              Đã hoàn thành: {checkedToday.length}/{HABITS.length} thói quen hôm nay
            </p>
          </div>

          <div className="card">
            <h3 className="mb-3">🏅 Bộ sưu tập huy hiệu</h3>
            <div className="badges-collection">
              {BADGES.map(b => (
                <div key={b.id} className={`badge-full ${earnedBadges.includes(b.id) ? 'earned' : 'locked'}`}>
                  <span className="badge-big-icon">{earnedBadges.includes(b.id) ? b.icon : '🔒'}</span>
                  <div>
                    <div className="badge-full-name">{b.name}</div>
                    <div className="badge-full-desc">{b.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
