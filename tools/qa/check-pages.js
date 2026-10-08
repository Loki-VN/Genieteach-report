#!/usr/bin/env node
/**
 * Mở từng trang, thu lỗi console/pageerror, đo thời gian render (GT.renderMs = mốc cuối lần vẽ đầu, tính từ lúc tải trang),
 * vẽ hết biểu đồ lười (GT.charts.flush) và báo thẻ biểu đồ lỗi. Mặc định chạy danh sách lib.PAGES.
 *
 *   node tools/qa/check-pages.js [--standalone] [trang…]
 */
'use strict';
const { url, launch, watch, PAGES, STANDALONE } = require('./lib');

(async () => {
  const list = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const pages = list.length ? list : PAGES;
  const { browser, ctx, network } = await launch();
  let failed = 0, slowest = 0;
  console.log('Chế độ: ' + (STANDALONE ? 'bản đóng gói một file (chặn mạng)' : 'bản nhiều file'));
  for (const p of pages) {
    const page = await ctx.newPage();
    const errors = watch(page);
    await page.goto(url(p), { waitUntil: 'load' });
    await page.waitForTimeout(400);
    await page.evaluate(() => window.GT && GT.charts && GT.charts.flush && GT.charts.flush());
    await page.waitForTimeout(300);
    const info = await page.evaluate(() => ({
      render: window.GT && window.GT.renderMs,
      summary: (document.getElementById('summary') || {}).innerText,
      drawErrors: [...document.querySelectorAll('.chart')].filter((c) => /Lỗi khi vẽ biểu đồ/.test(c.textContent)).length,
      charts: document.querySelectorAll('.chart canvas').length
    }));
    if (info.drawErrors) errors.push(info.drawErrors + ' biểu đồ lỗi khi vẽ');
    if (/không đạt/i.test(info.summary || '') && !/0 không đạt/.test(info.summary)) errors.push('tests: ' + info.summary);
    if (info.render) slowest = Math.max(slowest, info.render);
    if (errors.length) failed++;
    console.log((errors.length ? '✕ ' : '✓ ') + p.padEnd(44) + (info.render ? ' render ' + String(Math.round(info.render)).padStart(4) + ' ms' : '              ') +
      (info.charts ? ' · ' + info.charts + ' biểu đồ' : '') + (info.summary ? ' | ' + info.summary.replace(/\s+/g, ' ') : ''));
    errors.slice(0, 10).forEach((e) => console.log('    ' + e));
    await page.close();
  }
  if (STANDALONE) console.log(network.length ? '✕ Có ' + network.length + ' request mạng: ' + [...new Set(network)].slice(0, 5).join(', ') : '✓ Không có request mạng nào (chạy offline).');
  console.log((failed ? '✕ ' + failed + ' trang có lỗi' : '✓ ' + pages.length + ' trang không lỗi console') + ' · render chậm nhất ' + Math.round(slowest) + ' ms');
  await browser.close();
  process.exit(failed || (STANDALONE && network.length) ? 1 : 0);
})();
