// Test tích hợp cho background.js (service worker) qua chrome stub.
// Mỗi test dưới đây khoá lại MỘT defect đã sửa, để không tái phát.
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { loadBackground, sendMessage, fireAlarm, runInstalled, runStartup } =
    require('./helpers/chrome-stub.js');

const PERIODIC = [
    'walk_reminder', 'water_reminder', 'toilet_reminder', 'eye_reminder',
    'blink_reminder', 'posture_reminder', 'neck_reminder',
    'eye_exercise_reminder', 'breathing_reminder'
];

/** Ngày làm việc, 09:00 — trong giờ làm, không lễ. 2026-08-19 là Thứ Tư. */
function useWorkdayClock() {
    const RealDate = Date;
    const fixed = new RealDate(2026, 7, 19, 9, 0, 0);
    class FakeDate extends RealDate {
        constructor(...args) {
            if (args.length === 0) return new RealDate(fixed.getTime());
            return new RealDate(...args);
        }
        static now() { return fixed.getTime(); }
    }
    global.Date = FakeDate;
    return () => { global.Date = RealDate; };
}

async function boot(opts) {
    const bg = loadBackground(opts);
    await runInstalled(bg);
    return bg;
}

// ── D1: showCustomNotification không tồn tại ────────────────────────────

test('D1: đạt mục tiêu nước gửi được thông báo chúc mừng (bug cũ ReferenceError)', async () => {
    const bg = await boot();
    await sendMessage(bg, { action: 'updateSettings', settings: { waterGoalMl: 400 } });

    await sendMessage(bg, { action: 'addWater', ml: 200 });
    assert.ok(!bg.created.some(n => n.id === 'whr_water_goal'), 'chưa đủ thì chưa chúc mừng');

    const res = await sendMessage(bg, { action: 'addWater', ml: 200 });
    assert.strictEqual(res.success, true);
    assert.ok(bg.created.some(n => n.id === 'whr_water_goal'), 'đủ mục tiêu phải chúc mừng');
});

test('D1: không chúc mừng 2 lần trong cùng ngày', async () => {
    const bg = await boot();
    await sendMessage(bg, { action: 'updateSettings', settings: { waterGoalMl: 200 } });
    await sendMessage(bg, { action: 'addWater', ml: 200 });
    const first = bg.created.filter(n => n.id === 'whr_water_goal').length;
    await sendMessage(bg, { action: 'addWater', ml: 200 });
    const second = bg.created.filter(n => n.id === 'whr_water_goal').length;
    assert.strictEqual(first, second, 'chỉ chúc mừng lần đầu vượt mốc');
});

// ── G1b / ISSUE-1: save settings KHÔNG được phá bộ alarm ────────────────

test('G1b: lưu settings chỉ với 4 interval vẫn giữ đủ 9 alarm định kỳ', async () => {
    const bg = await boot();
    const before = (await bg.chrome.alarms.getAll()).map(a => a.name).sort();

    // Mô phỏng đúng bug: popup gửi thiếu 5 interval
    const res = await sendMessage(bg, {
        action: 'updateSettings',
        settings: { intervals: { walk: 45, water: 45, eye_20_20_20: 20, posture: 45 } }
    });
    assert.strictEqual(res.success, true);

    const after = (await bg.chrome.alarms.getAll()).map(a => a.name).sort();
    assert.deepStrictEqual(after, before, 'tập tên alarm phải không đổi');
    for (const name of PERIODIC) {
        assert.ok(after.includes(name), `thiếu alarm ${name}`);
    }
});

test('G1b: 5 interval không gửi lên vẫn giữ nguyên giá trị cũ (deep merge)', async () => {
    const bg = await boot();
    const orig = (await sendMessage(bg, { action: 'getSettings' })).settings.intervals;

    await sendMessage(bg, {
        action: 'updateSettings',
        settings: { intervals: { walk: 45 } }
    });

    const now = (await sendMessage(bg, { action: 'getSettings' })).settings.intervals;
    assert.strictEqual(now.walk, 45);
    assert.strictEqual(now.blink, orig.blink, 'blink không được thành undefined');
    assert.strictEqual(now.breathing, orig.breathing);
    assert.strictEqual(now.toilet, orig.toilet);
});

test('interval rác không làm sập setupAlarms', async () => {
    const bg = await boot();
    await sendMessage(bg, {
        action: 'updateSettings',
        settings: { intervals: { walk: 0, water: NaN, blink: 'abc', toilet: -5 } }
    });
    const alarms = await bg.chrome.alarms.getAll();
    for (const name of PERIODIC) {
        const a = alarms.find(x => x.name === name);
        assert.ok(a, `thiếu ${name}`);
        assert.ok(Number.isFinite(a.periodInMinutes) && a.periodInMinutes >= 1,
            `${name} có period không hợp lệ: ${a.periodInMinutes}`);
    }
});

test('alarm giờ cố định vẫn tồn tại sau khi save settings', async () => {
    const restore = useWorkdayClock();
    try {
        const bg = await boot();
        await sendMessage(bg, {
            action: 'updateSettings',
            settings: { intervals: { walk: 45 } }
        });
        const names = (await bg.chrome.alarms.getAll()).map(a => a.name);
        assert.ok(names.includes('lunch_reminder'), 'phải còn alarm nghỉ trưa');
        assert.ok(names.includes('end_work_reminder'), 'phải còn alarm hết giờ làm');
    } finally { restore(); }
});

