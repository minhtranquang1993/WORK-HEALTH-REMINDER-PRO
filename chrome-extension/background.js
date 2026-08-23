// ========================================
// Work Health Reminder PRO - Background Service Worker
// Version 3.2
//
// Toàn bộ logic thuần (giờ làm, ngày lễ, suppression, interval, escape,
// history, streak, water pace, meeting) nằm ở lib/core.js và được test
// bằng `node --test tests/core.test.js`. File này chỉ lo phần Chrome API.
// ========================================

importScripts('lib/core.js');
const Core = self.WHRCore;

// Bắt mọi promise rejection không xử lý vào ring buffer (G5).
// Trước đây showCustomNotification thiếu định nghĩa gây ReferenceError
// im lặng bên trong .then() và không ai biết.
const ERROR_LOG_MAX = 50;
self.addEventListener('unhandledrejection', (ev) => {
    const entry = {
        at: new Date().toISOString(),
        reason: String((ev.reason && (ev.reason.stack || ev.reason.message)) || ev.reason)
    };
    console.error('[unhandledrejection]', entry.reason);
    chrome.storage.local.get('errorLog').then(({ errorLog }) => {
        const log = Array.isArray(errorLog) ? errorLog : [];
        log.push(entry);
        chrome.storage.local.set({ errorLog: log.slice(-ERROR_LOG_MAX) });
    }).catch(() => { /* storage không dùng được thì thôi */ });
});

const SCHEMA_VERSION = 2;

// Default settings
const DEFAULT_SETTINGS = {
    // Work hours
    workStart: { hour: 8, minute: 0 },
    lunchStart: { hour: 11, minute: 30 },
    lunchEnd: { hour: 13, minute: 0 },
    workEnd: { hour: 17, minute: 30 },
    nightModeStart: { hour: 18, minute: 0 },

    sleepReminderTime: { hour: 23, minute: 0 },
    morningReminderStart: { hour: 7, minute: 30 },
    weekendMode: "mon_fri", // mon_fri, mon_sat_full, mon_sat_half, mon_sun_full, mon_sun_half
    saturdayEnd: { hour: 12, minute: 0 },
    sundayEnd: { hour: 12, minute: 0 },
    customHolidays: [], // [{ name, start, end }]
    workPeriodEnabled: false,
    workPeriodStart: "",  // "YYYY-MM-DD"
    workPeriodEnd: "",    // "YYYY-MM-DD"

    // Telegram — token KHÔNG bao giờ sync lên cloud, chỉ ở máy này
    telegramBotToken: "",
    telegramChatId: "",
    telegramReportTime: { hour: 17, minute: 0 },

    // Pomodoro
    pomodoroWork: 25,
    pomodoroBreak: 5,
    pomodoroLongBreak: 15,

    // Intervals — nguồn sự thật duy nhất nằm ở Core.DEFAULT_INTERVALS
    intervals: Object.assign({}, Core.DEFAULT_INTERVALS),

    // Water Tracker
    waterGoalMl: 2000,
    waterCupMl: 200,
    waterPaceMode: true,      // chỉ nhắc khi tụt tiến độ thay vì nhắc cứng

    // Automation
    idleSuppression: true,    // không nhắc khi rời máy / máy khoá
    idleThresholdSec: 300,    // 5 phút
    meetingAutoFocus: true,   // tự tắt nhắc khi đang họp
    adaptiveIntervals: false, // opt-in: tự giãn interval khi bị bỏ qua

    // Toggles
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
    workStartedToday: false,

    // Reconcile ngày: thay cho việc chỉ dựa vào alarm DAILY_RESET, vì
    // onStartup -> setupAlarms -> clearAll() xoá alarm đó trước khi nó chạy,
    // làm mấy cờ trên kẹt true vĩnh viễn khi tắt Chrome qua đêm.
    lastDailyResetDate: null,
    lastReportSentDate: null,

    // Automation
    idleState: 'active',        // active | idle | locked
    meetingActive: false,
    meetingLastAudibleAt: null
};

// Thống kê compliance cho adaptive interval (opt-in)
let complianceStats = {};      // { [reminderType]: { consecutiveDismissed, consecutiveDone } }

// YouTube state — chỉ selectedTabId được persist, và persist vào
// storage.session vì tab id chỉ có nghĩa trong phiên trình duyệt hiện tại.
let youtubeState = {
    selectedTabId: null,
    tabs: {},
    lastUpdate: null
};

// Menubar app HTTP port
const MENUBAR_HTTP_PORT = 9876;

// Bảng ngày lễ VN nằm ở Core (fixed + lunar), có kiểm tra hết hạn.
function getHolidayTable() {
    return Core.buildHolidayTable(new Date());
}

/** Bảng ngày lễ âm lịch hardcode tới HOLIDAY_TABLE_LAST_YEAR -> cần cảnh báo. */
function getHolidayTableWarning() {
    const currentYear = new Date().getFullYear();
    if (currentYear >= Core.HOLIDAY_TABLE_LAST_YEAR) {
        return `Bảng ngày lễ âm lịch chỉ có dữ liệu tới ${Core.HOLIDAY_TABLE_LAST_YEAR}. `
             + `Cần cập nhật Tết & Giỗ Tổ cho các năm sau trong lib/core.js.`;
    }
    return null;
}

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
    SESSION_END: 'session_end',       // one-shot: đúng lúc Focus/Pomodoro hết
    DAILY_ROLLOVER: 'daily_rollover', // reconcile ngày mới
    TODO_REMINDER: 'todo_reminder',
    TODO_START_REMINDER: 'todo_start_reminder',
    DAILY_REPORT: 'daily_report',
    SNOOZE_PREFIX: 'snooze_'          // snooze_<type>
};

