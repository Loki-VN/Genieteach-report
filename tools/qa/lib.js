/**
 * Hạ tầng chung cho script kiểm tra tự động (Playwright + Chromium headless, mở trang qua file://).
 *
 * Hai chế độ:
 *   - mặc định: bản nhiều file (index.html, hoc-vu/*.html). Request CDN ECharts được phục vụ bằng
 *     vendor/echarts-5.5.0/echarts.min.js (cùng phiên bản) để chạy được cả khi không có Internet.
 *   - --standalone: bản đóng gói dist/GenieTeach-HocVu.html; CHẶN MỌI request mạng để chứng minh chạy offline.
 *
 * Cần Node ≥ 18 và Playwright: npm i -g playwright && npx playwright install chromium
 */
'use strict';
const fs = require('fs');
const path = require('path');

let playwright;
try { playwright = require('playwright'); } catch (e) {
  console.error('Thiếu Playwright. Cài: npm i -g playwright && npx playwright install chromium (hoặc đặt NODE_PATH tới thư mục node_modules có playwright).');
  process.exit(2);
}

const ROOT = path.resolve(__dirname, '..', '..');
const STANDALONE = process.argv.includes('--standalone');
const BUNDLE = path.join(ROOT, 'dist', 'GenieTeach-HocVu.html');
const ECHARTS = fs.readFileSync(path.join(ROOT, 'vendor', 'echarts-5.5.0', 'echarts.min.js'), 'utf8');

/** Đường dẫn trang của bản nhiều file ("hoc-vu/class.html?classId=10A4", "index.html") → URL file:// theo chế độ. */
function url(u) {
  if (!STANDALONE) return 'file://' + path.join(ROOT, u.split(/[?#]/)[0]) + u.slice(u.split(/[?#]/)[0].length);
  const m = /^([^?#]*)(\?[^#]*)?(#.*)?$/.exec(u);
  const id = path.basename(m[1], '.html');
  const q = (m[2] || '').replace(/^\?/, '');
  return 'file://' + BUNDLE + '?p=' + encodeURIComponent(id) + (q ? '&' + q : '') + (m[3] || '');
}

/** Selector CSS cho link tới một trang (bản nhiều file: "class.html", bản đóng gói: "?p=class"). */
function linkTo(id) { return STANDALONE ? 'a[href*="p=' + id + '&"], a[href$="p=' + id + '"]' : 'a[href*="' + id + '.html"]'; }

async function launch(opts) {
  opts = opts || {};
  if (STANDALONE && !fs.existsSync(BUNDLE)) { console.error('Chưa có ' + path.relative(ROOT, BUNDLE) + ' — chạy: node tools/build-standalone.js'); process.exit(2); }
  const browser = await playwright.chromium.launch();
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1366, height: 900 }, acceptDownloads: true }, opts.context || {}));
  const network = [];
  if (STANDALONE) {
    await ctx.route(/^(?!file:)/, (r) => { network.push(r.request().url()); return r.abort(); });
  } else {
    await ctx.route(/cdn\.jsdelivr\.net\/npm\/echarts@5\.5\.0/, (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: ECHARTS }));
  }
  return { browser, ctx, network };
}

/** Theo dõi lỗi console/pageerror của một page; trả về mảng lỗi (đọc/xóa tùy ý). */
function watch(page) {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('dialog', (d) => d.accept());
  return errors;
}

/** Danh sách trang chuẩn để kiểm tra. */
const PAGES = [
  'index.html', 'tests.html',
  'hoc-vu/overview.html', 'hoc-vu/attendance.html', 'hoc-vu/homework.html', 'hoc-vu/courses.html',
  'hoc-vu/course-detail.html?courseId=TOAN10', 'hoc-vu/schedule.html',
  'hoc-vu/class.html?classId=10A4', 'hoc-vu/class.html?classId=12A3&tab=learning', 'hoc-vu/class.html?classId=TA04&tab=attendance', 'hoc-vu/class.html?classId=12A5&tab=homework',
  'hoc-vu/teachers.html', 'hoc-vu/student.html?studentId=S0016', 'hoc-vu/alerts.html', 'hoc-vu/settings.html', 'hoc-vu/chart-catalog.html'
];

module.exports = { ROOT, STANDALONE, BUNDLE, url, linkTo, launch, watch, PAGES };
