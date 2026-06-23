/* ============================================================================
 * Seasons and Ecliptic Simulator -- accessible HTML5 port
 * ----------------------------------------------------------------------------
 * Behaviour ported faithfully from the decompiled ActionScript (AS1) of
 * eclipticSimulator025.  The 3D "celestial sphere" engine (projection matrices,
 * circle/line drawing, globe shading) is reproduced on an HTML5 <canvas>.  All
 * physics constants, formulas, on-screen text and number formatting are taken
 * verbatim from the source.  Presentation follows the KL-UNL foundation + WCAG.
 *
 * Coordinate note: AS placed clips with +y downward (screen coords); HTML5
 * canvas is also +y downward, so projected (sp.x, sp.y) map directly to
 * (centre.x + sp.x, centre.y + sp.y).
 * ========================================================================== */
'use strict';

(function () {

  /* ------------------------------------------------------------------ consts */
  var DEG = Math.PI / 180;
  var RAD = 180 / Math.PI;
  var H2R = 0.2617993877991494;   // hours -> radians (2*pi/24)
  var R2H = 3.819718634205488;    // radians -> hours (24/2*pi)
  var TAU = 6.283185307179586;
  var HALFPI = 1.5707963267948966;

  function mod(n, m) { return (n % m + m) % m; }

  // AS colour ints are decimal RGB.  Remap to css; alpha is 0..100.
  function rgba(intColor, alpha100) {
    var r = (intColor >> 16) & 255, g = (intColor >> 8) & 255, b = intColor & 255;
    var a = (alpha100 == null ? 100 : alpha100) / 100;
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  /* ===========================================================================
   * CSphere -- a faithful port of CelestialSphereClass (the parts this sim uses)
   * ========================================================================= */
  function CSphere(radiusPx) {
    this.c = {};
    this.r = radiusPx;
    this.c.r = radiusPx;
    this.c.r2 = radiusPx * radiusPx;
    this._theta = 0; this._phi = 0; this._lat = 0; this._sTime = 0;
    this._minPhi = -90; this._maxPhi = 90;
    this._showUnder = true;
    this.circles = {};      // name -> circle
    this.lines = {};        // name -> line
    this.globe = null;      // GlobeComponent (optional)
    this.setThetaAndPhi(90, 30);
    this.setLatitude(41);
    this.setSiderealTime(0);
  }
  var P = CSphere.prototype;

  P.setSize = function (px) {
    this.r = px; this.c.r = px / 2; this.c.r2 = this.c.r * this.c.r;
    this.doA(); this.doB();
  };
  // size getter/setter mirror AS: size == 2*r
  Object.defineProperty(P, 'size', {
    get: function () { return 2 * this.c.r; },
    set: function (v) { this.setSize2(v); }
  });
  P.setSize2 = function (v) {
    this.c.r = v / 2; this.c.r2 = this.c.r * this.c.r; this.doA(); this.doB();
  };

  P.setThetaAndPhi = function (newTheta, newPhi) {
    this._theta = DEG * mod(newTheta, 360);
    if (newPhi > this._maxPhi) newPhi = this._maxPhi;
    else if (newPhi < this._minPhi) newPhi = this._minPhi;
    this._phi = newPhi * DEG;
    this.doA(); this.doB();
  };
  Object.defineProperty(P, 'theta', {
    get: function () { return RAD * this._theta; },
    set: function (v) { this._theta = DEG * mod(v, 360); this.doA(); this.doB(); }
  });
  Object.defineProperty(P, 'phi', {
    get: function () { return RAD * this._phi; },
    set: function (v) {
      if (v > this._maxPhi) v = this._maxPhi; else if (v < this._minPhi) v = this._minPhi;
      this._phi = v * DEG; this.doA(); this.doB();
    }
  });
  Object.defineProperty(P, 'viewerAzimuth', {
    get: function () { return mod(360 - this.theta, 360); },
    set: function (v) { this.theta = 360 - v; }
  });
  Object.defineProperty(P, 'viewerAltitude', {
    get: function () { return this.phi; },
    set: function (v) { this.phi = v; }
  });
  Object.defineProperty(P, 'latitude', {
    get: function () { return RAD * this._lat; },
    set: function (v) { this.setLatitude(v); }
  });
  Object.defineProperty(P, 'siderealTime', {
    get: function () { return this._sTime * R2H; },
    set: function (v) { this.setSiderealTime(v); }
  });
  P.setLatitude = function (arg) {
    if (arg > 90) arg = 90; else if (arg < -90) arg = -90;
    this._lat = arg * DEG; this.doM(); this.doB();
  };
  P.setSiderealTime = function (arg) {
    this._sTime = mod(arg, 24) * H2R; this.doM(); this.doB();
  };

  P.doA = function () {                                  // world -> screen
    var c = this.c, ct = Math.cos(this._theta), st = Math.sin(this._theta),
        cp = Math.cos(this._phi), sp = Math.sin(this._phi), r = c.r;
    c.a0 = -r * st;       c.a1 = r * ct;
    c.a3 = r * ct * sp;   c.a4 = r * st * sp;  c.a5 = -r * cp;
    c.a6 = r * ct * cp;   c.a7 = r * st * cp;  c.a8 = r * sp;
  };
  P.doM = function () {                                  // celestial -> world
    var c = this.c;
    c.m2 = Math.cos(this._lat);
    c.m3 = Math.sin(this._sTime);
    c.m4 = -Math.cos(this._sTime);
    c.m8 = Math.sin(this._lat);
    c.m0 = c.m4 * c.m8;  c.m1 = -c.m3 * c.m8;
    c.m6 = -c.m2 * c.m4; c.m7 = c.m2 * c.m3;
  };
  P.doB = function () {                                  // celestial -> screen
    var c = this.c;
    c.b0 = c.a0 * c.m0 + c.a1 * c.m3;
    c.b1 = c.a0 * c.m1 + c.a1 * c.m4;
    c.b2 = c.a0 * c.m2;
    c.b3 = c.a3 * c.m0 + c.a4 * c.m3 + c.a5 * c.m6;
    c.b4 = c.a3 * c.m1 + c.a4 * c.m4 + c.a5 * c.m7;
    c.b5 = c.a3 * c.m2 + c.a5 * c.m8;
    c.b6 = c.a6 * c.m0 + c.a7 * c.m3 + c.a8 * c.m6;
    c.b7 = c.a6 * c.m1 + c.a7 * c.m4 + c.a8 * c.m7;
    c.b8 = c.a6 * c.m2 + c.a8 * c.m8;
  };

  P.parsePoint = function (p1) {
    var o = {}, rr, h;
    if (p1.az != null && p1.alt != null) {
      o.sys = 0; rr = (p1.r != null ? p1.r : 1);
      h = rr * Math.cos(p1.alt * DEG);
      o.x = h * Math.cos(p1.az * DEG);
      o.y = h * Math.sin(-p1.az * DEG);
      o.z = rr * Math.sin(p1.alt * DEG);
      o.r = Math.abs(rr);
    } else if (p1.ra != null && p1.dec != null) {
      o.sys = 1; rr = (p1.r != null ? p1.r : 1);
      h = rr * Math.cos(p1.dec * DEG);
      o.x = h * Math.cos(p1.ra * H2R);
      o.y = h * Math.sin(p1.ra * H2R);
      o.z = rr * Math.sin(p1.dec * DEG);
      o.r = Math.abs(rr);
    } else {                                  // {x,y,z,system}
      o.sys = (p1.system === 'celestial') ? 1 : 0;
      o.x = p1.x; o.y = p1.y; o.z = p1.z;
      o.r = Math.sqrt(o.x * o.x + o.y * o.y + o.z * o.z);
    }
    return o;
  };

  P.WtoSz = function (p) {
    var c = this.c;
    return { x: p.x * c.a0 + p.y * c.a1,
             y: p.x * c.a3 + p.y * c.a4 + p.z * c.a5,
             z: p.x * c.a6 + p.y * c.a7 + p.z * c.a8 };
  };
  P.CtoSz = function (p) {
    var c = this.c;
    return { x: p.x * c.b0 + p.y * c.b1 + p.z * c.b2,
             y: p.x * c.b3 + p.y * c.b4 + p.z * c.b5,
             z: p.x * c.b6 + p.y * c.b7 + p.z * c.b8 };
  };
  P.CtoW = function (p) {
    var c = this.c;
    return { x: p.x * c.m0 + p.y * c.m1 + p.z * c.m2,
             y: p.x * c.m3 + p.y * c.m4,
             z: p.x * c.m6 + p.y * c.m7 + p.z * c.m8 };
  };
  P.WtoC = function (p) {
    var c = this.c;
    return { x: p.x * c.m0 + p.y * c.m3 + p.z * c.m6,
             y: p.x * c.m1 + p.y * c.m4 + p.z * c.m7,
             z: p.x * c.m2 + p.z * c.m8 };
  };
  P.MHtoC = function (hp) {                  // mathematical-horizon -> celestial
    var sa = Math.sin(hp.alt), ca = Math.cos(hp.alt),
        sz = Math.sin(hp.az), cz = Math.cos(hp.az),
        sl = Math.sin(this._lat), cl = Math.cos(this._lat);
    var num = ca * sz, den = sa * cl - ca * sl * cz, ra;
    ra = (den === 0) ? 0 : mod(this._sTime - Math.atan2(num, den), TAU);
    return { ra: ra, dec: Math.asin(sa * sl + ca * cz * cl) };
  };
  P.StoMH = function (sx, sy) {              // screen -> math-horizon (radians)
    var rr = Math.sqrt(sx * sx + sy * sy) / this.c.r;
    if (rr > 1) rr = 1;
    var rho = Math.asin(rr), gamma = Math.atan2(sx, -sy), hp = {};
    if (this._phi === HALFPI) {
      hp.alt = HALFPI - rho; hp.az = this._theta + Math.PI - gamma;
    } else if (this._phi === -HALFPI) {
      hp.alt = -HALFPI + rho; hp.az = this._theta + gamma;
    } else {
      var co = HALFPI - this._phi, cco = Math.cos(co), sco = Math.sin(co),
          crho = Math.cos(rho), srho = Math.sin(rho),
          cc = crho * cco + srho * sco * Math.cos(gamma);
      hp.alt = HALFPI - Math.acos(cc);
      hp.az = this._theta + Math.atan2(srho * Math.sin(gamma), (crho - cc * cco) / sco);
    }
    hp.az = mod(hp.az, TAU);
    return hp;
  };
  P.pointToHorizon = function (up) {
    var p = this.parsePoint(up), hp = {}, w, s;
    if (p.sys === 0) { w = p; } else { w = this.CtoW(p); }
    s = w.z / p.r; if (s < -1) s = -1; else if (s > 1) s = 1;
    hp.az = mod(-RAD * Math.atan2(w.y, w.x), 360);
    hp.alt = RAD * Math.asin(s);
    hp.r = p.r;
    return hp;
  };
  // screen->celestial (for the draggable globe in orbit/earth view)
  P.getMouseRaDec = function (sx, sy) {
    var rr = Math.sqrt(sx * sx + sy * sy);
    if (rr > this.c.r) { var t = Math.atan2(sy, sx); sx = this.c.r * Math.cos(t); sy = this.c.r * Math.sin(t); }
    var hp = this.StoMH(sx, sy), c = this.MHtoC(hp);
    return { ra: c.ra * R2H, dec: c.dec * RAD };
  };

  /* ------------------------------------------------------------------ circle */
  // A circle is great/small circle on the sphere defined by tilt/beta/lambda.
  function makeCircle(opts) {
    return { sys: 0, tilt: 0, beta: 0, lambda: 0, gS: 0, gE: 0,
             color: 16711680, thick: 1, alpha: 80, visible: true, c: {},
             name: opts && opts.name };
  }
  function circStyle(circ, thickness, color, alpha) {
    if (thickness != null) circ.thick = thickness;
    if (color != null) circ.color = color;
    if (alpha != null) circ.alpha = alpha;
  }
  function circParams(circ, arg) {
    if (arg.az != null && arg.alt != null && arg.tilt != null) {
      circ.sys = 0;
      if (isFinite(arg.tilt)) circ.tilt = (arg.tilt < 0 ? 0 : arg.tilt > 180 ? Math.PI : arg.tilt * DEG);
      if (isFinite(arg.alt)) circ.lambda = (arg.alt < -90 ? -Math.PI : arg.alt > 90 ? Math.PI : arg.alt * DEG);
      if (isFinite(arg.az)) circ.beta = DEG * mod(-arg.az, 360);
      if (isFinite(arg.gammaStart)) circ.gS = DEG * mod(arg.gammaStart, 360);
      if (isFinite(arg.gammaEnd)) circ.gE = DEG * mod(arg.gammaEnd, 360);
    } else if (arg.ra != null && arg.dec != null && arg.tilt != null) {
      circ.sys = 1;
      if (isFinite(arg.tilt)) circ.tilt = (arg.tilt < 0 ? 0 : arg.tilt > 180 ? Math.PI : arg.tilt * DEG);
      if (isFinite(arg.dec)) circ.lambda = (arg.dec < -90 ? -Math.PI : arg.dec > 90 ? Math.PI : arg.dec * DEG);
      if (isFinite(arg.ra)) circ.beta = H2R * mod(arg.ra, 24);
      if (isFinite(arg.gammaStart)) circ.gS = DEG * mod(arg.gammaStart, 360);
      if (isFinite(arg.gammaEnd)) circ.gE = DEG * mod(arg.gammaEnd, 360);
    }
    circDoW(circ);
  }
  function circDoW(circ) {
    var st = Math.sin(circ.tilt), ct = Math.cos(circ.tilt),
        sb = Math.sin(circ.beta), cb = Math.cos(circ.beta),
        cl = Math.cos(circ.lambda), sl = Math.sin(circ.lambda), c = circ.c;
    c.w0 = cl * cb;       c.w1 = -cl * sb * ct;  c.w2 = sl * sb * st;
    c.w3 = cl * sb;       c.w4 = cl * cb * ct;   c.w5 = -sl * cb * st;
    c.w7 = cl * st;       c.w8 = sl * ct;
  }
  // v matrix maps (cos g, sin g, 1) -> screen (x,y,z)
  function circV(S, circ) {
    var w = circ.c, P = S.c, v = {};
    if (circ.sys === 0) {
      v.v0 = P.a0 * w.w0 + P.a1 * w.w3; v.v1 = P.a0 * w.w1 + P.a1 * w.w4; v.v2 = P.a0 * w.w2 + P.a1 * w.w5;
      v.v3 = P.a3 * w.w0 + P.a4 * w.w3; v.v4 = P.a3 * w.w1 + P.a4 * w.w4 + P.a5 * w.w7; v.v5 = P.a3 * w.w2 + P.a4 * w.w5 + P.a5 * w.w8;
      v.v6 = P.a6 * w.w0 + P.a7 * w.w3; v.v7 = P.a6 * w.w1 + P.a7 * w.w4 + P.a8 * w.w7; v.v8 = P.a6 * w.w2 + P.a7 * w.w5 + P.a8 * w.w8;
    } else {
      v.v0 = P.b0 * w.w0 + P.b1 * w.w3; v.v1 = P.b0 * w.w1 + P.b1 * w.w4 + P.b2 * w.w7; v.v2 = P.b0 * w.w2 + P.b1 * w.w5 + P.b2 * w.w8;
      v.v3 = P.b3 * w.w0 + P.b4 * w.w3; v.v4 = P.b3 * w.w1 + P.b4 * w.w4 + P.b5 * w.w7; v.v5 = P.b3 * w.w2 + P.b4 * w.w5 + P.b5 * w.w8;
      v.v6 = P.b6 * w.w0 + P.b7 * w.w3; v.v7 = P.b6 * w.w1 + P.b7 * w.w4 + P.b8 * w.w7; v.v8 = P.b6 * w.w2 + P.b7 * w.w5 + P.b8 * w.w8;
    }
    return v;
  }
  // Draw a circle's visible arcs, splitting front (z>=0) / back (z<0).
  function drawCircle(ctx, S, circ, cx, cy, wantSide) {
    if (!circ.visible) return;
    var v = circV(S, circ);
    var g0 = circ.gS, g1 = circ.gE, full = (circ.gS === circ.gE);
    if (full) g1 = g0 + TAU; else if (g1 < g0) g1 += TAU;
    var steps = Math.max(8, Math.ceil((g1 - g0) / 0.06)), i, g, cs, sn, x, y, z;
    ctx.lineWidth = Math.max(1, circ.thick);
    ctx.strokeStyle = rgba(circ.color, circ.alpha);
    var pen = false;
    for (i = 0; i <= steps; i++) {
      g = g0 + (g1 - g0) * i / steps;
      cs = Math.cos(g); sn = Math.sin(g);
      x = v.v0 * cs + v.v1 * sn + v.v2;
      y = v.v3 * cs + v.v4 * sn + v.v5;
      z = v.v6 * cs + v.v7 * sn + v.v8;
      var onSide = (z >= 0) ? 'front' : 'back';
      if (onSide === wantSide) {
        if (!pen) { ctx.beginPath(); ctx.moveTo(cx + x, cy + y); pen = true; }
        else ctx.lineTo(cx + x, cy + y);
      } else if (pen) { ctx.stroke(); pen = false; }
    }
    if (pen) ctx.stroke();
  }

  /* -------------------------------------------------------------------- line */
  // 3D segment between two unit-ish points, clipped to the sphere (used for axes).
  function drawLine(ctx, S, head, tail, color, thick, alpha, cx, cy, wantSide) {
    var H = (head.sys === 0) ? S.WtoSz(head) : S.CtoSz(head);
    var T = (tail.sys === 0) ? S.WtoSz(tail) : S.CtoSz(tail);
    // sample along segment, split front/back by z
    var steps = 24, i, t, x, y, z, pen = false;
    ctx.lineWidth = thick; ctx.strokeStyle = rgba(color, alpha);
    for (i = 0; i <= steps; i++) {
      t = i / steps;
      x = T.x + (H.x - T.x) * t; y = T.y + (H.y - T.y) * t; z = T.z + (H.z - T.z) * t;
      var side = (z >= 0) ? 'front' : 'back';
      if (side === wantSide) {
        if (!pen) { ctx.beginPath(); ctx.moveTo(cx + x, cy + y); pen = true; }
        else ctx.lineTo(cx + x, cy + y);
      } else if (pen) { ctx.stroke(); pen = false; }
    }
    if (pen) ctx.stroke();
  }

  /* ------------------------------------------------------------------ globe  */
  // GlobeComponent: water disk + land (shore polygons) + night side + axes.
  function GlobeComponent(scale) {
    this.radius = 40;
    this.scale = scale;            // percent (globe._xscale)
    this.rotationAngle = 0;
    this.precessionAngle = 0;
    this.sunDir = null; this.skipShading = true;
    this.c = {};
    this.setPrecessionAngle(0);
    this.setRotationAngle(0, 0);
  }
  GlobeComponent.prototype.setScale = function (s) { this.scale = s; };
  GlobeComponent.prototype.setSunDirection = function (sphere, arg) {
    if (arg == null) { this.skipShading = true; this.sunDir = null; return; }
    this.sunDir = sphere.parsePoint(arg); this.skipShading = false;
  };
  GlobeComponent.prototype.setPrecessionAngle = function (arg) {
    this.precessionAngle = arg; arg *= DEG;
    var c = this.c, C = Math.cos(arg), S = Math.sin(arg);
    c.p0 = C; c.p1 = -S; c.p3 = S * 0.91706; c.p4 = C * 0.91706; c.p5 = -0.39875;
    c.p6 = S * 0.39875; c.p7 = C * 0.39875; c.p8 = 0.91706;
    this.combineQ();
  };
  GlobeComponent.prototype.setRotationAngle = function (arg, sTime) {
    this.rotationAngle = arg;
    var a = sTime + arg * DEG, c = this.c, C = Math.cos(a), S = Math.sin(a);
    c.r0 = C; c.r1 = -S; c.r3 = S * 0.91706; c.r4 = C * 0.91706; c.r5 = 0.39875;
    c.r6 = -S * 0.39875; c.r7 = -C * 0.39875; c.r8 = 0.91706;
    this.combineQ();
  };
  GlobeComponent.prototype.combineQ = function () {
    var c = this.c;
    if (c.r0 == null || c.p0 == null) return;
    c.q0 = c.p0 * c.r0 + c.p1 * c.r3; c.q1 = c.p0 * c.r1 + c.p1 * c.r4; c.q2 = c.p1 * c.r5;
    c.q3 = c.p3 * c.r0 + c.p4 * c.r3 + c.p5 * c.r6; c.q4 = c.p3 * c.r1 + c.p4 * c.r4 + c.p5 * c.r7; c.q5 = c.p4 * c.r5 + c.p5 * c.r8;
    c.q6 = c.p6 * c.r0 + c.p7 * c.r3 + c.p8 * c.r6; c.q7 = c.p6 * c.r1 + c.p7 * c.r4 + c.p8 * c.r7; c.q8 = c.p7 * c.r5 + c.p8 * c.r8;
  };
  // Draw the globe centred at (cx,cy) within sphere S.
  GlobeComponent.prototype.draw = function (ctx, S, cx, cy) {
    var sc = this.scale / 100, R = this.radius * sc, c = this.c, B = S.c;
    // --- water disk ---
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.closePath();
    var wg = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
    wg.addColorStop(0, '#c9d8f5'); wg.addColorStop(1, '#eef3fc');
    ctx.fillStyle = wg; ctx.fill();
    // clip subsequent globe art to the disk
    ctx.clip();

    // --- land (shore polygons), front-facing only ---
    var f = this.radius / B.r;
    var e13 = f * (B.b0 * c.q0 + B.b1 * c.q3 + B.b2 * c.q6);
    var e12 = f * (B.b0 * c.q1 + B.b1 * c.q4 + B.b2 * c.q7);
    var e17 = f * (B.b0 * c.q2 + B.b1 * c.q5 + B.b2 * c.q8);
    var e16 = f * (B.b3 * c.q0 + B.b4 * c.q3 + B.b5 * c.q6);
    var e15 = f * (B.b3 * c.q1 + B.b4 * c.q4 + B.b5 * c.q7);
    var e14 = f * (B.b3 * c.q2 + B.b4 * c.q5 + B.b5 * c.q8);
    var e37 = f * (B.b6 * c.q0 + B.b7 * c.q3 + B.b8 * c.q6);
    var e36 = f * (B.b6 * c.q1 + B.b7 * c.q4 + B.b8 * c.q7);
    var e35 = f * (B.b6 * c.q2 + B.b7 * c.q5 + B.b8 * c.q8);
    var data = window.SHORE_DATA || [], poly, pt, j, k;
    ctx.fillStyle = '#cdb49c';
    for (j = 0; j < data.length; j++) {
      poly = data[j];
      ctx.beginPath();
      var started = false;
      for (k = 0; k < poly.length; k++) {
        pt = poly[k];
        var depth = pt[0] * e37 + pt[1] * e36 + pt[2] * e35;
        if (depth <= 0) continue;                 // back-facing point: skip
        var lx = (pt[0] * e13 + pt[1] * e12 + pt[2] * e17) * sc;
        var ly = (pt[0] * e16 + pt[1] * e15 + pt[2] * e14) * sc;
        if (!started) { ctx.moveTo(cx + lx, cy + ly); started = true; }
        else ctx.lineTo(cx + lx, cy + ly);
      }
      if (started) { ctx.closePath(); ctx.fill(); }
    }

    // --- night side (terminator shading) ---
    if (!this.skipShading && this.sunDir) {
      var s = (this.sunDir.sys === 0) ? S.WtoSz(this.sunDir) : S.CtoSz(this.sunDir);
      var rot = Math.atan2(s.x, -s.y);
      var foreshorten = -s.z / Math.sqrt(s.x * s.x + s.y * s.y + s.z * s.z);
      ctx.translate(cx, cy); ctx.rotate(rot);
      ctx.beginPath();
      // outer semicircle (the dark limb half)
      ctx.moveTo(R, 0);
      var seg = 32, a;
      for (a = 1; a <= seg; a++) { var th = Math.PI * a / seg; ctx.lineTo(R * Math.cos(th), R * Math.sin(th)); }
      // terminator ellipse back to start (squashed by foreshorten)
      for (a = 1; a <= seg; a++) { var th2 = Math.PI - Math.PI * a / seg; ctx.lineTo(R * Math.cos(th2), foreshorten * R * Math.sin(th2)); }
      ctx.closePath();
      ctx.fillStyle = 'rgba(0,0,0,0.42)';
      ctx.fill();
    }
    ctx.restore();

    // --- polar axes (NCP red toward +pole, SCP blue) ---
    this.drawAxes(ctx, S, cx, cy);

    // outline
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU);
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(80,80,90,0.6)'; ctx.stroke();
  };
  GlobeComponent.prototype.drawAxes = function (ctx, S, cx, cy) {
    var c = this.c, B = S.c, sc = this.scale / 100;
    // pole direction in globe frame is (0,0,1) rotated by q -> column 2 of q
    var px = c.q2, py = c.q5, pz = c.q8;             // celestial-space pole dir
    var ext = 1.5 * this.radius * sc;
    var s = S.CtoSz({ x: px, y: py, z: pz });
    var n = Math.sqrt(s.x * s.x + s.y * s.y + s.z * s.z) || 1;
    var ux = s.x / n * ext, uy = s.y / n * ext;
    // north (red) and south (blue) halves
    ctx.lineWidth = 2;
    ctx.strokeStyle = (s.z >= 0) ? 'rgba(255,0,0,0.95)' : 'rgba(255,0,0,0.4)';
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + ux, cy + uy); ctx.stroke();
    ctx.strokeStyle = (s.z < 0) ? 'rgba(0,0,255,0.95)' : 'rgba(0,0,255,0.4)';
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx - ux, cy - uy); ctx.stroke();
  };

  /* ===========================================================================
   * Leaf graphics (code-drawn art)
   * ========================================================================= */
  function drawSunIcon(ctx, x, y, scale) {
    var R = 22 * scale;
    ctx.save(); ctx.translate(x, y);
    var g = ctx.createRadialGradient(0, 0, R * 0.2, 0, 0, R);
    g.addColorStop(0, '#fffceb'); g.addColorStop(0.6, '#ffe680'); g.addColorStop(1, '#ffcf3f');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(230,180,40,0.9)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
  }
  // Ray arrow: yellow filled arrow from origin along +y for `len` px, oriented.
  function drawRay(ctx, x, y, rotDeg, yscale, len) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rotDeg * DEG); ctx.scale(1, yscale);
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(9, 16); ctx.lineTo(2, 12); ctx.lineTo(2, len);
    ctx.lineTo(-2, len); ctx.lineTo(-2, 12); ctx.lineTo(-9, 16); ctx.closePath();
    ctx.fillStyle = rgba(16777164, 85); ctx.fill();
    ctx.strokeStyle = rgba(10066329, 50); ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
  }
  function drawMarker(ctx, x, y, color) {
    ctx.save(); ctx.strokeStyle = rgba(color, 100); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x + 4, y);
    ctx.moveTo(x, y - 4); ctx.lineTo(x, y + 4); ctx.stroke(); ctx.restore();
  }
  function drawLabel(ctx, x, y, text, color) {
    ctx.save();
    ctx.font = '12px Sans-Serif, Arial, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = rgba(color, 100);
    ctx.fillText(text, x, y);
    ctx.restore();
  }
  function drawSubsolar(ctx, x, y) {
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU);
    ctx.fillStyle = 'rgba(255,210,40,0.95)'; ctx.fill();
    ctx.strokeStyle = 'rgba(120,80,0,0.9)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
  }

  /* ===========================================================================
   * The simulator (port of "Symbol 1" controller frame script)
   * ========================================================================= */
  var monthPoints = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334, 365];
  var monthLabels = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
                     'August', 'September', 'October', 'November', 'December'];
  var monthShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  var sizeEarthCentered = 510, sizeSunCentered = 450;

  var Sim = {
    daysSinceVE: 286,
    animateRate: 0.005,
    observerLatitude: 0,
    centeredObject: 'sun',
    viewType: 'side',
    observerFeature: 'angle',
    showSubsolar: true,
    orbitLabels: false,
    earthLabels: false,
    animating: false,
    timeLast: 0,
    skipUpdate: false,
    reducedMotion: false,
    // readouts
    decValue: '', raValue: '', altValue: 0, sunDirection: 'S'
  };

  // sphere instances
  var OV, GS, EV;
  // canvases
  var elOrbit, elEarth, elSun, ctxOV, ctxEV, ctxSun;
  var orbitCenter = { x: 315, y: 270 }, earthCenter = { x: 150, y: 150 };

  function getDayString(doy) {
    var i = 0;
    while (doy >= monthPoints[i] && i < 13) i++;
    i = i - 1;
    return String(doy - monthPoints[i] + 1) + ' ' + monthLabels[i];
  }

  function init() {
    // ---- Orbit view sphere ----
    OV = new CSphere(sizeSunCentered / 2);
    OV.siderealTime = 12;
    OV.latitude = 66.6;
    OV.circles.meridian1 = makeCircle({ name: 'meridian1' });
    circStyle(OV.circles.meridian1, 1, 9474192, 30); circParams(OV.circles.meridian1, { alt: 0, az: 0, tilt: 90 });
    OV.circles.meridian2 = makeCircle({ name: 'meridian2' });
    circStyle(OV.circles.meridian2, 1, 9474192, 30); circParams(OV.circles.meridian2, { alt: 0, az: 90, tilt: 90 });
    OV.circles.orbitalPath = makeCircle({ name: 'orbitalPath' });
    circStyle(OV.circles.orbitalPath, 1, 16777215, 100); circParams(OV.circles.orbitalPath, { alt: 0, az: 0, tilt: 0 });
    OV.circles.celestialEquator = makeCircle({ name: 'celestialEquator' });
    circStyle(OV.circles.celestialEquator, 1, 4688176, 100); circParams(OV.circles.celestialEquator, { ra: 18, dec: 0, tilt: 0 });
    OV.circles.sunRaArc = makeCircle({ name: 'sunRaArc' });
    circStyle(OV.circles.sunRaArc, 3, 16777215, 100); circParams(OV.circles.sunRaArc, { alt: 0, az: 0, tilt: 90 });
    OV.circles.sunDecArc = makeCircle({ name: 'sunDecArc' });
    circStyle(OV.circles.sunDecArc, 3, 16665419, 100); circParams(OV.circles.sunDecArc, { alt: 0, az: 0, tilt: 90 });

    // nested globe sphere (the small earth)
    GS = new CSphere(52 / 2);
    GS.siderealTime = 12; GS.latitude = 66.6;
    var latStyle = { thickness: 1, color: 4688176, alpha: 60 };
    GS.circles.lat_0 = makeCircle(); circStyle(GS.circles.lat_0, 1, 4688176, 60); circParams(GS.circles.lat_0, { ra: 0, dec: 0, tilt: 0 });
    GS.circles.lat_66N = makeCircle(); circStyle(GS.circles.lat_66N, 1, 4688176, 60); circParams(GS.circles.lat_66N, { ra: 0, dec: 66.6, tilt: 0 });
    GS.circles.lat_66S = makeCircle(); circStyle(GS.circles.lat_66S, 1, 4688176, 60); circParams(GS.circles.lat_66S, { ra: 0, dec: -66.6, tilt: 0 });
    GS.circles.lat_23N = makeCircle(); circStyle(GS.circles.lat_23N, 1, 4688176, 60); circParams(GS.circles.lat_23N, { ra: 0, dec: 23.4, tilt: 0 });
    GS.circles.lat_23S = makeCircle(); circStyle(GS.circles.lat_23S, 1, 4688176, 60); circParams(GS.circles.lat_23S, { ra: 0, dec: -23.4, tilt: 0 });
    GS.circles.latitudeCircle = makeCircle(); circStyle(GS.circles.latitudeCircle, 1, 16711680, 40); circParams(GS.circles.latitudeCircle, { ra: 0, dec: 0, tilt: 0 });
    GS.globe = new GlobeComponent(100 * (52 / 2) / 80 * (40 / 40)); // scale = 100*size/80 (= 65)
    GS.globe.setScale(100 * 52 / 80);
    GS.subSolarVisible = true;

    // ---- Earth view sphere ----
    EV = new CSphere(150 / 2);
    EV.siderealTime = 0; EV.latitude = 66.6;
    EV.circles.lat_0 = makeCircle(); circStyle(EV.circles.lat_0, 1, 4688176, 60); circParams(EV.circles.lat_0, { ra: 0, dec: 0, tilt: 0 });
    EV.circles.lat_66N = makeCircle(); circStyle(EV.circles.lat_66N, 1, 4688176, 60); circParams(EV.circles.lat_66N, { ra: 0, dec: 66.6, tilt: 0 });
    EV.circles.lat_66S = makeCircle(); circStyle(EV.circles.lat_66S, 1, 4688176, 60); circParams(EV.circles.lat_66S, { ra: 0, dec: -66.6, tilt: 0 });
    EV.circles.lat_23N = makeCircle(); circStyle(EV.circles.lat_23N, 1, 4688176, 60); circParams(EV.circles.lat_23N, { ra: 0, dec: 23.4, tilt: 0 });
    EV.circles.lat_23S = makeCircle(); circStyle(EV.circles.lat_23S, 1, 4688176, 60); circParams(EV.circles.lat_23S, { ra: 0, dec: -23.4, tilt: 0 });
    EV.circles.latitudeCircle = makeCircle(); circStyle(EV.circles.latitudeCircle, 2, 16711680, 50); circParams(EV.circles.latitudeCircle, { ra: 0, dec: 0, tilt: 0 });
    EV.globe = new GlobeComponent(187.5);

    elOrbit = document.getElementById('orbitCanvas');
    elEarth = document.getElementById('earthCanvas');
    elSun = document.getElementById('sunlightCanvas');
    ctxOV = elOrbit.getContext('2d');
    ctxEV = elEarth.getContext('2d');
    ctxSun = elSun.getContext('2d');

    // Observer stick-figure: the exported bitmaps from the original
    // "Latitude Selector Stickfigure" symbol (frames 1-4). Reused as-is.
    [1, 2, 3, 4].forEach(function (n) {
      var img = new Image();
      img.onload = function () { if (Sim.viewType === 'side') renderEarth(); };
      img.src = 'assets/stickfigure/observer' + n + '.png';
      observerImgs[n] = img;
    });
  }
  var observerImgs = {};

  /* ----------------------------------------------------------- state changes */
  function changeDayOfYear(arg) {
    dom.dayOfYearField.textContent = getDayString(arg);
    Sim.daysSinceVE = arg + 286;
    if (dom.daySlider) dom.daySlider.setAttribute('aria-valuetext', 'Day of year, ' + getDayString(arg));
    update();
  }
  function changeLatitude(arg) {
    Sim.observerLatitude = arg;
    var t = Math.abs(Sim.observerLatitude).toFixed(1) + '°';
    if (Sim.observerLatitude < 0) t += ' S'; else if (Sim.observerLatitude > 0) t += ' N';
    setLatitudeReadout(Math.abs(Sim.observerLatitude).toFixed(1), Sim.observerLatitude);
    EV.circles.latitudeCircle && circParams(EV.circles.latitudeCircle, { dec: arg, ra: 0, tilt: 0 });
    GS.circles.latitudeCircle && circParams(GS.circles.latitudeCircle, { dec: arg, ra: 0, tilt: 0 });
    if (Number(dom.latSlider.value).toFixed(1) !== arg.toFixed(1)) dom.latSlider.value = arg;
    dom.latSlider.setAttribute('aria-valuetext', latitudeSpoken());
    update();
  }
  function changeCenteredObject() {
    if (Sim.centeredObject === 'sun') {
      setHint('orbit-instr-drag', 'click and drag the earth to change its\nposition on the orbital path');
      GS.globe.setRotationAngle(0, GS._sTime);
      GS.latitude = 66.6;
      // orbitalPath white, celestialEquator green (AS init styles)
      circStyle(OV.circles.orbitalPath, 1, 16777215, 100);
      circStyle(OV.circles.celestialEquator, 1, 4688176, 100);
    } else {
      setHint('orbit-instr-drag', 'click and drag the sun to change its\nposition on the ecliptic');
      GS.globe.setRotationAngle(180, GS._sTime);
      GS.latitude = 90;
      // earth-centred recolour: orbitalPath -> green, celestialEquator -> grey
      circStyle(OV.circles.orbitalPath, 1, 4688176, 100);
      circStyle(OV.circles.celestialEquator, 1, 10526880, 100);
    }
    OV.setSize2(Sim.centeredObject === 'sun' ? sizeSunCentered : sizeEarthCentered);
    update();
  }
  function setEarthViewType() {
    if (Sim.viewType === 'sun') {
      setHint('earth-instr', "click and drag the red latitude circle to\nchange the observer's latitude");
      EV.latitude = 66.6;
      EV.globe.setSunDirection(EV, null);     // fully lit
    } else {
      setHint('earth-instr', "click and drag the stickfigure or the red\nlatitude circle to change the observer's latitude");
      EV.latitude = 90;
    }
    update();
  }
  function changeObserverFeature() { update(); }
  function changeShowSubsolarPoint() { Sim.showSubsolar = dom.showSubsolar.checked; update(); }

  function toggleAnimation() {
    if (Sim.animating) {
      Sim.animating = false; dom.animButton.textContent = 'start animation';
      announce('status-live', 'Animation stopped.');
    } else {
      Sim.timeLast = performance.now(); Sim.animating = true;
      dom.animButton.textContent = 'stop animation';
      announce('status-live', 'Animation started.');
      requestAnimationFrame(animLoop);
    }
  }
  function animLoop(now) {
    if (!Sim.animating) return;
    Sim.daysSinceVE += Sim.animateRate * (now - Sim.timeLast);
    var d = mod(Math.round(Sim.daysSinceVE) - 286, 365);
    dom.daySlider.value = d;
    dom.dayOfYearField.textContent = getDayString(d);
    update();
    Sim.timeLast = now;
    requestAnimationFrame(animLoop);
  }

  /* ------------------------------------------------------------------ update */
  // Port of the AS update() -- computes sun position, readouts, and all geometry.
  function update() {
    if (Sim.skipUpdate) return;
    var loc1 = 270 + Sim.daysSinceVE * 360 / 365;
    var hp, loc5, loc6, loc7;

    if (Sim.centeredObject === 'sun') {
      GS.posHorizon = { alt: 0, az: 180 - loc1 };        // earth position on orbit
      OV.ray_pos = { alt: 0, az: 180 - loc1, r: 0.7 };
      OV.ray_orient = { alt: 0, az: 180 - loc1 };
      GS.subSolar = { alt: 0, az: 360 - loc1 };
      GS.globe.setSunDirection(GS, { alt: 0, az: 360 - loc1 });
      hp = GS.pointToHorizon({ dec: 0, ra: 12 + loc1 / 15 });
      loc5 = mod(-6 - hp.az / 15, 24); if (loc5 > 23.94) loc5 = 23.94;
      Sim.raValue = loc5.toFixed(1) + 'h';
      Sim.decValue = hp.alt.toFixed(1) + '°';
    } else {
      var loc8 = 12 + loc1 / 15;
      OV.sun_pos = { dec: 0, ra: loc8 };
      OV.ray_pos = { dec: 0, ra: 12 + loc1 / 15, r: 0.25 };
      OV.ray_orient = { dec: 0, ra: loc1 / 15 };
      hp = OV.pointToHorizon({ dec: 0, ra: 12 + loc1 / 15 });
      loc5 = mod(-6 - hp.az / 15, 24); if (loc5 > 23.94) loc5 = 23.94;
      Sim.raValue = loc5.toFixed(1) + 'h';
      Sim.decValue = hp.alt.toFixed(1) + '°';
      OV.raLabelPos = { alt: 4, az: hp.az + 12 }; OV.raLabelText = Sim.raValue;
      OV.decLabelPos = { az: hp.az - 9, alt: hp.alt / 2 }; OV.decLabelText = Sim.decValue;
      circParams(OV.circles.sunRaArc, { alt: 0, az: 0, tilt: 180, gammaStart: hp.az, gammaEnd: -90 });
      if (hp.alt < 0) circParams(OV.circles.sunDecArc, { alt: 0, az: hp.az, tilt: 90, gammaStart: hp.alt, gammaEnd: 0 });
      else circParams(OV.circles.sunDecArc, { alt: 0, az: hp.az, tilt: 90, gammaStart: 0, gammaEnd: hp.alt });
      GS.subSolar = hp;
      GS.globe.setSunDirection(GS, hp);
    }

    // sun altitude for an observer at the chosen latitude
    hp = OV.pointToHorizon({ dec: 0, ra: 12 + loc1 / 15 });
    var loc2 = 90 - Sim.observerLatitude + hp.alt;
    if (loc2 > 90) { loc2 = 180 - loc2; Sim.sunDirection = 'N'; }
    else { Sim.sunDirection = 'S'; }
    Sim.altValue = loc2;
    setAltitudeReadout(loc2);

    // earth-view orientation
    OV.eclipticLambda = loc1;
    if (Sim.viewType === 'sun') {
      EV.setThetaAndPhi(loc1, 0);
      EV.raysVisible = false;
    } else {
      EV.setThetaAndPhi(loc1 - 90, 0);
      var hp2 = OV.pointToHorizon({ dec: 0, ra: 12 + loc1 / 15 });
      EV.raysAlt = hp2.alt;
      EV.raysVisible = true;
      var sd = { az: hp2.az + 180, alt: hp2.alt };
      EV.globe.setSunDirection(EV, sd);
    }

    setReadout('decField', Sim.decValue);
    setReadout('raField', Sim.raValue);

    renderAll();
    narrate();
  }

  /* ------------------------------------------------------------------ render */
  function clear(ctx, el) { ctx.clearRect(0, 0, el.width, el.height); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, el.width, el.height); }

  function renderAll() {
    renderOrbit();
    renderEarth();
    renderSunlight();
  }

  // Render the left "orbit / celestial sphere" view.
  function renderOrbit() {
    var ctx = ctxOV, cx = orbitCenter.x, cy = orbitCenter.y;
    clear(ctx, elOrbit);
    var sun = (Sim.centeredObject === 'sun');

    // sync nested globe sphere orientation to the viewer
    GS.setThetaAndPhi(OV.theta, OV.phi);

    // outline ring (sphere outside) only in celestial mode
    if (!sun) {
      ctx.beginPath(); ctx.arc(cx, cy, OV.c.r, 0, TAU);
      ctx.strokeStyle = 'rgba(150,150,160,0.25)'; ctx.lineWidth = 2; ctx.stroke();
    }

    // --- BACK circles ---
    var backCircles = sun ? ['orbitalPath'] : ['orbitalPath', 'celestialEquator', 'meridian1', 'meridian2'];
    drawCircleList(ctx, OV, backCircles, cx, cy, 'back', sun);
    if (!sun) { drawSunArcs(ctx, cx, cy, 'back'); }

    // --- the earth (nested sphere) position ---
    var gpos, gsp;
    if (sun) {
      gpos = OV.parsePoint(GS.posHorizon);            // earth orbits the sun
      gsp = OV.WtoSz(gpos);
    } else {
      gpos = { x: 0, y: 0, z: 0, sys: 0, r: 0 };       // earth at centre
      gsp = { x: 0, y: 0, z: 0 };
    }
    var earthFront = (gsp.z >= 0);

    // helper to draw the small earth globe + its latitude circles
    function drawMiniEarth() {
      var ex = cx + gsp.x, ey = cy + gsp.y;
      // back lat circles
      drawCircleList(ctx, GS, ['lat_0', 'lat_66N', 'lat_66S', 'lat_23N', 'lat_23S', 'latitudeCircle'], ex, ey, 'back', false);
      GS.globe.setScale(sun ? (100 * 52 / 80) : (100 * 52 / 80));
      GS.globe.draw(ctx, GS, ex, ey);
      drawCircleList(ctx, GS, ['lat_0', 'lat_66N', 'lat_66S', 'lat_23N', 'lat_23S', 'latitudeCircle'], ex, ey, 'front', false);
      // subsolar point
      if (Sim.showSubsolar && GS.subSolar) {
        var sp = GS.WtoSz(GS.parsePoint(GS.subSolar));
        if (sp.z >= 0) drawSubsolar(ctx, ex + sp.x, ey + sp.y);
      }
    }

    // sun glyph (at centre in orbit view; an object on the sphere in celestial view)
    function drawSunHere() {
      if (sun) { drawSunIcon(ctx, cx, cy, 0.87); }
      else {
        var sp = OV.CtoSz(OV.parsePoint(OV.sun_pos));
        drawSunIcon(ctx, cx + sp.x, cy + sp.y, 0.5);
      }
    }

    // ray (arrow between sun & earth)
    function drawRayHere() {
      var pos = OV.parsePoint(OV.ray_pos);
      var sp = (pos.sys === 0) ? OV.WtoSz(pos) : OV.CtoSz(pos);
      // skewed orientation
      var o = OV.ray_orient, ov = OV.parsePoint(o);
      var on = Math.sqrt(ov.x * ov.x + ov.y * ov.y + ov.z * ov.z);
      var ounit = { x: ov.x / on, y: ov.y / on, z: ov.z / on };
      var c = OV.c;
      var zc, po;
      if (pos.sys === 0) { zc = ounit.x * c.a6 + ounit.y * c.a7 + ounit.z * c.a8; po = OV.WtoSz({ x: pos.x + ounit.x, y: pos.y + ounit.y, z: pos.z + ounit.z }); }
      else { zc = ounit.x * c.b6 + ounit.y * c.b7 + ounit.z * c.b8; po = OV.CtoSz({ x: pos.x + ounit.x, y: pos.y + ounit.y, z: pos.z + ounit.z }); }
      var ys = Math.sqrt(Math.max(0, 1 - zc * zc / c.r2));
      var rot = RAD * Math.atan2(po.y - sp.y, po.x - sp.x) + 90;
      drawRay(ctx, cx + sp.x, cy + sp.y, rot, ys, 95);
    }

    // order: things behind the earth, the earth, things in front
    if (sun) {
      drawSunHere();             // sun at centre (always visible)
      drawRayHere();             // arrow from sun outward toward earth
      drawMiniEarth();           // the orbiting earth
    } else {
      if (!earthFront) { /* earth behind */ }
      drawMiniEarth();           // earth at centre
      drawRayHere();
      drawSunHere();
    }

    // --- FRONT circles ---
    var frontCircles = sun ? ['orbitalPath'] : ['orbitalPath', 'celestialEquator', 'meridian1', 'meridian2'];
    drawCircleList(ctx, OV, frontCircles, cx, cy, 'front', sun);
    if (!sun) { drawSunArcs(ctx, cx, cy, 'front'); }

    // markers + labels
    if (!sun) {
      var ncp = OV.parsePoint({ az: 0, alt: 90 }), scp = OV.parsePoint({ az: 0, alt: -90 });
      var ns = OV.WtoSz(ncp), ss = OV.WtoSz(scp);
      drawMarker(ctx, cx + ns.x, cy + ns.y, 16777215);
      drawMarker(ctx, cx + ss.x, cy + ss.y, 16777215);
    }
    drawOrbitLabels(ctx, cx, cy, sun);
  }

  function drawSunArcs(ctx, cx, cy, side) {
    if (Sim.centeredObject === 'sun') return;
    if (!OV.sunArcsVisible) return;
    drawCircle(ctx, OV, OV.circles.sunRaArc, cx, cy, side);
    drawCircle(ctx, OV, OV.circles.sunDecArc, cx, cy, side);
  }

  function drawCircleList(ctx, S, names, cx, cy, side, sunMode) {
    for (var i = 0; i < names.length; i++) {
      var circ = S.circles[names[i]];
      if (!circ) continue;
      // visibility per mode
      if (S === OV) {
        if ((names[i] === 'celestialEquator' || names[i] === 'meridian1' || names[i] === 'meridian2') && sunMode) continue;
      }
      drawCircle(ctx, S, circ, cx, cy, side);
    }
  }

  function drawOrbitLabels(ctx, cx, cy, sun) {
    if (!Sim.orbitLabels) {
      // RA/Dec value labels show only on sun hover (handled by sunArcsVisible)
    }
    if (!sun && OV.sunArcsVisible) {
      // RA / Dec arc value labels
      var rp = OV.WtoSz(OV.parsePoint(OV.raLabelPos));
      var dp = OV.WtoSz(OV.parsePoint(OV.decLabelPos));
      drawLabel(ctx, cx + rp.x, cy + rp.y, OV.raLabelText, 16777215);
      drawLabel(ctx, cx + dp.x, cy + dp.y, OV.decLabelText, 16665419);
    }
    if (!Sim.orbitLabels) return;
    if (sun) {
      labelAt(ctx, cx, cy, { x: 0, y: 1.16, z: 0, system: 'horizon' }, 'to AE', 16777215);
      labelAt(ctx, cx, cy, { x: -1.16, y: 0, z: 0, system: 'horizon' }, 'to WS', 16777215);
      labelAt(ctx, cx, cy, { x: 0, y: -1.16, z: 0, system: 'horizon' }, 'to VE', 16777215);
      labelAt(ctx, cx, cy, { x: 1.16, y: 0, z: 0, system: 'horizon' }, 'to SS', 16777215);
      labelAt(ctx, cx, cy, { alt: 0, az: OV.viewerAzimuth - 30, r: 1.15 }, 'orbit path', 16777215);
    } else {
      labelAt(ctx, cx, cy, { alt: 0, az: OV.viewerAzimuth + 30 }, 'celestial equator', 4688176);
      labelAt(ctx, cx, cy, { dec: 0, ra: -OV.viewerAzimuth / 15 + 2 }, 'ecliptic', 16777215);
      labelAt(ctx, cx, cy, { az: 0, alt: 90 }, 'NCP', 16777215);
      labelAt(ctx, cx, cy, { az: 0, alt: -90 }, 'SCP', 16777215);
      labelAt(ctx, cx, cy, { x: 0, y: 0.75, z: 0, system: 'celestial' }, 'to AE', 16777215);
      labelAt(ctx, cx, cy, { x: 0.75, y: 0, z: 0, system: 'celestial' }, 'to WS', 16777215);
      labelAt(ctx, cx, cy, { x: 0, y: 0.75, z: 0, system: 'celestial' }, 'to VE', 16777215);
      labelAt(ctx, cx, cy, { x: -0.75, y: 0, z: 0, system: 'celestial' }, 'to SS', 16777215);
    }
  }
  function labelAt(ctx, cx, cy, pos, text, color) {
    var p = OV.parsePoint(pos), sp = (p.sys === 0) ? OV.WtoSz(p) : OV.CtoSz(p);
    if (sp.z < -0.001 && p.r <= 1.0001) { /* behind, dim */ }
    drawLabel(ctx, cx + sp.x, cy + sp.y, text, color);
  }

  // Render the upper-right earth view.
  function renderEarth() {
    var ctx = ctxEV, cx = earthCenter.x, cy = earthCenter.y;
    clear(ctx, elEarth);

    var latNames = ['lat_0', 'lat_66N', 'lat_66S', 'lat_23N', 'lat_23S', 'latitudeCircle'];
    drawCircleList(ctx, EV, latNames, cx, cy, 'back', false);
    EV.globe.draw(ctx, EV, cx, cy);
    drawCircleList(ctx, EV, latNames, cx, cy, 'front', false);

    // side-view sun rays: parallel sunlight striking the sun-facing surface,
    // drawn on top so the beams are visible over the lit hemisphere.
    if (Sim.viewType === 'side' && EV.raysVisible) {
      drawSideRays(ctx);
    }

    // subsolar point on earth-view globe
    if (Sim.showSubsolar) {
      if (Sim.viewType === 'side') {
        // side subsolar marker sits on the lit limb
        var a = EV.raysAlt * DEG;
        drawSubsolar(ctx, cx + 75 * Math.cos(a), cy - 75 * Math.sin(a));
      } else {
        drawSubsolar(ctx, cx, cy);   // facing viewer
      }
    }

    // labels
    if (Sim.earthLabels) drawEarthLabels(ctx, cx, cy);

    // latitude selector stickfigure (side view only)
    if (Sim.viewType === 'side') drawStickfigure(ctx, cx, cy);
  }

  // Parallel sunlight striking the side-on earth.  Per the AS the whole ray
  // group is rotated by -dec (raysMC._rotation = -_loc3_.alt, where _loc3_.alt is
  // the sun's declination), so the rays are horizontal at the equinoxes and tilt
  // with the season; the central ray points straight at the sub-solar point.
  // As the earth moves around its orbit the declination changes and the beams
  // sweep up/down accordingly.
  function drawSideRays(ctx) {
    var cx = earthCenter.x, cy = earthCenter.y;
    var dec = EV.raysAlt;                         // sun's declination
    var bright = Math.max(0, Math.sin(Sim.altValue * DEG));
    if (bright <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math.min(1, Math.pow(bright, 0.5));
    var t = dec * DEG;
    var dx = -Math.cos(t), dy = Math.sin(t);      // travel direction (toward earth)
    var px = -dy, py = dx;                          // across the beam
    var R = 76, len = 92, spacing = 34;            // 5 rays spanning the globe
    for (var k = -2; k <= 2; k++) {
      var s = k * spacing;
      var ox = cx + px * s, oy = cy + py * s;       // beam-axis offset across the earth
      // head lands on the sun-facing surface; if the ray misses, use the foot
      var along = Math.abs(s) < R ? Math.sqrt(R * R - s * s) : 0;
      var hx = ox - dx * along, hy = oy - dy * along;
      drawArrow(ctx, hx - dx * len, hy - dy * len, hx, hy, rgba(16777164, 90));
    }
    ctx.restore();
  }
  function drawArrow(ctx, x1, y1, x2, y2, color) {
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    var a = Math.atan2(y2 - y1, x2 - x1);
    ctx.beginPath(); ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - 9 * Math.cos(a - 0.4), y2 - 9 * Math.sin(a - 0.4));
    ctx.lineTo(x2 - 9 * Math.cos(a + 0.4), y2 - 9 * Math.sin(a + 0.4));
    ctx.closePath(); ctx.fill();
  }

  function drawEarthLabels(ctx, cx, cy) {
    var labels = [
      { dec: 23.4, txt: 'tropic of cancer' }, { dec: -23.4, txt: 'tropic of capricorn' },
      { dec: 0, txt: 'equator' }, { dec: 66.6, txt: 'arctic circle' },
      { dec: -66.6, txt: 'antarctic circle' }, { dec: 90, txt: 'north pole' }, { dec: -90, txt: 'south pole' }
    ];
    var loc4 = (Sim.viewType === 'sun') ? (6 + OV.eclipticLambda / 15) : (OV.eclipticLambda / 15);
    for (var i = 0; i < labels.length; i++) {
      var p = EV.parsePoint({ dec: labels[i].dec, ra: loc4, r: 1.05 });
      var sp = EV.CtoSz(p);
      if (sp.z >= -2) drawLabel(ctx, cx + sp.x, cy + sp.y, labels[i].txt, 12303291);
    }
  }

  // Observer stick figure -- the exported "Latitude Selector Stickfigure"
  // bitmap, positioned exactly as the AS does: on a radius-75 circle at the
  // latitude angle, rotated 90 + atan2(y,x) so it stands radially on the globe.
  // Frame 1 rests; frame 2 (both arrows) shows while dragging; frames 4/3 at
  // the north/south pole limits.
  function drawStickfigure(ctx, cx, cy) {
    var lat = Sim.observerLatitude;
    var frame = lat >= 90 ? 4 : lat <= -90 ? 3 : (Sim.draggingLat ? 2 : 1);
    var img = observerImgs[frame];
    if (!img || !img.complete || !img.naturalWidth) return;
    var R = 75, a = lat * DEG;
    var x = R * Math.cos(a), y = -R * Math.sin(a);      // offset from globe centre
    var rot = (90 + RAD * Math.atan2(y, x)) * DEG;       // = (90 - lat) degrees
    ctx.save();
    ctx.translate(cx + x, cy + y);
    ctx.rotate(rot);
    // anchor the figure's feet (bottom-centre of the upright bitmap) on the
    // globe surface so it stands outward.
    ctx.drawImage(img, -img.width / 2, -img.height);
    ctx.restore();
  }

  /* ------------------------------------------------- sunlight / sunbeam panel */
  function renderSunlight() {
    var ctx = ctxSun, W = elSun.width, H = elSun.height;
    if (Sim.observerFeature === 'angle') renderSideSunbeam(ctx, W, H);
    else renderSunbeamSpread(ctx, W, H);
    dom.sunbeamDirLabels.style.display = (Sim.observerFeature === 'angle') ? 'flex' : 'none';
  }

  // "sunlight angle" -- blue sky + green ground + parallel beams at sun altitude.
  function renderSideSunbeam(ctx, W, H) {
    var horizonHeight = 50, alt = Sim.altValue;
    ctx.clearRect(0, 0, W, H);
    // sky
    var sky = ctx.createLinearGradient(0, 0, 0, H - horizonHeight);
    sky.addColorStop(0, '#6599ef'); sky.addColorStop(1, '#b0b6f2');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H - horizonHeight);
    // ground
    var gnd = ctx.createLinearGradient(0, H - horizonHeight, 0, H);
    gnd.addColorStop(0, '#7ea213'); gnd.addColorStop(1, '#326d1d');
    ctx.fillStyle = gnd; ctx.fillRect(0, H - horizonHeight, W, horizonHeight);

    // beams
    var fade = Math.max(0, Math.sin(alt * DEG));
    ctx.save();
    ctx.globalAlpha = fade === 0 ? 0 : Math.pow(fade, 0.5);
    var dir = Sim.sunDirection;
    var ang = (90 + alt) * DEG;       // beam travel direction (pointing down-into-ground)
    var dx = Math.cos(ang), dy = Math.sin(ang);
    if (dir === 'S') { dx = -dx; }    // mirror for southern direction
    var len = 46;
    var spacing = (alt > 0) ? 30 / Math.sin(alt * DEG) : 30;
    var baseY = H - horizonHeight;
    for (var x = -40; x < W + 40; x += Math.min(120, spacing)) {
      drawArrow(ctx, x - dx * len, baseY - 90 - dy * len + (x * (dir === 'S' ? -1 : 1) * 0), x, baseY, rgba(16777164, 85));
    }
    ctx.restore();

    // night pall
    var pall;
    if (alt > 0) { pall = 40 * Math.pow((10 - alt) / 10, 3); if (pall < 0) pall = 0; }
    else pall = 40;
    if (pall > 0) { ctx.fillStyle = rgba(0, pall); ctx.fillRect(0, 0, W, H); }

    setReadout('altitudeField', "sun's altitude: " + alt.toFixed(1) + '°');
    setSunlightLat();
    ctx.strokeStyle = '#666'; ctx.lineWidth = 1; ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
  }

  // "sunbeam spread" -- a grid with an elliptical beam spot that spreads with altitude.
  function renderSunbeamSpread(ctx, W, H) {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
    // grid
    ctx.strokeStyle = rgba(12966910, 100); ctx.lineWidth = 1;
    var bd = 40, cx = W / 2, cy = H / 2, n, off;
    for (n = 0; off = bd * (n + 0.5), off < W / 2; n++) {
      ctx.beginPath(); ctx.moveTo(cx - off, 0); ctx.lineTo(cx - off, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + off, 0); ctx.lineTo(cx + off, H); ctx.stroke();
    }
    for (n = 0; off = bd * (n + 0.5), off < H / 2; n++) {
      ctx.beginPath(); ctx.moveTo(0, cy - off); ctx.lineTo(W, cy - off); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, cy + off); ctx.lineTo(W, cy + off); ctx.stroke();
    }
    // beam spot: a circle of diameter bd stretched vertically by 1/sin(alt)
    var alt = Sim.altValue, s = Math.sin(alt * DEG); if (s < 0) s = 0;
    var alpha = s === 0 ? 0 : Math.pow(s, 0.5);
    var ys = (s < 0.05 ? 0.05 : s);
    ctx.save(); ctx.translate(cx, cy); ctx.scale(1, 1 / ys);
    ctx.globalAlpha = alpha;
    var sg = ctx.createRadialGradient(0, 0, bd * 0.1, 0, 0, bd / 2);
    sg.addColorStop(0, '#fff7c0'); sg.addColorStop(1, 'rgba(255,236,120,0.1)');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(0, 0, bd / 2, 0, TAU); ctx.fill();
    ctx.restore();

    // pall
    var pall;
    if (alt > 0) { pall = 20 * Math.pow((10 - alt) / 10, 3); if (pall < 0) pall = 0; }
    else pall = 20;
    if (pall > 0) { ctx.fillStyle = rgba(0, pall); ctx.fillRect(0, 0, W, H); }

    ctx.strokeStyle = rgba(6710886, 100); ctx.lineWidth = 1; ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
    setReadout('altitudeField', "sun's altitude: " + alt.toFixed(1) + '°');
    setSunlightLat();
  }

  function setSunlightLat() {
    var t = Math.abs(Sim.observerLatitude).toFixed(1) + '°';
    if (Sim.observerLatitude < 0) t += ' S'; else if (Sim.observerLatitude > 0) t += ' N';
    setReadout('sunlightLatField', 'observer latitude: ' + t);
  }

  /* =================================================== MathJax readout helpers */
  // Numbers with units are typeset with MathJax so right-click exposes the menu
  // and screen readers get a spoken (units-complete) description.
  var pendingTypeset = {}, typesetting = false;
  function setReadout(id, text) {
    var el = document.getElementById(id);
    if (!el) return;
    var latex = '\\(' + texify(text) + '\\)';
    if (el.getAttribute('data-tex') === latex) return;   // unchanged -> skip
    el.setAttribute('data-tex', latex);
    el.innerHTML = latex;
    pendingTypeset[id] = el;
    flushTypeset();
  }
  // Coalescing typeset: never queue overlapping MathJax passes; only the most
  // recent values are typeset, so 60fps animation cannot pile up promises.
  function flushTypeset() {
    if (typesetting) return;
    if (!(window.MathJax && MathJax.typesetPromise)) return;
    var els = [], k;
    for (k in pendingTypeset) els.push(pendingTypeset[k]);
    pendingTypeset = {};
    if (!els.length) return;
    typesetting = true;
    MathJax.typesetPromise(els).catch(function () {}).then(function () {
      typesetting = false; flushTypeset();
    });
  }
  // Convert a plain readout like "-14.3°" or "21.6h" or "observer latitude: 10.0° N"
  // into a LaTeX fragment.
  function texify(s) {
    // split a leading label (text before a number)
    return s
      .replace(/([0-9.\-]+)°/g, '$1^{\\circ}')
      .replace(/([0-9.]+)h\b/g, '$1\\,\\mathrm{h}')
      .replace(/sun's right ascension:/, '\\text{sun’s right ascension: }')
      .replace(/sun's declination:/, '\\text{sun’s declination: }')
      .replace(/sun's altitude:/, '\\text{sun’s altitude: }')
      .replace(/observer latitude:/, '\\text{observer latitude: }')
      .replace(/observer's latitude:/, '\\text{observer’s latitude: }')
      .replace(/ N\b/g, '\\ \\mathrm{N}')
      .replace(/ S\b/g, '\\ \\mathrm{S}');
  }
  var mjReady = false, mjQueue = [];
  function typeset(el) {
    if (window.MathJax && MathJax.typesetPromise) {
      MathJax.typesetPromise([el]).catch(function (e) { });
    } else { mjQueue.push(el); }
  }
  function setReadoutPlain(id, html) { var el = document.getElementById(id); if (el) el.innerHTML = html; }

  function setLatitudeReadout(absVal, signed) {
    var dir = signed < 0 ? ' S' : (signed > 0 ? ' N' : '');
    setReadout('latitudeField', "observer's latitude: " + absVal + '°' + dir);
  }
  function setAltitudeReadout(v) { /* updated inside the panel renderers */ }

  /* ==================================================== screen-reader narration */
  function announce(id, msg) { var el = document.getElementById(id); if (el) el.textContent = msg; }
  var lastNarr = '';
  function narrate() {
    if (Sim.animating) return;   // don't flood the live region every frame
    var lat = Math.abs(Sim.observerLatitude).toFixed(1) +
      ' degrees ' + (Sim.observerLatitude < 0 ? 'south' : (Sim.observerLatitude > 0 ? 'north' : ''));
    var dec = Sim.decValue.replace('°', '').trim();
    var ra = Sim.raValue.replace('h', '').trim();
    var dayTxt = dom.dayOfYearField.textContent;
    var msg = 'Day ' + dayTxt + '. Sun’s declination ' + dec + ' degrees, right ascension ' + ra +
      ' hours. Observer latitude ' + lat + '. Sun’s altitude ' + Sim.altValue.toFixed(1) +
      ' degrees toward the ' + (Sim.sunDirection === 'N' ? 'north' : 'south') + '.';
    if (msg !== lastNarr) { lastNarr = msg; announce('status-live', msg); }
  }

  /* ----------------------------------------------------------- hint utilities */
  function setHint(id, text) { var el = document.getElementById(id); if (el) el.textContent = text; }

  /* ------------------------------------------------------------- pointer drag */
  function canvasPoint(el, S, center, evt) {
    var rect = el.getBoundingClientRect();
    var scaleX = el.width / rect.width, scaleY = el.height / rect.height;
    return { x: (evt.clientX - rect.left) * scaleX - center.x,
             y: (evt.clientY - rect.top) * scaleY - center.y };
  }

  // Orbit-panel drag.  The perspective / orbital plane stays FIXED; the mouse
  // only moves the earth around its orbital path (orbit view) — equivalently the
  // sun along the ecliptic (celestial-sphere view) — which is the same "earth
  // revolves" action.  This ports the AS globe-drag and Sun-Icon-drag inverses.
  function setupOrbitDrag() {
    var drag = null;
    elOrbit.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      try { elOrbit.setPointerCapture(e.pointerId); } catch (err) {}
      try { elOrbit.focus({ preventScroll: true }); } catch (err) { elOrbit.focus(); }
      var m = canvasPoint(elOrbit, OV, orbitCenter, e);
      if (Sim.centeredObject === 'sun') {
        // grab the earth; keep its offset from the cursor so it doesn't jump
        var gsp = OV.WtoSz(OV.parsePoint(GS.posHorizon));
        drag = { mode: 'earth', ox: gsp.x - m.x, oy: gsp.y - m.y };
      } else {
        // grab the sun on the celestial sphere
        OV.sunArcsVisible = true;
        var c = OV.c, r = c.r, x = m.x, y = m.y, rr = Math.sqrt(x * x + y * y), z, side;
        var ssp = OV.CtoSz(OV.parsePoint(OV.sun_pos));
        if (rr > r) { x *= r / rr; y *= r / rr; z = 0; side = 0; }
        else if (ssp.z > 0) { z = Math.sqrt(r * r - rr * rr); side = 1; }
        else { z = -Math.sqrt(r * r - rr * rr); side = 0; }
        var loc8 = R2H * Math.atan2(c.b1 * x + c.b4 * y + c.b7 * z, c.b0 * x + c.b3 * y + c.b6 * z);
        drag = { mode: 'sun', raOffset: loc8 - mod(OV.sun_pos.ra, 24), side: side };
        update();
      }
    });
    elOrbit.addEventListener('pointermove', function (e) {
      if (!drag) return;
      e.preventDefault();
      var m = canvasPoint(elOrbit, OV, orbitCenter, e);
      if (drag.mode === 'earth') orbitDragEarth(m.x + drag.ox, m.y + drag.oy);
      else orbitDragSun(m.x, m.y, drag);
    });
    function endDrag() { if (!drag) return; drag = null; OV.sunArcsVisible = false; update(); }
    elOrbit.addEventListener('pointerup', endDrag);
    elOrbit.addEventListener('pointercancel', endDrag);
    elOrbit.addEventListener('lostpointercapture', endDrag);

    // keyboard: move the earth around its orbit (change the day) — the plane
    // stays fixed, matching the mouse behaviour.
    elOrbit.addEventListener('keydown', function (e) {
      var step = 0, handled = true;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') step = 1;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') step = -1;
      else if (e.key === 'PageUp') step = 7;
      else if (e.key === 'PageDown') step = -7;
      else handled = false;
      if (handled) {
        e.preventDefault();
        var d = mod(parseInt(dom.daySlider.value, 10) + step, 365);
        dom.daySlider.value = d; changeDayOfYear(d);
        announce('orbit-live', 'Earth moved to ' + getDayString(d) + '.');
      }
    });
  }

  // Orbit view: recover the earth's orbital azimuth from the cursor.
  //
  // The orbital path is the horizon-plane circle {alt:0}; projected it is an
  // ellipse  sx = -r sin(beta),  sy = r sin(phi) cos(beta)  with beta = az+theta.
  // Inverting directly -- beta = atan2(-sx*sin(phi), sy) -- "unsquashes" the
  // ellipse and gives a single, continuous angle all the way around, so the
  // earth follows the cursor smoothly even at the left/right silhouette edges
  // (where the old sphere back-projection flipped front/back). The 360deg wrap
  // at the back of the orbit maps to exactly 365 days, so it is seamless too.
  function orbitDragEarth(sx, sy) {
    var sinPhi = Math.sin(OV._phi);
    if (Math.abs(sinPhi) < 1e-4) sinPhi = sinPhi < 0 ? -1e-4 : 1e-4;
    var beta = Math.atan2(-sx * sinPhi, sy);
    var azDeg = (beta - OV._theta) * RAD;
    var day = mod(Math.round((-azDeg) * 1.0138888888888888 - 377.25), 365);
    dom.daySlider.value = day; changeDayOfYear(day);
  }

  // Celestial-sphere view: back-project the sun's screen position through the
  // celestial->screen (b) matrix to recover RA, then the day. (AS Sun Icon drag.)
  function orbitDragSun(sx, sy, drag) {
    var c = OV.c, r = c.r, x = sx, y = sy, rr = Math.sqrt(x * x + y * y), z;
    if (rr > r) { x *= r / rr; y *= r / rr; z = 0; }
    else if (drag.side === 1) z = Math.sqrt(r * r - rr * rr);
    else z = -Math.sqrt(r * r - rr * rr);
    var loc9 = R2H * Math.atan2(c.b1 * x + c.b4 * y + c.b7 * z,
                                c.b0 * x + c.b3 * y + c.b6 * z) - drag.raOffset;
    var loc10 = (15 * (loc9 - 12) - 270) * 1.0138888888888888;
    var day = mod(Math.round(loc10) - 286, 365);
    dom.daySlider.value = day; changeDayOfYear(day);
  }

  function setupEarthDrag() {
    var dragging = false;
    function applyLat(m) {
      // dragging the red latitude circle / stickfigure -> latitude = mouse dec
      var rd = EV.getMouseRaDec(m.x, m.y);
      if (rd.dec != null) changeLatitude(Math.max(-90, Math.min(90, rd.dec)));
    }
    elEarth.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      try { elEarth.setPointerCapture(e.pointerId); } catch (err) {}
      try { elEarth.focus({ preventScroll: true }); } catch (err) { elEarth.focus(); }
      dragging = true; Sim.draggingLat = true; applyLat(canvasPoint(elEarth, EV, earthCenter, e));
    });
    elEarth.addEventListener('pointermove', function (e) {
      if (dragging) { e.preventDefault(); applyLat(canvasPoint(elEarth, EV, earthCenter, e)); }
    });
    function end() { if (!dragging) return; dragging = false; Sim.draggingLat = false; renderEarth(); }
    elEarth.addEventListener('pointerup', end);
    elEarth.addEventListener('pointercancel', end);
    elEarth.addEventListener('lostpointercapture', end);
    elEarth.addEventListener('keydown', function (e) {
      var step = (e.shiftKey ? 10 : 1), handled = true, v = Sim.observerLatitude;
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') v = Math.min(90, v + step);
      else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') v = Math.max(-90, v - step);
      else handled = false;
      if (handled) { e.preventDefault(); changeLatitude(v); announce('earth-live', latitudeSpoken()); }
    });
  }
  function latitudeSpoken() {
    var a = Math.abs(Sim.observerLatitude).toFixed(1);
    return 'Observer latitude ' + a + ' degrees ' + (Sim.observerLatitude < 0 ? 'south' : (Sim.observerLatitude > 0 ? 'north' : '')) + '.';
  }

  /* -------------------------------------------------------------------- reset */
  function onReset() {
    Sim.skipUpdate = true;
    if (Sim.animating) toggleAnimation();
    OV.sunArcsVisible = false;
    Sim.observerFeature = 'angle'; dom.featAngle.checked = true;
    Sim.viewType = 'side'; dom.viewSide.checked = true;
    Sim.centeredObject = 'sun'; dom.viewOrbit.checked = true;
    Sim.orbitLabels = false; dom.orbitLabels.checked = false;
    Sim.earthLabels = false; dom.earthLabels.checked = false;
    Sim.showSubsolar = true; dom.showSubsolar.checked = true;
    changeCenteredObject(); setEarthViewType();
    changeDayOfYear(40); dom.daySlider.value = 40;
    changeLatitude(10); dom.latSlider.value = 10;
    OV.viewerAzimuth = 270; OV.viewerAltitude = 30;
    Sim.skipUpdate = false;
    update();
    announce('status-live', 'Simulator reset.');
  }

  /* -------------------------------------------------------------------- wire  */
  var dom = {};
  function wire() {
    dom.daySlider = document.getElementById('daySlider');
    dom.dayOfYearField = document.getElementById('dayOfYearField');
    dom.animButton = document.getElementById('animButton');
    dom.latSlider = document.getElementById('latSlider');
    dom.showSubsolar = document.getElementById('showSubsolar');
    dom.orbitLabels = document.getElementById('orbitLabels');
    dom.earthLabels = document.getElementById('earthLabels');
    dom.featAngle = document.getElementById('featAngle');
    dom.featSpread = document.getElementById('featSpread');
    dom.viewSun = document.getElementById('viewSun');
    dom.viewSide = document.getElementById('viewSide');
    dom.viewOrbit = document.getElementById('viewOrbit');
    dom.viewCelestial = document.getElementById('viewCelestial');
    dom.sunbeamDirLabels = document.getElementById('sunbeamDirLabels');

    dom.daySlider.addEventListener('input', function () {
      var d = parseInt(this.value, 10);
      changeDayOfYear(d);
      this.setAttribute('aria-valuetext', 'Day of year, ' + getDayString(d));
    });
    dom.latSlider.addEventListener('input', function () {
      changeLatitude(parseFloat(this.value));
      this.setAttribute('aria-valuetext', latitudeSpoken());
    });
    dom.animButton.addEventListener('click', toggleAnimation);
    dom.showSubsolar.addEventListener('change', changeShowSubsolarPoint);
    dom.orbitLabels.addEventListener('change', function () { Sim.orbitLabels = this.checked; update(); });
    dom.earthLabels.addEventListener('change', function () { Sim.earthLabels = this.checked; update(); });

    document.querySelectorAll('input[name="centeredObject"]').forEach(function (r) {
      r.addEventListener('change', function () { if (this.checked) { Sim.centeredObject = this.value; changeCenteredObject(); } });
    });
    document.querySelectorAll('input[name="viewType"]').forEach(function (r) {
      r.addEventListener('change', function () { if (this.checked) { Sim.viewType = this.value; setEarthViewType(); } });
    });
    document.querySelectorAll('input[name="observerFeature"]').forEach(function (r) {
      r.addEventListener('change', function () { if (this.checked) { Sim.observerFeature = this.value; changeObserverFeature(); } });
    });

    // masthead reset
    document.addEventListener('sim-reset', onReset);

    buildMonthTicks();
    setupOrbitDrag();
    setupEarthDrag();
  }

  function buildMonthTicks() {
    var wrap = document.getElementById('monthTicks');
    var pts = monthPoints;
    for (var i = 0; i < 12; i++) {
      var mid = pts[i] + (pts[i + 1] - pts[i]) / 2;
      var span = document.createElement('span');
      span.className = 'tick'; span.textContent = monthShort[i];
      span.style.left = (100 * mid / 365) + '%';
      wrap.appendChild(span);
    }
  }

  // foundation hook: called by kl-unl.js on load; we (re)initialise here too.
  window.klunlInitEqn = function () { /* equations created on demand in setReadout */ };

  function boot() {
    init();
    wire();
    onReset();
    // Re-typeset readouts once MathJax has finished starting up.
    if (window.MathJax && MathJax.startup && MathJax.startup.promise) {
      MathJax.startup.promise.then(function () {
        ['decField', 'raField', 'altitudeField', 'sunlightLatField', 'latitudeField'].forEach(function (id) {
          var e = document.getElementById(id); if (e) e.removeAttribute('data-tex');
        });
        update();
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})();
