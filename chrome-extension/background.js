// ========================================
// Work Health Reminder PRO - Background Service Worker
// Version 3.0 - Full features like Menubar App
// ========================================

// Default settings (matching menubar app)
const DEFAULT_SETTINGS = {
    // Work hours
    workStart: { hour: 8, minute: 0 },
    lunchStart: { hour: 11, minute: 30 },
    lunchEnd: { hour: 13, minute: 0 },
    workEnd: { hour: 17, minute: 30 },
    nightModeStart: { hour: 18, minute: 0 },

    // New settings
    sleepReminderTime: { hour: 23, minute: 0 },
    morningReminderStart: { hour: 7, minute: 30 },
    weekendMode: "mon_fri", // mon_fri, mon_sat_full, mon_sat_half, mon_sun_full, mon_sun_half
    saturdayEnd: { hour: 12, minute: 0 },
    sundayEnd: { hour: 12, minute: 0 },

    // Pomodoro settings
    pomodoroWork: 25,
    pomodoroBreak: 5,
    pomodoroLongBreak: 15,

    // Intervals (minutes)
    intervals: {
        walk: 30,
        water: 45,
        toilet: 60,
        eye_20_20_20: 20,
        blink: 15,
        posture: 45,
        neck_stretch: 60,
        eye_exercise: 90,
        breathing: 120
    },

    // Toggles
    soundEnabled: true,
    notificationEnabled: true,
    isPaused: false,
    isConfigured: false
};

// State management
let state = {
    // Focus mode
    focusEndTime: null,

    // Pomodoro
    pomodoroState: null, // "work", "break", null
    pomodoroEndTime: null,
    pomodoroCount: 0,

    // Daily flags
    nightModeReminded: false,
    sleepReminded: false,
    morningReminded: false,
    workStartedToday: false
};

// Alarm names
const ALARMS = {
    WALK: 'walk_reminder',
    WATER: 'water_reminder',
    TOILET: 'toilet_reminder',
    EYE: 'eye_reminder',
    BLINK: 'blink_reminder',
    POSTURE: 'posture_reminder',
    NECK: 'neck_reminder',
    EYE_EXERCISE: 'eye_exercise_reminder',
    BREATHING: 'breathing_reminder',
    LUNCH: 'lunch_reminder',
    END_WORK: 'end_work_reminder',
    NIGHT_MODE: 'night_mode_reminder',
    SLEEP: 'sleep_reminder',
    MORNING: 'morning_reminder',
    STATUS_CHECK: 'status_check',
    POMODORO_CHECK: 'pomodoro_check',
    FOCUS_CHECK: 'focus_check',
    DAILY_RESET: 'daily_reset'
};

// Reminder data
const REMINDERS = {
    walk: {
        title: "🚶 Đến lúc đi bộ rồi!",
        message: "Đứng dậy và đi bộ 2-3 phút để thư giãn cơ thể nhé!"
    },
    water: {
        title: "💧 Uống nước đi!",
        message: "Uống một ly nước lọc để giữ cơ thể luôn được hydrate!"
    },
    toilet: {
        title: "🚻 Đi toilet thôi!",
        message: "Đến lúc đi toilet rồi, đừng nhịn quá lâu nhé!"
    },
    eye_20_20_20: {
        title: "👁️ 20-20-20!",
        message: "Nhìn ra xa 6 mét trong 20 giây để bảo vệ mắt!"
    },
    blink: {
        title: "😊 Chớp mắt!",
        message: "Chớp mắt 15-20 lần để làm ẩm mắt!"
    },
    posture: {
        title: "🪑 Kiểm tra tư thế!",
        message: "Ngồi thẳng lưng, thả lỏng vai, chân chạm đất nhé!"
    },
    neck_stretch: {
        title: "🧘 Giãn cổ vai!",
        message: "Dành 2 phút để giãn cơ cổ và vai nhé!"
    },
    eye_exercise: {
        title: "👁️ Bài tập mắt!",
        message: "Làm bài tập mắt để bảo vệ thị lực!"
    },
    breathing: {
        title: "🌬️ Hít thở sâu!",
        message: "Dành 2 phút hít thở sâu để thư giãn!"
    },
    lunch: {
        title: "🍱 Đến giờ ăn trưa!",
        message: "Đi lấy phiếu ăn cơm trưa và nghỉ ngơi nhé!"
    },
    end_work: {
        title: "🏠 Hết giờ làm việc!",
        message: "Chuẩn bị về nhà hoặc đón người yêu thôi! 💕"
    },
    night_mode: {
        title: "🌙 Bật Night Mode!",
        message: "Bật Night Shift/Dark Mode để bảo vệ mắt!"
    },
    sleep: {
        title: "🌙 Đến giờ ngủ rồi!",
        message: "Ngủ đủ giấc giúp tăng cường trí nhớ và sức khỏe!"
    },
    morning: {
        title: "🌅 Chuẩn bị làm việc!",
        message: "Sắp đến giờ làm việc. Bạn đã sẵn sàng chưa?"
    },
    pomodoro_work_end: {
        title: "🍅 Hết thời gian làm việc!",
        message: "Nghỉ ngơi một chút nhé!"
    },
    pomodoro_break_end: {
        title: "🍅 Hết thời gian nghỉ!",
        message: "Sẵn sàng tiếp tục làm việc chưa?"
    },
    focus_end: {
        title: "🎯 Focus Mode kết thúc!",
        message: "Đã hết thời gian tập trung. Nhắc nhở sẽ hoạt động lại!"
    }
};

