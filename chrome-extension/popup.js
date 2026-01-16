// ========================================
// Work Health Reminder - Popup Script
// ========================================

class PopupController {
    constructor() {
        this.initElements();
        this.initEventListeners();
        this.startUpdating();
    }

    initElements() {
        // Status
        this.statusBadge = document.getElementById('statusBadge');
        this.statusText = document.getElementById('statusText');

        // Time display
        this.currentTime = document.getElementById('currentTime');
        this.currentDate = document.getElementById('currentDate');

        // Progress
        this.progressFill = document.getElementById('progressFill');
        this.workPercent = document.getElementById('workPercent');

        // Timers
        this.walkTimer = document.getElementById('walkTimer');
        this.waterTimer = document.getElementById('waterTimer');
        this.toiletTimer = document.getElementById('toiletTimer');
        this.eyeTimer = document.getElementById('eyeTimer');

        // Buttons
        this.btnPause = document.getElementById('btnPause');
        this.pauseIcon = document.getElementById('pauseIcon');
        this.pauseText = document.getElementById('pauseText');
        this.btnResetAll = document.getElementById('btnResetAll');
        this.btnTest = document.getElementById('btnTest');

        // Settings
        this.notificationEnabled = document.getElementById('notificationEnabled');

        // Modal
        this.exerciseModal = document.getElementById('exerciseModal');
        this.modalTitle = document.getElementById('modalTitle');
        this.modalContent = document.getElementById('modalContent');
        this.btnCloseModal = document.getElementById('btnCloseModal');
        this.btnDone = document.getElementById('btnDone');
    }

