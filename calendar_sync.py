#!/usr/bin/env python3
"""
Calendar Sync via ICS - Tích hợp lịch qua ICS URL
===================================================
Hỗ trợ: Google Calendar, Outlook, Apple Calendar, bất kỳ app nào có ICS link

Cách lấy ICS link:
  Google Calendar:
    Settings → tên calendar → "Secret address in iCal format" → Copy link
  Outlook:
    Calendar → Share → Get a link → ICS
  Apple Calendar:
    Right-click calendar → Share Calendar → Copy link

Không cần login, không cần credentials.
Cross-platform: macOS + Windows.
"""

import json
import os
import threading
import time
import urllib.request
import urllib.error
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional, List


# ============================================
# PATHS & STORAGE
# ============================================

def get_data_dir() -> Path:
    """Lấy thư mục lưu data (cross-platform)"""
    if os.name == 'nt':  # Windows
        base = Path(os.environ.get('APPDATA', Path.home()))
    else:  # macOS / Linux
        base = Path.home() / 'Library' / 'Application Support'
    data_dir = base / 'WorkHealthReminder'
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir


CACHE_FILE = get_data_dir() / 'ics_events_cache.json'
CONFIG_FILE = get_data_dir() / 'calendar_config.json'
SYNC_INTERVAL_MINUTES = 30


# ============================================
# CONFIG (ICS URL)
# ============================================

def load_calendar_config() -> dict:
    """Đọc config ICS"""
    try:
        if CONFIG_FILE.exists():
            with open(CONFIG_FILE, 'r') as f:
                return json.load(f)
    except Exception:
        pass
    return {'ics_url': '', 'enabled': False}


def save_calendar_config(config: dict):
    """Lưu config ICS"""
    try:
        with open(CONFIG_FILE, 'w') as f:
            json.dump(config, f, indent=2)
    except Exception as e:
        print(f"[Calendar] Error saving config: {e}")


# ============================================
# ICS PARSER (built-in, không cần thư viện)
# ============================================

def _parse_ics_datetime(dt_str: str) -> Optional[datetime]:
    """
    Parse ICS datetime string → datetime với timezone.
    Hỗ trợ: 20260222T090000Z, 20260222T160000, 20260222
    """
    if not dt_str:
        return None
    try:
        dt_str = dt_str.strip()
        if 'Z' in dt_str:
            # UTC time
            dt = datetime.strptime(dt_str, '%Y%m%dT%H%M%SZ')
            return dt.replace(tzinfo=timezone.utc)
        elif 'T' in dt_str:
            # Local time (no timezone info)
            dt = datetime.strptime(dt_str, '%Y%m%dT%H%M%S')
            # Treat as local timezone
            local_tz = datetime.now().astimezone().tzinfo
            return dt.replace(tzinfo=local_tz)
        else:
            # All-day date: 20260222
            dt = datetime.strptime(dt_str, '%Y%m%d')
            return dt.replace(tzinfo=timezone.utc)
    except Exception:
        return None


def _parse_ics_content(ics_text: str) -> List[dict]:
    """
    Parse ICS text → list of event dicts.
    Pure Python, không cần thư viện ngoài.
    """
    events = []
    current_event = None
    lines = ics_text.splitlines()

    # Handle line folding (ICS spec: long lines bắt đầu bằng space/tab)
    unfolded = []
    for line in lines:
        if line.startswith((' ', '\t')) and unfolded:
            unfolded[-1] += line[1:]
        else:
            unfolded.append(line)

    for line in unfolded:
        line = line.strip()

        if line == 'BEGIN:VEVENT':
            current_event = {
                'summary': '',
                'start': None,
                'end': None,
                'is_all_day': False,
            }

        elif line == 'END:VEVENT' and current_event is not None:
            if current_event.get('start'):
                events.append(current_event)
            current_event = None

        elif current_event is not None:
            if line.startswith('SUMMARY'):
                # SUMMARY hoặc SUMMARY;LANGUAGE=...
                value = line.split(':', 1)[-1]
                current_event['summary'] = value.strip()

            elif line.startswith('DTSTART'):
                value = line.split(':', 1)[-1].strip()
                # Check all-day (chỉ có date, không có time)
                if 'T' not in value and 'Z' not in value and len(value) == 8:
                    current_event['is_all_day'] = True
                current_event['start'] = _parse_ics_datetime(value)

            elif line.startswith('DTEND'):
                value = line.split(':', 1)[-1].strip()
                current_event['end'] = _parse_ics_datetime(value)

            elif line.startswith('STATUS'):
                value = line.split(':', 1)[-1].strip()
                current_event['status'] = value  # CONFIRMED, CANCELLED, etc.

    return events


# ============================================
# CACHE
# ============================================