// Initialize on install
chrome.runtime.onInstalled.addListener(async () => {
    console.log('Work Health Reminder PRO installed!');

    // Set default settings if not exists
    const existing = await chrome.storage.local.get('settings');
    if (!existing.settings) {
        await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
    }

    // Initialize state
    await chrome.storage.local.set({ state: state });

    // Initialize timers
    await resetAllTimers();

    // Start alarms
    setupAlarms();
});

// Setup all alarms
async function setupAlarms() {
    const { settings } = await chrome.storage.local.get('settings');
    if (!settings) return;

    // Clear existing alarms
    await chrome.alarms.clearAll();

    // Status check every minute
    chrome.alarms.create(ALARMS.STATUS_CHECK, { periodInMinutes: 1 });

    // Pomodoro/Focus check every 5 seconds (using a workaround)
    chrome.alarms.create(ALARMS.POMODORO_CHECK, { periodInMinutes: 0.1 }); // 6 seconds

    // Daily reset at midnight
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    chrome.alarms.create(ALARMS.DAILY_RESET, { when: midnight.getTime(), periodInMinutes: 24 * 60 });

    // Periodic reminders
    chrome.alarms.create(ALARMS.WALK, { periodInMinutes: settings.intervals.walk });
    chrome.alarms.create(ALARMS.WATER, { periodInMinutes: settings.intervals.water });
    chrome.alarms.create(ALARMS.TOILET, { periodInMinutes: settings.intervals.toilet });
    chrome.alarms.create(ALARMS.EYE, { periodInMinutes: settings.intervals.eye_20_20_20 });
    chrome.alarms.create(ALARMS.BLINK, { periodInMinutes: settings.intervals.blink });
    chrome.alarms.create(ALARMS.POSTURE, { periodInMinutes: settings.intervals.posture });
    chrome.alarms.create(ALARMS.NECK, { periodInMinutes: settings.intervals.neck_stretch });
    chrome.alarms.create(ALARMS.EYE_EXERCISE, { periodInMinutes: settings.intervals.eye_exercise });
    chrome.alarms.create(ALARMS.BREATHING, { periodInMinutes: settings.intervals.breathing });

    // Schedule fixed time alarms
    scheduleFixedTimeAlarms(settings);

    console.log('Alarms setup complete');
}

