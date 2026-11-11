import React from 'react';
import useNetworkStatus from '../hooks/useNetworkStatus';

const styles = {
  banner: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10000,
    textAlign: 'center',
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: 600,
    transition: 'transform 0.3s ease, opacity 0.3s ease',
  },
  offline: {
    background: '#e17055',
    color: '#fff',
  },
  backOnline: {
    background: '#55efc4',
    color: '#1a1a2e',
  },
  hidden: {
    transform: 'translateY(-100%)',
    opacity: 0,
    pointerEvents: 'none',
  },
};

export default function OfflineBanner() {
  const { isOnline, wasOffline } = useNetworkStatus();

  const isVisible = !isOnline || (isOnline && wasOffline);

  return (
    <div
      style={{
        ...styles.banner,
        ...(!isOnline ? styles.offline : styles.backOnline),
        ...(!isVisible ? styles.hidden : {}),
      }}
      role="status"
      aria-live="polite"
    >
      {!isOnline
        ? '📡 Không có kết nối mạng — Dữ liệu đã lưu sẽ tự đồng bộ khi có mạng'
        : '✅ Đã kết nối lại!'}
    </div>
  );
}
