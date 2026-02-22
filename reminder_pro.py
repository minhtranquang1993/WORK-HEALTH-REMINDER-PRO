#!/usr/bin/env python3
"""
Work Health Reminder PRO - Ứng dụng nhắc nhở sức khỏe nâng cao
===============================================================
Tính năng mới:
- Bảo vệ mắt: 20-20-20 rule, nhắc chớp mắt, night mode
- Bài tập: Giãn cơ cổ vai, bài tập mắt, hít thở
- Tư thế: Nhắc kiểm tra tư thế ngồi
- Thông minh: Tạm dừng khi không hoạt động

Giờ làm việc: 8:00 - 17:30
Nghỉ trưa: 11:30 - 13:00

Scientific References:
- AAO 20-20-20 rule (American Academy of Ophthalmology)
- Columbia University: 5-min walk every 30 min
- WHO hydration: drink water every 45-60 min
- Cornell 20-8-2 rule for posture
- Dry eye research: blink reminder every 15 min
- Mindfulness research: breathing exercise every 60 min
- AAO eye exercise: every 60 min
"""

import subprocess
import time
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from typing import Optional, Callable
import sys

from exercises import (
    NECK_EXERCISES, SHOULDER_EXERCISES, EYE_EXERCISES, 
    BREATHING_EXERCISES, RULE_20_20_20, POSTURE_CHECK,
    BLINK_REMINDER, STAND_UP_REMINDER, get_exercise
)

# ============================================
# CẤU HÌNH
# ============================================

@dataclass
class WorkConfig:
    """Cấu hình giờ làm việc"""
    work_start: tuple = (8, 0)
    lunch_start: tuple = (11, 30)
    work_resume: tuple = (13, 0)
    work_end: tuple = (17, 30)
    night_mode_start: tuple = (18, 0)


@dataclass
class ReminderInterval:
    """Cấu hình khoảng thời gian nhắc nhở (phút) - Based on scientific recommendations"""
    # Cơ bản
    walk: int = 30           # Columbia University: 5-min walk every 30 min
    water: int = 45          # WHO hydration: drink water every 45-60 min (updated from 30)
    # toilet removed - no scientific basis for scheduled toilet reminders

    # Bảo vệ mắt
    eye_20_20_20: int = 20   # AAO 20-20-20 rule: every 20 min
    blink: int = 15          # Dry eye research: blink reminder every 15 min (updated from 2)

    # Bài tập & Tư thế
    posture: int = 20        # Cornell 20-8-2 rule: check posture every 20 min
    neck_stretch: int = 30   # Ergonomics: stretch every 20-30 min
    eye_exercise: int = 60   # AAO: eye exercise every 60 min (updated from 90)
    breathing: int = 60      # Mindfulness research: every 60 min (updated from 120)


# Khởi tạo config
CONFIG = WorkConfig()
INTERVALS = ReminderInterval()


# ============================================
# REMINDER TRACKER
# ============================================

@dataclass
class ReminderTracker:
    """Theo dõi thời gian các nhắc nhở"""
    # Cơ bản
    last_walk: Optional[datetime] = None
    last_water: Optional[datetime] = None
    
    # Bảo vệ mắt
    last_eye_20_20_20: Optional[datetime] = None
    last_blink: Optional[datetime] = None
    night_mode_reminded: bool = False
    
    # Bài tập
    last_posture: Optional[datetime] = None
    last_neck_stretch: Optional[datetime] = None
    last_eye_exercise: Optional[datetime] = None
    last_breathing: Optional[datetime] = None
    
    def reset_all(self):
        """Reset tất cả tracker"""
        now = datetime.now()
        self.last_walk = now
        self.last_water = now
        self.last_eye_20_20_20 = now
        self.last_blink = now
        self.last_posture = now
        self.last_neck_stretch = now
        self.last_eye_exercise = now
        self.last_breathing = now
        self.night_mode_reminded = False


tracker = ReminderTracker()


# ============================================
# NOTIFICATION HELPERS
# ============================================

def send_notification(title: str, message: str, sound: bool = True):
    """Gửi thông báo đơn giản trên macOS"""
    sound_cmd = 'sound name "Glass"' if sound else ''
    script = f'''
    display notification "{message}" with title "{title}" {sound_cmd}
    '''
    subprocess.run(['osascript', '-e', script], capture_output=True)
    print(f"🔔 [{datetime.now().strftime('%H:%M:%S')}] {title}: {message}")