// ── D4: save settings KHÔNG re-phase alarm không đổi ────────────────────

test('D4: interval không đổi thì scheduledTime giữ nguyên (không reset đồng hồ)', async () => {
    const bg = await boot();
    const before = (await bg.chrome.alarms.getAll())
        .filter(a => a.name === 'walk_reminder')[0];

    await new Promise(r => setTimeout(r, 20));
    await sendMessage(bg, { action: 'updateSettings', settings: { waterGoalMl: 2500 } });

    const after = (await bg.chrome.alarms.getAll())
        .filter(a => a.name === 'walk_reminder')[0];
    assert.strictEqual(after.scheduledTime, before.scheduledTime,
        'alarm không liên quan không được đặt lại');
});

test('D4: chỉ alarm có interval đổi mới bị reschedule', async () => {
    const bg = await boot();
    const before = await bg.chrome.alarms.getAll();
    const waterBefore = before.find(a => a.name === 'water_reminder').scheduledTime;
    const walkBefore = before.find(a => a.name === 'walk_reminder').scheduledTime;

    await new Promise(r => setTimeout(r, 20));
    await sendMessage(bg, { action: 'updateSettings', settings: { intervals: { walk: 33 } } });

    const after = await bg.chrome.alarms.getAll();
    assert.strictEqual(after.find(a => a.name === 'water_reminder').scheduledTime, waterBefore);
    assert.notStrictEqual(after.find(a => a.name === 'walk_reminder').scheduledTime, walkBefore);
    assert.strictEqual(after.find(a => a.name === 'walk_reminder').periodInMinutes, 33);
});

// ── B2: resetTimer phải giữ periodInMinutes ─────────────────────────────

test('B2: reset timer vẫn là alarm lặp lại, không thành one-shot', async () => {
    const bg = await boot();
    const res = await sendMessage(bg, { action: 'resetTimer', timerType: 'walk' });
    assert.strictEqual(res.success, true);

    const alarm = await bg.chrome.alarms.get('walk_reminder');
    assert.ok(alarm.periodInMinutes > 0,
        'thiếu periodInMinutes -> nhắc nhở sẽ chết im lặng sau 1 lần');
});

test('resetAll giữ periodInMinutes cho cả 9 alarm', async () => {
    const bg = await boot();
    await sendMessage(bg, { action: 'resetAll' });
    for (const name of PERIODIC) {
        const a = await bg.chrome.alarms.get(name);
        assert.ok(a && a.periodInMinutes > 0, `${name} mất periodInMinutes`);
    }
});

// ── D25: notificationEnabled phải chặn TẤT CẢ ───────────────────────────

test('G1c/D25a: tắt thông báo thì nhắc giờ cố định cũng không gửi', async () => {
    const restore = useWorkdayClock();
    try {
        const bg = await boot();
        await sendMessage(bg, {
            action: 'updateSettings',
            settings: { notificationEnabled: false }
        });
        bg.created.length = 0;

        for (const name of ['lunch_reminder', 'end_work_reminder', 'night_mode_reminder',
                            'sleep_reminder', 'morning_reminder', 'todo_reminder',
                            'todo_start_reminder', 'walk_reminder']) {
            await fireAlarm(bg, name);
        }
        assert.strictEqual(bg.created.length, 0,
            'tắt thông báo mà vẫn gửi: ' + bg.created.map(n => n.id).join(','));
    } finally { restore(); }
});

test('D25b: hết giờ làm KHÔNG nhắc vào cuối tuần', async () => {
    const RealDate = Date;
    // 2026-08-22 là Thứ Bảy
    const sat = new RealDate(2026, 7, 22, 17, 30, 0);
    class FakeDate extends RealDate {
        constructor(...a) { return a.length ? new RealDate(...a) : new RealDate(sat.getTime()); }
        static now() { return sat.getTime(); }
    }
    global.Date = FakeDate;
    try {
        const bg = await boot();
        bg.created.length = 0;
        await fireAlarm(bg, 'end_work_reminder');
        assert.ok(!bg.created.some(n => n.id === 'whr_end_work'),
            'T7 không được nhắc "Hết giờ làm việc"');
    } finally { global.Date = RealDate; }
});

test('D25b: hết giờ làm CÓ nhắc vào ngày làm việc', async () => {
    const RealDate = Date;
    const wed = new RealDate(2026, 7, 19, 17, 30, 0);
    class FakeDate extends RealDate {
        constructor(...a) { return a.length ? new RealDate(...a) : new RealDate(wed.getTime()); }
        static now() { return wed.getTime(); }
    }
    global.Date = FakeDate;
    try {
        const bg = await boot();
        bg.created.length = 0;
        await fireAlarm(bg, 'end_work_reminder');
        assert.ok(bg.created.some(n => n.id === 'whr_end_work'), 'T4 phải nhắc');
    } finally { global.Date = RealDate; }
});

// ── Suppression: nghỉ trưa / ngoài giờ / idle / họp ──────────────────────

test('không nhắc định kỳ trong giờ nghỉ trưa', async () => {
    const RealDate = Date;
    const noon = new RealDate(2026, 7, 19, 12, 0, 0);
    class FakeDate extends RealDate {
        constructor(...a) { return a.length ? new RealDate(...a) : new RealDate(noon.getTime()); }
        static now() { return noon.getTime(); }
    }
    global.Date = FakeDate;
    try {
        const bg = await boot();
        bg.created.length = 0;
        await fireAlarm(bg, 'walk_reminder');
        assert.strictEqual(bg.created.length, 0);

        const status = await sendMessage(bg, { action: 'getStatus' });
        assert.strictEqual(status.suppressed, true);
        assert.match(status.workStatus.label, /Nghỉ trưa/);
    } finally { global.Date = RealDate; }
});