// Schedule fixed time alarms
function scheduleFixedTimeAlarms(settings) {
    const now = new Date();
    const today = now.toDateString();

    // Lunch alarm
    const lunchTime = new Date(today);
    lunchTime.setHours(settings.lunchStart.hour, settings.lunchStart.minute, 0);
    if (lunchTime > now) {
        chrome.alarms.create(ALARMS.LUNCH, { when: lunchTime.getTime() });
    }

    // End work alarm
    const endTime = new Date(today);
    const workEnd = getTodayWorkEnd(settings);
    endTime.setHours(workEnd.hour, workEnd.minute, 0);
    if (endTime > now) {
        chrome.alarms.create(ALARMS.END_WORK, { when: endTime.getTime() });
    }

    // Night mode alarm
    const nightTime = new Date(today);
    nightTime.setHours(settings.nightModeStart.hour, settings.nightModeStart.minute, 0);
    if (nightTime > now) {
        chrome.alarms.create(ALARMS.NIGHT_MODE, { when: nightTime.getTime() });
    }

    // Sleep reminder alarm
    const sleepTime = new Date(today);
    sleepTime.setHours(settings.sleepReminderTime.hour, settings.sleepReminderTime.minute, 0);
    if (sleepTime > now) {
        chrome.alarms.create(ALARMS.SLEEP, { when: sleepTime.getTime() });
    }

    // Morning reminder alarm
    const morningTime = new Date(today);
    morningTime.setHours(settings.morningReminderStart.hour, settings.morningReminderStart.minute, 0);
    if (morningTime > now && isWorkDay(settings)) {
        chrome.alarms.create(ALARMS.MORNING, { when: morningTime.getTime() });
    }
}

// Check if today is a work day
function isWorkDay(settings) {
    const today = new Date().getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
    const dayOfWeek = today === 0 ? 6 : today - 1; // Convert to Monday=0, Sunday=6

    switch (settings.weekendMode) {
        case "mon_fri":
            return dayOfWeek < 5; // Mon-Fri
        case "mon_sat_full":
        case "mon_sat_half":
            return dayOfWeek < 6; // Mon-Sat
        case "mon_sun_full":
        case "mon_sun_half":
            return true; // All week
        default:
            return dayOfWeek < 5;
    }
}

// Check if today is a half day (Saturday or Sunday)
function isHalfDay(settings) {
    const today = new Date().getDay();
    const dayOfWeek = today === 0 ? 6 : today - 1;

    if (dayOfWeek === 5 && settings.weekendMode === "mon_sat_half") {
        return true;
    }
    if (dayOfWeek === 6 && settings.weekendMode === "mon_sun_half") {
        return true;
    }
    return false;
}

// Get today's work end time
function getTodayWorkEnd(settings) {
    const today = new Date().getDay();
    const dayOfWeek = today === 0 ? 6 : today - 1;

    if (dayOfWeek === 5 && settings.weekendMode === "mon_sat_half") {
        return settings.saturdayEnd;
    }
    if (dayOfWeek === 6 && settings.weekendMode === "mon_sun_half") {
        return settings.sundayEnd;
    }
    return settings.workEnd;
}

// Check if currently in work time
function isWorkTime(settings) {
    if (!isWorkDay(settings)) return false;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const workStart = settings.workStart.hour * 60 + settings.workStart.minute;
    const workEnd = getTodayWorkEnd(settings);
    const workEndMinutes = workEnd.hour * 60 + workEnd.minute;

    // Half day: no lunch break
    if (isHalfDay(settings)) {
        return currentMinutes >= workStart && currentMinutes < workEndMinutes;
    }

    // Normal day: has lunch break
    const lunchStart = settings.lunchStart.hour * 60 + settings.lunchStart.minute;
    const lunchEnd = settings.lunchEnd.hour * 60 + settings.lunchEnd.minute;

    const morningWork = currentMinutes >= workStart && currentMinutes < lunchStart;
    const afternoonWork = currentMinutes >= lunchEnd && currentMinutes < workEndMinutes;

    return morningWork || afternoonWork;
}

// Check if currently lunch break
function isLunchBreak(settings) {
    if (!isWorkDay(settings) || isHalfDay(settings)) return false;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const lunchStart = settings.lunchStart.hour * 60 + settings.lunchStart.minute;
    const lunchEnd = settings.lunchEnd.hour * 60 + settings.lunchEnd.minute;

    return currentMinutes >= lunchStart && currentMinutes < lunchEnd;
}

// Check if in morning reminder window
function isMorningReminderWindow(settings) {
    if (!isWorkDay(settings)) return false;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const morningStart = settings.morningReminderStart.hour * 60 + settings.morningReminderStart.minute;
    const workStart = settings.workStart.hour * 60 + settings.workStart.minute;

    return currentMinutes >= morningStart && currentMinutes < workStart;
}

