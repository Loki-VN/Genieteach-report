/**
 * hoc-vu/course-detail.html — 4.4 Phân tích chi tiết khóa học.
 * Trung tâm: heatmap lớp × chuẩn đầu ra + diễn giải nguyên nhân (mục 3.6): vấn đề ở lớp học hay ở chương trình?
 */
(function (GT) {
  'use strict';
  const M = GT.metrics, A = GT.alerts, UI = GT.ui, V = GT.views, F = GT.fmt, DT = GT.date, C = GT.colors;
  const el = UI.el, esc = UI.esc;
  let openedOnce = false;

  function courseOf(ctx) { return ctx.courseId || ctx.D.courses[0].id; }

  GT.page({
    id: 'course-detail',
    title: 'Phân tích chi tiết khóa học',
    subtitle: 'Chuẩn đầu ra theo lớp · diễn giải nguyên nhân · phân tích câu hỏi · lũy kế đến hiện tại',
    filters: {
      extra: function (box, ctx) {
        const D = ctx.D, cid = courseOf(ctx);
        box.appendChild(UI.select('Khóa học', D.courses.map(function (c) { return { value: c.id, label: c.name }; }), cid, function (v) { ctx.set({ courseId: v, classId: null, loId: null }); }));
        const cls = M.courseClassIds(D, cid, ctx.now);
        box.appendChild(UI.select('Lớp', cls.map(function (c) { return { value: c, label: ctx.className(c) }; }), cls.indexOf(ctx.classId) >= 0 ? ctx.classId : null, function (v) { ctx.set({ classId: v, loId: null }); }, 'Tất cả lớp đang học'));
        box.appendChild(el('a', { class: 'btn sm', href: ctx.href('courses.html', { courseId: null, classId: null }), text: '← Tổng quan khóa học' }));
      }
    },
    render: function (ctx, root) {
      const D = ctx.D, cfg = ctx.cfg, now = ctx.now;
      const courseId = courseOf(ctx);
      const course = D.courseById.get(courseId);
      const ca = M.causeAnalysis(D, courseId, cfg, now);
      const mx = ca.matrix;
      const classSel = ctx.classId && mx.classIds.indexOf(ctx.classId) >= 0 ? ctx.classId : null;
      const cls = classSel ? [classSel] : mx.classIds;
      const los = mx.los;
      const loStats = los.map(function (lo) { return { lo: lo, st: M.mergeLoStats(cls.map(function (c) { return mx.cells.get(c + '|' + lo.id); }), cfg) }; });
      const total = M.mergeLoStats(loStats.map(function (x) { return x.st; }), cfg);
      const colorCount = { GREEN: 0, ORANGE: 0, RED: 0, GRAY: 0 };
      loStats.forEach(function (x) { colorCount[x.st.color]++; });
      const elapsed = M.courseElapsed(D, courseId, now);

      root.appendChild(el('div', { class: 'muted small', text: course.name + ' · ' + mx.classIds.length + ' lớp đang học: ' + mx.classIds.map(ctx.className).join(', ') + (classSel ? ' · đang xem lớp ' + ctx.className(classSel) : '') + ' · thời lượng đã qua ' + F.pct(elapsed, 0) }));
      root.appendChild(UI.kpis([
        { label: 'Số chuẩn đầu ra', value: F.int(los.length), sub: 'của khóa ' + course.shortName },
        { label: 'Tỉ lệ đạt chung', value: F.pct(total.passRate), sub: total.pass + '/' + total.withData + ' lượt học sinh × CĐR có dữ liệu', ref: 'M-LO-04' },
        { label: 'CĐR Đỏ (cấp ' + (classSel ? 'lớp' : 'khóa') + ')', value: '✕ ' + colorCount.RED, sub: '✓ ' + colorCount.GREEN + ' Xanh · ! ' + colorCount.ORANGE + ' Cam · – ' + colorCount.GRAY + ' Xám', ref: 'M-LO-05' },
        { label: 'Số câu hỏi đã thực hiện', value: F.int(total.evidence), sub: 'TB ' + F.num(total.avgEvidence, 1) + ' câu / học sinh × CĐR', ref: 'M-LO-07' },
        { label: 'Thời lượng khóa đã qua', value: F.pct(elapsed, 0), sub: 'TB các lớp đang học', ref: 'M-LO-12' }
      ]));

      // ---- Heatmap trung tâm
      root.appendChild(V.loHeatmapCard(ctx, { courseId: courseId, highlightClassId: classSel, title: 'Lớp × chuẩn đầu ra — ' + course.shortName }));

      // ---- Phân bố 6 mức
      const distCats = ['Toàn khóa'].concat(mx.classIds.map(function (c) { return 'Lớp ' + ctx.className(c); }));
      const distStats = [mx.total].concat(mx.classIds.map(function (c) { return mx.classTotals.get(c); }));
      root.appendChild(UI.card({
        title: 'Phân bố 6 mức chuẩn đầu ra',
        question: 'Học sinh của khóa đang ở mức nào trên các chuẩn đầu ra — lớp nào có nhiều "Chưa tốt" nhất?',
        chart: {
          height: 300,
          build: function () {
            return GT.charts.stack({
              categories: distCats, horizontal: true, percent: true, unit: 'lượt học sinh × CĐR', labels: true, labelMin: 8,
              series: M.LEVELS.map(function (l) { return { name: M.LEVEL_META[l].label, color: C.level[l], data: distStats.map(function (s) { return s.levels[l]; }) }; })
            });
          },
          onClick: function (p) { if (p.dataIndex > 0) ctx.set({ classId: mx.classIds[p.dataIndex - 1] }); }
        },
        note: 'Đếm mọi cặp (học sinh–lớp) × chuẩn đầu ra của lớp đang học; học sinh chưa có dữ liệu xếp "Chưa có thông tin". Nhấn vào lớp để lọc trang theo lớp.',
        table: function () {
          return { columns: [{ key: 'c', label: 'Phạm vi' }].concat(M.LEVELS.map(function (l) { return { key: l, label: M.LEVEL_META[l].label, align: 'r' }; })), rows: distStats.map(function (s, i) { const r = { c: distCats[i] }; M.LEVELS.forEach(function (l) { r[l] = s.levels[l]; }); return r; }), csv: 'phan-bo-6-muc.csv' };
        }
      }));

      // ---- Bảng chuẩn đầu ra phân màu
      const colorSel = UI.select('Lọc màu', ['RED', 'ORANGE', 'GREEN', 'GRAY'].map(function (k) { return { value: k, label: M.COLOR_META[k].icon + ' ' + M.COLOR_META[k].label }; }), ctx.q.color || null, function (v) { ctx.set({ color: v }); }, 'Tất cả màu');
      root.appendChild(UI.card({
        title: 'Bảng chuẩn đầu ra' + (classSel ? ' — lớp ' + ctx.className(classSel) : ''), id: 'lo-table',
        question: 'Chuẩn đầu ra nào đang Đỏ/Cam, có đủ dữ liệu để tin kết luận chưa?',
        tools: [colorSel, el('a', { class: 'btn sm', href: 'settings.html', text: 'Ngưỡng ⚙' })],
        body: V.loTable(ctx, { courseId: courseId, classIds: classSel ? [classSel] : null, colorFilter: ctx.q.color || null, otherClassesFor: classSel }),
        legend: M.LEVELS.map(function (l) { return { color: C.level[l], label: M.LEVEL_META[l].label }; }),
        note: 'Màu theo tỉ lệ đạt: Xanh ≥ ' + cfg.lo.color.green + '%, Cam ' + cfg.lo.color.orange + '–<' + cfg.lo.color.green + '%, Đỏ < ' + cfg.lo.color.orange + '%, Xám khi chưa có dữ liệu. "Đạt yêu cầu" = cấp ' + M.LEVEL_META[cfg.lo.passLevel].label + ' trở lên (≥ ' + M.passPercent(cfg) + '%).'
      }));

      // ---- Cảnh báo
      const al = A.filter(ctx.alerts(), { groups: ['LO', 'CUR', 'DATA'], courseId: courseId, strictCourse: true, classIds: classSel ? [classSel] : null });
      root.appendChild(UI.alertBlock({ alerts: al, title: 'Cảnh báo chuẩn đầu ra & chương trình (LO, CUR)', moreHref: 'alerts.html' + GT.qs.build({ displayGroup: 'LEARN', classId: classSel }) }));

      // ---- [ĐX] Bar tỉ lệ đạt sort tăng + [ĐX] Scatter coverage × tỉ lệ đạt
      const row = el('div', { class: 'grid g2' });
      root.appendChild(row);
      const sorted = loStats.filter(function (x) { return x.st.passRate !== null; }).sort(function (a, b) { return a.st.passRate - b.st.passRate; });
      row.appendChild(UI.card({
        title: 'Tỉ lệ đạt từng chuẩn đầu ra', proposal: true,
        question: 'Chuẩn đầu ra nào yếu nhất, cách ngưỡng Xanh/Đỏ bao xa?',
        chart: {
          height: 320,
          build: function () {
            return GT.charts.rankBar({
              items: sorted.map(function (x) { return { id: x.lo.id, name: M.COLOR_META[x.st.color].icon + ' ' + x.lo.code + ' ' + x.lo.name, value: x.st.passRate * 100, n: x.st.withData, color: M.COLOR_META[x.st.color].color }; }),
              fmt: function (v) { return F.num(v, 1) + '%'; }, axisFmt: GT.charts.pctAxis, max: 100, labelWidth: 170, unit: 'học sinh có dữ liệu', valueLabel: 'Tỉ lệ đạt',
              marks: [{ value: cfg.lo.color.green, label: 'Xanh ' + cfg.lo.color.green + '%', color: C.status.GREEN }, { value: cfg.lo.color.orange, label: 'Đỏ < ' + cfg.lo.color.orange + '%', color: C.status.RED }]
            });
          },
          onClick: function (p) { const x = sorted[p.dataIndex]; if (x) V.loPopup(ctx, courseId, x.lo.id, classSel); }
        },
        note: 'Sắp xếp tăng dần; vạch dọc là ngưỡng Xanh và ngưỡng Đỏ. Chuẩn đầu ra Xám (chưa có dữ liệu) không hiển thị.'
      }));
      row.appendChild(UI.card({
        title: 'Coverage × tỉ lệ đạt theo chuẩn đầu ra', proposal: true,
        question: 'Chuẩn đầu ra nào đang được đánh giá quá ít để tin kết luận?',
        chart: {
          height: 320,
          build: function () {
            return GT.charts.scatter({
              points: loStats.map(function (x) { return { id: x.lo.id, name: x.lo.code, x: x.st.coverage === null ? null : x.st.coverage * 100, y: x.st.passRate === null ? null : x.st.passRate * 100, n: x.st.evidence, color: M.COLOR_META[x.st.color].color }; }),
              xName: 'Coverage (%)', yName: 'Tỉ lệ đạt (%)', xMin: 0, xMax: 100, yMin: 0, yMax: 100, nLabel: 'Số câu hỏi đã làm', gridRight: 56,
              xFmt: function (v) { return F.num(v, 0) + '%'; }, yFmt: function (v) { return F.num(v, 0) + '%'; },
              xMid: cfg.lo.thinCoverage, xMidLabel: 'Dữ liệu mỏng < ' + cfg.lo.thinCoverage + '%', yMid: cfg.lo.color.orange, yMidLabel: 'Ngưỡng Đỏ ' + cfg.lo.color.orange + '%',
              quadrants: ['Ít dữ liệu, kết quả tốt — chưa chắc', 'Đủ dữ liệu, kết quả tốt', 'Ít dữ liệu, kết quả kém — bổ sung đánh giá', 'Đủ dữ liệu, kết quả kém — cần can thiệp']
            });
          },
          onClick: function (p) { const x = loStats.filter(function (y) { return y.st.passRate !== null; })[p.dataIndex]; if (x) V.loPopup(ctx, courseId, x.lo.id, classSel); }
        }
      }));

      // ---- [ĐX — cần LOSnapshot] Xu hướng theo tuần
      root.appendChild(trendCard(ctx, courseId, cls, loStats, sorted));

      // ---- [ĐX — cần QuestionAttempt] Phân tích câu hỏi
      root.appendChild(questionCard(ctx, courseId, cls));

      // ---- [ĐX] Học ở nhà ↔ chuẩn đầu ra
      root.appendChild(homeworkLoCard(ctx, courseId, mx));

      if (!openedOnce && ctx.q.loId && D.loById.has(ctx.q.loId)) {
        openedOnce = true;
        setTimeout(function () { V.loPopup(ctx, courseId, ctx.q.loId, classSel); }, 0);
      }
    }
  });

  function trendCard(ctx, courseId, cls, loStats, sorted) {
    const D = ctx.D, cfg = ctx.cfg;
    const pick = ctx.q.trendLo && D.loById.has(ctx.q.trendLo) ? ctx.q.trendLo : (sorted[0] ? sorted[0].lo.id : loStats[0].lo.id);
    const sel = UI.select('Chuẩn đầu ra', loStats.map(function (x) { return { value: x.lo.id, label: x.lo.code + ' ' + x.lo.name }; }), pick, function (v) { ctx.set({ trendLo: v }); });
    const one = M.loTrend(D, pick, cls);
    // TB các CĐR của khóa: gộp mọi CĐR
    const byWeek = new Map();
    loStats.forEach(function (x) {
      M.loTrend(D, x.lo.id, cls).forEach(function (w) {
        let g = byWeek.get(w.weekStart);
        if (!g) { g = { pass: 0, n: 0 }; byWeek.set(w.weekStart, g); }
        if (w.passRate !== null) { g.pass += w.passRate * w.withData; g.n += w.withData; }
      });
    });
    const weeks = one.map(function (w) { return w.weekStart; });
    return UI.card({
      title: 'Xu hướng tỉ lệ đạt theo tuần', proposal: true, badges: [{ cls: 'hist', text: 'Cần dữ liệu lịch sử' }],
      question: 'Chuẩn đầu ra Đỏ đang cải thiện dần hay đứng yên?',
      tools: [sel],
      chart: {
        height: 280,
        build: function () {
          return GT.charts.line({
            categories: weeks.map(DT.fmtDayMonth), min: 0, max: 100, axisFmt: GT.charts.pctAxis, fmt: function (v) { return F.num(v, 1) + '%'; },
            tipTitle: function (i) { return 'Tuần ' + DT.fmtDate(weeks[i]); },
            series: [
              { name: D.loById.get(pick).code + ' ' + D.loById.get(pick).name, short: D.loById.get(pick).code, color: C.accent, data: one.map(function (w) { return w.passRate === null ? null : w.passRate * 100; }), n: one.map(function (w) { return w.withData; }),
                marks: [{ value: cfg.lo.color.green, label: 'Xanh', color: C.status.GREEN }, { value: cfg.lo.color.orange, label: 'Đỏ', color: C.status.RED }] },
              { name: 'TB mọi CĐR của khóa', short: 'TB khóa', color: '#9AA0AC', data: weeks.map(function (w) { const g = byWeek.get(w); return g && g.n ? g.pass / g.n * 100 : null; }) }
            ],
            empty: { title: 'Chưa có ảnh chụp tuần', text: 'Chuẩn đầu ra chưa có dữ liệu.' }
          });
        }
      },
      note: 'Nguồn: LOSnapshot (ảnh chụp lũy kế cuối mỗi tuần, tính bằng ngưỡng tại thời điểm chụp — OQ-46). Gộp lớp có trọng số theo số học sinh có dữ liệu.'
    });
  }

  function questionCard(ctx, courseId, cls) {
    const D = ctx.D, cfg = ctx.cfg;
    const p = (cfg.alerts.rules['CUR-03'] || {}).params || { maxCorrect: 30, minClasses: 3, minAttemptsPerClass: 10 };
    const showAll = ctx.q.qall === '1';
    const rows = [];
    (D.idx.losByCourse.get(courseId) || []).forEach(function (lo) {
      M.questionStats(D, lo.id, cls).forEach(function (x) {
        if (!x.attempts) return;
        const low = [];
        x.byClass.forEach(function (g, cid) { if (g.n >= p.minAttemptsPerClass && g.rate * 100 < p.maxCorrect) low.push(cid); });
        x.lo = lo; x.low = low; x.flag = low.length >= Math.min(p.minClasses, cls.length);
        if (showAll || x.rate * 100 < p.maxCorrect || x.flag) rows.push(x);
      });
    });
    const toggle = el('label', { class: 'f' }, [el('input', { type: 'checkbox', checked: showAll ? true : null, onchange: function (e) { ctx.set({ qall: e.target.checked ? '1' : null }); } }), 'Hiện mọi câu hỏi']);
    return UI.card({
      title: 'Phân tích câu hỏi', proposal: true, id: 'questions', badges: [{ cls: 'qdata', text: 'Cần dữ liệu câu hỏi' }],
      question: 'Chuẩn đầu ra kém là do học sinh chưa nắm, hay do câu hỏi đánh giá có vấn đề (sai đáp án, quá khó, lệch chuẩn đầu ra)?',
      tools: [toggle],
      body: UI.table({
        columns: [
          { key: 'lo', label: 'CĐR', value: function (x) { return x.lo.order * 100 + x.question.order; }, fmt: function (x) { return '<b>' + esc(x.lo.code) + '</b>'; }, csv: function (x) { return x.lo.code; } },
          { key: 'q', label: 'Câu hỏi', minWidth: '280px', value: function (x) { return x.question.text; } },
          { key: 'rate', label: 'Tỉ lệ đúng', align: 'r', fmt: function (x) { return F.pct(x.rate) + '<div class="muted small">' + x.correct + '/' + x.attempts + ' lượt</div>'; }, csv: function (x) { return x.rate; } },
          {
            key: 'byclass', label: 'Theo lớp', sort: false,
            fmt: function (x) {
              return Array.from(x.byClass.entries()).sort(function (a, b) { return a[0] < b[0] ? -1 : 1; }).map(function (e) {
                const bad = e[1].n >= p.minAttemptsPerClass && e[1].rate * 100 < p.maxCorrect;
                return '<span class="nowrap" style="margin-right:8px;' + (bad ? 'color:var(--bad-text);font-weight:600' : 'color:var(--ink-2)') + '">' + esc(ctx.className(e[0])) + ' ' + F.pct(e[1].rate, 0) + (bad ? ' ✕' : '') + '</span>';
              }).join(' ');
            },
            csv: function (x) { return Array.from(x.byClass.entries()).map(function (e) { return ctx.className(e[0]) + ':' + Math.round(e[1].rate * 100); }).join(' '); }
          },
          { key: 'flag', label: 'Kết luận', value: function (x) { return x.flag ? 0 : 1; }, fmt: function (x) { return x.flag ? '<span class="badge cur">Nghi vấn câu hỏi (' + x.low.length + ' lớp < ' + p.maxCorrect + '%)</span>' : (x.rate * 100 < p.maxCorrect ? '<span class="badge cls">Đúng thấp nhưng chưa đủ ' + p.minClasses + ' lớp</span>' : ''); }, csv: function (x) { return x.flag ? 'Nghi vấn câu hỏi' : ''; } }
        ],
        rows: rows, sort: { key: 'rate', dir: 1 }, capped: true, csv: 'phan-tich-cau-hoi-' + courseId + '.csv',
        empty: 'Không có câu hỏi nào có tỉ lệ đúng < ' + p.maxCorrect + '% — chọn "Hiện mọi câu hỏi" để xem tất cả.'
      }),
      note: 'Câu hỏi có tỉ lệ đúng < ' + p.maxCorrect + '% ở ≥ ' + p.minClasses + ' lớp (mỗi lớp ≥ ' + p.minAttemptsPerClass + ' lượt) → nghi vấn câu hỏi (CUR-03). Khi nhiều lớp cùng sai một câu trong khi các câu khác của cùng chuẩn đầu ra ổn, khả năng cao là do câu hỏi.'
    });
  }

  function homeworkLoCard(ctx, courseId, mx) {
    const D = ctx.D, now = ctx.now;
    const pts = mx.classIds.map(function (cid) {
      let done = 0, tot = 0;
      (D.idx.assignByClass.get(cid) || []).filter(function (a) { return a.courseId === courseId && a.startAt <= now; }).forEach(function (a) {
        (D.idx.progByAssignment.get(a.id) || []).forEach(function (p) { done += M.completedItemsAt(p, now); tot += p.totalItems; });
      });
      const st = mx.classTotals.get(cid);
      const c = D.classById.get(cid);
      return { id: cid, name: ctx.className(cid), x: tot ? done / tot * 100 : null, y: st.passRate === null ? null : st.passRate * 100, n: st.withData, color: C.group[c.groupId] };
    });
    const xs = pts.filter(function (p) { return p.x !== null; }).map(function (p) { return p.x; });
    const ys = pts.filter(function (p) { return p.y !== null; }).map(function (p) { return p.y; });
    return UI.card({
      title: 'Học ở nhà ↔ chuẩn đầu ra theo lớp', proposal: true,
      question: 'Lớp có chuẩn đầu ra kém có phải do không làm bài trực tuyến không?',
      chart: {
        height: 320,
        build: function () {
          return GT.charts.scatter({
            points: pts, xName: 'Tiến độ khóa trực tuyến của khóa (%)', yName: 'Tỉ lệ đạt TB các CĐR (%)', xFmt: function (v) { return F.num(v, 0) + '%'; }, yFmt: function (v) { return F.num(v, 0) + '%'; },
            xMid: GT.stats.median(xs), yMid: GT.stats.median(ys), nLabel: 'Lượt học sinh × CĐR có dữ liệu',
            quadrants: ['Ít làm bài nhưng đạt tốt', 'Làm bài tốt, đạt tốt', 'Ít làm bài, đạt kém → kỷ luật học', 'Làm bài tốt nhưng đạt kém → xem lại cách học/dạy'],
            empty: { title: 'Khóa chưa có khóa trực tuyến', text: 'Chưa có dữ liệu tiến độ trực tuyến cho các lớp của khóa này.' }
          });
        },
        onClick: function (p) { const it = pts.filter(function (x) { return x.x !== null && x.y !== null; })[p.dataIndex]; if (it) window.location.href = ctx.href('class.html', { classId: it.id, tab: 'learning', courseId: courseId }); }
      },
      cause: true,
      note: 'Trục x: Σ mục đã hoàn thành / Σ mục được giao của các khóa trực tuyến thuộc khóa này (tính đến hiện tại). Vạch: trung vị các lớp. Màu điểm = nhóm lớp.'
    });
  }
})(window.GT);
