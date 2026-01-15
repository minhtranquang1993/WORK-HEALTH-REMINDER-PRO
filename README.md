# 🏃 Work Health Reminder PRO

Ứng dụng nhắc nhở sức khỏe **nâng cao** trong giờ làm việc cho macOS.

## ✨ Tính năng mới v2.0

### 📅 Nhắc nhở cơ bản
| Chu kỳ | Hành động |
|--------|-----------|
| 30 phút | 🚶 Đứng dậy đi bộ |
| 45 phút | 💧 Uống nước lọc |
| 60 phút | 🚽 Đi toilet |
| 11:30 | 🍚 Đi lấy phiếu ăn cơm |
| 13:00 | 💼 Bắt đầu làm việc lại |
| 17:30 | 🏠 Đi về (đón người yêu 💕) |

### 👁️ Bảo vệ mắt (MỚI!)
| Chu kỳ | Hành động |
|--------|-----------|
| 20 phút | 👁️ **20-20-20 Rule** - Nhìn xa 6m trong 20 giây |
| 15 phút | 😊 **Nhắc chớp mắt** - Chớp mắt 15-20 lần |
| 18:00 | 🌙 **Night mode** - Nhắc bật dark mode |

### 🧘 Bài tập & Tư thế (MỚI!)
| Chu kỳ | Hành động |
|--------|-----------|
| 45 phút | 🪑 **Kiểm tra tư thế** ngồi |
| 60 phút | 💆 **Giãn cơ cổ vai** với hướng dẫn chi tiết |
| 90 phút | 👀 **Bài tập mắt** - Xoay mắt, nhìn xa gần |
| 120 phút | 🌬️ **Hít thở sâu** - Thư giãn |

### 📱 Menu Bar App (MỚI!)
- Icon trên menu bar để điều khiển nhanh
- ⏸️ Tạm dừng / ▶️ Tiếp tục
- 💪 Thực hiện bài tập ngay lập tức
- ⚡ Reset timer nhanh
- Hiển thị thời gian đến nhắc nhở tiếp theo

## 🚀 Cách sử dụng

### Phiên bản Menu Bar (Khuyên dùng)
```bash
# Cài đặt rumps (chỉ lần đầu)
pip3 install rumps

# Chạy app
python3 menubar_app.py
```

### Phiên bản Terminal
```bash
# Phiên bản cơ bản
python3 reminder.py

# Phiên bản PRO (terminal)
python3 reminder_pro.py
```

### Chạy nền
```bash
nohup python3 menubar_app.py > reminder.log 2>&1 &
```

## 📁 Cấu trúc file

```
work-health-reminder/
├── menubar_app.py     # 📱 Menu bar app (khuyên dùng)
├── reminder_pro.py    # 🏃 Terminal version PRO
├── reminder.py        # 📝 Terminal version cơ bản
├── exercises.py       # 💪 Module bài tập
└── README.md
```

## 🔧 Tùy chỉnh

Chỉnh sửa các thông số trong file `reminder_pro.py` hoặc `menubar_app.py`:

```python
# Khoảng thời gian nhắc nhở (phút)
INTERVALS = ReminderInterval(
    walk=30,           # Đi bộ
    water=45,          # Uống nước
    toilet=60,         # Toilet
    eye_20_20_20=20,   # 20-20-20 rule
    blink=15,          # Chớp mắt
    posture=45,        # Tư thế
    neck_stretch=60,   # Giãn cổ vai
    eye_exercise=90,   # Bài tập mắt
    breathing=120      # Hít thở
)
```

## 📱 Yêu cầu

- macOS (sử dụng osascript cho notification)
- Python 3.6+
- rumps (cho menu bar app): `pip3 install rumps`

## 💡 Mẹo

- **Menu bar app** tiện lợi hơn, cho phép pause/resume và làm bài tập ngay
- Cho phép Terminal/IDE quyền gửi thông báo trong **System Preferences > Notifications**
- Thêm vào **Login Items** để tự chạy khi khởi động máy

## 🎯 Lợi ích sức khỏe

| Tính năng | Lợi ích |
|-----------|---------|
| 20-20-20 Rule | Giảm mỏi mắt, bảo vệ thị lực |
| Nhắc chớp mắt | Ngăn khô mắt |
| Giãn cổ vai | Giảm đau cổ, vai, lưng |
| Đi bộ | Tăng tuần hoàn máu |
| Uống nước | Duy trì hydrat hóa |
| Hít thở | Giảm stress, tăng tập trung |
