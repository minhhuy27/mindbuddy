import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import './Layout.css';

const NAV = [
  { path: '/', icon: '🏠', label: 'Trang chủ' },
  { path: '/mood', icon: '💭', label: 'Cảm xúc' },
  { path: '/pomodoro', icon: '🍅', label: 'Pomodoro' },
  { path: '/community', icon: '🌍', label: 'Cộng đồng' },
  { path: '/garden', icon: '🌱', label: 'Vườn' },
  { path: '/sos', icon: '🆘', label: 'S.O.S' },
];

export default function Layout({ children }) {
  const { user, logout, darkMode, setDarkMode } = useApp();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="layout">
      <header className="header">
        <div className="header-inner">
          <div className="logo">🧠 <span>MindBuddy</span></div>
          <nav className="desktop-nav">
            {NAV.map(n => (
              <Link key={n.path} to={n.path}
                className={`nav-link ${location.pathname === n.path ? 'active' : ''} ${n.path === '/sos' ? 'sos-link' : ''}`}>
                {n.icon} {n.label}
              </Link>
            ))}
          </nav>
          <div className="header-right">
            <button className="dark-toggle" onClick={() => setDarkMode(d => !d)} title="Chế độ tối">
              {darkMode ? '☀️' : '🌙'}
            </button>
            <span className="user-name">👤 {user?.displayName || user?.email}</span>
            <button className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: 13 }} onClick={logout}>Đăng xuất</button>
            <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)}>☰</button>
          </div>
        </div>
      </header>

      {menuOpen && (
        <div className="mobile-nav">
          {NAV.map(n => (
            <Link key={n.path} to={n.path}
              className={`mobile-nav-link ${location.pathname === n.path ? 'active' : ''}`}
              onClick={() => setMenuOpen(false)}>
              {n.icon} {n.label}
            </Link>
          ))}
        </div>
      )}

      <main className="main-content">{children}</main>
    </div>
  );
}