// Get current work status
function getWorkStatus(settings) {
    const savedState = state;

    if (settings.isPaused) {
        return { status: 'paused', label: '⏸️ Đã tạm dừng', color: 'gray' };
    }

    if (savedState.pomodoroState === 'work') {
        const remaining = savedState.pomodoroEndTime ? Math.max(0, Math.floor((savedState.pomodoroEndTime - Date.now()) / 1000)) : 0;
        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        return { status: 'pomodoro_work', label: `🍅 Pomodoro: ${mins}:${secs.toString().padStart(2, '0')}`, color: 'red' };
    }

    if (savedState.pomodoroState === 'break') {
        const remaining = savedState.pomodoroEndTime ? Math.max(0, Math.floor((savedState.pomodoroEndTime - Date.now()) / 1000)) : 0;
        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        return { status: 'pomodoro_break', label: `☕ Nghỉ: ${mins}:${secs.toString().padStart(2, '0')}`, color: 'orange' };
    }

    if (savedState.focusEndTime && Date.now() < savedState.focusEndTime) {
        const remaining = Math.max(0, Math.floor((savedState.focusEndTime - Date.now()) / 60000));
        return { status: 'focus', label: `🎯 Focus: còn ${remaining} phút`, color: 'blue' };
    }

    if (!isWorkDay(settings)) {
        const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
        const today = days[new Date().getDay()];
        return { status: 'weekend', label: `🎉 Ngày nghỉ (${today})`, color: 'purple' };
    }

    if (isLunchBreak(settings)) {
        return { status: 'lunch', label: '🍚 Nghỉ trưa', color: 'orange' };
    }

    if (isWorkTime(settings)) {
        return { status: 'working', label: '🟢 Đang làm việc', color: 'green' };
    }

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const workEnd = getTodayWorkEnd(settings);
    const workEndMinutes = workEnd.hour * 60 + workEnd.minute;

    if (currentMinutes >= workEndMinutes) {
        return { status: 'ended', label: '🌙 Ngoài giờ làm', color: 'purple' };
    } else {
        return { status: 'before', label: '⏳ Chưa bắt đầu', color: 'gray' };
    }
}

// Handle alarm triggers
chrome.alarms.onAlarm.addListener(async (alarm) => {
    const { settings } = await chrome.storage.local.get('settings');
    const { state: savedState } = await chrome.storage.local.get('state');
    if (savedState) {
        Object.assign(state, savedState);
    }

    if (!settings) return;

    // Daily reset
    if (alarm.name === ALARMS.DAILY_RESET) {
        state.nightModeReminded = false;
        state.sleepReminded = false;
        state.morningReminded = false;
        state.workStartedToday = false;
        state.pomodoroCount = 0;
        await chrome.storage.local.set({ state });
        scheduleFixedTimeAlarms(settings);
        return;
    }

    // Pomodoro/Focus check
    if (alarm.name === ALARMS.POMODORO_CHECK) {
        await checkPomodoroAndFocus(settings);
        return;
    }

    // Status check - update timers
    if (alarm.name === ALARMS.STATUS_CHECK) {
        await updateTimers();
        return;
    }

    // Skip if paused
    if (settings.isPaused) return;

    // Skip if focus mode or pomodoro active (except for fixed time reminders)
    const isFocusActive = state.focusEndTime && Date.now() < state.focusEndTime;
    const isPomodoroActive = state.pomodoroState !== null;

    // Fixed time reminders (always show, even in focus/pomodoro)
    if (alarm.name === ALARMS.LUNCH && isLunchBreak(settings)) {
        showNotification('lunch');
        return;
    }

    if (alarm.name === ALARMS.END_WORK) {
        showNotification('end_work');
        return;
    }

    if (alarm.name === ALARMS.NIGHT_MODE && !state.nightModeReminded) {
        state.nightModeReminded = true;
        await chrome.storage.local.set({ state });
        showNotification('night_mode');
        return;
    }

    if (alarm.name === ALARMS.SLEEP && !state.sleepReminded) {
        state.sleepReminded = true;
        await chrome.storage.local.set({ state });
        showNotification('sleep');
        return;
    }

    if (alarm.name === ALARMS.MORNING && !state.morningReminded && isMorningReminderWindow(settings)) {
        state.morningReminded = true;
        await chrome.storage.local.set({ state });
        showNotification('morning');
        return;
    }

    // Skip periodic reminders if focus/pomodoro active
    if (isFocusActive || isPomodoroActive) return;

    // Only show periodic reminders during work time
    if (!isWorkTime(settings)) return;

    if (!settings.notificationEnabled) return;

    // Periodic reminders
    const reminderMap = {
        [ALARMS.WALK]: 'walk',
        [ALARMS.WATER]: 'water',
        [ALARMS.TOILET]: 'toilet',
        [ALARMS.EYE]: 'eye_20_20_20',
        [ALARMS.BLINK]: 'blink',
        [ALARMS.POSTURE]: 'posture',
        [ALARMS.NECK]: 'neck_stretch',
        [ALARMS.EYE_EXERCISE]: 'eye_exercise',
        [ALARMS.BREATHING]: 'breathing'
    };

    const reminderType = reminderMap[alarm.name];
    if (reminderType) {
        showNotification(reminderType);
    }
});

