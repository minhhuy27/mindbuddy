import { useState, useRef, useEffect, useCallback } from 'react';

export default function useWakeLock() {
  const isSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;
  const [isActive, setIsActive] = useState(false);

  const wakeLockRef = useRef(null);
  const shouldStayAwakeRef = useRef(false);
  const isMountedRef = useRef(true);

  const handleSentinelRelease = useCallback(() => {
    wakeLockRef.current = null;
    if (isMountedRef.current) {
      setIsActive(false);
    }
  }, []);

  const acquireLock = useCallback(async () => {
    if (!isSupported) return false;
    if (wakeLockRef.current && !wakeLockRef.current.released) {
      if (isMountedRef.current) setIsActive(true);
      return true;
    }

    try {
      const sentinel = await navigator.wakeLock.request('screen');
      if (!isMountedRef.current || !shouldStayAwakeRef.current) {
        sentinel.release().catch(() => {});
        return false;
      }
      sentinel.addEventListener('release', handleSentinelRelease, { once: true });
      wakeLockRef.current = sentinel;
      setIsActive(true);
      return true;
    } catch (err) {
      console.warn('Wake Lock request failed:', err?.message || err);
      if (isMountedRef.current) setIsActive(false);
      return false;
    }
  }, [handleSentinelRelease, isSupported]);

  const requestWakeLock = useCallback(async () => {
    shouldStayAwakeRef.current = true;
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      return false;
    }
    return acquireLock();
  }, [acquireLock]);

  const releaseWakeLock = useCallback(async () => {
    shouldStayAwakeRef.current = false;
    const sentinel = wakeLockRef.current;
    wakeLockRef.current = null;
    if (isMountedRef.current) {
      setIsActive(false);
    }
    if (sentinel && !sentinel.released) {
      try {
        sentinel.removeEventListener('release', handleSentinelRelease);
        await sentinel.release();
      } catch (err) {
        console.warn('Wake Lock release failed:', err?.message || err);
      }
    }
  }, [handleSentinelRelease]);

  useEffect(() => {
    isMountedRef.current = true;
    if (!isSupported || typeof document === 'undefined') {
      return undefined;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && shouldStayAwakeRef.current) {
        acquireLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      isMountedRef.current = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      shouldStayAwakeRef.current = false;
      const sentinel = wakeLockRef.current;
      wakeLockRef.current = null;
      if (sentinel && !sentinel.released) {
        sentinel.removeEventListener('release', handleSentinelRelease);
        sentinel.release().catch((err) => {
          console.warn('Wake Lock cleanup failed:', err?.message || err);
        });
      }
    };
  }, [acquireLock, handleSentinelRelease, isSupported]);

  return {
    isSupported,
    isActive,
    requestWakeLock,
    releaseWakeLock,
  };
}
