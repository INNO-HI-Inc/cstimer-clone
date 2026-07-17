/* js/feat_vcube_style.js — cube style + palette picker
 *
 * Two independent axes, deliberately kept separate because they answer different questions:
 *   STYLE   (js/vcube3d.js STYLES)      — how the cube is BUILT: body, gaps, sticker size/radius.
 *   PALETTE (js/draw_nnn.js PALETTES)   — what colours it WEARS.
 * Mixing them into one "theme" list would multiply into 15 entries that all look similar.
 *
 * Lives in its own file so it can be added without touching js/feat_vcube.js.
 * Applies live: VCube3D.setStyle() repaints every live instance, and the palette flows
 * through ScrImage.nnn.setPalette() so the 2D scramble net changes with the 3D cube.
 */
(function () {
  'use strict';
  if (!window.App) return;
  var App = window.App;

  var K_STYLE = 'cstc_pack_vcube_style';
  var K_PAL = 'cstc_pack_vcube_palette';

  function T(k, ko, en) { return App.i18n(k, ko, en); }
  function get(k, d) { try { return localStorage.getItem(k) || d; } catch (e) { return d; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }

  function styles() { return (window.VCube3D && window.VCube3D.styles) || []; }
  function palettes() {
    var n = window.ScrImage && window.ScrImage.nnn;
    return (n && n.palettes) || [];
  }

  function applyStyle(id) {
    if (window.VCube3D && window.VCube3D.setStyle) window.VCube3D.setStyle(id);
  }

  function applyPalette(id) {
    var nnn = window.ScrImage && window.ScrImage.nnn;
    if (!nnn) return;
    /* draw_nnn owns the palette; the 3D engine defaults to nnn.colors, so setting it here
     * moves the 2D net immediately and every NEW cube instance too. Live instances need a
     * nudge because they snapshotted the array at create(). */
    if (nnn.setPalette) nnn.setPalette(id);
    var eng = window.VCubeFeat && window.VCubeFeat.engine && window.VCubeFeat.engine();
    if (eng && eng.setPalette && nnn.colors) {
      try { eng.setPalette(nnn.colors); } catch (e) { }
    }
    App.refresh && App.refresh();   // repaint the 2D scramble image
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
    var st = get(K_STYLE, 'stickerless');
    var pal = get(K_PAL, '');
    applyStyle(st);
    if (pal) applyPalette(pal);

    App.registerOptionRow && App.registerOptionRow('optPgDisplay', function (page) {
      row(page, T('vcStyle', '가상 큐브: 스타일', 'virtual cube: style'),
        styles(), get(K_STYLE, 'stickerless'), function (v) {
          set(K_STYLE, v); applyStyle(v);
        });
      var pl = palettes();
      if (pl.length) {
        row(page, T('vcPal', '큐브 색상', 'cube colours'),
          pl, get(K_PAL, pl[0].id), function (v) {
            set(K_PAL, v); applyPalette(v);
          });
      }
    });
  }

  if (App.db && App.db()) setup(); else App.on('ready', setup);
})();
