# MindBuddy

MindBuddy là ứng dụng nhật ký cá nhân kết hợp theo dõi cảm xúc, sức khỏe tinh thần, Pomodoro và AI hỗ trợ tự phản tỉnh. Ứng dụng đang được tối ưu cho nhu cầu sử dụng cá nhân, ưu tiên UI/UX, khả năng nhìn lại dữ liệu và quyền riêng tư khi gửi nội dung cho AI.

> Cùng bạn vượt qua áp lực, kiến tạo tương lai.

## 📱 PWA — Cài Đặt Trên Điện Thoại

MindBuddy là **Progressive Web App (PWA)** — bạn có thể cài đặt trực tiếp trên điện thoại Android như một ứng dụng native, không cần tải từ Play Store.

### Cách cài đặt trên Android Chrome

1. Mở trang web MindBuddy trên Chrome
2. Nhấn vào banner **"Cài đặt MindBuddy"** hiện ở trên cùng, hoặc:
   - Nhấn menu **⋮** (3 chấm) góc phải trên
   - Chọn **"Cài ứng dụng"** / **"Add to Home screen"**
3. Nhấn **"Cài đặt"** / **"Install"**
4. App sẽ xuất hiện trên màn hình chính

### Tính năng PWA

| Tính năng | Mô tả |
| --- | --- |
| 🔌 Offline | Xem lại dữ liệu đã cache khi mất mạng. AI requests tự động queue và gửi lại khi có mạng. |
| 🔔 Thông báo | Nhắc check-in hàng ngày với nút hành động nhanh. |
| 📸 Camera | Chụp ảnh trực tiếp từ camera khi ghi nhật ký. |
| ↓ Pull-to-refresh | Kéo xuống để làm mới dữ liệu trên Dashboard và Timeline. |
| 📤 Share Target | Chia sẻ ảnh/text từ app khác vào MindBuddy. |
| 🔒 Wake Lock | Màn hình giữ sáng khi Pomodoro đang chạy. |
| 👆 Touch-first | Touch targets ≥ 44px, haptic feedback, swipe navigation. |

## Tính Năng Chính

| Khu vực | Mô tả |
| --- | --- |
| Trang chủ hôm nay | Check-in nhanh, nhìn nhanh tuần này, ảnh gần đây, công cụ trong ngày và gợi ý hành động theo trạng thái hiện tại. |
| Cảm xúc | Ghi mood, nguyên nhân, chỉ số stress/năng lượng/giấc ngủ/tập trung, định dạng ghi chú, xem trước ghi chú, autosave draft, lịch sử và calendar. |
| Quyền riêng tư AI | Mỗi check-in có tùy chọn không gửi dòng đó cho AI phân tích. Các insight, nhìn lại ngày và tư vấn sẽ bỏ qua dữ liệu này. |
| Tư vấn | Trang `/counseling` với các chế độ Lắng nghe, Gỡ rối, Kế hoạch 24h, Nói với người thật. Có mức khó chịu 1-5, dùng ngữ cảnh nhật ký tùy chọn và lưu phiên chat trên thiết bị. |
| Nhìn lại ngày | Gom check-in, chỉ số phụ, Pomodoro và media trong ngày để tạo bản tóm tắt, khoảnh khắc ổn nhất, điều làm căng hơn và bước nhỏ cho ngày mai. |
| Pomodoro thông minh | Pomodoro nối với mood: hỏi mức tập trung trước/sau phiên, gợi ý phiên học theo focus/stress/năng lượng gần nhất. |
| Ký ức và media | Upload nhiều ảnh/video/audio, kéo thả hoặc copy/paste file, ghi âm nhanh, xem media dạng lớn, trung tâm media theo ngày/tháng. |
| Dung lượng Firebase | Theo dõi tổng dung lượng media, file lớn, file cũ, xóa media nhưng giữ note và cảnh báo video lớn. |
| Khoảnh khắc tốt | Gom note tích cực, ảnh đẹp và ngày mood cao để mở lại khi cần. |
| Hồ sơ cá nhân | Mục tiêu hiện tại, mục tiêu tùy chỉnh, icon mục tiêu, streak, số ngày đã ghi, chỉ số trung bình và pattern cá nhân. |
| Lịch sử nâng cao | Tìm kiếm nhật ký, lọc theo mood, nguyên nhân, media, stress cao, ngủ thấp và khoảng ngày. |
| Insight có bằng chứng | Khi AI nêu pattern, app kèm ví dụ định lượng từ dữ liệu gần đây để insight đáng tin hơn. |
| Backup | Backup Firestore tự động hằng ngày, giữ tối đa 10 bản; nhắc tải backup JSON full về máy vào Chủ nhật. |
| S.O.S | Trang hỗ trợ khẩn cấp, hotline, bài thở và CrisisPanel khi phát hiện keyword nguy hiểm. |

