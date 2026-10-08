#!/usr/bin/env node
/**
 * Kiểm tra tương tác chính: đổi kỳ, bộ lọc, popup, chế độ Bảng, CSV, cấu hình (validate, xem trước, lưu, khôi phục)
 * và lan truyền cấu hình (màu, nhãn diễn giải, cảnh báo), trạng thái cảnh báo, báo cáo giáo viên, hồ sơ học sinh,
 * danh mục biểu đồ, ẩn hạng mục Đề xuất. Mỗi bước in ✓/✕ kèm lỗi console phát sinh trong bước.
 *
 *   node tools/qa/interact.js [--standalone]
 */
'use strict';
const fs = require('fs');
const { url, linkTo, launch, watch, STANDALONE } = require('./lib');

(async () => {
  const { browser, ctx } = await launch();
  const p = await ctx.newPage();
  const errs = watch(p);
  let failed = 0, total = 0;
  const step = async (name, fn) => {
    total++;
    const n = errs.length;
    try { await fn(); } catch (e) { errs.push('lỗi bước: ' + e.message.split('\n')[0]); }
    const bad = errs.length > n;
    if (bad) failed++;
    console.log((bad ? '✕ ' : '✓ ') + name + (bad ? ' — ' + errs.slice(n).join(' | ') : ''));
  };
  const go = async (u) => { await p.goto(url(u)); await p.waitForTimeout(350); };
  const onPage = (id) => STANDALONE ? new RegExp('[?&]p=' + id + '(&|#|$)').test(p.url()) : p.url().includes(id + '.html');
  const must = (cond, msg) => { if (!cond) throw new Error(msg); };
  const bodyText = () => p.evaluate(() => document.body.innerText);
  const count = (re) => bodyText().then((t) => (t.match(re) || []).length);
  const forbidden = /(giáo viên|GV)[^.]{0,40}(kém|yếu|giỏi|xuất sắc|tệ)|(kém|yếu|giỏi|xuất sắc)[^.]{0,20}(giáo viên|GV)/i;

  console.log('Chế độ: ' + (STANDALONE ? 'bản đóng gói một file' : 'bản nhiều file'));
  await go('index.html');
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) { /* ignore */ } });

  // ---------------------------------------------------------------- Lịch học & điều hướng
  await step('Lịch học: chuyển Tuần, lùi kỳ, chế độ Khoảng', async () => {
    await go('hoc-vu/schedule.html');
    await p.click('.period .seg button:has-text("Tuần")'); await p.waitForTimeout(300);
    must(p.url().includes('period=week'), 'URL không đổi: ' + p.url());
    await p.click('.period .icon-btn[title="Kỳ trước"]'); await p.waitForTimeout(300);
    must((await p.textContent('.plabel')).includes('28/09'), 'nhãn kỳ sai');
    await p.click('.period .seg button:has-text("Khoảng")'); await p.waitForTimeout(300);
    must(p.url().includes('period=custom'), p.url());
  });
  await step('Lịch học: lọc Khối 12, theo nhóm lớp, xem báo cáo buổi', async () => {
    await p.selectOption('select[aria-label="Nhóm lớp"]', 'G12'); await p.waitForTimeout(300);
    must(p.url().includes('groupId=G12'), p.url());
    await p.click('button:has-text("Theo nhóm lớp")'); await p.waitForTimeout(300);
    await p.click('.period .seg button:has-text("Tuần")'); await p.waitForTimeout(300);
    await p.click('button[data-sid] >> nth=0'); await p.waitForSelector('.modal'); await p.keyboard.press('Escape');
  });
  await step('Menu bên giữ kỳ + bộ lọc', async () => {
    const href = await p.getAttribute('.sidebar nav a:has-text("Chuyên cần")', 'href');
    must(href.includes('period=week') && href.includes('groupId=G12'), href);
  });

  // ---------------------------------------------------------------- Tổng quan
  await step('Tổng quan: popup so sánh → click lớp mở báo cáo lớp', async () => {
    await go('hoc-vu/overview.html');
    await p.click('button:has-text("So sánh chi tiết") >> nth=0'); await p.waitForSelector('.modal canvas'); await p.waitForTimeout(300);
    await p.click('.modal tbody tr >> nth=0'); await p.waitForTimeout(400);
    must(onPage('class'), p.url());
  });
  await step('Tổng quan: chọn nhóm lớp, bật chế độ Bảng', async () => {
    await go('hoc-vu/overview.html');
    await p.click('.tile:has-text("Khối 12")'); await p.waitForTimeout(300);
    must(p.url().includes('groupId=G12'), p.url());
    await p.click('.card:has-text("Tỉ lệ đi học hôm nay") button:has-text("Bảng")');
    await p.waitForSelector('.card:has-text("Tỉ lệ đi học hôm nay") table');
  });

  // ---------------------------------------------------------------- Chuyên cần, Học ở nhà
  await step('Chuyên cần: Tháng + Khối 11, menu giữ ngữ cảnh', async () => {
    await go('hoc-vu/attendance.html');
    await p.click('.period .seg button:has-text("Tháng")'); await p.waitForTimeout(300);
    await p.selectOption('select[aria-label="Nhóm lớp"]', 'G11'); await p.waitForTimeout(300);
    must(p.url().includes('period=month') && p.url().includes('groupId=G11'), p.url());
    const href = await p.getAttribute('.sidebar nav a:has-text("Học ở nhà")', 'href');
    must(href.includes('period=month') && href.includes('groupId=G11'), href);
  });
  await step('Chuyên cần: chế độ Bảng + xuất CSV (UTF-8 BOM)', async () => {
    await p.click('.card button:has-text("Bảng") >> nth=0'); await p.waitForTimeout(200);
    const dl = p.waitForEvent('download', { timeout: 5000 });
    await p.click('.card button:has-text("CSV") >> nth=0');
    const d = await dl;
    const txt = fs.readFileSync(await d.path(), 'utf8');
    must(txt.charCodeAt(0) === 0xFEFF, 'thiếu BOM');
    must(txt.split('\n').length > 2, 'CSV rỗng');
  });
  await step('Chuyên cần: lùi kỳ đổi nhãn kỳ', async () => {
    const a = await p.textContent('.plabel');
    await p.click('.period .icon-btn[title="Kỳ trước"]'); await p.waitForTimeout(300);
    must(a !== await p.textContent('.plabel'), 'nhãn không đổi');
  });
  await step('Học ở nhà: Ngày → Tháng, lọc khóa Toán 10', async () => {
    await go('hoc-vu/homework.html?period=day');
    await p.click('.period .seg button:has-text("Tháng")'); await p.waitForTimeout(300);
    await p.selectOption('select[aria-label="Khóa học"]', 'TOAN10'); await p.waitForTimeout(300);
    must(p.url().includes('courseId=TOAN10') && p.url().includes('period=month'), p.url());
  });

  // ---------------------------------------------------------------- Cấu hình & lan truyền
  await step('Cấu hình: ngưỡng sai → báo lỗi, khóa nút Lưu', async () => {
    await go('hoc-vu/settings.html');
    await p.fill('input[aria-label="Tốt từ"]', '95'); await p.waitForTimeout(100);
    must((await p.textContent('.card:has-text("Lưu & xem trước") .err')).includes('lỗi'), 'không báo lỗi');
    must(await p.isDisabled('button:has-text("Lưu cấu hình")'), 'nút lưu không bị khóa');
  });
  await step('Cấu hình: xem trước rồi lưu Xanh ≥ 90% → chú thích heatmap đổi', async () => {
    await p.fill('input[aria-label="Tốt từ"]', '75');
    await p.fill('input[aria-label="Xanh khi tỉ lệ đạt ≥"]', '90');
    await p.click('button:has-text("Xem trước tác động")'); await p.waitForTimeout(500);
    must((await p.textContent('.card:has-text("Lưu & xem trước")')).includes('Với ngưỡng mới'), 'không có xem trước');
    await p.click('button:has-text("Lưu cấu hình")'); await p.waitForTimeout(400);
    must(await p.evaluate(() => GT.config.get().lo.color.green) === 90, 'chưa lưu');
    await go('hoc-vu/course-detail.html?courseId=TOAN10');
    must((await bodyText()).includes('Xanh ≥ 90%'), 'chú thích chưa đổi');
  });
  await step('Cấu hình: ngưỡng diễn giải → nhãn "Nghi vấn ở lớp học" và cảnh báo đổi', async () => {
    await go('hoc-vu/settings.html');
    await p.click('button:has-text("Khôi phục mặc định")'); await p.waitForTimeout(300);
    await go('hoc-vu/course-detail.html?courseId=LY11');
    const before = await count(/Nghi vấn ở lớp học/g);
    const nBefore = await p.evaluate(() => GT.alerts.run(GT.D, GT.config.get()).alerts.length);
    await p.evaluate(() => GT.config.save(GT.config.withOverrides({ cause: { classGapPts: 10 } })));
    await go('hoc-vu/course-detail.html?courseId=LY11');
    const after = await count(/Nghi vấn ở lớp học/g);
    const nAfter = await p.evaluate(() => GT.alerts.run(GT.D, GT.config.get()).alerts.length);
    console.log('    nhãn "Nghi vấn ở lớp học": ' + before + ' → ' + after + ' · cảnh báo: ' + nBefore + ' → ' + nAfter);
    must(after > before && nAfter !== nBefore, 'không đổi');
  });
  await step('Cấu hình: tắt báo cáo giáo viên → trang giáo viên ẩn', async () => {
    await go('hoc-vu/settings.html');
    await p.click('button:has-text("Khôi phục mặc định")'); await p.waitForTimeout(300);
    await p.click('label:has-text("Hiển thị báo cáo vận hành theo giáo viên") input'); await p.waitForTimeout(100);
    await p.click('button:has-text("Lưu cấu hình")'); await p.waitForTimeout(300);
    await go('hoc-vu/teachers.html');
    must((await bodyText()).includes('Trường đã tắt báo cáo theo giáo viên'), 'vẫn hiện');
  });
  await step('Cấu hình: khôi phục mặc định', async () => {
    await go('hoc-vu/settings.html');
    await p.click('button:has-text("Khôi phục mặc định")'); await p.waitForTimeout(300);
    const v = await p.evaluate(() => [GT.config.get().lo.color.green, GT.config.get().display.showTeacherReport, GT.config.hasOverrides()]);
    must(v[0] === 80 && v[1] === true && !v[2], JSON.stringify(v));
  });

  // ---------------------------------------------------------------- Cảnh báo
  await step('Cảnh báo: đổi trạng thái + ghi chú, còn sau khi tải lại', async () => {
    await go('hoc-vu/alerts.html');
    await p.selectOption('select[data-st] >> nth=0', 'IN_PROGRESS');
    await p.fill('textarea[data-note] >> nth=0', 'Đã gọi GVCN');
    await p.click('h1'); await p.waitForTimeout(200);
    await p.reload(); await p.waitForTimeout(350);
    const st = await p.evaluate(() => Object.values(GT.alerts.store.all()).map((x) => x.status + ':' + (x.note || '')).join(','));
    must(st.includes('IN_PROGRESS:Đã gọi GVCN'), st);
  });
  await step('Cảnh báo: mở rộng dòng gộp, lọc lớp 10A3', async () => {
    await p.click('button[data-exp] >> nth=0'); await p.waitForTimeout(200);
    must(await p.locator('td ul li').count() > 0, 'không mở được');
    await p.selectOption('select[aria-label="Lớp"]', '10A3'); await p.waitForTimeout(300);
    must(p.url().includes('classId=10A3'), p.url());
  });

  // ---------------------------------------------------------------- Giáo viên, học sinh
  await step('Giáo viên: mở chi tiết T09, không có câu chữ đánh giá giáo viên', async () => {
    await go('hoc-vu/teachers.html?teacherId=T09');
    await p.waitForSelector('.modal', { timeout: 3000 });
    const m = forbidden.exec(await bodyText());
    must(!m, 'câu chữ: ' + (m && m[0]));
    await p.keyboard.press('Escape');
  });
  await step('Hồ sơ học sinh: chọn qua ô tìm, bản in', async () => {
    await go('hoc-vu/student.html');
    const code = await p.evaluate(() => GT.D.students[5].code);
    await p.fill('input[aria-label="Chọn học sinh"]', 'x · ' + code);
    await p.dispatchEvent('input[aria-label="Chọn học sinh"]', 'change'); await p.waitForTimeout(400);
    must(p.url().includes('studentId='), p.url());
    await p.evaluate(() => GT.charts.flush()); await p.emulateMedia({ media: 'print' }); await p.waitForTimeout(200);
    must(await p.evaluate(() => getComputedStyle(document.querySelector('.sidebar')).display) === 'none', 'bản in còn menu');
    await p.emulateMedia({ media: 'screen' });
  });
  await step('Hồ sơ học sinh: link lớp giữ kỳ', async () => {
    await go('hoc-vu/student.html?studentId=S0016&period=month');
    const href = await p.getAttribute(linkTo('class') + ' >> nth=0', 'href');
    must(href.includes('period=month'), href);
  });

  // ---------------------------------------------------------------- Danh mục biểu đồ, Đề xuất
  await step('Danh mục biểu đồ: lọc nhãn Đề xuất + tìm kiếm', async () => {
    await go('hoc-vu/chart-catalog.html');
    const all = await p.locator('article.card').count();
    await p.selectOption('select[aria-label="Nhãn"]', 'DX'); await p.waitForTimeout(300);
    const dx = await p.locator('article.card').count();
    await p.fill('input[aria-label="Tìm biểu đồ"]', 'heatmap');
    await p.dispatchEvent('input[aria-label="Tìm biểu đồ"]', 'change'); await p.waitForTimeout(300);
    const h = await p.locator('article.card').count();
    console.log('    thẻ: tất cả ' + all + ' · Đề xuất ' + dx + ' · Đề xuất + "heatmap" ' + h);
    must(all > dx && dx >= h && h > 0, 'lọc sai');
  });
  await step('Trang chủ: tắt Đề xuất → ẩn hạng mục Đề xuất ở mọi trang', async () => {
    await go('index.html'); await p.uncheck('#prop'); await p.waitForTimeout(100);
    await go('hoc-vu/chart-catalog.html');
    const vis = await p.evaluate(() => [...document.querySelectorAll('article.card')].filter((c) => c.offsetParent !== null).length);
    const tot = await p.locator('article.card').count();
    const nav = await p.evaluate(() => [...document.querySelectorAll('.sidebar a')].filter((a) => a.offsetParent !== null).map((a) => a.textContent).join('|'));
    must(vis < tot && !nav.includes('Hồ sơ học sinh'), 'không ẩn (' + vis + '/' + tot + ')');
    await go('index.html'); await p.check('#prop');
  });
  await step('Trang chủ → tài liệu → link công thức', async () => {
    await go('index.html');
    await p.click('a:has-text("METRICS.md")'); await p.waitForTimeout(300);
    if (STANDALONE) {
      must(/p=doc/.test(p.url()) && (await bodyText()).includes('M-ATT-01'), 'không mở tài liệu: ' + p.url());
      await go('hoc-vu/chart-catalog.html');
      await p.click('article.card a[href*="M-ATT-01"] >> nth=0'); await p.waitForTimeout(400);
      must(p.url().includes('#M-ATT-01') && await p.evaluate(() => { const r = document.getElementById('M-ATT-01'); return !!r && r.getBoundingClientRect().top < 300; }), 'không nhảy tới công thức');
    } else must(p.url().endsWith('docs/METRICS.md'), p.url());
  });

  await p.evaluate(() => { try { localStorage.clear(); } catch (e) { /* ignore */ } }).catch(() => {});
  console.log((failed ? '✕ ' + failed + '/' + total + ' bước lỗi' : '✓ ' + total + '/' + total + ' bước đạt'));
  await browser.close();
  process.exit(failed ? 1 : 0);
})();
