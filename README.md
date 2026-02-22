# 🏃 Work Health Reminder PRO

> Ứng dụng nhắc nhở sức khỏe thông minh khi làm việc — bảo vệ mắt, nhắc uống nước, tự động dừng khi họp.  
> Hỗ trợ **macOS** và **Windows**. Hoàn toàn offline, không cần tài khoản.

---

## 📋 Mục lục

- [Tính năng](#-tính-năng)
- [Cài đặt & Chạy app](#-cài-đặt--chạy-app)
- [Hướng dẫn sử dụng](#-hướng-dẫn-sử-dụng)
- [Cài đặt Telegram](#-cài-đặt-telegram-nhận-báo-cáo-todo)
- [Cài đặt Google Calendar](#-cài-đặt-google-calendar-tự-dừng-khi-họp)
- [Chrome Extension](#-chrome-extension)
- [Câu hỏi thường gặp](#-câu-hỏi-thường-gặp)

---

## ✨ Tính năng

### ⏱️ Nhắc nhở thông minh (dựa theo nghiên cứu khoa học)

| Chu kỳ | Nhắc nhở | Nguồn |
|--------|----------|-------|
| 30 phút | 🚶 Đứng dậy đi bộ | Columbia University |
| 45 phút | 💧 Uống nước | WHO Hydration Guidelines |
| 20 phút | 👁️ Nhìn xa 6m trong 20 giây (20-20-20) | American Academy of Ophthalmology |
| 15 phút | 😊 Nhắc chớp mắt | Dry Eye Research |
| 20 phút | 🪑 Kiểm tra tư thế ngồi | Cornell 20-8-2 Rule |
| 30 phút | 🧘 Giãn cơ cổ vai | Ergonomics Guidelines |
| 60 phút | 👀 Bài tập mắt | AAO Guidelines |
| 60 phút | 🌬️ Hít thở sâu | Mindfulness Research |

### 💧 Water Tracker
- Theo dõi lượng nước uống theo ngày
- Mục tiêu mặc định **2000ml/ngày** (có thể tự chỉnh)
- Progress bar hiển thị % đã đạt
- Tự động reset mỗi ngày mới

### 🎯 Focus Mode *(mới)*
- Tắt toàn bộ nhắc nhở trong 15 / 30 / 45 / 60 phút
- Tự động bật lại sau khi hết giờ focus

### 🏖️ Chế độ nghỉ phép *(mới)*
- Đặt ngày bắt đầu & kết thúc nghỉ → app tự dừng hoàn toàn
- Phù hợp khi đi công tác, nghỉ phép dài ngày

### 🎌 Ngày lễ *(mới)*
- Tích hợp sẵn lịch nghỉ lễ Việt Nam 2025–2026
- Tự thêm ngày nghỉ tùy chỉnh (công ty, cá nhân)
- App tự dừng vào ngày lễ, không cần tắt thủ công

### 📅 Tự động dừng khi họp (ICS Calendar)
- Kết nối lịch qua ICS URL — không cần đăng nhập
- Tự động dừng nhắc nhở khi đang trong meeting
- Hỗ trợ Google Calendar, Outlook, Apple Calendar

### 📝 Todo & Báo cáo Telegram *(mới)*
- Quản lý task trong ngày (Chrome Extension)
- Tự động gửi báo cáo tổng kết cuối ngày qua Telegram

### 🍅 Pomodoro Timer
- Chế độ tập trung 25 phút / nghỉ 5 phút
- Tự động đếm số Pomodoro hoàn thành trong ngày

---

## 🚀 Cài đặt & Chạy app

### ✅ Cách đơn giản nhất — Double-click (không cần biết code)

**macOS:**
1. Tải source code về → giải nén
2. Double-click file **`Start_macOS.command`**
3. App tự cài thư viện nếu cần → icon 🏃 xuất hiện trên menu bar

> Lần đầu chạy macOS có thể hỏi permission → click **Open** là được

**Windows:**
1. Tải source code về → giải nén
2. Double-click file **`Start_Windows.bat`**
3. App tự cài thư viện nếu cần → chạy trong Terminal

---

### 🔧 Cách thủ công (cho người dùng Terminal)

**Yêu cầu:** Python 3.6+

**macOS:**
```bash
pip3 install rumps
python3 menubar_app.py
```

**Windows:**
```bash
pip install win10toast
python reminder_pro.py
```

---

## 📖 Hướng dẫn sử dụng

### macOS — Menu Bar App

Sau khi chạy, click vào icon 🏃 trên menu bar để mở:

```
🏃 Menu Bar
├── 🟢 Đang làm việc
├── ⏱️ Nhắc tiếp: 💧 Nước — 12 phút
│
├── ⏸️ Tạm dừng
├── 🎯 Focus Mode          ← Tắt nhắc nhở 15/30/45/60 phút
├── 🍅 Pomodoro
│
├── 💧 Nước: 600/2000ml    ← Water Tracker
│   ├── ✅ Uống 200ml
│   ├── ✏️ Uống lượng khác...
│   └── 🔄 Reset hôm nay
│
├── 📅 Calendar             ← Kết nối lịch họp (ICS)
├── 🏖️ Chế độ nghỉ phép    ← Tạm dừng khi nghỉ/công tác
├── 🎌 Ngày lễ             ← Lịch lễ VN + ngày nghỉ tùy chỉnh
├── 📱 Telegram            ← Nhận báo cáo Todo cuối ngày
├── 📺 YouTube
├── 💪 Bài tập ngay
│
└── ⚙️ Cài đặt
    ├── 📅 Giờ làm việc
    ├── ⏱️ Thời gian nhắc   ← Tùy chỉnh chu kỳ
    ├── 💧 Cài đặt nước     ← Mục tiêu & kích thước ly
    └── 🔄 Đặt lại mặc định
```

---

## 📱 Cài đặt Telegram (Nhận báo cáo Todo)

Tính năng này gửi báo cáo tổng kết Todo cuối ngày vào Telegram của bạn.

### Bước 1 — Tạo Bot Telegram

1. Mở Telegram → tìm **@BotFather**
2. Gửi lệnh `/newbot`
3. Đặt tên bot (ví dụ: `My Health Bot`)
4. Copy **Bot Token** (dạng `123456789:AAHxx...`)

### Bước 2 — Lấy Chat ID của bạn

1. Mở Telegram → tìm **@userinfobot**
2. Gửi bất kỳ tin nhắn nào
3. Bot trả về **ID** của bạn (ví dụ: `123456789`)

### Bước 3 — Nhập vào app

**macOS Menu Bar:**
> Click 🏃 → 📱 Telegram → 🔑 Cài đặt Bot Token → Nhập token + chat ID → OK  
> Bấm **📢 Test gửi tin nhắn** để kiểm tra

**Chrome Extension:**
> ⚙️ Settings → 📱 Telegram Integration → Nhập Bot Token + Chat ID → **Test thông báo** → Save

---

## 📅 Cài đặt Google Calendar (Tự dừng khi họp)

Không cần đăng nhập, chỉ cần copy 1 link ICS.

### Lấy ICS Link

**Google Calendar:**
1. Vào [calendar.google.com](https://calendar.google.com)
2. Click ⚙️ → **Settings**
3. Chọn lịch → kéo xuống **"Secret address in iCal format"**
4. Copy link

**Outlook:** Calendar → Share → Get a link → ICS  
**Apple Calendar:** Right-click tên lịch → Share Calendar → Copy Link

### Nhập vào app

**macOS:**
> Click 🏃 → 📅 Calendar → 🔗 Nhập ICS URL → Paste → OK

**Chrome Extension:**
> ⚙️ Settings → 📅 Google Calendar (ICS) → Paste URL → Tự động sync

---

## 🌐 Chrome Extension

Hoạt động trên cả **macOS và Windows**, không cần cài Python.

### Cài đặt

1. Mở Chrome → vào `chrome://extensions/`
2. Bật **Developer mode** (góc trên phải)
3. Bấm **Load unpacked** → chọn thư mục `chrome-extension/`
4. Icon xuất hiện trên thanh công cụ Chrome ✅

### Các tab trong Extension

| Tab | Chức năng |
|-----|-----------|
| ⏱️ Timer | Countdown nhắc nhở + 💧 Water Tracker |
| 📝 Todo | Quản lý task trong ngày |
| 🎯 Focus | Focus Mode + Pomodoro |
| 📺 YouTube | Điều khiển YouTube đang phát |
| ⚙️ Settings | Giờ làm, Telegram, Water goal, Calendar ICS... |

---

## 🔧 Tùy chỉnh nâng cao

### Chỉnh chu kỳ nhắc nhở

**macOS:** ⚙️ Cài đặt → ⏱️ Thời gian nhắc → Chỉnh từng mục  
**Chrome Extension:** ⚙️ Settings → Intervals

### Chỉnh mục tiêu nước

**macOS:** ⚙️ Cài đặt → 💧 Cài đặt nước → Sửa mục tiêu + kích thước ly  
**Chrome Extension:** ⚙️ Settings → 💧 Water Tracker

### Thêm ngày nghỉ tùy chỉnh

**macOS:** Click 🏃 → 🎌 Ngày lễ → ➕ Thêm ngày nghỉ → Nhập tên + ngày bắt đầu/kết thúc

### Đặt nghỉ phép / công tác

**macOS:** Click 🏃 → 🏖️ Chế độ nghỉ phép → 📅 Đặt ngày nghỉ → Nhập ngày

---

## ❓ Câu hỏi thường gặp

**Q: Double-click `Start_macOS.command` không mở được?**  
→ Right-click → **Open** → chọn Open một lần nữa là được (macOS security)

**Q: App không gửi notification trên macOS?**  
→ System Settings → Notifications → Terminal (hoặc Python) → Bật Allow Notifications

**Q: Chạy app tự động khi bật máy (macOS)?**  
→ System Settings → General → Login Items → Thêm `Start_macOS.command`

**Q: Chrome Extension không load được?**  
→ Đảm bảo đã bật **Developer mode** trong `chrome://extensions/`

**Q: ICS URL không sync được?**  
→ Kiểm tra URL bắt đầu bằng `https://` và máy đang có internet

**Q: Muốn dùng trên cả Mac lẫn Windows?**  
→ Dùng **Chrome Extension** — không cần cài Python, chạy được trên cả 2

---

## 📁 Cấu trúc project

```
WORK-HEALTH-REMINDER-PRO/
│
├── 🖱️  Start_macOS.command    ← Double-click để chạy (macOS)
├── 🖱️  Start_Windows.bat      ← Double-click để chạy (Windows)
│
├── menubar_app.py             ← macOS Menu Bar App (khuyên dùng)
├── reminder_pro.py            ← Terminal PRO version
├── reminder.py                ← Terminal cơ bản
├── reminder_gui.py            ← GUI version
├── exercises.py               ← Module bài tập
├── water_tracker.py           ← Water Tracker module
├── calendar_sync.py           ← ICS Calendar Sync module
│
├── chrome-extension/          ← Chrome Extension (macOS + Windows)
│   ├── manifest.json
│   ├── popup.html
│   ├── popup.js
│   ├── popup.css
│   ├── background.js
│   └── icons/
│
├── index.html                 ← Web version (mở bằng browser)
├── app.js
├── styles.css
└── README.md
```

---

## 🙏 Credits

Built with ❤️ for productivity and health.  
Dựa trên nghiên cứu của Columbia University, WHO, AAO, Cornell University.