test('G4: idle chặn nhắc nhở và popup thấy được lý do', async () => {
    const restore = useWorkdayClock();
    try {
        const bg = await boot();
        bg.chrome.idle._state = 'idle';
        for (const fn of bg.listeners.idle) await fn('idle');

        bg.created.length = 0;
        await fireAlarm(bg, 'walk_reminder');
        assert.strictEqual(bg.created.length, 0, 'đang idle mà vẫn nhắc');

        const status = await sendMessage(bg, { action: 'getStatus' });
        assert.strictEqual(status.workStatus.status, 'idle');
        assert.strictEqual(status.suppressed, true);
    } finally { restore(); }
});

test('G4: máy khoá cũng chặn nhắc nhở', async () => {
    const restore = useWorkdayClock();
    try {
        const bg = await boot();
        for (const fn of bg.listeners.idle) await fn('locked');
        bg.created.length = 0;
        await fireAlarm(bg, 'walk_reminder');
        assert.strictEqual(bg.created.length, 0);
    } finally { restore(); }
});

test('G4: tab Meet đang phát tiếng -> tự tắt nhắc (không cần calendar)', async () => {
    const restore = useWorkdayClock();
    try {
        const bg = await boot();
        bg.chrome.tabs._tabs = [
            { id: 1, url: 'https://meet.google.com/abc-defg-hij', audible: true }
        ];
        bg.created.length = 0;
        await fireAlarm(bg, 'walk_reminder');
        assert.strictEqual(bg.created.length, 0, 'đang họp mà vẫn nhắc');

        const status = await sendMessage(bg, { action: 'getStatus' });
        assert.strictEqual(status.state.meetingActive, true);
    } finally { restore(); }
});

test('tab YouTube phát tiếng KHÔNG bị coi là họp', async () => {
    const restore = useWorkdayClock();
    try {
        const bg = await boot();
        bg.chrome.tabs._tabs = [
            { id: 1, url: 'https://www.youtube.com/watch?v=x', audible: true }
        ];
        bg.created.length = 0;
        await fireAlarm(bg, 'walk_reminder');
        assert.ok(bg.created.some(n => n.id === 'whr_walk'), 'YouTube không phải họp');
    } finally { restore(); }
});

test('tắt meetingAutoFocus thì tab Meet không còn chặn', async () => {
    const restore = useWorkdayClock();
    try {
        const bg = await boot();
        await sendMessage(bg, {
            action: 'updateSettings', settings: { meetingAutoFocus: false }
        });
        bg.chrome.tabs._tabs = [
            { id: 1, url: 'https://meet.google.com/x', audible: true }
        ];
        bg.created.length = 0;
        await fireAlarm(bg, 'walk_reminder');
        assert.ok(bg.created.some(n => n.id === 'whr_walk'));
    } finally { restore(); }
});

// ── D14: notification id ổn định theo loại ──────────────────────────────

test('D14: nhắc cùng loại THAY THẾ thông báo cũ, không xếp đống', async () => {
    const restore = useWorkdayClock();
    try {
        const bg = await boot();
        await fireAlarm(bg, 'walk_reminder');
        await fireAlarm(bg, 'walk_reminder');
        await fireAlarm(bg, 'walk_reminder');
        const walk = bg.notifications.filter(n => n.id === 'whr_walk');
        assert.strictEqual(walk.length, 1, 'phải chỉ còn 1 thông báo đi bộ');
    } finally { restore(); }
});

// ── C3: nút trên notification ───────────────────────────────────────────

test('C3: notification nhắc nhở có nút bấm (tối đa 2)', async () => {
    const restore = useWorkdayClock();
    try {
        const bg = await boot();
        await fireAlarm(bg, 'walk_reminder');
        const n = bg.notifications.find(x => x.id === 'whr_walk');
        assert.ok(n.options.buttons && n.options.buttons.length > 0, 'phải có nút');
        assert.ok(n.options.buttons.length <= 2, 'Chrome chỉ cho 2 nút');
    } finally { restore(); }
});

test('C3: nút "+1 ly" ghi nước ngay từ notification', async () => {
    const restore = useWorkdayClock();
    try {
        const bg = await boot();
        await fireAlarm(bg, 'water_reminder');
        const before = (await sendMessage(bg, { action: 'getWaterLog' })).log.totalMl;

        // Nút 0 của water là ACTION.WATER_CUP
        for (const fn of bg.listeners.notifButton) await fn('whr_water', 0);

        const after = (await sendMessage(bg, { action: 'getWaterLog' })).log.totalMl;
        assert.ok(after > before, `nước phải tăng: ${before} -> ${after}`);
    } finally { restore(); }
});

test('C3: nút snooze tạo alarm hoãn lại', async () => {
    const restore = useWorkdayClock();
    try {
        const bg = await boot();
        await fireAlarm(bg, 'walk_reminder');
        // Nút 1 của walk là ACTION.SNOOZE
        for (const fn of bg.listeners.notifButton) await fn('whr_walk', 1);

        const snooze = await bg.chrome.alarms.get('snooze_walk');
        assert.ok(snooze, 'phải có alarm snooze_walk');
        assert.ok(snooze.scheduledTime > Date.now(), 'snooze phải ở tương lai');
    } finally { restore(); }
});

