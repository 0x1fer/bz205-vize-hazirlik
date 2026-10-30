/* BZ205 etkileşimli animasyonlar: çekirdek.
   Her bileşen algoritmayı baştan sona çalıştırıp "kare" (frame) listesi üretir; ortak oynatıcı bu
   kareleri oynatır, ileri/geri sarar ve kod panelinde ilgili satırı vurgular. */
(function () {
  'use strict';
  const V = (window.BZV = { reg: {} });

  // ------------------------------------------------------------ küçük yardımcılar
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  };
  const reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  V.esc = esc;
  V.el = el;

  // Hocanın birleşik alfabesi (Türkçe + İngilizce harfler)
  const ALPHA = 'A B C Ç D E F G Ğ H I İ J K L M N O Ö P Q R S Ş T U Ü V W X Y Z'.split(' ');
  const RANK = new Map(ALPHA.map((c, i) => [c, i]));
  const up = (s) => String(s).replace(/i/g, 'İ').replace(/ı/g, 'I').toUpperCase();
  function cmpStr(a, b) {
    a = up(a);
    b = up(b);
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) {
      if (a[i] === b[i]) continue;
      const ra = RANK.has(a[i]) ? RANK.get(a[i]) : 100 + a.charCodeAt(i);
      const rb = RANK.has(b[i]) ? RANK.get(b[i]) : 100 + b.charCodeAt(i);
      return ra - rb;
    }
    return a.length - b.length;
  }
  V.ALPHA = ALPHA;
  V.up = up;

  // Türkçe ek: değerin okunuşuna göre (16 → "on altı" → 16'dan, 7 → "yedi" → 7'den, A → "a" → A'nın)
  const BIR = ['sıfır', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz'];
  const ON = ['', 'on', 'yirmi', 'otuz', 'kırk', 'elli', 'altmış', 'yetmiş', 'seksen', 'doksan'];
  const HARF = { A: 'a', B: 'be', C: 'ce', Ç: 'çe', D: 'de', E: 'e', F: 'fe', G: 'ge', Ğ: 'ge', H: 'he', I: 'ı', İ: 'i', J: 'je', K: 'ke', L: 'le', M: 'me', N: 'ne', O: 'o', Ö: 'ö', P: 'pe', Q: 'ku', R: 're', S: 'se', Ş: 'şe', T: 'te', U: 'u', Ü: 'ü', V: 've', W: 've', X: 'iks', Y: 'ye', Z: 'ze' };
  function spoken(w) {
    w = String(w).trim();
    const m = w.match(/(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n === 0) return 'sıfır';
      if (n % 10) return BIR[n % 10];
      if (n % 100) return ON[(n % 100) / 10];
      return n % 1000 ? 'yüz' : 'bin';
    }
    if (w.length === 1 && HARF[up(w)]) return HARF[up(w)];
    return w.toLocaleLowerCase('tr-TR');
  }
  V.eks = function (w, kind) {
    const s = spoken(w);
    const VW = 'aeıioöuü';
    let lv = 'e';
    for (const ch of s) if (VW.includes(ch)) lv = ch;
    const last = s[s.length - 1] || 'e';
    const vEnd = VW.includes(last);
    const hard = 'fstkçşhp'.includes(last);
    const back = 'aıou'.includes(lv);
    const four = { a: 'ı', ı: 'ı', o: 'u', u: 'u', e: 'i', i: 'i', ö: 'ü', ü: 'ü' }[lv];
    const ae = back ? 'a' : 'e';
    return {
      den: (hard ? 't' : 'd') + ae + 'n',
      de: (hard ? 't' : 'd') + ae,
      e: (vEnd ? 'y' : '') + ae,
      i: (vEnd ? 'y' : '') + four,
      in: (vEnd ? 'n' : '') + four + 'n',
    }[kind];
  };

  let uid = 0;
  V.item = (t) => {
    t = String(t).trim();
    const n = /^-?\d+(\.\d+)?$/.test(t) ? parseFloat(t) : null;
    return { id: 'e' + ++uid, t: n === null ? up(t) : t, n };
  };
  V.cmp = (a, b) => (a.n !== null && b.n !== null ? a.n - b.n : cmpStr(a.t, b.t));
  V.parse = (s, max) =>
    String(s)
      .split(/[,;\s]+/)
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, max || 20)
      .map(V.item);
  V.rnd = (n, lo, hi) => Array.from({ length: n }, () => lo + Math.floor(Math.random() * (hi - lo + 1)));
  V.tag = (it) => '<b>' + esc(it.t) + '</b>';

  // ------------------------------------------------------------ FLIP: anahtarlı öğeleri eski yerinden yeni yerine kaydır
  V.flip = function (box, html, dur) {
    const old = new Map();
    if (dur) box.querySelectorAll('[data-k]').forEach((e) => old.set(e.dataset.k, e.getBoundingClientRect()));
    box.innerHTML = html;
    if (!dur || !box.animate) return;
    box.querySelectorAll('[data-k]').forEach((e) => {
      const o = old.get(e.dataset.k);
      if (!o) {
        e.animate([{ opacity: 0, transform: 'scale(.7)' }, { opacity: 1, transform: 'none' }], { duration: dur, easing: 'ease-out' });
        return;
      }
      const n = e.getBoundingClientRect();
      const dx = o.left - n.left;
      const dy = o.top - n.top;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5)
        e.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], {
          duration: dur,
          easing: 'cubic-bezier(.25,.8,.25,1)',
        });
    });
  };

  // ------------------------------------------------------------ oynatıcı
  const SPEEDS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 5, 8];
  V.Player = function (host, cfg) {
    const P = this;
    P.cfg = cfg;
    P.frames = [];
    P.i = 0;
    P.timer = 0;
    P.speed = cfg.speed || 3;
    P.view = cfg.views ? cfg.views[0][0] : null;

    const card = el('div', 'viz-card');
    card.tabIndex = 0;
    const head = el('div', 'viz-head');
    P.msg = el('div', 'viz-msg');
    P.stats = el('div', 'viz-stats');
    head.append(P.msg, P.stats);
    if (cfg.views) {
      const seg = el('div', 'viz-seg');
      P.setView = (k) => {
        P.view = k;
        seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x.dataset.v === k));
      };
      cfg.views.forEach(([k, label]) => {
        const b = el('button', k === P.view ? 'on' : '', esc(label));
        b.type = 'button';
        b.dataset.v = k;
        b.onclick = () => {
          P.setView(k);
          P.show(0);
        };
        seg.append(b);
      });
      head.append(seg);
    }
    P.stage = el('div', 'viz-stage');
    if (cfg.stageClass) P.stage.classList.add(cfg.stageClass);
    const legend = el('div', 'viz-legend');
    (cfg.legend || []).forEach(([c, label]) => legend.append(el('span', '', `<i class="sw ${c}"></i>${esc(label)}`)));

    const prog = el('div', 'viz-prog');
    P.slider = el('input');
    P.slider.type = 'range';
    P.slider.min = 0;
    P.slider.value = 0;
    P.slider.setAttribute('aria-label', 'Adım');
    P.pct = el('span', 'viz-pct', '0%');
    prog.append(P.slider, P.pct);
    P.slider.oninput = () => {
      P.pause();
      P.go(+P.slider.value, 0);
    };

    const ctrl = el('div', 'viz-ctrl');
    const left = el('div', 'viz-cl');
    P.playBtn = el('button', 'viz-btn primary', 'Oynat');
    P.playBtn.type = 'button';
    P.playBtn.onclick = () => (P.timer ? P.pause() : P.play());
    const prev = el('button', 'viz-btn sq', '‹');
    prev.type = 'button';
    prev.title = 'Önceki adım';
    prev.onclick = () => {
      P.pause();
      P.go(P.i - 1);
    };
    const next = el('button', 'viz-btn sq', '›');
    next.type = 'button';
    next.title = 'Sonraki adım';
    next.onclick = () => {
      P.pause();
      P.go(P.i + 1);
    };
    left.append(P.playBtn, prev, next);
    (cfg.buttons || []).forEach(([label, fn, title]) => {
      const b = el('button', 'viz-btn', esc(label));
      b.type = 'button';
      if (title) b.title = title;
      b.onclick = () => fn(P);
      left.append(b);
    });
    P.stepLbl = el('span', 'viz-step', 'Adım 0 / 0');
    left.append(P.stepLbl);
    const right = el('div', 'viz-cr');
    const sp = el('label', 'viz-rng', '<span>Hız <b></b></span>');
    const spIn = el('input');
    spIn.type = 'range';
    spIn.min = 0;
    spIn.max = SPEEDS.length - 1;
    spIn.value = P.speed;
    const spLbl = sp.querySelector('b');
    const setSp = () => {
      P.speed = +spIn.value;
      spLbl.textContent = SPEEDS[P.speed] + '×';
      if (P.timer) {
        P.pause();
        P.play();
      }
    };
    spIn.oninput = setSp;
    sp.append(spIn);
    right.append(sp);
    if (cfg.size) {
      const sz = el('label', 'viz-rng', '<span>Boyut <b></b></span>');
      const szIn = el('input');
      szIn.type = 'range';
      szIn.min = cfg.size.min;
      szIn.max = cfg.size.max;
      szIn.value = cfg.size.val;
      const szLbl = sz.querySelector('b');
      szLbl.textContent = szIn.value + ' eleman';
      szIn.oninput = () => (szLbl.textContent = szIn.value + ' eleman');
      szIn.onchange = () => cfg.size.onChange(+szIn.value, P);
      P.sizeIn = szIn;
      sz.append(szIn);
      right.append(sz);
    }
    ctrl.append(left, right);
    P.ops = el('div', 'viz-ops');
    const code = el('div', 'viz-code');
    code.append(el('div', 'viz-code-h', 'KOD <span></span>'));
    P.codeTitle = code.querySelector('.viz-code-h span');
    P.codeBox = el('pre', '');
    code.append(P.codeBox);
    P.codeKey = null;

    card.append(head, P.stage, legend, prog, ctrl, P.ops);
    if (cfg.code) card.append(code);
    host.append(card);
    host.bzPlayer = P;
    setSp();

    card.addEventListener('keydown', (e) => {
      if (e.target !== card) return;
      if (e.key === 'ArrowRight') {
        P.pause();
        P.go(P.i + 1);
        e.preventDefault();
      } else if (e.key === 'ArrowLeft') {
        P.pause();
        P.go(P.i - 1);
        e.preventDefault();
      } else if (e.key === ' ') {
        P.timer ? P.pause() : P.play();
        e.preventDefault();
      }
    });
    P.card = card;
  };
  const PP = V.Player.prototype;
  PP.delay = function () {
    return 900 / SPEEDS[this.speed];
  };
  PP.dur = function () {
    return reduced() ? 0 : Math.min(480, this.delay() * 0.8);
  };
  PP.load = function (frames, autoplay) {
    this.pause();
    this.frames = frames;
    this.slider.max = Math.max(0, frames.length - 1);
    this.i = 0;
    this.show(0);
    if (autoplay) this.play();
  };
  PP.go = function (i, dur) {
    if (!this.frames.length) return;
    i = Math.max(0, Math.min(this.frames.length - 1, i));
    this.i = i;
    this.show(dur == null ? this.dur() : dur);
  };
  PP.show = function (dur) {
    const f = this.frames[this.i];
    if (!f) return;
    const N = this.frames.length;
    this.slider.value = this.i;
    const pct = N > 1 ? Math.round((100 * this.i) / (N - 1)) : 100;
    this.pct.textContent = pct + '%';
    this.slider.style.setProperty('--p', pct + '%');
    this.stepLbl.textContent = `Adım ${this.i + 1} / ${N}`;
    this.msg.innerHTML = f.msg || '';
    const st = this.cfg.stats || [];
    this.stats.innerHTML = st
      .filter(([k]) => f.st && f.st[k] != null)
      .map(([k, label, tip]) => `<span${tip ? ` title="${esc(tip)}"` : ''}>${esc(label)}: <b>${f.st[k]}</b></span>`)
      .join('<i>·</i>');
    this.cfg.render(f, dur || 0, this);
    if (this.cfg.code) this.hl(f);
    if (this.i >= N - 1 && this.timer) this.pause();
    this.playBtn.textContent = this.timer ? 'Duraklat' : this.i >= N - 1 && N > 1 ? 'Tekrar oynat' : 'Oynat';
  };
  PP.hl = function (f) {
    const key = f.code || 'main';
    if (key !== this.codeKey) {
      const c = this.cfg.code[key] || [];
      this.codeKey = key;
      this.codeTitle.textContent = this.cfg.codeTitles ? this.cfg.codeTitles[key] || '' : '';
      this.codeBox.innerHTML = c
        .map((ln, k) => `<span class="ln" data-n="${k + 1}"><i>${k + 1}</i>${hlCode(ln)}</span>`)
        .join('');
    }
    const lines = [].concat(f.line || []);
    this.codeBox.querySelectorAll('.ln').forEach((e) => e.classList.toggle('on', lines.includes(+e.dataset.n)));
  };
  PP.play = function () {
    if (this.i >= this.frames.length - 1) {
      this.i = 0;
      this.show(0);
    }
    clearInterval(this.timer);
    this.timer = setInterval(() => {
      if (this.i >= this.frames.length - 1) return this.pause();
      this.i++;
      this.show(this.dur());
    }, this.delay());
    this.playBtn.textContent = 'Duraklat';
  };
  PP.pause = function () {
    clearInterval(this.timer);
    this.timer = 0;
    const N = this.frames.length;
    this.playBtn.textContent = this.i >= N - 1 && N > 1 ? 'Tekrar oynat' : 'Oynat';
  };
  PP.say = function (html) {
    this.msg.innerHTML = html;
  };

  const KW = /\b(for|while|if|else|return|break|NULL|true|false|new|delete|void|int|double)\b/g;
  function hlCode(s) {
    let out = esc(s);
    const ci = out.indexOf('//');
    let tail = '';
    if (ci >= 0) {
      tail = '<span class="c">' + out.slice(ci) + '</span>';
      out = out.slice(0, ci);
    }
    out = out.replace(KW, '<span class="k">$1</span>').replace(/\b(\d+)\b/g, '<span class="n">$1</span>');
    return out + tail;
  }

  // ------------------------------------------------------------ kontrol satırı (giriş + düğmeler)
  V.opsRow = function (P, label, ph, hint, buttons, val) {
    const row = el('div', 'viz-row');
    if (label) row.append(el('span', 'viz-lbl', esc(label)));
    const inp = el('input', 'viz-in');
    inp.type = 'text';
    inp.placeholder = ph || '';
    if (val != null) inp.value = val;
    row.append(inp);
    buttons.forEach(([t, fn, cls]) => {
      const b = el('button', 'viz-btn' + (cls ? ' ' + cls : ''), esc(t));
      b.type = 'button';
      b.onclick = () => fn(inp.value, inp);
      row.append(b);
    });
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        buttons[0][1](inp.value, inp);
      }
    });
    if (hint) row.append(el('span', 'viz-hint', esc(hint)));
    P.ops.append(row);
    return inp;
  };
  V.btnRow = function (P, label, buttons) {
    const row = el('div', 'viz-row');
    if (label) row.append(el('span', 'viz-lbl', esc(label)));
    buttons.forEach(([t, fn, cls, title]) => {
      const b = el('button', 'viz-btn' + (cls ? ' ' + cls : ''), esc(t));
      b.type = 'button';
      if (title) b.title = title;
      b.onclick = () => fn(b);
      row.append(b);
    });
    P.ops.append(row);
    return row;
  };

  // ------------------------------------------------------------ dizi çizici (çubuk / kutu görünümü)
  // f.a: öğe | null | {g: öğe} (hayalet); f.mk: {indis: sınıf}; f.done: indis listesi; f.held + f.heldAt: elde tutulan
  // f.range: [ilk, son] etkin aralık; f.ptr: {indis: 'i,j'}; f.aux: geçici dizi (indis hizalı)
  V.arrHTML = function (f, view, scale) {
    const n = f.a.length;
    const done = new Set(f.all ? f.a.map((_, i) => i) : f.done || []);
    const mk = f.mk || {};
    const rng = f.range;
    const cells = [];
    for (let i = 0; i < n; i++) {
      let it = f.a[i];
      let ghost = false;
      if (it && it.g) {
        it = it.g;
        ghost = true;
      }
      let cls = mk[i] || (done.has(i) ? 'done' : '');
      if (rng && (i < rng[0] || i > rng[1])) cls += ' out';
      let inner = '';
      if (f.held && f.heldAt === i) inner += cellHTML(f.held, 'held', view, scale, f.held.id);
      if (it) inner += cellHTML(it, cls + (ghost ? ' ghost' : ''), view, scale, ghost ? 'g' + it.id : it.id);
      else inner += `<div class="cell empty ${view}"></div>`;
      const ptr = f.ptr && f.ptr[i] ? `<em>${esc(f.ptr[i])}</em>` : '';
      cells.push(`<div class="slot${rng && i >= rng[0] && i <= rng[1] ? ' in' : ''}">${inner}<span class="ix">${i}${ptr}</span></div>`);
    }
    let html = `<div class="arr ${view}" style="--n:${n}">${cells.join('')}</div>`;
    if (f.aux) {
      const ax = [];
      for (let i = 0; i < n; i++) {
        const it = f.aux[i];
        ax.push(`<div class="slot">${it ? cellHTML(it, 'aux', 'array', scale, it.id) : '<div class="cell empty array"></div>'}</div>`);
      }
      html += `<div class="arr aux-row array" style="--n:${n}"><span class="aux-l">G</span>${ax.join('')}</div>`;
    }
    return html;
  };
  function cellHTML(it, cls, view, scale, key) {
    if (view === 'bars') {
      const h = scale(it);
      return `<div class="cell bar ${cls}" data-k="${key}" style="--h:${h.toFixed(1)}"><span>${esc(it.t)}</span></div>`;
    }
    return `<div class="cell array ${cls}" data-k="${key}"><span>${esc(it.t)}</span></div>`;
  }
  V.scaleFor = function (items) {
    const nums = items.every((x) => x.n !== null);
    if (nums) {
      const mx = Math.max(1, ...items.map((x) => x.n));
      return (it) => 8 + (92 * Math.max(0, it.n)) / mx;
    }
    const sorted = items.slice().sort(V.cmp);
    const rank = new Map();
    sorted.forEach((x, i) => rank.set(x.t, i));
    return (it) => 14 + (86 * ((rank.get(it.t) || 0) + 1)) / sorted.length;
  };

  // ------------------------------------------------------------ ağaç çizici (SVG, konumlar arasında yumuşak geçiş)
  const NS = 'http://www.w3.org/2000/svg';
  V.TreeView = function (host) {
    this.svg = document.createElementNS(NS, 'svg');
    this.svg.setAttribute('class', 'tv');
    host.append(this.svg);
    this.pos = new Map();
    this.vb = null;
    this.raf = 0;
  };
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  V.TreeView.prototype.draw = function (scene, dur) {
    cancelAnimationFrame(this.raf);
    const target = new Map(scene.nodes.map((n) => [n.id, n]));
    const start = new Map();
    scene.nodes.forEach((n) => {
      const p = this.pos.get(n.id);
      if (p) start.set(n.id, p);
      else if (n.from && this.pos.get(n.from)) start.set(n.id, this.pos.get(n.from));
      else start.set(n.id, { x: n.x, y: n.y, fresh: true });
    });
    const b = bounds(scene);
    const vb1 = [b.x0 - 30, b.y0 - 36, Math.max(b.x1 - b.x0 + 60, scene.minW || 260), b.y1 - b.y0 + 72];
    if (vb1[2] === (scene.minW || 260)) vb1[0] = (b.x0 + b.x1) / 2 - vb1[2] / 2;
    const vb0 = this.vb || vb1;
    const t0 = performance.now();
    const step = (now) => {
      const t = dur ? Math.min(1, (now - t0) / dur) : 1;
      const k = ease(t);
      const cur = new Map();
      scene.nodes.forEach((n) => {
        const s = start.get(n.id);
        cur.set(n.id, { x: s.x + (n.x - s.x) * k, y: s.y + (n.y - s.y) * k, a: s.fresh ? k : 1 });
      });
      const vb = vb0.map((v, i) => v + (vb1[i] - v) * k);
      this.paint(scene, cur, vb);
      if (t < 1) this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
    if (!dur) step(t0 + 1);
    this.pos = new Map(scene.nodes.map((n) => [n.id, { x: n.x, y: n.y }]));
    this.vb = vb1;
    void target;
  };
  function bounds(scene) {
    let x0 = Infinity,
      x1 = -Infinity,
      y0 = Infinity,
      y1 = -Infinity;
    scene.nodes.forEach((n) => {
      const w = (n.w || 40) / 2;
      x0 = Math.min(x0, n.x - w);
      x1 = Math.max(x1, n.x + w);
      y0 = Math.min(y0, n.y - 20);
      y1 = Math.max(y1, n.y + 20 + (n.note ? 16 : 0));
    });
    (scene.labels || []).forEach((l) => {
      x0 = Math.min(x0, l.x - 40);
      x1 = Math.max(x1, l.x + 40);
      y1 = Math.max(y1, l.y + 10);
      y0 = Math.min(y0, l.y - 14);
    });
    if (x0 === Infinity) return { x0: 0, x1: 200, y0: 0, y1: 60 };
    return { x0, x1, y0, y1 };
  }
  V.TreeView.prototype.paint = function (scene, cur, vb) {
    const svg = this.svg;
    svg.setAttribute('viewBox', vb.map((v) => v.toFixed(1)).join(' '));
    const w = svg.parentNode ? svg.parentNode.clientWidth || 600 : 600;
    const sc = Math.min(1.25, w / vb[2]);
    svg.style.height = Math.max(90, Math.min(520, vb[3] * sc)) + 'px';
    let s = '';
    (scene.edges || []).forEach((e) => {
      const a = cur.get(e.a);
      const c = cur.get(e.b);
      if (!a || !c) return;
      const ya = a.y + (e.fromBottom || 18);
      s += `<line class="e ${e.cls || ''}" x1="${a.x + (e.dx || 0)}" y1="${ya}" x2="${c.x}" y2="${c.y - 18}" style="opacity:${Math.min(a.a, c.a)}"/>`;
    });
    scene.nodes.forEach((n) => {
      const p = cur.get(n.id);
      const op = p.a < 1 ? ` style="opacity:${p.a}"` : '';
      if (n.cells) {
        const cw = n.cw;
        const x0 = p.x - n.w / 2;
        s += `<g class="bn ${n.cls || ''}"${op}><rect class="bnr" x="${x0}" y="${p.y - 17}" width="${n.w}" height="34" rx="7"/>`;
        n.cells.forEach((c, i) => {
          const cx = x0 + i * cw;
          if (i) s += `<line class="bnd" x1="${cx}" y1="${p.y - 17}" x2="${cx}" y2="${p.y + 17}"/>`;
          if (c.cls) s += `<rect class="bc ${c.cls}" x="${cx + 2}" y="${p.y - 15}" width="${cw - 4}" height="30" rx="5"/>`;
          s += `<text x="${cx + cw / 2}" y="${p.y + 5}">${esc(c.t)}</text>`;
        });
        s += '</g>';
      } else {
        const r = n.w / 2;
        s += `<g class="nd ${n.cls || ''}"${op}>`;
        s += r > 21 ? `<rect x="${p.x - r}" y="${p.y - 18}" width="${2 * r}" height="36" rx="18"/>` : `<circle cx="${p.x}" cy="${p.y}" r="19"/>`;
        s += `<text x="${p.x}" y="${p.y + 5}">${esc(n.label)}</text>`;
        if (n.badge != null) s += `<text class="bd" x="${p.x + r + 4}" y="${p.y - 14}">${esc(n.badge)}</text>`;
        if (n.note != null) s += `<text class="nt" x="${p.x}" y="${p.y + 34}">${esc(n.note)}</text>`;
        s += '</g>';
      }
    });
    (scene.labels || []).forEach((l) => {
      s += `<text class="lb ${l.cls || ''}" x="${l.x}" y="${l.y}">${esc(l.t)}</text>`;
    });
    svg.innerHTML = s;
  };
  V.textW = (t) => Math.max(38, String(t).length * 9.6 + 18);

  // İkili ağaç yerleşimi: içkök sırası x, derinlik y. node: {id, t, l, r}
  V.layoutBin = function (roots, mk, opt) {
    opt = opt || {};
    const nodes = [];
    const edges = [];
    let x = 0;
    const gap = opt.gap || 14;
    let prevW = 0;
    const walk = (n, d, parent) => {
      if (!n) return;
      walk(n.l, d + 1, n);
      const w = V.textW(n.t);
      x += prevW ? (prevW + w) / 2 + gap : 0;
      prevW = w;
      const cls = (mk && mk[n.id]) || '';
      nodes.push({ id: n.id, x, y: d * (opt.dy || 72), w, label: n.t, cls, badge: opt.badge ? opt.badge(n) : null, note: opt.note ? opt.note(n) : null, from: parent && parent.id });
      if (parent) edges.push({ a: parent.id, b: n.id, cls: mk && mk['e' + n.id] ? mk['e' + n.id] : '' });
      walk(n.r, d + 1, n);
    };
    roots.forEach((r, i) => {
      if (i && r) {
        x += 30;
      }
      walk(r, 0, null);
    });
    return { nodes, edges };
  };
  V.cloneT = function c(n) {
    return n ? { id: n.id, t: n.t, v: n.v, h: n.h, l: c(n.l), r: c(n.r) } : null;
  };

  // ------------------------------------------------------------ başlatma (görünür olunca kur)
  V.init = function () {
    const boxes = document.querySelectorAll('.viz[data-viz]');
    const build = (box) => {
      if (box.dataset.ready) return;
      box.dataset.ready = '1';
      const f = V.reg[box.dataset.viz];
      if (!f) {
        box.textContent = 'Animasyon bulunamadı: ' + box.dataset.viz;
        return;
      }
      try {
        f(box, box.dataset.init || '');
      } catch (err) {
        box.textContent = 'Animasyon yüklenemedi.';
        console.error(err);
      }
    };
    if (!('IntersectionObserver' in window)) return boxes.forEach(build);
    const io = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (e.isIntersecting) {
            io.unobserve(e.target);
            build(e.target);
          }
        }),
      { rootMargin: '400px 0px' }
    );
    boxes.forEach((b) => io.observe(b));
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(V.init));
  else setTimeout(V.init);
})();

