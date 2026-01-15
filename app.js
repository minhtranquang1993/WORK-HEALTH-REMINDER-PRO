// ========================================
// Work Health Reminder App
// ========================================

class WorkHealthReminder {
    constructor() {
        // Time settings (in minutes)
        this.WORK_START = { hour: 8, minute: 0 };
        this.LUNCH_START = { hour: 11, minute: 30 };
        this.LUNCH_END = { hour: 13, minute: 0 };
        this.WORK_END = { hour: 17, minute: 30 };
        
        // Reminder intervals (in minutes)
        this.WALK_INTERVAL = 30;
        this.WATER_INTERVAL = 45;
        this.TOILET_INTERVAL = 60;
        
        // Timers (remaining seconds)
        this.walkTimer = this.WALK_INTERVAL * 60;
        this.waterTimer = this.WATER_INTERVAL * 60;
        this.toiletTimer = this.TOILET_INTERVAL * 60;
        
        // State
        this.isWorking = false;
        this.isLunchBreak = false;
        this.hasShownLunchReminder = false;
        this.hasShownEndReminder = false;
        this.soundEnabled = true;
        this.notificationEnabled = true;
        
        // Schedule items
        this.schedule = [
            { time: '08:00', icon: '🌅', text: 'Bắt đầu làm việc', status: 'pending' },
            { time: '11:30', icon: '🍱', text: 'Lấy phiếu ăn cơm', status: 'pending' },
            { time: '13:00', icon: '💪', text: 'Tiếp tục làm việc', status: 'pending' },
            { time: '17:30', icon: '🏠', text: 'Kết thúc làm việc', status: 'pending' }
        ];
        
        // DOM Elements
        this.initElements();
        this.initEventListeners();
        this.requestNotificationPermission();
        
        // Start the app
        this.start();
    }
    
    initElements() {
        // Time display
        this.currentTimeEl = document.getElementById('currentTime');
        this.currentDateEl = document.getElementById('currentDate');
        
        // Status
        this.statusBadge = document.getElementById('statusBadge');
        
        // Progress
        this.workProgressFill = document.getElementById('workProgressFill');
        this.workPercent = document.getElementById('workPercent');
        
        // Next reminder
        this.nextReminderCard = document.getElementById('nextReminderCard');
        this.nextReminderIcon = document.getElementById('nextReminderIcon');
        this.nextReminderTitle = document.getElementById('nextReminderTitle');
        this.nextReminderTime = document.getElementById('nextReminderTime');
        
        // Timers
        this.walkTimerEl = document.getElementById('walkTimer');
        this.waterTimerEl = document.getElementById('waterTimer');
        this.toiletTimerEl = document.getElementById('toiletTimer');
        
        // Schedule
        this.scheduleList = document.getElementById('scheduleList');
        
        // Modals
        this.modalOverlay = document.getElementById('modalOverlay');
        this.notificationModal = document.getElementById('notificationModal');
        this.modalIcon = document.getElementById('modalIcon');
        this.modalTitle = document.getElementById('modalTitle');
        this.modalMessage = document.getElementById('modalMessage');
        this.btnDismiss = document.getElementById('btnDismiss');
        
        this.endDayModalOverlay = document.getElementById('endDayModalOverlay');
        this.btnPickupLove = document.getElementById('btnPickupLove');
        this.btnGoHome = document.getElementById('btnGoHome');
        
        this.finalModalOverlay = document.getElementById('finalModalOverlay');
        this.finalIcon = document.getElementById('finalIcon');
        this.finalTitle = document.getElementById('finalTitle');
        this.finalMessage = document.getElementById('finalMessage');
        this.btnFinalDismiss = document.getElementById('btnFinalDismiss');
        
        // Settings
        this.settingsToggle = document.getElementById('settingsToggle');
        this.settingsContent = document.getElementById('settingsContent');
        this.soundEnabledCheckbox = document.getElementById('soundEnabled');
        this.notificationEnabledCheckbox = document.getElementById('notificationEnabled');
        this.btnTestNotification = document.getElementById('btnTestNotification');
    }
    
