/* draw_nnn.js — NxN cube facelet simulator + flat-net renderer (original code)
 * Faces: 0=U 1=R 2=F 3=D 4=L 5=B
 * Net storage orientation:
 *   U: viewed from top, row0 adjacent B, col0 adjacent L
 *   D: viewed from below(net-unfolded), row0 adjacent F, col0 adjacent L
 *   side faces: row0 adjacent U; col0 adjacent: F->L, R->F, B->R, L->B
 */
(function (g) {
  'use strict';

  var COLORS = ['#ffffff', '#ee0000', '#00d800', '#ffff00', '#ff8000', '#0000f2'];

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

  function draw(canvas, scramble, n, colors) {
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    var s = apply(solved(n), n, scramble);
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

  var api = {
    solved: solved,
    apply: apply,
    draw: draw,
    colors: COLORS
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
    process.exit(fails ? 1 : 0);
  }
})(typeof window !== 'undefined' ? window : globalThis);