// Map alarm name <-> interval key (một nguồn sự thật, không viết tay 2 lần)
const PERIODIC_ALARMS = {
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

const INTERVAL_TO_ALARM = Object.fromEntries(
    Object.entries(PERIODIC_ALARMS).map(([alarmName, key]) => [key, alarmName])
);

// Reminder data.
// `actions` khai báo nút bấm trên notification (tối đa 2 — giới hạn Chrome).
// Nhờ đó phần lớn hành động không cần mở popup nữa.
const ACTION = {
    DONE: 'done',
    SNOOZE: 'snooze',
    WATER_CUP: 'water_cup'
};

const REMINDERS = {
    walk: {
        title: "🚶 Đến lúc đi bộ rồi!",
        message: "Đứng dậy và đi bộ 2-3 phút để thư giãn cơ thể nhé!",
        actions: [ACTION.DONE, ACTION.SNOOZE]
    },
    water: {
        title: "💧 Uống nước đi!",
        message: "Uống một ly nước lọc để giữ cơ thể luôn được hydrate!",
        actions: [ACTION.WATER_CUP, ACTION.SNOOZE]
    },
    toilet: {
        title: "🚻 Đi toilet thôi!",
        message: "Đến lúc đi toilet rồi, đừng nhịn quá lâu nhé!",
        actions: [ACTION.DONE, ACTION.SNOOZE]
    },
    eye_20_20_20: {
        title: "👁️ 20-20-20!",
        message: "Nhìn ra xa 6 mét trong 20 giây để bảo vệ mắt!",
        actions: [ACTION.DONE, ACTION.SNOOZE]
    },
    blink: {
        title: "😊 Chớp mắt!",
        message: "Chớp mắt 15-20 lần để làm ẩm mắt!",
        actions: [ACTION.DONE]
    },
    posture: {
        title: "🪑 Kiểm tra tư thế!",
        message: "Ngồi thẳng lưng, thả lỏng vai, chân chạm đất nhé!",
        actions: [ACTION.DONE, ACTION.SNOOZE]
    },
    neck_stretch: {
        title: "🧘 Giãn cổ vai!",
        message: "Dành 2 phút để giãn cơ cổ và vai nhé!",
        actions: [ACTION.DONE, ACTION.SNOOZE]
    },
    eye_exercise: {
        title: "👁️ Bài tập mắt!",
        message: "Làm bài tập mắt để bảo vệ thị lực!",
        actions: [ACTION.DONE, ACTION.SNOOZE]
    },
    breathing: {
        title: "🌬️ Hít thở sâu!",
        message: "Dành 2 phút hít thở sâu để thư giãn!",
        actions: [ACTION.DONE, ACTION.SNOOZE]
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
    },
    water_goal: {
        title: "🎉 Đạt mục tiêu nước!",
        message: "Bạn đã uống đủ nước hôm nay. Tuyệt vời!"
    }
};

const ACTION_LABEL = {
    [ACTION.DONE]: '✅ Đã làm',
    [ACTION.SNOOZE]: '⏰ +5 phút',
    [ACTION.WATER_CUP]: '💧 +1 ly'
};

const SNOOZE_MINUTES = 5;

// ========================================
// State persistence + migration
// ========================================

async function loadState() {
    const { state: saved } = await chrome.storage.local.get('state');
    if (saved) Object.assign(state, saved);
    return state;
}

async function saveState() {
    await chrome.storage.local.set({ state });
}

/**
 * Đọc settings, luôn vá đủ field và normalize interval.
 * Đây là chốt chặn: nếu intervals thiếu key thì alarms.create() sẽ throw
 * và phá cả bộ alarm.
 */
async function getSettings() {
    const { settings } = await chrome.storage.local.get('settings');
    const merged = Object.assign({}, DEFAULT_SETTINGS, settings || {});
    merged.intervals = Core.normalizeIntervals(
        Object.assign({}, Core.DEFAULT_INTERVALS, (settings && settings.intervals) || {})
    );
    return merged;
}

/**
 * Migration idempotent, gọi từ CẢ onInstalled và onStartup.
 * v2: đổi key todoHistory từ toDateString sang "YYYY-MM-DD" (sort được
 * theo thời gian) và bỏ hệ shadow timer.
 */
async function runMigrations() {
    const data = await chrome.storage.local.get(['schemaVersion', 'todoHistory', 'settings']);
    const from = Number(data.schemaVersion) || 1;
    if (from >= SCHEMA_VERSION) return;

    console.log(`[migrate] v${from} -> v${SCHEMA_VERSION}`);

    if (data.todoHistory) {
        await chrome.storage.local.set({
            todoHistory: Core.migrateAndPruneHistory(data.todoHistory, 30)
        });
    }

    // Vá interval cho user cũ đang dính blink=2 hoặc thiếu key
    if (data.settings) {
        const patched = Object.assign({}, data.settings);
        patched.intervals = Core.normalizeIntervals(
            Object.assign({}, Core.DEFAULT_INTERVALS, data.settings.intervals || {})
        );
        // blink=2 là default cũ gây spam; nếu user vẫn để 2 thì đưa về default mới
        if (data.settings.intervals && Number(data.settings.intervals.blink) <= 5) {
            patched.intervals.blink = Core.DEFAULT_INTERVALS.blink;
        }
        delete patched.soundEnabled;   // setting chết, không đọc ở đâu
        await chrome.storage.local.set({ settings: patched });
    }

    // Xoá hệ shadow timer đã bỏ
    await chrome.storage.local.remove(['timers', 'lastUpdate']);
    await chrome.storage.local.set({ schemaVersion: SCHEMA_VERSION });
}

// Initialize on install
chrome.runtime.onInstalled.addListener(async () => {
    console.log('Work Health Reminder PRO installed');

    const existing = await chrome.storage.local.get('settings');
    if (!existing.settings) {
        await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
    }
    await runMigrations();

    const todoData = await chrome.storage.local.get(['todoTasks', 'todoHistory', 'todoSettings']);
    if (!todoData.todoTasks) {
        await chrome.storage.local.set({
            todoTasks: { date: Core.toLocalDateKey(new Date()), tasks: [] }
        });
    }
    if (!todoData.todoHistory) await chrome.storage.local.set({ todoHistory: {} });
    if (!todoData.todoSettings) {
        await chrome.storage.local.set({
            todoSettings: {
                streak: 0, bestStreak: 0, lastCompletedDate: null,
                autoReset: true, reminderEnabled: true
            }
        });
    }

    await saveState();
    await reconcileDay();
    await setupAlarms();
    await refreshIdleDetection();
});

chrome.runtime.onStartup.addListener(async () => {
    console.log('[Startup] Initializing...');
    await runMigrations();
    await loadState();
    await reconcileDay();     // chạy TRƯỚC setupAlarms để không bị clear mất
    await setupAlarms();
    await refreshIdleDetection();
    await evaluateMeetingState();
    console.log('[Startup] Done');
});

// ========================================
// Daily rollover — reconcile thay vì phụ thuộc alarm
// ========================================

/**
 * Nếu chưa reconcile cho hôm nay: reset cờ ngày, reset todo, bù báo cáo
 * Telegram bị bỏ. Gọi từ onStartup / onInstalled / mỗi lần alarm chạy.
 *
 * Bug cũ: cờ chỉ được reset trong handler alarm DAILY_RESET, mà
 * onStartup -> setupAlarms -> clearAll() xoá alarm đó trước khi nó chạy
 * => nightModeReminded/sleepReminded/morningReminded kẹt true vĩnh viễn.
 */
async function reconcileDay() {
    await loadState();
    const todayKey = Core.toLocalDateKey(new Date());
    if (state.lastDailyResetDate === todayKey) return false;

    const previousDate = state.lastDailyResetDate;

    state.nightModeReminded = false;
    state.sleepReminded = false;
    state.morningReminded = false;
    state.workStartedToday = false;
    state.pomodoroCount = 0;
    state.lastDailyResetDate = todayKey;
    await saveState();

    await performTodoDailyReset();

    // Streak phải đứt được khi bỏ ngày
    const { todoSettings } = await chrome.storage.local.get('todoSettings');
    if (todoSettings) {
        await chrome.storage.local.set({
            todoSettings: Core.resolveStreakOnRollover(todoSettings, new Date())
        });
    }

    // Bù báo cáo hôm qua nếu Chrome đang tắt lúc tới giờ gửi
    if (previousDate && state.lastReportSentDate !== previousDate) {
        const settings = await getSettings();
        if (settings.telegramBotToken && settings.telegramChatId) {
            console.log('[rollover] Bù báo cáo Telegram bị bỏ:', previousDate);
            await sendTelegramReport(false, { catchUpFor: previousDate });
        }
    }

    await scheduleFixedTimeAlarms(await getSettings());
    return true;
}

// ========================================
// Alarms
// ========================================

/**
 * KHÔNG dùng clearAll(). Chỉ tạo lại alarm nào có interval thật sự đổi,
 * nhờ Core.diffAlarms. Bug cũ: mỗi lần Save Settings là clearAll() rồi tạo
 * lại hết => mọi nhắc nhở bị đặt lại đồng hồ về 0, và alarm giờ cố định
 * (lunch/ngủ/báo cáo...) bị mất cho tới lần setup kế tiếp.
 */
async function setupAlarms() {
    try {
        const settings = await getSettings();
        const desired = {};
        for (const [alarmName, key] of Object.entries(PERIODIC_ALARMS)) {
            desired[alarmName] = settings.intervals[key];
        }

        const existing = await chrome.alarms.getAll();
        const { toCreate, toClear } = Core.diffAlarms(
            existing.filter(a => PERIODIC_ALARMS[a.name]), desired);

        for (const name of toClear) await chrome.alarms.clear(name);
        for (const item of toCreate) {
            // Cả `when` và `periodInMinutes`: thiếu periodInMinutes thì
            // alarm thành one-shot và nhắc nhở im lặng chết sau 1 lần.
            chrome.alarms.create(item.name, {
                when: Date.now() + item.periodInMinutes * 60000,
                periodInMinutes: item.periodInMinutes
            });
        }

        // Rollover: 1 lần/ngày là đủ, không cần poll mỗi phút
        const rollover = existing.find(a => a.name === ALARMS.DAILY_ROLLOVER);
        if (!rollover) {
            const midnight = new Date();
            midnight.setHours(24, 0, 30, 0);   // +30s cho chắc đã qua ngày
            chrome.alarms.create(ALARMS.DAILY_ROLLOVER, {
                when: midnight.getTime(), periodInMinutes: 24 * 60
            });
        }

        await scheduleFixedTimeAlarms(settings);
        console.log('[alarms] created:', toCreate.map(a => a.name), 'cleared:', toClear);
    } catch (e) {
        // Không để một interval xấu phá cả bộ alarm
        console.error('[setupAlarms] failed:', e);
    }
}

/** Đặt alarm one-shot đúng lúc Focus/Pomodoro kết thúc — thay cho poll 30s. */
async function scheduleSessionEndAlarm() {
    await chrome.alarms.clear(ALARMS.SESSION_END);
    const ends = [state.focusEndTime, state.pomodoroEndTime].filter(t => t && t > Date.now());
    if (ends.length === 0) return;
    chrome.alarms.create(ALARMS.SESSION_END, { when: Math.min(...ends) });
}

function atTimeToday(time) {
    const d = new Date();
    d.setHours(time.hour, time.minute, 0, 0);
    return d;
}

async function scheduleFixedTimeAlarms(settings) {
    const now = new Date();
    const table = getHolidayTable();
    const workday = Core.isWorkDay(settings, now, table);

    const plan = [
        // Chỉ đặt alarm giờ-cố-định vào ngày làm việc. Bug cũ: END_WORK
        // không check isWorkDay nên "Hết giờ làm việc!" nổ cả T7/CN/ngày lễ.
        [ALARMS.LUNCH, settings.lunchStart, workday],
        [ALARMS.END_WORK, Core.getTodayWorkEnd(settings, now), workday],
        [ALARMS.MORNING, settings.morningReminderStart, workday],
        [ALARMS.TODO_START_REMINDER, settings.workStart, workday],
        // Night mode / ngủ là nhắc cá nhân, không phụ thuộc ngày làm việc
        [ALARMS.NIGHT_MODE, settings.nightModeStart, true],
        [ALARMS.SLEEP, settings.sleepReminderTime, true]
    ];

    for (const [name, time, enabled] of plan) {
        await chrome.alarms.clear(name);
        if (!enabled || !time) continue;
        const at = atTimeToday(time);
        if (at > now) chrome.alarms.create(name, { when: at.getTime() });
    }

    // Todo reminder: 60 phút trước khi hết giờ làm
    await chrome.alarms.clear(ALARMS.TODO_REMINDER);
    if (workday) {
        const todoAt = atTimeToday(Core.getTodayWorkEnd(settings, now));
        todoAt.setMinutes(todoAt.getMinutes() - 60);
        if (todoAt > now) chrome.alarms.create(ALARMS.TODO_REMINDER, { when: todoAt.getTime() });
    }

    // Báo cáo Telegram
    await chrome.alarms.clear(ALARMS.DAILY_REPORT);
    if (settings.telegramBotToken && settings.telegramChatId && workday) {
        const at = atTimeToday(settings.telegramReportTime);
        if (at > now) chrome.alarms.create(ALARMS.DAILY_REPORT, { when: at.getTime() });
    }
}

// ========================================
// Automation: idle + meeting detection
// ========================================

async function refreshIdleDetection() {
    const settings = await getSettings();
    if (!settings.idleSuppression) {
        state.idleState = 'active';
        await saveState();
        return;
    }
    const sec = Math.max(15, Number(settings.idleThresholdSec) || 300);
    chrome.idle.setDetectionInterval(sec);
    const st = await chrome.idle.queryState(sec);
    state.idleState = st;
    await saveState();
}

chrome.idle.onStateChanged.addListener(async (newState) => {
    await loadState();
    state.idleState = newState;
    await saveState();
    console.log('[idle]', newState);
});

/**
 * Phát hiện họp bằng tab, không cần calendar/OAuth và không cần quyền mới
 * (`tabs` đã cho URL + audible). Đây là bản thay thế cho feature ICS đã xoá.
 */
async function evaluateMeetingState() {
    const settings = await getSettings();
    if (!settings.meetingAutoFocus) {
        if (state.meetingActive) {
            state.meetingActive = false;
            await saveState();
        }
        return false;
    }

    await loadState();
    let tabs = [];
    try {
        tabs = await chrome.tabs.query({});
    } catch (e) {
        return state.meetingActive;
    }

    const simple = tabs.map(t => ({ id: t.id, url: t.url, audible: !!t.audible }));
    const audibleMeeting = simple.find(t => Core.isMeetingUrl(t.url) && t.audible);
    if (audibleMeeting) state.meetingLastAudibleAt = Date.now();

    const result = Core.evaluateMeeting(simple, state.meetingLastAudibleAt, new Date());
    if (result.active !== state.meetingActive) {
        state.meetingActive = result.active;
        console.log('[meeting]', result.active ? 'bắt đầu' : 'kết thúc');
    }
    await saveState();
    return state.meetingActive;
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
    // Dọn cache YouTube khi tab điều hướng đi nơi khác
    if (changeInfo.url && youtubeState.tabs[tabId] && !changeInfo.url.includes('youtube.com')) {
        delete youtubeState.tabs[tabId];
        if (youtubeState.selectedTabId === tabId) await saveYoutubeSelection(null);
    }
    // Phát hiện họp: URL đổi hoặc tab bắt đầu/ngừng phát tiếng
    if (changeInfo.audible !== undefined || changeInfo.url) {
        await evaluateMeetingState();
    }
});

