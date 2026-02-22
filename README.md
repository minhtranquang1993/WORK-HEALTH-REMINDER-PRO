# 🏃 Work Health Reminder PRO

> Ứng dụng nhắc nhở sức khỏe thông minh khi làm việc — bảo vệ mắt, nhắc uống nước, tự động dừng khi họp.  
> Hỗ trợ **macOS** và **Windows**. Hoàn toàn offline, không cần tài khoản.

---

## 📋 Mục lục

- [Tính năng](#-tính-năng)
- [Cài đặt](#-cài-đặt)
- [Hướng dẫn sử dụng](#-hướng-dẫn-sử-dụng)
- [Cài đặt Telegram](#-cài-đặt-telegram-nhận-báo-cáo-todo)
- [Cài đặt Google Calendar](#-cài-đặt-google-calendar-tự-dừng-khi-họp)
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

### 📅 Tự động dừng khi họp (Google Calendar / ICS)
- Kết nối lịch qua ICS URL — không cần đăng nhập
- Tự động dừng nhắc nhở khi đang trong meeting
- Hỗ trợ Google Calendar, Outlook, Apple Calendar

### 🍅 Pomodoro Timer
- Chế độ tập trung 25 phút / nghỉ 5 phút
- Tự động đếm số Pomodoro hoàn thành trong ngày

### 📝 Todo & Báo cáo Telegram
- Quản lý task trong ngày
- Tự động gửi báo cáo cuối ngày qua Telegram

### 🎯 Focus Mode
- Tạm dừng toàn bộ nhắc nhở trong X phút (15/30/45/60 phút)

---

## 🚀 Cài đặt

### Yêu cầu

- **Python 3.6+**
- **macOS** hoặc **Windows 10/11**

### Bước 1 — Tải source code

```bash
git clone https://github.com/minhtranquang1993/WORK-HEALTH-REMINDER-PRO.git
cd WORK-HEALTH-REMINDER-PRO
```

> Hoặc tải file ZIP → Giải nén → Mở thư mục vừa giải nén

### Bước 2 — Cài thư viện

**macOS:**
```bash
pip3 install rumps
```

**Windows:**
```bash
pip install win10toast
```

### Bước 3 — Chạy app

**macOS (Menu Bar — khuyên dùng):**
```bash
python3 menubar_app.py
```
→ Icon 🏃 sẽ xuất hiện trên thanh menu phía trên góc phải màn hình.

**Windows (Terminal):**
```bash
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
├── ⏸️ Tạm dừng          ← Dừng tất cả nhắc nhở
├── 🎯 Focus Mode         ← Tập trung không bị làm phiền
├── 🍅 Pomodoro
│
├── 💧 Nước: 600/2000ml   ← Water Tracker
│   ├── ✅ Uống 200ml
│   ├── ✏️ Uống lượng khác...
│   └── 🔄 Reset hôm nay
│
├── 📅 Calendar           ← Kết nối lịch họp
├── 📺 YouTube
├── 💪 Bài tập ngay
├── ⚡ Thao tác nhanh
│
└── ⚙️ Cài đặt
    ├── 📅 Giờ làm việc
    ├── ⏱️ Thời gian nhắc  ← Tùy chỉnh chu kỳ
    ├── 💧 Cài đặt nước    ← Mục tiêu & kích thước ly
    └── 🔄 Đặt lại mặc định
```

### Chrome Extension

1. Mở Chrome → vào `chrome://extensions/`
2. Bật **Developer mode** (góc trên phải)
3. Bấm **Load unpacked** → chọn thư mục `chrome-extension/`
4. Icon extension xuất hiện trên thanh công cụ Chrome
5. Click vào icon để mở popup

**Các tab trong extension:**

| Tab | Chức năng |
|-----|-----------|
| ⏱️ Timer | Xem countdown các nhắc nhở + Water Tracker |
| 📝 Todo | Quản lý task trong ngày |
| 🎯 Focus | Focus Mode + Pomodoro |
| 📺 YouTube | Điều khiển YouTube đang phát |
| ⚙️ Settings | Cài đặt giờ làm, Telegram, Water goal... |

---

## 📱 Cài đặt Telegram (Nhận báo cáo Todo)

Tính năng này giúp app gửi báo cáo tổng kết cuối ngày vào Telegram của bạn.

### Bước 1 — Tạo Bot Telegram

1. Mở Telegram → tìm **@BotFather**
2. Gửi lệnh `/newbot`
3. Đặt tên bot (ví dụ: `My Health Bot`)
4. Copy **Bot Token** (dạng `123456789:AAHxx...`)

### Bước 2 — Lấy Chat ID

1. Mở Telegram → tìm **@userinfobot**
2. Gửi bất kỳ tin nhắn nào
3. Bot sẽ trả về **ID** của bạn (ví dụ: `123456789`)

### Bước 3 — Nhập vào Settings

**Chrome Extension:**
> ⚙️ Settings → 📱 Telegram Integration → Nhập Bot Token + Chat ID → Bấm **Test thông báo** → Save

---

## 📅 Cài đặt Google Calendar (Tự dừng khi họp)

Không cần đăng nhập, chỉ cần copy 1 link ICS.

### Lấy ICS Link

**Google Calendar:**
1. Vào [calendar.google.com](https://calendar.google.com)
2. Click ⚙️ (góc trên phải) → **Settings**
3. Chọn lịch muốn dùng (ví dụ: lịch cá nhân)
4. Kéo xuống phần **"Secret address in iCal format"**
5. Copy link (dạng `https://calendar.google.com/calendar/ical/...`)

**Outlook:**
> Calendar → Share → Get a link → Copy ICS link

**Apple Calendar:**
> Right-click tên lịch → Share Calendar → Copy Link

### Nhập vào App

**macOS Menu Bar:**
> Click icon 🏃 → 📅 Calendar → 🔗 Nhập ICS URL → Paste link → OK

App sẽ tự động:
- ⏸️ Dừng nhắc nhở khi bạn đang trong meeting
- ▶️ Resume lại sau khi meeting kết thúc
- 🔄 Sync lịch mỗi 30 phút (cache local — offline vẫn hoạt động)

---

## 🔧 Tùy chỉnh nâng cao

### Chỉnh chu kỳ nhắc nhở

**macOS:** Click ⚙️ → ⏱️ Thời gian nhắc → Chỉnh từng mục

**Chrome Extension:** ⚙️ Settings → Intervals

**Hoặc sửa trực tiếp trong code** (`menubar_app.py`):
```python
INTERVALS = ReminderInterval(
    walk=30,         # Đi bộ (phút)
    water=45,        # Uống nước (phút)
    eye_20_20_20=20, # 20-20-20 rule (phút)
    blink=15,        # Chớp mắt (phút)
    posture=20,      # Tư thế (phút)
    neck_stretch=30, # Giãn cổ vai (phút)
    eye_exercise=60, # Bài tập mắt (phút)
    breathing=60     # Hít thở (phút)
)
```

### Chỉnh giờ làm việc

**macOS:** Click ⚙️ → 📅 Giờ làm việc → Sửa giờ bắt đầu/kết thúc

### Chỉnh mục tiêu nước

**macOS:** Click ⚙️ → 💧 Cài đặt nước → Sửa mục tiêu (ml) và kích thước ly

**Chrome Extension:** ⚙️ Settings → 💧 Water Tracker

---

## ❓ Câu hỏi thường gặp

**Q: App không gửi notification trên macOS?**  
→ Vào **System Settings > Notifications > Terminal** (hoặc Python) → Bật Allow Notifications

**Q: Chạy app tự động khi bật máy (macOS)?**  
→ System Settings → General → Login Items → Thêm script vào danh sách

**Q: Chrome Extension không load được?**  
→ Đảm bảo đã bật **Developer mode** trong `chrome://extensions/`

**Q: ICS URL không sync được?**  
→ Kiểm tra lại URL có bắt đầu bằng `https://` không, và máy có kết nối internet không

**Q: Muốn dùng trên cả Mac lẫn Windows?**  
→ Dùng **Chrome Extension** — hoạt động trên cả 2 platform, không cần cài thêm gì

---

## 📁 Cấu trúc project

```
WORK-HEALTH-REMINDER-PRO/
├── menubar_app.py          # 🖥️  macOS Menu Bar App (khuyên dùng)
├── reminder_pro.py         # 💻  Terminal PRO version
├── reminder.py             # 📝  Terminal cơ bản
├── reminder_gui.py         # 🪟  GUI version
├── exercises.py            # 💪  Module bài tập
├── water_tracker.py        # 💧  Water Tracker module
├── calendar_sync.py        # 📅  ICS Calendar Sync module
│
├── chrome-extension/       # 🌐  Chrome Extension
│   ├── manifest.json
│   ├── popup.html          #     Giao diện popup
│   ├── popup.js            #     Logic popup
│   ├── popup.css           #     Style
│   ├── background.js       #     Service worker (timers, alarms)
│   └── icons/
│
├── index.html              # 🌍  Web version (mở bằng browser)
├── app.js
├── styles.css
└── README.md
```

---

## 🙏 Credits

Built with ❤️ for productivity and health.  
Dựa trên các nghiên cứu của Columbia University, WHO, AAO, Cornell University.
