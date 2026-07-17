/*
 * draw_skewb.js - Skewb scramble diagram renderer.
 * Original implementation (no code taken from csTimer or any other project).
 *
 * =========================================================================
 * Skewb corner convention (WCA / TNoodle fixed-corner notation)
 * =========================================================================
 * The WCA regulations (12h, as quoted by the speedsolving.com wiki page
 * "Skewb notation") define the moves relative to a FIXED corner held toward
 * the scrambler: with the standard color scheme (white up, green front,
 * red right) the fixed corner is UFR (white/green/red). The four moves twist
 * the four other twist axes, i.e. the corners:
 *
 *   U -> the UBL corner  ("farthest visible upper vertex")
 *   R -> the DBR corner  ("farthest visible bottom-right vertex")
 *   L -> the DFL corner  ("farthest visible bottom-left vertex")
 *   B -> the DBL corner  ("farthest non-visible back vertex")
 *
 * Each move is a 120-degree twist of the puzzle half that contains the named
 * corner, CLOCKWISE as seen looking straight at that corner from outside the
 * puzzle; a trailing apostrophe (') means counterclockwise. These four
 * corners lie on the four distinct space diagonals and none of the four
 * halves contains UFR, so the fixed corner indeed never moves.
 * (References consulted for notation semantics only: WCA regulations via the
 * speedsolving.com wiki, and meep.cubing.net/skewb-fcn.html.)
 * =========================================================================
 *
 * Implementation notes:
 *   The cube spans [-1,1]^3; x: right (R), y: up (U), z: toward viewer (F).
 *   Each face carries 5 stickers: 4 corner triangles + 1 center diamond.
 *   Move permutations are generated at load time: sticker centroids on the
 *   moving half (positive dot product with the corner axis - the skewb cut
 *   plane passes through the cube center perpendicular to each diagonal) are
 *   rotated -120 degrees about that diagonal and matched back onto the
 *   centroid set. All cycles are thus derived from geometry, not hand-typed.
 *
 * Net layout: cube cross - U on top, L F R B in a row, D below F.
 * Colors: U white, R red, F green, D yellow, L orange, B blue.
 */