// ========================================
// Suppression + status (một nguồn sự thật, dùng Core)
// ========================================

async function buildSuppressionContext(settings) {
    await loadState();
    return {
        settings,
        state,
        now: new Date(),
        idleState: settings.idleSuppression ? state.idleState : 'active',
        meeting: { active: settings.meetingAutoFocus && state.meetingActive },
        holidayTable: getHolidayTable()
    };
}

/**
 * Trạng thái hiển thị cho popup. Nếu đang bị chặn thì trả LÝ DO —
 * popup không hiện số đếm ngược sai nữa.
 */
async function getWorkStatus(settings) {
    const ctx = await buildSuppressionContext(settings);
    const now = ctx.now;

    if (state.pomodoroState === 'work' || state.pomodoroState === 'break') {
        const remaining = state.pomodoroEndTime
            ? Math.max(0, Math.floor((state.pomodoroEndTime - Date.now()) / 1000)) : 0;
        const mins = Math.floor(remaining / 60);
        const secs = String(remaining % 60).padStart(2, '0');
        return state.pomodoroState === 'work'
            ? { status: 'pomodoro_work', label: `🍅 Pomodoro: ${mins}:${secs}`, color: 'red' }
            : { status: 'pomodoro_break', label: `☕ Nghỉ: ${mins}:${secs}`, color: 'orange' };
    }

    if (state.focusEndTime && Date.now() < state.focusEndTime) {
        const mins = Math.max(0, Math.floor((state.focusEndTime - Date.now()) / 60000));
        return { status: 'focus', label: `🎯 Focus: còn ${mins} phút`, color: 'blue' };
    }

    const reason = Core.getSuppressionReason(ctx);
    if (!reason) return { status: 'working', label: '🟢 Đang làm việc', color: 'green' };

    const colorByReason = {
        paused: 'gray', notifications_off: 'gray', holiday: 'red', weekend: 'purple',
        lunch: 'orange', before_work: 'gray', after_work: 'purple',
        idle: 'gray', locked: 'gray', meeting: 'blue'
    };

    let label = Core.SUPPRESS_LABEL[reason];
    if (reason === Core.SUPPRESS.HOLIDAY) {
        const h = Core.checkHoliday(settings, now, ctx.holidayTable);
        if (h.name) label = `🎌 ${h.name}`;
    } else if (reason === Core.SUPPRESS.WEEKEND) {
        const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
        label = `🎉 Ngày nghỉ (${days[now.getDay()]})`;
    }

    return { status: reason, label, color: colorByReason[reason] || 'gray', suppressed: true };
}

