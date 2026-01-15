#!/usr/bin/env python3
"""
Bài tập sức khỏe - Exercise Instructions
=========================================
Các bài tập giãn cơ cổ vai, mắt, và hít thở
"""

# Bài tập giãn cơ cổ
NECK_EXERCISES = """
🧘 BÀI TẬP GIÃN CƠ CỔ (2 phút)

1️⃣ Nghiêng đầu sang trái
   → Giữ 15 giây, hít thở đều

2️⃣ Nghiêng đầu sang phải
   → Giữ 15 giây, hít thở đều

3️⃣ Cúi đầu về phía trước
   → Giữ 15 giây, cảm nhận sau cổ giãn

4️⃣ Ngửa đầu ra sau nhẹ nhàng
   → Giữ 10 giây, không quá căng

5️⃣ Xoay cổ chậm theo vòng tròn
   → 5 vòng theo chiều kim đồng hồ
   → 5 vòng ngược chiều
"""

# Bài tập vai
SHOULDER_EXERCISES = """
💪 BÀI TẬP GIÃN VAI (2 phút)

1️⃣ Nhún vai lên xuống
   → Nâng vai lên cao, giữ 5 giây
   → Thả xuống, lặp 10 lần

2️⃣ Xoay vai
   → 10 vòng ra trước
   → 10 vòng ra sau

3️⃣ Căng tay qua ngực
   → Tay phải đưa qua ngực trái
   → Giữ 15 giây, đổi bên

4️⃣ Chắp tay sau lưng
   → Đan các ngón tay sau lưng
   → Ưỡn ngực, giữ 15 giây
"""

# Bài tập mắt
EYE_EXERCISES = """
👁️ BÀI TẬP MẮT (1-2 phút)

1️⃣ Chớp mắt nhanh
   → Chớp mắt 20 lần liên tục
   → Giúp làm ẩm mắt

2️⃣ Nhìn xa - gần
   → Nhìn vào ngón tay cách 30cm
   → Chuyển sang nhìn vật xa (cửa sổ)
   → Lặp lại 10 lần

3️⃣ Xoay mắt
   → Xoay mắt theo hình số 8
   → 5 lần theo chiều kim đồng hồ
   → 5 lần ngược chiều

4️⃣ Che mắt (Palming)
   → Xoa hai lòng bàn tay cho ấm
   → Áp nhẹ lên mắt đang nhắm
   → Giữ 30 giây, thư giãn
"""

# Bài tập hít thở
BREATHING_EXERCISES = """
🌬️ BÀI TẬP HÍT THỞ (2 phút)

1️⃣ Hít thở 4-7-8
   → Hít vào bằng mũi 4 giây
   → Giữ hơi 7 giây
   → Thở ra bằng miệng 8 giây
   → Lặp lại 4 lần

2️⃣ Hít thở bụng
   → Đặt tay lên bụng
   → Hít vào, bụng phồng lên
   → Thở ra, bụng xẹp xuống
   → Lặp 10 lần, chậm rãi

💡 Tip: Tưởng tượng bạn đang ở nơi
   yên tĩnh, thư thái...
"""

# Quy tắc 20-20-20
RULE_20_20_20 = """
👁️ QUY TẮC 20-20-20

Mỗi 20 phút làm việc máy tính:
→ Nhìn ra xa 20 feet (khoảng 6 mét)
→ Trong 20 giây

🎯 Mục đích:
• Giảm mỏi mắt
• Ngăn ngừa khô mắt
• Bảo vệ thị lực lâu dài

💡 Tip: Nhìn ra cửa sổ hoặc
   vật xa nhất trong phòng!
"""

# Nhắc nhở tư thế
POSTURE_CHECK = """
🪑 KIỂM TRA TƯ THẾ NGỒI

✅ Checklist:
□ Lưng thẳng, tựa vào ghế
□ Vai thả lỏng, không nhún
□ Khuỷu tay vuông 90°
□ Chân chạm đất hoặc có kê chân
□ Màn hình ngang tầm mắt
□ Mắt cách màn hình 50-70cm

⚠️ Tránh:
✗ Cúi đầu về phía trước
✗ Gù lưng
✗ Vắt chân qua nhau lâu
"""

# Nhắc nhở chớp mắt
BLINK_REMINDER = """
😊 NHẮC CHỚP MẮT!

Khi tập trung vào màn hình,
chúng ta thường quên chớp mắt!

→ Chớp mắt 15-20 lần ngay bây giờ
→ Mỗi lần chớp, giữ nhắm 1 giây

💡 Điều này giúp:
• Làm ẩm mắt
• Giảm khô và mỏi mắt
• Bảo vệ giác mạc
"""

# Nhắc đứng dậy nâng cao
STAND_UP_REMINDER = """
🚶 ĐỨNG DẬY ĐI BỘ!

Đã ngồi lâu rồi! Hãy:

1. Đứng dậy, duỗi tay lên cao
2. Đi bộ vài bước (lấy nước, toilet)
3. Hoặc đứng tại chỗ, nhấc gót chân

⏱️ Chỉ cần 2-3 phút!

💡 Lợi ích:
• Tăng lưu thông máu
• Giảm đau lưng, mỏi chân
• Tăng năng suất làm việc
"""

# Tất cả bài tập
ALL_EXERCISES = {
    "neck": {
        "title": "🧘 Bài tập cổ",
        "content": NECK_EXERCISES,
        "duration": "2 phút"
    },
    "shoulder": {
        "title": "💪 Bài tập vai", 
        "content": SHOULDER_EXERCISES,
        "duration": "2 phút"
    },
    "eye": {
        "title": "👁️ Bài tập mắt",
        "content": EYE_EXERCISES,
        "duration": "2 phút"
    },
    "breathing": {
        "title": "🌬️ Hít thở",
        "content": BREATHING_EXERCISES,
        "duration": "2 phút"
    },
    "20_20_20": {
        "title": "👁️ 20-20-20",
        "content": RULE_20_20_20,
        "duration": "20 giây"
    },
    "posture": {
        "title": "🪑 Tư thế",
        "content": POSTURE_CHECK,
        "duration": "30 giây"
    },
    "blink": {
        "title": "😊 Chớp mắt",
        "content": BLINK_REMINDER,
        "duration": "30 giây"
    },
    "stand_up": {
        "title": "🚶 Đứng dậy",
        "content": STAND_UP_REMINDER,
        "duration": "3 phút"
    }
}


def get_exercise(exercise_type: str) -> dict:
    """Lấy thông tin bài tập theo loại"""
    return ALL_EXERCISES.get(exercise_type, ALL_EXERCISES["stand_up"])


def get_all_types() -> list:
    """Lấy danh sách tất cả loại bài tập"""
    return list(ALL_EXERCISES.keys())
