/**
 * GenieTeach — Báo cáo Học vụ (prototype)
 * metrics.js — ĐỊNH NGHĨA DUY NHẤT của mọi chỉ số (xem docs/METRICS.md).
 *
 * Nguyên tắc:
 *  - Pure function: (D, scope, from, to, cfg) → số liệu. Không đụng DOM, không đọc localStorage.
 *  - scope = { classIds?, groupIds?, courseIds?, teacherIds?, studentIds? } — danh sách id bất kỳ,
 *    dùng chung được cho mọi vai trò (Học vụ, Giáo viên…).
 *  - Khoảng thời gian [from, to): from tính, to không tính (ms, giờ tường VN mã hóa UTC).
 *  - Cấp nhóm lớp / toàn trường: CỘNG GỘP tử và mẫu (weighted), không lấy trung bình các tỉ lệ lớp.
 *  - Tỉ lệ trả về dạng 0–1, null khi mẫu số = 0 (UI hiển thị "–").
 *  - Kết quả nặng được cache theo khóa (tên + scope chuẩn hóa + khoảng + phiên bản cấu hình).
 */
window.GT = window.GT || {};
(function (GT) {
  'use strict';
  const U = GT.util;
  const DT = GT.date;
  const S = GT.stats;
  const ratio = S.ratio;
  const M = GT.metrics = {};

  let uid = 0;
  function did(D) { if (!D.__uid) D.__uid = ++uid; return D.__uid; }
  function memo(name, D, args, cfg, fn) {
    const key = name + '#' + did(D) + '#' + JSON.stringify(args) + '#' + (cfg && cfg.__version ? cfg.__version : '');
    return GT.memo.get(key, fn);
  }
  M._memo = memo;

  // =====================================================================================
  // Phạm vi (scope)
  // =====================================================================================
  /**
   * Chuẩn hóa scope. classIds ưu tiên; nếu chỉ có groupIds → mọi lớp thuộc nhóm; nếu cả hai → giao.
   * @returns {{classIds:string[], allClasses:boolean, courseIds:?string[], teacherIds:?string[], studentIds:?string[]}}
   */
  M.scope = function (D, s) {
    s = s || {};
    let classIds = null;
    if (s.groupIds && s.groupIds.length) {
      classIds = [];
      s.groupIds.forEach(function (g) { (D.idx.classesByGroup.get(g) || []).forEach(function (c) { classIds.push(c.id); }); });
    }
    if (s.classIds && s.classIds.length) {
      classIds = classIds ? s.classIds.filter(function (c) { return classIds.indexOf(c) >= 0; }) : s.classIds.slice();
    }
    const all = !classIds;
    if (!classIds) classIds = D.classes.map(function (c) { return c.id; });
    const norm = function (a) { return a && a.length ? a.slice().sort() : null; };
    return { classIds: classIds.slice().sort(), allClasses: all, courseIds: norm(s.courseIds), teacherIds: norm(s.teacherIds), studentIds: norm(s.studentIds) };
  };

  /** Học sinh có ghi danh hiệu lực tại thời điểm t (sĩ số tại mốc — OQ-17). */
  M.roster = function (D, classId, t) {
    const arr = D.idx.enrollByClass.get(classId) || [];
    const out = [];
    for (let i = 0; i < arr.length; i++) {
      const e = arr[i];
      if (e.startAt <= t && (e.endAt === null || e.endAt === undefined || t <= e.endAt)) out.push(e.studentId);
    }
    return out;
  };

  /** Các lớp học sinh đang ghi danh tại t. */
  M.studentClasses = function (D, studentId, t) {
    return (D.idx.enrollByStudent.get(studentId) || []).filter(function (e) {
      return e.startAt <= t && (e.endAt === null || e.endAt === undefined || t <= e.endAt);
    }).map(function (e) { return e.classId; });
  };

  /** M-OPS-00 — Lớp đang hoạt động tại t: có ≥ 1 ClassCourse với startAt ≤ t ≤ endAt. */
  M.isClassActive = function (D, classId, t) {
    return (D.idx.classCoursesByClass.get(classId) || []).some(function (cc) { return cc.startAt <= t && t <= cc.endAt; });
  };
  M.activeClassIds = function (D, scope, t) {
    const sc = M.scope(D, scope);
    return sc.classIds.filter(function (c) {
      if (!M.isClassActive(D, c, t)) return false;
      if (!sc.courseIds) return true;
      return M.activeClassCourses(D, c, t).some(function (cc) { return sc.courseIds.indexOf(cc.courseId) >= 0; });
    });
  };
  M.activeClassCourses = function (D, classId, t) {
    return (D.idx.classCoursesByClass.get(classId) || []).filter(function (cc) { return cc.startAt <= t && t <= cc.endAt; });
  };

  // =====================================================================================
  // Buổi học & vận hành (OPS)
  // =====================================================================================
  /** Buổi học có Session.start ∈ [from, to) thuộc scope (lớp, khóa, giáo viên). Sort theo start. */
  M.sessionsIn = function (D, scope, from, to) {
    const sc = M.scope(D, scope);
    const cs = sc.courseIds ? new Set(sc.courseIds) : null;
    const ts = sc.teacherIds ? new Set(sc.teacherIds) : null;
    const out = [];
    sc.classIds.forEach(function (cid) {
      const arr = D.idx.sessionsByClass.get(cid) || [];
      for (let i = U.lowerBound(arr, from, function (s) { return s.start; }); i < arr.length && arr[i].start < to; i++) {
        const s = arr[i];
        if (cs && !cs.has(s.courseId)) continue;
        if (ts && !ts.has(s.teacherId)) continue;
        out.push(s);
      }
    });
    out.sort(function (a, b) { return a.start - b.start; });
    return out;
  };

  /** M-OPS-02 — Trạng thái thời gian: UPCOMING | ONGOING | DONE. */
  M.sessionTimeState = function (s, now) {
    if (s.start > now) return 'UPCOMING';
    if (s.end > now) return 'ONGOING';
    return 'DONE';
  };

  /** M-OPS-05 — Phân loại buổi: UPCOMING | BOTH | ATT_ONLY | REP_ONLY | NONE. */
  M.sessionCategory = function (s, now) {
    if (s.start > now) return 'UPCOMING';
    const a = s.attendanceSubmittedAt !== null && s.attendanceSubmittedAt !== undefined;
    const r = s.reportSubmittedAt !== null && s.reportSubmittedAt !== undefined;
    if (a && r) return 'BOTH';
    if (a) return 'ATT_ONLY';
    if (r) return 'REP_ONLY';
    return 'NONE';
  };
  M.SESSION_CATEGORIES = ['BOTH', 'ATT_ONLY', 'REP_ONLY', 'NONE', 'UPCOMING'];

  /** M-OPS-07 — Bucket độ trễ báo cáo của một buổi đã kết thúc. */
  M.reportLatencyBucket = function (s) {
    if (s.reportSubmittedAt === null || s.reportSubmittedAt === undefined) return 'NONE';
    const d = s.reportSubmittedAt - s.end;
    if (d < 2 * DT.HOUR) return 'LT2H';
    if (d < DT.DAY) return 'H2_24';
    if (d < 3 * DT.DAY) return 'D1_3';
    return 'GT3D';
  };
  M.LATENCY_BUCKETS = ['LT2H', 'H2_24', 'D1_3', 'GT3D', 'NONE'];

  /**
   * Chỉ số vận hành của tập buổi học.
   *  - M-OPS-01 total = số buổi có start trong kỳ (gồm cả chưa diễn ra)
   *  - M-OPS-03 takenRate = buổi đã bắt đầu có attendanceSubmittedAt / buổi đã bắt đầu
   *  - M-OPS-04 reportedRate = buổi đã kết thúc có reportSubmittedAt / buổi đã kết thúc
   *  - M-OPS-06 attOnTimeRate = buổi có attendanceSubmittedAt ≤ start + grace / buổi đã bắt đầu ≥ grace
   *  - M-OPS-08 report24Rate = buổi báo cáo trong 24h / buổi đã kết thúc ≥ 24h
   */
  M.opsSummary = function (sessions, now, cfg) {
    const grace = cfg.ops.attendanceGraceMin * DT.MIN;
    const repH = cfg.ops.reportOnTimeHours * DT.HOUR;
    const c = { total: 0, upcoming: 0, ongoing: 0, started: 0, taken: 0, ended: 0, reported: 0, attOnTime: 0, attOnTimeDenom: 0, rep24: 0, rep24Denom: 0, cat: {}, latency: {} };
    M.SESSION_CATEGORIES.forEach(function (k) { c.cat[k] = 0; });
    M.LATENCY_BUCKETS.forEach(function (k) { c.latency[k] = 0; });
    sessions.forEach(function (s) {
      c.total++;
      c.cat[M.sessionCategory(s, now)]++;
      if (s.start > now) { c.upcoming++; return; }
      c.started++;
      if (s.end > now) c.ongoing++;
      const att = s.attendanceSubmittedAt !== null && s.attendanceSubmittedAt !== undefined;
      if (att) c.taken++;
      if (s.start + grace <= now) {
        c.attOnTimeDenom++;
        if (att && s.attendanceSubmittedAt <= s.start + grace) c.attOnTime++;
      }
      if (s.end <= now) {
        c.ended++;
        if (s.reportSubmittedAt !== null && s.reportSubmittedAt !== undefined) c.reported++;
        c.latency[M.reportLatencyBucket(s)]++;
        if (s.end + repH <= now) {
          c.rep24Denom++;
          if (s.reportSubmittedAt !== null && s.reportSubmittedAt !== undefined && s.reportSubmittedAt <= s.end + repH) c.rep24++;
        }
      }
    });
    c.takenRate = ratio(c.taken, c.started);
    c.reportedRate = ratio(c.reported, c.ended);
    c.attOnTimeRate = ratio(c.attOnTime, c.attOnTimeDenom);
    c.report24Rate = ratio(c.rep24, c.rep24Denom);
    return c;
  };
  M.opsCounts = function (D, scope, from, to, cfg) {
    return memo('ops', D, [M.scope(D, scope), from, to], cfg, function () {
      return M.opsSummary(M.sessionsIn(D, scope, from, to), D.meta.now, cfg);
    });
  };

  // =====================================================================================
  // Chuyên cần (ATT)
  // =====================================================================================
  M.ATT_STATUSES = ['ON_TIME', 'LATE', 'EXCUSED', 'UNEXCUSED', 'NOT_TAKEN'];
  function emptyAtt() { return { ON_TIME: 0, LATE: 0, EXCUSED: 0, UNEXCUSED: 0, NOT_TAKEN: 0 }; }
  function finalizeAtt(c, nStudents) {
    c.taken = c.ON_TIME + c.LATE + c.EXCUSED + c.UNEXCUSED;   // M-ATT-02 mẫu số chuyên cần
    c.total = c.taken + c.NOT_TAKEN;
    c.studentsWithData = nStudents;
    return c;
  }
  M.emptyAttendance = function () { return finalizeAtt(emptyAtt(), 0); };

  /**
   * M-ATT-01 — Đếm bản ghi điểm danh theo trạng thái, của các buổi có start ∈ [from, to).
   * Nếu scope.studentIds: chỉ bản ghi của các học sinh đó (cấp học sinh — gộp mọi lớp trừ khi scope giới hạn lớp).
   * @returns {{ON_TIME,LATE,EXCUSED,UNEXCUSED,NOT_TAKEN,taken,total,studentsWithData}}
   */
  M.attendanceCounts = function (D, scope, from, to) {
    const sc = M.scope(D, scope);
    return memo('attC', D, [sc, from, to], null, function () {
      const c = emptyAtt();
      const stu = new Set();
      if (sc.studentIds) {
        const cls = sc.allClasses ? null : new Set(sc.classIds);
        const crs = sc.courseIds ? new Set(sc.courseIds) : null;
        sc.studentIds.forEach(function (sid) {
          const arr = D.idx.attByStudent.get(sid) || [];
          for (let i = U.lowerBound(arr, from, function (r) { return r._start; }); i < arr.length && arr[i]._start < to; i++) {
            const r = arr[i];
            if (cls && !cls.has(r._classId)) continue;
            if (crs && !crs.has(r._courseId)) continue;
            c[r.status]++;
            if (r.status !== 'NOT_TAKEN') stu.add(sid);
          }
        });
      } else {
        M.sessionsIn(D, sc, from, to).forEach(function (s) {
          (D.idx.attBySession.get(s.id) || []).forEach(function (r) {
            c[r.status]++;
            if (r.status !== 'NOT_TAKEN') stu.add(r.studentId);
          });
        });
      }
      return finalizeAtt(c, stu.size);
    });
  };

  /**
   * M-ATT-03…08 — Tỉ lệ từ bộ đếm.
   *  onTime = ON_TIME / taken · late = LATE / taken · excused = EXCUSED / taken · unexcused = UNEXCUSED / taken
   *  present = (ON_TIME + LATE) / taken · notTaken = NOT_TAKEN / total (gồm NOT_TAKEN)
   */
  M.attendanceRates = function (c) {
    return {
      onTime: ratio(c.ON_TIME, c.taken),
      late: ratio(c.LATE, c.taken),
      excused: ratio(c.EXCUSED, c.taken),
      unexcused: ratio(c.UNEXCUSED, c.taken),
      present: ratio(c.ON_TIME + c.LATE, c.taken),
      absent: ratio(c.EXCUSED + c.UNEXCUSED, c.taken),
      notTaken: ratio(c.NOT_TAKEN, c.total)
    };
  };
  M.addAttendance = function (a, b) {
    const c = emptyAtt();
    M.ATT_STATUSES.forEach(function (k) { c[k] = a[k] + b[k]; });
    return finalizeAtt(c, (a.studentsWithData || 0) + (b.studentsWithData || 0));
  };

  /** Bộ đếm chuyên cần theo ngày (dayKey) — dùng cho stacked bar lịch sử, calendar heatmap. */
  M.attendanceByDay = function (D, scope, from, to) {
    const sc = M.scope(D, scope);
    return memo('attDay', D, [sc, from, to], null, function () {
      const m = new Map();
      M.sessionsIn(D, sc, from, to).forEach(function (s) {
        const k = DT.dayKey(s.start);
        let c = m.get(k);
        if (!c) { c = emptyAtt(); m.set(k, c); }
        (D.idx.attBySession.get(s.id) || []).forEach(function (r) { c[r.status]++; });
      });
      m.forEach(function (c) { finalizeAtt(c, 0); });
      return m;
    });
  };

  /** Bộ đếm chuyên cần theo lớp. */
  M.attendanceByClass = function (D, scope, from, to) {
    const sc = M.scope(D, scope);
    const out = new Map();
    sc.classIds.forEach(function (cid) {
      out.set(cid, M.attendanceCounts(D, { classIds: [cid], courseIds: sc.courseIds, teacherIds: sc.teacherIds }, from, to));
    });
    return out;
  };

  /**
   * M-ATT-09/10 — Tổng hợp theo học sinh: số buổi theo trạng thái, các lớp, chuỗi vắng không phép dài nhất.
   * Thứ tự buổi theo Session.start (gộp các lớp trong scope). NOT_TAKEN bỏ qua; trạng thái khác cắt chuỗi.
   * @returns {Map<studentId, {ON_TIME,LATE,EXCUSED,UNEXCUSED,NOT_TAKEN,taken,classes:Set,longestUnexcused,records:Array}>}
   */
  M.attendanceByStudent = function (D, scope, from, to) {
    const sc = M.scope(D, scope);
    return memo('attStu', D, [sc, from, to], null, function () {
      const m = new Map();
      M.sessionsIn(D, sc, from, to).forEach(function (s) {
        (D.idx.attBySession.get(s.id) || []).forEach(function (r) {
          if (sc.studentIds && sc.studentIds.indexOf(r.studentId) < 0) return;
          let g = m.get(r.studentId);
          if (!g) { g = emptyAtt(); g.classes = new Set(); g.records = []; g.cur = 0; g.longestUnexcused = 0; m.set(r.studentId, g); }
          g[r.status]++;
          g.classes.add(s.classId);
          g.records.push(r);
          if (r.status === 'UNEXCUSED') { g.cur++; if (g.cur > g.longestUnexcused) g.longestUnexcused = g.cur; }
          else if (r.status !== 'NOT_TAKEN') g.cur = 0;
        });
      });
      m.forEach(function (g) { finalizeAtt(g, 1); delete g.cur; });
      return m;
    });
  };

  /** Chuỗi vắng không phép dài nhất trong một dãy bản ghi đã sort theo thời gian. */
  M.longestUnexcusedStreak = function (records) {
    let cur = 0, best = 0;
    records.forEach(function (r) {
      if (r.status === 'UNEXCUSED') { cur++; if (cur > best) best = cur; }
      else if (r.status !== 'NOT_TAKEN') cur = 0;
    });
    return best;
  };

  /** M-ATT-11 — Phân bố học sinh (có dữ liệu) theo số buổi vắng không phép: 0,1,2,3,4,5+. */
  M.absenceHistogram = function (byStudent) {
    const h = [0, 0, 0, 0, 0, 0];
    byStudent.forEach(function (g) {
      if (!g.taken) return;
      h[Math.min(5, g.UNEXCUSED)]++;
    });
    return h;
  };

  /** M-ATT-12 — Ma trận thứ (0=T2…6=CN) × ca (1…6): bộ đếm chuyên cần. */
  M.weekdaySlotMatrix = function (D, scope, from, to) {
    const sc = M.scope(D, scope);
    return memo('attWS', D, [sc, from, to], null, function () {
      const grid = [];
      for (let w = 0; w < 7; w++) { grid.push([]); for (let k = 0; k <= 6; k++) grid[w].push(emptyAtt()); }
      M.sessionsIn(D, sc, from, to).forEach(function (s) {
        const c = grid[DT.weekday(s.start)][s.slot || 0];
        (D.idx.attBySession.get(s.id) || []).forEach(function (r) { c[r.status]++; });
      });
      grid.forEach(function (row) { row.forEach(function (c) { finalizeAtt(c, 0); }); });
      return grid;
    });
  };

  // =====================================================================================
  // Nhiệm vụ (HW)
  // =====================================================================================
  /**
   * M-HW-01 — Trạng thái học sinh–nhiệm vụ tại thời điểm now.
   *  OPEN nếu dueAt > now (kể cả đã nộp sớm — OQ-19);
   *  ON_TIME nếu submittedAt ≤ dueAt; LATE nếu nộp sau hạn; MISSING nếu quá hạn chưa nộp.
   *  partial = nộp với completedItems < itemCount ("Nộp chưa đủ").
   */
  M.taskStatus = function (task, sub, now) {
    if (task.dueAt > now) return { status: 'OPEN', submitted: !!sub, partial: false };
    if (!sub) return { status: 'MISSING', submitted: false, partial: false };
    return { status: sub.submittedAt <= task.dueAt ? 'ON_TIME' : 'LATE', submitted: true, partial: sub.completedItems < task.itemCount };
  };

  /** M-HW-07 — Điểm chuẩn hóa thang 10 (null nếu chưa chấm). */
  M.normScore = function (task, sub) {
    if (!sub || sub.score === null || sub.score === undefined || !task.maxScore) return null;
    return sub.score / task.maxScore * 10;
  };

  /** Nhiệm vụ có dueAt ∈ [from, to) thuộc scope (lớp, khóa; giáo viên = GV của buổi giao). */
  M.tasksIn = function (D, scope, from, to) {
    const sc = M.scope(D, scope);
    const cs = sc.courseIds ? new Set(sc.courseIds) : null;
    const ts = sc.teacherIds ? new Set(sc.teacherIds) : null;
    const out = [];
    sc.classIds.forEach(function (cid) {
      const arr = D.idx.tasksByClass.get(cid) || [];
      for (let i = U.lowerBound(arr, from, function (t) { return t.dueAt; }); i < arr.length && arr[i].dueAt < to; i++) {
        const t = arr[i];
        if (cs && !cs.has(t.courseId)) continue;
        if (ts) { const s = D.sessionById.get(t.sessionId); if (!s || !ts.has(s.teacherId)) continue; }
        out.push(t);
      }
    });
    out.sort(function (a, b) { return a.dueAt - b.dueAt; });
    return out;
  };

  function emptyTask() {
    return { ON_TIME: 0, LATE: 0, MISSING: 0, OPEN: 0, OPEN_SUBMITTED: 0, PARTIAL: 0, FULL: 0, graded: 0, scoreSum: 0, tasks: 0, overdueTasks: 0, openTasks: 0 };
  }
  function finalizeTask(c, nStudents) {
    c.overdue = c.ON_TIME + c.LATE + c.MISSING;
    c.studentsWithData = nStudents;
    return c;
  }
  M.emptyTaskCounts = function () { return finalizeTask(emptyTask(), 0); };

  /** Duyệt từng cặp (nhiệm vụ, học sinh được giao) — học sinh có ghi danh hiệu lực tại assignedAt (OQ-18). */
  M.forEachTaskStudent = function (D, task, studentFilter, fn) {
    const roster = M.roster(D, task.classId, task.assignedAt);
    const subs = D.idx.subsByTask.get(task.id);
    for (let i = 0; i < roster.length; i++) {
      const sid = roster[i];
      if (studentFilter && !studentFilter.has(sid)) continue;
      fn(sid, subs ? subs.get(sid) : undefined);
    }
  };

  /**
   * M-HW-02…07 — Bộ đếm nhiệm vụ của các nhiệm vụ có dueAt trong kỳ.
   * overdue = ON_TIME + LATE + MISSING (mẫu số tỉ lệ; OPEN hiển thị riêng).
   * PARTIAL ⊂ ON_TIME ∪ LATE (nộp chưa đủ). FULL = nộp đủ số bài (ON_TIME ∪ LATE).
   * graded/scoreSum: mọi bài đã có điểm (thang 10).
   */
  M.taskCounts = function (D, scope, from, to) {
    const sc = M.scope(D, scope);
    return memo('taskC', D, [sc, from, to], null, function () {
      const now = D.meta.now;
      const c = emptyTask();
      const stu = new Set();
      const sf = sc.studentIds ? new Set(sc.studentIds) : null;
      M.tasksIn(D, sc, from, to).forEach(function (task) {
        c.tasks++;
        if (task.dueAt > now) c.openTasks++; else c.overdueTasks++;
        M.forEachTaskStudent(D, task, sf, function (sid, sub) {
          const st = M.taskStatus(task, sub, now);
          c[st.status]++;
          if (st.status === 'OPEN' && st.submitted) c.OPEN_SUBMITTED++;
          if (st.status === 'ON_TIME' || st.status === 'LATE') {
            if (st.partial) c.PARTIAL++; else c.FULL++;
          }
          if (st.status !== 'OPEN') stu.add(sid);
          const sc10 = M.normScore(task, sub);
          if (sc10 !== null) { c.graded++; c.scoreSum += sc10; }
        });
      });
      return finalizeTask(c, stu.size);
    });
  };

  /** Tỉ lệ nhiệm vụ: onTime/late/missing/submitted/partial trên overdue; avgScore = scoreSum / graded. */
  M.taskRates = function (c) {
    return {
      onTime: ratio(c.ON_TIME, c.overdue),
      late: ratio(c.LATE, c.overdue),
      missing: ratio(c.MISSING, c.overdue),
      submitted: ratio(c.ON_TIME + c.LATE, c.overdue),
      partial: ratio(c.PARTIAL, c.overdue),
      full: ratio(c.FULL, c.overdue),
      avgScore: ratio(c.scoreSum, c.graded)
    };
  };

  /** M-HW-08 — Danh sách điểm (thang 10) của các bài đã chấm. */
  M.taskScores = function (D, scope, from, to) {
    const sc = M.scope(D, scope);
    return memo('taskS', D, [sc, from, to], null, function () {
      const out = [];
      const sf = sc.studentIds ? new Set(sc.studentIds) : null;
      M.tasksIn(D, sc, from, to).forEach(function (task) {
        const subs = D.idx.subsByTask.get(task.id);
        if (!subs) return;
        subs.forEach(function (sub, sid) {
          if (sf && !sf.has(sid)) return;
          const v = M.normScore(task, sub);
          if (v !== null) out.push(v);
        });
      });
      return out;
    });
  };

  /** M-HW-09 — Thời điểm nộp so với hạn (nhiệm vụ đã quá hạn): GT72 · H24_72 · H6_24 · LT6 · LATE. */
  M.TIMING_BUCKETS = ['GT72', 'H24_72', 'H6_24', 'LT6', 'LATE'];
  M.submissionTiming = function (D, scope, from, to) {
    const sc = M.scope(D, scope);
    return memo('taskT', D, [sc, from, to], null, function () {
      const now = D.meta.now;
      const b = { GT72: 0, H24_72: 0, H6_24: 0, LT6: 0, LATE: 0, total: 0 };
      M.tasksIn(D, sc, from, to).forEach(function (task) {
        if (task.dueAt > now) return;
        const subs = D.idx.subsByTask.get(task.id);
        if (!subs) return;
        subs.forEach(function (sub) {
          const d = task.dueAt - sub.submittedAt;
          b.total++;
          if (d < 0) b.LATE++;
          else if (d > 72 * DT.HOUR) b.GT72++;
          else if (d > 24 * DT.HOUR) b.H24_72++;
          else if (d > 6 * DT.HOUR) b.H6_24++;
          else b.LT6++;
        });
      });
      return b;
    });
  };

  /** Thống kê từng nhiệm vụ: được giao, đúng hạn, muộn, không hoàn thành, tỉ lệ nộp, điểm TB, chưa chấm. */
  M.taskStats = function (D, task) {
    const now = D.meta.now;
    const r = { task: task, expected: 0, ON_TIME: 0, LATE: 0, MISSING: 0, OPEN: 0, submittedCount: 0, graded: 0, scoreSum: 0, ungraded: 0 };
    M.forEachTaskStudent(D, task, null, function (sid, sub) {
      r.expected++;
      const st = M.taskStatus(task, sub, now);
      r[st.status]++;
      if (sub) {
        r.submittedCount++;
        const v = M.normScore(task, sub);
        if (v !== null) { r.graded++; r.scoreSum += v; } else r.ungraded++;
      }
    });
    r.overdue = r.ON_TIME + r.LATE + r.MISSING;
    r.submitRate = ratio(r.ON_TIME + r.LATE, r.overdue);
    r.avgScore = ratio(r.scoreSum, r.graded);
    return r;
  };

  /**
   * M-HW-10 — Nhiệm vụ bất thường: so với trung vị các nhiệm vụ đã quá hạn CÙNG KHÓA (toàn kỳ học tới nay),
   * tỉ lệ nộp thấp hơn ≥ anomalyRateGapPts điểm % hoặc điểm TB thấp hơn ≥ anomalyScoreGap điểm (OQ-44).
   */
  M.taskAnomalies = function (D, scope, from, to, cfg) {
    const sc = M.scope(D, scope);
    return memo('taskA', D, [sc, from, to], cfg, function () {
      const now = D.meta.now;
      const baseline = {};
      const courseIds = sc.courseIds || D.courses.map(function (c) { return c.id; });
      courseIds.forEach(function (cid) {
        const rates = [], scores = [];
        (D.idx.tasksByCourse.get(cid) || []).forEach(function (t) {
          if (t.dueAt > now) return;
          const st = M.taskStats(D, t);
          if (st.submitRate !== null) rates.push(st.submitRate);
          if (st.avgScore !== null) scores.push(st.avgScore);
        });
        baseline[cid] = { rate: S.median(rates), score: S.median(scores), n: rates.length };
      });
      const out = [];
      M.tasksIn(D, sc, from, to).forEach(function (t) {
        if (t.dueAt > now) return;
        const st = M.taskStats(D, t);
        const b = baseline[t.courseId];
        if (!b || st.expected < 5) return;
        const rateGap = st.submitRate !== null && b.rate !== null ? b.rate - st.submitRate : null;
        const scoreGap = st.avgScore !== null && b.score !== null ? b.score - st.avgScore : null;
        const flagRate = rateGap !== null && U.gte(rateGap * 100, cfg.homework.anomalyRateGapPts);
        const flagScore = scoreGap !== null && U.gte(scoreGap, cfg.homework.anomalyScoreGap);
        if (flagRate || flagScore) out.push({ stats: st, baseline: b, rateGap: rateGap, scoreGap: scoreGap, flagRate: flagRate, flagScore: flagScore });
      });
      return out;
    });
  };

  /** Tổng hợp nhiệm vụ theo học sinh: đúng hạn, muộn, không hoàn thành, nộp đủ, điểm. */
  M.taskByStudent = function (D, scope, from, to) {
    const sc = M.scope(D, scope);
    return memo('taskStu', D, [sc, from, to], null, function () {
      const now = D.meta.now;
      const m = new Map();
      const sf = sc.studentIds ? new Set(sc.studentIds) : null;
      M.tasksIn(D, sc, from, to).forEach(function (task) {
        M.forEachTaskStudent(D, task, sf, function (sid, sub) {
          let g = m.get(sid);
          if (!g) { g = emptyTask(); g.classes = new Set(); g.items = []; m.set(sid, g); }
          const st = M.taskStatus(task, sub, now);
          g[st.status]++;
          g.classes.add(task.classId);
          if (st.status === 'ON_TIME' || st.status === 'LATE') { if (st.partial) g.PARTIAL++; else g.FULL++; }
          const v = M.normScore(task, sub);
          if (v !== null) { g.graded++; g.scoreSum += v; }
          g.items.push({ task: task, sub: sub, status: st.status, score: v });
        });
      });
      m.forEach(function (g) { finalizeTask(g, 1); });
      return m;
    });
  };

  // =====================================================================================
  // Khóa trực tuyến (ONL)
  // =====================================================================================
  /** Tham số khóa: entity Course ⊕ ghi đè cấu hình cấp trường. */
  M.courseParams = function (D, courseId, cfg) {
    const c = D.courseById.get(courseId) || {};
    const o = (cfg.courses && cfg.courses[courseId]) || {};
    return {
      passThreshold: o.passThreshold !== undefined ? o.passThreshold : (c.passThreshold !== undefined ? c.passThreshold : 50),
      wTask: o.weightTaskCompletion !== undefined ? o.weightTaskCompletion : (c.weightTaskCompletion !== undefined ? c.weightTaskCompletion : 0.3),
      wTest: o.weightTestScore !== undefined ? o.weightTestScore : (c.weightTestScore !== undefined ? c.weightTestScore : 0.7)
    };
  };

  /** Số mục đã hoàn thành tại t (dùng log itemCompletedAt nếu có — OQ-21). */
  M.completedItemsAt = function (prog, t) {
    if (prog.itemCompletedAt) {
      let n = 0;
      for (let i = 0; i < prog.itemCompletedAt.length; i++) if (prog.itemCompletedAt[i] <= t) n++;
      return n;
    }
    return prog.completedItems;
  };
  /** M-ONL-01 — Tiến độ = completedItems(tại t) / totalItems. */
  M.progressAt = function (prog, t) { return ratio(M.completedItemsAt(prog, t), prog.totalItems); };
  /** M-ONL-02 — Tiến độ kỳ vọng = clamp((t − startAt) / (dueAt − startAt), 0, 1). */
  M.expectedProgress = function (a, t) {
    const d = a.dueAt - a.startAt;
    return d > 0 ? U.clamp((t - a.startAt) / d, 0, 1) : 1;
  };
  /** M-ONL-04 — Trạng thái 4 mức theo completedAt so với dueAt (tại now). */
  M.onlineStatus = function (a, prog, now) {
    if (a.dueAt > now) return 'OPEN';
    if (prog.completedAt !== null && prog.completedAt !== undefined && prog.completedAt <= now) {
      return prog.completedAt <= a.dueAt ? 'ON_TIME' : 'LATE';
    }
    return 'MISSING';
  };
  /**
   * M-ONL-06 — Điểm tổng hợp (0–100) = wTask × tỉ lệ hoàn thành bài tập (%) + wTest × testScore.
   * testScore null → tính như 0 (chưa làm kiểm tra); hasTest cho biết có điểm kiểm tra hay chưa.
   */
  M.compositeScore = function (prog, params, t) {
    const comp = (M.progressAt(prog, t === undefined ? Infinity : t) || 0) * 100;
    const hasTest = prog.testScore !== null && prog.testScore !== undefined;
    return { value: params.wTask * comp + params.wTest * (hasTest ? prog.testScore : 0), hasTest: hasTest, completion: comp };
  };
  /**
   * M-ONL-07 — Điểm tổng hợp dự kiến (OQ-23) = wTask × min(100, tiến độ tại t / tiến độ kỳ vọng tại t × 100)
   *            + wTest × (testScore ?? 0).
   */
  M.projectedComposite = function (a, prog, t, params) {
    const exp = M.expectedProgress(a, t);
    const cur = M.progressAt(prog, t) || 0;
    const proj = exp > 0 ? Math.min(1, cur / exp) : cur;
    const test = prog.testScore !== null && prog.testScore !== undefined ? prog.testScore : 0;
    return params.wTask * proj * 100 + params.wTest * test;
  };
  /** M-ONL-03 — Đúng tiến độ: tiến độ ≥ kỳ vọng − dung sai (điểm %). */
  M.isOnTrack = function (a, prog, t, cfg) {
    return U.gte((M.progressAt(prog, t) || 0) * 100, M.expectedProgress(a, t) * 100 - cfg.online.onTrackTolerancePts);
  };

  M.assignmentsIn = function (D, scope, filterFn) {
    const sc = M.scope(D, scope);
    const cs = sc.courseIds ? new Set(sc.courseIds) : null;
    const out = [];
    sc.classIds.forEach(function (cid) {
      (D.idx.assignByClass.get(cid) || []).forEach(function (a) {
        if (cs && !cs.has(a.courseId)) return;
        if (filterFn && !filterFn(a)) return;
        out.push(a);
      });
    });
    return out;
  };

  /**
   * M-ONL-04/05/10 — Hoàn thành khóa trực tuyến có dueAt ∈ [from, to).
   *  closed = ON_TIME + LATE + MISSING; onTimeRate = ON_TIME / closed;
   *  avgScore = TB điểm tổng hợp của học sinh ĐÃ CÓ điểm kiểm tra (OQ-23); passCount: hoàn thành và ≥ ngưỡng.
   */
  M.onlineCounts = function (D, scope, from, to, cfg) {
    const sc = M.scope(D, scope);
    return memo('onlC', D, [sc, from, to], cfg, function () {
      const now = D.meta.now;
      const c = { assignments: 0, ON_TIME: 0, LATE: 0, MISSING: 0, OPEN: 0, scoreSum: 0, scored: 0, passed: 0, students: 0 };
      const sf = sc.studentIds ? new Set(sc.studentIds) : null;
      M.assignmentsIn(D, sc, function (a) { return a.dueAt >= from && a.dueAt < to; }).forEach(function (a) {
        c.assignments++;
        const params = M.courseParams(D, a.courseId, cfg);
        (D.idx.progByAssignment.get(a.id) || []).forEach(function (p) {
          if (sf && !sf.has(p.studentId)) return;
          c.students++;
          c[M.onlineStatus(a, p, now)]++;
          const cs = M.compositeScore(p, params, now);
          if (cs.hasTest) { c.scored++; c.scoreSum += cs.value; }
          if (p.completedAt && p.completedAt <= now && U.gte(cs.value, params.passThreshold)) c.passed++;
        });
      });
      c.closed = c.ON_TIME + c.LATE + c.MISSING;
      c.onTimeRate = ratio(c.ON_TIME, c.closed);
      c.lateRate = ratio(c.LATE, c.closed);
      c.missingRate = ratio(c.MISSING, c.closed);
      c.avgScore = ratio(c.scoreSum, c.scored);
      return c;
    });
  };

  /**
   * Khóa trực tuyến đang chạy tại t (startAt ≤ t < dueAt): mỗi assignment → tiến độ TB, kỳ vọng,
   * số học sinh đúng tiến độ (M-ONL-09), số học sinh chậm ≥ X điểm %.
   */
  M.onlineRunning = function (D, scope, t, cfg) {
    const sc = M.scope(D, scope);
    return memo('onlR', D, [sc, t], cfg, function () {
      const sf = sc.studentIds ? new Set(sc.studentIds) : null;
      return M.assignmentsIn(D, sc, function (a) { return a.startAt <= t && t < a.dueAt; }).map(function (a) {
        const r = { assignment: a, n: 0, done: 0, total: 0, onTrack: 0, expected: M.expectedProgress(a, t), notStarted: 0, students: [] };
        (D.idx.progByAssignment.get(a.id) || []).forEach(function (p) {
          if (sf && !sf.has(p.studentId)) return;
          const items = M.completedItemsAt(p, t);
          r.n++; r.done += items; r.total += p.totalItems;
          if (items === 0) r.notStarted++;
          const on = M.isOnTrack(a, p, t, cfg);
          if (on) r.onTrack++;
          r.students.push({ studentId: p.studentId, progress: ratio(items, p.totalItems), onTrack: on, prog: p });
        });
        r.avgProgress = ratio(r.done, r.total);
        r.onTrackRate = ratio(r.onTrack, r.n);
        return r;
      });
    });
  };

  /**
   * M-ONL-08 — Funnel khóa trực tuyến cho các assignment giao trong kỳ (startAt < to và dueAt ≥ from), đo tại t:
   * Được giao → Đã bắt đầu (≥ 1 mục) → Đang học (≥ activeLearningPct% nội dung) → Hoàn thành → Đạt ngưỡng điểm tổng hợp.
   */
  M.onlineFunnel = function (D, scope, from, to, t, cfg) {
    const sc = M.scope(D, scope);
    return memo('onlF', D, [sc, from, to, t], cfg, function () {
      const f = { assigned: 0, started: 0, active: 0, completed: 0, passed: 0 };
      M.assignmentsIn(D, sc, function (a) { return a.startAt < to && a.dueAt >= from && a.startAt <= t; }).forEach(function (a) {
        const params = M.courseParams(D, a.courseId, cfg);
        (D.idx.progByAssignment.get(a.id) || []).forEach(function (p) {
          f.assigned++;
          const items = M.completedItemsAt(p, t);
          if (items >= 1) f.started++;
          if (U.gte(items / p.totalItems * 100, cfg.online.activeLearningPct)) f.active++;
          if (p.completedAt && p.completedAt <= t) {
            f.completed++;
            if (U.gte(M.compositeScore(p, params, t).value, params.passThreshold)) f.passed++;
          }
        });
      });
      return f;
    });
  };

  // =====================================================================================
  // Chuẩn đầu ra (LO)
  // =====================================================================================
  M.LEVELS = ['EXCELLENT', 'GOOD', 'AVERAGE', 'NEEDS_IMPROVEMENT', 'POOR', 'NO_DATA'];
  M.LEVEL_META = {
    EXCELLENT: { label: 'Rất tốt', short: 'RT', color: '#15803D' },
    GOOD: { label: 'Tốt', short: 'T', color: '#4ADE80' },
    AVERAGE: { label: 'Trung bình', short: 'TB', color: '#FACC15' },
    NEEDS_IMPROVEMENT: { label: 'Cần cải thiện', short: 'CCT', color: '#FB923C' },
    POOR: { label: 'Chưa tốt', short: 'CT', color: '#DC2626' },
    NO_DATA: { label: 'Chưa có thông tin', short: '–', color: '#D1D5DB' }
  };
  const LEVEL_KEY = { EXCELLENT: 'excellent', GOOD: 'good', AVERAGE: 'average', NEEDS_IMPROVEMENT: 'needsImprovement' };

  /** M-LO-01 — Quy đổi % → cấp: ≥ excellent RT · ≥ good T · ≥ average TB · ≥ needsImprovement CCT · còn lại CT · null → Chưa có thông tin. */
  M.loLevel = function (percent, cfg) {
    if (percent === null || percent === undefined || isNaN(percent)) return 'NO_DATA';
    const L = cfg.lo.levels;
    if (U.gte(percent, L.excellent)) return 'EXCELLENT';
    if (U.gte(percent, L.good)) return 'GOOD';
    if (U.gte(percent, L.average)) return 'AVERAGE';
    if (U.gte(percent, L.needsImprovement)) return 'NEEDS_IMPROVEMENT';
    return 'POOR';
  };
  /** Ngưỡng % tương ứng mức "đạt yêu cầu". */
  M.passPercent = function (cfg) { return cfg.lo.levels[LEVEL_KEY[cfg.lo.passLevel] || 'average']; };
  /** M-LO-02 — Đạt yêu cầu: có dữ liệu và cấp ≥ passLevel. */
  M.loPass = function (percent, cfg) {
    return percent !== null && percent !== undefined && !isNaN(percent) && U.gte(percent, M.passPercent(cfg));
  };

  /**
   * M-LO-05 — Màu: GRAY nếu coverage = 0 (không ai có dữ liệu); GREEN nếu tỉ lệ đạt ≥ green%;
   * ORANGE nếu ≥ orange%; RED nếu thấp hơn. So sánh bằng số nguyên (pass×100 ≥ ngưỡng×withData) để đúng điểm biên.
   */
  M.loColor = function (pass, withData, cfg) {
    if (!withData) return 'GRAY';
    if (pass * 100 >= cfg.lo.color.green * withData - 1e-9) return 'GREEN';
    if (pass * 100 >= cfg.lo.color.orange * withData - 1e-9) return 'ORANGE';
    return 'RED';
  };
  /** "Dữ liệu mỏng": 0 < coverage < thinCoverage%. */
  M.isThin = function (withData, enrolled, cfg) {
    return withData > 0 && withData * 100 < cfg.lo.thinCoverage * enrolled - 1e-9;
  };
  M.COLOR_META = {
    GREEN: { label: 'Xanh', icon: '✓', color: '#22A06B' },
    ORANGE: { label: 'Cam', icon: '!', color: '#F59E0B' },
    RED: { label: 'Đỏ', icon: '✕', color: '#E5484D' },
    GRAY: { label: 'Xám', icon: '–', color: '#B0B4BA' }
  };

  /**
   * M-LO-03/04/06/07 — Thống kê một tập bản ghi LOAchievement của sĩ số (enrolled).
   * coverage = withData / enrolled · passRate = pass / withData · avgEvidence = evidence / withData.
   */
  M.loStatsFromRows = function (rows, enrolled, cfg) {
    const st = { enrolled: enrolled, withData: 0, pass: 0, evidence: 0, levels: {} };
    M.LEVELS.forEach(function (l) { st.levels[l] = 0; });
    rows.forEach(function (a) {
      const lvl = M.loLevel(a.percent, cfg);
      st.levels[lvl]++;
      if (lvl !== 'NO_DATA') {
        st.withData++;
        st.evidence += a.evidenceCount || 0;
        if (M.loPass(a.percent, cfg)) st.pass++;
      }
    });
    st.levels.NO_DATA += Math.max(0, enrolled - rows.length);
    st.coverage = ratio(st.withData, enrolled);
    st.passRate = ratio(st.pass, st.withData);
    st.avgEvidence = ratio(st.evidence, st.withData);
    st.color = M.loColor(st.pass, st.withData, cfg);
    st.thin = M.isThin(st.withData, enrolled, cfg);
    return st;
  };
  M.mergeLoStats = function (list, cfg) {
    const st = { enrolled: 0, withData: 0, pass: 0, evidence: 0, levels: {} };
    M.LEVELS.forEach(function (l) { st.levels[l] = 0; });
    list.forEach(function (s) {
      st.enrolled += s.enrolled; st.withData += s.withData; st.pass += s.pass; st.evidence += s.evidence;
      M.LEVELS.forEach(function (l) { st.levels[l] += s.levels[l]; });
    });
    st.coverage = ratio(st.withData, st.enrolled);
    st.passRate = ratio(st.pass, st.withData);
    st.avgEvidence = ratio(st.evidence, st.withData);
    st.color = M.loColor(st.pass, st.withData, cfg);
    st.thin = M.isThin(st.withData, st.enrolled, cfg);
    return st;
  };

  /** Thống kê CĐR của một lớp (sĩ số = ghi danh hiệu lực tại t). */
  M.loClassStats = function (D, classId, loId, cfg, t) {
    return memo('loCS', D, [classId, loId, t], cfg, function () {
      const roster = M.roster(D, classId, t);
      const m = D.idx.achByClassLo.get(classId + '|' + loId);
      const rows = [];
      roster.forEach(function (sid) { const a = m && m.get(sid); if (a) rows.push(a); });
      const st = M.loStatsFromRows(rows, roster.length, cfg);
      st.classId = classId; st.loId = loId;
      return st;
    });
  };

  /** Các lớp đang học khóa tại t (ClassCourse còn hiệu lực), có thể giới hạn trong classIds. */
  M.courseClassIds = function (D, courseId, t, classIds) {
    return (D.idx.classCoursesByCourse.get(courseId) || [])
      .filter(function (cc) { return cc.startAt <= t && t <= cc.endAt && (!classIds || classIds.indexOf(cc.classId) >= 0); })
      .map(function (cc) { return cc.classId; }).sort();
  };

  /**
   * Ma trận lớp × CĐR của một khóa (heatmap trung tâm CD-03).
   * @returns {{los, classIds, cells: Map<'classId|loId', stats>, loTotals: Map<loId, stats>, classTotals: Map<classId, stats>, total}}
   */
  M.loMatrix = function (D, courseId, classIds, cfg, t) {
    return memo('loM', D, [courseId, classIds || null, t], cfg, function () {
      const cls = M.courseClassIds(D, courseId, t, classIds);
      const los = D.idx.losByCourse.get(courseId) || [];
      const cells = new Map(), loTotals = new Map(), classTotals = new Map();
      const all = [];
      los.forEach(function (lo) {
        const list = cls.map(function (c) { const s = M.loClassStats(D, c, lo.id, cfg, t); cells.set(c + '|' + lo.id, s); return s; });
        loTotals.set(lo.id, M.mergeLoStats(list, cfg));
        Array.prototype.push.apply(all, list);
      });
      cls.forEach(function (c) { classTotals.set(c, M.mergeLoStats(los.map(function (lo) { return cells.get(c + '|' + lo.id); }), cfg)); });
      return { courseId: courseId, los: los, classIds: cls, cells: cells, loTotals: loTotals, classTotals: classTotals, total: M.mergeLoStats(all, cfg) };
    });
  };

  /** M-LO-06 — Phân bố 6 mức trên mọi cặp (học sinh–lớp) × CĐR của các lớp đang học khóa (scope lớp/khóa). */
  M.levelDistribution = function (D, scope, cfg, t) {
    const sc = M.scope(D, scope);
    return memo('loDist', D, [sc, t], cfg, function () {
      const courseIds = sc.courseIds || D.courses.map(function (c) { return c.id; });
      const list = [];
      courseIds.forEach(function (cid) {
        const mx = M.loMatrix(D, cid, sc.allClasses ? null : sc.classIds, cfg, t);
        list.push(mx.total);
      });
      return M.mergeLoStats(list, cfg);
    });
  };

  /** M-LO-08 — % CĐR Xanh = số cặp lớp–CĐR Xanh / số cặp không Xám (OQ-25). */
  M.loGreenShare = function (D, scope, cfg, t) {
    const sc = M.scope(D, scope);
    return memo('loGreen', D, [sc, t], cfg, function () {
      let green = 0, nonGray = 0, red = 0, orange = 0, gray = 0;
      const courseIds = sc.courseIds || D.courses.map(function (c) { return c.id; });
      courseIds.forEach(function (cid) {
        const mx = M.loMatrix(D, cid, sc.allClasses ? null : sc.classIds, cfg, t);
        mx.cells.forEach(function (s) {
          if (s.color === 'GRAY') { gray++; return; }
          nonGray++;
          if (s.color === 'GREEN') green++; else if (s.color === 'RED') red++; else orange++;
        });
      });
      return { green: green, orange: orange, red: red, gray: gray, nonGray: nonGray, share: ratio(green, nonGray) };
    });
  };

  /** M-LO-12 — Thời lượng khóa đã qua tại t = TB các ClassCourse đang hoạt động của khóa. */
  M.courseElapsed = function (D, courseId, t) {
    const vals = (D.idx.classCoursesByCourse.get(courseId) || [])
      .filter(function (cc) { return cc.startAt <= t && t <= cc.endAt; })
      .map(function (cc) { return (t - cc.startAt) / (cc.endAt - cc.startAt); });
    return S.mean(vals);
  };

  /**
   * M-LO-09 — Diễn giải nguyên nhân (mục 3.6) cho một khóa tại t.
   *  Lớp đủ dữ liệu: withData ≥ minStudentsWithData và avgEvidence ≥ minAvgEvidence.
   *  CĐR → CURRICULUM nếu số lớp đủ dữ liệu ≥ minClassesForCurriculum và Đỏ ở ≥ curriculumRedShare% số lớp đó;
   *        INSUFFICIENT nếu chưa đủ số lớp; NONE nếu không.
   *  (lớp, CĐR) → CLASS nếu lớp đủ dữ liệu, có ≥ minOtherClasses lớp khác đủ dữ liệu, trung vị tỉ lệ đạt các lớp khác
   *        ≥ ngưỡng Cam và lớp thấp hơn trung vị đó ≥ classGapPts điểm %; INSUFFICIENT nếu thiếu dữ liệu; NONE nếu không.
   */
  M.causeAnalysis = function (D, courseId, cfg, t) {
    return memo('cause', D, [courseId, t], cfg, function () {
      const C = cfg.cause;
      const mx = M.loMatrix(D, courseId, null, cfg, t);
      const eligible = function (s) { return s.withData >= C.minStudentsWithData && s.avgEvidence !== null && U.gte(s.avgEvidence, C.minAvgEvidence); };
      const curriculum = new Map(), classLabel = new Map();
      mx.los.forEach(function (lo) {
        const el = mx.classIds.filter(function (c) { return eligible(mx.cells.get(c + '|' + lo.id)); });
        const red = el.filter(function (c) { return mx.cells.get(c + '|' + lo.id).color === 'RED'; });
        let label = 'NONE';
        if (el.length < C.minClassesForCurriculum) label = 'INSUFFICIENT';
        else if (red.length * 100 >= C.curriculumRedShare * el.length - 1e-9) label = 'CURRICULUM';
        curriculum.set(lo.id, { label: label, redClasses: red, eligibleClasses: el, totalClasses: mx.classIds.length, share: ratio(red.length, el.length) });
        mx.classIds.forEach(function (c) {
          const s = mx.cells.get(c + '|' + lo.id);
          if (!eligible(s)) { classLabel.set(c + '|' + lo.id, { label: 'INSUFFICIENT', median: null, gap: null }); return; }
          const others = el.filter(function (x) { return x !== c; }).map(function (x) { return mx.cells.get(x + '|' + lo.id).passRate; });
          if (others.length < C.minOtherClasses) { classLabel.set(c + '|' + lo.id, { label: 'INSUFFICIENT', median: null, gap: null }); return; }
          const med = S.median(others);
          const gap = med - s.passRate;
          const isClass = U.gte(med * 100, cfg.lo.color.orange) && U.gte(gap * 100, C.classGapPts);
          classLabel.set(c + '|' + lo.id, { label: isClass ? 'CLASS' : 'NONE', median: med, gap: gap });
        });
      });
      return { matrix: mx, curriculum: curriculum, classLabel: classLabel, eligible: eligible };
    });
  };
  M.CAUSE_TEXT = {
    CURRICULUM: 'Nghi vấn chương trình / học liệu / đề đánh giá',
    CLASS: 'Nghi vấn ở lớp học — cần xem xét',
    INSUFFICIENT: 'Chưa đủ dữ liệu để kết luận',
    NONE: ''
  };
  M.CAUSE_NOTE = 'Kết quả của lớp còn chịu ảnh hưởng bởi đầu vào học sinh, sĩ số, số buổi đã học và cách ra đề. ' +
    'Nhãn chỉ gợi ý nơi cần xem xét; mọi kết luận về chất lượng giảng dạy cần Học vụ tự kiểm chứng (dự giờ, trao đổi).';

  /**
   * M-LO-10 — Tỉ lệ đúng theo câu hỏi (QuestionAttempt) của một CĐR, tách theo lớp.
   * @returns {Array<{question, attempts, correct, rate, byClass: Map<classId,{n,c,rate}>}>}
   */
  M.questionStats = function (D, loId, classIds) {
    return memo('qStats', D, [loId, classIds || null], null, function () {
      const qs = (D.idx.questionsByLo.get(loId) || []).map(function (q) { return { question: q, attempts: 0, correct: 0, byClass: new Map() }; });
      const byQ = new Map(qs.map(function (x) { return [x.question.id, x]; }));
      (D.idx.attemptsByLo.get(loId) || []).forEach(function (a) {
        if (classIds && classIds.indexOf(a.classId) < 0) return;
        const x = byQ.get(a.questionId);
        if (!x) return;
        x.attempts++; if (a.isCorrect) x.correct++;
        let g = x.byClass.get(a.classId);
        if (!g) { g = { n: 0, c: 0 }; x.byClass.set(a.classId, g); }
        g.n++; if (a.isCorrect) g.c++;
      });
      qs.forEach(function (x) {
        x.rate = ratio(x.correct, x.attempts);
        x.byClass.forEach(function (g) { g.rate = ratio(g.c, g.n); });
      });
      return qs;
    });
  };

  /**
   * M-LO-11 — Xu hướng tỉ lệ đạt theo tuần từ LOSnapshot (ảnh chụp tuần, ngưỡng tại thời điểm chụp).
   * Gộp nhiều lớp: passRate = Σ(passRate×withData) / Σ withData; coverage = Σ withData / Σ enrolled.
   */
  M.loTrend = function (D, loId, classIds) {
    return memo('loTrend', D, [loId, classIds], null, function () {
      const byWeek = new Map();
      classIds.forEach(function (c) {
        (D.idx.snapsByClassLo.get(c + '|' + loId) || []).forEach(function (s) {
          let g = byWeek.get(s.weekStart);
          if (!g) { g = { weekStart: s.weekStart, pass: 0, withData: 0, enrolled: 0 }; byWeek.set(s.weekStart, g); }
          g.withData += s.withData || 0;
          g.enrolled += s.enrolled || 0;
          g.pass += (s.passRate || 0) * (s.withData || 0);
        });
      });
      return Array.from(byWeek.values()).sort(function (a, b) { return a.weekStart - b.weekStart; }).map(function (g) {
        return { weekStart: g.weekStart, passRate: ratio(g.pass, g.withData), coverage: ratio(g.withData, g.enrolled), withData: g.withData };
      });
    });
  };

  /** Hồ sơ CĐR của một học sinh trong một lớp–khóa: số CĐR theo cấp + danh sách. */
  M.studentLoProfile = function (D, studentId, classId, courseId, cfg) {
    const rows = (D.idx.achByClassCourse.get(classId + '|' + courseId) || []).filter(function (a) { return a.studentId === studentId; });
    const levels = {};
    M.LEVELS.forEach(function (l) { levels[l] = 0; });
    const items = rows.map(function (a) {
      const lvl = M.loLevel(a.percent, cfg);
      levels[lvl]++;
      return { ach: a, lo: D.loById.get(a.loId), level: lvl, pass: M.loPass(a.percent, cfg) };
    }).sort(function (a, b) { return a.lo.order - b.lo.order; });
    const failed = items.filter(function (x) { return x.level !== 'NO_DATA' && !x.pass; }).length;
    return { levels: levels, items: items, failed: failed, poor: levels.POOR };
  };

  // =====================================================================================
  // Tổng hợp / benchmark (BM)
  // =====================================================================================
  /**
   * M-BM-01 — 6 chỉ số chính của một scope trong [from, to) (CĐR lũy kế tại min(to, now)):
   * present (M-ATT-07), taskOnTime (M-HW-02), taskScore (M-HW-07), onlineOnTime (M-ONL-05),
   * loGreen (M-LO-08), reported (M-OPS-04).
   */
  M.keyMetrics = function (D, scope, from, to, cfg) {
    const sc = M.scope(D, scope);
    return memo('key', D, [sc, from, to], cfg, function () {
      const t = Math.min(to, D.meta.now);
      const att = M.attendanceCounts(D, sc, from, to);
      const tk = M.taskCounts(D, sc, from, to);
      const onl = M.onlineCounts(D, sc, from, to, cfg);
      const ops = M.opsCounts(D, sc, from, to, cfg);
      const green = M.loGreenShare(D, sc, cfg, t);
      return {
        present: { value: M.attendanceRates(att).present, n: att.taken },
        taskOnTime: { value: M.taskRates(tk).onTime, n: tk.overdue },
        taskScore: { value: M.taskRates(tk).avgScore, n: tk.graded },
        onlineOnTime: { value: onl.onTimeRate, n: onl.closed },
        loGreen: { value: green.share, n: green.nonGray },
        reported: { value: ops.reportedRate, n: ops.ended }
      };
    });
  };
  M.KEY_METRICS = [
    { key: 'present', label: 'Tỉ lệ có mặt', kind: 'rate', ref: 'M-ATT-07' },
    { key: 'taskOnTime', label: 'Tỉ lệ nộp đúng hạn', kind: 'rate', ref: 'M-HW-02' },
    { key: 'taskScore', label: 'Điểm TB nhiệm vụ', kind: 'score', ref: 'M-HW-07' },
    { key: 'onlineOnTime', label: 'Hoàn thành khóa TT đúng hạn', kind: 'rate', ref: 'M-ONL-05' },
    { key: 'loGreen', label: '% chuẩn đầu ra Xanh', kind: 'rate', ref: 'M-LO-08' },
    { key: 'reported', label: 'Tỉ lệ buổi đã báo cáo', kind: 'rate', ref: 'M-OPS-04' }
  ];
  /** M-BM-02 — Độ lệch so với trường, quy về điểm % (điểm thang 10 × 10). */
  M.deviationPts = function (kind, v, base) {
    if (v === null || v === undefined || base === null || base === undefined) return null;
    return kind === 'score' ? (v - base) * 10 : (v - base) * 100;
  };
})(window.GT);
