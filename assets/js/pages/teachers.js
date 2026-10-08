/**
 * hoc-vu/teachers.html — [ĐỀ XUẤT] 4.7 Báo cáo vận hành giáo viên.
 * CHỈ đo hành vi vận hành (giáo viên kiểm soát được): điểm danh, báo cáo, giao và chấm nhiệm vụ.
 * Kết quả học tập của lớp chỉ hiển thị để tham chiếu (kèm lưu ý mục 3.6), không đưa vào bảng.
 * Hiển thị phụ thuộc toggle cấp trường "Hiển thị báo cáo theo giáo viên".
 */
(function (GT) {
  'use strict';
  const M = GT.metrics, A = GT.alerts, UI = GT.ui, V = GT.views, F = GT.fmt, DT = GT.date, C = GT.colors, S = GT.stats;
  const el = UI.el, esc = UI.esc;
  const HOUR = DT.HOUR;
  let openedOnce = false;

  /** Chỉ số vận hành của một giáo viên trong [from, to). */
  function teacherOps(ctx, tid, from, to) {
    const D = ctx.D, now = ctx.now, cfg = ctx.cfg;
    const classFilter = ctx.groupId ? new Set(ctx.classIdsInScope()) : null;
    const sessions = M.sessionsIn(D, { teacherIds: [tid], classIds: classFilter ? Array.from(classFilter) : null }, from, to);
    const ops = M.opsSummary(sessions, now, cfg);
    const sids = new Set(sessions.map(function (s) { return s.id; }));
    const assigned = D.tasks.filter(function (t) { return sids.has(t.sessionId) && t.assignedAt >= from && t.assignedAt < to; });
    // Tồn chấm: bài nộp của nhiệm vụ chấm tay đã quá hạn, chưa chấm (mọi nhiệm vụ do GV giao, tính đến hiện tại)
    const mine = D.tasks.filter(function (t) { const s = D.sessionById.get(t.sessionId); return s && s.teacherId === tid && (!classFilter || classFilter.has(t.classId)); });
    let backlog = 0;
    const backlogTasks = [];
    const lags = [];
    mine.forEach(function (t) {
      if (!t.requiresManualGrading) return;
      const subs = D.idx.subsByTask.get(t.id);
      if (!subs) return;
      let n = 0;
      subs.forEach(function (sub) {
        if (sub.gradedAt === null && t.dueAt <= now) n++;
        if (sub.gradedAt !== null && t.dueAt >= from && t.dueAt < to) lags.push(sub.gradedAt - Math.max(sub.submittedAt, t.dueAt));
      });
      if (n) { backlog += n; backlogTasks.push({ task: t, n: n, total: subs.size }); }
    });
    const classes = new Set(sessions.map(function (s) { return s.classId; }));
    return { tid: tid, sessions: sessions, ops: ops, assigned: assigned.length, backlog: backlog, backlogTasks: backlogTasks, gradeLag: lags.length ? S.mean(lags) : null, nLag: lags.length, classes: classes };
  }

  GT.page({
    id: 'teachers',
    title: 'Báo cáo vận hành giáo viên',
    subtitle: 'Chỉ hành vi vận hành: điểm danh trước buổi, báo cáo sau buổi, giao và chấm nhiệm vụ',
    filters: { period: 'week', group: true },
    render: function (ctx, root) {
      const D = ctx.D, cfg = ctx.cfg, r = ctx.range;
      if (!cfg.display.showTeacherReport) {
        root.appendChild(el('div', { class: 'callout warn' }, [el('b', { text: 'Trường đã tắt báo cáo theo giáo viên. ' }), 'Bật lại tại ', el('a', { href: 'settings.html', text: 'Cấu hình → Hiển thị' }), ' nếu chính sách của trường cho phép.']));
        return;
      }
      root.appendChild(el('div', { class: 'callout' }, [el('b', { text: 'Nguyên tắc: ' }), 'báo cáo chỉ đo hành vi vận hành mà giáo viên kiểm soát được. Không xếp hạng giáo viên theo kết quả học tập của lớp; kết quả lớp chỉ để tham chiếu trong phần chi tiết. Dùng để hỗ trợ, nhắc nhở quy trình — không dùng làm kết luận đánh giá giáo viên.']));
      const used = new Set(D.sessions.map(function (s) { return s.teacherId; }));
      const rows = D.teachers.filter(function (t) { return used.has(t.id); }).map(function (t) { return Object.assign({ t: t }, teacherOps(ctx, t.id, r.from, r.to)); }).filter(function (x) { return x.sessions.length || x.backlog; });
      const all = M.opsSummary(rows.reduce(function (a, x) { return a.concat(x.sessions); }, []), ctx.now, cfg);
      const backlog = rows.reduce(function (s, x) { return s + x.backlog; }, 0);
      root.appendChild(UI.kpis([
        { label: 'Giáo viên có buổi dạy trong kỳ', value: F.int(rows.filter(function (x) { return x.sessions.length; }).length), sub: F.int(all.total) + ' buổi · ' + r.label },
        { label: 'Điểm danh đúng thời điểm', value: F.pct(all.attOnTimeRate), sub: all.attOnTime + '/' + all.attOnTimeDenom + ' buổi · trong ' + cfg.ops.attendanceGraceMin + ' phút đầu', ref: 'M-OPS-06' },
        { label: 'Báo cáo trong ' + cfg.ops.reportOnTimeHours + ' giờ', value: F.pct(all.report24Rate), sub: all.rep24 + '/' + all.rep24Denom + ' buổi', ref: 'M-OPS-08' },
        { label: 'Bài quá hạn chưa chấm', value: F.int(backlog), sub: 'nhiệm vụ chấm tay, tính đến hiện tại', ref: 'M-OPS-10' }
      ]));
      const tbl = UI.table({
        columns: [
          { key: 'name', label: 'Giáo viên', value: function (x) { return x.t.name; }, fmt: function (x) { return '<b>' + esc(x.t.name) + '</b><div class="muted small">' + esc(x.t.subject) + '</div>'; } },
          { key: 'n', label: 'Số buổi dạy', align: 'r', value: function (x) { return x.sessions.length; }, fmt: function (x) { return F.int(x.sessions.length) + '<div class="muted small">' + x.ops.started + ' đã bắt đầu</div>'; } },
          { key: 'att', label: '% điểm danh đúng thời điểm', align: 'r', value: function (x) { return x.ops.attOnTimeRate; }, fmt: function (x) { return opsCell(x.ops.attOnTimeRate, x.ops.attOnTime, x.ops.attOnTimeDenom, 0.9); } },
          { key: 'rep', label: '% báo cáo trong ' + cfg.ops.reportOnTimeHours + 'h', align: 'r', value: function (x) { return x.ops.report24Rate; }, fmt: function (x) { return opsCell(x.ops.report24Rate, x.ops.rep24, x.ops.rep24Denom, 0.9); } },
          { key: 'missing', label: 'Buổi chưa điểm danh / chưa báo cáo', align: 'r', value: function (x) { return x.ops.started - x.ops.taken + (x.ops.ended - x.ops.reported); }, fmt: function (x) { return (x.ops.started - x.ops.taken) + ' / ' + (x.ops.ended - x.ops.reported); } },
          { key: 'tasks', label: 'Nhiệm vụ đã giao', align: 'r', value: function (x) { return x.assigned; } },
          { key: 'backlog', label: 'Bài quá hạn chưa chấm', align: 'r', value: function (x) { return x.backlog; }, fmt: function (x) { return x.backlog ? '<b style="color:var(--bad-text)">' + F.int(x.backlog) + '</b>' : '0'; } },
          { key: 'lag', label: 'Thời gian chấm TB', align: 'r', value: function (x) { return x.gradeLag; }, fmt: function (x) { return x.gradeLag === null ? '<span class="muted" title="Không có bài chấm tay đã chấm trong kỳ">–</span>' : DT.fmtDuration(x.gradeLag) + '<div class="muted small">' + x.nLag + ' bài</div>'; }, csv: function (x) { return x.gradeLag === null ? '' : Math.round(x.gradeLag / HOUR * 10) / 10 + ' giờ'; } },
          { key: 'cls', label: 'Số lớp phụ trách', align: 'r', value: function (x) { return x.classes.size; }, fmt: function (x) { return x.classes.size + '<div class="muted small">' + esc(Array.from(x.classes).map(ctx.className).join(', ')) + '</div>'; } }
        ],
        rows: rows, sort: { key: 'name', dir: 1 }, csv: 'van-hanh-giao-vien.csv',
        onRow: function (x) { teacherPopup(ctx, x); }
      });
      root.appendChild(UI.card({
        title: 'Bảng vận hành theo giáo viên', proposal: true,
        question: 'Giáo viên nào cần hỗ trợ về quy trình điểm danh, báo cáo, chấm bài?',
        body: tbl,
        note: 'Sắp xếp mặc định theo tên (không xếp hạng). Đỏ = dưới 90%. Thời gian chấm = từ max(lúc nộp, hạn nộp) đến lúc chấm, chỉ nhiệm vụ chấm tay có hạn trong kỳ. Nhấn vào giáo viên để xem buổi còn thiếu và nhiệm vụ tồn chấm.'
      }));
      root.appendChild(UI.alertBlock({ alerts: A.filter(ctx.alerts(), { ruleIds: ['OPS-01', 'OPS-02', 'OPS-03', 'OPS-04'] }), title: 'Cảnh báo vận hành liên quan giáo viên', moreHref: 'alerts.html' + GT.qs.build({ alertGroup: 'OPS' }) }));
      if (!openedOnce && ctx.q.teacherId) {
        openedOnce = true;
        const x = rows.filter(function (y) { return y.tid === ctx.q.teacherId; })[0] || Object.assign({ t: D.teacherById.get(ctx.q.teacherId) }, teacherOps(ctx, ctx.q.teacherId, r.from, r.to));
        if (x.t) setTimeout(function () { teacherPopup(ctx, x); }, 0);
      }
    }
  });

  function opsCell(rate, n, d, warn) {
    if (rate === null) return '<span class="muted" title="Mẫu số = 0">–</span>';
    const bad = rate < warn;
    return (bad ? '<b style="color:var(--bad-text)">' : '') + F.pct(rate) + (bad ? ' ▼</b>' : '') + '<div class="muted small">' + n + '/' + d + '</div>';
  }

  function teacherPopup(ctx, x) {
    const D = ctx.D, now = ctx.now, cfg = ctx.cfg;
    const grace = cfg.ops.attendanceGraceMin * DT.MIN, repH = cfg.ops.reportOnTimeHours * HOUR;
    const body = el('div');
    const miss = x.sessions.filter(function (s) {
      return (s.start + grace <= now && (s.attendanceSubmittedAt === null || s.attendanceSubmittedAt > s.start + grace)) || (s.end + repH <= now && (s.reportSubmittedAt === null || s.reportSubmittedAt > s.end + repH));
    });
    body.appendChild(el('h4', { style: { margin: '0 0 6px' }, text: 'Buổi chưa điểm danh / điểm danh muộn / chưa báo cáo trong kỳ (' + miss.length + ')' }));
    body.appendChild(UI.table({
      columns: [
        { key: 'd', label: 'Buổi', value: function (s) { return s.start; }, fmt: function (s) { return DT.weekdayShort(s.start) + ' ' + DT.fmtDate(s.start) + ' ' + DT.fmtTime(s.start); } },
        { key: 'c', label: 'Lớp', value: function (s) { return ctx.className(s.classId); } },
        { key: 'a', label: 'Điểm danh', value: function (s) { return s.attendanceSubmittedAt; }, fmt: function (s) { return s.attendanceSubmittedAt === null ? UI.dotLabel(C.status.RED, 'Chưa điểm danh') : s.attendanceSubmittedAt > s.start + grace ? UI.dotLabel(C.status.ORANGE, 'Muộn ' + DT.fmtDuration(s.attendanceSubmittedAt - s.start)) : UI.dotLabel(C.status.GREEN, 'Đúng thời điểm'); } },
        { key: 'r', label: 'Báo cáo', value: function (s) { return s.reportSubmittedAt; }, fmt: function (s) { return s.end > now ? '<span class="muted">Chưa kết thúc</span>' : s.reportSubmittedAt === null ? UI.dotLabel(C.status.RED, 'Chưa nộp') : UI.dotLabel(s.reportSubmittedAt > s.end + repH ? C.status.ORANGE : C.status.GREEN, 'Sau ' + DT.fmtDuration(s.reportSubmittedAt - s.end)); } }
      ], rows: miss, sort: { key: 'd', dir: -1 }, capped: true, csv: 'buoi-thieu-' + x.tid + '.csv', empty: 'Không có buổi nào thiếu điểm danh/báo cáo trong kỳ.'
    }));
    body.appendChild(el('h4', { style: { margin: '14px 0 6px' }, text: 'Nhiệm vụ tồn chấm (' + x.backlogTasks.length + ' nhiệm vụ, ' + x.backlog + ' bài)' }));
    body.appendChild(UI.table({
      columns: [
        { key: 'due', label: 'Hạn', value: function (b) { return b.task.dueAt; }, fmt: function (b) { return DT.fmtDate(b.task.dueAt) + '<div class="muted small">quá hạn ' + F.num((now - b.task.dueAt) / DT.DAY, 1) + ' ngày</div>'; } },
        { key: 'cls', label: 'Lớp', value: function (b) { return ctx.className(b.task.classId); } },
        { key: 'title', label: 'Nhiệm vụ', value: function (b) { return b.task.title; } },
        { key: 'n', label: 'Chưa chấm', align: 'r', value: function (b) { return b.n; }, fmt: function (b) { return b.n + '/' + b.total; } }
      ], rows: x.backlogTasks, sort: { key: 'due', dir: 1 }, capped: true, csv: 'ton-cham-' + x.tid + '.csv', empty: 'Không có bài quá hạn chưa chấm.'
    }));
    // Tham chiếu kết quả lớp
    const cls = Array.from(new Set(D.sessions.filter(function (s) { return s.teacherId === x.tid; }).map(function (s) { return s.classId + '|' + s.courseId; })));
    body.appendChild(el('h4', { style: { margin: '14px 0 6px' }, text: 'Tham chiếu: kết quả học tập của các lớp phụ trách' }));
    body.appendChild(UI.table({
      columns: [
        { key: 'c', label: 'Lớp – khóa', value: function (k) { return k; }, fmt: function (k) { const p = k.split('|'); return UI.link(ctx.href('class.html', { classId: p[0], tab: 'learning', courseId: p[1], groupId: null }), 'Lớp ' + ctx.className(p[0])) + ' · ' + esc(ctx.courseName(p[1])); } },
        { key: 'g', label: '% CĐR Xanh (lớp)', align: 'r', sort: false, fmt: function (k) { const p = k.split('|'); return F.pct(M.loGreenShare(D, { classIds: [p[0]], courseIds: [p[1]] }, cfg, now).share); } },
        { key: 'p', label: 'Tỉ lệ đạt CĐR (lớp)', align: 'r', sort: false, fmt: function (k) { const p = k.split('|'); const mx = M.loMatrix(D, p[1], null, cfg, now); const st = mx.classTotals.get(p[0]); return st ? F.pct(st.passRate) : '–'; } }
      ], rows: cls, csv: false
    }));
    body.appendChild(el('div', { class: 'note cause', style: { marginTop: '10px' }, text: GT.metrics.CAUSE_NOTE + ' Không dùng các số liệu này để xếp hạng giáo viên.' }));
    UI.modal({ title: 'GV ' + x.t.name, subtitle: x.t.subject + ' · ' + ctx.range.label, body: body });
  }
})(window.GT);
