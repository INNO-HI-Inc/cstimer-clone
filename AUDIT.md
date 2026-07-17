# 코드 감사 결과 — 개선점 100개

14개 렌즈로 병렬 감사 → 버그 주장은 적대적 검증(반증 시도) → 중복 제거·랭킹.

에이전트 73개 실행, 원시 발견 147개 → 중복 제거 후 100개. ✅ = 실측으로 재현·검증된 버그.


## 요약

Five themes dominate the 147 findings. First, the timer's state machine is the weakest verified surface: a focused <select> kills the spacebar entirely, bare modifier keys commit bogus solves, modals and window blur strand a hold so a later single tap launches a solve, and the WCA inspection penalty is decided by whichever animation frame happened to land last. Second, scramble generation — the app's actual product — has real, measured defects that a solver would notice: clock never emits a 6 (only 29.6% of clock states reachable), 43% of 4x4 scrambles contain a wasted whole-cube rotation, 3BLD reaches 16 of 24 orientations, and the "2x2 CLL" trainer produces a genuine CLL case 0.04% of the time. Third, data durability is the most alarming area: importData assigns unvalidated JSON straight to DB and permanently bricks the app on every reload; undo re-inserts a deleted solve into whatever session is current; quota exhaustion silently drops every new solve while feat_data hoards 2.7MB of reclaimable backups; and "delete all data" leaves three restorable full copies behind a confirm that says "cannot be undone." Fourth, accessibility fails at the primitives — no live region for the solve time, no focus management in 15 dialogs, an invisible focus ring on 21 toggles, and light-theme text at 1.82:1. Fifth, the whole delivery pipeline is ungated: eight modules ship self-tests that exit(1) and nothing runs them, while a cache-first service worker means one forgotten CACHE_VERSION bump strands every returning user permanently. The top 50 buys a timer that no longer mis-records or drops solves, scrambles a competitor can trust, storage that fails loudly instead of silently, keyboard and screen-reader access to the core loop, and a CI gate plus a self-healing SW so the next fix actually ships. Work is balanced for parallel implementers: 20 core-app, 10 core-ui, 9 core-logic, 6 packs, 5 infra — with cross-batch coupling (placeholder text, body classes, App exports) called out inside each fix.


## 상위 50개 — 구현 대상

| # | 검증 | 배치 | 심각도 | 개선점 | 파일 |
|---|---|---|---|---|---|
| 1 | ✅ | core-app | high | uiBlocked() treats a focused <select> as a text field — spacebar is dead after every event/session pick | `js/app.js:375` |
| 2 | ✅ | core-app | high | #metroBox is reparented to <body> with inline display:block and becomes a stray full-height flex column | `js/app.js:891` |
| 3 | ✅ | core-app | high | undoAction()/undo toast insert a deleted solve into whatever session is current — cross-session corruption | `js/app.js:518` |
| 4 | ✅ | packs | high | Long-press quick-action sheet ghost-taps its own buttons and silently DNFs the pressed solve | `js/mobile.js:147` |
| 5 | ✅ | core-app | high | importData() assigns unvalidated JSON to DB and permanently bricks the app on every reload | `js/app.js:1287` |
| 6 | ✅ | core-app | high | localStorage quota exceeded silently discards every subsequent solve; a 2.6s toast is the only signal | `js/app.js:90` |
| 7 | ✅ | core-logic | high | Clock scrambles never turn a dial to 6 and turn it to 0 twice as often — 70% of clock states unreachable | `js/draw_clock.js:160` |
| 8 | ✅ | infra | high | Cache-first service worker never revalidates — a forgotten CACHE_VERSION bump strands every user on the old build forever | `sw.js:66` |
| 9 |  | infra | high | No CI: 8 modules ship self-tests that exit(1), and Pages deploys straight from main with zero gates | `.github/workflows/ci.yml` |
| 10 | ✅ | core-app | medium | A bare modifier key stops a running solve and commits a bogus time | `js/app.js:421` |
| 11 | ✅ | core-logic | medium | 4x4 and 6x6 scrambles contain pure whole-cube rotations — 43% of 4x4 scrambles waste 2 moves | `js/scramble.js:29` |
| 12 | ✅ | core-logic | medium | 'trainer: 2x2 CLL' produces an actual CLL case 0.04% of the time — it is a plain 2x2 scramble | `js/scramble.js:156` |
| 13 | ✅ | core-logic | medium | 3BLD orientation suffix reaches only 16 of 24 orientations and emits a trailing space 6% of the time | `js/scramble.js:129` |
| 14 | ✅ | core-logic | medium | parseTime bare-digit ladder is discontinuous: '99' → 1:39.00 but '100' → 1.00 | `js/stats.js:55` |
| 15 |  | core-logic | medium | parseTime applies +2 inconsistently between bare-digit and decimal forms — 2s discrepancy for the same intent | `js/stats.js:63` |
| 16 | ✅ | core-app | medium | 'Delete all data' leaves up to 3 full DB copies in cstc_pack_data_bak with a one-click restore button | `js/app.js:1355` |
| 17 | ✅ | core-app | medium | Multi-touch on #timerPad records one phase split per finger — a two-thumb tap ends a phases=2 solve | `js/app.js:452` |
| 18 | ✅ | core-app | medium | Opening a modal while Space is held strands the hold behind uiBlocked() — one later tap starts a solve | `js/app.js:441` |
| 19 | ✅ | core-app | medium | Window losing focus mid-hold strands the state machine — the next single tap starts with zero hold delay | `js/app.js:444` |
| 20 |  | core-app | medium | WCA inspection penalty is decided by the last rendered frame, not the start instant | `js/app.js:294` |
| 21 |  | core-app | medium | navigator.vibrate(15) fires every animation frame while holding — a continuous buzz, not a ready pulse | `js/app.js:302` |
| 22 |  | core-app | medium | Multi-phase records a spurious extra split and a time that disagrees with the final split | `js/app.js:346` |
| 23 | ✅ | core-app | medium | renderTools() runs twice on every solve — the first render paints a pre-scramble state that is instantly discarded | `js/app.js:223` |
| 24 |  | core-logic | medium | trimmedMean has no hi<=lo guard — averageOf(solves,i,2) returns NaN and renders as a real 'DNF' | `js/stats.js:91` |
| 25 | ✅ | core-logic | low | nnnScramble() hangs the tab forever when faceSet spans a single axis | `js/scramble.js:23` |
| 26 | ✅ | core-app | medium | Canvases are never DPI-scaled — all 6 puzzle diagrams render at 1x and are upscaled on every Retina display | `js/app.js:897` |
| 27 | ✅ | core-ui | medium | Tool dock paints over the +2/DNF quick bar and blocks the click, silently leaving the solve un-penalized | `desktop.css:37` |
| 28 |  | core-ui | high | The desktop timer — the hero element — is the only surface that isn't a card, so it floats in a grey void | `desktop.css:32` |
| 29 | ✅ | core-ui | medium | --g400 is used as raw text colour at 1.82-2.01:1 in light theme and bypasses the theme layer entirely | `style.css:17` |
| 30 | ✅ | core-ui | medium | White-on-accent fails AA at every accent: orange 2.16:1, green 2.77:1, blue 3.71:1 on primary buttons and toasts | `style.css:112` |
| 31 |  | core-ui | medium | Accent text on accent-weak is 3.31:1 — the TDS blue700 'weak foreground' token is missing | `style.css:20` |
| 32 | ✅ | core-ui | medium | The 21 toggle switches have no visible focus indicator — the ring is painted on an opacity:0 element | `style.css:97` |
| 33 |  | core-ui | medium | user-scalable=no blocks pinch-zoom app-wide (WCAG 1.4.4) while doing nothing on iOS, and no touch-action:manipulation exists | `index.html:5` |
| 34 |  | core-ui | medium | Bottom sheets are sized in vh while body uses dvh — the sheet title and ✕ are clipped off-screen on iOS Safari | `mobile.css:154` |
| 35 | ✅ | core-ui | low | Empty state renders 'no solves yet.hold space, release, and go!' — applyI18nStatic destroys the <br> | `index.html:52` |
| 36 |  | core-ui | low | 13 synchronous <script> tags with no defer — 316KB of JS executes before DOMContentLoaded | `index.html:406` |
| 37 | ✅ | core-app | medium | Screen reader users never hear their solve time — #timerDisplay is aria-live="off" and nothing else announces | `js/app.js:353` |
| 38 | ✅ | core-app | medium | All 15 modals declare aria-modal but perform zero focus management, and Tab walks onto 'clear session' | `js/app.js:132` |
| 39 | ✅ | core-app | medium | #scrambleTxt claims role="button" but has no key handler — Space on it starts a solve instead | `js/app.js:1515` |
| 40 | ✅ | core-app | medium | Time list rows are click-only — a keyboard user cannot open, edit or comment any solve but the last | `js/app.js:1539` |
| 41 |  | core-app | medium | <html lang="ko"> is hardcoded and never synced — English UI is read by a Korean speech synthesizer | `js/app.js:1234` |
| 42 | ✅ | infra | medium | Self-host Pretendard: render-blocking CDN with no SRI on a mutable git tag, which the SW refuses to cache | `index.html:12` |
| 43 |  | infra | medium | README declares MIT but no LICENSE file exists — the code is legally all-rights-reserved | `LICENSE` |
| 44 |  | infra | medium | Precache swallows every failure, so a partial install boots a broken shell offline | `sw.js:41` |
| 45 | ✅ | packs | medium | Service worker never tells the page a new version installed — the user silently runs stale code | `js/feat_share.js:55` |
| 46 |  | packs | medium | Storage usage meter under-reports by exactly 2x — shows 72% when the quota is already full | `js/feat_data.js:602` |
| 47 |  | packs | medium | Backup restore wipes the live DB before validating the snapshot, then force-reloads into the wreckage | `js/feat_data.js:211` |
| 48 |  | packs | medium | The relay tool calls ev.gen() with no length, ignoring the user's configured per-event scramble length | `js/feat_tools.js:281` |
| 49 |  | packs | low | σ5/σ12 are computed over the untrimmed window, so they don't describe the ao5/ao12 beside them | `js/feat_stats.js:61` |
| 50 |  | core-logic | medium | timeToString(ms, 0) emits a bogus '.0' — every chart Y-axis tick ≥60s reads '1:00.0' | `js/stats.js:26` |

## 나머지 50개 — 백로그

| # | 검증 | 배치 | 심각도 | 개선점 | 파일 |
|---|---|---|---|---|---|
| 51 |  | core-app | high | bestAverage() rescans every window from scratch on every solve — 1123ms freeze with ao1000 enabled | `js/app.js:642` |
| 52 |  | core-app | high | statsText() recomputes bestAverage for 5/12/50/100 on every render — 126ms at 10k solves, doubled by the duplicate render | `js/app.js:961` |
| 53 |  | core-app | high | renderStats() rebuilds the entire time list innerHTML on every solve — 190ms freeze at 10k solves | `js/app.js:676` |
| 54 |  | core-app | medium | addSolve() runs pbSnapshot twice — two full O(N·n) scans per solve, 22.7ms of pure waste at 10k | `js/app.js:483` |
| 55 |  | core-app | medium | Tapping +2/DNF on the quick bar rebuilds all 10k rows (190ms) to change one cell | `js/app.js:513` |
| 56 |  | core-app | high | Two open tabs clobber each other — whole-DB last-write-wins with no storage listener | `js/app.js:93` |
| 57 |  | core-app | low | No pagehide/visibilitychange flush — the 120ms debounced save can lose the last solve | `js/app.js:90` |
| 58 |  | core-app | medium | copyText fires an unhandled promise rejection and callers toast 'copied' when the copy failed | `js/app.js:1362` |
| 59 |  | core-app | medium | styledConfirm leaks a permanent .modal div into <body> on every Esc or backdrop dismissal | `js/app.js:163` |
| 60 |  | core-app | medium | registerTool's documented onHide is never dispatched — the metronome keeps beeping after you switch tools | `js/app.js:886` |
| 61 |  | core-app | medium | Metronome button flips to 'start' while still beeping — data-i18n="start" collides with the runtime toggle label | `js/app.js:1066` |
| 62 | ✅ | core-app | medium | Tool dropdown labels are frozen in the registration-time language — 17 options stay Korean in an English UI | `js/app.js:867` |
| 63 |  | core-app | medium | DB.version is written but never read — no migration ladder, and a newer export imports into a stale cached client | `js/app.js:87` |
| 64 |  | core-app | medium | csTimer import silently labels unmapped sessions as 3x3 | `js/app.js:1306` |
| 65 |  | core-app | medium | csTimer import truncates solve[0] to 2 elements and throws mid-loop with no rollback | `js/app.js:1311` |
| 66 |  | core-app | medium | Dates follow the browser locale, not the app language — an English UI shows '2026. 7. 17. 오후 3:24' | `js/app.js:730` |
| 67 |  | core-app | high | The App.db()-is-null-until-init trap and the 'ready' event are undocumented — all 5 packs hand-roll the guard, two incorrectly | `js/app.js:1401` |
| 68 |  | core-app | medium | Event <select> optgroup labels never re-translate on language switch | `js/app.js:1466` |
| 69 |  | core-app | low | Counted toasts print '1 solves added' and the stat line says 'solve: 3/5' — no plural handling | `js/app.js:617` |
| 70 |  | core-app | low | bpaWpa contains an unreachable dead branch that is immediately overwritten | `js/app.js:596` |
| 71 |  | core-app | medium | csTimer import works but export is one-way — no round-trip back out | `js/app.js:1274` |
| 72 |  | core-app | medium | App.i18n(key, ko, en) ignores its first parameter — API.md documents a registry that does not exist | `js/app.js:1453` |
| 73 |  | core-app | medium | Pack and mobile modal contents are built once, snapshotting the language — only feat_share works around it | `js/app.js:137` |
| 74 |  | core-logic | medium | timeToString conflates null/undefined/NaN with DNF — missing data silently renders as a real result | `js/stats.js:21` |
| 75 |  | core-logic | medium | parseTime('DNF') stores ms=0, so un-DNFing an imported DNF creates a 0.00 solve that becomes the session best | `js/stats.js:51` |
| 76 |  | core-logic | low | bestAverage reports an all-DNF window as the 'best aoN', making the best cell clickable to a meaningless window #1 | `js/stats.js:104` |
| 77 |  | core-logic | medium | sessionSummary.mean drops DNFs while meanOf() poisons to DNF — two contradictory means in the same panel | `js/stats.js:127` |
| 78 |  | core-logic | low | sessionSummary.total excludes DNF attempts, undercounting practice time | `js/stats.js:144` |
| 79 | ✅ | core-logic | low | Averages are truncated, not rounded — but the naive fix regresses the primary timer path from 89% to 53% WCA agreement | `js/stats.js:25` |
| 80 |  | core-logic | medium | FMC falls back to an out-of-spec scramble after 100 tries, and the self-test only checks F/R not B/L | `js/scramble.js:43` |
| 81 |  | core-logic | medium | Skewb and Pyraminx defLen=9 is below both puzzles' God's number (11) — easy states 2.1x over-represented | `js/scramble.js:148` |
| 82 |  | core-logic | medium | 444bld and 555bld are byte-identical to 444wca/555wca — no BLD orientation suffix at all | `js/scramble.js:151` |
| 83 |  | core-logic | medium | Megaminx 'len' means lines, not moves — the shared len box lets a user request a 200-line scramble | `js/scramble.js:147` |
| 84 |  | core-logic | low | All randomness is one unseeded Math.random with no crypto source and no reproducibility hook | `js/scramble.js:9` |
| 85 |  | core-logic | medium | Scramble self-tests check format only, never state distribution — this is why the clock bug survived | `js/scramble.js:183` |
| 86 |  | core-logic | medium | Square-1 draw() discards the illegal-slash result and confidently renders a state that isn't the scramble | `js/draw_sq1.js:306` |
| 87 |  | core-logic | medium | Clock FRONT/BACK labels are hardcoded rgba(0,0,0,.55) and vanish in dark theme | `js/draw_clock.js:200` |
| 88 |  | core-logic | medium | The nnn flat net draws faces edge-to-edge, so face boundaries are indistinguishable from sticker boundaries | `js/draw_nnn.js:133` |
| 89 |  | core-logic | medium | nnn per-size wrappers drop the colors argument, so the module's own colour-scheme support is unreachable | `js/draw_nnn.js:158` |
| 90 |  | core-logic | high | Random-state 2x2 is cheap and feasible — current random-move over-represents ≤6-move states 3.4x | `js/scramble.js:138` |
| 91 |  | core-ui | medium | Settings tabs, theme segment, accent swatches and mobile nav expose selection only as a CSS class | `index.html:112` |
| 92 |  | core-ui | low | Dead markup: #toolCanvas and #toolText are destroyed on first paint and referenced by nothing | `index.html:100` |
| 93 |  | core-ui | medium | Emoji-presentation icons ignore currentColor — the active mobile tab's icon never turns blue | `index.html:392` |
| 94 |  | core-ui | medium | #quickBar with its destructive delete button sits dead-centre in the timer pad's tap area | `mobile.css:84` |
| 95 |  | core-ui | low | overscroll-behavior is on body but not html, and no inner scroller contains its chain | `mobile.css:17` |
| 96 | ✅ | core-ui | medium | No safe-area-inset-left/right — megaminx scramble lines are eaten by the notch in landscape | `mobile.css:173` |
| 97 |  | core-ui | medium | No Content-Security-Policy — and index.html has zero inline scripts, so script-src 'self' is free | `index.html:4` |
| 98 |  | core-ui | medium | Zero og:/twitter: tags — a shared URL renders as bare text in Discord/KakaoTalk/Twitter | `index.html:6` |
| 99 |  | infra | medium | Manifest omits screenshots — Chrome Android downgrades install to the dismissible mini-infobar | `manifest.webmanifest:11` |
| 100 |  | packs | medium | Swipe-between-views is dead across most of every pane — only 5% of the tools view responds | `js/mobile.js:89` |

