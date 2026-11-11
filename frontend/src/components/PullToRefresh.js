import React, { useState, useRef, useEffect } from 'react';
import './PullToRefresh.css';

const DAMPING = 0.45;
const MAX_PULL = 96;
const THRESHOLD = 64;
const REFRESH_HOLD_HEIGHT = 52;

function isInteractiveTarget(target) {
  if (!target || typeof target.closest !== 'function') return false;
  return Boolean(target.closest('input, textarea, select, [role="slider"]'));
}

export default function PullToRefresh({ onRefresh, children }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const startYRef = useRef(null);
  const pullDistanceRef = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const updatePull = (nextDistance) => {
    pullDistanceRef.current = nextDistance;
    setPullDistance(nextDistance);
  };

  const resetGesture = () => {
    startYRef.current = null;
    setIsDragging(false);
    updatePull(0);
  };

  const handleTouchStart = (e) => {
    if (refreshing) return;
    if (typeof window === 'undefined' || window.scrollY > 2) {
      startYRef.current = null;
      return;
    }
    if (e.touches.length !== 1 || isInteractiveTarget(e.target)) {
      startYRef.current = null;
      return;
    }
    startYRef.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (refreshing || startYRef.current === null) return;
    if (e.touches.length !== 1) {
      resetGesture();
      return;
    }
    if (typeof window !== 'undefined' && window.scrollY > 2 && pullDistanceRef.current === 0) {
      startYRef.current = null;
      setIsDragging(false);
      return;
    }

    const deltaY = e.touches[0].clientY - startYRef.current;
    if (deltaY <= 0) {
      if (pullDistanceRef.current !== 0) {
        updatePull(0);
      }
      return;
    }

    const damped = Math.min(MAX_PULL, deltaY * DAMPING);
    updatePull(damped > 4 ? damped : 0);
  };

  const handleTouchEnd = async () => {
    if (refreshing || startYRef.current === null) {
      startYRef.current = null;
      setIsDragging(false);
      return;
    }

    const finalPull = pullDistanceRef.current;
    startYRef.current = null;
    setIsDragging(false);

    if (finalPull >= THRESHOLD) {
      setRefreshing(true);
      updatePull(REFRESH_HOLD_HEIGHT);
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(10);
      }
      try {
        await onRefresh?.();
      } finally {
        if (isMountedRef.current) {
          setRefreshing(false);
          updatePull(0);
        }
      }
      return;
    }

    updatePull(0);
  };

  const readyToRefresh = pullDistance >= THRESHOLD;
  const indicatorHeight = refreshing ? REFRESH_HOLD_HEIGHT : pullDistance;
  const indicatorVisible = refreshing || pullDistance > 0;
  const statusText = refreshing
    ? 'Đang đồng bộ...'
    : readyToRefresh
      ? 'Thả ra để làm mới'
      : 'Kéo xuống để làm mới';

  return (
    <div
      className={`pull-to-refresh ${isDragging ? 'is-dragging' : ''} ${refreshing ? 'is-refreshing' : ''}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={resetGesture}
    >
      <div
        className={`ptr-indicator ${indicatorVisible ? 'visible' : ''} ${readyToRefresh ? 'ready' : ''}`}
        style={{
          height: `${indicatorHeight}px`,
          opacity: refreshing ? 1 : Math.min(1, pullDistance / 36),
        }}
        aria-live="polite"
      >
        <div className="ptr-pill">
          {refreshing ? (
            <span className="ptr-spinner" aria-hidden="true" />
          ) : (
            <span className={`ptr-arrow ${readyToRefresh ? 'flipped' : ''}`} aria-hidden="true">
              ↓
            </span>
          )}
          <span className="ptr-label">{statusText}</span>
        </div>
      </div>
      <div className="ptr-content">
        {children}
      </div>
    </div>
  );
}
