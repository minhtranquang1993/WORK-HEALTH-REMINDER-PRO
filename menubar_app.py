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
import json
from datetime import datetime, timedelta
from dataclasses import dataclass, field, asdict
from typing import Optional
from pathlib import Path
import sys
from http.server import HTTPServer, BaseHTTPRequestHandler

try:
    import rumps
except ImportError:
    print("❌ Cần cài đặt rumps: pip3 install rumps")
    print("   Đang cài đặt tự động...")
    subprocess.run([sys.executable, "-m", "pip", "install", "rumps"], check=True)
    import rumps

from water_tracker import water_tracker
from calendar_sync import calendar_sync

from exercises import (
    NECK_EXERCISES, SHOULDER_EXERCISES, EYE_EXERCISES, 
    BREATHING_EXERCISES, POSTURE_CHECK, RULE_20_20_20
)


# ============================================
# CẤU HÌNH
# ============================================

@dataclass
class WorkConfig:
    # Giờ làm việc
    work_start: tuple = (8, 0)
    lunch_start: tuple = (11, 30)
    work_resume: tuple = (13, 0)
    work_end: tuple = (17, 30)
    night_mode_start: tuple = (18, 0)

    # Cấu hình mới
    sleep_reminder_time: tuple = (23, 0)
    weekend_mode: str = "mon_fri"  # mon_fri, mon_sat_full, mon_sat_half, mon_sun_full, mon_sun_half
    saturday_end: tuple = (12, 0)
    sunday_end: tuple = (12, 0)
    is_configured: bool = False
    morning_reminder_start: tuple = (7, 30)

    # Water Tracker
    water_goal_ml: int = 2000    # Mục tiêu uống nước/ngày (ml)
    water_cup_ml: int = 200      # Lượng nước mỗi ly (ml)
    calendar_enabled: bool = False  # Bật/tắt Google Calendar integration

    # Pomodoro
    pomodoro_work: int = 25
    pomodoro_break: int = 5
    pomodoro_long_break: int = 15


@dataclass
class ReminderInterval:
    # Based on scientific recommendations (updated to match evidence-based guidelines)
    walk: int = 30           # Columbia University: 5-min walk every 30 min
    water: int = 45          # WHO hydration: drink water every 45-60 min
    toilet: int = 60         # Optional - kept for users who want it
    eye_20_20_20: int = 20   # AAO 20-20-20 rule: every 20 min
    blink: int = 15          # Dry eye research: blink reminder every 15 min
    posture: int = 20        # Cornell 20-8-2 rule: check posture every 20 min
    neck_stretch: int = 30   # Ergonomics: stretch every 20-30 min
    eye_exercise: int = 60   # AAO: eye exercise every 60 min
    breathing: int = 60      # Mindfulness research: breathing exercise every 60 min


# ============================================
# YOUTUBE STATE & HTTP SERVER
# ============================================

# HTTP port for Chrome extension communication
YOUTUBE_HTTP_PORT = 9876

@dataclass
class YouTubeState:
    """Trang thai YouTube tu Chrome Extension"""
    title: str = ""
    channel: str = ""
    duration: float = 0
    current_time: float = 0
    is_playing: bool = False
    volume: float = 1.0
    is_muted: bool = False
    url: str = ""
    last_update: float = 0

# Global YouTube state
youtube_state = YouTubeState()


class YouTubeHTTPHandler(BaseHTTPRequestHandler):
    """HTTP handler for Chrome Extension communication"""

    def log_message(self, format, *args):
        pass  # Suppress logging

    def send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def do_OPTIONS(self):
        """Handle CORS preflight"""
        self.send_response(200)
        self.send_cors_headers()
        self.end_headers()

    def do_POST(self):
        """Handle POST requests from extension"""
        global youtube_state

        if self.path == '/youtube/state':
            try:
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                data = json.loads(post_data.decode('utf-8'))

                youtube_state = YouTubeState(
                    title=data.get('title', ''),
                    channel=data.get('channel', ''),
                    duration=data.get('duration', 0),
                    current_time=data.get('currentTime', 0),
                    is_playing=data.get('isPlaying', False),
                    volume=data.get('volume', 1.0),
                    is_muted=data.get('isMuted', False),
                    url=data.get('url', ''),
                    last_update=time.time()
                )

                self.send_response(200)
                self.send_cors_headers()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': True}).encode())
            except Exception as e:
                self.send_response(400)
                self.send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode())
        else:
            self.send_response(404)
            self.send_cors_headers()
            self.end_headers()

    def do_GET(self):
        """Handle GET requests"""
        global youtube_state

        if self.path == '/youtube/state':
            self.send_response(200)
            self.send_cors_headers()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()

            data = {
                'title': youtube_state.title,
                'channel': youtube_state.channel,
                'duration': youtube_state.duration,
                'currentTime': youtube_state.current_time,
                'isPlaying': youtube_state.is_playing,
                'volume': youtube_state.volume,
                'isMuted': youtube_state.is_muted,
                'url': youtube_state.url,
                'lastUpdate': youtube_state.last_update,
                'isStale': (time.time() - youtube_state.last_update) > 5
            }
            self.wfile.write(json.dumps(data).encode())

        elif self.path == '/health':
            self.send_response(200)
            self.send_cors_headers()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'ok'}).encode())

        else:
            self.send_response(404)
            self.send_cors_headers()
            self.end_headers()


def run_youtube_http_server():
    """Run HTTP server in background thread"""
    try:
        server = HTTPServer(('localhost', YOUTUBE_HTTP_PORT), YouTubeHTTPHandler)
        print(f"YouTube HTTP server running on localhost:{YOUTUBE_HTTP_PORT}")
        server.serve_forever()
    except Exception as e:
        print(f"Could not start YouTube HTTP server: {e}")


# Config path
def get_config_path() -> Path:
    """Lấy đường dẫn file config"""
    config_dir = Path.home() / "Library" / "Application Support" / "WorkHealthReminder"
    config_dir.mkdir(parents=True, exist_ok=True)
    return config_dir / "settings.json"


def save_config(config: WorkConfig, intervals: ReminderInterval) -> bool:
    """Lưu config ra JSON"""
    config_path = get_config_path()
    data = {
        "work_config": {
            "work_start": list(config.work_start),
            "lunch_start": list(config.lunch_start),
            "work_resume": list(config.work_resume),
            "work_end": list(config.work_end),
            "night_mode_start": list(config.night_mode_start),
            "sleep_reminder_time": list(config.sleep_reminder_time),
            "weekend_mode": config.weekend_mode,
            "saturday_end": list(config.saturday_end),
            "sunday_end": list(config.sunday_end),
            "is_configured": config.is_configured,
            "morning_reminder_start": list(config.morning_reminder_start),
            "pomodoro_work": config.pomodoro_work,
            "pomodoro_break": config.pomodoro_break,
            "pomodoro_long_break": config.pomodoro_long_break,
            "water_goal_ml": config.water_goal_ml,
            "water_cup_ml": config.water_cup_ml,
            "calendar_enabled": config.calendar_enabled,
        },
        "intervals": {
            "walk": intervals.walk,
            "water": intervals.water,
            "toilet": intervals.toilet,
            "eye_20_20_20": intervals.eye_20_20_20,
            "blink": intervals.blink,
            "posture": intervals.posture,
            "neck_stretch": intervals.neck_stretch,
            "eye_exercise": intervals.eye_exercise,
            "breathing": intervals.breathing,
        }
    }
    try:
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"Error saving config: {e}")
        return False