    initEventListeners() {
        // Reset buttons
        document.querySelectorAll('.reset-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.resetTimer(btn.dataset.timer);
            });
        });

        // Pause button
        this.btnPause.addEventListener('click', () => this.togglePause());

        // Reset all button
        this.btnResetAll.addEventListener('click', () => this.resetAll());

        // Test notification
        this.btnTest.addEventListener('click', () => this.testNotification());

        // Exercise buttons
        document.querySelectorAll('.exercise-btn').forEach(btn => {
            btn.addEventListener('click', () => this.showExercise(btn.dataset.exercise));
        });

        // Modal close
        this.btnCloseModal.addEventListener('click', () => this.hideModal());
        this.btnDone.addEventListener('click', () => this.hideModal());
        this.exerciseModal.addEventListener('click', (e) => {
            if (e.target === this.exerciseModal) this.hideModal();
        });

        // Notification toggle
        this.notificationEnabled.addEventListener('change', async (e) => {
            const { settings } = await chrome.storage.local.get('settings');
            settings.notificationEnabled = e.target.checked;
            await chrome.storage.local.set({ settings });
        });
    }

    startUpdating() {
        this.updateDisplay();
        // Update every second
        setInterval(() => this.updateDisplay(), 1000);
    }

    async updateDisplay() {
        // Update time
        this.updateClock();

        // Get status from background
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getStatus' });
            if (response) {
                this.updateStatus(response.workStatus);
                this.updateTimers(response.timers);
                this.updateProgress(response.settings);
                this.updatePauseButton(response.settings.isPaused);
                this.notificationEnabled.checked = response.settings.notificationEnabled;
            }
        } catch (e) {
            console.log('Error getting status:', e);
        }
    }

    updateClock() {
        const now = new Date();

        this.currentTime.textContent = now.toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });

        this.currentDate.textContent = now.toLocaleDateString('vi-VN', {
            weekday: 'long',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    updateStatus(workStatus) {
        this.statusBadge.className = 'status-badge';

        if (workStatus.status === 'lunch') {
            this.statusBadge.classList.add('lunch');
        } else if (workStatus.status === 'ended' || workStatus.status === 'before') {
            this.statusBadge.classList.add('ended');
        }

        this.statusText.textContent = workStatus.label;
    }

    updateTimers(timers) {
        if (!timers) return;

        this.walkTimer.textContent = this.formatTime(timers.walk);
        this.waterTimer.textContent = this.formatTime(timers.water);
        this.toiletTimer.textContent = this.formatTime(timers.toilet);
        this.eyeTimer.textContent = this.formatTime(timers.eye_20_20_20);
    }

    formatTime(seconds) {
        if (seconds === undefined || seconds === null) return '--:--';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    updateProgress(settings) {
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        const workStart = settings.workStart.hour * 60 + settings.workStart.minute;
        const lunchStart = settings.lunchStart.hour * 60 + settings.lunchStart.minute;
        const lunchEnd = settings.lunchEnd.hour * 60 + settings.lunchEnd.minute;
        const workEnd = settings.workEnd.hour * 60 + settings.workEnd.minute;

        // Total work minutes (excluding lunch)
        const totalWorkMinutes = (lunchStart - workStart) + (workEnd - lunchEnd);

        let workedMinutes = 0;

        if (currentMinutes < workStart) {
            workedMinutes = 0;
        } else if (currentMinutes < lunchStart) {
            workedMinutes = currentMinutes - workStart;
        } else if (currentMinutes < lunchEnd) {
            workedMinutes = lunchStart - workStart;
        } else if (currentMinutes < workEnd) {
            workedMinutes = (lunchStart - workStart) + (currentMinutes - lunchEnd);
        } else {
            workedMinutes = totalWorkMinutes;
        }

        const percent = Math.min(100, Math.max(0, (workedMinutes / totalWorkMinutes) * 100));

        this.progressFill.style.width = `${percent}%`;
        this.workPercent.textContent = `${Math.round(percent)}%`;
    }

    updatePauseButton(isPaused) {
        if (isPaused) {
            this.btnPause.classList.add('active');
            this.pauseIcon.textContent = '▶️';
            this.pauseText.textContent = 'Tiếp tục';
            this.statusBadge.classList.add('paused');
            this.statusText.textContent = '⏸️ Đã tạm dừng';
        } else {
            this.btnPause.classList.remove('active');
            this.pauseIcon.textContent = '⏸️';
            this.pauseText.textContent = 'Tạm dừng';
            this.statusBadge.classList.remove('paused');
        }
    }

    async resetTimer(timerType) {
        try {
            await chrome.runtime.sendMessage({
                action: 'resetTimer',
                timerType: timerType
            });
            this.showToast(`Đã reset timer ${timerType}!`);
        } catch (e) {
            console.log('Error resetting timer:', e);
        }
    }

    async togglePause() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'togglePause' });
            if (response.isPaused) {
                this.showToast('⏸️ Đã tạm dừng nhắc nhở');
            } else {
                this.showToast('▶️ Đã tiếp tục nhắc nhở');
            }
        } catch (e) {
            console.log('Error toggling pause:', e);
        }
    }

    async resetAll() {
        try {
            await chrome.runtime.sendMessage({ action: 'resetAll' });
            this.showToast('🔄 Đã reset tất cả timer!');
        } catch (e) {
            console.log('Error resetting all:', e);
        }
    }

    async testNotification() {
        try {
            await chrome.runtime.sendMessage({ action: 'testNotification' });
            this.showToast('📢 Đã gửi thông báo test!');
        } catch (e) {
            console.log('Error testing notification:', e);
        }
    }

    showExercise(exerciseType) {
        const exercise = EXERCISES[exerciseType];
        if (!exercise) return;

        this.modalTitle.textContent = exercise.title;
        this.modalContent.textContent = exercise.content;
        this.exerciseModal.classList.add('active');
    }

    hideModal() {
        this.exerciseModal.classList.remove('active');
    }

    showToast(message) {
        // Create toast if not exists
        let toast = document.querySelector('.toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'toast';
            toast.style.cssText = `
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0, 0, 0, 0.8);
                color: #fff;
                padding: 10px 20px;
                border-radius: 8px;
                font-size: 13px;
                z-index: 1000;
                opacity: 0;
                transition: opacity 0.3s;
            `;
            document.body.appendChild(toast);
        }

        toast.textContent = message;
        toast.style.opacity = '1';

        setTimeout(() => {
            toast.style.opacity = '0';
        }, 2000);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new PopupController();
});
