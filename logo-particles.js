/*!
 * Mouad Bouzid — Logo-inspired particle hero background
 * Self-contained: creates / reuses <canvas id="canvas"> inside #home,
 * styles it via JS (z-index -1, pointer-events none) and never touches
 * any existing CSS, markup or script.
 *
 * Concept: a free-flowing particle network periodically gathers itself
 * into the "M" ring + speech-bubble logo, holds, dissolves and repeats.
 */
(function () {
  'use strict';
  if (window.__mbLogoParticles) return;
  window.__mbLogoParticles = true;

  /* ------------------------------------------------------------------ */
  /* CONFIG                                                              */
  /* ------------------------------------------------------------------ */
  var CFG = {
    heroSelector: '#home',
    maxDPR: 2,
    density: 2000,          // px² of hero per particle (desktop)
    minParticles: 220,
    maxParticles: 1100,
    mobileMaxParticles: 900,
    formRatio: 0.95,        // share of particles that build the logo
    linkFree: [78, 125],    // [mobile, desktop] link distance while free
    anchorXWide: 0.5,       // logo centre (fraction of width) on wide screens
    anchorY: 0.5,
    mouseRadius: [90, 135], // [mobile, desktop]
    // phase durations (ms): form → hold → dissolve → free
    phases: [['form', 2300], ['hold', 7000], ['dissolve', 1400], ['free', 2600]],
    startDelay: 300
  };

  /* Logo geometry (traced from the logo, coordinates in a 1190×1650 space) */
  var LOGO = { x: 40, y: 165, w: 1090, h: 1280 };
  var RING_OUT = { cx: 585, cy: 700, rx: 535, ry: 528 };
  var RING_IN = { cx: 628, cy: 732, rx: 410, ry: 412 };
  var M_PATH = 'M470,950 C440,880 400,740 372,590 C365,545 370,520 390,520 ' +
    'C440,525 520,600 600,700 C660,780 720,880 755,960 C775,985 800,960 790,900 ' +
    'C775,800 740,700 735,640 C740,620 760,625 790,650 C850,710 900,800 950,900 ' +
    'C960,925 985,905 1000,870';
  var TAIL_PATH = 'M505,1285 Q700,1300 1070,1140 Q1050,1250 925,1310 Q935,1400 880,1430 ' +
    'Q830,1420 765,1365 Q600,1360 505,1285 Z';

  /* Colours sampled from the logo */
  var BLUE_DEEP = [5, 141, 255];
  var BLUE_MID = [29, 161, 253];
  var BLUE_SOFT = [110, 192, 250];
  var CREAM = [253, 252, 245];
  var RING_STOPS = [
    [-90, [5, 141, 255]], [0, [10, 145, 254]], [30, [60, 170, 252]],
    [48, [250, 251, 248]], [75, [243, 247, 248]], [100, [205, 232, 250]],
    [130, [140, 203, 249]], [160, [80, 176, 251]], [190, [40, 160, 253]],
    [230, [11, 143, 255]], [270, [5, 141, 255]]
  ];

  /* ------------------------------------------------------------------ */
  /* Helpers                                                             */
  /* ------------------------------------------------------------------ */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = (Math.random() * (i + 1)) | 0, t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function ringColor(x, y) {
    var a = Math.atan2(y - RING_OUT.cy, x - RING_OUT.cx) * 180 / Math.PI;
    if (a < -90) a += 360;
    for (var i = 0; i < RING_STOPS.length - 1; i++) {
      var s0 = RING_STOPS[i], s1 = RING_STOPS[i + 1];
      if (a >= s0[0] && a <= s1[0]) {
        var t = (a - s0[0]) / (s1[0] - s0[0]);
        return [lerp(s0[1][0], s1[1][0], t), lerp(s0[1][1], s1[1][1], t), lerp(s0[1][2], s1[1][2], t)];
      }
    }
    return BLUE_DEEP.slice();
  }

  /* ------------------------------------------------------------------ */
  /* Logo mask → sampled points                                          */
  /* ------------------------------------------------------------------ */
  var MASK_SCALE = 0.25, UNIT = 1 / MASK_SCALE;
  var parts = null;

  function buildMask() {
    var mw = Math.ceil(LOGO.w * MASK_SCALE), mh = Math.ceil(LOGO.h * MASK_SCALE);
    var c = document.createElement('canvas');
    c.width = mw; c.height = mh;
    var g = c.getContext('2d', { willReadFrequently: true });
    var out = [];

    function collect(name, draw, colorFn) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, mw, mh);
      g.setTransform(MASK_SCALE, 0, 0, MASK_SCALE, -LOGO.x * MASK_SCALE, -LOGO.y * MASK_SCALE);
      g.fillStyle = '#000'; g.strokeStyle = '#000';
      draw(g);
      var data = g.getImageData(0, 0, mw, mh).data, pts = [];
      for (var y = 0; y < mh; y++) {
        for (var x = 0; x < mw; x++) {
          if (data[(y * mw + x) * 4 + 3] > 128) {
            pts.push([LOGO.x + (x + Math.random()) * UNIT, LOGO.y + (y + Math.random()) * UNIT]);
          }
        }
      }
      out.push({ name: name, pts: pts, color: colorFn });
    }

    collect('ring', function (g) {
      g.beginPath();
      g.ellipse(RING_OUT.cx, RING_OUT.cy, RING_OUT.rx, RING_OUT.ry, 0, 0, Math.PI * 2);
      g.ellipse(RING_IN.cx, RING_IN.cy, RING_IN.rx, RING_IN.ry, 0, 0, Math.PI * 2);
      g.fill('evenodd');
    }, function (x, y) { return ringColor(x, y); });

    collect('m', function (g) {
      g.lineWidth = 112; g.lineJoin = 'round'; g.lineCap = 'round';
      g.stroke(new Path2D(M_PATH));
    }, function (x, y) {
      var t = clamp((y - 520) / 480, 0, 1);
      return [lerp(BLUE_MID[0], 16, t), lerp(BLUE_MID[1], 152, t), 254];
    });

    collect('tail', function (g) { g.fill(new Path2D(TAIL_PATH)); },
      function () { return CREAM.slice(); });

    return out;
  }

  function dart(pts, idx, dmin, want) {
    var cell = dmin, d2 = dmin * dmin, grid = {}, res = [];
    for (var k = 0; k < idx.length && res.length < want; k++) {
      var p = pts[idx[k]], cx = (p[0] / cell) | 0, cy = (p[1] / cell) | 0, ok = true;
      for (var gx = cx - 1; gx <= cx + 1 && ok; gx++) {
        for (var gy = cy - 1; gy <= cy + 1; gy++) {
          var b = grid[gx * 4096 + gy];
          if (b) {
            for (var q = 0; q < b.length; q++) {
              var dx = b[q][0] - p[0], dy = b[q][1] - p[1];
              if (dx * dx + dy * dy < d2) { ok = false; break; }
            }
          }
          if (!ok) break;
        }
      }
      if (ok) {
        res.push(p);
        (grid[cx * 4096 + cy] || (grid[cx * 4096 + cy] = [])).push(p);
      }
    }
    return res;
  }

  function sampleShape(n) {
    if (!parts) parts = buildMask();
    var shares = [0.5, 0.34, 0.16], out = [];
    for (var pi = 0; pi < parts.length; pi++) {
      var part = parts[pi], want = Math.max(1, Math.round(n * shares[pi]));
      var idx = []; for (var i = 0; i < part.pts.length; i++) idx.push(i);
      shuffle(idx);
      var dmin = Math.sqrt(part.pts.length * UNIT * UNIT / want) * 0.8, chosen = [];
      for (var tries = 0; tries < 6; tries++) {
        chosen = dart(part.pts, idx, dmin, want);
        if (chosen.length >= want * 0.96) break;
        dmin *= 0.88;
      }
      for (var k = 0; k < chosen.length; k++) {
        var p = chosen[k];
        out.push({
          u: (p[0] - LOGO.x) / LOGO.w, v: (p[1] - LOGO.y) / LOGO.h,
          c: part.color(p[0], p[1])
        });
      }
    }
    return shuffle(out);
  }

  /* ------------------------------------------------------------------ */
  /* Init                                                                */
  /* ------------------------------------------------------------------ */
  function init() {
    var canvas = document.getElementById('canvas');
    var hero = canvas ? (canvas.closest(CFG.heroSelector) || canvas.parentElement) : document.querySelector(CFG.heroSelector);
    if (!hero) return;
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'canvas';
      hero.insertBefore(canvas, hero.firstChild);
    }
    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.setAttribute('aria-hidden', 'true');
    var cs = canvas.style;
    cs.position = 'absolute'; cs.top = '0'; cs.left = '0';
    cs.width = '100%'; cs.height = '100%';
    cs.zIndex = '-1'; cs.pointerEvents = 'none'; cs.display = 'block';
    if (getComputedStyle(hero).position === 'static') hero.style.position = 'relative';
    hero.style.isolation = 'isolate'; // keeps the canvas behind hero content, above hero background

    var lightMode = /white/i.test(location.pathname) || hero.hasAttribute('data-particles-light');
    var mqReduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

    var W = 0, H = 0, dpr = 1, sc = 1, anchorX = 0, anchorY = 0;
    var particles = [], targetCount = 0, isMobile = false;
    var raf = 0, last = 0, running = false, inView = true, pageVisible = !document.hidden;
    var phases = CFG.phases, phaseIdx = 0, phaseT = -CFG.startDelay, form = 0;
    var mouse = { x: -9999, y: -9999, active: false };
    var head = new Int32Array(1), nextArr = new Int32Array(0);

    function adapt(c) {
      if (!lightMode) return c;
      var lum = (c[0] + c[1] + c[2]) / 3;
      if (lum <= 150) return c;
      var t = clamp((lum - 150) / 100, 0, 1);
      return [lerp(c[0], 96, t), lerp(c[1], 178, t), lerp(c[2], 250, t)];
    }

    function freeColor() {
      var r = Math.random();
      return adapt(r < 0.4 ? BLUE_DEEP : r < 0.7 ? BLUE_MID : r < 0.9 ? BLUE_SOFT : CREAM).slice();
    }

    function Particle() {
      this.x = rand(0, W); this.y = rand(0, H);
      this.vx = rand(-0.3, 0.3); this.vy = rand(-0.3, 0.3);
      this.s = rand(0.6, 1.6);                         // personal speed factor
      this.br = Math.random() < 0.1 ? rand(1.3, 1.9) : rand(0.5, 1.1);
      this.ba = rand(0.4, 0.9);
      this.ph = rand(0, 6.283);
      var c = freeColor();
      this.fc = c; this.r = c[0]; this.g = c[1]; this.b = c[2];
      this.tc = c; this.has = false; this.tx = 0; this.ty = 0;
      this.a = this.ba; this.rad = this.br;
    }

    function calcCount() {
      var base = (W * H) / CFG.density;
      var n = isMobile ? (W * H) / 700 : base;
      var weak = (navigator.deviceMemory && navigator.deviceMemory <= 4) ||
                 (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
      if (weak) n *= 0.75;
      return Math.round(clamp(n, isMobile ? 450 : CFG.minParticles, isMobile ? CFG.mobileMaxParticles : CFG.maxParticles));
    }

    function layout() {
      var wide = W >= 992;
      sc = Math.min((H * (wide ? 0.62 : 0.56)) / LOGO.h, (W * (wide ? 0.4 : 0.7)) / LOGO.w);
      anchorX = wide ? W * CFG.anchorXWide : W * 0.5;
      anchorY = H * CFG.anchorY;
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        if (p.has) {
          p.tx = anchorX + (p.u - 0.5) * LOGO.w * sc;
          p.ty = anchorY + (p.v - 0.5) * LOGO.h * sc;
        }
      }
    }

    function assignTargets() {
      var shape = sampleShape(Math.round(particles.length * CFG.formRatio));
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i], t = shape[i];
        if (t) {
          p.has = true; p.u = t.u; p.v = t.v; p.tc = adapt(t.c);
        } else { p.has = false; p.tc = p.fc; }
      }
      layout();
    }

    function resize() {
      var r = hero.getBoundingClientRect();
      var nw = Math.max(1, Math.round(r.width)), nh = Math.max(1, Math.round(r.height));
      var widthChanged = nw !== W;
      // ignore tiny vertical-only changes (mobile address bar) after first setup
      if (W && !widthChanged && Math.abs(nh - H) < 120) return;

      isMobile = nw < 768 || (window.matchMedia && window.matchMedia('(pointer:coarse)').matches);
      dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : CFG.maxDPR);
      var ow = W, oh = H;
      W = nw; H = nh;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (ow && oh) {
        for (var i = 0; i < particles.length; i++) {
          particles[i].x *= W / ow; particles[i].y *= H / oh;
        }
      }
      var count = calcCount();
      var changed = count !== particles.length;
      while (particles.length < count) particles.push(new Particle());
      if (particles.length > count) particles.length = count;
      nextArr = new Int32Array(particles.length);
      if (changed || !targetCount) { targetCount = count; assignTargets(); } else layout();

      if (mqReduce.matches) renderStatic();
    }

    /* -------------------------- simulation -------------------------- */
    function advance(ms) {
      phaseT += ms;
      if (phaseT < 0) { form = 0; return; }
      var ph = phases[phaseIdx];
      if (phaseT >= ph[1]) {
        phaseT -= ph[1];
        phaseIdx = (phaseIdx + 1) % phases.length;
        if (phases[phaseIdx][0] === 'dissolve') {
          for (var i = 0; i < particles.length; i++) {
            particles[i].vx += rand(-3.2, 3.2); particles[i].vy += rand(-3.2, 3.2);
          }
        }
      }
      ph = phases[phaseIdx];
      var k = Math.min(phaseT / ph[1], 1);
      form = ph[0] === 'form' ? smooth(k) : ph[0] === 'hold' ? 1 : ph[0] === 'dissolve' ? 1 - smooth(k) : 0;
    }

    function update(dt, now) {
      var R = isMobile ? CFG.mouseRadius[0] : CFG.mouseRadius[1], R2 = R * R;
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i], f = p.has ? form : 0;

        // organic flow field
        var ang = (Math.sin(p.x * 0.0021 + now * 0.00031 + p.ph) + Math.cos(p.y * 0.0018 - now * 0.00027)) * Math.PI;
        var flow = 0.012 * p.s * (1 - f * 0.92) * dt;
        p.vx += Math.cos(ang) * flow; p.vy += Math.sin(ang) * flow;

        // pull towards logo position (with gentle breathing)
        if (f > 0) {
          var ox = Math.sin(now * 0.0011 + p.ph) * 2.2, oy = Math.cos(now * 0.0009 + p.ph * 1.3) * 2.2;
          var k = 0.017 * f * dt;
          p.vx += (p.tx + ox - p.x) * k; p.vy += (p.ty + oy - p.y) * k;
        }

        // cursor: gentle push away
        if (mouse.active) {
          var dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
          if (d2 < R2 && d2 > 0.01) {
            var d = Math.sqrt(d2), fr = 1 - d / R;
            fr *= fr * 1.5 * dt * (0.6 + f * 0.9);
            p.vx += dx / d * fr; p.vy += dy / d * fr;
          }
        }

        var damp = Math.pow(0.965 - 0.07 * f, dt);
        p.vx *= damp; p.vy *= damp;
        p.x += p.vx * dt; p.y += p.vy * dt;

        if (f < 0.6) { // soft wrap while roaming
          if (p.x < -20) p.x = W + 20; else if (p.x > W + 20) p.x = -20;
          if (p.y < -20) p.y = H + 20; else if (p.y > H + 20) p.y = -20;
        }

        // colour / alpha / size
        var tc = (p.has && form > 0.5) ? p.tc : p.fc, ce = 0.045 * dt;
        p.r += (tc[0] - p.r) * ce; p.g += (tc[1] - p.g) * ce; p.b += (tc[2] - p.b) * ce;
        var tw = Math.sin(now * 0.002 + p.ph);
        p.a = p.ba * (1 + 0.15 * tw);
        p.rad = p.br * (1 + 0.18 * tw);
        if (p.has) {
          p.a = lerp(p.a, 0.97, f * 0.85);
          p.rad = Math.max(p.rad, 0.8) * (1 + 0.3 * f);
        }
      }
    }

    /* ---------------------------- drawing --------------------------- */
    function rgba(r, g, b, a) { return 'rgba(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ',' + a.toFixed(3) + ')'; }

    function draw(f) {
      ctx.clearRect(0, 0, W, H);
      var n = particles.length;
      var linkFree = isMobile ? CFG.linkFree[0] : CFG.linkFree[1];
      var spacing = Math.sqrt(0.42 * (LOGO.w * sc) * (LOGO.h * sc) / Math.max(1, targetCount * CFG.formRatio));
      var ld = lerp(linkFree, Math.max(30, spacing * 2.2), f), ld2 = ld * ld;
      var cols = Math.ceil(W / ld) + 1, rows = Math.ceil(H / ld) + 1;
      if (head.length < cols * rows) head = new Int32Array(cols * rows);
      head.fill(-1, 0, cols * rows);
      var i, p;
      for (i = 0; i < n; i++) {
        p = particles[i];
        var cx = clamp((p.x / ld) | 0, 0, cols - 1), cy = clamp((p.y / ld) | 0, 0, rows - 1);
        p.cell = cy * cols + cx; p.cx = cx; p.cy = cy;
        nextArr[i] = head[p.cell]; head[p.cell] = i;
      }

      var maxLinks = isMobile ? 3 : 4, baseA = lightMode ? 0.5 : 0.32 + 0.3 * f;
      ctx.lineWidth = 0.55; ctx.lineCap = 'round';
      for (i = 0; i < n; i++) {
        p = particles[i];
        var links = 0;
        for (var gy = Math.max(0, p.cy - 1); gy <= Math.min(rows - 1, p.cy + 1) && links < maxLinks; gy++) {
          for (var gx = Math.max(0, p.cx - 1); gx <= Math.min(cols - 1, p.cx + 1) && links < maxLinks; gx++) {
            for (var j = head[gy * cols + gx]; j !== -1; j = nextArr[j]) {
              if (j <= i) continue;
              var q = particles[j], dx = p.x - q.x, dy = p.y - q.y, d2 = dx * dx + dy * dy;
              if (d2 < ld2) {
                var al = (1 - Math.sqrt(d2) / ld) * baseA * Math.min(p.a, q.a);
                if (al > 0.01) {
                  ctx.strokeStyle = rgba((p.r + q.r) / 2, (p.g + q.g) / 2, (p.b + q.b) / 2, al);
                  ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
                  if (++links >= maxLinks) break;
                }
              }
            }
          }
        }
      }

      // cursor network
      if (mouse.active) {
        var R = (isMobile ? CFG.mouseRadius[0] : CFG.mouseRadius[1]) * 1.25;
        for (i = 0; i < n; i++) {
          p = particles[i];
          var mx = p.x - mouse.x, my = p.y - mouse.y, md = Math.sqrt(mx * mx + my * my);
          if (md < R) {
            ctx.strokeStyle = rgba(p.r, p.g, p.b, (1 - md / R) * 0.28);
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
          }
        }
      }

      // particles
      for (i = 0; i < n; i++) {
        p = particles[i];
        if (p.rad > 1.5) {
          ctx.fillStyle = rgba(p.r, p.g, p.b, p.a * 0.12);
          ctx.beginPath(); ctx.arc(p.x, p.y, p.rad * 3.6, 0, 6.2832); ctx.fill();
        }
        ctx.fillStyle = rgba(p.r, p.g, p.b, p.a);
        ctx.beginPath(); ctx.arc(p.x, p.y, p.rad, 0, 6.2832); ctx.fill();
      }
    }

    function renderStatic() { // prefers-reduced-motion: one calm frame of the logo
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        if (p.has) { p.x = p.tx; p.y = p.ty; p.r = p.tc[0]; p.g = p.tc[1]; p.b = p.tc[2]; }
        p.a = p.ba; p.rad = p.br;
      }
      draw(1);
    }

    /* ----------------------------- loop ----------------------------- */
    function tick(now) {
      raf = requestAnimationFrame(tick);
      var ms = Math.min(now - last, 50); last = now;
      advance(ms);
      update(ms / 16.667, now);
      draw(form);
    }
    function start() {
      if (raf || mqReduce.matches) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }
    function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }
    function sync() { (inView && pageVisible && !mqReduce.matches) ? start() : stop(); }

    /* --------------------------- listeners -------------------------- */
    var rTimer = 0;
    function onResize() { clearTimeout(rTimer); rTimer = setTimeout(resize, 120); }
    function onMove(e) {
      var r = canvas.getBoundingClientRect();
      var x = e.clientX - r.left, y = e.clientY - r.top;
      mouse.active = x >= 0 && y >= 0 && x <= r.width && y <= r.height;
      mouse.x = x; mouse.y = y;
    }
    function onLeave() { mouse.active = false; }
    function onVis() { pageVisible = !document.hidden; sync(); }
    function onMotion() {
      if (mqReduce.matches) { stop(); renderStatic(); } else { sync(); }
    }

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerleave', onLeave, { passive: true });
    document.addEventListener('pointerleave', onLeave, { passive: true });
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('orientationchange', onResize);
    if (mqReduce.addEventListener) mqReduce.addEventListener('change', onMotion);

    var ro = null, io = null;
    if ('ResizeObserver' in window) { ro = new ResizeObserver(onResize); ro.observe(hero); }
    else window.addEventListener('resize', onResize);
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(function (en) { inView = en[0].isIntersecting; sync(); }, { threshold: 0 });
      io.observe(hero);
    }

    resize();
    sync();

    window.__mbLogoParticles = {
      destroy: function () {
        stop();
        if (ro) ro.disconnect(); if (io) io.disconnect();
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerleave', onLeave);
        document.removeEventListener('pointerleave', onLeave);
        document.removeEventListener('visibilitychange', onVis);
        window.removeEventListener('orientationchange', onResize);
        window.removeEventListener('resize', onResize);
        if (mqReduce.removeEventListener) mqReduce.removeEventListener('change', onMotion);
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      }
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
