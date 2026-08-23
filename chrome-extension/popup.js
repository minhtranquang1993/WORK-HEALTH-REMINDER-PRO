// ========================================
// Work Health Reminder PRO - Popup Script
// Version 3.2
//
// Logic thuần dùng chung với background qua lib/core.js (window.WHRCore).
// ========================================

const Core = window.WHRCore;

class PopupController {
    constructor() {
        this.initElements();
        this.initEventListeners();
        this.loadSettings();
        this.loadTodoData();
        this.loadHolidays();
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
        this.settingWorkPeriodEnabled = document.getElementById('settingWorkPeriodEnabled');
        this.settingWorkPeriodStart = document.getElementById('settingWorkPeriodStart');
        this.settingWorkPeriodEnd = document.getElementById('settingWorkPeriodEnd');
        this.settingSleepTime = document.getElementById('settingSleepTime');
        this.settingNightMode = document.getElementById('settingNightMode');
        this.settingNotification = document.getElementById('settingNotification');
        this.settingTelegramToken = document.getElementById('settingTelegramToken');
        this.settingTelegramChatId = document.getElementById('settingTelegramChatId');
        this.settingTelegramTime = document.getElementById('settingTelegramTime');

        // Intervals — 9 input, id dạng interval_<key>
        this.settingWaterPace = document.getElementById('settingWaterPace');
        this.settingIdleSuppression = document.getElementById('settingIdleSuppression');
        this.settingMeetingFocus = document.getElementById('settingMeetingFocus');
        this.settingAdaptive = document.getElementById('settingAdaptive');

        // Settings buttons
        this.btnSaveSettings = document.getElementById('btnSaveSettings');
        this.btnResetSettings = document.getElementById('btnResetSettings');
        this.btnTestTelegram = document.getElementById('btnTestTelegram');

        // Water Tracker
        this.waterAmount = document.getElementById('waterAmount');
        this.waterProgressFill = document.getElementById('waterProgressFill');
        this.waterPct = document.getElementById('waterPct');
        this.btnWater200 = document.getElementById('btnWater200');
        this.btnWater300 = document.getElementById('btnWater300');
        this.btnWater500 = document.getElementById('btnWater500');
        this.btnWaterReset = document.getElementById('btnWaterReset');
        this.btnWaterUndo = document.getElementById('btnWaterUndo');
        this.settingWaterGoal = document.getElementById('settingWaterGoal');
        this.settingWaterCup = document.getElementById('settingWaterCup');

        // Exercise panel
        this.exercisePanel = document.getElementById('exercisePanel');
        this.btnExerciseQuick = document.getElementById('btnExerciseQuick');
        this.btnCloseExercisePanel = document.getElementById('btnCloseExercisePanel');

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

        // Tab đang mở — dùng để chỉ poll YouTube khi thật sự đang xem tab đó
        this.activeTab = 'timers';

        // Snapshot getStatus gần nhất, để tick 1 giây không cần gửi message
        this.lastStatus = null;
        this.lastStatusAt = 0;

        // Banner lý do bị chặn (idle / họp / nghỉ trưa...)
        this.suppressBanner = document.getElementById('suppressBanner');

        // YouTube video duration (for seek calculation)
        this.youtubeVideoDuration = 0;
        this.isSeekDragging = false;

        // Track selected YouTube tab
        this.selectedYoutubeTabId = null;

        // Todo elements
        this.todoInput = document.getElementById('todoInput');
        this.todoPriority = document.getElementById('todoPriority');
        this.todoFrequency = document.getElementById('todoFrequency');
        this.btnTodoAdd = document.getElementById('btnTodoAdd');
        this.todoList = document.getElementById('todoList');
        this.todoEmptyState = document.getElementById('todoEmptyState');
        this.todoProgressFill = document.getElementById('todoProgressFill');
        this.todoPercentText = document.getElementById('todoPercentText');
        this.todoCompletedCount = document.getElementById('todoCompletedCount');
        this.todoTotalCount = document.getElementById('todoTotalCount');
        this.todoStreakCount = document.getElementById('todoStreakCount');
        this.btnToggleStats = document.getElementById('btnToggleStats');
        this.todoStatsSection = document.getElementById('todoStatsSection');
        this.statsChartContainer = document.getElementById('statsChartContainer');
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

        // Exercise panel toggle
        if (this.btnExerciseQuick) {
            this.btnExerciseQuick.addEventListener('click', () => this.toggleExercisePanel());
        }
        if (this.btnCloseExercisePanel) {
            this.btnCloseExercisePanel.addEventListener('click', () => this.closeExercisePanel());
        }

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
        this.settingWorkPeriodEnabled.addEventListener('change', () => this.updateWorkPeriodUI());
        this.btnSaveSettings.addEventListener('click', () => this.saveSettings());
        this.btnResetSettings.addEventListener('click', () => this.resetSettings());
        this.btnTestTelegram.addEventListener('click', () => this.testTelegram());

        // Water Tracker — dùng event delegation để đảm bảo hoạt động
        const waterActions = document.querySelector('.water-actions');
        if (waterActions) {
            waterActions.addEventListener('click', (e) => {
                const btn = e.target.closest('.water-btn');
                if (!btn) return;

                if (btn.id === 'btnWater200') this.addWater(200);
                else if (btn.id === 'btnWater300') this.addWater(300);
                else if (btn.id === 'btnWater500') this.addWater(500);
                else if (btn.id === 'btnWaterUndo') this.undoWater();
                else if (btn.id === 'btnWaterReset') this.resetWater();
            });
        }

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

        // Todo events
        if (this.btnTodoAdd) {
            this.btnTodoAdd.addEventListener('click', () => this.addTodo());
        }
        if (this.todoInput) {
            this.todoInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.addTodo();
            });
        }
        if (this.btnToggleStats) {
            this.btnToggleStats.addEventListener('click', () => this.toggleWeeklyStats());
        }

        // Holiday events
        const btnAddCustomHoliday = document.getElementById('btnAddCustomHoliday');
        if (btnAddCustomHoliday) {
            btnAddCustomHoliday.addEventListener('click', () => this.addCustomHoliday());
        }
    }

    switchTab(tabName) {
        this.activeTab = tabName;

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `tab-${tabName}`);
        });

        if (tabName === 'todo') this.loadTodoData();
        if (tabName === 'settings') this.loadHolidays();
        if (tabName === 'youtube') this.updateYoutubeDisplay();
    }

    startUpdating() {
        this.updateDisplay();
        // Tick mỗi giây CHỈ để vẽ lại đồng hồ + đếm ngược từ dữ liệu đã có.
        // Bản cũ gọi getStatus mỗi giây, mà mỗi lần gọi lại ghi storage
        // => ~1 write/giây và service worker không bao giờ ngủ.
        setInterval(() => this.tickLocal(), 1000);
        // Đồng bộ với background thưa hơn nhiều
        setInterval(() => this.updateDisplay(), 15000);
    }

    /** Vẽ lại từ snapshot cuối, không gửi message. */
    tickLocal() {
        this.updateClock();
        if (!this.lastStatus) return;

        const elapsed = Math.floor((Date.now() - this.lastStatusAt) / 1000);
        const timers = {};
        for (const [key, val] of Object.entries(this.lastStatus.timers || {})) {
            timers[key] = val == null ? null : Math.max(0, val - elapsed);
        }
        this.updateTimers(timers, this.lastStatus.suppressed);
        this.updateFocusDisplay(this.lastStatus.state);
        this.updatePomodoroDisplay(this.lastStatus.state, this.lastStatus.settings);
    }

    async updateDisplay() {
        this.updateClock();

        try {
            const response = await chrome.runtime.sendMessage({ action: 'getStatus' });
            if (response && response.workStatus) {
                this.lastStatus = response;
                this.lastStatusAt = Date.now();

                this.updateStatus(response.workStatus);
                this.updateTimers(response.timers, response.suppressed);
                this.updateProgress(response.settings);
                this.updatePauseButton(response.settings.isPaused);
                this.updateFocusDisplay(response.state);
                this.updatePomodoroDisplay(response.state, response.settings);
                if (response.water) {
                    this.updateWaterUI({
                        totalMl: response.water.totalMl,
                        goalMl: response.water.goalMl
                    });
                }
            }
        } catch (e) {
            console.warn('[popup] getStatus:', e.message);
            if (this.statusText && this.statusText.textContent === 'Đang kiểm tra...') {
                this.statusText.textContent = '⏳ Đang kết nối...';
                setTimeout(() => this.updateDisplay(), 2000);
            }
        }

        // YouTube chỉ refresh khi đang ở tab YouTube — bản cũ poll mỗi 2s
        // bất kể user đang xem tab nào.
        if (this.activeTab === 'youtube') {
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

        const cls = {
            paused: 'paused', notifications_off: 'paused',
            lunch: 'lunch', holiday: 'holiday',
            weekend: 'ended', before_work: 'ended', after_work: 'ended',
            focus: 'focus', idle: 'ended', locked: 'ended', meeting: 'focus'
        }[workStatus.status];
        if (cls) this.statusBadge.classList.add(cls);
        else if (workStatus.status.startsWith('pomodoro')) this.statusBadge.classList.add('pomodoro');

        this.statusText.textContent = workStatus.label;

        // Hiện rõ LÝ DO đang không nhắc, để suppression không bao giờ
        // "im lặng thất bại" — user luôn biết vì sao chưa có nhắc nhở.
        if (this.suppressBanner) {
            if (workStatus.suppressed) {
                this.suppressBanner.textContent = `Đang tạm không nhắc — ${workStatus.label}`;
                this.suppressBanner.classList.remove('hidden');
            } else {
                this.suppressBanner.classList.add('hidden');
            }
        }
    }

    /**
     * Đếm ngược lấy từ chrome.alarms qua background. Khi đang bị chặn thì
     * hiện dấu gạch thay vì con số, vì con số đó sẽ là lời nói dối:
     * alarm vẫn chạy nhưng thông báo bị chặn ở tầng gửi.
     */
    updateTimers(timers, suppressed) {
        if (!timers) return;
        const set = (el, key) => {
            if (!el) return;
            el.textContent = suppressed ? '--:--' : this.formatTime(timers[key]);
        };
        set(this.walkTimer, 'walk');
        set(this.waterTimer, 'water');
        set(this.eyeTimer, 'eye_20_20_20');
        set(this.blinkTimer, 'blink');
        set(this.postureTimer, 'posture');
        set(this.neckTimer, 'neck_stretch');
    }

    formatTime(seconds) {
        if (seconds === undefined || seconds === null) return '--:--';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    updateProgress(settings) {
        // Dùng chung công thức với background (Core) để 2 bên không lệch
        const now = new Date();
        const total = Core.workMinutesToday(settings, now);
        const worked = Core.workMinutesElapsed(settings, now);
        const percent = total > 0 ? Math.min(100, Math.max(0, (worked / total) * 100)) : 0;

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

    // ============================================
    // WATER TRACKER
    // ============================================

    async addWater(ml) {
        const btn = document.getElementById(`btnWater${ml}`);
        if (btn) {
            btn.classList.add('water-added');
            btn.textContent = '✓';
            setTimeout(() => {
                btn.classList.remove('water-added');
                btn.textContent = `+${ml}ml`;
            }, 600);
        }

        try {
            const response = await this.sendWithRetry({ action: 'addWater', ml }, 2);
            if (response?.log) this.updateWaterUI(response.log);
        } catch (e) {
            console.warn('[Water] không gửi được:', e.message);
        }
    }

    async sendWithRetry(message, retries = 2) {
        for (let i = 0; i <= retries; i++) {
            try {
                const response = await chrome.runtime.sendMessage(message);
                if (response) return response;
            } catch (e) {
                if (i < retries) {
                    await new Promise(r => setTimeout(r, 300));
                    continue;
                }
                throw e;
            }
        }
        return null;
    }

    async resetWater() {
        // Confirm trước khi reset
        const currentText = this.waterAmount?.textContent || '0';
        if (!confirm(`Xóa toàn bộ nước về 0?\n(Hiện tại: ${currentText})`)) return;

        try {
            const response = await this.sendWithRetry({ action: 'resetWater' }, 2);
            console.log('[Water] Reset response:', response);
            if (response?.log) this.updateWaterUI(response.log);
        } catch (e) {
            console.error('[Water] Reset error:', e);
            this.updateWaterUI({ totalMl: 0, goalMl: 2000 });
        }
    }

    async undoWater() {
        const btn = this.btnWaterUndo;
        try {
            const response = await this.sendWithRetry({ action: 'undoWater' }, 2);
            if (response?.log) {
                this.updateWaterUI(response.log);
                if (btn) {
                    btn.classList.add('water-added');
                    btn.textContent = '✓';
                    setTimeout(() => { btn.classList.remove('water-added'); btn.textContent = '↩'; }, 600);
                }
            } else if (response?.error) {
                this.showToast('⚠️ ' + response.error);
                if (btn) {
                    btn.textContent = '✗';
                    setTimeout(() => { btn.textContent = '↩'; }, 800);
                }
            }
        } catch (e) {
            console.warn('[Water] undo:', e.message);
        }
    }

    updateWaterUI(log) {
        if (!log) return;
        const goal = log.goalMl || 2000;
        const total = log.totalMl || 0;
        const pct = Math.min(100, Math.round(total * 100 / goal));

        if (this.waterAmount) this.waterAmount.textContent = `${total} / ${goal}ml`;
        if (this.waterProgressFill) this.waterProgressFill.style.width = `${pct}%`;
        if (this.waterPct) this.waterPct.textContent = `${pct}%`;

        // Gradient color: xanh dương → xanh lá → vàng gold khi đạt 100%
        let bg;
        if (pct >= 100) bg = 'linear-gradient(90deg, #43a047, #66bb6a)';
        else if (pct >= 60) bg = 'linear-gradient(90deg, #42a5f5, #1976D2)';
        else bg = 'linear-gradient(90deg, #64b5f6, #42a5f5)';
        if (this.waterProgressFill) this.waterProgressFill.style.background = bg;
    }

    async testTelegram() {
        // Gửi token/chat id TRỰC TIẾP, không gọi saveSettings() nữa.
        // Bug cũ: nút Test gọi saveSettings() -> ghi đè toàn bộ interval và
        // re-phase mọi alarm, dù user chỉ muốn thử gửi tin nhắn.
        try {
            this.btnTestTelegram.textContent = '⏳ Đang gửi...';
            this.btnTestTelegram.disabled = true;

            const response = await chrome.runtime.sendMessage({
                action: 'testTelegram',
                botToken: this.settingTelegramToken.value.trim(),
                chatId: this.settingTelegramChatId.value.trim()
            });

            if (response && response.success) {
                this.showToast('✅ Đã gửi tin nhắn Telegram!');
            } else {
                this.showToast('❌ ' + ((response && response.error) || 'Lỗi không rõ'));
            }
        } catch (e) {
            console.log('Error testing telegram:', e);
            this.showToast('❌ Lỗi kết nối');
        } finally {
            this.btnTestTelegram.textContent = '📢 Test thông báo';
            this.btnTestTelegram.disabled = false;
        }
    }

    toggleExercisePanel() {
        if (this.exercisePanel) {
            this.exercisePanel.classList.toggle('hidden');
        }
    }

    closeExercisePanel() {
        if (this.exercisePanel) {
            this.exercisePanel.classList.add('hidden');
        }
    }

    showExercise(exerciseType) {
        const exercise = EXERCISES[exerciseType];
        if (!exercise) return;

        this.closeExercisePanel();
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

            // Auto-select first tab if none selected
            if (!this.selectedYoutubeTabId || !tabsResponse.tabs.find(t => t.tabId === this.selectedYoutubeTabId)) {
                this.selectedYoutubeTabId = tabsResponse.tabs[0].tabId;
            }

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

        this.youtubeTabsList.innerHTML = tabs.map(tab => {
            const isSelected = tab.tabId === this.selectedYoutubeTabId;
            return `
            <div class="youtube-tab-item ${isSelected ? 'selected' : ''}"
                 data-tab-id="${tab.tabId}">
                <span class="youtube-tab-status">${tab.isPlaying ? '▶️' : '⏸️'}</span>
                <span class="youtube-tab-title" title="${this.escapeHtml(tab.title)}">
                    ${this.escapeHtml(tab.title)}
                </span>
                <button class="youtube-tab-close" data-tab-id="${tab.tabId}" title="Đóng tab">✕</button>
            </div>
        `;
        }).join('');

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

    /**
     * Escape dùng chung với background (Core.escapeHtml) — phủ cả `"` và `'`
     * nên an toàn khi nhúng vào attribute. Bản cũ dùng textContent->innerHTML
     * không escape dấu ngoặc kép, làm title video YouTube phá được attribute.
     */
    escapeHtml(text) {
        return Core.escapeHtml(text);
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

        // Update speed selector
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
                // Reset selection if closed tab was selected
                if (this.selectedYoutubeTabId === tabId) {
                    this.selectedYoutubeTabId = null;
                }
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
    // Holidays
    // ========================================
    async loadHolidays() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getHolidays' });
            if (response && response.success) {
                this.renderFixedHolidays(response.fixedHolidays);
                this.renderCustomHolidays(response.customHolidays);
            }
        } catch (e) {
            console.log('Error loading holidays:', e);
        }
    }

    renderFixedHolidays(holidays) {
        const container = document.getElementById('fixedHolidayList');
        if (!container) return;

        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        container.innerHTML = holidays.map(h => {
            const isActive = todayStr >= h.start && todayStr <= h.end;
            const isPast = todayStr > h.end;
            const isUpcoming = !isActive && !isPast;
            const statusClass = isActive ? 'active' : (isPast ? 'past' : '');

            let badge = '';
            if (isActive) badge = '<span class="holiday-badge now">Đang nghỉ</span>';
            else if (isUpcoming) badge = '<span class="holiday-badge upcoming">Sắp tới</span>';

            const dateDisplay = h.start === h.end
                ? this.formatHolidayDate(h.start)
                : `${this.formatHolidayDate(h.start)} → ${this.formatHolidayDate(h.end)}`;

            return `
                <div class="holiday-item ${statusClass}">
                    <span class="holiday-name">🎌 ${this.escapeHtml(h.name)}</span>
                    <span class="holiday-date">${dateDisplay}</span>
                    ${badge}
                </div>
            `;
        }).join('');
    }

    renderCustomHolidays(holidays) {
        const container = document.getElementById('customHolidayList');
        if (!container) return;

        if (!holidays || holidays.length === 0) {
            container.innerHTML = '<div class="custom-holiday-empty">Chưa có ngày nghỉ tùy chỉnh</div>';
            return;
        }

        container.innerHTML = holidays.map((h, i) => {
            const dateDisplay = h.start === h.end
                ? this.formatHolidayDate(h.start)
                : `${this.formatHolidayDate(h.start)} → ${this.formatHolidayDate(h.end)}`;

            return `
                <div class="custom-holiday-item">
                    <div class="holiday-info">
                        <span class="holiday-name">📌 ${this.escapeHtml(h.name)}</span>
                        <span class="holiday-date">${dateDisplay}</span>
                    </div>
                    <button class="custom-holiday-delete" data-index="${i}" title="Xóa">✕</button>
                </div>
            `;
        }).join('');

        // Add delete listeners
        container.querySelectorAll('.custom-holiday-delete').forEach(btn => {
            btn.addEventListener('click', () => this.removeCustomHoliday(parseInt(btn.dataset.index)));
        });
    }

    formatHolidayDate(dateStr) {
        const [y, m, d] = dateStr.split('-');
        return `${d}/${m}`;
    }

    async addCustomHoliday() {
        const name = document.getElementById('customHolidayName').value.trim();
        const start = document.getElementById('customHolidayStart').value;
        const end = document.getElementById('customHolidayEnd').value || start;

        if (!name || !start) {
            this.showToast('⚠️ Vui lòng nhập tên và ngày');
            return;
        }

        if (end < start) {
            this.showToast('⚠️ Ngày kết thúc phải sau ngày bắt đầu');
            return;
        }

        try {
            const response = await chrome.runtime.sendMessage({
                action: 'addCustomHoliday',
                name, start, end
            });

            if (response && response.success) {
                this.renderCustomHolidays(response.customHolidays);
                // Clear form
                document.getElementById('customHolidayName').value = '';
                document.getElementById('customHolidayStart').value = '';
                document.getElementById('customHolidayEnd').value = '';
                this.showToast('✅ Đã thêm ngày nghỉ');
            }
        } catch (e) {
            console.log('Error adding custom holiday:', e);
            this.showToast('❌ Lỗi thêm ngày nghỉ');
        }
    }

    async removeCustomHoliday(index) {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'removeCustomHoliday',
                index
            });

            if (response && response.success) {
                this.renderCustomHolidays(response.customHolidays);
                this.showToast('🗑️ Đã xóa ngày nghỉ');
            }
        } catch (e) {
            console.log('Error removing custom holiday:', e);
            this.showToast('❌ Lỗi xóa ngày nghỉ');
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

                // Work period
                this.settingWorkPeriodEnabled.checked = s.workPeriodEnabled || false;
                this.settingWorkPeriodStart.value = s.workPeriodStart || '';
                this.settingWorkPeriodEnd.value = s.workPeriodEnd || '';
                this.updateWorkPeriodUI();

                // Special reminders
                this.settingSleepTime.value = this.formatTimeValue(s.sleepReminderTime);
                this.settingNightMode.value = this.formatTimeValue(s.nightModeStart);

                // Notification
                this.settingNotification.checked = s.notificationEnabled !== false;

                // Water
                if (this.settingWaterGoal) this.settingWaterGoal.value = s.waterGoalMl || 2000;
                if (this.settingWaterCup) this.settingWaterCup.value = s.waterCupMl || 200;
                if (this.settingWaterPace) this.settingWaterPace.checked = s.waterPaceMode !== false;

                // Automation
                if (this.settingIdleSuppression) this.settingIdleSuppression.checked = s.idleSuppression !== false;
                if (this.settingMeetingFocus) this.settingMeetingFocus.checked = s.meetingAutoFocus !== false;
                if (this.settingAdaptive) this.settingAdaptive.checked = !!s.adaptiveIntervals;

                // Telegram
                this.settingTelegramToken.value = s.telegramBotToken || '';
                this.settingTelegramChatId.value = s.telegramChatId || '';
                this.settingTelegramTime.value = this.formatTimeValue(s.telegramReportTime || { hour: 17, minute: 0 });

                // Intervals — cả 9 loại, fallback về Core.DEFAULT_INTERVALS
                // (nguồn sự thật duy nhất) thay vì số viết tay như bản cũ.
                const ivl = Core.normalizeIntervals(s.intervals);
                for (const key of Core.INTERVAL_KEYS) {
                    const el = document.getElementById('interval_' + key);
                    if (el) el.value = ivl[key];
                }

                this.updateWeekendModeUI();
                this.updateNotificationBudget(s);
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

    updateWorkPeriodUI() {
        const enabled = this.settingWorkPeriodEnabled.checked;
        document.getElementById('workPeriodStartRow').classList.toggle('hidden', !enabled);
        document.getElementById('workPeriodEndRow').classList.toggle('hidden', !enabled);
    }

    async saveSettings() {
        try {
            // Đọc TẤT CẢ 9 interval từ UI. Bản cũ hardcode 5 giá trị
            // (blink:15, neck:60, toilet:60, eye_exercise:90, breathing:120)
            // nên mỗi lần bấm Save là ghi đè im lặng cài đặt của user.
            const intervals = {};
            for (const key of Core.INTERVAL_KEYS) {
                const el = document.getElementById('interval_' + key);
                const raw = el ? parseInt(el.value, 10) : NaN;
                intervals[key] = Number.isFinite(raw) ? raw : Core.DEFAULT_INTERVALS[key];
            }

            const settings = {
                workStart: this.parseTimeValue(this.settingWorkStart.value),
                workEnd: this.parseTimeValue(this.settingWorkEnd.value),
                lunchStart: this.parseTimeValue(this.settingLunchStart.value),
                lunchEnd: this.parseTimeValue(this.settingLunchEnd.value),
                weekendMode: this.settingWeekendMode.value,
                saturdayEnd: this.parseTimeValue(this.settingSaturdayEnd.value),
                sundayEnd: this.parseTimeValue(this.settingSundayEnd.value),
                workPeriodEnabled: this.settingWorkPeriodEnabled.checked,
                workPeriodStart: this.settingWorkPeriodStart.value || '',
                workPeriodEnd: this.settingWorkPeriodEnd.value || '',
                sleepReminderTime: this.parseTimeValue(this.settingSleepTime.value),
                nightModeStart: this.parseTimeValue(this.settingNightMode.value),
                notificationEnabled: this.settingNotification.checked,
                waterGoalMl: parseInt(this.settingWaterGoal?.value) || 2000,
                waterCupMl: parseInt(this.settingWaterCup?.value) || 200,
                waterPaceMode: this.settingWaterPace ? this.settingWaterPace.checked : true,
                idleSuppression: this.settingIdleSuppression ? this.settingIdleSuppression.checked : true,
                meetingAutoFocus: this.settingMeetingFocus ? this.settingMeetingFocus.checked : true,
                adaptiveIntervals: this.settingAdaptive ? this.settingAdaptive.checked : false,
                telegramBotToken: this.settingTelegramToken.value.trim(),
                telegramChatId: this.settingTelegramChatId.value.trim(),
                telegramReportTime: this.parseTimeValue(this.settingTelegramTime.value),
                intervals: Core.normalizeIntervals(intervals),
                isConfigured: true
            };

            const res = await chrome.runtime.sendMessage({ action: 'updateSettings', settings });
            if (res && res.success) {
                this.showToast('💾 Đã lưu cài đặt!');
                this.updateNotificationBudget(res.settings);
            } else {
                this.showToast('❌ Lỗi khi lưu cài đặt');
            }
        } catch (e) {
            console.log('Error saving settings:', e);
            this.showToast('❌ Lỗi khi lưu cài đặt');
        }
    }

    /** Cho user thấy ngay chi phí ồn của cấu hình đang chọn. */
    updateNotificationBudget(settings) {
        const el = document.getElementById('notificationBudget');
        if (!el || !settings) return;
        const minutes = Core.workMinutesToday(settings, new Date()) || 480;
        const action = Core.countDailyNotifications(settings.intervals, minutes, { actionOnly: true });
        const micro = Core.countDailyNotifications(settings.intervals, minutes, { microOnly: true });
        const over = action > Core.ACTION_NOTIFICATION_BUDGET;
        el.textContent = `≈ ${action} thông báo cần hành động + ${micro} nhắc mắt 20-20-20 mỗi ngày`
            + (over ? ` — vượt ngưỡng ${Core.ACTION_NOTIFICATION_BUDGET}, dễ bị bỏ qua` : '');
        el.classList.toggle('budget-warn', over);
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


    // ========================================
    // Todo Methods
    // ========================================

    async loadTodoData() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getTodoData' });
            if (response && response.success) {
                this.renderTodoList(response.todoTasks.tasks);
                this.updateTodoProgress(response.todoTasks.tasks);
                this.updateTodoStreak(response.todoSettings);
            }
        } catch (e) {
            console.log('Error loading todo data:', e);
        }
    }

    async addTodo() {
        if (!this.todoInput) return;
        const text = this.todoInput.value.trim();
        if (!text) return;

        const priority = this.todoPriority.value;
        const frequency = this.todoFrequency ? this.todoFrequency.value : 'once';

        try {
            const response = await chrome.runtime.sendMessage({
                action: 'addTodo',
                task: { text, priority, frequency }
            });

            if (response && response.success) {
                this.todoInput.value = '';
                this.loadTodoData(); // Reload to refresh list and order
            }
        } catch (e) {
            console.log('Error adding todo:', e);
        }
    }

    async toggleTodo(taskId, earlyComplete = false) {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'toggleTodo',
                taskId: taskId,
                earlyComplete: earlyComplete
            });

            if (response && response.success) {
                this.loadTodoData();
            }
        } catch (e) {
            console.log('Error toggling todo:', e);
        }
    }

    async deleteTodo(taskId, element) {
        if (element) {
            element.classList.add('sliding-out');
            // Wait for animation
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        try {
            const response = await chrome.runtime.sendMessage({
                action: 'deleteTodo',
                taskId: taskId
            });

            if (response && response.success) {
                this.loadTodoData();
            }
        } catch (e) {
            console.log('Error deleting todo:', e);
        }
    }

    renderTodoList(tasks) {
        if (!this.todoList) return;

        if (!tasks || tasks.length === 0) {
            this.todoList.innerHTML = '';
            this.todoEmptyState.classList.remove('hidden');
            return;
        }

        // Separate active vs scheduled (not due today)
        const activeTasks = tasks.filter(t => t.isActiveToday !== false);
        const scheduledTasks = tasks.filter(t => t.isActiveToday === false);

        if (activeTasks.length === 0 && scheduledTasks.length === 0) {
            this.todoList.innerHTML = '';
            this.todoEmptyState.classList.remove('hidden');
            return;
        }

        this.todoEmptyState.classList.add('hidden');

        // Sort: Incomplete first, then by priority (High > Medium > Low), then by time
        const priorityOrder = { 'high': 0, 'medium': 1, 'low': 2 };

        const sortedTasks = [...activeTasks].sort((a, b) => {
            // 1. Completed last
            if (a.completed !== b.completed) return a.completed ? 1 : -1;

            // 2. Priority
            if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
                return priorityOrder[a.priority] - priorityOrder[b.priority];
            }

            // 3. Time (Newest first)
            return b.createdAt - a.createdAt;
        });

        const getFrequencyLabel = (freq) => {
            switch (freq) {
                case 'daily': return 'Hàng ngày';
                case 'weekly': return 'Hàng tuần';
                case 'monthly': return 'Hàng tháng';
                default: return null;
            }
        };

        const getPriorityLabel = (prio) => {
            switch (prio) {
                case 'high': return 'Cao';
                case 'medium': return 'TB';
                case 'low': return 'Thấp';
                default: return '';
            }
        };

        const getFreqDueLabel = (freq) => {
            if (freq === 'weekly') return 'T2';
            if (freq === 'monthly') return 'Mùng 1';
            return '';
        };

        // Render active tasks
        let html = sortedTasks.map(task => {
            const freqLabel = getFrequencyLabel(task.frequency);

            return `
            <div class="todo-item ${task.priority ? 'priority-' + task.priority : 'priority-medium'} ${task.completed ? 'is-completed' : ''}" data-id="${task.id}">
                <div class="todo-checkbox-wrapper">
                    <input type="checkbox" class="todo-checkbox" ${task.completed ? 'checked' : ''}>
                </div>
                <div class="todo-content">
                    <span class="todo-text">${this.escapeHtml(task.text)}</span>
                    <div class="todo-meta">
                        ${freqLabel ? `<span class="todo-tag">🔄 ${freqLabel}</span>` : ''}
                    </div>
                </div>
                <button class="todo-delete-btn" title="Xóa">🗑️</button>
            </div>
        `}).join('');

        // Render scheduled (not due today) section
        if (scheduledTasks.length > 0) {
            html += `<div class="todo-scheduled-header">📅 Chưa đến hạn</div>`;
            html += scheduledTasks.map(task => {
                const dueLabel = getFreqDueLabel(task.frequency);
                return `
                <div class="todo-item todo-scheduled ${task.completed ? 'is-completed' : ''}" data-id="${task.id}">
                    <div class="todo-checkbox-wrapper">
                        <input type="checkbox" class="todo-checkbox" ${task.completed ? 'checked' : ''}>
                    </div>
                    <div class="todo-content">
                        <span class="todo-text">${this.escapeHtml(task.text)}</span>
                        <div class="todo-meta">
                            <span class="todo-tag">📅 ${dueLabel}</span>
                            ${task.completedEarly ? `<span class="todo-tag todo-tag-early">⚡ Làm sớm</span>` : ''}
                        </div>
                    </div>
                    <button class="todo-delete-btn" title="Xóa">🗑️</button>
                </div>
            `}).join('');
        }

        this.todoList.innerHTML = html;

        // Add event listeners
        this.todoList.querySelectorAll('.todo-item').forEach(item => {
            const id = item.dataset.id;
            const checkbox = item.querySelector('.todo-checkbox');
            const deleteBtn = item.querySelector('.todo-delete-btn');
            const isScheduled = item.classList.contains('todo-scheduled');

            if (!isScheduled) {
                // Active tasks: click to toggle
                item.addEventListener('click', (e) => {
                    if (e.target === deleteBtn || deleteBtn.contains(e.target) || e.target === checkbox) return;
                    item.classList.toggle('is-completed');
                    checkbox.checked = !checkbox.checked;
                    this.toggleTodo(id);
                });

                checkbox.addEventListener('click', (e) => {
                    e.stopPropagation();
                    item.classList.toggle('is-completed');
                    this.toggleTodo(id);
                });
            } else {
                // Scheduled tasks: allow early complete
                item.addEventListener('click', (e) => {
                    if (e.target === deleteBtn || deleteBtn.contains(e.target) || e.target === checkbox) return;
                    item.classList.toggle('is-completed');
                    checkbox.checked = !checkbox.checked;
                    this.toggleTodo(id, true);
                });

                checkbox.addEventListener('click', (e) => {
                    e.stopPropagation();
                    item.classList.toggle('is-completed');
                    this.toggleTodo(id, true);
                });
            }

            // Delete click (both active and scheduled)
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('Bạn có chắc muốn xóa task này?')) {
                    this.deleteTodo(id, item);
                }
            });
        });
    }

    updateTodoProgress(tasks) {
        if (!tasks) return;
        // Only count tasks active today (weekly/monthly excluded on off days)
        const activeTasks = tasks.filter(t => t.isActiveToday !== false);
        const total = activeTasks.length;
        const completed = activeTasks.filter(t => t.completed).length;

        if (this.todoTotalCount) this.todoTotalCount.textContent = total;
        if (this.todoCompletedCount) this.todoCompletedCount.textContent = completed;

        let percent = 0;
        if (total > 0) {
            percent = Math.round((completed / total) * 100);
        }

        if (this.todoPercentText) this.todoPercentText.textContent = `${percent}%`;
        if (this.todoProgressFill) this.todoProgressFill.style.width = `${percent}%`;
    }

    updateTodoStreak(settings) {
        if (settings && settings.streak !== undefined && this.todoStreakCount) {
            this.todoStreakCount.textContent = settings.streak;
        }
    }

    toggleWeeklyStats() {
        if (this.todoStatsSection.classList.contains('hidden')) {
            this.todoStatsSection.classList.remove('hidden');
            this.btnToggleStats.textContent = '🙈 Ẩn thống kê';
            this.loadWeeklyStats();
        } else {
            this.todoStatsSection.classList.add('hidden');
            this.btnToggleStats.textContent = '📊 Xem thống kê tuần';
        }
    }

    async loadWeeklyStats() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getTodoHistory' });
            if (response && response.success) {
                this.renderWeeklyChart(response.history);
            }
        } catch (e) {
            console.log('Error loading history:', e);
        }
    }

    renderWeeklyChart(history) {
        if (!this.statsChartContainer) return;

        // 7 ngày gần nhất. Key là "YYYY-MM-DD" theo giờ ĐỊA PHƯƠNG và nhãn
        // thứ được dựng từ Date(y, m-1, d) — không parse chuỗi ISO, vì
        // new Date("2026-08-23") bị hiểu là UTC và lệch 1 ngày ở múi giờ âm.
        const days = [];
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
            days.push({ key: Core.toLocalDateKey(d), date: d });
        }

        const weekdays = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

        this.statsChartContainer.innerHTML = days.map((day, index) => {
            const isToday = index === 6;
            const data = (history && history[day.key]) || { total: 0, completed: 0, percentage: 0 };
            const tip = `${data.completed}/${data.total} (${data.percentage}%)`;

            return `
                <div class="chart-column ${isToday ? 'today-column' : ''}">
                    <div class="chart-bar-bg" title="${this.escapeHtml(tip)}">
                        <div class="chart-bar-fill" style="height: ${Number(data.percentage) || 0}%"></div>
                    </div>
                    <span class="chart-label">${weekdays[day.date.getDay()]}</span>
                </div>
            `;
        }).join('');
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new PopupController();
});
