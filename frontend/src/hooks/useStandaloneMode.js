import { useEffect, useState } from 'react';

function getInitialStandaloneMode() {
  if (typeof window === 'undefined') return false;
  return (
    Boolean(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    window.navigator.standalone === true
  );
}

/**
 * Tracks whether the PWA is running in standalone display mode and syncs
 * the `data-standalone` attribute on `document.documentElement`.
 */
export function useStandaloneMode() {
  const [isStandalone, setIsStandalone] = useState(getInitialStandaloneMode);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleChange = () => {
      setIsStandalone(mediaQuery.matches || window.navigator.standalone === true);
    };

    handleChange();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-standalone', isStandalone ? 'true' : 'false');
  }, [isStandalone]);

  return { isStandalone };
}

export default useStandaloneMode;
