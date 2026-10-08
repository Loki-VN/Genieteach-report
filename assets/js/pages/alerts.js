/**
 * hoc-vu/alerts.html — [ĐỀ XUẤT] 4.9 Trung tâm cảnh báo.
 * Hàng đợi xử lý: lọc theo mức, nhóm, nhóm lớp, lớp, trạng thái; sort mức → thời gian;
 * đổi trạng thái / ghi chú / người xử lý (localStorage); cảnh báo gộp cấp lớp mở rộng được.
 */
(function (GT) {
  'use strict';
  const A = GT.alerts, UI = GT.ui, F = GT.fmt, DT = GT.date;
  const el = UI.el, esc = UI.esc;

  function entityLabel(ctx, a) {
    const D = ctx.D;
    switch (a.scope) {
      case 'STUDENT': return ctx.studentLabel(a.studentId) + (a.classId ? ' · lớp ' + ctx.className(a.classId) : '');
      case 'CLASS': return 'Lớp ' + ctx.className(a.classId) + (a.courseId ? ' · ' + ctx.courseName(a.courseId) : '');
      case 'GROUP': return ctx.groupName(a.groupId);
      case 'TEACHER': return 'GV ' + ctx.teacherName(a.teacherId);
      case 'SESSION': { const s = D.sessionById.get(a.sessionId); return 'Buổi ' + ctx.className(s.classId) + ' · ' + DT.fmtTime(s.start) + ' ' + DT.fmtDate(s.start); }
      case 'TASK': { const t = D.taskById.get(a.taskId); return 'Nhiệm vụ lớp ' + ctx.className(t.classId) + ' · hạn ' + DT.fmtDate(t.dueAt); }
      case 'LO': {
        const lo = D.loById.get(a.loId);
        return (a.questionId ? D.questionById.get(a.questionId).code + ' · ' : '') + (lo ? lo.code + ' ' + lo.name : '') + (a.classId ? ' · lớp ' + ctx.className(a.classId) : ' · toàn khóa');
      }
      default: return a.entityIds.join(', ');
    }
  }

  GT.page({
    id: 'alerts',
    title: 'Trung tâm cảnh báo',
    subtitle: 'Hàng đợi xử lý cảnh báo bất thường toàn trường · đánh giá tại thời điểm hiện tại',
    filters: {
      group: true, class: true,
      extra: function (box, ctx) {
        const q = ctx.q;
        box.appendChild(UI.select('Mức', A.SEVERITY_ORDER.map(function (s) { return { value: s, label: A.SEVERITY[s].label }; }), q.severity || null, function (v) { ctx.set({ severity: v }); }, 'Tất cả mức'));
        box.appendChild(UI.select('Nhóm cảnh báo', Object.keys(A.GROUPS).map(function (g) { return { value: g, label: A.GROUPS[g] + ' (' + g + ')' }; })
          .concat(A.DISPLAY_GROUPS.map(function (g) { return { value: 'D:' + g.id, label: '[Tổng quan] ' + g.label }; })),
        q.displayGroup ? 'D:' + q.displayGroup : (q.alertGroup || null), function (v) {
          if (v && v.indexOf('D:') === 0) ctx.set({ displayGroup: v.slice(2), alertGroup: null }); else ctx.set({ alertGroup: v, displayGroup: null });
        }, 'Tất cả nhóm'));
        box.appendChild(UI.select('Trạng thái', [{ value: 'OPEN', label: 'Đang mở (Mới + Đang xử lý)' }].concat(Object.keys(A.STATUS).map(function (s) { return { value: s, label: A.STATUS[s] }; })),
          q.status || 'OPEN', function (v) { ctx.set({ status: v || 'ALL' }); }, 'Tất cả trạng thái'));
        const sInput = el('input', { type: 'search', placeholder: 'Tìm học sinh, lớp, nội dung…', value: q.q || '', 'aria-label': 'Tìm kiếm' });
        sInput.addEventListener('change', function () { ctx.set({ q: sInput.value || null }); });
        box.appendChild(sInput);
        if (q.ruleId) box.appendChild(el('span', { class: 'badge fix' }, ['Quy tắc ' + q.ruleId + ' ', el('a', { href: '#', onclick: function (e) { e.preventDefault(); ctx.set({ ruleId: null }); }, text: '✕' })]));
      }
    },
    render: function (ctx, root) {
      const D = ctx.D, q = ctx.q, now = ctx.now;
      const all = ctx.alerts();
      const status = q.status === 'ALL' ? null : (q.status || 'OPEN');
      const f = {
        severity: q.severity || null,
        groups: q.alertGroup ? [q.alertGroup] : null,
        displayGroup: q.displayGroup || null,
        groupId: ctx.groupId,
        classIds: ctx.classId ? [ctx.classId] : null,
        ruleIds: q.ruleId ? [q.ruleId] : null,
        statuses: status && status !== 'OPEN' ? [status] : null,
        open: status === 'OPEN'
      };
      let list = A.filter(all, f);
      if (q.q) {
        const needle = q.q.toLowerCase();
        list = list.filter(function (a) {
          return (a.title + ' ' + a.reason + ' ' + entityLabel(ctx, a) + ' ' + (a.children ? a.children.map(function (c) { return c.reason; }).join(' ') : '')).toLowerCase().indexOf(needle) >= 0;
        });
      }
      const open = A.filter(all, { open: true });
      const cOpen = A.countBySeverity(open);
      const byStatus = {};
      Object.keys(A.STATUS).forEach(function (s) { byStatus[s] = all.filter(function (a) { return a.status === s; }).length; });
      root.appendChild(UI.kpis([
        { label: 'Đang mở — mức Cao', value: F.int(cOpen.HIGH), sub: 'Cần xử lý trước', href: GT.nav.href('alerts.html', { severity: 'HIGH' }) },
        { label: 'Đang mở — mức Trung bình', value: F.int(cOpen.MEDIUM), href: GT.nav.href('alerts.html', { severity: 'MEDIUM' }) },
        { label: 'Đang mở — mức Thấp', value: F.int(cOpen.LOW), href: GT.nav.href('alerts.html', { severity: 'LOW' }) },
        { label: 'Mới / Đang xử lý', value: F.int(byStatus.NEW) + ' / ' + F.int(byStatus.IN_PROGRESS), sub: 'Đã xử lý ' + F.int(byStatus.RESOLVED) + ' · Bỏ qua ' + F.int(byStatus.IGNORED) }
      ]));

      const expanded = new Set();
      const handlerDefault = 'Học vụ (demo)';
      const save = function (a, patch) {
        A.store.set(a, patch, now);
        Object.assign(a, patch);
        UI.toast('Đã lưu trạng thái cảnh báo.');
      };
      list.sort(function (a, b) { return A.SEVERITY[a.severity].order - A.SEVERITY[b.severity].order || b.detectedAt - a.detectedAt; });
      const buildTable = function () { return UI.table({
        columns: [
          { key: 'sev', label: 'Mức', value: function (a) { return A.SEVERITY[a.severity].order; }, fmt: function (a) { return '<span class="sev ' + a.severity + '">' + A.SEVERITY[a.severity].icon + ' ' + A.SEVERITY[a.severity].label + '</span>'; }, csv: function (a) { return A.SEVERITY[a.severity].label; } },
          { key: 'group', label: 'Nhóm', value: function (a) { return A.GROUPS[a.group]; }, fmt: function (a) { return esc(A.GROUPS[a.group]) + '<div class="muted small">' + a.ruleId + '</div>'; } },
          {
            key: 'entity', label: 'Đối tượng', minWidth: '170px', value: function (a) { return entityLabel(ctx, a); },
            fmt: function (a) {
              return '<span class="muted small">' + esc(A.SCOPE_LABEL[a.scope]) + '</span><div>' + esc(entityLabel(ctx, a)) + '</div>' +
                (a.children ? '<button type="button" class="btn sm" data-exp="' + esc(a.key) + '">' + (expanded.has(a.key) ? '▾' : '▸') + ' ' + a.children.length + ' học sinh</button>' : '');
            }
          },
          {
            key: 'reason', label: 'Lý do', minWidth: '380px', value: function (a) { return a.title; }, csv: function (a) { return a.title + ' — ' + a.reason; },
            fmt: function (a) {
              let h = '<b>' + esc(a.title) + '</b><div class="small" style="color:var(--ink-2);max-width:520px">' + esc(a.reason) + '</div>' +
                '<div class="small muted">Gợi ý: ' + esc(a.suggestedAction) + '</div>';
              if (a.children && expanded.has(a.key)) {
                h += '<ul class="small" style="margin:6px 0 0;padding-left:18px;max-height:220px;overflow:auto">' + a.children.map(function (c) {
                  return '<li><a href="' + esc(GT.nav.carry(c.drilldownUrl)) + '">' + esc(c.studentId ? ctx.studentLabel(c.studentId) : entityLabel(ctx, c)) + '</a> — ' + esc(c.reason) + '</li>';
                }).join('') + '</ul>';
              }
              return h;
            }
          },
          { key: 'detected', label: 'Phát hiện lúc', value: function (a) { return a.detectedAt; }, fmt: function (a) { return DT.fmtTime(a.detectedAt) + '<div class="muted small">' + DT.fmtDate(a.detectedAt) + '</div>'; }, csv: function (a) { return DT.fmtDateTime(a.detectedAt); } },
          {
            key: 'status', label: 'Trạng thái', value: function (a) { return Object.keys(A.STATUS).indexOf(a.status); }, csv: function (a) { return A.STATUS[a.status]; },
            fmt: function (a) {
              return '<select data-st="' + esc(a.key) + '" aria-label="Trạng thái">' + Object.keys(A.STATUS).map(function (s) { return '<option value="' + s + '"' + (a.status === s ? ' selected' : '') + '>' + A.STATUS[s] + '</option>'; }).join('') + '</select>' +
                (a.merged ? '<div class="muted small" title="Cùng quy tắc và đối tượng, cảnh báo cũ chưa xử lý trong ' + ctx.cfg.alerts.dedupeDays + ' ngày → không sinh mới">đã gộp với lần trước</div>' : '');
            }
          },
          {
            key: 'note', label: 'Ghi chú xử lý · người xử lý', sort: false, csv: function (a) { return (a.note || '') + (a.handler ? ' (' + a.handler + ')' : ''); },
            fmt: function (a) {
              return '<textarea data-note="' + esc(a.key) + '" rows="2" placeholder="Ghi chú…" style="min-width:180px">' + esc(a.note || '') + '</textarea>' +
                '<input type="text" data-handler="' + esc(a.key) + '" value="' + esc(a.handler || '') + '" placeholder="' + handlerDefault + '" style="width:100%;margin-top:4px" aria-label="Người xử lý">' +
                (a.updatedAt ? '<div class="muted small">Cập nhật ' + esc(new Date(a.updatedAt).toLocaleString('vi-VN')) + '</div>' : '');
            }
          },
          { key: 'go', label: '', sort: false, csv: false, fmt: function (a) { return '<a class="btn sm" href="' + esc(GT.nav.carry(a.drilldownUrl)) + '">Chi tiết →</a>'; } }
        ],
        rows: list, sort: { key: 'sev', dir: 1 }, capped: true, maxHeight: '75vh', csv: 'canh-bao.csv', empty: 'Không có cảnh báo nào khớp bộ lọc.',
        footNote: 'Sắp xếp mặc định: mức (Cao → Thấp) rồi thời điểm phát hiện mới nhất'
      }); };
      const tbl = buildTable();
      const card = UI.card({
        title: 'Hàng đợi cảnh báo (' + F.int(list.length) + ')', question: 'Cảnh báo nào cần xử lý trước, đã có ai nhận xử lý chưa?', plain: true,
        body: tbl,
        note: 'Trạng thái, ghi chú và người xử lý được lưu trong trình duyệt này (localStorage). Gộp: ≥ ' + ctx.cfg.alerts.groupMinStudents + ' học sinh cùng lớp vi phạm cùng quy tắc → 1 dòng cấp lớp, nhấn "▸ học sinh" để mở danh sách. ' +
          'Chống trùng: cùng quy tắc và đối tượng, cảnh báo cũ chưa xử lý trong ' + ctx.cfg.alerts.dedupeDays + ' ngày thì không sinh cảnh báo mới.',
        tools: [el('button', { type: 'button', class: 'btn sm danger', onclick: function () { if (window.confirm('Xóa toàn bộ trạng thái/ghi chú xử lý đã lưu?')) { A.store.clear(); GT.ui.rerender(); } } }, 'Xóa trạng thái đã lưu')]
      });
      root.appendChild(card);

      const findAlert = function (key) { for (let i = 0; i < list.length; i++) if (list[i].key === key) return list[i]; return null; };
      card.addEventListener('change', function (e) {
        const t = e.target;
        if (t.matches('select[data-st]')) { const a = findAlert(t.getAttribute('data-st')); if (a) save(a, { status: t.value, handler: a.handler || handlerDefault }); }
        else if (t.matches('textarea[data-note]')) { const a = findAlert(t.getAttribute('data-note')); if (a) save(a, { note: t.value, handler: a.handler || handlerDefault }); }
        else if (t.matches('input[data-handler]')) { const a = findAlert(t.getAttribute('data-handler')); if (a) save(a, { handler: t.value }); }
      });
      card.addEventListener('click', function (e) {
        const b = e.target.closest('button[data-exp]');
        if (!b) return;
        const k = b.getAttribute('data-exp');
        if (expanded.has(k)) expanded.delete(k); else expanded.add(k);
        const old = card.querySelector('.tbl-block');
        const top = old.querySelector('.tbl-wrap').scrollTop;
        const fresh = buildTable();
        old.parentNode.replaceChild(fresh, old);
        fresh.querySelector('.tbl-wrap').scrollTop = top;
      });
    }
  });
})(window.GT);
