# 🧠 MindBuddy – Trợ lý Sức khỏe Tâm thần cho Sinh viên

> "Cùng bạn vượt qua áp lực, kiến tạo tương lai."

## Tính năng

| Tính năng | Mô tả |
|-----------|-------|
| 💭 **Mood Tracker** | Check-in cảm xúc hàng ngày, biểu đồ xu hướng theo tuần |
| 🍅 **Smart Pomodoro** | Đồng hồ tập trung + âm thanh nền + gợi ý nghỉ ngơi |
| 🌍 **Cộng đồng** | Confession Map ẩn danh, Buddy System 21 ngày |
| 🌱 **Vườn tâm hồn** | Gamification – cây lớn lên theo thói quen tốt |
| 🆘 **S.O.S** | Hotline khẩn cấp, bài tập hít thở 4-7-8 |
| 🏅 **Huy hiệu** | Phần thưởng cho các cột mốc tích cực |

## Cài đặt & Chạy

### Yêu cầu
- Node.js (đã cài sẵn)

### Khởi động nhanh (Windows)
```
Double-click: start.bat
```

### Hoặc chạy thủ công
```bash
cd frontend
npm install
npm start
```

Mở trình duyệt tại: **http://localhost:3000**

## Cấu trúc dự án

```
MindBuddy/
├── frontend/
│   ├── src/
│   │   ├── context/AppContext.js   # State management toàn cục
│   │   ├── components/Layout.js   # Navigation
│   │   └── pages/
│   │       ├── Dashboard.js       # Trang chủ
│   │       ├── MoodTracker.js     # Theo dõi cảm xúc
│   │       ├── Pomodoro.js        # Đồng hồ học tập
│   │       ├── Community.js       # Cộng đồng ẩn danh
│   │       ├── Garden.js          # Vườn tâm hồn
│   │       └── SOS.js             # Hỗ trợ khẩn cấp
│   └── package.json
└── start.bat                      # Script khởi động Windows
```

## Công nghệ sử dụng
- **React 18** – Frontend framework
- **React Router 6** – Điều hướng
- **Recharts** – Biểu đồ cảm xúc
- **localStorage** – Lưu trữ dữ liệu cục bộ (không cần backend)
