// node --test tests/
// Test cho lib/core.js — logic thuần, không cần Chrome.
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const C = require('../chrome-extension/lib/core.js');

// Settings mặc định giống DEFAULT_SETTINGS của extension
const S = () => ({
    workStart: { hour: 8, minute: 0 },
    lunchStart: { hour: 11, minute: 30 },
    lunchEnd: { hour: 13, minute: 0 },
    workEnd: { hour: 17, minute: 30 },
    morningReminderStart: { hour: 7, minute: 30 },
    saturdayEnd: { hour: 12, minute: 0 },
    sundayEnd: { hour: 12, minute: 0 },
    weekendMode: 'mon_fri',
    customHolidays: [],
    workPeriodEnabled: false,
    workPeriodStart: '',
    workPeriodEnd: '',
    intervals: Object.assign({}, C.DEFAULT_INTERVALS),
    waterGoalMl: 2000,
    waterCupMl: 200,
    notificationEnabled: true,
    isPaused: false
});

// 2026-08-19 là Thứ Tư, 2026-08-22 Thứ Bảy, 2026-08-23 Chủ Nhật
const wed = (h, m) => new Date(2026, 7, 19, h, m || 0);
const sat = (h, m) => new Date(2026, 7, 22, h, m || 0);

// ── normalizeIntervals: hàng rào chặn defect phá alarm ──────────────────

test('normalizeIntervals luôn trả về đủ 9 key là số hữu hạn', () => {
    const out = C.normalizeIntervals({ walk: 45 });
    assert.strictEqual(Object.keys(out).length, 9);
    for (const k of C.INTERVAL_KEYS) {
        assert.ok(Number.isFinite(out[k]), `${k} phải là số`);
        assert.ok(out[k] >= 1, `${k} phải >= 1`);
    }
});

test('normalizeIntervals thay giá trị rác bằng default (đây là bug làm chết alarm)', () => {
    const out = C.normalizeIntervals({
        walk: undefined, water: NaN, toilet: 0, eye_20_20_20: -5,
        blink: 'abc', posture: null, neck_stretch: 99999
    });
    assert.strictEqual(out.walk, C.DEFAULT_INTERVALS.walk);
    assert.strictEqual(out.water, C.DEFAULT_INTERVALS.water);
    assert.strictEqual(out.toilet, C.DEFAULT_INTERVALS.toilet);
    assert.strictEqual(out.eye_20_20_20, C.DEFAULT_INTERVALS.eye_20_20_20);
    assert.strictEqual(out.blink, C.DEFAULT_INTERVALS.blink);
    assert.strictEqual(out.posture, C.DEFAULT_INTERVALS.posture);
    assert.strictEqual(out.neck_stretch, C.DEFAULT_INTERVALS.neck_stretch);
});

test('normalizeIntervals bỏ qua key lạ, không làm hỏng bộ key', () => {
    const out = C.normalizeIntervals({ nonsense: 5, walk: 30 });
    assert.strictEqual(out.nonsense, undefined);
    assert.strictEqual(out.walk, 30);
});

// ── G1a: ngân sách thông báo ────────────────────────────────────────────

test('G1a: nhắc nhở đòi hành động <= 40 lần trong ngày làm 8h', () => {
    const n = C.countDailyNotifications(C.DEFAULT_INTERVALS, 480, { actionOnly: true });
    assert.ok(n <= C.ACTION_NOTIFICATION_BUDGET, `phải <= 40, thực tế ${n}`);
});

test('G1a: 20-20-20 giữ đúng nhịp AAO 20 phút (ngân sách micro riêng)', () => {
    assert.strictEqual(C.DEFAULT_INTERVALS.eye_20_20_20, 20);
    const micro = C.countDailyNotifications(C.DEFAULT_INTERVALS, 480, { microOnly: true });
    assert.strictEqual(micro, 24);
});

test('blink 2 phút cũ tạo ra spam (chứng minh vì sao phải đổi default)', () => {
    const old = C.countDailyNotifications(
        Object.assign({}, C.DEFAULT_INTERVALS, { blink: 2 }), 480);
    assert.ok(old > 200, `default cũ phải > 200, thực tế ${old}`);
});

