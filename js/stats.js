/* stats.js — solve records & statistics (original code)
 * Solve record: [[penalty, ms], scramble, comment, timestampSec]
 *   penalty: 0 = OK, 2000 = +2 (already in ms), -1 = DNF
 * Effective time = ms + (penalty > 0 ? penalty : 0); DNF when penalty === -1.
 * (This record shape is compatible with csTimer JSON exports.)
 */
(function (g) {
  'use strict';

  var DNF = -1;

  function isDNF(solve) { return solve[0][0] === DNF; }
  function timeOf(solve) { // effective ms, or Infinity for DNF
    if (isDNF(solve)) return Infinity;
    return solve[0][1] + (solve[0][0] > 0 ? solve[0][0] : 0);
  }

  function pad2(x) { return (x < 10 ? '0' : '') + x; }

  function timeToString(ms, decimals) {
    if (ms === Infinity || ms === DNF || ms == null || isNaN(ms)) return 'DNF';
    decimals = decimals == null ? 2 : decimals;
    var neg = ms < 0; if (neg) ms = -ms;
    var base = Math.pow(10, 3 - decimals);
    var v = Math.floor(ms / base);
    var frac = v % Math.pow(10, decimals);
    var secTotal = Math.floor(v / Math.pow(10, decimals));
    var s = secTotal % 60, m = Math.floor(secTotal / 60) % 60, h = Math.floor(secTotal / 3600);
    var fracStr = String(frac);
    while (fracStr.length < decimals) fracStr = '0' + fracStr;
    var out;
    if (h > 0) out = h + ':' + pad2(m) + ':' + pad2(s);
    else if (m > 0) out = m + ':' + pad2(s);
    else out = String(s);
    // decimals <= 0: no fractional part at all (never emit a bare trailing '.')
    if (decimals <= 0) return (neg ? '-' : '') + out;
    return (neg ? '-' : '') + out + '.' + fracStr;
  }

  function solveToString(solve, decimals) {
    if (isDNF(solve)) return 'DNF(' + timeToString(solve[0][1], decimals) + ')';
    var s = timeToString(timeOf(solve), decimals);
    if (solve[0][0] > 0) s += '+';
    return s;
  }

  /* parse "12.34", "1:02.5", "12.34+", "1234", "DNF(12.34)", "DNF" -> [pen, ms] or null
   *
   * ONE coherent rule for both input forms:
   *
   * 1. BARE DIGITS (no '.' or ':') are ALWAYS read as csTimer-style keypad
   *    packing: the last 2 digits are centiseconds, the 2 before that are
   *    seconds, anything left is minutes. Short input is zero-padded, so the
   *    ladder is monotonic across every length:
   *      '5' -> 0.05, '99' -> 0.99, '100' -> 1.00, '1234' -> 12.34,
   *      '12345' -> 1:23.45.
   *    (There is NO length threshold; '99' must not jump to 1:39.00 while
   *    '100' means 1.00.)
   *
   * 2. A trailing '+' means the TYPED VALUE IS THE FINAL TIME, penalty
   *    included. The stored raw ms is therefore typed - 2000 (clamped: if the
   *    typed value is under 2s we keep it raw rather than go negative).
   *    This is applied identically to both forms, so '1234+' and '12.34+'
   *    both store [2000, 10340] -> effective 12.34.
   *
   * Returns [penalty, rawMs] (penalty: 0 | 2000 | DNF) or null when unparsable.
   */
  function withPlus2(ms) { return [2000, ms - 2000 >= 0 ? ms - 2000 : ms]; }

  function parseTime(str) {
    if (!str) return null;
    str = String(str).trim();
    var pen = 0;
    var mDnf = /^DNF\((.+)\)$/i.exec(str);
    if (/^DNF$/i.test(str)) return [DNF, 0];
    if (mDnf) { pen = DNF; str = mDnf[1]; }
    if (/\+$/.test(str)) { if (pen === 0) pen = 2000; str = str.replace(/\+$/, ''); }
    // rule 1: bare digits like "1234" => 12.34 (csTimer-style typing), any length
    if (/^\d+$/.test(str)) {
      var d = str;
      while (d.length < 3) d = '0' + d;
      var cs = parseInt(d.slice(-2), 10);
      var rest = d.slice(0, -2);
      var sec = parseInt(rest.slice(-2), 10) || 0;
      var min = parseInt(rest.slice(0, -2), 10) || 0;
      var ms0 = ((min * 60 + sec) * 100 + cs) * 10;
      if (pen === 2000) return withPlus2(ms0); // rule 2: typed value includes +2
      return [pen === DNF ? DNF : 0, ms0];
    }
    var m = /^(?:(\d+):)?(?:(\d+):)?(\d+)(?:\.(\d{1,3}))?$/.exec(str);
    if (!m) return null;
    var h = 0, mi = 0;
    if (m[1] != null && m[2] != null) { h = parseInt(m[1], 10); mi = parseInt(m[2], 10); }
    else if (m[1] != null) { mi = parseInt(m[1], 10); }
    var se = parseInt(m[3], 10);
    var frac = m[4] ? parseInt((m[4] + '000').slice(0, 3), 10) : 0;
    var ms = ((h * 60 + mi) * 60 + se) * 1000 + frac;
    if (pen === 2000) return withPlus2(ms); // rule 2: typed value includes +2
    return [pen === DNF ? DNF : 0, ms];
  }

  /* trimmed average of the last n solves ending at index end (inclusive).
   * trim = ceil(n/20) from each side (ao5/ao12 trim 1, ao100 trims 5).
   * DNFs count as worst; if more than `trim` DNFs -> DNF (Infinity).
   * Requires n >= 3: for n <= 2 every solve would be trimmed away, so this
   * returns null (NEVER NaN, which would render as a bogus 'DNF'). */
  function averageOf(solves, end, n) {
    if (n < 1 || end + 1 < n) return null;
    var arr = [];
    for (var i = end - n + 1; i <= end; i++) arr.push(timeOf(solves[i]));
    return trimmedMean(arr, Math.ceil(n / 20));
  }

  function trimmedMean(arr, trim) {
    var sorted = arr.slice().sort(function (a, b) { return a - b; });
    var lo = trim, hi = sorted.length - trim;
    if (hi <= lo) return null; // nothing survives the trim -> null, not NaN/-0
    var sum = 0;
    for (var i = lo; i < hi; i++) {
      if (sorted[i] === Infinity) return Infinity;
      sum += sorted[i];
    }
    return sum / (hi - lo);
  }

  function bestAverage(solves, n) { // {value, end} or null
    if (solves.length < n) return null;
    var best = null, bestEnd = -1;
    for (var end = n - 1; end < solves.length; end++) {
      var a = averageOf(solves, end, n);
      if (a != null && (best == null || a < best)) { best = a; bestEnd = end; }
    }
    return best == null ? null : { value: best, end: bestEnd };
  }

  function meanOf(solves, end, n) { // plain mean of n, DNF -> Infinity
    if (end + 1 < n) return null;
    var sum = 0;
    for (var i = end - n + 1; i <= end; i++) {
      var t = timeOf(solves[i]);
      if (t === Infinity) return Infinity;
      sum += t;
    }
    return sum / n;
  }

  function sessionSummary(solves) {
    var times = [], dnf = 0;
    for (var i = 0; i < solves.length; i++) {
      var t = timeOf(solves[i]);
      if (t === Infinity) dnf++; else times.push(t);
    }
    var sum = times.reduce(function (a, b) { return a + b; }, 0);
    var mean = times.length ? sum / times.length : null;
    var sd = null;
    if (times.length > 1) {
      var v = 0;
      for (i = 0; i < times.length; i++) v += (times[i] - mean) * (times[i] - mean);
      sd = Math.sqrt(v / (times.length - 1));
    }
    var all = solves.map(function (s) { return timeOf(s); });
    var avg = solves.length >= 3 ? trimmedMean(all, Math.ceil(solves.length / 20)) : null;
    return {
      count: solves.length,
      valid: times.length,
      dnf: dnf,
      best: times.length ? Math.min.apply(null, times) : null,
      worst: times.length ? Math.max.apply(null, times) : null,
      mean: mean,
      avg: avg,
      total: sum,
      sd: sd
    };
  }

  var api = {
    DNF: DNF,
    isDNF: isDNF,
    timeOf: timeOf,
    timeToString: timeToString,
    solveToString: solveToString,
    parseTime: parseTime,
    averageOf: averageOf,
    bestAverage: bestAverage,
    meanOf: meanOf,
    sessionSummary: sessionSummary
  };

  g.Stats = api;
  if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') module.exports = api;

  /* ---------------- node self-test ---------------- */
  if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
    var fails = 0;
    function assert(name, cond) { console.log((cond ? 'PASS' : 'FAIL') + ' - ' + name); if (!cond) fails++; }
    function S(pen, ms) { return [[pen, ms], '', '', 0]; }

    assert('fmt 12.345 -> 12.34', timeToString(12345) === '12.34');
    assert('fmt 3 decimals', timeToString(12345, 3) === '12.345');
    assert('fmt 1:02.34', timeToString(62340) === '1:02.34');
    assert('fmt 1:00:01', timeToString(3601000) === '1:00:01.00');
    assert('parse 12.34', JSON.stringify(parseTime('12.34')) === '[0,12340]');
    assert('parse 1:02.5', JSON.stringify(parseTime('1:02.5')) === '[0,62500]');
    assert('parse DNF(10.00)', JSON.stringify(parseTime('DNF(10.00)')) === '[-1,10000]');
    assert('parse bare 1234 -> 12.34', JSON.stringify(parseTime('1234')) === '[0,12340]');
    assert('parse 12.34+ (typed final includes +2)', JSON.stringify(parseTime('12.34+')) === '[2000,10340]');

    // rank 50: decimals=0 must not emit a bogus '.0'
    assert('fmt 0 decimals', timeToString(60000, 0) === '1:00' && timeToString(12345, 0) === '12');
    assert('fmt 0 decimals hours', timeToString(3601000, 0) === '1:00:01');

    // rank 14: bare-digit ladder is monotonic (no 2->3 digit inversion)
    assert('parse bare 99 -> 0.99', JSON.stringify(parseTime('99')) === '[0,990]');
    assert('parse bare 5 -> 0.05', JSON.stringify(parseTime('5')) === '[0,50]');
    assert('parse bare 100 -> 1.00', JSON.stringify(parseTime('100')) === '[0,1000]');
    assert('parse bare 12345 -> 1:23.45', JSON.stringify(parseTime('12345')) === '[0,83450]');
    assert('parse bare 99 < parse bare 100', parseTime('99')[1] < parseTime('100')[1]);
    // Monotonic across the whole sec.cs region (0..9999 = up to 99.99s). Beyond
    // that, keypad packing rolls over into minutes ('9999' -> 1:39.99 but
    // '10000' -> 1:00.00), which is inherent to the notation, not a bug.
    (function () {
      var mono = true, prev = -1, at = '';
      for (var k = 0; k <= 9999; k++) {
        var v = parseTime(String(k))[1];
        if (v < prev) { mono = false; at = String(k); break; }
        prev = v;
      }
      assert('parse bare-digit ladder monotonic 0..9999' + (at ? ' (broke at ' + at + ')' : ''), mono);
    })();

    // rank 15: +2 applies identically to bare-digit and decimal forms
    assert('parse 1234+ == 12.34+',
      JSON.stringify(parseTime('1234+')) === '[2000,10340]' &&
      JSON.stringify(parseTime('1234+')) === JSON.stringify(parseTime('12.34+')));
    assert('parse +2 under 2s keeps raw',
      JSON.stringify(parseTime('150+')) === '[2000,1500]' &&
      JSON.stringify(parseTime('1.50+')) === '[2000,1500]');

    // rank 24: no NaN/-0 from over-trimmed windows (would render as fake DNF/PB)
    var two = [S(0, 10000), S(0, 12000)];
    assert('ao2 -> null (not NaN/DNF)', averageOf(two, 1, 2) === null);
    assert('ao1 -> null (not -0)', averageOf(two, 0, 1) === null);
    assert('ao0 -> null', averageOf(two, 1, 0) === null);
    assert('bestAverage n=2 -> null', bestAverage(two, 2) === null);
    assert('ao3 still works', averageOf([S(0,10000),S(0,12000),S(0,11000)], 2, 3) === 11000);

    var solves = [S(0, 10000), S(0, 12000), S(0, 11000), S(0, 20000), S(0, 13000)];
    assert('ao5 trims best/worst', averageOf(solves, 4, 5) === 12000);
    solves[3] = S(DNF, 20000);
    assert('ao5 one DNF ok', averageOf(solves, 4, 5) === 12000);
    solves[1] = S(DNF, 12000);
    assert('ao5 two DNF = DNF', averageOf(solves, 4, 5) === Infinity);
    solves[1] = S(2000, 10000); // +2 => 12000 effective
    assert('+2 counted', averageOf(solves, 4, 5) === 12000);
    var sum = sessionSummary(solves);
    assert('summary count/dnf', sum.count === 5 && sum.dnf === 1);
    assert('summary best', sum.best === 10000);
    var ba = bestAverage([S(0,9000),S(0,9000),S(0,9000),S(0,9000),S(0,9000),S(0,30000),S(0,1000),S(0,1000),S(0,1000),S(0,1000)].map(function(x){return x;}), 5);
    assert('bestAverage finds tail window', ba.value === 1000 && ba.end === 9);
    process.exit(fails ? 1 : 0);
  }
})(typeof window !== 'undefined' ? window : globalThis);
