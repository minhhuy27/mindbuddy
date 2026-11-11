import React from 'react';
import useInstallPrompt from '../hooks/useInstallPrompt';

const styles = {
  banner: {
    position: 'fixed',
    bottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)',
    left: '12px',
    right: '12px',
    background: 'linear-gradient(135deg, #6c63ff, #a29bfe)',
    color: '#fff',
    borderRadius: '16px',
    padding: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    boxShadow: '0 8px 32px rgba(108,99,255,0.3)',
    zIndex: 9999,
    animation: 'mb-slide-up 0.4s ease-out',
  },
  icon: { fontSize: '32px', flexShrink: 0 },
  content: { flex: 1, minWidth: 0 },
  title: { fontWeight: 700, fontSize: '15px', marginBottom: '2px' },
  subtitle: { fontSize: '13px', opacity: 0.9 },
  actions: { display: 'flex', gap: '8px', flexShrink: 0 },
  installBtn: {
    padding: '8px 16px',
    background: '#fff',
    color: '#6c63ff',
    border: 'none',
    borderRadius: '10px',
    fontWeight: 700,
    fontSize: '13px',
    cursor: 'pointer',
  },
  dismissBtn: {
    padding: '8px',
    background: 'transparent',
    color: '#fff',
    border: 'none',
    fontSize: '18px',
    cursor: 'pointer',
    opacity: 0.7,
  },
};

export default function InstallBanner() {
  const { isInstallable, promptInstall, dismissBanner } = useInstallPrompt();

  if (!isInstallable) return null;

  return (
    <>
      <style>{`@keyframes mb-slide-up { from { transform: translateY(100px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
      <div style={styles.banner}>
        <span style={styles.icon}>📲</span>
        <div style={styles.content}>
          <div style={styles.title}>Cài MindBuddy lên điện thoại</div>
          <div style={styles.subtitle}>Trải nghiệm mượt hơn, mở nhanh hơn</div>
        </div>
        <div style={styles.actions}>
          <button style={styles.installBtn} onClick={promptInstall}>Cài đặt</button>
          <button style={styles.dismissBtn} onClick={dismissBanner}>✕</button>
        </div>
      </div>
    </>
  );
}
