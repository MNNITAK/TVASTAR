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
  /* side-profile [x,y] points extruded across the machine's width */
  function prof(g, pts, width, m, z) {
    var s = new T.Shape(); s.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
    s.closePath();
    var geo = new T.ExtrudeGeometry(s, { depth: width, bevelEnabled: false });
    geo.translate(0, 0, -width / 2);
    var o = sh(new T.Mesh(geo, m)); o.position.z = z || 0; g.add(o); return o;
  }
  function wheel(g, r, w, x, z, list) {
    var wg = new T.Group(); wg.position.set(x, r, z);
    cyl(wg, r, r, w, M.dark, 0, 0, 0, 'z', 28);
    cyl(wg, r * .55, r * .55, w + .04, M.steel, 0, 0, 0, 'z', 18);
    cyl(wg, r * .18, r * .18, w + .1, M.dark, 0, 0, 0, 'z', 10);
    g.add(wg); if (list) list.push(wg); return wg;
  }
  function spin(list) { return function (t) { for (var i = 0; i < list.length; i++) list[i].rotation.z = -t * 1.2; }; }

  /* ---------- shared truck: chassis, cab, wheels ---------- */
  function truckBase(g, wheels, cabColor) {
    box(g, 7.6, .28, .9, M.dark, -.3, 1.05, 0);                       // chassis rails
    box(g, .25, .5, 2.4, M.dark, 3.55, .8, 0);                         // bumper
    prof(g, [[1.75, 1.2], [3.5, 1.2], [3.5, 2.25], [3.3, 3.25], [1.75, 3.25]], 2.4, cabColor);   // cab
    prof(g, [[3.33, 2.3], [3.52, 2.3], [3.34, 3.12], [3.15, 3.12]], 2.1, M.glass);              // windscreen
    box(g, .9, .7, 2.44, M.glass, 2.55, 2.72, 0);                      // side windows
    box(g, .12, .22, .5, M.white, 3.52, 1.55, .8); box(g, .12, .22, .5, M.white, 3.52, 1.55, -.8);   // lamps
    box(g, 1.6, .1, 2.44, M.dark, 2.6, 1.22, 0);                       // step
    cyl(g, .12, .12, 1.9, M.steel, 1.5, 2.4, 1.0, 'y', 10);            // exhaust stack
    cyl(g, .32, .32, 1.1, M.steel, .5, .78, 1.0, 'x', 16);             // fuel tank
    [[2.55, .6], [-1.55, .6], [-2.85, .6]].forEach(function (a, i) {
      var zz = i === 0 ? [1.05, -1.05] : [1.0, -1.0, .58, -.58];
      zz.forEach(function (z) { wheel(g, a[1], .36, a[0], z, wheels); });
    });
    box(g, 1.6, .08, 2.5, M.dark, 2.55, 1.28, 0).visible = false;
  }

  function tipper() {
    var g = new T.Group(), w = [];
    truckBase(g, w, M.yellow);
    var bed = new T.Group(); bed.position.set(-3.9, 1.25, 0);          // hinge at the rear
    prof(bed, [[0, 0], [5.3, 0], [5.3, .12], [0, .12]], 2.5, M.navy);                           // floor
    [1.22, -1.22].forEach(function (z) { prof(bed, [[0, .1], [5.3, .1], [5.3, 1.55], [0, 1.55]], .1, M.navy, z); });   // sides
    box(bed, .1, 1.9, 2.5, M.navy, 5.3, .95, 0);                       // headboard
    box(bed, 1.3, .1, 2.5, M.navy, 5.9, 1.9, 0);                       // cab guard
    var tail = box(bed, .08, 1.4, 2.5, M.plum, 0, .8, 0);
    for (var i = 0; i < 5; i++) { box(bed, .1, 1.45, .06, M.sky, .5 + i * 1.05, .82, 1.29); box(bed, .1, 1.45, .06, M.sky, .5 + i * 1.05, .82, -1.29); }
    var load = sh(new T.Mesh(new T.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.grit));
    load.scale.set(2.5, .75, 1.15); load.position.set(2.65, 1.35, 0); bed.add(load);
    g.add(bed);
    var ram = beam(g, -.6, 1.2, .6, 2.0, .16, .16, M.steel);
    g.userData.tick = function (t) { spin(w)(t); };
    g.userData.setTip = function (a) { bed.rotation.z = a; ram.visible = a < .05; tail.rotation.z = -a * .8; };
    return g;
  }

  function mixer() {
    var g = new T.Group(), w = [];
    truckBase(g, w, M.navy);
    var tilt = new T.Group(); tilt.position.set(1.15, 1.75, 0); tilt.rotation.z = Math.PI / 2 + .2; g.add(tilt);   // drum axis leans up to the rear
    var drum = new T.Group(); tilt.add(drum);
    var pts = [[.42, 0], [1.02, .7], [1.28, 1.9], [1.22, 2.9], [.85, 4.0], [.5, 4.7]].map(function (p) { return new T.Vector2(p[0], p[1]); });
    drum.add(sh(new T.Mesh(new T.LatheGeometry(pts, 36), M.cream)));
    var band = sh(new T.Mesh(new T.CylinderGeometry(1.3, 1.3, .32, 36, 1, true), M.plum)); band.position.y = 2.3; band.material.side = T.DoubleSide; drum.add(band);
    for (var i = 0; i < 4; i++) {                                       // spiral ribs make the rotation readable
      var rib = box(drum, .07, 2.6, .12, M.yellow, 0, 2.0, 0); rib.position.set(Math.cos(i * Math.PI / 2) * 1.2, 2.0 + i * .1, Math.sin(i * Math.PI / 2) * 1.2);
      rib.rotation.y = -i * Math.PI / 2; rib.rotation.x = .28;
    }
    cyl(g, .5, .5, .9, M.steel, 1.25, 1.75, 0, 'x', 16);               // gearbox
    box(g, .2, 1.9, 1.5, M.dark, -3.2, 2.1, 0);                         // rear pedestal
    prof(g, [[-3.5, 3.55], [-2.75, 3.55], [-3.0, 3.0], [-3.3, 3.0]], 1.0, M.yellow);            // charge hopper
    beam(g, -3.4, 2.5, -4.6, 1.5, .1, .55, M.steel);                    // discharge chute
    cyl(g, .3, .3, 1.3, M.sky, 1.35, 2.75, 0, 'z', 16);                 // water tank
    g.userData.tick = function (t) { spin(w)(t); drum.rotation.y = t * .9; };
    return g;
  }

  function bucket(g, x, y, width, s, m) {                               // open-top scoop, mouth to +X
    var b = new T.Group(); b.position.set(x, y, 0);
    prof(b, [[0, 0], [1.1 * s, -.1 * s], [1.25 * s, .02 * s], [.2 * s, .12 * s], [.1 * s, .9 * s], [0, .95 * s]], width, m);
    [width / 2, -width / 2].forEach(function (z) { prof(b, [[0, 0], [1.15 * s, -.08 * s], [.1 * s, .95 * s]], .08, m, z); });
    for (var i = 0; i < 5; i++) box(b, .22 * s, .06 * s, .1, M.steel, 1.28 * s, -.02 * s, (i - 2) * width / 5.2);
    g.add(b); return b;
  }

  function backhoe() {                                                  // JCB-type backhoe loader
    var g = new T.Group(), w = [];
    box(g, 3.6, .55, 1.3, M.yellow, .1, 1.05, 0);
    prof(g, [[.9, 1.3], [2.5, 1.3], [2.5, 1.85], [2.2, 2.0], [.9, 2.05]], 1.25, M.yellow);       // bonnet
    box(g, .1, .5, 1.0, M.dark, 2.52, 1.6, 0);                           // grille
    cyl(g, .07, .07, .9, M.dark, 1.5, 2.45, .35, 'y', 8);                // exhaust
    box(g, 1.7, .12, 1.5, M.yellow, -.1, 3.15, 0);                       // cab roof
    box(g, 1.55, 1.75, 1.36, M.glass, -.1, 2.2, 0);                      // glazing
    [[.68, .68], [.68, -.68], [-.88, .68], [-.88, -.68]].forEach(function (p) { box(g, .1, 1.85, .1, M.dark, p[0], 2.2, p[1]); });
    [1.0, -1.0].forEach(function (z) { wheel(g, .82, .5, -1.15, z, w); wheel(g, .52, .36, 1.75, z * .95, w); });
    [.75, -.75].forEach(function (z) { box(g, .9, .1, .6, M.yellow, -1.15, 1.75, z * 1.35); });   // rear mudguards
    [.6, -.6].forEach(function (z) {                                    // front loader arms
      beam(g, .7, 1.75, 2.3, 1.55, .2, .14, M.yellow, z); beam(g, 2.3, 1.55, 3.3, .75, .2, .14, M.yellow, z);
      beam(g, 1.1, 1.3, 2.6, 1.2, .1, .1, M.steel, z);
    });
    bucket(g, 3.25, .45, 2.2, 1.0, M.dark);
    box(g, .5, 1.0, 1.1, M.dark, -1.95, 1.3, 0);                         // backhoe king-post
    beam(g, -2.0, 1.6, -3.3, 3.6, .3, .32, M.yellow);                    // boom
    beam(g, -3.3, 3.6, -4.7, 1.9, .24, .26, M.yellow);                   // dipper
    beam(g, -2.2, 2.3, -3.1, 3.1, .12, .12, M.steel, .0);
    var bk = bucket(g, -4.7, 1.9, .7, .7, M.dark); bk.rotation.z = Math.PI * .95;
    [1.15, -1.15].forEach(function (z) { beam(g, -1.9, 1.2, -2.1, .12, .16, .16, M.dark, z); box(g, .5, .08, .4, M.dark, -2.1, .06, z); });   // stabilisers
    box(g, .12, .3, .3, M.blush, .3, 3.3, 0);                            // beacon
    g.userData.tick = spin(w);
    return g;
  }

  function track(g, z) {
    box(g, 3.6, .78, .62, M.dark, 0, .45, z);
    cyl(g, .39, .39, .62, M.dark, 1.8, .45, z, 'z', 20); cyl(g, .39, .39, .62, M.dark, -1.8, .45, z, 'z', 20);
    for (var i = -3; i <= 3; i++) cyl(g, .18, .18, .68, M.steel, i * .55, .32, z, 'z', 10);
    box(g, 3.9, .1, .7, M.steel, 0, .86, z);
  }
  function excavator() {                                                // Poclain-type tracked excavator
    var g = new T.Group();
    track(g, 1.2); track(g, -1.2);
    box(g, 2.2, .35, 1.9, M.dark, 0, .75, 0);
    cyl(g, .95, .95, .3, M.steel, 0, 1.08, 0, 'y', 28);
    var up = new T.Group(); up.position.y = 1.22; g.add(up);            // slewing upper structure
    prof(up, [[-2.6, 0], [1.5, 0], [1.5, 1.0], [-2.3, 1.15], [-2.6, .9]], 2.6, M.yellow);
    prof(up, [[-2.75, .1], [-2.3, .1], [-2.3, 1.2], [-2.75, 1.0]], 2.7, M.navy);                 // counterweight
    box(up, 1.25, 1.55, 1.0, M.glass, .75, 1.78, .8);                    // cab
    box(up, 1.35, .1, 1.1, M.yellow, .75, 2.6, .8);
    [[.15, .32], [1.35, .32], [.15, 1.28], [1.35, 1.28]].forEach(function (p) { box(up, .08, 1.6, .08, M.dark, p[0], 1.78, p[1]); });
    box(up, 1.2, .45, 1.1, M.navy, -1.3, 1.3, -.5);                      // engine cover
    cyl(up, .08, .08, .8, M.dark, -1.8, 1.8, -.6, 'y', 8);
    var z = -.25;
    beam(up, .9, .7, 2.7, 3.5, .5, .42, M.yellow, z);                    // boom (two sections)
    beam(up, 2.7, 3.5, 5.0, 3.0, .42, .4, M.yellow, z);
    beam(up, 5.0, 3.0, 5.4, .55, .3, .32, M.yellow, z);                  // stick
    beam(up, 1.5, .8, 2.9, 2.6, .16, .16, M.steel, z + .34); beam(up, 1.5, .8, 2.9, 2.6, .16, .16, M.steel, z - .34);
    beam(up, 3.3, 3.75, 4.9, 3.5, .14, .14, M.steel, z);
    var bk = bucket(up, 5.4, .5, 1.0, .95, M.dark); bk.position.z = z; bk.rotation.z = -Math.PI * .62;
    box(up, .12, .28, .28, M.blush, .75, 2.8, .8);
    g.userData.tick = function (t) { up.rotation.y = Math.sin(t * .35) * .5; };
    return g;
  }

  function loader() {                                                   // articulated wheel loader
    var g = new T.Group(), w = [];
    prof(g, [[-3.3, .85], [-.5, .85], [-.5, 2.05], [-3.0, 2.2], [-3.3, 1.9]], 2.3, M.yellow);    // rear frame + engine
    box(g, .12, .8, 1.7, M.dark, -3.33, 1.5, 0);
    cyl(g, .09, .09, .9, M.dark, -2.4, 2.6, .5, 'y', 8);
    box(g, 1.5, 1.6, 1.6, M.glass, -.9, 2.9, 0); box(g, 1.65, .12, 1.75, M.yellow, -.9, 3.75, 0);
    [[-.2, .76], [-.2, -.76], [-1.6, .76], [-1.6, -.76]].forEach(function (p) { box(g, .1, 1.7, .1, M.dark, p[0], 2.9, p[1]); });
    cyl(g, .25, .25, .9, M.steel, -.3, 1.3, 0, 'y', 14);                 // articulation joint
    box(g, 1.9, .9, 1.5, M.yellow, .9, 1.3, 0);                          // front frame
    [1.25, -1.25].forEach(function (z) { wheel(g, .95, .62, -1.9, z, w); wheel(g, .95, .62, 1.0, z, w); });
    [.62, -.62].forEach(function (z) {
      beam(g, .3, 2.0, 2.2, 1.9, .26, .16, M.yellow, z); beam(g, 2.2, 1.9, 3.4, .8, .26, .16, M.yellow, z);
      beam(g, .9, 1.5, 2.5, 1.5, .12, .12, M.steel, z);
    });
    beam(g, 1.2, 2.2, 3.0, 1.9, .14, .14, M.steel);
    bucket(g, 3.35, .4, 3.0, 1.35, M.dark);
    box(g, .12, .28, .28, M.blush, -.9, 3.95, 0);
    g.userData.tick = spin(w);
    return g;
  }

  function compactor() {                                                // single-drum soil compactor
    var g = new T.Group(), w = [];
    var drum = new T.Group(); drum.position.set(1.9, .82, 0); g.add(drum);
    cyl(drum, .82, .82, 2.15, M.steel, 0, 0, 0, 'z', 40);
    cyl(drum, .3, .3, 2.2, M.dark, 0, 0, 0, 'z', 14);
    for (var i = 0; i < 6; i++) { var m = box(drum, .06, .5, 2.18, M.dark, 0, 0, 0); m.rotation.z = i * Math.PI / 6; m.scale.y = 3.2; m.visible = false; }
    [1.15, -1.15].forEach(function (z) { box(g, 2.3, .28, .12, M.yellow, 1.75, .95, z); });      // drum yoke
    box(g, .22, .5, 2.42, M.yellow, 2.85, .95, 0); box(g, .22, .5, 2.42, M.yellow, .7, 1.0, 0);
    cyl(g, .22, .22, .8, M.steel, .45, 1.1, 0, 'y', 14);                 // articulation
    prof(g, [[-2.6, .75], [.3, .75], [.3, 1.7], [-.5, 1.95], [-2.4, 2.0], [-2.6, 1.7]], 1.9, M.yellow);   // rear body
    box(g, .1, .7, 1.4, M.dark, -2.62, 1.4, 0);
    [1.05, -1.05].forEach(function (z) { wheel(g, .78, .55, -1.55, z, w); });
    box(g, 1.3, .1, 1.7, M.navy, -.55, 3.45, 0);                         // ROPS canopy
    [[.05, .78], [.05, -.78], [-1.15, .78], [-1.15, -.78]].forEach(function (p) { box(g, .09, 1.5, .09, M.dark, p[0], 2.7, p[1]); });
    box(g, .6, .7, .7, M.dark, -.75, 2.3, 0); box(g, .1, .5, .5, M.dark, -.2, 2.35, 0);           // seat + console
    box(g, .12, .28, .28, M.blush, -.55, 3.65, 0);
    g.userData.tick = function (t) { spin(w)(t); drum.rotation.z = -t * 1.1; };
    return g;
  }

  /* ---------- plant parts ---------- */
  function silo(g, x, z, r, h, base, m, cap) {                          // cylinder on four legs with a cone outlet
    cyl(g, r, r, h, m, x, base + h / 2 + r * 1.1, z, 'y', 28);
    cyl(g, r, r * .22, r * 1.1, m, x, base + r * .55, z, 'y', 28);
    cyl(g, r * .9, r, .25, cap || M.navy, x, base + h + r * 1.1 + .12, z, 'y', 28);
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (s) { box(g, .14, base + r * 1.1, .14, M.steel, x + s[0] * r * .78, (base + r * 1.1) / 2, z + s[1] * r * .78); });
    box(g, r * 1.7, .1, r * 1.7, M.steel, x, base * .55, z).scale.set(1, 1, 1);
  }
  function hopperRow(g, x, n, m) {                                       // cold-feed / aggregate bins
    for (var i = 0; i < n; i++) {
      var o = sh(new T.Mesh(new T.CylinderGeometry(1.25, .35, 1.6, 4, 1), m)); o.rotation.y = Math.PI / 4; o.position.set(x + i * 2.0, 2.5, 0); g.add(o);
      box(g, 1.85, .5, 1.85, m, x + i * 2.0, 3.5, 0);
      [[.8, .8], [.8, -.8], [-.8, .8], [-.8, -.8]].forEach(function (s) { box(g, .12, 3.3, .12, M.steel, x + i * 2.0 + s[0], 1.65, s[1]); });
    }
    box(g, n * 2.0 + .4, .12, .7, M.dark, x + (n - 1), 1.45, 0);         // collecting belt
  }
  function conveyor(g, x1, y1, x2, y2, z) {
    beam(g, x1, y1, x2, y2, .22, .8, M.dark, z || 0);
    beam(g, x1, y1 + .32, x2, y2 + .32, .06, .9, M.steel, z || 0);
    var n = Math.max(2, Math.round(Math.abs(x2 - x1) / 3));
    for (var i = 1; i <= n; i++) { var f = i / (n + .4), x = x1 + (x2 - x1) * f, y = y1 + (y2 - y1) * f; if (y > .6) { box(g, .12, y, .12, M.steel, x, y / 2, (z || 0) + .34); box(g, .12, y, .12, M.steel, x, y / 2, (z || 0) - .34); } }
  }
  function cabin(g, x, z) { box(g, 2.6, 2.2, 2.2, M.cream, x, 1.3, z); box(g, 2.7, .12, 2.3, M.navy, x, 2.46, z); box(g, 1.4, .8, .06, M.glass, x, 1.6, z + 1.11); box(g, .7, 1.5, .06, M.navy, x - .7, .95, z - 1.11); }
  function stack(g, x, z, h) { cyl(g, .32, .4, h, M.steel, x, h / 2, z, 'y', 16); cyl(g, .36, .36, .3, M.plum, x, h - .6, z, 'y', 16); }
  function dryer(g, x1, x2, y, z) {                                      // rotating dryer drum on a frame
    var L = x2 - x1, d = new T.Group(); d.position.set((x1 + x2) / 2, y, z || 0); d.rotation.z = .05; g.add(d);
    var r = new T.Group(); d.add(r);
    cyl(r, 1.05, 1.05, L, M.navy, 0, 0, 0, 'x', 32);
    [-L * .32, L * .32].forEach(function (x) { cyl(r, 1.15, 1.15, .28, M.steel, x, 0, 0, 'x', 32); });
    for (var i = 0; i < 6; i++) { var f = box(r, L * .9, .08, .08, M.sky, 0, 0, 0); f.position.set(0, Math.cos(i * Math.PI / 3) * 1.07, Math.sin(i * Math.PI / 3) * 1.07); }
    cyl(d, .55, .8, 1.3, M.plum, L / 2 + .6, 0, 0, 'x', 20);             // burner
    box(d, L * .9, .25, 2.3, M.steel, 0, -1.3, 0);
    [-L * .32, L * .32].forEach(function (x) { box(g, .3, y - 1.3, 2.0, M.steel, (x1 + x2) / 2 + x, (y - 1.3) / 2, z || 0); });
    return r;
  }
  function tankH(g, x, z, L, r) { cyl(g, r, r, L, M.dark, x, r + .5, z, 'x', 24); [-L * .3, L * .3].forEach(function (dx) { box(g, .3, .5, r * 1.6, M.steel, x + dx, .25, z); }); cyl(g, .2, .2, .5, M.steel, x, r * 2 + .6, z, 'y', 10); }
  function ladderTower(g, x, z, h) { for (var i = 0; i < h; i += .45) box(g, .5, .05, .05, M.steel, x, i + .3, z); box(g, .05, h, .05, M.steel, x - .25, h / 2, z); box(g, .05, h, .05, M.steel, x + .25, h / 2, z); }

  function rmcPlant() {                                                  // ready-mix concrete plant
    var g = new T.Group();
    hopperRow(g, -15, 4, M.sky);
    conveyor(g, -8.4, 1.6, -1.2, 9.4);
    [[1.6, 1.6], [1.6, -1.6], [-1.6, 1.6], [-1.6, -1.6]].forEach(function (s) { box(g, .28, 5.2, .28, M.steel, s[0], 2.6, s[1]); });   // tower legs (truck bay below)
    box(g, 3.9, .25, 3.9, M.steel, 0, 5.2, 0);
    box(g, 3.6, 3.2, 3.6, M.navy, 0, 6.95, 0);                           // mixer house
    box(g, 3.9, .2, 3.9, M.cream, 0, 8.65, 0);
    box(g, 2.6, 1.6, 2.6, M.cream, -.3, 9.5, 0);                         // weigh hopper deck
    cyl(g, 1.0, .35, 1.0, M.yellow, 0, 4.6, 0, 'y', 20);                 // discharge cone
    [3.6, 6.4, 9.2].forEach(function (x, i) { silo(g, x, i % 2 ? -.6 : .6, 1.25, 6.5, 4.6, M.cream, M.plum); beam(g, x - .2, 5.0, 1.2, 8.6, .22, .22, M.steel, i % 2 ? -.6 : .6); });
    ladderTower(g, 2.1, 1.9, 8.6);
    cabin(g, -4.2, 3.6);
    g.userData.bay = new T.Vector3(0, 0, 0);                             // where a transit mixer parks to load
    return g;
  }

  function hotMixPlant() {                                               // drum-type hot mix (asphalt) plant
    var g = new T.Group();
    hopperRow(g, -17, 4, M.yellow);
    conveyor(g, -10.4, 1.6, -5.6, 4.2);
    var r = dryer(g, -5.6, 2.6, 3.9, 0);
    box(g, 1.0, 9.5, 1.0, M.steel, 3.6, 4.75, 0);                         // drag elevator
    beam(g, 3.6, 9.3, 6.4, 10.4, .5, .9, M.steel);
    silo(g, 7.2, 0, 1.6, 4.2, 4.8, M.cream, M.plum);                      // storage silo, trucks load beneath
    box(g, 4.6, 3.4, 2.8, M.sky, -2.2, 4.5, -4.6);                        // bag filter
    [[-4.2, -5.7], [-4.2, -3.5], [-.2, -5.7], [-.2, -3.5]].forEach(function (p) { box(g, .2, 2.8, .2, M.steel, p[0], 1.4, p[1]); });
    stack(g, 1.4, -4.6, 11);
    beam(g, -1.2, 4.9, -2.0, 6.0, .5, .5, M.steel, -2.4).rotation.set(.9, 0, 0);
    tankH(g, -9.5, -5.0, 5.2, 1.1); tankH(g, -9.5, -7.8, 5.2, 1.1);       // bitumen tanks
    cabin(g, 2.4, 4.6);
    g.userData.tick = function (t) { r.rotation.x = t * .8; };
    g.userData.bay = new T.Vector3(7.2, 0, 0);
    return g;
  }

  function batchMixPlant() {                                             // tower-type batch mix plant
    var g = new T.Group();
    hopperRow(g, -18, 4, M.yellow);
    conveyor(g, -11.4, 1.6, -7.2, 3.7);
    var r = dryer(g, -7.2, .2, 3.4, 0);
    box(g, 1.0, 15.5, 1.0, M.steel, 1.3, 7.75, -1.2);                     // hot elevator
    [[2.2, 1.9], [2.2, -1.9], [6.0, 1.9], [6.0, -1.9]].forEach(function (p) { box(g, .3, 4.6, .3, M.steel, p[0], 2.3, p[1]); });   // tower legs, truck bay
    box(g, 4.4, 2.4, 4.4, M.navy, 4.1, 5.8, 0);                           // pugmill
    box(g, 4.2, 2.2, 4.2, M.cream, 4.1, 8.1, 0);                          // weigh hoppers
    box(g, 4.4, 3.0, 4.4, M.navy, 4.1, 10.7, 0);                          // hot bins
    box(g, 4.0, 2.4, 4.0, M.cream, 4.1, 13.4, 0);                         // screen deck
    box(g, 4.6, .2, 4.6, M.plum, 4.1, 14.7, 0);
    [4.6, 6.95, 9.2, 12.2].forEach(function (y) { box(g, 5.2, .1, 5.2, M.steel, 4.1, y, 0); });   // walkways
    ladderTower(g, 6.9, 2.4, 14.6);
    beam(g, 1.3, 15.2, 3.2, 14.4, .5, .8, M.steel, -1.2);
    silo(g, 9.6, -1.0, 1.1, 7.5, 3.0, M.cream, M.plum);                    // filler silo
    box(g, 4.8, 3.6, 3.0, M.sky, -3.4, 4.6, -5.2);                         // bag filter
    [[-5.4, -6.4], [-5.4, -4.0], [-1.4, -6.4], [-1.4, -4.0]].forEach(function (p) { box(g, .2, 2.8, .2, M.steel, p[0], 1.4, p[1]); });
    stack(g, .6, -5.2, 13);
    tankH(g, -11.5, -5.4, 5.2, 1.1); tankH(g, -11.5, -8.2, 5.2, 1.1);
    cabin(g, 9.0, 4.8);
    g.userData.tick = function (t) { r.rotation.x = t * .8; };
    g.userData.bay = new T.Vector3(4.1, 0, 0);
    return g;
  }

  window.Machines = {
    palette: PAL, mats: M, studio: studio, parts: { box: box, cyl: cyl, beam: beam, prof: prof, wheel: wheel },
    build: { tipper: tipper, mixer: mixer, backhoe: backhoe, excavator: excavator, loader: loader, compactor: compactor,
             rmcPlant: rmcPlant, hotMixPlant: hotMixPlant, batchMixPlant: batchMixPlant },
    /* names and counts exactly as supplied by the client */
    fleet: [
      { key: 'rmcPlant', name: 'ReadyMix Plant', count: 3 }, { key: 'hotMixPlant', name: 'Hot Mix Plant', count: 3 },
      { key: 'batchMixPlant', name: 'Batch Mix Plant', count: 1 }, { key: 'tipper', name: 'Tipper Truck', count: 100 },
      { key: 'mixer', name: 'TM Truck', count: 15 }, { key: 'backhoe', name: 'JCB', count: 5 },
      { key: 'excavator', name: 'Poclain', count: 2 }, { key: 'loader', name: 'Loader', count: 2 },
      { key: 'compactor', name: 'Soil Compactor', count: 5 }
    ]
  };
})();
