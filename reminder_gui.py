#!/usr/bin/env python3
"""
Work Health Reminder GUI - Ứng dụng nhắc nhở sức khỏe với giao diện đẹp
=======================================================================
"""

import tkinter as tk
from tkinter import ttk, messagebox
import subprocess
import threading
import time
from datetime import datetime
import sys

# Màu sắc theme
COLORS = {
    'bg_dark': '#1a1a2e',
    'bg_card': '#16213e',
    'accent': '#0f3460',
    'primary': '#e94560',
    'success': '#00d9ff',
    'warning': '#ffc107',
    'text': '#ffffff',
    'text_dim': '#a0a0a0',
    'water': '#00bcd4',
    'walk': '#4caf50',
    'toilet': '#ff9800',
    'food': '#e91e63',
    'home': '#9c27b0'
}

# Cấu hình thời gian
CONFIG = {
    'work_start': (8, 0),
    'lunch_start': (11, 30),
    'work_resume': (13, 0),
    'work_end': (17, 30),
    'walk_interval': 30,
    'water_interval': 45,
    'toilet_interval': 60
}


class WorkHealthReminderGUI:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("🏃 Work Health Reminder")
        self.root.geometry("500x700")
        self.root.configure(bg=COLORS['bg_dark'])
        self.root.resizable(False, False)
        
        # Trạng thái
        self.is_running = False
        self.reminder_thread = None
        self.last_walk = None
        self.last_water = None
        self.last_toilet = None
        
        # Đếm số lần nhắc
        self.walk_count = 0
        self.water_count = 0
        self.toilet_count = 0
        
        self.setup_ui()
        self.update_clock()
        
    def setup_ui(self):
        """Tạo giao diện"""
        # Header
        header_frame = tk.Frame(self.root, bg=COLORS['bg_dark'])
        header_frame.pack(fill='x', pady=20)
        
        title = tk.Label(
            header_frame, 
            text="🏃 Work Health Reminder",
            font=('SF Pro Display', 24, 'bold'),
            bg=COLORS['bg_dark'],
            fg=COLORS['text']
        )
        title.pack()
        
        subtitle = tk.Label(
            header_frame,
            text="Giữ sức khỏe trong giờ làm việc",
            font=('SF Pro Display', 12),
            bg=COLORS['bg_dark'],
            fg=COLORS['text_dim']
        )
        subtitle.pack(pady=(5, 0))
        
        # Clock & Status
        clock_frame = tk.Frame(self.root, bg=COLORS['bg_card'], padx=30, pady=20)
        clock_frame.pack(fill='x', padx=20, pady=10)
        
        self.clock_label = tk.Label(
            clock_frame,
            text="00:00:00",
            font=('SF Mono', 40, 'bold'),
            bg=COLORS['bg_card'],
            fg=COLORS['success']
        )
        self.clock_label.pack()
        
        self.status_label = tk.Label(
            clock_frame,
            text="⏸️ Chưa bắt đầu",
            font=('SF Pro Display', 14),
            bg=COLORS['bg_card'],
            fg=COLORS['text_dim']
        )
        self.status_label.pack(pady=(10, 0))
        
        # Start/Stop Button
        self.toggle_btn = tk.Button(
            self.root,
            text="▶️  BẮT ĐẦU",
            font=('SF Pro Display', 16, 'bold'),
            bg=COLORS['success'],
            fg=COLORS['bg_dark'],
            activebackground=COLORS['primary'],
            activeforeground=COLORS['text'],
            relief='flat',
            cursor='hand2',
            padx=40,
            pady=15,
            command=self.toggle_reminder
        )
        self.toggle_btn.pack(pady=20)
        
        # Reminder Cards
        cards_frame = tk.Frame(self.root, bg=COLORS['bg_dark'])
        cards_frame.pack(fill='x', padx=20, pady=10)
        
        # Walking card
        self.walk_card = self.create_card(
            cards_frame, 
            "🚶", "Đi bộ", 
            f"Mỗi {CONFIG['walk_interval']} phút",
            COLORS['walk']
        )
        self.walk_card.pack(fill='x', pady=5)
        
        # Water card
        self.water_card = self.create_card(
            cards_frame,
            "💧", "Uống nước",
            f"Mỗi {CONFIG['water_interval']} phút",
            COLORS['water']
        )
        self.water_card.pack(fill='x', pady=5)
        
        # Toilet card
        self.toilet_card = self.create_card(
            cards_frame,
            "🚽", "Toilet",
            f"Mỗi {CONFIG['toilet_interval']} phút",
            COLORS['toilet']
        )
        self.toilet_card.pack(fill='x', pady=5)
        
        # Special times
        special_frame = tk.Frame(self.root, bg=COLORS['bg_dark'])
        special_frame.pack(fill='x', padx=20, pady=10)
        
        special_title = tk.Label(
            special_frame,
            text="📅 Mốc thời gian đặc biệt",
            font=('SF Pro Display', 14, 'bold'),
            bg=COLORS['bg_dark'],
            fg=COLORS['text']
        )
        special_title.pack(anchor='w', pady=(0, 10))
        
        times_text = """
• 08:00 - Bắt đầu làm việc
• 11:30 - Đi lấy phiếu cơm 🍚
• 13:00 - Làm việc lại
• 17:30 - Đi về (chọn đón người yêu/về nhà)
        """
        times_label = tk.Label(
            special_frame,
            text=times_text.strip(),
            font=('SF Pro Display', 12),
            bg=COLORS['bg_dark'],
            fg=COLORS['text_dim'],
            justify='left'
        )
        times_label.pack(anchor='w')
        
        # Stats frame
        stats_frame = tk.Frame(self.root, bg=COLORS['bg_card'], padx=20, pady=15)
        stats_frame.pack(fill='x', padx=20, pady=10)
        
        stats_title = tk.Label(
            stats_frame,
            text="📊 Thống kê hôm nay",
            font=('SF Pro Display', 12, 'bold'),
            bg=COLORS['bg_card'],
            fg=COLORS['text']
        )
        stats_title.pack(anchor='w')
        
        self.stats_label = tk.Label(
            stats_frame,
            text="🚶 0 lần  |  💧 0 lần  |  🚽 0 lần",
            font=('SF Pro Display', 11),
            bg=COLORS['bg_card'],
            fg=COLORS['text_dim']
        )
        self.stats_label.pack(anchor='w', pady=(5, 0))
        
        # Footer
        footer = tk.Label(
            self.root,
            text="Nhấn nút để bật/tắt nhắc nhở",
            font=('SF Pro Display', 10),
            bg=COLORS['bg_dark'],
            fg=COLORS['text_dim']
        )
        footer.pack(side='bottom', pady=10)
    
    def create_card(self, parent, icon, title, subtitle, color):
        """Tạo card cho mỗi loại nhắc nhở"""
        card = tk.Frame(parent, bg=COLORS['bg_card'], padx=15, pady=12)
        
        # Icon
        icon_label = tk.Label(
            card,
            text=icon,
            font=('SF Pro Display', 24),
            bg=COLORS['bg_card']
        )
        icon_label.pack(side='left')
        
        # Text container
        text_frame = tk.Frame(card, bg=COLORS['bg_card'])
        text_frame.pack(side='left', padx=15, fill='x', expand=True)
        
        title_label = tk.Label(
            text_frame,
            text=title,
            font=('SF Pro Display', 14, 'bold'),
            bg=COLORS['bg_card'],
            fg=COLORS['text'],
            anchor='w'
        )
        title_label.pack(anchor='w')
        
        sub_label = tk.Label(
            text_frame,
            text=subtitle,
            font=('SF Pro Display', 11),
            bg=COLORS['bg_card'],
            fg=COLORS['text_dim'],
            anchor='w'
        )
        sub_label.pack(anchor='w')
        
        # Color indicator
        indicator = tk.Frame(card, bg=color, width=4)
        indicator.pack(side='right', fill='y')
        
        return card
    
    def update_clock(self):
        """Cập nhật đồng hồ mỗi giây"""
        now = datetime.now()
        time_str = now.strftime("%H:%M:%S")
        self.clock_label.config(text=time_str)
        
        # Cập nhật trạng thái
        if self.is_running:
            if self.is_work_time():
                self.status_label.config(text="🟢 Đang làm việc", fg=COLORS['success'])
            elif self.is_lunch_break():
                self.status_label.config(text="🍚 Đang nghỉ trưa", fg=COLORS['warning'])
            else:
                self.status_label.config(text="⚪ Ngoài giờ làm việc", fg=COLORS['text_dim'])
        
        self.root.after(1000, self.update_clock)
    
    def toggle_reminder(self):
        """Bật/tắt nhắc nhở"""
        if self.is_running:
            self.stop_reminder()
        else:
            self.start_reminder()
    
    def start_reminder(self):
        """Bắt đầu nhắc nhở"""
        self.is_running = True
        self.toggle_btn.config(
            text="⏹️  DỪNG LẠI",
            bg=COLORS['primary'],
        )
        self.status_label.config(text="🟢 Đang chạy...", fg=COLORS['success'])
        
        # Reset timers
        now = datetime.now()
        self.last_walk = now
        self.last_water = now
        self.last_toilet = now
        
        # Gửi thông báo bắt đầu
        self.send_notification(
            "✅ Work Health Reminder",
            "Đã bật nhắc nhở! Chúc bạn làm việc hiệu quả!"
        )
        
        # Bắt đầu thread kiểm tra
        self.reminder_thread = threading.Thread(target=self.reminder_loop, daemon=True)
        self.reminder_thread.start()
    
    def stop_reminder(self):
        """Dừng nhắc nhở"""
        self.is_running = False
        self.toggle_btn.config(
            text="▶️  BẮT ĐẦU",
            bg=COLORS['success'],
        )
        self.status_label.config(text="⏸️ Đã dừng", fg=COLORS['text_dim'])
        
        self.send_notification(
            "⏸️ Work Health Reminder",
            "Đã tắt nhắc nhở. Hẹn gặp lại!"
        )
    
    def reminder_loop(self):
        """Vòng lặp kiểm tra nhắc nhở"""
        last_minute = -1
        
        while self.is_running:
            now = datetime.now()
            current_minute = now.minute
            
            if current_minute != last_minute:
                last_minute = current_minute
                
                # Kiểm tra các mốc thời gian đặc biệt
                self.check_special_times()
                
                # Kiểm tra nhắc nhở theo chu kỳ
                if self.is_work_time():
                    self.check_interval_reminders()
            
            time.sleep(1)
    
    def check_special_times(self):
        """Kiểm tra các mốc thời gian đặc biệt"""
        now = datetime.now()
        current_time = (now.hour, now.minute)
        
        if current_time == CONFIG['lunch_start']:
            self.send_notification(
                "🍚 Giờ ăn trưa!",
                "Đi lấy phiếu ăn cơm thôi! Nghỉ trưa đến 13:00 nhé."
            )
        
        elif current_time == CONFIG['work_resume']:
            self.send_notification(
                "💼 Hết giờ nghỉ trưa!",
                "Bắt đầu làm việc lại thôi nào! Fighting! 💪"
            )
        
        elif current_time == CONFIG['work_end']:
            self.show_end_of_day_dialog()
    
    def check_interval_reminders(self):
        """Kiểm tra nhắc nhở theo chu kỳ"""
        now = datetime.now()
        
        # Đi bộ
        if self.last_walk and (now - self.last_walk).total_seconds() >= CONFIG['walk_interval'] * 60:
            self.send_notification(
                "🚶 Đứng dậy đi bộ!",
                f"Đã ngồi {CONFIG['walk_interval']} phút rồi! Đi bộ vài bước nhé!"
            )
            self.last_walk = now
            self.walk_count += 1
            self.update_stats()
        
        # Uống nước
        if self.last_water and (now - self.last_water).total_seconds() >= CONFIG['water_interval'] * 60:
            self.send_notification(
                "💧 Uống nước!",
                f"Đã {CONFIG['water_interval']} phút rồi! Uống một ly nước lọc nhé!"
            )
            self.last_water = now
            self.water_count += 1
            self.update_stats()
        
        # Toilet
        if self.last_toilet and (now - self.last_toilet).total_seconds() >= CONFIG['toilet_interval'] * 60:
            self.send_notification(
                "🚽 Đi toilet!",
                "Đã 1 tiếng rồi! Đi toilet một chút nhé!"
            )
            self.last_toilet = now
            self.toilet_count += 1
            self.update_stats()
    
    def update_stats(self):
        """Cập nhật thống kê"""
        self.stats_label.config(
            text=f"🚶 {self.walk_count} lần  |  💧 {self.water_count} lần  |  🚽 {self.toilet_count} lần"
        )
    
    def show_end_of_day_dialog(self):
        """Hiển thị dialog cuối ngày"""
        def on_girlfriend():
            self.send_notification(
                "💕 Đón người yêu",
                "Đi đón người yêu thôi! Chúc hẹn hò vui vẻ! 🥰"
            )
            dialog.destroy()
        
        def on_home():
            self.send_notification(
                "🏠 Về nhà",
                "Đi về nhà thôi! Nghỉ ngơi và thư giãn nhé! 😊"
            )
            dialog.destroy()
        
        dialog = tk.Toplevel(self.root)
        dialog.title("🏠 Hết giờ làm việc!")
        dialog.geometry("350x200")
        dialog.configure(bg=COLORS['bg_dark'])
        dialog.transient(self.root)
        dialog.grab_set()
        
        # Center dialog
        dialog.geometry(f"+{self.root.winfo_x() + 75}+{self.root.winfo_y() + 200}")
        
        label = tk.Label(
            dialog,
            text="Đã đến 17:30 rồi!\nBạn muốn:",
            font=('SF Pro Display', 16),
            bg=COLORS['bg_dark'],
            fg=COLORS['text']
        )
        label.pack(pady=20)
        
        btn_frame = tk.Frame(dialog, bg=COLORS['bg_dark'])
        btn_frame.pack(pady=20)
        
        gf_btn = tk.Button(
            btn_frame,
            text="💕 Đón người yêu",
            font=('SF Pro Display', 14),
            bg=COLORS['primary'],
            fg=COLORS['text'],
            relief='flat',
            padx=20,
            pady=10,
            command=on_girlfriend
        )
        gf_btn.pack(side='left', padx=10)
        
        home_btn = tk.Button(
            btn_frame,
            text="🏠 Về nhà",
            font=('SF Pro Display', 14),
            bg=COLORS['success'],
            fg=COLORS['bg_dark'],
            relief='flat',
            padx=20,
            pady=10,
            command=on_home
        )
        home_btn.pack(side='left', padx=10)
    
    def is_work_time(self) -> bool:
        """Kiểm tra có đang trong giờ làm việc không"""
        now = datetime.now()
        current = now.hour * 60 + now.minute
        
        work_start = CONFIG['work_start'][0] * 60 + CONFIG['work_start'][1]
        lunch_start = CONFIG['lunch_start'][0] * 60 + CONFIG['lunch_start'][1]
        work_resume = CONFIG['work_resume'][0] * 60 + CONFIG['work_resume'][1]
        work_end = CONFIG['work_end'][0] * 60 + CONFIG['work_end'][1]
        
        morning = work_start <= current < lunch_start
        afternoon = work_resume <= current < work_end
        
        return morning or afternoon
    
    def is_lunch_break(self) -> bool:
        """Kiểm tra có đang nghỉ trưa không"""
        now = datetime.now()
        current = now.hour * 60 + now.minute
        
        lunch_start = CONFIG['lunch_start'][0] * 60 + CONFIG['lunch_start'][1]
        work_resume = CONFIG['work_resume'][0] * 60 + CONFIG['work_resume'][1]
        
        return lunch_start <= current < work_resume
    
    def send_notification(self, title: str, message: str):
        """Gửi thông báo Windows/macOS"""
        import platform
        
        if platform.system() == "Windows":
            try:
                # Thử dùng win10toast nếu có
                from win10toast import ToastNotifier
                toaster = ToastNotifier()
                toaster.show_toast(title, message, duration=5, threaded=True)
            except ImportError:
                # Fallback: dùng tkinter notification
                self.root.after(0, lambda: messagebox.showinfo(title, message))
        else:
            # macOS
            script = f'''
            display notification "{message}" with title "{title}" sound name "Glass"
            '''
            subprocess.run(['osascript', '-e', script], capture_output=True)
        
        print(f"🔔 [{datetime.now().strftime('%H:%M:%S')}] {title}: {message}")
    
    def run(self):
        """Chạy ứng dụng"""
        # Center window
        self.root.update_idletasks()
        width = self.root.winfo_width()
        height = self.root.winfo_height()
        x = (self.root.winfo_screenwidth() // 2) - (width // 2)
        y = (self.root.winfo_screenheight() // 2) - (height // 2)
        self.root.geometry(f'{width}x{height}+{x}+{y}')
        
        self.root.mainloop()


def main():
    app = WorkHealthReminderGUI()
    app.run()


if __name__ == "__main__":
    main()
