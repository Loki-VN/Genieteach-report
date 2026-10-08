/**
 * GenieTeach — Báo cáo Học vụ (prototype)
 * period.js — Mô hình KỲ DỮ LIỆU 4 chế độ (mục 3.2): Ngày · Tuần · Tháng · Khoảng tùy chọn.
 *
 * state = { mode: 'day'|'week'|'month'|'custom', date: ms 00:00 (ngày neo), from?: ms, to?: ms|null }
 * range = { from, to (không gồm), label, days, isCurrent, isComplete, bucket }
 * Kỳ liền trước (OQ-24): ngày trước · tuần trước · tháng dương lịch trước · khoảng cùng số ngày ngay trước.
 * Query string: period, date, from, to (dạng YYYY-MM-DD).
 */
window.GT = window.GT || {};
(function (GT) {
  'use strict';
  const DT = GT.date;
  const DAY = DT.DAY;

  const P = GT.period = {};
  P.MODES = ['day', 'week', 'month', 'custom'];
  P.LABEL = { day: 'Ngày', week: 'Tuần', month: 'Tháng', custom: 'Khoảng' };

  /** Đọc state từ query string; thiếu/không hợp lệ → mặc định của trang, neo tại hôm nay. */
  P.fromParams = function (q, defMode, now) {
    const mode = P.MODES.indexOf(q.period) >= 0 ? q.period : (defMode || 'day');
    const today = DT.startOfDay(now);
    const date = DT.isValidDateStr(q.date) ? DT.parseDate(q.date) : today;
    const st = { mode: mode, date: date };
    if (mode === 'custom') {
      st.from = DT.isValidDateStr(q.from) ? DT.parseDate(q.from) : DT.startOfMonth(today);
      st.to = DT.isValidDateStr(q.to) ? DT.parseDate(q.to) : null;   // null = đến hiện tại
      if (st.to !== null && st.to < st.from) { const t = st.to; st.to = st.from; st.from = t; }
    }
    return st;
  };

  /** state → tham số URL. */
  P.toParams = function (st) {
    const o = { period: st.mode, date: DT.dayKey(st.date), from: null, to: null };
    if (st.mode === 'custom') {
      o.date = null;
      o.from = DT.dayKey(st.from);
      o.to = st.to === null || st.to === undefined ? null : DT.dayKey(st.to);
    }
    return o;
  };

  function bounds(st, now) {
    switch (st.mode) {
      case 'day': return [DT.startOfDay(st.date), DT.startOfDay(st.date) + DAY];
      case 'week': { const w = DT.startOfWeek(st.date); return [w, w + 7 * DAY]; }
      case 'month': { const m = DT.startOfMonth(st.date); return [m, DT.addMonths(m, 1)]; }
      default: {
        const to = st.to === null || st.to === undefined ? now + 1 : DT.startOfDay(st.to) + DAY;
        return [DT.startOfDay(st.from), Math.max(to, DT.startOfDay(st.from) + 1)];
      }
    }
  }

  function label(st, from, to) {
    switch (st.mode) {
      case 'day': return DT.fmtLongDate(from);
      case 'week': return 'Tuần ' + DT.fmtDayMonth(from) + ' – ' + DT.fmtDate(to - DAY);
      case 'month': { const d = new Date(from); return 'Tháng ' + (d.getUTCMonth() + 1) + '/' + d.getUTCFullYear(); }
      default: return DT.fmtDate(from) + ' – ' + (st.to === null || st.to === undefined ? 'hiện tại' : DT.fmtDate(to - DAY));
    }
  }

  /** Khoảng thời gian của state. bucket: 'day' nếu ≤ 31 ngày, ngược lại 'week' (gộp theo tuần). */
  P.range = function (st, now) {
    const b = bounds(st, now);
    const days = Math.max(1, Math.round((b[1] - b[0]) / DAY));
    return {
      mode: st.mode, from: b[0], to: b[1], days: days,
      label: label(st, b[0], b[1]),
      isCurrent: b[0] <= now && now < b[1],
      isFuture: b[0] > now,
      isComplete: b[1] <= now + 1,
      bucket: days > 31 ? 'week' : 'day'
    };
  };

  /** Kỳ liền trước cùng độ dài. */
  P.previous = function (st, now) {
    const r = P.range(st, now);
    let from, to;
    switch (st.mode) {
      case 'day': from = r.from - DAY; to = r.from; break;
      case 'week': from = r.from - 7 * DAY; to = r.from; break;
      case 'month': from = DT.addMonths(r.from, -1); to = r.from; break;
      default: from = r.from - (r.to - r.from); to = r.from;
    }
    const days = Math.round((to - from) / DAY);
    return { from: from, to: to, days: days, label: st.mode === 'day' ? DT.fmtLongDate(from) : DT.fmtDate(from) + ' – ' + DT.fmtDate(to - 1) };
  };

  /** Lùi (dir = −1) / tiến (dir = +1) một kỳ. */
  P.shift = function (st, dir, now) {
    const n = Object.assign({}, st);
    switch (st.mode) {
      case 'day': n.date = st.date + dir * DAY; break;
      case 'week': n.date = st.date + dir * 7 * DAY; break;
      case 'month': n.date = DT.addMonths(DT.startOfMonth(st.date), dir); break;
      default: {
        const r = P.range(st, now);
        const len = r.to - r.from;
        n.from = DT.startOfDay(r.from + dir * len);
        n.to = DT.startOfDay(r.to + dir * len - DAY);
      }
    }
    return n;
  };

  /** Đổi chế độ, giữ ngày neo (custom: mặc định từ đầu tháng của ngày neo đến hiện tại). */
  P.withMode = function (st, mode) {
    const n = { mode: mode, date: st.mode === 'custom' ? (st.to || st.from) : st.date };
    if (mode === 'custom') { n.from = DT.startOfMonth(n.date); n.to = null; }
    return n;
  };

  /** Danh sách bucket (ngày hoặc tuần) trong khoảng: [{from, to, label}]. */
  P.buckets = function (from, to, kind) {
    const out = [];
    if (kind === 'week') {
      for (let w = DT.startOfWeek(from); w < to; w += 7 * DAY) {
        const a = Math.max(w, from), b = Math.min(w + 7 * DAY, to);
        out.push({ from: a, to: b, label: DT.fmtDayMonth(w) });
      }
    } else if (kind === 'month') {
      for (let m = DT.startOfMonth(from); m < to; m = DT.addMonths(m, 1)) {
        const d = new Date(m);
        out.push({ from: Math.max(m, from), to: Math.min(DT.addMonths(m, 1), to), label: 'T' + (d.getUTCMonth() + 1) + '/' + d.getUTCFullYear() });
      }
    } else {
      for (let d = DT.startOfDay(from); d < to; d += DAY) out.push({ from: d, to: d + DAY, label: DT.weekdayShort(d) + ' ' + DT.fmtDayMonth(d) });
    }
    return out;
  };
})(window.GT);
