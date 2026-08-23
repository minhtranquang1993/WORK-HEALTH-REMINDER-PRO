# Improvement Brief — Work Health Reminder PRO

> **Trạng thái: ĐÃ THỰC THI XONG** (v3.2.0). Tài liệu này giữ lại để ghi lý do
> đằng sau các thay đổi — defect nào, vì sao sửa thế, và đánh đổi gì.
> Toàn bộ 28 defect bên dưới đã sửa, mỗi cái có test khoá lại (`npm test` — 145 test).
> Review độc lập vòng 1: `REVISE` (23 issue) — đã xử lý hết; xem mục 8.

---

## 1. Hiện trạng

25 file, không có `package.json`, không test, không lint, không CI.

| Nhóm | File | Dòng |
|---|---|---|
| Extension | `chrome-extension/background.js` | 1888 |
| | `chrome-extension/popup.js` | 1659 |
| | `chrome-extension/popup.css` | 2437 |
| | `chrome-extension/popup.html` | 568 |
| | `chrome-extension/youtube-content.js` | 395 |
| | `chrome-extension/facebook-content.js` | 471 (**chết**) |
| | `chrome-extension/exercises.js` | 283 |
| Python | `menubar_app.py` | 1999 |
| | `reminder_pro.py` / `reminder_gui.py` / `reminder.py` | 507 / 538 / 279 |
| | `calendar_sync.py` | 401 (**chết**) |
| | `exercises.py` / `water_tracker.py` | 215 / 190 |
| Web | `index.html` + `app.js` + `styles.css` | bản implement thứ 4 |

Điểm cốt lõi: **cùng một bộ luật nhắc nhở được viết lại 4 lần** (extension JS, menubar Python, terminal Python, web JS) và **không bản nào được test**.

---

## 2. Danh sách defect (đã verify từng dòng)

### Nghiêm trọng — feature chết / tự phá hoại

| # | Vấn đề | Vị trí |
|---|---|---|
| **D1** | `showCustomNotification(...)` được gọi nhưng **không tồn tại** → uống đủ 2000ml sẽ throw `ReferenceError` trong `.then()`, không có thông báo chúc mừng. Feature chết ngay từ đầu. | background.js:903 |
| **D2** | `blink: 2` phút → notification 2 phút/lần suốt giờ làm ≈ **240 thông báo/ngày**. Đây là default đang ship. | background.js:42 |
| **D3** | `saveSettings` **hardcode** 5 interval mà UI không có: `blink:15`, `neck_stretch:60`, `toilet:60`, `eye_exercise:90`, `breathing:120`. Bấm Save = ghi đè im lặng cài đặt user. Thêm 2 chỗ lệch default: `water` (30 vs 45), `posture` (20 vs 45). README ghi con số thứ ba. | popup.js:1311-1321, popup.js:1250-1253 |
| **D4** | **Hai hệ thống thời gian không liên quan nhau**: `chrome.alarms` thật (quyết định khi nào thông báo nổ) và một dict `timers` đếm ngược trong storage (thứ user nhìn thấy). Số đếm ngược trên popup **không có quan hệ nhân quả** với lúc thông báo thực sự bật. Nút "reset timer" chỉ reset con số hiển thị, không reschedule alarm. | background.js:308-316 vs 804-844; 1189 |
| **D24** | **Cờ ngày bị kẹt vĩnh viễn.** `onStartup` gọi `setupAlarms()` → `clearAll()` xoá alarm `DAILY_RESET` trước khi nó chạy. Cờ `nightModeReminded` được persist → nhắc Night Mode / đi ngủ / buổi sáng **tắt vĩnh viễn** với người tắt Chrome qua đêm (đa số). | background.js:1759-1774 → 293; guard 680/687/694 |
| **D25** | (a) Guard `notificationEnabled` nằm **sau** khối nhắc giờ cố định → tắt "Bật thông báo" vẫn nhận lunch / hết giờ làm / night mode / ngủ / sáng / 2 todo. **Công tắc tắt mà không tắt.** (b) `END_WORK` không check `isWorkDay` → "Hết giờ làm việc!" nổ 17:30 **Thứ 7, Chủ nhật và ngày lễ**. | (a) background.js:725 vs 670-717 · (b) 336-342, 675-678 |