def send_detailed_notification(title: str, content: str):
    """Hiển thị dialog với nội dung chi tiết (bài tập)"""
    content_escaped = content.replace('"', '\\"').replace('\n', '\\n')
    
    script = f'''
    display dialog "{content_escaped}" with title "{title}" buttons {{"Đã làm ✓", "Bỏ qua"}} default button 1
    '''
    result = subprocess.run(['osascript', '-e', script], capture_output=True, text=True)
    print(f"📋 [{datetime.now().strftime('%H:%M:%S')}] {title}")
    return "Đã làm" in result.stdout


def send_alert_with_options(title: str, message: str, options: list) -> str:
    """Hiển thị dialog với các lựa chọn"""
    options_str = ', '.join([f'"{opt}"' for opt in options])
    script = f'''
    display dialog "{message}" with title "{title}" buttons {{{options_str}}} default button 1
    '''
    result = subprocess.run(['osascript', '-e', script], capture_output=True, text=True)
    
    output = result.stdout.strip()
    for opt in options:
        if opt in output:
            return opt
    return options[0]


# ============================================
# TIME UTILITIES
# ============================================

def time_to_minutes(hour: int, minute: int) -> int:
    """Chuyển giờ:phút thành số phút trong ngày"""
    return hour * 60 + minute


def get_current_minutes() -> int:
    """Lấy số phút hiện tại trong ngày"""
    now = datetime.now()
    return time_to_minutes(now.hour, now.minute)


def is_work_time() -> bool:
    """Kiểm tra có đang trong giờ làm việc không"""
    current = get_current_minutes()
    work_start = time_to_minutes(*CONFIG.work_start)
    lunch_start = time_to_minutes(*CONFIG.lunch_start)
    work_resume = time_to_minutes(*CONFIG.work_resume)
    work_end = time_to_minutes(*CONFIG.work_end)
    
    morning_work = work_start <= current < lunch_start
    afternoon_work = work_resume <= current < work_end
    
    return morning_work or afternoon_work


def is_lunch_break() -> bool:
    """Kiểm tra có đang nghỉ trưa không"""
    current = get_current_minutes()
    lunch_start = time_to_minutes(*CONFIG.lunch_start)
    work_resume = time_to_minutes(*CONFIG.work_resume)
    return lunch_start <= current < work_resume


def is_after_night_mode_time() -> bool:
    """Kiểm tra đã qua giờ bật night mode chưa"""
    current = get_current_minutes()
    night_start = time_to_minutes(*CONFIG.night_mode_start)
    return current >= night_start


def minutes_since(last_time: Optional[datetime]) -> float:
    """Tính số phút kể từ thời điểm đã cho"""
    if last_time is None:
        return float('inf')
    return (datetime.now() - last_time).total_seconds() / 60


# ============================================
# REMINDER CHECKS
# ============================================

def check_special_times():
    """Kiểm tra các mốc thời gian đặc biệt"""
    now = datetime.now()
    current_time = (now.hour, now.minute)
    
    # 11:30 - Đi lấy phiếu cơm
    if current_time == CONFIG.lunch_start:
        send_notification(
            "🍚 Giờ ăn trưa!", 
            "Đi lấy phiếu ăn cơm thôi! Nghỉ trưa đến 13:00 nhé.",
            sound=True
        )
        return True
    
    # 13:00 - Bắt đầu làm việc lại
    if current_time == CONFIG.work_resume:
        send_notification(
            "💼 Hết giờ nghỉ trưa!", 
            "Bắt đầu làm việc lại thôi nào! Fighting! 💪",
            sound=True
        )
        tracker.reset_all()
        return True
    
    # 17:30 - Đi về
    if current_time == CONFIG.work_end:
        choice = send_alert_with_options(
            "🏠 Hết giờ làm việc!",
            "Đã đến 17:30 rồi! Bạn muốn:",
            ["Đón người yêu 💕", "Về nhà 🏠"]
        )
        
        if "Đón người yêu" in choice:
            send_notification(
                "💕 Đón người yêu", 
                "Đi đón người yêu thôi! Chúc hẹn hò vui vẻ! 🥰",
                sound=True
            )
        else:
            send_notification(
                "🏠 Về nhà", 
                "Đi về nhà thôi! Nghỉ ngơi và thư giãn nhé! 😊",
                sound=True
            )
        return True
    
    return False