(function () {
  'use strict';

  /* ---------------- small vector helpers (3D) ---------------- */

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

  /* ---------------- cube geometry ---------------- */

  var SQ3 = Math.sqrt(3);

  /* corners: the face's 4 cube corners in net order [TL, TR, BR, BL] as the
   * face appears from OUTSIDE the puzzle when the cross net is folded up.
   * net: [column, row] cell of the face inside the cross.
   * The same [TL, TR, BR, BL] ordering builds both the 3D sticker centroids
   * and the 2D net polygons, so sticker indices always agree. */
  var FACES = [
    { name: 'U', color: '#ffffff', net: [1, 0],
      corners: [[-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]] },
    { name: 'R', color: '#ee0000', net: [2, 1],
      corners: [[1, 1, 1], [1, 1, -1], [1, -1, -1], [1, -1, 1]] },
    { name: 'F', color: '#00d800', net: [1, 1],
      corners: [[-1, 1, 1], [1, 1, 1], [1, -1, 1], [-1, -1, 1]] },
    { name: 'D', color: '#ffff00', net: [1, 2],
      corners: [[-1, -1, 1], [1, -1, 1], [1, -1, -1], [-1, -1, -1]] },
    { name: 'L', color: '#ff8000', net: [0, 1],
      corners: [[-1, 1, -1], [-1, 1, 1], [-1, -1, 1], [-1, -1, -1]] },
    { name: 'B', color: '#0000f2', net: [3, 1],
      corners: [[1, 1, -1], [-1, 1, -1], [-1, -1, -1], [1, -1, -1]] }
  ];
  var STICKERS = 30; /* 6 faces x 5 */

  function mid(a, b) {
    var out = [], i;
    for (i = 0; i < a.length; i++) out.push((a[i] + b[i]) / 2);
    return out;
  }

  /* Build the 5 sticker polygons of one face from its 4 ordered corners:
   * indices 0..3 = corner triangles at TL, TR, BR, BL; index 4 = center
   * diamond spanned by the 4 edge midpoints. Works for 2D and 3D points. */
  function faceStickers(c) {
    var m = [], polys = [], i;
    for (i = 0; i < 4; i++) m.push(mid(c[i], c[(i + 1) % 4]));
    for (i = 0; i < 4; i++) polys.push([m[(i + 3) % 4], c[i], m[i]]);
    polys.push([m[0], m[1], m[2], m[3]]);
    return polys;
  }

  function polyCentroid(poly) {
    var out = [], i, k;
    for (k = 0; k < poly[0].length; k++) {
      var s = 0;
      for (i = 0; i < poly.length; i++) s += poly[i][k];
      out.push(s / poly.length);
    }
    return out;
  }

  /* 3D centroid of every sticker, face-major order. */
  var CENT = [];
  (function () {
    var f, i, polys;
    for (f = 0; f < 6; f++) {
      polys = faceStickers(FACES[f].corners);
      for (i = 0; i < 5; i++) CENT.push(polyCentroid(polys[i]));
    }
  })();

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

  /* Twisted corner of each move (see convention block at the top). */
  var MOVE_CORNER = {
    U: [-1,  1, -1],  /* UBL */
    R: [ 1, -1, -1],  /* DBR */
    L: [-1, -1,  1],  /* DFL */
    B: [-1, -1, -1]   /* DBL */
  };

  var COS120 = -0.5;
  var SIN_CW = -SQ3 / 2;  /* -120 deg = clockwise seen from outside the corner */
  var TABLES_OK = true;
  var MOVE = {};          /* key -> dst permutation: newState[perm[i]] = state[i] */

  (function () {
    var keys = ['U', 'R', 'L', 'B'];
    var m, axis, perm, i, j;
    for (m = 0; m < keys.length; m++) {
      axis = vunit(MOVE_CORNER[keys[m]]);
      perm = [];
      for (i = 0; i < STICKERS; i++) perm.push(i);
      for (i = 0; i < STICKERS; i++) {
        /* The cut plane for each diagonal passes through the cube center, so
         * the moving half is simply the positive side of the axis. */
        if (vdot(CENT[i], axis) > 0.01) {
          j = nearestSticker(vrot(CENT[i], axis, COS120, SIN_CW));
          if (j < 0) { TABLES_OK = false; } else { perm[i] = j; }
        }
      }
      MOVE[keys[m]] = perm;
    }
  })();

  /* ---------------- state + scramble ---------------- */

  function solvedState() {
    var s = [], f, i;
    for (f = 0; f < 6; f++) for (i = 0; i < 5; i++) s.push(f);
    return s;
  }

  function permute(state, perm) {
    var ns = state.slice(), i;
    for (i = 0; i < STICKERS; i++) ns[perm[i]] = state[i];
    return ns;
  }

  var TOKEN_RE = /^([URLB])(')?$/;

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

  var GAP = 0.08;                   /* spacing between the net squares */
  var CELL = 1 + GAP;
  var NET_W = 4 + 3 * GAP;
  var NET_H = 3 + 2 * GAP;

  var POLY = [];                    /* POLY[f][i] = 2D sticker polygon */
  (function () {
    var f, x, y, sq;
    for (f = 0; f < 6; f++) {
      x = FACES[f].net[0] * CELL;
      y = FACES[f].net[1] * CELL;
      sq = [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]]; /* TL TR BR BL */
      POLY.push(faceStickers(sq));
    }
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

    var f, i, k, poly;
    for (f = 0; f < 6; f++) {
      for (i = 0; i < 5; i++) {
        poly = POLY[f][i];
        ctx.beginPath();
        for (k = 0; k < poly.length; k++) {
          if (k === 0) ctx.moveTo(ox + poly[k][0] * sc, oy + poly[k][1] * sc);
          else ctx.lineTo(ox + poly[k][0] * sc, oy + poly[k][1] * sc);
        }
        ctx.closePath();
        ctx.fillStyle = FACES[state[f * 5 + i]].color;
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
  g.ScrImage['skb'] = api;
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
      var keys = ['R', 'U', 'L', 'B'];
      var i, j, k, s, n, ok, threw;

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

      /* (3) one move changes at least 9 and at most 15 stickers
       * (geometrically it is exactly 15: 4 corner pieces x 3 + 3 centers). */
      for (i = 0; i < keys.length; i++) {
        k = keys[i];
        n = diffCount(applyScramble(solved, k), solved);
        check("'" + k + "' changes between 9 and 15 stickers (got " + n + ")",
              n >= 9 && n <= 15);
        check("'" + k + "' changes exactly 15 stickers", n === 15);
      }

      /* fixed-corner convention: the UFR corner stickers (U net-BR, R net-TL,
       * F net-TR) must survive every single move untouched.
       * Face order U,R,F,D,L,B -> global indices 2, 5, 11. */
      ok = true;
      for (i = 0; i < keys.length; i++) {
        s = applyScramble(solved, keys[i]);
        if (s[2] !== 0 || s[5] !== 1 || s[11] !== 2) ok = false;
      }
      check('fixed corner UFR is untouched by all four moves', ok);

      /* direction sanity: U twists UBL clockwise, so the U-face material goes
       * to L and U receives from B (blue). U center = global index 4. */
      s = applyScramble(solved, 'U');
      check("'U' clockwise brings the B colour onto the U center", s[4] === 5);

      /* (4) draw with a scramble containing an invalid token does not throw */
      threw = false;
      try { api.draw(canvas, "R U' L B r?"); } catch (e1) { threw = true; }
      check("draw(canvas, \"R U' L B r?\") skips 'r?' and does not throw", !threw);

      /* invalid token really is a no-op */
      ok = eq(applyScramble(solved, "R U' L B r?"),
              applyScramble(solved, "R U' L B"));
      check("token 'r?' is skipped silently (state unchanged by it)", ok);

      /* (5) draw with empty / null scramble does not throw */
      threw = false;
      try { api.draw(canvas, ''); api.draw(canvas, null); } catch (e2) { threw = true; }
      check('draw(canvas, "") and draw(canvas, null) do not throw', !threw);

      console.log(failures === 0 ? 'ALL TESTS PASSED'
                                 : failures + ' TEST(S) FAILED');
      if (failures) process.exit(1);
    })();
  }
})();
