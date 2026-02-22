#!/usr/bin/env python3
"""
Water Tracker - Theo dõi lượng nước uống hàng ngày
===================================================
- Lưu local vào ~/.work-health/water_log.json
- Reset tự động lúc 00:00 mỗi ngày
- Mục tiêu mặc định: 2000ml/ngày (user có thể sửa)
"""

import json
import os
from datetime import datetime
from pathlib import Path


# ============================================
# STORAGE
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


def get_water_log_path() -> Path:
    return get_data_dir() / 'water_log.json'


def load_water_log() -> dict:
    """Đọc water log, auto reset nếu sang ngày mới"""
    path = get_water_log_path()
    today = datetime.now().strftime('%Y-%m-%d')

    if path.exists():
        try:
            with open(path, 'r') as f:
                data = json.load(f)
            # Reset nếu sang ngày mới
            if data.get('date') != today:
                data = _new_log(today)
                save_water_log(data)
            return data
        except Exception:
            pass

    data = _new_log(today)
    save_water_log(data)
    return data


def _new_log(date: str) -> dict:
    return {
        'date': date,
        'total_ml': 0,
        'entries': [],       # [{'time': 'HH:MM', 'ml': 200}, ...]
        'goal_ml': 2000,     # Default 2000ml, user có thể sửa
        'cup_size_ml': 200,  # Default cup size
    }


def save_water_log(data: dict):
    """Lưu water log"""
    try:
        with open(get_water_log_path(), 'w') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Error saving water log: {e}")


# ============================================
# TRACKER CLASS
# ============================================

class WaterTracker:
    def __init__(self):
        self._data = load_water_log()

    def _refresh(self):
        """Reload và check ngày mới"""
        self._data = load_water_log()

    @property
    def total_ml(self) -> int:
        self._refresh()
        return self._data.get('total_ml', 0)

    @property
    def goal_ml(self) -> int:
        return self._data.get('goal_ml', 2000)

    @goal_ml.setter
    def goal_ml(self, value: int):
        self._data['goal_ml'] = value
        save_water_log(self._data)

    @property
    def cup_size_ml(self) -> int:
        return self._data.get('cup_size_ml', 200)

    @cup_size_ml.setter
    def cup_size_ml(self, value: int):
        self._data['cup_size_ml'] = value
        save_water_log(self._data)

    @property
    def progress_pct(self) -> int:
        """% đã uống so với mục tiêu (0-100)"""
        goal = self.goal_ml
        if goal <= 0:
            return 100
        return min(100, int(self.total_ml * 100 / goal))

    @property
    def remaining_ml(self) -> int:
        return max(0, self.goal_ml - self.total_ml)

    def add_water(self, ml: int) -> dict:
        """Ghi nhận uống nước, trả về state hiện tại"""
        self._refresh()
        self._data['total_ml'] = self._data.get('total_ml', 0) + ml
        self._data['entries'].append({
            'time': datetime.now().strftime('%H:%M'),
            'ml': ml
        })
        save_water_log(self._data)
        return self.get_status()

    def get_status(self) -> dict:
        """Trả về status đầy đủ"""
        self._refresh()
        pct = self.progress_pct
        return {
            'total_ml': self.total_ml,
            'goal_ml': self.goal_ml,
            'remaining_ml': self.remaining_ml,
            'pct': pct,
            'progress_bar': _make_progress_bar(pct),
            'status_icon': _status_icon(pct),
            'menu_title': f"💧 {self.total_ml}/{self.goal_ml}ml ({pct}%)",
            'entries_today': len(self._data.get('entries', [])),
        }

    def get_reminder_message(self) -> str:
        """Message cho notification nhắc uống nước"""
        status = self.get_status()
        if status['pct'] >= 100:
            return f"💧 Đã đạt mục tiêu {self.goal_ml}ml hôm nay! 🎉 Tiếp tục giữ nước nhé!"
        return (
            f"Hôm nay: {self.total_ml}/{self.goal_ml}ml — "
            f"còn {self.remaining_ml}ml nữa!"
        )

    def reset_today(self):
        """Reset data hôm nay (manual)"""
        today = datetime.now().strftime('%Y-%m-%d')
        self._data = _new_log(today)
        self._data['goal_ml'] = self.goal_ml  # giữ lại goal
        self._data['cup_size_ml'] = self.cup_size_ml  # giữ lại cup size
        save_water_log(self._data)


# ============================================
# HELPERS
# ============================================

def _make_progress_bar(pct: int, length: int = 16) -> str:
    filled = int(length * pct / 100)
    empty = length - filled
    return '█' * filled + '░' * empty


def _status_icon(pct: int) -> str:
    if pct >= 100:
        return '🔵'  # Đủ nước
    elif pct >= 60:
        return '🟢'  # Ổn
    elif pct >= 30:
        return '🟡'  # Cần uống thêm
    else:
        return '🔴'  # Thiếu nước nhiều


# Singleton instance
water_tracker = WaterTracker()