// ── Date keys: local, không UTC ─────────────────────────────────────────

test('toLocalDateKey dùng giờ địa phương, không lệch ngày', () => {
    assert.strictEqual(C.toLocalDateKey(new Date(2026, 7, 23, 0, 30)), '2026-08-23');
    assert.strictEqual(C.toLocalDateKey(new Date(2026, 0, 1, 23, 59)), '2026-01-01');
});

test('fromLocalDateKey trả về nửa đêm local, không phải UTC', () => {
    const d = C.fromLocalDateKey('2026-08-23');
    assert.strictEqual(d.getFullYear(), 2026);
    assert.strictEqual(d.getMonth(), 7);
    assert.strictEqual(d.getDate(), 23);   // sẽ fail nếu parse thành UTC ở múi giờ âm
    assert.strictEqual(d.getHours(), 0);
});

test('fromLocalDateKey trả null với key sai định dạng', () => {
    assert.strictEqual(C.fromLocalDateKey('Sun Aug 23 2026'), null);
    assert.strictEqual(C.fromLocalDateKey('rác'), null);
    assert.strictEqual(C.fromLocalDateKey(''), null);
});

test('parseAnyDateKey đọc được cả key cũ toDateString và key mới ISO', () => {
    assert.strictEqual(C.toLocalDateKey(C.parseAnyDateKey('Sun Aug 23 2026')), '2026-08-23');
    assert.strictEqual(C.toLocalDateKey(C.parseAnyDateKey('2026-08-23')), '2026-08-23');
    assert.strictEqual(C.parseAnyDateKey('không phải ngày'), null);
});

// ── D7: prune history theo thời gian, không theo alphabet ───────────────

test('D7: key toDateString sort alphabet là SAI thứ tự thời gian', () => {
    const wrong = ['Mon Aug 24 2026', 'Sun Aug 23 2026', 'Tue Jul 07 2026'].sort();
    assert.strictEqual(wrong[0], 'Mon Aug 24 2026');   // tháng 8 lại đứng trước tháng 7
});

test('migrateAndPruneHistory prune đúng ngày cũ nhất', () => {
    const hist = {
        'Tue Jul 07 2026': { total: 1, completed: 1, percentage: 100 },
        'Sun Aug 23 2026': { total: 2, completed: 1, percentage: 50 },
        'Mon Aug 24 2026': { total: 3, completed: 3, percentage: 100 }
    };
    const out = C.migrateAndPruneHistory(hist, 2);
    assert.strictEqual(Object.keys(out).length, 2);
    assert.ok(!out['2026-07-07'], 'ngày cũ nhất (7/7) phải bị xoá');
    assert.ok(out['2026-08-23']);
    assert.ok(out['2026-08-24']);
});

test('migrateAndPruneHistory chuyển hết key cũ sang ISO', () => {
    const out = C.migrateAndPruneHistory({
        'Sun Aug 23 2026': { total: 1, completed: 1, percentage: 100 }
    }, 30);
    assert.deepStrictEqual(Object.keys(out), ['2026-08-23']);
});

test('migrateAndPruneHistory xoá HẾT phần dư, không chỉ 1 (bug cũ)', () => {
    const hist = {};
    for (let i = 1; i <= 40; i++) {
        hist[`2026-06-${String(i).padStart(2, '0')}`] = { total: 1, completed: 1, percentage: 100 };
    }
    // tháng 6 chỉ có 30 ngày -> key 31..40 không hợp lệ, bị loại
    const out = C.migrateAndPruneHistory(hist, 30);
    assert.ok(Object.keys(out).length <= 30, `phải <= 30, thực tế ${Object.keys(out).length}`);
});

test('migrateAndPruneHistory bỏ key rác, không ghi lại', () => {
    const out = C.migrateAndPruneHistory({
        'rác hoàn toàn': { total: 1 },
        '2026-08-23': { total: 2, completed: 2, percentage: 100 }
    }, 30);
    assert.deepStrictEqual(Object.keys(out), ['2026-08-23']);
});

