/**
 * GenieTeach — Báo cáo Học vụ (prototype)
 * alerts.js — Rule engine cảnh báo bất thường (docs/ALERTS.md).
 *
 * - Đọc tham số từ cấu hình cấp trường (GT.config → alerts.rules[ruleId] = {enabled, severity, params}).
 * - Chỉ dùng metrics.js để tính số liệu (một định nghĩa duy nhất).
 * - Đánh giá tại "bây giờ" (D.meta.now); mỗi rule có cửa sổ riêng (OQ-02).
 * - Quy tắc chung: cỡ mẫu tối thiểu, gộp ≥ N học sinh cùng lớp → 1 cảnh báo cấp lớp, chống trùng 7 ngày.
 * - Ngôn ngữ: mô tả số liệu cụ thể; không quy kết chất lượng giáo viên ("cần xem xét", "lớp học").
 */
window.GT = window.GT || {};
(function (GT) {
  'use strict';
  const DT = GT.date, U = GT.util, F = GT.fmt, S = GT.stats;
  const M = GT.metrics;
  const MIN = DT.MIN, HOUR = DT.HOUR, DAY = DT.DAY;
  const A = GT.alerts = {};
  const STATE_KEY = 'gt.hocvu.alertState.v1';

  A.SEVERITY = {
    HIGH: { label: 'Cao', order: 0, color: '#E5484D', icon: '▲' },
    MEDIUM: { label: 'Trung bình', order: 1, color: '#F59E0B', icon: '●' },
    LOW: { label: 'Thấp', order: 2, color: '#0098F0', icon: '▼' }
  };
  A.SEVERITY_ORDER = ['HIGH', 'MEDIUM', 'LOW'];
  A.GROUPS = {
    OPS: 'Vận hành', ATT: 'Chuyên cần', HW: 'Nhiệm vụ', ONL: 'Khóa trực tuyến',
    LO: 'Chuẩn đầu ra', CUR: 'Chương trình', DATA: 'Chất lượng dữ liệu'
  };
  /** Nhóm hiển thị ở Tổng quan (OQ-31). */
  A.DISPLAY_GROUPS = [
    { id: 'OPS', label: 'Vận hành' },
    { id: 'ATT', label: 'Chuyên cần' },
    { id: 'HOME', label: 'Học ở nhà' },
    { id: 'LEARN', label: 'Chuẩn đầu ra' }
  ];
  A.displayGroupOf = function (a) {
    if (a.group === 'OPS' || a.ruleId === 'DATA-03') return 'OPS';
    if (a.group === 'ATT') return 'ATT';
    if (a.group === 'HW' || a.group === 'ONL') return 'HOME';
    return 'LEARN';
  };
  A.STATUS = { NEW: 'Mới', IN_PROGRESS: 'Đang xử lý', RESOLVED: 'Đã xử lý', IGNORED: 'Bỏ qua' };
  A.SCOPE_LABEL = { STUDENT: 'Học sinh', CLASS: 'Lớp', GROUP: 'Nhóm lớp', TEACHER: 'Giáo viên', COURSE: 'Khóa học', LO: 'Chuẩn đầu ra', SESSION: 'Buổi học', TASK: 'Nhiệm vụ' };

  // =====================================================================================
  // Ngữ cảnh đánh giá
  // =====================================================================================
  function makeCtx(D, cfg) {
    const now = D.meta.now;
    const ctx = {
      D: D, cfg: cfg, now: now,
      /** Cửa sổ [now − days, now] (to = now + 1ms để gồm buổi bắt đầu đúng lúc now). */
      win: function (days, offsetDays) {
        const off = (offsetDays || 0) * DAY;
        return [now - days * DAY - off, now + 1 - off];
      },
      enough: function (den, students) {
        return den >= cfg.alerts.minDenominator && students >= cfg.alerts.minStudentsWithData;
      },
      cls: function (id) { const c = D.classById.get(id); return c ? c.name : id; },
      grp: function (id) { const g = D.groupById.get(id); return g ? g.name : id; },
      course: function (id) { const c = D.courseById.get(id); return c ? c.name : id; },
      teacher: function (id) { const t = D.teacherById.get(id); return t ? t.name : id; },
      stu: function (id) { const s = D.studentById.get(id); return s ? s.fullName + ' (' + s.code + ')' : id; },
      lo: function (id) { const l = D.loById.get(id); return l ? l.code + ' "' + l.name + '"' : id; },
      activeClasses: M.activeClassIds(D, {}, now)
    };
    return ctx;
  }
  function q(obj) { return GT.qs.build(obj); }
  function topKey(map) {
    let best = null, bv = -1;
    map.forEach(function (v, k) { if (v > bv) { bv = v; best = k; } });
    return best;
  }
  function wtxt(days) { return days + ' ngày gần nhất'; }

  // =====================================================================================
  // Danh mục rule (mục 5) — mỗi rule trả về danh sách ứng viên cảnh báo
  // =====================================================================================
  const R = [];
  function rule(def) { R.push(def); }

  // ------------------------------------------------------------------ OPS
  rule({
    id: 'OPS-01', group: 'OPS', scope: 'SESSION', name: 'Buổi học đã bắt đầu quá X phút chưa điểm danh', classTab: 'attendance',
    paramsMeta: [{ key: 'minutes', label: 'Số phút sau giờ bắt đầu', unit: 'phút' }],
    evaluate: function (ctx, p) {
      const out = [];
      (ctx.D.idx.sessionsByDay.get(DT.dayKey(ctx.now)) || []).forEach(function (s) {
        if (s.start + p.minutes * MIN > ctx.now || s.attendanceSubmittedAt !== null) return;
        const mins = Math.round((ctx.now - s.start) / MIN);
        out.push({
          scope: 'SESSION', entityIds: [s.id], sessionId: s.id, classId: s.classId, courseId: s.courseId, teacherId: s.teacherId,
          title: 'Buổi học chưa điểm danh sau ' + p.minutes + ' phút',
          reason: 'Buổi ' + ctx.course(s.courseId) + ' lớp ' + ctx.cls(s.classId) + ' (' + DT.fmtTime(s.start) + '–' + DT.fmtTime(s.end) +
            ', GV phụ trách: ' + ctx.teacher(s.teacherId) + ') đã bắt đầu ' + mins + ' phút nhưng chưa có điểm danh (ngưỡng ' + p.minutes + ' phút).',
          suggestedAction: 'Liên hệ giáo viên phụ trách để điểm danh ngay; nếu buổi học bị hủy hoặc đổi lịch, cập nhật lịch học.',
          drilldownUrl: 'schedule.html' + q({ period: 'day', date: DT.dayKey(s.start), classId: s.classId }),
          detectedAt: s.start + p.minutes * MIN
        });
      });
      return out;
    }
  });

  rule({
    id: 'OPS-02', group: 'OPS', scope: 'SESSION', name: 'Buổi học kết thúc quá X giờ chưa có báo cáo', classTab: 'overview',
    paramsMeta: [{ key: 'hours', label: 'Số giờ sau khi kết thúc', unit: 'giờ' }, { key: 'lookbackDays', label: 'Xét các buổi trong', unit: 'ngày' }],
    evaluate: function (ctx, p) {
      const out = [];
      const arr = ctx.D.idx.sessionsSorted;
      for (let i = U.lowerBound(arr, ctx.now - (p.lookbackDays + 1) * DAY, function (s) { return s.start; }); i < arr.length && arr[i].start <= ctx.now; i++) {
        const s = arr[i];
        if (s.end < ctx.now - p.lookbackDays * DAY || s.end + p.hours * HOUR > ctx.now || s.reportSubmittedAt !== null) continue;
        out.push({
          scope: 'SESSION', entityIds: [s.id], sessionId: s.id, classId: s.classId, courseId: s.courseId, teacherId: s.teacherId,
          title: 'Buổi học chưa có báo cáo sau ' + p.hours + ' giờ',
          reason: 'Buổi ' + ctx.course(s.courseId) + ' lớp ' + ctx.cls(s.classId) + ' ngày ' + DT.fmtDate(s.start) + ' (kết thúc ' + DT.fmtTime(s.end) +
            ', GV phụ trách: ' + ctx.teacher(s.teacherId) + ') đã kết thúc ' + DT.fmtDuration(ctx.now - s.end) + ' nhưng chưa có báo cáo buổi học.',
          suggestedAction: 'Nhắc giáo viên hoàn thành báo cáo buổi học (nội dung đã dạy, nhận xét lớp).',
          drilldownUrl: 'schedule.html' + q({ period: 'week', date: DT.dayKey(s.start), classId: s.classId }),
          detectedAt: s.end + p.hours * HOUR
        });
      }
      return out;
    }
  });

  rule({
    id: 'OPS-03', group: 'OPS', scope: 'TEACHER', name: 'Giáo viên có ≥ X buổi chưa điểm danh hoặc chưa báo cáo', classTab: 'overview',
    paramsMeta: [{ key: 'minSessions', label: 'Số buổi tối thiểu', unit: 'buổi' }, { key: 'windowDays', label: 'Trong', unit: 'ngày' }],
    evaluate: function (ctx, p) {
      const out = [];
      const grace = ctx.cfg.ops.attendanceGraceMin * MIN, repH = ctx.cfg.ops.reportOnTimeHours * HOUR;
      ctx.D.idx.sessionsByTeacher.forEach(function (arr, tid) {
        let total = 0, noAtt = 0, noRep = 0, both = 0;
        for (let i = U.lowerBound(arr, ctx.now - p.windowDays * DAY, function (s) { return s.start; }); i < arr.length && arr[i].start <= ctx.now; i++) {
          const s = arr[i];
          total++;
          const a = s.start + grace <= ctx.now && s.attendanceSubmittedAt === null;
          const r = s.end + repH <= ctx.now && s.reportSubmittedAt === null;
          if (a) noAtt++;
          if (r) noRep++;
          if (a || r) both++;
        }
        if (both >= p.minSessions) {
          out.push({
            scope: 'TEACHER', entityIds: [tid], teacherId: tid,
            title: 'Giáo viên có nhiều buổi chưa điểm danh/báo cáo',
            reason: 'Trong ' + wtxt(p.windowDays) + ', ' + both + '/' + total + ' buổi do giáo viên ' + ctx.teacher(tid) +
              ' phụ trách chưa được điểm danh (' + noAtt + ' buổi) hoặc chưa có báo cáo sau ' + ctx.cfg.ops.reportOnTimeHours + ' giờ (' + noRep + ' buổi); ngưỡng ' + p.minSessions + ' buổi.',
            suggestedAction: 'Trao đổi với giáo viên về quy trình điểm danh trước buổi và báo cáo sau buổi; hỏi khó khăn khi sử dụng hệ thống.',
            drilldownUrl: 'teachers.html' + q({ teacherId: tid }),
            detectedAt: ctx.now
          });
        }
      });
      return out;
    }
  });

  rule({
    id: 'OPS-04', group: 'OPS', scope: 'TASK', name: 'Nhiệm vụ quá hạn > X ngày còn bài chưa chấm', classTab: 'homework',
    paramsMeta: [{ key: 'daysOverdue', label: 'Quá hạn hơn', unit: 'ngày' }, { key: 'lookbackDays', label: 'Xét nhiệm vụ có hạn trong', unit: 'ngày' }],
    evaluate: function (ctx, p) {
      const out = [];
      ctx.D.tasks.forEach(function (t) {
        if (!t.requiresManualGrading) return;
        if (t.dueAt + p.daysOverdue * DAY > ctx.now || t.dueAt < ctx.now - p.lookbackDays * DAY) return;
        const subs = ctx.D.idx.subsByTask.get(t.id);
        if (!subs) return;
        let n = 0, total = 0;
        subs.forEach(function (s) { total++; if (s.gradedAt === null) n++; });
        if (!n) return;
        out.push({
          scope: 'TASK', entityIds: [t.id], taskId: t.id, classId: t.classId, courseId: t.courseId,
          title: 'Nhiệm vụ quá hạn còn bài chưa chấm',
          reason: 'Nhiệm vụ "' + t.title + '" (lớp ' + ctx.cls(t.classId) + ', ' + ctx.course(t.courseId) + ', hạn ' + DT.fmtDate(t.dueAt) +
            ') đã quá hạn ' + F.num((ctx.now - t.dueAt) / DAY, 1) + ' ngày, còn ' + n + '/' + total + ' bài nộp chưa chấm.',
          suggestedAction: 'Nhắc giáo viên chấm và trả bài để học sinh nhận phản hồi kịp thời.',
          drilldownUrl: 'class.html' + q({ classId: t.classId, tab: 'homework', courseId: t.courseId }),
          detectedAt: t.dueAt + p.daysOverdue * DAY
        });
      });
      return out;
    }
  });

  rule({
    id: 'OPS-05', group: 'OPS', scope: 'CLASS', name: 'Lớp có buổi học nhưng không được giao nhiệm vụ nào', classTab: 'homework',
    paramsMeta: [{ key: 'windowDays', label: 'Trong', unit: 'ngày' }],
    evaluate: function (ctx, p) {
      const out = [];
      const from = ctx.now - p.windowDays * DAY;
      ctx.activeClasses.forEach(function (cid) {
        const sessions = (ctx.D.idx.sessionsByClass.get(cid) || []).filter(function (s) { return s.end >= from && s.end <= ctx.now; });
        if (!sessions.length) return;
        const tasks = (ctx.D.idx.tasksByClass.get(cid) || []).filter(function (t) { return t.assignedAt >= from && t.assignedAt <= ctx.now; });
        if (tasks.length) return;
        out.push({
          scope: 'CLASS', entityIds: [cid], classId: cid,
          title: 'Lớp có buổi học nhưng không có nhiệm vụ',
          reason: 'Lớp ' + ctx.cls(cid) + ' có ' + sessions.length + ' buổi học trong ' + wtxt(p.windowDays) + ' nhưng không được giao nhiệm vụ nào.',
          suggestedAction: 'Kiểm tra với giáo viên phụ trách: nhiệm vụ có được giao ngoài hệ thống, hay cần bổ sung bài tập sau buổi học.',
          drilldownUrl: 'class.html' + q({ classId: cid, tab: 'homework' }),
          detectedAt: ctx.now
        });
      });
      return out;
    }
  });

  rule({
    id: 'OPS-06', group: 'OPS', scope: 'CLASS', name: 'Lớp có tỉ lệ bản ghi "chưa điểm danh" > X%', classTab: 'attendance',
    paramsMeta: [{ key: 'threshold', label: 'Ngưỡng', unit: '%' }, { key: 'windowDays', label: 'Trong', unit: 'ngày' }],
    evaluate: function (ctx, p) {
      const out = [];
      const w = ctx.win(p.windowDays);
      ctx.activeClasses.forEach(function (cid) {
        const c = M.attendanceCounts(ctx.D, { classIds: [cid] }, w[0], w[1]);
        const roster = M.roster(ctx.D, cid, ctx.now).length;
        if (!ctx.enough(c.total, roster)) return;
        const r = c.NOT_TAKEN / c.total;
        if (!(r * 100 > p.threshold + 1e-9)) return;
        out.push({
          scope: 'CLASS', entityIds: [cid], classId: cid,
          title: 'Tỉ lệ bản ghi chưa điểm danh cao',
          reason: 'Lớp ' + ctx.cls(cid) + ' có ' + F.pct(r) + ' bản ghi ở trạng thái "chưa điểm danh" trong ' + wtxt(p.windowDays) +
            ' (' + c.NOT_TAKEN + '/' + c.total + ' lượt), vượt ngưỡng ' + p.threshold + '%. Các chỉ số chuyên cần của lớp kém tin cậy.',
          suggestedAction: 'Rà soát các buổi chưa điểm danh với giáo viên phụ trách; bổ sung điểm danh nếu còn thông tin.',
          drilldownUrl: 'attendance.html' + q({ period: 'month', date: DT.dayKey(ctx.now), classId: cid }),
          detectedAt: ctx.now
        });
      });
      return out;
    }
  });

  // ------------------------------------------------------------------ ATT — học sinh
  function studentAttRule(def) {
    rule(Object.assign({ group: 'ATT', scope: 'STUDENT', classTab: 'attendance' }, def));
  }
  function classOfRecords(records, filter) {
    const m = new Map();
    records.forEach(function (r) { if (filter(r)) m.set(r._classId, (m.get(r._classId) || 0) + 1); });
    return topKey(m);
  }

  studentAttRule({
    id: 'ATT-S01', name: 'Học sinh vắng (có phép + không phép) > X buổi', groupTitle: 'vắng nhiều buổi',
    paramsMeta: [{ key: 'maxAbsences', label: 'Số buổi vắng tối đa', unit: 'buổi' }, { key: 'windowDays', label: 'Trong', unit: 'ngày' }],
    evaluate: function (ctx, p) {
      const w = ctx.win(p.windowDays);
      const out = [];
      M.attendanceByStudent(ctx.D, {}, w[0], w[1]).forEach(function (g, sid) {
        const abs = g.EXCUSED + g.UNEXCUSED;
        if (abs <= p.maxAbsences) return;
        let k = 0, det = ctx.now;
        for (let i = 0; i < g.records.length; i++) {
          const r = g.records[i];
          if (r.status === 'EXCUSED' || r.status === 'UNEXCUSED') { k++; if (k === p.maxAbsences + 1) { det = r._start; break; } }
        }
        const cid = classOfRecords(g.records, function (r) { return r.status === 'EXCUSED' || r.status === 'UNEXCUSED'; });
        out.push({
          scope: 'STUDENT', entityIds: [sid], studentId: sid, classId: cid, value: abs,
          title: 'Học sinh vắng nhiều buổi',
          reason: ctx.stu(sid) + ' vắng ' + abs + ' buổi trong ' + wtxt(p.windowDays) + ' (' + g.UNEXCUSED + ' không phép, ' + g.EXCUSED +
            ' có phép; ' + g.taken + ' buổi đã điểm danh, lớp: ' + Array.from(g.classes).map(ctx.cls).join(', ') + '), vượt ngưỡng ' + p.maxAbsences + ' buổi.',
          suggestedAction: 'GVCN liên hệ phụ huynh tìm hiểu nguyên nhân; lập kế hoạch học bù nếu cần.',
          drilldownUrl: 'student.html' + q({ studentId: sid }),
          detectedAt: det
        });
      });
      return out;
    }
  });

  studentAttRule({
    id: 'ATT-S02', name: 'Học sinh vắng không phép ≥ X buổi liên tiếp', groupTitle: 'vắng không phép liên tiếp',
    paramsMeta: [{ key: 'consecutive', label: 'Số buổi liên tiếp', unit: 'buổi' }, { key: 'windowDays', label: 'Trong', unit: 'ngày' }],
    evaluate: function (ctx, p) {
      const w = ctx.win(p.windowDays);
      const out = [];
      M.attendanceByStudent(ctx.D, {}, w[0], w[1]).forEach(function (g, sid) {
        if (g.longestUnexcused < p.consecutive) return;
        let cur = 0, det = ctx.now, cid = null;
        for (let i = 0; i < g.records.length; i++) {
          const r = g.records[i];
          if (r.status === 'UNEXCUSED') { cur++; if (cur === p.consecutive) { det = r._start; cid = r._classId; break; } }
          else if (r.status !== 'NOT_TAKEN') cur = 0;
        }
        out.push({
          scope: 'STUDENT', entityIds: [sid], studentId: sid, classId: cid, value: g.longestUnexcused,
          title: 'Vắng không phép nhiều buổi liên tiếp',
          reason: ctx.stu(sid) + ' có chuỗi vắng không phép ' + g.longestUnexcused + ' buổi liên tiếp trong ' + wtxt(p.windowDays) +
            ' (ngưỡng ' + p.consecutive + ' buổi); tổng ' + g.UNEXCUSED + ' buổi không phép.',
          suggestedAction: 'Liên hệ ngay gia đình để xác nhận tình trạng của học sinh.',
          drilldownUrl: 'student.html' + q({ studentId: sid }),
          detectedAt: det
        });
      });
      return out;
    }
  });

  studentAttRule({
    id: 'ATT-S03', name: 'Học sinh đi muộn ≥ X lần', groupTitle: 'đi muộn nhiều lần',
    paramsMeta: [{ key: 'lateCount', label: 'Số lần đi muộn', unit: 'lần' }, { key: 'windowDays', label: 'Trong', unit: 'ngày' }],
    evaluate: function (ctx, p) {
      const w = ctx.win(p.windowDays);
      const out = [];
      M.attendanceByStudent(ctx.D, {}, w[0], w[1]).forEach(function (g, sid) {
        if (g.LATE < p.lateCount) return;
        let k = 0, det = ctx.now;
        for (let i = 0; i < g.records.length; i++) if (g.records[i].status === 'LATE' && ++k === p.lateCount) { det = g.records[i]._start; break; }
        out.push({
          scope: 'STUDENT', entityIds: [sid], studentId: sid, classId: classOfRecords(g.records, function (r) { return r.status === 'LATE'; }), value: g.LATE,
          title: 'Học sinh đi muộn nhiều lần',
          reason: ctx.stu(sid) + ' đi muộn ' + g.LATE + ' lần trong ' + wtxt(p.windowDays) + ' (' + g.taken + ' buổi đã điểm danh), ngưỡng ' + p.lateCount + ' lần.',
          suggestedAction: 'GVCN nhắc nhở và tìm hiểu nguyên nhân (đường đi, lịch sinh hoạt).',
          drilldownUrl: 'student.html' + q({ studentId: sid }),
          detectedAt: det
        });
      });
      return out;
    }
  });

  studentAttRule({
    id: 'ATT-S04', name: 'Tỉ lệ có mặt giảm ≥ X điểm % so với kỳ trước', groupTitle: 'tỉ lệ có mặt giảm mạnh',
    paramsMeta: [{ key: 'dropPts', label: 'Mức giảm', unit: 'điểm %' }, { key: 'windowDays', label: 'Độ dài kỳ', unit: 'ngày' }, { key: 'minSessions', label: 'Số buổi tối thiểu mỗi kỳ', unit: 'buổi' }],
    evaluate: function (ctx, p) {
      const cw = ctx.win(p.windowDays), pw = ctx.win(p.windowDays, p.windowDays);
      const cur = M.attendanceByStudent(ctx.D, {}, cw[0], cw[1]);
      const prev = M.attendanceByStudent(ctx.D, {}, pw[0], pw[1]);
      const out = [];
      cur.forEach(function (g, sid) {
        const h = prev.get(sid);
        if (!h || g.taken < p.minSessions || h.taken < p.minSessions) return;
        const rc = (g.ON_TIME + g.LATE) / g.taken, rp = (h.ON_TIME + h.LATE) / h.taken;
        if (!U.gte((rp - rc) * 100, p.dropPts)) return;
        out.push({
          scope: 'STUDENT', entityIds: [sid], studentId: sid, classId: classOfRecords(g.records, function (r) { return r.status === 'EXCUSED' || r.status === 'UNEXCUSED'; }) || Array.from(g.classes)[0], value: rp - rc,
          title: 'Tỉ lệ có mặt giảm mạnh',
          reason: 'Tỉ lệ có mặt của ' + ctx.stu(sid) + ' trong ' + wtxt(p.windowDays) + ' là ' + F.pct(rc) + ' (' + (g.ON_TIME + g.LATE) + '/' + g.taken +
            ' buổi), giảm ' + F.pts(rp - rc).replace(/^[+−±]/, '') + ' so với ' + p.windowDays + ' ngày trước đó (' + F.pct(rp) + ').',
          suggestedAction: 'Trao đổi sớm với học sinh và gia đình để phát hiện thay đổi hoàn cảnh hoặc sức khỏe.',
          drilldownUrl: 'student.html' + q({ studentId: sid }),
          detectedAt: ctx.now
        });
      });
      return out;
    }
  });

  studentAttRule({
    id: 'ATT-S05', name: 'Học sinh vắng có phép ≥ X buổi (theo dõi lạm dụng)', groupTitle: 'vắng có phép nhiều',
    paramsMeta: [{ key: 'excusedCount', label: 'Số buổi vắng có phép', unit: 'buổi' }, { key: 'windowDays', label: 'Trong', unit: 'ngày' }],
    evaluate: function (ctx, p) {
      const w = ctx.win(p.windowDays);
      const out = [];
      M.attendanceByStudent(ctx.D, {}, w[0], w[1]).forEach(function (g, sid) {
        if (g.EXCUSED < p.excusedCount) return;
        out.push({
          scope: 'STUDENT', entityIds: [sid], studentId: sid, classId: classOfRecords(g.records, function (r) { return r.status === 'EXCUSED'; }), value: g.EXCUSED,
          title: 'Vắng có phép nhiều buổi',
          reason: ctx.stu(sid) + ' vắng có phép ' + g.EXCUSED + ' buổi trong ' + wtxt(p.windowDays) + ' (ngưỡng ' + p.excusedCount + ' buổi).',
          suggestedAction: 'Kiểm tra lý do xin phép (đội tuyển, sức khỏe…) và kế hoạch học bù.',
          drilldownUrl: 'student.html' + q({ studentId: sid }),
          detectedAt: ctx.now
        });
      });
      return out;
    }
  });

  // ------------------------------------------------------------------ ATT — lớp / nhóm
  rule({
    id: 'ATT-C01', group: 'ATT', scope: 'CLASS', name: 'Tỉ lệ có mặt của lớp < X%', classTab: 'attendance',
    paramsMeta: [{ key: 'threshold', label: 'Ngưỡng', unit: '%' }, { key: 'windowDays', label: 'Trong', unit: 'ngày' }],
    evaluate: function (ctx, p) {
      const w = ctx.win(p.windowDays);
      const school = M.attendanceRates(M.attendanceCounts(ctx.D, {}, w[0], w[1])).present;
      const out = [];
      ctx.activeClasses.forEach(function (cid) {
        const c = M.attendanceCounts(ctx.D, { classIds: [cid] }, w[0], w[1]);
        if (!ctx.enough(c.taken, c.studentsWithData)) return;
        const r = M.attendanceRates(c).present;
        if (!U.lt(r * 100, p.threshold)) return;
        out.push({
          scope: 'CLASS', entityIds: [cid], classId: cid, value: r,
          title: 'Tỉ lệ có mặt của lớp thấp',
          reason: 'Lớp ' + ctx.cls(cid) + ' có tỉ lệ có mặt ' + F.pct(r) + ' trong ' + wtxt(p.windowDays) + ' (' + (c.ON_TIME + c.LATE) + '/' + c.taken +
            ' lượt), dưới ngưỡng ' + p.threshold + '% (trung bình trường ' + F.pct(school) + ').',
          suggestedAction: 'Xem danh sách học sinh vắng của lớp; trao đổi với GVCN về nguyên nhân chung (dịch bệnh, lịch học, sự kiện).',
          drilldownUrl: 'class.html' + q({ classId: cid, tab: 'attendance', period: 'week', date: DT.dayKey(ctx.now) }),
          detectedAt: ctx.now
        });
      });
      return out;
    }
  });

  rule({
    id: 'ATT-C02', group: 'ATT', scope: 'CLASS', name: 'Tỉ lệ đi muộn của lớp cao hơn TB trường ≥ X điểm %', classTab: 'attendance',
    paramsMeta: [{ key: 'gapPts', label: 'Chênh lệch', unit: 'điểm %' }, { key: 'windowDays', label: 'Trong', unit: 'ngày' }],
    evaluate: function (ctx, p) {
      const w = ctx.win(p.windowDays);
      const school = M.attendanceRates(M.attendanceCounts(ctx.D, {}, w[0], w[1])).late;
      const out = [];
      if (school === null) return out;
      ctx.activeClasses.forEach(function (cid) {
        const c = M.attendanceCounts(ctx.D, { classIds: [cid] }, w[0], w[1]);
        if (!ctx.enough(c.taken, c.studentsWithData)) return;
        const r = M.attendanceRates(c).late;
        if (!U.gte((r - school) * 100, p.gapPts)) return;
        out.push({
          scope: 'CLASS', entityIds: [cid], classId: cid, value: r,
          title: 'Lớp đi muộn nhiều',
          reason: 'Lớp ' + ctx.cls(cid) + ' có tỉ lệ đi muộn ' + wtxt(p.windowDays) + ' ' + F.pct(r) + ' (' + c.LATE + '/' + c.taken + ' lượt), cao hơn trung bình trường (' +
            F.pct(school) + ') ' + F.pts(r - school).replace(/^[+−±]/, '') + '.',
          suggestedAction: 'Kiểm tra giờ vào lớp của các ca có nhiều đi muộn; phối hợp GVCN nhắc nhở.',
          drilldownUrl: 'class.html' + q({ classId: cid, tab: 'attendance', period: 'week', date: DT.dayKey(ctx.now) }),
          detectedAt: ctx.now
        });
      });
      return out;
    }
  });

  rule({
    id: 'ATT-C03', group: 'ATT', scope: 'CLASS', name: 'Tỉ lệ có mặt của lớp giảm ≥ X điểm % so với kỳ trước', classTab: 'attendance',
    paramsMeta: [{ key: 'dropPts', label: 'Mức giảm', unit: 'điểm %' }, { key: 'windowDays', label: 'Độ dài kỳ', unit: 'ngày' }],
    evaluate: function (ctx, p) {
      const cw = ctx.win(p.windowDays), pw = ctx.win(p.windowDays, p.windowDays);
      const out = [];
      ctx.activeClasses.forEach(function (cid) {
        const c = M.attendanceCounts(ctx.D, { classIds: [cid] }, cw[0], cw[1]);
        const h = M.attendanceCounts(ctx.D, { classIds: [cid] }, pw[0], pw[1]);
        if (!ctx.enough(c.taken, c.studentsWithData) || !ctx.enough(h.taken, h.studentsWithData)) return;
        const rc = M.attendanceRates(c).present, rp = M.attendanceRates(h).present;
        if (!U.gte((rp - rc) * 100, p.dropPts)) return;
        out.push({
          scope: 'CLASS', entityIds: [cid], classId: cid, value: rp - rc,
          title: 'Tỉ lệ có mặt của lớp giảm',
          reason: 'Lớp ' + ctx.cls(cid) + ' có tỉ lệ có mặt ' + wtxt(p.windowDays) + ' ' + F.pct(rc) + ' (' + (c.ON_TIME + c.LATE) + '/' + c.taken + ' lượt), giảm ' +
            F.pts(rp - rc).replace(/^[+−±]/, '') + ' so với ' + p.windowDays + ' ngày trước đó (' + F.pct(rp) + ').',
          suggestedAction: 'Tìm hiểu nguyên nhân đột biến (dịch bệnh, thay đổi lịch, sự kiện) cùng GVCN.',
          drilldownUrl: 'class.html' + q({ classId: cid, tab: 'attendance', period: 'week', date: DT.dayKey(ctx.now) }),
          detectedAt: ctx.now
        });
      });
      return out;
    }
  });

  rule({
    id: 'ATT-C04', group: 'ATT', scope: 'SESSION', name: 'Một buổi có tỉ lệ có mặt thấp hơn TB lớp ≥ X điểm %', classTab: 'attendance',
    paramsMeta: [{ key: 'gapPts', label: 'Chênh lệch', unit: 'điểm %' }, { key: 'windowDays', label: 'Xét các buổi trong', unit: 'ngày' }],
    evaluate: function (ctx, p) {
      const w = ctx.win(p.windowDays);
      const out = [];
      ctx.activeClasses.forEach(function (cid) {
        const cc = M.attendanceCounts(ctx.D, { classIds: [cid] }, w[0], w[1]);
        if (!ctx.enough(cc.taken, cc.studentsWithData)) return;
        const avg = M.attendanceRates(cc).present;
        M.sessionsIn(ctx.D, { classIds: [cid] }, w[0], w[1]).forEach(function (s) {
          const c = { ON_TIME: 0, LATE: 0, EXCUSED: 0, UNEXCUSED: 0 };
          (ctx.D.idx.attBySession.get(s.id) || []).forEach(function (r) { if (r.status !== 'NOT_TAKEN') c[r.status]++; });
          const taken = c.ON_TIME + c.LATE + c.EXCUSED + c.UNEXCUSED;
          if (taken < ctx.cfg.alerts.minStudentsWithData) return;   // cỡ mẫu tối thiểu cấp buổi (OQ-47)
          const r = (c.ON_TIME + c.LATE) / taken;
          if (!U.gte((avg - r) * 100, p.gapPts)) return;
          out.push({
            scope: 'SESSION', entityIds: [s.id], sessionId: s.id, classId: cid, courseId: s.courseId, teacherId: s.teacherId, value: r,
            title: 'Buổi học có tỉ lệ có mặt bất thường',
            reason: 'Buổi ' + ctx.course(s.courseId) + ' lớp ' + ctx.cls(cid) + ' ngày ' + DT.fmtDate(s.start) + ' (' + DT.fmtTime(s.start) + ') có tỉ lệ có mặt ' + F.pct(r) +
              ' (' + (c.ON_TIME + c.LATE) + '/' + taken + '), thấp hơn trung bình lớp trong ' + wtxt(p.windowDays) + ' (' + F.pct(avg) + ') ' + F.pts(avg - r).replace(/^[+−±]/, '') + '.',
            suggestedAction: 'Kiểm tra buổi học có trùng sự kiện, đổi lịch hoặc thông báo chưa đến học sinh không.',
            drilldownUrl: 'class.html' + q({ classId: cid, tab: 'attendance', period: 'week', date: DT.dayKey(s.start) }),
            detectedAt: s.end
          });
        });
      });
      return out;
    }
  });

  rule({
    id: 'ATT-C05', group: 'ATT', scope: 'GROUP', name: 'Nhóm lớp có tỉ lệ có mặt thấp hơn TB trường ≥ X điểm %', classTab: 'attendance',
    paramsMeta: [{ key: 'gapPts', label: 'Chênh lệch', unit: 'điểm %' }, { key: 'windowDays', label: 'Trong', unit: 'ngày' }],
    evaluate: function (ctx, p) {
      const w = ctx.win(p.windowDays);
      const school = M.attendanceRates(M.attendanceCounts(ctx.D, {}, w[0], w[1])).present;
      const out = [];
      ctx.D.groups.forEach(function (g) {
        const c = M.attendanceCounts(ctx.D, { groupIds: [g.id] }, w[0], w[1]);
        if (!ctx.enough(c.taken, c.studentsWithData)) return;
        const r = M.attendanceRates(c).present;
        if (!U.gte((school - r) * 100, p.gapPts)) return;
        out.push({
          scope: 'GROUP', entityIds: [g.id], groupId: g.id, value: r,
          title: 'Nhóm lớp có chuyên cần thấp',
          reason: 'Nhóm "' + g.name + '" có tỉ lệ có mặt ' + F.pct(r) + ' trong ' + wtxt(p.windowDays) + ' (' + (c.ON_TIME + c.LATE) + '/' + c.taken +
            ' lượt), thấp hơn trung bình trường (' + F.pct(school) + ') ' + F.pts(school - r).replace(/^[+−±]/, '') + '.',
          suggestedAction: 'Xem xét yếu tố chung của nhóm lớp (khung giờ học, địa điểm, đối tượng học sinh).',
          drilldownUrl: 'attendance.html' + q({ period: 'week', date: DT.dayKey(ctx.now), groupId: g.id }),
          detectedAt: ctx.now
        });
      });
      return out;
    }
  });

  // ------------------------------------------------------------------ HW
  rule({
    id: 'HW-S01', group: 'HW', scope: 'STUDENT', name: 'Học sinh không hoàn thành ≥ X nhiệm vụ liên tiếp', classTab: 'homework', groupTitle: 'không hoàn thành nhiệm vụ liên tiếp',
    paramsMeta: [{ key: 'consecutive', label: 'Số nhiệm vụ liên tiếp', unit: 'nhiệm vụ' }, { key: 'windowDays', label: 'Trong', unit: 'ngày' }],
    evaluate: function (ctx, p) {
      const w = ctx.win(p.windowDays);
      const seq = new Map();
      M.tasksIn(ctx.D, {}, w[0], Math.min(w[1], ctx.now + 1)).forEach(function (t) {
        if (t.dueAt > ctx.now) return;
        M.forEachTaskStudent(ctx.D, t, null, function (sid, sub) {
          const k = sid + '|' + t.classId + '|' + t.courseId;
          let g = seq.get(k);
          if (!g) { g = { sid: sid, classId: t.classId, courseId: t.courseId, cur: 0, best: 0, det: null, missing: 0, total: 0 }; seq.set(k, g); }
          g.total++;
          if (!sub) { g.missing++; g.cur++; if (g.cur > g.best) { g.best = g.cur; if (g.cur === p.consecutive) g.det = t.dueAt; } } else g.cur = 0;
        });
      });
      const out = [];
      seq.forEach(function (g) {
        if (g.best < p.consecutive) return;
        out.push({
          scope: 'STUDENT', entityIds: [g.sid], studentId: g.sid, classId: g.classId, courseId: g.courseId, value: g.best, groupKey: g.classId,
          title: 'Không hoàn thành nhiệm vụ liên tiếp',
          reason: ctx.stu(g.sid) + ' không hoàn thành ' + g.best + ' nhiệm vụ liên tiếp môn ' + ctx.course(g.courseId) + ' (lớp ' + ctx.cls(g.classId) + '); ' +
            g.missing + '/' + g.total + ' nhiệm vụ đến hạn trong ' + wtxt(p.windowDays) + ' chưa nộp.',
          suggestedAction: 'Giáo viên bộ môn/GVCN trao đổi với học sinh; kiểm tra khó khăn về thiết bị, thời gian hoặc kiến thức.',
          drilldownUrl: 'student.html' + q({ studentId: g.sid }),
          detectedAt: g.det || ctx.now
        });
      });
      return out;
    }
  });

  rule({
    id: 'HW-S02', group: 'HW', scope: 'STUDENT', name: 'Học sinh không hoàn thành ≥ X% nhiệm vụ', classTab: 'homework', groupTitle: 'không hoàn thành nhiều nhiệm vụ',
    paramsMeta: [{ key: 'missingShare', label: 'Tỉ lệ không hoàn thành', unit: '%' }, { key: 'windowDays', label: 'Trong', unit: 'ngày' }, { key: 'minTasks', label: 'Số nhiệm vụ tối thiểu', unit: 'nhiệm vụ' }],
    evaluate: function (ctx, p) {
      const w = ctx.win(p.windowDays);
      const out = [];
      M.taskByStudent(ctx.D, {}, w[0], w[1]).forEach(function (g, sid) {
        if (g.overdue < p.minTasks) return;
        const r = g.MISSING / g.overdue;
        if (!U.gte(r * 100, p.missingShare)) return;
        const m = new Map();
        g.items.forEach(function (it) { if (it.status === 'MISSING') m.set(it.task.classId, (m.get(it.task.classId) || 0) + 1); });
        out.push({
          scope: 'STUDENT', entityIds: [sid], studentId: sid, classId: topKey(m), value: r,
          title: 'Không hoàn thành nhiều nhiệm vụ',
          reason: ctx.stu(sid) + ' không hoàn thành ' + g.MISSING + '/' + g.overdue + ' nhiệm vụ (' + F.pct(r) + ') đến hạn trong ' + wtxt(p.windowDays) + ', ngưỡng ' + p.missingShare + '%.',
          suggestedAction: 'Lập kế hoạch hỗ trợ học tập; trao đổi với phụ huynh.',
          drilldownUrl: 'student.html' + q({ studentId: sid }),
          detectedAt: ctx.now
        });
      });
      return out;
    }
  });

  rule({
    id: 'HW-S03', group: 'HW', scope: 'STUDENT', name: 'Điểm TB nhiệm vụ của học sinh giảm ≥ X điểm', classTab: 'homework', groupTitle: 'điểm nhiệm vụ giảm mạnh',
    paramsMeta: [{ key: 'dropPoints', label: 'Mức giảm (thang 10)', unit: 'điểm' }, { key: 'windowDays', label: 'Độ dài kỳ', unit: 'ngày' }, { key: 'minGraded', label: 'Số bài có điểm tối thiểu mỗi kỳ', unit: 'bài' }],
    evaluate: function (ctx, p) {
      const cw = ctx.win(p.windowDays), pw = ctx.win(p.windowDays, p.windowDays);
      const cur = M.taskByStudent(ctx.D, {}, cw[0], cw[1]);
      const prev = M.taskByStudent(ctx.D, {}, pw[0], pw[1]);
      const out = [];
      cur.forEach(function (g, sid) {
        const h = prev.get(sid);
        if (!h || g.graded < p.minGraded || h.graded < p.minGraded) return;
        const a = g.scoreSum / g.graded, b = h.scoreSum / h.graded;
        if (!U.gte(b - a, p.dropPoints)) return;
        out.push({
          scope: 'STUDENT', entityIds: [sid], studentId: sid, classId: Array.from(g.classes)[0], value: b - a,
          title: 'Điểm nhiệm vụ giảm mạnh',
          reason: 'Điểm TB nhiệm vụ của ' + ctx.stu(sid) + ' trong ' + wtxt(p.windowDays) + ' là ' + F.score(a) + ' (' + g.graded + ' bài), giảm ' +
            F.num(b - a, 1) + ' điểm so với ' + p.windowDays + ' ngày trước đó (' + F.score(b) + ', ' + h.graded + ' bài).',
          suggestedAction: 'Giáo viên bộ môn trao đổi với học sinh để phát hiện lỗ hổng kiến thức hoặc thay đổi hoàn cảnh.',
          drilldownUrl: 'student.html' + q({ studentId: sid }),
          detectedAt: ctx.now
        });
      });
      return out;
    }
  });

  rule({
    id: 'HW-C01', group: 'HW', scope: 'CLASS', name: 'Tỉ lệ nộp đúng hạn của lớp < X%', classTab: 'homework',
    paramsMeta: [{ key: 'threshold', label: 'Ngưỡng', unit: '%' }, { key: 'windowDays', label: 'Trong', unit: 'ngày' }],
    evaluate: function (ctx, p) {
      const w = ctx.win(p.windowDays);
      const school = M.taskRates(M.taskCounts(ctx.D, {}, w[0], w[1])).onTime;
      const out = [];
      ctx.activeClasses.forEach(function (cid) {
        const c = M.taskCounts(ctx.D, { classIds: [cid] }, w[0], w[1]);
        if (!ctx.enough(c.overdue, c.studentsWithData)) return;
        const r = M.taskRates(c).onTime;
        if (!U.lt(r * 100, p.threshold)) return;
        out.push({
          scope: 'CLASS', entityIds: [cid], classId: cid, value: r,
          title: 'Tỉ lệ nộp đúng hạn của lớp thấp',
          reason: 'Lớp ' + ctx.cls(cid) + ' có tỉ lệ nộp nhiệm vụ đúng hạn ' + F.pct(r) + ' trong ' + wtxt(p.windowDays) + ' (' + c.ON_TIME + '/' + c.overdue +
            ' lượt; muộn ' + c.LATE + ', không hoàn thành ' + c.MISSING + '), dưới ngưỡng ' + p.threshold + '% (trung bình trường ' + F.pct(school) + ').',
          suggestedAction: 'Trao đổi với giáo viên bộ môn về khối lượng và hạn nộp; kiểm tra nhóm học sinh không nộp.',
          drilldownUrl: 'class.html' + q({ classId: cid, tab: 'homework', period: 'week', date: DT.dayKey(ctx.now) }),
          detectedAt: ctx.now
        });
      });
      return out;
    }
  });

  rule({
    id: 'HW-C02', group: 'HW', scope: 'CLASS', name: 'Điểm TB nhiệm vụ của lớp thấp hơn TB các lớp cùng khóa ≥ X điểm', classTab: 'homework',
    paramsMeta: [{ key: 'gap', label: 'Chênh lệch (thang 10)', unit: 'điểm' }, { key: 'windowDays', label: 'Trong', unit: 'ngày' }],
    evaluate: function (ctx, p) {
      const w = ctx.win(p.windowDays);
      const out = [];
      ctx.D.courses.forEach(function (co) {
        const classes = M.courseClassIds(ctx.D, co.id, ctx.now);
        const counts = new Map(classes.map(function (c) { return [c, M.taskCounts(ctx.D, { classIds: [c], courseIds: [co.id] }, w[0], w[1])]; }));
        classes.forEach(function (cid) {
          const c = counts.get(cid);
          if (!ctx.enough(c.graded, c.studentsWithData)) return;
          let os = 0, on = 0;
          classes.forEach(function (x) { if (x !== cid) { os += counts.get(x).scoreSum; on += counts.get(x).graded; } });
          if (on < ctx.cfg.alerts.minDenominator) return;
          const a = c.scoreSum / c.graded, b = os / on;
          if (!U.gte(b - a, p.gap)) return;
          out.push({
            scope: 'CLASS', entityIds: [cid, co.id], classId: cid, courseId: co.id, value: b - a,
            title: 'Điểm nhiệm vụ của lớp thấp hơn các lớp cùng khóa',
            reason: 'Điểm TB nhiệm vụ ' + co.name + ' của lớp ' + ctx.cls(cid) + ' trong ' + wtxt(p.windowDays) + ' là ' + F.score(a) + ' (' + c.graded +
              ' bài), thấp hơn trung bình các lớp khác cùng khóa (' + F.score(b) + ', ' + on + ' bài) ' + F.num(b - a, 1) + ' điểm.',
            suggestedAction: 'Xem phân bố điểm và các nhiệm vụ điểm thấp của lớp; cần xem xét cùng giáo viên bộ môn trước khi kết luận.',
            drilldownUrl: 'class.html' + q({ classId: cid, tab: 'homework', courseId: co.id }),
            detectedAt: ctx.now
          });
        });
      });
      return out;
    }
  });

  rule({
    id: 'HW-T01', group: 'HW', scope: 'TASK', name: 'Nhiệm vụ có tỉ lệ nộp < X% hoặc điểm TB < Y → nghi vấn đề bài', classTab: 'homework',
    paramsMeta: [{ key: 'minSubmitRate', label: 'Tỉ lệ nộp tối thiểu', unit: '%' }, { key: 'minAvgScore', label: 'Điểm TB tối thiểu', unit: 'điểm' },
      { key: 'lookbackDays', label: 'Xét nhiệm vụ có hạn trong', unit: 'ngày' }, { key: 'minStudents', label: 'Số học sinh được giao tối thiểu', unit: 'học sinh' }],
    evaluate: function (ctx, p) {
      const out = [];
      M.tasksIn(ctx.D, {}, ctx.now - p.lookbackDays * DAY, ctx.now + 1).forEach(function (t) {
        if (t.dueAt > ctx.now) return;
        const st = M.taskStats(ctx.D, t);
        if (st.expected < p.minStudents) return;
        const lowRate = st.submitRate !== null && U.lt(st.submitRate * 100, p.minSubmitRate);
        const lowScore = st.avgScore !== null && st.graded >= 5 && U.lt(st.avgScore, p.minAvgScore);
        if (!lowRate && !lowScore) return;
        const why = [];
        if (lowRate) why.push('tỉ lệ nộp dưới ' + p.minSubmitRate + '%');
        if (lowScore) why.push('điểm TB dưới ' + F.num(p.minAvgScore, 1));
        out.push({
          scope: 'TASK', entityIds: [t.id], taskId: t.id, classId: t.classId, courseId: t.courseId, value: lowRate ? st.submitRate : st.avgScore,
          title: 'Nghi vấn đề bài nhiệm vụ',
          reason: 'Nhiệm vụ "' + t.title + '" (lớp ' + ctx.cls(t.classId) + ', hạn ' + DT.fmtDate(t.dueAt) + '): tỉ lệ nộp ' + F.pct(st.submitRate) + ' (' +
            (st.ON_TIME + st.LATE) + '/' + st.overdue + '), điểm TB ' + F.score(st.avgScore) + ' (' + st.graded + ' bài đã chấm) — ' + why.join(', ') + '.',
          suggestedAction: 'Rà soát đề bài, độ khó, hạn nộp và học liệu đi kèm; so sánh với cùng nhiệm vụ ở các lớp khác.',
          drilldownUrl: 'homework.html' + q({ period: 'month', date: DT.dayKey(t.dueAt), courseId: t.courseId }),
          detectedAt: t.dueAt
        });
      });
      return out;
    }
  });

  // ------------------------------------------------------------------ ONL
  function runningAssignments(ctx) {
    return ctx.D.onlineAssignments.filter(function (a) { return a.startAt <= ctx.now && ctx.now < a.dueAt; });
  }
  rule({
    id: 'ONL-S01', group: 'ONL', scope: 'STUDENT', name: 'Tiến độ học sinh thấp hơn kỳ vọng ≥ X điểm %', classTab: 'homework', groupTitle: 'chậm tiến độ khóa trực tuyến',
    paramsMeta: [{ key: 'gapPts', label: 'Chênh lệch', unit: 'điểm %' }],
    evaluate: function (ctx, p) {
      const out = [];
      runningAssignments(ctx).forEach(function (a) {
        const exp = M.expectedProgress(a, ctx.now);
        (ctx.D.idx.progByAssignment.get(a.id) || []).forEach(function (pr) {
          const cur = M.progressAt(pr, ctx.now) || 0;
          if (!U.gte((exp - cur) * 100, p.gapPts)) return;
          out.push({
            scope: 'STUDENT', entityIds: [pr.studentId, a.id], studentId: pr.studentId, classId: a.classId, courseId: a.courseId, contentKey: a.contentKey, value: exp - cur, groupKey: a.classId + '|' + a.id,
            title: 'Chậm tiến độ khóa trực tuyến',
            reason: ctx.stu(pr.studentId) + ' (lớp ' + ctx.cls(a.classId) + ') mới hoàn thành ' + F.pct(cur) + ' khóa "' + a.title + '" (' + M.completedItemsAt(pr, ctx.now) + '/' +
              pr.totalItems + ' mục), trong khi tiến độ kỳ vọng là ' + F.pct(exp) + ' (chậm ' + F.pts(exp - cur).replace(/^[+−±]/, '') + ').',
            suggestedAction: 'Nhắc học sinh và đặt mốc hoàn thành theo tuần.',
            drilldownUrl: 'class.html' + q({ classId: a.classId, tab: 'homework' }) + '#online',
            detectedAt: ctx.now
          });
        });
      });
      return out;
    }
  });

  rule({
    id: 'ONL-S02', group: 'ONL', scope: 'STUDENT', name: 'Điểm tổng hợp dự kiến < ngưỡng hoàn thành khi còn ≤ X% thời gian', classTab: 'homework', groupTitle: 'có nguy cơ không đạt khóa trực tuyến',
    paramsMeta: [{ key: 'remainingShare', label: 'Thời gian còn lại', unit: '%' }],
    evaluate: function (ctx, p) {
      const out = [];
      runningAssignments(ctx).forEach(function (a) {
        const exp = M.expectedProgress(a, ctx.now);
        if (!U.gte(p.remainingShare, (1 - exp) * 100)) return;
        const params = M.courseParams(ctx.D, a.courseId, ctx.cfg);
        (ctx.D.idx.progByAssignment.get(a.id) || []).forEach(function (pr) {
          const proj = M.projectedComposite(a, pr, ctx.now, params);
          if (!U.lt(proj, params.passThreshold)) return;
          out.push({
            scope: 'STUDENT', entityIds: [pr.studentId, a.id], studentId: pr.studentId, classId: a.classId, courseId: a.courseId, contentKey: a.contentKey, value: proj, groupKey: a.classId + '|' + a.id,
            title: 'Nguy cơ không đạt khóa trực tuyến',
            reason: 'Khóa "' + a.title + '" còn ' + F.pct(1 - exp) + ' thời gian (hạn ' + DT.fmtDate(a.dueAt) + '); điểm tổng hợp dự kiến của ' + ctx.stu(pr.studentId) +
              ' là ' + F.num(proj, 1) + '/100 (tiến độ ' + F.pct(M.progressAt(pr, ctx.now)) + ', điểm kiểm tra ' + (pr.testScore === null ? 'chưa có' : pr.testScore) +
              '), dưới ngưỡng hoàn thành ' + params.passThreshold + '.',
            suggestedAction: 'Hỗ trợ học sinh hoàn thành phần còn lại và làm bài kiểm tra trước hạn.',
            drilldownUrl: 'class.html' + q({ classId: a.classId, tab: 'homework' }) + '#online',
            detectedAt: ctx.now
          });
        });
      });
      return out;
    }
  });

  rule({
    id: 'ONL-S03', group: 'ONL', scope: 'STUDENT', name: 'Học sinh chưa bắt đầu khóa sau X ngày kể từ ngày giao', classTab: 'homework', groupTitle: 'chưa bắt đầu khóa trực tuyến',
    paramsMeta: [{ key: 'days', label: 'Số ngày kể từ ngày giao', unit: 'ngày' }],
    evaluate: function (ctx, p) {
      const out = [];
      runningAssignments(ctx).forEach(function (a) {
        if (a.startAt + p.days * DAY > ctx.now) return;
        (ctx.D.idx.progByAssignment.get(a.id) || []).forEach(function (pr) {
          if (M.completedItemsAt(pr, ctx.now) > 0) return;
          out.push({
            scope: 'STUDENT', entityIds: [pr.studentId, a.id], studentId: pr.studentId, classId: a.classId, courseId: a.courseId, contentKey: a.contentKey, groupKey: a.classId + '|' + a.id,
            title: 'Chưa bắt đầu khóa trực tuyến',
            reason: ctx.stu(pr.studentId) + ' (lớp ' + ctx.cls(a.classId) + ') chưa hoàn thành mục nào của khóa "' + a.title + '" sau ' +
              Math.floor((ctx.now - a.startAt) / DAY) + ' ngày kể từ ngày giao (' + DT.fmtDate(a.startAt) + ').',
            suggestedAction: 'Kiểm tra tài khoản/thiết bị của học sinh và nhắc bắt đầu học.',
            drilldownUrl: 'class.html' + q({ classId: a.classId, tab: 'homework' }) + '#online',
            detectedAt: a.startAt + p.days * DAY
          });
        });
      });
      return out;
    }
  });

  rule({
    id: 'ONL-C01', group: 'ONL', scope: 'CLASS', name: 'Tỉ lệ học sinh đúng tiến độ của lớp < X%', classTab: 'homework',
    paramsMeta: [{ key: 'threshold', label: 'Ngưỡng', unit: '%' }],
    evaluate: function (ctx, p) {
      const out = [];
      M.onlineRunning(ctx.D, {}, ctx.now, ctx.cfg).forEach(function (r) {
        if (r.n < ctx.cfg.alerts.minStudentsWithData) return;
        if (!U.lt(r.onTrackRate * 100, p.threshold)) return;
        const a = r.assignment;
        out.push({
          scope: 'CLASS', entityIds: [a.classId, a.id], classId: a.classId, courseId: a.courseId, contentKey: a.contentKey, value: r.onTrackRate,
          title: 'Lớp chậm tiến độ khóa trực tuyến',
          reason: 'Lớp ' + ctx.cls(a.classId) + ' chỉ có ' + r.onTrack + '/' + r.n + ' học sinh (' + F.pct(r.onTrackRate) + ') đúng tiến độ khóa "' + a.title +
            '" (tiến độ TB ' + F.pct(r.avgProgress) + ', kỳ vọng ' + F.pct(r.expected) + '), dưới ngưỡng ' + p.threshold + '%.',
          suggestedAction: 'Trao đổi với giáo viên về thời gian học trực tuyến của lớp; cân nhắc dành thời gian trên lớp để học cùng.',
          drilldownUrl: 'class.html' + q({ classId: a.classId, tab: 'homework' }) + '#online',
          detectedAt: ctx.now
        });
      });
      return out;
    }
  });

  rule({
    id: 'ONL-C02', group: 'ONL', scope: 'CLASS', name: 'Tỉ lệ hoàn thành đúng hạn thấp hơn TB các lớp khác cùng khóa ≥ X điểm %', classTab: 'homework',
    paramsMeta: [{ key: 'gapPts', label: 'Chênh lệch', unit: 'điểm %' }, { key: 'lookbackDays', label: 'Xét khóa có hạn trong', unit: 'ngày' }],
    evaluate: function (ctx, p) {
      const out = [];
      const closed = ctx.D.onlineAssignments.filter(function (a) { return a.dueAt <= ctx.now && a.dueAt >= ctx.now - p.lookbackDays * DAY; });
      U.groupBy(closed, function (a) { return a.contentKey; }).forEach(function (list) {
        const st = list.map(function (a) {
          let on = 0, n = 0;
          (ctx.D.idx.progByAssignment.get(a.id) || []).forEach(function (pr) { n++; if (M.onlineStatus(a, pr, ctx.now) === 'ON_TIME') on++; });
          return { a: a, on: on, n: n };
        });
        st.forEach(function (x) {
          if (x.n < ctx.cfg.alerts.minStudentsWithData) return;
          let on = 0, n = 0;
          st.forEach(function (y) { if (y !== x) { on += y.on; n += y.n; } });
          if (n < ctx.cfg.alerts.minDenominator) return;
          const rc = x.on / x.n, ro = on / n;
          if (!U.gte((ro - rc) * 100, p.gapPts)) return;
          out.push({
            scope: 'CLASS', entityIds: [x.a.classId, x.a.id], classId: x.a.classId, courseId: x.a.courseId, contentKey: x.a.contentKey, value: rc,
            title: 'Hoàn thành khóa trực tuyến đúng hạn thấp hơn các lớp khác',
            reason: 'Lớp ' + ctx.cls(x.a.classId) + ' hoàn thành đúng hạn khóa "' + x.a.title + '" (hạn ' + DT.fmtDate(x.a.dueAt) + ') ' + F.pct(rc) + ' (' + x.on + '/' + x.n +
              '), thấp hơn trung bình các lớp khác cùng khóa (' + F.pct(ro) + ') ' + F.pts(ro - rc).replace(/^[+−±]/, '') + '.',
            suggestedAction: 'Xem danh sách học sinh chưa hoàn thành; cần xem xét điều kiện học trực tuyến của lớp.',
            drilldownUrl: 'class.html' + q({ classId: x.a.classId, tab: 'homework' }) + '#online',
            detectedAt: x.a.dueAt
          });
        });
      });
      return out;
    }
  });

  // ------------------------------------------------------------------ LO
  function activeClassCourses(ctx) {
    const out = [];
    ctx.D.classCourses.forEach(function (cc) { if (cc.startAt <= ctx.now && ctx.now <= cc.endAt) out.push(cc); });
    return out;
  }

  rule({
    id: 'LO-S01', group: 'LO', scope: 'STUDENT', name: 'Học sinh có > X chuẩn đầu ra không đạt trong một khóa', classTab: 'learning', groupTitle: 'có nhiều chuẩn đầu ra không đạt',
    paramsMeta: [{ key: 'maxFailed', label: 'Số CĐR không đạt tối đa', unit: 'CĐR' }],
    evaluate: function (ctx, p) {
      const out = [];
      activeClassCourses(ctx).forEach(function (cc) {
        M.roster(ctx.D, cc.classId, ctx.now).forEach(function (sid) {
          const prof = M.studentLoProfile(ctx.D, sid, cc.classId, cc.courseId, ctx.cfg);
          if (prof.failed <= p.maxFailed) return;
          const list = prof.items.filter(function (x) { return x.level !== 'NO_DATA' && !x.pass; }).map(function (x) { return x.lo.code; });
          out.push({
            scope: 'STUDENT', entityIds: [sid, cc.courseId], studentId: sid, classId: cc.classId, courseId: cc.courseId, value: prof.failed, groupKey: cc.classId + '|' + cc.courseId,
            title: 'Nhiều chuẩn đầu ra không đạt',
            reason: ctx.stu(sid) + ' (lớp ' + ctx.cls(cc.classId) + ') có ' + prof.failed + ' chuẩn đầu ra ' + ctx.course(cc.courseId) + ' chưa đạt yêu cầu (' +
              list.join(', ') + '), vượt ngưỡng ' + p.maxFailed + '.',
            suggestedAction: 'Giáo viên bộ môn lập kế hoạch ôn tập theo chuẩn đầu ra; giao bài luyện tập bổ trợ.',
            drilldownUrl: 'class.html' + q({ classId: cc.classId, tab: 'learning', courseId: cc.courseId }),
            detectedAt: ctx.now
          });
        });
      });
      return out;
    }
  });

  rule({
    id: 'LO-S02', group: 'LO', scope: 'STUDENT', name: 'Học sinh hoàn thành ≥ X% bài tập nhưng ≥ Y chuẩn đầu ra Chưa tốt', classTab: 'learning', groupTitle: 'chăm làm bài nhưng chuẩn đầu ra chưa tốt',
    paramsMeta: [{ key: 'minCompletion', label: 'Tỉ lệ nộp nhiệm vụ tối thiểu', unit: '%' }, { key: 'minPoor', label: 'Số CĐR Chưa tốt', unit: 'CĐR' }, { key: 'minTasks', label: 'Số nhiệm vụ tối thiểu', unit: 'nhiệm vụ' }],
    evaluate: function (ctx, p) {
      const out = [];
      activeClassCourses(ctx).forEach(function (cc) {
        const byStu = M.taskByStudent(ctx.D, { classIds: [cc.classId], courseIds: [cc.courseId] }, cc.startAt, ctx.now + 1);
        M.roster(ctx.D, cc.classId, ctx.now).forEach(function (sid) {
          const g = byStu.get(sid);
          if (!g || g.overdue < p.minTasks) return;
          const comp = (g.ON_TIME + g.LATE) / g.overdue;
          if (!U.gte(comp * 100, p.minCompletion)) return;
          const prof = M.studentLoProfile(ctx.D, sid, cc.classId, cc.courseId, ctx.cfg);
          if (prof.poor < p.minPoor) return;
          const list = prof.items.filter(function (x) { return x.level === 'POOR'; }).map(function (x) { return x.lo.code; });
          out.push({
            scope: 'STUDENT', entityIds: [sid, cc.courseId], studentId: sid, classId: cc.classId, courseId: cc.courseId, groupKey: cc.classId + '|' + cc.courseId,
            title: 'Chăm làm bài nhưng chuẩn đầu ra chưa tốt',
            reason: ctx.stu(sid) + ' (lớp ' + ctx.cls(cc.classId) + ') nộp ' + F.pct(comp) + ' nhiệm vụ ' + ctx.course(cc.courseId) + ' (' + (g.ON_TIME + g.LATE) + '/' + g.overdue +
              ') nhưng có ' + prof.poor + ' chuẩn đầu ra ở mức Chưa tốt (' + list.join(', ') + ').',
            suggestedAction: 'Kiểm tra cách học (làm cho đủ hay hiểu bài); giáo viên phản hồi chi tiết các lỗi sai thường gặp.',
            drilldownUrl: 'student.html' + q({ studentId: sid }),
            detectedAt: ctx.now
          });
        });
      });
      return out;
    }
  });

  rule({
    id: 'LO-C01', group: 'LO', scope: 'LO', name: 'Chuẩn đầu ra Đỏ ở một lớp', classTab: 'learning',
    paramsMeta: [],
    evaluate: function (ctx) {
      const out = [];
      ctx.D.courses.forEach(function (co) {
        const mx = M.loMatrix(ctx.D, co.id, null, ctx.cfg, ctx.now);
        mx.classIds.forEach(function (cid) {
          mx.los.forEach(function (lo) {
            const s = mx.cells.get(cid + '|' + lo.id);
            if (s.color !== 'RED' || s.withData < ctx.cfg.alerts.minStudentsWithData) return;
            out.push({
              scope: 'LO', entityIds: [cid, lo.id], classId: cid, courseId: co.id, loId: lo.id, value: s.passRate,
              title: 'Chuẩn đầu ra ở trạng thái Đỏ tại lớp',
              reason: 'Chuẩn đầu ra ' + ctx.lo(lo.id) + ' (' + co.name + ') ở lớp ' + ctx.cls(cid) + ': tỉ lệ đạt ' + F.pct(s.passRate) + ' (' + s.pass + '/' + s.withData +
                ' học sinh có dữ liệu, coverage ' + F.pct(s.coverage) + ', ' + s.evidence + ' câu hỏi đã làm), dưới ngưỡng ' + ctx.cfg.lo.color.orange + '%.',
              suggestedAction: 'Xem danh sách học sinh chưa đạt; đối chiếu với các lớp khác cùng khóa để xác định nguyên nhân.',
              drilldownUrl: 'course-detail.html' + q({ courseId: co.id, classId: cid, loId: lo.id }),
              detectedAt: ctx.now
            });
          });
        });
      });
      return out;
    }
  });

  rule({
    id: 'LO-C02', group: 'LO', scope: 'CLASS', name: 'Lớp có ≥ X% chuẩn đầu ra của khóa ở trạng thái Đỏ', classTab: 'learning',
    paramsMeta: [{ key: 'redShare', label: 'Tỉ lệ CĐR Đỏ', unit: '%' }],
    evaluate: function (ctx, p) {
      const out = [];
      ctx.D.courses.forEach(function (co) {
        const mx = M.loMatrix(ctx.D, co.id, null, ctx.cfg, ctx.now);
        mx.classIds.forEach(function (cid) {
          const cells = mx.los.map(function (lo) { return mx.cells.get(cid + '|' + lo.id); });
          const maxData = Math.max.apply(null, cells.map(function (s) { return s.withData; }).concat([0]));
          if (maxData < ctx.cfg.alerts.minStudentsWithData) return;
          const red = cells.filter(function (s) { return s.color === 'RED'; });
          if (!mx.los.length || !U.gte(red.length / mx.los.length * 100, p.redShare)) return;
          out.push({
            scope: 'CLASS', entityIds: [cid, co.id], classId: cid, courseId: co.id, value: red.length / mx.los.length,
            title: 'Lớp có nhiều chuẩn đầu ra Đỏ',
            reason: 'Lớp ' + ctx.cls(cid) + ' có ' + red.length + '/' + mx.los.length + ' chuẩn đầu ra ' + co.name + ' (' + F.pct(red.length / mx.los.length) + ') ở trạng thái Đỏ: ' +
              red.map(function (s) { return ctx.D.loById.get(s.loId).code; }).join(', ') + '; ngưỡng ' + p.redShare + '%.',
            suggestedAction: 'Rà soát tiến độ giảng dạy và kết quả đánh giá của lớp; cần xem xét tại lớp học trước khi kết luận.',
            drilldownUrl: 'class.html' + q({ classId: cid, tab: 'learning', courseId: co.id }),
            detectedAt: ctx.now
          });
        });
      });
      return out;
    }
  });

  rule({
    id: 'LO-C03', group: 'LO', scope: 'CLASS', name: '"Nghi vấn ở lớp học" theo mục 3.6', classTab: 'learning',
    paramsMeta: [],
    evaluate: function (ctx) {
      const out = [];
      ctx.D.courses.forEach(function (co) {
        const ca = M.causeAnalysis(ctx.D, co.id, ctx.cfg, ctx.now);
        ca.matrix.classIds.forEach(function (cid) {
          const hits = ca.matrix.los.filter(function (lo) { return ca.classLabel.get(cid + '|' + lo.id).label === 'CLASS'; });
          if (!hits.length) return;
          out.push({
            scope: 'CLASS', entityIds: [cid, co.id], classId: cid, courseId: co.id, loIds: hits.map(function (l) { return l.id; }), value: hits.length,
            title: 'Nghi vấn ở lớp học — cần xem xét',
            reason: 'Lớp ' + ctx.cls(cid) + ' có ' + hits.length + ' chuẩn đầu ra ' + co.name + ' thấp hơn hẳn các lớp khác cùng khóa: ' + hits.map(function (lo) {
              const s = ca.matrix.cells.get(cid + '|' + lo.id), l = ca.classLabel.get(cid + '|' + lo.id);
              return lo.code + ' (' + F.pct(s.passRate, 0) + ' so với trung vị ' + F.pct(l.median, 0) + ')';
            }).join('; ') + '. Các lớp khác học cùng chương trình đạt tốt.',
            suggestedAction: 'Dự giờ, trao đổi với giáo viên và học sinh của lớp; đối chiếu số buổi đã học và đầu vào học sinh trước khi kết luận.',
            drilldownUrl: 'course-detail.html' + q({ courseId: co.id, classId: cid }),
            detectedAt: ctx.now
          });
        });
      });
      return out;
    }
  });

  // ------------------------------------------------------------------ CUR
  rule({
    id: 'CUR-01', group: 'CUR', scope: 'LO', name: '"Nghi vấn chương trình" theo mục 3.6 (Đỏ ở ≥ X% số lớp)', classTab: 'learning',
    paramsMeta: [],
    evaluate: function (ctx) {
      const out = [];
      ctx.D.courses.forEach(function (co) {
        const ca = M.causeAnalysis(ctx.D, co.id, ctx.cfg, ctx.now);
        ca.matrix.los.forEach(function (lo) {
          const c = ca.curriculum.get(lo.id);
          if (c.label !== 'CURRICULUM') return;
          const tot = ca.matrix.loTotals.get(lo.id);
          out.push({
            scope: 'LO', entityIds: [lo.id], courseId: co.id, loId: lo.id, value: c.share,
            title: 'Nghi vấn chương trình / học liệu / đề đánh giá',
            reason: 'Chuẩn đầu ra ' + ctx.lo(lo.id) + ' (' + co.name + ') ở trạng thái Đỏ tại ' + c.redClasses.length + '/' + c.eligibleClasses.length + ' lớp đủ dữ liệu (' +
              F.pct(c.share, 0) + ', ngưỡng ' + ctx.cfg.cause.curriculumRedShare + '%): ' + c.redClasses.map(ctx.cls).join(', ') + '. Tỉ lệ đạt toàn trường ' + F.pct(tot.passRate) + '.',
            suggestedAction: 'Rà soát học liệu, phân phối chương trình và câu hỏi đánh giá của chuẩn đầu ra này cùng tổ bộ môn.',
            drilldownUrl: 'course-detail.html' + q({ courseId: co.id, loId: lo.id }),
            detectedAt: ctx.now
          });
        });
      });
      return out;
    }
  });

  rule({
    id: 'CUR-02', group: 'CUR', scope: 'LO', name: 'Chuẩn đầu ra có tỉ lệ đạt toàn trường < X%', classTab: 'learning',
    paramsMeta: [{ key: 'threshold', label: 'Ngưỡng', unit: '%' }, { key: 'minStudents', label: 'Số học sinh có dữ liệu tối thiểu', unit: 'học sinh' }],
    evaluate: function (ctx, p) {
      const out = [];
      ctx.D.courses.forEach(function (co) {
        const mx = M.loMatrix(ctx.D, co.id, null, ctx.cfg, ctx.now);
        mx.los.forEach(function (lo) {
          const s = mx.loTotals.get(lo.id);
          if (s.withData < p.minStudents || !U.lt(s.passRate * 100, p.threshold)) return;
          out.push({
            scope: 'LO', entityIds: [lo.id], courseId: co.id, loId: lo.id, value: s.passRate,
            title: 'Tỉ lệ đạt toàn trường thấp',
            reason: 'Chuẩn đầu ra ' + ctx.lo(lo.id) + ' (' + co.name + ') có tỉ lệ đạt toàn trường ' + F.pct(s.passRate) + ' (' + s.pass + '/' + s.withData +
              ' học sinh có dữ liệu tại ' + mx.classIds.length + ' lớp), dưới ngưỡng ' + p.threshold + '%.',
            suggestedAction: 'So sánh giữa các lớp để phân biệt vấn đề diện rộng với vấn đề ở một vài lớp.',
            drilldownUrl: 'course-detail.html' + q({ courseId: co.id, loId: lo.id }),
            detectedAt: ctx.now
          });
        });
      });
      return out;
    }
  });

  rule({
    id: 'CUR-03', group: 'CUR', scope: 'LO', name: 'Câu hỏi có tỉ lệ đúng < X% trên ≥ Y lớp → nghi vấn câu hỏi', classTab: 'learning',
    paramsMeta: [{ key: 'maxCorrect', label: 'Tỉ lệ đúng tối đa', unit: '%' }, { key: 'minClasses', label: 'Số lớp tối thiểu', unit: 'lớp' }, { key: 'minAttemptsPerClass', label: 'Số lượt tối thiểu mỗi lớp', unit: 'lượt' }],
    evaluate: function (ctx, p) {
      const out = [];
      ctx.D.courses.forEach(function (co) {
        const classes = M.courseClassIds(ctx.D, co.id, ctx.now);
        (ctx.D.idx.losByCourse.get(co.id) || []).forEach(function (lo) {
          M.questionStats(ctx.D, lo.id, classes).forEach(function (x) {
            const low = [];
            x.byClass.forEach(function (g, cid) { if (g.n >= p.minAttemptsPerClass && U.lt(g.rate * 100, p.maxCorrect)) low.push(cid); });
            if (low.length < p.minClasses) return;
            out.push({
              scope: 'LO', entityIds: [x.question.id], courseId: co.id, loId: lo.id, questionId: x.question.id, value: x.rate,
              title: 'Nghi vấn câu hỏi đánh giá',
              reason: x.question.code + ' của chuẩn đầu ra ' + ctx.D.loById.get(lo.id).code + ' (' + co.name + ') có tỉ lệ trả lời đúng ' + F.pct(x.rate) + ' (' + x.correct + '/' +
                x.attempts + ' lượt), dưới ' + p.maxCorrect + '% ở ' + low.length + ' lớp (' + low.sort().map(ctx.cls).join(', ') + '). Có thể sai đáp án, quá khó hoặc lệch chuẩn đầu ra.',
              suggestedAction: 'Kiểm tra đáp án, độ khó và mức độ khớp với chuẩn đầu ra của câu hỏi; loại khỏi tính điểm nếu sai.',
              drilldownUrl: 'course-detail.html' + q({ courseId: co.id, loId: lo.id }) + '#questions',
              detectedAt: ctx.now
            });
          });
        });
      });
      return out;
    }
  });

  // ------------------------------------------------------------------ DATA
  rule({
    id: 'DATA-01', group: 'DATA', scope: 'LO', name: 'Chuẩn đầu ra có coverage < X% khi khóa đã qua ≥ Y% thời lượng', classTab: 'learning',
    paramsMeta: [{ key: 'coverage', label: 'Coverage', unit: '%' }, { key: 'elapsed', label: 'Thời lượng đã qua', unit: '%' }],
    evaluate: function (ctx, p) {
      const out = [];
      ctx.D.courses.forEach(function (co) {
        const el = M.courseElapsed(ctx.D, co.id, ctx.now);
        if (el === null || !U.gte(el * 100, p.elapsed)) return;
        const mx = M.loMatrix(ctx.D, co.id, null, ctx.cfg, ctx.now);
        mx.los.forEach(function (lo) {
          const s = mx.loTotals.get(lo.id);
          if (!(s.withData > 0) || !U.lt(s.coverage * 100, p.coverage)) return;   // coverage = 0 thuộc DATA-02
          out.push({
            scope: 'LO', entityIds: [lo.id], courseId: co.id, loId: lo.id, value: s.coverage,
            title: 'Chuẩn đầu ra dữ liệu mỏng',
            reason: 'Chuẩn đầu ra ' + ctx.lo(lo.id) + ' (' + co.name + ') mới có dữ liệu của ' + s.withData + '/' + s.enrolled + ' học sinh (coverage ' + F.pct(s.coverage) +
              ') khi khóa đã qua ' + F.pct(el, 0) + ' thời lượng; ngưỡng ' + p.coverage + '%.',
            suggestedAction: 'Bổ sung câu hỏi/nhiệm vụ đánh giá cho chuẩn đầu ra này trước khi dùng kết quả để kết luận.',
            drilldownUrl: 'course-detail.html' + q({ courseId: co.id, loId: lo.id }),
            detectedAt: ctx.now
          });
        });
      });
      return out;
    }
  });

  rule({
    id: 'DATA-02', group: 'DATA', scope: 'LO', name: 'Chuẩn đầu ra Xám (chưa có dữ liệu) khi khóa đã qua ≥ X% thời lượng', classTab: 'learning',
    paramsMeta: [{ key: 'elapsed', label: 'Thời lượng đã qua', unit: '%' }],
    evaluate: function (ctx, p) {
      const out = [];
      ctx.D.courses.forEach(function (co) {
        const el = M.courseElapsed(ctx.D, co.id, ctx.now);
        if (el === null || !U.gte(el * 100, p.elapsed)) return;
        const mx = M.loMatrix(ctx.D, co.id, null, ctx.cfg, ctx.now);
        mx.los.forEach(function (lo) {
          const s = mx.loTotals.get(lo.id);
          if (s.withData > 0) return;
          out.push({
            scope: 'LO', entityIds: [lo.id], courseId: co.id, loId: lo.id,
            title: 'Chuẩn đầu ra chưa có dữ liệu',
            reason: 'Chuẩn đầu ra ' + ctx.lo(lo.id) + ' (' + co.name + ') chưa có dữ liệu đánh giá ở ' + mx.classIds.length + ' lớp khi khóa đã qua ' + F.pct(el, 0) +
              ' thời lượng (ngưỡng ' + p.elapsed + '%).',
            suggestedAction: 'Kiểm tra chuẩn đầu ra đã được gắn câu hỏi đánh giá chưa; cập nhật phân phối chương trình.',
            drilldownUrl: 'course-detail.html' + q({ courseId: co.id, loId: lo.id }),
            detectedAt: ctx.now
          });
        });
      });
      return out;
    }
  });

  rule({
    id: 'DATA-03', group: 'DATA', scope: 'CLASS', name: 'Lớp đang hoạt động không có buổi học nào trong X ngày', classTab: 'overview',
    paramsMeta: [{ key: 'days', label: 'Số ngày', unit: 'ngày' }],
    evaluate: function (ctx, p) {
      const out = [];
      ctx.activeClasses.forEach(function (cid) {
        const n = M.sessionsIn(ctx.D, { classIds: [cid] }, ctx.now - p.days * DAY, ctx.now + 1).length;
        if (n > 0) return;
        const past = (ctx.D.idx.sessionsByClass.get(cid) || []).filter(function (s) { return s.start <= ctx.now; });
        const last = past.length ? past[past.length - 1].start : null;
        out.push({
          scope: 'CLASS', entityIds: [cid], classId: cid,
          title: 'Lớp đang hoạt động nhưng không có buổi học',
          reason: 'Lớp ' + ctx.cls(cid) + ' đang trong thời gian khóa học nhưng không có buổi học nào trong ' + wtxt(p.days) +
            (last ? ' (buổi gần nhất: ' + DT.fmtDate(last) + ')' : '') + '.',
          suggestedAction: 'Xác nhận lớp tạm dừng hay lịch học chưa được cập nhật trên hệ thống.',
          drilldownUrl: 'schedule.html' + q({ period: 'month', date: DT.dayKey(ctx.now), classId: cid }),
          detectedAt: ctx.now
        });
      });
      return out;
    }
  });

  A.RULES = R;
  A.ruleById = new Map(R.map(function (r) { return [r.id, r]; }));

  // =====================================================================================
  // Engine
  // =====================================================================================
  /**
   * Gộp cảnh báo học sinh: ≥ groupMinStudents học sinh cùng lớp (cùng groupKey) vi phạm cùng rule
   * → 1 cảnh báo cấp lớp, children = danh sách học sinh.
   */
  A.groupStudents = function (ctx, ruleDef, cands) {
    const min = ctx.cfg.alerts.groupMinStudents;
    const out = [];
    U.groupBy(cands, function (c) { return c.groupKey || c.classId || '_'; }).forEach(function (arr) {
      const cid = arr[0].classId;
      if (!cid || arr.length < min) { Array.prototype.push.apply(out, arr); return; }
      arr.sort(function (a, b) { return (b.value || 0) - (a.value || 0); });
      out.push({
        ruleId: ruleDef.id, scope: 'CLASS', grouped: true,
        entityIds: [cid].concat(arr[0].groupKey && arr[0].groupKey !== cid ? [arr[0].groupKey.split('|')[1]] : []),
        classId: cid, courseId: arr[0].courseId, contentKey: arr[0].contentKey,
        children: arr,
        title: arr.length + ' học sinh lớp ' + ctx.cls(cid) + ' ' + (ruleDef.groupTitle || ruleDef.name.toLowerCase()),
        reason: arr.length + ' học sinh lớp ' + ctx.cls(cid) + ' cùng vi phạm quy tắc "' + ruleDef.name + '". Trường hợp nặng nhất: ' + arr[0].reason,
        suggestedAction: 'Tìm nguyên nhân chung ở cấp lớp trước; sau đó xử lý từng học sinh trong danh sách.',
        drilldownUrl: 'class.html' + q({ classId: cid, tab: ruleDef.classTab || 'overview', courseId: arr[0].courseId }) + (ruleDef.group === 'ONL' ? '#online' : ''),
        detectedAt: Math.max.apply(null, arr.map(function (a) { return a.detectedAt; }))
      });
    });
    return out;
  };

  function finalize(ctx, a, ruleDef, rc) {
    a.ruleId = ruleDef.id;
    a.group = ruleDef.group;
    a.severity = rc.severity || 'MEDIUM';
    a.key = a.ruleId + '|' + a.scope + '|' + a.entityIds.join(',');
    a.id = a.key;
    if (!a.groupId && a.classId) { const c = ctx.D.classById.get(a.classId); if (c) a.groupId = c.groupId; }
    if (a.children) a.children.forEach(function (ch) { ch.ruleId = a.ruleId; ch.group = a.group; ch.severity = a.severity; ch.key = ch.ruleId + '|' + ch.scope + '|' + ch.entityIds.join(','); });
    a.status = 'NEW';
    return a;
  }

  /**
   * Chạy toàn bộ rule đang bật. Kết quả cache theo phiên bản cấu hình.
   * @returns {{alerts: Array, stats: Object<ruleId,{enabled,count,ms}>, ms: number}}
   */
  A.run = function (D, cfg) {
    cfg = cfg || GT.config.get();
    return M._memo('alerts', D, [], cfg, function () {
      const t0 = performance.now();
      const ctx = makeCtx(D, cfg);
      const all = [], stats = {};
      R.forEach(function (rd) {
        const rc = cfg.alerts.rules[rd.id] || {};
        if (rc.enabled === false) { stats[rd.id] = { enabled: false, count: 0, ms: 0 }; return; }
        const t1 = performance.now();
        const defaults = (GT.config.DEFAULTS.alerts.rules[rd.id] || {}).params || {};
        const p = Object.assign({}, defaults, rc.params || {});
        let cands = rd.evaluate(ctx, p) || [];
        if (rd.scope === 'STUDENT') cands = A.groupStudents(ctx, rd, cands);
        cands.forEach(function (c) { finalize(ctx, c, rd, rc); });
        stats[rd.id] = { enabled: true, count: cands.length, ms: performance.now() - t1 };
        Array.prototype.push.apply(all, cands);
      });
      A.sort(all);
      return { alerts: all, stats: stats, ms: performance.now() - t0 };
    });
  };

  A.makeCtx = makeCtx;
  /** Chạy riêng một rule (dùng trong tests.html): trả về ứng viên đã gộp + finalize. */
  A.runRule = function (D, cfg, ruleId) {
    const rd = A.ruleById.get(ruleId);
    const rc = cfg.alerts.rules[ruleId] || {};
    const ctx = makeCtx(D, cfg);
    const p = Object.assign({}, (GT.config.DEFAULTS.alerts.rules[ruleId] || {}).params || {}, rc.params || {});
    let cands = rd.evaluate(ctx, p) || [];
    if (rd.scope === 'STUDENT') cands = A.groupStudents(ctx, rd, cands);
    cands.forEach(function (c) { finalize(ctx, c, rd, rc); });
    return cands;
  };

  A.sort = function (arr) {
    arr.sort(function (a, b) {
      return A.SEVERITY[a.severity].order - A.SEVERITY[b.severity].order || b.detectedAt - a.detectedAt || (a.key < b.key ? -1 : 1);
    });
    return arr;
  };

  /**
   * Chống trùng (pure). history: { key → {status, detectedAt, handledAtSim} }.
   *  - Cùng khóa, cảnh báo cũ CHƯA xử lý (NEW/IN_PROGRESS) và phát hiện mới cách < days ngày → không sinh mới
   *    (giữ detectedAt và trạng thái cũ, merged = true).
   *  - Cảnh báo cũ chưa xử lý nhưng đã quá days ngày → sinh lần mới (reRaised = true, trạng thái NEW).
   *  - Cảnh báo cũ đã xử lý/bỏ qua: chỉ sinh lần mới nếu điều kiện được phát hiện SAU thời điểm xử lý.
   * @returns {{alerts: Array, suppressed: number}}
   */
  A.dedupe = function (candidates, history, days) {
    const out = [];
    let suppressed = 0;
    candidates.forEach(function (c) {
      const h = history && history[c.key];
      const a = Object.assign({}, c);
      if (!h) { a.status = 'NEW'; out.push(a); return; }
      if (h.status === 'NEW' || h.status === 'IN_PROGRESS' || !h.status) {
        if (h.detectedAt !== undefined && c.detectedAt - h.detectedAt < days * DAY) {
          a.detectedAt = Math.min(h.detectedAt, c.detectedAt);
          a.status = h.status || 'NEW';
          a.merged = true;
          suppressed++;
        } else { a.status = 'NEW'; a.reRaised = true; }
      } else if (h.handledAtSim !== undefined && c.detectedAt > h.handledAtSim) {
        a.status = 'NEW'; a.reRaised = true;
      } else {
        a.status = h.status;
      }
      a.note = h.note || '';
      a.handler = h.handler || '';
      a.updatedAt = h.updatedAt || null;
      out.push(a);
    });
    return { alerts: out, suppressed: suppressed };
  };

  // ---- Lưu trạng thái xử lý (localStorage) ----
  A.store = {
    all: function () { return GT.store.get(STATE_KEY, {}) || {}; },
    get: function (key) { return A.store.all()[key] || null; },
    set: function (alert, patch, simNow) {
      const all = A.store.all();
      const cur = all[alert.key] || { detectedAt: alert.detectedAt };
      Object.assign(cur, patch);
      cur.updatedAt = Date.now();
      if (patch.status === 'RESOLVED' || patch.status === 'IGNORED') cur.handledAtSim = simNow;
      all[alert.key] = cur;
      return GT.store.set(STATE_KEY, all);
    },
    clear: function () { GT.store.remove(STATE_KEY); }
  };

  /** Danh sách cảnh báo hiệu lực = engine (cache) + chống trùng với trạng thái đã lưu. */
  A.list = function (D, cfg) {
    const res = A.run(D, cfg);
    return A.dedupe(res.alerts, A.store.all(), (cfg || GT.config.get()).alerts.dedupeDays).alerts;
  };

  /** Lọc cảnh báo theo filter trang. f = {groups:[], ruleIds:[], classIds:[], groupId, courseId, studentId, teacherId, statuses:[], open:boolean} */
  A.filter = function (alerts, f) {
    f = f || {};
    return alerts.filter(function (a) {
      if (f.groups && f.groups.indexOf(a.group) < 0) return false;
      if (f.displayGroup && A.displayGroupOf(a) !== f.displayGroup) return false;
      if (f.severity && a.severity !== f.severity) return false;
      if (f.ruleIds && f.ruleIds.indexOf(a.ruleId) < 0) return false;
      if (f.classIds && f.classIds.length && f.classIds.indexOf(a.classId) < 0 &&
        !(a.children && a.children.some(function (c) { return f.classIds.indexOf(c.classId) >= 0; }))) return false;
      if (f.groupId && a.groupId !== f.groupId) return false;
      if (f.courseId && a.courseId && a.courseId !== f.courseId) return false;
      if (f.courseId && !a.courseId && f.strictCourse) return false;
      if (f.studentId && a.studentId !== f.studentId && !(a.children && a.children.some(function (c) { return c.studentId === f.studentId; }))) return false;
      if (f.teacherId && a.teacherId !== f.teacherId) return false;
      if (f.statuses && f.statuses.indexOf(a.status) < 0) return false;
      if (f.open && (a.status === 'RESOLVED' || a.status === 'IGNORED')) return false;
      return true;
    });
  };

  A.countBySeverity = function (alerts) {
    const c = { HIGH: 0, MEDIUM: 0, LOW: 0, total: alerts.length };
    alerts.forEach(function (a) { c[a.severity]++; });
    return c;
  };

  // =====================================================================================
  // Đối chiếu kịch bản → rule (GT.debug)
  // =====================================================================================
  function matches(a, exp) {
    return Object.keys(exp).every(function (k) {
      if (k === 'rule') return true;
      const v = exp[k];
      if (a[k] === v) return true;
      if (k === 'loId' && a.loIds && a.loIds.indexOf(v) >= 0) return true;
      if (a.entityIds && a.entityIds.indexOf(v) >= 0) return true;
      if (a.children && a.children.some(function (ch) { return matches(ch, exp); })) return true;
      return false;
    });
  }
  A.matches = matches;

  /** Bảng đối chiếu kịch bản mock → rule kích hoạt. */
  A.scenarioReport = function (D, alerts) {
    const rows = [];
    (D.scenarios || []).forEach(function (sc) {
      if (!sc.expect.length && !sc.forbid) rows.push({ 'Kịch bản': sc.id, 'Mô tả': sc.title, 'Rule': '(kiểm tra trực quan)', 'Số cảnh báo khớp': '', 'Kết quả': '–' });
      sc.expect.forEach(function (e) {
        const n = alerts.filter(function (a) { return a.ruleId === e.rule && matches(a, e); }).length;
        rows.push({ 'Kịch bản': sc.id, 'Mô tả': sc.title, 'Rule': e.rule, 'Số cảnh báo khớp': n, 'Kết quả': n > 0 ? '✓' : '✕' });
      });
      (sc.forbid || []).forEach(function (fb) {
        const n = alerts.filter(function (a) { return a.classId === fb.classId && fb.scopes.indexOf(a.scope) >= 0 && !a.grouped && (!fb.rules || fb.rules.indexOf(a.ruleId) >= 0); }).length;
        rows.push({ 'Kịch bản': sc.id, 'Mô tả': sc.title, 'Rule': 'không có cảnh báo ' + fb.scopes.join('/') + ' cho ' + fb.classId, 'Số cảnh báo khớp': n, 'Kết quả': n === 0 ? '✓' : '✕' });
      });
    });
    return rows;
  };

  A.debugPrint = function (D, cfg) {
    const res = A.run(D, cfg);
    const rows = A.scenarioReport(D, res.alerts);
    /* eslint-disable no-console */
    console.groupCollapsed('[GT.debug] Đối chiếu kịch bản → rule (' + res.alerts.length + ' cảnh báo, ' + res.ms.toFixed(0) + ' ms)');
    console.table(rows);
    console.table(R.map(function (r) { const s = res.stats[r.id]; return { Rule: r.id, 'Bật': s.enabled ? 'có' : 'tắt', 'Số cảnh báo': s.count, 'ms': +s.ms.toFixed(1) }; }));
    console.groupEnd();
    /* eslint-enable no-console */
    return rows;
  };
})(window.GT);