/** Đếm ngược lấy TRỰC TIẾP từ chrome.alarms — không còn dict shadow. */
async function getTimersFromAlarms() {
    const alarms = await chrome.alarms.getAll();
    const now = Date.now();
    const timers = {};
    for (const [alarmName, key] of Object.entries(PERIODIC_ALARMS)) {
        const alarm = alarms.find(a => a.name === alarmName);
        timers[key] = alarm ? Math.max(0, Math.round((alarm.scheduledTime - now) / 1000)) : null;
    }
    return timers;
}

// isTaskActiveToday: weekly chỉ hoạt động T2, monthly chỉ mùng 1
function isTaskActiveToday(task, now) {
    const d = now || new Date();
    if (!task.frequency || task.frequency === 'once' || task.frequency === 'daily') return true;
    if (task.frequency === 'weekly') return d.getDay() === 1;
    if (task.frequency === 'monthly') return d.getDate() === 1;
    return true;
}

// ========================================
// Alarm dispatch
// ========================================

chrome.alarms.onAlarm.addListener(async (alarm) => {
    try {
        // Mỗi lần alarm chạy đều kiểm tra đã sang ngày mới chưa —
        // không phụ thuộc riêng vào alarm rollover có sống sót hay không.
        await reconcileDay();

        const settings = await getSettings();
        await loadState();

        if (alarm.name === ALARMS.DAILY_ROLLOVER) return;   // reconcileDay đã lo

        if (alarm.name === ALARMS.SESSION_END) {
            await handleSessionEnd(settings);
            return;
        }

        if (alarm.name === ALARMS.DAILY_REPORT) {
            await sendTelegramReport();
            return;
        }

        // Snooze: snooze_<type>
        if (alarm.name.startsWith(ALARMS.SNOOZE_PREFIX)) {
            const type = alarm.name.slice(ALARMS.SNOOZE_PREFIX.length);
            await deliverReminder(type, settings, { fromSnooze: true });
            return;
        }

        // ── Nhắc nhở giờ cố định ──
        // notificationEnabled phải được kiểm TRƯỚC nhóm này. Bug cũ đặt
        // guard sau nên tắt thông báo vẫn nhận lunch/hết giờ/ngủ/sáng/todo.
        if (settings.isPaused) return;
        if (settings.notificationEnabled === false) return;

        const table = getHolidayTable();
        const now = new Date();

        if (alarm.name === ALARMS.LUNCH) {
            if (Core.isLunchBreak(settings, now, table)) showNotification('lunch');
            return;
        }
        if (alarm.name === ALARMS.END_WORK) {
            // Phải check work day: alarm có thể còn sót từ hôm trước
            if (Core.isWorkDay(settings, now, table)) showNotification('end_work');
            return;
        }
        if (alarm.name === ALARMS.NIGHT_MODE) {
            if (!state.nightModeReminded) {
                state.nightModeReminded = true;
                await saveState();
                showNotification('night_mode');
            }
            return;
        }
        if (alarm.name === ALARMS.SLEEP) {
            if (!state.sleepReminded) {
                state.sleepReminded = true;
                await saveState();
                showNotification('sleep');
            }
            return;
        }
        if (alarm.name === ALARMS.MORNING) {
            if (!state.morningReminded && Core.isMorningReminderWindow(settings, now, table)) {
                state.morningReminded = true;
                await saveState();
                showNotification('morning');
            }
            return;
        }
        if (alarm.name === ALARMS.TODO_START_REMINDER) {
            await ensureTodoToday();
            const { todoTasks } = await chrome.storage.local.get('todoTasks');
            if (!todoTasks || todoTasks.tasks.length === 0) showNotification('todo_start');
            return;
        }
        if (alarm.name === ALARMS.TODO_REMINDER) {
            const { todoTasks } = await chrome.storage.local.get('todoTasks');
            if (todoTasks && todoTasks.tasks.some(t => !t.completed && isTaskActiveToday(t))) {
                showNotification('todo_incomplete');
            }
            return;
        }

        // ── Nhắc nhở định kỳ ──
        const type = PERIODIC_ALARMS[alarm.name];
        if (type) await deliverReminder(type, settings);
    } catch (e) {
        console.error('[onAlarm]', alarm.name, e);
    }
});

/**
 * Cửa duy nhất để gửi nhắc nhở định kỳ. Mọi điều kiện chặn (pause, tắt
 * thông báo, ngày lễ, nghỉ trưa, ngoài giờ, Focus, Pomodoro, idle, họp)
 * đều đi qua Core.getSuppressionReason nên popup và background không thể
 * lệch nhau.
 */
async function deliverReminder(type, settings, opts) {
    const cfg = opts || {};
    if (settings.meetingAutoFocus) await evaluateMeetingState();

    const ctx = await buildSuppressionContext(settings);
    const reason = Core.getSuppressionReason(ctx);
    if (reason) {
        console.log(`[skip] ${type} vì ${reason}`);
        return { delivered: false, reason };
    }

    // Nước: chỉ nhắc khi ĐANG TỤT tiến độ, thay vì nhắc cứng theo interval
    if (type === 'water' && settings.waterPaceMode && !cfg.fromSnooze) {
        const log = await getWaterLog();
        const pace = Core.evaluateWaterPace({
            totalMl: log.totalMl, goalMl: settings.waterGoalMl,
            settings, now: ctx.now
        });
        if (!pace.behind) {
            console.log('[skip] water: đang đúng tiến độ');
            return { delivered: false, reason: 'on_pace' };
        }
        showNotification('water', {
            message: pace.severe
                ? `Bạn đang tụt ${pace.deficitMl}ml so với tiến độ hôm nay. Uống ngay một ly nhé!`
                : `Uống một ly nước để bắt kịp tiến độ (${log.totalMl}/${settings.waterGoalMl}ml).`
        });
        return { delivered: true };
    }

    showNotification(type);
    return { delivered: true };
}

async function handleSessionEnd(settings) {
    await loadState();
    const now = Date.now();

    if (state.focusEndTime && now >= state.focusEndTime) {
        state.focusEndTime = null;
        await saveState();
        if (settings.notificationEnabled !== false) showNotification('focus_end');
    }

    if (state.pomodoroState && state.pomodoroEndTime && now >= state.pomodoroEndTime) {
        if (state.pomodoroState === 'work') {
            state.pomodoroCount++;
            const breakTime = state.pomodoroCount % 4 === 0
                ? settings.pomodoroLongBreak : settings.pomodoroBreak;
            state.pomodoroState = 'break';
            state.pomodoroEndTime = now + breakTime * 60000;
            await saveState();
            if (settings.notificationEnabled !== false) showNotification('pomodoro_work_end');
        } else {
            state.pomodoroState = null;
            state.pomodoroEndTime = null;
            await saveState();
            if (settings.notificationEnabled !== false) showNotification('pomodoro_break_end');
        }
    }

    await scheduleSessionEndAlarm();
}

// ========================================
// Notifications
// ========================================

/**
 * ID ỔN ĐỊNH theo loại nhắc nhở (whr_<type>) để thông báo mới THAY THẾ
 * thông báo cũ cùng loại. Bug cũ dùng `type + '_' + Date.now()` nên khi
 * rời máy quay lại, Notification Center đầy một đống nhắc nhở cũ xếp chồng.
 */
function notificationIdFor(type) {
    return `whr_${type}`;
}

function typeFromNotificationId(id) {
    return id && id.startsWith('whr_') ? id.slice(4) : null;
}

function showNotification(type, overrides) {
    const reminder = REMINDERS[type];
    if (!reminder) return;
    const o = overrides || {};

    const options = {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: o.title || reminder.title,
        message: o.message || reminder.message,
        priority: 2
    };

    // Nút bấm: tối đa 2 (giới hạn Chrome). Nếu bản Chrome/OS hiện tại không
    // hỗ trợ buttons thì create() báo lỗi -> gửi lại bản không nút.
    const actions = o.actions || reminder.actions;
    if (actions && actions.length) {
        options.buttons = actions.slice(0, 2).map(a => ({ title: ACTION_LABEL[a] }));
    }

    chrome.notifications.create(notificationIdFor(type), options, () => {
        if (chrome.runtime.lastError) {
            console.warn('[notify]', type, chrome.runtime.lastError.message);
            if (options.buttons) {
                delete options.buttons;
                chrome.notifications.create(notificationIdFor(type), options, () => {
                    if (chrome.runtime.lastError) {
                        console.warn('[notify] fallback:', chrome.runtime.lastError.message);
                    }
                });
            }
        }
    });
}

