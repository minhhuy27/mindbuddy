# 🧠 MindBuddy – Trợ lý Sức khỏe Tâm thần cho Sinh viên

> "Cùng bạn vượt qua áp lực, kiến tạo tương lai."

## Tính năng

| Tính năng | Mô tả |
|-----------|-------|
| 🏠 **Dashboard cô đọng** | Hành động chính "Ghi cảm xúc hôm nay", quick check-in, mục tiêu cá nhân, tiến trình streak/Pomodoro/vườn/huy hiệu |
| 💭 **Mood Tracker** | Check-in cảm xúc, ghi chú nguyên nhân, cảm xúc tùy chỉnh, lọc lịch sử 7/14/30 ngày, xem chi tiết từng ngày |
| 🗓️ **Mood Calendar Heatmap** | Calendar theo tháng với màu theo mood score, có nút lùi/tháng sau và quay lại tháng hiện tại |
| 🔍 **AI Insight có cấu trúc** | Weekly insight chia thành "Xu hướng chính", "Điểm cần chú ý", "Gợi ý hôm nay", có cache indicator và nút cập nhật |
| 💬 **AI Chat & Advice** | Lời khuyên sau check-in, chat tiếp với AI, trạng thái loading/error rõ ràng và nút thử lại |
| 🍅 **Smart Pomodoro** | Đồng hồ tập trung + âm thanh nền + gợi ý nghỉ ngơi + tiến trình mở huy hiệu |
| 🌍 **Cộng đồng** | Confession Map ẩn danh, Buddy System 21 ngày |
| 🌱 **Vườn tâm hồn** | Gamification, vườn phát triển theo thói quen tốt, có progress indicator |
| 🆘 **Crisis UX / S.O.S** | Hotline khẩn cấp, bài tập hít thở 4-7-8, panel hỗ trợ hiện ngay khi phát hiện keyword nguy hiểm |
| 🏅 **Huy hiệu** | Phần thưởng cho các cột mốc tích cực |
| 🌙 **Dark mode & Mobile UX** | Dark mode dịu hơn, mobile bottom navigation, quick actions dạng grid 2 cột |

## Cập nhật frontend gần đây

- Dashboard có thêm quick check-in widget để chọn mood và ghi chú nhanh mà không cần vào trang Cảm xúc.
- Người dùng có thể chọn mục tiêu cá nhân: giảm stress, ngủ tốt hơn, hoặc tập trung học tập. Dashboard và AI advice ưu tiên theo mục tiêu này.
- Trang Cảm xúc có Mood Calendar dạng heatmap theo tháng, hỗ trợ lật lại các tháng trước và mở modal chi tiết từng ngày.
- Lịch sử cảm xúc có bộ lọc 7 ngày, 14 ngày, 30 ngày và dùng màu mood nhất quán giữa mood card, chart, calendar, timeline.
- Weekly insight được trình bày thành 3 thẻ dễ đọc thay vì một đoạn dài.
- Các phần AI có trạng thái loading/error thân thiện, timeout message, nút "Thử lại", và indicator khi đang dùng kết quả cache.
- Cột check-in/AI chat trong trang Cảm xúc có vùng cuộn riêng trên desktop, giúp đọc hết phân tích và chat mà không phải kéo qua toàn bộ nhật ký bên phải.
- Mobile layout được cải thiện với bottom tab navigation và quick actions dạng grid 2 cột.
- Dark mode được tinh chỉnh contrast cho text muted, border và card background.
- Accessibility được bổ sung cho nhiều button/icon bằng `aria-label`, `aria-pressed`, focus state rõ hơn, và màu mood luôn đi kèm label/text.

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
│   │   ├── components/Layout.js    # Navigation desktop/mobile
│   │   ├── components/WeeklyInsight.js # AI weekly insight có cấu trúc
│   │   ├── components/CrisisPanel.js   # Panel hỗ trợ khẩn cấp
│   │   └── pages/
│   │       ├── Dashboard.js        # Trang chủ, quick check-in, mục tiêu cá nhân
│   │       ├── MoodTracker.js      # Theo dõi cảm xúc, AI chat, heatmap, timeline
│   │       ├── Pomodoro.js         # Đồng hồ học tập
│   │       ├── Community.js        # Cộng đồng ẩn danh
│   │       ├── Garden.js           # Vườn tâm hồn
│   │       └── SOS.js              # Hỗ trợ khẩn cấp
│   └── package.json
├── backend/
│   └── src/
│       ├── aiClient.js             # AI client
│       └── routes/ai.js            # API phân tích/chat/tóm tắt
└── start.bat                       # Script khởi động Windows
```

## Công nghệ sử dụng
- **React 18** – Frontend framework
- **React Router 6** – Điều hướng
- **Recharts** – Biểu đồ cảm xúc
- **date-fns** – Format ngày, lọc timeline và calendar
- **Firebase** – Xác thực và lưu dữ liệu người dùng
- **Express backend** – API AI cho phân tích cảm xúc, chat, weekly insight và tóm tắt ngày
