/**
 * GenieTeach — Báo cáo Học vụ (prototype)
 * util.js — Tiện ích không chứa nghiệp vụ: RNG có seed, ngày giờ, định dạng vi-VN, thống kê,
 * CSV, query string, localStorage an toàn, memo cache.
 *
 * QUY ƯỚC THỜI GIAN: mọi mốc là số ms biểu diễn GIỜ TƯỜNG VIỆT NAM mã hóa theo UTC
 * (tạo bằng Date.UTC, đọc bằng getUTC*). Không dùng getHours()/getDate() theo múi giờ máy.
 */
window.GT = window.GT || {};
(function (GT) {
  'use strict';

  // ------------------------------------------------------------------ RNG
  const util = GT.util = {};

  /** Bộ sinh số ngẫu nhiên mulberry32 có seed (tái lập được). */
  util.rng = function (seed) {
    let a = seed >>> 0;
    function next() {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    let spare = null;
    const r = {
      next: next,
      /** Số thực đều trong [lo, hi). */
      uniform: function (lo, hi) { return lo + (hi - lo) * next(); },
      /** Số nguyên đều trong [lo, hi] (gồm hai đầu). */
      int: function (lo, hi) { return lo + Math.floor(next() * (hi - lo + 1)); },
      chance: function (p) { return next() < p; },
      pick: function (arr) { return arr[Math.floor(next() * arr.length)]; },
      normal: function (mu, sd) {
        let z;
        if (spare !== null) { z = spare; spare = null; } else {
          let u = 0, v = 0;
          while (u === 0) u = next();
          v = next();
          const m = Math.sqrt(-2 * Math.log(u));
          z = m * Math.cos(2 * Math.PI * v);
          spare = m * Math.sin(2 * Math.PI * v);
        }
        return (mu || 0) + (sd === undefined ? 1 : sd) * z;
      },
      /** Chọn theo trọng số: items[i] với xác suất weights[i]/Σ. */
      weighted: function (items, weights) {
        let s = 0;
        for (let i = 0; i < weights.length; i++) s += weights[i];
        let u = next() * s;
        for (let i = 0; i < items.length; i++) { u -= weights[i]; if (u < 0) return items[i]; }
        return items[items.length - 1];
      },
      shuffle: function (arr) {
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(next() * (i + 1));
          const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
        }
        return arr;
      }
    };
    return r;
  };

  util.clamp = function (x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; };
  util.sigmoid = function (x) { return 1 / (1 + Math.exp(-x)); };

  /** Tìm chỉ số đầu tiên i sao cho key(arr[i]) >= value (arr đã sort tăng theo key). */
  util.lowerBound = function (arr, value, key) {
    let lo = 0, hi = arr.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (key(arr[mid]) < value) lo = mid + 1; else hi = mid;
    }
    return lo;
  };

  util.groupBy = function (arr, keyFn) {
    const m = new Map();
    for (let i = 0; i < arr.length; i++) {
      const k = keyFn(arr[i]);
      let g = m.get(k);
      if (!g) { g = []; m.set(k, g); }
      g.push(arr[i]);
    }
    return m;
  };

  util.escapeHtml = function (s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  /** So sánh có dung sai để tránh lỗi dấu phẩy động ở điểm biên (0.7*100 = 70.00000000000001). */
  const EPS = 1e-9;
  util.gte = function (a, b) { return a >= b - EPS; };
  util.lt = function (a, b) { return a < b - EPS; };

  // ------------------------------------------------------------------ Ngày giờ
  const DT = GT.date = {};
  DT.MIN = 60000;
  DT.HOUR = 3600000;
  DT.DAY = 86400000;
  DT.WEEK = 7 * DT.DAY;

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  /** Tạo mốc thời gian (tháng 1–12). */
  DT.make = function (y, m, d, h, mi) { return Date.UTC(y, m - 1, d, h || 0, mi || 0); };
  /** 'YYYY-MM-DD' → mốc 00:00 của ngày đó. */
  DT.parseDate = function (s) {
    const p = String(s).split('-');
    if (p.length !== 3) return NaN;
    return DT.make(+p[0], +p[1], +p[2]);
  };
  /** 'HH:mm' → số ms tính từ 00:00. */
  DT.parseTime = function (s) {
    const p = String(s).split(':');
    return (+p[0]) * DT.HOUR + (+p[1]) * DT.MIN;
  };
  DT.isValidDateStr = function (s) { return /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !isNaN(DT.parseDate(s)); };
  DT.startOfDay = function (t) { return Math.floor(t / DT.DAY) * DT.DAY; };
  /** 0 = Thứ Hai … 6 = Chủ nhật. */
  DT.weekday = function (t) { return (new Date(t).getUTCDay() + 6) % 7; };
  DT.startOfWeek = function (t) { const d = DT.startOfDay(t); return d - DT.weekday(d) * DT.DAY; };
  DT.startOfMonth = function (t) { const d = new Date(t); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1); };
  DT.addDays = function (t, n) { return t + n * DT.DAY; };
  /** Cộng tháng, giữ ngày trong tháng nhưng không vượt quá số ngày của tháng đích. */
  DT.addMonths = function (t, n) {
    const d = new Date(t);
    const y = d.getUTCFullYear(), m = d.getUTCMonth() + n;
    const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return Date.UTC(y, m, Math.min(d.getUTCDate(), last), d.getUTCHours(), d.getUTCMinutes());
  };
  DT.daysInMonth = function (t) { const d = new Date(t); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate(); };
  DT.dayKey = function (t) {
    const d = new Date(t);
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  };
  DT.minutesOfDay = function (t) { return Math.round((t - DT.startOfDay(t)) / DT.MIN); };

  DT.fmtDate = function (t) {
    if (t === null || t === undefined || isNaN(t)) return '–';
    const d = new Date(t);
    return pad(d.getUTCDate()) + '/' + pad(d.getUTCMonth() + 1) + '/' + d.getUTCFullYear();
  };
  DT.fmtDayMonth = function (t) {
    if (t === null || t === undefined || isNaN(t)) return '–';
    const d = new Date(t);
    return pad(d.getUTCDate()) + '/' + pad(d.getUTCMonth() + 1);
  };
  DT.fmtTime = function (t) {
    if (t === null || t === undefined || isNaN(t)) return '–';
    const d = new Date(t);
    return pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes());
  };
  DT.fmtDateTime = function (t) {
    if (t === null || t === undefined || isNaN(t)) return '–';
    return DT.fmtTime(t) + ' ' + DT.fmtDate(t);
  };
  const WD_LONG = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật'];
  const WD_SHORT = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  DT.WEEKDAYS = WD_LONG;
  DT.WEEKDAYS_SHORT = WD_SHORT;
  DT.weekdayName = function (t) { return WD_LONG[DT.weekday(t)]; };
  DT.weekdayShort = function (t) { return WD_SHORT[DT.weekday(t)]; };
  /** "Thứ Năm, 08/10/2026" */
  DT.fmtLongDate = function (t) { return DT.weekdayName(t) + ', ' + DT.fmtDate(t); };
  /** Thời lượng dạng "2 giờ 15 phút", "3 ngày". */
  DT.fmtDuration = function (ms) {
    if (ms === null || ms === undefined || isNaN(ms)) return '–';
    const neg = ms < 0; ms = Math.abs(ms);
    let s;
    if (ms < DT.HOUR) s = Math.round(ms / DT.MIN) + ' phút';
    else if (ms < DT.DAY) {
      const h = Math.floor(ms / DT.HOUR), m = Math.round((ms % DT.HOUR) / DT.MIN);
      s = h + ' giờ' + (m ? ' ' + m + ' phút' : '');
    } else s = GT.fmt.num(ms / DT.DAY, 1) + ' ngày';
    return (neg ? '−' : '') + s;
  };

  // ------------------------------------------------------------------ Định dạng số (vi-VN)
  const F = GT.fmt = {};
  const nfCache = {};
  function nf(digits) {
    if (!nfCache[digits]) {
      nfCache[digits] = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
    }
    return nfCache[digits];
  }
  function bad(x) { return x === null || x === undefined || typeof x !== 'number' || !isFinite(x); }
  F.DASH = '–';
  /** Số có dấu phẩy thập phân, dấu chấm hàng nghìn. */
  F.num = function (x, digits) { return bad(x) ? F.DASH : nf(digits === undefined ? 1 : digits).format(x); };
  F.int = function (x) { return bad(x) ? F.DASH : nf(0).format(Math.round(x)); };
  /** Tỉ lệ 0–1 → "85,3%". */
  F.pct = function (ratio, digits) { return bad(ratio) ? F.DASH : F.num(ratio * 100, digits === undefined ? 1 : digits) + '%'; };
  /** Giá trị đã ở thang % (0–100) → "85,3%". */
  F.pct100 = function (v, digits) { return bad(v) ? F.DASH : F.num(v, digits === undefined ? 1 : digits) + '%'; };
  /** Chênh lệch tỉ lệ (0–1) → "+2,1 điểm %". */
  F.pts = function (delta, digits) {
    if (bad(delta)) return F.DASH;
    const v = delta * 100;
    const sign = v > 0.05 ? '+' : v < -0.05 ? '−' : '±';
    return sign + F.num(Math.abs(v), digits === undefined ? 1 : digits) + ' điểm %';
  };
  /** Điểm thang 10 → "6,5". */
  F.score = function (x) { return F.num(x, 1); };
  /** Chênh lệch điểm → "+0,8 điểm". */
  F.scoreDelta = function (d) {
    if (bad(d)) return F.DASH;
    const sign = d > 0.05 ? '+' : d < -0.05 ? '−' : '±';
    return sign + F.num(Math.abs(d), 1) + ' điểm';
  };

  // ------------------------------------------------------------------ Thống kê
  const S = GT.stats = {};
  /** n/d, trả null khi mẫu số = 0 (UI hiển thị "–"). */
  S.ratio = function (n, d) { return d > 0 ? n / d : null; };
  S.sum = function (arr) { let s = 0; for (let i = 0; i < arr.length; i++) s += arr[i]; return s; };
  S.mean = function (arr) { return arr.length ? S.sum(arr) / arr.length : null; };
  /** Phân vị nội suy tuyến tính trên mảng ĐÃ SORT tăng. */
  S.quantileSorted = function (sorted, q) {
    if (!sorted.length) return null;
    const pos = (sorted.length - 1) * q;
    const lo = Math.floor(pos), hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  };
  S.median = function (arr) {
    if (!arr.length) return null;
    return S.quantileSorted(arr.slice().sort(function (a, b) { return a - b; }), 0.5);
  };
  /** [min, Q1, trung vị, Q3, max] cho boxplot; null nếu rỗng. */
  S.boxplot = function (arr) {
    if (!arr.length) return null;
    const s = arr.slice().sort(function (a, b) { return a - b; });
    return [s[0], S.quantileSorted(s, 0.25), S.quantileSorted(s, 0.5), S.quantileSorted(s, 0.75), s[s.length - 1]];
  };

  // ------------------------------------------------------------------ Query string
  GT.qs = {
    parse: function (search) {
      const out = {};
      const s = (search === undefined ? window.location.search : search).replace(/^\?/, '');
      if (!s) return out;
      s.split('&').forEach(function (kv) {
        if (!kv) return;
        const i = kv.indexOf('=');
        const k = decodeURIComponent(i < 0 ? kv : kv.slice(0, i));
        const v = i < 0 ? '' : decodeURIComponent(kv.slice(i + 1).replace(/\+/g, ' '));
        out[k] = v;
      });
      return out;
    },
    build: function (obj) {
      const parts = [];
      Object.keys(obj).forEach(function (k) {
        const v = obj[k];
        if (v === null || v === undefined || v === '') return;
        parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
      });
      return parts.length ? '?' + parts.join('&') : '';
    }
  };

  // ------------------------------------------------------------------ localStorage an toàn
  GT.store = {
    get: function (key, fallback) {
      try {
        const s = window.localStorage.getItem(key);
        return s === null ? fallback : JSON.parse(s);
      } catch (e) { return fallback; }
    },
    set: function (key, value) {
      try { window.localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
    },
    remove: function (key) {
      try { window.localStorage.removeItem(key); } catch (e) { /* ignore */ }
    }
  };

  // ------------------------------------------------------------------ Memo cache
  GT.memo = (function () {
    let cache = new Map();
    return {
      get: function (key, fn) {
        if (cache.has(key)) return cache.get(key);
        const v = fn();
        cache.set(key, v);
        return v;
      },
      clear: function () { cache = new Map(); },
      size: function () { return cache.size; }
    };
  })();

  // ------------------------------------------------------------------ CSV
  GT.csv = {
    /** Ô CSV: số → dấu phẩy thập phân, luôn đặt trong ngoặc kép (OQ-38). */
    cell: function (v) {
      if (v === null || v === undefined || (typeof v === 'number' && !isFinite(v))) return '""';
      let s = typeof v === 'number' ? String(v).replace('.', ',') : String(v);
      return '"' + s.replace(/"/g, '""') + '"';
    },
    build: function (headers, rows) {
      const lines = [headers.map(GT.csv.cell).join(',')];
      rows.forEach(function (r) { lines.push(r.map(GT.csv.cell).join(',')); });
      return '﻿' + lines.join('\r\n');
    },
    download: function (filename, headers, rows) {
      const blob = new Blob([GT.csv.build(headers, rows)], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    }
  };
})(window.GT);
