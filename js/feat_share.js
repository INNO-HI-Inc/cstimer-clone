/* feat_share — [share] feature pack (UPGRADES 91, 92, 94–99)
 * PWA wiring, runtime favicon, share card image, Web Share, OBS mini overlay,
 * date format option, session text report, data integrity check.
 * Integrates only through window.App (see API.md). No core files touched. */
(function () {
  'use strict';
  if (!window.App) return;
  var App = window.App, Stats = window.Stats;

  var LS_DATEFMT = 'cstc_pack_share_datefmt';

  /* ---------- i18n live-refresh registry ---------- */
  var i18nEls = [];
  function tx(el, ko, en, attr) {
    i18nEls.push({ el: el, ko: ko, en: en, attr: attr || null });
    applyTx(i18nEls[i18nEls.length - 1]);
    return el;
  }
  function applyTx(rec) {
    var s = App.i18n('', rec.ko, rec.en);
    if (rec.attr) rec.el.setAttribute(rec.attr, s);
    else rec.el.textContent = s;
  }
  function refreshTexts() { i18nEls.forEach(applyTx); }

  function prec() { return App.options().precision || 2; }
  function fms(v) { return v == null ? '-' : Stats.timeToString(v, prec()); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function cssVar(name, fallback) {
    var v = getComputedStyle(document.body).getPropertyValue(name).trim();
    return v || fallback;
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* =====================================================
   * 91. PWA wiring — manifest link + service worker
   * =================================================== */
  function setupPWA() {
    if (!document.querySelector('link[rel="manifest"]')) {
      var l = document.createElement('link');
      l.rel = 'manifest';
      l.href = './manifest.webmanifest';
      document.head.appendChild(l);
    }
    if ('serviceWorker' in navigator && (location.protocol === 'http:' || location.protocol === 'https:')) {
      try {
        // If nothing controlled this page when it loaded, this is a first-ever
        // install: nothing rendered is stale, so any 'updated' signal is a false
        // alarm. sw.js posts SW_UPDATED from activate, which also fires on that
        // first install — so the guard lives here rather than trusting the sender.
        var wasControlled = !!navigator.serviceWorker.controller;
        navigator.serviceWorker.register('./sw.js').then(function (reg) {
          // A new SW caches the NEW app.js while this page keeps running the OLD one,
          // so the user must be told. Never auto-reload — that would nuke a running timer.
          reg.addEventListener('updatefound', function () {
            var nw = reg.installing;
            if (!nw) return;
            nw.addEventListener('statechange', function () {
              // no controller = first-ever install, nothing is stale; don't nag
              if (nw.state === 'installed' && navigator.serviceWorker.controller) announceUpdate();
            });
          });
        }).catch(function (e) {
          console.warn('[share] sw register skipped:', e && e.message);
        });
        // sw.js also posts SW_UPDATED on activate; either path may win, announce once
        navigator.serviceWorker.addEventListener('message', function (e) {
          if (e.data && e.data.type === 'SW_UPDATED' && wasControlled) announceUpdate();
        });
      } catch (e) { /* file:// or blocked — app still works */ }
    }
  }

  var updateAnnounced = false;
  function announceUpdate() {
    if (updateAnnounced) return;
    updateAnnounced = true;
    App.toast(App.i18n('swNew', '새 버전이 준비됐어요', 'new version ready'), {
      ms: 3600000,
      action: {
        label: App.i18n('swReload', '새로고침', 'reload'),
        onClick: function () { location.reload(); }
      }
    });
  }

  /* =====================================================
   * 92. Favicon — 64×64 canvas icon at runtime
   * =================================================== */
  function setupFavicon() {
    try {
      var c = document.createElement('canvas');
      c.width = 64; c.height = 64;
      var ctx = c.getContext('2d');
      roundRect(ctx, 0, 0, 64, 64, 14);
      ctx.fillStyle = '#3182f6'; /* brand icon color (fixed, not themed) */
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 30px "Pretendard Variable", Pretendard, -apple-system, "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('cs', 32, 34);
      var link = document.querySelector('link[rel="icon"]');
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.type = 'image/png';
      link.href = c.toDataURL('image/png');
    } catch (e) { /* non-fatal */ }
  }

  /* =====================================================
   * 97. Date format option (shared helper)
   * =================================================== */
  function dateMode() {
    try { return localStorage.getItem(LS_DATEFMT) || 'system'; } catch (e) { return 'system'; }
  }
  function fmtDate(tsSec) {
    if (!tsSec) return '-';
    var d = new Date(tsSec * 1000);
    var mode = dateMode();
    if (mode === 'iso') {
      return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
        ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
    }
    if (mode === 'rel') {
      var diff = Math.max(0, (Date.now() - d.getTime()) / 1000);
      if (diff < 60) return App.i18n('justNow', '방금 전', 'just now');
      if (diff < 3600) return Math.floor(diff / 60) + App.i18n('minAgo', '분 전', 'm ago');
      if (diff < 86400) return Math.floor(diff / 3600) + App.i18n('hAgo', '시간 전', 'h ago');
      if (diff < 86400 * 30) return Math.floor(diff / 86400) + App.i18n('dAgo', '일 전', 'd ago');
      return d.toLocaleDateString();
    }
    return d.toLocaleString();
  }

  var tmIndex = -1;
  function retouchTmDate() {
    if (tmIndex < 0) return;
    var el = document.getElementById('tmDate');
    if (!el) return;
    var sv = App.solves()[tmIndex];
    if (!sv) return;
    el.textContent = fmtDate(sv[3]);
  }
  function setupDateFormat() {
    App.registerOptionRow('optPgDisplay', function (pg) {
      var row = document.createElement('label');
      row.className = 'orow';
      var sp = tx(document.createElement('span'), '날짜 형식', 'date format');
      var sel = document.createElement('select');
      var opts = [
        ['system', '시스템 기본', 'system default'],
        ['iso', 'YYYY-MM-DD HH:mm', 'YYYY-MM-DD HH:mm'],
        ['rel', '상대 시간 (3시간 전)', 'relative (3h ago)']
      ];
      opts.forEach(function (o) {
        var op = document.createElement('option');
        op.value = o[0];
        tx(op, o[1], o[2]);
        sel.appendChild(op);
      });
      sel.value = dateMode();
      sel.addEventListener('change', function () {
        try { localStorage.setItem(LS_DATEFMT, sel.value); } catch (e) { }
        retouchTmDate();
      });
      row.appendChild(sp);
      row.appendChild(sel);
      pg.appendChild(row);
    });
    App.on('timeModalOpen', function (container, index) {
      tmIndex = index;
      retouchTmDate();
    });
    App.on('render', function () {
      var m = document.getElementById('timeModal');
      if (m && m.classList.contains('show')) retouchTmDate();
    });
  }

  /* =====================================================
   * 94 + 95. Share card modal (+ Web Share)
   * =================================================== */
  var shareModal = null, shareCanvas = null, shareTitleEl = null;

  function lastAndBest() {
    var solves = App.solves();
    var sum = Stats.sessionSummary(solves);
    var last = solves.length ? solves[solves.length - 1] : null;
    return { solves: solves, sum: sum, last: last };
  }

  function drawShareCard(canvas) {
    var W = 600, H = 400;
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');
    var bg = cssVar('--bg', '#f2f4f6');
    var card = cssVar('--card', '#ffffff');
    var fg = cssVar('--fg', '#191f28');
    var sub = cssVar('--sub', '#6b7684');
    var accent = cssVar('--accent', '#3182f6');
    var accentWeak = cssVar('--accent-weak', 'rgba(49,130,246,.16)');
    var line = cssVar('--line', '#e5e8eb');
    var fam = getComputedStyle(document.body).fontFamily || 'sans-serif';

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    /* rounded card */
    ctx.save();
    ctx.shadowColor = 'rgba(2,32,71,.10)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;
    roundRect(ctx, 28, 28, W - 56, H - 56, 20);
    ctx.fillStyle = card;
    ctx.fill();
    ctx.restore();
    roundRect(ctx, 28, 28, W - 56, H - 56, 20);
    ctx.strokeStyle = line;
    ctx.lineWidth = 1;
    ctx.stroke();

    var d = lastAndBest();
    var isLast = !!d.last;
    var bigVal = isLast ? Stats.solveToString(d.last, prec()) : fms(d.sum.best);
    var label = isLast ? App.i18n('shLast', '최근 솔브', 'latest solve')
      : App.i18n('shBest', '베스트 싱글', 'best single');
    var evName = App.currentEvent().name;

    /* event pill */
    ctx.font = '600 15px ' + fam;
    var pw = ctx.measureText(evName).width + 28;
    roundRect(ctx, 56, 58, pw, 32, 16);
    ctx.fillStyle = accentWeak;
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(evName, 70, 75);

    /* label */
    ctx.fillStyle = sub;
    ctx.font = '600 17px ' + fam;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(label, 58, 152);

    /* big time */
    ctx.fillStyle = fg;
    ctx.font = '800 76px ' + fam;
    ctx.fillText(bigVal, 54, 232);

    /* stats row */
    var a5 = d.solves.length >= 5 ? Stats.averageOf(d.solves, d.solves.length - 1, 5) : null;
    var a12 = d.solves.length >= 12 ? Stats.averageOf(d.solves, d.solves.length - 1, 12) : null;
    ctx.font = '500 16px ' + fam;
    ctx.fillStyle = sub;
    ctx.fillText(
      App.i18n('shStats', '베스트', 'best') + ' ' + fms(d.sum.best) +
      '   ·   ao5 ' + fms(a5) + '   ·   ao12 ' + fms(a12) +
      '   ·   ' + d.sum.count + App.i18n('shSolves', ' 솔브', ' solves'),
      58, 284);

    /* divider + footer */
    ctx.strokeStyle = line;
    ctx.beginPath();
    ctx.moveTo(56, 316);
    ctx.lineTo(W - 56, 316);
    ctx.stroke();
    ctx.font = '500 14px ' + fam;
    ctx.fillStyle = sub;
    var when = isLast && d.last[3] ? fmtDate(d.last[3]) : fmtDate(Math.floor(Date.now() / 1000));
    ctx.fillText(when, 58, 346);
    ctx.textAlign = 'right';
    ctx.fillStyle = accent;
    ctx.font = '700 14px ' + fam;
    ctx.fillText('csTimer clone', W - 58, 346);
    ctx.textAlign = 'left';
  }

  function cardBlob(cb) {
    if (!shareCanvas) return;
    shareCanvas.toBlob(function (b) {
      if (b) cb(b);
      else App.toast(App.i18n('shFail', '이미지 생성 실패', 'could not build image'), { type: 'error' });
    }, 'image/png');
  }
  function downloadCard() {
    cardBlob(function (b) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = 'cstimer-share.png';
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
    });
  }
  function summaryText() {
    var d = lastAndBest();
    var a5 = d.solves.length >= 5 ? Stats.averageOf(d.solves, d.solves.length - 1, 5) : null;
    return 'csTimer clone — ' + App.currentEvent().name +
      ' | ' + (d.last ? App.i18n('shLast', '최근 솔브', 'latest solve') + ' ' + Stats.solveToString(d.last, prec()) : '') +
      ' | ' + App.i18n('shStats', '베스트', 'best') + ' ' + fms(d.sum.best) +
      ' | ao5 ' + fms(a5) +
      ' | ' + d.sum.count + App.i18n('shSolves', ' 솔브', ' solves');
  }

  function setupShareCard() {
    App.addCSS(
      '#shareCardWrap{background:var(--bg);border-radius:var(--radius-btn);padding:10px;}' +
      '#shareCardWrap canvas{display:block;width:100%;height:auto;border-radius:var(--radius-btn);box-shadow:var(--shadow-card);}' +
      '#shareBtns{margin-top:12px;}'
    );
    shareModal = App.registerModal('shareModal', App.i18n('shTitle', '공유 카드', 'share card'), function (body) {
      var wrap = document.createElement('div');
      wrap.id = 'shareCardWrap';
      shareCanvas = document.createElement('canvas');
      shareCanvas.width = 600; shareCanvas.height = 400;
      wrap.appendChild(shareCanvas);
      body.appendChild(wrap);

      var btns = document.createElement('div');
      btns.className = 'mbtns wrap';
      btns.id = 'shareBtns';

      var dl = document.createElement('button');
      dl.className = 'primary';
      tx(dl, 'PNG 다운로드', 'download PNG');
      dl.addEventListener('click', downloadCard);
      btns.appendChild(dl);

      var cp = document.createElement('button');
      tx(cp, '이미지 복사', 'copy image');
      cp.addEventListener('click', function () {
        cardBlob(function (b) {
          try {
            if (!navigator.clipboard || !window.ClipboardItem) throw new Error('no clipboard');
            navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]).then(function () {
              App.toast(App.i18n('shCopied', '이미지 복사됨', 'image copied'), { type: 'success' });
            }).catch(function () { downloadCard(); });
          } catch (e) { downloadCard(); }
        });
      });
      btns.appendChild(cp);

      if (navigator.share) {
        var sh = document.createElement('button');
        tx(sh, '공유', 'share');
        sh.addEventListener('click', function () {
          cardBlob(function (b) {
            var payload = { title: 'csTimer clone', text: summaryText() };
            try {
              var file = new File([b], 'cstimer-share.png', { type: 'image/png' });
              if (navigator.canShare && navigator.canShare({ files: [file] })) {
                payload = { title: 'csTimer clone', files: [file] };
              }
            } catch (e) { }
            navigator.share(payload).catch(function () { /* user cancelled */ });
          });
        });
        btns.appendChild(sh);
      }
      body.appendChild(btns);
    });
    shareTitleEl = shareModal.titleEl;

    var menuBtn = App.registerMenuButton({
      icon: '&#8599;',
      title: App.i18n('shTitle', '공유 카드', 'share card'),
      onClick: function () {
        if (shareTitleEl) shareTitleEl.textContent = App.i18n('shTitle', '공유 카드', 'share card');
        drawShareCard(shareCanvas);
        shareModal.open();
      }
    });
    if (menuBtn) {
      menuBtn.id = 'btnShareCard';
      tx(menuBtn, '공유 카드', 'share card', 'title');
      tx(menuBtn, '공유 카드', 'share card', 'aria-label');
    }
  }

  /* =====================================================
   * 96. Mini overlay mode (?mini=1) for OBS
   * =================================================== */
  function setupMini() {
    if (/[?&]mini=1(&|$)/.test(location.search)) {
      App.addCSS(
        '#leftbar,#topbar,#toolDock,#padHint,#logohint{display:none !important;}' +
        'body{background:#000 !important;padding:0 !important;}' +
        '#main{padding:0 !important;gap:0 !important;}' +
        '#timerPad{margin:0 !important;}' +
        '#timerDisplay{color:#fff !important;}'
      );
    }
    App.registerOptionRow('optPgAbout', function (pg) {
      var p = document.createElement('p');
      p.className = 'onote orow';
      tx(p, 'OBS 오버레이: 주소 뒤에 ?mini=1 을 붙이면 타이머만 표시됩니다.',
        'OBS overlay: append ?mini=1 to the URL to show only the timer.');
      pg.appendChild(p);
    });
  }

  /* =====================================================
   * 98. Session text report (.txt)
   * =================================================== */
  function buildReport() {
    var s = App.session();
    var solves = App.solves();
    var sum = Stats.sessionSummary(solves);
    var lines = [];
    lines.push('csTimer clone — ' + App.i18n('rpTitle', '세션 리포트', 'session report'));
    lines.push(App.i18n('rpSess', '세션', 'session') + ': ' + s.name + ' (' + App.currentEvent().name + ')');
    var tss = solves.map(function (sv) { return sv[3]; }).filter(function (t) { return t > 0; });
    if (tss.length) {
      lines.push(App.i18n('rpPeriod', '기간', 'period') + ': ' +
        fmtDate(Math.min.apply(null, tss)) + ' ~ ' + fmtDate(Math.max.apply(null, tss)));
    }
    lines.push('');
    lines.push(App.i18n('rpSolves', '솔브', 'solves') + ': ' + sum.valid + '/' + sum.count +
      (sum.dnf ? ' (DNF ' + sum.dnf + ')' : ''));
    lines.push('best: ' + fms(sum.best) + '   worst: ' + fms(sum.worst));
    lines.push('avg: ' + fms(sum.avg) + '   mean: ' + fms(sum.mean) + '   σ: ' + fms(sum.sd));
    [5, 12, 50, 100].forEach(function (n) {
      var ba = Stats.bestAverage(solves, n);
      if (ba) lines.push('best ao' + n + ': ' + fms(ba.value) + ' (#' + (ba.end - n + 2) + '–#' + (ba.end + 1) + ')');
    });
    lines.push('');
    solves.forEach(function (sv, i) {
      var row = (i + 1) + '. ' + Stats.solveToString(sv, prec());
      if (sv[1]) row += '   ' + String(sv[1]).replace(/\n/g, ' ');
      if (sv[2]) row += '   // ' + String(sv[2]);
      lines.push(row);
    });
    return lines.join('\n');
  }

  /* =====================================================
   * 99. Data integrity check
   * =================================================== */
  var VALID_PENS = [0, 2000, -1];
  function scanDB() {
    var db = App.db();
    var r = { sessions: 0, scanned: 0, badShape: 0, badMs: 0, badPen: 0, futureTs: 0 };
    var horizon = Date.now() + 60000;
    Object.keys(db.sessions).forEach(function (id) {
      var s = db.sessions[id];
      if (!s || !Array.isArray(s.solves)) return;
      r.sessions++;
      s.solves.forEach(function (sv) {
        r.scanned++;
        if (!Array.isArray(sv) || !Array.isArray(sv[0])) { r.badShape++; return; }
        var ms = sv[0][1];
        if (typeof ms !== 'number' || isNaN(ms) || !isFinite(ms) || ms < 0) r.badMs++;
        if (VALID_PENS.indexOf(sv[0][0]) < 0) r.badPen++;
        if (typeof sv[3] === 'number' && sv[3] * 1000 > horizon) r.futureTs++;
      });
    });
    r.issues = r.badShape + r.badMs + r.badPen + r.futureTs;
    return r;
  }
  function fixDB() {
    var db = App.db();
    var dropped = 0, fixed = 0;
    var horizon = Date.now() + 60000;
    Object.keys(db.sessions).forEach(function (id) {
      var s = db.sessions[id];
      if (!s || !Array.isArray(s.solves)) return;
      s.solves = s.solves.filter(function (sv) {
        if (!Array.isArray(sv) || !Array.isArray(sv[0])) { dropped++; return false; }
        var ms = sv[0][1];
        if (typeof ms !== 'number' || isNaN(ms) || !isFinite(ms) || ms < 0) { dropped++; return false; }
        if (VALID_PENS.indexOf(sv[0][0]) < 0) { sv[0][0] = 0; fixed++; }
        if (typeof sv[3] === 'number' && sv[3] * 1000 > horizon) { sv[3] = Math.floor(Date.now() / 1000); fixed++; }
        return true;
      });
    });
    App.save();
    App.refresh();
    return { dropped: dropped, fixed: fixed };
  }

  var integModal = null;
  function openIntegrity() {
    var r = scanDB();
    var body = integModal.body;
    body.innerHTML = '';
    var pre = document.createElement('pre');
    pre.style.cssText = 'font-family:inherit;white-space:pre-wrap;line-height:1.9;margin:4px 0 10px;';
    pre.textContent = [
      App.i18n('icScanned', '검사한 기록', 'solves scanned') + ': ' + r.scanned + ' (' + r.sessions + App.i18n('icSess', '개 세션', ' sessions') + ')',
      App.i18n('icShape', '형식 오류', 'wrong shape') + ': ' + r.badShape,
      App.i18n('icMs', '잘못된 시간 (음수/NaN)', 'invalid time (negative/NaN)') + ': ' + r.badMs,
      App.i18n('icPen', '잘못된 페널티', 'invalid penalty') + ': ' + r.badPen,
      App.i18n('icTs', '미래 타임스탬프', 'future timestamp') + ': ' + r.futureTs,
      '',
      r.issues === 0
        ? App.i18n('icOk', '문제가 발견되지 않았어요 ✓', 'no problems found ✓')
        : App.i18n('icBad', '문제 ' + r.issues + '건 발견', r.issues + ' issue(s) found')
    ].join('\n');
    body.appendChild(pre);
    if (r.issues > 0) {
      var btns = document.createElement('div');
      btns.className = 'mbtns';
      var fix = document.createElement('button');
      fix.className = 'primary';
      fix.textContent = App.i18n('icFix', '한 번에 고치기', 'fix all');
      fix.addEventListener('click', function () {
        App.confirm(App.i18n('icConfirm',
          '복구 불가한 기록은 삭제되고, 고칠 수 있는 값은 보정됩니다. 진행할까요?',
          'unfixable solves will be dropped, fixable values clamped. continue?'), function () {
            var res = fixDB();
            App.toast(App.i18n('icDone',
              '완료 — 삭제 ' + res.dropped + ' · 보정 ' + res.fixed,
              'done — dropped ' + res.dropped + ' · fixed ' + res.fixed), { type: 'success' });
            openIntegrity();
          });
      });
      btns.appendChild(fix);
      body.appendChild(btns);
    }
    integModal.titleEl.textContent = App.i18n('icTitle', '데이터 검사', 'integrity check');
    integModal.open();
  }

  function setupDataButtons() {
    integModal = App.registerModal('integrityModal', App.i18n('icTitle', '데이터 검사', 'integrity check'), function () { });
    App.registerOptionRow('optPgData', function (pg) {
      var row = document.createElement('div');
      row.className = 'mbtns wrap orow';
      row.style.borderBottom = 'none';

      var rep = document.createElement('button');
      tx(rep, '텍스트 리포트', 'text report');
      rep.id = 'btnShareReport';
      rep.addEventListener('click', function () {
        App.download('session.txt', buildReport(), 'text/plain');
        App.toast(App.i18n('rpDone', '리포트 저장됨', 'report saved'), { type: 'success' });
      });
      row.appendChild(rep);

      var chk = document.createElement('button');
      tx(chk, '데이터 검사', 'integrity check');
      chk.id = 'btnShareIntegrity';
      chk.addEventListener('click', openIntegrity);
      row.appendChild(chk);

      pg.appendChild(row);
    });
  }

  /* =====================================================
   * boot
   * =================================================== */
  function boot() {
    setupPWA();
    setupFavicon();
    setupDateFormat();
    setupShareCard();
    setupMini();
    setupDataButtons();
    App.on('options', refreshTexts);
  }
  if (App.db && App.db()) boot();
  else App.on('ready', boot);
})();
