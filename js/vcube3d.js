/* vcube3d.js — pure 3D NxN cube engine + Canvas2D software renderer (original code)
 *
 * NO dependencies except js/draw_nnn.js (window.ScrImage.nnn) which owns ALL move logic.
 * This file NEVER reimplements move application — it only maps facelets to 3D space,
 * animates layer turns, and rasterises the result with a tiny software 3D pipeline.
 *
 * ============================================================================
 * FACELET <-> 3D MAPPING  (derived from the header of js/draw_nnn.js)
 * ============================================================================
 * draw_nnn.js storage orientation (verbatim):
 *   Faces: 0=U 1=R 2=F 3=D 4=L 5=B, each face n*n row-major.
 *   U: viewed from top,           row0 adjacent B, col0 adjacent L
 *   D: viewed from below(net),    row0 adjacent F, col0 adjacent L
 *   side faces: row0 adjacent U;  col0 adjacent: F->L, R->F, B->R, L->B
 *
 * World axes (right-handed):  +x = R,  +y = U,  +z = F  (toward the viewer).
 * Cubie coordinates run -c0 .. +c0 in steps of 1, where c0 = (n-1)/2.
 *
 *   f=0 U : pos = ( c-c0,  c0  ,  r-c0 )   normal ( 0, 1, 0)
 *   f=1 R : pos = ( c0  ,  c0-r,  c0-c )   normal ( 1, 0, 0)
 *   f=2 F : pos = ( c-c0,  c0-r,  c0   )   normal ( 0, 0, 1)
 *   f=3 D : pos = ( c-c0, -c0  ,  c0-r )   normal ( 0,-1, 0)
 *   f=4 L : pos = (-c0  ,  c0-r,  c-c0 )   normal (-1, 0, 0)
 *   f=5 B : pos = ( c0-c,  c0-r, -c0   )   normal ( 0, 0,-1)
 *
 * Rationale, face by face:
 *   U  row0 adjacent B => row0 sits at the BACK  => z = r-c0 (row grows toward F).
 *      col0 adjacent L => x = c-c0.
 *   D  row0 adjacent F => row0 sits at the FRONT => z = c0-r.
 *      col0 adjacent L => x = c-c0.
 *   side faces: row0 adjacent U => y = c0-r (row grows downward) for R/F/L/B.
 *      F col0 adjacent L => x = c-c0.
 *      R col0 adjacent F => col0 at z=+c0 => z = c0-c.
 *      B col0 adjacent R => col0 at x=+c0 => x = c0-c.
 *      L col0 adjacent B => col0 at z=-c0 => z = c-c0.
 *
 * TURN DIRECTION RULE (the other half of the mapping):
 *   A clockwise turn of a face is a rotation of -90 degrees (right-hand rule) about that
 *   face's OUTWARD normal. Hence, about the positive axis:
 *     U,R,F (sign +1): angle = -90 * amount
 *     D,L,B (sign -1): angle = +90 * amount
 *   Slices follow their reference face: M<-L, E<-D, S<-F. Rotations x<-R, y<-U, z<-F.
 *   The node self-test at the bottom PROVES mapping+direction against ScrImage.nnn.apply()
 *   by pushing a uniquely-tagged state through apply() and checking every sticker landed
 *   exactly where this file's geometry says it should.
 * ============================================================================
 */