test('C3: nút "Đã làm" đẩy lần nhắc kế tiếp và giữ chu kỳ', async () => {
    const restore = useWorkdayClock();
    try {
        const bg = await boot();
        await fireAlarm(bg, 'walk_reminder');
        for (const fn of bg.listeners.notifButton) await fn('whr_walk', 0);

        const a = await bg.chrome.alarms.get('walk_reminder');
        assert.ok(a.periodInMinutes > 0, 'vẫn phải là alarm lặp lại');
        assert.ok(a.scheduledTime > Date.now());
    } finally { restore(); }
});

test('snooze gửi lại nhắc nhở khi alarm snooze nổ', async () => {
    const restore = useWorkdayClock();
    try {
        const bg = await boot();
        bg.created.length = 0;
        await fireAlarm(bg, 'snooze_walk');
        assert.ok(bg.created.some(n => n.id === 'whr_walk'), 'snooze phải nhắc lại');
    } finally { restore(); }
});

// ── D24: cờ ngày không được kẹt ─────────────────────────────────────────

test('D24: cờ ngày được reset khi startup sang ngày mới (Chrome tắt qua đêm)', async () => {
    const restore = useWorkdayClock();
    try {
        const bg = await boot();

        // Giả lập trạng thái hôm qua: đã nhắc hết, cờ đang true
        bg.store.local.state = Object.assign({}, bg.store.local.state, {
            nightModeReminded: true,
            sleepReminded: true,
            morningReminded: true,
            lastDailyResetDate: '2026-08-18'
        });

        await runStartup(bg);

        const st = bg.store.local.state;
        assert.strictEqual(st.nightModeReminded, false, 'cờ night mode phải được reset');
        assert.strictEqual(st.sleepReminded, false);
        assert.strictEqual(st.morningReminded, false);
        assert.strictEqual(st.lastDailyResetDate, '2026-08-19');
    } finally { restore(); }
});

test('D24: nhắc ngủ hoạt động lại sau khi sang ngày mới', async () => {
    const restore = useWorkdayClock();
    try {
        const bg = await boot();
        bg.store.local.state = Object.assign({}, bg.store.local.state, {
            sleepReminded: true, lastDailyResetDate: '2026-08-18'
        });
        bg.created.length = 0;

        await fireAlarm(bg, 'sleep_reminder');
        assert.ok(bg.created.some(n => n.id === 'whr_sleep'),
            'sang ngày mới phải nhắc ngủ lại được');
    } finally { restore(); }
});

test('reconcile không chạy 2 lần trong cùng ngày', async () => {
    const restore = useWorkdayClock();
    try {
        const bg = await boot();
        await fireAlarm(bg, 'sleep_reminder');   // set sleepReminded = true
        await fireAlarm(bg, 'walk_reminder');    // reconcile lại
        assert.strictEqual(bg.store.local.state.sleepReminded, true,
            'cùng ngày thì không được reset cờ');
    } finally { restore(); }
});

// ── D20: báo cáo Telegram — cờ đã gửi + bù + retry ──────────────────────

test('D20: báo cáo ghi nhận đã gửi hôm nay', async () => {
    const restore = useWorkdayClock();
    try {
        const bg = await boot({
            fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) })
        });
        await sendMessage(bg, {
            action: 'updateSettings',
            settings: { telegramBotToken: 'tok', telegramChatId: '123' }
        });

        await fireAlarm(bg, 'daily_report');
        assert.strictEqual(bg.store.local.state.lastReportSentDate, '2026-08-19');
    } finally { restore(); }
});

test('D20: startup sang ngày mới thì bù báo cáo hôm qua', async () => {
    const restore = useWorkdayClock();
    try {
        const bg = await boot({
            fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) })
        });
        await sendMessage(bg, {
            action: 'updateSettings',
            settings: { telegramBotToken: 'tok', telegramChatId: '123' }
        });
        bg.store.local.state = Object.assign({}, bg.store.local.state, {
            lastDailyResetDate: '2026-08-18',
            lastReportSentDate: null
        });
        bg.fetchCalls.length = 0;

        await runStartup(bg);

        const sent = bg.fetchCalls.filter(c => String(c.url).includes('api.telegram.org'));
        assert.ok(sent.length >= 1, 'phải gửi bù báo cáo hôm qua');
        assert.match(sent[0].init.body, /Báo cáo bù/);
    } finally { restore(); }
});

test('D20: lỗi mạng thì retry, không mất báo cáo ngay', async () => {
    const restore = useWorkdayClock();
    try {
        let calls = 0;
        const bg = await boot({
            fetchImpl: async () => {
                calls++;
                if (calls === 1) throw new Error('network down');
                return { ok: true, status: 200, json: async () => ({ ok: true }) };
            }
        });
        await sendMessage(bg, {
            action: 'updateSettings',
            settings: { telegramBotToken: 'tok', telegramChatId: '123' }
        });
        const res = await sendMessage(bg, { action: 'testTelegram' });
        assert.strictEqual(res.success, true, 'phải thành công ở lần thử 2');
        assert.strictEqual(calls, 2);
    } finally { restore(); }
});

