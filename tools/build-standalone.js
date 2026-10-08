#!/usr/bin/env node
/**
 * Đóng gói prototype thành MỘT file HTML chạy offline (mở bằng double-click, không cần Internet, không cần server).
 *
 *   node tools/build-standalone.js                 → dist/GenieTeach-HocVu.html
 *   node tools/build-standalone.js --out x.html    → đường dẫn khác
 *
 * Không cần thư viện ngoài (Node ≥ 16). File kết quả nhúng:
 *   - ECharts 5.5.0 từ vendor/echarts-5.5.0 (Apache License 2.0, giữ nguyên header bản quyền),
 *   - assets/css/base.css và mọi module assets/js theo đúng thứ tự nạp của các trang hoc-vu/*.html,
 *   - mọi trang hoc-vu/*.html, index.html, tests.html (mỗi trang là một hàm trong GT.__pages),
 *   - tài liệu README.md + docs/*.md, dựng sẵn sang HTML.
 * Trang đang xem chọn bằng ?p=<id>; tools/standalone/runtime.js đổi link của bản nhiều file sang link nội bộ.
 * Bản nhiều file (index.html, hoc-vu/*.html) giữ nguyên, vẫn nạp ECharts qua CDN như spec.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ECHARTS_CDN = 'https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js';
const ECHARTS_LOCAL = 'vendor/echarts-5.5.0/echarts.min.js';
const DOCS = [   // [id, file, nhãn tab]
  ['README', 'README.md', 'Giới thiệu'],
  ['PLAN', 'docs/PLAN.md', 'Kế hoạch'],
  ['METRICS', 'docs/METRICS.md', 'Chỉ số'],
  ['ALERTS', 'docs/ALERTS.md', 'Cảnh báo'],
  ['OPEN-QUESTIONS', 'docs/OPEN-QUESTIONS.md', 'Giả định & câu hỏi mở'],
  ['ACCEPTANCE', 'docs/ACCEPTANCE.md', 'Nghiệm thu']
];

const args = process.argv.slice(2);
const outArg = args.indexOf('--out');
const OUT = path.resolve(ROOT, outArg >= 0 ? args[outArg + 1] : 'dist/GenieTeach-HocVu.html');

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(ROOT, p));
function fail(msg) { console.error('✕ ' + msg); process.exit(1); }

/** Mã JS nhúng vào <script>: không được chứa "</script" hay "<!--" (parser HTML sẽ cắt sai). */
function safeJs(code, name) {
  if (/<!--/.test(code)) fail(name + ' chứa "<!--" — không nhúng an toàn được vào <script>.');
  return code.replace(/<\/script/gi, '<\\/script');
}
const jsonForScript = (o) => JSON.stringify(o).replace(/<\//g, '<\\/').replace(/<!--/g, '<\\u0021--');

// ------------------------------------------------------------------ Đọc các trang
function parseHtml(file) {
  const html = read(file);
  const dir = path.posix.dirname(file);
  const title = (/<title>([^<]*)<\/title>/.exec(html) || [])[1] || 'GenieTeach';
  const srcs = [...html.matchAll(/<script\s+src="([^"]+)"\s*><\/script>/g)].map((m) => m[1]);
  const local = srcs.filter((s) => !/^https?:/.test(s)).map((s) => path.posix.normalize(path.posix.join(dir, s)));
  const cdn = srcs.filter((s) => /^https?:/.test(s));
  cdn.forEach((s) => { if (s !== ECHARTS_CDN) fail(file + ' nạp thư viện ngoài chưa được hỗ trợ: ' + s); });
  const head = (/<head>([\s\S]*?)<\/head>/.exec(html) || [])[1] || '';
  const css = [...head.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
  const linksBase = /<link[^>]+href="[^"]*base\.css"/.test(head);
  const bodyRaw = (/<body>([\s\S]*?)<\/body>/.exec(html) || [])[1] || '';
  const inline = [...bodyRaw.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');
  const body = bodyRaw.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<noscript>[\s\S]*?<\/noscript>/g, '').trim();
  return { file, title, local, css, linksBase, body, inline };
}

const pageFiles = fs.readdirSync(path.join(ROOT, 'hoc-vu')).filter((f) => f.endsWith('.html')).sort().map((f) => 'hoc-vu/' + f);
const entries = pageFiles.map(parseHtml).concat([parseHtml('index.html'), parseHtml('tests.html')]);

/** Thứ tự nạp module dùng chung = hợp các danh sách, giữ thứ tự tương đối của từng trang. */
const shared = [];
entries.forEach((e) => {
  let prev = -1;
  e.local.filter((s) => !s.startsWith('assets/js/pages/')).forEach((s) => {
    const k = shared.indexOf(s);
    if (k >= 0) { prev = k; return; }
    shared.splice(prev + 1, 0, s);
    prev++;
  });
});
shared.forEach((s) => { if (!exists(s)) fail('Thiếu module ' + s); });
if (!exists(ECHARTS_LOCAL)) fail('Thiếu ' + ECHARTS_LOCAL + ' (ECharts 5.5.0 bản min).');

const pages = {};
const pageScripts = [];
entries.forEach((e) => {
  const id = path.posix.basename(e.file, '.html');
  const pageJs = e.local.filter((s) => s.startsWith('assets/js/pages/'));
  if (pageJs.length > 1) fail(e.file + ' có nhiều hơn một script trang.');
  const code = pageJs.length ? read(pageJs[0]) : e.inline;
  if (!code.trim()) fail(e.file + ' không có script trang.');
  pages[id] = { title: e.title };
  if (e.css.trim()) pages[id].css = e.css.trim();
  if (e.body) pages[id].body = e.body;
  if (!e.linksBase) pages[id].noBase = true;
  pageScripts.push({ id, src: pageJs[0] || e.file + ' (script nội tuyến)', code });
});

// ------------------------------------------------------------------ Markdown → HTML (đủ cho tài liệu của repo)
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
let slugSeen = new Map();
function slug(text) {
  const base = text.replace(/<[^>]*>/g, '').replace(/[`*_]/g, '').trim().toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s/g, '-');
  const n = slugSeen.get(base) || 0;
  slugSeen.set(base, n + 1);
  return n ? base + '-' + n : base;
}
function inline(t) {
  const keep = [];
  const hold = (html) => '\u0000' + (keep.push(html) - 1) + '\u0000';
  t = t.replace(/`([^`]+)`/g, (_, c) => hold('<code>' + esc(c) + '</code>'));
  t = t.replace(/<a id="([A-Za-z0-9_.:-]+)"><\/a>/g, (_, id) => hold('<a id="' + id + '"></a>'));
  t = t.replace(/<br\s*\/?>/gi, () => hold('<br>'));
  t = esc(t);
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, txt, url) => /^javascript:/i.test(url) ? txt : '<a href="' + url + '">' + txt + '</a>');
  t = t.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(^|[^*\w])\*([^*\s](?:[^*]*?[^*\s])?)\*(?!\*)/g, '$1<em>$2</em>');
  return t.replace(/\u0000(\d+)\u0000/g, (_, k) => keep[+k]);
}
function cells(line) {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  const out = [];
  let cur = '', code = false;
  for (let k = 0; k < s.length; k++) {
    const ch = s[k];
    if (ch === '\\' && s[k + 1] === '|') { cur += '|'; k++; continue; }
    if (ch === '`') code = !code;
    if (ch === '|' && !code) { out.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}
function md(src) {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  const blank = (l) => /^\s*$/.test(l);
  const fence = (l) => /^\s*```/.test(l);
  const head = (l) => /^#{1,6}\s/.test(l);
  const hr = (l) => /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(l);
  const ul = (l) => /^\s*[-*+]\s+/.test(l);
  const ol = (l) => /^\s*\d+[.)]\s+/.test(l);
  const quote = (l) => /^\s*>/.test(l);
  const sep = (l) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(l);
  const table = (k) => /\|/.test(lines[k]) && k + 1 < lines.length && sep(lines[k + 1]);
  const starts = (k) => fence(lines[k]) || head(lines[k]) || hr(lines[k]) || ul(lines[k]) || ol(lines[k]) || quote(lines[k]) || table(k);
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (blank(l)) { i++; continue; }
    if (fence(l)) {
      const buf = [];
      i++;
      while (i < lines.length && !fence(lines[i])) buf.push(lines[i++]);
      i++;
      out.push('<pre><code>' + esc(buf.join('\n')) + '</code></pre>');
      continue;
    }
    if (head(l)) {
      const m = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(l);
      const n = m[1].length;
      out.push('<h' + n + ' id="' + esc(slug(m[2])) + '">' + inline(m[2]) + '</h' + n + '>');
      i++;
      continue;
    }
    if (hr(l)) { out.push('<hr>'); i++; continue; }
    if (table(i)) {
      const hd = cells(lines[i]);
      const al = cells(lines[i + 1]).map((c) => /^:-+:$/.test(c) ? ' class="c"' : /-+:$/.test(c) ? ' class="r"' : '');
      i += 2;
      const rows = [];
      while (i < lines.length && !blank(lines[i]) && /\|/.test(lines[i])) rows.push(cells(lines[i++]));
      const th = hd.map((c, k) => '<th' + (al[k] || '') + '>' + inline(c) + '</th>').join('');
      const tb = rows.map((r) => '<tr>' + hd.map((_, k) => '<td' + (al[k] || '') + '>' + inline(r[k] || '') + '</td>').join('') + '</tr>').join('');
      out.push('<div class="tbl-scroll"><table><thead><tr>' + th + '</tr></thead><tbody>' + tb + '</tbody></table></div>');
      continue;
    }
    if (quote(l)) {
      const buf = [];
      while (i < lines.length && quote(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ''));
      out.push('<blockquote>' + md(buf.join('\n')) + '</blockquote>');
      continue;
    }
    if (ul(l) || ol(l)) {
      const ordered = ol(l);
      const items = [];
      while (i < lines.length && (ordered ? ol(lines[i]) : ul(lines[i]))) {
        let t = lines[i].replace(ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*+]\s+/, '');
        i++;
        while (i < lines.length && !blank(lines[i]) && !starts(i)) t += ' ' + lines[i++].trim();
        items.push('<li>' + inline(t) + '</li>');
      }
      const start = ordered ? parseInt(l, 10) : 1;
      const tag = ordered ? 'ol' : 'ul';
      out.push('<' + tag + (ordered && start !== 1 ? ' start="' + start + '"' : '') + '>' + items.join('') + '</' + tag + '>');
      continue;
    }
    const buf = [l.trim()];
    i++;
    while (i < lines.length && !blank(lines[i]) && !starts(i)) buf.push(lines[i++].trim());
    out.push('<p>' + inline(buf.join(' ')) + '</p>');
  }
  return out.join('\n');
}

const docs = {};
const docOrder = [];
DOCS.forEach(([id, file, label]) => {
  if (!exists(file)) { console.warn('! Bỏ qua tài liệu thiếu: ' + file); return; }
  slugSeen = new Map();
  docs[id] = { title: label, path: file, html: md(read(file)) };
  docOrder.push(id);
});

// ------------------------------------------------------------------ Ghép file
const builtAt = (() => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
})();
const meta = { pages, docs, docOrder, docCss: read('tools/standalone/docs.css'), builtAt };
const script = (code, label) => '<script>/* ' + label + ' */\n' + code + '\n</script>';

const parts = [];
parts.push('<!doctype html>\n<html lang="vi">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">');
parts.push('<meta name="generator" content="tools/build-standalone.js · ' + esc(builtAt) + '">');
parts.push('<title>' + esc(pages.index.title) + '</title>');
parts.push('<style id="gt-base-css">\n' + read('assets/css/base.css') + '\n</style>\n</head>\n<body>');
parts.push('<noscript>Trang báo cáo cần bật JavaScript.</noscript>');
parts.push('<!-- Apache ECharts 5.5.0 — Apache License 2.0. Copyright 2017-2024 The Apache Software Foundation. Xem vendor/echarts-5.5.0/LICENSE, NOTICE. -->');
parts.push(script(safeJs(read(ECHARTS_LOCAL), ECHARTS_LOCAL), ECHARTS_LOCAL));
parts.push(script('window.GT = window.GT || {};\nGT.__pages = {};\nGT.bundle = { standalone: true, meta: ' + jsonForScript(meta) + ' };', 'meta của bản đóng gói'));
shared.forEach((s) => parts.push(script(safeJs(read(s), s), s)));
parts.push(script(safeJs(read('tools/standalone/runtime.js'), 'runtime.js'), 'tools/standalone/runtime.js'));
pageScripts.forEach((p) => parts.push(script('GT.__pages[' + JSON.stringify(p.id) + '] = function () {\n' + safeJs(p.code, p.src) + '\n};', 'trang ' + p.id + ' — ' + p.src)));
parts.push(script('GT.bundle.boot();', 'khởi động'));
parts.push('</body>\n</html>\n');

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, parts.join('\n'));
const kb = Math.round(fs.statSync(OUT).size / 1024);
console.log('✓ ' + path.relative(ROOT, OUT) + ' · ' + kb + ' KB · ' + Object.keys(pages).length + ' trang · ' + docOrder.length + ' tài liệu · ' + shared.length + ' module');
console.log('  Module: ' + shared.map((s) => path.posix.basename(s)).join(' → '));