### Trung bình — sai dữ liệu / rò rỉ / hiệu năng

| # | Vấn đề | Vị trí |
|---|---|---|
| **D5** | Popup poll `getStatus` mỗi 1000ms, mỗi lần **ghi storage** → ~1 write/giây khi popup mở, service worker không bao giờ ngủ. | popup.js:315, background.js:970 |
| **D6** | `escapeHtml` dùng `textContent`→`innerHTML`, **không escape dấu `"`**, rồi nội suy vào `title="..."`. Tiêu đề video YouTube chứa dấu ngoặc kép → phá vỡ attribute, inject HTML vào popup. Tương tự tên ngày lễ do user nhập. | popup.js:826, dùng tại 800 và 1135 |
| **D7** | Prune history dùng `Object.keys().sort()` trên key `toDateString()` ("Sun Aug 23 2026") → **sort alphabet, không theo thời gian**. Verify bằng node: `Mon Aug 24` đứng trước `Sun Aug 23`. Xoá ngày ngẫu nhiên, và chỉ xoá 1 mỗi lần. | background.js:1339-1343 |
| **D8** | **Streak không bao giờ đứt.** Chỉ có đường tăng, không có logic "bỏ 1 ngày → reset 0". Số streak cũ hiển thị mãi mãi. | background.js:1429, 1275 |
| **D9** | `youtubeState` là biến module in-memory, **không persist**. MV3 kill service worker sau ~30s idle → tab YouTube đang chọn mất im lặng giữa 2 lần mở popup. | background.js:79-83 |
| **D10** | `POMODORO_CHECK` `periodInMinutes: 0.1` (comment ghi "6 seconds" — Chrome clamp sàn 30s) **cộng** `STATUS_CHECK` 1 phút → đánh thức service worker **~2.880 lần/ngày, vĩnh viễn**, cả đêm, cuối tuần, ngày lễ, kể cả khi không có session. Chi phí idle lớn nhất, lớn hơn D5. | background.js:296-299 |
| **D14** | Không dùng `chrome.idle` ở bất kỳ đâu → nhắc "uống nước" cho cái ghế trống / máy đang lock. Thêm nữa notification id là `type + '_' + Date.now()` (unique mỗi lần) nên thông báo cũ **xếp đống** trong Notification Center thay vì thay thế nhau. | background.js:872 |
| **D26** | Đường YouTube tốn hơn D5 và **không phụ thuộc popup**: MutationObserver trên cả `document.body` với `subtree:true`, poll ad-skip 500ms qua 6 selector, push state 2s, cộng 1 vòng poll focus 2s riêng. Và **không có init guard** ở cuối file → mỗi lần re-inject tạo thêm 1 controller với đủ bộ interval + observer. | youtube-content.js:78, 120, 139, 263-277, cuối file; popup.js:344-347; background.js:1516-1521 |
| **D27** | **Bridge localhost rò rỉ hoạt động browsing.** Extension POST title + URL video sang `http://localhost:9876` mỗi ~2s; menubar app trả lại qua GET với `Access-Control-Allow-Origin: *`. Bất kỳ website nào user ghé cũng đọc được đang xem gì, và POST được state giả. | background.js:1718-1730; menubar_app.py:261-263, 344-350 |
| **D19** | Telegram bot token lưu plaintext trong `storage.local` **và** được gửi kèm cả object `settings` sang popup mỗi lần poll `getStatus` (1 giây/lần). Input là `type=password` nhưng token thật được ghi lại vào DOM mỗi lần mở popup. | background.js:981-991; popup.js:1244 |
| **D20** | Báo cáo Telegram bị bỏ **im lặng**: chỉ schedule nếu giờ báo còn ở tương lai, không có cờ "đã gửi hôm nay", không catch-up, không retry. Chrome đóng lúc 17:00 = mất báo cáo. | background.js:390, 1862-1887 |

### Thấp — nợ kỹ thuật / thiếu tự động hoá

