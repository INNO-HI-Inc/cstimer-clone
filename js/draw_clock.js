/**
 * draw_clock.js — Rubik's Clock scramble image + scramble generator.
 *
 * Original implementation (no code taken from cstimer/TNoodle or any other
 * project). Notation semantics were confirmed against public descriptions of
 * WCA Clock notation (speedsolving wiki "Clock notation", Wikipedia
 * "Rubik's Clock" mechanics):
 *
 *   - Move token "<PINS><n><+|->" (e.g. "UR3+", "ALL2-") means: put ONLY the
 *     named pin(s) up (UR/DR/DL/UL single pin; U=UL+UR, R=UR+DR, D=DL+DR,
 *     L=UL+DL, ALL=all four), then turn a wheel next to an up pin n hours,
 *     "+" = clockwise, "-" = counter-clockwise (as seen from the face you
 *     are looking at).
 *   - An up pin meshes its corner clock with the three adjacent clocks
 *     (two edges + center) on the viewed face, so the whole meshed group
 *     turns together. Corner clocks are physically shared gears: the back
 *     corner at the mirrored position always shows the negated value
 *     (back = -front mod 12). Non-corner back clocks never move while their
 *     face is away from you (its pins are down on that side).
 *   - "y2" flips the puzzle around the vertical axis: subsequent moves apply
 *     to the other face; left/right columns are mirrored, pin names refer to
 *     positions as currently seen.
 *   - Trailing bare pin tokens ("UR DL") only set the final pin display
 *     state; here they are interpreted as front-face pins left UP (the back
 *     face shows the complement at mirrored positions). This is a display
 *     convention only and does not affect dial values.
 *
 * State model: 18 dials, values mod 12 (0 = hand points at 12).
 *   dials[0..8]  = front face, row-major as seen from the FRONT:
 *                  0 UL, 1 U, 2 UR, 3 L, 4 C, 5 R, 6 DL, 7 D, 8 DR
 *   dials[9..17] = back face, row-major as seen from the BACK.
 *   Shared-corner invariant: back[r][2-c] === (12 - front[r][c]) % 12 for
 *   the four corners. 14 independent dials total.
 *
 * Rendering colors (documented per contract):
 *   front backplate  #1d63b0  (WCA-style blue)
 *   back backplate   #cfd8e0  (light gray)
 *   dial face        #ffffff  rim rgba(0,0,0,0.28)
 *   tick dots        #5a6b80  12-o'clock tick #d9822b (orange accent)
 *   hour hand / hub  #1b2a3d
 *   pin up           #f5c518  (yellow)   pin down #252c35 (dark)
 *
 * Plain script (ES5, IIFE). Registers window.ScrImage['clk'] in browsers,
 * module.exports in Node. `node draw_clock.js` runs the built-in self-test.
 */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Puzzle model                                                        */
  /* ------------------------------------------------------------------ */

  // Clocks meshed with each pin when that pin is up (indices on the face
  // being viewed; the same table is valid for the back face viewed from
  // the back, because the pin layout is the same in view coordinates).
  var PIN_ADJ = {
    UL: [0, 1, 3, 4],
    UR: [1, 2, 4, 5],
    DL: [3, 4, 6, 7],
    DR: [4, 5, 7, 8]
  };

  // Corner clock index owned by each pin's wheel.
  var PIN_CORNER = { UL: 0, UR: 2, DL: 6, DR: 8 };

  // Column-mirror map: face index -> index of the same physical position
  // when the puzzle is viewed from the other side.
  var MIRROR = [2, 1, 0, 5, 4, 3, 8, 7, 6];

  // Pin sets selected by each move letter group.
  var MOVE_PINS = {
    UR: ['UR'], DR: ['DR'], DL: ['DL'], UL: ['UL'],
    U: ['UL', 'UR'], R: ['UR', 'DR'], D: ['DL', 'DR'], L: ['UL', 'DL'],
    ALL: ['UL', 'UR', 'DL', 'DR']
  };

  var PIN_ORDER = ['UR', 'DR', 'DL', 'UL']; // WCA order for trailing pins

  function newState() {
    var dials = [];
    for (var i = 0; i < 18; i++) dials[i] = 0;
    return {
      dials: dials,                                   // 18 values mod 12
      flipped: false,                                 // after odd # of y2
      pins: { UR: false, DR: false, DL: false, UL: false } // final display
    };
  }

  /**
   * Apply one wheel turn: pins of `moveName` up, rotate `hours` clockwise
   * (negative = counter-clockwise) as seen from the currently viewed face.
   */
  function turn(state, moveName, hours) {
    var pinList = MOVE_PINS[moveName];
    if (!pinList) return;
    var d = ((hours % 12) + 12) % 12;
    if (d === 0) return;
    var near = state.flipped ? 9 : 0; // base index of the viewed face
    var far = state.flipped ? 0 : 9;  // base index of the hidden face
    var meshed = {};
    var i, j, p;

    for (i = 0; i < pinList.length; i++) {
      p = PIN_ADJ[pinList[i]];
      for (j = 0; j < p.length; j++) meshed[p[j]] = true;
    }
    // Viewed face: every meshed clock advances d hours clockwise.
    for (i = 0; i < 9; i++) {
      if (meshed[i]) state.dials[near + i] = (state.dials[near + i] + d) % 12;
    }
    // Hidden face: only the shared corner gears of the up pins move, and
    // they appear negated at the mirrored position on that side.
    for (i = 0; i < pinList.length; i++) {
      j = far + MIRROR[PIN_CORNER[pinList[i]]];
      state.dials[j] = (state.dials[j] + 12 - d) % 12;
    }
  }

  var RE_MOVE = /^(ALL|UR|DR|DL|UL|U|R|D|L)(\d+)([+-])$/;
  var RE_PIN = /^(UR|DR|DL|UL)$/;

  /**
   * Apply a WCA clock scramble string to `state`. Unknown/bad tokens are
   * ignored (never throws). Returns the state.
   */
  function applyScramble(state, scramble) {
    if (typeof scramble !== 'string') return state;
    var tokens = scramble.split(/\s+/);
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      if (!t) continue;
      if (t === 'y2') {
        state.flipped = !state.flipped;
        continue;
      }
      var m = RE_MOVE.exec(t);
      if (m) {
        var amount = parseInt(m[2], 10);
        turn(state, m[1], m[3] === '-' ? -amount : amount);
        continue;
      }
      if (RE_PIN.test(t)) {
        state.pins[t] = true; // final pin display state (front face)
        continue;
      }
      // anything else: silently ignored
    }
    return state;
  }

  /* ------------------------------------------------------------------ */
  /* Scramble generator                                                  */
  /* ------------------------------------------------------------------ */

  function randInt(n) {
    return Math.floor(Math.random() * n);
  }

  function randMove(name) {
    return name + randInt(6) + (randInt(2) === 0 ? '+' : '-');
  }

  /**
   * WCA-format clock scramble:
   *   UR DR DL UL U R D L ALL  (amount 0..5, random sign)
   *   y2
   *   U R D L ALL              (amount 0..5, random sign)
   *   + uniformly random subset of {UR,DR,DL,UL} = pins left up.
   */
  function genScramble() {
    var first = ['UR', 'DR', 'DL', 'UL', 'U', 'R', 'D', 'L', 'ALL'];
    var second = ['U', 'R', 'D', 'L', 'ALL'];
    var out = [];
    var i;
    for (i = 0; i < first.length; i++) out.push(randMove(first[i]));
    out.push('y2');
    for (i = 0; i < second.length; i++) out.push(randMove(second[i]));
    for (i = 0; i < PIN_ORDER.length; i++) {
      if (randInt(2) === 0) out.push(PIN_ORDER[i]);
    }
    return out.join(' ');
  }

  /* ------------------------------------------------------------------ */
  /* Rendering                                                           */
  /* ------------------------------------------------------------------ */

  var COLORS = {
    plateFront: '#1d63b0',
    plateBack: '#cfd8e0',
    plateEdge: 'rgba(0,0,0,0.25)',
    dialFace: '#ffffff',
    dialRim: 'rgba(0,0,0,0.28)',
    tick: '#5a6b80',
    tick12: '#d9822b',
    hand: '#1b2a3d',
    pinUp: '#f5c518',
    pinDown: '#252c35',
    pinEdge: 'rgba(0,0,0,0.4)',
    label: 'rgba(0,0,0,0.55)'
  };

  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
    ctx.lineTo(x + w, y + h - r);
    ctx.arc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
    ctx.lineTo(x + r, y + h);
    ctx.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
    ctx.lineTo(x, y + r);
    ctx.arc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
    ctx.closePath();
  }

  function drawDial(ctx, cx, cy, r, value) {
    var t, ang;
    // face
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2, false);
    ctx.fillStyle = COLORS.dialFace;
    ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.06);
    ctx.strokeStyle = COLORS.dialRim;
    ctx.stroke();
    // 12 tick dots (12-o'clock tick accented)
    for (t = 0; t < 12; t++) {
      ang = t * Math.PI / 6;
      ctx.beginPath();
      ctx.arc(cx + Math.sin(ang) * r * 0.80,
              cy - Math.cos(ang) * r * 0.80,
              (t === 0 ? 0.085 : 0.05) * r, 0, Math.PI * 2, false);
      ctx.fillStyle = t === 0 ? COLORS.tick12 : COLORS.tick;
      ctx.fill();
    }
    // hour hand
    ang = (((value % 12) + 12) % 12) * Math.PI / 6;
    var sx = Math.sin(ang), cyv = Math.cos(ang);
    ctx.beginPath();
    ctx.moveTo(cx - sx * r * 0.15, cy + cyv * r * 0.15);
    ctx.lineTo(cx + sx * r * 0.62, cy - cyv * r * 0.62);
    ctx.lineWidth = Math.max(1.5, r * 0.17);
    ctx.lineCap = 'round';
    ctx.strokeStyle = COLORS.hand;
    ctx.stroke();
    // hub
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.11, 0, Math.PI * 2, false);
    ctx.fillStyle = COLORS.hand;
    ctx.fill();
  }

  /**
   * Draw one 3x3 face. `dials` = 9 values row-major in view coordinates,
   * `pinsUp` = {UL,UR,DL,DR} booleans in view coordinates.
   */
  function drawFace(ctx, x, y, s, dials, pinsUp, plateColor, label, labelY) {
    var cell = s / 3;
    var r = cell * 0.40;
    var row, col, name;
    // backplate
    roundRectPath(ctx, x, y, s, s, s * 0.13);
    ctx.fillStyle = plateColor;
    ctx.fill();
    ctx.lineWidth = Math.max(1, s * 0.008);
    ctx.strokeStyle = COLORS.plateEdge;
    ctx.stroke();
    // dials
    for (row = 0; row < 3; row++) {
      for (col = 0; col < 3; col++) {
        drawDial(ctx,
                 x + (col + 0.5) * cell,
                 y + (row + 0.5) * cell,
                 r, dials[row * 3 + col]);
      }
    }
    // pins between dials
    var PIN_POS = { UL: [1, 1], UR: [2, 1], DL: [1, 2], DR: [2, 2] };
    for (name in PIN_POS) {
      if (!PIN_POS.hasOwnProperty(name)) continue;
      ctx.beginPath();
      ctx.arc(x + PIN_POS[name][0] * cell,
              y + PIN_POS[name][1] * cell,
              cell * 0.115, 0, Math.PI * 2, false);
      ctx.fillStyle = pinsUp[name] ? COLORS.pinUp : COLORS.pinDown;
      ctx.fill();
      ctx.lineWidth = Math.max(1, cell * 0.02);
      ctx.strokeStyle = COLORS.pinEdge;
      ctx.stroke();
    }
    // label (optional decoration)
    if (label) {
      ctx.fillStyle = COLORS.label;
      ctx.font = Math.max(9, Math.round(s * 0.06)) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x + s / 2, labelY);
    }
  }

  /**
   * Apply `scramble` to a solved clock and render both faces side by side
   * (front left, back right — back drawn as seen from the back).
   */
  function draw(canvas, scramble) {
    if (!canvas || typeof canvas.getContext !== 'function') return;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    var w = (typeof canvas.width === 'number' && canvas.width > 0) ? canvas.width : 400;
    var h = (typeof canvas.height === 'number' && canvas.height > 0) ? canvas.height : 200;
    ctx.clearRect(0, 0, w, h);

    var state = applyScramble(newState(), scramble);

    var s = Math.min(h * 0.84, w * 0.46);
    var fy = (h - s) * 0.42;
    var labelY = fy + s + (h - fy - s) * 0.55;
    var frontX = w * 0.25 - s / 2;
    var backX = w * 0.75 - s / 2;

    // Final display pins: trailing tokens name front-face pins left up;
    // the back face shows the complement at mirrored positions.
    var fp = state.pins;
    var frontPins = { UL: fp.UL, UR: fp.UR, DL: fp.DL, DR: fp.DR };
    var backPins = { UL: !fp.UR, UR: !fp.UL, DL: !fp.DR, DR: !fp.DL };

    drawFace(ctx, frontX, fy, s, state.dials.slice(0, 9), frontPins,
             COLORS.plateFront, 'FRONT', labelY);
    drawFace(ctx, backX, fy, s, state.dials.slice(9, 18), backPins,
             COLORS.plateBack, 'BACK', labelY);
  }

  /* ------------------------------------------------------------------ */
  /* Registration                                                        */
  /* ------------------------------------------------------------------ */

  var api = {
    draw: draw,
    genScramble: genScramble,
    // exposed for tests / advanced callers
    newState: newState,
    applyScramble: applyScramble
  };

  var g = (typeof window !== 'undefined') ? window : globalThis;
  g.ScrImage = g.ScrImage || {};
  g.ScrImage['clk'] = api;
  if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = api;
  }

  /* ------------------------------------------------------------------ */
  /* Node self-test                                                      */
  /* ------------------------------------------------------------------ */

  var isNodeMain = typeof require !== 'undefined' &&
                   typeof module !== 'undefined' &&
                   require.main === module;

  if (isNodeMain) {
    (function selfTest() {
      var failures = 0;

      function check(name, ok, detail) {
        if (ok) {
          console.log('PASS ' + name);
        } else {
          failures++;
          console.log('FAIL ' + name + (detail ? ' -- ' + detail : ''));
        }
      }

      function allZero(state) {
        for (var i = 0; i < 18; i++) if (state.dials[i] !== 0) return false;
        return true;
      }

      function sameDials(state, expected) {
        for (var i = 0; i < 18; i++) if (state.dials[i] !== expected[i]) return false;
        return true;
      }

      function makeStubCanvas() {
        var noop = function () {};
        var ctx = {};
        var methods = ['clearRect', 'beginPath', 'closePath', 'arc', 'moveTo',
                       'lineTo', 'fill', 'stroke', 'fillRect', 'strokeRect',
                       'save', 'restore', 'translate', 'rotate', 'scale',
                       'setTransform', 'fillText'];
        for (var i = 0; i < methods.length; i++) ctx[methods[i]] = noop;
        return { width: 400, height: 200, getContext: function () { return ctx; } };
      }

      var names = ['UR', 'DR', 'DL', 'UL', 'U', 'R', 'D', 'L', 'ALL'];
      var i, j, s, ok, bad;

      // 1. every single move token applied 12x returns to solved
      ok = true; bad = '';
      for (i = 0; i < names.length; i++) {
        s = newState();
        for (j = 0; j < 12; j++) applyScramble(s, names[i] + '1+');
        if (!allZero(s)) { ok = false; bad += names[i] + '1+ '; }
        s = newState();
        for (j = 0; j < 4; j++) applyScramble(s, names[i] + '3-');
        if (!allZero(s)) { ok = false; bad += names[i] + '3- '; }
      }
      check('T1 each move x12 hours = identity', ok, bad);

      // 2. y2 y2 = identity
      s = applyScramble(newState(), 'y2 y2');
      check('T2 "y2 y2" = identity', allZero(s) && s.flipped === false);

      // 3. UR3+ then UR3- = identity
      s = applyScramble(newState(), 'UR3+ UR3-');
      check('T3 "UR3+ UR3-" = identity', allZero(s));

      // 4. ALL1+ move vector: all 9 front dials +1, back corners -1
      s = applyScramble(newState(), 'ALL1+');
      check('T4 "ALL1+" vector',
            sameDials(s, [1, 1, 1, 1, 1, 1, 1, 1, 1,
                          11, 0, 11, 0, 0, 0, 11, 0, 11]),
            'got ' + s.dials.join(','));

      // 4b. y2 remap: "y2 U1+" hits back top+middle rows, front top corners
      s = applyScramble(newState(), 'y2 U1+');
      check('T4b "y2 U1+" vector',
            sameDials(s, [11, 0, 11, 0, 0, 0, 0, 0, 0,
                          1, 1, 1, 1, 1, 1, 0, 0, 0]),
            'got ' + s.dials.join(','));

      // 5. genScramble format + parse + dial range + corner invariant
      var re = new RegExp(
        '^UR[0-5][+-] DR[0-5][+-] DL[0-5][+-] UL[0-5][+-] ' +
        'U[0-5][+-] R[0-5][+-] D[0-5][+-] L[0-5][+-] ALL[0-5][+-] y2 ' +
        'U[0-5][+-] R[0-5][+-] D[0-5][+-] L[0-5][+-] ALL[0-5][+-]' +
        '( UR)?( DR)?( DL)?( UL)?$');
      ok = true; bad = '';
      for (i = 0; i < 50; i++) {
        var scr = genScramble();
        if (!re.test(scr)) { ok = false; bad = 'format: ' + scr; break; }
        s = applyScramble(newState(), scr);
        for (j = 0; j < 18; j++) {
          var v = s.dials[j];
          if (typeof v !== 'number' || v !== Math.floor(v) || v < 0 || v > 11) {
            ok = false; bad = 'dial ' + j + '=' + v + ' in: ' + scr;
          }
        }
        var corners = [0, 2, 6, 8];
        for (j = 0; j < corners.length; j++) {
          var c = corners[j];
          if (s.dials[9 + MIRROR[c]] !== (12 - s.dials[c]) % 12) {
            ok = false; bad = 'corner invariant broken at ' + c + ' in: ' + scr;
          }
        }
        if (!ok) break;
      }
      check('T5 genScramble format/parse/range/invariant (50x)', ok, bad);

      // 5b. trailing pin tokens set pin state
      s = applyScramble(newState(), 'UR DL');
      check('T5b pin tokens set display state',
            s.pins.UR === true && s.pins.DL === true &&
            s.pins.DR === false && s.pins.UL === false && allZero(s));

      // 6. draw() never throws; empty scramble = solved
      ok = true; bad = '';
      var canvas = makeStubCanvas();
      try {
        for (i = 0; i < 20; i++) draw(canvas, genScramble());
        draw(canvas, '');
        draw(canvas, 'ZZ3+ UR9? y3 hello ALL+ 5UL nonsense');
        draw(canvas, null);
        draw(null, 'UR1+');
        draw({}, 'UR1+');
      } catch (e) {
        ok = false; bad = String(e && e.stack || e);
      }
      check('T6a draw() never throws (20 scrambles + junk input)', ok, bad);
      check('T6b empty scramble stays solved',
            allZero(applyScramble(newState(), '')));

      if (failures === 0) {
        console.log('ALL TESTS PASSED');
      } else {
        console.log(failures + ' TEST(S) FAILED');
        process.exit(1);
      }
    })();
  }
})();
