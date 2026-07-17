/* feat_tools.js — [tools] feature pack: UPGRADES 82(대체)–89 (original code)
 * 82R letter-pair memo trainer · 83 average calculator · 84 daily goal ring
 * 85 relay helper · 86 scramble-image zoom modal · 87 image PNG download
 * 88 bulk scramble generator · 89 drill counter
 * Uses only the window.App plugin API (API.md). Never touches core files.
 */
(function () {
  'use strict';
  if (!window.App) return;
  var App = window.App;

  function setup() {
    var Stats = window.Stats, Scrambler = window.Scrambler;
    if (!Stats || !Scrambler || !App.db()) return;
    var t = App.i18n;

    /* ---------- pack CSS (Toss tokens only) ---------- */
    App.addCSS([
      '.ftlWrap{display:flex;flex-direction:column;gap:8px;padding:6px 4px;font-size:12.5px;color:var(--fg);}',
      '.ftlRow{display:flex;gap:6px;align-items:center;flex-wrap:wrap;}',
      '.ftlGrow{flex:1;}',
      '.ftlBtn{border-radius:var(--radius-btn);padding:6px 10px;font-size:12px;font-weight:600;}',
      '.ftlWide{width:100%;padding:9px 10px;font-size:13px;}',
      '.ftlNum{width:64px;text-align:center;border-radius:var(--radius-btn);padding:6px 8px;font-size:12px;}',
      '.ftlTa{width:100%;min-height:54px;resize:vertical;border-radius:var(--radius-btn);' +
        'font-family:Menlo,Consolas,monospace;font-size:11px;line-height:1.5;}',
      '.ftlPre{font-family:Menlo,Consolas,monospace;font-size:11px;line-height:1.6;white-space:pre-wrap;color:var(--fg);margin:0;}',
      '.ftlMuted{color:var(--sub);font-size:11px;}',
      '.ftlCenter{text-align:center;}',
      '.ftlList{max-height:104px;overflow:auto;border:1px solid var(--line);border-radius:var(--radius-btn);' +
        'padding:5px 8px;display:flex;flex-direction:column;gap:5px;background:var(--card2);}',
      '.ftlItem{display:flex;gap:7px;align-items:flex-start;font-size:11px;line-height:1.45;}',
      '.ftlItem input[type="checkbox"]{margin-top:2px;accent-color:var(--accent);cursor:pointer;}',
      '.ftlItem .ftlScr{font-family:Menlo,Consolas,monospace;word-break:break-word;white-space:pre-wrap;}',
      '.ftlItem.done .ftlScr{text-decoration:line-through;opacity:.5;}',
      '.ftlItem b{font-weight:700;flex:none;}',
      '.ftlBigPair{font-size:42px;font-weight:800;letter-spacing:8px;text-align:center;padding:10px 0 2px;text-indent:8px;}',
      '.ftlCount{font-size:26px;font-weight:800;text-align:center;font-variant-numeric:tabular-nums;}',
      '.ftlCount.hit{color:var(--green);}',
      '.ftlGoalBox{display:flex;gap:14px;align-items:center;justify-content:center;padding:2px 0;}',
      '.ftlDone{color:var(--green);font-weight:700;font-size:12px;}',
      '.ftlZoomable .toolBody canvas{cursor:zoom-in;}',
      '#ftlZoomModal .mbox{width:720px;}',
      '#ftlZoomCanvas{max-width:100%;height:auto;display:block;margin:0 auto;border-radius:12px;background:var(--card2);}',
      '#ftlZoomScr{max-height:72px;overflow:auto;margin-top:10px;}'
    ].join('\n'));

    /* ---------- small helpers ---------- */
    function el(tag, cls, txt) {
      var e = document.createElement(tag);
      if (cls) e.className = cls;
      if (txt != null) e.textContent = txt;
      return e;
    }
    function btn(label, cls, fn) {
      var b = el('button', 'btn ftlBtn' + (cls ? ' ' + cls : ''), label);
      b.type = 'button';
      b.addEventListener('click', fn);
      return b;
    }
    function numInput(val, min, max) {
      var i = el('input', 'ftlNum');
      i.type = 'number'; i.min = min; i.max = max; i.value = val;
      return i;
    }
    function fm(v) { return v == null ? '-' : Stats.timeToString(v, App.options().precision); }
    function pad2(x) { return (x < 10 ? '0' : '') + x; }
    function dateKey(d) {
      d = d || new Date();
      return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
    }
    function isToday(tsSec) {
      if (!tsSec) return false;
      return dateKey(new Date(tsSec * 1000)) === dateKey();
    }
    function lsGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
    function lsSet(key, v) { try { localStorage.setItem(key, v); } catch (e) { } }

    /* my tool registry + targeted re-render (keeps renders cheap & idempotent) */
    var MY = {};
    function reg(def) { MY[def.id] = def; App.registerTool(def); }
    function refreshTool(id) {
      [0, 1].forEach(function (slot) {
        if (slot === 1 && !App.options().secondTool) return;
        if (App.options()['tool' + slot] !== id) return;
        var body = document.getElementById('toolBody' + slot);
        if (!body) return;
        body.innerHTML = '';
        try { MY[id].render(body, slot); } catch (e) { console.error('[feat_tools]', e); }
      });
    }

    /* =====================================================================
     * 82R — BLD memo trainer: letter pairs (Speffz A–X)
     * =================================================================== */
    var LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWX';
    var LP = { pair: '', count: 0 };
    function lpNext() {
      var a = LETTERS[Math.floor(Math.random() * LETTERS.length)], b;
      do { b = LETTERS[Math.floor(Math.random() * LETTERS.length)]; } while (b === a);
      LP.pair = a + b;
    }
    reg({
      id: 'lettpair', name: t('toolLp', '레터페어 퀴즈', 'letter pairs'),
      render: function (body) {
        if (!LP.pair) lpNext();
        var w = el('div', 'ftlWrap');
        w.appendChild(el('div', 'ftlBigPair', LP.pair));
        w.appendChild(el('div', 'ftlMuted ftlCenter', t('lpCount', '진행', 'seen') + ': ' + LP.count));
        var row = el('div', 'ftlRow');
        row.appendChild(btn(t('lpNext', '다음', 'next'), 'primary ftlGrow', function () {
          LP.count++; lpNext(); refreshTool('lettpair');
        }));
        row.appendChild(btn(t('lpReset', '리셋', 'reset'), 'ghost', function () {
          LP.count = 0; lpNext(); refreshTool('lettpair');
        }));
        w.appendChild(row);
        w.appendChild(el('div', 'ftlMuted ftlCenter',
          t('lpHint', '이미지를 떠올린 뒤 다음을 누르세요', 'picture the pair, then hit next')));
        body.appendChild(w);
      }
    });

    /* =====================================================================
     * 83 — Average calculator (paste times → mo3/ao5/ao12/mean/best/worst)
     * =================================================================== */
    var AO = { text: '', out: '' };
    function aoCompute() {
      var toks = AO.text.split(/[\s,;]+/).filter(Boolean);
      var arr = [], bad = 0;
      toks.forEach(function (tok) {
        var p = Stats.parseTime(tok);
        if (p) arr.push([[p[0], p[1]], '', '', 0]); else bad++;
      });
      if (!arr.length) { AO.out = t('aoNone', '시간을 찾지 못했어요', 'no times found'); return; }
      var n = arr.length, sum = Stats.sessionSummary(arr);
      var L = [];
      L.push(t('aoCnt', '개수', 'count') + ': ' + n +
        (sum.dnf ? ' (DNF ' + sum.dnf + ')' : '') +
        (bad ? ' · ' + t('aoBad', '무시', 'ignored') + ' ' + bad : ''));
      L.push('best: ' + fm(sum.best) + '   worst: ' + fm(sum.worst));
      L.push('mean: ' + fm(sum.mean));
      L.push('mo3: ' + fm(Stats.meanOf(arr, n - 1, 3)));
      L.push('ao5: ' + fm(Stats.averageOf(arr, n - 1, 5)));
      L.push('ao12: ' + fm(Stats.averageOf(arr, n - 1, 12)));
      AO.out = L.join('\n');
    }
    reg({
      id: 'aocalc', name: t('toolAo', '평균 계산기', 'average calc'),
      render: function (body) {
        var w = el('div', 'ftlWrap');
        var ta = el('textarea', 'ftlTa');
        ta.placeholder = t('aoPh', '시간 붙여넣기 (줄/공백 구분, DNF 가능)', 'paste times (lines/spaces, DNF ok)');
        ta.value = AO.text;
        ta.addEventListener('input', function () { AO.text = ta.value; });
        w.appendChild(ta);
        var row = el('div', 'ftlRow');
        row.appendChild(btn(t('aoCalc', '계산', 'calculate'), 'primary ftlGrow', function () {
          AO.text = ta.value; aoCompute(); refreshTool('aocalc');
        }));
        row.appendChild(btn(t('copy', '복사', 'copy'), 'ghost', function () {
          if (!AO.out) return;
          App.copyText(AO.out);
          App.toast(t('copied', '복사됨', 'copied'));
        }));
        w.appendChild(row);
        if (AO.out) w.appendChild(el('pre', 'ftlPre', AO.out));
        body.appendChild(w);
      }
    });

    /* =====================================================================
     * 84 — Daily goal tracker (SVG progress ring)
     * =================================================================== */
    var GOAL_KEY = 'cstc_pack_tools_goal';
    function goalTarget() {
      var v = parseInt(lsGet(GOAL_KEY), 10);
      return v > 0 ? Math.min(v, 999) : 10;
    }
    function todayCount() {
      var c = 0;
      App.solves().forEach(function (sv) { if (isToday(sv[3])) c++; });
      return c;
    }
    var SVGNS = 'http://www.w3.org/2000/svg';
    function svgEl(name, attrs) {
      var e = document.createElementNS(SVGNS, name);
      Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
      return e;
    }
    function goalRing(cnt, target) {
      var pct = Math.max(0, Math.min(1, cnt / target));
      var done = cnt >= target;
      var r = 40, circ = 2 * Math.PI * r;
      var svg = svgEl('svg', { width: 96, height: 96, viewBox: '0 0 96 96', role: 'img' });
      svg.appendChild(svgEl('circle', {
        cx: 48, cy: 48, r: r, fill: 'none', stroke: 'var(--line)', 'stroke-width': 8
      }));
      svg.appendChild(svgEl('circle', {
        cx: 48, cy: 48, r: r, fill: 'none',
        stroke: done ? 'var(--green)' : 'var(--accent)',
        'stroke-width': 8, 'stroke-linecap': 'round',
        'stroke-dasharray': circ, 'stroke-dashoffset': circ * (1 - pct),
        transform: 'rotate(-90 48 48)'
      }));
      var tx = svgEl('text', {
        x: 48, y: 46, 'text-anchor': 'middle',
        'font-size': 17, 'font-weight': 700, fill: 'var(--fg)'
      });
      tx.textContent = String(cnt);
      svg.appendChild(tx);
      var tx2 = svgEl('text', {
        x: 48, y: 62, 'text-anchor': 'middle',
        'font-size': 11, fill: 'var(--sub)'
      });
      tx2.textContent = '/ ' + target;
      svg.appendChild(tx2);
      return svg;
    }
    reg({
      id: 'goal', name: t('toolGoal', '오늘 목표', 'daily goal'),
      render: function (body) {
        var target = goalTarget(), cnt = todayCount(), done = cnt >= target;
        var w = el('div', 'ftlWrap');
        var row = el('div', 'ftlRow');
        row.appendChild(el('span', 'ftlMuted ftlGrow', t('goalLabel', '하루 목표 솔브', 'solves per day')));
        var inp = numInput(target, 1, 999);
        inp.addEventListener('change', function () {
          var v = parseInt(inp.value, 10);
          if (!(v > 0)) v = 10;
          v = Math.min(v, 999);
          lsSet(GOAL_KEY, String(v));
          refreshTool('goal');
        });
        row.appendChild(inp);
        w.appendChild(row);
        var box = el('div', 'ftlGoalBox');
        box.appendChild(goalRing(cnt, target));
        var side = el('div', '');
        if (done) side.appendChild(el('div', 'ftlDone', t('goalDone', '완료! 목표 달성 ✓', 'done! goal reached ✓')));
        else side.appendChild(el('div', 'ftlMuted',
          t('goalLeft', '오늘 ' + cnt + '개 · ' + (target - cnt) + '개 남음', cnt + ' today · ' + (target - cnt) + ' to go')));
        box.appendChild(side);
        w.appendChild(box);
        body.appendChild(w);
      }
    });
    App.on('solvesChanged', function () { refreshTool('goal'); });
    App.on('sessionChanged', function () { refreshTool('goal'); });

    /* =====================================================================
     * 85 — Relay helper (multi-scramble checklist)
     * =================================================================== */
    var RELAY_SETS = [
      { id: '234', label: '2-3-4', evs: ['222so', '333', '444wca'] },
      { id: '2345', label: '2-3-4-5', evs: ['222so', '333', '444wca', '555wca'] },
      { id: '333x3', label: '3x3x3 ×3', evs: ['333', '333', '333'] }
    ];
    var RL = { set: '234', items: [] };
    function relaySet() {
      for (var i = 0; i < RELAY_SETS.length; i++) if (RELAY_SETS[i].id === RL.set) return RELAY_SETS[i];
      return RELAY_SETS[0];
    }
    reg({
      id: 'relay', name: t('toolRelay', '릴레이', 'relay'),
      render: function (body) {
        var w = el('div', 'ftlWrap');
        var row = el('div', 'ftlRow');
        var sel = el('select', 'ftlGrow');
        RELAY_SETS.forEach(function (s) {
          var o = el('option', null, s.label);
          o.value = s.id;
          sel.appendChild(o);
        });
        sel.value = RL.set;
        sel.addEventListener('change', function () { RL.set = sel.value; });
        row.appendChild(sel);
        row.appendChild(btn(t('rlGen', '생성', 'generate'), 'primary', function () {
          RL.items = relaySet().evs.map(function (id) {
            var ev = Scrambler.byId(id);
            return { label: ev.name, scr: ev.gen(), done: false };
          });
          refreshTool('relay');
        }));
        w.appendChild(row);
        if (RL.items.length) {
          var list = el('div', 'ftlList');
          RL.items.forEach(function (it, i) {
            var item = el('label', 'ftlItem' + (it.done ? ' done' : ''));
            var cb = el('input');
            cb.type = 'checkbox'; cb.checked = it.done;
            cb.addEventListener('change', function () {
              it.done = cb.checked;
              item.classList.toggle('done', it.done);
            });
            item.appendChild(cb);
            item.appendChild(el('b', null, (i + 1) + '. ' + it.label));
            item.appendChild(el('span', 'ftlScr', it.scr));
            list.appendChild(item);
          });
          w.appendChild(list);
          w.appendChild(btn(t('rlCopy', '전체 복사', 'copy all'), 'ghost', function () {
            App.copyText(RL.items.map(function (it, i) {
              return (i + 1) + ') ' + it.label + ': ' + it.scr;
            }).join('\n'));
            App.toast(t('copied', '복사됨', 'copied'));
          }));
        } else {
          w.appendChild(el('div', 'ftlMuted ftlCenter',
            t('rlHint', '한 번의 타이머로 전부 풀어보세요', 'one timer run — solve them all')));
        }
        body.appendChild(w);
      }
    });

    /* =====================================================================
     * 86 + 87 — Scramble image zoom modal + PNG download
     * =================================================================== */
    var zoomCanvas = null, zoomScrEl = null;
    var zoomModal = App.registerModal('ftlZoomModal',
      t('zoomTitle', '스크램블 이미지', 'scramble image'),
      function (mbody) {
        zoomCanvas = document.createElement('canvas');
        zoomCanvas.id = 'ftlZoomCanvas';
        zoomCanvas.width = 640; zoomCanvas.height = 440;
        mbody.appendChild(zoomCanvas);
        zoomScrEl = el('pre', 'ftlPre ftlMuted');
        zoomScrEl.id = 'ftlZoomScr';
        mbody.appendChild(zoomScrEl);
        var btns = el('div', 'mbtns');
        btns.appendChild(btn(t('zoomCopy', '스크램블 복사', 'copy scramble'), 'ghost', function () {
          App.copyText(App.scrambleStr());
          App.toast(t('copied', '복사됨', 'copied'));
        }));
        btns.appendChild(btn('PNG', 'primary', downloadPNG));
        mbody.appendChild(btns);
      });
    function openZoom() {
      var ev = App.currentEvent();
      var mod = ev.img && window.ScrImage && window.ScrImage[ev.img];
      if (!mod || !mod.draw) {
        App.toast(t('zoomNoImg', '이 종목은 이미지가 없어요', 'no image for this event'), { type: 'error' });
        return;
      }
      zoomCanvas.width = 640; zoomCanvas.height = 440; // reset bitmap
      try { mod.draw(zoomCanvas, App.scrambleStr()); }
      catch (e) { console.error('[feat_tools] zoom draw', e); }
      zoomScrEl.textContent = App.scrambleStr();
      zoomModal.open();
    }
    function downloadPNG() {
      if (!zoomCanvas || !zoomCanvas.toBlob) return;
      zoomCanvas.toBlob(function (blob) {
        if (!blob) return;
        var a = document.createElement('a');
        var url = URL.createObjectURL(blob);
        a.href = url;
        a.download = 'scramble_' + App.currentEvent().id + '_' + dateKey() + '.png';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
      }, 'image/png');
    }
    var dock = document.getElementById('toolDock');
    if (dock) {
      dock.addEventListener('click', function (e) {
        var tgt = e.target;
        if (!tgt || tgt.tagName !== 'CANVAS') return;
        var tb = tgt.closest('.toolBody');
        if (!tb) return;
        var slot = tb.id === 'toolBody1' ? 1 : 0;
        if (App.options()['tool' + slot] !== 'image') return;
        openZoom();
      });
    }
    function syncZoomCursor() {
      [0, 1].forEach(function (slot) {
        var card = document.getElementById('toolCard' + slot);
        if (card) card.classList.toggle('ftlZoomable', App.options()['tool' + slot] === 'image');
      });
    }
    App.on('options', syncZoomCursor);
    App.on('render', syncZoomCursor);
    [0, 1].forEach(function (slot) {
      var sel = document.getElementById('toolSel' + slot);
      if (sel) sel.addEventListener('change', function () { setTimeout(syncZoomCursor, 0); });
    });
    syncZoomCursor();

    /* =====================================================================
     * 88 — Bulk scramble generator
     * =================================================================== */
    var BK = { count: 5, list: [], evId: '' };
    function bulkText() {
      return BK.list.map(function (s, i) { return (i + 1) + '. ' + s; }).join('\n');
    }
    reg({
      id: 'bulk', name: t('toolBulk', '대량 스크램블', 'bulk scrambles'),
      render: function (body) {
        var w = el('div', 'ftlWrap');
        var row = el('div', 'ftlRow');
        var inp = numInput(BK.count, 1, 100);
        inp.addEventListener('change', function () {
          var v = parseInt(inp.value, 10);
          if (!(v >= 1)) v = 1;
          if (v > 100) v = 100;
          BK.count = v; inp.value = v;
        });
        row.appendChild(inp);
        row.appendChild(btn(t('bkGen', '생성', 'generate'), 'primary ftlGrow', function () {
          var ev = App.currentEvent();
          if (ev.id === 'input') {
            App.toast(t('bkInput', '입력 스크램블 모드에선 생성할 수 없어요', 'not available for input scrambles'), { type: 'error' });
            return;
          }
          BK.count = Math.max(1, Math.min(100, parseInt(inp.value, 10) || 1));
          var len = App.options().scrLens[ev.id] || ev.defLen || undefined;
          BK.list = [];
          for (var i = 0; i < BK.count; i++) BK.list.push(ev.gen(len));
          BK.evId = ev.id;
          refreshTool('bulk');
        }));
        w.appendChild(row);
        if (BK.list.length) {
          var list = el('div', 'ftlList');
          BK.list.forEach(function (s, i) {
            var item = el('div', 'ftlItem');
            item.appendChild(el('b', null, (i + 1) + '.'));
            item.appendChild(el('span', 'ftlScr', s));
            list.appendChild(item);
          });
          w.appendChild(list);
          var row2 = el('div', 'ftlRow');
          row2.appendChild(btn(t('rlCopy', '전체 복사', 'copy all'), 'ghost ftlGrow', function () {
            App.copyText(bulkText());
            App.toast(t('copied', '복사됨', 'copied'));
          }));
          row2.appendChild(btn('.txt', 'ghost', function () {
            App.download('scrambles_' + BK.evId + '_' + BK.list.length + '.txt', bulkText(), 'text/plain');
          }));
          w.appendChild(row2);
        } else {
          w.appendChild(el('div', 'ftlMuted ftlCenter',
            t('bkHint', '현재 종목 스크램블을 한 번에 생성', 'generate current-event scrambles in bulk')));
        }
        body.appendChild(w);
      }
    });

    /* =====================================================================
     * 89 — Drill counter (repetition trainer, per-day persistence)
     * =================================================================== */
    var DRILL_KEY = 'cstc_pack_tools_drill';
    function drillLoad() {
      var o = { target: 50, counts: {} };
      try {
        var p = JSON.parse(lsGet(DRILL_KEY) || '');
        if (p && typeof p === 'object') {
          var tv = parseInt(p.target, 10);
          if (tv > 0) o.target = Math.min(tv, 9999);
          if (p.counts && typeof p.counts === 'object') o.counts = p.counts;
        }
      } catch (e) { }
      return o;
    }
    function drillSave(o) {
      var keys = Object.keys(o.counts).sort();
      while (keys.length > 14) delete o.counts[keys.shift()];
      lsSet(DRILL_KEY, JSON.stringify(o));
    }
    function drillBump(d) {
      var o = drillLoad(), k = dateKey();
      o.counts[k] = Math.max(0, (o.counts[k] || 0) + d);
      drillSave(o);
      return o.counts[k];
    }
    reg({
      id: 'drill', name: t('toolDrill', '드릴 카운터', 'drill counter'),
      render: function (body) {
        var o = drillLoad(), cnt = o.counts[dateKey()] || 0;
        var hit = cnt >= o.target;
        var w = el('div', 'ftlWrap');
        var c = el('div', 'ftlCount' + (hit ? ' hit' : ''), cnt + ' / ' + o.target);
        w.appendChild(c);
        w.appendChild(btn('+1', 'primary ftlWide', function () {
          var n = drillBump(1);
          var oo = drillLoad();
          if (n === oo.target) App.toast(t('drillDone', '드릴 목표 달성! 💪', 'drill target reached! 💪'), { type: 'success' });
          refreshTool('drill');
        }));
        var row = el('div', 'ftlRow');
        row.appendChild(el('span', 'ftlMuted ftlGrow', t('drillTarget', '목표', 'target')));
        var inp = numInput(o.target, 1, 9999);
        inp.addEventListener('change', function () {
          var v = parseInt(inp.value, 10);
          if (!(v > 0)) v = 50;
          var oo = drillLoad();
          oo.target = Math.min(v, 9999);
          drillSave(oo);
          refreshTool('drill');
        });
        row.appendChild(inp);
        row.appendChild(btn(t('drillReset', '리셋', 'reset'), 'danger', function () {
          var oo = drillLoad();
          oo.counts[dateKey()] = 0;
          drillSave(oo);
          refreshTool('drill');
        }));
        w.appendChild(row);
        w.appendChild(el('div', 'ftlMuted ftlCenter',
          t('drillHint', '솔브마다 자동 +1 · 버튼으로 수동 +1', 'auto +1 per solve · button for manual +1')));
        body.appendChild(w);
      }
    });
    App.on('solve', function () {
      drillBump(1);
      refreshTool('drill');
    });

    /* if a persisted option already points at one of our tools, the core
     * rendered its fallback before we registered — repaint those slots now */
    [0, 1].forEach(function (slot) {
      var id = App.options()['tool' + slot];
      if (MY[id]) refreshTool(id);
    });
  }

  if (App.db && App.db()) setup();
  else App.on('ready', setup);
})();