| # | Vấn đề |
|---|---|
| **D11** | `soundEnabled` có trong settings, **không được đọc ở đâu cả**. Không có tiếng, không có UI. Setting chết. |
| **D12** | Code chết: `chrome-extension/facebook-content.js` (471 dòng, không có trong manifest, không inject ở đâu) và `calendar_sync.py` (401 dòng, không file nào import). Feature ICS đã bị xoá ở commit `4b40d8f..0f5be8e` nhưng file còn lại. |
| **D13** | 4 entrypoint Python chồng chéo + 1 bản web, mỗi bản tự viết lại luật giờ làm. |
| **D15** | Extension **không biết gì về họp**. Feature ICS đã xoá, không có gì thay thế. Mà README.md:3 vẫn quảng cáo "tự động dừng khi họp" — claim sai. |
| **D16** | Notification không có action button, không snooze, không "đã làm", không "+200ml". **Mọi hành động đều phải mở popup.** |
| **D17** | Settings chỉ ở `storage.local`, 0 chỗ dùng `storage.sync` → không theo user sang máy khác, dù app được quảng cáo là cross-machine. |
| **D18** | Không có onboarding lần đầu. `isConfigured` được ghi nhưng **không bao giờ được đọc** để gate cái gì. |
| **D21** | Popup là **dark-only** (0 chỗ dùng `prefers-color-scheme`), không có light theme. |
| **D22** | manifest ghi `3.1.0`, cả 4 header JS/CSS ghi "Version 3.0". |
| **D23** | Quyền `tabs` (đọc URL + title mọi tab) là rộng nhất và `activeTab` dư thừa bên cạnh `tabs`+`scripting`. Không có `chrome.commands`, không `options_page`, không i18n; toàn bộ settings nhồi vào popup 380px. |
| **D28** | Bấm nút **Test Telegram** gọi `saveSettings()` trước → cũng ghi đè toàn bộ interval và re-phase mọi alarm. |

---

## 3. Mục tiêu đo được

| # | Mục tiêu | Cách đo |
|---|---|---|
| G1a | Số thông báo/ngày làm 8h với default **≤ 40** (hiện ~240 chỉ riêng blink) | đếm alarm × số phút làm việc |
| G1b | `saveSettings` và `testTelegram` round-trip **cả 9** interval y nguyên; tập **tên alarm** trước/sau khi save phải giống nhau | `chrome.alarms.getAll()` |
| G1c | `notificationEnabled: false` → **0** thông báo mọi loại | scripted |
| G2 | Popup mở → **0 write/giây** trên đường đếm ngược (hiện ~1/s) | đếm `storage.local.set` trong 60s |
| G3 | Popup chỉ hiện số đếm ngược **khi nhắc nhở đó thật sự sẽ nổ**; lúc bị chặn thì hiện **lý do**. Khi hiện, sai ≤ 1s so với `scheduledTime` | so với `alarms.getAll()` |
| G4 | Chặn khi idle ≥ **5 phút** hoặc máy lock; chặn khi phát hiện họp (tab meet/zoom/teams **và** `tab.audible` trong 60s) | scripted state transitions |
| G5 | 0 unhandled rejection qua 1 ngày mô phỏng | listener + ring buffer thêm ở Phase A |
| G6 | Mọi string do user/web kiểm soát (title YouTube, tên ngày lễ, todo) chịu được fuzz `"` `'` `<` `>` `&` | test |
| G7 | History prune đúng thứ tự thời gian, giữ đúng 30 ngày; streak reset sau 1 ngày bỏ | test |
| G8 | Service worker wake/giờ idle: ~120 → ~0 khi không có session/popup | đếm wake |

---

## 4. Kế hoạch theo phase

### PHASE A — Đúng đắn + hết ồn (diff nhỏ, giá trị cao nhất)

- **A1** Thêm `showCustomNotification` còn thiếu. `[D1]`
- **A2** Interval một nguồn sự thật, **chỉ sửa data, chưa làm UI** (xem Q4):
  (a) deep-merge `intervals` trong `updateSettings` — hiện là shallow merge (background.js:1072) nên nếu chỉ gửi 4 interval mà UI có, 5 interval còn lại thành `undefined` → `alarms.create` throw → **mất luôn** lunch/hết giờ/ngủ/sáng/todo/Telegram. Đây là cái bẫy nghiêm trọng nhất reviewer bắt được;
  (b) `normalizeIntervals()` ép mọi key về số hữu hạn ≥ 1 với fallback default, `setupAlarms` bọc try/catch;
  (c) bỏ hardcode trong `saveSettings`, sửa fallback trong `loadSettings`;
  (d) `testTelegram` chỉ gửi 2 field Telegram `[D28]`;
  (e) chốt 1 giá trị blink, đồng bộ bảng README. `[D2][D3]`
