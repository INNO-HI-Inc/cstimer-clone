# App Plugin API (window.App) — for feature packs

Feature packs are standalone scripts `js/feat_*.js` loaded AFTER `app.js`.
They must NOT edit core files. All integration goes through `window.App`.
Inject your own CSS with `App.addCSS(cssString)`.

## Data access
- `App.db()` → whole DB object `{sessions, order, current, options}` (mutable; call `App.save()` after edits)
- `App.session()` → current session `{name, event, solves, created, ...}` (packs may add fields)
- `App.solves()` → current session solves array. Solve = `[[pen, ms, splits?], scramble, comment, tsSec, extra?]`, pen: 0 | 2000 | -1(DNF)
- `App.options()` → options object; `App.setOption(key, value)` (saves + re-applies + emits 'options')
- `App.save()` → persist DB (debounced)
- `App.refresh()` → re-render stats/list/tools

## Stats helpers (window.Stats)
- `Stats.timeOf(solve)` ms or Infinity, `Stats.timeToString(ms, decimals)`, `Stats.solveToString(solve, decimals)`
- `Stats.averageOf(solves, endIdx, n)`, `Stats.bestAverage(solves, n)`, `Stats.meanOf`, `Stats.sessionSummary(solves)`, `Stats.parseTime(str)`
- `App.fmt(ms)` → format with current precision

## Scramble
- `window.Scrambler.events` list, `Scrambler.byId(id)`, event `.gen(len)`
- `App.currentEvent()` → event object; `App.scrambleStr()` → current scramble text
- `App.newScramble()` → advance to a fresh scramble
- `window.ScrImage[imgKey].draw(canvas, scramble)` — imgKey from `event.img` ('333','pyr','skb','sq1','clk','mgm',...)

## Events (subscribe: `App.on(name, fn)`)
- `'solve'` (solve, index) — after a solve is added
- `'solvesChanged'` () — any add/edit/delete/clear
- `'sessionChanged'` () — current session switched (or event changed)
- `'scramble'` (str) — new scramble shown
- `'render'` () — after stats re-render
- `'pb'` ({type:'single'|'ao5'|'ao12', value}) — new session best
- `'options'` () — options changed

## UI integration
- `App.registerTool({id, name, render(container, slotIndex), onHide?})` — adds an entry to BOTH tool-slot selects. `render` is called each time the tool becomes visible or must repaint; build DOM inside `container` (a div ~ 300x210). Re-render on your own events as needed.
- `App.registerOptionRow(pageId, buildFn)` — pageId in `'optPgTimer'|'optPgDisplay'|'optPgScramble'|'optPgStats'|'optPgData'|'optPgAbout'`; buildFn(container) appends one or more `.orow` rows.
- `App.registerMenuButton({icon, title, onClick})` — small icon button in the left header (icon = short text/emoji/entity)
- `App.registerModal(id, title, buildFn)` → returns `{open(), close(), body}` — Toss-style modal shell
- `App.toast(msg, opts?)` — Toss-style toast; opts `{type:'info'|'success'|'error', action:{label, onClick}, ms}`
- `App.confirm(msg, onYes)` — styled confirm (falls back to window.confirm)
- `App.addCSS(css)` — inject stylesheet once per pack
- `App.download(filename, content, mime?)` — trigger a file download
- `App.copyText(text)` — clipboard copy
- `App.updateSolve(index, mutatorFn)` — edit one solve then save+refresh+emit
- `App.deleteSolve(index)` — delete with undo toast
- `App.i18n(key, ko, en)` → returns current-language string; register both when creating UI

## CSS variables available (Toss design tokens)
`--bg --card --card2 --fg --sub --line --accent --accent-weak --red --green --orange
 --radius-card(20px) --radius-btn(12px) --shadow-card`
Buttons: use classes `btn` (secondary), `btn primary`, `btn ghost`, `btn danger`.
Toggle switch: `<label class="tswitch"><input type="checkbox"><i></i></label>`.

## Rules for packs
1. Never edit core files (index.html, style.css, js/app.js, js/scramble.js, js/stats.js, js/draw_*.js).
2. Never call localStorage directly for solve data — always via App.db()/App.save(). You MAY use your own `localStorage` keys prefixed `cstc_pack_` for pack-private state, and store per-session extras on session objects (prefix keys with your pack name).
3. Wrap everything in an IIFE; fail soft: if (!window.App) return.
4. Keep UI text via App.i18n(key, ko, en) so both languages work.
5. Match Toss styling: cards, 12px radius buttons, CSS vars above, no raw #hex duplicates of tokens.
