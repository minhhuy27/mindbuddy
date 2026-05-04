import React from 'react';
import { Link } from 'react-router-dom';
import './CrisisPanel.css';

export default function CrisisPanel({ onDismiss }) {
  return (
    <div className="crisis-panel" role="alert">
      <div>
        <strong>Bạn có vẻ đang không an toàn lúc này</strong>
        <p>Nếu bạn có ý định tự làm hại bản thân, hãy gọi người thân, đến nơi có người tin cậy, hoặc liên hệ hỗ trợ khẩn cấp ngay.</p>
      </div>
      <div className="crisis-actions">
        <a className="btn btn-danger" href="tel:1800599920">Gọi 1800 599 920</a>
        <Link className="btn btn-secondary" to="/sos">Mở S.O.S</Link>
        {onDismiss && (
          <button className="crisis-dismiss" onClick={onDismiss} aria-label="Ẩn cảnh báo hỗ trợ khẩn cấp">Ẩn</button>
        )}
      </div>
    </div>
  );
}
