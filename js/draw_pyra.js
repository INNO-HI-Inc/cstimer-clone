/*
 * draw_pyra.js - Pyraminx scramble diagram renderer.
 * Original implementation (no code taken from csTimer or any other project).
 *
 * Notation (WCA):
 *   U, L, R, B : 120-degree twist of the named vertex tip PLUS its adjacent
 *                second layer, clockwise as seen from outside that vertex.
 *   u, l, r, b : tip-only twists of the same vertices.
 *   A trailing apostrophe (') inverts a move. Unknown tokens are skipped.
 *
 * Orientation: F face toward the viewer, D face on the bottom.
 *   Vertices: U = top, L = front-left, R = front-right, B = back.
 *   Faces:    F = {U,L,R}, L = {U,B,L}, R = {U,R,B}, D = {B,L,R}.
 *
 * Implementation notes:
 *   The tetrahedron is modeled in 3D with its centroid at the origin and each
 *   face subdivided into 9 sticker triangles (rows of 1 / 3 / 5). The move
 *   permutations are generated at load time: sticker centroids belonging to a
 *   twisted layer are rotated -120 degrees (clockwise from outside the vertex)
 *   about the vertex axis and matched back onto the centroid set. Layer
 *   membership uses the barycentric coordinate of a centroid with respect to
 *   the twisted vertex: tip stickers sit above 2/3, tip + second layer above
 *   1/3. This derives every cycle from geometry instead of hand-written
 *   tables.
 *
 * Net layout: three upright triangles in a row (L, F, R) with D drawn as an
 * inverted triangle below F. Colors: F green, L red, R blue, D yellow.
 */