/* Sıralama algoritmaları: araya sokma, seçmeli, kabarcık, birleşmeli, kümeleme, hızlı, radiks.
   Kodlar konu anlatımındaki (hocanın) kodlarla satır satır aynıdır; "İşlem (T)" sayacı hocanın sayma
   kuralıyla (her ifade 1, for başlığı: atama + kontrol + artırma) ilerler. */
(function () {
  'use strict';
  const V = window.BZV;
  const { esc, tag } = V;
  const C = (a, b) => V.cmp(a, b);
  const range = (a, b) => Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);
  const DERS = '7,3,5,8,2,9,4,15,6';

  function Rec(items) {
    this.a = items.slice();
    this.f = [];
    this.st = {};
  }
  Rec.prototype.snap = function (msg, line, o) {
    this.f.push(Object.assign({ a: this.a.slice(), msg, line, st: Object.assign({}, this.st) }, o || {}));
  };

  const LEG = {
    cmp: ['cmp', 'Karşılaştırılan'],
    swap: ['swap', 'Yer değiştiren'],
    done: ['done', 'Yerine oturdu'],
    part: ['part', 'Sıralı kısım'],
    held: ['held', 'Elde tutulan (ekle)'],
    min: ['min', 'En küçük (enk)'],
    pivot: ['key', 'Pivot'],
  };
  const ST_T = ['T', 'İşlem (T)', 'Hocanın sayma kuralıyla yapılan temel işlem sayısı; sonda T(n) formülüyle aynı çıkar'];

  // ------------------------------------------------------------ ortak sıralama bileşeni
  function sortWidget(box, init, spec) {
    const ctx = {};
    let base = V.parse(init || DERS, 16);
    let cur = base;
    const views = spec.custom ? null : [['bars', 'Çubuk'], ['array', 'Dizi']];
    const fresh = (list) => list.map((x) => V.item(x.t));
    const P = new V.Player(box, {
      stats: spec.stats,
      legend: spec.legend,
      code: { main: spec.code },
      codeTitles: { main: spec.title || '' },
      views,
      stageClass: spec.stageClass,
      buttons: [
        ['Karıştır', () => set(shuffle(cur), true)],
        ['Sıfırla', () => set(base, false)],
      ].concat((spec.presets || []).map(([label, gen, tip]) => [label, () => set(gen(cur.length, cur), true), tip])),
      size: { min: 3, max: spec.maxN || 16, val: base.length, onChange: (n) => set(randomItems(n, cur), true) },
      render: (f, dur) => (spec.render ? spec.render(f, dur, P, ctx) : V.flip(P.stage, V.arrHTML(f, P.view, ctx.scale), dur)),
    });
    V.opsRow(P, 'Kendi değerlerin', 'ör. 8, 3, 5, 1, 9  ya da  KAR, MOR, BAL', 'En fazla 16 değer · sayı ya da kelime (hocanın alfabesiyle)', [
      [
        'Görselleştir',
        (v) => {
          const it = V.parse(v, spec.maxN || 16);
          if (it.length < 2) return P.say('En az iki değer girin.');
          base = it;
          set(it, true);
        },
      ],
    ]);
    function set(list, autoplay) {
      cur = fresh(list);
      ctx.scale = V.scaleFor(cur);
      if (views && P.setView) P.setView(cur.some((x) => x.n === null) && cur.length > 9 ? 'array' : P.view);
      if (P.sizeIn) {
        P.sizeIn.value = cur.length;
        P.sizeIn.dispatchEvent(new Event('input'));
      }
      P.load(spec.run(cur, ctx), autoplay);
    }
    set(base, false);
  }
  function shuffle(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function randomItems(n, cur) {
    if (cur.some((x) => x.n === null)) {
      const pool = 'KAR MOR BAL ŞEN ÜZÜM TEK CAN ÖZ DAL ELMA İNCİR ÇAM GÜL ARI SU YOL ÖRDEK HALI'.split(' ');
      return shuffle(pool).slice(0, n).map(V.item);
    }
    const pool = shuffle(Array.from({ length: 99 }, (_, i) => i + 1));
    return pool.slice(0, n).map(String).map(V.item);
  }
  const asc = (n, cur) => sortedVals(n, cur);
  const desc = (n, cur) => sortedVals(n, cur).reverse();
  function sortedVals(n, cur) {
    const base = cur.length >= n ? cur.slice(0, n) : randomItems(n, cur);
    return base.slice().sort(C);
  }

  // ------------------------------------------------------------ araya sokma
  V.reg.insertion = (box, init) =>
    sortWidget(box, init, {
      title: 'ArayaSokma',
      code: [
        'ArayaSokma(D, n)',
        '  for (i = 1; i < n; i++)',
        '     ekle = D[i]                 // siradaki eleman elde',
        '     for (k = i-1; k >= 0 && ekle <= D[k]; k--)',
        '        D[k+1] = D[k]            // buyuk eleman saga kayar',
        '     D[k+1] = ekle               // bosluga yerlestir',
      ],
      stats: [['cmp', 'Karşılaştırma'], ['sw', 'Kaydırma'], ST_T],
      legend: [LEG.held, LEG.cmp, ['swap', 'Kayan'], LEG.part, LEG.done],
      presets: [
        ['En iyi durum', asc, 'Küçükten büyüğe sıralı: kaydırma hiç olmaz'],
        ['En kötü durum', desc, 'Büyükten küçüğe sıralı: her eleman en başa kadar kayar'],
      ],
      run(items) {
        const R = new Rec(items);
        const a = R.a;
        const n = a.length;
        const st = (R.st = { cmp: 0, sw: 0, T: 0 });
        st.T += 1;
        R.snap('İlk eleman <b>sıralı kabul edilir</b>; soldaki sıralı kısım, sağdaki sırasız kısım.', 2, { done: [], mk: { 0: 'part' } });
        for (let i = 1; ; i++) {
          st.T += 1;
          if (!(i < n)) break;
          const part = range(0, i - 1);
          const ekle = a[i];
          a[i] = null;
          st.T += 1;
          R.snap(`<b>ekle = D[${i}] = ${esc(ekle.t)}</b> elde tutulur; D[${i}] boşaldı.`, 3, { held: ekle, heldAt: i, done: part, ptr: { [i]: 'i' } });
          let k = i - 1;
          st.T += 1;
          while (true) {
            st.T += 1;
            if (k >= 0) {
              st.cmp++;
              R.snap(`${tag(ekle)} ≤ D[${k}] = ${tag(a[k])} ?`, 4, { held: ekle, heldAt: k + 1, done: part, mk: { [k]: 'cmp' }, ptr: { [k]: 'k' } });
            }
            if (!(k >= 0 && C(ekle, a[k]) <= 0)) break;
            a[k + 1] = a[k];
            a[k] = null;
            st.T += 1;
            st.sw++;
            R.snap(`Evet → ${tag(a[k + 1])} bir sağa kayar: D[${k + 1}] = D[${k}].`, 5, { held: ekle, heldAt: k, done: part, mk: { [k + 1]: 'swap' } });
            k--;
            st.T += 1;
          }
          a[k + 1] = ekle;
          st.T += 1;
          const why = k < 0 ? 'k = −1 (başa gelindi)' : `${esc(ekle.t)} > ${esc(a[k].t)}`;
          R.snap(`Hayır (${why}) → ekle boşluğa yerleşir: D[${k + 1}] = ${tag(ekle)}.`, 6, { done: range(0, i), mk: { [k + 1]: 'key' } });
          st.T += 1;
        }
        R.snap(`<b>Sıralandı!</b> T(n) = ${st.T} işlem (n = ${n}).`, [], { all: true });
        return R.f;
      },
    });

  // ------------------------------------------------------------ seçmeli (hocanın kodu)
  V.reg.selection = (box, init) =>
    sortWidget(box, init, {
      title: 'Secmeli',
      code: [
        'Secmeli(D, n)',
        '  for (i = 0; i < n-1; i++)',
        '     enk = D[n-1];  indis = n-1    // EN SONDAKI en kucuk kabul',
        '     for (j = i; j < n-1; j++)',
        '        if (D[j] < enk)',
        '           enk = D[j];  indis = j',
        '     D[indis] = D[i]               // bastaki en kucugun yerine',
        '     D[i] = enk                    // en kucuk basa',
      ],
      stats: [['cmp', 'Karşılaştırma'], ['sw', 'Yer değiştirme'], ST_T],
      legend: [LEG.min, LEG.cmp, LEG.swap, LEG.done],
      presets: [
        ['En iyi durum', (n) => Array.from({ length: n }, () => V.item('5')), 'Tüm elemanlar eşit: if içine hiç girilmez'],
        [
          'En kötü durum',
          (n, cur) => {
            const s = sortedVals(n, cur);
            const mx = s.pop();
            return s.reverse().concat([mx]);
          },
          'Son eleman en büyük, gerisi büyükten küçüğe',
        ],
      ],
      run(items) {
        const R = new Rec(items);
        const a = R.a;
        const n = a.length;
        const st = (R.st = { cmp: 0, sw: 0, T: 0 });
        let ifIn = 0;
        st.T += 1;
        R.snap('Her turda kalanlar içinden en küçük <b>seçilir</b> ve başa konur.', 2);
        for (let i = 0; ; i++) {
          st.T += 1;
          if (!(i < n - 1)) break;
          const done = range(0, i - 1);
          let enk = a[n - 1];
          let indis = n - 1;
          st.T += 2;
          R.snap(`Tur ${i + 1}: başlangıç en küçüğü <b>en sondaki</b> eleman: enk = D[${n - 1}] = ${tag(enk)}.`, 3, { done, mk: { [n - 1]: 'min' }, ptr: { [i]: 'i', [n - 1]: 'indis' } });
          let j = i;
          st.T += 1;
          while (true) {
            st.T += 1;
            if (!(j < n - 1)) break;
            st.T += 1;
            st.cmp++;
            R.snap(`D[${j}] = ${tag(a[j])} < enk = ${tag(enk)} ?`, 5, { done, mk: { [indis]: 'min', [j]: 'cmp' }, ptr: { [j]: 'j', [indis]: 'indis' } });
            if (C(a[j], enk) < 0) {
              enk = a[j];
              indis = j;
              st.T += 2;
              ifIn++;
              R.snap(`Evet → yeni en küçük: enk = ${tag(enk)}, indis = ${j}.`, 6, { done, mk: { [indis]: 'min' }, ptr: { [indis]: 'indis' } });
            }
            j++;
            st.T += 1;
          }
          const x = a[i];
          a[indis] = x;
          a[i] = enk;
          st.T += 2;
          st.sw++;
          const m =
            indis === i
              ? `En küçük ${tag(enk)} zaten D[${i}]'${V.eks(i, 'de')}; yer değiştirme kendisiyle yapılır.`
              : `D[${indis}] = D[${i}] (${tag(x)}), D[${i}] = enk (${tag(enk)}) → en küçük başa geçti.`;
          R.snap(m, [7, 8], { done: range(0, i), mk: indis === i ? { [i]: 'done' } : { [i]: 'swap', [indis]: 'swap' } });
          st.T += 1;
        }
        R.snap(`<b>Sıralandı!</b> T(n) = ${st.T} işlem (n = ${n}). if içi ${ifIn} kez çalıştı (üst sınır n(n−1)/2 = ${(n * (n - 1)) / 2}).`, [], { all: true });
        return R.f;
      },
    });

  // ------------------------------------------------------------ kabarcık
  V.reg.bubble = (box, init) =>
    sortWidget(box, init, {
      title: 'Kabarcik',
      code: [
        'Kabarcik(D, n)',
        '  for (hareket = 0; hareket < n-1; hareket++)   // dalga',
        '     for (k = 0; k < n-1-hareket; k++)        // komsular',
        '        if (D[k] > D[k+1])',
        '           gecici = D[k];  D[k] = D[k+1];  D[k+1] = gecici',
      ],
      stats: [['cmp', 'Karşılaştırma'], ['sw', 'Yer değiştirme'], ST_T],
      legend: [LEG.cmp, LEG.swap, LEG.done],
      presets: [
        ['En iyi durum', asc, 'Küçükten büyüğe sıralı: if içine hiç girilmez'],
        ['En kötü durum', desc, 'Büyükten küçüğe sıralı: her karşılaştırmada yer değiştirme'],
      ],
      run(items) {
        const R = new Rec(items);
        const a = R.a;
        const n = a.length;
        const st = (R.st = { cmp: 0, sw: 0, T: 0 });
        st.T += 1;
        R.snap('Her dalga hareketinde komşular karşılaştırılır; büyük olan sağa geçer.', 2);
        for (let h = 0; ; h++) {
          st.T += 1;
          if (!(h < n - 1)) break;
          const done = range(n - h, n - 1);
          st.T += 1;
          for (let k = 0; ; k++) {
            st.T += 1;
            if (!(k < n - 1 - h)) break;
            st.T += 1;
            st.cmp++;
            R.snap(`Dalga ${h + 1}: D[${k}] = ${tag(a[k])} > D[${k + 1}] = ${tag(a[k + 1])} ?`, 4, { done, mk: { [k]: 'cmp', [k + 1]: 'cmp' }, ptr: { [k]: 'k' } });
            if (C(a[k], a[k + 1]) > 0) {
              [a[k], a[k + 1]] = [a[k + 1], a[k]];
              st.T += 3;
              st.sw++;
              R.snap(`Evet → yer değiştir (3 atama): ${tag(a[k + 1])} sağa geçti.`, 5, { done, mk: { [k]: 'swap', [k + 1]: 'swap' } });
            }
            st.T += 1;
          }
          R.snap(`Dalga ${h + 1} bitti: ${tag(a[n - 1 - h])} en sona (D[${n - 1 - h}]) yerleşti.`, 2, { done: range(n - 1 - h, n - 1) });
          st.T += 1;
        }
        R.snap(`<b>Sıralandı!</b> T(n) = ${st.T} işlem (n = ${n}).`, [], { all: true });
        return R.f;
      },
    });

  // ------------------------------------------------------------ birleşmeli
  V.reg.merge = (box, init) =>
    sortWidget(box, init, {
      title: 'Birlesmeli + Birlestir',
      code: [
        'Birlesmeli(D, ilk, son)',
        '  if (ilk < son)',
        '     p = (ilk + son) / 2          // asagi yuvarlanir',
        '     Birlesmeli(D, ilk, p)',
        '     Birlesmeli(D, p+1, son)',
        '     Birlestir(D, ilk, p, son)',
        'Birlestir(D, ilk, p, son)',
        '  i = ilk;  j = p+1;  t = 0',
        '  while (i <= p && j <= son)',
        '     if (D[i] <= D[j]) G[t++] = D[i++]',
        '     else              G[t++] = D[j++]',
        '  while (i <= p)   G[t++] = D[i++]',
        '  while (j <= son) G[t++] = D[j++]',
        "  G'yi D[ilk..son]'a kopyala",
      ],
      stats: [['cmp', 'Karşılaştırma'], ['cp', 'Kopyalama'], ['d', 'Özyineleme derinliği'], ['md', 'En derin']],
      legend: [LEG.cmp, ['aux', "G'ye yazılan"], ['ghost', 'Taşındı (boş)'], ['part', 'Sıralı parça'], LEG.done],
      presets: [['Sıralı', asc], ['Ters sıralı', desc]],
      run(items) {
        const R = new Rec(items);
        const a = R.a;
        const n = a.length;
        const st = (R.st = { cmp: 0, cp: 0, d: 0, md: 0 });
        const sortedParts = new Set();
        const partsArr = () => [...sortedParts];
        const rec = (ilk, son, d) => {
          st.d = d;
          st.md = Math.max(st.md, d);
          if (ilk >= son) {
            sortedParts.add(ilk);
            R.snap(`Birlesmeli(D, ${ilk}, ${son}): tek eleman → zaten sıralı, geri dön.`, 2, { range: [ilk, son], done: partsArr() });
            return;
          }
          const p = Math.floor((ilk + son) / 2);
          R.snap(`Birlesmeli(D, ${ilk}, ${son}): p = (${ilk} + ${son}) / 2 = <b>${p}</b> → sol [${ilk}..${p}], sağ [${p + 1}..${son}]`, 3, {
            range: [ilk, son],
            ptr: { [p]: 'p' },
            done: partsArr(),
          });
          rec(ilk, p, d + 1);
          rec(p + 1, son, d + 1);
          st.d = d;
          merge(ilk, p, son);
        };
        const merge = (ilk, p, son) => {
          const aux = new Array(n).fill(null);
          let i = ilk,
            j = p + 1,
            t = 0;
          range(ilk, son).forEach((x) => sortedParts.delete(x));
          const ptr = () => {
            const o = {};
            if (i <= p) o[i] = 'i';
            if (j <= son) o[j] = (o[j] ? o[j] + ',' : '') + 'j';
            return o;
          };
          R.snap(`Birlestir(D, ${ilk}, ${p}, ${son}): sıralı iki parça ilk elemanları karşılaştırılarak G'de birleşir.`, 8, { range: [ilk, son], aux: aux.slice(), ptr: ptr() });
          const take = (fromI, line) => {
            const k = fromI ? i : j;
            aux[ilk + t] = a[k];
            a[k] = { g: a[k] };
            t++;
            st.cp++;
            if (fromI) i++;
            else j++;
            return line;
          };
          while (i <= p && j <= son) {
            st.cmp++;
            R.snap(`D[i] = ${tag(a[i])} ≤ D[j] = ${tag(a[j])} ?`, 10, { range: [ilk, son], aux: aux.slice(), mk: { [i]: 'cmp', [j]: 'cmp' }, ptr: ptr() });
            const left = C(a[i], a[j]) <= 0;
            const it = left ? a[i] : a[j];
            const ln = take(left, left ? 10 : 11);
            R.snap(`${left ? 'Evet' : 'Hayır'} → ${tag(it)} G'ye yazıldı.`, ln, { range: [ilk, son], aux: aux.slice(), ptr: ptr() });
          }
          if (i <= p || j <= son) {
            const fromI = i <= p;
            while (i <= p || j <= son) take(fromI, 0);
            R.snap(`Bir parça bitti → diğer parçada kalanlar sırayla G'ye eklenir.`, fromI ? 12 : 13, { range: [ilk, son], aux: aux.slice() });
          }
          range(ilk, son).forEach((x) => {
            a[x] = aux[x];
            sortedParts.add(x);
          });
          R.snap(`G, D[${ilk}..${son}]'a kopyalandı → bu aralık artık sıralı.`, 14, { range: [ilk, son], done: partsArr() });
        };
        R.snap('Böl ve fethet: dizi tek eleman kalana kadar ikiye bölünür, sonra birleştirilir.', 1);
        rec(0, n - 1, 1);
        R.snap('<b>Sıralandı!</b>', [], { all: true });
        return R.f;
      },
    });

  // ------------------------------------------------------------ hızlı sıralama (pivot en sondaki, hocanın tek dizi yöntemi)
  V.reg.quick = (box, init) =>
    sortWidget(box, init, {
      title: 'HizliSirala + Bolumle',
      code: [
        'HizliSirala(D, ilk, son)',
        '  if (ilk < son)',
        '     p = Bolumle(D, ilk, son)',
        '     HizliSirala(D, ilk, p-1)',
        '     HizliSirala(D, p+1, son)',
        'Bolumle(D, ilk, son)              // pivot: en sondaki',
        '  pivot = D[son];  p = son;  i = ilk',
        '  while (i < p)',
        '     if (D[i] > pivot)',
        '        D[p] = D[i];  D[i] = D[p-1];  D[p-1] = pivot;  p = p-1',
        '     else  i = i+1',
        '  return p                        // pivot yerini buldu',
      ],
      stats: [['cmp', 'Karşılaştırma'], ['sw', 'Taşıma (3 adım)'], ['d', 'Özyineleme derinliği'], ['md', 'En derin']],
      legend: [LEG.pivot, LEG.cmp, LEG.swap, ['done', 'Yerini buldu']],
      presets: [
        ['En kötü durum', asc, 'Sıralı dizi + sondaki pivot: pivot hep en büyük, bölme olmaz'],
        ['Ters sıralı', desc],
      ],
      run(items) {
        const R = new Rec(items);
        const a = R.a;
        const n = a.length;
        const st = (R.st = { cmp: 0, sw: 0, d: 0, md: 0 });
        const fixed = new Set();
        const fx = () => [...fixed];
        const qs = (ilk, son, d) => {
          st.d = d;
          st.md = Math.max(st.md, d);
          if (!(ilk < son)) {
            if (ilk === son) {
              fixed.add(ilk);
              R.snap(`HizliSirala(D, ${ilk}, ${son}): tek eleman → yerinde.`, 2, { range: [ilk, son], done: fx() });
            }
            return;
          }
          const pivot = a[son];
          let p = son,
            i = ilk;
          R.snap(`Bolumle(D, ${ilk}, ${son}): pivot = en sondaki = ${tag(pivot)}.`, 7, { range: [ilk, son], done: fx(), mk: { [p]: 'key' }, ptr: { [i]: 'i', [p]: 'p' } });
          while (i < p) {
            st.cmp++;
            R.snap(`D[${i}] = ${tag(a[i])} > pivot ${tag(pivot)} ?`, 9, { range: [ilk, son], done: fx(), mk: { [p]: 'key', [i]: 'cmp' }, ptr: { [i]: 'i', [p]: 'p' } });
            if (C(a[i], pivot) > 0) {
              const x = a[i],
                y = a[p - 1];
              a[p] = x;
              a[i] = y;
              a[p - 1] = pivot;
              p--;
              st.sw++;
              const m =
                i === p
                  ? `Evet → ${tag(x)} pivotun yerine yazıldı, pivot bir sola kaydı.`
                  : `Evet → (1) ${tag(x)} pivotun yerine, (2) pivotun önündeki ${tag(y)} boşalan D[${i}]'${V.eks(i, 'e')}, (3) pivot bir sola kaydı.`;
              R.snap(m, 10, { range: [ilk, son], done: fx(), mk: { [p]: 'key', [p + 1]: 'swap', [i]: i === p ? 'key' : 'swap' }, ptr: { [i]: 'i', [p]: 'p' } });
            } else {
              i++;
              R.snap(`Hayır → küçük eleman yerinde kalır, i = ${i}.`, 11, { range: [ilk, son], done: fx(), mk: { [p]: 'key' }, ptr: { [i]: 'i', [p]: 'p' } });
            }
          }
          fixed.add(p);
          R.snap(`i = p → pivot ${tag(pivot)} sıralamadaki yerini buldu (indis ${p}). Solu küçük, sağı büyük.`, 12, { range: [ilk, son], done: fx() });
          qs(ilk, p - 1, d + 1);
          qs(p + 1, son, d + 1);
        };
        R.snap('Pivottan küçükler sola, büyükler sağa geçer; pivot yerini bulur, sonra iki parça ayrı sıralanır.', 1);
        qs(0, n - 1, 1);
        R.snap('<b>Sıralandı!</b>', [], { all: true });
        return R.f;
      },
    });

  // ------------------------------------------------------------ kümeleme (iki aşama)
  V.reg.heap = (box, init) =>
    sortWidget(box, init, {
      title: 'Kumeleme + HipEkle + KokSil',
      custom: true,
      stageClass: 'heap-stage',
      maxN: 15,
      code: [
        'Kumeleme(D, n)',
        '  for (i = 0; i < n; i++)            // A) agac olusturma',
        '     HipEkle(H, D[i])',
        '  for (k = n-1; H bos degil; k--)    // B) koparma',
        '     D[k] = H[0]                     // koku kopar, kenara yaz',
        '     KokSil(H)',
        'HipEkle(H, x)',
        "  H'nin sonuna x ekle;  c = son      // zigzag sirasi",
        '  while (c > 0 && H[(c-1)/2] < H[c])',
        '     H[c] <-> H[(c-1)/2];  c = (c-1)/2',
        'KokSil(H)',
        '  H[0] = H[son];  sonu sil;  c = 0',
        "  while (c'nin cocugu var)",
        '     b = buyuk cocuk',
        '     if (H[c] >= H[b]) break',
        '     H[c] <-> H[b];  c = b',
      ],
      stats: [['ph', 'Aşama'], ['cmp', 'Karşılaştırma'], ['sw', 'Yer değiştirme']],
      legend: [['new', 'Yeni eklenen'], LEG.cmp, LEG.swap, ['done', 'Koparılıp yazılan']],
      presets: [['Sıralı', asc], ['Ters sıralı', desc]],
      run(items) {
        const n = items.length;
        const D = items.slice();
        const H = [];
        const f = [];
        const st = { ph: 'A) oluşturma', cmp: 0, sw: 0 };
        const snap = (msg, line, mk) => f.push({ H: H.slice(), D: D.slice(), mk: mk || {}, msg, line, st: Object.assign({}, st) });
        snap('İki aşama: <b>A)</b> hip ağacını oluştur, <b>B)</b> kökü kopararak sırala. (Düğüm ≥ çocukları)', 1);
        for (let i = 0; i < n; i++) {
          const x = D[i];
          D[i] = { g: x };
          H.push(x);
          let c = H.length - 1;
          snap(`HipEkle(${tag(x)}): zigzag sırasına göre en sona eklendi (indis ${c}).`, [3, 8], { [x.id]: 'new' });
          while (c > 0) {
            const par = (c - 1) >> 1;
            st.cmp++;
            snap(`Ebeveyn ${tag(H[par])} < ${tag(H[c])} ?`, 9, { [H[par].id]: 'cmp', [H[c].id]: 'cmp' });
            if (C(H[par], H[c]) < 0) {
              [H[par], H[c]] = [H[c], H[par]];
              st.sw++;
              snap(`Evet → yer değiştir: ${tag(H[par])} yukarı çıktı.`, 10, { [H[par].id]: 'swap', [H[c].id]: 'swap' });
              c = par;
            } else {
              snap('Hayır → hip özelliği sağlanıyor, sonraki veriye geç.', 9);
              break;
            }
          }
        }
        st.ph = 'B) koparma';
        snap('<b>A) tamam:</b> hip ağacı oluştu. Ağacı bırakmak eksik cevap: şimdi <b>B) sıralama</b>.', 4);
        for (let k = n - 1; H.length; k--) {
          const top = H[0];
          D[k] = top;
          const last = H.pop();
          if (H.length) H[0] = last;
          snap(`Kök (en büyük) ${tag(top)} koparıldı → D[${k}]'${V.eks(k, 'e')} yazıldı.`, 5, { [top.id]: 'done' });
          if (!H.length) break;
          snap(`Zigzag sırasına göre son eleman ${tag(last)} köke geldi.`, 12, { [last.id]: 'new' });
          let c = 0;
          while (2 * c + 1 < H.length) {
            let b = 2 * c + 1;
            if (b + 1 < H.length) {
              st.cmp++;
              if (C(H[b + 1], H[b]) > 0) b = b + 1;
            }
            st.cmp++;
            snap(`Büyük çocuk ${tag(H[b])}; ${tag(H[c])} ≥ ${tag(H[b])} ?`, [14, 15], { [H[c].id]: 'cmp', [H[b].id]: 'cmp' });
            if (C(H[c], H[b]) >= 0) {
              snap('Evet → hip özelliği sağlandı.', 15);
              break;
            }
            [H[c], H[b]] = [H[b], H[c]];
            st.sw++;
            snap(`Hayır → büyük çocukla yer değiştir: ${tag(H[b])} aşağı indi.`, 16, { [H[c].id]: 'swap', [H[b].id]: 'swap' });
            c = b;
          }
        }
        st.ph = 'bitti';
        snap('<b>Sıralandı!</b> Koparılan kökler sondan başa yazıldı.', [], {});
        return f;
      },
      render(f, dur, P, ctx) {
        if (!ctx.tv) {
          P.stage.innerHTML = '<div class="tv-host"></div><div class="rows"></div>';
          ctx.tv = new V.TreeView(P.stage.querySelector('.tv-host'));
          ctx.rows = P.stage.querySelector('.rows');
        }
        const build = (i) => (i < f.H.length ? { id: f.H[i].id, t: f.H[i].t, idx: i, l: build(2 * i + 1), r: build(2 * i + 2) } : null);
        const mk = {};
        Object.keys(f.mk).forEach((k) => (mk[k] = f.mk[k]));
        const sc = V.layoutBin([build(0)], mk, { note: (nd) => nd.idx });
        ctx.tv.draw(sc, dur);
        const row = (lbl, arr, full) =>
          `<div class="hrow"><span class="hl">${lbl}</span>` +
          (arr.length || full
            ? arr
                .map((it, i) => {
                  if (!it) return '<div class="cell array empty"></div>';
                  if (it.g) return `<div class="cell array ghost" data-k="g${it.g.id}"><span>${esc(it.g.t)}</span></div>`;
                  return `<div class="cell array ${f.mk[it.id] || ''}" data-k="${it.id}"><span>${esc(it.t)}</span><small>${i}</small></div>`;
                })
                .join('')
            : '<span class="hint">boş</span>') +
          '</div>';
        V.flip(ctx.rows, row('H', f.H) + row('D', f.D, true), dur);
      },
    });

  // ------------------------------------------------------------ radiks
  V.reg.radix = (box, init) => {
    const isWords = (items) => items.some((x) => x.n === null);
    sortWidget(box, init, {
      title: 'RadiksSirala',
      custom: true,
      stageClass: 'radix-stage',
      maxN: 12,
      code: [
        'RadiksSirala(D, n)',
        '  d = en uzun elemanin hane sayisi',
        '  tum elemanlari d haneye esitle     // sayida basa 0, kelimede sona A',
        '  for (h = d; h >= 1; h--)           // sagdan sola her hane',
        '     kovalari bosalt',
        '     for (i = 0; i < n; i++)',
        "        kova[ D[i]'nin h. hanesi ].enqueue(D[i])",
        '     j = 0',
        '     for (her kova c, alfabe/rakam sirasiyla)',
        '        while (!kova[c].isEmpty())  D[j++] = kova[c].dequeue()',
        '  eklenen 0/A karakterlerini at',
      ],
      stats: [['h', 'Hane'], ['dq', 'Dağıtma'], ['cl', 'Toplama']],
      legend: [['cmp', 'İşlenen hane'], ['pad', 'Eklenen 0 / A']],
      presets: [
        ['Ders: sayılar', () => '275,087,426,061,509,170,677,503'.split(',').map(V.item)],
        ['Ders: kelimeler', () => 'Ahmet,Ali,Ayşe,Veli,Mehmet,Serkan'.split(',').map(V.item)],
      ],
      run(items) {
        const words = isWords(items);
        const d = Math.max(...items.map((x) => x.t.length));
        const its = items.map((x) => ({ id: x.id, t: x.t, p: words ? x.t + 'A'.repeat(d - x.t.length) : x.t.padStart(d, '0'), pad: d - x.t.length, words }));
        const keys = words ? V.ALPHA.filter((c) => its.some((x) => x.p.includes(c))) : '0123456789'.split('');
        const f = [];
        const st = { h: '-', dq: 0, cl: 0 };
        let D = its.slice();
        let B = new Map(keys.map((k) => [k, []]));
        const snap = (msg, line, pos, act) =>
          f.push({ D: D.slice(), B: new Map([...B].map(([k, v]) => [k, v.slice()])), pos, act, msg, line, st: Object.assign({}, st), keys });
        snap(
          words
            ? `En uzun kelime ${d} harf → kısa kelimelerin <b>sonuna A</b> eklenir (sözlük sırası bozulmaz).`
            : `En uzun sayı ${d} hane → kısa sayıların <b>başına 0</b> eklenir (değer değişmez).`,
          [2, 3],
          -1
        );
        for (let h = d - 1; h >= 0; h--) {
          st.h = `${d - h}. geçiş`;
          B = new Map(keys.map((k) => [k, []]));
          snap(`${d - h}. geçiş: ${words ? 'sağdan ' + (d - h) + '. harf' : ['birler', 'onlar', 'yüzler', 'binler', 'on binler'][d - 1 - h] || d - h + '. hane'} basamağına göre kovalara dağıt.`, [4, 5], h);
          for (let i = 0; i < D.length; i++) {
            const it = D[i];
            const c = it.p[h];
            B.get(c).push(it);
            D[i] = null;
            st.dq++;
            snap(`${esc(it.p)} → <b>${esc(c)}</b> kovasına (sona) eklendi.`, 7, h, it.id);
          }
          let j = 0;
          keys.forEach((k) => {
            const q = B.get(k);
            if (!q.length) return;
            while (q.length) {
              D[j++] = q.shift();
              st.cl++;
            }
            snap(`<b>${esc(k)}</b> kovası geliş sırasıyla (kuyruk) D'ye toplandı.`, [9, 10], h);
          });
          snap(`${d - h}. geçiş bitti: ${D.map((x) => esc(x.p)).join(', ')}`, 4, h);
        }
        snap(`<b>Sıralandı!</b> Eklenen ${words ? 'A' : '0'}'lar atılır: ${D.map((x) => esc(x.t)).join(', ')}`, 11, -1);
        return f;
      },
      render(f, dur, P) {
        const chars = (it) =>
          [...it.p]
            .map((ch, i) => {
              const pad = it.words ? i >= it.p.length - it.pad : i < it.pad;
              return `<i class="${i === f.pos ? 'on' : ''}${pad ? ' pad' : ''}">${esc(ch)}</i>`;
            })
            .join('');
        const box = (it) => `<div class="rx ${f.act === it.id ? 'act' : ''}" data-k="${it.id}">${chars(it)}</div>`;
        let html = '<div class="rx-d"><span class="hl">D</span>' + f.D.map((it) => (it ? box(it) : '<div class="rx empty"></div>')).join('') + '</div>';
        html += '<div class="rx-b">' + f.keys.map((k) => `<div class="bk"><div class="bq">${f.B.get(k).map(box).join('')}</div><b>${esc(k)}</b></div>`).join('') + '</div>';
        V.flip(P.stage, html, dur);
      },
    });
  };
})();

