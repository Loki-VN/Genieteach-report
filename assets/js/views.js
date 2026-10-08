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
        fmt: function (v) { return K.fmt(v / K.scale); }, axisFmt: K.axisFmt, max: K.max,
        marks: res.school === null ? [] : [{ value: res.school * K.scale, label: 'TB trường' }].concat(res.groupAvg !== null ? [{ value: res.groupAvg * K.scale, label: 'TB nhóm', color: GT.colors.blue }] : []),
        refLabel: 'TB nhóm lớp của lớp', valueLabel: m.label, unit: m.unit, empty: { title: 'Không có dữ liệu', text: 'Không có lớp nào có dữ liệu trong ' + (o.windowLabel || 'kỳ này') + '.' }
      });
    }, { height: 240, onClick: function (p) { const it = ordered[p.dataIndex]; if (it) pick(it); } });
    // [ĐX] Top 5 cao nhất & thấp nhất
    const ranked = ordered.filter(function (x) { return !x.unranked; });
    if (o.topLow !== false && ranked.length >= 2) {
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
            fmt: function (v) { return K.fmt(v / K.scale); }, axisFmt: K.axisFmt, max: K.max, labelWidth: 150,
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

  /** Mô tả ngắn cửa sổ thời gian. */
  V.windowLabel = function (from, to) { return DT.fmtDate(from) + ' – ' + DT.fmtDate(to - 1); };
})(window.GT);