## 상세


### 1. uiBlocked() treats a focused <select> as a text field — spacebar is dead after every event/session pick ✅검증됨

- **파일**: `js/app.js:375` · **분류**: correctness · **심각도**: high · **배치**: core-app · **공수**: S · **리스크**: low
- **근거**: uiBlocked() returns true for SELECT; keyup at 441 gates on it, and no handler ever blurs #eventSel/#sessionSel. Verified with a real mouse click: hold+release Space → {disp:'', solving:false}; body focus → running.
- **수정안**: Drop SELECT from the tagName test at js/app.js:375 → `return !!(a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA'));`. The `.modal.show` guard at 373 still blocks all opt* selects. Optionally add this.blur() to the #eventSel (1486) / #sessionSel (1505) change handlers. Regression-test with page.mouse.click, NOT page.selectOption (it leaves focus on BODY and hides the bug).

### 2. #metroBox is reparented to <body> with inline display:block and becomes a stray full-height flex column ✅검증됨

- **파일**: `js/app.js:891` · **분류**: correctness · **심각도**: high · **배치**: core-app · **공수**: S · **리스크**: low
- **근거**: renderToolSlot(): `if (metro && metro.parentNode === body) document.body.appendChild(metro);` never resets the inline display:block set at 954. Verified: after switching slot 0 away from metronome, #metroBox is visible at {x:931,y:12,w:337,h:696}, is clickable, and (body is display:flex) squeezes #main from 980px to 631px until reload.
- **수정안**: js/app.js:892 → `if (metro && metro.parentNode === body) { metro.style.display = 'none'; document.body.appendChild(metro); }`. Re-selecting metronome still works because render() re-sets display:block unconditionally.

### 3. undoAction()/undo toast insert a deleted solve into whatever session is current — cross-session corruption ✅검증됨

- **파일**: `js/app.js:518` · **분류**: data · **심각도**: high · **배치**: core-app · **공수**: S · **리스크**: low
- **근거**: `lastDeleted = { index: i, solve: s.solves[i] }` carries no session id; undoAction (534) splices into curSession() with no guard, while the parallel lastCleared path at 539 DOES check `lastCleared.id === DB.current`. Reproduced: delete in 3x3, switch to 4x4, Ctrl+Z → the 3x3 solve is inserted into 4x4 and persisted; best single 60000→10400.
- **수정안**: js/app.js:518 → `lastDeleted = { id: DB.current, index: i, solve: s.solves[i] };`; line 534 → `if (lastDeleted && lastDeleted.id === DB.current) {`; add `if (!lastDeleted || lastDeleted.id !== DB.current) return;` at the top of the toast onClick (525). This also fixes the stale-toast TypeError (click undo after Ctrl+Z already consumed lastDeleted).

### 4. Long-press quick-action sheet ghost-taps its own buttons and silently DNFs the pressed solve ✅검증됨

- **파일**: `js/mobile.js:147` · **분류**: correctness · **심각도**: high · **배치**: packs · **공수**: S · **리스크**: medium
- **근거**: The sheet opens from a 450ms setTimeout while touchend is {passive:true}, so compat mouse events fire and re-hit-test at the release point. Verified via CDP: long-press row 31 at y=691 → mousedown/mouseup/click land on BUTTON "DNF"; solve[31][0][0] goes 0 → -1. A 5px sweep shows ~33% of the list band behaves correctly; y 611-711 silently changes the penalty.
- **수정안**: Add a `fired` flag set right before qaModal.open() (reset on touchstart and in abort()), and replace js/mobile.js:169 with `list.addEventListener('touchend', function (e) { if (fired) { e.preventDefault(); fired = false; } abort(); }, { passive: false });`. Keep touchstart passive. Do NOT add the 600ms document-level capture swallower — preventDefault on touchend is sufficient and the swallower eats legitimate sheet taps. (js/mobile.js is owned by the packs implementer.)

### 5. importData() assigns unvalidated JSON to DB and permanently bricks the app on every reload ✅검증됨

- **파일**: `js/app.js:1287` · **분류**: data · **심각도**: high · **배치**: core-app · **공수**: M · **리스크**: low
- **근거**: Gate is only `data.app === 'cstimer-clone' && data.sessions`. With current pointing at a missing session, initAfterData() throws at 1473 (`evSel.value = curSession().event`), but saveDB()'s already-scheduled 120ms timer still persists the corrupt blob; loadDB()'s only guard is `!DB.order.length`, so every reload re-throws before emit('ready') and all five packs die. A session missing `solves` bricks identically.
- **수정안**: Add `normalizeDB(raw)` returning a valid DB or null: require sessions to be a non-null object; rebuild order = raw.order.filter(id => raw.sessions[id]) (fall back to Object.keys(sessions)); return null if empty; coerce each session to {name:String(...), event:Scrambler.byId(s.event).id, solves:sanitized, created}; set current = sessions[raw.current] ? raw.current : order[0]. Route importData:1287 AND loadDB:81 through it. Swap with rollback and move saveDB AFTER initAfterData succeeds — the pending 120ms timer defeats a rollback otherwise.

### 6. localStorage quota exceeded silently discards every subsequent solve; a 2.6s toast is the only signal ✅검증됨

- **파일**: `js/app.js:90` · **분류**: data · **심각도**: high · **배치**: core-app · **공수**: M · **리스크**: low
- **근거**: saveDB()'s catch only toasts. Verified: at ~30k 3x3 solves setItem throws, in-memory count climbs to 30,000 while persisted freezes at 28,000; reload loses 2,000. Meanwhile cstc_pack_data_bak held 2.7MB (53% of quota) in stale snapshots that are never reclaimed. importData() also toasts green 'imported N sessions' BEFORE the debounced save fails.
- **수정안**: In the catch: detect quota (e.name==='QuotaExceededError' || e.code===22 || e.code===1014); emit a new 'quota' event so feat_data can drop its own LS_BAK key (do NOT removeItem a pack-private key from core — it inverts API.md); retry setItem once; on second failure set `saveBroken = true` and render a persistent, non-auto-dismissing red banner with an 'Export now' button wired to download(exportJSON()). Document 'quota' in API.md.

### 7. Clock scrambles never turn a dial to 6 and turn it to 0 twice as often — 70% of clock states unreachable ✅검증됨

- **파일**: `js/draw_clock.js:160` · **분류**: correctness · **심각도**: high · **배치**: core-logic · **공수**: S · **리스크**: low
- **근거**: `return name + randInt(6) + (randInt(2) === 0 ? '+' : '-');` gives 11 of 12 residues. Measured over 560k moves: 0h = 16.7%, 6h = 0.00%. The amount→state map is provably injective (full rank mod 2 and mod 3), so coverage is exactly (11/12)^14 = 29.6%. js/scramble.js:107/111 fallback has the identical bug. This is the shipping path (scramble.js:146 prefers ScrImage.clk.genScramble).
- **수정안**: Both files: `var v = rnd(12) - 5; return name + Math.abs(v) + (v < 0 ? '-' : '+');` → 0+..6+ and 1-..5-, uniform. MANDATORY same-commit change: the T5 self-test regex at js/draw_clock.js:435-437 hardcodes [0-5] and will FAIL on the first 6+ — widen all three to [0-6]. Fix the doc comment at line 165 ('amount 0..5') to -5..+6, and add an assertion that all 12 residues appear over 50k scrambles.

### 8. Cache-first service worker never revalidates — a forgotten CACHE_VERSION bump strands every user on the old build forever ✅검증됨

- **파일**: `sw.js:66` · **분류**: infra · **심각도**: high · **배치**: infra · **공수**: M · **리스크**: medium
- **근거**: `if (hit) return hit;` with no background fetch; the cache is only written by install, which fires only on a byte-different sw.js. Proven: deployed a NEW js/app.js with sw.js untouched → visits 2, 3, 4 all serve OLD; only a manual v1.1.0→v1.2.0 bump recovered it (and then one load late). Assets are not content-hashed. No CI enforces the bump.
- **수정안**: Stale-while-revalidate the same-origin GET branch: `var net = fetch(req).then(res => { if (res && res.ok && (res.type==='basic'||res.type==='default')) { var c = res.clone(); caches.open(CACHE_NAME).then(k => k.put(req, c).catch(()=>{})); } return res; }).catch(() => hit || offlineFallback(req)); e.waitUntil(net); return hit || net;` — the waitUntil is load-bearing or the SW can be killed before cache.put lands. Keep the offline fallback branch and keep bumping CACHE_VERSION as belt-and-braces (SWR can serve a mixed-version load).

### 9. No CI: 8 modules ship self-tests that exit(1), and Pages deploys straight from main with zero gates