def check_night_mode():
    """Kiểm tra và nhắc bật night mode"""
    global tracker
    
    if is_after_night_mode_time() and not tracker.night_mode_reminded:
        send_notification(
            "🌙 Bật Night Mode!", 
            "Đã 18:00 rồi! Bật Night Shift/Dark Mode để bảo vệ mắt nhé!",
            sound=True
        )
        tracker.night_mode_reminded = True
        return True
    return False


def check_basic_reminders():
    """Kiểm tra các nhắc nhở cơ bản"""
    global tracker
    
    if not is_work_time():
        return
    
    now = datetime.now()
    
    # Đứng dậy đi bộ (30 phút) - Columbia University
    if minutes_since(tracker.last_walk) >= INTERVALS.walk:
        send_notification(
            "🚶 Đứng dậy đi bộ!", 
            "Đã ngồi 30 phút rồi! Đứng dậy đi bộ vài bước nhé!",
            sound=True
        )
        tracker.last_walk = now
    
    # Uống nước (45 phút) - WHO hydration guidelines
    if minutes_since(tracker.last_water) >= INTERVALS.water:
        send_notification(
            "💧 Uống nước!", 
            "Đã 45 phút rồi! Uống một ly nước lọc nhé!",
            sound=True
        )
        tracker.last_water = now

    # Note: toilet reminder removed - no scientific basis for scheduled toilet reminders


def check_eye_protection():
    """Kiểm tra nhắc nhở bảo vệ mắt"""
    global tracker
    
    if not is_work_time():
        return
    
    now = datetime.now()
    
    # 20-20-20 Rule (20 phút) - AAO
    if minutes_since(tracker.last_eye_20_20_20) >= INTERVALS.eye_20_20_20:
        send_notification(
            "👁️ Quy tắc 20-20-20!", 
            "Nhìn ra xa 6 mét trong 20 giây để bảo vệ mắt!",
            sound=True
        )
        tracker.last_eye_20_20_20 = now
    
    # Nhắc chớp mắt (15 phút) - Dry eye research
    if minutes_since(tracker.last_blink) >= INTERVALS.blink:
        send_notification(
            "😊 Chớp mắt!", 
            "Nhớ chớp mắt thường xuyên! Chớp 15-20 lần ngay nhé!",
            sound=True
        )
        tracker.last_blink = now


def check_exercise_reminders():
    """Kiểm tra nhắc nhở bài tập"""
    global tracker
    
    if not is_work_time():
        return
    
    now = datetime.now()
    
    # Tư thế ngồi (20 phút) - Cornell 20-8-2
    if minutes_since(tracker.last_posture) >= INTERVALS.posture:
        send_detailed_notification(
            "🪑 Kiểm tra tư thế ngồi",
            POSTURE_CHECK
        )
        tracker.last_posture = now
    
    # Giãn cơ cổ vai (30 phút) - Ergonomics
    if minutes_since(tracker.last_neck_stretch) >= INTERVALS.neck_stretch:
        send_detailed_notification(
            "🧘 Giãn cơ cổ vai",
            NECK_EXERCISES + "\n\n" + SHOULDER_EXERCISES
        )
        tracker.last_neck_stretch = now
    
    # Bài tập mắt (60 phút) - AAO guidelines
    if minutes_since(tracker.last_eye_exercise) >= INTERVALS.eye_exercise:
        send_detailed_notification(
            "👁️ Bài tập mắt",
            EYE_EXERCISES
        )
        tracker.last_eye_exercise = now
    
    # Hít thở (60 phút) - Mindfulness research
    if minutes_since(tracker.last_breathing) >= INTERVALS.breathing:
        send_detailed_notification(
            "🌬️ Hít thở sâu",
            BREATHING_EXERCISES
        )
        tracker.last_breathing = now


# ============================================
# STATUS & INFO
# ============================================

