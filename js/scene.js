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

  let deer = null, W = 0, H = 0, dpr = 1;
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

  function measure(){
    W = innerWidth; H = innerHeight; dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - H);
    stops = [];
    const intro = document.getElementById('intro');
    if(intro){
      const r = intro.getBoundingClientRect();
      const w = Math.min(W * .78, 600, H * .62 * 1179 / 702);
      stops.push({ kind: 'meadow', x: r.left + r.width / 2, y: r.top + scrollY + r.height * .7, w, at: 0 });
    }
    $$('.plate').forEach(pl => {
      const r = pl.getBoundingClientRect(), top = r.top + scrollY;
      const lx = +pl.dataset.landX || 50, ly = +pl.dataset.landY || 56, ls = +pl.dataset.landSize || 40;
      stops.push({ kind: 'shirt', mode: pl.dataset.landMode || 'stand', el: pl, x: r.left + r.width * lx / 100, y: top + r.height * ly / 100, w: r.width * ls / 100, at: clamp(top + r.height / 2 - H / 2, 0, maxScroll) });
    });
    for(let i = 1; i < stops.length; i++) if(stops[i].at <= stops[i - 1].at) stops[i].at = stops[i - 1].at + 1;
  }

  /* where the deer should be for a given scroll position */
  function target(y){
    if(!stops.length) return null;
    const first = stops[0], last = stops[stops.length - 1];
    if(stops.length === 1 || y <= first.at) return { x: first.x, y: first.y - y, w: first.w, moving: false, stop: 0, u: 0, into: 0 };
    if(y >= last.at) return { x: last.x, y: last.y - y, w: last.w, moving: false, stop: stops.length - 1, u: 1, into: last.mode === 'into' ? 1 : 0 };
    let k = 0; while(y >= stops[k + 1].at) k++;
    const A = stops[k], B = stops[k + 1], t = (y - A.at) / (B.at - A.at);
    if(reduce){ const S = t < .5 ? A : B; return { x: S.x, y: S.y - y, w: S.w, moving: false, stop: t < .5 ? k : k + 1, u: t < .5 ? 0 : 1, into: (t >= .5 && B.mode === 'into') ? 1 : 0 }; }
    // a short pause where it stands, a run that keeps pace with the page, and a leap onto the shirt
    const u = clamp((t - .05) / .9, 0, 1), e = ease(u);
    // jumping into a print it must arrive moving right (the painted deer faces right), so it swings in from the left
    const side = B.mode === 'into' ? -1 : (k % 2 ? -1 : 1);
    const swing = side * Math.min(W * .26, 340) * Math.sin(Math.PI * u);
    const jump = u > .76 ? Math.sin(Math.PI * (u - .76) / .24) * Math.min(H * .16, 150) : 0;
    return {
      x: lerp(A.x, B.x, e) + swing,
      y: lerp(A.y, B.y, u) - jump - y,
      w: lerp(A.w, B.w, e),
      moving: u > .001 && u < .999,
      stop: u < .5 ? k : k + 1,
      u,
      // how far it has turned into the painted leap, for prints that already carry this deer
      into: B.mode === 'into' ? clamp((u - .84) / .14, 0, 1) : 0
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
    else if(!T.moving && T.stop === 0) st.facing = 1;
    prevX = st.x;

    const atMeadow = !T.moving && stops[T.stop] && stops[T.stop].kind === 'meadow';
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
    st.alpha = reduce ? (landedInto ? 0 : 1) : lerp(st.alpha, landedInto ? 0 : 1, 1 - Math.exp(-dt * (landedInto ? 5 : 10)));
    if(intoNow > .5) st.facing = 1;

    const scale = st.w / deer.width;
    drawGrass(time, false);
    // a soft shadow while it stands
    const sh = (1 - st.run) * (1 - st.leap) * .16 * st.alpha;
    if(sh > .01){ ctx.fillStyle = `rgba(55,40,25,${sh})`; ctx.beginPath(); ctx.ellipse(st.x, st.y + 2, st.w * .34, st.w * .035, 0, 0, Math.PI * 2); ctx.fill(); }
    deer.draw(ctx, st.x, st.y, scale, st.facing, { run: st.run * (1 - st.leap), phase: st.phase, graze: st.graze, look: st.look, nibble: st.nibble, tail: st.tail, leap: st.leap, alpha: st.alpha, time: reduce ? 0 : time });
    drawGrass(time, true);
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