/* Ağaçlar: ikili arama ağacı, AVL, ifade ağacı + gezmeler, B+ ağacı. Hocanın kuralları:
   eşit değer sağa; iki çocuklu silmede sağ alt ağacın en küçüğü; AVL silmede eşitlikte çift dönüş tercihi;
   B+'ta iç düğüm anahtarı = sağdaki alt ağacın en küçüğü, en fazla M-1 / L-1, en az ceil(M/2)-1 / ceil(L/2)-1. */
(function () {
  'use strict';
  const V = window.BZV;
  const { esc, tag } = V;
  const C = (a, b) => V.cmp(a, b);
  let nid = 0;
  const NN = (it) => ({ id: 'n' + ++nid, t: it.t, v: it, l: null, r: null, h: 0 });
  const H = (n) => (n ? n.h : -1);
  const upd = (n) => (n.h = 1 + Math.max(H(n.l), H(n.r)));
  const bf = (n) => H(n.l) - H(n.r);

  // ------------------------------------------------------------ ortak ağaç bileşeni
  function treeShell(box, cfg) {
    const ctx = {};
    const P = new V.Player(box, {
      stats: cfg.stats,
      legend: cfg.legend,
      code: cfg.code,
      codeTitles: cfg.codeTitles,
      stageClass: 'tree-stage',
      speed: 3,
      render(f, dur) {
        if (!ctx.tv) {
          P.stage.innerHTML = '<div class="tv-host"></div><div class="tv-out"></div>';
          ctx.tv = new V.TreeView(P.stage.querySelector('.tv-host'));
          ctx.out = P.stage.querySelector('.tv-out');
        }
        if (!f.scene.nodes.length) f.scene.labels = [{ x: 0, y: 4, t: f.empty || 'boş ağaç', cls: 'empty' }];
        ctx.tv.draw(f.scene, dur);
        ctx.out.innerHTML = f.out && f.out.length ? `<span class="ol">${esc(f.outLabel || 'Çıktı')}:</span>` + f.out.map((t, i) => `<b style="--i:${i}">${esc(t)}</b>`).join('') : f.info || '';
      },
    });
    return P;
  }

  // ============================================================ İAA ve AVL (aynı motor; avl=true ise denge)
  function bstWidget(box, init, avl) {
    let root = null;
    let frames = [];
    let out = [];
    let outLabel = '';
    let code = 'ekle';
    const P = treeShell(box, {
      stats: [['n', 'Düğüm'], ['h', 'Yükseklik'], ['cmp', 'Karşılaştırma']],
      legend: avl
        ? [['cmp', 'Bakılan'], ['new', 'Yeni / taşınan'], ['prob', 'Problemli düğüm'], ['rot', 'Dönüş'], ['done', 'Bulundu / yazıldı']]
        : [['cmp', 'Bakılan'], ['new', 'Yeni / taşınan'], ['min', 'Sağın en küçüğü'], ['del', 'Silinen'], ['done', 'Bulundu / yazıldı']],
      code: avl ? AVL_CODE : BST_CODE,
      codeTitles: avl ? { ekle: 'AVLEkle', sil: 'AVL silme', ara: 'Ara', once: 'Oncekok', ic: 'Ickok', sonra: 'Sonrakok' } : { ekle: 'Ekle', sil: 'Sil', ara: 'Ara', once: 'Oncekok', ic: 'Ickok', sonra: 'Sonrakok' },
    });
    let cmpN = 0;
    const count = (n) => (n ? 1 + count(n.l) + count(n.r) : 0);
    const snap = (msg, line, mk, extra) => {
      mk = mk || {};
      frames.push(
        Object.assign(
          {
            scene: V.layoutBin([root], mk, avl ? { badge: (n) => 'h' + n.h } : {}),
            msg,
            line,
            code,
            out: out.slice(),
            outLabel,
            st: { n: count(root), h: root ? height(root) : '-', cmp: cmpN },
          },
          extra || {}
        )
      );
    };
    const height = (n) => (n ? 1 + Math.max(height(n.l), height(n.r)) : -1);
    const pathMk = (path, extra) => {
      const mk = {};
      path.forEach((n) => (mk['e' + n.id] = 'path'));
      return Object.assign(mk, extra || {});
    };
    const relink = (par, old, neu) => {
      if (!par) root = neu;
      else if (par.l === old) par.l = neu;
      else par.r = neu;
    };

    // ---- ekleme
    function insert(it) {
      code = 'ekle';
      out = [];
      const nw = NN(it);
      if (!root) {
        root = nw;
        snap(`Ağaç boş → ${tag(it)} kök olarak eklendi.`, 2, { [nw.id]: 'new' });
        return;
      }
      const path = [];
      let d = root;
      while (true) {
        path.push(d);
        cmpN++;
        const left = C(it, d.v) < 0;
        snap(`${tag(it)} < ${tag(d.v)} ? → ${left ? 'Evet, sola' : C(it, d.v) === 0 ? 'eşit → kural: sağa' : 'Hayır, sağa'}`, avl ? (left ? [3, 4] : [5, 6]) : left ? 3 : 4, pathMk(path, { [d.id]: 'cmp' }));
        const nxt = left ? d.l : d.r;
        if (!nxt) {
          if (left) d.l = nw;
          else d.r = nw;
          break;
        }
        d = nxt;
      }
      snap(`${left0(path, it)} boş → ${tag(it)} yaprak olarak eklendi.`, 2, pathMk(path, { [nw.id]: 'new' }));
      if (avl) rebalance(path, true, it);
    }
    const left0 = (path, it) => {
      const d = path[path.length - 1];
      return `${esc(d.t)} düğümünün ${C(it, d.v) < 0 ? 'solu' : 'sağı'}`;
    };

    // ---- AVL denge kontrolü: path aşağıdan yukarı
    function rebalance(path, isInsert, it) {
      code = avl ? (isInsert ? 'ekle' : 'sil') : code;
      for (let k = path.length - 1; k >= 0; k--) {
        const X = path[k];
        upd(X);
        const fk = bf(X);
        snap(`${tag(X.v)}: h(sol) = ${H(X.l)}, h(sağ) = ${H(X.r)} → fark = <b>${fk > 0 ? '+' : ''}${fk}</b>${Math.abs(fk) < 2 ? ' (dengeli)' : ''}`, isInsert ? [7, 8] : [4, 5], { [X.id]: Math.abs(fk) >= 2 ? 'prob' : 'cmp' });
        if (Math.abs(fk) >= 2) {
          fix(X, k > 0 ? path[k - 1] : null, isInsert);
          if (isInsert) {
            snap('Eklemede tek bir (tek veya çift) dönüş ağacı dengeler; ağaç yine AVL.', 21);
            return;
          }
        }
      }
      snap(isInsert ? 'Köke kadar bütün düğümler dengeli; ağaç AVL.' : 'Silmeden sonra köke kadar kontrol bitti; ağaç AVL.', isInsert ? 21 : 8);
    }
    function rotR(x) {
      const y = x.l;
      x.l = y.r;
      y.r = x;
      upd(x);
      upd(y);
      return y;
    }
    function rotL(x) {
      const y = x.r;
      x.r = y.l;
      y.l = x;
      upd(x);
      upd(y);
      return y;
    }
    const balanced = (n) => !n || (Math.abs(bf(n)) <= 1 && balanced(n.l) && balanced(n.r));
    function fix(X, par, isInsert) {
      const fk = bf(X);
      const L = fk > 0;
      const Y = L ? X.l : X.r;
      const by = bf(Y);
      let dbl;
      let note = '';
      if (L) dbl = by < 0;
      else dbl = by > 0;
      if (by === 0) {
        // eşitlik (sadece silmede olur): hoca çift dönüşü tercih eder; sonuç dengesizse tek dönüş
        const cl = V.cloneT(X);
        const fixH = (n) => n && (fixH(n.l), fixH(n.r), upd(n));
        fixH(cl);
        const sub = L ? ((cl.l = rotL(cl.l)), rotR(cl)) : ((cl.r = rotR(cl.r)), rotL(cl));
        dbl = balanced(sub) && sub.l && sub.r;
        note = dbl
          ? ' İki taraf eşit uzunlukta: hocanın kuralı → <b>çift dönüş</b> tercih edilir.'
          : ' İki taraf eşit uzunlukta; çift dönüş dengeyi sağlamadığı için <b>tek dönüş</b> yapılır.';
      }
      const kind = L ? (dbl ? 'Sol–Sağ' : 'Sol–Sol') : dbl ? 'Sağ–Sol' : 'Sağ–Sağ';
      const lines = isInsert ? (L ? (dbl ? [12, 13, 14] : [10, 11]) : dbl ? [18, 19, 20] : [16, 17]) : [6, 7];
      const how = L
        ? dbl
          ? `önce ${esc(Y.t)}'${V.eks(Y.t, 'den')} sola, sonra ${esc(X.t)}'${V.eks(X.t, 'den')} sağa (çift dönüş)`
          : `${esc(X.t)}'${V.eks(X.t, 'den')} sağa tek dönüş`
        : dbl
          ? `önce ${esc(Y.t)}'${V.eks(Y.t, 'den')} sağa, sonra ${esc(X.t)}'${V.eks(X.t, 'den')} sola (çift dönüş)`
          : `${esc(X.t)}'${V.eks(X.t, 'den')} sola tek dönüş`;
      snap(`Problemli düğüm ${tag(X.v)} (fark ${fk > 0 ? '+' : ''}${fk}). <b>${kind}</b> durumu → ${how}.${note}`, lines, { [X.id]: 'prob', [Y.id]: 'rot' });
      let sub;
      if (dbl) {
        const Z = L ? Y.r : Y.l;
        if (L) X.l = rotL(Y);
        else X.r = rotR(Y);
        upd(X);
        snap(`1) ${esc(Y.t)}'${V.eks(Y.t, 'den')} ${L ? 'sola' : 'sağa'} dönüş: ${tag(Z.v)} yukarı çıktı.`, lines, { [X.id]: 'prob', [Z.id]: 'rot', [Y.id]: 'new' });
        sub = L ? rotR(X) : rotL(X);
        relink(par, X, sub);
        snap(`2) ${esc(X.t)}'${V.eks(X.t, 'den')} ${L ? 'sağa' : 'sola'} dönüş: ortadaki değer ${tag(sub.v)} alt ağacın köküne çıktı.`, lines, { [sub.id]: 'rot', [X.id]: 'new', [Y.id]: 'new' });
      } else {
        sub = L ? rotR(X) : rotL(X);
        relink(par, X, sub);
        snap(`${L ? 'Sağa' : 'Sola'} dönüş yapıldı: ${tag(sub.v)} yukarı çıktı, ${tag(X.v)} ${L ? 'sağ' : 'sol'} çocuğu oldu.`, lines, { [sub.id]: 'rot', [X.id]: 'new' });
      }
      if (par) upd(par);
    }

    // ---- arama
    function search(it) {
      code = 'ara';
      out = [];
      let d = root;
      const path = [];
      while (d) {
        path.push(d);
        cmpN++;
        if (C(it, d.v) === 0) {
          snap(`${tag(it)} == ${tag(d.v)} → <b>bulundu</b> (${path.length} karşılaştırma).`, 3, pathMk(path, { [d.id]: 'done' }));
          return;
        }
        const left = C(it, d.v) < 0;
        snap(`${tag(it)} ≠ ${tag(d.v)}; ${left ? 'küçük → sola' : 'büyük → sağa'}.`, left ? 4 : 5, pathMk(path, { [d.id]: 'cmp' }));
        d = left ? d.l : d.r;
      }
      snap(`NULL'a gelindi → ${tag(it)} ağaçta <b>yok</b>.`, 2, pathMk(path));
    }

    // ---- silme (hocanın kuralları)
    function remove(it) {
      code = 'sil';
      out = [];
      const path = [];
      let d = root;
      while (d && C(it, d.v) !== 0) {
        path.push(d);
        cmpN++;
        const left = C(it, d.v) < 0;
        snap(`${tag(it)} ${left ? '<' : '>'} ${tag(d.v)} → ${left ? 'sola' : 'sağa'}.`, avl ? 2 : left ? 3 : 4, pathMk(path, { [d.id]: 'cmp' }));
        d = left ? d.l : d.r;
      }
      if (!d) {
        snap(`${tag(it)} ağaçta yok; silinecek düğüm bulunamadı.`, avl ? 2 : 2, pathMk(path));
        return;
      }
      const par = path[path.length - 1] || null;
      path.push(d);
      cmpN++;
      snap(`Silinecek düğüm bulundu: ${tag(d.v)}.`, avl ? 2 : 4, pathMk(path, { [d.id]: 'del' }));
      let fixPath;
      if (d.l && d.r) {
        snap('İki çocuklu → <b>sağ alt ağacın en küçüğü</b> yerine geçer (hocanın kuralı).', avl ? 2 : [5, 6], pathMk(path, { [d.id]: 'del' }));
        const sp = [];
        let m = d.r;
        while (m.l) {
          sp.push(m);
          snap(`Sağ alt ağaçta sürekli sola: ${tag(m.v)} → sol.`, avl ? 2 : 6, pathMk(path.concat(sp), { [d.id]: 'del', [m.id]: 'cmp' }));
          m = m.l;
        }
        snap(`Sağ alt ağacın en küçüğü: ${tag(m.v)} (solu NULL).`, avl ? 2 : 6, pathMk(path.concat(sp), { [d.id]: 'del', [m.id]: 'min' }));
        const oldT = d.t;
        d.t = m.t;
        d.v = m.v;
        snap(`${tag(m.v)} silinen ${esc(oldT)}'${V.eks(oldT, 'in')} yerine yazıldı.`, avl ? 2 : 7, { [d.id]: 'new', [m.id]: 'min' });
        const mp = sp.length ? sp[sp.length - 1] : d;
        relink(mp, m, m.r);
        snap(`${tag(m.v)} eski yerinden silindi${m.r ? ` (tek çocuğu ${esc(m.r.t)} dedesine bağlandı)` : ' (yapraktı)'}.`, avl ? 2 : 8, m.r ? { [m.r.id]: 'new' } : {});
        fixPath = path.concat(sp);
      } else {
        const c = d.l || d.r;
        if (c) snap(`Tek çocuklu → çocuğu ${tag(c.v)} dedeye (${par ? esc(par.t) : 'köke'}) bağlanır.`, avl ? 2 : [9, 10], { [d.id]: 'del', [c.id]: 'new' });
        else snap('Yaprak → doğrudan silinir.', avl ? 2 : [9, 10], { [d.id]: 'del' });
        relink(par, d, c);
        snap(`${tag(it)} silindi.`, avl ? 2 : 11, c ? { [c.id]: 'new' } : {});
        fixPath = path.slice(0, -1);
      }
      if (avl) {
        snap('Silinen yerden köke doğru denge kontrolü (birden fazla dönüş gerekebilir).', 3);
        rebalance(fixPath, false, it);
      }
    }

    // ---- gezmeler
    function trav(kind) {
      code = kind;
      out = [];
      outLabel = { once: 'Öncekök', ic: 'İçkök', sonra: 'Sonrakök' }[kind];
      const done = {};
      const L = { once: [3, 4, 5], ic: [4, 3, 5], sonra: [5, 3, 4] }[kind];
      const yaz = (d) => {
        out.push(d.t);
        done[d.id] = 'done';
        snap(`Yaz(${tag(d.v)})`, L[0], Object.assign({}, done, { [d.id]: 'done' }));
      };
      const rec = (d) => {
        if (!d) return;
        snap(`${outLabel}(${tag(d.v)}) çağrıldı.`, 1, Object.assign({}, done, { [d.id]: done[d.id] || 'cmp' }));
        if (kind === 'once') yaz(d);
        rec(d.l);
        if (kind === 'ic') yaz(d);
        rec(d.r);
        if (kind === 'sonra') yaz(d);
      };
      if (!root) snap('Ağaç boş.', 2);
      rec(root);
      snap(`<b>${outLabel} sırası:</b> ${out.map(esc).join(', ')}`, [], done);
      outLabel = '';
    }

    // ---- işlemleri çalıştır
    const run = (ops, autoplay) => {
      frames = [];
      ops.forEach(([op, x]) => {
        if (op === 'ekle') insert(x);
        else if (op === 'sil') remove(x);
        else if (op === 'silkok') root ? remove(root.v) : snap('Ağaç boş.', []);
        else if (op === 'ara') search(x);
        else trav(op);
      });
      if (!frames.length) snap('Ağaç boş. Bir değer ekleyin.', []);
      P.load(frames, autoplay);
    };
    const vals = (s) => V.parse(s, 24);
    V.opsRow(P, 'Değer', 'ör. KAR  ya da  42', '', [
      ['Ekle', (v, inp) => vals(v).length && (run(vals(v).map((x) => ['ekle', x]), true), (inp.value = ''))],
      ['Sil', (v, inp) => vals(v).length && (run([['sil', vals(v)[0]]], true), (inp.value = ''))],
      ['Ara', (v) => vals(v).length && run([['ara', vals(v)[0]]], true)],
    ]);
    V.btnRow(P, 'Gezme', [
      ['Öncekök', () => run([['once']], true), '', 'kök, sol, sağ'],
      ['İçkök', () => run([['ic']], true), '', 'sol, kök, sağ (sıralı liste verir)'],
      ['Sonrakök', () => run([['sonra']], true), '', 'sol, sağ, kök'],
    ]);
    const ders = () => {
      root = null;
      const ops = vals(init).map((x) => ['ekle', x]);
      ops.push(['silkok']);
      if (!avl) ops.push(['ekle', V.item('DAL')]);
      run(ops, true);
    };
    V.btnRow(P, 'Hazır', [
      ['Ders örneği', ders, 'primary-soft', avl ? 'Derste çözülen sıra: ekle, sonra kökü sil' : 'Ekle, kökü sil, DAL ekle'],
      [
        'Kökü sil',
        () => root && run([['sil', root.v]], true),
        '',
        'Hocanın kuralıyla kök silme',
      ],
      [
        'Rastgele 8',
        () => {
          root = null;
          run(V.rnd(8, 1, 99).map((x) => ['ekle', V.item(String(x))]), true);
        },
      ],
      [
        'Sıralı 1..7',
        () => {
          root = null;
          run([1, 2, 3, 4, 5, 6, 7].map((x) => ['ekle', V.item(String(x))]), true);
        },
        '',
        avl ? 'AVL sıralı veride de dengeli kalır' : 'İAA sıralı veride ip gibi uzar: O(n)',
      ],
      [
        'Boşalt',
        () => {
          root = null;
          run([], false);
        },
      ],
    ]);
    // ilk görünüm: ders örneğinin eklemeleri hazır, oynatılmayı bekler
    const list = vals(init);
    run(list.map((x) => ['ekle', x]), false);
  }

  const BST_CODE = {
    ekle: ['Ekle(d, x)', '  if (d == NULL) return YeniDugum(x)', '  if (x < d->veri)  d->sol = Ekle(d->sol, x)', '  else              d->sag = Ekle(d->sag, x)   // esit: saga', '  return d'],
    ara: ['Ara(d, x)', '  if (d == NULL) return NULL', '  if (x == d->veri) return d', '  if (x < d->veri) return Ara(d->sol, x)', '  return Ara(d->sag, x)'],
    sil: [
      'Sil(kok, x)',
      '  if (kok == NULL) return NULL',
      '  if (x < kok->veri) kok->sol = Sil(kok->sol, x)',
      '  else if (x > kok->veri) kok->sag = Sil(kok->sag, x)',
      '  else if (iki cocugu var)',
      '     m = EnKucuk(kok->sag)          // sagin en kucugu',
      '     kok->veri = m->veri',
      '     kok->sag = Sil(kok->sag, m->veri)',
      '  else                              // yaprak / tek cocuk',
      '     t = (sol varsa sol, yoksa sag)',
      '     delete kok;  return t',
      '  return kok',
    ],
    once: ['Oncekok(d)', '  if (d == NULL) return', '  Yaz(d)', '  Oncekok(d->sol)', '  Oncekok(d->sag)'],
    ic: ['Ickok(d)', '  if (d == NULL) return', '  Ickok(d->sol)', '  Yaz(d)', '  Ickok(d->sag)'],
    sonra: ['Sonrakok(d)', '  if (d == NULL) return', '  Sonrakok(d->sol)', '  Sonrakok(d->sag)', '  Yaz(d)'],
  };
  const AVL_CODE = {
    ekle: [
      'AVLEkle(d, x)',
      '  if (d == NULL) return YeniDugum(x)',
      '  if (x < d->veri)',
      '     d->sol = AVLEkle(d->sol, x)',
      '  else',
      '     d->sag = AVLEkle(d->sag, x)',
      '  d->h = max(h(sol), h(sag)) + 1',
      '  fark = h(sol) - h(sag)',
      '  if (fark == 2)',
      '     if (x < d->sol->veri)          // SOL-SOL',
      '        d = SagaDondur(d)',
      '     else                           // SOL-SAG',
      '        d->sol = SolaDondur(d->sol)',
      '        d = SagaDondur(d)',
      '  else if (fark == -2)',
      '     if (x > d->sag->veri)          // SAG-SAG',
      '        d = SolaDondur(d)',
      '     else                           // SAG-SOL',
      '        d->sag = SagaDondur(d->sag)',
      '        d = SolaDondur(d)',
      '  return d',
    ],
    sil: [
      'AVLSil(kok, x)',
      '  IAA kurallariyla sil (yaprak / tek cocuk / sagin en kucugu)',
      '  silinen yerden koke dogru her d dugumunde:',
      '     d->h = max(h(sol), h(sag)) + 1',
      '     fark = h(sol) - h(sag)',
      '     if (fark == 2 || fark == -2)    // problemli dugum',
      '        durumu belirle (esitlikte cift donus tercih edilir)',
      '        tek / cift donusu uygula; koke kadar devam et',
    ],
    ara: BST_CODE.ara,
    once: BST_CODE.once,
    ic: BST_CODE.ic,
    sonra: BST_CODE.sonra,
  };
  V.reg.iaa = (box, init) => bstWidget(box, init, false);
  V.reg.avl = (box, init) => bstWidget(box, init, true);

  // ============================================================ ifade ağacı (sonek ifadeden) + gezmeler
  V.reg.gezme = (box, init) => {
    let frames = [];
    let roots = [];
    let out = [];
    let outLabel = '';
    let code = 'kur';
    const P = treeShell(box, {
      stats: [['n', 'Yığındaki alt ağaç']],
      legend: [['new', 'Yeni düğüm'], ['cmp', 'Ziyaret edilen'], ['done', 'Yazıldı']],
      code: {
        kur: [
          'IfadeAgaci(sonek)',
          '  S = bos yigin',
          '  for (her simge t, soldan saga)',
          '     if (t islenen)  S.push(YeniDugum(t))',
          '     else',
          '        sag = S.pop();  sol = S.pop()',
          '        S.push(YeniDugum(t, sol, sag))',
          '  return S.pop()                  // kok',
        ],
        once: BST_CODE.once,
        ic: BST_CODE.ic,
        sonra: BST_CODE.sonra,
      },
      codeTitles: { kur: 'İfade ağacı kurma', once: 'Oncekok', ic: 'Ickok', sonra: 'Sonrakok' },
    });
    const snap = (msg, line, mk) =>
      frames.push({ scene: V.layoutBin(roots, mk || {}, { gap: 18 }), msg, line, code, out: out.slice(), outLabel, st: { n: roots.length } });
    const isOp = (t) => /^[-+*/^]$/.test(t);
    function build(expr) {
      frames = [];
      roots = [];
      out = [];
      code = 'kur';
      const toks = String(expr).trim().split(/\s+/).filter(Boolean);
      snap(`Sonek ifade soldan sağa okunur: <code>${esc(toks.join(' '))}</code>`, 1);
      for (const t of toks) {
        if (!isOp(t)) {
          const n = { id: 'x' + ++nid, t, l: null, r: null };
          roots.push(n);
          snap(`İşlenen ${tag({ t })} → yeni yaprak, yığına push.`, 4, { [n.id]: 'new' });
        } else {
          if (roots.length < 2) {
            snap(`Hata: ${esc(t)} için yığında iki alt ağaç yok. İfadeyi kontrol edin.`, 6);
            return P.load(frames, true);
          }
          const sag = roots.pop();
          const sol = roots.pop();
          const n = { id: 'x' + ++nid, t, l: sol, r: sag };
          roots.push(n);
          snap(`İşlem ${tag({ t })}: önce sağ (${esc(sag.t)}), sonra sol (${esc(sol.t)}) alt ağaç pop edilir; yeni alt ağaç push.`, [6, 7], { [n.id]: 'new' });
        }
      }
      if (roots.length !== 1) snap(`Uyarı: sonda yığında ${roots.length} alt ağaç kaldı; ifade eksik/fazla işlenen içeriyor.`, 8);
      else snap('Yığında tek ağaç kaldı → <b>ifade ağacının kökü</b>. Sayılar/değişkenler yapraklarda.', 8);
      P.load(frames, true);
    }
    function trav(kind) {
      if (roots.length !== 1) return;
      frames = [];
      code = kind;
      out = [];
      outLabel = { once: 'Öncekök (önek)', ic: 'İçkök (içek)', sonra: 'Sonrakök (sonek)' }[kind];
      const L = { once: 3, ic: 4, sonra: 5 }[kind];
      const done = {};
      const rec = (d) => {
        if (!d) return;
        snap(`${outLabel.split(' ')[0]}(${tag(d)})`, 1, Object.assign({}, done, { [d.id]: 'cmp' }));
        const yaz = () => {
          out.push(d.t);
          done[d.id] = 'done';
          snap(`Yaz(${tag(d)})`, L, Object.assign({}, done));
        };
        if (kind === 'once') yaz();
        rec(d.l);
        if (kind === 'ic') yaz();
        rec(d.r);
        if (kind === 'sonra') yaz();
      };
      rec(roots[0]);
      snap(`<b>${outLabel}:</b> ${out.map(esc).join(' ')}`, [], done);
      P.load(frames, true);
    }
    V.opsRow(P, 'Sonek ifade', 'ör. a b c * + d e * f + g * +', 'Simgeler boşlukla ayrılır', [['Ağacı kur', (v) => v.trim() && build(v)]], init);
    V.btnRow(P, 'Gezme', [
      ['Öncekök', () => trav('once'), '', 'kök, sol, sağ → önek'],
      ['İçkök', () => trav('ic'), '', 'sol, kök, sağ → içek'],
      ['Sonrakök', () => trav('sonra'), '', 'sol, sağ, kök → sonek'],
    ]);
    build(init || 'a b c * + d e * f + g * +');
    P.pause();
    P.i = 0;
    P.show(0);
  };

  // ============================================================ B+ ağacı
  V.reg.bplus = (box, init) => {
    let M = 4,
      L = 4;
    let root = { id: 'b' + ++nid, leaf: true, keys: [] };
    let frames = [];
    let code = 'ekle';
    const minLeaf = () => Math.ceil(L / 2) - 1;
    const minKids = () => Math.ceil(M / 2);
    const P = treeShell(box, {
      stats: [['m', 'M (iç düğüm çocuk)'], ['l', 'L (yaprak)'], ['h', 'Yükseklik']],
      legend: [['cmp', 'İzlenen yol'], ['new', 'Eklenen / değişen'], ['del', 'Taşan / eksik kalan'], ['done', 'Bulundu']],
      code: {
        ekle: [
          'BArtiEkle(x)',
          '  koktan baslayip anahtarlara gore dogru yapraga in',
          '  x yapraga SIRALI eklenir',
          '  if (yaprakta L veri var)           // en fazla L-1',
          '     sola floor(L/2) en kucuk, saga kalanlar',
          '     sagdakinin en kucugu yukari KOPYALANIR',
          '  while (ic dugumde M anahtar var)   // en fazla M-1',
          '     sola ceil(M/2)-1 anahtar, siradaki yukari TASINIR',
          '     kalanlar saga; kok bolunurse yeni kok olusur',
        ],
        sil: [
          'BArtiSil(x)',
          '  dogru yapraga in, x yapraktan silinir',
          '  anahtarlar = sag alt agacin en kucugu olacak sekilde guncellenir',
          '  if (yaprak en azin altina dustu)   // en az ceil(L/2)-1',
          '     sag kardesle (en sagdaysa sol) BIRLESTIR-BOL',
          '     yetmiyorsa iki yaprak BIRLESTIRILIR, ustteki anahtar silinir',
          '  ic dugum en azin altina duserse ayni mantik yukari',
          '  kokun tek cocugu kalirsa o cocuk yeni kok olur',
        ],
        ara: ['BArtiAra(x)', '  d = kok', '  while (d yaprak degil)', '     x >= anahtar[i] olan en sagdaki i; d = cocuk[i+1]', '  yaprakta x var mi?'],
      },
      codeTitles: { ekle: 'B+ ekleme', sil: 'B+ silme', ara: 'B+ arama' },
    });
    const minOf = (n) => (n.leaf ? n.keys[0] : minOf(n.kids[0]));
    // anahtar = sağdaki alt ağacın en küçüğü; silme sırasında yaprak bir an boş kalırsa eski anahtar korunur
    const fixKeys = (n) => {
      if (n.leaf) return;
      n.kids.forEach(fixKeys);
      const old = n.keys || [];
      n.keys = n.kids.slice(1).map((c, i) => minOf(c) || old[i] || { id: 'bos' + ++nid, t: '∅' });
    };
    const depth = (n) => (n.leaf ? 0 : 1 + depth(n.kids[0]));
    function scene(mk, cellMk) {
      mk = mk || {};
      cellMk = cellMk || {};
      fixKeys(root);
      const all = [];
      const collect = (n) => (n.leaf ? n.keys.forEach((k) => all.push(k)) : n.kids.forEach(collect));
      collect(root);
      const cw = Math.max(34, ...all.map((k) => String(k.t).length * 9.6 + 14));
      const nodes = [];
      const edges = [];
      const dpt = depth(root);
      let x = 0;
      const place = (n, lv) => {
        const cnt = Math.max(1, n.keys.length);
        const w = cnt * cw;
        let cx;
        if (n.leaf) {
          cx = x + w / 2;
          x += w + 18;
        } else {
          const cs = n.kids.map((k) => place(k, lv + 1));
          cx = (cs[0] + cs[cs.length - 1]) / 2;
          n.kids.forEach((k, i) => edges.push({ a: n.id, b: k.id, dx: -w / 2 + Math.min(i, cnt) * cw * (cnt ? 1 : 0) + (n.keys.length ? 0 : w / 2), fromBottom: 17, cls: mk['e' + k.id] || '' }));
        }
        const cells = n.keys.length ? n.keys.map((k) => ({ t: k.t, cls: cellMk[k.id] || '' })) : [{ t: '∅', cls: '' }];
        nodes.push({ id: n.id, x: cx, y: lv * 82, w, cw, cells, cls: (mk[n.id] || '') + (n.leaf ? ' leaf' : ' inner') });
        return cx;
      };
      place(root, 0);
      void dpt;
      return { nodes, edges, minW: 240 };
    }
    const snap = (msg, line, mk, cellMk) => frames.push({ scene: scene(mk, cellMk), msg, line, code, st: { m: M, l: L, h: depth(root) } });
    const pathMk = (path, extra) => {
      const mk = {};
      path.forEach((n) => {
        mk[n.id] = 'cmp';
        mk['e' + n.id] = 'path';
      });
      return Object.assign(mk, extra || {});
    };
    const childIdx = (n, x) => {
      let i = 0;
      while (i < n.keys.length && C(x, n.keys[i]) >= 0) i++;
      return i;
    };
    function descend(x, line) {
      const path = [];
      let d = root;
      while (!d.leaf) {
        path.push(d);
        fixKeys(root);
        const i = childIdx(d, x);
        const why = d.keys.length ? (i === 0 ? `${esc(x.t)} < ${esc(d.keys[0].t)}` : `${esc(x.t)} ≥ ${esc(d.keys[i - 1].t)}`) : '';
        snap(`İç düğüm [${d.keys.map((k) => esc(k.t)).join(' | ')}]: ${why} → ${i + 1}. çocuğa in.`, line, pathMk(path));
        d = d.kids[i];
      }
      path.push(d);
      return path;
    }
    const has = (leaf, x) => leaf.keys.findIndex((k) => C(k, x) === 0);

    function insert(x) {
      code = 'ekle';
      const path = descend(x, 2);
      const leaf = path[path.length - 1];
      if (has(leaf, x) >= 0) {
        snap(`${tag(x)} zaten ağaçta (her veriden bir tane varsayımı).`, 3, pathMk(path, { [leaf.id]: 'done' }));
        return;
      }
      let i = 0;
      while (i < leaf.keys.length && C(leaf.keys[i], x) < 0) i++;
      leaf.keys.splice(i, 0, x);
      if (leaf.keys.length <= L - 1) {
        snap(`${tag(x)} yaprağa sıralı eklendi (yaprakta boş yer vardı).`, 3, { [leaf.id]: 'new' }, { [x.id]: 'new' });
        return;
      }
      snap(`${tag(x)} eklenince yaprakta ${leaf.keys.length} veri oldu (en fazla L−1 = ${L - 1}) → yaprak <b>bölünür</b>.`, [3, 4], { [leaf.id]: 'del' }, { [x.id]: 'new' });
      const k = Math.floor(L / 2);
      const right = { id: 'b' + ++nid, leaf: true, keys: leaf.keys.splice(k) };
      let child = leaf,
        sib = right,
        lvl = path.length - 2;
      const upKey = right.keys[0];
      insertUp(child, sib, lvl, path);
      snap(`Sola ${k} en küçük (${leaf.keys.map((z) => esc(z.t)).join(', ')}), sağa ${right.keys.length} (${right.keys.map((z) => esc(z.t)).join(', ')}); sağdakinin en küçüğü ${tag(upKey)} yukarı <b>kopyalandı</b>.`, [5, 6], { [leaf.id]: 'new', [right.id]: 'new' }, { [upKey.id]: 'new' });
      // iç düğüm taşmaları
      for (let lv = path.length - 2; lv >= 0; lv--) {
        const n = path[lv];
        if (n.kids.length <= M) break;
        fixKeys(root);
        snap(`İç düğümde ${n.kids.length - 1} anahtar oldu (en fazla M−1 = ${M - 1}) → iç düğüm <b>bölünür</b>.`, 7, { [n.id]: 'del' });
        const lk = Math.ceil(M / 2);
        const r = { id: 'b' + ++nid, leaf: false, kids: n.kids.splice(lk), keys: [] };
        const moved = minOf(r);
        insertUp(n, r, lv - 1, path);
        fixKeys(root);
        snap(`Sola ${lk - 1} anahtar, ${tag(moved)} yukarı <b>taşındı</b>, kalanlar sağa.${lv === 0 ? ' Kök bölündüğü için yeni kök oluştu.' : ''}`, [8, 9], { [n.id]: 'new', [r.id]: 'new' }, { [moved.id]: 'new' });
      }
    }
    function insertUp(left, right, lv, path) {
      if (lv < 0) {
        root = { id: 'b' + ++nid, leaf: false, kids: [left, right], keys: [] };
        path.unshift(root);
        return;
      }
      const par = path[lv];
      par.kids.splice(par.kids.indexOf(left) + 1, 0, right);
    }
    function search(x) {
      code = 'ara';
      const path = descend(x, [3, 4]);
      const leaf = path[path.length - 1];
      const i = has(leaf, x);
      if (i >= 0) snap(`Yaprakta ${tag(x)} <b>bulundu</b> (${path.length} düğüm gezildi: O(log n)).`, 5, pathMk(path, { [leaf.id]: 'done' }), { [x.id]: 'done', [leaf.keys[i].id]: 'done' });
      else snap(`Yaprakta ${tag(x)} <b>yok</b>.`, 5, pathMk(path));
    }
    function remove(x) {
      code = 'sil';
      const path = descend(x, 2);
      const leaf = path[path.length - 1];
      const i = has(leaf, x);
      if (i < 0) {
        snap(`${tag(x)} ağaçta yok.`, 2, pathMk(path));
        return;
      }
      snap(`${tag(x)} yaprakta bulundu.`, 2, pathMk(path), { [leaf.keys[i].id]: 'del' });
      leaf.keys.splice(i, 1);
      snap(`${tag(x)} yapraktan silindi; anahtarlar sağ alt ağacın en küçüğüne göre güncellendi.`, [2, 3], { [leaf.id]: 'new' });
      let n = leaf;
      for (let lv = path.length - 2; lv >= 0; lv--) {
        const par = path[lv];
        const isLeaf = n.leaf;
        const cnt = isLeaf ? n.keys.length : n.kids.length;
        const min = isLeaf ? minLeaf() : minKids();
        if (cnt >= min) break;
        const idx = par.kids.indexOf(n);
        const sIdx = idx < par.kids.length - 1 ? idx + 1 : idx - 1;
        const sib = par.kids[sIdx];
        const [a, b] = sIdx > idx ? [n, sib] : [sib, n];
        const what = isLeaf ? `yaprakta ${cnt} veri kaldı (en az ⌈L/2⌉−1 = ${min})` : `iç düğümde ${cnt - 1} anahtar kaldı (en az ⌈M/2⌉−1 = ${min - 1})`;
        snap(`${what} → ${sIdx > idx ? 'sağ' : 'sol'} kardeşle düzeltilir.`, isLeaf ? 4 : 7, { [n.id]: 'del', [sib.id]: 'cmp' });
        const pool = isLeaf ? a.keys.concat(b.keys) : a.kids.concat(b.kids);
        if (pool.length >= 2 * min) {
          const h = Math.floor(pool.length / 2);
          if (isLeaf) {
            a.keys = pool.slice(0, h);
            b.keys = pool.slice(h);
          } else {
            a.kids = pool.slice(0, h);
            b.kids = pool.slice(h);
          }
          snap(`<b>Birleştir–böl:</b> iki ${isLeaf ? 'yaprağın verileri' : 'düğümün çocukları'} yeniden paylaştırıldı; üstteki anahtar güncellendi.`, isLeaf ? 5 : 7, { [a.id]: 'new', [b.id]: 'new' });
          break;
        }
        if (isLeaf) a.keys = pool;
        else a.kids = pool;
        par.kids.splice(par.kids.indexOf(b), 1);
        snap(`Paylaştırma yetmiyor → iki ${isLeaf ? 'yaprak' : 'iç düğüm'} <b>birleştirildi</b>, üstteki anahtar silindi.`, isLeaf ? 6 : 7, { [a.id]: 'new', [par.id]: 'cmp' });
        n = par;
      }
      if (!root.leaf && root.kids.length === 1) {
        root = root.kids[0];
        snap('Kökün tek çocuğu kaldı → o çocuk yeni kök oldu (yükseklik bir azaldı).', 8, { [root.id]: 'new' });
      }
    }
    const run = (ops, autoplay) => {
      frames = [];
      ops.forEach(([op, x]) => (op === 'ekle' ? insert(x) : op === 'sil' ? remove(x) : search(x)));
      if (!frames.length) snap(`Boş B+ ağacı (M = ${M}, L = ${L}). Yaprakta en fazla ${L - 1}, en az ${minLeaf()} veri; iç düğümde en fazla ${M - 1}, en az ${minKids() - 1} anahtar.`, []);
      P.load(frames, autoplay);
    };
    const vals = (s) => V.parse(s, 30);
    V.opsRow(P, 'Değer', 'ör. K  ya da  K, L, M', '', [
      ['Ekle', (v, inp) => vals(v).length && (run(vals(v).map((x) => ['ekle', x]), true), (inp.value = ''))],
      ['Sil', (v, inp) => vals(v).length && (run(vals(v).map((x) => ['sil', x]), true), (inp.value = ''))],
      ['Ara', (v) => vals(v).length && run([['ara', vals(v)[0]]], true)],
    ]);
    const mIn = V.opsRow(P, 'M, L', 'ör. 4, 4', 'M: iç düğüm çocuk sayısı · L: yaprak parametresi (yaprakta en fazla L−1 veri)', [
      [
        'Uygula ve sıfırla',
        (v) => {
          const [m, l] = String(v).split(/[,\s]+/).map(Number);
          if (m >= 3 && m <= 7) M = m;
          L = l >= 3 && l <= 7 ? l : M;
          root = { id: 'b' + ++nid, leaf: true, keys: [] };
          run([], false);
        },
      ],
    ]);
    mIn.value = '4, 4';
    V.btnRow(P, 'Hazır', [
      [
        'Ders örneği',
        () => {
          M = 4;
          L = 4;
          mIn.value = '4, 4';
          root = { id: 'b' + ++nid, leaf: true, keys: [] };
          run(vals(init).map((x) => ['ekle', x]).concat([['sil', V.item('N')], ['sil', V.item('O')]]), true);
        },
        'primary-soft',
        'K…T ekle, N ve O sil (M = L = 4)',
      ],
      [
        'Boşalt',
        () => {
          root = { id: 'b' + ++nid, leaf: true, keys: [] };
          run([], false);
        },
      ],
    ]);
    run(vals(init).map((x) => ['ekle', x]), false);
  };
})();