test('D20: token sai thì KHÔNG retry (retry vô nghĩa)', async () => {
    const restore = useWorkdayClock();
    try {
        let calls = 0;
        const bg = await boot({
            fetchImpl: async () => {
                calls++;
                return {
                    ok: false, status: 401,
                    json: async () => ({ ok: false, description: 'Unauthorized' })
                };
            }
        });
        const res = await sendMessage(bg, {
            action: 'testTelegram', botToken: 'bad', chatId: '1'
        });
        assert.strictEqual(res.success, false);
        assert.strictEqual(calls, 1, 'token sai thì chỉ thử 1 lần');
    } finally { restore(); }
});

// ── D28: nút Test Telegram không được ghi đè interval ───────────────────

test('D28: test Telegram KHÔNG làm đổi interval', async () => {
    const restore = useWorkdayClock();
    try {
        const bg = await boot({
            fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) })
        });
        await sendMessage(bg, {
            action: 'updateSettings', settings: { intervals: { walk: 37 } }
        });
        const before = (await sendMessage(bg, { action: 'getSettings' })).settings.intervals;

        await sendMessage(bg, { action: 'testTelegram', botToken: 'tok', chatId: '123' });

        const after = (await sendMessage(bg, { action: 'getSettings' })).settings.intervals;
        assert.deepStrictEqual(after, before, 'test Telegram không được đổi interval');
        assert.strictEqual(after.walk, 37);
    } finally { restore(); }
});

test('D28: test Telegram không lưu token vào settings', async () => {
    const bg = await boot({
        fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) })
    });
    await sendMessage(bg, { action: 'testTelegram', botToken: 'temp-tok', chatId: '999' });
    const s = (await sendMessage(bg, { action: 'getSettings' })).settings;
    assert.strictEqual(s.telegramBotToken, '', 'token thử nghiệm không được ghi vào settings');
});

// ── G2: getStatus không ghi storage ─────────────────────────────────────

test('G2: getStatus không tạo/ghi dict timers (bản cũ ~1 write/giây)', async () => {
    const restore = useWorkdayClock();
    try {
        const bg = await boot();
        for (let i = 0; i < 10; i++) await sendMessage(bg, { action: 'getStatus' });
        assert.strictEqual(bg.store.local.timers, undefined,
            'không được còn hệ shadow timer');
        assert.strictEqual(bg.store.local.lastUpdate, undefined);
    } finally { restore(); }
});

test('G3: đếm ngược lấy từ chrome.alarms, khớp scheduledTime', async () => {
    const restore = useWorkdayClock();
    try {
        const bg = await boot();
        const status = await sendMessage(bg, { action: 'getStatus' });
        const alarm = await bg.chrome.alarms.get('walk_reminder');
        const expected = Math.round((alarm.scheduledTime - Date.now()) / 1000);
        assert.ok(Math.abs(status.timers.walk - expected) <= 1,
            `đếm ngược lệch: ${status.timers.walk} vs ${expected}`);
    } finally { restore(); }
});

// ── Water pace ──────────────────────────────────────────────────────────

test('C6: đang đúng tiến độ nước thì KHÔNG nhắc', async () => {
    const RealDate = Date;
    const noon = new RealDate(2026, 7, 19, 14, 0, 0);
    class FakeDate extends RealDate {
        constructor(...a) { return a.length ? new RealDate(...a) : new RealDate(noon.getTime()); }
        static now() { return noon.getTime(); }
    }
    global.Date = FakeDate;
    try {
        const bg = await boot();
        await sendMessage(bg, { action: 'addWater', ml: 1200 });
        bg.created.length = 0;
        await fireAlarm(bg, 'water_reminder');
        assert.ok(!bg.created.some(n => n.id === 'whr_water'),
            'uống đủ theo tiến độ thì không nên nhắc');
    } finally { global.Date = RealDate; }
});

test('C6: tụt tiến độ nước thì nhắc, kèm số ml còn thiếu', async () => {
    const RealDate = Date;
    const late = new RealDate(2026, 7, 19, 16, 0, 0);
    class FakeDate extends RealDate {
        constructor(...a) { return a.length ? new RealDate(...a) : new RealDate(late.getTime()); }
        static now() { return late.getTime(); }
    }
    global.Date = FakeDate;
    try {
        const bg = await boot();
        bg.created.length = 0;
        await fireAlarm(bg, 'water_reminder');
        const n = bg.created.find(x => x.id === 'whr_water');
        assert.ok(n, 'tụt tiến độ phải nhắc');
        assert.match(n.options.message, /ml/);
    } finally { global.Date = RealDate; }
});

test('tắt waterPaceMode thì nhắc nước theo interval như cũ', async () => {
    const RealDate = Date;
    const noon = new RealDate(2026, 7, 19, 14, 0, 0);
    class FakeDate extends RealDate {
        constructor(...a) { return a.length ? new RealDate(...a) : new RealDate(noon.getTime()); }
        static now() { return noon.getTime(); }
    }
    global.Date = FakeDate;
    try {
        const bg = await boot();
        await sendMessage(bg, { action: 'updateSettings', settings: { waterPaceMode: false } });
        await sendMessage(bg, { action: 'addWater', ml: 5000 });
        bg.created.length = 0;
        await fireAlarm(bg, 'water_reminder');
        assert.ok(bg.created.some(n => n.id === 'whr_water'));
    } finally { global.Date = RealDate; }
});

// ── D7: history dùng key ISO và prune theo thời gian ────────────────────

