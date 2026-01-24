// ========================================
// Work Health Reminder PRO - Popup Script
// Version 3.0
// ========================================

class PopupController {
    constructor() {
        this.initElements();
        this.initEventListeners();
        this.loadSettings();
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
        this.eyeTimer = document.getElementById('eyeTimer');
        this.blinkTimer = document.getElementById('blinkTimer');
        this.postureTimer = document.getElementById('postureTimer');
        this.neckTimer = document.getElementById('neckTimer');

        // Buttons
        this.btnPause = document.getElementById('btnPause');
        this.pauseIcon = document.getElementById('pauseIcon');
        this.pauseText = document.getElementById('pauseText');
        this.btnResetAll = document.getElementById('btnResetAll');

        // Focus Mode
        this.btnStopFocus = document.getElementById('btnStopFocus');
        this.focusStatus = document.getElementById('focusStatus');
        this.focusTimeLeft = document.getElementById('focusTimeLeft');

        // Pomodoro
        this.pomodoroDisplay = document.getElementById('pomodoroDisplay');
        this.pomodoroTime = document.getElementById('pomodoroTime');
        this.pomodoroState = document.getElementById('pomodoroState');
        this.btnStartPomodoro = document.getElementById('btnStartPomodoro');
        this.btnStopPomodoro = document.getElementById('btnStopPomodoro');
        this.pomodoroCount = document.getElementById('pomodoroCount');

        // Settings inputs
        this.settingWorkStart = document.getElementById('settingWorkStart');
        this.settingWorkEnd = document.getElementById('settingWorkEnd');
        this.settingLunchStart = document.getElementById('settingLunchStart');
        this.settingLunchEnd = document.getElementById('settingLunchEnd');
        this.settingWeekendMode = document.getElementById('settingWeekendMode');
        this.settingSaturdayEnd = document.getElementById('settingSaturdayEnd');
        this.settingSundayEnd = document.getElementById('settingSundayEnd');
        this.settingSleepTime = document.getElementById('settingSleepTime');
        this.settingNightMode = document.getElementById('settingNightMode');
        this.settingNotification = document.getElementById('settingNotification');

        // Intervals
        this.intervalWalk = document.getElementById('intervalWalk');
        this.intervalWater = document.getElementById('intervalWater');
        this.intervalEye = document.getElementById('intervalEye');
        this.intervalPosture = document.getElementById('intervalPosture');

        // Settings buttons
        this.btnSaveSettings = document.getElementById('btnSaveSettings');
        this.btnResetSettings = document.getElementById('btnResetSettings');
        this.btnTestNotification = document.getElementById('btnTestNotification');

        // Modal
        this.exerciseModal = document.getElementById('exerciseModal');
        this.modalTitle = document.getElementById('modalTitle');
        this.modalContent = document.getElementById('modalContent');
        this.btnCloseModal = document.getElementById('btnCloseModal');
        this.btnDone = document.getElementById('btnDone');

        // Toast
        this.toast = document.getElementById('toast');

        // YouTube elements
        this.youtubeEmpty = document.getElementById('youtubeEmpty');
        this.youtubeTabsContainer = document.getElementById('youtubeTabsContainer');
        this.youtubeTabsList = document.getElementById('youtubeTabsList');
        this.youtubeTabsCount = document.getElementById('youtubeTabsCount');
        this.youtubeControlsSection = document.getElementById('youtubeControlsSection');
        this.youtubeCurrentTime = document.getElementById('youtubeCurrentTime');
        this.youtubeTotalTime = document.getElementById('youtubeTotalTime');
        this.youtubeProgressFill = document.getElementById('youtubeProgressFill');
        this.youtubeProgressBar = document.getElementById('youtubeProgressBar');
        this.youtubePlayIcon = document.getElementById('youtubePlayIcon');
        this.youtubeVolumeIcon = document.getElementById('youtubeVolumeIcon');
        this.youtubeVolumeSlider = document.getElementById('youtubeVolumeSlider');

        this.btnOpenYoutube = document.getElementById('btnOpenYoutube');
        this.btnYoutubePrev = document.getElementById('btnYoutubePrev');
        this.btnYoutubePlayPause = document.getElementById('btnYoutubePlayPause');
        this.btnYoutubeNext = document.getElementById('btnYoutubeNext');
        this.btnYoutubeMute = document.getElementById('btnYoutubeMute');
        this.youtubeSpeedSelect = document.getElementById('youtubeSpeedSelect');

        // YouTube update counter (to update less frequently)
        this.youtubeUpdateCounter = 0;

        // YouTube video duration (for seek calculation)
        this.youtubeVideoDuration = 0;
        this.isSeekDragging = false;

        // Track selected YouTube tab
        this.selectedYoutubeTabId = null;
    }

