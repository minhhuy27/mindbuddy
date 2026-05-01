import React, { useState, useEffect } from 'react';
import {
  hasPermission, requestPermission,
  scheduleCheckinReminder, clearCheckinReminder,
  scheduleWaterReminder, clearWaterReminder,
} from '../utils/notifications';
import './NotificationSettings.css';

export default function NotificationSettings() {
  const [permitted, setPermitted] = useState(hasPermission());
  const [checkinEnabled, setCheckinEnabled] = useState(() => localStorage.getItem('mb_notif_checkin') === '1');
  const [checkinHour, setCheckinHour] = useState(() => parseInt(localStorage.getItem('mb_notif_checkin_hour') || '20'));
  const [checkinMin, setCheckinMin] = useState(() => parseInt(localStorage.getItem('mb_notif_checkin_min') || '0'));
  const [waterEnabled, setWaterEnabled] = useState(() => localStorage.getItem('mb_notif_water') === '1');
  const [waterInterval, setWaterInterval] = useState(() => parseInt(localStorage.getItem('mb_notif_water_interval') || '2'));

  const enable = async () => {
    const granted = await requestPermission();
    setPermitted(granted);
  };

  useEffect(() => {
    if (!permitted) return;
    if (checkinEnabled) {
      scheduleCheckinReminder(checkinHour, checkinMin);
      localStorage.setItem('mb_notif_checkin', '1');
      localStorage.setItem('mb_notif_checkin_hour', checkinHour);
      localStorage.setItem('mb_notif_checkin_min', checkinMin);
    } else {
      clearCheckinReminder();
      localStorage.setItem('mb_notif_checkin', '0');
    }
  }, [checkinEnabled, checkinHour, checkinMin, permitted]);

  useEffect(() => {
    if (!permitted) return;
    if (waterEnabled) {
      scheduleWaterReminder(waterInterval);
      localStorage.setItem('mb_notif_water', '1');
      localStorage.setItem('mb_notif_water_interval', waterInterval);
    } else {
      clearWaterReminder();
      localStorage.setItem('mb_notif_water', '0');
    }
  }, [waterEnabled, waterInterval, permitted]);

  return (
    <div className="card notif-settings">
      <h3 className="mb-3">🔔 Cài đặt thông báo</h3>

      {!permitted ? (
        <div className="notif-blocked">
          <p className="text-muted mb-3">Cho phép thông báo để nhận nhắc nhở hàng ngày.</p>
          <button className="btn btn-primary" onClick={enable}>Bật thông báo</button>
        </div>
      ) : (
        <div className="notif-list">
          <div className="notif-item">
            <div className="notif-info">
              <span className="notif-icon">💭</span>
              <div>
                <div className="notif-name">Nhắc check-in cảm xúc</div>
                <div className="text-muted">Nhắc hàng ngày nếu chưa check-in</div>
              </div>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={checkinEnabled} onChange={e => setCheckinEnabled(e.target.checked)} />
              <span className="slider" />
            </label>
          </div>
          {checkinEnabled && (
            <div className="notif-sub">
              <label>Giờ nhắc nhở</label>
              <div className="time-picker">
                <input type="number" min="0" max="23" value={checkinHour}
                  onChange={e => setCheckinHour(+e.target.value)} />
                <span>:</span>
                <input type="number" min="0" max="59" value={checkinMin}
                  onChange={e => setCheckinMin(+e.target.value)} />
              </div>
            </div>
          )}

          <div className="notif-item">
            <div className="notif-info">
              <span className="notif-icon">💧</span>
              <div>
                <div className="notif-name">Nhắc uống nước</div>
                <div className="text-muted">Nhắc định kỳ trong ngày</div>
              </div>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={waterEnabled} onChange={e => setWaterEnabled(e.target.checked)} />
              <span className="slider" />
            </label>
          </div>
          {waterEnabled && (
            <div className="notif-sub">
              <label>Nhắc mỗi</label>
              <div className="flex items-center gap-2">
                <input type="range" min="1" max="4" value={waterInterval}
                  onChange={e => setWaterInterval(+e.target.value)} style={{ width: 120 }} />
                <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{waterInterval} tiếng</span>
              </div>
            </div>
          )}

          <div className="notif-item">
            <div className="notif-info">
              <span className="notif-icon">🍅</span>
              <div>
                <div className="notif-name">Nhắc nghỉ Pomodoro</div>
                <div className="text-muted">Tự động khi hết mỗi phiên</div>
              </div>
            </div>
            <span className="badge" style={{ background: '#e8f5e9', color: '#2e7d32' }}>Tự động</span>
          </div>
        </div>
      )}
    </div>
  );
}
