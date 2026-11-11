import React from 'react';
import { Link } from 'react-router-dom';

export default function QuickActions({ latestTodayMood, todayReviewPath }) {
  const actions = [
    { to: '/mood', icon: '💭', label: latestTodayMood ? 'Ghi thêm cảm xúc' : 'Ghi cảm xúc', color: '#a29bfe', primary: true },
    { to: '/needs', icon: '🧭', label: 'Mình cần gì?', color: '#00cec9' },
    { to: todayReviewPath, icon: '🪞', label: 'Nhìn lại ngày', color: '#00cec9' },
    { to: '/timeline?view=positive', icon: '✨', label: 'Khoảnh khắc tốt', color: '#fdcb6e' },
    { to: '/pomodoro', icon: '🍅', label: 'Tập trung', color: '#fd79a8' },
    { to: '/garden', icon: '🌱', label: 'Chăm vườn', color: '#55efc4' },
    { to: '/community', icon: '🌍', label: 'Góc chia sẻ', color: '#74b9ff' },
    { to: '/sos', icon: '🆘', label: 'S.O.S', color: '#e17055' },
  ];

  return (
    <section className="quick-actions today-tools dashboard-custom-block">
      <div className="section-heading-row mb-3">
        <div>
          <h3>Công cụ cho hôm nay</h3>
          <p className="text-muted">Các lối tắt bạn có thể dùng ngay trong ngày.</p>
        </div>
      </div>
      <div className="actions-grid">
        {actions.map(a => (
          <Link key={a.to} to={a.to} className={`action-card ${a.primary ? 'primary-action' : ''}`} style={{ '--action-color': a.color }} aria-label={a.label}>
            <span className="action-icon" aria-hidden="true">{a.icon}</span>
            <span className="action-label">{a.label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
