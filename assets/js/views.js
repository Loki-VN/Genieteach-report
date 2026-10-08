/**
 * GenieTeach — Báo cáo Học vụ (prototype)
 * views.js — Thành phần hiển thị dùng chung nhiều trang (xếp hạng lớp/nhóm lớp, thẻ Top, popup so sánh).
 * Chỉ ghép số liệu từ metrics.js → component ui.js/charts.js; không định nghĩa công thức mới.
 */
window.GT = window.GT || {};
(function (GT) {
  'use strict';
  const M = GT.metrics, F = GT.fmt, UI = GT.ui, DT = GT.date;
  const el = UI.el, esc = UI.esc;
  const V = GT.views = {};

  /**
   * Chỉ số dùng để xếp hạng lớp/nhóm lớp. calc(D, scope, from, to, cfg) → {value, n}.
   * kind: 'rate' | 'score' | 'score100'; higher: chiều "tốt"; tab: tab đích ở class.html.
   */
  V.METRICS = {
    attOnTime: { label: 'Tỉ lệ đúng giờ', kind: 'rate', higher: true, unit: 'lượt', tab: 'attendance', ref: 'M-ATT-03',
      calc: function (D, s, f, t) { const c = M.attendanceCounts(D, s, f, t); return { value: M.attendanceRates(c).onTime, n: c.taken }; } },
    attLate: { label: 'Tỉ lệ đi muộn', kind: 'rate', higher: false, unit: 'lượt', tab: 'attendance', ref: 'M-ATT-04',
      calc: function (D, s, f, t) { const c = M.attendanceCounts(D, s, f, t); return { value: M.attendanceRates(c).late, n: c.taken }; } },
    attPresent: { label: 'Tỉ lệ có mặt', kind: 'rate', higher: true, unit: 'lượt', tab: 'attendance', ref: 'M-ATT-07',
      calc: function (D, s, f, t) { const c = M.attendanceCounts(D, s, f, t); return { value: M.attendanceRates(c).present, n: c.taken }; } },
    attNotTaken: { label: 'Tỉ lệ bản ghi chưa điểm danh', kind: 'rate', higher: false, unit: 'bản ghi', tab: 'attendance', ref: 'M-ATT-08',
      calc: function (D, s, f, t) { const c = M.attendanceCounts(D, s, f, t); return { value: M.attendanceRates(c).notTaken, n: c.total }; } },
    taskOnTime: { label: 'Tỉ lệ làm bài đúng hạn', kind: 'rate', higher: true, unit: 'lượt', tab: 'homework', ref: 'M-HW-02',
      calc: function (D, s, f, t) { const c = M.taskCounts(D, s, f, t); return { value: M.taskRates(c).onTime, n: c.overdue }; } },
    taskLateMissing: { label: 'Tỉ lệ muộn + không hoàn thành', kind: 'rate', higher: false, unit: 'lượt', tab: 'homework', ref: 'M-HW-03 + M-HW-04',
      calc: function (D, s, f, t) { const c = M.taskCounts(D, s, f, t); return { value: c.overdue ? (c.LATE + c.MISSING) / c.overdue : null, n: c.overdue }; } },
    taskScore: { label: 'Điểm TB nhiệm vụ', kind: 'score', higher: true, unit: 'bài có điểm', tab: 'homework', ref: 'M-HW-07',
      calc: function (D, s, f, t) { const c = M.taskCounts(D, s, f, t); return { value: M.taskRates(c).avgScore, n: c.graded }; } },
    onlineOnTime: { label: 'Hoàn thành khóa TT đúng hạn', kind: 'rate', higher: true, unit: 'học sinh–khóa', tab: 'homework', ref: 'M-ONL-05',
      calc: function (D, s, f, t, cfg) { const c = M.onlineCounts(D, s, f, t, cfg); return { value: c.onTimeRate, n: c.closed }; } },
    onlineMissing: { label: 'Không hoàn thành khóa TT', kind: 'rate', higher: false, unit: 'học sinh–khóa', tab: 'homework', ref: 'M-ONL-04',
      calc: function (D, s, f, t, cfg) { const c = M.onlineCounts(D, s, f, t, cfg); return { value: c.missingRate, n: c.closed }; } },
    onlineScore: { label: 'Điểm TB khóa trực tuyến', kind: 'score100', higher: true, unit: 'học sinh có điểm', tab: 'homework', ref: 'M-ONL-10',
      calc: function (D, s, f, t, cfg) { const c = M.onlineCounts(D, s, f, t, cfg); return { value: c.avgScore, n: c.scored }; } }
  };

  /** Giá trị chỉ số cho từng lớp (kèm TB nhóm của lớp làm mốc), TB trường, TB nhóm. */
  V.classValues = function (ctx, key, from, to, classIds) {
    const m = V.METRICS[key];
    const courseIds = ctx.scope.courseIds;
    const cids = classIds || ctx.classIdsInScope(Math.min(to - 1, ctx.now));
    const groupCache = {};
    const gv = function (g) { if (!(g in groupCache)) groupCache[g] = m.calc(ctx.D, { groupIds: [g], courseIds: courseIds }, from, to, ctx.cfg).value; return groupCache[g]; };
    const items = cids.map(function (cid) {
      const c = ctx.D.classById.get(cid);
      const r = m.calc(ctx.D, { classIds: [cid], courseIds: courseIds }, from, to, ctx.cfg);
      return { id: cid, name: c.name, groupId: c.groupId, value: r.value, n: r.n, ref: gv(c.groupId), href: ctx.href('class.html', { classId: cid, groupId: null, tab: m.tab }) };
    });
    const school = m.calc(ctx.D, { courseIds: courseIds }, from, to, ctx.cfg).value;
    const groupAvg = ctx.groupId ? gv(ctx.groupId) : null;
    return { metric: m, items: items, school: school, groupAvg: groupAvg };
  };

  V.groupValues = function (ctx, key, from, to) {
    const m = V.METRICS[key];
    const courseIds = ctx.scope.courseIds;
    const items = ctx.D.groups.map(function (g) {
      const r = m.calc(ctx.D, { groupIds: [g.id], courseIds: courseIds }, from, to, ctx.cfg);
      return { id: g.id, name: g.name, value: r.value, n: r.n };
    });
    return { metric: m, items: items, school: m.calc(ctx.D, { courseIds: courseIds }, from, to, ctx.cfg).value };
  };

  /** Sắp xếp: lớp đủ mẫu theo chiều chỉ số (desc = cao trước), lớp chưa đủ mẫu xuống cuối. */
  V.order = function (items, desc, minSample) {
    const ok = items.filter(function (x) { return x.value !== null && x.value !== undefined && x.n >= minSample; });
    const bad = items.filter(function (x) { return !(x.value !== null && x.value !== undefined && x.n >= minSample); });
    ok.sort(function (a, b) { return desc ? b.value - a.value : a.value - b.value; });
    ok.forEach(function (x, i) { x.rank = i + 1; x.unranked = false; });
    bad.forEach(function (x) { x.unranked = true; x.rank = null; });
    return ok.concat(bad);
  };

  /**
   * Thẻ "Top lớp": bar ngang toàn bộ lớp (cuộn được, top 5 nổi bật, mốc TB trường + vạch TB nhóm),
   * [ĐX] Top 5 cao nhất / thấp nhất song song, nút "So sánh chi tiết" mở popup.
   * o = {key, title, question, from, to, windowLabel, desc (true: giá trị cao lên đầu), proposalTopLow, tab, id}
   */
  V.rankCard = function (ctx, o) {
    const res = V.classValues(ctx, o.key, o.from, o.to, o.classIds);
    const m = res.metric;
    const K = UI.KIND[m.kind];
    const minS = ctx.cfg.ranking.minSample;
    const desc = o.desc !== undefined ? o.desc : m.higher;
    const ordered = V.order(res.items, desc, minS);
    const tab = o.tab || m.tab;
    const pick = function (it) { window.location.href = ctx.href('class.html', { classId: it.id, groupId: null, tab: tab }); };
    const body = el('div');
    const chartBox = el('div', { style: { maxHeight: (o.maxHeight || 330) + 'px', overflowY: 'auto' } });
    body.appendChild(chartBox);
    const chartEl = el('div', { class: 'chart', role: 'img', 'aria-label': o.title });
    chartBox.appendChild(chartEl);
    GT.charts.mount(chartEl, function () {
      return GT.charts.rankBar({
        items: ordered.map(function (x) {
          return { id: x.id, name: x.name, value: x.value === null ? null : x.value * K.scale, n: x.n, emph: !x.unranked && x.rank <= 5, unranked: x.unranked,
            ref: x.ref === null || x.ref === undefined ? undefined : x.ref * K.scale, note: x.unranked ? 'Chưa đủ ' + minS + ' ' + m.unit + ' — không xếp hạng' : null };
        }),
        fmt: function (v) { return K.fmt(v / K.scale); }, axisFmt: K.axisFmt, max: m.kind === 'rate' && !m.higher ? undefined : K.max,
        marks: res.school === null ? [] : [{ value: res.school * K.scale, label: 'TB trường' }].concat(res.groupAvg !== null ? [{ value: res.groupAvg * K.scale, label: 'TB nhóm', color: GT.colors.blue }] : []),
        refLabel: 'TB nhóm lớp của lớp', valueLabel: m.label, unit: m.unit, empty: { title: 'Không có dữ liệu', text: 'Không có lớp nào có dữ liệu trong ' + (o.windowLabel || 'kỳ này') + '.' }
      });
    }, { height: 240, onClick: function (p) { const it = ordered[p.dataIndex]; if (it) pick(it); } });
    // [ĐX] Top 5 cao nhất & thấp nhất
    const ranked = ordered.filter(function (x) { return !x.unranked; });
    if (o.topLow !== false && ranked.length >= 6) {
      const best = ranked.slice(0, 5);
      const worst = ranked.slice(-5).reverse();
      const list = function (title, arr, cls) {
        return el('div', {}, [
          el('div', { class: 'small', style: { fontWeight: 600, color: cls === 'bad' ? 'var(--bad-text)' : 'var(--good-text)', margin: '2px 0 4px' }, text: title }),
          el('ol', { style: { margin: 0, paddingLeft: '18px', fontSize: '12.5px' } }, arr.map(function (x) {
            return el('li', {}, [el('a', { href: ctx.href('class.html', { classId: x.id, groupId: null, tab: tab }), text: x.name }),
              el('span', { class: 'muted', text: ' — ' + K.fmt(x.value) + ' · ' + F.int(x.n) + ' ' + m.unit })]);
          }))
        ]);
      };
      const goodFirst = desc === m.higher;
      body.appendChild(el('div', { class: 'grid g2', style: { marginTop: '10px', gap: '10px' }, 'data-proposal': '' }, [
        list(goodFirst ? '5 lớp tốt nhất' : '5 lớp cao nhất', best, goodFirst ? 'good' : 'bad'),
        list(goodFirst ? '5 lớp cần chú ý nhất' : '5 lớp thấp nhất', worst, goodFirst ? 'bad' : 'good')
      ]));
    }
    const nUn = ordered.filter(function (x) { return x.unranked; }).length;
    const card = UI.card({
      title: o.title, question: o.question, id: o.id, body: body, proposal: o.proposal,
      tools: [el('button', {
        type: 'button', class: 'btn sm', onclick: function () {
          UI.comparePopup({
            title: o.popupTitle || o.title, subtitle: (o.windowLabel || '') + (ctx.courseId ? ' · ' + ctx.courseName(ctx.courseId) : ''), question: o.question,
            metricLabel: m.label, kind: m.kind, items: res.items.map(function (x) { return Object.assign({}, x); }), school: res.school, groupAvg: res.groupAvg,
            higherIsBetter: desc, unit: m.unit, entity: 'lớp', cause: o.cause, csvName: o.key,
            onPick: pick
          });
        }
      }, 'So sánh chi tiết')],
      table: function () {
        return {
          columns: [
            { key: 'rank', label: 'Hạng', align: 'c', fmt: function (r) { return r.unranked ? '–' : String(r.rank); } },
            { key: 'name', label: 'Lớp' },
            { key: 'group', label: 'Nhóm lớp', value: function (r) { return ctx.groupName(r.groupId); } },
            { key: 'value', label: m.label, align: 'r', fmt: function (r) { return K.fmt(r.value); } },
            { key: 'n', label: 'Mẫu số (' + m.unit + ')', align: 'r', fmt: function (r) { return F.int(r.n); } },
            { key: 'ref', label: 'TB nhóm lớp', align: 'r', fmt: function (r) { return K.fmt(r.ref); } }
          ],
          rows: ordered, csv: o.key + '.csv', sort: { key: 'rank', dir: 1 }, pinBottom: function (r) { return r.unranked; }
        };
      },
      note: 'Mốc: đường đậm = TB trường' + (res.school !== null ? ' (' + K.fmt(res.school) + ')' : '') + '; vạch xanh trên mỗi thanh = TB nhóm lớp của lớp đó. ' +
        (o.windowLabel ? 'Cửa sổ: ' + esc(o.windowLabel) + '. ' : '') +
        'Lớp có < ' + minS + ' ' + esc(m.unit) + ' không được xếp hạng' + (nUn ? ' (' + nUn + ' lớp, đánh dấu *)' : '') + '.',
      cause: o.cause
    });
    return card;
  };

  /** Thẻ xếp hạng nhóm lớp; click nhóm → lọc trang theo nhóm. */
  V.groupRankCard = function (ctx, o) {
    const res = V.groupValues(ctx, o.key, o.from, o.to);
    const m = res.metric;
    const K = UI.KIND[m.kind];
    const minS = ctx.cfg.ranking.minSample;
    const desc = o.desc !== undefined ? o.desc : m.higher;
    const ordered = V.order(res.items, desc, minS);
    const pick = function (it) { ctx.set({ groupId: it.id, classId: null }); UI.closeModal(); };
    return UI.card({
      title: o.title, question: o.question, id: o.id,
      chart: {
        height: 200,
        build: function () {
          return GT.charts.rankBar({
            items: ordered.map(function (x) { return { id: x.id, name: x.name, value: x.value === null ? null : x.value * K.scale, n: x.n, emph: !x.unranked && x.rank === 1, unranked: x.unranked, color: x.unranked ? null : GT.colors.group[x.id] }; }),
            fmt: function (v) { return K.fmt(v / K.scale); }, axisFmt: K.axisFmt, max: m.kind === 'rate' && !m.higher ? undefined : K.max, labelWidth: 150,
            marks: res.school === null ? [] : [{ value: res.school * K.scale, label: 'TB trường' }], valueLabel: m.label, unit: m.unit
          });
        },
        onClick: function (p) { const it = ordered[p.dataIndex]; if (it) pick(it); }
      },
      tools: [el('button', {
        type: 'button', class: 'btn sm', onclick: function () {
          UI.comparePopup({
            title: o.title, subtitle: o.windowLabel, question: o.question, metricLabel: m.label, kind: m.kind, items: res.items, school: res.school,
            higherIsBetter: desc, unit: m.unit, entity: 'nhóm lớp', csvName: o.key + '-nhom', onPick: pick
          });
        }
      }, 'So sánh chi tiết')],
      table: function () {
        return { columns: [{ key: 'name', label: 'Nhóm lớp' }, { key: 'value', label: m.label, align: 'r', fmt: function (r) { return K.fmt(r.value); } }, { key: 'n', label: 'Mẫu số', align: 'r', fmt: function (r) { return F.int(r.n); } }], rows: ordered, csv: o.key + '-nhom.csv' };
      },
      note: 'Nhấn vào nhóm lớp để lọc cả trang theo nhóm. Mốc: TB trường' + (res.school !== null ? ' ' + K.fmt(res.school) : '') + '.'
    });
  };


  /** Trạng thái vận hành của một buổi tại now (bảng vận hành, thẻ lớp, danh sách buổi). */
  V.sessionState = function (s, now, cfg) {
    const C = GT.colors;
    if (s.start > now) return { key: 'UPCOMING', label: 'Sắp diễn ra', color: '#D1D5DB' };
    if (s.reportSubmittedAt !== null) return { key: 'REPORTED', label: 'Đã báo cáo', color: '#15803D' };
    if (s.attendanceSubmittedAt === null) return { key: 'NOT_TAKEN', label: 'Chưa điểm danh', color: C.status.RED };
    if (s.attendanceSubmittedAt > s.start + cfg.ops.attendanceGraceMin * DT.MIN) return { key: 'LATE_TAKEN', label: 'Điểm danh muộn (sau ' + cfg.ops.attendanceGraceMin + ' phút)', color: C.status.ORANGE };
    return { key: 'TAKEN', label: 'Đã điểm danh', color: C.status.GREEN };
  };

  /** Popup "Báo cáo buổi học (mô phỏng)" — Session chỉ có reportSubmittedAt nên nội dung là minh họa (OQ-37). */
  V.sessionReportPopup = function (ctx, s) {
    const D = ctx.D;
    const co = D.courseById.get(s.courseId);
    const att = M.attendanceCounts(D, { classIds: [s.classId] }, s.start, s.start + 1);
    const los = (D.idx.losByCourse.get(s.courseId) || []);
    let topic = los[0];
    los.forEach(function (l) { if (l.order <= 1 + Math.floor(los.length * 0.7 * Math.max(0, Math.min(1, (s.start - D.meta.dataStart) / (D.meta.now - D.meta.dataStart))))) topic = l; });
    const task = (D.idx.tasksBySession.get(s.id) || [])[0];
    const rows = [
      ['Lớp', ctx.className(s.classId)], ['Khóa học', co.name], ['Giáo viên phụ trách', ctx.teacherName(s.teacherId)],
      ['Thời gian', DT.fmtLongDate(s.start) + ' · ' + DT.fmtTime(s.start) + '–' + DT.fmtTime(s.end)],
      ['Điểm danh', s.attendanceSubmittedAt === null ? 'Chưa điểm danh' : 'Lúc ' + DT.fmtDateTime(s.attendanceSubmittedAt) + ' (' + (s.attendanceSubmittedAt <= s.start + ctx.cfg.ops.attendanceGraceMin * DT.MIN ? 'đúng thời điểm' : 'sau ' + DT.fmtDuration(s.attendanceSubmittedAt - s.start) + ' kể từ đầu buổi') + ')'],
      ['Chuyên cần', att.taken ? F.int(att.ON_TIME) + ' đúng giờ · ' + F.int(att.LATE) + ' muộn · ' + F.int(att.EXCUSED) + ' vắng có phép · ' + F.int(att.UNEXCUSED) + ' vắng không phép' + (att.NOT_TAKEN ? ' · ' + att.NOT_TAKEN + ' chưa điểm danh' : '') : '–'],
      ['Báo cáo', s.reportSubmittedAt === null ? (s.end > ctx.now ? 'Buổi chưa kết thúc' : 'Chưa nộp') : 'Nộp lúc ' + DT.fmtDateTime(s.reportSubmittedAt) + ' (sau ' + DT.fmtDuration(s.reportSubmittedAt - s.end) + ')'],
      ['Nhiệm vụ giao', task ? task.title + ' · hạn ' + DT.fmtDateTime(task.dueAt) : 'Không có']
    ];
    const body = el('div');
    body.appendChild(el('table', { class: 'tbl' }, [el('tbody', {}, rows.map(function (r) { return el('tr', {}, [el('th', { style: { width: '180px', position: 'static' }, text: r[0] }), el('td', { text: r[1] })]); }))]));
    if (s.reportSubmittedAt !== null) {
      body.appendChild(el('div', { class: 'callout', style: { marginTop: '12px' } }, [
        el('b', { text: 'Nội dung báo cáo (mô phỏng): ' }),
        'Nội dung đã dạy: ' + topic.code + ' ' + topic.name + '. Hoạt động: ôn tập đầu giờ, giảng bài mới, luyện tập theo nhóm. Ghi chú lớp: ' +
        (att.UNEXCUSED + att.EXCUSED ? (att.UNEXCUSED + att.EXCUSED) + ' học sinh vắng; ' : 'đủ sĩ số; ') + 'giao nhiệm vụ về nhà cuối buổi.'
      ]));
    }
    body.appendChild(el('p', { class: 'muted small', text: 'Hệ thống thật sẽ hiển thị báo cáo do giáo viên nộp. Prototype chỉ có thời điểm nộp (Session.reportSubmittedAt) nên nội dung ở trên là minh họa.' }));
    UI.modal({ title: 'Báo cáo buổi học', subtitle: ctx.className(s.classId) + ' · ' + co.name + ' · ' + DT.fmtDate(s.start), body: body, narrow: true });
  };


  // =====================================================================================
  // Chuẩn đầu ra — thành phần dùng chung (course-detail, class tab Phân tích học tập)
  // =====================================================================================
  function colorOf(st) { return M.COLOR_META[st.color].color; }
  V.loCellLabel = function (st) {
    if (st.color === 'GRAY') return '– Xám';
    return M.COLOR_META[st.color].icon + ' ' + F.num(st.passRate * 100, 0) + '%' + (st.thin ? '*' : '');
  };
  V.loStatTip = function (ctx, st, extra) {
    return 'Tỉ lệ đạt: <b>' + F.pct(st.passRate) + '</b> (' + st.pass + '/' + st.withData + ' học sinh có dữ liệu)<br>Coverage: ' + F.pct(st.coverage) + ' (' + st.withData + '/' + st.enrolled + ')' +
      (st.thin ? ' · <b>Dữ liệu mỏng</b>' : '') + '<br>Số câu hỏi đã thực hiện: ' + F.int(st.evidence) + ' (TB ' + F.num(st.avgEvidence, 1) + '/học sinh)' +
      '<br>Trạng thái: ' + M.COLOR_META[st.color].icon + ' ' + M.COLOR_META[st.color].label + (extra || '');
  };
  function teachersOf(ctx, classId, courseId) {
    const cc = (ctx.D.idx.classCoursesByClass.get(classId) || []).filter(function (x) { return x.courseId === courseId; })[0];
    return cc ? cc.teacherIds.map(ctx.teacherName).join(', ') : '–';
  }
  V.teachersOf = teachersOf;

  /** Dòng diễn giải nguyên nhân (mục 3.6) cho một khóa. */
  V.causeSummary = function (ctx, ca) {
    const mx = ca.matrix, D = ctx.D;
    const cur = [], cls = new Map(), insuf = new Map();
    mx.los.forEach(function (lo) {
      const c = ca.curriculum.get(lo.id);
      if (c.label === 'CURRICULUM') cur.push(lo.code + ' (Đỏ ' + c.redClasses.length + '/' + c.eligibleClasses.length + ' lớp)');
      mx.classIds.forEach(function (cid) {
        const l = ca.classLabel.get(cid + '|' + lo.id).label;
        if (l === 'CLASS') { if (!cls.has(cid)) cls.set(cid, []); cls.get(cid).push(lo.code); }
        if (l === 'INSUFFICIENT') insuf.set(cid, (insuf.get(cid) || 0) + 1);
      });
    });
    const box = el('div', { class: 'small', style: { display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' } });
    box.appendChild(el('div', {}, [el('span', { class: 'badge cur', text: M.CAUSE_TEXT.CURRICULUM }), ' ', cur.length ? cur.join('; ') : el('span', { class: 'muted', text: 'Không có chuẩn đầu ra nào Đỏ trên diện rộng.' })]));
    box.appendChild(el('div', {}, [el('span', { class: 'badge cls', text: M.CAUSE_TEXT.CLASS }), ' ', cls.size ? Array.from(cls.entries()).map(function (e) { return 'Lớp ' + ctx.className(e[0]) + ': ' + e[1].join(', '); }).join(' · ') : el('span', { class: 'muted', text: 'Không có lớp nào thấp hơn hẳn các lớp khác cùng khóa.' })]));
    if (insuf.size) box.appendChild(el('div', {}, [el('span', { class: 'badge insuf', text: M.CAUSE_TEXT.INSUFFICIENT }), ' ', Array.from(insuf.keys()).map(function (cid) { return 'Lớp ' + ctx.className(cid) + ' (' + insuf.get(cid) + ' CĐR)'; }).join(' · '),
      el('span', { class: 'muted', text: ' — dưới ' + ctx.cfg.cause.minStudentsWithData + ' học sinh có dữ liệu hoặc evidence TB < ' + ctx.cfg.cause.minAvgEvidence + ' câu/học sinh.' })]));
    void D;
    return box;
  };

  /**
   * [ĐX] Heatmap lớp × chuẩn đầu ra — biểu đồ trung tâm. Cột đỏ cả cột → nghi vấn chương trình;
   * hàng đỏ / ô đỏ lẻ giữa cột xanh → nghi vấn ở lớp học.
   */
  V.loHeatmapCard = function (ctx, o) {
    const D = ctx.D, cfg = ctx.cfg;
    const ca = M.causeAnalysis(D, o.courseId, cfg, ctx.now);
    const mx = ca.matrix;
    const ycls = mx.classIds.slice();
    const yCats = ycls.map(function (c) { return (c === o.highlightClassId ? '▶ ' : '') + 'Lớp ' + ctx.className(c); }).concat(['Toàn khóa']);
    const xCats = mx.los.map(function (lo) { return (ca.curriculum.get(lo.id).label === 'CURRICULUM' ? '⚑ ' : '') + lo.code; });
    const data = [];
    mx.los.forEach(function (lo, xi) {
      ycls.forEach(function (cid, yi) {
        const st = mx.cells.get(cid + '|' + lo.id);
        const cl = ca.classLabel.get(cid + '|' + lo.id);
        data.push([xi, yi, st.passRate === null ? null : st.passRate * 100, V.loCellLabel(st) + (cl.label === 'CLASS' ? ' ◆' : ''), colorOf(st), { st: st, cid: cid, lo: lo, cl: cl }]);
      });
      const tot = mx.loTotals.get(lo.id);
      data.push([xi, ycls.length, tot.passRate === null ? null : tot.passRate * 100, V.loCellLabel(tot), colorOf(tot), { st: tot, cid: null, lo: lo, cl: null }]);
    });
    const card = UI.card({
      title: o.title || 'Lớp × chuẩn đầu ra', proposal: o.proposal !== false, id: o.id || 'heatmap',
      question: 'Chuẩn đầu ra kém trên diện rộng (vấn đề chương trình) hay chỉ ở một lớp (vấn đề lớp học)?',
      chart: {
        height: 360,
        build: function () {
          return GT.charts.heatmap({
            xCats: xCats, yCats: yCats, data: data, xTop: true, rowHeight: 34, labelSize: 11, yLabelWidth: 110, xLabelWidth: 64,
            tip: function (d) {
              const x = d[5];
              const curr = ca.curriculum.get(x.lo.id);
              return '<b>' + esc(x.cid ? 'Lớp ' + ctx.className(x.cid) : 'Toàn khóa') + ' · ' + esc(x.lo.code) + ' ' + esc(x.lo.name) + '</b><br>' + V.loStatTip(ctx, x.st,
                (x.cid ? '<br>GV phụ trách: ' + esc(teachersOf(ctx, x.cid, o.courseId)) : '') +
                (x.cl && x.cl.label !== 'NONE' ? '<br>Nhãn: <b>' + esc(M.CAUSE_TEXT[x.cl.label]) + '</b>' + (x.cl.median !== null ? ' (trung vị lớp khác ' + F.pct(x.cl.median, 0) + ')' : '') : '') +
                (!x.cid && curr.label !== 'NONE' ? '<br>Nhãn: <b>' + esc(M.CAUSE_TEXT[curr.label]) + '</b> — Đỏ ở ' + curr.redClasses.length + '/' + curr.eligibleClasses.length + ' lớp đủ dữ liệu' : '')) +
                '<br><span style="color:#6B7180">Nhấn để xem danh sách học sinh</span>';
            }
          });
        },
        onClick: function (p) { const x = p.data.raw[5]; V.loPopup(ctx, o.courseId, x.lo.id, x.cid); }
      },
      legend: ['GREEN', 'ORANGE', 'RED', 'GRAY'].map(function (k) { return { color: M.COLOR_META[k].color, label: M.COLOR_META[k].icon + ' ' + M.COLOR_META[k].label + (k === 'GREEN' ? ' ≥ ' + cfg.lo.color.green + '%' : k === 'ORANGE' ? ' ' + cfg.lo.color.orange + '–<' + cfg.lo.color.green + '%' : k === 'RED' ? ' < ' + cfg.lo.color.orange + '%' : ' chưa có dữ liệu') }; })
        .concat([{ color: '#fff', label: '* dữ liệu mỏng (coverage < ' + cfg.lo.thinCoverage + '%)' }, { color: '#fff', label: '◆ nghi vấn ở lớp học' }, { color: '#fff', label: '⚑ nghi vấn chương trình' }]),
      body: V.causeSummary(ctx, ca),
      cause: true,
      table: function () {
        return {
          columns: [{ key: 'cls', label: 'Lớp' }].concat(mx.los.map(function (lo) { return { key: lo.id, label: lo.code, align: 'r' }; })),
          rows: ycls.map(function (cid) {
            const r = { cls: 'Lớp ' + ctx.className(cid) };
            mx.los.forEach(function (lo) { const st = mx.cells.get(cid + '|' + lo.id); r[lo.id] = st.color === 'GRAY' ? 'Xám' : F.pct(st.passRate, 0) + ' ' + M.COLOR_META[st.color].label; });
            return r;
          }), csv: 'lop-x-chuan-dau-ra-' + o.courseId + '.csv'
        };
      }
    });
    return card;
  };

  /** Popup chuẩn đầu ra: học sinh theo lớp (accordion), histogram % đạt, [ĐX] boxplot theo lớp. */
  V.loPopup = function (ctx, courseId, loId, focusClassId, classIds) {
    const D = ctx.D, cfg = ctx.cfg, now = ctx.now;
    const lo = D.loById.get(loId);
    const ca = M.causeAnalysis(D, courseId, cfg, now);
    const cls = classIds || ca.matrix.classIds;
    const tot = M.mergeLoStats(cls.map(function (c) { return ca.matrix.cells.get(c + '|' + loId); }), cfg);
    const body = el('div');
    body.appendChild(el('p', { style: { margin: '0 0 8px', color: 'var(--ink-2)' }, text: lo.description }));
    const curr = ca.curriculum.get(loId);
    body.appendChild(el('div', { class: 'small', html: UI.colorChip(tot.color, V.loCellLabel(tot)) + ' Tỉ lệ đạt ' + F.pct(tot.passRate) + ' (' + tot.pass + '/' + tot.withData + ') · coverage ' + F.pct(tot.coverage) +
      ' · ' + F.int(tot.evidence) + ' câu hỏi đã thực hiện ' + (tot.thin ? UI.thinBadge() : '') + ' ' + UI.causeBadge(curr.label) }));
    // phần trăm từng học sinh
    const perClass = cls.map(function (cid) {
      const roster = M.roster(D, cid, now);
      const m = D.idx.achByClassLo.get(cid + '|' + loId);
      const rows = roster.map(function (sid) { const a = m && m.get(sid); return { sid: sid, percent: a ? a.percent : null, ev: a ? a.evidenceCount : 0, level: M.loLevel(a ? a.percent : null, cfg) }; });
      return { cid: cid, rows: rows, st: ca.matrix.cells.get(cid + '|' + loId), cl: ca.classLabel.get(cid + '|' + loId) };
    });
    const allP = [];
    perClass.forEach(function (p) { p.rows.forEach(function (r) { if (r.percent !== null) allP.push(r.percent); }); });
    const bins = [], counts = [], colors = [];
    for (let i = 0; i < 10; i++) {
      bins.push(i * 10 + '–' + (i === 9 ? 100 : i * 10 + 10));
      counts.push(allP.filter(function (v) { return i === 9 ? v >= 90 : v >= i * 10 && v < i * 10 + 10; }).length);
      colors.push(GT.colors.level[M.loLevel(i * 10 + 5, cfg)]);
    }
    const g = el('div', { class: 'grid g2', style: { marginTop: '12px' } });
    body.appendChild(g);
    const h1 = el('div'), h2 = el('div', { 'data-proposal': '' });
    g.appendChild(h1); g.appendChild(h2);
    h1.appendChild(el('div', { class: 'small', style: { fontWeight: 600 }, text: 'Phân bố % đạt của học sinh có dữ liệu (' + allP.length + ')' }));
    UI.modalChart(h1, function () { return GT.charts.histogram({ bins: bins, counts: counts, colors: colors, yName: 'Số học sinh', xName: '% đạt' }); }, 220);
    h2.appendChild(el('div', { class: 'small', style: { fontWeight: 600 }, html: '% đạt theo lớp <span class="badge proposal">Đề xuất</span>' }));
    UI.modalChart(h2, function () {
      return GT.charts.boxplot({
        categories: perClass.map(function (p) { return ctx.className(p.cid); }), max: 100,
        boxes: perClass.map(function (p) { return GT.stats.boxplot(p.rows.filter(function (r) { return r.percent !== null; }).map(function (r) { return r.percent; })); }),
        counts: perClass.map(function (p) { return p.st.withData; }), unit: 'học sinh có dữ liệu'
      });
    }, 220);
    const acc = el('div', { class: 'accordion', style: { marginTop: '12px' } });
    body.appendChild(acc);
    perClass.sort(function (a, b) { return (a.cid === focusClassId ? -1 : 0) - (b.cid === focusClassId ? -1 : 0) || (a.st.passRate === null ? 1 : 0) - (b.st.passRate === null ? 1 : 0) || a.st.passRate - b.st.passRate; });
    perClass.forEach(function (p) {
      const d = el('details', { open: p.cid === focusClassId || cls.length === 1 ? true : null });
      d.appendChild(el('summary', { html: 'Lớp ' + esc(ctx.className(p.cid)) + ' ' + UI.colorChip(p.st.color, V.loCellLabel(p.st)) + ' <span class="muted small">' + p.st.pass + '/' + p.st.withData + ' đạt · coverage ' + F.pct(p.st.coverage, 0) + ' · GV ' + esc(teachersOf(ctx, p.cid, courseId)) + '</span> ' + (p.st.thin ? UI.thinBadge() : '') + ' ' + UI.causeBadge(p.cl.label) }));
      const inner = el('div', { class: 'inner' });
      inner.appendChild(UI.table({
        columns: [
          { key: 'name', label: 'Học sinh', value: function (r) { return ctx.studentName(r.sid); }, fmt: function (r) { return UI.link(ctx.href('student.html', { studentId: r.sid }), ctx.studentName(r.sid)) + ' <span class="muted small">' + esc(D.studentById.get(r.sid).code) + '</span>'; } },
          { key: 'percent', label: '% đạt', align: 'r', fmt: function (r) { return r.percent === null ? '–' : F.num(r.percent, 1) + '%'; } },
          { key: 'level', label: 'Cấp', value: function (r) { return M.LEVELS.indexOf(r.level); }, fmt: function (r) { return UI.levelChip(r.level); }, csv: function (r) { return M.LEVEL_META[r.level].label; } },
          { key: 'ev', label: 'Số câu đã làm', align: 'r' }
        ], rows: p.rows, sort: { key: 'percent', dir: 1 }, capped: true, csv: 'cdr-' + lo.code + '-' + p.cid + '.csv'
      }));
      d.appendChild(inner);
      acc.appendChild(d);
    });
    body.appendChild(el('div', { class: 'note cause', style: { marginTop: '10px' }, text: M.CAUSE_NOTE }));
    UI.modal({ title: lo.code + ' — ' + lo.name, subtitle: ctx.courseName(courseId) + (focusClassId ? ' · mở sẵn lớp ' + ctx.className(focusClassId) : ''), body: body });
  };

  /**
   * Bảng chuẩn đầu ra phân màu: mã, mô tả, 6 mức, tỉ lệ đạt, coverage, số câu hỏi, ô màu + nhãn, nhãn 3.6.
   * o = {courseId, classIds (null = mọi lớp đang học), colorFilter, otherClassesFor: classId (mini bar lớp khác), onRow}
   */
  V.loTable = function (ctx, o) {
    const D = ctx.D, cfg = ctx.cfg;
    const ca = M.causeAnalysis(D, o.courseId, cfg, ctx.now);
    const mx = ca.matrix;
    const cls = o.classIds || mx.classIds;
    const rows = mx.los.map(function (lo) {
      const st = M.mergeLoStats(cls.map(function (c) { return mx.cells.get(c + '|' + lo.id); }), cfg);
      let cause = ca.curriculum.get(lo.id).label;
      if (cls.length === 1) {
        const cl = ca.classLabel.get(cls[0] + '|' + lo.id).label;
        if (cl !== 'NONE' || cause !== 'CURRICULUM') cause = cl;   // một lớp: ưu tiên nhãn lớp, vẫn hiện nhãn chương trình nếu có
      }
      return { lo: lo, st: st, cause: cause };
    }).filter(function (r) { return !o.colorFilter || r.st.color === o.colorFilter; });
    const cols = [
      { key: 'code', label: 'Mã', value: function (r) { return r.lo.order; }, fmt: function (r) { return '<b>' + esc(r.lo.code) + '</b>'; }, csv: function (r) { return r.lo.code; } },
      { key: 'desc', label: 'Chuẩn đầu ra', minWidth: '240px', value: function (r) { return r.lo.name; }, fmt: function (r) { return '<b>' + esc(r.lo.name) + '</b><div class="muted small">' + esc(r.lo.description) + '</div>'; }, csv: function (r) { return r.lo.name + ' — ' + r.lo.description; } },
      { key: 'levels', label: '6 mức', sort: false, fmt: function (r) { return UI.levelStack(r.st.levels); }, csv: function (r) { return M.LEVELS.map(function (l) { return M.LEVEL_META[l].short + ':' + r.st.levels[l]; }).join(' '); } },
      { key: 'pass', label: 'Tỉ lệ đạt', align: 'r', value: function (r) { return r.st.passRate; }, fmt: function (r) { return F.pct(r.st.passRate) + '<div class="muted small">' + r.st.pass + '/' + r.st.withData + '</div>'; }, csv: function (r) { return r.st.passRate; } },
      { key: 'cov', label: 'Coverage', align: 'r', value: function (r) { return r.st.coverage; }, fmt: function (r) { return F.pct(r.st.coverage, 0) + (r.st.thin ? '<div>' + UI.thinBadge() + '</div>' : ''); }, csv: function (r) { return r.st.coverage; } },
      { key: 'ev', label: 'Số câu hỏi đã làm', align: 'r', value: function (r) { return r.st.evidence; }, fmt: function (r) { return F.int(r.st.evidence) + '<div class="muted small">TB ' + F.num(r.st.avgEvidence, 1) + '/HS</div>'; } },
      { key: 'color', label: 'Trạng thái', value: function (r) { return ['RED', 'ORANGE', 'GREEN', 'GRAY'].indexOf(r.st.color); }, fmt: function (r) { return UI.colorChip(r.st.color, V.loCellLabel(r.st)); }, csv: function (r) { return M.COLOR_META[r.st.color].label; } },
      { key: 'cause', label: 'Diễn giải', value: function (r) { return M.CAUSE_TEXT[r.cause]; }, fmt: function (r) { return UI.causeBadge(r.cause); } }
    ];
    if (o.otherClassesFor) {
      const me = o.otherClassesFor;
      cols.splice(4, 0, {
        key: 'others', label: 'Các lớp khác cùng khóa', sort: false, title: 'Tỉ lệ đạt của các lớp khác đang học khóa (mini bar)',
        csv: function (r) { return mx.classIds.filter(function (c) { return c !== me; }).map(function (c) { const s = mx.cells.get(c + '|' + r.lo.id); return ctx.className(c) + ':' + (s.passRate === null ? '–' : Math.round(s.passRate * 100)); }).join(' '); },
        fmt: function (r) {
          return '<div style="display:flex;gap:2px;align-items:flex-end;height:26px" data-proposal>' + mx.classIds.filter(function (c) { return c !== me; }).map(function (c) {
            const s = mx.cells.get(c + '|' + r.lo.id);
            const h = s.passRate === null ? 2 : Math.max(2, Math.round(s.passRate * 24));
            return '<span title="' + esc(ctx.className(c) + ': ' + (s.passRate === null ? 'chưa có dữ liệu' : F.pct(s.passRate, 0))) + '" style="display:inline-block;width:8px;height:' + h + 'px;border-radius:2px 2px 0 0;background:' + colorOf(s) + '"></span>';
          }).join('') + '</div>';
        }
      });
    }
    return UI.table({
      columns: cols, rows: rows, sort: o.sort || { key: 'code', dir: 1 }, csv: 'chuan-dau-ra-' + o.courseId + '.csv',
      onRow: function (r) { V.loPopup(ctx, o.courseId, r.lo.id, cls.length === 1 ? cls[0] : null, o.classIds); },
      empty: 'Không có chuẩn đầu ra nào khớp bộ lọc màu.', footNote: 'Nhấn vào dòng để xem danh sách học sinh'
    });
  };


  // =====================================================================================
  // Khóa trực tuyến — tiến độ thực tế vs kỳ vọng (homework.html, class.html)
  // =====================================================================================
  /**
   * Thẻ "Tiến độ thực tế vs kỳ vọng theo lớp" cho từng khóa trực tuyến đang chạy tại t (small multiples theo nội dung).
   * o = {classIds, courseIds, t, id}
   */
  V.onlineProgressCard = function (ctx, o) {
    const D = ctx.D, cfg = ctx.cfg;
    const t = o.t;
    const running = M.onlineRunning(D, { classIds: o.classIds, courseIds: o.courseIds }, t, cfg);
    const byContent = new Map();
    running.forEach(function (r) {
      const k = r.assignment.contentKey;
      if (!byContent.has(k)) byContent.set(k, []);
      byContent.get(k).push(r);
    });
    const body = el('div', { class: 'grid g2' });
    if (!byContent.size) body.appendChild(UI.empty('Không có khóa trực tuyến đang chạy', 'Tại ' + DT.fmtDate(t) + ' không có khóa trực tuyến nào đang mở trong phạm vi đang chọn.'));
    byContent.forEach(function (list, k) {
      const a0 = list[0].assignment;
      const box = el('div');
      box.appendChild(el('div', { class: 'small', style: { fontWeight: 600 }, text: a0.title }));
      box.appendChild(el('div', { class: 'muted small', text: D.courseById.get(a0.courseId).shortName + ' · ' + DT.fmtDate(a0.startAt) + ' → hạn ' + DT.fmtDate(a0.dueAt) + ' · kỳ vọng ' + F.pct(list[0].expected, 0) }));
      const c = el('div', { class: 'chart' });
      box.appendChild(c);
      list.sort(function (a, b) { return a.avgProgress - b.avgProgress; });
      GT.charts.mount(c, function () {
        return GT.charts.progress({
          items: list.map(function (r) { return { name: 'Lớp ' + ctx.className(r.assignment.classId), actual: r.avgProgress || 0, expected: r.expected, n: r.n, onTrackRate: r.onTrackRate }; }),
          tolerance: cfg.online.onTrackTolerancePts
        });
      }, { height: 180, onClick: function (p) { const r = list[p.dataIndex]; if (r) window.location.href = ctx.href('class.html', { classId: r.assignment.classId, groupId: null, tab: 'homework', '#': 'online' }); } });
      body.appendChild(box);
    });
    return UI.card({
      title: o.title || 'Tiến độ thực tế vs kỳ vọng — khóa trực tuyến đang chạy', proposal: true, id: o.id,
      question: 'Lớp nào sẽ trễ hạn nếu không can thiệp tuần này?',
      body: body,
      legend: [{ color: GT.colors.accent, label: 'Tiến độ TB của lớp' }, { color: GT.colors.status.ORANGE, label: '! Chậm hơn kỳ vọng > ' + cfg.online.onTrackTolerancePts + ' điểm %' }, { color: GT.colors.ink, label: 'Vạch dọc: tiến độ kỳ vọng (thời gian đã trôi / tổng thời gian)' }],
      note: 'Tiến độ = Σ mục đã hoàn thành / Σ mục được giao tại ' + DT.fmtDateTime(t) + '. "Đúng tiến độ" = tiến độ ≥ kỳ vọng − ' + cfg.online.onTrackTolerancePts + ' điểm % (tooltip hiển thị tỉ lệ học sinh đúng tiến độ).',
      table: function () {
        return {
          columns: [{ key: 'title', label: 'Khóa trực tuyến', value: function (r) { return r.assignment.title; } }, { key: 'cls', label: 'Lớp', value: function (r) { return ctx.className(r.assignment.classId); } },
            { key: 'act', label: 'Tiến độ TB', align: 'r', value: function (r) { return r.avgProgress; }, fmt: function (r) { return F.pct(r.avgProgress); } },
            { key: 'exp', label: 'Kỳ vọng', align: 'r', value: function (r) { return r.expected; }, fmt: function (r) { return F.pct(r.expected); } },
            { key: 'on', label: 'HS đúng tiến độ', align: 'r', value: function (r) { return r.onTrackRate; }, fmt: function (r) { return F.pct(r.onTrackRate) + ' (' + r.onTrack + '/' + r.n + ')'; } },
            { key: 'ns', label: 'Chưa bắt đầu', align: 'r', value: function (r) { return r.notStarted; } }],
          rows: running, csv: 'tien-do-khoa-truc-tuyen.csv'
        };
      }
    });
  };

  /** Mô tả ngắn cửa sổ thời gian. */
  V.windowLabel = function (from, to) { return DT.fmtDate(from) + ' – ' + DT.fmtDate(to - 1); };
})(window.GT);
