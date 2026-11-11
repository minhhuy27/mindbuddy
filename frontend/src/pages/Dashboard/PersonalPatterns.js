import React from 'react';
import { Link } from 'react-router-dom';

export default function PersonalPatterns({ personalPatterns }) {
  return (
    <section className="card personal-patterns-card dashboard-custom-block">
      <div className="section-heading-row">
        <div>
          <h3>Pattern cá nhân</h3>
          <p className="text-muted">MindBuddy nhắc lại những mẫu lặp nhỏ từ check-in, Pomodoro và chỉ số phụ.</p>
        </div>
        <Link to="/mood?tab=history" className="quick-link">Xem dữ liệu</Link>
      </div>

      {personalPatterns.length > 0 ? (
        <div className="personal-pattern-grid">
          {personalPatterns.map(pattern => (
            <Link key={pattern.id} to={pattern.to} className="personal-pattern-item">
              <span className="pattern-icon" aria-hidden="true">{pattern.icon}</span>
              <div>
                <strong>{pattern.title}</strong>
                <p>{pattern.text}</p>
                <small>{pattern.evidence}</small>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="personal-pattern-empty">
          <span aria-hidden="true">🧩</span>
          <div>
            <strong>Chưa đủ dữ liệu để nhận ra pattern rõ ràng</strong>
            <p>Ghi thêm nguyên nhân, stress/ngủ/focus và vài phiên Pomodoro để MindBuddy nhắc lại các mẫu lặp đáng chú ý.</p>
          </div>
          <Link to="/mood" className="btn btn-primary">Ghi thêm</Link>
        </div>
      )}
    </section>
  );
}
