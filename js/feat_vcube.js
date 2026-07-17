/* js/feat_vcube.js — virtual cube feature pack
 *
 * Depends on: js/draw_nnn.js (facelet model + palettes) and js/vcube3d.js (3D engine).
 * Provides:
 *   1. a tool ('vcube') — a small live cube preview, drag to orbit
 *   2. a PLAY surface — big cube, scramble, timer, keycap legend, mobile pad.
 *      DESKTOP: a full view that takes over #main (body[data-cubeview="1"], desktop.css)
 *      MOBILE : the same UI in the 큐브 tab (#cubePane, js/mobile.js calls mount/unmount)
 *      A modal path survives as a fallback for when #cubePane is missing.
 *   3. a CUBE-SPECIFIC SETTINGS PANEL (the ⚙ in the view) — see "SETTINGS" below.
 *
 * KEY MAP is csTimer's, transcribed from src/js/twisty/twistynnn.js
 * generateCubeKeyMapping(oSl, oSr, iSi) and cross-checked against its help.js funcmap.
 * We bind on `event.code` (physical position) rather than csTimer's legacy `event.keyCode`
 * (character), which reproduces csTimer's INTENT on every keyboard layout and lets us drop
 * its vrcKBL/codeMap machinery entirely. See csTimer issue #72.
 *
 * Bindings we ADD on top of csTimer's. Note every one of the 26 letters and all 10 digits
 * is already spoken for by csTimer, so each addition below HAD to be a modifier or a
 * non-alphanumeric key — there was no room for anything else:
 *   Shift (hold) .... peek at the D face; restores your exact view on release
 *   Backquote ....... reset the camera to the home angle
 *   Backspace ....... undo the last move    (Shift+Backspace = redo)
 *   BracketLeft ..... +2 on the solve just recorded
 *   BracketRight .... DNF on the solve just recorded
 * Ctrl+Z is NOT available: onKey() returns early on ctrlKey/metaKey so OS chords survive.
 *
 * ------------------------------------------------------------------------------------
 * SESSION SEPARATION (a product decision, documented for the human)
 * ------------------------------------------------------------------------------------
 * A 1.3s keyboard solve in a 14s hand session corrupts that session irreversibly on rep 1:
 * it takes the PB single, it eats ao5's best-trim slot (so the remaining ao5 is the mean of
 * your worst three), and it turns the session mean/sigma into fiction. Tagging cannot fix
 * this — Stats.averageOf/bestAverage/sessionSummary walk the raw solves array and are
 * core-owned, so a pack cannot inject a filter (API.md rule 1). Session separation is the
 * only correct answer available in today's API, and it makes BOTH sides' ao5/ao12/PB/sigma
 * right for free with zero core changes.
 * Default: a companion session per event, named '<event> · 가상', marked session.vcube.
 * Overridable in the cube settings panel (current session = csTimer parity, or off).
 *
 * ------------------------------------------------------------------------------------
 * COEXISTENCE WITH THE CORE TIMER
 * ------------------------------------------------------------------------------------
 * As a MODAL, app.js's uiBlocked() (true whenever a `.modal.show` exists) suppressed the
 * core's timer keys for free. As a VIEW there is no modal, so the core Space handler is
 * live — onKey() runs on the CAPTURE phase and stopPropagation()s everything it consumes
 * before app.js can see it. app.js also checks `T_.state === 'running'` BEFORE uiBlocked(),
 * so we refuse to open at all while the core timer runs (body.classList 'solving').
 * Conversely, when OUR settings modal is open it must not have its keys eaten by the cube —
 * onKey() bails whenever a `.modal.show` that is not our own play modal exists.
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

  /* ---- inverting a token (undo) ----
   * A token may be a two-token string ("Lw L'"), so the inverse is the REVERSED sequence
   * with every token inverted. A half turn is its own inverse; "2'" normalises to "2".
   * Pure, and self-tested against draw_nnn.apply(): `t + ' ' + invertToken(t)` must be a
   * no-op on the real facelet model, for every key in the map, on every n we support. */
  function invertOne(t) {
    if (/2'$/.test(t)) return t.slice(0, -1);   // "R2'" -> "R2"
    if (/2$/.test(t)) return t;                 // a half turn is its own inverse
    if (/'$/.test(t)) return t.slice(0, -1);    // "R'" -> "R"
    return t + "'";                             // "R"  -> "R'"
  }
  function invertToken(token) {
    if (!token) return null;
    var parts = String(token).trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return null;
    return parts.reverse().map(invertOne).join(' ');
  }

  /* ============================== events ============================== */
  /* Which events this pack can actually simulate: the NxN cubes. img is '333','222'..'777'. */
  function cubeSizeOf(ev) {
    if (!ev || !ev.img) return 0;
    var m = /^([234567])\1\1$/.exec(ev.img);
    return m ? +m[1] : 0;
  }

  /* BLD must key on ev.id, NOT on ev.img: 333ni's img IS '333', so cubeSizeOf() cannot tell
   * a blindfolded event from a sighted one BY CONSTRUCTION. */
  function isBLD(ev) { return !!ev && /^(333ni|444bld|555bld)$/.test(ev.id || ''); }

  /* ---- move accounting ----
   * HTM excludes whole-cube rotations: turning the cube in your hands is not a move. The old
   * counter incremented AFTER the rotation branch, so it counted them — measured 39 for
   * 8 rotations + 31 turns — and then nothing ever read the number anyway.
   * `raw` is [{token, rot, ts}, ...]. */
  function htmOf(raw) {
    var c = 0;
    for (var i = 0; i < (raw || []).length; i++) if (!raw[i].rot) c++;
    return c;
  }
  function tpsOf(htm, ms) {
    if (!(ms > 0) || !(htm > 0)) return 0;
    return htm / (ms / 1000);
  }

  /* ---- the tables the legend and the mobile pad PRINT ----
   * Up here with the pure code on purpose: a legend is a promise about what the keys do,
   * and the old ASCII table was a verbatim copy of csTimer's funcmap with nothing tying it
   * to this file's actual bindings. These live above the node guard so the self-test can
   * hold every printed keycap against K + draw_nnn's model. */
  var BASIC = [
    ['R', 'I'], ["R'", 'K'], ['U', 'J'], ["U'", 'F'], ['F', 'H'], ["F'", 'G'],
    ['L', 'D'], ["L'", 'E'], ['D', 'S'], ["D'", 'L'], ['B', 'W'], ["B'", 'O'],
    ['y', ';'], ["y'", 'A']
  ];
  var ADV_SLICE = [['M', '5'], ["M'", 'X'], ['M', '6'], ["M'", '.'],
    ['E', '2'], ["E'", '9'], ['S', '0'], ["S'", '1']];
  var ADV_WIDE = [['Rw', 'U'], ["Rw'", 'M'], ['Lw', 'V'], ["Lw'", 'R'],
    ['Uw', ','], ["Uw'", 'C'], ['Dw', 'Z'], ["Dw'", '/']];
  var ADV_ROT = [['x', 'Y'], ['x', 'T'], ["x'", 'N'], ["x'", 'B'], ['z', 'P'], ["z'", 'Q']];
  /* mobile pad rows — row 2 is what turns a puzzle simulator back into a cube */
  var PAD_ROW1 = ['U', 'R', 'F', 'D', 'L', 'B'];
  var PAD_ROW2 = ['y', 'x', 'M', 'Rw'];

  /* Everything above this line is pure and dependency-free, so node can self-test the
   * notation translation (see the assertions at the bottom of this file). Everything below
   * needs a live window.App and a DOM. */
  var PURE = {
    tupleToToken: tupleToToken,
    isRotationTuple: isRotationTuple,
    invertToken: invertToken,
    keyMap: K,
    widthKeys: WIDTH_KEYS,
    cubeSizeOf: cubeSizeOf,
    isBLD: isBLD,
    htmOf: htmOf,
    tpsOf: tpsOf
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

    /* modal fallback host (only reached when #cubePane is missing) */
    '#vcubeModal .mbox{width:min(1100px,96vw);max-width:96vw;height:min(94vh,940px);',
    'display:flex;flex-direction:column;}',
    '#vcubeModal .mbody{flex:1;display:flex;flex-direction:column;gap:10px;min-height:0;overflow:hidden;}',

    '.vcHead{display:flex;gap:10px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;}',
    /* In the pane the scramble line is hidden (the app prints it right above us), so the
     * clock is the only thing left in the row and hanging it off the left edge reads as a
     * mistake. Centre it over the cube. */
    '.vcHead.vcHeadBare{justify-content:center;}',
    '.vcScr{flex:1;min-width:180px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;',
    'font-size:14px;line-height:1.6;color:var(--fg);background:var(--card2);',
    'border-radius:var(--radius-btn);padding:10px 12px;word-break:break-word;}',
    '.vcScr b{color:var(--accent);font-weight:600;}',
    /* A ROW, not a column: stacking the move/TPS line under the LCD cost the stage 16px of
     * cube for a 12px readout. Beside it, it is free — the LCD is 4x taller than the text. */
    '.vcMeta{display:flex;flex-direction:row;align-items:baseline;gap:8px;}',
    '.vcLcd{font-variant-numeric:tabular-nums;font-weight:800;font-size:clamp(28px,6vw,54px);',
    'color:var(--fg);letter-spacing:-0.02em;min-width:4.5ch;text-align:right;line-height:1.1;}',
    '.vcLcd.run{color:var(--accent);}',
    '.vcLcd.warn{color:var(--orange);}',
    '.vcLcd.bad{color:var(--red);}',
    '.vcLcd.vcDone{color:var(--green);}',
    /* move count / TPS: a time on its own cannot tell "efficient" from "fast and sloppy" */
    '.vcStat{font-variant-numeric:tabular-nums;font-size:12px;color:var(--sub);',
    'letter-spacing:-0.01em;white-space:nowrap;min-height:16px;}',

    '.vcStage{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;',
    'background:var(--card2);border-radius:var(--radius-card);position:relative;overflow:hidden;}',
    /* fitCanvas() positions the canvas absolutely: the cube is NOT centred inside its own
     * canvas (perspective pushes the near bottom corner down), so flex-centring the canvas
     * box is centring the wrong rectangle. See the FRAMING note. */
    '.vcStage canvas.vcCube{display:block;position:absolute;touch-action:none;cursor:grab;}',
    '.vcStage canvas.vcCube:active{cursor:grabbing;}',
    /* 2D net inset: the same facelets, unfolded. A post-mortem you can read at a glance. */
    /* Toggled by a CLASS, never by an inline style: `el.style.display = ''` only removes the
     * inline value and falls straight back to this `display:none`, so the panel could never
     * be shown. That is the identical trap the old key legend fell into (its button wrote the
     * pref and flipped its label while the legend stayed hidden behind a stylesheet rule). */
    '.vcNet{position:absolute;left:10px;bottom:10px;z-index:2;border-radius:8px;',
    'background:var(--card);box-shadow:var(--shadow-card);padding:4px;display:none;}',
    '.vcNet.on{display:block;}',
    '.vcNet canvas{display:block;}',

    '.vcClose{position:absolute;top:10px;right:10px;z-index:3;width:36px;height:36px;',
    'border-radius:50%;background:var(--card);box-shadow:var(--shadow-card);font-size:13px;',
    'opacity:.75;padding:0;}',
    '.vcClose:hover{opacity:1;background:var(--card);}',
    /* cube-only fullscreen: everything except the canvas and a small clock gets out */
    '.vcFull{background:var(--bg);padding:0!important;gap:0!important;}',
    '.vcFull .vcFoot,.vcFull .vcPad,.vcFull .vcLegend,.vcFull .vcScr,',
    '.vcFull .vcHint{display:none!important;}',
    /* fullscreen: same corner, bigger touch target (no Esc on a phone) */
    '.vcFull .vcClose{display:block!important;width:44px;height:44px;font-size:16px;opacity:.85;}',
    '.vcFull .vcHead{position:absolute;top:14px;left:50%;transform:translateX(-50%);z-index:2;',
    'margin:0;padding:0;pointer-events:none;}',
    '.vcFull .vcLcd{font-size:34px;opacity:.85;}',
    '.vcFull .vcStage{flex:1;border-radius:0;background:transparent;}',

    /* The hint used to be position:absolute inside the stage at bottom:8px, exactly where
     * the cube's bottom-front corner lands. It is its own row now, so the collision is not
     * "tuned away", it is structurally impossible. */
    '.vcHint{text-align:center;color:var(--sub);font-size:12px;padding:2px 10px 0;',
    'min-height:17px;line-height:1.4;}',
    '.vcHint b{color:var(--fg);font-weight:600;}',

    '.vcFoot{display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap;}',
    '.vcFootL{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}',
    '.vcFootR{display:flex;gap:6px;flex-wrap:wrap;align-items:center;}',

    /* Segmented 연습 / 기록.
     * NB the selectors are `.vcSeg .vcSegBtn`, not `.vcSeg button`: style.css has
     * `body[data-theme="dark"] button{background:rgba(255,255,255,.08)}` at (0,1,2), which
     * out-specifies a bare `.vcSeg button` (0,1,1) — so in dark the INACTIVE half rendered
     * with a raised pill and read as the selected one. Two classes (0,2,0) wins in both
     * themes without an !important. */
    '.vcSeg{display:inline-flex;background:var(--card2);border-radius:var(--radius-btn);padding:3px;gap:2px;}',
    '.vcSeg .vcSegBtn{border:0;background:transparent;color:var(--sub);font-weight:700;',
    'font-size:12px;padding:6px 12px;border-radius:9px;cursor:pointer;}',
    '.vcSeg .vcSegBtn:hover{background:var(--hover);color:var(--fg);}',
    '.vcSeg .vcSegBtn.on{background:var(--card);color:var(--fg);box-shadow:var(--shadow-card);}',

    /* inline +2/DNF — #quickBar lives inside #timerPad, which the cube view hides, so the
     * core's penalty flow measured 0x0 and was unreachable without leaving the view. */
    '.vcQuick{display:none;gap:6px;align-items:center;flex-wrap:wrap;}',
    '.vcQuick.on{display:flex;}',
    '.vcQuick .vcQLbl{color:var(--sub);font-size:12px;margin-right:2px;}',

    /* keycap legend — was four rows of monospace ASCII with white-space:pre */
    '.vcLegend{display:none;}',
    '.vcLegend.on{display:block;}',
    /* Inline headers, NOT width:100%. Measured: a header per line cost the stage 189px and
     * shrank the canvas from 606 to 416 — a key table that eats a third of the cube is not
     * a help, it is the bug it was meant to fix. */
    '.vcLegRow{display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin-bottom:3px;}',
    '.vcLegHd{font-size:10px;font-weight:700;color:var(--sub);margin-right:2px;',
    'letter-spacing:.02em;flex:0 0 auto;}',
    '.vcCap{display:inline-flex;align-items:center;gap:5px;background:var(--card2);',
    'border:1px solid var(--line);border-radius:6px;padding:3px 6px;line-height:1;}',
    '.vcCap b{font-size:12px;font-weight:600;color:var(--fg);font-family:ui-monospace,Menlo,monospace;}',
    '.vcCap i{font-size:10px;font-style:normal;color:var(--sub);font-family:ui-monospace,Menlo,monospace;}',
    '.vcLegNote{font-size:10px;color:var(--sub);line-height:1.4;}',
    '.vcLegMore{background:none;border:0;color:var(--accent);font-size:11px;font-weight:600;',
    'cursor:pointer;padding:0 2px;flex:0 0 auto;}',

    /* TWO grids, not one. A single 6-column grid holding all 20 buttons is 4 rows, and the
     * app's 40px min-height touch target (rightly) makes that 175px — which left the stage
     * 49px and rendered the cube at 33. Faces stay 6-up; the 8 extras go 8-up on one row
     * (48px each at 390px, still over the 44px target). 20 buttons, 3 rows. */
    '.vcPad,.vcPadX{display:none;gap:6px;}',
    '.vcPad{grid-template-columns:repeat(6,1fr);}',
    '.vcPadX{grid-template-columns:repeat(8,1fr);}',
    '.vcPad button,.vcPadX button{padding:10px 0;font-size:14px;font-weight:700;}',
    '.vcPadX button{font-size:12px;}',
    '.vcBad{color:var(--sub);text-align:center;padding:30px 16px;line-height:1.8;}',
    '.vcBad b{color:var(--fg);}',

    /* BLD: the scramble is printed above the cube by the core. Reading it during the
     * attempt is not practice, it is cheating with extra steps. */
    'body.vcBldRun #scrambleTxt{visibility:hidden;}',

    /* cube settings modal */
    '#vcubeOpts .mbox{width:min(460px,94vw);}',
    '.vcOptSec{font-size:11px;font-weight:700;color:var(--sub);margin:14px 0 2px;}',
    '.vcOptSec:first-child{margin-top:0;}',
    '.vcOptHint{font-size:11px;color:var(--sub);line-height:1.5;margin:-2px 0 6px;}',
    '.vcOptRowSub{display:block;color:var(--sub);font-size:11px;font-weight:400;}',

    /* MOBILE_MQ is already a comma-separated media query LIST, which is exactly what
     * @media accepts — do not try to split it into two rules. */
    '@media ' + MOBILE_MQ + '{',
    '#vcubeModal .mbox{width:100vw;max-width:100vw;height:100vh;border-radius:0;}',
    /* A keyboard legend on a keyboard-less device. It also USED to lie: the button flipped
     * its label to "키 숨기기" and wrote the pref, while `.vcLegend{display:none}` in this
     * very block beat syncLegend()'s inline style, so the legend never actually appeared.
     * The button is now removed on mobile outright rather than made to tell the truth
     * about nothing — and the pad gets the row back. */
    '.vcLegend,.vcLegend.on{display:none;}',
    /* 20 buttons at 6 columns is 4 rows; every pixel of row height is a pixel off the cube,
     * so the phone gets tighter caps than the desktop pad. Still >=32px tall with the grid
     * gap, which keeps the tap target honest. */
    '.vcPad,.vcPadX{display:grid;gap:5px;}',
    '.vcPad button,.vcPadX button{padding:7px 0;font-size:13px;}',
    '.vcPadX button{font-size:11px;}',
    '.vcFoot{gap:6px;}',
    '.vcFootR{gap:5px;}',
    '.vcHint{font-size:11px;padding:0 6px;}',
    '.vcNet{left:6px;bottom:6px;padding:3px;}}'
  ].join(''));

  /* ============================== prefs ==============================
   * Pack-private state only, all under cstc_pack_vcube_* (API.md rule 2). */
  var PFX = 'cstc_pack_vcube_';
  function pref(k, def) {
    try { var v = localStorage.getItem(PFX + k); return v == null ? def : v; }
    catch (e) { return def; }
  }
  function setPref(k, v) { try { localStorage.setItem(PFX + k, String(v)); } catch (e) { } }
  function prefOn(k, def) { return pref(k, def ? '1' : '0') === '1'; }

  /* Where virtual solves go. See the SESSION SEPARATION note at the top. */
  function recMode() {
    var v = pref('rec', 'session');
    return (v === 'current' || v === 'off') ? v : 'session';
  }
  /* 연습 (free play, records nothing) vs 기록 (a real attempt) */
  function playMode() { return pref('mode', 'record') === 'practice' ? 'practice' : 'record'; }
  function xrayOn() { return prefOn('xray', false); }
  /* Default OPEN: as keycaps this costs ~30px, not the ~90px of ASCII that justified
   * collapsing it — and a key map nobody can find is a key map nobody learns. */
  function legendOn() { return prefOn('legend', true); }
  function legendTier() { return pref('legtier', 'basic') === 'full' ? 'full' : 'basic'; }
  function netOn() { return prefOn('net', false); }
  function statOn() { return prefOn('stat', true); }
  function autoNext() { return prefOn('autonext', false); }
  /* THE palette pref. One key, one owner — this file. See applyPalettePref().
   *
   * js/feat_vcube_style.js used to keep a SECOND palette pref under its own key
   * ('cstc_pack_vcube_palette') with its own select in Settings > 화면, and because it loads
   * last it was the only one restored on reload — from a key this panel never writes. Two
   * controls, two keys, one cube: they could disagree three ways at once (panel showing
   * 'classic', Display showing 'toss', pixels painting 'cvd'). That row is gone; this is the
   * survivor, and migratePalPref() below adopts whatever the old key was holding. */
  function palPref() { return pref('pal', 'toss'); }
  var K_PAL_OLD = 'cstc_pack_vcube_palette';   // feat_vcube_style.js's retired key

  /* One-time adoption of the retired key, so a user who picked their colours in the old
   * Display row still has them after this change. Only fills an unset pref: an explicit
   * choice made in the cube panel always wins. */
  function migratePalPref() {
    try {
      var old = localStorage.getItem(K_PAL_OLD);
      if (old && localStorage.getItem(PFX + 'pal') == null) setPref('pal', old);
      if (old != null) localStorage.removeItem(K_PAL_OLD);
    } catch (e) { }
  }

  /* Push the STORED palette into draw_nnn at boot, BEFORE anything renders.
   *
   * Without this the 3D cube looked right (beginPlay() reads paletteColors() at create time)
   * while ScrImage.nnn.colors — which the 2D scramble image draws from — was still the
   * default array. So the panel's promise ('2D 스크램블 그림도 함께 바뀝니다') held live and
   * then silently broke on reload: cube classic, net Toss. setPalette() only ran on user
   * change; nothing ran on load. */
  function applyPalettePref() {
    var NNN = window.ScrImage && window.ScrImage.nnn;
    if (NNN && NNN.setPalette) NNN.setPalette(palPref());
  }

  function gapPref() {
    var v = parseFloat(pref('gap', ''));
    return (v >= 0.5 && v <= 0.99) ? v : 0.86;
  }

  /* Turn speed is csTimer's vrcSpeed: TURNS PER SECOND, not milliseconds. 0 = instant.
   * Default 10/sec (100ms). The old code hardcoded `isMobile() ? 90 : 120` and never called
   * eng.setDuration() from anywhere in js/ — at 8 TPS a permanent 120ms slurry destroys
   * lookahead, which is reading the state you are ABOUT to act on, i.e. the whole skill. */
  var TPS_CHOICES = ['0', '20', '10', '5', '2', '1'];
  function tpsPref() {
    var v = pref('tps', '10');
    return TPS_CHOICES.indexOf(v) >= 0 ? v : '10';
  }
  function durationMs() {
    var t = parseFloat(tpsPref());
    return t > 0 ? Math.round(1000 / t) : 0;
  }

  var DEF_VIEW = { yaw: -30, pitch: 37.5 };   // engine default: U/R/F visible
  /* Peek: yaw -30 / pitch -35 puts D, R and F on screen. Every CFOP and every LBL solve
   * begins by planning on the face you cannot see; the old cost was ~6 ArrowDown presses
   * before D even entered the visible set, landing where it was an unreadable sliver,
   * ~20 keystrokes round-trip, every rep, forever — and the failure mode was vicious,
   * because pressing R hoping for a reset executes Lw' and STARTS THE TIMER. */
  var PEEK_VIEW = { yaw: -30, pitch: -35 };
  function homeView() {
    try {
      var v = JSON.parse(pref('view', 'null'));
      if (v && isFinite(v.yaw) && isFinite(v.pitch)) return { yaw: v.yaw, pitch: v.pitch };
    } catch (e) { }
    return { yaw: DEF_VIEW.yaw, pitch: DEF_VIEW.pitch };
  }

  function paletteColors() {
    var NNN = window.ScrImage && window.ScrImage.nnn;
    var p = NNN && NNN.paletteById && NNN.paletteById(palPref());
    return p ? p.colors : null;
  }
  var BLD_GREY = ['#8b95a1', '#8b95a1', '#8b95a1', '#8b95a1', '#8b95a1', '#8b95a1'];

  /* ============================== tool ============================== */
  var toolInst = [null, null];

  function destroyTool(slot) {
    if (toolInst[slot]) { try { toolInst[slot].destroy(); } catch (e) { } toolInst[slot] = null; }
  }

  /* bindOrbit(canvas, getInst, onTap) — `getInst` is a GETTER, resolved at event time, not
   * an instance captured at bind time.
   *
   * Why a getter: the play canvas is created ONCE per host build, but its engine is created
   * and destroyed on every open/close. Binding a captured instance per open leaked four
   * listeners per open, each pinning a destroyed engine, and every pointermove then fanned
   * out to all N stale closures. So we bind exactly once, at build time, and let the handler
   * ask who the CURRENT engine is.
   *
   * onTap fires only when the pointer moved less than TAP_SLOP: on a phone the stage is the
   * biggest target there is, but a tap must never be confused with the drag that orbits. */
  var TAP_SLOP = 8;
  function bindOrbit(canvas, getInst, onTap) {
    var down = false, lx = 0, ly = 0, moved = 0;
    function pt(e) { return e.touches ? e.touches[0] : e; }
    canvas.addEventListener('pointerdown', function (e) {
      if (!getInst()) return;
      down = true; moved = 0; lx = e.clientX; ly = e.clientY;
      if (canvas.setPointerCapture) { try { canvas.setPointerCapture(e.pointerId); } catch (er) { } }
      e.preventDefault();
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!down) return;
      var inst = getInst();
      if (!inst) { down = false; return; }
      var p = pt(e);
      var dx = p.clientX - lx, dy = p.clientY - ly;
      moved += Math.abs(dx) + Math.abs(dy);
      inst.dragBy(dx, -dy);
      lx = p.clientX; ly = p.clientY;
    });
    canvas.addEventListener('pointerup', function () {
      if (down && moved < TAP_SLOP && onTap) onTap();
      down = false;
    });
    canvas.addEventListener('pointercancel', function () { down = false; });
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
      var hv = homeView();
      inst = window.VCube3D.create(canvas, {
        size: n, duration: 0, yaw: hv.yaw, pitch: hv.pitch, palette: paletteColors() || undefined
      });
    } catch (e) { wrap.textContent = 'vcube error'; return; }
    toolInst[slot] = inst;
    try { inst.setState(App.scrambleStr ? App.scrambleStr() : ''); } catch (e) { }
    bindOrbit(canvas, function () { return toolInst[slot]; }, null);
  }

  /* ============================== play surface ==============================
   * ONE play UI, two hosts:
   *   desktop → #cubePane taking over #main (openCubeView)
   *   mobile  → the same #cubePane as the 큐브 tab (mount/unmount)
   * `host` is whichever element currently owns the UI. `ui`/`eng`/`st` are module
   * singletons, so only one surface may be live at a time — which is exactly the invariant
   * we want (two live engines = two rAF loops double-applying every keypress). */
  var M = null;          // {open, close, body}
  var modalEl = null;
  var modalBody = null;  // the modal's body element (see isPaneHost)
  var eng = null;        // engine instance
  var ui = {};
  var host = null;       // element currently holding the play UI
  var optM = null;       // the cube settings modal
  var st = {
    open: false,
    n: 0,
    bld: false,
    phase: 'idle',       // idle | inspect | ready | running | done
    startTs: 0,
    insStart: 0,
    pen: 0,
    raf: 0,
    oSl: 1, oSr: 1,
    raw: [],             // [{token, rot, ts}] — the undo substrate AND the move counter
    redo: [],
    doneIdx: null,       // index of the solve just recorded (inline +2/DNF target)
    doneSid: null,       // ...and the session it lives in, so a switch cannot mis-target
    escAt: 0,            // first-Esc timestamp (confirm-to-discard)
    peek: null           // the view captured when Shift went down
  };

  function fmt(ms) {
    if (App.fmt) { try { return App.fmt(ms); } catch (e) { } }
    var s = Math.max(0, ms) / 1000;
    return s.toFixed(2);
  }

  /* ============================== virtual session ==============================
   * App.db() is the only door: app.js's switchSession() is module-private, not exported.
   * Setting DB.current + App.save() + App.refresh() is enough — renderStats() calls
   * renderSessions(), which repopulates the session <select> AND re-points it at DB.current.
   * We deliberately do NOT regenerate the scramble on the way in: you are looking at the
   * scramble you are about to apply, and swapping it under you would be its own bug. */
  var prevSid = null;
  var switching = false;   // guards our own emit('sessionChanged') from re-entering our handler

  /* A companion's identity is vcubeEvent, NOT event: app.js rewrites `event` on whatever
   * session is current (see adoptEventChange), so `event` is not a stable key. */
  function findVSession(db, evId) {
    for (var i = 0; i < db.order.length; i++) {
      var s = db.sessions[db.order[i]];
      if (s && s.vcube && (s.vcubeEvent || s.event) === evId) return db.order[i];
    }
    return null;
  }
  /* The first session the USER owns — where an event change belongs, and where to land on
   * the way out. */
  function homeSid(db) {
    if (prevSid && db.sessions[prevSid] && !db.sessions[prevSid].vcube) return prevSid;
    for (var i = 0; i < db.order.length; i++) {
      var s = db.sessions[db.order[i]];
      if (s && !s.vcube) return db.order[i];
    }
    return null;
  }

  /* app.js's data model is "the event is a property of the CURRENT session" — both
   * App.setEvent() and the #eventSel handler do `curSession().event = id` and only THEN
   * emit('sessionChanged'). While a companion session is current, that write lands on US.
   *
   * Left alone it silently repurposes the 3x3 companion into the 4x4 one — its name still
   * reads '3x3x3 · 가상' while it fills up with 4x4 solves, and the 3x3 companion is gone
   * for good. That is precisely the two-events-in-one-session corruption the companion
   * exists to prevent, so the fix cannot be to ignore it.
   *
   * So: undo the write on our session, re-aim it at a session the user actually owns, and
   * report back which event they asked for. Returns null when nothing was hijacked (i.e.
   * every path where the companion is not current, which is the common case). */
  function adoptEventChange() {
    var db = App.db && App.db();
    if (!db) return null;
    var cur = db.sessions[db.current];
    if (!cur || !cur.vcube || !cur.vcubeEvent || cur.event === cur.vcubeEvent) return null;
    var wanted = cur.event;
    cur.event = cur.vcubeEvent;              // give the companion its own event back
    var hs = homeSid(db);
    if (hs) { db.sessions[hs].event = wanted; prevSid = hs; }
    return wanted;
  }
  function eventById(id) {
    /* NB Scrambler.byId falls back to EVENTS[0] (3x3) for an unknown id rather than
     * returning null — so this never throws, and an unknown event behaves as 3x3 here
     * exactly as it does everywhere else in the app. */
    return (window.Scrambler && window.Scrambler.byId) ? window.Scrambler.byId(id) : null;
  }
  function commitSession() {
    switching = true;
    try {
      App.save && App.save();
      App.refresh && App.refresh();
      App.emit && App.emit('sessionChanged');
    } finally { switching = false; }
  }
  /* `evId` optional: after adoptEventChange() has repaired our session, curSession().event
   * no longer reflects where the user wants to go, so the caller passes it explicitly.
   *
   * `create` — ONLY the code path that is about to write a solve passes true. Opening the
   * cube used to create and switch to a '3x3x3 · 가상' session immediately, so a user who
   * opened it just to LOOK at the cube got silently moved into a new session and, after
   * closing, was left with an empty companion in their session picker forever — one per
   * event they ever glanced at. Nothing was corrupted (prevSid put them back), but a session
   * list you did not ask for is still a mess you have to clean up.
   *
   * Without `create` this only ever SWITCHES to a companion that already exists, so the
   * bookkeeping callers (mode/rec-mode changes, event adoption) stay honest without
   * conjuring sessions. record() is what brings one into being, by which point the user has
   * actually solved something and the session has a reason to exist.
   *
   * NB this must not regenerate the scramble: it sets db.current directly and commits, and
   * never calls app.js's switchSession() (which resets scrHistory and calls genScramble()).
   * That is what lets record() switch immediately before App.addSolve() and still have
   * currentScramble() be the scramble the user actually solved. */
  function enterVSession(evId, create) {
    if (recMode() !== 'session' || playMode() === 'practice') return;
    var db = App.db && App.db();
    var ev = evId ? eventById(evId) : (App.currentEvent && App.currentEvent());
    if (!db || !ev) return;
    var id = findVSession(db, ev.id);
    if (!id && !create) return;                 // look, don't touch
    if (!id) {
      var n = 1;
      while (db.sessions[String(n)]) n++;
      id = String(n);
      db.sessions[id] = {
        name: (ev.name || ev.id) + ' · ' + T('vcubeSessTag', '가상', 'virtual'),
        event: ev.id, solves: [], created: Math.floor(Date.now() / 1000),
        vcube: true, vcubeEvent: ev.id
      };
      db.order.push(id);
    }
    if (db.current === id) return;              // already there (re-entry / event rebuild)
    /* Only remember a NON-virtual session as "where to go back to", or an event switch
     * between two virtual sessions would strand us in one on the way out. */
    if (!db.sessions[db.current] || !db.sessions[db.current].vcube) prevSid = db.current;
    db.current = id;
    commitSession();
  }
  function exitVSession() {
    var db = App.db && App.db();
    if (!db || !prevSid) return;
    var cur = db.sessions[db.current];
    if (!cur || !cur.vcube) { prevSid = null; return; }    // the user moved on themselves; respect it
    if (!db.sessions[prevSid]) { prevSid = null; return; } // it was deleted while we were in
    db.current = prevSid;
    prevSid = null;
    commitSession();
  }

  /* ============================== build ============================== */
  function mkBtn(cls, label, fn) {
    var b = document.createElement('button');
    b.className = cls;
    b.textContent = label;
    b.addEventListener('click', fn);
    return b;
  }

  function buildPlay(body) {
    var head = document.createElement('div'); head.className = 'vcHead';
    ui.head = head;
    ui.scr = document.createElement('div'); ui.scr.className = 'vcScr';
    var meta = document.createElement('div'); meta.className = 'vcMeta';
    ui.lcd = document.createElement('div'); ui.lcd.className = 'vcLcd'; ui.lcd.textContent = '0.00';
    ui.stat = document.createElement('div'); ui.stat.className = 'vcStat';
    meta.appendChild(ui.lcd); meta.appendChild(ui.stat);
    head.appendChild(ui.scr); head.appendChild(meta);
    /* A view has no modal chrome, so it must carry its own way out. Mobile leaves via the
     * tab bar, so this is desktop-only. */
    ui.close = document.createElement('button');
    ui.close.className = 'icon ghost vcClose';
    ui.close.innerHTML = '&#10005;';
    ui.close.title = T('vcubeClose', '닫기 (Esc)', 'close (Esc)');
    ui.close.addEventListener('click', function () {
      /* in fullscreen the ✕ means "get me out of fullscreen", not "quit the cube" */
      if (inFull()) { toggleFull(); return; }
      leave();
    });
    body.appendChild(head);

    ui.stage = document.createElement('div'); ui.stage.className = 'vcStage';
    ui.canvas = document.createElement('canvas');
    ui.canvas.className = 'vcCube';
    /* Bound ONCE, here, for the life of the canvas — never per open. See bindOrbit(). */
    bindOrbit(ui.canvas, function () { return eng; }, onStageTap);
    ui.stage.appendChild(ui.canvas);

    ui.net = document.createElement('div'); ui.net.className = 'vcNet';
    ui.netCv = document.createElement('canvas');
    ui.net.appendChild(ui.netCv);
    ui.stage.appendChild(ui.net);
    /* The ✕ floats over the cube's top-right rather than sharing the header row with the
     * clock — sitting level with the timer read as if it belonged to it. Same home in
     * fullscreen, so it never moves on you. */
    ui.stage.appendChild(ui.close);
    body.appendChild(ui.stage);

    ui.hint = document.createElement('div'); ui.hint.className = 'vcHint';
    body.appendChild(ui.hint);

    ui.pad = document.createElement('div'); ui.pad.className = 'vcPad';
    ui.padX = document.createElement('div'); ui.padX.className = 'vcPadX';
    buildPad();
    body.appendChild(ui.pad);
    body.appendChild(ui.padX);

    var foot = document.createElement('div'); foot.className = 'vcFoot';

    /* --- left: mode segment + the inline quickbar --- */
    var footL = document.createElement('div'); footL.className = 'vcFootL';
    ui.seg = document.createElement('div'); ui.seg.className = 'vcSeg';
    ui.segRec = mkBtn('vcSegBtn', T('vcubeModeRec', '기록', 'record'), function () { setMode('record'); });
    ui.segPra = mkBtn('vcSegBtn', T('vcubeModePra', '연습', 'practice'), function () { setMode('practice'); });
    ui.seg.appendChild(ui.segRec); ui.seg.appendChild(ui.segPra);
    footL.appendChild(ui.seg);

    ui.quick = document.createElement('div'); ui.quick.className = 'vcQuick';
    var ql = document.createElement('span'); ql.className = 'vcQLbl';
    ql.textContent = T('vcubeQuickL', '방금 기록', 'last solve');
    ui.quick.appendChild(ql);
    ui.quick.appendChild(mkBtn('btn', 'OK', function () { setPen(0); }));
    ui.quick.appendChild(mkBtn('btn', '+2', function () { setPen(2000); }));
    ui.quick.appendChild(mkBtn('btn', 'DNF', function () { setPen(-1); }));
    ui.quick.appendChild(mkBtn('btn danger', T('vcubeDel', '삭제', 'delete'), delLast));
    footL.appendChild(ui.quick);
    foot.appendChild(footL);

    /* --- right: the toggles you reach for mid-session (nobody digs through settings at
     * rep 30, so these stay in place even though they also live in the ⚙ panel) --- */
    var btns = document.createElement('div'); btns.className = 'vcFootR';

    ui.optBtn = document.createElement('button');
    ui.optBtn.className = 'icon ghost';
    ui.optBtn.innerHTML = '&#9881;';
    ui.optBtn.title = T('vcubeOpts', '큐브 설정', 'cube settings');
    ui.optBtn.setAttribute('aria-label', ui.optBtn.title);
    ui.optBtn.addEventListener('click', openOpts);
    btns.appendChild(ui.optBtn);

    /* MOBILE BUDGET. Measured on an iPhone 13 (390x664): #topbar keeps 118px and #mtabs 55,
     * so the pane is 469. The full desktop footer wrapped to THREE rows (140px) and the
     * 20-button pad takes 178 — between them the stage was left 49px and the cube rendered
     * at 33px. So the phone gets only what it cannot do without: the mode segment, ⚙, undo,
     * rewind and apply, on one row, with icon labels.
     *   - 뒷면 비추기 is dropped because it already lives in the ⚙ panel;
     *   - 전체화면 is dropped because iOS Safari does not implement requestFullscreen() on
     *     elements at all, so on the platform that matters it was a button that did nothing.
     * Both remain on desktop, where the row is free. */
    var mob = isMobile();

    if (!mob) {
      ui.xrayBtn = mkBtn('btn', '', function () { setXray(!xrayOn()); });
      btns.appendChild(ui.xrayBtn);

      /* A keyboard legend on a keyboard-less device is dead weight — and the row it eats is
       * the row the pad wants. Removed outright on mobile, not merely hidden. */
      ui.legendBtn = mkBtn('btn', '', function () { setLegend(!legendOn()); });
      btns.appendChild(ui.legendBtn);
    }

    ui.undoBtn = mkBtn('btn', mob ? '↶' : T('vcubeUndo', '되돌리기', 'undo'), function () { undo(); });
    ui.undoBtn.title = mob
      ? T('vcubeUndoTM', '한 수 되돌리기', 'undo one move')
      : T('vcubeUndoT', '한 수 되돌리기 (Backspace)', 'undo one move (Backspace)');
    ui.undoBtn.setAttribute('aria-label', ui.undoBtn.title);
    btns.appendChild(ui.undoBtn);

    ui.rewindBtn = mkBtn('btn', mob ? '⟲' : T('vcubeRewind', '스크램블로', 'to scramble'), rewind);
    ui.rewindBtn.title = T('vcubeRewindT', '한 수씩 되감아 스크램블 상태로 돌아갑니다',
      'replay every move backwards to the scrambled state');
    ui.rewindBtn.setAttribute('aria-label', ui.rewindBtn.title);
    btns.appendChild(ui.rewindBtn);

    if (!mob) {
      ui.fullBtn = mkBtn('btn', '', toggleFull);
      btns.appendChild(ui.fullBtn);
    }

    /* While a solve is live this button IS the cancel. It used to error with "Esc 로
     * 취소하세요" — which on a phone names a key that does not exist, and left a running
     * mobile solve with no way out at all short of solving it. Same confirm-then-DNF path
     * as Esc, so the two agree. */
    ui.applyBtn = mkBtn('btn primary', '', function () {
      /* Same drain-before-deciding rule as Space. Closes the mobile half of the race: a fast
       * double-tap of 적용 with both taps inside the drain window used to reach endAttempt()
       * through cancelAttempt()'s 2s arm and DNF a finished solve. */
      settleNow();
      if (st.phase === 'running') { cancelAttempt(); return; }
      applyScramble();
    });
    syncApplyBtn();
    btns.appendChild(ui.applyBtn);
    foot.appendChild(btns);
    body.appendChild(foot);

    ui.legend = document.createElement('div'); ui.legend.className = 'vcLegend';
    body.appendChild(ui.legend);

    ui.bad = document.createElement('div'); ui.bad.className = 'vcBad';
    ui.bad.style.display = 'none';
    body.appendChild(ui.bad);

    buildLegend();
    syncXrayBtn(); syncLegend(); syncFull(); syncSeg(); syncQuick();
  }

  /* ---- mobile pad ----
   * 12 buttons (U/R/F/D/L/B + primes) is a puzzle simulator, not a cube. No y means you
   * cannot re-front the cube, so you solve in a fixed orientation and every tutorial stops
   * matching. No M means no PLL finger-trick patterns, no M2 edge pairing, nothing Roux.
   * Desktop gets 40+ bindings; mobile got 12. Long-press gives the 2 variant, which also
   * stops U-tapped-twice inflating the move count and losing your place mid-alg.
   * tupleToToken already emits every one of these tokens, so the engine needs no work.
   * (PAD_ROW1 / PAD_ROW2 are declared up in the pure section, so the self-test can check
   * every button prints a token the facelet model actually accepts.) */
  function buildPad() {
    ui.pad.textContent = '';
    ui.padX.textContent = '';
    function cap(tok) {
      var b = document.createElement('button');
      b.className = 'btn';
      b.textContent = tok;
      var lp = 0, fired = false;
      function go(t) { doMove(t, isRotToken(t), Date.now()); }
      b.addEventListener('pointerdown', function () {
        fired = false;
        lp = setTimeout(function () { fired = true; go(tok + '2'); }, 300);
      });
      b.addEventListener('pointerup', function () { clearTimeout(lp); if (!fired) go(tok); });
      b.addEventListener('pointercancel', function () { clearTimeout(lp); fired = true; });
      b.addEventListener('pointerleave', function () { clearTimeout(lp); fired = true; });
      return b;
    }
    /* rows 1-2 (6-up): the six faces, then their primes */
    PAD_ROW1.forEach(function (f) { ui.pad.appendChild(cap(f)); });
    PAD_ROW1.forEach(function (f) { ui.pad.appendChild(cap(f + "'")); });
    /* row 3 (8-up): the moves that make this a cube rather than a simulator */
    PAD_ROW2.forEach(function (t) { ui.padX.appendChild(cap(t)); });
    PAD_ROW2.forEach(function (t) { ui.padX.appendChild(cap(t + "'")); });
  }
  function isRotToken(tok) { return /^[xyz]/.test(tok); }

  /* ---- keycap legend ----
   * The old widget was csTimer's funcmap as four rows of monospace ASCII with
   * white-space:pre and overflow-x:auto — next to Toss cards and a 54px LCD it read like
   * stdout somebody forgot to delete, and it was bad at its only job: you had to count
   * characters across to line a key up with its move. It also showed all 40 bindings to a
   * beginner who needs exactly 12. */
  function capEl(move, key) {
    var s = document.createElement('span'); s.className = 'vcCap';
    var b = document.createElement('b'); b.textContent = move;
    var i = document.createElement('i'); i.textContent = key;
    s.appendChild(b); s.appendChild(i);
    return s;
  }

  function buildLegend() {
    if (!ui.legend) return;
    ui.legend.textContent = '';
    var full = legendTier() === 'full';

    /* Every section is ONE row: an inline header, its keycaps, and optionally a trailing
     * element. Stacking headers on their own lines is what made this thing 189px tall. */
    function section(title, list, tail) {
      var r = document.createElement('div'); r.className = 'vcLegRow';
      var h = document.createElement('div'); h.className = 'vcLegHd'; h.textContent = title;
      r.appendChild(h);
      list.forEach(function (p) { r.appendChild(capEl(p[0], p[1])); });
      if (tail) r.appendChild(tail);
      ui.legend.appendChild(r);
      return r;
    }
    function tierBtn(label, tier) {
      var b = document.createElement('button');
      b.className = 'vcLegMore';
      b.textContent = label;
      b.addEventListener('click', function () {
        setPref('legtier', tier); buildLegend(); fitCanvas();
      });
      return b;
    }

    section(T('vcubeLegFace', '기초', 'basics'), BASIC);

    /* Our own bindings are NOT in csTimer's funcmap, so a verbatim copy of it would
     * silently omit every key this pack added. The 고급 toggle rides on the end of this
     * row rather than taking a line of its own. */
    section(T('vcubeLegOurs', '추가', 'added'), [
      [T('vcubeCapPeek', '밑면', 'peek D'), 'Shift'],
      [T('vcubeCapHome', '시점', 'view'), '`'],
      [T('vcubeCapUndo', '취소', 'undo'), 'Bksp'],
      ['+2', '['], ['DNF', ']'],
      [T('vcubeCapArm', '스크램블', 'apply'), 'Space']
    ], full
      ? tierBtn(T('vcubeLegLess', '기초만 ▴', 'basics only ▴'), 'basic')
      : tierBtn(T('vcubeLegMore', '고급 키 (슬라이스 · 와이드 · 회전) ▾',
        'advanced (slices · wide · rotations) ▾'), 'full'));

    if (full) {
      section(T('vcubeLegSlice', '슬라이스', 'slices'), ADV_SLICE);
      section(T('vcubeLegWide', '와이드', 'wide'), ADV_WIDE);
      section(T('vcubeLegRot', '회전', 'rotations'), ADV_ROT);
      section(T('vcubeLegWidth', '블록(4x4+)', 'block (4x4+)'), [
        [T('vcubeCapLdec', 'L −', 'L −'), '3'], [T('vcubeCapLinc', 'L +', 'L +'), '4'],
        [T('vcubeCapRinc', 'R +', 'R +'), '7'], [T('vcubeCapRdec', 'R −', 'R −'), '8']
      ]);
    }

    /* The one thing that makes the map stick, and the thing the old table never said. */
    var note = document.createElement('div'); note.className = 'vcLegNote';
    note.textContent = T('vcubeLegNote',
      '키는 손가락 트릭을 흉내냅니다 — J 가 U 인 이유는 실제로 U 를 튕기는 손가락이 오른손 검지이기 때문입니다.',
      'the keys mimic fingertricks — J is U because your right index finger is the one that flicks U.');
    ui.legend.appendChild(note);
  }

  /* (Re)build the play UI inside `container`. Cheap no-op when it is already there. */
  function buildInto(container) {
    if (host === container && ui.stage && ui.stage.parentNode) return;
    container.textContent = '';
    ui = {};
    buildPlay(container);
    host = container;
    /* In the pane the app's own scramble bar is right above us (#topbar stays visible in
     * the cube view — desktop.css and mobile.css both keep it), so our copy is a duplicate
     * eating the vertical space the cube wants. The modal has no such neighbour, and keeps it. */
    if (ui.scr) ui.scr.style.display = isPaneHost() ? 'none' : '';
    if (ui.head) ui.head.classList.toggle('vcHeadBare', isPaneHost());
    /* The ✕ is for the DESKTOP pane, which has no chrome of its own. The modal already has
     * one, and on mobile the tab bar is the way out — worse, mobile has no data-cubeview to
     * clear, so leave() there would empty #cubePane and leave the 큐브 tab blank with no way
     * back. (The old `isPaneHost() ? '' : 'none'` predates the desktop becoming a pane too,
     * so it had started showing the button on both panes.) */
    if (ui.close) ui.close.style.display = (isPaneHost() && !isMobile()) ? '' : 'none';
  }

  /* NB: must NOT be expressed as `host !== M.body` — App.registerModal() invokes its build
   * callback synchronously, i.e. while `M` is still null on the left of the assignment, so
   * the modal's own body would be misread as a pane and lose its scramble line. Track the
   * body element directly, set before the build runs. */
  function isPaneHost() { return !!host && host !== modalBody; }

  /* ============================== live prefs ============================== */
  function setXray(on) { setPref('xray', on ? '1' : '0'); syncXray(); }
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
  function setGap(v) {
    setPref('gap', v);
    if (eng && eng.setXrayGap) eng.setXrayGap(v);
  }
  function setLegend(on) { setPref('legend', on ? '1' : '0'); syncLegend(); fitCanvas(); }
  function syncLegend() {
    var on = legendOn() && !isMobile();
    if (ui.legendBtn) {
      ui.legendBtn.textContent = on
        ? T('vcubeKeysOff', '키 숨기기', 'hide keys')
        : T('vcubeKeysOn', '키 보기', 'keys');
      ui.legendBtn.classList.toggle('primary', on);
    }
    if (ui.legend) ui.legend.classList.toggle('on', !!(on && st.n));
  }
  function setSpeed(tps) {
    setPref('tps', tps);
    if (eng && eng.setDuration) eng.setDuration(durationMs());
  }
  function setPalette(id) {
    setPref('pal', id);
    var NNN = window.ScrImage && window.ScrImage.nnn;
    /* Colour DATA lives in draw_nnn.js; this pack owns no hexes. Its setPalette() rebinds
     * both its internal COLORS and api.colors — and api.colors is what the 3D engine reads
     * as its default palette — so the 2D net and the cube change together from one array.
     * Do NOT mutate the arrays: api.colors and palettes[i].colors are the same reference. */
    if (NNN && NNN.setPalette) NNN.setPalette(id);
    if (eng && eng.setPalette && !(st.bld && st.phase === 'running')) {
      var c = paletteColors();
      if (c) eng.setPalette(c);
    }
    App.refresh && App.refresh();   // renderStats() ends in a tool render → repaints the 2D image
    drawNet();
  }
  function setMode(m) {
    if (st.phase === 'running') {
      App.toast && App.toast(T('vcubeModeRun', '측정 중에는 모드를 바꿀 수 없어요',
        'cannot switch mode mid-solve'), { type: 'error' });
      return;
    }
    setPref('mode', m);
    syncSeg();
    /* 연습 must never create or switch sessions; 기록 must be back in the right one */
    if (m === 'practice') exitVSession(); else enterVSession();
    armSolved();
  }
  function syncSeg() {
    if (!ui.segRec) return;
    var p = playMode() === 'practice';
    ui.segRec.classList.toggle('on', !p);
    ui.segPra.classList.toggle('on', p);
  }
  function setNet(on) { setPref('net', on ? '1' : '0'); syncNet(); }
  function syncNet() {
    if (!ui.net) return;
    /* during a BLD attempt the net would be a cheat sheet */
    var show = !!(netOn() && st.n && !bldHiding());
    ui.net.classList.toggle('on', show);
    if (show) drawNet();
  }
  function drawNet() {
    if (!ui.net || !ui.netCv || !eng || !ui.net.classList.contains('on')) return;
    var NNN = window.ScrImage && window.ScrImage.nnn;
    if (!NNN || !NNN.drawState) return;
    var u = st.n <= 3 ? 9 : st.n <= 5 ? 7 : 5;
    var w = 4 * st.n * u + 12, h = 3 * st.n * u + 12;
    if (ui.netCv.width !== w) { ui.netCv.width = w; ui.netCv.height = h; }
    ui.netCv.style.width = w + 'px'; ui.netCv.style.height = h + 'px';
    /* getState() hands back exactly the [6][n*n] U,R,F,D,L,B array drawState() wants */
    try { NNN.drawState(ui.netCv, eng.getState(), st.n); } catch (e) { }
  }
  function syncStat() { if (ui.stat) ui.stat.style.display = statOn() ? '' : 'none'; }

  /* ---- cube-only fullscreen ---- */
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
        if (!vis && st.open && host === modalBody) { exitVSession(); teardownPlay(); }
      }).observe(modalEl, { attributes: true, attributeFilter: ['class'] });
    }
    return M;
  }

  function setHint(html) { if (ui.hint) ui.hint.innerHTML = html; }
  /* Every hint that names a key needs a touch twin. Desktop copy leaking into the mobile
   * view is what left a first-time phone user staring at a solved cube being told to press
   * Space; 'Esc 로 취소합니다' while solving on a phone was the same bug one screen later. */
  function hint2(k, ko, en, koM, enM) {
    return isMobile() ? T(k + 'M', koM, enM) : T(k, ko, en);
  }

  /* ============================== framing ==============================
   * MEASURED, not guessed — a playwright pixel-scan of the real engine over n=2..7 and
   * every orbitable view (scratchpad/pack/probe.js):
   *   - at the home view the cube's drawn box sits at top 0.085 / bottom 0.020 of the
   *     canvas side. It is NOT centred: perspective pushes the near bottom corner down, so
   *     flex-centring the CANVAS leaves ~4x more air above the cube than below it, and the
   *     bottom-front corner ran straight into the hint that used to be pinned in the stage;
   *   - the smallest vertical margin ANY view produces is 0.010 (at yaw±45 / pitch±45);
   *   - the fractions are cube-size invariant (the engine's distance scales with n), so one
   *     constant pair covers 2x2 through 7x7.
   * So: centre by the DRAWN box, not the canvas box, and clamp the correction by the
   * worst-case margin so no orbit can push the cube out of an overflow:hidden stage.
   *
   * NOT a bug, and deliberately not "fixed": the backing store is 2x the CSS box at dpr=2 —
   * the cube is correctly retina-crisp. Nor is the unused width on a landscape stage: the
   * projection scales on min(W,H), so a wider canvas cannot make a cube any bigger. */
  var FRAME = { top: 0.085, bot: 0.020, minMargin: 0.010 };
  var GUTTER = 8;

  function fitCanvas() {
    if (!ui.stage || !ui.canvas || !eng) return;
    var w = ui.stage.clientWidth, h = ui.stage.clientHeight;
    if (!w || !h) return;
    /* Math.max(160, ...) was a FLOOR that let the canvas exceed its own stage — which is
     * what rendered a 160px cube into a 40px stage on a landscape phone. A canvas may be 0. */
    var side = Math.max(0, Math.floor(Math.min(w, h) - GUTTER * 2));
    ui.canvas.style.width = side + 'px';
    ui.canvas.style.height = side + 'px';

    var top = (h - side) / 2;
    var ideal = side * (FRAME.top - FRAME.bot) / 2;   // what centring the drawn box wants
    var safe = top + side * FRAME.minMargin - 2;      // what the tightest orbit still allows
    ui.canvas.style.left = Math.round((w - side) / 2) + 'px';
    ui.canvas.style.top = Math.round(top - Math.max(0, Math.min(ideal, safe))) + 'px';
    eng.render();
  }
  window.addEventListener('resize', function () { if (st.open) fitCanvas(); });

  /* A window resize is not enough for the pane: the stage also changes size when the tab
   * bar / scramble bar reflow, when the legend opens, or when the phone rotates, with no
   * window event we can use. Watch the stage box itself. */
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
    ui.scr.appendChild(document.createTextNode(bldHiding() ? '— BLD —' : s));
  }
  function bldHiding() { return !!(st.bld && st.phase === 'running'); }
  function syncBldHide() {
    document.body.classList.toggle('vcBldRun', !!(st.open && bldHiding()));
  }

  /* ---- timer / readout ---- */
  function lcd(txt, cls) {
    if (!ui.lcd) return;
    ui.lcd.textContent = txt;
    ui.lcd.className = 'vcLcd' + (cls ? ' ' + cls : '');
  }
  /* A 12.4 at 48 moves / 4.0 TPS (efficient, drill turn speed) and a 12.4 at 68 moves /
   * 5.5 TPS (turning fast, solving badly) demand OPPOSITE training responses, and this app
   * rendered them identically. Move count is THE number that tells a sub-15 cuber which to
   * drill; for OH it is the whole diagnosis, since OH is won on efficiency, not TPS. */
  function statLine(ms) {
    if (!ui.stat) return;
    var h = htmOf(st.raw);
    if (playMode() === 'practice') {
      ui.stat.textContent = h + ' ' + T('vcubeMoves', '수', 'moves');
      return;
    }
    if (!h) { ui.stat.textContent = ''; return; }
    var t = tpsOf(h, ms);
    ui.stat.textContent = h + ' ' + T('vcubeMoves', '수', 'moves') +
      (t ? ' · ' + t.toFixed(1) + ' TPS' : '');
  }
  function stopLoop() { if (st.raf) { cancelAnimationFrame(st.raf); st.raf = 0; } }
  function loop() {
    st.raf = 0;
    if (!st.open) return;
    if (st.phase === 'running') {
      var el = Date.now() - st.startTs;
      lcd(fmt(el), 'run');
      statLine(el);
    } else if (st.phase === 'inspect') {
      var e2 = (Date.now() - st.insStart) / 1000;
      var left = 15 - e2;
      lcd(left > 0 ? String(Math.ceil(left)) : (e2 > 17 ? 'DNF' : '+2'),
        e2 > 17 ? 'bad' : e2 > 15 ? 'warn' : '');
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
    setHint(hint2('vcubeGo',
      '측정 중 — <b>Esc</b> 로 취소합니다.', 'solving — <b>Esc</b> to cancel.',
      '측정 중 — 다 맞추면 자동으로 기록됩니다.', 'solving — it records itself when you solve it.'));
    /* BLD: grey every sticker. Safe and free — isSolved() reads the facelet INDEX array,
     * not the palette, so the solve detector is completely untouched. */
    if (st.bld && eng && eng.setPalette) eng.setPalette(BLD_GREY);
    syncBldHide(); showScramble(); syncNet();
    syncApplyBtn();
    stopLoop(); loop();
  }

  /* Records the solve.
   * NOTE: the old code preferred an App.startTimer/App.stopTimer "external mode" contract.
   * Neither is exported by app.js (they are module-private — grep the window.App literal),
   * so that branch was dead on every path and `st.coreStarted` was permanently false.
   * Dropped. App.addSolve is the real door, and it is the core's own recorder, so PB
   * detection, the confetti, the 'pb'/'solve' events and the next scramble come free. */
  function record(pen, ms) {
    if (recMode() === 'off' || playMode() === 'practice') return null;
    /* The companion session is born HERE, at the first solve that will actually go into it —
     * not when the cube is merely opened. Safe to switch this late: enterVSession() does not
     * touch the scramble, so App.addSolve() below still stamps the one that was solved. */
    enterVSession(null, true);
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

  /* Stamp the solve we just wrote: a {vc:1} badge in the extra slot, so a virtual solve is
   * identifiable even inside its own session; and the move/TPS summary in the comment,
   * because the post-mortem has to survive the session, not just the LCD.
   *
   * NB the badge is applied HERE and not from App.on('solve'): that event fires for every
   * solve the core records, including the ones you typed in by hand on the real timer, and
   * branding those as virtual would be a worse lie than not tagging at all. */
  function stampSolve(ms) {
    var db = App.db && App.db();
    var solves = App.solves && App.solves();
    if (!db || !solves || !solves.length) return;
    var i = solves.length - 1;
    st.doneIdx = i;
    st.doneSid = db.current;
    var h = htmOf(st.raw);
    var t = tpsOf(h, ms);
    var summary = h ? (h + ' moves' + (t ? ' · ' + t.toFixed(1) + ' TPS' : '')) : '';
    if (!App.updateSolve) return;
    try {
      App.updateSolve(i, function (s) {
        s[4] = { vc: 1 };
        if (summary && !s[2]) s[2] = summary;
      });
    } catch (e) { }
  }

  function finish(ts) {
    /* Guard: only a running attempt can be solved. Protects against onSolved firing for a
     * cube that was never scrambled, and against a second fire after we already recorded. */
    if (st.phase !== 'running') return;
    var ms = Math.max(0, Math.round(ts - st.startTs));
    st.phase = 'done';
    stopLoop();
    var pen = st.pen; st.pen = 0;
    lcd(pen === -1 ? 'DNF' : fmt(ms) + (pen > 0 ? '+' : ''), 'vcDone');
    statLine(ms);
    restorePalette(); syncApplyBtn();
    syncBldHide(); showScramble(); syncNet();
    if (record(pen, ms)) {
      stampSolve(ms);
      /* The old code fired a "가상 큐브 기록 저장됨" toast here unconditionally: 50 reps =
       * 50 toasts sitting on top of the hint line, saying what the green LCD already says. */
      setHint(hint2('vcubeSolved',
        '완성! <b>Space</b> 다음 스크램블 · <b>[</b> +2 · <b>]</b> DNF',
        'solved! <b>Space</b> next scramble · <b>[</b> +2 · <b>]</b> DNF',
        '완성! <b>적용</b>으로 다음 스크램블 — 아래에서 +2 / DNF 를 매길 수 있어요.',
        'solved! <b>apply</b> for the next scramble — +2 / DNF are below.'));
    } else {
      setHint(hint2('vcubeSolvedNR',
        '완성! (기록하지 않음) <b>Space</b> 로 다음 스크램블',
        'solved! (not recorded) <b>Space</b> for the next scramble',
        '완성! (기록하지 않음) <b>적용</b>으로 다음 스크램블',
        'solved! (not recorded) tap <b>apply</b> for the next scramble'));
    }
    syncQuick();
    if (autoNext() && playMode() !== 'practice') setTimeout(function () {
      if (st.open && st.phase === 'done') applyScramble();
    }, 900);
  }

  function restorePalette() {
    if (!eng || !eng.setPalette) return;
    var c = paletteColors();
    if (c) eng.setPalette(c);
  }

  function abort(silent) {
    var wasRunning = st.phase === 'running';
    st.phase = 'idle'; st.pen = 0; st.escAt = 0;
    stopLoop();
    lcd('0.00', '');
    restorePalette();
    syncBldHide(); syncApplyBtn();
    if (wasRunning && !silent) {
      App.toast && App.toast(T('vcubeAbort', '솔브 취소됨', 'solve discarded'));
    }
  }

  /* Giving up on a live attempt is a DNF, not a solve that never happened — for BLD ~half
   * of all attempts are DNFs and accuracy IS the metric, so a session showing six clean
   * solves and a beautiful mean is fiction.
   *
   * AND THE CUBE IS LEFT EXACTLY WHERE IT STOPPED. The ending state after a failure is the
   * whole post-mortem: two twisted corners = misread orientation, a 3-cycle = one bad letter
   * pair, two centres = parity. eng.setState('') threw away the only information the failure
   * produced. We also do not close the view — re-opening it ~15 times a session was insult
   * on top. Next Space re-arms to solved, exactly as it already did. */
  /* Settle the animation backlog BEFORE reading st.phase. Call this at the top of every
   * branch that decides something from the phase machine (Space, Esc, the mobile apply
   * button). Nothing else in this file may read st.phase while eng.pending() > 0.
   *
   * WHY: state applies instantly at turn() time but onSolved fires as the queue DRAINS, so
   * for the length of the backlog (~100ms at the default 10 TPS with a ~3-move burst) the
   * cube IS solved while st.phase is still 'running'. Space is the documented next-scramble
   * key AND the running-solve DNF key, so last-move -> Space — pure muscle memory at rep 30
   * — used to hit endAttempt() and record pen=-1 over a finished solve. Worse, the DNF won
   * permanently: endAttempt() set phase='done', so when the queue finally drained finish()
   * bailed on `if (st.phase !== 'running') return;` and the real time was never recorded.
   *
   * eng.flush() replays the pending settles in order with their original KEYPRESS stamps, so
   * finish() still records the time you earned, not the time you pressed Space. */
  function settleNow() {
    if (eng && eng.flush && eng.pending && eng.pending() > 0) eng.flush();
  }

  function endAttempt() {
    if (st.phase !== 'running') return;
    var ms = Math.max(0, Math.round(Date.now() - st.startTs));
    st.phase = 'done';
    stopLoop();
    st.pen = 0; st.escAt = 0;
    lcd('DNF', 'vcDone');
    statLine(ms);
    restorePalette(); syncApplyBtn();
    syncBldHide(); showScramble(); syncNet();
    if (record(-1, ms)) {
      stampSolve(ms);
      setHint(hint2('vcubeEnded',
        'DNF 로 기록했습니다 — 이 상태를 보고 원인을 확인하세요. <b>Space</b> 다음 스크램블',
        'recorded as DNF — read this state to find out why. <b>Space</b> for the next scramble',
        'DNF 로 기록했습니다 — 이 상태를 보고 원인을 확인하세요. <b>적용</b>으로 다음 스크램블',
        'recorded as DNF — read this state to find out why. <b>apply</b> for the next scramble'));
    } else {
      setHint(hint2('vcubeEndedNR',
        '취소했습니다 (기록하지 않음). <b>Space</b> 다음 스크램블',
        'cancelled (not recorded). <b>Space</b> for the next scramble',
        '취소했습니다 (기록하지 않음). <b>적용</b>으로 다음 스크램블',
        'cancelled (not recorded). tap <b>apply</b> for the next scramble'));
    }
    syncQuick();
  }

  /* Cancelling a live attempt, from Esc (desktop) or the 취소 button (mobile). A 20s attempt
   * must not evaporate on one misfired keystroke, so the first call only arms. */
  function cancelAttempt() {
    if (st.phase !== 'running') return;
    var now = Date.now();
    if (now - st.escAt > 2000) {
      st.escAt = now;
      App.toast && App.toast(isMobile()
        ? T('vcubeEscArmM', '솔브를 취소할까요? (한 번 더 누르면 DNF 로 기록)',
          'cancel this solve? (tap again → recorded as DNF)')
        : T('vcubeEscArm', '솔브를 취소할까요? (Esc 한 번 더 → DNF 기록)',
          'cancel this solve? (Esc again → recorded as DNF)'));
      return;
    }
    endAttempt();
  }

  function syncApplyBtn() {
    if (!ui.applyBtn) return;
    var run = st.phase === 'running';
    ui.applyBtn.textContent = run
      ? T('vcubeCancel', '취소', 'cancel')
      : isMobile() ? T('vcubeResetShort', '적용', 'apply')
        : T('vcubeReset', '스크램블 적용', 'apply scramble');
    ui.applyBtn.className = 'btn ' + (run ? 'danger' : 'primary');
  }

  /* ---- inline +2 / DNF / delete ----
   * At rep 30 your fingers cross and you turn R instead of R'. The solve still completes so
   * a time gets recorded, but it is not your time. The core's flow was: ✕ out of the view,
   * hunt the row in the list, DNF, re-enter via the menu button — and your camera angle is
   * gone. Four actions plus a re-frame, for something that should be one key. */
  function syncQuick() {
    if (ui.quick) ui.quick.classList.toggle('on', st.doneIdx != null);
  }
  function quickTarget() {
    if (st.doneIdx == null) return -1;
    var db = App.db && App.db();
    /* The session may have moved under us (an event switch, or the user picking another
     * session from the dropdown). A penalty applied to the wrong session's row is worse
     * than no penalty at all. */
    if (db && st.doneSid && db.current !== st.doneSid) return -1;
    var solves = App.solves && App.solves();
    if (!solves || !solves[st.doneIdx]) return -1;
    return st.doneIdx;
  }
  function setPen(pen) {
    var i = quickTarget();
    if (i < 0) { st.doneIdx = null; syncQuick(); return; }
    if (!App.updateSolve) return;
    App.updateSolve(i, function (s) { s[0][0] = pen; });
    var s = App.solves()[i];
    lcd(pen === -1 ? 'DNF' : fmt(s[0][1]) + (pen > 0 ? '+' : ''), 'vcDone');
    App.toast && App.toast(pen === -1 ? 'DNF' : pen > 0 ? '+2'
      : T('vcubeOk', '패널티 해제', 'penalty cleared'));
  }
  function delLast() {
    var i = quickTarget();
    if (i < 0) { st.doneIdx = null; syncQuick(); return; }
    if (App.deleteSolve) App.deleteSolve(i);
    st.doneIdx = null; st.doneSid = null;
    syncQuick();
    lcd('0.00', '');
  }

  /* Leave the cube. */
  function leave() {
    exitVSession();
    if (cubeViewOpen()) { closeCubeView(); return; }
    unmount();
    App.closeModals && App.closeModals();
  }

  /* ---- moves ---- */
  function doMove(token, rotation, ts) {
    if (!eng || !token) return;
    /* `if (st.phase === 'done') return;` used to live here: after a recorded solve, the cube
     * you had just solved could not be touched. That is nonsense on a virtual cube whose
     * entire structural advantage over plastic is that state is free. Fall back to free play
     * instead of freezing. The quickbar survives because it is gated on st.doneIdx, not on
     * the phase — so you can fiddle with the cube and still DNF the rep you just did. */
    if (st.phase === 'done') { st.phase = 'idle'; setHint(freeHint()); }
    /* csTimer: rotations never start the timer (they are inspection-legal); the first
     * non-rotation move does, stamped at the KEYPRESS, not at animation end.
     * BLD is the exception — you are already holding the cube, so orientation is part of the
     * solve and ANY move starts it. */
    if (st.phase === 'inspect' || st.phase === 'ready') {
      if (!rotation || st.bld) startRun(ts);
    }
    st.raw.push({ token: token, rot: !!rotation, ts: ts });
    st.redo.length = 0;
    eng.turn(token, ts);
    if (st.phase !== 'running') statLine(0);
    drawNet();
  }

  /* ---- undo / redo ----
   * Refusing to model the most basic physical affordance of a cube was the single least
   * cuber-like thing this app did. Beginner: "I don't even know what I pressed and layer 1
   * is gone" — the tab-close moment. Speedcuber: misfires are 5-10% of reps at speed, and
   * the only options were typing the inverse by hand (silently polluting the move count and
   * the reconstruction) or Esc (binning the attempt). On plastic, turning it back costs half
   * a second. Legal DURING a running solve — turning back is physically legal, and the clock
   * keeps running, which is the honest cost. */
  function undo() {
    if (!eng) return;
    if (!st.raw.length) {
      /* refuse past the scramble baseline */
      App.toast && App.toast(T('vcubeUndoNone', '되돌릴 수가 없어요 (스크램블 상태)',
        'nothing to undo — this is the scrambled state'));
      return;
    }
    if (st.phase === 'done') { st.phase = 'idle'; setHint(freeHint()); }
    var m = st.raw.pop();
    st.redo.push(m);
    eng.turn(invertToken(m.token), Date.now());
    statLine(st.phase === 'running' ? Date.now() - st.startTs : 0);
    drawNet();
  }
  function redo() {
    if (!eng || !st.redo.length) return;
    if (st.phase === 'done') { st.phase = 'idle'; setHint(freeHint()); }
    var m = st.redo.pop();
    st.raw.push(m);
    eng.turn(m.token, Date.now());
    statLine(st.phase === 'running' ? Date.now() - st.startTs : 0);
    drawNet();
  }
  /* Replay the whole stack inverted, so a wrecked cube is recoverable without burning the
   * scramble. Instant (duration 0): 60 animated undos is a cutscene, not a feature. */
  function rewind() {
    if (!eng || !st.raw.length) {
      App.toast && App.toast(T('vcubeUndoNone', '되돌릴 수가 없어요 (스크램블 상태)',
        'nothing to undo — this is the scrambled state'));
      return;
    }
    var d = durationMs();
    if (eng.setDuration) eng.setDuration(0);
    while (st.raw.length) {
      var m = st.raw.pop();
      st.redo.push(m);
      eng.turn(invertToken(m.token), Date.now());
    }
    if (eng.setDuration) eng.setDuration(d);
    /* a rewound attempt is not an attempt any more — re-arm rather than leave a live clock */
    if (st.phase === 'running') { abort(true); armReady(); }
    else if (st.phase === 'done') { st.phase = 'ready'; }
    statLine(0);
    drawNet();
    setHint(T('vcubeRewound', '스크램블 상태로 되돌렸습니다.', 'back to the scrambled state.'));
  }

  /* ---- arming ----
   * csTimer applies the scramble on SPACE, not on open: the cube sits SOLVED until you ask
   * for it. Applying on open left Space re-applying the same scramble onto an already
   * scrambled cube — visually a no-op, so Space looked broken. */
  function resetMoves() { st.raw = []; st.redo = []; }
  function freeHint() {
    return hint2('vcubeFree',
      '연습 모드 — 자유롭게 돌려보세요. <b>Backspace</b> 되돌리기 · <b>Shift</b> 밑면 보기',
      'free play — turn away. <b>Backspace</b> undo · hold <b>Shift</b> to peek at D',
      '연습 모드 — 자유롭게 돌려보세요. <b>↶</b> 되돌리기 · 큐브를 끌면 돌려볼 수 있어요',
      'free play — turn away. <b>↶</b> undo · drag the cube to look around');
  }
  /* "Space 를 눌러..." on a device with no Space key is desktop copy leaking into the mobile
   * view — a first-time mobile user was simply stuck staring at a solved cube. */
  function armHint() {
    return isMobile()
      ? T('vcubeArmMobile', '큐브를 탭하거나 <b>적용</b>을 누르면 시작합니다.',
        'tap the cube (or <b>apply</b>) to start.')
      : T('vcubeArm', '<b>Space</b> 를 눌러 스크램블을 적용하고 시작합니다.',
        'press <b>Space</b> to apply the scramble and start.');
  }
  function armSolved() {
    if (!eng) return;
    abort(true);
    resetMoves();
    st.doneIdx = null; st.doneSid = null; syncQuick();
    eng.setState(''); // solved
    lcd('0.00', '');
    showScramble();
    st.phase = 'idle';
    statLine(0);
    syncNet();
    setHint(playMode() === 'practice' ? freeHint() : armHint());
  }
  function armReady() {
    st.phase = 'ready';
    lcd('0.00', '');
    setHint(st.bld
      ? T('vcubeReadyBld',
        '외우세요 — 첫 동작에서 타이머가 시작되고 스티커가 가려집니다. (BLD 는 인스펙션이 없습니다)',
        'memorise — the timer starts on your first move and the stickers go grey. (BLD has no inspection)')
      : T('vcubeReady', '첫 번째 회전에서 타이머가 시작됩니다.',
        'the timer starts on your first layer turn.'));
  }

  function applyScramble() {
    if (!eng) return;
    var scr = (App.scrambleStr && App.scrambleStr()) || '';
    abort(true);
    resetMoves();
    st.doneIdx = null; st.doneSid = null; syncQuick();
    /* setState() re-baselines the engine's wasSolved flag, so a scramble that happens to
     * leave the cube solved simply cannot arm a spurious onSolved. */
    eng.setState(scr);
    showScramble();
    statLine(0);
    syncNet();
    if (eng.isSolved()) {
      st.phase = 'idle';
      setHint(T('vcubeNoScr', '스크램블이 없습니다.', 'no scramble to apply.'));
      return;
    }
    /* 연습: land in free play, not in a race. A beginner pressing four keys to hunt a white
     * corner while the LCD sprints at 2.07 in accent blue is being lied to about what they
     * are doing. Free play already worked in phase 'idle'; literally nobody was told. */
    if (playMode() === 'practice') {
      st.phase = 'idle';
      lcd('0.00', '');
      setHint(freeHint());
      return;
    }
    /* WCA BLD has no inspection — memo IS your time. With the global inspection option on
     * (the default many people run) EVERY BLD attempt was a guaranteed DNF before execution
     * even started: +2 at 15s, DNF at 17s, cube untouched, while a typical 3BLD memo is
     * 40-60s. That is not rep 30, that is rep 1, and it made the event unusable. */
    if (!st.bld && App.options && App.options().inspection) {
      st.phase = 'inspect'; st.insStart = Date.now();
      stopLoop(); loop();
      setHint(T('vcubeInsp', '인스펙션 중 — 회전(x/y/z)은 타이머를 시작하지 않습니다.',
        'inspecting — rotations (x/y/z) do not start the timer.'));
      return;
    }
    armReady();
  }

  /* On a phone the stage is the only big target there is. Separated from the drag that
   * orbits by TAP_SLOP, so turning the cube never also arms it. */
  function onStageTap() {
    if (!st.n) return;
    if (st.phase === 'idle' || st.phase === 'done') applyScramble();
  }

  /* ---- keyboard ---- */
  function textFocused() {
    var a = document.activeElement;
    return !!(a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' ||
      a.tagName === 'SELECT' || a.isContentEditable));
  }
  /* As a VIEW we get no uiBlocked() protection — and conversely our own settings modal must
   * not have its keys eaten by the cube behind it. Any .modal.show that is not our play
   * modal wins the keyboard. */
  function modalBlocking() {
    var m = document.querySelector('.modal.show');
    return !!m && m !== modalEl;
  }

  function endPeek() {
    if (!st.peek) return;
    if (eng && eng.setView) eng.setView(st.peek.yaw, st.peek.pitch);
    st.peek = null;
  }
  function onKeyUp(e) {
    if (e.key === 'Shift') endPeek();
  }

  /* Capture phase on document, so we run BEFORE app.js's bubble-phase handler and can
   * stopPropagation() on the keys we consume. */
  function onKey(e) {
    if (!st.open) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;   // never steal an OS/browser chord
    if (textFocused()) return;
    if (modalBlocking()) return;
    if (e.repeat) return;

    /* Hold Shift = peek at D. Returns BEFORE doMove(), so it can never touch cube state or
     * the phase machine — which is the entire point, because the old workaround for "I need
     * to see the cross" was pressing R and silently starting the timer with an Lw'.
     * (onKey already early-returns on ctrl/alt/meta but NOT shift, so shift was free.) */
    if (e.key === 'Shift') {
      if (!eng || st.peek) return;
      st.peek = eng.getView();
      eng.setView(PEEK_VIEW.yaw, PEEK_VIEW.pitch);
      return;
    }

    if (e.code === 'Escape') {
      e.preventDefault(); e.stopPropagation();
      settleNow();
      if (st.phase === 'running') { cancelAttempt(); return; }
      /* Armed but not started: nothing has been timed, so there is nothing to record and
       * nothing to confirm — but "close the whole cube" is certainly not what Esc means
       * while you are stood over a scramble. Scrap the attempt and re-arm. */
      if (st.phase === 'inspect' || st.phase === 'ready') { armSolved(); return; }
      /* idle / done: Esc keeps its old meaning — get me out. */
      leave();
      return;
    }

    if (e.code === 'Space') {
      e.preventDefault(); e.stopPropagation();
      /* Drain first: if the solving move is still animating, the solve is DONE and Space
       * means "next scramble", not "DNF this". See settleNow(). */
      settleNow();
      if (st.phase === 'running') { endAttempt(); return; }
      applyScramble();
      return;
    }
    if (!st.n || !eng) return;

    if (e.code === 'Backspace') {
      e.preventDefault(); e.stopPropagation();
      if (e.shiftKey) redo(); else undo();
      return;
    }
    /* Every letter and every digit is csTimer's, so the camera reset had to be a spare key. */
    if (e.code === 'Backquote') {
      e.preventDefault(); e.stopPropagation();
      endPeek();
      var hv = homeView();
      eng.setView(hv.yaw, hv.pitch);
      return;
    }
    /* +2 / DNF live only while a recorded solve is on the table, so they cannot misfire
     * mid-solve and cannot collide with the K table or WIDTH_KEYS. Backspace is deliberately
     * NOT delete-solve: undo and delete on one key in adjacent phases is a footgun. */
    if (e.code === 'BracketLeft' || e.code === 'BracketRight') {
      if (st.doneIdx == null) return;
      e.preventDefault(); e.stopPropagation();
      setPen(e.code === 'BracketLeft' ? 2000 : -1);
      return;
    }

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

  /* ============================== SETTINGS ==============================
   * The user asked for this in so many words: "큐브할때 환경설정 따로 만들어".
   *
   * Why a modal and not a settings PAGE: registerOptionRow's pageId is a fixed enum
   * (optPgTimer|optPgDisplay|optPgScramble|optPgStats|optPgData|optPgAbout). app.js's
   * implementation is literally `var pg = $(pageId); if (pg) buildFn(pg);` — an id that is
   * not already in index.html silently no-ops. A dedicated option page is not buildable
   * from a pack without editing core files (API.md rule 1).
   *
   * It is reachable FROM the cube view (the ⚙ in the footer) because that is the whole
   * point: cube settings have a different lifetime from timer settings — you tune palette
   * and turn speed WHILE looking at the cube. Everything applies live, on change. */
  function orow(label, hint) {
    var r = document.createElement('label'); r.className = 'orow';
    var s = document.createElement('span');
    s.textContent = label;
    if (hint) {
      var small = document.createElement('small');
      small.className = 'vcOptRowSub';
      small.textContent = hint;
      s.appendChild(small);
    }
    r.appendChild(s);
    return r;
  }
  function selEl(opts, val, fn) {
    var s = document.createElement('select');
    opts.forEach(function (o) {
      var op = document.createElement('option');
      op.value = o[0]; op.textContent = o[1];
      s.appendChild(op);
    });
    s.value = val;
    s.addEventListener('change', function () { fn(s.value); });
    return s;
  }
  function swEl(on, fn) {
    var w = document.createElement('span'); w.className = 'tswitch';
    var i = document.createElement('input'); i.type = 'checkbox'; i.checked = !!on;
    var b = document.createElement('i');
    i.addEventListener('change', function () { fn(i.checked); });
    w.appendChild(i); w.appendChild(b);
    return w;
  }
  function sect(body, txt) {
    var d = document.createElement('div'); d.className = 'vcOptSec'; d.textContent = txt;
    body.appendChild(d);
  }
  function hintEl(body, txt) {
    var d = document.createElement('div'); d.className = 'vcOptHint'; d.textContent = txt;
    body.appendChild(d);
  }

  function buildOpts(body) {
    body.textContent = '';

    /* ---- recording ---- */
    sect(body, T('vcubeOptRec', '기록', 'recording'));
    var r1 = orow(T('vcubeOptWhere', '기록 저장 위치', 'where solves go'));
    r1.appendChild(selEl([
      ['session', T('vcubeRecSess', '가상 세션으로 분리 (기본)', 'a separate virtual session (default)')],
      ['current', T('vcubeRecCur', '현재 세션에 함께 (csTimer 방식)', 'the current session (csTimer parity)')],
      ['off', T('vcubeRecOff', '저장 안 함', 'do not record')]
    ], recMode(), function (v) {
      setPref('rec', v);
      if (v === 'session') enterVSession(); else exitVSession();
      buildOpts(body);
    }));
    body.appendChild(r1);
    hintEl(body, T('vcubeOptWhereHint',
      '키보드 1.3초 기록이 손 큐브 14초 세션에 섞이면 PB·ao5·평균이 전부 망가집니다. 기본값은 종목별 전용 "가상" 세션입니다.',
      'a 1.3s keyboard solve inside a 14s hand session wrecks that session’s PB, ao5 and mean. The default is a per-event companion session.'));

    var r2 = orow(T('vcubeOptAuto', '완료 후 자동으로 다음 스크램블', 'auto-apply the next scramble'));
    r2.appendChild(swEl(autoNext(), function (v) { setPref('autonext', v ? '1' : '0'); }));
    body.appendChild(r2);

    /* ---- look ---- */
    sect(body, T('vcubeOptLook', '보기', 'look'));
    var pal = [];
    var NNN = window.ScrImage && window.ScrImage.nnn;
    (NNN && NNN.palettes ? NNN.palettes : []).forEach(function (p) {
      pal.push([p.id, T('pal_' + p.id, p.ko, p.en)]);
    });
    if (pal.length) {
      var r3 = orow(T('vcubeOptPal', '색상 팔레트', 'colour palette'),
        T('vcubeOptPalHint', '2D 스크램블 그림도 함께 바뀝니다', 'the 2D scramble image follows too'));
      r3.appendChild(selEl(pal, palPref(), setPalette));
      body.appendChild(r3);
    }

    var r4 = orow(T('vcubeOptSpeed', '회전 속도', 'turn speed'),
      T('vcubeOptSpeedHint', '초당 회전 수 (csTimer 방식). 빠를수록 룩어헤드가 살아납니다.',
        'turns per second, as in csTimer. Faster keeps your lookahead alive.'));
    var sec = T('spdSec', '초', 'sec');
    r4.appendChild(selEl([
      ['0', T('spdInst', '즉시', 'instant')],
      ['20', '20 / ' + sec],
      ['10', '10 / ' + sec + ' (' + T('spdDef', '기본', 'default') + ')'],
      ['5', '5 / ' + sec],
      ['2', '2 / ' + sec],
      ['1', '1 / ' + sec]
    ], tpsPref(), setSpeed));
    body.appendChild(r4);

    /* MIGRATED from optPgDisplay — two homes for one pref is worse than an awkward home. */
    var r5 = orow(T('vcubeXrayOpt2', '투명 보기 (뒷면 비추기)', 'see-through (show the back)'));
    r5.appendChild(swEl(xrayOn(), function (v) { setXray(v); buildOpts(body); }));
    body.appendChild(r5);

    var r6 = orow(T('vcubeGapOpt', '뒷면 틈 간격', 'see-through gap width'));
    var gs = selEl([
      ['0.94', T('gapNarrow', '좁게', 'narrow')],
      ['0.86', T('gapNormal', '보통', 'normal')],
      ['0.78', T('gapWide', '넓게', 'wide')],
      ['0.7', T('gapWidest', '아주 넓게', 'widest')]
    ], String(gapPref()), function (v) { setGap(parseFloat(v)); });
    gs.disabled = !xrayOn();
    r6.appendChild(gs);
    body.appendChild(r6);

    var r7 = orow(T('vcubeOptNet', '2D 전개도 겹쳐 보기', '2D net overlay'));
    r7.appendChild(swEl(netOn(), setNet));
    body.appendChild(r7);

    /* ---- readouts ---- */
    sect(body, T('vcubeOptHud', '표시', 'readouts'));
    var r8 = orow(T('vcubeOptStat', '이동 수 · TPS 표시', 'show move count · TPS'),
      T('vcubeOptStatHint', '같은 12.4초라도 48수 4.0TPS 와 68수 5.5TPS 는 완전히 다른 문제입니다',
        'a 12.4 at 48 moves is a different problem from a 12.4 at 68 moves'));
    r8.appendChild(swEl(statOn(), function (v) { setPref('stat', v ? '1' : '0'); syncStat(); }));
    body.appendChild(r8);

    if (!isMobile()) {
      var r9 = orow(T('vcubeOptLeg', '키 표', 'key legend'));
      r9.appendChild(selEl([
        ['off', T('legOff', '숨김', 'hidden')],
        ['basic', T('legBasic', '기초', 'basics')],
        ['full', T('legFull', '고급 (전체)', 'advanced (all)')]
      ], legendOn() ? legendTier() : 'off', function (v) {
        if (v === 'off') { setLegend(false); return; }
        setPref('legtier', v); setPref('legend', '1');
        buildLegend(); syncLegend(); fitCanvas();
      }));
      body.appendChild(r9);
    }

    /* ---- camera ---- */
    sect(body, T('vcubeOptCam', '카메라', 'camera'));
    var cam = document.createElement('div');
    cam.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;padding:6px 0;';
    cam.appendChild(mkBtn('btn', T('vcubeCamHome', '기본 각도로', 'go to home angle'), function () {
      if (!eng) return;
      var hv = homeView();
      eng.setView(hv.yaw, hv.pitch);
    }));
    cam.appendChild(mkBtn('btn', T('vcubeCamSet', '현재 각도를 기본으로', 'make this the home angle'), function () {
      if (!eng) return;
      var v = eng.getView();
      setPref('view', JSON.stringify({ yaw: v.yaw, pitch: v.pitch }));
      App.toast && App.toast(T('vcubeCamSaved', '기본 각도로 저장했어요', 'saved as the home angle'),
        { type: 'success' });
    }));
    cam.appendChild(mkBtn('btn ghost', T('vcubeCamReset', '초기화', 'reset'), function () {
      setPref('view', JSON.stringify(DEF_VIEW));
      if (eng) eng.setView(DEF_VIEW.yaw, DEF_VIEW.pitch);
    }));
    body.appendChild(cam);
    hintEl(body, T('vcubeCamHint',
      '큐브 화면에서 ` 키로 기본 각도로 돌아가고, Shift 를 누르고 있으면 밑면(D)을 봅니다.',
      'in the cube view, ` returns to the home angle and holding Shift peeks at the D face.'));
  }

  function openOpts() {
    if (!optM) {
      optM = App.registerModal('vcubeOpts', T('vcubeOpts', '큐브 설정', 'cube settings'), function () { });
    }
    buildOpts(optM.body);
    optM.open();
  }

  /* ---- open / close ---- */
  function teardownPlay() {
    st.open = false;
    stopLoop();
    endPeek();
    unobserveStage();
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('keyup', onKeyUp, true);
    if (eng) { try { eng.destroy(); } catch (e) { } eng = null; }
    st.phase = 'idle';
    st.doneIdx = null; st.doneSid = null;
    document.body.classList.remove('vcBldRun');
  }

  /* Start play in the CURRENT host. The host must already be built (buildInto) and VISIBLE —
   * the stage has no box while display:none, and fitCanvas() would size the canvas to 0.
   * Returns true when a real cube started. */
  function beginPlay() {
    var ev = App.currentEvent && App.currentEvent();
    var n = cubeSizeOf(ev);

    st.n = n; st.bld = isBLD(ev);
    st.oSl = 1; st.oSr = 1; st.pen = 0; st.escAt = 0;
    resetMoves();
    st.open = true;

    var cube = !!n && !!window.VCube3D;
    showBad(cube ? null : ev);
    if (!cube) { st.open = false; return false; }

    /* Provisional; fitCanvas() below does the real sizing now the host is on screen. */
    ui.canvas.style.width = ui.canvas.style.height = '300px';

    var hv = homeView();
    eng = window.VCube3D.create(ui.canvas, {
      size: n,
      duration: durationMs(),
      yaw: hv.yaw, pitch: hv.pitch,
      palette: paletteColors() || undefined
    });
    eng.onSolved(function (ts) { finish(ts); });
    /* NB: no bindOrbit() here — the canvas is bound once per build in buildPlay() and reads
     * `eng` at event time. Binding per open is what leaked listeners + engines. */

    fitCanvas();
    observeStage();
    syncXray(); syncLegend(); syncSeg(); syncNet(); syncStat();
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('keyup', onKeyUp, true);
    /* Switch to the companion if one already exists (so you can SEE where your solves will
     * land before you make any), but do NOT conjure one just because the cube was opened —
     * record() creates it on the first real solve. See enterVSession(). */
    enterVSession();
    /* Open SOLVED and wait for Space — csTimer's flow, and it makes Space mean something. */
    armSolved();
    return true;
  }

  /* One place that decides "can we simulate this?", used by beginPlay AND by the event
   * switch. `ev` null = we CAN, hide the panel and show the cube. */
  function showBad(ev) {
    var ok = !ev;
    if (ui.bad) ui.bad.style.display = ok ? 'none' : '';
    if (ui.stage) ui.stage.style.display = ok ? '' : 'none';
    /* '' restores the stylesheet's own value, which is `none` on desktop and `grid` inside
     * the mobile media query — so this must NOT hardcode either one. */
    if (ui.pad) ui.pad.style.display = ok ? '' : 'none';
    if (ui.padX) ui.padX.style.display = ok ? '' : 'none';
    if (ui.hint) ui.hint.style.display = ok ? '' : 'none';
    if (ui.seg) ui.seg.style.display = ok ? '' : 'none';
    if (ui.legend) ui.legend.classList.toggle('on', !!(ok && legendOn() && !isMobile()));
    ['applyBtn', 'undoBtn', 'rewindBtn', 'xrayBtn', 'fullBtn', 'legendBtn'].forEach(function (k) {
      if (ui[k]) ui[k].style.display = ok ? '' : 'none';
    });
    if (ok) return;
    ui.bad.textContent = '';
    var n = cubeSizeOf(ev);
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
  }

  /* DESKTOP: the cube is a full VIEW, not a floating modal — "왜 플로팅으로 보여? 큰 화면으로
   * 보고 싶은데". Mobile has the equivalent as its 큐브 tab. openPlay() routes to whichever fits.
   *
   * NOTE this loses the modal's free perk: app.js's uiBlocked() suppressed the core timer
   * keys whenever a .modal.show existed. As a view there is no modal, so the core Space
   * handler is live — hence the Space handling in onKey(), which stopPropagation()s before
   * app.js can see it. */
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
    /* app.js checks T_.state==='running' BEFORE uiBlocked(), so a core solve in flight would
     * be stopped by our very first cube key. Refuse rather than corrupt someone's time. */
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

  /* ---- host mount (js/mobile.js calls these on entering/leaving the 큐브 view) ---- */
  function mount(container) {
    if (!container) return;
    if (st.open && host === container) return;   // already live here
    if (st.open) teardownPlay();                 // moving hosts: never run two engines
    buildInto(container);
    beginPlay();
  }

  function unmount() {
    var pane = isPaneHost() ? host : null;
    exitVSession();
    if (st.open) teardownPlay();
    /* Leave the modal's own body alone — app.js owns that element. Only a pane host we were
     * handed gets emptied, so the tab doesn't keep a dead canvas around. */
    if (pane) { pane.textContent = ''; host = null; }
  }

  /* ============================== boot ============================== */
  /* registerTool() ends in syncToolSelects(), which reads opts() — so it must not run before
   * the DB is loaded. Everything App-touching lives in here. */
  function setup() {
    /* Colours first: the tool registers a renderer that draws the 2D scramble image, so the
     * stored palette has to be in draw_nnn before the first paint, not after the first click. */
    migratePalPref();
    applyPalettePref();

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
        if (!isMobile() && cubeViewOpen()) { leave(); return; }
        openPlay();
      }
    });

    /* One row survives in the app's own settings, and it is a SIGNPOST, not a setting: every
     * cube pref now lives in the cube's own panel, where you can see what it does to the
     * cube while you change it. The old xray/gap rows lived here and are MIGRATED — two
     * homes for one pref is worse than an awkward home. */
    App.registerOptionRow && App.registerOptionRow('optPgDisplay', function (page) {
      var row = document.createElement('div');
      row.className = 'orow';
      var label = document.createElement('span');
      label.textContent = T('vcubeOptRow', '가상 큐브', 'virtual cube');
      var small = document.createElement('small');
      small.className = 'vcOptRowSub';
      small.textContent = T('vcubeOptRowHint', '색상 · 회전 속도 · 투명 보기 · 기록 위치',
        'palette · turn speed · see-through · where solves go');
      label.appendChild(small);
      row.appendChild(label);
      row.appendChild(mkBtn('btn', T('vcubeOpts', '큐브 설정', 'cube settings'), function () {
        App.closeModals && App.closeModals();
        openOpts();
      }));
      page.appendChild(row);
    });

    /* Re-apply only from a NOT-yet-started attempt. Notably 'done' must be excluded:
     * recording a solve ends in App.newScramble(), which emits 'scramble' right back at us —
     * re-applying there would blank the finish time off the LCD in the same tick the user
     * solved. 'idle' is excluded too now: in 연습 mode idle IS free play, and yanking the
     * cube out from under someone mid-experiment is the same bug wearing a different hat. */
    App.on('scramble', function () {
      if (!st.open || !eng) return;
      if (st.phase === 'ready') applyScramble();
    });

    /* THE ZOMBIE VIEW.
     * The old handler called teardownPlay() + App.closeModals() — and closeModals() is a
     * NO-OP for the desktop view, because the view is not a modal. So body[data-cubeview]
     * survived with a destroyed engine: a frozen canvas of the old scramble eating the whole
     * main column, every key dead (the listener was gone), and desktop.css hiding #timerPad
     * so there was no fallback to the hand timer either — the only escape was guessing that
     * the tiny ✕ still worked. It fired on the most natural action there is: finish 3x3,
     * switch to 4x4. */
    App.on('sessionChanged', function () {
      if (switching) return;                       // our own session bookkeeping
      if (!st.open && !cubeViewOpen()) return;
      /* FIRST, before anything reads the current event: take app.js's event write off our
       * companion session and re-aim it at the user's own. `wanted` is what they picked. */
      var wanted = adoptEventChange();
      var ev = wanted ? eventById(wanted) : (App.currentEvent && App.currentEvent());
      var n = cubeSizeOf(ev);
      var h = host;
      if (!n) {
        /* Not an NxN puzzle. Actually leave — delete the body flag. On mobile the tab
         * persists whatever we do, so render the panel into the pane rather than handing
         * the user a blank screen with no way to understand it. */
        App.toast && App.toast(
          T('vcubeLeft', (ev && ev.name ? ev.name : '이 종목') + '은(는) 가상 큐브를 지원하지 않습니다',
            'the virtual cube does not support ' + (ev && ev.name ? ev.name : 'this event')),
          { type: 'error' });
        exitVSession();
        if (h && isPaneHost() && isMobile()) {
          if (st.open) teardownPlay();
          buildInto(h);
          st.n = 0;
          showBad(ev);
          return;
        }
        if (cubeViewOpen()) closeCubeView();
        else { unmount(); App.closeModals && App.closeModals(); }
        return;
      }
      /* Move to the companion for the event they actually picked, BEFORE the rebuild — so
       * that by the time beginPlay() runs, curSession().event (and therefore
       * App.currentEvent(), which every path below reads) agrees with it. */
      if (wanted) enterVSession(wanted);
      /* An NxN: rebuild the engine at the new size, in place, rather than dying.
       * Rebuild even when n is unchanged — 333 -> 333ni is the same size but a different
       * game, and the inspection rule, the hint and the palette all change with it. */
      if (!h) return;
      teardownPlay();
      buildInto(h);
      beginPlay();   // its own enterVSession() is now an idempotent no-op
    });
    /* (There used to be a SECOND sessionChanged handler here that just tore the engine down
     * and called closeModals(). It ran after the rebuild above, killing the new engine on
     * the same tick. The handler above now owns every event change.) */

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
    invertToken: invertToken,
    keyMap: K,
    widthKeys: WIDTH_KEYS,
    cubeSizeOf: cubeSizeOf,
    isBLD: isBLD,
    htmOf: htmOf,
    tpsOf: tpsOf,
    open: openPlay,
    mount: mount,       // mobile 큐브 tab pane (js/mobile.js)
    unmount: unmount,
    openOptions: openOpts,
    state: st,
    engine: function () { return eng; },
    toolInstances: function () { return toolInst; }
  };

  /* ============================== node self-test ==============================
   * Run: node js/feat_vcube.js
   * Verifies the [s,e,f,d] -> notation translation against draw_nnn.js's own apply(), which
   * is the trusted reference. This closes the researcher's open item #4: the "Lw L'"
   * two-token form for a single inner slice was specified but never verified. */
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

    /* --- the legend is a PROMISE to the user; assert every keycap it prints is real ---
     * (the old ASCII table was a verbatim copy of csTimer's funcmap and nothing tied it to
     * this file's actual bindings) */
    var CODE_OF = {
      I: 'KeyI', K: 'KeyK', J: 'KeyJ', F: 'KeyF', H: 'KeyH', G: 'KeyG', D: 'KeyD', E: 'KeyE',
      S: 'KeyS', L: 'KeyL', W: 'KeyW', O: 'KeyO', U: 'KeyU', M: 'KeyM', V: 'KeyV', R: 'KeyR',
      Z: 'KeyZ', C: 'KeyC', X: 'KeyX', Y: 'KeyY', T: 'KeyT', N: 'KeyN', B: 'KeyB', P: 'KeyP',
      Q: 'KeyQ', A: 'KeyA', ';': 'Semicolon', ',': 'Comma', '.': 'Period', '/': 'Slash',
      '0': 'Digit0', '1': 'Digit1', '2': 'Digit2', '5': 'Digit5', '6': 'Digit6', '9': 'Digit9'
    };
    function legendOk(list) {
      return list.every(function (p) {
        var code = CODE_OF[p[1]];
        if (!code || !K[code]) return false;
        return same(3, tupleToToken(K[code](3, 1, 1), 3), p[0]);
      });
    }
    assert('legend 기초: every keycap really does the move it prints', legendOk(BASIC));
    assert('legend 슬라이스 matches the bindings', legendOk(ADV_SLICE));
    assert('legend 와이드 matches the bindings', legendOk(ADV_WIDE));
    assert('legend 회전 matches the bindings', legendOk(ADV_ROT));
    assert('legend 기초 is exactly the 12 face turns + y/y\'', BASIC.length === 14);
    /* the mobile pad makes the same promise */
    var padBad = PAD_ROW1.concat(PAD_ROW2).filter(function (t) {
      return !invertToken(t) || !eq(apply(4, t + ' ' + invertToken(t)), NNN.solved(4));
    });
    assert('every mobile pad button is a token the model accepts: ' + padBad.join(','),
      !padBad.length);
    assert('pad long-press "2" variants are real tokens',
      PAD_ROW1.concat(PAD_ROW2).every(function (t) {
        return !eq(apply(4, t + '2'), NNN.solved(4)) || /^[xyz]/.test(t);
      }));

    /* --- undo: invertToken --- */
    assert("invert R -> R'", invertToken('R') === "R'");
    assert("invert R' -> R", invertToken("R'") === 'R');
    assert('invert R2 -> R2 (its own inverse)', invertToken('R2') === 'R2');
    assert("invert 3Rw' -> 3Rw", invertToken("3Rw'") === '3Rw');
    assert("invert y -> y'", invertToken('y') === "y'");
    assert("invert R2' -> R2", invertToken("R2'") === 'R2');
    assert('invert empty -> null', invertToken('') === null && invertToken(null) === null);
    assert("invert two-token reverses AND inverts: \"Lw L'\" -> \"L Lw'\"",
      invertToken("Lw L'") === "L Lw'");
    /* the property that actually matters: t then invert(t) is a no-op on the real model */
    var TOKENS = ['R', "R'", 'R2', 'U', "U'", 'Rw', "Rw'", '3Rw', "3Rw'", 'y', "y'", 'x', "x'",
      'z', "z'", 'M', "M'", 'E', 'S', "Lw L'", "L' Lw", 'Uw', "Dw'", 'F2'];
    var badInv = TOKENS.filter(function (t) {
      return !eq(apply(5, t + ' ' + invertToken(t)), NNN.solved(5));
    });
    assert('t + invert(t) is a no-op for every token we emit: ' + badInv.join(','), !badInv.length);
    /* and for every key in the map, on every cube size we support */
    var badKeys = [];
    [2, 3, 4, 5, 6, 7].forEach(function (n) {
      Object.keys(K).forEach(function (c) {
        var t = tupleToToken(K[c](n, 1, 1), n);
        if (!t) return;
        if (!eq(apply(n, t + ' ' + invertToken(t)), NNN.solved(n))) badKeys.push(n + ':' + c);
      });
    });
    assert('undo restores the cube for every key on n=2..7: ' + badKeys.join(','), !badKeys.length);
    /* a full undo stack unwinds to exactly the scrambled state — this is what the Backspace
     * stack and the "스크램블로" button both rely on */
    var seq = ['R', "U'", 'Rw', 'y', "M'", 'F2', "Lw L'", "3Rw'"];
    var s0 = apply(4, "R U R' F2 Lw");
    var s1 = s0;
    seq.forEach(function (t) { s1 = NNN.apply(s1, 4, t); });
    seq.slice().reverse().forEach(function (t) { s1 = NNN.apply(s1, 4, invertToken(t)); });
    assert('unwinding the whole move stack returns the scrambled state exactly', eq(s1, s0));

    /* --- move accounting (the old counter incremented after the rotation branch) --- */
    var raw = 'R U y R x U2 z F'.split(' ').map(function (t) {
      return { token: t, rot: /^[xyz]/.test(t) };
    });
    assert('htmOf excludes rotations (8 tokens, 3 rotations -> 5)', htmOf(raw) === 5);
    assert('htmOf([]) === 0', htmOf([]) === 0);
    assert('htmOf(null) === 0', htmOf(null) === 0);
    assert('tpsOf(48, 12000) === 4', tpsOf(48, 12000) === 4);
    assert('tpsOf guards div-by-zero', tpsOf(10, 0) === 0 && tpsOf(0, 100) === 0);

    /* --- cubeSizeOf / isBLD --- */
    assert('333 -> 3', cubeSizeOf({ img: '333' }) === 3);
    assert('222 -> 2', cubeSizeOf({ img: '222' }) === 2);
    assert('777 -> 7', cubeSizeOf({ img: '777' }) === 7);
    assert('pyr -> 0', cubeSizeOf({ img: 'pyr' }) === 0);
    assert('clk -> 0', cubeSizeOf({ img: 'clk' }) === 0);
    assert('null event -> 0', cubeSizeOf(null) === 0);
    /* the trap: 333ni's img IS '333', so size alone cannot see BLD */
    assert('333ni still sizes as a 3x3', cubeSizeOf({ id: '333ni', img: '333' }) === 3);
    assert('isBLD(333ni)', isBLD({ id: '333ni', img: '333' }) === true);
    assert('isBLD(444bld)', isBLD({ id: '444bld', img: '444' }) === true);
    assert('isBLD(555bld)', isBLD({ id: '555bld', img: '555' }) === true);
    assert('isBLD(333) false', isBLD({ id: '333', img: '333' }) === false);
    assert('isBLD(333oh) false', isBLD({ id: '333oh', img: '333' }) === false);
    assert('isBLD(null) false', isBLD(null) === false);
    /* our BLD list must be exactly scramble.js's, or an event silently gets the wrong rules */
    try {
      var Scr = require('./scramble.js');
      var evs = (Scr && Scr.events) || [];
      if (evs.length) {
        var blds = evs.filter(isBLD).map(function (e) { return e.id; }).sort();
        assert('isBLD matches scramble.js exactly (got ' + blds.join(',') + ')',
          eq(blds, ['333ni', '444bld', '555bld']));
        assert('every BLD event is an NxN we can actually simulate',
          evs.filter(isBLD).every(function (e) { return cubeSizeOf(e) >= 3; }));
      }
    } catch (e) {
      console.log('skip scramble.js cross-check (' + e.message + ')');
    }

    /* --- solved test is rotation-invariant (the highest-risk bug per spec) --- */
    function uniform(s, n) {
      for (var f = 0; f < 6; f++) for (var i = 1; i < n * n; i++) if (s[f][i] !== s[f][0]) return false;
      return true;
    }
    assert('solved after y is still solved', uniform(apply(3, 'y'), 3));
    assert('solved after x y z is still solved', uniform(apply(3, 'x y z'), 3));
    assert('R U R\' U\' is not solved', !uniform(apply(3, "R U R' U'"), 3));

    console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
    process.exit(fails ? 1 : 0);
  }
})();
