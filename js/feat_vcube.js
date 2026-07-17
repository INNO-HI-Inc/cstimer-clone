/* js/feat_vcube.js — virtual cube feature pack
 *
 * Depends on: js/draw_nnn.js (facelet model) and js/vcube3d.js (3D engine).
 * Provides:
 *   1. a tool ('vcube') — a small live cube preview, drag to orbit
 *   2. a fullscreen PLAY overlay — big cube, scramble, timer, key legend, mobile pad
 *
 * KEY MAP is csTimer's, transcribed from src/js/twisty/twistynnn.js
 * generateCubeKeyMapping(oSl, oSr, iSi) and cross-checked against its help.js funcmap.
 * We bind on `event.code` (physical position) rather than csTimer's legacy `event.keyCode`
 * (character), which reproduces csTimer's INTENT on every keyboard layout and lets us drop
 * its vrcKBL/codeMap machinery entirely. See csTimer issue #72.
 *
 * ------------------------------------------------------------------------------------
 * COEXISTENCE WITH THE CORE TIMER (the rule, decided here and documented for the human)
 * ------------------------------------------------------------------------------------
 * The overlay is a real `.modal.show`. app.js's keydown handler calls uiBlocked(), which is
 * true whenever a `.modal.show` exists, and then returns before ANY of its timer keys run.
 * So while the overlay is open the core Space/Enter handler is inert BY CONSTRUCTION — the
 * overlay owns the keyboard and there is no double-start to guard against. This is why the
 * overlay is built on App.registerModal rather than a bare fixed-position div.
 *
 * The one hole in that: app.js checks `T_.state === 'running'` BEFORE uiBlocked(), so if the
 * core timer is already running, any key stops it. We therefore refuse to open the overlay
 * while the core timer runs (detected via document.body.classList 'solving', which
 * startTimer/stopTimer maintain). Outside the overlay, the tool never listens for keys at all.
 */
