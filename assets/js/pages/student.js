/**
 * hoc-vu/student.html — [ĐỀ XUẤT] 4.8 Hồ sơ học sinh.
 * Tổng hợp MỘT học sinh trên mọi lớp đang/đã tham gia: chuyên cần theo lớp, nhiệm vụ, khóa trực tuyến,
 * chuẩn đầu ra so với TB lớp, cảnh báo đang mở. Có bản in (@media print) cho họp phụ huynh / hội đồng.
 */
(function (GT) {
  'use strict';
  const M = GT.metrics, A = GT.alerts, UI = GT.ui, V = GT.views, F = GT.fmt, DT = GT.date, C = GT.colors, L = GT.labels, S = GT.stats;
  const el = UI.el, esc = UI.esc;

  GT.page({
    id: 'student',
    title: 'Hồ sơ học sinh',
    subtitle: 'Tổng hợp một học sinh trên mọi lớp tham gia · có bản in',
    filters: {
      period: 'custom', customFrom: function (D) { return D.meta.dataStart; },
      extra: function (box, ctx) {
        const D = ctx.D;
        const dl = el('datalist', { id: 'stu-list' });
        D.students.forEach(function (s) {
          const cls = (D.idx.enrollByStudent.get(s.id) || []).map(function (e) { return ctx.className(e.classId); }).join(', ');
          dl.appendChild(el('option', { value: s.fullName + ' · ' + s.code + ' · ' + cls }));
        });
        const cur = ctx.q.studentId && D.studentById.get(ctx.q.studentId);
        const inp = el('input', { type: 'search', list: 'stu-list', placeholder: 'Tìm học sinh theo tên hoặc mã HS…', 'aria-label': 'Chọn học sinh', style: { minWidth: '320px' }, value: cur ? cur.fullName + ' · ' + cur.code : '' });
        inp.addEventListener('change', function () {
          const m = /HS\d+/.exec(inp.value || '');
          const s = m && D.students.filter(function (x) { return x.code === m[0]; })[0];
          if (s) ctx.set({ studentId: s.id });
        });
        box.appendChild(el('label', { class: 'f' }, ['Học sinh', inp, dl]));
        if (cur) box.appendChild(el('button', { type: 'button', class: 'btn', onclick: function () { GT.charts.flush(); window.print(); } }, '🖨 In hồ sơ'));
      }
    },
    render: function (ctx, root) {
      const D = ctx.D, now = ctx.now, cfg = ctx.cfg, r = ctx.range;
      const sid = ctx.q.studentId && D.studentById.has(ctx.q.studentId) ? ctx.q.studentId : null;
      if (!sid) { picker(ctx, root); return; }
      const stu = D.studentById.get(sid);
      const enr = (D.idx.enrollByStudent.get(sid) || []).slice().sort(function (a, b) { return a.startAt - b.startAt; });
      const alerts = A.filter(ctx.alerts(), { studentId: sid });
      const open = alerts.filter(function (a) { return a.status !== 'RESOLVED' && a.status !== 'IGNORED'; });

      // ---- Thông tin
      root.appendChild(el('section', { class: 'card' }, [
        el('div', { class: 'card-head' }, [el('h3', { style: { fontSize: '19px' }, text: stu.fullName }), el('span', { class: 'badge hist', text: 'Mã HS ' + stu.code })]),
        el('div', { class: 'small', style: { marginTop: '6px', lineHeight: 1.8 } }, enr.map(function (e) {
          const c = D.classById.get(e.classId);
          const active = e.startAt <= now && (e.endAt === null || now <= e.endAt);
          return el('div', {}, [
            el('a', { href: ctx.href('class.html', { classId: c.id, groupId: null }), text: 'Lớp ' + c.name }),
            ' · ' + ctx.groupName(c.groupId) + ' · ghi danh ' + DT.fmtDate(e.startAt) + (e.endAt ? ' – ' + DT.fmtDate(e.endAt) : '') + ' · ',
            el('span', { class: 'badge ' + (active ? 'fix' : 'hist'), text: active ? 'Đang học' : 'Đã chuyển lớp' }),
            c.homeroomTeacherId ? el('span', { class: 'muted', text: ' · GVCN ' + ctx.teacherName(c.homeroomTeacherId) }) : null
          ]);
        })),
        el('div', { class: 'small muted', style: { marginTop: '4px' }, text: 'Kỳ tổng hợp: ' + r.label + ' (đổi ở bộ lọc phía trên) · in lúc ' + DT.fmtDateTime(now) + ' · dữ liệu mô phỏng' })
      ]));

      // ---- KPI tổng hợp (cấp học sinh: gộp mọi lớp)
      const att = M.attendanceCounts(D, { studentIds: [sid] }, r.from, r.to);
      const ar = M.attendanceRates(att);
      const byStuAtt = M.attendanceByStudent(D, { studentIds: [sid] }, r.from, r.to).get(sid);
      const tk = M.taskCounts(D, { studentIds: [sid] }, r.from, r.to);
      const tr = M.taskRates(tk);
      const prog = (D.idx.progByStudent.get(sid) || []);
      let failed = 0, withLo = 0;
      enr.forEach(function (e) {
        if (!(e.startAt <= now && (e.endAt === null || now <= e.endAt))) return;
        (D.idx.classCoursesByClass.get(e.classId) || []).forEach(function (cc) { const p = M.studentLoProfile(D, sid, e.classId, cc.courseId, cfg); failed += p.failed; withLo += M.LEVELS.filter(function (l) { return l !== 'NO_DATA'; }).reduce(function (s, l) { return s + p.levels[l]; }, 0); });
      });
      root.appendChild(UI.kpis([
        { label: 'Tỉ lệ có mặt (gộp mọi lớp)', value: F.pct(ar.present), sub: (att.ON_TIME + att.LATE) + '/' + att.taken + ' buổi · muộn ' + att.LATE, ref: 'M-ATT-07' },
        { label: 'Vắng có phép / không phép', value: att.EXCUSED + ' / ' + att.UNEXCUSED, sub: 'chuỗi không phép dài nhất: ' + (byStuAtt ? byStuAtt.longestUnexcused : 0) + ' buổi', ref: 'M-ATT-10' },
        { label: 'Nộp nhiệm vụ đúng hạn', value: F.pct(tr.onTime), sub: tk.ON_TIME + '/' + tk.overdue + ' · không hoàn thành ' + tk.MISSING, ref: 'M-HW-02' },
        { label: 'Điểm TB nhiệm vụ', value: F.score(tr.avgScore), sub: tk.graded + ' bài đã chấm (thang 10)', ref: 'M-HW-07' },
        { label: 'Chuẩn đầu ra chưa đạt', value: F.int(failed), sub: 'trên ' + withLo + ' CĐR có dữ liệu (lớp đang học)', ref: 'M-LO-02' },
        { label: 'Cảnh báo đang mở', value: F.int(open.length), sub: A.SEVERITY_ORDER.map(function (s) { return open.filter(function (a) { return a.severity === s; }).length + ' ' + A.SEVERITY[s].label.toLowerCase(); }).join(' · ') }
      ]));

      // ---- Chuyên cần theo lớp
      const classIds = Array.from(new Set(enr.map(function (e) { return e.classId; })));
      const perClass = classIds.map(function (cid) { return { cid: cid, c: M.attendanceCounts(D, { studentIds: [sid], classIds: [cid] }, r.from, r.to) }; });
      const attRows = perClass.concat([{ cid: null, c: att }]);
      const row = el('div', { class: 'grid g2' });
      root.appendChild(row);
      row.appendChild(UI.card({
        title: 'Chuyên cần theo lớp', question: 'Học sinh đi học thế nào ở từng lớp tham gia?',
        chart: {
          height: 70 + perClass.length * 40,
          build: function () {
            return GT.charts.stack({ categories: perClass.map(function (x) { return 'Lớp ' + ctx.className(x.cid); }), horizontal: true, percent: true, unit: 'buổi', labels: true,
              series: ['ON_TIME', 'LATE', 'EXCUSED', 'UNEXCUSED'].map(function (k) { return { name: L.att[k], color: C.att[k], data: perClass.map(function (x) { return x.c[k]; }) }; }) });
          }
        },
        body: UI.table({
          columns: [{ key: 'cls', label: 'Lớp', value: function (x) { return x.cid ? ctx.className(x.cid) : 'Tổng (gộp mọi lớp)'; }, fmt: function (x) { return x.cid ? 'Lớp ' + esc(ctx.className(x.cid)) : '<b>Tổng (gộp mọi lớp)</b>'; } }]
            .concat(M.ATT_STATUSES.map(function (k) { return { key: k, label: L.att[k], align: 'r', value: function (x) { return x.c[k]; } }; }))
            .concat([{ key: 'p', label: 'Có mặt', align: 'r', value: function (x) { return M.attendanceRates(x.c).present; }, fmt: function (x) { return F.pct(M.attendanceRates(x.c).present); } }]),
          rows: attRows, csv: 'chuyen-can-' + stu.code + '.csv'
        }),
        note: 'Cấp học sinh toàn trường gộp mọi buổi của mọi lớp; cấp lớp chỉ tính buổi của lớp đó. Bản ghi "chưa điểm danh" không vào mẫu số.'
      }));
      // ---- Khóa trực tuyến
      const asg = prog.map(function (p) { return { p: p, a: D.assignmentById.get(p.assignmentId) }; }).filter(function (x) { return x.a.startAt <= now; }).sort(function (x, y) { return x.a.dueAt - y.a.dueAt; });
      row.appendChild(UI.card({
        title: 'Khóa trực tuyến: tiến độ và điểm tổng hợp', question: 'Học sinh có hoàn thành khóa trực tuyến đúng tiến độ và đạt ngưỡng không?',
        chart: {
          height: 70 + asg.length * 34,
          build: function () {
            return GT.charts.progress({ items: asg.map(function (x) { return { name: x.a.title, actual: M.progressAt(x.p, now) || 0, expected: M.expectedProgress(x.a, now) }; }), tolerance: cfg.online.onTrackTolerancePts, labelWidth: 170, empty: { title: 'Chưa được giao khóa trực tuyến', text: '' } });
          }
        },
        body: UI.table({
          columns: [
            { key: 't', label: 'Khóa trực tuyến', value: function (x) { return x.a.title; }, fmt: function (x) { return esc(x.a.title) + '<div class="muted small">Lớp ' + esc(ctx.className(x.a.classId)) + ' · hạn ' + DT.fmtDate(x.a.dueAt) + '</div>'; } },
            { key: 'st', label: 'Trạng thái', value: function (x) { return M.onlineStatus(x.a, x.p, now); }, fmt: function (x) { const k = M.onlineStatus(x.a, x.p, now); return UI.dotLabel(C.task[k], L.task[k]); } },
            { key: 'pr', label: 'Tiến độ', align: 'r', value: function (x) { return M.progressAt(x.p, now); }, fmt: function (x) { return F.pct(M.progressAt(x.p, now), 0) + ' <span class="muted small">KV ' + F.pct(M.expectedProgress(x.a, now), 0) + '</span>'; } },
            { key: 'cs', label: 'Điểm tổng hợp', align: 'r', value: function (x) { return M.compositeScore(x.p, M.courseParams(D, x.a.courseId, cfg), now).value; }, fmt: function (x) {
              const pa = M.courseParams(D, x.a.courseId, cfg);
              const v = x.a.dueAt > now ? M.projectedComposite(x.a, x.p, now, pa) : M.compositeScore(x.p, pa, now).value;
              const ok = v >= pa.passThreshold;
              return '<b style="color:' + (ok ? 'var(--good-text)' : 'var(--bad-text)') + '">' + F.num(v, 1) + (ok ? ' ✓' : ' ✕') + '</b><div class="muted small">' + (x.a.dueAt > now ? 'dự kiến · ' : '') + 'ngưỡng ' + pa.passThreshold + ' · KT ' + (x.p.testScore === null ? '–' : x.p.testScore) + '</div>';
            } }
          ], rows: asg, csv: false
        }),
        note: 'Điểm tổng hợp = w₁ × tỉ lệ hoàn thành bài tập + w₂ × điểm kiểm tra; khóa chưa đến hạn hiển thị điểm dự kiến (theo tốc độ hiện tại).'
      }));

      // ---- Nhiệm vụ theo lớp–khóa
      const byTask = M.taskByStudent(D, { studentIds: [sid] }, r.from, r.to).get(sid);
      const items = byTask ? byTask.items : [];
      const keys = Array.from(new Set(items.map(function (it) { return it.task.classId + '|' + it.task.courseId; })));
      const tRows = keys.map(function (k) {
        const p = k.split('|');
        const c = M.taskCounts(D, { studentIds: [sid], classIds: [p[0]], courseIds: [p[1]] }, r.from, r.to);
        return { k: k, cid: p[0], co: p[1], c: c };
      });
      const missing = items.filter(function (it) { return it.status === 'MISSING'; }).sort(function (a, b) { return b.task.dueAt - a.task.dueAt; }).slice(0, 10);
      root.appendChild(UI.card({
        title: 'Nhiệm vụ theo lớp – khóa', question: 'Học sinh nộp bài đầy đủ, đúng hạn ở môn nào; bỏ bài nào gần đây?',
        body: el('div', {}, [
          UI.table({
            columns: [
              { key: 'k', label: 'Lớp – khóa', value: function (x) { return ctx.className(x.cid) + ctx.courseName(x.co); }, fmt: function (x) { return 'Lớp ' + esc(ctx.className(x.cid)) + ' · ' + esc(ctx.courseName(x.co)); } },
              { key: 'o', label: 'Đã quá hạn', align: 'r', value: function (x) { return x.c.overdue; } },
              { key: 'on', label: 'Đúng hạn', align: 'r', value: function (x) { return x.c.ON_TIME; } },
              { key: 'late', label: 'Muộn', align: 'r', value: function (x) { return x.c.LATE; } },
              { key: 'miss', label: 'Không hoàn thành', align: 'r', value: function (x) { return x.c.MISSING; } },
              { key: 'part', label: 'Nộp chưa đủ', align: 'r', value: function (x) { return x.c.PARTIAL; } },
              { key: 'avg', label: 'Điểm TB', align: 'r', value: function (x) { return M.taskRates(x.c).avgScore; }, fmt: function (x) { return F.score(M.taskRates(x.c).avgScore); } }
            ], rows: tRows, csv: 'nhiem-vu-' + stu.code + '.csv'
          }),
          missing.length ? el('div', { class: 'small', style: { marginTop: '10px' } }, [el('b', { text: 'Nhiệm vụ không hoàn thành gần đây: ' }), missing.map(function (it) { return DT.fmtDate(it.task.dueAt) + ' — ' + it.task.title + ' (lớp ' + ctx.className(it.task.classId) + ')'; }).join(' · ')]) : null
        ])
      }));

      // ---- Chuẩn đầu ra so với TB lớp
      enr.filter(function (e) { return e.startAt <= now && (e.endAt === null || now <= e.endAt); }).forEach(function (e) {
        (D.idx.classCoursesByClass.get(e.classId) || []).forEach(function (cc) {
          const prof = M.studentLoProfile(D, sid, e.classId, cc.courseId, cfg);
          const rows = prof.items.map(function (it) { return { it: it, mean: M.loMeanPercent(D, e.classId, it.lo.id, now) }; });
          root.appendChild(UI.card({
            title: 'Chuẩn đầu ra — ' + ctx.courseName(cc.courseId) + ' (lớp ' + ctx.className(e.classId) + ')',
            question: 'Học sinh đang ở mức nào trên từng chuẩn đầu ra so với trung bình lớp?',
            chart: {
              height: 260,
              build: function () {
                return GT.charts.columns({
                  categories: rows.map(function (x) { return x.it.lo.code; }), max: 100, min: 0, axisFmt: GT.charts.pctAxis, fmt: function (v) { return F.num(v, 0) + '%'; }, interval: 0,
                  series: [
                    { name: 'Học sinh', color: C.accent, data: rows.map(function (x) { return x.it.ach.percent; }), colors: rows.map(function (x) { return C.level[x.it.level]; }), marks: [{ value: M.passPercent(cfg), label: 'Đạt yêu cầu ' + M.passPercent(cfg) + '%', color: C.ink2, dashed: true }] },
                    { name: 'TB lớp', color: '#C9C3D3', data: rows.map(function (x) { return x.mean === null ? null : Math.round(x.mean * 10) / 10; }) }
                  ],
                  tipExtra: function (i) { const x = rows[i]; return '<div style="color:#6B7180">' + esc(x.it.lo.name) + '<br>Cấp: ' + M.LEVEL_META[x.it.level].label + ' · ' + x.it.ach.evidenceCount + ' câu</div>'; }
                });
              }
            },
            legend: M.LEVELS.map(function (l) { return { color: C.level[l], label: M.LEVEL_META[l].label }; }).concat([{ color: '#C9C3D3', label: 'TB lớp (% đạt TB của học sinh có dữ liệu)' }]),
            note: 'Cột học sinh tô theo cấp (kèm cấp trong tooltip và bảng); ' + prof.failed + ' chuẩn đầu ra chưa đạt, ' + prof.poor + ' ở mức Chưa tốt.',
            table: function () {
              return { columns: [{ key: 'c', label: 'Mã', value: function (x) { return x.it.lo.code; } }, { key: 'n', label: 'Chuẩn đầu ra', value: function (x) { return x.it.lo.name; } }, { key: 'p', label: '% đạt', align: 'r', value: function (x) { return x.it.ach.percent; }, fmt: function (x) { return x.it.ach.percent === null ? '–' : F.num(x.it.ach.percent, 1) + '%'; } }, { key: 'l', label: 'Cấp', value: function (x) { return M.LEVEL_META[x.it.level].label; }, fmt: function (x) { return UI.levelChip(x.it.level); } }, { key: 'm', label: 'TB lớp', align: 'r', value: function (x) { return x.mean; }, fmt: function (x) { return x.mean === null ? '–' : F.num(x.mean, 1) + '%'; } }],
                rows: rows, csv: 'cdr-' + stu.code + '-' + cc.courseId + '.csv' };
            }
          }));
        });
      });

      root.appendChild(UI.alertBlock({ alerts: alerts, title: 'Cảnh báo liên quan đến học sinh', moreHref: 'alerts.html' + GT.qs.build({ q: stu.code, status: 'ALL' }), empty: 'Học sinh không có cảnh báo nào.' }));
    }
  });

  function picker(ctx, root) {
    const D = ctx.D;
    const counts = new Map();
    ctx.alerts().forEach(function (a) {
      const ids = a.children ? a.children.map(function (c) { return c.studentId; }) : [a.studentId];
      ids.forEach(function (s) { if (s) counts.set(s, (counts.get(s) || 0) + (a.severity === 'HIGH' ? 3 : a.severity === 'MEDIUM' ? 2 : 1)); });
    });
    const top = Array.from(counts.entries()).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 16);
    const sp = D.meta.special || {};
    const featured = [[sp.transferStudent, 'Chuyển lớp giữa kỳ'], [sp.diligentPoor, 'Chăm nhưng CĐR kém'], [sp.dropStudent, 'Chuyên cần giảm mạnh'], [(sp.chronic || [])[0], 'Vắng triền miên']].filter(function (x) { return x[0]; });
    root.appendChild(UI.card({
      title: 'Chọn học sinh', question: 'Tìm theo tên hoặc mã học sinh ở bộ lọc phía trên, hoặc chọn nhanh bên dưới.', plain: true,
      body: el('div', {}, [
        el('div', { class: 'small', style: { fontWeight: 600, margin: '4px 0' }, text: 'Hồ sơ minh họa' }),
        el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, featured.map(function (x) { return el('a', { class: 'btn', href: ctx.href('student.html', { studentId: x[0] }), text: ctx.studentName(x[0]) + ' — ' + x[1] }); })),
        el('div', { class: 'small', style: { fontWeight: 600, margin: '14px 0 4px' }, text: 'Học sinh có nhiều cảnh báo nhất' }),
        el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, top.map(function (x) { return el('a', { class: 'btn sm', href: ctx.href('student.html', { studentId: x[0] }), text: ctx.studentLabel(x[0]) }); }))
      ])
    }));
  }
})(window.GT);
