/* draw_mega.js — Megaminx scramble diagram module (puzzle key: 'mgm').
 *
 * ORIGINAL IMPLEMENTATION. No code was taken from csTimer, TNoodle or any
 * other project; all permutations are derived at load time from dodecahedron
 * geometry (rotation + nearest-centroid matching), not from copied tables.
 *
 * Notation semantics (researched, not copied) — WCA / Pochmann megaminx
 * scrambling notation, per:
 *   - WCA Regulations Article 12d ("Notation for Megaminx (scrambling only)")
 *   - Speedsolving wiki, "Megaminx notation" ("hold the Megaminx by the L
 *     face (for an R turn) or the U face (for a D turn) ... move the bulk of
 *     the puzzle two-fifths of a turn in the indicated direction")
 *   - qqTimer megaminx doc, mzrg.com/qqtimer/megadoc.html ("R means to turn
 *     the entire puzzle minus the left face (like an r turn on 3x3), D means
 *     to turn the entire puzzle minus the top face (like a d turn on 3x3),
 *     and U means to just turn the top layer")
 *
 * Concretely, with the puzzle held U on top and F toward the viewer:
 *   U    : top-face turn, 72° clockwise seen from above (U' = ccw).
 *          One U click carries R-side ring stickers to F, F's to L.
 *   R++  : the L face layer (L's 11 stickers + 3 stickers on each of L's 5
 *          neighbours) stays fixed; everything else rotates 144° (two 72°
 *          clicks) about the axis through the DBR face (the face opposite
 *          L), clockwise as seen from outside DBR — i.e. like a wide "r"
 *          turn on 3x3 (which carries F->U, U->back): one click carries the
 *          U centre to BL, two clicks (R++) carry it to DBL.  R-- inverse.
 *   D++  : the U face layer stays fixed; everything else rotates 144° about
 *          the vertical axis (through D), clockwise as seen from below —
 *          like a wide "d" turn on 3x3 (which carries F->R): one click
 *          carries the F centre to R, two clicks (D++) to BR.  D-- inverse.
 * Scramble lines look like "R++ D-- R++ D++ ... U'" (10 R/D moves then U/U'),
 * but the parser simply applies whitespace-separated tokens and silently
 * skips anything it does not recognise.
 *
 * Face names / colours (classic light-opposite-dark 12-colour scheme; the
 * bottom-ring face opposite each top face gets the "light" partner colour):
 *   U  white   #ffffff   |  D   grey        #999999
 *   F  green   #00d800   |  B   light green #7ceb7c
 *   R  red     #ee0000   |  DBL orange      #ff8000
 *   BR blue    #0000f2   |  DL  light blue  #88ccff
 *   BL yellow  #ffff00   |  DR  cream       #ffffb3
 *   L  purple  #8316b5   |  DBR pink        #ff88cc
 *
 * Net layout: the standard double-rosette megaminx net.  Left rosette: U in
 * the centre (point-up pentagon) with its five neighbours unfolded outward,
 * F on the bottom edge — the top hemisphere as seen from above.  Right
 * rosette: D in the centre (point-down pentagon) with the five bottom-ring
 * faces unfolded outward, B on the top edge — the bottom hemisphere as seen
 * from below.  Every face is shown from outside; within a rosette adjacent
 * faces share their unfolded edge exactly, so stickers line up as on a real
 * unfolded megaminx.
 *
 * Usage (browser):  <script src="draw_mega.js"></script>
 *                   ScrImage['mgm'].draw(canvasEl, "R++ D-- ... U'");
 * Usage (node)   :  node draw_mega.js        (runs the self-test)
 */
