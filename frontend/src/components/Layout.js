import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import './Layout.css';

const PRIMARY_NAV = [
  { path: '/', icon: '🏠', label: 'Trang chủ' },
  { path: '/mood', icon: '💭', label: 'Cảm xúc' },
  { path: '/needs', icon: '🧭', label: 'Cần gì' },
  { path: '/pomodoro', icon: '🍅', label: 'Pomodoro' },
  { path: '/timeline', icon: '📜', label: 'Timeline' },
];

const MORE_NAV = [
  { path: '/counseling', icon: '🫶', label: 'Tư vấn' },
  { path: '/profile', icon: '👤', label: 'Hồ sơ' },
  { path: '/timeline?view=media', icon: '🖼️', label: 'Ký ức' },
  { path: '/storage', icon: '🧹', label: 'Dung lượng' },
  { path: '/timeline?view=review', icon: '🪞', label: 'Nhìn lại' },
  { path: '/timeline?view=positive', icon: '✨', label: 'Điều tốt' },
  { path: '/community', icon: '🌍', label: 'Góc riêng' },
  { path: '/garden', icon: '🌱', label: 'Vườn' },
];

const SOS_NAV = { path: '/sos', icon: '🆘', label: 'S.O.S' };

const MOBILE_NAV = [...PRIMARY_NAV, SOS_NAV];
const ALL_NAV = [...PRIMARY_NAV, ...MORE_NAV, SOS_NAV];
const TIMELINE_MORE_VIEWS = new Set(['media', 'review', 'positive']);
const SIDEBAR_COLLAPSED_KEY = 'mindbuddy_sidebar_collapsed';

function normalizeCommandText(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

function navPathname(path = '') {
  return String(path).split('?')[0] || '/';
}

function navView(path = '') {
  const query = String(path).split('?')[1] || '';
  return new URLSearchParams(query).get('view') || 'all';
}

function isNavActive(item, location) {
  const targetPath = navPathname(item.path);
  if (location.pathname !== targetPath) return false;
  if (targetPath === '/timeline') {
    const currentView = new URLSearchParams(location.search).get('view') || 'all';
    const targetView = navView(item.path);
    if (targetView === 'all') return currentView === 'all' || !TIMELINE_MORE_VIEWS.has(currentView);
    return currentView === targetView;
  }
  return true;
}

function navDescription(item) {
  const path = navPathname(item.path);
  const view = navView(item.path);
  if (path === '/timeline') {
    if (view === 'media') return 'Ảnh, video, âm thanh';
    if (view === 'review') return 'Tóm tắt ngày';
    if (view === 'positive') return 'Khoảnh khắc ổn';
    return 'Trục thời gian';
  }
  if (path === '/profile') return 'Mục tiêu và chỉ số';
  if (path === '/counseling') return 'Lắng nghe và gỡ rối';
  if (path === '/storage') return 'Dọn Firebase';
  if (path === '/community') return 'Xả lòng, thư tương lai';
  return 'Thói quen và huy hiệu';
}

function readStoredSidebarCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

function getBackupWeekKey(uid) {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), 0, 1);
  const dayOffset = Math.floor((now - firstDay) / 86400000);
  const week = Math.ceil((dayOffset + firstDay.getDay() + 1) / 7);
  return `mb_backup_reminder_${uid}_${now.getFullYear()}_${week}`;
}

