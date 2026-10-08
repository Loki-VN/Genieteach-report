/**
 * GenieTeach — Báo cáo Học vụ (prototype)
 * tests.js — Bộ assert cho metrics.js / alerts.js (mở tests.html).
 * Dùng dữ liệu tổng hợp nhỏ dựng tay để kiểm tra điểm biên, cộng với kiểm tra tích hợp trên mock mặc định.
 */
(function (GT) {
  'use strict';
  const M = GT.metrics, A = GT.alerts, DT = GT.date, F = GT.fmt;
  const DAY = DT.DAY, HOUR = DT.HOUR, MIN = DT.MIN;
  const results = [];
  let section = '';

  function test(name, fn) {
    try {
      const r = fn();
      results.push({ section: section, name: name, ok: r !== false, msg: typeof r === 'string' ? r : '' });
    } catch (e) {
      results.push({ section: section, name: name, ok: false, msg: e && e.message ? e.message : String(e) });
    }
  }
  function eq(a, b, label) {
    if (a !== b) throw new Error((label ? label + ': ' : '') + 'mong đợi ' + JSON.stringify(b) + ', nhận ' + JSON.stringify(a));
    return true;
  }
  function near(a, b, eps, label) {
    if (a === null || Math.abs(a - b) > (eps || 1e-9)) throw new Error((label ? label + ': ' : '') + 'mong đợi ≈ ' + b + ', nhận ' + a);
    return true;
  }
  function ok(c, label) { if (!c) throw new Error(label || 'điều kiện sai'); return true; }

  const cfg = GT.config.withOverrides({});   // cấu hình mặc định, không phụ thuộc localStorage

  // ------------------------------------------------------------------ Bộ dữ liệu tổng hợp
  const NOW = DT.make(2026, 10, 8, 9, 40);
  const T0 = DT.make(2026, 6, 1);
  const T1 = DT.make(2026, 12, 31, 23, 59);

  /** Dựng D tổng hợp: classes = [{id, group, n}], sessions = [{classId, start, statuses:[...]}]. */
  function makeAttendanceD(opts) {
    const raw = { meta: { now: NOW, slots: GT.mock.SLOTS }, groups: [], classes: [], students: [], enrollments: [], teachers: [{ id: 'T', name: 'GV Test' }], courses: [{ id: 'CO', name: 'Khóa test', passThreshold: 50, weightTaskCompletion: 0.3, weightTestScore: 0.7 }], classCourses: [], sessions: [], attendance: [] };
    const groups = {};
    opts.classes.forEach(function (c) {
      if (!groups[c.group]) { groups[c.group] = true; raw.groups.push({ id: c.group, name: c.group }); }
      raw.classes.push({ id: c.id, name: c.id, groupId: c.group, homeroomTeacherId: null });
      raw.classCourses.push({ classId: c.id, courseId: 'CO', teacherIds: ['T'], startAt: T0, endAt: T1 });
      (c.students || []).forEach(function (sid) {
        if (!raw.students.some(function (s) { return s.id === sid; })) raw.students.push({ id: sid, fullName: 'HS ' + sid, code: sid });
        raw.enrollments.push({ studentId: sid, classId: c.id, startAt: T0, endAt: null });
      });
    });
    let k = 0;
    opts.sessions.forEach(function (s) {
      const id = 'X' + (++k);
      raw.sessions.push({ id: id, classId: s.classId, courseId: 'CO', teacherId: 'T', start: s.start, end: s.start + 90 * MIN, slot: 1, attendanceSubmittedAt: s.start + MIN, reportSubmittedAt: s.start + 2 * HOUR });
      s.records.forEach(function (r) { raw.attendance.push({ sessionId: id, studentId: r[0], status: r[1], markedAt: s.start + MIN }); });
    });
    return GT.data.build(raw);
  }
  function stu(prefix, n) { const a = []; for (let i = 1; i <= n; i++) a.push(prefix + i); return a; }

  // =================================================================== 1. Định dạng
  section = 'Định dạng vi-VN & phép chia cho 0';
  test('Tỉ lệ dùng dấu phẩy thập phân: 0,853 → "85,3%"', function () { return eq(F.pct(0.853), '85,3%'); });
  test('Số nguyên có dấu chấm hàng nghìn: 1234 → "1.234"', function () { return eq(F.int(1234), '1.234'); });
  test('Chênh lệch điểm %: +0,021 → "+2,1 điểm %"', function () { return eq(F.pts(0.021), '+2,1 điểm %'); });
  test('Mẫu số = 0 → ratio = null → hiển thị "–"', function () { eq(GT.stats.ratio(5, 0), null); return eq(F.pct(GT.stats.ratio(5, 0)), '–'); });
  test('NaN / Infinity không bao giờ hiển thị', function () { eq(F.pct(NaN), '–'); eq(F.pct(Infinity), '–'); eq(F.num(undefined), '–'); return eq(F.score(-Infinity), '–'); });
  test('Ngày dd/MM/yyyy và giờ HH:mm', function () { eq(DT.fmtDate(NOW), '08/10/2026'); return eq(DT.fmtTime(NOW), '09:40'); });
  test('Tuần bắt đầu Thứ Hai (08/10/2026 → 05/10/2026)', function () { return eq(DT.fmtDate(DT.startOfWeek(NOW)), '05/10/2026'); });
  test('Chủ nhật thuộc tuần bắt đầu Thứ Hai trước đó', function () { return eq(DT.fmtDate(DT.startOfWeek(DT.make(2026, 10, 11, 20, 0))), '05/10/2026'); });

  // =================================================================== 2. Chuẩn đầu ra — điểm biên
  section = 'Chuẩn đầu ra — quy đổi cấp & màu (điểm biên)';
  [[90, 'EXCELLENT'], [89.99, 'GOOD'], [75, 'GOOD'], [74.99, 'AVERAGE'], [60, 'AVERAGE'], [59.99, 'NEEDS_IMPROVEMENT'],
    [40, 'NEEDS_IMPROVEMENT'], [39.99, 'POOR'], [0, 'POOR'], [null, 'NO_DATA']].forEach(function (c) {
    test('Cấp của ' + c[0] + '% = ' + M.LEVEL_META[c[1]].label, function () { return eq(M.loLevel(c[0], cfg), c[1]); });
  });
  test('Đạt yêu cầu: 60% đạt, 59,99% không đạt, null không đạt', function () { eq(M.loPass(60, cfg), true); eq(M.loPass(59.99, cfg), false); return eq(M.loPass(null, cfg), false); });
  test('Tỉ lệ đạt đúng 80% → Xanh', function () { return eq(M.loColor(4, 5, cfg), 'GREEN'); });
  test('Tỉ lệ đạt 79,99% → Cam', function () { return eq(M.loColor(7999, 10000, cfg), 'ORANGE'); });
  test('Tỉ lệ đạt đúng 50% → Cam', function () { return eq(M.loColor(1, 2, cfg), 'ORANGE'); });
  test('Tỉ lệ đạt 49,99% → Đỏ', function () { return eq(M.loColor(4999, 10000, cfg), 'RED'); });
  test('Điểm biên 70% không lỗi dấu phẩy động (7/10 với ngưỡng Xanh 70)', function () {
    return eq(M.loColor(7, 10, GT.config.withOverrides({ lo: { color: { green: 70 } } })), 'GREEN');
  });
  test('Coverage = 0 → Xám, tỉ lệ đạt null', function () {
    const s = M.loStatsFromRows([], 30, cfg);
    eq(s.color, 'GRAY'); eq(s.coverage, 0); return eq(s.passRate, null);
  });
  test('Sĩ số = 0 → coverage null (hiển thị "–"), Xám', function () {
    const s = M.loStatsFromRows([], 0, cfg);
    eq(s.coverage, null); return eq(s.color, 'GRAY');
  });
  test('"Dữ liệu mỏng": 8/30 (26,7%) mỏng; 9/30 (30%) không mỏng', function () {
    eq(M.isThin(8, 30, cfg), true); eq(M.isThin(9, 30, cfg), false); return eq(M.isThin(0, 30, cfg), false);
  });
  test('Đổi "đạt yêu cầu" sang mức Tốt → 70% không đạt', function () {
    return eq(M.loPass(70, GT.config.withOverrides({ lo: { passLevel: 'GOOD' } })), false);
  });

  // =================================================================== 3. Chuyên cần
  section = 'Chuyên cần — mẫu số, nhiều lớp, weighted';
  const d1 = DT.make(2026, 10, 5, 7, 0);
  const DA = makeAttendanceD({
    classes: [{ id: 'C1', group: 'G', students: ['s1', 's2'] }, { id: 'C2', group: 'G', students: ['s1', 's3'] }],
    sessions: [
      { classId: 'C1', start: d1, records: [['s1', 'ON_TIME'], ['s2', 'NOT_TAKEN']] },
      { classId: 'C1', start: d1 + DAY, records: [['s1', 'LATE'], ['s2', 'UNEXCUSED']] },
      { classId: 'C2', start: d1 + 2 * DAY, records: [['s1', 'UNEXCUSED'], ['s3', 'EXCUSED']] }
    ]
  });
  test('NOT_TAKEN không vào mẫu số; tỉ lệ chưa điểm danh tính riêng', function () {
    const c = M.attendanceCounts(DA, { classIds: ['C1'] }, d1, d1 + 7 * DAY);
    eq(c.taken, 3, 'mẫu số'); eq(c.total, 4, 'tổng bản ghi');
    near(M.attendanceRates(c).present, 2 / 3); return near(M.attendanceRates(c).notTaken, 1 / 4);
  });
  test('Học sinh nhiều lớp: cấp học sinh gộp mọi lớp (s1: 2/3 có mặt)', function () {
    const c = M.attendanceCounts(DA, { studentIds: ['s1'] }, d1, d1 + 7 * DAY);
    eq(c.taken, 3); return near(M.attendanceRates(c).present, 2 / 3);
  });
  test('Học sinh nhiều lớp: cấp lớp chỉ tính buổi của lớp đó (s1 ở C1: 2/2)', function () {
    const c = M.attendanceCounts(DA, { studentIds: ['s1'], classIds: ['C1'] }, d1, d1 + 7 * DAY);
    eq(c.taken, 2); return near(M.attendanceRates(c).present, 1);
  });
  test('Chuỗi vắng không phép bỏ qua NOT_TAKEN, bị cắt bởi trạng thái khác', function () {
    const r = function (s) { return { status: s }; };
    eq(M.longestUnexcusedStreak([r('UNEXCUSED'), r('NOT_TAKEN'), r('UNEXCUSED'), r('EXCUSED'), r('UNEXCUSED')]), 2);
    return eq(M.longestUnexcusedStreak([r('LATE'), r('UNEXCUSED'), r('ON_TIME'), r('UNEXCUSED')]), 1);
  });
  // Weighted vs unweighted
  const s10 = stu('a', 10), s100 = stu('b', 100);
  const DW = makeAttendanceD({
    classes: [{ id: 'K1', group: 'G', students: s10 }, { id: 'K2', group: 'G', students: s100 }],
    sessions: [
      { classId: 'K1', start: d1, records: s10.map(function (s, i) { return [s, i < 9 ? 'ON_TIME' : 'UNEXCUSED']; }) },
      { classId: 'K2', start: d1, records: s100.map(function (s, i) { return [s, i < 50 ? 'ON_TIME' : 'UNEXCUSED']; }) }
    ]
  });
  test('Nhóm lớp tính weighted: (9+50)/(10+100) = 53,6%, không phải TB 2 lớp (70%)', function () {
    const g = M.attendanceRates(M.attendanceCounts(DW, { groupIds: ['G'] }, d1, d1 + DAY)).present;
    near(g, 59 / 110);
    const unweighted = (0.9 + 0.5) / 2;
    return ok(Math.abs(g - unweighted) > 0.1, 'weighted phải khác unweighted');
  });
  test('Σ theo ngày = số liệu tuần (nhất quán kỳ)', function () {
    const D = GT.data.load();
    const w0 = DT.startOfWeek(D.meta.now) - 7 * DAY;
    const week = M.attendanceCounts(D, {}, w0, w0 + 7 * DAY);
    let sum = M.emptyAttendance();
    for (let i = 0; i < 7; i++) sum = M.addAttendance(sum, M.attendanceCounts(D, {}, w0 + i * DAY, w0 + (i + 1) * DAY));
    eq(sum.taken, week.taken, 'taken'); return eq(sum.NOT_TAKEN, week.NOT_TAKEN, 'NOT_TAKEN');
  });
  test('Σ theo ngày trong tháng = số liệu tháng (nhiệm vụ, theo dueAt)', function () {
    const D = GT.data.load();
    const m0 = DT.startOfMonth(D.meta.now - 20 * DAY), m1 = DT.addMonths(m0, 1);
    const month = M.taskCounts(D, {}, m0, m1);
    let on = 0, miss = 0;
    for (let t = m0; t < m1; t += DAY) { const c = M.taskCounts(D, {}, t, Math.min(t + DAY, m1)); on += c.ON_TIME; miss += c.MISSING; }
    eq(on, month.ON_TIME, 'ON_TIME'); return eq(miss, month.MISSING, 'MISSING');
  });

  // =================================================================== Kỳ dữ liệu — 4 chế độ (period.js)
  section = 'Kỳ dữ liệu — 4 chế độ';
  const P = GT.period;
  const D0 = GT.data.load();
  const sameCounts = function (a, b) {   // so chuyên cần + nhiệm vụ + buổi học của hai khoảng
    const att = function (r) { const c = M.attendanceCounts(D0, {}, r.from, r.to); return [c.ON_TIME, c.LATE, c.EXCUSED, c.UNEXCUSED, c.NOT_TAKEN].join('/'); };
    const tsk = function (r) { const c = M.taskCounts(D0, {}, r.from, r.to); return [c.ON_TIME, c.LATE, c.MISSING, c.OPEN].join('/'); };
    eq(att(a), att(b), 'chuyên cần'); eq(tsk(a), tsk(b), 'nhiệm vụ');
    return eq(M.sessionsIn(D0, {}, a.from, a.to).length, M.sessionsIn(D0, {}, b.from, b.to).length, 'số buổi');
  };
  test('Khoảng tùy chọn 28/09–04/10 = chế độ Tuần (chuyên cần, nhiệm vụ, số buổi)', function () {
    const wk = P.range({ mode: 'week', date: DT.make(2026, 10, 1) }, NOW);
    const cu = P.range({ mode: 'custom', date: NOW, from: DT.make(2026, 9, 28), to: DT.make(2026, 10, 4) }, NOW);
    eq(cu.from, wk.from, 'from'); eq(cu.to, wk.to, 'to');
    return sameCounts(cu, wk);
  });
  test('Σ các ngày của chế độ Ngày = chế độ Tuần (cùng tuần 28/09–04/10)', function () {
    const wk = P.range({ mode: 'week', date: DT.make(2026, 9, 30) }, NOW);
    let taken = 0, nt = 0, sess = 0;
    P.buckets(wk.from, wk.to, 'day').forEach(function (b) {
      const r = P.range({ mode: 'day', date: b.from }, NOW);
      const c = M.attendanceCounts(D0, {}, r.from, r.to);
      taken += c.taken; nt += c.NOT_TAKEN; sess += M.sessionsIn(D0, {}, r.from, r.to).length;
    });
    const w = M.attendanceCounts(D0, {}, wk.from, wk.to);
    eq(taken, w.taken, 'taken'); eq(nt, w.NOT_TAKEN, 'NOT_TAKEN');
    return eq(sess, M.sessionsIn(D0, {}, wk.from, wk.to).length, 'số buổi');
  });
  test('Σ các tuần (cắt theo biên tháng) = chế độ Tháng 9/2026', function () {
    const mo = P.range({ mode: 'month', date: DT.make(2026, 9, 15) }, NOW);
    const parts = P.buckets(mo.from, mo.to, 'week');
    eq(parts[0].from, mo.from, 'tuần đầu bắt đầu đúng 01/09'); eq(parts[parts.length - 1].to, mo.to, 'tuần cuối kết thúc đúng 01/10');
    let taken = 0, on = 0, miss = 0;
    parts.forEach(function (b) { taken += M.attendanceCounts(D0, {}, b.from, b.to).taken; const t = M.taskCounts(D0, {}, b.from, b.to); on += t.ON_TIME; miss += t.MISSING; });
    const t = M.taskCounts(D0, {}, mo.from, mo.to);
    eq(taken, M.attendanceCounts(D0, {}, mo.from, mo.to).taken, 'taken'); eq(on, t.ON_TIME, 'ON_TIME');
    return eq(miss, t.MISSING, 'MISSING');
  });
  test('Kỳ liền trước của Tháng 10/2026 = 01/09–30/09 (30 ngày)', function () {
    const pv = P.previous({ mode: 'month', date: DT.make(2026, 10, 1) }, NOW);
    eq(DT.fmtDate(pv.from), '01/09/2026', 'from'); eq(DT.fmtDate(pv.to), '01/10/2026', 'to (không gồm)');
    return eq(pv.days, 30, 'số ngày');
  });
  test('Kỳ liền trước của Tháng 3/2026 = tháng 2 (28 ngày)', function () {
    const pv = P.previous({ mode: 'month', date: DT.make(2026, 3, 31) }, NOW);
    eq(DT.fmtDate(pv.from), '01/02/2026', 'from'); return eq(pv.days, 28, 'số ngày');
  });
  test('Kỳ liền trước của Tuần neo Chủ nhật 11/10 = tuần 28/09–04/10', function () {
    const pv = P.previous({ mode: 'week', date: DT.make(2026, 10, 11) }, NOW);
    eq(DT.fmtDate(pv.from), '28/09/2026', 'from'); return eq(DT.fmtDate(pv.to - DAY), '04/10/2026', 'ngày cuối');
  });
  test('Kỳ liền trước của Ngày Thứ Hai 05/10 = Chủ nhật 04/10', function () {
    const pv = P.previous({ mode: 'day', date: DT.make(2026, 10, 5) }, NOW);
    return eq(DT.fmtDate(pv.from), '04/10/2026');
  });
  test('Kỳ liền trước của Khoảng 21–30/09 = 10 ngày 11–20/09', function () {
    const pv = P.previous({ mode: 'custom', date: NOW, from: DT.make(2026, 9, 21), to: DT.make(2026, 9, 30) }, NOW);
    eq(DT.fmtDate(pv.from), '11/09/2026', 'from'); eq(DT.fmtDate(pv.to - DAY), '20/09/2026', 'ngày cuối');
    return eq(pv.days, 10, 'số ngày');
  });
  test('Biên [from, to): buổi bắt đầu đúng 00:00 ngày sau thuộc ngày sau', function () {
    const d = P.range({ mode: 'day', date: DT.make(2026, 10, 7) }, NOW);
    const next = P.range({ mode: 'day', date: DT.make(2026, 10, 8) }, NOW);
    eq(d.to, next.from, 'hai ngày liền kề không chồng nhau');
    const leaked = M.sessionsIn(D0, {}, d.from, d.to).filter(function (s) { return s.start >= next.from; }).length;
    return eq(leaked, 0, 'buổi của ngày sau lọt vào ngày trước');
  });

  // =================================================================== 4. Nhiệm vụ & khóa trực tuyến
  section = 'Nhiệm vụ & khóa trực tuyến';
  const task = { id: 't', dueAt: DT.make(2026, 10, 5, 23, 59), itemCount: 5, maxScore: 10 };
  test('Nộp đúng thời điểm hạn → ĐÚNG HẠN', function () { return eq(M.taskStatus(task, { submittedAt: task.dueAt, completedItems: 5 }, NOW).status, 'ON_TIME'); });
  test('Nộp sau hạn 1 phút → MUỘN', function () { return eq(M.taskStatus(task, { submittedAt: task.dueAt + MIN, completedItems: 5 }, NOW).status, 'LATE'); });
  test('Quá hạn chưa nộp → KHÔNG HOÀN THÀNH', function () { return eq(M.taskStatus(task, undefined, NOW).status, 'MISSING'); });
  test('Chưa đến hạn (kể cả đã nộp) → ĐANG MỞ', function () { return eq(M.taskStatus({ dueAt: NOW + DAY, itemCount: 5 }, { submittedAt: NOW - HOUR, completedItems: 5 }, NOW).status, 'OPEN'); });
  test('Nộp 3/5 bài → "Nộp chưa đủ"', function () { return eq(M.taskStatus(task, { submittedAt: task.dueAt - HOUR, completedItems: 3 }, NOW).partial, true); });
  test('Tỉ lệ chỉ tính trên nhiệm vụ đã quá hạn (OPEN không vào mẫu số)', function () {
    const r = M.taskRates({ ON_TIME: 6, LATE: 2, MISSING: 2, OPEN: 50, overdue: 10, PARTIAL: 1, FULL: 7, graded: 0, scoreSum: 0 });
    near(r.onTime, 0.6); return eq(r.avgScore, null);
  });
  test('Điểm chuẩn hóa thang 10 (75/100 → 7,5)', function () { return near(M.normScore({ maxScore: 100 }, { score: 75 }), 7.5); });
  test('Điểm tổng hợp = 0,3 × hoàn thành + 0,7 × kiểm tra (100%, 40 → 58)', function () {
    const p = { passThreshold: 50, wTask: 0.3, wTest: 0.7 };
    return near(M.compositeScore({ totalItems: 10, completedItems: 10, testScore: 40 }, p).value, 58);
  });
  test('Điểm tổng hợp: chưa có điểm kiểm tra → hasTest = false', function () {
    return eq(M.compositeScore({ totalItems: 10, completedItems: 4, testScore: null }, { wTask: 0.3, wTest: 0.7 }).hasTest, false);
  });
  test('Tiến độ kỳ vọng nửa thời gian = 50%', function () {
    return near(M.expectedProgress({ startAt: 0, dueAt: 10 * DAY }, 5 * DAY), 0.5);
  });
  test('Tiến độ tại mốc dùng log itemCompletedAt', function () {
    return near(M.progressAt({ totalItems: 4, completedItems: 3, itemCompletedAt: [1, 2, 10] }, 5), 0.5);
  });

  // =================================================================== 5. Cỡ mẫu tối thiểu
  section = 'Cỡ mẫu tối thiểu (rule cấp lớp)';
  function lowPresenceD(nStudents, nSessions) {
    const ss = stu('m', nStudents);
    const sessions = [];
    for (let i = 0; i < nSessions; i++) {
      sessions.push({ classId: 'L1', start: NOW - (i + 1) * DAY + HOUR, records: ss.map(function (s, j) { return [s, j % 2 ? 'UNEXCUSED' : 'ON_TIME']; }) });
    }
    return makeAttendanceD({ classes: [{ id: 'L1', group: 'G', students: ss }], sessions: sessions });
  }
  test('29 bản ghi (mẫu số < 30) → ATT-C01 KHÔNG chạy', function () {
    // 29 học sinh × 1 buổi = 29 bản ghi, có mặt ~50%
    return eq(A.runRule(lowPresenceD(29, 1), cfg, 'ATT-C01').length, 0);
  });
  test('30 bản ghi → ATT-C01 chạy (có mặt 50% < 85%)', function () {
    return eq(A.runRule(lowPresenceD(30, 1), cfg, 'ATT-C01').length, 1);
  });
  test('9 học sinh có dữ liệu (dù 36 bản ghi) → ATT-C01 KHÔNG chạy', function () {
    return eq(A.runRule(lowPresenceD(9, 4), cfg, 'ATT-C01').length, 0);
  });
  test('10 học sinh × 3 buổi = 30 bản ghi → ATT-C01 chạy', function () {
    return eq(A.runRule(lowPresenceD(10, 3), cfg, 'ATT-C01').length, 1);
  });
  test('Mock: lớp TA-04 (sĩ số 8) không có cảnh báo tỉ lệ cấp lớp', function () {
    const D = GT.data.load();
    const bad = A.run(D, GT.config.get()).alerts.filter(function (a) {
      return a.classId === 'TA04' && !a.grouped && ['ATT-C01', 'ATT-C02', 'ATT-C03', 'ATT-C04', 'HW-C01', 'HW-C02', 'LO-C01', 'LO-C02', 'LO-C03', 'OPS-06', 'ONL-C01', 'ONL-C02'].indexOf(a.ruleId) >= 0;
    });
    return eq(bad.length, 0);
  });

  // =================================================================== 6. Diễn giải nguyên nhân (mục 3.6)
  section = 'Diễn giải nguyên nhân (mục 3.6)';
  /** D với 1 khóa, 1 CĐR, các lớp có (sĩ số, số đạt, số có dữ liệu, evidence/học sinh). */
  function causeD(specs) {
    const raw = { meta: { now: NOW }, groups: [{ id: 'G', name: 'G' }], classes: [], students: [], enrollments: [], teachers: [],
      courses: [{ id: 'CO', name: 'Khóa' }], classCourses: [], los: [{ id: 'LO1', courseId: 'CO', code: 'X.1', name: 'X', order: 1 }], loAchievements: [] };
    specs.forEach(function (s) {
      raw.classes.push({ id: s.id, name: s.id, groupId: 'G' });
      raw.classCourses.push({ classId: s.id, courseId: 'CO', teacherIds: [], startAt: T0, endAt: T1 });
      for (let i = 0; i < s.n; i++) {
        const sid = s.id + '_' + i;
        raw.students.push({ id: sid, fullName: sid, code: sid });
        raw.enrollments.push({ studentId: sid, classId: s.id, startAt: T0, endAt: null });
        const has = i < s.data;
        raw.loAchievements.push({ studentId: sid, classId: s.id, courseId: 'CO', loId: 'LO1', percent: has ? (i < s.pass ? 80 : 20) : null, evidenceCount: has ? (s.ev || 5) : 0 });
      }
    });
    return GT.data.build(raw);
  }
  test('Đỏ ở 3/5 lớp (= 60%) → "Nghi vấn chương trình"', function () {
    const D = causeD([{ id: 'A', n: 20, data: 20, pass: 4 }, { id: 'B', n: 20, data: 20, pass: 5 }, { id: 'C', n: 20, data: 20, pass: 6 },
      { id: 'D', n: 20, data: 20, pass: 18 }, { id: 'E', n: 20, data: 20, pass: 19 }]);
    return eq(M.causeAnalysis(D, 'CO', cfg, NOW).curriculum.get('LO1').label, 'CURRICULUM');
  });
  test('Đỏ ở 2/5 lớp (40%) → không gắn nhãn chương trình', function () {
    const D = causeD([{ id: 'A', n: 20, data: 20, pass: 4 }, { id: 'B', n: 20, data: 20, pass: 5 }, { id: 'C', n: 20, data: 20, pass: 16 },
      { id: 'D', n: 20, data: 20, pass: 18 }, { id: 'E', n: 20, data: 20, pass: 19 }]);
    return eq(M.causeAnalysis(D, 'CO', cfg, NOW).curriculum.get('LO1').label, 'NONE');
  });
  test('Thấp hơn trung vị lớp khác đúng 25 điểm %, trung vị = ngưỡng Cam (50%) → "Nghi vấn ở lớp học"', function () {
    // Lớp khác: 40%, 50%, 60% → trung vị 50%; lớp X: 25% → chênh đúng 25 điểm
    const D = causeD([{ id: 'X', n: 20, data: 20, pass: 5 }, { id: 'B', n: 20, data: 20, pass: 8 }, { id: 'C', n: 20, data: 20, pass: 10 }, { id: 'E', n: 20, data: 20, pass: 12 }]);
    return eq(M.causeAnalysis(D, 'CO', cfg, NOW).classLabel.get('X|LO1').label, 'CLASS');
  });
  test('Chênh 24 điểm % → không gắn nhãn lớp', function () {
    const D = causeD([{ id: 'X', n: 25, data: 25, pass: 9 }, { id: 'B', n: 20, data: 20, pass: 10 }, { id: 'C', n: 20, data: 20, pass: 14 }, { id: 'E', n: 20, data: 20, pass: 16 }]);
    // X = 36%, trung vị lớp khác = 70% → chênh 34 → CLASS; dùng ca 24 điểm: X = 46%
    const D2 = causeD([{ id: 'X', n: 50, data: 50, pass: 23 }, { id: 'B', n: 20, data: 20, pass: 10 }, { id: 'C', n: 20, data: 20, pass: 14 }, { id: 'E', n: 20, data: 20, pass: 16 }]);
    eq(M.causeAnalysis(D, 'CO', cfg, NOW).classLabel.get('X|LO1').label, 'CLASS');
    return eq(M.causeAnalysis(D2, 'CO', cfg, NOW).classLabel.get('X|LO1').label, 'NONE');
  });
  test('Trung vị lớp khác < ngưỡng Cam → không gắn nhãn lớp (cả khóa đều kém)', function () {
    const D = causeD([{ id: 'X', n: 20, data: 20, pass: 0 }, { id: 'B', n: 20, data: 20, pass: 8 }, { id: 'C', n: 20, data: 20, pass: 9 }, { id: 'E', n: 20, data: 20, pass: 9 }]);
    return eq(M.causeAnalysis(D, 'CO', cfg, NOW).classLabel.get('X|LO1').label, 'NONE');
  });
  test('< 10 học sinh có dữ liệu → "Chưa đủ dữ liệu để kết luận"', function () {
    const D = causeD([{ id: 'X', n: 20, data: 9, pass: 0 }, { id: 'B', n: 20, data: 20, pass: 18 }, { id: 'C', n: 20, data: 20, pass: 18 }]);
    return eq(M.causeAnalysis(D, 'CO', cfg, NOW).classLabel.get('X|LO1').label, 'INSUFFICIENT');
  });
  test('Evidence TB < 3 câu/học sinh → "Chưa đủ dữ liệu để kết luận"', function () {
    const D = causeD([{ id: 'X', n: 20, data: 20, pass: 0, ev: 2 }, { id: 'B', n: 20, data: 20, pass: 18 }, { id: 'C', n: 20, data: 20, pass: 18 }]);
    return eq(M.causeAnalysis(D, 'CO', cfg, NOW).classLabel.get('X|LO1').label, 'INSUFFICIENT');
  });

  // =================================================================== 7. Chống trùng & gộp
  section = 'Cảnh báo — chống trùng 7 ngày & gộp';
  const cand = { key: 'R|STUDENT|s1', detectedAt: NOW };
  test('Cảnh báo cũ chưa xử lý, phát hiện lại sau 3 ngày → không sinh mới', function () {
    const r = A.dedupe([cand], { 'R|STUDENT|s1': { status: 'IN_PROGRESS', detectedAt: NOW - 3 * DAY } }, 7);
    eq(r.suppressed, 1); eq(r.alerts[0].status, 'IN_PROGRESS'); return eq(r.alerts[0].detectedAt, NOW - 3 * DAY);
  });
  test('Cảnh báo cũ chưa xử lý quá 7 ngày → sinh lần mới', function () {
    const r = A.dedupe([cand], { 'R|STUDENT|s1': { status: 'NEW', detectedAt: NOW - 8 * DAY } }, 7);
    eq(r.suppressed, 0); return eq(r.alerts[0].reRaised, true);
  });
  test('Đã xử lý, điều kiện phát hiện trước lúc xử lý → giữ "Đã xử lý"', function () {
    const r = A.dedupe([cand], { 'R|STUDENT|s1': { status: 'RESOLVED', detectedAt: NOW - DAY, handledAtSim: NOW } }, 7);
    return eq(r.alerts[0].status, 'RESOLVED');
  });
  test('Đã xử lý, điều kiện xuất hiện lại sau đó → cảnh báo mới', function () {
    const r = A.dedupe([{ key: cand.key, detectedAt: NOW + DAY }], { 'R|STUDENT|s1': { status: 'RESOLVED', detectedAt: NOW - DAY, handledAtSim: NOW } }, 7);
    return eq(r.alerts[0].status, 'NEW');
  });
  function fakeCands(n, cls) {
    const a = [];
    for (let i = 0; i < n; i++) a.push({ scope: 'STUDENT', entityIds: ['s' + i], studentId: 's' + i, classId: cls, reason: 'r' + i, detectedAt: NOW, value: i });
    return a;
  }
  const gctx = { cfg: cfg, cls: function (x) { return x; } };
  test('5 học sinh cùng lớp cùng rule → 1 cảnh báo cấp lớp kèm danh sách', function () {
    const r = A.groupStudents(gctx, { id: 'ATT-S01', name: 'x', group: 'ATT' }, fakeCands(5, 'C1'));
    eq(r.length, 1); eq(r[0].scope, 'CLASS'); return eq(r[0].children.length, 5);
  });
  test('4 học sinh → giữ 4 cảnh báo cấp học sinh', function () {
    return eq(A.groupStudents(gctx, { id: 'ATT-S01', name: 'x', group: 'ATT' }, fakeCands(4, 'C1')).length, 4);
  });

  // =================================================================== 8. Tích hợp với mock mặc định
  section = 'Tích hợp — mock mặc định';
  test('Mọi rule mục 5 kích hoạt ≥ 1 lần với seed mặc định', function () {
    const D = GT.data.load();
    const res = A.run(D, cfg);
    const zero = A.RULES.filter(function (r) { return !res.stats[r.id].count; }).map(function (r) { return r.id; });
    if (zero.length) throw new Error('Rule chưa kích hoạt: ' + zero.join(', '));
    return 'Tổng ' + res.alerts.length + ' cảnh báo, ' + A.RULES.length + ' rule';
  });
  test('Mọi kịch bản K01–K30 khớp rule kỳ vọng', function () {
    const D = GT.data.load();
    const rows = A.scenarioReport(D, A.run(D, cfg).alerts);
    const bad = rows.filter(function (r) { return r['Kết quả'] === '✕'; });
    if (bad.length) throw new Error(bad.map(function (r) { return r['Kịch bản'] + ' ' + r.Rule; }).join('; '));
    return rows.length + ' dòng đối chiếu';
  });
  test('~10% học sinh học 2 lớp; có học sinh chuyển lớp; có trùng họ tên', function () {
    const D = GT.data.load();
    const multi = Array.from(D.idx.enrollByStudent.values()).filter(function (e) { return new Set(e.map(function (x) { return x.classId; })).size >= 2; }).length;
    const share = multi / D.students.length;
    ok(share > 0.08 && share < 0.13, 'tỉ lệ học 2 lớp ' + share);
    ok(D.enrollments.some(function (e) { return e.endAt; }), 'có ghi danh kết thúc (chuyển lớp)');
    const names = new Map();
    D.students.forEach(function (s) { names.set(s.fullName, (names.get(s.fullName) || 0) + 1); });
    ok(Array.from(names.values()).some(function (v) { return v >= 2; }), 'có trùng họ tên');
    return F.pct(share) + ' học sinh học ≥ 2 lớp';
  });
  test('Không chỉ số chính nào trả NaN/Infinity', function () {
    const D = GT.data.load();
    const now = D.meta.now;
    const km = M.keyMetrics(D, {}, now - 30 * DAY, now + 1, cfg);
    Object.keys(km).forEach(function (k) { const v = km[k].value; ok(v === null || isFinite(v), k + ' = ' + v); });
    return true;
  });
  test('Hiệu năng: sinh dữ liệu + index < 600 ms', function () {
    const D = GT.data.load();
    const t = D.timing.generate + D.timing.index;
    ok(t < 600, 'mất ' + t.toFixed(0) + ' ms');
    return 'sinh ' + D.timing.generate.toFixed(0) + ' ms + index ' + D.timing.index.toFixed(0) + ' ms';
  });

  GT.testResults = results;

  // ------------------------------------------------------------------ Hiển thị
  function render() {
    const pass = results.filter(function (r) { return r.ok; }).length;
    const el = document.getElementById('results');
    const sum = document.getElementById('summary');
    sum.innerHTML = '<strong>' + pass + '/' + results.length + '</strong> kiểm thử đạt' + (pass === results.length ? ' ✓' : ' — có lỗi ✕');
    sum.className = 'summary ' + (pass === results.length ? 'ok' : 'fail');
    let html = '', cur = null;
    results.forEach(function (r) {
      if (r.section !== cur) { if (cur !== null) html += '</tbody></table>'; cur = r.section; html += '<h2>' + GT.util.escapeHtml(cur) + '</h2><table><tbody>'; }
      html += '<tr class="' + (r.ok ? 'ok' : 'fail') + '"><td class="st">' + (r.ok ? '✓ Đạt' : '✕ Lỗi') + '</td><td>' + GT.util.escapeHtml(r.name) +
        (r.msg ? '<div class="msg">' + GT.util.escapeHtml(r.msg) + '</div>' : '') + '</td></tr>';
    });
    html += '</tbody></table>';
    el.innerHTML = html;
    results.filter(function (r) { return !r.ok; }).forEach(function (r) { console.warn('[tests] ✕ ' + r.section + ' — ' + r.name + ': ' + r.msg); });
    if (GT.debug) A.debugPrint(GT.data.load(), GT.config.get());
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render); else render();
})(window.GT);