def load_config() -> tuple:
    """Đọc config từ JSON"""
    config_path = get_config_path()

    if not config_path.exists():
        return WorkConfig(is_configured=False), ReminderInterval()

    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        wc = data.get("work_config", {})
        intervals = data.get("intervals", {})

        config = WorkConfig(
            work_start=tuple(wc.get("work_start", [8, 0])),
            lunch_start=tuple(wc.get("lunch_start", [11, 30])),
            work_resume=tuple(wc.get("work_resume", [13, 0])),
            work_end=tuple(wc.get("work_end", [17, 30])),
            night_mode_start=tuple(wc.get("night_mode_start", [18, 0])),
            sleep_reminder_time=tuple(wc.get("sleep_reminder_time", [23, 0])),
            weekend_mode=wc.get("weekend_mode", "mon_fri"),
            saturday_end=tuple(wc.get("saturday_end", [12, 0])),
            sunday_end=tuple(wc.get("sunday_end", [12, 0])),
            is_configured=wc.get("is_configured", False),
            morning_reminder_start=tuple(wc.get("morning_reminder_start", [7, 30])),
            pomodoro_work=wc.get("pomodoro_work", 25),
            pomodoro_break=wc.get("pomodoro_break", 5),
            pomodoro_long_break=wc.get("pomodoro_long_break", 15),
            water_goal_ml=wc.get("water_goal_ml", 2000),
            water_cup_ml=wc.get("water_cup_ml", 200),
            calendar_enabled=wc.get("calendar_enabled", False),
        )

        reminder_intervals = ReminderInterval(
            walk=intervals.get("walk", 30),
            water=intervals.get("water", 45),
            toilet=intervals.get("toilet", 60),
            eye_20_20_20=intervals.get("eye_20_20_20", 20),
            blink=intervals.get("blink", 15),
            posture=intervals.get("posture", 20),
            neck_stretch=intervals.get("neck_stretch", 30),
            eye_exercise=intervals.get("eye_exercise", 60),
            breathing=intervals.get("breathing", 60),
        )

        return config, reminder_intervals

    except Exception as e:
        print(f"Error loading config: {e}")
        return WorkConfig(is_configured=False), ReminderInterval()


# Load config
CONFIG, INTERVALS = load_config()


# ============================================
# TRACKER
# ============================================

class ReminderTracker:
    def __init__(self):
        self.reset_all()
        self.is_paused = False
        self.night_mode_reminded = False

        # Trạng thái mới
        self.sleep_reminded = False
        self.morning_reminded = False
        self.work_started_today = False

        # Focus mode
        self.focus_end_time: Optional[datetime] = None

        # Pomodoro
        self.pomodoro_state: Optional[str] = None  # "work", "break", None
        self.pomodoro_end_time: Optional[datetime] = None
        self.pomodoro_count = 0

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

    def reset_daily(self):
        """Reset các flag hàng ngày (gọi lúc 00:00)"""
        self.night_mode_reminded = False
        self.sleep_reminded = False
        self.morning_reminded = False
        self.work_started_today = False
        self.pomodoro_count = 0

    def is_focus_active(self) -> bool:
        """Kiểm tra Focus Mode đang bật"""
        if self.focus_end_time is None:
            return False
        return datetime.now() < self.focus_end_time

    def is_pomodoro_active(self) -> bool:
        """Kiểm tra Pomodoro đang chạy"""
        return self.pomodoro_state is not None


tracker = ReminderTracker()


# ============================================
# HELPERS
# ============================================

def time_to_minutes(hour: int, minute: int) -> int:
    return hour * 60 + minute


def get_current_minutes() -> int:
    now = datetime.now()
    return time_to_minutes(now.hour, now.minute)


def is_work_day() -> bool:
    """Kiểm tra hôm nay có phải ngày làm việc không"""
    today = datetime.now().weekday()  # Monday=0, Sunday=6

    if CONFIG.weekend_mode == "mon_fri":
        return today < 5  # T2-T6
    elif CONFIG.weekend_mode == "mon_sat_full":
        return today < 6  # T2-T7
    elif CONFIG.weekend_mode == "mon_sat_half":
        return today < 6  # T2-T7 (nửa ngày T7)
    elif CONFIG.weekend_mode in ("mon_sun_full", "mon_sun_half"):
        return True  # Cả tuần (T2-CN)
    return today < 5


def get_today_work_end() -> tuple:
    """Lấy giờ kết thúc hôm nay (xử lý T7/CN nửa ngày)"""
    today = datetime.now().weekday()
    if today == 5 and CONFIG.weekend_mode == "mon_sat_half":
        return CONFIG.saturday_end
    if today == 6 and CONFIG.weekend_mode == "mon_sun_half":
        return CONFIG.sunday_end
    return CONFIG.work_end


def is_half_day() -> bool:
    """Kiểm tra có phải ngày nửa ngày không (T7 hoặc CN)"""
    today = datetime.now().weekday()
    if today == 5 and CONFIG.weekend_mode == "mon_sat_half":
        return True
    if today == 6 and CONFIG.weekend_mode == "mon_sun_half":
        return True
    return False


def is_work_time() -> bool:
    """Kiểm tra có đang trong giờ làm việc không"""
    if not is_work_day():
        return False

    current = get_current_minutes()
    work_start = time_to_minutes(*CONFIG.work_start)
    work_end = time_to_minutes(*get_today_work_end())

    # T7 nửa ngày: không có nghỉ trưa
    if is_half_day():
        return work_start <= current < work_end

    # Ngày thường: có nghỉ trưa
    lunch_start = time_to_minutes(*CONFIG.lunch_start)
    work_resume = time_to_minutes(*CONFIG.work_resume)

    morning_work = work_start <= current < lunch_start
    afternoon_work = work_resume <= current < work_end
    return morning_work or afternoon_work


def is_lunch_break() -> bool:
    """Kiểm tra có đang nghỉ trưa không"""
    if not is_work_day() or is_half_day():
        return False

    current = get_current_minutes()
    lunch_start = time_to_minutes(*CONFIG.lunch_start)
    work_resume = time_to_minutes(*CONFIG.work_resume)
    return lunch_start <= current < work_resume


def is_morning_reminder_window() -> bool:
    """Kiểm tra đang trong khung nhắc buổi sáng (7:30-work_start)"""
    if not is_work_day():
        return False

    current = get_current_minutes()
    morning_start = time_to_minutes(*CONFIG.morning_reminder_start)
    work_start = time_to_minutes(*CONFIG.work_start)
    return morning_start <= current < work_start


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