test('migrateAndPruneHistory gộp trùng key cũ+mới, giữ bản nhiều task hơn', () => {
    const out = C.migrateAndPruneHistory({
        'Sun Aug 23 2026': { total: 1, completed: 1, percentage: 100 },
        '2026-08-23':      { total: 5, completed: 3, percentage: 60 }
    }, 30);
    assert.strictEqual(Object.keys(out).length, 1);
    assert.strictEqual(out['2026-08-23'].total, 5);
});

// ── D8: streak phải đứt được ────────────────────────────────────────────

test('D8: streak reset về 0 khi bỏ 1 ngày', () => {
    const out = C.resolveStreakOnRollover(
        { streak: 7, bestStreak: 9, lastCompletedDate: '2026-08-20' },
        new Date(2026, 7, 23));
    assert.strictEqual(out.streak, 0);
    assert.strictEqual(out.bestStreak, 9, 'bestStreak phải giữ nguyên');
});

test('streak giữ nguyên khi hoàn thành hôm qua', () => {
    const out = C.resolveStreakOnRollover(
        { streak: 3, bestStreak: 5, lastCompletedDate: '2026-08-22' },
        new Date(2026, 7, 23));
    assert.strictEqual(out.streak, 3);
});

test('streak giữ nguyên khi đã hoàn thành hôm nay', () => {
    const out = C.resolveStreakOnRollover(
        { streak: 4, bestStreak: 6, lastCompletedDate: '2026-08-23' },
        new Date(2026, 7, 23));
    assert.strictEqual(out.streak, 4);
});

test('streak = 0 khi chưa từng hoàn thành', () => {
    assert.strictEqual(C.resolveStreakOnRollover({ streak: 5, lastCompletedDate: null }, wed(9)).streak, 0);
});

test('bumpStreakOnComplete tăng liên tiếp và cập nhật best', () => {
    let s = { streak: 2, bestStreak: 2, lastCompletedDate: '2026-08-22' };
    s = C.bumpStreakOnComplete(s, new Date(2026, 7, 23));
    assert.strictEqual(s.streak, 3);
    assert.strictEqual(s.bestStreak, 3);
    assert.strictEqual(s.lastCompletedDate, '2026-08-23');
});

test('bumpStreakOnComplete không tăng 2 lần trong cùng ngày', () => {
    let s = { streak: 3, bestStreak: 3, lastCompletedDate: '2026-08-23' };
    s = C.bumpStreakOnComplete(s, new Date(2026, 7, 23));
    assert.strictEqual(s.streak, 3);
});

test('bumpStreakOnComplete về 1 sau khi đứt chuỗi', () => {
    const s = C.bumpStreakOnComplete(
        { streak: 9, bestStreak: 9, lastCompletedDate: '2026-08-01' },
        new Date(2026, 7, 23));
    assert.strictEqual(s.streak, 1);
    assert.strictEqual(s.bestStreak, 9);
});

// ── G6: D6 — escape cả attribute ────────────────────────────────────────

test('G6/D6: escapeHtml escape dấu ngoặc kép (bug cũ không escape)', () => {
    assert.strictEqual(C.escapeHtml('a"b'), 'a&quot;b');
    assert.strictEqual(C.escapeHtml("a'b"), 'a&#39;b');
});

test('G6: title video độc hại không phá được attribute', () => {
    const evil = '" onmouseover="alert(1)" x="';
    const html = `<span title="${C.escapeHtml(evil)}">x</span>`;
    assert.ok(!/title="[^"]*"\s+onmouseover/.test(html), 'không được thoát ra ngoài attribute');
    assert.ok(html.includes('&quot;'));
});

test('G6: fuzz set đầy đủ vẫn an toàn', () => {
    for (const s of ['<script>', '&', '"', "'", '<>&"\'', '</span><img src=x>']) {
        const out = C.escapeHtml(s);
        assert.ok(!out.includes('<'), `còn < trong: ${out}`);
        assert.ok(!out.includes('>'), `còn > trong: ${out}`);
        assert.ok(!out.includes('"'), `còn " trong: ${out}`);
    }
});

test('escapeHtml xử lý null/undefined thành chuỗi rỗng', () => {
    assert.strictEqual(C.escapeHtml(null), '');
    assert.strictEqual(C.escapeHtml(undefined), '');
});

