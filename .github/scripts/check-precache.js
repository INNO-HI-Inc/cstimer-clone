#!/usr/bin/env node
/* check-precache.js — keeps sw.js's CORE/OPTIONAL lists honest.
 *
 * Fails (exit 1) when:
 *   1. a URL listed in sw.js does not exist on disk  -> atomic addAll(CORE)
 *      would reject and NO ONE could install the app;
 *   2. a shipped asset on disk is missing from the lists -> it silently drops
 *      out of the offline app. This is exactly what shipped desktop.css,
 *      mobile.css and js/mobile.js unprecached at commit a73e75e.
 *
 * Dependency-free, runs from the repo root.
 */
'use strict';

var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '..', '..');
var errors = [];

function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }

/* --- parse the two arrays out of sw.js (no eval of the whole SW: it references self) --- */
var sw = read('sw.js');

function listOf(name) {
  var m = new RegExp('var\\s+' + name + '\\s*=\\s*\\[([\\s\\S]*?)\\];').exec(sw);
  if (!m) { errors.push('sw.js: could not find `var ' + name + ' = [...]`'); return []; }
  var out = [];
  var re = /'([^']+)'|"([^"]+)"/g, hit;
  while ((hit = re.exec(m[1]))) out.push(hit[1] || hit[2]);
  return out;
}

var CORE = listOf('CORE');
var OPTIONAL = listOf('OPTIONAL');
var listed = CORE.concat(OPTIONAL);

if (!/var\s+CACHE_VERSION\s*=\s*'v\d+\.\d+\.\d+'/.test(sw)) {
  errors.push('sw.js: CACHE_VERSION missing or not a vX.Y.Z string');
}

/* --- 1. every listed entry must exist on disk --- */
listed.forEach(function (url) {
  if (url === './') return; /* directory index -> index.html, checked separately */
  var rel = url.replace(/^\.\//, '');
  if (!fs.existsSync(path.join(ROOT, rel))) {
    errors.push('sw.js lists "' + url + '" but it does NOT exist on disk (addAll would reject -> nobody can install)');
  }
});

/* --- 2. every shipped asset on disk must be listed --- */
var mustBeListed = [];

fs.readdirSync(ROOT).forEach(function (f) {
  if (/\.css$/.test(f)) mustBeListed.push('./' + f);
});
mustBeListed.push('./index.html');
mustBeListed.push('./manifest.webmanifest');
fs.readdirSync(path.join(ROOT, 'js')).forEach(function (f) {
  if (/\.js$/.test(f)) mustBeListed.push('./js/' + f);
});
if (fs.existsSync(path.join(ROOT, 'fonts', 'pretendard.css'))) {
  mustBeListed.push('./fonts/pretendard.css');
}

mustBeListed.forEach(function (url) {
  if (listed.indexOf(url) === -1) {
    errors.push('"' + url + '" ships in the repo but is in NEITHER CORE nor OPTIONAL (it will be missing offline)');
  }
});

/* --- 3. fonts referenced by pretendard.css must exist --- */
if (fs.existsSync(path.join(ROOT, 'fonts', 'pretendard.css'))) {
  var css = read('fonts/pretendard.css');
  if (/https?:|\/\/cdn\./.test(css)) {
    errors.push('fonts/pretendard.css still references a REMOTE url — it must be fully self-hosted');
  }
  var re = /url\(\.\/([^)]+\.woff2)\)/g, m, missing = 0;
  while ((m = re.exec(css))) {
    if (!fs.existsSync(path.join(ROOT, 'fonts', m[1]))) { errors.push('fonts/pretendard.css -> missing font file fonts/' + m[1]); missing++; }
  }
  if (missing === 0) console.log('ok: all @font-face woff2 files referenced by fonts/pretendard.css exist');
}

/* --- report --- */
if (errors.length) {
  console.error('\ncheck-precache FAILED:\n');
  errors.forEach(function (e) { console.error('  x ' + e); });
  console.error('');
  process.exit(1);
}
console.log('ok: precache in sync — ' + CORE.length + ' core + ' + OPTIONAL.length + ' optional entries, all present on disk');