- **파일**: `.github/workflows/ci.yml` · **분류**: test · **심각도**: high · **배치**: infra · **공수**: S · **리스크**: low
- **근거**: `gh api .../pages` → build_type legacy, source main:/. No .github directory exists. Yet js/scramble.js:210, js/stats.js:194, js/draw_nnn.js:216, js/draw_sq1.js:533, js/draw_pyra.js:382, js/draw_skewb.js:372, js/draw_clock.js:488, js/draw_mega.js:723 all `process.exit(1)` on failure and all currently pass.
- **수정안**: Add .github/workflows/ci.yml running `for f in js/draw_nnn.js js/draw_pyra.js js/draw_skewb.js js/draw_sq1.js js/draw_clock.js js/draw_mega.js js/scramble.js js/stats.js; do node "$f" || exit 1; done` on push and pull_request with node 20, plus a `scripts/check-precache.js` step that fails when a PRECACHE entry is missing from disk or a js/*.js|*.css on disk is absent from PRECACHE. Enable branch protection on main requiring the job.

### 10. A bare modifier key stops a running solve and commits a bogus time ✅검증됨

- **파일**: `js/app.js:421` · **분류**: correctness · **심각도**: medium · **배치**: core-app · **공수**: S · **리스크**: low
- **근거**: DEFAULT_OPTIONS.stopKeys is 'any' (line 60), so the guard at 421 is skipped and every keydown reaches stopTimer(). Verified: with a solve running, bare Shift / Meta / Control / Alt / CapsLock each stopped the timer and committed a ~0.30s solve (App.solves().length 0→5).
- **수정안**: Restructure the running branch (417-424): handle Escape first, then `if (/^(Shift|Control|Alt|Meta|CapsLock|NumLock|ScrollLock|Fn)$/.test(e.key)) return;` and `if (e.metaKey || e.ctrlKey || e.altKey) return;` before preventDefault/stopTimer. Validated in isolation: still stops on Space, 'a', Shift+a. Note preventDefault cannot block OS chords like Cmd+Tab — do not claim otherwise.

### 11. 4x4 and 6x6 scrambles contain pure whole-cube rotations — 43% of 4x4 scrambles waste 2 moves ✅검증됨

- **파일**: `js/scramble.js:29` · **분류**: correctness · **심각도**: medium · **배치**: core-logic · **공수**: S · **리스크**: low
- **근거**: Width is picked independently of face; the two continue-guards compare face letters only. On even cubes Rw Lw' == x (verified against draw_nnn.js apply, with 5x5/7x7 correctly negative). Measured over 4000: 4x4 = 0.549 pairs/scramble, 43.6% contain ≥1; 6x6 = 0.481/38.1%. Live output: `U Lw2 Rw2 Dw'` (=x2). Real TNoodle 4x4 never emits Dw/Lw/Bw.
- **수정안**: Add `var HALF_FACE = { U:1, R:1, F:1 };` and inside nnnScramble after the face guards: `if (n % 2 === 0 && w === n / 2 && !HALF_FACE[f]) continue;` (rejection keeps the distribution uniform over legal moves). Delete the dead `if (w > 3) w = 3;` and `if (n < 6 && w > 2) w = 2;`. Verified: rotation pairs → 0.000, zero /^[DLB]w/ in 500 4x4 scrambles, all 9 existing self-tests still pass including '777 has 3w'. Add that assertion.

### 12. 'trainer: 2x2 CLL' produces an actual CLL case 0.04% of the time — it is a plain 2x2 scramble ✅검증됨

- **파일**: `js/scramble.js:156` · **분류**: correctness · **심각도**: medium · **배치**: core-logic · **공수**: M · **리스크**: low
- **근거**: `gen: nnnScramble(2, len||9, ['R','U','F'])` — R moves DFR/DRB and F moves DFR/DLF, so the D layer is destroyed. Measured with the repo's own sim over 200k scrambles: 74 (0.037%) leave the first layer solved, statistically identical to plain 222so (0.035%); 185,740 distinct states reached where a real CLL trainer can reach only 648.
- **수정안**: Ship a CLL_ALGS table and generate scramble = randomAUF + invertRUF(pick(CLL_ALGS)) + randomAUF, where invertRUF reverses tokens and flips ' (X2 unchanged). Valid CLL algs preserve the first layer setwise, so D is solved by construction. Wire `gen: function () { return cllScramble(); }` and DROP defLen so the length box hides itself (the `if (ev.defLen)` gate is at js/app.js:1267). Self-test: D face of draw_nnn.apply(solved(2),2,cllScramble()) uniform over 200 samples. NOTE: a 648-node BFS over <U,R,F> does NOT work — only U moves preserve the CLL set, so optimal solving needs the full 3.67M-state BFS or per-scramble IDA*.

### 13. 3BLD orientation suffix reaches only 16 of 24 orientations and emits a trailing space 6% of the time ✅검증됨

- **파일**: `js/scramble.js:129` · **분류**: correctness · **심각도**: medium · **배치**: core-logic · **공수**: S · **리스크**: low
- **근거**: bldSuffix picks from Rw-family × Uw-family = x^a·y^b = 16 distinct products; the U face can only land on {U,B,D,F}, never L or R. Verified over 200k 333ni scrambles: exactly 16 distinct suffixes, 6.26% end in a trailing space that reaches the clipboard (no .trim() on the generate→copyText path). Cross-checked against draw_nnn.js: current 16, proposed 24. 444bld/555bld get no suffix at all.
- **수정안**: `function bldSuffix(pre) { pre = pre || ''; var a = pick(['', pre+'Rw', pre+"Rw'", pre+'Rw2', pre+'Fw', pre+"Fw'"]); var b = pick(['', pre+'Uw', pre+"Uw'", pre+'Uw2']); return [a,b].filter(Boolean).join(' '); }` and line 143 → `return [nnnScramble(3, len || 25), bldSuffix()].filter(Boolean).join(' ');`. Self-test: 24 distinct suffixes over 5000 calls, no /\s$/.

### 14. parseTime bare-digit ladder is discontinuous: '99' → 1:39.00 but '100' → 1.00 ✅검증됨

- **파일**: `js/stats.js:55` · **분류**: correctness · **심각도**: medium · **배치**: core-logic · **공수**: S · **리스크**: medium
- **근거**: `if (/^\d+$/.test(str) && str.length > 2)` routes 1-2 digits to the seconds regex and 3+ digits to centisecond packing. Verified in node: '12'→12.00, '99'→1:39.00, '100'→1.00, '1234'→12.34. The value inverts ~100x across the 2→3 digit boundary and the multi-line paste importer commits it with no per-line echo, poisoning every ao5/ao12 spanning it. The line-54 comment claims csTimer style; csTimer packs ALL bare digits.
- **수정안**: Delete `&& str.length > 2` (the zero-pad at 57 already handles short input: '99'→0.99, '5'→0.05). Verified: ladder becomes monotonic and all 13 existing self-tests pass. MUST ship together with the index.html:74 placeholder change to `12.34 / 1234` — '12' silently changes from 12.00 to 0.12 and nothing else catches it. Add asserts: parseTime('99') === [0,990] and parseTime('99')[1] < parseTime('100')[1]. (Placeholder edit crosses into core-ui — coordinate.)

### 15. parseTime applies +2 inconsistently between bare-digit and decimal forms — 2s discrepancy for the same intent

- **파일**: `js/stats.js:63` · **분류**: correctness · **심각도**: medium · **배치**: core-logic · **공수**: S · **리스크**: low
- **근거**: Line 63 `if (pen === 2000) return [2000, ms0];` (no subtraction) vs line 74 `return [2000, ms - 2000 >= 0 ? ms - 2000 : ms]; // typed value includes +2`. So '1234+' stores raw 12.34 (effective 14.34) while '12.34+' stores raw 10.34 (effective 12.34). The line-74 comment states the intended contract, so 63 is the wrong side.
- **수정안**: js/stats.js:63 → `if (pen === 2000) return [2000, ms0 - 2000 >= 0 ? ms0 - 2000 : ms0];`. Add self-tests asserting parseTime('1234+') and parseTime('12.34+') both return [2000, 10340]. The CSV importer is unaffected (feat_data.js:331 timeLike requires /[.:]/ or DNF).

### 16. 'Delete all data' leaves up to 3 full DB copies in cstc_pack_data_bak with a one-click restore button ✅검증됨

- **파일**: `js/app.js:1355` · **분류**: security · **심각도**: medium · **배치**: core-app · **공수**: S · **리스크**: low
- **근거**: The confirm says '되돌릴 수 없어요 / cannot be undone' but the handler only removes STORE_KEY. Verified by driving the real UI: live solves 30→0 while snapshotsSurviving=3, backupSolvesStillPresent=90, recoveredComment='secret comment 0'. feat_data.js:205 renders a restore button per snapshot and there is no delete-backups control anywhere. Residual keys: cstc_pack_data_bak/_bakcnt/_opts, cstc_pack_mobile_view, cstc_pack_share_datefmt, cstc_pack_tools_goal, cstc_pack_tools_drill.
- **수정안**: In the onYes handler: `emit('resetAll');` then sweep `for (var i = localStorage.length - 1; i >= 0; i--) { var k = localStorage.key(i); if (k && k.indexOf('cstc_') === 0) localStorage.removeItem(k); }` then reload. All app state is cstc_-prefixed so the sweep is safe. Document 'resetAll' in API.md's Events section (no collision with the KO.resetAll label string) and update the confirm copy to say backups are deleted too.

### 17. Multi-touch on #timerPad records one phase split per finger — a two-thumb tap ends a phases=2 solve ✅검증됨

- **파일**: `js/app.js:452` · **분류**: correctness · **심각도**: medium · **배치**: core-app · **공수**: S · **리스크**: low
- **근거**: The touchstart handler has no finger guard and recordSplit() has no debounce. Verified via CDP: phases=3 two-thumb tap → '구간 3/3 · 1: 0.5 2: 0.5' (two splits, one tap). phases=2 → solve TERMINATED 0.6s in and lastSolve [0,637,[619,637]] written to the session. Default phases=1 is safe (the 200ms guard at 382 catches the second touch).
- **수정안**: In the running branch of the touchstart handler use `if (e.touches.length === e.changedTouches.length) { if (opts().phases > 1) recordSplit(); else stopTimer(); } e.preventDefault(); return;` — do NOT use a bare `e.touches.length !== 1` guard: on iOS/WebKit simultaneous fingers can coalesce into one touchstart with length 2, which would swallow the tap entirely. Leave the padDown start path untouched.

### 18. Opening a modal while Space is held strands the hold behind uiBlocked() — one later tap starts a solve ✅검증됨

- **파일**: `js/app.js:441` · **분류**: correctness · **심각도**: medium · **배치**: core-app · **공수**: S · **리스크**: low
- **근거**: keyup begins `if (uiBlocked()) return;`, so padUp never runs if a modal opened mid-gesture (clicking ⚙/? while holding, or line 431's '?' handler firing during 'holding'). Verified: hold 500ms → 'ready'; click #btnOptions; release; close; one instantaneous press → running, and a phantom 0.403s solve persisted to the session.
- **수정안**: Add a state-guarded `abortHold()` (no-op unless T_.state is holding/preInspect/inspectHolding; must cancelAnimationFrame(T_.raf) since startLoop keeps spinning behind the modal) and change keyup to `if (uiBlocked()) { abortHold(); return; }`. The guard is essential — uiBlocked() is also true while typing spaces into the session-name field. Guard line 431 with `(T_.state === 'idle' || T_.state === 'stopped')` — NOT `=== 'idle'` alone, which would break '?' for the whole period right after a solve.

### 19. Window losing focus mid-hold strands the state machine — the next single tap starts with zero hold delay ✅검증됨

- **파일**: `js/app.js:444` · **분류**: correctness · **심각도**: medium · **배치**: core-app · **공수**: S · **리스크**: low
- **근거**: No blur/visibilitychange/pagehide handler exists. If keyup is lost, T_.state stays 'holding' with a stale holdStart, and padUp's holding branch only tests holdReady(), which is trivially true. padDown has no 'holding' branch so a re-press cannot reset it. Verified end-to-end: a 3ms tap from a stranded hold → running, and the phantom solve persisted as a session best firing celebrate().
- **수정안**: Reuse the abortHold() helper and register `window.addEventListener('blur', abortHold)` (non-capture — capture would fire on every input blur). Make the touchcancel handler (463-468) call abortHold() so the paths cannot drift. Deliberately do NOT abort a 'running' solve on blur — wall-clock timing through a blur is correct.

### 20. WCA inspection penalty is decided by the last rendered frame, not the start instant

- **파일**: `js/app.js:294` · **분류**: correctness · **심각도**: medium · **배치**: core-app · **공수**: S · **리스크**: low
- **근거**: timerLoop assigns `T_.pen = 2000` / `Stats.DNF` while drawing; stopTimer reads whatever the last rAF tick left there, and startTimer never re-evaluates. A solver releasing at 15.03s after a frame landed at 14.98s records no penalty. Error is bounded by the frame interval and grows with the 61ms renderStats stalls.
- **수정안**: Add next to holdReady(): `function inspPenalty() { var e = (now() - T_.inspStart) / 1000; return e < 15 ? 0 : (e < 17 ? 2000 : Stats.DNF); }`. Delete the T_.pen assignments at 294-295 (keep txt2 for display). In padUp's inspectHolding branch (409-411): `if (holdReady()) { T_.pen = inspPenalty(); startTimer(); } else T_.state = 'inspect';`

### 21. navigator.vibrate(15) fires every animation frame while holding — a continuous buzz, not a ready pulse

- **파일**: `js/app.js:302` · **분류**: mobile · **심각도**: medium · **배치**: core-app · **공수**: S · **리스크**: low
- **근거**: The holding branch runs inside the rAF loop: `if (holdReady()) vibrate(15);` re-issues on every frame. Verified with vibrate stubbed and haptic:true: a 1-second hold produced 43 vibrate() calls (should be 1). setDisplay also rewrites identical textContent/className every frame in this branch.
- **수정안**: Add `vibedReady: false` to T_ (258-262) and latch: `var rdy = holdReady(); setDisplay(fmtTimer(0), rdy ? 'ready' : 'holding'); if (rdy && !T_.vibedReady) { T_.vibedReady = true; vibrate(15); }`. Reset it in padDown's arming branches (386/389/395) and cancelTimer (358). Apply the same latch to the inspectHolding branch at 299.

### 22. Multi-phase records a spurious extra split and a time that disagrees with the final split

- **파일**: `js/app.js:346` · **분류**: data · **심각도**: medium · **배치**: core-app · **공수**: S · **리스크**: low
- **근거**: recordSplit pushes `t`, writes DOM, then stopTimer re-samples the clock and de-dupes with `!== ms`. Because ms is sampled after the DOM write it is ≥ t, so crossing a ms boundary appends a duplicate. Verified with phases:3 over 20 attempts: solve #3 stored splits=[106,191,275,276] — a bogus 1ms phase 4 that openTimeModal renders as real. addSolve also records ms, not the final split.
- **수정안**: Thread the timestamp: recordSplit (325) → `if (T_.splits.length >= opts().phases) stopTimer(true, t);`; stopTimer (336) → `function stopTimer(fromSplit, atMs) { var ms = (atMs != null) ? atMs : Math.round(now() - T_.runStart);` and line 346 → `if (!fromSplit) T_.splits.push(ms);`. The recorded time then equals the final split by construction and the timing-dependent de-dupe disappears.

### 23. renderTools() runs twice on every solve — the first render paints a pre-scramble state that is instantly discarded ✅검증됨

- **파일**: `js/app.js:223` · **분류**: perf · **심각도**: medium · **배치**: core-app · **공수**: S · **리스크**: low
- **근거**: renderStats() ends with renderTools() (679) and renderScramble() ends with renderTools() (223); addSolve calls renderStats() then genScramble()→renderScramble(). Verified with a probe tool: 2 renders per solve, the first stale. Cost at N=3000 with tool0=stats: 42ms wasted (statsText re-runs bestAverage for 5/12/50/100). tool1 defaults to 'stats' so power users hit it with stock settings.
- **수정안**: Coalesce behind a dirty flag: `var toolsDirty=false; function invalidateTools(){ if(toolsDirty) return; toolsDirty=true; requestAnimationFrame(function(){ toolsDirty=false; renderTools(); }); }` and call it from renderStats(), renderScramble() and the resize handler. Keep a direct renderTools() for the tool <select> change handler at js/app.js:1561. NOTE: setMView() at 719 does not exist — mobile view switching is js/mobile.js setView(), which already calls App.refresh().

### 24. trimmedMean has no hi<=lo guard — averageOf(solves,i,2) returns NaN and renders as a real 'DNF'

- **파일**: `js/stats.js:91` · **분류**: correctness · **심각도**: medium · **배치**: core-logic · **공수**: S · **리스크**: low
- **근거**: `var lo = trim, hi = sorted.length - trim; return sum / (hi - lo);` — for n=2, trim=1 → 0/0 = NaN → timeToString → 'DNF'. For n=1 → 0/-1 = -0 → '0.00'. bestAverage(a,2) returns {value:NaN, end:1} because the `a != null` guard passes NaN. Stats.averageOf/bestAverage are documented public plugin API (API.md:17), so any plugin asking for an ao2 gets a silent DNF or a fake 0.00 PB.
- **수정안**: stats.js: after line 90 add `if (hi <= lo) return null;` and change averageOf (81) to `if (n < 1 || end + 1 < n) return null;`. bestAverage's `a != null` then correctly skips them. Document in API.md:17 that averageOf requires n >= 3. sessionSummary.avg is unaffected (gated on length >= 3, where hi-lo = 1).

### 25. nnnScramble() hangs the tab forever when faceSet spans a single axis ✅검증됨

- **파일**: `js/scramble.js:23` · **분류**: correctness · **심각도**: low · **배치**: core-logic · **공수**: S · **리스크**: low
- **근거**: The move loop has no iteration cap. With faceSet ['R','L'], after 'R L' the accept set is provably empty forever (R rejected by the sandwich rule, L by the same-face rule). Verified: `nnn(3,10,['R','L'])` and `nnn(3,10,['R'])` never return (SIGKILL at 3s); ['R','U'] and ['U','R','F'] return normally. Reachable only via the undocumented `nnn` export — no shipped event or app call site passes a single-axis pool.
- **수정안**: Validate up front in nnnScramble: build the axis set from `faceSet || FACES` and `if (Object.keys(axes).length < 2) throw new Error('nnnScramble: faceSet spans a single axis; no scramble exists');`. I brute-forced all 63 face subsets against every reachable state: `axes >= 2 ⟺ terminates`, 0 mismatches. Add a `if (++guard > len * 1000) throw` inside the while so future rule changes fail loudly. Self-test that nnn(3,10,['R','L']) throws.

### 26. Canvases are never DPI-scaled — all 6 puzzle diagrams render at 1x and are upscaled on every Retina display ✅검증됨

- **파일**: `js/app.js:897` · **분류**: design · **심각도**: medium · **배치**: core-app · **공수**: M · **리스크**: medium
- **근거**: toolCanvasIn sets width/height attributes only — no style.width/height, no devicePixelRatio. Verified at deviceScaleFactor:2: store 292x210 stretched over 584x420 device px. Unique-color count (upscale vs native-2x) proves blur on curved art: pyr 1144 vs 21, sq1 1866 vs 32, mgm 4417 vs 53. js/feat_stats.js:74-83 already implements this exact pattern under the comment '/* HiDPI canvas sized to the tool body */' — the author intended it and missed the core factory.
- **수정안**: In toolCanvasIn: `var dpr = Math.min(window.devicePixelRatio || 1, 3); c.width = Math.round(w*dpr); c.height = Math.round(h*dpr); c.style.width = w+'px'; c.style.height = h+'px'; c._dpr = dpr;`. Verified all 6 modules draw correctly into a native 584x420 store with ZERO changes. Two callers hardcode CSS-pixel constants and need `var d = canvas._dpr || 1; ctx.setTransform(d,0,0,d,0,0);` after getContext: drawMsg (908, '12px' font) and drawTrend (947, '9px' font + literal insets). Note the 3x3 net barely benefits (axis-aligned rects upscale cleanly); the win is on pyra/skewb/sq1/mega/clock. Fold in the feat_tools zoom modal (323) and feat_share card (293) canvases separately.

### 27. Tool dock paints over the +2/DNF quick bar and blocks the click, silently leaving the solve un-penalized ✅검증됨

- **파일**: `desktop.css:37` · **분류**: design · **심각도**: medium · **배치**: core-ui · **공수**: M · **리스크**: low
- **근거**: #toolDock is position:absolute z-index:20; #quickBar/#padHint are in-flow children of #timerPad with no z-index. With secondTool:true + timerScale:1.6 at 1280x800 and 1360x820, page.click('#qbP2') FAILS — Chromium reports `<select id="toolSel1"> from <div id="toolDock"> intercepts pointer events`; the solve persists unpenalized while the tool dropdown opens. The max-width:1150px static-dock fallback never fires at 1280/1360 and only guards width, not the 634px two-card dock. At default scale #padHint is fully covered.
- **수정안**: (1) style.css: `#quickBar, #padHint { position: relative; z-index: calc(var(--z-tool) + 1); }` — restores clickability but leaves the bar straddling the card. (2) The real fix in desktop.css: have app.js's showSecond toggle a body class, then `body.two-tools #toolDock { position: static; overflow-x: auto; flex: none; } body.two-tools .toolCard { width: 268px; min-width: 268px; box-shadow: var(--shadow-card); }` — reusing the ≤1150px treatment. Do NOT raise the breakpoint to 1280: one-tool at 1280x800 has no overlap. (The body-class toggle needs one line in js/app.js — coordinate with core-app.)

### 28. The desktop timer — the hero element — is the only surface that isn't a card, so it floats in a grey void

- **파일**: `desktop.css:32` · **분류**: design · **심각도**: high · **배치**: core-ui · **공수**: S · **리스크**: low
- **근거**: desktop.css:32 is the entire rule: `#timerPad { flex: 1; }`. Computed timerPadBg is rgba(0,0,0,0) on body #f2f4f6. style.css:213 already sets `#timerPad { border-radius: var(--radius-card) }` — a radius rendering on nothing. Mobile disagrees with itself: mobile.css:79-81 gives it background/radius/shadow. Every other element is a white 20px card while the largest region is bare grey.
- **수정안**: desktop.css:32 → `#timerPad { flex: 1; background: var(--card); box-shadow: var(--shadow-card); }` (radius already inherited). This also lifts #padHint from 1.82:1 to 4.62:1 and gives the floating tool dock a surface for its --shadow-float.

### 29. --g400 is used as raw text colour at 1.82-2.01:1 in light theme and bypasses the theme layer entirely ✅검증됨