## Kiến Trúc

```text
MindBuddy/
├── frontend/
│   ├── public/
│   │   ├── manifest.json          # PWA manifest
│   │   ├── sw.js                  # Workbox service worker
│   │   ├── offline.html           # Offline fallback page
│   │   ├── _headers               # Netlify caching headers
│   │   └── icons/                 # PWA icons (72-512px)
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout.js          # Navigation + swipe gestures
│   │   │   ├── InstallBanner.js   # PWA install prompt
│   │   │   ├── OfflineBanner.js   # Offline status indicator
│   │   │   ├── PullToRefresh.js   # Pull-to-refresh gesture
│   │   │   ├── UpdateToast.js     # SW update notification
│   │   │   ├── CrisisPanel.js
│   │   │   └── WeeklyInsight.js
│   │   ├── hooks/
│   │   │   ├── useInstallPrompt.js
│   │   │   ├── useNetworkStatus.js
│   │   │   ├── useWakeLock.js
│   │   │   └── useStandaloneMode.js
│   │   ├── context/
│   │   │   └── AppContext.js
│   │   ├── pages/
│   │   │   ├── Dashboard/         # Refactored (7 sub-components)
│   │   │   ├── MoodTracker/       # Refactored (15 sub-components)
│   │   │   ├── Counseling.js
│   │   │   ├── DailyReview.js
│   │   │   ├── Pomodoro.js        # Wake lock + fullscreen mode
│   │   │   ├── Timeline.js        # Pull-to-refresh
│   │   │   └── ...
│   │   └── utils/
│   │       ├── aiService.js       # Auth headers + offline queue
│   │       ├── offlineQueue.js    # IndexedDB queue + auto-replay
│   │       ├── notifications.js   # SW-based notifications
│   │       └── exportPDF.js
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── index.js               # Auth + rate limit middleware
│   │   ├── aiClient.js
│   │   ├── middleware/
│   │   │   ├── firebaseAuth.js    # Firebase Admin token verification
│   │   │   └── rateLimiter.js     # 30 req/min/user
│   │   └── routes/
│   │       ├── ai.js
│   │       └── media.js
│   ├── render.yaml
│   └── package.json
└── start.bat
```

## Công Nghệ

- Frontend: React 18 (CRA), React Router 6, Recharts, date-fns.
- PWA: Workbox CDN service worker, Web App Manifest, offline persistence.
- Backend: Express, Groq SDK, Google Generative AI SDK, Firebase Admin Auth middleware.
- Lưu dữ liệu: Firebase Auth, Firestore database `mindbuddy` (offline IndexedDB persistence), Firebase Storage.
- Xuất dữ liệu: jsPDF, jsPDF AutoTable, html2canvas.
- Media: upload ảnh/video/audio, nén video qua backend bằng `ffmpeg-static` và `fluent-ffmpeg`.

## API Backend

Backend chạy tại `/api` và có các nhóm endpoint chính. Tất cả `/api/ai/*` và `/api/media/*` yêu cầu Firebase Auth token trong header `Authorization: Bearer <token>`.

