# MindBuddy

MindBuddy là ứng dụng nhật ký cá nhân kết hợp theo dõi cảm xúc, sức khỏe tinh thần, Pomodoro và AI hỗ trợ tự phản tỉnh. Ứng dụng đang được tối ưu cho nhu cầu sử dụng cá nhân, ưu tiên UI/UX, khả năng nhìn lại dữ liệu và quyền riêng tư khi gửi nội dung cho AI.

> Cùng bạn vượt qua áp lực, kiến tạo tương lai.

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
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout.js
│   │   │   ├── CrisisPanel.js
│   │   │   └── WeeklyInsight.js
│   │   ├── context/
│   │   │   └── AppContext.js
│   │   ├── pages/
│   │   │   ├── Dashboard.js
│   │   │   ├── MoodTracker.js
│   │   │   ├── Counseling.js
│   │   │   ├── DailyReview.js
│   │   │   ├── Pomodoro.js
│   │   │   ├── Needs.js
│   │   │   ├── MediaCenter.js
│   │   │   ├── StorageManager.js
│   │   │   ├── Profile.js
│   │   │   ├── GoodMoments.js
│   │   │   ├── Community.js
│   │   │   ├── Garden.js
│   │   │   └── SOS.js
│   │   └── utils/
│   │       ├── aiService.js
│   │       └── exportPDF.js
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── index.js
│   │   ├── aiClient.js
│   │   └── routes/
│   │       ├── ai.js
│   │       └── media.js
│   ├── render.yaml
│   └── package.json
└── start.bat
```

## Công Nghệ

- Frontend: React 18, React Router 6, Recharts, date-fns.
- Backend: Express, Groq SDK, Google Generative AI SDK.
- Lưu dữ liệu: Firebase Auth, Firestore database `mindbuddy`, Firebase Storage.
- Xuất dữ liệu: jsPDF, jsPDF AutoTable, html2canvas.
- Media: upload ảnh/video/audio, nén video qua backend bằng `ffmpeg-static` và `fluent-ffmpeg` khi dùng endpoint media.

## API Backend

Backend chạy tại `/api` và có các nhóm endpoint chính:

| Endpoint | Mục đích |
| --- | --- |
| `POST /api/ai/analyze` | Phân tích nhanh sau check-in. |
| `POST /api/ai/chat` | Chat AI trong trang Cảm xúc. |
| `POST /api/ai/counsel` | AI cho trang Tư vấn. Ưu tiên Gemini, fallback Groq. |
| `POST /api/ai/daily-review` | Tạo bản Nhìn lại ngày. |
| `POST /api/ai/weekly` | Weekly insight. |
| `POST /api/ai/summarize` | Tóm tắt ngày để lưu memory. |
| `GET /api/ai/status` | Kiểm tra key Groq/Gemini đã cấu hình chưa. |
| `/api/media/*` | Xử lý media/video ở backend. |
| `GET /health` | Health check backend. |

Provider AI trả về trong response qua field `provider`, ví dụ `gemini`, `groq` hoặc `groq-fallback`. Trang Tư vấn cũng hiển thị provider sau khi AI trả lời.

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
