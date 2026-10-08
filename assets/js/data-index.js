/**
 * GenieTeach — Báo cáo Học vụ (prototype)
 * data-index.js — Build index MỘT LẦN khi load (theo classId, courseId, studentId, ngày, sessionId, …).
 *
 * GT.data.build(raw) nhận bất kỳ bộ bản ghi thô nào (mock hoặc dữ liệu kiểm thử trong tests.html)
 * và trả về đối tượng D = raw + byId + idx. Các trường dẫn xuất gắn vào bản ghi có tiền tố "_"
 * (ví dụ AttendanceRecord._start = Session.start) — chỉ phục vụ truy vấn nhanh, không phải dữ liệu nguồn.
 *
 * GT.data.load() sinh mock theo config (school.seed/today/now), build index, đo thời gian và cache vào GT.D.
 */
window.GT = window.GT || {};
(function (GT) {
  'use strict';
  const U = GT.util;
  const DT = GT.date;

  function byId(arr) {
    const m = new Map();
    for (let i = 0; i < arr.length; i++) m.set(arr[i].id, arr[i]);
    return m;
  }
  function push(map, key, val) {
    let a = map.get(key);
    if (!a) { a = []; map.set(key, a); }
    a.push(val);
  }
  function sortBy(map, key) {
    map.forEach(function (arr) { arr.sort(function (a, b) { return a[key] - b[key]; }); });
  }

  function build(raw) {
    const D = Object.assign({}, raw);
    D.meta = raw.meta || {};
    ['groups', 'classes', 'students', 'enrollments', 'teachers', 'courses', 'classCourses', 'los', 'questions', 'sessions',
      'attendance', 'tasks', 'submissions', 'onlineAssignments', 'onlineProgress', 'attempts', 'loAchievements', 'loSnapshots', 'scenarios']
      .forEach(function (k) { D[k] = raw[k] || []; });
    raw = D;
    const idx = D.idx = {};

    // ---- Danh mục ----
    D.groupById = byId(raw.groups);
    D.classById = byId(raw.classes);
    D.studentById = byId(raw.students);
    D.teacherById = byId(raw.teachers);
    D.courseById = byId(raw.courses);
    D.loById = byId(raw.los || []);
    D.questionById = byId(raw.questions || []);
    D.sessionById = byId(raw.sessions);
    D.taskById = byId(raw.tasks || []);
    D.assignmentById = byId(raw.onlineAssignments || []);

    idx.classesByGroup = U.groupBy(raw.classes, function (c) { return c.groupId; });
    idx.classCoursesByClass = U.groupBy(raw.classCourses || [], function (cc) { return cc.classId; });
    idx.classCoursesByCourse = U.groupBy(raw.classCourses || [], function (cc) { return cc.courseId; });
    idx.losByCourse = U.groupBy(raw.los || [], function (l) { return l.courseId; });
    idx.losByCourse.forEach(function (arr) { arr.sort(function (a, b) { return a.order - b.order; }); });
    idx.questionsByLo = U.groupBy(raw.questions || [], function (q) { return q.loId; });

    // ---- Ghi danh ----
    idx.enrollByClass = U.groupBy(raw.enrollments, function (e) { return e.classId; });
    idx.enrollByStudent = U.groupBy(raw.enrollments, function (e) { return e.studentId; });

    // ---- Buổi học (sort theo start để tìm theo khoảng thời gian bằng binary search) ----
    idx.sessionsByClass = new Map();
    idx.sessionsByDay = new Map();
    idx.sessionsByTeacher = new Map();
    raw.sessions.forEach(function (s) {
      push(idx.sessionsByClass, s.classId, s);
      push(idx.sessionsByDay, DT.dayKey(s.start), s);
      push(idx.sessionsByTeacher, s.teacherId, s);
    });
    sortBy(idx.sessionsByClass, 'start');
    sortBy(idx.sessionsByDay, 'start');
    sortBy(idx.sessionsByTeacher, 'start');
    idx.sessionsSorted = raw.sessions.slice().sort(function (a, b) { return a.start - b.start; });

    // ---- Điểm danh ----
    idx.attBySession = new Map();
    idx.attByStudent = new Map();
    raw.attendance.forEach(function (r) {
      const s = D.sessionById.get(r.sessionId);
      r._start = s.start; r._classId = s.classId; r._courseId = s.courseId;
      push(idx.attBySession, r.sessionId, r);
      push(idx.attByStudent, r.studentId, r);
    });
    sortBy(idx.attByStudent, '_start');

    // ---- Nhiệm vụ & bài nộp ----
    idx.tasksByClass = new Map();
    idx.tasksBySession = new Map();
    idx.tasksByCourse = new Map();
    (raw.tasks || []).forEach(function (t) {
      push(idx.tasksByClass, t.classId, t);
      push(idx.tasksBySession, t.sessionId, t);
      push(idx.tasksByCourse, t.courseId, t);
    });
    sortBy(idx.tasksByClass, 'dueAt');
    sortBy(idx.tasksByCourse, 'dueAt');
    idx.subsByTask = new Map();
    idx.subsByStudent = new Map();
    (raw.submissions || []).forEach(function (sub) {
      const t = D.taskById.get(sub.taskId);
      sub._dueAt = t.dueAt; sub._classId = t.classId; sub._courseId = t.courseId;
      let m = idx.subsByTask.get(sub.taskId);
      if (!m) { m = new Map(); idx.subsByTask.set(sub.taskId, m); }
      m.set(sub.studentId, sub);
      push(idx.subsByStudent, sub.studentId, sub);
    });

    // ---- Khóa trực tuyến ----
    idx.assignByClass = U.groupBy(raw.onlineAssignments || [], function (a) { return a.classId; });
    idx.assignByContent = U.groupBy(raw.onlineAssignments || [], function (a) { return a.contentKey; });
    idx.progByAssignment = U.groupBy(raw.onlineProgress || [], function (p) { return p.assignmentId; });
    idx.progByStudent = U.groupBy(raw.onlineProgress || [], function (p) { return p.studentId; });

    // ---- Chuẩn đầu ra ----
    idx.achByClassCourse = new Map();
    idx.achByClassLo = new Map();
    idx.achByStudent = new Map();
    (raw.loAchievements || []).forEach(function (a) {
      push(idx.achByClassCourse, a.classId + '|' + a.courseId, a);
      let m = idx.achByClassLo.get(a.classId + '|' + a.loId);
      if (!m) { m = new Map(); idx.achByClassLo.set(a.classId + '|' + a.loId, m); }
      m.set(a.studentId, a);
      push(idx.achByStudent, a.studentId, a);
    });
    idx.attemptsByLo = U.groupBy(raw.attempts || [], function (a) { return a.loId; });
    idx.snapsByClassLo = U.groupBy(raw.loSnapshots || [], function (s) { return s.classId + '|' + s.loId; });
    sortBy(idx.snapsByClassLo, 'weekStart');

    return D;
  }

  GT.data = {
    build: build,

    /** Sinh mock + build index (cache trong GT.D). */
    load: function () {
      if (GT.D) return GT.D;
      const cfg = GT.config.get();
      const t0 = performance.now();
      const raw = GT.mock.generate({ seed: cfg.school.seed, today: cfg.school.today, now: cfg.school.now });
      const t1 = performance.now();
      const D = build(raw);
      const t2 = performance.now();
      D.timing = { generate: t1 - t0, index: t2 - t1 };
      GT.D = D;
      return D;
    }
  };
})(window.GT);