- **A2a** Bỏ `clearAll()` khỏi `setupAlarms`, chỉ clear+create alarm nào **interval thật sự đổi**. Không có bước này thì A2 làm bug re-phase nổ thường xuyên hơn. `[D4 phần 2]`
- **A3** Một helper escape phủ `& < > " '`, áp dụng ở mọi chỗ nội suy. `[D6]`
- **A4** Migration key history đúng cách: `storageSchemaVersion` + `runMigrations()` idempotent gọi từ **cả** `onInstalled` và `onStartup`; `toLocalDateKey()`; sửa **cả 2** chỗ ghi history (1289 và 1406); prune hết phần dư; label thứ trong chart phải dựng `Date(y, m-1, d)` **local** thay vì parse `'YYYY-MM-DD'` (bị hiểu là UTC → lệch 1 ngày ở múi giờ âm). `[D7]`
- **A5** Logic đứt streak. `[D8]`
- **A6** Chỉ persist `selectedTabId`, vào `chrome.storage.session` (đúng lifetime, không cần quyền mới), và **validate `tab.url`** trước khi inject — tab id bị cấp lại sau restart nên persist vào `local` sẽ inject script YouTube vào tab lạ. `[D9]`
- **A7** (a) `0.1` → `0.5` + sửa comment; (b) sau A2a: thay poll bằng one-shot alarm đúng giờ kết thúc, chỉ giữ check alarm khi có session. `[D10]`
- **A8** Xoá `facebook-content.js` + `calendar_sync.py`; xử lý `soundEnabled`; sửa claim "tự động dừng khi họp" ở README; đồng bộ version. `[D11][D12][D22]`
- **A9** Đưa guard `notificationEnabled` lên ngay sau `isPaused`; thêm `isWorkDay` cho `END_WORK`. `[D25]`
- **A10** **Một** cơ chế reconcile ngày: persist `lastDailyResetDate`; ở `onStartup`/`onInstalled`/mỗi tick, nếu không phải hôm nay → reset cờ + reset todo + catch-up Telegram. Gộp luôn D20. `[D24][D20]`
- **A11** Init guard cho content script; MutationObserver thu hẹp về player container; bỏ poll focus 2s (đổi sang push); bỏ `sleep(500)`; notification id **ổn định theo type** để thông báo mới thay thế thông báo cũ. `[D26][D14]`
- **A12** Tách logic thuần (`isWorkTime`, `isWorkDay`, `checkHoliday`, normalize interval, escape, prune history, streak) ra 1 module + `node --test` — để G1/G3/G6/G7 đo được **ngay cả khi** Minh chỉ chọn A+B.

### PHASE B — Một nguồn sự thật cho thời gian

- **B1** Xoá hẳn hệ `timers`/`lastUpdate` ở **cả 10 chỗ** (background.js:281, 657-660, 804-865, 939-971, 1160-1186, 1189-1199, 1207-1209, 1470-1472, 1762-1771 + popup.js:388-397), xoá luôn alarm `STATUS_CHECK` đã thành vô dụng, định nghĩa lại contract `resetAll`/`togglePause`/`resetTimer`. Popup tính đếm ngược từ `chrome.alarms.getAll().scheduledTime`. **−~120 dòng.**
- **B2** `resetTimer` reschedule thật, phải truyền **cả** `when` **và** `periodInMinutes` — chỉ `when` sẽ biến nhắc nhở thành one-shot và im lặng chết.
- **B3** Contract chặn của popup: khi paused / nghỉ trưa / ngoài giờ / Focus / Pomodoro / idle / họp → hiện **lý do**, không hiện số. Đây cũng là bề mặt hiển thị mà C1/C2 cần để suppression không bao giờ fail im lặng, nên B3 là **tiền đề** của C1/C2.

### PHASE C — Automation (đúng câu hỏi của Minh)

