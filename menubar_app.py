#!/usr/bin/env python3
"""
Work Health Reminder - Menu Bar App
====================================
Ứng dụng menu bar cho macOS sử dụng rumps.
Cho phép điều khiển nhanh các tính năng nhắc nhở.

Cài đặt: pip3 install rumps
"""

import subprocess
import threading
import time
from datetime import datetime
from dataclasses import dataclass
from typing import Optional
import sys

try:
    import rumps
except ImportError:
    print("❌ Cần cài đặt rumps: pip3 install rumps")
    print("   Đang cài đặt tự động...")
    subprocess.run([sys.executable, "-m", "pip", "install", "rumps"], check=True)
    import rumps

from exercises import (
    NECK_EXERCISES, SHOULDER_EXERCISES, EYE_EXERCISES, 
    BREATHING_EXERCISES, POSTURE_CHECK, RULE_20_20_20
)


# ============================================
# CẤU HÌNH
# ============================================

@dataclass
class WorkConfig:
    work_start: tuple = (8, 0)
    lunch_start: tuple = (11, 30)
    work_resume: tuple = (13, 0)
    work_end: tuple = (17, 30)
    night_mode_start: tuple = (18, 0)


@dataclass
class ReminderInterval:
    walk: int = 30
    water: int = 45
    toilet: int = 60
    eye_20_20_20: int = 20
    blink: int = 15
    posture: int = 45
    neck_stretch: int = 60
    eye_exercise: int = 90
    breathing: int = 120


CONFIG = WorkConfig()
INTERVALS = ReminderInterval()


# ============================================
# TRACKER
# ============================================

class ReminderTracker:
    def __init__(self):
        self.reset_all()
        self.is_paused = False
        self.night_mode_reminded = False
    
    def reset_all(self):
        now = datetime.now()
        self.last_walk = now
        self.last_water = now
        self.last_toilet = now
        self.last_eye_20_20_20 = now
        self.last_blink = now
        self.last_posture = now
        self.last_neck_stretch = now
        self.last_eye_exercise = now
        self.last_breathing = now
        self.night_mode_reminded = False


tracker = ReminderTracker()


# ============================================
# HELPERS
# ============================================

def time_to_minutes(hour: int, minute: int) -> int:
    return hour * 60 + minute


def get_current_minutes() -> int:
    now = datetime.now()
    return time_to_minutes(now.hour, now.minute)


def is_work_time() -> bool:
    current = get_current_minutes()
    work_start = time_to_minutes(*CONFIG.work_start)
    lunch_start = time_to_minutes(*CONFIG.lunch_start)
    work_resume = time_to_minutes(*CONFIG.work_resume)
    work_end = time_to_minutes(*CONFIG.work_end)
    
    morning_work = work_start <= current < lunch_start
    afternoon_work = work_resume <= current < work_end
    return morning_work or afternoon_work


def is_lunch_break() -> bool:
    current = get_current_minutes()
    lunch_start = time_to_minutes(*CONFIG.lunch_start)
    work_resume = time_to_minutes(*CONFIG.work_resume)
    return lunch_start <= current < work_resume


def minutes_since(last_time: Optional[datetime]) -> float:
    if last_time is None:
        return float('inf')
    return (datetime.now() - last_time).total_seconds() / 60


def send_notification(title: str, message: str, sound: bool = True):
    """Gửi thông báo macOS"""
    sound_cmd = 'sound name "Glass"' if sound else ''
    script = f'''
    display notification "{message}" with title "{title}" {sound_cmd}
    '''
    subprocess.run(['osascript', '-e', script], capture_output=True)


def send_exercise_dialog(title: str, content: str):
    """Hiển thị dialog bài tập"""
    content_escaped = content.replace('"', '\\"').replace('\n', '\\n')
    script = f'''
    display dialog "{content_escaped}" with title "{title}" buttons {{"Đã làm ✓", "Bỏ qua"}} default button 1
    '''
    subprocess.run(['osascript', '-e', script], capture_output=True)


def send_alert_with_options(title: str, message: str, options: list) -> str:
    """Hiển thị dialog với lựa chọn"""
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
# MENU BAR APP
# ============================================