chrome.notifications.onClicked.addListener((notificationId) => {
    chrome.notifications.clear(notificationId);
});

chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
    try {
        const type = typeFromNotificationId(notificationId);
        chrome.notifications.clear(notificationId);
        if (!type) return;

        const reminder = REMINDERS[type];
        const action = ((reminder && reminder.actions) || [])[buttonIndex];
        if (!action) return;

        const settings = await getSettings();

        if (action === ACTION.SNOOZE) {
            chrome.alarms.create(ALARMS.SNOOZE_PREFIX + type, {
                when: Date.now() + SNOOZE_MINUTES * 60000
            });
            await recordCompliance(type, 'snoozed', settings);
            return;
        }

        if (action === ACTION.WATER_CUP) {
            await addWaterAndCelebrate(Number(settings.waterCupMl) || 200, settings);
            await recordCompliance(type, 'done', settings);
            return;
        }

        if (action === ACTION.DONE) {
            // Đẩy lần nhắc kế tiếp về đủ một chu kỳ tính từ bây giờ.
            // Phải truyền cả periodInMinutes, nếu chỉ `when` thì alarm
            // thành one-shot và nhắc nhở im lặng chết sau lần đó.
            const alarmName = INTERVAL_TO_ALARM[type];
            if (alarmName) {
                const minutes = settings.intervals[type];
                chrome.alarms.create(alarmName, {
                    when: Date.now() + minutes * 60000,
                    periodInMinutes: minutes
                });
            }
            await recordCompliance(type, 'done', settings);
        }
    } catch (e) {
        console.error('[onButtonClicked]', e);
    }
});

/** Người dùng tự tắt thông báo cũng là một tín hiệu compliance. */
chrome.notifications.onClosed.addListener(async (notificationId, byUser) => {
    if (!byUser) return;
    const type = typeFromNotificationId(notificationId);
    if (!type || !INTERVAL_TO_ALARM[type]) return;
    await recordCompliance(type, 'dismissed', await getSettings());
});

/**
 * Thống kê compliance để tự giãn interval (opt-in adaptiveIntervals).
 * Core.adaptInterval có sàn/trần nên không bao giờ trôi thành "im lặng".
 */
async function recordCompliance(type, outcome, settings) {
    const { compliance } = await chrome.storage.local.get('compliance');
    const stats = compliance || {};
    const s = stats[type] || { consecutiveDismissed: 0, consecutiveDone: 0 };

    if (outcome === 'done') {
        s.consecutiveDone++;
        s.consecutiveDismissed = 0;
    } else if (outcome === 'dismissed') {
        s.consecutiveDismissed++;
        s.consecutiveDone = 0;
    }
    stats[type] = s;
    await chrome.storage.local.set({ compliance: stats });

    if (!settings.adaptiveIntervals || !INTERVAL_TO_ALARM[type]) return;

    const current = settings.intervals[type];
    const next = Core.adaptInterval(current, Core.DEFAULT_INTERVALS[type], s);
    if (next === current) return;

    await chrome.storage.local.set({
        settings: Object.assign({}, settings, {
            intervals: Object.assign({}, settings.intervals, { [type]: next })
        })
    });
    stats[type] = { consecutiveDismissed: 0, consecutiveDone: 0 };
    await chrome.storage.local.set({ compliance: stats });
    await setupAlarms();
    console.log(`[adaptive] ${type}: ${current} -> ${next} phút`);
}

// ========================================
// Messages
// ========================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender)
        .then(result => sendResponse(result || { success: false, error: 'No response' }))
        .catch(err => {
            console.error('[handleMessage]', message && message.action, err);
            sendResponse({ success: false, error: err.message });
        });
    return true;
});

async function handleMessage(message, sender) {
    const settings = await getSettings();
    await loadState();

    switch (message.action) {
        // ── Status ──
        case 'getStatus':
            return await handleGetStatus(settings);

        case 'getSettings':
            return { success: true, settings };

        case 'updateSettings': {
            // DEEP merge cho intervals. Bug cũ dùng shallow merge nên khi
            // popup chỉ gửi 4 interval mà UI có, 5 key còn lại thành
            // undefined -> alarms.create() throw sau khi clearAll() đã chạy
            // -> mất luôn lunch/hết giờ/ngủ/sáng/todo/báo cáo Telegram.
            const incoming = message.settings || {};
            const merged = Object.assign({}, settings, incoming);
            merged.intervals = Core.normalizeIntervals(
                Object.assign({}, settings.intervals, incoming.intervals || {})
            );
            await chrome.storage.local.set({ settings: merged });
            await setupAlarms();
            await refreshIdleDetection();
            return { success: true, settings: merged };
        }

        case 'resetToDefaults':
            await chrome.storage.local.set({
                settings: Object.assign({}, DEFAULT_SETTINGS, { isConfigured: true })
            });
            await setupAlarms();
            await refreshIdleDetection();
            return { success: true };

        case 'getDiagnostics': {
            const alarms = await chrome.alarms.getAll();
            const { errorLog, compliance } = await chrome.storage.local.get(['errorLog', 'compliance']);
            return {
                success: true,
                alarms: alarms.map(a => ({
                    name: a.name,
                    periodInMinutes: a.periodInMinutes,
                    scheduledIn: Math.round((a.scheduledTime - Date.now()) / 1000)
                })),
                errorLog: errorLog || [],
                compliance: compliance || {},
                idleState: state.idleState,
                meetingActive: state.meetingActive,
                holidayWarning: getHolidayTableWarning(),
                actionNotificationsPerDay: Core.countDailyNotifications(
                    settings.intervals, Core.workMinutesToday(settings, new Date()),
                    { actionOnly: true })
            };
        }

        // ── Timers ──
        case 'resetTimer':
            return await handleResetTimer(message.timerType, settings);

        case 'resetAll':
            return await handleResetAllTimers(settings);

        case 'togglePause':
            return await handleTogglePause(settings);

        // ── Focus / Pomodoro ──
        case 'startFocus':
            state.focusEndTime = Date.now() + message.minutes * 60000;
            await saveState();
            await scheduleSessionEndAlarm();
            await pauseAllYoutubeTabs();
            return { success: true, focusEndTime: state.focusEndTime };

        case 'stopFocus':
            state.focusEndTime = null;
            await saveState();
            await scheduleSessionEndAlarm();
            return { success: true };

        case 'getFocusStatus':
            return {
                success: true,
                isFocusActive: !!(state.focusEndTime && Date.now() < state.focusEndTime),
                focusEndTime: state.focusEndTime
            };

        case 'startPomodoro':
            state.pomodoroState = 'work';
            state.pomodoroEndTime = Date.now() + settings.pomodoroWork * 60000;
            await saveState();
            await scheduleSessionEndAlarm();
            return {
                success: true,
                pomodoroState: state.pomodoroState,
                pomodoroEndTime: state.pomodoroEndTime
            };

        case 'stopPomodoro':
            state.pomodoroState = null;
            state.pomodoroEndTime = null;
            await saveState();
            await scheduleSessionEndAlarm();
            return { success: true };

        // ── Water ──
        case 'getWaterLog':
            return { success: true, log: await getWaterLog() };

        case 'addWater':
            return { success: true, log: await addWaterAndCelebrate(message.ml, settings) };

        case 'resetWater':
            return { success: true, log: await resetWaterToday() };

        case 'undoWater':
            return await undoLastWater();

        case 'getWaterPace': {
            const log = await getWaterLog();
            return {
                success: true,
                pace: Core.evaluateWaterPace({
                    totalMl: log.totalMl, goalMl: settings.waterGoalMl,
                    settings, now: new Date()
                })
            };
        }

        // ── Notifications test ──
        case 'testNotification':
            showNotification('walk');
            return { success: true };

        case 'testTelegram':
            // KHÔNG gọi saveSettings ở popup nữa; nhận token trực tiếp
            return await sendTelegramReport(true, {
                overrideToken: message.botToken,
                overrideChatId: message.chatId
            });

        // ── YouTube ──
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

        case 'youtubeStateUpdate': {
            const tabId = sender && sender.tab && sender.tab.id;
            if (tabId) {
                youtubeState.tabs[tabId] = message.videoInfo;
                youtubeState.lastUpdate = Date.now();
            }
            notifyMenubarApp(message.videoInfo);
            return { success: true };
        }

        // ── Todo ──
        case 'getTodoData': {
            await ensureTodoToday();
            const data = await chrome.storage.local.get(['todoTasks', 'todoHistory', 'todoSettings']);
            if (data.todoTasks && data.todoTasks.tasks) {
                data.todoTasks.tasks = data.todoTasks.tasks.map(t =>
                    Object.assign({}, t, { isActiveToday: isTaskActiveToday(t) }));
            }
            return Object.assign({ success: true }, data);
        }

        case 'addTodo':
            return await handleTodoAddTask(message.task);
        case 'toggleTodo':
            return await handleTodoToggleTask(message.taskId, message.earlyComplete);
        case 'deleteTodo':
            return await handleTodoDeleteTask(message.taskId);

        case 'getTodoHistory': {
            const { todoHistory } = await chrome.storage.local.get('todoHistory');
            return { success: true, history: todoHistory || {} };
        }

        // ── Holidays ──
        case 'getHolidays':
            return {
                success: true,
                fixedHolidays: getHolidayTable(),
                customHolidays: settings.customHolidays || [],
                warning: getHolidayTableWarning()
            };

        case 'addCustomHoliday': {
            const customs = (settings.customHolidays || []).slice();
            customs.push({ name: message.name, start: message.start, end: message.end });
            customs.sort((a, b) => a.start.localeCompare(b.start));
            await chrome.storage.local.set({
                settings: Object.assign({}, settings, { customHolidays: customs })
            });
            await setupAlarms();
            return { success: true, customHolidays: customs };
        }

        case 'removeCustomHoliday': {
            const filtered = (settings.customHolidays || []).filter((_, i) => i !== message.index);
            await chrome.storage.local.set({
                settings: Object.assign({}, settings, { customHolidays: filtered })
            });
            await setupAlarms();
            return { success: true, customHolidays: filtered };
        }

        default:
            return { success: false, error: 'Unknown action: ' + message.action };
    }
}

