/**
 * GenieTeach — Báo cáo Học vụ (prototype)
 * charts.js — Builder ECharts dùng chung. CHỈ render: nhận số liệu đã tính từ metrics.js, trả về option.
 *
 * Quy ước trực quan (đồng bộ mọi trang):
 *  - Bar ≤ 24px, đầu bo 4px; khe 2px màu nền giữa các đoạn xếp chồng; line 2px; marker ≥ 8px có viền nền 2px.
 *  - Lưới/trục: hairline liền, nhạt. Chữ luôn dùng màu mực (không dùng màu series).
 *  - Mọi ô màu có nhãn chữ/ký hiệu đi kèm (heatmap hiển thị số/ký hiệu trong ô; legend có chữ).
 *  - Không dùng biểu đồ 2 trục y.
 *  - Mọi biểu đồ có tooltip; thẻ biểu đồ có chế độ "Bảng" (ui.js) làm bản tương đương không phụ thuộc màu.
 */
window.GT = window.GT || {};
(function (GT) {
  'use strict';
  const F = GT.fmt, DT = GT.date;
  const FONT = '"Be Vietnam Pro", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

  // ------------------------------------------------------------------ Bảng màu
  const C = GT.colors = {
    brand: '#A878D8', brandDark: '#5B3E8C', brandLight: '#F2EBFA', blue: '#0098F0',
    status: { GREEN: '#22A06B', ORANGE: '#F59E0B', RED: '#E5484D', GRAY: '#B0B4BA' },
    att: { ON_TIME: '#22A06B', LATE: '#F59E0B', EXCUSED: '#60A5FA', UNEXCUSED: '#E5484D', NOT_TAKEN: '#D1D5DB' },
    level: { EXCELLENT: '#15803D', GOOD: '#4ADE80', AVERAGE: '#FACC15', NEEDS_IMPROVEMENT: '#FB923C', POOR: '#DC2626', NO_DATA: '#D1D5DB' },
    task: { ON_TIME: '#22A06B', LATE: '#F59E0B', MISSING: '#E5484D', OPEN: '#B0B4BA' },
    session: { BOTH: '#22A06B', ATT_ONLY: '#F5C451', REP_ONLY: '#F08C3A', NONE: '#E5484D', UPCOMING: '#D1D5DB' },
    latency: { LT2H: '#22A06B', H2_24: '#8CCB6A', D1_3: '#F5C451', GT3D: '#F08C3A', NONE: '#E5484D' },
    timing: { GT72: '#5B3E8C', H24_72: '#8B5CC4', H6_24: '#B08BDB', LT6: '#DFCDF1', LATE: '#E5484D' },
    /** Phân loại (đã chạy validator: ΔE CVD ≥ 8, normal ≥ 15 — xem docs/PLAN.md). Màu theo thực thể, không theo thứ hạng. */
    series: ['#0098F0', '#8B5CC4', '#e87ba4', '#1c5cab'],
    group: { G10: '#0098F0', G11: '#8B5CC4', G12: '#e87ba4', GTA: '#1c5cab' },
    accent: '#8B5CC4', deemph: '#D9D3E3',
    /** Tuần tự 1 sắc (tím thương hiệu), nhạt → đậm. */
    seq: ['#F4EEFB', '#E2D3F3', '#CBB2E8', '#B08BDB', '#946AC9', '#7650AE', '#5B3E8C'],
    /** Phân kỳ: thấp hơn TB (cam) ↔ xám trung tính ↔ cao hơn TB (xanh dương). */
    div: { neg: '#E0702E', mid: '#EFEDF2', pos: '#1C6FB5' },
    ink: '#1F2330', ink2: '#4B5160', muted: '#6B7180', grid: '#EEEAF3', axis: '#D4CEDF', surface: '#FFFFFF'
  };

  GT.labels = {
    att: { ON_TIME: 'Đúng giờ', LATE: 'Muộn', EXCUSED: 'Vắng có phép', UNEXCUSED: 'Vắng không phép', NOT_TAKEN: 'Chưa điểm danh' },
    attCode: { ON_TIME: 'Đ', LATE: 'M', EXCUSED: 'P', UNEXCUSED: 'K', NOT_TAKEN: '?' },
    task: { ON_TIME: 'Đúng hạn', LATE: 'Muộn', MISSING: 'Không hoàn thành', OPEN: 'Đang mở' },
    session: { BOTH: 'Đủ điểm danh + báo cáo', ATT_ONLY: 'Chỉ điểm danh', REP_ONLY: 'Chỉ báo cáo', NONE: 'Chưa có gì', UPCOMING: 'Chưa diễn ra' },
    sessionCode: { BOTH: '✓', ATT_ONLY: 'Đ', REP_ONLY: 'B', NONE: '✕', UPCOMING: '·' },
    latency: { LT2H: '< 2 giờ', H2_24: '2–24 giờ', D1_3: '1–3 ngày', GT3D: '> 3 ngày', NONE: 'Chưa nộp' },
    timing: { GT72: '> 72 giờ trước hạn', H24_72: '24–72 giờ', H6_24: '6–24 giờ', LT6: '< 6 giờ', LATE: 'Nộp muộn' },
    time: { UPCOMING: 'Sắp diễn ra', ONGOING: 'Đang diễn ra', DONE: 'Đã kết thúc' }
  };

  /** Màu chữ (trắng / mực) đặt trên nền màu theo độ sáng. */
  C.textOn = function (hex) {
    const h = hex.replace('#', '');
    const r = parseInt(h.substr(0, 2), 16) / 255, g = parseInt(h.substr(2, 2), 16) / 255, b = parseInt(h.substr(4, 2), 16) / 255;
    const lin = function (c) { return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    return L > 0.45 ? C.ink : '#FFFFFF';
  };
  /** Nội suy màu tuần tự theo t ∈ [0,1]. */
  C.seqAt = function (t) {
    t = Math.max(0, Math.min(1, t));
    return C.seq[Math.round(t * (C.seq.length - 1))];
  };

  // ------------------------------------------------------------------ Mount / vòng đời
  const instances = [];
  let observer = null;
  const pending = new Map();
  function getObserver() {
    if (observer || !('IntersectionObserver' in window)) return observer;
    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        const fn = pending.get(en.target);
        if (fn) { pending.delete(en.target); observer.unobserve(en.target); fn(); }
      });
    }, { rootMargin: '300px 0px' });
    return observer;
  }

  function emptyHtml(msg) {
    return '<div class="empty"><div><b>' + GT.util.escapeHtml(msg && msg.title || 'Không có dữ liệu') + '</b>' +
      GT.util.escapeHtml(msg && msg.text || 'Không có bản ghi nào trong phạm vi và kỳ dữ liệu đang chọn.') + '</div></div>';
  }
  GT.charts = { colors: C, emptyHtml: emptyHtml };

  /**
   * Gắn biểu đồ vào el. build() trả về option ECharts, hoặc {empty:{title,text}} để hiện empty state.
   * Khởi tạo lười khi phần tử sắp hiện trên màn hình (eager = true để vẽ ngay).
   */
  GT.charts.mount = function (el, build, opts) {
    opts = opts || {};
    el.style.height = (opts.height || 300) + 'px';
    const go = function () {
      let opt;
      try { opt = build(); } catch (e) {
        el.style.height = 'auto';
        el.innerHTML = '<div class="empty"><div><b>Lỗi khi vẽ biểu đồ</b>' + GT.util.escapeHtml(e.message) + '</div></div>';
        console.error(e);
        return;
      }
      if (!opt || opt.empty) { el.style.height = 'auto'; el.innerHTML = emptyHtml(opt && opt.empty); return; }
      if (!window.echarts) {
        el.style.height = 'auto';
        el.innerHTML = emptyHtml({ title: 'Không tải được thư viện biểu đồ', text: 'ECharts 5.5.0 được nạp qua CDN — kiểm tra kết nối Internet. Số liệu vẫn xem được ở chế độ "Bảng".' });
        return;
      }
      if (opt.__height) el.style.height = opt.__height + 'px';
      const chart = window.echarts.init(el, null, { renderer: 'canvas' });
      chart.setOption(opt);
      if (opts.onClick) chart.on('click', function (p) { opts.onClick(p, chart); });
      instances.push(chart);
      el.__chart = chart;
    };
    let tries = 0;
    const whenConnected = function () {
      if (el.isConnected || tries++ > 20) go();
      else (window.requestAnimationFrame || setTimeout)(whenConnected);
    };
    const ob = opts.eager ? null : getObserver();
    if (ob) { pending.set(el, go); ob.observe(el); }
    else if (el.isConnected) go();
    else Promise.resolve().then(whenConnected);   // thẻ chưa gắn vào DOM → vẽ sau khi gắn (tránh chiều rộng 0)
  };
  GT.charts.disposeAll = function () {
    instances.splice(0).forEach(function (c) { try { c.dispose(); } catch (e) { /* ignore */ } });
    pending.forEach(function (fn, el) { if (observer) observer.unobserve(el); });
    pending.clear();
  };
  GT.charts.flush = function () {   // vẽ ngay mọi biểu đồ đang chờ (dùng cho chart-catalog / in ấn)
    pending.forEach(function (fn, el) { if (observer) observer.unobserve(el); fn(); });
    pending.clear();
  };
  let rt = null;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { instances.forEach(function (c) { try { c.resize(); } catch (e) { /* ignore */ } }); }, 120);
  });
  window.addEventListener('beforeprint', function () { GT.charts.flush(); });

  // ------------------------------------------------------------------ Thành phần chung
  function base(extra) {
    return Object.assign({
      animationDuration: 280,
      textStyle: { fontFamily: FONT, color: C.ink2, fontSize: 12 },
      aria: { enabled: true, decal: { show: false } },
      tooltip: tooltip()
    }, extra || {});
  }
  function tooltip(extra) {
    return Object.assign({
      confine: true, backgroundColor: '#FFFFFF', borderColor: '#E8E3F0', borderWidth: 1, padding: [8, 10],
      textStyle: { color: C.ink, fontSize: 12, fontFamily: FONT },
      extraCssText: 'box-shadow:0 6px 20px rgba(31,35,48,.12);border-radius:8px;'
    }, extra || {});
  }
  function axisCommon() {
    return {
      axisLine: { lineStyle: { color: C.axis } },
      axisTick: { show: false },
      axisLabel: { color: C.muted, fontSize: 11.5 },
      splitLine: { lineStyle: { color: C.grid, width: 1, type: 'solid' } }
    };
  }
  function valAxis(fmt, extra) {
    return Object.assign({ type: 'value' }, axisCommon(), { axisLabel: { color: C.muted, fontSize: 11.5, formatter: fmt } }, extra || {});
  }
  function catAxis(data, extra) {
    return Object.assign({ type: 'category', data: data }, axisCommon(), { splitLine: { show: false } }, extra || {});
  }
  function legend(extra) {
    return Object.assign({ bottom: 0, left: 'center', icon: 'roundRect', itemWidth: 12, itemHeight: 10, itemGap: 14, textStyle: { color: C.ink2, fontSize: 12 } }, extra || {});
  }
  function esc(s) { return GT.util.escapeHtml(s); }
  function key(color, kind) {
    return kind === 'line'
      ? '<span style="display:inline-block;width:12px;height:2px;background:' + color + ';vertical-align:middle;margin-right:6px"></span>'
      : '<span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:' + color + ';vertical-align:middle;margin-right:6px"></span>';
  }
  function row(color, label, value, kind) {
    return '<div style="display:flex;gap:12px;justify-content:space-between;align-items:center;line-height:20px">' +
      '<span>' + key(color, kind) + '<span style="color:' + C.ink2 + '">' + esc(label) + '</span></span><b>' + value + '</b></div>';
  }
  GT.charts.tipRow = row;
  const pctAxis = function (v) { return F.num(v, 0) + '%'; };
  GT.charts.pctAxis = pctAxis;

  // ------------------------------------------------------------------ Donut (≤ 6 phần)
  /** items: [{name, value, color}]; center: {value, label}. Nhãn % đặt ngoài vòng. */
  GT.charts.donut = function (o) {
    const total = o.items.reduce(function (s, x) { return s + x.value; }, 0);
    if (!total) return { empty: o.empty };
    return base({
      tooltip: tooltip({ trigger: 'item', formatter: function (p) { return row(p.color, p.name, F.pct(p.value / total) + ' · ' + F.int(p.value) + ' ' + (o.unit || 'lượt')); } }),
      legend: legend({ show: o.legend !== false }),
      series: [{
        type: 'pie', radius: o.items.length > 4 ? ['46%', '66%'] : ['52%', '74%'], center: ['50%', o.legend === false ? '50%' : (o.items.length > 4 ? '42%' : '44%')], padAngle: 1,
        itemStyle: { borderColor: '#fff', borderWidth: 2, borderRadius: 3 },
        label: { color: C.ink2, fontSize: 12, formatter: function (p) { return p.value ? p.name + '\n' + F.pct(p.value / total) : ''; } },
        labelLine: { lineStyle: { color: C.axis } },
        data: o.items.map(function (x) { return { name: x.name, value: x.value, itemStyle: { color: x.color } }; })
      }].concat(o.center ? [{
        type: 'pie', radius: [0, '40%'], center: ['50%', o.legend === false ? '50%' : (o.items.length > 4 ? '42%' : '44%')], silent: true, tooltip: { show: false },
        itemStyle: { color: 'rgba(0,0,0,0)' }, labelLine: { show: false },
        label: { show: true, position: 'center', formatter: '{v|' + o.center.value + '}\n{l|' + o.center.label + '}',
          rich: { v: { fontSize: 22, fontWeight: 600, color: C.ink, lineHeight: 28, fontFamily: FONT }, l: { fontSize: 12, color: C.muted, lineHeight: 16, fontFamily: FONT } } },
        data: [{ value: 1, name: '' }]
      }] : [])
    });
  };

  // ------------------------------------------------------------------ Stacked bar (tuyệt đối hoặc 100%)
  /**
   * categories: nhãn trục; series: [{name, color, data: [đếm]}]; percent: chuẩn hóa 100%.
   * horizontal: thanh ngang (nhiều hạng mục / nhãn dài).
   */
  GT.charts.stack = function (o) {
    const n = o.categories.length;
    if (!n) return { empty: o.empty };
    const totals = [];
    for (let i = 0; i < n; i++) totals.push(o.series.reduce(function (s, x) { return s + (x.data[i] || 0); }, 0));
    if (!totals.some(function (t) { return t > 0; })) return { empty: o.empty };
    const pct = o.percent !== false;
    const series = o.series.map(function (s) {
      return {
        name: s.name, type: 'bar', stack: 'a', barMaxWidth: o.barWidth || 24,
        itemStyle: { color: s.color, borderColor: '#fff', borderWidth: 1 },
        emphasis: { focus: 'series' },
        data: s.data.map(function (v, i) { return pct ? (totals[i] ? v / totals[i] * 100 : null) : v; }),
        label: { show: !!o.labels, position: 'inside', color: C.textOn(s.color), fontSize: 11, formatter: function (p) { return p.value >= (o.labelMin || 9) ? F.num(p.value, 0) + '%' : ''; } }
      };
    });
    const vAxis = valAxis(pct ? pctAxis : function (v) { return F.int(v); }, pct ? { max: 100, min: 0 } : {});
    const cAxis = catAxis(o.categories, { axisLabel: { color: C.muted, fontSize: 11.5, interval: o.interval !== undefined ? o.interval : 'auto', rotate: o.rotate || 0, width: 120, overflow: 'truncate' }, inverse: !!o.horizontal });
    const opt = base({
      tooltip: tooltip({
        trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(168,120,216,.08)' } },
        formatter: function (ps) {
          const i = ps[0].dataIndex;
          let h = '<div style="margin-bottom:4px;font-weight:600">' + esc(o.tipTitle ? o.tipTitle(i) : o.categories[i]) + '</div>';
          ps.forEach(function (p) {
            const raw = o.series[p.seriesIndex].data[i] || 0;
            h += row(p.color, p.seriesName, pct ? F.pct(totals[i] ? raw / totals[i] : null) + ' · ' + F.int(raw) : F.int(raw));
          });
          h += '<div style="color:' + C.muted + ';margin-top:4px">Tổng: ' + F.int(totals[i]) + ' ' + (o.unit || 'lượt') + '</div>';
          if (o.tipExtra) h += o.tipExtra(i);
          return h;
        }
      }),
      legend: legend(),
      grid: { left: 8, right: 16, top: 12, bottom: 36, containLabel: true },
      xAxis: o.horizontal ? vAxis : cAxis,
      yAxis: o.horizontal ? cAxis : vAxis,
      series: series
    });
    if (o.horizontal) { opt.grid.bottom = o.series.length > 4 ? 62 : 40; opt.__height = Math.max(200, n * 30 + (o.series.length > 4 ? 110 : 80)); }
    if (o.dataZoom && n > o.dataZoom) {
      opt.dataZoom = [{ type: 'slider', height: 14, bottom: 26, start: 100 - Math.round(o.dataZoom / n * 100), end: 100, showDetail: false, borderColor: C.grid }];
      opt.grid.bottom = 64;
    }
    return opt;
  };

  // ------------------------------------------------------------------ Bar xếp hạng (ngang)
  /**
   * items: [{id, name, value, n, emph, note, color, unranked}] đã sort; fmt(value); marks: [{value, label}].
   * Thanh nổi bật dùng màu nhấn, còn lại màu xám nhạt (emphasis). Thanh không đủ mẫu: xám rất nhạt + ghi chú.
   */
  GT.charts.rankBar = function (o) {
    const items = o.items.filter(function (x) { return x.value !== null && x.value !== undefined; });
    if (!items.length) return { empty: o.empty };
    const fmt = o.fmt || function (v) { return F.num(v, 1); };
    const marks = (o.marks || []).filter(function (m) { return m.value !== null && m.value !== undefined; });
    const max = o.max !== undefined ? o.max : null;
    const opt = base({
      tooltip: tooltip({
        trigger: 'item',
        formatter: function (p) {
          const it = items[p.dataIndex];
          let h = '<div style="font-weight:600;margin-bottom:2px">' + esc(it.name) + '</div>' + row(p.color, o.valueLabel || 'Giá trị', fmt(it.value));
          if (it.n !== undefined) h += '<div style="color:' + C.muted + '">Mẫu số: ' + F.int(it.n) + ' ' + (o.unit || 'lượt') + '</div>';
          if (it.ref !== undefined && it.ref !== null) h += '<div style="color:' + C.muted + '">' + esc(o.refLabel || 'Mốc') + ': ' + fmt(it.ref) + '</div>';
          if (it.note) h += '<div style="color:' + C.muted + '">' + esc(it.note) + '</div>';
          marks.forEach(function (m) { h += '<div style="color:' + C.muted + '">' + esc(m.label) + (/\d/.test(m.label) ? '' : ': ' + fmt(m.value)) + '</div>'; });
          return h;
        }
      }),
      grid: { left: 8, right: 70, top: marks.length ? 26 : 8, bottom: 8, containLabel: true },
      xAxis: valAxis(o.axisFmt || fmt, Object.assign({ splitNumber: 4 }, max !== null ? { max: max } : {}, max === 100 && !o.min ? { interval: 25 } : {}, o.min !== undefined ? { min: o.min } : {})),
      yAxis: catAxis(items.map(function (x) { return x.name; }), { inverse: true, axisLabel: { color: C.ink2, fontSize: 12, width: o.labelWidth || 110, overflow: 'truncate' } }),
      series: [{
        type: 'bar', barMaxWidth: 16, barCategoryGap: '35%',
        data: items.map(function (x) {
          const col = x.color || (x.unranked ? '#ECE8F1' : (x.emph ? (o.accent || C.accent) : C.deemph));
          return { value: x.value, itemStyle: { color: col, borderRadius: [0, 4, 4, 0] } };
        }),
        label: { show: true, position: 'right', color: C.ink2, fontSize: 11.5, formatter: function (p) { const it = items[p.dataIndex]; return fmt(it.value) + (it.unranked ? ' *' : ''); } },
        markLine: marks.length ? {
          symbol: 'none', silent: true,
          label: { show: true, position: 'start', formatter: function (p) { return p.name; }, color: C.ink2, fontSize: 11, distance: 2 },
          data: marks.map(function (m, i) {
            return { name: /\d/.test(m.label) ? m.label : m.label + ' ' + fmt(m.value), xAxis: m.value, lineStyle: { color: m.color || (i ? C.blue : C.brandDark), width: 1.5, type: 'solid' }, label: { position: 'start', distance: i % 2 ? 14 : 2 } };
          })
        } : undefined
      }]
    });
    if (items.some(function (x) { return x.ref !== undefined && x.ref !== null; })) {
      opt.series.push({
        type: 'scatter', name: o.refLabel || 'Mốc', symbol: 'rect', symbolSize: [2, 18], z: 5, silent: true,
        itemStyle: { color: C.blue }, data: items.map(function (x) { return x.ref === undefined ? null : x.ref; })
      });
    }
    opt.__height = Math.max(120, items.length * (o.rowHeight || 26) + (marks.length ? 40 : 20));
    return opt;
  };

  // ------------------------------------------------------------------ Cột (dọc) nhóm
  GT.charts.columns = function (o) {
    if (!o.categories.length || !o.series.some(function (s) { return s.data.some(function (v) { return v !== null && v !== undefined; }); })) return { empty: o.empty };
    const fmt = o.fmt || function (v) { return F.num(v, 0); };
    const opt = base({
      tooltip: tooltip({
        trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(168,120,216,.08)' } },
        formatter: function (ps) {
          const i = ps[0].dataIndex;
          let h = '<div style="font-weight:600;margin-bottom:4px">' + esc(o.categories[i]) + '</div>';
          ps.forEach(function (p) { h += row(p.color, p.seriesName, p.value === null || p.value === undefined ? '–' : fmt(p.value)); });
          if (o.tipExtra) h += o.tipExtra(i);
          return h;
        }
      }),
      legend: legend({ show: o.series.length > 1 }),
      grid: { left: 8, right: 12, top: 18, bottom: o.series.length > 1 ? 36 : 10, containLabel: true },
      xAxis: catAxis(o.categories, { axisLabel: { color: C.muted, fontSize: 11.5, interval: o.interval !== undefined ? o.interval : 'auto', rotate: o.rotate || 0 } }),
      yAxis: valAxis(o.axisFmt || fmt, Object.assign(o.integer ? { minInterval: 1 } : {}, o.max !== undefined ? { max: o.max } : {}, o.min !== undefined ? { min: o.min } : {})),
      series: o.series.map(function (s) {
        return {
          name: s.name, type: 'bar', barMaxWidth: 22, barGap: '15%',
          itemStyle: { color: s.color || C.accent, borderRadius: [4, 4, 0, 0] },
          data: s.data.map(function (v, i) { return s.colors ? { value: v, itemStyle: { color: s.colors[i] } } : v; }),
          label: { show: !!s.labels, position: 'top', color: C.ink2, fontSize: 11, formatter: function (p) { return p.value === null || p.value === undefined ? '' : fmt(p.value); } },
          markLine: s.marks ? { symbol: 'none', silent: true, data: s.marks.map(function (m) { return { yAxis: m.value, name: m.label, lineStyle: { color: m.color || C.brandDark, width: 1.5, type: m.dashed ? 'dashed' : 'solid' }, label: { formatter: m.label, color: C.ink2, fontSize: 11, position: 'insideEndTop' } }; }) } : undefined
        };
      })
    });
    if (o.dataZoom && o.categories.length > o.dataZoom) {
      opt.dataZoom = [{ type: 'slider', height: 14, bottom: o.series.length > 1 ? 30 : 4, start: 0, end: Math.round(o.dataZoom / o.categories.length * 100), showDetail: false, borderColor: C.grid }];
      opt.grid.bottom += 26;
    }
    return opt;
  };

  // ------------------------------------------------------------------ Line (1 trục)
  /** categories: nhãn x; series: [{name, color, data, area, width, dashed}]; nhãn cuối đường khi ≤ 4 series. */
  GT.charts.line = function (o) {
    if (!o.categories.length || !o.series.some(function (s) { return s.data.some(function (v) { return v !== null && v !== undefined; }); })) return { empty: o.empty };
    const fmt = o.fmt || function (v) { return F.num(v, 1); };
    const endLabels = o.endLabels !== false && o.series.length <= 4;
    return base({
      tooltip: tooltip({
        trigger: 'axis', axisPointer: { type: 'line', lineStyle: { color: C.axis, width: 1 } },
        formatter: function (ps) {
          let h = '<div style="font-weight:600;margin-bottom:4px">' + esc(o.tipTitle ? o.tipTitle(ps[0].dataIndex) : ps[0].axisValueLabel) + '</div>';
          ps.forEach(function (p) {
            const s = o.series[p.seriesIndex];
            const extra = s.n ? ' <span style="color:' + C.muted + ';font-weight:400">(' + F.int(s.n[p.dataIndex]) + ')</span>' : '';
            h += row(p.color, p.seriesName, (p.value === null || p.value === undefined ? '–' : fmt(p.value)) + extra, 'line');
          });
          return h;
        }
      }),
      legend: legend({ show: o.series.length > 1, icon: 'path://M0,4 L16,4 L16,6 L0,6 Z', itemWidth: 16, itemHeight: 6 }),
      grid: { left: 8, right: endLabels ? 110 : 16, top: 18, bottom: o.series.length > 1 ? 36 : 10, containLabel: true },
      xAxis: catAxis(o.categories, { boundaryGap: false, axisLabel: { color: C.muted, fontSize: 11.5, interval: o.interval !== undefined ? o.interval : 'auto' } }),
      yAxis: valAxis(o.axisFmt || fmt, Object.assign({ scale: o.min === undefined }, o.max !== undefined ? { max: o.max } : {}, o.min !== undefined ? { min: o.min } : {})),
      series: o.series.map(function (s, i) {
        return {
          name: s.name, type: 'line', data: s.data, connectNulls: false, smooth: false,
          symbol: 'circle', symbolSize: 8, showSymbol: o.categories.length <= 20,
          lineStyle: { width: s.width || 2, color: s.color || C.series[i], type: s.dashed ? 'dashed' : 'solid', cap: 'round', join: 'round' },
          itemStyle: { color: s.color || C.series[i], borderColor: '#fff', borderWidth: 2 },
          areaStyle: s.area ? { color: s.color || C.series[i], opacity: 0.1 } : undefined,
          endLabel: endLabels ? { show: true, color: C.ink2, fontSize: 11.5, formatter: function (p) { return (o.series.length > 1 ? s.short || s.name : '') + (o.series.length > 1 ? ' ' : '') + (p.value === null ? '' : fmt(p.value)); } } : undefined,
          markLine: s.marks ? { symbol: 'none', silent: true, data: s.marks.map(function (m) { return { yAxis: m.value, lineStyle: { color: m.color || C.axis, width: 1, type: 'solid' }, label: { formatter: m.label, color: C.muted, fontSize: 11, position: 'insideStartTop' } }; }) } : undefined
        };
      })
    });
  };

  // ------------------------------------------------------------------ Heatmap giá trị (tuần tự / phân kỳ)
  /**
   * xCats, yCats; data: [[xi, yi, value, labelText?]]; scale: {min, max, colors} (tuần tự) hoặc {diverging: true, maxAbs}.
   * Mỗi ô hiển thị nhãn chữ (giá trị) — không truyền thông tin chỉ bằng màu.
   */
  GT.charts.heatmap = function (o) {
    if (!o.data.length) return { empty: o.empty };
    const sc = o.scale || {};
    let colorOf;
    if (sc.diverging) {
      const m = sc.maxAbs || 10;
      colorOf = function (v) {
        if (v === null || v === undefined) return '#F7F6F9';
        const t = Math.max(-1, Math.min(1, v / m));
        return mix(C.div.mid, t >= 0 ? C.div.pos : C.div.neg, Math.abs(t));
      };
    } else {
      const lo = sc.min !== undefined ? sc.min : 0, hi = sc.max !== undefined ? sc.max : 1;
      colorOf = function (v) { return v === null || v === undefined ? '#F7F6F9' : C.seqAt(hi > lo ? (v - lo) / (hi - lo) : 0); };
    }
    const opt = base({
      tooltip: tooltip({
        trigger: 'item',
        formatter: function (p) { return o.tip ? o.tip(p.data.raw) : esc(o.yCats[p.data.raw[1]]) + ' · ' + esc(o.xCats[p.data.raw[0]]) + ': <b>' + (p.data.raw[3] || F.num(p.data.raw[2], 1)) + '</b>'; }
      }),
      grid: { left: 8, right: 8, top: o.xTop ? 46 : 8, bottom: o.xTop ? 8 : 40, containLabel: true },
      xAxis: catAxis(o.xCats, { position: o.xTop ? 'top' : 'bottom', splitArea: { show: false }, axisLine: { show: false }, axisLabel: { color: C.ink2, fontSize: 11.5, interval: 0, rotate: o.rotate || 0, width: o.xLabelWidth || 90, overflow: o.rotate ? 'truncate' : 'break', lineHeight: 14 } }),
      yAxis: catAxis(o.yCats, { inverse: true, axisLine: { show: false }, axisLabel: { color: C.ink2, fontSize: 12, width: o.yLabelWidth || 120, overflow: 'truncate' } }),
      series: [{
        type: 'heatmap',
        data: o.data.map(function (d) {
          const col = d[4] || colorOf(d[2]);
          return { value: [d[0], d[1], d[2] === null || d[2] === undefined ? 0 : d[2]], raw: d, itemStyle: { color: col, borderColor: '#fff', borderWidth: 2, borderRadius: 3 }, label: { color: C.textOn(col) } };
        }),
        label: { show: o.labels !== false, fontSize: o.labelSize || 11, formatter: function (p) { return p.data.raw[3] !== undefined ? p.data.raw[3] : (p.data.raw[2] === null ? '–' : F.num(p.data.raw[2], 0)); } },
        emphasis: { itemStyle: { borderColor: C.ink, borderWidth: 1 } }
      }]
    });
    if (o.rowHeight) opt.__height = Math.max(140, o.yCats.length * o.rowHeight + (o.xTop ? 60 : 56) + (o.rotate ? 30 : 0));
    return opt;
  };
  function mix(a, b, t) {
    const pa = [1, 3, 5].map(function (i) { return parseInt(a.substr(i, 2), 16); });
    const pb = [1, 3, 5].map(function (i) { return parseInt(b.substr(i, 2), 16); });
    return '#' + pa.map(function (x, i) { return Math.round(x + (pb[i] - x) * t).toString(16).padStart(2, '0'); }).join('');
  }
  C.mix = mix;

  // ------------------------------------------------------------------ Calendar heatmap
  /** days: [{day: 'YYYY-MM-DD', value, label, tip}]; range: [from, to]; màu tuần tự theo value ∈ [min,max]. */
  GT.charts.calendar = function (o) {
    if (!o.days.length) return { empty: o.empty };
    const lo = o.min !== undefined ? o.min : 0, hi = o.max !== undefined ? o.max : 1;
    const months = [];
    for (let m = DT.startOfMonth(o.from); m < o.to; m = DT.addMonths(m, 1)) months.push(m);
    const opt = base({
      tooltip: tooltip({ trigger: 'item', formatter: function (p) { return o.days[p.dataIndex].tip; } }),
      calendar: months.map(function (m, i) {
        return {
          top: 30 + i * 150, left: 40, right: 16, cellSize: ['auto', 18], orient: 'horizontal',
          range: DT.dayKey(m).slice(0, 7),
          splitLine: { show: false }, itemStyle: { color: '#FBFAFD', borderColor: '#fff', borderWidth: 2 },
          dayLabel: { firstDay: 1, nameMap: ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'], color: C.muted, fontSize: 11 },
          monthLabel: { nameMap: ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'], color: C.ink2, fontSize: 12, position: 'start', margin: 8 },
          yearLabel: { show: false }
        };
      }),
      series: months.map(function (m, i) {
        const mk = DT.dayKey(m).slice(0, 7);
        return {
          type: 'heatmap', coordinateSystem: 'calendar', calendarIndex: i,
          data: o.days.filter(function (d) { return d.day.slice(0, 7) === mk; }).map(function (d) {
            const col = d.color || C.seqAt(hi > lo ? (d.value - lo) / (hi - lo) : 0);
            return { value: [d.day, d.value], itemStyle: { color: col }, label: { color: C.textOn(col) }, __tip: d.tip, __label: d.label };
          }),
          label: { show: true, fontSize: 9.5, formatter: function (p) { return p.data.__label || ''; } },
          tooltip: { formatter: function (p) { return p.data.__tip; } }
        };
      })
    });
    opt.__height = months.length * 150 + 30;
    return opt;
  };

  // ------------------------------------------------------------------ Boxplot
  GT.charts.boxplot = function (o) {
    const idx = [];
    o.boxes.forEach(function (b, i) { if (b) idx.push(i); });
    if (!idx.length) return { empty: o.empty };
    const cats = idx.map(function (i) { return o.categories[i]; });
    return base({
      tooltip: tooltip({
        trigger: 'item',
        formatter: function (p) {
          const i = idx[p.dataIndex], b = o.boxes[i];
          return '<div style="font-weight:600;margin-bottom:4px">' + esc(o.categories[i]) + '</div>' +
            ['Cao nhất', 'Q3 (75%)', 'Trung vị', 'Q1 (25%)', 'Thấp nhất'].map(function (l, k) { return row(C.brand, l, F.num(b[4 - k], 1)); }).join('') +
            (o.counts ? '<div style="color:' + C.muted + ';margin-top:4px">' + F.int(o.counts[i]) + ' ' + (o.unit || 'bài') + '</div>' : '') +
            (o.means ? '<div style="color:' + C.muted + '">Điểm TB: ' + F.num(o.means[i], 1) + '</div>' : '');
        }
      }),
      grid: { left: 8, right: 12, top: 14, bottom: 10, containLabel: true },
      xAxis: catAxis(cats, { axisLabel: { color: C.ink2, fontSize: 11.5, interval: 0, rotate: cats.length > 10 ? 40 : 0 } }),
      yAxis: valAxis(function (v) { return F.num(v, 0); }, { min: o.min !== undefined ? o.min : 0, max: o.max !== undefined ? o.max : 10 }),
      series: [{
        type: 'boxplot', boxWidth: [8, 22],
        itemStyle: { color: C.brandLight, borderColor: C.brandDark, borderWidth: 1.5 },
        data: idx.map(function (i) { return o.boxes[i]; })
      }]
    });
  };

  // ------------------------------------------------------------------ Scatter 4 góc phần tư
  /**
   * points: [{id, name, x, y, n, color}]; xMid/yMid: vạch trung vị; quadrants: [trên-trái, trên-phải, dưới-trái, dưới-phải].
   * 1 series → không cần legend; nhãn tên điểm (ẩn khi chồng chéo).
   */
  GT.charts.scatter = function (o) {
    const pts = o.points.filter(function (p) { return p.x !== null && p.y !== null && p.x !== undefined && p.y !== undefined; });
    if (!pts.length) return { empty: o.empty };
    const xf = o.xFmt || function (v) { return F.num(v, 0); }, yf = o.yFmt || function (v) { return F.num(v, 1); };
    const ml = [];
    if (o.xMid !== null && o.xMid !== undefined) ml.push({ xAxis: o.xMid, label: { formatter: o.xMidLabel || 'Trung vị', color: C.muted, fontSize: 11, position: 'start' } });
    if (o.yMid !== null && o.yMid !== undefined) ml.push({ yAxis: o.yMid, label: { formatter: o.yMidLabel || 'Trung vị', color: C.muted, fontSize: 11 } });
    const graphics = [];
    if (o.quadrants) {
      const pos = [{ left: 70, top: 4 }, { right: 40, top: 4 }, { left: 70, bottom: 52 }, { right: 40, bottom: 52 }];
      o.quadrants.forEach(function (q, i) { if (q) graphics.push(Object.assign({ type: 'text', style: { text: q, fill: C.muted, font: '11.5px ' + FONT } }, pos[i])); });
    }
    return base({
      graphic: graphics,
      tooltip: tooltip({
        trigger: 'item',
        formatter: function (p) {
          const it = pts[p.dataIndex];
          return '<div style="font-weight:600;margin-bottom:4px">' + esc(it.name) + '</div>' + row(it.color || C.accent, o.xName, xf(it.x)) + row(it.color || C.accent, o.yName, yf(it.y)) +
            (it.n !== undefined ? '<div style="color:' + C.muted + '">' + esc(o.nLabel || 'Mẫu') + ': ' + F.int(it.n) + '</div>' : '') + (it.extra || '');
        }
      }),
      grid: { left: 12, right: o.gridRight || 40, top: 34, bottom: 30, containLabel: true },
      xAxis: valAxis(xf, { name: o.xName, nameLocation: 'middle', nameGap: 26, nameTextStyle: { color: C.ink2, fontSize: 12 }, scale: true, min: o.xMin, max: o.xMax }),
      yAxis: valAxis(yf, { name: o.yName, nameLocation: 'end', nameTextStyle: { color: C.ink2, fontSize: 12, align: 'left' }, scale: true, min: o.yMin, max: o.yMax }),
      series: [{
        type: 'scatter', symbolSize: o.symbolSize || 11,
        itemStyle: { borderColor: '#fff', borderWidth: 2 },
        data: pts.map(function (p) { return { value: [p.x, p.y], name: p.name, itemStyle: { color: p.color || C.accent } }; }),
        label: { show: o.labels !== false, position: 'right', color: C.ink2, fontSize: 11, formatter: function (p) { return p.name; } },
        labelLayout: { hideOverlap: true },
        markLine: ml.length ? { symbol: 'none', silent: true, lineStyle: { color: C.axis, width: 1, type: 'solid' }, data: ml } : undefined
      }]
    });
  };

  // ------------------------------------------------------------------ Histogram
  GT.charts.histogram = function (o) {
    if (!o.counts.some(function (v) { return v > 0; })) return { empty: o.empty };
    return base({
      tooltip: tooltip({ trigger: 'item', formatter: function (p) { return '<div style="font-weight:600">' + esc(o.bins[p.dataIndex]) + '</div>' + row(p.color, o.yName || 'Số học sinh', F.int(p.value)); } }),
      grid: { left: 8, right: 12, top: 18, bottom: o.xName ? 30 : 10, containLabel: true },
      xAxis: catAxis(o.bins, { name: o.xName, nameLocation: 'middle', nameGap: 26, nameTextStyle: { color: C.ink2 }, axisLabel: { color: C.ink2, fontSize: 11.5, interval: 0 } }),
      yAxis: valAxis(function (v) { return F.int(v); }, { minInterval: 1 }),
      series: [{
        type: 'bar', barCategoryGap: '6%',
        data: o.counts.map(function (v, i) { return { value: v, itemStyle: { color: o.colors ? o.colors[i] : C.accent, borderRadius: [4, 4, 0, 0] } }; }),
        label: { show: true, position: 'top', color: C.ink2, fontSize: 11, formatter: function (p) { return p.value ? F.int(p.value) : ''; } }
      }]
    });
  };

  // ------------------------------------------------------------------ Funnel (thanh ngang, thứ bậc 1 sắc)
  GT.charts.funnel = function (o) {
    const first = o.stages.length ? o.stages[0].value : 0;
    if (!first) return { empty: o.empty };
    const ramp = ['#5B3E8C', '#7650AE', '#946AC9', '#B08BDB', '#CBB2E8'];
    const opt = base({
      tooltip: tooltip({ trigger: 'item', formatter: function (p) { const s = o.stages[p.dataIndex]; return '<b>' + esc(s.name) + '</b><br>' + F.int(s.value) + ' lượt · ' + F.pct(s.value / first) + ' so với "' + esc(o.stages[0].name) + '"' + (s.hint ? '<br><span style="color:' + C.muted + '">' + esc(s.hint) + '</span>' : ''); } }),
      grid: { left: 8, right: 110, top: 8, bottom: 8, containLabel: true },
      xAxis: valAxis(function (v) { return F.int(v); }, { show: false, max: first }),
      yAxis: catAxis(o.stages.map(function (s) { return s.name; }), { inverse: true, axisLabel: { color: C.ink2, fontSize: 12 } }),
      series: [{
        type: 'bar', barMaxWidth: 22,
        data: o.stages.map(function (s, i) { return { value: s.value, itemStyle: { color: ramp[Math.min(i, ramp.length - 1)], borderRadius: [0, 4, 4, 0] } }; }),
        label: { show: true, position: 'right', color: C.ink2, fontSize: 12, formatter: function (p) { return F.int(p.value) + ' · ' + F.pct(p.value / first, 0); } }
      }]
    });
    opt.__height = o.stages.length * 44 + 30;
    return opt;
  };

  // ------------------------------------------------------------------ Tiến độ thực tế vs kỳ vọng
  /** items: [{name, actual (0–1), expected (0–1), n, onTrack}] — thanh = thực tế, vạch đứng = kỳ vọng. */
  GT.charts.progress = function (o) {
    if (!o.items.length) return { empty: o.empty };
    const tol = o.tolerance || 0;
    const opt = base({
      tooltip: tooltip({
        trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(168,120,216,.08)' } },
        formatter: function (ps) {
          const it = o.items[ps[0].dataIndex];
          return '<div style="font-weight:600;margin-bottom:4px">' + esc(it.name) + '</div>' + row(C.accent, 'Tiến độ thực tế', F.pct(it.actual)) +
            row(C.ink, 'Tiến độ kỳ vọng', F.pct(it.expected), 'line') + (it.onTrackRate !== undefined ? row(C.status.GREEN, 'Học sinh đúng tiến độ', F.pct(it.onTrackRate)) : '') +
            (it.n !== undefined ? '<div style="color:' + C.muted + '">' + F.int(it.n) + ' học sinh</div>' : '');
        }
      }),
      grid: { left: 8, right: 54, top: 8, bottom: 22, containLabel: true },
      xAxis: valAxis(pctAxis, { min: 0, max: 100 }),
      yAxis: catAxis(o.items.map(function (x) { return x.name; }), { inverse: true, axisLabel: { color: C.ink2, fontSize: 12, width: o.labelWidth || 120, overflow: 'truncate' } }),
      series: [
        {
          type: 'bar', name: 'Tiến độ thực tế', barMaxWidth: 14,
          data: o.items.map(function (x) {
            const behind = x.actual * 100 < x.expected * 100 - tol;
            return { value: x.actual * 100, itemStyle: { color: behind ? C.status.ORANGE : C.accent, borderRadius: [0, 4, 4, 0] } };
          }),
          label: { show: true, position: 'right', color: C.ink2, fontSize: 11, formatter: function (p) { const x = o.items[p.dataIndex]; return F.num(p.value, 0) + '%' + (x.actual * 100 < x.expected * 100 - tol ? ' ! chậm' : ''); } }
        },
        {
          type: 'scatter', name: 'Tiến độ kỳ vọng', symbol: 'rect', symbolSize: [3, 22], z: 5,
          itemStyle: { color: C.ink }, data: o.items.map(function (x) { return x.expected * 100; })
        }
      ],
      legend: legend({ data: ['Tiến độ thực tế', 'Tiến độ kỳ vọng'], bottom: 0 })
    });
    opt.grid.bottom = 34;
    opt.__height = Math.max(140, o.items.length * 30 + 60);
    return opt;
  };

  // ------------------------------------------------------------------ Bullet (benchmark lớp vs nhóm vs trường)
  /** metrics: [{label, value, group, school, kind:'rate'|'score'}]; thang chung 0–100 (điểm × 10). */
  GT.charts.bullet = function (o) {
    const ms = o.metrics;
    const conv = function (m, v) { return v === null || v === undefined ? null : (m.kind === 'score' ? v * 10 : v * 100); };
    const show = function (m, v) { return v === null || v === undefined ? '–' : (m.kind === 'score' ? F.score(v) : F.pct(v)); };
    const opt = base({
      tooltip: tooltip({
        trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(168,120,216,.08)' } },
        formatter: function (ps) {
          const m = ms[ps[0].dataIndex];
          return '<div style="font-weight:600;margin-bottom:4px">' + esc(m.label) + '</div>' + row(C.accent, o.names[0], show(m, m.value)) +
            row(C.blue, o.names[1], show(m, m.group), 'line') + row(C.ink, o.names[2], show(m, m.school), 'line');
        }
      }),
      legend: legend({ data: o.names }),
      grid: { left: 8, right: 60, top: 6, bottom: 34, containLabel: true },
      xAxis: valAxis(function (v) { return F.num(v, 0); }, { min: 0, max: 100 }),
      yAxis: catAxis(ms.map(function (m) { return m.label; }), { inverse: true, axisLabel: { color: C.ink2, fontSize: 12, width: 160, overflow: 'truncate' } }),
      series: [
        { name: o.names[0], type: 'bar', barMaxWidth: 14, itemStyle: { color: C.accent, borderRadius: [0, 4, 4, 0] }, data: ms.map(function (m) { return conv(m, m.value); }),
          label: { show: true, position: 'right', color: C.ink2, fontSize: 11.5, formatter: function (p) { return show(ms[p.dataIndex], ms[p.dataIndex].value); } } },
        { name: o.names[1], type: 'scatter', symbol: 'rect', symbolSize: [3, 20], itemStyle: { color: C.blue }, data: ms.map(function (m) { return conv(m, m.group); }), z: 4 },
        { name: o.names[2], type: 'scatter', symbol: 'rect', symbolSize: [3, 20], itemStyle: { color: C.ink }, data: ms.map(function (m) { return conv(m, m.school); }), z: 5 }
      ]
    });
    opt.__height = ms.length * 40 + 60;
    return opt;
  };

  // ------------------------------------------------------------------ Timeline vận hành
  /**
   * rows: [{id, label}]; items: [{row, start, end, color, text, tip}]; from/to: trục thời gian; now: vạch "Bây giờ".
   */
  GT.charts.timeline = function (o) {
    if (!o.items.length) return { empty: o.empty };
    const rowIdx = new Map(o.rows.map(function (r, i) { return [r.id, i]; }));
    const data = o.items.map(function (it) { return { value: [rowIdx.get(it.row), it.start, it.end], itemStyle: { color: it.color }, __it: it }; });
    const opt = base({
      tooltip: tooltip({ trigger: 'item', formatter: function (p) { return p.data && p.data.__it ? p.data.__it.tip : ''; } }),
      grid: { left: 8, right: 18, top: 28, bottom: 26, containLabel: true },
      xAxis: {
        type: 'value', min: o.from, max: o.to, interval: DT.HOUR, position: 'top',
        axisLabel: { color: C.muted, fontSize: 11, formatter: function (v) { return DT.fmtTime(v); } },
        splitLine: { lineStyle: { color: C.grid } }, axisLine: { show: false }
      },
      yAxis: catAxis(o.rows.map(function (r) { return r.label; }), { inverse: true, axisLabel: { color: C.ink2, fontSize: 12 }, axisLine: { show: false } }),
      series: [{
        type: 'custom',
        renderItem: function (params, api) {
          const y = api.value(0), s = api.coord([api.value(1), y]), e = api.coord([api.value(2), y]);
          const h = api.size([0, 1])[1] * 0.62;
          const it = data[params.dataIndex].__it;
          const rect = { x: s[0], y: s[1] - h / 2, width: Math.max(2, e[0] - s[0]), height: h };
          return {
            type: 'group', children: [
              { type: 'rect', shape: Object.assign({ r: 4 }, rect), style: { fill: it.color, stroke: '#fff', lineWidth: 1 } },
              { type: 'text', style: { text: rect.width > 46 ? it.text : '', x: rect.x + 6, y: s[1], fill: C.textOn(it.color), font: '600 11px ' + FONT, textVerticalAlign: 'middle' }, silent: true }
            ]
          };
        },
        encode: { x: [1, 2], y: 0 },
        data: data,
        markLine: o.now ? { symbol: 'none', silent: true, lineStyle: { color: C.status.RED, width: 1.5, type: 'solid' }, label: { formatter: 'Bây giờ ' + DT.fmtTime(o.now), color: '#C2363B', fontSize: 11, position: 'end' }, data: [{ xAxis: o.now }] } : undefined
      }]
    });
    opt.__height = Math.max(160, o.rows.length * 30 + 70);
    return opt;
  };

  // ------------------------------------------------------------------ Heatmap phân loại (ô = trạng thái)
  /**
   * xCats, yCats; cells: [{x, y, color, text, tip}] — màu theo trạng thái + ký hiệu chữ trong ô.
   */
  GT.charts.catHeatmap = function (o) {
    if (!o.cells.length) return { empty: o.empty };
    const opt = base({
      tooltip: tooltip({ trigger: 'item', formatter: function (p) { return p.data.__tip; } }),
      grid: { left: 8, right: 8, top: o.xTop ? 60 : 8, bottom: o.xTop ? 8 : 50, containLabel: true },
      xAxis: catAxis(o.xCats, { position: o.xTop ? 'top' : 'bottom', axisLine: { show: false }, axisLabel: { color: C.ink2, fontSize: 11, interval: o.xInterval !== undefined ? o.xInterval : 0, rotate: o.rotate !== undefined ? o.rotate : (o.xCats.length > 14 ? 60 : 0) } }),
      yAxis: catAxis(o.yCats, { inverse: true, axisLine: { show: false }, axisLabel: { color: C.ink2, fontSize: 11.5, width: o.yLabelWidth || 130, overflow: 'truncate' } }),
      series: [{
        type: 'heatmap',
        data: o.cells.map(function (c) { return { value: [c.x, c.y, 1], itemStyle: { color: c.color, borderColor: '#fff', borderWidth: o.gap === undefined ? 2 : o.gap, borderRadius: 2 }, label: { color: C.textOn(c.color) }, __tip: c.tip, __text: c.text }; }),
        label: { show: o.labels !== false, fontSize: o.labelSize || 10.5, formatter: function (p) { return p.data.__text || ''; } },
        emphasis: { itemStyle: { borderColor: C.ink, borderWidth: 1 } }
      }]
    });
    opt.__height = Math.max(140, o.yCats.length * (o.rowHeight || 22) + (o.xTop ? 80 : 80));
    return opt;
  };
})(window.GT);
