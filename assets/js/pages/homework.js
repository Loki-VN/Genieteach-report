/**
 * hoc-vu/homework.html — 4.3 Báo cáo học ở nhà (nhiệm vụ + khóa trực tuyến).
 * Mặc định kỳ Tuần [ĐỀ XUẤT] (OQ-30). Theo hạn nộp (Task.dueAt / OnlineCourseAssignment.dueAt).
 */
(function (GT) {
  'use strict';
  const M = GT.metrics, A = GT.alerts, UI = GT.ui, V = GT.views, F = GT.fmt, DT = GT.date, C = GT.colors, L = GT.labels, S = GT.stats;
  const el = UI.el, esc = UI.esc;

  GT.page({
    id: 'homework',
    title: 'Báo cáo học ở nhà',
    subtitle: 'Nhiệm vụ sau buổi học và khóa trực tuyến · theo hạn nộp',
    filters: { period: 'week', group: true, course: true },
    render: function (ctx, root) {
      const D = ctx.D, now = ctx.now, r = ctx.range, pr = ctx.prev, cfg = ctx.cfg;
      const scope = { groupIds: ctx.scope.groupIds, courseIds: ctx.scope.courseIds };
      const tc = M.taskCounts(D, scope, r.from, r.to), tp = M.taskCounts(D, scope, pr.from, pr.to);
      const rc = M.taskRates(tc), rp = M.taskRates(tp);
      const oc = M.onlineCounts(D, scope, r.from, r.to, cfg), op = M.onlineCounts(D, scope, pr.from, pr.to, cfg);
      const activeN = M.activeClassIds(D, scope, Math.min(r.to - 1, now)).length;
      root.appendChild(UI.kpis([
        { label: 'Lớp đang hoạt động', value: F.int(activeN), sub: ctx.groupId ? ctx.groupName(ctx.groupId) : 'toàn trường', ref: 'M-OPS-00' },
        { label: 'Nhiệm vụ đã giao (hạn trong kỳ)', value: F.int(tc.tasks), sub: tc.overdueTasks + ' đã quá hạn · ' + tc.openTasks + ' đang mở (' + F.int(tc.OPEN_SUBMITTED) + '/' + F.int(tc.OPEN) + ' lượt đã nộp)', ref: 'M-HW-11', delta: { cur: tc.tasks, prev: tp.tasks, kind: 'count', complete: r.isComplete } },
        { label: 'Khóa trực tuyến đã giao (hạn trong kỳ)', value: F.int(oc.assignments), sub: F.int(oc.students) + ' lượt học sinh–khóa', ref: 'M-ONL', delta: { cur: oc.assignments, prev: op.assignments, kind: 'count', complete: r.isComplete } },
        { label: 'Tỉ lệ làm bài đúng hạn', value: F.pct(rc.onTime), sub: F.int(tc.ON_TIME) + '/' + F.int(tc.overdue) + ' · muộn ' + F.pct(rc.late, 0) + ' · KHT ' + F.pct(rc.missing, 0) + ' · nộp chưa đủ ' + F.pct(rc.partial, 0), ref: 'M-HW-02', delta: { cur: rc.onTime, prev: rp.onTime, kind: 'rate', goodUp: true } },
        { label: 'Hoàn thành khóa TT đúng hạn', value: F.pct(oc.onTimeRate), sub: F.int(oc.ON_TIME) + '/' + F.int(oc.closed) + ' lượt' + (oc.OPEN ? ' · ' + F.int(oc.OPEN) + ' đang mở' : ''), ref: 'M-ONL-05', delta: { cur: oc.onTimeRate, prev: op.onTimeRate, kind: 'rate', goodUp: true } },
        { label: 'Điểm TB nhiệm vụ toàn trường', value: F.score(rc.avgScore), sub: F.int(tc.graded) + ' bài đã chấm (thang 10)', ref: 'M-HW-07', delta: { cur: rc.avgScore, prev: rp.avgScore, kind: 'score', goodUp: true } },
        { label: 'Điểm TB khóa trực tuyến', value: oc.avgScore === null ? '–' : F.num(oc.avgScore, 1), sub: F.int(oc.scored) + ' học sinh có điểm kiểm tra (thang 100)', ref: 'M-ONL-10', delta: { cur: oc.avgScore, prev: op.avgScore, kind: 'score', goodUp: true } }
      ]));
      root.appendChild(el('div', { class: 'muted small', text: 'Kỳ: ' + r.label + ' · so với kỳ trước: ' + pr.label + '. Tỉ lệ chỉ tính nhiệm vụ đã quá hạn; nhiệm vụ đang mở hiển thị riêng. Điểm tổng hợp khóa TT = ' + 'w₁ × tỉ lệ hoàn thành bài tập + w₂ × điểm kiểm tra.' }));

      // ---- Top lớp — nhiệm vụ
      root.appendChild(UI.section('Nhiệm vụ', r.label));
      const g1 = el('div', { class: 'grid g3' });
      root.appendChild(g1);
      g1.appendChild(V.rankCard(ctx, { key: 'taskOnTime', title: 'Top lớp làm nhiệm vụ đúng hạn nhất', question: 'Lớp nào nộp nhiệm vụ đúng hạn tốt nhất?', from: r.from, to: r.to, windowLabel: r.label, tab: 'homework' }));
      g1.appendChild(V.rankCard(ctx, { key: 'taskLateMissing', title: 'Top lớp muộn / không hoàn thành nhiều nhất', question: 'Lớp nào nộp muộn hoặc bỏ bài nhiều nhất?', from: r.from, to: r.to, windowLabel: r.label, tab: 'homework', desc: true }));
      const scoreCard = V.rankCard(ctx, { key: 'taskScore', title: 'Top lớp điểm nhiệm vụ trung bình cao nhất', question: 'Lớp nào có điểm nhiệm vụ trung bình cao nhất, thấp nhất?', from: r.from, to: r.to, windowLabel: r.label, tab: 'homework', cause: true, popupTitle: 'So sánh điểm trung bình nhiệm vụ giữa các lớp' });
      scoreCard.querySelector('.card-head h3').after(el('span', { class: 'badge fix', title: 'Spec gốc ghi nhầm popup là "tỉ lệ làm bài đúng hạn"; popup hiển thị điểm TB từng lớp', text: 'Sửa spec' }));
      g1.appendChild(scoreCard);

      // ---- Top lớp — khóa trực tuyến
      root.appendChild(el('div', { id: 'online' }));
      root.appendChild(UI.section('Khóa trực tuyến', 'Theo hạn hoàn thành trong kỳ · ' + r.label));
      const g2 = el('div', { class: 'grid g3' });
      root.appendChild(g2);
      g2.appendChild(V.rankCard(ctx, { key: 'onlineOnTime', title: 'Top lớp hoàn thành khóa TT đúng hạn nhất', question: 'Lớp nào hoàn thành khóa trực tuyến đúng hạn tốt nhất?', from: r.from, to: r.to, windowLabel: r.label, tab: 'homework' }));
      g2.appendChild(V.rankCard(ctx, { key: 'onlineMissing', title: 'Top lớp không hoàn thành khóa TT nhiều nhất', question: 'Lớp nào có nhiều học sinh không hoàn thành khóa trực tuyến?', from: r.from, to: r.to, windowLabel: r.label, tab: 'homework', desc: true }));
      g2.appendChild(V.rankCard(ctx, { key: 'onlineScore', title: 'Top lớp điểm khóa trực tuyến cao nhất', question: 'Lớp nào có điểm tổng hợp khóa trực tuyến cao nhất?', from: r.from, to: r.to, windowLabel: r.label, tab: 'homework', cause: true }));

      root.appendChild(UI.alertBlock({ alerts: A.filter(ctx.alerts(), { groups: ['HW', 'ONL'], groupId: ctx.groupId, courseId: ctx.courseId }), title: 'Cảnh báo học ở nhà (HW, ONL)', moreHref: 'alerts.html' + GT.qs.build({ displayGroup: 'HOME', groupId: ctx.groupId }), note: 'Cảnh báo đánh giá tại thời điểm hiện tại theo cửa sổ của từng quy tắc (không phụ thuộc kỳ đang xem).' }));

      // ---- [ĐX] Boxplot + scatter
      const row = el('div', { class: 'grid g2' });
      root.appendChild(row);
      const byGroup = !ctx.groupId;
      const units = byGroup ? D.groups.map(function (g) { return { id: g.id, name: g.name, scope: { groupIds: [g.id], courseIds: ctx.scope.courseIds } }; })
        : ctx.classIdsInScope().map(function (c) { return { id: c, name: ctx.className(c), scope: { classIds: [c], courseIds: ctx.scope.courseIds } }; });
      row.appendChild(UI.card({
        title: 'Phân bố điểm nhiệm vụ theo ' + (byGroup ? 'nhóm lớp' : 'lớp'), proposal: true,
        question: 'Hai ' + (byGroup ? 'nhóm' : 'lớp') + ' cùng điểm TB — bên nào đồng đều, bên nào phân hóa mạnh?',
        chart: {
          height: 300,
          build: function () {
            const sc = units.map(function (u) { return M.taskScores(D, u.scope, r.from, r.to); });
            return GT.charts.boxplot({ categories: units.map(function (u) { return u.name; }), boxes: sc.map(S.boxplot), counts: sc.map(function (x) { return x.length; }), means: sc.map(S.mean), empty: { title: 'Chưa có bài được chấm', text: '' } });
          },
          onClick: function (p) { const u = units[p.dataIndex]; if (!u) return; if (byGroup) ctx.set({ groupId: u.id }); else window.location.href = ctx.href('class.html', { classId: u.id, tab: 'homework', groupId: null }); }
        },
        note: 'Hộp = Q1–Q3, vạch giữa = trung vị, râu = thấp nhất/cao nhất. Chọn một nhóm lớp để xem theo từng lớp.'
      }));
      const classIds = ctx.classIdsInScope(Math.min(r.to - 1, now));
      const pts = classIds.map(function (cid) {
        const c = M.taskCounts(D, { classIds: [cid], courseIds: ctx.scope.courseIds }, r.from, r.to);
        const cl = D.classById.get(cid);
        return { id: cid, name: ctx.className(cid), x: c.overdue >= cfg.ranking.minSample ? M.taskRates(c).onTime * 100 : null, y: c.graded ? M.taskRates(c).avgScore : null, n: c.overdue, color: C.group[cl.groupId] };
      });
      const valid = pts.filter(function (p) { return p.x !== null && p.y !== null; });
      row.appendChild(UI.card({
        title: 'Lớp: tỉ lệ nộp đúng hạn × điểm TB', proposal: true,
        question: 'Lớp nào làm đủ nhưng điểm thấp (vấn đề kiến thức), lớp nào điểm ổn nhưng không làm bài (vấn đề kỷ luật)?',
        chart: {
          height: 300,
          build: function () {
            return GT.charts.scatter({
              points: pts, xName: 'Nộp đúng hạn (%)', yName: 'Điểm TB', xFmt: function (v) { return F.num(v, 0) + '%'; }, yFmt: function (v) { return F.num(v, 1); },
              xMid: S.median(valid.map(function (p) { return p.x; })), yMid: S.median(valid.map(function (p) { return p.y; })), nLabel: 'Lượt nộp (quá hạn)',
              quadrants: ['Điểm ổn nhưng ít nộp đúng hạn → kỷ luật', 'Làm đủ, điểm tốt', 'Ít nộp, điểm thấp', 'Làm đủ nhưng điểm thấp → kiến thức'],
              empty: { title: 'Chưa đủ dữ liệu', text: 'Cần ≥ ' + cfg.ranking.minSample + ' lượt nộp mỗi lớp.' }
            });
          },
          onClick: function (p) { const it = valid[p.dataIndex]; if (it) window.location.href = ctx.href('class.html', { classId: it.id, tab: 'homework', groupId: null }); }
        },
        legend: D.groups.map(function (g) { return { color: C.group[g.id], label: g.name }; }),
        cause: true,
        note: 'Vạch = trung vị các lớp; lớp có < ' + cfg.ranking.minSample + ' lượt nộp không hiển thị.'
      }));

      // ---- [ĐX] Xu hướng tuần (2 biểu đồ, không dùng 2 trục)
      const weeks = GT.period.buckets(D.meta.dataStart, now + 1, 'week');
      const series = function (fn, name, short) {
        const list = [{ name: 'Toàn trường', short: 'Trường', color: '#3F4452', width: 3, data: weeks.map(function (w) { return fn({ courseIds: ctx.scope.courseIds }, w); }) }];
        D.groups.forEach(function (g) { list.push({ name: g.name, short: g.name.replace('Lớp tiếng Anh tăng cường', 'TA tăng cường'), color: C.group[g.id], width: 1.5, data: weeks.map(function (w) { return fn({ groupIds: [g.id], courseIds: ctx.scope.courseIds }, w); }) }); });
        return list;
      };
      const onT = function (sc, w) { const c = M.taskCounts(D, sc, w.from, Math.min(w.to, now + 1)); return c.overdue ? M.taskRates(c).onTime * 100 : null; };
      const avgS = function (sc, w) { const c = M.taskCounts(D, sc, w.from, w.to); return c.graded ? M.taskRates(c).avgScore : null; };
      const row2 = el('div', { class: 'grid g2' });
      root.appendChild(row2);
      [['Tỉ lệ nộp đúng hạn theo tuần', onT, function (v) { return F.num(v, 1) + '%'; }, GT.charts.pctAxis], ['Điểm TB nhiệm vụ theo tuần', avgS, function (v) { return F.num(v, 1); }, function (v) { return F.num(v, 0); }]].forEach(function (cfgx, i) {
        row2.appendChild(UI.card({
          title: cfgx[0], proposal: true,
          question: i === 0 ? 'Kỷ luật nộp bài của trường và từng nhóm lớp đang tốt lên hay xấu đi?' : 'Điểm nhiệm vụ của trường và từng nhóm lớp thay đổi ra sao?',
          chart: {
            height: 280,
            build: function () {
              return GT.charts.line({ categories: weeks.map(function (w) { return w.label; }), fmt: cfgx[2], axisFmt: cfgx[3], series: series(cfgx[1]), endLabels: false, tipTitle: function (k) { return 'Tuần ' + DT.fmtDate(weeks[k].from); } });
            }
          },
          note: 'Đường đậm = toàn trường; các đường mảnh = nhóm lớp (màu cố định theo nhóm). Hai chỉ số khác thang nên tách 2 biểu đồ, không dùng 2 trục.'
        }));
      });

      // ---- [ĐX] Funnel + tiến độ thực tế vs kỳ vọng
      const row3 = el('div', { class: 'grid g2' });
      root.appendChild(row3);
      const tRef = Math.min(r.to - 1, now);
      const fn = M.onlineFunnel(D, scope, r.from, r.to, tRef, cfg);
      row3.appendChild(UI.card({
        title: 'Funnel khóa trực tuyến', proposal: true,
        question: 'Học sinh rơi rụng ở bước nào: chưa bắt đầu, bỏ dở, hay hoàn thành nhưng không đạt?',
        chart: {
          height: 260,
          build: function () {
            return GT.charts.funnel({
              stages: [{ name: 'Được giao', value: fn.assigned }, { name: 'Đã bắt đầu', value: fn.started, hint: 'Hoàn thành ≥ 1 mục' }, { name: 'Đang học', value: fn.active, hint: 'Hoàn thành ≥ ' + cfg.online.activeLearningPct + '% nội dung' }, { name: 'Hoàn thành', value: fn.completed }, { name: 'Đạt ngưỡng điểm tổng hợp', value: fn.passed }],
              empty: { title: 'Không có khóa trực tuyến trong kỳ', text: 'Không có khóa trực tuyến nào được giao/đang diễn ra trong ' + r.label + '.' }
            });
          }
        },
        note: 'Khóa trực tuyến diễn ra (một phần) trong kỳ, đo tại ' + DT.fmtDateTime(tRef) + '. Lọc theo khóa ở bộ lọc phía trên.'
      }));
      const pc = V.onlineProgressCard(ctx, { classIds: ctx.classIdsInScope(), courseIds: ctx.scope.courseIds, t: tRef });
      row3.appendChild(pc);
      pc.querySelector('.card-body > div').classList.remove('g2');

      // ---- [ĐX] Nhiệm vụ bất thường
      const an = M.taskAnomalies(D, scope, r.from, r.to, cfg);
      root.appendChild(UI.card({
        title: 'Nhiệm vụ bất thường', proposal: true,
        question: 'Vấn đề nằm ở đề bài/học liệu hay ở học sinh?',
        body: UI.table({
          columns: [
            { key: 'due', label: 'Hạn', value: function (x) { return x.stats.task.dueAt; }, fmt: function (x) { return DT.fmtDate(x.stats.task.dueAt); } },
            { key: 'cls', label: 'Lớp', value: function (x) { return ctx.className(x.stats.task.classId); } },
            { key: 'title', label: 'Nhiệm vụ', minWidth: '220px', value: function (x) { return x.stats.task.title; }, fmt: function (x) { return esc(x.stats.task.title) + '<div class="muted small">' + esc(ctx.courseName(x.stats.task.courseId)) + ' · ' + x.stats.task.itemCount + ' bài nhỏ</div>'; } },
            { key: 'rate', label: 'Tỉ lệ nộp', align: 'r', value: function (x) { return x.stats.submitRate; }, fmt: function (x) { return (x.flagRate ? '<b style="color:var(--bad-text)">' : '') + F.pct(x.stats.submitRate) + (x.flagRate ? '</b>' : '') + '<div class="muted small">trung vị khóa ' + F.pct(x.baseline.rate, 0) + '</div>'; } },
            { key: 'score', label: 'Điểm TB', align: 'r', value: function (x) { return x.stats.avgScore; }, fmt: function (x) { return (x.flagScore ? '<b style="color:var(--bad-text)">' : '') + F.score(x.stats.avgScore) + (x.flagScore ? '</b>' : '') + '<div class="muted small">trung vị khóa ' + F.score(x.baseline.score) + '</div>'; } },
            { key: 'same', label: 'Cùng đề ở lớp khác', sort: false, fmt: function (x) {
              const same = (D.idx.tasksByCourse.get(x.stats.task.courseId) || []).filter(function (t) { return t.title === x.stats.task.title && t.id !== x.stats.task.id && t.dueAt <= now; });
              if (!same.length) return '<span class="muted">–</span>';
              const st = same.map(function (t) { return M.taskStats(D, t); });
              const low = st.filter(function (s) { return (s.avgScore !== null && x.baseline.score !== null && x.baseline.score - s.avgScore >= cfg.homework.anomalyScoreGap) || (s.submitRate !== null && x.baseline.rate !== null && (x.baseline.rate - s.submitRate) * 100 >= cfg.homework.anomalyRateGapPts); }).length;
              return low + '/' + same.length + ' lớp cũng thấp' + (low >= Math.ceil(same.length / 2) ? ' <span class="badge cur">nghi vấn đề bài</span>' : '');
            } }
          ],
          rows: an, sort: { key: 'due', dir: -1 }, capped: true, csv: 'nhiem-vu-bat-thuong.csv', empty: 'Không có nhiệm vụ nào thấp hơn hẳn các nhiệm vụ cùng khóa trong kỳ.'
        }),
        note: 'So với trung vị các nhiệm vụ đã quá hạn cùng khóa (từ đầu khóa): tỉ lệ nộp thấp hơn ≥ ' + cfg.homework.anomalyRateGapPts + ' điểm % hoặc điểm TB thấp hơn ≥ ' + F.num(cfg.homework.anomalyScoreGap, 1) + ' điểm. Nếu cùng một đề thấp ở nhiều lớp → nghi vấn đề bài/học liệu.'
      }));

      // ---- [ĐX] Thời điểm nộp so với hạn + học sinh không hoàn thành nhiều nhất
      const row4 = el('div', { class: 'grid g2' });
      root.appendChild(row4);
      const tm = [{ name: 'Toàn trường', b: M.submissionTiming(D, scope, r.from, r.to) }].concat(D.groups.map(function (g) { return { name: g.name, b: M.submissionTiming(D, { groupIds: [g.id], courseIds: ctx.scope.courseIds }, r.from, r.to) }; }));
      row4.appendChild(UI.card({
        title: 'Thời điểm nộp bài so với hạn', proposal: true,
        question: 'Học sinh làm bài sớm hay dồn sát hạn; nhóm lớp nào hay nộp muộn?',
        chart: {
          height: 300,
          build: function () {
            return GT.charts.stack({ categories: tm.map(function (x) { return x.name; }), horizontal: true, percent: true, unit: 'bài nộp', series: M.TIMING_BUCKETS.map(function (k) { return { name: L.timing[k], color: C.timing[k], data: tm.map(function (x) { return x.b[k]; }) }; }) });
          }
        },
        note: 'Bài nộp của nhiệm vụ đã quá hạn trong kỳ; mốc tính từ thời điểm nộp đến hạn nộp.'
      }));
      const byStu = M.taskByStudent(D, scope, r.from, r.to);
      const rows = Array.from(byStu.entries()).map(function (e) { return { sid: e[0], g: e[1] }; }).filter(function (x) { return x.g.MISSING > 0; });
      row4.appendChild(UI.card({
        title: 'Học sinh không hoàn thành nhiều nhất', proposal: true,
        question: 'Học sinh nào bỏ nhiều nhiệm vụ nhất toàn trường?',
        body: UI.table({
          columns: [
            { key: 'name', label: 'Học sinh', value: function (x) { return ctx.studentName(x.sid); }, fmt: function (x) { return UI.link(ctx.href('student.html', { studentId: x.sid }), ctx.studentName(x.sid)) + '<div class="muted small">' + esc(Array.from(x.g.classes).map(ctx.className).join(', ')) + '</div>'; } },
            { key: 'miss', label: 'Không hoàn thành', align: 'r', value: function (x) { return x.g.MISSING; } },
            { key: 'over', label: 'Đã quá hạn', align: 'r', value: function (x) { return x.g.overdue; } },
            { key: 'rate', label: '% KHT', align: 'r', value: function (x) { return x.g.MISSING / x.g.overdue; }, fmt: function (x) { return F.pct(x.g.MISSING / x.g.overdue); } },
            { key: 'avg', label: 'Điểm TB', align: 'r', value: function (x) { return x.g.graded ? x.g.scoreSum / x.g.graded : null; }, fmt: function (x) { return F.score(x.g.graded ? x.g.scoreSum / x.g.graded : null); } }
          ],
          rows: rows, sort: { key: 'miss', dir: -1 }, limit: 50, capped: true, csv: 'hoc-sinh-khong-hoan-thanh.csv',
          onRow: function (x) { window.location.href = ctx.href('student.html', { studentId: x.sid }); }, empty: 'Không có học sinh nào bỏ nhiệm vụ trong kỳ.'
        })
      }));
      if (window.location.hash === '#online') setTimeout(function () { const o = document.getElementById('online'); if (o) o.scrollIntoView(); }, 50);
    }
  });
})(window.GT);
