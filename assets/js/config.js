/**
 * GenieTeach — Báo cáo Học vụ (prototype)
 * config.js — Cấu hình CẤP TRƯỜNG.
 *
 * - DEFAULTS là nguồn sự thật duy nhất cho mọi ngưỡng; metrics.js và alerts.js chỉ đọc qua GT.config.get().
 * - Người dùng chỉnh ở hoc-vu/settings.html → lưu phần ghi đè vào localStorage (khóa STORAGE_KEY).
 * - Đơn vị: mọi ngưỡng tỉ lệ ghi theo PHẦN TRĂM (0–100) hoặc ĐIỂM % cho chênh lệch; metrics tự quy đổi.
 * - school.today / school.now / school.seed chỉ đổi trong file này (dữ liệu mock sinh tương đối theo mốc này).
 */
window.GT = window.GT || {};
(function (GT) {
  'use strict';

  const STORAGE_KEY = 'gt.hocvu.config.v1';

  /** Bật in bảng đối chiếu kịch bản → rule ra console. Có thể bật nhanh bằng ?debug=1 trên URL. */
  GT.debug = false;
  try { if (/[?&]debug=1\b/.test(window.location.search)) GT.debug = true; } catch (e) { /* ignore */ }

  const RULE_DEFAULTS = {
    // ---- Vận hành (OPS) ----
    'OPS-01': { enabled: true, severity: 'HIGH', params: { minutes: 15 } },
    'OPS-02': { enabled: true, severity: 'MEDIUM', params: { hours: 24, lookbackDays: 7 } },
    'OPS-03': { enabled: true, severity: 'HIGH', params: { minSessions: 3, windowDays: 7 } },
    'OPS-04': { enabled: true, severity: 'MEDIUM', params: { daysOverdue: 3, lookbackDays: 30 } },
    'OPS-05': { enabled: true, severity: 'LOW', params: { windowDays: 7 } },
    'OPS-06': { enabled: true, severity: 'MEDIUM', params: { threshold: 10, windowDays: 30 } },
    // ---- Chuyên cần học sinh (ATT-S) ----
    'ATT-S01': { enabled: true, severity: 'HIGH', params: { maxAbsences: 3, windowDays: 30 } },
    'ATT-S02': { enabled: true, severity: 'HIGH', params: { consecutive: 2, windowDays: 30 } },
    'ATT-S03': { enabled: true, severity: 'MEDIUM', params: { lateCount: 3, windowDays: 14 } },
    'ATT-S04': { enabled: true, severity: 'MEDIUM', params: { dropPts: 20, windowDays: 30, minSessions: 5 } },
    'ATT-S05': { enabled: true, severity: 'LOW', params: { excusedCount: 4, windowDays: 30 } },
    // ---- Chuyên cần lớp/nhóm (ATT-C) ----
    'ATT-C01': { enabled: true, severity: 'MEDIUM', params: { threshold: 85, windowDays: 7 } },
    'ATT-C02': { enabled: true, severity: 'MEDIUM', params: { gapPts: 10, windowDays: 7 } },
    'ATT-C03': { enabled: true, severity: 'MEDIUM', params: { dropPts: 10, windowDays: 7 } },
    'ATT-C04': { enabled: true, severity: 'LOW', params: { gapPts: 25, windowDays: 14 } },
    'ATT-C05': { enabled: true, severity: 'MEDIUM', params: { gapPts: 5, windowDays: 7 } },
    // ---- Học ở nhà — nhiệm vụ (HW) ----
    'HW-S01': { enabled: true, severity: 'HIGH', params: { consecutive: 2, windowDays: 30 } },
    'HW-S02': { enabled: true, severity: 'HIGH', params: { missingShare: 30, windowDays: 30, minTasks: 4 } },
    'HW-S03': { enabled: true, severity: 'MEDIUM', params: { dropPoints: 2, windowDays: 30, minGraded: 3 } },
    'HW-C01': { enabled: true, severity: 'MEDIUM', params: { threshold: 70, windowDays: 7 } },
    'HW-C02': { enabled: true, severity: 'MEDIUM', params: { gap: 1.5, windowDays: 30 } },
    'HW-T01': { enabled: true, severity: 'MEDIUM', params: { minSubmitRate: 60, minAvgScore: 5, lookbackDays: 30, minStudents: 10 } },
    // ---- Khóa trực tuyến (ONL) ----
    'ONL-S01': { enabled: true, severity: 'HIGH', params: { gapPts: 25 } },
    'ONL-S02': { enabled: true, severity: 'HIGH', params: { remainingShare: 30 } },
    'ONL-S03': { enabled: true, severity: 'MEDIUM', params: { days: 7 } },
    'ONL-C01': { enabled: true, severity: 'MEDIUM', params: { threshold: 60 } },
    'ONL-C02': { enabled: true, severity: 'MEDIUM', params: { gapPts: 20, lookbackDays: 30 } },
    // ---- Chuẩn đầu ra (LO) ----
    'LO-S01': { enabled: true, severity: 'HIGH', params: { maxFailed: 3 } },
    'LO-S02': { enabled: true, severity: 'MEDIUM', params: { minCompletion: 90, minPoor: 2, minTasks: 5 } },
    'LO-C01': { enabled: true, severity: 'HIGH', params: {} },
    'LO-C02': { enabled: true, severity: 'HIGH', params: { redShare: 30 } },
    'LO-C03': { enabled: true, severity: 'MEDIUM', params: {} },
    // ---- Chương trình / khóa học (CUR) ----
    'CUR-01': { enabled: true, severity: 'HIGH', params: {} },
    'CUR-02': { enabled: true, severity: 'HIGH', params: { threshold: 50, minStudents: 30 } },
    'CUR-03': { enabled: true, severity: 'MEDIUM', params: { maxCorrect: 30, minClasses: 3, minAttemptsPerClass: 10 } },
    // ---- Chất lượng dữ liệu (DATA) ----
    'DATA-01': { enabled: true, severity: 'MEDIUM', params: { coverage: 30, elapsed: 50 } },
    'DATA-02': { enabled: true, severity: 'MEDIUM', params: { elapsed: 70 } },
    'DATA-03': { enabled: true, severity: 'LOW', params: { days: 14 } }
  };

  const DEFAULTS = {
    school: {
      name: 'Trường THPT Genie (dữ liệu mô phỏng)',
      today: '2026-10-08', // Thứ Năm — "hôm nay" cố định giữa kỳ
      now: '09:40',        // có buổi Ca 2 đang diễn ra để demo bảng vận hành
      seed: 20261008
    },
    /** Chuẩn đầu ra (mục 3.5). levels: ngưỡng dưới (%) của từng cấp. */
    lo: {
      levels: { excellent: 90, good: 75, average: 60, needsImprovement: 40 },
      passLevel: 'AVERAGE',            // "đạt yêu cầu" khi cấp ≥ mức này
      color: { green: 80, orange: 50 }, // theo tỉ lệ đạt (%)
      thinCoverage: 30                  // 0 < coverage < 30% → badge "Dữ liệu mỏng"
    },
    /** Diễn giải nguyên nhân (mục 3.6). */
    cause: {
      curriculumRedShare: 60,     // Đỏ ở ≥ 60% số lớp đủ dữ liệu → "Nghi vấn chương trình / học liệu / đề đánh giá"
      minClassesForCurriculum: 3, // [GIẢ ĐỊNH] OQ-09
      classGapPts: 25,            // thấp hơn trung vị lớp khác ≥ 25 điểm % → "Nghi vấn ở lớp học"
      minOtherClasses: 2,         // [GIẢ ĐỊNH] OQ-10
      minStudentsWithData: 10,
      minAvgEvidence: 3
    },
    /** Ghi đè tham số khóa học theo courseId: { passThreshold, weightTaskCompletion, weightTestScore }. */
    courses: {},
    ops: { attendanceGraceMin: 15, reportOnTimeHours: 24 },
    online: { onTrackTolerancePts: 10, activeLearningPct: 50 },
    homework: { anomalyRateGapPts: 20, anomalyScoreGap: 1.5 },
    ranking: { minSample: 30 },
    alerts: {
      minDenominator: 30,
      minStudentsWithData: 10,
      dedupeDays: 7,
      groupMinStudents: 5,
      rules: RULE_DEFAULTS
    },
    display: { showTeacherReport: true }
  };

  function isObj(x) { return x && typeof x === 'object' && !Array.isArray(x); }

  function deepClone(x) { return JSON.parse(JSON.stringify(x)); }

  function deepMerge(base, over) {
    const out = deepClone(base);
    (function merge(dst, src) {
      Object.keys(src || {}).forEach(function (k) {
        if (isObj(src[k]) && isObj(dst[k])) merge(dst[k], src[k]);
        else if (isObj(src[k])) dst[k] = deepClone(src[k]);
        else dst[k] = src[k];
      });
    })(out, over);
    return out;
  }

  function readOverrides() {
    try {
      const s = window.localStorage.getItem(STORAGE_KEY);
      return s ? JSON.parse(s) : {};
    } catch (e) {
      return {};
    }
  }

  let cached = null;
  let version = 0;

  GT.config = {
    STORAGE_KEY: STORAGE_KEY,
    DEFAULTS: DEFAULTS,
    deepMerge: deepMerge,
    deepClone: deepClone,

    /** Cấu hình hiệu lực = DEFAULTS ⊕ ghi đè trong localStorage. school.* luôn lấy từ DEFAULTS. */
    get: function () {
      if (!cached) {
        const over = readOverrides();
        delete over.school;
        cached = deepMerge(DEFAULTS, over);
        cached.__version = 'v' + version + ':' + JSON.stringify(over).length + ':' + hash(JSON.stringify(over));
      }
      return cached;
    },

    /** Lưu toàn bộ cấu hình (đã validate ở settings). Trả về true nếu lưu được. */
    save: function (full) {
      const copy = deepClone(full);
      delete copy.__version;
      delete copy.school;
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(copy));
      } catch (e) {
        return false;
      } finally {
        cached = null;
        version++;
        if (GT.memo) GT.memo.clear();
      }
      return true;
    },

    /** "Khôi phục mặc định". */
    reset: function () {
      try { window.localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
      cached = null;
      version++;
      if (GT.memo) GT.memo.clear();
    },

    /** Có đang ghi đè so với mặc định không. */
    hasOverrides: function () {
      return Object.keys(readOverrides()).length > 0;
    },

    /** Cấu hình tạm (preview ở settings) — không lưu, không ảnh hưởng cache. */
    withOverrides: function (over) {
      const c = deepMerge(DEFAULTS, over || {});
      c.__version = 'preview:' + hash(JSON.stringify(over || {}));
      return c;
    }
  };

  function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36);
  }
})(window.GT);