test('escapeTelegram chỉ escape 3 ký tự HTML mà Telegram cần', () => {
    assert.strictEqual(C.escapeTelegram('a<b>&c"d'), 'a&lt;b&gt;&amp;c"d');
});

// ── Holidays ────────────────────────────────────────────────────────────

test('checkHoliday nhận ngày lễ cố định', () => {
    const r = C.checkHoliday(S(), new Date(2026, 8, 2));
    assert.strictEqual(r.isHoliday, true);
    assert.match(r.name, /Quốc khánh/);
});

test('checkHoliday nhận Tết âm lịch 2026 (15-22/2)', () => {
    assert.strictEqual(C.checkHoliday(S(), new Date(2026, 1, 17)).isHoliday, true);
    assert.strictEqual(C.checkHoliday(S(), new Date(2026, 1, 25)).isHoliday, false);
});

test('checkHoliday nhận ngày nghỉ tuỳ chỉnh', () => {
    const s = S();
    s.customHolidays = [{ name: 'Nghỉ phép', start: '2026-08-19', end: '2026-08-21' }];
    assert.strictEqual(C.checkHoliday(s, wed(10)).name, 'Nghỉ phép');
});

test('checkHoliday không crash khi customHolidays undefined', () => {
    const s = S();
    delete s.customHolidays;
    assert.strictEqual(C.checkHoliday(s, wed(10)).isHoliday, false);
});

// ── Work schedule ───────────────────────────────────────────────────────

test('isWorkTime: trong giờ sáng', () => assert.strictEqual(C.isWorkTime(S(), wed(9)), true));
test('isWorkTime: nghỉ trưa thì false', () => assert.strictEqual(C.isWorkTime(S(), wed(12)), false));
test('isWorkTime: chiều thì true', () => assert.strictEqual(C.isWorkTime(S(), wed(14)), true));
test('isWorkTime: sau giờ làm thì false', () => assert.strictEqual(C.isWorkTime(S(), wed(18)), false));
test('isWorkTime: trước giờ làm thì false', () => assert.strictEqual(C.isWorkTime(S(), wed(7)), false));
test('isWorkTime: T7 với mon_fri thì false', () => assert.strictEqual(C.isWorkTime(S(), sat(10)), false));

test('isWorkTime: T7 nửa ngày thì true buổi sáng, false sau 12h', () => {
    const s = S();
    s.weekendMode = 'mon_sat_half';
    assert.strictEqual(C.isWorkTime(s, sat(10)), true);
    assert.strictEqual(C.isWorkTime(s, sat(13)), false);
});

test('isLunchBreak đúng biên', () => {
    assert.strictEqual(C.isLunchBreak(S(), wed(11, 29)), false);
    assert.strictEqual(C.isLunchBreak(S(), wed(11, 30)), true);
    assert.strictEqual(C.isLunchBreak(S(), wed(12, 59)), true);
    assert.strictEqual(C.isLunchBreak(S(), wed(13, 0)), false);
});

test('isWorkDay false trong ngày lễ', () => {
    assert.strictEqual(C.isWorkDay(S(), new Date(2026, 8, 2)), false);
});

test('isWithinWorkPeriod chặn ngoài khoảng ngày', () => {
    const s = S();
    s.workPeriodEnabled = true;
    s.workPeriodStart = '2026-09-01';
    s.workPeriodEnd = '2026-09-30';
    assert.strictEqual(C.isWithinWorkPeriod(s, wed(10)), false);
    assert.strictEqual(C.isWithinWorkPeriod(s, new Date(2026, 8, 15, 10)), true);
});

test('workMinutesToday = 480 với giờ làm mặc định', () => {
    assert.strictEqual(C.workMinutesToday(S(), wed(9)), 480);
});

test('workMinutesElapsed đóng băng trong giờ nghỉ trưa', () => {
    assert.strictEqual(C.workMinutesElapsed(S(), wed(8)), 0);
    assert.strictEqual(C.workMinutesElapsed(S(), wed(10)), 120);
    assert.strictEqual(C.workMinutesElapsed(S(), wed(12)), 210);
    assert.strictEqual(C.workMinutesElapsed(S(), wed(12, 45)), 210, 'nghỉ trưa không tính');
    assert.strictEqual(C.workMinutesElapsed(S(), wed(14)), 270);
    assert.strictEqual(C.workMinutesElapsed(S(), wed(20)), 480, 'không vượt quá tổng');
});

