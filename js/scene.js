'use strict';
/* The deer's journey. On load it grazes alone on the first screen. Scrolling sends it running down the
   page, and it lands on each shirt in turn (the spot is set per shirt in the editor). Scrolling back
   sends it back. The deer itself is drawn by deer.js on one fixed canvas above the page. */
(() => {
  const canvas = document.getElementById('deerCanvas');
  if(!canvas || !window.SantaiDeer) return;
  const ctx = canvas.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $$ = s => [...document.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  let deer = null, W = 0, H = 0, dpr = 1, maxScroll = 0;
  let stops = [];          // where the deer rests: the meadow, then each shirt (page coordinates)
  const st = { x: 0, y: 0, w: 0, facing: 1, run: 0, phase: 0, graze: 1, look: 0, tail: 0, nibble: 0, leap: 0, alpha: 1, ready: false };
  let lastY = scrollY, lastScrollAt = 0, scrollSpeed = 0, prevX = null;

  /* a meadow of grass blades around the deer on the first screen */
  const rnd = i => { const r = Math.sin(i * 12.9898 + 4.1) * 43758.5453; return r - Math.floor(r); };
  const blades = Array.from({ length: 150 }, (_, i) => {
    const f = rnd(i), g = rnd(i + 500), c = rnd(i + 900);
    // most blades gather in tufts, thickest under the head where it grazes
    const tuft = [-.62, -.3, .02, .34, .58][Math.floor(c * 5)];
    const x = tuft + (f - .5) * .32;
    const nearHead = Math.max(0, 1 - Math.abs(x - .5) / .3);
    return { x, h: .45 + g * .7 + nearHead * .5, lean: (g - .5) * .55, front: rnd(i + 77) < .3, hue: Math.floor(rnd(i + 33) * 3), seed: f * 6.28 };
  });
  const GRASS = ['#8b9a52', '#b9a650', '#6f8048'];

  /* The herd from the How Deer Is Your Love painting. Boxes are pixels in that 1600x2000 painting.
     On a shirt set to "herd", the lone deer slips behind the shirt and these three come in from the edges
     of the screen, each settling exactly onto its own place in the print, then hand over to the print. */
  const PAINT_W = 1600;
  const HERD = [
    { key: 'doe',  box: [212, 1500, 423, 304], from: 'left',   delay: 0,   hops: 4 },
    { key: 'herd', box: [765, 1309, 291, 215], from: 'right',  delay: .12, hops: 5 },
    { key: 'fawn', box: [1045, 1319, 284, 302], from: 'bottom', delay: .24, hops: 4 },
  ];
  HERD.forEach(d => {
    d.img = new Image(); d.img.decoding = 'async';
    d.img.src = canvas.dataset['herd' + d.key[0].toUpperCase() + d.key.slice(1)] || `img/herd-${d.key}.webp`;
  });
  let herdAlpha = 0, lastHerd = null;
  const layer = document.createElement('canvas'), lctx = layer.getContext('2d');

  // the photo inside a plate, as drawn on screen (object-fit: contain)
  function photoRect(pl){
    const r = pl.getBoundingClientRect(), img = pl.querySelector('img.plate-front');
    const ar = img && img.naturalWidth ? img.naturalWidth / img.naturalHeight : r.width / r.height;
    let w = r.width, h = w / ar; if(h > r.height){ h = r.height; w = h * ar; }
    return { left: r.left + (r.width - w) / 2, top: r.top + (r.height - h) / 2, w, h, img };
  }

  function measure(){
    W = innerWidth; H = innerHeight; dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    maxScroll = Math.max(0, document.documentElement.scrollHeight - H);
    stops = [];
    const intro = document.getElementById('intro');
    if(intro){
      const r = intro.getBoundingClientRect();
      const w = Math.min(W * .78, 600, H * .62 * 1179 / 702);
      stops.push({ kind: 'meadow', x: r.left + r.width / 2, y: r.top + scrollY + r.height * .7, w, at: 0 });
    }
    $$('.plate').forEach(pl => {
      const r = pl.getBoundingClientRect(), top = r.top + scrollY, P = photoRect(pl), ptop = P.top + scrollY;
      const lx = +pl.dataset.landX || 50, ly = +pl.dataset.landY || 56, ls = +pl.dataset.landSize || 40;
      const mode = pl.dataset.landMode || 'stand', at = clamp(top + r.height / 2 - H / 2, 0, maxScroll);
      if(mode === 'herd'){
        // the lone deer runs to the middle of the shirt, where it disappears behind it
        stops.push({ kind: 'shirt', mode, el: pl, cal: { x: lx, y: ly, size: ls }, x: P.left + P.w / 2, y: ptop + P.h * .48, w: P.w * .3, at });
      } else {
        stops.push({ kind: 'shirt', mode, el: pl, x: P.left + P.w * lx / 100, y: ptop + P.h * ly / 100, w: P.w * ls / 100, at });
      }
    });
    // the footer: once the shirts are done, the deer comes out and rests on the painted hills
    const foot = document.getElementById('footer');
    if(foot && stops.length > 1){
      const r = foot.getBoundingClientRect(), top = r.top + scrollY, narrow = W < 700;
      const w = narrow ? Math.min(W * .34, 150) : Math.min(W * .2, 260);
      stops.push({ kind: 'footer', mode: 'rest', el: foot,
        x: r.left + r.width * (narrow ? .3 : .32), y: top + r.height * (narrow ? .8 : .62), w,
        horizon: { x: r.left + r.width * (narrow ? .78 : .74), y: top + r.height * (narrow ? .6 : .44) },
        at: clamp(maxScroll - Math.min(H * .18, 140), 0, maxScroll) });
    }
    for(let i = 1; i < stops.length; i++) if(stops[i].at <= stops[i - 1].at) stops[i].at = stops[i - 1].at + 1;
  }

  /* At the footer, scrolling on past the resting deer sends it off: it stops, leaves a few droppings,
     then runs for the horizon, smaller and smaller until it is gone. Scrolling back up resets it. */
  const leave = { phase: 'idle', t0: 0 };
  let pellets = [], nudgeAt = 0;
  const atBottom = () => scrollY >= maxScroll - 2;
  addEventListener('wheel', e => { if(e.deltaY > 0 && atBottom()) nudgeAt = performance.now(); }, { passive: true });
  let touchY = null;
  addEventListener('touchstart', e => { touchY = e.touches[0].clientY; }, { passive: true });
  addEventListener('touchmove', e => { if(touchY !== null && touchY - e.touches[0].clientY > 12 && atBottom()) nudgeAt = performance.now(); }, { passive: true });
  addEventListener('keydown', e => { if(['ArrowDown', 'PageDown', 'End', ' '].includes(e.key) && atBottom()) nudgeAt = performance.now(); });

  /* where the deer should be for a given scroll position */
  function target(y){
    if(!stops.length) return null;
    const first = stops[0], last = stops[stops.length - 1];
    if(stops.length === 1 || y <= first.at) return { x: first.x, y: first.y - y, w: first.w, moving: false, stop: 0, u: 0, into: 0, A: first, B: first };
    if(y >= last.at) return { x: last.x, y: last.y - y, w: last.w, moving: false, stop: stops.length - 1, u: 1, into: last.mode === 'into' ? 1 : 0, A: last, B: last };
    let k = 0; while(y >= stops[k + 1].at) k++;
    const A = stops[k], B = stops[k + 1], t = (y - A.at) / (B.at - A.at);
    if(reduce){ const S = t < .5 ? A : B; return { x: S.x, y: S.y - y, w: S.w, moving: false, stop: t < .5 ? k : k + 1, u: t < .5 ? 0 : 1, into: (t >= .5 && B.mode === 'into') ? 1 : 0, A: S, B: S }; }
    // a short pause where it stands, a run that keeps pace with the page, and a leap onto the shirt
    const u = clamp((t - .05) / .9, 0, 1), e = ease(u);
    // jumping into a print it must arrive moving right (the painted deer faces right), so it swings in from the left
    const side = B.mode === 'into' ? -1 : (k % 2 ? -1 : 1);
    const swing = side * Math.min(W * .26, 340) * Math.sin(Math.PI * u);
    const jump = B.mode !== 'herd' && u > .76 ? Math.sin(Math.PI * (u - .76) / .24) * Math.min(H * .16, 150) : 0;
    return {
      x: lerp(A.x, B.x, e) + swing,
      y: lerp(A.y, B.y, u) - jump - y,
      w: lerp(A.w, B.w, e),
      moving: u > .001 && u < .999,
      stop: u < .5 ? k : k + 1,
      u,
      // how far it has turned into the painted leap, for prints that already carry this deer
      into: B.mode === 'into' ? clamp((u - .84) / .14, 0, 1) : 0,
      A, B
    };
  }

  function drawGrass(time, front){
    const m = stops[0]; if(!m || m.kind !== 'meadow') return;
    const gx = m.x, gy = m.y - scrollY, spread = m.w * .62, bh = m.w * .1;
    if(gy < -bh || gy > H + bh * 2) return;
    ctx.lineCap = 'round';
    blades.forEach(b => {
      if(b.front !== front) return;
      const x = gx + b.x * spread, h = bh * b.h;
      const sway = reduce ? 0 : Math.sin(time * 1.3 + b.seed) * h * .12;
      ctx.strokeStyle = GRASS[b.hue]; ctx.globalAlpha = front ? .95 : .8;
      ctx.lineWidth = Math.max(1.2, m.w * .006);
      ctx.beginPath(); ctx.moveTo(x, gy + 2);
      ctx.quadraticCurveTo(x + b.lean * h * .5, gy - h * .55, x + b.lean * h + sway, gy - h);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }

  /* the lone deer drawn on its own layer, with the shirt cut out of it, so it reads as passing behind the shirt */
  function drawBehind(pl, draw){
    const P = photoRect(pl);
    if(layer.width !== canvas.width || layer.height !== canvas.height){ layer.width = canvas.width; layer.height = canvas.height; }
    lctx.setTransform(dpr, 0, 0, dpr, 0, 0); lctx.clearRect(0, 0, W, H);
    draw(lctx);
    if(P.img && P.img.complete && P.img.naturalWidth){
      lctx.globalCompositeOperation = 'destination-out';
      lctx.drawImage(P.img, P.left, P.top, P.w, P.h);
      lctx.globalCompositeOperation = 'source-over';
    }
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(layer, 0, 0); ctx.restore();
  }

  const easeOut = t => 1 - Math.pow(1 - t, 3);
  function drawHerd(stop, p, alpha, time){
    if(alpha <= .002) return;
    const P = photoRect(stop.el), c = stop.cal;
    const s = P.w * c.size / 100 / PAINT_W, ox = P.left + P.w * c.x / 100, oy = P.top + P.h * c.y / 100;
    HERD.forEach(d => {
      if(!d.img.complete || !d.img.naturalWidth) return;
      const q = clamp((p - d.delay) / (1 - d.delay), 0, 1);
      if(q <= 0) return;
      const [bx, by, bw, bh] = d.box;
      const tw = bw * s, th = bh * s, tx = ox + bx * s + tw / 2, ty = oy + by * s + th;   // target: centre-bottom of the sprite
      const k0 = Math.max(5, W * .2 / tw), e = easeOut(q), k = lerp(k0, 1, e);   // big as they enter at the screen edge (at least a fifth of the screen wide), print-size as they settle
      const sx = d.from === 'left' ? -tw * 3 : d.from === 'right' ? W + tw * 3 : W * .78;
      const sy = d.from === 'bottom' ? H + th * 3.5 : clamp(ty + H * .12, th * 3, H - 10);
      const hop = reduce ? 0 : Math.abs(Math.sin(q * Math.PI * d.hops)) * (1 - q) * th * 2.2 * k + (q < 1 ? Math.sin(time * 9 + d.delay * 20) * th * .05 * (1 - q) : 0);
      const x = lerp(sx, tx, e), y = lerp(sy, ty, e) - hop;
      const w = tw * k, h = th * k;
      ctx.save(); ctx.globalAlpha = alpha;
      ctx.translate(x, y); ctx.rotate((reduce ? 0 : Math.sin(q * Math.PI * d.hops) * (1 - q) * 6) * Math.PI / 180);
      ctx.drawImage(d.img, -w / 2, -h, w, h);
      ctx.restore();
    });
  }

  let lastT = performance.now();
  function frame(now){
    requestAnimationFrame(frame);
    const dt = Math.min(.05, (now - lastT) / 1000); lastT = now;
    const time = now / 1000;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if(!deer || !stops.length) return;

    const y = scrollY;
    if(y !== lastY){ scrollSpeed = Math.abs(y - lastY) / Math.max(dt, .001); lastY = y; lastScrollAt = now; }
    else if(now - lastScrollAt > 120) scrollSpeed *= .9;

    const T = target(y); if(!T) return;
    const follow = reduce || !st.ready ? 1 : 1 - Math.exp(-dt * 14);
    st.x = lerp(st.x, T.x, follow); st.y = lerp(st.y, T.y, follow); st.w = lerp(st.w, T.w, follow);
    st.ready = true;

    // face the way it is running; at the meadow it faces right
    if(prevX !== null && T.moving){ const dx = st.x - prevX; if(Math.abs(dx) > .6) st.facing = dx > 0 ? 1 : -1; }
    else if(!T.moving && (T.stop === 0 || (stops[T.stop] && stops[T.stop].kind === 'footer'))) st.facing = 1;
    prevX = st.x;

    const restStop = !T.moving && stops[T.stop];
    const atMeadow = restStop && (restStop.kind === 'meadow' || restStop.kind === 'footer');
    const k = 1 - Math.exp(-dt * 6);
    st.run = reduce ? 0 : lerp(st.run, T.moving ? 1 : 0, k);
    st.graze = lerp(st.graze, atMeadow ? 1 : 0, 1 - Math.exp(-dt * 3));
    if(!reduce && st.run > .01) st.phase = (st.phase + dt * (1.5 + Math.min(1.6, scrollSpeed / 1400))) % 1;
    else if(st.run <= .01) st.phase = 0;

    if(!reduce){
      // grazing: chew, and every few seconds lift the head to look around
      const lc = (time % 7.5) / 7.5;
      const lookUp = lc > .72 && lc < .92 ? Math.sin(Math.PI * (lc - .72) / .2) : 0;
      st.look = lerp(st.look, lookUp, 1 - Math.exp(-dt * 5));
      st.nibble = st.graze > .5 ? Math.sin(time * 9) * 2.2 * (1 - st.look) : 0;
      const tc = (time % 4.3) / 4.3;
      st.tail = tc < .12 ? Math.sin(Math.PI * tc / .12 * 3) : 0;
    }

    // into a print: settle into the painted pose, then hand over to the print itself
    const intoNow = T.into || 0;
    st.leap = reduce ? intoNow : lerp(st.leap, intoNow, 1 - Math.exp(-dt * 18));
    if(intoNow > 0 && T.moving) st.phase = lerp(st.phase, 0, intoNow);
    const landedInto = !T.moving && intoNow >= 1;
    // the herd: which shirt it belongs to, and how far along its entrance is
    const A = T.A || stops[0], B = T.B || stops[0];
    const atHerd = !T.moving && stops[T.stop] && stops[T.stop].mode === 'herd';
    let herdStop = null, herdP = 0;
    if(T.moving && B.mode === 'herd'){ herdStop = B; herdP = clamp((T.u - .5) / .46, 0, 1); }
    else if(atHerd){ herdStop = stops[T.stop]; herdP = 1; }
    const herdLanded = atHerd || herdP >= 1;
    herdAlpha = reduce ? (herdStop && !herdLanded ? 1 : 0) : lerp(herdAlpha, herdStop ? (herdLanded ? 0 : 1) : 0, 1 - Math.exp(-dt * (herdLanded ? 3 : 14)));
    if(!herdStop && herdAlpha < .01) herdAlpha = 0;
    // the lone deer: gone behind a herd shirt, back out when it leaves
    let loneTarget = landedInto ? 0 : 1;
    if(T.moving && B.mode === 'herd') loneTarget = 1 - clamp((T.u - .92) / .06, 0, 1); // hidden by the shirt itself well before this
    if(atHerd) loneTarget = 0;
    if(T.moving && A.mode === 'herd') loneTarget = clamp(T.u / .12, 0, 1);
    st.alpha = reduce ? loneTarget : lerp(st.alpha, loneTarget, 1 - Math.exp(-dt * (loneTarget < st.alpha ? 6 : 12)));
    if(intoNow > .5) st.facing = 1;

    /* the footer exit: droppings, then off to the horizon */
    const fstop = stops[stops.length - 1];
    if(fstop && fstop.kind === 'footer'){
      if(y < fstop.at - 30){ leave.phase = 'idle'; pellets = []; }
      const resting = !T.moving && T.stop === stops.length - 1;
      if(!reduce && resting && leave.phase === 'idle' && (y > fstop.at + 50 || now - nudgeAt < 300)) { leave.phase = 'going'; leave.t0 = now; }
      if(leave.phase !== 'idle'){
        const lt = (now - leave.t0) / 1000;
        const bx = fstop.x, by = fstop.y - y, hx = fstop.horizon.x, hy = fstop.horizon.y - y;
        const scaleNow = fstop.w / deer.width;
        st.graze = lerp(st.graze, 0, 1 - Math.exp(-dt * 8)); st.look = 0; st.nibble = 0;
        if(lt < 1.5){
          // stop, lift the tail, and leave a few droppings
          st.x = bx; st.y = by; st.w = fstop.w; st.run = 0; st.facing = 1; st.alpha = 1;
          st.tail = lt > .25 && lt < 1.25 ? 1.3 : 0;   // tail up
          [.5, .7, .9].forEach((at, i) => {
            if(lt >= at && pellets.length <= i){
              // just under the tail, in page coordinates so they stay on the hills
              const lx = bx + (282 - deer.origin.x) * scaleNow, ly = by + (372 - deer.origin.y) * scaleNow;
              pellets.push({ x: lx + (i - 1) * fstop.w * .012, y: ly + scrollY, vy: 0, ground: fstop.y - fstop.w * .004 + (i % 2) * fstop.w * .006, r: Math.max(2, fstop.w * .011) });
            }
          });
        } else {
          // the run to the horizon: speeding up, shrinking with distance, gone at the end
          const p = clamp((lt - 1.5) / 2.8, 0, 1), e = p * p * (3 - 2 * p);
          st.x = lerp(bx, hx, e); st.y = lerp(by, hy, e) - Math.sin(Math.PI * p * 5) * fstop.w * .04 * (1 - p);
          st.w = fstop.w * lerp(1, .05, 1 - Math.pow(1 - p, 1.6));
          st.run = 1; st.facing = hx >= bx ? 1 : -1; st.tail = 0;
          st.phase = (st.phase + dt * 2.6) % 1;
          st.alpha = 1 - clamp((p - .82) / .18, 0, 1);
          if(p >= 1) leave.phase = 'gone';
        }
      }
      if(leave.phase === 'gone') st.alpha = 0;
      // droppings fall to the ground and stay there until you scroll back up
      pellets.forEach(pl => {
        if(pl.y < pl.ground){ pl.vy += 2200 * dt * (fstop.w / 260); pl.y = Math.min(pl.ground, pl.y + pl.vy * dt); }
        ctx.fillStyle = '#4a3726';
        ctx.beginPath(); ctx.ellipse(pl.x, pl.y - scrollY, pl.r * 1.15, pl.r, 0, 0, Math.PI * 2); ctx.fill();
      });
    }

    const scale = st.w / deer.width;
    drawGrass(time, false);
    // a soft shadow while it stands
    const sh = (1 - st.run) * (1 - st.leap) * .16 * st.alpha;
    if(sh > .01){ ctx.fillStyle = `rgba(55,40,25,${sh})`; ctx.beginPath(); ctx.ellipse(st.x, st.y + 2, st.w * .34, st.w * .035, 0, 0, Math.PI * 2); ctx.fill(); }
    const pose = { run: st.run * (1 - st.leap), phase: st.phase, graze: st.graze, look: st.look, nibble: st.nibble, tail: st.tail, leap: st.leap, alpha: st.alpha, time: reduce ? 0 : time };
    const behind = (T.moving && B.mode === 'herd') ? B : (T.moving && A.mode === 'herd') ? A : null;
    if(behind && st.alpha > .002) drawBehind(behind.el, c => deer.draw(c, st.x, st.y, scale, st.facing, pose));
    else deer.draw(ctx, st.x, st.y, scale, st.facing, pose);
    drawGrass(time, true);
    if(herdStop || herdAlpha > 0) drawHerd(herdStop || lastHerd, herdStop ? herdP : 1, herdAlpha, time);
    if(herdStop) lastHerd = herdStop;
  }

  const img = new Image();
  img.decoding = 'async';
  img.onload = () => { deer = window.SantaiDeer.createDeer(img); measure(); canvas.classList.add('ready'); };
  img.src = canvas.dataset.src || 'img/deer.webp';

  let rt = null;
  const remeasure = () => { clearTimeout(rt); rt = setTimeout(measure, 60); };
  addEventListener('resize', remeasure);
  if('ResizeObserver' in window) new ResizeObserver(remeasure).observe(document.body);
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);
  addEventListener('load', remeasure);

  window.SantaiScene = { refresh: () => { measure(); requestAnimationFrame(measure); } };
  measure();
  requestAnimationFrame(frame);
})();
