/* feat_stats.js — [stats] feature pack for csTimer-clone (UPGRADES items 35–48).
 * Self-contained IIFE. Integrates ONLY through window.App (see API.md).
 * Tools: dist2, trend2, daily, stats2, pbhist, sesscmp + 100-solve milestone toasts.
 * Re-render: core renderTools() runs on every renderStats()/renderScramble()
 * (i.e. solvesChanged / scramble / options / session switch / resize), so each
 * tool's render() is a pure rebuild and needs no extra subscriptions. */
(function () {
  'use strict';
  if (!window.App) return;
  var App = window.App;
  var Stats = window.Stats;
  if (!Stats) return;

  /* ================= helpers ================= */
  function i18n(k, ko, en) { return App.i18n(k, ko, en); }
  function P() { return App.options().precision; }
  function fmt(v) { return v == null ? '-' : Stats.timeToString(v, P()); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function dstr(sec) {
    var d = new Date(sec * 1000);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function dayKey(d) { return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }
  function cssv(name, fb) {
    var v = getComputedStyle(document.body).getPropertyValue(name).trim();
    return v || fb;
  }
  function fontFam() { return getComputedStyle(document.body).fontFamily; }
  function oneLine(s) { return String(s == null ? '' : s).replace(/\s*\n\s*/g, ' '); }
  function zeros(n) { var a = []; for (var i = 0; i < n; i++) a.push(0); return a; }
  function span(cls, txt) {
    var el = document.createElement('span');
    el.className = cls; el.textContent = txt;
    return el;
  }
  function sep() { var d = document.createElement('div'); d.className = 'fs2-sep'; return d; }
  function emptyMsg(body, txt) {
    var d = document.createElement('div');
    d.className = 'fs2-empty';
    d.textContent = txt || i18n('noSolves', '(기록 없음)', '(no solves)');
    body.appendChild(d);
  }
  function line(label, value, rng) {
    var d = document.createElement('div');
    d.className = 'fs2-line';
    var l = span('l', label);
    var v = span('v', value);
    if (rng) v.appendChild(span('rng', rng));
    d.appendChild(l); d.appendChild(v);
    return d;
  }
  function sdOf(times) { // sample standard deviation (matches core: n-1)
    if (times.length < 2) return null;
    var m = 0, i;
    for (i = 0; i < times.length; i++) m += times[i];
    m /= times.length;
    var v = 0;
    for (i = 0; i < times.length; i++) v += (times[i] - m) * (times[i] - m);
    return Math.sqrt(v / (times.length - 1));
  }
  // σ of the aoN window, trimmed exactly like averageOf so it describes the ao
  // value it sits beside (untrimmed σ is dominated by the very solve the average
  // deliberately discards). Returns null whenever the matching aoN would be DNF.
  function windowSigma(n) {
    var solves = App.solves();
    if (solves.length < n) return null;
    var trim = Math.ceil(n / 20);
    var ts = [], dnf = 0;
    for (var i = solves.length - n; i < solves.length; i++) {
      var t = Stats.timeOf(solves[i]);
      if (t === Infinity) dnf++; else ts.push(t);
    }
    // averageOf drops `trim` from each end; more DNFs than the top trim can absorb
    // means the average itself is DNF, so the σ beside it must be blank too
    if (dnf > trim) return null;
    ts.sort(function (a, b) { return a - b; });
    // DNFs already occupy `dnf` of the top trim slots; drop the rest from the fast end
    ts = ts.slice(trim, ts.length - (trim - dnf));
    if (ts.length < 2) return null;
    return sdOf(ts);
  }

  /* HiDPI canvas sized to the tool body */
  function mkCanvas(body) {
    var w = body.clientWidth || 292, h = body.clientHeight || 200;
    var dpr = window.devicePixelRatio || 1;
    var c = document.createElement('canvas');
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    c.style.width = w + 'px'; c.style.height = h + 'px';
    var ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    body.appendChild(c);
    return { el: c, ctx: ctx, w: w, h: h };
  }
  function rrect(ctx, x, y, w, h, r) { // rounded bar (2px Toss corners)
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else {
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }
    ctx.fill();
  }

  /* item 40 — nice Y ticks (3–4 labels) */
  function niceTicks(min, max) {
    var range = Math.max(1, max - min);
    var target = range / 3;
    var pow = Math.pow(10, Math.floor(Math.log(target) / Math.LN10));
    var mults = [1, 2, 2.5, 5, 10];
    var step = pow * 10;
    for (var k = 0; k < mults.length; k++) {
      if (range / (mults[k] * pow) <= 3.8) { step = mults[k] * pow; break; }
    }
    var arr = [], v;
    for (v = Math.ceil(min / step) * step; v <= max + 1e-6 && arr.length < 6; v += step) arr.push(v);
    if (arr.length < 3) {
      step = step / 2; arr = [];
      for (v = Math.ceil(min / step) * step; v <= max + 1e-6 && arr.length < 6; v += step) arr.push(v);
    }
    return { arr: arr.slice(0, 4), step: step };
  }
  function tickLabel(v, step) {
    if (v >= 60000) {
      var s = Stats.timeToString(v, 0);
      return s.slice(-1) === '.' ? s.slice(0, -1) : s;
    }
    var sec = v / 1000;
    if (step >= 1000) return String(Math.round(sec));
    if (step >= 100) return sec.toFixed(1);
    return sec.toFixed(2);
  }

  /* ================= text exports (items 41 / 42 / 48) ================= */
  function exportText() { // csTimer-style full export
    var solves = App.solves(), p = P();
    var sum = Stats.sessionSummary(solves);
    var out = [];
    out.push('Generated by csTimer-clone on ' + dstr(Math.floor(Date.now() / 1000)));
    out.push('solves/total: ' + sum.valid + '/' + sum.count);
    out.push('');
    out.push('single');
    out.push('    best: ' + fmt(sum.best));
    out.push('    worst: ' + fmt(sum.worst));
    out.push('    mean: ' + fmt(sum.mean) + (sum.sd != null ? ' (σ = ' + fmt(sum.sd) + ')' : ''));
    out.push('    avg: ' + fmt(sum.avg));
    [5, 12, 50, 100].forEach(function (n) {
      var ba = Stats.bestAverage(solves, n);
      if (ba) out.push('best ao' + n + ': ' + fmt(ba.value) + ' (#' + (ba.end - n + 2) + '-#' + (ba.end + 1) + ')');
    });
    out.push('');
    out.push('Time List:');
    solves.forEach(function (sv, i) {
      out.push((i + 1) + '. ' + Stats.solveToString(sv, p) + '   ' + oneLine(sv[1]));
    });
    return out.join('\n');
  }
  function last12Text() { // item 42
    var solves = App.solves(), p = P();
    var n = Math.min(12, solves.length);
    var start = solves.length - n;
    var out = [i18n('lastN', '최근 ' + n + '개 / 전체 ' + solves.length, 'last ' + n + ' of ' + solves.length)];
    for (var i = start; i < solves.length; i++) {
      out.push((i + 1) + '. ' + Stats.solveToString(solves[i], p) + '   ' + oneLine(solves[i][1]));
    }
    return out.join('\n');
  }
  function windowText(n, ba) { // item 48 — best aoN window with scrambles, trims in ()
    var solves = App.solves(), p = P();
    var start = ba.end - n + 1;
    var win = solves.slice(start, ba.end + 1);
    var times = win.map(function (sv) { return Stats.timeOf(sv); });
    var trim = Math.ceil(n / 20);
    var sorted = times.slice().sort(function (a, b) { return a - b; });
    var lo = sorted.slice(0, trim), hi = sorted.slice(sorted.length - trim);
    var lines = win.map(function (sv, k) {
      var t = Stats.timeOf(sv);
      var str = Stats.solveToString(sv, p);
      var j = lo.indexOf(t);
      if (j >= 0) { lo.splice(j, 1); str = '(' + str + ')'; }
      else { j = hi.indexOf(t); if (j >= 0) { hi.splice(j, 1); str = '(' + str + ')'; } }
      return (start + 1 + k) + '. ' + str + '   ' + oneLine(sv[1]);
    });
    return 'best ao' + n + ': ' + fmt(ba.value) + ' (#' + (start + 1) + '-#' + (ba.end + 1) + ')\n' + lines.join('\n');
  }

  /* ================= tool: stats2 (items 35/39/41/42/45/46/48) ================= */
  function renderStats2(body) {
    var solves = App.solves();
    if (!solves.length) { emptyMsg(body); return; }
    var sum = Stats.sessionSummary(solves);
    var wrap = document.createElement('div');
    wrap.className = 'fs2-stats';

    // item 35 — session date range (option-free small line)
    var stamped = solves.filter(function (sv) { return sv[3] > 0; });
    var range = document.createElement('div');
    range.className = 'fs2-range';
    if (stamped.length) {
      var a = dstr(stamped[0][3]), b = dstr(stamped[stamped.length - 1][3]);
      range.textContent = a === b ? a : a + ' ~ ' + b;
    } else range.textContent = i18n('noDates', '(날짜 정보 없음)', '(no dates)');
    wrap.appendChild(range);

    // item 45 — DNF rate
    var pct = sum.count ? Math.round(sum.dnf / sum.count * 1000) / 10 : 0;
    wrap.appendChild(line(i18n('solves', '솔브', 'solves'), sum.valid + '/' + sum.count));
    wrap.appendChild(line('DNF', sum.dnf + ' (' + pct + '%)'));
    wrap.appendChild(line('best · worst', fmt(sum.best) + ' · ' + fmt(sum.worst)));
    wrap.appendChild(line('avg · mean', fmt(sum.avg) + ' · ' + fmt(sum.mean)));
    // item 39 — σ (session + per-window)
    wrap.appendChild(line('σ', fmt(sum.sd)));
    var s5 = windowSigma(5), s12 = windowSigma(12);
    if (s5 != null || s12 != null) {
      wrap.appendChild(line('σ5 · σ12',
        (s5 == null ? '-' : fmt(s5)) + ' · ' + (s12 == null ? '-' : fmt(s12))));
    }

    // items 41 + 48 — best aoN with # ranges; click copies that window
    var anyAo = false;
    [5, 12, 50, 100].forEach(function (n) {
      var ba = Stats.bestAverage(solves, n);
      if (!ba) return;
      if (!anyAo) { wrap.appendChild(sep()); anyAo = true; }
      var row = line('best ao' + n, fmt(ba.value), '#' + (ba.end - n + 2) + '–#' + (ba.end + 1));
      row.classList.add('fs2-ao');
      row.title = i18n('copyWin', '클릭하면 이 구간의 기록·스크램블을 복사해요', 'click to copy this window (times + scrambles)');
      row.addEventListener('click', function () {
        App.copyText(windowText(n, ba));
        App.toast(i18n('copied', '복사됨', 'copied'), { type: 'success' });
      });
      wrap.appendChild(row);
    });

    // item 46 — total solving time + solves today
    wrap.appendChild(sep());
    var today = 0, tk = dayKey(new Date());
    solves.forEach(function (sv) {
      if (sv[3] > 0 && dayKey(new Date(sv[3] * 1000)) === tk) today++;
    });
    wrap.appendChild(line(i18n('totalTime', '누적 솔빙', 'total time'),
      sum.total ? Stats.timeToString(sum.total, 1) : '-'));
    wrap.appendChild(line(i18n('today', '오늘 솔브', 'solves today'), String(today)));

    // items 41 + 42 — copy buttons
    var btns = document.createElement('div');
    btns.className = 'fs2-btns';
    var b1 = document.createElement('button');
    b1.className = 'primary fs2-copyall';
    b1.textContent = i18n('copyStats', '복사', 'copy');
    b1.addEventListener('click', function () {
      App.copyText(exportText());
      App.toast(i18n('copied', '복사됨', 'copied'), { type: 'success' });
    });
    var b2 = document.createElement('button');
    b2.className = 'fs2-copy12';
    b2.textContent = i18n('copy12', '최근 12개 복사', 'copy last 12');
    b2.addEventListener('click', function () {
      App.copyText(last12Text());
      App.toast(i18n('copied', '복사됨', 'copied'), { type: 'success' });
    });
    btns.appendChild(b1); btns.appendChild(b2);
    wrap.appendChild(btns);
    body.appendChild(wrap);
  }

  /* ================= tool: dist2 (item 36) ================= */
  function renderDist2(body) {
    var solves = App.solves();
    var secs = [];
    solves.forEach(function (sv) {
      var t = Stats.timeOf(sv);
      if (t !== Infinity) secs.push(Math.floor(t / 1000));
    });
    if (!secs.length) { emptyMsg(body); return; }
    var kmin = Math.min.apply(null, secs), kmax = Math.max.apply(null, secs);
    var g = Math.max(1, Math.ceil((kmax - kmin + 1) / 18)); // group when range is wide
    var nb = Math.ceil((kmax - kmin + 1) / g);
    var counts = zeros(nb);
    secs.forEach(function (k) { counts[Math.floor((k - kmin) / g)]++; });
    var maxC = 1, i;
    for (i = 0; i < nb; i++) if (counts[i] > maxC) maxC = counts[i];

    var cv = mkCanvas(body), ctx = cv.ctx, W = cv.w, H = cv.h;
    var padL = 22, padR = 8, padT = 16, padB = 18;
    var plotW = W - padL - padR, plotH = H - padT - padB;
    var accent = cssv('--accent', '#4b7bec');
    var sub = cssv('--sub', '#8b95a1');
    var lineC = cssv('--line', 'rgba(128,128,128,.25)');

    // baseline + count axis labels (subtle ticks only)
    ctx.strokeStyle = lineC; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, H - padB + 0.5); ctx.lineTo(W - padR, H - padB + 0.5);
    ctx.moveTo(padL - 3, padT + 0.5); ctx.lineTo(padL, padT + 0.5);
    ctx.stroke();
    ctx.fillStyle = sub; ctx.font = '9px ' + fontFam(); ctx.textAlign = 'right';
    ctx.fillText(String(maxC), padL - 5, padT + 3);
    ctx.fillText('0', padL - 5, H - padB + 3);

    var step = plotW / nb;
    var barW = Math.max(3, Math.min(step * 0.62, 26));
    ctx.fillStyle = accent;
    for (i = 0; i < nb; i++) {
      if (!counts[i]) continue;
      var h = Math.max(2, counts[i] / maxC * plotH);
      rrect(ctx, padL + i * step + (step - barW) / 2, H - padB - h, barW, h, 2);
    }
    // counts above bars when readable
    if (nb <= 14) {
      ctx.fillStyle = sub; ctx.textAlign = 'center';
      for (i = 0; i < nb; i++) {
        if (!counts[i]) continue;
        var hh = Math.max(2, counts[i] / maxC * plotH);
        ctx.fillText(String(counts[i]), padL + i * step + step / 2, H - padB - hh - 4);
      }
    }
    // x axis labels (bucket seconds)
    var every = Math.max(1, Math.ceil(nb / 6));
    ctx.fillStyle = sub; ctx.textAlign = 'center';
    for (i = 0; i < nb; i += every) {
      ctx.fillText((kmin + i * g) + 's', padL + i * step + step / 2, H - 6);
    }
  }

  /* ================= tool: trend2 (items 37 + 40) ================= */
  function renderTrend2(body) {
    var solves = App.solves();
    var n = solves.length, i;
    var singles = [];
    for (i = 0; i < n; i++) {
      var t = Stats.timeOf(solves[i]);
      singles.push(t === Infinity ? null : t);
    }
    var finite = 0;
    for (i = 0; i < n; i++) if (singles[i] != null) finite++;
    if (finite < 2) { emptyMsg(body, i18n('need2', '기록 2개 이상 필요', 'need 2+ solves')); return; }

    var ao5 = [], ao12 = [];
    for (i = 0; i < n; i++) {
      var a5 = Stats.averageOf(solves, i, 5);
      var a12 = Stats.averageOf(solves, i, 12);
      ao5.push(a5 == null || a5 === Infinity ? null : a5);
      ao12.push(a12 == null || a12 === Infinity ? null : a12);
    }
    var minV = Infinity, maxV = -Infinity;
    [singles, ao5, ao12].forEach(function (arr) {
      arr.forEach(function (v) {
        if (v == null) return;
        if (v < minV) minV = v;
        if (v > maxV) maxV = v;
      });
    });
    if (maxV - minV < 1) maxV = minV + 1;

    var cv = mkCanvas(body), ctx = cv.ctx, W = cv.w, H = cv.h;
    var padL = 34, padR = 8, padT = 18, padB = 8;
    var plotW = W - padL - padR, plotH = H - padT - padB;
    var accent = cssv('--accent', '#4b7bec');
    var sub = cssv('--sub', '#8b95a1');
    var lineC = cssv('--line', 'rgba(128,128,128,.25)');
    var orange = cssv('--orange', '#e58e26');

    function xOf(idx) { return padL + (n === 1 ? plotW / 2 : idx / (n - 1) * plotW); }
    function yOf(v) {
      return Math.max(padT, Math.min(H - padB, padT + (1 - (v - minV) / (maxV - minV)) * plotH));
    }

    // item 40 — nice Y ticks (subtle tick marks, no gridlines)
    var ticks = niceTicks(minV, maxV);
    ctx.font = '9px ' + fontFam();
    ticks.arr.forEach(function (v) {
      var y = Math.round(yOf(v)) + 0.5;
      ctx.strokeStyle = lineC; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(padL - 3, y); ctx.lineTo(padL, y); ctx.stroke();
      ctx.fillStyle = sub; ctx.textAlign = 'right';
      ctx.fillText(tickLabel(v, ticks.step), padL - 6, y + 3);
    });

    function drawSeries(vals, color, width, alpha) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color; ctx.lineWidth = width;
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath();
      var started = false;
      for (var k = 0; k < vals.length; k++) {
        if (vals[k] == null) continue;
        var x = xOf(k), y = yOf(vals[k]);
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      }
      if (started) ctx.stroke();
      ctx.restore();
    }
    drawSeries(singles, sub, 1, 0.45);
    drawSeries(ao5, accent, 1.8, 1);
    drawSeries(ao12, orange, 1.8, 1);

    // legend
    var items = [
      { c: sub, t: i18n('lgSingle', '싱글', 'single') },
      { c: accent, t: 'ao5' },
      { c: orange, t: 'ao12' }
    ];
    var lx = W - padR;
    for (i = items.length - 1; i >= 0; i--) {
      var tw = ctx.measureText(items[i].t).width;
      lx -= tw;
      ctx.fillStyle = sub; ctx.textAlign = 'left';
      ctx.fillText(items[i].t, lx, 10);
      ctx.fillStyle = items[i].c;
      ctx.beginPath(); ctx.arc(lx - 6, 7, 2.5, 0, Math.PI * 2); ctx.fill();
      lx -= 16;
    }

    // item 37 — hover tooltip (solve # + time) with marker dot
    var tip = document.createElement('div'); tip.className = 'fs2-tip';
    var dot = document.createElement('div'); dot.className = 'fs2-dot';
    body.appendChild(tip); body.appendChild(dot);
    cv.el.addEventListener('mousemove', function (e) {
      var r = cv.el.getBoundingClientRect();
      var mx = e.clientX - r.left;
      var idx = Math.round((mx - padL) / Math.max(1, plotW) * (n - 1));
      idx = Math.max(0, Math.min(n - 1, idx));
      var tv = singles[idx];
      var px = xOf(idx);
      var py = tv == null ? padT + 8 : yOf(tv);
      tip.textContent = '#' + (idx + 1) + '  ' + Stats.solveToString(solves[idx], P());
      tip.style.left = Math.max(padL, Math.min(W - 20, px)) + 'px';
      tip.style.top = py + 'px';
      tip.classList.toggle('below', py < 46);
      tip.classList.add('show');
      if (tv == null) dot.classList.remove('show');
      else {
        dot.style.left = px + 'px';
        dot.style.top = py + 'px';
        dot.classList.add('show');
      }
    });
    cv.el.addEventListener('mouseleave', function () {
      tip.classList.remove('show');
      dot.classList.remove('show');
    });
  }

  /* ================= tool: daily (item 38) ================= */
  function renderDaily(body) {
    var solves = App.solves();
    if (!solves.length) { emptyMsg(body); return; }
    var days = [], keyIdx = {}, today = new Date(), i;
    for (i = 13; i >= 0; i--) {
      var d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      keyIdx[dayKey(d)] = 13 - i;
      days.push(d);
    }
    var counts = zeros(14), total = 0;
    solves.forEach(function (sv) {
      if (!(sv[3] > 0)) return;
      var idx = keyIdx[dayKey(new Date(sv[3] * 1000))];
      if (idx != null) { counts[idx]++; total++; }
    });
    var maxC = 1;
    for (i = 0; i < 14; i++) if (counts[i] > maxC) maxC = counts[i];

    var cv = mkCanvas(body), ctx = cv.ctx, W = cv.w, H = cv.h;
    var padL = 8, padR = 8, padT = 20, padB = 16;
    var plotW = W - padL - padR, plotH = H - padT - padB;
    var accent = cssv('--accent', '#4b7bec');
    var sub = cssv('--sub', '#8b95a1');
    var lineC = cssv('--line', 'rgba(128,128,128,.25)');

    ctx.fillStyle = sub; ctx.font = '9px ' + fontFam(); ctx.textAlign = 'left';
    ctx.fillText(i18n('daily14', '최근 14일', 'last 14 days') + ' · ' + total, padL, 10);

    ctx.strokeStyle = lineC; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, H - padB + 0.5); ctx.lineTo(W - padR, H - padB + 0.5);
    ctx.stroke();

    var step = plotW / 14;
    var barW = Math.max(4, Math.min(step * 0.6, 20));
    for (i = 0; i < 14; i++) {
      if (!counts[i]) continue;
      var h = Math.max(2, counts[i] / maxC * plotH);
      ctx.save();
      ctx.globalAlpha = i === 13 ? 1 : 0.45;
      ctx.fillStyle = accent;
      rrect(ctx, padL + i * step + (step - barW) / 2, H - padB - h, barW, h, 2);
      ctx.restore();
    }
    // counts above bars
    ctx.textAlign = 'center';
    for (i = 0; i < 14; i++) {
      if (!counts[i]) continue;
      var hh = Math.max(2, counts[i] / maxC * plotH);
      ctx.fillStyle = i === 13 ? accent : sub;
      ctx.fillText(String(counts[i]), padL + i * step + step / 2, H - padB - hh - 4);
    }
    // day labels (every 2nd)
    ctx.fillStyle = sub;
    for (i = 0; i < 14; i += 2) {
      var dd = days[i];
      var lab = dd.getDate() === 1 || i === 0 ? (dd.getMonth() + 1) + '/' + dd.getDate() : String(dd.getDate());
      ctx.fillText(lab, padL + i * step + step / 2, H - 5);
    }
  }

  /* ================= tool: pbhist (item 43) ================= */
  function renderPbHist(body) {
    var solves = App.solves();
    if (!solves.length) { emptyMsg(body); return; }
    var best = Infinity, pbs = [];
    solves.forEach(function (sv, i) {
      var t = Stats.timeOf(sv);
      if (t < best) { pbs.push({ i: i, t: t, prev: best, ts: sv[3] }); best = t; }
    });
    if (!pbs.length) { emptyMsg(body); return; }
    var list = document.createElement('div');
    list.className = 'fs2-pbl';
    var head = document.createElement('div');
    head.className = 'fs2-pbh';
    head.textContent = i18n('pbCount', '싱글 PB 갱신 ' + pbs.length + '회', pbs.length + ' single-PB improvements');
    list.appendChild(head);
    pbs.forEach(function (p2, k) {
      var row = document.createElement('div');
      row.className = 'fs2-pbr' + (k === pbs.length - 1 ? ' cur' : '');
      row.appendChild(span('no', '#' + (p2.i + 1)));
      row.appendChild(span('t', fmt(p2.t)));
      if (p2.prev !== Infinity) row.appendChild(span('imp', '-' + fmt(p2.prev - p2.t)));
      row.appendChild(span('d', p2.ts > 0 ? dstr(p2.ts) : '-'));
      list.appendChild(row);
    });
    body.appendChild(list);
    requestAnimationFrame(function () { // latest (highlighted) into view
      if (body.isConnected) body.scrollTop = body.scrollHeight;
    });
  }

  /* ================= tool: sesscmp (item 44) ================= */
  function renderSessCmp(body) {
    var db = App.db();
    var tbl = document.createElement('table');
    tbl.className = 'fs2-tbl';
    var tr = document.createElement('tr');
    [i18n('sess', '세션', 'session'), 'n', 'best', 'ao5', 'mean'].forEach(function (h) {
      var th = document.createElement('th');
      th.textContent = h;
      tr.appendChild(th);
    });
    tbl.appendChild(tr);
    db.order.forEach(function (id) {
      var s = db.sessions[id];
      if (!s) return;
      var sum = Stats.sessionSummary(s.solves);
      var ba5 = Stats.bestAverage(s.solves, 5);
      var r = document.createElement('tr');
      if (id === db.current) r.className = 'cur';
      [s.name, String(s.solves.length), fmt(sum.best), ba5 ? fmt(ba5.value) : '-', fmt(sum.mean)]
        .forEach(function (v) {
          var td = document.createElement('td');
          td.textContent = v;
          r.appendChild(td);
        });
      tbl.appendChild(r);
    });
    body.appendChild(tbl);
  }

  /* ================= CSS ================= */
  var CSS = '' +
    '.fs2-empty{display:flex;align-items:center;justify-content:center;height:100%;color:var(--sub);font-size:12px;}' +
    '.fs2-stats{font-size:11.5px;line-height:1.5;padding:2px 4px 6px;font-variant-numeric:tabular-nums;}' +
    '.fs2-range{color:var(--sub);font-size:10.5px;margin:0 2px 4px;}' +
    '.fs2-line{display:flex;justify-content:space-between;align-items:baseline;gap:8px;padding:1.5px 4px;border-radius:7px;}' +
    '.fs2-line .l{color:var(--sub);white-space:nowrap;}' +
    '.fs2-line .v{font-weight:600;color:var(--fg);white-space:nowrap;}' +
    '.fs2-line .rng{color:var(--sub);font-weight:500;font-size:10px;margin-left:5px;}' +
    '.fs2-ao{cursor:pointer;}' +
    '.fs2-ao:hover{background:var(--hover);}' +
    '.fs2-ao:hover .v{color:var(--accent);}' +
    '.fs2-sep{height:1px;background:var(--line);margin:5px 2px;}' +
    '.fs2-btns{display:flex;gap:6px;margin-top:8px;}' +
    '.fs2-btns button{flex:1;padding:6px 8px;font-size:11px;border-radius:9px;}' +
    '.fs2-tip{position:absolute;z-index:5;pointer-events:none;background:var(--fg);color:var(--card);' +
      'font-size:10.5px;font-weight:600;padding:3px 8px;border-radius:8px;white-space:nowrap;' +
      'transform:translate(-50%,-150%);opacity:0;transition:opacity .1s;font-variant-numeric:tabular-nums;' +
      'box-shadow:var(--shadow-card);}' +
    '.fs2-tip.below{transform:translate(-50%,10px);}' +
    '.fs2-tip.show{opacity:1;}' +
    '.fs2-dot{position:absolute;z-index:4;width:8px;height:8px;border-radius:50%;background:var(--accent);' +
      'border:2px solid var(--card);transform:translate(-50%,-50%);pointer-events:none;opacity:0;box-shadow:var(--shadow-card);}' +
    '.fs2-dot.show{opacity:1;}' +
    '.fs2-pbl{font-size:11.5px;font-variant-numeric:tabular-nums;padding:2px;}' +
    '.fs2-pbh{color:var(--sub);font-size:10.5px;padding:2px 6px 4px;}' +
    '.fs2-pbr{display:flex;align-items:baseline;gap:7px;padding:4px 8px;border-radius:8px;}' +
    '.fs2-pbr .no{color:var(--sub);font-size:10.5px;width:34px;flex:none;}' +
    '.fs2-pbr .t{font-weight:700;}' +
    '.fs2-pbr .imp{color:var(--green);font-size:10px;font-weight:600;}' +
    '.fs2-pbr .d{margin-left:auto;color:var(--sub);font-size:10px;}' +
    '.fs2-pbr.cur{background:var(--accent-weak);}' +
    '.fs2-pbr.cur .t{color:var(--accent);}' +
    '.fs2-tbl{width:100%;border-collapse:collapse;font-size:11px;font-variant-numeric:tabular-nums;}' +
    '.fs2-tbl th{color:var(--sub);font-weight:600;font-size:10px;text-align:right;padding:3px 5px;border-bottom:1px solid var(--line);}' +
    '.fs2-tbl td{text-align:right;padding:4px 5px;border-bottom:1px solid var(--line);}' +
    '.fs2-tbl th:first-child,.fs2-tbl td:first-child{text-align:left;max-width:86px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
    '.fs2-tbl tr:last-child td{border-bottom:none;}' +
    '.fs2-tbl tr.cur td{background:var(--accent-weak);}' +
    '.fs2-tbl tr.cur td:first-child{border-radius:8px 0 0 8px;color:var(--accent);font-weight:600;}' +
    '.fs2-tbl tr.cur td:last-child{border-radius:0 8px 8px 0;}';

  /* ================= boot ================= */
  function boot() {
    App.addCSS(CSS);

    App.registerTool({ id: 'dist2', name: i18n('dist2', '분포 차트', 'distribution chart'), render: renderDist2 });
    App.registerTool({ id: 'trend2', name: i18n('trend2', '추세+', 'trend+'), render: renderTrend2 });
    App.registerTool({ id: 'daily', name: i18n('daily', '일별 솔브', 'solves per day'), render: renderDaily });
    App.registerTool({ id: 'stats2', name: i18n('stats2', '상세 통계', 'detailed stats'), render: renderStats2 });
    App.registerTool({ id: 'pbhist', name: i18n('pbhist', 'PB 히스토리', 'PB history'), render: renderPbHist });
    App.registerTool({ id: 'sesscmp', name: i18n('sesscmp', '세션 비교', 'session compare'), render: renderSessCmp });

    // item 47 — milestone toast every 100 session solves
    App.on('solve', function () {
      var cnt;
      try { cnt = App.solves().length; } catch (e) { return; }
      if (cnt > 0 && cnt % 100 === 0) {
        App.toast(i18n('milestone', '🎉 ' + cnt + ' 솔브 달성!', '🎉 ' + cnt + ' solves'), { type: 'success' });
      }
    });
  }

  // Core sets up DB inside init() (DOMContentLoaded) and emits 'ready';
  // pack scripts execute before that, so defer until the DB exists.
  if (App.db && App.db()) boot();
  else App.on('ready', boot);
})();
