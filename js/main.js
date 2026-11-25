/* OKalme — the ink map. Vanilla JS, no build step. */
(function () {
  'use strict';
  var root = document.documentElement;
  var viewport = document.getElementById('viewport');
  var camera = document.getElementById('camera');
  var world = document.getElementById('world');
  var cells = Array.prototype.slice.call(document.querySelectorAll('.cell'));
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var I18N = window.OK_I18N || { en: {} };

  var ROUTES = { hub: '', album: 'album', game: 'geared-spirit', workshop: 'workshop', journal: 'journal' };
  var LABELKEY = { hub: 'dir.hub', album: 'dir.album', game: 'dir.game', workshop: 'dir.workshop', journal: 'dir.journal' };
  var byName = {}, current = null, flying = false, mapping = false, W = 0, H = 0;

  cells.forEach(function (c) {
    c.style.setProperty('--cx', c.dataset.x);
    c.style.setProperty('--cy', c.dataset.y);
    byName[c.dataset.cell] = c;
  });

  /* fog on the unexplored corners — visible while flying or in map mode */
  [['0', '0', 'fog.1'], ['2', '0', 'fog.2'], ['0', '2', 'fog.3'], ['2', '2', 'fog.4']].forEach(function (f) {
    var d = document.createElement('div');
    d.className = 'fog'; d.setAttribute('aria-hidden', 'true');
    d.style.setProperty('--cx', f[0]); d.style.setProperty('--cy', f[1]);
    d.dataset.i18n = f[2];
    world.appendChild(d);
  });
  Object.assign(I18N.en, { 'fog.1': 'Unexplored', 'fog.2': 'Here be bosses', 'fog.3': 'Vol. 2?', 'fog.4': 'Future ideas' });
  if (I18N.fr) Object.assign(I18N.fr, { 'fog.1': 'Inexploré', 'fog.2': 'Ici vivent des boss', 'fog.3': 'Vol. 2?', 'fog.4': 'Idées futures' });

  /* ---------------- sizing ---------------- */
  function measure() {
    W = window.innerWidth; H = window.innerHeight;
    root.style.setProperty('--W', W + 'px');
    root.style.setProperty('--H', H + 'px');
    if (current && !flying) place(current);
  }
  function tr(cell) { return 'translate3d(' + (-cell.dataset.x * W) + 'px,' + (-cell.dataset.y * H) + 'px,0)'; }
  function place(cell) { world.style.transform = tr(cell); }

  /* ---------------- i18n ---------------- */
  var lang = 'en';
  function t(k) { return (I18N[lang] && I18N[lang][k]) || I18N.en[k] || ''; }
  function applyLang(l, save) {
    lang = I18N[l] ? l : 'en';
    root.lang = lang;
    document.title = t('meta.title');
    document.querySelectorAll('[data-i18n]').forEach(function (el) { var v = t(el.dataset.i18n); if (v) el.textContent = v; });
    document.querySelectorAll('.lang button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.lang === lang)); });
    document.querySelectorAll('.compass [data-go]').forEach(function (b) { b.setAttribute('aria-label', t(LABELKEY[b.dataset.go])); });
    document.querySelector('.reader-close').setAttribute('aria-label', t('ui.close'));
    document.querySelector('.lang').setAttribute('aria-label', lang === 'fr' ? 'Langue' : 'Language');
    cells.forEach(function (c) { c.dataset.label = t(LABELKEY[c.dataset.cell]); });
    if (current) updateCompass(current);
    if (openSlug) renderPost(openSlug);
    if (save) {
      try { localStorage.setItem('okalme-lang', lang); } catch (e) {}
      var u = new URL(location.href);
      if (lang === 'fr') u.searchParams.set('lang', 'fr'); else u.searchParams.delete('lang');
      history.replaceState(null, '', u.pathname + u.search + u.hash);
    }
  }
  document.querySelectorAll('.lang button').forEach(function (b) {
    b.addEventListener('click', function () { applyLang(b.dataset.lang, true); });
  });

  /* ---------------- travel ---------------- */
  function updateCompass(cell) {
    document.querySelectorAll('.compass [data-go]').forEach(function (b) { b.classList.toggle('on', b.dataset.go === cell.dataset.cell); });
    document.querySelector('.c-label').textContent = t(LABELKEY[cell.dataset.cell]);
  }
  function setInert(active) {
    cells.forEach(function (c) {
      var off = !mapping && c !== active;
      if (off) c.setAttribute('inert', ''); else c.removeAttribute('inert');
      c.setAttribute('aria-hidden', String(off));
    });
  }
  function arrive(cell, focus) {
    current = cell; flying = false;
    root.classList.remove('flying');
    setInert(cell);
    updateCompass(cell);
    if (focus) {
      var h = cell.querySelector('h1, h2');
      if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    }
  }
  function flyTo(cell, opts) {
    opts = opts || {};
    if (!cell) return;
    if (mapping) return exitMap(cell);
    if (cell === current && !opts.force) return;
    var from = current;
    if (!from || opts.instant || reduce || !world.animate) {
      place(cell); arrive(cell, !!from); return;
    }
    flying = true; root.classList.add('flying');
    var dx = cell.dataset.x - from.dataset.x, dy = cell.dataset.y - from.dataset.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var dur = 850 + 260 * dist;
    var mid = Math.max(0.38, 0.72 - 0.17 * dist);
    place(cell);
    world.animate([{ transform: tr(from) }, { transform: tr(cell) }], { duration: dur, easing: 'cubic-bezier(.65,0,.35,1)' });
    var a = camera.animate([{ transform: 'scale(1)' }, { transform: 'scale(' + mid + ')', offset: 0.5 }, { transform: 'scale(1)' }], { duration: dur, easing: 'ease-in-out' });
    a.onfinish = function () { arrive(cell, true); };
    hideHint();
  }

  /* ---------------- map mode ---------------- */
  function mapScale() { return Math.min(0.31, (W - 40) / (3 * W), (H - 120) / (3 * H)); }
  function enterMap() {
    if (mapping || flying) return;
    mapping = true; root.classList.add('mapping');
    setInert(null);
    var s = mapScale();
    var target = 'scale(' + s + ')';
    if (!reduce && camera.animate) {
      world.animate([{ transform: tr(current) }, { transform: tr(byName.hub) }], { duration: 700, easing: 'cubic-bezier(.65,0,.35,1)' });
      camera.animate([{ transform: 'scale(1)' }, { transform: target }], { duration: 700, easing: 'cubic-bezier(.65,0,.35,1)' });
    }
    place(byName.hub);
    camera.style.transform = target;
    document.querySelector('.map-btn').setAttribute('aria-pressed', 'true');
    hideHint();
  }
  function exitMap(cell) {
    if (!mapping) return;
    cell = cell || current;
    mapping = false; root.classList.remove('mapping');
    var s = mapScale();
    camera.style.transform = '';
    place(cell);
    document.querySelector('.map-btn').setAttribute('aria-pressed', 'false');
    var done = function () { arrive(cell, true); };
    if (!reduce && camera.animate) {
      flying = true;
      world.animate([{ transform: tr(byName.hub) }, { transform: tr(cell) }], { duration: 700, easing: 'cubic-bezier(.65,0,.35,1)' });
      camera.animate([{ transform: 'scale(' + s + ')' }, { transform: 'scale(1)' }], { duration: 700, easing: 'cubic-bezier(.65,0,.35,1)' }).onfinish = done;
    } else done();
    var r = ROUTES[cell.dataset.cell];
    if (routeOf(location.hash).cell !== cell.dataset.cell) history.replaceState(null, '', '#/' + r);
  }
  document.querySelector('.map-btn').addEventListener('click', function () { mapping ? exitMap() : enterMap(); });
  world.addEventListener('click', function (e) {
    if (!mapping) return;
    var c = e.target.closest('.cell');
    if (c) { e.preventDefault(); exitMap(c); }
  });

  /* ---------------- routing (hash: GitHub Pages friendly) ---------------- */
  function routeOf(hash) {
    var parts = (hash || '').replace(/^#\/?/, '').split('/');
    var seg = parts[0], name = 'hub';
    Object.keys(ROUTES).forEach(function (k) { if (ROUTES[k] === seg || k === seg) name = k; });
    if (seg === 'geared-spirit') name = 'game';
    return { cell: name, post: name === 'journal' && parts[1] ? parts[1] : null };
  }
  function onRoute(instant) {
    var r = routeOf(location.hash);
    flyTo(byName[r.cell] || byName.hub, { instant: instant });
    if (r.post) openPost(r.post); else closePost(true);
  }
  window.addEventListener('hashchange', function () { onRoute(false); });
  function go(name) {
    var h = '#/' + ROUTES[name];
    if (location.hash === h || (name === 'hub' && routeOf(location.hash).cell === 'hub' && !routeOf(location.hash).post)) flyTo(byName[name]);
    else location.hash = h;
  }
  document.querySelectorAll('[data-go]').forEach(function (b) {
    b.addEventListener('click', function () { if (mapping) exitMap(byName[b.dataset.go]); else go(b.dataset.go); });
  });
  document.querySelector('.brand').addEventListener('click', function (e) { e.preventDefault(); if (mapping) exitMap(byName.hub); else go('hub'); });

  function step(dx, dy) {
    if (!current || flying) return;
    var x = +current.dataset.x + dx, y = +current.dataset.y + dy;
    var target = cells.filter(function (c) { return +c.dataset.x === x && +c.dataset.y === y; })[0];
    if (target) go(target.dataset.cell);
    else { camera.classList.remove('bump'); void camera.offsetWidth; camera.classList.add('bump'); }
  }

  /* ---------------- keyboard ---------------- */
  function scroller() { return current && current.querySelector('.cell-scroll'); }
  function atEdge(dir) {
    var s = scroller(); if (!s) return true;
    return dir < 0 ? s.scrollTop <= 2 : s.scrollTop + s.clientHeight >= s.scrollHeight - 2;
  }
  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    if (!document.getElementById('reader').hidden) { if (e.key === 'Escape') closePost(); return; }
    var k = e.key.toLowerCase();
    if (k === 'escape' && mapping) return exitMap();
    if (k === 'm') { e.preventDefault(); return mapping ? exitMap() : enterMap(); }
    if (mapping) return;
    if (k === 'arrowleft' || k === 'a') { e.preventDefault(); step(-1, 0); }
    else if (k === 'arrowright' || k === 'd') { e.preventDefault(); step(1, 0); }
    else if (k === 'w' || (k === 'arrowup' && atEdge(-1))) { e.preventDefault(); step(0, -1); }
    else if (k === 's' || (k === 'arrowdown' && atEdge(1))) { e.preventDefault(); step(0, 1); }
  });

  /* ---------------- touch swipe & trackpad ---------------- */
  var sx = 0, sy = 0, st = 0, sEdgeTop = false, sEdgeBot = false;
  viewport.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) return;
    sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = Date.now();
    sEdgeTop = atEdge(-1); sEdgeBot = atEdge(1);
  }, { passive: true });
  viewport.addEventListener('touchend', function (e) {
    if (mapping || flying || !st) return;
    var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Date.now() - st > 700) return;
    st = 0;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6) step(dx < 0 ? 1 : -1, 0);
    else if (Math.abs(dy) > 110 && Math.abs(dy) > Math.abs(dx) * 1.6) {
      if (dy < 0 && sEdgeBot) step(0, 1);
      else if (dy > 0 && sEdgeTop) step(0, -1);
    }
  }, { passive: true });
  var acc = 0, wheelLock = 0;
  viewport.addEventListener('wheel', function (e) {
    if (mapping || Math.abs(e.deltaX) < Math.abs(e.deltaY) * 1.5) return;
    var now = Date.now();
    if (now < wheelLock) return;
    acc += e.deltaX;
    if (Math.abs(acc) > 140) { step(acc > 0 ? 1 : -1, 0); acc = 0; wheelLock = now + 1400; }
  }, { passive: true });

  /* ---------------- hint ---------------- */
  var hint = document.querySelector('.hint');
  function hideHint() { if (hint) hint.classList.add('gone'); }
  setTimeout(hideHint, 9000);

  /* ---------------- hub: sigil tilt ---------------- */
  var sigil = document.querySelector('.sigil');
  if (!reduce && sigil) {
    byName.hub.addEventListener('pointermove', function (e) {
      var rx = (e.clientY / H - 0.5) * -10, ry = (e.clientX / W - 0.5) * 14;
      sigil.style.transform = 'rotateX(' + rx + 'deg) rotateY(' + ry + 'deg)';
    });
    byName.hub.addEventListener('pointerleave', function () { sigil.style.transform = ''; });
  }

  /* ---------------- album: ink-reveal cover frame ---------------- */
  var frame = document.getElementById('frame'), cap = document.getElementById('frame-cap');
  var shownCover = '__album';
  function showCover(btn, ev) {
    if (!btn || btn.dataset.cover === shownCover) return;
    shownCover = btn.dataset.cover;
    document.querySelectorAll('#tracks button').forEach(function (b) { b.classList.toggle('on', b === btn); });
    var img = new Image();
    var isAlbum = btn.dataset.cover === '__album';
    img.src = isAlbum ? 'assets/img/through-their-eyes.jpg' : 'assets/covers/' + btn.dataset.cover + '.jpg';
    img.alt = btn.firstChild.textContent.trim() + (isAlbum ? ' — album cover' : ' — cover');
    img.width = 720; img.height = 720;
    var old = frame.querySelectorAll('img');
    var stamp = frame.querySelector('.stamp');
    frame.insertBefore(img, stamp);
    cap.textContent = btn.firstChild.textContent.trim();
    var cleanup = function () { old.forEach(function (o) { if (o.parentNode) o.parentNode.removeChild(o); }); };
    if (reduce || !img.animate) return cleanup();
    var px = ev && ev.type !== 'focus' ? 30 + Math.random() * 40 : 50, py = 30 + Math.random() * 40;
    img.animate([{ clipPath: 'circle(0% at ' + px + '% ' + py + '%)' }, { clipPath: 'circle(150% at ' + px + '% ' + py + '%)' }],
      { duration: 700, easing: 'cubic-bezier(.3,0,.2,1)' }).onfinish = cleanup;
  }
  var albumBtn = { dataset: { cover: '__album' }, firstChild: { textContent: 'Through Their Eyes, Vol. 1' } };
  function showAlbum() { showCover(albumBtn, null); }
  var trackList = document.getElementById('tracks');
  trackList.addEventListener('mouseleave', showAlbum);
  trackList.addEventListener('focusout', function (e) { if (!trackList.contains(e.relatedTarget)) showAlbum(); });
  document.querySelectorAll('#tracks button').forEach(function (b) {
    b.addEventListener('mouseenter', function (e) { showCover(b, e); });
    b.addEventListener('focus', function (e) { showCover(b, e); });
    b.addEventListener('click', function (e) { showCover(b, e); });
  });
  // preload covers once the album is visited
  var preloaded = false;
  function preload() {
    if (preloaded) return; preloaded = true;
    document.querySelectorAll('#tracks button').forEach(function (b) { var i = new Image(); i.src = 'assets/covers/' + b.dataset.cover + '.jpg'; });
  }

  /* ---------------- geared spirit: gears that listen ---------------- */
  function gearPath(cx, cy, n, ro, ri) {
    var d = '', step = Math.PI * 2 / n;
    for (var i = 0; i < n; i++) {
      var a = i * step, pts = [[a, ri], [a + step * 0.2, ro], [a + step * 0.48, ro], [a + step * 0.68, ri]];
      pts.forEach(function (p, j) {
        d += (i === 0 && j === 0 ? 'M' : 'L') + (cx + Math.cos(p[0]) * p[1]).toFixed(1) + ' ' + (cy + Math.sin(p[0]) * p[1]).toFixed(1);
      });
    }
    return d + 'Z';
  }
  var gA = document.getElementById('gearA'), gB = document.getElementById('gearB');
  if (gA && gB) {
    // Same module for both gears (m = 16): pitch radius = m·n/2, addendum .8m, dedendum .9m.
    var M = 16, AX = 165, AY = 175, ANG = 45;
    var mk = function (n, x, y) { var r = M * n / 2; return { x: x, y: y, n: n, r: r, ro: r + 0.8 * M, ri: r - 0.9 * M }; };
    var A = mk(14, AX, AY);
    var dist = A.r + M * 9 / 2 + 2; // +2 px backlash: verified no overlap at any angle
    var B = mk(9, AX + dist * Math.cos(ANG * Math.PI / 180), AY + dist * Math.sin(ANG * Math.PI / 180));
    gA.querySelector('path').setAttribute('d', gearPath(A.x, A.y, A.n, A.ro, A.ri));
    gA.querySelector('circle').setAttribute('cx', A.x); gA.querySelector('circle').setAttribute('cy', A.y);
    gB.querySelector('path').setAttribute('d', gearPath(B.x, B.y, B.n, B.ro, B.ri));
    gB.querySelector('circle').setAttribute('cx', B.x.toFixed(2)); gB.querySelector('circle').setAttribute('cy', B.y.toFixed(2));
    document.querySelector('.spirit ellipse').setAttribute('cx', A.x);
    document.querySelector('.spirit ellipse').setAttribute('cy', A.y + 4);
    var ang = 0, speed = 0.12, lastX = null, lastY = null;
    // Phase: a tooth of A (centred at .34 pitch) and a gap of B (centred at .84 pitch) meet on the line of centres.
    var offA = ANG - 0.34 * 360 / A.n, offB = ANG + 180 - 0.84 * 360 / B.n;
    var render = function () {
      gA.setAttribute('transform', 'rotate(' + (offA + ang).toFixed(3) + ' ' + A.x.toFixed(2) + ' ' + A.y.toFixed(2) + ')');
      gB.setAttribute('transform', 'rotate(' + (offB - ang * A.n / B.n).toFixed(3) + ' ' + B.x.toFixed(2) + ' ' + B.y.toFixed(2) + ')');
    };
    render();
    if (!reduce) {
      byName.game.addEventListener('pointermove', function (e) {
        if (lastX !== null) speed = Math.min(6, speed + Math.hypot(e.clientX - lastX, e.clientY - lastY) * 0.01);
        lastX = e.clientX; lastY = e.clientY;
      });
      var tick = function () {
        if (current === byName.game || flying) {
          ang = (ang + speed) % 360;
          speed += (0.12 - speed) * 0.03;
          render();
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  }

  /* ---------------- journal reader ---------------- */
  var reader = document.getElementById('reader'), body = document.getElementById('reader-body');
  var openSlug = null, lastFocus = null;
  function renderPost(slug) {
    var tpl = document.getElementById('post-' + slug + '-' + lang) || document.getElementById('post-' + slug + '-en');
    if (!tpl) return false;
    body.innerHTML = '';
    body.appendChild(tpl.content.cloneNode(true));
    return true;
  }
  function openPost(slug) {
    if (openSlug === slug) return;
    if (!renderPost(slug)) return;
    openSlug = slug; lastFocus = document.activeElement;
    reader.hidden = false;
    var paper = reader.querySelector('.scroll-paper');
    paper.scrollTop = 0;
    if (!reduce && paper.animate) {
      paper.animate([{ clipPath: 'inset(48% 0 48% 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 650, easing: 'cubic-bezier(.3,0,.2,1)', delay: 250 });
      reader.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250 });
    }
    reader.querySelector('.reader-close').focus({ preventScroll: true });
  }
  function closePost(silent) {
    if (!openSlug) return;
    openSlug = null; reader.hidden = true;
    if (!silent && routeOf(location.hash).post) location.hash = '#/journal';
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  reader.querySelector('.reader-close').addEventListener('click', function () { closePost(); });
  reader.addEventListener('click', function (e) { if (e.target === reader) closePost(); });

  /* ---------------- boot ---------------- */
  var qs = new URLSearchParams(location.search).get('lang');
  var saved = null; try { saved = localStorage.getItem('okalme-lang'); } catch (e) {}
  measure();
  applyLang(qs || saved || 'en', false);
  window.addEventListener('resize', measure);
  onRoute(true);
  if (!location.hash) history.replaceState(null, '', location.pathname + location.search + '#/');
  // preload album covers in idle time
  setTimeout(preload, 2500);
})();