class HealthReminderApp(rumps.App):
    def __init__(self):
        super(HealthReminderApp, self).__init__(
            name="Health Reminder",
            title="🏃",
            quit_button=None
        )
        
        self.tracker = tracker
        self.is_running = True
        
        # Menu items
        self.status_item = rumps.MenuItem("🟢 Đang hoạt động")
        self.next_reminder = rumps.MenuItem("⏱️ Nhắc tiếp: --")
        
        self.pause_item = rumps.MenuItem("⏸️ Tạm dừng")
        self.resume_item = rumps.MenuItem("▶️ Tiếp tục")
        self.resume_item.hidden = True
        
        # Exercise submenu
        self.exercise_menu = rumps.MenuItem("💪 Bài tập ngay")
        self.exercise_menu.add(rumps.MenuItem("🧘 Giãn cổ vai", callback=self.do_neck_stretch))
        self.exercise_menu.add(rumps.MenuItem("👁️ Bài tập mắt", callback=self.do_eye_exercise))
        self.exercise_menu.add(rumps.MenuItem("🌬️ Hít thở", callback=self.do_breathing))
        self.exercise_menu.add(rumps.MenuItem("🪑 Check tư thế", callback=self.do_posture_check))
        
        # Quick actions
        self.quick_menu = rumps.MenuItem("⚡ Thao tác nhanh")
        self.quick_menu.add(rumps.MenuItem("💧 Đã uống nước", callback=self.reset_water))
        self.quick_menu.add(rumps.MenuItem("🚶 Đã đi bộ", callback=self.reset_walk))
        self.quick_menu.add(rumps.MenuItem("👁️ Đã nhìn xa", callback=self.reset_eye))
        self.quick_menu.add(rumps.MenuItem("🔄 Reset tất cả", callback=self.reset_all_timers))
        
        # Settings
        self.settings_menu = rumps.MenuItem("⚙️ Cài đặt")
        self.settings_menu.add(rumps.MenuItem("📅 Giờ làm việc: 8:00-17:30"))
        self.settings_menu.add(rumps.MenuItem("☀️ Nghỉ trưa: 11:30-13:00"))
        self.settings_menu.add(None)  # Separator
        self.settings_menu.add(rumps.MenuItem("ℹ️ Phiên bản 2.0 PRO"))
        
        # Build menu
        self.menu = [
            self.status_item,
            self.next_reminder,
            None,  # Separator
            self.pause_item,
            self.resume_item,
            None,
            self.exercise_menu,
            self.quick_menu,
            None,
            self.settings_menu,
            None,
            rumps.MenuItem("❌ Thoát", callback=self.quit_app)
        ]
        
        # Start reminder thread
        self.reminder_thread = threading.Thread(target=self.reminder_loop, daemon=True)
        self.reminder_thread.start()
        
        # Update status timer
        self.update_timer = rumps.Timer(self.update_status, 10)
        self.update_timer.start()
    
    def update_status(self, _):
        """Cập nhật trạng thái trên menu"""
        if self.tracker.is_paused:
            self.status_item.title = "⏸️ Đã tạm dừng"
            self.title = "⏸️"
        elif is_work_time():
            self.status_item.title = "🟢 Đang làm việc"
            self.title = "🏃"
        elif is_lunch_break():
            self.status_item.title = "🍚 Nghỉ trưa"
            self.title = "🍚"
        else:
            self.status_item.title = "🌙 Ngoài giờ làm"
            self.title = "🌙"
        
        # Update next reminder
        if not self.tracker.is_paused and is_work_time():
            next_times = self.get_next_reminders()
            if next_times:
                soonest = min(next_times.items(), key=lambda x: x[1])
                self.next_reminder.title = f"⏱️ {soonest[0]}: {soonest[1]} phút"
            else:
                self.next_reminder.title = "⏱️ Nhắc tiếp: --"
        else:
            self.next_reminder.title = "⏱️ Nhắc tiếp: --"
    
    def get_next_reminders(self) -> dict:
        """Lấy thời gian đến nhắc nhở tiếp theo"""
        reminders = {}
        
        next_walk = INTERVALS.walk - minutes_since(self.tracker.last_walk)
        if next_walk > 0:
            reminders["🚶 Đi bộ"] = round(next_walk)
        
        next_water = INTERVALS.water - minutes_since(self.tracker.last_water)
        if next_water > 0:
            reminders["💧 Nước"] = round(next_water)
        
        next_eye = INTERVALS.eye_20_20_20 - minutes_since(self.tracker.last_eye_20_20_20)
        if next_eye > 0:
            reminders["👁️ 20-20-20"] = round(next_eye)
        
        return reminders
    
    @rumps.clicked("⏸️ Tạm dừng")
    def pause_reminders(self, _):
        """Tạm dừng tất cả nhắc nhở"""
        self.tracker.is_paused = True
        self.pause_item.hidden = True
        self.resume_item.hidden = False
        send_notification("⏸️ Đã tạm dừng", "Nhắc nhở đã tạm dừng. Nhớ tiếp tục nhé!")
    
    @rumps.clicked("▶️ Tiếp tục")
    def resume_reminders(self, _):
        """Tiếp tục nhắc nhở"""
        self.tracker.is_paused = False
        self.pause_item.hidden = False
        self.resume_item.hidden = True
        self.tracker.reset_all()
        send_notification("▶️ Tiếp tục", "Đã tiếp tục nhắc nhở. Chăm sóc sức khỏe nhé!")
    
    def do_neck_stretch(self, _):
        """Hiển thị bài tập cổ vai"""
        send_exercise_dialog("🧘 Giãn cổ vai", NECK_EXERCISES + "\n\n" + SHOULDER_EXERCISES)
        self.tracker.last_neck_stretch = datetime.now()
    
    def do_eye_exercise(self, _):
        """Hiển thị bài tập mắt"""
        send_exercise_dialog("👁️ Bài tập mắt", EYE_EXERCISES)
        self.tracker.last_eye_exercise = datetime.now()
    
    def do_breathing(self, _):
        """Hiển thị bài tập hít thở"""
        send_exercise_dialog("🌬️ Hít thở", BREATHING_EXERCISES)
        self.tracker.last_breathing = datetime.now()
    
    def do_posture_check(self, _):
        """Hiển thị kiểm tra tư thế"""
        send_exercise_dialog("🪑 Kiểm tra tư thế", POSTURE_CHECK)
        self.tracker.last_posture = datetime.now()
    
    def reset_water(self, _):
        """Reset timer uống nước"""
        self.tracker.last_water = datetime.now()
        send_notification("💧 Đã ghi nhận", f"Timer uống nước đã reset. Nhắc lại sau {INTERVALS.water} phút.")
    
    def reset_walk(self, _):
        """Reset timer đi bộ"""
        self.tracker.last_walk = datetime.now()
        send_notification("🚶 Đã ghi nhận", f"Timer đi bộ đã reset. Nhắc lại sau {INTERVALS.walk} phút.")
    
    def reset_eye(self, _):
        """Reset timer 20-20-20"""
        self.tracker.last_eye_20_20_20 = datetime.now()
        send_notification("👁️ Đã ghi nhận", f"Timer 20-20-20 đã reset. Nhắc lại sau {INTERVALS.eye_20_20_20} phút.")
    
    def reset_all_timers(self, _):
        """Reset tất cả timer"""
        self.tracker.reset_all()
        send_notification("🔄 Đã reset tất cả", "Tất cả timer đã được reset từ đầu.")
    
    def quit_app(self, _):
        """Thoát ứng dụng"""
        send_notification("👋 Tạm biệt", "Health Reminder đã dừng. Nhớ chăm sóc sức khỏe nhé!")
        self.is_running = False
        rumps.quit_application()
    
    def reminder_loop(self):
        """Thread chạy kiểm tra nhắc nhở"""
        last_minute = -1
        was_working = False
        
        while self.is_running:
            try:
                if self.tracker.is_paused:
                    time.sleep(5)
                    continue
                
                now = datetime.now()
                current_minute = now.minute
                
                if current_minute != last_minute:
                    last_minute = current_minute
                    
                    # Reset khi bắt đầu làm việc
                    if is_work_time() and not was_working:
                        self.tracker.reset_all()
                        was_working = True
                    elif not is_work_time():
                        was_working = False
                    
                    # Kiểm tra các mốc đặc biệt
                    self.check_special_times(now)
                    
                    # Kiểm tra nhắc nhở
                    if is_work_time():
                        self.check_eye_protection()
                        self.check_basic_reminders()
                        self.check_exercise_reminders()
                
                time.sleep(5)
                
            except Exception as e:
                print(f"Error in reminder loop: {e}")
                time.sleep(10)
    
    def check_special_times(self, now):
        """Kiểm tra các mốc thời gian đặc biệt"""
        current_time = (now.hour, now.minute)
        
        if current_time == CONFIG.lunch_start:
            send_notification("🍚 Giờ ăn trưa!", "Đi lấy phiếu ăn cơm thôi!")
        
        if current_time == CONFIG.work_resume:
            send_notification("💼 Hết nghỉ trưa!", "Bắt đầu làm việc lại! Fighting! 💪")
            self.tracker.reset_all()
        
        if current_time == CONFIG.work_end:
            choice = send_alert_with_options(
                "🏠 Hết giờ làm!",
                "Đã 17:30! Bạn muốn:",
                ["Đón người yêu 💕", "Về nhà 🏠"]
            )
            if "Đón người yêu" in choice:
                send_notification("💕 Đón người yêu", "Đi đón người yêu thôi! 🥰")
            else:
                send_notification("🏠 Về nhà", "Đi về nhà nghỉ ngơi nhé! 😊")
        
        # Night mode reminder (18:00)
        if current_time == CONFIG.night_mode_start and not self.tracker.night_mode_reminded:
            send_notification("🌙 Bật Night Mode!", "Bật Night Shift/Dark Mode để bảo vệ mắt!")
            self.tracker.night_mode_reminded = True
    
    def check_eye_protection(self):
        """Kiểm tra nhắc bảo vệ mắt"""
        now = datetime.now()
        
        if minutes_since(self.tracker.last_eye_20_20_20) >= INTERVALS.eye_20_20_20:
            send_notification("👁️ 20-20-20!", "Nhìn xa 6m trong 20 giây!")
            self.tracker.last_eye_20_20_20 = now
        
        if minutes_since(self.tracker.last_blink) >= INTERVALS.blink:
            send_notification("😊 Chớp mắt!", "Chớp mắt 15-20 lần để làm ẩm mắt!")
            self.tracker.last_blink = now
    
    def check_basic_reminders(self):
        """Kiểm tra nhắc cơ bản"""
        now = datetime.now()
        
        if minutes_since(self.tracker.last_walk) >= INTERVALS.walk:
            send_notification("🚶 Đứng dậy!", "Đi bộ vài bước nhé!")
            self.tracker.last_walk = now
        
        if minutes_since(self.tracker.last_water) >= INTERVALS.water:
            send_notification("💧 Uống nước!", "Uống một ly nước lọc nhé!")
            self.tracker.last_water = now
        
        if minutes_since(self.tracker.last_toilet) >= INTERVALS.toilet:
            send_notification("🚽 Đi toilet!", "Đi toilet một chút nhé!")
            self.tracker.last_toilet = now
    
    def check_exercise_reminders(self):
        """Kiểm tra nhắc bài tập"""
        now = datetime.now()
        
        if minutes_since(self.tracker.last_posture) >= INTERVALS.posture:
            send_exercise_dialog("🪑 Kiểm tra tư thế", POSTURE_CHECK)
            self.tracker.last_posture = now
        
        if minutes_since(self.tracker.last_neck_stretch) >= INTERVALS.neck_stretch:
            send_exercise_dialog("🧘 Giãn cổ vai", NECK_EXERCISES + "\n\n" + SHOULDER_EXERCISES)
            self.tracker.last_neck_stretch = now
        
        if minutes_since(self.tracker.last_eye_exercise) >= INTERVALS.eye_exercise:
            send_exercise_dialog("👁️ Bài tập mắt", EYE_EXERCISES)
            self.tracker.last_eye_exercise = now
        
        if minutes_since(self.tracker.last_breathing) >= INTERVALS.breathing:
            send_exercise_dialog("🌬️ Hít thở", BREATHING_EXERCISES)
            self.tracker.last_breathing = now


def main():
    print("""
╔══════════════════════════════════════════════════════════════════╗
║        🏃 WORK HEALTH REMINDER PRO - Menu Bar Edition            ║
╠══════════════════════════════════════════════════════════════════╣
║  Ứng dụng đang chạy trên menu bar!                               ║
║  Click vào icon 🏃 trên menu bar để điều khiển.                  ║
╚══════════════════════════════════════════════════════════════════╝
    """)
    
    app = HealthReminderApp()
    app.run()


if __name__ == "__main__":
    main()
