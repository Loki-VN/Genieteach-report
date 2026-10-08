/**
 * GenieTeach — Báo cáo Học vụ (prototype)
 * ui.js — Khung trang, điều hướng giữ filter + kỳ dữ liệu, và component giao diện dùng chung.
 * CHỈ render; mọi số liệu lấy từ metrics.js / alerts.js.
 */
window.GT = window.GT || {};
(function (GT) {
  'use strict';
  const F = GT.fmt, DT = GT.date, U = GT.util;
  const esc = U.escapeHtml;
  const UI = GT.ui = {};
  UI.esc = esc;

  // =====================================================================================
  // Tiện ích DOM
  // =====================================================================================
  /** Tạo phần tử: el('div', {class:'x', onclick: fn}, [children | 'text']). */
  UI.el = function (tag, attrs, children) {
    const e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      const v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k === 'text') e.textContent = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else if (k.indexOf('on') === 0 && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    });
    (Array.isArray(children) ? children : children === undefined || children === null ? [] : [children]).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      e.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    });
    return e;
  };
  const el = UI.el;
  UI.html = function (s) { const t = document.createElement('template'); t.innerHTML = s.trim(); return t.content.firstElementChild; };

  // =====================================================================================
  // Hạng mục [ĐỀ XUẤT] — toggle cấp người xem (index.html)
  // =====================================================================================
  const PROP_KEY = 'gt.ui.showProposals';
  UI.showProposals = function () { return GT.store.get(PROP_KEY, true) !== false; };
  UI.setShowProposals = function (v) { GT.store.set(PROP_KEY, !!v); UI.applyProposals(); };
  UI.applyProposals = function () { document.body.classList.toggle('hide-proposals', !UI.showProposals()); };

  // =====================================================================================
  // Điều hướng — giữ filter và kỳ dữ liệu qua query string
  // =====================================================================================
  const KEEP = ['period', 'date', 'from', 'to', 'groupId', 'classId', 'courseId'];
  GT.nav = {
    KEEP: KEEP,
    /** Link tới trang khác, mang theo kỳ + filter hiện tại; patch ghi đè (null = bỏ). */
    href: function (page, patch) {
      const cur = GT.qs.parse();
      const o = {};
      KEEP.forEach(function (k) { if (cur[k]) o[k] = cur[k]; });
      Object.keys(patch || {}).forEach(function (k) { o[k] = patch[k]; });
      let hash = '';
      if (o['#']) { hash = '#' + o['#']; delete o['#']; }
      return page + GT.qs.build(o) + hash;
    },
    /** Cập nhật query string của trang hiện tại và render lại (không tải lại trang nếu trình duyệt cho phép). */
    update: function (patch, opts) {
      const q = Object.assign(GT.qs.parse(), patch);
      Object.keys(q).forEach(function (k) { if (q[k] === null || q[k] === undefined || q[k] === '') delete q[k]; });
      const url = window.location.pathname + GT.qs.build(q) + ((opts && opts.hash) || '');
      try {
        window.history.replaceState(null, '', url);
      } catch (e) {
        window.location.search = GT.qs.build(q);
        return;
      }
      if (GT.ui.rerender) GT.ui.rerender();
    }
  };

  // =====================================================================================
  // Khung trang
  // =====================================================================================
  const NAV = [
    { section: 'Báo cáo' },
    { id: 'overview', href: 'overview.html', label: 'Tổng quan', ico: '◎' },
    { id: 'attendance', href: 'attendance.html', label: 'Chuyên cần', ico: '✓' },
    { id: 'homework', href: 'homework.html', label: 'Học ở nhà', ico: '✎' },
    { id: 'courses', href: 'courses.html', label: 'Khóa học', ico: '▤', also: ['course-detail'] },
    { id: 'schedule', href: 'schedule.html', label: 'Lịch học', ico: '◷' },
    { id: 'class', href: 'class.html', label: 'Lớp học', ico: '▣' },
    { id: 'teachers', href: 'teachers.html', label: 'Vận hành giáo viên', ico: '☷', proposal: true, teacher: true },
    { id: 'student', href: 'student.html', label: 'Hồ sơ học sinh', ico: '☺', proposal: true },
    { id: 'alerts', href: 'alerts.html', label: 'Trung tâm cảnh báo', ico: '⚑', proposal: true, count: true },
    { section: 'Hệ thống' },
    { id: 'settings', href: 'settings.html', label: 'Cấu hình', ico: '⚙' },
    { id: 'chart-catalog', href: 'chart-catalog.html', label: 'Danh mục biểu đồ', ico: '▦' },
    { id: 'home', href: '../index.html', label: 'Trang chủ', ico: '⌂', raw: true }
  ];
  UI.NAV = NAV;

  function buildShell(def, ctx) {
    document.body.innerHTML = '';
    const nav = el('nav', { 'aria-label': 'Điều hướng báo cáo' });
    const openHigh = GT.alerts.filter(ctx.alerts(), { open: true, severity: 'HIGH' }).length;
    NAV.forEach(function (n) {
      if (n.section) { nav.appendChild(el('div', { class: 'nav-label', text: n.section })); return; }
      if (n.teacher && !ctx.cfg.display.showTeacherReport) return;
      const a = el('a', {
        href: n.raw ? n.href : GT.nav.href(n.href), 'data-nav': n.raw ? null : n.href,
        class: n.id === def.id || (n.also && n.also.indexOf(def.id) >= 0) ? 'active' : null,
        'data-proposal': n.proposal ? '' : null,
        'aria-current': n.id === def.id ? 'page' : null
      }, [el('span', { class: 'ico', 'aria-hidden': 'true', text: n.ico }), n.label]);
      if (n.count && openHigh) a.appendChild(el('span', { class: 'count', title: openHigh + ' cảnh báo mức Cao đang mở', text: String(openHigh) }));
      else if (n.proposal) a.appendChild(el('span', { class: 'tag', text: 'Đề xuất' }));
      nav.appendChild(a);
    });
    const side = el('aside', { class: 'sidebar' }, [
      el('div', { class: 'brand' }, [el('div', { class: 'logo', 'aria-hidden': 'true', text: 'G' }), el('div', {}, [el('b', { text: 'GenieTeach' }), el('span', { text: 'Báo cáo Học vụ' })])]),
      nav,
      el('div', { class: 'foot', text: ctx.cfg.school.name })
    ]);
    const menuBtn = el('button', { class: 'menu-btn', type: 'button', 'aria-label': 'Mở menu', onclick: function () { document.body.classList.toggle('nav-open'); } }, '☰');
    const top = el('header', { class: 'topbar' }, [
      menuBtn,
      el('div', {}, [el('h1', { text: def.title }), def.subtitle ? el('div', { class: 'subtitle', text: def.subtitle }) : null]),
      el('div', { class: 'now', title: 'Mốc "hôm nay" cố định trong config.js để demo' }, 'Hôm nay: ' + DT.fmtLongDate(ctx.now) + ' · ' + DT.fmtTime(ctx.now) + ' (dữ liệu mô phỏng)')
    ]);
    const filters = el('div', { class: 'filters', role: 'region', 'aria-label': 'Bộ lọc và kỳ dữ liệu' });
    const content = el('main', { class: 'content', id: 'content' });
    const footer = el('footer', { class: 'footer' });
    const main = el('div', { class: 'main' }, [top, filters, content, footer]);
    document.body.appendChild(el('div', { class: 'app' }, [side, main]));
    document.addEventListener('click', function (e) {
      if (document.body.classList.contains('nav-open') && !side.contains(e.target) && e.target !== menuBtn) document.body.classList.remove('nav-open');
    });
    return { filters: filters, content: content, footer: footer };
  }

  // =====================================================================================
  // Ngữ cảnh trang
  // =====================================================================================
  function buildCtx(def) {
    const D = GT.data.load();
    const cfg = GT.config.get();
    const now = D.meta.now;
    const q = GT.qs.parse();
    const f = def.filters || {};
    const ctx = { D: D, cfg: cfg, now: now, q: q, M: GT.metrics, A: GT.alerts, def: def };
    if (f.period) {
      ctx.period = GT.period.fromParams(q, f.period, now);
      ctx.range = GT.period.range(ctx.period, now);
      ctx.prev = GT.period.previous(ctx.period, now);
    }
    ctx.groupId = q.groupId && D.groupById.has(q.groupId) ? q.groupId : null;
    ctx.classId = q.classId && D.classById.has(q.classId) ? q.classId : null;
    if (ctx.classId && ctx.groupId && D.classById.get(ctx.classId).groupId !== ctx.groupId) ctx.classId = null;
    ctx.courseId = q.courseId && D.courseById.has(q.courseId) ? q.courseId : null;
    ctx.teacherId = q.teacherId && D.teacherById.has(q.teacherId) ? q.teacherId : null;
    ctx.scope = {
      groupIds: ctx.groupId ? [ctx.groupId] : null,
      classIds: ctx.classId ? [ctx.classId] : null,
      courseIds: ctx.courseId ? [ctx.courseId] : null,
      teacherIds: ctx.teacherId ? [ctx.teacherId] : null
    };
    let alertsCache = null;
    ctx.alerts = function () { if (!alertsCache) alertsCache = GT.alerts.list(D, cfg); return alertsCache; };
    ctx.href = function (page, patch) { return GT.nav.href(page, patch); };
    ctx.set = function (patch) { GT.nav.update(patch); };
    ctx.className = function (id) { const c = D.classById.get(id); return c ? c.name : id; };
    ctx.groupName = function (id) { const g = D.groupById.get(id); return g ? g.name : id; };
    ctx.courseName = function (id) { const c = D.courseById.get(id); return c ? c.name : id; };
    ctx.teacherName = function (id) { const t = D.teacherById.get(id); return t ? t.name : id; };
    ctx.studentName = function (id) { const s = D.studentById.get(id); return s ? s.fullName : id; };
    ctx.studentLabel = function (id) { const s = D.studentById.get(id); return s ? s.fullName + ' (' + s.code + ')' : id; };
    /** Lớp trong phạm vi filter (nhóm/lớp), đang hoạt động tại t. */
    ctx.classIdsInScope = function (activeAt) {
      let ids = GT.metrics.scope(D, { groupIds: ctx.scope.groupIds, classIds: ctx.scope.classIds }).classIds;
      if (activeAt !== undefined) ids = ids.filter(function (c) { return GT.metrics.isClassActive(D, c, activeAt); });
      if (ctx.courseId) ids = ids.filter(function (c) { return (D.idx.classCoursesByClass.get(c) || []).some(function (cc) { return cc.courseId === ctx.courseId; }); });
      return ids;
    };
    return ctx;
  }

  // =====================================================================================
  // Bộ lọc (một hàng phía trên mọi biểu đồ)
  // =====================================================================================
  function select(label, options, value, onChange, allLabel) {
    const s = el('select', { 'aria-label': label, onchange: function () { onChange(s.value || null); } });
    if (allLabel) s.appendChild(el('option', { value: '', text: allLabel }));
    options.forEach(function (o) { s.appendChild(el('option', { value: o.value, text: o.label, selected: o.value === value ? true : null })); });
    return el('label', { class: 'f' }, [label, s]);
  }
  UI.select = select;

  /** Component kỳ dữ liệu 4 chế độ. */
  UI.periodControl = function (ctx) {
    const st = ctx.period, r = ctx.range;
    const wrap = el('div', { class: 'period', role: 'group', 'aria-label': 'Kỳ dữ liệu' });
    const seg = el('div', { class: 'seg', role: 'tablist' });
    GT.period.MODES.forEach(function (m) {
      seg.appendChild(el('button', {
        type: 'button', class: st.mode === m ? 'on' : null, role: 'tab', 'aria-selected': st.mode === m ? 'true' : 'false',
        onclick: function () { ctx.set(GT.period.toParams(GT.period.withMode(st, m))); }
      }, GT.period.LABEL[m]));
    });
    wrap.appendChild(seg);
    const navb = el('div', { class: 'nav-btns' }, [
      el('button', { type: 'button', class: 'icon-btn', title: 'Kỳ trước', 'aria-label': 'Kỳ trước', onclick: function () { ctx.set(GT.period.toParams(GT.period.shift(st, -1, ctx.now))); } }, '◀'),
      el('span', { class: 'plabel', 'aria-live': 'polite' }, r.label),
      el('button', { type: 'button', class: 'icon-btn', title: 'Kỳ sau', 'aria-label': 'Kỳ sau', onclick: function () { ctx.set(GT.period.toParams(GT.period.shift(st, 1, ctx.now))); } }, '▶')
    ]);
    wrap.appendChild(navb);
    if (st.mode === 'custom') {
      const fi = el('input', { type: 'date', value: DT.dayKey(st.from), 'aria-label': 'Từ ngày' });
      const ti = el('input', { type: 'date', value: st.to ? DT.dayKey(st.to) : '', 'aria-label': 'Đến ngày', disabled: st.to ? null : true });
      const cb = el('input', { type: 'checkbox', checked: st.to ? null : true });
      const apply = function () {
        ctx.set({ period: 'custom', date: null, from: fi.value || DT.dayKey(st.from), to: cb.checked ? null : (ti.value || DT.dayKey(ctx.now)) });
      };
      fi.addEventListener('change', apply); ti.addEventListener('change', apply); cb.addEventListener('change', apply);
      wrap.appendChild(el('span', { class: 'custom' }, ['Từ', fi, 'đến', ti, el('label', { class: 'custom' }, [cb, 'đến hiện tại'])]));
    } else {
      wrap.appendChild(el('button', { type: 'button', class: 'btn sm', onclick: function () { ctx.set({ date: DT.dayKey(ctx.now) }); } }, st.mode === 'day' ? 'Hôm nay' : st.mode === 'week' ? 'Tuần này' : 'Tháng này'));
    }
    return wrap;
  };

  function renderFilters(container, def, ctx) {
    container.innerHTML = '';
    const f = def.filters || {};
    const D = ctx.D;
    if (f.period) container.appendChild(UI.periodControl(ctx));
    if (f.group) {
      container.appendChild(select('Nhóm lớp', D.groups.map(function (g) { return { value: g.id, label: g.name }; }), ctx.groupId, function (v) { ctx.set({ groupId: v, classId: null }); }, 'Tất cả nhóm lớp'));
    }
    if (f.class) {
      const cls = D.classes.filter(function (c) { return !ctx.groupId || c.groupId === ctx.groupId; });
      container.appendChild(select('Lớp', cls.map(function (c) { return { value: c.id, label: c.name }; }), ctx.classId, function (v) { ctx.set({ classId: v }); }, f.class === 'required' ? null : 'Tất cả lớp'));
    }
    if (f.course) {
      container.appendChild(select('Khóa học', D.courses.map(function (c) { return { value: c.id, label: c.name }; }), ctx.courseId, function (v) { ctx.set({ courseId: v }); }, f.course === 'required' ? null : 'Tất cả khóa học'));
    }
    if (f.teacher && ctx.cfg.display.showTeacherReport) {
      const used = new Set(D.sessions.map(function (s) { return s.teacherId; }));
      const lab = select('Giáo viên', D.teachers.filter(function (t) { return used.has(t.id); }).map(function (t) { return { value: t.id, label: t.name }; }), ctx.teacherId, function (v) { ctx.set({ teacherId: v }); }, 'Tất cả giáo viên');
      lab.setAttribute('data-proposal', '');
      container.appendChild(lab);
    }
    if (f.extra) f.extra(container, ctx);
    if (!container.childNodes.length) container.style.display = 'none'; else container.style.display = '';
  }

  // =====================================================================================
  // Vòng đời trang
  // =====================================================================================
  /**
   * Khai báo một trang: GT.page({ id, title, subtitle, filters: {period:'day'|'week'|null, group, class, course, teacher, extra}, render(ctx) }).
   */
  GT.page = function (def) {
    function start() {
      const t0 = performance.now();
      let shell, ctx;
      try {
        ctx = buildCtx(def);
        shell = buildShell(def, ctx);
        UI.applyProposals();
      } catch (e) {
        document.body.innerHTML = '<div class="content"><div class="callout error"><b>Lỗi khởi tạo trang:</b> ' + esc(e.message) + '</div></div>';
        console.error(e);
        return;
      }
      const draw = function (first) {
        const t1 = performance.now();
        GT.charts.disposeAll();
        UI.closeModal();
        const c = first ? ctx : buildCtx(def);
        renderFilters(shell.filters, def, c);
        shell.content.innerHTML = '';
        try {
          def.render(c, shell.content);
        } catch (e) {
          shell.content.innerHTML = '';
          shell.content.appendChild(el('div', { class: 'callout error' }, [el('b', { text: 'Lỗi khi hiển thị trang: ' }), e.message]));
          console.error(e);
        }
        document.querySelectorAll('.sidebar a[data-nav]').forEach(function (a) { a.href = GT.nav.href(a.getAttribute('data-nav')); });
        const D = c.D;
        const ms = performance.now() - (first ? t0 : t1);
        GT.renderMs = first ? performance.now() : ms;
        const ar = GT.alerts.run(D, c.cfg);
        shell.footer.innerHTML = '';
        shell.footer.appendChild(el('span', { text: 'Dữ liệu mô phỏng · seed ' + D.meta.seed + ' · ' + F.int(D.students.length) + ' học sinh · ' + F.int(D.attendance.length) + ' bản ghi điểm danh' }));
        shell.footer.appendChild(el('span', { text: 'Sinh dữ liệu ' + F.int(D.timing.generate) + ' ms · index ' + F.int(D.timing.index) + ' ms · cảnh báo ' + F.int(ar.ms) + ' ms · render ' + F.int(ms) + ' ms' }));
        shell.footer.appendChild(el('a', { href: '../docs/METRICS.md', text: 'Định nghĩa chỉ số' }));
        shell.footer.appendChild(el('a', { href: '../docs/OPEN-QUESTIONS.md', text: 'Giả định & câu hỏi mở' }));
        if (first && GT.debug) GT.alerts.debugPrint(D, c.cfg);
      };
      UI.rerender = function () { draw(false); };
      draw(true);
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') UI.closeModal(); });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  };

  // =====================================================================================
  // Component
  // =====================================================================================
  /** Tiêu đề phần. */
  UI.section = function (title, sub, opts) {
    return el('div', { class: 'section-title', id: opts && opts.id, 'data-proposal': opts && opts.proposal ? '' : null }, [
      el('h2', { text: title }), sub ? el('span', { class: 'muted', text: sub }) : null,
      opts && opts.proposal ? el('span', { class: 'badge proposal', text: 'Đề xuất' }) : null
    ]);
  };

  /** Chênh lệch so với kỳ trước. kind: 'rate' (điểm %) | 'score' (điểm) | 'count'. */
  UI.delta = function (cur, prev, kind, goodUp, complete, prevLabel) {
    if (prev === null || prev === undefined || cur === null || cur === undefined) {
      return { text: prevLabel ? 'Kỳ trước: –' : '', cls: 'neutral' };
    }
    if (kind === 'count' && !complete) return { text: 'Kỳ trước: ' + F.int(prev) + ' (kỳ này chưa kết thúc)', cls: 'neutral' };
    const d = cur - prev;
    const eps = kind === 'rate' ? 0.0005 : kind === 'score' ? 0.05 : 0.5;
    if (Math.abs(d) < eps) return { text: '± 0 so với kỳ trước', cls: 'neutral' };
    const up = d > 0;
    const arrow = up ? '▲ ' : '▼ ';
    const txt = kind === 'rate' ? F.pts(d) : kind === 'score' ? F.scoreDelta(d) : (up ? '+' : '−') + F.int(Math.abs(d));
    return { text: arrow + txt + ' so với kỳ trước', cls: goodUp === null || goodUp === undefined ? 'neutral' : (up === goodUp ? 'good' : 'bad') };
  };

  /**
   * KPI tile: {label, value, sub, delta:{cur, prev, kind, goodUp, complete}, href, ref, title, proposal}.
   */
  UI.kpi = function (o) {
    const tag = o.href ? 'a' : 'div';
    const k = el(tag, { class: 'kpi', href: o.href || null, title: o.title || null, 'data-proposal': o.proposal ? '' : null });
    if (o.ref) k.appendChild(el('span', { class: 'ref', text: o.ref }));
    k.appendChild(el('span', { class: 'label', text: o.label }));
    k.appendChild(el('span', { class: 'value', text: o.value === null || o.value === undefined ? '–' : o.value, title: o.value === '–' ? (o.emptyTitle || 'Không có dữ liệu (mẫu số = 0)') : null }));
    if (o.sub) k.appendChild(el('span', { class: 'sub', text: o.sub }));
    if (o.delta) {
      const d = UI.delta(o.delta.cur, o.delta.prev, o.delta.kind, o.delta.goodUp, o.delta.complete, true);
      if (d.text) k.appendChild(el('span', { class: 'delta ' + d.cls, text: d.text }));
    }
    return k;
  };
  UI.kpis = function (list) { return el('div', { class: 'kpis' }, list.map(UI.kpi)); };

  /**
   * Thẻ biểu đồ/bảng:
   * {title, question, proposal, badges:[{cls,text}], chart:{build, height, onClick}, body, table: () => {columns, rows, csv},
   *  note, cause:true (dòng lưu ý mục 3.6), cls, id, tools:[el], legend:[{color,label}]}
   */
  UI.card = function (o) {
    const card = el('section', { class: 'card ' + (o.cls || ''), id: o.id || null, 'data-proposal': o.proposal ? '' : null, 'aria-label': o.title });
    const tools = el('div', { class: 'tools' });
    const head = el('div', { class: 'card-head' }, [el('h3', { text: o.title })]);
    if (o.proposal) head.appendChild(el('span', { class: 'badge proposal', text: 'Đề xuất' }));
    (o.badges || []).forEach(function (b) { head.appendChild(el('span', { class: 'badge ' + b.cls, text: b.text })); });
    head.appendChild(tools);
    card.appendChild(head);
    if (o.question) card.appendChild(el('div', { class: 'question' + (o.plain ? ' plain' : ''), text: o.question }));
    const bodyWrap = el('div', { class: 'card-body' });
    card.appendChild(bodyWrap);
    let chartEl = null;
    if (o.chart) {
      chartEl = el('div', { class: 'chart', role: 'img', 'aria-label': o.title });
      bodyWrap.appendChild(chartEl);
      GT.charts.mount(chartEl, o.chart.build, { height: o.chart.height, onClick: o.chart.onClick, eager: o.chart.eager });
    }
    if (o.body) bodyWrap.appendChild(typeof o.body === 'string' ? UI.html('<div>' + o.body + '</div>') : o.body);
    if (o.legend) card.appendChild(UI.legend(o.legend));
    (o.tools || []).forEach(function (t) { tools.appendChild(t); });
    if (o.table) {
      let tableEl = null;
      const tbtn = el('button', { type: 'button', class: 'btn sm', 'aria-pressed': 'false', title: 'Xem số liệu dạng bảng (bản tương đương không phụ thuộc màu)' }, 'Bảng');
      tbtn.addEventListener('click', function () {
        const on = tbtn.getAttribute('aria-pressed') !== 'true';
        tbtn.setAttribute('aria-pressed', on ? 'true' : 'false');
        tbtn.classList.toggle('primary', on);
        if (on) {
          if (!tableEl) { const t = o.table(); tableEl = UI.table(Object.assign({ capped: true }, t)); }
          bodyWrap.appendChild(tableEl);
          if (chartEl) chartEl.style.display = 'none';
        } else {
          if (tableEl) tableEl.remove();
          if (chartEl) chartEl.style.display = '';
        }
      });
      tools.appendChild(tbtn);
    }
    if (o.cause) card.appendChild(el('div', { class: 'note cause', text: GT.metrics.CAUSE_NOTE }));
    if (o.note) card.appendChild(el('div', { class: 'note', html: o.note }));
    return card;
  };

  UI.legend = function (items) {
    return el('div', { class: 'legend', role: 'list' }, items.map(function (i) {
      return el('span', { role: 'listitem' }, [el('i', { style: { background: i.color }, 'aria-hidden': 'true' }), i.label]);
    }));
  };
  UI.empty = function (title, text) { return UI.html(GT.charts.emptyHtml({ title: title, text: text })); };

  // ---------------------------------------------------------------- Bảng sort được + CSV
  /**
   * {columns:[{key,label,align,fmt(row)→html, value(row)→sort/csv, sort:false, csv(row)}], rows, sort:{key,dir},
   *  onRow(row), rowClass(row), csv:'ten.csv', empty, capped, limit, caption}
   */
  UI.table = function (o) {
    const wrap = el('div', { class: 'tbl-block' });
    const tw = el('div', { class: 'tbl-wrap' + (o.capped ? ' capped' : ''), style: o.maxHeight ? { maxHeight: o.maxHeight } : null });
    const table = el('table', { class: 'tbl' });
    if (o.caption) table.appendChild(el('caption', { class: 'sr-only', text: o.caption }));
    const thead = el('thead'), tbody = el('tbody');
    table.appendChild(thead); table.appendChild(tbody);
    tw.appendChild(table);
    wrap.appendChild(tw);
    let sort = o.sort ? Object.assign({}, o.sort) : null;
    const val = function (c, r) { return c.value ? c.value(r) : r[c.key]; };
    function draw() {
      thead.innerHTML = ''; tbody.innerHTML = '';
      const tr = el('tr');
      o.columns.forEach(function (c) {
        const sortable = c.sort !== false;
        const th = el('th', { class: (c.align || '') + (sortable ? ' sortable' : ''), scope: 'col', title: c.title || null, style: c.width || c.minWidth ? { width: c.width || null, minWidth: c.minWidth || null } : null, 'aria-sort': sort && sort.key === c.key ? (sort.dir > 0 ? 'ascending' : 'descending') : null }, c.label);
        if (sort && sort.key === c.key) th.appendChild(el('span', { class: 'arrow', 'aria-hidden': 'true', text: sort.dir > 0 ? '▲' : '▼' }));
        if (sortable) th.addEventListener('click', function () { sort = { key: c.key, dir: sort && sort.key === c.key ? -sort.dir : (c.align === 'r' ? -1 : 1) }; draw(); });
        tr.appendChild(th);
      });
      thead.appendChild(tr);
      let rows = o.rows.slice();
      if (sort) {
        const c = o.columns.filter(function (x) { return x.key === sort.key; })[0];
        if (c) {
          rows.sort(function (a, b) {
            if (o.pinBottom) { const pa = o.pinBottom(a), pb = o.pinBottom(b); if (pa !== pb) return pa ? 1 : -1; }
            const va = val(c, a), vb = val(c, b);
            const na = va === null || va === undefined || (typeof va === 'number' && isNaN(va)), nb = vb === null || vb === undefined || (typeof vb === 'number' && isNaN(vb));
            if (na !== nb) return na ? 1 : -1;
            if (na) return 0;
            if (typeof va === 'string') return va.localeCompare(vb, 'vi') * sort.dir;
            return (va - vb) * sort.dir;
          });
        }
      }
      const shown = o.limit ? rows.slice(0, o.limit) : rows;
      if (!shown.length) {
        tbody.appendChild(el('tr', {}, [el('td', { colspan: String(o.columns.length), class: 'muted', style: { textAlign: 'center', padding: '18px' }, text: o.empty || 'Không có dữ liệu trong phạm vi đang chọn.' })]));
      }
      shown.forEach(function (r) {
        const row = el('tr', { class: [o.onRow ? 'click' : '', o.rowClass ? o.rowClass(r) || '' : ''].join(' ').trim() || null, tabindex: o.onRow ? '0' : null });
        o.columns.forEach(function (c) {
          const td = el('td', { class: c.align || null });
          if (c.fmt) td.innerHTML = c.fmt(r); else { const v = val(c, r); td.textContent = v === null || v === undefined ? '–' : String(v); }
          row.appendChild(td);
        });
        if (o.onRow) {
          row.addEventListener('click', function (e) { if (e.target.closest('a,button,select,input,textarea')) return; o.onRow(r, e); });
          row.addEventListener('keydown', function (e) { if (e.key === 'Enter') o.onRow(r, e); });
        }
        tbody.appendChild(row);
      });
      foot.innerHTML = '';
      foot.appendChild(el('span', { text: (o.limit && rows.length > o.limit ? 'Hiển thị ' + o.limit + '/' + rows.length + ' dòng' : rows.length + ' dòng') + (o.footNote ? ' · ' + o.footNote : '') }));
      if (o.csv !== false) {
        foot.appendChild(el('button', {
          type: 'button', class: 'btn sm', onclick: function () {
            GT.csv.download(o.csv || 'bao-cao.csv', o.columns.filter(function (c) { return c.csv !== false; }).map(function (c) { return c.label; }),
              rows.map(function (r) { return o.columns.filter(function (c) { return c.csv !== false; }).map(function (c) { return c.csv ? c.csv(r) : val(c, r); }); }));
          }
        }, '⭳ Xuất CSV'));
      }
    }
    const foot = el('div', { class: 'tbl-foot' });
    wrap.appendChild(foot);
    draw();
    return wrap;
  };

  // ---------------------------------------------------------------- Modal
  let openModal = null;
  UI.closeModal = function () {
    if (!openModal) return;
    const m = openModal;
    openModal = null;
    m.querySelectorAll('.chart').forEach(function (c) { if (c.__chart) { try { c.__chart.dispose(); } catch (e) { /* ignore */ } } });
    m.remove();
    document.body.style.overflow = '';
  };
  /** {title, subtitle, body: el, narrow} */
  UI.modal = function (o) {
    UI.closeModal();
    const body = el('div', { class: 'modal-body' });
    const box = el('div', { class: 'modal' + (o.narrow ? ' narrow' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': o.title }, [
      el('div', { class: 'modal-head' }, [
        el('div', {}, [el('h3', { text: o.title }), o.subtitle ? el('div', { class: 'muted small', text: o.subtitle }) : null]),
        el('button', { type: 'button', class: 'x', 'aria-label': 'Đóng', onclick: UI.closeModal }, '×')
      ]),
      body
    ]);
    const back = el('div', { class: 'modal-back', onclick: function (e) { if (e.target === back) UI.closeModal(); } }, [box]);
    document.body.appendChild(back);
    document.body.style.overflow = 'hidden';
    openModal = back;
    if (o.body) body.appendChild(o.body);
    const x = box.querySelector('.x'); if (x) x.focus();
    return { body: body, close: UI.closeModal };
  };
  /** Gắn biểu đồ trong modal (vẽ ngay). */
  UI.modalChart = function (container, build, height, onClick) {
    const c = el('div', { class: 'chart' });
    container.appendChild(c);
    GT.charts.mount(c, build, { height: height, onClick: onClick, eager: true });
    return c;
  };

  // ---------------------------------------------------------------- Popup so sánh lớp / nhóm lớp
  /**
   * {title, question, metricLabel, kind:'rate'|'score', items:[{id, name, groupId, value, n, href, extra}], school, groupAvg,
   *  higherIsBetter, unit, minSample, entity:'lớp'|'nhóm lớp', cause:true, onPick(item), extraCols}
   * Bảng trái (sort được, cột chênh lệch so với TB trường), biểu đồ phải; click → điều hướng.
   */
  /** Định dạng theo loại chỉ số: rate (0–1 → %), score (thang 10), score100 (thang 100). */
  UI.KIND = {
    rate: { fmt: function (v) { return F.pct(v); }, delta: function (d) { return F.pts(d); }, scale: 100, axisFmt: function (v) { return F.num(v, 0) + '%'; }, max: 100 },
    score: { fmt: function (v) { return F.score(v); }, delta: function (d) { return F.scoreDelta(d); }, scale: 1, axisFmt: function (v) { return F.num(v, 0); }, max: 10 },
    score100: { fmt: function (v) { return F.num(v, 1); }, delta: function (d) { return F.scoreDelta(d); }, scale: 1, axisFmt: function (v) { return F.num(v, 0); }, max: 100 }
  };

  /**
   * {title, question, metricLabel, kind:'rate'|'score'|'score100', items:[{id, name, groupId, value, n, href}], school, groupAvg,
   *  higherIsBetter, unit, minSample, entity:'lớp'|'nhóm lớp', cause:true, onPick(item), extraCols, csvName}
   * Bảng trái (sort được, cột chênh lệch so với TB trường), biểu đồ phải; click → điều hướng.
   */
  UI.comparePopup = function (o) {
    const K = UI.KIND[o.kind || 'rate'];
    const minS = o.minSample !== undefined ? o.minSample : GT.config.get().ranking.minSample;
    const items = o.items.map(function (x) { return Object.assign({ unranked: x.n < minS || x.value === null || x.value === undefined }, x); });
    const ranked = items.filter(function (x) { return !x.unranked; }).sort(function (a, b) { return (o.higherIsBetter === false ? 1 : -1) * (a.value - b.value); });
    ranked.forEach(function (x, i) { x.rank = i + 1; });
    const ordered = ranked.concat(items.filter(function (x) { return x.unranked; }));
    const body = el('div');
    if (o.question) body.appendChild(el('div', { class: 'muted small', style: { marginBottom: '10px' }, text: 'Câu hỏi: ' + o.question }));
    const grid = el('div', { class: 'compare' });
    const left = el('div'), right = el('div');
    grid.appendChild(left); grid.appendChild(right);
    body.appendChild(grid);
    const school = o.school === undefined ? null : o.school;
    const cols = [
      { key: 'rank', label: 'Hạng', align: 'c', fmt: function (r) { return r.unranked ? '<span class="muted" title="Chưa đủ mẫu để xếp hạng">–</span>' : String(r.rank); } },
      { key: 'name', label: o.entity === 'nhóm lớp' ? 'Nhóm lớp' : 'Lớp', fmt: function (r) { return '<b>' + esc(r.name) + '</b>' + (r.groupId && o.entity !== 'nhóm lớp' ? '<div class="muted small">' + esc(GT.D.groupById.get(r.groupId).name) + '</div>' : ''); } },
      { key: 'value', label: o.metricLabel, align: 'r', fmt: function (r) { return K.fmt(r.value) + (r.unranked ? ' <span class="muted" title="Chưa đủ mẫu">*</span>' : ''); } },
      { key: 'n', label: 'Mẫu số', align: 'r', fmt: function (r) { return F.int(r.n) + ' <span class="muted small">' + esc(o.unit || 'lượt') + '</span>'; } },
      { key: 'diff', label: 'Chênh lệch TB trường', align: 'r', value: function (r) { return r.value === null || r.value === undefined || school === null ? null : r.value - school; }, fmt: function (r) { return r.value === null || r.value === undefined || school === null ? '–' : K.delta(r.value - school); } }
    ].concat(o.extraCols || []);
    left.appendChild(UI.table({
      columns: cols, rows: ordered, sort: { key: 'rank', dir: 1 }, capped: true, csv: (o.csvName || 'so-sanh') + '.csv',
      pinBottom: function (r) { return r.unranked; },
      rowClass: function (r) { return r.unranked ? 'muted-row' : ''; },
      onRow: function (r) { if (o.onPick) o.onPick(r); else if (r.href) window.location.href = r.href; },
      footNote: '* chưa đủ ' + minS + ' ' + (o.unit || 'lượt') + ' — không xếp hạng'
    }));
    const marks = [{ value: school, label: 'TB trường' }];
    if (o.groupAvg !== undefined && o.groupAvg !== null) marks.push({ value: o.groupAvg, label: 'TB nhóm lớp', color: GT.colors.blue });
    const chartWrap = el('div', { style: { maxHeight: '560px', overflowY: 'auto' } });
    right.appendChild(chartWrap);
    UI.modalChart(chartWrap, function () {
      return GT.charts.rankBar({
        items: ordered.map(function (x) {
          return { id: x.id, name: x.name, value: x.value === null || x.value === undefined ? null : x.value * K.scale, n: x.n, emph: !x.unranked && x.rank <= 5, unranked: x.unranked, note: x.unranked ? 'Chưa đủ mẫu để xếp hạng' : null, ref: x.ref === undefined || x.ref === null ? undefined : x.ref * K.scale };
        }),
        fmt: function (v) { return K.fmt(v / K.scale); }, axisFmt: K.axisFmt, max: K.max,
        marks: marks.filter(function (m) { return m.value !== null && m.value !== undefined; }).map(function (m) { return { value: m.value * K.scale, label: m.label, color: m.color }; }),
        refLabel: 'TB nhóm lớp',
        valueLabel: o.metricLabel, unit: o.unit
      });
    }, 300, function (p) { const it = ordered[p.dataIndex]; if (!it) return; if (o.onPick) o.onPick(it); else if (it.href) window.location.href = it.href; });
    if (o.cause) body.appendChild(el('div', { class: 'note cause', style: { marginTop: '12px' }, text: GT.metrics.CAUSE_NOTE }));
    body.appendChild(el('div', { class: 'muted small', style: { marginTop: '8px' }, text: 'Nhấn vào ' + (o.entity || 'lớp') + ' để xem chi tiết. Top 5 được tô đậm; đường dọc là mốc trung bình (cộng gộp, không lấy trung bình các tỉ lệ)' + (ordered.some(function (x) { return x.ref !== undefined && x.ref !== null; }) ? '; vạch nhỏ trên mỗi thanh là TB nhóm lớp của lớp đó.' : '.') }));
    UI.modal({ title: o.title, subtitle: o.subtitle, body: body });
  };

  // ---------------------------------------------------------------- Khối cảnh báo
  /** {alerts, title, moreHref, max, empty, filterText} — nhóm theo mức, tối đa 5 dòng/nhóm, "Xem tất cả". */
  UI.alertBlock = function (o) {
    const max = o.max || 5;
    const open = o.alerts.filter(function (a) { return a.status !== 'RESOLVED' && a.status !== 'IGNORED'; });
    const body = el('div', { class: 'alert-block' });
    if (!open.length) body.appendChild(UI.empty('Không có cảnh báo đang mở', o.empty || 'Không có cảnh báo nào khớp phạm vi đang chọn.'));
    GT.alerts.SEVERITY_ORDER.forEach(function (sev) {
      const list = open.filter(function (a) { return a.severity === sev; });
      if (!list.length) return;
      const g = el('div', { class: 'alert-group' }, [el('h4', {}, [UI.sevBadge(sev), el('span', { text: list.length + ' cảnh báo' })])]);
      list.slice(0, max).forEach(function (a) { g.appendChild(UI.alertItem(a)); });
      if (list.length > max && o.moreHref) g.appendChild(el('a', { class: 'alert-more', href: o.moreHref + (o.moreHref.indexOf('?') >= 0 ? '&' : '?') + 'severity=' + sev, text: 'Xem thêm ' + (list.length - max) + ' cảnh báo mức ' + GT.alerts.SEVERITY[sev].label.toLowerCase() + ' →' }));
      body.appendChild(g);
    });
    const tools = o.moreHref ? [el('a', { class: 'btn sm', href: o.moreHref, text: 'Xem tất cả (' + open.length + ')' })] : [];
    return UI.card({ title: o.title || 'Cảnh báo bất thường', question: o.question || 'Đối tượng nào đang vượt ngưỡng cảnh báo và cần Học vụ xử lý?', body: body, tools: tools, cls: o.cls, id: o.id, note: o.note });
  };
  UI.alertItem = function (a) {
    const meta = GT.alerts.SCOPE_LABEL[a.scope] + ' · ' + a.ruleId + ' · ' + DT.fmtDateTime(a.detectedAt);
    return el('div', { class: 'alert-item' }, [
      el('span', { class: 'sev ' + a.severity, title: 'Mức ' + GT.alerts.SEVERITY[a.severity].label }, GT.alerts.SEVERITY[a.severity].icon),
      el('span', { class: 't' }, [a.title, a.children ? el('span', { class: 'muted small', text: ' (' + a.children.length + ' học sinh)' }) : null]),
      el('a', { class: 'small nowrap', href: a.drilldownUrl, text: 'Chi tiết →' }),
      el('div', { class: 'r' }, [a.reason, el('div', { class: 'meta', text: meta + (a.status !== 'NEW' ? ' · ' + GT.alerts.STATUS[a.status] : '') })])
    ]);
  };

  // ---------------------------------------------------------------- Chip / badge
  UI.sevBadge = function (sev) {
    const s = GT.alerts.SEVERITY[sev];
    return el('span', { class: 'sev ' + sev }, s.icon + ' ' + s.label);
  };
  /** Ô màu trạng thái CĐR kèm ký hiệu + chữ. */
  UI.colorChip = function (color, text) {
    const m = GT.metrics.COLOR_META[color];
    const bg = m.color;
    const t = text === undefined ? m.label : String(text);
    return '<span class="st-chip" style="background:' + bg + ';color:' + GT.colors.textOn(bg) + '" title="' + m.label + '">' + (t.indexOf(m.icon) === 0 ? '' : m.icon + ' ') + esc(t) + '</span>';
  };
  UI.levelChip = function (level, text) {
    const m = GT.metrics.LEVEL_META[level];
    return '<span class="st-chip" style="background:' + m.color + ';color:' + GT.colors.textOn(m.color) + '" title="' + m.label + '">' + esc(text === undefined ? m.label : text) + '</span>';
  };
  UI.attChip = function (status) {
    const c = GT.colors.att[status];
    return '<span class="st-chip" style="background:' + c + ';color:' + GT.colors.textOn(c) + '">' + GT.labels.attCode[status] + ' · ' + GT.labels.att[status] + '</span>';
  };
  UI.dotLabel = function (color, label) {
    return '<span class="st"><span class="dot" style="background:' + color + '"></span>' + esc(label) + '</span>';
  };
  UI.causeBadge = function (label) {
    if (!label || label === 'NONE') return '';
    const cls = label === 'CURRICULUM' ? 'cur' : label === 'CLASS' ? 'cls' : 'insuf';
    return '<span class="badge ' + cls + '">' + esc(GT.metrics.CAUSE_TEXT[label]) + '</span>';
  };
  UI.thinBadge = function () { return '<span class="badge thin" title="0 < coverage < ngưỡng dữ liệu mỏng">Dữ liệu mỏng</span>'; };
  /** Thanh 100% HTML (dùng trong bảng): parts [{value, color, label}]. */
  UI.stack100 = function (parts) {
    const tot = parts.reduce(function (s, p) { return s + p.value; }, 0);
    if (!tot) return '<span class="muted">–</span>';
    return '<span class="stack100" role="img" aria-label="' + esc(parts.map(function (p) { return p.label + ' ' + F.pct(p.value / tot, 0); }).join(', ')) + '">' +
      parts.filter(function (p) { return p.value > 0; }).map(function (p) {
        return '<span style="width:' + (p.value / tot * 100).toFixed(2) + '%;background:' + p.color + '" title="' + esc(p.label + ': ' + F.pct(p.value / tot) + ' (' + F.int(p.value) + ')') + '"></span>';
      }).join('') + '</span>';
  };
  UI.levelStack = function (levels) {
    return UI.stack100(GT.metrics.LEVELS.map(function (l) { return { value: levels[l] || 0, color: GT.colors.level[l], label: GT.metrics.LEVEL_META[l].label }; }));
  };
  UI.levelLegend = function () {
    return UI.legend(GT.metrics.LEVELS.map(function (l) { return { color: GT.colors.level[l], label: GT.metrics.LEVEL_META[l].label + ' (' + GT.metrics.LEVEL_META[l].short + ')' }; }));
  };
  UI.miniBar = function (v, max, color) {
    if (v === null || v === undefined) return '';
    return '<span class="minibar" style="width:' + Math.max(2, Math.round(v / (max || 1) * 60)) + 'px;background:' + (color || GT.colors.accent) + '"></span>';
  };
  UI.toast = function (msg) {
    const t = el('div', { class: 'toast', role: 'status', text: msg });
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2600);
  };
  UI.link = function (href, text) { return '<a href="' + esc(href) + '">' + esc(text) + '</a>'; };
})(window.GT);
