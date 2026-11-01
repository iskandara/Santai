'use strict';
/* SANTAI storefront. Content comes from Supabase (see core.js); this file builds the page from it.
   Every piece of database text is set with textContent or attributes, never as HTML. */
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
    const price = (extraOf(art).price || '').trim();
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
      ? 'Pick a shirt and a size above and the message writes itself. Or message us directly.'
      : 'Pick a shirt and a size above and we copy the message for you. Or message us directly on Instagram.';
  }

  /* ────────── one piece (a shirt) ────────── */
  function buildPiece(art, i, total){
    const g = Santai.state.g, ex = extraOf(art), st = statusOf(art);
    const sizes = parseSizes(art.sizes).length ? parseSizes(art.sizes) : parseSizes(g.size_chart);
    const isHero = i === 0, restock = st.cls === 'out';
    const front = safeUrl(art.shirt_img), back = safeUrl(art.shirt_back_img);

    /* plate */
    const plate = h('div', { class: 'plate', 'data-reveal': '' });
    if(front){
      plate.append(h('img', { class: 'plate-img plate-front', src: front, alt: `${art.name || 'Shirt'}, front`, width: 3, height: 4, decoding: 'async', draggable: 'false', loading: isHero ? 'eager' : 'lazy', fetchpriority: isHero ? 'high' : null }));
    } else plate.insertAdjacentHTML('afterbegin', PLACEHOLDER_SVG);
    if(back) plate.append(h('img', { class: 'plate-img plate-back', src: back, alt: `${art.name || 'Shirt'}, back`, width: 3, height: 4, decoding: 'async', draggable: 'false', loading: 'lazy' }));
    plate.append(
      h('span', { class: 'plate-no', text: `No. ${pad2(i + 1)}` }),
      h('span', { class: 'plate-deg', 'aria-hidden': 'true', text: '0°' }),
      h('span', { class: 'plate-hint', text: 'Hold and drag to turn' })
    );
    const flipBtn = back ? h('button', { class: 'plate-flip', type: 'button', text: 'Flip' }) : null;
    if(flipBtn) plate.append(flipBtn);

    /* info */
    const nameEl = h('h2', { class: 'name' });
    String(art.name || 'Untitled').split(/\s+/).forEach((w, k) => {
      const word = h('span', { class: 'w' }, h('span', { text: w }));
      word.firstChild.style.setProperty('--d', (k * 90) + 'ms');
      nameEl.append(word, ' ');
    });

    const price = (ex.price || '').trim();
    const specRows = [['Fabric', ex.fabric], ['Fit', ex.fit]].filter(([, v]) => v && String(v).trim());

    const radioName = `size-${art.id}`;
    const note = h('p', { class: 'cta-note', role: 'status', 'aria-live': 'polite' });
    const say = (t, err) => { note.textContent = t; note.classList.toggle('err', !!err); };

    const sizeSet = sizes.length ? h('fieldset', { class: 'size' },
      h('legend', {}, h('span', { text: 'Size' }), h('a', { href: 'sizechart.html', text: 'Size chart' })),
      h('div', { class: 'size-opts' }, sizes.map(s => h('label', {},
        h('input', { type: 'radio', name: radioName, value: s.size }), s.size)))
    ) : null;

    const meas = sizes.length && sizes.some(s => s.chest || s.length || s.shoulder) ? h('details', { class: 'meas' },
      h('summary', { text: 'Measurements, in cm' }),
      h('table', {},
        h('thead', {}, h('tr', {}, ['Size', 'Chest', 'Length', 'Shoulder'].map(t => h('th', { scope: 'col', text: t })))),
        h('tbody', {}, sizes.map(s => h('tr', {}, h('td', { text: s.size }), h('td', { text: s.chest || '' }), h('td', { text: s.length || '' }), h('td', { text: s.shoulder || '' })))))
    ) : null;

    const cta = h('button', { class: 'cta', type: 'button', text: restock ? 'Ask about restock' : 'Order this shirt' });
    cta.addEventListener('click', () => {
      const chosen = $(`input[name="${radioName}"]:checked`, info);
      if(sizeSet && !chosen && !restock){ say('Choose a size first.', true); $(`input[name="${radioName}"]`, info).focus(); return; }
      say('');
      sendOrder(art, chosen ? chosen.value : '', restock, say);
    });
    if(sizeSet) sizeSet.addEventListener('change', () => say(''));

    const info = h('div', { class: 'piece-info' },
      h('p', { class: 'row-label', 'data-reveal': '' }, h('span', { text: `No. ${pad2(i + 1)} / ${pad2(total)}` }), h('span', { class: `status ${st.cls}` }, h('i'), st.text)),
      nameEl,
      art.sub && art.sub.trim() ? h('p', { class: 'sub', 'data-reveal': '', text: art.sub }) : null,
      price ? h('p', { class: 'price', 'data-reveal': '', text: price }) : h('p', { class: 'price ask', 'data-reveal': '', text: 'Message us for the price' }),
      ex.story && String(ex.story).trim() ? h('p', { class: 'story', 'data-reveal': '', text: ex.story }) : (art.description && art.description.trim() ? h('p', { class: 'story', 'data-reveal': '', text: art.description }) : null),
      specRows.length ? h('dl', { class: 'specs', 'data-reveal': '' }, specRows.map(([k, v]) => h('div', {}, h('dt', { text: k }), h('dd', { text: v })))) : null,
      h('div', { class: 'buy', 'data-reveal': '' }, sizeSet, meas, cta, note)
    );

    const piece = h('section', { class: `piece${isHero ? ' is-hero' : ''}${i % 2 === 1 ? ' is-flip' : ''}`, id: `piece-${art.id}`, 'aria-labelledby': `name-${art.id}` }, h('div', { class: 'piece-plate' }, plate), info);
    nameEl.id = `name-${art.id}`;

    /* photos (only when the editor added some) */
    const gallery = (Array.isArray(ex.gallery) ? ex.gallery : []).map(safeUrl).filter(Boolean);
    if(gallery.length){
      const strip = h('div', { class: 'gal', role: 'region', 'aria-label': `Photos of ${art.name || 'this shirt'}`, tabindex: '0' },
        gallery.map((u, k) => h('figure', {}, h('img', { src: u, alt: `${art.name || 'Shirt'}, photo ${k + 1} of ${gallery.length}`, width: 4, height: 5, loading: 'lazy', decoding: 'async', draggable: 'false' }))));
      dragScroll(strip);
      piece.append(h('div', { class: 'piece-gallery' }, h('div', { class: 'gal-head' }, h('span', { text: 'Photos' }), h('span', { text: `${pad2(gallery.length)}` })), strip));
    }

    wirePlate(plate, art, flipBtn);
    return piece;
  }

  /* ────────── hold to turn ────────── */
  const holdLayer = $('#hold-layer');
  function wirePlate(plate, art, flipBtn){
    const front = $('.plate-front', plate), back = $('.plate-back', plate), degEl = $('.plate-deg', plate);
    let deg = 0, dragging = false, sx = 0, timer = null, showingBack = false, audio = null;
    const audioUrl = safeUrl(art.audio_url);
    if(audioUrl){ audio = new Audio(audioUrl); audio.loop = true; audio.preload = 'none'; }

    function applyRot(d){
      const n = ((d % 360) + 360) % 360, rad = n * Math.PI / 180, cx = Math.cos(rad), ab = Math.abs(cx);
      const inBack = back && n > 90 && n < 270;
      if(inBack && !showingBack){ showingBack = true; front.style.opacity = '0'; back.style.opacity = '1'; }
      else if(!inBack && showingBack){ showingBack = false; back.style.opacity = '0'; front.style.opacity = '1'; }
      const tf = `scaleX(${cx < 0 ? -ab : ab}) skewY(${Math.sin(rad) * 4}deg)`;
      (showingBack ? back : front).style.transform = tf;
      degEl.textContent = Math.round(n) + '°';
    }
    function startHold(){
      plate.classList.add('is-held'); root.classList.add('holding');
      const bg = safeUrl(art.hold_bg), col = (art.hold_color || '').trim();
      holdLayer.style.backgroundImage = bg ? `url("${bg}")` : 'none';
      holdLayer.style.backgroundColor = (!bg && col && CSS.supports('color', col)) ? col : (bg ? '' : '#0d0d0c');
      if(audio){ audio.currentTime = 0; audio.play().catch(() => {}); }
      cursorEl.classList.add('press');
    }
    function endHold(){
      plate.classList.remove('is-held'); root.classList.remove('holding');
      if(audio){ audio.pause(); audio.currentTime = 0; }
      cursorEl.classList.remove('press');
    }
    function end(){ if(!dragging) return; dragging = false; clearTimeout(timer); plate.classList.remove('is-dragging'); endHold(); }

    plate.addEventListener('pointerdown', e => {
      if(e.button > 0 || e.target.closest('.plate-flip')) return;
      dragging = true; sx = e.clientX; plate.setPointerCapture && plate.setPointerCapture(e.pointerId);
      plate.classList.add('is-dragging', 'is-touched');
      timer = setTimeout(startHold, 220);
    });
    plate.addEventListener('pointermove', e => { if(!dragging) return; deg += (e.clientX - sx) * .55; sx = e.clientX; applyRot(deg); });
    plate.addEventListener('pointerup', end);
    plate.addEventListener('pointercancel', end);
    plate.addEventListener('contextmenu', e => e.preventDefault());
    plate.addEventListener('pointerenter', e => { if(e.pointerType === 'mouse') cursorEl.classList.add('ring'); });
    plate.addEventListener('pointerleave', () => cursorEl.classList.remove('ring'));

    if(flipBtn) flipBtn.addEventListener('click', () => {
      plate.classList.add('is-touched');
      const from = deg, to = Math.round(deg / 180) * 180 + 180;
      if(reduceMotion){ deg = to; applyRot(deg); return; }
      const t0 = performance.now(), dur = 700;
      (function tick(now){
        const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 4);
        deg = from + (to - from) * e; applyRot(deg);
        if(p < 1) requestAnimationFrame(tick);
      })(t0);
    });
  }

  /* mouse drag to scroll a photo strip (touch and trackpad already scroll natively) */
  function dragScroll(el){
    let down = false, sx = 0, sl = 0, moved = false;
    el.addEventListener('pointerdown', e => { if(e.pointerType !== 'mouse') return; down = true; moved = false; sx = e.clientX; sl = el.scrollLeft; });
    window.addEventListener('pointermove', e => { if(!down) return; const d = e.clientX - sx; if(Math.abs(d) > 4){ moved = true; el.classList.add('is-dragging'); } el.scrollLeft = sl - d; });
    window.addEventListener('pointerup', () => { down = false; el.classList.remove('is-dragging'); });
  }

  /* ────────── render the whole collection ────────── */
  const collection = $('#collection'), marquee = $('#marquee');
  let revealIO = null, pieceIO = null, buyIO = null;
  const visibleBuys = new Set();
  let currentPiece = null, bandVisible = false;

  function render(){
    const { a: articles } = Santai.state;
    applyGlobal();
    collection.textContent = '';
    visibleBuys.clear(); currentPiece = null;
    if(revealIO) revealIO.disconnect(); if(pieceIO) pieceIO.disconnect(); if(buyIO) buyIO.disconnect();

    showStage(articles.length ? 'ok' : 'empty');
    articles.forEach((art, i) => {
      collection.append(buildPiece(art, i, articles.length));
      if(i === 0) collection.append(marquee);
    });
    if(!articles.length) $('#main').insertBefore(marquee, collection);
    $('#orderBand').hidden = !articles.length;

    revealIO = new IntersectionObserver((entries, io) => entries.forEach(en => { if(en.isIntersecting){ en.target.classList.add('is-in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: .08 });
    $$('[data-reveal], .name', collection).forEach((el, k) => { if(el.dataset.reveal !== undefined) el.style.setProperty('--d', (k % 5) * 70 + 'ms'); revealIO.observe(el); });

    pieceIO = new IntersectionObserver(entries => {
      entries.forEach(en => { if(en.isIntersecting) currentPiece = en.target; });
      updateBar();
    }, { threshold: .4 });
    buyIO = new IntersectionObserver(entries => {
      entries.forEach(en => { en.isIntersecting ? visibleBuys.add(en.target) : visibleBuys.delete(en.target); });
      updateBar();
    }, { threshold: .3 });
    $$('.piece', collection).forEach(p => { pieceIO.observe(p); buyIO.observe($('.buy', p)); });
  }

  function showStage(mode){
    const box = $('#stageMsg');
    if(mode === 'ok'){ box.classList.remove('show'); return; }
    $('#stageMsgText').textContent = mode === 'error' ? 'The collection could not be loaded. Check your connection and try again.' : 'Nothing is on show yet. Check back soon.';
    $('#stageRetry').hidden = mode !== 'error';
    box.classList.add('show');
  }
  $('#stageRetry').addEventListener('click', start);

  /* ────────── mobile order bar ────────── */
  const bar = $('#mbar');
  function updateBar(){
    const piece = currentPiece;
    const buyShown = piece && visibleBuys.has($('.buy', piece));
    const show = !!piece && !buyShown && !bandVisible && piece.getBoundingClientRect().height > 0;
    if(piece){
      const art = Santai.state.a.find(x => `piece-${x.id}` === piece.id);
      if(art){ $('#mbarName').textContent = art.name || 'Untitled'; $('#mbarPrice').textContent = (extraOf(art).price || '').trim() || 'Message us for the price'; }
    }
    bar.classList.toggle('show', show);
  }
  $('#mbarBtn').addEventListener('click', () => {
    if(!currentPiece) return;
    const buy = $('.buy', currentPiece);
    buy.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
    const first = $('input[type=radio]', buy) || $('.cta', buy);
    setTimeout(() => first && first.focus({ preventScroll: true }), reduceMotion ? 0 : 500);
  });
  new IntersectionObserver(entries => { bandVisible = entries[0].isIntersecting; updateBar(); }, { threshold: .1 }).observe($('#orderBand'));

  /* ────────── header, motion toggle, cursor ────────── */
  const header = $('.site-header');
  let ticking = false;
  addEventListener('scroll', () => { if(ticking) return; ticking = true; requestAnimationFrame(() => { header.classList.toggle('is-scrolled', scrollY > 24); ticking = false; }); }, { passive: true });

  const motionBtn = $('#motionBtn');
  motionBtn.addEventListener('click', () => {
    const paused = root.classList.toggle('motion-paused');
    motionBtn.setAttribute('aria-pressed', String(paused));
    motionBtn.textContent = paused ? 'Play' : 'Pause';
  });

  const cursorEl = $('#cursor');
  addEventListener('mousemove', e => { cursorEl.style.left = e.clientX + 'px'; cursorEl.style.top = e.clientY + 'px'; }, { passive: true });
  document.addEventListener('mouseover', e => {
    cursorEl.classList.toggle('over', !!e.target.closest('a,button,select,label,summary,input,[role="button"]'));
    cursorEl.classList.toggle('on-dark', !!e.target.closest('.band'));
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
