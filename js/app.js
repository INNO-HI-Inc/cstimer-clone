/* app.js — csTimer-clone core v2 (Toss design + plugin API) — original code */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var Stats = window.Stats, Scrambler = window.Scrambler;
  var VERSION = '2.0.0';

  /* =============== i18n =============== */
  var KO = {
    'new': '새 세션', 'manage': '관리', 'clear': '비우기', 'last': '이전', 'next': '다음',
    'len': '길이', 'ok': 'OK', 'comment': '코멘트', 'delete': '삭제', 'copy': '복사',
    'settings': '설정', 'tabTimer': '타이머', 'tabDisplay': '화면', 'tabScramble': '스크램블',
    'tabStats': '통계', 'tabData': '데이터', 'tabAbout': '정보',
    'oInput': '타이머 입력', 'oKeyboard': '키보드 (스페이스)', 'oManual': '수동 입력',
    'oInspection': 'WCA 인스펙션 (15초)', 'oVoice': '인스펙션 알림 (8/12초)', 'off': '끔', 'none': '없음',
    'oHold': '홀드 시작 딜레이', 'oUpdate': '측정 중 표시', 'oEveryFrame': '매 프레임',
    'oMs': '0.001초 표시', 'oSecOnly': '초만 표시', 'oDontShow': '숨김',
    'oPrecision': '시간 정밀도', 'oPhases': '멀티페이즈(스플릿)', 'oStopKeys': '정지 키',
    'oAnyKey': '아무 키', 'oSpaceOnly': '스페이스만', 'oEnterStart': 'Enter로도 시작',
    'oTitleTimer': '탭 제목에 타이머', 'oHaptic': '햅틱 피드백(모바일)', 'oTarget': '목표 시간 (초, 0=끔)',
    'oTheme': '테마', 'light': '라이트', 'dark': '다크', 'system': '시스템',
    'oAccent': '포인트 컬러', 'oTimerSize': '타이머 크기', 'small': '작게', 'normal': '보통',
    'large': '크게', 'huge': '아주 크게', 'oTimerSkin': '타이머 폰트', 'oSkinDefault': '기본',
    'oSkinMono': '모노스페이스', 'oSkinLcd': 'LCD',
    'oUiScale': 'UI 크기', 'oScrSize': '스크램블 크기', 'oFocus': '솔빙 중 UI 숨김',
    'oSecondTool': '도구 패널 2개', 'oLang': '언어',
    'oShowImage': '스크램블 이미지 표시', 'oImgSize': '이미지 크기', 'oMono': '여러 줄 스크램블 모노스페이스',
    'oAutoCopy': '새 스크램블 자동 복사', 'oMoveCount': '무브 수 표시', 'oNextPrev': '다음 스크램블 미리보기',
    'scrNote': '이 클론은 고품질 랜덤 무브 스크램블을 생성합니다 (csTimer 원본은 일부 종목에 랜덤 스테이트 사용).',
    'oBpa': 'BPA / WPA 표시', 'oMark': '목록에 베스트/워스트 색상', 'oConfirmClear': '비우기 전 확인',
    'oListRev': '기록 목록: 과거순', 'oConfetti': 'PB 컨페티', 'oPbSound': 'PB 사운드',
    'openExport': '내보내기 / 가져오기…', 'exportTitle': '내보내기 / 가져오기',
    'expFile': '파일로 내보내기', 'expCopy': '클립보드 복사', 'expCsv': '세션 CSV',
    'impFile': '파일 가져오기 (클론/csTimer .json)', 'impPaste': '붙여넣은 텍스트 가져오기',
    'resetAll': '전체 데이터 초기화', 'pasteJson': '내보낸 JSON을 붙여넣기',
    'sessTitle': '세션', 'inputScrTitle': '스크램블 입력', 'inputScrHint': '한 줄에 하나씩. 순서대로 사용됩니다.',
    'addQueue': '큐에 추가', 'scrHistTitle': '스크램블 히스토리', 'helpTitle': '키보드 단축키',
    'emptyHint': '아직 기록이 없어요.\n스페이스를 눌렀다 떼면 시작!', 'tap': '탭', 'start': '시작', 'stop': '정지',
    'mvTimer': '타이머', 'mvList': '기록', 'mvCube': '큐브', 'mvTools': '도구', 'mvMore': '설정'
  };
  function lang() { return (DB && DB.options.lang) || 'en'; }
  function T(ko, en) { return lang() === 'ko' ? ko : en; }
  function applyI18nStatic() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var k = el.dataset.i18n;
      if (!el.dataset.orig) el.dataset.orig = el.textContent;
      el.textContent = (lang() === 'ko' && KO[k]) ? KO[k] : el.dataset.orig;
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
      var k = el.dataset.i18nPh;
      if (!el.dataset.origPh) el.dataset.origPh = el.placeholder;
      el.placeholder = (lang() === 'ko' && KO[k]) ? KO[k] : el.dataset.origPh;
    });
  }

  /* =============== data =============== */
  var DEFAULT_OPTIONS = {
    input: 'keyboard', inspection: false, voiceAlert: 'none', holdDelay: 300,
    update: 'cs', precision: 2, phases: 1, stopKeys: 'any', enterStart: false,
    titleTimer: false, haptic: false, targetMs: 0,
    theme: 'system', accent: 'blue', timerScale: 1, timerSkin: 'default',
    uiScale: 1, scrambleScale: 1, focusMode: false, secondTool: false, lang: 'ko',
    showImage: true, imgScale: 1, monoScramble: true, autoCopyScr: false,
    showMoveCount: true, nextPreview: false,
    showMo3: false, showAo50: false, showAo100: false, showAo1000: false,
    bpaWpa: false, markBestWorst: true, confirmClear: true, listReverse: false,
    confetti: true, pbSound: false,
    tool0: 'image', tool1: 'stats', metroBpm: 60, scrLens: {}
  };
  var DB = null;
  var STORE_KEY = 'cstc_data_v1';

  function newSession(name, event) {
    return { name: name, event: event || '333', solves: [], created: Math.floor(Date.now() / 1000) };
  }
  function freshDB() {
    return { app: 'cstimer-clone', version: 2, sessions: { '1': newSession('Session 1') }, order: ['1'], current: '1', options: Object.assign({}, DEFAULT_OPTIONS) };
  }

  /* Every path that puts a foreign blob into DB (loadDB, importData) MUST go through this.
   * A single missing session/solves array here bricks the app permanently: initAfterData()
   * throws, the debounced save persists the corrupt blob anyway, and every reload re-throws
   * before emit('ready') so all feature packs die too.
   * Returns a structurally valid DB, or null if nothing salvageable is in `raw`. */
  function normalizeDB(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var src = (raw.sessions && typeof raw.sessions === 'object') ? raw.sessions : null;
    if (!src) return null;
    var sessions = {};
    Object.keys(src).forEach(function (id) {
      var s = src[id];
      if (!s || typeof s !== 'object') return;
      var ev = Scrambler.byId(s.event);
      var out = {
        name: String(s.name == null ? id : s.name),
        event: (ev && ev.id) || '333',
        solves: Array.isArray(s.solves) ? s.solves.filter(sanitizeSolve) : [],
        created: (typeof s.created === 'number' && isFinite(s.created)) ? s.created : Math.floor(Date.now() / 1000)
      };
      // preserve pack-owned session extras (color, archived, …) that core does not model
      Object.keys(s).forEach(function (k) { if (!(k in out)) out[k] = s[k]; });
      sessions[id] = out;
    });
    var order = (Array.isArray(raw.order) ? raw.order : []).filter(function (id) { return !!sessions[id]; });
    Object.keys(sessions).forEach(function (id) { if (order.indexOf(id) < 0) order.push(id); });
    if (!order.length) return null;
    return {
      app: 'cstimer-clone',
      version: raw.version || 2,
      sessions: sessions,
      order: order,
      current: sessions[raw.current] ? raw.current : order[0],
      options: Object.assign({}, DEFAULT_OPTIONS, (raw.options && typeof raw.options === 'object') ? raw.options : {})
    };
  }
  /* a solve is [[pen, ms(, splits)], scramble, comment, epoch]; repair in place, drop the unrepairable */
  function sanitizeSolve(sv) {
    if (!Array.isArray(sv) || !Array.isArray(sv[0])) return false;
    if (typeof sv[0][1] !== 'number' || !isFinite(sv[0][1])) return false;
    sv[0][0] = (typeof sv[0][0] === 'number' && isFinite(sv[0][0])) ? sv[0][0] : 0;
    sv[1] = (sv[1] == null) ? '' : String(sv[1]);
    sv[2] = (sv[2] == null) ? '' : String(sv[2]);
    sv[3] = (typeof sv[3] === 'number' && isFinite(sv[3])) ? sv[3] : 0;
    return true;
  }

  function loadDB() {
    var parsed = null;
    try { parsed = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { parsed = null; }
    DB = normalizeDB(parsed) || freshDB();
  }

  var saveTimer = null;
  var saveBroken = false;
  var quotaBanner = null;
  function isQuotaError(e) {
    return !!e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014);
  }
  function cancelPendingSave() { if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; } }
  function writeDB() { localStorage.setItem(STORE_KEY, JSON.stringify(DB)); }
  function saveDB() {
    cancelPendingSave();
    saveTimer = setTimeout(function () {
      saveTimer = null;
      try { writeDB(); clearSaveBroken(); return; }
      catch (e) {
        if (!isQuotaError(e)) { toast(T('저장 실패', 'save failed'), { type: 'error' }); return; }
        // give packs a chance to free their own keys — core must not reach into pack-private storage
        emit('quota');
        try { writeDB(); clearSaveBroken(); return; } catch (e2) { }
        showSaveBroken();
      }
    }, 120);
  }
  function clearSaveBroken() {
    if (!saveBroken) return;
    saveBroken = false;
    if (quotaBanner) { quotaBanner.remove(); quotaBanner = null; }
  }
  /* Loud + recoverable: solves keep being recorded in memory but are NOT persisted, so the
   * banner must never auto-dismiss and must offer a way out (export). */
  function showSaveBroken() {
    saveBroken = true;
    if (quotaBanner) return;
    var b = document.createElement('div');
    b.id = 'quotaBanner';
    b.setAttribute('role', 'alert');
    b.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:9999;display:flex;gap:10px;' +
      'align-items:center;justify-content:center;flex-wrap:wrap;padding:10px 14px;' +
      'background:var(--red,#f04452);color:#fff;font-size:13px;font-weight:600;line-height:1.5;';
    b.appendChild(document.createTextNode(T(
      '저장 공간이 가득 차 새 기록이 저장되지 않아요. 지금 내보내기 하세요.',
      'storage is full — new solves are NOT being saved. Export now.')));
    var exp = document.createElement('button');
    exp.textContent = T('지금 내보내기', 'export now');
    exp.style.cssText = 'padding:5px 12px;border-radius:8px;border:0;cursor:pointer;font-weight:700;background:#fff;color:var(--red,#f04452);';
    exp.addEventListener('click', function () {
      download('cstimer-clone_rescue_' + new Date().toISOString().slice(0, 10) + '.json', exportJSON());
    });
    b.appendChild(exp);
    document.body.appendChild(b);
    quotaBanner = b;
  }
  function curSession() { return DB.sessions[DB.current]; }
  function opts() { return DB.options; }

  /* =============== event bus =============== */
  var listeners = {};
  function on(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); }
  function emit(ev) {
    var args = Array.prototype.slice.call(arguments, 1);
    (listeners[ev] || []).forEach(function (fn) { try { fn.apply(null, args); } catch (e) { console.error('[pack]', ev, e); } });
  }

  /* =============== toasts =============== */
  function toast(msg, o) {
    o = o || {};
    var t = document.createElement('div');
    t.className = 'toast' + (o.type && o.type !== 'info' ? ' ' + o.type : '');
    t.appendChild(document.createTextNode(msg));
    if (o.action) {
      var b = document.createElement('button');
      b.textContent = o.action.label;
      b.addEventListener('click', function () { o.action.onClick(); kill(); });
      t.appendChild(b);
    }
    $('toasts').appendChild(t);
    var killed = false;
    function kill() {
      if (killed) return; killed = true;
      t.classList.add('out');
      setTimeout(function () { t.remove(); }, 260);
    }
    setTimeout(kill, o.ms || (o.action ? 5000 : 2600));
    return kill;
  }

  /* =============== screen-reader status =============== */
  /* #timerDisplay is aria-live="off" (correct — it repaints every animation frame), which left
   * a screen-reader user with no way to ever learn their time. This is the compensating region:
   * it is written ONLY at state transitions, never from timerLoop(). */
  var srEl = null;
  function srStatus() {
    if (srEl && srEl.isConnected) return srEl;
    srEl = $('srStatus');
    if (!srEl) {
      srEl = document.createElement('div');
      srEl.id = 'srStatus';
      srEl.className = 'sr-only';
      // inline so the region works regardless of whether style.css ships an .sr-only utility
      srEl.style.cssText = 'position:absolute;width:1px;height:1px;margin:-1px;padding:0;' +
        'overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0;';
      document.body.appendChild(srEl);
    }
    srEl.setAttribute('role', 'status');
    srEl.setAttribute('aria-live', 'polite');
    srEl.setAttribute('aria-atomic', 'true');
    return srEl;
  }
  function announce(msg) {
    var el = srStatus();
    // re-announce an identical string (e.g. two equal times in a row)
    if (el.textContent === msg) el.textContent = '';
    el.textContent = msg;
  }
  /* solveToString gives '1.20+' / 'DNF(1.20)' — both read badly aloud */
  function speakSolve(sv, p) {
    var pen = sv[0][0];
    if (pen === Stats.DNF) return T('DNF, ', 'D N F, ') + Stats.timeToString(sv[0][1], p);
    var base = Stats.timeToString(sv[0][1], p);
    return pen > 0 ? base + T(' 플러스 2', ' plus 2') : base;
  }

  /* =============== modals =============== */
  /* Focus management: the dialogs declare aria-modal, which tells AT the rest of the page is
   * inert — but focus was never moved into them, so a keyboard user stayed outside the dialog
   * and could Tab onto destructive controls (⚙ open → 4 Tabs → "clear session"). */
  var modalStack = [];   // trigger elements, one per nested open (styledConfirm opens over others)
  var FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  function focusablesIn(m) {
    return Array.prototype.filter.call(m.querySelectorAll(FOCUSABLE), function (el) {
      return !el.disabled && el.offsetParent !== null;
    });
  }
  function topModal() {
    var open = document.querySelectorAll('.modal.show');
    return open.length ? open[open.length - 1] : null;
  }
  function showModal(id) {
    var m = $(id);
    if (!m) return;
    var trigger = document.activeElement;
    modalStack.push((trigger && trigger !== document.body) ? trigger : null);
    m.classList.add('show');
    var f = focusablesIn(m);
    // prefer the first real control over the ✕ close button
    var first = f.filter(function (el) { return !el.classList.contains('mclose'); })[0] || f[0];
    if (first) { try { first.focus(); } catch (e) { } }
  }
  function closeModals() {
    var open = document.querySelectorAll('.modal.show');
    var any = open.length > 0;
    // Blur BEFORE hiding: display:none on the focused element makes the browser run its own
    // focus fixup to <body>, and that fixup lands AFTER our restore call and undoes it.
    var a = document.activeElement;
    if (a && a.blur) {
      for (var j = 0; j < open.length; j++) {
        if (open[j].contains(a)) { a.blur(); break; }
      }
    }
    open.forEach(function (m) { m.classList.remove('show'); });
    editIndex = -1;
    if (!any) { modalStack.length = 0; return; }
    // closeModals() closes ALL dialogs, so restore the trigger of the outermost one
    var trigger = modalStack.length ? modalStack[0] : null;
    modalStack.length = 0;
    // isConnected is not enough — styledConfirm's dialog removes itself and its trigger may be
    // inside a dialog that just closed; only restore focus to something actually visible
    if (trigger && trigger.isConnected && trigger.offsetParent !== null) {
      try { trigger.focus(); } catch (e) { }
    }
  }
  /* Names the dialog from its own visible title. Done here rather than in index.html so the
   * 7 dynamically-registered dialogs get the same treatment as the 8 static ones. */
  var labelSeq = 0;
  function labelModal(m) {
    m.setAttribute('aria-modal', 'true');
    if (m.getAttribute('aria-labelledby')) return;
    var sp = m.querySelector('.mtitle > span');
    if (!sp) return;
    if (!sp.id) sp.id = 'mtitle_' + (++labelSeq);
    m.setAttribute('aria-labelledby', sp.id);
  }
  function registerModal(id, title, buildFn) {
    var m = document.createElement('div');
    m.className = 'modal'; m.id = id; m.setAttribute('role', 'dialog');
    var box = document.createElement('div'); box.className = 'mbox';
    var mt = document.createElement('div'); mt.className = 'mtitle';
    var sp = document.createElement('span'); sp.textContent = title;
    var x = document.createElement('button'); x.className = 'mclose'; x.innerHTML = '&#10005;';
    x.addEventListener('click', closeModals);
    mt.appendChild(sp); mt.appendChild(x);
    var body = document.createElement('div'); body.className = 'mbody';
    box.appendChild(mt); box.appendChild(body); m.appendChild(box);
    m.addEventListener('mousedown', function (e) { if (e.target === m) closeModals(); });
    document.body.appendChild(m);
    labelModal(m);
    if (buildFn) buildFn(body);
    return { open: function () { showModal(id); }, close: closeModals, body: body, titleEl: sp };
  }
  function styledConfirm(msg, onYes) {
    var m = registerModal('confirm_' + Math.random().toString(36).slice(2), T('확인', 'confirm'), function (body) {
      var p = document.createElement('p'); p.textContent = msg; p.style.cssText = 'line-height:1.6;margin:4px 0 8px;';
      var btns = document.createElement('div'); btns.className = 'mbtns';
      var no = document.createElement('button'); no.textContent = T('취소', 'cancel');
      var yes = document.createElement('button'); yes.className = 'primary'; yes.textContent = T('확인', 'OK');
      no.addEventListener('click', function () { cleanup(); });
      yes.addEventListener('click', function () { cleanup(); onYes(); });
      btns.appendChild(no); btns.appendChild(yes);
      body.appendChild(p); body.appendChild(btns);
      function cleanup() { closeModals(); setTimeout(function () { m.body.closest('.modal').remove(); }, 200); }
    });
    m.open();
  }

  /* =============== scramble management =============== */
  var scrHistory = [];   // [{ev, scr, t}]
  var scrPtr = -1;
  var nextQueued = null; // pre-generated upcoming scramble
  var inputQueue = [];

  function curEvent() { return Scrambler.byId(curSession().event); }
  function scrLenFor(ev) { return opts().scrLens[ev.id] || ev.defLen || undefined; }

  function generate(ev) {
    if (ev.id === 'input') return inputQueue.length ? inputQueue.shift() : T('(클릭해서 스크램블 입력)', '(click to input scrambles)');
    return ev.gen(scrLenFor(ev));
  }

  function genScramble() {
    var ev = curEvent();
    var s = (nextQueued && nextQueued.ev === ev.id) ? nextQueued.scr : generate(ev);
    nextQueued = null;
    scrHistory.push({ ev: ev.id, scr: s, t: Date.now() });
    if (scrHistory.length > 50) scrHistory.shift();
    scrPtr = scrHistory.length - 1;
    if (ev.id !== 'input' && opts().nextPreview) nextQueued = { ev: ev.id, scr: generate(ev) };
    renderScramble();
    if (opts().autoCopyScr) copyText(currentScramble());
    emit('scramble', s);
    return s;
  }
  function currentScramble() { return scrPtr >= 0 ? scrHistory[scrPtr].scr : ''; }

  function renderScramble() {
    var el = $('scrambleTxt');
    var s = currentScramble();
    el.textContent = '';
    String(s).split('\n').forEach(function (line, i) {
      if (i) el.appendChild(document.createElement('br'));
      el.appendChild(document.createTextNode(line));
    });
    el.classList.toggle('mono', !!opts().monoScramble && String(s).indexOf('\n') >= 0);
    $('btnLastScr').disabled = scrPtr <= 0;
    // move count
    var mc = '';
    if (opts().showMoveCount && curEvent().id !== 'input') {
      var nMoves = String(s).trim().split(/\s+/).filter(Boolean).length;
      mc = nMoves + T('수', ' moves');
    }
    $('scrMeta').textContent = mc;
    // next preview
    var np = $('nextPreview');
    if (opts().nextPreview && nextQueued) {
      np.style.display = 'block';
      np.innerHTML = '';
      var b = document.createElement('b'); b.textContent = T('다음: ', 'next: ');
      np.appendChild(b);
      np.appendChild(document.createTextNode(nextQueued.scr.replace(/\n/g, '  ')));
    } else np.style.display = 'none';
    invalidateTools();
    updateTitle();
  }

  function lastScramble() { if (scrPtr > 0) { scrPtr--; renderScramble(); emit('scramble', currentScramble()); } }
  function nextScramble() {
    if (scrPtr < scrHistory.length - 1) { scrPtr++; renderScramble(); emit('scramble', currentScramble()); }
    else genScramble();
  }

  function openScrHistory() {
    var body = $('scrHistBody');
    body.innerHTML = '';
    if (!scrHistory.length) body.textContent = T('비어 있음', 'empty');
    for (var i = scrHistory.length - 1; i >= 0; i--) {
      (function (i) {
        var h = scrHistory[i];
        var row = document.createElement('div');
        row.style.cssText = 'padding:8px 4px;border-bottom:1px solid var(--line);cursor:pointer;font-size:12px;line-height:1.5;';
        // these rows are plain divs — without this the history modal is mouse-only
        row.setAttribute('role', 'button');
        row.tabIndex = 0;
        var evn = document.createElement('b'); evn.textContent = '#' + (i + 1) + ' ' + h.ev + '  ';
        row.appendChild(evn);
        row.appendChild(document.createTextNode(h.scr.replace(/\n/g, ' ').slice(0, 90)));
        row.addEventListener('click', function () { scrPtr = i; renderScramble(); closeModals(); });
        row.addEventListener('keydown', function (e) {
          if (e.key !== 'Enter' && e.code !== 'Space') return;
          e.preventDefault(); e.stopPropagation(); this.click();
        });
        body.appendChild(row);
      })(i);
    }
    showModal('scrHistModal');
  }

  function openInputScramble() {
    $('inputScrCount').textContent = inputQueue.length ? (T('대기 중: ', 'queued: ') + inputQueue.length) : '';
    showModal('inputScrModal');
  }

  /* =============== timer engine =============== */
  var T_ = {
    state: 'idle', holdStart: 0, runStart: 0, inspStart: 0,
    pen: 0, lastStopAt: 0, said8: false, said12: false, raf: 0,
    prevText: '', splits: [], titleTick: 0, vibedReady: false
  };
  function now() { return performance.now(); }
  function fmtTimer(ms) { return Stats.timeToString(ms, opts().precision); }
  function setDisplay(txt, cls) {
    var el = $('timerDisplay');
    el.textContent = txt;
    el.className = 'skin-' + opts().timerSkin + (cls ? ' ' + cls : '');
    if (opts().timerSkin === 'default') el.className = el.className.replace('skin-default', '').trim();
  }
  function holdReady() { return now() - T_.holdStart >= opts().holdDelay; }
  function vibrate(ms) { if (opts().haptic && navigator.vibrate) navigator.vibrate(ms); }
  /* The WCA penalty must come from the instant the solver released, not from whatever the
   * last rAF happened to paint (frames land up to ~16ms — and up to 61ms during a big
   * renderStats — before the release, so 15.03s could score as no penalty). */
  function inspPenalty() {
    var e = (now() - T_.inspStart) / 1000;
    return e < 15 ? 0 : (e < 17 ? 2000 : Stats.DNF);
  }
  /* Latched so the ready pulse fires once per hold instead of once per animation frame. */
  function readyPulse(rdy) {
    if (!rdy) return;
    if (T_.vibedReady) return;
    T_.vibedReady = true;
    vibrate(15);
  }

  function timerLoop() {
    var o = opts();
    if (T_.state === 'running') {
      var t = now() - T_.runStart;
      var txt;
      if (o.update === 'cs') txt = fmtTimer(t);
      else if (o.update === 'ms') txt = Stats.timeToString(t, 3);
      else if (o.update === 'sec') txt = String(Math.floor(t / 1000));
      else txt = T('솔빙', 'solve');
      setDisplay(txt, 'running');
      if (o.titleTimer && now() - T_.titleTick > 300) {
        T_.titleTick = now();
        document.title = Stats.timeToString(t, 1) + ' — csTimer clone';
      }
    } else if (T_.state === 'inspect' || T_.state === 'inspectHolding') {
      var e = (now() - T_.inspStart) / 1000;
      if (e >= 8 && !T_.said8) { T_.said8 = true; sayAlert(T('8초', '8 seconds')); }
      if (e >= 12 && !T_.said12) { T_.said12 = true; sayAlert(T('12초', '12 seconds')); }
      var txt2;
      // display only — the penalty itself is computed at the start instant, see inspPenalty()
      if (e < 15) txt2 = String(Math.ceil(15 - e));
      else if (e < 17) txt2 = '+2';
      else txt2 = 'DNF';
      var bar = $('inspBar');
      bar.style.display = 'block';
      bar.firstElementChild.style.width = Math.max(0, (1 - e / 15) * 100) + '%';
      if (T_.state === 'inspectHolding') {
        var irdy = holdReady();
        setDisplay(txt2, irdy ? 'ready' : 'holding');
        readyPulse(irdy);
      } else setDisplay(txt2, 'inspect');
    } else if (T_.state === 'holding') {
      var rdy = holdReady();
      setDisplay(fmtTimer(0), rdy ? 'ready' : 'holding');
      readyPulse(rdy);
    } else return;
    T_.raf = requestAnimationFrame(timerLoop);
  }
  function startLoop() { cancelAnimationFrame(T_.raf); T_.raf = requestAnimationFrame(timerLoop); }

  function startInspection() {
    T_.state = 'inspect'; T_.inspStart = now();
    T_.pen = 0; T_.said8 = false; T_.said12 = false;
    announce(T('인스펙션 시작', 'inspection started'));
    startLoop();
  }
  function startTimer() {
    T_.state = 'running'; T_.runStart = now(); T_.splits = [];
    announce(T('측정 시작', 'timer started'));
    $('inspBar').style.display = 'none';
    hideQuickBar();
    document.body.classList.add('solving');
    updatePhaseInfo();
    startLoop();
  }
  function recordSplit() {
    var t = Math.round(now() - T_.runStart);
    T_.splits.push(t);
    updatePhaseInfo();
    // hand the final split's timestamp to stopTimer: re-sampling the clock after the DOM
    // write above lands a millisecond later and appends a bogus extra phase
    if (T_.splits.length >= opts().phases) stopTimer(true, t);
  }
  function updatePhaseInfo() {
    var el = $('phaseInfo');
    if (opts().phases > 1 && T_.state === 'running') {
      el.style.display = 'block';
      var parts = T_.splits.map(function (s, i) { return (i + 1) + ': ' + Stats.timeToString(s, 1); });
      el.textContent = T('구간 ', 'phase ') + (T_.splits.length + 1) + '/' + opts().phases +
        (parts.length ? '  ·  ' + parts.join('  ') : '');
    } else { el.style.display = 'none'; }
  }
  function stopTimer(fromSplit, atMs) {
    var ms = (atMs != null) ? atMs : Math.round(now() - T_.runStart);
    T_.state = 'stopped'; T_.lastStopAt = now();
    cancelAnimationFrame(T_.raf);
    document.body.classList.remove('solving');
    $('phaseInfo').style.display = 'none';
    vibrate(40);
    var pen = T_.pen; T_.pen = 0;
    var splits = null;
    if (opts().phases > 1) {
      // when we came from recordSplit the final split IS ms by construction — no de-dupe needed
      if (!fromSplit) T_.splits.push(ms);
      splits = T_.splits.slice();
    }
    addSolve(pen, ms, splits);
    var rec = splits ? [[pen, ms, splits], '', '', 0] : [[pen, ms], '', '', 0];
    var cls = '';
    var o = opts();
    if (o.targetMs > 0 && pen !== Stats.DNF) cls = (ms + (pen > 0 ? pen : 0)) <= o.targetMs ? 'underTarget' : 'overTarget';
    setDisplay(Stats.solveToString(rec, o.precision), cls);
    announce(speakSolve(rec, o.precision) + ', ' + T('솔브 ', 'solve ') + curSession().solves.length);
    updateTitle();
  }
  function cancelTimer(silent) {
    T_.state = 'idle'; T_.pen = 0; T_.vibedReady = false;
    cancelAnimationFrame(T_.raf);
    document.body.classList.remove('solving');
    $('inspBar').style.display = 'none';
    $('phaseInfo').style.display = 'none';
    setDisplay(fmtTimer(0), '');
    if (!silent) { announce(T('타이머 취소됨', 'timer cancelled')); updateTitle(); }
  }
  function cancelRunning() { // Esc during solve: discard
    cancelTimer();
    toast(T('솔브 취소됨', 'solve discarded'));
  }
  /* A hold is a gesture that needs its release. If the release never arrives — the window
   * lost focus, a modal opened over the pad, the OS stole the touch — the state machine is
   * left in 'holding' with a stale holdStart, and holdReady() is then trivially true: the
   * next instantaneous tap starts a solve with zero hold delay and commits a phantom time.
   * Deliberately does NOT touch 'running': timing straight through a blur is correct. */
  function abortHold() {
    if (T_.state === 'holding' || T_.state === 'preInspect') {
      var prev = T_.prevText;
      cancelTimer(true);
      if (prev) setDisplay(prev, '');
    } else if (T_.state === 'inspectHolding') {
      T_.state = 'inspect'; T_.vibedReady = false;
    } else return;
    padTouching = false;
  }

  /* keys */
  function uiBlocked() {
    if (document.querySelector('.modal.show')) return true;
    var a = document.activeElement;
    // NOTE: a focused <select> must NOT block the timer — picking an event/session
    // leaves focus on the select and would otherwise kill the spacebar until a click elsewhere.
    return !!(a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA'));
  }
  function isStartKey(e) {
    return e.code === 'Space' || (opts().enterStart && e.code === 'Enter');
  }
  function padDown(isStart) {
    if (T_.state === 'running') return; // handled in keydown
    if (now() - T_.lastStopAt < 200) return;
    if (!isStart) return;
    if (T_.state === 'idle' || T_.state === 'stopped') {
      if (opts().inspection) {
        T_.state = 'preInspect';
        T_.prevText = $('timerDisplay').textContent;
        T_.vibedReady = false;
        setDisplay($('timerDisplay').textContent, 'holding');
      } else {
        T_.state = 'holding';
        T_.prevText = $('timerDisplay').textContent;
        T_.holdStart = now();
        T_.vibedReady = false;
        startLoop();
      }
    } else if (T_.state === 'inspect') {
      T_.state = 'inspectHolding';
      T_.holdStart = now();
      T_.vibedReady = false;
    }
  }
  function padUp(isStart) {
    if (!isStart) return;
    if (T_.state === 'preInspect') startInspection();
    else if (T_.state === 'holding') {
      if (holdReady()) startTimer();
      else {
        T_.state = 'idle';
        cancelAnimationFrame(T_.raf);
        setDisplay(T_.prevText || fmtTimer(0), '');
      }
    } else if (T_.state === 'inspectHolding') {
      // sample the penalty at the release instant, before startTimer() moves the clock on
      if (holdReady()) { T_.pen = inspPenalty(); startTimer(); }
      else T_.state = 'inspect';
    }
  }

  /* Keeps Tab inside the open dialog. Must run BEFORE the e.repeat guard below — a held Tab
   * autorepeats and would otherwise walk straight out of the dialog. */
  function trapTab(e) {
    var m = topModal();
    if (!m) return;
    var f = focusablesIn(m);
    if (!f.length) { e.preventDefault(); return; }
    var first = f[0], last = f[f.length - 1];
    var a = document.activeElement;
    if (!m.contains(a)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); return; }
    if (e.shiftKey && a === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
  }

  document.addEventListener('keydown', function (e) {
    if (e.code === 'Tab' && document.querySelector('.modal.show')) { trapTab(e); return; }
    if (e.repeat) return;
    if (T_.state === 'running') {
      if (e.code === 'Escape') { e.preventDefault(); cancelRunning(); return; }
      // stopKeys 'any' must still mean "any key the solver actually pressed" — a bare
      // modifier is the tail of an OS chord, not a stop. (preventDefault cannot block the
      // chord itself; this only stops us committing a bogus time on the way out.)
      if (/^(Shift|Control|Alt|Meta|CapsLock|NumLock|ScrollLock|Fn|OS|AltGraph|Hyper|Super)$/.test(e.key)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      if (opts().phases > 1 && e.code === 'Space') { recordSplit(); return; }
      if (opts().stopKeys === 'space' && e.code !== 'Space' && !(opts().enterStart && e.code === 'Enter')) return;
      stopTimer();
      return;
    }
    if (uiBlocked()) {
      if (e.code === 'Escape') closeModals();
      return;
    }
    // global shortcuts
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { e.preventDefault(); undoAction(); return; }
    // opening help mid-hold would strand the gesture behind uiBlocked(); 'stopped' is included
    // so '?' keeps working in the whole period right after a solve
    if ((e.key === '?' || (e.shiftKey && e.code === 'Slash')) && (T_.state === 'idle' || T_.state === 'stopped')) { openHelp(); return; }
    if (opts().input !== 'keyboard') return;
    if (isStartKey(e)) { e.preventDefault(); padDown(true); return; }
    if (e.code === 'Escape') { cancelTimer(); return; }
    if (T_.state === 'idle' || T_.state === 'stopped') {
      if (e.altKey && e.code === 'ArrowLeft') { lastScramble(); e.preventDefault(); }
      else if (e.altKey && e.code === 'ArrowRight') { nextScramble(); e.preventDefault(); }
    }
  });
  document.addEventListener('keyup', function (e) {
    // a modal that opened mid-hold (⚙ / ? / a pack) makes uiBlocked() true and swallows this
    // release forever — the hold must be aborted rather than left armed
    if (uiBlocked()) { abortHold(); return; }
    if (opts().input !== 'keyboard') return;
    if (isStartKey(e)) { e.preventDefault(); padUp(true); }
  });
  // the release can be lost entirely (alt-tab, notification, page hidden) — same cure
  window.addEventListener('blur', abortHold);
  document.addEventListener('visibilitychange', function () { if (document.hidden) abortHold(); });

  var padTouching = false;
  function bindPad() {
    var pad = $('timerPad');
    pad.addEventListener('touchstart', function (e) {
      if (opts().input !== 'keyboard') return;
      if (e.target.closest('#quickBar')) return;
      if (T_.state === 'running') {
        // Only the touch that begins the contact counts. A two-thumb tap otherwise fires this
        // handler once per finger — recording two splits, or ending a phases=2 solve outright.
        // Testing changedTouches (not `touches.length !== 1`) is deliberate: on iOS/WebKit two
        // simultaneous fingers can coalesce into ONE touchstart with touches.length === 2, and a
        // bare length check would swallow that tap entirely.
        if (e.touches.length === e.changedTouches.length) {
          if (opts().phases > 1) recordSplit(); else stopTimer();
        }
        e.preventDefault(); return;
      }
      padTouching = true; padDown(true); e.preventDefault();
    }, { passive: false });
    pad.addEventListener('touchend', function (e) {
      if (!padTouching) return;
      padTouching = false; padUp(true); e.preventDefault();
    }, { passive: false });
    // a touch stolen by the system (call, gesture, notification) must not strand the timer mid-hold
    pad.addEventListener('touchcancel', function () {
      if (!padTouching) return;
      abortHold();
      padTouching = false;
    });
  }

  /* =============== solves =============== */
  var lastDeleted = null; // {id, index, solve} — id pins the undo to the session it came from
  var lastCleared = null; // {id, solves}

  function pbSnapshot(solves) {
    var sum = Stats.sessionSummary(solves);
    var a5 = Stats.bestAverage(solves, 5), a12 = Stats.bestAverage(solves, 12);
    return { single: sum.best, ao5: a5 ? a5.value : null, ao12: a12 ? a12.value : null };
  }

  function addSolve(pen, ms, splits) {
    var s = curSession();
    var before = pbSnapshot(s.solves);
    var solve = [splits ? [pen, ms, splits] : [pen, ms], currentScramble(), '', Math.floor(Date.now() / 1000)];
    s.solves.push(solve);
    saveDB();
    var after = pbSnapshot(s.solves);
    var pbs = [];
    if (before.single != null && after.single < before.single) pbs.push({ type: 'single', value: after.single });
    if (before.ao5 != null && after.ao5 != null && after.ao5 < before.ao5) pbs.push({ type: 'ao5', value: after.ao5 });
    if (before.ao12 != null && after.ao12 != null && after.ao12 < before.ao12) pbs.push({ type: 'ao12', value: after.ao12 });
    if (pbs.length) {
      var msg = pbs.map(function (p) { return p.type + ' ' + fmtTimer(p.value); }).join(' · ');
      toast(T('세션 베스트! ', 'session best! ') + msg, { type: 'success' });
      celebrate();
      pbs.forEach(function (p) { emit('pb', p); });
    }
    var o = opts();
    if (o.targetMs > 0 && pen !== Stats.DNF && ms + (pen > 0 ? pen : 0) <= o.targetMs) {
      toast(T('목표 달성 🎯', 'target met 🎯'), { type: 'success' });
    }
    renderStats();
    showQuickBar();
    genScramble();
    emit('solve', solve, s.solves.length - 1);
    emit('solvesChanged');
    return solve;
  }

  function updateSolve(i, mutator) {
    var s = curSession();
    if (!s.solves[i]) return;
    mutator(s.solves[i]);
    saveDB(); renderStats(); emit('solvesChanged');
  }
  function deleteSolve(i) {
    var s = curSession();
    if (!s.solves[i]) return;
    lastDeleted = { id: DB.current, index: i, solve: s.solves[i] };
    s.solves.splice(i, 1);
    saveDB(); renderStats(); emit('solvesChanged');
    toast(T('기록 삭제됨', 'solve deleted'), {
      action: {
        label: T('되돌리기', 'undo'), onClick: function () {
          // the toast outlives both the session switch and a ctrl+Z that already consumed lastDeleted
          if (!lastDeleted || lastDeleted.id !== DB.current) return;
          restoreLastDeleted();
        }
      }
    });
  }
  function restoreLastDeleted() {
    var s = curSession();
    s.solves.splice(Math.min(lastDeleted.index, s.solves.length), 0, lastDeleted.solve);
    lastDeleted = null;
    saveDB(); renderStats(); emit('solvesChanged');
  }
  function undoAction() {
    var s = curSession();
    if (lastDeleted && lastDeleted.id === DB.current) {
      restoreLastDeleted();
      toast(T('삭제 취소됨', 'delete undone'));
    } else if (lastCleared && lastCleared.id === DB.current) {
      s.solves = lastCleared.solves; lastCleared = null;
      saveDB(); renderStats(); emit('solvesChanged');
      toast(T('세션 복원됨', 'session restored'));
    } else if (s.solves.length) {
      deleteSolve(s.solves.length - 1);
    }
  }

  /* quick bar */
  function showQuickBar() {
    var qb = $('quickBar');
    qb.classList.add('show');
    syncQuickBar();
  }
  function hideQuickBar() { $('quickBar').classList.remove('show'); }
  function syncQuickBar() {
    var s = curSession();
    var last = s.solves[s.solves.length - 1];
    if (!last) { hideQuickBar(); return; }
    var pen = last[0][0];
    $('qbOK').classList.toggle('on', pen === 0);
    $('qbP2').classList.toggle('on', pen === 2000);
    $('qbDNF').classList.toggle('on', pen === Stats.DNF);
  }
  function quickPen(pen) {
    var s = curSession();
    if (!s.solves.length) return;
    updateSolve(s.solves.length - 1, function (sv) { sv[0][0] = pen; });
    syncQuickBar();
    var last = s.solves[s.solves.length - 1];
    setDisplay(Stats.solveToString(last, opts().precision), '');
  }

  /* =============== stats render =============== */
  var editIndex = -1;

  function statRowsConfig() {
    var o = opts();
    var rows = [{ key: 'time', label: 'time' }];
    if (o.showMo3) rows.push({ key: 'mo3', label: 'mo3', n: 3, mean: true });
    rows.push({ key: 'ao5', label: 'ao5', n: 5 });
    rows.push({ key: 'ao12', label: 'ao12', n: 12 });
    if (o.showAo50) rows.push({ key: 'ao50', label: 'ao50', n: 50 });
    if (o.showAo100) rows.push({ key: 'ao100', label: 'ao100', n: 100 });
    if (o.showAo1000) rows.push({ key: 'ao1000', label: 'ao1000', n: 1000 });
    return rows;
  }

  function bpaWpa(solves) { // over last 4 for the upcoming ao5
    if (solves.length < 4) return null;
    var last4 = solves.slice(-4).map(function (sv) { return Stats.timeOf(sv); });
    var dnfs = last4.filter(function (t) { return t === Infinity; }).length;
    var fin = last4.filter(function (t) { return t !== Infinity; });
    var bpa, wpa;
    if (dnfs >= 2) bpa = Infinity;
    else {
      var worst = dnfs === 1 ? Infinity : Math.max.apply(null, fin);
      var rest = dnfs === 1 ? fin : fin.filter(function (t, i, a) { return i !== a.indexOf(worst); });
      if (dnfs === 0) { var sorted = fin.slice().sort(function (a, b) { return a - b; }); rest = sorted.slice(0, 3); }
      bpa = rest.reduce(function (a, b) { return a + b; }, 0) / 3;
    }
    if (dnfs >= 1) wpa = Infinity;
    else {
      var sorted2 = fin.slice().sort(function (a, b) { return a - b; });
      wpa = (sorted2[1] + sorted2[2] + sorted2[3]) / 3;
    }
    return { bpa: bpa, wpa: wpa };
  }

  function renderStats() {
    var s = curSession();
    var solves = s.solves;
    var sum = Stats.sessionSummary(solves);
    var p = opts().precision;
    var f = function (v) { return v == null ? '-' : Stats.timeToString(v, p); };

    $('statLine').innerHTML =
      T('솔브', 'solve') + ': <b>' + sum.valid + '/' + sum.count + '</b>&nbsp; avg: <b>' + f(sum.avg) + '</b><br>' +
      'mean: <b>' + f(sum.mean) + '</b>' + (sum.sd != null ? '&nbsp; σ: <b>' + f(sum.sd) + '</b>' : '');

    var bl = $('bpaLine');
    if (opts().bpaWpa) {
      var bw = bpaWpa(solves);
      bl.style.display = 'block';
      bl.textContent = bw ? ('BPA ' + f(bw.bpa) + ' · WPA ' + f(bw.wpa)) : 'BPA - · WPA -';
    } else bl.style.display = 'none';

    var rows = statRowsConfig();
    var html = '<tr><th></th><th>' + T('현재', 'current') + '</th><th>' + T('베스트', 'best') + '</th></tr>';
    rows.forEach(function (r) {
      var cur = null, best = null, bestEnd = -1;
      if (r.key === 'time') {
        if (solves.length) cur = Stats.timeOf(solves[solves.length - 1]);
        best = sum.best;
      } else if (r.mean) {
        cur = solves.length >= r.n ? Stats.meanOf(solves, solves.length - 1, r.n) : null;
        for (var e = r.n - 1; e < solves.length; e++) {
          var v = Stats.meanOf(solves, e, r.n);
          if (v != null && (best == null || v < best)) { best = v; bestEnd = e; }
        }
      } else {
        cur = solves.length >= r.n ? Stats.averageOf(solves, solves.length - 1, r.n) : null;
        var ba = Stats.bestAverage(solves, r.n);
        if (ba) { best = ba.value; bestEnd = ba.end; }
      }
      // tabindex only — role="button" here makes the cells presentational and destroys the
      // table semantics AT relies on (verified in the CDP AX tree)
      html += '<tr tabindex="0" data-avg="' + (r.n || 0) + '" data-mean="' + (r.mean ? 1 : 0) + '" data-bestend="' + bestEnd + '">' +
        '<td class="statlabel">' + r.label + '</td><td>' + f(cur) + '</td><td>' + f(best) + '</td></tr>';
    });
    $('curBestTable').innerHTML = html;

    // time list
    var bestIdx = -1, worstIdx = -1, bt = Infinity, wt = -1;
    solves.forEach(function (sv, i) {
      var t = Stats.timeOf(sv);
      if (t !== Infinity) {
        if (t < bt) { bt = t; bestIdx = i; }
        if (t > wt) { wt = t; worstIdx = i; }
      }
    });
    var mark = opts().markBestWorst;
    var listHtml = '<tr><th></th><th>time</th><th>ao5</th><th>ao12</th></tr>';
    var order = [];
    for (var i = solves.length - 1; i >= 0; i--) order.push(i);
    if (opts().listReverse) order.reverse();
    order.forEach(function (i) {
      var ao5 = Stats.averageOf(solves, i, 5);
      var ao12 = Stats.averageOf(solves, i, 12);
      var cls = [];
      if (Stats.isDNF(solves[i])) cls.push('dnf');
      if (mark && i === bestIdx) cls.push('best');
      if (mark && i === worstIdx && worstIdx !== bestIdx) cls.push('worst');
      listHtml += '<tr tabindex="0" data-i="' + i + '" class="' + cls.join(' ') + '"><td class="idx">' + (i + 1) + '</td>' +
        '<td class="t">' + Stats.solveToString(solves[i], p) + '</td>' +
        '<td>' + (ao5 == null ? '-' : Stats.timeToString(ao5, p)) + '</td>' +
        '<td>' + (ao12 == null ? '-' : Stats.timeToString(ao12, p)) + '</td></tr>';
    });
    $('timeList').innerHTML = listHtml;
    $('emptyState').style.display = solves.length ? 'none' : 'block';
    renderSessions();
    invalidateTools();
    syncQuickBar();
    emit('render');
  }

  /* Device split: layout lives in desktop.css / mobile.css (mutually exclusive
   * <link media> queries) and the phone UX layer lives in js/mobile.js.
   * This query MUST match mobile.css's <link media> and mobile.js's MOBILE_MQ. */
  var MOBILE_MQ = '(max-width: 760px), (max-height: 500px) and (max-width: 950px)';
  function isMobile() { return window.matchMedia(MOBILE_MQ).matches; }

  /* avg detail modal */
  function openAvgDetail(n, isMean, endIdx, isBest) {
    var s = curSession();
    var solves = s.solves;
    if (endIdx < 0 || endIdx >= solves.length) return;
    var p = opts().precision;
    var win = solves.slice(endIdx - n + 1, endIdx + 1);
    var times = win.map(function (sv) { return Stats.timeOf(sv); });
    var trim = isMean ? 0 : Math.ceil(n / 20);
    var sorted = times.slice().sort(function (a, b) { return a - b; });
    var lo = sorted.slice(0, trim), hi = sorted.slice(sorted.length - trim);
    var val = isMean ? Stats.meanOf(solves, endIdx, n) : Stats.averageOf(solves, endIdx, n);
    var label = (isMean ? 'mo' : 'ao') + n;
    $('avgTitle').textContent = (isBest ? T('베스트 ', 'best ') : T('현재 ', 'current ')) + label + ': ' + Stats.timeToString(val, p);
    var loUsed = lo.slice(), hiUsed = hi.slice();
    var lines = win.map(function (sv, k) {
      var t = Stats.timeOf(sv);
      var str = Stats.solveToString(sv, p);
      var li, wrapped = false;
      li = loUsed.indexOf(t); if (li >= 0) { loUsed.splice(li, 1); wrapped = true; }
      else { li = hiUsed.indexOf(t); if (li >= 0) { hiUsed.splice(li, 1); wrapped = true; } }
      if (wrapped) str = '(' + str + ')';
      return (endIdx - n + 2 + k) + '. ' + str + '   ' + String(sv[1]).replace(/\n/g, ' ');
    });
    $('avgBody').textContent = lines.join('\n');
    $('avgCopy').onclick = function () {
      copyText(label + ': ' + Stats.timeToString(val, p) + '\n' + lines.join('\n'));
      toast(T('복사됨', 'copied'));
    };
    showModal('avgModal');
  }

  /* time detail modal */
  function openTimeModal(i) {
    var s = curSession();
    var solve = s.solves[i];
    if (!solve) return;
    editIndex = i;
    $('tmTitle').textContent = 'No. ' + (i + 1) + '  ' + Stats.solveToString(solve, opts().precision);
    $('tmScramble').textContent = solve[1] || '(no scramble)';
    $('tmDate').textContent = solve[3] ? new Date(solve[3] * 1000).toLocaleString() : '-';
    var sp = $('tmSplits');
    var splits = solve[0][2];
    if (splits && splits.length > 1) {
      var parts = splits.map(function (t, k) {
        var d = k === 0 ? t : t - splits[k - 1];
        return T('구간', 'phase') + (k + 1) + ': ' + Stats.timeToString(d, 2);
      });
      sp.style.display = 'block';
      sp.textContent = parts.join('  ·  ');
    } else sp.style.display = 'none';
    $('tmExtra').innerHTML = '';
    $('tmComment').value = solve[2] || '';
    var pen = solve[0][0];
    $('tmOK').checked = pen === 0;
    $('tmP2').checked = pen === 2000;
    $('tmDNF').checked = pen === Stats.DNF;
    emit('timeModalOpen', $('tmExtra'), i);
    showModal('timeModal');
  }
  function applyTimeModal() {
    if (editIndex < 0) return;
    updateSolve(editIndex, function (sv) {
      sv[0][0] = $('tmP2').checked ? 2000 : ($('tmDNF').checked ? Stats.DNF : 0);
      sv[2] = $('tmComment').value;
    });
    closeModals();
  }

  /* =============== sessions =============== */
  function renderSessions() {
    var sel = $('sessionSel');
    var prev = sel.value;
    sel.innerHTML = '';
    DB.order.forEach(function (id) {
      var s = DB.sessions[id];
      if (!s || s.archived) return;
      var o = document.createElement('option');
      o.value = id;
      o.textContent = (s.color ? '● ' : '') + s.name + ' (' + s.solves.length + ')';
      sel.appendChild(o);
    });
    sel.value = DB.current;
    if (!sel.value && DB.order.length) sel.value = DB.order[0];
  }
  function switchSession(id) {
    if (!DB.sessions[id]) return;
    DB.current = id;
    $('eventSel').value = curSession().event;
    saveDB();
    renderSessions();
    renderStats();
    scrHistory = []; scrPtr = -1; nextQueued = null;
    genScramble();
    cancelTimer();
    hideQuickBar();
    syncScrLenBox();
    emit('sessionChanged');
  }
  function addSession() {
    var n = 1;
    while (DB.sessions[String(n)]) n++;
    var id = String(n);
    DB.sessions[id] = newSession('Session ' + n, curSession().event);
    DB.order.push(id);
    switchSession(id);
    toast(T('새 세션 생성', 'session created'));
  }
  function clearSession() {
    var s = curSession();
    if (!s.solves.length) return;
    var doClear = function () {
      lastCleared = { id: DB.current, solves: s.solves };
      s.solves = [];
      saveDB(); renderStats(); emit('solvesChanged');
      toast(T('세션 비움', 'session cleared'), {
        action: { label: T('되돌리기', 'undo'), onClick: function () { undoAction(); } }
      });
    };
    if (opts().confirmClear) styledConfirm(T('이 세션의 기록 ' + s.solves.length + '개를 모두 지울까요?', 'clear all ' + s.solves.length + ' solves?'), doClear);
    else doClear();
  }

  function openSessionManager() {
    var body = $('sessMgrBody');
    body.innerHTML = '';
    DB.order.forEach(function (id, idx) {
      var s = DB.sessions[id];
      if (!s) return;
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:6px;align-items:center;padding:7px 0;border-bottom:1px solid var(--line);';
      var up = mkBtn('↑', function () { if (idx > 0) { DB.order.splice(idx, 1); DB.order.splice(idx - 1, 0, id); saveDB(); renderSessions(); openSessionManager(); } });
      var dn = mkBtn('↓', function () { if (idx < DB.order.length - 1) { DB.order.splice(idx, 1); DB.order.splice(idx + 1, 0, id); saveDB(); renderSessions(); openSessionManager(); } });
      up.className = dn.className = 'icon ghost';
      var name = document.createElement('input');
      name.type = 'text'; name.value = s.name;
      name.style.cssText = 'flex:1;min-width:0;';
      name.addEventListener('change', function () { s.name = name.value.trim() || s.name; saveDB(); renderSessions(); });
      var cnt = document.createElement('span');
      cnt.style.cssText = 'color:var(--sub);font-size:12px;';
      cnt.textContent = s.solves.length;
      var del = mkBtn('✕', function () {
        if (DB.order.length <= 1) { toast(T('마지막 세션은 삭제할 수 없어요', 'cannot delete the last session'), { type: 'error' }); return; }
        styledConfirm(T('"' + s.name + '" 세션과 기록 ' + s.solves.length + '개를 삭제할까요?', 'delete "' + s.name + '" and its ' + s.solves.length + ' solves?'), function () {
          var i2 = DB.order.indexOf(id);
          delete DB.sessions[id];
          DB.order.splice(i2, 1);
          if (DB.current === id) DB.current = DB.order[Math.max(0, i2 - 1)];
          saveDB(); renderSessions(); renderStats(); openSessionManager();
        });
      });
      del.className = 'icon danger';
      row.appendChild(up); row.appendChild(dn); row.appendChild(name); row.appendChild(cnt); row.appendChild(del);
      emit('sessMgrRow', row, id);
      body.appendChild(row);
    });
    var add = mkBtn(T('+ 새 세션', '+ new session'), function () { addSession(); openSessionManager(); });
    add.className = 'primary';
    add.style.cssText = 'margin-top:10px;width:100%;';
    body.appendChild(add);
    showModal('sessModal');
  }
  function bindRowKeys(root, sel) {
    root.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.code !== 'Space') return;
      var tr = e.target.closest && e.target.closest(sel);
      if (!tr) return;
      e.preventDefault();
      e.stopPropagation();
      tr.click();
    });
  }
  function mkBtn(txt, fn) {
    var b = document.createElement('button');
    b.textContent = txt;
    b.addEventListener('click', fn);
    return b;
  }

  /* =============== tools =============== */
  var TOOLS = {};
  function registerTool(def) {
    TOOLS[def.id] = def;
    [0, 1].forEach(function (slot) {
      var sel = $('toolSel' + slot);
      if (!sel.querySelector('option[value="' + def.id + '"]')) {
        var o = document.createElement('option');
        o.value = def.id; o.textContent = def.name;
        sel.appendChild(o);
      }
    });
    syncToolSelects();
  }
  function syncToolSelects() {
    $('toolSel0').value = opts().tool0;
    $('toolSel1').value = opts().tool1;
  }
  /* renderStats() and renderScramble() both end in a tool render, and addSolve() calls both —
   * so every solve rendered the tools twice, the first time against the pre-scramble state that
   * was thrown away microseconds later. Coalesce to one render per frame. */
  var toolsDirty = false;
  function invalidateTools() {
    if (toolsDirty) return;
    toolsDirty = true;
    requestAnimationFrame(function () { toolsDirty = false; renderTools(); });
  }
  function renderTools() {
    renderToolSlot(0);
    // the mobile tools tab is a whole screen — always use the second slot there,
    // regardless of the desktop-only "second tool panel" space setting
    var showSecond = opts().secondTool ||
      (isMobile() && document.body.dataset.mview === 'tools');
    if (showSecond) renderToolSlot(1);
    $('toolCard1').style.display = showSecond ? '' : 'none';
  }
  function renderToolSlot(slot) {
    var id = opts()['tool' + slot];
    var def = TOOLS[id] || TOOLS.image;
    var body = $('toolBody' + slot);
    // keep static metroBox alive by moving it out before wipe
    var metro = $('metroBox');
    if (metro && metro.parentNode === body) { metro.style.display = 'none'; document.body.appendChild(metro); }
    body.innerHTML = '';
    try { def.render(body, slot); } catch (e) { body.textContent = 'tool error'; console.error(e); }
  }

  /* The backing store must be device pixels while the box stays CSS pixels, otherwise every
   * puzzle diagram is drawn at 1x and stretched on Retina (feat_stats.js already does this).
   * The draw_* modules read canvas.width/height and scale their art to it, so they need no
   * change — only callers that hardcode CSS-pixel constants (fonts, insets) must pre-scale
   * the context via _dpr. */
  function toolCanvasIn(body) {
    var c = document.createElement('canvas');
    var w = body.clientWidth || 292, h = body.clientHeight || 200;
    var dpr = Math.min(window.devicePixelRatio || 1, 3);
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    c.style.width = w + 'px';
    c.style.height = h + 'px';
    c._dpr = dpr;
    body.appendChild(c);
    return c;
  }
  function scaleCtx(canvas) {
    var ctx = canvas.getContext('2d');
    var d = canvas._dpr || 1;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    return ctx;
  }
  function cssW(canvas) { return canvas.width / (canvas._dpr || 1); }
  function cssH(canvas) { return canvas.height / (canvas._dpr || 1); }
  function drawMsg(canvas, msg) {
    var ctx = scaleCtx(canvas);
    ctx.clearRect(0, 0, cssW(canvas), cssH(canvas));
    ctx.fillStyle = getComputedStyle(document.body).color;
    ctx.font = '12px ' + getComputedStyle(document.body).fontFamily;
    ctx.textAlign = 'center';
    ctx.fillText(msg, cssW(canvas) / 2, cssH(canvas) / 2);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  /* built-in tools */
  function builtinTools() {
    registerTool({
      id: 'image', name: T('스크램블 이미지', 'scramble image'),
      render: function (body) {
        if (!opts().showImage) { body.innerHTML = '<pre>' + T('(이미지 꺼짐 — 설정에서 켜기)', '(image off — enable in settings)') + '</pre>'; return; }
        var c = toolCanvasIn(body);
        var ev = curEvent();
        var mod = ev.img && window.ScrImage && window.ScrImage[ev.img];
        if (mod && mod.draw) {
          try { mod.draw(c, currentScramble()); }
          catch (err) { drawMsg(c, 'image error'); }
        } else drawMsg(c, ev.id === 'input' ? T('입력 스크램블 모드', 'input scramble mode') : T('이미지 없음', 'no image'));
      }
    });
    registerTool({
      id: 'stats', name: T('통계 요약', 'statistics'),
      render: function (body) {
        var pre = document.createElement('pre');
        pre.textContent = statsText();
        body.appendChild(pre);
      }
    });
    registerTool({
      id: 'dist', name: T('분포', 'distribution'),
      render: function (body) {
        var pre = document.createElement('pre');
        pre.textContent = distText();
        body.appendChild(pre);
      }
    });
    registerTool({
      id: 'trend', name: T('추세', 'time trend'),
      render: function (body) {
        var c = toolCanvasIn(body);
        drawTrend(c);
      }
    });
    registerTool({
      id: 'metro', name: T('메트로놈', 'metronome'),
      render: function (body) {
        var box = $('metroBox');
        box.style.display = 'block';
        body.appendChild(box);
      }
    });
  }

  function statsText() {
    var s = curSession();
    var sum = Stats.sessionSummary(s.solves);
    var p = opts().precision;
    var f = function (v) { return v == null ? '-' : Stats.timeToString(v, p); };
    var out = [];
    out.push(T('솔브', 'solves') + ': ' + sum.valid + '/' + sum.count + (sum.dnf ? ' (DNF ' + sum.dnf + ')' : ''));
    out.push('best: ' + f(sum.best) + '   worst: ' + f(sum.worst));
    out.push('avg: ' + f(sum.avg) + '   mean: ' + f(sum.mean) + '   σ: ' + f(sum.sd));
    [5, 12, 50, 100].forEach(function (n) {
      var ba = Stats.bestAverage(s.solves, n);
      if (ba) out.push('best ao' + n + ': ' + f(ba.value) + ' (#' + (ba.end - n + 2) + '–#' + (ba.end + 1) + ')');
    });
    out.push(T('누적', 'total') + ': ' + f(sum.total));
    return out.join('\n');
  }
  function distText() {
    var s = curSession();
    var buckets = {}, keys = [];
    s.solves.forEach(function (sv) {
      var t = Stats.timeOf(sv);
      if (t === Infinity) return;
      var k = Math.floor(t / 1000);
      if (!(k in buckets)) { buckets[k] = 0; keys.push(k); }
      buckets[k]++;
    });
    if (!keys.length) return T('(기록 없음)', '(no solves)');
    keys.sort(function (a, b) { return a - b; });
    var max = Math.max.apply(null, keys.map(function (k) { return buckets[k]; }));
    return keys.map(function (k) {
      var len = Math.round(buckets[k] / max * 26);
      var bar = ''; for (var i = 0; i < len; i++) bar += '█';
      return k + 's+ ' + bar + ' ' + buckets[k];
    }).join('\n');
  }
  function drawTrend(canvas) {
    // all geometry below is in CSS pixels (hardcoded 9px font, 32/38/22 insets) — pre-scale
    var ctx = scaleCtx(canvas);
    ctx.clearRect(0, 0, cssW(canvas), cssH(canvas));
    var s = curSession();
    var pts = [];
    s.solves.forEach(function (sv, i) {
      var t = Stats.timeOf(sv);
      if (t !== Infinity) pts.push([i, t]);
    });
    if (pts.length < 2) { ctx.setTransform(1, 0, 0, 1, 0, 0); drawMsg(canvas, T('기록 2개 이상 필요', 'need 2+ solves')); return; }
    var min = Infinity, max = -Infinity;
    pts.forEach(function (p2) { if (p2[1] < min) min = p2[1]; if (p2[1] > max) max = p2[1]; });
    if (max === min) max = min + 1;
    var W = cssW(canvas) - 38, H = cssH(canvas) - 22;
    var css = getComputedStyle(document.body);
    ctx.strokeStyle = css.getPropertyValue('--line').trim() || '#ccc';
    ctx.lineWidth = 1;
    ctx.strokeRect(32.5, 4.5, W, H);
    ctx.fillStyle = css.getPropertyValue('--sub').trim() || '#888';
    ctx.font = '9px ' + css.fontFamily;
    ctx.textAlign = 'right';
    ctx.fillText(Stats.timeToString(max, 1), 30, 12);
    ctx.fillText(Stats.timeToString(min, 1), 30, H + 6);
    ctx.strokeStyle = css.getPropertyValue('--accent').trim() || '#3182f6';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    pts.forEach(function (p2, i) {
      var x = 32 + (pts.length === 1 ? 0 : (i / (pts.length - 1)) * W);
      var y = 4 + (1 - (p2[1] - min) / (max - min)) * H;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    var solves = s.solves;
    ctx.strokeStyle = '#f04452';
    ctx.beginPath();
    var started = false;
    for (var e = 0; e < solves.length; e++) {
      var a = Stats.averageOf(solves, e, 5);
      if (a == null || a === Infinity) continue;
      var x2 = 32 + (solves.length === 1 ? 0 : (e / (solves.length - 1)) * W);
      var y2 = Math.max(4, 4 + (1 - (a - min) / (max - min)) * H);
      if (!started) { ctx.moveTo(x2, y2); started = true; } else ctx.lineTo(x2, y2);
    }
    ctx.stroke();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  /* metronome */
  var metro = { on: false, timer: null, ac: null, taps: [] };
  function beep(freq, gainVal, dur) {
    if (!metro.ac) metro.ac = new (window.AudioContext || window.webkitAudioContext)();
    var ac = metro.ac;
    var osc = ac.createOscillator(), gain = ac.createGain();
    osc.frequency.value = freq || 1000;
    gain.gain.setValueAtTime(gainVal || 0.4, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + (dur || 0.06));
    osc.connect(gain); gain.connect(ac.destination);
    osc.start(); osc.stop(ac.currentTime + (dur || 0.06) + 0.01);
  }
  function setMetroBpm(bpm) {
    bpm = Math.min(250, Math.max(20, bpm | 0));
    $('metroBpm').value = bpm;
    $('metroSlider').value = bpm;
    opts().metroBpm = bpm; saveDB();
    if (metro.on) {
      clearInterval(metro.timer);
      metro.timer = setInterval(function () { beep(1000, .4, .06); }, 60000 / bpm);
    }
  }
  function toggleMetro() {
    metro.on = !metro.on;
    $('metroToggle').textContent = metro.on ? T('정지', 'stop') : T('시작', 'start');
    if (metro.timer) clearInterval(metro.timer);
    if (metro.on) setMetroBpm(parseInt($('metroBpm').value, 10) || 60);
  }

  /* sounds */
  function sayAlert(txt) {
    var mode = opts().voiceAlert;
    if (mode === 'none') return;
    if (mode === 'voice' && window.speechSynthesis) {
      var u = new SpeechSynthesisUtterance(txt);
      u.lang = lang() === 'ko' ? 'ko-KR' : 'en-US'; u.rate = 1.2;
      speechSynthesis.speak(u);
    } else beep(880, .4, .09);
  }
  function pbChime() {
    if (!opts().pbSound) return;
    beep(660, .3, .12);
    setTimeout(function () { beep(880, .3, .14); }, 120);
    setTimeout(function () { beep(1100, .3, .2); }, 260);
  }

  /* confetti */
  function celebrate() {
    pbChime();
    if (!opts().confetti) return;
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var canvas = $('fxCanvas');
    canvas.width = innerWidth; canvas.height = innerHeight;
    var ctx = canvas.getContext('2d');
    var colors = ['#3182f6', '#03b26c', '#fe9800', '#f04452', '#ffc342'];
    var parts = [];
    for (var i = 0; i < 90; i++) {
      parts.push({
        x: canvas.width / 2 + (Math.random() - .5) * 120,
        y: canvas.height * 0.42,
        vx: (Math.random() - .5) * 11,
        vy: -Math.random() * 11 - 4,
        w: 5 + Math.random() * 5,
        r: Math.random() * Math.PI,
        vr: (Math.random() - .5) * .3,
        c: colors[i % colors.length]
      });
    }
    var t0 = performance.now();
    (function frame(t) {
      var el = (t - t0) / 1000;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (el > 1.4) return;
      parts.forEach(function (p) {
        p.x += p.vx; p.y += p.vy; p.vy += .32; p.r += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.globalAlpha = Math.max(0, 1 - el / 1.4);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.w / 2, -p.w / 2, p.w, p.w * .6);
        ctx.restore();
      });
      requestAnimationFrame(frame);
    })(t0);
  }

  /* =============== manual input =============== */
  function addManual(text) {
    var r = Stats.parseTime(text.trim());
    if (!r) { toast(T('"' + text + '" 해석 불가', 'cannot parse "' + text + '"'), { type: 'error' }); return false; }
    addSolve(r[0], r[1], null);
    setDisplay(Stats.solveToString([[r[0], r[1]], '', '', 0], opts().precision), '');
    return true;
  }
  function bindManual() {
    var inp = $('manualInput');
    inp.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      if (!this.value.trim()) return;
      if (addManual(this.value)) this.value = '';
    });
    inp.addEventListener('paste', function (e) {
      var txt = (e.clipboardData || window.clipboardData).getData('text');
      if (txt && txt.indexOf('\n') >= 0) {
        e.preventDefault();
        var n = 0;
        txt.split('\n').map(function (x) { return x.trim(); }).filter(Boolean).forEach(function (line) {
          if (addManual(line)) n++;
        });
        toast(n + T('개 기록 추가됨', ' solves added'));
      }
    });
  }
  function applyInputMode() {
    var manual = opts().input === 'manual';
    $('manualInput').style.display = manual ? 'block' : 'none';
    $('timerDisplay').style.display = manual ? 'none' : 'block';
    $('padHint').textContent = manual
      ? T('시간 입력 후 Enter (12.34 / 1234 / 12.34+ / DNF(12.34)) · 여러 줄 붙여넣기 지원', 'type times + enter · multi-line paste supported')
      : T('스페이스(또는 화면)를 누르고 있다가 떼면 시작', 'hold space (or touch), release to start');
    if (manual) $('manualInput').focus();
  }

  /* =============== options =============== */
  var OPT_MAP = [
    ['optInput', 'input'], ['optInspection', 'inspection'], ['optVoice', 'voiceAlert'],
    ['optHold', 'holdDelay', 'int'], ['optUpdate', 'update'], ['optPrecision', 'precision', 'int'],
    ['optPhases', 'phases', 'int'], ['optStopKeys', 'stopKeys'], ['optEnterStart', 'enterStart'],
    ['optTitleTimer', 'titleTimer'], ['optHaptic', 'haptic'],
    ['optTimerScale', 'timerScale', 'float'], ['optTimerSkin', 'timerSkin'],
    ['optUiScale', 'uiScale', 'float'], ['optScrScale', 'scrambleScale', 'float'],
    ['optFocus', 'focusMode'], ['optSecondTool', 'secondTool'], ['optLang', 'lang'],
    ['optShowImage', 'showImage'], ['optImgSize', 'imgScale', 'float'], ['optMono', 'monoScramble'],
    ['optAutoCopy', 'autoCopyScr'], ['optMoveCount', 'showMoveCount'], ['optNextPreview', 'nextPreview'],
    ['optMo3', 'showMo3'], ['optAo50', 'showAo50'], ['optAo100', 'showAo100'], ['optAo1000', 'showAo1000'],
    ['optBpaWpa', 'bpaWpa'], ['optMark', 'markBestWorst'], ['optConfirmClear', 'confirmClear'],
    ['optListRev', 'listReverse'], ['optConfetti', 'confetti'], ['optPbSound', 'pbSound']
  ];
  function bindOptions() {
    OPT_MAP.forEach(function (row) {
      var el = $(row[0]);
      if (!el) return;
      var key = row[1], typ = row[2];
      if (el.type === 'checkbox') el.checked = !!opts()[key];
      else el.value = String(opts()[key]);
      el.addEventListener('change', function () {
        var v = el.type === 'checkbox' ? el.checked : el.value;
        if (typ === 'int') v = parseInt(v, 10);
        if (typ === 'float') v = parseFloat(v);
        opts()[key] = v;
        saveDB();
        applyOptions();
        emit('options');
      });
    });
    // target time (seconds → ms)
    var tg = $('optTarget');
    tg.value = opts().targetMs ? (opts().targetMs / 1000) : 0;
    tg.addEventListener('change', function () {
      opts().targetMs = Math.max(0, Math.round(parseFloat(tg.value || '0') * 1000));
      saveDB(); emit('options');
    });
    // theme segmented
    document.querySelectorAll('#themeSeg button').forEach(function (b) {
      b.addEventListener('click', function () {
        opts().theme = b.dataset.v; saveDB(); applyOptions(); emit('options');
      });
    });
    // accent swatches
    document.querySelectorAll('#accentSw button').forEach(function (b) {
      b.addEventListener('click', function () {
        opts().accent = b.dataset.v; saveDB(); applyOptions(); emit('options');
      });
    });
    // tabs
    document.querySelectorAll('#optTabs button').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('#optTabs button').forEach(function (x) { x.classList.remove('act'); });
        document.querySelectorAll('.optPage').forEach(function (x) { x.classList.remove('act'); });
        b.classList.add('act');
        $(b.dataset.page).classList.add('act');
      });
    });
  }

  var sysThemeMq = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
  function effectiveTheme() {
    var t = opts().theme;
    if (t === 'system' || t === 'default') return (sysThemeMq && sysThemeMq.matches) ? 'dark' : 'light';
    return t === 'dark' ? 'dark' : 'light';
  }
  function applyOptions() {
    var o = opts();
    document.body.dataset.theme = effectiveTheme();
    // index.html hardcodes lang="ko" — an English UI would otherwise be read by a Korean
    // synthesizer and Chrome would offer to translate the page (WCAG 3.1.1)
    document.documentElement.lang = lang() === 'ko' ? 'ko' : 'en';
    document.body.dataset.accent = o.accent;
    document.body.style.setProperty('--timer-scale', o.timerScale);
    document.body.style.setProperty('--scr-scale', o.scrambleScale);
    document.body.style.setProperty('--ui-scale', o.uiScale);
    document.body.style.setProperty('--img-scale', o.imgScale);
    document.body.classList.toggle('focusmode', !!o.focusMode);
    // theme segmented state
    document.querySelectorAll('#themeSeg button').forEach(function (b) { b.classList.toggle('act', b.dataset.v === o.theme || (o.theme === 'default' && b.dataset.v === 'system')); });
    document.querySelectorAll('#accentSw button').forEach(function (b) { b.classList.toggle('act', b.dataset.v === o.accent); });
    applyI18nStatic();
    fillAbout();
    fillHelp();
    applyInputMode();
    syncScrLenBox();
    syncToolSelects();
    renderStats();
    renderScramble();
    setDisplay($('timerDisplay').textContent, $('timerDisplay').className.replace(/skin-\w+ ?/, ''));
    updateTitle();
  }
  if (sysThemeMq) sysThemeMq.addEventListener('change', function () { if (opts().theme === 'system') applyOptions(); });

  function updateTitle() {
    if (T_.state === 'running' && opts().titleTimer) return;
    document.title = curEvent().name + ' — csTimer clone';
  }

  function syncScrLenBox() {
    var ev = curEvent();
    var box = $('scrLenBox');
    if (ev.defLen) {
      box.style.display = 'inline-flex';
      $('scrLenInput').value = scrLenFor(ev);
    } else box.style.display = 'none';
  }

  /* =============== import / export =============== */
  function exportJSON() { return JSON.stringify(DB, null, 1); }
  function download(name, content, mime) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type: mime || 'application/json' }));
    a.download = name;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
  }
  function importData(text) {
    var data;
    try { data = JSON.parse(text); } catch (e) { toast(T('잘못된 JSON', 'invalid JSON'), { type: 'error' }); return; }
    if (data && data.app === 'cstimer-clone' && data.sessions) {
      var next = normalizeDB(data);
      if (!next) { toast(T('세션을 찾지 못함', 'no sessions found'), { type: 'error' }); return; }
      styledConfirm(T('현재 데이터를 가져온 데이터로 교체할까요?', 'replace ALL current data with import?'), function () {
        var prev = DB;
        // a save scheduled against the old DB would serialize the NEW one when it fires,
        // so nothing may be pending across the swap — and nothing is persisted until the
        // import is proven to render.
        cancelPendingSave();
        DB = next;
        try {
          initAfterData();
        } catch (err) {
          DB = prev;
          cancelPendingSave();
          try { initAfterData(); } catch (e2) { }
          console.error('[import]', err);
          toast(T('가져오기 실패 — 데이터를 되돌렸어요', 'import failed — rolled back'), { type: 'error' });
          return;
        }
        saveDB();
        toast(T('가져오기 완료', 'import done'), { type: 'success' });
      });
      return;
    }
    if (data && data.properties) {
      var names = {};
      try {
        var sd = JSON.parse(data.properties.sessionData || '{}');
        Object.keys(sd).forEach(function (k) { names[k] = sd[k]; });
      } catch (e) { }
      var imported = 0;
      Object.keys(data).forEach(function (k) {
        var m = /^session(\d+)$/.exec(k);
        if (!m || !Array.isArray(data[k]) || !data[k].length) return;
        var meta = names[m[1]] || {};
        var evId = (meta.opt && meta.opt.scrType) || '333';
        if (Scrambler.byId(evId).id !== evId) evId = '333';
        var id = 'i' + m[1];
        while (DB.sessions[id]) id += 'x';
        DB.sessions[id] = newSession(String(meta.name || ('imported ' + m[1])), evId);
        DB.sessions[id].solves = data[k].map(function (sv) {
          return (Array.isArray(sv) && Array.isArray(sv[0])) ? [[sv[0][0], sv[0][1]], sv[1] || '', sv[2] || '', sv[3] || 0] : null;
        }).filter(sanitizeSolve);
        DB.order.push(id);
        imported++;
      });
      if (imported) { saveDB(); renderSessions(); toast(T('csTimer 세션 ' + imported + '개 가져옴', 'imported ' + imported + ' csTimer sessions'), { type: 'success' }); }
      else toast(T('세션을 찾지 못함', 'no sessions found'), { type: 'error' });
      return;
    }
    emit('importUnknown', text);
    toast(T('알 수 없는 형식', 'unrecognized format'), { type: 'error' });
  }
  function bindExport() {
    $('btnExpFile').addEventListener('click', function () {
      download('cstimer-clone_' + new Date().toISOString().slice(0, 10) + '.json', exportJSON());
    });
    $('btnExpCopy').addEventListener('click', function () { copyText(exportJSON()); toast(T('복사됨', 'copied')); });
    $('impFile').addEventListener('change', function () {
      var file = this.files[0];
      if (!file) return;
      var fr = new FileReader();
      var isCsv = /\.csv$/i.test(file.name);
      fr.onload = function () {
        if (isCsv) emit('importCSV', fr.result);
        else importData(fr.result);
      };
      fr.readAsText(file);
      this.value = '';
    });
    $('btnImpPaste').addEventListener('click', function () {
      var t = $('impText').value.trim();
      if (t) importData(t);
    });
    $('btnExpCSV').addEventListener('click', function () {
      var s = curSession();
      var rows = ['No.;Time;Penalty;Scramble;Date;Comment'];
      s.solves.forEach(function (sv, i) {
        rows.push([i + 1, Stats.solveToString(sv, 3), sv[0][0] === -1 ? 'DNF' : (sv[0][0] > 0 ? '+2' : ''),
        '"' + String(sv[1]).replace(/"/g, '""').replace(/\n/g, ' ') + '"',
        sv[3] ? new Date(sv[3] * 1000).toISOString() : '', '"' + String(sv[2]).replace(/"/g, '""') + '"'].join(';'));
      });
      download('session_' + s.name.replace(/\W+/g, '_') + '.csv', rows.join('\n'), 'text/csv');
    });
    $('btnResetAll').addEventListener('click', function () {
      styledConfirm(T('모든 데이터를 삭제할까요? 자동 백업 스냅샷과 설정까지 함께 지워지며 되돌릴 수 없어요.',
        'DELETE ALL DATA? this also deletes the automatic backup snapshots and all settings. Cannot be undone.'), function () {
        // let packs tear down non-localStorage state first
        emit('resetAll');
        cancelPendingSave();
        // sweep every cstc_-prefixed key: leaving cstc_pack_data_bak behind means the
        // confirm lies — feat_data renders a one-click restore for each surviving snapshot
        for (var i = localStorage.length - 1; i >= 0; i--) {
          var k = localStorage.key(i);
          if (k && k.indexOf('cstc_') === 0) localStorage.removeItem(k);
        }
        location.reload();
      });
    });
  }
  function copyText(t) {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t);
    else {
      var ta = document.createElement('textarea');
      ta.value = t; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e) { }
      document.body.removeChild(ta);
    }
  }

  /* =============== help / about =============== */
  function fillHelp() {
    $('helpBody').textContent = [
      T('스페이스 (홀드 후 릴리즈)', 'space (hold + release)') + '  —  ' + T('시작 / 정지', 'start / stop'),
      'esc  —  ' + T('취소 (측정 중: 기록 없이 중단)', 'cancel (during solve: discard)'),
      'alt + ← / →  —  ' + T('이전 / 다음 스크램블', 'last / next scramble'),
      'ctrl/cmd + Z  —  ' + T('삭제 취소 · 마지막 기록 삭제', 'undo · delete last solve'),
      '?  —  ' + T('이 도움말', 'this help'),
      T('멀티페이즈 중 스페이스', 'space during multi-phase') + '  —  ' + T('스플릿 기록', 'record split')
    ].join('\n');
  }
  function openHelp() { showModal('helpModal'); }
  function fillAbout() {
    $('aboutText').innerHTML = '';
    var p = $('aboutText');
    p.appendChild(document.createTextNode('csTimer clone v' + VERSION + ' — '));
    p.appendChild(document.createTextNode(T('토스 디자인 스타일의 스피드큐빙 타이머 (오리지널 코드 팬 클론).', 'a speedcubing timer, Toss-style design (original-code fan clone).')));
    p.appendChild(document.createElement('br'));
    var a = document.createElement('a');
    a.href = 'https://cstimer.net'; a.target = '_blank'; a.rel = 'noopener';
    a.textContent = T('원본 csTimer 바로가기', 'original csTimer');
    a.style.color = 'var(--accent)';
    p.appendChild(a);
    p.appendChild(document.createElement('br'));
    p.appendChild(document.createTextNode(T('미지원: 스택매트/블루투스, 버추얼 큐브, 솔버, 랜덤 스테이트 스크램블.', 'not supported: stackmat/bluetooth, virtual cube, solvers, random-state scrambles.')));
  }

  /* =============== App API (for feature packs) =============== */
  var injectedCSS = {};
  window.App = {
    version: VERSION,
    db: function () { return DB; },
    session: function () { return curSession(); },
    solves: function () { return curSession().solves; },
    options: opts,
    setOption: function (k, v) { opts()[k] = v; saveDB(); applyOptions(); emit('options'); },
    save: saveDB,
    refresh: renderStats,
    on: on, emit: emit,
    fmt: fmtTimer,
    currentEvent: curEvent,
    scrambleStr: currentScramble,
    newScramble: genScramble,
    setEvent: function (id) {
      curSession().event = id; saveDB();
      $('eventSel').value = id;
      scrHistory = []; scrPtr = -1; nextQueued = null;
      syncScrLenBox(); genScramble(); emit('sessionChanged');
    },
    registerTool: registerTool,
    registerOptionRow: function (pageId, buildFn) {
      var pg = $(pageId);
      if (pg) buildFn(pg);
    },
    registerMenuButton: function (def) {
      var b = document.createElement('button');
      b.className = 'icon ghost';
      b.innerHTML = def.icon;
      b.title = def.title || '';
      b.setAttribute('aria-label', def.title || 'menu');
      b.addEventListener('click', def.onClick);
      var mb = $('menuBtns');
      mb.insertBefore(b, mb.firstChild);
      return b;
    },
    registerModal: registerModal,
    closeModals: closeModals,
    toast: toast,
    confirm: styledConfirm,
    addCSS: function (css) {
      var key = css.length + ':' + css.slice(0, 40);
      if (injectedCSS[key]) return;
      injectedCSS[key] = 1;
      var st = document.createElement('style');
      st.textContent = css;
      document.head.appendChild(st);
    },
    download: download,
    copyText: copyText,
    // Record a solve produced by an alternative input device (e.g. the virtual
    // cube), taking the same path a keyboard solve does — PB detection + toast,
    // confetti, 'pb'/'solve' events, next scramble. Returns the pushed solve.
    // pbSnapshot is module-private, so a pack cannot reproduce this itself.
    addSolve: addSolve,
    updateSolve: updateSolve,
    deleteSolve: deleteSolve,
    i18n: function (key, ko, en) { return T(ko, en); },
    lang: lang,
    isMobile: isMobile,
    openTimeModal: openTimeModal
  };

  /* =============== init =============== */
  function initAfterData() {
    var evSel = $('eventSel');
    evSel.innerHTML = '';
    var groups = { wca: document.createElement('optgroup'), tr: document.createElement('optgroup'), other: document.createElement('optgroup') };
    groups.wca.label = 'WCA';
    groups.tr.label = T('트레이너', 'trainer');
    groups.other.label = T('기타', 'other');
    Scrambler.events.forEach(function (ev) {
      var o = document.createElement('option');
      o.value = ev.id; o.textContent = ev.name;
      (ev.trainer ? groups.tr : (ev.id === 'input' ? groups.other : groups.wca)).appendChild(o);
    });
    evSel.appendChild(groups.wca); evSel.appendChild(groups.tr); evSel.appendChild(groups.other);
    evSel.value = curSession().event;
    renderSessions();
    applyOptions();
    scrHistory = []; scrPtr = -1; nextQueued = null;
    genScramble();
    setDisplay(Stats.timeToString(0, opts().precision), '');
    hideQuickBar();
  }

  function init() {
    loadDB();
    builtinTools();

    document.querySelectorAll('.modal').forEach(labelModal);

    $('eventSel').addEventListener('change', function () {
      curSession().event = this.value;
      this.blur();   // hand focus back to the page so the spacebar keeps working
      saveDB();
      scrHistory = []; scrPtr = -1; nextQueued = null;
      syncScrLenBox();
      genScramble();
      updateTitle();
      emit('sessionChanged');
      if (this.value === 'input') openInputScramble();
    });
    $('scrLenInput').addEventListener('change', function () {
      var v = parseInt(this.value, 10);
      var ev = curEvent();
      if (!v || v < 1) { this.value = scrLenFor(ev); return; }
      opts().scrLens[ev.id] = v;
      saveDB();
      nextQueued = null;
      genScramble();
    });
    $('sessionSel').addEventListener('change', function () { this.blur(); switchSession(this.value); });
    $('btnSessAdd').addEventListener('click', addSession);
    $('btnSessMgr').addEventListener('click', openSessionManager);
    $('btnClearSession').addEventListener('click', clearSession);
    $('btnLastScr').addEventListener('click', lastScramble);
    $('btnNextScr').addEventListener('click', nextScramble);
    $('btnReScr').addEventListener('click', function () { nextQueued = null; genScramble(); });
    $('btnCopyScr').addEventListener('click', function () { copyText(currentScramble()); toast(T('스크램블 복사됨', 'scramble copied')); });
    $('btnScrHistory').addEventListener('click', openScrHistory);
    $('scrambleTxt').addEventListener('click', function () {
      if (curEvent().id === 'input') { openInputScramble(); return; }
      copyText(currentScramble());
      toast(T('스크램블 복사됨', 'scramble copied'));
    });
    // index.html declares role="button" tabindex="0" but there was no key handler, so Space on
    // the focused scramble fell through to the document handler and started a solve — making the
    // scramble-input modal mouse-only. Bubble-phase stopPropagation is enough (that handler is
    // not registered with capture).
    $('scrambleTxt').addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.code !== 'Space') return;
      e.preventDefault();
      e.stopPropagation();
      this.click();
    });
    $('btnOptions').addEventListener('click', function () { showModal('optionsModal'); });
    $('btnExport').addEventListener('click', function () { showModal('exportModal'); });
    $('btnOpenExport').addEventListener('click', function () { closeModals(); showModal('exportModal'); });
    $('btnHelp').addEventListener('click', openHelp);
    $('btnFullscreen').addEventListener('click', function () {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen();
    });
    document.querySelectorAll('.modal .mclose').forEach(function (b) { b.addEventListener('click', closeModals); });
    document.querySelectorAll('.modal').forEach(function (m) {
      m.addEventListener('mousedown', function (e) { if (e.target === m) closeModals(); });
    });
    $('tmApply').addEventListener('click', applyTimeModal);
    $('tmDelete').addEventListener('click', function () {
      if (editIndex >= 0) {
        var i = editIndex;
        closeModals();
        deleteSolve(i);
      }
    });
    $('timeList').addEventListener('click', function (e) {
      var tr = e.target.closest('tr[data-i]');
      if (tr) openTimeModal(parseInt(tr.dataset.i, 10));
    });
    // Enter/Space activation for the focusable rows. stopPropagation is load-bearing on the
    // curBestTable rows: openAvgDetail() bails for a no-op row, no modal opens, uiBlocked()
    // stays false and the Space would reach padDown and start a solve.
    bindRowKeys($('timeList'), 'tr[data-i]');
    bindRowKeys($('curBestTable'), 'tr[data-avg]');
    $('curBestTable').addEventListener('click', function (e) {
      var tr = e.target.closest('tr[data-avg]');
      if (!tr) return;
      var n = parseInt(tr.dataset.avg, 10);
      if (!n || n < 2) return;
      var isMean = tr.dataset.mean === '1';
      var td = e.target.closest('td');
      var cellIdx = td ? td.cellIndex : 1;
      var solves = curSession().solves;
      if (cellIdx === 2) {
        var be = parseInt(tr.dataset.bestend, 10);
        if (be >= 0) openAvgDetail(n, isMean, be, true);
      } else if (solves.length >= n) {
        openAvgDetail(n, isMean, solves.length - 1, false);
      }
    });
    [0, 1].forEach(function (slot) {
      $('toolSel' + slot).addEventListener('change', function () {
        opts()['tool' + slot] = this.value; saveDB(); renderTools();
      });
    });
    $('metroToggle').addEventListener('click', toggleMetro);
    $('metroBpm').addEventListener('change', function () { setMetroBpm(parseInt(this.value, 10) || 60); });
    $('metroSlider').addEventListener('input', function () { setMetroBpm(parseInt(this.value, 10)); });
    $('metroTap').addEventListener('click', function () {
      var t = performance.now();
      metro.taps = metro.taps.filter(function (x) { return t - x < 3000; });
      metro.taps.push(t);
      if (metro.taps.length >= 2) {
        var iv = (metro.taps[metro.taps.length - 1] - metro.taps[0]) / (metro.taps.length - 1);
        setMetroBpm(Math.round(60000 / iv));
      }
      beep(1200, .3, .05);
    });
    $('metroBpm').value = opts().metroBpm;
    $('metroSlider').value = opts().metroBpm;

    // quick bar
    $('qbOK').addEventListener('click', function () { quickPen(0); });
    $('qbP2').addEventListener('click', function () { quickPen(2000); });
    $('qbDNF').addEventListener('click', function () { quickPen(Stats.DNF); });
    $('qbDel').addEventListener('click', function () {
      var s = curSession();
      if (s.solves.length) { deleteSolve(s.solves.length - 1); hideQuickBar(); setDisplay(fmtTimer(0), ''); }
    });
    $('qbComment').addEventListener('click', function () {
      var s = curSession();
      if (s.solves.length) openTimeModal(s.solves.length - 1);
    });

    // input scramble modal
    $('inputScrApply').addEventListener('click', function () {
      var t = $('inputScrText').value;
      var lines = t.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
      if (lines.length) {
        inputQueue = inputQueue.concat(lines);
        $('inputScrText').value = '';
        toast(lines.length + T('개 스크램블 추가', ' scrambles queued'));
        closeModals();
        if (curEvent().id === 'input') genScramble();
      }
    });

    window.addEventListener('resize', function () { invalidateTools(); });

    bindOptions();
    bindExport();
    bindManual();
    bindPad();
    initAfterData();
    emit('ready');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