/**
 * getStatus giờ KHÔNG ghi storage. Trước đây popup poll 1 giây/lần và mỗi
 * lần lại ghi lại dict timers -> ~1 write/giây suốt lúc popup mở.
 */
async function handleGetStatus(settings) {
    const workStatus = await getWorkStatus(settings);
    const timers = await getTimersFromAlarms();
    const log = await getWaterLog();

    return {
        success: true,
        workStatus,
        timers,
        suppressed: !!workStatus.suppressed,
        settings,
        water: { totalMl: log.totalMl || 0, goalMl: log.goalMl || settings.waterGoalMl },
        state: {
            focusEndTime: state.focusEndTime,
            pomodoroState: state.pomodoroState,
            pomodoroEndTime: state.pomodoroEndTime,
            pomodoroCount: state.pomodoroCount,
            idleState: state.idleState,
            meetingActive: state.meetingActive
        }
    };
}

/** Reset 1 timer = reschedule alarm THẬT (giữ periodInMinutes). */
async function handleResetTimer(timerType, settings) {
    const alarmName = INTERVAL_TO_ALARM[timerType];
    if (!alarmName) return { success: false, error: 'Unknown timer: ' + timerType };

    const minutes = settings.intervals[timerType];
    await chrome.alarms.clear(alarmName);
    chrome.alarms.create(alarmName, {
        when: Date.now() + minutes * 60000,
        periodInMinutes: minutes
    });
    return { success: true, timers: await getTimersFromAlarms() };
}

async function handleResetAllTimers(settings) {
    for (const [alarmName, key] of Object.entries(PERIODIC_ALARMS)) {
        const minutes = settings.intervals[key];
        await chrome.alarms.clear(alarmName);
        chrome.alarms.create(alarmName, {
            when: Date.now() + minutes * 60000,
            periodInMinutes: minutes
        });
    }
    return { success: true, timers: await getTimersFromAlarms() };
}

async function handleTogglePause(settings) {
    const isPaused = !settings.isPaused;
    await chrome.storage.local.set({
        settings: Object.assign({}, settings, { isPaused })
    });
    if (!isPaused) await handleResetAllTimers(settings);
    return { success: true, isPaused };
}

// ========================================
// Todo + Water
// ========================================

async function ensureTodoToday() {
    const { todoTasks } = await chrome.storage.local.get('todoTasks');
    const todayKey = Core.toLocalDateKey(new Date());
    if (!todoTasks || todoTasks.date !== todayKey) {
        await performTodoDailyReset();
    }
}

async function getWaterLog() {
    const todayKey = Core.toLocalDateKey(new Date());
    const data = await chrome.storage.local.get(['waterLog', 'settings']);
    const log = data.waterLog || {};
    const goalMl = (data.settings && data.settings.waterGoalMl) || DEFAULT_SETTINGS.waterGoalMl;

    if (log.date !== todayKey) {
        const newLog = { date: todayKey, totalMl: 0, entries: [], goalMl };
        await chrome.storage.local.set({ waterLog: newLog });
        return newLog;
    }
    return log;
}

async function addWater(ml) {
    const log = await getWaterLog();
    log.totalMl = (log.totalMl || 0) + ml;
    log.entries = log.entries || [];
    log.entries.push({ at: Date.now(), ml });
    await chrome.storage.local.set({ waterLog: log });
    return log;
}

/**
 * Thêm nước + chúc mừng khi vừa đạt mục tiêu.
 * Bug cũ: gọi showCustomNotification() — một hàm KHÔNG TỒN TẠI — nên
 * throw ReferenceError im lặng trong .then() và không bao giờ chúc mừng.
 */
async function addWaterAndCelebrate(ml, settings) {
    const before = await getWaterLog();
    const goal = (settings && settings.waterGoalMl) || before.goalMl || 2000;
    const wasBelow = (before.totalMl || 0) < goal;

    const log = await addWater(ml);

    if (wasBelow && log.totalMl >= goal && settings.notificationEnabled !== false) {
        showNotification('water_goal', {
            message: `Đã uống đủ ${goal}ml hôm nay. Tuyệt vời!`
        });
    }
    return log;
}

async function resetWaterToday() {
    const settings = await getSettings();
    const newLog = {
        date: Core.toLocalDateKey(new Date()),
        totalMl: 0, entries: [], goalMl: settings.waterGoalMl
    };
    await chrome.storage.local.set({ waterLog: newLog });
    return newLog;
}

async function undoLastWater() {
    const log = await getWaterLog();
    if (!log.entries || log.entries.length === 0) {
        return { success: false, error: 'Không có gì để hoàn tác' };
    }
    const last = log.entries.pop();
    log.totalMl = Math.max(0, (log.totalMl || 0) - last.ml);
    await chrome.storage.local.set({ waterLog: log });
    return { success: true, log };
}

