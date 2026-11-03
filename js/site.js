'use strict';
/* SANTAI storefront. Content comes from Supabase (see core.js); this file builds the page from it.
   Every piece of database text is set with textContent or attributes, never as HTML.
   The deer that runs between the shirts lives in scene.js. */
(() => {
  const root = document.documentElement;
  root.classList.add('js');
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* tiny element builder: text goes in as text, never as markup */
  function h(tag, props = {}, ...kids){
    const el = document.createElement(tag);
    for(const [k, v] of Object.entries(props)){
      if(v == null || v === false) continue;
      if(k === 'class') el.className = v;
      else if(k === 'text') el.textContent = v;
      else if(k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    kids.flat().forEach(c => { if(c == null || c === false) return; el.append(c.nodeType ? c : document.createTextNode(String(c))); });
    return el;
  }
  const pad2 = n => String(n).padStart(2, '0');
  const num = (v, d, lo, hi) => { const n = parseFloat(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
  // Prices are in IDR. Numbers typed in the editor ("350000") show as "IDR 350,000"; anything else shows as typed.
  const priceOf = art => {
    const raw = String(extraOf(art).price || '').trim();
    if(!raw) return '';
    const digits = raw.replace(/[\s.,]/g, '');
    return /^\d+$/.test(digits) ? 'IDR ' + Number(digits).toLocaleString('en-US') : raw;
  };

  // Static drawing used when a shirt has no photo yet. No data goes into this markup.
  const PLACEHOLDER_SVG = `<svg class="plate-svg plate-front" viewBox="0 0 340 420" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Shirt photo not added yet"><path d="M90 90 L60 160 L30 155 L50 240 L90 235 L90 380 L250 380 L250 235 L290 240 L310 155 L280 160 L250 90 L220 70 Q170 50 120 70 Z" fill="#f5f5f0" stroke="#0a0a0a" stroke-width="2.5" stroke-linejoin="round"/><path d="M140 70 Q170 95 200 70" fill="none" stroke="#0a0a0a" stroke-width="2" stroke-linecap="round"/><line x1="170" y1="100" x2="170" y2="380" stroke="#0a0a0a" stroke-width=".6" stroke-dasharray="3 5" opacity=".25"/></svg>`;

  /* ────────── ordering ────────── */
  const igHandle = g => {
    try{ return new URL(safeUrl(g.ig_url) || DEFAULT_IG_URL).pathname.split('/').filter(Boolean)[0] || 'santai.memorabilia'; }
    catch(e){ return 'santai.memorabilia'; }
  };
  const waNumber = g => { const d = String(shopOf(g).whatsapp || '').replace(/\D/g, ''); return d.length >= 8 && d.length <= 15 ? d : ''; };
  const statusOf = art => {
    const s = art.avail_status || 'Available Now';
    if(s === 'Sold Out') return { cls: 'out', text: 'Sold out' };
    if(s === 'Running Low') return { cls: 'low', text: 'Running low' };
    return { cls: 'ok', text: 'Available now' };
  };
  function orderText(art, size, restock){
    const price = priceOf(art);
    const name = art.name || 'this shirt';
    if(restock) return `Hi SANTAI, is ${name}${size ? ' in size ' + size : ''} coming back in stock?`;
    return `Hi SANTAI, I'd like to order ${name}${size ? ', size ' + size : ''}${price ? ' (' + price + ')' : ''}.`;
  }
  async function sendOrder(art, size, restock, say){
    const g = Santai.state.g, wa = waNumber(g), text = orderText(art, size, restock);
    const open = url => { const w = window.open(url, '_blank', 'noopener'); if(!w) location.href = url; };
    if(wa){ say('Opening WhatsApp with your message ready.'); open(`https://wa.me/${wa}?text=${encodeURIComponent(text)}`); return; }
    let copied = false;
    try{ await navigator.clipboard.writeText(text); copied = true; }catch(e){}
    say(copied ? 'Message copied. Paste it into the Instagram chat.' : 'Send us this on Instagram: ' + text);
    open(`https://ig.me/m/${encodeURIComponent(igHandle(g))}`);
  }

  /* ────────── global bits: logo and links ────────── */
  const collection = $('#collection');
  function applyGlobal(){
    const g = Santai.state.g;
    const logo = safeUrl(g.logo_img), li = $('#logoImg'), lt = $('#logoText');
    if(logo){ li.src = logo; li.classList.add('show'); lt.style.display = 'none'; }
    else { li.classList.remove('show'); lt.style.display = ''; }
    const ig = safeUrl((g.ig_url || '').trim()) || DEFAULT_IG_URL;
    $$('[data-ig]').forEach(a => { a.href = ig; });
  }

  /* ────────── how to order: the ways to message, then shipping and returns ────────── */
  function buildHowTo(){
    const g = Santai.state.g, wa = waNumber(g), shop = shopOf(g);
    const ship = (shop.shipping || '').trim(), ret = (shop.returns || '').trim();
    return h('div', { class: 'details how' },
      h('div', { class: 'details-body' },
        h('h2', { class: 'details-name', id: 'drawerTitle', text: 'How to order' }),
        h('p', { class: 'story', text: wa
          ? 'Click a shirt, pick a size, and press Order. WhatsApp opens with the message written for you. Or message us directly.'
          : 'Click a shirt, pick a size, and press Order. We copy the message for you and open Instagram. Or message us directly.' }),
        h('div', { class: 'how-actions' },
          wa ? h('a', { class: 'cta cta-link', href: `https://wa.me/${wa}`, target: '_blank', rel: 'noopener noreferrer', text: 'Message on WhatsApp' }) : null,
          h('a', { class: 'cta cta-link ghost', href: `https://ig.me/m/${encodeURIComponent(igHandle(g))}`, target: '_blank', rel: 'noopener noreferrer', text: 'Message on Instagram' })),
        ship ? h('div', { class: 'how-block' }, h('h3', { text: 'Shipping' }), h('p', { text: ship })) : null,
        ret ? h('div', { class: 'how-block' }, h('h3', { text: 'Returns' }), h('p', { text: ret })) : null));
  }

  /* ────────── one piece on the page: the shirt and its name, nothing else ────────── */
  function buildPiece(art, i, total){
    const ex = extraOf(art), land = ex.deer || {};
    const front = safeUrl(art.shirt_img), back = safeUrl(art.shirt_back_img);
    const name = art.name || 'Untitled';

    // The plate is the button: a click opens the details, holding it turns the shirt.
    const plate = h('div', {
      class: 'plate', 'data-reveal': '', role: 'button', tabindex: '0', 'aria-haspopup': 'dialog',
      'aria-label': `${name}. Open price, sizes and details`,
      // where the deer lands on this photo: its anchor (% across, % down), its width (% of the photo), and whether
      // it stands on the shirt, jumps into a print that already shows it, or hides while the print's herd walks in
      'data-land-x': num(land.x, 50, 0, 100), 'data-land-y': num(land.y, 56, 0, 100), 'data-land-size': num(land.size, 40, 5, 100),
      'data-land-mode': ['into', 'herd'].includes(land.mode) ? land.mode : 'stand'
    });
    if(front){
      const fimg = h('img', { class: 'plate-img plate-front', src: front, alt: `${name}, front`, width: 3, height: 4, decoding: 'async', draggable: 'false', loading: i === 0 ? 'eager' : 'lazy', fetchpriority: i === 0 ? 'high' : null });
      // the plate takes the photo's own shape, so the deer's landing spot maps straight onto the photo
      const fit = () => { if(fimg.naturalWidth){ plate.style.setProperty('--ar', (fimg.naturalWidth / fimg.naturalHeight).toFixed(4)); if(window.SantaiScene) window.SantaiScene.refresh(); } };
      fimg.addEventListener('load', fit); if(fimg.complete) fit();
      plate.append(fimg);
    } else plate.insertAdjacentHTML('afterbegin', PLACEHOLDER_SVG);
    if(back) plate.append(h('img', { class: 'plate-img plate-back', src: back, alt: `${name}, back`, width: 3, height: 4, decoding: 'async', draggable: 'false', loading: 'lazy' }));
    plate.append(h('span', { class: 'plate-deg', 'aria-hidden': 'true', text: '0°' }));

    // The page shows only the shirt. The name stays for screen readers and the page outline.
    const piece = h('section', { class: 'piece', id: `piece-${art.id}`, 'aria-labelledby': `name-${art.id}` },
      h('h2', { class: 'sr-only', id: `name-${art.id}`, text: name }),
      h('div', { class: 'piece-plate' }, plate),
      // touch screens have no "Details" cursor, so they get one quiet line instead (CSS shows it only there)
      h('p', { class: 'tap-hint', 'aria-hidden': 'true', text: 'Tap for details' }));

    // The painting behind this shirt, if the editor set one. It fades in as the shirt comes into view.
    const bg = safeUrl(ex.bg);
    if(bg){ const layerEl = h('div', { class: 'scene-bg-layer' }); layerEl.style.backgroundImage = `url("${bg}")`; $('#sceneBg').append(layerEl); bgLayers.push({ piece, el: layerEl }); }

    wirePlate(plate, art, i);
    return piece;
  }

  /* ────────── the details panel: everything that used to crowd the page ────────── */
  const drawer = $('#drawer'), drawerBody = $('#drawerBody');
  let lastFocus = null;

  function buildDetails(art, i){
    const g = Santai.state.g, ex = extraOf(art), st = statusOf(art);
    const sizes = parseSizes(art.sizes).length ? parseSizes(art.sizes) : parseSizes(g.size_chart);
    const restock = st.cls === 'out', name = art.name || 'Untitled';
    const price = priceOf(art);
    const photos = [
      safeUrl(art.shirt_img) && { u: safeUrl(art.shirt_img), alt: `${name}, front` },
      safeUrl(art.shirt_back_img) && { u: safeUrl(art.shirt_back_img), alt: `${name}, back` },
      ...(Array.isArray(ex.gallery) ? ex.gallery : []).map(safeUrl).filter(Boolean).map((u, k) => ({ u, alt: `${name}, photo ${k + 1}` }))
    ].filter(Boolean);
    const specRows = [['Fabric', ex.fabric], ['Fit', ex.fit]].filter(([, v]) => v && String(v).trim());

    const radioName = `size-${art.id}`;
    const note = h('p', { class: 'cta-note', role: 'status', 'aria-live': 'polite' });
    const say = (t, err) => { note.textContent = t; note.classList.toggle('err', !!err); };
    const sizeSet = sizes.length ? h('fieldset', { class: 'size' },
      h('legend', {}, h('span', { text: 'Size' }), h('a', { href: 'sizechart.html', text: 'Size chart' })),
      h('div', { class: 'size-opts' }, sizes.map(s => h('label', {}, h('input', { type: 'radio', name: radioName, value: s.size }), s.size)))
    ) : null;
    if(sizeSet) sizeSet.addEventListener('change', () => say(''));
    const meas = sizes.length && sizes.some(s => s.chest || s.length || s.shoulder) ? h('details', { class: 'meas' },
      h('summary', { text: 'Measurements, in cm' }),
      h('table', {},
        h('thead', {}, h('tr', {}, ['Size', 'Chest', 'Length', 'Shoulder'].map(t => h('th', { scope: 'col', text: t })))),
        h('tbody', {}, sizes.map(s => h('tr', {}, h('td', { text: s.size }), h('td', { text: s.chest || '' }), h('td', { text: s.length || '' }), h('td', { text: s.shoulder || '' })))))
    ) : null;
    const cta = h('button', { class: 'cta', type: 'button', text: restock ? 'Ask about restock' : 'Order this shirt' });

    const wrap = h('div', { class: 'details' },
      photos.length ? h('div', { class: 'gal', role: 'region', 'aria-label': `Photos of ${name}`, tabindex: '0' },
        photos.map(p => h('figure', {}, h('img', { src: p.u, alt: p.alt, width: 4, height: 5, decoding: 'async', draggable: 'false' })))) : null,
      h('div', { class: 'details-body' },
        h('p', { class: 'row-label' }, h('span', { class: `status ${st.cls}` }, h('i'), st.text)),
        h('h2', { class: 'details-name', id: 'drawerTitle', text: name }),
        art.sub && art.sub.trim() ? h('p', { class: 'sub', text: art.sub }) : null,
        price ? h('p', { class: 'price', text: price }) : h('p', { class: 'price ask', text: 'Message us for the price' }),
        ex.story && String(ex.story).trim() ? h('p', { class: 'story', text: ex.story }) : (art.description && art.description.trim() ? h('p', { class: 'story', text: art.description }) : null),
        specRows.length ? h('dl', { class: 'specs' }, specRows.map(([k, v]) => h('div', {}, h('dt', { text: k }), h('dd', { text: v })))) : null,
        h('div', { class: 'buy' }, sizeSet, meas, cta, note))
    );
    cta.addEventListener('click', () => {
      const chosen = $(`input[name="${radioName}"]:checked`, wrap);
      if(sizeSet && !chosen && !restock){ say('Choose a size first.', true); $(`input[name="${radioName}"]`, wrap).focus(); return; }
      say('');
      sendOrder(art, chosen ? chosen.value : '', restock, say);
    });
    const gal = $('.gal', wrap); if(gal) dragScroll(gal);
    return wrap;
  }

  function openDetails(art, i){ openPanel(buildDetails(art, i)); }
  function openPanel(content){
    lastFocus = document.activeElement;
    drawerBody.textContent = '';
    drawerBody.append(content);
    drawerBody.scrollTop = 0;
    drawer.hidden = false;
    root.classList.add('drawer-open');
    requestAnimationFrame(() => requestAnimationFrame(() => drawer.classList.add('open')));
    $('#drawerClose').focus({ preventScroll: true });
  }
  function closeDetails(){
    if(drawer.hidden) return;
    drawer.classList.remove('open');
    root.classList.remove('drawer-open');
    setTimeout(() => { if(!drawer.classList.contains('open')){ drawer.hidden = true; drawerBody.textContent = ''; } }, reduceMotion ? 0 : 500);
    if(lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  $('#drawerClose').addEventListener('click', closeDetails);
  document.addEventListener('click', e => { const a = e.target.closest('[data-how-to-order]'); if(a){ e.preventDefault(); openPanel(buildHowTo()); } });
  $('#drawerBackdrop').addEventListener('click', closeDetails);
  document.addEventListener('keydown', e => {
    if(drawer.hidden) return;
    if(e.key === 'Escape'){ e.preventDefault(); closeDetails(); return; }
    if(e.key === 'Tab'){ // keep focus inside the panel while it is open
      const f = $$('button, a[href], input, summary, [tabindex="0"]', $('#drawerPanel')).filter(el => el.offsetParent !== null);
      if(!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
      else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
    }
  });

  /* ────────── the plate: click opens details, press and hold turns the shirt ────────── */
  const holdLayer = $('#hold-layer');
  function wirePlate(plate, art, i){
    const front = $('.plate-front', plate), back = $('.plate-back', plate), degEl = $('.plate-deg', plate);
    let deg = 0, down = false, held = false, sx = 0, sy = 0, moved = 0, timer = null, showingBack = false, audio = null;
    const audioUrl = safeUrl(art.audio_url);
    if(audioUrl){ audio = new Audio(audioUrl); audio.loop = true; audio.preload = 'none'; }

    function applyRot(d){
      const n = ((d % 360) + 360) % 360, rad = n * Math.PI / 180, cx = Math.cos(rad), ab = Math.abs(cx);
      const inBack = back && n > 90 && n < 270;
      if(inBack && !showingBack){ showingBack = true; front.style.opacity = '0'; back.style.opacity = '1'; }
      else if(!inBack && showingBack){ showingBack = false; back.style.opacity = '0'; front.style.opacity = '1'; }
      (showingBack ? back : front).style.transform = `scaleX(${cx < 0 ? -ab : ab}) skewY(${Math.sin(rad) * 4}deg)`;
      degEl.textContent = Math.round(n) + '°';
    }
    function startHold(){
      held = true;
      plate.classList.add('is-held'); root.classList.add('holding');
      const bg = safeUrl(art.hold_bg), col = (art.hold_color || '').trim();
      holdLayer.style.backgroundImage = bg ? `url("${bg}")` : 'none';
      holdLayer.style.backgroundColor = (!bg && col && CSS.supports('color', col)) ? col : (bg ? '' : '#0d0d0c');
      if(audio){ audio.currentTime = 0; audio.play().catch(() => {}); }
    }
    function endHold(){
      plate.classList.remove('is-held'); root.classList.remove('holding');
      if(audio){ audio.pause(); audio.currentTime = 0; }
      // the shirt settles back to its front, so the deer lands on the print again
      if(deg % 360 !== 0){ deg = 0; showingBack = false; front.style.transform = ''; front.style.opacity = '1'; if(back){ back.style.opacity = '0'; back.style.transform = ''; } degEl.textContent = '0°'; }
    }

    plate.addEventListener('pointerdown', e => {
      if(e.button > 0) return;
      down = true; held = false; moved = 0; sx = e.clientX; sy = e.clientY;
      plate.setPointerCapture && plate.setPointerCapture(e.pointerId);
      timer = setTimeout(() => { plate.classList.add('is-dragging'); startHold(); }, 260);
    });
    plate.addEventListener('pointermove', e => {
      if(!down) return;
      const dx = e.clientX - sx; moved += Math.abs(dx) + Math.abs(e.clientY - sy); sx = e.clientX; sy = e.clientY;
      if(held){ deg += dx * .55; applyRot(deg); }
    });
    const finish = cancelled => {
      if(!down) return;
      down = false; clearTimeout(timer); plate.classList.remove('is-dragging');
      if(held) endHold();
      else if(!cancelled && moved < 10) openDetails(art, i);
      held = false;
    };
    plate.addEventListener('pointerup', () => finish(false));
    plate.addEventListener('pointercancel', () => finish(true));
    plate.addEventListener('contextmenu', e => e.preventDefault());
    plate.addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); openDetails(art, i); } });
  }

  /* mouse drag to scroll a photo strip (touch and trackpad already scroll natively) */
  function dragScroll(el){
    let isDown = false, sx = 0, sl = 0;
    el.addEventListener('pointerdown', e => { if(e.pointerType !== 'mouse') return; isDown = true; sx = e.clientX; sl = el.scrollLeft; });
    window.addEventListener('pointermove', e => { if(!isDown) return; const d = e.clientX - sx; if(Math.abs(d) > 4) el.classList.add('is-dragging'); el.scrollLeft = sl - d; });
    window.addEventListener('pointerup', () => { isDown = false; el.classList.remove('is-dragging'); });
  }

  /* ────────── render the whole collection ────────── */
  let revealIO = null;
  const bgLayers = [];
  function render(){
    const { a: articles } = Santai.state;
    applyGlobal();
    collection.textContent = '';
    $('#sceneBg').textContent = ''; bgLayers.length = 0;
    if(revealIO) revealIO.disconnect();

    showStage(articles.length ? 'ok' : 'empty');
    articles.forEach((art, i) => collection.append(buildPiece(art, i, articles.length)));
    const list = $('#footShirts'); list.textContent = '';
    articles.forEach(art => list.append(h('li', {}, h('a', { href: `#piece-${art.id}`, text: art.name || 'Untitled' }))));
    updateBackdrop();

    revealIO = new IntersectionObserver((entries, io) => entries.forEach(en => { if(en.isIntersecting){ en.target.classList.add('is-in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: .08 });
    $$('[data-reveal], .name', collection).forEach((el, k) => { if(el.dataset.reveal !== undefined) el.style.setProperty('--d', (k % 4) * 80 + 'ms'); revealIO.observe(el); });
    if(window.SantaiScene) window.SantaiScene.refresh();
  }

  function showStage(mode){
    const box = $('#stageMsg');
    if(mode === 'ok'){ box.classList.remove('show'); return; }
    $('#stageMsgText').textContent = mode === 'error' ? 'The collection could not be loaded. Check your connection and try again.' : 'Nothing is on show yet. Check back soon.';
    $('#stageRetry').hidden = mode !== 'error';
    box.classList.add('show');
  }
  $('#stageRetry').addEventListener('click', start);

  /* ────────── header: hidden while only the deer is on screen ────────── */
  const header = $('.site-header');
  let ticking = false;
  /* the painting behind the shirt in view: full strength only when the shirt sits in the middle, and even then quiet */
  const BG_MAX = .32;
  function updateBackdrop(){
    const mid = innerHeight / 2;
    bgLayers.forEach(({ piece, el }) => {
      const r = piece.getBoundingClientRect(), d = Math.abs(r.top + r.height / 2 - mid) / innerHeight;
      el.style.opacity = (Math.max(0, 1 - d * 1.7) * BG_MAX).toFixed(3);
    });
  }
  function onScroll(){
    ticking = false;
    updateBackdrop();
    header.classList.toggle('is-scrolled', scrollY > 24);
    root.classList.toggle('at-intro', scrollY < innerHeight * .45);
  }
  addEventListener('scroll', () => { if(!ticking){ ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  const cursorEl = $('#cursor');
  addEventListener('mousemove', e => { cursorEl.style.left = e.clientX + 'px'; cursorEl.style.top = e.clientY + 'px'; }, { passive: true });
  document.addEventListener('mouseover', e => {
    cursorEl.classList.toggle('over', !!e.target.closest('a,button,select,label,summary,input,[role="button"]:not(.plate)'));
    cursorEl.classList.toggle('ring', !!e.target.closest('.plate'));
    cursorEl.classList.toggle('on-dark', !!e.target.closest('.drawer'));
  });

  /* ────────── loading and start ────────── */
  function hideLoading(){
    $('#loading-bar').style.width = '100%';
    setTimeout(() => { const s = $('#loading'); s.classList.add('fade'); setTimeout(() => { s.style.display = 'none'; }, 650); }, 250);
  }
  let howToShown = false;
  Santai.onChange.push(() => {
    render(); hideLoading();
    // arriving from another page's "How to order" link
    if(!howToShown && location.hash === '#how-to-order'){ howToShown = true; openPanel(buildHowTo()); }
  });
  Santai.render = render;
  Santai.applyGlobal = applyGlobal;

  async function start(){
    $('#loading-bar').style.width = '30%';
    const r = await loadData();
    if(r === 'error'){ showStage('error'); hideLoading(); }
    else if(!Santai.loaded){ hideLoading(); }
  }

  /* the editor is a separate file that only loads for people who ask for it */
  let cmsRequested = false;
  function maybeLoadCMS(){
    if(location.hash !== '#CMSedit') return;
    if(window.SantaiCMS){ window.SantaiCMS.route(); return; }
    if(cmsRequested) return;
    cmsRequested = true;
    document.head.append(h('link', { rel: 'stylesheet', href: 'css/cms.css' }));
    document.body.append(h('script', { src: 'js/cms.js' }));
  }
  addEventListener('hashchange', maybeLoadCMS);

  start().then(maybeLoadCMS);
})();
