/* feat_data.js — [data] feature pack for csTimer-clone (UPGRADES items 51–62)
 * 51 session color tags · 52 session memo · 53 archive · 54 auto-backup ·
 * 55 export current session · 56 merge import · 57 CSV import ·
 * 58 solve tags · 59 list search/filter · 60 trash bin ·
 * 61 storage usage meter · 62 date group headers.
 * Integrates ONLY via window.App (see API.md). No core edits.
 */
(function () {
  'use strict';
  if (!window.App) return;
  var App = window.App;
  var Stats = window.Stats;

  /* pack-private localStorage keys */
  var LS_BAK = 'cstc_pack_data_bak';     // auto-backup snapshots: [{t, db}]
  var LS_CNT = 'cstc_pack_data_bakcnt';  // solves counted since last snapshot
  var LS_OPT = 'cstc_pack_data_opts';    // pack options: {dateHeaders}
  var LS_CAP = 'cstc_pack_data_cap';     // measured localStorage ceiling, code units
  var LS_PROBE = 'cstc_pack_data_probe'; // transient headroom probe (never persists)

  function tr(key, ko, en) { return App.i18n(key, ko, en); }
  function $id(id) { return document.getElementById(id); }
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function btn(txt, cls, fn) {
    var b = el('button', cls || '', txt);
    b.type = 'button';
    if (fn) b.addEventListener('click', fn);
    return b;
  }
  function prec() { return App.options().precision; }

  /* pack options */
  var popts = {};
  try { popts = JSON.parse(localStorage.getItem(LS_OPT) || '{}') || {}; } catch (e) { popts = {}; }
  function savePopts() { try { localStorage.setItem(LS_OPT, JSON.stringify(popts)); } catch (e) { } }

  /* =============== styles (Toss tokens only; purple is not a core token) =============== */
  App.addCSS(
    'body{--cstcd-purple:#a05eeb;}' +
    '.cstcd-dot{display:inline-block;width:12px;height:12px;border-radius:50%;' +
    'background:transparent;border:2px solid var(--g400);vertical-align:-1px;}' +
    '.cstcd-dot.c-blue{background:var(--blue);border-color:transparent;}' +
    '.cstcd-dot.c-green{background:var(--green);border-color:transparent;}' +
    '.cstcd-dot.c-orange{background:var(--orange);border-color:transparent;}' +
    '.cstcd-dot.c-red{background:var(--red);border-color:transparent;}' +
    '.cstcd-dot.c-purple{background:var(--cstcd-purple);border-color:transparent;}' +
    'button.cstcd-on{background:var(--accent-weak);color:var(--accent);}' +
    '.cstcd-arch{opacity:.55;}' +
    '.cstcd-arch input[type="text"]{text-decoration:line-through;}' +
    '.cstcd-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap;}' +
    '.cstcd-tags{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:10px 0;}' +
    '.cstcd-chip{padding:5px 12px;border-radius:999px;background:var(--card2);color:var(--sub);' +
    'font-size:12px;font-weight:600;border:1px solid var(--line);}' +
    '.cstcd-chip.on{background:var(--accent-weak);color:var(--accent);border-color:transparent;}' +
    '.cstcd-taginp{padding:6px 10px;border-radius:10px;border:1px solid var(--line);' +
    'background:var(--card2);color:var(--fg);font-size:12px;min-width:130px;flex:1;}' +
    '.cstcd-list{max-height:300px;overflow:auto;margin-top:8px;}' +
    '.cstcd-item{display:flex;gap:8px;align-items:center;padding:8px 4px;' +
    'border-bottom:1px solid var(--line);font-size:13px;border-radius:8px;}' +
    '.cstcd-item:hover{background:var(--hover);}' +
    '.cstcd-item .t{font-weight:700;font-variant-numeric:tabular-nums;}' +
    '.cstcd-item .meta{color:var(--sub);font-size:11px;overflow:hidden;text-overflow:ellipsis;' +
    'white-space:nowrap;flex:1;min-width:0;}' +
    '.cstcd-sbar{flex:1;min-width:70px;max-width:140px;height:8px;border-radius:4px;' +
    'background:var(--card2);border:1px solid var(--line);overflow:hidden;}' +
    '.cstcd-sbar i{display:block;height:100%;width:0;background:var(--accent);border-radius:4px;' +
    'transition:width .3s ease;}' +
    '.cstcd-stext{color:var(--sub);font-size:11px;font-variant-numeric:tabular-nums;white-space:nowrap;}' +
    '#timeList tr.cstcd-dhead td{padding:8px 8px 3px;color:var(--sub);font-size:11px;font-weight:700;' +
    'text-align:left;border-bottom:1px solid var(--line);background:transparent;cursor:default;}' +
    '.cstcd-note{color:var(--sub);font-size:12px;line-height:1.5;margin:4px 0 8px;}'
  );

  /* =============== 51 · session colors =============== */
  var COLORS = ['', 'blue', 'green', 'orange', 'red', 'purple'];
  var COLOR_CSS = {
    blue: 'var(--blue)', green: 'var(--green)', orange: 'var(--orange)',
    red: 'var(--red)', purple: 'var(--cstcd-purple)'
  };

  function tintSessionSel() {
    var sel = $id('sessionSel');
    if (!sel) return;
    var db = App.db();
    for (var i = 0; i < sel.options.length; i++) {
      var s = db.sessions[sel.options[i].value];
      sel.options[i].style.color = (s && s.color && COLOR_CSS[s.color]) ? COLOR_CSS[s.color] : '';
    }
  }

  /* =============== 51/52/53 · session manager row hook =============== */
  App.on('sessMgrRow', function (row, id) {
    var db = App.db();
    var s = db.sessions[id];
    if (!s) return;
    var coreDel = row.lastElementChild; // core's ✕ button

    /* 51 — color dot cycling none→blue→green→orange→red→purple */
    var dot = el('span', 'cstcd-dot' + (s.color ? ' c-' + s.color : ''));
    var cbtn = btn('', 'icon ghost', function () {
      var i = COLORS.indexOf(s.color || '');
      var next = COLORS[(i + 1) % COLORS.length];
      if (next) s.color = next; else delete s.color;
      dot.className = 'cstcd-dot' + (next ? ' c-' + next : '');
      App.save();
      App.refresh(); // re-renders dropdown ('● ' prefix) + our tint via 'render'
    });
    cbtn.title = tr('sColor', '세션 색상', 'session color');
    cbtn.appendChild(dot);
    row.insertBefore(cbtn, row.firstChild);

    /* 52 — memo */
    var mbtn = btn('📝', 'icon ghost' + (s.memo ? ' cstcd-on' : ''), function () {
      openMemo(id, mbtn);
    });
    mbtn.title = tr('sMemo', '세션 메모', 'session memo');
    row.insertBefore(mbtn, coreDel);

    /* 53 — archive toggle (archived sessions stay listed here, dimmed) */
    if (s.archived) row.classList.add('cstcd-arch');
    var abtn = btn('🗄', 'icon ghost' + (s.archived ? ' cstcd-on' : ''), function () {
      if (!s.archived && App.db().current === id) {
        App.toast(tr('sArchCur', '현재 사용 중인 세션은 보관할 수 없어요', 'cannot archive the current session'), { type: 'error' });
        return;
      }
      if (s.archived) delete s.archived; else s.archived = true;
      row.classList.toggle('cstcd-arch', !!s.archived);
      abtn.classList.toggle('cstcd-on', !!s.archived);
      abtn.title = s.archived ? tr('sUnarch', '보관 해제', 'unarchive') : tr('sArch', '보관(드롭다운에서 숨김)', 'archive (hide from dropdown)');
      App.save();
      App.refresh(); // dropdown skips archived sessions
      App.toast(s.archived ? tr('sArchDone', '세션을 보관했어요', 'session archived') : tr('sUnarchDone', '보관을 해제했어요', 'session unarchived'));
    });
    abtn.title = s.archived ? tr('sUnarch', '보관 해제', 'unarchive') : tr('sArch', '보관(드롭다운에서 숨김)', 'archive (hide from dropdown)');
    row.insertBefore(abtn, coreDel);
  });

  /* 52 — memo modal (built once, bound per session on open) */
  var memoModal = null, memoTa = null, memoTarget = null, memoBtnRef = null;

  function hideOwnModal(id) {
    var m = $id(id);
    if (m) m.classList.remove('show'); // keep underlying modals (session mgr / options) open
  }

  function openMemo(id, btnRef) {
    var s = App.db().sessions[id];
    if (!s || !memoModal) return;
    memoTarget = id;
    memoBtnRef = btnRef || null;
    memoModal.titleEl.textContent = tr('memoTitle', '세션 메모', 'session memo') + ' — ' + s.name;
    memoTa.value = s.memo || '';
    memoModal.open();
    memoTa.focus();
  }

  /* =============== 54 · auto-backup =============== */
  function readBaks() {
    try {
      var a = JSON.parse(localStorage.getItem(LS_BAK) || '[]');
      return Array.isArray(a) ? a : [];
    } catch (e) { return []; }
  }
  function takeSnapshot() {
    var baks = readBaks();
    baks.unshift({ t: Date.now(), db: App.db() }); // serialized on stringify
    if (baks.length > 3) baks.length = 3;          // keep newest 3
    try { localStorage.setItem(LS_BAK, JSON.stringify(baks)); }
    catch (e) { /* quota exceeded — skip silently, meter (61) shows pressure */ }
  }
  App.on('solve', function () {
    var n = (parseInt(localStorage.getItem(LS_CNT) || '0', 10) || 0) + 1;
    if (n >= 20) { takeSnapshot(); n = 0; }
    try { localStorage.setItem(LS_CNT, String(n)); } catch (e) { }
    updateStorageSoon();
  });

  /* A snapshot's .db is untrusted: readBaks() only Array.isArray's the outer list,
   * and takeSnapshot's setItem can be truncated/fail mid-quota. Validate into a
   * fresh object BEFORE anything destructive runs; null = refuse the restore. */
  function normalizeDB(raw) {
    if (!raw || typeof raw !== 'object' || !raw.sessions || typeof raw.sessions !== 'object') return null;
    var out = { sessions: {}, order: [], current: null, options: {} };
    Object.keys(raw.sessions).forEach(function (id) {
      var src = raw.sessions[id];
      if (!src || typeof src !== 'object') return;
      var s = {
        name: String(src.name || 'session'),
        event: validEvent(src.event),
        solves: sanitizeSolves(src.solves),
        created: src.created || Math.floor(Date.now() / 1000)
      };
      if (src.color && COLOR_CSS[src.color]) s.color = src.color;
      if (src.memo) s.memo = String(src.memo);
      if (src.archived) s.archived = true;
      if (Array.isArray(src.trash)) s.trash = src.trash.slice(0, 50);
      out.sessions[id] = s;
    });
    var ids = Object.keys(out.sessions);
    if (!ids.length) return null; // a DB with no usable session is not a restore, it's a wipe
    var order = Array.isArray(raw.order) ? raw.order.filter(function (id) { return out.sessions[id]; }) : [];
    ids.forEach(function (id) { if (order.indexOf(id) < 0) order.push(id); });
    out.order = order;
    out.current = out.sessions[raw.current] ? raw.current : order[0];
    if (raw.options && typeof raw.options === 'object') out.options = raw.options;
    return out;
  }

  function totalSolvesOf(db) {
    var n = 0;
    if (db && db.sessions) {
      Object.keys(db.sessions).forEach(function (k) {
        n += (db.sessions[k].solves || []).length;
      });
    }
    return n;
  }

  var bakModal = null, bakBody = null;
  function renderBackups() {
    if (!bakBody) return;
    bakBody.innerHTML = '';
    bakBody.appendChild(el('div', 'cstcd-note',
      tr('bakNote', '20솔브마다 자동 저장 · 최신 3개 보관', 'auto-saved every 20 solves · newest 3 kept')));
    var baks = readBaks();
    if (!baks.length) {
      bakBody.appendChild(el('div', 'cstcd-note', tr('bakEmpty', '아직 백업이 없어요.', 'no backups yet.')));
    }
    baks.forEach(function (b) {
      var row = el('div', 'cstcd-item');
      row.appendChild(el('span', 't', new Date(b.t).toLocaleString()));
      row.appendChild(el('span', 'meta', totalSolvesOf(b.db) + tr('bakSolves', '개 기록', ' solves')));
      var rb = btn(tr('bakRestore', '복원', 'restore'), 'primary', function () {
        App.confirm(
          tr('bakConfirm', '현재 데이터를 이 백업으로 되돌릴까요? 페이지가 새로고침됩니다.',
            'replace current data with this backup? the page will reload.'),
          function () {
            // validate FIRST — a bad snapshot must leave the live DB untouched
            var next = normalizeDB(b.db);
            if (!next) {
              App.toast(tr('bakBad', '이 백업은 손상되어 복원할 수 없어요',
                'this backup is damaged and cannot be restored'), { type: 'error' });
              return;
            }
            takeSnapshot(); // make the regretted restore undoable
            var db = App.db();
            Object.keys(db).forEach(function (k) { delete db[k]; });
            Object.keys(next).forEach(function (k) { db[k] = next[k]; });
            App.save();
            setTimeout(function () { location.reload(); }, 400); // wait out debounced save
          });
      });
      row.appendChild(rb);
      bakBody.appendChild(row);
    });
    var now = btn(tr('bakNow', '지금 백업', 'back up now'), 'ghost', function () {
      takeSnapshot(); updateStorageSoon(); renderBackups();
      App.toast(tr('bakDone', '백업 저장됨', 'backup saved'), { type: 'success' });
    });
    now.style.marginTop = '10px';
    bakBody.appendChild(now);
  }

  /* =============== 55 · export current session =============== */
  function exportCurrentSession() {
    var s = App.session();
    App.download(
      'session_' + String(s.name).replace(/\W+/g, '_') + '.json',
      JSON.stringify({ app: 'cstimer-clone-session', session: s }, null, 1));
    App.toast(tr('sesExpDone', '현재 세션을 내보냈어요', 'current session exported'), { type: 'success' });
  }

  /* =============== 56 · merge import =============== */
  function newSessionId(db) {
    var base = 'm' + Date.now().toString(36);
    var id = base, n = 0;
    while (db.sessions[id]) id = base + (++n);
    return id;
  }
  function validEvent(ev) {
    ev = String(ev || '333');
    try {
      if (window.Scrambler && window.Scrambler.byId(ev).id !== ev) ev = '333';
    } catch (e) { ev = '333'; }
    return ev;
  }
  function sanitizeSolves(a) {
    if (!Array.isArray(a)) return [];
    var out = [];
    a.forEach(function (sv) {
      if (!Array.isArray(sv) || !Array.isArray(sv[0])) return;
      var t = [sv[0].slice(), String(sv[1] || ''), String(sv[2] || ''), sv[3] || 0];
      if (sv[4] && typeof sv[4] === 'object') t.push(sv[4]);
      out.push(t);
    });
    return out;
  }
  function mergeImport(text) {
    var data;
    try { data = JSON.parse(text); }
    catch (e) { App.toast(tr('impBadJson', '잘못된 JSON', 'invalid JSON'), { type: 'error' }); return; }
    var list = [];
    if (data && data.app === 'cstimer-clone-session' && data.session) {
      list = [data.session];
    } else if (data && data.app === 'cstimer-clone' && data.sessions) {
      var ids = (data.order && data.order.length) ? data.order : Object.keys(data.sessions);
      ids.forEach(function (k) { if (data.sessions[k]) list.push(data.sessions[k]); });
    }
    if (!list.length) {
      App.toast(tr('impNoSess', '병합할 세션을 찾지 못했어요', 'no sessions found to merge'), { type: 'error' });
      return;
    }
    var db = App.db();
    var added = 0;
    list.forEach(function (src) {
      var id = newSessionId(db);
      var s = {
        name: String(src.name || 'session') + tr('impSuffix', ' (가져옴)', ' (imported)'),
        event: validEvent(src.event),
        solves: sanitizeSolves(src.solves),
        created: src.created || Math.floor(Date.now() / 1000)
      };
      if (src.color && COLOR_CSS[src.color]) s.color = src.color;
      if (src.memo) s.memo = String(src.memo);
      if (src.archived) s.archived = true;
      if (Array.isArray(src.trash)) s.trash = src.trash.slice(0, 50);
      db.sessions[id] = s;
      db.order.push(id);
      added++;
    });
    App.save();
    App.refresh();
    App.toast(added + tr('impMerged', '개 세션을 병합했어요', ' sessions merged'), { type: 'success' });
  }
  function pickFile(accept, onText) {
    var inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = accept;
    inp.addEventListener('change', function () {
      var f = inp.files[0];
      if (!f) return;
      var fr = new FileReader();
      fr.onload = function () { onText(String(fr.result)); };
      fr.readAsText(f);
    });
    inp.click();
  }

  /* =============== 57 · CSV import =============== */
  function csvCells(line, d) {
    var out = [], cur = '', q = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line.charAt(i);
      if (q) {
        if (ch === '"') {
          if (line.charAt(i + 1) === '"') { cur += '"'; i++; }
          else q = false;
        } else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === d) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out;
  }
  // a cell that plausibly holds a time: "12.34", "1:02.34", "DNF(12.34)", "14.34+"
  function timeLike(c) {
    c = String(c == null ? '' : c).trim();
    if (!c || /^\d{4}-\d{2}-\d{2}/.test(c)) return false; // exclude ISO dates
    return /[.:]/.test(c) || /dnf/i.test(c);
  }
  function parseDateCell(c) {
    c = String(c == null ? '' : c).trim();
    if (!/^\d{4}-\d{2}-\d{2}/.test(c)) return 0;
    var t = Date.parse(c);
    return isNaN(t) ? 0 : Math.floor(t / 1000);
  }
  function importCSVText(text) {
    var lines = String(text || '').split(/\r\n|\r|\n/).filter(function (l) { return l.trim(); });
    if (!lines.length) {
      App.toast(tr('csvEmpty', '빈 CSV 파일이에요', 'empty CSV file'), { type: 'error' });
      return;
    }
    var d = (lines[0].split(';').length >= lines[0].split(',').length) ? ';' : ',';
    var start = 0, timeCol = -1, scrCol = -1, dateCol = -1, cmtCol = -1;
    var first = csvCells(lines[0], d);
    var firstHasTime = first.some(function (c) { return timeLike(c) && Stats.parseTime(String(c).trim()); });
    if (!firstHasTime) { // header row — map named columns when possible
      start = 1;
      first.forEach(function (c, i) {
        var lc = String(c).toLowerCase();
        if (timeCol < 0 && lc.indexOf('time') >= 0) timeCol = i;
        if (scrCol < 0 && lc.indexOf('scramble') >= 0) scrCol = i;
        if (dateCol < 0 && lc.indexOf('date') >= 0) dateCol = i;
        if (cmtCol < 0 && (lc.indexOf('comment') >= 0 || lc.indexOf('memo') >= 0)) cmtCol = i;
      });
    }
    var solves = App.solves(); // current session
    var n = 0;
    for (var i = start; i < lines.length; i++) {
      var cells = csvCells(lines[i], d);
      var r = null;
      if (timeCol >= 0 && cells[timeCol] != null && timeLike(cells[timeCol])) {
        r = Stats.parseTime(String(cells[timeCol]).trim());
      }
      if (!r) {
        for (var j = 0; j < cells.length; j++) {
          if (!timeLike(cells[j])) continue;
          r = Stats.parseTime(String(cells[j]).trim());
          if (r) break;
        }
      }
      if (!r) continue;
      var ts = 0;
      if (dateCol >= 0) ts = parseDateCell(cells[dateCol]);
      if (!ts) {
        for (var k = 0; k < cells.length; k++) {
          ts = parseDateCell(cells[k]);
          if (ts) break;
        }
      }
      solves.push([[r[0], r[1]],
        scrCol >= 0 ? String(cells[scrCol] || '').trim() : '',
        cmtCol >= 0 ? String(cells[cmtCol] || '').trim() : '',
        ts]);
      n++;
    }
    if (n) { App.save(); App.refresh(); }
    App.toast(n
      ? n + tr('csvDone', '개 기록을 가져왔어요', ' solves imported')
      : tr('csvNone', '가져올 시간을 찾지 못했어요', 'no times found in CSV'),
      { type: n ? 'success' : 'error' });
  }
  App.on('importCSV', importCSVText); // core emits when a .csv is picked in its import file input

  /* =============== 58 · solve tags =============== */
  var PRESET_TAGS = ['OLL skip', 'PLL skip', 'lucky', 'mistake'];
  function tagsOf(sv) {
    return (sv && sv[4] && typeof sv[4] === 'object' && !Array.isArray(sv[4]) && Array.isArray(sv[4].tags))
      ? sv[4].tags : [];
  }
  function toggleTag(index, tag) {
    App.updateSolve(index, function (sv) {
      // solve[4] is a shared extras object — create if missing, PRESERVE other keys
      if (!sv[4] || typeof sv[4] !== 'object' || Array.isArray(sv[4])) sv[4] = {};
      if (!Array.isArray(sv[4].tags)) sv[4].tags = [];
      var i = sv[4].tags.indexOf(tag);
      if (i >= 0) sv[4].tags.splice(i, 1);
      else sv[4].tags.push(tag);
      if (!sv[4].tags.length) {
        delete sv[4].tags;
        if (!Object.keys(sv[4]).length && sv.length === 5) sv.length = 4; // drop empty extras
      }
    });
  }
  App.on('timeModalOpen', function (container, index) {
    // own wrapper: never wipe #tmExtra itself (other packs render there too)
    var wrap = el('div', 'cstcd-tags');
    container.appendChild(wrap);
    (function draw() {
      wrap.innerHTML = '';
      var sv = App.solves()[index];
      if (!sv) return;
      var tags = tagsOf(sv);
      var all = PRESET_TAGS.concat(tags.filter(function (t) { return PRESET_TAGS.indexOf(t) < 0; }));
      all.forEach(function (tag) {
        var chip = btn(tag, 'cstcd-chip' + (tags.indexOf(tag) >= 0 ? ' on' : ''), function () {
          toggleTag(index, tag);
          draw();
        });
        wrap.appendChild(chip);
      });
      var inp = el('input', 'cstcd-taginp');
      inp.type = 'text';
      inp.placeholder = tr('tagAdd', '태그 입력 후 Enter', 'add tag + Enter');
      inp.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        e.stopPropagation();
        var v = inp.value.trim();
        if (!v) return;
        if (tagsOf(App.solves()[index]).indexOf(v) < 0) toggleTag(index, v);
        draw();
      });
      wrap.appendChild(inp);
    })();
  });

  /* =============== 59 · search / filter modal (+ 60 trash from rows) =============== */
  var filterModal = null, fText = null, fPen = null, fTag = null, fCount = null, fList = null;

  function allTags() {
    var seen = {}, out = [];
    App.solves().forEach(function (sv) {
      tagsOf(sv).forEach(function (t) {
        if (!seen[t]) { seen[t] = 1; out.push(t); }
      });
    });
    return out;
  }
  function fillTagSel() {
    if (!fTag) return;
    var cur = fTag.value;
    fTag.innerHTML = '';
    var o0 = el('option', '', tr('fTagAll', '태그: 전체', 'tag: all'));
    o0.value = '';
    fTag.appendChild(o0);
    allTags().forEach(function (t) {
      var o = el('option', '', t);
      o.value = t;
      fTag.appendChild(o);
    });
    fTag.value = cur;
    if (fTag.selectedIndex < 0) fTag.selectedIndex = 0;
  }
  function renderResults() {
    if (!fList) return;
    fList.innerHTML = '';
    var solves = App.solves();
    var p = prec();
    var q = fText.value.trim().toLowerCase();
    var pen = fPen.value;   // '' | '2' | 'dnf'
    var tag = fTag.value;
    var res = [];
    for (var i = solves.length - 1; i >= 0; i--) {
      var sv = solves[i];
      if (q && (String(sv[2] || '') + ' ' + String(sv[1] || '')).toLowerCase().indexOf(q) < 0) continue;
      if (pen === '2' && sv[0][0] !== 2000) continue;
      if (pen === 'dnf' && sv[0][0] !== Stats.DNF) continue;
      if (tag && tagsOf(sv).indexOf(tag) < 0) continue;
      res.push(i);
    }
    fCount.textContent = res.length + ' / ' + solves.length;
    if (!res.length) {
      fList.appendChild(el('div', 'cstcd-note', tr('fNone', '결과가 없어요.', 'no matches.')));
      return;
    }
    res.slice(0, 200).forEach(function (i) {
      var sv = solves[i];
      var row = el('div', 'cstcd-item');
      row.style.cursor = 'pointer';
      row.appendChild(el('span', '', String(i + 1) + '.'));
      row.appendChild(el('span', 't', Stats.solveToString(sv, p)));
      var meta = tagsOf(sv).join(', ');
      if (sv[2]) meta += (meta ? ' · ' : '') + sv[2];
      row.appendChild(el('span', 'meta', meta));
      var del = btn('🗑', 'icon ghost', function (e) {
        e.stopPropagation();
        moveToTrash(i);
        fillTagSel();
        renderResults();
      });
      del.title = tr('fTrash', '휴지통으로 이동', 'move to trash');
      row.appendChild(del);
      row.addEventListener('click', function (e) {
        if (e.target.closest('button')) return;
        App.closeModals();
        App.openTimeModal(i);
      });
      fList.appendChild(row);
    });
    if (res.length > 200) {
      fList.appendChild(el('div', 'cstcd-note', tr('fMore', '상위 200개만 표시', 'showing first 200 only')));
    }
  }

  /* =============== 60 · trash bin =============== */
  /* NOTE: core's own delete (time-modal delete / quick-bar delete / App.deleteSolve)
   * ships its own undo-toast and exposes no deletion event, so those deletions do
   * NOT pass through this bin. The bin collects solves removed via this pack's UI
   * (the 🗑 buttons in the filter modal), max 50 per session, stored on
   * session.trash so it serializes with the core export automatically. */
  function moveToTrash(i) {
    var s = App.session();
    var sv = s.solves[i];
    if (!sv) return;
    s.solves.splice(i, 1);
    if (!Array.isArray(s.trash)) s.trash = [];
    s.trash.unshift({ t: Math.floor(Date.now() / 1000), solve: sv });
    if (s.trash.length > 50) s.trash.length = 50;
    App.save();
    App.refresh();
    App.toast(tr('trashMoved', '휴지통으로 이동했어요', 'moved to trash'));
  }

  var trashModal = null, trashBody = null;
  function renderTrash() {
    if (!trashBody) return;
    trashBody.innerHTML = '';
    trashBody.appendChild(el('div', 'cstcd-note',
      tr('trashNote', '이 팩의 🗑 버튼으로 지운 기록만 담겨요 (세션당 최대 50개). 코어의 삭제는 자체 되돌리기 토스트를 써요.',
        'holds solves deleted via this pack\'s 🗑 buttons (max 50 per session). core deletions use their own undo toast.')));
    var s = App.session();
    var list = Array.isArray(s.trash) ? s.trash : [];
    if (!list.length) {
      trashBody.appendChild(el('div', 'cstcd-note', tr('trashEmpty', '휴지통이 비어 있어요.', 'trash is empty.')));
      return;
    }
    var p = prec();
    list.forEach(function (entry, idx) {
      var sv = entry && entry.solve;
      if (!sv) return;
      var row = el('div', 'cstcd-item');
      row.appendChild(el('span', 't', Stats.solveToString(sv, p)));
      row.appendChild(el('span', 'meta',
        (sv[3] ? new Date(sv[3] * 1000).toLocaleString() : '—') +
        (entry.t ? ' · ' + tr('trashAt', '삭제: ', 'deleted: ') + new Date(entry.t * 1000).toLocaleString() : '')));
      row.appendChild(btn(tr('trashRestore', '복원', 'restore'), 'primary', function () {
        var s2 = App.session();
        if (!Array.isArray(s2.trash)) return;
        s2.trash.splice(idx, 1);
        s2.solves.push(sv);
        App.save();
        App.refresh();
        renderTrash();
        App.toast(tr('trashRestored', '기록을 복원했어요', 'solve restored'), { type: 'success' });
      }));
      row.appendChild(btn('✕', 'icon danger', function () {
        var s2 = App.session();
        if (!Array.isArray(s2.trash)) return;
        s2.trash.splice(idx, 1);
        App.save();
        renderTrash();
        App.toast(tr('trashGone', '완전히 삭제했어요', 'deleted forever'));
      }));
      trashBody.appendChild(row);
    });
  }

  /* =============== 61 · storage usage =============== */
  var sbarFill = null, sbarText = null, storageTimer = null, sbarWarn = null;

  /* Quota accounting is in UTF-16 CODE UNITS, which is what k.length + value.length
   * already yields — but how many bytes an engine charges per code unit differs
   * (Chromium: budget is ~5M code units regardless of ASCII/non-ASCII; WebKit
   * charges 2 bytes/unit, so the same 5MB budget holds only ~2.6M units). Rather
   * than guess the engine, measure the real ceiling once by probing actual
   * headroom, and cache it. FALLBACK_CAP only applies if probing is impossible. */
  var FALLBACK_CAP = 5 * 1024 * 1024;
  var capUnits = null;

  function scanUsed() {
    var used = 0;
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf('cstc_') === 0 && k !== LS_PROBE) {
        used += k.length + (localStorage.getItem(k) || '').length;
      }
    }
    return used;
  }
  // largest blob that still fits, found by binary search on a temp key; the probe is
  // synchronous so nothing can observe the transient fill, and it is always removed.
  function probeHeadroom() {
    var lo = 0, hi = 8 * 1024 * 1024, mid;
    try {
      while (hi - lo > 4096) {
        mid = Math.floor((lo + hi) / 2);
        try { localStorage.setItem(LS_PROBE, new Array(mid + 1).join('a')); lo = mid; }
        catch (e) { hi = mid; }
        try { localStorage.removeItem(LS_PROBE); } catch (e) { }
      }
    } finally {
      try { localStorage.removeItem(LS_PROBE); } catch (e) { }
    }
    return lo;
  }
  function storageCap() {
    if (capUnits) return capUnits;
    try {
      var cached = parseInt(localStorage.getItem(LS_CAP) || '0', 10);
      if (cached > 0) { capUnits = cached; return capUnits; }
      var total = scanUsed() + probeHeadroom();
      if (total > 0) {
        capUnits = total;
        try { localStorage.setItem(LS_CAP, String(total)); } catch (e) { }
        return capUnits;
      }
    } catch (e) { }
    capUnits = FALLBACK_CAP;
    return capUnits;
  }
  // code units -> a size the user recognises, at this engine's real charge rate
  function fmtUnits(n) {
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(2) + ' MB';
  }
  function exportWholeDB() {
    App.download('cstimer-clone-backup.json',
      JSON.stringify({ app: 'cstimer-clone', sessions: App.db().sessions, order: App.db().order }, null, 1));
  }
  function updateStorageBar() {
    if (!sbarFill) return;
    var used = 0, cap = FALLBACK_CAP;
    try { used = scanUsed(); cap = storageCap(); } catch (e) { }
    var pct = Math.min(100, used / cap * 100);
    sbarFill.style.width = pct.toFixed(1) + '%';
    // >=80% is the cliff: go red and offer the one action that actually helps
    var hot = pct >= 80;
    sbarFill.style.background = hot ? 'var(--red)' : 'var(--accent)';
    sbarText.textContent = fmtUnits(used) + ' / ' + fmtUnits(cap);
    if (sbarWarn) sbarWarn.style.display = hot ? '' : 'none';
  }
  function updateStorageSoon() {
    if (storageTimer) clearTimeout(storageTimer);
    storageTimer = setTimeout(updateStorageBar, 350); // after core's debounced save
  }
  App.on('solvesChanged', updateStorageSoon);
  App.on('options', updateStorageSoon);

  /* =============== 62 · date group headers =============== */
  function injectDateHeaders() {
    var table = $id('timeList');
    if (!table) return;
    var solves = App.solves();
    var rows = table.querySelectorAll('tr[data-i]');
    var last = null;
    for (var r = 0; r < rows.length; r++) {
      var i = parseInt(rows[r].getAttribute('data-i'), 10);
      var sv = solves[i];
      var ds = (sv && sv[3]) ? new Date(sv[3] * 1000).toLocaleDateString() : '—';
      if (ds !== last) {
        last = ds;
        var htr = el('tr', 'cstcd-dhead'); // no data-i → core's click handler ignores it
        var td = el('td', '', ds);
        td.colSpan = 4;
        htr.appendChild(td);
        rows[r].parentNode.insertBefore(htr, rows[r]);
      }
    }
  }
  App.on('render', function () {
    if (popts.dateHeaders) injectDateHeaders(); // only when option on (core wipes old headers each render)
    tintSessionSel();
  });

  /* =============== UI build (after core init, so i18n language is loaded) =============== */
  function buildUI() {
    /* 52 — memo modal */
    memoModal = App.registerModal('cstcdMemoModal', tr('memoTitle', '세션 메모', 'session memo'), function (body) {
      memoTa = el('textarea');
      memoTa.rows = 5;
      memoTa.placeholder = tr('memoPh', '이 세션에 대한 메모…', 'notes about this session…');
      memoTa.style.width = '100%';
      var btns = el('div', 'mbtns');
      btns.appendChild(btn(tr('memoSave', '저장', 'save'), 'primary', function () {
        var s = memoTarget != null ? App.db().sessions[memoTarget] : null;
        if (s) {
          var v = memoTa.value.trim();
          if (v) s.memo = v; else delete s.memo;
          App.save();
          if (memoBtnRef) memoBtnRef.classList.toggle('cstcd-on', !!s.memo);
          App.toast(tr('memoSaved', '메모 저장됨', 'memo saved'), { type: 'success' });
        }
        hideOwnModal('cstcdMemoModal'); // keep session manager open underneath
      }));
      body.appendChild(memoTa);
      body.appendChild(btns);
    });

    /* 54 — backups modal */
    bakModal = App.registerModal('cstcdBakModal', tr('bakTitle', '자동 백업', 'auto backups'), function (body) {
      bakBody = body;
    });

    /* 60 — trash modal */
    trashModal = App.registerModal('cstcdTrashModal', tr('trashTitle', '휴지통 (현재 세션)', 'trash (current session)'), function (body) {
      trashBody = body;
    });

    /* 59 — filter modal + menu button */
    filterModal = App.registerModal('cstcdFilterModal', tr('fTitle', '기록 검색 · 필터', 'search & filter'), function (body) {
      var top = el('div', 'cstcd-row');
      fText = el('input', 'cstcd-taginp');
      fText.type = 'text';
      fText.placeholder = tr('fSearch', '코멘트·스크램블 검색', 'search comment / scramble');
      fText.addEventListener('input', renderResults);
      fPen = el('select');
      [['', tr('fPenAll', '페널티: 전체', 'penalty: all')], ['2', '+2'], ['dnf', 'DNF']].forEach(function (o) {
        var op = el('option', '', o[1]);
        op.value = o[0];
        fPen.appendChild(op);
      });
      fPen.addEventListener('change', renderResults);
      fTag = el('select');
      fTag.addEventListener('change', renderResults);
      top.appendChild(fText);
      top.appendChild(fPen);
      top.appendChild(fTag);
      fCount = el('div', 'cstcd-note');
      fList = el('div', 'cstcd-list');
      body.appendChild(top);
      body.appendChild(fCount);
      body.appendChild(fList);
    });
    App.registerMenuButton({
      icon: '⌕',
      title: tr('fBtn', '기록 검색', 'search solves'),
      onClick: function () {
        fillTagSel();
        renderResults();
        filterModal.open();
        fText.focus();
      }
    });

    /* 54/55/57/60 — buttons + 61 storage meter in settings ▸ data */
    App.registerOptionRow('optPgData', function (pg) {
      var row = el('div', 'orow');
      row.appendChild(el('span', '', tr('dPack', '데이터 도구', 'data tools')));
      var g = el('div', 'cstcd-row');
      g.style.justifyContent = 'flex-end';
      g.appendChild(btn(tr('dBak', '백업…', 'backups…'), '', function () { renderBackups(); bakModal.open(); }));
      g.appendChild(btn(tr('dExpSes', '현재 세션 내보내기', 'export current session'), '', exportCurrentSession));
      g.appendChild(btn(tr('dCsv', 'CSV 가져오기…', 'import CSV…'), '', function () {
        pickFile('.csv,text/csv', importCSVText);
      }));
      g.appendChild(btn(tr('dTrash', '휴지통…', 'trash…'), '', function () { renderTrash(); trashModal.open(); }));
      row.appendChild(g);
      pg.appendChild(row);

      var srow = el('div', 'orow');
      srow.appendChild(el('span', '', tr('dStorage', '저장 용량', 'storage used')));
      var sg = el('div', 'cstcd-row');
      sg.style.flex = '0 1 240px';
      sg.style.justifyContent = 'flex-end';
      var bar = el('div', 'cstcd-sbar');
      sbarFill = el('i');
      bar.appendChild(sbarFill);
      sbarText = el('span', 'cstcd-stext');
      sg.appendChild(bar);
      sg.appendChild(sbarText);
      sbarWarn = btn(tr('dExpAll', '데이터 내보내기', 'export your data'), 'primary', exportWholeDB);
      sbarWarn.style.display = 'none';
      sg.appendChild(sbarWarn);
      srow.appendChild(sg);
      pg.appendChild(srow);
      updateStorageBar();
    });

    /* 62 — toggle in settings ▸ statistics */
    App.registerOptionRow('optPgStats', function (pg) {
      var lab = el('label', 'orow');
      lab.appendChild(el('span', '', tr('dHead', '목록에 날짜 구분', 'date headers in list')));
      var sw = el('span', 'tswitch');
      var cb = el('input');
      cb.type = 'checkbox';
      cb.checked = !!popts.dateHeaders;
      cb.addEventListener('change', function () {
        popts.dateHeaders = cb.checked;
        savePopts();
        App.refresh(); // re-render list; headers injected on 'render'
      });
      sw.appendChild(cb);
      sw.appendChild(el('i'));
      lab.appendChild(sw);
      pg.appendChild(lab);
    });

    /* 56 — merge import button in the export modal */
    var eb = $id('expExtraBtns');
    if (eb) {
      eb.appendChild(btn(tr('impMergeBtn', '가져오기 (병합)', 'import (merge)'), '', function () {
        pickFile('.json,.txt,application/json', mergeImport);
      }));
    }

    /* keep the storage meter fresh whenever settings are opened */
    var bo = $id('btnOptions');
    if (bo) bo.addEventListener('click', updateStorageBar);

    tintSessionSel();
    updateStorageBar();
  }

  if (App.db()) buildUI();
  else App.on('ready', buildUI);
})();
