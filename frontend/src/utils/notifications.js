const DEFAULT_ICON = '/icons/icon-192.png';
const DEFAULT_BADGE = '/icons/icon-96.png';
const CHECKIN_ACTIONS = [
  { action: 'checkin', title: '💭 Check-in ngay' },
  { action: 'dismiss', title: 'Để sau' },
];

let checkinTimerId = null;
let waterTimerId = null;

// Đăng ký service worker
export async function registerSW() {
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    // Check for updates every 60 minutes
    setInterval(() => registration.update(), 60 * 60 * 1000);
  }
}

// Xin quyền thông báo
export async function requestPermission() {
  if (!('Notification' in window)) return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function hasPermission() {
  return 'Notification' in window && Notification.permission === 'granted';
}

// Gửi thông báo ngay (ưu tiên Service Worker để hỗ trợ actions trên mobile)
export async function notify(title, body, options = {}) {
  if (!hasPermission()) return;

  const extraOptions =
    typeof options === 'string'
      ? (options.startsWith('/') || options.startsWith('http') ? { icon: options } : {})
      : (options && typeof options === 'object' ? options : {});

  const notifOptions = {
    body,
    icon: DEFAULT_ICON,
    badge: DEFAULT_BADGE,
    ...extraOptions,
  };

  if ('serviceWorker' in navigator) {
    try {
      const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((resolve) => setTimeout(() => resolve(null), 1500)),
      ]);
      if (registration && typeof registration.showNotification === 'function') {
        await registration.showNotification(title, notifOptions);
        return;
      }
    } catch (err) {
      // Fallback to standard Notification API below
    }
  }

  try {
    const nativeOptions = { ...notifOptions };
    delete nativeOptions.actions;
    delete nativeOptions.vibrate;
    if (!nativeOptions.tag) {
      delete nativeOptions.renotify;
    }
    new Notification(title, nativeOptions);
  } catch (err) {
    // Ignore Notification constructor errors in unsupported environments
  }
}

async function syncPeriodicCheckin(enabled, hour, minute) {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((resolve) => setTimeout(() => resolve(null), 2000)),
    ]);
    if (!registration) return;

    registration.active?.postMessage({
      type: 'CHECKIN_REMINDER_META',
      enabled,
      hour,
      minute,
    });

    if (enabled) {
      await registration.periodicSync?.register('mb-checkin-reminder', {
        minInterval: 12 * 60 * 60 * 1000,
      });
    } else {
      await registration.periodicSync?.unregister?.('mb-checkin-reminder');
    }
  } catch (err) {
    // Silently ignore if Periodic Background Sync is unsupported or not permitted
  }
}

// --- Nhắc check-in hàng ngày ---
export function scheduleCheckinReminder(hour, minute) {
  clearCheckinReminder({ preservePeriodicSync: true });
  const check = () => {
    const now = new Date();
    if (now.getHours() === hour && now.getMinutes() === minute) {
      const todayKey = `mb_checkin_notified_${now.toDateString()}`;
      let moodLogs = [];
      try {
        moodLogs = JSON.parse(localStorage.getItem('mb_moods') || '[]');
      } catch (err) {
        moodLogs = [];
      }
      const checkedToday = moodLogs.some(
        (l) => new Date(l.date).toDateString() === now.toDateString()
      );
      if (!checkedToday && !sessionStorage.getItem(todayKey)) {
        notify(
          '💭 Nhắc check-in cảm xúc',
          'Hôm nay bạn cảm thấy thế nào? Hãy ghi lại nhé!',
          {
            tag: 'mb-daily-checkin',
            renotify: true,
            vibrate: [100, 50, 100],
            data: { url: '/mood?tab=today&quick=mood' },
            actions: CHECKIN_ACTIONS,
          }
        );
        sessionStorage.setItem(todayKey, '1');
      }
    }
  };
  const id = window.setInterval(check, 60000);
  checkinTimerId = id;
  localStorage.setItem('mb_checkin_timer_id', String(id));
  syncPeriodicCheckin(true, hour, minute);
  return id;
}

export function clearCheckinReminder(options = {}) {
  if (checkinTimerId !== null) {
    window.clearInterval(checkinTimerId);
    checkinTimerId = null;
  }
  const id = localStorage.getItem('mb_checkin_timer_id');
  if (id) {
    window.clearInterval(parseInt(id, 10));
    localStorage.removeItem('mb_checkin_timer_id');
  }
  if (!options.preservePeriodicSync) {
    syncPeriodicCheckin(false);
  }
}

// --- Nhắc uống nước ---
export function scheduleWaterReminder(intervalHours) {
  clearWaterReminder();
  const ms = intervalHours * 60 * 60 * 1000;
  const id = window.setInterval(() => {
    notify(
      '💧 Nhắc uống nước',
      `Đã ${intervalHours} tiếng rồi! Uống một ly nước nhé 😊`,
      {
        tag: 'mb-water-reminder',
        renotify: true,
        data: { url: '/' },
      }
    );
  }, ms);
  waterTimerId = id;
  localStorage.setItem('mb_water_timer_id', String(id));
  return id;
}

export function clearWaterReminder() {
  if (waterTimerId !== null) {
    window.clearInterval(waterTimerId);
    waterTimerId = null;
  }
  const id = localStorage.getItem('mb_water_timer_id');
  if (id) {
    window.clearInterval(parseInt(id, 10));
    localStorage.removeItem('mb_water_timer_id');
  }
}

// --- Nhắc nghỉ Pomodoro ---
export function notifyPomodoroBreak() {
  notify(
    '🍅 Pomodoro hoàn thành!',
    'Nghỉ ngơi một chút nhé. Hít thở sâu và giãn cơ 💆',
    {
      tag: 'mb-pomodoro',
      renotify: true,
      vibrate: [100, 50, 100],
      data: { url: '/pomodoro' },
    }
  );
}

export function notifyPomodoroResume() {
  notify(
    '▶️ Hết giờ nghỉ!',
    'Sẵn sàng tập trung tiếp chưa? Bắt đầu thôi! 💪',
    {
      tag: 'mb-pomodoro',
      renotify: true,
      vibrate: [100, 50, 100],
      data: { url: '/pomodoro' },
    }
  );
}

// --- SW Update Detection ---
export function onSWUpdate(callback) {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.ready.then((registration) => {
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New SW installed, waiting to activate — notify the app
          callback(registration);
        }
      });
    });
  });
}

export function skipWaitingAndReload() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.ready.then((registration) => {
    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  });
  // Reload once the new SW takes control
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });
}

