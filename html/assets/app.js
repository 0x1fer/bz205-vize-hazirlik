/* BZ205 Vize Hazırlık: sayfa etkileşimleri (konu sayfaları ve ana sayfa ortak) */
(function () {
  'use strict';
  var body = document.body;
  var BASE = body.dataset.base || '';
  var page = body.dataset.page || '';
  var isDoc = body.classList.contains('doc');

  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('bz205:' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('bz205:' + k, JSON.stringify(v)); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem('bz205:' + k); } catch (e) {} }
  };
  window.BZStore = store;

  /* ---------- tema */
  var themeBtn = document.getElementById('themeBtn');
  function currentTheme() {
    var t = document.documentElement.dataset.theme;
    if (t) return t;
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  if (themeBtn) themeBtn.addEventListener('click', function () {
    var t = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('bz205:theme', t); } catch (e) {}
  });

  /* ---------- arama (her sayfada) */
  var sBox = document.getElementById('search'), sIn = document.getElementById('searchIn'), sOut = document.getElementById('searchOut');
  var sBtn = document.getElementById('searchBtn');
  var IDX = window.BZ_INDEX || [];
  var TRMAP = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'i̇': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', 'â': 'a', 'î': 'i', 'û': 'u' };
  function norm(s) { return s.toLocaleLowerCase('tr').replace(/i̇|[çğıöşüâîû]/g, function (c) { return TRMAP[c] || c; }); }
  IDX.forEach(function (e) { e._t = norm(e.t); e._x = norm(e.x); });
  function esc(s) { return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var sel = 0, results = [];
  function snippet(e, terms) {
    var at = -1;
    for (var i = 0; i < terms.length && at < 0; i++) at = e._x.indexOf(terms[i]);
    var start = Math.max(0, at - 50), txt = e.x.substr(start, 170);
    var out = esc((start > 0 ? '…' : '') + txt + (e.x.length > start + 170 ? '…' : ''));
    var n = norm(out);
    terms.forEach(function (t) {
      if (t.length < 2) return;
      var re = new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), m, pieces = [], last = 0;
      while ((m = re.exec(n))) { pieces.push([m.index, m.index + t.length]); }
      if (!pieces.length) return;
      var res = '';
      pieces.forEach(function (p) { res += out.slice(last, p[0]) + '\u0001' + out.slice(p[0], p[1]) + '\u0002'; last = p[1]; });
      out = res + out.slice(last); n = norm(out);
    });
    return out.replace(/\u0001/g, '<mark>').replace(/\u0002/g, '</mark>');
  }
  function doSearch() {
    var q = norm(sIn.value.trim());
    var terms = q.split(/\s+/).filter(Boolean);
    sOut.innerHTML = '';
    results = [];
    if (!terms.length) { sOut.innerHTML = '<li class="search-empty">Yazmaya başla: “hızlı sıralama”, “sağın en küçüğü”, “postfix”…</li>'; return; }
    IDX.forEach(function (e) {
      var score = 0;
      for (var i = 0; i < terms.length; i++) {
        var t = terms[i], inT = e._t.indexOf(t) >= 0, inX = e._x.indexOf(t) >= 0;
        if (!inT && !inX) return;
        score += (inT ? 6 : 0) + (inX ? 1 + Math.min(4, e._x.split(t).length - 1) * .3 : 0);
      }
      if (e.p === 'konu-tumu') score -= .5;
      results.push([score, e]);
    });
    results.sort(function (a, b) { return b[0] - a[0]; });
    results = results.slice(0, 40).map(function (r) { return r[1]; });
    if (!results.length) { sOut.innerHTML = '<li class="search-empty">Eşleşme yok. Daha kısa bir kelime dene ya da Türkçe karakter olmadan yaz.</li>'; return; }
    sel = 0;
    sOut.innerHTML = results.map(function (e, i) {
      return '<li' + (i === 0 ? ' class="sel"' : '') + '><a href="' + BASE + e.p + '.html#' + e.id + '"><small>' + esc(e.d) + '</small><span>' + esc(e.t) + '</span><em>' + snippet(e, terms) + '</em></a></li>';
    }).join('');
  }
  function openSearch() { if (!sBox) return; sBox.hidden = false; sIn.focus(); sIn.select(); doSearch(); }
  function closeSearch() { if (sBox) sBox.hidden = true; }
  if (sBox) {
    sIn.addEventListener('input', doSearch);
    sBox.addEventListener('click', function (e) { if (e.target === sBox) closeSearch(); });
    sIn.addEventListener('keydown', function (e) {
      var lis = sOut.querySelectorAll('li a');
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!lis.length) return;
        sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + lis.length) % lis.length;
        sOut.querySelectorAll('li').forEach(function (li, i) { li.classList.toggle('sel', i === sel); });
        lis[sel].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter' && lis[sel]) { e.preventDefault(); closeSearch(); location.href = lis[sel].href; }
    });
    sOut.addEventListener('click', function (e) { if (e.target.closest('a')) closeSearch(); });
  }
  if (sBtn) sBtn.addEventListener('click', openSearch);
  document.addEventListener('keydown', function (e) {
    var typing = /INPUT|TEXTAREA/.test((document.activeElement || {}).tagName || '');
    if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) { e.preventDefault(); openSearch(); }
    else if (e.key === 'Escape') { closeSearch(); closeLB(); body.classList.remove('toc-open'); }
  });
  window.BZOpenSearch = openSearch;

  var lb = document.getElementById('lightbox');
  function closeLB() { if (lb) lb.hidden = true; }
  if (!isDoc) return;

  /* ---------- okuma çubuğu ve kaldığın yer */
  var bar = document.querySelector('.readbar span');
  var heads = Array.prototype.slice.call(document.querySelectorAll('.prose .h[id]'));
  var tocLinks = {};
  document.querySelectorAll('.toc a').forEach(function (a) { tocLinks[a.getAttribute('href').slice(1)] = a; });
  var lastSave = 0;
  function onScroll() {
    var h = document.documentElement, max = h.scrollHeight - h.clientHeight;
    if (bar) bar.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + '%';
    var cur = null;
    for (var i = 0; i < heads.length; i++) { if (heads[i].getBoundingClientRect().top < 140) cur = heads[i]; else break; }
    var link = null;
    if (cur) { var k = heads.indexOf(cur); while (k >= 0 && !tocLinks[heads[k].id]) k--; if (k >= 0) link = tocLinks[heads[k].id]; }
    var prev = document.querySelector('.toc a.active');
    if (prev !== link) {
      if (prev) prev.classList.remove('active');
      if (link) {
        link.classList.add('active');
        var toc = document.getElementById('toc'), r = link.getBoundingClientRect(), tr = toc.getBoundingClientRect();
        if (r.top < tr.top + 80 || r.bottom > tr.bottom - 30) toc.scrollTop += r.top - tr.top - tr.height / 3;
      }
    }
    var now = Date.now();
    if (now - lastSave > 1500) {
      lastSave = now;
      store.set('last', { p: page, l: body.dataset.title, id: cur ? cur.id : '', t: cur ? cur.querySelector('.ht').textContent : '', at: now,
        pct: max > 0 ? Math.round(h.scrollTop / max * 100) : 0 });
    }
  }
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- içindekiler (dar ekranda çekmece) */
  var menuBtn = document.getElementById('menuBtn');
  if (menuBtn) menuBtn.addEventListener('click', function () { body.classList.toggle('toc-open'); });
  document.getElementById('toc').addEventListener('click', function (e) { if (e.target.closest('a')) body.classList.remove('toc-open'); });

  /* ---------- "çalıştım" işaretleri */
  var unitTag = body.dataset.unit || 'h2';
  var group = body.dataset.group;
  function key(id) { return 'done:' + (group === 'konu' ? 'konu' : page) + ':' + id; }
  var units = Array.prototype.slice.call(document.querySelectorAll('.prose ' + unitTag + '.h[id]'));
  function refreshProgress() {
    var done = 0;
    units.forEach(function (h) {
      var d = !!store.get(key(h.id), false);
      if (d) done++;
      var b = h.querySelector('.done-btn');
      b.setAttribute('aria-pressed', d);
      b.querySelector('span').textContent = d ? 'Çalışıldı' : 'Çalıştım';
      if (tocLinks[h.id]) tocLinks[h.id].classList.toggle('done', d);
    });
    var el = document.getElementById('pgDone');
    if (el) el.textContent = done;
    var pb = document.getElementById('pgBar');
    if (pb) pb.style.width = (units.length ? done / units.length * 100 : 0) + '%';
  }
  units.forEach(function (h) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'done-btn';
    b.title = 'Bu başlığı çalıştığını işaretle; ilerleme ana sayfada görünür';
    b.innerHTML = '<i></i><span>Çalıştım</span>';
    b.addEventListener('click', function () {
      var k = key(h.id);
      if (store.get(k, false)) store.del(k); else store.set(k, 1);
      refreshProgress();
    });
    h.appendChild(b);
  });
  refreshProgress();

  /* ---------- çözümleri aç / kapat: çözüm blokları varsayılan kapalı, üstteki düğme hepsini birden açar ya da kapatır */
  var quizBtn = document.getElementById('quizBtn');
  var solBlocks = document.querySelectorAll('details.box-cozum');
  if (!solBlocks.length) solBlocks = document.querySelectorAll('details.box-cevap');
  var anyOpen = function () { return Array.prototype.some.call(solBlocks, function (d) { return d.open; }); };
  var syncQuiz = function () {
    if (!quizBtn) return;
    var open = anyOpen();
    quizBtn.setAttribute('aria-pressed', !open);
    quizBtn.querySelector('.lbl').textContent = open ? 'Çözümleri gizle' : 'Çözümleri göster';
  };
  if (quizBtn) {
    quizBtn.addEventListener('click', function () {
      var open = !anyOpen();
      solBlocks.forEach(function (d) { d.open = open; });
      syncQuiz();
    });
    document.addEventListener('toggle', function (e) { if (e.target.matches && e.target.matches('details.box-cozum, details.box-cevap')) syncQuiz(); }, true);
    syncQuiz();
  }
  /* bağlantı kapalı bir çözümün içini gösteriyorsa o çözümü aç */
  var openTarget = function () {
    var t = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
    var d = t && t.closest && t.closest('details.box-cozum');
    if (d && !d.open) { d.open = true; t.scrollIntoView(); }
  };
  window.addEventListener('hashchange', openTarget);
  openTarget();

  /* ---------- diyagram büyütme */
  if (lb) {
    var img = lb.querySelector('img'), stage = lb.querySelector('.lb-stage'), zoom = 1, natW = 0;
    var apply = function () { img.style.width = (natW * zoom) + 'px'; };
    var fit = function () {
      var r = stage.getBoundingClientRect();
      zoom = Math.min((r.width - 80) / natW, (r.height - 80) / (img.naturalHeight ? natW * img.naturalHeight / img.naturalWidth : 400), 3);
      apply();
    };
    document.addEventListener('click', function (e) {
      var z = e.target.closest('.gfx .zoom');
      if (!z) return;
      var src = z.querySelector('img');
      natW = parseFloat(src.getAttribute('width'));
      img.onload = fit;
      img.src = src.src;
      img.alt = src.alt;
      lb.hidden = false;
      if (img.complete) fit();
    });
    lb.querySelector('.lb-bar').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var v = b.dataset.z;
      if (v === 'x') closeLB(); else if (v === '0') fit(); else { zoom *= v === '1' ? 1.35 : 1 / 1.35; apply(); }
    });
    stage.addEventListener('click', function (e) { if (e.target === stage) closeLB(); });
    stage.addEventListener('wheel', function (e) {
      if (!e.ctrlKey) return;
      e.preventDefault(); zoom *= e.deltaY < 0 ? 1.12 : 1 / 1.12; apply();
    }, { passive: false });
    var drag = null;
    stage.addEventListener('pointerdown', function (e) { if (e.target === img) { drag = [e.clientX, e.clientY, stage.scrollLeft, stage.scrollTop]; stage.setPointerCapture(e.pointerId); } });
    stage.addEventListener('pointermove', function (e) { if (drag) { stage.scrollLeft = drag[2] - (e.clientX - drag[0]); stage.scrollTop = drag[3] - (e.clientY - drag[1]); } });
    stage.addEventListener('pointerup', function () { drag = null; });
  }

  /* ---------- kod kopyalama */
  document.querySelectorAll('.code').forEach(function (c) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'copy'; b.textContent = 'Kopyala';
    b.addEventListener('click', function () {
      var t = c.querySelector('code').innerText;
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () {
        b.textContent = 'Kopyalandı';
      }, function () {
        var r = document.createRange(); r.selectNodeContents(c.querySelector('code'));
        var s = getSelection(); s.removeAllRanges(); s.addRange(r); b.textContent = 'Seçildi, Ctrl+C';
      });
      setTimeout(function () { b.textContent = 'Kopyala'; }, 1600);
    });
    c.appendChild(b);
  });

  /* ---------- adım adım tablolar: sıralama izleri, BFS, postfix gibi */
  document.querySelectorAll('.tbl.trace').forEach(function (t) {
    var rows = t.tBodies[0] ? t.tBodies[0].rows : [];
    if (rows.length < 5) return;
    var wrap = t.parentNode, k = 0;
    var bar = document.createElement('div');
    bar.className = 'steps-bar';
    bar.innerHTML = '<button type="button" data-a="start">Adım adım izle</button>' +
      '<span hidden><button type="button" data-a="prev">Geri</button> <output></output> <button type="button" data-a="next">İleri</button> ' +
      '<button type="button" data-a="all">Tümünü göster</button></span>';
    wrap.parentNode.insertBefore(bar, wrap);
    var ctr = bar.querySelector('span'), out = bar.querySelector('output'), startB = bar.querySelector('[data-a=start]');
    function show() {
      for (var i = 0; i < rows.length; i++) { rows[i].classList.toggle('future', i > k); rows[i].classList.toggle('now', i === k); }
      out.textContent = (k + 1) + ' / ' + rows.length;
      var r = rows[k];
      if (r) { var wr = wrap.getBoundingClientRect(), rr = r.getBoundingClientRect(); if (rr.bottom > wr.bottom || rr.top < wr.top) wrap.scrollTop += rr.bottom - wr.bottom + 10; }
    }
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var a = b.dataset.a;
      if (a === 'start') { t.classList.add('stepping'); k = 0; ctr.hidden = false; startB.hidden = true; show(); }
      else if (a === 'next') { k = Math.min(rows.length - 1, k + 1); show(); }
      else if (a === 'prev') { k = Math.max(0, k - 1); show(); }
      else if (a === 'all') { t.classList.remove('stepping'); ctr.hidden = true; startB.hidden = false; for (var i = 0; i < rows.length; i++) rows[i].classList.remove('future', 'now'); }
    });
  });

  /* ---------- grafikler */
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('seen'); io.unobserve(e.target); } });
  }, { threshold: .35 }) : null;
  document.querySelectorAll('.chart-h, .chart-v').forEach(function (c) { if (io) io.observe(c); else c.classList.add('seen'); });

  document.querySelectorAll('.chart-f').forEach(function (f) {
    var data = JSON.parse(f.dataset.series), x0 = +f.dataset.x0, x1 = +f.dataset.x1;
    var paths = f.querySelectorAll('.ser'), legs = f.querySelectorAll('.leg');
    var input = f.querySelector('input'), outp = f.querySelector('output'), vals = f.querySelector('.nvals'), cur = f.querySelector('.cursor');
    var svgW = 560, P = 36;
    legs.forEach(function (l) {
      l.addEventListener('click', function () {
        var i = l.dataset.i; l.classList.toggle('off'); paths[i].classList.toggle('off'); update();
      });
    });
    function update() {
      var x = +input.value, k = Math.round((x - x0) / (x1 - x0) * (data[0].length - 1));
      outp.textContent = x.toFixed(1);
      var px = P + (x - x0) / (x1 - x0) * (svgW - P - 10);
      cur.setAttribute('x1', px); cur.setAttribute('x2', px);
      vals.innerHTML = Array.prototype.map.call(legs, function (l, i) {
        if (l.classList.contains('off')) return '';
        var v = data[i][k];
        return '<span class="' + l.className.replace('leg', '').trim() + '">' + l.dataset.name + ' = <b>' + (v >= 1000 ? Math.round(v) : v.toFixed(v < 10 ? 2 : 1)) + '</b></span>';
      }).join('');
    }
    input.addEventListener('input', update);
    update();
  });
})();
