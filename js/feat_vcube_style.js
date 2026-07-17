/* js/feat_vcube_style.js — cube style + palette picker
 *
 * Two independent axes, deliberately kept separate because they answer different questions:
 *   STYLE   (js/vcube3d.js STYLES)      — how the cube is BUILT: body, gaps, sticker size/radius.
 *   PALETTE (js/draw_nnn.js PALETTES)   — what colours it WEARS.
 * Mixing them into one "theme" list would multiply into 15 entries that all look similar.
 *
 * Lives in its own file so it can be added without touching js/feat_vcube.js.
 * Applies live: VCube3D.setStyle() repaints every live instance.
 *
 * THIS FILE OWNS STYLE ONLY. It used to own a SECOND palette pref too — key
 * 'cstc_pack_vcube_palette', with its own '큐브 색상' select in Settings > 화면 — competing
 * with the cube panel's own 'cstc_pack_vcube_pal'. Because this file loads LAST it was the
 * only palette restored at boot, from a key the cube panel never wrote, so the two controls
 * and the actual pixels could disagree three ways at once. Palette now belongs to
 * js/feat_vcube.js, next to the cube you are looking at while you change it (the user asked
 * for exactly that: '큐브할때 환경설정 따로 만들어'). Its migratePalPref() adopts the old key.
 * Do not re-add a palette row here.
 */
(function () {
  'use strict';
  if (!window.App) return;
  var App = window.App;

  var K_STYLE = 'cstc_pack_vcube_style';

  function T(k, ko, en) { return App.i18n(k, ko, en); }
  function get(k, d) { try { return localStorage.getItem(k) || d; } catch (e) { return d; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }

  function styles() { return (window.VCube3D && window.VCube3D.styles) || []; }

  function applyStyle(id) {
    if (window.VCube3D && window.VCube3D.setStyle) window.VCube3D.setStyle(id);
  }

  function row(page, labelText, list, cur, onPick) {
    if (!list.length) return;
    var r = document.createElement('label');
    r.className = 'orow';
    var l = document.createElement('span');
    l.textContent = labelText;
    var sel = document.createElement('select');
    list.forEach(function (o) {
      var op = document.createElement('option');
      op.value = o.id;
      op.textContent = App.lang && App.lang() === 'ko' ? o.ko : o.en;
      sel.appendChild(op);
    });
    sel.value = cur;
    sel.addEventListener('change', function () { onPick(sel.value); });
    r.appendChild(l); r.appendChild(sel);
    page.appendChild(r);
  }

  function setup() {
    // restore before anything renders, so the first cube is already the chosen style
    applyStyle(get(K_STYLE, 'stickerless'));

    App.registerOptionRow && App.registerOptionRow('optPgDisplay', function (page) {
      row(page, T('vcStyle', '가상 큐브: 스타일', 'virtual cube: style'),
        styles(), get(K_STYLE, 'stickerless'), function (v) {
          set(K_STYLE, v); applyStyle(v);
        });
    });
  }

  if (App.db && App.db()) setup(); else App.on('ready', setup);
})();
