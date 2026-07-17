/*
 * draw_sq1.js - Square-1 scramble diagram renderer + random-move scrambler.
 * Original implementation (no code taken from csTimer or any other project).
 *
 * Notation (WCA regulation 12c, TNoodle-compatible):
 *   (x,y) : turn the upper layer x*30 degrees and the lower layer y*30
 *           degrees.  Positive x = clockwise as seen from ABOVE the top
 *           layer.  Positive y = clockwise as seen from BELOW the bottom
 *           layer (i.e. counterclockwise when watched from above through
 *           the puzzle).  This mirrored pair is the convention used by
 *           WCA/TNoodle scrambles: from the solved puzzle "(0,-1)/" and
 *           "(1,0)/" are legal openers while "(0,1)/" and "(-1,0)/" are
 *           not, which matches real published scrambles.
 *   /     : turn the right half of the puzzle 180 degrees about the axis
 *           normal to the slice plane.  Canonical range is x,y in -5..6;
 *           any integers are accepted and reduced mod 12.
 *
 * Solved orientation & colours (documented side-colour assignment):
 *   U = #ffffff (white,  top face)      D = #ffff00 (yellow, bottom face)
 *   F = #00d800 (green,  front)         B = #0000f2 (blue,   back)
 *   R = #ee0000 (red,    right)         L = #ff8000 (orange, left)
 *   Per WCA 12c the puzzle is held with one of the two smallest surfaces
 *   of the equatorial slice on the left side of the front face; with that
 *   grip the slice plane crosses the top rim 15 degrees clockwise from
 *   back-centre (azimuth 15/195 as seen from above).
 *
 * Model:
 *   Each layer is an array of 12 slots of 30 degrees, indexed clockwise AS
 *   SEEN FROM ABOVE (the bottom layer is stored in this same "see-through"
 *   frame).  Slot k spans azimuth [15+30k, 45+30k), azimuth 0 = back.
 *   An edge fills 1 slot, a corner fills 2 consecutive slots (both slots
 *   hold the same piece object).  The slice plane sits at the slot 11|0
 *   and slot 5|6 boundaries; "/" swaps top[i] with bottom[5-i] (i=0..5)
 *   and reverses the side-sticker order of every piece that crosses
 *   (the half is rotated 180 degrees, so clockwise order flips).  "/" is
 *   legal only when no corner straddles either boundary in either layer.
 *   The middle layer is a single boolean (square / offset) toggled by
 *   every "/".
 *
 * Diagram (draw):
 *   Two 12-slice pie views side by side.
 *     Left  circle: TOP layer viewed from above, back of the puzzle at the
 *                   top of the circle.
 *     Right circle: BOTTOM layer viewed from BELOW, as if the puzzle were
 *                   tipped forward toward the viewer (180-degree turn about
 *                   the left-right axis) - so the FRONT of the puzzle is at
 *                   the top of that circle.  This is the usual "unfold the
 *                   D face toward you" convention of cube nets.
 *   Every piece: inner wedge filled with its top/bottom sticker colour plus
 *   an outer rim band with its side sticker(s) (corner = 2 rim segments,
 *   edge = 1).  A small two-segment bar below the circles shows the middle
 *   layer as seen from the front: the left segment is always F-coloured
 *   (that half never moves); the right segment is F-coloured when the
 *   middle layer is square and B-coloured when it is offset (an odd number
 *   of slashes leaves the old back sticker facing front).
 *   Flat polygons, 1px #000 stroke, transparent background, ~6px margin.
 */