def get_next_reminders() -> dict:
    """Lấy thời gian đến các nhắc nhở tiếp theo"""
    reminders = {}
    
    if tracker.last_walk:
        next_walk = INTERVALS.walk - minutes_since(tracker.last_walk)
        reminders["🚶 Đi bộ"] = max(0, round(next_walk))
    
    if tracker.last_water:
        next_water = INTERVALS.water - minutes_since(tracker.last_water)
        reminders["💧 Uống nước"] = max(0, round(next_water))
    
    if tracker.last_eye_20_20_20:
        next_eye = INTERVALS.eye_20_20_20 - minutes_since(tracker.last_eye_20_20_20)
        reminders["👁️ 20-20-20"] = max(0, round(next_eye))
    
    if tracker.last_neck_stretch:
        next_stretch = INTERVALS.neck_stretch - minutes_since(tracker.last_neck_stretch)
        reminders["🧘 Giãn cơ"] = max(0, round(next_stretch))
    
    return reminders


def print_status():
    """In trạng thái hiện tại"""
    now = datetime.now()
    current_time = now.strftime("%H:%M:%S")
    
    if is_work_time():
        status = "🟢 Đang làm việc"
    elif is_lunch_break():
        status = "🍚 Đang nghỉ trưa"
    else:
        status = "⚪ Ngoài giờ làm việc"
    
    print(f"\r[{current_time}] {status}", end="", flush=True)


def print_banner():
    """In banner khởi động"""
    print("""
╔══════════════════════════════════════════════════════════════════╗
║      🏃 WORK HEALTH REMINDER PRO - Nhắc nhở sức khỏe 2.1         ║
╠══════════════════════════════════════════════════════════════════╣
║  Giờ làm việc: 8:00 - 17:30  |  Nghỉ trưa: 11:30 - 13:00         ║
╠══════════════════════════════════════════════════════════════════╣
║  📅 Nhắc nhở cơ bản (dựa trên nghiên cứu khoa học):              ║
║  • 30 phút → Đi bộ 🚶 (Columbia Univ.)                           ║
║  • 45 phút → Uống nước 💧 (WHO guideline)                         ║
║  • 11:30/17:30 → Ăn/Về 🍚🏠                                       ║
╠══════════════════════════════════════════════════════════════════╣
║  👁️ Bảo vệ mắt:                                                  ║
║  • 20 phút → 20-20-20 rule (AAO)                                  ║
║  • 15 phút → Nhắc chớp mắt (Dry eye research)                     ║
║  • 18:00 → Night mode 🌙                                         ║
╠══════════════════════════════════════════════════════════════════╣
║  🧘 Bài tập (tối ưu theo khoa học):                              ║
║  • 20 phút → Tư thế 🪑 (Cornell 20-8-2)                           ║
║  • 30 phút → Giãn cổ vai 💆                                       ║
║  • 60 phút → Bài tập mắt 👀 (AAO)                                 ║
║  • 60 phút → Hít thở 🌬️ (Mindfulness research)                    ║
╚══════════════════════════════════════════════════════════════════╝
    """)


# ============================================
# MAIN
# ============================================

def main():
    """Chương trình chính"""
    print_banner()
    
    print("🚀 Ứng dụng đang chạy... Nhấn Ctrl+C để thoát.\n")
    
    # Gửi thông báo bắt đầu
    send_notification(
        "✅ Health Reminder PRO", 
        "Ứng dụng nâng cao đã bắt đầu! Bảo vệ mắt + Bài tập đầy đủ!",
        sound=True
    )
    
    # Reset tracker khi bắt đầu
    if is_work_time():
        tracker.reset_all()
    
    last_minute = -1
    was_working = False
    
    try:
        while True:
            now = datetime.now()
            current_minute = now.minute
            
            # Chỉ kiểm tra mỗi phút một lần
            if current_minute != last_minute:
                last_minute = current_minute
                
                # Reset khi vừa bắt đầu làm việc
                if is_work_time() and not was_working:
                    tracker.reset_all()
                    was_working = True
                elif not is_work_time():
                    was_working = False
                
                # Các kiểm tra theo thứ tự ưu tiên
                check_special_times()
                check_night_mode()
                check_eye_protection()
                check_basic_reminders()
                check_exercise_reminders()
            
            # In trạng thái
            print_status()
            
            # Đợi 1 giây
            time.sleep(1)
            
    except KeyboardInterrupt:
        print("\n\n👋 Tạm biệt! Hẹn gặp lại ngày mai!")
        send_notification(
            "👋 Health Reminder PRO", 
            "Ứng dụng đã dừng. Nhớ nghỉ ngơi và chăm sóc sức khỏe nhé!",
            sound=False
        )
        sys.exit(0)


if __name__ == "__main__":
    main()
