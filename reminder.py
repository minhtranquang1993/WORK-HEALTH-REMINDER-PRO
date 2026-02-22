#!/usr/bin/env python3
"""
Work Health Reminder - Ứng dụng nhắc nhở sức khỏe trong giờ làm việc
====================================================================
Tính năng:
- Mỗi 30 phút: Đứng dậy đi bộ
- Mỗi 45 phút: Uống nước (updated from 45 per WHO guideline)
- 11:30: Đi lấy phiếu cơm
- 13:00: Bắt đầu làm việc lại
- 17:30: Đi về (có option đón người yêu hoặc về nhà)

Giờ làm việc: 8:00 - 17:30
Nghỉ trưa: 11:30 - 13:00

Scientific References:
- Columbia University: 5-min walk every 30 min
- WHO hydration guidelines: drink water every 45-60 min
"""

import subprocess
import time
from datetime import datetime, timedelta
import threading
import sys

# Cấu hình thời gian
WORK_START = (8, 0)      # 8:00
LUNCH_START = (11, 30)   # 11:30 - Nghỉ trưa
WORK_RESUME = (13, 0)    # 13:00 - Làm việc lại
WORK_END = (17, 30)      # 17:30

# Khoảng thời gian nhắc nhở (phút) - Based on scientific recommendations
WALK_INTERVAL = 30       # Columbia University: 5-min walk every 30 min
WATER_INTERVAL = 45      # WHO hydration: drink water every 45-60 min (updated from 30)
# TOILET_INTERVAL removed - no scientific basis for scheduled toilet reminders

# Biến theo dõi thời gian
last_walk_reminder = None
last_water_reminder = None


def send_notification(title: str, message: str, sound: bool = True):
    """Gửi thông báo trên macOS"""
    sound_cmd = 'sound name "Glass"' if sound else ''
    script = f'''
    display notification "{message}" with title "{title}" {sound_cmd}
    '''
    subprocess.run(['osascript', '-e', script], capture_output=True)
    print(f"🔔 [{datetime.now().strftime('%H:%M:%S')}] {title}: {message}")


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
    work_start = time_to_minutes(*WORK_START)
    lunch_start = time_to_minutes(*LUNCH_START)
    work_resume = time_to_minutes(*WORK_RESUME)
    work_end = time_to_minutes(*WORK_END)
    
    # Buổi sáng: 8:00 - 11:30
    morning_work = work_start <= current < lunch_start
    # Buổi chiều: 13:00 - 17:30
    afternoon_work = work_resume <= current < work_end
    
    return morning_work or afternoon_work


def is_lunch_break() -> bool:
    """Kiểm tra có đang nghỉ trưa không"""
    current = get_current_minutes()
    lunch_start = time_to_minutes(*LUNCH_START)
    work_resume = time_to_minutes(*WORK_RESUME)
    return lunch_start <= current < work_resume


def check_special_times():
    """Kiểm tra các mốc thời gian đặc biệt"""
    now = datetime.now()
    current_time = (now.hour, now.minute)
    
    # 11:30 - Đi lấy phiếu cơm
    if current_time == LUNCH_START:
        send_notification(
            "🍚 Giờ ăn trưa!", 
            "Đi lấy phiếu ăn cơm thôi! Nghỉ trưa đến 13:00 nhé.",
            sound=True
        )
        return True
    
    # 13:00 - Bắt đầu làm việc lại
    if current_time == WORK_RESUME:
        send_notification(
            "💼 Hết giờ nghỉ trưa!", 
            "Bắt đầu làm việc lại thôi nào! Fighting! 💪",
            sound=True
        )
        return True
    
    # 17:30 - Đi về
    if current_time == WORK_END:
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


def check_interval_reminders():
    """Kiểm tra các nhắc nhở theo chu kỳ"""
    global last_walk_reminder, last_water_reminder
    
    if not is_work_time():
        return
    
    now = datetime.now()
    
    # Khởi tạo thời gian lần đầu
    if last_walk_reminder is None:
        last_walk_reminder = now
    if last_water_reminder is None:
        last_water_reminder = now
    
    # Kiểm tra nhắc đứng dậy đi bộ (30 phút) - Columbia University
    if (now - last_walk_reminder).total_seconds() >= WALK_INTERVAL * 60:
        send_notification(
            "🚶 Đứng dậy đi bộ!", 
            "Đã ngồi 30 phút rồi! Đứng dậy đi bộ vài bước nhé!",
            sound=True
        )
        last_walk_reminder = now
    
    # Kiểm tra nhắc uống nước (45 phút) - WHO hydration guidelines
    if (now - last_water_reminder).total_seconds() >= WATER_INTERVAL * 60:
        send_notification(
            "💧 Uống nước!", 
            "Đã 45 phút rồi! Uống một ly nước lọc nhé!",
            sound=True
        )
        last_water_reminder = now


def reset_timers():
    """Reset các timer khi bắt đầu làm việc"""
    global last_walk_reminder, last_water_reminder
    now = datetime.now()
    last_walk_reminder = now
    last_water_reminder = now


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


def main():
    """Chương trình chính"""
    print("""
╔══════════════════════════════════════════════════════════════╗
║           🏃 WORK HEALTH REMINDER - Nhắc nhở sức khỏe v2.1   ║
╠══════════════════════════════════════════════════════════════╣
║  Giờ làm việc: 8:00 - 17:30                                  ║
║  Nghỉ trưa:    11:30 - 13:00                                 ║
╠══════════════════════════════════════════════════════════════╣
║  📅 Lịch nhắc nhở (chuẩn khoa học):                          ║
║  • Mỗi 30 phút → Đứng dậy đi bộ 🚶 (Columbia Univ.)          ║
║  • Mỗi 45 phút → Uống nước 💧 (WHO guideline)                 ║
║  • 11:30       → Lấy phiếu cơm 🍚                            ║
║  • 17:30       → Đi về 🏠 (có option đón người yêu 💕)       ║
╚══════════════════════════════════════════════════════════════╝
    """)
    
    print("🚀 Ứng dụng đang chạy... Nhấn Ctrl+C để thoát.\n")
    
    # Gửi thông báo bắt đầu
    send_notification(
        "✅ Work Health Reminder", 
        "Ứng dụng đã bắt đầu chạy! Chúc bạn một ngày làm việc hiệu quả!",
        sound=True
    )
    
    # Reset timer khi bắt đầu
    if is_work_time():
        reset_timers()
    
    last_minute = -1
    was_working = False
    
    try:
        while True:
            now = datetime.now()
            current_minute = now.minute
            
            # Chỉ kiểm tra mỗi phút một lần
            if current_minute != last_minute:
                last_minute = current_minute
                
                # Kiểm tra xem vừa bắt đầu làm việc chưa
                if is_work_time() and not was_working:
                    reset_timers()
                    was_working = True
                elif not is_work_time():
                    was_working = False
                
                # Kiểm tra các mốc thời gian đặc biệt
                check_special_times()
                
                # Kiểm tra các nhắc nhở theo chu kỳ
                check_interval_reminders()
            
            # In trạng thái
            print_status()
            
            # Đợi 1 giây
            time.sleep(1)
            
    except KeyboardInterrupt:
        print("\n\n👋 Tạm biệt! Hẹn gặp lại ngày mai!")
        send_notification(
            "👋 Work Health Reminder", 
            "Ứng dụng đã dừng. Hẹn gặp lại!",
            sound=False
        )
        sys.exit(0)


if __name__ == "__main__":
    main()