// ── G3/G1c: suppression — một nguồn sự thật ─────────────────────────────

const ctx = (over) => Object.assign({
    settings: S(), state: {}, now: wed(9), idleState: 'active', meeting: null
}, over);

test('G3: giờ làm bình thường thì không bị chặn', () => {
    assert.strictEqual(C.getSuppressionReason(ctx()), null);
});

test('G1c: notificationEnabled=false chặn TẤT CẢ (bug cũ: guard đặt sai chỗ)', () => {
    const s = S();
    s.notificationEnabled = false;
    assert.strictEqual(C.getSuppressionReason(ctx({ settings: s })), C.SUPPRESS.NOTIF_OFF);
});

test('isPaused ưu tiên cao nhất', () => {
    const s = S();
    s.isPaused = true;
    assert.strictEqual(C.getSuppressionReason(ctx({ settings: s })), C.SUPPRESS.PAUSED);
});

test('nghỉ trưa trả lý do lunch', () => {
    assert.strictEqual(C.getSuppressionReason(ctx({ now: wed(12) })), C.SUPPRESS.LUNCH);
});

test('trước/sau giờ làm phân biệt được', () => {
    assert.strictEqual(C.getSuppressionReason(ctx({ now: wed(7) })), C.SUPPRESS.BEFORE_WORK);
    assert.strictEqual(C.getSuppressionReason(ctx({ now: wed(19) })), C.SUPPRESS.AFTER_WORK);
});

test('cuối tuần và ngày lễ có lý do riêng', () => {
    assert.strictEqual(C.getSuppressionReason(ctx({ now: sat(10) })), C.SUPPRESS.WEEKEND);
    assert.strictEqual(C.getSuppressionReason(ctx({ now: new Date(2026, 8, 2, 10) })), C.SUPPRESS.HOLIDAY);
});

test('Focus và Pomodoro chặn nhắc nhở', () => {
    const focus = { focusEndTime: wed(9).getTime() + 600000 };
    assert.strictEqual(C.getSuppressionReason(ctx({ state: focus })), C.SUPPRESS.FOCUS);
    assert.strictEqual(C.getSuppressionReason(ctx({ state: { pomodoroState: 'work' } })), C.SUPPRESS.POMODORO);
});

test('Focus đã hết hạn thì không còn chặn', () => {
    const expired = { focusEndTime: wed(9).getTime() - 1000 };
    assert.strictEqual(C.getSuppressionReason(ctx({ state: expired })), null);
});

test('G4: idle và locked chặn nhắc nhở', () => {
    assert.strictEqual(C.getSuppressionReason(ctx({ idleState: 'idle' })), C.SUPPRESS.IDLE);
    assert.strictEqual(C.getSuppressionReason(ctx({ idleState: 'locked' })), C.SUPPRESS.LOCKED);
});

test('G4: đang họp thì chặn nhắc nhở', () => {
    assert.strictEqual(
        C.getSuppressionReason(ctx({ meeting: { active: true } })), C.SUPPRESS.MEETING);
});

test('mọi mã suppression đều có nhãn tiếng Việt để popup hiển thị', () => {
    for (const code of Object.values(C.SUPPRESS)) {
        assert.ok(C.SUPPRESS_LABEL[code], `thiếu nhãn cho ${code}`);
    }
});

test('shouldDeliverPeriodic khớp với getSuppressionReason', () => {
    assert.strictEqual(C.shouldDeliverPeriodic(ctx()), true);
    assert.strictEqual(C.shouldDeliverPeriodic(ctx({ now: wed(12) })), false);
});

// ── Water pace ──────────────────────────────────────────────────────────

test('water pace: đã uống đủ theo tiến độ thì không nhắc', () => {
    const r = C.evaluateWaterPace({ totalMl: 900, goalMl: 2000, settings: S(), now: wed(12) });
    assert.strictEqual(r.expectedMl, 875);
    assert.strictEqual(r.behind, false);
});

