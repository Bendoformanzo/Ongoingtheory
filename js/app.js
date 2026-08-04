/* ==========================================================================
   ONGOING THEORY — scene engine
   Single image in, living room out.

     1. Stage      sizes the image to cover the viewport with room to move
     2. Parallax   mouse-led camera drift plus a slow ambient breath
     3. Twinkle    reads the real city lights out of the image and animates them
     4. Lamps      the practical lights in the room, wandering and flickering
     5. Hotspots   hover / tap cards, built from js/content.js
     6. Tuning      press D to reposition hotspots by clicking
   ========================================================================== */

(function () {
  'use strict';

  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ?touch=1 forces the phone layout on a desktop browser, so the drag-along
     version can be checked without a device. */
  const TOUCH = /[?&]touch=1/.test(location.search) ||
                window.matchMedia('(hover: none)').matches;

  const PARALLAX   = false; // set true to let the room drift with the pointer
  const OVERSCAN   = PARALLAX ? 1.10 : 1.0;
  const DRIFT_ROOM = 24;    // px the room moves with the pointer

  const el = {
    body:     document.body,
    viewport: document.getElementById('viewport'),
    parallax: document.getElementById('parallax'),
    stage:    document.getElementById('stage'),
    scene:    document.getElementById('scene'),
    twinkle:  document.getElementById('twinkle'),
    hotspots: document.getElementById('hotspots'),
    hint:     document.getElementById('hint'),
    missing:  document.getElementById('missing')
  };

  const state = {
    imgW: 16, imgH: 9,
    pointer:  { x: 0, y: 0 },   // -1 .. 1
    cursor:   { x: 0, y: 0, seen: false },   // raw px, for hotspot proximity
    panMode:  false,            // room overhangs the window — drag to travel
    dragged:  false,
    userPanned: false,          // once true, stop imposing the opening view
    eased:    { x: 0, y: 0 },
    offset:   { x: 0, y: 0 },   // px the room is currently shifted
    slackX:   0,                // px the image overhangs the window each side
    slackY:   0,
    openId:   null,
    tuning:   false,
    t:        0
  };

  /* ======================================================================
     1. Stage
     ====================================================================== */

  /* The room is much wider than it is tall, and the things worth hovering —
     the wall art, the sofa, the credenza — live at the far left and right.
     So we fit width first and only crop the ceiling and carpet. If the window
     is so tall that width-first would leave a gap, we cover instead; and if
     covering would eat more than a sixth of the room, we letterbox rather than
     hide half the hotspots. */
  function layoutStage() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const aspect = state.imgW / state.imgH;

    let w, h;

    if (TOUCH) {
      /* On a phone the room becomes a tall slice of itself: fill the height,
         let it run off both sides, and drag to move along it. Letterboxing a
         16:9 room into a portrait screen leaves a postage stamp — this keeps
         the image full-screen and makes the width something you travel
         through. */
      h = vh;
      w = h * aspect;
    } else {
      w = vw * OVERSCAN;
      h = w / aspect;

      // never letterbox: if width-first leaves a gap, fill the height instead
      // and let the room run off the sides. Panning (below) makes the rest
      // reachable, so nothing is lost by cropping.
      if (h < vh) {
        h = vh * OVERSCAN;
        w = h * aspect;
      }
    }

    state.slackX = Math.max(0, (w - vw) / 2);
    state.slackY = Math.max(0, (h - vh) / 2);

    /* Whenever the room overhangs the window by a meaningful amount, dragging
       becomes navigation rather than an effect — on a phone, and equally on a
       desktop window too narrow to show the whole room. */
    state.panMode = state.slackX > 40;
    el.body.classList.toggle('is-pan', state.panMode);

    /* Open on the desk rather than the middle of the room. Solve for the
       pointer value that puts SITE.startView at the centre of the window.
       Only until the viewer takes over — after that, leave their view alone. */
    if (state.panMode && !state.userPanned) {
      const want = (typeof SITE !== 'undefined' && SITE.startView != null) ? SITE.startView : 0.5;
      const offset = vw / 2 + state.slackX - want * w;
      state.pointer.x = clamp(-offset / state.slackX, -1, 1);
      state.eased.x = state.pointer.x;
    }
    state.stageW = w;
    state.stageH = h;
    state.originX = (vw - w) / 2;   // stage's left edge at rest
    state.originY = (vh - h) / 2;

    el.stage.style.width  = w + 'px';
    el.stage.style.height = h + 'px';

    sizeCanvas(el.twinkle, w, h);
  }

  function sizeCanvas(canvas, cssW, cssH) {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width  = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width  = cssW + 'px';
    canvas.style.height = cssH + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    canvas._css = { w: cssW, h: cssH };
  }

  /* ======================================================================
     2. Parallax
     ====================================================================== */

  function bindPointer() {
    if (REDUCED) return;

    window.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      state.cursor.x = e.clientX;
      state.cursor.y = e.clientY;
      state.cursor.seen = true;
      // in panMode the room is steered by dragging, so cursor position must
      // not also drive it — otherwise the two fight and the drag is ignored
      if (state.panMode) return;
      state.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      state.pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
      el.parallax.classList.add('is-live');
    }, { passive: true });

    window.addEventListener('pointerleave', function () {
      state.cursor.seen = false;
      if (state.panMode) return;   // keep where the viewer dragged it to
      state.pointer.x = 0;
      state.pointer.y = 0;
    }, { passive: true });

    bindDrag();
  }

  /* Drag to travel along the room — the same gesture with a finger or a
     mouse, so a narrow desktop window works like a phone. Only live while
     `panMode` is on, i.e. when the room actually overhangs the window. */
  function bindDrag() {
    let start = null;

    el.viewport.addEventListener('pointerdown', function (e) {
      if (!state.panMode) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      start = {
        x: e.clientX, y: e.clientY,
        px: state.pointer.x, py: state.pointer.y,
        moved: 0, id: e.pointerId
      };
      state.dragged = false;
    });

    el.viewport.addEventListener('pointermove', function (e) {
      if (!start || start.id !== e.pointerId || state.openId) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      start.moved = Math.max(start.moved, Math.hypot(dx, dy));
      if (start.moved < 4) return;          // let small movements stay as clicks

      el.body.classList.add('is-dragging');
      state.userPanned = true;

      // one screen-width of drag covers the whole slack, so the far wall is
      // always about a swipe away however wide the room is
      state.pointer.x = clamp(start.px - (dx / window.innerWidth) * 2.2, -1, 1);
      if (TOUCH) state.pointer.y = clamp(start.py - (dy / window.innerHeight) * 2.2, -1, 1);
    });

    function end() {
      state.dragged = start ? start.moved > 6 : false;
      start = null;
      el.body.classList.remove('is-dragging');
    }
    el.viewport.addEventListener('pointerup', end);
    el.viewport.addEventListener('pointercancel', end);

    // clicking the room, rather than a dot, puts the sheet away
    el.viewport.addEventListener('click', function (e) {
      if (state.dragged) return;
      if (e.target.closest('.hotspot') || e.target.closest('.pan')) return;
      closeAll();
    });

    bindPanButtons();
  }

  /* Tap-to-travel. A step is about three quarters of a screen, so crossing the
     room takes a few taps rather than one jump. */
  function bindPanButtons() {
    const left  = document.getElementById('pan-left');
    const right = document.getElementById('pan-right');
    if (!left || !right) return;

    function step(dir) {
      if (!state.panMode) return;
      const per = clamp((window.innerWidth * 0.75) / state.slackX, 0.12, 1);
      state.pointer.x = clamp(state.pointer.x + dir * per, -1, 1);
      state.userPanned = true;
      hideHint();
    }

    [[left, -1], [right, 1]].forEach(function (pair) {
      // swallow the pointerdown so it never starts a drag
      pair[0].addEventListener('pointerdown', function (e) { e.stopPropagation(); });
      pair[0].addEventListener('click', function (e) {
        e.stopPropagation();
        step(pair[1]);
      });
    });

    state.panButtons = { left: left, right: right };
  }

  /* Grey out whichever arrow has nowhere left to go. */
  function updatePanButtons() {
    const b = state.panButtons;
    if (!b || !state.panMode) return;
    const held = !!state.openId;          // room is held still behind a sheet
    const atLeft  = held || state.eased.x <= -0.995;
    const atRight = held || state.eased.x >=  0.995;
    if (b.left.disabled !== atLeft)   b.left.disabled = atLeft;
    if (b.right.disabled !== atRight) b.right.disabled = atRight;
  }

  function driveParallax(dt) {
    /* Panning on touch is how you get around the room, not an effect — so it
       survives PARALLAX being off. Never travel further than the image
       overhangs the window, or an edge shows. */
    const limitX = state.panMode ? state.slackX : (PARALLAX ? Math.min(DRIFT_ROOM, state.slackX) : 0);
    const limitY = TOUCH ? state.slackY : (PARALLAX ? Math.min(DRIFT_ROOM * 0.6, state.slackY) : 0);

    // a card is pinned to the screen on touch, so hold the room still under it
    if (TOUCH && state.openId) return;

    const k = 1 - Math.pow(0.0016, dt);
    state.eased.x += (clamp(state.pointer.x, -1, 1) - state.eased.x) * k;
    state.eased.y += (clamp(state.pointer.y, -1, 1) - state.eased.y) * k;

    // a slow figure-eight so the room is never completely still — but not while
    // someone is steering it themselves
    const breathX = state.panMode ? 0 : Math.sin(state.t * 0.16) * Math.min(limitX, 14);
    const breathY = state.panMode ? 0 : Math.sin(state.t * 0.11 + 1.3) * Math.min(limitY, 9);

    const x = clamp(-state.eased.x * limitX + breathX, -state.slackX, state.slackX);
    const y = clamp(-state.eased.y * limitY + breathY, -state.slackY, state.slackY);

    state.offset.x = x;
    state.offset.y = y;

    el.parallax.style.transform = 'translate3d(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px,0)';
  }

  /* ======================================================================
     3. Twinkle — the city lights, read out of the image itself
     ====================================================================== */

  const twinkle = {
    points: [],
    sprites: {},
    ctx: null
  };

  const TINTS = [
    { key: 'warm',  rgb: [255, 214, 158] },
    { key: 'amber', rgb: [255, 176,  92] },
    { key: 'white', rgb: [232, 240, 255] },
    { key: 'cool',  rgb: [150, 196, 255] },
    { key: 'red',   rgb: [255,  96,  84] },
    { key: 'green', rgb: [140, 255, 190] }
  ];

  function makeSprites() {
    TINTS.forEach(function (tint) {
      const S = 64;
      const c = document.createElement('canvas');
      c.width = c.height = S;
      const g = c.getContext('2d');
      const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
      const rgb = tint.rgb.join(',');
      grad.addColorStop(0.00, 'rgba(255,255,255,0.95)');
      grad.addColorStop(0.16, 'rgba(' + rgb + ',0.80)');
      grad.addColorStop(0.42, 'rgba(' + rgb + ',0.22)');
      grad.addColorStop(1.00, 'rgba(' + rgb + ',0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, S, S);
      twinkle.sprites[tint.key] = c;
    });
  }

  function nearestTint(r, g, b) {
    let best = 'white', bestD = Infinity;
    for (let i = 0; i < TINTS.length; i++) {
      const t = TINTS[i].rgb;
      const d = (r - t[0]) * (r - t[0]) + (g - t[1]) * (g - t[1]) + (b - t[2]) * (b - t[2]);
      if (d < bestD) { bestD = d; best = TINTS[i].key; }
    }
    return best;
  }

  /* Things in the room that are bright enough to be mistaken for a window —
     the desk lamp, mostly. Coordinates are 0..1 across the image. */
  function excluded(nx, ny) {
    if (typeof LIGHT_EXCLUDE === 'undefined') return false;
    for (let i = 0; i < LIGHT_EXCLUDE.length; i++) {
      const e = LIGHT_EXCLUDE[i];
      if (nx * 100 >= e.x && nx * 100 <= e.x + e.w &&
          ny * 100 >= e.y && ny * 100 <= e.y + e.h) return true;
    }
    return false;
  }

  /* Scan the image for local brightness maxima inside LIGHT_REGIONS. */
  function readLightsFromImage(img) {
    // 1000px wide, not 560 — at the lower resolution individual windows blur
    // into the buildings and stop being distinguishable from bright cloud
    const SW = 1000;
    const SH = Math.max(1, Math.round(SW * img.naturalHeight / img.naturalWidth));

    const c = document.createElement('canvas');
    c.width = SW; c.height = SH;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, SW, SH);

    let data;
    try {
      data = g.getImageData(0, 0, SW, SH).data;
    } catch (err) {
      // file:// or a cross-origin image taints the canvas — fall back
      return null;
    }

    const luma = new Float32Array(SW * SH);
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      luma[p] = data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722;
    }

    const found = [];

    LIGHT_REGIONS.forEach(function (region) {
      const x0 = Math.max(1, Math.floor(region.x / 100 * SW));
      const y0 = Math.max(1, Math.floor(region.y / 100 * SH));
      const x1 = Math.min(SW - 2, Math.ceil((region.x + region.w) / 100 * SW));
      const y1 = Math.min(SH - 2, Math.ceil((region.y + region.h) / 100 * SH));
      if (x1 <= x0 || y1 <= y0) return;

      // adaptive threshold for this region
      let sum = 0, sumSq = 0, n = 0;
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const v = luma[y * SW + x];
          sum += v; sumSq += v * v; n++;
        }
      }
      const mean = sum / n;
      const std  = Math.sqrt(Math.max(0, sumSq / n - mean * mean));
      const thresh = Math.max(92, mean + std * 1.35);

      // occupancy grid keeps the lights from clumping — scaled with SW so the
      // spacing on the actual image stays the same
      const CELL = 9;
      const gw = Math.ceil(SW / CELL);
      const taken = new Uint8Array(gw * Math.ceil(SH / CELL));

      /* A lit window is small and sits against something much darker. A bright
         patch of cloud, or a lampshade, is broad and smooth — it still has
         local maxima, so brightness alone will happily pick it up. The test
         that separates them is local contrast: how much brighter the point is
         than a ring a few pixels out. Cloud fails it; a window passes easily. */
      const RING = [[-4, 0], [4, 0], [0, -4], [0, 4], [-3, -3], [3, -3], [-3, 3], [3, 3]];
      const CONTRAST = 16;

      const candidates = [];
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const i = y * SW + x;
          const v = luma[i];
          if (v < thresh) continue;
          if (v < luma[i - 1] || v < luma[i + 1] || v < luma[i - SW] || v < luma[i + SW]) continue;
          if (v < luma[i - SW - 1] || v < luma[i - SW + 1] || v < luma[i + SW - 1] || v < luma[i + SW + 1]) continue;

          let ring = 0, rn = 0;
          for (let k = 0; k < RING.length; k++) {
            const xx = x + RING[k][0], yy = y + RING[k][1];
            if (xx < 0 || yy < 0 || xx >= SW || yy >= SH) continue;
            ring += luma[yy * SW + xx];
            rn++;
          }
          if (!rn || v - ring / rn < CONTRAST) continue;
          if (excluded(x / SW, y / SH)) continue;

          candidates.push({ x: x, y: y, v: v, i: i });
        }
      }

      candidates.sort(function (a, b) { return b.v - a.v; });

      for (let k = 0; k < candidates.length && found.length < 240; k++) {
        const p = candidates[k];
        const cell = Math.floor(p.y / CELL) * gw + Math.floor(p.x / CELL);
        if (taken[cell]) continue;
        taken[cell] = 1;

        const d = p.i * 4;
        const r = data[d], gg = data[d + 1], b = data[d + 2];
        const isBeacon = r > gg * 1.45 && r > b * 1.6 && r > 110;

        found.push(makePoint(
          p.x / SW, p.y / SH,
          nearestTint(r, gg, b),
          Math.min(1, (p.v - thresh) / 110 + 0.35),
          isBeacon,
          found.length
        ));
      }
    });

    return found.length ? found : null;
  }

  /* If the image can't be read, scatter plausible lights across the glazing. */
  function inventLights() {
    const pts = [];
    let seed = 20260803;
    const rnd = function () {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    LIGHT_REGIONS.forEach(function (region) {
      for (let i = 0; i < 170; i++) {
        // bias toward the middle band where the skyline sits
        const ry = Math.pow(rnd(), 0.75);
        const nx = (region.x + rnd() * region.w) / 100;
        const ny = (region.y + ry * region.h) / 100;
        const tint = rnd() < 0.62 ? 'warm' : rnd() < 0.6 ? 'white' : rnd() < 0.5 ? 'cool' : 'amber';
        pts.push(makePoint(nx, ny, tint, 0.35 + rnd() * 0.6, rnd() < 0.04, i));
      }
    });
    return pts;
  }

  function makePoint(nx, ny, tint, strength, isBeacon, i) {
    return {
      x: nx,
      y: ny,
      tint: isBeacon ? 'red' : tint,
      base: 0.32 + strength * 0.74,
      size: 6 + strength * 15,
      phase: (i * 2.399963) % (Math.PI * 2),
      speed: 0.34 + ((i * 37) % 100) / 100 * 1.05,
      // enough swing to breathe. Pushed to 0.85 once and the skyline crawled.
      amp: 0.20 + ((i * 61) % 100) / 100 * 0.34,
      beacon: isBeacon,
      beaconPhase: ((i * 13) % 100) / 100 * Math.PI * 2,
      // roughly one window in twelve has a dodgy light
      flicker: !isBeacon && (i * 7) % 100 < 8
    };
  }

  function drawTwinkle() {
    const ctx = twinkle.ctx;
    if (!ctx) return;
    const W = el.twinkle._css.w;
    const H = el.twinkle._css.h;

    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';

    const scale = W / 1600;   // keep the glow proportional at any window size
    const t = state.t;

    for (let i = 0; i < twinkle.points.length; i++) {
      const p = twinkle.points[i];
      let a;

      if (p.beacon) {
        // aircraft warning lights: a slow, hard on/off
        const cycle = (Math.sin(t * 1.5 + p.beaconPhase) + 1) / 2;
        a = p.base * (cycle > 0.62 ? 1.25 : 0.06);
      } else {
        // Three scales at once: a fast shimmer, a slow drift, and — for the
        // handful of points marked as flickery — an irregular stutter from two
        // detuned fast waves beating against each other. That beat is what
        // reads as a light with something wrong with it, rather than a sine.
        const flicker = 0.5 + 0.5 * Math.sin(t * p.speed + p.phase);
        const slow    = 0.5 + 0.5 * Math.sin(t * 0.21 + p.phase * 0.6);
        a = p.base * ((1 - p.amp) + p.amp * flicker) * (0.78 + 0.22 * slow);

        if (p.flicker) {
          const beat = Math.sin(t * 3.1 + p.phase) * Math.sin(t * 5.3 + p.phase * 2.1);
          if (beat > 0.86) a *= 0.62;   // an occasional dip, not a strobe
        }
      }

      if (a <= 0.012) continue;

      const s = p.size * scale * (0.85 + a * 0.5);
      ctx.globalAlpha = Math.min(1, a);
      ctx.drawImage(twinkle.sprites[p.tint], p.x * W - s / 2, p.y * H - s / 2, s, s);
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ======================================================================
     4. The lamps in the room

     Driven here rather than by CSS keyframes so they can actually flicker.
     A keyframe loop can only breathe smoothly; a filament settles, wanders,
     and every so often stutters. Each lamp gets a slow wander plus rare
     flicker bursts on its own schedule.
     ====================================================================== */

  /* Per-lamp character. A desk lamp and a corner lamp sit close to the eye and
     can afford to breathe; the linear fixture washing the wall is an LED strip
     and should be almost dead still. `depth` is the slow wander, `quiver` the
     continuous fine flicker, `every` the seconds between deeper stutters. */
  const LAMP_TUNING = {
    // the desk lamp is closest to the eye — it reads as overdone long before
    // the others do, so it stays gentle
    'glow--desk':   { depth: 0.10, speed: 0.17, quiver: 0.050, every: [4, 9] },
    'glow--corner': { depth: 0.20, speed: 0.16, quiver: 0.095, every: [4, 9] },
    'glow--floor':  { depth: 0.16, speed: 0.13, quiver: 0.070, every: [5, 12] },
    'glow--wash':   { depth: 0.05, speed: 0.08, quiver: 0.020, every: [14, 28] }
  };
  const LAMP_DEFAULT = { depth: 0.10, speed: 0.12, quiver: 0.04, every: [8, 18] };

  const lamps = [];

  function seedLamps() {
    const nodes = el.stage.querySelectorAll('.glow');
    const rnd = seededRandom('lamps');
    for (let i = 0; i < nodes.length; i++) {
      const key = [].find.call(nodes[i].classList, function (c) { return c in LAMP_TUNING; });
      const tune = LAMP_TUNING[key] || LAMP_DEFAULT;
      lamps.push({
        node:  nodes[i],
        phase: rnd() * Math.PI * 2,
        speed: tune.speed,
        depth: tune.depth,
        quiver: tune.quiver,
        every: tune.every,
        wait:  tune.every[0] + rnd() * (tune.every[1] - tune.every[0]),
        burst: 0,
        rnd:   rnd
      });
    }
  }

  function driveLamps(dt) {
    const t = state.t;

    for (let i = 0; i < lamps.length; i++) {
      const l = lamps[i];

      // the slow breath — where the lamp sits over seconds
      const wander = 1
        + l.depth * Math.sin(t * l.speed + l.phase)
        + l.depth * 0.45 * Math.sin(t * l.speed * 2.7 + l.phase * 1.9);

      // the fine flicker — two detuned waves around 0.8 and 1.4Hz, so it never
      // settles into an obvious rhythm. This is the bit that reads as a live
      // filament rather than a CSS animation.
      const quiver = 1 + l.quiver * (
        0.6 * Math.sin(t * 5.1 + l.phase * 3.0) +
        0.4 * Math.sin(t * 8.7 + l.phase * 1.3)
      );

      // and, occasionally, a deeper dip
      l.wait -= dt;
      if (l.wait <= 0) {
        l.burst = 0.14 + l.rnd() * 0.2;
        l.wait  = l.every[0] + l.rnd() * (l.every[1] - l.every[0]);
      }

      let stutter = 1;
      if (l.burst > 0) {
        l.burst -= dt;
        const k = Math.max(0, Math.min(1, l.burst * 5));
        stutter = 1 - 0.2 * k * (0.5 + 0.5 * Math.sin(t * 23 + l.phase * 7));
      }

      const level = wander * quiver * stutter;

      // the pool of light swells a little as it brightens, which is what makes
      // it read as a lamp rather than an opacity change. Follows the slow
      // wander only — tying it to the quiver would make the glow jitter.
      const size = 1 + (wander - 1) * 0.35;

      l.node.style.filter = 'brightness(' + level.toFixed(3) + ')';
      l.node.style.transform = 'translate(-50%, -50%) scale(' + size.toFixed(4) + ')';
    }
  }

  /* ======================================================================
     5. Hotspots
     ====================================================================== */

  const ARROW = '<svg viewBox="0 0 12 12" fill="none" aria-hidden="true">' +
    '<path d="M2.5 9.5L9.5 2.5M9.5 2.5H4M9.5 2.5V8" stroke="currentColor" ' +
    'stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function buildHotspots() {
    HOTSPOTS.forEach(function (h) {
      const node = document.createElement('div');
      node.className = 'hotspot';
      node.dataset.id = h.id;
      node.dataset.cx = h.x;
      node.dataset.cy = h.y;
      node.style.left   = h.x + '%';
      node.style.top    = h.y + '%';
      node.style.width  = h.w + '%';
      node.style.height = h.h + '%';

      const align  = h.align  === 'auto' || !h.align  ? (h.x > 55 ? 'left' : 'right') : h.align;
      const vAlign = h.vAlign === 'auto' || !h.vAlign ? (h.y > 58 ? 'up' : 'down')    : h.vAlign;
      const cardId = 'card-' + h.id;

      /* Long pieces get a "Read more" that opens the reading window, and their
         links move in there with the text. Short ones carry their links on
         the card itself. */
      const actions = h.long
        ? '<button class="card__cta" type="button" data-reader="' + esc(h.id) + '">' +
            '<span class="card__cta-label">Read more</span>' + ARROW +
          '</button>'
        : (h.links || []).map(function (l) {
            // a link with no href isn't a link — it's a note. Renders as a
            // muted chip with no arrow and nothing to click.
            return l.href
              ? '<a class="card__cta" href="' + esc(l.href) + '">' +
                  '<span class="card__cta-label">' + esc(l.label) + '</span>' + ARROW +
                '</a>'
              : '<span class="card__cta card__cta--soon">' +
                  '<span class="card__cta-label">' + esc(l.label) + '</span>' +
                '</span>';
          }).join('');

      node.innerHTML =
        '<button class="hotspot__hit" type="button" aria-expanded="false" ' +
                'aria-controls="' + cardId + '" aria-label="' +
                esc(h.title || h.body.split('.')[0]) + '">' +
          '<span class="hotspot__pulse"></span>' +
          '<span class="hotspot__marker"></span>' +
        '</button>' +
        '<div class="card" id="' + cardId + '" data-align="' + align + '" data-valign="' + vAlign + '">' +
          // a card can stand without a heading — see the ashtray
          (h.title ? '<h2 class="card__title">' + esc(h.title) + '</h2>' : '') +
          // body may be a string or an array of lines
          [].concat(h.body).map(function (p) {
            return '<p class="card__body">' + esc(p) + '</p>';
          }).join('') +
          (actions ? '<div class="card__actions">' + actions + '</div>' : '') +
        '</div>';

      el.hotspots.appendChild(node);
      wireHotspot(node, h);
    });
  }

  function wireHotspot(node, data) {
    const hit = node.querySelector('.hotspot__hit');
    const type = typewriter(node);
    node._type = type;          // so closeAll can stop a half-typed sheet
    node._open = open;          // so the console handle drives the real path
    let openTimer = null;
    let closeTimer = null;

    function open() {
      clearTimeout(closeTimer);
      if (state.tuning) return;
      if (state.openId === data.id) return;
      closeAll();
      state.openId = data.id;
      node.classList.add('is-open');
      el.body.classList.add('is-card-open');
      hit.setAttribute('aria-expanded', 'true');
      keepCardOnScreen(node);
      type.play();
      hideHint();
    }

    function close() {
      node.classList.remove('is-open');
      el.body.classList.remove('is-card-open');
      hit.setAttribute('aria-expanded', 'false');
      type.reset();
      unpinCard(node);
      if (state.openId === data.id) state.openId = null;
    }

    // clicking the sheet finishes the typing rather than waiting it out
    node.querySelector('.card').addEventListener('click', function (e) {
      if (e.target.closest('[data-reader]')) { openReader(data); return; }
      if (!e.target.closest('.card__cta')) type.finish();
    });

    if (!TOUCH) {
      // hovering the card itself keeps it open, so links stay reachable
      node.addEventListener('pointerenter', function () {
        clearTimeout(closeTimer);
        openTimer = setTimeout(open, 55);
      });
      node.addEventListener('pointerleave', function () {
        clearTimeout(openTimer);
        closeTimer = setTimeout(close, 180);
      });
    }

    hit.addEventListener('focus', open);
    node.addEventListener('focusout', function (e) {
      if (node.contains(e.relatedTarget)) return;
      closeTimer = setTimeout(close, 160);
    });

    hit.addEventListener('click', function () {
      if (state.tuning) return;
      if (state.dragged) return;    // that tap was the end of a drag
      if (data.action === 'toggle-lamp') el.body.classList.toggle('lights-on');
      if (node.classList.contains('is-open') && TOUCH) close();
      else open();
    });
  }

  /* The room shows no markers at rest. Each dot fades up as the cursor comes
     within reach of it, so the page reads as a photograph until you go
     looking. Runs every frame off the cached hotspot centres. */
  const NEAR_FULL = 110;   // px — dot fully lit
  const NEAR_EDGE = 300;   // px — dot starts to appear

  function driveProximity() {
    const spots = state.spots;
    if (!spots) return;

    // no cursor (touch, or pointer has left the window): show everything
    const idle = TOUCH || !state.cursor.seen;

    for (let i = 0; i < spots.length; i++) {
      const s = spots[i];
      let a;

      if (s.node.classList.contains('is-open')) {
        a = 1;
      } else if (idle) {
        a = TOUCH ? 1 : 0;
      } else {
        const cx = state.originX + s.cx + state.offset.x;
        const cy = state.originY + s.cy + state.offset.y;
        const d  = Math.hypot(state.cursor.x - cx, state.cursor.y - cy);
        a = clamp((NEAR_EDGE - d) / (NEAR_EDGE - NEAR_FULL), 0, 1);
        a = a * a * (3 - 2 * a);   // smoothstep, so it swells rather than ramps
      }

      if (Math.abs(a - s.near) < 0.004) continue;
      s.near = a;
      s.node.style.setProperty('--near', a.toFixed(3));
      s.node.classList.toggle('is-near', a > 0.05);
    }
  }

  /* Each hotspot's centre in stage pixels. Derived from the authored
     percentages rather than measured — the stage carries an entrance scale and
     a per-frame translate, and reading rects would bake those in. */
  function measureHotspots() {
    state.spots = [].map.call(el.hotspots.children, function (node) {
      return {
        node: node,
        cx: parseFloat(node.dataset.cx) / 100 * state.stageW,
        cy: parseFloat(node.dataset.cy) / 100 * state.stageH,
        near: -1
      };
    });
  }

  /* ----------------------------------------------------------------------
     Ink

     A monospace font alone still reads as a computer: every glyph lands dead
     on the baseline at identical weight. A typewriter can't do that — each
     type bar strikes a hair high or low and slightly rotated, and the ribbon
     inks unevenly, going heavy after a rest and dry after a run.

     So each character gets its own offset, rotation and ink density. The
     values come from a seeded generator keyed on the card, so a given letter
     always lands the same way — re-randomising on every hover would read as a
     glitch rather than as a page that was typed once.
     ---------------------------------------------------------------------- */

  function seededRandom(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return function () {
      h += 0x6d2b79f5;
      let t = h;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Rebuild an element as per-character spans, wrapped word by word so the
     text still wraps normally. Returns the character spans in order. */
  function inkify(node, seed, opts) {
    opts = opts || {};
    const text = node.textContent;
    const rnd = seededRandom(seed);
    const chars = [];
    const phase = rnd() * Math.PI * 2;   // where this sheet sits in the ribbon's life

    node.textContent = '';

    /* A screen reader walking 150 inline-block spans may well announce the
       letters one at a time. So the real sentence goes in once, offscreen, and
       the inked version is hidden from assistive tech entirely. */
    const readable = document.createElement('span');
    readable.className = 'sr-only';
    readable.textContent = text;
    node.appendChild(readable);

    const ink = document.createElement('span');
    ink.className = 'ink';
    ink.setAttribute('aria-hidden', 'true');
    node.appendChild(ink);

    text.split(' ').forEach(function (word, wi) {
      if (wi > 0) ink.appendChild(document.createTextNode(' '));
      if (!word) return;

      const wrap = document.createElement('span');
      wrap.className = 'wd';

      for (let i = 0; i < word.length; i++) {
        const ch = document.createElement('span');
        ch.className = 'ch';
        ch.textContent = word[i];

        /* Barely any. An early version wobbled the baseline by up to 0.6px and
           rotated 1.2deg, which at 12px type reads as a novelty font rather
           than as a machine. The alignment of a real typewriter is off by a
           hair, not visibly crooked — this is that hair. */
        ch.style.setProperty('--dx',  (rnd() * 0.24 - 0.12).toFixed(2) + 'px');
        ch.style.setProperty('--dy',  (rnd() * 0.34 - 0.17).toFixed(2) + 'px');
        ch.style.setProperty('--rot', (rnd() * 0.5 - 0.25).toFixed(2) + 'deg');

        /* Ink is two things layered: a slow wave, because a ribbon dries out
           over a run of characters and then recovers, and a small per-strike
           jitter on top. The wave is what stops it reading as random noise —
           you get passages that are faint and passages that are dark, the way
           a real page does. */
        const n = chars.length;
        const ribbon = 0.94
          + 0.06 * Math.sin(n * 0.085 + phase)
          + 0.025 * Math.sin(n * 0.031 + phase * 1.7);

        const roll = rnd();
        let ink = clamp(ribbon * (0.97 + rnd() * 0.06), 0.78, 1);

        if (roll < 0.06)      ink = Math.min(1, ink + 0.08);     // bar hit hard
        else if (roll > 0.94) ink = Math.max(0.74, ink - 0.09);  // ribbon skipped

        // more ink spreads further into the fibre — this is the only thing that
        // softens a glyph. The stroke width never changes.
        const bleed = (0.12 + ink * 0.34).toFixed(2);

        // headings only. No random double-strikes in the body: at this size
        // they just look like dirt on the screen.
        if (opts.overstrike) {
          ch.classList.add('ch--over');
          ch.dataset.c = word[i];
        }

        ch.style.setProperty('--ink', ink.toFixed(2));
        ch.style.setProperty('--bleed', bleed + 'px');

        wrap.appendChild(ch);
        chars.push(ch);
      }
      ink.appendChild(wrap);
    });

    return chars;
  }

  /* Types the title then the body onto the sheet. Characters are laid out
     hidden rather than appended, so the paper never reflows mid-sentence and
     the height is right from the first frame. */
  function typewriter(node) {
    const title   = node.querySelector('.card__title');
    const bodies  = node.querySelectorAll('.card__body');
    const actions = node.querySelector('.card__actions');
    const seed    = node.dataset.id || 'ot';

    /* Button labels came off the same machine, so they get struck too — but
       left permanently visible, since a button arrives with its box. */
    const always = [];
    [].forEach.call(node.querySelectorAll('.card__cta-label'), function (label, i) {
      always.push.apply(always, inkify(label, seed + ':c' + i));
    });
    always.forEach(function (ch) { ch.classList.add('is-struck'); });

    const titleChars = title ? inkify(title, seed + ':t', { overstrike: true }) : [];
    const titleLen = titleChars.length;

    // the body may be several lines; typing runs straight through them
    let chars = titleChars;
    [].forEach.call(bodies, function (b, i) {
      chars = chars.concat(inkify(b, seed + ':b' + i));
    });

    const caret = document.createElement('span');
    caret.className = 'caret';
    caret.setAttribute('aria-hidden', 'true');

    let timer = null;
    function clearTimer() { if (timer) { clearInterval(timer); timer = null; } }

    function strikeAll(on) {
      for (let i = 0; i < chars.length; i++) chars[i].classList.toggle('is-struck', on);
    }

    function finish() {
      clearTimer();
      strikeAll(true);
      if (caret.parentNode) caret.remove();
      if (actions) actions.style.opacity = '';
    }

    function reset() {
      clearTimer();
      strikeAll(true);
      if (caret.parentNode) caret.remove();
      if (actions) actions.style.opacity = '';
    }

    function play() {
      if (REDUCED) { finish(); return; }
      clearTimer();
      strikeAll(false);
      if (actions) actions.style.opacity = '0';
      chars[0].before(caret);

      let i = 0;
      timer = setInterval(function () {
        // the title goes one strike a tick, the body two — a hand getting going
        const step = i < titleLen ? 1 : 2;
        for (let s = 0; s < step && i < chars.length; s++, i++) {
          chars[i].classList.add('is-struck');
        }
        if (i < chars.length) {
          chars[i].before(caret);
        } else {
          clearTimer();
          caret.remove();
          if (actions) { actions.style.transition = 'opacity 260ms ease'; actions.style.opacity = '1'; }
        }
      }, 24);
    }

    return { play: play, finish: finish, reset: reset };
  }

  function closeAll() {
    const open = el.hotspots.querySelector('.hotspot.is-open');
    if (open) {
      open.classList.remove('is-open');
      open.querySelector('.hotspot__hit').setAttribute('aria-expanded', 'false');
      if (open._type) open._type.reset();
      unpinCard(open);
    }
    el.body.classList.remove('is-card-open');
    state.openId = null;
  }

  /* On a phone there is no room to hang a sheet beside anything, so it gets
     pinned across the bottom of the screen instead.

     It can't just be `position: fixed` — the stage carries a transform, which
     makes it the containing block for fixed descendants, so fixed would anchor
     to the room rather than the viewport. Instead we measure both boxes on
     screen and solve for the offset. */
  function centreCardInViewport(node) {
    const card = node.querySelector('.card');
    const pad = 18;

    card.style.left = card.style.top = card.style.right = card.style.bottom = 'auto';
    card.style.width = Math.min(420, window.innerWidth - pad * 2) + 'px';

    const hs = node.getBoundingClientRect();
    const w  = card.offsetWidth;
    const h  = card.offsetHeight;

    card.style.left = ((window.innerWidth  - w) / 2 - hs.left) + 'px';
    card.style.top  = ((window.innerHeight - h) / 2 - hs.top)  + 'px';
  }

  function unpinCard(node) {
    const card = node.querySelector('.card');
    card.style.left = card.style.top = card.style.right = card.style.bottom = '';
    card.style.width = '';
  }

  /* Flip a card to the other side if it would run off the window. */
  function keepCardOnScreen(node) {
    // keyed on panMode, not touch: any window narrow enough to need panning is
    // too narrow to hang a sheet beside anything
    if (state.panMode) { centreCardInViewport(node); return; }

    const card = node.querySelector('.card');
    const pad = 16;

    // start from the authored side again, so a flip forced by a narrow window
    // is undone once there is room
    if (card.dataset.alignDefault === undefined) {
      card.dataset.alignDefault  = card.dataset.align;
      card.dataset.valignDefault = card.dataset.valign;
    }
    card.dataset.align  = card.dataset.alignDefault;
    card.dataset.valign = card.dataset.valignDefault;

    card.style.visibility = 'hidden';
    card.style.opacity = '1';
    card.style.pointerEvents = 'none';

    let r = card.getBoundingClientRect();
    if (r.right > window.innerWidth - pad && card.dataset.align === 'right') {
      card.dataset.align = 'left';
    } else if (r.left < pad && card.dataset.align === 'left') {
      card.dataset.align = 'right';
    }

    r = card.getBoundingClientRect();
    if (r.bottom > window.innerHeight - pad && card.dataset.valign === 'down') {
      card.dataset.valign = 'up';
    } else if (r.top < pad && card.dataset.valign === 'up') {
      card.dataset.valign = 'down';
    }

    card.style.visibility = '';
    card.style.opacity = '';
    card.style.pointerEvents = '';
  }

  function hideHint() {
    if (el.hint) el.hint.classList.add('is-hidden');
  }

  /* ======================================================================
     The reading window — for anything too long for a card
     ====================================================================== */

  const reader = { root: null, lastFocus: null };

  function buildReader() {
    reader.root = document.getElementById('reader');
    if (!reader.root) return;
    reader.root.addEventListener('click', function (e) {
      if (e.target.hasAttribute('data-close')) closeReader();
    });
  }

  /* Takes a hotspot and pours its `long` paragraphs onto a bigger sheet. */
  function openReader(data) {
    if (!reader.root || !data.long) return;
    reader.lastFocus = document.activeElement;

    document.getElementById('reader-title').textContent = data.title;
    document.getElementById('reader-body').innerHTML =
      data.long.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') +
      ((data.links || []).length
        ? '<div class="reader__links">' + data.links.map(function (l) {
            return '<a class="reader__link" href="' + esc(l.href) + '">' + esc(l.label) + ARROW + '</a>';
          }).join('') + '</div>'
        : '');

    closeAll();
    reader.root.hidden = false;
    requestAnimationFrame(function () { reader.root.classList.add('is-open'); });
    reader.root.querySelector('.reader__close').focus();
    hideHint();
  }

  function closeReader() {
    if (!reader.root || reader.root.hidden) return;
    reader.root.classList.remove('is-open');
    // hidden only after the fade, so it doesn't snap away
    setTimeout(function () { reader.root.hidden = true; }, REDUCED ? 0 : 360);
    if (reader.lastFocus && reader.lastFocus.focus) reader.lastFocus.focus();
  }

  /* ======================================================================
     6. Tuning mode
     ====================================================================== */

  function bindTuning() {
    const readout = document.createElement('div');
    readout.className = 'readout';
    el.viewport.appendChild(readout);
    let hideTimer = null;

    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closeReader(); closeAll(); return; }
      if (e.key !== 'd' && e.key !== 'D') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      state.tuning = !state.tuning;
      el.body.classList.toggle('tuning', state.tuning);
      readout.textContent = state.tuning
        ? 'Tuning on — click the room to copy coordinates'
        : '';
      readout.classList.toggle('is-visible', state.tuning);
      if (state.tuning) {
        clearTimeout(hideTimer);
      } else {
        readout.classList.remove('is-visible');
      }
    });

    el.viewport.addEventListener('click', function (e) {
      if (!state.tuning) return;
      e.preventDefault();
      e.stopPropagation();

      const r = el.stage.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 100;
      const y = ((e.clientY - r.top) / r.height) * 100;
      const text = 'x: ' + x.toFixed(1) + ', y: ' + y.toFixed(1);

      readout.textContent = text + '   (copied)';
      readout.classList.add('is-visible');

      if (navigator.clipboard) navigator.clipboard.writeText(text).catch(function () {});
      console.log(text);

      clearTimeout(hideTimer);
      hideTimer = setTimeout(function () {
        readout.textContent = 'Tuning on — click the room to copy coordinates';
      }, 2200);
    }, true);
  }

  /* ======================================================================
     Boot
     ====================================================================== */

  function applyCopy() {
    if (typeof SITE === 'undefined') return;
    // panMode means there is more room than window, so say so
    const hint = state.panMode ? (SITE.hintTouch || SITE.hint) : SITE.hint;
    if (hint) setText('hinttext', hint);
    else if (el.hint) el.hint.remove();
  }

  function start() {
    state.imgW = el.scene.naturalWidth  || 2000;
    state.imgH = el.scene.naturalHeight || 1091;

    el.body.classList.toggle('is-touch', TOUCH);
    layoutStage();
    applyCopy();          // again, now that panMode is known
    makeSprites();

    twinkle.ctx = el.twinkle.getContext('2d');

    const read = readLightsFromImage(el.scene);
    twinkle.points = read || inventLights();
    if (!read) {
      console.info('[Ongoing Theory] Could not read pixels from the image — using generated lights. ' +
                   'Serve the folder over http://localhost to read the real skyline.');
    }

    seedLamps();
    buildReader();
    buildHotspots();
    measureHotspots();
    bindPointer();
    bindTuning();

    requestAnimationFrame(function () {
      el.body.classList.add('is-ready');
    });

    // handle for tuning from the console
    window.OT = {
      state: state,
      lights: twinkle.points,
      lightsFromImage: !!read,
      step: function (dt) {
        dt = dt || 0.016;
        state.t += dt;
        driveParallax(dt); driveProximity(); updatePanButtons();
        drawTwinkle(); driveLamps(dt);
      },
      look: function (x, y) { state.pointer.x = x; state.pointer.y = y; },
      open: function (id) {
        const node = el.hotspots.querySelector('.hotspot[data-id="' + id + '"]');
        if (!node) return 'no hotspot: ' + id;
        node._open();
        return id;
      },
      close: closeAll
    };

    loop(performance.now());
  }

  let last = 0;
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000) || 0.016;
    last = now;
    state.t += dt;

    driveParallax(dt);
    driveProximity();
    updatePanButtons();
    drawTwinkle();
    if (!REDUCED) driveLamps(dt);

    requestAnimationFrame(loop);
  }

  /* utils */
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function setText(id, text) {
    const node = document.getElementById(id);
    if (node && text) node.textContent = text;
  }

  let resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      layoutStage();
      measureHotspots();
      const open = el.hotspots.querySelector('.hotspot.is-open');
      if (open) keepCardOnScreen(open);
    }, 120);
  });

  /* Whatever you save the room as, we'll find it. Falls back to the
     generated placeholder so the page is never blank while you work. */
  const SOURCES = [
    'assets/office.webp',
    'assets/office.jpg',
    'assets/office.jpeg',
    'assets/office.png'
  ];
  let sourceIndex = 0;

  function nextSource() {
    sourceIndex++;
    if (sourceIndex < SOURCES.length) {
      el.scene.src = SOURCES[sourceIndex];
    } else {
      el.missing.hidden = false;
    }
  }

  el.scene.addEventListener('error', nextSource);
  el.scene.addEventListener('load', function () {
    if (el.scene.naturalWidth) start();
  }, { once: true });

  applyCopy();

  // the image request begins while the document is still parsing, so it may
  // have already resolved — or already failed — by the time we get here
  if (el.scene.complete) {
    if (el.scene.naturalWidth) start();
    else nextSource();
  }
})();
