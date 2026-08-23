// ========================================
// Work Health Reminder PRO — Pure Core Logic
// Version 3.2
//
// KHÔNG dùng chrome.* API trong file này. Mọi hàm phải pure và nhận
// `now` (Date) từ bên ngoài để test được bằng node --test.
//
// Load:
//   background.js  -> importScripts('lib/core.js')  -> self.WHRCore
//   popup/options  -> <script src="lib/core.js">    -> window.WHRCore
//   test           -> require('../lib/core.js')     -> module.exports
// ========================================

(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;      // node --test
    }
    root.WHRCore = api;            // service worker (self) / window
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    // ── Interval defaults ────────────────────────────────────────────────
    //
    // NGÂN SÁCH THÔNG BÁO (ngày làm 8h = 480 phút):
    //   • eye_20_20_20 giữ nhịp 20 phút theo đúng quy tắc AAO -> 24 lần/ngày.
    //     Đây là loại "micro": nhìn xa 20 giây, không phải rời chỗ, nên được
    //     tính NGÂN SÁCH RIÊNG.
    //   • Tất cả nhắc nhở còn lại (đứng dậy, uống nước, giãn cơ...) đòi hỏi
    //     hành động thật -> tổng phải <= 40 lần/ngày. Hiện tại: 39.
    //
    // Default cũ có blink = 2 phút -> 240 lần/ngày chỉ riêng chớp mắt.
    // Đó là nhịp chớp mắt SINH LÝ, không phải nhịp gửi notification.
    //
    // Đánh đổi đã cân: walk/water giãn về 60 phút thay vì 30 như guideline
    // gốc, vì (a) thông báo bị bỏ qua thì bằng không có, và (b) nhắc uống
    // nước giờ chạy theo pace (evaluateWaterPace) nên tự đẩy mạnh khi tụt,
    // không còn phụ thuộc nhịp cứng. Người dùng vẫn tự chỉnh được.
    const DEFAULT_INTERVALS = {
        walk: 60,            // 8 lần/ngày
        water: 60,           // 8 — kết hợp water pace
        toilet: 120,         // 4
        eye_20_20_20: 20,    // 24 — quy tắc AAO 20-20-20, ngân sách riêng
        blink: 90,           // 5 — nhắc chớp mắt, KHÔNG phải nhịp sinh lý
        posture: 90,         // 5
        neck_stretch: 90,    // 5
        eye_exercise: 180,   // 2
        breathing: 180       // 2
    };

    // Nhắc nhở loại "micro": tần suất cao nhưng gần như không tốn công.
    const MICRO_REMINDERS = ['eye_20_20_20'];

    // Trần ngân sách cho nhắc nhở đòi hành động, trong 1 ngày làm 8h.
    const ACTION_NOTIFICATION_BUDGET = 40;

    const INTERVAL_KEYS = Object.keys(DEFAULT_INTERVALS);
    const MIN_INTERVAL_MINUTES = 1;
    const MAX_INTERVAL_MINUTES = 600;

    /**
     * Ép mọi interval về số hữu hạn trong [MIN, MAX], fallback về default.
     * Đây là hàng rào chặn defect: nếu một key thành undefined/NaN/0 thì
     * chrome.alarms.create() sẽ throw và phá cả bộ alarm.
     */
    function normalizeIntervals(raw) {
        const out = {};
        const src = raw || {};
        for (const key of INTERVAL_KEYS) {
            const n = Number(src[key]);
            out[key] = (Number.isFinite(n) && n >= MIN_INTERVAL_MINUTES && n <= MAX_INTERVAL_MINUTES)
                ? Math.round(n)
                : DEFAULT_INTERVALS[key];
        }
        return out;
    }

    /**
     * Số thông báo định kỳ trong `workMinutes` phút làm việc.
     * @param {object} opts { microOnly, actionOnly } để tách 2 ngân sách.
     */
    function countDailyNotifications(intervals, workMinutes, opts) {
        const ivl = normalizeIntervals(intervals);
        const cfg = opts || {};
        let total = 0;
        for (const key of INTERVAL_KEYS) {
            const isMicro = MICRO_REMINDERS.includes(key);
            if (cfg.microOnly && !isMicro) continue;
            if (cfg.actionOnly && isMicro) continue;
            total += Math.floor(workMinutes / ivl[key]);
        }
        return total;
    }

    // ── Date keys (local, KHÔNG UTC) ─────────────────────────────────────

    /** Date -> "YYYY-MM-DD" theo giờ địa phương. Sort được theo thứ tự thời gian. */
    function toLocalDateKey(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    /**
     * "YYYY-MM-DD" -> Date local midnight.
     * KHÔNG dùng new Date("YYYY-MM-DD") vì chuỗi đó bị parse thành UTC,
     * làm lệch 1 ngày ở các múi giờ âm.
     */
    function fromLocalDateKey(key) {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ''));
        if (!m) return null;
        const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
        return Number.isNaN(d.getTime()) ? null : d;
    }

    /** Nhận cả key mới ("2026-08-23") và key cũ ("Sun Aug 23 2026"). */
    function parseAnyDateKey(key) {
        const iso = fromLocalDateKey(key);
        if (iso) return iso;
        const legacy = new Date(String(key || ''));
        if (Number.isNaN(legacy.getTime())) return null;
        return new Date(legacy.getFullYear(), legacy.getMonth(), legacy.getDate());
    }

    function dayDiff(a, b) {
        const da = new Date(a.getFullYear(), a.getMonth(), a.getDate());
        const db = new Date(b.getFullYear(), b.getMonth(), b.getDate());
        return Math.round((da - db) / 86400000);
    }

    // ── Todo history ─────────────────────────────────────────────────────

    /**
     * Chuyển mọi key về "YYYY-MM-DD" rồi prune theo thứ tự THỜI GIAN.
     * Bug cũ: Object.keys().sort() trên "Sun Aug 23 2026" là sort alphabet
     * nên xoá ngày ngẫu nhiên, và chỉ xoá đúng 1 key mỗi lần gọi.
     */
    function migrateAndPruneHistory(history, keepDays) {
        const keep = keepDays || 30;
        const normalized = {};

        for (const rawKey of Object.keys(history || {})) {
            const d = parseAnyDateKey(rawKey);
            if (!d) continue;                       // key rác -> bỏ, không ghi lại
            const key = toLocalDateKey(d);
            const val = history[rawKey];
            // Nếu cả key cũ và key mới cùng trỏ 1 ngày, giữ bản có nhiều task hơn.
            if (!normalized[key] || (val && val.total > normalized[key].total)) {
                normalized[key] = val;
            }
        }

        const sorted = Object.keys(normalized).sort();   // ISO sort = time sort
        const excess = sorted.length - keep;
        if (excess > 0) {
            for (const key of sorted.slice(0, excess)) delete normalized[key];
        }
        return normalized;
    }

    // ── Streak ───────────────────────────────────────────────────────────

    /**
     * Tính lại streak khi sang ngày mới. Bug cũ: chỉ có đường tăng,
     * không bao giờ đứt, nên số streak cũ hiển thị mãi mãi.
     */
    function resolveStreakOnRollover(todoSettings, now) {
        const s = Object.assign({ streak: 0, bestStreak: 0, lastCompletedDate: null }, todoSettings || {});
        if (!s.lastCompletedDate) return Object.assign(s, { streak: 0 });

        const last = parseAnyDateKey(s.lastCompletedDate);
        if (!last) return Object.assign(s, { streak: 0, lastCompletedDate: null });

        const gap = dayDiff(now, last);
        if (gap <= 1) return s;                      // hôm nay hoặc hôm qua -> còn streak
        return Object.assign(s, { streak: 0 });      // bỏ >= 1 ngày -> đứt
    }

    /** Cập nhật streak khi đạt 100% task trong ngày. */
    function bumpStreakOnComplete(todoSettings, now) {
        const s = Object.assign({ streak: 0, bestStreak: 0, lastCompletedDate: null }, todoSettings || {});
        const todayKey = toLocalDateKey(now);
        if (s.lastCompletedDate === todayKey) return s;   // đã ghi nhận hôm nay

        const last = s.lastCompletedDate ? parseAnyDateKey(s.lastCompletedDate) : null;
        s.streak = (last && dayDiff(now, last) === 1) ? s.streak + 1 : 1;
        if (s.streak > s.bestStreak) s.bestStreak = s.streak;
        s.lastCompletedDate = todayKey;
        return s;
    }

    // ── Escaping ─────────────────────────────────────────────────────────

    /**
     * Escape cho CẢ text node và attribute value.
     * Bug cũ: dùng textContent->innerHTML, không escape `"` nên tiêu đề
     * video YouTube có dấu ngoặc kép phá vỡ title="..." và inject markup.
     */
    function escapeHtml(text) {
        return String(text == null ? '' : text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /** Telegram parse_mode=HTML chỉ cần 3 ký tự này. */
    function escapeTelegram(text) {
        return String(text == null ? '' : text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    // ── Holidays ─────────────────────────────────────────────────────────

    const VN_HOLIDAYS_FIXED = [
        { name: 'Tết Dương lịch',           month: 1, day: 1,  days: 1 },
        { name: 'Ngày Giải phóng miền Nam', month: 4, day: 30, days: 1 },
        { name: 'Quốc tế Lao động',         month: 5, day: 1,  days: 1 },
        { name: 'Quốc khánh',               month: 9, day: 2,  days: 2 }
    ];

    // Ngày âm lịch phải ghi theo từng năm. HẾT HẠN SAU 2027 —
    // xem HOLIDAY_TABLE_LAST_YEAR và cảnh báo trong popup.
    const VN_HOLIDAYS_LUNAR = [
        { name: 'Tết Nguyên Đán 2025',    start: '2025-01-27', end: '2025-02-02' },
        { name: 'Giỗ Tổ Hùng Vương 2025', start: '2025-04-07', end: '2025-04-07' },
        { name: 'Tết Nguyên Đán 2026',    start: '2026-02-15', end: '2026-02-22' },
        { name: 'Giỗ Tổ Hùng Vương 2026', start: '2026-04-26', end: '2026-04-26' },
        { name: 'Tết Nguyên Đán 2027',    start: '2027-02-04', end: '2027-02-10' },
        { name: 'Giỗ Tổ Hùng Vương 2027', start: '2027-04-15', end: '2027-04-15' }
    ];

    const HOLIDAY_TABLE_LAST_YEAR = 2027;

    function getVnHolidays(year) {
        const out = [];
        for (const h of VN_HOLIDAYS_FIXED) {
            const start = new Date(year, h.month - 1, h.day);
            const end = new Date(year, h.month - 1, h.day + h.days - 1);
            out.push({ name: h.name, start: toLocalDateKey(start), end: toLocalDateKey(end) });
        }
        for (const h of VN_HOLIDAYS_LUNAR) {
            if (h.start.startsWith(String(year))) out.push(h);
        }
        out.sort((a, b) => a.start.localeCompare(b.start));
        return out;
    }

    function buildHolidayTable(now) {
        const y = now.getFullYear();
        return [...getVnHolidays(y), ...getVnHolidays(y + 1)];
    }

    function checkHoliday(settings, now, holidayTable) {
        const key = toLocalDateKey(now);
        const table = holidayTable || buildHolidayTable(now);
        for (const h of table) {
            if (key >= h.start && key <= h.end) return { isHoliday: true, name: h.name };
        }
        for (const h of (settings && settings.customHolidays) || []) {
            if (h && key >= h.start && key <= h.end) return { isHoliday: true, name: h.name };
        }
        return { isHoliday: false, name: null };
    }

    // ── Work schedule ────────────────────────────────────────────────────

    function toMinutes(t) {
        if (!t) return 0;
        return (Number(t.hour) || 0) * 60 + (Number(t.minute) || 0);
    }

    function isWithinWorkPeriod(settings, now) {
        if (!settings || !settings.workPeriodEnabled) return true;
        const key = toLocalDateKey(now);
        if (settings.workPeriodStart && key < settings.workPeriodStart) return false;
        if (settings.workPeriodEnd && key > settings.workPeriodEnd) return false;
        return true;
    }

    function isWorkDay(settings, now, holidayTable) {
        if (checkHoliday(settings, now, holidayTable).isHoliday) return false;
        if (!isWithinWorkPeriod(settings, now)) return false;

        const dow = now.getDay() === 0 ? 6 : now.getDay() - 1;   // Mon=0 .. Sun=6
        switch (settings && settings.weekendMode) {
            case 'mon_sat_full':
            case 'mon_sat_half': return dow < 6;
            case 'mon_sun_full':
            case 'mon_sun_half': return true;
            case 'mon_fri':
            default:             return dow < 5;
        }
    }

    function isHalfDay(settings, now) {
        const dow = now.getDay() === 0 ? 6 : now.getDay() - 1;
        if (dow === 5 && settings.weekendMode === 'mon_sat_half') return true;
        if (dow === 6 && settings.weekendMode === 'mon_sun_half') return true;
        return false;
    }

    function getTodayWorkEnd(settings, now) {
        const dow = now.getDay() === 0 ? 6 : now.getDay() - 1;
        if (dow === 5 && settings.weekendMode === 'mon_sat_half') return settings.saturdayEnd;
        if (dow === 6 && settings.weekendMode === 'mon_sun_half') return settings.sundayEnd;
        return settings.workEnd;
    }

    function isLunchBreak(settings, now, holidayTable) {
        if (!isWorkDay(settings, now, holidayTable)) return false;
        if (isHalfDay(settings, now)) return false;
        const cur = now.getHours() * 60 + now.getMinutes();
        return cur >= toMinutes(settings.lunchStart) && cur < toMinutes(settings.lunchEnd);
    }

    function isWorkTime(settings, now, holidayTable) {
        if (!isWorkDay(settings, now, holidayTable)) return false;
        const cur = now.getHours() * 60 + now.getMinutes();
        const start = toMinutes(settings.workStart);
        const end = toMinutes(getTodayWorkEnd(settings, now));

        if (isHalfDay(settings, now)) return cur >= start && cur < end;

        const lunchStart = toMinutes(settings.lunchStart);
        const lunchEnd = toMinutes(settings.lunchEnd);
        return (cur >= start && cur < lunchStart) || (cur >= lunchEnd && cur < end);
    }

    function isMorningReminderWindow(settings, now, holidayTable) {
        if (!isWorkDay(settings, now, holidayTable)) return false;
        const cur = now.getHours() * 60 + now.getMinutes();
        return cur >= toMinutes(settings.morningReminderStart) && cur < toMinutes(settings.workStart);
    }

    /** Số phút làm việc trong ngày (đã trừ nghỉ trưa) — dùng cho water pace. */
    function workMinutesToday(settings, now) {
        const start = toMinutes(settings.workStart);
        const end = toMinutes(getTodayWorkEnd(settings, now));
        if (isHalfDay(settings, now)) return Math.max(0, end - start);
        const lunchStart = toMinutes(settings.lunchStart);
        const lunchEnd = toMinutes(settings.lunchEnd);
        return Math.max(0, (lunchStart - start) + (end - lunchEnd));
    }

    /** Số phút đã làm tính tới `now`. */
    function workMinutesElapsed(settings, now) {
        const cur = now.getHours() * 60 + now.getMinutes();
        const start = toMinutes(settings.workStart);
        const end = toMinutes(getTodayWorkEnd(settings, now));
        if (cur <= start) return 0;

        if (isHalfDay(settings, now)) return Math.max(0, Math.min(cur, end) - start);

        const lunchStart = toMinutes(settings.lunchStart);
        const lunchEnd = toMinutes(settings.lunchEnd);
        if (cur < lunchStart) return cur - start;
        if (cur < lunchEnd) return lunchStart - start;
        return (lunchStart - start) + (Math.min(cur, end) - lunchEnd);
    }

    // ── Suppression: MỘT nguồn sự thật cho "có nhắc hay không" ───────────
    //
    // Trả về lý do chặn (hoặc null nếu được nhắc). Popup dùng đúng hàm này
    // để hiển thị LÝ DO thay vì hiện số đếm ngược sai.

    const SUPPRESS = {
        PAUSED:        'paused',
        NOTIF_OFF:     'notifications_off',
        HOLIDAY:       'holiday',
        WEEKEND:       'weekend',
        LUNCH:         'lunch',
        BEFORE_WORK:   'before_work',
        AFTER_WORK:    'after_work',
        FOCUS:         'focus',
        POMODORO:      'pomodoro',
        IDLE:          'idle',
        LOCKED:        'locked',
        MEETING:       'meeting'
    };

    const SUPPRESS_LABEL = {
        paused:            '⏸️ Đã tạm dừng',
        notifications_off: '🔕 Đã tắt thông báo',
        holiday:           '🎌 Ngày lễ',
        weekend:           '🎉 Ngày nghỉ',
        lunch:             '🍚 Nghỉ trưa',
        before_work:       '⏳ Chưa vào giờ làm',
        after_work:        '🌙 Ngoài giờ làm',
        focus:             '🎯 Focus Mode',
        pomodoro:          '🍅 Pomodoro',
        idle:              '💤 Bạn đang rời máy',
        locked:            '🔒 Máy đang khoá',
        meeting:           '📞 Đang họp'
    };

    /**
     * @param {object} ctx { settings, state, now, idleState, meeting, holidayTable }
     * @returns {string|null} mã lý do chặn, hoặc null nếu nhắc được
     */
    function getSuppressionReason(ctx) {
        const { settings, state, now } = ctx;
        const st = state || {};

        if (settings.isPaused) return SUPPRESS.PAUSED;
        if (settings.notificationEnabled === false) return SUPPRESS.NOTIF_OFF;

        if (st.pomodoroState) return SUPPRESS.POMODORO;
        if (st.focusEndTime && now.getTime() < st.focusEndTime) return SUPPRESS.FOCUS;

        if (ctx.idleState === 'locked') return SUPPRESS.LOCKED;
        if (ctx.idleState === 'idle') return SUPPRESS.IDLE;
        if (ctx.meeting && ctx.meeting.active) return SUPPRESS.MEETING;

        const holiday = checkHoliday(settings, now, ctx.holidayTable);
        if (holiday.isHoliday) return SUPPRESS.HOLIDAY;
        if (!isWorkDay(settings, now, ctx.holidayTable)) return SUPPRESS.WEEKEND;
        if (isLunchBreak(settings, now, ctx.holidayTable)) return SUPPRESS.LUNCH;

        if (!isWorkTime(settings, now, ctx.holidayTable)) {
            const cur = now.getHours() * 60 + now.getMinutes();
            return cur < toMinutes(settings.workStart) ? SUPPRESS.BEFORE_WORK : SUPPRESS.AFTER_WORK;
        }
        return null;
    }

    function shouldDeliverPeriodic(ctx) {
        return getSuppressionReason(ctx) === null;
    }

    // ── Water pace ───────────────────────────────────────────────────────

    /**
     * Chỉ nhắc uống nước khi ĐANG TỤT so với tiến độ ngày, thay vì
     * nhắc theo interval cứng bất kể đã uống bao nhiêu.
     */
    function evaluateWaterPace(opts) {
        const { totalMl, goalMl, settings, now } = opts;
        const goal = Number(goalMl) || 2000;
        const drunk = Number(totalMl) || 0;
        const totalMin = workMinutesToday(settings, now);
        const elapsed = Math.max(0, Math.min(workMinutesElapsed(settings, now), totalMin));

        if (totalMin <= 0) return { behind: false, expectedMl: 0, deficitMl: 0, ratio: 1 };

        const expectedMl = Math.round(goal * (elapsed / totalMin));
        const deficitMl = Math.max(0, expectedMl - drunk);
        const cup = Number(settings.waterCupMl) || 200;

        return {
            expectedMl,
            deficitMl,
            behind: deficitMl >= cup,                       // tụt ít nhất 1 ly mới nhắc
            severe: deficitMl >= cup * 3,
            ratio: goal > 0 ? drunk / goal : 1
        };
    }

    // ── Meeting detection (tab-based, không cần calendar/OAuth) ──────────

    const MEETING_HOSTS = [
        'meet.google.com',
        'zoom.us',
        'teams.microsoft.com',
        'teams.live.com',
        'whereby.com',
        'gather.town',
        'webex.com',
        'discord.com/channels'
    ];

    function isMeetingUrl(url) {
        if (!url) return false;
        const u = String(url).toLowerCase();
        return MEETING_HOSTS.some(h => u.includes(h));
    }

    /**
     * Họp = có tab hội thoại VÀ tab đó phát tiếng trong `graceMs` gần đây.
     * `audible` một mình không đủ (tab Meet để mở im lặng), nên dùng
     * lastAudibleAt để giữ trạng thái qua các khoảng im ngắn.
     */
    function evaluateMeeting(tabs, lastAudibleAt, now, graceMs) {
        const grace = graceMs == null ? 60000 : graceMs;
        const meetingTabs = (tabs || []).filter(t => isMeetingUrl(t.url));
        if (meetingTabs.length === 0) return { active: false, tabId: null, audibleNow: false };

        const audible = meetingTabs.find(t => t.audible);
        if (audible) return { active: true, tabId: audible.id, audibleNow: true };

        if (lastAudibleAt && (now.getTime() - lastAudibleAt) <= grace) {
            return { active: true, tabId: meetingTabs[0].id, audibleNow: false };
        }
        return { active: false, tabId: meetingTabs[0].id, audibleNow: false };
    }

    // ── Adaptive intervals ───────────────────────────────────────────────

    /**
     * Bỏ qua liên tiếp -> giãn interval 1 bậc (tối đa 2x default).
     * Bấm "đã làm" -> co lại dần về default. Có sàn/trần để không
     * bao giờ trôi thành "không nhắc nữa".
     */
    function adaptInterval(current, defaultMinutes, stats, opts) {
        const cfg = Object.assign({ dismissThreshold: 3, step: 1.5, maxFactor: 2 }, opts);
        const cur = Number(current) || defaultMinutes;
        const dismissed = (stats && stats.consecutiveDismissed) || 0;
        const done = (stats && stats.consecutiveDone) || 0;

        let next = cur;
        if (dismissed >= cfg.dismissThreshold) next = cur * cfg.step;
        else if (done >= cfg.dismissThreshold) next = cur / cfg.step;

        const min = defaultMinutes;
        const max = defaultMinutes * cfg.maxFactor;
        next = Math.min(max, Math.max(min, Math.round(next)));
        return Math.min(MAX_INTERVAL_MINUTES, Math.max(MIN_INTERVAL_MINUTES, next));
    }

    // ── Alarm diffing (không clearAll -> không re-phase mọi nhắc nhở) ────

    /**
     * So alarm hiện có với interval mong muốn, chỉ trả về những alarm
     * THẬT SỰ cần tạo lại. Bug cũ: setupAlarms() clearAll() rồi tạo lại
     * hết, nên mỗi lần Save Settings là đặt lại đồng hồ mọi nhắc nhở về 0.
     */
    function diffAlarms(existingAlarms, desired) {
        const byName = new Map((existingAlarms || []).map(a => [a.name, a]));
        const toCreate = [];
        const toClear = [];

        for (const [name, minutes] of Object.entries(desired)) {
            const cur = byName.get(name);
            if (!cur) {
                toCreate.push({ name, periodInMinutes: minutes });
            } else if (Math.abs((cur.periodInMinutes || 0) - minutes) > 1e-9) {
                toClear.push(name);
                toCreate.push({ name, periodInMinutes: minutes });
            }
            byName.delete(name);
        }
        return { toCreate, toClear, untouched: [...byName.keys()] };
    }

    return {
        // intervals
        DEFAULT_INTERVALS, INTERVAL_KEYS, MIN_INTERVAL_MINUTES, MAX_INTERVAL_MINUTES,
        MICRO_REMINDERS, ACTION_NOTIFICATION_BUDGET,
        normalizeIntervals, countDailyNotifications, adaptInterval,
        // dates
        toLocalDateKey, fromLocalDateKey, parseAnyDateKey, dayDiff,
        // todo
        migrateAndPruneHistory, resolveStreakOnRollover, bumpStreakOnComplete,
        // escaping
        escapeHtml, escapeTelegram,
        // holidays
        VN_HOLIDAYS_FIXED, VN_HOLIDAYS_LUNAR, HOLIDAY_TABLE_LAST_YEAR,
        getVnHolidays, buildHolidayTable, checkHoliday,
        // schedule
        toMinutes, isWithinWorkPeriod, isWorkDay, isHalfDay, getTodayWorkEnd,
        isLunchBreak, isWorkTime, isMorningReminderWindow,
        workMinutesToday, workMinutesElapsed,
        // suppression
        SUPPRESS, SUPPRESS_LABEL, getSuppressionReason, shouldDeliverPeriodic,
        // water + meeting
        evaluateWaterPace, MEETING_HOSTS, isMeetingUrl, evaluateMeeting,
        // alarms
        diffAlarms
    };
});