def save_cache(events: list):
    """Serialize và lưu events cache"""
    try:
        serializable = []
        for e in events:
            serializable.append({
                'summary': e.get('summary', ''),
                'start': e['start'].isoformat() if e.get('start') else None,
                'end': e['end'].isoformat() if e.get('end') else None,
                'is_all_day': e.get('is_all_day', False),
                'status': e.get('status', 'CONFIRMED'),
            })
        with open(CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump({
                'synced_at': datetime.now().isoformat(),
                'events': serializable
            }, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"[Calendar] Error saving cache: {e}")


def load_cache() -> List[dict]:
    """Đọc events từ cache, deserialize datetime"""
    try:
        if CACHE_FILE.exists():
            with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
            result = []
            for e in data.get('events', []):
                start_str = e.get('start')
                end_str = e.get('end')
                result.append({
                    'summary': e.get('summary', ''),
                    'start': datetime.fromisoformat(start_str) if start_str else None,
                    'end': datetime.fromisoformat(end_str) if end_str else None,
                    'is_all_day': e.get('is_all_day', False),
                    'status': e.get('status', 'CONFIRMED'),
                })
            return result
    except Exception:
        pass
    return []


# ============================================
# CALENDAR SYNC CLASS
# ============================================

class CalendarSync:
    def __init__(self):
        self._config = load_calendar_config()
        self._events: List[dict] = load_cache()
        self._lock = threading.Lock()
        self._last_sync: Optional[datetime] = None
        self._last_error: str = ''
        self._sync_thread: Optional[threading.Thread] = None
        self._running = False

    # ── Properties ──────────────────────────────────────────────────────────

    @property
    def ics_url(self) -> str:
        return self._config.get('ics_url', '').strip()

    @ics_url.setter
    def ics_url(self, url: str):
        self._config['ics_url'] = url.strip()
        save_calendar_config(self._config)

    @property
    def enabled(self) -> bool:
        return self._config.get('enabled', False) and bool(self.ics_url)

    @enabled.setter
    def enabled(self, value: bool):
        self._config['enabled'] = value
        save_calendar_config(self._config)

    @property
    def is_configured(self) -> bool:
        return bool(self.ics_url)

    # ── Sync ────────────────────────────────────────────────────────────────

    def start_background_sync(self):
        """Bắt đầu sync background mỗi 30 phút"""
        if self._running:
            return
        self._running = True

        def sync_loop():
            self._sync_now()
            while self._running:
                time.sleep(SYNC_INTERVAL_MINUTES * 60)
                if self._running:
                    self._sync_now()

        self._sync_thread = threading.Thread(target=sync_loop, daemon=True)
        self._sync_thread.start()

    def stop_background_sync(self):
        self._running = False

    def _sync_now(self):
        """Fetch ICS URL và parse events"""
        if not self.ics_url:
            return

        try:
            req = urllib.request.Request(
                self.ics_url,
                headers={'User-Agent': 'WorkHealthReminder/3.0'}
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                ics_text = resp.read().decode('utf-8', errors='replace')

            events = _parse_ics_content(ics_text)

            # Chỉ giữ events trong 7 ngày tới để tiết kiệm memory
            now = datetime.now(timezone.utc)
            week_later = now + timedelta(days=7)
            events = [
                e for e in events
                if e.get('start') and e['start'] <= week_later
                and e.get('status', 'CONFIRMED') != 'CANCELLED'
            ]

            with self._lock:
                self._events = events
                self._last_sync = datetime.now()
                self._last_error = ''

            save_cache(events)
            print(f"[Calendar] Synced {len(events)} events at {self._last_sync.strftime('%H:%M')}")

        except urllib.error.URLError as e:
            self._last_error = f"Lỗi kết nối: {e.reason}"
            print(f"[Calendar] URLError: {e}")
        except Exception as e:
            self._last_error = str(e)
            print(f"[Calendar] Error: {e}")

    def sync_now_async(self):
        """Sync trong background thread (gọi từ UI)"""
        threading.Thread(target=self._sync_now, daemon=True).start()

    # ── Meeting Detection ────────────────────────────────────────────────────

    def get_current_meeting(self) -> Optional[dict]:
        """Trả về event nếu đang trong meeting"""
        now = datetime.now(timezone.utc)
        with self._lock:
            events = list(self._events)

        for event in events:
            if event.get('is_all_day'):
                continue
            start = event.get('start')
            end = event.get('end')
            if start and end and start <= now <= end:
                return event
        return None

    def get_upcoming_meeting(self, within_minutes: int = 5) -> Optional[dict]:
        """Trả về event sắp diễn ra trong X phút"""
        now = datetime.now(timezone.utc)
        soon = now + timedelta(minutes=within_minutes)
        with self._lock:
            events = list(self._events)

        for event in events:
            if event.get('is_all_day'):
                continue
            start = event.get('start')
            if start and now <= start <= soon:
                return event
        return None

    def should_pause_reminders(self) -> tuple:
        """
        Kiểm tra có nên pause reminders không.
        Returns: (should_pause: bool, reason: str)
        """
        if not self.enabled:
            return False, ""

        meeting = self.get_current_meeting()
        if meeting:
            name = meeting.get('summary', 'Meeting')
            return True, f"📅 Đang trong: {name}"

        upcoming = self.get_upcoming_meeting(within_minutes=3)
        if upcoming:
            name = upcoming.get('summary', 'Meeting')
            return True, f"📅 Sắp có: {name} (3 phút nữa)"

        return False, ""

    def get_today_meetings(self) -> List[dict]:
        """Danh sách meetings hôm nay"""
        today = datetime.now().date()
        with self._lock:
            events = list(self._events)

        result = []
        for e in events:
            if e.get('is_all_day'):
                continue
            start = e.get('start')
            if start:
                # Convert to local date for comparison
                local_start = start.astimezone().date() if start.tzinfo else start.date()
                if local_start == today:
                    result.append(e)

        return sorted(result, key=lambda e: e.get('start') or datetime.min.replace(tzinfo=timezone.utc))

    # ── Status ───────────────────────────────────────────────────────────────

    def get_status_text(self) -> str:
        """Text hiển thị trên menu"""
        if not self.is_configured:
            return "⚙️ Chưa có ICS URL"
        if self._last_error:
            return f"❌ {self._last_error}"
        if self._last_sync:
            ago = int((datetime.now() - self._last_sync).total_seconds() / 60)
            count = len(self._events)
            return f"✅ Synced {ago} phút trước · {count} events"
        if self._events:
            return f"📦 Từ cache · {len(self._events)} events"
        return "🔄 Chưa sync"


# Singleton instance
calendar_sync = CalendarSync()