/* Veri yapıları: bağlantılı liste, yığın, dairesel kuyruk, postfix hesaplama, doğrusal/ikili arama, graf (BFS/DFS). */
(function () {
  'use strict';
  const V = window.BZV;
  const { esc, tag } = V;
  const C = (a, b) => V.cmp(a, b);

  // ============================================================ bağlantılı liste
  V.reg.liste = (box, init) => {
    let list = V.parse(init || '34,12,52,16,12', 12);
    let frames = [];
    let code = 'ins';
    const P = new V.Player(box, {
      stats: [['n', 'Düğüm sayısı'], ['g', 'Gezilen düğüm']],
      legend: [['cmp', 'currNode'], ['prev', 'prevNode'], ['new', 'newNode'], ['del', 'Silinen'], ['done', 'Bulunan']],
      stageClass: 'll-stage',
      code: {
        ins: [
          'Node* InsertNode(int index, double x)',
          '  if (index < 0) return NULL',
          '  currIndex = 1;  currNode = head',
          '  while (currNode && index > currIndex)',
          '     currNode = currNode->next;  currIndex++',
          '  if (index > 0 && currNode == NULL) return NULL',
          '  newNode = new Node;  newNode->data = x',
          '  if (index == 0)                          // basa ekle',
          '     newNode->next = head;  head = newNode',
          "  else                                     // currNode'dan sonra",
          '     newNode->next = currNode->next       // ONCE bu',
          '     currNode->next = newNode             // SONRA bu',
          '  return newNode',
        ],
        find: [
          'int FindNode(double x)',
          '  currNode = head;  currIndex = 1',
          '  while (currNode && currNode->data != x)',
          '     currNode = currNode->next;  currIndex++',
          '  if (currNode) return currIndex',
          '  return 0                                 // bulunamadi',
        ],
        del: [
          'int DeleteNode(double x)',
          '  prevNode = NULL;  currNode = head;  currIndex = 1',
          '  while (currNode && currNode->data != x)',
          '     prevNode = currNode;  currNode = currNode->next;  currIndex++',
          '  if (currNode)',
          '     if (prevNode) prevNode->next = currNode->next   // aradan cikar',
          '     else          head = currNode->next             // bastaki silindi',
          '     delete currNode;  return currIndex',
          '  return 0',
        ],
        disp: [
          'void DisplayList()',
          '  num = 0;  currNode = head',
          '  while (currNode != NULL)',
          '     cout << currNode->data',
          '     currNode = currNode->next;  num++',
          '  cout << "Dugum sayisi: " << num',
        ],
      },
      codeTitles: { ins: 'InsertNode', find: 'FindNode', del: 'DeleteNode', disp: 'DisplayList' },
      render(f, dur) {
        const nodes = f.nodes
          .map((it, i) => {
            const tags = [];
            if (f.cur === i) tags.push('currNode');
            if (f.prev === i) tags.push('prevNode');
            const cls = f.mk[it.id] || (f.cur === i ? 'cmp' : f.prev === i ? 'prev' : '');
            return `<div class="ll-node ${cls}" data-k="${it.id}"><span class="d">${esc(it.t)}</span><span class="p"></span><em>${i + 1}</em>${tags.length ? `<b class="tg">${tags.join(' · ')}</b>` : ''}</div><span class="ll-ar">→</span>`;
          })
          .join('');
        const nul = `<div class="ll-null${f.cur === -2 ? ' cmp' : ''}">NULL${f.cur === -2 ? '<b class="tg">currNode</b>' : ''}</div>`;
        let lane = '';
        if (f.nw) {
          const nx = f.nw.next === undefined ? '?' : f.nw.next === null ? 'NULL' : esc(f.nw.next);
          lane = `<div class="ll-lane"><div class="ll-node new" data-k="${f.nw.it.id}"><span class="d">${esc(f.nw.it.t)}</span><span class="p"></span><b class="tg">newNode</b></div><span class="ll-nx">next → ${nx}</span></div>`;
        }
        const out = f.out && f.out.length ? `<div class="ll-out"><span>Ekran:</span>${f.out.map((t) => `<b>${esc(t)}</b>`).join('')}</div>` : '';
        V.flip(
          P.stage,
          `<div class="ll-row"><div class="ll-head">head</div><span class="ll-ar">→</span>${nodes}${nul}</div>${lane}<div class="ll-vars">${f.vars || ''}</div>${out}`,
          dur
        );
      },
    });
    const snap = (msg, line, o) =>
      frames.push(Object.assign({ nodes: list.slice(), cur: -1, prev: -1, mk: {}, msg, line, code, st: { n: list.length, g: o && o.g != null ? o.g : 0 } }, o || {}));
    function insertNode(index, it) {
      code = 'ins';
      if (index < 0) return snap('index < 0 → NULL döner.', 2);
      let ci = 1,
        cur = list.length ? 0 : -2;
      snap(`InsertNode(${index}, ${esc(it.t)}): ${index === 0 ? 'başa eklenecek.' : `${index}. düğümden sonra eklenecek.`}`, 3, { cur, vars: `index = ${index} · currIndex = ${ci}` });
      let g = list.length ? 1 : 0;
      while (cur >= 0 && index > ci) {
        cur = cur + 1 < list.length ? cur + 1 : -2;
        ci++;
        if (cur >= 0) g++;
        snap(`index (${index}) > currIndex → bir sonraki düğüme geç.`, [4, 5], { cur, vars: `index = ${index} · currIndex = ${ci}`, g });
      }
      if (index > 0 && cur < 0) return snap(`currNode = NULL → listede ${index}. düğüm yok, NULL döner.`, 6, { cur, g });
      const nw = { it, next: undefined };
      snap(`Yeni düğüm oluşturuldu: newNode->data = ${tag(it)}.`, 7, { cur: index === 0 ? -1 : cur, nw, vars: `index = ${index} · currIndex = ${ci}`, g });
      if (index === 0) {
        nw.next = list.length ? list[0].t : null;
        snap(`newNode->next = head (${list.length ? esc(list[0].t) : 'NULL'}).`, 9, { nw: { it, next: nw.next }, g });
        list.unshift(it);
        snap(`head = newNode → ${tag(it)} listenin başına eklendi. Sabit iş: O(1).`, 9, { mk: { [it.id]: 'new' }, g });
      } else {
        const nx = cur + 1 < list.length ? list[cur + 1].t : null;
        snap(`ÖNCE newNode->next = currNode->next (${nx === null ? 'NULL' : esc(nx)}).`, 11, { cur, nw: { it, next: nx }, g });
        list.splice(cur + 1, 0, it);
        snap(`SONRA currNode->next = newNode → ${tag(it)} ${esc(list[cur].t)}'${V.eks(list[cur].t, 'den')} sonra bağlandı.`, 12, { cur, mk: { [it.id]: 'new' }, g });
      }
      snap(`newNode döner. Toplam ${g} düğüm gezildi.`, 13, { mk: { [it.id]: 'new' }, g });
    }
    function findNode(it, del) {
      code = del ? 'del' : 'find';
      let cur = list.length ? 0 : -2,
        prev = -1,
        ci = 1,
        g = list.length ? 1 : 0;
      snap(`${del ? 'DeleteNode' : 'FindNode'}(${esc(it.t)}): baştan başlanır.`, 2, { cur, prev, vars: `currIndex = ${ci}`, g });
      while (cur >= 0 && C(list[cur], it) !== 0) {
        snap(`${tag(list[cur])} ≠ ${tag(it)} → ${del ? 'prevNode = currNode, ' : ''}sonraki düğüm.`, del ? [3, 4] : [3, 4], { cur, prev, vars: `currIndex = ${ci}`, g });
        prev = del ? cur : -1;
        cur = cur + 1 < list.length ? cur + 1 : -2;
        ci++;
        if (cur >= 0) g++;
      }
      if (cur < 0) return snap(`currNode = NULL → ${tag(it)} listede yok, 0 döner (${g} düğüm gezildi).`, del ? 9 : 6, { cur, prev, vars: `currIndex = ${ci}`, g }), null;
      if (!del) return snap(`${tag(it)} bulundu → currIndex = <b>${ci}</b> döner.`, 5, { mk: { [list[cur].id]: 'done' }, vars: `currIndex = ${ci}`, g }), cur;
      const d = list[cur];
      snap(`${tag(d)} bulundu (currIndex = ${ci}).`, 5, { cur, prev, mk: { [d.id]: 'del' }, vars: `currIndex = ${ci}`, g });
      if (prev >= 0) snap(`prevNode->next = currNode->next → ${esc(list[prev].t)} artık ${cur + 1 < list.length ? esc(list[cur + 1].t) : 'NULL'}'${V.eks(cur + 1 < list.length ? list[cur + 1].t : 'NULL', 'i')} gösterir.`, 6, { cur, prev, mk: { [d.id]: 'del' }, g });
      else snap(`Baştaki düğüm siliniyor → head = currNode->next (${cur + 1 < list.length ? esc(list[cur + 1].t) : 'NULL'}).`, 7, { cur, mk: { [d.id]: 'del' }, g });
      list.splice(cur, 1);
      snap(`delete currNode → ${tag(d)} silindi, ${ci} döner.`, 8, { g });
      return cur;
    }
    function display() {
      code = 'disp';
      const out = [];
      let cur = list.length ? 0 : -2;
      snap('num = 0; currNode = head', 2, { cur, out: [], vars: 'num = 0' });
      while (cur >= 0) {
        out.push(list[cur].t);
        snap(`Ekrana yaz: ${tag(list[cur])}`, 4, { cur, out: out.slice(), vars: `num = ${out.length - 1}`, g: out.length });
        cur = cur + 1 < list.length ? cur + 1 : -2;
      }
      snap(`currNode = NULL → döngü bitti. Düğüm sayısı: ${out.length}. Her düğüm bir kez: Θ(n).`, 6, { cur, out, vars: `num = ${out.length}`, g: out.length });
    }
    const run = (fn, auto) => {
      frames = [];
      fn();
      P.load(frames, auto !== false);
    };
    const idxIn = { value: '' };
    const valIn = V.opsRow(P, 'Değer', 'ör. 40', '', [
      [
        'InsertNode',
        (v) => {
          const it = V.parse(v, 1)[0] || V.item(String(V.rnd(1, 1, 99)[0]));
          const k = parseInt(idxIn.value, 10);
          if (list.length >= 12) return P.say('Liste en fazla 12 düğüm gösterir.');
          run(() => insertNode(isNaN(k) ? list.length : k, it));
          valIn.value = '';
        },
        'primary',
      ],
      ['FindNode', (v) => V.parse(v, 1).length && run(() => findNode(V.parse(v, 1)[0], false))],
      ['DeleteNode', (v) => V.parse(v, 1).length && run(() => findNode(V.parse(v, 1)[0], true))],
      ['DisplayList', () => run(display)],
    ]);
    const row = valIn.parentNode;
    const lab = V.el('span', 'viz-lbl', 'index');
    const ix = V.el('input', 'viz-in sm');
    ix.type = 'number';
    ix.min = 0;
    ix.placeholder = 'son';
    ix.title = 'InsertNode için: kaçıncı düğümden sonra (0 = başa)';
    valIn.after(lab, ix);
    Object.defineProperty(idxIn, 'value', { get: () => ix.value });
    V.btnRow(P, 'Hazır', [
      ['Slayt örneği', () => ((list = V.parse('34,12,52,16,12')), run(() => insertNode(3, V.item('40')))), 'primary-soft', 'insert(3, x): 3. veriden sonra ekle'],
      ['Başa ekle', () => run(() => insertNode(0, V.item(String(V.rnd(1, 1, 99)[0])))), '', 'O(1)'],
      ['Sona ekle', () => run(() => insertNode(list.length, V.item(String(V.rnd(1, 1, 99)[0])))), '', 'En kötü durum: O(n)'],
    ]);
    frames = [];
    snap('Bağlantılı liste: her düğüm veri ve bir sonraki düğümün adresini (next) tutar. Son düğümün next\'i NULL.', [], {});
    P.load(frames, false);
  };

  // ============================================================ yığın (dizi ile)
  V.reg.yigin = (box, init) => {
    const size = Math.max(3, Math.min(8, parseInt(init, 10) || 5));
    let vals = new Array(size).fill(null);
    let top = -1;
    let out = [];
    let frames = [];
    const P = new V.Player(box, {
      stats: [['top', 'top'], ['max', 'maxTop']],
      legend: [['new', 'Eklenen'], ['cmp', 'Tepedeki'], ['del', 'Çıkarılan']],
      stageClass: 'st-stage',
      code: {
        main: [
          'double Push(const double x)',
          '  if (IsFull()) { cout << "Yigin dolu"; return -1; }   // top == maxTop',
          '  values[++top] = x;        // once top artar, sonra yazilir',
          '  return x',
          'double Pop()',
          '  if (IsEmpty()) { cout << "Yigin bos"; return -1; }   // top == -1',
          '  return values[top--];     // once okunur, sonra top azalir',
          'double Top()',
          '  if (IsEmpty()) return -1',
          '  return values[top]',
        ],
      },
      render(f, dur) {
        let col = '';
        for (let i = size - 1; i >= 0; i--) {
          const it = f.vals[i];
          const cls = it ? f.mk[it.id] || (i === f.top ? 'cmp' : '') : '';
          col += `<div class="st-row"><span class="st-i">${i}</span><div class="st-cell${i > f.top ? ' free' : ''}">${it && i <= f.top ? `<div class="cell array ${cls}" data-k="${it.id}"><span>${esc(it.t)}</span></div>` : ''}</div><span class="st-p">${i === f.top ? '← top' : ''}</span></div>`;
        }
        col += `<div class="st-row"><span class="st-i"></span><div class="st-floor">${f.top === -1 ? 'top = −1 (boş)' : ''}</div><span></span></div>`;
        const outH = `<div class="st-out"><span>Çıkanlar (pop):</span>${f.out.map((it) => `<div class="cell array del" data-k="${it.id}"><span>${esc(it.t)}</span></div>`).join('') || '<em>—</em>'}</div>`;
        V.flip(P.stage, `<div class="st-col">${col}</div>${outH}`, dur);
      },
    });
    const snap = (msg, line, mk) => frames.push({ vals: vals.slice(), top, out: out.slice(), mk: mk || {}, msg, line, st: { top, max: size - 1 } });
    const run = (fn) => {
      frames = [];
      fn();
      P.load(frames, true);
    };
    const push = (it) => {
      snap(`Push(${esc(it.t)}): IsFull? top = ${top}, maxTop = ${size - 1} → ${top === size - 1 ? 'evet' : 'hayır'}`, 2);
      if (top === size - 1) return snap('<b>Yığın dolu</b> → −1 döner (eleman eklenmez).', 2);
      top++;
      vals[top] = it;
      snap(`++top → top = ${top}; values[${top}] = ${tag(it)}.`, 3, { [it.id]: 'new' });
    };
    const pop = () => {
      snap(`Pop(): IsEmpty? top = ${top} → ${top === -1 ? 'evet' : 'hayır'}`, 6);
      if (top === -1) return snap('<b>Yığın boş</b> → −1 döner.', 6);
      const it = vals[top];
      snap(`values[${top}] = ${tag(it)} okunur…`, 7, { [it.id]: 'del' });
      vals[top] = null;
      top--;
      out.push(it);
      snap(`…sonra top-- → top = ${top}. ${tag(it)} döndü (son giren ilk çıkar).`, 7);
    };
    const inp = V.opsRow(P, 'Değer', 'ör. 7', 'Boş bırakılırsa rastgele sayı', [
      ['Push', (v) => run(() => push(V.parse(v, 1)[0] || V.item(String(V.rnd(1, 1, 99)[0]))) || (inp.value = '')), 'primary'],
      ['Pop', () => run(pop)],
      [
        'Top',
        () =>
          run(() =>
            top === -1 ? snap('Top(): yığın boş → −1.', 9) : snap(`Top(): tepedeki ${tag(vals[top])} silinmeden gösterilir.`, 10, { [vals[top].id]: 'cmp' })
          ),
      ],
    ]);
    V.btnRow(P, 'Hazır', [
      ['Doldur', () => run(() => { for (let k = top; k < size; k++) push(V.item(String(V.rnd(1, 1, 99)[0]))); }), '', 'Dolu yığına push denemesi dahil'],
      ['Boşalt', () => run(() => { for (let k = top; k >= -1; k--) pop(); }), '', 'Boş yığından pop denemesi dahil'],
    ]);
    frames = [];
    snap(`Dizi ile yığın: boyut ${size}, maxTop = ${size - 1}. Boş yığında top = −1.`, []);
    P.load(frames, false);
  };

  // ============================================================ dairesel kuyruk (dizi ile)
  V.reg.kuyruk = (box, init) => {
    const size = Math.max(3, Math.min(8, parseInt(init, 10) || 5));
    let vals = new Array(size).fill(null);
    let front = 0,
      rear = -1,
      counter = 0;
    let out = [];
    let frames = [];
    const P = new V.Player(box, {
      stats: [['front', 'front'], ['rear', 'rear'], ['counter', 'counter']],
      legend: [['new', 'Eklenen'], ['del', 'Çıkarılan'], ['ghost', 'Eski veri (mantıken boş)']],
      stageClass: 'q-stage',
      code: {
        main: [
          'bool Enqueue(double x)',
          '  if (IsFull()) { cout << "Kuyruk dolu"; return false; }   // counter >= maxSize',
          '  rear = (rear + 1) % maxSize;       // dairesel ilerleme',
          '  values[rear] = x;  counter++',
          '  return true',
          'bool Dequeue(double& x)',
          '  if (IsEmpty()) { cout << "Kuyruk bos"; return false; }   // counter == 0',
          '  x = values[front]',
          '  front = (front + 1) % maxSize',
          '  counter--',
          '  return true',
        ],
      },
      render(f, dur) {
        const live = new Set();
        for (let k = 0; k < f.counter; k++) live.add((f.front + k) % size);
        const cells = f.vals
          .map((it, i) => {
            const tags = [];
            if (i === f.front) tags.push('front');
            if (i === f.rear) tags.push('rear');
            let c = '';
            if (it) c = live.has(i) ? `<div class="cell array ${f.mk[it.id] || ''}" data-k="${it.id}"><span>${esc(it.t)}</span></div>` : `<div class="cell array ghost" data-k="g${it.id}"><span>${esc(it.t)}</span></div>`;
            return `<div class="slot q"><div class="q-cell${live.has(i) ? ' live' : ''}">${c}</div><span class="ix">${i}${tags.length ? `<em>${tags.join(', ')}</em>` : ''}</span></div>`;
          })
          .join('');
        const outH = `<div class="st-out"><span>Çıkanlar (dequeue):</span>${f.out.map((it) => `<div class="cell array del" data-k="${it.id}"><span>${esc(it.t)}</span></div>`).join('') || '<em>—</em>'}</div>`;
        V.flip(P.stage, `<div class="arr array q-arr" style="--n:${size}">${cells}</div><p class="q-note">rear = −1 başlangıçta; indisler <code>% maxSize</code> ile başa döner (maxSize = ${size}).</p>${outH}`, dur);
      },
    });
    const snap = (msg, line, mk) => frames.push({ vals: vals.slice(), front, rear, counter, out: out.slice(), mk: mk || {}, msg, line, st: { front, rear, counter } });
    const run = (fn) => {
      frames = [];
      fn();
      P.load(frames, true);
    };
    const enq = (it) => {
      snap(`Enqueue(${esc(it.t)}): IsFull? counter = ${counter}, maxSize = ${size} → ${counter >= size ? 'evet' : 'hayır'}`, 2);
      if (counter >= size) return snap('<b>Kuyruk dolu</b> → false.', 2);
      const old = rear;
      rear = (rear + 1) % size;
      snap(`rear = (${old} + 1) % ${size} = <b>${rear}</b>${old === size - 1 ? ' → dizinin başına döndü (dairesel)' : ''}.`, 3);
      vals[rear] = it;
      counter++;
      snap(`values[${rear}] = ${tag(it)}; counter = ${counter}.`, 4, { [it.id]: 'new' });
    };
    const deq = () => {
      snap(`Dequeue(): IsEmpty? counter = ${counter} → ${counter === 0 ? 'evet' : 'hayır'}`, 7);
      if (counter === 0) return snap('<b>Kuyruk boş</b> → false.', 7);
      const it = vals[front];
      snap(`x = values[${front}] = ${tag(it)} (ilk giren ilk çıkar).`, 8, { [it.id]: 'del' });
      const old = front;
      front = (front + 1) % size;
      counter--;
      out.push(it);
      snap(`front = (${old} + 1) % ${size} = <b>${front}</b>; counter = ${counter}. Eleman kaydırılmaz: O(1).`, [9, 10]);
    };
    const inp = V.opsRow(P, 'Değer', 'ör. 7', 'Boş bırakılırsa rastgele sayı', [
      ['Enqueue', (v) => run(() => enq(V.parse(v, 1)[0] || V.item(String(V.rnd(1, 1, 99)[0])))) || (inp.value = ''), 'primary'],
      ['Dequeue', () => run(deq)],
    ]);
    V.btnRow(P, 'Hazır', [
      [
        'Dairesellik örneği',
        () =>
          run(() => {
            for (let k = 0; k < size - 1; k++) enq(V.item(String(10 * (k + 1))));
            deq();
            deq();
            enq(V.item('77'));
            enq(V.item('88'));
          }),
        'primary-soft',
        'Doldur, ikisini çıkar, iki ekle: rear başa döner',
      ],
    ]);
    frames = [];
    snap(`Dizi ile dairesel kuyruk: maxSize = ${size}, front = 0, rear = −1, counter = 0.`, []);
    P.load(frames, false);
  };

  // ============================================================ postfix hesaplama
  V.reg.postfix = (box, init) => {
    let frames = [];
    const P = new V.Player(box, {
      stats: [['k', 'Okunan simge'], ['s', 'Yığındaki eleman']],
      legend: [['cmp', 'Okunan simge'], ['new', 'Push'], ['del', 'Pop']],
      stageClass: 'pf-stage',
      code: {
        main: [
          'PostfixHesapla(ifade)',
          '  S = bos yigin',
          '  for (her simge t, soldan saga)',
          '     if (t sayi) S.push(t)',
          '     else',
          '        b = S.pop()     // ilk cikan: SAG islenen',
          '        a = S.pop()     // ikinci cikan: SOL islenen',
          '        S.push(a t b)',
          '  Yaz(S.pop())',
        ],
      },
      render(f, dur) {
        const toks = f.toks.map((t, i) => `<span class="pf-t${i === f.k ? ' on' : i < f.k ? ' past' : ''}">${esc(t)}</span>`).join('');
        const st = f.S.map((it) => `<div class="cell array ${f.mk[it.id] || ''}" data-k="${it.id}"><span>${esc(it.t)}</span></div>`).join('');
        const pops = f.pop.map((it) => `<div class="cell array del" data-k="${it.id}"><span>${esc(it.t)}</span></div>`).join('');
        V.flip(
          P.stage,
          `<div class="pf-toks">${toks}</div><div class="pf-main"><div class="pf-stack"><span class="pf-l">Yığın (alt → tepe)</span><div class="pf-s">${st || '<em>boş</em>'}</div></div><div class="pf-pop"><span class="pf-l">Çıkanlar</span><div class="pf-s">${pops}</div></div></div>`,
          dur
        );
      },
    });
    const fmt = (x) => (Number.isInteger(x) ? String(x) : String(Math.round(x * 100) / 100));
    function run(expr, auto) {
      frames = [];
      const toks = String(expr).trim().split(/\s+/).filter(Boolean);
      let S = [],
        pop = [];
      const snap = (msg, line, k, mk) => frames.push({ toks, k, S: S.slice(), pop: pop.slice(), mk: mk || {}, msg, line, st: { k: Math.max(0, k + 1) + '/' + toks.length, s: S.length } });
      snap(`İfade soldan sağa okunur: sayı → push, işlem → iki pop + sonuç push.`, [1, 2], -1);
      for (let k = 0; k < toks.length; k++) {
        const t = toks[k];
        pop = [];
        if (/^-?\d+(\.\d+)?$/.test(t)) {
          const it = V.item(t);
          S.push(it);
          snap(`${tag(it)} sayı → push.`, 4, k, { [it.id]: 'new' });
          continue;
        }
        if (!/^[-+*/^x×÷]$/.test(t) || S.length < 2) {
          snap(`Hata: "${esc(t)}" için yığında iki sayı yok veya simge tanınmıyor.`, 5, k);
          return P.load(frames, auto);
        }
        const b = S.pop();
        pop = [b];
        snap(`${esc(t)} işlemi: b = pop() = ${tag(b)} (sağ işlenen).`, 6, k);
        const a = S.pop();
        pop = [b, a];
        snap(`a = pop() = ${tag(a)} (sol işlenen).`, 7, k);
        const x = a.n,
          y = b.n;
        const r = { '+': x + y, '-': x - y, '*': x * y, x: x * y, '×': x * y, '/': x / y, '÷': x / y, '^': Math.pow(x, y) }[t];
        const it = V.item(fmt(r));
        S.push(it);
        pop = [];
        snap(`${esc(a.t)} ${esc(t)} ${esc(b.t)} = ${tag(it)} → push.`, 8, k, { [it.id]: 'new' });
      }
      if (S.length === 1) snap(`İfade bitti → sonuç: <b>${esc(S[0].t)}</b>`, 9, toks.length);
      else snap(`İfade bitti ama yığında ${S.length} eleman var: ifade hatalı.`, 9, toks.length);
      P.load(frames, auto);
    }
    V.opsRow(P, 'Sonek ifade', 'ör. 5 6 8 * + 7 6 2 / - 3 * -', 'Simgeler boşlukla ayrılır', [['Hesapla', (v) => v.trim() && run(v, true)]], init);
    run(init || '5 6 8 * + 7 6 2 / - 3 * -', false);
  };

  // ============================================================ doğrusal ve ikili arama
  V.reg.arama = (box, init) => {
    let arr = V.parse(init || '3,8,12,17,21,25,30,34,41,47,52,58,63,70,77', 16).sort(C);
    let frames = [];
    let mode = 'ikili';
    const P = new V.Player(box, {
      stats: [['cmp', 'Karşılaştırma'], ['lim', 'Üst sınır']],
      legend: [['cmp', 'Bakılan (orta)'], ['done', 'Bulundu'], ['out', 'Elenen']],
      code: {
        dogrusal: ['DogrusalAra(D, n, x)', '  for (i = 0; i < n; i++)', '     if (D[i] == x)', '        return i', '  return -1          // bulunamadi'],
        ikili: [
          'IkiliAra(D, n, x)',
          '  ilk = 0;  son = n - 1',
          '  while (ilk <= son)',
          '     orta = (ilk + son) / 2',
          '     if (D[orta] == x) return orta',
          '     if (x < D[orta]) son = orta - 1',
          '     else             ilk = orta + 1',
          '  return -1',
        ],
      },
      codeTitles: { dogrusal: 'Doğrusal arama · O(n)', ikili: 'İkili arama · O(log n)' },
      render(f, dur) {
        V.flip(P.stage, V.arrHTML(f, 'array'), dur);
      },
    });
    function run(x, auto) {
      frames = [];
      const n = arr.length;
      const st = { cmp: 0, lim: mode === 'ikili' ? `⌊log₂${n}⌋+1 = ${Math.floor(Math.log2(n)) + 1}` : `n = ${n}` };
      const snap = (msg, line, o) => frames.push(Object.assign({ a: arr.slice(), msg, line, code: mode, st: Object.assign({}, st) }, o));
      if (mode === 'dogrusal') {
        snap(`Doğrusal arama: ${tag(x)} baştan sona tek tek aranır (dizinin sıralı olması gerekmez).`, 1, {});
        for (let i = 0; i < n; i++) {
          st.cmp++;
          const eq = C(arr[i], x) === 0;
          snap(`D[${i}] = ${tag(arr[i])} == ${tag(x)} ? → ${eq ? 'evet' : 'hayır'}`, eq ? [3, 4] : 3, { mk: { [i]: eq ? 'done' : 'cmp' }, ptr: { [i]: 'i' }, done: [] });
          if (eq) return snap(`<b>Bulundu</b>: indis ${i} (${st.cmp} karşılaştırma).`, 4, { mk: { [i]: 'done' } }), P.load(frames, auto);
        }
        snap(`Dizi bitti → ${tag(x)} yok, −1 döner (${st.cmp} karşılaştırma = n: en kötü durum).`, 5, {});
        return P.load(frames, auto);
      }
      let ilk = 0,
        son = n - 1;
      snap(`İkili arama (dizi sıralı): ilk = 0, son = ${n - 1}.`, 2, { range: [ilk, son], ptr: { 0: 'ilk', [n - 1]: 'son' } });
      while (ilk <= son) {
        const orta = (ilk + son) >> 1;
        const ptr = {};
        ptr[ilk] = 'ilk';
        ptr[son] = (ptr[son] ? ptr[son] + ',' : '') + 'son';
        ptr[orta] = (ptr[orta] ? ptr[orta] + ',' : '') + 'orta';
        st.cmp++;
        snap(`orta = (${ilk} + ${son}) / 2 = ${orta}; D[orta] = ${tag(arr[orta])} == ${tag(x)} ?`, [4, 5], { range: [ilk, son], mk: { [orta]: 'cmp' }, ptr });
        const c = C(x, arr[orta]);
        if (c === 0) {
          snap(`<b>Bulundu</b>: indis ${orta} (${st.cmp} karşılaştırma; ${n} elemanda en fazla ${Math.floor(Math.log2(n)) + 1}).`, 5, { range: [orta, orta], mk: { [orta]: 'done' }, ptr: { [orta]: 'orta' } });
          return P.load(frames, auto);
        }
        if (c < 0) son = orta - 1;
        else ilk = orta + 1;
        snap(`${tag(x)} ${c < 0 ? '<' : '>'} ${tag(arr[orta])} → ${c < 0 ? `sağ yarı elendi, son = ${son}` : `sol yarı elendi, ilk = ${ilk}`}.`, c < 0 ? 6 : 7, { range: [ilk, son], ptr: Object.assign({}, ilk < n ? { [ilk]: 'ilk' } : {}, son >= 0 ? { [son]: 'son' } : {}) });
      }
      snap(`ilk > son → ${tag(x)} yok, −1 döner (${st.cmp} karşılaştırma).`, 8, { range: [0, -1] });
      P.load(frames, auto);
    }
    const inp = V.opsRow(P, 'Aranan', 'ör. 41', '', [['Ara', (v) => V.parse(v, 1).length && run(V.parse(v, 1)[0], true), 'primary']]);
    V.btnRow(P, 'Yöntem', [
      ['İkili arama', (b) => ((mode = 'ikili'), seg(b), run(V.parse(inp.value || '41', 1)[0], true)), 'on'],
      ['Doğrusal arama', (b) => ((mode = 'dogrusal'), seg(b), run(V.parse(inp.value || '41', 1)[0], true))],
      ['Olmayan değer', () => run(V.item(String(arr[arr.length - 1].n + 1)), true), '', 'En kötü durum'],
      ['Yeni dizi', () => ((arr = V.rnd(15, 1, 99).sort((a, b) => a - b).map(String).map(V.item)), run(arr[V.rnd(1, 0, 14)[0]], true))],
    ]);
    const seg = (b) => b.parentNode.querySelectorAll('.viz-btn').forEach((x, i) => i < 2 && x.classList.toggle('on', x === b));
    inp.value = '41';
    run(V.item('41'), false);
  };

  // ============================================================ graf: BFS ve DFS (sonrakök)
  V.reg.graf = (box, init) => {
    let G = parseG(init || 'A-C,A-D,A-E,C-E,D-E,B');
    let mode = 'bfs';
    let order = 'onde';
    let start = G.nodes[0];
    let frames = [];
    const P = new V.Player(box, {
      stats: [['v', 'Ziyaret edilen'], ['e', 'Bakılan kenar']],
      legend: [['cmp', 'İşlenen düğüm'], ['new', 'Kuyrukta / yığında'], ['vis', 'Ziyaret edildi'], ['fin', 'Bitti (sonrakök)']],
      stageClass: 'g-stage',
      code: {
        bfs: [
          'BFS(G, s)',
          '  her u icin u.ziyaret = false',
          '  s.ziyaret = true;  Q.enqueue(s)',
          '  while (!Q.isEmpty())',
          '     u = Q.dequeue();  Yaz(u)',
          '     for (her komsu v, oncelik sirasiyla)',
          '        if (v.ziyaret == false)',
          '           v.ziyaret = true',
          '           Q.enqueue(v)',
        ],
        dfs: [
          'DFS(u)',
          '  u.ziyaret = true',
          '  Yaz(u)              // oncekok sirasi',
          '  for (her komsu v, oncelik sirasiyla)',
          '     if (v.ziyaret == false)',
          '        DFS(v)',
          '  Yaz(u)              // sonrakok sirasi',
        ],
      },
      codeTitles: { bfs: 'Genişlik öncelikli (kuyruk) · O(V+E)', dfs: 'Derinlik öncelikli (yığın / özyineleme) · O(V+E)' },
      render(f) {
        const R = 120,
          cx = 170,
          cy = 145;
        const pos = {};
        G.nodes.forEach((n, i) => {
          const a = -Math.PI / 2 + (2 * Math.PI * i) / G.nodes.length;
          pos[n] = [cx + R * Math.cos(a), cy + R * Math.sin(a)];
        });
        let s = `<defs><marker id="ga${box.id || ''}" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="ga"/></marker></defs>`;
        G.edges.forEach(([a, b, dir]) => {
          const [x1, y1] = pos[a],
            [x2, y2] = pos[b];
          const L = Math.hypot(x2 - x1, y2 - y1) || 1;
          const ux = (x2 - x1) / L,
            uy = (y2 - y1) / L;
          const key = a + '|' + b;
          const cls = f.tree.includes(key) || f.tree.includes(b + '|' + a) ? 'tree' : f.look === key || f.look === b + '|' + a ? 'look' : '';
          s += `<line class="ge ${cls}" x1="${x1 + ux * 21}" y1="${y1 + uy * 21}" x2="${x2 - ux * 23}" y2="${y2 - uy * 23}"${dir ? ` marker-end="url(#ga${box.id || ''})"` : ''}/>`;
        });
        G.nodes.forEach((n) => {
          const [x, y] = pos[n];
          const cls = f.cur === n ? 'cmp' : f.fin.includes(n) ? 'fin' : f.vis.includes(n) && f.inQ.includes(n) ? 'new' : f.vis.includes(n) ? 'done' : '';
          s += `<g class="gn ${cls}"><circle cx="${x}" cy="${y}" r="20"/><text x="${x}" y="${y + 5}">${esc(n)}</text></g>`;
        });
        const lst = (lbl, arr, cls) => `<div class="g-l"><span>${lbl}</span>${arr.length ? arr.map((x) => `<b class="${cls || ''}">${esc(x)}</b>`).join('') : '<em>—</em>'}</div>`;
        P.stage.innerHTML =
          `<div class="g-wrap"><svg class="g-svg" viewBox="20 0 300 290">${s}</svg><div class="g-side">` +
          lst(mode === 'bfs' ? 'Kuyruk (ön → arka)' : 'Yığın (alt → tepe)', f.inQ, 'q') +
          lst(mode === 'bfs' ? 'BFS ziyaret sırası' : 'Öncekök (ilk ziyaret)', f.out) +
          (mode === 'dfs' ? lst('Sonrakök sırası', f.fin, 'fin') : '') +
          `<div class="g-l adj"><span>Komşuluk listesi</span>${G.nodes.map((n) => `<code>${esc(n)}: ${nb(n).map(esc).join(', ') || '—'}</code>`).join('')}</div></div></div>`;
      },
    });
    function parseG(s) {
      const nodes = new Set();
      const edges = [];
      String(s)
        .split(/[,;\s]+/)
        .filter(Boolean)
        .forEach((tok) => {
          const m = tok.match(/^([^->]+)(-|>)([^->]+)$/);
          if (m) {
            const a = V.up(m[1]),
              b = V.up(m[3]);
            nodes.add(a);
            nodes.add(b);
            edges.push([a, b, m[2] === '>']);
          } else nodes.add(V.up(tok));
        });
      const arr = [...nodes].map(V.item).sort(C).map((x) => x.t);
      return { nodes: arr, edges };
    }
    function nb(u) {
      const out = [];
      G.edges.forEach(([a, b, dir]) => {
        if (a === u) out.push(b);
        else if (!dir && b === u) out.push(a);
      });
      const s = [...new Set(out)].map(V.item).sort(C).map((x) => x.t);
      return order === 'onde' ? s : s.reverse();
    }
    function run(auto) {
      frames = [];
      const vis = [],
        out = [],
        fin = [],
        tree = [];
      let inQ = [],
        e = 0;
      const snap = (msg, line, cur, look) =>
        frames.push({ msg, line, code: mode, cur, look, vis: vis.slice(), out: out.slice(), fin: fin.slice(), tree: tree.slice(), inQ: inQ.slice(), st: { v: vis.length, e } });
      const pr = order === 'onde' ? 'alfabetik olarak önde olan önce' : 'alfabetik olarak sonda olan önce';
      if (mode === 'bfs') {
        vis.push(start);
        inQ.push(start);
        snap(`BFS, ${tag({ t: start })}'${V.eks(start, 'den')} başlar (${pr}). ${esc(start)} ziyaret edildi, kuyruğa eklendi.`, [2, 3], null);
        while (inQ.length) {
          const u = inQ.shift();
          out.push(u);
          snap(`u = dequeue() = ${tag({ t: u })} → yaz. Komşuları: ${nb(u).map(esc).join(', ') || 'yok'}.`, 5, u);
          for (const v of nb(u)) {
            e++;
            if (!vis.includes(v)) {
              vis.push(v);
              inQ.push(v);
              tree.push(u + '|' + v);
              snap(`${esc(v)} ziyaret edilmemiş → işaretle, kuyruğa ekle.`, [7, 8, 9], u, u + '|' + v);
            } else snap(`${esc(v)} zaten ziyaret edilmiş → atla.`, 7, u, u + '|' + v);
          }
        }
        const kalan = G.nodes.filter((x) => !vis.includes(x));
        snap(`Kuyruk boş → bitti. <b>BFS sırası: ${out.map(esc).join(', ')}</b>${kalan.length ? `. ${kalan.map(esc).join(', ')}: ${esc(start)}'${V.eks(start, 'den')} yol yok.` : ''}`, 4, null);
      } else {
        const dfs = (u, par) => {
          vis.push(u);
          out.push(u);
          inQ.push(u);
          if (par) tree.push(par + '|' + u);
          snap(`DFS(${esc(u)}): ziyaret edildi, öncekök listesine yazıldı. Yığın: [${inQ.map(esc).join(', ')}]`, [2, 3], u, par ? par + '|' + u : null);
          for (const v of nb(u)) {
            e++;
            if (!vis.includes(v)) {
              snap(`${esc(u)}'${V.eks(u, 'in')} komşusu ${esc(v)} ziyaret edilmemiş → DFS(${esc(v)}).`, [5, 6], u, u + '|' + v);
              dfs(v, u);
            } else snap(`${esc(u)}'${V.eks(u, 'in')} komşusu ${esc(v)} zaten ziyaret edilmiş → atla.`, 5, u, u + '|' + v);
          }
          inQ.pop();
          fin.push(u);
          snap(`${esc(u)}'${V.eks(u, 'in')} bütün komşuları bitti → <b>sonrakök listesine yaz</b>. Yığın: [${inQ.map(esc).join(', ')}]`, 7, u);
        };
        snap(`DFS, ${tag({ t: start })}'${V.eks(start, 'den')} başlar (${pr}).`, 1, null);
        dfs(start, null);
        const kalan = G.nodes.filter((x) => !vis.includes(x));
        snap(`Bitti. Öncekök: ${out.map(esc).join(', ')} · <b>Sonrakök: ${fin.map(esc).join(', ')}</b>${kalan.length ? `. ${kalan.map(esc).join(', ')}: yol yok.` : ''}`, [], null);
      }
      P.load(frames, auto);
    }
    V.opsRow(P, 'Kenarlar', 'A-C, A-D, C>E (> yönlü)', 'A-B yönsüz, A>B yönlü; tek harf yalnız düğüm', [
      [
        'Uygula',
        (v) => {
          const g = parseG(v);
          if (g.nodes.length < 2 || g.nodes.length > 10) return P.say('2 ile 10 arası düğüm girin.');
          G = g;
          start = G.nodes[0];
          stIn.value = start;
          run(true);
        },
      ],
    ], init);
    const stIn = V.opsRow(P, 'Başlangıç', 'A', '', [
      [
        'BFS',
        (v, inp) => {
          mode = 'bfs';
          start = G.nodes.includes(V.up(v)) ? V.up(v) : G.nodes[0];
          inp.value = start;
          run(true);
        },
        'primary',
      ],
      [
        'DFS + sonrakök',
        () => {
          mode = 'dfs';
          start = G.nodes.includes(V.up(stIn.value)) ? V.up(stIn.value) : G.nodes[0];
          stIn.value = start;
          run(true);
        },
      ],
    ]);
    stIn.value = start;
    V.btnRow(P, 'Öncelik', [
      ['Alfabetik önde önce', (b) => ((order = 'onde'), tog(b), run(true)), 'on'],
      ['Alfabetik sonda önce', (b) => ((order = 'sonda'), tog(b), run(true))],
    ]);
    const tog = (b) => b.parentNode.querySelectorAll('.viz-btn').forEach((x) => x.classList.toggle('on', x === b));
    run(false);
  };
})();