async function performTodoDailyReset() {
    const data = await chrome.storage.local.get(['todoTasks', 'todoHistory']);
    const todoTasks = data.todoTasks;
    let todoHistory = data.todoHistory || {};
    const now = new Date();
    const todayKey = Core.toLocalDateKey(now);

    if (todoTasks && todoTasks.date === todayKey) return;

    // Lưu snapshot ngày cũ vào history (key ISO, sort được theo thời gian)
    if (todoTasks && todoTasks.tasks && todoTasks.tasks.length > 0) {
        const total = todoTasks.tasks.length;
        const completed = todoTasks.tasks.filter(t => t.completed).length;
        const prevDate = Core.parseAnyDateKey(todoTasks.date);
        const prevKey = prevDate ? Core.toLocalDateKey(prevDate) : todayKey;
        todoHistory[prevKey] = {
            total, completed,
            percentage: total > 0 ? Math.round((completed / total) * 100) : 0
        };
    }

    // Giữ task chưa xong (carry over) + task định kỳ
    let keptTasks = [];
    if (todoTasks && todoTasks.tasks) {
        keptTasks = todoTasks.tasks
            .filter(t => !t.completed || (t.frequency && t.frequency !== 'once'))
            .map(task => {
                if (!task.completed) return task;
                let reset = false;
                if (task.frequency === 'daily') reset = true;
                else if (task.frequency === 'weekly') reset = now.getDay() === 1;
                else if (task.frequency === 'monthly') reset = now.getDate() === 1;
                return reset
                    ? Object.assign({}, task, { completed: false, completedAt: null, completedEarly: false })
                    : task;
            });
    }

    // Prune theo THỜI GIAN và xoá hết phần dư (bug cũ sort alphabet, xoá 1 key)
    todoHistory = Core.migrateAndPruneHistory(todoHistory, 30);

    await chrome.storage.local.set({
        todoTasks: { date: todayKey, tasks: keptTasks },
        todoHistory
    });
}

async function handleTodoAddTask(task) {
    await ensureTodoToday();
    const { todoTasks } = await chrome.storage.local.get('todoTasks');
    const newTask = {
        id: 't_' + Date.now(),
        text: task.text,
        priority: task.priority || 'medium',
        frequency: task.frequency || 'once',
        completed: false,
        createdAt: Date.now(),
        completedAt: null
    };
    todoTasks.tasks.unshift(newTask);
    await chrome.storage.local.set({ todoTasks });
    return { success: true, task: newTask };
}

async function handleTodoToggleTask(taskId, earlyComplete = false) {
    await ensureTodoToday();
    const data = await chrome.storage.local.get(['todoTasks', 'todoHistory', 'todoSettings']);
    const { todoTasks } = data;

    const task = todoTasks.tasks.find(t => t.id === taskId);
    if (!task) return { success: false, error: 'Task not found' };

    task.completed = !task.completed;
    task.completedAt = task.completed ? Date.now() : null;
    if (earlyComplete && task.completed) task.completedEarly = true;
    else if (!task.completed) task.completedEarly = false;

    await chrome.storage.local.set({ todoTasks });

    // Snapshot hôm nay: dùng key ISO giống mọi chỗ khác
    const hist = data.todoHistory || {};
    const todayKey = Core.toLocalDateKey(new Date());
    const all = todoTasks.tasks;
    const active = all.filter(t => isTaskActiveToday(t));
    const earlyScheduled = all.filter(t => !isTaskActiveToday(t) && t.completedEarly);
    const total = active.length + earlyScheduled.length;
    const completed = active.filter(t => t.completed).length + earlyScheduled.length;
    hist[todayKey] = {
        total, completed,
        percentage: total > 0 ? Math.round((completed / total) * 100) : 0
    };
    await chrome.storage.local.set({ todoHistory: hist });

    // Streak: chỉ tăng khi đạt 100% task đang hoạt động
    let todoSettings = data.todoSettings || { streak: 0, bestStreak: 0, lastCompletedDate: null };
    if (active.length > 0 && active.every(t => t.completed)) {
        todoSettings = Core.bumpStreakOnComplete(todoSettings, new Date());
        await chrome.storage.local.set({ todoSettings });
    }

    return { success: true, task, todoSettings };
}

async function handleTodoDeleteTask(taskId) {
    await ensureTodoToday();
    const { todoTasks } = await chrome.storage.local.get('todoTasks');
    todoTasks.tasks = todoTasks.tasks.filter(t => t.id !== taskId);
    await chrome.storage.local.set({ todoTasks });
    return { success: true };
}

// ========================================
// YouTube Control Functions
// ========================================

/**
 * selectedTabId lưu vào storage.SESSION (không phải local): tab id chỉ có
 * nghĩa trong phiên trình duyệt hiện tại, sau khi restart Chrome cấp lại id
 * từ số nhỏ nên một id lưu ở local sẽ trỏ vào tab lạ.
 */
async function loadYoutubeSelection() {
    try {
        const { selectedYoutubeTabId } = await chrome.storage.session.get('selectedYoutubeTabId');
        if (selectedYoutubeTabId) youtubeState.selectedTabId = selectedYoutubeTabId;
    } catch (e) { /* storage.session không có thì bỏ qua */ }
    return youtubeState.selectedTabId;
}

async function saveYoutubeSelection(tabId) {
    youtubeState.selectedTabId = tabId;
    try {
        await chrome.storage.session.set({ selectedYoutubeTabId: tabId });
    } catch (e) { /* ignore */ }
}

/** Chỉ thao tác với tab YouTube thật — chặn inject vào tab lạ. */
async function assertYoutubeTab(tabId) {
    try {
        const tab = await chrome.tabs.get(tabId);
        if (!tab || !tab.url || !/^https?:\/\/([^/]*\.)?youtube\.com\//.test(tab.url)) {
            return null;
        }
        return tab;
    } catch (e) {
        return null;
    }
}

// Pause all YouTube tabs (dùng khi vào Focus mode)
async function pauseAllYoutubeTabs() {
    try {
        const tabs = await chrome.tabs.query({ url: ['*://www.youtube.com/*', '*://youtube.com/*'] });
        for (const tab of tabs) {
            try {
                await ensureContentScriptInjected(tab.id);
                const res = await chrome.tabs.sendMessage(tab.id, { action: 'youtube_getState' });
                if (res?.videoInfo?.isPlaying) {
                    await chrome.tabs.sendMessage(tab.id, { action: 'youtube_playPause' });
                }
            } catch (e) {
                // Tab chưa có video hoặc content script chưa sẵn sàng
            }
        }
    } catch (e) {
        console.log('[Focus] pauseAllYoutubeTabs:', e.message);
    }
}

/**
 * Bỏ `await sleep(500)` cứng của bản cũ: executeScript đã resolve sau khi
 * script chạy xong, nên chỉ cần ping lại một nhịp ngắn.
 */