test('D7: migration đổi key toDateString sang YYYY-MM-DD', async () => {
    const restore = useWorkdayClock();
    try {
        const bg = loadBackground();
        bg.store.local.settings = { intervals: {} };
        bg.store.local.todoHistory = {
            'Tue Jul 07 2026': { total: 1, completed: 1, percentage: 100 },
            'Sun Aug 23 2026': { total: 2, completed: 1, percentage: 50 }
        };
        await runStartup(bg);

        const keys = Object.keys(bg.store.local.todoHistory).sort();
        assert.deepStrictEqual(keys, ['2026-07-07', '2026-08-23']);
    } finally { restore(); }
});

test('migration xoá hệ shadow timer cũ', async () => {
    const restore = useWorkdayClock();
    try {
        const bg = loadBackground();
        bg.store.local.settings = { intervals: {} };
        bg.store.local.timers = { walk: 100 };
        bg.store.local.lastUpdate = Date.now();
        await runStartup(bg);
        assert.strictEqual(bg.store.local.timers, undefined);
        assert.strictEqual(bg.store.local.lastUpdate, undefined);
    } finally { restore(); }
});

test('migration đưa blink=2 (default cũ gây spam) về giá trị mới', async () => {
    const restore = useWorkdayClock();
    try {
        const bg = loadBackground();
        bg.store.local.settings = { intervals: { blink: 2, walk: 30 } };
        await runStartup(bg);
        assert.ok(bg.store.local.settings.intervals.blink > 5,
            'blink 2 phút phải được nâng lên');
        assert.strictEqual(bg.store.local.settings.intervals.walk, 30,
            'giá trị user tự chỉnh khác thì giữ nguyên');
    } finally { restore(); }
});

test('migration chỉ chạy 1 lần (idempotent)', async () => {
    const restore = useWorkdayClock();
    try {
        const bg = loadBackground();
        bg.store.local.settings = { intervals: {} };
        await runStartup(bg);
        const v = bg.store.local.schemaVersion;
        bg.store.local.settings.intervals.walk = 99;
        await runStartup(bg);
        assert.strictEqual(bg.store.local.schemaVersion, v);
        assert.strictEqual(bg.store.local.settings.intervals.walk, 99,
            'migration lần 2 không được ghi đè');
    } finally { restore(); }
});

// ── D8: streak đứt được ─────────────────────────────────────────────────

test('D8: bỏ 1 ngày thì streak reset về 0 khi sang ngày mới', async () => {
    const restore = useWorkdayClock();
    try {
        const bg = await boot();
        bg.store.local.todoSettings = {
            streak: 7, bestStreak: 9, lastCompletedDate: '2026-08-15'
        };
        bg.store.local.state = Object.assign({}, bg.store.local.state, {
            lastDailyResetDate: '2026-08-18'
        });

        await runStartup(bg);

        assert.strictEqual(bg.store.local.todoSettings.streak, 0);
        assert.strictEqual(bg.store.local.todoSettings.bestStreak, 9, 'best phải giữ');
    } finally { restore(); }
});

test('D8: hoàn thành 100% task thì streak tăng', async () => {
    const restore = useWorkdayClock();
    try {
        const bg = await boot();
        const add = await sendMessage(bg, {
            action: 'addTodo', task: { text: 'task 1', priority: 'high', frequency: 'once' }
        });
        await sendMessage(bg, { action: 'toggleTodo', taskId: add.task.id });
        assert.strictEqual(bg.store.local.todoSettings.streak, 1);
    } finally { restore(); }
});

// ── D9 / A6: selectedTabId lưu ở storage.session ────────────────────────

test('A6: tab YouTube đang chọn lưu vào storage.session, không phải local', async () => {
    const bg = await boot();
    bg.chrome.tabs._tabs = [{ id: 42, url: 'https://www.youtube.com/watch?v=a', audible: false }];

    const res = await sendMessage(bg, { action: 'selectYoutubeTab', tabId: 42 });
    assert.strictEqual(res.success, true);
    assert.strictEqual(bg.store.session.selectedYoutubeTabId, 42);
    assert.strictEqual(bg.store.local.selectedYoutubeTabId, undefined,
        'tab id không được lưu vào local (id bị cấp lại sau restart)');
});

test('A6: không cho chọn tab KHÔNG phải YouTube (chặn inject vào tab lạ)', async () => {
    const bg = await boot();
    bg.chrome.tabs._tabs = [{ id: 7, url: 'https://mail.google.com/', audible: false }];
    const res = await sendMessage(bg, { action: 'selectYoutubeTab', tabId: 7 });
    assert.strictEqual(res.success, false);
});

test('A6: điều khiển YouTube từ chối tab không phải YouTube', async () => {
    const bg = await boot();
    bg.chrome.tabs._tabs = [{ id: 9, url: 'https://internal.bank.example/', audible: false }];
    const res = await sendMessage(bg, {
        action: 'youtubeControl', command: 'playPause', tabId: 9
    });
    assert.strictEqual(res.success, false);
});

// ── D10 / G8: không còn alarm poll 30 giây ──────────────────────────────

test('D10/G8: không tạo alarm poll dày (pomodoro_check / status_check)', async () => {
    const bg = await boot();
    const names = (await bg.chrome.alarms.getAll()).map(a => a.name);
    assert.ok(!names.includes('pomodoro_check'), 'không được còn poll pomodoro 30s');
    assert.ok(!names.includes('status_check'), 'không được còn poll status mỗi phút');
});

