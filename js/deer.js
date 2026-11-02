'use strict';
/* The SANTAI deer: the painted deer from "Deer Comes the Sun", cut out and rigged.
   Body, head and tail are the painting itself (img/deer.webp), clipped into pieces.
   Legs are drawn, filled with the painting's own texture, so they can stand, graze and gallop.
   All coordinates below are pixels in the 1179x702 cutout. */
(() => {
  const SRC_W = 1179, SRC_H = 702;
  const ORIGIN = { x: 560, y: 728 };          // between the hooves, on the ground: the deer's anchor point

  // pieces of the painting
  const TAIL = [[225,220],[340,220],[350,300],[300,335],[222,305]];
  const TAIL_PIVOT = [322, 305];
  const HEAD = [[738,0],[1179,0],[1179,400],[952,440],[906,505],[738,301]];
  const HEAD_PIVOT = [772, 378];
  const TORSO = [[335,150],[738,150],[738,301],[906,505],[880,528],[820,548],[700,566],[560,566],[450,548],[360,528],[300,508],[240,474],[204,420],[214,330],[290,332],[352,302],[340,220]];
  const NECK_BLOBS = [[868, 466, 36, 34], [790, 430, 50, 44], [752, 322, 26, 22]];
  const NECK_EDGE = [[738, 301], [906, 505]]; // the line where head and body meet

  // legs: hip or shoulder point, segment lengths, widths along the leg
  const LEGS = {
    hindFar:   { at: [318, 440], seg: [118, 112, 104], w: [92, 50, 28, 18], hind: true,  far: true,  off: 0.05 },
    frontFar:  { at: [822, 474], seg: [128, 116], w: [58, 30, 18], hind: false, far: true,  off: 0.05 },
    hindNear:  { at: [300, 448], seg: [118, 112, 104], w: [100, 52, 28, 18], hind: true,  far: false, off: 0 },
    frontNear: { at: [840, 482], seg: [128, 116], w: [62, 31, 18], hind: false, far: false, off: 0 },
  };
  const DRAW_ORDER = ['hindFar', 'frontFar', 'tail', 'hindNear', 'frontNear', 'body', 'head'];

  const rad = d => d * Math.PI / 180;
  const lerp = (a, b, t) => a + (b - a) * t;
  const TAU = Math.PI * 2;

  /* Leg angles in degrees, measured from straight down, positive toward the head.
     Deer run in bounds: front legs move together, hind legs together. One cycle, phase 0..1:
     0 stretched in the air, .25 front hooves land, .5 legs gathered under the body, .75 hind legs push off. */
  const FRONT_KEYS = [[55, 22], [12, 6], [-38, -30], [14, -96]];
  const HIND_KEYS  = [[-48, -100, -82], [-30, -82, -52], [42, -18, 8], [2, -62, -24]];
  const STAND_FRONT = [2, 0], STAND_HIND = [26, -34, 4];
  const ease = t => t * t * (3 - 2 * t);
  function keyed(keys, p){
    const f = p * keys.length, i = Math.floor(f) % keys.length, t = ease(f - Math.floor(f));
    const A = keys[i], B = keys[(i + 1) % keys.length];
    return A.map((v, k) => lerp(v, B[k], t));
  }
  function legPose(leg, p, run, graze){
    const stand = leg.hind ? STAND_HIND : (graze ? [8, 5] : STAND_FRONT);
    const go = keyed(leg.hind ? HIND_KEYS : FRONT_KEYS, p);
    return stand.map((v, k) => lerp(v, go[k], run));
  }

  function pathPoly(ctx, pts){ ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); }

  // a tapered limb: a chain of segments with widths at each joint
  function drawLeg(ctx, leg, angles, fill){
    const pts = [leg.at.slice()];
    angles.forEach((a, i) => {
      const [x, y] = pts[i], L = leg.seg[i];
      pts.push([x + L * Math.sin(rad(a)), y + L * Math.cos(rad(a))]);
    });
    ctx.fillStyle = fill;
    for(let i = 0; i < pts.length - 1; i++){
      const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
      const w1 = leg.w[i] / 2, w2 = leg.w[i + 1] / 2;
      const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      ctx.beginPath();
      ctx.moveTo(x1 + nx * w1, y1 + ny * w1); ctx.lineTo(x2 + nx * w2, y2 + ny * w2);
      ctx.lineTo(x2 - nx * w2, y2 - ny * w2); ctx.lineTo(x1 - nx * w1, y1 - ny * w1);
      ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(x2, y2, w2, 0, TAU); ctx.fill();
    }
    ctx.beginPath(); ctx.arc(pts[0][0], pts[0][1], leg.w[0] / 2, 0, TAU); ctx.fill();
    // hoof
    const [hx, hy] = pts[pts.length - 1], a = rad(angles[angles.length - 1]);
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(-a);
    ctx.fillStyle = '#3b2f24';
    ctx.beginPath(); ctx.ellipse(3, 6, 10, 9, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function createDeer(img){
    // texture for the drawn parts: a patch of the painted body, tiled
    const tex = document.createElement('canvas'); tex.width = 180; tex.height = 120;
    tex.getContext('2d').drawImage(img, 520, 360, 180, 120, 0, 0, 180, 120);
    const probe = document.createElement('canvas').getContext('2d');
    const near = probe.createPattern(tex, 'repeat');
    const darkTex = document.createElement('canvas'); darkTex.width = 180; darkTex.height = 120;
    const dctx = darkTex.getContext('2d'); dctx.drawImage(tex, 0, 0);
    dctx.globalCompositeOperation = 'source-atop'; dctx.fillStyle = 'rgba(40,28,18,.28)'; dctx.fillRect(0, 0, 180, 120);
    const far = probe.createPattern(darkTex, 'repeat');

    /* s: { run 0..1, phase 0..1 (gallop cycle), graze 0..1 (head down), nibble (degrees of a small chew),
            tail -1..1, look 0..1 (head lift while grazing), leap 0..1 (show the painting's own leap pose),
            alpha 0..1 } */
    function draw(ctx, x, y, scale, facing, s){
      const run = s.run || 0, phase = s.phase || 0, graze = s.graze || 0, leap = s.leap || 0;
      const alpha = s.alpha == null ? 1 : s.alpha;
      if(alpha <= .002) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(x, y);
      ctx.scale(scale * facing, scale);
      if(leap >= .999){ ctx.drawImage(img, -ORIGIN.x, -ORIGIN.y); ctx.restore(); return; }
      ctx.save();

      // body motion: a gallop rocks and lifts the body; standing breathes
      const bob = (run ? -34 * run * (Math.cos(TAU * phase) + 1) / 2 : 2 * Math.sin((s.time || 0) * 1.6)) * (1 - leap);
      const pitch = run * 5 * Math.sin(TAU * phase);
      ctx.translate(0, bob);
      ctx.rotate(rad(pitch));
      ctx.translate(-ORIGIN.x, -ORIGIN.y);

      const headAngle = lerp(lerp(0, 64, graze) - (s.look || 0) * 52 * graze, 5 * (1 + Math.sin(TAU * phase)) / 2, run) + (s.nibble || 0);
      for(const part of DRAW_ORDER){
        if(part === 'tail'){
          ctx.save(); ctx.translate(...TAIL_PIVOT); ctx.rotate(rad((s.tail || 0) * 18 - run * 14)); ctx.translate(-TAIL_PIVOT[0], -TAIL_PIVOT[1]);
          pathPoly(ctx, TAIL); ctx.clip(); ctx.drawImage(img, 0, 0); ctx.restore();
        } else if(part === 'body'){
          // the shoulder joint sits behind the body: it only shows where moving the head would open a gap
          ctx.save(); ctx.fillStyle = near; ctx.filter = 'blur(1.5px)';
          NECK_BLOBS.forEach(([bx, by, rx, ry]) => { ctx.beginPath(); ctx.ellipse(bx, by, rx, ry, rad(-20), 0, TAU); ctx.fill(); });
          ctx.restore();
          ctx.save(); pathPoly(ctx, TORSO); ctx.clip(); ctx.drawImage(img, 0, 0); ctx.restore();
        } else if(part === 'head'){
          if(headAngle > 2){
            // fill the wedge that opens above the shoulder as the head goes down: a smooth arc from withers to the lowered neck
            const [px, py] = HEAD_PIVOT, a = rad(headAngle);
            const rot = ([qx, qy], t) => [px + (qx - px) * Math.cos(t) - (qy - py) * Math.sin(t), py + (qx - px) * Math.sin(t) + (qy - py) * Math.cos(t)];
            const [P1, P2] = NECK_EDGE, R1 = rot(P1, a), R2 = rot(P2, a);
            ctx.save(); ctx.filter = `blur(${Math.max(.6, 2.2 * Math.min(1, headAngle / 30))}px)`;
            ctx.fillStyle = near; ctx.beginPath(); ctx.moveTo(...P1);
            // a near-straight line from withers to the lowered neck, bowed out a touch so no notch shows
            const mx = (P1[0] + R1[0]) / 2, my = (P1[1] + R1[1]) / 2;
            ctx.quadraticCurveTo(mx - (px - mx) * .04, my - (py - my) * .04, ...R1);
            ctx.lineTo(...R2); ctx.lineTo(...P2); ctx.closePath(); ctx.fill();
            ctx.restore();
          }
          ctx.save();
          ctx.translate(...HEAD_PIVOT); ctx.rotate(rad(headAngle)); ctx.translate(-HEAD_PIVOT[0], -HEAD_PIVOT[1]);
          pathPoly(ctx, HEAD); ctx.clip(); ctx.drawImage(img, 0, 0);
          ctx.restore();
        } else {
          const leg = LEGS[part];
          const p = ((phase + leg.off) % 1 + 1) % 1;
          drawLeg(ctx, leg, legPose(leg, p, run, graze), leg.far ? far : near);
        }
      }
      ctx.restore();
      if(leap > .001){ ctx.globalAlpha = alpha * leap; ctx.drawImage(img, -ORIGIN.x, -ORIGIN.y); }
      ctx.restore();
    }
    return { draw, width: SRC_W, height: SRC_H, origin: ORIGIN };
  }

  window.SantaiDeer = { createDeer };
})();