def ask_time_input(title: str, message: str, default: str) -> tuple:
    """Dialog nhập giờ"""
    script = f'''
    set userInput to text returned of (display dialog "{message}" with title "{title}" default answer "{default}")
    return userInput
    '''
    result = subprocess.run(['osascript', '-e', script], capture_output=True, text=True)
    time_str = result.stdout.strip() or default

    try:
        parts = time_str.replace(":", " ").replace(".", " ").replace("h", " ").split()
        hour = int(parts[0])
        minute = int(parts[1]) if len(parts) > 1 else 0
        return (hour, minute)
    except:
        parts = default.split(':')
        return (int(parts[0]), int(parts[1]))


def ask_weekend_mode() -> str:
    """Dialog chọn chế độ làm cuối tuần"""
    # Bước 1: Chọn làm đến ngày nào
    script1 = '''
    set weekendChoice to button returned of (display dialog "Ban lam viec den ngay nao trong tuan?" with title "Cau hinh ngay lam viec" buttons {"T2-T6", "T2-T7", "T2-CN"} default button 1)
    return weekendChoice
    '''
    result = subprocess.run(['osascript', '-e', script1], capture_output=True, text=True)
    choice1 = result.stdout.strip()

    if "T2-T6" in choice1:
        return "mon_fri"

    # Bước 2: Nếu chọn T7 hoặc CN, hỏi cả ngày hay nửa ngày
    if "T2-T7" in choice1:
        script2 = '''
        set dayChoice to button returned of (display dialog "Thu 7 ban lam ca ngay hay nua ngay?" with title "Cau hinh Thu 7" buttons {"Ca ngay", "Nua ngay"} default button 1)
        return dayChoice
        '''
        result = subprocess.run(['osascript', '-e', script2], capture_output=True, text=True)
        choice2 = result.stdout.strip()
        if "Nua ngay" in choice2:
            return "mon_sat_half"
        return "mon_sat_full"

    if "T2-CN" in choice1:
        script2 = '''
        set dayChoice to button returned of (display dialog "Chu nhat ban lam ca ngay hay nua ngay?" with title "Cau hinh Chu nhat" buttons {"Ca ngay", "Nua ngay"} default button 1)
        return dayChoice
        '''
        result = subprocess.run(['osascript', '-e', script2], capture_output=True, text=True)
        choice2 = result.stdout.strip()
        if "Nua ngay" in choice2:
            return "mon_sun_half"
        return "mon_sun_full"

    return "mon_fri"


def ask_number_input(title: str, message: str, default: int) -> int:
    """Dialog nhập số"""
    script = f'''
    set userInput to text returned of (display dialog "{message}" with title "{title}" default answer "{default}")
    return userInput
    '''
    result = subprocess.run(['osascript', '-e', script], capture_output=True, text=True)
    try:
        return int(result.stdout.strip())
    except:
        return default


def show_first_run_setup() -> tuple:
    """Wizard cấu hình lần đầu"""
    global CONFIG, INTERVALS

    # Welcome
    script = '''
    display dialog "Chao mung ban den voi Health Reminder Pro!\\n\\nUng dung se giup ban:\\n- Nhac nho nghi ngoi dinh ky\\n- Bao ve mat va tu the\\n- Giu gin suc khoe khi lam viec\\n\\nHay cau hinh gio lam viec cua ban!" with title "Health Reminder Pro" buttons {"Tiep tuc"} default button 1
    '''
    subprocess.run(['osascript', '-e', script], capture_output=True)

    # Work hours
    work_start = ask_time_input(
        "Gio bat dau",
        "Nhap gio bat dau lam viec (VD: 8:00 hoac 9:30)",
        "08:00"
    )

    lunch_start = ask_time_input(
        "Gio nghi trua",
        "Nhap gio bat dau nghi trua",
        "11:30"
    )

    work_resume = ask_time_input(
        "Gio lam viec lai",
        "Nhap gio lam viec lai sau nghi trua",
        "13:00"
    )

    work_end = ask_time_input(
        "Gio ket thuc",
        "Nhap gio ket thuc lam viec",
        "17:30"
    )

    # Weekend mode
    weekend_mode = ask_weekend_mode()

    saturday_end = (12, 0)
    sunday_end = (12, 0)
    if weekend_mode == "mon_sat_half":
        saturday_end = ask_time_input(
            "Gio ket thuc thu 7",
            "Thu 7 lam nua ngay - ket thuc luc may gio?",
            "12:00"
        )
    if weekend_mode == "mon_sun_half":
        sunday_end = ask_time_input(
            "Gio ket thuc Chu nhat",
            "Chu nhat lam nua ngay - ket thuc luc may gio?",
            "12:00"
        )

    # Sleep reminder
    sleep_time = ask_time_input(
        "Nhac ngu",
        "Nhap gio nhac ngu (VD: 23:00)",
        "23:00"
    )

    config = WorkConfig(
        work_start=work_start,
        lunch_start=lunch_start,
        work_resume=work_resume,
        work_end=work_end,
        weekend_mode=weekend_mode,
        saturday_end=saturday_end,
        sunday_end=sunday_end,
        sleep_reminder_time=sleep_time,
        is_configured=True,
    )

    save_config(config, INTERVALS)
    send_notification("✅ Cấu hình xong!", f"Giờ làm: {work_start[0]:02d}:{work_start[1]:02d} - {work_end[0]:02d}:{work_end[1]:02d}")

    return config, INTERVALS


# ============================================
# MENU BAR APP
# ============================================