test('Focus dùng alarm one-shot đúng lúc kết thúc', async () => {
    const bg = await boot();
    await sendMessage(bg, { action: 'startFocus', minutes: 25 });
    const a = await bg.chrome.alarms.get('session_end');
    assert.ok(a, 'phải có alarm session_end');
    assert.ok(!a.periodInMinutes, 'session_end phải là one-shot');
    assert.ok(a.scheduledTime > Date.now());
});

test('dừng Focus thì xoá alarm session_end', async () => {
    const bg = await boot();
    await sendMessage(bg, { action: 'startFocus', minutes: 25 });
    await sendMessage(bg, { action: 'stopFocus' });
    assert.strictEqual(await bg.chrome.alarms.get('session_end'), undefined);
});

test('Pomodoro: hết giờ làm thì tự chuyển sang nghỉ', async () => {
    const bg = await boot();
    await sendMessage(bg, { action: 'startPomodoro' });
    bg.store.local.state.pomodoroEndTime = Date.now() - 1000;

    await fireAlarm(bg, 'session_end');

    assert.strictEqual(bg.store.local.state.pomodoroState, 'break');
    assert.ok(bg.created.some(n => n.id === 'whr_pomodoro_work_end'));
});

// ── Focus/Pomodoro chặn nhắc định kỳ ────────────────────────────────────

test('Focus mode chặn nhắc định kỳ', async () => {
    const restore = useWorkdayClock();
    try {
        const bg = await boot();
        await sendMessage(bg, { action: 'startFocus', minutes: 30 });
        bg.created.length = 0;
        await fireAlarm(bg, 'walk_reminder');
        assert.strictEqual(bg.created.length, 0);
    } finally { restore(); }
});

test('Focus mode chặn điều khiển YouTube', async () => {
    const bg = await boot();
    bg.chrome.tabs._tabs = [{ id: 1, url: 'https://www.youtube.com/watch?v=a' }];
    await sendMessage(bg, { action: 'selectYoutubeTab', tabId: 1 });
    await sendMessage(bg, { action: 'startFocus', minutes: 30 });

    const res = await sendMessage(bg, { action: 'youtubeControl', command: 'playPause' });
    assert.strictEqual(res.focusBlocked, true);
});

// ── Diagnostics ─────────────────────────────────────────────────────────

test('getDiagnostics trả về alarm, ngân sách thông báo và cảnh báo lễ', async () => {
    const restore = useWorkdayClock();
    try {
        const bg = await boot();
        const d = await sendMessage(bg, { action: 'getDiagnostics' });
        assert.strictEqual(d.success, true);
        assert.ok(Array.isArray(d.alarms) && d.alarms.length > 0);
        assert.ok(typeof d.actionNotificationsPerDay === 'number');
        assert.ok(Array.isArray(d.errorLog));
    } finally { restore(); }
});

test('G5: errorLog rỗng sau một ngày mô phỏng', async () => {
    const restore = useWorkdayClock();
    try {
        const bg = await boot();
        for (const name of [...PERIODIC, 'lunch_reminder', 'end_work_reminder',
                            'sleep_reminder', 'night_mode_reminder', 'morning_reminder',
                            'todo_reminder', 'todo_start_reminder', 'daily_rollover']) {
            await fireAlarm(bg, name);
        }
        await sendMessage(bg, { action: 'addWater', ml: 200 });
        await sendMessage(bg, { action: 'getStatus' });

        const log = bg.store.local.errorLog || [];
        assert.strictEqual(log.length, 0, 'có unhandled rejection: ' + JSON.stringify(log));
    } finally { restore(); }
});

// ── Pause ───────────────────────────────────────────────────────────────

test('tạm dừng chặn mọi nhắc nhở, bật lại thì reschedule', async () => {
    const restore = useWorkdayClock();
    try {
        const bg = await boot();
        await sendMessage(bg, { action: 'togglePause' });
        bg.created.length = 0;
        await fireAlarm(bg, 'walk_reminder');
        assert.strictEqual(bg.created.length, 0);

        const res = await sendMessage(bg, { action: 'togglePause' });
        assert.strictEqual(res.isPaused, false);
        const a = await bg.chrome.alarms.get('walk_reminder');
        assert.ok(a.periodInMinutes > 0);
    } finally { restore(); }
});

// ── Adaptive intervals ──────────────────────────────────────────────────

test('C5: tắt adaptive thì bỏ qua nhiều lần vẫn không đổi interval', async () => {
    const restore = useWorkdayClock();
    try {
        const bg = await boot();
        const before = (await sendMessage(bg, { action: 'getSettings' })).settings.intervals.walk;
        for (let i = 0; i < 5; i++) {
            for (const fn of bg.listeners.notifClosed) await fn('whr_walk', true);
        }
        const after = (await sendMessage(bg, { action: 'getSettings' })).settings.intervals.walk;
        assert.strictEqual(after, before);
    } finally { restore(); }
});

test('C5: bật adaptive thì bỏ qua liên tiếp làm giãn interval', async () => {
    const restore = useWorkdayClock();
    try {
        const bg = await boot();
        await sendMessage(bg, {
            action: 'updateSettings', settings: { adaptiveIntervals: true }
        });
        const before = (await sendMessage(bg, { action: 'getSettings' })).settings.intervals.walk;

        for (let i = 0; i < 3; i++) {
            for (const fn of bg.listeners.notifClosed) await fn('whr_walk', true);
        }

        const after = (await sendMessage(bg, { action: 'getSettings' })).settings.intervals.walk;
        assert.ok(after > before, `phải giãn ra: ${before} -> ${after}`);
    } finally { restore(); }
});

