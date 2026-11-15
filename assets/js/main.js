/* AP Tvastar Buildcon — interactions */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasGsap = typeof window.gsap !== 'undefined';
  var page = document.body.getAttribute('data-page');
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- logo symbol (bridge arch monogram) ---------- */
  var SYMBOL = '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">' +
    '<path d="M4 33 Q24 2 44 33"/><path d="M2 33 H46"/>' +
    '<path d="M12 20.5 V33 M18 14.6 V33 M24 12.5 V33 M30 14.6 V33 M36 20.5 V33"/>' +
    '<path d="M24 38 l3 3 -3 3 -3 -3 z" fill="currentColor"/></svg>';
  $$('[data-symbol]').forEach(function (el) { el.innerHTML = SYMBOL; });

  $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* ---------- smooth scroll ---------- */
  var lenis = null;
  if (!reduce && typeof window.Lenis !== 'undefined') {
    lenis = new window.Lenis({ duration: 1.15, smoothWheel: true });
    if (hasGsap && window.ScrollTrigger) {
      lenis.on('scroll', window.ScrollTrigger.update);
      gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      gsap.ticker.lagSmoothing(0);
    } else {
      var raf = function (t) { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }
  function scrollToTarget(target) {
    if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.6 });
    else if (typeof target === 'number') window.scrollTo({ top: target, behavior: 'smooth' });
    else target.scrollIntoView({ behavior: 'smooth' });
  }
  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (id === '#') return;
      var t = $(id);
      if (!t) return;
      e.preventDefault();
      scrollToTarget(id === '#hero' ? 0 : t);
    });
  });

  /* ---------- modal (enquiry) ---------- */
  var modal = $('[data-modal]');
  function openModal(e) {
    if (e) e.preventDefault();
    if (!modal) { window.location.href = 'contact.html'; return; }
    closeMenu();
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    if (lenis) lenis.stop();
    setTimeout(function () { var f = $('input', modal); if (f) f.focus(); }, 400);
  }
  function closeModal() {
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    if (lenis) lenis.start();
  }
  $$('[data-open-enquiry]').forEach(function (b) {
    b.addEventListener('click', openModal);
    b.addEventListener('keydown', function (e) { if (e.key === 'Enter') openModal(e); });
  });
  $$('[data-modal-close]').forEach(function (b) { b.addEventListener('click', closeModal); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeModal(); closeMenu(); } });

  /* Forms: no backend is connected yet — shows the confirmation state only.
     TODO: connect to the company's form handler / email service before launch. */
  $$('[data-form]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      form.classList.add('is-sent');
    });
  });

  /* ---------- mobile menu ---------- */
  var menu = $('[data-menu]');
  function closeMenu() { if (menu) menu.classList.remove('is-open'); }
  $$('[data-menu-open]').forEach(function (b) { b.addEventListener('click', function () { menu.classList.add('is-open'); }); });
  $$('[data-menu-close]').forEach(function (b) { b.addEventListener('click', closeMenu); });
  if (menu) $$('a', menu).forEach(function (a) { a.addEventListener('click', closeMenu); });

  /* ---------- cookie card ---------- */
  var cookie = $('[data-cookie]');
  var cookieKey = 'apt-cookie-choice';
  var choice = null;
  try { choice = localStorage.getItem(cookieKey); } catch (e) {}
  function hideCookie(v) {
    try { localStorage.setItem(cookieKey, v); } catch (e) {}
    cookie.classList.remove('is-visible');
  }
  if (cookie) {
    if (!choice) setTimeout(function () { cookie.classList.add('is-visible'); }, 3800);
    $('[data-cookie-accept]', cookie).addEventListener('click', function () { hideCookie('accept'); });
    $('[data-cookie-decline]', cookie).addEventListener('click', function () { hideCookie('decline'); });
  }

  /* ---------- read-more (leaders) ---------- */
  $$('[data-more-toggle]').forEach(function (btn) {
    var box = btn.previousElementSibling;
    btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') === 'true';
      box.style.height = (open ? 0 : box.firstElementChild.offsetHeight) + 'px';
      btn.setAttribute('aria-expanded', String(!open));
      btn.textContent = open ? 'Read full profile' : 'Show less';
      setTimeout(function () { if (window.ScrollTrigger) ScrollTrigger.refresh(); }, 850);
    });
  });

  /* ---------- facts accordion ---------- */
  $$('[data-facts] li').forEach(function (li) {
    li.setAttribute('tabindex', '0');
    function toggle() {
      var d = $('.detail', li), open = li.classList.toggle('is-open');
      d.style.height = open ? d.firstElementChild.offsetHeight + 30 + 'px' : 0;
    }
    li.addEventListener('click', toggle);
    li.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
  });

  /* ---------- sliders ---------- */
  $$('[data-slider]').forEach(function (root) {
    var groups = {};
    $$('[data-slide]', root).forEach(function (el) {
      var key = el.parentElement;
      (groups[key.className] = groups[key.className] || { parent: key, items: [] }).items.push(el);
    });
    var lists = Object.keys(groups).map(function (k) { return groups[k].items; });
    var total = lists.reduce(function (m, l) { return Math.max(m, l.length); }, 0);
    var nav = $('[data-snav]', root);
    var bar = nav && $('.snav_bar i', nav);
    var cur = nav && $('[data-cur]', nav);
    var idx = 0, timer = null;
    function go(n) {
      var prev = idx;
      idx = (n + total) % total;
      lists.forEach(function (items) {
        items.forEach(function (el, i) {
          el.classList.toggle('is-active', i === idx);
          el.classList.toggle('is-out', i === prev && i !== idx);
        });
        // clear the "out" state after the transition so the item can re-enter from below
        setTimeout(function () { items.forEach(function (el, i) { if (i !== idx) el.classList.remove('is-out'); }); }, 1150);
      });
      if (cur) cur.textContent = idx + 1;
      if (bar) { bar.style.width = (100 / total) + '%'; bar.style.left = (100 / total * idx) + '%'; }
    }
    if (nav) {
      $('[data-next]', nav).addEventListener('click', function () { go(idx + 1); restart(); });
      $('[data-prev]', nav).addEventListener('click', function () { go(idx - 1); restart(); });
    }
    function restart() {
      clearInterval(timer);
      if (!reduce) timer = setInterval(function () { go(idx + 1); }, 6000);
    }
    // swipe
    var sx = null;
    root.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
    root.addEventListener('touchend', function (e) {
      if (sx === null) return;
      var dx = e.changedTouches[0].clientX - sx; sx = null;
      if (Math.abs(dx) > 50 && root.getAttribute('data-slider') !== 'aerial') { go(idx + (dx < 0 ? 1 : -1)); restart(); }
    });
    go(0); restart();
  });

  /* ---------- flowers: transparent wind-blown video, played only while visible ----------
     WebKit (Safari, iOS) gets HEVC-with-alpha .mov; everyone else VP9-with-alpha .webm. */
  (function () {
    var vids = $$('video[data-bloom]');
    if (!vids.length) return;
    var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var webkit = /Apple/.test(navigator.vendor || '');
    function load(v) {
      if (v.dataset.ready) return;
      v.dataset.ready = '1';
      v.src = webkit && v.canPlayType('video/mp4; codecs="hvc1"') ? v.dataset.mov : v.dataset.webm;
      // start each instance at a different point so repeated clusters don't move in unison
      v.addEventListener('loadedmetadata', function () { v.currentTime = Math.random() * (v.duration || 1); }, { once: true });
    }
    if (still || !('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting) { load(v); var p = v.play(); if (p && p.catch) p.catch(function () {}); }
        else if (v.dataset.ready) v.pause();
      });
    }, { rootMargin: '200px 200px' });
    vids.forEach(function (v) { io.observe(v); });
  })();

  /* ---------- hero day / night ---------- */
  var hero = $('.hero');
  $$('[data-daynight]').forEach(function (b) {
    b.addEventListener('click', function () {
      var night = b.getAttribute('data-daynight') === 'night';
      hero.classList.toggle('is-night', night);
      $$('[data-daynight]').forEach(function (x) { x.classList.toggle('is-active', x === b); });
    });
  });

  /* ---------- foundation list ---------- */
  var foundation = $('[data-foundation]');
  function setFoundation(i) {
    if (!foundation) return;
    [$$('.foundation_media img', foundation), $$('.foundation_list button', foundation), $$('.foundation_text > div', foundation)]
      .forEach(function (l) { l.forEach(function (el, k) { el.classList.toggle('is-active', k === i); }); });
  }
  /* desktop: the six images become a curved 3D ribbon (ribbon.js); otherwise they cross-fade as before */
  var ribbon = null;
  if (foundation && window.FoundationRibbon && window.innerWidth > 767 &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    ribbon = window.FoundationRibbon.init(foundation);
  }
  if (foundation) {
    $$('.foundation_list button', foundation).forEach(function (b, i) {
      b.addEventListener('click', function () { setFoundation(i); if (ribbon) ribbon.setTarget(i); });
      b.addEventListener('mouseenter', function () { if (window.innerWidth > 767) { setFoundation(i); if (ribbon) ribbon.setTarget(i); } });
    });
  }

  /* ---------- aerial drag ---------- */
  var aerial = $('[data-aerial]');
  if (aerial) {
    var track = $('[data-aerial-track]', aerial);
    var x = 0, target = 0, dragging = false, startX = 0, startT = 0;
    function bounds() { return Math.min(0, aerial.clientWidth - track.scrollWidth); }
    function clamp(v) { return Math.max(bounds(), Math.min(0, v)); }
    function center() { target = x = bounds() / 2; track.style.transform = 'translate3d(' + x + 'px,0,0)'; }
    var img = $('img', track);
    if (img.complete) center(); else img.addEventListener('load', center);
    window.addEventListener('resize', center);
    aerial.addEventListener('pointerdown', function (e) { dragging = true; startX = e.clientX; startT = target; aerial.setPointerCapture(e.pointerId); });
    aerial.addEventListener('pointermove', function (e) { if (dragging) target = clamp(startT + (e.clientX - startX) * 1.4); });
    ['pointerup', 'pointercancel'].forEach(function (ev) { aerial.addEventListener(ev, function () { dragging = false; }); });
    (function loop() {
      x += (target - x) * 0.08;
      track.style.transform = 'translate3d(' + x.toFixed(2) + 'px,0,0)';
      requestAnimationFrame(loop);
    })();
  }

  /* ---------- header / rail colour & progress ---------- */
  var header = $('[data-header]'), rail = $('[data-rail]'), railNum = $('[data-rail-num]');
  var themed = $$('[data-theme]');
  function onScroll() {
    var probe = 60;
    var dark = page === 'verticals' || page === 'credits'; // cream inner pages use dark text
    for (var i = 0; i < themed.length; i++) {
      var r = themed[i].getBoundingClientRect();
      if (r.top <= probe && r.bottom > probe) dark = themed[i].getAttribute('data-theme') === 'dark';
    }
    if (header) header.classList.toggle('is-dark', dark);
    if (rail) rail.classList.toggle('is-dark', dark);
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var p = max > 0 ? Math.round(window.scrollY / max * 100) : 0;
    if (railNum) railNum.textContent = (p < 10 ? '0' : '') + p;
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* =========================================================
     GSAP motion
     ========================================================= */
  var pre = $('[data-preloader]');
  if (!hasGsap || reduce) {
    if (pre) pre.remove();
    $$('[data-reveal]').forEach(function (el) { el.style.opacity = 1; el.style.transform = 'none'; });
    return;
  }
  gsap.registerPlugin(ScrollTrigger);

  /* preloader */
  var intro = gsap.timeline({ defaults: { ease: 'power3.inOut' } });
  if (pre) {
    var seen = false;
    try { seen = sessionStorage.getItem('apt-pre') === '1'; sessionStorage.setItem('apt-pre', '1'); } catch (e) {}
    if (lenis) lenis.stop();
    intro.from($$('[data-pl]', pre), { opacity: 0, y: 30, duration: seen ? .4 : 1, stagger: .12 })
      .to($('.preloader_bar i', pre), { scaleY: 1, duration: seen ? .5 : 1.6, ease: 'power2.inOut' }, '<')
      .to(pre, { yPercent: -100, duration: 1.1, ease: 'power4.inOut' }, '+=.2')
      .add(function () { pre.remove(); if (lenis) lenis.start(); ScrollTrigger.refresh(); });
  }

  if (page === 'home') {
    /* hero entrance + scroll */
    intro.from('[data-hero-title] > *', { y: 80, opacity: 0, duration: 1.3, stagger: .1, ease: 'power3.out' }, pre ? '-=.6' : 0)
      .from('.hero_row > *, .hero_cta', { opacity: 0, y: 20, duration: 1, stagger: .08, ease: 'power3.out' }, '-=1');
    gsap.fromTo('[data-hero-media] img', { scale: 1.15 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('[data-hero-title]', { yPercent: -40, opacity: 0, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: '70% top', scrub: true } });

    /* arch reveal over hero */
    var arch = $('[data-arch]');
    gsap.set(arch, { yPercent: 100 });
    ScrollTrigger.create({
      trigger: '.hero', start: 'top top', end: '+=100%', pin: true, pinSpacing: true, scrub: true,
      animation: gsap.timeline()
        .to(arch, { yPercent: 0, ease: 'none' })
        .fromTo('[data-arch] [data-arch-shape]', { clipPath: 'ellipse(46% 88% at 50% 100%)' }, { clipPath: 'ellipse(85% 160% at 50% 100%)', ease: 'none' }, .35)
    });

    /* concept: pinned horizontal scroll on desktop, stacked on mobile */
    var hs = $('[data-hscroll]');
    var path = $('[data-route] path');
    var len = path ? path.getTotalLength() : 0;
    if (path) gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
    var mmc = gsap.matchMedia();
    mmc.add('(min-width: 768px)', function () {
      var track = $('[data-hs-track]', hs);
      var dist = function () { return track.scrollWidth - window.innerWidth; };
      var hsTween = gsap.to(track, {
        x: function () { return -dist(); }, ease: 'none',
        scrollTrigger: { trigger: hs, start: 'top top', end: function () { return '+=' + dist(); }, pin: true, scrub: true, invalidateOnRefresh: true }
      });
      var inH = function (trigger, start, end) { return { trigger: trigger, containerAnimation: hsTween, start: start, end: end, scrub: true }; };
      // statement drifts as the next panel arrives
      gsap.fromTo('.concept_c', { xPercent: 0 }, { xPercent: -18, ease: 'none', scrollTrigger: inH('.concept_p2', 'left right', 'left left') });
      // big words move at different speeds
      $$('[data-big-lines] span').forEach(function (s, i) {
        gsap.fromTo(s, { x: (i + 1) * 80 }, { x: -(i + 1) * 40, ease: 'none', scrollTrigger: inH('.concept_p2', 'left right', 'right left') });
      });
      $$('[data-hs-par] img').forEach(function (img) {
        gsap.fromTo(img, { xPercent: -16 }, { xPercent: 0, ease: 'none', scrollTrigger: inH(img.parentElement, 'left right', 'right left') });
      });
      if (path) {
        gsap.to(path, { strokeDashoffset: 0, ease: 'none', scrollTrigger: inH('.concept_p4', 'left 80%', 'right right') });
        gsap.fromTo('[data-route] .route_stop', { opacity: 0, y: 12 }, { opacity: 1, y: 0, stagger: .1, ease: 'none', scrollTrigger: inH('.concept_p4', 'left 40%', 'right right') });
      }
      gsap.fromTo('.concept_p4 .about_coast > *', { y: 60, opacity: 0 }, { y: 0, opacity: 1, stagger: .15, ease: 'none', scrollTrigger: inH('.concept_p4', 'left 90%', 'left 20%') });
    });
    mmc.add('(max-width: 767px)', function () {
      if (path) gsap.to(path, { strokeDashoffset: 0, ease: 'none', scrollTrigger: { trigger: '[data-route]', start: 'top 85%', end: 'bottom 50%', scrub: true } });
    });

    /* clouds part to reveal the aerial view */
    var clouds = $('[data-clouds]');
    if (clouds) {
      gsap.timeline({ scrollTrigger: { trigger: '[data-aerial]', start: 'top top', end: '+=90%', pin: true, scrub: true } })
        .fromTo('.aerial_clouds .c-l', { xPercent: 0, scale: 1.15, opacity: 1 }, { xPercent: -150, scale: 1.4, opacity: 0, ease: 'none' }, 0)
        .fromTo('.aerial_clouds .c-r', { xPercent: 0, scaleX: -1.15, scaleY: 1.15, opacity: 1 }, { xPercent: 150, scaleX: -1.4, scaleY: 1.4, opacity: 0, ease: 'none' }, 0)
        .fromTo('[data-aerial-track] img', { scale: 1.25 }, { scale: 1, ease: 'none' }, 0)
        .fromTo('.aerial_tags, .aerial_hint', { opacity: 0 }, { opacity: 1, ease: 'none' }, .6);
    }

    /* flowers stay anchored to their corner (they move on their own in the video) */

    /* foundation: pin, step through the list, then the leadership arch rises (desktop) */
    if (foundation) {
      var mm = gsap.matchMedia();
      mm.add('(min-width: 768px)', function () {
        var n = $$('.foundation_list button', foundation).length;
        var tl = gsap.timeline({
          scrollTrigger: {
            trigger: foundation, start: 'top top', end: '+=' + (n * 70 + 120) + '%', pin: true, scrub: true,
            onUpdate: function (st) {
              var f = Math.min(1, st.progress / .72);
              if (ribbon) { ribbon.setTarget(f * (n - 1)); setFoundation(Math.round(f * (n - 1))); }
              else setFoundation(Math.min(n - 1, Math.floor(Math.min(.999, f) * n)));
            }
          }
        });
        tl.to({}, { duration: .72 })
          .fromTo('[data-leaders-arch]', { yPercent: 100 }, { yPercent: 0, ease: 'none', duration: .16 })
          .fromTo('[data-leaders-arch] [data-arch-shape]', { clipPath: 'ellipse(38% 80% at 50% 100%)' }, { clipPath: 'ellipse(90% 170% at 50% 100%)', ease: 'none', duration: .12 })
          .fromTo('.leaders_arch_title > *', { yPercent: 40, opacity: 0 }, { yPercent: 0, opacity: 1, stagger: .02, duration: .1, ease: 'power2.out' }, .78);
      });
    }

    /* mission: word shrinks, image opens up */
    var mission = $('[data-mission]');
    if (mission) {
      var mtl = gsap.timeline({ scrollTrigger: { trigger: mission, start: 'top top', end: 'bottom bottom', scrub: true } });
      mtl.fromTo('[data-mission-media]', { clipPath: 'inset(6% 2% 0% 2%)' }, { clipPath: 'inset(0% 0% 0% 0%)', ease: 'none' })
        .fromTo('[data-mission-word]', { scale: 1.12, yPercent: 0 }, { scale: .9, yPercent: -10, ease: 'none' }, 0)
        .fromTo('[data-mission-body]', { opacity: 0, y: 60 }, { opacity: 1, y: 0, ease: 'none' }, .3)
        .fromTo('.mission_cta', { opacity: 0 }, { opacity: 1, ease: 'none' }, .4);
    }
  }

  /* parallax media */
  $$('[data-parallax] img, [data-parallax-img]').forEach(function (img) {
    gsap.fromTo(img, { yPercent: -10 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
  });
  $$('[data-parallax-soft] img').forEach(function (img) {
    gsap.fromTo(img, { scale: 1.12 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  /* generic reveals */
  $$('[data-reveal]').forEach(function (el) {
    gsap.to(el, { opacity: 1, y: 0, duration: 1.2, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%' } });
  });

  /* inner pages: cards */
  $$('.card').forEach(function (c, i) {
    gsap.from(c, { opacity: 0, y: 40, duration: 1, delay: (i % 3) * .08, ease: 'power3.out', scrollTrigger: { trigger: c, start: 'top 92%' } });
  });

  window.addEventListener('load', function () { ScrollTrigger.refresh(); });
})();