test('water pace: tụt hơn 1 ly thì nhắc', () => {
    const r = C.evaluateWaterPace({ totalMl: 200, goalMl: 2000, settings: S(), now: wed(14) });
    assert.ok(r.deficitMl >= 200);
    assert.strictEqual(r.behind, true);
});

test('water pace: tụt rất nhiều thì đánh dấu severe', () => {
    const r = C.evaluateWaterPace({ totalMl: 0, goalMl: 2000, settings: S(), now: wed(16) });
    assert.strictEqual(r.severe, true);
});

test('water pace: đầu giờ làm thì chưa nhắc', () => {
    const r = C.evaluateWaterPace({ totalMl: 0, goalMl: 2000, settings: S(), now: wed(8, 5) });
    assert.strictEqual(r.behind, false);
});

test('water pace: ngày không làm việc thì không nhắc (chia 0)', () => {
    const s = S();
    s.workStart = { hour: 9, minute: 0 };
    s.workEnd = { hour: 9, minute: 0 };
    s.lunchStart = { hour: 9, minute: 0 };
    s.lunchEnd = { hour: 9, minute: 0 };
    const r = C.evaluateWaterPace({ totalMl: 0, goalMl: 2000, settings: s, now: wed(10) });
    assert.strictEqual(r.behind, false);
});

// ── Meeting detection ───────────────────────────────────────────────────

test('isMeetingUrl nhận các nền tảng họp phổ biến', () => {
    assert.ok(C.isMeetingUrl('https://meet.google.com/abc-defg-hij'));
    assert.ok(C.isMeetingUrl('https://us02web.zoom.us/j/123'));
    assert.ok(C.isMeetingUrl('https://teams.microsoft.com/_#/conversations'));
    assert.ok(!C.isMeetingUrl('https://www.youtube.com/watch?v=x'));
    assert.ok(!C.isMeetingUrl(null));
});

test('tab họp đang phát tiếng -> đang họp', () => {
    const r = C.evaluateMeeting(
        [{ id: 1, url: 'https://meet.google.com/x', audible: true }], null, wed(9));
    assert.strictEqual(r.active, true);
    assert.strictEqual(r.tabId, 1);
});

test('tab họp im lặng và chưa từng phát tiếng -> KHÔNG phải đang họp', () => {
    const r = C.evaluateMeeting(
        [{ id: 1, url: 'https://meet.google.com/x', audible: false }], null, wed(9));
    assert.strictEqual(r.active, false);
});

test('tab họp im lặng ngắn vẫn tính là đang họp (grace 60s)', () => {
    const now = wed(9);
    const r = C.evaluateMeeting(
        [{ id: 1, url: 'https://meet.google.com/x', audible: false }],
        now.getTime() - 30000, now);
    assert.strictEqual(r.active, true);
    assert.strictEqual(r.audibleNow, false);
});

test('im lặng quá lâu thì thoát trạng thái họp', () => {
    const now = wed(9);
    const r = C.evaluateMeeting(
        [{ id: 1, url: 'https://meet.google.com/x', audible: false }],
        now.getTime() - 120000, now);
    assert.strictEqual(r.active, false);
});

test('tab YouTube phát tiếng KHÔNG bị nhận là họp', () => {
    const r = C.evaluateMeeting(
        [{ id: 1, url: 'https://www.youtube.com/watch?v=x', audible: true }], null, wed(9));
    assert.strictEqual(r.active, false);
});

test('không có tab nào thì không họp', () => {
    assert.strictEqual(C.evaluateMeeting([], null, wed(9)).active, false);
    assert.strictEqual(C.evaluateMeeting(null, null, wed(9)).active, false);
});

// ── Adaptive intervals ──────────────────────────────────────────────────

test('bỏ qua liên tiếp thì giãn interval', () => {
    const next = C.adaptInterval(45, 45, { consecutiveDismissed: 3, consecutiveDone: 0 });
    assert.ok(next > 45, `phải giãn ra, thực tế ${next}`);
});