- **C1** `chrome.idle` (quyền `idle`, không hiện cảnh báo khi cài): chặn gửi khi idle/lock. **Không** cần chống "dồn burst" — alarm Chrome không xếp hàng, alarm quá hạn chỉ nổ 1 lần khi máy thức. `[D14]`
- **C2** **Tự động Focus khi họp, zero-config, zero quyền mới** (`tabs` đã cho URL + `audible`): thấy tab meet/zoom/teams đang phát tiếng → vào trạng thái "đang họp" hiển thị rõ, tự thoát khi hết, có override tay. Bản thay thế rẻ cho feature ICS mà Minh đã chủ động xoá. `[D15]`
- **C3** Action button trên notification (đã làm / +5 phút / +200ml) — **nhưng phải spike 10 dòng trước**: tạo 1 notification 2 button trên đúng Chrome/macOS của Minh và xác nhận event button-click + dismiss có nổ. Chrome trên macOS đi qua notification system native và **đã** bỏ qua `requireInteraction` (xem chính comment tại background.js:878). Spike fail → fallback là C4 + deep-link. `[D16]`
- **C4** `chrome.commands`: tối đa **4** `suggested_key` (Chrome từ chối load nếu hơn), dạng toggle — +1 ly nước, Focus, Pomodoro, pause.
- **C5** Interval thích ứng theo compliance (opt-in, có sàn/trần, có reset) — **phụ thuộc spike C3**, vì tín hiệu "bỏ qua vs đã làm" chỉ đến từ đó. Spike fail → cắt C5.
- **C6** Nước theo **pace**: chỉ nhắc khi đang tụt so với số giờ đã làm, thay vì interval cứng. Dùng luôn water log đã có.
- **C7** Telegram: (a) gộp vào A10 (catch-up + 1 retry); (b) báo cáo thêm % nước, số pomodoro, compliance — rẻ, cộng thêm; (c) hai chiều `/done`, `/add` — **tôi đề nghị cắt**: bắt buộc allowlist cứng `chat.id`, không thì thành đường ghi dữ liệu không xác thực; thêm nữa `getUpdates` bị chặn bởi sàn 30s của alarm và chết mỗi khi Chrome đóng.
- **C8** `storage.sync` **chỉ cho preference**: token/chat id Telegram **ở lại local** (sync 1 bearer credential lên Google account và mọi profile đăng nhập còn tệ hơn hiện trạng D19); `customHolidays` tách item riêng có giới hạn độ dài (mảng không chặn, quota 8KB/item sẽ reject); mọi write sync đều check size + handle lỗi + fallback local. `[D17][D19]`

### PHASE D — Vệ sinh (chỉ khi Minh muốn rộng tới đây)

- **D-1** eslint + CI trên nền module test của A12.
- **D-2** `options_page` cho settings + onboarding lần đầu gate bằng `isConfigured` — **và đây là nơi đặt 9 input interval**. Chốt D-2 in/out ở GATE 1 để không làm UI 2 lần. `[D18][D23]`
- **D-3a** Chỉ sửa doc: tuyên bố `reminder_pro.py` / `reminder_gui.py` / `reminder.py` / `index.html`+`app.js` là **demo legacy không hỗ trợ**; `menubar_app.py` là bản macOS được hỗ trợ. **Nên làm.**
- **D-3b** Gộp core luật dùng chung JS↔Python (~3.400 dòng, 0 test) — **CẮT**, đây là rewrite chứ không phải improve. `[D13]`
- **D-4** Light theme — **CẮT** (xem D21: phải bóc CSS custom property qua 2.437 dòng màu hardcode, và đụng điều khoản "không redesign popup").
- **D-5** Chỉ còn: cảnh báo rõ "bảng ngày lễ hết hạn sau 2027" + task cập nhật hàng năm (bảng này còn bị nhân bản trong `menubar_app.py`). Tính ngày âm lịch trong extension là thêm dependency + thêm rủi ro sai.
- **D-6** Khoá bridge localhost: thay `Access-Control-Allow-Origin: *` bằng origin extension cụ thể hoặc shared-secret header, và khai `http://localhost:9876/*` vào `host_permissions` cho auditable. `[D27]`
- **D-7** Xem lại bỏ `activeTab` dư thừa, và liệu `scripting` + host permission có thay được quyền `tabs` rộng. `[D23]`

---

## 5. Rủi ro regression

