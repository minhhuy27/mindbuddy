import { useState, useEffect } from 'react';

export default function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    let timeoutId;
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        // Brief "back online" indicator
        timeoutId = setTimeout(() => setWasOffline(false), 3000);
      }
    };
    const handleOffline = () => {
      clearTimeout(timeoutId);
      setIsOnline(false);
      setWasOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline]);

  return { isOnline, wasOffline };
}