- **파일**: `style.css:17` · **분류**: a11y · **심각도**: medium · **배치**: core-ui · **공수**: S · **리스크**: low
- **근거**: --g400:#b0b8c1 is declared in :root and never remapped in body[data-theme="dark"], unlike --sub/--fg/--line. Used as text at style.css:182 (#timeList .idx), :194 (#scrMeta), :209 (#nextPreview), :241 (#padHint), mobile.css:141 (#mtabs button). Measured live: padHint 1.82:1 on #f2f4f6; the other four 2.01:1 on white; dark 8.49-9.47:1. Default theme resolves to light, so this is the default path. AA needs 4.5:1 at 11-12.5px.
- **수정안**: Replace var(--g400) with var(--sub) at style.css:182, 194, 209 and mobile.css:141 (--sub is theme-aware; g600 on white = 4.62:1). For style.css:241 #padHint use var(--g700) (6.45:1 on #f2f4f6) or take the timerPad-as-card fix. SIDE EFFECT: style.css:210 `#nextPreview b { color: var(--sub) }` deliberately contrasts against the g400 body text — move the <b> to var(--fg) in the same change or the hierarchy collapses. Keep --g400 for disabled/placeholder fills. (mobile.css is owned by core-ui.)

### 30. White-on-accent fails AA at every accent: orange 2.16:1, green 2.77:1, blue 3.71:1 on primary buttons and toasts ✅검증됨

- **파일**: `style.css:112` · **분류**: a11y · **심각도**: medium · **배치**: core-ui · **공수**: M · **리스크**: medium
- **근거**: Measured live by clicking the real #accentSw swatches at 14px/600 (not large text, so 4.5:1 applies): blue 3.71, green 2.77, orange 2.16, red 3.71, navy 11.00. Hover --blue-dn = 4.49. style.css:341-342 .toast.success 2.77 / .toast.error 3.71 at 13.5px. No prefers-contrast/forced-colors handling anywhere; no other override of button.primary.
- **수정안**: Declare an AA companion per accent: blue #1668dd (5.17:1), green #027a4a (5.41), orange #8a5200 (6.39), red #c9313d (5.26), navy unchanged. `button.primary { background: var(--accent-aa); }`, `.toast.success { background:#027a4a }`, `.toast.error { background:#c9313d }`. Do NOT scope the overrides to light theme — button.primary and .toast have no dark override, so white-on-accent fails there too. Correction to the source finding: the delete/undo toast passes no `type` and renders --g800 at 11.00:1 — it already passes and is not affected.

### 31. Accent text on accent-weak is 3.31:1 — the TDS blue700 'weak foreground' token is missing

