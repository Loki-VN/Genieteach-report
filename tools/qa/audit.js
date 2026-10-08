#!/usr/bin/env node
/**
 * Kiểm tra tĩnh (không cần trình duyệt) cho các tiêu chí nghiệm thu về tài liệu và câu chữ:
 *   1. Mọi mã giả định (OQ-, SP-GD-, SP-SS-, Q-) được nhắc trong code/tài liệu đều có mục trong docs/OPEN-QUESTIONS.md.
 *   2. Mọi chú thích [GIẢ ĐỊNH] / [SỬA SPEC] trong assets/js kèm mã tra cứu được.
 *   3. Mọi mã chỉ số M-… dùng trong danh mục biểu đồ / tài liệu có anchor trong docs/METRICS.md.
 *   4. Mọi rule của alerts.js có dòng trong docs/ALERTS.md và ngược lại.
 *   5. Không có câu chữ quy kết chất lượng giáo viên trong chuỗi giao diện.
 *
 *   node tools/qa/audit.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const walk = (dir) => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })
  .flatMap((e) => e.isDirectory() ? walk(path.posix.join(dir, e.name)) : [path.posix.join(dir, e.name)]);

const problems = [];
const js = walk('assets/js').filter((f) => f.endsWith('.js'));
const docs = ['README.md', 'index.html'].concat(walk('docs').filter((f) => f.endsWith('.md')));

// 1. Mã giả định
const oq = read('docs/OPEN-QUESTIONS.md');
const defined = new Set([...oq.matchAll(/^\|\s*((?:Q|SP-GD|SP-SS)-\d+)\s*\|/gm), ...oq.matchAll(/^\*\*((?:OQ)-\d+)\b/gm)].map((m) => m[1]));
const referenced = new Map();
js.concat(docs).forEach((f) => {
  for (const m of read(f).matchAll(/\b((?:OQ|SP-GD|SP-SS|Q)-\d{2})\b/g)) {
    if (!referenced.has(m[1])) referenced.set(m[1], new Set());
    referenced.get(m[1]).add(f);
  }
});
for (const [id, files] of referenced) if (!defined.has(id)) problems.push('Mã ' + id + ' được nhắc ở ' + [...files].join(', ') + ' nhưng không có mục trong OPEN-QUESTIONS.md');

// 2. Chú thích giả định trong code
js.forEach((f) => read(f).split('\n').forEach((line, i) => {
  if (/\[(GIẢ ĐỊNH|SỬA SPEC)\]/.test(line) && !/\b(?:OQ|SP-GD|SP-SS|Q)-\d{2}\b/.test(line)) problems.push(f + ':' + (i + 1) + ' có [GIẢ ĐỊNH]/[SỬA SPEC] nhưng không kèm mã: ' + line.trim().slice(0, 100));
}));

// 3. Anchor chỉ số
const metrics = read('docs/METRICS.md');
const anchors = new Set([...metrics.matchAll(/<a id="(M-[A-Z]+-\d+)"><\/a>/g), ...metrics.matchAll(/^#{2,4}\s+(M-[A-Z]+-\d+)\b/gm)].map((m) => m[1]));
const usedMetrics = new Set();
['assets/js/catalog.js', 'assets/js/metrics.js', 'assets/js/ui.js', 'assets/js/views.js'].concat(js.filter((f) => f.includes('/pages/'))).forEach((f) => {
  for (const m of read(f).matchAll(/\b(M-(?:ATT|OPS|HW|ONL|LO|BM|PER)-\d{2})\b/g)) usedMetrics.add(m[1]);
});
usedMetrics.forEach((id) => { if (!anchors.has(id)) problems.push('Chỉ số ' + id + ' được dùng nhưng METRICS.md không có anchor'); });

// 4. Rule cảnh báo ↔ ALERTS.md
const ruleIds = new Set([...read('assets/js/alerts.js').matchAll(/\brule\(\s*'([A-Z]+-[A-Z]?\d+)'/g), ...read('assets/js/alerts.js').matchAll(/\bid:\s*'((?:OPS|ATT|HW|ONL|LO|CUR|DATA)-[A-Z]?\d+)'/g)].map((m) => m[1]));
const ruleBlock = /RULE_DEFAULTS\s*=\s*\{([\s\S]*?)\n  \};/.exec(read('assets/js/config.js'))[1];
const cfgRules = new Set([...ruleBlock.matchAll(/'([A-Z]+-[A-Z]?\d+)'\s*:/g)].map((m) => m[1]));
const docRules = new Set([...read('docs/ALERTS.md').matchAll(/^\|\s*((?:OPS|ATT|HW|ONL|LO|CUR|DATA)-[A-Z]?\d+)\s*\|/gm)].map((m) => m[1]));
const allRules = new Set([...ruleIds, ...cfgRules]);
allRules.forEach((id) => { if (!docRules.has(id)) problems.push('Rule ' + id + ' không có dòng trong ALERTS.md'); });
docRules.forEach((id) => { if (!cfgRules.has(id)) problems.push('ALERTS.md có rule ' + id + ' nhưng config.js không có'); });

// 5. Câu chữ về giáo viên (chỉ xét chuỗi trong code giao diện và index.html)
const W = '(?<!\\p{L})(?:kém|yếu(?! tố)|giỏi|xuất sắc|tệ|năng lực)(?!\\p{L})';
const JUDGE = new RegExp('(?:giáo viên|GV(?:CN)?)\\s[^.\'"`]{0,40}' + W + '|' + W + '[^.\'"`]{0,20}(?:giáo viên|GV)', 'iu');
js.concat(['index.html']).forEach((f) => {
  for (const m of read(f).matchAll(/'([^'\n]{8,})'|"([^"\n]{8,})"/g)) {
    const s = m[1] || m[2];
    const j = JUDGE.exec(s);
    if (j && !/không (dùng|xếp hạng|đánh giá|quy kết)/i.test(s)) problems.push(f + ': câu chữ có thể quy kết giáo viên: "' + s.slice(0, 120) + '"');
  }
});

console.log('Mã giả định: ' + defined.size + ' mục, ' + referenced.size + ' mã được nhắc · Chỉ số: ' + anchors.size + ' anchor, ' + usedMetrics.size + ' mã được dùng · Rule: ' + cfgRules.size + ' trong config, ' + docRules.size + ' trong ALERTS.md');
console.log(problems.length ? problems.map((p) => '✕ ' + p).join('\n') : '✓ Không có vấn đề.');
process.exit(problems.length ? 1 : 0);
