/* AP Tvastar Buildcon — original procedural 3D models of the fleet and plants (three.js r128).
   Everything here is built from primitives in code; no external models or images.
   Convention: metres, Y up, ground at y = 0, machine faces +X.
   window.Machines.build.<key>() -> THREE.Group  (group.userData.tick(t) animates moving parts) */
(function () {
  'use strict';
  var T = window.THREE;
  if (!T) return;

  var PAL = { navy: 0x17233b, cream: 0xf3f3ec, sky: 0xb5cedb, plum: 0x340c24, blush: 0xf8bbcb,
              yellow: 0xe8b021, steel: 0x9aa3ad, dark: 0x1c1f26, glass: 0x7fa6bd, white: 0xffffff, grit: 0xb9b3a4, asphalt: 0x2b2e35 };
  var cache = {};
  /* Painted panels get a clear-coat (automotive paint); steel is properly metallic; glass is dark and
     reflective; rubber and aggregate stay matt. All of them reflect the studio environment (see studio()). */
  function mat(name, o) {
    if (!cache[name]) {
      o = o || {};
      var p = { color: new T.Color(PAL[name]).convertSRGBToLinear(), roughness: o.r == null ? 0.6 : o.r, metalness: o.m || 0, envMapIntensity: o.env == null ? 1 : o.env };
      if (o.coat) { p.clearcoat = o.coat; p.clearcoatRoughness = 0.18; }
      cache[name] = o.coat ? new T.MeshPhysicalMaterial(p) : new T.MeshStandardMaterial(p);
    }
    return cache[name];
  }
  PAL.yellow = 0xf2a100; PAL.steel = 0xb4bac1; PAL.dark = 0x16181d; PAL.glass = 0x1d2b38;
  var M = {
    get yellow() { return mat('yellow', { r: .38, coat: .9 }); }, get navy() { return mat('navy', { r: .4, coat: .8 }); },
    get cream() { return mat('cream', { r: .45, coat: .5 }); }, get sky() { return mat('sky', { r: .45, coat: .5 }); },
    get plum() { return mat('plum', { r: .4, coat: .8 }); }, get blush() { return mat('blush', { r: .4, coat: .6 }); },
    get steel() { return mat('steel', { r: .32, m: .92, env: 1.2 }); }, get dark() { return mat('dark', { r: .82, env: .5 }); },
    get glass() { return mat('glass', { r: .04, m: .55, env: 1.8 }); }, get white() { return mat('white', { r: .3, coat: .6 }); },
    get grit() { return mat('grit', { r: 1, env: .4 }); }, get asphalt() { return mat('asphalt', { r: .95, env: .3 }); }
  };

  /* Shared studio look for the live viewer and the still renders: filmic tone mapping, soft shadows and a
     softbox environment so paint, steel and glass pick up reflections. Returns the key light. */
  function studio(renderer, scene) {
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
    renderer.physicallyCorrectLights = false;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    var env = new T.Scene(); env.background = new T.Color(0x2a3038).convertSRGBToLinear();
    function panel(w, h, x, y, z, c, i) {
      var m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(c).multiplyScalar(i), side: T.DoubleSide }));
      m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m);
    }
    panel(60, 40, 0, 40, 0, 0xffffff, 1.15);              // overhead softbox
    panel(40, 26, 42, 16, 22, 0xfff0dc, 1.5);            // warm key
    panel(40, 26, -44, 12, -10, 0xdce8f5, .55);          // cool fill
    panel(50, 16, 0, 8, -46, 0xffffff, .7);              // rim
    panel(200, 200, 0, -12, 0, 0xcfc6b4, 0.22);           // warm floor bounce
    var pm = new T.PMREMGenerator(renderer); scene.environment = pm.fromScene(env, 0.035).texture; pm.dispose();
    scene.add(new T.HemisphereLight(0xffffff, 0xcfc8b8, 0.32));
    var sun = new T.DirectionalLight(0xfff1dc, 1.75); sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 6;
    scene.add(sun, sun.target);
    return sun;
  }

  function sh(m) { m.castShadow = true; m.receiveShadow = true; return m; }
  function box(g, w, h, d, m, x, y, z) { var o = sh(new T.Mesh(new T.BoxGeometry(w, h, d), m)); o.position.set(x || 0, y || 0, z || 0); g.add(o); return o; }
  function cyl(g, rt, rb, h, m, x, y, z, axis, seg) {
    var o = sh(new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg || 24), m));
    if (axis === 'x') o.rotation.z = Math.PI / 2; else if (axis === 'z') o.rotation.x = Math.PI / 2;
    o.position.set(x || 0, y || 0, z || 0); g.add(o); return o;
  }
  /* a bar between two points in the XY plane (arms, booms, conveyors) */
  function beam(g, x1, y1, x2, y2, t, w, m, z) {
    var dx = x2 - x1, dy = y2 - y1, L = Math.sqrt(dx * dx + dy * dy);
    var o = box(g, L, t, w, m, (x1 + x2) / 2, (y1 + y2) / 2, z || 0); o.rotation.z = Math.atan2(dy, dx); return o;
  }
  /* side-profile [x, y(, corner radius)] points extruded across the machine's width */
  function prof(g, pts, width, m, z) {
    var s = new T.Shape(), n = pts.length, i;
    function V(p) { return new T.Vector2(p[0], p[1]); }
    for (i = 0; i < n; i++) {
      var p = V(pts[i]), a = V(pts[(i + n - 1) % n]).sub(p), b = V(pts[(i + 1) % n]).sub(p);
      var r = Math.min(pts[i][2] || 0, a.length() * .45, b.length() * .45);
      if (r > 0) {
        var p0 = p.clone().addScaledVector(a.normalize(), r), p1 = p.clone().addScaledVector(b.normalize(), r);
        if (i === 0) s.moveTo(p0.x, p0.y); else s.lineTo(p0.x, p0.y);
        s.quadraticCurveTo(p.x, p.y, p1.x, p1.y);
      } else if (i === 0) s.moveTo(p.x, p.y); else s.lineTo(p.x, p.y);
    }
    s.closePath();
    var geo = new T.ExtrudeGeometry(s, { depth: width, bevelEnabled: false, curveSegments: 10 });
    geo.translate(0, 0, -width / 2);
    var o = sh(new T.Mesh(geo, m)); o.position.z = z || 0; g.add(o); return o;
  }
  /* round bar between two 3D points (rails, pipes, braces) */
  function tube(g, a, b, r, m, seg) {
    var A = new T.Vector3(a[0], a[1], a[2] || 0), B = new T.Vector3(b[0], b[1], b[2] || 0), d = B.clone().sub(A), L = d.length();
    if (r < .08) r *= .55;                                               // slender members read as a single fine line
    var o = sh(new T.Mesh(new T.CylinderGeometry(r, r, L, seg || 8), m || M.steel));
    o.position.copy(A).addScaledVector(d, .5); o.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()); g.add(o); return o;
  }
  /* tapered plate link between two pins in the XY plane (booms, arms, levers) */
  function link(g, x1, y1, x2, y2, t1, t2, w, m, z) {
    var dx = x2 - x1, dy = y2 - y1, L = Math.sqrt(dx * dx + dy * dy), nx = -dy / L, ny = dx / L;
    var o = prof(g, [[x1 + nx * t1 / 2, y1 + ny * t1 / 2], [x2 + nx * t2 / 2, y2 + ny * t2 / 2], [x2 - nx * t2 / 2, y2 - ny * t2 / 2], [x1 - nx * t1 / 2, y1 - ny * t1 / 2]], w, m, z);
    cyl(g, t1 * .5, t1 * .5, w + .04, m, x1, y1, z || 0, 'z', 14); cyl(g, t2 * .5, t2 * .5, w + .04, m, x2, y2, z || 0, 'z', 14);
    return o;
  }
  /* hydraulic cylinder in the XY plane: barrel, rod and end eyes */
  function ram(g, x1, y1, x2, y2, r, z) {
    z = z || 0;
    var k = .56, mx = x1 + (x2 - x1) * k, my = y1 + (y2 - y1) * k;
    tube(g, [x1, y1, z], [mx, my, z], r, M.dark, 12); tube(g, [mx, my, z], [x2, y2, z], r * .5, M.steel, 8);
    tube(g, [mx - (x2 - x1) * .03, my - (y2 - y1) * .03, z], [mx, my, z], r * 1.18, M.dark, 12);
    cyl(g, r * 1.1, r * 1.1, r * 2.2, M.steel, x1, y1, z, 'z', 10); cyl(g, r * .9, r * .9, r * 2.2, M.steel, x2, y2, z, 'z', 10);
  }
  /* ring sector (mudguards, hoops) around a Z axis through (x, y): inner radius R, thickness t, width w, angles in degrees */
  function arc(g, R, t, w, x, y, z, a0, a1, m) {
    var s = new T.Shape(), k = Math.PI / 180;
    s.absarc(0, 0, R + t, a0 * k, a1 * k, false); s.absarc(0, 0, R, a1 * k, a0 * k, true); s.closePath();
    var geo = new T.ExtrudeGeometry(s, { depth: w, bevelEnabled: false, curveSegments: 14 }); geo.translate(0, 0, -w / 2);
    var o = sh(new T.Mesh(geo, m)); o.position.set(x, y, z || 0); g.add(o); return o;
  }
  /* ladder between two points; side = unit-ish vector across the rungs */
  function ladder(g, a, b, side, w) {
    w = (w || .45) / 2;
    var sx = side[0] * w, sy = side[1] * w, sz = side[2] * w;
    tube(g, [a[0] + sx, a[1] + sy, a[2] + sz], [b[0] + sx, b[1] + sy, b[2] + sz], .028, M.steel, 6);
    tube(g, [a[0] - sx, a[1] - sy, a[2] - sz], [b[0] - sx, b[1] - sy, b[2] - sz], .028, M.steel, 6);
    var L = Math.sqrt(Math.pow(b[0] - a[0], 2) + Math.pow(b[1] - a[1], 2) + Math.pow(b[2] - a[2], 2)), n = Math.max(2, Math.round(L / .34));
    for (var i = 1; i < n; i++) { var f = i / n, x = a[0] + (b[0] - a[0]) * f, y = a[1] + (b[1] - a[1]) * f, z = a[2] + (b[2] - a[2]) * f; tube(g, [x + sx, y + sy, z + sz], [x - sx, y - sy, z - sz], .02, M.steel, 5); }
  }
  /* handrail along a line of base points: posts, top rail and knee rail */
  function handrail(g, pts, h, closed) {
    h = h || 1;
    var n = pts.length, i;
    for (i = 0; i < n; i++) tube(g, pts[i], [pts[i][0], pts[i][1] + h, pts[i][2]], .03, M.steel, 6);
    for (i = 0; i < (closed ? n : n - 1); i++) {
      var a = pts[i], b = pts[(i + 1) % n];
      tube(g, [a[0], a[1] + h, a[2]], [b[0], b[1] + h, b[2]], .03, M.steel, 6);
      tube(g, [a[0], a[1] + h * .5, a[2]], [b[0], b[1] + h * .5, b[2]], .022, M.steel, 5);
    }
  }
  /* rectangular walkway: deck plus a handrail all round (posts every ~1.6 m) */
  function walkway(g, cx, y, cz, w, d, m) {
    box(g, w, .08, d, m || M.steel, cx, y, cz);
    var pts = [], nx = Math.max(1, Math.round(w / 1.7)), nz = Math.max(1, Math.round(d / 1.7)), i;
    for (i = 0; i < nx; i++) pts.push([cx - w / 2 + w * i / nx, y, cz - d / 2]);
    for (i = 0; i < nz; i++) pts.push([cx + w / 2, y, cz - d / 2 + d * i / nz]);
    for (i = 0; i < nx; i++) pts.push([cx + w / 2 - w * i / nx, y, cz + d / 2]);
    for (i = 0; i < nz; i++) pts.push([cx - w / 2, y, cz + d / 2 - d * i / nz]);
    handrail(g, pts, 1.0, true);
  }
  /* row of louvre slats on a flat side panel */
  function slats(g, x, y, z, len, n, pitch, axis) {
    for (var i = 0; i < n; i++) { if (axis === 'z') box(g, .03, .035, len, M.dark, x, y + i * pitch, z); else box(g, len, .035, .03, M.dark, x, y + i * pitch, z); }
  }

  /* tyre with tread bands, sidewall, rim, hub and wheel nuts. o.lug = number of tread bars (off-road tyres) */
  function wheel(g, r, w, x, z, list, o) {
    o = o || {};
    var wg = new T.Group(); wg.position.set(x, r, z);
    var out = z >= 0 ? 1 : -1, i, a;
    if (o.lug) cyl(wg, r, r, w, M.dark, 0, 0, 0, 'z', 36);
    else for (i = -1; i <= 1; i++) cyl(wg, r, r, w / 3, M.dark, 0, 0, i * w / 3, 'z', 36);
    cyl(wg, r * .9, r * .9, w + .035, M.dark, 0, 0, 0, 'z', 32);                // sidewall
    cyl(wg, r * .62, r * .62, w + .06, M.steel, 0, 0, 0, 'z', 28);              // rim
    cyl(wg, out > 0 ? r * .2 : r * .46, out > 0 ? r * .46 : r * .2, .09, M.steel, 0, 0, out * (w / 2 + .07), 'z', 22);   // dished centre
    cyl(wg, r * .15, r * .15, .1, M.dark, 0, 0, out * (w / 2 + .13), 'z', 12);  // hub cap
    for (i = 0; i < (o.nuts || 8); i++) { a = i * Math.PI * 2 / (o.nuts || 8); cyl(wg, r * .028, r * .028, .04, M.dark, Math.cos(a) * r * .33, Math.sin(a) * r * .33, out * (w / 2 + .09), 'z', 6); }
    if (o.lug) for (i = 0; i < o.lug; i++) {
      a = i * Math.PI * 2 / o.lug;
      var b = box(wg, r * .07, r * .13, w * .56, M.dark, Math.cos(a) * r * 1.02, Math.sin(a) * r * 1.02, (i % 2 ? 1 : -1) * w * .23); b.rotation.z = a;
    }
    g.add(wg); if (list) list.push(wg); return wg;
  }
  function spin(list) { return function (t) { for (var i = 0; i < list.length; i++) list[i].rotation.z = -t * 1.2; }; }

  /* ---------- shared truck: 6x4 cab-over chassis, cab, wheels ---------- */
  function truckBase(g, wheels, cabColor) {
    var R = .54;
    [.43, -.43].forEach(function (z) { box(g, 7.7, .26, .1, M.dark, -.45, 1.02, z); });                   // chassis rails
    [-3.9, -2.4, -.6, 1.0].forEach(function (x) { box(g, .1, .2, .86, M.dark, x, 1.02, 0); });            // cross-members
    prof(g, [[3.45, .7], [3.74, .7, .06], [3.74, 1.2, .06], [3.45, 1.2]], 2.5, M.dark);                   // bumper
    [.9, -.9].forEach(function (z) { box(g, .04, .2, .44, M.white, 3.75, 1.0, z); box(g, .04, .1, .16, M.yellow, 3.75, .82, z * 1.2); });   // head lamps, indicators
    box(g, .03, .14, .5, M.white, 3.75, .88, 0);                                                           // number plate
    prof(g, [[1.78, 1.22], [3.5, 1.22, .06], [3.58, 2.25, .1], [3.4, 3.2, .22], [1.78, 3.3, .08]], 2.44, cabColor);   // cab shell
    prof(g, [[3.38, 3.14], [3.74, 3.02], [3.74, 3.08], [3.4, 3.22]], 2.3, M.dark);                         // sun visor
    prof(g, [[3.55, 2.36], [3.575, 2.36], [3.442, 3.06], [3.417, 3.06]], 2.16, M.glass);                   // windscreen
    [.38, -.3].forEach(function (z) { tube(g, [3.585, 2.38, z], [3.52, 2.78, z + .4], .01, M.dark, 5); });   // wipers
    prof(g, [[3.522, 1.45], [3.547, 1.45], [3.592, 2.1], [3.567, 2.1]], 1.5, M.dark);                      // grille panel
    for (var i = 0; i < 5; i++) box(g, .03, .04, 1.36, M.steel, 3.565 + i * .0085, 1.55 + i * .12, 0);
    [1, -1].forEach(function (s) {
      prof(g, [[1.98, 1.42], [3.1, 1.42], [3.16, 2.3], [3.05, 3.12], [1.98, 3.16]], .02, cabColor, s * 1.225);   // door
      prof(g, [[2.08, 2.38], [3.08, 2.38], [2.98, 3.04], [2.08, 3.06]], .02, M.glass, s * 1.24);                 // door window
      box(g, .16, .04, .03, M.dark, 2.12, 2.22, s * 1.25);                                                        // handle
      tube(g, [3.35, 3.0, s * 1.22], [3.64, 3.0, s * 1.46], .018, M.dark, 5); tube(g, [3.35, 2.42, s * 1.22], [3.64, 2.42, s * 1.46], .018, M.dark, 5);
      tube(g, [3.64, 2.42, s * 1.46], [3.64, 3.0, s * 1.46], .018, M.dark, 5);
      box(g, .05, .46, .2, M.dark, 3.66, 2.71, s * 1.5);                                                          // mirror
      box(g, .34, .05, .22, M.dark, 3.2, .92, s * 1.14);                                                          // step
      arc(g, R + .1, .035, .42, 2.45, R, s * 1.03, 8, 172, M.dark);                                               // front mudguard
      [-1.75, -3.05].forEach(function (x) { arc(g, R + .12, .03, .78, x, R, s * .81, 25, 155, M.dark); });        // rear mudguards
      box(g, .05, .14, .3, M.blush, -4.3, 1.02, s * .95);                                                         // tail lamps
      box(g, 1.3, .1, .1, M.dark, -2.4, .58, s * .78);                                                            // bogie beam
    });
    cyl(g, .16, .16, .9, M.steel, 1.55, 1.75, .95, 'y', 12); cyl(g, .07, .07, 2.5, M.steel, 1.55, 2.55, .95, 'y', 10);   // silencer + exhaust stack
    box(g, .22, 1.5, .26, M.dark, 1.6, 2.4, -.95); cyl(g, .17, .17, .2, M.dark, 1.6, 3.25, -.95, 'y', 12);              // air intake
    cyl(g, .3, .3, 1.1, M.steel, .55, .78, .98, 'x', 20); [.25, .85].forEach(function (x) { cyl(g, .315, .315, .06, M.dark, x, .78, .98, 'x', 20); });   // fuel tank + straps
    box(g, .7, .45, .42, M.dark, .6, .8, -1.0); cyl(g, .13, .13, .8, M.steel, -.4, .76, -1.0, 'x', 12);                  // battery box, air tank
    box(g, .06, .16, 2.3, M.dark, -4.28, .8, 0);                                                                         // rear under-run bar
    [2.45, -1.75, -3.05].forEach(function (x, i) {
      cyl(g, .1, .1, 2.0, M.dark, x, R, 0, 'z', 10);                                                                     // axle
      if (i) cyl(g, .26, .26, .4, M.dark, x, R, 0, 'x', 14);                                                             // differential
      (i === 0 ? [1.05, -1.05] : [1.0, -1.0, .62, -.62]).forEach(function (z) { wheel(g, R, .34, x, z, wheels, { nuts: 10 }); });
    });
  }

  function tipper() {
    var g = new T.Group(), w = [], i;
    truckBase(g, w, M.yellow);
    var bed = new T.Group(); bed.position.set(-3.95, 1.3, 0);          // hinge at the rear
    prof(bed, [[0, 0], [5.3, 0], [5.3, .14], [0, .14]], 2.5, M.navy);                            // floor
    [.45, -.45].forEach(function (z) { box(bed, 5.0, .14, .12, M.dark, 2.6, -.07, z); });         // sub-frame
    [1, -1].forEach(function (s) {
      box(bed, 5.3, 1.5, .06, M.navy, 2.65, .89, s * 1.22);                                       // side
      box(bed, 5.4, .1, .13, M.navy, 2.66, 1.67, s * 1.22); box(bed, 5.3, .1, .1, M.navy, 2.65, .2, s * 1.25);   // top + bottom rails
      for (i = 0; i < 7; i++) box(bed, .09, 1.37, .07, M.sky, .34 + i * .77, .93, s * 1.285);     // ribs
      box(bed, .12, .16, .06, M.steel, .02, 1.6, s * 1.27);                                        // tailgate hinge
    });
    box(bed, .08, 2.1, 2.5, M.navy, 5.3, 1.15, 0);                                                // headboard
    [-.75, 0, .75].forEach(function (z) { box(bed, .06, 1.9, .09, M.sky, 5.37, 1.2, z); });
    prof(bed, [[5.25, 2.12], [6.35, 2.2], [6.35, 2.27], [5.25, 2.2]], 2.5, M.navy);               // cab guard
    var tail = new T.Group(); tail.position.set(0, 1.64, 0); bed.add(tail);
    box(tail, .07, 1.5, 2.42, M.plum, -.02, -.75, 0);
    [-.4, -1.05].forEach(function (y) { box(tail, .06, .09, 2.42, M.sky, -.08, y, 0); });
    [-.7, 0, .7].forEach(function (z) { box(tail, .06, 1.4, .08, M.sky, -.075, -.75, z); });
    g.add(bed);
    var hoist = new T.Group(); ram(hoist, -.9, 1.05, .6, 1.3, .1, 0); g.add(hoist);
    g.userData.tick = function (t) { spin(w)(t); };
    g.userData.setTip = function (a) { bed.rotation.z = a; hoist.visible = a < .05; tail.rotation.z = -a * .8; };
    return g;
  }

  function mixer() {
    var g = new T.Group(), w = [], i;
    truckBase(g, w, M.navy);
    [.45, -.45].forEach(function (z) { box(g, 5.2, .14, .12, M.dark, -1.5, 1.22, z); });          // sub-frame
    var P = [[.36, 0], [.95, .25], [1.15, 1.0], [1.18, 2.2], [1.0, 3.3], [.62, 4.3], [.45, 4.6]];
    function rad(y) { for (var k = 1; k < P.length; k++) if (y <= P[k][1]) return P[k - 1][0] + (P[k][0] - P[k - 1][0]) * (y - P[k - 1][1]) / (P[k][1] - P[k - 1][1]); return P[P.length - 1][0]; }
    var tilt = new T.Group(); tilt.position.set(.9, 1.97, 0); tilt.rotation.z = Math.PI / 2 - .22; g.add(tilt);   // drum axis rises to the rear
    var drum = new T.Group(); tilt.add(drum);
    drum.add(sh(new T.Mesh(new T.LatheGeometry(P.map(function (p) { return new T.Vector2(p[0], p[1]); }), 40), M.cream)));
    cyl(drum, .36, .36, .1, M.cream, 0, 0, 0, 'y', 20);                                           // front head
    cyl(drum, .97, .93, .14, M.steel, 0, 3.55, 0, 'y', 40);                                       // roller track
    cyl(drum, .47, .47, .08, M.steel, 0, 4.6, 0, 'y', 24);                                        // mouth ring
    for (i = 0; i < 2; i++) {                                                                     // mixing spirals (show the rotation)
      var C = new T.Curve(); C.ph = i * Math.PI;
      C.getPoint = function (t) { var y = .45 + t * 3.7, a = t * Math.PI * 4.4 + this.ph, r = rad(y) + .012; return new T.Vector3(Math.cos(a) * r, y, Math.sin(a) * r); };
      drum.add(sh(new T.Mesh(new T.TubeGeometry(C, 90, .014, 5, false), M.plum)));
    }
    box(drum, .3, .4, .05, M.steel, 0, 1.6, 1.17);                                                // inspection hatch
    cyl(g, .42, .42, .5, M.steel, 1.12, 1.9, 0, 'x', 18); box(g, .55, .6, 1.0, M.dark, 1.15, 1.5, 0);   // drive gearbox + front pedestal
    cyl(g, .28, .28, 1.5, M.sky, 1.42, 2.72, 0, 'z', 18); [.5, -.5].forEach(function (z) { cyl(g, .295, .295, .05, M.dark, 1.42, 2.72, z, 'z', 18); });   // water tank
    box(g, .5, .5, 1.5, M.dark, -2.8, 1.5, 0);                                                    // rear pedestal
    [.5, -.5].forEach(function (z) { cyl(g, .13, .13, .2, M.steel, -2.78, 1.83, z, 'x', 12); });  // support rollers
    [.75, -.75].forEach(function (z) {
      box(g, .1, 2.5, .1, M.dark, -3.55, 2.45, z).rotation.z = .16;                               // rear frame
      tube(g, [-3.35, 1.25, z], [-2.9, 2.3, z], .04, M.dark, 6);
    });
    box(g, .1, .1, 1.6, M.dark, -3.75, 3.62, 0);
    cyl(g, .62, .3, .62, M.yellow, -3.78, 3.56, 0, 'y', 20); cyl(g, .66, .66, .05, M.yellow, -3.78, 3.87, 0, 'y', 20);   // charge hopper
    prof(g, [[-3.55, 2.62], [-4.0, 2.62], [-4.12, 2.1], [-3.82, 2.1]], .75, M.steel);             // discharge funnel
    var ch = sh(new T.Mesh(new T.CylinderGeometry(.27, .22, 1.35, 12, 1, true, 0, Math.PI), M.steel));
    ch.position.set(-4.45, 1.62, 0); ch.rotation.set(0, Math.PI / 2, 0); ch.rotateX(-.85); g.add(ch);   // chute
    ladder(g, [-3.15, 1.2, 1.0], [-3.5, 3.3, 1.0], [1, 0, 0], .4);
    box(g, .6, .04, .4, M.steel, -3.45, 3.3, 1.05); handrail(g, [[-3.2, 3.3, 1.24], [-3.7, 3.3, 1.24]], .8);
    g.userData.tick = function (t) { spin(w)(t); drum.rotation.y = t * .9; };
    return g;
  }

  function bucket(g, x, y, width, s, m) {                               // open-top scoop, mouth to +X
    var b = new T.Group(); b.position.set(x, y, 0);
    prof(b, [[0, 0], [1.12 * s, -.1 * s], [1.26 * s, -.02 * s], [.26 * s, .14 * s, .12 * s], [.14 * s, .86 * s, .1 * s], [.03 * s, .98 * s], [-.04 * s, .94 * s], [-.04 * s, .3 * s, .25 * s]], width, m);
    [width / 2, -width / 2].forEach(function (z) { prof(b, [[0, 0], [1.16 * s, -.09 * s], [.8 * s, .34 * s], [.08 * s, .97 * s]], .07, m, z); });
    box(b, .16 * s, .04 * s, width + .04, M.steel, 1.2 * s, -.06 * s, 0);                         // cutting edge
    var n = Math.max(3, Math.round(width / .42));
    for (var i = 0; i < n; i++) prof(b, [[1.2 * s, -.1 * s], [1.5 * s, -.05 * s], [1.2 * s, .0]], .09, M.steel, (i - (n - 1) / 2) * (width - .16) / (n - 1));   // teeth
    [width * .28, -width * .28].forEach(function (z) { prof(b, [[-.04 * s, .25 * s], [-.22 * s, .45 * s], [-.22 * s, .75 * s], [-.04 * s, .9 * s]], .1, m, z); });   // hinge brackets
    g.add(b); return b;
  }

  function backhoe() {                                                  // JCB-type backhoe loader
    var g = new T.Group(), w = [];
    prof(g, [[-1.95, .75], [2.45, .75], [2.45, 1.2], [-1.95, 1.25]], 1.0, M.yellow);                       // chassis
    prof(g, [[.75, 1.2], [2.55, 1.2], [2.62, 1.75, .12], [2.3, 2.0, .15], [.75, 2.08]], 1.2, M.yellow);    // bonnet
    box(g, .04, .5, .95, M.dark, 2.62, 1.5, 0); slats(g, 2.645, 1.32, 0, .85, 4, .12, 'z');                // grille
    [.3, -.3].forEach(function (z) { cyl(g, .08, .08, .05, M.white, 2.5, 1.9, z, 'x', 12).rotation.z = Math.PI / 2 - .6; });
    [.61, -.61].forEach(function (z) { slats(g, 1.7, 1.5, z, .7, 4, .1, 'x'); });
    cyl(g, .085, .085, .32, M.dark, 1.55, 2.22, .3, 'y', 10); cyl(g, .045, .045, .8, M.dark, 1.55, 2.6, .3, 'y', 8);   // silencer + exhaust
    cyl(g, .04, .04, .3, M.dark, 1.1, 2.2, -.3, 'y', 6); cyl(g, .11, .11, .2, M.dark, 1.1, 2.42, -.3, 'y', 12);        // air pre-cleaner
    prof(g, [[-1.0, 1.25], [.78, 1.25], [.78, 2.05], [.62, 3.15, .1], [-.98, 3.15, .1]], 1.4, M.glass);    // cab
    [.705, -.705].forEach(function (z) {
      prof(g, [[.03, 1.42], [.7, 1.42], [.7, 2.05], [.57, 3.02], [.03, 3.02]], .02, M.glass, z);           // door glass
      prof(g, [[-.92, 2.0], [-.07, 2.0], [-.07, 3.02], [-.92, 3.02]], .02, M.glass, z);                    // rear quarter glass
      box(g, .14, .035, .03, M.dark, .16, 2.0, z * 1.02);
    });
    prof(g, [[.773, 2.12], [.793, 2.12], [.66, 3.02], [.64, 3.02]], 1.2, M.glass);                         // front screen
    box(g, .02, 1.4, 1.2, M.glass, -1.0, 2.3, 0);                                                           // rear screen
    prof(g, [[-1.14, 3.15], [.82, 3.15], [.82, 3.27, .05], [-1.14, 3.27, .05]], 1.56, M.yellow);            // roof
    [.55, -.55].forEach(function (z) { box(g, .1, .1, .16, M.white, .86, 3.1, z); box(g, .1, .1, .16, M.white, -1.18, 3.1, z); });   // work lamps
    cyl(g, .07, .07, .14, M.blush, 0, 3.34, .4, 'y', 10);                                                   // beacon
    [1, -1].forEach(function (s) {
      wheel(g, .8, .5, -1.1, s * .98, w, { lug: 18, nuts: 8 }); wheel(g, .5, .32, 1.75, s * .9, w, { nuts: 6 });
      arc(g, .9, .04, .56, -1.1, .8, s * .98, 20, 160, M.yellow);                                           // rear fender
      arc(g, .58, .03, .34, 1.75, .5, s * .9, 30, 150, M.yellow);                                           // front fender
      link(g, .55, 1.95, 2.35, 1.55, .22, .2, .08, M.yellow, s * .76); link(g, 2.35, 1.55, 3.2, .6, .2, .16, .08, M.yellow, s * .76);   // loader arm
      ram(g, 1.15, 1.12, 2.25, 1.45, .06, s * .76);                                                         // lift ram
      ram(g, 1.0, 2.2, 2.75, 1.42, .05, s * .86); tube(g, [2.75, 1.42, s * .86], [3.3, 1.2, s * .8], .035, M.steel, 6);   // tilt ram + link
      tube(g, [-2.0, 1.25, s * .75], [-2.15, .12, s * 1.3], .07, M.dark, 8); box(g, .46, .06, .4, M.dark, -2.15, .06, s * 1.32);   // stabiliser + pad
      ram(g, -2.0, 1.55, -2.12, .45, .045, s * 1.05);
      ram(g, -2.4, 1.45, -2.85, 2.9, .06, s * .2);                                                          // boom rams
    });
    tube(g, [2.55, 1.35, -.76], [2.55, 1.35, .76], .06, M.yellow, 8);                                       // arm cross-tube
    bucket(g, 3.2, .38, 2.3, .95, M.dark);
    box(g, .35, 1.0, 1.7, M.yellow, -2.0, 1.25, 0); box(g, .32, .9, .42, M.dark, -2.22, 1.3, 0);            // rear frame + king-post
    link(g, -2.3, 1.45, -3.35, 3.55, .36, .26, .28, M.yellow);                                              // boom
    link(g, -3.05, 3.92, -4.6, 1.75, .26, .17, .22, M.yellow);                                              // dipper
    ram(g, -2.72, 2.05, -3.05, 3.92, .06, 0);                                                               // dipper ram (rear of boom)
    ram(g, -3.5, 3.55, -4.75, 2.2, .05, 0); tube(g, [-4.75, 2.2, 0], [-4.75, 1.72, 0], .035, M.steel, 6);    // bucket ram + link
    var bk = bucket(g, -4.6, 1.75, .65, .68, M.dark); bk.rotation.z = Math.PI * .95;
    g.userData.tick = spin(w);
    return g;
  }

  /* crawler track: frame, sprocket, idler, rollers and individual shoes */
  function track(g, z) {
    var out = z >= 0 ? 1 : -1, cx = 1.6, r = .45, i;
    box(g, 3.0, .34, .34, M.dark, 0, .45, z);                                                               // track frame
    cyl(g, .4, .4, .3, M.steel, -cx, r, z, 'z', 20); cyl(g, .16, .16, .4, M.dark, -cx, r, z, 'z', 10);     // sprocket
    for (i = 0; i < 10; i++) { var a = i * Math.PI / 5; cyl(g, .035, .035, .34, M.dark, -cx + Math.cos(a) * .27, r + Math.sin(a) * .27, z, 'z', 6); }
    cyl(g, .38, .38, .26, M.steel, cx, r, z, 'z', 20); cyl(g, .22, .22, .3, M.dark, cx, r, z, 'z', 14); cyl(g, .08, .08, .36, M.steel, cx, r, z, 'z', 8);   // idler
    for (i = -3; i <= 3; i++) cyl(g, .13, .13, .36, M.steel, i * .42, .18, z, 'z', 10);                     // bottom rollers
    [-.7, .7].forEach(function (x) { cyl(g, .1, .1, .36, M.steel, x, .76, z, 'z', 10); });                  // carrier rollers
    box(g, 2.6, .05, .08, M.dark, 0, .64, z + out * .2);                                                    // guard rail
    var L = 2 * cx, per = 2 * L + 2 * Math.PI * r, n = 48, p = per / n;
    for (i = 0; i < n; i++) {                                                                               // shoes around the stadium path
      var s = i * p, x, y, ang;
      if (s < L) { x = -cx + s; y = 2 * r; ang = 0; }
      else if (s < L + Math.PI * r) { var t = (s - L) / r; x = cx + Math.sin(t) * r; y = r + Math.cos(t) * r; ang = -t; }
      else if (s < 2 * L + Math.PI * r) { x = cx - (s - L - Math.PI * r); y = 0; ang = Math.PI; }
      else { var u = (s - 2 * L - Math.PI * r) / r; x = -cx - Math.sin(u) * r; y = r - Math.cos(u) * r; ang = Math.PI - u; }
      var b = box(g, p * .84, .05, .6, M.dark, x, y, z); b.rotation.z = ang;
    }
  }
  function excavator() {                                                // Poclain-type tracked excavator
    var g = new T.Group();
    track(g, 1.15); track(g, -1.15);
    box(g, 1.7, .4, 2.0, M.dark, 0, .6, 0);
    cyl(g, .85, .85, .22, M.steel, 0, .98, 0, 'y', 32);                                                     // slew ring
    var up = new T.Group(); up.position.y = 1.1; g.add(up);                                                 // slewing upper structure
    prof(up, [[-2.5, 0], [1.6, 0], [1.6, .25], [-2.5, .25]], 2.7, M.yellow);                                // deck
    prof(up, [[-1.95, .25], [.1, .25], [.1, 1.2, .08], [-1.95, 1.27, .08]], 2.62, M.yellow);                // engine house
    prof(up, [[-2.8, .04], [-1.95, .04], [-1.95, 1.32], [-2.58, 1.32, .25], [-2.8, .9, .2]], 2.72, M.navy); // counterweight
    [1.325, -1.325].forEach(function (z) { slats(up, -1.3, .55, z, .7, 5, .11, 'x'); box(up, .5, .7, .02, M.yellow, -.3, .72, z); });
    box(up, 1.3, .02, 1.7, M.yellow, -1.0, 1.255, 0);                                                       // engine hatch
    cyl(up, .09, .09, .3, M.dark, -1.6, 1.4, -.8, 'y', 10); cyl(up, .05, .05, .7, M.dark, -1.6, 1.75, -.8, 'y', 8);   // exhaust
    handrail(up, [[-1.85, 1.27, -1.25], [-.9, 1.27, -1.25], [.0, 1.2, -1.25]], .5);
    prof(up, [[.15, .25], [1.5, .25], [1.56, 1.0], [1.3, 2.0, .12], [.15, 2.0, .08]], 1.0, M.glass, .8);    // cab
    [1.305, .295].forEach(function (z) {
      prof(up, [[.25, .98], [1.47, .98], [1.24, 1.9], [.25, 1.9]], .02, M.glass, z);                        // side glass
      prof(up, [[.25, .34], [1.44, .34], [1.47, .9], [.25, .9]], .02, M.yellow, z);                         // door panel
    });
    prof(up, [[1.548, 1.03], [1.568, 1.03], [1.335, 1.93], [1.315, 1.93]], .84, M.glass, .8);               // front screen
    box(up, .02, .6, .84, M.glass, 1.535, .62, .8);                                                         // lower screen
    prof(up, [[.1, 2.0], [1.36, 2.0], [1.36, 2.08, .04], [.1, 2.08, .04]], 1.08, M.yellow, .8);             // cab roof
    box(up, .1, .1, .16, M.white, 1.38, 2.0, 1.1); box(up, .14, .035, .03, M.dark, .42, .92, 1.32);
    box(up, 1.45, .78, .78, M.yellow, .82, .64, -.94); box(up, 1.2, .02, .6, M.yellow, .82, 1.04, -.94);    // tank / tool box
    handrail(up, [[.2, 1.03, -1.3], [.82, 1.03, -1.3], [1.5, 1.03, -1.3]], .45);
    var z = -.2;
    prof(up, [[.95, .4], [3.0, 3.0, .5], [5.2, 2.55], [5.25, 2.95], [2.85, 3.75, .5], [.55, .7]], .44, M.yellow, z);   // mono boom
    cyl(up, .2, .2, .5, M.yellow, .78, .55, z, 'z', 14); cyl(up, .16, .16, .5, M.yellow, 5.2, 2.75, z, 'z', 14);
    [.33, -.33].forEach(function (d) { ram(up, 1.4, .42, 2.78, 2.72, .1, z + d); });                        // boom rams
    prof(up, [[4.98, 3.3], [5.3, 3.24], [5.46, 2.6], [5.63, .3], [5.4, .25], [5.02, 2.6]], .34, M.yellow, z);   // stick
    ram(up, 3.3, 3.88, 5.08, 3.26, .1, z);                                                                  // stick ram
    box(up, .3, .2, .3, M.yellow, 3.25, 3.72, z);
    ram(up, 5.52, 2.85, 5.88, 1.1, .08, z);                                                                 // bucket ram
    tube(up, [5.88, 1.1, z], [5.55, .78, z], .04, M.steel, 6); tube(up, [5.88, 1.1, z], [5.98, .5, z], .04, M.steel, 6);
    var bk = bucket(up, 5.5, .3, 1.0, .95, M.dark); bk.position.z = z; bk.rotation.z = -Math.PI * .62;
    g.userData.tick = function (t) { up.rotation.y = Math.sin(t * .35) * .5; };
    return g;
  }

  function loader() {                                                   // articulated wheel loader
    var g = new T.Group(), w = [];
    prof(g, [[-3.35, .95], [-.45, .95], [-.45, 1.9], [-1.5, 2.1], [-3.1, 2.15, .2], [-3.42, 1.8, .15]], 2.2, M.yellow);   // rear frame + engine hood
    box(g, .05, .75, 1.6, M.dark, -3.43, 1.45, 0); slats(g, -3.46, 1.18, 0, 1.5, 5, .13, 'z');              // rear grille
    box(g, .45, .42, 2.36, M.dark, -3.32, .9, 0);                                                            // counterweight
    [1.11, -1.11].forEach(function (z) { slats(g, -2.55, 1.5, z, .8, 4, .11, 'x'); });
    cyl(g, .1, .1, .35, M.dark, -2.6, 2.33, .5, 'y', 10); cyl(g, .05, .05, .75, M.dark, -2.6, 2.75, .5, 'y', 8);          // exhaust
    cyl(g, .04, .04, .3, M.dark, -2.2, 2.3, -.5, 'y', 6); cyl(g, .12, .12, .2, M.dark, -2.2, 2.52, -.5, 'y', 12);         // pre-cleaner
    prof(g, [[-1.75, 2.05], [-.3, 2.0], [-.2, 2.5], [-.4, 3.7, .12], [-1.75, 3.7, .1]], 1.55, M.glass);     // cab
    [.785, -.785].forEach(function (z) {
      prof(g, [[-1.0, 2.58], [-.3, 2.58], [-.47, 3.58], [-1.0, 3.58]], .02, M.glass, z);
      prof(g, [[-1.66, 2.58], [-1.08, 2.58], [-1.08, 3.58], [-1.66, 3.58]], .02, M.glass, z);
      prof(g, [[-1.66, 2.12], [-.3, 2.08], [-.28, 2.5], [-1.66, 2.5]], .02, M.yellow, z);
    });
    prof(g, [[-.203, 2.52], [-.183, 2.52], [-.375, 3.6], [-.395, 3.6]], 1.36, M.glass);                     // front screen
    box(g, .02, 1.0, 1.36, M.glass, -1.76, 3.08, 0);
    prof(g, [[-1.88, 3.7], [-.25, 3.7], [-.25, 3.82, .05], [-1.88, 3.82, .05]], 1.75, M.yellow);            // roof
    [.6, -.6].forEach(function (z) { box(g, .1, .1, .18, M.white, -.2, 3.64, z); box(g, .1, .1, .18, M.white, -1.92, 3.64, z); });
    cyl(g, .07, .07, .14, M.blush, -1.0, 3.89, .45, 'y', 10);
    cyl(g, .22, .22, 1.0, M.steel, -.3, 1.35, 0, 'y', 16);                                                  // articulation joint
    prof(g, [[-.1, .9], [1.9, .9], [1.9, 1.5], [1.3, 2.2], [.2, 2.2], [-.1, 1.8]], 1.3, M.yellow);          // front frame / tower
    [1, -1].forEach(function (s) {
      wheel(g, .85, .6, -1.75, s * 1.2, w, { lug: 20, nuts: 10 }); wheel(g, .85, .6, 1.15, s * 1.2, w, { lug: 20, nuts: 10 });
      arc(g, .96, .04, .66, -1.75, .85, s * 1.2, 15, 165, M.yellow); arc(g, .96, .04, .66, 1.15, .85, s * 1.2, 60, 170, M.yellow);   // fenders
      box(g, .36, .05, .3, M.dark, -.62, 1.02, s * 1.13); box(g, .36, .05, .3, M.dark, -.62, 1.45, s * 1.13);   // steps
      tube(g, [-.4, 1.5, s * 1.25], [-.3, 2.6, s * .85], .025, M.dark, 6);                                   // grab rail
      prof(g, [[.35, 2.3], [.6, 2.0], [2.4, 1.55, .4], [3.35, .6], [3.5, .85], [2.6, 1.95, .4], [.6, 2.4]], .12, M.yellow, s * .78);   // lift arm
      ram(g, .85, 1.25, 2.3, 1.68, .08, s * .62);                                                           // lift ram
      box(g, .16, .12, .3, M.white, 1.75, 1.72, s * .95);                                                   // head lamp
    });
    tube(g, [2.5, 1.72, -.78], [2.5, 1.72, .78], .09, M.yellow, 10);                                        // arm cross-tube
    ram(g, .75, 2.32, 2.02, 2.62, .09, 0);                                                                  // tilt ram
    link(g, 2.02, 2.62, 2.68, 1.42, .2, .16, .14, M.yellow);                                                // bell-crank
    link(g, 2.68, 1.42, 3.3, 1.22, .1, .1, .1, M.steel);                                                    // bucket link
    bucket(g, 3.3, .35, 2.9, 1.3, M.dark);
    g.userData.tick = spin(w);
    return g;
  }

  function compactor() {                                                // single-drum soil compactor
    var g = new T.Group(), w = [], i;
    var drum = new T.Group(); drum.position.set(1.9, .8, 0); g.add(drum);
    cyl(drum, .8, .8, 2.13, M.steel, 0, 0, 0, 'z', 44);
    [1, -1].forEach(function (s) {
      cyl(drum, .64, .64, .04, M.steel, 0, 0, s * 1.07, 'z', 32); cyl(drum, .22, .22, .12, M.dark, 0, 0, s * 1.1, 'z', 14);
      for (i = 0; i < 8; i++) cyl(drum, .03, .03, .05, M.dark, Math.cos(i * Math.PI / 4) * .46, Math.sin(i * Math.PI / 4) * .46, s * 1.1, 'z', 6);
      box(g, 2.55, .3, .12, M.yellow, 1.72, .95, s * 1.2);                                                  // drum yoke
      cyl(g, .3, .3, .1, M.yellow, 1.9, .8, s * 1.2, 'z', 16);
      wheel(g, .78, .55, -1.5, s * 1.02, w, { lug: 18, nuts: 8 });
      arc(g, .88, .035, .58, -1.5, .78, s * 1.02, 25, 155, M.yellow);
      slats(g, -1.75, 1.2, s * .96, .7, 4, .11, 'x');
      box(g, .1, .1, .16, M.white, .38, 1.5, s * .6);
    });
    box(g, .22, .5, 2.52, M.yellow, 2.9, .95, 0); box(g, .06, .3, 2.1, M.dark, 2.76, .55, 0);               // front cross-member + scraper
    box(g, .22, .6, 2.52, M.yellow, .55, 1.0, 0);
    cyl(g, .2, .2, .8, M.steel, .38, 1.05, 0, 'y', 14);                                                     // articulation
    prof(g, [[-2.65, .8], [.3, .8], [.3, 1.6], [-.9, 1.75], [-2.4, 2.0, .15], [-2.72, 1.7, .12]], 1.9, M.yellow);   // rear body + hood
    box(g, .05, .65, 1.4, M.dark, -2.72, 1.3, 0); slats(g, -2.75, 1.08, 0, 1.3, 4, .13, 'z');
    cyl(g, .08, .08, .3, M.dark, -2.1, 2.1, .5, 'y', 10); cyl(g, .045, .045, .6, M.dark, -2.1, 2.45, .5, 'y', 8);   // exhaust
    box(g, 1.3, .06, 1.7, M.dark, -.5, 1.78, 0);                                                            // operator platform
    box(g, .5, .14, .5, M.dark, -.7, 2.1, 0); box(g, .1, .6, .5, M.dark, -.95, 2.42, 0); box(g, .3, .3, .3, M.dark, -.7, 1.92, 0);   // seat
    box(g, .22, .75, .5, M.dark, .1, 2.15, 0); tube(g, [.05, 2.5, 0], [-.18, 2.78, 0], .025, M.dark, 6);    // console + steering column
    var sw = sh(new T.Mesh(new T.TorusGeometry(.19, .022, 6, 20), M.dark)); sw.position.set(-.18, 2.78, 0); sw.rotation.set(0, Math.PI / 2, 0); sw.rotateX(-.7); g.add(sw);
    [[.12, .8], [.12, -.8], [-1.15, .8], [-1.15, -.8]].forEach(function (p) { box(g, .09, 1.75, .09, M.dark, p[0], 2.65, p[1]); });   // ROPS posts
    prof(g, [[-1.3, 3.5], [.28, 3.5], [.28, 3.6, .04], [-1.3, 3.6, .04]], 1.85, M.navy);                    // canopy
    handrail(g, [[.12, 1.8, .8], [.12, 1.8, -.8]], .8); cyl(g, .07, .07, .14, M.blush, -.5, 3.67, .5, 'y', 10);
    g.userData.tick = function (t) { spin(w)(t); drum.rotation.z = -t * 1.1; };
    return g;
  }

  /* ---------- plant parts ---------- */
  function silo(g, x, z, r, h, base, m, cap) {                          // banded shell on braced legs with a cone outlet
    var y0 = base + r * 1.1, top = y0 + h, i, k = r * .74;
    cyl(g, r, r, h, m, x, y0 + h / 2, z, 'y', 32);
    for (i = 1; i <= 3; i++) cyl(g, r + .03, r + .03, .1, m, x, y0 + h * i / 4, z, 'y', 32);               // shell bands
    cyl(g, r, r * .22, r * 1.1, m, x, base + r * .55, z, 'y', 32);                                          // cone
    cyl(g, r * .24, r * .24, .3, M.steel, x, base - .12, z, 'y', 14); box(g, r * .7, .08, r * .7, M.steel, x, base - .3, z);   // outlet + gate
    cyl(g, r * .86, r + .02, .28, cap || M.navy, x, top + .14, z, 'y', 32);                                 // roof
    box(g, r * .6, .5, r * .6, M.steel, x - r * .2, top + .5, z);                                           // dust filter
    var ring = [];
    for (i = 0; i < 10; i++) ring.push([x + Math.cos(i * Math.PI / 5) * r * .93, top + .26, z + Math.sin(i * Math.PI / 5) * r * .93]);
    handrail(g, ring, .9, true);
    var legH = y0 + .5;
    [[1, 1], [1, -1], [-1, -1], [-1, 1]].forEach(function (s, j, all) {
      var n = all[(j + 1) % 4], ax = x + s[0] * k, az = z + s[1] * k, bx = x + n[0] * k, bz = z + n[1] * k;
      box(g, .16, legH, .16, M.steel, ax, legH / 2, az);
      tube(g, [ax, base * .52, az], [bx, base * .52, bz], .045, M.steel, 6);
      tube(g, [ax, .25, az], [bx, base * .52, bz], .035, M.steel, 6); tube(g, [bx, .25, bz], [ax, base * .52, az], .035, M.steel, 6);   // X bracing
      box(g, .34, .04, .34, M.steel, ax, .02, az);
    });
    ladder(g, [x, .3, z + r + .1], [x, top + .3, z + r + .1], [1, 0, 0], .45);
    tube(g, [x + r + .14, .9, z - .3], [x + r + .14, top + .55, z - .3], .07, M.steel, 8);                 // fill pipe
    tube(g, [x + r + .14, top + .55, z - .3], [x + r * .3, top + .55, z - .1], .07, M.steel, 8);
  }
  function hopperRow(g, x, n, m) {                                       // cold-feed / aggregate bins on a collecting belt
    for (var i = 0; i < n; i++) {
      var cx = x + i * 2.0;
      var o = sh(new T.Mesh(new T.CylinderGeometry(1.28, .32, 1.6, 4, 1), m)); o.rotation.y = Math.PI / 4; o.position.set(cx, 2.5, 0); g.add(o);
      box(g, 1.85, .55, 1.85, m, cx, 3.57, 0); box(g, 1.93, .08, 1.93, m, cx, 3.86, 0);                    // upper bin + rim
      for (var k = -2; k <= 2; k++) tube(g, [cx - .9, 3.92, k * .4], [cx + .9, 3.92, k * .4], .025, M.steel, 5);   // grizzly bars
      box(g, .5, .28, .9, M.steel, cx, 1.62, 0);                                                           // feeder
      [[.8, .8], [.8, -.8], [-.8, .8], [-.8, -.8]].forEach(function (s) { box(g, .12, 3.3, .12, M.steel, cx + s[0], 1.65, s[1]); });
      [.8, -.8].forEach(function (z) { tube(g, [cx - .8, 1.0, z], [cx + .8, 1.0, z], .035, M.steel, 6); tube(g, [cx - .8, .2, z], [cx + .8, 1.0, z], .03, M.steel, 6); });
    }
    var L = n * 2.0 + .6, mx = x + (n - 1);
    [.36, -.36].forEach(function (z) { box(g, L, .14, .05, M.dark, mx, 1.3, z); });                        // collecting belt frame
    box(g, L, .03, .6, M.dark, mx, 1.4, 0);
    for (var j = 0; j <= Math.round(L / .7); j++) cyl(g, .05, .05, .68, M.steel, mx - L / 2 + j * .7, 1.32, 0, 'z', 8);
  }
  function conveyor(g, x1, y1, x2, y2, z) {                              // inclined belt conveyor on trestles
    z = z || 0;
    var dx = x2 - x1, dy = y2 - y1, L = Math.sqrt(dx * dx + dy * dy), i, f;
    [.42, -.42].forEach(function (s) { beam(g, x1, y1, x2, y2, .2, .06, M.dark, z + s); });                // stringers
    beam(g, x1, y1 + .14, x2, y2 + .14, .03, .7, M.dark, z);                                               // belt
    var n = Math.round(L / .8);
    for (i = 0; i <= n; i++) { f = i / n; cyl(g, .055, .055, .8, M.steel, x1 + dx * f, y1 + dy * f + .06, z, 'z', 8); }   // idlers
    cyl(g, .2, .2, .86, M.steel, x2, y2 + .02, z, 'z', 16); cyl(g, .16, .16, .86, M.steel, x1, y1 + .02, z, 'z', 14);     // head + tail pulleys
    n = Math.max(2, Math.round(Math.abs(dx) / 2.6));
    for (i = 1; i <= n; i++) {
      f = i / (n + .25); var x = x1 + dx * f, y = y1 + dy * f - .1;
      if (y > .7) { [.4, -.4].forEach(function (s) { box(g, .1, y, .1, M.steel, x, y / 2, z + s); }); tube(g, [x, .2, z + .4], [x, y * .85, z - .4], .03, M.steel, 6); tube(g, [x, .2, z - .4], [x, y * .85, z + .4], .03, M.steel, 6); }
    }
    var pts = []; n = Math.max(2, Math.round(L / 1.6));
    for (i = 0; i <= n; i++) { f = i / n; pts.push([x1 + dx * f, y1 + dy * f + .1, z + .48]); }
    handrail(g, pts, .8);
  }
  function cabin(g, x, z) {                                              // control cabin
    box(g, 2.6, 2.2, 2.2, M.cream, x, 1.4, z); box(g, 2.6, .3, 2.2, M.dark, x, .15, z);
    box(g, 2.8, .1, 2.4, M.navy, x, 2.55, z);
    box(g, 1.7, .85, .04, M.glass, x, 1.75, z + 1.11); box(g, .03, .85, .05, M.dark, x, 1.75, z + 1.13);    // front window + mullion
    box(g, .04, .85, 1.3, M.glass, x + 1.31, 1.75, z);
    box(g, .75, 1.75, .04, M.navy, x - .7, 1.2, z - 1.11); box(g, .08, .03, .05, M.dark, x - .45, 1.2, z - 1.14);   // door
    box(g, .9, .06, .5, M.steel, x - .7, .3, z - 1.4); box(g, .9, .06, .3, M.steel, x - .7, .12, z - 1.75);          // steps
    box(g, .7, .45, .3, M.steel, x + .5, 2.0, z - 1.26);                                                    // air conditioner
  }
  function stack(g, x, z, h) {                                           // flanged exhaust stack with ladder
    cyl(g, .32, .42, h, M.steel, x, h / 2, z, 'y', 20);
    for (var y = 2.5; y < h - .5; y += 2.5) cyl(g, .4, .4, .08, M.steel, x, y, z, 'y', 20);
    cyl(g, .38, .38, .3, M.plum, x, h - .4, z, 'y', 20); box(g, 1.0, .1, 1.0, M.steel, x, .05, z);
    ladder(g, [x + .48, .3, z], [x + .42, h - 1, z], [0, 0, 1], .4);
  }
  function dryer(g, x1, x2, y, z) {                                      // rotating dryer drum on a braced frame
    var L = x2 - x1, d = new T.Group(); d.position.set((x1 + x2) / 2, y, z || 0); d.rotation.z = .05; g.add(d);
    var r = new T.Group(), i; d.add(r);
    cyl(r, 1.05, 1.05, L, M.navy, 0, 0, 0, 'x', 36);
    [-L * .32, L * .32].forEach(function (x) { cyl(r, 1.16, 1.16, .26, M.steel, x, 0, 0, 'x', 36); });      // riding rings
    cyl(r, 1.2, 1.2, .16, M.steel, -L * .08, 0, 0, 'x', 36);                                                // girth gear
    for (i = 0; i < 24; i++) { var t = box(r, .16, .08, .1, M.steel, -L * .08, 0, 0); t.position.set(-L * .08, Math.cos(i * Math.PI / 12) * 1.23, Math.sin(i * Math.PI / 12) * 1.23); t.rotation.x = i * Math.PI / 12; }
    for (i = 0; i < 6; i++) { var f = box(r, L * .2, .07, .07, M.sky, L * .18, 0, 0); f.position.set(L * .18, Math.cos(i * Math.PI / 3) * 1.07, Math.sin(i * Math.PI / 3) * 1.07); f.rotation.x = i * Math.PI / 3; }
    cyl(d, 1.12, 1.12, .5, M.steel, L / 2 + .2, 0, 0, 'x', 28); cyl(d, .5, .8, 1.2, M.plum, L / 2 + 1.0, 0, 0, 'x', 20);   // burner end + burner
    cyl(d, .45, .45, .5, M.steel, L / 2 + 1.3, -.75, .5, 'z', 16);                                           // blower
    box(d, 1.0, 1.9, 2.3, M.steel, -L / 2 - .4, .15, 0);                                                     // feed chute
    [1.0, -1.0].forEach(function (s) { box(d, L * .92, .24, .16, M.steel, 0, -1.42, s); });                  // base frame
    [-L * .32, L * .32].forEach(function (x) {
      [.72, -.72].forEach(function (s) { cyl(d, .24, .24, .3, M.steel, x, -1.12, s, 'x', 14); box(d, .5, .2, .4, M.steel, x, -1.36, s); });   // trunnion rollers
      var gx = (x1 + x2) / 2 + x, hgt = y - 1.5;
      [.95, -.95].forEach(function (s) { box(g, .2, hgt, .2, M.steel, gx, hgt / 2, (z || 0) + s); });
      tube(g, [gx, .2, (z || 0) + .95], [gx, hgt * .9, (z || 0) - .95], .04, M.steel, 6); tube(g, [gx, .2, (z || 0) - .95], [gx, hgt * .9, (z || 0) + .95], .04, M.steel, 6);
    });
    return r;
  }
  function tankH(g, x, z, L, r) {                                        // horizontal tank on saddles
    cyl(g, r, r, L, M.dark, x, r + .5, z, 'x', 28);
    [-1, 1].forEach(function (s) {
      var e = sh(new T.Mesh(new T.SphereGeometry(r, 20, 10), M.dark)); e.scale.set(.28, 1, 1); e.position.set(x + s * L / 2, r + .5, z); g.add(e);   // dished ends
      cyl(g, r + .025, r + .025, .1, M.steel, x + s * L * .3, r + .5, z, 'x', 28);
      box(g, .35, r + .5, r * 1.7, M.steel, x + s * L * .3, (r + .5) / 2, z);
    });
    cyl(g, .28, .28, .3, M.steel, x, r * 2 + .6, z, 'y', 14); cyl(g, .33, .33, .05, M.steel, x, r * 2 + .76, z, 'y', 14);   // manhole
    ladder(g, [x + L * .15, .2, z + r + .06], [x + L * .15, r * 2 + .5, z + r * .5], [1, 0, 0], .4);
    tube(g, [x - L * .2, r * 2 + .45, z], [x - L * .2, r * 2 + 1.0, z], .06, M.steel, 8);
  }
  function bagFilter(g, x, z, w, h, d, m) {                              // filter house on legs with hoppers and access platform
    box(g, w, h, d, m, x, 2.8 + h / 2, z);
    for (var i = 1; i < 5; i++) box(g, .05, h, d + .06, m, x - w / 2 + w * i / 5, 2.8 + h / 2, z);          // panel stiffeners
    [-w / 4, w / 4].forEach(function (dx) { var o = sh(new T.Mesh(new T.CylinderGeometry(Math.min(w / 4, d / 2) * 1.38, .25, 1.4, 4, 1), m)); o.rotation.y = Math.PI / 4; o.position.set(x + dx, 2.1, z); g.add(o); });
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (s) { box(g, .2, 2.8, .2, M.steel, x + s[0] * (w / 2 - .1), 1.4, z + s[1] * (d / 2 - .1)); });
    [1, -1].forEach(function (s) { tube(g, [x - w / 2 + .1, .2, z + s * (d / 2 - .1)], [x + w / 2 - .1, 2.6, z + s * (d / 2 - .1)], .04, M.steel, 6); });
    walkway(g, x, 2.8 + h + .04, z, w, d, m);
    ladder(g, [x + w / 2 + .1, .2, z], [x + w / 2 + .1, 2.8 + h + 1, z], [0, 0, 1], .45);
  }

  function rmcPlant() {                                                  // ready-mix concrete plant
    var g = new T.Group();
    hopperRow(g, -15, 4, M.sky);
    conveyor(g, -8.4, 1.6, -1.2, 9.4);
    [[1.6, 1.6], [1.6, -1.6], [-1.6, -1.6], [-1.6, 1.6]].forEach(function (s, j, all) {                     // tower legs (truck bay below)
      var n = all[(j + 1) % 4];
      box(g, .28, 5.2, .28, M.steel, s[0], 2.6, s[1]);
      if (j !== 3 && j !== 1) { tube(g, [s[0], 3.6, s[1]], [n[0], 5.1, n[1]], .05, M.steel, 6); tube(g, [n[0], 3.6, n[1]], [s[0], 5.1, s[1]], .05, M.steel, 6); }
    });
    walkway(g, 0, 5.24, 0, 5.0, 5.0);
    box(g, 3.6, 3.2, 3.6, M.navy, 0, 6.95, 0);                           // mixer house
    [-1.0, 0, 1.0].forEach(function (y) { box(g, 3.66, .05, 3.66, M.navy, 0, 6.95 + y, 0); });              // cladding lines
    box(g, 1.2, .7, .04, M.glass, .6, 7.2, 1.82); box(g, .8, 1.8, .04, M.navy, -1.0, 6.3, 1.82);            // window + door
    box(g, 3.9, .2, 3.9, M.cream, 0, 8.65, 0);
    box(g, 2.6, 1.6, 2.6, M.cream, -.3, 9.55, 0);                        // weigh hopper deck
    handrail(g, [[1.9, 8.75, -1.9], [1.9, 8.75, 0], [1.9, 8.75, 1.9], [0, 8.75, 1.9], [-1.9, 8.75, 1.9]], .9);
    cyl(g, 1.0, .35, 1.0, M.yellow, 0, 4.6, 0, 'y', 24); cyl(g, .36, .3, .5, M.dark, 0, 3.9, 0, 'y', 16);   // discharge cone + boot
    [3.6, 6.4, 9.2].forEach(function (x, i) {
      var z = i % 2 ? -.6 : .6;
      silo(g, x, z, 1.25, 6.5, 4.6, M.cream, M.plum);
      tube(g, [x - .1, 4.5, z], [.9, 8.9, z * .5], .16, M.steel, 10);                                       // cement screw conveyor
      cyl(g, .22, .22, .5, M.dark, x - .1, 4.4, z, 'z', 12);
    });
    ladder(g, [2.1, .2, 2.56], [2.1, 6.2, 2.56], [1, 0, 0], .45);
    tankH(g, -4.5, -3.6, 3.4, .8);                                       // water tank
    cabin(g, -4.2, 3.6);
    g.userData.bay = new T.Vector3(0, 0, 0);                             // where a transit mixer parks to load
    return g;
  }

  function hotMixPlant() {                                               // drum-type hot mix (asphalt) plant
    var g = new T.Group();
    hopperRow(g, -17, 4, M.yellow);
    conveyor(g, -10.4, 1.6, -6.4, 4.0);
    var r = dryer(g, -5.6, 2.6, 3.9, 0);
    box(g, 1.0, 9.5, 1.0, M.steel, 3.9, 4.75, 0);                         // drag elevator
    for (var y = 1.5; y < 9.4; y += 1.5) box(g, 1.06, .08, 1.06, M.steel, 3.9, y, 0);
    box(g, 1.3, .9, 1.2, M.steel, 3.9, 9.9, 0); cyl(g, .3, .3, .5, M.dark, 3.9, 9.9, .8, 'z', 12);          // elevator head + drive
    beam(g, 4.3, 9.6, 6.6, 10.6, .5, .9, M.steel);
    ladder(g, [3.9, .2, -.56], [3.9, 9.4, -.56], [1, 0, 0], .45);
    silo(g, 7.2, 0, 1.6, 4.2, 4.8, M.cream, M.plum);                      // storage silo, trucks load beneath
    bagFilter(g, -2.2, -4.6, 4.6, 3.4, 2.8, M.sky);
    tube(g, [-5.9, 4.6, -.6], [-5.9, 7.2, -.6], .32, M.steel, 12); tube(g, [-5.9, 7.2, -.6], [-3.6, 7.2, -4.2], .32, M.steel, 12);   // dust duct: drum -> filter
    tube(g, [.1, 5.2, -4.6], [1.0, 3.0, -4.6], .3, M.steel, 12);                                           // filter -> fan -> stack
    cyl(g, .6, .6, .5, M.steel, .8, 1.2, -4.6, 'z', 20); box(g, 1.2, .2, 1.0, M.steel, .8, .4, -4.6);
    stack(g, 1.9, -4.6, 11);
    tankH(g, -9.5, -5.0, 5.2, 1.1); tankH(g, -9.5, -7.8, 5.2, 1.1);       // bitumen tanks
    tube(g, [-6.9, 1.2, -5.0], [-4.2, 1.2, -5.0], .06, M.steel, 8); tube(g, [-4.2, 1.2, -5.0], [-4.2, 1.2, -1.2], .06, M.steel, 8);   // bitumen line
    cabin(g, 2.4, 4.6);
    g.userData.tick = function (t) { r.rotation.x = t * .8; };
    g.userData.bay = new T.Vector3(7.2, 0, 0);
    return g;
  }

  function batchMixPlant() {                                             // tower-type batch mix plant
    var g = new T.Group();
    hopperRow(g, -18, 4, M.yellow);
    conveyor(g, -11.4, 1.6, -8.0, 3.5);
    var r = dryer(g, -7.2, .2, 3.4, 0);
    box(g, 1.0, 15.5, 1.0, M.steel, 1.3, 7.75, -1.2);                     // hot elevator
    for (var y = 1.5; y < 15.4; y += 1.5) box(g, 1.06, .08, 1.06, M.steel, 1.3, y, -1.2);
    box(g, 1.3, .9, 1.2, M.steel, 1.3, 15.9, -1.2); cyl(g, .3, .3, .5, M.dark, 1.3, 15.9, -.4, 'z', 12);
    [[2.2, 1.9], [2.2, -1.9], [6.0, -1.9], [6.0, 1.9]].forEach(function (p, j, all) {                       // tower legs, truck bay
      var n = all[(j + 1) % 4];
      box(g, .3, 4.6, .3, M.steel, p[0], 2.3, p[1]);
      if (j === 0 || j === 2) { tube(g, [p[0], 3.2, p[1]], [n[0], 4.5, n[1]], .05, M.steel, 6); tube(g, [n[0], 3.2, n[1]], [p[0], 4.5, p[1]], .05, M.steel, 6); }
    });
    box(g, 4.4, 2.2, 4.4, M.navy, 4.1, 5.8, 0);                           // pugmill
    box(g, 4.2, 2.1, 4.2, M.cream, 4.1, 8.1, 0);                          // weigh hoppers
    box(g, 4.4, 2.9, 4.4, M.navy, 4.1, 10.7, 0);                          // hot bins
    box(g, 4.0, 2.3, 4.0, M.cream, 4.1, 13.4, 0);                         // screen deck
    box(g, 4.6, .2, 4.6, M.plum, 4.1, 14.7, 0);
    [[5.8, .7], [8.1, .6], [10.7, 1.0], [13.4, .7]].forEach(function (p) { [-1, 0, 1].forEach(function (k) { box(g, p[0] > 9 && p[0] < 12 ? 4.46 : 4.26, .04, p[0] > 9 && p[0] < 12 ? 4.46 : 4.26, M.steel, 4.1, p[0] + k * p[1], 0); }); });   // cladding lines
    cyl(g, .9, .35, .9, M.yellow, 4.1, 4.2, 0, 'y', 20);                  // discharge chute
    [4.66, 6.95, 9.2, 12.2].forEach(function (y) { walkway(g, 4.1, y, 0, 5.6, 5.6); });
    ladder(g, [7.0, .2, 2.4], [7.0, 14.8, 2.4], [1, 0, 0], .45);
    beam(g, 1.3, 15.6, 3.2, 14.6, .5, .8, M.steel, -1.2);
    silo(g, 9.6, -1.0, 1.1, 7.5, 3.0, M.cream, M.plum);                    // filler silo
    tube(g, [9.3, 2.9, -1.0], [6.2, 8.2, -.6], .14, M.steel, 10);
    bagFilter(g, -3.4, -5.2, 4.8, 3.6, 3.0, M.sky);
    tube(g, [-7.5, 4.1, -.6], [-7.5, 7.6, -.6], .32, M.steel, 12); tube(g, [-7.5, 7.6, -.6], [-4.8, 7.6, -4.8], .32, M.steel, 12);
    tube(g, [-1.0, 5.4, -5.2], [-.3, 3.0, -5.2], .3, M.steel, 12);
    cyl(g, .6, .6, .5, M.steel, -.4, 1.2, -5.2, 'z', 20); box(g, 1.2, .2, 1.0, M.steel, -.4, .4, -5.2);
    stack(g, .8, -5.2, 13);
    tankH(g, -11.5, -5.4, 5.2, 1.1); tankH(g, -11.5, -8.2, 5.2, 1.1);
    cabin(g, 9.0, 4.8);
    g.userData.tick = function (t) { r.rotation.x = t * .8; };
    g.userData.bay = new T.Vector3(4.1, 0, 0);
    return g;
  }

  /* Technical-drawing renderer: draws the scene as ink outlines only (no colour, no shading), like an
     engineering line drawing. Pass 1 renders view-space normals, a per-part id and depth off screen;
     pass 2 inks every silhouette, crease and part boundary found in them onto a transparent background.
     The outer silhouette is drawn heavier than the inner detail, as on a drafted sheet.
     var d = Machines.drawing(renderer, { ink: 0x17233b });  d.setSize(w, h, pixelRatio);  d.render(scene, cam, radius); */
  function tagParts(g) {                                                  // give every mesh its own id (vertex attribute)
    var i = 0;
    g.traverse(function (m) {
      if (!m.isMesh || m.geometry.getAttribute('pid')) return;
      var n = m.geometry.getAttribute('position').count, a = new Float32Array(n), v = ((++i * 37) % 251 + 2) / 255;
      for (var k = 0; k < n; k++) a[k] = v;
      m.geometry.setAttribute('pid', new T.BufferAttribute(a, 1));
    });
    return g;
  }
  function drawing(renderer, o) {
    o = o || {};
    var target = new T.WebGLRenderTarget(4, 4, { minFilter: T.NearestFilter, magFilter: T.NearestFilter });
    target.depthTexture = new T.DepthTexture(4, 4); target.depthTexture.type = T.UnsignedIntType;
    var partMat = new T.ShaderMaterial({                                  // rg = view normal xy, b = part id, a = covered
      side: T.DoubleSide,
      vertexShader: 'attribute float pid; varying vec3 vN; varying float vId; void main(){ vN = normalMatrix * normal; vId = pid; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: 'varying vec3 vN; varying float vId; void main(){ vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n; gl_FragColor = vec4(n.xy * .5 + .5, vId, 1.); }'
    });
    var ink = new T.Color(o.ink == null ? PAL.navy : o.ink);
    var quad = new T.Mesh(new T.PlaneGeometry(2, 2), new T.ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false,
      uniforms: { tN: { value: target.texture }, tZ: { value: target.depthTexture }, px: { value: new T.Vector2() },
                  near: { value: 1 }, far: { value: 10 }, unit: { value: 1 }, ink: { value: ink }, weight: { value: o.weight || 1 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
      fragmentShader: [
        'precision highp float;',
        'uniform sampler2D tN, tZ; uniform vec2 px; uniform float near, far, unit, weight; uniform vec3 ink; varying vec2 vUv;',
        'float z(vec2 uv){ float d = texture2D(tZ, uv).x * 2. - 1.; return 2. * near * far / (far + near - d * (far - near)); }',
        'vec3 n(vec4 c){ if (c.a < .5) return vec3(0.); vec2 xy = c.xy * 2. - 1.; return vec3(xy, sqrt(max(0., 1. - dot(xy, xy)))); }',
        'float edge(vec2 e, out float outer){',
        '  vec2 a = vUv + e * vec2(-1., -1.), b = vUv + e * vec2(1., 1.), c = vUv + e * vec2(-1., 1.), d = vUv + e * vec2(1., -1.);',
        '  vec4 A = texture2D(tN, a), B = texture2D(tN, b), C = texture2D(tN, c), D = texture2D(tN, d);',
        '  float dn = length(n(A) - n(B)) + length(n(C) - n(D));',
        '  float di = abs(A.b - B.b) + abs(C.b - D.b);',
        '  float dz = (abs(z(a) - z(b)) + abs(z(c) - z(d))) / unit;',
        '  float facing = max(n(texture2D(tN, vUv)).z, .12);',             // don't ink surfaces merely seen edge-on
        '  outer = step(.5, abs(A.a - B.a) + abs(C.a - D.a));',
        '  return max(max(smoothstep(.35, .8, dn), step(.002, di)), smoothstep(.012, .03, dz * facing));',
        '}',
        'void main(){',
        '  float o1, o2; float k = edge(px * weight, o1); edge(px * weight * 1.35, o2);',
        '  k = max(k * .92, o2);',
        '  gl_FragColor = vec4(ink * k, k);',
        '}'].join('\n')
    }));
    var post = new T.Scene(); post.add(quad);
    var ortho = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    return {
      setSize: function (w, h, ratio, weight) {
        renderer.setPixelRatio(ratio); renderer.setSize(w, h, false);
        if (weight) quad.material.uniforms.weight.value = weight;
        var W = Math.round(w * ratio), H = Math.round(h * ratio);
        target.setSize(W, H); quad.material.uniforms.px.value.set(1 / W, 1 / H);
      },
      /* unit = model radius in metres (sets how big a depth step counts as an edge) */
      render: function (scene, cam, unit) {
        var u = quad.material.uniforms; u.near.value = cam.near; u.far.value = cam.far; u.unit.value = unit || 1;
        scene.overrideMaterial = partMat;
        renderer.setRenderTarget(target); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, cam);
        scene.overrideMaterial = null;
        renderer.setRenderTarget(null); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(post, ortho);
      }
    };
  }

  window.Machines = {
    palette: PAL, mats: M, studio: studio, drawing: drawing, parts: { box: box, cyl: cyl, beam: beam, prof: prof, wheel: wheel, tube: tube, link: link, ram: ram, arc: arc, ladder: ladder, handrail: handrail },
    build: {},
    /* names exactly as supplied by the client */
    fleet: [
      { key: 'rmcPlant', name: 'ReadyMix Plant' }, { key: 'hotMixPlant', name: 'Hot Mix Plant' },
      { key: 'batchMixPlant', name: 'Batch Mix Plant' }, { key: 'tipper', name: 'Tipper Truck' },
      { key: 'mixer', name: 'TM Truck' }, { key: 'backhoe', name: 'JCB' },
      { key: 'excavator', name: 'Poclain' }, { key: 'loader', name: 'Loader' },
      { key: 'compactor', name: 'Soil Compactor' }
    ]
  };
  /* JCB, Poclain, loader and soil compactor parked two by two (shown as one entry in the fleet list) */
  function earthmovers() {
    var g = new T.Group(), parts = [[backhoe(), 3.6, 6.2], [compactor(), -3.6, 6.4], [loader(), 3.8, -5.6], [excavator(), -3.8, -7.4]];   // [machine, z, x]: two rows of two
    parts.forEach(function (p) { p[0].position.set(p[2], 0, p[1]); g.add(p[0]); });
    g.userData.tick = function (t) { parts.forEach(function (p) { if (p[0].userData.tick) p[0].userData.tick(t); }); };
    return g;
  }

  var builders = { tipper: tipper, mixer: mixer, backhoe: backhoe, excavator: excavator, loader: loader, compactor: compactor,
                   rmcPlant: rmcPlant, hotMixPlant: hotMixPlant, batchMixPlant: batchMixPlant, earthmovers: earthmovers };
  Object.keys(builders).forEach(function (k) { window.Machines.build[k] = function () { return tagParts(builders[k]()); }; });
})();