- **파일**: `style.css:20` · **분류**: a11y · **심각도**: medium · **배치**: core-ui · **공수**: S · **리스크**: low
- **근거**: Only three blues exist (blue500/600/50); TDS blue700 #1b64da, documented as the colour for text on blue50, is absent. Three rules pair blue500 on #e8f3ff: style.css:249 #quickBar button.on, :293 .penRow label:has(input:checked), :307 #optTabs button.act — all 3.31:1. Compositing the alpha --accent-weak over --card gives orange 1.94, green 2.39, red 3.15. These are the selected-state indicators for +2/DNF.
- **수정안**: style.css:20 add `--blue-fg:#1b64da;` and `--accent-fg: var(--blue-fg);` beside --accent, with per-accent overrides in each body[data-accent] block (green #028a55, orange #c67600, red #c72c39, navy #333d4b). Change color: var(--accent) → var(--accent-fg) at 249, 293, 307. In dark, --accent-weak is a 16% alpha on near-black, so keep --accent-fg: var(--accent) there.

### 32. The 21 toggle switches have no visible focus indicator — the ring is painted on an opacity:0 element ✅검증됨

- **파일**: `style.css:97` · **분류**: a11y · **심각도**: medium · **배치**: core-ui · **공수**: S · **리스크**: low
- **근거**: `:is(button, select, input, textarea, .tswitch input):focus-visible { box-shadow: ... }` targets the checkbox, but style.css:123 sets `.tswitch input { position:absolute; opacity:0; ... }`, which composites the shadow to transparent. style.css:83 also kills the native outline globally, so the box-shadow is the only affordance. Verified: on a real Tab landing, matchesFV=true and the shadow fully resolves, yet focused vs blurred screenshots are byte-identical. Tabbing the settings modal shows nothing for 21 consecutive stops.
- **수정안**: Add `.tswitch input:focus-visible + i { box-shadow: 0 0 0 2px var(--card), 0 0 0 4px var(--accent); }` — verified to render the ring without disturbing the knob's ::after shadow. Note: dropping `.tswitch input` from the line-97 selector is a no-op (plain `input` still matches); the `+ i` rule is the load-bearing part.

### 33. user-scalable=no blocks pinch-zoom app-wide (WCAG 1.4.4) while doing nothing on iOS, and no touch-action:manipulation exists

- **파일**: `index.html:5` · **분류**: a11y · **심각도**: medium · **배치**: core-ui · **공수**: S · **리스크**: low
- **근거**: index.html:5 `user-scalable=no` is ignored by iOS Safari since iOS 10 but disables pinch-zoom on Android/WebView. Audited computed touchAction at 390x844: only #timerPad is 'none'; mtabs, #mtabs button, btnNextScr, topbar, scrCtl, timeListWrap, toolDock, html, body are all 'auto' — so double-tap-zoom is live on `next` scramble and the tab bar, the controls a cuber taps in rapid succession. The pad is already protected by `touch-action:none` + passive:false preventDefault.
- **수정안**: index.html:5 → `content="width=device-width, initial-scale=1, viewport-fit=cover"`. Add `body { touch-action: manipulation; }` to style.css — this kills double-tap zoom app-wide while leaving pan/pinch intact, and #timerPad's `touch-action:none` is more specific and still wins. The iOS focus-zoom case is already covered by the 16px font-size rule.

### 34. Bottom sheets are sized in vh while body uses dvh — the sheet title and ✕ are clipped off-screen on iOS Safari

- **파일**: `mobile.css:154` · **분류**: mobile · **심각도**: medium · **배치**: core-ui · **공수**: S · **리스크**: low
- **근거**: mobile.css:11 `html, body { height: 100dvh; }` but :154 `.mbox { max-height: 86vh }`, :185 `92vh`, :80 `#timerPad { min-height: 42vh }`. On iOS 100vh is the URL-bar-retracted viewport, so at dvh 704 the 86vh cap = 726 > 704. `.modal` is align-items:flex-end so the overflow spills off the TOP, putting .mtitle and its .mclose — the only affordance besides a backdrop tap — above the visible area.
- **수정안**: mobile.css:154 → `max-height: 86vh; max-height: 86dvh;`, :185 → `92vh; 92dvh;`, :80 → `42vh; 42dvh;` — matching the existing `height: 100%; height: 100dvh;` fallback idiom at line 11. Verify in iOS Safari with the URL bar expanded that the ✕ is on screen.

### 35. Empty state renders 'no solves yet.hold space, release, and go!' — applyI18nStatic destroys the <br> ✅검증됨

- **파일**: `index.html:52` · **분류**: i18n · **심각도**: low · **배치**: core-ui · **공수**: S · **리스크**: low
- **근거**: applyI18nStatic snapshots el.textContent, where the <br> contributes zero characters, then replaces children. Verified on FIRST load: brCount 0, dataset.orig 'no solves yet.hold space, release, and go!'. The <br> is gone permanently and every switch to English prints the run-on. KO.emptyHint has a real \n but #emptyState has white-space:normal, so the intended 2 lines never render either.
- **수정안**: (1) index.html:52 — replace `<br>` with a literal newline inside the span. (2) style.css — add `#emptyState [data-i18n="emptyHint"] { white-space: pre-line; }`. Do NOT put pre-line on #emptyState itself: the container's source indentation then renders as breaks and inflates the block 153px→197px.

### 36. 13 synchronous <script> tags with no defer — 316KB of JS executes before DOMContentLoaded

- **파일**: `index.html:406` · **분류**: perf · **심각도**: low · **배치**: core-ui · **공수**: S · **리스크**: low
- **근거**: All 13 modules load as blocking classic scripts at the end of <body>. Measured: they fetch in parallel (18-29ms) but execute serially before DCL (154ms; load 319ms). The six draw_*.js renderers (~2800 lines) parse on every load even though only one is needed and none until the first tool render.
- **수정안**: Add `defer` to all 13 tags. Safe and order-preserving: app.js already guards with `if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();`, and every pack has an App.on('ready') fallback. Follow-up: the draw_*.js files are only reached through window.ScrImage[ev.img], so they can be lazy-injected per puzzle type.

### 37. Screen reader users never hear their solve time — #timerDisplay is aria-live="off" and nothing else announces ✅검증됨

- **파일**: `js/app.js:353` · **분류**: a11y · **심각도**: medium · **배치**: core-app · **공수**: S · **리스크**: low
- **근거**: aria-live="off" is correct for a rAF-driven node, but no compensating region exists: project-wide grep for aria-live/role=status/output returns only #timerDisplay (off) and #toasts (polite). Verified: after a 1.20s solve #1, timerDisplay reads 1.20 with live=off and #toasts is empty — even the session-best toast doesn't fire on the first solve (pbSnapshot([]) → single=null fails the guard at 487). voiceAlert defaults to 'none' so inspection is silent too. WCAG 4.1.3.
- **수정안**: Add `<div id="srStatus" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></div>` plus an .sr-only utility (neither exists), then at the end of stopTimer(): `$('srStatus').textContent = Stats.solveToString(rec, o.precision) + ', ' + T('솔브 ','solve ') + curSession().solves.length;`. Map the +2 case to a spoken 'plus 2' — solveToString returns '1.20+', which reads badly. Never write to it from timerLoop(). Also announce once each in startInspection/startTimer/cancelTimer. (The markup + CSS crosses into core-ui — coordinate; the writes are the primary change.)

### 38. All 15 modals declare aria-modal but perform zero focus management, and Tab walks onto 'clear session' ✅검증됨

- **파일**: `js/app.js:132` · **분류**: a11y · **심각도**: medium · **배치**: core-app · **공수**: M · **리스크**: low
- **근거**: `function showModal(id) { $(id).classList.add('show'); }` — no focus move, no trap, no restore; closeModals only strips the class. Verified: after opening options, activeId stays 'btnOptions' (outside the subtree AT was told is inert); 4 Tabs walk sessionSel → btnSessAdd → btnSessMgr → btnClearSession — a destructive control three keystrokes from a modal dialog. On Escape, focus is stranded there. 8 dialogs have aria-modal, 0 have aria-labelledby or aria-label; registerModal's 7 dynamic dialogs omit aria-modal entirely.
- **수정안**: Give each .mtitle > span an id and point the dialog at it with aria-labelledby; add m.setAttribute('aria-modal','true') in registerModal. Track lastTrigger in showModal, focus the first control, restore on close. IMPORTANT: styledConfirm is invoked from inside other modals (833, 1286, 1356) and closeModals closes ALL of them — test visibility (offsetParent !== null), not isConnected, or use a trigger stack. Add a Tab trap in the uiBlocked branch of the document keydown; note line 415 starts with `if (e.repeat) return;` so a held Tab escapes it.

### 39. #scrambleTxt claims role="button" but has no key handler — Space on it starts a solve instead ✅검증됨

- **파일**: `js/app.js:1515` · **분류**: a11y · **심각도**: medium · **배치**: core-app · **공수**: S · **리스크**: low
- **근거**: index.html:71 declares role="button" tabindex="0"; the only listener is click. uiBlocked() returns false for a DIV, so Space reaches the document handler and starts the timer (verified: display 'ready' then running at 0.34). With the `input` event selected, the scramble-entry modal is therefore mouse-only: Enter → nothing, Space → timer starts. The app's own placeholder says '(click to input scrambles)'.
- **수정안**: `$('scrambleTxt').addEventListener('keydown', function (e) { if (e.key !== 'Enter' && e.code !== 'Space') return; e.preventDefault(); e.stopPropagation(); this.click(); });` — bubble-phase stopPropagation suffices (the document listener at 415 is not capture). Verified working. Note the accname audit: role=button is name-from-content, so the scramble text IS announced today (the title is not the name) — an aria-label swap is optional polish, not part of this fix.

### 40. Time list rows are click-only — a keyboard user cannot open, edit or comment any solve but the last ✅검증됨

- **파일**: `js/app.js:1539` · **분류**: a11y · **심각도**: medium · **배치**: core-app · **공수**: M · **리스크**: low
- **근거**: Rows are emitted as bare <tr data-i> / <tr data-avg> with no tabindex and no keydown. Verified: 60 Tab presses never reach a row; programmatic tr.focus() does not even stick. The only keyboard-reachable editor is #qbComment (hardcoded to solves.length-1) — and Space on it starts the timer instead of activating it (solving:true, 0.19), as does Enter when enterStart is on.
- **수정안**: Add `tabindex="0"` ONLY to the row templates at js/app.js:645 and 671 — do NOT add role="button": verified via the CDP AX tree that it makes children presentational and destroys table semantics (row/cell counts 8/21 → 5/9). Register one keydown per table reusing tr.click() with e.preventDefault() + e.stopPropagation(). stopPropagation IS load-bearing, but for the no-op tr[data-avg] rows (openAvgDetail bails, no modal opens, uiBlocked stays false, padDown fires) — not for the data-i rows, whose modal opens synchronously and gates uiBlocked. Same treatment for the history rows at 239-245.

### 41. <html lang="ko"> is hardcoded and never synced — English UI is read by a Korean speech synthesizer

- **파일**: `js/app.js:1234` · **분류**: a11y · **심각도**: medium · **배치**: core-app · **공수**: S · **리스크**: low
- **근거**: index.html:2 is static and grep for documentElement.lang returns nothing. applyOptions sets body.dataset.theme/accent and calls applyI18nStatic but never the lang attribute. The app already does this correctly for speech: app.js:1077 `u.lang = lang() === 'ko' ? 'ko-KR' : 'en-US'`. WCAG 3.1.1; also makes Chrome offer to translate the page from Korean.
- **수정안**: In applyOptions(), next to `document.body.dataset.theme = effectiveTheme();`, add `document.documentElement.lang = lang() === 'ko' ? 'ko' : 'en';`. This covers init since initAfterData calls applyOptions. Separately consider aligning the lang() fallback at app.js:42 ('en') with DEFAULT_OPTIONS.lang ('ko').

### 42. Self-host Pretendard: render-blocking CDN with no SRI on a mutable git tag, which the SW refuses to cache ✅검증됨

- **파일**: `index.html:12` · **분류**: perf · **심각도**: medium · **배치**: infra · **공수**: M · **리스크**: low
- **근거**: index.html:12 is a plain render-blocking <link> to cdn.jsdelivr.net/gh/...@v1.3.9 with no integrity attribute; /gh/ resolves a mutable tag. sw.js:63 `if (url.origin !== self.location.origin) return;` opts out of caching it. Measured with request interception: no delay FCP 152ms, +800ms CDN latency FCP 944ms, +3000ms FCP 3140ms — FCP tracks CDN latency 1:1. index.html:11 preconnects with crossorigin but line 12 fetches no-cors, so the socket isn't reused.
- **수정안**: Vendor the pretendard v1.3.9 subset CSS + woff2 files into ./fonts/, replace lines 11-12 with a single local <link>, and add './fonts/pretendard.css' plus the 1-2 boot-critical subsets to PRECACHE (bump CACHE_VERSION). CAVEAT: the CDN file is a dynamic-subset CSS fanning out to ~100 unicode-range woff2s — do NOT precache one 1MB+ variable file; keep the subsetting and let the runtime-cache branch pick up the rest on demand. Note true-offline FCP is 64ms today (fails fast to the system-font fallback), so the win is slow-CDN cold loads and supply-chain surface, not a broken offline promise. Minimal alternative: `media="print" onload="this.media='all'"`. (Touches index.html + style.css + sw.js — infra owns the deploy-shaped change.)

### 43. README declares MIT but no LICENSE file exists — the code is legally all-rights-reserved

- **파일**: `LICENSE` · **분류**: infra · **심각도**: medium · **배치**: infra · **공수**: S · **리스크**: low
- **근거**: README.md:32 states '코드: MIT'. `find . -type f -not -path './.git/*'` contains no LICENSE, LICENSE.md or COPYING; GitHub's API reports no license, which defaults to all rights reserved — the opposite of the README claim, and the thing that stops anyone forking a public fan clone.
- **수정안**: Add a top-level LICENSE with the verbatim MIT text and `Copyright (c) 2026 INNO-HI Inc.` so licensee detects it. Optionally add the shields.io MIT badge and a CI badge under the README H1. Keep README.md:33's csTimer attribution unchanged.

### 44. Precache swallows every failure, so a partial install boots a broken shell offline

- **파일**: `sw.js:41` · **분류**: infra · **심각도**: medium · **배치**: infra · **공수**: M · **리스크**: low
- **근거**: `PRECACHE.map(url => cache.add(url).catch(function(){}))` — install always resolves. If js/app.js transiently 502s during install, the SW activates and claims clients; offline, the miss path returns `new Response('', {status:504})`, which a <script> tag parses as an empty script and fails silently. The user gets index.html with no timer engine and no error. The list itself is currently correct (all 22 entries exist).
- **수정안**: Split PRECACHE into CORE (index.html, all CSS, all 14 js) and OPTIONAL (manifest, icons). Use `cache.addAll(CORE)` — atomic, rejects install on any failure, leaving the previous SW in control and letting the browser retry — then Promise.all the OPTIONAL adds with catch. Add scripts/check-precache.js (wired into ci.yml) that fails when a listed entry is missing from disk OR when any js/*.js or *.css on disk is absent from both arrays — that is what would have caught desktop.css/mobile.css/js/mobile.js at commit a73e75e.

### 45. Service worker never tells the page a new version installed — the user silently runs stale code ✅검증됨

- **파일**: `js/feat_share.js:55` · **분류**: infra · **심각도**: medium · **배치**: packs · **공수**: S · **리스크**: low
- **근거**: `navigator.serviceWorker.register('./sw.js').catch(...)` throws the registration away — no .then, no updatefound, no reg.waiting. Combined with skipWaiting + clients.claim + cache-first, the new SW activates and caches the NEW app.js while the rendered page keeps running the OLD one. Verified: LOAD 2 has sw activated and cached app.js = NEW, page build = OLD, notifications = []. LOAD 3 shows NEW.
- **수정안**: Keep the handle and prompt via the existing toast action API (js/app.js:109-129 supports {ms, action:{label,onClick}}): on updatefound → watch reg.installing → on state 'installed' with navigator.serviceWorker.controller present, App.toast('새 버전이 준비됐어요'/'new version ready', {ms:3600000, action:{label:'reload', onClick:()=>location.reload()}}). Verified working. Do NOT auto-reload on controllerchange — it would nuke a running timer. Note reg.waiting is always null under skipWaiting, so only the updatefound path fires; the idle-tab case is not addressed (the app makes no post-load fetches, so the browser never runs its update check).

### 46. Storage usage meter under-reports by exactly 2x — shows 72% when the quota is already full

- **파일**: `js/feat_data.js:602` · **분류**: data · **심각도**: medium · **배치**: packs · **공수**: S · **리스크**: low
- **근거**: `used += k.length + (localStorage.getItem(k) || '').length;` sums UTF-16 code units and compares them against STORAGE_CAP = 5*1024*1024 bytes. A 10k-solve DB + 3 backups = 3.59M chars renders as '3.59 MB / 5 MB' (72%, looks safe) while consuming ~7.2MB in engines that charge 2B/char. This is the only control that lets a user see the cliff coming.
- **수정안**: `used += (k.length + (localStorage.getItem(k) || '').length) * 2;` keeping STORAGE_CAP at 5MB. Add a warning state at >=80%: turn sbarFill red and append an 'Export your data' button. Optionally refine the cap with navigator.storage.estimate() falling back to the constant. (Note the real Chromium/WebKit budget measures ~5.24M chars for ASCII-dominant data, so calibrate against a measured value rather than the doubling alone if you want precision.)

### 47. Backup restore wipes the live DB before validating the snapshot, then force-reloads into the wreckage

- **파일**: `js/feat_data.js:211` · **분류**: data · **심각도**: medium · **배치**: packs · **공수**: S · **리스크**: low
- **근거**: `var db = App.db(); Object.keys(db).forEach(k => delete db[k]); Object.keys(b.db).forEach(k => db[k] = b.db[k]); App.save(); setTimeout(location.reload, 400);` — b.db comes from readBaks(), which only checks Array.isArray on the outer array; the {t, db} entries are never validated, and takeSnapshot's setItem can fail mid-quota. The destructive delete loop runs before anything about b.db is checked, and the pre-restore DB is gone from memory with App.save() already committed.
- **수정안**: Route b.db through the normalizeDB()/App.normalize() helper added for importData and bail with an error toast if it returns null — only then run the delete/copy loop, using the normalized object. Call takeSnapshot() immediately before the restore so a regretted restore is undoable. Once App.flush exists, drop the 400ms `// wait out debounced save` guess.

### 48. The relay tool calls ev.gen() with no length, ignoring the user's configured per-event scramble length

- **파일**: `js/feat_tools.js:281` · **분류**: correctness · **심각도**: medium · **배치**: packs · **공수**: S · **리스크**: low
- **근거**: `return { label: ev.name, scr: ev.gen(), done: false };` — every generator falls back to its hardcoded default. The same file gets it right for the bulk path at 418-420: `var len = App.options().scrLens[ev.id] || ev.defLen || undefined;`. So a user who set 3x3 to 20 gets 20-move scrambles on the timer and 25-move scrambles inside a relay.
- **수정안**: js/feat_tools.js:281 → `var len = App.options().scrLens[ev.id] || ev.defLen || undefined; return { label: ev.name, scr: ev.gen(len), done: false };`. Better: expose the existing scrLenFor helper (js/app.js:175) on window.App and call App.scrLenFor(ev) from both 281 and 418 so the three call sites cannot drift; document it in API.md beside `event.gen(len)`. (The App export is a one-line core-app change — coordinate.)

### 49. σ5/σ12 are computed over the untrimmed window, so they don't describe the ao5/ao12 beside them

- **파일**: `js/feat_stats.js:61` · **분류**: correctness · **심각도**: low · **배치**: packs · **공수**: S · **리스크**: low
- **근거**: windowSigma collects every finite time in the last n solves and hands the whole set to sdOf, never applying averageOf's ceil(n/20) trim, yet the result is labelled 'σ5 · σ12' directly beside the ao values (feat_stats.js:209). For [10.0,10.1,10.2,10.1,25.0] the ao5 counts the middle three (σ≈0.08) while σ5 reports σ≈6.6 — dominated by the solve the average deliberately discarded.
- **수정안**: In windowSigma, after collecting ts: `ts.sort((a,b)=>a-b); var trim = Math.ceil(n/20); ts = ts.slice(trim, ts.length - trim); if (ts.length < 2) return null;`. Bail with null when the window has more DNFs than the trim allows, so σ5 is blank exactly when ao5 is DNF. Keep sdOf's n-1 denominator — it matches stats.js:132.

### 50. timeToString(ms, 0) emits a bogus '.0' — every chart Y-axis tick ≥60s reads '1:00.0'

- **파일**: `js/stats.js:26` · **분류**: correctness · **심각도**: medium · **배치**: core-logic · **공수**: S · **리스크**: low
- **근거**: With decimals=0, `frac = v % 1` = 0 → fracStr '0', the zero-pad while-loop never runs, and line 35 appends '.' + fracStr unconditionally. Verified: timeToString(60000,0)==='1:00.0', (12345,0)==='12.0'. The only caller, feat_stats.js:119-120, strips a trailing '.' that never appears.
- **수정안**: After building `out` (line 34) insert `if (decimals <= 0) return (neg ? '-' : '') + out;`. Then simplify feat_stats.js:119-120 to `return Stats.timeToString(v, 0);` (the strip becomes dead). Add: `assert('fmt 0 decimals', timeToString(60000,0)==='1:00' && timeToString(12345,0)==='12')`. (The feat_stats simplification crosses into packs — the stats.js change is the primary and is safe alone.)

### 51. bestAverage() rescans every window from scratch on every solve — 1123ms freeze with ao1000 enabled

- **파일**: `js/app.js:642` · **분류**: perf · **심각도**: high · **배치**: core-app · **공수**: M · **리스크**: medium
- **근거**: statRowsConfig calls Stats.bestAverage(solves, r.n) per enabled row on every renderStats, and bestAverage loops all N-n+1 windows with a fresh sort each. Measured in node at N=10000: ao5 2.5ms, ao12 5.5ms, ao50 36.6ms, ao100 80.8ms, ao1000 1123.3ms. At N=5000 ao1000 is already 506ms — a full second of block per solve on a stopwatch.
- **수정안**: Add `var baCache = {}` keyed DB.current+':'+n holding {value,end,len}. On append (len+1) only the newest window can win, so compute one averageOf and compare — O(n log n) instead of O(N·n log n). Cold path (load/delete/import/penalty edit) calls Stats.bestAverage. Use it at js/app.js:642 and mirror for the mo3 best loop at 636-639. Invalidate wholesale in updateSolve, deleteSolve, undoAction, clearSession, switchSession, importData.

### 52. statsText() recomputes bestAverage for 5/12/50/100 on every render — 126ms at 10k solves, doubled by the duplicate render

- **파일**: `js/app.js:961` · **분류**: perf · **심각도**: high · **배치**: core-app · **공수**: S · **리스크**: low
- **근거**: The built-in 'stats' tool re-runs sessionSummary + four bestAverage scans on every renderTools — every solve, every scramble, every resize, every mobile tab switch — always producing identical values. Measured in node: N=1000 11.9ms, N=5000 62.4ms, N=10000 126.1ms. tool1 defaults to 'stats' (app.js:68), so it is on whenever secondTool is enabled.
- **수정안**: Memoize against a cheap revision key: `var key = DB.current + ':' + s.solves.length + ':' + opts().precision + ':' + solvesRev;` with a module-level `var solvesRev = 0;` incremented in updateSolve/deleteSolve/undoAction/clearSession. Apply the same key pattern to distText() (app.js:1022), which also rescans all solves. Combined with bestAverageCached this makes the tool effectively free.

### 53. renderStats() rebuilds the entire time list innerHTML on every solve — 190ms freeze at 10k solves

- **파일**: `js/app.js:676` · **분류**: perf · **심각도**: high · **배치**: core-app · **공수**: M · **리스크**: medium
- **근거**: Every row is rebuilt into one string then assigned to innerHTML. Measured in Chromium: N=1000 29.2ms, N=3000 65.6ms, N=10000 190.6ms (string build 12.1 | innerHTML parse 33.5 | forced layout of 10001 <tr> 142.3 | payload 1060KB). The work is redundant: averageOf(solves,end,n) reads only solves[end-n+1..end], so appending solve N cannot change any row i<N — every existing row is rebuilt to identical HTML. Measured single-row insert into a 10k table: 21.7ms vs 205.9ms.
- **수정안**: Split into renderStatsFull() (load / session switch / option change / delete / import) and an incremental append used by addSolve: build one <tr> and insert it (listReverse ? appendChild : timeList.querySelector('tr[data-i]').before(tr)). Keep bestIdx/worstIdx in module state and move the .best/.worst class with 2 classList ops instead of a rebuild. Cheap interim if this is too invasive: cap `order` at .slice(0,100) with a 'show all (N)' row. content-visibility does NOT help (206→178ms, 13%) — parse and row-box creation dominate.

### 54. addSolve() runs pbSnapshot twice — two full O(N·n) scans per solve, 22.7ms of pure waste at 10k

- **파일**: `js/app.js:483` · **분류**: perf · **심각도**: medium · **배치**: core-app · **공수**: M · **리스크**: medium
- **근거**: `var before = pbSnapshot(s.solves);` … push … `var after = pbSnapshot(s.solves);` — each does sessionSummary + bestAverage(5) + bestAverage(12) over the whole session. `before` is by definition identical to the previous solve's `after`. Measured in node: N=1000 2.2ms, N=5000 13.2ms, N=10000 22.7ms.
- **수정안**: Keep `var pbCache = null` for DB.current; `before = pbCache || (pbCache = pbSnapshot(s.solves))`. After the push, only the newest window can create a PB, so compute `after` from before + timeOf(solve) + averageOf(len-1,5) + averageOf(len-1,12) via a minNullable helper, and store it as the new pbCache. Reset in switchSession/updateSolve/deleteSolve/undoAction/clearSession/importData. Also fixes the 'first solve of a fresh session never toasts a best' gap (pbSnapshot([]) → single=null fails the guard at 487).

### 55. Tapping +2/DNF on the quick bar rebuilds all 10k rows (190ms) to change one cell

- **파일**: `js/app.js:513` · **분류**: perf · **심각도**: medium · **배치**: core-app · **공수**: M · **리스크**: medium
- **근거**: updateSolve() ends with an unconditional renderStats(). quickPen() calls it on every OK/+2/DNF tap — the most common post-solve interaction for a competitive cuber — triggering the full 190.6ms (N=10000) / 65.6ms (N=3000) rebuild to change one <td>, one .dnf class, and at most 12 downstream ao cells.
- **수정안**: Add `patchRows(from, to)` that, for j in [i, i+11], finds `tr[data-i="j"]` and updates cells[1..3] + toggles .dnf — correct because averageOf(solves,j,n) only reads solves[j-n+1..j]. Give updateSolve an optional `light` flag used by quickPen()/applyTimeModal() that calls patchRows(i, i+11), refreshes the cur/best table and stat line, re-evaluates best/worst, and skips the list rebuild. Keep the full rebuild for deleteSolve (indices shift).

### 56. Two open tabs clobber each other — whole-DB last-write-wins with no storage listener

- **파일**: `js/app.js:93` · **분류**: data · **심각도**: high · **배치**: core-app · **공수**: L · **리스크**: medium
- **근거**: saveDB writes the entire DB and loadDB runs once in init; zero storage listeners exist. Reproduced in one context: tab B records 50 solves → localStorage 50; tab A (stale in-memory DB) records 1 → localStorage 1, no warning; tab B reloads and sees 1. feat_data's LS_BAK snapshots initially recover 40 of 50, but takeSnapshot caps at 3, so ~60 further solves in the stale tab evict them permanently. Timer-in-one-tab + PWA window is a routine setup.
- **수정안**: Register `window.addEventListener('storage', ...)` on STORE_KEY. Per spec the event never fires in the writing document, so a foreign write is unambiguous from e.newValue alone — no TAB_ID/seq token needed. If this tab is idle and unedited, reparse e.newValue into DB and initAfterData(); otherwise show a non-dismissing 'changed in another tab' toast with a Reload action and set saveBroken = true. CRITICAL: clearTimeout(saveTimer) when adopting or blocking, or the already-scheduled 120ms save re-clobbers the newer data and reintroduces the bug.

### 57. No pagehide/visibilitychange flush — the 120ms debounced save can lose the last solve

- **파일**: `js/app.js:90` · **분류**: data · **심각도**: low · **배치**: core-app · **공수**: S · **리스크**: low
- **근거**: saveDB debounces 120ms and nothing flushes it. Measured by really closing the page: close @0ms LOST, @50ms LOST, @130ms PERSISTED. Honest scoping: the exposure is exactly 120ms from the saveDB call (addSolve's subsequent work is synchronous and does not widen it), and backgrounding at 1000ms persists cleanly — so 'phone cubers lose their last solve routinely' is not supported. The real justification is the hack it deletes: feat_data.js:210-214 `App.save(); setTimeout(location.reload, 400); // wait out debounced save`.
- **수정안**: Extract the timeout body into flushDB() (clearTimeout + synchronous setItem + the same quota handling) and have saveDB's timer call it. Register `window.addEventListener('pagehide', flushDB)` and a visibilitychange==='hidden' flush in init(). Expose App.flush so feat_data.js:214 can reload immediately instead of guessing 400ms. Note js/mobile.js:186 already has a visibilitychange listener (wake-lock only) — do not duplicate blindly.

### 58. copyText fires an unhandled promise rejection and callers toast 'copied' when the copy failed

- **파일**: `js/app.js:1362` · **분류**: correctness · **심각도**: medium · **배치**: core-app · **공수**: S · **리스크**: low
- **근거**: `navigator.clipboard.writeText(t)` has no .catch(); it rejects with NotAllowedError when the document isn't focused, and the textarea fallback is unreachable because navigator.clipboard exists. Callers toast success on the next statement (1364, 1512, 1516). Worst case is app.js:191 `if (opts().autoCopyScr) copyText(currentScramble());` — an uncaught rejection on every scramble with the tab unfocused. feat_share.js:313-317 already models the right pattern with .then/.catch.
- **수정안**: `function copyText(t) { if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t).catch(function () { return legacyCopy(t); }); return Promise.resolve(legacyCopy(t)); }` where legacyCopy is the existing textarea/execCommand block returning execCommand's boolean. Move the toasts at 1364/1512/1516 into .then() with an error toast on failure; append `.catch(function(){})` at 191.

### 59. styledConfirm leaks a permanent .modal div into <body> on every Esc or backdrop dismissal

- **파일**: `js/app.js:163` · **분류**: quality · **심각도**: medium · **배치**: core-app · **공수**: S · **리스크**: low
- **근거**: cleanup() (which removes the node) is reachable only from the two button click handlers. Esc routes to closeModals() and the backdrop to a mousedown → closeModals(), both of which only strip the .show class. Verified: 3 App.confirm() calls dismissed with Escape left 3 [id^="confirm_"] nodes and grew document.querySelectorAll('.modal').length from 15 to 18. Unbounded across a session.
- **수정안**: Make removal unconditional — have closeModals() sweep them: `document.querySelectorAll('.modal.show').forEach(function (m) { m.classList.remove('show'); if (/^confirm_/.test(m.id)) setTimeout(function () { m.remove(); }, 300); });`. Better long-term: a single reusable #confirmModal singleton whose text and handlers are re-bound per call, which removes the whole class of leak.

### 60. registerTool's documented onHide is never dispatched — the metronome keeps beeping after you switch tools

- **파일**: `js/app.js:886` · **분류**: correctness · **심각도**: medium · **배치**: core-app · **공수**: S · **리스크**: low
- **근거**: API.md:36 documents onHide; `grep -rn onHide .` returns exactly one hit — API.md. renderToolSlot wipes with innerHTML='' and calls def.render with no onHide and no record of the previously mounted tool. Verified: metro toggled on, switched slot 0 to 'image' → 6 more beeps in 1.5s. The fully-trapped case is metro in slot 1 then disabling the second panel: renderTools hides toolCard1 without re-rendering, so #metroToggle sits at 0x0 and click times out — only a reload stops it.
- **수정안**: Add `var mounted = {};` near TOOLS; in renderToolSlot before the wipe: `var prev = mounted[slot]; if (prev && prev !== def && prev.onHide) { try { prev.onHide(body, slot); } catch (e) { console.error('[pack] onHide', e); } } mounted[slot] = def;`. Give the built-in metro tool `onHide: function () { if (metro.on) toggleMetro(); $('metroBox').style.display = 'none'; }` — the display reset is required or the stray flex column remains. Also dispatch onHide from the `$('toolCard1').style.display='none'` branch in renderTools().

### 61. Metronome button flips to 'start' while still beeping — data-i18n="start" collides with the runtime toggle label

- **파일**: `js/app.js:1066` · **분류**: correctness · **심각도**: medium · **배치**: core-app · **공수**: S · **리스크**: low
- **근거**: index.html:106 declares `<button id="metroToggle" data-i18n="start">start</button>` while app.js:1066 mutates the same node to '정지'/'stop'. applyI18nStatic unconditionally overwrites it, and it runs on EVERY option change (1194) and on system dark-mode change (1257). So starting the metro then toggling any setting (or macOS flipping to dark at sunset) leaves the label '시작' while it beeps — and the next click turns it OFF while the label reads '정지'. Permanently inverted.
- **수정안**: Remove data-i18n="start" from index.html:106 (core-ui coordination). Add `function syncMetroLabel() { $('metroToggle').textContent = metro.on ? T('정지','stop') : T('시작','start'); }`, call it from toggleMetro (replacing 1066) and from applyOptions next to syncToolSelects() (1251). Keep both KO.start and KO.stop — they are then consumed by T() on both branches.

### 62. Tool dropdown labels are frozen in the registration-time language — 17 options stay Korean in an English UI ✅검증됨

- **파일**: `js/app.js:867` · **분류**: i18n · **심각도**: medium · **배치**: core-app · **공수**: M · **리스크**: low
- **근거**: `o.textContent = def.name;` bakes in a string already resolved by T() at registration. syncToolSelects (873) only assigns .value; applyI18nStatic only touches [data-i18n], which dynamic <option>s are not; registerTool's dedupe guard means re-registration can't repair it. Verified: dispatching change on #optLang flips the panel body and static labels to English while all 17 options stay Korean. Self-heals only on reload. Scope correction: 17 tools, not 11 — js/feat_tools.js registers 6 more via reg().
- **수정안**: Accept a thunk: `function toolLabel(def){ return typeof def.name === 'function' ? def.name() : def.name; }`; set o.textContent = toolLabel(def) in registerTool; in syncToolSelects loop both selects re-setting textContent from TOOLS[o.value] (the lookup resolves because o.value === def.id). Accept both shapes so existing packs keep working, document the function form in API.md, and convert the 5 core + 6 feat_stats + 6 feat_tools registrations.

### 63. DB.version is written but never read — no migration ladder, and a newer export imports into a stale cached client

- **파일**: `js/app.js:87` · **분류**: data · **심각도**: medium · **배치**: core-app · **공수**: S · **리스크**: low
- **근거**: loadDB writes `version: 2` and nothing ever reads DB.version (the only version reads are VERSION='2.0.0' and App.version). STORE_KEY says v1 while the field says 2 — the two markers already disagree. importData's gate is version-blind. With cache-first SW, a user on a stale bundle can import a v3 export, have it accepted as-is, and have saveDB write the v3 shape back.
- **수정안**: Add `var DB_VERSION = 2;` and `function migrate(d) { if (!d.version || d.version < 2) { /* v1→v2; today a no-op stamp */ } d.version = DB_VERSION; return d; }`. Call it in loadDB after JSON.parse and in importData after normalizeDB. Guard forward-incompat in both: `if (d.version > DB_VERSION) { toast('this data is from a newer version; reload the app'); return; }`. Document the version field and migration contract in API.md.

### 64. csTimer import silently labels unmapped sessions as 3x3

- **파일**: `js/app.js:1306` · **분류**: data · **심각도**: medium · **배치**: core-app · **공수**: S · **리스크**: low
- **근거**: `var evId = (meta.opt && meta.opt.scrType) || '333'; if (Scrambler.byId(evId).id !== evId) evId = '333';` — byId returns EVENTS[0] for any unknown id, so the guard detects the miss and discards it. The success toast reports only a session count. A cuber importing years of history gets 4x4/megaminx/clock sessions relabeled 3x3, invisible until they open one and see 3x3 scrambles.
- **수정안**: Add an alias table (`{'sq1':'sqrs','sq1h':'sqrs','333bf':'333ni','minx':'mgmp','222o':'222so','clk':'clkwca','444m':'444wca'}`) resolved before the byId check. Collect unresolved ids and extend the toast: '(N sessions had an unknown puzzle type and were set to 3x3: …)' with {ms:6000}. Store the original as s.srcScrType so nothing is lost.

### 65. csTimer import truncates solve[0] to 2 elements and throws mid-loop with no rollback

- **파일**: `js/app.js:1311` · **분류**: data · **심각도**: medium · **배치**: core-app · **공수**: M · **리스크**: low
- **근거**: `return [[sv[0][0], sv[0][1]], sv[1]||'', sv[2]||'', sv[3]||0];` hard-rebuilds solve[0] from two indices, dropping sv[0][2] (the splits array this app's own record shape uses, per API.md and app.js:484) and sv[4]. It also has no guard: one malformed row (sv[0] not an array) throws TypeError out of the forEach and out of the FileReader onload, leaving DB carrying half the import plus an empty broken session, with saveDB and the toast never running. The pack does it correctly at feat_data.js:255-256.
- **수정안**: Stage into a temp {sessions, order} and commit only on success. Reuse the pack's guard: skip rows failing `Array.isArray(sv) && Array.isArray(sv[0])`, then `var t = [sv[0].slice(), String(sv[1]||''), String(sv[2]||''), Number(sv[3])||0]; if (sv[4] && typeof sv[4] === 'object') t.push(sv[4]);`. Wrap the Object.keys forEach in try/catch, merge only if imported > 0, then saveDB(). Toast the skipped-row count so a truncated file is visible rather than silent.

### 66. Dates follow the browser locale, not the app language — an English UI shows '2026. 7. 17. 오후 3:24'

- **파일**: `js/app.js:730` · **분류**: i18n · **심각도**: medium · **배치**: core-app · **공수**: S · **리스크**: low
- **근거**: `new Date(solve[3]*1000).toLocaleString()` with no locale argument uses navigator.language. Six sites ignore lang(): app.js:730, feat_data.js:203/570/571/632, feat_share.js:109/111. The app already knows the mapping — app.js:1077 `u.lang = lang()==='ko' ? 'ko-KR' : 'en-US'`.
- **수정안**: Add `function locale() { return lang() === 'ko' ? 'ko-KR' : 'en-US'; }` next to lang() and expose it as App.locale (beside `lang: lang`). Change app.js:730 to toLocaleString(locale()) and the pack sites to App.locale(). Document App.locale() in API.md. Leave the two toISOString() calls (1326 export filename, 1351 CSV) alone — machine formats must stay locale-independent.

### 67. The App.db()-is-null-until-init trap and the 'ready' event are undocumented — all 5 packs hand-roll the guard, two incorrectly

- **파일**: `js/app.js:1401` · **분류**: quality · **심각도**: high · **배치**: core-app · **공수**: S · **리스크**: low
- **근거**: window.App is assigned during the IIFE but DB stays null until init() runs on DOMContentLoaded, so packs' IIFEs see App.db() === null. API.md's Events section lists solve/solvesChanged/sessionChanged/scramble/render/pb/options — 'ready' is NOT documented, yet every pack depends on it. feat_stats.js:629, feat_share.js:541, feat_tools.js:529 use `if (App.db && App.db()) boot(); else App.on('ready', boot);` while feat_data.js:784 and mobile.js:231 omit the `App.db &&` guard.
- **수정안**: Add `onReady: function (fn) { if (DB) { try { fn(); } catch (e) { console.error('[pack] ready', e); } } else on('ready', fn); }` to the App object and keep emitting 'ready' for back-compat. Document under Events: "'ready' () — core initialised; App.db() is null before this. Prefer App.onReady(fn), which fires immediately if the core is already up." Then replace the 5 hand-rolled guards with App.onReady(boot). (API.md edit crosses into infra — the app.js API is primary.)

### 68. Event <select> optgroup labels never re-translate on language switch

- **파일**: `js/app.js:1466` · **분류**: i18n · **심각도**: medium · **배치**: core-app · **공수**: S · **리스크**: low
- **근거**: `groups.tr.label = T('트레이너','trainer'); groups.other.label = T('기타','other');` run only inside initAfterData(), called from just init() and importData(). The language path is bindOptions → applyOptions(), which never rebuilds #eventSel. Verified: after ko→en the dropdown still groups events under '트레이너' and '기타' inside an English UI. Same root cause as the tool-select freeze.
- **수정안**: Extract `function syncEventGroups() { … }` reading the optgroups by a data attribute (tag them `groups.tr.dataset.g='tr'` rather than by index, so pack-added groups can't shift positions) and call it from both initAfterData() and applyOptions() alongside syncToolSelects().

### 69. Counted toasts print '1 solves added' and the stat line says 'solve: 3/5' — no plural handling

- **파일**: `js/app.js:617` · **분류**: i18n · **심각도**: low · **배치**: core-app · **공수**: S · **리스크**: low
- **근거**: app.js:617 `T('솔브','solve') + ': <b>' + sum.valid + '/' + sum.count` — the most-looked-at line in the app, singular, while every sibling uses the plural (app.js:967 statsText, mobile.js:49, feat_share.js:397 all say 'solves'). app.js:1152 '1 solves added', app.js:1600 '1 scrambles queued' (the common case), app.js:1317 'imported 1 csTimer sessions'. Korean counter forms are all correct — only English needs the split.
- **수정안**: Change app.js:617 to T('솔브','solves'). Add `function plural(n, one, many) { return n === 1 ? one : many; }` beside T() and apply at 1152, 1600, 1317. Leave app.js:282's T('솔빙','solve') singular — it is the running-timer placeholder. Also worth fixing feat_share.js:476's 'issue(s) found' hedge.

### 70. bpaWpa contains an unreachable dead branch that is immediately overwritten

- **파일**: `js/app.js:596` · **분류**: quality · **심각도**: low · **배치**: core-app · **공수**: S · **리스크**: low
- **근거**: Inside the else at 595 dnfs can only be 0 or 1. Line 596 computes `worst` and 597 filters with it for the dnfs===0 case, which 598 unconditionally discards. So `worst` is only consumed by a filter whose output is thrown away. I verified the function's OUTPUT is correct for all cases (0 DNFs: BPA=best 3 of 4, WPA=worst 3 of 4; 1 DNF: BPA=mean of the 3 finished, WPA=DNF; 2+: both DNF) — the dead code is a maintenance trap that makes it look wrong.
- **수정안**: Replace 596-598 with `var sorted = fin.slice().sort(function(a,b){return a-b;}); var rest = dnfs === 1 ? fin : sorted.slice(0,3);` and delete `worst`. Reuse the same `sorted` in the wpa branch at 603-604 instead of re-sorting into sorted2. Add a node self-test: last4=[10,12,11,20] → bpa 11000, wpa 14333.33; with one DNF → bpa = mean of the 3 finished, wpa = Infinity.

### 71. csTimer import works but export is one-way — no round-trip back out

- **파일**: `js/app.js:1274` · **분류**: data · **심각도**: medium · **배치**: core-app · **공수**: S · **리스크**: low
- **근거**: exportJSON only emits the private {app:'cstimer-clone', …} shape, while importData at 1295 already fully parses csTimer's native format (data.properties.sessionData, /^session(\d+)$/, meta.opt.scrType). Users can move INTO the clone but never back out. js/stats.js:1 already documents that the record shape is csTimer-compatible. For a self-hosted fan clone, that lock-in is the main reason a serious cuber won't trust it with a year of solves.
- **수정안**: Add an 'export as csTimer' button beside btnExpFile emitting the native shape: 'session'+i keyed to the solves array as-is (already compatible), plus properties: { sessionData: JSON.stringify({'1': {name, opt:{scrType: s.event}, rank: i}, …}), sessionN: String(DB.order.length) }. Map clone-only ids ('ru','ruf','mu','cll222','input') to '333' with the original preserved in the session name. Round-trip test: export → re-import through importData → assert identical counts and times.

### 72. App.i18n(key, ko, en) ignores its first parameter — API.md documents a registry that does not exist

- **파일**: `js/app.js:1453` · **분류**: quality · **심각도**: medium · **배치**: core-app · **공수**: M · **리스크**: medium
- **근거**: `i18n: function (key, ko, en) { return T(ko, en); }` — key is discarded and the KO map is never consulted; packs have no way to add to it. API.md:47 documents the 3-arg form as if the key matters. Callers wasted effort: feat_share.js has 34 unique keys, feat_data.js wraps it as tr(), while mobile.js:20 passes the literal 'm' for every string and feat_share.js:20 passes '' — proving the param is understood to be inert. No third language can ever be added.
- **수정안**: Pick one and make code and docs agree. Honest minimal: `i18n: function (key, ko, en) { if (key && KO[key] && lang() === 'ko') return KO[key]; return T(ko, en); }` plus App.registerI18n(map) doing Object.assign(KO, map), so pack pairs stay the default but keys become overridable. Then fix feat_share.js:20 and mobile.js:20 to pass real keys. Otherwise drop the parameter (`i18n: function (ko, en)`) with an arguments.length===3 shim and correct API.md's two mentions.

### 73. Pack and mobile modal contents are built once, snapshotting the language — only feat_share works around it

- **파일**: `js/app.js:137` · **분류**: i18n · **심각도**: medium · **배치**: core-app · **공수**: M · **리스크**: medium
- **근거**: registerModal calls buildFn(body) exactly once at registration, so every label inside is a permanent string. mobile.js:110-120 builds its long-press sheet there ('기록'/'상세 보기'/'삭제'), as do feat_data.js:673/678/683 and feat_tools.js:320. Switch to English and the sheet still reads Korean. Exactly one pack solved it: feat_share.js built a private tx/applyTx/refreshTexts registry wired to App.on('options').
- **수정안**: Promote feat_share's proven pattern into the core: add `tx: function (el, ko, en, attr) { i18nEls.push({el, ko, en, attr: attr || null}); applyTx(...); return el; }` with a module-level i18nEls array, and call `i18nEls.forEach(applyTx)` from applyI18nStatic() so it runs on every applyOptions(). Prune entries where el.isConnected === false to avoid leaking removed modal nodes. Then convert mobile.js and feat_data.js to App.tx and delete feat_share's private copy. Document App.tx in API.md. Also document registerModal's undocumented `titleEl` return field, which feat_share already depends on twice.

### 74. timeToString conflates null/undefined/NaN with DNF — missing data silently renders as a real result

- **파일**: `js/stats.js:21` · **분류**: correctness · **심각도**: medium · **배치**: core-logic · **공수**: S · **리스크**: low
- **근거**: `if (ms === Infinity || ms === DNF || ms == null || isNaN(ms)) return 'DNF';` collapses 'no data' and 'did not finish'. This is why the averageOf(n=2) NaN surfaces as a plausible DNF instead of an obvious error. Four call sites independently reinvent the same guard (app.js:614, app.js:947, feat_stats.js:17 all `v == null ? '-' : ...`), and any site that forgets — e.g. app.js:697 in openAvgDetail — silently prints DNF for missing data.
- **수정안**: Split into `if (ms === Infinity || ms === DNF) return 'DNF';` then `if (ms == null || isNaN(ms)) return '-';`. I grepped every call site: none depend on the null→DNF behaviour, so the three hand-rolled wrappers can then collapse to a direct call. Add `assert('null is not DNF', timeToString(null,2)==='-' && timeToString(Infinity,2)==='DNF')`.

### 75. parseTime('DNF') stores ms=0, so un-DNFing an imported DNF creates a 0.00 solve that becomes the session best

- **파일**: `js/stats.js:51` · **분류**: data · **심각도**: medium · **배치**: core-logic · **공수**: S · **리스크**: low
- **근거**: `if (/^DNF$/i.test(str)) return [DNF, 0];` — the common form in pasted result lists, handled by the multi-line importer. solveToString then renders 'DNF(0.00)'. The real damage: the time-modal save handler sets sv[0][0] and never touches sv[0][1], so unchecking DNF yields a 0-ms solve; sessionSummary's `Math.min.apply(null, times)` then pins the session best at 0.00 permanently and pbSnapshot makes it the PB floor, so no genuine PB ever fires again.
- **수정안**: (1) stats.js:39 → `if (isDNF(solve)) return solve[0][1] ? 'DNF(' + timeToString(solve[0][1], decimals) + ')' : 'DNF';` so a timeless DNF renders honestly and round-trips. (2) app.js time-modal save (~747): block the un-DNF path when sv[0][1] === 0 (toast, or disable #tmDNF). Add `assert('DNF round-trip', solveToString([[DNF,0],'','',0],2)==='DNF' && JSON.stringify(parseTime('DNF'))==='[-1,0]')`. (The app.js half crosses into core-app — the stats.js change is primary.)

### 76. bestAverage reports an all-DNF window as the 'best aoN', making the best cell clickable to a meaningless window #1

- **파일**: `js/stats.js:104` · **분류**: correctness · **심각도**: low · **배치**: core-logic · **공수**: S · **리스크**: medium
- **근거**: `if (a != null && (best == null || a < best))` — Infinity passes both tests, so the first all-DNF window is recorded as best and line 106 returns {value: Infinity, end: <first window>} instead of null. app.js:642 then puts 'DNF' in the best column with a valid bestEnd, and the click handler at 1590 opens a 'best ao12: DNF' detail for solves #1-12. The mo3 best loop at app.js:636-639 has the same flaw.
- **수정안**: stats.js:104 → `if (a != null && a !== Infinity && (best == null || a < best))`; the existing `best == null ? null` return then correctly yields null, app.js:642 leaves bestEnd at -1, and the cell shows '-' and is not clickable. Mirror at app.js:638. This deliberately changes an all-DNF history's best column from 'DNF' to '-' — the honest reading.

### 77. sessionSummary.mean drops DNFs while meanOf() poisons to DNF — two contradictory means in the same panel

- **파일**: `js/stats.js:127` · **분류**: correctness · **심각도**: medium · **배치**: core-logic · **공수**: S · **리스크**: low
- **근거**: sessionSummary excludes DNFs from `times` then divides; meanOf returns Infinity on any DNF. Verified on [10.00, DNF(12.00), 11.00]: sessionSummary(c).mean === 10500 but meanOf(c,2,3) === Infinity. Both render side by side (app.js:616-618 'avg' next to 'mean', with the mo3 row below using meanOf), so a 100-solve session with 6 DNFs shows 'avg: DNF' and 'mean: 12.34' at once, with nothing saying the mean discarded 6 attempts. WCA 9f2 makes a mean containing a DNF a DNF.
- **수정안**: Rename the DNF-excluded value to meanValid, add a WCA-correct `mean: dnf ? Infinity : meanValid` to the returned object (keep `mean` as an alias for one release — API.md:17 exposes sessionSummary to plugins). Then render `mean: {f(sum.meanValid)}` with the count made explicit when sum.dnf > 0, e.g. ` <span class="sub">(valid/count)</span>`. Same label treatment at app.js:617-618, app.js:1014 and feat_stats.js:139. (Render changes cross into core-app/packs.)

### 78. sessionSummary.total excludes DNF attempts, undercounting practice time

- **파일**: `js/stats.js:144` · **분류**: data · **심각도**: low · **배치**: core-logic · **공수**: S · **리스크**: low
- **근거**: `var sum = times.reduce(...)` sums only the DNF-excluded array and is returned as `total: sum`, rendered as cumulative session time at app.js:1019 and feat_stats.js:236. A DNF still consumed wall-clock at the table, so 10 DNF'd 12s attempts under-report ~2 minutes. The same accumulator is legitimately needed for `mean`, so the two uses are conflated.
- **수정안**: Add a second accumulator inside the existing loop: `totalAll += solves[i][0][1] + (solves[i][0][0] > 0 ? solves[i][0][0] : 0);` and return `totalAll` alongside `total` (keep `total` for the mean and for plugin compat per API.md:17). Switch the practice-time displays at app.js:1019 and feat_stats.js:236 to sum.totalAll.

### 79. Averages are truncated, not rounded — but the naive fix regresses the primary timer path from 89% to 53% WCA agreement ✅검증됨

- **파일**: `js/stats.js:25` · **분류**: correctness · **심각도**: low · **배치**: core-logic · **공수**: M · **리스크**: low
- **근거**: timeToString truncates (`Math.floor(ms/base)`) and every aggregate flows through it: mean 10006.666 → '10.00' where WCA 9f gives 10.01. BUT app.js:337 stores raw ms and never truncates singles, so the app computes truncate(mean(raw)) while WCA computes round(mean(truncate(singles))). Monte Carlo (500k trials, two distributions): CURRENT 88.8% agreement (bias -0.33ms); naive round(mean(raw)) 53.2% (bias +4.68ms); round(mean(truncate)) 100%. The mean-truncation accidentally cancels the missing per-single truncation.
- **수정안**: Do NOT just swap floor for round. Truncate each single to display precision BEFORE averaging, then round: add a precision-aware path (e.g. `wcaAvg(solves, end, n, decimals)`) mapping timeOf through Math.floor(t/base)*base (preserving Infinity for DNF) before trimmedMean, then Math.round(v/base)*base. Keep timeToString truncating for singles. The one genuine catch to keep: renderStats' shared f() at app.js:614 formats both sum.best (single) and sum.avg (average) and must split into two formatters. Only reliably visible for typed times today (66.8% agreement there).

### 80. FMC falls back to an out-of-spec scramble after 100 tries, and the self-test only checks F/R not B/L

- **파일**: `js/scramble.js:43` · **분류**: correctness · **심각도**: medium · **배치**: core-logic · **공수**: S · **리스크**: low
- **근거**: `return scr;` after the loop returns the last REJECTED scramble — an FMC scramble that cancels at the R' U' F seam, handed to the user with no signal. The test can't catch it: `assert('FMC no cancel', toksFm[3].charAt(0) !== 'F' && ... !== 'R')` checks one letter of each two-letter constraint on a single sample; firstNot is ['F','B'] but B is never checked, lastNot is ['R','L'] but L is never checked.
- **수정안**: Hoist `var scr;` outside and `throw new Error('nnnWithConstraint: no scramble satisfied first!=' + firstNot + ' last!=' + lastNot + ' in 100 tries');` on exhaustion — pass rate is ~44%/try so 100 failures has probability ~1e-25. Replace the assert with a 200-sample loop checking `'FB'.indexOf(f0) >= 0 || 'RL'.indexOf(l0) >= 0` on the real 333fm output.

### 81. Skewb and Pyraminx defLen=9 is below both puzzles' God's number (11) — easy states 2.1x over-represented

- **파일**: `js/scramble.js:148` · **분류**: quality · **심각도**: medium · **배치**: core-logic · **공수**: S · **리스크**: low
- **근거**: A 9-random-move scramble cannot reach any state at distance 10-11 and heavily over-weights easy ones. BFS'd the skewb space with the repo's own draw_skewb.js: |ball(5)| = 12,321 of 3,149,280 → uniform 0.391%. Measured hit rate: len 9 → 0.833% (2.13x), len 11 → 0.560%, len 13 → 0.435%, len 20 → 0.392% (1.00x). A skewb solver gets a near-solved state twice as often as they should, inflating PBs.
- **수정안**: Set defLen 20 for skbso and pyrso, and change the `len || 9` fallbacks in pyraScramble (56) and skewbScramble (75) to `len || 20` — verified statistically indistinguishable from uniform at 20. Pyraminx tips are independent and already uniform, so only body length matters. Add a self-test BFS'ing ball(4) and asserting the generated hit-rate is within 1.25x of |ball(4)|/|G|. Long-term: both spaces (skewb 3.1M, pyra body 933k) are small enough for a real random-state table.

### 82. 444bld and 555bld are byte-identical to 444wca/555wca — no BLD orientation suffix at all

- **파일**: `js/scramble.js:151` · **분류**: feature · **심각도**: medium · **배치**: core-logic · **공수**: S · **리스크**: low
- **근거**: Both BLD entries call the same expression as their non-BLD counterparts, differing only in id and name; meanwhile 333ni does append bldSuffix(). So a 4BLD/5BLD user always gets the cube in a fixed orientation, removing the orientation-recognition component big-BLD scrambles exist to exercise.
- **수정안**: Parameterise bldSuffix by wide-move prefix (the `pre` argument added by the 24-orientation fix) and use the (n/2+1)-layer wide move so the turn is a genuine re-orientation: `gen: function (len) { return [nnnScramble(4, len || 40), bldSuffix('3')].filter(Boolean).join(' '); }` yielding suffixes like `3Rw2 3Uw'`. draw_nnn.js already parses these (TOKEN_RE handles the numeric width prefix; line 116 clamps width > n-1) and 3Rw/3Fw/3Uw are center-equivalent to x/z/y on both 4x4 and 5x5. Confirm against csTimer before shipping; bldSuffix('') is still strictly better than the current no-op.

