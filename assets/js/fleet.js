/* "Our fleet": a live turntable of the selected machine, drawn as an ink line drawing (models and the
   drawing renderer are in machines.js).
   Falls back to still renders when WebGL / three.js is unavailable, on phones, or for reduced motion. */
(function () {
  'use strict';
  var root = document.querySelector('[data-fleet]');
  if (!root) return;
  var items = Array.prototype.slice.call(root.querySelectorAll('[data-fleet-item]'));
  var img = root.querySelector('[data-fleet-img]'), canvas = root.querySelector('[data-fleet-canvas]');
  var nameEl = root.querySelector('[data-fleet-name]');
  var current = null, viewer = null;

  function select(key) {
    if (key === current) return; current = key;
    items.forEach(function (b) { var on = b.getAttribute('data-fleet-item') === key; b.classList.toggle('is-active', on); if (on && nameEl) nameEl.textContent = b.getAttribute('data-name'); });
    if (img) img.src = 'assets/img/v3/fleet-' + key + '.jpg';
    if (viewer) viewer.show(key);
  }
  items.forEach(function (b) {
    var k = b.getAttribute('data-fleet-item');
    b.addEventListener('click', function () { select(k); });
    b.addEventListener('mouseenter', function () { if (window.innerWidth > 767) select(k); });
  });

  function makeViewer() {
    var T = window.THREE;
    if (!T || !window.Machines || !canvas || window.innerWidth < 768 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
    var renderer;
    try { renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true }); } catch (e) { return null; }
    var draw;
    try { draw = window.Machines.drawing(renderer); } catch (e) { return null; }
    var scene = new T.Scene();
    var cam = new T.PerspectiveCamera(28, 1, .1, 800);
    var pivot = new T.Group(); scene.add(pivot);
    var cache = {}, model = null, rad = 5, cy = 2, az = .7, spinV = .0045, drag = null, grow = 1, visible = false, raf = 0, t0 = performance.now();

    function fit() {
      var w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
      var ratio = Math.min(3, Math.max(2, (window.devicePixelRatio || 1) * 1.5));   // supersampled so the lines stay fine and smooth
      draw.setSize(w, h, ratio, ratio * .45);
      var d = rad / Math.sin(cam.fov * Math.PI / 360) * (w / h < 1.15 ? 1.1 : .84), el = .28;
      cam.aspect = w / h; cam.near = Math.max(.5, d - rad * 1.6); cam.far = d + rad * 1.6; cam.updateProjectionMatrix();
      cam.position.set(Math.cos(el) * d, cy + Math.sin(el) * d, 0); cam.lookAt(0, cy * .92, 0);
    }
    function show(key) {
      if (model) pivot.remove(model);
      if (!cache[key]) {
        var m = window.Machines.build[key](), bb = new T.Box3().setFromObject(m), c = bb.getCenter(new T.Vector3());
        m.position.x -= c.x; m.position.z -= c.z;                 // centre on the turntable
        cache[key] = { m: m, rad: bb.getSize(new T.Vector3()).length() / 2, cy: c.y };
      }
      model = cache[key].m; rad = cache[key].rad; cy = cache[key].cy; pivot.add(model); grow = 0; fit(); start();
    }
    function frame(now) {
      raf = 0;
      if (!drag) az += spinV;
      grow += (1 - grow) * .12;
      pivot.rotation.y = az; pivot.scale.setScalar(.86 + .14 * grow);
      if (model && model.userData.tick) model.userData.tick((now - t0) / 1000);
      draw.render(scene, cam, rad);
      if (visible) raf = requestAnimationFrame(frame);
    }
    function start() { if (!raf && visible) raf = requestAnimationFrame(frame); }
    canvas.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, az: az }; canvas.setPointerCapture(e.pointerId); canvas.classList.add('is-dragging'); });
    canvas.addEventListener('pointermove', function (e) { if (drag) az = drag.az + (e.clientX - drag.x) * .01; });
    ['pointerup', 'pointercancel'].forEach(function (n) { canvas.addEventListener(n, function () { drag = null; canvas.classList.remove('is-dragging'); }); });
    window.addEventListener('resize', fit);
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) { fit(); start(); } }, { rootMargin: '120px' }).observe(root);
    root.classList.add('has-3d');
    return { show: show };
  }

  viewer = makeViewer();
  select((items[0] && root.getAttribute('data-fleet-start')) || (items[0] && items[0].getAttribute('data-fleet-item')));
})();
