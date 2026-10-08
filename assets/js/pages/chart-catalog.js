/**
 * hoc-vu/chart-catalog.html — 9. Danh mục biểu đồ.
 * Mỗi biểu đồ là một thẻ: bản render thu nhỏ (dùng chung charts.js), tên, trang/tab, loại, nguồn dữ liệu,
 * công thức (METRICS.md), câu hỏi nghiệp vụ, hành động, lý do chọn loại biểu đồ, nhãn. Lọc theo trang và nhãn.
 */
(function (GT) {
  'use strict';
  const UI = GT.ui, CAT = GT.catalog;
  const el = UI.el, esc = UI.esc;

  GT.page({
    id: 'chart-catalog',
    title: 'Danh mục biểu đồ',
    subtitle: 'Tài liệu mô tả từng biểu đồ cho đội dev và review nghiệp vụ',
    filters: {
      extra: function (box, ctx) {
        box.appendChild(UI.select('Trang', Object.keys(CAT.PAGES).map(function (p) { return { value: p, label: CAT.PAGES[p] }; }), ctx.q.page || null, function (v) { ctx.set({ page: v }); }, 'Tất cả trang'));
        box.appendChild(UI.select('Nhãn', Object.keys(CAT.TAGS).map(function (t) { return { value: t, label: CAT.TAGS[t] }; }), ctx.q.tag || null, function (v) { ctx.set({ tag: v }); }, 'Tất cả nhãn'));
        const s = el('input', { type: 'search', placeholder: 'Tìm theo tên, câu hỏi, mã…', value: ctx.q.s || '', 'aria-label': 'Tìm biểu đồ' });
        s.addEventListener('change', function () { ctx.set({ s: s.value || null }); });
        box.appendChild(s);
      }
    },
    render: function (ctx, root) {
      const q = ctx.q;
      const list = CAT.LIST.filter(function (x) {
        if (q.page && x.page !== q.page) return false;
        if (q.tag && x.tags.indexOf(q.tag) < 0) return false;
        if (q.s) { const n = q.s.toLowerCase(); if ((x.id + ' ' + x.name + ' ' + x.question + ' ' + x.type).toLowerCase().indexOf(n) < 0) return false; }
        return true;
      });
      const counts = {};
      Object.keys(CAT.TAGS).forEach(function (t) { counts[t] = CAT.LIST.filter(function (x) { return x.tags.indexOf(t) >= 0; }).length; });
      root.appendChild(el('div', { class: 'callout' }, [
        el('b', { text: CAT.LIST.length + ' biểu đồ / bảng. ' }),
        Object.keys(CAT.TAGS).map(function (t) { return CAT.TAGS[t] + ': ' + counts[t]; }).join(' · ') + '. ',
        'Bản thu nhỏ dùng đúng builder trong charts.js với dữ liệu thật. Công thức chi tiết: ',
        el('a', { href: '../docs/METRICS.md', text: 'docs/METRICS.md' }), '. Ẩn/hiện hạng mục Đề xuất ở trang chủ.'
      ]));
      const grid = el('div', { class: 'cards', style: { gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))' } });
      root.appendChild(grid);
      if (!list.length) grid.appendChild(UI.empty('Không có biểu đồ khớp bộ lọc', ''));
      list.forEach(function (x) {
        const tagBadges = x.tags.map(function (t) { return el('span', { class: 'badge ' + (t === 'DX' ? 'proposal' : t === 'FIX' ? 'fix' : t === 'SG' ? 'hist' : 'qdata'), text: CAT.TAGS[t] }); });
        const thumb = el('div', { style: { border: '1px solid var(--line-2)', borderRadius: '8px', padding: '4px', background: '#FCFBFE', minHeight: '160px' } });
        if (x.thumb && CAT.THUMBS[x.thumb]) {
          const c = el('div', { class: 'chart' });
          thumb.appendChild(c);
          GT.charts.mount(c, function () { return CAT.THUMBS[x.thumb](); }, { height: 190 });
        } else {
          thumb.appendChild(el('div', { class: 'empty', style: { minHeight: '150px' } }, [el('div', {}, [el('b', { text: x.thumb === 'kpi' ? 'Ô chỉ số (stat tile)' : x.thumb === 'table' ? 'Bảng dữ liệu' : 'Thẻ / thành phần HTML' }), x.type])]));
        }
        const pageHref = ctx.href(x.page + '.html', x.tab ? { tab: x.tab } : {});
        const metrics = x.metrics.length ? x.metrics.map(function (m) { return '<a href="../docs/METRICS.md#' + esc(m.split(' ')[0]) + '"><code>' + esc(m) + '</code></a>'; }).join(' ') : '<span class="muted">—</span>';
        const dl = function (k, v) { return '<div style="display:grid;grid-template-columns:110px 1fr;gap:6px;font-size:12.5px;padding:3px 0;border-top:1px solid var(--line-2)"><span class="muted">' + k + '</span><span>' + v + '</span></div>'; };
        const card = el('article', { class: 'card', 'data-proposal': x.tags.length === 1 && x.tags[0] === 'DX' ? '' : null, style: { gap: '6px' } }, [
          el('div', { class: 'card-head' }, [el('h3', {}, [el('code', { style: { color: 'var(--ink-3)', fontWeight: 500, marginRight: '6px' }, text: x.id }), x.name])].concat(tagBadges)),
          thumb,
          el('div', { html:
            dl('Trang / tab', '<a href="' + esc(pageHref) + '">' + esc(CAT.PAGES[x.page]) + (x.tab ? ' · tab ' + esc(x.tab) : '') + '</a>') +
            dl('Loại', esc(x.type)) +
            dl('Nguồn dữ liệu', esc(x.source)) +
            dl('Công thức', metrics) +
            dl('Câu hỏi', '<b>' + esc(x.question) + '</b>') +
            dl('Hành động', esc(x.action)) +
            dl('Vì sao loại này', esc(x.why))
          })
        ]);
        grid.appendChild(card);
      });
    }
  });
})(window.GT);
