'use strict';
/* The size chart page: same header and footer as the shirts, the chart from the editor's global size chart. */
(() => {
  document.documentElement.classList.add('js');
  const $ = (s, r = document) => r.querySelector(s);
  function h(tag, props = {}, ...kids){
    const el = document.createElement(tag);
    for(const [k, v] of Object.entries(props)){ if(v == null) continue; if(k === 'class') el.className = v; else if(k === 'text') el.textContent = v; else el.setAttribute(k, v); }
    kids.flat().forEach(c => { if(c != null) el.append(c.nodeType ? c : document.createTextNode(String(c))); });
    return el;
  }

  // header turns solid once you scroll, as on the shirts page
  const header = $('.site-header');
  const onScroll = () => header.classList.toggle('is-scrolled', scrollY > 24);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  // the dot cursor, stepping aside over real controls
  const cur = $('#cursor');
  addEventListener('mousemove', e => { cur.style.left = e.clientX + 'px'; cur.style.top = e.clientY + 'px'; }, { passive: true });
  document.addEventListener('mouseover', e => cur.classList.toggle('over', !!e.target.closest('a,button,summary')));

  const box = $('#szContainer');
  function render(){
    const g = Santai.state.g, a = Santai.state.a || [];
    const logo = safeUrl(g.logo_img);
    if(logo){ $('#logoImg').src = logo; $('#logoImg').classList.add('show'); $('#logoText').style.display = 'none'; }
    const ig = safeUrl((g.ig_url || '').trim()) || DEFAULT_IG_URL;
    document.querySelectorAll('[data-ig]').forEach(x => { x.href = ig; });

    const sizes = parseSizes(g.size_chart);
    box.textContent = '';
    if(!sizes.length){ box.append(h('p', { class: 'sz-empty', text: 'The size chart is coming soon.' })); }
    else box.append(h('div', { class: 'sz-scroll' }, h('table', { class: 'sz-table' },
      h('thead', {}, h('tr', {}, ['Size', 'Chest', 'Length', 'Shoulder'].map(t => h('th', { scope: 'col', text: t })))),
      h('tbody', {}, sizes.map(r => h('tr', {},
        h('th', { scope: 'row', text: r.size }),
        ...[r.chest, r.length, r.shoulder].map(v => h('td', {}, v ? h('span', { class: 'n', text: v }) : '', v ? h('span', { class: 'u', text: ' cm' }) : ''))))))));

    const list = $('#footShirts'); list.textContent = '';
    a.forEach(art => list.append(h('li', {}, h('a', { href: `index.html#piece-${art.id}`, text: art.name || 'Untitled' }))));
  }
  Santai.onChange.push(render);
  loadData().then(r => {
    if(r === 'error'){ box.textContent = ''; box.append(h('p', { class: 'sz-empty', text: 'The size chart could not be loaded. Check your connection and reload the page.' })); }
  });
})();