(function () {
  'use strict';

  /* ---------------- small vector helpers (3D) ---------------- */

  function vsub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function vdot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function vcross(a, b) {
    return [a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0]];
  }
  function vunit(a) {
    var l = Math.sqrt(vdot(a, a));
    return [a[0] / l, a[1] / l, a[2] / l];
  }
  /* Rodrigues rotation of p about the unit axis u (through the origin). */
  function vrot(p, u, cosA, sinA) {
    var d = vdot(u, p) * (1 - cosA);
    var c = vcross(u, p);
    return [p[0] * cosA + c[0] * sinA + u[0] * d,
            p[1] * cosA + c[1] * sinA + u[1] * d,
            p[2] * cosA + c[2] * sinA + u[2] * d];
  }

  /* ---------------- tetrahedron geometry ---------------- */

  var SQ2 = Math.SQRT2;
  var SQ3 = Math.sqrt(3);

  /* Regular tetrahedron, edge length sqrt(3), centroid at the origin.
   * x: right, y: up, z: toward the viewer. */
  var VERTEX = {
    U: [0,        0.75 * SQ2, 0],
    L: [-SQ3 / 2, -SQ2 / 4,   0.5],
    R: [SQ3 / 2,  -SQ2 / 4,   0.5],
    B: [0,        -SQ2 / 4,  -1]
  };
  var VNAMES = ['U', 'L', 'R', 'B'];

  /* trip = ordered vertex triple [net-apex, second, third] describing the face
   * exactly as it appears from OUTSIDE the puzzle. The same ordered triple is
   * used for both the 3D sticker centroids and the 2D net polygons, so sticker
   * indices in the two domains always agree. */
  var FACES = [
    { name: 'F', trip: ['U', 'L', 'R'], color: '#00d800' },
    { name: 'L', trip: ['U', 'B', 'L'], color: '#ee0000' },
    { name: 'R', trip: ['U', 'R', 'B'], color: '#0000f2' },
    { name: 'D', trip: ['B', 'L', 'R'], color: '#ffff00' }
  ];
  var STICKERS = 36; /* 4 faces x 9 */

  /* Weighted combination; works for 2D and 3D points alike. */
  function mix3(a, b, c, wa, wb, wc) {
    var out = [], i;
    for (i = 0; i < a.length; i++) out.push(a[i] * wa + b[i] * wb + c[i] * wc);
    return out;
  }

  /* Subdivide triangle (a,b,c) into 9 sticker triangles.
   * Row r (0..2) counted from the apex a; triangles listed across the row.
   * Index layout: row 0 -> 0 | row 1 -> 1,2,3 | row 2 -> 4..8. */
  function subdivide(a, b, c) {
    function g(r, k) { return mix3(a, b, c, (3 - r) / 3, (r - k) / 3, k / 3); }
    var tris = [], r, col, k;
    for (r = 0; r < 3; r++) {
      for (col = 0; col <= 2 * r; col++) {
        k = col >> 1;
        if (col % 2 === 0) {
          tris.push([g(r, k), g(r + 1, k), g(r + 1, k + 1)]);     /* points up   */
        } else {
          tris.push([g(r, k), g(r, k + 1), g(r + 1, k + 1)]);     /* points down */
        }
      }
    }
    return tris;
  }

  function triCentroid(t) { return mix3(t[0], t[1], t[2], 1 / 3, 1 / 3, 1 / 3); }

  /* 3D centroid of every sticker, face-major order. */
  var CENT = [];
  (function () {
    var f, i, tp, tris;
    for (f = 0; f < 4; f++) {
      tp = FACES[f].trip;
      tris = subdivide(VERTEX[tp[0]], VERTEX[tp[1]], VERTEX[tp[2]]);
      for (i = 0; i < 9; i++) CENT.push(triCentroid(tris[i]));
    }
  })();

  /* Barycentric coordinate of p with respect to vertex vn:
   * 1 at the vertex, 0 anywhere on the opposite face. */
  function layerCoord(p, vn) {
    var others = [], i;
    for (i = 0; i < 4; i++) {
      if (VNAMES[i] !== vn) others.push(VERTEX[VNAMES[i]]);
    }
    var q = others[0];
    var n = vcross(vsub(others[1], q), vsub(others[2], q));
    return vdot(vsub(p, q), n) / vdot(vsub(VERTEX[vn], q), n);
  }

  function nearestSticker(p) {
    var i, dx, dy, dz;
    for (i = 0; i < STICKERS; i++) {
      dx = CENT[i][0] - p[0];
      dy = CENT[i][1] - p[1];
      dz = CENT[i][2] - p[2];
      if (dx * dx + dy * dy + dz * dz < 1e-8) return i;
    }
    return -1;
  }

  /* ---------------- move tables ---------------- */

  var COS120 = -0.5;
  var SIN_CW = -SQ3 / 2;   /* -120 deg = clockwise seen from outside the vertex */
  var TABLES_OK = true;
  var MOVE = {};           /* key -> dst permutation: newState[perm[i]] = state[i] */

  (function () {
    var defs = [
      ['U', 1 / 3], ['L', 1 / 3], ['R', 1 / 3], ['B', 1 / 3], /* tip + layer */
      ['u', 2 / 3], ['l', 2 / 3], ['r', 2 / 3], ['b', 2 / 3]  /* tip only    */
    ];
    var m, vn, thr, axis, perm, i, j;
    for (m = 0; m < defs.length; m++) {
      vn = defs[m][0].toUpperCase();
      thr = defs[m][1] + 1e-6;
      axis = vunit(VERTEX[vn]);
      perm = [];
      for (i = 0; i < STICKERS; i++) perm.push(i);
      for (i = 0; i < STICKERS; i++) {
        if (layerCoord(CENT[i], vn) > thr) {
          j = nearestSticker(vrot(CENT[i], axis, COS120, SIN_CW));
          if (j < 0) { TABLES_OK = false; } else { perm[i] = j; }
        }
      }
      MOVE[defs[m][0]] = perm;
    }
  })();

  /* ---------------- state + scramble ---------------- */

  function solvedState() {
    var s = [], f, i;
    for (f = 0; f < 4; f++) for (i = 0; i < 9; i++) s.push(f);
    return s;
  }

  function permute(state, perm) {
    var ns = state.slice(), i;
    for (i = 0; i < STICKERS; i++) ns[perm[i]] = state[i];
    return ns;
  }

  var TOKEN_RE = /^([ULRBulrb])(')?$/;

  function applyScramble(state, scramble) {
    if (scramble === null || scramble === undefined) return state;
    var toks = String(scramble).split(/\s+/), i, m, t, times;
    for (i = 0; i < toks.length; i++) {
      m = TOKEN_RE.exec(toks[i]);
      if (!m) continue;                 /* unknown token: skip silently */
      times = m[2] ? 2 : 1;             /* X' === X applied twice (order 3) */
      for (t = 0; t < times; t++) state = permute(state, MOVE[m[1]]);
    }
    return state;
  }

  /* ---------------- 2D net ---------------- */

  var TH = SQ3 / 2;                 /* height of a unit-side triangle */
  var NET_W = 3;
  var NET_H = 2 * TH;

  /* 2D trip vertices (y grows downward), same face order as FACES. */
  var NET = [
    [[1.5, 0],      [1, TH], [2, TH]],  /* F upright, middle       */
    [[0.5, 0],      [0, TH], [1, TH]],  /* L upright, left         */
    [[2.5, 0],      [2, TH], [3, TH]],  /* R upright, right        */
    [[1.5, 2 * TH], [1, TH], [2, TH]]   /* D inverted, below F     */
  ];

  var POLY = [];
  (function () {
    var f;
    for (f = 0; f < 4; f++) POLY.push(subdivide(NET[f][0], NET[f][1], NET[f][2]));
  })();

  /* ---------------- rendering ---------------- */

  function draw(canvas, scramble) {
    if (!canvas || typeof canvas.getContext !== 'function') return;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var w = canvas.width || 0, h = canvas.height || 0;
    ctx.clearRect(0, 0, w, h);

    var state = applyScramble(solvedState(), scramble);

    var margin = 6;
    var sc = Math.min((w - 2 * margin) / NET_W, (h - 2 * margin) / NET_H);
    if (!(sc > 0)) sc = 1;
    var ox = (w - NET_W * sc) / 2;
    var oy = (h - NET_H * sc) / 2;

    ctx.lineWidth = 1;
    ctx.strokeStyle = '#000';
    ctx.lineJoin = 'round';

    var f, i, k, tri;
    for (f = 0; f < 4; f++) {
      for (i = 0; i < 9; i++) {
        tri = POLY[f][i];
        ctx.beginPath();
        for (k = 0; k < 3; k++) {
          if (k === 0) ctx.moveTo(ox + tri[k][0] * sc, oy + tri[k][1] * sc);
          else ctx.lineTo(ox + tri[k][0] * sc, oy + tri[k][1] * sc);
        }
        ctx.closePath();
        ctx.fillStyle = FACES[state[f * 9 + i]].color;
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  /* ---------------- registration ---------------- */

  var api = {
    draw: draw,
    _internals: {
      solvedState: solvedState,
      applyScramble: applyScramble,
      moves: MOVE,
      tablesOk: function () { return TABLES_OK; }
    }
  };

  var g = (typeof window !== 'undefined') ? window : globalThis;
  g.ScrImage = g.ScrImage || {};
  g.ScrImage['pyr'] = api;
  if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = api;
  }

  /* ---------------- Node self-test ---------------- */

  if (typeof require !== 'undefined' && typeof module !== 'undefined' &&
      require.main === module) {
    (function () {
      var failures = 0;

      function check(name, cond) {
        console.log((cond ? 'PASS' : 'FAIL') + ' - ' + name);
        if (!cond) failures++;
      }
      function eq(a, b) {
        if (a.length !== b.length) return false;
        for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
        return true;
      }
      function diffCount(a, b) {
        var n = 0, i;
        for (i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
        return n;
      }
      function noop() {}
      var stubCtx = {
        beginPath: noop, moveTo: noop, lineTo: noop, closePath: noop,
        fill: noop, stroke: noop, clearRect: noop, save: noop, restore: noop,
        translate: noop, scale: noop, rotate: noop, arc: noop,
        fillRect: noop, strokeRect: noop, setTransform: noop
      };
      var canvas = { width: 420, height: 300, getContext: function () { return stubCtx; } };

      var solved = solvedState();
      var keys = ['U', 'L', 'R', 'B', 'u', 'l', 'r', 'b'];
      var i, j, k, s, ok, threw;

      /* move tables must be valid bijections */
      ok = TABLES_OK;
      for (i = 0; i < keys.length; i++) {
        var sorted = MOVE[keys[i]].slice().sort(function (a, b) { return a - b; });
        for (j = 0; j < STICKERS; j++) if (sorted[j] !== j) ok = false;
      }
      check('move tables are valid permutations', ok);

      /* (1) each move applied 3x returns to solved */
      for (i = 0; i < keys.length; i++) {
        k = keys[i];
        s = applyScramble(solved, k + ' ' + k + ' ' + k);
        check("'" + k + "' x3 returns to solved", eq(s, solved));
      }

      /* (2) X followed by X' = solved */
      for (i = 0; i < keys.length; i++) {
        k = keys[i];
        s = applyScramble(solved, k + ' ' + k + "'");
        check("'" + k + " " + k + "'' returns to solved", eq(s, solved));
      }

      /* (3) tip moves change exactly 3 stickers */
      var tips = ['u', 'l', 'r', 'b'];
      for (i = 0; i < tips.length; i++) {
        s = applyScramble(solved, tips[i]);
        check("tip '" + tips[i] + "' changes exactly 3 stickers",
              diffCount(s, solved) === 3);
      }

      /* (4) capital moves change exactly 12 stickers, 4 on each of 3 faces */
      var caps = ['U', 'L', 'R', 'B'];
      for (i = 0; i < caps.length; i++) {
        s = applyScramble(solved, caps[i]);
        var perFace = [0, 0, 0, 0];
        for (j = 0; j < STICKERS; j++) if (s[j] !== solved[j]) perFace[(j / 9) | 0]++;
        perFace.sort(function (a, b) { return a - b; });
        check("capital '" + caps[i] + "' changes exactly 12 stickers (4 on each of 3 faces)",
              diffCount(s, solved) === 12 &&
              perFace[0] === 0 && perFace[1] === 4 &&
              perFace[2] === 4 && perFace[3] === 4);
      }

      /* direction sanity: U is clockwise seen from the top vertex, so the top
       * block of F takes the R-face colour, L takes F's, R takes L's; D is
       * untouched. Face indices: F=0, L=1, R=2, D=3. */
      s = applyScramble(solved, 'U');
      ok = s[0] === 2 && s[1] === 2 && s[2] === 2 && s[3] === 2 &&   /* F <- R */
           s[9] === 0 && s[10] === 0 && s[11] === 0 && s[12] === 0 && /* L <- F */
           s[18] === 1 && s[19] === 1 && s[20] === 1 && s[21] === 1;  /* R <- L */
      for (j = 27; j < 36; j++) if (s[j] !== 3) ok = false;           /* D solid */
      check("'U' cycles F->L->R->F clockwise and leaves D untouched", ok);

      /* (5) draw with a real scramble on the stub canvas does not throw */
      threw = false;
      try { api.draw(canvas, "R U R' U' l b u"); } catch (e1) { threw = true; }
      check("draw(canvas, \"R U R' U' l b u\") does not throw", !threw);

      /* (6) draw with empty / null scramble does not throw */
      threw = false;
      try { api.draw(canvas, ''); api.draw(canvas, null); } catch (e2) { threw = true; }
      check('draw(canvas, "") and draw(canvas, null) do not throw', !threw);

      /* unknown tokens are skipped silently */
      threw = false;
      s = null;
      try { s = applyScramble(solved, "U2 x Rw ?? U U'"); } catch (e3) { threw = true; }
      check('unknown tokens are skipped silently', !threw && s !== null && eq(s, solved));

      console.log(failures === 0 ? 'ALL TESTS PASSED'
                                 : failures + ' TEST(S) FAILED');
      if (failures) process.exit(1);
    })();
  }
})();