// Check Pomodoro and Focus mode
async function checkPomodoroAndFocus(settings) {
    const { state: savedState } = await chrome.storage.local.get('state');
    if (savedState) {
        Object.assign(state, savedState);
    }

    const now = Date.now();

    // Check Focus mode end
    if (state.focusEndTime && now >= state.focusEndTime) {
        state.focusEndTime = null;
        await chrome.storage.local.set({ state });
        if (settings.notificationEnabled) {
            showNotification('focus_end');
        }
        return;
    }

    // Check Pomodoro end
    if (state.pomodoroState && state.pomodoroEndTime && now >= state.pomodoroEndTime) {
        if (state.pomodoroState === 'work') {
            // Work session ended
            state.pomodoroCount++;

            // Determine break time
            let breakTime;
            if (state.pomodoroCount % 4 === 0) {
                breakTime = settings.pomodoroLongBreak;
                showNotification('pomodoro_work_end');
            } else {
                breakTime = settings.pomodoroBreak;
                showNotification('pomodoro_work_end');
            }

            // Start break
            state.pomodoroState = 'break';
            state.pomodoroEndTime = now + breakTime * 60 * 1000;
            await chrome.storage.local.set({ state });
        } else if (state.pomodoroState === 'break') {
            // Break ended
            showNotification('pomodoro_break_end');
            // Stop pomodoro (user can restart manually)
            state.pomodoroState = null;
            state.pomodoroEndTime = null;
            await chrome.storage.local.set({ state });
        }
    }
}

// Update timers countdown
async function updateTimers() {
    const data = await chrome.storage.local.get(['timers', 'lastUpdate', 'settings']);
    if (!data.timers || !data.settings || data.settings.isPaused) return;

    const now = Date.now();
    const elapsed = Math.floor((now - data.lastUpdate) / 1000);

    // Only countdown during work hours and not in focus/pomodoro
    const { state: savedState } = await chrome.storage.local.get('state');
    if (savedState) {
        Object.assign(state, savedState);
    }

    const isFocusActive = state.focusEndTime && Date.now() < state.focusEndTime;
    const isPomodoroActive = state.pomodoroState !== null;

    if (!isWorkTime(data.settings) || isFocusActive || isPomodoroActive) return;

    const timers = data.timers;
    for (const key in timers) {
        timers[key] = Math.max(0, timers[key] - elapsed);

        // Reset if timer reached 0
        if (timers[key] === 0 && data.settings.intervals[key]) {
            timers[key] = data.settings.intervals[key] * 60;
        }
    }

    await chrome.storage.local.set({ timers, lastUpdate: now });
}

// Reset all timers
async function resetAllTimers() {
    const { settings } = await chrome.storage.local.get('settings');
    if (!settings) return { success: false };

    const timers = {
        walk: settings.intervals.walk * 60,
        water: settings.intervals.water * 60,
        toilet: settings.intervals.toilet * 60,
        eye_20_20_20: settings.intervals.eye_20_20_20 * 60,
        blink: settings.intervals.blink * 60,
        posture: settings.intervals.posture * 60,
        neck_stretch: settings.intervals.neck_stretch * 60,
        eye_exercise: settings.intervals.eye_exercise * 60,
        breathing: settings.intervals.breathing * 60
    };

    await chrome.storage.local.set({ timers, lastUpdate: Date.now() });
    return { success: true, timers };
}

