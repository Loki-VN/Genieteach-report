#!/usr/bin/env node
/**
 * Thu mọi link trên các trang nguồn (đang đặt kỳ + bộ lọc), kiểm tra:
 *   - đích tồn tại (file, hoặc trang/tài liệu có trong bản đóng gói),
 *   - link sang trang báo cáo giữ kỳ dữ liệu (period/date) — trừ Cấu hình, Danh mục biểu đồ, tài liệu, trang chủ,
 *   - mở từng đích khác nhau không lỗi console, không có biểu đồ lỗi khi vẽ.
 *
 *   node tools/qa/crawl-links.js [--standalone] [trang nguồn…]
 */
'use strict';
const fs = require('fs');
const { url, launch, watch, STANDALONE, BUNDLE } = require('./lib');

const SOURCES = [
  'index.html', 'tests.html',
  'hoc-vu/overview.html?period=week&date=2026-09-29&groupId=G11', 'hoc-vu/attendance.html?period=month&groupId=G11',
  'hoc-vu/homework.html?period=month&courseId=LY11', 'hoc-vu/courses.html?period=month',
  'hoc-vu/course-detail.html?courseId=HOA12&period=month', 'hoc-vu/schedule.html?period=week&groupId=G12',
  'hoc-vu/class.html?classId=11A5&period=month', 'hoc-vu/class.html?classId=11A5&tab=attendance&period=month',
  'hoc-vu/class.html?classId=11A5&tab=homework&period=month', 'hoc-vu/class.html?classId=11A5&tab=learning&period=month',
  'hoc-vu/class.html?groupId=G10&period=month', 'hoc-vu/class.html?groupId=G10&tab=learning&period=month',
  'hoc-vu/teachers.html?period=month', 'hoc-vu/student.html?studentId=S0400&period=month',
  'hoc-vu/alerts.html?period=month&groupId=G12', 'hoc-vu/settings.html?period=month', 'hoc-vu/chart-catalog.html?period=month'
];
const NO_PERIOD = ['settings', 'chart-catalog', 'index', 'tests', 'doc'];

/** Chuẩn hóa link tuyệt đối → { ok, page, key, params } theo chế độ. */
function target(href, meta) {
  const u = new URL(href);
  if (STANDALONE) {
    if (decodeURIComponent(u.pathname) !== BUNDLE) return { ok: false, why: 'ra ngoài file đóng gói' };
    const p = u.searchParams.get('p') || 'index';
    const ok = p === 'doc' ? !!meta.docs[u.searchParams.get('f')] : !!meta.pages[p];
    return { ok, why: 'không có trang ' + p, page: p, params: u.searchParams, key: u.search + u.hash, doc: p === 'doc' };
  }
  const file = decodeURIComponent(u.pathname);
  const name = file.split('/').pop();
  const page = name.endsWith('.md') ? 'doc' : name.replace(/\.html$/, '');
  return { ok: fs.existsSync(file), why: 'thiếu file ' + file, page, params: u.searchParams, key: file + u.search, doc: page === 'doc', file };
}

(async () => {
  const list = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const sources = list.length ? list : SOURCES;
  const { browser, ctx } = await launch();
  const page = await ctx.newPage();
  const errors = watch(page);
  const targets = new Map();
  const problems = [];
  let links = 0;
  for (const s of sources) {
    errors.length = 0;
    await page.goto(url(s));
    await page.waitForTimeout(350);
    const meta = STANDALONE ? await page.evaluate(() => ({ pages: GT.bundle.meta.pages, docs: GT.bundle.meta.docs })) : null;
    const found = await page.evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => ({ href: a.href, raw: a.getAttribute('href'), t: (a.textContent || '').trim().slice(0, 40) })));
    if (errors.length) problems.push('Lỗi trên ' + s + ': ' + errors.join(' | '));
    const hadPeriod = /period=/.test(s);
    found.forEach((l) => {
      if (!l.href.startsWith('file:')) return;
      links++;
      const t = target(l.href, meta);
      if (!t.ok) { problems.push('Đích không hợp lệ (' + t.why + '): ' + s + ' → ' + l.raw); return; }
      if (hadPeriod && NO_PERIOD.indexOf(t.page) < 0 && !t.params.get('period') && !t.params.get('date')) problems.push('Mất kỳ: ' + s + ' → ' + l.raw + ' ("' + l.t + '")');
      if (!t.doc || STANDALONE) targets.set(t.key, l.href);
    });
  }
  console.log('Chế độ ' + (STANDALONE ? 'đóng gói' : 'nhiều file') + ' · ' + sources.length + ' trang nguồn · ' + links + ' link · ' + targets.size + ' đích khác nhau');
  for (const [, href] of targets) {
    errors.length = 0;
    await page.goto(href);
    await page.waitForTimeout(150);
    const bad = await page.evaluate(() => [...document.querySelectorAll('.chart')].some((c) => /Lỗi khi vẽ biểu đồ/.test(c.textContent)) ||
      [...document.querySelectorAll('.callout')].some((c) => /Lỗi khởi tạo trang|Không có trang ".*" trong bản đóng gói/.test(c.textContent)));
    if (errors.length || bad) problems.push('Đích lỗi: ' + href + ' ' + errors.join(' | ') + (bad ? ' (lỗi hiển thị)' : ''));
  }
  console.log(problems.length ? problems.slice(0, 60).join('\n') + (problems.length > 60 ? '\n… ' + (problems.length - 60) + ' vấn đề khác' : '') : '✓ Mọi link đến đúng đích, giữ kỳ dữ liệu, mở không lỗi.');
  await browser.close();
  process.exit(problems.length ? 1 : 0);
})();