### 83. Megaminx 'len' means lines, not moves — the shared len box lets a user request a 200-line scramble

- **파일**: `js/scramble.js:147` · **분류**: design · **심각도**: medium · **배치**: core-logic · **공수**: S · **리스크**: low
- **근거**: `gen: function (len) { return megaScramble(len || 7); }` where megaScramble's parameter is `lines`, while every other event's len is moves. js/app.js shows the len box for any event with defLen, and index.html:58 is one shared `<input id="scrLenInput" min=1 max=200>`. A user with 3x3 at 25 switches to megaminx, sees a box reading 7, types 25, and silently gets a 25-line / 275-token scramble (max 2200 tokens). The Pochmann line format itself is correct.
- **수정안**: Add a unit and clamp: `gen: function (len) { return megaScramble(Math.min(Math.max(len || 7, 1), 20)); }, defLen: 7, lenUnit: 'lines'`. In js/app.js's syncScrLenBox (~1267) use ev.lenUnit to set `$('scrLenInput').max = ev.lenUnit === 'lines' ? 20 : 200` and to swap the label text. (The app.js half crosses into core-app — the scramble.js clamp is primary and safe alone.)

### 84. All randomness is one unseeded Math.random with no crypto source and no reproducibility hook

- **파일**: `js/scramble.js:9` · **분류**: quality · **심각도**: low · **배치**: core-logic · **공수**: S · **리스크**: low
- **근거**: `function rnd(n) { return Math.floor(Math.random() * n); }` routes every generator, and draw_clock.js / draw_sq1.js each have their own private randInt. Not modulo-biased, so not a correctness bug — but V8's Math.random is xorshift128+ with a recoverable state and is not seedable. Consequences: nothing here can honestly be called competition-grade, feat_share cannot share a scramble by seed, and a failing distribution report cannot be reproduced.
- **수정안**: Centralise on one crypto-backed rejection-sampled rnd with a pluggable source: `var _src = null;` → if _src use it; else if crypto.getRandomValues, `var lim = Math.floor(0x100000000/n)*n; do { c.getRandomValues(a); } while (a[0] >= lim); return a[0] % n;`; else Math.random (keeps node self-tests working). Export `api.setSource = function (fn) { _src = fn || null; }` and document it in API.md. Point draw_clock.js randInt and draw_sq1.js at the same helper so there is one source.