- **A2 là item rủi ro cao nhất *vì* bản fix, không phải dù có fix**: deep-merge + normalize + try/catch phải vào cùng lúc, và G1b (tập tên alarm không đổi) là cổng chặn.
- **A4** phải sửa cả 2 chỗ ghi history và chạy idempotent, không thì history âm thầm trộn 2 format key và label thứ trong chart lệch 1 ngày.
- **B1** đụng 10 chỗ + contract popup → phải chụp checklist hành vi hiện tại **trước** khi thay, cộng test của A12.
- **C1/C2** thêm đường suppression, failure mode là "không bao giờ nhắc nữa" → B3 (hiện lý do) là tiền đề bắt buộc.
- **C2** heuristic tab sẽ bắt sai với tab Meet đang mute hoặc tab YouTube đang phát tiếng → cần override tay.
- **C3/C5** treo trên 1 capability chưa verify → spike là việc đầu tiên của Phase C.
- **A8** xoá file đã commit (lấy lại được từ git).
- **A11** đổi notification id từ unique sang theo-type: **đổi hành vi có chủ ý** (nhắc mới thay thế nhắc cũ cùng loại thay vì xếp đống).

---

## 6. Ngoài phạm vi (cố ý không đụng)

- Feature set / UI rumps của menubar app.
- Thêm lại OAuth Google Calendar (C2 là bản thay thế rẻ; Minh đã chủ động xoá ICS).
- Đóng gói / publish Chrome Web Store.
- Redesign ngôn ngữ thị giác của `popup.css`.

**Đã thu hẹp**: bridge localhost giờ **nằm trong** phạm vi ở cả 2 phía (D-6) — dữ liệu bị rò là dữ liệu của extension, và loại nó khỏi scope đồng nghĩa đảm bảo không ai nhìn tới nó.

---

## 7. Câu hỏi cần Minh chốt (GATE 1)

1. **Phạm vi**: chỉ A / A+B / A+B+C / tất cả kể cả D?
2. Extension giờ là **sản phẩm chính**, app Python là phụ? (quyết định cách viết D-3a)
3. **Nhắc chớp mắt**: giữ không, và interval bao nhiêu? (2 phút hiện tại không dùng được; README ghi 15)
4. **Bề mặt settings**: làm 9 input interval vào popup 380px ngay, hay chờ options page (D-2)? Chốt để không làm UI 2 lần.
5. **Telegram hai chiều** (C7c): tôi đề nghị cắt — Minh xác nhận?

---

## 8. Ghi chú review

Vòng 1: reviewer chính (`minai93`) trả HTTP 401 → fallback sang reviewer agent read-only độc lập theo contract skill. Verdict **REVISE, 23 issue**.

Tôi tự verify lại từng issue trên code chứ không nhận nguyên. Kết quả:

**Reviewer đúng, đã bổ sung vào brief**: D24, D25, D26, D27, D28 và cái bẫy critical trong A2 (shallow merge tại background.js:1072).

**Reviewer đúng khi bắt lỗi *của tôi*** — 4 claim đã sửa:
- "Không có dark mode" → **sai**, popup vốn dark-only (popup.css:12-19). Tôi **cắt** hạng mục này thay vì đổi tên nó.
- "Nhắc nhở dồn lại rồi nổ một loạt" → **sai cơ chế**, `chrome.alarms` không xếp hàng. Vấn đề thật là notification id unique làm thông báo xếp đống trong Notification Center.
- "`host_permissions` quá rộng" → **sai**, host permission đã hẹp; cái rộng là quyền `tabs`.
- Vị trí `blink: 15` là popup.js:1316, không phải 1318.

**Tôi tự tìm thêm, không ai nêu**: popup.js:1253 `s.intervals.posture || 45` trong khi default là 20 — chỗ thứ 5 của cùng lỗi D3.

**Tôi phản biện lại reviewer 2 điểm**:
- Reviewer đề nghị đổi D21 thành "thêm light theme tuỳ chọn". Tôi **cắt** thay vì đổi tên, vì scope đã loại redesign popup và việc này phải bóc custom property qua 2.437 dòng.
- Reviewer nói A7 "không an toàn nếu làm trước B3". Đúng về bản chất, nhưng phụ thuộc thật là việc bỏ `clearAll()` — nên tôi **đưa nó lên Phase A thành A2a**, để A7b có tiền đề trong cùng phase.
