/**
 * hoc-vu/attendance.html — 4.2 Báo cáo chuyên cần.
 * Trả lời: chuyên cần toàn trường trong kỳ ra sao; lớp/nhóm lớp nào đúng giờ nhất, muộn nhiều nhất;
 * vắng rải rác hay tập trung; số liệu có đáng tin (bản ghi chưa điểm danh) không.
 */
(function (GT) {
  'use strict';
  const M = GT.metrics, A = GT.alerts, UI = GT.ui, V = GT.views, F = GT.fmt, DT = GT.date, C = GT.colors, L = GT.labels, S = GT.stats;
  const el = UI.el, esc = UI.esc;
  const DAY = DT.DAY;

  GT.page({
    id: 'attendance',
    title: 'Báo cáo chuyên cần',
    subtitle: 'Đúng giờ · muộn · vắng có phép / không phép · bản ghi chưa điểm danh',
    filters: {
      period: 'day', group: true,
      extra: function (box, ctx) {
        const lab = UI.select('Khóa học', ctx.D.courses.map(function (c) { return { value: c.id, label: c.name }; }), ctx.courseId, function (v) { ctx.set({ courseId: v }); }, 'Tất cả khóa học');
        lab.setAttribute('data-proposal', '');
        box.appendChild(lab);
      }
    },
    render: function (ctx, root) {
      const D = ctx.D, now = ctx.now, r = ctx.range, pr = ctx.prev, cfg = ctx.cfg;
      const scope = { groupIds: ctx.scope.groupIds, courseIds: ctx.scope.courseIds };
      const cur = M.attendanceCounts(D, scope, r.from, r.to), prev = M.attendanceCounts(D, scope, pr.from, pr.to);
      const rc = M.attendanceRates(cur), rp = M.attendanceRates(prev);
      const sessions = M.sessionsIn(D, scope, r.from, r.to);
      const ops = M.opsSummary(sessions, now, cfg);
      const opsPrev = M.opsSummary(M.sessionsIn(D, scope, pr.from, pr.to), now, cfg);
      const activeN = M.activeClassIds(D, scope, Math.min(r.to - 1, now)).length;

      root.appendChild(UI.kpis([
        { label: 'Lớp đang hoạt động', value: F.int(activeN), sub: ctx.groupId ? ctx.groupName(ctx.groupId) : 'toàn trường', ref: 'M-OPS-00' },
        { label: 'Lịch học diễn ra', value: F.int(ops.total), sub: ops.started + ' đã bắt đầu · ' + ops.upcoming + ' chưa diễn ra', ref: 'M-OPS-01', delta: { cur: ops.total, prev: opsPrev.total, kind: 'count', complete: true } },
        { label: 'Tỉ lệ đúng giờ', value: F.pct(rc.onTime), sub: F.int(cur.ON_TIME) + '/' + F.int(cur.taken) + ' lượt', ref: 'M-ATT-03', delta: { cur: rc.onTime, prev: rp.onTime, kind: 'rate', goodUp: true } },
        { label: 'Tỉ lệ đi muộn', value: F.pct(rc.late), sub: F.int(cur.LATE) + ' lượt', ref: 'M-ATT-04', delta: { cur: rc.late, prev: rp.late, kind: 'rate', goodUp: false } },
        { label: 'Vắng không phép', value: F.pct(rc.unexcused), sub: F.int(cur.UNEXCUSED) + ' lượt', ref: 'M-ATT-06', delta: { cur: rc.unexcused, prev: rp.unexcused, kind: 'rate', goodUp: false } },
        { label: 'Vắng có phép', value: F.pct(rc.excused), sub: F.int(cur.EXCUSED) + ' lượt', ref: 'M-ATT-05', delta: { cur: rc.excused, prev: rp.excused, kind: 'rate', goodUp: false } },
        { label: 'Tỉ lệ có mặt', value: F.pct(rc.present), sub: 'đúng giờ + muộn', ref: 'M-ATT-07', delta: { cur: rc.present, prev: rp.present, kind: 'rate', goodUp: true } },
        { label: 'Bản ghi chưa điểm danh', value: F.pct(rc.notTaken), sub: F.int(cur.NOT_TAKEN) + '/' + F.int(cur.total) + ' bản ghi · không vào mẫu số', ref: 'M-ATT-08', delta: { cur: rc.notTaken, prev: rp.notTaken, kind: 'rate', goodUp: false } }
      ]));
      root.appendChild(el('div', { class: 'muted small', text: 'Kỳ: ' + r.label + ' · so với kỳ trước: ' + pr.label + (r.isCurrent ? ' · kỳ hiện tại tính đến ' + DT.fmtTime(now) + ' hôm nay' : '') + ' · mẫu số tỉ lệ = bản ghi đã điểm danh (không gồm "chưa điểm danh"), cộng gộp mọi lớp.' }));

      // ---- Lịch sử theo ngày (gộp tuần khi > 31 ngày) + lịch học có/chưa điểm danh
      const row1 = el('div', { class: 'grid g3' });
      root.appendChild(row1);
      const buckets = GT.period.buckets(r.from, r.to, r.bucket);
      const bc = buckets.map(function (b) { return M.attendanceCounts(D, scope, b.from, b.to); });
      const histCard = UI.card({
        title: 'Lịch sử chuyên cần theo ' + (r.bucket === 'week' ? 'tuần' : 'ngày'),
        question: 'Tỉ lệ đúng giờ / muộn / vắng thay đổi thế nào qua từng ngày trong kỳ?',
        chart: {
          height: 300,
          build: function () {
            return GT.charts.stack({
              categories: buckets.map(function (b) { return b.label; }), percent: true, rotate: buckets.length > 14 ? 45 : 0,
              series: ['ON_TIME', 'LATE', 'EXCUSED', 'UNEXCUSED'].map(function (k) { return { name: L.att[k], color: C.att[k], data: bc.map(function (c) { return c[k]; }) }; }),
              tipExtra: function (i) { return bc[i].NOT_TAKEN ? '<div style="color:#6B7180">Chưa điểm danh: ' + F.int(bc[i].NOT_TAKEN) + ' bản ghi</div>' : ''; },
              empty: { title: 'Không có buổi học đã điểm danh', text: 'Không có dữ liệu điểm danh trong ' + r.label + '.' }
            });
          }
        },
        note: r.bucket === 'week' ? 'Kỳ dài hơn 31 ngày → tự gộp theo tuần (Thứ Hai–Chủ nhật).' : 'Ngày không có buổi học để trống.',
        table: function () { return { columns: [{ key: 'l', label: r.bucket === 'week' ? 'Tuần' : 'Ngày' }].concat(M.ATT_STATUSES.map(function (k) { return { key: k, label: L.att[k], align: 'r' }; })).concat([{ key: 'p', label: 'Có mặt', align: 'r' }]), rows: bc.map(function (c, i) { const o = { l: buckets[i].label, p: F.pct(M.attendanceRates(c).present) }; M.ATT_STATUSES.forEach(function (k) { o[k] = c[k]; }); return o; }), csv: 'chuyen-can-theo-ngay.csv' }; }
      });
      histCard.classList.add('span-2');
      row1.appendChild(histCard);
      row1.appendChild(UI.card({
        title: 'Lịch học có điểm danh / chưa điểm danh',
        question: 'Bao nhiêu buổi đã bắt đầu mà chưa được điểm danh?',
        chart: {
          height: 300,
          build: function () {
            return GT.charts.donut({
              items: [{ name: 'Đã điểm danh', value: ops.taken, color: C.status.GREEN }, { name: 'Chưa điểm danh', value: ops.started - ops.taken, color: C.status.RED }],
              center: { value: F.pct(ops.takenRate), label: 'đã điểm danh' }, unit: 'buổi',
              empty: { title: 'Chưa có buổi nào bắt đầu', text: '' }
            });
          }
        },
        note: 'Trên ' + ops.started + ' buổi đã bắt đầu; ' + ops.upcoming + ' buổi chưa diễn ra không tính. Chi tiết từng buổi: ' + UI.link(ctx.href('schedule.html'), 'Báo cáo lịch học') + '.'
      }));

      // ---- Top lớp & nhóm lớp
      root.appendChild(UI.section('Xếp hạng', r.label + (ctx.courseId ? ' · ' + ctx.courseName(ctx.courseId) : '')));
      const row2 = el('div', { class: 'grid g2' });
      root.appendChild(row2);
      row2.appendChild(V.rankCard(ctx, { key: 'attOnTime', title: 'Top lớp đi học đúng giờ nhất', question: 'Lớp nào đúng giờ tốt nhất, lớp nào kém nhất trong kỳ?', from: r.from, to: r.to, windowLabel: r.label, tab: 'attendance', cause: true }));
      row2.appendChild(V.rankCard(ctx, { key: 'attLate', title: 'Top lớp đi muộn nhiều nhất', question: 'Lớp nào có tỉ lệ đi muộn cao nhất?', from: r.from, to: r.to, windowLabel: r.label, tab: 'attendance', desc: true, popupTitle: 'So sánh tỉ lệ đi muộn giữa các lớp' }));
      const row3 = el('div', { class: 'grid g2' });
      root.appendChild(row3);
      row3.appendChild(V.groupRankCard(ctx, { key: 'attOnTime', title: 'Nhóm lớp đúng giờ nhất', question: 'Nhóm lớp nào đúng giờ tốt nhất?', from: r.from, to: r.to, windowLabel: r.label }));
      row3.appendChild(V.groupRankCard(ctx, { key: 'attLate', title: 'Nhóm lớp đi muộn nhiều nhất', question: 'Nhóm lớp nào đi muộn nhiều nhất?', from: r.from, to: r.to, windowLabel: r.label, desc: true }));

      root.appendChild(UI.alertBlock({ alerts: A.filter(ctx.alerts(), { groups: ['ATT'], groupId: ctx.groupId }), title: 'Cảnh báo chuyên cần (ATT)', moreHref: 'alerts.html' + GT.qs.build({ alertGroup: 'ATT', groupId: ctx.groupId }), note: 'Cảnh báo đánh giá tại thời điểm hiện tại theo cửa sổ của từng quy tắc (không phụ thuộc kỳ đang xem).' }));

      // ---- [ĐX] Calendar heatmap 3 tháng
      root.appendChild(calendarCard(ctx, scope));

      // ---- [ĐX] Thứ × khung giờ + histogram
      const row4 = el('div', { class: 'grid g2' });
      root.appendChild(row4);
      row4.appendChild(weekdaySlotCard(ctx, scope));
      const byStu = M.attendanceByStudent(D, scope, r.from, r.to);
      const hist = M.absenceHistogram(byStu);
      row4.appendChild(UI.card({
        title: 'Học sinh theo số buổi vắng không phép', proposal: true,
        question: 'Vắng là hiện tượng rải rác hay tập trung ở một nhóm nhỏ vắng triền miên?',
        chart: {
          height: 300,
          build: function () {
            return GT.charts.histogram({ bins: ['0', '1', '2', '3', '4', '5+'], counts: hist, xName: 'Số buổi vắng không phép trong kỳ', yName: 'Số học sinh', colors: ['#B7E0C7', '#F5C451', '#F08C3A', '#E5484D', '#C2363B', '#8F1D22'] });
          }
        },
        note: F.int(hist.reduce(function (s, x) { return s + x; }, 0)) + ' học sinh có dữ liệu trong kỳ (cấp học sinh: gộp mọi lớp trong phạm vi lọc). ' + F.int(hist[3] + hist[4] + hist[5]) + ' học sinh vắng không phép ≥ 3 buổi.'
      }));

      // ---- [ĐX] Danh sách học sinh vắng nhiều nhất
      const rows = Array.from(byStu.entries()).map(function (e) { return { sid: e[0], g: e[1] }; }).filter(function (x) { return x.g.EXCUSED + x.g.UNEXCUSED > 0; })
        .sort(function (a, b) { return (b.g.EXCUSED + b.g.UNEXCUSED) - (a.g.EXCUSED + a.g.UNEXCUSED) || b.g.UNEXCUSED - a.g.UNEXCUSED; });
      root.appendChild(UI.card({
        title: 'Học sinh vắng nhiều nhất toàn trường', proposal: true,
        question: 'Học sinh nào cần được liên hệ ngay vì vắng nhiều hoặc vắng liên tiếp?',
        body: UI.table({
          columns: [
            { key: 'name', label: 'Học sinh', value: function (x) { return ctx.studentName(x.sid); }, fmt: function (x) { return UI.link(ctx.href('student.html', { studentId: x.sid }), ctx.studentName(x.sid)) + ' <span class="muted small">' + esc(D.studentById.get(x.sid).code) + '</span>'; } },
            { key: 'cls', label: 'Các lớp', value: function (x) { return Array.from(x.g.classes).map(ctx.className).join(', '); } },
            { key: 'abs', label: 'Tổng vắng', align: 'r', value: function (x) { return x.g.EXCUSED + x.g.UNEXCUSED; } },
            { key: 'exc', label: 'Có phép', align: 'r', value: function (x) { return x.g.EXCUSED; } },
            { key: 'unx', label: 'Không phép', align: 'r', value: function (x) { return x.g.UNEXCUSED; } },
            { key: 'streak', label: 'Chuỗi KP dài nhất', align: 'r', value: function (x) { return x.g.longestUnexcused; }, fmt: function (x) { return x.g.longestUnexcused >= 2 ? '<b style="color:var(--bad-text)">' + x.g.longestUnexcused + '</b>' : String(x.g.longestUnexcused); } },
            { key: 'taken', label: 'Buổi đã điểm danh', align: 'r', value: function (x) { return x.g.taken; } },
            { key: 'p', label: 'Có mặt', align: 'r', value: function (x) { return (x.g.ON_TIME + x.g.LATE) / x.g.taken; }, fmt: function (x) { return F.pct((x.g.ON_TIME + x.g.LATE) / x.g.taken); } }
          ],
          rows: rows, sort: { key: 'abs', dir: -1 }, limit: 50, capped: true, csv: 'hoc-sinh-vang-nhieu.csv',
          onRow: function (x) { window.location.href = ctx.href('student.html', { studentId: x.sid }); },
          empty: 'Không có học sinh nào vắng trong kỳ.'
        }),
        note: 'Kỳ ' + esc(r.label) + '. Chuỗi KP = số buổi vắng không phép liên tiếp (gộp mọi lớp của học sinh; buổi chưa điểm danh bỏ qua).'
      }));

      // ---- [ĐX] Xu hướng vắng có phép vs không phép + chưa điểm danh theo lớp
      const row5 = el('div', { class: 'grid g2' });
      root.appendChild(row5);
      const weeks = GT.period.buckets(D.meta.dataStart, now + 1, 'week');
      const wc = weeks.map(function (w) { return M.attendanceCounts(D, scope, w.from, w.to); });
      row5.appendChild(UI.card({
        title: 'Vắng có phép vs không phép theo tuần', proposal: true,
        question: 'Vắng có phép có đang bị dùng thay cho vắng không phép không?',
        chart: {
          height: 280,
          build: function () {
            return GT.charts.line({
              categories: weeks.map(function (w) { return w.label; }), min: 0, axisFmt: function (v) { return F.num(v, 0) + '%'; }, fmt: function (v) { return F.num(v, 1) + '%'; },
              tipTitle: function (i) { return 'Tuần ' + DT.fmtDate(weeks[i].from); },
              series: [
                { name: 'Vắng có phép', short: 'Có phép', color: C.series[0], data: wc.map(function (c) { return c.taken ? c.EXCUSED / c.taken * 100 : null; }), n: wc.map(function (c) { return c.taken; }) },
                { name: 'Vắng không phép', short: 'Không phép', color: C.series[1], data: wc.map(function (c) { return c.taken ? c.UNEXCUSED / c.taken * 100 : null; }), n: wc.map(function (c) { return c.taken; }) }
              ]
            });
          }
        },
        note: 'Từ đầu dữ liệu đến hiện tại. Nếu vắng có phép tăng trong khi vắng không phép giảm tương ứng, cần kiểm tra lại quy trình xin phép.'
      }));
      const clsIds = ctx.classIdsInScope();
      const nt = clsIds.map(function (cid) { const c = M.attendanceCounts(D, { classIds: [cid], courseIds: ctx.scope.courseIds }, r.from, r.to); return { id: cid, name: ctx.className(cid), value: c.total ? c.NOT_TAKEN / c.total * 100 : null, n: c.total }; })
        .filter(function (x) { return x.value !== null; }).sort(function (a, b) { return b.value - a.value; });
      const th = (cfg.alerts.rules['OPS-06'].params || {}).threshold || 10;
      nt.forEach(function (x) { x.emph = x.value > th; x.color = x.value > th ? C.status.RED : C.deemph; });
      row5.appendChild(UI.card({
        title: 'Tỉ lệ bản ghi "chưa điểm danh" theo lớp', proposal: true,
        question: 'Số liệu chuyên cần của lớp nào kém tin cậy vì nhiều bản ghi chưa được điểm danh?',
        body: (function () {
          const box = el('div', { style: { maxHeight: '320px', overflowY: 'auto' } });
          const c = el('div', { class: 'chart' });
          box.appendChild(c);
          GT.charts.mount(c, function () {
            return GT.charts.rankBar({ items: nt, fmt: function (v) { return F.num(v, 1) + '%'; }, axisFmt: GT.charts.pctAxis, unit: 'bản ghi', valueLabel: 'Chưa điểm danh', marks: [{ value: th, label: 'Ngưỡng ' + th + '%', color: C.status.RED }], empty: { title: 'Không có bản ghi', text: '' } });
          }, { height: 240, onClick: function (p) { const it = nt[p.dataIndex]; if (it) window.location.href = ctx.href('class.html', { classId: it.id, tab: 'attendance', groupId: null }); } });
          return box;
        })(),
        note: 'Đây là chỉ số chất lượng dữ liệu (vận hành của giáo viên), không phải hành vi học sinh. Lớp vượt ngưỡng (tô đỏ) thì mọi chỉ số chuyên cần của lớp đều kém tin cậy.'
      }));
    }
  });

  function calendarCard(ctx, scope) {
    const D = ctx.D, now = ctx.now;
    const from = DT.addMonths(DT.startOfMonth(now), -2);
    const to = DT.startOfDay(now) + DAY;
    const byDay = M.attendanceByDay(D, scope, from, to);
    const days = [];
    let maxAbs = 0;
    byDay.forEach(function (c, k) {
      if (!c.taken) return;
      const abs = (c.EXCUSED + c.UNEXCUSED) / c.taken;
      maxAbs = Math.max(maxAbs, abs);
      days.push({ day: k, value: abs, label: F.num((1 - abs) * 100, 0), tip: '<b>' + DT.fmtLongDate(DT.parseDate(k)) + '</b><br>Có mặt: <b>' + F.pct(1 - abs) + '</b><br>Vắng: ' + F.pct(abs) + ' (' + (c.EXCUSED + c.UNEXCUSED) + '/' + c.taken + ' lượt)' + (c.NOT_TAKEN ? '<br>Chưa điểm danh: ' + c.NOT_TAKEN : '') });
    });
    const worst = days.slice().sort(function (a, b) { return b.value - a.value; })[0];
    return UI.card({
      title: 'Tỉ lệ có mặt toàn trường theo ngày — 3 tháng gần nhất', proposal: true,
      question: 'Có ngày/tuần nào vắng bất thường (lễ, thời tiết, sự kiện) không?',
      chart: {
        height: 480,
        build: function () { return GT.charts.calendar({ from: from, to: to, days: days, min: 0, max: Math.max(0.25, maxAbs) }); },
        onClick: function (p) { if (p.data && p.data.value) window.location.href = ctx.href('attendance.html', { period: 'day', date: p.data.value[0] }); }
      },
      legend: [{ color: C.seq[0], label: 'Ít vắng' }, { color: C.seq[3], label: 'Vắng trung bình' }, { color: C.seq[6], label: 'Vắng nhiều' }, { color: '#FBFAFD', label: 'Không có buổi học (nghỉ, cuối tuần)' }],
      note: 'Số trong ô = % có mặt; màu đậm = tỉ lệ vắng cao (màu đậm nhất ứng với ' + F.pct(Math.max(0.25, maxAbs), 0) + ' vắng). ' + (worst ? 'Ngày vắng nhiều nhất: ' + DT.fmtLongDate(DT.parseDate(worst.day)) + ' (có mặt ' + F.pct(1 - worst.value) + '). ' : '') + 'Nhấn vào ngày để xem báo cáo ngày đó.'
    });
  }

  function weekdaySlotCard(ctx, scope) {
    const D = ctx.D, r = ctx.range, now = ctx.now;
    let from = r.from, to = r.to, note = 'Kỳ đang chọn.';
    if (r.days < 28) { to = Math.min(r.to, now + 1); from = DT.startOfWeek(to) - 7 * 7 * DAY; note = '8 tuần đến hết kỳ đang chọn (kỳ ngắn hơn 4 tuần không đủ mẫu).'; }
    const mode = ctx.q.ws === 'abs' ? 'abs' : 'late';
    const grid = M.weekdaySlotMatrix(D, scope, from, to);
    const slots = D.meta.slots.filter(Boolean);
    const data = [];
    let max = 0;
    for (let w = 0; w < 7; w++) {
      slots.forEach(function (sl, si) {
        const c = grid[w][sl.id];
        if (!c.taken) return;
        const v = mode === 'late' ? c.LATE / c.taken : (c.EXCUSED + c.UNEXCUSED) / c.taken;
        max = Math.max(max, v);
        data.push([w, si, v * 100, F.num(v * 100, 1) + '%', undefined, c]);
      });
    }
    const seg = el('div', { class: 'seg' }, [['late', 'Đi muộn'], ['abs', 'Vắng']].map(function (x) { return el('button', { type: 'button', class: x[0] === mode ? 'on' : null, onclick: function () { ctx.set({ ws: x[0] === 'late' ? null : 'abs' }); } }, x[1]); }));
    return UI.card({
      title: 'Thứ trong tuần × khung giờ', proposal: true,
      question: 'Ca sáng sớm thứ Hai có vấn đề đi muộn/vắng có hệ thống không?',
      tools: [seg],
      chart: {
        height: 300,
        build: function () {
          return GT.charts.heatmap({
            xCats: DT.WEEKDAYS_SHORT, yCats: slots.map(function (s) { return s.label + ' ' + s.start; }), data: data, scale: { min: 0, max: Math.max(max * 100, 5) }, yLabelWidth: 110,
            tip: function (d) { const c = d[5]; return '<b>' + DT.WEEKDAYS[d[0]] + ' · ' + esc(slots[d[1]].label + ' ' + slots[d[1]].start) + '</b><br>' + (mode === 'late' ? 'Đi muộn' : 'Vắng') + ': <b>' + F.num(d[2], 1) + '%</b><br>' + F.int(c.taken) + ' lượt đã điểm danh'; }
          });
        }
      },
      note: note + ' Ô trống = không có buổi học. Màu đậm = tỉ lệ ' + (mode === 'late' ? 'đi muộn' : 'vắng') + ' cao.'
    });
  }
})(window.GT);
