// Đăng ký service worker
export async function registerSW() {
  if ('serviceWorker' in navigator) {
    await navigator.serviceWorker.register('/sw.js');
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

// Gửi thông báo ngay
function notify(title, body, icon = '🧠') {
  if (!hasPermission()) return;
  new Notification(title, { body, icon: '/favicon.ico', badge: '/favicon.ico' });
}

// --- Nhắc check-in hàng ngày ---
export function scheduleCheckinReminder(hour, minute) {
  clearCheckinReminder();
  const check = () => {
    const now = new Date();
    if (now.getHours() === hour && now.getMinutes() === minute) {
      const todayKey = `mb_checkin_notified_${now.toDateString()}`;
      const moodLogs = JSON.parse(localStorage.getItem('mb_moods') || '[]');
      const checkedToday = moodLogs.some(l => new Date(l.date).toDateString() === now.toDateString());
      if (!checkedToday && !sessionStorage.getItem(todayKey)) {
        notify('💭 Nhắc check-in cảm xúc', 'Hôm nay bạn cảm thấy thế nào? Hãy ghi lại nhé!');
        sessionStorage.setItem(todayKey, '1');
      }
    }
  };
  const id = setInterval(check, 60000);
  localStorage.setItem('mb_checkin_timer_id', id);
  return id;
}

export function clearCheckinReminder() {
  const id = localStorage.getItem('mb_checkin_timer_id');
  if (id) clearInterval(parseInt(id));
}

// --- Nhắc uống nước ---
export function scheduleWaterReminder(intervalHours) {
  clearWaterReminder();
  const ms = intervalHours * 60 * 60 * 1000;
  const id = setInterval(() => {
    notify('💧 Nhắc uống nước', `Đã ${intervalHours} tiếng rồi! Uống một ly nước nhé 😊`);
  }, ms);
  localStorage.setItem('mb_water_timer_id', id);
  return id;
}

export function clearWaterReminder() {
  const id = localStorage.getItem('mb_water_timer_id');
  if (id) clearInterval(parseInt(id));
}

// --- Nhắc nghỉ Pomodoro ---
export function notifyPomodoroBreak() {
  notify('🍅 Pomodoro hoàn thành!', 'Nghỉ ngơi một chút nhé. Hít thở sâu và giãn cơ 💆');
}

export function notifyPomodoroResume() {
  notify('▶️ Hết giờ nghỉ!', 'Sẵn sàng tập trung tiếp chưa? Bắt đầu thôi! 💪');
}
