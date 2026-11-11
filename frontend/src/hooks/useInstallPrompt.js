import { useState, useEffect, useCallback } from 'react';

export default function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem('mb_install_dismissed') === '1';
  });

  useEffect(() => {
    // Check if already installed (standalone mode)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    const installedHandler = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setIsInstallable(false);
    if (result.outcome === 'dismissed') {
      setDismissed(true);
      localStorage.setItem('mb_install_dismissed', '1');
    }
    return result.outcome === 'accepted';
  }, [deferredPrompt]);

  const dismissBanner = useCallback(() => {
    setDismissed(true);
    localStorage.setItem('mb_install_dismissed', '1');
  }, []);

  return {
    isInstallable: isInstallable && !dismissed && !isInstalled,
    isInstalled,
    promptInstall,
    dismissBanner,
  };
}
