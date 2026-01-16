// ========================================
// Work Health Reminder - Background Service Worker
// ========================================

// Default settings
const DEFAULT_SETTINGS = {
    workStart: { hour: 8, minute: 0 },
    lunchStart: { hour: 11, minute: 30 },
    lunchEnd: { hour: 13, minute: 0 },
    workEnd: { hour: 17, minute: 30 },
    intervals: {
        walk: 30,      // minutes
        water: 45,
        toilet: 60,
        eye_20_20_20: 20,
        posture: 45,
        neck_stretch: 60
    },
    soundEnabled: true,
    notificationEnabled: true,
    isPaused: false
};

// Alarm names
const ALARMS = {
    WALK: 'walk_reminder',
    WATER: 'water_reminder',
    TOILET: 'toilet_reminder',
    EYE: 'eye_reminder',
    POSTURE: 'posture_reminder',
    NECK: 'neck_reminder',
    LUNCH: 'lunch_reminder',
    END_WORK: 'end_work_reminder',
    STATUS_CHECK: 'status_check'
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
    posture: {
        title: "🪑 Kiểm tra tư thế!",
        message: "Ngồi thẳng lưng, thả lỏng vai, chân chạm đất nhé!"
    },
    neck_stretch: {
        title: "🧘 Giãn cổ vai!",
        message: "Dành 2 phút để giãn cơ cổ và vai nhé!"
    },
    lunch: {
        title: "🍱 Đến giờ ăn trưa!",
        message: "Đi lấy phiếu ăn cơm trưa và nghỉ ngơi nhé!"
    },
    end_work: {
        title: "🏠 Hết giờ làm việc!",
        message: "Đã 17:30! Chuẩn bị về nhà hoặc đón người yêu thôi! 💕"
    }
};