### 85. Scramble self-tests check format only, never state distribution — this is why the clock bug survived

- **파일**: `js/scramble.js:183` · **분류**: test · **심각도**: medium · **배치**: core-logic · **공수**: S · **리스크**: low
- **근거**: Every assertion is syntactic: '222 only URF' is a charset regex, '777 has 3w' a substring, 'mega line format' a shape, 'clock fallback format' just /y2/. All pass on a generator reaching 29.6% of the clock state space. draw_clock.js's own 'dial range' test passes because 0..5 IS a valid range. The pyraminx test named 'pyra has tips section' asserts nothing about tips — deleting the entire tip block leaves it green.
- **수정안**: Add distribution assertions to the existing node self-tests. Clock: 50k scrambles, assert the signed-amount set equals {-5..6} and residues mod 12 number 12. Pyraminx: 300 samples against `/^([ULRB]'? ){8}[ULRB]'?( [ulrb]'?){0,4}$/` with tips in u,l,r,b order each ≤1 time, plus a 20k distribution check that each tip is absent 30-37% of the time. Random-move events: assert measured P(optimal ≤ 3) stays under a documented threshold so known bias is pinned rather than drifting. Random-state events: chi-square against the BFS optimal-length histogram (free once the table exists).

### 86. Square-1 draw() discards the illegal-slash result and confidently renders a state that isn't the scramble

- **파일**: `js/draw_sq1.js:306` · **분류**: correctness · **심각도**: medium · **배치**: core-logic · **공수**: S · **리스크**: low
- **근거**: `applyScramble(state, scramble, false);` — the third arg is `strict` and the boolean is thrown away. Per the module's own contract (178-181), non-strict silently SKIPS an illegal '/' and applies the rest on top. Verified: applyScramble(solvedState(), '(0,1)/', false) returns false and the wrong state is still rendered. Reachable from the input-scramble mode (js/app.js:953 dispatches pasted scrambles straight to ScrImage.sq1.draw) — exactly where a cuber pastes a competition scramble and trusts the picture.
- **수정안**: `var legal = applyScramble(state, scramble, true);` and after the drawLayer calls, if !legal overlay a red banner ('illegal slice — diagram incomplete') using the TDS --red. Strict mode returns early on the first bad slash, so the partial state drawn is the true state up to that point — honest. Self-test that draw() flags '(0,1)/' and never flags genScramble() output (which already strict-replays 200/200).

### 87. Clock FRONT/BACK labels are hardcoded rgba(0,0,0,.55) and vanish in dark theme

- **파일**: `js/draw_clock.js:200` · **분류**: design · **심각도**: medium · **배치**: core-logic · **공수**: S · **리스크**: low
- **근거**: COLORS.label is a literal, and labelY (319) puts the text BELOW the backplate on bare transparent canvas, so it composites over the card background. The dark theme's --card is #1b1c20 — 55% black on that is black-on-black, so FRONT/BACK disappear exactly when a cuber needs to know which plate is which. Every other clock element sits on its own opaque backplate. The font is also 'sans-serif' rather than the app's Pretendard.
- **수정안**: Read the colour from the canvas element so the module stays standalone: in draw(), `if (typeof getComputedStyle === 'function' && canvas.ownerDocument) { var cs = getComputedStyle(canvas.ownerDocument.body); labelCol = cs.getPropertyValue('--sub').trim() || COLORS.label; labelFont = cs.fontFamily || 'sans-serif'; }` and pass both into drawFace (extend its signature). --sub is #6b7684 light / #8b95a1 dark, both clean. Guard the block so the node stub (no ownerDocument) falls back to the constants.