class HealthReminderApp(rumps.App):
    def __init__(self):
        global CONFIG, INTERVALS

        # First-run setup
        if not CONFIG.is_configured:
            CONFIG, INTERVALS = show_first_run_setup()

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

        # Focus Mode submenu
        self.focus_menu = rumps.MenuItem("🎯 Focus Mode")
        self.focus_menu.add(rumps.MenuItem("15 phút", callback=lambda _: self.start_focus(15)))
        self.focus_menu.add(rumps.MenuItem("30 phút", callback=lambda _: self.start_focus(30)))
        self.focus_menu.add(rumps.MenuItem("45 phút", callback=lambda _: self.start_focus(45)))
        self.focus_menu.add(rumps.MenuItem("60 phút", callback=lambda _: self.start_focus(60)))
        self.focus_menu.add(None)
        self.focus_menu.add(rumps.MenuItem("⏹️ Dừng Focus", callback=self.stop_focus))

        # Pomodoro submenu
        self.pomodoro_menu = rumps.MenuItem("🍅 Pomodoro")
        self.pomodoro_start_item = rumps.MenuItem("▶️ Bắt đầu Pomodoro", callback=self.start_pomodoro)
        self.pomodoro_stop_item = rumps.MenuItem("⏹️ Dừng Pomodoro", callback=self.stop_pomodoro)
        self.pomodoro_count_item = rumps.MenuItem("📊 Hoàn thành hôm nay: 0")
        self.pomodoro_menu.add(self.pomodoro_start_item)
        self.pomodoro_menu.add(self.pomodoro_stop_item)
        self.pomodoro_menu.add(None)
        self.pomodoro_menu.add(self.pomodoro_count_item)

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

        # Water Tracker submenu
        self.water_menu = rumps.MenuItem("💧 Nước hôm nay")
        self.water_status_item = rumps.MenuItem("💧 0 / 2000ml (0%)")
        self.water_bar_item = rumps.MenuItem("░░░░░░░░░░░░░░░░")
        self.water_drink_default = rumps.MenuItem(
            f"✅ Uống {CONFIG.water_cup_ml}ml",
            callback=self.water_drink_default_cb
        )
        self.water_drink_custom = rumps.MenuItem("✏️ Uống lượng khác...", callback=self.water_drink_custom_cb)
        self.water_reset_item = rumps.MenuItem("🔄 Reset hôm nay", callback=self.water_reset_cb)
        self.water_menu.add(self.water_status_item)
        self.water_menu.add(self.water_bar_item)
        self.water_menu.add(None)
        self.water_menu.add(self.water_drink_default)
        self.water_menu.add(self.water_drink_custom)
        self.water_menu.add(None)
        self.water_menu.add(self.water_reset_item)

        # Calendar submenu (ICS-based, no login required)
        self.calendar_menu = rumps.MenuItem("📅 Calendar")
        self.calendar_status_item = rumps.MenuItem("⚙️ Chưa có ICS URL")
        self.calendar_toggle_item = rumps.MenuItem(
            "🔔 Bật auto-pause khi họp",
            callback=self.calendar_toggle_cb
        )
        self.calendar_url_item = rumps.MenuItem("🔗 Nhập ICS URL...", callback=self.calendar_set_url_cb)
        self.calendar_sync_item = rumps.MenuItem("🔄 Sync ngay", callback=self.calendar_sync_now_cb)
        self.calendar_menu.add(self.calendar_status_item)
        self.calendar_menu.add(None)
        self.calendar_menu.add(self.calendar_url_item)
        self.calendar_menu.add(self.calendar_toggle_item)
        self.calendar_menu.add(self.calendar_sync_item)

        # YouTube submenu
        self.youtube_menu = rumps.MenuItem("📺 YouTube")
        self.youtube_status = rumps.MenuItem("Không có video")
        self.youtube_title = rumps.MenuItem("--")
        self.youtube_playpause = rumps.MenuItem("▶️ Play/Pause", callback=self.youtube_play_pause)
        self.youtube_next = rumps.MenuItem("⏭️ Video tiếp", callback=self.youtube_next_video)
        self.youtube_prev = rumps.MenuItem("⏮️ Video trước", callback=self.youtube_prev_video)

        self.youtube_menu.add(self.youtube_status)
        self.youtube_menu.add(self.youtube_title)
        self.youtube_menu.add(None)
        self.youtube_menu.add(self.youtube_playpause)
        self.youtube_menu.add(self.youtube_next)
        self.youtube_menu.add(self.youtube_prev)

        # Settings - build dynamically
        self.build_settings_menu()

        # Start YouTube HTTP server
        self.youtube_http_thread = threading.Thread(target=run_youtube_http_server, daemon=True)
        self.youtube_http_thread.start()

        # Start Calendar ICS sync (nếu đã enable)
        if CONFIG.calendar_enabled and calendar_sync.is_configured:
            calendar_sync.start_background_sync()

        # Sync water tracker goal từ config
        water_tracker.goal_ml = CONFIG.water_goal_ml
        water_tracker.cup_size_ml = CONFIG.water_cup_ml

        # Build menu
        self.menu = [
            self.status_item,
            self.next_reminder,
            None,
            self.pause_item,
            self.resume_item,
            self.focus_menu,
            self.pomodoro_menu,
            None,
            self.exercise_menu,
            self.water_menu,
            self.calendar_menu,
            self.youtube_menu,
            self.quick_menu,
            None,
            self.settings_menu,
            None,
            rumps.MenuItem("❌ Thoát", callback=self.quit_app)
        ]

        # Start reminder thread
        self.reminder_thread = threading.Thread(target=self.reminder_loop, daemon=True)
        self.reminder_thread.start()

        # Update status timer (faster for Pomodoro countdown)
        self.update_timer = rumps.Timer(self.update_status, 1)
        self.update_timer.start()

    def build_settings_menu(self):
        """Xây dựng menu Settings động"""
        self.settings_menu = rumps.MenuItem("⚙️ Cài đặt")

        # Work hours
        ws = CONFIG.work_start
        we = CONFIG.work_end
        self.work_hours_item = rumps.MenuItem(
            f"📅 Giờ làm: {ws[0]:02d}:{ws[1]:02d} - {we[0]:02d}:{we[1]:02d}",
            callback=self.edit_work_hours
        )
        self.settings_menu.add(self.work_hours_item)

        # Lunch break
        ls = CONFIG.lunch_start
        wr = CONFIG.work_resume
        self.lunch_item = rumps.MenuItem(
            f"☀️ Nghỉ trưa: {ls[0]:02d}:{ls[1]:02d} - {wr[0]:02d}:{wr[1]:02d}",
            callback=self.edit_lunch_hours
        )
        self.settings_menu.add(self.lunch_item)

        # Weekend mode
        weekend_labels = {
            "mon_fri": "T2-T6",
            "mon_sat_full": "T2-T7 (Full)",
            "mon_sat_half": "T2-T7 (Nửa ngày)",
            "mon_sun_full": "T2-CN (Full)",
            "mon_sun_half": "T2-CN (Nửa ngày)",
        }
        self.weekend_item = rumps.MenuItem(
            f"📆 Làm việc: {weekend_labels.get(CONFIG.weekend_mode, 'T2-T6')}",
            callback=self.edit_weekend_mode
        )
        self.settings_menu.add(self.weekend_item)

        # Sleep reminder
        st = CONFIG.sleep_reminder_time
        self.sleep_item = rumps.MenuItem(
            f"🌙 Nhắc ngủ: {st[0]:02d}:{st[1]:02d}",
            callback=self.edit_sleep_time
        )
        self.settings_menu.add(self.sleep_item)

        self.settings_menu.add(None)

        # Intervals submenu
        self.intervals_menu = rumps.MenuItem("⏱️ Thời gian nhắc")
        self.intervals_menu.add(rumps.MenuItem(f"🚶 Đi bộ: {INTERVALS.walk} phút", callback=lambda _: self.edit_interval("walk")))
        self.intervals_menu.add(rumps.MenuItem(f"💧 Nước: {INTERVALS.water} phút", callback=lambda _: self.edit_interval("water")))
        self.intervals_menu.add(rumps.MenuItem(f"👁️ 20-20-20: {INTERVALS.eye_20_20_20} phút", callback=lambda _: self.edit_interval("eye_20_20_20")))
        self.intervals_menu.add(rumps.MenuItem(f"🧘 Giãn cổ: {INTERVALS.neck_stretch} phút", callback=lambda _: self.edit_interval("neck_stretch")))
        self.intervals_menu.add(rumps.MenuItem(f"🪑 Tư thế: {INTERVALS.posture} phút", callback=lambda _: self.edit_interval("posture")))
        self.settings_menu.add(self.intervals_menu)

        self.settings_menu.add(None)

        # Water settings
        self.water_settings_menu = rumps.MenuItem("💧 Cài đặt nước")
        self.water_settings_menu.add(rumps.MenuItem(
            f"🎯 Mục tiêu: {CONFIG.water_goal_ml}ml/ngày",
            callback=self.edit_water_goal
        ))
        self.water_settings_menu.add(rumps.MenuItem(
            f"🥤 Ly mặc định: {CONFIG.water_cup_ml}ml",
            callback=self.edit_water_cup
        ))
        self.settings_menu.add(self.water_settings_menu)

        self.settings_menu.add(None)
        self.settings_menu.add(rumps.MenuItem("ℹ️ Phiên bản 3.0 PRO"))
        self.settings_menu.add(rumps.MenuItem("🔄 Đặt lại mặc định", callback=self.reset_to_defaults))
    
    def update_status(self, _):
        """Cập nhật trạng thái trên menu"""
        now = datetime.now()

        # Update Pomodoro count
        self.pomodoro_count_item.title = f"📊 Hoàn thành hôm nay: {self.tracker.pomodoro_count}"

        # Pomodoro active - show countdown
        if self.tracker.is_pomodoro_active() and self.tracker.pomodoro_end_time:
            remaining = (self.tracker.pomodoro_end_time - now).total_seconds()
            if remaining > 0:
                mins = int(remaining // 60)
                secs = int(remaining % 60)
                if self.tracker.pomodoro_state == "work":
                    self.title = f"🍅 {mins:02d}:{secs:02d}"
                    self.status_item.title = f"🍅 Pomodoro: {mins:02d}:{secs:02d}"
                else:
                    self.title = f"☕ {mins:02d}:{secs:02d}"
                    self.status_item.title = f"☕ Nghỉ: {mins:02d}:{secs:02d}"
                self.next_reminder.title = "⏱️ Pomodoro đang chạy"
                return
            else:
                self.handle_pomodoro_end()
                return

        # Focus mode active - show countdown
        if self.tracker.is_focus_active() and self.tracker.focus_end_time:
            remaining = (self.tracker.focus_end_time - now).total_seconds()
            if remaining > 0:
                mins = int(remaining // 60)
                self.title = f"🎯 {mins}m"
                self.status_item.title = f"🎯 Focus: còn {mins} phút"
                self.next_reminder.title = "⏱️ Focus Mode"
                return
            else:
                self.stop_focus(None)
                return

        # Normal status
        if self.tracker.is_paused:
            self.status_item.title = "⏸️ Đã tạm dừng"
            self.title = "⏸️"
        elif not is_work_day():
            day_names = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]
            today = day_names[now.weekday()]
            self.status_item.title = f"🎉 Ngày nghỉ ({today})"
            self.title = "🎉"
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

        # Update YouTube menu
        self.update_youtube_menu()

        # Update water status
        self.update_water_menu()

        # Update calendar status
        self.update_calendar_menu()

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

    # ============================================
    # FOCUS MODE
    # ============================================

    def start_focus(self, minutes: int):
        """Bắt đầu Focus Mode"""
        self.tracker.focus_end_time = datetime.now() + timedelta(minutes=minutes)
        send_notification("🎯 Focus Mode", f"Tập trung trong {minutes} phút! Tất cả nhắc nhở đã tạm dừng.")

    def stop_focus(self, _):
        """Dừng Focus Mode"""
        if self.tracker.focus_end_time:
            self.tracker.focus_end_time = None
            send_notification("🎯 Focus xong!", "Đã tắt Focus Mode. Nhắc nhở hoạt động lại!")

    # ============================================
    # POMODORO
    # ============================================

    def start_pomodoro(self, _):
        """Bắt đầu Pomodoro"""
        self.tracker.pomodoro_state = "work"
        self.tracker.pomodoro_end_time = datetime.now() + timedelta(minutes=CONFIG.pomodoro_work)
        send_notification("🍅 Pomodoro bắt đầu!", f"Tập trung làm việc trong {CONFIG.pomodoro_work} phút!")

    def stop_pomodoro(self, _):
        """Dừng Pomodoro"""
        self.tracker.pomodoro_state = None
        self.tracker.pomodoro_end_time = None
        send_notification("🍅 Đã dừng Pomodoro", "Pomodoro đã dừng.")

    def handle_pomodoro_end(self):
        """Xử lý khi hết thời gian Pomodoro"""
        if self.tracker.pomodoro_state == "work":
            # Hết thời gian làm việc
            self.tracker.pomodoro_count += 1

            # Sau 4 pomodoro → nghỉ dài
            if self.tracker.pomodoro_count % 4 == 0:
                break_time = CONFIG.pomodoro_long_break
                send_notification("🎉 Nghỉ dài!", f"Đã hoàn thành 4 Pomodoro! Nghỉ {break_time} phút.")
            else:
                break_time = CONFIG.pomodoro_break
                send_notification("☕ Nghỉ ngơi!", f"Hết {CONFIG.pomodoro_work} phút! Nghỉ {break_time} phút.")

            self.tracker.pomodoro_state = "break"
            self.tracker.pomodoro_end_time = datetime.now() + timedelta(minutes=break_time)

        elif self.tracker.pomodoro_state == "break":
            # Hết thời gian nghỉ
            choice = send_alert_with_options(
                "🍅 Tiếp tục Pomodoro?",
                f"Đã nghỉ xong! Bạn đã hoàn thành {self.tracker.pomodoro_count} Pomodoro hôm nay.",
                ["Tiếp tục", "Dừng lại"]
            )
            if "Tiếp tục" in choice:
                self.start_pomodoro(None)
            else:
                self.stop_pomodoro(None)

    # ============================================
    # YOUTUBE CONTROL
    # ============================================

    def update_youtube_menu(self):
        """Cap nhat menu YouTube"""
        global youtube_state

        # Check if data is stale (more than 5 seconds old)
        is_stale = (time.time() - youtube_state.last_update) > 5

        if is_stale or not youtube_state.title:
            self.youtube_status.title = "Không có video"
            self.youtube_title.title = "Mở YouTube trong Chrome"
            self.youtube_playpause.title = "▶️ Play/Pause"
        else:
            # Truncate title if too long
            title = youtube_state.title
            if len(title) > 35:
                title = title[:32] + "..."

            status = "▶️ Đang phát" if youtube_state.is_playing else "⏸️ Tạm dừng"
            self.youtube_status.title = status
            self.youtube_title.title = f"🎵 {title}"
            self.youtube_playpause.title = "⏸️ Pause" if youtube_state.is_playing else "▶️ Play"

    def send_youtube_command(self, command: str):
        """Send command to YouTube via Chrome AppleScript"""
        # Use AppleScript to send keystrokes to Chrome
        if command == "playPause":
            # Send 'k' key (YouTube shortcut for play/pause)
            script = '''
            tell application "Google Chrome"
                activate
                tell application "System Events"
                    keystroke "k"
                end tell
            end tell
            '''
        elif command == "next":
            # Send Shift+N key (YouTube shortcut for next)
            script = '''
            tell application "Google Chrome"
                activate
                tell application "System Events"
                    keystroke "n" using shift down
                end tell
            end tell
            '''
        elif command == "prev":
            # Send Shift+P key (YouTube shortcut for previous)
            script = '''
            tell application "Google Chrome"
                activate
                tell application "System Events"
                    keystroke "p" using shift down
                end tell
            end tell
            '''
        else:
            return

        try:
            subprocess.run(['osascript', '-e', script], capture_output=True)
        except Exception as e:
            print(f"Error sending YouTube command: {e}")

    def youtube_play_pause(self, _):
        """Toggle YouTube play/pause"""
        self.send_youtube_command("playPause")

    def youtube_next_video(self, _):
        """Skip to next YouTube video"""
        self.send_youtube_command("next")
        send_notification("📺 YouTube", "Chuyển video tiếp theo")

    def youtube_prev_video(self, _):
        """Go to previous YouTube video"""
        self.send_youtube_command("prev")
        send_notification("📺 YouTube", "Quay lại video trước")

    # ============================================
    # SETTINGS EDIT
    # ============================================

    def edit_work_hours(self, _):
        """Chỉnh giờ làm việc"""
        global CONFIG
        ws = CONFIG.work_start
        we = CONFIG.work_end

        new_start = ask_time_input("Giờ bắt đầu", f"Hiện tại: {ws[0]:02d}:{ws[1]:02d}", f"{ws[0]:02d}:{ws[1]:02d}")
        new_end = ask_time_input("Giờ kết thúc", f"Hiện tại: {we[0]:02d}:{we[1]:02d}", f"{we[0]:02d}:{we[1]:02d}")

        CONFIG = WorkConfig(
            work_start=new_start, work_end=new_end,
            lunch_start=CONFIG.lunch_start, work_resume=CONFIG.work_resume,
            night_mode_start=CONFIG.night_mode_start,
            sleep_reminder_time=CONFIG.sleep_reminder_time,
            weekend_mode=CONFIG.weekend_mode, saturday_end=CONFIG.saturday_end, sunday_end=CONFIG.sunday_end,
            is_configured=True, morning_reminder_start=CONFIG.morning_reminder_start,
            pomodoro_work=CONFIG.pomodoro_work, pomodoro_break=CONFIG.pomodoro_break,
            pomodoro_long_break=CONFIG.pomodoro_long_break,
        )
        save_config(CONFIG, INTERVALS)
        self.work_hours_item.title = f"📅 Giờ làm: {new_start[0]:02d}:{new_start[1]:02d} - {new_end[0]:02d}:{new_end[1]:02d}"
        send_notification("✅ Đã cập nhật", f"Giờ làm: {new_start[0]:02d}:{new_start[1]:02d} - {new_end[0]:02d}:{new_end[1]:02d}")

    def edit_lunch_hours(self, _):
        """Chỉnh giờ nghỉ trưa"""
        global CONFIG
        ls = CONFIG.lunch_start
        wr = CONFIG.work_resume

        new_start = ask_time_input("Bắt đầu nghỉ trưa", f"Hiện tại: {ls[0]:02d}:{ls[1]:02d}", f"{ls[0]:02d}:{ls[1]:02d}")
        new_end = ask_time_input("Kết thúc nghỉ trưa", f"Hiện tại: {wr[0]:02d}:{wr[1]:02d}", f"{wr[0]:02d}:{wr[1]:02d}")

        CONFIG = WorkConfig(
            work_start=CONFIG.work_start, work_end=CONFIG.work_end,
            lunch_start=new_start, work_resume=new_end,
            night_mode_start=CONFIG.night_mode_start,
            sleep_reminder_time=CONFIG.sleep_reminder_time,
            weekend_mode=CONFIG.weekend_mode, saturday_end=CONFIG.saturday_end, sunday_end=CONFIG.sunday_end,
            is_configured=True, morning_reminder_start=CONFIG.morning_reminder_start,
            pomodoro_work=CONFIG.pomodoro_work, pomodoro_break=CONFIG.pomodoro_break,
            pomodoro_long_break=CONFIG.pomodoro_long_break,
        )
        save_config(CONFIG, INTERVALS)
        self.lunch_item.title = f"☀️ Nghỉ trưa: {new_start[0]:02d}:{new_start[1]:02d} - {new_end[0]:02d}:{new_end[1]:02d}"
        send_notification("✅ Đã cập nhật", f"Nghỉ trưa: {new_start[0]:02d}:{new_start[1]:02d} - {new_end[0]:02d}:{new_end[1]:02d}")

    def edit_weekend_mode(self, _):
        """Chỉnh chế độ làm cuối tuần"""
        global CONFIG
        new_mode = ask_weekend_mode()

        saturday_end = CONFIG.saturday_end
        sunday_end = CONFIG.sunday_end
        if new_mode == "mon_sat_half":
            se = CONFIG.saturday_end
            saturday_end = ask_time_input("Giờ kết thúc T7", f"Hiện tại: {se[0]:02d}:{se[1]:02d}", f"{se[0]:02d}:{se[1]:02d}")
        if new_mode == "mon_sun_half":
            sn = CONFIG.sunday_end
            sunday_end = ask_time_input("Giờ kết thúc CN", f"Hiện tại: {sn[0]:02d}:{sn[1]:02d}", f"{sn[0]:02d}:{sn[1]:02d}")

        CONFIG = WorkConfig(
            work_start=CONFIG.work_start, work_end=CONFIG.work_end,
            lunch_start=CONFIG.lunch_start, work_resume=CONFIG.work_resume,
            night_mode_start=CONFIG.night_mode_start,
            sleep_reminder_time=CONFIG.sleep_reminder_time,
            weekend_mode=new_mode, saturday_end=saturday_end, sunday_end=sunday_end,
            is_configured=True, morning_reminder_start=CONFIG.morning_reminder_start,
            pomodoro_work=CONFIG.pomodoro_work, pomodoro_break=CONFIG.pomodoro_break,
            pomodoro_long_break=CONFIG.pomodoro_long_break,
        )
        save_config(CONFIG, INTERVALS)

        weekend_labels = {"mon_fri": "T2-T6", "mon_sat_full": "T2-T7 (Full)", "mon_sat_half": "T2-T7 (Nửa ngày)", "mon_sun_full": "T2-CN (Full)", "mon_sun_half": "T2-CN (Nửa ngày)"}
        self.weekend_item.title = f"📆 Làm việc: {weekend_labels.get(new_mode, 'T2-T6')}"
        send_notification("✅ Đã cập nhật", f"Làm việc: {weekend_labels.get(new_mode, 'T2-T6')}")

    def edit_sleep_time(self, _):
        """Chỉnh giờ nhắc ngủ"""
        global CONFIG
        st = CONFIG.sleep_reminder_time
        new_time = ask_time_input("Giờ nhắc ngủ", f"Hiện tại: {st[0]:02d}:{st[1]:02d}", f"{st[0]:02d}:{st[1]:02d}")

        CONFIG = WorkConfig(
            work_start=CONFIG.work_start, work_end=CONFIG.work_end,
            lunch_start=CONFIG.lunch_start, work_resume=CONFIG.work_resume,
            night_mode_start=CONFIG.night_mode_start,
            sleep_reminder_time=new_time,
            weekend_mode=CONFIG.weekend_mode, saturday_end=CONFIG.saturday_end, sunday_end=CONFIG.sunday_end,
            is_configured=True, morning_reminder_start=CONFIG.morning_reminder_start,
            pomodoro_work=CONFIG.pomodoro_work, pomodoro_break=CONFIG.pomodoro_break,
            pomodoro_long_break=CONFIG.pomodoro_long_break,
        )
        save_config(CONFIG, INTERVALS)
        self.sleep_item.title = f"🌙 Nhắc ngủ: {new_time[0]:02d}:{new_time[1]:02d}"
        send_notification("✅ Đã cập nhật", f"Nhắc ngủ lúc {new_time[0]:02d}:{new_time[1]:02d}")

    def edit_interval(self, interval_name: str):
        """Chỉnh thời gian interval"""
        global INTERVALS
        labels = {
            "walk": ("🚶 Đi bộ", INTERVALS.walk),
            "water": ("💧 Nước", INTERVALS.water),
            "eye_20_20_20": ("👁️ 20-20-20", INTERVALS.eye_20_20_20),
            "neck_stretch": ("🧘 Giãn cổ", INTERVALS.neck_stretch),
            "posture": ("🪑 Tư thế", INTERVALS.posture),
        }
        label, current = labels.get(interval_name, ("", 30))
        new_val = ask_number_input(label, f"Nhập số phút (hiện tại: {current})", current)

        INTERVALS = ReminderInterval(
            walk=new_val if interval_name == "walk" else INTERVALS.walk,
            water=new_val if interval_name == "water" else INTERVALS.water,
            toilet=INTERVALS.toilet,
            eye_20_20_20=new_val if interval_name == "eye_20_20_20" else INTERVALS.eye_20_20_20,
            blink=INTERVALS.blink,
            posture=new_val if interval_name == "posture" else INTERVALS.posture,
            neck_stretch=new_val if interval_name == "neck_stretch" else INTERVALS.neck_stretch,
            eye_exercise=INTERVALS.eye_exercise,
            breathing=INTERVALS.breathing,
        )
        save_config(CONFIG, INTERVALS)
        send_notification("✅ Đã cập nhật", f"{label}: {new_val} phút")

    def reset_to_defaults(self, _):
        """Đặt lại mặc định"""
        global CONFIG, INTERVALS
        choice = send_alert_with_options("Xác nhận", "Đặt lại tất cả cài đặt về mặc định?", ["Đặt lại", "Hủy"])
        if "Đặt lại" in choice:
            CONFIG = WorkConfig(is_configured=True)
            INTERVALS = ReminderInterval()
            save_config(CONFIG, INTERVALS)
            send_notification("🔄 Đã đặt lại", "Tất cả cài đặt đã về mặc định.")

    # ============================================
    # WATER TRACKER METHODS
    # ============================================

    def update_water_menu(self):
        """Cập nhật water tracker menu"""
        status = water_tracker.get_status()
        self.water_status_item.title = status['menu_title']
        bar = status['status_icon'] + ' ' + status['progress_bar']
        self.water_bar_item.title = bar
        cup = water_tracker.cup_size_ml
        self.water_drink_default.title = f"✅ Uống {cup}ml"
        # Update menu title with icon
        self.water_menu.title = f"💧 Nước: {status['total_ml']}/{status['goal_ml']}ml"

    def water_drink_default_cb(self, _):
        """Ghi nhận uống một ly nước (default cup size)"""
        ml = water_tracker.cup_size_ml
        status = water_tracker.add_water(ml)
        send_notification(
            "💧 Đã ghi nhận!",
            f"+{ml}ml → Hôm nay: {status['total_ml']}/{status['goal_ml']}ml ({status['pct']}%)"
        )
        if status['pct'] >= 100:
            send_notification("🎉 Đạt mục tiêu!", f"Đã uống đủ {status['goal_ml']}ml hôm nay! Tuyệt vời!")

    def water_drink_custom_cb(self, _):
        """Ghi nhận uống lượng nước tùy chỉnh"""
        script = """
        set userInput to text returned of (display dialog "Nhập lượng nước đã uống (ml):" with title "💧 Uống nước" default answer "200")
        return userInput
        """
        import subprocess
        result = subprocess.run(['osascript', '-e', script], capture_output=True, text=True)
        try:
            ml = int(result.stdout.strip())
            if ml > 0:
                status = water_tracker.add_water(ml)
                send_notification(
                    "💧 Đã ghi nhận!",
                    f"+{ml}ml → Hôm nay: {status['total_ml']}/{status['goal_ml']}ml ({status['pct']}%)"
                )
        except (ValueError, Exception):
            pass

    def water_reset_cb(self, _):
        """Reset water tracking hôm nay"""
        water_tracker.reset_today()
        send_notification("🔄 Đã reset", "Lượng nước hôm nay đã về 0ml.")

    def edit_water_goal(self, _):
        """Chỉnh mục tiêu uống nước"""
        global CONFIG
        new_goal = ask_number_input(
            "💧 Mục tiêu nước/ngày",
            f"Nhập số ml mục tiêu/ngày (hiện tại: {CONFIG.water_goal_ml}ml)",
            CONFIG.water_goal_ml
        )
        if new_goal > 0:
            CONFIG.water_goal_ml = new_goal
            water_tracker.goal_ml = new_goal
            save_config(CONFIG, INTERVALS)
            send_notification("✅ Đã cập nhật", f"Mục tiêu nước: {new_goal}ml/ngày")

    def edit_water_cup(self, _):
        """Chỉnh kích thước ly mặc định"""
        global CONFIG
        new_cup = ask_number_input(
            "🥤 Kích thước ly",
            f"Nhập ml mỗi ly (hiện tại: {CONFIG.water_cup_ml}ml)",
            CONFIG.water_cup_ml
        )
        if new_cup > 0:
            CONFIG.water_cup_ml = new_cup
            water_tracker.cup_size_ml = new_cup
            save_config(CONFIG, INTERVALS)
            send_notification("✅ Đã cập nhật", f"Ly mặc định: {new_cup}ml")

    # ============================================
    # CALENDAR METHODS
    # ============================================

    def update_calendar_menu(self):
        """Cập nhật calendar menu status"""
        self.calendar_status_item.title = calendar_sync.get_status_text()
        enabled = CONFIG.calendar_enabled
        self.calendar_toggle_item.title = (
            "🔕 Tắt auto-pause khi họp" if enabled
            else "🔔 Bật auto-pause khi họp"
        )

    def calendar_toggle_cb(self, _):
        """Bật/tắt calendar integration"""
        global CONFIG
        if not calendar_sync.is_configured:
            send_notification(
                "⚠️ Chưa có ICS URL",
                "Vào 📅 Calendar → Nhập ICS URL trước nhé!"
            )
            return

        CONFIG.calendar_enabled = not CONFIG.calendar_enabled
        calendar_sync.enabled = CONFIG.calendar_enabled
        save_config(CONFIG, INTERVALS)

        if CONFIG.calendar_enabled:
            calendar_sync.start_background_sync()
            send_notification("📅 Calendar bật", "Sẽ tự pause nhắc nhở khi đang trong meeting!")
        else:
            calendar_sync.stop_background_sync()
            send_notification("📅 Calendar tắt", "Auto-pause đã tắt.")

    def calendar_sync_now_cb(self, _):
        """Sync calendar ngay lập tức"""
        if not calendar_sync.is_configured:
            send_notification("⚠️ Chưa có ICS URL", "Nhập ICS URL trong menu Calendar trước nhé!")
            return
        calendar_sync.sync_now_async()
        send_notification("🔄 Đang sync...", "Calendar đang được đồng bộ từ ICS URL.")

    def calendar_set_url_cb(self, _):
        """Nhập ICS URL từ user"""
        current_url = calendar_sync.ics_url or ''
        script = f"""
        set userInput to text returned of (display dialog "Nhập ICS URL của Google Calendar / Outlook / Apple Calendar:\n\nGoogle Calendar: Settings → tên lịch → Secret address in iCal format" with title "📅 Nhập ICS URL" default answer "{current_url}")
        return userInput
        """
        import subprocess
        result = subprocess.run(['osascript', '-e', script], capture_output=True, text=True)
        url = result.stdout.strip()
        if url and url.startswith('http'):
            calendar_sync.ics_url = url
            # Auto-enable và sync
            CONFIG.calendar_enabled = True
            calendar_sync.enabled = True
            save_config(CONFIG, INTERVALS)
            calendar_sync.start_background_sync()
            send_notification("✅ ICS URL đã lưu!", "Đang sync lịch... Sẽ tự pause khi có meeting!")
        elif url and not url.startswith('http'):
            send_notification("❌ URL không hợp lệ", "URL phải bắt đầu bằng https://")

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
                now = datetime.now()
                current_minute = now.minute

                if current_minute != last_minute:
                    last_minute = current_minute

                    # Kiểm tra các mốc đặc biệt (luôn chạy)
                    self.check_special_times(now)

                    # Skip reminders if paused, focus mode, or pomodoro
                    if self.tracker.is_paused:
                        time.sleep(5)
                        continue

                    if self.tracker.is_focus_active() or self.tracker.is_pomodoro_active():
                        time.sleep(5)
                        continue

                    # Auto-pause nếu đang trong meeting (ICS Calendar)
                    if CONFIG.calendar_enabled and calendar_sync.is_configured:
                        should_pause, reason = calendar_sync.should_pause_reminders()
                        if should_pause:
                            if not getattr(self, '_calendar_pause_notified', False):
                                send_notification("⏸️ Tạm dừng nhắc nhở", reason)
                                self._calendar_pause_notified = True
                            time.sleep(30)
                            continue
                        else:
                            self._calendar_pause_notified = False

                    # Reset khi bắt đầu làm việc
                    if is_work_time() and not was_working:
                        self.tracker.reset_all()
                        self.tracker.work_started_today = True
                        was_working = True
                    elif not is_work_time():
                        was_working = False

                    # Kiểm tra nhắc nhở (chỉ trong giờ làm việc)
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

        # Reset daily flags at midnight
        if current_time == (0, 0):
            self.tracker.reset_daily()

        # Morning reminder (7:30 - work_start)
        if is_morning_reminder_window() and not self.tracker.morning_reminded and not self.tracker.work_started_today:
            self.check_morning_startup()

        # Only check work-related times on work days
        if not is_work_day():
            # Sleep reminder still works on weekends
            self.check_sleep_reminder(current_time)
            return

        # Lunch time (not for Saturday half-day)
        if current_time == CONFIG.lunch_start and not is_half_day():
            send_notification("🍚 Giờ ăn trưa!", "Đi lấy phiếu ăn cơm thôi!")

        # Resume after lunch
        if current_time == CONFIG.work_resume and not is_half_day():
            send_notification("💼 Hết nghỉ trưa!", "Bắt đầu làm việc lại! Fighting! 💪")
            self.tracker.reset_all()

        # Work end
        today_end = get_today_work_end()
        if current_time == today_end:
            end_str = f"{today_end[0]:02d}:{today_end[1]:02d}"
            choice = send_alert_with_options(
                "🏠 Hết giờ làm!",
                f"Đã {end_str}! Bạn muốn:",
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

        # Sleep reminder
        self.check_sleep_reminder(current_time)

    def check_morning_startup(self):
        """Nhắc bắt đầu làm việc buổi sáng"""
        self.tracker.morning_reminded = True

        ws = CONFIG.work_start
        choice = send_alert_with_options(
            "🌅 Chuẩn bị làm việc!",
            f"Sắp đến giờ làm việc ({ws[0]:02d}:{ws[1]:02d}).\\nBạn đã sẵn sàng chưa?",
            ["Bắt đầu ngay!", "Nhắc lại sau", "Hôm nay nghỉ"]
        )

        if "Bắt đầu ngay" in choice:
            self.tracker.work_started_today = True
            self.tracker.reset_all()
            send_notification("💪 Bắt đầu làm việc!", "Chúc bạn một ngày làm việc hiệu quả!")
        elif "Hôm nay nghỉ" in choice:
            send_notification("😴 Nghỉ ngơi", "OK! Hẹn gặp bạn ngày mai!")
        else:
            # Nhắc lại sau - reset flag để nhắc lại
            self.tracker.morning_reminded = False

    def check_sleep_reminder(self, current_time: tuple):
        """Kiểm tra nhắc ngủ"""
        if self.tracker.sleep_reminded:
            return

        if current_time == CONFIG.sleep_reminder_time:
            self.tracker.sleep_reminded = True
            st = CONFIG.sleep_reminder_time
            choice = send_alert_with_options(
                "🌙 Đến giờ ngủ rồi!",
                f"Đã {st[0]:02d}:{st[1]:02d} rồi!\\n\\nNgủ đủ giấc giúp:\\n- Tăng cường trí nhớ\\n- Phục hồi sức khỏe\\n- Giảm stress",
                ["Đi ngủ 😴", "Thêm 30 phút", "Bỏ qua"]
            )

            if "Đi ngủ" in choice:
                send_notification("😴 Chúc ngủ ngon!", "Hẹn gặp bạn sáng mai! 🌅")
            elif "Thêm 30 phút" in choice:
                self.tracker.sleep_reminded = False  # Will remind again
                send_notification("⏰ Nhắc lại", "Sẽ nhắc lại sau 30 phút!")
    
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
            msg = water_tracker.get_reminder_message()
            send_notification("💧 Uống nước!", msg)
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
