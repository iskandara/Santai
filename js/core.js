'use strict';
/* Shared by the storefront and the editor: constants, safe-output helpers, and read-only data access.
   Everything that writes lives in cms.js, which only loads on /#CMSedit. */

const SB_URL = 'https://iddwjrusnkvblezkrqjz.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkZHdqcnVzbmt2YmxlemtycWp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NDg2NTYsImV4cCI6MjA4OTQyNDY1Nn0.Z_5QInMfYMbOY8HRz9omb-3LBKS4bU3V6q_-ESbgQW4';
const BUCKET = 'santai-assets';
const DEFAULT_IG_URL = 'https://instagram.com/santai.memorabilia';
const CACHE_KEY = 'santai_cache_v2';

const Santai = {
  state: { g: {}, a: [] },
  loaded: false,
  onChange: [],       // called with ('cache' | 'fresh') whenever data is applied
};

/* Anything from the database is text, never markup. Only https URLs may reach src, href and url(). */
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function safeUrl(u){ try{ const x = new URL(String(u || '')); return x.protocol === 'https:' ? x.href : ''; }catch(e){ return ''; } }

const H = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' };
async function readErr(r){ try{ const j = await r.json(); return String(j.message || j.msg || j.error_description || j.error || r.statusText).slice(0, 200); }catch(e){ return r.statusText || ('HTTP ' + r.status); } }
async function sbGet(t, q = ''){ const r = await fetch(`${SB_URL}/rest/v1/${t}?${q}`, { headers: H }); if(!r.ok) throw new Error(await readErr(r)); return r.json(); }

/* Size lines look like "M,110,75,51": size, chest, length, shoulder (cm). */
function parseSizes(s){
  if(!s || !String(s).trim()) return [];
  return String(s).trim().split('\n').filter(Boolean).map(l => {
    const [size, chest, length, shoulder] = l.split(',').map(x => x.trim());
    return { size, chest, length, shoulder };
  }).filter(r => r.size);
}

/* Optional fields added by supabase/shop-fields.sql. Absent columns never break anything. */
const extraOf = a => (a && a.extra && typeof a.extra === 'object') ? a.extra : {};
const shopOf = g => (g && g.shop && typeof g.shop === 'object') ? g.shop : {};

/* Stale-while-revalidate: show cached data at once, then refresh from Supabase. */
async function loadData(){
  try{
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if(cached && cached.a){ Santai.state = { g: cached.g || {}, a: cached.a }; Santai.loaded = true; Santai.onChange.forEach(f => f('cache')); }
  }catch(e){}
  try{
    const [g, a] = await Promise.all([ sbGet('santai_global', 'id=eq.1'), sbGet('santai_articles', 'order=sort_order.asc') ]);
    const next = { g: g[0] || {}, a: a || [] };
    const changed = JSON.stringify(next) !== JSON.stringify(Santai.state) || !Santai.loaded;
    Santai.state = next; Santai.loaded = true;
    try{ localStorage.setItem(CACHE_KEY, JSON.stringify(next)); }catch(e){}
    if(changed) Santai.onChange.forEach(f => f('fresh'));
    return 'ok';
  }catch(e){
    console.warn('Supabase fetch error:', e);
    return Santai.loaded ? 'stale' : 'error';
  }
}

// Web fonts load without blocking the first paint (no inline handler, so the page can ban inline scripts)
document.querySelectorAll('link[data-async-css]').forEach(l => { l.media = 'all'; });