// Initialize on install
chrome.runtime.onInstalled.addListener(async () => {
    console.log('Work Health Reminder installed!');

    // Set default settings
    const existing = await chrome.storage.local.get('settings');
    if (!existing.settings) {
        await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
    }

    // Initialize timers state
    await chrome.storage.local.set({
        timers: {
            walk: DEFAULT_SETTINGS.intervals.walk * 60,
            water: DEFAULT_SETTINGS.intervals.water * 60,
            toilet: DEFAULT_SETTINGS.intervals.toilet * 60,
            eye_20_20_20: DEFAULT_SETTINGS.intervals.eye_20_20_20 * 60,
            posture: DEFAULT_SETTINGS.intervals.posture * 60,
            neck_stretch: DEFAULT_SETTINGS.intervals.neck_stretch * 60
        },
        lastUpdate: Date.now()
    });

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

    // Periodic reminders (in minutes)
    chrome.alarms.create(ALARMS.WALK, { periodInMinutes: settings.intervals.walk });
    chrome.alarms.create(ALARMS.WATER, { periodInMinutes: settings.intervals.water });
    chrome.alarms.create(ALARMS.TOILET, { periodInMinutes: settings.intervals.toilet });
    chrome.alarms.create(ALARMS.EYE, { periodInMinutes: settings.intervals.eye_20_20_20 });
    chrome.alarms.create(ALARMS.POSTURE, { periodInMinutes: settings.intervals.posture });
    chrome.alarms.create(ALARMS.NECK, { periodInMinutes: settings.intervals.neck_stretch });

    // Fixed time reminders
    scheduleFixedTimeAlarms(settings);

    console.log('Alarms setup complete');
}

// Schedule lunch and end work alarms
function scheduleFixedTimeAlarms(settings) {
    const now = new Date();
    const today = now.toDateString();

    // Lunch alarm at 11:30
    const lunchTime = new Date(today);
    lunchTime.setHours(settings.lunchStart.hour, settings.lunchStart.minute, 0);
    if (lunchTime > now) {
        chrome.alarms.create(ALARMS.LUNCH, { when: lunchTime.getTime() });
    }

    // End work alarm at 17:30
    const endTime = new Date(today);
    endTime.setHours(settings.workEnd.hour, settings.workEnd.minute, 0);
    if (endTime > now) {
        chrome.alarms.create(ALARMS.END_WORK, { when: endTime.getTime() });
    }
}

// Check if currently in work time
function isWorkTime(settings) {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const workStart = settings.workStart.hour * 60 + settings.workStart.minute;
    const lunchStart = settings.lunchStart.hour * 60 + settings.lunchStart.minute;
    const lunchEnd = settings.lunchEnd.hour * 60 + settings.lunchEnd.minute;
    const workEnd = settings.workEnd.hour * 60 + settings.workEnd.minute;

    // Morning work: 8:00 - 11:30
    const morningWork = currentMinutes >= workStart && currentMinutes < lunchStart;
    // Afternoon work: 13:00 - 17:30
    const afternoonWork = currentMinutes >= lunchEnd && currentMinutes < workEnd;

    return morningWork || afternoonWork;
}

// Check if currently lunch break
function isLunchBreak(settings) {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const lunchStart = settings.lunchStart.hour * 60 + settings.lunchStart.minute;
    const lunchEnd = settings.lunchEnd.hour * 60 + settings.lunchEnd.minute;

    return currentMinutes >= lunchStart && currentMinutes < lunchEnd;
}

// Get current work status
function getWorkStatus(settings) {
    if (isLunchBreak(settings)) {
        return { status: 'lunch', label: '🍚 Nghỉ trưa', color: 'orange' };
    } else if (isWorkTime(settings)) {
        return { status: 'working', label: '🟢 Đang làm việc', color: 'green' };
    } else {
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const workEnd = settings.workEnd.hour * 60 + settings.workEnd.minute;

        if (currentMinutes >= workEnd) {
            return { status: 'ended', label: '🌙 Hết giờ làm', color: 'purple' };
        } else {
            return { status: 'before', label: '⏳ Chưa bắt đầu', color: 'gray' };
        }
    }
}

// Handle alarm triggers
chrome.alarms.onAlarm.addListener(async (alarm) => {
    const { settings } = await chrome.storage.local.get('settings');
    if (!settings || settings.isPaused) return;

    // Only send reminders during work time
    if (!isWorkTime(settings) && alarm.name !== ALARMS.LUNCH && alarm.name !== ALARMS.END_WORK) {
        return;
    }

    let reminderType = null;

    switch (alarm.name) {
        case ALARMS.WALK:
            reminderType = 'walk';
            break;
        case ALARMS.WATER:
            reminderType = 'water';
            break;
        case ALARMS.TOILET:
            reminderType = 'toilet';
            break;
        case ALARMS.EYE:
            reminderType = 'eye_20_20_20';
            break;
        case ALARMS.POSTURE:
            reminderType = 'posture';
            break;
        case ALARMS.NECK:
            reminderType = 'neck_stretch';
            break;
        case ALARMS.LUNCH:
            if (isLunchBreak(settings)) {
                reminderType = 'lunch';
            }
            break;
        case ALARMS.END_WORK:
            reminderType = 'end_work';
            break;
        case ALARMS.STATUS_CHECK:
            // Update timers
            await updateTimers();
            return;
    }

    if (reminderType && settings.notificationEnabled) {
        showNotification(reminderType);
    }
});

// Update timers countdown
async function updateTimers() {
    const data = await chrome.storage.local.get(['timers', 'lastUpdate', 'settings']);
    if (!data.timers || !data.settings || data.settings.isPaused) return;

    const now = Date.now();
    const elapsed = Math.floor((now - data.lastUpdate) / 1000);

    // Only countdown during work hours
    if (!isWorkTime(data.settings)) return;

    const timers = data.timers;
    for (const key in timers) {
        timers[key] = Math.max(0, timers[key] - elapsed);

        // Reset if timer reached 0
        if (timers[key] === 0) {
            timers[key] = data.settings.intervals[key] * 60;
        }
    }

    await chrome.storage.local.set({ timers, lastUpdate: now });
}

// Show Chrome notification
function showNotification(type) {
    const reminder = REMINDERS[type];
    if (!reminder) return;

    chrome.notifications.create({
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
    if (message.action === 'getStatus') {
        handleGetStatus().then(sendResponse);
        return true;
    }

    if (message.action === 'resetTimer') {
        handleResetTimer(message.timerType).then(sendResponse);
        return true;
    }

    if (message.action === 'togglePause') {
        handleTogglePause().then(sendResponse);
        return true;
    }

    if (message.action === 'resetAll') {
        handleResetAll().then(sendResponse);
        return true;
    }

    if (message.action === 'testNotification') {
        showNotification('walk');
        sendResponse({ success: true });
        return true;
    }
});

// Get current status
async function handleGetStatus() {
    const data = await chrome.storage.local.get(['settings', 'timers', 'lastUpdate']);
    const settings = data.settings || DEFAULT_SETTINGS;

    // Update timers first
    await updateTimers();
    const { timers } = await chrome.storage.local.get('timers');

    return {
        workStatus: getWorkStatus(settings),
        timers: timers || {},
        settings: settings
    };
}

// Reset a specific timer
async function handleResetTimer(timerType) {
    const { settings, timers } = await chrome.storage.local.get(['settings', 'timers']);
    if (!settings || !timers) return { success: false };

    timers[timerType] = settings.intervals[timerType] * 60;
    await chrome.storage.local.set({ timers, lastUpdate: Date.now() });

    return { success: true, timers };
}

// Toggle pause
async function handleTogglePause() {
    const { settings } = await chrome.storage.local.get('settings');
    settings.isPaused = !settings.isPaused;
    await chrome.storage.local.set({ settings });

    if (!settings.isPaused) {
        // Reset timers when resuming
        await handleResetAll();
    }

    return { success: true, isPaused: settings.isPaused };
}

// Reset all timers
async function handleResetAll() {
    const { settings } = await chrome.storage.local.get('settings');
    if (!settings) return { success: false };

    const timers = {
        walk: settings.intervals.walk * 60,
        water: settings.intervals.water * 60,
        toilet: settings.intervals.toilet * 60,
        eye_20_20_20: settings.intervals.eye_20_20_20 * 60,
        posture: settings.intervals.posture * 60,
        neck_stretch: settings.intervals.neck_stretch * 60
    };

    await chrome.storage.local.set({ timers, lastUpdate: Date.now() });
    return { success: true, timers };
}

// Initialize on startup
chrome.runtime.onStartup.addListener(() => {
    setupAlarms();
});
