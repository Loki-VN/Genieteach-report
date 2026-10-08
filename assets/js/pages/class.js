/**
 * hoc-vu/class.html — 4.6 Báo cáo lớp học (4 tab: Tổng quan · Chuyên cần · Bài về nhà · Phân tích học tập).
 * Chọn một lớp → báo cáo lớp. "Tất cả" hoặc một nhóm lớp → chế độ so sánh giữa lớp (OQ-45).
 * [SỬA SPEC] Filter khóa lấy mọi khóa của lớp (SP-SS-03); khóa trực tuyến nằm trong tab Bài về nhà (#online, SP-SS-04).
 */
(function (GT) {
  'use strict';
  const M = GT.metrics, A = GT.alerts, UI = GT.ui, V = GT.views, F = GT.fmt, DT = GT.date, C = GT.colors, L = GT.labels, S = GT.stats;
  const el = UI.el, esc = UI.esc;
  const DAY = DT.DAY;
  const TABS = [['overview', 'Tổng quan'], ['attendance', 'Chuyên cần'], ['homework', 'Bài về nhà'], ['learning', 'Phân tích học tập']];

  function classCourseIds(D, cid) { return (D.idx.classCoursesByClass.get(cid) || []).map(function (cc) { return cc.courseId; }); }

  GT.page({
    id: 'class',
    title: 'Báo cáo lớp học',
    subtitle: 'Một lớp: báo cáo chi tiết · Tất cả / một nhóm lớp: so sánh giữa các lớp',
    filters: {
      period: 'week', group: true, class: true,
      extra: function (box, ctx) {
        const D = ctx.D;
        const ids = ctx.classId ? classCourseIds(D, ctx.classId) : D.courses.map(function (c) { return c.id; });
        box.appendChild(UI.select('Khóa học', ids.map(function (id) { return { value: id, label: ctx.courseName(id) }; }), ids.indexOf(ctx.courseId) >= 0 ? ctx.courseId : null,
          function (v) { ctx.set({ courseId: v }); }, ctx.classId ? 'Tất cả khóa của lớp' : 'Tất cả khóa học'));
      }
    },
    render: function (ctx, root) {
      const D = ctx.D;
      const tab = TABS.some(function (t) { return t[0] === ctx.q.tab; }) ? ctx.q.tab : 'overview';
      if (ctx.classId && ctx.courseId && classCourseIds(D, ctx.classId).indexOf(ctx.courseId) < 0) { ctx.courseId = null; ctx.scope.courseIds = null; }
      // Tabs
      const tabs = el('nav', { class: 'tabs', 'aria-label': 'Tab báo cáo lớp' }, TABS.map(function (t) {
        return el('a', { href: ctx.href('class.html', { tab: t[0], classId: ctx.classId, groupId: ctx.groupId }), class: t[0] === tab ? 'on' : null, 'aria-current': t[0] === tab ? 'page' : null, text: t[1] });
      }));
      if (ctx.classId) {
        const c = D.classById.get(ctx.classId);
        const roster = M.roster(D, c.id, ctx.now);
        root.appendChild(el('div', { class: 'section-title' }, [
          el('h2', { text: 'Lớp ' + c.name }),
          el('span', { class: 'muted', text: ctx.groupName(c.groupId) + ' · sĩ số ' + roster.length + ' · GVCN: ' + (c.homeroomTeacherId ? ctx.teacherName(c.homeroomTeacherId) : 'không có') + ' · kỳ: ' + ctx.range.label }),
          el('a', { class: 'btn sm', href: ctx.href('class.html', { classId: null }), text: 'So sánh các lớp' + (ctx.groupId ? ' trong nhóm' : '') })
        ]));
      } else {
        root.appendChild(el('div', { class: 'callout' }, [el('b', { text: 'Chế độ so sánh giữa lớp. ' }), (ctx.groupId ? 'Nhóm ' + ctx.groupName(ctx.groupId) : 'Toàn trường') + ' · kỳ ' + ctx.range.label + '. Chọn một lớp ở bộ lọc (hoặc nhấn vào lớp trên biểu đồ) để xem báo cáo chi tiết của lớp.']));
      }
      root.appendChild(tabs);
      const fn = (ctx.classId ? SINGLE : COMPARE)[tab];
      fn(ctx, root);
    }
  });

  // =====================================================================================
  // Một lớp
  // =====================================================================================
  const SINGLE = {};

  SINGLE.overview = function (ctx, root) {
    const D = ctx.D, now = ctx.now, cid = ctx.classId, r = ctx.range;
    const c = D.classById.get(cid);
    const roster = M.roster(D, cid, now);
    const ccs = M.activeClassCourses(D, cid, now);
    const openTasks = (D.idx.tasksByClass.get(cid) || []).filter(function (t) { return t.assignedAt <= now && now < t.dueAt; });
    const run = M.onlineRunning(D, { classIds: [cid] }, now, ctx.cfg);
    const multi = roster.filter(function (sid) { return M.studentClasses(D, sid, now).length > 1; }).length;
    root.appendChild(UI.kpis([
      { label: 'Sĩ số', value: F.int(roster.length), sub: multi ? multi + ' học sinh học thêm lớp khác' : 'ghi danh hiệu lực hôm nay' },
      { label: 'Khóa đang học', value: F.int(ccs.length), sub: ccs.map(function (cc) { return D.courseById.get(cc.courseId).shortName; }).join(', ') || '–' },
      { label: 'Nhiệm vụ đang thực hiện', value: F.int(openTasks.length), sub: 'Xem tab Bài về nhà →', href: ctx.href('class.html', { tab: 'homework' }) },
      { label: 'Khóa trực tuyến đang thực hiện', value: F.int(run.length), sub: run.map(function (x) { return x.assignment.title; }).join(' · ') || 'Xem tab Bài về nhà →', href: ctx.href('class.html', { tab: 'homework', '#': 'online' }) }
    ]));
    const row = el('div', { class: 'grid g2' });
    root.appendChild(row);
    // [ĐX] Giáo viên
    const allCc = D.idx.classCoursesByClass.get(cid) || [];
    row.appendChild(UI.card({
      title: 'Giáo viên phụ trách', proposal: true, question: 'Ai phụ trách từng khóa của lớp, ai là GVCN?',
      body: UI.table({
        columns: [
          { key: 'course', label: 'Khóa học', value: function (x) { return D.courseById.get(x.courseId).name; } },
          { key: 'gv', label: 'Giáo viên', value: function (x) { return x.teacherIds.map(ctx.teacherName).join(', '); } },
          { key: 'time', label: 'Thời gian khóa', value: function (x) { return x.startAt; }, fmt: function (x) { return DT.fmtDate(x.startAt) + ' – ' + DT.fmtDate(x.endAt); } },
          { key: 'n', label: 'Buổi đã học', align: 'r', value: function (x) { return M.sessionsIn(D, { classIds: [cid], courseIds: [x.courseId] }, x.startAt, now + 1).length; } }
        ], rows: allCc, csv: false
      }),
      note: 'GVCN: ' + esc(c.homeroomTeacherId ? ctx.teacherName(c.homeroomTeacherId) : 'không có (lớp tăng cường)') + '. Thông tin để liên hệ, không dùng để đánh giá giáo viên.'
    }));
    // [ĐX] Benchmark
    const km = M.keyMetrics(D, { classIds: [cid] }, r.from, r.to, ctx.cfg);
    const kg = M.keyMetrics(D, { groupIds: [c.groupId] }, r.from, r.to, ctx.cfg);
    const ks = M.keyMetrics(D, {}, r.from, r.to, ctx.cfg);
    const mets = M.KEY_METRICS.filter(function (m) { return m.key !== 'reported'; });
    row.appendChild(UI.card({
      title: 'Benchmark: lớp vs nhóm lớp vs trường', proposal: true,
      question: 'Lớp này tốt hay kém so với ai?',
      chart: {
        height: 280,
        build: function () {
          return GT.charts.bullet({
            names: ['Lớp ' + c.name, 'TB ' + ctx.groupName(c.groupId), 'TB trường'],
            metrics: mets.map(function (m) { return { label: m.label, kind: m.kind, value: km[m.key].value, group: kg[m.key].value, school: ks[m.key].value }; })
          });
        }
      },
      note: 'Kỳ ' + esc(r.label) + ' (% CĐR Xanh lũy kế). Thang chung 0–100: điểm nhiệm vụ thang 10 quy ra × 10. Các mốc TB đều cộng gộp tử/mẫu.',
      cause: true,
      table: function () {
        const show = function (m, v) { return m.kind === 'score' ? F.score(v) : F.pct(v); };
        return { columns: [{ key: 'l', label: 'Chỉ số' }, { key: 'c', label: 'Lớp', align: 'r' }, { key: 'g', label: 'TB nhóm lớp', align: 'r' }, { key: 's', label: 'TB trường', align: 'r' }, { key: 'n', label: 'Mẫu số (lớp)', align: 'r' }],
          rows: mets.map(function (m) { return { l: m.label, c: show(m, km[m.key].value), g: show(m, kg[m.key].value), s: show(m, ks[m.key].value), n: F.int(km[m.key].n) }; }), csv: 'benchmark-' + cid + '.csv' };
      }
    }));
    root.appendChild(UI.alertBlock({ alerts: A.filter(ctx.alerts(), { classIds: [cid] }), title: 'Cảnh báo của lớp', moreHref: 'alerts.html' + GT.qs.build({ classId: cid }) }));
  };

  SINGLE.attendance = function (ctx, root) {
    const D = ctx.D, now = ctx.now, cid = ctx.classId, r = ctx.range, pr = ctx.prev;
    const scope = { classIds: [cid], courseIds: ctx.scope.courseIds };
    const cur = M.attendanceCounts(D, scope, r.from, r.to), prev = M.attendanceCounts(D, scope, pr.from, pr.to);
    const rc = M.attendanceRates(cur), rp = M.attendanceRates(prev);
    root.appendChild(UI.kpis([
      { label: 'Tỉ lệ có mặt', value: F.pct(rc.present), sub: (cur.ON_TIME + cur.LATE) + '/' + cur.taken + ' lượt', ref: 'M-ATT-07', delta: { cur: rc.present, prev: rp.present, kind: 'rate', goodUp: true } },
      { label: 'Tỉ lệ đúng giờ', value: F.pct(rc.onTime), sub: cur.ON_TIME + ' lượt', ref: 'M-ATT-03', delta: { cur: rc.onTime, prev: rp.onTime, kind: 'rate', goodUp: true } },
      { label: 'Tỉ lệ đi muộn', value: F.pct(rc.late), sub: cur.LATE + ' lượt', ref: 'M-ATT-04', delta: { cur: rc.late, prev: rp.late, kind: 'rate', goodUp: false } },
      { label: 'Vắng không phép', value: F.pct(rc.unexcused), sub: cur.UNEXCUSED + ' lượt · có phép ' + cur.EXCUSED, ref: 'M-ATT-06', delta: { cur: rc.unexcused, prev: rp.unexcused, kind: 'rate', goodUp: false } },
      { label: 'Bản ghi chưa điểm danh', value: F.pct(rc.notTaken), sub: cur.NOT_TAKEN + '/' + cur.total + ' bản ghi', ref: 'M-ATT-08', delta: { cur: rc.notTaken, prev: rp.notTaken, kind: 'rate', goodUp: false } }
    ]));
    const row = el('div', { class: 'grid g2' });
    root.appendChild(row);
    row.appendChild(UI.card({
      title: 'Tình trạng đi học trong kỳ', question: 'Trong kỳ, học sinh của lớp đi học đúng giờ, muộn, vắng ra sao?',
      chart: { height: 270, build: function () { return GT.charts.donut({ items: ['ON_TIME', 'LATE', 'EXCUSED', 'UNEXCUSED'].map(function (k) { return { name: L.att[k], value: cur[k], color: C.att[k] }; }), center: { value: F.pct(rc.present), label: 'có mặt' }, empty: { title: 'Không có dữ liệu điểm danh', text: 'Lớp không có buổi học đã điểm danh trong ' + r.label + '.' } }); } },
      note: 'Chưa điểm danh: ' + F.int(cur.NOT_TAKEN) + ' bản ghi (không vào mẫu số).'
    }));
    // Lịch sử theo tuần/tháng (từ đầu khóa)
    const hist = ctx.q.hist === 'month' ? 'month' : 'week';
    const from0 = D.meta.dataStart;
    const buckets = GT.period.buckets(from0, Math.min(now + 1, D.meta.dataEnd), hist);
    const bc = buckets.map(function (b) { return M.attendanceCounts(D, scope, b.from, b.to); });
    const seg = el('div', { class: 'seg' }, [['week', 'Tuần'], ['month', 'Tháng']].map(function (x) { return el('button', { type: 'button', class: x[0] === hist ? 'on' : null, onclick: function () { ctx.set({ hist: x[0] === 'week' ? null : 'month' }); } }, x[1]); }));
    row.appendChild(UI.card({
      title: 'Lịch sử chuyên cần theo ' + (hist === 'week' ? 'tuần' : 'tháng'), question: 'Chuyên cần của lớp thay đổi thế nào qua các tuần/tháng?', tools: [seg],
      chart: {
        height: 270,
        build: function () {
          return GT.charts.stack({
            categories: buckets.map(function (b) { return b.label; }), percent: true,
            series: ['ON_TIME', 'LATE', 'EXCUSED', 'UNEXCUSED'].map(function (k) { return { name: L.att[k], color: C.att[k], data: bc.map(function (c) { return c[k]; }) }; }),
            tipExtra: function (i) { return bc[i].NOT_TAKEN ? '<div style="color:#6B7180">Chưa điểm danh: ' + bc[i].NOT_TAKEN + ' bản ghi</div>' : ''; }
          });
        }
      },
      note: 'Từ đầu dữ liệu (' + DT.fmtDate(from0) + ') đến hiện tại, không phụ thuộc kỳ đang chọn.'
    }));
    // Top đúng giờ / đi muộn
    const byStu = M.attendanceByStudent(D, scope, r.from, r.to);
    const arr = Array.from(byStu.entries()).filter(function (e) { return e[1].taken > 0; }).map(function (e) { return { sid: e[0], g: e[1], on: e[1].ON_TIME / e[1].taken }; });
    const topOn = arr.slice().sort(function (a, b) { return b.on - a.on || b.g.taken - a.g.taken; }).slice(0, 5);
    const topLate = arr.filter(function (x) { return x.g.LATE > 0; }).sort(function (a, b) { return b.g.LATE - a.g.LATE || a.on - b.on; }).slice(0, 5);
    const list = function (title, items, txt) {
      return el('div', {}, [el('div', { class: 'small', style: { fontWeight: 600, marginBottom: '4px' }, text: title }), items.length ? el('ol', { style: { margin: 0, paddingLeft: '18px', fontSize: '13px' } }, items.map(function (x) {
        return el('li', {}, [el('a', { href: ctx.href('student.html', { studentId: x.sid }), text: ctx.studentName(x.sid) }), el('span', { class: 'muted', text: ' — ' + txt(x) })]);
      })) : el('span', { class: 'muted small', text: 'Không có' })]);
    };
    root.appendChild(UI.card({
      title: 'Học sinh đúng giờ nhất / đi muộn nhiều nhất', question: 'Ai cần được khen, ai cần được nhắc về giờ giấc?',
      body: el('div', { class: 'grid g2' }, [
        list('Top 5 đúng giờ', topOn, function (x) { return F.pct(x.on) + ' đúng giờ · ' + x.g.taken + ' buổi'; }),
        list('Top 5 đi muộn', topLate, function (x) { return x.g.LATE + ' lần muộn / ' + x.g.taken + ' buổi'; })
      ])
    }));
    root.appendChild(UI.alertBlock({ alerts: A.filter(ctx.alerts(), { groups: ['ATT'], classIds: [cid] }), title: 'Cảnh báo chuyên cần (ATT)', moreHref: 'alerts.html' + GT.qs.build({ alertGroup: 'ATT', classId: cid }) }));
    // [ĐX] Heatmap học sinh × buổi
    const sessions = M.sessionsIn(D, scope, r.from, r.to).filter(function (s) { return s.start <= now; });
    const students = arr.slice().sort(function (a, b) { return (b.g.UNEXCUSED + b.g.EXCUSED) - (a.g.UNEXCUSED + a.g.EXCUSED) || b.g.LATE - a.g.LATE; });
    const recIdx = new Map();
    sessions.forEach(function (s) { (D.idx.attBySession.get(s.id) || []).forEach(function (rr) { recIdx.set(s.id + '|' + rr.studentId, rr.status); }); });
    const cells = [];
    students.forEach(function (st, yi) {
      sessions.forEach(function (s, xi) {
        const status = recIdx.get(s.id + '|' + st.sid);
        if (!status) return;
        cells.push({ x: xi, y: yi, color: C.att[status], text: L.attCode[status], tip: '<b>' + esc(ctx.studentName(st.sid)) + '</b><br>' + DT.fmtDateTime(s.start) + ' · ' + esc(D.courseById.get(s.courseId).shortName) + '<br>' + L.att[status] });
      });
    });
    root.appendChild(UI.card({
      title: 'Học sinh × buổi học', proposal: true,
      question: 'Học sinh nào vắng/muộn lặp lại, vào những buổi nào?',
      chart: {
        height: 400,
        build: function () {
          return GT.charts.catHeatmap({
            xCats: sessions.map(function (s) { return DT.fmtDayMonth(s.start) + ' ' + DT.fmtTime(s.start); }), yCats: students.map(function (x) { return ctx.studentName(x.sid) + ' (' + (x.g.UNEXCUSED + x.g.EXCUSED) + ')'; }),
            cells: cells, rowHeight: 20, labelSize: 10, yLabelWidth: 170,
            empty: { title: 'Không có buổi đã điểm danh', text: 'Không có buổi học nào đã diễn ra trong kỳ.' }
          });
        },
        onClick: function (p) { const st = students[p.data.value[1]]; if (st) window.location.href = ctx.href('student.html', { studentId: st.sid }); }
      },
      legend: M.ATT_STATUSES.map(function (k) { return { color: C.att[k], label: L.attCode[k] + ' ' + L.att[k] }; }),
      note: 'Sắp xếp theo số buổi vắng (số trong ngoặc) giảm dần. Chọn kỳ Tháng để xem chuỗi dài hơn.'
    }));
  };

  SINGLE.homework = function (ctx, root) {
    const D = ctx.D, now = ctx.now, cid = ctx.classId, r = ctx.range, pr = ctx.prev, cfg = ctx.cfg;
    const scope = { classIds: [cid], courseIds: ctx.scope.courseIds };
    const cur = M.taskCounts(D, scope, r.from, r.to), prev = M.taskCounts(D, scope, pr.from, pr.to);
    const rc = M.taskRates(cur), rp = M.taskRates(prev);
    root.appendChild(UI.kpis([
      { label: 'Nhiệm vụ đến hạn trong kỳ', value: F.int(cur.tasks), sub: cur.overdueTasks + ' đã quá hạn · ' + cur.openTasks + ' đang mở', delta: { cur: cur.tasks, prev: prev.tasks, kind: 'count', complete: r.isComplete } },
      { label: 'Tỉ lệ đúng hạn', value: F.pct(rc.onTime), sub: cur.ON_TIME + '/' + cur.overdue + ' lượt', ref: 'M-HW-02', delta: { cur: rc.onTime, prev: rp.onTime, kind: 'rate', goodUp: true } },
      { label: 'Không hoàn thành', value: F.pct(rc.missing), sub: cur.MISSING + ' lượt · muộn ' + cur.LATE, ref: 'M-HW-04', delta: { cur: rc.missing, prev: rp.missing, kind: 'rate', goodUp: false } },
      { label: 'Nộp chưa đủ', value: F.pct(rc.partial), sub: cur.PARTIAL + ' lượt', ref: 'M-HW-05' },
      { label: 'Điểm TB nhiệm vụ', value: F.score(rc.avgScore), sub: cur.graded + ' bài đã chấm (thang 10)', ref: 'M-HW-07', delta: { cur: rc.avgScore, prev: rp.avgScore, kind: 'score', goodUp: true } }
    ]));
    const tasks = M.tasksIn(D, scope, r.from, r.to);
    const stats = tasks.map(function (t) { return M.taskStats(D, t); });
    const tlabel = function (t) { return DT.fmtDayMonth(t.dueAt) + ' ' + D.courseById.get(t.courseId).shortName; };
    const row = el('div', { class: 'grid g2' });
    root.appendChild(row);
    row.appendChild(UI.card({
      title: 'Nhiệm vụ: đúng hạn / muộn / không hoàn thành', question: 'Từng nhiệm vụ trong kỳ được lớp hoàn thành ra sao?',
      chart: {
        height: 300,
        build: function () {
          return GT.charts.stack({
            categories: tasks.map(tlabel), percent: true, unit: 'học sinh', rotate: tasks.length > 6 ? 35 : 0, interval: 0,
            tipTitle: function (i) { return tasks[i].title + ' · hạn ' + DT.fmtDateTime(tasks[i].dueAt); },
            series: ['ON_TIME', 'LATE', 'MISSING', 'OPEN'].map(function (k) { return { name: L.task[k], color: C.task[k], data: stats.map(function (s) { return s[k]; }) }; }),
            empty: { title: 'Không có nhiệm vụ đến hạn', text: 'Không có nhiệm vụ nào có hạn trong ' + r.label + '.' }
          });
        }
      },
      table: function () { return taskTable(ctx, stats, tlabel); }
    }));
    row.appendChild(UI.card({
      title: 'Điểm trung bình theo nhiệm vụ', question: 'Nhiệm vụ nào lớp làm điểm thấp bất thường?',
      chart: {
        height: 300,
        build: function () {
          return GT.charts.columns({
            categories: tasks.map(tlabel), rotate: tasks.length > 6 ? 35 : 0, interval: 0, max: 10, min: 0,
            series: [{ name: 'Điểm TB', color: C.accent, data: stats.map(function (s) { return s.avgScore === null ? null : +s.avgScore.toFixed(2); }), labels: tasks.length <= 12, marks: rc.avgScore !== null ? [{ value: rc.avgScore, label: 'TB lớp ' + F.score(rc.avgScore) }] : null }],
            fmt: function (v) { return F.num(v, 1); }, tipExtra: function (i) { return '<div style="color:#6B7180">' + esc(tasks[i].title) + '<br>' + stats[i].graded + ' bài đã chấm · ' + stats[i].ungraded + ' chưa chấm</div>'; },
            empty: { title: 'Chưa có bài được chấm', text: '' }
          });
        }
      },
      table: function () { return taskTable(ctx, stats, tlabel); }
    }));
    // Top học sinh
    const byStu = M.taskByStudent(D, scope, r.from, r.to);
    const arr = Array.from(byStu.entries()).map(function (e) { const g = e[1]; return { sid: e[0], g: g, full: g.overdue ? g.FULL / g.overdue : null, avg: g.graded ? g.scoreSum / g.graded : null }; });
    const withO = arr.filter(function (x) { return x.g.overdue > 0; });
    const topFull = withO.slice().sort(function (a, b) { return b.full - a.full || b.g.overdue - a.g.overdue; }).slice(0, 5);
    const topMiss = withO.filter(function (x) { return x.g.MISSING > 0; }).sort(function (a, b) { return b.g.MISSING - a.g.MISSING; }).slice(0, 5);
    const minG = stats.length >= 4 ? 2 : 1;
    const withS = arr.filter(function (x) { return x.g.graded >= minG; });
    const topHi = withS.slice().sort(function (a, b) { return b.avg - a.avg; }).slice(0, 5);
    const topLo = withS.slice().sort(function (a, b) { return a.avg - b.avg; }).slice(0, 5);
    const list = function (title, items, txt) {
      return el('div', {}, [el('div', { class: 'small', style: { fontWeight: 600, marginBottom: '4px' }, text: title }), items.length ? el('ol', { style: { margin: 0, paddingLeft: '18px', fontSize: '13px' } }, items.map(function (x) {
        return el('li', {}, [el('a', { href: ctx.href('student.html', { studentId: x.sid }), text: ctx.studentName(x.sid) }), el('span', { class: 'muted', text: ' — ' + txt(x) })]);
      })) : el('span', { class: 'muted small', text: 'Không có' })]);
    };
    root.appendChild(UI.card({
      title: 'Top học sinh', question: 'Ai làm bài đầy đủ, ai bỏ bài nhiều; ai điểm cao, ai điểm thấp?',
      body: el('div', { class: 'grid g4' }, [
        list('Top 5 làm đủ nhất', topFull, function (x) { return F.pct(x.full, 0) + ' nộp đủ · ' + x.g.overdue + ' nhiệm vụ'; }),
        list('Top 5 không hoàn thành nhiều nhất', topMiss, function (x) { return x.g.MISSING + '/' + x.g.overdue + ' nhiệm vụ'; }),
        list('Top 5 điểm cao nhất', topHi, function (x) { return F.score(x.avg) + ' · ' + x.g.graded + ' bài'; }),
        list('Top 5 điểm thấp nhất', topLo, function (x) { return F.score(x.avg) + ' · ' + x.g.graded + ' bài'; })
      ]),
      note: '"Làm đủ" = nộp đủ số bài (đúng hạn hoặc muộn) trên nhiệm vụ đã quá hạn (OQ-36). Điểm TB chỉ tính học sinh có ≥ ' + minG + ' bài đã chấm trong kỳ.'
    }));
    // [ĐX] Histogram + scatter
    const row2 = el('div', { class: 'grid g2' });
    root.appendChild(row2);
    const scores = M.taskScores(D, scope, r.from, r.to);
    const bins = [], counts = [];
    for (let i = 0; i < 10; i++) { bins.push(i + '–' + (i + 1)); counts.push(scores.filter(function (v) { return i === 9 ? v >= 9 : v >= i && v < i + 1; }).length); }
    row2.appendChild(UI.card({
      title: 'Phân bố điểm nhiệm vụ', proposal: true, question: 'Điểm của lớp đồng đều hay phân hóa mạnh?',
      chart: { height: 260, build: function () { return GT.charts.histogram({ bins: bins, counts: counts, yName: 'Số bài', xName: 'Điểm (thang 10)', empty: { title: 'Chưa có bài được chấm', text: '' } }); } },
      note: F.int(scores.length) + ' bài đã chấm trong kỳ; trung vị ' + F.score(S.median(scores)) + '.'
    }));
    const pts = arr.filter(function (x) { return x.g.overdue > 0 && x.avg !== null; }).map(function (x) {
      return { id: x.sid, name: ctx.studentName(x.sid), x: (x.g.ON_TIME + x.g.LATE) / x.g.overdue * 100, y: x.avg, n: x.g.overdue };
    });
    row2.appendChild(UI.card({
      title: 'Học sinh: tỉ lệ hoàn thành × điểm TB', proposal: true,
      question: 'Ai làm đủ nhưng điểm thấp (cần hỗ trợ kiến thức), ai điểm ổn nhưng bỏ bài (cần nhắc kỷ luật)?',
      chart: {
        height: 300,
        build: function () {
          return GT.charts.scatter({
            points: pts, xName: 'Tỉ lệ nộp (%)', yName: 'Điểm TB', xFmt: function (v) { return F.num(v, 0) + '%'; }, yFmt: function (v) { return F.num(v, 1); },
            xMid: S.median(pts.map(function (p) { return p.x; })), yMid: S.median(pts.map(function (p) { return p.y; })), xMax: 100, yMin: 0, yMax: 10, nLabel: 'Nhiệm vụ đã quá hạn', labels: false,
            quadrants: ['Điểm ổn nhưng bỏ bài', 'Làm đủ, điểm tốt', 'Bỏ bài, điểm thấp', 'Làm đủ nhưng điểm thấp'], empty: { title: 'Chưa đủ dữ liệu', text: '' }
          });
        },
        onClick: function (p) { const it = pts[p.dataIndex]; if (it) window.location.href = ctx.href('student.html', { studentId: it.id }); }
      },
      note: 'Vạch: trung vị của lớp. Nhấn vào điểm để mở hồ sơ học sinh.'
    }));
    // #online
    const asg = M.assignmentsIn(D, scope).sort(function (a, b) { return a.dueAt - b.dueAt; });
    const onl = asg.map(function (a) {
      const c = { ON_TIME: 0, LATE: 0, MISSING: 0, OPEN: 0 };
      (D.idx.progByAssignment.get(a.id) || []).forEach(function (p) { c[M.onlineStatus(a, p, now)]++; });
      return c;
    });
    root.appendChild(el('div', { id: 'online' }));
    root.appendChild(UI.section('Khóa trực tuyến', 'Mọi khóa trực tuyến được giao cho lớp'));
    root.appendChild(UI.card({
      title: 'Khóa trực tuyến: đúng hạn / muộn / không hoàn thành', question: 'Học sinh của lớp hoàn thành các khóa trực tuyến đúng hạn đến đâu?',
      chart: {
        height: 240,
        build: function () {
          return GT.charts.stack({
            categories: asg.map(function (a) { return a.title; }), horizontal: true, percent: true, unit: 'học sinh', labels: true,
            tipTitle: function (i) { return asg[i].title + ' · hạn ' + DT.fmtDate(asg[i].dueAt) + (asg[i].dueAt > now ? ' (đang mở)' : ''); },
            series: ['ON_TIME', 'LATE', 'MISSING', 'OPEN'].map(function (k) { return { name: L.task[k], color: C.task[k], data: onl.map(function (c) { return c[k]; }) }; }),
            empty: { title: 'Lớp chưa được giao khóa trực tuyến', text: '' }
          });
        }
      },
      note: 'Trạng thái tại hiện tại, không phụ thuộc kỳ: khóa chưa đến hạn hiển thị "Đang mở" — xem tiến độ từng học sinh bên dưới.'
    }));
    root.appendChild(studentProgressCard(ctx, cid, scope));
    root.appendChild(UI.alertBlock({ alerts: A.filter(ctx.alerts(), { groups: ['HW', 'ONL'], classIds: [cid] }), title: 'Cảnh báo học ở nhà (HW, ONL)', moreHref: 'alerts.html' + GT.qs.build({ displayGroup: 'HOME', classId: cid }) }));
    if (window.location.hash === '#online') setTimeout(function () { const o = document.getElementById('online'); if (o) o.scrollIntoView(); }, 50);
  };

  function taskTable(ctx, stats, tlabel) {
    return {
      columns: [
        { key: 'due', label: 'Hạn', value: function (s) { return s.task.dueAt; }, fmt: function (s) { return DT.fmtDateTime(s.task.dueAt); } },
        { key: 'title', label: 'Nhiệm vụ', value: function (s) { return s.task.title; } },
        { key: 'on', label: 'Đúng hạn', align: 'r', value: function (s) { return s.ON_TIME; } },
        { key: 'late', label: 'Muộn', align: 'r', value: function (s) { return s.LATE; } },
        { key: 'miss', label: 'Không hoàn thành', align: 'r', value: function (s) { return s.MISSING; } },
        { key: 'open', label: 'Đang mở', align: 'r', value: function (s) { return s.OPEN; } },
        { key: 'avg', label: 'Điểm TB', align: 'r', value: function (s) { return s.avgScore; }, fmt: function (s) { return F.score(s.avgScore); } },
        { key: 'ung', label: 'Chưa chấm', align: 'r', value: function (s) { return s.ungraded; } }
      ], rows: stats, csv: 'nhiem-vu-lop.csv'
    };
  }

  function studentProgressCard(ctx, cid, scope) {
    const D = ctx.D, now = ctx.now, cfg = ctx.cfg;
    const run = M.onlineRunning(D, scope, now, cfg);
    const body = el('div');
    if (!run.length) body.appendChild(UI.empty('Không có khóa trực tuyến đang chạy', 'Lớp không có khóa trực tuyến nào đang mở tại thời điểm hiện tại.'));
    run.forEach(function (rr) {
      const a = rr.assignment;
      const items = rr.students.map(function (s) { return { name: ctx.studentName(s.studentId), sid: s.studentId, actual: s.progress || 0, expected: rr.expected, onTrack: s.onTrack }; }).sort(function (x, y) { return x.actual - y.actual; });
      body.appendChild(el('div', { class: 'small', style: { fontWeight: 600, marginTop: '6px' }, text: a.title + ' — hạn ' + DT.fmtDate(a.dueAt) + ' · kỳ vọng ' + F.pct(rr.expected, 0) + ' · ' + rr.onTrack + '/' + rr.n + ' học sinh đúng tiến độ' }));
      const box = el('div', { style: { maxHeight: '420px', overflowY: 'auto' } });
      const c = el('div', { class: 'chart' });
      box.appendChild(c);
      body.appendChild(box);
      GT.charts.mount(c, function () { return GT.charts.progress({ items: items, tolerance: cfg.online.onTrackTolerancePts, labelWidth: 150 }); },
        { height: 300, onClick: function (p) { const it = items[p.dataIndex]; if (it) window.location.href = ctx.href('student.html', { studentId: it.sid }); } });
    });
    return UI.card({
      title: 'Tiến độ thực tế vs kỳ vọng của từng học sinh', proposal: true,
      question: 'Học sinh nào đang chậm tiến độ khóa trực tuyến và cần nhắc ngay?',
      body: body,
      note: 'Thanh cam = chậm hơn kỳ vọng quá ' + cfg.online.onTrackTolerancePts + ' điểm %. Sắp xếp từ chậm nhất.'
    });
  }

  SINGLE.learning = function (ctx, root) {
    const D = ctx.D, cid = ctx.classId, cfg = ctx.cfg, now = ctx.now;
    const courses = classCourseIds(D, cid);
    const courseId = ctx.courseId && courses.indexOf(ctx.courseId) >= 0 ? ctx.courseId : courses[0];
    if (!courseId) { root.appendChild(UI.empty('Lớp chưa học khóa nào', '')); return; }
    root.appendChild(el('div', { class: 'tabs', style: { borderBottom: 0 } }, courses.map(function (co) {
      return el('a', { href: ctx.href('class.html', { tab: 'learning', courseId: co }), class: co === courseId ? 'on' : null, text: ctx.courseName(co) });
    })));
    root.appendChild(UI.card({
      title: 'Chuẩn đầu ra của lớp — ' + ctx.courseName(courseId),
      question: 'Lớp đang Đỏ/Cam ở chuẩn đầu ra nào, và các lớp khác cùng khóa thì sao?',
      tools: [el('a', { class: 'btn sm', href: 'settings.html', text: 'Ngưỡng ⚙' }), el('a', { class: 'btn sm', href: ctx.href('course-detail.html', { courseId: courseId, classId: cid }), text: 'So sánh trong khóa →' })],
      body: V.loTable(ctx, { courseId: courseId, classIds: [cid], otherClassesFor: cid }),
      cause: true,
      note: 'Cột "Các lớp khác cùng khóa" [Đề xuất]: mỗi cột nhỏ là tỉ lệ đạt của một lớp khác (màu = trạng thái). Nhấn vào dòng để xem danh sách học sinh với % đạt.'
    }));
    // Bảng học sinh × số CĐR theo cấp
    const roster = M.roster(D, cid, now);
    const profiles = roster.map(function (sid) { return { sid: sid, p: M.studentLoProfile(D, sid, cid, courseId, cfg) }; });
    root.appendChild(UI.card({
      title: 'Học sinh theo số chuẩn đầu ra ở từng cấp', question: 'Học sinh nào có nhiều chuẩn đầu ra Chưa tốt / Cần cải thiện?',
      body: UI.table({
        columns: [{ key: 'name', label: 'Học sinh', value: function (x) { return ctx.studentName(x.sid); }, fmt: function (x) { return UI.link(ctx.href('student.html', { studentId: x.sid }), ctx.studentName(x.sid)) + ' <span class="muted small">' + esc(D.studentById.get(x.sid).code) + '</span>'; } }]
          .concat(M.LEVELS.map(function (l) { return { key: l, label: M.LEVEL_META[l].short, title: M.LEVEL_META[l].label, align: 'r', value: function (x) { return x.p.levels[l]; }, fmt: function (x) { return x.p.levels[l] ? UI.levelChip(l, String(x.p.levels[l])) : '<span class="muted">0</span>'; } }; }))
          .concat([{ key: 'failed', label: 'Không đạt', align: 'r', value: function (x) { return x.p.failed; } }]),
        rows: profiles, sort: { key: 'POOR', dir: -1 }, capped: true, csv: 'hoc-sinh-cdr-' + cid + '.csv',
        onRow: function (x) { studentLoPopup(ctx, x.sid, cid, courseId); }
      }),
      legend: M.LEVELS.map(function (l) { return { color: C.level[l], label: M.LEVEL_META[l].short + ' = ' + M.LEVEL_META[l].label }; }),
      note: 'Nhấn vào học sinh để xem % đạt từng chuẩn đầu ra.'
    }));
    root.appendChild(UI.alertBlock({ alerts: A.filter(ctx.alerts(), { groups: ['LO', 'CUR', 'DATA'], classIds: [cid], courseId: courseId }), title: 'Cảnh báo chuẩn đầu ra của lớp', moreHref: 'alerts.html' + GT.qs.build({ displayGroup: 'LEARN', classId: cid }) }));
    // [ĐX] Heatmap học sinh × CĐR
    const los = D.idx.losByCourse.get(courseId) || [];
    const sorted = profiles.slice().sort(function (a, b) { return b.p.failed - a.p.failed; });
    const cells = [];
    sorted.forEach(function (x, yi) {
      x.p.items.forEach(function (it) {
        const xi = los.indexOf(it.lo);
        cells.push({ x: xi, y: yi, color: C.level[it.level], text: it.ach.percent === null ? '–' : F.num(it.ach.percent, 0), tip: '<b>' + esc(ctx.studentName(x.sid)) + '</b><br>' + esc(it.lo.code + ' ' + it.lo.name) + '<br>' + (it.ach.percent === null ? 'Chưa có thông tin' : F.num(it.ach.percent, 1) + '% · ' + M.LEVEL_META[it.level].label + ' · ' + it.ach.evidenceCount + ' câu') });
      });
    });
    root.appendChild(UI.card({
      title: 'Học sinh × chuẩn đầu ra', proposal: true, question: 'Lỗ hổng tập trung ở vài học sinh hay trải khắp lớp ở một chuẩn đầu ra?',
      chart: {
        height: 400,
        build: function () { return GT.charts.catHeatmap({ xCats: los.map(function (l) { return l.code; }), yCats: sorted.map(function (x) { return ctx.studentName(x.sid); }), cells: cells, xTop: true, rowHeight: 20, labelSize: 10, yLabelWidth: 150, rotate: 0 }); },
        onClick: function (p) { const x = sorted[p.data.value[1]]; if (x) studentLoPopup(ctx, x.sid, cid, courseId); }
      },
      legend: M.LEVELS.map(function (l) { return { color: C.level[l], label: M.LEVEL_META[l].label }; }),
      note: 'Số trong ô = % đạt; sắp xếp theo số chuẩn đầu ra không đạt giảm dần.'
    }));
  };

  function studentLoPopup(ctx, sid, cid, courseId) {
    const D = ctx.D, cfg = ctx.cfg;
    const prof = M.studentLoProfile(D, sid, cid, courseId, cfg);
    const mx = M.loMatrix(D, courseId, null, cfg, ctx.now);
    const body = el('div');
    body.appendChild(UI.table({
      columns: [
        { key: 'code', label: 'Mã', value: function (it) { return it.lo.order; }, fmt: function (it) { return '<b>' + esc(it.lo.code) + '</b>'; } },
        { key: 'name', label: 'Chuẩn đầu ra', value: function (it) { return it.lo.name; } },
        { key: 'p', label: '% đạt', align: 'r', value: function (it) { return it.ach.percent; }, fmt: function (it) { return it.ach.percent === null ? '–' : F.num(it.ach.percent, 1) + '%'; } },
        { key: 'lvl', label: 'Cấp', value: function (it) { return M.LEVELS.indexOf(it.level); }, fmt: function (it) { return UI.levelChip(it.level); } },
        { key: 'ev', label: 'Số câu', align: 'r', value: function (it) { return it.ach.evidenceCount; } },
        { key: 'cls', label: 'Tỉ lệ đạt của lớp', align: 'r', value: function (it) { return mx.cells.get(cid + '|' + it.lo.id).passRate; }, fmt: function (it) { const s = mx.cells.get(cid + '|' + it.lo.id); return UI.colorChip(s.color, V.loCellLabel(s)); } }
      ], rows: prof.items, sort: { key: 'code', dir: 1 }, csv: 'cdr-' + sid + '.csv'
    }));
    UI.modal({ title: ctx.studentLabel(sid), subtitle: 'Lớp ' + ctx.className(cid) + ' · ' + ctx.courseName(courseId) + ' · ' + prof.failed + ' chuẩn đầu ra chưa đạt', body: body, narrow: true });
  }

  // =====================================================================================
  // So sánh giữa lớp
  // =====================================================================================
  const COMPARE = {};
  function compareClasses(ctx) { return ctx.classIdsInScope(Math.min(ctx.range.to - 1, ctx.now)); }

  COMPARE.overview = function (ctx, root) {
    const D = ctx.D, r = ctx.range, cfg = ctx.cfg;
    const ids = compareClasses(ctx);
    const rows = ids.map(function (cid) {
      const c = D.classById.get(cid);
      return { cid: cid, c: c, km: M.keyMetrics(D, { classIds: [cid], courseIds: ctx.scope.courseIds }, r.from, r.to, cfg), size: M.roster(D, cid, ctx.now).length, al: A.countBySeverity(A.filter(ctx.alerts(), { classIds: [cid], open: true })) };
    });
    const school = M.keyMetrics(D, { courseIds: ctx.scope.courseIds }, r.from, r.to, cfg);
    const mets = M.KEY_METRICS;
    const show = function (m, v) { return v === null || v === undefined ? '–' : (m.kind === 'score' ? F.score(v) : F.pct(v)); };
    const data = [];
    rows.forEach(function (x, yi) {
      mets.forEach(function (m, xi) {
        const v = x.km[m.key].value, s = school[m.key].value;
        const dev = M.deviationPts(m.kind, v, s);
        data.push([xi, yi, dev, show(m, v) + (dev === null ? '' : dev >= 0.05 ? ' ▲' : dev <= -0.05 ? ' ▼' : ''), undefined, { v: v, s: s, n: x.km[m.key].n }]);
      });
    });
    root.appendChild(UI.card({
      title: 'Lớp × chỉ số chính', proposal: true, question: 'Lớp nào kém hơn trung bình trường, ở chỉ số nào?',
      chart: {
        height: 400,
        build: function () {
          return GT.charts.heatmap({
            xCats: mets.map(function (m) { return m.short; }), yCats: rows.map(function (x) { return 'Lớp ' + x.c.name; }), data: data, scale: { diverging: true, maxAbs: 10 }, xTop: true, rowHeight: 28, yLabelWidth: 80, xLabelWidth: 80,
            tip: function (d) { const m = mets[d[0]]; return '<b>Lớp ' + esc(rows[d[1]].c.name) + '</b> · ' + esc(m.label) + '<br>Lớp: <b>' + show(m, d[5].v) + '</b> (' + F.int(d[5].n) + ')<br>TB trường: ' + show(m, d[5].s); }
          });
        },
        onClick: function (p) { const x = rows[p.data.raw[1]]; if (x) ctx.set({ classId: x.cid }); }
      },
      legend: [{ color: C.div.neg, label: '▼ Thấp hơn TB trường' }, { color: C.div.mid, label: 'Xấp xỉ' }, { color: C.div.pos, label: '▲ Cao hơn TB trường' }],
      cause: true
    }));
    root.appendChild(UI.card({
      title: 'So sánh các lớp', question: 'Bảng tổng hợp các chỉ số chính của từng lớp trong kỳ.',
      body: UI.table({
        columns: [
          { key: 'name', label: 'Lớp', value: function (x) { return x.c.name; }, fmt: function (x) { return '<b>' + esc(x.c.name) + '</b><div class="muted small">' + esc(ctx.groupName(x.c.groupId)) + '</div>'; } },
          { key: 'size', label: 'Sĩ số', align: 'r' }
        ].concat(mets.map(function (m) { return { key: m.key, label: m.label, align: 'r', value: function (x) { return x.km[m.key].value; }, fmt: function (x) { return show(m, x.km[m.key].value) + '<div class="muted small">' + F.int(x.km[m.key].n) + '</div>'; } }; }))
          .concat([{ key: 'al', label: 'Cảnh báo mở (C/TB/T)', align: 'r', value: function (x) { return x.al.HIGH * 1000 + x.al.MEDIUM; }, fmt: function (x) { return '<span class="sev HIGH">' + x.al.HIGH + '</span> <span class="sev MEDIUM">' + x.al.MEDIUM + '</span> <span class="sev LOW">' + x.al.LOW + '</span>'; }, csv: function (x) { return x.al.HIGH + '/' + x.al.MEDIUM + '/' + x.al.LOW; } }]),
        rows: rows, sort: { key: 'name', dir: 1 }, csv: 'so-sanh-lop.csv', onRow: function (x) { ctx.set({ classId: x.cid }); }
      }),
      note: 'TB trường: ' + mets.map(function (m) { return esc(m.label) + ' ' + show(m, school[m.key].value); }).join(' · ') + '. Số nhỏ = mẫu số.'
    }));
  };

  COMPARE.attendance = function (ctx, root) {
    const D = ctx.D, r = ctx.range;
    const ids = compareClasses(ctx);
    const counts = ids.map(function (cid) { return M.attendanceCounts(D, { classIds: [cid], courseIds: ctx.scope.courseIds }, r.from, r.to); });
    root.appendChild(UI.card({
      title: 'Chuyên cần theo lớp', question: 'Lớp nào có tỉ trọng vắng/muộn cao nhất trong kỳ?',
      chart: {
        height: 300,
        build: function () {
          return GT.charts.stack({
            categories: ids.map(ctx.className), horizontal: true, percent: true,
            series: ['ON_TIME', 'LATE', 'EXCUSED', 'UNEXCUSED'].map(function (k) { return { name: L.att[k], color: C.att[k], data: counts.map(function (c) { return c[k]; }) }; }),
            tipExtra: function (i) { return '<div style="color:#6B7180">Chưa điểm danh: ' + counts[i].NOT_TAKEN + ' bản ghi</div>'; }
          });
        },
        onClick: function (p) { ctx.set({ classId: ids[p.dataIndex] }); }
      },
      cause: true
    }));
    const row = el('div', { class: 'grid g2' });
    root.appendChild(row);
    row.appendChild(V.rankCard(ctx, { key: 'attOnTime', title: 'Lớp đi học đúng giờ', question: 'Lớp nào đúng giờ tốt nhất / kém nhất?', from: r.from, to: r.to, windowLabel: r.label, classIds: ids, tab: 'attendance' }));
    row.appendChild(V.rankCard(ctx, { key: 'attLate', title: 'Lớp đi muộn nhiều nhất', question: 'Lớp nào có tỉ lệ đi muộn cao nhất?', from: r.from, to: r.to, windowLabel: r.label, classIds: ids, tab: 'attendance', desc: true }));
    root.appendChild(UI.alertBlock({ alerts: A.filter(ctx.alerts(), { groups: ['ATT'], groupId: ctx.groupId }), title: 'Cảnh báo chuyên cần', moreHref: 'alerts.html' + GT.qs.build({ alertGroup: 'ATT', groupId: ctx.groupId }) }));
  };

  COMPARE.homework = function (ctx, root) {
    const D = ctx.D, r = ctx.range, now = ctx.now;
    const ids = compareClasses(ctx);
    const counts = ids.map(function (cid) { return M.taskCounts(D, { classIds: [cid], courseIds: ctx.scope.courseIds }, r.from, r.to); });
    const row = el('div', { class: 'grid g2' });
    root.appendChild(row);
    row.appendChild(UI.card({
      title: 'Nhiệm vụ theo lớp: đúng hạn / muộn / không hoàn thành', question: 'Lớp nào nộp bài kém nhất trong kỳ?',
      chart: {
        height: 300,
        build: function () {
          return GT.charts.stack({ categories: ids.map(ctx.className), horizontal: true, percent: true, series: ['ON_TIME', 'LATE', 'MISSING'].map(function (k) { return { name: L.task[k], color: C.task[k], data: counts.map(function (c) { return c[k]; }) }; }) });
        },
        onClick: function (p) { ctx.set({ classId: ids[p.dataIndex], tab: 'homework' }); }
      }
    }));
    row.appendChild(UI.card({
      title: 'Phân bố điểm nhiệm vụ theo lớp', proposal: true, question: 'Hai lớp cùng điểm TB — lớp nào đồng đều, lớp nào phân hóa mạnh?',
      chart: {
        height: 300,
        build: function () {
          const sc = ids.map(function (cid) { return M.taskScores(D, { classIds: [cid], courseIds: ctx.scope.courseIds }, r.from, r.to); });
          return GT.charts.boxplot({ categories: ids.map(ctx.className), boxes: sc.map(S.boxplot), counts: sc.map(function (x) { return x.length; }), means: sc.map(S.mean) });
        },
        onClick: function (p) { ctx.set({ classId: ids[p.dataIndex], tab: 'homework' }); }
      },
      cause: true
    }));
    root.appendChild(el('div', { id: 'online' }));
    root.appendChild(V.onlineProgressCard(ctx, { classIds: ids, courseIds: ctx.scope.courseIds, t: Math.min(now, r.to - 1) }));
    root.appendChild(UI.alertBlock({ alerts: A.filter(ctx.alerts(), { groups: ['HW', 'ONL'], groupId: ctx.groupId }), title: 'Cảnh báo học ở nhà', moreHref: 'alerts.html' + GT.qs.build({ displayGroup: 'HOME', groupId: ctx.groupId }) }));
  };

  COMPARE.learning = function (ctx, root) {
    const D = ctx.D;
    const ids = compareClasses(ctx);
    const courses = D.courses.filter(function (c) { return ids.some(function (cid) { return classCourseIds(D, cid).indexOf(c.id) >= 0; }); });
    const courseId = ctx.courseId && courses.some(function (c) { return c.id === ctx.courseId; }) ? ctx.courseId : (courses[0] && courses[0].id);
    if (!courseId) { root.appendChild(UI.empty('Không có khóa học', '')); return; }
    root.appendChild(el('div', { class: 'tabs', style: { borderBottom: 0 } }, courses.map(function (co) {
      return el('a', { href: ctx.href('class.html', { tab: 'learning', courseId: co.id }), class: co.id === courseId ? 'on' : null, text: co.name });
    })));
    root.appendChild(V.loHeatmapCard(ctx, { courseId: courseId, title: 'Lớp × chuẩn đầu ra — ' + ctx.courseName(courseId), proposal: false }));
    root.appendChild(el('p', {}, [el('a', { class: 'btn', href: ctx.href('course-detail.html', { courseId: courseId, classId: null }), text: 'Mở phân tích chi tiết khóa học →' })]));
  };
})(window.GT);
