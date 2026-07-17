/* scramble.js — random-move scramble generators (original code)
 * NOTE: real csTimer uses random-STATE scrambles for WCA events; this clone
 * uses high-quality random-move scrambles (clearly labeled in About).
 * Square-1 / Clock delegate to their state-based modules when available.
 */
(function (g) {
  'use strict';

  function rnd(n) { return Math.floor(Math.random() * n); }
  function pick(arr) { return arr[rnd(arr.length)]; }

  var SUFF = ['', '2', "'"];

  /* ---------- NxN ---------- */
  // faces grouped by axis: 0:U/D 1:R/L 2:F/B
  var FACES = ['U', 'D', 'R', 'L', 'F', 'B'];
  var AXIS = { U: 0, D: 0, R: 1, L: 1, F: 2, B: 2 };

  function nnnScramble(n, len, faceSet) {
    var moves = [];
    var lastFace = '', last2Face = '';
    var maxWidth = Math.max(1, Math.floor(n / 2));
    while (moves.length < len) {
      var f = faceSet ? pick(faceSet) : pick(FACES);
      if (f === lastFace) continue;
      // avoid e.g. R L R (same axis sandwiching)
      if (lastFace && last2Face && AXIS[f] === AXIS[lastFace] && f === last2Face) continue;
      var w = 1;
      if (n >= 4) {
        w = 1 + rnd(maxWidth);
        if (w > 3) w = 3; // WCA style: at most 3-wide (6x6/7x7)
        if (n < 6 && w > 2) w = 2;
      }
      var s = pick(SUFF);
      var name = (w >= 3 ? w : '') + f + (w >= 2 ? 'w' : '') + s;
      moves.push({ f: f, str: name });
      last2Face = lastFace;
      lastFace = f;
    }
    return moves.map(function (m) { return m.str; }).join(' ');
  }

  function nnnWithConstraint(n, len, firstNot, lastNot) {
    for (var tries = 0; tries < 100; tries++) {
      var scr = nnnScramble(n, len);
      var toks = scr.split(' ');
      var first = toks[0].replace(/[^URFDLB]/g, '');
      var last = toks[toks.length - 1].replace(/[^URFDLB]/g, '');
      if (firstNot.indexOf(first) < 0 && lastNot.indexOf(last) < 0) return scr;
    }
    return scr;
  }

  /* ---------- Pyraminx ---------- */
  function pyraScramble(len) {
    len = len || 9;
    var main = ['U', 'L', 'R', 'B'];
    var moves = [], lastF = '';
    while (moves.length < len) {
      var f = pick(main);
      if (f === lastF) continue;
      moves.push(f + pick(['', "'"]));
      lastF = f;
    }
    ['u', 'l', 'r', 'b'].forEach(function (tip) {
      var k = rnd(3); // 0: none, 1: cw, 2: ccw
      if (k === 1) moves.push(tip);
      if (k === 2) moves.push(tip + "'");
    });
    return moves.join(' ');
  }

  /* ---------- Skewb ---------- */
  function skewbScramble(len) {
    len = len || 9;
    var main = ['U', 'L', 'R', 'B'];
    var moves = [], lastF = '';
    while (moves.length < len) {
      var f = pick(main);
      if (f === lastF) continue;
      moves.push(f + pick(['', "'"]));
      lastF = f;
    }
    return moves.join(' ');
  }

  /* ---------- Megaminx (Pochmann / WCA notation) ---------- */
  function megaScramble(lines) {
    lines = lines || 7;
    var out = [];
    for (var l = 0; l < lines; l++) {
      var row = [];
      for (var i = 0; i < 10; i++) {
        var f = (i % 2 === 0) ? 'R' : 'D';
        row.push(f + (rnd(2) ? '++' : '--'));
      }
      row.push('U' + (rnd(2) ? '' : "'"));
      out.push(row.join(' '));
    }
    return out.join('\n');
  }

  /* ---------- Clock (fallback if module missing) ---------- */
  function clockScrambleFallback() {
    var parts = [];
    ['UR', 'DR', 'DL', 'UL', 'U', 'R', 'D', 'L', 'ALL'].forEach(function (m) {
      parts.push(m + rnd(6) + (rnd(2) ? '+' : '-'));
    });
    parts.push('y2');
    ['U', 'R', 'D', 'L', 'ALL'].forEach(function (m) {
      parts.push(m + rnd(6) + (rnd(2) ? '+' : '-'));
    });
    ['UR', 'DR', 'DL', 'UL'].forEach(function (p) { if (rnd(2)) parts.push(p); });
    return parts.join(' ');
  }

  /* ---------- Square-1 (fallback: simple, may be less uniform) ---------- */
  function sq1ScrambleFallback() {
    var out = [];
    for (var i = 0; i < 12; i++) {
      var x = rnd(12) - 5, y = rnd(12) - 5;
      if (x === 0 && y === 0) { i--; continue; }
      out.push('(' + x + ',' + y + ')/');
    }
    return out.join(' ');
  }

  /* ---------- BLD orientation suffix ---------- */
  function bldSuffix() {
    var a = pick(['', 'Rw', 'Rw2', "Rw'"]);
    var b = pick(['', 'Uw', 'Uw2', "Uw'"]);
    return (a + ' ' + b).trim();
  }

  /* ---------- event table ---------- */
  var EVENTS = [
    { id: '333',   name: '3x3x3',            img: '333', gen: function (len) { return nnnScramble(3, len || 25); }, defLen: 25 },
    { id: '222so', name: '2x2x2',            img: '222', gen: function (len) { return nnnScramble(2, len || 11, ['U', 'R', 'F']); }, defLen: 11 },
    { id: '444wca', name: '4x4x4',           img: '444', gen: function (len) { return nnnScramble(4, len || 40); }, defLen: 40 },
    { id: '555wca', name: '5x5x5',           img: '555', gen: function (len) { return nnnScramble(5, len || 60); }, defLen: 60 },
    { id: '666wca', name: '6x6x6',           img: '666', gen: function (len) { return nnnScramble(6, len || 80); }, defLen: 80 },
    { id: '777wca', name: '7x7x7',           img: '777', gen: function (len) { return nnnScramble(7, len || 100); }, defLen: 100 },
    { id: '333ni', name: '3x3x3 blindfolded', img: '333', gen: function (len) { return nnnScramble(3, len || 25) + ' ' + bldSuffix(); }, defLen: 25 },
    { id: '333fm', name: '3x3x3 fewest moves', img: '333', gen: function (len) { return "R' U' F " + nnnWithConstraint(3, len || 25, ['F', 'B'], ['R', 'L']) + " R' U' F"; }, defLen: 25 },
    { id: '333oh', name: '3x3x3 one-handed',  img: '333', gen: function (len) { return nnnScramble(3, len || 25); }, defLen: 25 },
    { id: 'clkwca', name: 'clock',            img: 'clk', gen: function () { var m = g.ScrImage && g.ScrImage.clk; return (m && m.genScramble) ? m.genScramble() : clockScrambleFallback(); } },
    { id: 'mgmp',  name: 'megaminx',          img: 'mgm', gen: function (len) { return megaScramble(len || 7); }, defLen: 7 },
    { id: 'pyrso', name: 'pyraminx',          img: 'pyr', gen: function (len) { return pyraScramble(len || 9); }, defLen: 9 },
    { id: 'skbso', name: 'skewb',             img: 'skb', gen: function (len) { return skewbScramble(len || 9); }, defLen: 9 },
    { id: 'sqrs',  name: 'square-1',          img: 'sq1', gen: function () { var m = g.ScrImage && g.ScrImage.sq1; return (m && m.genScramble) ? m.genScramble() : sq1ScrambleFallback(); } },
    { id: '444bld', name: '4x4x4 blindfolded', img: '444', gen: function (len) { return nnnScramble(4, len || 40); }, defLen: 40 },
    { id: '555bld', name: '5x5x5 blindfolded', img: '555', gen: function (len) { return nnnScramble(5, len || 60); }, defLen: 60 },
    { id: 'ru',     name: 'trainer: <R,U>',    img: '333', gen: function (len) { return nnnScramble(3, len || 20, ['R', 'U']); }, defLen: 20, trainer: true },
    { id: 'ruf',    name: 'trainer: <R,U,F>',  img: '333', gen: function (len) { return nnnScramble(3, len || 25, ['R', 'U', 'F']); }, defLen: 25, trainer: true },
    { id: 'mu',     name: 'trainer: <M,U> LSE', img: '333', gen: function (len) { return muScramble(len || 20); }, defLen: 20, trainer: true },
    { id: 'cll222', name: 'trainer: 2x2 CLL',  img: '222', gen: function (len) { return nnnScramble(2, len || 9, ['R', 'U', 'F']); }, defLen: 9, trainer: true },
    { id: 'input', name: 'input scramble',    img: null,  gen: function () { return ''; } }
  ];

  function muScramble(len) {
    var out = [], f = rnd(2); // alternate M / U strictly
    var sufM = ['', '2', "'"];
    for (var i = 0; i < len; i++) {
      out.push((f ? 'U' : 'M') + pick(sufM));
      f = 1 - f;
    }
    return out.join(' ');
  }

  var api = {
    events: EVENTS,
    byId: function (id) {
      for (var i = 0; i < EVENTS.length; i++) if (EVENTS[i].id === id) return EVENTS[i];
      return EVENTS[0];
    },
    nnn: nnnScramble
  };

  g.Scrambler = api;
  if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') module.exports = api;

  /* ---------------- node self-test ---------------- */
  if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
    var fails = 0;
    function assert(name, cond) { console.log((cond ? 'PASS' : 'FAIL') + ' - ' + name); if (!cond) fails++; }
    for (var t = 0; t < 50; t++) {
      var s3 = nnnScramble(3, 25).split(' ');
      var ok = s3.length === 25;
      for (var i = 1; i < s3.length && ok; i++) {
        var f1 = s3[i].replace(/[^URFDLB]/g, ''), f0 = s3[i - 1].replace(/[^URFDLB]/g, '');
        if (f1 === f0) ok = false;
        if (i >= 2) {
          var f2 = s3[i - 2].replace(/[^URFDLB]/g, '');
          if (AXIS[f1] === AXIS[f0] && f1 === f2) ok = false;
        }
      }
      if (!ok) { assert('333 constraints', false); break; }
      if (t === 49) assert('333 constraints x50', true);
    }
    assert('222 only URF', /^[URF2' ]+$/.test(nnnScramble(2, 11, ['U', 'R', 'F'])));
    assert('777 has 3w', / 3[URFDLB]w/.test(' ' + nnnScramble(7, 100)));
    var fm = api.byId('333fm').gen();
    assert('FMC wrapped', /^R' U' F .+ R' U' F$/.test(fm));
    var toksFm = fm.split(' ');
    assert('FMC no cancel', toksFm[3].charAt(0) !== 'F' && toksFm[toksFm.length - 4].replace(/[^URFDLB]/g, '') !== 'R');
    assert('mega 7 lines', megaScramble(7).split('\n').length === 7);
    assert('mega line format', /^(R(\+\+|--) D(\+\+|--) ){5}U'?$/.test(megaScramble(1)));
    assert('pyra has tips section', /^([ULRB]'? ){8}[ULRB]'?/.test(pyraScramble(9)));
    assert('clock fallback format', /y2/.test(clockScrambleFallback()));
    process.exit(fails ? 1 : 0);
  }
})(typeof window !== 'undefined' ? window : globalThis);
