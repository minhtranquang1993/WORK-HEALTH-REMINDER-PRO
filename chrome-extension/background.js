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
    customHolidays: [], // User-added holidays: [{ name, start, end }]
    workPeriodEnabled: false,
    workPeriodStart: "",  // "YYYY-MM-DD" format
    workPeriodEnd: "",    // "YYYY-MM-DD" format

    // Telegram
    telegramBotToken: "8583787983:AAHlW0mGpe8erumz0peN1gtXU2X7BtK2Zes",
    telegramChatId: "1661694132",
    telegramReportTime: { hour: 17, minute: 0 },

    // Pomodoro settings
    pomodoroWork: 25,
    pomodoroBreak: 5,
    pomodoroLongBreak: 15,

    // Intervals (minutes) - Based on scientific recommendations
    intervals: {
        walk: 30,           // Columbia University: 5-min walk every 30 min
        water: 30,          // Hydration experts: drink regularly every 20-30 min
        toilet: 60,
        eye_20_20_20: 20,   // AAO 20-20-20 rule: every 20 min
        blink: 2,           // Research: blink reminder every 1-2 min during screen use
        posture: 20,        // Cornell 20-8-2 rule: check posture every 20 min
        neck_stretch: 30,   // Ergonomics: stretch every 20-30 min
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

// YouTube state management
let youtubeState = {
    selectedTabId: null,  // Currently selected tab for controls
    tabs: {},             // Map of tabId -> videoInfo
    lastUpdate: null
};

// Menubar app HTTP port
const MENUBAR_HTTP_PORT = 9876;

// Vietnamese holidays 2026 (fixed)
const HOLIDAYS_2026 = [
    { name: "Tết Dương lịch", start: "2026-01-01", end: "2026-01-01" },
    { name: "Tết Nguyên đán", start: "2026-02-15", end: "2026-02-22" },
    { name: "Giỗ Tổ Hùng Vương", start: "2026-04-26", end: "2026-04-26" },
    { name: "Ngày Giải phóng miền Nam", start: "2026-04-30", end: "2026-04-30" },
    { name: "Quốc tế Lao động", start: "2026-05-01", end: "2026-05-01" },
    { name: "Quốc khánh", start: "2026-09-02", end: "2026-09-02" }
];

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
    DAILY_RESET: 'daily_reset',
    TODO_REMINDER: 'todo_reminder',
    TODO_START_REMINDER: 'todo_start_reminder',
    DAILY_REPORT: 'daily_report'
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
    },
    todo_incomplete: {
        title: "📝 Đừng quên task hôm nay!",
        message: "Bạn vẫn còn việc chưa hoàn thành. Cố lên nhé! 💪"
    },
    todo_start: {
        title: "📝 Lên kế hoạch ngày mới!",
        message: "Hãy thêm các đầu việc cần làm hôm nay vào Todo list nhé! ✨"
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

    // Initialize todo storage if not exists
    const todoData = await chrome.storage.local.get(['todoTasks', 'todoHistory', 'todoSettings']);
    if (!todoData.todoTasks) {
        await chrome.storage.local.set({
            todoTasks: { date: new Date().toDateString(), tasks: [] }
        });
    }
    if (!todoData.todoHistory) {
        await chrome.storage.local.set({ todoHistory: {} });
    }
    if (!todoData.todoSettings) {
        await chrome.storage.local.set({
            todoSettings: {
                streak: 0,
                bestStreak: 0,
                lastCompletedDate: null,
                autoReset: true,
                reminderEnabled: true
            }
        });
    }

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
async function scheduleFixedTimeAlarms(settings) {
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

    // Todo Start Reminder (Work Start)
    const workStartTime = new Date(today);
    workStartTime.setHours(settings.workStart.hour, settings.workStart.minute, 0);
    if (workStartTime > now && isWorkDay(settings)) {
        chrome.alarms.create(ALARMS.TODO_START_REMINDER, { when: workStartTime.getTime() });
    }

    // Todo End Reminder (60 mins before work ends)
    const todoTime = new Date(today);
    const workEndTodo = getTodayWorkEnd(settings);
    todoTime.setHours(workEndTodo.hour, workEndTodo.minute, 0);
    todoTime.setMinutes(todoTime.getMinutes() - 60); // 60 mins before (around 16:30 for 17:30 end)

    if (todoTime > now && isWorkDay(settings)) {
        chrome.alarms.create(ALARMS.TODO_REMINDER, { when: todoTime.getTime() });
    }

    // Daily Telegram Report
    if (settings.telegramBotToken && settings.telegramChatId) {
        const reportTime = new Date(today);
        reportTime.setHours(settings.telegramReportTime.hour, settings.telegramReportTime.minute, 0);

        // If time passed, schedule for tomorrow? No, just skip for today to avoid spam if reloading.
        // But if user just set it, maybe they want it? 
        // Let's stick to: if future, schedule.
        if (reportTime > now) {
            chrome.alarms.create(ALARMS.DAILY_REPORT, { when: reportTime.getTime() });
        }
    }
}

// Check if today is within work period date range
function isWithinWorkPeriod(settings) {
    if (!settings.workPeriodEnabled) return true; // Not enabled = always valid

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (settings.workPeriodStart) {
        const startDate = new Date(settings.workPeriodStart + 'T00:00:00');
        if (today < startDate) return false;
    }

    if (settings.workPeriodEnd) {
        const endDate = new Date(settings.workPeriodEnd + 'T00:00:00');
        if (today > endDate) return false;
    }

    return true;
}

// Check if a date is a holiday (returns { isHoliday: bool, name: string })
function checkHoliday(settings, date) {
    const d = date || new Date();
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    // Check fixed holidays
    for (const h of HOLIDAYS_2026) {
        if (dateStr >= h.start && dateStr <= h.end) {
            return { isHoliday: true, name: h.name };
        }
    }

    // Check custom holidays
    const customHolidays = settings.customHolidays || [];
    for (const h of customHolidays) {
        if (dateStr >= h.start && dateStr <= h.end) {
            return { isHoliday: true, name: h.name };
        }
    }

    return { isHoliday: false, name: null };
}

// Check if today is a work day
function isWorkDay(settings) {
    // Check holidays first
    const holiday = checkHoliday(settings);
    if (holiday.isHoliday) return false;

    // Check work period date range
    if (!isWithinWorkPeriod(settings)) return false;

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

// Check if a task should be active today (for weekly/monthly tasks)
// Weekly tasks only active on Monday (T2), monthly only on 1st (Mùng 1)
function isTaskActiveToday(task) {
    if (!task.frequency || task.frequency === 'once' || task.frequency === 'daily') {
        return true;
    }

    const today = new Date();

    if (task.frequency === 'weekly') {
        // Only active on Monday (getDay() === 1 = Monday)
        return today.getDay() === 1;
    }

    if (task.frequency === 'monthly') {
        // Only active on 1st of month
        return today.getDate() === 1;
    }

    return true;
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
        const holiday = checkHoliday(settings);
        if (holiday.isHoliday) {
            return { status: 'holiday', label: `🎌 ${holiday.name}`, color: 'red' };
        }
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
        await performTodoDailyReset(); // Reset todo daily
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

    if (alarm.name === ALARMS.TODO_START_REMINDER) {
        await ensureTodoToday();
        const { todoTasks } = await chrome.storage.local.get('todoTasks');
        // Only show if no tasks added yet
        if (!todoTasks || todoTasks.tasks.length === 0) {
            showNotification('todo_start');
        }
        return;
    }

    if (alarm.name === ALARMS.TODO_REMINDER) {
        const { todoTasks } = await chrome.storage.local.get('todoTasks');
        if (todoTasks && todoTasks.tasks.some(t => !t.completed && isTaskActiveToday(t))) {
            showNotification('todo_incomplete');
        }
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

// Handle Daily Report Alarm
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === ALARMS.DAILY_REPORT) {
        await sendTelegramReport();
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
        priority: 2
        // Removed requireInteraction so notifications auto-dismiss after a few seconds
    });
}

// Handle notification click
chrome.notifications.onClicked.addListener((notificationId) => {
    chrome.notifications.clear(notificationId);
});

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Handle YouTube state updates from content script
    if (message.action === 'youtubeStateUpdate') {
        const tabId = sender.tab?.id;
        if (tabId) {
            youtubeState.tabs[tabId] = message.videoInfo;
            youtubeState.lastUpdate = Date.now();
        }

        // Notify menubar app (fire and forget)
        notifyMenubarApp(message.videoInfo);

        sendResponse({ success: true });
        return true;
    }

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

        case 'testTelegram':
            return await sendTelegramReport(true);

        case 'startFocus':
            state.focusEndTime = Date.now() + message.minutes * 60 * 1000;
            await chrome.storage.local.set({ state });
            // Pause all YouTube videos when entering focus mode
            await pauseAllYoutubeTabs();
            return { success: true, focusEndTime: state.focusEndTime };

        case 'stopFocus':
            state.focusEndTime = null;
            await chrome.storage.local.set({ state });
            return { success: true };

        case 'getFocusStatus':
            const isFocusActive = state.focusEndTime && Date.now() < state.focusEndTime;
            return { success: true, isFocusActive: !!isFocusActive, focusEndTime: state.focusEndTime };

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

        // YouTube handlers
        case 'getYoutubeState':
            return await handleGetYoutubeState();

        case 'youtubeControl':
            return await handleYoutubeControl(message);

        case 'getAllYoutubeTabs':
            return await handleGetAllYoutubeTabs();

        case 'selectYoutubeTab':
            return await handleSelectYoutubeTab(message.tabId);

        case 'closeYoutubeTab':
            return await handleCloseYoutubeTab(message.tabId);

        // Todo handlers
        case 'getTodoData':
            await ensureTodoToday();
            const todoData = await chrome.storage.local.get(['todoTasks', 'todoHistory', 'todoSettings']);
            // Tag each task with isActiveToday so popup can filter/display correctly
            if (todoData.todoTasks && todoData.todoTasks.tasks) {
                todoData.todoTasks.tasks = todoData.todoTasks.tasks.map(task => ({
                    ...task,
                    isActiveToday: isTaskActiveToday(task)
                }));
            }
            return { success: true, ...todoData };

        case 'addTodo':
            return await handleTodoAddTask(message.task);

        case 'toggleTodo':
            return await handleTodoToggleTask(message.taskId);

        case 'deleteTodo':
            return await handleTodoDeleteTask(message.taskId);

        case 'getTodoHistory':
            const { todoHistory } = await chrome.storage.local.get('todoHistory');
            return { success: true, history: todoHistory };

        // Holiday handlers
        case 'getHolidays':
            return {
                success: true,
                fixedHolidays: HOLIDAYS_2026,
                customHolidays: settings.customHolidays || []
            };

        case 'addCustomHoliday': {
            const customs = settings.customHolidays || [];
            const newHoliday = { name: message.name, start: message.start, end: message.end };
            customs.push(newHoliday);
            // Sort by start date
            customs.sort((a, b) => a.start.localeCompare(b.start));
            const updatedSettings1 = { ...settings, customHolidays: customs };
            await chrome.storage.local.set({ settings: updatedSettings1 });
            return { success: true, customHolidays: customs };
        }

        case 'removeCustomHoliday': {
            const existingCustoms = settings.customHolidays || [];
            const filtered = existingCustoms.filter((_, i) => i !== message.index);
            const updatedSettings2 = { ...settings, customHolidays: filtered };
            await chrome.storage.local.set({ settings: updatedSettings2 });
            return { success: true, customHolidays: filtered };
        }

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

// ========================================
// Todo Management
// ========================================

// Verify and ensure todo list is for today
async function ensureTodoToday() {
    const { todoTasks } = await chrome.storage.local.get('todoTasks');
    const today = new Date().toDateString();

    if (!todoTasks || todoTasks.date !== today) {
        await performTodoDailyReset();
    }
}

// Perform daily reset for Todo
async function performTodoDailyReset() {
    const { todoTasks, todoHistory, todoSettings } = await chrome.storage.local.get(['todoTasks', 'todoHistory', 'todoSettings']);
    const today = new Date();
    const todayDateStr = today.toDateString();

    // If logic already ran for today, skip
    if (todoTasks && todoTasks.date === todayDateStr) return;

    // Save history
    if (todoTasks && todoTasks.tasks.length > 0) {
        const total = todoTasks.tasks.length;
        const completed = todoTasks.tasks.filter(t => t.completed).length;
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

        todoHistory[todoTasks.date] = { total, completed, percentage };
    }

    // Filter tasks to keep
    let keptTasks = [];
    if (todoTasks && todoTasks.tasks) {
        keptTasks = todoTasks.tasks.filter(task => {
            // Logic:
            // 1. If not completed, ALWAYS keep (carry over)
            if (!task.completed) return true;

            // 2. If completed, check frequency
            // 'once' -> Delete (don't keep)
            if (!task.frequency || task.frequency === 'once') return false;

            // 'daily', 'weekly', 'monthly' -> Keep
            return true;
        });

        // Reset status for recurring tasks if needed
        keptTasks = keptTasks.map(task => {
            if (!task.completed) return task; // Keep incomplete as is

            // For completed recurring tasks, check if we should reset 'completed' to false
            let shouldReset = false;

            if (task.frequency === 'daily') {
                shouldReset = true;
            } else if (task.frequency === 'weekly') {
                // Reset on Monday (Day 1)
                const day = today.getDay(); // 0-6
                if (day === 1) shouldReset = true;
            } else if (task.frequency === 'monthly') {
                // Reset on 1st of month
                if (today.getDate() === 1) shouldReset = true;
            }

            if (shouldReset) {
                return { ...task, completed: false, completedAt: null };
            }
            return task; // Keep completed if not reset day
        });
    }

    // Update tasks
    const newTasks = {
        date: todayDateStr,
        tasks: keptTasks
    };

    // Keep history limited to 30 days
    const dates = Object.keys(todoHistory).sort();
    if (dates.length > 30) {
        delete todoHistory[dates[0]];
    }

    await chrome.storage.local.set({
        todoTasks: newTasks,
        todoHistory
    });
}

async function handleTodoAddTask(task) {
    await ensureTodoToday();
    const { todoTasks } = await chrome.storage.local.get('todoTasks');

    const newTask = {
        id: 't_' + Date.now(),
        text: task.text,
        priority: task.priority || 'medium', // high, medium, low
        frequency: task.frequency || 'once', // once, daily, weekly, monthly
        completed: false,
        createdAt: Date.now(),
        completedAt: null
    };

    todoTasks.tasks.unshift(newTask); // Add to top
    await chrome.storage.local.set({ todoTasks });

    return { success: true, task: newTask };
}

async function handleTodoToggleTask(taskId) {
    await ensureTodoToday();
    const { todoTasks, todoSettings } = await chrome.storage.local.get(['todoTasks', 'todoSettings']);

    const taskIndex = todoTasks.tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return { success: false, error: "Task not found" };

    const task = todoTasks.tasks[taskIndex];
    task.completed = !task.completed;
    task.completedAt = task.completed ? Date.now() : null;

    // Sort tasks: Incomplete first, then by priority, then by time
    // But typically user wants list order stable or auto-sorted. 
    // Let's keep array order but UI can sort. 
    // Or we sort here? Let's just update data.

    await chrome.storage.local.set({ todoTasks });

    // Toggle Streak Update
    await updateStreakStats(todoTasks, todoSettings);

    return { success: true, task, todoSettings };
}

async function handleTodoDeleteTask(taskId) {
    await ensureTodoToday();
    const { todoTasks, todoSettings } = await chrome.storage.local.get(['todoTasks', 'todoSettings']);

    todoTasks.tasks = todoTasks.tasks.filter(t => t.id !== taskId);
    await chrome.storage.local.set({ todoTasks });

    // Update streak in case deleting a task makes list 100%
    await updateStreakStats(todoTasks, todoSettings);

    return { success: true };
}

async function updateStreakStats(todoTasks, todoSettings) {
    const total = todoTasks.tasks.length;
    if (total === 0) return;

    const completed = todoTasks.tasks.filter(t => t.completed).length;

    // If all completed
    if (completed === total && total > 0) {
        const today = new Date().toDateString();
        // If not already recorded as completed today
        if (todoSettings.lastCompletedDate !== today) {
            // Check if last completed was yesterday to increment streak
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toDateString();

            if (todoSettings.lastCompletedDate === yesterdayStr) {
                todoSettings.streak += 1;
            } else {
                todoSettings.streak = 1; // Start over (or 1 if just started today)
            }

            // Update best
            if (todoSettings.streak > todoSettings.bestStreak) {
                todoSettings.bestStreak = todoSettings.streak;
            }

            todoSettings.lastCompletedDate = today;
            await chrome.storage.local.set({ todoSettings });
        }
    } else {
        // If uncompleted a task and it was previously marked done today?
        // It's complicated to "undo" streak. 
        // For now, let's just stick to: Streak increases when you hit 100% for the first time that day.
        // If you uncheck, we don't necessarily decrement immediately unless we track strict state.
        // Simplicity: Streak calculation only strictly matters on Daily Reset or "Check" time.
        // But user wants to see "Streak: 3".
    }
}

// Reset all
async function handleResetAll() {
    return await resetAllTimers();
}

// ========================================
// YouTube Control Functions
// ========================================

// Pause all YouTube tabs (used when entering Focus mode)
async function pauseAllYoutubeTabs() {
    try {
        const tabs = await chrome.tabs.query({ url: ['*://www.youtube.com/*', '*://youtube.com/*'] });


        for (const tab of tabs) {
            try {
                // Ensure content script is injected
                await ensureContentScriptInjected(tab.id);

                // Get current state to check if playing
                const stateResponse = await chrome.tabs.sendMessage(tab.id, { action: 'youtube_getState' });

                // Only pause if currently playing
                if (stateResponse?.videoInfo?.isPlaying) {
                    await chrome.tabs.sendMessage(tab.id, { action: 'youtube_playPause' });
                    console.log(`[Focus Mode] Paused YouTube tab: ${tab.id}`);
                }
            } catch (e) {
                // Tab may not have video or content script not ready, ignore
                console.log(`[Focus Mode] Could not pause tab ${tab.id}:`, e.message);
            }
        }
    } catch (e) {
        console.log('[Focus Mode] Error pausing YouTube tabs:', e.message);
    }
}

// Ensure content script is injected in a YouTube tab
async function ensureContentScriptInjected(tabId) {
    try {
        // Try to ping the content script
        const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
        return { success: true, ready: response?.ready, injected: false };
    } catch (e) {
        // Content script not present, inject it
        try {
            await chrome.scripting.executeScript({
                target: { tabId },
                files: ['youtube-content.js']
            });
            // Wait a bit for the script to initialize
            await new Promise(resolve => setTimeout(resolve, 500));
            return { success: true, ready: false, injected: true };
        } catch (injectionError) {
            return { success: false, error: injectionError.message };
        }
    }
}

// Get YouTube state for selected tab
async function handleGetYoutubeState() {
    try {
        if (!youtubeState.selectedTabId) {
            return { success: true, hasYoutube: false, videoInfo: null };
        }

        // Check if selected tab still exists
        try {
            await chrome.tabs.get(youtubeState.selectedTabId);
        } catch (e) {
            youtubeState.selectedTabId = null;
            return { success: true, hasYoutube: false, videoInfo: null };
        }

        // Ensure content script is injected
        const injectionResult = await ensureContentScriptInjected(youtubeState.selectedTabId);
        if (!injectionResult.success) {
            return {
                success: true,
                hasYoutube: true,
                tabId: youtubeState.selectedTabId,
                videoInfo: youtubeState.tabs[youtubeState.selectedTabId],
                error: injectionResult.error
            };
        }

        try {
            // Try to get fresh state from content script
            const response = await chrome.tabs.sendMessage(youtubeState.selectedTabId, { action: 'youtube_getState' });
            if (response && response.success) {
                youtubeState.tabs[youtubeState.selectedTabId] = response.videoInfo;
                youtubeState.lastUpdate = Date.now();
            }
            return {
                success: true,
                hasYoutube: true,
                tabId: youtubeState.selectedTabId,
                videoInfo: response?.videoInfo || youtubeState.tabs[youtubeState.selectedTabId]
            };
        } catch (e) {
            // Content script may not be ready, return cached state
            return {
                success: true,
                hasYoutube: true,
                tabId: youtubeState.selectedTabId,
                videoInfo: youtubeState.tabs[youtubeState.selectedTabId],
                cached: true
            };
        }
    } catch (e) {
        return { success: false, error: e.message };
    }
}

// Send YouTube control command
async function handleYoutubeControl(message) {
    const { command, params, tabId } = message;
    const targetTabId = tabId || youtubeState.selectedTabId;

    // Check if Focus mode is active - block all YouTube controls
    const isFocusActive = state.focusEndTime && Date.now() < state.focusEndTime;
    if (isFocusActive) {
        return { success: false, error: 'Focus mode đang bật. Tắt Focus mode để điều khiển YouTube.', focusBlocked: true };
    }

    if (!targetTabId) {
        return { success: false, error: 'No YouTube tab selected' };
    }

    try {
        // Verify tab exists
        try {
            await chrome.tabs.get(targetTabId);
        } catch (e) {
            return { success: false, error: 'Tab no longer exists' };
        }

        // Ensure content script is injected
        const injectionResult = await ensureContentScriptInjected(targetTabId);
        if (!injectionResult.success) {
            return { success: false, error: injectionResult.error };
        }

        try {
            const response = await chrome.tabs.sendMessage(targetTabId, {
                action: `youtube_${command}`,
                ...params
            });
            return response;
        } catch (e) {
            return { success: false, error: e.message };
        }
    } catch (e) {
        return { success: false, error: e.message };
    }
}

// Get all YouTube tabs
async function handleGetAllYoutubeTabs() {
    try {
        const tabs = await chrome.tabs.query({ url: ['*://www.youtube.com/*', '*://youtube.com/*'] });

        if (tabs.length === 0) {
            youtubeState.selectedTabId = null;
            return { success: true, tabs: [], selectedTabId: null };
        }

        const tabsInfo = [];

        for (const tab of tabs) {
            // Ensure content script is injected
            await ensureContentScriptInjected(tab.id);

            try {
                const response = await chrome.tabs.sendMessage(tab.id, { action: 'youtube_getState' });

                tabsInfo.push({
                    tabId: tab.id,
                    title: response?.videoInfo?.title || tab.title || 'YouTube',
                    isPlaying: response?.videoInfo?.isPlaying || false,
                    isActive: tab.active
                });

                // Cache the full videoInfo
                if (response?.videoInfo) {
                    youtubeState.tabs[tab.id] = response.videoInfo;
                }
            } catch (e) {
                // Content script not ready, use tab title
                tabsInfo.push({
                    tabId: tab.id,
                    title: tab.title || 'YouTube',
                    isPlaying: false,
                    isActive: tab.active
                });
            }
        }

        // Auto-select first tab if none selected or selected tab closed
        if (!youtubeState.selectedTabId || !tabs.find(t => t.id === youtubeState.selectedTabId)) {
            youtubeState.selectedTabId = tabs[0].id;
        }

        return {
            success: true,
            tabs: tabsInfo,
            selectedTabId: youtubeState.selectedTabId
        };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

// Select a YouTube tab for controls
async function handleSelectYoutubeTab(tabId) {
    try {
        // Verify tab exists
        const tab = await chrome.tabs.get(tabId);
        if (tab) {
            youtubeState.selectedTabId = tabId;
            return { success: true, selectedTabId: tabId };
        }
        return { success: false, error: 'Tab not found' };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

// Close a YouTube tab
async function handleCloseYoutubeTab(tabId) {
    try {
        await chrome.tabs.remove(tabId);

        // Clean up cached state
        delete youtubeState.tabs[tabId];

        // If closed tab was selected, reset selection
        if (youtubeState.selectedTabId === tabId) {
            youtubeState.selectedTabId = null;
        }

        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

// Notify menubar app about YouTube state (fire and forget)
async function notifyMenubarApp(videoInfo) {
    if (!videoInfo) return;

    try {
        await fetch(`http://localhost:${MENUBAR_HTTP_PORT}/youtube/state`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(videoInfo)
        });
    } catch (e) {
        // Menubar app not running, ignore silently
    }
}

// Clean up state when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
    // Clean up YouTube state
    if (youtubeState.tabs[tabId]) {
        delete youtubeState.tabs[tabId];
    }
    if (youtubeState.selectedTabId === tabId) {
        youtubeState.selectedTabId = null;
    }
});

// Clean up state when tabs navigate away from YouTube
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url) {
        const url = changeInfo.url;

        // Check if navigated away from YouTube
        if (youtubeState.tabs[tabId] && !url.includes('youtube.com')) {
            delete youtubeState.tabs[tabId];
            if (youtubeState.selectedTabId === tabId) {
                youtubeState.selectedTabId = null;
            }
        }
    }
});

// Initialize on startup
chrome.runtime.onStartup.addListener(() => {
    setupAlarms();
});

// ========================================
// Telegram Integration
// ========================================

async function sendTelegramReport(isTest = false) {
    const { settings } = await chrome.storage.local.get('settings');

    if (!settings || !settings.telegramBotToken || !settings.telegramChatId) {
        return { success: false, error: 'Chưa cấu hình Telegram' };
    }

    // Get Todo Data
    await ensureTodoToday();
    const { todoTasks } = await chrome.storage.local.get('todoTasks');
    const allTasks = todoTasks ? todoTasks.tasks : [];

    // Separate active vs scheduled (not due today) tasks
    const activeTasks = allTasks.filter(t => isTaskActiveToday(t));
    const scheduledTasks = allTasks.filter(t => !isTaskActiveToday(t));

    const total = activeTasks.length;
    const completed = activeTasks.filter(t => t.completed).length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    const completedTasks = activeTasks.filter(t => t.completed);
    const pendingTasks = activeTasks.filter(t => !t.completed);

    // Escape HTML entities in user text
    const esc = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const getFreqDueLabel = (freq) => {
        if (freq === 'weekly') return '(T2)';
        if (freq === 'monthly') return '(Mùng 1)';
        return '';
    };

    // Format Date
    const now = new Date();
    const dateStr = now.toLocaleDateString('vi-VN', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit'
    });

    let message = `📅 <b>BÁO CÁO NGÀY ${esc(dateStr.toUpperCase())}</b>\n`;
    message += `------------------------------\n`;
    message += `📊 Tiến độ: ${percent}% (${completed}/${total})\n\n`;

    if (completedTasks.length > 0) {
        message += `✅ <b>Đã hoàn thành:</b>\n`;
        completedTasks.forEach(t => {
            message += `✓ ${esc(t.text)}\n`;
        });
        message += `\n`;
    }

    if (pendingTasks.length > 0) {
        message += `⏳ <b>Chưa hoàn thành:</b>\n`;
        pendingTasks.forEach(t => {
            message += `○ ${esc(t.text)}\n`;
        });
        message += `\n`;
    } else if (total > 0) {
        message += `🎉 Xuất sắc! Bạn đã hoàn thành tất cả công việc!\n\n`;
    }

    if (total === 0 && scheduledTasks.length === 0) {
        message += `📝 Hôm nay chưa có task nào được tạo.\n`;
    }

    // Show scheduled tasks (weekly/monthly not due today)
    if (scheduledTasks.length > 0) {
        message += `📅 <b>Chưa đến hạn:</b>\n`;
        scheduledTasks.forEach(t => {
            const dueLabel = getFreqDueLabel(t.frequency);
            const status = t.completed ? '✓' : '○';
            message += `${status} ${esc(t.text)} ${dueLabel}\n`;
        });
        message += `\n`;
    }

    if (isTest) {
        message = `⚠️ <b>TEST NOTIFICATION</b>\n\n` + message;
    }

    // Send to Telegram
    try {
        const url = `https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                chat_id: settings.telegramChatId,
                text: message,
                parse_mode: 'HTML'
            })
        });

        const data = await response.json();

        if (data.ok) {
            return { success: true };
        } else {
            console.error('Telegram API Error:', data);
            return { success: false, error: data.description };
        }
    } catch (e) {
        console.error('Network Error:', e);
        return { success: false, error: e.message };
    }
}
