/* draw_nnn.js — NxN cube facelet simulator + flat-net renderer (original code)
 * Faces: 0=U 1=R 2=F 3=D 4=L 5=B
 * Net storage orientation:
 *   U: viewed from top, row0 adjacent B, col0 adjacent L
 *   D: viewed from below(net-unfolded), row0 adjacent F, col0 adjacent L
 *   side faces: row0 adjacent U; col0 adjacent: F->L, R->F, B->R, L->B
 */
(function (g) {
  'use strict';

  /* PALETTES ---------------------------------------------------------------
   * Face order is always U,R,F,D,L,B. The scheme never changes (U white, R red,
   * F green, D yellow, L orange, B blue) — only the shades do.
   *
   * Why these shades: red and orange sit only ~28 deg apart in hue, so hue alone
   * cannot separate them. Pixels sampled off product photos of a real GAN 356 R and
   * MoYu RS3M show the trick real cubes use — LIGHTNESS:
   *     GAN red    #c2353d  L*=44.7  hue=27.5      GAN orange #fe781c  L*=65.4  hue=55.4
   *     GAN green  #078f55  L*=52.2  hue=154.7     MoYu blue  #276ca4  L*=44.0  hue=267.4
   * (Lab hues; the sampled L* of green/blue reads low because those faces were shadowed
   * in the photos — hue and chroma are the trustworthy signal from a photograph.)
   * Note green ~155 and blue ~267: real cube plastic is emerald and azure, NOT the
   * #00d800 / #0000f2 primaries the old palette used. That is most of the "cheap" look.
   *
   * The engine renders each face at a brightness multiplier down to 0.70 (vcube3d.js
   * :533), so every pair must stay separable at 0.70 as well as 1.00. Verified with a
   * CIEDE2000 matrix under normal vision and under simulated deuteranopia/protanopia:
   *
   *   palette      min dE normal (1.00/0.70)   min dE colour-blind
   *   old toy          23.1 / 19.8                 1.9   <- green==orange to a deuteranope
   *   toss (default)   33.2 / 29.1                13.9
   *   cvd (safe)             19.1                 19.2
   *
   * A green leaning slightly teal (hue ~163) is deliberate: teal keeps blue content, and
   * the blue-yellow axis is the one red-green colour blindness preserves. It is what buys
   * 1.9 -> 13.9 at no cost to how the cube looks. */
  var PALETTES = [
    { id: 'toss', ko: '토스 톤', en: 'Toss tone',
      colors: ['#f4f6fa', '#ad1338', '#14b07d', '#f8de10', '#ee7a10', '#2b7cc4'] },
    { id: 'classic', ko: 'csTimer 클래식', en: 'csTimer classic',
      colors: ['#ffffff', '#ee0000', '#00d800', '#ffff00', '#ff8000', '#0000f2'] },
    { id: 'cvd', ko: '색약 안전', en: 'Colour-blind safe',
      colors: ['#f9f9f9', '#b61d52', '#32afab', '#f7ee01', '#ec8556', '#1666c6'] }
  ];

  function paletteById(id) {
    for (var i = 0; i < PALETTES.length; i++) if (PALETTES[i].id === id) return PALETTES[i];
    return null;
  }

  /* The default. The 3D engine reads ScrImage.nnn.colors as its default palette, so the
   * 2D net and the virtual cube stay in step from this one array. */
  var COLORS = PALETTES[0].colors;

  /* Switch the active palette. Rebinds COLORS (paint() reads the variable, so every later
   * draw picks it up) and re-points api.colors at it, which is what the 3D engine reads as
   * its default. NB: this must NOT mutate the chosen palette's array in place — api.colors
   * and PALETTES[i].colors are the same reference, so an in-place edit would corrupt the
   * preset it came from. */
  function setPalette(id) {
    var p = paletteById(id);
    if (!p) return false;
    COLORS = p.colors;
    api.colors = COLORS;
    return true;
  }

  function solved(n) {
    var s = [];
    for (var f = 0; f < 6; f++) {
      var face = new Array(n * n);
      for (var i = 0; i < n * n; i++) face[i] = f;
      s.push(face);
    }
    return s;
  }

  function rotCW(a, n) {
    var b = new Array(n * n);
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) b[c * n + (n - 1 - r)] = a[r * n + c];
    return b;
  }
  function rot180(a, n) { return rotCW(rotCW(a, n), n); }
  function rotCCW(a, n) { return rotCW(rot180(a, n), n); }

  /* whole-cube rotations */
  function rotY(s, n) { // like U for the whole cube: old R -> F
    return [rotCW(s[0], n), s[5], s[1], rotCCW(s[3], n), s[2], s[4]];
  }
  function rotX(s, n) { // like R: old F -> U
    return [s[2], rotCW(s[1], n), s[3], rot180(s[5], n), rotCCW(s[4], n), rot180(s[0], n)];
  }
  function rotZ(s, n) { // like F: old U -> R
    return [rotCW(s[4], n), rotCW(s[0], n), rotCW(s[2], n), rotCW(s[1], n), rotCW(s[3], n), rotCCW(s[5], n)];
  }
  function times(fn, s, n, k) { for (var i = 0; i < k; i++) s = fn(s, n); return s; }

  /* U-layer turn at depth d (0 = outermost). Strips cycle B->R->F->L->B. */
  function uLayer(s, n, d) {
    var order = [5, 1, 2, 4]; // B R F L
    var strips = [];
    for (var i = 0; i < 4; i++) {
      var f = order[i], strip = [];
      for (var c = n - 1; c >= 0; c--) strip.push(s[f][d * n + c]);
      strips.push(strip);
    }
    for (i = 0; i < 4; i++) {
      var to = order[(i + 1) % 4], k = 0;
      for (var c2 = n - 1; c2 >= 0; c2--) s[to][d * n + c2] = strips[i][k++];
    }
    if (d === 0) s[0] = rotCW(s[0], n);
    if (d === n - 1) s[3] = rotCCW(s[3], n);
    return s;
  }

  function copyState(s) { return [s[0].slice(), s[1].slice(), s[2].slice(), s[3].slice(), s[4].slice(), s[5].slice()]; }

  // conjugation: rotation count of [x,y,z] to bring face to U, and its inverse
  var CONJ = { U: null, F: ['x', 1], B: ['x', 3], D: ['x', 2], L: ['z', 1], R: ['z', 3] };
  var ROTFN = { x: rotX, y: rotY, z: rotZ };

  function faceTurn(s, n, face, width, amount) {
    var conj = CONJ[face];
    if (conj) s = times(ROTFN[conj[0]], s, n, conj[1]);
    for (var a = 0; a < amount; a++) {
      for (var d = 0; d < width && d < n; d++) s = uLayer(copyState(s), n, d);
    }
    if (conj) s = times(ROTFN[conj[0]], s, n, 4 - conj[1]);
    return s;
  }

  var TOKEN_RE = /^([2-9]?)([URFDLBxyz])(w?)(2|'|2')?$/;
  var SLICE_RE = /^([MES])(2|')?$/;
  var LOWER_WIDE = { u: 'U', r: 'R', f: 'F', d: 'D', l: 'L', b: 'B' };

  // slice moves: M follows L (conj z), E follows D (conj x2), S follows F (conj x)
  var SLICE_CONJ = { M: ['z', 1], E: ['x', 2], S: ['x', 1] };
  function sliceTurn(s, n, letter, amount) {
    var conj = SLICE_CONJ[letter];
    s = times(ROTFN[conj[0]], s, n, conj[1]);
    for (var a = 0; a < amount; a++) {
      for (var d = 1; d <= n - 2; d++) s = uLayer(copyState(s), n, d);
    }
    s = times(ROTFN[conj[0]], s, n, 4 - conj[1]);
    return s;
  }

  function apply(s, n, scramble) {
    if (!scramble) return s;
    var toks = String(scramble).replace(/\n/g, ' ').split(/\s+/);
    for (var i = 0; i < toks.length; i++) {
      var t = toks[i];
      if (!t) continue;
      // lowercase single letter = 2-layer wide (SiGN notation)
      if (LOWER_WIDE[t.charAt(t.length > 1 ? t.replace(/[2']/g, '').length - 1 : 0)] && /^[urfdlb](2|')?$/.test(t)) {
        t = LOWER_WIDE[t.charAt(0)] + 'w' + t.slice(1);
      }
      var sm = SLICE_RE.exec(t);
      if (sm) {
        var samt = sm[2] === '2' ? 2 : (sm[2] === "'" ? 3 : 1);
        s = sliceTurn(s, n, sm[1], samt);
        continue;
      }
      var m = TOKEN_RE.exec(t);
      if (!m) continue;
      var amount = m[4] === '2' ? 2 : (m[4] === "'" ? 3 : (m[4] === "2'" ? 2 : 1));
      var letter = m[2];
      if (letter === 'x' || letter === 'y' || letter === 'z') {
        s = times(ROTFN[letter], s, n, amount);
        continue;
      }
      var width = m[3] === 'w' ? (m[1] ? parseInt(m[1], 10) : 2) : 1;
      if (width > n - 1) width = n - 1;
      s = faceTurn(s, n, letter, width, amount);
    }
    return s;
  }

  /* Paint a facelet array as a flat net. The single painting path behind both
   * draw() (which scrambles first) and drawState() (which does not). */
  function paint(canvas, s, n, colors) {
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    var pal = colors || COLORS;
    var margin = 6;
    var u = Math.min((canvas.width - margin * 2) / (4 * n), (canvas.height - margin * 2) / (3 * n));
    var ox = (canvas.width - u * 4 * n) / 2, oy = (canvas.height - u * 3 * n) / 2;
    var pos = [[n, 0], [2 * n, n], [n, n], [n, 2 * n], [0, n], [3 * n, n]]; // U R F D L B in units
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#000';
    for (var f = 0; f < 6; f++) {
      for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) {
        var x = ox + (pos[f][0] + c) * u, y = oy + (pos[f][1] + r) * u;
        ctx.fillStyle = pal[s[f][r * n + c]];
        ctx.fillRect(x, y, u, u);
        ctx.strokeRect(x + 0.5, y + 0.5, u - 1, u - 1);
      }
    }
  }

  function draw(canvas, scramble, n, colors) {
    paint(canvas, apply(solved(n), n, scramble), n, colors);
  }

  /* Paint a facelet array straight through, skipping apply(). `state` is the
   * [6][n*n] U,R,F,D,L,B layout that solved()/apply() produce — which is exactly what
   * the 3D engine's getState() hands back, so a live cube can be mirrored into a 2D net
   * inset with no adaptation:  eng.onTurn(function(){ drawState(cv, eng.getState()); })
   * `n` is optional: it is derived from the state when omitted. */
  function drawState(canvas, state, n, colors) {
    if (!state || state.length !== 6 || !state[0]) return;
    if (!n) n = Math.round(Math.sqrt(state[0].length));
    if (!(n > 0) || state[0].length !== n * n) return;
    paint(canvas, state, n, colors);
  }

  var api = {
    solved: solved,
    apply: apply,
    draw: draw,
    drawState: drawState,
    colors: COLORS,
    palettes: PALETTES,
    paletteById: paletteById,
    setPalette: setPalette
  };

  g.ScrImage = g.ScrImage || {};
  g.ScrImage.nnn = api;
  var sizes = { '222': 2, '333': 3, '444': 4, '555': 5, '666': 6, '777': 7 };
  Object.keys(sizes).forEach(function (k) {
    var n = sizes[k];
    g.ScrImage[k] = { draw: function (canvas, scr) { draw(canvas, scr, n); } };
  });

  if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') module.exports = api;

  /* ---------------- node self-test ---------------- */
  if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
    var fails = 0;
    function assert(name, cond) {
      console.log((cond ? 'PASS' : 'FAIL') + ' - ' + name);
      if (!cond) fails++;
    }
    function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

    [2, 3, 4, 5].forEach(function (n) {
      ['U', 'D', 'R', 'L', 'F', 'B'].forEach(function (mv) {
        var s = apply(solved(n), n, (mv + ' ').repeat(4));
        assert(n + 'x' + n + ' ' + mv + ' x4 = identity', eq(s, solved(n)));
      });
    });
    var s3 = apply(solved(3), 3, "R U R' U' ".repeat(6));
    assert("3x3 (R U R' U')x6 = identity", eq(s3, solved(3)));
    var sU = apply(solved(3), 3, 'U');
    assert('3x3 after U: F top row = old R color', sU[2][0] === 1 && sU[2][1] === 1 && sU[2][2] === 1);
    assert('3x3 after U: R top row = old B color', sU[1][0] === 5 && sU[1][2] === 5);
    var sR = apply(solved(3), 3, 'R');
    assert('3x3 after R: F right col = old D color', sR[2][2] === 3 && sR[2][5] === 3 && sR[2][8] === 3);
    assert('3x3 after R: U right col = old F color', sR[0][2] === 2 && sR[0][8] === 2);
    var s4 = apply(solved(4), 4, 'Rw2 Rw2');
    assert('4x4 Rw2 x2 = identity', eq(s4, solved(4)));
    var s6 = apply(solved(6), 6, "3Uw 3Uw 3Uw 3Uw");
    assert('6x6 3Uw x4 = identity', eq(s6, solved(6)));
    ['x', 'y', 'z'].forEach(function (rot) {
      var s = apply(solved(3), 3, (rot + ' ').repeat(4));
      assert('3x3 ' + rot + ' x4 = identity', eq(s, solved(3)));
    });
    var sx = apply(solved(3), 3, 'x');
    assert('3x3 after x: U = old F', sx[0][4] === 2 && sx[2][4] === 3 && sx[5][4] === 0);
    ['M', 'E', 'S'].forEach(function (sl) {
      var s = apply(solved(3), 3, (sl + ' ').repeat(4));
      assert('3x3 ' + sl + ' x4 = identity', eq(s, solved(3)));
      s = apply(solved(3), 3, sl + '2 ' + sl + '2');
      assert('3x3 ' + sl + '2 x2 = identity', eq(s, solved(3)));
    });
    var sM = apply(solved(3), 3, 'M');
    assert('3x3 after M: F center = old U, U center = old B, D center = old F',
      sM[2][4] === 0 && sM[0][4] === 5 && sM[3][4] === 2);
    var s5m = apply(solved(5), 5, 'M M M M');
    assert('5x5 M x4 = identity', eq(s5m, solved(5)));
    var s5 = apply(solved(5), 5, "Rw U 3Rw' F2 3Rw F2 U' Rw' ".repeat(1));
    var count = {};
    s5.forEach(function (f) { f.forEach(function (c) { count[c] = (count[c] || 0) + 1; }); });
    assert('5x5 sticker count conserved', [0, 1, 2, 3, 4, 5].every(function (c) { return count[c] === 25; }));
    // stub canvas draw
    var stub = { width: 420, height: 300, getContext: function () { var o = {}; ['clearRect', 'fillRect', 'strokeRect'].forEach(function (k) { o[k] = function () { }; }); return o; } };
    var threw = false;
    try { draw(stub, "R U Rw' 3Fw2 x y' garbage", 7); } catch (e) { threw = true; }
    assert('draw() robust on 7x7 with junk token', !threw);

    /* ---- palettes ---- */
    var HEX = /^#[0-9a-f]{6}$/;
    assert('3 named palettes exported', PALETTES.length === 3);
    assert('palette ids are toss/classic/cvd',
      eq(PALETTES.map(function (p) { return p.id; }), ['toss', 'classic', 'cvd']));
    assert('every palette has 6 lowercase hex colours in U,R,F,D,L,B order',
      PALETTES.every(function (p) { return p.colors.length === 6 && p.colors.every(function (c) { return HEX.test(c); }); }));
    assert('every palette carries a ko + en label',
      PALETTES.every(function (p) { return !!p.ko && !!p.en; }));
    assert('default colors === palettes[0] (toss tone)', api.colors === PALETTES[0].colors);
    assert('paletteById finds each palette',
      PALETTES.every(function (p) { return paletteById(p.id) === p; }));
    // setPalette must REBIND, never mutate: api.colors and PALETTES[i].colors are the same
    // array, so an in-place edit here would silently corrupt the preset it came from.
    var snap = PALETTES.map(function (p) { return p.colors.slice(); });
    assert('setPalette switches the active palette', setPalette('classic') && api.colors === paletteById('classic').colors);
    assert('setPalette(bad id) is a no-op', !setPalette('nope') && api.colors === paletteById('classic').colors);
    var cv = { width: 40, height: 40, getContext: function () { var o = {}; ['clearRect','fillRect','strokeRect','beginPath','moveTo','lineTo','closePath','fill','stroke','save','restore'].forEach(function (k) { o[k] = function () {}; }); return o; } };
    draw(cv, 'R U', 3);
    assert('presets survive a palette switch + draw (no in-place mutation)',
      PALETTES.every(function (p, i) { return JSON.stringify(p.colors) === JSON.stringify(snap[i]); }));
    setPalette(PALETTES[0].id);
    assert('paletteById(unknown) === null', paletteById('nope') === null);
    assert('classic palette preserves the historical csTimer shades',
      eq(paletteById('classic').colors, ['#ffffff', '#ee0000', '#00d800', '#ffff00', '#ff8000', '#0000f2']));
    // The whole point of the shade work: red and orange must never collide. Guard the
    // property (a real lightness gap), not the literal hex, so retuning stays free.
    function lum(hex) { // sRGB relative luminance
      var v = parseInt(hex.slice(1), 16), o = [(v >> 16) & 255, (v >> 8) & 255, v & 255];
      var l = o.map(function (c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
      return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
    }
    ['toss', 'cvd'].forEach(function (id) {
      var c = paletteById(id).colors;
      assert(id + ': red(R) is clearly darker than orange(L) — the real-cube separation',
        lum(c[4]) - lum(c[1]) > 0.15);
      assert(id + ': all 6 shades distinct', new Set(c).size === 6);
    });

    /* ---- drawState ---- */
    function recStub(n) {
      var fills = [];
      return {
        width: 420, height: 300, fills: fills,
        getContext: function () {
          var o = { fillStyle: null };
          o.clearRect = function () { };
          o.strokeRect = function () { };
          o.fillRect = function () { fills.push(o.fillStyle); };
          return o;
        }
      };
    }
    var scr = "R U R' F2 Lw' x y2 D";
    // drawState(state) must paint exactly what draw(scramble) paints for that same state.
    var a = recStub(), b = recStub();
    draw(a, scr, 3);
    drawState(b, apply(solved(3), 3, scr), 3);
    assert('drawState() paints identically to draw() for the same state',
      a.fills.length === 54 && eq(a.fills, b.fills));
    var c4a = recStub(), c4b = recStub();
    draw(c4a, 'Rw U2 F', 4);
    drawState(c4b, apply(solved(4), 4, 'Rw U2 F'), 4);
    assert('drawState() matches draw() on 4x4 (96 facelets)',
      c4a.fills.length === 96 && eq(c4a.fills, c4b.fills));
    var dn = recStub();
    drawState(dn, solved(5));
    assert('drawState() derives n from the state when n is omitted', dn.fills.length === 150);
    var dp = recStub();
    drawState(dp, solved(3), 3, paletteById('classic').colors);
    assert('drawState() honours a custom palette', dp.fills.every(function (f) {
      return paletteById('classic').colors.indexOf(f) >= 0;
    }) && dp.fills[0] === '#ffffff');
    var dsolved = recStub();
    drawState(dsolved, solved(3), 3);
    assert('drawState() on a solved cube paints 9 of each face colour',
      COLORS.every(function (c) {
        return dsolved.fills.filter(function (f) { return f === c; }).length === 9;
      }));
    // getState() from the 3D engine is this exact layout — mirror it without adaptation.
    var st = apply(solved(3), 3, 'U R');
    var mirror = recStub();
    drawState(mirror, st, 3);
    assert('drawState() does not mutate the state it is handed', eq(st, apply(solved(3), 3, 'U R')));
    var badThrew = false;
    try {
      drawState(recStub(), null); drawState(recStub(), []); drawState(recStub(), [[], [], [], [], [], []]);
      drawState(recStub(), 'nonsense'); drawState(recStub(), solved(3), 99);
    } catch (e) { badThrew = true; }
    assert('drawState() robust on malformed state', !badThrew);

    process.exit(fails ? 1 : 0);
  }
})(typeof window !== 'undefined' ? window : globalThis);
