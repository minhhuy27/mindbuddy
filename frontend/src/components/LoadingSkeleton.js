import React from 'react';

const style = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
    gap: '16px',
    padding: '24px',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid var(--border, #e0e6ff)',
    borderTopColor: 'var(--primary, #6c63ff)',
    borderRadius: '50%',
    animation: 'mb-spin 0.8s linear infinite',
  },
  text: {
    fontSize: '15px',
    color: 'var(--text-muted, #636e72)',
    fontWeight: 500,
  },
};

export default function LoadingSkeleton() {
  return (
    <>
      <style>{`@keyframes mb-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={style.container}>
        <div style={style.spinner} />
        <span style={style.text}>Đang tải...</span>
      </div>
    </>
  );
}