async function ensureContentScriptInjected(tabId) {
    if (!(await assertYoutubeTab(tabId))) {
        return { success: false, error: 'Không phải tab YouTube' };
    }
    try {
        const res = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
        return { success: true, ready: res?.ready, injected: false };
    } catch (e) {
        try {
            await chrome.scripting.executeScript({
                target: { tabId },
                files: ['youtube-content.js']
            });
            return { success: true, ready: false, injected: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }
}

// Get YouTube state for selected tab
async function handleGetYoutubeState() {
    try {
        await loadYoutubeSelection();
        if (!youtubeState.selectedTabId) {
            return { success: true, hasYoutube: false, videoInfo: null };
        }

        // Tab phải còn tồn tại VÀ vẫn là YouTube
        if (!(await assertYoutubeTab(youtubeState.selectedTabId))) {
            await saveYoutubeSelection(null);
            return { success: true, hasYoutube: false, videoInfo: null };
        }

        const injection = await ensureContentScriptInjected(youtubeState.selectedTabId);
        if (!injection.success) {
            return {
                success: true,
                hasYoutube: true,
                tabId: youtubeState.selectedTabId,
                videoInfo: youtubeState.tabs[youtubeState.selectedTabId],
                error: injection.error
            };
        }

        try {
            const response = await chrome.tabs.sendMessage(
                youtubeState.selectedTabId, { action: 'youtube_getState' });
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
    await loadYoutubeSelection();
    const targetTabId = tabId || youtubeState.selectedTabId;

    // Focus mode chặn mọi điều khiển YouTube
    if (state.focusEndTime && Date.now() < state.focusEndTime) {
        return {
            success: false,
            error: 'Focus mode đang bật. Tắt Focus mode để điều khiển YouTube.',
            focusBlocked: true
        };
    }

    if (!targetTabId) return { success: false, error: 'Chưa chọn tab YouTube' };
    if (!(await assertYoutubeTab(targetTabId))) {
        return { success: false, error: 'Tab không còn là YouTube' };
    }

    const injection = await ensureContentScriptInjected(targetTabId);
    if (!injection.success) return { success: false, error: injection.error };

    try {
        return await chrome.tabs.sendMessage(targetTabId, {
            action: `youtube_${command}`,
            ...params
        });
    } catch (e) {
        return { success: false, error: e.message };
    }
}

// Get all YouTube tabs
async function handleGetAllYoutubeTabs() {
    try {
        const tabs = await chrome.tabs.query({ url: ['*://www.youtube.com/*', '*://youtube.com/*'] });

        if (tabs.length === 0) {
            await saveYoutubeSelection(null);
            return { success: true, tabs: [], selectedTabId: null };
        }

        await loadYoutubeSelection();

        // Hỏi song song thay vì tuần tự — bản cũ await từng tab một, mỗi
        // tab lỗi ping còn cộng thêm 500ms sleep.
        const tabsInfo = await Promise.all(tabs.map(async (tab) => {
            try {
                await ensureContentScriptInjected(tab.id);
                const res = await chrome.tabs.sendMessage(tab.id, { action: 'youtube_getState' });
                if (res?.videoInfo) youtubeState.tabs[tab.id] = res.videoInfo;
                return {
                    tabId: tab.id,
                    title: res?.videoInfo?.title || tab.title || 'YouTube',
                    isPlaying: res?.videoInfo?.isPlaying || false,
                    isActive: tab.active
                };
            } catch (e) {
                return {
                    tabId: tab.id,
                    title: tab.title || 'YouTube',
                    isPlaying: false,
                    isActive: tab.active
                };
            }
        }));

        if (!youtubeState.selectedTabId || !tabs.find(t => t.id === youtubeState.selectedTabId)) {
            await saveYoutubeSelection(tabs[0].id);
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
    if (!(await assertYoutubeTab(tabId))) {
        return { success: false, error: 'Không phải tab YouTube' };
    }
    await saveYoutubeSelection(tabId);
    return { success: true, selectedTabId: tabId };
}

// Close a YouTube tab
async function handleCloseYoutubeTab(tabId) {
    try {
        await chrome.tabs.remove(tabId);
        delete youtubeState.tabs[tabId];
        if (youtubeState.selectedTabId === tabId) await saveYoutubeSelection(null);
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

/**
 * Gửi thông tin video sang menubar app qua loopback.
 * LƯU Ý BẢO MẬT: menubar_app.py hiện trả dữ liệu này qua GET với
 * Access-Control-Allow-Origin: * nên mọi website đọc được. Đã thêm
 * X-WHR-Source để phía Python siết origin; xem README mục Bảo mật.
 */
async function notifyMenubarApp(videoInfo) {
    if (!videoInfo) return;
    try {
        await fetch(`http://localhost:${MENUBAR_HTTP_PORT}/youtube/state`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-WHR-Source': chrome.runtime.id
            },
            body: JSON.stringify(videoInfo)
        });
    } catch (e) {
        // Menubar app không chạy — bỏ qua
    }
}

chrome.tabs.onRemoved.addListener(async (tabId) => {
    if (youtubeState.tabs[tabId]) delete youtubeState.tabs[tabId];
    if (youtubeState.selectedTabId === tabId) await saveYoutubeSelection(null);
    await evaluateMeetingState();
});

// ========================================
// Keyboard shortcuts (chrome.commands)
// ========================================
// Tối đa 4 suggested_key — Chrome từ chối load manifest nếu nhiều hơn.
// Mọi lệnh là toggle để đủ 4 slot.

chrome.commands.onCommand.addListener(async (command) => {
    try {
        const settings = await getSettings();
        await loadState();

        if (command === 'add_water') {
            const ml = Number(settings.waterCupMl) || 200;
            const log = await addWaterAndCelebrate(ml, settings);
            const goal = log.goalMl || settings.waterGoalMl;
            showNotification('water_goal', {
                title: `💧 +${ml}ml`,
                message: `Hôm nay: ${log.totalMl}/${goal}ml`,
                actions: []
            });
            return;
        }

        if (command === 'toggle_focus') {
            if (state.focusEndTime && Date.now() < state.focusEndTime) {
                state.focusEndTime = null;
                await saveState();
            } else {
                state.focusEndTime = Date.now() + 30 * 60000;
                await saveState();
                await pauseAllYoutubeTabs();
            }
            await scheduleSessionEndAlarm();
            return;
        }

        if (command === 'toggle_pomodoro') {
            if (state.pomodoroState) {
                state.pomodoroState = null;
                state.pomodoroEndTime = null;
            } else {
                state.pomodoroState = 'work';
                state.pomodoroEndTime = Date.now() + settings.pomodoroWork * 60000;
            }
            await saveState();
            await scheduleSessionEndAlarm();
            return;
        }

        if (command === 'toggle_pause') {
            await handleTogglePause(settings);
        }
    } catch (e) {
        console.error('[command]', command, e);
    }
});

// ========================================
// Telegram Integration
// ========================================

/**
 * Báo cáo cuối ngày qua Telegram.
 * - Token/chat id có thể override (dùng cho nút Test, để popup không phải
 *   gọi saveSettings() rồi ghi đè toàn bộ interval như bug cũ).
 * - Có cờ lastReportSentDate để không gửi trùng, và reconcileDay() bù
 *   báo cáo bị bỏ nếu Chrome đang tắt lúc tới giờ.
 * - Có retry 1 lần với backoff; lỗi token/chat id thì không retry.
 */
async function sendTelegramReport(isTest = false, opts) {
    const cfg = opts || {};
    const settings = await getSettings();
    const token = cfg.overrideToken || settings.telegramBotToken;
    const chatId = cfg.overrideChatId || settings.telegramChatId;

    if (!token || !chatId) {
        return { success: false, error: 'Chưa cấu hình Telegram' };
    }

    await ensureTodoToday();
    const { todoTasks } = await chrome.storage.local.get('todoTasks');
    const allTasks = (todoTasks && todoTasks.tasks) || [];

    const activeTasks = allTasks.filter(t => isTaskActiveToday(t));
    const scheduledTasks = allTasks.filter(t => !isTaskActiveToday(t));

    const total = activeTasks.length;
    const completed = activeTasks.filter(t => t.completed).length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    const completedTasks = activeTasks.filter(t => t.completed);
    const pendingTasks = activeTasks.filter(t => !t.completed);

    const esc = Core.escapeTelegram;

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
    message += `📊 Tiến độ: ${percent}% (${completed}/${total})\n`;

    // Báo cáo giờ có cả nước + pomodoro, không chỉ todo như bản cũ
    const waterLog = await getWaterLog();
    const waterGoal = waterLog.goalMl || settings.waterGoalMl;
    const waterPct = waterGoal > 0 ? Math.round((waterLog.totalMl || 0) * 100 / waterGoal) : 0;
    message += `💧 Nước: ${waterPct}% (${waterLog.totalMl || 0}/${waterGoal}ml)\n`;
    await loadState();
    message += `🍅 Pomodoro: ${state.pomodoroCount || 0} phiên\n\n`;

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

    if (cfg.catchUpFor) {
        message = `⏰ <b>Báo cáo bù cho ngày ${esc(cfg.catchUpFor)}</b>\n\n` + message;
    }

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const body = JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' });

    // Gửi + retry 1 lần. Bug cũ: fail là mất báo cáo, không thử lại.
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body
            });
            const data = await response.json();

            if (data.ok) {
                if (!isTest) {
                    state.lastReportSentDate = cfg.catchUpFor || Core.toLocalDateKey(now);
                    await saveState();
                }
                return { success: true };
            }

            // Sai token / chat id thì retry vô nghĩa
            if (response.status === 400 || response.status === 401 || response.status === 404) {
                return { success: false, error: data.description || 'Bot Token hoặc Chat ID không đúng' };
            }
            if (attempt === 1) {
                console.error('Telegram API Error:', data);
                return { success: false, error: data.description };
            }
        } catch (e) {
            if (attempt === 1) {
                console.error('Network Error:', e);
                return { success: false, error: e.message };
            }
        }
        await new Promise(r => setTimeout(r, 2000));
    }
    return { success: false, error: 'Không gửi được sau 2 lần thử' };
}
