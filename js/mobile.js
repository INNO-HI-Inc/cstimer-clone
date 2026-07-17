/* mobile.js — MOBILE UX LAYER (original code)
 *
 * Everything phone-specific lives here; app.js owns the engine and knows nothing
 * about tabs, swipes or the stat strip. Self-gating: on a desktop viewport this
 * file installs nothing at all (and tears itself down if the window is resized
 * to a desktop size, so a browser resize can't leave a half-mobile UI behind).
 *
 * Layout counterpart: mobile.css. MOBILE_MQ below MUST match its <link media>.
 */
(function () {
  'use strict';
  if (!window.App) return;

  var MOBILE_MQ = '(max-width: 760px), (max-height: 500px) and (max-width: 950px)';
  var mq = window.matchMedia(MOBILE_MQ);
  var installed = false;
  var wakeLock = null;

  function $(id) { return document.getElementById(id); }
  function t(ko, en) { return App.i18n('m', ko, en); }

  App.addCSS([
    /* quick-action sheet for a long-pressed time row */
    '.mqa { display:flex; flex-direction:column; gap:8px; }',
    '.mqa button { width:100%; min-height:48px; font-size:15px; }',
    '.mqa .mqaScr { font-family:Menlo,Consolas,monospace; font-size:12px; color:var(--sub);',
    '  background:var(--card2); border-radius:12px; padding:10px; line-height:1.5; user-select:text;',
    '  white-space:pre-wrap; margin-bottom:4px; }',
    /* row feedback while long-pressing */
    '#timeList tr.mpress td { background:var(--accent-weak); }',
    /* swipe hint chevrons on the view being dragged */
    'body[data-mswipe] #main, body[data-mswipe] #leftbar { transition: transform .18s ease; }'
  ].join('\n'));

  /* ---------------- stat strip ---------------- */
  function renderStrip() {
    var strip = $('mStrip');
    if (!strip) return;
    var solves = App.solves();
    var S = window.Stats;
    var sum = S.sessionSummary(solves);
    var f = function (v) { return v == null ? '-' : App.fmt(v); };
    var ao5 = solves.length >= 5 ? S.averageOf(solves, solves.length - 1, 5) : null;
    var ao12 = solves.length >= 12 ? S.averageOf(solves, solves.length - 1, 12) : null;
    var cells = [
      ['ao5', ao5 == null ? '-' : f(ao5)],
      ['ao12', ao12 == null ? '-' : f(ao12)],
      [t('베스트', 'best'), sum.best == null ? '-' : f(sum.best)],
      [t('솔브', 'solves'), String(sum.count)]
    ];
    strip.textContent = '';
    cells.forEach(function (c) {
      var d = document.createElement('div');
      var k = document.createElement('span'); k.className = 'k'; k.textContent = c[0];
      var v = document.createElement('span'); v.className = 'v'; v.textContent = c[1];
      d.appendChild(k); d.appendChild(v);
      strip.appendChild(d);
    });
  }

  /* ---------------- view switching ---------------- */
  var VIEWS = ['timer', 'list', 'tools'];
  function view() { return document.body.dataset.mview || 'timer'; }
  function setView(v, haptic) {
    // 'more' and 'cube' are actions, not panes: they open a sheet/overlay and
    // leave the underlying view (and its tab highlight) where it was.
    if (v === 'more') { $('btnOptions').click(); return; }
    if (v === 'cube') {
      if (haptic) buzz(8);
      if (window.VCubeFeat && window.VCubeFeat.open) window.VCubeFeat.open();
      else App.toast(t('가상 큐브를 불러오지 못했어요', 'virtual cube failed to load'), { type: 'error' });
      return;
    }
    if (VIEWS.indexOf(v) < 0) v = 'timer';
    document.body.dataset.mview = v;
    document.querySelectorAll('#mtabs button').forEach(function (b) {
      var on = b.dataset.view === v;
      b.classList.toggle('act', on);
      b.setAttribute('aria-current', on ? 'page' : 'false');
    });
    try { localStorage.setItem('cstc_pack_mobile_view', v); } catch (e) { }
    if (haptic) buzz(8);
    // panes hidden with display:none can't size a canvas — repaint now they're visible
    App.refresh();
  }
  function buzz(ms) {
    if (App.options().haptic && navigator.vibrate) navigator.vibrate(ms);
  }

  /* ---------------- swipe between views ---------------- */
  function bindSwipe() {
    var x0 = 0, y0 = 0, tracking = false;
    document.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) { tracking = false; return; }
      // never hijack a solve, a scrollable pane, or a control
      if (document.body.classList.contains('solving')) { tracking = false; return; }
      if (e.target.closest('#timerPad, .modal, #toolDock, #timeListWrap, #scrCtl, select, input, textarea')) { tracking = false; return; }
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; tracking = true;
    }, { passive: true });
    document.addEventListener('touchend', function (e) {
      if (!tracking) return;
      tracking = false;
      var tch = e.changedTouches[0];
      var dx = tch.clientX - x0, dy = tch.clientY - y0;
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.6) return; // must be a decisive horizontal flick
      var i = VIEWS.indexOf(view());
      if (i < 0) return;
      var next = dx < 0 ? i + 1 : i - 1;
      if (next < 0 || next >= VIEWS.length) return;
      setView(VIEWS[next], true);
    }, { passive: true });
  }

  /* ---------------- long-press a time row -> quick actions ---------------- */
  var qaModal = null, qaIndex = -1;
  function ensureQaModal() {
    if (qaModal) return qaModal;
    qaModal = App.registerModal('mQaModal', t('기록', 'solve'), function (body) {
      var wrap = document.createElement('div');
      wrap.className = 'mqa';
      var scr = document.createElement('div'); scr.className = 'mqaScr'; scr.id = 'mQaScr';
      wrap.appendChild(scr);
      [
        ['OK', function () { setPen(0); }],
        ['+2', function () { setPen(2000); }],
        ['DNF', function () { setPen(window.Stats.DNF); }],
        [t('상세 보기', 'details'), function () { var i = qaIndex; App.closeModals(); App.openTimeModal(i); }],
        [t('삭제', 'delete'), function () { var i = qaIndex; App.closeModals(); App.deleteSolve(i); }, 'danger']
      ].forEach(function (b) {
        var el = document.createElement('button');
        el.textContent = b[0];
        if (b[2]) el.className = b[2];
        el.addEventListener('click', b[1]);
        wrap.appendChild(el);
      });
      body.appendChild(wrap);
    });
    return qaModal;
  }
  function setPen(pen) {
    if (qaIndex < 0) return;
    App.updateSolve(qaIndex, function (sv) { sv[0][0] = pen; });
    buzz(12);
    App.closeModals();
  }
  function bindLongPress() {
    var timer = null, startY = 0, row = null, fired = false;
    var list = $('timeList');
    if (!list) return;
    list.addEventListener('touchstart', function (e) {
      row = e.target.closest('tr[data-i]');
      if (!row) return;
      fired = false;
      startY = e.touches[0].clientY;
      row.classList.add('mpress');
      timer = setTimeout(function () {
        timer = null;
        var i = parseInt(row.dataset.i, 10);
        row.classList.remove('mpress');
        qaIndex = i;
        var solve = App.solves()[i];
        if (!solve) return;
        ensureQaModal();
        qaModal.titleEl.textContent = 'No. ' + (i + 1) + '  ' + window.Stats.solveToString(solve, App.options().precision);
        var scrEl = $('mQaScr');
        if (scrEl) scrEl.textContent = solve[1] || '';
        buzz(18);
        // the sheet is now under the finger; the touchend that follows must not
        // be replayed as a compat mouse event onto whatever button landed there
        fired = true;
        qaModal.open();
      }, 450);
    }, { passive: true });
    function abort() {
      if (timer) { clearTimeout(timer); timer = null; }
      if (row) { row.classList.remove('mpress'); row = null; }
    }
    list.addEventListener('touchmove', function (e) {
      if (timer && Math.abs(e.touches[0].clientY - startY) > 10) abort(); // it's a scroll, not a press
    }, { passive: true });
    // non-passive: preventDefault() here suppresses the synthetic mousedown/mouseup/click
    // that would otherwise re-hit-test at the release point onto the freshly-opened sheet
    list.addEventListener('touchend', function (e) {
      if (fired) { e.preventDefault(); fired = false; }
      abort();
    }, { passive: false });
    list.addEventListener('touchcancel', function () { fired = false; abort(); }, { passive: true });
  }

  /* ---------------- keep the screen awake during a session ---------------- */
  function requestWake() {
    if (!('wakeLock' in navigator) || wakeLock) return;
    navigator.wakeLock.request('screen').then(function (wl) {
      wakeLock = wl;
      wl.addEventListener('release', function () { wakeLock = null; });
    }).catch(function () { /* denied / not visible — harmless */ });
  }
  function releaseWake() {
    if (wakeLock) { try { wakeLock.release(); } catch (e) { } wakeLock = null; }
  }
  function bindWakeLock() {
    requestWake();
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') requestWake(); else releaseWake();
    });
  }

  /* ---------------- tabs ---------------- */
  function bindTabs() {
    document.querySelectorAll('#mtabs button').forEach(function (b) {
      b.addEventListener('click', function () { setView(b.dataset.view, true); });
    });
  }

  /* ---------------- install / uninstall ---------------- */
  function install() {
    if (installed) return;
    installed = true;
    var saved = 'timer';
    try { saved = localStorage.getItem('cstc_pack_mobile_view') || 'timer'; } catch (e) { }
    setView(saved);
    renderStrip();
    bindWakeLock();
  }
  function uninstall() {
    if (!installed) return;
    installed = false;
    // hand the DOM back to desktop.css exactly as it found it
    delete document.body.dataset.mview;
    releaseWake();
    App.refresh();
  }
  function sync() { if (mq.matches) install(); else uninstall(); }

  function boot() {
    // listeners are installed once and are inert on desktop (they early-out on
    // .closest()/mq checks), so only view state needs install/uninstall
    bindTabs();
    bindSwipe();
    bindLongPress();
    App.on('render', function () { if (mq.matches) renderStrip(); });
    App.on('options', function () { if (mq.matches) renderStrip(); });
    if (mq.addEventListener) mq.addEventListener('change', sync);
    else if (mq.addListener) mq.addListener(sync);
    sync();
  }

  if (App.db()) boot(); else App.on('ready', boot);
})();
