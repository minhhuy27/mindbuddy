import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import './Layout.css';

const PRIMARY_NAV = [
  { path: '/', icon: '🏠', label: 'Trang chủ' },
  { path: '/mood', icon: '💭', label: 'Cảm xúc' },
  { path: '/needs', icon: '🧭', label: 'Cần gì' },
  { path: '/pomodoro', icon: '🍅', label: 'Pomodoro' },
];

const MORE_NAV = [
  { path: '/profile', icon: '👤', label: 'Hồ sơ' },
  { path: '/memories', icon: '🖼️', label: 'Ký ức' },
  { path: '/storage', icon: '🧹', label: 'Dung lượng' },
  { path: '/daily-review', icon: '🪞', label: 'Nhìn lại' },
  { path: '/good-moments', icon: '✨', label: 'Điều tốt' },
  { path: '/community', icon: '🌍', label: 'Góc riêng' },
  { path: '/garden', icon: '🌱', label: 'Vườn' },
];

const SOS_NAV = { path: '/sos', icon: '🆘', label: 'S.O.S' };
const MOBILE_NAV = [...PRIMARY_NAV, SOS_NAV];
const ALL_NAV = [...PRIMARY_NAV, ...MORE_NAV, SOS_NAV];

export default function Layout({ children }) {
  const { user, logout, darkMode, setDarkMode } = useApp();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = MORE_NAV.some(item => item.path === location.pathname);

  const closeMenus = () => {
    setMenuOpen(false);
    setMoreOpen(false);
  };

  return (
    <div className="layout">
      <header className="header">
        <div className="header-inner">
          <Link to="/" className="logo" onClick={closeMenus}>🧠 <span>MindBuddy</span></Link>

          <nav className="desktop-nav" aria-label="Điều hướng chính">
            {PRIMARY_NAV.map(item => (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
                onClick={closeMenus}
              >
                {item.icon} {item.label}
              </Link>
            ))}

            <div className="nav-more">
              <button
                type="button"
                className={`nav-link nav-more-toggle ${moreActive ? 'active' : ''}`}
                onClick={() => setMoreOpen(open => !open)}
                aria-expanded={moreOpen}
                aria-haspopup="menu"
              >
                ⋯ Thêm
              </button>
              {moreOpen && (
                <div className="nav-more-menu" role="menu">
                  {MORE_NAV.map(item => (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`nav-more-item ${location.pathname === item.path ? 'active' : ''}`}
                      onClick={closeMenus}
                      role="menuitem"
                    >
                      <span>{item.icon}</span>
                      <div>
                        <strong>{item.label}</strong>
                        <small>
                          {item.path === '/daily-review'
                            ? 'Tóm tắt ngày'
                            : item.path === '/profile'
                              ? 'Mục tiêu và chỉ số'
                            : item.path === '/memories'
                              ? 'Ảnh, video, âm thanh'
                              : item.path === '/storage'
                                ? 'Dọn Firebase'
                                : item.path === '/good-moments'
                                  ? 'Khoảnh khắc ổn'
                                  : item.path === '/community'
                                    ? 'Xả lòng, thư tương lai'
                                    : 'Thói quen và huy hiệu'}
                        </small>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <Link
              to={SOS_NAV.path}
              className={`nav-link sos-link ${location.pathname === SOS_NAV.path ? 'active' : ''}`}
              onClick={closeMenus}
            >
              {SOS_NAV.icon} {SOS_NAV.label}
            </Link>
          </nav>

          <div className="header-right">
            <button className="dark-toggle" onClick={() => setDarkMode(d => !d)} title="Chế độ tối" aria-label={darkMode ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}>
              {darkMode ? '☀️' : '🌙'}
            </button>
            <span className="user-name">👤 {user?.displayName || user?.email}</span>
            <button className="btn btn-secondary header-logout" onClick={logout}>Đăng xuất</button>
            <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Mở menu điều hướng" aria-expanded={menuOpen}>☰</button>
          </div>
        </div>
      </header>

      {menuOpen && (
        <div className="mobile-nav">
          {ALL_NAV.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`mobile-nav-link ${location.pathname === item.path ? 'active' : ''} ${item.path === '/sos' ? 'sos-link' : ''}`}
              onClick={closeMenus}
            >
              {item.icon} {item.label}
            </Link>
          ))}
        </div>
      )}

      <nav className="bottom-nav" aria-label="Điều hướng nhanh">
        {MOBILE_NAV.map(item => (
          <Link
            key={item.path}
            to={item.path}
            className={`bottom-nav-link ${location.pathname === item.path ? 'active' : ''} ${item.path === '/sos' ? 'sos-link' : ''}`}
          >
            <span className="bottom-nav-icon" aria-hidden="true">{item.icon}</span>
            <span className="bottom-nav-label">{item.label}</span>
          </Link>
        ))}
      </nav>

      <main className="main-content">{children}</main>
    </div>
  );
}