export default function Layout({ children }) {
  const { user, logout, darkMode, setDarkMode, syncNotice, clearSyncNotice, getCurrentUserRawData } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readStoredSidebarCollapsed);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [commandActiveIndex, setCommandActiveIndex] = useState(0);
  const [backupReminderVisible, setBackupReminderVisible] = useState(false);
  const [backupDownloading, setBackupDownloading] = useState(false);
  const [backupReminderError, setBackupReminderError] = useState('');
  const commandInputRef = useRef(null);
  const moreActive = MORE_NAV.some(item => isNavActive(item, location));

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? '1' : '0');
    } catch {
      // Ignore storage failures; the sidebar still works for the current session.
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (!user?.uid) {
      setBackupReminderVisible(false);
      return;
    }
    const weekKey = getBackupWeekKey(user.uid);
    const completed = localStorage.getItem(`${weekKey}_done`);
    const snoozed = sessionStorage.getItem(`${weekKey}_snooze`);
    setBackupReminderVisible(new Date().getDay() === 0 && !completed && !snoozed);
  }, [user?.uid]);

  const closeMenus = useCallback(() => {
    setMenuOpen(false);
    setMoreOpen(false);
  }, []);

  const downloadBackupJson = useCallback(async () => {
    if (!user?.uid) return;
    setBackupDownloading(true);
    setBackupReminderError('');
    try {
      const payload = await getCurrentUserRawData();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const downloadedAt = new Date();
      const stamp = [
        downloadedAt.getFullYear(),
        String(downloadedAt.getMonth() + 1).padStart(2, '0'),
        String(downloadedAt.getDate()).padStart(2, '0'),
      ].join('-');
      link.href = url;
      link.download = `mindbuddy-backup-${stamp}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      localStorage.setItem(`${getBackupWeekKey(user.uid)}_done`, 'downloaded');
      setBackupReminderVisible(false);
    } catch (err) {
      setBackupReminderError(err.message || 'Không thể tải backup JSON.');
    } finally {
      setBackupDownloading(false);
    }
  }, [getCurrentUserRawData, user?.uid]);

  const snoozeBackupReminder = () => {
    if (user?.uid) sessionStorage.setItem(`${getBackupWeekKey(user.uid)}_snooze`, '1');
    setBackupReminderVisible(false);
  };

  const skipBackupReminderThisWeek = () => {
    if (user?.uid) localStorage.setItem(`${getBackupWeekKey(user.uid)}_done`, 'skipped');
    setBackupReminderVisible(false);
  };

  const closeCommandPalette = useCallback(() => {
    setCommandOpen(false);
    setCommandQuery('');
    setCommandActiveIndex(0);
  }, []);

  const openCommandPalette = useCallback(() => {
    setCommandOpen(true);
    setMenuOpen(false);
  }, []);

  const commandActions = useMemo(() => [
    {
      id: 'home',
      icon: '🏠',
      title: 'Trang chủ',
      subtitle: 'Quay về hôm nay của bạn',
      keywords: 'dashboard home hôm nay trang chu',
      to: '/',
    },
    {
      id: 'checkin',
      icon: '💭',
      title: 'Ghi cảm xúc',
      subtitle: 'Mở màn hình check-in đầy đủ',
      keywords: 'mood checkin cam xuc ghi nhat ky',
      to: '/mood',
    },
    {
      id: 'history',
      icon: '📒',
      title: 'Lịch sử cảm xúc',
      subtitle: 'Xem lại các check-in đã ghi',
      keywords: 'lich su history nhat ky mood',
      to: '/timeline?view=mood',
    },
    {
      id: 'timeline',
      icon: '📜',
      title: 'Timeline',
      subtitle: 'Trục thời gian mood, media, Pomodoro và nhìn lại',
      keywords: 'timeline truc thoi gian nhin lai media',
      to: '/timeline',
    },
    {
      id: 'needs',
      icon: '🧭',
      title: 'Mình đang cần gì?',
      subtitle: 'Chọn hướng xử lý theo trạng thái hiện tại',
      keywords: 'can gi nhu cau stress buon mat tap trung',
      to: '/needs',
    },
    {
      id: 'pomodoro',
      icon: '🍅',
      title: 'Pomodoro',
      subtitle: 'Bắt đầu một phiên tập trung',
      keywords: 'pomodoro tap trung hoc timer',
      to: '/pomodoro',
    },
    {
      id: 'daily-review',
      icon: '🪞',
      title: 'Nhìn lại ngày',
      subtitle: 'Tóm tắt ngày và bài học nhỏ',
      keywords: 'nhin lai ngay daily review tong ket',
      to: '/timeline?view=review',
    },
    {
      id: 'memories',
      icon: '🖼️',
      title: 'Ký ức',
      subtitle: 'Ảnh, video và âm thanh đã lưu',
      keywords: 'ky uc anh video am thanh media',
      to: '/timeline?view=media',
    },
    {
      id: 'good-moments',
      icon: '✨',
      title: 'Điều mình cần nhớ',
      subtitle: 'Note tích cực và check-in đã ghim',
      keywords: 'dieu tot khoanh khac ghim pin positive',
      to: '/timeline?view=positive',
    },
    {
      id: 'counseling',
      icon: '🫶',
      title: 'Tư vấn tâm lý',
      subtitle: 'Lắng nghe, gỡ rối hoặc lập kế hoạch nhẹ',
      keywords: 'tu van tam ly counseling lang nghe go roi',
      to: '/counseling',
    },
    {
      id: 'profile',
      icon: '👤',
      title: 'Hồ sơ cá nhân',
      subtitle: 'Mục tiêu, chỉ số và pattern của bạn',
      keywords: 'ho so profile muc tieu chi so pattern',
      to: '/profile',
    },
    {
      id: 'storage',
      icon: '🧹',
      title: 'Quản lý dung lượng',
      subtitle: 'Xem và dọn media trên Firebase',
      keywords: 'dung luong storage firebase don media',
      to: '/storage',
    },
    {
      id: 'garden',
      icon: '🌱',
      title: 'Vườn',
      subtitle: 'Thói quen và huy hiệu',
      keywords: 'vuon garden thoi quen huy hieu',
      to: '/garden',
    },
    {
      id: 'private-corner',
      icon: '🌍',
      title: 'Góc riêng',
      subtitle: 'Xả lòng, thư tương lai và buddy ảo',
      keywords: 'goc rieng cong dong thu tuong lai xa long',
      to: '/community',
    },
    {
      id: 'sos',
      icon: '🆘',
      title: 'S.O.S',
      subtitle: 'Mở bộ công cụ khẩn cấp',
      keywords: 'sos khan cap tho grounding',
      to: '/sos',
      danger: true,
    },
    {
      id: 'backup',
      icon: '💾',
      title: 'Tải backup JSON',
      subtitle: 'Lưu bản backup đầy đủ về máy',
      keywords: 'backup tai du lieu json export',
      run: downloadBackupJson,
    },
    {
      id: 'theme',
      icon: darkMode ? '☀️' : '🌙',
      title: darkMode ? 'Chuyển sang Light mode' : 'Chuyển sang Dark mode',
      subtitle: 'Đổi giao diện sáng/tối',
      keywords: 'theme light dark giao dien sang toi',
      run: () => setDarkMode(d => !d),
    },
    {
      id: 'logout',
      icon: '🚪',
      title: 'Đăng xuất',
      subtitle: user?.displayName || user?.email || 'Thoát khỏi tài khoản hiện tại',
      keywords: 'dang xuat logout tai khoan',
      run: logout,
    },
  ], [darkMode, downloadBackupJson, logout, setDarkMode, user?.displayName, user?.email]);

  const filteredCommands = useMemo(() => {
    const query = normalizeCommandText(commandQuery).trim();
    if (!query) return commandActions;
    const terms = query.split(/\s+/).filter(Boolean);
    return commandActions.filter(action => {
      const haystack = normalizeCommandText([
        action.title,
        action.subtitle,
        action.keywords,
      ].join(' '));
      return terms.every(term => haystack.includes(term));
    });
  }, [commandActions, commandQuery]);

  useEffect(() => {
    if (!commandOpen) return;
    const timer = window.setTimeout(() => commandInputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [commandOpen]);

  useEffect(() => {
    setCommandActiveIndex(0);
  }, [commandQuery]);

  useEffect(() => {
    if (commandActiveIndex >= filteredCommands.length) {
      setCommandActiveIndex(Math.max(0, filteredCommands.length - 1));
    }
  }, [commandActiveIndex, filteredCommands.length]);

  const runCommand = useCallback(async (command) => {
    if (!command) return;
    closeCommandPalette();
    closeMenus();
    if (command.to) {
      navigate(command.to);
      return;
    }
    if (command.run) {
      await command.run();
    }
  }, [closeCommandPalette, closeMenus, navigate]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      const opensPalette = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
      if (opensPalette) {
        event.preventDefault();
        setCommandOpen(open => !open);
        return;
      }
      if (!commandOpen) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closeCommandPalette();
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setCommandActiveIndex(index => filteredCommands.length ? Math.min(index + 1, filteredCommands.length - 1) : 0);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setCommandActiveIndex(index => Math.max(index - 1, 0));
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        runCommand(filteredCommands[commandActiveIndex]);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [commandActiveIndex, commandOpen, filteredCommands, runCommand]);

  return (
    <div className={`layout ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className="sidebar-nav" aria-label="Điều hướng chính">
        <div className="sidebar-top">
          <Link to="/" className="logo sidebar-logo" onClick={closeMenus} title="MindBuddy">🧠 <span>MindBuddy</span></Link>
          <button
            type="button"
            className="sidebar-collapse-toggle"
            onClick={() => setSidebarCollapsed(value => !value)}
            aria-label={sidebarCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
            title={sidebarCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
            aria-pressed={sidebarCollapsed}
          >
            <span aria-hidden="true">{sidebarCollapsed ? '›' : '‹'}</span>
          </button>
        </div>

        <button type="button" className="command-trigger sidebar-command-trigger" onClick={openCommandPalette} title="Tìm nhanh">
          <span aria-hidden="true">⌕</span>
          <strong>Tìm nhanh</strong>
          <kbd>Ctrl K</kbd>
        </button>

        <nav className="sidebar-main-nav">
          {PRIMARY_NAV.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-link sidebar-link ${isNavActive(item, location) ? 'active' : ''}`}
              onClick={closeMenus}
              title={item.label}
            >
              <span aria-hidden="true">{item.icon}</span>
              <strong>{item.label}</strong>
            </Link>
          ))}

          <Link
            to={SOS_NAV.path}
            className={`nav-link sidebar-link sos-link sidebar-sos ${isNavActive(SOS_NAV, location) ? 'active' : ''}`}
            onClick={closeMenus}
            title={SOS_NAV.label}
          >
            <span aria-hidden="true">{SOS_NAV.icon}</span>
            <strong>{SOS_NAV.label}</strong>
          </Link>

          <div className={`nav-more sidebar-more ${moreOpen ? 'open' : ''}`}>
            <button
              type="button"
              className={`nav-link sidebar-link nav-more-toggle ${moreActive ? 'active' : ''}`}
              onClick={() => setMoreOpen(open => !open)}
              aria-expanded={moreOpen}
              aria-haspopup="menu"
              title="Thêm"
            >
              <span aria-hidden="true">⋯</span>
              <strong>Thêm</strong>
            </button>
            {moreOpen && (
              <div className="nav-more-menu sidebar-more-menu" role="menu">
                {MORE_NAV.map(item => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`sidebar-more-item ${isNavActive(item, location) ? 'active' : ''}`}
                    onClick={closeMenus}
                    role="menuitem"
                  >
                    <span className="sidebar-more-icon" aria-hidden="true">{item.icon}</span>
                    <div>
                      <strong>{item.label}</strong>
                      <small>{navDescription(item)}</small>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-account-row">
            <button className="dark-toggle sidebar-dark-toggle" onClick={() => setDarkMode(d => !d)} title="Chế độ tối" aria-label={darkMode ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}>
              {darkMode ? '☀️' : '🌙'}
            </button>
            <div className="sidebar-user">
              <span aria-hidden="true">👤</span>
              <strong>{user?.displayName || user?.email}</strong>
            </div>
          </div>
          <button className="btn btn-secondary header-logout sidebar-logout" onClick={logout} title="Đăng xuất">
            <span className="sidebar-logout-icon" aria-hidden="true">🚪</span>
            <span className="sidebar-logout-text">Đăng xuất</span>
          </button>
        </div>
      </aside>

      <header className="header">
        <div className="header-inner">
          <Link to="/" className="logo" onClick={closeMenus}>🧠 <span>MindBuddy</span></Link>

          <nav className="desktop-nav" aria-label="Điều hướng chính">
            {PRIMARY_NAV.map(item => (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-link ${isNavActive(item, location) ? 'active' : ''}`}
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
                      className={`nav-more-item ${isNavActive(item, location) ? 'active' : ''}`}
                      onClick={closeMenus}
                      role="menuitem"
                    >
                      <span>{item.icon}</span>
                      <div>
                        <strong>{item.label}</strong>
                        <small>{navDescription(item)}</small>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <Link
              to={SOS_NAV.path}
              className={`nav-link sos-link ${isNavActive(SOS_NAV, location) ? 'active' : ''}`}
              onClick={closeMenus}
            >
              {SOS_NAV.icon} {SOS_NAV.label}
            </Link>
          </nav>

          <div className="header-right">
            <button type="button" className="command-icon-button" onClick={openCommandPalette} aria-label="Mở tìm nhanh">
              ⌕
            </button>
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
              className={`mobile-nav-link ${isNavActive(item, location) ? 'active' : ''} ${item.path === '/sos' ? 'sos-link' : ''}`}
              onClick={closeMenus}
            >
              {item.icon} {item.label}
            </Link>
          ))}
        </div>
      )}

      {syncNotice && (
        <div className={`sync-notice ${syncNotice.type || 'warning'}`} role="status">
          <div>
            <strong>{syncNotice.message}</strong>
            {syncNotice.detail && <small>{syncNotice.detail}</small>}
            {user?.uid && <small>UID đang đọc: {user.uid}</small>}
          </div>
          <button type="button" onClick={clearSyncNotice}>Đóng</button>
        </div>
      )}

      {backupReminderVisible && (
        <div className="backup-reminder" role="status">
          <div>
            <strong>Đến lịch tải backup MindBuddy về máy.</strong>
            <small>Hôm nay là Chủ nhật. Firestore đã có backup tự động hằng ngày, nhưng một file JSON trên máy vẫn là lớp an toàn nhất.</small>
            {backupReminderError && <small className="backup-reminder-error">{backupReminderError}</small>}
          </div>
          <div className="backup-reminder-actions">
            <button type="button" className="primary" onClick={downloadBackupJson} disabled={backupDownloading}>
              {backupDownloading ? 'Đang tải...' : 'Tải JSON'}
            </button>
            <button type="button" onClick={snoozeBackupReminder}>Để sau</button>
            <button type="button" onClick={skipBackupReminderThisWeek}>Bỏ qua tuần này</button>
          </div>
        </div>
      )}

      {commandOpen && (
        <div className="command-palette-backdrop" onMouseDown={closeCommandPalette}>
          <section
            className="command-palette"
            role="dialog"
            aria-modal="true"
            aria-label="Tìm nhanh MindBuddy"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="command-search-row">
              <span aria-hidden="true">⌕</span>
              <input
                ref={commandInputRef}
                value={commandQuery}
                onChange={(event) => setCommandQuery(event.target.value)}
                placeholder="Tìm trang, Pomodoro, backup..."
                aria-label="Tìm lệnh"
                aria-activedescendant={filteredCommands[commandActiveIndex]?.id ? `command-${filteredCommands[commandActiveIndex].id}` : undefined}
              />
              <kbd>Esc</kbd>
            </div>
            <div className="command-results" role="listbox" aria-label="Kết quả tìm nhanh">
              {filteredCommands.length ? filteredCommands.map((command, index) => (
                <button
                  key={command.id}
                  id={`command-${command.id}`}
                  type="button"
                  className={`command-result ${index === commandActiveIndex ? 'active' : ''} ${command.danger ? 'danger' : ''}`}
                  onMouseEnter={() => setCommandActiveIndex(index)}
                  onClick={() => runCommand(command)}
                  role="option"
                  aria-selected={index === commandActiveIndex}
                >
                  <span className="command-result-icon" aria-hidden="true">{command.icon}</span>
                  <span className="command-result-copy">
                    <strong>{command.title}</strong>
                    <small>{command.subtitle}</small>
                  </span>
                  <span className="command-result-hint">{command.to ? 'Mở' : 'Chạy'}</span>
                </button>
              )) : (
                <div className="command-empty">
                  <strong>Không tìm thấy lệnh phù hợp.</strong>
                  <small>Thử “cảm xúc”, “timeline”, “backup” hoặc “pomodoro”.</small>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      <nav className="bottom-nav" aria-label="Điều hướng nhanh">
        {MOBILE_NAV.map(item => (
          <Link
            key={item.path}
            to={item.path}
            className={`bottom-nav-link ${isNavActive(item, location) ? 'active' : ''} ${item.path === '/sos' ? 'sos-link' : ''}`}
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
