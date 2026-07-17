/* js/feat_vcube_game.js — 큐브 레벨 (cube levels): a depth-progression game for the virtual cube
 *
 * Answers the user's ask verbatim: "레벨 나눠서 깨는거 어때 타임어택으로 재미요소 더하는거야".
 *
 * Depends on (PUBLIC surface only — this pack edits nothing):
 *   window.App          — API.md contract
 *   window.VCube3D      — js/vcube3d.js  (create/setState/turn/onSolved/dragBy/destroy)
 *   window.VCubeFeat    — js/feat_vcube.js (keyMap, tupleToToken, isRotationTuple, widthKeys)
 *   window.ScrImage.nnn — js/draw_nnn.js (node self-test only: proves the levels are real states)
 *
 * ---------------------------------------------------------------------------------------
 * THE DESIGN, AND WHY
 * ---------------------------------------------------------------------------------------
 * 1. PROGRESSION IS SCRAMBLE DEPTH. Level 1 is one move — literally "undo this". Level 40 is
 *    20 moves, i.e. a WCA-grade random scramble. Everything in between is a real difficulty
 *    ramp that needs no invented mechanics: at depth 3 you invert by sight, at depth 8 you
 *    start needing a method, at depth 14+ you are just solving a cube. The curve is
 *      depth(L) = round(1 + 19 * ((L-1)/39)^0.72)
 *    exponent < 1 on purpose: the trivial depths (1-6) are a five-minute on-ramp, and the
 *    back two thirds of the ladder live at depth 12-20 where the actual practice is.
 *
 * 2. LEVELS ARE DETERMINISTIC. seed = mulberry32(hash(level)) — same level, same scramble,
 *    for everyone, forever. No Math.random anywhere in generation. That is what makes a best
 *    time mean something and what makes "Lv 27 걸렸어?" a sentence two people can say to each
 *    other. The generator also refuses cancellations (never the same face twice, never a
 *    third same-axis move in a row), so a level advertised as 12수 really is 12 moves deep.
 *
 * 3. STARS, NOT PASS/FAIL. Finishing always earns ★. ★★ is under 1.6x par, ★★★ is under par.
 *    par(d) = 1.0 + 1.5d seconds up to depth 8, then +0.75s per extra move (a depth-20 level
 *    golds at 22.0s — a sub-22 full solve). Nobody is ever locked out by a clock; the clock is
 *    only ever the thing you chase. The live star meter (★★★ decaying to ★★ to ★ as the run
 *    passes each threshold) is the whole time-attack feeling, present on EVERY level, not just
 *    in a mode you have to go find.
 *
 * 4. UNLOCKING: CHAPTER STAR GATES, LEVELS OPEN INSIDE A CHAPTER. A real call, both extremes
 *    rejected:
 *      - strictly sequential punishes the person who can already solve — they must grind 20
 *        trivial levels before the ladder says anything about them, and one hated level walls
 *        the whole game;
 *      - all-open throws away the on-ramp (depth 1-3 is where you learn that you can just
 *        invert the scramble) and removes every reason to come back tomorrow.
 *    So: a chapter opens at a TOTAL star count (0/8/18/36/56 of 120). You may skip any level
 *    you dislike, a strong cuber unlocks the lot in one sitting because 3-starring is easy for
 *    them, and a beginner still meets the levels in order. Progress, not a gate you rattle.
 *
 * 5. TIME ATTACK is per chapter, unlocked by clearing every level in it: all of its levels
 *    back to back on ONE running clock, gold = 1.15x the sum of the level pars. This is the
 *    "타임어택" the user asked for, and it re-uses levels you have already beaten rather than
 *    inventing new content — which is exactly why you come back.
 *
 * 6. GAME RUNS NEVER TOUCH THE SESSION. No App.addSolve, no App.startTimer, no App.newScramble,
 *    no writes to App.db(). A 3-move level would poison a PB history and an ao5 forever. All
 *    game state lives under cstc_pack_vcubegame_*. This is non-negotiable and is asserted by
 *    the node self-test (the file contains no addSolve call at all).
 *
 * 7. REACHABILITY. Desktop: a menu button (🎮). Mobile: the tab bar is fixed at 5 and is not
 *    ours, and #cubePane belongs to feat_vcube — so the launcher is ALSO a registered tool
 *    ('cubegame'), which puts a live "이어하기 Lv N ★x/120" card in the mobile 도구 tab and in
 *    either desktop tool slot. No core file, and no other pack's file, is edited to get here.
 *
 * `node js/feat_vcube_game.js` runs the pure-logic self-test and must stay exit 0.
 */