(function () {
  'use strict';
  var HAS_APP = typeof window !== 'undefined' && !!window.App;
  var App = HAS_APP ? window.App : null;

  var MOBILE_MQ = '(max-width: 760px), (max-height: 500px) and (max-width: 950px)';
  function isMobile() {
    return App.isMobile ? App.isMobile() : window.matchMedia(MOBILE_MQ).matches;
  }
  function T(k, ko, en) { return App.i18n(k, ko, en); }

  /* ============================== key map ============================== */
  /* Each entry: fn(n, oSl, oSr) -> [startLayer, endLayer, face, dir]
   * 1-indexed layers counted inward FROM `face`; dir +1 CW / -1 CCW, CW = looking at `face`. */
  var K = {};

  var FACE_KEYS = {
    KeyI: ['R', 1], KeyK: ['R', -1], KeyJ: ['U', 1], KeyF: ['U', -1],
    KeyH: ['F', 1], KeyG: ['F', -1], KeyD: ['L', 1], KeyE: ['L', -1],
    KeyS: ['D', 1], KeyL: ['D', -1], KeyW: ['B', 1], KeyO: ['B', -1]
  };
  Object.keys(FACE_KEYS).forEach(function (code) {
    var f = FACE_KEYS[code];
    K[code] = function () { return [1, 1, f[0], f[1]]; };
  });

  /* wide / 2-layer (there is deliberately NO key for Fw / Bw) */
  K.KeyU = function (n, l, r) { return [1, r + 1, 'R', 1]; };   // Rw
  K.KeyM = function (n, l, r) { return [1, r + 1, 'R', -1]; };  // Rw'
  K.KeyV = function (n, l) { return [1, l + 1, 'L', 1]; };      // Lw
  K.KeyR = function (n, l) { return [1, l + 1, 'L', -1]; };     // Lw'
  K.Comma = function () { return [1, 2, 'U', 1]; };             // Uw
  K.KeyC = function () { return [1, 2, 'U', -1]; };             // Uw'
  K.KeyZ = function () { return [1, 2, 'D', 1]; };              // Dw
  K.Slash = function () { return [1, 2, 'D', -1]; };            // Dw'

  /* slices — the duplicates are csTimer's own (two keys for M, two for M') */
  K.Digit5 = function (n, l) { return [l + 1, l + 1, 'L', 1]; };      // M
  K.Digit6 = function (n, l, r) { return [r + 1, r + 1, 'R', -1]; };  // M
  K.KeyX = function (n, l) { return [l + 1, l + 1, 'L', -1]; };       // M'
  K.Period = function (n, l, r) { return [r + 1, r + 1, 'R', 1]; };   // M'
  K.Digit2 = function (n) { return [2, n - 1, 'U', -1]; };            // E
  K.Digit9 = function (n) { return [2, n - 1, 'U', 1]; };             // E'
  K.Digit0 = function (n) { return [2, n - 1, 'F', 1]; };             // S
  K.Digit1 = function (n) { return [2, n - 1, 'F', -1]; };            // S'

  /* rotations — again duplicated (two keys for x, two for x').
   * NO keys for x2/y2/z2: csTimer reaches those only through its drag gestures. */
  K.Semicolon = function (n) { return [1, n, 'U', 1]; };   // y
  K.KeyA = function (n) { return [1, n, 'U', -1]; };       // y'
  K.KeyY = function (n) { return [1, n, 'R', 1]; };        // x
  K.KeyT = function (n) { return [1, n, 'L', -1]; };       // x
  K.KeyN = function (n) { return [1, n, 'R', -1]; };       // x'
  K.KeyB = function (n) { return [1, n, 'L', 1]; };        // x'
  K.KeyP = function (n) { return [1, n, 'F', 1]; };        // z
  K.KeyQ = function (n) { return [1, n, 'F', -1]; };       // z'

  /* outer-block width keys (no-ops on a 3x3): [which, delta] */
  var WIDTH_KEYS = {
    Digit3: ['l', -1], Digit4: ['l', 1],
    Digit7: ['r', 1], Digit8: ['r', -1]
  };

  /* ---- [s,e,f,d] -> draw_nnn/vcube3d notation tokens ---- */
  var AXIS = 'yxz';
  function suf(d) {
    return d === 1 ? '' : d === -1 ? "'" : d === 2 ? '2' : d === -2 ? "2'" : null;
  }
  /* layers 1..k of face f, turned by d */
  function block(k, f, d) {
    return (k > 2 ? k : '') + f + (k >= 2 ? 'w' : '') + suf(d);
  }
  /* Returns a token string ("R", "Rw'", "3Rw", "y", or the two-token "Lw L'"), or null. */
  function tupleToToken(mv, n) {
    if (!mv) return null;
    var s = mv[0], e = mv[1], f = mv[2], d = mv[3];
    var fi = 'URFDLB'.indexOf(f);
    if (fi < 0 || suf(d) === null) return null;
    if (s < 1 || e < s) return null;
    /* whole-cube rotation: csTimer's isRotation === move[0] <= 1 && move[1] >= dimension.
     * Axis letter comes from the face's axis; D/L/B look down the negative axis, so invert. */
    if (s <= 1 && e >= n) return AXIS[fi % 3] + suf(fi >= 3 ? -d : d);
    if (e > n) return null;
    if (s === 1) return block(e, f, d);
    /* layers s..e == (1..e) minus (1..s-1); same-axis turns commute, so emit both. */
    return block(e, f, d) + ' ' + block(s - 1, f, -d);
  }
  function isRotationTuple(mv, n) { return !!mv && mv[0] <= 1 && mv[1] >= n; }

  /* ============================== events ============================== */
  /* Which events this pack can actually simulate: the NxN cubes. img is '333','222'..'777'. */
  function cubeSizeOf(ev) {
    if (!ev || !ev.img) return 0;
    var m = /^([234567])\1\1$/.exec(ev.img);
    return m ? +m[1] : 0;
  }

  /* Everything above this line is pure and dependency-free, so node can self-test the
   * notation translation (see the assertions at the bottom of this file). Everything below
   * needs a live window.App and a DOM. */
  var PURE = {
    tupleToToken: tupleToToken,
    isRotationTuple: isRotationTuple,
    keyMap: K,
    widthKeys: WIDTH_KEYS,
    cubeSizeOf: cubeSizeOf
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = PURE;
  if (!HAS_APP) { selfTest(); return; }

  /* ============================== CSS ============================== */
  App.addCSS([
    '.vcWrap{position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center;}',
    '.vcWrap canvas{display:block;touch-action:none;cursor:grab;}',
    '.vcWrap canvas:active{cursor:grabbing;}',
    '.vcToolMsg{color:var(--sub);font-size:12px;text-align:center;line-height:1.6;padding:10px;}',
    '.vcToolBtn{position:absolute;right:0;bottom:0;}',

    /* fullscreen overlay: a real .modal so app.js uiBlocked() suppresses the core timer keys */
    '#vcubeModal .mbox{width:min(1100px,96vw);max-width:96vw;height:min(94vh,940px);',
    'display:flex;flex-direction:column;}',
    '#vcubeModal .mbody{flex:1;display:flex;flex-direction:column;gap:10px;min-height:0;overflow:hidden;}',
    '.vcHead{display:flex;gap:10px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;}',
    '.vcScr{flex:1;min-width:180px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;',
    'font-size:14px;line-height:1.6;color:var(--fg);background:var(--card2);',
    'border-radius:var(--radius-btn);padding:10px 12px;word-break:break-word;}',
    '.vcScr b{color:var(--accent);font-weight:600;}',
    '.vcLcd{font-variant-numeric:tabular-nums;font-weight:800;font-size:clamp(28px,6vw,54px);',
    'color:var(--fg);letter-spacing:-0.02em;min-width:4.5ch;text-align:right;line-height:1.1;}',
    '.vcLcd.run{color:var(--accent);}',
    '.vcLcd.warn{color:var(--orange);}',
    '.vcLcd.bad{color:var(--red);}',
    '.vcStage{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;',
    'background:var(--card2);border-radius:var(--radius-card);position:relative;overflow:hidden;}',
    '.vcStage canvas{display:block;touch-action:none;cursor:grab;}',
    /* two-cube (front + back) layout; gap only, sizing is done in fitCanvas() */
    '.vcLcd.vcDone{color:var(--green);}',
    '.vcClose{align-self:flex-start;margin-left:4px;}',
    /* cube-only fullscreen: everything except the canvas and a small clock gets out */
    '.vcFull{background:var(--bg);padding:0!important;gap:0!important;}',
    '.vcFull .vcFoot,.vcFull .vcPad,.vcFull .vcLegend,.vcFull .vcScr,.vcFull .vcClose,',
    '.vcFull .vcHint{display:none!important;}',
    '.vcFull .vcHead{position:absolute;top:14px;left:50%;transform:translateX(-50%);z-index:2;',
    'margin:0;padding:0;pointer-events:none;}',
    '.vcFull .vcLcd{font-size:34px;opacity:.85;}',
    '.vcFull .vcStage{flex:1;border-radius:0;background:transparent;}',
    '.vcStage canvas:active{cursor:grabbing;}',
    '.vcHint{position:absolute;left:0;right:0;bottom:8px;text-align:center;color:var(--sub);',
    'font-size:12px;pointer-events:none;padding:0 10px;}',
    '.vcFoot{display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap;}',
    '.vcLegend{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;',
    'color:var(--sub);line-height:1.7;white-space:pre;overflow-x:auto;max-width:100%;}',
    '.vcLegend i{color:var(--fg);font-style:normal;}',
    '.vcPad{display:none;grid-template-columns:repeat(6,1fr);gap:6px;}',
    '.vcPad button{padding:10px 0;font-size:14px;font-weight:700;}',
    '.vcBad{color:var(--sub);text-align:center;padding:30px 16px;line-height:1.8;}',
    '.vcBad b{color:var(--fg);}',
    /* MOBILE_MQ is already a comma-separated media query LIST, which is exactly what
     * @media accepts — do not try to split it into two rules. */
    '@media ' + MOBILE_MQ + '{',
    '#vcubeModal .mbox{width:100vw;max-width:100vw;height:100vh;border-radius:0;}',
    '.vcLegend{display:none;}.vcPad{display:grid;}}'
  ].join(''));

  /* ============================== tool ============================== */
  var toolInst = [null, null];

  function destroyTool(slot) {
    if (toolInst[slot]) { try { toolInst[slot].destroy(); } catch (e) { } toolInst[slot] = null; }
  }

  /* bindOrbit(canvas, getInst) — `getInst` is a GETTER, resolved at event time, not an
   * instance captured at bind time.
   *
   * Why a getter: the play overlay's canvas is created ONCE (buildPlay runs once, guarded by
   * ensureModal), but its engine is created and destroyed on every open/close. Binding a
   * captured instance per open leaked four listeners per open, each pinning a destroyed engine,
   * and every pointermove then fanned out to all N stale closures. So we bind exactly once, at
   * build time, and let the handler ask who the CURRENT engine is. No add/remove churn, nothing
   * to leak, and nothing to forget in teardown.
   * The tool path passes a getter too; its canvas is rebuilt per render, so those listeners die
   * with the node. */
  function bindOrbit(canvas, getInst) {
    var down = false, lx = 0, ly = 0;
    function pt(e) { return e.touches ? e.touches[0] : e; }
    canvas.addEventListener('pointerdown', function (e) {
      if (!getInst()) return;
      down = true; lx = e.clientX; ly = e.clientY;
      if (canvas.setPointerCapture) { try { canvas.setPointerCapture(e.pointerId); } catch (er) { } }
      e.preventDefault();
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!down) return;
      var inst = getInst();
      if (!inst) { down = false; return; }
      var p = pt(e);
      inst.dragBy(p.clientX - lx, -(p.clientY - ly));
      lx = p.clientX; ly = p.clientY;
    });
    function up() { down = false; }
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
  }

  /* renderToolSlot() wipes the container with innerHTML='' and never calls onHide, so an old
   * instance's rAF loop would outlive its detached canvas. Destroying at the TOP of render is
   * what keeps this idempotent across the core's frequent re-renders. */
  function renderTool(container, slot) {
    destroyTool(slot);
    var ev = App.currentEvent && App.currentEvent();
    var n = cubeSizeOf(ev);
    if (!n) {
      var msg = document.createElement('div');
      msg.className = 'vcToolMsg';
      msg.textContent = T('vcubeNotCube', '가상 큐브는 NxN 큐브 종목에서만 사용할 수 있습니다.',
        'the virtual cube only supports NxN cube events.');
      container.appendChild(msg);
      return;
    }
    var wrap = document.createElement('div');
    wrap.className = 'vcWrap';
    var canvas = document.createElement('canvas');
    var side = Math.max(80, Math.min(container.clientWidth || 300, container.clientHeight || 200));
    canvas.style.width = side + 'px';
    canvas.style.height = side + 'px';
    wrap.appendChild(canvas);

    var open = document.createElement('button');
    open.className = 'btn ghost vcToolBtn';
    open.textContent = T('vcubePlay', '풀스크린', 'full screen');
    open.addEventListener('click', function () { openPlay(); });
    wrap.appendChild(open);
    container.appendChild(wrap);

    if (!window.VCube3D) {
      wrap.textContent = 'vcube3d.js missing';
      return;
    }
    var inst;
    try {
      inst = window.VCube3D.create(canvas, { size: n, duration: 0 });
    } catch (e) { wrap.textContent = 'vcube error'; return; }
    toolInst[slot] = inst;
    try { inst.setState(App.scrambleStr ? App.scrambleStr() : ''); } catch (e) { }
    bindOrbit(canvas, function () { return toolInst[slot]; });
  }

  /* ============================== play surface ==============================
   * ONE play UI, two hosts:
   *   desktop → a modal overlay (openPlay)
   *   mobile  → the #cubePane tab, a first-class view (mount/unmount)
   * `host` is whichever element currently owns the UI. The UI is rebuilt when the
   * host changes and torn down on leave; `ui`/`eng`/`st` stay module singletons,
   * so only one surface may be live at a time — which is exactly the invariant we
   * want (two live engines = two rAF loops double-applying every keypress). */
  var M = null;          // {open, close, body}
  var modalEl = null;
  var modalBody = null;  // the modal's body element (see isPaneHost)
  var eng = null;        // engine instance
  var ui = {};
  var host = null;       // element currently holding the play UI
  var st = {
    open: false,
    n: 0,
    phase: 'idle',       // idle | inspect | ready | running | done
    startTs: 0,
    insStart: 0,
    pen: 0,
    raf: 0,
    coreStarted: false,
    oSl: 1, oSr: 1,
    moves: 0
  };

  function fmt(ms) {
    if (App.fmt) { try { return App.fmt(ms); } catch (e) { } }
    var s = Math.max(0, ms) / 1000;
    return s.toFixed(2);
  }

  function buildPlay(body) {
    var head = document.createElement('div'); head.className = 'vcHead';
    ui.scr = document.createElement('div'); ui.scr.className = 'vcScr';
    ui.lcd = document.createElement('div'); ui.lcd.className = 'vcLcd'; ui.lcd.textContent = '0.00';
    head.appendChild(ui.scr); head.appendChild(ui.lcd);
    /* A view has no modal chrome, so it must carry its own way out. Mobile leaves via the
     * tab bar, so this is desktop-only. */
    ui.close = document.createElement('button');
    ui.close.className = 'icon ghost vcClose';
    ui.close.innerHTML = '&#10005;';
    ui.close.title = T('vcubeClose', '닫기 (Esc)', 'close (Esc)');
    ui.close.addEventListener('click', closeCubeView);
    head.appendChild(ui.close);
    body.appendChild(head);

    ui.stage = document.createElement('div'); ui.stage.className = 'vcStage';
    ui.canvas = document.createElement('canvas');
    /* Bound ONCE, here, for the life of the canvas — never per open. See bindOrbit(). */
    bindOrbit(ui.canvas, function () { return eng; });
    ui.stage.appendChild(ui.canvas);

    ui.hint = document.createElement('div'); ui.hint.className = 'vcHint';
    ui.stage.appendChild(ui.hint);
    body.appendChild(ui.stage);

    ui.pad = document.createElement('div'); ui.pad.className = 'vcPad';
    ['U', 'R', 'F', 'D', 'L', 'B'].forEach(function (f) {
      [f, f + "'"].forEach(function (tok) {
        var b = document.createElement('button');
        b.className = 'btn';
        b.textContent = tok;
        b.addEventListener('click', function () { doMove(tok, false, Date.now()); });
        ui.pad.appendChild(b);
      });
    });
    body.appendChild(ui.pad);

    var foot = document.createElement('div'); foot.className = 'vcFoot';
    ui.legend = document.createElement('div'); ui.legend.className = 'vcLegend';
    /* csTimer's own published help table (help.js funcmap), which is also exactly our binding */
    ui.legend.innerHTML = [
      '<i>1234567890</i>  S\'  E  &lt;  &gt;  M  M  &lt;  &gt;  E\'  S',
      '<i>QWERTYUIOP</i>  z\'  B  L\'  Lw\'  x  x  Rw  R  B\'  z',
      '<i>ASDFGHJKL;</i>  y\'  D  L  U\'  F\'  F  U  R\'  D\'  y',
      '<i>ZXCVBNM,./</i>  Dw  M\'  Uw\'  Lw  x\'  x\'  Rw\'  Uw  M\'  Dw\''
    ].join('\n');
    foot.appendChild(ui.legend);

    var btns = document.createElement('div');
    btns.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;';

    /* The key legend is a learning aid you read once, but it cost ~90px of cube height on
     * every session. Collapsed by default; the cube gets the space back. */
    ui.legendBtn = document.createElement('button');
    ui.legendBtn.className = 'btn';
    ui.legendBtn.addEventListener('click', function () { setLegend(!legendOn()); });
    btns.appendChild(ui.legendBtn);

    /* In-place toggle: mid-solve nobody is going to dig through settings. */
    ui.xrayBtn = document.createElement('button');
    ui.xrayBtn.className = 'btn';
    ui.xrayBtn.addEventListener('click', function () { setXray(!xrayOn()); });
    btns.appendChild(ui.xrayBtn);

    ui.fullBtn = document.createElement('button');
    ui.fullBtn.className = 'btn';
    ui.fullBtn.addEventListener('click', toggleFull);
    btns.appendChild(ui.fullBtn);

    var reset = document.createElement('button');
    reset.className = 'btn primary';
    reset.textContent = T('vcubeReset', '스크램블 적용', 'apply scramble');
    reset.addEventListener('click', function () {
      if (st.phase === 'running') {
        App.toast && App.toast(T('vcubeSpaceRun', '측정 중입니다. Esc 로 취소하세요.',
          'solve in progress — press Esc to cancel.'), { type: 'error' });
        return;
      }
      applyScramble();
    });
    btns.appendChild(reset);
    foot.appendChild(btns);
    syncXrayBtn();
    syncLegend();
    syncFull();
    body.appendChild(foot);

    ui.bad = document.createElement('div'); ui.bad.className = 'vcBad';
    ui.bad.style.display = 'none';
    body.appendChild(ui.bad);
  }

  /* (Re)build the play UI inside `container`. Cheap no-op when it is already there. */
  function buildInto(container) {
    if (host === container && ui.stage && ui.stage.parentNode) return;
    container.textContent = '';
    ui = {};
    buildPlay(container);
    host = container;
    /* In the tab pane the app's own scramble bar is right above us (mobile.css keeps
     * #topbar visible in the cube view), so our copy is a duplicate eating the vertical
     * space the cube wants. The modal has no such neighbour and keeps it. */
    if (ui.scr) ui.scr.style.display = isPaneHost() ? 'none' : '';
    /* the modal already has a ✕; only a bare pane needs ours */
    if (ui.close) ui.close.style.display = isPaneHost() ? '' : 'none';
  }

  /* NB: must NOT be expressed as `host !== M.body` — App.registerModal() invokes its build
   * callback synchronously, i.e. while `M` is still null on the left of the assignment, so
   * the modal's own body would be misread as a pane and lose its scramble line. Track the
   * body element directly, set before the build runs. */
  function isPaneHost() { return !!host && host !== modalBody; }

  /* ---- see-through (xray) ----
   * Was a second cube at yaw+180. Two cubes to track is dizzying, so the hidden faces
   * now show THROUGH the one cube instead. The engine does the fading; we own the pref. */
  var PREF_XRAY = 'cstc_pack_vcube_xray';
  function xrayOn() {
    try { return localStorage.getItem(PREF_XRAY) === '1'; } catch (e) { return false; }
  }
  function setXray(on) {
    try { localStorage.setItem(PREF_XRAY, on ? '1' : '0'); } catch (e) { }
    syncXray();
  }
  function syncXrayBtn() {
    if (!ui.xrayBtn) return;
    var on = xrayOn();
    ui.xrayBtn.textContent = on
      ? T('vcubeXrayOff', '뒷면 끄기', 'solid')
      : T('vcubeXrayOn', '뒷면 비추기', 'see-through');
    ui.xrayBtn.classList.toggle('primary', on);
  }
  function syncXray() {
    syncXrayBtn();
    if (!eng) return;
    if (eng.setXray) eng.setXray(xrayOn());
    if (eng.setXrayGap) eng.setXrayGap(gapPref());
  }

  /* ---- gap width (see-through) ---- */
  var PREF_GAP = 'cstc_pack_vcube_gap';
  function gapPref() {
    var v;
    try { v = parseFloat(localStorage.getItem(PREF_GAP)); } catch (e) { }
    return (v >= 0.5 && v <= 0.99) ? v : 0.86;
  }
  function setGap(v) {
    try { localStorage.setItem(PREF_GAP, String(v)); } catch (e) { }
    if (eng && eng.setXrayGap) eng.setXrayGap(v);
  }

  /* ---- cube-only fullscreen ----
   * "다른거 다 안보이고 큐브만": native fullscreen on the stage, so even the browser
   * chrome goes. .vcFull strips the view down to the canvas (+ a small LCD — you still
   * need your time). Escape is handled by the browser, so we mirror its state rather
   * than tracking our own. */
  function fsEl() { return document.fullscreenElement || document.webkitFullscreenElement || null; }
  function inFull() { return !!fsEl() && host && fsEl() === host; }
  function toggleFull() {
    if (inFull()) {
      (document.exitFullscreen || document.webkitExitFullscreen || function () { }).call(document);
      return;
    }
    if (!host) return;
    var req = host.requestFullscreen || host.webkitRequestFullscreen;
    if (!req) {
      App.toast && App.toast(T('vcubeNoFs', '이 브라우저는 전체화면을 지원하지 않아요',
        'fullscreen is not supported here'), { type: 'error' });
      return;
    }
    var r = req.call(host);
    if (r && r.catch) r.catch(function () { });
  }
  function syncFull() {
    var on = inFull();
    if (host) host.classList.toggle('vcFull', on);
    if (ui.fullBtn) {
      ui.fullBtn.textContent = on
        ? T('vcubeFsOff', '전체화면 끄기', 'exit full')
        : T('vcubeFsOn', '전체화면', 'fullscreen');
      ui.fullBtn.classList.toggle('primary', on);
    }
    fitCanvas();
  }
  document.addEventListener('fullscreenchange', syncFull);
  document.addEventListener('webkitfullscreenchange', syncFull);

  /* ---- key legend ---- */
  var PREF_LEGEND = 'cstc_pack_vcube_legend';
  function legendOn() {
    try { return localStorage.getItem(PREF_LEGEND) === '1'; } catch (e) { return false; }
  }
  function setLegend(on) {
    try { localStorage.setItem(PREF_LEGEND, on ? '1' : '0'); } catch (e) { }
    syncLegend();
    fitCanvas();
  }
  function syncLegend() {
    var on = legendOn();
    if (ui.legendBtn) {
      ui.legendBtn.textContent = on
        ? T('vcubeKeysOff', '키 숨기기', 'hide keys')
        : T('vcubeKeysOn', '키 보기', 'keys');
      ui.legendBtn.classList.toggle('primary', on);
    }
    if (ui.legend && st.n) ui.legend.style.display = on ? '' : 'none';
  }

  function ensureModal() {
    if (M) return M;
    M = App.registerModal('vcubeModal', T('vcube', '가상 큐브', 'virtual cube'), function (body) {
      /* runs synchronously, before M is assigned — record the body FIRST so isPaneHost()
       * can tell this apart from a tab pane. */
      modalBody = body;
      buildInto(body);
    });
    modalEl = document.getElementById('vcubeModal');
    /* app.js's closeModals() just strips .show — there is no close callback to subscribe to,
     * so watch the class ourselves and tear the engine down when we go invisible. */
    if (window.MutationObserver && modalEl) {
      new MutationObserver(function () {
        var vis = modalEl.classList.contains('show');
        if (!vis && st.open) teardownPlay();
      }).observe(modalEl, { attributes: true, attributeFilter: ['class'] });
    }
    return M;
  }

  function setHint(txt) { if (ui.hint) ui.hint.textContent = txt; }

  /* The engine reads its CSS size off the canvas box, so the canvas must be an explicit
   * square. Sized from the STAGE (not the viewport): the stage is the only element that
   * knows how much room is actually left after the scramble/LCD/legend rows. */
  function fitCanvas() {
    if (!ui.stage || !ui.canvas || !eng) return;
    var w = ui.stage.clientWidth, h = ui.stage.clientHeight;
    if (!w || !h) return;
    var side = Math.max(160, Math.floor(Math.min(w, h) - 16));
    ui.canvas.style.width = side + 'px';
    ui.canvas.style.height = side + 'px';
    eng.render();
  }
  window.addEventListener('resize', function () { if (st.open) fitCanvas(); });

  /* A window resize is not enough for the tab pane: the stage also changes size when the
   * tab bar / scramble bar reflow, or the phone rotates, with no window event we can use.
   * Watch the stage box itself. */
  var ro = null;
  function observeStage() {
    unobserveStage();
    if (!window.ResizeObserver || !ui.stage) return;
    ro = new ResizeObserver(function () { if (st.open) fitCanvas(); });
    ro.observe(ui.stage);
  }
  function unobserveStage() {
    if (ro) { try { ro.disconnect(); } catch (e) { } ro = null; }
  }

  function showScramble() {
    if (!ui.scr) return;
    var ev = App.currentEvent && App.currentEvent();
    var s = (App.scrambleStr && App.scrambleStr()) || '';
    ui.scr.innerHTML = '';
    var b = document.createElement('b');
    b.textContent = (ev && ev.name ? ev.name : '') + '  ';
    ui.scr.appendChild(b);
    ui.scr.appendChild(document.createTextNode(s));
  }

  /* ---- timer ---- */
  function lcd(txt, cls) {
    if (!ui.lcd) return;
    ui.lcd.textContent = txt;
    ui.lcd.className = 'vcLcd' + (cls ? ' ' + cls : '');
  }
  function stopLoop() { if (st.raf) { cancelAnimationFrame(st.raf); st.raf = 0; } }
  function loop() {
    st.raf = 0;
    if (!st.open) return;
    if (st.phase === 'running') {
      lcd(fmt(Date.now() - st.startTs), 'run');
    } else if (st.phase === 'inspect') {
      var el = (Date.now() - st.insStart) / 1000;
      var left = 15 - el;
      lcd(left > 0 ? String(Math.ceil(left)) : (el > 17 ? 'DNF' : '+2'),
        el > 17 ? 'bad' : el > 15 ? 'warn' : '');
    } else return;
    st.raf = requestAnimationFrame(loop);
  }

  function insPenalty() {
    var el = Date.now() - st.insStart;
    return el > 17000 ? -1 : el > 15000 ? 2000 : 0;
  }

  function startRun(ts) {
    if (st.phase === 'inspect') st.pen = insPenalty();
    st.phase = 'running';
    st.startTs = ts;
    setHint(T('vcubeGo', '측정 중 — Esc 로 취소합니다.', 'solving — Esc to discard.'));
    /* Optional: mirror onto the core LCD. Must be an EXTERNAL-mode start — see the report:
     * core's own keydown must not stop a timer it does not own, and must not record. */
    st.coreStarted = false;
    if (App.startTimer) {
      try { App.startTimer({ external: true, at: ts }); st.coreStarted = true; } catch (e) { }
    }
    stopLoop(); loop();
  }

  /* Records the solve. Contract, in preference order:
   *   1. App.stopTimer(ms, {external, pen}) -> returns the solve record if IT recorded
   *   2. App.addSolve(pen, ms)              -> core's own recorder (PB toasts, next scramble)
   *   3. internal fallback                  -> mirrors addSolve() minus PB detection
   * Returning the record from stopTimer is what makes double-recording impossible. */
  function record(pen, ms) {
    if (st.coreStarted && App.stopTimer) {
      try {
        var rec = App.stopTimer(ms, { external: true, pen: pen });
        if (rec) return rec;
      } catch (e) { }
    }
    if (App.addSolve) {
      try { return App.addSolve(pen, ms); } catch (e) { }
    }
    return fallbackRecord(pen, ms);
  }
  function fallbackRecord(pen, ms) {
    var s = App.session && App.session();
    if (!s || !s.solves) return null;
    var solve = [[pen, ms], (App.scrambleStr && App.scrambleStr()) || '', '',
      Math.floor(Date.now() / 1000)];
    s.solves.push(solve);
    App.save && App.save();
    App.refresh && App.refresh();
    App.emit && App.emit('solve', solve, s.solves.length - 1);
    App.emit && App.emit('solvesChanged');
    App.newScramble && App.newScramble();
    return solve;
  }

  function finish(ts) {
    /* Guard: only a running attempt can be solved. Protects against onSolved firing for a
     * cube that was never scrambled, and against a second fire after we already recorded. */
    if (st.phase !== 'running') return;
    var ms = Math.max(0, Math.round(ts - st.startTs));
    st.phase = 'done';
    stopLoop();
    var pen = st.pen; st.pen = 0;
    lcd(pen === -1 ? 'DNF' : fmt(ms) + (pen > 0 ? '+' : ''), '');
    record(pen, ms);
    showScramble();
    setHint(T('vcubeSolved', '완성! Space 로 다음 스크램블을 적용합니다.',
      'solved! press Space to apply the next scramble.'));
    if (ui.lcd) ui.lcd.classList.add('vcDone');
    App.toast && App.toast(T('vcubeRec', '가상 큐브 기록 저장됨', 'virtual solve recorded'),
      { type: 'success' });
  }

  function abort(silent) {
    var wasRunning = st.phase === 'running';
    st.phase = 'idle'; st.pen = 0;
    stopLoop();
    lcd('0.00', '');
    if (wasRunning && !silent) {
      App.toast && App.toast(T('vcubeAbort', '솔브 취소됨', 'solve discarded'));
    }
  }

  /* ---- moves ---- */
  function doMove(token, rotation, ts) {
    if (!eng || !token) return;
    if (st.phase === 'done') return;
    /* csTimer: rotations never start the timer (they are inspection-legal); the first
     * non-rotation move does, stamped at the KEYPRESS, not at animation end. */
    if (st.phase === 'inspect' || st.phase === 'ready') {
      if (!rotation) startRun(ts);
    }
    st.moves++;
    eng.turn(token, ts);
  }

  /* csTimer applies the scramble on SPACE, not on open: the cube sits SOLVED until you
   * ask for it. We used to apply on open, which left Space re-applying the same scramble
   * onto an already-scrambled cube — visually a no-op, so Space looked broken. */
  function armSolved() {
    if (!eng) return;
    abort(true);
    st.moves = 0;
    eng.setState(''); // solved
    lcd('0.00', '');
    showScramble();
    st.phase = 'idle';
    setHint(T('vcubeArm', 'Space 를 눌러 스크램블을 적용하고 시작합니다.',
      'press Space to apply the scramble and start.'));
  }

  function applyScramble() {
    if (!eng) return;
    var scr = (App.scrambleStr && App.scrambleStr()) || '';
    abort(true);
    st.moves = 0;
    /* setState() re-baselines the engine's wasSolved flag, so a scramble that happens to leave
     * the cube solved simply cannot arm a spurious onSolved. */
    eng.setState(scr);
    showScramble();
    if (!eng.isSolved()) {
      if (App.options && App.options().inspection) {
        st.phase = 'inspect'; st.insStart = Date.now();
        stopLoop(); loop();
        setHint(T('vcubeInsp', '인스펙션 중 — 회전(x/y/z)은 타이머를 시작하지 않습니다.',
          'inspecting — rotations (x/y/z) do not start the timer.'));
      } else {
        st.phase = 'ready';
        lcd('0.00', '');
        setHint(T('vcubeReady', '첫 번째 회전에서 타이머가 시작됩니다.',
          'the timer starts on your first layer turn.'));
      }
    } else {
      st.phase = 'idle';
      setHint(T('vcubeNoScr', '스크램블이 없습니다.', 'no scramble to apply.'));
    }
  }

  /* ---- keyboard ---- */
  function textFocused() {
    var a = document.activeElement;
    return !!(a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable));
  }

  /* Capture phase on document, so we run BEFORE app.js's bubble-phase handler and can
   * stopPropagation() on the keys we consume. (In practice uiBlocked() already neuters app.js
   * while our modal is open — this is belt and braces, and it keeps the browser's own
   * scroll-on-Space from firing.) */
  function onKey(e) {
    if (!st.open) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;   // never steal an OS/browser chord
    if (textFocused()) return;
    if (e.repeat) return;

    if (e.code === 'Escape') {
      abort(true);
      /* In the desktop view there is no modal for app.js's closeModals() to close, so we
       * must close ourselves; in the modal we let closeModals() run as before. */
      if (cubeViewOpen()) { e.preventDefault(); e.stopPropagation(); closeCubeView(); }
      return;
    }

    if (e.code === 'Space') {
      e.preventDefault(); e.stopPropagation();
      /* Never let Space silently bin a live attempt — that is someone's solve. */
      if (st.phase === 'running') {
        App.toast && App.toast(T('vcubeSpaceRun', '측정 중입니다. Esc 로 취소하세요.',
          'solve in progress — press Esc to cancel.'), { type: 'error' });
        return;
      }
      applyScramble();
      return;
    }
    if (!st.n || !eng) return;

    /* arrow keys orbit the camera, 7.5deg a step, like csTimer's moveCameraDelta */
    var ARROW = { ArrowLeft: [7.5, 0], ArrowRight: [-7.5, 0], ArrowUp: [0, 7.5], ArrowDown: [0, -7.5] };
    if (ARROW[e.code]) {
      e.preventDefault(); e.stopPropagation();
      var d = ARROW[e.code];
      eng.dragBy(d[0] / 0.5, d[1] / 0.5);
      return;
    }

    var w = WIDTH_KEYS[e.code];
    if (w) {
      e.preventDefault(); e.stopPropagation();
      if (w[0] === 'l') st.oSl = Math.max(1, Math.min(st.oSl + w[1], st.n - 1));
      else st.oSr = Math.max(1, Math.min(st.oSr + w[1], st.n - 1));
      return;
    }

    var fn = K[e.code];
    if (!fn) return;
    e.preventDefault(); e.stopPropagation();
    var ts = e.timeStamp && e.timeStamp > 1e12 ? e.timeStamp : Date.now();
    var mv = fn(st.n, st.oSl, st.oSr);
    var token = tupleToToken(mv, st.n);
    if (!token) return;
    doMove(token, isRotationTuple(mv, st.n), ts);
  }

  /* ---- open / close ---- */
  function teardownPlay() {
    st.open = false;
    stopLoop();
    unobserveStage();
    document.removeEventListener('keydown', onKey, true);
    if (eng) { try { eng.destroy(); } catch (e) { } eng = null; }
    st.phase = 'idle';
  }

  /* Start play in the CURRENT host. The host must already be built (buildInto) and
   * VISIBLE — the stage has no box while display:none, and fitCanvas() would size the
   * canvas to 0. Returns true when a real cube started. */
  function beginPlay() {
    var ev = App.currentEvent && App.currentEvent();
    var n = cubeSizeOf(ev);

    st.n = n; st.oSl = 1; st.oSr = 1; st.pen = 0; st.moves = 0;
    st.open = true;

    var cube = !!n && !!window.VCube3D;
    ui.bad.style.display = cube ? 'none' : '';
    ui.stage.style.display = cube ? '' : 'none';
    ui.pad.style.display = cube ? '' : 'none';
    ui.legend.style.display = (cube && legendOn()) ? '' : 'none';

    if (!cube) {
      ui.bad.textContent = '';
      var p = document.createElement('div');
      p.innerHTML = n
        ? T('vcubeNoEngine', '3D 엔진(js/vcube3d.js)을 불러오지 못했습니다.',
          'the 3D engine (js/vcube3d.js) failed to load.')
        : T('vcubeNotCubeLong',
          '현재 종목 <b>' + (ev && ev.name ? ev.name : '?') + '</b> 은(는) NxN 큐브가 아닙니다.<br>' +
          '가상 큐브는 2x2 ~ 7x7 종목에서만 동작합니다.',
          'the current event <b>' + (ev && ev.name ? ev.name : '?') + '</b> is not an NxN cube.<br>' +
          'the virtual cube supports 2x2 – 7x7 only.');
      ui.bad.appendChild(p);
      showScramble();
      return false;
    }

    /* Provisional; fitCanvas() below does the real sizing now the host is on screen. */
    ui.canvas.style.width = ui.canvas.style.height = '300px';

    eng = window.VCube3D.create(ui.canvas, {
      size: n,
      duration: isMobile() ? 90 : 120
    });
    eng.onSolved(function (ts) { finish(ts); });
    /* NB: no bindOrbit() here — the canvas is bound once per build in buildPlay() and
     * reads `eng` at event time. Binding per open is what leaked listeners + engines. */

    fitCanvas();
    observeStage();
    syncXray();
    document.addEventListener('keydown', onKey, true);
    /* Open SOLVED and wait for Space — csTimer's flow, and it makes Space mean something. */
    armSolved();
    return true;
  }

  /* DESKTOP: the cube is a full VIEW, not a floating modal — you stare at this thing while
   * solving, so it gets the whole main column (desktop.css keys off body[data-cubeview]).
   * Mobile has the equivalent as its 큐브 tab. openPlay() routes to whichever fits.
   *
   * NOTE this loses the modal's free perk: app.js's uiBlocked() suppressed the core timer
   * keys whenever a .modal.show existed. As a view there is no modal, so the core Space
   * handler is live — hence closeCubeView()'s guard and the Space handling in onKey(),
   * which stopPropagation()s before app.js can see it. */
  function cubeViewOpen() { return document.body.dataset.cubeview === '1'; }

  function openCubeView() {
    var pane = document.getElementById('cubePane');
    if (!pane) { openModalPlay(); return; }   // markup missing: fall back rather than die
    document.body.dataset.cubeview = '1';
    mount(pane);
  }
  function closeCubeView() {
    delete document.body.dataset.cubeview;
    unmount();
  }
  function toggleCubeView() {
    if (cubeViewOpen()) closeCubeView(); else openCubeView();
  }

  function openPlay() {
    if (document.body.classList.contains('solving')) {
      App.toast && App.toast(T('vcubeBusy', '측정 중에는 열 수 없습니다.',
        'cannot open while the timer is running.'), { type: 'error' });
      return;
    }
    /* mobile is driven by its tab (js/mobile.js calls mount directly); desktop gets the view */
    if (!isMobile()) { openCubeView(); return; }
    openModalPlay();
  }

  function openModalPlay() {
    /* Idempotent. A second open() without a close would build a SECOND engine over the same
     * canvas and orphan the first (live rAF loop, never destroyed) and add a second keydown
     * listener, double-applying every keypress. Hard to reach through the UI — the .modal.show
     * overlay covers its own trigger buttons — but VCubeFeat.open() is public. */
    if (st.open) { if (M && host === modalBody) M.open(); return; }
    /* app.js checks T_.state==='running' BEFORE uiBlocked(), so a core solve in flight would be
     * stopped by our very first cube key. Refuse rather than corrupt someone's time. */
    if (document.body.classList.contains('solving')) {
      App.toast && App.toast(T('vcubeBusy', '측정 중에는 열 수 없습니다.',
        'cannot open while the timer is running.'), { type: 'error' });
      return;
    }
    ensureModal();
    buildInto(M.body);
    M.open(); /* show FIRST — beginPlay measures the stage */
    /* Keep focus off the ✕ button: showModal() focuses the first control, and a focused
     * <button> would swallow Space as a click. */
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    beginPlay();
  }

  /* ---- mobile tab pane host (js/mobile.js calls these on entering/leaving the 큐브 view) ---- */
  function mount(container) {
    if (!container) return;
    if (st.open && host === container) return;   // already live here
    if (st.open) teardownPlay();                 // moving hosts: never run two engines
    buildInto(container);
    beginPlay();
  }

  function unmount() {
    var pane = isPaneHost() ? host : null;
    if (st.open) teardownPlay();
    /* Leave the modal's own body alone — app.js owns that element. Only a pane host
     * we were handed gets emptied, so the tab doesn't keep a dead canvas around. */
    if (pane) { pane.textContent = ''; host = null; }
  }

  /* ============================== boot ============================== */
  /* registerTool() ends in syncToolSelects(), which reads opts() — so it must not run before
   * the DB is loaded. Everything App-touching lives in here. */
  function setup() {
    App.registerTool({
      id: 'vcube',
      name: T('vcube', '가상 큐브', 'virtual cube'),
      render: renderTool,
      onHide: function (slot) { destroyTool(slot); }
    });

    App.registerMenuButton({
      icon: '⬜',
      title: T('vcube', '가상 큐브', 'virtual cube'),
      /* toggling matters on desktop: the view has no backdrop to click away */
      onClick: function () {
        if (!isMobile() && cubeViewOpen()) { closeCubeView(); return; }
        openPlay();
      }
    });

    /* settings */
    App.registerOptionRow && App.registerOptionRow('optPgDisplay', function (page) {
      /* gap width is pure taste, so it is a knob rather than a number I picked for you */
      var g = document.createElement('label');
      g.className = 'orow';
      var gl = document.createElement('span');
      gl.textContent = T('vcubeGapOpt', '가상 큐브: 뒷면 틈 간격', 'virtual cube: gap width');
      var gs = document.createElement('select');
      [['0.94', T('gapNarrow', '좁게', 'narrow')],
       ['0.86', T('gapNormal', '보통', 'normal')],
       ['0.78', T('gapWide', '넓게', 'wide')],
       ['0.70', T('gapWidest', '아주 넓게', 'widest')]].forEach(function (o) {
        var op = document.createElement('option');
        op.value = o[0]; op.textContent = o[1];
        gs.appendChild(op);
      });
      gs.value = String(gapPref());
      gs.addEventListener('change', function () { setGap(parseFloat(gs.value)); });
      g.appendChild(gl); g.appendChild(gs);
      page.appendChild(g);
    });

    App.registerOptionRow && App.registerOptionRow('optPgDisplay', function (page) {
      var row = document.createElement('label');
      row.className = 'orow';
      var label = document.createElement('span');
      label.textContent = T('vcubeXrayOpt', '가상 큐브: 틈으로 뒷면 보기', 'virtual cube: see the back through the gaps');
      var sw = document.createElement('span'); sw.className = 'tswitch';
      var inp = document.createElement('input'); inp.type = 'checkbox'; inp.checked = xrayOn();
      var i = document.createElement('i');
      inp.addEventListener('change', function () { setXray(inp.checked); });
      sw.appendChild(inp); sw.appendChild(i);
      row.appendChild(label); row.appendChild(sw);
      page.appendChild(row);
    });

    /* Re-apply only from a NOT-yet-started attempt. Notably 'done' must be excluded: recording
     * a solve ends in App.newScramble(), which emits 'scramble' right back at us — re-applying
     * there would blank the finish time off the LCD in the same tick the user solved. The next
     * scramble waits for Space, which is csTimer's behaviour anyway. */
    App.on('scramble', function () {
      if (!st.open || !eng) return;
      if (st.phase === 'idle' || st.phase === 'ready') applyScramble();
    });

    /* Changing the event while the cube is up used to strand you: the engine is built for a
     * fixed size at beginPlay(), so 3x3 -> 4x4 left a dead 3x3 engine, and 3x3 -> pyraminx
     * left a dead view with the timer hidden and no way back. Rebuild for a new cube size,
     * and get out of the way entirely for a puzzle we cannot simulate. */
    App.on('sessionChanged', function () {
      if (!st.open && !cubeViewOpen()) return;
      var n = cubeSizeOf(App.currentEvent && App.currentEvent());
      if (!n) {
        var ev = App.currentEvent && App.currentEvent();
        App.toast && App.toast(
          T('vcubeLeft', (ev && ev.name ? ev.name : '이 종목') + '은(는) 가상 큐브를 지원하지 않아 닫았어요',
            'the virtual cube does not support ' + (ev && ev.name ? ev.name : 'this event') + ' — closed'),
          { type: 'error' });
        if (cubeViewOpen()) closeCubeView();
        else { unmount(); App.closeModals && App.closeModals(); }
        return;
      }
      if (n === st.n) return;      // same size: the 'scramble' handler already re-applied
      var h = host;                 // rebuild the engine at the new size, in place
      if (h) { teardownPlay(); buildInto(h); beginPlay(); }
    });
    /* (There used to be a second sessionChanged handler here that just tore the engine down
     * and called closeModals(). As a modal that merely closed the overlay; once the cube
     * became a VIEW it left a dead canvas on screen with the timer hidden and no way out —
     * and it ran after the rebuild above, killing the new engine on the same tick. The
     * handler above now owns every event change.) */

    /* if a persisted option already points at our tool, the core rendered its fallback
     * before we registered — repaint those slots now */
    [0, 1].forEach(function (slot) {
      if (App.options()['tool' + slot] === 'vcube') App.refresh();
    });
  }

  if (App.db && App.db()) setup();
  else App.on('ready', setup);

  /* expose a little surface for the test harness / other packs */
  window.VCubeFeat = {
    tupleToToken: tupleToToken,
    isRotationTuple: isRotationTuple,
    keyMap: K,
    widthKeys: WIDTH_KEYS,
    cubeSizeOf: cubeSizeOf,
    open: openPlay,
    mount: mount,       // mobile 큐브 tab pane (js/mobile.js)
    unmount: unmount,
    state: st,
    engine: function () { return eng; },
    toolInstances: function () { return toolInst; }
  };

  /* ============================== node self-test ==============================
   * Run: node js/feat_vcube.js
   * Verifies the [s,e,f,d] -> notation translation against draw_nnn.js's own apply(),
   * which is the trusted reference. This closes the researcher's open item #4: the
   * "Lw L'" two-token form for a single inner slice was specified but never verified. */
  function selfTest() {
    if (typeof require === 'undefined' || typeof process === 'undefined') return;
    if (!process.argv[1] || !/feat_vcube\.js$/.test(process.argv[1])) return;
    var NNN = require('./draw_nnn.js');
    var fails = 0;
    function assert(name, cond) {
      if (!cond) { fails++; console.log('FAIL ' + name); }
      else console.log('ok   ' + name);
    }
    function apply(n, s) { return NNN.apply(NNN.solved(n), n, s); }
    function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
    /* two move strings are equivalent iff they produce the same facelets from solved */
    function same(n, a, b) { return eq(apply(n, a), apply(n, b)); }

    /* --- token shapes --- */
    assert('[1,1,R,1] -> R', tupleToToken([1, 1, 'R', 1], 3) === 'R');
    assert('[1,1,U,-1] -> U\'', tupleToToken([1, 1, 'U', -1], 3) === "U'");
    assert('[1,2,R,1] -> Rw', tupleToToken([1, 2, 'R', 1], 3) === 'Rw');
    assert('[1,3,R,1] n=4 -> 3Rw', tupleToToken([1, 3, 'R', 1], 4) === '3Rw');
    assert('[2,2,L,1] -> Lw L\'', tupleToToken([2, 2, 'L', 1], 3) === "Lw L'");
    assert('[1,3,U,1] n=3 -> y (rotation)', tupleToToken([1, 3, 'U', 1], 3) === 'y');
    assert('[1,3,D,1] n=3 -> y\' (inverted axis)', tupleToToken([1, 3, 'D', 1], 3) === "y'");
    assert('[1,3,L,-1] n=3 -> x', tupleToToken([1, 3, 'L', -1], 3) === 'x');
    assert('[1,3,F,1] n=3 -> z', tupleToToken([1, 3, 'F', 1], 3) === 'z');
    assert('[1,2,R,1] n=2 -> x (spans cube)', tupleToToken([1, 2, 'R', 1], 2) === 'x');
    assert('[2,1,...] rejected', tupleToToken([2, 1, 'L', 1], 3) === null);

    /* --- THE open item: single-slice two-token form vs draw_nnn's own M/E/S --- */
    assert('M-key == "M" on 3x3', same(3, tupleToToken([2, 2, 'L', 1], 3), 'M'));
    assert("M'-key == \"M'\" on 3x3", same(3, tupleToToken([2, 2, 'L', -1], 3), "M'"));
    assert('M via R-side == "M" on 3x3', same(3, tupleToToken([2, 2, 'R', -1], 3), 'M'));
    assert('E-key == "E" on 3x3', same(3, tupleToToken([2, 2, 'U', -1], 3), 'E'));
    assert("E'-key == \"E'\" on 3x3", same(3, tupleToToken([2, 2, 'U', 1], 3), "E'"));
    assert('S-key == "S" on 3x3', same(3, tupleToToken([2, 2, 'F', 1], 3), 'S'));
    assert("S'-key == \"S'\" on 3x3", same(3, tupleToToken([2, 2, 'F', -1], 3), "S'"));

    /* on 5x5 an M-key is ONE layer at depth 2 while draw_nnn's "M" is ALL inner layers,
     * so they MUST differ — this is exactly the trap the researcher flagged */
    assert('5x5 M-key is NOT draw_nnn "M"', !same(5, tupleToToken([2, 2, 'L', 1], 5), 'M'));
    assert('5x5 M-key == "Lw L\'"', tupleToToken([2, 2, 'L', 1], 5) === "Lw L'");
    assert('5x5 E-key == "E" (all inner)', same(5, tupleToToken([2, 4, 'U', -1], 5), 'E'));

    /* --- key table sanity --- */
    var codes = Object.keys(K);
    assert('36 move keys bound', codes.length === 36);
    var bad = codes.filter(function (c) { return !tupleToToken(K[c](3, 1, 1), 3); });
    assert('every key yields a token on 3x3: ' + bad.join(','), bad.length === 0);

    /* the funcmap rows csTimer publishes in its own help — row-for-row */
    function tok(code) { return tupleToToken(K[code](3, 1, 1), 3); }
    var expect = {
      KeyI: 'R', KeyK: "R'", KeyJ: 'U', KeyF: "U'", KeyH: 'F', KeyG: "F'",
      KeyD: 'L', KeyE: "L'", KeyS: 'D', KeyL: "D'", KeyW: 'B', KeyO: "B'",
      KeyU: 'Rw', KeyM: "Rw'", KeyV: 'Lw', KeyR: "Lw'",
      Comma: 'Uw', KeyC: "Uw'", KeyZ: 'Dw', Slash: "Dw'",
      Semicolon: 'y', KeyA: "y'", KeyY: 'x', KeyT: 'x', KeyN: "x'", KeyB: "x'",
      KeyP: 'z', KeyQ: "z'"
    };
    Object.keys(expect).forEach(function (c) {
      assert('help.js funcmap: ' + c + ' -> ' + expect[c], tok(c) === expect[c]);
    });
    /* duplicates csTimer deliberately ships */
    assert('Digit5 and Period are M / M\'', same(3, tok('Digit5'), 'M') && same(3, tok('Period'), "M'"));
    assert('KeyY == KeyT (both x)', same(3, tok('KeyY'), tok('KeyT')));
    assert('KeyN == KeyB (both x\')', same(3, tok('KeyN'), tok('KeyB')));
    assert('Digit5 == Digit6 (both M)', same(3, tok('Digit5'), tok('Digit6')));
    assert('KeyX == Period (both M\')', same(3, tok('KeyX'), tok('Period')));

    /* --- solved test is rotation-invariant (the highest-risk bug per spec) --- */
    function uniform(s, n) {
      for (var f = 0; f < 6; f++) for (var i = 1; i < n * n; i++) if (s[f][i] !== s[f][0]) return false;
      return true;
    }
    assert('solved after y is still solved', uniform(apply(3, 'y'), 3));
    assert('solved after x y z is still solved', uniform(apply(3, 'x y z'), 3));
    assert('R U R\' U\' is not solved', !uniform(apply(3, "R U R' U'"), 3));

    /* --- cubeSizeOf --- */
    assert('333 -> 3', cubeSizeOf({ img: '333' }) === 3);
    assert('222 -> 2', cubeSizeOf({ img: '222' }) === 2);
    assert('777 -> 7', cubeSizeOf({ img: '777' }) === 7);
    assert('pyr -> 0', cubeSizeOf({ img: 'pyr' }) === 0);
    assert('clk -> 0', cubeSizeOf({ img: 'clk' }) === 0);
    assert('null event -> 0', cubeSizeOf(null) === 0);

    console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
    process.exit(fails ? 1 : 0);
  }
})();
