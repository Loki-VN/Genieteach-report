/**
 * hoc-vu/settings.html — 4.10 Cấu hình ngưỡng & cảnh báo (CẤP TRƯỜNG).
 * Validate ngưỡng tăng dần, không chồng lấn; xem trước tác động (số cảnh báo, số cặp lớp–CĐR Đỏ) trước khi lưu.
 */
(function (GT) {
  'use strict';
  const M = GT.metrics, A = GT.alerts, UI = GT.ui, F = GT.fmt;
  const el = UI.el, esc = UI.esc;

  function getPath(o, p) { return p.reduce(function (x, k) { return x === undefined || x === null ? undefined : x[k]; }, o); }
  function setPath(o, p, v) {
    let x = o;
    for (let i = 0; i < p.length - 1; i++) { if (x[p[i]] === undefined || x[p[i]] === null) x[p[i]] = {}; x = x[p[i]]; }
    x[p[p.length - 1]] = v;
  }

  /** Kiểm tra cấu hình nháp. Trả về {pathKey: thông báo lỗi}. */
  function validate(cfg, D) {
    const err = {};
    const num = function (p, lo, hi, msg, int) {
      const v = getPath(cfg, p);
      if (typeof v !== 'number' || !isFinite(v)) { err[p.join('.')] = 'Nhập một số.'; return false; }
      if ((lo !== null && v < lo) || (hi !== null && v > hi)) { err[p.join('.')] = msg || ('Giá trị trong khoảng ' + lo + '–' + hi + '.'); return false; }
      if (int && Math.round(v) !== v) { err[p.join('.')] = 'Nhập số nguyên.'; return false; }
      return true;
    };
    const L = cfg.lo.levels;
    ['excellent', 'good', 'average', 'needsImprovement'].forEach(function (k) { num(['lo', 'levels', k], 0, 100); });
    if (!(L.excellent > L.good && L.good > L.average && L.average > L.needsImprovement && L.needsImprovement > 0)) {
      err['lo.levels.good'] = 'Ngưỡng phải giảm dần, không chồng lấn: Rất tốt > Tốt > Trung bình > Cần cải thiện > 0.';
    }
    num(['lo', 'color', 'green'], 1, 100); num(['lo', 'color', 'orange'], 0, 99);
    if (!(cfg.lo.color.green > cfg.lo.color.orange)) err['lo.color.orange'] = 'Ngưỡng Cam phải nhỏ hơn ngưỡng Xanh.';
    num(['lo', 'thinCoverage'], 1, 100);
    num(['cause', 'curriculumRedShare'], 1, 100); num(['cause', 'minClassesForCurriculum'], 2, 50, 'Tối thiểu 2 lớp.', true);
    num(['cause', 'classGapPts'], 1, 100); num(['cause', 'minOtherClasses'], 1, 50, null, true);
    num(['cause', 'minStudentsWithData'], 1, 200, null, true); num(['cause', 'minAvgEvidence'], 0, 100);
    D.courses.forEach(function (c) {
      const base = ['courses', c.id];
      num(base.concat('passThreshold'), 0, 100);
      num(base.concat('weightTaskCompletion'), 0, 1); num(base.concat('weightTestScore'), 0, 1);
      const w = getPath(cfg, base.concat('weightTaskCompletion')) + getPath(cfg, base.concat('weightTestScore'));
      if (Math.abs(w - 1) > 1e-6) err[base.concat('weightTestScore').join('.')] = 'Tổng hai trọng số phải bằng 1 (hiện ' + F.num(w, 2) + ').';
    });
    num(['ops', 'attendanceGraceMin'], 0, 240, null, true); num(['ops', 'reportOnTimeHours'], 1, 240);
    num(['online', 'onTrackTolerancePts'], 0, 100); num(['online', 'activeLearningPct'], 1, 99);
    num(['homework', 'anomalyRateGapPts'], 0, 100); num(['homework', 'anomalyScoreGap'], 0, 10);
    num(['ranking', 'minSample'], 1, 10000, null, true);
    num(['alerts', 'minDenominator'], 1, 10000, null, true); num(['alerts', 'minStudentsWithData'], 1, 1000, null, true);
    num(['alerts', 'dedupeDays'], 0, 365, null, true); num(['alerts', 'groupMinStudents'], 2, 1000, null, true);
    A.RULES.forEach(function (r) {
      (r.paramsMeta || []).forEach(function (pm) {
        const p = ['alerts', 'rules', r.id, 'params', pm.key];
        if (pm.unit === '%' || pm.unit === 'điểm %') num(p, 0, 100);
        else if (pm.unit === 'điểm') num(p, 0, 10);
        else num(p, 0, 100000);
      });
    });
    return err;
  }

  /** Số liệu tác động của một cấu hình (dùng cho preview). */
  function impact(D, cfg) {
    const res = A.run(D, cfg);
    const c = A.countBySeverity(res.alerts);
    const g = M.loGreenShare(D, {}, cfg, D.meta.now);
    let cur = 0, cls = 0;
    D.courses.forEach(function (co) {
      const ca = M.causeAnalysis(D, co.id, cfg, D.meta.now);
      ca.curriculum.forEach(function (x) { if (x.label === 'CURRICULUM') cur++; });
      ca.classLabel.forEach(function (x) { if (x.label === 'CLASS') cls++; });
    });
    return { alerts: c, red: g.red, orange: g.orange, green: g.green, gray: g.gray, greenShare: g.share, cur: cur, cls: cls };
  }

  GT.page({
    id: 'settings',
    title: 'Cấu hình cấp trường',
    subtitle: 'Ngưỡng màu chuẩn đầu ra, ngưỡng khóa học, quy tắc cảnh báo, diễn giải nguyên nhân, hiển thị',
    filters: {},
    render: function (ctx, root) {
      const D = ctx.D;
      const saved = ctx.cfg;
      const draft = GT.config.deepClone(saved);
      delete draft.__version;
      D.courses.forEach(function (c) {
        const p = M.courseParams(D, c.id, saved);
        draft.courses[c.id] = { passThreshold: p.passThreshold, weightTaskCompletion: p.wTask, weightTestScore: p.wTest };
      });
      let dirty = false;
      const inputs = [];

      root.appendChild(el('div', { class: 'callout' }, [
        el('b', { text: 'Cấu hình cấp trường. ' }),
        'Áp dụng cho mọi báo cáo Học vụ (màu, nhãn diễn giải, cảnh báo). Trang cấu hình phía Giáo viên (khi có) chỉ hiển thị chỉ đọc các ngưỡng này. ',
        GT.config.hasOverrides() ? el('span', { class: 'badge fix', text: 'Đang dùng cấu hình đã chỉnh' }) : el('span', { class: 'badge hist', text: 'Đang dùng mặc định' }),
        el('div', { class: 'small muted', style: { marginTop: '4px' }, text: 'Câu hỏi mở: ai được quyền chỉnh cấu hình cấp trường (Q-01) — prototype chưa có phân quyền.' })
      ]));

      // ------------------------------------------------------------ Thanh thao tác + preview
      const status = el('span', { class: 'small muted', text: 'Chưa có thay đổi.' });
      const errBox = el('div', { class: 'err' });
      const previewBox = el('div');
      const btnPreview = el('button', { type: 'button', class: 'btn', onclick: function () { doPreview(); } }, 'Xem trước tác động');
      const btnSave = el('button', { type: 'button', class: 'btn primary', onclick: function () { doSave(); } }, 'Lưu cấu hình');
      const btnUndo = el('button', { type: 'button', class: 'btn', onclick: function () { GT.ui.rerender(); } }, 'Hủy thay đổi');
      const btnReset = el('button', {
        type: 'button', class: 'btn danger', onclick: function () {
          if (!window.confirm('Khôi phục toàn bộ cấu hình về mặc định?')) return;
          GT.config.reset(); GT.ui.rerender(); UI.toast('Đã khôi phục cấu hình mặc định.');
        }
      }, 'Khôi phục mặc định');
      const bar = UI.card({
        title: 'Lưu & xem trước', question: 'Xem trước: với ngưỡng mới, số cảnh báo và số chuẩn đầu ra Đỏ thay đổi thế nào?', plain: true, cls: 'no-print',
        body: el('div', {}, [el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' } }, [btnPreview, btnSave, btnUndo, btnReset, status]), errBox, previewBox])
      });
      bar.style.position = 'sticky'; bar.style.top = '8px'; bar.style.zIndex = '15';
      root.appendChild(bar);

      function markDirty() {
        dirty = true;
        const err = validate(draft, D);
        inputs.forEach(function (i) {
          const m = err[i.key];
          i.field.classList.toggle('invalid', !!m);
          i.errEl.textContent = m || '';
        });
        const n = Object.keys(err).length;
        errBox.textContent = n ? n + ' lỗi cần sửa trước khi lưu.' : '';
        btnSave.disabled = n > 0;
        status.textContent = n ? '' : 'Có thay đổi chưa lưu.';
        return err;
      }
      function doPreview() {
        const err = markDirty();
        if (Object.keys(err).length) { previewBox.innerHTML = ''; return; }
        const t0 = performance.now();
        const cur = impact(D, saved);
        const dcfg = GT.config.deepClone(draft);
        dcfg.__version = 'draft:' + JSON.stringify(draft).length + ':' + Date.now();
        const nxt = impact(D, dcfg);
        const rows = [
          ['Cảnh báo mức Cao', cur.alerts.HIGH, nxt.alerts.HIGH], ['Cảnh báo mức Trung bình', cur.alerts.MEDIUM, nxt.alerts.MEDIUM],
          ['Cảnh báo mức Thấp', cur.alerts.LOW, nxt.alerts.LOW], ['Tổng cảnh báo', cur.alerts.total, nxt.alerts.total],
          ['Cặp lớp–CĐR Đỏ', cur.red, nxt.red], ['Cặp lớp–CĐR Cam', cur.orange, nxt.orange], ['Cặp lớp–CĐR Xanh', cur.green, nxt.green],
          ['Nhãn "Nghi vấn chương trình"', cur.cur, nxt.cur], ['Nhãn "Nghi vấn ở lớp học"', cur.cls, nxt.cls]
        ];
        previewBox.innerHTML = '';
        previewBox.appendChild(el('div', { class: 'tbl-wrap', style: { marginTop: '10px', maxWidth: '640px' } }, [el('table', { class: 'tbl' }, [
          el('thead', {}, [el('tr', {}, [el('th', { text: 'Chỉ số' }), el('th', { class: 'r', text: 'Hiện tại' }), el('th', { class: 'r', text: 'Với ngưỡng mới' }), el('th', { class: 'r', text: 'Chênh lệch' })])]),
          el('tbody', {}, rows.map(function (r) {
            const d = r[2] - r[1];
            return el('tr', {}, [el('td', { text: r[0] }), el('td', { class: 'r', text: F.int(r[1]) }), el('td', { class: 'r' }, [el('b', { text: F.int(r[2]) })]),
              el('td', { class: 'r', style: { color: d ? (d > 0 ? 'var(--bad-text)' : 'var(--good-text)') : 'var(--ink-3)' }, text: d ? (d > 0 ? '+' : '−') + F.int(Math.abs(d)) : '±0' })]);
          }))
        ])]));
        previewBox.appendChild(el('div', { class: 'small muted', text: 'Tính lại toàn bộ trên dữ liệu hiện tại trong ' + F.int(performance.now() - t0) + ' ms. Chưa lưu — nhấn "Lưu cấu hình" để áp dụng cho mọi trang.' }));
      }
      function doSave() {
        const err = markDirty();
        if (Object.keys(err).length) return;
        if (!GT.config.save(draft)) { UI.toast('Không lưu được (trình duyệt chặn localStorage).'); return; }
        UI.toast('Đã lưu cấu hình. Mọi trang dùng ngưỡng mới.');
        GT.ui.rerender();
      }

      // ------------------------------------------------------------ Trình dựng field
      function numField(label, path, opts) {
        opts = opts || {};
        const key = path.join('.');
        const input = el('input', { type: 'number', step: opts.step || 'any', value: String(getPath(draft, path)), 'aria-label': label, style: opts.width ? { width: opts.width } : null });
        const errEl = el('div', { class: 'err' });
        const def = getPath(GT.config.DEFAULTS, path);
        const field = el('label', { class: 'field' }, [
          el('span', {}, [label, opts.unit ? el('span', { class: 'muted', text: ' (' + opts.unit + ')' }) : null]),
          input,
          el('span', { class: 'hint', text: (opts.hint ? opts.hint + ' · ' : '') + (def !== undefined ? 'Mặc định: ' + String(def).replace('.', ',') : '') }),
          errEl
        ]);
        input.addEventListener('input', function () {
          const v = input.value === '' ? NaN : Number(input.value);
          setPath(draft, path, v);
          markDirty();
        });
        inputs.push({ key: key, field: field, errEl: errEl });
        return field;
      }
      function section(title, question, fields, extra) {
        const g = el('div', { class: 'form-grid' }, fields);
        return UI.card({ title: title, question: question, plain: true, body: el('div', {}, [g].concat(extra || [])) });
      }

      // ------------------------------------------------------------ Chuẩn đầu ra
      const passSel = el('select', { 'aria-label': 'Mức đạt yêu cầu' }, ['EXCELLENT', 'GOOD', 'AVERAGE', 'NEEDS_IMPROVEMENT'].map(function (l) {
        return el('option', { value: l, text: M.LEVEL_META[l].label + ' trở lên', selected: draft.lo.passLevel === l ? true : null });
      }));
      passSel.addEventListener('change', function () { draft.lo.passLevel = passSel.value; markDirty(); });
      root.appendChild(section('Ngưỡng chuẩn đầu ra', 'Quy đổi % đạt → 5 cấp; học sinh "đạt yêu cầu"; màu Xanh/Cam/Đỏ của tỉ lệ đạt; ngưỡng "dữ liệu mỏng".', [
        numField('Rất tốt từ', ['lo', 'levels', 'excellent'], { unit: '%' }),
        numField('Tốt từ', ['lo', 'levels', 'good'], { unit: '%' }),
        numField('Trung bình từ', ['lo', 'levels', 'average'], { unit: '%' }),
        numField('Cần cải thiện từ', ['lo', 'levels', 'needsImprovement'], { unit: '%', hint: 'Dưới mức này: Chưa tốt' }),
        el('label', { class: 'field' }, ['Đạt yêu cầu khi cấp', passSel, el('span', { class: 'hint', text: 'Mặc định: Trung bình trở lên' })]),
        numField('Xanh khi tỉ lệ đạt ≥', ['lo', 'color', 'green'], { unit: '%' }),
        numField('Cam khi tỉ lệ đạt ≥', ['lo', 'color', 'orange'], { unit: '%', hint: 'Dưới mức này: Đỏ; coverage = 0: Xám' }),
        numField('"Dữ liệu mỏng" khi coverage <', ['lo', 'thinCoverage'], { unit: '%' })
      ], [el('div', { style: { marginTop: '10px' } }, [UI.levelLegend()])]));

      // ------------------------------------------------------------ Diễn giải nguyên nhân
      root.appendChild(section('Diễn giải nguyên nhân (mục 3.6)', 'Khi nào gắn nhãn "Nghi vấn chương trình" và "Nghi vấn ở lớp học"?', [
        numField('Nghi vấn chương trình: Đỏ ở ≥', ['cause', 'curriculumRedShare'], { unit: '% số lớp đủ dữ liệu' }),
        numField('Số lớp đủ dữ liệu tối thiểu', ['cause', 'minClassesForCurriculum'], { unit: 'lớp', step: 1 }),
        numField('Nghi vấn ở lớp học: thấp hơn trung vị lớp khác ≥', ['cause', 'classGapPts'], { unit: 'điểm %' }),
        numField('Số lớp khác tối thiểu', ['cause', 'minOtherClasses'], { unit: 'lớp', step: 1 }),
        numField('Không gắn nhãn khi học sinh có dữ liệu <', ['cause', 'minStudentsWithData'], { unit: 'học sinh', step: 1 }),
        numField('… hoặc evidence TB <', ['cause', 'minAvgEvidence'], { unit: 'câu/học sinh' })
      ], [el('p', { class: 'small muted', text: 'Trung vị lớp khác phải ≥ ngưỡng Cam. Nhãn không bao giờ gắn trực tiếp lên giáo viên.' })]));

      // ------------------------------------------------------------ Khóa học
      const courseRows = D.courses.map(function (c) {
        return el('div', { class: 'form-grid', style: { borderTop: '1px solid var(--line-2)', paddingTop: '8px', marginTop: '8px', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))' } }, [
          el('div', { class: 'field' }, [el('b', { text: c.name }), el('span', { class: 'hint', text: 'Điểm tổng hợp = w₁ × tỉ lệ hoàn thành bài tập + w₂ × điểm kiểm tra' })]),
          numField('Ngưỡng hoàn thành', ['courses', c.id, 'passThreshold'], { unit: 'điểm /100' }),
          numField('w₁ — Tỉ lệ hoàn thành bài tập', ['courses', c.id, 'weightTaskCompletion'], { step: 0.05 }),
          numField('w₂ — Điểm kiểm tra', ['courses', c.id, 'weightTestScore'], { step: 0.05 })
        ]);
      });
      root.appendChild(UI.card({ title: 'Ngưỡng khóa học (khóa trực tuyến)', question: 'Trọng số điểm tổng hợp và ngưỡng hoàn thành của từng khóa.', plain: true, body: el('div', {}, courseRows) }));

      // ------------------------------------------------------------ Vận hành & khác
      root.appendChild(section('Vận hành, học ở nhà, xếp hạng', 'Các ngưỡng dùng chung cho chỉ số vận hành và bảng xếp hạng.', [
        numField('Điểm danh đúng thời điểm: trong', ['ops', 'attendanceGraceMin'], { unit: 'phút đầu buổi', step: 1 }),
        numField('Báo cáo đúng hạn: trong', ['ops', 'reportOnTimeHours'], { unit: 'giờ sau buổi' }),
        numField('Đúng tiến độ: dung sai', ['online', 'onTrackTolerancePts'], { unit: 'điểm %' }),
        numField('Funnel "Đang học" khi đạt', ['online', 'activeLearningPct'], { unit: '% nội dung' }),
        numField('Nhiệm vụ bất thường: tỉ lệ nộp thấp hơn', ['homework', 'anomalyRateGapPts'], { unit: 'điểm %' }),
        numField('… hoặc điểm TB thấp hơn', ['homework', 'anomalyScoreGap'], { unit: 'điểm', step: 0.1 }),
        numField('Xếp hạng: mẫu số tối thiểu', ['ranking', 'minSample'], { unit: 'lượt', step: 1 })
      ]));

      // ------------------------------------------------------------ Cảnh báo — chung
      root.appendChild(section('Cảnh báo — quy tắc chung', 'Cỡ mẫu tối thiểu, chống trùng và gộp cảnh báo.', [
        numField('Mẫu số tối thiểu (rule tỉ lệ cấp lớp)', ['alerts', 'minDenominator'], { unit: 'bản ghi', step: 1 }),
        numField('Học sinh có dữ liệu tối thiểu', ['alerts', 'minStudentsWithData'], { unit: 'học sinh', step: 1 }),
        numField('Chống trùng trong', ['alerts', 'dedupeDays'], { unit: 'ngày', step: 1 }),
        numField('Gộp thành cảnh báo cấp lớp khi ≥', ['alerts', 'groupMinStudents'], { unit: 'học sinh', step: 1 })
      ]));

      // ------------------------------------------------------------ Cảnh báo — từng rule
      const stats = A.run(D, saved).stats;
      const tb = el('tbody');
      A.RULES.forEach(function (r) {
        const rc = draft.alerts.rules[r.id];
        const cb = el('input', { type: 'checkbox', checked: rc.enabled !== false ? true : null, 'aria-label': 'Bật ' + r.id });
        cb.addEventListener('change', function () { rc.enabled = cb.checked; markDirty(); });
        const sev = el('select', { 'aria-label': 'Mức ' + r.id }, A.SEVERITY_ORDER.map(function (s) { return el('option', { value: s, text: A.SEVERITY[s].label, selected: rc.severity === s ? true : null }); }));
        sev.addEventListener('change', function () { rc.severity = sev.value; markDirty(); });
        const params = el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, (r.paramsMeta || []).map(function (pm) {
          return numField(pm.label, ['alerts', 'rules', r.id, 'params', pm.key], { unit: pm.unit, width: '84px' });
        }));
        tb.appendChild(el('tr', {}, [
          el('td', { class: 'c' }, [cb]),
          el('td', { class: 'nowrap' }, [el('b', { text: r.id }), el('div', { class: 'muted small', text: A.GROUPS[r.group] })]),
          el('td', { style: { minWidth: '220px' }, text: r.name }),
          el('td', {}, [sev]),
          el('td', {}, [params.childNodes.length ? params : el('span', { class: 'muted small', text: 'Dùng ngưỡng mục 3.6 / màu CĐR' })]),
          el('td', { class: 'r' }, [el('a', { href: 'alerts.html' + GT.qs.build({ ruleId: r.id }), text: F.int(stats[r.id] ? stats[r.id].count : 0) })])
        ]));
      });
      root.appendChild(UI.card({
        title: 'Cảnh báo — bật/tắt và tham số từng quy tắc', question: 'Quy tắc nào đang bật, ở mức nào, với tham số nào?', plain: true,
        body: el('div', { class: 'tbl-wrap' }, [el('table', { class: 'tbl' }, [
          el('thead', {}, [el('tr', {}, ['Bật', 'Mã', 'Quy tắc', 'Mức', 'Tham số', 'Số cảnh báo hiện tại'].map(function (h, i) { return el('th', { class: i === 5 ? 'r' : null, text: h }); }))]),
          tb
        ])]),
        note: 'Chi tiết điều kiện, cửa sổ thời gian và cỡ mẫu của từng quy tắc: docs/ALERTS.md.'
      }));

      // ------------------------------------------------------------ Hiển thị
      const tcb = el('input', { type: 'checkbox', checked: draft.display.showTeacherReport ? true : null });
      tcb.addEventListener('change', function () { draft.display.showTeacherReport = tcb.checked; markDirty(); });
      root.appendChild(UI.card({
        title: 'Hiển thị', question: 'Trường có cho phép xem báo cáo theo giáo viên không?', plain: true,
        body: el('div', {}, [
          el('label', { class: 'f', style: { gap: '8px', fontSize: '14px' } }, [tcb, 'Hiển thị báo cáo vận hành theo giáo viên (teachers.html) và bộ lọc giáo viên']),
          el('p', { class: 'small muted', text: 'Mỗi trường có chính sách khác nhau về việc theo dõi giáo viên, nên đây là lựa chọn của trường (mặc định BẬT trong prototype). Báo cáo chỉ đo hành vi vận hành, không xếp hạng giáo viên theo kết quả học tập.' }),
          el('p', { class: 'small muted', text: 'Ẩn/hiện các hạng mục "Đề xuất" là tùy chọn của từng người xem, đặt ở trang chủ (index.html).' })
        ])
      }));
    }
  });
})(window.GT);