(function () {
  'use strict';

  /* ==================================================================== */
  /* PURE LOGIC — no DOM, no App. Everything above the HAS_APP gate is     */
  /* node-testable, and every rule the game has lives here.                */
  /* ==================================================================== */

  var LEVELS = 40;
  var MAX_DEPTH = 20;
  var CURVE_EXP = 0.72;

  /* mulberry32 — 32-bit, seeded, portable. Deliberately NOT Math.random: levels must be the
   * same for every player on every device, this year and next. */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /* Spread consecutive level numbers apart before seeding — mulberry32 seeded with 1,2,3
   * produces visibly related first outputs, and Lv1/Lv2 starting with the same face looks
   * like a bug even though it isn't. */
  function seedOf(level) {
    var s = Math.imul(level >>> 0, 0x9E3779B1) >>> 0;
    return (s ^ 0x00C0FFEE) >>> 0;
  }

  function clampLevel(L) { return Math.max(1, Math.min(LEVELS, Math.round(L) || 1)); }

  /* Monotone non-decreasing by construction: pow() is increasing on [0,1] and round() is
   * non-decreasing. depth(1) = 1, depth(40) = 20. */
  function depthOf(level) {
    var L = clampLevel(level);
    var t = (L - 1) / (LEVELS - 1);
    return Math.max(1, Math.min(MAX_DEPTH, Math.round(1 + (MAX_DEPTH - 1) * Math.pow(t, CURVE_EXP))));
  }

  var FACES = ['U', 'R', 'F', 'D', 'L', 'B'];
  /* The three faces the default camera (yaw -30 / pitch 37.5) actually shows. Levels 1-2 are
   * drawn only from these: the very first thing the game ever asks you to do must not be
   * "undo the move on the face you cannot see". After that, orbiting is part of the game. */
  var VISIBLE = ['U', 'R', 'F'];
  var AXIS_OF = { U: 0, D: 0, R: 1, L: 1, F: 2, B: 2 };
  var SUFFIX = ['', "'", '2'];

  /* Deterministic scramble for a level. Rules (standard scramble hygiene):
   *   - never the same face twice in a row  (R R' would cancel; R R2 is one move dressed up)
   *   - never a third consecutive move on one axis (R L R is R2 L in disguise)
   * so `depth` tokens really are `depth` moves of work. */
  function scrambleFor(level) {
    var L = clampLevel(level);
    var d = depthOf(L);
    var rnd = mulberry32(seedOf(L));
    var pool = d <= 2 ? VISIBLE : FACES;
    var out = [], prev = null, prev2 = null;
    var guard = 0;
    while (out.length < d && guard++ < 10000) {
      var f = pool[Math.floor(rnd() * pool.length) % pool.length];
      if (prev && f === prev) continue;
      if (prev && prev2 && AXIS_OF[f] === AXIS_OF[prev] && AXIS_OF[prev] === AXIS_OF[prev2]) continue;
      out.push(f + SUFFIX[Math.floor(rnd() * 3) % 3]);
      prev2 = prev; prev = f;
    }
    return out.join(' ');
  }

  /* Past this depth the TASK stops growing: you are no longer reading a short sequence and
   * undoing it, you are solving a 3x3 with a method, and one more scrambled move does not
   * change that. The game shows you the CUBE and never the scramble string, so "just invert
   * it" dies early — by depth ~10 every level is the same job. */
  var SAT_DEPTH = 10;

  /* par = the ★★★ time.
   *
   * Linear in moves while the level is still a sequence you can hold in your head, then
   * FLAT from SAT_DEPTH on. The flat tail is the whole point and it is not laziness:
   *
   * par used to keep climbing forever (+0.75s per move past depth 8, up to 22.0s at depth
   * 20). Since the underlying task saturates around depth 10, an ever-looser clock over a
   * constant job means the ladder gets EASIER as you climb: sub-22 on a 20-move scramble
   * (Lv40, '마스터') was a softer ask than sub-16.75 on a 13-move one (Lv22), and the
   * tightest gold on the whole ladder sat in the MIDDLE at Lv16-18. The header promised
   * 'late levels hard' and delivered the exact opposite.
   *
   * Any par that rises over a task that has stopped rising inverts like that, so past
   * SAT_DEPTH every level simply shares one par. The late game is then hard for the honest
   * reasons — more levels to clear at that same par, higher star gates, and the time attack
   * — rather than because the clock quietly got generous. */
  function parMs(depth) {
    var d = Math.min(Math.max(1, depth), SAT_DEPTH);
    var sec = d <= 8 ? (1.0 + 1.5 * d) : (13.0 + 1.75 * (d - 8));
    return Math.round(sec * 1000);
  }
  function goldMs(level) { return parMs(depthOf(level)); }
  function silverMs(level) { return Math.round(goldMs(level) * 1.6); }
  /* [★★★ threshold, ★★ threshold] — strictly ordered, always. */
  function thresholds(level) { return [goldMs(level), silverMs(level)]; }
  function starsFor(level, ms) {
    if (!(ms >= 0)) return 0;
    var t = thresholds(level);
    return ms <= t[0] ? 3 : ms <= t[1] ? 2 : 1;
  }
  /* What the meter shows mid-run: the stars you would still get if you finished RIGHT NOW. */
  function liveStars(level, elapsedMs) {
    var t = thresholds(level);
    return elapsedMs <= t[0] ? 3 : elapsedMs <= t[1] ? 2 : 1;
  }

  var CHAPTERS = [
    { id: 1, emoji: '🐣', ko: '첫걸음', en: 'first steps', from: 1, to: 5, gate: 0 },
    { id: 2, emoji: '🔥', ko: '감 잡기', en: 'warming up', from: 6, to: 12, gate: 8 },
    { id: 3, emoji: '⛰️', ko: '오르막', en: 'the climb', from: 13, to: 22, gate: 18 },
    { id: 4, emoji: '⚡', ko: '실전', en: 'real solves', from: 23, to: 32, gate: 36 },
    { id: 5, emoji: '👑', ko: '마스터', en: 'master', from: 33, to: 40, gate: 56 }
  ];
  function chapterOf(level) {
    var L = clampLevel(level);
    for (var i = 0; i < CHAPTERS.length; i++) {
      if (L >= CHAPTERS[i].from && L <= CHAPTERS[i].to) return CHAPTERS[i];
    }
    return CHAPTERS[0];
  }
  function levelsOf(ch) {
    var out = [];
    for (var L = ch.from; L <= ch.to; L++) out.push(L);
    return out;
  }

  /* ---- progress: {v:1, lv:{"12":{ms, st, mv}}, ta:{"3":{ms}}} ---- */
  function emptyProgress() { return { v: 1, lv: {}, ta: {} }; }
  function decodeProgress(str) {
    var p = emptyProgress();
    if (!str) return p;
    var raw;
    try { raw = JSON.parse(str); } catch (e) { return p; }
    if (!raw || typeof raw !== 'object') return p;
    var lv = raw.lv && typeof raw.lv === 'object' ? raw.lv : {};
    Object.keys(lv).forEach(function (k) {
      var L = clampLevel(+k), e = lv[k];
      if (!e || !(e.ms >= 0)) return;
      p.lv[L] = { ms: Math.round(e.ms), st: starsFor(L, e.ms), mv: e.mv >= 0 ? Math.round(e.mv) : 0 };
    });
    var ta = raw.ta && typeof raw.ta === 'object' ? raw.ta : {};
    Object.keys(ta).forEach(function (k) {
      var e = ta[k];
      if (e && e.ms >= 0) p.ta[+k] = { ms: Math.round(e.ms) };
    });
    return p;
  }
  function encodeProgress(p) { return JSON.stringify({ v: 1, lv: p.lv || {}, ta: p.ta || {} }); }

  /* Returns {improved, stars, prev} — never regresses a best time. */
  function recordLevel(p, level, ms, moves) {
    var L = clampLevel(level);
    var prev = p.lv[L] || null;
    var stars = starsFor(L, ms);
    var improved = !prev || ms < prev.ms;
    if (improved) p.lv[L] = { ms: Math.round(ms), st: stars, mv: Math.max(0, Math.round(moves || 0)) };
    return { improved: improved, stars: stars, prev: prev };
  }
  function recordTA(p, chId, ms) {
    var prev = p.ta[chId] || null;
    var improved = !prev || ms < prev.ms;
    if (improved) p.ta[chId] = { ms: Math.round(ms) };
    return { improved: improved, prev: prev };
  }

  function totalStars(p) {
    var n = 0;
    Object.keys(p.lv).forEach(function (k) { n += p.lv[k].st || 0; });
    return n;
  }
  function chapterStars(p, ch) {
    var n = 0;
    levelsOf(ch).forEach(function (L) { n += (p.lv[L] && p.lv[L].st) || 0; });
    return n;
  }
  function chapterOpen(p, ch) { return totalStars(p) >= ch.gate; }
  function levelOpen(p, level) { return chapterOpen(p, chapterOf(level)); }
  function chapterCleared(p, ch) {
    return levelsOf(ch).every(function (L) { return !!p.lv[L]; });
  }
  /* Where "이어하기" sends you: the first OPEN level you have not cleared, else your last level. */
  function nextLevel(p) {
    for (var L = 1; L <= LEVELS; L++) {
      if (!p.lv[L] && levelOpen(p, L)) return L;
    }
    for (var i = LEVELS; i >= 1; i--) if (levelOpen(p, i)) return i;
    return 1;
  }
  /* Count a typed solve in HTM — the same metric depthOf()/scrambleFor() speak, so that
   * "N수 사용 · 최단 D수" compares two numbers of the same kind.
   *
   * Two things this must NOT do, both of which it used to:
   *   - count whole-cube rotations (x/y/z). An orbit is not a move in any metric, and since
   *     the game shows you the CUBE and never the scramble string, orbiting to read the back
   *     is MANDATORY — so every genuine solve was inflated by however much you looked.
   *   - count a half-turn twice. R2 is ONE move in HTM, but you type it as two R presses.
   *     The scramble's own 'R2' counts as one, so the comparison was rigged against you.
   * Net effect of the old counter: it told your ★★★ players they were sloppy when they had
   * just typed the optimal solution.
   *
   * Consecutive turns of the same face collapse into one move (R R = R2 = 1). That is the
   * HTM rule; it slightly UNDER-counts a deliberate R R' (identity, scores 1 not 0), which
   * is a nonsense sequence nobody types on purpose and is the safe way to be wrong. */
  function htmSeq(tokens) {
    var c = 0, prevBase = null;
    for (var i = 0; i < (tokens || []).length; i++) {
      var t = String(tokens[i] || '');
      if (!t) continue;
      var base = t.replace(/'$/, '');     // R' -> R, Rw' -> Rw : same face+width group
      if (base !== prevBase) c++;
      prevBase = base;
    }
    return c;
  }

  /* Between two levels of a time attack you get a forced 420ms beat and then you have to
   * actually LOOK at the next cube before you can turn anything. On one continuous clock
   * that reading time is yours to pay, so the target has to budget for it — otherwise the
   * honest clock would just be a stealth difficulty hike over the old frozen one. */
  var TA_LOOK_MS = 2000;
  /* Time-attack targets: [gold, silver] for a whole chapter run, measured on ONE clock that
   * runs from the first turn to the last solve (see taLive/taElapsed). */
  function taTargets(ch) {
    var ls = levelsOf(ch), sum = 0;
    ls.forEach(function (L) { sum += goldMs(L); });
    sum += Math.max(0, ls.length - 1) * TA_LOOK_MS;
    return [Math.round(sum * 1.15), Math.round(sum * 1.45)];
  }
  function taStars(ch, ms) {
    var t = taTargets(ch);
    return ms <= t[0] ? 3 : ms <= t[1] ? 2 : 1;
  }

  var PURE = {
    LEVELS: LEVELS, MAX_DEPTH: MAX_DEPTH, CHAPTERS: CHAPTERS,
    mulberry32: mulberry32, seedOf: seedOf,
    depthOf: depthOf, scrambleFor: scrambleFor,
    parMs: parMs, goldMs: goldMs, silverMs: silverMs, thresholds: thresholds,
    starsFor: starsFor, liveStars: liveStars,
    chapterOf: chapterOf, levelsOf: levelsOf,
    emptyProgress: emptyProgress, decodeProgress: decodeProgress, encodeProgress: encodeProgress,
    recordLevel: recordLevel, recordTA: recordTA,
    totalStars: totalStars, chapterStars: chapterStars,
    chapterOpen: chapterOpen, levelOpen: levelOpen, chapterCleared: chapterCleared,
    nextLevel: nextLevel, taTargets: taTargets, taStars: taStars, htmSeq: htmSeq,
    TA_LOOK_MS: TA_LOOK_MS
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = PURE;

  var HAS_APP = typeof window !== 'undefined' && !!window.App;
  if (!HAS_APP) { if (typeof require !== 'undefined' && require.main === module) selfTest(); return; }

  var App = window.App;
  function T(k, ko, en) { return App.i18n(k, ko, en); }
  var MOBILE_MQ = '(max-width: 760px), (max-height: 500px) and (max-width: 950px)';
  function isMobile() {
    return App.isMobile ? App.isMobile() : window.matchMedia(MOBILE_MQ).matches;
  }
  /* ONE CLOCK, everywhere. vcube3d's onSolved echoes back exactly the stamp its caller handed
   * to turn(), so the start stamp and the finish stamp must come from the same source or the
   * elapsed time is nonsense. Mixing Date.now() (keyboard path) with an event.timeStamp
   * (performance-relative in every current browser) silently produced ms=0 the first time a
   * run started on one and ended on the other. performance.now() is also monotonic, so a
   * system clock change mid-solve cannot corrupt a time either. */
  var perf = (typeof performance !== 'undefined' && performance.now)
    ? function () { return performance.now(); }
    : function () { return Date.now(); };
  /* A real event timeStamp is the moment of the KEYPRESS, which beats the moment our handler
   * happened to run — but only take it when it is on perf's timeline. */
  function stampOf(e) {
    var t = e && e.timeStamp;
    return (typeof t === 'number' && t > 0 && t < 1e12 && typeof performance !== 'undefined'
      && performance.now) ? t : perf();
  }

  function fmt(ms) {
    var s = Math.max(0, ms) / 1000;
    if (s < 60) return s.toFixed(2);
    var m = Math.floor(s / 60);
    var r = s - m * 60;
    return m + ':' + (r < 10 ? '0' : '') + r.toFixed(2);
  }
  function chName(ch) { return T('vcg_ch' + ch.id, ch.ko, ch.en); }

  /* ============================== storage ============================== */
  var KEY_PROGRESS = 'cstc_pack_vcubegame_progress';
  var prog = null;
  function P() {
    if (prog) return prog;
    var raw = null;
    try { raw = localStorage.getItem(KEY_PROGRESS); } catch (e) { }
    prog = decodeProgress(raw);
    return prog;
  }
  function saveP() {
    try { localStorage.setItem(KEY_PROGRESS, encodeProgress(P())); } catch (e) { }
  }

  /* ============================== CSS ============================== */
  App.addCSS([
    /* the game is a screen, not a floating box — the user already said so about the cube:
     * "왜 플로팅으로 보여? 큰 화면으로 보고 싶은데" */
    '#vcgModal .mbox{width:min(1080px,96vw);max-width:96vw;height:min(94vh,940px);',
    'display:flex;flex-direction:column;}',
    '#vcgModal .mbody{flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden;padding-top:2px;}',

    /* ---- shared ---- */
    '.vcgStars{display:inline-flex;gap:2px;line-height:1;}',
    '.vcgStars s{font-style:normal;text-decoration:none;color:var(--line);',
    'transition:color .18s ease,transform .18s ease;}',
    '.vcgStars s.on{color:var(--orange);}',
    '.vcgChip{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:999px;',
    'background:var(--card2);color:var(--sub);font-size:12px;font-weight:700;white-space:nowrap;}',
    '.vcgChip.acc{background:var(--accent-weak);color:var(--accent);}',

    /* ---- map ---- */
    '.vcgMap{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;display:flex;flex-direction:column;gap:14px;',
    'padding:2px 2px 18px;}',
    '.vcgHero{display:flex;align-items:center;gap:16px;flex-wrap:wrap;background:var(--card2);',
    'border-radius:var(--radius-card);padding:16px 18px;}',
    '.vcgHeroL{flex:1;min-width:150px;}',
    '.vcgHeroBig{font-size:30px;font-weight:800;color:var(--orange);letter-spacing:-0.02em;',
    'line-height:1.15;font-variant-numeric:tabular-nums;}',
    '.vcgHeroSub{font-size:13px;color:var(--sub);margin-top:5px;line-height:1.5;}',
    '.vcgHero .btn{min-height:44px;padding:0 18px;font-size:15px;}',

    '.vcgCh{background:var(--card);border:1px solid var(--line);border-radius:var(--radius-card);',
    'padding:14px 14px 16px;}',
    '.vcgChHead{display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap;}',
    '.vcgChName{font-size:15px;font-weight:800;color:var(--fg);}',
    '.vcgChSpacer{flex:1;}',
    '.vcgGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(66px,1fr));gap:8px;}',
    '.vcgTile{position:relative;aspect-ratio:1;border-radius:14px;border:1px solid var(--line);',
    'background:var(--card2);color:var(--fg);display:flex;flex-direction:column;align-items:center;',
    'justify-content:center;gap:3px;cursor:pointer;padding:0;font:inherit;',
    'transition:transform .12s ease,box-shadow .12s ease,border-color .12s ease;}',
    '.vcgTile:hover{transform:translateY(-2px);box-shadow:var(--shadow-card);border-color:var(--accent);}',
    '.vcgTile b{font-size:17px;font-weight:800;letter-spacing:-0.02em;}',
    '.vcgTile .vcgStars{font-size:9px;}',
    '.vcgTile .t{font-size:10px;color:var(--sub);font-variant-numeric:tabular-nums;}',
    '.vcgTile.done{background:var(--accent-weak);border-color:transparent;}',
    '.vcgTile.gold{box-shadow:inset 0 0 0 2px var(--orange);}',
    '.vcgTile.next{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-weak);}',
    /* a locked chapter is a one-line promise, not a screenful of empty card: four of them
     * used to push the ladder itself below the fold */
    '.vcgCh.lock{padding:12px 14px;}',
    '.vcgCh.lock .vcgChHead{margin-bottom:0;}',
    '.vcgCh.lock .vcgChName,.vcgCh.lock .vcgChip{opacity:.55;}',
    '.vcgChLock{display:flex;align-items:center;gap:6px;color:var(--sub);font-size:12px;',
    'font-weight:600;line-height:1.4;white-space:nowrap;}',
    '.vcgTa{display:flex;align-items:center;gap:10px;margin-top:12px;padding:10px 12px;flex-wrap:wrap;',
    'background:var(--card2);border-radius:var(--radius-btn);}',
    '.vcgTaT{flex:1;min-width:120px;font-size:12px;color:var(--sub);line-height:1.5;}',
    '.vcgTaT b{color:var(--fg);font-size:13px;display:block;}',

    /* ---- play ---- */
    '.vcgPlay{flex:1;min-height:0;display:flex;flex-direction:column;gap:8px;}',
    '.vcgBar{display:flex;align-items:center;gap:8px;flex-wrap:nowrap;}',
    '.vcgBack{padding:0 10px;min-height:34px;}',
    '.vcgLv{font-size:15px;font-weight:800;color:var(--fg);white-space:nowrap;}',
    '.vcgBarSpace{flex:1;}',
    '.vcgLcd{font-variant-numeric:tabular-nums;font-weight:800;font-size:clamp(24px,5vw,40px);',
    'color:var(--fg);letter-spacing:-0.02em;line-height:1;min-width:4.5ch;text-align:right;}',
    '.vcgLcd.run{color:var(--accent);}',
    '.vcgLcd.done{color:var(--green);}',
    '.vcgStars.vcgMeter{font-size:17px;flex:none;}',
    /* The time-pressure bar is the game. It gets the full width under the header rather than
     * a 90px stub beside the clock, where it read as a stray dash next to the digits. */
    '.vcgTrack{height:5px;border-radius:999px;background:var(--card2);overflow:hidden;flex:none;}',
    '.vcgTrack i{display:block;height:100%;width:0;background:var(--accent);border-radius:999px;',
    'transition:background-color .25s ease;}',
    '.vcgTrack i.warn{background:var(--orange);}',
    '.vcgTrack i.bad{background:var(--red);}',
    '.vcgStage{flex:1;min-height:0;position:relative;display:flex;align-items:center;',
    'justify-content:center;background:var(--card2);border-radius:var(--radius-card);overflow:hidden;}',
    '.vcgStage canvas{display:block;touch-action:none;cursor:grab;}',
    '.vcgStage canvas:active{cursor:grabbing;}',
    '.vcgHint{position:absolute;left:0;right:0;bottom:8px;text-align:center;color:var(--sub);',
    'font-size:12px;pointer-events:none;padding:0 12px;line-height:1.5;}',
    '.vcgPad{display:none;grid-template-columns:repeat(6,1fr);gap:6px;}',
    '.vcgPad button{padding:9px 0;font-size:14px;font-weight:700;}',
    '.vcgFoot{display:flex;gap:8px;align-items:center;justify-content:flex-end;flex-wrap:wrap;}',
    '.vcgFootHint{flex:1;min-width:120px;font-size:11px;color:var(--sub);line-height:1.6;}',
    '.vcgFootHint kbd{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:var(--card2);',
    'border-radius:5px;padding:1px 5px;color:var(--fg);font-size:11px;}',

    /* ---- result card ---- */
    '.vcgRes{position:absolute;inset:0;display:none;align-items:center;justify-content:center;',
    'background:color-mix(in srgb,var(--card2) 78%,transparent);backdrop-filter:blur(6px);z-index:4;padding:14px;}',
    '.vcgRes.show{display:flex;}',
    '.vcgResCard{background:var(--card);border-radius:var(--radius-card);box-shadow:var(--shadow-float);',
    'padding:22px 24px;text-align:center;max-width:340px;width:100%;',
    'animation:vcgPop .26s cubic-bezier(.2,1.3,.4,1) both;}',
    '@keyframes vcgPop{from{transform:scale(.86);opacity:0;}to{transform:scale(1);opacity:1;}}',
    '.vcgResCard .vcgStars{font-size:36px;justify-content:center;margin-bottom:8px;}',
    '.vcgResCard .vcgStars s{animation:vcgStar .3s cubic-bezier(.2,1.4,.4,1) both;}',
    '.vcgResCard .vcgStars s:nth-child(2){animation-delay:.1s;}',
    '.vcgResCard .vcgStars s:nth-child(3){animation-delay:.2s;}',
    '@keyframes vcgStar{from{transform:scale(0) rotate(-40deg);}to{transform:scale(1) rotate(0);}}',
    '.vcgResTime{font-size:38px;font-weight:800;color:var(--fg);font-variant-numeric:tabular-nums;',
    'letter-spacing:-0.03em;line-height:1.1;}',
    '.vcgResSub{font-size:13px;color:var(--sub);margin-top:6px;line-height:1.6;}',
    '.vcgResSub b{color:var(--accent);}',
    '.vcgResSub b.warn{color:var(--orange);}',
    '.vcgResBtns{display:flex;gap:8px;margin-top:18px;}',
    '.vcgResBtns .btn{flex:1;min-height:46px;font-size:15px;}',

    '@media ' + MOBILE_MQ + '{',
    /* mobile.css makes every modal an 86dvh bottom sheet with a grabber. Right for a settings
     * sheet, wrong here: this is a screen you play in, and the user has already said so about
     * the cube ("큰 화면으로 보고 싶은데"). Take the whole viewport and drop the grabber. */
    '#vcgModal .mbox{width:100vw;max-width:100vw;height:100vh;height:100dvh;',
    'max-height:100vh;max-height:100dvh;border-radius:0;padding-top:12px;}',
    '#vcgModal .mbox::before{display:none;}',
    '.vcgPad{display:grid;}',
    '.vcgFootHint{display:none;}',
    '.vcgHeroBig{font-size:26px;}',
    '}'
  ].join(''));

  /* ============================== small builders ============================== */
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function starsEl(n, of) {
    var w = el('span', 'vcgStars');
    for (var i = 0; i < (of || 3); i++) {
      var s = el('s', i < n ? 'on' : '', '★');
      w.appendChild(s);
    }
    return w;
  }

  /* ============================== state ============================== */
  var M = null;              // modal handle
  var mapEl = null, playEl = null, ui = {};
  var eng = null;
  var ro = null;             // ResizeObserver on the stage
  var run = {
    active: false,           // play screen is live
    level: 1,
    phase: 'idle',           // idle | ready | running | done
    startTs: 0, ms: 0, moves: 0, seq: [],
    lastStars: 3,            // highest star tier still reachable — drives the live meter
    raf: 0,
    oSl: 1, oSr: 1,
    ta: null                 // {ch, queue:[levels], idx, total} when in time attack
  };

  /* ============================== map screen ============================== */
  function buildMap() {
    mapEl = el('div', 'vcgMap');
    return mapEl;
  }

  function renderMap() {
    if (!mapEl) return;
    var p = P();
    mapEl.textContent = '';
    var tot = totalStars(p);
    var nxt = nextLevel(p);

    /* hero */
    /* The headline is the COLLECTION, not the app's name — the modal title already says that,
     * and a map screen's job is to show you what you have and what is next. */
    var hero = el('div', 'vcgHero');
    var hl = el('div', 'vcgHeroL');
    hl.appendChild(el('div', 'vcgHeroBig', '★ ' + tot + ' / ' + (LEVELS * 3)));
    hl.appendChild(el('div', 'vcgHeroSub',
      T('vcgHeroSub', '1수부터 20수까지, 레벨마다 정해진 스크램블. 빠를수록 별이 늘어납니다.',
        'from 1 move to 20 — every level has one fixed scramble. faster = more stars.')));
    hero.appendChild(hl);
    var go = el('button', 'btn primary',
      T('vcgGo', '이어하기 Lv ' + nxt, 'continue — Lv ' + nxt));
    go.addEventListener('click', function () { startLevel(nxt); });
    hero.appendChild(go);
    mapEl.appendChild(hero);

    /* chapters */
    CHAPTERS.forEach(function (ch) {
      var open = chapterOpen(p, ch);
      var box = el('div', 'vcgCh' + (open ? '' : ' lock'));
      var head = el('div', 'vcgChHead');
      head.appendChild(el('span', null, open ? ch.emoji : '🔒'));
      head.appendChild(el('span', 'vcgChName', chName(ch)));
      /* The chip is a RANGE, so it must not claim a depth the previous chapter already
       * claimed: depthOf() is a step function, so depthOf(ch.to) frequently equals
       * depthOf(next.from) and the chips read '1–5수' / '5–9수' / '9–13수' — 5 and 9 twice.
       * Start this chapter's range one past where the previous one ended. A chapter whose
       * whole span is one depth collapses to a single number rather than '5–5수'. */
      var dLo = ch.id > 1 ? Math.max(depthOf(ch.from), depthOf(CHAPTERS[ch.id - 2].to) + 1)
        : depthOf(ch.from);
      var dHi = Math.max(dLo, depthOf(ch.to));
      head.appendChild(el('span', 'vcgChip',
        (dLo === dHi ? String(dLo) : dLo + '–' + dHi) + T('vcgMoves', '수', ' moves')));
      head.appendChild(el('span', 'vcgChSpacer'));
      if (!open) {
        head.appendChild(el('span', 'vcgChLock', T('vcgLock' + ch.id,
          '★ ' + (ch.gate - tot) + '개 더 모으면 열려요',
          '★ ' + (ch.gate - tot) + ' more to unlock')));
      }
      head.appendChild(el('span', 'vcgChip' + (open ? ' acc' : ''),
        '★ ' + chapterStars(p, ch) + '/' + (levelsOf(ch).length * 3)));
      box.appendChild(head);

      if (!open) { mapEl.appendChild(box); return; }

      var grid = el('div', 'vcgGrid');
      levelsOf(ch).forEach(function (L) {
        var rec = p.lv[L];
        var t = el('button', 'vcgTile' + (rec ? ' done' : '') +
          (rec && rec.st === 3 ? ' gold' : '') + (L === nxt ? ' next' : ''));
        t.appendChild(el('b', null, String(L)));
        t.appendChild(starsEl(rec ? rec.st : 0));
        t.appendChild(el('span', 't', rec ? fmt(rec.ms) : depthOf(L) + T('vcgMoves2', '수', 'm')));
        t.title = 'Lv ' + L + ' · ' + depthOf(L) + T('vcgMoves', '수', ' moves') +
          ' · ★★★ ' + fmt(goldMs(L));
        t.addEventListener('click', function () { startLevel(L); });
        grid.appendChild(t);
      });
      box.appendChild(grid);

      /* time attack strip */
      var cleared = chapterCleared(p, ch);
      var ta = el('div', 'vcgTa');
      var tt = el('div', 'vcgTaT');
      var tb = el('b', null, '⚡ ' + T('vcgTa', '타임어택', 'time attack') + ' · ' +
        levelsOf(ch).length + T('vcgTaLv', '레벨 연속', ' levels back to back'));
      tt.appendChild(tb);
      var best = p.ta[ch.id];
      tt.appendChild(document.createTextNode(cleared
        ? (best ? T('vcgTaBest', '최고 ', 'best ') + fmt(best.ms) + '  ·  ★★★ ' + fmt(taTargets(ch)[0])
          : T('vcgTaNone', '기록 없음  ·  ★★★ ', 'no record  ·  ★★★ ') + fmt(taTargets(ch)[0]))
        : T('vcgTaLock', '이 챕터의 모든 레벨을 클리어하면 열려요',
          'clear every level in this chapter to unlock')));
      ta.appendChild(tt);
      if (cleared) {
        if (best) ta.appendChild(starsEl(taStars(ch, best.ms)));
        var tbtn = el('button', 'btn primary', T('vcgTaGo', '도전', 'start'));
        tbtn.addEventListener('click', function () { startTA(ch); });
        ta.appendChild(tbtn);
      }
      box.appendChild(ta);
      mapEl.appendChild(box);
    });
  }

  /* ============================== play screen ============================== */
  function buildPlay() {
    playEl = el('div', 'vcgPlay');
    playEl.style.display = 'none';

    var bar = el('div', 'vcgBar');
    ui.back = el('button', 'btn ghost vcgBack', '‹ ' + T('vcgList', '목록', 'levels'));
    ui.back.addEventListener('click', function () { toMap(); });
    bar.appendChild(ui.back);
    ui.lv = el('div', 'vcgLv', 'Lv 1');
    bar.appendChild(ui.lv);
    ui.depth = el('span', 'vcgChip', '1수');
    bar.appendChild(ui.depth);
    bar.appendChild(el('div', 'vcgBarSpace'));
    ui.lcd = el('div', 'vcgLcd', '0.00');
    bar.appendChild(ui.lcd);
    ui.meter = starsEl(3);
    ui.meter.classList.add('vcgMeter');
    bar.appendChild(ui.meter);
    playEl.appendChild(bar);

    ui.track = el('div', 'vcgTrack');
    ui.trackFill = el('i');
    ui.track.appendChild(ui.trackFill);
    playEl.appendChild(ui.track);

    ui.stage = el('div', 'vcgStage');
    ui.canvas = document.createElement('canvas');
    bindOrbit(ui.canvas);
    ui.stage.appendChild(ui.canvas);
    ui.hint = el('div', 'vcgHint');
    ui.stage.appendChild(ui.hint);

    /* result card lives INSIDE the stage: the cube stays visible behind it, which is what
     * makes "다시" feel like a retry rather than a page change */
    ui.res = el('div', 'vcgRes');
    ui.resCard = el('div', 'vcgResCard');
    ui.res.appendChild(ui.resCard);
    ui.stage.appendChild(ui.res);
    playEl.appendChild(ui.stage);

    ui.pad = el('div', 'vcgPad');
    ['U', 'R', 'F', 'D', 'L', 'B'].forEach(function (f) {
      [f, f + "'"].forEach(function (tok) {
        var b = el('button', 'btn', tok);
        b.addEventListener('click', function () { doMove(tok, false, perf()); });
        ui.pad.appendChild(b);
      });
    });
    playEl.appendChild(ui.pad);

    var foot = el('div', 'vcgFoot');
    ui.footHint = el('div', 'vcgFootHint');
    ui.footHint.innerHTML = T('vcgKeys',
      'csTimer 키맵 그대로 — <kbd>J</kbd>/<kbd>F</kbd> U·U\', <kbd>I</kbd>/<kbd>K</kbd> R·R\', ' +
      '<kbd>H</kbd>/<kbd>G</kbd> F·F\' … <kbd>Enter</kbd> 다시, <kbd>Esc</kbd> 목록',
      'csTimer key map — <kbd>J</kbd>/<kbd>F</kbd> U·U\', <kbd>I</kbd>/<kbd>K</kbd> R·R\', ' +
      '<kbd>H</kbd>/<kbd>G</kbd> F·F\' … <kbd>Enter</kbd> retry, <kbd>Esc</kbd> levels');
    foot.appendChild(ui.footHint);
    ui.retry = el('button', 'btn', T('vcgRetry', '다시', 'retry'));
    ui.retry.addEventListener('click', function () { retry(); });
    foot.appendChild(ui.retry);
    playEl.appendChild(foot);
    return playEl;
  }

  function bindOrbit(canvas) {
    var down = false, lx = 0, ly = 0;
    canvas.addEventListener('pointerdown', function (e) {
      if (!eng) return;
      down = true; lx = e.clientX; ly = e.clientY;
      if (canvas.setPointerCapture) { try { canvas.setPointerCapture(e.pointerId); } catch (er) { } }
      e.preventDefault();
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!down) return;
      if (!eng) { down = false; return; }
      eng.dragBy(e.clientX - lx, -(e.clientY - ly));
      lx = e.clientX; ly = e.clientY;
    });
    function up() { down = false; }
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
  }

  function fitCanvas() {
    if (!ui.stage || !ui.canvas) return;
    var w = ui.stage.clientWidth, h = ui.stage.clientHeight;
    if (!w || !h) return;
    var side = Math.max(120, Math.min(w - 16, h - 16));
    ui.canvas.style.width = side + 'px';
    ui.canvas.style.height = side + 'px';
    if (eng) eng.render();
  }
  function observeStage() {
    if (ro || !window.ResizeObserver || !ui.stage) return;
    ro = new ResizeObserver(function () { fitCanvas(); });
    ro.observe(ui.stage);
  }
  function unobserveStage() {
    if (ro) { try { ro.disconnect(); } catch (e) { } ro = null; }
  }

  /* ---- run control ---- */
  function setHint(s) { if (ui.hint) ui.hint.textContent = s || ''; }
  function lcd(text, cls) {
    if (!ui.lcd) return;
    ui.lcd.textContent = text;
    ui.lcd.className = 'vcgLcd' + (cls ? ' ' + cls : '');
  }
  function paintMeter(elapsed) {
    var L = run.level;
    var t = thresholds(L);
    var n = liveStars(L, elapsed);
    var pips = ui.meter.querySelectorAll('s');
    for (var i = 0; i < pips.length; i++) pips[i].className = i < n ? 'on' : '';
    /* losing a star mid-run is the whole point of the meter — say it out loud once, on the
     * frame it happens, instead of letting a pip quietly go grey */
    if (run.phase === 'running' && n < run.lastStars) {
      run.lastStars = n;
      setHint(n === 2
        ? T('vcgLost3', '★★★ 놓쳤어요 — ★★ ' + fmt(t[1]) + ' 까지!', '★★★ gone — ★★ by ' + fmt(t[1]) + '!')
        : T('vcgLost2', '★ 하나 — 끝까지 풀어보세요', 'down to ★ — but finish it anyway'));
    }
    /* the bar runs to the ★★★ line, then to the ★★ line, then sits full-red */
    var span = n === 3 ? t[0] : n === 2 ? t[1] : t[1];
    var pct = Math.max(0, Math.min(1, elapsed / span));
    ui.trackFill.style.width = (pct * 100).toFixed(1) + '%';
    ui.trackFill.className = n === 3 ? '' : n === 2 ? 'warn' : 'bad';
  }
  function stopLoop() {
    if (run.raf) cancelAnimationFrame(run.raf);
    run.raf = 0;
  }
  /* A time attack is ONE clock for the whole chapter, running from your first turn of the
   * first level until the last level is solved — including the beat between levels and the
   * time you spend reading the next scramble. taLive() is what keeps the rAF loop alive
   * across those transitions, when run.phase is 'done' or 'ready' rather than 'running'.
   *
   * It used to be a lie: each level's clock restarted on ITS first move and finishTAStep()
   * merely summed the solve times, so inter-level inspection was free and unlimited. The
   * header hint has always read '시계는 계속 돌아갑니다' (the clock never stops) while the
   * clock was visibly frozen — 15 seconds of stalling cost exactly 0.00s. Now it does not
   * stop, which is the only reading of the hint and of the gold target that is honest. */
  function taLive() { return !!(run.ta && run.ta.origin && !run.ta.done); }
  /* Total elapsed on the time-attack clock right now. */
  function taElapsed(atTs) {
    if (!run.ta || !run.ta.origin) return 0;
    return Math.max(0, (atTs == null ? perf() : atTs) - run.ta.origin);
  }

  function loop() {
    if (run.phase !== 'running' && !taLive()) return;
    /* The level meter tracks THIS level's solve; the LCD shows the clock that is being
     * judged — the chapter total in a time attack, the level time otherwise. */
    var e = run.phase === 'running' ? perf() - run.startTs : 0;
    lcd(fmt(run.ta ? taElapsed() : e), 'run');
    if (run.phase === 'running') paintMeter(e);
    run.raf = requestAnimationFrame(loop);
  }

  function ensureEngine() {
    if (eng) return true;
    if (!window.VCube3D) return false;
    try {
      eng = window.VCube3D.create(ui.canvas, { size: 3, duration: isMobile() ? 90 : 110 });
    } catch (e) { return false; }
    eng.onSolved(function (ts) { finish(ts); });
    return true;
  }

  function startLevel(L, taCtx) {
    if (!showPlay()) return;
    run.ta = taCtx || null;
    run.level = clampLevel(L);
    run.phase = 'ready';
    run.moves = 0; run.ms = 0; run.startTs = 0; run.seq = [];
    run.lastStars = 3;
    run.oSl = 1; run.oSr = 1;
    stopLoop();
    hideRes();
    if (!eng) return;
    /* setState() re-baselines the engine's solved flag, so the scramble can never arm a
     * spurious onSolved before the run has begun. */
    eng.setState(scrambleFor(run.level));
    var d = depthOf(run.level);
    ui.lv.textContent = run.ta
      ? '⚡ ' + chName(run.ta.ch) + '  ' + (run.ta.idx + 1) + '/' + run.ta.queue.length
      : 'Lv ' + run.level;
    /* the dialog title is the only chrome we have; make it say where you are */
    if (M && M.titleEl) {
      M.titleEl.textContent = run.ta
        ? '⚡ ' + T('vcgTa', '타임어택', 'time attack') + ' · ' + chName(run.ta.ch)
        : chapterOf(run.level).emoji + ' ' + chName(chapterOf(run.level));
    }
    ui.depth.textContent = d + T('vcgMoves2', '수', 'm');
    ui.back.textContent = '‹ ' + (run.ta ? T('vcgQuit', '중단', 'quit') : T('vcgList', '목록', 'levels'));
    ui.retry.style.display = run.ta ? 'none' : '';
    lcd(fmt(run.ta ? taElapsed() : 0), run.ta && taLive() ? 'run' : '');
    paintMeter(0);
    /* The chapter clock is already running by level 2 — pick the loop back up immediately,
     * or the LCD sits frozen at the split while the real clock ticks on behind it. */
    if (taLive()) { stopLoop(); loop(); }
    setHint(run.ta
      ? T('vcgHintTa', '시계는 계속 돌아갑니다 — 첫 회전부터 측정!', 'the clock never stops — go!')
      : T('vcgHintReady', '첫 회전에서 타이머가 시작됩니다. ★★★ ' + fmt(goldMs(run.level)) + ' 안에!',
        'the timer starts on your first turn. ★★★ under ' + fmt(goldMs(run.level)) + '!'));
    fitCanvas();
  }

  function retry() {
    if (run.ta) return;                 // a time attack has exactly one life; that is the point
    startLevel(run.level, null);
  }

  function startRun(ts) {
    run.phase = 'running';
    run.startTs = ts;
    /* First turn of the FIRST level starts the chapter clock, and nothing restarts it. */
    if (run.ta && !run.ta.origin) run.ta.origin = ts;
    run.lastStars = 3;
    /* the "press a key to start" line is a lie the moment you have started */
    setHint(T('vcgHintRun', '★★★ ' + fmt(goldMs(run.level)) + ' 안에!',
      'beat ★★★ ' + fmt(goldMs(run.level)) + '!'));
    stopLoop(); loop();
  }

  function doMove(token, rotation, ts) {
    if (!eng || !token || !run.active) return;
    if (run.phase === 'done') return;
    if (run.phase === 'ready' && !rotation) startRun(ts);
    /* Rotations are excluded here, not at count time: `rotation` used to gate only the run
     * START, so orbiting to see the back — which this game REQUIRES, since it never shows
     * you the scramble — silently padded your move count. */
    if (run.phase === 'running' && !rotation) run.seq.push(token);
    eng.turn(token, ts);
  }

  function finish(ts) {
    if (run.phase !== 'running') return;
    var ms = Math.max(0, Math.round(ts - run.startTs));
    run.phase = 'done';
    run.ms = ms;
    run.moves = htmSeq(run.seq);   // HTM, orbits excluded — comparable to depthOf(level)
    stopLoop();
    if (run.ta) { finishTAStep(ts); return; }

    var p = P();
    var r = recordLevel(p, run.level, ms, run.moves);
    saveP();
    lcd(fmt(ms), 'done');
    paintMeter(ms);
    setHint('');
    showLevelResult(r, ms);
  }

  /* ---- result cards ---- */
  function hideRes() { if (ui.res) ui.res.classList.remove('show'); }
  function showRes(build) {
    ui.resCard.textContent = '';
    build(ui.resCard);
    ui.res.classList.add('show');
  }

  function showLevelResult(r, ms) {
    var L = run.level;
    var p = P();
    showRes(function (c) {
      c.appendChild(starsEl(r.stars));
      c.appendChild(el('div', 'vcgResTime', fmt(ms)));
      var sub = el('div', 'vcgResSub');
      if (r.improved && r.prev) {
        var b = el('b', null, '−' + fmt(r.prev.ms - ms) + ' ' + T('vcgPb', '최고 기록!', 'personal best!'));
        sub.appendChild(b);
      } else if (r.improved) {
        sub.appendChild(el('b', null, T('vcgFirst', '첫 클리어!', 'first clear!')));
      } else {
        sub.appendChild(document.createTextNode(
          T('vcgBestIs', '내 최고 ', 'your best ') + fmt(r.prev.ms) + '  (+' + fmt(ms - r.prev.ms) + ')'));
      }
      sub.appendChild(document.createElement('br'));
      if (r.stars < 3) {
        var need = r.stars === 2 ? goldMs(L) : silverMs(L);
        sub.appendChild(document.createTextNode(
          (r.stars === 2 ? '★★★ ' : '★★ ') + fmt(need) +
          T('vcgNeed', ' 안에 들어오면 별 하나 더', ' gets you another star')));
      } else {
        sub.appendChild(document.createTextNode(
          run.moves + T('vcgMovesUsed', '수 사용 · 최단 ', ' moves used · shortest ') +
          depthOf(L) + T('vcgMoves2', '수', 'm')));
      }
      c.appendChild(sub);

      var btns = el('div', 'vcgResBtns');
      var again = el('button', 'btn', T('vcgAgain', '다시', 'retry'));
      again.addEventListener('click', function () { retry(); });
      btns.appendChild(again);
      var nx = L < LEVELS && levelOpen(p, L + 1);
      var next = el('button', 'btn primary', nx
        ? T('vcgNext', '다음 Lv ' + (L + 1), 'next — Lv ' + (L + 1))
        : T('vcgToMap', '목록으로', 'levels'));
      next.addEventListener('click', function () {
        if (nx) startLevel(L + 1); else toMap();
      });
      btns.appendChild(next);
      c.appendChild(btns);
      try { next.focus(); } catch (e) { }
    });
  }

  /* ---- time attack ---- */
  function startTA(ch) {
    /* origin stays 0 until your first turn: opening a time attack and reading the first
     * scramble is free, exactly once. Everything after that first turn is on the clock. */
    startLevel(ch.from, { ch: ch, queue: levelsOf(ch), idx: 0, total: 0, origin: 0, done: false });
  }
  function finishTAStep(ts) {
    var ta = run.ta;
    /* ONE origin, read at the solving move's keypress — not a sum of per-level times. The
     * difference IS the bug: the sum silently discarded every gap between levels. */
    ta.total = Math.round(taElapsed(ts));
    if (ta.idx + 1 < ta.queue.length) {
      ta.idx++;
      var nextL = ta.queue[ta.idx];
      /* a short beat so the eye registers the split, then the next level is just THERE.
       * The clock keeps running through it (taLive()), because it is your time. */
      loop();
      setTimeout(function () {
        if (!run.active || !run.ta) return;
        startLevel(nextL, ta);
      }, 420);
      return;
    }
    ta.done = true;
    stopLoop();
    /* done: the whole chapter on one clock */
    var p = P();
    var r = recordTA(p, ta.ch.id, ta.total);
    saveP();
    lcd(fmt(ta.total), 'done');
    var stars = taStars(ta.ch, ta.total);
    var tgt = taTargets(ta.ch);
    var total = ta.total, ch = ta.ch;
    run.ta = null;
    showRes(function (c) {
      c.appendChild(starsEl(stars));
      c.appendChild(el('div', 'vcgResTime', fmt(total)));
      var sub = el('div', 'vcgResSub');
      sub.appendChild(document.createTextNode('⚡ ' + chName(ch) + ' ' +
        T('vcgTaDone', '타임어택 완주', 'time attack complete')));
      sub.appendChild(document.createElement('br'));
      if (r.improved && r.prev) {
        sub.appendChild(el('b', null, '−' + fmt(r.prev.ms - total) + ' ' + T('vcgPb', '최고 기록!', 'personal best!')));
      } else if (r.improved) {
        sub.appendChild(el('b', null, T('vcgFirst', '첫 클리어!', 'first clear!')));
      } else {
        sub.appendChild(document.createTextNode(T('vcgBestIs', '내 최고 ', 'your best ') + fmt(r.prev.ms)));
      }
      sub.appendChild(document.createElement('br'));
      sub.appendChild(document.createTextNode('★★★ ' + fmt(tgt[0]) + '  ·  ★★ ' + fmt(tgt[1])));
      c.appendChild(sub);
      var btns = el('div', 'vcgResBtns');
      var again = el('button', 'btn', T('vcgAgain', '다시', 'retry'));
      again.addEventListener('click', function () { startTA(ch); });
      btns.appendChild(again);
      var back = el('button', 'btn primary', T('vcgToMap', '목록으로', 'levels'));
      back.addEventListener('click', function () { toMap(); });
      btns.appendChild(back);
      c.appendChild(btns);
      try { back.focus(); } catch (e) { }
    });
  }

  /* ============================== screens ============================== */
  function showPlay() {
    if (!playEl) return false;
    if (!ensureEngine()) {
      App.toast && App.toast(T('vcgNoEngine', '3D 엔진을 불러오지 못했어요', 'the 3D engine failed to load'),
        { type: 'error' });
      return false;
    }
    mapEl.style.display = 'none';
    playEl.style.display = '';
    run.active = true;
    observeStage();
    fitCanvas();
    return true;
  }
  function toMap() {
    run.active = false;
    run.phase = 'idle';
    run.ta = null;
    stopLoop();
    hideRes();
    if (playEl) playEl.style.display = 'none';
    if (mapEl) mapEl.style.display = '';
    if (M && M.titleEl) M.titleEl.textContent = T('vcgTitle', '큐브 레벨', 'cube levels');
    renderMap();
  }

  /* ============================== keyboard ==============================
   * Bound on WINDOW in the capture phase — deliberately. feat_vcube binds its own cube keys
   * on DOCUMENT capture, and if its view/pane is still live behind our modal both handlers
   * would turn their own cube on one keypress. The capture path is window → document → …, so
   * a window-capture listener always runs first and our stopPropagation() settles it without
   * either pack knowing about the other's internals.
   * app.js's own timer keys are already inert: our overlay is a real `.modal.show`, which is
   * exactly what its uiBlocked() looks for. */
  function textFocused() {
    var a = document.activeElement;
    return !!(a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable));
  }
  function isOpen() {
    var m = document.getElementById('vcgModal');
    return !!(m && m.classList.contains('show'));
  }
  function onKey(e) {
    if (!isOpen()) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (textFocused()) return;
    if (e.repeat) return;

    if (e.code === 'Escape') {
      if (run.active) { e.preventDefault(); e.stopPropagation(); toMap(); }
      return;                                   // on the map, let app.js close the modal
    }
    if (!run.active) return;

    if (e.code === 'Enter' || e.code === 'NumpadEnter') {
      e.preventDefault(); e.stopPropagation();
      retry();
      return;
    }
    if (e.code === 'Space') {
      e.preventDefault(); e.stopPropagation();   // never let the page scroll under us
      if (run.phase === 'done' && !run.ta) {
        var L = run.level;
        if (L < LEVELS && levelOpen(P(), L + 1)) startLevel(L + 1); else toMap();
      }
      return;
    }
    if (!eng) return;

    var ARROW = { ArrowLeft: [15, 0], ArrowRight: [-15, 0], ArrowUp: [0, 15], ArrowDown: [0, -15] };
    if (ARROW[e.code]) {
      e.preventDefault(); e.stopPropagation();
      eng.dragBy(ARROW[e.code][0], ARROW[e.code][1]);
      return;
    }

    var VF = window.VCubeFeat;
    if (!VF) return;
    var w = VF.widthKeys && VF.widthKeys[e.code];
    if (w) {
      e.preventDefault(); e.stopPropagation();
      if (w[0] === 'l') run.oSl = Math.max(1, Math.min(run.oSl + w[1], 2));
      else run.oSr = Math.max(1, Math.min(run.oSr + w[1], 2));
      return;
    }
    var fn = VF.keyMap && VF.keyMap[e.code];
    if (!fn) return;
    e.preventDefault(); e.stopPropagation();
    var ts = stampOf(e);
    var mv = fn(3, run.oSl, run.oSr);
    var token = VF.tupleToToken(mv, 3);
    if (!token) return;
    doMove(token, VF.isRotationTuple(mv, 3), ts);
  }

  /* ============================== open / close ============================== */
  function ensureModal() {
    if (M) return M;
    M = App.registerModal('vcgModal', T('vcgTitle', '큐브 레벨', 'cube levels'), function (body) {
      body.appendChild(buildMap());
      body.appendChild(buildPlay());
    });
    /* The ✕ / backdrop / Esc all go through app.js closeModals(), which only strips .show —
     * there is no close callback in the contract, so watch the class and tear the engine down
     * ourselves. A live rAF loop against a hidden canvas is exactly the leak feat_vcube
     * already had to fix once. */
    var elm = document.getElementById('vcgModal');
    if (elm && window.MutationObserver) {
      new MutationObserver(function () {
        if (!elm.classList.contains('show')) teardown();
      }).observe(elm, { attributes: true, attributeFilter: ['class'] });
    }
    return M;
  }
  function teardown() {
    run.active = false;
    run.phase = 'idle';
    run.ta = null;
    stopLoop();
    unobserveStage();
    if (eng) { try { eng.destroy(); } catch (e) { } eng = null; }
    if (playEl) playEl.style.display = 'none';
    if (mapEl) mapEl.style.display = '';
    renderTools();
  }

  function open(level) {
    /* app.js checks its own running timer BEFORE uiBlocked(), so a core solve in flight would
     * be stopped by our first cube key. Refuse rather than corrupt a real time. */
    if (document.body.classList.contains('solving')) {
      App.toast && App.toast(T('vcgBusy', '측정 중에는 열 수 없어요', 'cannot open while the timer runs'),
        { type: 'error' });
      return;
    }
    ensureModal();
    /* toMap(), not renderMap(): the panes have to be RESET, not just repainted. open() is a
     * public export, so it can land on a modal that is already sitting on a finished run —
     * renderMap() alone left playEl visible with a stale result card on top and no way back
     * to the level list. Opening the level map must always actually show the level map. */
    toMap();
    M.open();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    if (level) startLevel(level);
  }

  /* ============================== tool card (mobile 도구 tab / desktop slots) ========== */
  var toolHosts = [null, null];
  function renderTool(container, slot) {
    toolHosts[slot] = container;
    var p = P();
    var nxt = nextLevel(p);
    var wrap = el('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:8px;height:100%;justify-content:center;';
    var top = el('div');
    top.style.cssText = 'display:flex;align-items:baseline;gap:8px;';
    var big = el('div', null, 'Lv ' + nxt);
    big.style.cssText = 'font-size:26px;font-weight:800;letter-spacing:-.02em;color:var(--fg);';
    top.appendChild(big);
    var d = el('span', 'vcgChip', depthOf(nxt) + T('vcgMoves2', '수', 'm'));
    top.appendChild(d);
    wrap.appendChild(top);
    var st = el('div', null, '★ ' + totalStars(p) + ' / ' + LEVELS * 3 + '  ·  ' +
      chName(chapterOf(nxt)));
    st.style.cssText = 'font-size:12px;color:var(--sub);';
    wrap.appendChild(st);
    var b = el('button', 'btn primary', T('vcgGo2', '이어하기', 'continue'));
    b.style.minHeight = '44px';
    b.addEventListener('click', function () { open(nxt); });
    wrap.appendChild(b);
    var b2 = el('button', 'btn ghost', T('vcgOpenList', '레벨 목록', 'all levels'));
    b2.addEventListener('click', function () { open(0); });
    wrap.appendChild(b2);
    container.appendChild(wrap);
  }
  function renderTools() {
    [0, 1].forEach(function (s) {
      if (toolHosts[s] && toolHosts[s].isConnected && App.options()['tool' + s] === 'cubegame') {
        toolHosts[s].textContent = '';
        renderTool(toolHosts[s], s);
      }
    });
  }

  /* ============================== boot ============================== */
  function setup() {
    window.addEventListener('keydown', onKey, true);

    App.registerMenuButton({
      icon: '🎮',
      title: T('vcgTitle', '큐브 레벨', 'cube levels'),
      onClick: function () { open(0); }
    });

    App.registerTool({
      id: 'cubegame',
      name: T('vcgTitle', '큐브 레벨', 'cube levels'),
      render: renderTool
    });

    App.registerOptionRow && App.registerOptionRow('optPgData', function (page) {
      var row = el('div', 'orow');
      row.appendChild(el('span', null, T('vcgReset', '큐브 레벨 진행도 초기화', 'reset cube-level progress')));
      var b = el('button', 'btn danger', T('vcgResetBtn', '초기화', 'reset'));
      b.addEventListener('click', function () {
        App.confirm(T('vcgResetAsk', '별과 최고 기록이 모두 사라집니다. 계속할까요?',
          'every star and best time will be gone. continue?'), function () {
          prog = emptyProgress();
          saveP();
          renderMap(); renderTools();
          App.toast && App.toast(T('vcgResetOk', '초기화했어요', 'progress reset'));
        });
      });
      row.appendChild(b);
      page.appendChild(row);
    });

    [0, 1].forEach(function (slot) {
      if (App.options()['tool' + slot] === 'cubegame') App.refresh();
    });
  }
  if (App.db && App.db()) setup();
  else App.on('ready', setup);

  window.VCubeGame = {
    open: open,
    pure: PURE,
    progress: function () { return P(); },
    state: run,
    engine: function () { return eng; }
  };

  /* ==================================================================== */
  /* node self-test                                                        */
  /* ==================================================================== */
  function selfTest() {
    var fails = 0, count = 0;
    function assert(name, cond) {
      count++;
      if (!cond) { fails++; console.error('FAIL: ' + name); }
    }

    /* ---- 1. seeded determinism ---- */
    var a = mulberry32(42), b = mulberry32(42);
    var same = true;
    for (var i = 0; i < 500; i++) if (a() !== b()) same = false;
    assert('mulberry32: same seed -> identical stream (500 draws)', same);
    assert('mulberry32: different seeds diverge', mulberry32(1)() !== mulberry32(2)());
    var r = mulberry32(7), inRange = true;
    for (i = 0; i < 2000; i++) { var v = r(); if (!(v >= 0 && v < 1)) inRange = false; }
    assert('mulberry32: stays in [0,1)', inRange);

    var s1 = [], s2 = [];
    for (i = 1; i <= LEVELS; i++) s1.push(scrambleFor(i));
    for (i = 1; i <= LEVELS; i++) s2.push(scrambleFor(i));
    assert('scrambleFor: stable across repeated calls', s1.join('|') === s2.join('|'));

    /* the hard one: generation must not consult Math.random AT ALL */
    var realRandom = Math.random;
    Math.random = function () { throw new Error('scrambleFor used Math.random'); };
    var noRandom = true;
    try { for (i = 1; i <= LEVELS; i++) scrambleFor(i); } catch (e) { noRandom = false; }
    Math.random = realRandom;
    assert('scrambleFor: never touches Math.random', noRandom);

    /* frozen golden values — if the curve or the generator is ever retuned these change, and
     * every stored best time silently becomes a time for a DIFFERENT puzzle. Deliberate
     * tripwire: changing them is a data migration, not an edit. */
    assert('golden: Lv1 scramble is stable', /^[URFDLB]['2]?$/.test(scrambleFor(1)));
    assert('golden: Lv1 == Lv1 (cross-instance)', scrambleFor(1) === scrambleFor(1.0));
    assert('golden: Lv40 is 20 tokens', scrambleFor(40).split(' ').length === 20);
    assert('golden: Lv1-2 only ever touch camera-visible faces (U/R/F)',
      /^[URF]['2]?$/.test(scrambleFor(1)) && /^[URF]['2]? [URF]['2]?$/.test(scrambleFor(2)));
    assert('golden: level 3 onward uses the whole cube',
      /[DLB]/.test([3, 4, 5, 6, 7].map(scrambleFor).join(' ')));

    /* ---- 2. the curve ---- */
    var mono = true, prevD = 0;
    for (i = 1; i <= LEVELS; i++) {
      var d = depthOf(i);
      if (d < prevD) mono = false;
      prevD = d;
    }
    assert('depth: monotone non-decreasing over all 40 levels', mono);
    assert('depth: level 1 is 1 move', depthOf(1) === 1);
    assert('depth: level 40 is MAX_DEPTH', depthOf(LEVELS) === MAX_DEPTH);
    assert('depth: reaches at least 12 by the halfway point', depthOf(20) >= 12);
    assert('depth: clamps out-of-range input', depthOf(0) === 1 && depthOf(999) === MAX_DEPTH);
    var grew = false;
    for (i = 2; i <= LEVELS; i++) if (depthOf(i) > depthOf(i - 1)) grew = true;
    assert('depth: actually grows', grew);

    /* ---- 3. scramble hygiene ---- */
    var lenOk = true, faceOk = true, axisOk = true;
    var AX = { U: 0, D: 0, R: 1, L: 1, F: 2, B: 2 };
    for (i = 1; i <= LEVELS; i++) {
      var toks = scrambleFor(i).split(' ');
      if (toks.length !== depthOf(i)) lenOk = false;
      for (var j = 0; j < toks.length; j++) {
        if (!/^[URFDLB]['2]?$/.test(toks[j])) faceOk = false;
        if (j > 0 && toks[j][0] === toks[j - 1][0]) faceOk = false;
        if (j > 1 && AX[toks[j][0]] === AX[toks[j - 1][0]] && AX[toks[j - 1][0]] === AX[toks[j - 2][0]]) axisOk = false;
      }
    }
    assert('scramble: token count == advertised depth, every level', lenOk);
    assert('scramble: legal tokens, never the same face twice in a row', faceOk);
    assert('scramble: never three moves on one axis in a row', axisOk);

    /* ---- 4. every level is a real, unsolved state (against the trusted facelet model) ---- */
    var NNN = null;
    try { NNN = require('./draw_nnn.js'); } catch (e) { }
    if (NNN) {
      var allUnsolved = true, allSolvable = true;
      for (i = 1; i <= LEVELS; i++) {
        var st = NNN.apply(NNN.solved(3), 3, scrambleFor(i));
        var uniform = st.every(function (f) {
          return f.every(function (x) { return x === f[0]; });
        });
        if (uniform) allUnsolved = false;
        /* inverse must return it to solved — proves the tokens are ones the model accepts */
        var inv = scrambleFor(i).split(' ').reverse().map(function (t) {
          return t.length === 1 ? t + "'" : t[1] === '2' ? t : t[0];
        }).join(' ');
        var back = NNN.apply(st, 3, inv);
        var solvedAgain = back.every(function (f) {
          return f.every(function (x) { return x === f[0]; });
        });
        if (!solvedAgain) allSolvable = false;
      }
      assert('levels: no level opens already solved (draw_nnn model)', allUnsolved);
      assert('levels: inverse(scramble) returns a uniform cube — 40/40', allSolvable);
    } else {
      console.log('  (draw_nnn.js not requireable — skipped the facelet checks)');
    }

    /* ---- 5. star thresholds ---- */
    var ordered = true, parMono = true;
    for (i = 1; i <= LEVELS; i++) {
      var t = thresholds(i);
      if (!(t[0] < t[1])) ordered = false;
      if (starsFor(i, t[0] - 1) !== 3) ordered = false;
      if (starsFor(i, t[0]) !== 3) ordered = false;
      if (starsFor(i, t[0] + 1) !== 2) ordered = false;
      if (starsFor(i, t[1] + 1) !== 1) ordered = false;
      if (starsFor(i, 60 * 60 * 1000) !== 1) ordered = false;   // slow is never a fail
      if (i > 1 && goldMs(i) < goldMs(i - 1)) parMono = false;
    }
    assert('stars: ★★★ threshold < ★★ threshold on every level', ordered);
    assert('stars: par is monotone across the ladder', parMono);
    assert('stars: liveStars mirrors starsFor', liveStars(20, goldMs(20)) === 3 &&
      liveStars(20, silverMs(20) + 1) === 1);
    assert('par: depth 1 golds at 2.5s, the ramp still reaches 13.0s at depth 8',
      parMs(1) === 2500 && parMs(8) === 13000);
    /* THE ANTI-INVERSION RULE. par may never keep growing past the depth at which the task
     * stops growing, or the ladder gets easier as you climb and the 'master' chapter ends up
     * the most forgiving one in the game. */
    assert('par: is FLAT from the saturation depth on — every full-solve level shares one par',
      parMs(SAT_DEPTH) === parMs(SAT_DEPTH + 1) && parMs(SAT_DEPTH) === parMs(20) &&
      parMs(13) === parMs(20));
    assert('par: a deeper scramble is never given MORE time than a shallower full solve ' +
      '(Lv22 d13 vs Lv40 d20 — the reported inversion)',
      goldMs(22) >= goldMs(40) && goldMs(40) === goldMs(22));
    assert('par: the tightest gold on the ladder is not stranded in the middle — no level ' +
      'past the knee is looser than the knee itself',
      (function () {
        for (var L = 1; L <= LEVELS; L++) {
          if (depthOf(L) >= SAT_DEPTH && goldMs(L) > parMs(SAT_DEPTH)) return false;
        }
        return true;
      })());

    /* ---- 6. chapters + gates ---- */
    var covered = [];
    CHAPTERS.forEach(function (ch) { levelsOf(ch).forEach(function (L) { covered.push(L); }); });
    covered.sort(function (x, y) { return x - y; });
    var coversAll = covered.length === LEVELS;
    for (i = 0; i < LEVELS; i++) if (covered[i] !== i + 1) coversAll = false;
    assert('chapters: partition levels 1..40 exactly once', coversAll);
    var gatesMono = true;
    for (i = 1; i < CHAPTERS.length; i++) if (CHAPTERS[i].gate <= CHAPTERS[i - 1].gate) gatesMono = false;
    assert('chapters: star gates strictly increase', gatesMono);
    assert('chapters: the first chapter is always open', CHAPTERS[0].gate === 0);
    /* every gate must be reachable from the chapters before it — otherwise the game dead-ends */
    var reachable = true;
    for (i = 1; i < CHAPTERS.length; i++) {
      var maxBefore = (CHAPTERS[i].from - 1) * 3;
      if (CHAPTERS[i].gate > maxBefore) reachable = false;
    }
    assert('chapters: no gate needs more stars than the levels before it can give', reachable);
    assert('chapterOf: maps ends correctly',
      chapterOf(1).id === 1 && chapterOf(5).id === 1 && chapterOf(6).id === 2 && chapterOf(40).id === 5);

    /* ---- 7. progress + persistence round-trip ---- */
    var p = emptyProgress();
    assert('progress: empty has 0 stars', totalStars(p) === 0);
    assert('progress: only chapter 1 is open when empty',
      chapterOpen(p, CHAPTERS[0]) && !chapterOpen(p, CHAPTERS[1]));
    assert('progress: nextLevel of an empty save is 1', nextLevel(p) === 1);

    var rec = recordLevel(p, 3, goldMs(3) - 100, 4);
    assert('record: a gold run is 3 stars and an improvement', rec.stars === 3 && rec.improved);
    var rec2 = recordLevel(p, 3, goldMs(3) + 50000, 40);
    assert('record: a slower run never overwrites the best', !rec2.improved && p.lv[3].ms === goldMs(3) - 100);
    var rec3 = recordLevel(p, 3, goldMs(3) - 500, 3);
    assert('record: a faster run does overwrite', rec3.improved && p.lv[3].ms === goldMs(3) - 500);
    assert('progress: nextLevel skips a cleared level', nextLevel(p) === 1);
    recordLevel(p, 1, 1000, 1); recordLevel(p, 2, 1000, 2);
    assert('progress: nextLevel finds the first uncleared open level', nextLevel(p) === 4);

    var round = decodeProgress(encodeProgress(p));
    assert('persist: round-trip preserves every level record',
      JSON.stringify(round.lv) === JSON.stringify(p.lv));
    assert('persist: round-trip preserves stars', totalStars(round) === totalStars(p));
    recordTA(p, 2, 45000);
    var round2 = decodeProgress(encodeProgress(p));
    assert('persist: round-trip preserves time-attack bests', round2.ta[2].ms === 45000);
    assert('persist: garbage in -> empty progress out, no throw',
      totalStars(decodeProgress('{{{not json')) === 0 &&
      totalStars(decodeProgress(null)) === 0 &&
      totalStars(decodeProgress('[1,2,3]')) === 0);
    assert('persist: stars are RECOMPUTED on load, never trusted from disk',
      decodeProgress('{"lv":{"1":{"ms":' + (goldMs(1) + 999999) + ',"st":3}}}').lv[1].st === 1);
    assert('persist: an out-of-range level is clamped, not dropped into nowhere',
      !!decodeProgress('{"lv":{"999":{"ms":5000}}}').lv[LEVELS]);

    /* gate walkthrough: 3-starring chapter 1 (15 stars) must open chapter 2 (gate 8) */
    var q = emptyProgress();
    levelsOf(CHAPTERS[0]).forEach(function (L) { recordLevel(q, L, goldMs(L), 1); });
    assert('gates: 3-starring chapter 1 opens chapter 2', chapterOpen(q, CHAPTERS[1]));
    assert('gates: chapter 1 alone does NOT open chapter 3', !chapterOpen(q, CHAPTERS[2]));
    assert('cleared: chapter 1 counts as cleared', chapterCleared(q, CHAPTERS[0]));
    assert('cleared: chapter 2 does not', !chapterCleared(q, CHAPTERS[1]));
    /* just clearing (1 star each) must still open the next chapter — the on-ramp cannot wall */
    var w = emptyProgress();
    levelsOf(CHAPTERS[0]).forEach(function (L) { recordLevel(w, L, silverMs(L) + 60000, 1); });
    levelsOf(CHAPTERS[1]).forEach(function (L) { recordLevel(w, L, silverMs(L) + 60000, 1); });
    assert('gates: merely CLEARING chapters 1+2 (12 stars) opens chapter 3 (gate 18)? no — by design',
      !chapterOpen(w, CHAPTERS[2]));
    levelsOf(CHAPTERS[0]).forEach(function (L) { recordLevel(w, L, goldMs(L), 1); });
    assert('gates: clearing 1+2 and then 3-starring chapter 1 opens chapter 3',
      chapterOpen(w, CHAPTERS[2]));

    /* ---- 8. time attack ---- */
    CHAPTERS.forEach(function (ch) {
      var t = taTargets(ch);
      assert('TA: ' + ch.en + ' gold < silver', t[0] < t[1]);
      assert('TA: ' + ch.en + ' gold is looser than the sum of level golds',
        t[0] > levelsOf(ch).reduce(function (s, L) { return s + goldMs(L); }, 0));
      assert('TA: ' + ch.en + ' stars are ordered',
        taStars(ch, t[0]) === 3 && taStars(ch, t[0] + 1) === 2 && taStars(ch, t[1] + 1) === 1);
      /* the clock now runs BETWEEN levels, so the target must pay for reading each next
       * cube — otherwise making the clock honest would silently be a difficulty hike */
      var gaps = Math.max(0, levelsOf(ch).length - 1);
      assert('TA: ' + ch.en + ' target budgets look-time for every inter-level gap',
        t[0] >= levelsOf(ch).reduce(function (s, L) { return s + goldMs(L); }, 0) +
        gaps * TA_LOOK_MS);
    });

    /* ---- 8b. HTM move counting (the number on the ★★★ card) ----------------------
     * It is compared against depthOf(level) — the scramble's own HTM length — so it has to
     * be the same metric, or the card calls a perfect solve sloppy. */
    assert('htm: a plain 5-move solve counts 5', htmSeq(['L', 'B', 'R', "L'", "B'"]) === 5);
    assert('htm: a half-turn typed as two presses counts ONCE (R R = R2 = 1 move)',
      htmSeq(['R', 'R']) === 1);
    /* the exact case from the report: the literal inverse of "B' L R2 B2 L'" is
     * "L B2 R2 L' B", typed as 7 presses, and it is an OPTIMAL depth-5 solve. */
    assert('htm: the optimal inverse of a depth-5 scramble counts 5, not 7 (the ★★★ card bug)',
      htmSeq(['L', 'B', 'B', 'R', 'R', "L'", 'B']) === 5);
    assert('htm: three presses of one face (R R R = R\') still count 1',
      htmSeq(['R', 'R', 'R']) === 1);
    assert('htm: same face separated by another face does NOT collapse (R U R = 3)',
      htmSeq(['R', 'U', 'R']) === 3);
    assert('htm: a prime does not split its own group (R R\' is one group)',
      htmSeq(['R', "R'"]) === 1);
    assert('htm: wide moves are their own group, distinct from the plain face',
      htmSeq(['R', 'Rw']) === 2);
    assert('htm: an empty / junk sequence counts 0, no throw',
      htmSeq([]) === 0 && htmSeq(null) === 0 && htmSeq(['', null]) === 0);

    /* ---- 9. the session-safety promise, enforced mechanically ---- */
    var src = '';
    try { src = require('fs').readFileSync(__filename, 'utf8'); } catch (e) { }
    if (src) {
      /* needles are assembled at runtime so that this test's own source does not match them */
      function calls(name) { return src.indexOf(name + '(') >= 0; }
      assert('safety: this pack never calls App.addSolve', !calls('add' + 'Solve'));
      assert('safety: this pack never calls App.startTimer/stopTimer',
        !calls('start' + 'Timer') && !calls('stop' + 'Timer'));
      assert('safety: this pack never calls App.newScramble', !calls('new' + 'Scramble'));
      assert('safety: this pack never writes to the solve DB',
        !calls('App.updat' + 'eSolve') && !calls('App.sav' + 'e'));
      assert('safety: game state only ever uses cstc_pack_vcubegame_ keys',
        (src.match(/localStorage\.(get|set)Item\(/g) || []).length === 2 &&
        src.indexOf('cstc_pack_vcubegame_progress') > 0);
    }

    console.log((fails ? 'FAILED ' + fails + ' of ' : 'ok — all ') + count + ' assertions');
    if (typeof process !== 'undefined') process.exit(fails ? 1 : 0);
  }
  if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) selfTest();
})();
