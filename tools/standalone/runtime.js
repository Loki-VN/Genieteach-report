/**
 * Runtime của bản đóng gói một file (dist/GenieTeach-HocVu.html), do tools/build-standalone.js chèn vào.
 * - Mọi trang nằm trong cùng một file; trang đang xem chọn bằng ?p=<id> (mặc định: trang chủ).
 * - Link của bản nhiều file ("class.html?…", "hoc-vu/overview.html", "../docs/METRICS.md#M-ATT-01")
 *   được đổi sang link nội bộ ("?p=class&…", "?p=overview", "?p=doc&f=METRICS#M-ATT-01").
 * Nạp SAU ui.js (cần GT.qs, GT.nav) và TRƯỚC các module trang (GT.__pages).
 * GT.bundle.meta do build gán: { pages: {id: {title, css?, body?, noBase?}}, docs: {name: {title, html}}, docOrder, docCss, builtAt }.
 */
(function (GT) {
  'use strict';
  const B = GT.bundle;
  const PASS = /^(?:[a-z][a-z0-9+.-]*:|#|\?|\/\/)/i;   // http:, blob:, mailto:, #hash, ?query → giữ nguyên

  /** Đổi link của bản nhiều file sang link nội bộ của bản một file. Link không nhận ra → giữ nguyên. */
  B.map = function (href) {
    if (href === null || href === undefined) return href;
    href = String(href);
    if (!href || PASS.test(href)) return href;
    const m = /^([^?#]*)(\?[^#]*)?(#.*)?$/.exec(href);
    const path = m[1].replace(/^(?:\.\.?\/)+/, '').replace(/^(?:hoc-vu|docs)\//, '');
    const f = /^([A-Za-z0-9_-]+)\.(html|md)$/.exec(path);
    if (!f) return href;
    let head;
    if (f[2] === 'md') {
      if (!B.meta.docs[f[1]]) return href;
      head = { p: 'doc', f: f[1] };
    } else {
      if (!B.meta.pages[f[1]]) return href;
      head = { p: f[1] };
    }
    return GT.qs.build(Object.assign(head, GT.qs.parse(m[2] || ''))) + (m[3] || '');
  };

  // Link dựng bằng GT.nav.href / ctx.href (kể cả window.location.href = ctx.href(…)) → đổi ngay tại nguồn.
  if (GT.nav && GT.nav.href) {
    const orig = GT.nav.href;
    GT.nav.href = function (page, patch) { return B.map(orig(page, patch)); };
  }

  // Link viết cứng trong HTML/innerHTML → đổi khi phần tử được gắn vào trang hoặc đổi href.
  function fix(a) {
    if (!a || a.tagName !== 'A') return;
    const h = a.getAttribute('href');
    const n = B.map(h);
    if (n !== h) a.setAttribute('href', n);
  }
  function scan(node) {
    if (!node || node.nodeType !== 1) return;
    fix(node);
    if (node.querySelectorAll) node.querySelectorAll('a[href]').forEach(fix);
  }
  B.scan = scan;
  new MutationObserver(function (records) {
    records.forEach(function (r) {
      if (r.type === 'attributes') fix(r.target);
      else r.addedNodes.forEach(scan);
    });
  }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['href'] });
  document.addEventListener('click', function (e) { if (e.target && e.target.closest) fix(e.target.closest('a[href]')); }, true);

  function addStyle(css) {
    if (!css) return;
    const s = document.createElement('style');
    s.textContent = css;
    document.head.appendChild(s);
  }
  function esc(s) { return GT.util.escapeHtml(String(s)); }
  function scrollToHash() {
    const h = decodeURIComponent((window.location.hash || '').slice(1));
    const t = h && document.getElementById(h);
    if (t) t.scrollIntoView();
  }

  // ------------------------------------------------------------------ Trang tài liệu (?p=doc&f=…)
  function renderDoc(name) {
    const docs = B.meta.docs;
    if (!docs[name]) name = B.meta.docOrder[0];
    const d = docs[name];
    document.title = d.title + ' · GenieTeach Học vụ';
    addStyle(B.meta.docCss);
    const tabs = B.meta.docOrder.map(function (k) {
      return '<a href="?p=doc&amp;f=' + encodeURIComponent(k) + '"' + (k === name ? ' class="on" aria-current="page"' : '') + '>' + esc(docs[k].title) + '</a>';
    }).join('');
    document.body.insertAdjacentHTML('afterbegin',
      '<header class="doc-top"><div class="doc-wrap"><a class="doc-home" href="?p=index">← Trang chủ</a><nav class="doc-tabs" aria-label="Tài liệu">' + tabs + '</nav></div></header>' +
      '<main class="doc-wrap"><article class="doc">' + d.html + '</article>' +
      '<p class="doc-foot">Tài liệu nhúng trong bản đóng gói, dựng lúc ' + esc(B.meta.builtAt) + '. Bản gốc: <code>' + esc(d.path) + '</code> trong repo.</p></main>');
    scrollToHash();
  }

  function notFound(id) {
    document.title = 'Không tìm thấy trang · GenieTeach Học vụ';
    document.body.insertAdjacentHTML('afterbegin', '<div class="content" style="max-width:720px;margin:40px auto"><div class="callout warn"><b>Không có trang "' + esc(id) + '" trong bản đóng gói.</b> <a href="?p=index">Về trang chủ</a></div></div>');
  }

  /** Chạy trang theo ?p=. Gọi ở cuối file, sau khi mọi module trang đã đăng ký vào GT.__pages. */
  B.boot = function () {
    const q = GT.qs.parse();
    const id = q.p || 'index';
    if (id === 'doc') { renderDoc(q.f); return; }
    const page = B.meta.pages[id];
    if (!page || !GT.__pages[id]) { notFound(id); return; }
    document.title = page.title;
    if (page.noBase) { const base = document.getElementById('gt-base-css'); if (base && base.sheet) base.sheet.disabled = true; }
    addStyle(page.css);
    if (page.body) document.body.insertAdjacentHTML('afterbegin', page.body);
    document.querySelectorAll('.only-multi').forEach(function (e) { e.remove(); });   // mục chỉ có nghĩa ở bản nhiều file
    GT.__pages[id]();
    const meta = id === 'index' && document.getElementById('meta');
    if (meta) meta.insertAdjacentHTML('beforeend', '<span title="Một file HTML, chạy offline, không cần Internet">Bản một file · dựng ' + esc(B.meta.builtAt) + '</span>');
    scan(document.body);
    if (window.location.hash) window.addEventListener('load', scrollToHash);
  };
})(window.GT);
