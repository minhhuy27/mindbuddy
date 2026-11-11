import React, { useEffect, useState } from 'react';
import { onSWUpdate, skipWaitingAndReload } from '../utils/notifications';

const styles = {
  toast: {
    position: 'fixed',
    bottom: 'calc(env(safe-area-inset-bottom, 0px) + 76px)',
    left: '50%',
    transform: 'translateX(-50%)',
    width: 'max-content',
    maxWidth: 'calc(100vw - 24px)',
    background: 'linear-gradient(135deg, #1a1a2e, #2d2a54)',
    color: '#fff',
    borderRadius: '14px',
    padding: '10px 12px 10px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    boxShadow: '0 10px 28px rgba(26, 26, 46, 0.32)',
    border: '1px solid rgba(162, 155, 254, 0.35)',
    zIndex: 10001,
    animation: 'mb-update-toast-up 0.3s ease-out',
  },
  message: {
    fontSize: '13px',
    fontWeight: 600,
    lineHeight: 1.35,
  },
  updateBtn: {
    padding: '7px 12px',
    background: '#6c63ff',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    fontWeight: 700,
    fontSize: '12px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  dismissBtn: {
    padding: '4px 6px',
    background: 'transparent',
    color: '#fff',
    border: 'none',
    fontSize: '15px',
    lineHeight: 1,
    cursor: 'pointer',
    opacity: 0.75,
    flexShrink: 0,
  },
};

export default function UpdateToast() {
  const [showUpdate, setShowUpdate] = useState(false);

  useEffect(() => {
    let active = true;
    onSWUpdate(() => {
      if (active) setShowUpdate(true);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!showUpdate) return null;

  return (
    <>
      <style>{`@keyframes mb-update-toast-up { from { transform: translate(-50%, 24px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }`}</style>
      <div style={styles.toast} role="status" aria-live="polite">
        <span style={styles.message}>Phiên bản mới! Nhấn để cập nhật</span>
        <button type="button" style={styles.updateBtn} onClick={skipWaitingAndReload}>
          Cập nhật
        </button>
        <button
          type="button"
          style={styles.dismissBtn}
          onClick={() => setShowUpdate(false)}
          aria-label="Đóng thông báo cập nhật"
        >
          ✕
        </button>
      </div>
    </>
  );
}
