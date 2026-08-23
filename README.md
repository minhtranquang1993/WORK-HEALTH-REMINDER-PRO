# 🏃 Work Health Reminder PRO

> Chrome Extension nhắc nhở sức khỏe khi làm việc — bảo vệ mắt, nhắc uống nước,
> **tự động tắt nhắc khi bạn rời máy hoặc đang họp**.
> Chạy trên **Windows / macOS / Linux**, hoàn toàn offline, không cần tài khoản.

**Extension là sản phẩm chính.** Các file Python và bản web trong repo là demo legacy — xem [Trạng thái các bản](#-trạng-thái-các-bản).

---

## 📋 Mục lục

- [Tính năng](#-tính-năng)
- [Cài đặt](#-cài-đặt)
- [Tự động hoá](#-tự-động-hoá)
- [Bàn phím tắt](#-bàn-phím-tắt)
- [Cài đặt Telegram](#-cài-đặt-telegram-nhận-báo-cáo-todo)
- [Ngân sách thông báo](#-ngân-sách-thông-báo)
- [Phát triển & test](#-phát-triển--test)
- [Trạng thái các bản](#-trạng-thái-các-bản)
- [Bảo mật](#-bảo-mật)
- [Câu hỏi thường gặp](#-câu-hỏi-thường-gặp)

---

## ✨ Tính năng

### ⏱️ Nhắc nhở định kỳ (mặc định đã hiệu chỉnh để không spam)

| Chu kỳ | Nhắc nhở | Nguồn |
|--------|----------|-------|
| 20 phút | 👁️ Nhìn xa 6m trong 20 giây (20-20-20) | American Academy of Ophthalmology |
| 60 phút | 🚶 Đứng dậy đi bộ | Columbia University |
| 60 phút | 💧 Uống nước (theo tiến độ, xem bên dưới) | WHO Hydration Guidelines |
| 90 phút | 🪑 Kiểm tra tư thế ngồi | Cornell 20-8-2 Rule |
| 90 phút | 😊 Nhắc chớp mắt | Dry Eye Research |
| 90 phút | 🧘 Giãn cơ cổ vai | Ergonomics Guidelines |
| 120 phút | 🚻 Đi toilet | — |
| 180 phút | 👀 Bài tập mắt | AAO Guidelines |
| 180 phút | 🌬️ Hít thở sâu | Mindfulness Research |

Cả 9 chu kỳ đều **tự chỉnh được** trong ⚙️ Settings. Popup hiển thị luôn số thông báo/ngày mà cấu hình hiện tại sẽ tạo ra.

> **Vì sao chớp mắt là 90 phút, không phải 2 phút?** 1–2 phút là *nhịp chớp mắt sinh lý*, không phải nhịp gửi thông báo. Bản cũ đặt 2 phút → khoảng **240 thông báo/ngày làm**, và kết quả thực tế là người dùng tắt hết thông báo.

### 🔔 Nhắc nhở có nút bấm
Mỗi thông báo có tối đa 2 nút: **✅ Đã làm**, **⏰ +5 phút**, và với nước là **💧 +1 ly** — ghi nhận ngay, không cần mở popup.

### 💧 Water Tracker theo tiến độ
- Mục tiêu mặc định **2000ml/ngày** (tự chỉnh)
- Chỉ nhắc khi bạn **đang tụt so với tiến độ ngày**, thay vì nhắc cứng theo giờ
- Tự reset mỗi ngày, có nút Undo

### 🎯 Focus Mode & 🍅 Pomodoro
Tắt nhắc nhở 15/30/45/60 phút, tự bật lại. Focus Mode cũng tự pause video YouTube đang phát.

### 🏖️ Nghỉ phép, 🎌 Ngày lễ
Lịch nghỉ lễ Việt Nam tới 2027 + tự thêm ngày nghỉ riêng. App tự dừng vào ngày lễ.

### 📝 Todo & Báo cáo Telegram
Quản lý task trong ngày, streak, thống kê 7 ngày. Báo cáo cuối ngày gồm todo + **% nước + số Pomodoro**. Nếu Chrome tắt lúc tới giờ, báo cáo được **gửi bù** khi mở lại.

---

## 🚀 Cài đặt

1. Mở Chrome → vào `chrome://extensions/`
2. Bật **Developer mode** (góc trên phải)
3. Bấm **Load unpacked** → chọn thư mục `chrome-extension/`
4. Icon xuất hiện trên thanh công cụ ✅

### Các tab trong Extension

| Tab | Chức năng |
|-----|-----------|
| ⏱️ Timer | Countdown nhắc nhở + 💧 Water Tracker |
| 📺 YouTube | Điều khiển YouTube đang phát |
| 🎯 Focus | Focus Mode + Pomodoro |
| 📝 Todo | Quản lý task, streak, thống kê tuần |
| ⚙️ Settings | Giờ làm, 9 chu kỳ nhắc, tự động hoá, Telegram |

---

## 🤖 Tự động hoá

Bật/tắt trong ⚙️ Settings → **🤖 Tự động**:

| Tính năng | Mặc định | Cách hoạt động |
|---|---|---|
| 💤 **Tắt nhắc khi rời máy** | Bật | Dùng `chrome.idle`: không nhắc khi bạn rời máy ≥ 5 phút hoặc máy đang khoá |
| 📞 **Tự tắt nhắc khi đang họp** | Bật | Phát hiện tab Meet / Zoom / Teams / Webex / Whereby **đang phát tiếng** → tạm tắt nhắc, tự bật lại khi hết. Không cần calendar, không cần OAuth, không cần quyền mới |
| 💧 **Nhắc nước theo tiến độ** | Bật | Chỉ nhắc khi tụt so với tiến độ ngày, thay vì nhắc cứng |
| 📉 **Tự giãn nhắc bị bỏ qua** | Tắt | Nhắc nào bị tắt liên tiếp 3 lần sẽ tự giãn ra (trần = 2× mặc định, không bao giờ thành "im lặng") |

Khi nhắc nhở đang bị tạm tắt, popup **luôn hiện rõ lý do** (đang họp / rời máy / nghỉ trưa / ngoài giờ / ngày lễ...) — để không bao giờ có chuyện "sao không thấy nhắc gì" mà không rõ nguyên nhân.

---

## ⌨️ Bàn phím tắt

| Tổ hợp | Chức năng |
|---|---|
| `Alt+Shift+W` | Uống thêm 1 ly nước |
| `Alt+Shift+F` | Bật/tắt Focus Mode 30 phút |
| `Alt+Shift+P` | Bật/tắt Pomodoro |
| `Alt+Shift+S` | Tạm dừng/tiếp tục nhắc nhở |

Đổi tổ hợp tại `chrome://extensions/shortcuts`.

---

## 📱 Cài đặt Telegram (Nhận báo cáo Todo)

### Bước 1 — Tạo Bot
1. Mở Telegram → tìm **@BotFather** → gửi `/newbot`
2. Đặt tên bot → copy **Bot Token** (dạng `123456789:AAHxx...`)

### Bước 2 — Lấy Chat ID
1. Tìm **@userinfobot** → gửi tin nhắn bất kỳ
2. Bot trả về **ID** của bạn

### Bước 3 — Nhập vào extension
> ⚙️ Settings → 📱 Telegram Integration → nhập Bot Token + Chat ID → **📢 Test thông báo** → **💾 Lưu cài đặt**

Nút Test gửi thử ngay mà **không** thay đổi cài đặt nào khác.

> **Bot Token chỉ lưu trên máy này** (`storage.local`), không đồng bộ lên tài khoản Google.

---

## 📊 Ngân sách thông báo

Nhắc nhở được chia 2 nhóm ngân sách riêng:

- **Micro** (20-20-20): tần suất cao nhưng gần như không tốn công → 24 lần/ngày làm 8h
- **Cần hành động** (đứng dậy, uống nước, giãn cơ...): trần **40 lần/ngày**, hiện tại mặc định là 39

Khi bạn chỉnh chu kỳ trong Settings, dòng bên dưới lưới interval báo ngay tổng số thông báo/ngày và cảnh báo nếu vượt ngưỡng.

---

## 🧪 Phát triển & test

```bash
npm test          # 145 test: logic lõi + service worker
npm run test:core # chỉ logic thuần (lib/core.js)
npm run test:bg   # chỉ service worker (chrome API được giả lập)
npm run check     # kiểm tra syntax toàn bộ + manifest
```

Kiến trúc:

```
chrome-extension/
├── lib/core.js          ← TOÀN BỘ logic thuần, không dùng chrome.* → test được
├── background.js        ← service worker: chỉ lo chrome API
├── popup.js / popup.html / popup.css
├── youtube-content.js
└── manifest.json

tests/
├── core.test.js         ← 78 test cho logic thuần
├── background.test.js   ← 67 test tích hợp qua chrome stub
└── helpers/chrome-stub.js
```

`lib/core.js` được **dùng chung** giữa popup và service worker, nên hai bên không thể lệch nhau về luật giờ làm, ngày lễ, hay điều kiện chặn nhắc nhở.

---

## 📦 Trạng thái các bản

| Đường dẫn | Trạng thái |
|---|---|
| `chrome-extension/` | ✅ **Được hỗ trợ** — sản phẩm chính |
| `menubar_app.py` | 🟡 Bản macOS menu bar, còn dùng được |
| `reminder_pro.py`, `reminder_gui.py`, `reminder.py` | ⚠️ **Legacy, không hỗ trợ** — bản terminal/GUI cũ |
| `index.html` + `app.js` + `styles.css` | ⚠️ **Legacy, không hỗ trợ** — demo web cũ |

Các bản legacy vẫn chạy nhưng **không nhận sửa lỗi và không có test**. Mọi tính năng mới chỉ làm trên extension.

### macOS Menu Bar App (nếu muốn dùng)

```bash
pip3 install rumps
python3 menubar_app.py
```

Hoặc double-click `Start_macOS.command`.

---

## 🔒 Bảo mật

- **Bot Token Telegram** lưu ở `chrome.storage.local`, chỉ trên máy này, không sync.
- **Cầu nối localhost**: extension gửi thông tin video YouTube sang menubar app qua `http://localhost:9876`. Endpoint này đã được siết: chỉ nhận request từ `chrome-extension://` (kiểm qua header `X-WHR-Source` và `Origin`), không còn `Access-Control-Allow-Origin: *` như trước — website thường không đọc được bạn đang xem gì.
- Extension **không gửi dữ liệu ra internet**, trừ khi bạn tự bật Telegram.
- Quyền `tabs` được dùng để phát hiện họp và điều khiển YouTube. Quyền `idle` không hiện cảnh báo khi cài.

---

## ❓ Câu hỏi thường gặp

**Q: Sao không thấy nhắc nhở nào?**
→ Mở popup, dòng banner phía trên sẽ ghi rõ lý do (đang họp / rời máy / nghỉ trưa / ngoài giờ làm / ngày lễ / đã tạm dừng).

**Q: Thông báo có nút bấm không hiện trên máy tôi?**
→ Một số bản Chrome trên macOS không hỗ trợ nút trên thông báo. Extension tự phát hiện và gửi lại bản không nút. Dùng bàn phím tắt để thay thế.

**Q: Chrome Extension không load được?**
→ Đảm bảo đã bật **Developer mode** trong `chrome://extensions/`.

**Q: Đổi chu kỳ nhắc ở đâu?**
→ ⚙️ Settings → ⏱️ Thời gian nhắc — đủ cả 9 loại.

**Q: Lịch nghỉ lễ tới năm nào?**
→ Ngày lễ âm lịch (Tết, Giỗ Tổ) hardcode tới **2027**. Sau đó cần cập nhật trong `chrome-extension/lib/core.js` (`VN_HOLIDAYS_LUNAR`). Ngày lễ dương lịch tự tính theo năm.

**Q: Double-click `Start_macOS.command` bị chặn?**
→ Right-click file → **Open** → xác nhận **Open**. Hoặc:
```bash
chmod +x Start_macOS.command
xattr -d com.apple.quarantine Start_macOS.command
```

---

## 🙏 Credits

Built with ❤️ for productivity and health.
Dựa trên nghiên cứu của Columbia University, WHO, AAO, Cornell University.