test('interval không bao giờ vượt 2x default (không trôi thành im lặng)', () => {
    let cur = 45;
    for (let i = 0; i < 20; i++) {
        cur = C.adaptInterval(cur, 45, { consecutiveDismissed: 5, consecutiveDone: 0 });
    }
    assert.ok(cur <= 90, `trần phải là 90, thực tế ${cur}`);
});

test('interval không bao giờ nhỏ hơn default', () => {
    let cur = 45;
    for (let i = 0; i < 20; i++) {
        cur = C.adaptInterval(cur, 45, { consecutiveDismissed: 0, consecutiveDone: 5 });
    }
    assert.ok(cur >= 45, `sàn phải là 45, thực tế ${cur}`);
});

test('chưa đủ ngưỡng thì giữ nguyên interval', () => {
    assert.strictEqual(C.adaptInterval(45, 45, { consecutiveDismissed: 1, consecutiveDone: 0 }), 45);
});

// ── D4: diffAlarms — không re-phase mọi nhắc nhở khi Save ───────────────

test('D4: interval không đổi thì KHÔNG tạo lại alarm (bug cũ clearAll hết)', () => {
    const existing = [
        { name: 'walk_reminder', periodInMinutes: 45 },
        { name: 'water_reminder', periodInMinutes: 45 }
    ];
    const d = C.diffAlarms(existing, { walk_reminder: 45, water_reminder: 45 });
    assert.deepStrictEqual(d.toCreate, []);
    assert.deepStrictEqual(d.toClear, []);
});

test('diffAlarms chỉ tạo lại alarm có interval thật sự đổi', () => {
    const existing = [
        { name: 'walk_reminder', periodInMinutes: 45 },
        { name: 'water_reminder', periodInMinutes: 45 }
    ];
    const d = C.diffAlarms(existing, { walk_reminder: 60, water_reminder: 45 });
    assert.strictEqual(d.toCreate.length, 1);
    assert.strictEqual(d.toCreate[0].name, 'walk_reminder');
    assert.strictEqual(d.toCreate[0].periodInMinutes, 60);
    assert.deepStrictEqual(d.toClear, ['walk_reminder']);
});

test('diffAlarms tạo alarm còn thiếu', () => {
    const d = C.diffAlarms([], { walk_reminder: 45 });
    assert.strictEqual(d.toCreate.length, 1);
    assert.deepStrictEqual(d.toClear, []);
});

test('diffAlarms báo alarm lạ trong untouched, không xoá bừa', () => {
    const existing = [
        { name: 'walk_reminder', periodInMinutes: 45 },
        { name: 'daily_reset', periodInMinutes: 1440 }
    ];
    const d = C.diffAlarms(existing, { walk_reminder: 45 });
    assert.deepStrictEqual(d.untouched, ['daily_reset']);
});

// ── G1b: bộ tên alarm không đổi sau khi Save ────────────────────────────

test('G1b: sau khi save chỉ với 4 interval, cả 9 alarm vẫn còn', () => {
    // Mô phỏng đúng bug: popup chỉ gửi 4 interval mà UI có
    const partial = { walk: 45, water: 45, eye_20_20_20: 20, posture: 45 };
    const merged = C.normalizeIntervals(Object.assign({}, C.DEFAULT_INTERVALS, partial));
    for (const k of C.INTERVAL_KEYS) {
        assert.ok(Number.isFinite(merged[k]), `${k} phải còn hợp lệ sau merge`);
    }
    assert.strictEqual(Object.keys(merged).length, 9);
});

test('G1b: shallow merge kiểu cũ làm mất interval -> chứng minh cần deep merge', () => {
    const partial = { walk: 45, water: 45, eye_20_20_20: 20, posture: 45 };
    const shallow = Object.assign({}, { intervals: C.DEFAULT_INTERVALS }, { intervals: partial });
    assert.strictEqual(shallow.intervals.blink, undefined,
        'shallow merge làm blink thành undefined -> alarms.create sẽ throw');
    // normalizeIntervals là hàng rào cứu trường hợp này
    assert.strictEqual(C.normalizeIntervals(shallow.intervals).blink, C.DEFAULT_INTERVALS.blink);
});