// ── Holidays ────────────────────────────────────────────────────────────

test('ngày lễ VN thì không nhắc và hiện tên lễ', async () => {
    const RealDate = Date;
    const natl = new RealDate(2026, 8, 2, 10, 0, 0);   // 2/9 Quốc khánh
    class FakeDate extends RealDate {
        constructor(...a) { return a.length ? new RealDate(...a) : new RealDate(natl.getTime()); }
        static now() { return natl.getTime(); }
    }
    global.Date = FakeDate;
    try {
        const bg = await boot();
        bg.created.length = 0;
        await fireAlarm(bg, 'walk_reminder');
        assert.strictEqual(bg.created.length, 0);

        const status = await sendMessage(bg, { action: 'getStatus' });
        assert.strictEqual(status.workStatus.status, 'holiday');
        assert.match(status.workStatus.label, /Quốc khánh/);
    } finally { global.Date = RealDate; }
});

test('thêm/xoá ngày nghỉ tuỳ chỉnh hoạt động', async () => {
    const restore = useWorkdayClock();
    try {
        const bg = await boot();
        const add = await sendMessage(bg, {
            action: 'addCustomHoliday',
            name: 'Nghỉ phép', start: '2026-08-19', end: '2026-08-20'
        });
        assert.strictEqual(add.customHolidays.length, 1);

        bg.created.length = 0;
        await fireAlarm(bg, 'walk_reminder');
        assert.strictEqual(bg.created.length, 0, 'ngày nghỉ tuỳ chỉnh phải chặn nhắc');

        const rm = await sendMessage(bg, { action: 'removeCustomHoliday', index: 0 });
        assert.strictEqual(rm.customHolidays.length, 0);
    } finally { restore(); }
});

// ── Keyboard shortcuts ──────────────────────────────────────────────────

test('C4: shortcut +1 ly nước ghi nhận nước', async () => {
    const restore = useWorkdayClock();
    try {
        const bg = await boot();
        const before = (await sendMessage(bg, { action: 'getWaterLog' })).log.totalMl;
        for (const fn of bg.listeners.command) await fn('add_water');
        const after = (await sendMessage(bg, { action: 'getWaterLog' })).log.totalMl;
        assert.ok(after > before);
    } finally { restore(); }
});

test('C4: shortcut toggle Focus bật rồi tắt được', async () => {
    const bg = await boot();
    for (const fn of bg.listeners.command) await fn('toggle_focus');
    assert.ok(bg.store.local.state.focusEndTime, 'phải bật Focus');
    for (const fn of bg.listeners.command) await fn('toggle_focus');
    assert.strictEqual(bg.store.local.state.focusEndTime, null, 'phải tắt Focus');
});

// ── Todo ────────────────────────────────────────────────────────────────

test('todo: thêm, hoàn thành, xoá', async () => {
    const restore = useWorkdayClock();
    try {
        const bg = await boot();
        const add = await sendMessage(bg, {
            action: 'addTodo', task: { text: 'viết test', priority: 'high', frequency: 'once' }
        });
        assert.strictEqual(add.success, true);

        const toggled = await sendMessage(bg, { action: 'toggleTodo', taskId: add.task.id });
        assert.strictEqual(toggled.task.completed, true);

        await sendMessage(bg, { action: 'deleteTodo', taskId: add.task.id });
        const data = await sendMessage(bg, { action: 'getTodoData' });
        assert.strictEqual(data.todoTasks.tasks.length, 0);
    } finally { restore(); }
});

test('todo: history dùng key YYYY-MM-DD', async () => {
    const restore = useWorkdayClock();
    try {
        const bg = await boot();
        const add = await sendMessage(bg, {
            action: 'addTodo', task: { text: 'x', priority: 'low', frequency: 'once' }
        });
        await sendMessage(bg, { action: 'toggleTodo', taskId: add.task.id });

        const keys = Object.keys(bg.store.local.todoHistory);
        assert.ok(keys.includes('2026-08-19'), 'key phải là ISO local: ' + keys.join(','));
    } finally { restore(); }
});

test('todo: task hàng tuần chỉ hoạt động vào T2', async () => {
    const restore = useWorkdayClock();   // 19/8/2026 là Thứ Tư
    try {
        const bg = await boot();
        const add = await sendMessage(bg, {
            action: 'addTodo', task: { text: 'báo cáo tuần', priority: 'high', frequency: 'weekly' }
        });
        const data = await sendMessage(bg, { action: 'getTodoData' });
        const t = data.todoTasks.tasks.find(x => x.id === add.task.id);
        assert.strictEqual(t.isActiveToday, false, 'T4 thì task weekly chưa đến hạn');
    } finally { restore(); }
});

// ── Reset to defaults ───────────────────────────────────────────────────

test('reset về mặc định vẫn giữ đủ 9 alarm', async () => {
    const bg = await boot();
    await sendMessage(bg, { action: 'resetToDefaults' });
    const names = (await bg.chrome.alarms.getAll()).map(a => a.name);
    for (const n of PERIODIC) assert.ok(names.includes(n), `thiếu ${n}`);
});