    initEventListeners() {
        // Modal dismiss
        this.btnDismiss.addEventListener('click', () => this.hideModal());
        this.btnFinalDismiss.addEventListener('click', () => this.hideFinalModal());
        
        // End of day options
        this.btnPickupLove.addEventListener('click', () => this.handleEndDayChoice('love'));
        this.btnGoHome.addEventListener('click', () => this.handleEndDayChoice('home'));
        
        // Settings
        this.settingsToggle.addEventListener('click', () => {
            this.settingsContent.classList.toggle('active');
        });
        
        this.soundEnabledCheckbox.addEventListener('change', (e) => {
            this.soundEnabled = e.target.checked;
        });
        
        this.notificationEnabledCheckbox.addEventListener('change', (e) => {
            this.notificationEnabled = e.target.checked;
        });
        
        this.btnTestNotification.addEventListener('click', () => {
            this.showReminder('walk');
        });
        
        // Close settings when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.settings-panel')) {
                this.settingsContent.classList.remove('active');
            }
        });
    }
    
    async requestNotificationPermission() {
        if ('Notification' in window) {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                console.log('Notification permission denied');
            }
        }
    }
    
    start() {
        // Update every second
        this.updateTime();
        setInterval(() => this.updateTime(), 1000);
        
        // Render schedule
        this.renderSchedule();
    }
    
    updateTime() {
        const now = new Date();
        
        // Update clock display
        this.currentTimeEl.textContent = now.toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
        
        // Update date display
        this.currentDateEl.textContent = now.toLocaleDateString('vi-VN', {
            weekday: 'long',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        
        // Check work status
        this.checkWorkStatus(now);
        
        // Update progress and timers if working
        if (this.isWorking && !this.isLunchBreak) {
            this.updateProgress(now);
            this.updateTimers();
            this.checkReminders();
        }
        
        // Check fixed schedule reminders
        this.checkScheduleReminders(now);
        
        // Update schedule display
        this.updateScheduleStatus(now);
    }
    
    checkWorkStatus(now) {
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const workStartMinutes = this.WORK_START.hour * 60 + this.WORK_START.minute;
        const lunchStartMinutes = this.LUNCH_START.hour * 60 + this.LUNCH_START.minute;
        const lunchEndMinutes = this.LUNCH_END.hour * 60 + this.LUNCH_END.minute;
        const workEndMinutes = this.WORK_END.hour * 60 + this.WORK_END.minute;
        
        // Check if in lunch break
        if (currentMinutes >= lunchStartMinutes && currentMinutes < lunchEndMinutes) {
            this.isLunchBreak = true;
            this.isWorking = false;
            this.updateStatusBadge('paused', 'Nghỉ trưa');
            this.showLunchBreakOverlay(now, lunchEndMinutes);
        } 
        // Check if in work hours
        else if (currentMinutes >= workStartMinutes && currentMinutes < workEndMinutes) {
            if (this.isLunchBreak) {
                // Just returned from lunch, reset timers
                this.resetTimers();
            }
            this.isLunchBreak = false;
            this.isWorking = true;
            this.updateStatusBadge('active', 'Đang hoạt động');
            this.hideLunchBreakOverlay();
        } 
        // Outside work hours
        else {
            this.isWorking = false;
            this.isLunchBreak = false;
            
            if (currentMinutes >= workEndMinutes) {
                this.updateStatusBadge('ended', 'Hết giờ làm');
            } else {
                this.updateStatusBadge('ended', 'Chưa bắt đầu');
            }
            this.hideLunchBreakOverlay();
        }
    }
    
    updateStatusBadge(status, text) {
        this.statusBadge.className = 'status-badge ' + status;
        this.statusBadge.querySelector('.status-text').textContent = text;
    }
    
    updateProgress(now) {
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const workStartMinutes = this.WORK_START.hour * 60 + this.WORK_START.minute;
        const lunchStartMinutes = this.LUNCH_START.hour * 60 + this.LUNCH_START.minute;
        const lunchEndMinutes = this.LUNCH_END.hour * 60 + this.LUNCH_END.minute;
        const workEndMinutes = this.WORK_END.hour * 60 + this.WORK_END.minute;
        
        // Total work minutes (excluding lunch)
        const totalWorkMinutes = (lunchStartMinutes - workStartMinutes) + (workEndMinutes - lunchEndMinutes);
        
        let workedMinutes = 0;
        
        if (currentMinutes < lunchStartMinutes) {
            workedMinutes = currentMinutes - workStartMinutes;
        } else if (currentMinutes >= lunchEndMinutes) {
            workedMinutes = (lunchStartMinutes - workStartMinutes) + (currentMinutes - lunchEndMinutes);
        } else {
            workedMinutes = lunchStartMinutes - workStartMinutes;
        }
        
        const percent = Math.min(100, Math.max(0, (workedMinutes / totalWorkMinutes) * 100));
        
        this.workProgressFill.style.width = percent + '%';
        this.workPercent.textContent = Math.round(percent) + '%';
    }
    
    updateTimers() {
        // Decrease timers
        if (this.walkTimer > 0) this.walkTimer--;
        if (this.waterTimer > 0) this.waterTimer--;
        if (this.toiletTimer > 0) this.toiletTimer--;
        
        // Update display
        this.walkTimerEl.textContent = this.formatTimer(this.walkTimer);
        this.waterTimerEl.textContent = this.formatTimer(this.waterTimer);
        this.toiletTimerEl.textContent = this.formatTimer(this.toiletTimer);
        
        // Update next reminder display
        this.updateNextReminder();
    }
    
    formatTimer(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    updateNextReminder() {
        const reminders = [
            { type: 'walk', timer: this.walkTimer, icon: '🚶', title: 'Đứng dậy đi bộ' },
            { type: 'water', timer: this.waterTimer, icon: '💧', title: 'Uống nước lọc' },
            { type: 'toilet', timer: this.toiletTimer, icon: '🚻', title: 'Đi toilet' }
        ];
        
        const next = reminders.reduce((min, r) => r.timer < min.timer ? r : min);
        
        this.nextReminderIcon.textContent = next.icon;
        this.nextReminderTitle.textContent = next.title;
        
        if (next.timer < 60) {
            this.nextReminderTime.textContent = `còn ${next.timer} giây`;
        } else {
            const mins = Math.ceil(next.timer / 60);
            this.nextReminderTime.textContent = `còn ${mins} phút`;
        }
    }
    
    checkReminders() {
        if (this.walkTimer === 0) {
            this.showReminder('walk');
            this.walkTimer = this.WALK_INTERVAL * 60;
        }
        
        if (this.waterTimer === 0) {
            this.showReminder('water');
            this.waterTimer = this.WATER_INTERVAL * 60;
        }
        
        if (this.toiletTimer === 0) {
            this.showReminder('toilet');
            this.toiletTimer = this.TOILET_INTERVAL * 60;
        }
    }
    
    checkScheduleReminders(now) {
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const seconds = now.getSeconds();
        
        // Check only at exact minutes (when seconds is 0)
        if (seconds !== 0) return;
        
        // 11:30 - Lunch reminder
        if (hours === 11 && minutes === 30 && !this.hasShownLunchReminder) {
            this.showReminder('lunch');
            this.hasShownLunchReminder = true;
        }
        
        // 17:30 - End of day
        if (hours === 17 && minutes === 30 && !this.hasShownEndReminder) {
            this.showEndDayModal();
            this.hasShownEndReminder = true;
        }
        
        // Reset flags at midnight
        if (hours === 0 && minutes === 0) {
            this.hasShownLunchReminder = false;
            this.hasShownEndReminder = false;
        }
    }
    
    showReminder(type) {
        const reminders = {
            walk: {
                icon: '🚶',
                title: 'Đến lúc đi bộ rồi!',
                message: 'Đứng dậy và đi bộ 2-3 phút để thư giãn cơ thể nhé! 🏃‍♂️'
            },
            water: {
                icon: '💧',
                title: 'Uống nước đi!',
                message: 'Uống một ly nước lọc để giữ cơ thể luôn được hydrate nhé! 💦'
            },
            toilet: {
                icon: '🚻',
                title: 'Đi toilet thôi!',
                message: 'Đến lúc đi toilet rồi, đừng nhịn quá lâu nhé! 🚽'
            },
            lunch: {
                icon: '🍱',
                title: 'Đến giờ lấy phiếu cơm!',
                message: 'Đi lấy phiếu ăn cơm trưa và nghỉ ngơi nhé! Chúc bạn ngon miệng! 🥢'
            }
        };
        
        const reminder = reminders[type];
        
        this.modalIcon.textContent = reminder.icon;
        this.modalTitle.textContent = reminder.title;
        this.modalMessage.textContent = reminder.message;
        
        this.modalOverlay.classList.add('active');
        
        // Play sound
        this.playSound();
        
        // Show browser notification
        this.showBrowserNotification(reminder.title, reminder.message);
    }
    
    hideModal() {
        this.modalOverlay.classList.remove('active');
    }
    
    showEndDayModal() {
        this.endDayModalOverlay.classList.add('active');
        this.playSound();
        this.showBrowserNotification('Hết giờ làm!', 'Bạn muốn đón người yêu hay về nhà?');
    }
    
    hideEndDayModal() {
        this.endDayModalOverlay.classList.remove('active');
    }
    
    handleEndDayChoice(choice) {
        this.hideEndDayModal();
        
        if (choice === 'love') {
            this.finalIcon.textContent = '💕';
            this.finalTitle.textContent = 'Đi đón người yêu!';
            this.finalMessage.textContent = 'Chúc bạn có buổi tối lãng mạn bên người ấy! 🥰💑';
        } else {
            this.finalIcon.textContent = '🏠';
            this.finalTitle.textContent = 'Đi về nhà!';
            this.finalMessage.textContent = 'Chúc bạn về nhà an toàn và nghỉ ngơi thoải mái! 🛋️✨';
        }
        
        this.finalModalOverlay.classList.add('active');
    }
    
    hideFinalModal() {
        this.finalModalOverlay.classList.remove('active');
    }
    
    showLunchBreakOverlay(now, lunchEndMinutes) {
        let overlay = document.querySelector('.lunch-break-overlay');
        
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'lunch-break-overlay';
            overlay.innerHTML = `
                <div class="lunch-break-icon">😴</div>
                <h2 class="lunch-break-title">Nghỉ Trưa</h2>
                <p class="lunch-break-message">Nghỉ ngơi và nạp năng lượng cho buổi chiều nhé!</p>
                <div class="lunch-break-timer" id="lunchBreakTimer">01:30:00</div>
            `;
            document.body.appendChild(overlay);
        }
        
        // Calculate remaining time
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const remainingMinutes = lunchEndMinutes - currentMinutes;
        const remainingSeconds = remainingMinutes * 60 - now.getSeconds();
        
        const hours = Math.floor(remainingSeconds / 3600);
        const mins = Math.floor((remainingSeconds % 3600) / 60);
        const secs = remainingSeconds % 60;
        
        const timerEl = overlay.querySelector('#lunchBreakTimer');
        timerEl.textContent = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    hideLunchBreakOverlay() {
        const overlay = document.querySelector('.lunch-break-overlay');
        if (overlay) {
            overlay.remove();
        }
    }
    
    resetTimers() {
        this.walkTimer = this.WALK_INTERVAL * 60;
        this.waterTimer = this.WATER_INTERVAL * 60;
        this.toiletTimer = this.TOILET_INTERVAL * 60;
    }
    
    renderSchedule() {
        this.scheduleList.innerHTML = this.schedule.map((item, index) => `
            <div class="schedule-item" data-index="${index}">
                <span class="schedule-time">${item.time}</span>
                <span class="schedule-icon">${item.icon}</span>
                <span class="schedule-text">${item.text}</span>
                <span class="schedule-status" id="scheduleStatus${index}">⏳</span>
            </div>
        `).join('');
    }
    
    updateScheduleStatus(now) {
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        
        this.schedule.forEach((item, index) => {
            const [hours, mins] = item.time.split(':').map(Number);
            const itemMinutes = hours * 60 + mins;
            
            const statusEl = document.getElementById(`scheduleStatus${index}`);
            const itemEl = this.scheduleList.children[index];
            
            if (currentMinutes > itemMinutes) {
                statusEl.textContent = '✅';
                itemEl.classList.add('completed');
                itemEl.classList.remove('active');
            } else if (currentMinutes === itemMinutes) {
                statusEl.textContent = '🔔';
                itemEl.classList.add('active');
                itemEl.classList.remove('completed');
            } else {
                statusEl.textContent = '⏳';
                itemEl.classList.remove('completed', 'active');
            }
        });
    }
    
    playSound() {
        if (!this.soundEnabled) return;
        
        // Create a simple beep sound using Web Audio API
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (e) {
            console.log('Sound not available');
        }
    }
    
    showBrowserNotification(title, message) {
        if (!this.notificationEnabled) return;
        
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, {
                body: message,
                icon: '💪',
                badge: '💪'
            });
        }
    }
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new WorkHealthReminder();
});
