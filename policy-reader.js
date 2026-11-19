/* Achievers dashboard — incentive policy reader (view only).
 * Adds a "Policies" button beside "Change password". The server decides which policies the logged-in person
 * may see (from their session role); this file only shows them. Pages are drawn as images with pdf.js:
 * no download, print or text-copy controls, and each page carries a faint watermark with the viewer's email.
 * Index.html is not changed: this file is added to the page by scripts/build-web.mjs. */
(function () {
  'use strict';
  var API = window.ACHIEVERS_API_URL, V = window.ACHIEVERS_VERSION || '';
  var state = { open: false, items: [], month: '', level: '', zoom: 1, doc: null, docs: {}, tok: null, renderId: 0, watch: null };
  var LEVEL_NAME = { L4: 'L4', L3: 'L3', L2: 'L2', L1: 'L1', L0: 'L0' };

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function token() { return window.S && window.S.t || null; }
  function who() { var u = window.S && window.S.user || {}; return { name: u.name || '', email: u.email || '' }; }

  /* ---------------- styles (the dashboard's own colour variables, so light and dark both match) ---------------- */
  var css = '' +
    '.pr-bg{position:fixed;inset:0;z-index:70;background:var(--overlay);display:flex;align-items:stretch;justify-content:center;padding:18px}' +
    '.pr-panel{display:flex;flex-direction:column;width:min(1100px,100%);background:var(--panel2);border:1px solid var(--line);border-radius:16px;box-shadow:0 18px 50px var(--shadow-lg);overflow:hidden;color:var(--text);font-family:var(--font)}' +
    '.pr-head{display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;padding:14px 16px;border-bottom:1px solid var(--line2);background:var(--panel)}' +
    '.pr-title{font-weight:800;font-size:16px;color:var(--head);margin-right:auto;display:flex;align-items:center;gap:8px}' +
    '.pr-title small{font-weight:600;font-size:12px;color:var(--muted)}' +
    '.pr-head select{width:auto;min-width:150px;max-width:220px;flex:0 0 auto;border:1px solid var(--in-bd);background:var(--in-bg);color:var(--text);border-radius:10px;padding:7px 10px;font:inherit;font-size:13px}' +
    '.pr-tabs{display:flex;flex-wrap:wrap;gap:6px}' +
    '.pr-tab{border:1px solid var(--line);background:var(--ghost);color:var(--text);border-radius:999px;padding:6px 13px;font:inherit;font-size:13px;font-weight:700;cursor:pointer}' +
    '.pr-tab[aria-selected="true"]{background:var(--blue);border-color:var(--blue);color:#fff}' +
    '.pr-tab:disabled{opacity:.45;cursor:default}' +
    '.pr-tools{display:flex;gap:6px;align-items:center}' +
    '.pr-btn{border:1px solid var(--line);background:var(--ghost);color:var(--text);border-radius:10px;padding:6px 11px;font:inherit;font-size:13px;font-weight:700;cursor:pointer;min-width:34px}' +
    '.pr-btn:focus-visible,.pr-tab:focus-visible,.pr-head select:focus-visible{outline:2px solid var(--blue);outline-offset:2px}' +
    '.pr-body{flex:1;overflow:auto;padding:18px;background:var(--inset);display:flex;flex-direction:column;align-items:center;gap:14px;-webkit-user-select:none;user-select:none}' +
    '.pr-body canvas{display:block;max-width:none;background:#fff;border-radius:6px;box-shadow:0 4px 18px var(--shadow)}' +
    '.pr-msg{margin:auto;color:var(--muted);font-size:14px;text-align:center;max-width:460px;line-height:1.5}' +
    '.pr-foot{display:flex;justify-content:space-between;gap:10px;padding:8px 16px;border-top:1px solid var(--line2);font-size:12px;color:var(--muted);background:var(--panel)}' +
    '@media (max-width:640px){.pr-bg{padding:0}.pr-panel{border-radius:0}.pr-title{width:100%}.pr-body{padding:10px}}' +
    '@media print{html.pr-open body{display:none!important}}';
  function addStyle() { var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st); }

  /* ---------------- server calls ---------------- */
  function post(fn, args) {
    return fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify({ fn: fn, args: args }), cache: 'no-store', credentials: 'omit' });
  }
  function listPolicies(tok) {
    return post('__policies', [tok]).then(function (r) { return r.json(); }).then(function (j) {
      var res = j && j.result; if (!res || res.success === false) throw new Error(res && res.message || (j && j.error) || 'Could not load the policies.');
      state.diag = res.diag || null;
      return res.items || [];
    });
  }
  function fetchPdf(tok, id) {
    return post('__policyFile', [tok, id]).then(function (r) {
      var ct = r.headers.get('content-type') || '';
      if (!r.ok || /json/.test(ct)) return r.json().catch(function () { return {}; }).then(function (j) { throw new Error(j.error || (j.result && j.result.message) || 'This policy could not be opened.'); });
      return r.arrayBuffer();
    });
  }
  var pdfjsPromise = null;
  function pdfjs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (!pdfjsPromise) pdfjsPromise = new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = 'vendor/pdf.min.js?v=' + V;
      s.onload = function () { if (!window.pdfjsLib) return rej(new Error('viewer')); window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js?v=' + V; res(window.pdfjsLib); };
      s.onerror = function () { pdfjsPromise = null; rej(new Error('The policy viewer could not be loaded. Check your connection.')); };
      document.head.appendChild(s);
    });
    return pdfjsPromise;
  }

  /* ---------------- reader ---------------- */
  function months() {
    var seen = {}, out = [];
    state.items.forEach(function (p) { var k = p.year + '-' + ('0' + p.month).slice(-2); if (!seen[k]) { seen[k] = 1; out.push({ key: k, label: p.label }); } });
    return out.sort(function (a, b) { return a.key < b.key ? 1 : -1; });   // newest first
  }
  function itemsFor(monthKey) { return state.items.filter(function (p) { return p.year + '-' + ('0' + p.month).slice(-2) === monthKey; }); }
  function msg(t) { var b = $('prBody'); if (b) b.innerHTML = '<div class="pr-msg">' + t + '</div>'; }

  function open() {
    var tok = token(); if (!tok || state.open) return;
    state.open = true; state.tok = tok; document.documentElement.classList.add('pr-open');
    var w = who();
    var root = document.createElement('div'); root.id = 'prRoot';
    root.innerHTML = '<div class="pr-bg" role="dialog" aria-modal="true" aria-labelledby="prTitle"><div class="pr-panel">' +
      '<div class="pr-head"><div class="pr-title" id="prTitle">Incentive policies <small>view only</small></div>' +
      '<select id="prMonth" aria-label="Policy month"></select><div class="pr-tabs" id="prTabs" role="tablist" aria-label="Level"></div>' +
      '<div class="pr-tools"><button class="pr-btn" id="prOut" type="button" aria-label="Zoom out">−</button><button class="pr-btn" id="prIn" type="button" aria-label="Zoom in">+</button>' +
      '<button class="pr-btn" id="prClose" type="button" aria-label="Close">✕</button></div></div>' +
      '<div class="pr-body" id="prBody"><div class="pr-msg">Loading your policies…</div></div>' +
      '<div class="pr-foot"><span id="prInfo"></span><span>Viewing as ' + esc(w.name || w.email) + ' · download and print are disabled</span></div>' +
      '</div></div>';
    document.body.appendChild(root);
    $('prClose').onclick = close;
    $('prIn').onclick = function () { state.zoom = Math.min(2.5, state.zoom + 0.25); render(); };
    $('prOut').onclick = function () { state.zoom = Math.max(0.5, state.zoom - 0.25); render(); };
    $('prMonth').onchange = function () { state.month = this.value; pickLevel(); drawTabs(); show(); };
    root.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    root.addEventListener('dragstart', function (e) { e.preventDefault(); });
    root.querySelector('.pr-bg').addEventListener('click', function (e) { if (e.target === this) close(); });
    $('prClose').focus();
    state.watch = setInterval(function () { if (token() !== state.tok) close(); }, 1000);   // logged out or session changed
    listPolicies(tok).then(function (items) {
      if (!state.open) return;
      state.items = items;
      var ms = months();
      if (!ms.length) {
        var d = state.diag && state.diag.bucketFiles;
        if (d) return msg(d.length ? 'No file in the <b>policies</b> bucket matches the name pattern <b>B2C_L0_Incentive_Policy_April_2026.pdf</b>.<br><br>Files found:<br>' + d.slice(0, 30).map(esc).join('<br>') : 'The <b>policies</b> bucket is empty, or the server cannot see its files.' + (state.diag.method ? '<br><small>(' + esc(state.diag.method) + ')</small>' : ''));
        return msg('No incentive policy is available for your role yet.');
      }
      $('prMonth').innerHTML = ms.map(function (m) { return '<option value="' + m.key + '">' + esc(m.label) + '</option>'; }).join('');
      state.month = ms[0].key; pickLevel(); drawTabs(); show();
    }, function (e) { if (state.open) msg(esc(e.message)); });
  }
  function pickLevel() {
    var avail = itemsFor(state.month).map(function (p) { return p.level; });
    var mine = (window.S && window.S.user && window.S.user.level) || '';
    if (avail.indexOf(state.level) >= 0) return;
    state.level = avail.indexOf(mine) >= 0 ? mine : (['L4', 'L3', 'L2', 'L1', 'L0'].filter(function (l) { return avail.indexOf(l) >= 0; })[0] || '');
  }
  function drawTabs() {
    var avail = itemsFor(state.month).map(function (p) { return p.level; });
    var levels = []; state.items.forEach(function (p) { if (levels.indexOf(p.level) < 0) levels.push(p.level); });
    levels.sort().reverse();
    $('prTabs').innerHTML = levels.map(function (l) {
      var on = avail.indexOf(l) >= 0;
      return '<button type="button" role="tab" class="pr-tab" data-l="' + l + '" aria-selected="' + (l === state.level) + '"' + (on ? '' : ' disabled title="No ' + l + ' policy for this month"') + '>' + LEVEL_NAME[l] + '</button>';
    }).join('');
    Array.prototype.forEach.call($('prTabs').querySelectorAll('.pr-tab'), function (b) { b.onclick = function () { state.level = this.getAttribute('data-l'); drawTabs(); show(); }; });
  }
  function show() {
    var p = itemsFor(state.month).filter(function (x) { return x.level === state.level; })[0];
    if (!p) return msg('No policy for this month and level.');
    $('prInfo').textContent = p.level + ' · ' + p.label;
    msg('Opening ' + esc(p.level + ' policy, ' + p.label) + '…');
    state.zoom = 1;
    var id = p.id, want = ++state.renderId;
    Promise.all([pdfjs(), state.docs[id] ? Promise.resolve(null) : fetchPdf(state.tok, id)]).then(function (r) {
      if (!state.open || want !== state.renderId) return;
      if (!state.docs[id]) state.docs[id] = r[0].getDocument({ data: new Uint8Array(r[1]), isEvalSupported: false, disableAutoFetch: true }).promise;
      return state.docs[id].then(function (doc) { if (want !== state.renderId) return; state.doc = doc; render(); });
    }).catch(function (e) { if (state.open && want === state.renderId) msg(esc(e.message || 'This policy could not be opened.')); });
  }
  function watermark(ctx, w, h) {
    var u = who(), text = (u.email || u.name || '') + ' · ' + new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    ctx.save(); ctx.globalAlpha = 0.08; ctx.fillStyle = '#1d2733'; ctx.font = '600 ' + Math.round(w / 34) + 'px sans-serif';
    ctx.translate(w / 2, h / 2); ctx.rotate(-Math.atan2(h, w)); ctx.textAlign = 'center';
    for (var y = -h; y <= h; y += Math.round(h / 5)) ctx.fillText(text, 0, y);
    ctx.restore();
  }
  function render() {
    var doc = state.doc, body = $('prBody'); if (!doc || !body) return;
    var want = ++state.renderId, dpr = Math.min(window.devicePixelRatio || 1, 2);
    var width = Math.max(280, Math.min(body.clientWidth - 36, 900)) * state.zoom;
    body.innerHTML = '';
    var chain = Promise.resolve();
    for (var i = 1; i <= doc.numPages; i++) (function (n) {
      chain = chain.then(function () {
        if (want !== state.renderId || !state.open) return;
        return doc.getPage(n).then(function (page) {
          var vp1 = page.getViewport({ scale: 1 }), vp = page.getViewport({ scale: (width / vp1.width) * dpr });
          var c = document.createElement('canvas'); c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
          c.style.width = Math.floor(vp.width / dpr) + 'px'; c.style.height = Math.floor(vp.height / dpr) + 'px';
          c.setAttribute('aria-label', 'Policy page ' + n + ' of ' + doc.numPages);
          body.appendChild(c);
          var ctx = c.getContext('2d');
          return page.render({ canvasContext: ctx, viewport: vp }).promise.then(function () { watermark(ctx, c.width, c.height); });
        });
      });
    })(i);
    chain.catch(function () { if (want === state.renderId) msg('This policy could not be displayed.'); });
  }
  function close() {
    if (!state.open) return;
    state.open = false; state.renderId++; state.doc = null;
    if (state.watch) clearInterval(state.watch);
    var r = $('prRoot'); if (r) r.parentNode.removeChild(r);
    document.documentElement.classList.remove('pr-open');
    if (token() !== state.tok) { Object.keys(state.docs).forEach(function (k) { state.docs[k].then(function (d) { d.destroy(); }, function () {}); }); state.docs = {}; }
  }

  // no print / save shortcuts while the reader is open
  document.addEventListener('keydown', function (e) {
    if (!state.open) return;
    var k = (e.key || '').toLowerCase();
    if ((e.ctrlKey || e.metaKey) && (k === 'p' || k === 's')) { e.preventDefault(); e.stopPropagation(); }
    if (k === 'escape') close();
  }, true);

  /* ---------------- the header button ---------------- */
  function addButton() {
    var bar = document.querySelector('#appView .user-actions');
    if (!bar || $('policyBtn')) return !!bar;
    var b = document.createElement('button');
    b.id = 'policyBtn'; b.type = 'button'; b.className = 'ghost'; b.textContent = 'Policies'; b.title = 'Incentive policies';
    b.onclick = open;
    var pw = bar.querySelector('button[onclick^="openPassword"]');
    bar.insertBefore(b, pw || null);
    return true;
  }
  function init() { addStyle(); if (!addButton()) { var t = setInterval(function () { if (addButton()) clearInterval(t); }, 500); } }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
