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

  /* ────────── global bits: logo, links, marquee, order band ────────── */
  const collection = $('#collection'), marquee = $('#marquee');
  function applyGlobal(){
    const g = Santai.state.g;
    const logo = safeUrl(g.logo_img), li = $('#logoImg'), lt = $('#logoText');
    if(logo){ li.src = logo; li.classList.add('show'); lt.style.display = 'none'; }
    else { li.classList.remove('show'); lt.style.display = ''; }

    const ig = safeUrl((g.ig_url || '').trim()) || DEFAULT_IG_URL;
    $$('[data-ig]').forEach(a => { a.href = ig; });
    $('#bandIg').href = `https://ig.me/m/${encodeURIComponent(igHandle(g))}`;

    const wa = waNumber(g), shop = shopOf(g);
    const waBtn = $('#bandWa');
    waBtn.hidden = !wa;
    if(wa) waBtn.href = `https://wa.me/${wa}`;

    // Marquee: the CMS running text, repeated so the loop never shows a gap
    const items = (g.ticker || '').split('|').map(s => s.trim()).filter(Boolean);
    marquee.hidden = !items.length;
    const track = $('#marqueeTrack'); track.textContent = '';
    for(let i = 0; i < 4; i++) items.forEach(t => track.append(h('span', { class: 'marquee-item', text: t })));

    // Shipping and returns only show when there is something real to say
    const ship = (shop.shipping || '').trim(), ret = (shop.returns || '').trim();
    $('#shipText').textContent = ship; $('#shipBlock').hidden = !ship;
    $('#retText').textContent = ret;  $('#retBlock').hidden = !ret;
    $('#bandInfo').hidden = !ship && !ret;
    $('#bandHow').textContent = wa
      ? 'Click a shirt, pick a size, and the message writes itself. Or message us directly.'
      : 'Click a shirt, pick a size, and we copy the message for you. Or message us directly on Instagram.';
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
      // it stands on the shirt or jumps into the print and becomes the deer already printed there
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
    plate.append(h('span', { class: 'plate-no', text: `No. ${pad2(i + 1)}` }), h('span', { class: 'plate-deg', 'aria-hidden': 'true', text: '0°' }));

    const nameEl = h('h2', { class: 'name', id: `name-${art.id}` });
    String(name).split(/\s+/).forEach((w, k) => {
      const word = h('span', { class: 'w' }, h('span', { text: w }));
      word.firstChild.style.setProperty('--d', (k * 90) + 'ms');
      nameEl.append(word, ' ');
    });

    const info = h('div', { class: 'piece-info' },
      h('p', { class: 'row-label', 'data-reveal': '' }, h('span', { text: `No. ${pad2(i + 1)} / ${pad2(total)}` })),
      nameEl,
      art.sub && art.sub.trim() ? h('p', { class: 'sub', 'data-reveal': '', text: art.sub }) : null,
      h('p', { class: 'piece-hint', 'data-reveal': '' },
        h('span', { class: 'fine-pointer', text: 'Click the shirt for price and sizes' }),
        h('span', { class: 'coarse-pointer', text: 'Tap the shirt for price and sizes' }))
    );

    const piece = h('section', { class: `piece${i % 2 === 1 ? ' is-flip' : ''}`, id: `piece-${art.id}`, 'aria-labelledby': `name-${art.id}` },
      h('div', { class: 'piece-plate' }, plate), info);
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
        h('p', { class: 'row-label' }, h('span', { text: `No. ${pad2(i + 1)}` }), h('span', { class: `status ${st.cls}` }, h('i'), st.text)),
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

  function openDetails(art, i){
    lastFocus = document.activeElement;
    drawerBody.textContent = '';
    drawerBody.append(buildDetails(art, i));
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
  function render(){
    const { a: articles } = Santai.state;
    applyGlobal();
    collection.textContent = '';
    if(revealIO) revealIO.disconnect();

    showStage(articles.length ? 'ok' : 'empty');
    articles.forEach((art, i) => {
      collection.append(buildPiece(art, i, articles.length));
      if(i === 0) collection.append(marquee);
    });
    if(!articles.length) $('#main').insertBefore(marquee, collection);
    $('#orderBand').hidden = !articles.length;

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
  function onScroll(){
    ticking = false;
    header.classList.toggle('is-scrolled', scrollY > 24);
    root.classList.toggle('at-intro', scrollY < innerHeight * .45);
  }
  addEventListener('scroll', () => { if(!ticking){ ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  const motionBtn = $('#motionBtn');
  motionBtn.addEventListener('click', () => {
    const paused = root.classList.toggle('motion-paused');
    motionBtn.setAttribute('aria-pressed', String(paused));
    motionBtn.textContent = paused ? 'Play' : 'Pause';
  });

  const cursorEl = $('#cursor');
  addEventListener('mousemove', e => { cursorEl.style.left = e.clientX + 'px'; cursorEl.style.top = e.clientY + 'px'; }, { passive: true });
  document.addEventListener('mouseover', e => {
    cursorEl.classList.toggle('over', !!e.target.closest('a,button,select,label,summary,input,[role="button"]:not(.plate)'));
    cursorEl.classList.toggle('ring', !!e.target.closest('.plate'));
    cursorEl.classList.toggle('on-dark', !!e.target.closest('.band, .drawer'));
  });

  /* ────────── loading and start ────────── */
  function hideLoading(){
    $('#loading-bar').style.width = '100%';
    setTimeout(() => { const s = $('#loading'); s.classList.add('fade'); setTimeout(() => { s.style.display = 'none'; }, 650); }, 250);
  }
  Santai.onChange.push(() => { render(); hideLoading(); });
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

  $('#year').textContent = new Date().getFullYear();
  start().then(maybeLoadCMS);
})();