| Endpoint | Mục đích | Auth |
| --- | --- | --- |
| `POST /api/ai/analyze` | Phân tích nhanh sau check-in. | ✅ Required |
| `POST /api/ai/chat` | Chat AI trong trang Cảm xúc. | ✅ Required |
| `POST /api/ai/counsel` | AI cho trang Tư vấn. Ưu tiên Gemini, fallback Groq. | ✅ Required |
| `POST /api/ai/daily-review` | Tạo bản Nhìn lại ngày. | ✅ Required |
| `POST /api/ai/weekly` | Weekly insight. | ✅ Required |
| `POST /api/ai/summarize` | Tóm tắt ngày để lưu memory. | ✅ Required |
| `GET /api/ai/status` | Kiểm tra key Groq/Gemini đã cấu hình chưa. | Optional |
| `/api/media/*` | Xử lý media/video ở backend. | ✅ Required |
| `GET /health` | Health check backend. | — |

Rate limiting: 30 requests/phút/user cho AI endpoints.

## Cài Đặt Local

Yêu cầu:

- Node.js 20 trở lên cho backend.
- npm.
- Firebase project đã bật Auth, Firestore và Storage.

### Backend

```bash
cd backend
npm install
npm start
```

Backend mặc định chạy ở:

```text
http://localhost:5000
```

Tạo file `backend/.env`:

```env
PORT=5000
FRONTEND_URL=http://localhost:3000
GROQ_API_KEY=your_groq_key
GEMINI_API_KEY=your_gemini_key
```

### Frontend

```bash
cd frontend
npm install
npm start
```

Frontend mặc định chạy ở:

```text
http://localhost:3000
```

Nếu backend không chạy ở `http://localhost:5000/api`, cấu hình:

```env
REACT_APP_API_URL=https://your-backend-url.onrender.com/api
```

## Deploy

### Render Backend

Backend có sẵn `backend/render.yaml`.

Biến môi trường cần cấu hình trên Render:

```env
NODE_ENV=production
FRONTEND_URL=https://your-netlify-site.netlify.app
GROQ_API_KEY=your_groq_key
GEMINI_API_KEY=your_gemini_key
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
```

Build command:

```bash
npm install
```

Start command:

```bash
node src/index.js
```

### Netlify Frontend

Base directory:

```text
frontend
```

Build command:

```bash
npm run build:netlify
```

Publish directory:

```text
frontend/build
```

Biến môi trường:

```env
REACT_APP_API_URL=https://your-render-backend.onrender.com/api
```

## Firebase

Ứng dụng đang dùng:

- Firebase Authentication để đăng nhập.
- Firestore để lưu user document, mood logs, daily reviews, goals, backups và các dữ liệu ứng dụng.
- Firebase Storage để lưu ảnh, âm thanh và video.

Một số lưu ý vận hành:

- Dữ liệu chính nằm trong document `users/{uid}` của database Firestore `mindbuddy`.
- Backup Firestore tự động tạo snapshot full dữ liệu người dùng, không chỉ dữ liệu trong ngày.
- Backup tải về máy nên dùng định dạng `mindbuddy-backup-YYYY-MM-DD.json`.
- Nếu Storage Rules bị chặn upload, kiểm tra quyền ghi theo `request.auth.uid` và giới hạn `contentType/size`.

## Quyền Riêng Tư Và An Toàn

- MindBuddy là công cụ tự hỗ trợ và ghi nhật ký, không thay thế bác sĩ, nhà trị liệu hoặc dịch vụ khẩn cấp.
- Nội dung check-in có thể được đánh dấu không gửi AI.
- Phiên chat Tư vấn hiện được lưu trong `localStorage` của thiết bị/trình duyệt hiện tại, không tự đồng bộ sang Firestore.
- Khi phát hiện nội dung nguy hiểm, app hiển thị S.O.S và hướng người dùng đến hỗ trợ khẩn cấp.

## Kiểm Tra Trước Khi Deploy

```bash
cd backend
node --check src/routes/ai.js
node --check src/aiClient.js
```

```bash
cd frontend
npm run build
```

Build frontend hiện có thể xuất hiện warning source map từ `dompurify`; đây là warning dependency và không chặn deploy.
