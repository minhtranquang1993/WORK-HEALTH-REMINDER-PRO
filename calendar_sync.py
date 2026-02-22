#!/usr/bin/env python3
"""
Google Calendar Sync - Tích hợp Google Calendar
=================================================
- OAuth2 lần đầu, sau đó dùng token local
- Cache events xuống local JSON → offline vẫn hoạt động
- Sync background mỗi 30 phút
- Cross-platform: macOS + Windows

Cài đặt:
  pip install google-auth google-auth-oauthlib google-auth-httplib2 google-api-python-client

Setup lần đầu:
  1. Vào https://console.cloud.google.com
  2. Tạo project → Enable Google Calendar API
  3. Tạo OAuth2 credentials (Desktop app) → Download JSON
  4. Đặt file vào ~/.work-health/google_credentials.json
  5. Chạy app lần đầu → browser mở để auth
"""

import json
import os
import threading
import time
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


CREDENTIALS_FILE = get_data_dir() / 'google_credentials.json'
TOKEN_FILE = get_data_dir() / 'google_calendar_token.json'
CACHE_FILE = get_data_dir() / 'events_cache.json'

SCOPES = ['https://www.googleapis.com/auth/calendar.readonly']
SYNC_INTERVAL_MINUTES = 30


# ============================================
# CACHE
# ============================================

def save_cache(events: list):
    """Lưu events xuống cache"""
    try:
        with open(CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump({
                'synced_at': datetime.now().isoformat(),
                'events': events
            }, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"[Calendar] Error saving cache: {e}")


def load_cache() -> list:
    """Đọc events từ cache"""
    try:
        if CACHE_FILE.exists():
            with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return data.get('events', [])
    except Exception:
        pass
    return []


# ============================================
# AUTH & API
# ============================================

def _get_credentials():
    """Lấy/refresh Google OAuth2 credentials"""
    try:
        from google.auth.transport.requests import Request
        from google.oauth2.credentials import Credentials
        from google_auth_oauthlib.flow import InstalledAppFlow
    except ImportError:
        return None

    creds = None

    # Load token nếu đã có
    if TOKEN_FILE.exists():
        try:
            creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), SCOPES)
        except Exception:
            pass

    # Refresh hoặc auth mới
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
            except Exception:
                creds = None

        if not creds:
            if not CREDENTIALS_FILE.exists():
                return None
            flow = InstalledAppFlow.from_client_secrets_file(str(CREDENTIALS_FILE), SCOPES)
            creds = flow.run_local_server(port=0)

        # Lưu token
        with open(TOKEN_FILE, 'w') as f:
            f.write(creds.to_json())

    return creds


def _fetch_events_from_api() -> Optional[list]:
    """Fetch events từ Google Calendar API"""
    try:
        from googleapiclient.discovery import build
        from googleapiclient.errors import HttpError
    except ImportError:
        return None

    creds = _get_credentials()
    if not creds:
        return None

    try:
        service = build('calendar', 'v3', credentials=creds)

        # Lấy events trong 24h tới
        now = datetime.now(timezone.utc)
        time_min = now.isoformat()
        time_max = (now + timedelta(hours=24)).isoformat()

        result = service.events().list(
            calendarId='primary',
            timeMin=time_min,
            timeMax=time_max,
            singleEvents=True,
            orderBy='startTime',
            maxResults=50
        ).execute()

        events = result.get('items', [])

        # Normalize để lưu cache
        normalized = []
        for e in events:
            start = e.get('start', {})
            end = e.get('end', {})
            normalized.append({
                'id': e.get('id', ''),
                'summary': e.get('summary', '(No title)'),
                'start': start.get('dateTime', start.get('date', '')),
                'end': end.get('dateTime', end.get('date', '')),
                'is_all_day': 'date' in start and 'dateTime' not in start,
            })

        return normalized

    except Exception as e:
        print(f"[Calendar] API error: {e}")
        return None


# ============================================
# CALENDAR SYNC CLASS
# ============================================