(function (g) {
  'use strict';

  var ScrImage = g.ScrImage;
  if (!ScrImage && typeof require !== 'undefined') {
    try { ScrImage = { nnn: require('./draw_nnn.js') }; } catch (e) { /* fail soft */ }
  }
  var NNN = ScrImage && ScrImage.nnn;

  var DEG = Math.PI / 180;

  /* ---------------------------------------------------------------- math */

  function rotAxis(p, axis, ang) { // right-hand rotation about +axis (0=x,1=y,2=z)
    var c = Math.cos(ang), s = Math.sin(ang), x = p[0], y = p[1], z = p[2];
    if (axis === 0) return [x, y * c - z * s, y * s + z * c];
    if (axis === 1) return [x * c + z * s, y, -x * s + z * c];
    return [x * c - y * s, x * s + y * c, z];
  }

  function rotAxisQ(p, axis, quarters) { // exact integer rotation, quarters in whole 90deg steps
    var q = ((quarters % 4) + 4) % 4;
    var C = [1, 0, -1, 0][q], S = [0, 1, 0, -1][q];
    var x = p[0], y = p[1], z = p[2];
    if (axis === 0) return [x, y * C - z * S, y * S + z * C];
    if (axis === 1) return [x * C + z * S, y, -x * S + z * C];
    return [x * C - y * S, x * S + y * C, z];
  }

  function hexToRgb(h) {
    h = String(h).replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var v = parseInt(h, 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }
  function shade(rgb, k) {
    function cl(v) { return v < 0 ? 0 : v > 255 ? 255 : Math.round(v); }
    return 'rgb(' + cl(rgb[0] * k) + ',' + cl(rgb[1] * k) + ',' + cl(rgb[2] * k) + ')';
  }

  /* ------------------------------------------------- facelet <-> 3D space */

  // 0=U 1=R 2=F 3=D 4=L 5=B
  var FACE_NORMAL = [[0, 1, 0], [1, 0, 0], [0, 0, 1], [0, -1, 0], [-1, 0, 0], [0, 0, -1]];
  // face -> [axis, sign]
  var FACE_AXIS = [[1, 1], [0, 1], [2, 1], [1, -1], [0, -1], [2, -1]];

  function faceletToPos(f, r, c, n) {
    var c0 = (n - 1) / 2;
    switch (f) {
      case 0: return [c - c0, c0, r - c0];
      case 1: return [c0, c0 - r, c0 - c];
      case 2: return [c - c0, c0 - r, c0];
      case 3: return [c - c0, -c0, c0 - r];
      case 4: return [-c0, c0 - r, c - c0];
      default: return [c0 - c, c0 - r, -c0];
    }
  }

  function normalToFace(nm) {
    for (var f = 0; f < 6; f++) {
      var a = FACE_NORMAL[f];
      if (Math.abs(a[0] - nm[0]) < 1e-6 && Math.abs(a[1] - nm[1]) < 1e-6 && Math.abs(a[2] - nm[2]) < 1e-6) return f;
    }
    return -1;
  }

  // inverse of faceletToPos: (pos, outward normal) -> {f, r, c} or null
  function posToFacelet(pos, nm, n) {
    var f = normalToFace(nm);
    if (f < 0) return null;
    var c0 = (n - 1) / 2, x = pos[0], y = pos[1], z = pos[2], r, c;
    switch (f) {
      case 0: r = z + c0; c = x + c0; break;
      case 1: r = c0 - y; c = c0 - z; break;
      case 2: r = c0 - y; c = x + c0; break;
      case 3: r = c0 - z; c = x + c0; break;
      case 4: r = c0 - y; c = z + c0; break;
      default: r = c0 - y; c = c0 - x; break;
    }
    r = Math.round(r); c = Math.round(c);
    if (r < 0 || r >= n || c < 0 || c >= n) return null;
    return { f: f, r: r, c: c };
  }

  /* ------------------------------------------------------- move geometry */

  var TOKEN_RE = /^([2-9]?)([URFDLBxyz])(w?)(2'|2|')?$/;
  var SLICE_RE = /^([MES])(2|')?$/;
  var LOWER_WIDE = /^([urfdlb])(2|')?$/;
  var SLICE_REF = { M: 4, E: 3, S: 2 };      // M follows L, E follows D, S follows F
  var ROT_REF = { x: 1, y: 0, z: 2 };        // x follows R, y follows U, z follows F

  /* Parse ONE token into geometry. Returns null for junk (caller then also skips it,
   * matching draw_nnn.apply() which silently ignores unparseable tokens).
   *   {axis, lo, hi, quarters}
   * lo/hi are inclusive layer INDICES along +axis (0 .. n-1, index 0 at coord -c0).
   * quarters = right-hand 90deg steps about +axis. */
  function parseMove(tok, n) {
    tok = String(tok);
    var lm = LOWER_WIDE.exec(tok);
    if (lm) tok = lm[1].toUpperCase() + 'w' + (lm[2] || '');

    var amount, ref, wide;
    var sm = SLICE_RE.exec(tok);
    if (sm) {
      amount = sm[2] === '2' ? 2 : (sm[2] === "'" ? 3 : 1);
      ref = SLICE_REF[sm[1]];
      var ax = FACE_AXIS[ref];
      return slab(ax[0], ax[1], amount, 1, n - 2, n);
    }
    var m = TOKEN_RE.exec(tok);
    if (!m) return null;
    amount = (m[4] === '2' || m[4] === "2'") ? 2 : (m[4] === "'" ? 3 : 1);
    var letter = m[2];
    if (letter === 'x' || letter === 'y' || letter === 'z') {
      ref = ROT_REF[letter];
      var ar = FACE_AXIS[ref];
      return slab(ar[0], ar[1], amount, 0, n - 1, n);
    }
    ref = 'URFDLB'.indexOf(letter);
    wide = m[3] === 'w' ? (m[1] ? parseInt(m[1], 10) : 2) : 1;
    if (wide > n - 1) wide = n - 1;
    if (wide < 1) wide = 1;
    var af = FACE_AXIS[ref];
    // sign +1 face lives at the HIGH index end; sign -1 at the LOW index end.
    var lo = af[1] > 0 ? n - wide : 0;
    var hi = af[1] > 0 ? n - 1 : wide - 1;
    return slab(af[0], af[1], amount, lo, hi, n);

    function slab(axis, sign, amt, l, h, nn) {
      // A slice on n<3 has no inner layer. draw_nnn.apply() makes it a no-op (its conj
      // rotations cancel), so we must return null and skip the token entirely — spinning
      // the whole cube here would desync the animation from the state.
      if (h < l) return null;
      // CW about the outward normal = -90 * sign about the +axis.
      var q = (amt === 3 ? -1 : amt) * -1 * sign;
      return { axis: axis, lo: l, hi: h, quarters: q };
    }
  }

  function idxAlong(pos, axis, n) { return Math.round(pos[axis] + (n - 1) / 2); }

  /* --------------------------------------------------------- geometry gen */

  // Surface cubies only (the core is never visible).
  function buildCubies(n) {
    var c0 = (n - 1) / 2, out = [];
    for (var ix = 0; ix < n; ix++) for (var iy = 0; iy < n; iy++) for (var iz = 0; iz < n; iz++) {
      if (ix !== 0 && ix !== n - 1 && iy !== 0 && iy !== n - 1 && iz !== 0 && iz !== n - 1) continue;
      out.push({ c: [ix - c0, iy - c0, iz - c0], i: [ix, iy, iz] });
    }
    return out;
  }

  var AXIS_U = [[0, 1, 0], [0, 0, 1], [1, 0, 0]]; // in-plane basis "u" per axis
  var AXIS_V = [[0, 0, 1], [1, 0, 0], [0, 1, 0]]; // in-plane basis "v" per axis

  /* ------------------------------------------------------------ instance */

  function create(canvas, opts) {
    opts = opts || {};
    if (!NNN) throw new Error('vcube3d: ScrImage.nnn (js/draw_nnn.js) is required');

    var n = opts.size || 3;
    var palette = (opts.palette || NNN.colors).slice();
    var body = opts.bodyColor || '#12151a';
    var cubieSize = opts.cubieSize || 0.94;   // gap between cubies shows the body
    var stickerSize = opts.stickerSize || 0.80; // fraction of a cubie face
    var stickerRadius = opts.stickerRadius == null ? 0.1 : opts.stickerRadius; // fraction of cubie
    var duration = opts.duration == null ? 120 : opts.duration; // ms per turn, 0 = instant
    var fov = opts.fov || 30;
    var dist = opts.distance || (n * 3.2);

    var yaw = opts.yaw == null ? -30 : opts.yaw;   // camera azimuth; see DEFAULT FRAMING below
    var pitch = opts.pitch == null ? 37.5 : opts.pitch;
    /* XRAY: keep the far faces and fade them so the 3 hidden faces show through, instead of
     * parking a whole second cube next to this one (which is dizzying to track). */
    var xray = !!opts.xray;
    var XRAY_FRONT_A = 0.92, XRAY_BACK_A = 0.34, XRAY_BODY_A = 0.16;

    var cubies = buildCubies(n);
    var state = NNN.solved(n);
    var queue = [];          // [{move, pre, geo, ts, t}]
    var raf = 0, lastTick = 0, dead = false;
    var wasSolved = true;
    var onSolvedCbs = [], onTurnCbs = [];
    var lastStats = { polys: 0, culled: 0, order: [] };

    var rgbCache = {};
    function rgbOf(hex) { return rgbCache[hex] || (rgbCache[hex] = hexToRgb(hex)); }

    var now = (typeof performance !== 'undefined' && performance.now)
      ? function () { return performance.now(); }
      : function () { return Date.now(); };

    /* ---- camera -------------------------------------------------------
     * World camera position = ( -d*cos(p)*sin(yaw), d*sin(p), d*cos(p)*cos(yaw) ).
     * DEFAULT FRAMING: yaw=-30, pitch=37.5 puts the camera in the (+x,+y,+z) octant
     * => U, R and F are the three visible faces (csTimer's 'URF' / vrcOri '10,11',
     * theta=30deg, phi=37.5deg). */
    /* Camera maths are parameterised by (yaw,pitch) so the SAME state can be drawn from a
     * second angle (the back view) without a second engine — two engines would be two
     * states that can drift, and a back view that lies is worse than no back view. */
    function toViewAt(p, y, pi) {
      var q = rotAxis(p, 1, y * DEG);
      return rotAxis(q, 0, pi * DEG);
    }
    function toView(p) { return toViewAt(p, yaw, pitch); }
    // exact inverse of toView applied to the view-space camera at (0,0,dist)
    function cameraWorldAt(y, pi) {
      var p = rotAxis([0, 0, dist], 0, -pi * DEG);
      return rotAxis(p, 1, -y * DEG);
    }
    function cameraWorld() { return cameraWorldAt(yaw, pitch); }

    /* ---- state --------------------------------------------------------- */

    function copy(s) { return s.map(function (f) { return f.slice(); }); }

    function setState(v) {
      if (typeof v === 'string' || v == null) state = NNN.apply(NNN.solved(n), n, v || '');
      else state = copy(v);
      queue.length = 0;
      wasSolved = isSolved();
      render();
      return api;
    }

    function reset() { return setState(''); }

    /* isSolved() — rotation-invariant solved test: EVERY FACE IS UNIFORM.
     *
     * This is csTimer's own predicate (cubeutil.solvedProgress compares each facelet to the
     * FIRST facelet of its own equivalence class, never to a fixed expected colour), and it is
     * the only correct one: x/y/z are legal at all times, so comparing against solved(n) would
     * make the cube unsolvable-in-practice for anyone who rotates.
     *
     * CONTRACT NOTE — this is NOT a legality check. A hand-built state injected via
     * setState(array) can be uniform-but-physically-impossible (e.g. the U and R faces swapped
     * wholesale, which is not one of the 24 rotations of solved) and this returns true for it.
     * That is by design and is harmless for every reachable state: turning can never leave the
     * orbit of solved. Do not mistake a true here for "this is a rotation of solved". */
    function isSolved() {
      for (var f = 0; f < 6; f++) {
        var c = state[f][0];
        for (var i = 1; i < n * n; i++) if (state[f][i] !== c) return false;
      }
      return true;
    }

    /* ---- turns ---------------------------------------------------------
     * State applies IMMEDIATELY and in strict order at turn() time; animation is a
     * purely visual replay of the snapshots. Out-typing the animation can never
     * corrupt or drop a move.
     *
     * SOLVED OBSERVATION (the subtle part — read before touching this):
     * The solved-ness AFTER each individual token is captured HERE, at turn() time, and rides
     * on the queue entry. It is NOT recomputed later from `state`, because by the time an entry
     * animates, `state` has already run ahead. Every intermediate state a burst passes through
     * is therefore observed exactly once, in order, whatever `duration` is:
     *
     *   duration=0    -> settleTo() fires inline, per token.
     *   duration>0    -> settleTo() fires as each entry drains, per token.
     *
     * That equivalence is the whole point. A speedcuber who out-types the animation and does a
     * stray fidget move after the solving move (e.g. burst "U R U' R' U" from R U R' U') passes
     * THROUGH solved without ending there; observing only the drained-final state would miss it
     * and the timer would never stop. csTimer has the same semantics (it evaluates isSolved at
     * each move's mstep==2, as moves retire one at a time).
     *
     * Consequence for callers: inside onSolved, isSolved() may already be false again. The
     * callback's `ts` — the KEYPRESS timestamp of the solving move — is the truth, not the
     * cube's current state. */
    function turn(mv, ts) {
      if (dead) return api;
      var toks = String(mv).trim().split(/\s+/);
      for (var i = 0; i < toks.length; i++) {
        // re-check per token: an onTurn/onSolved callback may have destroy()ed us mid-string
        if (dead) break;
        var t = toks[i];
        if (!t) continue;
        var geo = parseMove(t, n);
        if (!geo) continue;             // junk token: ignore, same as draw_nnn.apply()
        var pre = state;
        state = NNN.apply(copy(state), n, t);
        var solvedAfter = isSolved();
        var stamp = ts == null ? now() : ts;
        if (duration > 0) queue.push({ move: t, pre: pre, geo: geo, ts: stamp, t: 0, solved: solvedAfter });
        else settleTo(solvedAfter, stamp);
        for (var k = 0; k < onTurnCbs.length; k++) onTurnCbs[k](t, stamp);
      }
      if (duration > 0 && queue.length) start();
      else render();
      return api;
    }

    /* Observe ONE state transition. `s` is the solved-ness captured at turn() time for the
     * token being settled — never isSolved() of the live state, which has moved on. */
    function settleTo(s, ts) {
      if (s && !wasSolved) {
        for (var i = 0; i < onSolvedCbs.length; i++) onSolvedCbs[i](ts);
      }
      wasSolved = s;
    }

    function ease(t) { return 0.5 - 0.5 * Math.cos(Math.PI * t); } // easeInOutSine

    function start() {
      if (raf || dead) return;
      lastTick = now();
      var rq = g.requestAnimationFrame;
      if (!rq) { // headless / no rAF: snap to the final state, but still observe every
        // intermediate transition in order, exactly as the animated path does.
        var drained = queue.splice(0, queue.length);
        render();
        for (var i = 0; i < drained.length; i++) settleTo(drained[i].solved, drained[i].ts);
        return;
      }
      raf = rq.call(g, tick);
    }

    function tick() {
      raf = 0;
      if (dead) return;
      var t = now(), dt = t - lastTick;
      lastTick = t;
      // csTimer's catch-up trick: a backlog of q moves plays back (q+2)/2 times faster,
      // so a fast typist is caught up with instead of falling further behind.
      var speed = (queue.length + 2) / 2;
      var step = dt / duration * speed;
      var drained = [];
      while (step > 0 && queue.length) {
        var e = queue[0];
        var need = 1 - e.t;
        if (step >= need) { step -= need; queue.shift(); drained.push(e); }
        else { e.t += step; step = 0; }
      }
      render();
      // Reschedule BEFORE firing the settle callbacks. A turn() called from inside onSolved
      // would otherwise see raf===0 and spin up a SECOND rAF loop alongside this one.
      if (queue.length) raf = g.requestAnimationFrame(tick);
      for (var i = 0; i < drained.length; i++) settleTo(drained[i].solved, drained[i].ts);
    }

    /* ---- view ---------------------------------------------------------- */

    function setView(y, p) {
      if (y != null) yaw = y;
      if (p != null) pitch = Math.max(-89, Math.min(89, p));
      render();
      return api;
    }
    function dragBy(dx, dy) {
      yaw += dx * 0.5;
      pitch = Math.max(-89, Math.min(89, pitch + dy * 0.5));
      render();
      return api;
    }
    function getView() { return { yaw: yaw, pitch: pitch }; }

    /* ---- render -------------------------------------------------------- */

    // Last known CSS size. NEVER re-derive the CSS size from canvas.width: that is the
    // BACKING-STORE size (= css * dpr), so on a Retina display a render taken while the
    // canvas is hidden (clientWidth === 0) would feed dpr back in and grow the buffer
    // without bound. Fall back to the last good CSS size instead.
    var cssW = opts.width || 300, cssH = opts.height || 300;

    /* isMain caches the CSS box on the instance (the main canvas defines the projection
     * scale); attached views measure themselves and fall back to the main box under the
     * node stub, where clientWidth does not exist. */
    function resizeCanvas(cv, isMain) {
      if (!cv) return { w: cssW, h: cssH, dpr: 1 };
      var dpr = (g.devicePixelRatio || 1);
      var w0, h0;
      if (isMain) {
        if (cv.clientWidth > 0) cssW = cv.clientWidth;
        if (cv.clientHeight > 0) cssH = cv.clientHeight;
        w0 = cssW; h0 = cssH;
      } else {
        w0 = cv.clientWidth > 0 ? cv.clientWidth : cssW;
        h0 = cv.clientHeight > 0 ? cv.clientHeight : cssH;
      }
      var w = Math.max(1, Math.round(w0 * dpr)), h = Math.max(1, Math.round(h0 * dpr));
      if (cv.width !== w) cv.width = w;
      if (cv.height !== h) cv.height = h;
      return { w: w, h: h, dpr: dpr };
    }
    function resize() { return resizeCanvas(canvas, true); }

    /* Draw the current state into `cv` from (vYaw,vPitch). The main canvas and every
     * attached view (e.g. the back view at yaw+180) go through here, so they can never
     * show different states. */
    function renderView(cv, vYaw, vPitch, isMain) {
      if (dead || !cv) return lastStats;
      var ctx = cv.getContext && cv.getContext('2d');
      if (!ctx) return lastStats;
      var dim = resizeCanvas(cv, isMain);
      var W = dim.w, H = dim.h;
      ctx.clearRect(0, 0, W, H);

      var anim = queue.length ? queue[0] : null;
      var src = anim ? anim.pre : state;
      var ang = anim ? ease(anim.t) * anim.geo.quarters * Math.PI / 2 : 0;

      var cx = W / 2, cy = H / 2;
      var f = (Math.min(W, H) * 0.5) / Math.tan(fov * 0.5 * DEG) * (opts.zoom || 0.95);

      function project(p) {
        var v = toViewAt(p, vYaw, vPitch);
        var depth = dist - v[2];
        if (depth < 0.05) depth = 0.05;
        return [cx + v[0] * f / depth, cy - v[1] * f / depth, depth];
      }

      var lightDir = (function () {
        var l = opts.light || [0.35, 1, 0.55];
        var m = Math.sqrt(l[0] * l[0] + l[1] * l[1] + l[2] * l[2]);
        return [l[0] / m, l[1] / m, l[2] / m];
      })();

      var camW = cameraWorldAt(vYaw, vPitch);
      var h = cubieSize / 2;
      var polys = [], culled = 0;

      for (var ci = 0; ci < cubies.length; ci++) {
        var cu = cubies[ci];
        var moving = anim && cu.i[anim.geo.axis] >= anim.geo.lo && cu.i[anim.geo.axis] <= anim.geo.hi;
        var center = moving ? rotAxis(cu.c, anim.geo.axis, ang) : cu.c;

        for (var fi = 0; fi < 6; fi++) {
          var nm0 = FACE_NORMAL[fi];
          var nm = moving ? rotAxis(nm0, anim.geo.axis, ang) : nm0;
          var cen = [center[0] + nm[0] * h, center[1] + nm[1] * h, center[2] + nm[2] * h];

          /* Backface test against the true (perspective) view vector.
           * Normally we cull. In XRAY mode we keep the far faces and draw them faded, so
           * the three hidden faces show THROUGH the cube — the depth sort below already
           * puts far polys first, which is exactly the order alpha compositing needs. */
          var toCam = [camW[0] - cen[0], camW[1] - cen[1], camW[2] - cen[2]];
          var facing = nm[0] * toCam[0] + nm[1] * toCam[1] + nm[2] * toCam[2] > 0;
          if (!facing && !xray) { culled++; continue; }

          var ax = fi === 0 || fi === 3 ? 1 : (fi === 1 || fi === 4 ? 0 : 2);
          var u0 = AXIS_U[ax], v0 = AXIS_V[ax];
          var u = moving ? rotAxis(u0, anim.geo.axis, ang) : u0;
          var vv = moving ? rotAxis(v0, anim.geo.axis, ang) : v0;

          var lit = lightDir[0] * nm[0] + lightDir[1] * nm[1] + lightDir[2] * nm[2];
          var k = 0.70 + 0.30 * Math.max(0, lit);

          /* In xray the body must get out of the way — an opaque shell between the camera
           * and the far stickers is the whole thing we are trying to see past. */
          var bodyA = xray ? (facing ? XRAY_BODY_A : XRAY_BODY_A * 0.6) : 1;
          if (bodyA > 0.02) {
            polys.push(quad(cen, u, vv, h, shade(rgbOf(body), 0.55 + 0.45 * k), 0, bodyA));
          }

          // sticker: only on the true outer surface of the whole cube
          var onSurface = (nm0[0] !== 0 && cu.i[0] === (nm0[0] > 0 ? n - 1 : 0)) ||
            (nm0[1] !== 0 && cu.i[1] === (nm0[1] > 0 ? n - 1 : 0)) ||
            (nm0[2] !== 0 && cu.i[2] === (nm0[2] > 0 ? n - 1 : 0));
          if (!onSurface) continue;
          var fc = posToFacelet(cu.c, nm0, n);
          if (!fc) continue;
          var col = palette[src[fc.f][fc.r * n + fc.c]] || '#888';
          var lift = [cen[0] + nm[0] * 0.012, cen[1] + nm[1] * 0.012, cen[2] + nm[2] * 0.012];
          var stkA = xray ? (facing ? XRAY_FRONT_A : XRAY_BACK_A) : 1;
          polys.push(quad(lift, u, vv, h * stickerSize, shade(rgbOf(col), k), stickerRadius * h, stkA));
        }
      }

      function quad(cen, u, v, s, fill, radius, alpha) {
        var pts = [
          [cen[0] - u[0] * s - v[0] * s, cen[1] - u[1] * s - v[1] * s, cen[2] - u[2] * s - v[2] * s],
          [cen[0] + u[0] * s - v[0] * s, cen[1] + u[1] * s - v[1] * s, cen[2] + u[2] * s - v[2] * s],
          [cen[0] + u[0] * s + v[0] * s, cen[1] + u[1] * s + v[1] * s, cen[2] + u[2] * s + v[2] * s],
          [cen[0] - u[0] * s + v[0] * s, cen[1] - u[1] * s + v[1] * s, cen[2] - u[2] * s + v[2] * s]
        ];
        var sp = pts.map(project);
        var dx = cen[0] - camW[0], dy = cen[1] - camW[1], dz = cen[2] - camW[2];
        return {
          pts: sp, fill: fill, radius: radius,
          alpha: alpha == null ? 1 : alpha,
          depth: dx * dx + dy * dy + dz * dz
        };
      }

      // painter's algorithm: farthest first, so nearer polys are drawn LAST (on top)
      polys.sort(function (a, b) { return b.depth - a.depth; });

      var pxScale = f / dist;
      for (var i = 0; i < polys.length; i++) {
        var P = polys[i], p = P.pts;
        var rad = P.radius * pxScale;
        var path = p;
        if (rad > 0.5) {
          // rounded-corner quad: shrink toward the centroid, then stroke the outline back
          // out with a round line join. Cheap, exact-enough, and works on any 2D ctx.
          var gx = (p[0][0] + p[1][0] + p[2][0] + p[3][0]) / 4;
          var gy = (p[0][1] + p[1][1] + p[2][1] + p[3][1]) / 4;
          path = p.map(function (q) {
            var vx = q[0] - gx, vy = q[1] - gy, L = Math.hypot(vx, vy) || 1;
            var t = Math.max(0, 1 - rad / L);
            return [gx + vx * t, gy + vy * t];
          });
        }
        if (P.alpha < 1 && ctx.globalAlpha != null) ctx.globalAlpha = P.alpha;
        ctx.beginPath();
        ctx.moveTo(path[0][0], path[0][1]);
        for (var j = 1; j < path.length; j++) ctx.lineTo(path[j][0], path[j][1]);
        ctx.closePath();
        ctx.fillStyle = P.fill;
        ctx.fill();
        if (rad > 0.5) {
          ctx.strokeStyle = P.fill;
          ctx.lineJoin = 'round';
          ctx.lineWidth = rad * 2;
          ctx.stroke();
        }
        if (P.alpha < 1 && ctx.globalAlpha != null) ctx.globalAlpha = 1;
      }

      // `order` is a lazy getter: building it eagerly would allocate a second array on
      // every one of the 60 frames/sec an animation runs at, for test-only data.
      lastStats = {
        polys: polys.length, culled: culled,
        get order() { return polys.map(function (q) { return q.depth; }); }
      };
      return lastStats;
    }

    /* Extra canvases showing the same state from a fixed yaw/pitch offset. */
    var views = [];
    function addView(cv, o) {
      if (!cv) return;
      removeView(cv);
      o = o || {};
      views.push({ canvas: cv, dYaw: o.dYaw == null ? 180 : o.dYaw, dPitch: o.dPitch || 0 });
      render();
    }
    function removeView(cv) {
      for (var i = views.length - 1; i >= 0; i--) if (views[i].canvas === cv) views.splice(i, 1);
    }
    function clearViews() { views.length = 0; }

    function render() {
      var s = renderView(canvas, yaw, pitch, true);
      for (var i = 0; i < views.length; i++) {
        renderView(views[i].canvas, yaw + views[i].dYaw, pitch + views[i].dPitch, false);
      }
      return s;
    }

    /* ---- lifecycle ------------------------------------------------------ */

    function destroy() {
      dead = true;
      views.length = 0;
      if (raf && g.cancelAnimationFrame) g.cancelAnimationFrame(raf);
      raf = 0; queue.length = 0; canvas = null;
    }

    var api = {
      setState: setState,
      getState: function () { return copy(state); },
      turn: turn,
      isSolved: isSolved,
      isAnimating: function () { return queue.length > 0; },
      pending: function () { return queue.length; },
      render: render,
      // Extra canvases fed by this same state — e.g. a back view at dYaw:180.
      // One state, N angles: they cannot drift the way two engines would.
      addView: addView,
      removeView: removeView,
      clearViews: clearViews,
      setView: setView,
      getView: getView,
      dragBy: dragBy,
      reset: reset,
      onSolved: function (cb) { onSolvedCbs.push(cb); return api; },
      onTurn: function (cb) { onTurnCbs.push(cb); return api; },
      setDuration: function (ms) { duration = Math.max(0, ms || 0); return api; },
      setXray: function (on) { xray = !!on; render(); return api; },
      getXray: function () { return xray; },
      setPalette: function (p) { palette = p.slice(); render(); return api; },
      size: n,
      stats: function () { return lastStats; },
      destroy: destroy,
      // introspection (used by the self-test and by integrators)
      cameraWorld: cameraWorld,
      // which of the 6 faces currently face the camera (indices into 0=U..5=B)
      visibleFaces: function () {
        var cam = cameraWorld(), c0 = (n - 1) / 2, out = [];
        for (var f = 0; f < 6; f++) {
          var nm = FACE_NORMAL[f];
          var cen = [nm[0] * c0, nm[1] * c0, nm[2] * c0];
          if (nm[0] * (cam[0] - cen[0]) + nm[1] * (cam[1] - cen[1]) + nm[2] * (cam[2] - cen[2]) > 0) out.push(f);
        }
        return out;
      },
      faceletToPos: function (f, r, c) { return faceletToPos(f, r, c, n); },
      posToFacelet: function (p, nm) { return posToFacelet(p, nm, n); },
      parseMove: function (t) { return parseMove(t, n); },
      colorAt: function (p, nm) { var fc = posToFacelet(p, nm, n); return fc ? state[fc.f][fc.r * n + fc.c] : -1; }
    };
    render();
    return api;
  }

  var VCube3D = {
    create: create,
    faceletToPos: faceletToPos,
    posToFacelet: posToFacelet,
    parseMove: parseMove,
    rotAxisQ: rotAxisQ,
    FACE_NORMAL: FACE_NORMAL
  };

  g.VCube3D = VCube3D;
  if (typeof module !== 'undefined' && module.exports) module.exports = VCube3D;

  /* ============================== node self-test ============================== */
  if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
    var fails = 0;
    function assert(name, cond) {
      console.log((cond ? 'PASS' : 'FAIL') + ' - ' + name);
      if (!cond) fails++;
    }
    function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
    function veq(a, b) {
      return Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6 && Math.abs(a[2] - b[2]) < 1e-6;
    }

    var N = 3;

    /* ---- 1. mapping is a bijection ---- */
    (function () {
      var seen = {}, ok = true;
      for (var f = 0; f < 6; f++) for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) {
        var p = faceletToPos(f, r, c, N);
        var back = posToFacelet(p, FACE_NORMAL[f], N);
        if (!back || back.f !== f || back.r !== r || back.c !== c) ok = false;
        var key = p.join(',') + '|' + f;
        if (seen[key]) ok = false;
        seen[key] = 1;
      }
      assert('mapping: faceletToPos/posToFacelet round-trip for all 54 stickers', ok);
      assert('mapping: 54 distinct (pos,normal) sticker slots', Object.keys(seen).length === 54);
    })();

    /* ---- 2. THE CRUX: mapping+direction vs ScrImage.nnn.apply() ground truth ----
     * apply() only ever PERMUTES values, so we can push a uniquely-tagged state through
     * it and see exactly where every individual sticker went. Then we check that against
     * this file's geometric rotation. If the facelet<->3D mapping or the CW-direction
     * rule were wrong anywhere, this fails. */
    function taggedState() {
      var s = [];
      for (var f = 0; f < 6; f++) { var a = []; for (var i = 0; i < N * N; i++) a.push(f * 100 + i); s.push(a); }
      return s;
    }
    function checkMove(mv) {
      var geo = parseMove(mv, N);
      if (!geo) return false;
      var post = NNN.apply(taggedState(), N, mv);
      var ok = true, checked = 0;
      for (var f = 0; f < 6; f++) for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) {
        var id = post[f][r * N + c];
        var of = Math.floor(id / 100), oi = id % 100;
        var oPos = faceletToPos(of, Math.floor(oi / N), oi % N, N);
        var oNm = FACE_NORMAL[of];
        var inSlab = idxAlong(oPos, geo.axis, N) >= geo.lo && idxAlong(oPos, geo.axis, N) <= geo.hi;
        var ePos = inSlab ? rotAxisQ(oPos, geo.axis, geo.quarters) : oPos;
        var eNm = inSlab ? rotAxisQ(oNm, geo.axis, geo.quarters) : oNm;
        var aPos = faceletToPos(f, r, c, N), aNm = FACE_NORMAL[f];
        if (!veq(ePos, aPos) || !veq(eNm, aNm)) ok = false;
        checked++;
      }
      return ok && checked === 54;
    }

    var ALL = [];
    'URFDLB'.split('').forEach(function (f) { ALL.push(f, f + "'", f + '2'); }); // 18 face moves
    ['M', "M'", 'M2', 'E', "E'", 'E2', 'S', "S'", 'S2'].forEach(function (m) { ALL.push(m); });
    ['x', "x'", 'x2', 'y', "y'", 'y2', 'z', "z'", 'z2'].forEach(function (m) { ALL.push(m); });
    ['Rw', "Rw'", 'Uw', "Dw'", "Lw"].forEach(function (m) { ALL.push(m); });

    var badMoves = ALL.filter(function (m) { return !checkMove(m); });
    assert('CRUX mapping: all ' + ALL.length + ' moves place every sticker at the geometrically ' +
      'predicted 3D pos+normal (vs apply() ground truth)' + (badMoves.length ? ' [bad: ' + badMoves.join(' ') + ']' : ''),
      badMoves.length === 0);

    /* ---- 3. named spot-checks (human-readable sanity) ---- */
    (function () {
      // U right column (x=+1) is the only part of U in the R layer; after R it must be on B.
      var post = NNN.apply(taggedState(), N, 'R');
      var ok = true;
      for (var r = 0; r < N; r++) {
        var id = 0 * 100 + (r * N + 2);            // U facelet (r, col 2)
        // find where it went
        var found = null;
        for (var f = 0; f < 6 && !found; f++) for (var i = 0; i < N * N; i++)
          if (post[f][i] === id) { found = { f: f, r: Math.floor(i / N), c: i % N }; break; }
        if (!found || found.f !== 5) ok = false;   // 5 = B
      }
      assert('spot: after R, the whole U right column (x=+1) lands on B', ok);

      var pU = faceletToPos(0, 2, 2, N);
      assert('spot: U bottom-right facelet (r2,c2) is at 3D (1,1,1)', veq(pU, [1, 1, 1]));
      var pB = faceletToPos(5, 0, 0, N);
      assert('spot: B top-left facelet (r0,c0) is at 3D (1,1,-1)', veq(pB, [1, 1, -1]));
      var geoR = parseMove('R', N);
      assert('spot: R = layers x-index 2..2, quarters -1 about +x',
        geoR.axis === 0 && geoR.lo === 2 && geoR.hi === 2 && geoR.quarters === -1);
      var geoL = parseMove('L', N);
      assert('spot: L = layers x-index 0..0, quarters +1 about +x',
        geoL.axis === 0 && geoL.lo === 0 && geoL.hi === 0 && geoL.quarters === 1);
      var geoM = parseMove('M', N);
      assert('spot: M = inner x-index 1..1, quarters +1 (follows L)',
        geoM.axis === 0 && geoM.lo === 1 && geoM.hi === 1 && geoM.quarters === 1);
    })();

    /* ---- stub canvas ---- */
    function stubCanvas(w, h) {
      var calls = { fill: 0, stroke: 0 };
      var ctx = {
        fillStyle: '', strokeStyle: '', lineJoin: '', lineWidth: 0,
        clearRect: function () { }, beginPath: function () { }, moveTo: function () { },
        lineTo: function () { }, closePath: function () { },
        fill: function () { calls.fill++; }, stroke: function () { calls.stroke++; }
      };
      return {
        width: w, height: h, clientWidth: w, clientHeight: h,
        getContext: function () { return ctx; }, _calls: calls
      };
    }

    /* ---- 4. turn() state matches apply() exactly ---- */
    (function () {
      var bad = [];
      ALL.forEach(function (mv) {
        var c = create(stubCanvas(300, 300), { duration: 0 });
        c.turn(mv);
        if (!eq(c.getState(), NNN.apply(NNN.solved(3), 3, mv))) bad.push(mv);
        c.destroy();
      });
      assert('turn(): all ' + ALL.length + ' moves match apply() state exactly' +
        (bad.length ? ' [bad: ' + bad.join(' ') + ']' : ''), bad.length === 0);
    })();

    /* ---- 5. isSolved() rotation invariance ---- */
    (function () {
      var c = create(stubCanvas(300, 300), { duration: 0 });
      assert('isSolved: true on a solved cube', c.isSolved() === true);
      var rots = ['x', "y'", 'z2', 'y', 'x2', "z'", 'x', 'y', 'z', "x'", "y'", "z'"];
      var ok = true;
      for (var i = 0; i < rots.length; i++) { c.turn(rots[i]); if (!c.isSolved()) ok = false; }
      assert('isSolved: still true after 12 chained x/y/z rotations (rotation-invariant)', ok);
      c.reset(); c.turn('R');
      assert('isSolved: false after a single R', c.isSolved() === false);
      c.reset(); c.turn("y x R U R' U' x' y'");
      assert('isSolved: false after R U R\' U\' wrapped in rotations', c.isSolved() === false);
      c.reset(); c.turn("R U R' U' ".repeat(6));
      assert('isSolved: true after (R U R\' U\')x6', c.isSolved() === true);
      c.destroy();
    })();

    /* ---- 6. queue robustness: 20 sync turns, no rAF ticks ---- */
    (function () {
      var seq = "R U R' U' F2 L' D B2 M E' S x y' Rw Uw' D2 F R2 z' B";
      var c = create(stubCanvas(300, 300), { duration: 120 }); // animated, but no rAF in node
      seq.split(' ').forEach(function (m) { c.turn(m); });
      var truth = NNN.apply(NNN.solved(3), 3, seq);
      assert('queue: 20 turns fired synchronously (no rAF) end in the exact apply() state',
        eq(c.getState(), truth));
      assert('queue: 20 turns fired synchronously do not throw or drop moves', c.pending() >= 0);
      c.destroy();

      var c2 = create(stubCanvas(300, 300), { duration: 0 });
      seq.split(' ').forEach(function (m) { c2.turn(m); });
      assert('queue: same sequence with duration=0 (instant) also matches apply()',
        eq(c2.getState(), truth));
      c2.destroy();

      // scramble via setState then more turns
      var scr = "D2 F' L2 U R' B U2 F2 R B2 D' L F2 R2 U2 D";
      var c3 = create(stubCanvas(300, 300), { duration: 0 });
      c3.setState(scr); c3.turn("R U R'");
      assert('queue: setState(scramble) + turns matches apply(scramble + moves)',
        eq(c3.getState(), NNN.apply(NNN.solved(3), 3, scr + " R U R'")));
      c3.destroy();
    })();

    /* ---- 7. render on a stub canvas ---- */
    (function () {
      var cv = stubCanvas(400, 400);
      var c, threw = false;
      try { c = create(cv, { duration: 0 }); c.setState("R U R' U'"); c.render(); }
      catch (e) { threw = true; console.log('   render threw: ' + e.message); }
      assert('render: does not throw on a stub 2D context', !threw);
      var st = c.stats();
      assert('render: draws >= 54 polygons for the default URF view (got ' + st.polys + ')', st.polys >= 54);
      assert('render: backface culling removes polys (drawn ' + st.polys + ' < 162, culled ' + st.culled + ')',
        st.polys < 162 && st.culled > 0);
      assert('render: fill() called once per polygon (' + cv._calls.fill + ')', cv._calls.fill >= st.polys);
      assert('render: rounded stickers stroked (' + cv._calls.stroke + ' strokes)', cv._calls.stroke > 0);
      c.destroy();
    })();

    /* ---- 8. painter's order ---- */
    (function () {
      var c = create(stubCanvas(400, 400), { duration: 0 });
      c.setView(-30, 37.5);
      var st = c.render();
      var ok = true;
      for (var i = 1; i < st.order.length; i++) if (st.order[i] > st.order[i - 1] + 1e-9) ok = false;
      assert('painter: draw order is farthest-first (nearer polys drawn last) for the URF view', ok);

      c.setView(140, -20);
      var st2 = c.render();
      var ok2 = true;
      for (var j = 1; j < st2.order.length; j++) if (st2.order[j] > st2.order[j - 1] + 1e-9) ok2 = false;
      assert('painter: draw order holds for an arbitrary rotated view too', ok2);
      c.destroy();
    })();

    /* ---- 9. default framing shows U, R, F ---- */
    (function () {
      var c = create(stubCanvas(400, 400), { duration: 0 });
      var v = c.getView();
      assert('view: default is yaw=-30 pitch=37.5 (csTimer URF framing)', v.yaw === -30 && v.pitch === 37.5);
      // camera must sit in the (+x,+y,+z) octant => U, R, F face it
      var cam = c.cameraWorld();
      assert('view: default camera is in the (+x,+y,+z) octant (' +
        cam.map(function (q) { return q.toFixed(2); }).join(', ') + ')',
        cam[0] > 0.1 && cam[1] > 0.1 && cam[2] > 0.1);
      assert('view: default framing shows exactly U, R, F (0,1,2)', eq(c.visibleFaces(), [0, 1, 2]));
      // toView must agree with cameraWorld: the camera maps to (0,0,dist) in view space
      c.setView(-30, 37.5);
      assert('view: cameraWorld is the exact inverse of the view transform',
        c.visibleFaces().length === 3);
      c.setView(150, -37.5);
      assert('view: opposite framing shows exactly D, L, B (3,4,5)', eq(c.visibleFaces(), [3, 4, 5]));
      c.setView(-30, 37.5);
      c.dragBy(10, 5);
      var v2 = c.getView();
      assert('view: dragBy moves yaw and pitch', v2.yaw !== v.yaw && v2.pitch !== v.pitch);
      c.setView(0, 200);
      assert('view: pitch clamped to +-89', c.getView().pitch === 89);
      c.destroy();
    })();

    /* ---- 10. callbacks ---- */
    (function () {
      var c = create(stubCanvas(300, 300), { duration: 0 });
      var turns = [], solved = 0;
      c.onTurn(function (m) { turns.push(m); });
      c.onSolved(function () { solved++; });
      c.setState("R");            // scrambled by one move
      c.turn("R'");               // back to solved
      assert('onTurn: fired for each turn', turns.length === 1 && turns[0] === "R'");
      assert('onSolved: fired exactly once when the cube became solved', solved === 1);
      c.turn('y'); c.turn('x');
      assert('onSolved: does not re-fire on rotations of an already-solved cube', solved === 1);
      c.destroy();
    })();

    /* ---- 10b. REGRESSION: duration must not change WHETHER onSolved fires -------------
     * The bug this replaces: solved-ness was only ever sampled at turn() time (duration=0) or
     * at full queue drain (duration>0), so with duration>0 every intermediate state inside an
     * un-drained burst was invisible. A speedcuber out-typing the animation who passes THROUGH
     * solved and then twitches one more move would never stop the timer. The two modes must
     * agree on identical input, so we assert the FIRE COUNT, not just the final isSolved(). */
    (function () {
      // Drive the animated path in node: a fake rAF that advances real time per frame, so
      // tick()'s dt (and hence the catch-up speed factor) is exercised for real.
      function withFakeRaf(fn) {
        var oldR = g.requestAnimationFrame, oldC = g.cancelAnimationFrame;
        var cbs = {}, id = 0;
        g.requestAnimationFrame = function (cb) { cbs[++id] = cb; return id; };
        g.cancelAnimationFrame = function (i) { delete cbs[i]; };
        function pump(ms) {
          var t0 = Date.now();
          while (Date.now() - t0 < ms) { /* busy-wait one frame of real time */ }
          Object.keys(cbs).forEach(function (k) { var cb = cbs[k]; delete cbs[k]; cb(); });
        }
        try { fn(pump); } finally { g.requestAnimationFrame = oldR; g.cancelAnimationFrame = oldC; }
      }

      // Run the SAME scenario at duration 0 and duration 120 and compare fire counts.
      function run(name, scenario) {
        // instant mode
        var a = 0;
        var ca = create(stubCanvas(300, 300), { duration: 0 });
        ca.onSolved(function () { a++; });
        scenario(ca);
        var solvedA = ca.isSolved();
        ca.destroy();

        // animated mode, identical input
        var b = 0, cb2;
        withFakeRaf(function (pump) {
          cb2 = create(stubCanvas(300, 300), { duration: 120 });
          cb2.onSolved(function () { b++; });
          scenario(cb2);
          for (var i = 0; i < 200 && cb2.pending() > 0; i++) pump(20);
        });
        var solvedB = cb2.isSolved();
        var pend = cb2.pending();
        cb2.destroy();

        assert(name + ': queue drains fully (' + pend + ' left)', pend === 0);
        assert(name + ': final state agrees (instant ' + solvedA + ' / animated ' + solvedB + ')',
          solvedA === solvedB);
        assert(name + ': onSolved fire count is duration-independent (instant ' + a +
          ' vs animated ' + b + ')', a === b);
        return { a: a, b: b };
      }

      // Passing THROUGH solved inside one un-drained burst, ending NOT solved.
      var r1 = run('burst through solved (+1 stray move)', function (c) {
        c.setState("R U R' U'");
        c.turn("U R U' R' U");        // solves on R', then one fidget move
      });
      assert('burst through solved: onSolved fired exactly once (got ' + r1.a + ')', r1.a === 1);

      // Solved -> long burst -> solved again.
      var r2 = run('burst (R U R\' U\')x6 back to solved', function (c) {
        c.turn("R U R' U' ".repeat(6).trim());
      });
      assert('(R U R\' U\')x6 burst: onSolved fired exactly once (got ' + r2.a + ')', r2.a === 1);

      // Multi-token turn() from a scrambled start, solving mid-string.
      var r3 = run('multi-token turn() solving mid-string', function (c) {
        c.setState('R');
        c.turn("R' U");
      });
      assert('multi-token turn(): onSolved fired exactly once (got ' + r3.a + ')', r3.a === 1);

      // Solving on the LAST token: the plain, boring case must still fire once.
      var r4 = run('solve on the final token', function (c) {
        c.setState("R U");
        c.turn("U' R'");
      });
      assert('solve on final token: onSolved fired exactly once (got ' + r4.a + ')', r4.a === 1);

      // A burst that never touches solved must never fire.
      var r5 = run('burst that never reaches solved', function (c) {
        c.setState('');
        c.turn("R U F L B D");
      });
      assert('never solved: onSolved never fired (got ' + r5.a + ')', r5.a === 0);

      // onSolved's ts is the solving move's KEYPRESS, and isSolved() may already be false.
      (function () {
        var c = create(stubCanvas(300, 300), { duration: 0 });
        var seen = [];
        c.setState('R');
        c.onSolved(function (ts) { seen.push({ ts: ts, solvedNow: c.isSolved() }); });
        c.turn("R'", 5000);
        c.turn('U', 6000);
        assert('onSolved: ts is the solving move keypress (5000)', seen.length === 1 && seen[0].ts === 5000);
        assert('onSolved: state may already have advanced past solved (documented contract)',
          seen.length === 1 && seen[0].solvedNow === true);
        c.destroy();
      })();

      /* Reentrancy: turn() from inside onSolved must not spawn a second rAF loop, and the
       * reentrant move must itself still be observed.
       * Trace: setState('R') -> R' SOLVES (fire 1) -> U' breaks it -> the reentrant U
       * re-solves it (fire 2). Two fires is CORRECT: the cube really does pass through
       * solved twice. Verified against draw_nnn.apply(): R R' is solved, R R' U' is not,
       * R R' U' U is solved again. */
      withFakeRaf(function (pump) {
        var c = create(stubCanvas(300, 300), { duration: 120 });
        var fired = 0;
        c.setState('R');
        c.onSolved(function () { fired++; if (fired === 1) c.turn('U'); });
        c.turn("R' U'");
        for (var i = 0; i < 200 && c.pending() > 0; i++) pump(20);
        assert('reentrancy: turn() inside onSolved drains cleanly, no double rAF loop', c.pending() === 0);
        assert('reentrancy: the reentrant turn is itself observed (2 real solves, got ' + fired + ')',
          fired === 2);
        assert('reentrancy: cube ends solved', c.isSolved() === true);
        c.destroy();
      });

      // destroy() from inside onTurn must stop the token loop dead.
      (function () {
        var c = create(stubCanvas(300, 300), { duration: 120 });
        var seen = [];
        c.onTurn(function (m) { seen.push(m); if (m === 'U') c.destroy(); });
        c.turn('R U F L');
        assert('destroy() inside onTurn halts the token loop (saw ' + seen.join(',') + ')',
          seen.length === 2 && seen[1] === 'U');
        assert('destroy() inside onTurn leaves nothing queued on the dead instance', c.pending() === 0);
      })();
    })();

    /* ---- 11. n != 3 sanity ---- */
    (function () {
      [2, 4, 5].forEach(function (nn) {
        var c = create(stubCanvas(300, 300), { size: nn, duration: 0 });
        c.turn("Rw U2 F' Rw'");
        var ok = eq(c.getState(), NNN.apply(NNN.solved(nn), nn, "Rw U2 F' Rw'"));
        assert(nn + 'x' + nn + ': turn() matches apply() and render() works (' + c.stats().polys + ' polys)',
          ok && c.stats().polys > 0);
        c.destroy();
      });
      // regression: a slice on 2x2 has no inner layer. apply() treats it as a no-op, so
      // parseMove must reject it -- otherwise the animation would spin the whole cube
      // while the state stayed put.
      assert('2x2: M/E/S are rejected (no inner layer) so geometry cannot desync from apply()',
        parseMove('M', 2) === null && parseMove("E'", 2) === null && parseMove('S2', 2) === null);
      var c2 = create(stubCanvas(300, 300), { size: 2, duration: 0 });
      c2.turn('M E S');
      assert('2x2: turning M E S leaves the cube solved (matches apply())', c2.isSolved());
      c2.destroy();
      assert('3x3: slices are still accepted', parseMove('M', 3) !== null && parseMove('E', 3) !== null);
      // junk tokens are ignored, exactly like draw_nnn.apply()
      var c3 = create(stubCanvas(300, 300), { duration: 0 });
      c3.turn('R garbage !! U');
      assert('junk tokens are ignored (state == apply("R U"))',
        eq(c3.getState(), NNN.apply(NNN.solved(3), 3, 'R U')));
      c3.destroy();
    })();

    /* ---- 12. HiDPI backing store ---- */
    (function () {
      var oldDpr = g.devicePixelRatio;
      g.devicePixelRatio = 2;
      var cv = stubCanvas(300, 300);
      var c = create(cv, { duration: 0 });
      assert('hidpi: backing store is css size * dpr (300 -> ' + cv.width + ')',
        cv.width === 600 && cv.height === 600);
      // regression: hidden canvas (clientWidth 0) must NOT feed the backing store back
      // through dpr on every render, growing it without bound.
      cv.clientWidth = 0; cv.clientHeight = 0;
      c.render(); c.render(); c.render();
      assert('hidpi: a hidden canvas (clientWidth 0) keeps a stable backing store (' +
        cv.width + ', not 4800)', cv.width === 600 && cv.height === 600);
      g.devicePixelRatio = oldDpr;
      c.destroy();
    })();

    console.log(fails ? '\n' + fails + ' FAILURE(S)' : '\nALL PASS');
    process.exit(fails ? 1 : 0);
  }
})(typeof window !== 'undefined' ? window : globalThis);