### 88. The nnn flat net draws faces edge-to-edge, so face boundaries are indistinguishable from sticker boundaries

- **파일**: `js/draw_nnn.js:133` · **분류**: design · **심각도**: medium · **배치**: core-logic · **공수**: S · **리스크**: low
- **근거**: Face origins are exact multiples of n units, so U touches F with zero separation and L/F/R/B form one contiguous 4n strip. Every sticker gets the same strokeRect with lineWidth 1, so the U/F boundary is pixel-identical to an intra-face line — the cross reads as one undifferentiated grid. The sibling module already solves this: draw_skewb.js:201-204 defines GAP=0.08 with CELL/NET_W/NET_H. nnn is the most-used family and the only one lacking it; worst on 7x7 (u=8.95px, a 21x28 sea of identical squares).
- **수정안**: Adopt the skewb convention: `var GAP = 0.10; var NW = 4*n + 3*GAP, NH = 3*n + 2*GAP;` scale u/ox/oy against NW/NH, and make pos fractional: `[[n+GAP,0],[2*n+2*GAP,n+GAP],[n+GAP,n+GAP],[n+GAP,2*n+2*GAP],[0,n+GAP],[3*n+3*GAP,n+GAP]]`. The draw loop needs no change (it already computes x = ox + (pos[f][0]+c)*u). No existing self-test constrains layout; add one asserting the 6 face rects are pairwise separated by >= GAP*u.

### 89. nnn per-size wrappers drop the colors argument, so the module's own colour-scheme support is unreachable

- **파일**: `js/draw_nnn.js:158` · **분류**: feature · **심각도**: medium · **배치**: core-logic · **공수**: M · **리스크**: low
- **근거**: draw(canvas, scramble, n, colors) honours `var pal = colors || COLORS`, but the registered wrapper is `draw: function (canvas, scr) { draw(canvas, scr, n); }` — the 4th parameter is dead code. app.js only ever calls mod.draw(c, currentScramble()). COLORS is a frozen module-private Western scheme, so a cuber on the Japanese scheme or anyone red/green colour-deficient gets an image that doesn't match the cube in their hands. csTimer exposes this as a first-class setting.
- **수정안**: Thread it: `draw: function (canvas, scr, colors) { draw(canvas, scr, n, colors || api.colors); }` with a mutable `api.colors` and `api.setColors(c)` guarded on c.length === 6. Then (core-app side) add `cubeColors: null` to DEFAULT_OPTIONS, pass it at the image-tool render, and add a 6-swatch row to the settings modal bound like the accent switcher. Ship Western (current) and Japanese ['#ffffff','#ee0000','#00d800','#0000f2','#ff8000','#ffff00'] presets so the common case is one click. The draw_nnn.js half is primary and safe alone.

### 90. Random-state 2x2 is cheap and feasible — current random-move over-represents ≤6-move states 3.4x

- **파일**: `js/scramble.js:138` · **분류**: feature · **심각도**: high · **배치**: core-logic · **공수**: M · **리스크**: low
- **근거**: Prototyped: 2x2 corner model (fix DBL) = 5040 perms × 729 twists = 3,674,160 states. Coordinate move tables + full BFS from solved reaches ALL states in 100ms in node (confirming god's number 11 HTM); tables ≈ 3.6MB; 1000 random-state scrambles by greedy descent took 1ms. Measured bias of the current generator over 200k samples: ≤6 optimal 5.83% vs 1.70% uniform (3.4x); ≤3 optimal 0.1355% vs 0.0105% (13x, ~1 in 740); already-solved occurred in the sample. For a ~3s event that materially inflates ao5/ao12.
- **수정안**: Add js/rs222.js exposing genScramble(). Corners URF,UFL,ULB,UBR,DFR,DLF,DRB with DBL fixed; moves U,U2,U',R,R2,R',F,F2,F'. Build permMove/twistMove Int16Array tables (~14ms) then one BFS into a Uint8Array(3674160) (~100ms) lazily on first 2x2 request inside requestIdleCallback or a Worker, showing the random-move scramble as a fallback until ready. genScramble: pick a uniform index, greedily descend dist to 0, emit the reversed+inverted moves. Wire as 222so's gen with a fallback to nnnScramble(2,11,['U','R','F']). Do not cache to localStorage — a 100ms rebuild beats a 3.6MB quota hit. Same skeleton then unlocks pyraminx (933k) and skewb (3.1M).

### 91. Settings tabs, theme segment, accent swatches and mobile nav expose selection only as a CSS class

- **파일**: `index.html:112` · **분류**: a11y · **심각도**: medium · **배치**: core-ui · **공수**: M · **리스크**: low
- **근거**: grep for aria-selected|aria-pressed|aria-current across index.html, style.css and js/app.js returns zero hits. Four groups signal state purely via `.act`: #optTabs (6 plain buttons, panels are plain divs with no tablist/tab/tabpanel roles), #themeSeg, #accentSw (swatches have aria-labels but selection is only a border-colour rule), #mtabs. A screen reader user hears six identical unstated buttons and cannot tell which tab, theme, accent or view is active.
- **수정안**: #optTabs: role="tablist" on the container, role="tab" aria-controls aria-selected on each button, role="tabpanel" tabindex="0" aria-labelledby on each .optPage, syncing aria-selected wherever .act is toggled (js/app.js:1189-1201). #themeSeg / #accentSw: role="radiogroup" + aria-label on the container, role="radio" aria-checked on children. #mtabs (already nav aria-label="views"): aria-current="page" on the active button. Cheapest correct variant if roles feel heavy: keep the buttons and sync aria-pressed in all four groups. (The class toggles live in js/app.js/mobile.js — coordinate; the markup is primary.)

### 92. Dead markup: #toolCanvas and #toolText are destroyed on first paint and referenced by nothing

- **파일**: `index.html:100` · **분류**: quality · **심각도**: low · **배치**: core-ui · **공수**: S · **리스크**: low
- **근거**: `<canvas id="toolCanvas" width="292" height="200">` and `<pre id="toolText">` sit inside #toolBody0, which renderToolSlot wipes with innerHTML='' on the very first render. grep for toolCanvas|toolText in js/ matches only toolCanvasIn(body), which builds a FRESH canvas each call. Verified at first probe: toolCanvasAlive false, toolTextAlive false. v1 leftovers; the 292/200 constants are duplicated as toolCanvasIn's fallback.
- **수정안**: Delete index.html:100-101. Keep the `.toolBody canvas` / `.toolBody pre` selectors in style.css:256-257 — they style the runtime-created nodes. Move #metroBox out of #toolBody0 into a hidden `<div id="metroStash" hidden>` sibling at the same time so #toolBody0 starts empty and the innerHTML wipe has nothing static to destroy (coordinate with the core-app metroBox fix).

### 93. Emoji-presentation icons ignore currentColor — the active mobile tab's icon never turns blue

- **파일**: `index.html:392` · **분류**: design · **심각도**: medium · **배치**: core-ui · **공수**: M · **리스크**: low
- **근거**: index.html:392-395 uses &#9201; (U+23F1) and :63 uses &#128337; (U+1F551), both of which default to emoji presentation and render as colour bitmaps that ignore CSS `color`. Confirmed: the '타이머' tab label is #3182f6 while its icon stays a multicolour clock. Full glyph inventory mixes monochrome and colour in the same toolbars: ["↗","⌕","?","⛶","⇅","⚙","↻","❐","🕑","⏱","☰","▤","⚙"]. The empty state's 😊 is the same class.
- **수정안**: Replace the two emoji codepoints with inline SVG that inherits colour (e.g. a 24-viewBox stroke="currentColor" stopwatch for the timer tab, a clock-with-arrow for scramble history) and add `#mtabs .ico svg { display: block }`. Cheap interim: append U+FE0E text-presentation selector (&#9201;&#xFE0E;), though Apple honours it inconsistently. Best: do all 13 icons as one monochrome SVG set.

### 94. #quickBar with its destructive delete button sits dead-centre in the timer pad's tap area

- **파일**: `mobile.css:84` · **분류**: mobile · **심각도**: medium · **배치**: core-ui · **공수**: S · **리스크**: medium
- **근거**: #quickBar is a child of #timerPad and the pad's touchstart passes taps through (`if (e.target.closest('#quickBar')) return;`). Measured at 390x844 after a solve: #timerPad y 135.5-722 (centre 428.75); #quickBar y 439.75-491.75 — straddling the exact centre, with qbDel at x281. So 'start the next solve' contains OK/+2/DNF/comment and delete at its midpoint, and a tap on the 6px gaps between buttons hits #quickBar itself and does nothing (a 280x52 dead zone in the pad's middle).
- **수정안**: mobile.css: `#quickBar { position: absolute; left: 50%; transform: translateX(-50%); bottom: 8px; margin-top: 0; }` — #timerPad is already position:relative. That clears the pad's centre while keeping the bar in thumb reach. Additionally (core-app) narrow js/app.js:451 to `if (e.target.closest('#quickBar button')) return;` so the gaps return to the timer. Verify the pad centre starts a solve and qbDel is >100px from it.

### 95. overscroll-behavior is on body but not html, and no inner scroller contains its chain

- **파일**: `mobile.css:17` · **분류**: mobile · **심각도**: low · **배치**: core-ui · **공수**: S · **리스크**: low
- **근거**: `body { overscroll-behavior: none; } /* no pull-to-refresh mid-solve */`. Measured computed values at 390x844: html 'auto', body 'none', timeListWrap 'auto', toolDock 'auto', .mbox 'auto'. WebKit does not propagate the property from body to the viewport the way Blink does — Safari honours it on the document element — so the declaration is a no-op on the one browser the comment targets, and overscrolling past the end of the solve list or a sheet rubber-bands the whole page.
- **수정안**: mobile.css: (1) make it `html, body { overscroll-behavior: none; }`; (2) add `overscroll-behavior: contain;` to #timeListWrap (46) and #toolDock (112); (3) add it to .mbox (151) so scrolling a long options sheet to its end doesn't chain to the page. Verify on a real iPhone by overscrolling the solve list upward at the top.

### 96. No safe-area-inset-left/right — megaminx scramble lines are eaten by the notch in landscape ✅검증됨

- **파일**: `mobile.css:173` · **분류**: mobile · **심각도**: medium · **배치**: core-ui · **공수**: S · **리스크**: low
- **근거**: grep for safe-area-inset-left|right across all CSS returns nothing; every inset is -top or -bottom. mobile.css:173 is `#main, #leftbar { padding: 6px; }` — a shorthand with no horizontal inset — inside the very @media (max-height:500px) arm that targets notched landscape. Measured at 844x390: #topbar and #timerPad span x=6 w=832; #mtabs is x=0 w=844. Scoping correction: the island band is only y~134-260, so 3x3 scramble text and the tab buttons are NOT cut (cosmetic bleed only) — but megaminx renders 7 lines at y=59-180, and lines 5-7 lose ~4.5 leading characters (the first move of three lines), unrecoverable without rotating the phone.
- **수정안**: After mobile.css:173 add `#main, #leftbar { padding-left: calc(6px + env(safe-area-inset-left, 0px)); padding-right: calc(6px + env(safe-area-inset-right, 0px)); }` — verified the cascade preserves padding-top/bottom at 6px and it is a no-op wherever insets are 0. Skip the #mtabs half: insetting its flex children by the full 59px over-corrects for a corner the island never obscures. Verify in iPhone 14 Pro landscape-left and landscape-right (the inset flips sides).

### 97. No Content-Security-Policy — and index.html has zero inline scripts, so script-src 'self' is free

- **파일**: `index.html:4` · **분류**: security · **심각도**: medium · **배치**: core-ui · **공수**: S · **리스크**: medium
- **근거**: No <meta http-equiv="Content-Security-Policy" anywhere, and GitHub Pages cannot set headers, so meta is the only option. I traced every HTML sink and found no XSS today (statLine/curBestTable/timeList interpolate only numeric Stats output and fixed labels; the session dropdown uses textContent; packs build DOM via el() helpers). But the app's core job is parsing untrusted JSON/CSV from strangers into the DOM. Cost is unusually low: all 13 scripts are <script src=>, no inline block, no on* attributes.
- **수정안**: After `<meta charset="utf-8">` add: `default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; font-src https://cdn.jsdelivr.net data:; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'`. style-src needs 'unsafe-inline' (index.html:20 style attribute, and JS sets el.style.* throughout). Drop the jsdelivr allowances once the font is self-hosted. frame-ancestors is ignored in meta and cannot be set on Pages — accept it. Verify the console for violations around download()'s blob: URLs and the share-card canvas.

### 98. Zero og:/twitter: tags — a shared URL renders as bare text in Discord/KakaoTalk/Twitter

- **파일**: `index.html:6` · **분류**: feature · **심각도**: medium · **배치**: core-ui · **공수**: M · **리스크**: low
- **근거**: grep for 'og:|twitter:' in index.html returns nothing; the head has only <meta name="description">. Yet the app is built to be shared: feat_share.js:284-357 is a share-card modal with navigator.share, summaryText() produces a 'csTimer clone — 3x3 | latest solve … | ao5 …' caption, and there is a ?mini=1 OBS overlay. A cuber who hits Share and drops the URL into a Discord cubing server gets an unstyled link.
- **수정안**: Generate a static 1200x630 icons/og.png (reuse feat_share's drawShareCard composition at 2x, exported once). Add og:type/site_name/title/description/url/image/image:width/image:height plus twitter:card=summary_large_image and twitter:title/image. og:image and og:url MUST be absolute — this is the one documented exception to the relative-URL rule, safe because scrapers fetch them, not the app. Add './icons/og.png' to sw.js PRECACHE (coordinate with infra).

### 99. Manifest omits screenshots — Chrome Android downgrades install to the dismissible mini-infobar

- **파일**: `manifest.webmanifest:11` · **분류**: feature · **심각도**: medium · **배치**: infra · **공수**: M · **리스크**: low
- **근거**: The manifest is 25 lines and stops at icons: no screenshots, categories, lang or dir. Chrome Android only shows the rich install dialog when screenshots with form_factor are present; without them users get the small mini-infobar that is trivially dismissed and does not return. This is a mobile-first PWA (a whole mobile.css layout, mobile.js tabs/swipe/wakeLock) whose install rate is the point of the PWA work.
- **수정안**: Add `"lang":"ko", "dir":"ltr", "categories":["utilities","sports","productivity"]` and a screenshots array with icons/shot-mobile.png (1080x1920, form_factor "narrow") and icons/shot-desktop.png (1920x1080, "wide"), each with a label. Capture both against the local server at those exact viewports and add the paths to sw.js PRECACHE. Leave `id` omitted: it defaults to start_url but resolves against the ORIGIN, so the only correct value is the absolute "/cstimer-clone/", which would break local dev at localhost:8321 root.

### 100. Swipe-between-views is dead across most of every pane — only 5% of the tools view responds

- **파일**: `js/mobile.js:89` · **분류**: mobile · **심각도**: medium · **배치**: packs · **공수**: S · **리스크**: medium
- **근거**: `if (e.target.closest('#timerPad, .modal, #toolDock, #timeListWrap, #scrCtl, select, input, textarea')) { tracking = false; return; }` — but #toolDock and #timeListWrap FILL their panes, so the exclusion swallows the whole view. Grid hit-test at 390x844 with 40 solves: timer view 24% swipeable, list view 50%, tools view 5% (just the 8px #main gutter). Swiping back from tools is effectively impossible. The exclusion is unnecessary for vertical scrollers — line 97 already gates on `|dx| >= 60 && |dx| >= |dy|*1.6`.
- **수정안**: js/mobile.js:89 → `if (e.target.closest('#timerPad, .modal, #scrCtl, select, input, textarea')) { tracking = false; return; }` — keep only the horizontal scroller, the solve surface, modals and form controls. Re-run the grid hit-test (tools/list should reach ~95%) and manually verify a vertical flick in #timeListWrap still scrolls without switching views. While in this file, also gate bindSwipe on the mobile media query (or add `if (!installed) return;` to setView) — the header claims self-gating but a horizontal flick on a 1400x900 touch desktop currently resurrects body.dataset.mview that uninstall() deleted, and persists it to localStorage.