// Show Chrome notification
function showNotification(type) {
    const reminder = REMINDERS[type];
    if (!reminder) return;

    chrome.notifications.create(type + '_' + Date.now(), {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: reminder.title,
        message: reminder.message,
        priority: 2,
        requireInteraction: true
    });
}

// Handle notification click
chrome.notifications.onClicked.addListener((notificationId) => {
    chrome.notifications.clear(notificationId);
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message).then(sendResponse);
    return true;
});

async function handleMessage(message) {
    const { settings } = await chrome.storage.local.get('settings');
    const { state: savedState } = await chrome.storage.local.get('state');
    if (savedState) {
        Object.assign(state, savedState);
    }

    switch (message.action) {
        case 'getStatus':
            return await handleGetStatus();

        case 'resetTimer':
            return await handleResetTimer(message.timerType);

        case 'togglePause':
            return await handleTogglePause();

        case 'resetAll':
            return await handleResetAll();

        case 'testNotification':
            showNotification('walk');
            return { success: true };

        case 'clearAllNotifications':
            await chrome.notifications.getAll(async (notifications) => {
                for (const id of Object.keys(notifications)) {
                    await chrome.notifications.clear(id);
                }
            });
            return { success: true };

        case 'startFocus':
            state.focusEndTime = Date.now() + message.minutes * 60 * 1000;
            await chrome.storage.local.set({ state });
            return { success: true, focusEndTime: state.focusEndTime };

        case 'stopFocus':
            state.focusEndTime = null;
            await chrome.storage.local.set({ state });
            return { success: true };

        case 'startPomodoro':
            state.pomodoroState = 'work';
            state.pomodoroEndTime = Date.now() + settings.pomodoroWork * 60 * 1000;
            await chrome.storage.local.set({ state });
            return { success: true, pomodoroState: state.pomodoroState, pomodoroEndTime: state.pomodoroEndTime };

        case 'stopPomodoro':
            state.pomodoroState = null;
            state.pomodoroEndTime = null;
            await chrome.storage.local.set({ state });
            return { success: true };

        case 'updateSettings':
            const newSettings = { ...settings, ...message.settings };
            await chrome.storage.local.set({ settings: newSettings });
            setupAlarms();
            return { success: true, settings: newSettings };

        case 'getSettings':
            return { success: true, settings };

        case 'resetToDefaults':
            await chrome.storage.local.set({ settings: { ...DEFAULT_SETTINGS, isConfigured: true } });
            setupAlarms();
            return { success: true };

        default:
            return { success: false, error: 'Unknown action' };
    }
}

// Get current status
async function handleGetStatus() {
    const data = await chrome.storage.local.get(['settings', 'timers', 'lastUpdate', 'state']);
    const settings = data.settings || DEFAULT_SETTINGS;

    if (data.state) {
        Object.assign(state, data.state);
    }

    await updateTimers();
    const { timers } = await chrome.storage.local.get('timers');

    return {
        workStatus: getWorkStatus(settings),
        timers: timers || {},
        settings: settings,
        state: {
            focusEndTime: state.focusEndTime,
            pomodoroState: state.pomodoroState,
            pomodoroEndTime: state.pomodoroEndTime,
            pomodoroCount: state.pomodoroCount
        }
    };
}

// Reset a specific timer
async function handleResetTimer(timerType) {
    const { settings, timers } = await chrome.storage.local.get(['settings', 'timers']);
    if (!settings || !timers) return { success: false };

    if (settings.intervals[timerType]) {
        timers[timerType] = settings.intervals[timerType] * 60;
    }
    await chrome.storage.local.set({ timers, lastUpdate: Date.now() });

    return { success: true, timers };
}

// Toggle pause
async function handleTogglePause() {
    const { settings } = await chrome.storage.local.get('settings');
    settings.isPaused = !settings.isPaused;
    await chrome.storage.local.set({ settings });

    if (!settings.isPaused) {
        await resetAllTimers();
    }

    return { success: true, isPaused: settings.isPaused };
}

// Reset all
async function handleResetAll() {
    return await resetAllTimers();
}

// Initialize on startup
chrome.runtime.onStartup.addListener(() => {
    setupAlarms();
});