(function () {
  'use strict';

  var COL = {
    U: '#ffffff',
    D: '#ffff00',
    F: '#00d800',
    R: '#ee0000',
    B: '#0000f2',
    L: '#ff8000'
  };

  /* ---------------- state helpers ---------------- */

  function m12(n) {
    n = n % 12;
    return n < 0 ? n + 12 : n;
  }

  function edge(face, side) {
    return { w: 1, face: face, sides: [side] };
  }

  function corner(face, sideA, sideB) {
    /* sideA / sideB in clockwise order (seen from above) */
    return { w: 2, face: face, sides: [sideA, sideB] };
  }

  /* One solved layer, slots clockwise-from-above starting at the slice
   * boundary.  Both layers look identical in this frame: corner first.
   *   slots 0,1  corner (back , right)   slot 2  edge (right)
   *   slots 3,4  corner (right, front)   slot 5  edge (front)
   *   slots 6,7  corner (front, left )   slot 8  edge (left)
   *   slots 9,10 corner (left , back )   slot 11 edge (back)
   */
  function solvedLayer(face) {
    var pieces = [
      corner(face, COL.B, COL.R), edge(face, COL.R),
      corner(face, COL.R, COL.F), edge(face, COL.F),
      corner(face, COL.F, COL.L), edge(face, COL.L),
      corner(face, COL.L, COL.B), edge(face, COL.B)
    ];
    var slots = [], i, k;
    for (i = 0; i < pieces.length; i++) {
      for (k = 0; k < pieces[i].w; k++) slots.push(pieces[i]);
    }
    return slots; /* length 12 */
  }

  function solvedState() {
    return {
      top: solvedLayer(COL.U),
      bottom: solvedLayer(COL.D),
      middleSquare: true
    };
  }

  /* Rotate a layer's contents by `shift` slots clockwise (see-through
   * frame).  Top turn x -> shift = +x ; bottom turn y -> shift = -y
   * (positive y is clockwise seen from below = ccw seen from above). */
  function turnLayer(slots, shift) {
    var out = new Array(12), i;
    shift = m12(shift);
    for (i = 0; i < 12; i++) out[m12(i + shift)] = slots[i];
    return out;
  }

  function applyTurn(state, x, y) {
    state.top = turnLayer(state.top, m12(x));
    state.bottom = turnLayer(state.bottom, m12(-y));
  }

  /* Would the layer allow a slice after being shifted by `shift` slots?
   * (Checks that no corner straddles the slot 11|0 or 5|6 boundary.) */
  function shiftedSliceable(slots, shift) {
    shift = m12(shift);
    return slots[m12(0 - shift)] !== slots[m12(11 - shift)] &&
           slots[m12(6 - shift)] !== slots[m12(5 - shift)];
  }

  function turnLegal(state, x, y) {
    return shiftedSliceable(state.top, x) &&
           shiftedSliceable(state.bottom, -y);
  }

  function canSlice(state) {
    return shiftedSliceable(state.top, 0) &&
           shiftedSliceable(state.bottom, 0);
  }

  /* "/" : swap top[i] <-> bottom[5-i] for i = 0..5.  Pieces that cross are
   * physically rotated 180 degrees, so their clockwise side order flips. */
  function doSlice(state) {
    var nt = state.top.slice();
    var nb = state.bottom.slice();
    var moved = [];      /* [original, flipped copy] pairs */
    var i;

    function flipped(p) {
      var k, q;
      for (k = 0; k < moved.length; k++) {
        if (moved[k][0] === p) return moved[k][1];
      }
      q = {
        w: p.w,
        face: p.face,
        sides: p.w === 2 ? [p.sides[1], p.sides[0]] : [p.sides[0]]
      };
      moved.push([p, q]);
      return q;
    }

    for (i = 0; i < 6; i++) {
      nt[i] = flipped(state.bottom[5 - i]);
      nb[5 - i] = flipped(state.top[i]);
    }
    state.top = nt;
    state.bottom = nb;
    state.middleSquare = !state.middleSquare;
  }

  /* Parse a scramble string and apply it.  Malformed tokens are skipped.
   * In strict mode an illegal "/" aborts and returns false; otherwise the
   * illegal slash is silently skipped.  Never throws for string input. */
  function applyScramble(state, scramble, strict) {
    var re = /\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)|\//g;
    var ok = true, m;
    if (typeof scramble !== 'string' || scramble === '') return ok;
    while ((m = re.exec(scramble)) !== null) {
      if (m[1] === undefined) {           /* "/" */
        if (canSlice(state)) {
          doSlice(state);
        } else {
          ok = false;
          if (strict) return false;
        }
      } else {                            /* "(x,y)" */
        applyTurn(state, parseInt(m[1], 10), parseInt(m[2], 10));
      }
    }
    return ok;
  }

  /* ---------------- scramble generation ---------------- */

  /* Random-move scramble: 11-13 moves of the form "(x,y)/" where (x,y) is
   * drawn uniformly from all pairs (x,y in -5..6, not both zero) that leave
   * the puzzle sliceable, then "/" is applied.  x=0/y=0 and x=6/y=6 are
   * always legal right after a slash, so the pool is never empty. */
  function genScramble() {
    var state = solvedState();
    var count = 11 + Math.floor(Math.random() * 3);
    var out = [];
    var n, x, y, xs, ys, pairs, i, j, pick;

    for (n = 0; n < count; n++) {
      xs = [];
      ys = [];
      for (x = -5; x <= 6; x++) {
        if (shiftedSliceable(state.top, x)) xs.push(x);
      }
      for (y = -5; y <= 6; y++) {
        if (shiftedSliceable(state.bottom, -y)) ys.push(y);
      }
      pairs = [];
      for (i = 0; i < xs.length; i++) {
        for (j = 0; j < ys.length; j++) {
          if (xs[i] !== 0 || ys[j] !== 0) pairs.push([xs[i], ys[j]]);
        }
      }
      pick = pairs[Math.floor(Math.random() * pairs.length)];
      applyTurn(state, pick[0], pick[1]);
      if (!canSlice(state)) {
        /* cannot happen: pairs were pre-filtered for legality */
        throw new Error('draw_sq1: generated an illegal slice');
      }
      doSlice(state);
      out.push('(' + pick[0] + ',' + pick[1] + ')/');
    }
    return out.join(' ');
  }

  /* ---------------- drawing ---------------- */

  /* Screen angle (degrees clockwise from 12 o'clock) of slot boundary k.
   * Top: back of puzzle at the top of the circle -> boundary k at 15+30k.
   * Bottom: viewed from below (puzzle tipped forward, front at the top of
   * the circle) -> see-through azimuth a is drawn at 180 - a.            */
  function boundaryAngle(k, isBottom) {
    return isBottom ? 165 - 30 * k : 15 + 30 * k;
  }

  function polar(cx, cy, r, deg) {
    var a = deg * Math.PI / 180;
    return [cx + r * Math.sin(a), cy - r * Math.cos(a)];
  }

  function polygon(ctx, pts, fill) {
    var i;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.stroke();
  }

  function drawLayer(ctx, cx, cy, R, slots, isBottom) {
    var rIn = R * 0.76;
    var starts = [], i, s, p, k, a0, a1, pts;

    for (i = 0; i < 12; i++) {
      if (slots[i] !== slots[m12(i - 1)]) starts.push(i);
    }
    for (i = 0; i < starts.length; i++) {
      s = starts[i];
      p = slots[s];
      /* face wedge (one polygon per piece; corners get a mid vertex so the
       * inner region reads as a regular 12-gon pie) */
      pts = [[cx, cy]];
      for (k = 0; k <= p.w; k++) {
        pts.push(polar(cx, cy, rIn, boundaryAngle(s + k, isBottom)));
      }
      polygon(ctx, pts, p.face);
      /* rim band: one 30-degree segment per side sticker */
      for (k = 0; k < p.w; k++) {
        a0 = boundaryAngle(s + k, isBottom);
        a1 = boundaryAngle(s + k + 1, isBottom);
        polygon(ctx, [
          polar(cx, cy, rIn, a0),
          polar(cx, cy, R, a0),
          polar(cx, cy, R, a1),
          polar(cx, cy, rIn, a1)
        ], p.sides[k]);
      }
    }
  }

  function draw(canvas, scramble) {
    var ctx, W, H, M, gap, barH, pad, R, totalW, totalH, x0, y0, cy;
    var state, barW, bx, by;
    try {
      if (!canvas || typeof canvas.getContext !== 'function') return;
      ctx = canvas.getContext('2d');
      if (!ctx) return;

      state = solvedState();
      applyScramble(state, scramble, false);

      W = canvas.width || 0;
      H = canvas.height || 0;
      ctx.clearRect(0, 0, W, H);

      M = 6;                       /* outer margin */
      gap = 12;                    /* gap between the two circles */
      barH = 10;                   /* middle-layer indicator height */
      pad = 6;                     /* space above the indicator */
      R = Math.min((W - 2 * M - gap) / 4, (H - 2 * M - barH - pad) / 2);
      if (!(R > 2)) R = 2;

      totalW = 4 * R + gap;
      totalH = 2 * R + pad + barH;
      x0 = (W - totalW) / 2;
      y0 = (H - totalH) / 2;
      cy = y0 + R;

      ctx.lineWidth = 1;
      ctx.strokeStyle = '#000000';
      ctx.lineJoin = 'round';

      drawLayer(ctx, x0 + R, cy, R, state.top, false);
      drawLayer(ctx, x0 + 3 * R + gap, cy, R, state.bottom, true);

      /* middle layer seen from the front: left half never moves (F colour);
       * right half shows F when square, B when offset. */
      barW = 2 * R;
      bx = (W - barW) / 2;
      by = y0 + 2 * R + pad;
      ctx.fillStyle = COL.F;
      ctx.fillRect(bx, by, barW / 2, barH);
      ctx.strokeRect(bx, by, barW / 2, barH);
      ctx.fillStyle = state.middleSquare ? COL.F : COL.B;
      ctx.fillRect(bx + barW / 2, by, barW / 2, barH);
      ctx.strokeRect(bx + barW / 2, by, barW / 2, barH);
    } catch (e) {
      /* a diagram must never take the timer down */
    }
  }

  /* ---------------- registration ---------------- */

  var api = { draw: draw, genScramble: genScramble };

  var g = (typeof window !== 'undefined') ? window : globalThis;
  g.ScrImage = g.ScrImage || {};
  g.ScrImage['sq1'] = api;
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

      function stubCanvas() {
        var noop = function () {};
        var names = ['clearRect', 'beginPath', 'moveTo', 'lineTo',
                     'closePath', 'fill', 'stroke', 'fillRect',
                     'strokeRect', 'save', 'restore', 'arc', 'translate'];
        var ctx = {}, i;
        for (i = 0; i < names.length; i++) ctx[names[i]] = noop;
        return {
          width: 420,
          height: 300,
          getContext: function () { return ctx; }
        };
      }

      /* structural signature of a state (piece boundaries included) */
      function sig(state) {
        var parts = [state.middleSquare ? 'sq' : 'off'];
        function layerSig(slots) {
          var i, p, s = '';
          for (i = 0; i < 12; i++) {
            p = slots[i];
            s += (slots[i] !== slots[m12(i - 1)] ? '|' : '.') +
                 p.w + p.face + p.sides.join('');
          }
          return s;
        }
        parts.push(layerSig(state.top));
        parts.push(layerSig(state.bottom));
        return parts.join(' ');
      }

      function distinctPieces(slots) {
        var seen = [], i;
        for (i = 0; i < 12; i++) {
          if (seen.indexOf(slots[i]) < 0) seen.push(slots[i]);
        }
        return seen;
      }

      function unitsOf(slots) {
        var pieces = distinctPieces(slots), total = 0, i;
        for (i = 0; i < pieces.length; i++) total += pieces[i].w;
        return total;
      }

      /* re-apply a scramble move by move, insisting every slash is legal */
      function strictReplay(scr) {
        var st = solvedState();
        return applyScramble(st, scr, true) ? st : null;
      }

      var st, st2, s0, i, j, scr, slashes, tokens, ok, threw, canvas;

      /* (1) solved state sums to 12 units per layer */
      st = solvedState();
      check('solved: top layer sums to 12 units', unitsOf(st.top) === 12);
      check('solved: bottom layer sums to 12 units', unitsOf(st.bottom) === 12);
      check('solved: 8 pieces per layer',
            distinctPieces(st.top).length === 8 &&
            distinctPieces(st.bottom).length === 8);

      /* (2) identities */
      st = solvedState();
      s0 = sig(st);
      applyScramble(st, '(6,6) (6,6)', false);
      check('"(6,6)" twice is the identity', sig(st) === s0);

      st = solvedState();
      applyScramble(st, '/ /', false);
      check('"/" twice is the identity', sig(st) === s0);

      st = solvedState();
      applyScramble(st, '(12,0)', false);
      check('"(12,0)" is the identity (mod-12 handling)', sig(st) === s0);

      st = solvedState();
      applyScramble(st, '(1,-1) (-1,1)', false);
      check('"(1,-1) (-1,1)" is the identity', sig(st) === s0);

      /* slice-orientation regression: one "/" from solved must give the
       * scallop/scallop shape (adjacent edge pair at slots 11,0 and
       * adjacent corner pair at slots 4,5 / 6,7 in both layers) */
      st = solvedState();
      applyScramble(st, '/', false);
      ok = true;
      var lays = [st.top, st.bottom];
      for (i = 0; i < 2; i++) {
        ok = ok &&
          lays[i][11].w === 1 && lays[i][0].w === 1 &&
          lays[i][11] !== lays[i][0] &&
          lays[i][4] === lays[i][5] && lays[i][6] === lays[i][7] &&
          lays[i][5] !== lays[i][6];
      }
      check('single "/" from solved gives scallop/scallop', ok);
      check('single "/" marks middle layer as offset', st.middleSquare === false);

      /* (3) genScramble: 11-13 slashes, all legal, sane state afterwards */
      scr = genScramble();
      slashes = (scr.match(/\//g) || []).length;
      check('genScramble(): 11-13 slashes (' + slashes + ')',
            slashes >= 11 && slashes <= 13);
      tokens = scr.match(/\(-?\d+,-?\d+\)\//g) || [];
      check('genScramble(): every move is of the form "(x,y)/"',
            tokens.length === slashes &&
            tokens.join(' ') === scr);
      st = strictReplay(scr);
      check('genScramble(): every "/" legal on strict replay', st !== null);
      check('genScramble(): layers still sum to 12 units',
            st !== null && unitsOf(st.top) === 12 && unitsOf(st.bottom) === 12);

      /* (4) parse robustness */
      canvas = stubCanvas();
      threw = false;
      try { api.draw(canvas, '(0,-1)/ garbage (3,0)/'); } catch (e1) { threw = true; }
      check('draw(stub, "(0,-1)/ garbage (3,0)/") does not throw', !threw);
      threw = false;
      try {
        api.draw(canvas, '');
        api.draw(canvas, null);
        api.draw(canvas, '(1,1)/ ///');   /* contains an illegal slash */
        api.draw(canvas, '(');
      } catch (e2) { threw = true; }
      check('draw() with empty / null / illegal input does not throw', !threw);

      /* (5) 50 generated scrambles are all valid */
      ok = true;
      try {
        for (i = 0; i < 50 && ok; i++) {
          scr = genScramble();
          slashes = (scr.match(/\//g) || []).length;
          if (slashes < 11 || slashes > 13) ok = false;
          tokens = scr.match(/\((-?\d+),(-?\d+)\)\//g) || [];
          if (tokens.length !== slashes) ok = false;
          for (j = 0; j < tokens.length; j++) {
            var m = /\((-?\d+),(-?\d+)\)/.exec(tokens[j]);
            var mx = parseInt(m[1], 10), my = parseInt(m[2], 10);
            if (mx < -5 || mx > 6 || my < -5 || my > 6) ok = false;
            if (mx === 0 && my === 0) ok = false;
          }
          st = strictReplay(scr);
          if (st === null) ok = false;
          else {
            if (unitsOf(st.top) !== 12 || unitsOf(st.bottom) !== 12) ok = false;
            /* sticker conservation: 8 U faces, 8 D faces, 6 of each side */
            var all = distinctPieces(st.top).concat(distinctPieces(st.bottom));
            var tally = {};
            for (j = 0; j < all.length; j++) {
              tally[all[j].face] = (tally[all[j].face] || 0) + 1;
              for (var k2 = 0; k2 < all[j].sides.length; k2++) {
                tally[all[j].sides[k2]] = (tally[all[j].sides[k2]] || 0) + 1;
              }
            }
            if (tally[COL.U] !== 8 || tally[COL.D] !== 8 ||
                tally[COL.F] !== 6 || tally[COL.R] !== 6 ||
                tally[COL.B] !== 6 || tally[COL.L] !== 6) ok = false;
          }
        }
      } catch (e3) { ok = false; }
      check('50 x genScramble(): no exceptions, all valid', ok);

      console.log(failures === 0 ? 'ALL TESTS PASSED'
                                 : failures + ' TEST(S) FAILED');
      if (failures) process.exit(1);
    })();
  }
})();