    initEventListeners() {
        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });

        // Reset timer buttons
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

        // Focus Mode buttons
        document.querySelectorAll('.focus-btn').forEach(btn => {
            btn.addEventListener('click', () => this.startFocus(parseInt(btn.dataset.minutes)));
        });
        this.btnStopFocus.addEventListener('click', () => this.stopFocus());

        // Pomodoro buttons
        this.btnStartPomodoro.addEventListener('click', () => this.startPomodoro());
        this.btnStopPomodoro.addEventListener('click', () => this.stopPomodoro());

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

        // Settings
        this.settingWeekendMode.addEventListener('change', () => this.updateWeekendModeUI());
        this.btnSaveSettings.addEventListener('click', () => this.saveSettings());
        this.btnResetSettings.addEventListener('click', () => this.resetSettings());
        this.btnTestNotification.addEventListener('click', () => this.testNotification());

        // YouTube controls
        if (this.btnOpenYoutube) {
            this.btnOpenYoutube.addEventListener('click', () => this.openYoutube());
        }
        if (this.btnYoutubePlayPause) {
            this.btnYoutubePlayPause.addEventListener('click', () => this.youtubePlayPause());
        }
        if (this.btnYoutubeNext) {
            this.btnYoutubeNext.addEventListener('click', () => this.youtubeNext());
        }
        if (this.btnYoutubePrev) {
            this.btnYoutubePrev.addEventListener('click', () => this.youtubePrev());
        }
        if (this.btnYoutubeMute) {
            this.btnYoutubeMute.addEventListener('click', () => this.youtubeMute());
        }
        if (this.youtubeVolumeSlider) {
            this.youtubeVolumeSlider.addEventListener('input', (e) => this.youtubeSetVolume(e.target.value / 100));
        }
        if (this.youtubeSpeedSelect) {
            this.youtubeSpeedSelect.addEventListener('change', (e) => this.youtubeSetSpeed(parseFloat(e.target.value)));
        }

        // YouTube progress bar seek (click and drag)
        if (this.youtubeProgressBar) {
            this.youtubeProgressBar.addEventListener('click', (e) => this.handleProgressClick(e));
            this.youtubeProgressBar.addEventListener('mousedown', (e) => {
                this.isSeekDragging = true;
                this.handleProgressClick(e);
            });
            document.addEventListener('mouseup', () => {
                this.isSeekDragging = false;
            });
            document.addEventListener('mousemove', (e) => {
                if (this.isSeekDragging) {
                    this.handleProgressDrag(e);
                }
            });
        }
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `tab-${tabName}`);
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
                this.updateFocusDisplay(response.state);
                this.updatePomodoroDisplay(response.state, response.settings);
            }
        } catch (e) {
            console.log('Error getting status:', e);
        }

        // Update YouTube (every 2 seconds to reduce load)
        this.youtubeUpdateCounter++;
        if (this.youtubeUpdateCounter % 2 === 0) {
            this.updateYoutubeDisplay();
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

        if (workStatus.status === 'paused') {
            this.statusBadge.classList.add('paused');
        } else if (workStatus.status === 'lunch') {
            this.statusBadge.classList.add('lunch');
        } else if (workStatus.status === 'ended' || workStatus.status === 'before' || workStatus.status === 'weekend') {
            this.statusBadge.classList.add('ended');
        } else if (workStatus.status === 'focus') {
            this.statusBadge.classList.add('focus');
        } else if (workStatus.status.startsWith('pomodoro')) {
            this.statusBadge.classList.add('pomodoro');
        }

        this.statusText.textContent = workStatus.label;
    }

    updateTimers(timers) {
        if (!timers) return;

        this.walkTimer.textContent = this.formatTime(timers.walk);
        this.waterTimer.textContent = this.formatTime(timers.water);
        this.eyeTimer.textContent = this.formatTime(timers.eye_20_20_20);
        this.blinkTimer.textContent = this.formatTime(timers.blink);
        this.postureTimer.textContent = this.formatTime(timers.posture);
        this.neckTimer.textContent = this.formatTime(timers.neck_stretch);
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
        } else {
            this.btnPause.classList.remove('active');
            this.pauseIcon.textContent = '⏸️';
            this.pauseText.textContent = 'Tạm dừng';
        }
    }

    updateFocusDisplay(state) {
        if (state.focusEndTime && Date.now() < state.focusEndTime) {
            const remaining = Math.max(0, Math.floor((state.focusEndTime - Date.now()) / 1000));
            this.focusTimeLeft.textContent = this.formatTime(remaining);
            this.focusStatus.classList.remove('hidden');
            this.btnStopFocus.classList.remove('hidden');
            document.querySelector('.focus-buttons').classList.add('hidden');
        } else {
            this.focusStatus.classList.add('hidden');
            this.btnStopFocus.classList.add('hidden');
            document.querySelector('.focus-buttons').classList.remove('hidden');
        }
    }

    updatePomodoroDisplay(state, settings) {
        this.pomodoroCount.textContent = state.pomodoroCount || 0;

        if (state.pomodoroState && state.pomodoroEndTime) {
            const remaining = Math.max(0, Math.floor((state.pomodoroEndTime - Date.now()) / 1000));
            this.pomodoroTime.textContent = this.formatTime(remaining);

            this.pomodoroDisplay.classList.remove('work', 'break');
            if (state.pomodoroState === 'work') {
                this.pomodoroDisplay.classList.add('work');
                this.pomodoroState.textContent = '🍅 Đang làm việc';
            } else {
                this.pomodoroDisplay.classList.add('break');
                this.pomodoroState.textContent = '☕ Đang nghỉ';
            }

            this.btnStartPomodoro.classList.add('hidden');
            this.btnStopPomodoro.classList.remove('hidden');
        } else {
            this.pomodoroTime.textContent = `${settings.pomodoroWork || 25}:00`;
            this.pomodoroState.textContent = 'Sẵn sàng';
            this.pomodoroDisplay.classList.remove('work', 'break');
            this.btnStartPomodoro.classList.remove('hidden');
            this.btnStopPomodoro.classList.add('hidden');
        }
    }

    async resetTimer(timerType) {
        try {
            await chrome.runtime.sendMessage({
                action: 'resetTimer',
                timerType: timerType
            });
            this.showToast(`Đã reset timer!`);
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

    async startFocus(minutes) {
        try {
            await chrome.runtime.sendMessage({ action: 'startFocus', minutes });
            this.showToast(`🎯 Focus Mode: ${minutes} phút`);
        } catch (e) {
            console.log('Error starting focus:', e);
        }
    }

    async stopFocus() {
        try {
            await chrome.runtime.sendMessage({ action: 'stopFocus' });
            this.showToast('🎯 Đã dừng Focus Mode');
        } catch (e) {
            console.log('Error stopping focus:', e);
        }
    }

    async startPomodoro() {
        try {
            await chrome.runtime.sendMessage({ action: 'startPomodoro' });
            this.showToast('🍅 Bắt đầu Pomodoro!');
        } catch (e) {
            console.log('Error starting pomodoro:', e);
        }
    }

    async stopPomodoro() {
        try {
            await chrome.runtime.sendMessage({ action: 'stopPomodoro' });
            this.showToast('🍅 Đã dừng Pomodoro');
        } catch (e) {
            console.log('Error stopping pomodoro:', e);
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
        this.toast.textContent = message;
        this.toast.classList.add('show');

        setTimeout(() => {
            this.toast.classList.remove('show');
        }, 2000);
    }

    // ========================================
    // YouTube Methods
    // ========================================

    async updateYoutubeDisplay() {
        if (!this.youtubeEmpty || !this.youtubeTabsContainer) return;

        try {
            // Get all YouTube tabs
            const tabsResponse = await chrome.runtime.sendMessage({ action: 'getAllYoutubeTabs' });

            if (!tabsResponse || !tabsResponse.success || tabsResponse.tabs.length === 0) {
                this.youtubeEmpty.classList.remove('hidden');
                this.youtubeTabsContainer.classList.add('hidden');
                return;
            }

            this.youtubeEmpty.classList.add('hidden');
            this.youtubeTabsContainer.classList.remove('hidden');

            // Update tabs count
            if (this.youtubeTabsCount) {
                this.youtubeTabsCount.textContent = tabsResponse.tabs.length;
            }

            // Update selected tab ID
            this.selectedYoutubeTabId = tabsResponse.selectedTabId;

            // Render tabs list
            this.renderYoutubeTabs(tabsResponse.tabs);

            // Get and display state for selected tab
            if (this.selectedYoutubeTabId) {
                const stateResponse = await chrome.runtime.sendMessage({ action: 'getYoutubeState' });

                if (stateResponse && stateResponse.videoInfo) {
                    this.updateYoutubeControls(stateResponse.videoInfo);
                    if (this.youtubeControlsSection) {
                        this.youtubeControlsSection.classList.remove('hidden');
                    }
                } else {
                    if (this.youtubeControlsSection) {
                        this.youtubeControlsSection.classList.add('hidden');
                    }
                }
            }

        } catch (e) {
            console.log('Error updating YouTube display:', e);
            this.youtubeEmpty.classList.remove('hidden');
            this.youtubeTabsContainer.classList.add('hidden');
        }
    }

    renderYoutubeTabs(tabs) {
        if (!this.youtubeTabsList) return;

        this.youtubeTabsList.innerHTML = tabs.map(tab => `
            <div class="youtube-tab-item ${tab.tabId === this.selectedYoutubeTabId ? 'selected' : ''}"
                 data-tab-id="${tab.tabId}">
                <span class="youtube-tab-status">${tab.isPlaying ? '▶️' : '⏸️'}</span>
                <span class="youtube-tab-title" title="${this.escapeHtml(tab.title)}">
                    ${this.escapeHtml(tab.title)}
                </span>
                <button class="youtube-tab-close" data-tab-id="${tab.tabId}" title="Đóng tab">✕</button>
            </div>
        `).join('');

        // Add click listeners for selection
        this.youtubeTabsList.querySelectorAll('.youtube-tab-item').forEach(item => {
            item.addEventListener('click', (e) => {
                // Don't select if clicking close button
                if (e.target.classList.contains('youtube-tab-close')) return;
                this.selectYoutubeTab(parseInt(item.dataset.tabId));
            });
        });

        // Add click listeners for close buttons
        this.youtubeTabsList.querySelectorAll('.youtube-tab-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.closeYoutubeTab(parseInt(btn.dataset.tabId));
            });
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    updateYoutubeControls(info) {
        // Update time displays
        if (this.youtubeCurrentTime) {
            this.youtubeCurrentTime.textContent = this.formatYoutubeTime(info.currentTime);
        }
        if (this.youtubeTotalTime) {
            this.youtubeTotalTime.textContent = this.formatYoutubeTime(info.duration);
        }

        // Store duration for seek calculations
        this.youtubeVideoDuration = info.duration;

        // Update progress bar (only if not dragging)
        if (this.youtubeProgressFill && info.duration > 0 && !this.isSeekDragging) {
            const progress = (info.currentTime / info.duration) * 100;
            this.youtubeProgressFill.style.width = `${progress}%`;
        }

        // Update play/pause icon
        if (this.youtubePlayIcon) {
            this.youtubePlayIcon.textContent = info.isPlaying ? '⏸️' : '▶️';
        }

        // Update volume
        if (this.youtubeVolumeIcon) {
            if (info.isMuted) {
                this.youtubeVolumeIcon.textContent = '🔇';
            } else if (info.volume > 0.5) {
                this.youtubeVolumeIcon.textContent = '🔊';
            } else if (info.volume > 0) {
                this.youtubeVolumeIcon.textContent = '🔉';
            } else {
                this.youtubeVolumeIcon.textContent = '🔈';
            }
        }
        if (this.youtubeVolumeSlider) {
            this.youtubeVolumeSlider.value = info.isMuted ? 0 : Math.round(info.volume * 100);
        }

        // Update speed selector - find closest matching value
        if (this.youtubeSpeedSelect && info.playbackRate) {
            const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
            const closest = speeds.reduce((prev, curr) =>
                Math.abs(curr - info.playbackRate) < Math.abs(prev - info.playbackRate) ? curr : prev
            );
            this.youtubeSpeedSelect.value = closest.toString();
        }
    }

    async selectYoutubeTab(tabId) {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'selectYoutubeTab',
                tabId: tabId
            });

            if (response && response.success) {
                this.selectedYoutubeTabId = tabId;
                // Refresh display
                await this.updateYoutubeDisplay();
            }
        } catch (e) {
            console.log('Error selecting YouTube tab:', e);
        }
    }

    async closeYoutubeTab(tabId) {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'closeYoutubeTab',
                tabId: tabId
            });

            if (response && response.success) {
                this.showToast('Đã đóng tab YouTube');
                // Refresh display
                await this.updateYoutubeDisplay();
            }
        } catch (e) {
            console.log('Error closing YouTube tab:', e);
        }
    }

    formatYoutubeTime(seconds) {
        if (!seconds || isNaN(seconds)) return '0:00';
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        if (hours > 0) {
            return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    async openYoutube() {
        try {
            await chrome.tabs.create({ url: 'https://www.youtube.com' });
        } catch (e) {
            console.log('Error opening YouTube:', e);
        }
    }

    async youtubePlayPause() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'youtubeControl', command: 'playPause' });
            if (response?.focusBlocked) {
                this.showToast('🎯 Focus mode đang bật!');
                return;
            }
            setTimeout(() => this.updateYoutubeDisplay(), 100);
        } catch (e) {
            console.log('Error toggling play/pause:', e);
        }
    }

    async youtubeNext() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'youtubeControl', command: 'next' });
            if (response?.focusBlocked) {
                this.showToast('🎯 Focus mode đang bật!');
                return;
            }
            this.showToast('⏭️ Video tiếp theo');
            setTimeout(() => this.updateYoutubeDisplay(), 500);
        } catch (e) {
            console.log('Error skipping to next:', e);
        }
    }

    async youtubePrev() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'youtubeControl', command: 'prev' });
            if (response?.focusBlocked) {
                this.showToast('🎯 Focus mode đang bật!');
                return;
            }
            this.showToast('⏮️ Video trước');
            setTimeout(() => this.updateYoutubeDisplay(), 500);
        } catch (e) {
            console.log('Error going to previous:', e);
        }
    }

    async youtubeMute() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'youtubeControl', command: 'toggleMute' });
            if (response?.focusBlocked) {
                this.showToast('🎯 Focus mode đang bật!');
                return;
            }
            setTimeout(() => this.updateYoutubeDisplay(), 100);
        } catch (e) {
            console.log('Error toggling mute:', e);
        }
    }

    async youtubeSetVolume(volume) {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'youtubeControl',
                command: 'setVolume',
                params: { volume }
            });
            if (response?.focusBlocked) {
                this.showToast('🎯 Focus mode đang bật!');
            }
        } catch (e) {
            console.log('Error setting volume:', e);
        }
    }

    async youtubeSetSpeed(speed) {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'youtubeControl',
                command: 'setSpeed',
                params: { speed }
            });
            if (response?.focusBlocked) {
                this.showToast('🎯 Focus mode đang bật!');
            }
        } catch (e) {
            console.log('Error setting speed:', e);
        }
    }

    handleProgressClick(e) {
        if (!this.youtubeProgressBar || !this.youtubeVideoDuration) return;

        const rect = this.youtubeProgressBar.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const seekTime = percent * this.youtubeVideoDuration;
        this.youtubeSeek(seekTime);

        // Update progress bar immediately for visual feedback
        if (this.youtubeProgressFill) {
            this.youtubeProgressFill.style.width = `${percent * 100}%`;
        }
    }

    handleProgressDrag(e) {
        if (!this.youtubeProgressBar || !this.youtubeVideoDuration) return;

        const rect = this.youtubeProgressBar.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const seekTime = percent * this.youtubeVideoDuration;

        // Update progress bar immediately
        if (this.youtubeProgressFill) {
            this.youtubeProgressFill.style.width = `${percent * 100}%`;
        }

        // Update current time display
        if (this.youtubeCurrentTime) {
            this.youtubeCurrentTime.textContent = this.formatYoutubeTime(seekTime);
        }

        this.youtubeSeek(seekTime);
    }

    async youtubeSeek(time) {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'youtubeControl',
                command: 'seek',
                params: { time }
            });
            if (response?.focusBlocked) {
                this.showToast('🎯 Focus mode đang bật!');
            }
        } catch (e) {
            console.log('Error seeking:', e);
        }
    }

    // ========================================
    // Settings
    // ========================================
    async loadSettings() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getSettings' });
            if (response && response.settings) {
                const s = response.settings;

                // Work hours
                this.settingWorkStart.value = this.formatTimeValue(s.workStart);
                this.settingWorkEnd.value = this.formatTimeValue(s.workEnd);
                this.settingLunchStart.value = this.formatTimeValue(s.lunchStart);
                this.settingLunchEnd.value = this.formatTimeValue(s.lunchEnd);

                // Weekend mode
                this.settingWeekendMode.value = s.weekendMode || 'mon_fri';
                this.settingSaturdayEnd.value = this.formatTimeValue(s.saturdayEnd);
                this.settingSundayEnd.value = this.formatTimeValue(s.sundayEnd);

                // Special reminders
                this.settingSleepTime.value = this.formatTimeValue(s.sleepReminderTime);
                this.settingNightMode.value = this.formatTimeValue(s.nightModeStart);

                // Notification
                this.settingNotification.checked = s.notificationEnabled !== false;

                // Intervals
                if (s.intervals) {
                    this.intervalWalk.value = s.intervals.walk || 30;
                    this.intervalWater.value = s.intervals.water || 45;
                    this.intervalEye.value = s.intervals.eye_20_20_20 || 20;
                    this.intervalPosture.value = s.intervals.posture || 45;
                }

                this.updateWeekendModeUI();
            }
        } catch (e) {
            console.log('Error loading settings:', e);
        }
    }

    formatTimeValue(timeObj) {
        if (!timeObj) return '08:00';
        const h = String(timeObj.hour || 0).padStart(2, '0');
        const m = String(timeObj.minute || 0).padStart(2, '0');
        return `${h}:${m}`;
    }

    parseTimeValue(timeStr) {
        const [hour, minute] = timeStr.split(':').map(Number);
        return { hour: hour || 0, minute: minute || 0 };
    }

    updateWeekendModeUI() {
        const mode = this.settingWeekendMode.value;
        const satRow = document.getElementById('saturdayEndRow');
        const sunRow = document.getElementById('sundayEndRow');

        satRow.classList.toggle('hidden', mode !== 'mon_sat_half');
        sunRow.classList.toggle('hidden', mode !== 'mon_sun_half');
    }

    async saveSettings() {
        try {
            const settings = {
                workStart: this.parseTimeValue(this.settingWorkStart.value),
                workEnd: this.parseTimeValue(this.settingWorkEnd.value),
                lunchStart: this.parseTimeValue(this.settingLunchStart.value),
                lunchEnd: this.parseTimeValue(this.settingLunchEnd.value),
                weekendMode: this.settingWeekendMode.value,
                saturdayEnd: this.parseTimeValue(this.settingSaturdayEnd.value),
                sundayEnd: this.parseTimeValue(this.settingSundayEnd.value),
                sleepReminderTime: this.parseTimeValue(this.settingSleepTime.value),
                nightModeStart: this.parseTimeValue(this.settingNightMode.value),
                notificationEnabled: this.settingNotification.checked,
                intervals: {
                    walk: parseInt(this.intervalWalk.value) || 30,
                    water: parseInt(this.intervalWater.value) || 45,
                    toilet: 60,
                    eye_20_20_20: parseInt(this.intervalEye.value) || 20,
                    blink: 15,
                    posture: parseInt(this.intervalPosture.value) || 45,
                    neck_stretch: 60,
                    eye_exercise: 90,
                    breathing: 120
                },
                isConfigured: true
            };

            await chrome.runtime.sendMessage({ action: 'updateSettings', settings });
            this.showToast('💾 Đã lưu cài đặt!');
        } catch (e) {
            console.log('Error saving settings:', e);
            this.showToast('❌ Lỗi khi lưu cài đặt');
        }
    }

    async resetSettings() {
        try {
            await chrome.runtime.sendMessage({ action: 'resetToDefaults' });
            await this.loadSettings();
            this.showToast('🔄 Đã đặt lại mặc định!');
        } catch (e) {
            console.log('Error resetting settings:', e);
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new PopupController();
});
