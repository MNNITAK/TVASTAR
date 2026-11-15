/* Foundation section: a curved 3D ribbon of image cards on a dark stage.
   Scrolling rotates the ribbon; fast movement makes it ripple and pinch. Needs three.js (global THREE).
   Usage: var r = FoundationRibbon.init(sectionEl); r.setTarget(indexFloat); */
(function () {
  'use strict';

  var VERT = [
    'uniform float uAngle, uThetaW, uR, uH, uVel, uTime;',
    'varying vec2 vUv; varying float vFacing;',
    'void main(){',
    '  vUv = uv;',
    '  float a = uAngle + position.x * uThetaW;',
    '  float k = clamp(abs(uVel), 0.0, 1.0);',
    '  float pinch = 1.0 - k * 0.72 * pow(abs(sin(a * 1.6 + uTime * 0.6)), 2.0);',
    '  float y = position.y * uH * pinch;',
    '  y += k * sin(a * 2.2 + uTime * 1.8) * 0.5 * sign(uVel);',
    '  y += sin(a * 1.4 + uTime * 0.5) * 0.035;',
    '  vFacing = cos(a);',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(uR * sin(a), y, -uR * cos(a), 1.0);',
    '}'
  ].join('\n');

  var FRAG = [
    'precision highp float;',
    'uniform sampler2D uTex; uniform float uImgAspect, uCardAspect, uReady;',
    'varying vec2 vUv; varying float vFacing;',
    'float rbox(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }',
    'void main(){',
    '  vec2 p = (vUv - 0.5) * vec2(uCardAspect, 1.0);',
    '  float d = rbox(p, vec2(uCardAspect, 1.0) * 0.5, 0.045);',
    '  float aa = fwidth(d) * 1.5;',
    '  float alpha = 1.0 - smoothstep(-aa, aa, d);',
    '  if (alpha < 0.01) discard;',
    '  vec2 uv = vUv - 0.5;',                                  // cover-fit the photo
    '  if (uImgAspect > uCardAspect) uv.x *= uCardAspect / uImgAspect; else uv.y *= uImgAspect / uCardAspect;',
    '  vec3 col = texture2D(uTex, uv + 0.5).rgb * uReady;',
    '  float lit = smoothstep(0.55, 1.0, vFacing);',           // centre card bright, sides fall into shadow
    '  col *= mix(0.62, 1.0, lit);',
    '  float sheen = pow(max(0.0, 1.0 - abs(vUv.x - 0.5 + (1.0 - vFacing) * 2.0)), 6.0);',
    '  col += sheen * 0.10;',
    '  col += (1.0 - smoothstep(0.0, 0.02, -d)) * 0.06;',      // faint edge highlight
    '  gl_FragColor = vec4(col, alpha);',
    '}'
  ].join('\n');

  function init(section) {
    var THREE = window.THREE;
    var canvas = section && section.querySelector('[data-ribbon]');
    if (!THREE || !canvas) return null;
    var srcs = Array.prototype.map.call(section.querySelectorAll('.foundation_media img'), function (i) { return i.getAttribute('src'); });
    if (!srcs.length) return null;
    var renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false }); } catch (e) { return null; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    var BG = 0xf3f3ec;                                     // the site's cream page colour
    renderer.setClearColor(BG, 1);

    var scene = new THREE.Scene();
    scene.fog = new THREE.Fog(BG, 5, 16);
    var R = 5, N = srcs.length * 2, STEP = Math.PI * 2 / N, THETA_W = STEP * 0.93, CARD_ASPECT = 1.6;
    var H = R * THETA_W / CARD_ASPECT;
    var camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);
    camera.position.set(0, 0.12, R * 0.42);
    camera.lookAt(0, 0.1, -R);

    var grid = new THREE.GridHelper(60, 90, 0xd9d9cf, 0xe4e4db);     // faint floor
    grid.position.y = -H * 0.5 - 0.55;
    scene.add(grid);

    var geo = new THREE.PlaneGeometry(1, 1, 48, 12);
    var loader = new THREE.TextureLoader();
    var cards = [];
    var texs = srcs.map(function (s, i) {
      var t = loader.load(s, function (tx) {
        tx.minFilter = THREE.LinearMipmapLinearFilter; tx.anisotropy = renderer.capabilities.getMaxAnisotropy();
        cards.forEach(function (c) { if (c.img === i) { c.u.uImgAspect.value = tx.image.width / tx.image.height; c.u.uReady.value = 1; } });
      });
      return t;
    });
    for (var i = 0; i < N; i++) {
      var u = {
        uTex: { value: texs[i % srcs.length] }, uAngle: { value: 0 }, uThetaW: { value: THETA_W }, uR: { value: R }, uH: { value: H },
        uVel: { value: 0 }, uTime: { value: 0 }, uImgAspect: { value: 1.5 }, uCardAspect: { value: CARD_ASPECT }, uReady: { value: 0 }
      };
      var mat = new THREE.ShaderMaterial({ uniforms: u, vertexShader: VERT, fragmentShader: FRAG, transparent: true, side: THREE.DoubleSide, extensions: { derivatives: true } });
      var mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      scene.add(mesh);
      cards.push({ u: u, img: i % srcs.length, i: i });
    }

    var target = 0, cur = 0, vel = 0, phase = 0, visible = false, raf = 0;
    function size() {
      var w = canvas.clientWidth || section.clientWidth, h = canvas.clientHeight || section.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.fov = w / h < 1.3 ? 46 : 27;
      camera.updateProjectionMatrix();
    }
    function frame(now) {
      raf = 0;
      var d = target - cur;
      cur += d * 0.04;
      // The twist follows the scroll and is HELD when scrolling stops: it never relaxes back to flat.
      if (Math.abs(d) > 0.004) {
        var want = (d > 0 ? 1 : -1) * Math.max(Math.abs(d) * 1.5, 0.4);
        vel += (want - vel) * 0.05;
        phase += Math.abs(d) * 0.22;                       // the wave travels only while the ribbon moves
      }
      var time = phase;
      for (var k = 0; k < cards.length; k++) {
        var c = cards[k];
        c.u.uAngle.value = (c.i - cur) * STEP;
        c.u.uVel.value = vel;
        c.u.uTime.value = time;
      }
      renderer.render(scene, camera);
      if (visible) raf = requestAnimationFrame(frame);
    }
    function start() { if (!raf && visible) raf = requestAnimationFrame(frame); }
    size();
    window.addEventListener('resize', size);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) { size(); start(); } }, { rootMargin: '100px' }).observe(section);
    } else { visible = true; start(); }

    section.classList.add('has-ribbon');
    section.setAttribute('data-theme', 'dark');            // light stage: header and rail switch to dark text
    return {
      setTarget: function (v) { target = v; start(); },
      resize: size
    };
  }

  window.FoundationRibbon = { init: init };
})();
