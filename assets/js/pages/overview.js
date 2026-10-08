/**
 * hoc-vu/overview.html — 4.1 Tổng quan.
 * Trả lời: hôm nay vận hành có trơn tru không; nhóm lớp/lớp nào đang có vấn đề.
 * Cửa sổ cố định (OQ-05, OQ-06): hôm nay · 7 ngày gần nhất · 30 ngày gần nhất · 8 tuần.
 */
(function (GT) {
  'use strict';
  const M = GT.metrics, A = GT.alerts, UI = GT.ui, V = GT.views, F = GT.fmt, DT = GT.date, C = GT.colors, L = GT.labels;
  const el = UI.el, esc = UI.esc;
  const DAY = DT.DAY;

  GT.page({
    id: 'overview',
    title: 'Tổng quan',
    subtitle: 'Hôm nay vận hành có trơn tru không · Nhóm lớp, lớp nào đang có vấn đề',
    filters: {},
    render: function (ctx, root) {
      const D = ctx.D, now = ctx.now, cfg = ctx.cfg;
      const today = DT.startOfDay(now);
      const w7 = [now - 7 * DAY, now + 1], w30 = [now - 30 * DAY, now + 1];
      const w7Label = '7 ngày gần nhất (' + V.windowLabel(w7[0], w7[1]) + ')';
      const alerts = ctx.alerts();

      // ------------------------------------------------------------ KPI
      const active = M.activeClassIds(D, {}, now);
      const todaySessions = M.sessionsIn(D, {}, today, today + DAY);
      const ySessions = M.sessionsIn(D, {}, today - DAY, today);
      const ops = M.opsSummary(todaySessions, now, cfg);
      const openTasks = D.tasks.filter(function (t) { return t.assignedAt <= now && now < t.dueAt; });
      let exp = 0, sub = 0;
      openTasks.forEach(function (t) { M.forEachTaskStudent(D, t, null, function (sid, s) { exp++; if (s) sub++; }); });
      const running = M.onlineRunning(D, {}, now, cfg);
      let rd = 0, rt = 0;
      running.forEach(function (r) { rd += r.done; rt += r.total; });
      root.appendChild(UI.kpis([
        { label: 'Lớp đang hoạt động', value: F.int(active.length), sub: 'trên ' + D.classes.length + ' lớp · ' + D.groups.length + ' nhóm lớp', ref: 'M-OPS-00', href: ctx.href('class.html') },
        { label: 'Lịch học trong ngày', value: F.int(todaySessions.length), sub: ops.ongoing + ' đang diễn ra · ' + (ops.started - ops.ongoing) + ' đã kết thúc · ' + ops.upcoming + ' sắp diễn ra', ref: 'M-OPS-01', href: ctx.href('schedule.html', { period: 'day', date: DT.dayKey(now) }), delta: { cur: todaySessions.length, prev: ySessions.length, kind: 'count', complete: true } },
        { label: 'Nhiệm vụ đang diễn ra', value: F.int(openTasks.length), sub: 'Đã nộp ' + F.pct(GT.stats.ratio(sub, exp)) + ' (' + F.int(sub) + '/' + F.int(exp) + ' lượt)', ref: 'M-HW-11', href: ctx.href('homework.html', { period: 'week', date: DT.dayKey(now) }) },
        { label: 'Khóa trực tuyến đang diễn ra', value: F.int(running.length), sub: 'Tiến độ TB ' + F.pct(GT.stats.ratio(rd, rt)) + ' · theo lớp', ref: 'M-ONL-11', href: ctx.href('homework.html', { period: 'week', date: DT.dayKey(now) }) + '#online' }
      ]));

      // ------------------------------------------------------------ Hôm nay + 7 ngày
      const row1 = el('div', { class: 'grid g2' });
      root.appendChild(row1);
      const attToday = M.attendanceCounts(D, {}, today, today + DAY);
      const notTakenSessions = todaySessions.filter(function (s) { return s.start <= now && s.attendanceSubmittedAt === null; });
      row1.appendChild(UI.card({
        title: 'Tỉ lệ đi học hôm nay',
        question: 'Hôm nay học sinh đi học đúng giờ, muộn, vắng ra sao — và còn bao nhiêu bản ghi chưa được điểm danh?',
        chart: {
          height: 270, eager: true,
          build: function () {
            return GT.charts.donut({
              items: ['ON_TIME', 'LATE', 'EXCUSED', 'UNEXCUSED'].map(function (k) { return { name: L.att[k], value: attToday[k], color: C.att[k] }; }),
              center: { value: F.pct(M.attendanceRates(attToday).present), label: 'có mặt' },
              empty: { title: 'Chưa có dữ liệu điểm danh hôm nay', text: 'Chưa có buổi học nào bắt đầu hoặc chưa buổi nào được điểm danh.' }
            });
          }
        },
        body: el('div', { class: 'callout' + (attToday.NOT_TAKEN ? ' warn' : '') }, [
          el('b', { text: 'Chưa điểm danh: ' + F.int(attToday.NOT_TAKEN) + ' bản ghi' }),
          ' (' + notTakenSessions.length + ' buổi đã bắt đầu chưa có điểm danh; tỉ lệ ' + F.pct(M.attendanceRates(attToday).notTaken) + ' tổng bản ghi). Không tính vào mẫu số tỉ lệ.',
          notTakenSessions.length ? el('div', { class: 'small', style: { marginTop: '4px' } }, notTakenSessions.map(function (s) {
            return el('a', { href: ctx.href('class.html', { classId: s.classId, tab: 'attendance', period: 'day', date: DT.dayKey(now) }), style: { marginRight: '12px' }, text: '⚠ ' + ctx.className(s.classId) + ' ' + DT.fmtTime(s.start) });
          })) : null
        ]),
        table: function () {
          return {
            columns: [{ key: 'k', label: 'Trạng thái' }, { key: 'n', label: 'Số bản ghi', align: 'r' }, { key: 'p', label: 'Tỉ lệ (trên mẫu số)', align: 'r' }],
            rows: M.ATT_STATUSES.map(function (k) { return { k: L.att[k], n: attToday[k], p: k === 'NOT_TAKEN' ? '(không vào mẫu số)' : F.pct(GT.stats.ratio(attToday[k], attToday.taken)) }; }),
            csv: 'di-hoc-hom-nay.csv'
          };
        }
      }));
      const groupTask = D.groups.map(function (g) { return M.taskCounts(D, { groupIds: [g.id] }, w7[0], w7[1]); });
      const allTask = M.taskCounts(D, {}, w7[0], w7[1]);
      const cats = ['Toàn trường'].concat(D.groups.map(function (g) { return g.name; }));
      const tcs = [allTask].concat(groupTask);
      row1.appendChild(UI.card({
        title: 'Làm bài đúng hạn / muộn / không hoàn thành — 7 ngày qua',
        question: 'Tuần vừa qua học sinh nộp nhiệm vụ đúng hạn đến đâu, nhóm lớp nào kém nhất?',
        chart: {
          height: 270, eager: true,
          build: function () {
            return GT.charts.stack({
              categories: cats, horizontal: true, labels: true, unit: 'lượt',
              series: ['ON_TIME', 'LATE', 'MISSING'].map(function (k) { return { name: L.task[k], color: C.task[k], data: tcs.map(function (c) { return c[k]; }) }; }),
              tipExtra: function (i) { return '<div style="color:#6B7180">Đang mở (chưa đến hạn): ' + F.int(tcs[i].OPEN) + ' lượt · nộp chưa đủ: ' + F.int(tcs[i].PARTIAL) + '</div>'; }
            });
          }
        },
        note: 'Cửa sổ: ' + esc(w7Label) + ', theo hạn nộp; chỉ tính nhiệm vụ đã quá hạn (' + F.int(allTask.overdue) + ' lượt). Nhiệm vụ chưa đến hạn xem ở thẻ "Nhiệm vụ đang diễn ra".',
        table: function () {
          return {
            columns: [{ key: 'name', label: 'Phạm vi' }, { key: 'on', label: 'Đúng hạn', align: 'r' }, { key: 'late', label: 'Muộn', align: 'r' }, { key: 'miss', label: 'Không hoàn thành', align: 'r' }, { key: 'rate', label: '% đúng hạn', align: 'r' }],
            rows: tcs.map(function (c, i) { return { name: cats[i], on: c.ON_TIME, late: c.LATE, miss: c.MISSING, rate: F.pct(M.taskRates(c).onTime) }; }), csv: 'nhiem-vu-7-ngay.csv'
          };
        }
      }));

      // ------------------------------------------------------------ [ĐX] Bảng vận hành hôm nay
      root.appendChild(opsBoard(ctx, todaySessions));

      // ------------------------------------------------------------ Top lớp
      const tops = el('div', { class: 'grid g3' });
      root.appendChild(UI.section('Xếp hạng lớp', '7 ngày gần nhất · nhấn vào lớp để xem báo cáo lớp'));
      root.appendChild(tops);
      tops.appendChild(V.rankCard(ctx, { key: 'attOnTime', title: 'Top lớp đi học đúng giờ nhất', question: 'Lớp nào duy trì đi học đúng giờ tốt nhất, lớp nào kém nhất?', from: w7[0], to: w7[1], windowLabel: w7Label, tab: 'attendance' }));
      tops.appendChild(V.rankCard(ctx, { key: 'taskOnTime', title: 'Top lớp làm bài đúng hạn nhất', question: 'Lớp nào nộp nhiệm vụ đúng hạn tốt nhất, lớp nào cần nhắc nhở?', from: w7[0], to: w7[1], windowLabel: w7Label, tab: 'homework' }));
      tops.appendChild(V.rankCard(ctx, { key: 'taskScore', title: 'Top lớp điểm trung bình cao nhất', question: 'Lớp nào có điểm nhiệm vụ trung bình cao nhất, thấp nhất?', from: w7[0], to: w7[1], windowLabel: w7Label, tab: 'homework', cause: true }));

      // ------------------------------------------------------------ Nhóm lớp & danh sách lớp
      root.appendChild(UI.section('Nhóm lớp', 'Chỉ số 30 ngày gần nhất · nhấn vào nhóm để xem danh sách lớp'));
      const tiles = el('div', { class: 'cards' });
      root.appendChild(tiles);
      D.groups.forEach(function (g) { tiles.appendChild(groupTile(ctx, g, w30, alerts)); });
      root.appendChild(classList(ctx, alerts));

      // ------------------------------------------------------------ [ĐX] Heatmap nhóm × chỉ số + Tóm tắt cảnh báo
      const row3 = el('div', { class: 'grid g2' });
      root.appendChild(row3);
      row3.appendChild(groupHeatmap(ctx, w30));
      row3.appendChild(alertSummary(ctx, alerts));

      // ------------------------------------------------------------ [ĐX] Xu hướng 8 tuần
      root.appendChild(trend8w(ctx));
    }
  });

  // ================================================================ Bảng vận hành hôm nay
  const sessionState = V.sessionState;

  function opsBoard(ctx, sessions) {
    const D = ctx.D, now = ctx.now;
    const rows = [], seen = new Set();
    sessions.forEach(function (s) { if (!seen.has(s.classId)) { seen.add(s.classId); rows.push({ id: s.classId, label: ctx.className(s.classId) }); } });
    const day0 = DT.startOfDay(now);
    const from = Math.min(day0 + 6.5 * DT.HOUR, sessions.length ? sessions[0].start - 30 * DT.MIN : day0 + 7 * DT.HOUR);
    const to = Math.max(day0 + 17 * DT.HOUR, sessions.reduce(function (m, s) { return Math.max(m, s.end); }, 0) + 30 * DT.MIN);
    const states = ['UPCOMING', 'NOT_TAKEN', 'LATE_TAKEN', 'TAKEN', 'REPORTED'];
    const legendColors = { UPCOMING: '#D1D5DB', NOT_TAKEN: C.status.RED, LATE_TAKEN: C.status.ORANGE, TAKEN: C.status.GREEN, REPORTED: '#15803D' };
    const legendLabels = { UPCOMING: 'Sắp diễn ra', NOT_TAKEN: 'Chưa điểm danh', LATE_TAKEN: 'Điểm danh muộn', TAKEN: 'Đã điểm danh', REPORTED: 'Đã báo cáo' };
    const items = sessions.map(function (s) {
      const st = sessionState(s, now, ctx.cfg);
      const co = D.courseById.get(s.courseId);
      return {
        row: s.classId, start: s.start, end: s.end, color: st.color, text: co.shortName + (st.key === 'NOT_TAKEN' ? ' ✕' : st.key === 'UPCOMING' ? '' : ' ✓'),
        tip: '<b>' + esc(ctx.className(s.classId)) + ' · ' + esc(co.name) + '</b><br>' + DT.fmtTime(s.start) + '–' + DT.fmtTime(s.end) + ' · GV ' + esc(ctx.teacherName(s.teacherId)) +
          '<br>Trạng thái: <b>' + esc(st.label) + '</b>' + (s.attendanceSubmittedAt !== null ? '<br>Điểm danh lúc ' + DT.fmtTime(s.attendanceSubmittedAt) : '') +
          (s.reportSubmittedAt !== null ? '<br>Báo cáo lúc ' + DT.fmtTime(s.reportSubmittedAt) : ''),
        s: s
      };
    });
    const nNot = items.filter(function (i) { return sessionState(i.s, now, ctx.cfg).key === 'NOT_TAKEN'; }).length;
    return UI.card({
      title: 'Bảng vận hành hôm nay', proposal: true,
      question: 'Lúc này có lớp nào đã vào học mà chưa điểm danh không?',
      badges: nNot ? [{ cls: 'cur', text: nNot + ' buổi đã bắt đầu chưa điểm danh' }] : [],
      chart: {
        height: 260,
        build: function () { return GT.charts.timeline({ rows: rows, items: items, from: from, to: to, now: now, empty: { title: 'Hôm nay không có buổi học', text: 'Không có lịch học trong ngày.' } }); },
        onClick: function (p) { const it = p.data && p.data.__it; if (it) window.location.href = ctx.href('class.html', { classId: it.s.classId, tab: 'attendance', period: 'day', date: DT.dayKey(now) }); }
      },
      legend: states.map(function (k) { return { color: legendColors[k], label: legendLabels[k] }; }),
      table: function () {
        return {
          columns: [
            { key: 'time', label: 'Giờ', value: function (r) { return r.s.start; }, fmt: function (r) { return DT.fmtTime(r.s.start) + '–' + DT.fmtTime(r.s.end); } },
            { key: 'cls', label: 'Lớp', value: function (r) { return ctx.className(r.s.classId); } },
            { key: 'course', label: 'Khóa', value: function (r) { return ctx.courseName(r.s.courseId); } },
            { key: 'gv', label: 'Giáo viên', value: function (r) { return ctx.teacherName(r.s.teacherId); } },
            { key: 'st', label: 'Trạng thái', value: function (r) { return sessionState(r.s, now, ctx.cfg).label; }, fmt: function (r) { const st = sessionState(r.s, now, ctx.cfg); return UI.dotLabel(st.color, st.label); } }
          ], rows: items, csv: 'van-hanh-hom-nay.csv', sort: { key: 'time', dir: 1 }
        };
      },
      note: 'Vạch đỏ dọc = thời điểm hiện tại. Nhấn vào buổi học để mở báo cáo chuyên cần của lớp.'
    });
  }

  // ================================================================ Nhóm lớp
  function groupTile(ctx, g, w30, alerts) {
    const D = ctx.D;
    const km = M.keyMetrics(D, { groupIds: [g.id] }, w30[0], w30[1], ctx.cfg);
    const classes = (D.idx.classesByGroup.get(g.id) || []);
    const act = classes.filter(function (c) { return M.isClassActive(D, c.id, ctx.now); }).length;
    const ga = A.filter(alerts, { groupId: g.id, open: true });
    const cnt = A.countBySeverity(ga);
    const on = ctx.groupId === g.id;
    const tile = el('button', { type: 'button', class: 'tile' + (on ? ' on' : ''), 'aria-pressed': on ? 'true' : 'false', onclick: function () { ctx.set({ groupId: on ? null : g.id }); } }, [
      el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [el('i', { style: { width: '10px', height: '10px', borderRadius: '3px', background: C.group[g.id], display: 'inline-block' } }), el('h4', { text: g.name })]),
      el('div', { class: 'row' }, [el('span', { text: 'Số lớp' }), el('b', { text: act + ' đang hoạt động / ' + classes.length })]),
      el('div', { class: 'row', 'data-proposal': '' }, [el('span', { text: 'Tỉ lệ có mặt' }), el('b', { text: F.pct(km.present.value) })]),
      el('div', { class: 'row', 'data-proposal': '' }, [el('span', { text: 'Nộp đúng hạn' }), el('b', { text: F.pct(km.taskOnTime.value) })]),
      el('div', { class: 'row', 'data-proposal': '' }, [el('span', { text: '% chuẩn đầu ra Xanh' }), el('b', { text: F.pct(km.loGreen.value) })]),
      el('div', { class: 'alerts-line' }, cnt.total ? [el('span', { text: 'Cảnh báo đang mở: ' })].concat(A.SEVERITY_ORDER.filter(function (s) { return cnt[s]; }).map(function (s) { return el('span', { class: 'sev ' + s, style: { marginRight: '4px' }, text: A.SEVERITY[s].icon + ' ' + cnt[s] + ' ' + A.SEVERITY[s].label.toLowerCase() }); })) : [el('span', { class: 'muted', text: 'Không có cảnh báo đang mở' })])
    ]);
    return tile;
  }

  function classList(ctx, alerts) {
    const D = ctx.D, now = ctx.now;
    const wrap = el('div', { id: 'classes' });
    const groups = ctx.groupId ? [D.groupById.get(ctx.groupId)] : D.groups;
    wrap.appendChild(UI.section(ctx.groupId ? 'Danh sách lớp — ' + ctx.groupName(ctx.groupId) : 'Danh sách lớp (tất cả nhóm)', 'Nhấn vào lớp để xem báo cáo lớp học'));
    groups.forEach(function (g) {
      if (!ctx.groupId) wrap.appendChild(el('h3', { style: { fontSize: '14px', margin: '12px 0 8px', color: 'var(--ink-2)' }, text: g.name }));
      const cards = el('div', { class: 'cards' });
      (D.idx.classesByGroup.get(g.id) || []).forEach(function (c) { cards.appendChild(classTile(ctx, c, alerts)); });
      wrap.appendChild(cards);
    });
    return wrap;
  }

  function classTile(ctx, c, alerts) {
    const D = ctx.D, now = ctx.now;
    const roster = M.roster(D, c.id, now);
    const ccs = M.activeClassCourses(D, c.id, now);
    const openTasks = (D.idx.tasksByClass.get(c.id) || []).filter(function (t) { return t.assignedAt <= now && now < t.dueAt; });
    let exp = 0, sub = 0;
    openTasks.forEach(function (t) { M.forEachTaskStudent(D, t, null, function (sid, s) { exp++; if (s) sub++; }); });
    const run = M.onlineRunning(D, { classIds: [c.id] }, now, ctx.cfg);
    let rd = 0, rt = 0;
    run.forEach(function (r) { rd += r.done; rt += r.total; });
    const today = DT.startOfDay(now);
    const sess = M.sessionsIn(D, { classIds: [c.id] }, today, today + DAY);
    const ca = A.filter(alerts, { classIds: [c.id], open: true });
    const cnt = A.countBySeverity(ca);
    const tile = el('a', { class: 'tile', href: ctx.href('class.html', { classId: c.id, groupId: null }) }, [
      el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' } }, [el('h4', { text: 'Lớp ' + c.name }), el('span', { class: 'muted small', text: 'Sĩ số ' + roster.length })]),
      el('div', { class: 'row' }, [el('span', { text: 'Khóa đang dạy' }), el('b', { style: { textAlign: 'right' }, text: ccs.map(function (cc) { return D.courseById.get(cc.courseId).shortName; }).join(', ') || '–' })]),
      el('div', { class: 'row' }, [el('span', { text: 'Nhiệm vụ đang thực hiện' }), el('b', { text: openTasks.length + (exp ? ' · đã nộp ' + F.pct(sub / exp, 0) : '') })]),
      el('div', { class: 'row' }, [el('span', { text: 'Khóa trực tuyến đang triển khai' }), el('b', { text: run.length + (rt ? ' · tiến độ ' + F.pct(rd / rt, 0) : '') })]),
      el('div', { class: 'sessions' }, sess.length ? sess.map(function (s) {
        const ts = M.sessionTimeState(s, now);
        const st = sessionState(s, now, ctx.cfg);
        return el('div', { class: 'sess' }, [
          el('b', { text: DT.fmtTime(s.start) }),
          el('span', { text: D.courseById.get(s.courseId).shortName + ' · ' + ctx.teacherName(s.teacherId) }),
          el('span', { class: 'badge', style: { background: '#F3F4F6', color: '#4B5160' }, text: L.time[ts] }),
          ts !== 'UPCOMING' ? el('span', { class: 'badge', style: { background: st.color, color: C.textOn(st.color) }, text: (st.key === 'NOT_TAKEN' ? '✕ ' : '✓ ') + st.label }) : null
        ]);
      }) : [el('span', { class: 'muted small', text: 'Hôm nay không có lịch học' })]),
      el('div', { class: 'alerts-line' }, cnt.total ? [
        el('div', {}, A.SEVERITY_ORDER.filter(function (s) { return cnt[s]; }).map(function (s) { return el('span', { class: 'sev ' + s, style: { marginRight: '4px' }, text: A.SEVERITY[s].icon + ' ' + cnt[s] }); })),
        el('div', { class: 'small', style: { marginTop: '3px' }, text: 'Nặng nhất: ' + ca[0].title })
      ] : [el('span', { class: 'muted', text: 'Không có cảnh báo đang mở' })])
    ]);
    return tile;
  }

  // ================================================================ Heatmap nhóm × chỉ số
  function groupHeatmap(ctx, w30) {
    const D = ctx.D;
    const school = M.keyMetrics(D, {}, w30[0], w30[1], ctx.cfg);
    const gm = D.groups.map(function (g) { return M.keyMetrics(D, { groupIds: [g.id] }, w30[0], w30[1], ctx.cfg); });
    const mets = M.KEY_METRICS;
    const show = function (k, v) { return v === null || v === undefined ? '–' : (k === 'score' ? F.score(v) : F.pct(v)); };
    const data = [];
    gm.forEach(function (m, yi) {
      mets.forEach(function (mt, xi) {
        const v = m[mt.key].value, s = school[mt.key].value;
        const dev = M.deviationPts(mt.kind, v, s);
        const arrow = dev === null ? '' : dev >= 0.05 ? ' ▲' : dev <= -0.05 ? ' ▼' : '';
        data.push([xi, yi, dev, show(mt.kind, v) + arrow, undefined, { v: v, s: s, n: m[mt.key].n }]);
      });
    });
    return UI.card({
      title: 'Nhóm lớp × chỉ số chính', proposal: true,
      question: 'Nhóm lớp nào đang kém hơn trung bình trường, ở chỉ số nào?',
      chart: {
        height: 250,
        build: function () {
          return GT.charts.heatmap({
            xCats: mets.map(function (m) { return m.short; }), yCats: D.groups.map(function (g) { return g.name; }), data: data, scale: { diverging: true, maxAbs: 10 }, xTop: true,
            yLabelWidth: 150, xLabelWidth: 76, labelSize: 12,
            tip: function (d) {
              const mt = mets[d[0]];
              return '<b>' + esc(D.groups[d[1]].name) + '</b> · ' + esc(mt.label) + '<br>Nhóm: <b>' + show(mt.kind, d[5].v) + '</b> (' + F.int(d[5].n) + ')<br>TB trường: ' + show(mt.kind, d[5].s) +
                '<br>Độ lệch: ' + (d[2] === null ? '–' : (d[2] > 0 ? '+' : '') + F.num(d[2], 1) + ' điểm %' + (mt.kind === 'score' ? ' (điểm × 10)' : ''));
            }
          });
        },
        onClick: function (p) { const g = D.groups[p.data.raw[1]]; ctx.set({ groupId: g.id }); }
      },
      legend: [{ color: C.div.neg, label: '▼ Thấp hơn TB trường' }, { color: C.div.mid, label: 'Xấp xỉ TB trường' }, { color: C.div.pos, label: '▲ Cao hơn TB trường' }],
      note: 'Ô hiển thị giá trị của nhóm; màu = độ lệch so với TB trường (điểm %, điểm thang 10 quy ra × 10; đậm nhất khi lệch ≥ 10). Cửa sổ 30 ngày; % CĐR Xanh lũy kế. TB trường: ' +
        mets.map(function (m) { return esc(m.label) + ' ' + show(m.kind, school[m.key].value); }).join(' · ') + '.',
      table: function () {
        return {
          columns: [{ key: 'g', label: 'Nhóm lớp' }].concat(mets.map(function (m, i) { return { key: 'm' + i, label: m.label, align: 'r' }; })),
          rows: [{ g: 'Toàn trường' }].concat(D.groups.map(function (g) { return { g: g.name }; })).map(function (r, yi) {
            mets.forEach(function (m, i) { r['m' + i] = show(m.kind, (yi === 0 ? school : gm[yi - 1])[m.key].value); });
            return r;
          }), csv: 'nhom-lop-chi-so.csv'
        };
      }
    });
  }

  // ================================================================ Tóm tắt cảnh báo
  function alertSummary(ctx, alerts) {
    const open = A.filter(alerts, { open: true });
    const t = el('table', { class: 'tbl' });
    const head = el('tr', {}, [el('th', { text: 'Nhóm' })].concat(A.SEVERITY_ORDER.map(function (s) { return el('th', { class: 'r' }, [UI.sevBadge(s)]); })).concat([el('th', { class: 'r', text: 'Tổng' })]));
    t.appendChild(el('thead', {}, [head]));
    const tb = el('tbody');
    A.DISPLAY_GROUPS.forEach(function (g) {
      const list = open.filter(function (a) { return A.displayGroupOf(a) === g.id; });
      const c = A.countBySeverity(list);
      tb.appendChild(el('tr', {}, [el('td', {}, [el('a', { href: 'alerts.html' + GT.qs.build({ displayGroup: g.id }), text: g.label })])].concat(A.SEVERITY_ORDER.map(function (s) {
        return el('td', { class: 'r' }, [c[s] ? el('a', { href: 'alerts.html' + GT.qs.build({ displayGroup: g.id, severity: s }), text: F.int(c[s]) }) : el('span', { class: 'muted', text: '0' })]);
      })).concat([el('td', { class: 'r' }, [el('b', { text: F.int(c.total) })])])));
    });
    t.appendChild(tb);
    return UI.card({
      title: 'Tóm tắt cảnh báo đang mở', proposal: true,
      question: 'Đang có bao nhiêu vấn đề cần xử lý, thuộc mảng nào, mức nào?',
      body: el('div', {}, [el('div', { class: 'tbl-wrap' }, [t]), el('p', { class: 'small muted', style: { margin: '8px 0 0' }, text: 'Tổng ' + open.length + ' cảnh báo đang mở (đã gộp theo lớp khi ≥ ' + ctx.cfg.alerts.groupMinStudents + ' học sinh cùng vi phạm).' })]),
      tools: [el('a', { class: 'btn sm', href: 'alerts.html', text: 'Trung tâm cảnh báo' })]
    });
  }

  // ================================================================ Xu hướng 8 tuần
  function trend8w(ctx) {
    const D = ctx.D, now = ctx.now;
    const w0 = DT.startOfWeek(now);
    const weeks = [];
    for (let i = 7; i >= 0; i--) weeks.push(w0 - i * 7 * DAY);
    const pres = [], onT = [], np = [], nt = [];
    weeks.forEach(function (w) {
      const a = M.attendanceCounts(D, {}, w, w + 7 * DAY);
      const t = M.taskCounts(D, {}, w, Math.min(w + 7 * DAY, now + 1));
      pres.push(a.taken ? M.attendanceRates(a).present * 100 : null); np.push(a.taken);
      onT.push(t.overdue ? M.taskRates(t).onTime * 100 : null); nt.push(t.overdue);
    });
    const labels = weeks.map(function (w) { return DT.fmtDayMonth(w) + (w === w0 ? '*' : ''); });
    return UI.card({
      title: 'Xu hướng 8 tuần toàn trường', proposal: true,
      question: 'Chuyên cần và kỷ luật làm bài của toàn trường đang tốt lên hay xấu đi?',
      chart: {
        height: 280,
        build: function () {
          return GT.charts.line({
            categories: labels, fmt: function (v) { return F.num(v, 1) + '%'; }, axisFmt: GT.charts.pctAxis, min: 50, max: 100,
            tipTitle: function (i) { return 'Tuần ' + DT.fmtDayMonth(weeks[i]) + ' – ' + DT.fmtDayMonth(weeks[i] + 6 * DAY) + (weeks[i] === w0 ? ' (đang diễn ra)' : ''); },
            series: [
              { name: 'Tỉ lệ có mặt', short: 'Có mặt', color: C.series[0], data: pres, n: np },
              { name: 'Tỉ lệ nộp đúng hạn', short: 'Đúng hạn', color: C.series[1], data: onT, n: nt }
            ]
          });
        }
      },
      note: 'Tuần bắt đầu Thứ Hai; * = tuần hiện tại (tính đến bây giờ). Tỉ lệ nộp đúng hạn tính theo hạn nộp, chỉ nhiệm vụ đã quá hạn. Số trong ngoặc ở tooltip là mẫu số.',
      table: function () {
        return {
          columns: [{ key: 'w', label: 'Tuần' }, { key: 'p', label: 'Tỉ lệ có mặt', align: 'r' }, { key: 'np', label: 'Lượt điểm danh', align: 'r' }, { key: 't', label: 'Nộp đúng hạn', align: 'r' }, { key: 'nt', label: 'Lượt nộp (quá hạn)', align: 'r' }],
          rows: weeks.map(function (w, i) { return { w: DT.fmtDate(w), p: F.pct100(pres[i]), np: F.int(np[i]), t: F.pct100(onT[i]), nt: F.int(nt[i]) }; }), csv: 'xu-huong-8-tuan.csv'
        };
      }
    });
  }
})(window.GT);