class CalendarSync:
    def __init__(self):
        self._events: List[dict] = load_cache()
        self._lock = threading.Lock()
        self._last_sync: Optional[datetime] = None
        self._available = self._check_libs()
        self._sync_thread: Optional[threading.Thread] = None

    def _check_libs(self) -> bool:
        """Kiểm tra thư viện đã cài chưa"""
        try:
            import google.auth
            import googleapiclient
            return True
        except ImportError:
            return False

    @property
    def is_available(self) -> bool:
        """Calendar sync có khả dụng không"""
        return self._available and CREDENTIALS_FILE.exists()

    @property
    def is_configured(self) -> bool:
        """Đã setup credentials chưa"""
        return CREDENTIALS_FILE.exists()

    def start_background_sync(self):
        """Bắt đầu sync background mỗi 30 phút"""
        if not self.is_available:
            return

        def sync_loop():
            # Sync ngay lần đầu
            self._sync_now()
            while True:
                time.sleep(SYNC_INTERVAL_MINUTES * 60)
                self._sync_now()

        self._sync_thread = threading.Thread(target=sync_loop, daemon=True)
        self._sync_thread.start()

    def _sync_now(self):
        """Sync ngay lập tức"""
        events = _fetch_events_from_api()
        if events is not None:
            with self._lock:
                self._events = events
                self._last_sync = datetime.now()
            save_cache(events)
            print(f"[Calendar] Synced {len(events)} events at {self._last_sync.strftime('%H:%M')}")

    def get_current_meeting(self) -> Optional[dict]:
        """
        Kiểm tra có đang trong meeting không.
        Trả về event dict nếu có, None nếu không.
        """
        now = datetime.now(timezone.utc)

        with self._lock:
            events = list(self._events)

        for event in events:
            if event.get('is_all_day'):
                continue  # Bỏ qua all-day events

            try:
                start_str = event.get('start', '')
                end_str = event.get('end', '')
                if not start_str or not end_str:
                    continue

                start = _parse_dt(start_str)
                end = _parse_dt(end_str)

                if start and end and start <= now <= end:
                    return event
            except Exception:
                continue

        return None

    def get_upcoming_meeting(self, within_minutes: int = 5) -> Optional[dict]:
        """
        Kiểm tra có meeting sắp diễn ra trong X phút không.
        """
        now = datetime.now(timezone.utc)
        soon = now + timedelta(minutes=within_minutes)

        with self._lock:
            events = list(self._events)

        for event in events:
            if event.get('is_all_day'):
                continue

            try:
                start_str = event.get('start', '')
                if not start_str:
                    continue

                start = _parse_dt(start_str)
                if start and now <= start <= soon:
                    return event
            except Exception:
                continue

        return None

    def should_pause_reminders(self) -> tuple:
        """
        Kiểm tra có nên pause reminders không.
        Returns: (should_pause: bool, reason: str)
        """
        meeting = self.get_current_meeting()
        if meeting:
            name = meeting.get('summary', 'Meeting')
            return True, f"📅 Đang trong: {name}"

        upcoming = self.get_upcoming_meeting(within_minutes=3)
        if upcoming:
            name = upcoming.get('summary', 'Meeting')
            return True, f"📅 Sắp có: {name} (3 phút nữa)"

        return False, ""

    def get_status_text(self) -> str:
        """Text hiển thị trên menu"""
        if not self._available:
            return "⚠️ Cần cài: pip install google-api-python-client"
        if not self.is_configured:
            return "⚙️ Chưa setup credentials"
        if self._last_sync:
            ago = int((datetime.now() - self._last_sync).total_seconds() / 60)
            return f"✅ Synced {ago} phút trước ({len(self._events)} events)"
        if self._events:
            return f"📦 Từ cache ({len(self._events)} events)"
        return "🔄 Chưa sync"

    def get_today_meetings(self) -> List[dict]:
        """Lấy danh sách meetings hôm nay"""
        today = datetime.now().date()
        result = []

        with self._lock:
            events = list(self._events)

        for event in events:
            if event.get('is_all_day'):
                continue
            try:
                start = _parse_dt(event.get('start', ''))
                if start and start.date() == today:
                    result.append(event)
            except Exception:
                continue

        return sorted(result, key=lambda e: e.get('start', ''))


# ============================================
# HELPERS
# ============================================

def _parse_dt(dt_str: str) -> Optional[datetime]:
    """Parse ISO datetime string → datetime với timezone"""
    if not dt_str:
        return None
    try:
        # Python 3.7+ fromisoformat không handle 'Z'
        dt_str = dt_str.replace('Z', '+00:00')
        dt = datetime.fromisoformat(dt_str)
        # Ensure timezone-aware
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


# Singleton instance
calendar_sync = CalendarSync()
