/**
 * hoc-vu/courses.html — 4.4 Báo cáo khóa học — Tab Tổng quan.
 * Trả lời: khóa nào đang có nhiều chuẩn đầu ra kém; chuẩn đầu ra nào yếu nhất toàn trường và vì sao.
 */
(function (GT) {
  'use strict';
  const M = GT.metrics, UI = GT.ui, V = GT.views, F = GT.fmt, C = GT.colors;
  const el = UI.el, esc = UI.esc;

  GT.page({
    id: 'courses',
    title: 'Báo cáo khóa học',
    subtitle: 'Chuẩn đầu ra của mọi khóa đang diễn ra · lũy kế đến hiện tại',
    filters: {},
    render: function (ctx, root) {
      const D = ctx.D, cfg = ctx.cfg, now = ctx.now;
      const active = D.courses.filter(function (c) { return M.courseClassIds(D, c.id, now).length > 0; });
      const activeClasses = new Set();
      active.forEach(function (c) { M.courseClassIds(D, c.id, now).forEach(function (x) { activeClasses.add(x); }); });
      const nLo = active.reduce(function (s, c) { return s + (D.idx.losByCourse.get(c.id) || []).length; }, 0);
      const info = active.map(function (c) {
        const ca = M.causeAnalysis(D, c.id, cfg, now);
        const mx = ca.matrix;
        const colors = { GREEN: 0, ORANGE: 0, RED: 0, GRAY: 0 };
        mx.los.forEach(function (lo) { colors[mx.loTotals.get(lo.id).color]++; });
        let cur = 0;
        ca.curriculum.forEach(function (x) { if (x.label === 'CURRICULUM') cur++; });
        return { course: c, ca: ca, mx: mx, colors: colors, cur: cur, elapsed: M.courseElapsed(D, c.id, now) };
      });
      const dist = M.mergeLoStats(info.map(function (x) { return x.mx.total; }), cfg);

      root.appendChild(UI.kpis([
        { label: 'Khóa đang diễn ra', value: F.int(active.length), sub: 'trên ' + D.courses.length + ' khóa' },
        { label: 'Lớp đang diễn ra', value: F.int(activeClasses.size), sub: 'có ≥ 1 khóa đang trong thời gian học', ref: 'M-OPS-00' },
        { label: 'Chuẩn đầu ra đang diễn ra', value: F.int(nLo), sub: 'của các khóa đang diễn ra', ref: 'M-LO' },
        { label: 'Tỉ lệ đạt toàn trường', value: F.pct(dist.passRate), sub: F.int(dist.pass) + '/' + F.int(dist.withData) + ' lượt học sinh × CĐR', ref: 'M-LO-04' }
      ]));

      // ---- Phân bố 6 mức toàn trường
      const row1 = el('div', { class: 'grid g2' });
      root.appendChild(row1);
      row1.appendChild(UI.card({
        title: 'Phân bố 6 mức chuẩn đầu ra toàn trường',
        question: 'Trên mọi khóa đang diễn ra, học sinh đang ở mức nào trên các chuẩn đầu ra?',
        chart: {
          height: 300, eager: true,
          build: function () {
            return GT.charts.donut({
              items: M.LEVELS.map(function (l) { return { name: M.LEVEL_META[l].label, value: dist.levels[l], color: C.level[l] }; }),
              center: { value: F.pct(dist.passRate), label: 'đạt yêu cầu' }, unit: 'lượt'
            });
          }
        },
        note: 'Đếm mọi cặp (học sinh–lớp) × chuẩn đầu ra của lớp đang học (' + F.int(Object.keys(dist.levels).reduce(function (s, k) { return s + dist.levels[k]; }, 0)) + ' lượt). Tỉ lệ ở giữa = đạt yêu cầu / có dữ liệu.',
        table: function () { return { columns: [{ key: 'l', label: 'Mức' }, { key: 'n', label: 'Số lượt', align: 'r' }, { key: 'p', label: 'Tỉ lệ', align: 'r' }], rows: M.LEVELS.map(function (l) { const tot = M.LEVELS.reduce(function (s, k) { return s + dist.levels[k]; }, 0); return { l: M.LEVEL_META[l].label, n: dist.levels[l], p: F.pct(dist.levels[l] / tot) }; }), csv: 'phan-bo-6-muc-toan-truong.csv' }; }
      }));
      // ---- [ĐX] So sánh các khóa (sort theo Chưa tốt + Cần cải thiện)
      const sorted = info.slice().sort(function (a, b) {
        const ta = Object.keys(a.mx.total.levels).reduce(function (s, k) { return s + a.mx.total.levels[k]; }, 0) || 1;
        const tb = Object.keys(b.mx.total.levels).reduce(function (s, k) { return s + b.mx.total.levels[k]; }, 0) || 1;
        return (b.mx.total.levels.POOR + b.mx.total.levels.NEEDS_IMPROVEMENT) / tb - (a.mx.total.levels.POOR + a.mx.total.levels.NEEDS_IMPROVEMENT) / ta;
      });
      row1.appendChild(UI.card({
        title: 'So sánh các khóa học', proposal: true,
        question: 'Khóa nào có tỉ trọng "Chưa tốt" + "Cần cải thiện" cao nhất?',
        chart: {
          height: 300,
          build: function () {
            return GT.charts.stack({
              categories: sorted.map(function (x) { return x.course.shortName; }), horizontal: true, percent: true, labels: true, labelMin: 8, unit: 'lượt',
              series: ['POOR', 'NEEDS_IMPROVEMENT', 'AVERAGE', 'GOOD', 'EXCELLENT', 'NO_DATA'].map(function (l) { return { name: M.LEVEL_META[l].label, color: C.level[l], data: sorted.map(function (x) { return x.mx.total.levels[l]; }) }; })
            });
          },
          onClick: function (p) { const x = sorted[p.dataIndex]; if (x) window.location.href = ctx.href('course-detail.html', { courseId: x.course.id, classId: null }); }
        },
        note: 'Sắp xếp giảm dần theo tỉ trọng Chưa tốt + Cần cải thiện; các mức kém đặt đầu thanh để dễ so sánh. Nhấn để mở phân tích chi tiết.'
      }));

      // ---- Thẻ từng khóa
      root.appendChild(UI.section('Các khóa đang diễn ra', 'Nhấn vào khóa để xem phân tích chi tiết'));
      const cards = el('div', { class: 'cards' });
      root.appendChild(cards);
      info.forEach(function (x) {
        const c = x.course;
        cards.appendChild(el('a', { class: 'tile', href: ctx.href('course-detail.html', { courseId: c.id, classId: null }) }, [
          el('h4', { text: c.name }),
          el('div', { class: 'row' }, [el('span', { text: 'Lớp đang học' }), el('b', { style: { textAlign: 'right' }, text: x.mx.classIds.map(ctx.className).join(', ') })]),
          el('div', { class: 'row' }, [el('span', { text: 'Số chuẩn đầu ra' }), el('b', { text: String(x.mx.los.length) })]),
          el('div', { class: 'row' }, [el('span', { text: 'Thời lượng đã qua' }), el('b', { text: F.pct(x.elapsed, 0) })]),
          el('div', { html: UI.levelStack(x.mx.total.levels) }),
          el('div', { class: 'row' }, [el('span', { text: 'Tỉ lệ đạt' }), el('b', { text: F.pct(x.mx.total.passRate) })]),
          el('div', { class: 'row', 'data-proposal': '', html: '<span>CĐR theo màu</span><span>' + ['RED', 'ORANGE', 'GREEN', 'GRAY'].map(function (k) { return UI.colorChip(k, M.COLOR_META[k].icon + ' ' + x.colors[k]); }).join(' ') + '</span>' }),
          el('div', { class: 'row', 'data-proposal': '', html: '<span>Nhãn "Nghi vấn chương trình"</span><b>' + x.cur + '</b>' })
        ]));
      });
      root.appendChild(UI.levelLegend());

      // ---- [ĐX] Top 10 CĐR yếu nhất toàn trường
      const rows = [];
      info.forEach(function (x) {
        x.mx.los.forEach(function (lo) {
          const st = x.mx.loTotals.get(lo.id);
          if (st.passRate === null) return;
          const cur = x.ca.curriculum.get(lo.id);
          const red = x.mx.classIds.filter(function (c) { return x.mx.cells.get(c + '|' + lo.id).color === 'RED'; });
          const clsLab = x.mx.classIds.filter(function (c) { return x.ca.classLabel.get(c + '|' + lo.id).label === 'CLASS'; });
          rows.push({ course: x.course, lo: lo, st: st, cur: cur, red: red, nCls: x.mx.classIds.length, clsLab: clsLab });
        });
      });
      rows.sort(function (a, b) { return a.st.passRate - b.st.passRate; });
      root.appendChild(UI.card({
        title: 'Top 10 chuẩn đầu ra yếu nhất toàn trường', proposal: true,
        question: 'Chuẩn đầu ra nào yếu nhất (xuyên khóa), và vấn đề nằm ở lớp học hay ở chương trình?',
        body: UI.table({
          columns: [
            { key: 'rank', label: '#', align: 'c', value: function (r) { return rows.indexOf(r); }, fmt: function (r) { return String(rows.indexOf(r) + 1); } },
            { key: 'course', label: 'Khóa', value: function (r) { return r.course.shortName; } },
            { key: 'code', label: 'Mã', value: function (r) { return r.lo.code; }, fmt: function (r) { return '<b>' + esc(r.lo.code) + '</b>'; } },
            { key: 'name', label: 'Chuẩn đầu ra', minWidth: '220px', value: function (r) { return r.lo.name; } },
            { key: 'pass', label: 'Tỉ lệ đạt', align: 'r', value: function (r) { return r.st.passRate; }, fmt: function (r) { return UI.colorChip(r.st.color, V.loCellLabel(r.st)) + '<div class="muted small">' + r.st.pass + '/' + r.st.withData + ' · ' + F.int(r.st.evidence) + ' câu</div>'; }, csv: function (r) { return r.st.passRate; } },
            { key: 'red', label: 'Số lớp Đỏ / tổng', align: 'r', value: function (r) { return r.red.length / r.nCls; }, fmt: function (r) { return r.red.length + '/' + r.nCls + (r.red.length ? '<div class="muted small">' + esc(r.red.map(ctx.className).join(', ')) + '</div>' : ''); }, csv: function (r) { return r.red.length + '/' + r.nCls; } },
            { key: 'cause', label: 'Diễn giải nguyên nhân', value: function (r) { return r.cur.label; }, fmt: function (r) { return r.cur.label === 'CURRICULUM' ? UI.causeBadge('CURRICULUM') : r.clsLab.length ? UI.causeBadge('CLASS') + '<div class="muted small">Lớp ' + esc(r.clsLab.map(ctx.className).join(', ')) + '</div>' : r.cur.label === 'INSUFFICIENT' ? UI.causeBadge('INSUFFICIENT') : '<span class="muted small">Không có nhãn</span>'; }, csv: function (r) { return M.CAUSE_TEXT[r.cur.label] || (r.clsLab.length ? M.CAUSE_TEXT.CLASS : ''); } }
          ],
          rows: rows.slice(0, 10), sort: { key: 'rank', dir: 1 }, csv: 'top10-cdr-yeu-nhat.csv',
          onRow: function (r) { window.location.href = ctx.href('course-detail.html', { courseId: r.course.id, loId: r.lo.id, classId: null }); }
        }),
        cause: true,
        note: 'Tỉ lệ đạt gộp mọi lớp đang học khóa (cộng gộp, không trung bình các lớp). Nhãn theo mục 3.6 — xem METRICS.md §5.1.'
      }));
    }
  });
})(window.GT);