(function () {
  'use strict';

  /* ===================== small vector helpers (3D) ===================== */

  function vdot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function vcross(a, b) {
    return [a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0]];
  }
  function vsub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function vlen(a) { return Math.sqrt(vdot(a, a)); }
  function vnorm(a) { var l = vlen(a); return [a[0] / l, a[1] / l, a[2] / l]; }
  function vdist(a, b) { return vlen(vsub(a, b)); }
  /* Rodrigues rotation of point p about unit axis k by ang (right-hand rule:
   * positive ang looks counterclockwise when viewed from the +k side). */
  function vrot(p, k, ang) {
    var c = Math.cos(ang), s = Math.sin(ang);
    var kxp = vcross(k, p), kdp = vdot(k, p) * (1 - c);
    return [p[0] * c + kxp[0] * s + k[0] * kdp,
            p[1] * c + kxp[1] * s + k[1] * kdp,
            p[2] * c + kxp[2] * s + k[2] * kdp];
  }

  /* ===================== dodecahedron construction ===================== */

  var PHI = (1 + Math.sqrt(5)) / 2;
  var verts = [];    // 20 vertices
  var normals = [];  // 12 unit face normals (icosahedron vertex directions)
  (function buildSolid() {
    var s1, s2, s3, i;
    for (s1 = -1; s1 <= 1; s1 += 2)
      for (s2 = -1; s2 <= 1; s2 += 2)
        for (s3 = -1; s3 <= 1; s3 += 2) verts.push([s1, s2, s3]);
    var ip = 1 / PHI;
    for (s1 = -1; s1 <= 1; s1 += 2)
      for (s2 = -1; s2 <= 1; s2 += 2) {
        verts.push([0, s1 * ip, s2 * PHI]);
        verts.push([s1 * ip, s2 * PHI, 0]);
        verts.push([s1 * PHI, 0, s2 * ip]);
      }
    /* For THIS vertex set the 12 face-centre directions are the cyclic
     * permutations of (+-1, 0, +-PHI) — e.g. the face through (0,+-1/PHI,PHI),
     * (1,+-1,1), (PHI,0,1/PHI) has centroid ((2+PHI)/5, 0, (3PHI+2)/5) which
     * is parallel to (1, 0, PHI). */
    for (s1 = -1; s1 <= 1; s1 += 2)
      for (s2 = -1; s2 <= 1; s2 += 2) {
        normals.push([s1, 0, s2 * PHI]);
        normals.push([0, s1 * PHI, s2]);
        normals.push([s1 * PHI, s2, 0]);
      }
    for (i = 0; i < normals.length; i++) normals[i] = vnorm(normals[i]);
  })();

  /* Orient the solid: chosen U-normal -> +z, then a chosen top-ring face
   * (F) -> azimuth 270° (toward the viewer at -y; +x is the viewer's right,
   * +z up). */
  (function orient() {
    function rotAll(axis, ang) {
      var i;
      for (i = 0; i < verts.length; i++) verts[i] = vrot(verts[i], axis, ang);
      for (i = 0; i < normals.length; i++) normals[i] = vrot(normals[i], axis, ang);
    }
    var target = vnorm([0, 1, PHI]), best = 0, bd = -2, i, d;
    for (i = 0; i < 12; i++) {
      d = vdot(normals[i], target);
      if (d > bd) { bd = d; best = i; }
    }
    var nU = normals[best], z = [0, 0, 1];
    var ax = vcross(nU, z), al = vlen(ax);
    if (al > 1e-12) rotAll(vnorm(ax), Math.acos(Math.max(-1, Math.min(1, vdot(nU, z)))));
    /* pick any top-ring face (0.2 < nz < 0.8) as F, spin it to azimuth 270° */
    for (i = 0; i < 12; i++) {
      if (normals[i][2] > 0.2 && normals[i][2] < 0.8) {
        var azi = Math.atan2(normals[i][1], normals[i][0]);
        rotAll([0, 0, 1], (-Math.PI / 2) - azi);
        break;
      }
    }
  })();

  /* Faces: vertex membership + canonical cycle (CCW as seen from outside). */
  var faces = [];   // { n, cyc:[5 vertex ids], center:[x,y,z], has:{vid:true} }
  (function buildFaces() {
    var f, i, j;
    for (f = 0; f < 12; f++) {
      var n = normals[f];
      var ids = [];
      for (i = 0; i < 20; i++) ids.push(i);
      ids.sort(function (a, b) { return vdot(vnorm(verts[b]), n) - vdot(vnorm(verts[a]), n); });
      ids = ids.slice(0, 5);
      /* order CCW around n (right-hand): angle in basis (u, w = n x u) */
      var u = null;
      for (j = 0; j < 5 && !u; j++) {
        var d = vsub(verts[ids[j]], [n[0] * vdot(n, verts[ids[j]]), n[1] * vdot(n, verts[ids[j]]), n[2] * vdot(n, verts[ids[j]])]);
        if (vlen(d) > 1e-9) u = vnorm(d);
      }
      var w = vcross(n, u);
      ids.sort(function (a, b) {
        return Math.atan2(vdot(verts[a], w), vdot(verts[a], u)) -
               Math.atan2(vdot(verts[b], w), vdot(verts[b], u));
      });
      var cx = [0, 0, 0];
      var has = {};
      for (j = 0; j < 5; j++) {
        cx[0] += verts[ids[j]][0] / 5; cx[1] += verts[ids[j]][1] / 5; cx[2] += verts[ids[j]][2] / 5;
        has[ids[j]] = true;
      }
      faces.push({ n: n, cyc: ids, center: cx, has: has });
    }
  })();

  /* Name faces by hemisphere + azimuth (see orientation comment above). */
  var FACE_NAME = new Array(12);
  var FID = {};   // name -> face index
  (function nameFaces() {
    var topAz = { F: 270, R: 342, BR: 54, BL: 126, L: 198 };
    var botAz = { B: 90, DBL: 162, DL: 234, DR: 306, DBR: 18 };
    function azDeg(n) {
      var a = Math.atan2(n[1], n[0]) * 180 / Math.PI;
      return ((a % 360) + 360) % 360;
    }
    function azDiff(a, b) { return Math.abs(((a - b) % 360 + 540) % 360 - 180); }
    var f, name, best, bd;
    for (f = 0; f < 12; f++) {
      var nz = faces[f].n[2], table, nm;
      if (nz > 0.9) { nm = 'U'; }
      else if (nz < -0.9) { nm = 'D'; }
      else {
        table = nz > 0 ? topAz : botAz;
        best = null; bd = 1e9;
        for (name in table) {
          var d = azDiff(azDeg(faces[f].n), table[name]);
          if (d < bd) { bd = d; best = name; }
        }
        nm = best;
      }
      FACE_NAME[f] = nm;
      FID[nm] = f;
    }
    var count = 0, k;
    for (k in FID) count++;
    if (count !== 12) throw new Error('draw_mega: face naming failed');
  })();

  /* ============================ sticker slots =========================== *
   * 132 slots, face-major: index = face*11 + slot.
   *   slot 0        : centre
   *   slot 1 + 2k   : corner sticker at face vertex cyc[k]
   *   slot 2 + 2k   : edge sticker on face edge (cyc[k], cyc[k+1])
   * Positions are centroids C + t*(anchor - C); rotations of the solid map
   * centres->centres, vertices->vertices, edge midpoints->edge midpoints,
   * hence slot centroids -> slot centroids exactly (up to float error).    */

  var NSTICK = 132;
  var slotPos = new Array(NSTICK);
  var slotMeta = new Array(NSTICK); // {face, type:'c'|'v'|'e', v, e:[a,b]}
  (function buildSlots() {
    var T = 0.62, f, k;
    function mix(c, p) {
      return [c[0] + T * (p[0] - c[0]), c[1] + T * (p[1] - c[1]), c[2] + T * (p[2] - c[2])];
    }
    for (f = 0; f < 12; f++) {
      var F = faces[f], base = f * 11;
      slotPos[base] = F.center.slice();
      slotMeta[base] = { face: f, type: 'c' };
      for (k = 0; k < 5; k++) {
        var a = F.cyc[k], b = F.cyc[(k + 1) % 5];
        slotPos[base + 1 + 2 * k] = mix(F.center, verts[a]);
        slotMeta[base + 1 + 2 * k] = { face: f, type: 'v', v: a };
        var mid = [(verts[a][0] + verts[b][0]) / 2, (verts[a][1] + verts[b][1]) / 2, (verts[a][2] + verts[b][2]) / 2];
        slotPos[base + 2 + 2 * k] = mix(F.center, mid);
        slotMeta[base + 2 + 2 * k] = { face: f, type: 'e', e: [a, b] };
      }
    }
  })();

  /* Layer membership: sticker i belongs to face f's layer iff its piece
   * touches face f.  Exact combinatorial test (no float thresholds):
   *  - any sticker of f itself;
   *  - a corner sticker of another face whose vertex is a vertex of f;
   *  - an edge sticker of another face whose both edge vertices lie on f. */
  function layerBool(f) {
    var inL = new Array(NSTICK), i, m, has = faces[f].has;
    for (i = 0; i < NSTICK; i++) {
      m = slotMeta[i];
      inL[i] = (m.face === f) ||
               (m.type === 'v' && !!has[m.v]) ||
               (m.type === 'e' && !!has[m.e[0]] && !!has[m.e[1]]);
    }
    return inL;
  }

  /* ====================== move permutation derivation =================== */

  var buildInfo = { maxResidual: 0 };

  /* Rotate the moving stickers 'clicks' fifth-turns CLOCKWISE as viewed from
   * outside the face whose outward normal is axisN (right-hand rule => the
   * clockwise-from-outside angle is negative), then match each rotated
   * centroid to its (unique) coincident slot centroid.                     */
  function buildPerm(movingBool, axisN, clicks) {
    var ang = -clicks * 2 * Math.PI / 5;
    var perm = new Array(NSTICK), used = new Array(NSTICK), i, j;
    for (i = 0; i < NSTICK; i++) { perm[i] = i; used[i] = false; }
    for (i = 0; i < NSTICK; i++) {
      if (!movingBool[i]) continue;
      var q = vrot(slotPos[i], axisN, ang), bj = -1, bd = 1e9;
      for (j = 0; j < NSTICK; j++) {
        var d = vdist(q, slotPos[j]);
        if (d < bd) { bd = d; bj = j; }
      }
      if (bd > 1e-8) throw new Error('draw_mega: rotation is not a slot symmetry (residual ' + bd + ')');
      if (bd > buildInfo.maxResidual) buildInfo.maxResidual = bd;
      perm[i] = bj;
    }
    for (i = 0; i < NSTICK; i++) {
      if (used[perm[i]]) throw new Error('draw_mega: derived map is not injective');
      used[perm[i]] = true;
    }
    return perm;
  }
  function invertPerm(p) {
    var inv = new Array(p.length), i;
    for (i = 0; i < p.length; i++) inv[p[i]] = i;
    return inv;
  }

  var MOVES = {};
  (function buildMoves() {
    var i;
    var notLayerL = layerBool(FID.L).map(function (b) { return !b; });
    var notLayerU = layerBool(FID.U).map(function (b) { return !b; });
    /* U: turn just the U layer, one click cw seen from above. */
    MOVES['U'] = buildPerm(layerBool(FID.U), faces[FID.U].n, 1);
    /* R++: everything except the L layer, two clicks cw seen from outside
     * DBR (= the face opposite L, through which the turn axis exits). */
    MOVES['R++'] = buildPerm(notLayerL, faces[FID.DBR].n, 2);
    /* D++: everything except the U layer, two clicks cw seen from below. */
    MOVES['D++'] = buildPerm(notLayerU, faces[FID.D].n, 2);
    MOVES["U'"] = invertPerm(MOVES['U']);
    MOVES['R--'] = invertPerm(MOVES['R++']);
    MOVES['D--'] = invertPerm(MOVES['D++']);
  })();

  /* ============================ scramble state ========================== */

  function solvedState() {
    var st = new Array(NSTICK), i;
    for (i = 0; i < NSTICK; i++) st[i] = (i / 11) | 0;   // colour id = face id
    return st;
  }
  function applyPerm(st, p) {
    var ns = new Array(NSTICK), i;
    for (i = 0; i < NSTICK; i++) ns[p[i]] = st[i];
    return ns;
  }
  /* Whitespace-split token application; unknown tokens are skipped, never
   * thrown on. */
  function applyScramble(scramble) {
    var st = solvedState();
    if (scramble == null) return st;
    var toks = String(scramble).split(/\s+/), i;
    for (i = 0; i < toks.length; i++) {
      var p = MOVES[toks[i]];
      if (p) st = applyPerm(st, p);
    }
    return st;
  }

  /* =============================== 2D net =============================== *
   * Each face pentagon is subdivided radially into 11 regions matching the
   * slot layout; 3D<->2D correspondence is kept exact by mapping vertex ids,
   * so orientation/chirality is right on every face (all faces are drawn as
   * seen from outside; y is flipped once at render time for canvas coords). */

  var NET = new Array(NSTICK);       // 132 polygons [[x,y],...] (math coords, y up)
  var NETBB = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
  (function buildNet() {
    var T2 = 0.55;   // inner-pentagon factor  (centre sticker size)
    var S2 = 0.31;   // edge split along each side (corner/edge boundary)

    function pent(cx, cy, r, a0deg) {
      var pts = [], j;
      for (j = 0; j < 5; j++) {
        var a = (a0deg + 72 * j) * Math.PI / 180;
        pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
      }
      return pts;   // CCW in math coords (angle increases CCW)
    }
    function lerp2(p, q, t) { return [p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]; }

    /* face f whose aligned 3D vertex ids av[j] sit at 2D points p2[j] */
    function placeFace(f, av, p2) {
      var c = [0, 0], j, k;
      for (j = 0; j < 5; j++) { c[0] += p2[j][0] / 5; c[1] += p2[j][1] / 5; }
      var I = [], A = [], B = [];
      for (j = 0; j < 5; j++) {
        I.push(lerp2(c, p2[j], T2));
        A.push(lerp2(p2[j], p2[(j + 1) % 5], S2));
        B.push(lerp2(p2[j], p2[(j + 1) % 5], 1 - S2));
      }
      var base = f * 11;
      NET[base] = [I[0], I[1], I[2], I[3], I[4]];
      for (j = 0; j < 5; j++) {
        k = faces[f].cyc.indexOf(av[j]);   // canonical slot position
        /* corner sticker at vertex av[j]; av is a rotation of cyc, so the
         * following edge (av[j],av[j+1]) is the canonical edge k too */
        NET[base + 1 + 2 * k] = [B[(j + 4) % 5], p2[j], A[j], I[j]];
        NET[base + 2 + 2 * k] = [A[j], B[j], I[(j + 1) % 5], I[j]];
      }
    }
    function faceWithEdge(a, b, notF) {
      for (var f = 0; f < 12; f++)
        if (f !== notF && faces[f].has[a] && faces[f].has[b]) return f;
      throw new Error('draw_mega: edge lookup failed');
    }
    /* One rosette: centre face + its five neighbours unfolded outward (each
     * petal is the point-reflection of the centre pentagon through the
     * shared-edge midpoint — the unique regular pentagon on that edge).
     * The petal named anchorName lands on centre-pentagon edge #2.        */
    function rosette(cf, anchorName, cx, cy, a0) {
      var cyc = faces[cf].cyc, r = -1, j, k;
      for (k = 0; k < 5; k++)
        if (faceWithEdge(cyc[k], cyc[(k + 1) % 5], cf) === FID[anchorName]) { r = k; break; }
      var p2 = pent(cx, cy, 1, a0), av = [];
      for (j = 0; j < 5; j++) av.push(cyc[(r + j + 3) % 5]);   // av[2]=cyc[r]
      placeFace(cf, av, p2);
      for (k = 0; k < 5; k++) {
        var a = av[k], b = av[(k + 1) % 5];
        var g = faceWithEdge(a, b, cf);
        var M = [(p2[k][0] + p2[(k + 1) % 5][0]) / 2, (p2[k][1] + p2[(k + 1) % 5][1]) / 2];
        var q2 = [];
        for (j = 0; j < 5; j++) q2.push([2 * M[0] - p2[j][0], 2 * M[1] - p2[j][1]]);
        var gc = faces[g].cyc, m = -1;
        for (j = 0; j < 5; j++)
          if (gc[j] === b && gc[(j + 1) % 5] === a) { m = j; break; }
        if (m < 0) throw new Error('draw_mega: neighbour cycle mismatch');
        var gav = [];
        for (j = 0; j < 5; j++) gav.push(gc[(m + j - k + 10) % 5]);  // gav[k]=b
        placeFace(g, gav, q2);
      }
    }

    var apo = Math.cos(Math.PI / 5);              // pentagon apothem, r=1
    var DX = 2 * (2 * apo + 1) + 0.25;            // rosette diameter + gap
    rosette(FID.U, 'F', 0, 0, 90);                // U rosette, F petal at bottom
    rosette(FID.D, 'B', DX, 0, -90);              // D rosette, B petal at top

    var i, j2;
    for (i = 0; i < NSTICK; i++)
      for (j2 = 0; j2 < NET[i].length; j2++) {
        var p = NET[i][j2];
        if (p[0] < NETBB.x0) NETBB.x0 = p[0];
        if (p[1] < NETBB.y0) NETBB.y0 = p[1];
        if (p[0] > NETBB.x1) NETBB.x1 = p[0];
        if (p[1] > NETBB.y1) NETBB.y1 = p[1];
      }
  })();

  /* =============================== colours ============================== */

  var COLORS = {
    U: '#ffffff', F: '#00d800', R: '#ee0000', BR: '#0000f2', BL: '#ffff00', L: '#8316b5',
    D: '#999999', B: '#7ceb7c', DBL: '#ff8000', DL: '#88ccff', DR: '#ffffb3', DBR: '#ff88cc'
  };
  var faceColor = new Array(12);
  (function () {
    for (var f = 0; f < 12; f++) faceColor[f] = COLORS[FACE_NAME[f]];
  })();

  /* ================================ draw ================================ */

  function draw(canvas, scramble) {
    try {
      if (!canvas || typeof canvas.getContext !== 'function') return false;
      var ctx = canvas.getContext('2d');
      if (!ctx) return false;
      var w = canvas.width | 0, h = canvas.height | 0;
      var st = applyScramble(scramble);
      var margin = 6;
      var bw = NETBB.x1 - NETBB.x0, bh = NETBB.y1 - NETBB.y0;
      var sc = Math.min((w - 2 * margin) / bw, (h - 2 * margin) / bh);
      if (!(sc > 0) || !isFinite(sc)) sc = 0.01;
      var ox = (w - sc * bw) / 2, oy = (h - sc * bh) / 2;
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = Math.max(0.8, sc * 0.025);
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#000000';
      for (var i = 0; i < NSTICK; i++) {
        var poly = NET[i];
        ctx.beginPath();
        for (var j = 0; j < poly.length; j++) {
          var X = ox + (poly[j][0] - NETBB.x0) * sc;
          var Y = oy + (NETBB.y1 - poly[j][1]) * sc;   // flip y: math -> canvas
          if (j === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
        }
        ctx.closePath();
        ctx.fillStyle = faceColor[st[i]];
        ctx.fill();
        ctx.stroke();
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ============================== register ============================== */

  var api = {
    draw: draw,
    /* internals exposed for tests / debugging */
    _: {
      applyScramble: applyScramble,
      solvedState: solvedState,
      applyPerm: applyPerm,
      moves: MOVES,
      faceName: FACE_NAME,
      faceId: FID,
      layerBool: layerBool,
      slotPos: slotPos,
      net: NET,
      buildInfo: buildInfo,
      colors: COLORS
    }
  };
  var g = (typeof window !== 'undefined') ? window : globalThis;
  g.ScrImage = g.ScrImage || {};
  g.ScrImage['mgm'] = api;
  if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') module.exports = api;

  /* ============================== self-test ============================= */

  if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
    (function selfTest() {
      var failures = 0;
      function check(name, ok, extra) {
        if (ok) console.log('PASS ' + name + (extra ? '  (' + extra + ')' : ''));
        else { failures++; console.log('FAIL ' + name + (extra ? '  (' + extra + ')' : '')); }
      }
      function composeSeq(perms) {   // apply left to right: result[i] = pN(...p1(i))
        var r = [], i, k;
        for (i = 0; i < NSTICK; i++) r[i] = i;
        for (k = 0; k < perms.length; k++) {
          var p = perms[k], nr = new Array(NSTICK);
          for (i = 0; i < NSTICK; i++) nr[i] = p[r[i]];
          r = nr;
        }
        return r;
      }
      function isIdentity(p) {
        for (var i = 0; i < NSTICK; i++) if (p[i] !== i) return false;
        return true;
      }
      function isPermutation(p) {
        var seen = new Array(NSTICK), i;
        for (i = 0; i < NSTICK; i++) seen[i] = false;
        for (i = 0; i < NSTICK; i++) {
          if (typeof p[i] !== 'number' || p[i] < 0 || p[i] >= NSTICK || seen[p[i]]) return false;
          seen[p[i]] = true;
        }
        return true;
      }
      function movedCount(p) {
        var c = 0;
        for (var i = 0; i < NSTICK; i++) if (p[i] !== i) c++;
        return c;
      }
      function arrEq(a, b) {
        if (a.length !== b.length) return false;
        for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
        return true;
      }

      var M = MOVES, solved = solvedState();

      /* --- 3. every derived move is a true permutation over 132 stickers --- */
      var names = ['U', "U'", 'R++', 'R--', 'D++', 'D--'], ni;
      for (ni = 0; ni < names.length; ni++)
        check('perm[' + names[ni] + '] is a bijection over 132', isPermutation(M[names[ni]]));
      check('geometry residual tiny', buildInfo.maxResidual < 1e-9,
            'max nearest-slot residual ' + buildInfo.maxResidual.toExponential(2));
      /* residual must be far below the smallest slot separation */
      var minSep = 1e9;
      for (var i1 = 0; i1 < NSTICK; i1++)
        for (var j1 = i1 + 1; j1 < NSTICK; j1++) {
          var dd = vdist(slotPos[i1], slotPos[j1]);
          if (dd < minSep) minSep = dd;
        }
      check('slot centroids well separated', minSep > 0.2, 'min separation ' + minSep.toFixed(4));

      /* --- 1 & 2. order / inverse identities --- */
      check('U x5 = identity', isIdentity(composeSeq([M['U'], M['U'], M['U'], M['U'], M['U']])));
      check("U U' = identity", isIdentity(composeSeq([M['U'], M["U'"]])));
      check('R++ x5 = identity', isIdentity(composeSeq([M['R++'], M['R++'], M['R++'], M['R++'], M['R++']])));
      check('R++ R-- = identity', isIdentity(composeSeq([M['R++'], M['R--']])));
      check('D++ x5 = identity', isIdentity(composeSeq([M['D++'], M['D++'], M['D++'], M['D++'], M['D++']])));
      check('D++ D-- = identity', isIdentity(composeSeq([M['D++'], M['D--']])));

      /* --- 5. exact changed-sticker counts ---
       * U layer = 11 stickers of U + (2 corners + 1 edge) on each of the 5
       * neighbours = 26 slots; the U centre lies on the axis and is fixed,
       * so U permutes exactly 25 slots.  Colour-wise, U's own 10 moving
       * stickers stay on the U face (same colour) while the 15 neighbour
       * stickers each land on the adjacent (differently coloured) face, so
       * exactly 15 stickers change colour from solved.
       * R++/D++ move everything but one 26-slot layer (132-26 = 106 slots);
       * the axis-face centre (DBR resp. D) is on the axis and fixed, so 105
       * slots are permuted.  Colour-wise the axis face's own 11 stickers
       * stay on that face; the other 5 full faces (11 each = 55) and 5
       * partial faces (11-3 = 8 each = 40) 5-cycle among distinct colours:
       * 95 colour changes.                                                */
      check('U moves exactly 25 slots', movedCount(M['U']) === 25, 'got ' + movedCount(M['U']));
      check('R++ moves exactly 105 slots', movedCount(M['R++']) === 105, 'got ' + movedCount(M['R++']));
      check('D++ moves exactly 105 slots', movedCount(M['D++']) === 105, 'got ' + movedCount(M['D++']));
      function colorChanged(tok) {
        var st = applyScramble(tok), c = 0;
        for (var i = 0; i < NSTICK; i++) if (st[i] !== solved[i]) c++;
        return c;
      }
      check('U recolours exactly 15 stickers', colorChanged('U') === 15, 'got ' + colorChanged('U'));
      check('R++ recolours exactly 95 stickers', colorChanged('R++') === 95, 'got ' + colorChanged('R++'));
      check('D++ recolours exactly 95 stickers', colorChanged('D++') === 95, 'got ' + colorChanged('D++'));

      /* --- direction anchors (nail the clockwise conventions) ---
       * U cw from above: F ring -> L, R ring -> F. */
      (function () {
        var st = applyScramble('U');
        var inU = layerBool(FID.U), ok1 = true, ok2 = true, i;
        for (i = 0; i < NSTICK; i++) {
          if (!inU[i] || slotMeta[i].face === FID.U) continue;
          if (slotMeta[i].face === FID.L && st[i] !== FID.F) ok1 = false;
          if (slotMeta[i].face === FID.F && st[i] !== FID.R) ok2 = false;
        }
        check('U carries F-ring stickers onto L', ok1);
        check('U carries R-ring stickers onto F', ok2);
      })();
      /* R++ like a wide r on 3x3.  r (cw seen from the right) carries F->U
       * and U->B; here the ring around the DBR axis through U is
       * U -> BL -> DBL -> DL -> F (clockwise), so one click carries the U
       * centre to BL and two clicks (R++) carry it to DBL. */
      (function () {
        var st = applyScramble('R++');
        check('R++ carries U centre to DBL centre', st[FID.DBL * 11] === FID.U,
              'DBL centre holds ' + FACE_NAME[st[FID.DBL * 11]]);
        check('R++ leaves L face untouched', (function () {
          for (var k = 0; k < 11; k++) if (st[FID.L * 11 + k] !== FID.L) return false;
          return true;
        })());
      })();
      /* D++ like a wide d: F centre -> R (1 click) -> BR (2 clicks). */
      (function () {
        var st = applyScramble('D++');
        check('D++ carries F centre to BR centre', st[FID.BR * 11] === FID.F,
              'BR centre holds ' + FACE_NAME[st[FID.BR * 11]]);
        check('D++ leaves U face untouched', (function () {
          for (var k = 0; k < 11; k++) if (st[FID.U * 11 + k] !== FID.U) return false;
          return true;
        })());
      })();

      /* --- 4. full 7-line Pochmann-style scramble invariants --- */
      var seed = 42;
      function rnd(n) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; }
      var lines = [], li, mi;
      for (li = 0; li < 7; li++) {
        var toks = [];
        for (mi = 0; mi < 10; mi++)
          toks.push((mi % 2 === 0 ? 'R' : 'D') + (rnd(2) ? '++' : '--'));
        toks.push(rnd(2) ? 'U' : "U'");
        lines.push(toks.join(' '));
      }
      var scramble7 = lines.join('\n');
      (function () {
        var st = applyScramble(scramble7), counts = {}, i, ok = true;
        for (i = 0; i < NSTICK; i++) counts[st[i]] = (counts[st[i]] || 0) + 1;
        for (i = 0; i < 12; i++) if (counts[i] !== 11) ok = false;
        check('after 7-line scramble every colour appears 11x', ok);
        var centres = [];
        for (i = 0; i < 12; i++) centres.push(st[i * 11]);
        centres.sort(function (a, b) { return a - b; });
        var ok2 = true;
        for (i = 0; i < 12; i++) if (centres[i] !== i) ok2 = false;
        check('centre-sticker multiset preserved (12 distinct centres)', ok2);
        check('7-line scramble actually scrambles', !arrEq(st, solved));
      })();

      /* unknown tokens are skipped, never thrown on */
      check('unknown tokens skipped', arrEq(applyScramble('R++ XY9 3.14 <b> U'), applyScramble('R++ U')));
      check('null scramble = solved', arrEq(applyScramble(null), solved));

      /* --- net geometry sanity --- */
      (function () {
        var i, j, ok = true, area, total = 0;
        for (i = 0; i < NSTICK; i++) {
          var p = NET[i];
          if (!p || p.length < 4) { ok = false; continue; }
          area = 0;
          for (j = 0; j < p.length; j++) {
            var q = p[(j + 1) % p.length];
            area += p[j][0] * q[1] - q[0] * p[j][1];
          }
          area /= 2;
          if (!(area > 1e-6)) ok = false;   // must be CCW (math coords) & non-degenerate
          total += area;
        }
        check('net: 132 polygons, all CCW & non-degenerate', ok);
        var pentArea = 12 * (5 / 2) * Math.sin(72 * Math.PI / 180); // r=1 pentagon x12
        check('net: stickers tile the 12 pentagons exactly',
              Math.abs(total - pentArea) < 1e-6,
              'area ' + total.toFixed(6) + ' vs ' + pentArea.toFixed(6));
        /* rosette petals share their unfolded edge with the centre pentagon */
        function faceVertexPoint(f, vid) {   // 2D corner point of face f at 3D vertex vid
          var k = faces[f].cyc.indexOf(vid);
          return NET[f * 11 + 1 + 2 * k][1];   // corner poly point #1 is the pentagon vertex
        }
        var okE = true, cf, list = [[FID.U], [FID.D]], r;
        for (r = 0; r < 2; r++) {
          cf = list[r][0];
          for (var k2 = 0; k2 < 5; k2++) {
            var a = faces[cf].cyc[k2], b = faces[cf].cyc[(k2 + 1) % 5], g = -1, f2;
            for (f2 = 0; f2 < 12; f2++)
              if (f2 !== cf && faces[f2].has[a] && faces[f2].has[b]) g = f2;
            var d1 = Math.abs(faceVertexPoint(cf, a)[0] - faceVertexPoint(g, a)[0]) +
                     Math.abs(faceVertexPoint(cf, a)[1] - faceVertexPoint(g, a)[1]) +
                     Math.abs(faceVertexPoint(cf, b)[0] - faceVertexPoint(g, b)[0]) +
                     Math.abs(faceVertexPoint(cf, b)[1] - faceVertexPoint(g, b)[1]);
            if (d1 > 1e-9) okE = false;
          }
        }
        check('net: petals share unfolded edges exactly (both rosettes)', okE);
      })();

      /* --- 6. draw() smoke test on a stub canvas --- */
      (function () {
        var calls = { clearRect: 0, fill: 0, stroke: 0, beginPath: 0 };
        var stubCtx = {
          fillStyle: '', strokeStyle: '', lineWidth: 1, lineJoin: '',
          clearRect: function () { calls.clearRect++; },
          beginPath: function () { calls.beginPath++; },
          moveTo: function () {}, lineTo: function () {}, closePath: function () {},
          fill: function () { calls.fill++; }, stroke: function () { calls.stroke++; },
          save: function () {}, restore: function () {}
        };
        var stubCanvas = { width: 420, height: 240, getContext: function () { return stubCtx; } };
        var ok = false, err = null;
        try { ok = draw(stubCanvas, scramble7); } catch (e) { err = e; }
        check('draw(7-line scramble) does not throw and returns true', ok === true && !err);
        check('draw clears then paints all 132 stickers',
              calls.clearRect === 1 && calls.fill === 132 && calls.stroke === 132,
              'clear=' + calls.clearRect + ' fill=' + calls.fill);
        calls.clearRect = 0; calls.fill = 0; calls.stroke = 0; calls.beginPath = 0;
        var ok2 = false;
        try { ok2 = draw(stubCanvas, ''); } catch (e) { err = e; }
        check('draw(empty scramble = solved) does not throw', ok2 === true && !err);
        var ok3 = false;
        try { ok3 = draw(stubCanvas, 'R++ NONSENSE ++R U2 U'); } catch (e) { err = e; }
        check('draw with junk tokens does not throw', ok3 === true && !err);
        check('draw(null canvas) returns false quietly', draw(null, 'U') === false);
      })();

      console.log(failures === 0
        ? 'ALL TESTS PASSED'
        : failures + ' TEST(S) FAILED');
      if (failures > 0 && typeof process !== 'undefined') process.exit(1);
    })();
  }
})();
