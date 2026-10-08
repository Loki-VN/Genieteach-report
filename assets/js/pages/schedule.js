/**
 * hoc-vu/schedule.html — 4.5 Báo cáo lịch học.
 * Trả lời: giáo viên có điểm danh trước buổi và báo cáo sau buổi đầy đủ, đúng lúc không; lớp/nhóm nào đang hụt.
 */
(function (GT) {
  'use strict';
  const M = GT.metrics, A = GT.alerts, UI = GT.ui, V = GT.views, F = GT.fmt, DT = GT.date, C = GT.colors, L = GT.labels;
  const el = UI.el, esc = UI.esc;
  const DAY = DT.DAY;
  const CAT_ORDER = ['NONE', 'REP_ONLY', 'ATT_ONLY', 'BOTH', 'UPCOMING'];   // kém nhất → tốt nhất

  GT.page({
    id: 'schedule',
    title: 'Báo cáo lịch học',
    subtitle: 'Điểm danh trước buổi · báo cáo sau buổi · theo lớp, nhóm lớp, giáo viên',
    filters: {
      period: 'day', group: true, class: true, course: true, teacher: true,
      extra: function (box, ctx) {
        const by = ctx.q.by === 'group' ? 'group' : 'class';
        const seg = el('div', { class: 'seg', role: 'group', 'aria-label': 'Hiển thị theo' }, [
          el('button', { type: 'button', class: by === 'class' ? 'on' : null, onclick: function () { ctx.set({ by: null }); } }, 'Theo lớp'),
          el('button', { type: 'button', class: by === 'group' ? 'on' : null, onclick: function () { ctx.set({ by: 'group' }); } }, 'Theo nhóm lớp')
        ]);
        box.appendChild(el('label', { class: 'f' }, ['Hiển thị', seg]));
      }
    },
    render: function (ctx, root) {
      const D = ctx.D, now = ctx.now, cfg = ctx.cfg, r = ctx.range, pr = ctx.prev;
      const by = ctx.q.by === 'group' ? 'group' : 'class';
      const sessions = M.sessionsIn(D, ctx.scope, r.from, r.to);
      const ops = M.opsSummary(sessions, now, cfg);
      const opsPrev = M.opsSummary(M.sessionsIn(D, ctx.scope, pr.from, pr.to), now, cfg);

      root.appendChild(UI.kpis([
        { label: 'Tổng số lịch học diễn ra', value: F.int(ops.total), sub: ops.started + ' đã bắt đầu · ' + ops.upcoming + ' chưa diễn ra', ref: 'M-OPS-01', delta: { cur: ops.total, prev: opsPrev.total, kind: 'count', complete: true } },
        { label: 'Tỉ lệ lịch học đã điểm danh', value: F.pct(ops.takenRate), sub: ops.taken + '/' + ops.started + ' buổi đã bắt đầu', ref: 'M-OPS-03', delta: { cur: ops.takenRate, prev: opsPrev.takenRate, kind: 'rate', goodUp: true } },
        { label: 'Tỉ lệ lịch học đã báo cáo', value: F.pct(ops.reportedRate), sub: ops.reported + '/' + ops.ended + ' buổi đã kết thúc', ref: 'M-OPS-04', delta: { cur: ops.reportedRate, prev: opsPrev.reportedRate, kind: 'rate', goodUp: true } },
        { label: 'Điểm danh đúng thời điểm', value: F.pct(ops.attOnTimeRate), sub: ops.attOnTime + '/' + ops.attOnTimeDenom + ' buổi · trong ' + cfg.ops.attendanceGraceMin + ' phút đầu', ref: 'M-OPS-06', proposal: true, delta: { cur: ops.attOnTimeRate, prev: opsPrev.attOnTimeRate, kind: 'rate', goodUp: true } },
        { label: 'Báo cáo trong ' + cfg.ops.reportOnTimeHours + ' giờ', value: F.pct(ops.report24Rate), sub: ops.rep24 + '/' + ops.rep24Denom + ' buổi đã kết thúc ≥ ' + cfg.ops.reportOnTimeHours + ' giờ', ref: 'M-OPS-08', proposal: true, delta: { cur: ops.report24Rate, prev: opsPrev.report24Rate, kind: 'rate', goodUp: true } }
      ]));
      root.appendChild(el('div', { class: 'muted small', text: 'Kỳ: ' + r.label + ' · so sánh với kỳ trước: ' + pr.label + (r.isCurrent ? ' · kỳ hiện tại tính đến ' + DT.fmtTime(now) + ' hôm nay' : '') }));

      // ---- Đơn vị so sánh: lớp hoặc nhóm lớp
      const units = by === 'group'
        ? D.groups.filter(function (g) { return !ctx.groupId || g.id === ctx.groupId; }).map(function (g) { return { id: g.id, name: g.name, scope: Object.assign({}, ctx.scope, { groupIds: [g.id], classIds: ctx.classId ? [ctx.classId] : null }) }; })
        : ctx.classIdsInScope().map(function (c) { return { id: c, name: ctx.className(c), scope: Object.assign({}, ctx.scope, { classIds: [c] }) }; });
      units.forEach(function (u) { u.ops = M.opsSummary(M.sessionsIn(D, u.scope, r.from, r.to), now, cfg); });
      const shown = units.filter(function (u) { return u.ops.total > 0; });
      const unitWord = by === 'group' ? 'nhóm lớp' : 'lớp';
      const goUnit = function (u) {
        if (by === 'group') ctx.set({ groupId: u.id, classId: null, by: null });
        else window.location.href = ctx.href('class.html', { classId: u.id, groupId: null });
      };

      const row1 = el('div', { class: 'grid g2' });
      root.appendChild(row1);
      row1.appendChild(UI.card({
        title: 'Số lịch học theo ' + unitWord,
        question: 'Lịch học trong kỳ phân bổ giữa các ' + unitWord + ' như thế nào; ' + unitWord + ' nào không có buổi nào?',
        chart: {
          height: 280,
          build: function () {
            return GT.charts.columns({
              categories: shown.map(function (u) { return u.name; }), rotate: by === 'class' && shown.length > 10 ? 45 : 0, interval: 0,
              series: [{ name: 'Đã bắt đầu', color: C.series[0], data: shown.map(function (u) { return u.ops.started; }) }, { name: 'Chưa diễn ra', color: '#C9C3D3', data: shown.map(function (u) { return u.ops.upcoming; }) }],
              fmt: function (v) { return F.int(v); }, integer: true, empty: { title: 'Không có lịch học', text: 'Không có buổi học nào trong ' + r.label + '.' }
            });
          },
          onClick: function (p) { goUnit(shown[p.dataIndex]); }
        },
        note: units.length > shown.length ? (units.length - shown.length) + ' ' + unitWord + ' không có buổi học nào trong kỳ: ' + esc(units.filter(function (u) { return !u.ops.total; }).map(function (u) { return u.name; }).join(', ')) + '.' : null,
        table: function () { return opsTable(shown, unitWord); }
      }));
      row1.appendChild(UI.card({
        title: 'Tỉ lệ đã điểm danh / đã báo cáo theo ' + unitWord,
        question: unitWord.charAt(0).toUpperCase() + unitWord.slice(1) + ' nào điểm danh và báo cáo chưa đầy đủ?',
        chart: {
          height: 280,
          build: function () {
            const st = shown.filter(function (u) { return u.ops.started; });
            return GT.charts.columns({
              categories: st.map(function (u) { return u.name; }), rotate: by === 'class' && st.length > 10 ? 45 : 0, interval: 0, max: 100,
              axisFmt: GT.charts.pctAxis, fmt: function (v) { return F.num(v, 1) + '%'; },
              series: [
                { name: 'Đã điểm danh (buổi đã bắt đầu)', color: C.series[0], data: st.map(function (u) { return u.ops.takenRate === null ? null : u.ops.takenRate * 100; }) },
                { name: 'Đã báo cáo (buổi đã kết thúc)', color: C.series[1], data: st.map(function (u) { return u.ops.reportedRate === null ? null : u.ops.reportedRate * 100; }) }
              ],
              tipExtra: function (i) { const o = st[i].ops; return '<div style="color:#6B7180;margin-top:4px">Điểm danh ' + o.taken + '/' + o.started + ' · báo cáo ' + o.reported + '/' + o.ended + '</div>'; },
              empty: { title: 'Chưa có buổi nào bắt đầu', text: 'Kỳ đang chọn chỉ có buổi chưa diễn ra.' }
            });
          },
          onClick: function (p) { const st = shown.filter(function (u) { return u.ops.started; }); goUnit(st[p.dataIndex]); }
        },
        table: function () { return opsTable(shown, unitWord); }
      }));

      // ---- [ĐX] Phân loại trạng thái buổi
      root.appendChild(UI.card({
        title: 'Phân loại trạng thái buổi học theo ' + unitWord, proposal: true,
        question: 'Bao nhiêu buổi đủ cả điểm danh và báo cáo, bao nhiêu buổi thiếu một phần hoặc chưa có gì?',
        chart: {
          height: 300,
          build: function () {
            return GT.charts.stack({
              categories: shown.map(function (u) { return u.name; }), horizontal: shown.length > 8, percent: true, unit: 'buổi', labels: shown.length <= 8,
              series: M.SESSION_CATEGORIES.map(function (k) { return { name: L.session[k], color: C.session[k], data: shown.map(function (u) { return u.ops.cat[k]; }) }; }),
              empty: { title: 'Không có lịch học', text: 'Không có buổi học nào trong kỳ.' }
            });
          },
          onClick: function (p) { goUnit(shown[p.dataIndex]); }
        },
        table: function () {
          return {
            columns: [{ key: 'name', label: unitWord }].concat(M.SESSION_CATEGORIES.map(function (k) { return { key: k, label: L.session[k], align: 'r', value: function (u) { return u.ops.cat[k]; } }; })),
            rows: shown, csv: 'phan-loai-buoi.csv'
          };
        }
      }));

      // ---- [ĐX] Điểm danh đúng thời điểm + độ trễ báo cáo
      const row2 = el('div', { class: 'grid g2' });
      root.appendChild(row2);
      const onTimeItems = shown.filter(function (u) { return u.ops.attOnTimeDenom; }).map(function (u) { return { id: u.id, name: u.name, value: u.ops.attOnTimeRate * 100, n: u.ops.attOnTimeDenom }; })
        .sort(function (a, b) { return a.value - b.value; });
      onTimeItems.forEach(function (x, i) { x.emph = i < 5 && x.value < 90; });
      row2.appendChild(UI.card({
        title: 'Điểm danh đúng thời điểm theo ' + unitWord, proposal: true,
        question: 'Giáo viên có điểm danh trước hoặc trong ' + cfg.ops.attendanceGraceMin + ' phút đầu buổi không — điểm danh cuối ngày không còn giá trị giám sát.',
        body: (function () {
          const box = el('div', { style: { maxHeight: '320px', overflowY: 'auto' } });
          const c = el('div', { class: 'chart' });
          box.appendChild(c);
          GT.charts.mount(c, function () {
            return GT.charts.rankBar({
              items: onTimeItems, fmt: function (v) { return F.num(v, 1) + '%'; }, axisFmt: GT.charts.pctAxis, max: 100, unit: 'buổi', valueLabel: 'Điểm danh đúng thời điểm',
              marks: ops.attOnTimeRate === null ? [] : [{ value: ops.attOnTimeRate * 100, label: 'Chung' }], accent: C.status.ORANGE,
              empty: { title: 'Chưa có buổi nào bắt đầu quá ' + cfg.ops.attendanceGraceMin + ' phút', text: '' }
            });
          }, { height: 240, onClick: function (p) { const it = onTimeItems[p.dataIndex]; if (it) goUnit(it); } });
          return box;
        })(),
        note: 'Sắp xếp từ thấp đến cao; 5 ' + unitWord + ' thấp nhất (dưới 90%) được tô cam. Mẫu số: buổi đã bắt đầu ≥ ' + cfg.ops.attendanceGraceMin + ' phút.',
        table: function () { return { columns: [{ key: 'name', label: unitWord }, { key: 'value', label: '% đúng thời điểm', align: 'r', fmt: function (x) { return F.pct100(x.value); } }, { key: 'n', label: 'Số buổi', align: 'r' }], rows: onTimeItems, csv: 'diem-danh-dung-thoi-diem.csv' }; }
      }));
      row2.appendChild(UI.card({
        title: 'Độ trễ nộp báo cáo buổi học', proposal: true,
        question: 'Báo cáo buổi học được nộp nhanh hay dồn về sau nhiều ngày?',
        chart: {
          height: 260,
          build: function () {
            return GT.charts.histogram({
              bins: M.LATENCY_BUCKETS.map(function (k) { return L.latency[k]; }), counts: M.LATENCY_BUCKETS.map(function (k) { return ops.latency[k]; }),
              colors: M.LATENCY_BUCKETS.map(function (k) { return C.latency[k]; }), yName: 'Số buổi', xName: 'Thời gian từ khi kết thúc buổi đến khi nộp báo cáo',
              empty: { title: 'Chưa có buổi nào kết thúc', text: '' }
            });
          }
        },
        note: 'Tính trên ' + ops.ended + ' buổi đã kết thúc trong kỳ. "Chưa nộp" gồm cả buổi vừa kết thúc chưa quá ' + cfg.ops.reportOnTimeHours + ' giờ.',
        table: function () { return { columns: [{ key: 'b', label: 'Độ trễ' }, { key: 'n', label: 'Số buổi', align: 'r' }, { key: 'p', label: 'Tỉ lệ', align: 'r' }], rows: M.LATENCY_BUCKETS.map(function (k) { return { b: L.latency[k], n: ops.latency[k], p: F.pct(GT.stats.ratio(ops.latency[k], ops.ended)) }; }), csv: 'do-tre-bao-cao.csv' }; }
      }));

      // ---- [ĐX] Heatmap ngày × lớp
      root.appendChild(dayClassHeatmap(ctx, sessions));

      // ---- [ĐX] Danh sách buổi học
      root.appendChild(sessionTable(ctx, sessions));

      // ---- Cảnh báo OPS
      const al = A.filter(ctx.alerts(), { groups: ['OPS'], classIds: ctx.classId ? [ctx.classId] : null, groupId: ctx.groupId, teacherId: ctx.teacherId });
      root.appendChild(UI.alertBlock({ alerts: al, title: 'Cảnh báo vận hành (OPS)', moreHref: 'alerts.html' + GT.qs.build({ alertGroup: 'OPS', groupId: ctx.groupId, classId: ctx.classId }), note: 'Cảnh báo đánh giá tại thời điểm hiện tại theo cửa sổ của từng quy tắc (không phụ thuộc kỳ đang xem).' }));
    }
  });

  function opsTable(units, unitWord) {
    return {
      columns: [
        { key: 'name', label: unitWord.charAt(0).toUpperCase() + unitWord.slice(1) },
        { key: 'total', label: 'Số buổi', align: 'r', value: function (u) { return u.ops.total; } },
        { key: 'started', label: 'Đã bắt đầu', align: 'r', value: function (u) { return u.ops.started; } },
        { key: 'taken', label: '% đã điểm danh', align: 'r', value: function (u) { return u.ops.takenRate; }, fmt: function (u) { return F.pct(u.ops.takenRate) + ' <span class="muted small">' + u.ops.taken + '/' + u.ops.started + '</span>'; }, csv: function (u) { return u.ops.takenRate; } },
        { key: 'rep', label: '% đã báo cáo', align: 'r', value: function (u) { return u.ops.reportedRate; }, fmt: function (u) { return F.pct(u.ops.reportedRate) + ' <span class="muted small">' + u.ops.reported + '/' + u.ops.ended + '</span>'; }, csv: function (u) { return u.ops.reportedRate; } }
      ],
      rows: units, csv: 'lich-hoc-theo-' + (unitWord === 'lớp' ? 'lop' : 'nhom') + '.csv'
    };
  }

  function dayClassHeatmap(ctx, sessions) {
    const D = ctx.D, now = ctx.now, r = ctx.range;
    const days = GT.period.buckets(r.from, r.to, 'day');
    const classIds = Array.from(new Set(sessions.map(function (s) { return s.classId; }))).sort();
    const byKey = new Map();
    sessions.forEach(function (s) {
      const k = s.classId + '|' + DT.dayKey(s.start);
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k).push(s);
    });
    const cells = [];
    classIds.forEach(function (cid, yi) {
      days.forEach(function (d, xi) {
        const list = byKey.get(cid + '|' + DT.dayKey(d.from));
        if (!list) return;
        let worst = 'UPCOMING';
        list.forEach(function (s) { const c = M.sessionCategory(s, now); if (CAT_ORDER.indexOf(c) < CAT_ORDER.indexOf(worst)) worst = c; });
        cells.push({
          x: xi, y: yi, color: C.session[worst], text: L.sessionCode[worst] + (list.length > 1 ? list.length : ''),
          tip: '<b>' + esc(ctx.className(cid)) + ' · ' + DT.fmtLongDate(d.from) + '</b><br>' + list.map(function (s) {
            return DT.fmtTime(s.start) + ' ' + esc(D.courseById.get(s.courseId).shortName) + ': ' + esc(L.session[M.sessionCategory(s, now)]);
          }).join('<br>') + (list.length > 1 ? '<br><span style="color:#6B7180">Ô hiển thị trạng thái kém nhất trong ngày</span>' : '')
        });
      });
    });
    return UI.card({
      title: 'Trạng thái buổi học theo ngày × lớp', proposal: true,
      question: 'Lớp nào thường xuyên thiếu điểm danh/báo cáo, vào những ngày nào?',
      chart: {
        height: 300,
        build: function () {
          return GT.charts.catHeatmap({
            xCats: days.map(function (d) { return d.label; }), yCats: classIds.map(ctx.className), cells: cells, rowHeight: 24,
            xInterval: days.length > 40 ? 1 : 0, labelSize: days.length > 20 ? 9 : 11, yLabelWidth: 60,
            empty: { title: 'Không có lịch học', text: 'Không có buổi học nào trong kỳ.' }
          });
        },
        onClick: function (p) { const cid = classIds[p.data.value[1]]; if (cid) window.location.href = ctx.href('class.html', { classId: cid, groupId: null }); }
      },
      legend: CAT_ORDER.map(function (k) { return { color: C.session[k], label: L.sessionCode[k] + ' ' + L.session[k] }; }),
      note: 'Một lớp có thể có nhiều buổi/ngày: ô hiển thị trạng thái kém nhất (số nhỏ = số buổi), tooltip liệt kê từng buổi. ' + (days.length > 31 ? 'Kỳ dài — nên xem theo tháng hoặc ngắn hơn.' : '')
    });
  }

  function sessionTable(ctx, sessions) {
    const D = ctx.D, now = ctx.now, cfg = ctx.cfg;
    const grace = cfg.ops.attendanceGraceMin * DT.MIN;
    const filterVal = ctx.q.st || '';
    const attStatus = function (s) {
      if (s.start > now) return { t: 'Chưa diễn ra', c: '#D1D5DB', k: 'UPCOMING' };
      if (s.attendanceSubmittedAt === null) return { t: 'Chưa điểm danh', c: C.status.RED, k: 'NO_ATT' };
      if (s.attendanceSubmittedAt <= s.start + grace) return { t: 'Đúng thời điểm (' + DT.fmtTime(s.attendanceSubmittedAt) + ')', c: C.status.GREEN, k: 'ATT_OK' };
      return { t: 'Muộn ' + DT.fmtDuration(s.attendanceSubmittedAt - s.start) + ' (' + DT.fmtTime(s.attendanceSubmittedAt) + ')', c: C.status.ORANGE, k: 'ATT_LATE' };
    };
    const repStatus = function (s) {
      if (s.end > now) return { t: s.start > now ? 'Chưa diễn ra' : 'Đang diễn ra', c: '#D1D5DB', k: 'UPCOMING' };
      if (s.reportSubmittedAt === null) return { t: 'Chưa nộp (' + DT.fmtDuration(now - s.end) + ')', c: C.status.RED, k: 'NO_REP' };
      const b = M.reportLatencyBucket(s);
      return { t: L.latency[b] + ' (' + DT.fmtDateTime(s.reportSubmittedAt) + ')', c: C.latency[b], k: 'REP_' + b };
    };
    const rows = sessions.filter(function (s) {
      if (!filterVal) return true;
      if (filterVal === 'NO_ATT') return attStatus(s).k === 'NO_ATT';
      if (filterVal === 'ATT_LATE') return attStatus(s).k === 'ATT_LATE';
      if (filterVal === 'NO_REP') return repStatus(s).k === 'NO_REP';
      return true;
    });
    const sel = UI.select('Lọc', [{ value: 'NO_ATT', label: 'Chưa điểm danh' }, { value: 'ATT_LATE', label: 'Điểm danh muộn' }, { value: 'NO_REP', label: 'Chưa nộp báo cáo' }], filterVal, function (v) { ctx.set({ st: v }); }, 'Tất cả buổi');
    return UI.card({
      title: 'Danh sách buổi học', proposal: true, id: 'sessions',
      question: 'Buổi cụ thể nào chưa điểm danh, điểm danh muộn hoặc chưa có báo cáo?',
      tools: [sel],
      body: UI.table({
        columns: [
          { key: 'date', label: 'Ngày', value: function (s) { return s.start; }, fmt: function (s) { return DT.weekdayShort(s.start) + ' ' + DT.fmtDate(s.start); }, csv: function (s) { return DT.fmtDate(s.start); } },
          { key: 'time', label: 'Giờ', value: function (s) { return DT.minutesOfDay(s.start); }, fmt: function (s) { return DT.fmtTime(s.start) + '–' + DT.fmtTime(s.end); }, csv: function (s) { return DT.fmtTime(s.start) + '-' + DT.fmtTime(s.end); } },
          { key: 'cls', label: 'Lớp', value: function (s) { return ctx.className(s.classId); }, fmt: function (s) { return UI.link(ctx.href('class.html', { classId: s.classId, groupId: null }), ctx.className(s.classId)); } },
          { key: 'course', label: 'Khóa', value: function (s) { return D.courseById.get(s.courseId).shortName; } },
          { key: 'gv', label: 'Giáo viên', value: function (s) { return ctx.teacherName(s.teacherId); } },
          { key: 'att', label: 'Điểm danh', value: function (s) { return attStatus(s).t; }, fmt: function (s) { const a = attStatus(s); return UI.dotLabel(a.c, a.t); } },
          { key: 'rep', label: 'Báo cáo', value: function (s) { return repStatus(s).t; }, fmt: function (s) { const a = repStatus(s); return UI.dotLabel(a.c, a.t); } },
          { key: 'link', label: '', sort: false, csv: false, fmt: function (s) { return s.start <= now ? '<button type="button" class="btn sm" data-sid="' + s.id + '">Xem báo cáo</button>' : ''; } }
        ],
        rows: rows, sort: { key: 'date', dir: 1 }, capped: true, csv: 'danh-sach-buoi-hoc.csv',
        empty: 'Không có buổi học nào khớp bộ lọc.'
      }),
      note: 'Kỳ: ' + esc(ctx.range.label) + '. "Đúng thời điểm" = điểm danh trước hoặc trong ' + cfg.ops.attendanceGraceMin + ' phút đầu buổi.'
    });
  }

  document.addEventListener('click', function (e) {
    const b = e.target.closest && e.target.closest('button[data-sid]');
    if (!b) return;
    const D = GT.D, s = D.sessionById.get(b.getAttribute('data-sid'));
    if (!s) return;
    const ctxLite = {
      D: D, now: D.meta.now, cfg: GT.config.get(),
      className: function (id) { return D.classById.get(id).name; }, teacherName: function (id) { return D.teacherById.get(id).name; }
    };
    V.sessionReportPopup(ctxLite, s);
  });
})(window.GT);
