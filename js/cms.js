'use strict';
/* SANTAI editor. Loads only on /#CMSedit. Reading is public; every write here carries the signed-in
   editor's Supabase token, and row-level security (supabase/cms-security.sql) is what refuses anyone else. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const G = () => Santai.state.g;
  const A = () => Santai.state.a;

  /* ────────── sign-in (Supabase Auth). The session lives in sessionStorage and ends with the tab. ────────── */
  const SESSION_KEY = 'santai_cms_session';
  const readSession = () => { try{ const s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); return s && s.access_token ? s : null; }catch(e){ return null; } };
  const saveSession = s => { try{ s ? sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)) : sessionStorage.removeItem(SESSION_KEY); }catch(e){} };
  const toSession = j => ({ access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at || Math.floor(Date.now() / 1000) + (j.expires_in || 3600) });
  const authJson = { apikey: SB_KEY, 'Content-Type': 'application/json' };

  async function signIn(email, password){
    const r = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: authJson, body: JSON.stringify({ email, password }) });
    if(!r.ok) throw new Error('Sign in failed');
    const s = toSession(await r.json()); saveSession(s); return s;
  }
  async function getToken(){
    let s = readSession(); if(!s) throw new Error('Not signed in');
    if(s.expires_at - 60 > Date.now() / 1000) return s.access_token;
    const r = await fetch(`${SB_URL}/auth/v1/token?grant_type=refresh_token`, { method: 'POST', headers: authJson, body: JSON.stringify({ refresh_token: s.refresh_token }) });
    if(!r.ok){ saveSession(null); throw new Error('Session expired. Sign in again.'); }
    s = toSession(await r.json()); saveSession(s); return s.access_token;
  }
  const authH = async extra => ({ apikey: SB_KEY, Authorization: `Bearer ${await getToken()}`, ...extra });
  async function signOut(){
    const s = readSession(); saveSession(null);
    if(s){ try{ await fetch(`${SB_URL}/auth/v1/logout`, { method: 'POST', headers: { apikey: SB_KEY, Authorization: `Bearer ${s.access_token}` } }); }catch(e){} }
  }

  /* Writes ask for the changed rows back. Row-level security answers "not allowed" with an empty list, so empty means refused. */
  async function sbWrite(method, t, q, b){
    const r = await fetch(`${SB_URL}/rest/v1/${t}${q ? '?' + q : ''}`, { method, headers: await authH({ 'Content-Type': 'application/json', Prefer: 'return=representation' }), body: b ? JSON.stringify(b) : undefined });
    if(!r.ok) throw new Error(await readErr(r));
    const rows = await r.json();
    if(!rows.length) throw new Error('Nothing was changed. Your account may not be allowed to edit this.');
    return rows;
  }
  const sbPatch = (t, q, b) => sbWrite('PATCH', t, q, b);
  const sbPost = (t, b) => sbWrite('POST', t, '', b);
  const sbDelete = (t, q) => sbWrite('DELETE', t, q);
  async function uploadFile(blob, path){
    const res = await fetch(`${SB_URL}/storage/v1/object/${BUCKET}/${path}`, { method: 'POST', headers: await authH({ 'Content-Type': blob.type || 'application/octet-stream' }), body: blob });
    if(!res.ok) throw new Error(await readErr(res));
    return `${SB_URL}/storage/v1/object/public/${BUCKET}/${path}?t=${Date.now()}`;
  }

  /* resize and compress before upload */
  function compressImage(file, { maxW = 1400, maxH = 1400, quality = 0.82, maxKB = 600 } = {}){
    return new Promise(resolve => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width: w, height: h } = img;
        const ratio = Math.min(1, maxW / w, maxH / h);
        w = Math.round(w * ratio); h = Math.round(h * ratio);
        const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        let q = quality;
        const attempt = () => canvas.toBlob(blob => {
          if(!blob){ resolve(file); return; }
          if(blob.size > maxKB * 1024 && q > 0.4){ q -= 0.08; attempt(); return; }
          const jpeg = file.type !== 'image/png';
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, '') + '_opt.' + (jpeg ? 'jpg' : 'png'), { type: jpeg ? 'image/jpeg' : 'image/png' }));
        }, file.type === 'image/png' ? 'image/png' : 'image/jpeg', q);
        attempt();
      };
      img.onerror = () => resolve(file);
      img.src = url;
    });
  }

  /* ────────── markup (static, no data in it) ────────── */
  document.body.insertAdjacentHTML('beforeend', `
<div id="pw-gate" role="dialog" aria-modal="true" aria-label="Editor sign in">
  <div class="pw-logo">SANTAI</div>
  <div class="pw-sub">CMS: Editor Access</div>
  <input class="pw-field" id="pw-email" type="email" placeholder="Email" aria-label="Email" autocomplete="username"/>
  <input class="pw-field" id="pw-input" type="password" placeholder="Password" aria-label="Password" autocomplete="current-password"/>
  <button class="pw-btn" id="pw-submit" type="button">SIGN IN</button>
  <div class="pw-err" id="pw-err" role="alert">Incorrect email or password</div>
</div>
<div id="cms-overlay" role="dialog" aria-modal="true" aria-label="Editor">
  <div id="cms-backdrop"></div>
  <div id="cms-panel">
    <div class="cms-hdr">
      <div class="cms-ttl">SANTAI CMS</div>
      <button class="ghost-btn cms-signout" id="cms-signout" type="button">Sign out</button>
      <button class="cms-x" id="cms-x" type="button" aria-label="Close editor">✕</button>
    </div>

    <div class="cms-sec">
      <div class="cms-sec-lbl">Shop settings</div>
      <p class="cms-note" id="shop-note" hidden>Shop details need one extra step: run <code>supabase/shop-fields.sql</code> in the Supabase SQL editor, then reload this page.</p>
      <div class="cms-fld"><label for="g-wa">WhatsApp number for orders (country code, digits only)</label><input type="text" id="g-wa" inputmode="numeric" placeholder="62812XXXXXXX"/><div class="compress-note">Without a number, orders go to Instagram instead.</div></div>
      <div class="cms-fld"><label for="g-ship">Shipping</label><textarea id="g-ship" rows="3"></textarea></div>
      <div class="cms-fld"><label for="g-ret">Returns</label><textarea id="g-ret" rows="3"></textarea></div>
    </div>

    <div class="cms-sec">
      <div class="cms-sec-lbl">Global settings</div>
      <div class="cms-fld">
        <label for="f-logo">Site logo (replaces the text wordmark)</label>
        <label class="up-btn">↑ Upload Logo<input type="file" id="f-logo" accept="image/*"></label>
        <div class="compress-note">Auto-compressed to ≤200KB on upload</div>
        <img class="prev-thumb" id="pv-logo" alt=""/>
        <button class="ghost-btn" id="remove-logo-btn" type="button">✕ Remove Logo, Use Text</button>
      </div>
      <div class="cms-fld"><label for="g-ig-url">Instagram URL</label><input type="text" id="g-ig-url" placeholder="https://instagram.com/santai.memorabilia"/></div>
      <div class="cms-fld"><label for="g-ticker">Running text (separate with |)</label><textarea id="g-ticker" rows="3"></textarea></div>
      <div class="cms-fld">
        <label for="g-size-chart">Size chart (one per line: S,chest,length,shoulder)</label>
        <textarea id="g-size-chart" rows="6" placeholder="S,104,72,48&#10;M,110,75,51&#10;L,116,78,54&#10;XL,122,81,57"></textarea>
        <div class="compress-note">Shown on the size chart page, and used for any shirt without its own sizes.</div>
      </div>
    </div>

    <div class="cms-sec">
      <div class="cms-sec-lbl">Change CMS password</div>
      <div class="pw-row">
        <div class="cms-fld"><label for="g-new-pw">New password (10+ characters)</label><input type="password" id="g-new-pw" autocomplete="new-password"/></div>
        <button class="pw-change-btn" id="change-pw-btn" type="button">Update</button>
      </div>
    </div>

    <div class="cms-sec">
      <div class="cms-sec-lbl">Shirts (use the arrows to reorder)</div>
      <div class="art-sort-row" id="artTabs"></div>
      <button class="add-art-btn" id="addArtBtn" type="button">+ Add Shirt</button>
      <div id="artEditor">
        <div class="cms-fld"><label for="a-name">Shirt name</label><input type="text" id="a-name"/></div>
        <div class="cms-fld"><label for="a-sub">Subtitle</label><input type="text" id="a-sub"/></div>
        <div class="cms-fld"><label for="a-avail">Availability</label>
          <select id="a-avail" class="cms-select"><option value="Available Now">Available Now</option><option value="Running Low">Running Low</option><option value="Sold Out">Sold Out</option></select>
        </div>
        <div class="cms-fld"><label for="a-price">Price (as customers should read it)</label><input type="text" id="a-price" placeholder="IDR 350,000"/></div>
        <div class="cms-fld"><label for="a-fabric">Fabric</label><input type="text" id="a-fabric"/></div>
        <div class="cms-fld"><label for="a-fit">Fit</label><input type="text" id="a-fit"/></div>
        <div class="cms-fld"><label for="a-story">Story or release notes</label><textarea id="a-story" rows="4"></textarea></div>
        <div class="cms-fld"><label for="a-desc">Short description (shown if there is no story)</label><textarea id="a-desc" rows="3"></textarea></div>
        <div class="cms-fld">
          <label for="f-shirt">Shirt image (front)</label>
          <label class="up-btn">↑ Upload Shirt Image<input type="file" id="f-shirt" accept="image/*"></label>
          <div class="compress-note">Auto-compressed to ≤600KB, max 1400px on upload</div>
          <img class="prev-thumb" id="pv-shirt" alt=""/>
        </div>
        <div class="cms-fld">
          <label for="f-shirt-back">Shirt image (back), shown when the shirt turns</label>
          <label class="up-btn">↑ Upload Back of Shirt<input type="file" id="f-shirt-back" accept="image/*"></label>
          <img class="prev-thumb" id="pv-shirt-back" alt=""/>
        </div>
        <div class="cms-fld">
          <label for="f-gallery">Photos (on-body, details). They show in a strip under the shirt.</label>
          <label class="up-btn">↑ Add Photos<input type="file" id="f-gallery" accept="image/*" multiple></label>
          <div class="compress-note">Each photo is compressed to ≤700KB. Photos upload when you save.</div>
          <div class="gal-thumbs" id="galThumbs"></div>
        </div>
        <div class="cms-fld">
          <label for="f-audio">Hold audio (loops while someone holds the shirt)</label>
          <label class="up-btn">↑ Upload Audio File (mp3/ogg)<input type="file" id="f-audio" accept="audio/*"></label>
          <div class="compress-note" id="audio-note"></div>
        </div>
        <div class="cms-fld">
          <label for="f-hold-bg">Hold background image</label>
          <label class="up-btn">↑ Upload Hold Background<input type="file" id="f-hold-bg" accept="image/*"></label>
          <img class="prev-thumb" id="pv-hold-bg" alt=""/>
        </div>
        <div class="cms-fld"><label for="a-hold-color">Hold background colour (fallback, e.g. #1a1a2e)</label><input type="text" id="a-hold-color" placeholder="#1a1a2e"/></div>
        <div class="cms-fld"><label for="a-sizes">Sizes (one per line: S,chest,length,shoulder)</label><textarea id="a-sizes" rows="4"></textarea></div>
        <button class="save-btn" id="saveBtn" type="button">SAVE ALL CHANGES</button>
        <div class="save-confirm" id="save-confirm">✓ Saved. Live for everyone</div>
        <div class="save-err" id="save-err"></div>
        <button class="del-art-btn" id="delArtBtn" type="button">✕ Delete This Shirt</button>
      </div>
    </div>
  </div>
</div>`);

  const gate = $('#pw-gate'), ov = $('#cms-overlay');
  let cmsIdx = 0;
  let pending = { logo: null, shirtImg: null, shirtBack: null, holdBg: null, audio: null };
  let galItems = []; // { url } already saved, or { file, preview } waiting to upload
  const hasExtra = () => A().length > 0 && 'extra' in A()[0];
  const hasShop = () => 'shop' in G();
  const show = (el, on) => { el.classList.toggle('open', on); };

  /* ────────── route: gate, or straight to the editor if this tab is already signed in ────────── */
  function route(){
    if(location.hash !== '#CMSedit'){ show(gate, false); show(ov, false); return; }
    if(Santai.loaded && readSession()){ show(gate, false); openCMS(); return; }
    show(gate, true); $('#pw-email').focus();
  }
  addEventListener('hashchange', route);
  Santai.onChange.push(() => { if(ov.classList.contains('open')) return; if(location.hash === '#CMSedit') route(); });
  addEventListener('keydown', e => {
    if(e.key !== 'Escape') return;
    if(ov.classList.contains('open')) closeCMS();
    else if(gate.classList.contains('open')) location.hash = '';
  });

  async function tryLogin(){
    const email = $('#pw-email').value.trim(), pw = $('#pw-input').value, btn = $('#pw-submit'), err = $('#pw-err');
    btn.disabled = true;
    try{
      await signIn(email, pw);
      show(gate, false); $('#pw-email').value = ''; $('#pw-input').value = ''; err.classList.remove('show');
      openCMS();
    }catch(e){
      err.classList.add('show'); $('#pw-input').value = '';
      setTimeout(() => err.classList.remove('show'), 3000);
    }finally{ btn.disabled = false; }
  }
  $('#pw-submit').addEventListener('click', tryLogin);
  ['pw-email', 'pw-input'].forEach(id => $('#' + id).addEventListener('keydown', e => { if(e.key === 'Enter') tryLogin(); }));

  /* ────────── editor ────────── */
  function setPreview(img, url){ const u = safeUrl(url); if(u){ img.src = u; img.classList.add('show'); } else { img.removeAttribute('src'); img.classList.remove('show'); } }

  function openCMS(){
    pending = { logo: null, shirtImg: null, shirtBack: null, holdBg: null, audio: null };
    show(ov, true);
    const g = G(), shop = shopOf(g);
    $('#g-ig-url').value = g.ig_url || '';
    $('#g-ticker').value = g.ticker || '';
    $('#g-size-chart').value = g.size_chart || '';
    $('#g-new-pw').value = '';
    $('#g-wa').value = shop.whatsapp || ''; $('#g-ship').value = shop.shipping || ''; $('#g-ret').value = shop.returns || '';
    const shopOk = hasShop();
    $('#shop-note').hidden = shopOk;
    ['g-wa', 'g-ship', 'g-ret'].forEach(id => { $('#' + id).disabled = !shopOk; });
    setPreview($('#pv-logo'), g.logo_img);
    if(cmsIdx >= A().length) cmsIdx = Math.max(0, A().length - 1);
    renderTabs(); loadEditor(cmsIdx);
    $('#cms-x').focus();
  }
  function closeCMS(){ show(ov, false); location.hash = ''; }
  $('#cms-x').addEventListener('click', closeCMS);
  $('#cms-backdrop').addEventListener('click', closeCMS);
  $('#cms-signout').addEventListener('click', async () => { await signOut(); closeCMS(); });

  function renderTabs(){
    const el = $('#artTabs'); el.textContent = '';
    A().forEach((art, i) => {
      const item = document.createElement('div'); item.className = 'art-sort-item';
      const lbl = document.createElement('button'); lbl.type = 'button';
      lbl.className = 'art-sort-label' + (i === cmsIdx ? ' active' : '');
      lbl.textContent = `#${i + 1} ${art.name || 'Untitled'}`;
      lbl.addEventListener('click', () => { cmsIdx = i; pending.shirtImg = pending.shirtBack = pending.holdBg = pending.audio = null; renderTabs(); loadEditor(i); });
      const up = document.createElement('button'); up.type = 'button'; up.className = 'sort-btn'; up.textContent = '↑'; up.disabled = i === 0; up.setAttribute('aria-label', 'Move up');
      up.addEventListener('click', () => moveArticle(i, -1));
      const dn = document.createElement('button'); dn.type = 'button'; dn.className = 'sort-btn'; dn.textContent = '↓'; dn.disabled = i === A().length - 1; dn.setAttribute('aria-label', 'Move down');
      dn.addEventListener('click', () => moveArticle(i, 1));
      item.append(lbl, up, dn); el.append(item);
    });
  }
  async function moveArticle(idx, dir){
    const sw = idx + dir, a = A();
    if(sw < 0 || sw >= a.length) return;
    [a[idx], a[sw]] = [a[sw], a[idx]];
    a.forEach((x, i) => { x.sort_order = i; });
    if(cmsIdx === idx) cmsIdx = sw; else if(cmsIdx === sw) cmsIdx = idx;
    renderTabs(); loadEditor(cmsIdx); Santai.render();
    try{ await Promise.all(a.map((x, i) => sbPatch('santai_articles', `id=eq.${x.id}`, { sort_order: i }))); cache(); }
    catch(e){ console.warn('Sort save error:', e); }
  }
  function cache(){ try{ localStorage.setItem(CACHE_KEY, JSON.stringify(Santai.state)); }catch(e){} }

  function renderGallery(){
    const box = $('#galThumbs'); box.textContent = '';
    galItems.forEach((it, i) => {
      const wrap = document.createElement('div'); wrap.className = 'gal-thumb';
      const img = document.createElement('img'); img.alt = ''; img.src = it.preview || safeUrl(it.url);
      const rm = document.createElement('button'); rm.type = 'button'; rm.textContent = '✕'; rm.setAttribute('aria-label', `Remove photo ${i + 1}`);
      rm.addEventListener('click', () => { galItems.splice(i, 1); renderGallery(); });
      wrap.append(img, rm); box.append(wrap);
    });
  }

  function loadEditor(i){
    const a = A()[i]; if(!a) return;
    const ex = extraOf(a), ok = hasExtra();
    $('#a-name').value = a.name || ''; $('#a-sub').value = a.sub || ''; $('#a-desc').value = a.description || '';
    $('#a-hold-color').value = a.hold_color || '';
    $('#a-sizes').value = a.sizes || 'S,104,72,48\nM,110,75,51\nL,116,78,54\nXL,122,81,57';
    $('#a-avail').value = a.avail_status || 'Available Now';
    $('#a-price').value = ex.price || ''; $('#a-fabric').value = ex.fabric || ''; $('#a-fit').value = ex.fit || ''; $('#a-story').value = ex.story || '';
    ['a-price', 'a-fabric', 'a-fit', 'a-story', 'f-gallery'].forEach(id => { $('#' + id).disabled = !ok; });
    galItems = (Array.isArray(ex.gallery) ? ex.gallery : []).filter(safeUrl).map(url => ({ url }));
    renderGallery();
    setPreview($('#pv-shirt'), a.shirt_img); setPreview($('#pv-shirt-back'), a.shirt_back_img); setPreview($('#pv-hold-bg'), a.hold_bg);
    $('#audio-note').textContent = a.audio_url ? '✓ Audio file uploaded' : 'No audio set';
  }

  async function pick(file, key, previewId, opts){
    const p = $('#' + previewId); p.src = URL.createObjectURL(file); p.classList.add('show');
    pending[key] = await compressImage(file, opts);
  }
  $('#f-logo').addEventListener('change', e => { const f = e.target.files[0]; if(f) pick(f, 'logo', 'pv-logo', { maxW: 600, maxH: 300, quality: .85, maxKB: 200 }); });
  $('#f-shirt').addEventListener('change', e => { const f = e.target.files[0]; if(f) pick(f, 'shirtImg', 'pv-shirt', { maxW: 1400, maxH: 1800, quality: .84, maxKB: 600 }); });
  $('#f-shirt-back').addEventListener('change', e => { const f = e.target.files[0]; if(f) pick(f, 'shirtBack', 'pv-shirt-back', { maxW: 1400, maxH: 1800, quality: .84, maxKB: 600 }); });
  $('#f-hold-bg').addEventListener('change', e => { const f = e.target.files[0]; if(f) pick(f, 'holdBg', 'pv-hold-bg', { maxW: 2400, maxH: 1600, quality: .8, maxKB: 800 }); });
  $('#f-audio').addEventListener('change', e => {
    const f = e.target.files[0]; if(!f) return;
    pending.audio = f; $('#audio-note').textContent = `✓ ${f.name} (${(f.size / 1024).toFixed(0)}KB), will upload on save`;
  });
  $('#f-gallery').addEventListener('change', async e => {
    const files = [...e.target.files]; e.target.value = '';
    for(const f of files){
      const c = await compressImage(f, { maxW: 1800, maxH: 2250, quality: .84, maxKB: 700 });
      galItems.push({ file: c, preview: URL.createObjectURL(c) });
    }
    renderGallery();
  });
  $('#remove-logo-btn').addEventListener('click', () => { pending.logo = '__remove__'; setPreview($('#pv-logo'), ''); });

  $('#addArtBtn').addEventListener('click', async () => {
    try{
      const rows = await sbPost('santai_articles', { sort_order: A().length, name: 'New Shirt', sub: '', description: '', shirt_img: null, hold_bg: null, hold_color: '#111', sizes: 'S,104,72,48\nM,110,75,51\nL,116,78,54\nXL,122,81,57', avail_status: 'Available Now' });
      A().push(rows[0]); cmsIdx = A().length - 1; renderTabs(); loadEditor(cmsIdx); Santai.render();
    }catch(e){ alert('Error: ' + e.message); }
  });
  $('#delArtBtn').addEventListener('click', async () => {
    if(A().length <= 1){ alert('Keep at least one shirt.'); return; }
    if(!confirm(`Delete "${A()[cmsIdx].name}"?`)) return;
    try{
      await sbDelete('santai_articles', `id=eq.${A()[cmsIdx].id}`);
      A().splice(cmsIdx, 1); cmsIdx = Math.max(0, cmsIdx - 1);
      renderTabs(); loadEditor(cmsIdx); Santai.render(); cache();
    }catch(e){ alert('Error: ' + e.message); }
  });

  $('#change-pw-btn').addEventListener('click', async () => {
    const np = $('#g-new-pw').value;
    if(np.length < 10){ alert('Use at least 10 characters.'); return; }
    try{
      const r = await fetch(`${SB_URL}/auth/v1/user`, { method: 'PUT', headers: await authH({ 'Content-Type': 'application/json' }), body: JSON.stringify({ password: np }) });
      if(!r.ok) throw new Error(await readErr(r));
      $('#g-new-pw').value = ''; alert('Password updated.');
    }catch(e){ alert('Error: ' + e.message); }
  });

  /* ────────── save ────────── */
  $('#saveBtn').addEventListener('click', async () => {
    const btn = $('#saveBtn'), conf = $('#save-confirm'), errEl = $('#save-err');
    btn.disabled = true; btn.textContent = 'Saving…'; conf.classList.remove('show'); errEl.classList.remove('show');
    try{
      const art = A()[cmsIdx], g = G(), t = Date.now();
      const ext = f => { const e = (f.name.split('.').pop() || '').toLowerCase(); return /^[a-z0-9]{1,5}$/.test(e) ? e : 'bin'; };
      let logo = g.logo_img || null, shirt = art.shirt_img || null, shirtBack = art.shirt_back_img || null, holdBg = art.hold_bg || null, audio = art.audio_url || null;

      if(pending.logo === '__remove__') logo = null;
      else if(pending.logo) logo = await uploadFile(pending.logo, `logo_${t}.${ext(pending.logo)}`);
      if(pending.shirtImg) shirt = await uploadFile(pending.shirtImg, `shirt_${art.id}_${t}.${ext(pending.shirtImg)}`);
      if(pending.shirtBack) shirtBack = await uploadFile(pending.shirtBack, `shirtback_${art.id}_${t}.${ext(pending.shirtBack)}`);
      if(pending.holdBg) holdBg = await uploadFile(pending.holdBg, `holdbg_${art.id}_${t}.${ext(pending.holdBg)}`);
      if(pending.audio) audio = await uploadFile(pending.audio, `audio_${art.id}_${t}.${ext(pending.audio)}`);

      const gallery = [];
      for(const [k, it] of galItems.entries()){ gallery.push(it.file ? await uploadFile(it.file, `gallery_${art.id}_${t}_${k}.${ext(it.file)}`) : it.url); }

      const ng = { ticker: $('#g-ticker').value, ig_url: $('#g-ig-url').value, size_chart: $('#g-size-chart').value, logo_img: logo };
      if(hasShop()) ng.shop = { ...shopOf(g), whatsapp: $('#g-wa').value.replace(/\D/g, ''), shipping: $('#g-ship').value.trim(), returns: $('#g-ret').value.trim() };
      await sbPatch('santai_global', 'id=eq.1', ng);
      Santai.state.g = { ...g, ...ng };

      const na = { name: $('#a-name').value, sub: $('#a-sub').value, description: $('#a-desc').value, hold_color: $('#a-hold-color').value, sizes: $('#a-sizes').value, avail_status: $('#a-avail').value, shirt_img: shirt, shirt_back_img: shirtBack, hold_bg: holdBg, audio_url: audio };
      if(hasExtra()) na.extra = { ...extraOf(art), price: $('#a-price').value.trim(), fabric: $('#a-fabric').value.trim(), fit: $('#a-fit').value.trim(), story: $('#a-story').value.trim(), gallery };
      await sbPatch('santai_articles', `id=eq.${art.id}`, na);
      A()[cmsIdx] = { ...art, ...na };

      pending = { logo: null, shirtImg: null, shirtBack: null, holdBg: null, audio: null };
      cache(); Santai.render(); renderTabs(); loadEditor(cmsIdx);
      btn.textContent = 'SAVE ALL CHANGES'; btn.disabled = false;
      conf.classList.add('show'); setTimeout(() => conf.classList.remove('show'), 3000);
    }catch(e){
      console.error(e);
      btn.textContent = 'SAVE ALL CHANGES'; btn.disabled = false;
      errEl.textContent = 'Error: ' + e.message; errEl.classList.add('show');
      setTimeout(() => errEl.classList.remove('show'), 6000);
    }
  });

  window.SantaiCMS = { route };
  route();
})();
