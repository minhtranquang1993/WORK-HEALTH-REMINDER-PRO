// Harness giả lập chrome.* API để chạy background.js (service worker) trong node.
// Nhờ vậy các bug ở tầng tích hợp (alarm bị xoá sạch khi save, guard đặt sai
// chỗ, cờ ngày kẹt, nút notification...) được kiểm bằng test thật.
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const EXT_DIR = path.join(__dirname, '..', '..', 'chrome-extension');

function createChromeStub() {
    const listeners = {
        alarm: [], message: [], installed: [], startup: [],
        notifClicked: [], notifButton: [], notifClosed: [],
        idle: [], tabsUpdated: [], tabsRemoved: [], command: []
    };

    const store = { local: {}, session: {} };
    const alarms = new Map();
    const notifications = [];
    const created = [];   // log mọi notification đã tạo (kể cả bị thay thế)

    const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

    function areaApi(area) {
        return {
            async get(keys) {
                const out = {};
                if (keys == null) return clone(store[area]);
                const list = typeof keys === 'string' ? [keys] : (Array.isArray(keys) ? keys : Object.keys(keys));
                for (const k of list) {
                    if (store[area][k] !== undefined) out[k] = clone(store[area][k]);
                }
                return out;
            },
            async set(obj) {
                for (const [k, v] of Object.entries(obj)) store[area][k] = clone(v);
            },
            async remove(keys) {
                const list = typeof keys === 'string' ? [keys] : keys;
                for (const k of list) delete store[area][k];
            }
        };
    }

    const chrome = {
        runtime: {
            id: 'test-extension-id',
            lastError: null,
            onInstalled: { addListener: (fn) => listeners.installed.push(fn) },
            onStartup: { addListener: (fn) => listeners.startup.push(fn) },
            onMessage: { addListener: (fn) => listeners.message.push(fn) }
        },
        storage: {
            local: areaApi('local'),
            session: areaApi('session')
        },
        alarms: {
            async getAll() {
                return [...alarms.values()].map(clone);
            },
            async get(name) {
                return clone(alarms.get(name));
            },
            create(name, info) {
                alarms.set(name, {
                    name,
                    periodInMinutes: info.periodInMinutes,
                    scheduledTime: info.when || (Date.now() + (info.delayInMinutes || info.periodInMinutes || 0) * 60000)
                });
            },
            async clear(name) {
                return alarms.delete(name);
            },
            async clearAll() {
                alarms.clear();
                return true;
            },
            onAlarm: { addListener: (fn) => listeners.alarm.push(fn) }
        },
        notifications: {
            create(id, options, cb) {
                const existing = notifications.findIndex(n => n.id === id);
                const entry = { id, options: clone(options) };
                if (existing >= 0) notifications[existing] = entry;
                else notifications.push(entry);
                created.push(entry);
                if (cb) cb(id);
            },
            clear(id) {
                const i = notifications.findIndex(n => n.id === id);
                if (i >= 0) notifications.splice(i, 1);
            },
            onClicked: { addListener: (fn) => listeners.notifClicked.push(fn) },
            onButtonClicked: { addListener: (fn) => listeners.notifButton.push(fn) },
            onClosed: { addListener: (fn) => listeners.notifClosed.push(fn) }
        },
        idle: {
            _state: 'active',
            setDetectionInterval() {},
            async queryState() { return chrome.idle._state; },
            onStateChanged: { addListener: (fn) => listeners.idle.push(fn) }
        },
        tabs: {
            _tabs: [],
            async query(q) {
                if (!q || !q.url) return clone(chrome.tabs._tabs);
                return clone(chrome.tabs._tabs.filter(t => (t.url || '').includes('youtube.com')));
            },
            async get(id) {
                const t = chrome.tabs._tabs.find(x => x.id === id);
                if (!t) throw new Error('No tab with id ' + id);
                return clone(t);
            },
            async sendMessage() { throw new Error('no receiver'); },
            async remove(id) {
                chrome.tabs._tabs = chrome.tabs._tabs.filter(t => t.id !== id);
            },
            onUpdated: { addListener: (fn) => listeners.tabsUpdated.push(fn) },
            onRemoved: { addListener: (fn) => listeners.tabsRemoved.push(fn) }
        },
        scripting: { async executeScript() { return []; } },
        commands: { onCommand: { addListener: (fn) => listeners.command.push(fn) } }
    };

    return { chrome, listeners, store, alarms, notifications, created };
}

/** Nạp background.js vào sandbox với chrome stub. */
function loadBackground(opts) {
    const cfg = opts || {};
    const stub = createChromeStub();
    const fetchCalls = [];

    const sandbox = {
        chrome: stub.chrome,
        console: cfg.quiet === false ? console : { log() {}, warn() {}, error() {} },
        setTimeout, clearTimeout, setInterval, clearInterval,
        Date, JSON, Math, Object, Array, String, Number, Boolean, Error,
        Promise, Map, Set, RegExp, isNaN, parseInt, parseFloat,
        fetch: async (url, init) => {
            fetchCalls.push({ url, init });
            if (cfg.fetchImpl) return cfg.fetchImpl(url, init);
            return { ok: true, status: 200, json: async () => ({ ok: true }) };
        },
        importScripts(rel) {
            const code = fs.readFileSync(path.join(EXT_DIR, rel), 'utf8');
            vm.runInContext(code, sandbox.__ctx, { filename: rel });
        }
    };
    sandbox.self = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.addEventListener = () => {};
    sandbox.self.addEventListener = () => {};

    const ctx = vm.createContext(sandbox);
    sandbox.__ctx = ctx;

    const code = fs.readFileSync(path.join(EXT_DIR, 'background.js'), 'utf8');
    vm.runInContext(code, ctx, { filename: 'background.js' });

    return { sandbox, ctx, fetchCalls, ...stub };
}

/** Gọi handler message như popup gửi tới, trả về response. */
function sendMessage(bg, message, sender) {
    return new Promise((resolve, reject) => {
        const fn = bg.listeners.message[0];
        if (!fn) return reject(new Error('chưa có onMessage listener'));
        const ok = fn(message, sender || {}, resolve);
        if (!ok) reject(new Error('listener không trả true'));
    });
}

async function fireAlarm(bg, name) {
    for (const fn of bg.listeners.alarm) {
        await fn({ name, scheduledTime: Date.now() });
    }
}

async function runInstalled(bg) {
    for (const fn of bg.listeners.installed) await fn();
}

async function runStartup(bg) {
    for (const fn of bg.listeners.startup) await fn();
}

module.exports = { loadBackground, sendMessage, fireAlarm, runInstalled, runStartup, EXT_DIR };
