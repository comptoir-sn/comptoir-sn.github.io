
/* ===================== Marque ===================== */
const PH = (id, w=900) => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}`;
const PHOTOS = {
  hero:{src:PH(5999878,1200), credit:'Ono Kosuki', page:'https://www.pexels.com/photo/focused-woman-messaging-on-smartphone-5999878/'},
  moto:{src:PH(6867941,1200), credit:'Kindel Media', page:'https://www.pexels.com/photo/man-in-orange-shirt-riding-on-a-motorbike-making-a-delivery-6867941/'},
};
/* Logo officiel : bulle de message qui dessine un C, pastille safran au centre */
function logoSVG(size=34, onDark=false){
  const tile = onDark ? '#FFFFFF' : '#14213D', mark = onDark ? '#14213D' : '#FFFFFF';
  return `<svg width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true">
    <rect width="48" height="48" rx="12" fill="${tile}"/>
    <g transform="translate(24 24) scale(.74) translate(-24 -23)">
      <path d="M33.81 30.39A11.5 11.5 0 1 1 33.81 15.61" fill="none" stroke="${mark}" stroke-width="7.2" stroke-linecap="round"/>
      <path d="M15.2 29.5L11.6 41.2L21.8 34.6Z" fill="${mark}" stroke="${mark}" stroke-width="2" stroke-linejoin="round"/>
      <circle cx="24.6" cy="23" r="4.7" fill="#FF7A1A"/>
    </g></svg>`;
}
function wordmark(){ return `<span class="word wm">compto<span class="wi">ı<i></i></span>r</span>`; }
function logo(light=false, size=34){ return `<span class="logo ${light?'light':''}" aria-label="comptoir">${logoSVG(size, light)}${wordmark()}</span>`; }

/* ===================== Données (en ligne, base Supabase) ===================== */
const CFG = window.COMPTOIR_CONFIG || {};
const VER = '1';
const STATUS = {
  nouvelle:{label:'À confirmer', cls:'s-nouvelle'},
  confirmee:{label:'Confirmée', cls:'s-confirmee'},
  livraison:{label:'En livraison', cls:'s-livraison'},
  livree:{label:'Livrée', cls:'s-livree'},
  refusee:{label:'Refusée', cls:'s-refusee'},
  annulee:{label:'Annulée', cls:'s-annulee'}
};
const MODES = {wave:'Wave', om:'Orange Money', cash:'Cash'};
let S = null, sb = null, SHOP_ID = null, USER = null;
let SNAP = {shop:'', products:{}, drivers:{}, orders:{}, remits:new Set()};
function uid(){
  try{ if(window.crypto && crypto.randomUUID) return crypto.randomUUID(); }catch(e){}
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c=>{ const r = Math.random()*16|0; return (c==='x' ? r : (r&3|8)).toString(16); });
}

/* Passage ligne de la base <-> objet de l'appli */
const EXTRA_KEYS = ['preorder','delay','desc','imgs','badge','oldPrice','freeShipping'];
function prodFromRow(r){
  const x = r.extra || {};
  const p = {id:r.id, name:r.name, price:r.price||0, stock:r.stock||0, min:r.min||0, kw:Array.isArray(r.kw)?r.kw:[], img:r.img||'', archived:r.active===false, sort:r.sort||0};
  EXTRA_KEYS.forEach(k=>{ if(x[k]!==undefined && x[k]!==null) p[k] = x[k]; });
  return p;
}
function prodToRow(p){
  const extra = {};
  EXTRA_KEYS.forEach(k=>{ if(p[k]!==undefined && p[k]!==null && p[k]!=='') extra[k] = p[k]; });
  return {id:p.id, shop_id:SHOP_ID, name:String(p.name||'').slice(0,80), price:Math.max(0,Math.round(Number(p.price)||0)), stock:Math.max(0,Math.round(Number(p.stock)||0)),
    min:Math.max(0,Math.round(Number(p.min)||0)), kw:p.kw||[], img:p.img||'', active:!p.archived, sort:p.sort||0, extra};
}
function drvFromRow(r){ return {id:r.id, name:r.name, phone:r.phone||'', cash:r.cash||0, remits:[]}; }
function drvToRow(d){ return {id:d.id, shop_id:SHOP_ID, name:String(d.name||'').slice(0,60), phone:d.phone||'', cash:Math.max(0,Math.round(d.cash||0))}; }
function ordFromRow(r){
  return {id:r.id, num:r.num, createdAt:Date.parse(r.created_at)||Date.now(), client:{name:r.client_name||'', phone:r.client_phone||''}, zoneId:r.zone_id||'', address:r.address||'',
    items:Array.isArray(r.items)?r.items:[], fee:r.fee||0, feeNote:r.fee_note||'', deposit:r.deposit||{amount:0,mode:'',at:null}, day:r.day||'', status:r.status,
    driverId:r.driver_id||null, pay:r.pay||null, stockOut:!!r.stock_out, note:r.note||'', source:r.source||'whatsapp', payState:r.pay_state||'cod', payMode:r.pay_mode||'cash',
    unread:!!r.unread, alert:r.alert||null, history:Array.isArray(r.history)?r.history:[]};
}
function ordToRow(o){
  return {id:o.id, shop_id:SHOP_ID, created_at:new Date(o.createdAt).toISOString(), client_name:o.client.name||'', client_phone:o.client.phone||'', zone_id:o.zoneId||'',
    address:o.address||'', items:o.items, fee:Math.max(0,Math.round(o.fee||0)), fee_note:o.feeNote||'', deposit:o.deposit||{amount:0,mode:'',at:null}, day:o.day||'',
    status:o.status, driver_id:o.driverId||null, pay:o.pay||null, stock_out:!!o.stockOut, note:o.note||'', source:o.source||'whatsapp',
    pay_state:o.payState||'cod', pay_mode:o.payMode||'cash', unread:!!o.unread, alert:o.alert||null, history:o.history||[]};
}
function shopFromRow(r){ return {id:r.id, slug:r.slug, name:r.name, desc:r.descr||'', whatsapp:r.whatsapp||'', wave:r.wave||'', om:r.om||'', open:r.open!==false}; }
function shopToRow(){ return {name:S.shop.name, descr:S.shop.desc||'', whatsapp:S.shop.whatsapp||'', wave:S.shop.wave||'', om:S.shop.om||'', open:S.shop.open!==false, zones:S.zones}; }
const snapOf = {products:p=>JSON.stringify(prodToRow(p)), drivers:d=>JSON.stringify(drvToRow(d)), orders:o=>JSON.stringify(ordToRow(o))};

/* Chargement de toute la boutique de la personne connectée */
async function loadAll(){
  const {data:shop, error} = await sb.from('shops').select('*').eq('owner', USER.id).maybeSingle();
  if(error) throw error;
  if(!shop) return null;
  SHOP_ID = shop.id;
  const res = await Promise.all([
    sb.from('products').select('*').eq('shop_id', SHOP_ID).order('sort').order('created_at'),
    sb.from('drivers').select('*').eq('shop_id', SHOP_ID).order('created_at'),
    sb.from('orders').select('*').eq('shop_id', SHOP_ID).order('created_at', {ascending:false}).limit(1000),
    sb.from('remits').select('*').eq('shop_id', SHOP_ID).order('created_at', {ascending:false}).limit(1000)
  ]);
  for(const x of res) if(x.error) throw x.error;
  const [p, d, o, r] = res.map(x=>x.data||[]);
  S = {shop:shopFromRow(shop), zones:Array.isArray(shop.zones)?shop.zones:[], products:p.map(prodFromRow), drivers:d.map(drvFromRow), orders:o.map(ordFromRow),
    remitsLog:r.map(x=>({id:x.id, t:Date.parse(x.created_at), amount:x.amount, driverId:x.driver_id}))};
  SNAP = {shop:JSON.stringify(shopToRow()), products:{}, drivers:{}, orders:{}, remits:new Set(S.remitsLog.map(x=>x.id))};
  for(const t of ['products','drivers','orders']) S[t].forEach(x=>{ SNAP[t][x.id] = snapOf[t](x); });
  return S;
}

/* Enregistrement : on envoie seulement ce qui a changé, 0,3 s après le dernier geste */
let flushTimer = null, flushing = null, flushAgain = false, pending = false, lastSyncWarn = 0;
function save(){
  if(!S || STORE || !SHOP_ID) return true;
  pending = true; clearTimeout(flushTimer); flushTimer = setTimeout(()=>flush(), 300);
  return true;
}
async function flush(){
  if(!S || STORE || !SHOP_ID) return true;
  if(flushing){ flushAgain = true; return flushing; }
  clearTimeout(flushTimer);
  flushing = (async()=>{
    try{
      const sh = JSON.stringify(shopToRow());
      if(sh !== SNAP.shop){ const {error} = await sb.from('shops').update(JSON.parse(sh)).eq('id', SHOP_ID); if(error) throw error; SNAP.shop = sh; }
      for(const t of ['products','drivers']){
        const rows = [], snaps = {};
        S[t].forEach(x=>{ const s = snapOf[t](x); if(SNAP[t][x.id] !== s){ rows.push(JSON.parse(s)); snaps[x.id] = s; } });
        if(rows.length){ const {error} = await sb.from(t).upsert(rows); if(error) throw error; Object.assign(SNAP[t], snaps); }
      }
      /* Commandes : création à part (la base donne le numéro), puis mises à jour une par une */
      const fresh = S.orders.filter(o=>SNAP.orders[o.id] === undefined);
      if(fresh.length){
        const rows = fresh.map(ordToRow), snaps = fresh.map(o=>snapOf.orders(o));
        const {data, error} = await sb.from('orders').insert(rows).select('id,num');
        if(error) throw error;
        fresh.forEach((o,i)=>{ SNAP.orders[o.id] = snaps[i]; });
        (data||[]).forEach(r=>{ const o = S.orders.find(x=>x.id===r.id); if(o) o.num = r.num; });
      }
      for(const o of S.orders){
        const s = snapOf.orders(o);
        if(SNAP.orders[o.id] !== undefined && SNAP.orders[o.id] !== s){
          const row = JSON.parse(s); delete row.id; delete row.shop_id;
          const {error} = await sb.from('orders').update(row).eq('id', o.id); if(error) throw error;
          SNAP.orders[o.id] = s;
        }
      }
      const newR = (S.remitsLog||[]).filter(x=>x.id && !SNAP.remits.has(x.id));
      if(newR.length){
        const {error} = await sb.from('remits').insert(newR.map(x=>({id:x.id, shop_id:SHOP_ID, driver_id:x.driverId||null, amount:x.amount, created_at:new Date(x.t).toISOString()})));
        if(error) throw error; newR.forEach(x=>SNAP.remits.add(x.id));
      }
      return true;
    }catch(e){
      console.warn('Synchronisation', e);
      if(Date.now() - lastSyncWarn > 15000){ lastSyncWarn = Date.now(); toast(isNetErr(e) ? 'Pas de réseau : tes changements partent dès qu’il revient.' : errText(e)); }
      return false;
    }
  })();
  const ok = await flushing; flushing = null;
  if(flushAgain){ flushAgain = false; return flush(); }
  pending = !ok;
  if(ok) checkNew();
  return ok;
}
function dirty(t, x){ return SNAP[t][x.id] === undefined || SNAP[t][x.id] !== snapOf[t](x); }

/* Nouvelles commandes de la boutique : temps réel + vérification toutes les 20 s */
let polling = false;
async function poll(){
  if(!S || STORE || !SHOP_ID || polling) return;
  polling = true;
  try{
    if(pending) await flush();
    const {data, error} = await sb.from('orders').select('*').eq('shop_id', SHOP_ID).order('created_at', {ascending:false}).limit(1000);
    if(error) return;
    let changed = false;
    (data||[]).forEach(r=>{
      const remote = ordFromRow(r), rs = snapOf.orders(remote);
      const local = S.orders.find(o=>o.id===r.id);
      if(!local){ S.orders.push(remote); SNAP.orders[r.id] = rs; changed = true; return; }
      if(dirty('orders', local)) return;
      if(rs !== SNAP.orders[r.id] || local.num !== remote.num){ Object.assign(local, remote); SNAP.orders[r.id] = rs; changed = true; }
    });
    if(changed){ render(); }
    checkNew();
  }catch(e){ console.warn(e); }
  finally{ polling = false; }
}
let rtTimer = null;
function listenRealtime(){
  try{
    sb.channel('commandes-' + SHOP_ID)
      .on('postgres_changes', {event:'*', schema:'public', table:'orders', filter:'shop_id=eq.' + SHOP_ID}, ()=>{ clearTimeout(rtTimer); rtTimer = setTimeout(poll, 400); })
      .subscribe();
  }catch(e){ console.warn(e); }
}

/* Photos : réduites puis envoyées dans le dossier de la boutique */
function toJpegBlob(src, max=1200){
  return new Promise((res, rej)=>{
    const im = new Image();
    im.onload = () => {
      const w0 = im.naturalWidth || im.width || max, h0 = im.naturalHeight || im.height || max;
      const k = Math.min(1, max/Math.max(w0, h0));
      const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(w0*k)); cv.height = Math.max(1, Math.round(h0*k));
      const ctx = cv.getContext('2d'); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0,0,cv.width,cv.height); ctx.drawImage(im,0,0,cv.width,cv.height);
      cv.toBlob(b=> b ? res(b) : rej(new Error('IMAGE_ILLISIBLE')), 'image/jpeg', .82);
    };
    im.onerror = () => rej(new Error('IMAGE_ILLISIBLE'));
    im.src = src;
  });
}
async function uploadPhoto(blob, pid){
  const path = `${SHOP_ID}/${pid}-${Date.now()}-${Math.random().toString(36).slice(2,6)}.jpg`;
  const {error} = await sb.storage.from('photos').upload(path, blob, {contentType:'image/jpeg', cacheControl:'31536000', upsert:false});
  if(error) throw error;
  return sb.storage.from('photos').getPublicUrl(path).data.publicUrl;
}

/* Produits de départ (les 6 produits préparés ensemble), importés une seule fois */
function loadScript(src){ return new Promise((res, rej)=>{ const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = ()=>rej(new Error('Failed to fetch ' + src)); document.head.appendChild(s); }); }
function starterCard(){
  return `<div class="card" style="margin-bottom:12px"><h2>Ta boutique est vide</h2>
    <p class="muted" style="margin-top:0">Ajoute d’un coup les 6 produits préparés ensemble (appareil photo enfant, Fitbit Air, bandeau, console X9, lampe ciel étoilé, et la Trimui archivée), avec leurs photos et descriptions.</p>
    <button class="btn mango block" id="importStarter">Ajouter mes 6 produits</button></div>`;
}
async function importStarter(btn){
  btn.disabled = true; btn.textContent = 'Préparation…';
  try{
    if(!window.COMPTOIR_CATALOGUE) await loadScript('catalogue.js?v=' + VER);
    const cat = window.COMPTOIR_CATALOGUE || [], cache = {};
    let sort = S.products.reduce((a,p)=>Math.max(a, p.sort||0), 0), n = 0;
    for(const c of cat){
      n++; btn.textContent = `Envoi des photos… ${n}/${cat.length}`;
      if(S.products.some(p=>p.name===c.name)) continue;
      const id = uid();
      const up = async src => { if(!src) return ''; if(!/^data:/.test(src)) return src; if(!cache[src]) cache[src] = await uploadPhoto(await toJpegBlob(src), id); return cache[src]; };
      const p = Object.assign({}, c, {id, sort:++sort});
      p.img = await up(c.img);
      if(c.imgs) p.imgs = await Promise.all(c.imgs.map(up));
      S.products.push(p);
    }
    const ok = await flush();
    render(); toast(ok ? 'Tes produits sont en ligne' : 'Produits gardés ici, envoi dès que le réseau revient');
  }catch(e){ console.warn(e); render(); toast(errText(e)); }
}

/* Messages d'erreur en français simple */
function isNetErr(e){ return /Failed to fetch|NetworkError|Load failed|network|fetch/i.test(String(e?.message||e||'')); }
function errText(e){
  const m = String(e?.message || e?.error_description || e?.code || e || '');
  if(e?.code==='weak_password' || /password.*(at least|characters)|weak/i.test(m)) return 'Mot de passe trop court : au moins 8 caractères.';
  if(/Invalid login|invalid_credentials/i.test(m)) return 'Email ou mot de passe incorrect.';
  if(/not confirmed/i.test(m)) return 'Confirme d’abord ton email : ouvre le mail reçu et touche le lien.';
  if(/already registered|already exists|user_already_exists/i.test(m)) return 'Cet email a déjà un compte : connecte-toi.';
  if(/Signups not allowed|signup.*disabled/i.test(m)) return 'Les inscriptions sont fermées sur cette appli.';
  if(/rate limit|too many|over_email_send_rate/i.test(m)) return 'Trop d’essais. Attends quelques minutes puis réessaie.';
  if(/email.*invalid|invalid.*email|validate email/i.test(m)) return 'Cet email n’est pas valide.';
  if(/NUMERO_INVALIDE/.test(m)) return 'Numéro invalide : 9 chiffres commençant par 70, 75, 76, 77 ou 78.';
  if(/NOM_REQUIS/.test(m)) return 'Donne un nom à ta boutique.';
  if(/REFERENCE_REQUISE/.test(m)) return 'Recopie la référence reçue par SMS après le paiement.';
  if(/TROP_DE_DEMANDES/.test(m)) return 'Trop d’essais. Attends un peu puis réessaie.';
  if(/DEJA_TRAITE/.test(m)) return 'Ce paiement a déjà été traité.';
  if(/INTERDIT/.test(m)) return 'Action réservée au patron de Comptoir.';
  if(/IMAGE_ILLISIBLE/.test(m)) return 'Cette image ne peut pas être lue.';
  if(/payload too large|exceeded the maximum|too large/i.test(m)) return 'Photo trop lourde (3 Mo maximum).';
  if(/JWT|session|not authenticated|NON_CONNECTE|refresh token/i.test(m)) return 'Ta session a expiré : reconnecte-toi.';
  if(isNetErr(e)) return 'Pas de connexion internet. Vérifie ton réseau et réessaie.';
  return 'Une erreur est survenue. Réessaie dans un instant.';
}
function clientErr(e){
  const m = String(e?.message || e || '');
  const st = m.match(/STOCK_INSUFFISANT:(.*)/);
  if(st) return `Il n’en reste plus assez pour « ${st[1].trim()} ». Réduisez la quantité.`;
  if(/BOUTIQUE_FERMEE/.test(m)) return 'La boutique ne prend pas de commandes en ce moment.';
  if(/PRODUIT_INDISPONIBLE/.test(m)) return 'Un produit du panier n’est plus disponible. Rechargez la page.';
  if(/TROP_DE_COMMANDES/.test(m)) return 'Trop de commandes en peu de temps. Réessayez dans quelques minutes.';
  if(/NUMERO_INVALIDE/.test(m)) return 'Le numéro doit avoir 9 chiffres et commencer par 70, 75, 76, 77 ou 78.';
  if(/ADRESSE_REQUISE/.test(m)) return 'Indiquez votre adresse ou un repère.';
  if(/NOM_REQUIS/.test(m)) return 'Indiquez votre nom.';
  if(/PANIER/.test(m)) return 'Votre panier est vide.';
  if(/COMMANDE_INTROUVABLE/.test(m)) return 'Commande introuvable.';
  if(isNetErr(e)) return 'Pas de connexion internet. Vérifiez votre réseau et réessayez.';
  return 'Une erreur est survenue. Réessayez dans un instant.';
}

/* ===================== Utilitaires ===================== */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const F = n => Math.round(n||0).toLocaleString('fr-FR') + ' F';
const norm = s => String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[’']/g,' ');
const REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
function feeText(o){ return o.feeNote==='offerte' ? 'offerte' : o.feeNote==='livreur' ? 'tarif du livreur, payé à la livraison' : F(o.fee||0); }
function subtotal(o){ return o.items.reduce((a,i)=>a + i.price*i.qty, 0); }
function total(o){ return subtotal(o) + (o.fee||0); }
function due(o){ return Math.max(0, total(o) - (o.deposit?.amount||0)); }
function product(id){ return S.products.find(p=>p.id===id); }
function zone(id){ return S.zones.find(z=>z.id===id); }
function driver(id){ return S.drivers.find(d=>d.id===id); }
function isToday(t){ return new Date(t).toDateString()===new Date().toDateString(); }
function ago(t){
  const m = Math.round((Date.now()-t)/60000);
  if(m < 1) return 'à l’instant';
  if(m < 60) return `il y a ${m} min`;
  const d = new Date(t), hh = d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
  if(isToday(t)) return `aujourd’hui ${hh}`;
  const y = new Date(); y.setDate(y.getDate()-1);
  if(d.toDateString()===y.toDateString()) return `hier ${hh}`;
  return d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'}) + ' ' + hh;
}
function phoneDigits(p){ let d = String(p||'').replace(/\D/g,''); if(d.startsWith('221') && d.length===12) d = d.slice(3); return d; }
function phoneOk(p){ return /^7[05678]\d{7}$/.test(phoneDigits(p)); }
/* Numéros de démo (7X 000 00 XX) : jamais envoyés à WhatsApp */
function phoneDemo(p){ return /^7[05678]00000\d\d$/.test(phoneDigits(p)); }
function fmtPhone(p){ const d = phoneDigits(p); return d.length===9 ? `${d.slice(0,2)} ${d.slice(2,5)} ${d.slice(5,7)} ${d.slice(7)}` : String(p||''); }
function itemsText(o){ return o.items.map(i=>`${i.qty} × ${product(i.pid)?.name||i.name||'Produit supprimé'}`).join(', '); }
function toast(msg){ const t=$('#toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(toast._t); toast._t=setTimeout(()=>t.classList.remove('show'),2600); }
function log(o, label){ o.history.push({t:Date.now(), label}); }
function payInfo(o){
  if(o.status==='annulee' || o.status==='refusee') return null;
  if(o.status==='livree' || due(o)===0) return {l:'Payée', c:'p-paye'};
  if(o.payState==='a_verifier') return {l:`${MODES[o.payMode]} à vérifier`, c:'p-verif'};
  if(o.payState==='attente') return {l:`${MODES[o.payMode]} attendu`, c:'p-attente'};
  if(o.deposit?.amount) return {l:'Acompte reçu', c:'p-verif'};
  return {l:'Paiement à la livraison', c:'p-cod'};
}
function shopLink(){ return baseUrl() + '?b=' + encodeURIComponent(S.shop.slug||''); }
function unreadCount(){ return S.orders.filter(o=>o.unread).length; }
async function copyText(t, ok){
  let done = false;
  try{ await navigator.clipboard.writeText(t); done = true; }catch(e){
    try{ const ta = document.createElement('textarea'); ta.value = t; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); done = document.execCommand('copy'); ta.remove(); }catch(e2){}
  }
  toast(done ? ok : 'Copie impossible : sélectionne le texte à la main');
}
const AVC = ['#4330D9','#D9346B','#1F9D6A','#C77700','#2C7BE5','#8A3FD1'];
function avatar(name){
  const parts = String(name||'?').trim().split(/\s+/); const ini = ((parts[0]||'?')[0] + (parts[1]?parts[1][0]:'')).toUpperCase();
  let h=0; for(const c of String(name)) h=(h*31 + c.charCodeAt(0))>>>0;
  return `<span class="av" aria-hidden="true">${esc(ini)}</span>`;
}
function img(src, alt){ return src ? `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" onerror="this.classList.add('broken')">` : ''; }

/* ===================== Animations ===================== */
function confetti(){
  if(REDUCED) return;
  const fx = document.createElement('div'); fx.className='fx';
  const cols = ['#FF7A1A','#14213D','#F5A524','#1FA971','#2F6FEB'];
  for(let i=0;i<28;i++){
    const s = document.createElement('span'); s.className='conf';
    const a = Math.random()*Math.PI*2, r = 120 + Math.random()*180;
    s.style.cssText = `--c:${cols[i%cols.length]};--x:${Math.cos(a)*r}px;--y:${Math.sin(a)*r - 60}px;--r:${Math.random()*540-270}deg`;
    fx.appendChild(s);
  }
  document.body.appendChild(fx); setTimeout(()=>fx.remove(), 1300);
}
function coins(){
  if(REDUCED) return;
  const fx = document.createElement('div'); fx.className='fx';
  for(let i=0;i<14;i++){ const c=document.createElement('span'); c.className='fcoin'; c.style.cssText=`--l:${8+Math.random()*84}%;--d:${Math.random()*.35}s`; fx.appendChild(c); }
  document.body.appendChild(fx); setTimeout(()=>fx.remove(), 1700);
}
function countUp(el){
  const target = Number(el.dataset.count)||0;
  if(REDUCED || target===0){ el.textContent = F(target); return; }
  const t0 = performance.now(), dur = 800;
  const step = t => { const k = Math.min(1,(t-t0)/dur), e = 1-Math.pow(1-k,3); el.textContent = F(target*e); if(k<1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

/* ===================== Icônes ===================== */
const I = {
  today:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/></svg>',
  orders:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z"/><path d="M9 11h6M9 14h4"/></svg>',
  drivers:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M6 17h4l3-6h4l1 6"/><path d="M13 11l-2-4H8"/></svg>',
  products:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></svg>',
  settings:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  clock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  alert:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.5"/></svg>',
  search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  wa:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z"/></svg>',
  bell:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9"/><path d="M10 19a2 2 0 0 0 4 0"/></svg>',
  bag:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
  link:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
  cam:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  wallet:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4z"/><path d="M4 7l11-3v3"/><circle cx="16" cy="13.5" r="1.2"/></svg>'
};
function motoSVG(){
  return `<svg class="moto" viewBox="0 0 104 66" aria-hidden="true"><g class="bob">
    <rect x="18" y="14" width="26" height="22" rx="4" fill="#FF7A1A"/><path d="M24 25h14" stroke="#FFFFFF" stroke-width="2" opacity=".5"/>
    <path d="M22 48 Q34 34 58 36 L74 36 Q84 37 88 48Z" fill="#14213D"/>
    <rect x="44" y="30" width="22" height="7" rx="3.5" fill="#14213D"/>
    <circle cx="62" cy="14" r="7" fill="#FF7A1A"/><rect x="56" y="11" width="13" height="4" rx="2" fill="#14213D" opacity=".75"/>
    <path d="M60 20 L58 33 L70 33" stroke="#14213D" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M66 24 L80 26" stroke="#14213D" stroke-width="4" stroke-linecap="round"/>
    <path d="M80 22 L84 46" stroke="#5B6478" stroke-width="3"/><circle cx="86" cy="30" r="2.5" fill="#FFD3B0"/>
  </g>
    <g class="wheel"><circle cx="28" cy="52" r="10" fill="#14213D"/><circle cx="28" cy="52" r="4" fill="#E8E2D8"/><path d="M28 43v18M19 52h18" stroke="#5B6478" stroke-width="1.5"/></g>
    <g class="wheel"><circle cx="82" cy="52" r="10" fill="#14213D"/><circle cx="82" cy="52" r="4" fill="#E8E2D8"/><path d="M82 43v18M73 52h18" stroke="#5B6478" stroke-width="1.5"/></g>
  </svg>`;
}
function emptyArt(){
  return `<svg width="120" height="96" viewBox="0 0 120 96" aria-hidden="true">
    <rect x="34" y="6" width="52" height="86" rx="10" fill="#14213D"/><rect x="39" y="14" width="42" height="68" rx="5" fill="#fff"/>
    <rect x="44" y="22" width="26" height="9" rx="4.5" fill="#F7F1E8"/><rect x="50" y="36" width="26" height="9" rx="4.5" fill="#14213D"/>
    <rect x="44" y="50" width="20" height="9" rx="4.5" fill="#F7F1E8"/>
    <circle cx="96" cy="26" r="11" fill="#FF7A1A"/><circle cx="20" cy="66" r="7" fill="#FF7A1A"/><circle cx="104" cy="70" r="4" fill="#1FA971"/>
  </svg>`;
}

/* ===================== Navigation ===================== */
const ROUTES = [['today','Aujourd’hui'],['orders','Commandes'],['drivers','Livreurs'],['products','Produits'],['settings','Réglages']];
let route = 'today', filter = 'all', query = '';
function nav(){
  const t = r => ROUTES.find(x=>x[0]===r)[1];
  const u = unreadCount();
  const btn = r => `<button class="tab" data-route="${r}" ${route===r?'aria-current="page"':''}>${I[r]}<span>${t(r)}</span>${r==='orders'&&u?`<span class="badge">${u}</span>`:''}</button>`;
  $('#tabs').innerHTML = btn('today') + btn('orders') + `<button class="tab plus" data-new aria-label="Nouvelle commande">${I.plus}<span>Nouvelle commande</span></button>` + btn('drivers') + btn('products');
  $('#side-nav').innerHTML = ROUTES.map(([r])=>btn(r)).join('');
  $('#side-logo').innerHTML = logo(true, 34);
  $('#side-shop').textContent = S.shop.name;
}
function go(r, f){ route = r; if(f) filter = f; try{ history.replaceState(null,'','#'+r); }catch(e){} render(); window.scrollTo(0,0); }

/* ===================== Vues ===================== */
function render(){
  nav();
  const v = $('#view');
  v.innerHTML = topbar() + (route==='today' ? viewToday() : route==='orders' ? viewOrders() : route==='drivers' ? viewDrivers() : route==='products' ? viewProducts() : viewSettings());
  if(route==='orders'){ const s=$('#q'); if(s){ s.value=query; s.addEventListener('input', e=>{ query=e.target.value; $('#olist').innerHTML = ordersList(); }); } }
  document.querySelectorAll('[data-count]').forEach(countUp);
}
function topbar(){
  const u = unreadCount();
  return `<div class="topbar">${logo(false,32)}<div class="topactions"><button class="iconbtn bell" data-bell aria-label="Notifications${u?`, ${u} non lues`:''}">${I.bell}${u?`<span class="badge">${u}</span>`:''}</button><button class="iconbtn" data-route="settings" aria-label="Réglages">${I.settings}</button></div></div>`;
}
function pagehead(title, sub){
  return subBanner() + `<div class="pagehead"><div class="shop">${esc(S.shop.name)}</div><h1>${title}</h1>${sub?`<div class="sub">${sub}</div>`:''}</div>`;
}
function paymentsToday(){
  const r = {wave:0, om:0, cash:0};
  S.orders.forEach(o=>{
    if(o.deposit?.amount && o.deposit.mode && isToday(o.deposit.at) && o.status!=='annulee'){ if(o.deposit.mode==='cash') r.cash += o.deposit.amount; else r[o.deposit.mode] += o.deposit.amount; }
    if(o.pay && isToday(o.pay.at) && o.pay.mode!=='cash') r[o.pay.mode] += o.pay.amount;
  });
  (S.remitsLog||[]).forEach(x=>{ if(isToday(x.t)) r.cash += x.amount; });
  return r;
}
function greeting(){ const h = new Date().getHours(); return h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir'; }
function viewToday(){
  const c = k => S.orders.filter(o=>o.status===k).length;
  const delivToday = S.orders.filter(o=>o.status==='livree' && o.pay && isToday(o.pay.at)).length;
  const pay = paymentsToday(), inHand = pay.wave + pay.om + pay.cash;
  const withDrivers = S.drivers.reduce((a,d)=>a+d.cash,0);
  const week = Date.now() - 7*864e5;
  const recent = S.orders.filter(o=>o.createdAt>week && (o.status==='livree'||o.status==='refusee'));
  const refus = recent.length ? Math.round(100*recent.filter(o=>o.status==='refusee').length/recent.length) : 0;
  const running = S.orders.filter(o=>o.status==='livraison');
  const todo = [];
  S.orders.filter(o=>o.status==='nouvelle').forEach(o=>todo.push({bg:'var(--mango-soft)', c:'var(--mango-ink)', i:I.wa, t:`Confirmer la commande de ${esc(o.client.name)}`, b:`<button class="btn small soft" data-order="${o.id}">Ouvrir</button>`}));
  S.orders.filter(o=>o.payState==='a_verifier' && o.status!=='annulee' && o.status!=='refusee').forEach(o=>todo.push({bg:'var(--mango-soft)', c:'var(--mango-ink)', i:I.wallet, t:`Vérifier le paiement ${MODES[o.payMode]} de ${esc(o.client.name)}`, b:`<button class="btn small soft" data-order="${o.id}">Ouvrir</button>`}));
  S.orders.filter(o=>o.status==='confirmee' && !o.driverId).forEach(o=>todo.push({bg:'var(--indigo-soft)', c:'var(--indigo)', i:I.drivers, t:`Trouver un livreur pour ${esc(o.client.name)}`, b:`<button class="btn small soft" data-order="${o.id}">Ouvrir</button>`}));
  S.products.filter(p=>!p.archived && !p.preorder && p.stock<=p.min).forEach(p=>todo.push({bg:'var(--red-soft)', c:'var(--red)', i:I.alert, t:`Stock bas : ${esc(p.name)} (${p.stock})`, b:`<button class="btn small ghost" data-route="products">Voir</button>`}));
  const today = new Date().toLocaleDateString('fr-FR',{weekday:'long', day:'numeric', month:'long'});
  return pagehead(greeting(), today.charAt(0).toUpperCase()+today.slice(1)) + `
  <div class="dash">
    <div class="grid">
      <div class="hero">
        <div class="blob" aria-hidden="true"></div>
        <div class="label">Encaissé aujourd’hui</div>
        <div class="big num" data-count="${inHand}">${F(inHand)}</div>
        <div class="chipsrow">
          <span class="mchip">Wave<b class="num">${F(pay.wave)}</b></span>
          <span class="mchip">Orange Money<b class="num">${F(pay.om)}</b></span>
          <span class="mchip">Cash reçu<b class="num">${F(pay.cash)}</b></span>
        </div>
      </div>
      <button class="btn mango block" data-new>${I.wa} Coller un message WhatsApp</button>
      <div class="kpis">
        <button class="kpi" data-route="orders" data-filter="nouvelle"><span class="ic" style="background:var(--mango-soft);color:var(--mango-ink)">${I.clock}</span><b class="num">${c('nouvelle')}</b><span>À confirmer</span></button>
        <button class="kpi" data-route="orders" data-filter="livraison"><span class="ic" style="background:var(--bissap-soft);color:var(--bissap)">${I.drivers}</span><b class="num">${c('livraison')}</b><span>En livraison</span></button>
        <button class="kpi" data-route="orders" data-filter="livree"><span class="ic" style="background:var(--baobab-soft);color:var(--baobab)">${I.check}</span><b class="num">${delivToday}</b><span>Livrées aujourd’hui</span></button>
      </div>
      <div class="card cash">
        <div class="coinstack"><span class="coin">F</span><div><h2 style="margin:0">Argent chez les livreurs</h2><div class="muted">Cash encaissé, pas encore reversé</div></div></div>
        <div class="big num" style="margin:12px 0 4px" data-count="${withDrivers}">${F(withDrivers)}</div>
        ${S.drivers.filter(d=>d.cash>0).map(d=>`<div class="row"><span class="who">${avatar(d.name)}<span><b>${esc(d.name)}</b> a <b class="num">${F(d.cash)}</b> à reverser</span></span></div>`).join('') || '<div class="muted">Tout est reversé. Bravo.</div>'}
        <div style="margin-top:12px"><button class="btn small" data-route="drivers">Récupérer l’argent</button></div>
      </div>
    </div>
    <div class="grid">
      ${shopCard()}
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><h2 style="margin:0">Sur la route</h2><span class="pill s-livraison">${running.length} en cours</span></div>
        <div class="road" aria-hidden="true">
          <svg class="city" viewBox="0 0 400 50" preserveAspectRatio="none"><path d="M0 50V30h30V18h24v32h20V24h34v26h18V12h28v38h22V28h30v22h24V20h26v30h20V30h40v20h24V22h30v28z" fill="#D9D3EE"/></svg>
          ${running.length ? motoSVG() : ''}
        </div>
        ${running.map(o=>`<div class="row"><span class="who">${avatar(o.client.name)}<span><b>${esc(o.client.name)}</b><br><span class="muted">avec ${esc(driver(o.driverId)?.name||'?')} · à encaisser ${F(due(o))}</span></span></span><button class="btn small ghost" data-order="${o.id}">Ouvrir</button></div>`).join('') || '<div class="muted" style="margin-top:8px">Aucune course en ce moment.</div>'}
      </div>
      <div class="card">
        <h2>À faire maintenant</h2>
        ${todo.length ? `<ul class="todo">${todo.map(x=>`<li><span class="tic" style="background:${x.bg};color:${x.c}">${x.i}</span><span>${x.t}</span>${x.b}</li>`).join('')}</ul>` : '<div class="muted">Rien d’urgent. Profites-en pour filmer une pub.</div>'}
        <div class="row" style="margin-top:6px"><span class="muted">Colis refusés sur 7 jours</span><b class="num">${refus} %</b></div>
      </div>
    </div>
  </div>`;
}

function shopCard(){
  const open = S.shop.open !== false;
  const nToday = S.orders.filter(o=>o.source==='boutique' && isToday(o.createdAt)).length;
  const share = `https://wa.me/?text=${encodeURIComponent(`Commandez directement sur ma boutique ${S.shop.name} : ${shopLink()}`)}`;
  return `<div class="card shopcard">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><h2 style="margin:0">Ta boutique en ligne</h2><span class="pill ${open?'s-livree':'s-annulee'}">${open?'Ouverte':'Fermée'}</span></div>
    <p class="muted" style="margin:6px 0 10px">Partage ce lien : tes clients commandent eux-mêmes et tu reçois une alerte.</p>
    <div class="linkbox">${I.link}<span>${esc(shopLink())}</span></div>
    <div class="two" style="margin-top:10px"><button class="btn soft small" id="copyLink">Copier le lien</button><a class="btn wa small" href="${share}" target="_blank" rel="noopener">${I.wa} Partager</a></div>
    <a class="btn ghost block" style="margin-top:8px" href="${esc(shopLink())}" target="_blank" rel="noopener">${I.bag} Voir ma boutique comme un client</a>
    <div class="row" style="margin-top:10px"><span class="muted">Commandes en ligne aujourd’hui</span><b class="num">${nToday}</b></div>
  </div>`;
}
const FILTERS = [['all','Toutes'],['nouvelle','À confirmer'],['confirmee','Confirmées'],['livraison','En livraison'],['livree','Livrées'],['closed','Refusées et annulées']];
function filtered(){
  let list = S.orders.slice().sort((a,b)=>b.createdAt-a.createdAt);
  if(filter==='closed') list = list.filter(o=>o.status==='refusee'||o.status==='annulee');
  else if(filter!=='all') list = list.filter(o=>o.status===filter);
  const q = norm(query).trim();
  if(q) list = list.filter(o=>norm(o.client.name).includes(q) || phoneDigits(o.client.phone).includes(q.replace(/\D/g,'')||'§') || String(o.num).includes(q));
  return list;
}
function orderCard(o){
  const st = STATUS[o.status], pi = payInfo(o);
  const rest = (o.status==='confirmee'||o.status==='livraison'||o.status==='nouvelle') && due(o) ? ` · reste ${F(due(o))}` : '';
  return `<button class="order ${o.unread?'unread':''}" data-order="${o.id}">${avatar(o.client.name)}
    <span class="n">${esc(o.client.name)}</span><span class="amt num">${F(total(o))}</span>
    <span class="meta">#${o.num??'…'} · ${esc((o.address||zone(o.zoneId)?.name||'').split(',')[0])} · ${ago(o.createdAt)}${rest}</span><span><span class="pill ${st.cls}">${st.label}</span></span>
    <span class="tags">${o.source==='boutique'?`<span class="src">${I.bag} Boutique</span>`:''}${pi?`<span class="pill ${pi.c}">${pi.l}</span>`:''}</span>
  </button>`;
}
function ordersList(){
  const list = filtered();
  if(!list.length) return `<div class="card" style="text-align:center;padding:26px 16px">${emptyArt()}<h2 style="margin:10px 0 4px">Rien par ici</h2><div class="muted">Colle le prochain message WhatsApp avec le bouton +, ou partage le lien de ta boutique.</div></div>`;
  return list.map(orderCard).join('');
}
function viewOrders(){
  const count = k => k==='all'?S.orders.length : k==='closed'?S.orders.filter(o=>o.status==='refusee'||o.status==='annulee').length : S.orders.filter(o=>o.status===k).length;
  return pagehead('Commandes') + `
  <label class="search">${I.search}<input id="q" type="search" placeholder="Nom, numéro ou n° de commande" aria-label="Chercher une commande"></label>
  <div class="chips" role="group" aria-label="Filtrer">${FILTERS.map(([k,l])=>`<button class="chip" data-filter-chip="${k}" aria-pressed="${filter===k}">${l} · ${count(k)}</button>`).join('')}</div>
  <div class="olist" id="olist">${ordersList()}</div>`;
}

function viewDrivers(){
  const sum = S.drivers.reduce((a,d)=>a+d.cash,0);
  return pagehead('Livreurs') + `
  <div class="banner">${img(PHOTOS.moto.src,'Livreur à moto')}<div><h2>${F(sum)} chez tes livreurs</h2><p>Récupère-les avant la fin de la journée.</p></div></div>
  <div class="grid">` +
  S.drivers.map(d=>{
    const running = S.orders.filter(o=>o.driverId===d.id && o.status==='livraison');
    const doneToday = S.orders.filter(o=>o.driverId===d.id && o.status==='livree' && o.pay && isToday(o.pay.at)).length;
    return `<div class="card dcard">
      <div class="dhead"><span class="who">${avatar(d.name)}<span><span class="dname">${esc(d.name)}</span><br><span class="muted">${esc(fmtPhone(d.phone))}</span></span></span>
      <div style="text-align:right"><div class="muted">En main</div><div class="money num ${d.cash?'':'zero'}">${F(d.cash)}</div></div></div>
      <div class="muted">${running.length} course${running.length>1?'s':''} en cours · ${doneToday} livrée${doneToday>1?'s':''} aujourd’hui</div>
      ${running.map(o=>`<div class="row"><span>${esc(o.client.name)} · <span class="muted">#${o.num??'…'}</span></span><button class="btn small ghost" data-order="${o.id}">Ouvrir</button></div>`).join('')}
      <button class="btn ${d.cash?'':'ghost'}" data-remit="${d.id}" ${d.cash?'':'disabled'}>${I.wallet} J’ai reçu ${F(d.cash)} de ${esc(d.name)}</button>
    </div>`;
  }).join('') + `
  <div class="card"><h2>Ajouter un livreur</h2>
    <form id="addDriver" class="two" style="align-items:end">
      <div><label for="dn">Prénom</label><input id="dn" type="text" name="name" required></div>
      <div><label for="dp">Téléphone</label><input id="dp" type="tel" name="phone" placeholder="77 123 45 67" required></div>
      <button class="btn" type="submit" style="grid-column:1/-1">Ajouter le livreur</button>
    </form></div></div>`;
}

function viewProducts(){
  return pagehead('Produits', 'Le stock baisse tout seul quand une commande est confirmée.') + (S.products.length ? '' : starterCard()) + `<div class="pgrid">` +
  S.products.map(p=>`<div class="pcard" ${p.archived?'style="opacity:.6"':''}>
      <div class="pimg"><span class="ph" aria-hidden="true">${esc(p.name.charAt(0))}</span>${img(p.img, p.name)}
        ${p.archived?'<span class="tag" style="background:var(--ink)">Archivé</span>':p.preorder?'<span class="tag" style="background:var(--bissap)">Sur commande</span>':(p.stock<=p.min?'<span class="tag">Stock bas</span>':'')}
        <button class="cam" data-photo="${p.id}" aria-label="Changer la photo de ${esc(p.name)}">${I.cam} Photo</button></div>
      <div class="pbody"><div class="pname">${esc(p.name)}</div><div class="pprice num">${F(p.price)}</div>
        ${p.preorder ? `<div class="stock" style="justify-content:center;padding:9px"><small>Sur commande · livré en ${esc(p.delay||'15 à 20 jours')}</small></div>` : `<div class="stock" aria-label="Stock de ${esc(p.name)}"><button data-stock="${p.id}" data-d="-1" aria-label="Retirer 1">−</button><span style="text-align:center"><b class="num">${p.stock}</b> <small>en stock</small></span><button data-stock="${p.id}" data-d="1" aria-label="Ajouter 1">+</button></div>`}
        <button class="btn small ghost" data-archive="${p.id}">${p.archived?'Remettre en vente':'Archiver'}</button>
      </div></div>`).join('') + `</div>
  <div class="card" style="margin-top:12px"><h2>Ajouter un produit</h2>
    <form id="addProduct" class="grid">
      <div><label for="pn">Nom</label><input id="pn" type="text" name="name" required placeholder="Ex. : Ring light 10 pouces"></div>
      <div class="two"><div><label for="pp">Prix (F)</label><input id="pp" type="number" name="price" min="0" step="100" required></div>
      <div><label for="ps">Stock</label><input id="ps" type="number" name="stock" min="0" step="1" value="0" required></div></div>
      <label class="check"><input type="checkbox" name="preorder"> Sur commande (pas de stock, livré en 15 à 20 jours)</label>
      <button class="btn" type="submit">Ajouter le produit</button>
    </form><p class="muted" style="margin-bottom:0">Ensuite, touche « Photo » sur la carte pour ajouter ta propre photo.</p></div>`;
}

function viewSettings(){
  return pagehead('Réglages') + `<div class="grid">
  <div class="card"><h2>Ta boutique en ligne</h2>
    <form id="shopForm" class="grid">
      <div><label for="sn">Nom de la boutique</label><input id="sn" type="text" name="name" value="${esc(S.shop.name)}"></div>
      <div><label for="sd">Phrase de présentation</label><input id="sd" type="text" name="desc" value="${esc(S.shop.desc||'')}"></div>
      <div class="two"><div><label for="sw">WhatsApp de la boutique</label><input id="sw" type="tel" name="whatsapp" value="${esc(S.shop.whatsapp||'')}"></div>
      <div><label for="swv">Numéro Wave</label><input id="swv" type="tel" name="wave" value="${esc(S.shop.wave||'')}"></div></div>
      <div><label for="som">Numéro Orange Money</label><input id="som" type="tel" name="om" value="${esc(S.shop.om||'')}"></div>
      <label class="check"><input type="checkbox" name="open" ${S.shop.open!==false?'checked':''}> Boutique ouverte aux commandes</label>
      <button class="btn" type="submit">Enregistrer</button>
    </form></div>
  ${subCard()}
  <div class="card"><h2>Notifications</h2><p class="muted" style="margin-top:0">${notifState()}</p><button class="btn ghost" id="notifBtn">${I.bell} Activer les notifications</button></div>
  <div class="card"><h2>Zones et frais de livraison</h2>
    <p class="muted" style="margin-top:0">Ces frais s’ajoutent automatiquement à chaque commande. Mets tes vrais tarifs.</p>
    ${S.zones.map(z=>`<div class="row"><span>${esc(z.name)}</span><input type="number" min="0" step="100" value="${z.fee}" data-zone="${z.id}" aria-label="Frais pour ${esc(z.name)}" style="width:120px"></div>`).join('')}</div>
  <div class="card"><h2>Tes données</h2>
    <div class="actions"><button class="btn ghost" id="exportCsv">Télécharger les commandes (Excel, CSV)</button>
    <button class="btn ghost" id="logout">Se déconnecter</button></div>
    <p class="muted" style="margin-bottom:0">Connecté avec ${esc(USER?.email||'')}. Tes données sont gardées en ligne : tu les retrouves sur n’importe quel téléphone.</p></div>
  <div class="card"><h2>Crédits photos</h2>
    <p class="muted" style="margin-top:0">Photos sous licence Pexels (usage gratuit, y compris commercial).</p>
    ${Object.values(PHOTOS).map(p=>`<div class="row"><span>${esc(p.credit)}</span><a href="${p.page}" target="_blank" rel="noopener" style="color:var(--indigo);font-weight:600">Voir sur Pexels</a></div>`).join('')}
  </div></div>`;
}

/* ===================== Accueil ===================== */
function showWelcome(){
  const w = $('#welcome');
  w.innerHTML = `
    <div class="w-photo">${img(PHOTOS.hero.src,'Vendeuse qui répond à un message sur son téléphone')}
      <div class="w-top">${logo(true,36)}</div>
      <div class="bubbles" aria-hidden="true">
        <div class="bub b1">Salam, je veux 2 appareils photo svp</div>
        <div class="bub b2">Je suis à Parcelles U26</div>
        <div class="bub b3">Commande enregistrée ✓</div>
      </div>
    </div>
    <div class="w-body">
      <h1>Vos commandes en ligne, <em>sous contrôle.</em></h1>
      <p class="lead">Les commandes, les livreurs et l’argent du jour réunis au même endroit. Chaque commande suivie, chaque franc retrouvé.</p>
      <ul class="w-feats">
        <li><span class="tic">${I.wa}</span>Un message collé, la commande se remplit toute seule</li>
        <li><span class="tic">${I.drivers}</span>Qui livre quoi, et qui garde le cash</li>
        <li><span class="tic">${I.wallet}</span>Wave, Orange Money, cash : tout est compté</li>
      </ul>
      <div class="w-cta"><button class="btn mango block" id="startBtn">Ouvrir mon comptoir</button></div>
      <div class="w-credit">Photo : ${esc(PHOTOS.hero.credit)} sur Pexels</div>
    </div>`;
  w.classList.add('show');
  $('#startBtn').focus();
  $('#startBtn').addEventListener('click', ()=>{ w.classList.remove('show'); S.welcomed = true; save(); go('today'); setTimeout(checkNew, 900); });
}

/* ===================== Feuilles ===================== */
let lastFocus = null;
function openSheet(html){
  lastFocus = document.activeElement;
  $('#sheet').innerHTML = html; $('#sheet').classList.add('show'); $('#overlay').classList.add('show');
  $('#sheet').scrollTop = 0;
  const x = $('#sheet .x'); if(x) x.focus();
}
function closeSheet(){ $('#sheet').classList.remove('show'); $('#overlay').classList.remove('show'); if(lastFocus && document.body.contains(lastFocus)) lastFocus.focus(); }
function sheetHead(t){ return `<div class="sheet-head"><h2 id="sheet-title">${t}</h2><button class="x" data-close aria-label="Fermer">✕</button></div>`; }

function stepper(o){
  if(o.status==='annulee') return `<div class="steps ko"><div class="on">Reçue</div><div class="on end">Annulée</div><div></div><div></div></div>`;
  const idx = {nouvelle:0, confirmee:1, livraison:2, livree:3, refusee:3}[o.status];
  const labels = ['Reçue','Confirmée','En route', o.status==='refusee'?'Refusée':'Livrée'];
  const cls = o.status==='livree' ? 'ok' : o.status==='refusee' ? 'ko' : '';
  return `<div class="steps ${cls}">${labels.map((l,i)=>`<div class="${i<=idx?'on':''}${i===3?' end':''}">${l}</div>`).join('')}</div>`;
}
function openOrder(id, celebrate){
  const o = S.orders.find(x=>x.id===id); if(!o) return;
  if(o.unread){ o.unread = false; save(); render(); }
  const st = STATUS[o.status], z = zone(o.zoneId), d = driver(o.driverId);
  let actions = '';
  if(o.status==='nouvelle'){
    actions = `<button class="btn wa" data-msg="client" data-id="${o.id}">${I.wa} ${o.source==='boutique'?'Confirmer au client sur WhatsApp':'Demander confirmation sur WhatsApp'}</button>
      <button class="btn" data-act="confirm" data-id="${o.id}">${o.source==='boutique'?'Accepter la commande':'Le client a confirmé'}</button>
      <button class="btn danger" data-act="cancel" data-id="${o.id}">Annuler la commande</button>`;
  } else if(o.status==='confirmee'){
    actions = `<div class="field" style="margin:0"><label for="drv">Livreur</label><select id="drv">${['<option value="">Choisir un livreur</option>', ...S.drivers.map(x=>`<option value="${x.id}" ${o.driverId===x.id?'selected':''}>${esc(x.name)}</option>`)].join('')}</select></div>
      <button class="btn wa" data-msg="driver" data-id="${o.id}">${I.wa} Envoyer la course au livreur</button>
      <button class="btn" data-act="ship" data-id="${o.id}">Partie en livraison</button>
      <button class="btn danger" data-act="cancel" data-id="${o.id}">Annuler la commande</button>`;
  } else if(o.status==='livraison'){
    actions = (due(o)===0
      ? `<div class="muted">Déjà payée par ${MODES[o.deposit?.mode]||'avance'} : le livreur n’encaisse rien.</div><button class="btn" data-paid="prepaid" data-id="${o.id}">${I.check} Livrée</button>`
      : `<div class="muted">Livrée ? Comment le client a payé les ${F(due(o))} restants :</div>
      <div class="paygrid"><button class="btn" data-paid="cash" data-id="${o.id}">Cash</button><button class="btn" data-paid="wave" data-id="${o.id}">Wave</button><button class="btn" data-paid="om" data-id="${o.id}">Orange Money</button></div>`)
      + `<button class="btn danger" data-act="refuse" data-id="${o.id}">Le client a refusé le colis</button>`;
  } else if(o.status==='livree'){
    actions = `<div class="donecheck"><svg viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="15" fill="#1F9D6A"/><path d="M9 16.5l4.5 4.5L23 11.5" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg><span>${paidText(o)}</span></div>
      <button class="btn wa" data-msg="thanks" data-id="${o.id}">${I.wa} Remercier le client sur WhatsApp</button>`;
  }
  openSheet(sheetHead(`Commande #${o.num??'…'}`) + `
    ${stepper(o)}
    <div class="card">
      <div class="dhead"><span class="who">${avatar(o.client.name)}<span><span class="dname">${esc(o.client.name)}</span><br><span class="muted">${esc(fmtPhone(o.client.phone)||'Pas de numéro')}</span></span></span><span class="pill ${st.cls}">${st.label}</span></div>
      <div class="muted" style="margin-top:10px">${esc(z?.name||'')}${o.address?` · ${esc(o.address)}`:''}</div>
      <div class="muted">Livraison : ${esc((o.day||'').toLowerCase())}${d?` · avec ${esc(d.name)}`:''}</div>
      ${o.source==='boutique'?`<div style="margin-top:8px"><span class="src">${I.bag} Commandée sur ta boutique en ligne</span></div>`:''}
      ${o.note?`<div class="muted">Note : ${esc(o.note)}</div>`:''}
    </div>
    ${payBlock(o)}
    <div class="totals" style="margin-top:12px">
      ${o.items.map(i=>`<div class="row"><span>${i.qty} × ${esc(product(i.pid)?.name||i.name||'Produit supprimé')}</span><span class="num">${F(i.price*i.qty)}</span></div>`).join('')}
      <div class="row"><span>Livraison</span><span class="num">${feeText(o)}</span></div>
      <div class="row grand"><span>Total</span><span class="num">${F(total(o))}</span></div>
      ${o.deposit?.amount?`<div class="row"><span>Acompte ${MODES[o.deposit.mode]||''}</span><span class="num">− ${F(o.deposit.amount)}</span></div>`:''}
      ${o.status!=='livree'&&o.status!=='annulee'&&o.status!=='refusee'?`<div class="row grand" style="color:var(--indigo)"><span>Reste à encaisser</span><span class="num">${F(due(o))}</span></div>`:''}
    </div>
    <div class="actions">${actions}</div>
    <h3 style="margin:20px 0 6px;font-size:1rem">Historique</h3>
    <ul class="timeline">${o.history.slice().reverse().map(h=>`<li>${ago(h.t)} : ${esc(h.label)}</li>`).join('')}</ul>`);
  if(celebrate==='confetti') confetti(); else if(celebrate==='coins') coins();
}

function paidText(o){
  if(o.pay && o.pay.amount > 0) return `Payée : ${F(o.pay.amount)} en ${MODES[o.pay.mode]}${o.pay.mode==='cash'?' (chez le livreur)':''}`;
  return `Payée d’avance : ${F(total(o))} par ${MODES[o.deposit?.mode]||'avance'}`;
}
function payBlock(o){
  if(o.status==='annulee' || o.status==='refusee' || o.status==='livree') return '';
  const first = esc((o.client.name||'').split(' ')[0]);
  if(o.payState==='a_verifier') return `<div class="payinfo"><b>${first} dit avoir payé ${F(due(o))} par ${MODES[o.payMode]}.</b>
    <div class="muted" style="margin:4px 0 10px">Vérifie dans ton appli ${MODES[o.payMode]} avant de confirmer.</div>
    <div class="two"><button class="btn mango" data-confirmpay="${o.id}">J’ai bien reçu ${F(due(o))}</button><button class="btn ghost" data-notpaid="${o.id}">Pas encore reçu</button></div></div>`;
  if(o.payState==='attente') return `<div class="payinfo" style="background:var(--soft)"><b>Paiement ${MODES[o.payMode]} attendu</b>
    <div class="muted" style="margin:4px 0 10px">${first} a choisi de payer par ${MODES[o.payMode]} mais ne l’a pas encore signalé.</div>
    <button class="btn ghost block" data-msg="payreminder" data-id="${o.id}">${I.wa} Relancer sur WhatsApp</button></div>`;
  return '';
}
function recap(o){
  const z = zone(o.zoneId);
  return o.items.map(i=>`• ${i.qty}× ${product(i.pid)?.name||i.name||'Produit'} — ${F(i.price*i.qty)}`).join('\n') + `\n• Livraison ${(z?.name||'').split(',')[0]} — ${feeText(o)}`;
}
/* Charte : on vouvoie le client, on parle simplement au livreur */
function messageFor(kind, o){
  const first = (o.client.name||'').split(' ')[0];
  if(kind==='client'){
    const head = o.source==='boutique' ? `Bonjour ${first} 👋 Votre commande #${o.num??'…'} est confirmée :` : `Bonjour ${first} 👋 Voici le récapitulatif de votre commande :`;
    const pay = o.deposit?.amount ? `Acompte reçu : ${F(o.deposit.amount)}. Reste à payer : ${F(due(o))} (Wave, OM ou cash)` : `Total : ${F(total(o))} (Wave, OM ou cash)`;
    const tail = o.source==='boutique' ? `Livraison ${(o.day||'').toLowerCase()}. Jërëjëf !` : `Livraison prévue ${(o.day||'').toLowerCase()}. Vous confirmez ?`;
    return `${head}\n${recap(o)}\n${o.deposit?.amount ? `Total : ${F(total(o))}\n` : ''}${pay}\n${tail}`;
  }
  if(kind==='driver'){
    const z = zone(o.zoneId);
    return `Course ${S.shop.name} #${o.num??'…'}\nClient : ${o.client.name}, ${fmtPhone(o.client.phone)}\nAdresse : ${o.address||z?.name||''}\nColis : ${itemsText(o)}\nÀ encaisser : ${F(due(o))} (cash, Wave ou Orange Money)\nMerci !`;
  }
  if(kind==='payreminder'){
    const num = o.payMode==='om' ? S.shop.om : S.shop.wave;
    return `Bonjour ${first} 👋 Pour valider votre commande #${o.num??'…'}, envoyez ${F(due(o))} par ${MODES[o.payMode]} au ${fmtPhone(num)}, en indiquant #${o.num??'…'}.\nDès réception, nous lançons la livraison. Jërëjëf !`;
  }
  return `Jërëjëf ${first} ! Votre commande #${o.num??'…'} est bien livrée ✅\nUne petite photo ou un avis nous aide beaucoup. À bientôt chez ${S.shop.name} !`;
}
function openMessage(kind, id){
  const o = S.orders.find(x=>x.id===id); if(!o) return;
  let phone = o.client.phone, to = o.client.name;
  if(kind==='driver'){
    const sel = $('#drv'); const did = sel ? sel.value : o.driverId;
    if(!did){ toast('Choisis d’abord un livreur'); return; }
    o.driverId = did; save(); const d = driver(did); phone = d.phone; to = d.name;
  }
  const msg = messageFor(kind, o);
  const demo = phoneDemo(phone), ok = phoneOk(phone) && !demo;
  openSheet(sheetHead(`Message pour ${esc(to)}`) + `
    <p class="muted" style="margin-top:0">Relis et modifie si besoin. C’est toi qui l’envoies depuis ton WhatsApp.</p>
    <textarea id="msg" rows="10">${esc(msg)}</textarea>
    ${demo?'<p class="warn" style="margin-top:8px">Numéro fictif de démonstration : WhatsApp ne s’ouvrira pas. Tu peux copier le message.</p>':(!ok?'<p class="warn" style="margin-top:8px">Numéro incomplet : corrige-le dans la commande, ou copie le message.</p>':'')}
    <div class="actions">
      <a class="btn wa" id="waLink" href="#" target="_blank" rel="noopener" ${ok?'':'aria-disabled="true" tabindex="-1"'}>${I.wa} Ouvrir WhatsApp</a>
      <button class="btn ghost" id="copyMsg">Copier le message</button>
      <button class="btn ghost" data-order="${o.id}">Retour à la commande</button>
    </div>`);
  const upd = () => { $('#waLink').href = ok ? `https://wa.me/221${phoneDigits(phone)}?text=${encodeURIComponent($('#msg').value)}` : '#'; };
  upd(); $('#msg').addEventListener('input', upd);
  $('#waLink').addEventListener('click', e=>{ if(!ok){ e.preventDefault(); return; } log(o, kind==='driver'?`Message envoyé à ${to}`:'Message WhatsApp ouvert pour le client'); save(); });
  $('#copyMsg').addEventListener('click', async ()=>{
    const t = $('#msg').value; let done=false;
    try{ await navigator.clipboard.writeText(t); done=true; }catch(e){ try{ $('#msg').select(); done=document.execCommand('copy'); }catch(e2){} }
    toast(done?'Message copié':'Sélectionne le texte pour le copier');
  });
}

/* ---------- Nouvelle commande ---------- */
const NUMS = {un:1,une:1,deux:2,trois:3,quatre:4,cinq:5,six:6,sept:7,huit:8,neuf:9,dix:10};
function parseMessage(raw){
  const out = {found:[]};
  const text = String(raw||'');
  const n = ' ' + norm(text).replace(/\s+/g,' ') + ' ';
  const ph = text.match(/(?:\+?221[\s.\-]?)?(7[05678])[\s.\-]?(\d{3})[\s.\-]?(\d{2})[\s.\-]?(\d{2})/);
  if(ph){ out.phone = `${ph[1]} ${ph[2]} ${ph[3]} ${ph[4]}`; out.found.push('téléphone'); }
  const nm = text.match(/(?:moi c['’]?est|je m['’]?appelle|c['’]?est|nom\s*:)\s*([A-ZÀ-Ý][a-zà-ÿ'’-]+(?:\s+[A-ZÀ-Ý][a-zà-ÿ'’-]+)?)/);
  if(nm){ out.name = nm[1]; out.found.push('nom'); }
  const kws = []; S.zones.forEach(z=>(z.kw||[]).forEach(k=>kws.push([k,z.id]))); kws.sort((a,b)=>b[0].length-a[0].length);
  const hit = kws.find(([k])=>n.includes(' '+k));
  if(hit){
    out.zoneId = hit[1]; out.found.push('quartier');
    const sent = text.split(/[\n.!?]/).find(s=>norm(s).includes(hit[0]));
    if(sent) out.address = sent.replace(/^\s*(je suis|j['’]habite|j['’]?suis)\s*(à|a|au|aux)?\s*/i,'').trim();
  }
  let rest = n; const items = [];
  S.products.filter(p=>!p.archived).forEach(p=>{
    const kw = (p.kw && p.kw.length ? p.kw : [norm(p.name).split(' ')[0]]).map(k=>k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
    const re = new RegExp(`(?:(\\d+|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)\\s*(?:x\\s*)?)?(?:\\w+\\s)?\\b(${kw.join('|')})s?\\b`);
    const m = rest.match(re);
    if(m){ const q = m[1] ? (NUMS[m[1]] || parseInt(m[1],10) || 1) : 1; items.push({pid:p.id, qty:Math.min(q,50)}); rest = rest.replace(m[0],' '); }
  });
  if(items.length){ out.items = items; out.found.push(items.length>1?`${items.length} produits`:'1 produit'); }
  return out;
}
const EXAMPLE = "Salam ! Moi c'est Rokhaya Diallo. Je veux 2 appareils photo pour enfant svp, c'est pour Noël.\nJe suis à Parcelles U26, en face de la mosquée.\nMon numéro : 77 000 00 09. Je paie par Wave.";
let draft;
function newDraft(){ return {name:'', phone:'', zoneId:S.zones[0]?.id||'', address:'', items:[{pid:S.products.find(p=>!p.archived)?.id, qty:1}], fee:S.zones[0]?.fee||0, depAmount:0, depMode:'', day:'Aujourd’hui', note:'', feeTouched:false}; }
function openNew(){ draft = newDraft(); renderNew(); }
function renderNew(found=[]){
  const sub = draft.items.reduce((a,i)=>a + (product(i.pid)?.price||0)*i.qty, 0);
  const tot = sub + Number(draft.fee||0);
  const stockWarn = draft.items.filter(i=>product(i.pid) && !product(i.pid).preorder && i.qty>product(i.pid).stock).map(i=>product(i.pid).name);
  const f = k => found.includes(k) ? 'found' : '';
  openSheet(sheetHead('Nouvelle commande') + `
    <div class="paste">
      <label for="paste">Colle le message WhatsApp du client</label>
      <textarea id="paste" rows="4" placeholder="Ex. : Salam, moi c'est Awa, je veux 1 appareil photo, je suis à Mermoz, mon numéro 77…"></textarea>
      <div class="two" style="margin-top:10px"><button class="btn mango" type="button" id="parseBtn">Remplir automatiquement</button><button class="btn ghost" type="button" id="exampleBtn">Essayer un exemple</button></div>
      <div class="parsed" id="parsed">${found.length?`Trouvé : ${found.join(', ')}. Vérifie avant d’enregistrer.`:''}</div>
    </div>
    <form id="orderForm" novalidate>
      <div class="two">
        <div class="field"><label for="f-name">Nom du client</label><input id="f-name" class="${f('nom')}" type="text" value="${esc(draft.name)}" required></div>
        <div class="field"><label for="f-phone">Téléphone</label><input id="f-phone" class="${f('téléphone')}" type="tel" value="${esc(draft.phone)}" placeholder="77 123 45 67"></div>
      </div>
      <div class="field"><label for="f-zone">Zone de livraison</label>
        <select id="f-zone" class="${f('quartier')}">${S.zones.map(z=>`<option value="${z.id}" ${draft.zoneId===z.id?'selected':''}>${esc(z.name)} (${F(z.fee)})</option>`).join('')}</select></div>
      <div class="field"><label for="f-addr">Adresse, repère</label><input id="f-addr" class="${f('quartier')}" type="text" value="${esc(draft.address)}" placeholder="Ex. : en face de la mosquée"></div>
      <label>Produits</label>
      ${draft.items.map((it,i)=>`<div class="itemrow">
        <select data-item="${i}" class="${found.some(x=>x.includes('produit'))?'found':''}" aria-label="Produit ${i+1}">${S.products.filter(p=>!p.archived).map(p=>`<option value="${p.id}" ${it.pid===p.id?'selected':''}>${esc(p.name)} · ${F(p.price)}</option>`).join('')}</select>
        <input type="number" min="1" step="1" value="${it.qty}" data-qty="${i}" aria-label="Quantité">
        <button type="button" data-rm="${i}" aria-label="Retirer ce produit" ${draft.items.length<2?'disabled':''}>✕</button></div>`).join('')}
      <button type="button" class="btn small ghost" id="addItem" style="margin-bottom:12px">+ Ajouter un produit</button>
      ${stockWarn.length?`<div class="warn">Pas assez de stock pour : ${stockWarn.map(esc).join(', ')}.</div>`:''}
      <div class="two">
        <div class="field"><label for="f-fee">Frais de livraison (F)</label><input id="f-fee" type="number" min="0" step="100" value="${draft.fee}"></div>
        <div class="field"><label for="f-day">Livraison prévue</label><select id="f-day">${['Aujourd’hui','Demain','Après-demain'].map(d=>`<option ${draft.day===d?'selected':''}>${d}</option>`).join('')}</select></div>
      </div>
      <div class="two">
        <div class="field"><label for="f-dep">Acompte reçu (F)</label><input id="f-dep" type="number" min="0" step="500" value="${draft.depAmount||0}"></div>
        <div class="field"><label for="f-depmode">Payé par</label><select id="f-depmode"><option value="">Pas d’acompte</option>${Object.entries(MODES).map(([k,v])=>`<option value="${k}" ${draft.depMode===k?'selected':''}>${v}</option>`).join('')}</select></div>
      </div>
      <div class="field"><label for="f-note">Note</label><input id="f-note" type="text" value="${esc(draft.note)}" placeholder="Ex. : appeler avant d’arriver"></div>
      <div class="totals">
        <div class="row"><span>Produits</span><span class="num">${F(sub)}</span></div>
        <div class="row"><span>Livraison</span><span class="num">${F(draft.fee)}</span></div>
        <div class="row grand"><span>Total</span><span class="num" id="tot">${F(tot)}</span></div>
        ${Number(draft.depAmount)>0?`<div class="row"><span>Reste à encaisser</span><span class="num">${F(Math.max(0,tot-draft.depAmount))}</span></div>`:''}
      </div>
      <p class="warn" id="formErr" hidden></p>
      <button class="btn block" type="submit">Enregistrer la commande</button>
    </form>`);
  bindNew();
}
function readDraft(){
  draft.name = $('#f-name').value.trim(); draft.phone = $('#f-phone').value.trim();
  draft.zoneId = $('#f-zone').value; draft.address = $('#f-addr').value.trim();
  draft.fee = Number($('#f-fee').value)||0; draft.day = $('#f-day').value;
  draft.depAmount = Number($('#f-dep').value)||0; draft.depMode = $('#f-depmode').value; draft.note = $('#f-note').value.trim();
  document.querySelectorAll('[data-item]').forEach(s=>{ draft.items[+s.dataset.item].pid = s.value; });
  document.querySelectorAll('[data-qty]').forEach(s=>{ draft.items[+s.dataset.qty].qty = Math.max(1, parseInt(s.value,10)||1); });
}
function bindNew(){
  const rerender = (found) => { readDraft(); const y=$('#sheet').scrollTop; renderNew(found); $('#sheet').scrollTop=y; };
  $('#parseBtn').addEventListener('click', ()=>{
    const txt = $('#paste').value;
    if(!txt.trim()){ $('#parsed').textContent = 'Colle d’abord un message.'; return; }
    readDraft(); const r = parseMessage(txt);
    if(r.name) draft.name = r.name; if(r.phone) draft.phone = r.phone;
    if(r.zoneId){ draft.zoneId = r.zoneId; if(!draft.feeTouched) draft.fee = zone(r.zoneId).fee; }
    if(r.address) draft.address = r.address; if(r.items) draft.items = r.items;
    if(/wave/i.test(txt)) draft.note = draft.note || 'Paiement prévu par Wave';
    else if(/orange money|\bom\b/i.test(txt)) draft.note = draft.note || 'Paiement prévu par Orange Money';
    renderNew(r.found);
    $('#paste').value = txt;
    if(!r.found.length) $('#parsed').textContent = 'Je n’ai rien reconnu. Remplis les champs à la main.';
  });
  $('#exampleBtn').addEventListener('click', ()=>{ $('#paste').value = EXAMPLE; $('#parseBtn').click(); });
  $('#f-zone').addEventListener('change', e=>{ if(!draft.feeTouched){ $('#f-fee').value = zone(e.target.value).fee; } rerender(); });
  $('#f-fee').addEventListener('change', ()=>{ draft.feeTouched = true; rerender(); });
  $('#f-dep').addEventListener('change', ()=>rerender());
  document.querySelectorAll('[data-item],[data-qty]').forEach(el=>el.addEventListener('change', ()=>rerender()));
  document.querySelectorAll('[data-rm]').forEach(b=>b.addEventListener('click', ()=>{ readDraft(); draft.items.splice(+b.dataset.rm,1); rerender(); }));
  $('#addItem').addEventListener('click', ()=>{ readDraft(); draft.items.push({pid:S.products.find(p=>!p.archived)?.id, qty:1}); rerender(); });
  $('#orderForm').addEventListener('submit', async e=>{
    e.preventDefault(); readDraft();
    const err = $('#formErr');
    if(!draft.name){ err.textContent = 'Ajoute le nom du client.'; err.hidden=false; $('#f-name').focus(); return; }
    if(draft.phone && !phoneOk(draft.phone)){ err.textContent = 'Le numéro doit avoir 9 chiffres et commencer par 70, 75, 76, 77 ou 78.'; err.hidden=false; $('#f-phone').focus(); return; }
    if(draft.depAmount>0 && !draft.depMode){ err.textContent = 'Indique comment l’acompte a été payé.'; err.hidden=false; $('#f-depmode').focus(); return; }
    const now = Date.now();
    const o = {id:uid(), num:null, createdAt:now, client:{name:draft.name, phone:draft.phone?fmtPhone(draft.phone):''}, zoneId:draft.zoneId, address:draft.address,
      items: draft.items.filter(i=>product(i.pid)).map(i=>({pid:i.pid, name:product(i.pid).name, qty:i.qty, price:product(i.pid).price})),
      fee:draft.fee, deposit:{amount:draft.depMode?draft.depAmount:0, mode:draft.depMode, at:now}, day:draft.day,
      status:'nouvelle', driverId:null, pay:null, stockOut:false, note:draft.note, history:[{t:now,label:'Commande reçue'}]};
    if(o.deposit.amount) o.history.push({t:now,label:`Acompte de ${F(o.deposit.amount)} reçu par ${MODES[o.deposit.mode]}`});
    const sub = e.submitter || $('#orderForm button[type=submit]'); if(sub){ sub.disabled = true; sub.textContent = 'Enregistrement…'; }
    S.orders.push(o); const ok = await flush();
    filter = 'all'; route = 'orders'; render();
    openOrder(o.id); toast(ok ? `Commande #${o.num??'…'} enregistrée` : 'Commande gardée ici, envoi dès que le réseau revient');
  });
}

/* ---------- Actions ---------- */
function stockOut(o, sign){ o.items.forEach(i=>{ const p=product(i.pid); if(p && !p.preorder) p.stock = Math.max(0, p.stock - sign*i.qty); }); }
function act(kind, id){
  const o = S.orders.find(x=>x.id===id); if(!o) return;
  if(kind==='confirm'){ o.status='confirmee'; if(!o.stockOut){ stockOut(o,1); o.stockOut=true; } log(o, o.source==='boutique'?'Commande acceptée':'Confirmée par le client'); toast('Commande confirmée ✅ Stock mis à jour.'); }
  if(kind==='ship'){
    const sel = $('#drv'); const did = sel ? sel.value : o.driverId;
    if(!did){ toast('Choisis d’abord un livreur'); return; }
    o.driverId = did; o.status='livraison'; log(o, `Partie en livraison avec ${driver(did).name}`); toast('En route !');
  }
  if(kind==='cancel'){ if(o.stockOut){ stockOut(o,-1); o.stockOut=false; } o.status='annulee'; log(o,'Annulée'); toast('Commande annulée'); }
  if(kind==='refuse'){ if(o.stockOut){ stockOut(o,-1); o.stockOut=false; } o.status='refusee'; log(o,'Refusée par le client, colis rendu au stock'); toast('Refus noté. Le colis revient en stock.'); }
  save(); render(); openOrder(o.id);
}
function paid(mode, id){
  const o = S.orders.find(x=>x.id===id); if(!o) return;
  if(mode==='prepaid'){ o.status='livree'; o.pay={mode:o.deposit?.mode||'wave', amount:0, at:Date.now()}; log(o,'Livrée (déjà payée)'); toast('Livrée !'); save(); render(); openOrder(o.id,'confetti'); return; }
  const amount = due(o);
  o.status='livree'; o.pay={mode, amount, at:Date.now()};
  if(mode==='cash'){ const d = driver(o.driverId); if(d) d.cash += amount; log(o, `Livrée, ${F(amount)} en cash remis à ${d?d.name:'le livreur'}`); toast(`${F(amount)} à récupérer auprès de ${d?d.name:'du livreur'}`); }
  else { log(o, `Livrée, payée par ${MODES[mode]}`); toast('Livrée et payée'); }
  save(); render(); openOrder(o.id, 'confetti');
}
function confirmPay(id){
  const o = S.orders.find(x=>x.id===id); if(!o) return;
  const amount = due(o);
  o.deposit = {amount:(o.deposit?.amount||0) + amount, mode:o.payMode||'wave', at:Date.now()};
  o.payState = 'paye'; log(o, `Paiement de ${F(amount)} reçu par ${MODES[o.payMode]}`);
  save(); render(); openOrder(o.id, 'coins'); toast('Paiement confirmé');
}
function notPaid(id){
  const o = S.orders.find(x=>x.id===id); if(!o) return;
  o.payState = 'attente'; log(o, 'Paiement pas encore reçu');
  save(); render(); openOrder(o.id); toast('Noté. Tu peux relancer le client.');
}
function remit(did){
  const d = driver(did); if(!d || !d.cash) return;
  const amount = d.cash; d.remits.push({t:Date.now(), amount}); S.remitsLog = S.remitsLog||[]; S.remitsLog.push({id:uid(), t:Date.now(), amount, driverId:did});
  d.cash = 0; save(); render(); coins(); toast(`${F(amount)} reçus de ${d.name}`);
}
function exportCsv(){
  const rows = [['Commande','Date','Client','Téléphone','Zone','Adresse','Produits','Total (F)','Acompte (F)','Mode acompte','Statut','Livreur','Payé (F)','Mode paiement']];
  S.orders.slice().sort((a,b)=>a.num-b.num).forEach(o=>rows.push([o.num, new Date(o.createdAt).toLocaleString('fr-FR'), o.client.name, o.client.phone, zone(o.zoneId)?.name||'', o.address, itemsText(o), total(o), o.deposit?.amount||0, MODES[o.deposit?.mode]||'', STATUS[o.status].label, driver(o.driverId)?.name||'', o.pay?.amount||0, MODES[o.pay?.mode]||'']));
  const csv = '﻿' + rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(';')).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})); a.download = 'commandes.csv';
  document.body.appendChild(a); a.click(); a.remove(); toast('Fichier téléchargé');
}
/* Photo produit : réduite à 600 px pour tenir dans la mémoire de l'appareil */
let photoTarget = null;
$('#photoInput').addEventListener('change', async e=>{
  const file = e.target.files && e.target.files[0]; e.target.value='';
  const pid = photoTarget;
  if(!file || !pid) return;
  toast('Envoi de la photo…');
  let url = '';
  try{
    url = URL.createObjectURL(file);
    const pub = await uploadPhoto(await toJpegBlob(url), pid);
    const p = product(pid); if(!p) return;
    const old = p.img; p.img = pub;
    if(p.imgs && p.imgs.length) p.imgs = [pub, ...p.imgs.filter(x=>x && x!==old)];
    save(); render(); toast('Photo ajoutée');
  }catch(err){ console.warn(err); toast(errText(err)); }
  finally{ if(url) URL.revokeObjectURL(url); }
});

/* ===================== Notifications ===================== */
function notifState(){
  if(!('Notification' in window)) return 'Ce navigateur ne gère pas les alertes système. Une bannière s’affiche quand même dans l’appli à chaque nouvelle commande.';
  const p = Notification.permission;
  if(p==='granted') return 'Activées : une alerte s’affiche aussi quand l’onglet est en arrière-plan.';
  if(p==='denied') return 'Bloquées par ton navigateur. Autorise-les dans ses réglages.';
  return 'Dans l’appli, une bannière et un son signalent déjà chaque nouvelle commande. Active les alertes pour être prévenu aussi quand l’onglet est en arrière-plan.';
}
async function askNotif(){
  if(!('Notification' in window)){ toast('Ce navigateur ne gère pas les alertes'); return; }
  try{ const p = await Notification.requestPermission(); toast(p==='granted' ? 'Notifications activées' : 'Notifications refusées'); }catch(e){ toast('Impossible d’activer les alertes ici'); }
  render();
}
function beep(){
  try{
    const C = window.AudioContext || window.webkitAudioContext; if(!C) return;
    const ctx = beep.ctx || (beep.ctx = new C()); const t = ctx.currentTime;
    [880, 1320].forEach((f,i)=>{ const os = ctx.createOscillator(), g = ctx.createGain(); os.type='sine'; os.frequency.value=f;
      g.gain.setValueAtTime(0.0001, t+i*.13); g.gain.exponentialRampToValueAtTime(0.16, t+i*.13+.02); g.gain.exponentialRampToValueAtTime(0.0001, t+i*.13+.26);
      os.connect(g); g.connect(ctx.destination); os.start(t+i*.13); os.stop(t+i*.13+.3); });
  }catch(e){}
}
function notify(o, n, kind){
  const pi = payInfo(o), first = (o.client.name||'').split(' ')[0];
  const title = kind==='paid' ? `${first} a signalé son paiement` : (n>1 ? `${n} nouvelles commandes en ligne` : 'Nouvelle commande en ligne');
  const el = $('#notif');
  el.innerHTML = `<span class="ico">${kind==='paid'?I.wallet:I.bag}</span><div style="flex:1;min-width:0"><b>${esc(title)}</b><span class="muted">${esc(o.client.name)} · ${F(total(o))}${pi?` · ${esc(pi.l)}`:''}</span></div><button class="btn small" data-order="${o.id}">Voir</button>`;
  el.classList.add('show'); clearTimeout(notify._t); notify._t = setTimeout(()=>el.classList.remove('show'), 7000);
  beep();
  try{ if('Notification' in window && Notification.permission==='granted' && document.hidden){
    const nn = new Notification(`${title} · ${S.shop.name}`, {body:`${o.client.name} · ${F(total(o))}`});
    nn.onclick = () => { window.focus(); openOrder(o.id); nn.close(); };
  } }catch(e){}
}
/* Vérifie si un autre onglet (la boutique client) a écrit une commande */
function checkNew(){
  if(!S || storeMode() || $('#welcome').classList.contains('show')) return;
  const alerts = S.orders.filter(o=>o.alert);
  if(!alerts.length) return;
  const last = alerts[alerts.length-1], kind = last.alert;
  alerts.forEach(o=>{ delete o.alert; });
  save(); render(); notify(last, alerts.length, kind);
}
function openBell(){
  const list = S.orders.filter(o=>o.source==='boutique').sort((a,b)=>b.createdAt-a.createdAt).slice(0,20);
  openSheet(sheetHead('Commandes en ligne') + (list.length
    ? `<p class="muted" style="margin-top:0">Les commandes passées sur ta boutique. Les nouvelles ont un point rose.</p><div class="olist">${list.map(orderCard).join('')}</div>`
    : `<div class="card" style="text-align:center;padding:26px 16px">${emptyArt()}<h2 style="margin:10px 0 4px">Pas encore de commande en ligne</h2><div class="muted">Partage le lien de ta boutique pour recevoir les premières.</div></div>`));
}

/* ===================== Boutique côté client ===================== */
const STORE_SLUG = new URLSearchParams(location.search).get('b');
const STORE = !!STORE_SLUG;
function storeMode(){ return STORE; }
let cart = {}, co = {name:'', phone:'', zoneId:'', address:'', pay:'cod', note:''};
function cartCount(){ return Object.values(cart).reduce((a,b)=>a+b, 0); }
function cartTotal(){ return Object.entries(cart).reduce((a,[pid,q])=>a + (product(pid)?.price||0)*q, 0); }
function storeCard(p, open){
  const q = cart[p.id]||0, out = !p.preorder && p.stock<=0, cap = p.preorder ? 10 : p.stock;
  const tag = p.badge ? `<span class="tag" style="background:var(--safran)">${esc(p.badge)}</span>` : p.preorder ? '<span class="tag" style="background:var(--bissap)">Sur commande</span>' : out ? '<span class="tag" style="background:var(--ink)">Épuisé</span>' : (p.stock<=p.min ? `<span class="tag">Plus que ${p.stock}</span>` : '');
  const ctrl = (out || !open) ? `<button class="btn ghost small" disabled>${out?'Épuisé':'Fermé'}</button>`
    : q ? `<div class="qty"><button data-sdec="${p.id}" aria-label="Retirer un ${esc(p.name)}">−</button><b class="num">${q}</b><button data-sinc="${p.id}" aria-label="Ajouter un ${esc(p.name)}" ${q>=cap?'disabled':''}>+</button></div>`
    : `<button class="btn small" data-sinc="${p.id}">Ajouter</button>`;
  const more = (p.imgs && p.imgs.length>1) || p.desc;
  return `<div class="sf-card"><button type="button" class="pimg sf-open" data-sview="${p.id}" aria-label="Voir ${esc(p.name)}"><span class="ph" aria-hidden="true">${esc(p.name.charAt(0))}</span>${img(p.img, p.name)}${tag}${p.imgs && p.imgs.length>1?`<span class="nphotos">${p.imgs.length} photos</span>`:''}</button>
    <div class="b"><div><div class="pname">${esc(p.name)}</div>${more?`<button type="button" class="sf-more" data-sview="${p.id}">Voir le détail</button>`:''}<div class="price num">${F(p.price)}${p.oldPrice?` <s class="old">${F(p.oldPrice)}</s>`:''}</div>${p.preorder?`<div class="muted" style="font-size:.8rem">Livré en ${esc(p.delay||'15 à 20 jours')}</div>`:''}</div>${ctrl}</div></div>`;
}
function openStoreProduct(id){
  const p = product(id); if(!p) return;
  const pics = (p.imgs && p.imgs.length ? p.imgs : [p.img]).filter(Boolean);
  const q = cart[p.id]||0, out = !p.preorder && p.stock<=0, open = S.shop.open !== false;
  openSheet(sheetHead(esc(p.name)) + `
    ${pics.length?`<div class="gal" aria-label="Photos">${pics.map((u,i)=>`<img src="${u}" alt="${esc(p.name)}, photo ${i+1}" loading="lazy">`).join('')}</div>${pics.length>1?`<p class="muted" style="text-align:center;margin:6px 0 0;font-size:.8rem">Glissez pour voir les ${pics.length} photos</p>`:''}`:''}
    <div class="row" style="margin-top:12px"><b class="num" style="font-size:1.4rem;white-space:nowrap">${F(p.price)}${p.oldPrice?` <s class="old">${F(p.oldPrice)}</s>`:''}</b><span style="display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end">${p.badge?`<span class="pill" style="background:var(--safran-soft);color:var(--mango-ink)">${esc(p.badge)}</span>`:''}${p.preorder?'<span class="pill" style="background:var(--bissap-soft);color:var(--bissap)">Sur commande</span>':''}</span></div>
    ${p.preorder?`<p class="muted" style="margin:4px 0 0">Livré en ${esc(p.delay||'15 à 20 jours')}.</p>`:''}
    ${p.desc?`<p style="margin:12px 0 0">${esc(p.desc)}</p>`:''}
    <div class="actions">${(out||!open)?`<button class="btn ghost" disabled>${out?'Épuisé':'Fermé'}</button>`:`<button class="btn mango" data-sinc="${p.id}" data-close-after>${q?`Ajouter encore (${q} dans le panier)`:'Ajouter au panier'}</button>`}</div>`);
}
/* ===================== Kado : couverture animée produit par produit ===================== */
const KH = {i:0, timer:null, colors:{}, dur:3600, pause:false};
const KH_FALLBACK = [['#3B2A86','#120C2E'],['#3A8FD0','#123A63'],['#E2453F','#5E0E16'],['#18C29C','#08463A'],['#FF4F3A','#6B160C']];
function khList(){ return S.products.filter(p=>!p.archived && p.img).slice(0,6); }
function khColor(p, k){
  return KH.colors[p.id] || KH_FALLBACK[k % KH_FALLBACK.length];
}
function rgbToHsl(r,g,b){ r/=255; g/=255; b/=255; const mx=Math.max(r,g,b), mn=Math.min(r,g,b); let h=0, s=0; const l=(mx+mn)/2;
  if(mx!==mn){ const d=mx-mn; s = l>.5 ? d/(2-mx-mn) : d/(mx+mn); h = mx===r ? (g-b)/d+(g<b?6:0) : mx===g ? (b-r)/d+2 : (r-g)/d+4; h*=60; } return [h,s,l]; }
function khAnalyse(p){
  if(KH.colors[p.id] || !p.img) return;
  const im = new Image(); im.crossOrigin = 'anonymous';
  im.onload = () => { try{
    const n = 36, cv = document.createElement('canvas'); cv.width = n; cv.height = n; const ctx = cv.getContext('2d');
    ctx.drawImage(im, 0, 0, n, n); const d = ctx.getImageData(0, 0, n, n).data;
    let x=0, y=0, w=0, lsum=0, cnt=0;
    for(let k=0; k<d.length; k+=4){ const [h,s,l] = rgbToHsl(d[k],d[k+1],d[k+2]); if(d[k+3]<128 || l>.93) continue; cnt++; lsum+=l; const wt = s*s + .02; x += Math.cos(h*Math.PI/180)*wt; y += Math.sin(h*Math.PI/180)*wt; w += wt*s; }
    if(!cnt) return;
    const sat = Math.min(.75, w/Math.max(.0001, Math.hypot(x,y)) ), strength = Math.hypot(x,y)/cnt, hue = (Math.atan2(y,x)*180/Math.PI + 360) % 360, lum = lsum/cnt;
    let c;
    if(strength < .035) c = lum > .55 ? ['#A4A9B4','#4E5260'] : ['#3A3A42','#101013'];
    else c = [`hsl(${hue.toFixed(0)} ${Math.round(Math.max(.45,sat)*100)}% 46%)`, `hsl(${hue.toFixed(0)} ${Math.round(Math.max(.45,sat)*100)}% 16%)`];
    KH.colors[p.id] = c;
    const list = khList(); if(list[KH.i] && list[KH.i].id === p.id) khPaint();
  }catch(e){} };
  im.src = p.img;
}
function storeHero(open){
  const list = khList(), sh = S.shop;
  if(KH.i >= list.length) KH.i = 0;
  const wa = phoneOk(sh.whatsapp) ? `https://wa.me/221${phoneDigits(sh.whatsapp)}` : '';
  if(!list.length) return `<section class="kh empty"><div class="kh-top"><img class="kh-logo" src="kado-logo-blanc.svg" alt="${esc(sh.name)}"></div><div class="kh-copy"><h1>Le cadeau qui fait <em>waouh.</em></h1></div></section>`;
  return `<section class="kh" id="kh" aria-roledescription="carrousel" aria-label="Produits à la une">
    <div class="kh-bg"></div><div class="kh-glow"></div>
    <div class="kh-top"><img class="kh-logo" src="kado-logo-blanc.svg" alt="${esc(sh.name)}">${wa?`<a class="kh-wa" href="${wa}" target="_blank" rel="noopener">WhatsApp</a>`:''}</div>
    <div class="kh-copy"><p class="kh-kick">Sélection de fin d’année</p><h1>Le cadeau qui fait <em>waouh.</em></h1></div>
    <div class="kh-stage" id="khStage">${list.map((p,k)=>`<button type="button" class="kh-item" data-k="${k}" data-sview="${p.id}" aria-label="Voir ${esc(p.name)}" tabindex="-1"><span class="kh-card"><img src="${esc(p.img)}" alt="" ${k===0?'':'loading="lazy"'} decoding="async"></span></button>`).join('')}${list.length>1?`<button type="button" class="kh-next" id="khNext" aria-label="Produit suivant"><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" class="kh-ring-bg"/><circle cx="32" cy="32" r="30" class="kh-ring" id="khRing"/></svg><img id="khNextImg" alt=""></button>`:''}</div>
    <div class="kh-info" aria-live="polite">${list.map((p,k)=>{ const q = cart[p.id]||0, out = !p.preorder && p.stock<=0;
      return `<div class="kh-slide" data-k="${k}">
        <div class="kh-name">${esc(p.name)}</div>
        <div class="kh-price"><b class="num">${F(p.price)}</b>${p.oldPrice?`<s class="num">${F(p.oldPrice)}</s>`:''}</div>
        <div class="kh-sub">${p.freeShipping?'Livraison offerte':p.preorder?`Sur commande · livré en ${esc(p.delay||'15 à 20 jours')}`:'En stock · livré à Dakar'}</div>
        <div class="kh-cta">${(out||!open)?`<span class="kh-btn off">${out?'Épuisé':'Fermé'}</span>`:`<button type="button" class="kh-btn" data-sinc="${p.id}">${q?`Dans le panier (${q}) · +1`:'Commander'}</button>`}<button type="button" class="kh-link" data-sview="${p.id}">Voir le détail</button></div>
      </div>`; }).join('')}</div>
    ${list.length>1?`
    <div class="kh-dots">${list.map((p,k)=>`<button type="button" data-khgo="${k}" aria-label="Produit ${k+1}"></button>`).join('')}</div>`:''}
  </section>`;
}
function khPaint(){
  const el = $('#kh'); if(!el) return;
  const list = khList(), k = KH.i, p = list[k]; if(!p) return;
  const [c1,c2] = khColor(p, k);
  el.style.setProperty('--c1', c1); el.style.setProperty('--c2', c2);
  el.querySelectorAll('.kh-item').forEach(it=>{ const d = (+it.dataset.k - k + list.length) % list.length; it.className = 'kh-item ' + (d===0?'on':d===1?'nx':d===list.length-1?'pv':'off'); });
  el.querySelectorAll('.kh-slide').forEach(s=>s.classList.toggle('on', +s.dataset.k===k));
  el.querySelectorAll('[data-khgo]').forEach(b=>b.classList.toggle('on', +b.dataset.khgo===k));
  const nx = list[(k+1)%list.length], ni = $('#khNextImg'); if(ni && nx) ni.src = nx.img;
  const ring = $('#khRing'); if(ring){ ring.style.animation = 'none'; void ring.getBoundingClientRect(); ring.style.animation = (REDUCED||KH.pause) ? 'none' : `khring ${KH.dur}ms linear forwards`; }
}
function khGo(k){ const n = khList().length; if(!n) return; KH.i = (k + n) % n; khPaint(); khSchedule(); }
function khSchedule(){
  clearTimeout(KH.timer);
  if(REDUCED || KH.pause || khList().length < 2) return;
  KH.timer = setTimeout(()=>{ if(!document.hidden && $('#kh')) khGo(KH.i + 1); else khSchedule(); }, KH.dur);
}
function khBind(){
  const el = $('#kh'); if(!el) return;
  khList().forEach(khAnalyse);
  khPaint(); khSchedule();
  const st = $('#khStage'); let x0 = null, moved = false;
  st.addEventListener('pointerdown', e=>{ x0 = e.clientX; moved = false; });
  st.addEventListener('pointermove', e=>{ if(x0!==null && Math.abs(e.clientX-x0) > 12) moved = true; });
  st.addEventListener('pointerup', e=>{ if(x0===null) return; const dx = e.clientX - x0; x0 = null; if(Math.abs(dx) > 40){ khGo(KH.i + (dx<0?1:-1)); } });
  st.addEventListener('click', e=>{ if(moved){ e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
  el.addEventListener('mouseenter', ()=>{ KH.pause = true; khPaint(); clearTimeout(KH.timer); });
  el.addEventListener('mouseleave', ()=>{ KH.pause = false; khPaint(); khSchedule(); });
}
function renderStore(){
  document.body.classList.add('storefront');
  $('.app').style.display = 'none'; $('#tabs').style.display = 'none';
  Object.keys(cart).forEach(pid=>{ const p = product(pid); const cap = p && p.preorder ? 10 : (p ? p.stock : 0); if(!p || cap<=0) delete cart[pid]; else if(cart[pid] > cap) cart[pid] = cap; });
  const sh = S.shop, open = sh.open !== false, n = cartCount();
  document.title = `${sh.name} · Le cadeau qui fait waouh`;
  const root = $('#store'); root.hidden = false;
  root.innerHTML = `<div class="sf">
    ${storeHero(open)}
    <div class="sf-head kado">
      <div class="sf-meta"><span class="${open?'sf-open':''}">${open?'Ouvert, commandes acceptées':'Fermé pour le moment'}</span><span>Livraison partout à Dakar</span><span>${['Cash', phoneOk(sh.wave)?'Wave':'', phoneOk(sh.om)?'Orange Money':''].filter(Boolean).join(', ').replace(/, ([^,]*)$/, ' ou $1')}</span></div>
      <h2 class="sf-title">Tous nos cadeaux</h2>
    </div>
    ${open ? '' : '<div class="card" style="margin:16px 18px 0">La boutique ne prend pas de commandes en ce moment. Revenez bientôt.</div>'}
    <div class="sf-grid">${S.products.filter(p=>!p.archived).map(p=>storeCard(p, open)).join('')}</div>
    <div class="sf-foot"><img src="kado-logo.svg" alt="kado" style="height:22px"><span>· boutique propulsée par</span> ${logo(false, 18)}</div>
  </div>
  ${n ? `<div class="cartbar"><button class="btn mango" id="cartBtn"><span>Voir le panier · ${n} article${n>1?'s':''}</span><b class="num">${F(cartTotal())}</b></button></div>` : ''}`;
  khBind();
}
function readCo(){
  co.name = $('#c-name').value.trim(); co.phone = $('#c-phone').value.trim(); co.zoneId = $('#c-zone').value;
  co.address = $('#c-addr').value.trim(); co.pay = (document.querySelector('input[name="c-pay"]:checked')||{}).value || 'cod'; co.note = $('#c-note').value.trim();
}
function cartFree(){ const ids = Object.keys(cart).filter(pid=>product(pid)); return ids.length>0 && ids.every(pid=>product(pid).freeShipping); }
function openCheckout(){
  if(!co.zoneId) co.zoneId = S.zones[0]?.id;
  const free = cartFree(), tot = cartTotal();
  const payOpts = [['cod','À la livraison, en cash'], ...(phoneOk(S.shop.wave)?[['wave','Wave, maintenant']]:[]), ...(phoneOk(S.shop.om)?[['om','Orange Money, maintenant']]:[])];
  if(!payOpts.some(([k])=>k===co.pay)) co.pay = 'cod';
  openSheet(sheetHead('Votre commande') + `
    <div class="totals">${Object.entries(cart).map(([pid,q])=>`<div class="row"><span>${q} × ${esc(product(pid).name)}</span><span class="num">${F(product(pid).price*q)}</span></div>`).join('')}
      <div class="row"><span>Livraison</span><span>${free ? '<b style="color:var(--baobab)">Offerte</b>' : '<span class="muted">Tarif du livreur, payé à la livraison</span>'}</span></div>
      <div class="row grand"><span>Total</span><span class="num">${F(tot)}</span></div></div>
    <form id="checkoutForm" novalidate>
      <div class="field"><label for="c-name">Votre nom</label><input id="c-name" type="text" value="${esc(co.name)}" autocomplete="name"></div>
      <div class="field"><label for="c-phone">Votre numéro WhatsApp</label><input id="c-phone" type="tel" value="${esc(co.phone)}" placeholder="77 123 45 67" autocomplete="tel"></div>
      <div class="field"><label for="c-zone">Zone de livraison</label><select id="c-zone">${S.zones.map(zz=>`<option value="${zz.id}" ${co.zoneId===zz.id?'selected':''}>${esc(zz.name)}</option>`).join('')}</select></div>
      <div class="field"><label for="c-addr">Adresse et repère</label><input id="c-addr" type="text" value="${esc(co.address)}" placeholder="Ex. : Ouakam, cité Avion, villa 8"></div>
      <label>Paiement</label>
      <div class="radio" style="margin-bottom:12px">${payOpts.map(([k,l])=>`<label><input type="radio" name="c-pay" value="${k}" ${co.pay===k?'checked':''}> ${l}</label>`).join('')}</div>
      <div class="field"><label for="c-note">Note pour la boutique (facultatif)</label><input id="c-note" type="text" value="${esc(co.note)}" placeholder="Ex. : appelez avant d’arriver"></div>
      <p class="warn" id="c-err" hidden></p>
      <button class="btn mango block" type="submit">Envoyer ma commande · ${F(tot)}</button>
    </form>`);
  $('#c-zone').addEventListener('change', ()=>{ readCo(); const y = $('#sheet').scrollTop; openCheckout(); $('#sheet').scrollTop = y; });
  $('#checkoutForm').addEventListener('submit', submitCheckout);
}
async function submitCheckout(e){
  e.preventDefault(); readCo();
  const err = $('#c-err'), fail = m => { err.textContent = m; err.hidden = false; };
  if(!cartCount()) return fail('Votre panier est vide.');
  if(!co.name) return fail('Indiquez votre nom.');
  if(!phoneOk(co.phone)) return fail('Le numéro doit avoir 9 chiffres et commencer par 70, 75, 76, 77 ou 78.');
  if(!co.address) return fail('Indiquez votre adresse ou un repère.');
  const btn = $('#checkoutForm button[type=submit]'); btn.disabled = true; const label = btn.textContent; btn.textContent = 'Envoi en cours…';
  const items = Object.entries(cart).filter(([pid])=>product(pid)).map(([id, qty])=>({id, qty}));
  const {data, error} = await sb.rpc('place_order', {p_slug:STORE_SLUG, p_name:co.name, p_phone:phoneDigits(co.phone), p_zone:co.zoneId||'', p_address:co.address,
    p_pay:co.pay, p_note:co.note, p_items:items});
  if(error || !data){ btn.disabled = false; btn.textContent = label; return fail(clientErr(error)); }
  const now = Date.now();
  const o = {id:data.id, token:data.token, num:data.num, createdAt:now, client:{name:data.client_name, phone:data.client_phone}, zoneId:data.zone, address:data.address,
    items:(data.items||[]).map(i=>({pid:i.pid, name:i.name, qty:i.qty, price:i.price})), fee:0, feeNote:data.fee_note||'livreur', deposit:{amount:0, mode:'', at:now},
    day:'Dès que possible', status:'nouvelle', source:'boutique', payState:data.pay_state, payMode:data.pay_mode, history:[]};
  S.orders = [o];
  cart = {}; renderStore(); showThanks(o.id);
  loadStore().then(ok=>{ if(ok && !$('#sheet').classList.contains('show')) renderStore(); }).catch(()=>{});
}
function showThanks(id){
  const o = S.orders.find(x=>x.id===id); if(!o) return;
  const num = o.payMode==='om' ? S.shop.om : S.shop.wave;
  const wa = S.shop.whatsapp, waOk = phoneOk(wa) && !phoneDemo(wa);
  const waHref = waOk ? `https://wa.me/221${phoneDigits(wa)}?text=${encodeURIComponent(`Bonjour, je viens de passer la commande #${o.num??'…'} sur votre boutique.`)}` : '#';
  openSheet(sheetHead('Commande envoyée') + `
    <svg class="bigcheck" viewBox="0 0 32 32" fill="none" aria-hidden="true"><circle cx="16" cy="16" r="15" fill="#1F9D6A"/><path d="M9 16.5l4.5 4.5L23 11.5" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
    <h2 style="text-align:center;margin:0 0 4px;letter-spacing:-.02em">Merci ${esc(o.client.name.split(' ')[0])} !</h2>
    <p class="muted" style="text-align:center;margin:0 0 6px">Commande #${o.num??'…'} reçue par ${esc(S.shop.name)}. La boutique vous contacte sur WhatsApp pour la livraison.</p>
    ${o.payState==='attente' ? `<div class="payinfo"><b>Pour valider, envoyez ${F(total(o))} par ${MODES[o.payMode]}</b><div style="margin:6px 0 12px">au <b>${esc(fmtPhone(num))}</b> (${esc(S.shop.name)}), en indiquant #${o.num??'…'}.</div><button class="btn mango block" data-declare="${o.id}">J’ai envoyé le paiement</button></div>` : ''}
    ${o.payState==='a_verifier' ? `<div class="payinfo" style="background:var(--baobab-soft)"><b>Paiement signalé.</b> La boutique le vérifie et confirme votre commande.</div>` : ''}
    ${o.payState==='cod' ? `<div class="payinfo" style="background:var(--soft)">Vous payez ${F(total(o))} à la livraison.</div>` : ''}
    <p class="muted" style="text-align:center;margin:8px 0 0">${o.feeNote==='offerte' ? 'Livraison offerte.' : o.feeNote==='livreur' ? 'Frais de livraison : tarif du livreur, à lui payer à la livraison.' : ''}</p>
    <div class="actions">
      <a class="btn wa" href="${waHref}" target="_blank" rel="noopener" ${waOk?'':'aria-disabled="true" tabindex="-1"'}>${I.wa} Écrire à la boutique</a>
      <button class="btn ghost" data-close>Retour à la boutique</button>
    </div>
`);
}
async function declarePaid(id){
  const o = S.orders.find(x=>x.id===id); if(!o) return;
  const b = document.querySelector(`[data-declare="${id}"]`); if(b){ b.disabled = true; b.textContent = 'Envoi…'; }
  const {data, error} = await sb.rpc('declare_paid', {p_order:o.id, p_token:o.token});
  if(error){ toast(clientErr(error)); if(b){ b.disabled = false; b.textContent = 'J’ai envoyé le paiement'; } return; }
  o.payState = data.pay_state; showThanks(id);
}

/* ===================== Événements ===================== */
document.addEventListener('click', e=>{
  const t = e.target.closest('button, a'); if(!t) return;
  if(t.closest('#notif')) $('#notif').classList.remove('show');
  if(t.dataset.sview){ return openStoreProduct(t.dataset.sview); }
  if(t.hasAttribute('data-paysub')){ subMonths = 1; return openPaySheet(); }
  if(t.hasAttribute('data-admin')) return openAdmin();
  if(t.dataset.submonths){ subMonths = +t.dataset.submonths; return $('#sheet').classList.contains('show') ? openPaySheet() : paywall(); }
  if(t.dataset.submode){ subPayMode = t.dataset.submode; return $('#sheet').classList.contains('show') ? openPaySheet() : paywall(); }
  if(t.hasAttribute('data-subretry')){ SUB.pending = null; return $('#sheet').classList.contains('show') ? openPaySheet() : paywall(); }
  if(t.dataset.copy){ try{ navigator.clipboard.writeText(t.dataset.copy); toast('Numéro copié'); }catch(e){} return; }
  if(t.dataset.subok){ t.disabled = true; return adminAct('admin_decide_payment', {p_id:t.dataset.subok, p_ok:true}, 'Paiement validé, abonnement prolongé'); }
  if(t.dataset.subko){ if(!confirm('Refuser ce paiement ?')) return; return adminAct('admin_decide_payment', {p_id:t.dataset.subko, p_ok:false}, 'Paiement refusé'); }
  if(t.dataset.subplus){ if(!confirm('Ajouter 1 mois à cette boutique (paiement reçu en main propre) ?')) return; return adminAct('admin_extend', {p_shop:t.dataset.subplus, p_months:1}, '1 mois ajouté'); }
  if(t.id==='khNext'){ khGo(KH.i + 1); return; }
  if(t.dataset.khgo){ khGo(+t.dataset.khgo); return; }
  if(t.dataset.sinc){ const p = product(t.dataset.sinc); if(p){ cart[p.id] = Math.min(p.preorder ? 10 : p.stock, (cart[p.id]||0) + 1); if(t.hasAttribute('data-close-after')){ closeSheet(); toast('Ajouté au panier'); } renderStore(); } return; }
  if(t.dataset.sdec){ const k = t.dataset.sdec; cart[k] = (cart[k]||0) - 1; if(cart[k] <= 0) delete cart[k]; renderStore(); return; }
  if(t.id==='cartBtn') return openCheckout();
  if(t.dataset.declare) return declarePaid(t.dataset.declare);
  if(t.matches('[data-bell]')) return openBell();
  if(t.id==='copyLink') return copyText(shopLink(), 'Lien de la boutique copié');
  if(t.id==='notifBtn') return askNotif();
  if(t.dataset.confirmpay) return confirmPay(t.dataset.confirmpay);
  if(t.dataset.notpaid) return notPaid(t.dataset.notpaid);
  if(t.matches('[data-close]')) return closeSheet();
  if(t.dataset.route){ closeSheet(); return go(t.dataset.route, t.dataset.filter); }
  if(t.dataset.filterChip){ filter = t.dataset.filterChip; render(); return; }
  if(t.matches('[data-new]')) return openNew();
  if(t.dataset.order) return openOrder(t.dataset.order);
  if(t.dataset.msg) return openMessage(t.dataset.msg, t.dataset.id);
  if(t.dataset.act) return act(t.dataset.act, t.dataset.id);
  if(t.dataset.paid) return paid(t.dataset.paid, t.dataset.id);
  if(t.dataset.remit) return remit(t.dataset.remit);
  if(t.dataset.photo){ photoTarget = t.dataset.photo; $('#photoInput').click(); return; }
  if(t.dataset.archive){ const p = product(t.dataset.archive); if(p){ p.archived = !p.archived; save(); render(); toast(p.archived?'Produit archivé : retiré de la boutique':'Produit remis en vente'); } return; }
  if(t.dataset.stock){ const p = product(t.dataset.stock); p.stock = Math.max(0, p.stock + Number(t.dataset.d)); save(); render(); return; }
  if(t.id==='exportCsv') return exportCsv();
  if(t.id==='logout') return logout();
  if(t.id==='importStarter') return importStarter(t);
  if(t.id==='retryBoot') return location.reload();
  if(t.dataset.auth){ if(t.dataset.auth==='logout') return logout(); return authScreen(t.dataset.auth); }
});
document.addEventListener('submit', e=>{
  const f = e.target;
  if(f.id==='authForm') return onAuth(e);
  if(f.id==='subForm') return submitSub(e);
  if(f.id==='addDriver'){ e.preventDefault(); const d = Object.fromEntries(new FormData(f)); if(!phoneOk(d.phone)){ toast('Numéro invalide : 9 chiffres commençant par 7'); return; } S.drivers.push({id:uid(), name:d.name.trim(), phone:fmtPhone(d.phone), cash:0, remits:[]}); save(); render(); toast('Livreur ajouté'); }
  if(f.id==='addProduct'){ e.preventDefault(); const d = Object.fromEntries(new FormData(f)); const name=d.name.trim(); S.products.push({id:uid(), name, price:Number(d.price)||0, stock:Number(d.stock)||0, min:3, kw:[norm(name).split(' ')[0]], img:'', preorder:d.preorder==='on', delay:'15 à 20 jours', sort:S.products.reduce((a,p)=>Math.max(a,p.sort||0),0)+1}); save(); render(); toast('Produit ajouté'); }
  if(f.id==='shopForm'){ e.preventDefault(); const d = new FormData(f); const name = String(d.get('name')||'').trim();
    if(!name){ toast('Donne un nom à ta boutique'); return; }
    for(const k of ['whatsapp','wave','om']){ const v = String(d.get(k)||'').trim(); if(v && !phoneOk(v)){ toast('Numéro invalide : 9 chiffres commençant par 7'); return; } }
    Object.assign(S.shop, {name, desc:String(d.get('desc')||'').trim(), whatsapp:fmtPhone(d.get('whatsapp')), wave:fmtPhone(d.get('wave')), om:fmtPhone(d.get('om')), open:d.get('open')==='on'});
    save(); render(); toast('Boutique enregistrée'); }
});
document.addEventListener('change', e=>{
  const z = e.target.dataset && e.target.dataset.zone;
  if(z){ const zz = zone(z); zz.fee = Number(e.target.value)||0; save(); toast('Tarif enregistré'); }
});
$('#overlay').addEventListener('click', closeSheet);
document.addEventListener('keydown', e=>{ if(e.key==='Escape' && $('#sheet').classList.contains('show')) closeSheet(); });

/* ===================== Compte : connexion, inscription, mot de passe ===================== */
let RECOVERY = /type=recovery/.test(location.hash);
function baseUrl(){ return location.origin + location.pathname; }
function authScreen(mode, msg, ok){
  const meta = (USER && USER.user_metadata) || {};
  const linkBtn = (m, t) => `<button type="button" class="linkbtn" data-auth="${m}">${t}</button>`;
  const field = (id, label, type, attrs='') => `<div class="field"><label for="${id}">${label}</label><input id="${id}" name="${id}" type="${type}" ${attrs}></div>`;
  const F_ = {
    loading: `<h1>Comptoir <em>arrive…</em></h1><p class="lead">Chargement de ta boutique.</p>`,
    login: `<h1>Bon retour <em>au comptoir.</em></h1>
      <form id="authForm" data-mode="login" class="auth" novalidate>
        ${field('email','Email','email','autocomplete="email" inputmode="email" required')}
        ${field('password','Mot de passe','password','autocomplete="current-password" required')}
        <button class="btn mango block" type="submit">Me connecter</button>
        <div class="auth-links">${linkBtn('forgot','Mot de passe oublié ?')}${linkBtn('signup','Créer mon compte')}</div>
      </form>`,
    signup: `<h1>Ouvre <em>ton comptoir.</em></h1>
      <form id="authForm" data-mode="signup" class="auth" novalidate>
        ${field('shop','Nom de la boutique','text',`value="${esc(CFG.shopName||'')}" required`)}
        ${field('whatsapp','Ton numéro WhatsApp','tel',`value="${esc(CFG.whatsapp||'')}" placeholder="77 123 45 67" autocomplete="tel"`)}
        ${field('email','Email','email','autocomplete="email" inputmode="email" required')}
        ${field('password','Mot de passe (8 caractères minimum)','password','autocomplete="new-password" minlength="8" required')}
        <button class="btn mango block" type="submit">Créer mon compte</button>
        <div class="auth-links">${linkBtn('login','J’ai déjà un compte')}</div>
      </form>`,
    forgot: `<h1>Nouveau <em>mot de passe.</em></h1>
      <form id="authForm" data-mode="forgot" class="auth" novalidate>
        <p class="lead" style="margin:0">Tape ton email : tu reçois un lien pour choisir un nouveau mot de passe.</p>
        ${field('email','Email','email','autocomplete="email" inputmode="email" required')}
        <button class="btn mango block" type="submit">Recevoir le lien</button>
        <div class="auth-links">${linkBtn('login','Retour à la connexion')}</div>
      </form>`,
    reset: `<h1>Choisis ton <em>mot de passe.</em></h1>
      <form id="authForm" data-mode="reset" class="auth" novalidate>
        ${field('password','Nouveau mot de passe (8 caractères minimum)','password','autocomplete="new-password" minlength="8" required')}
        <button class="btn mango block" type="submit">Enregistrer</button>
      </form>`,
    shop: `<h1>Dernière étape : <em>ta boutique.</em></h1>
      <form id="authForm" data-mode="shop" class="auth" novalidate>
        ${field('shop','Nom de la boutique','text',`value="${esc(meta.shop_name||CFG.shopName||'')}" required`)}
        ${field('whatsapp','Ton numéro WhatsApp (aussi pour Orange Money)','tel',`value="${esc(meta.whatsapp||CFG.whatsapp||'')}" placeholder="77 123 45 67"`)}
        <button class="btn mango block" type="submit">Créer ma boutique</button>
        <div class="auth-links">${linkBtn('logout','Me déconnecter')}</div>
      </form>`,
    check: `<h1>Regarde <em>tes mails.</em></h1>
      <p class="lead">Un email de confirmation vient de partir. Ouvre-le sur ce téléphone et touche le lien : ta boutique s’ouvre ensuite toute seule.</p>
      <div class="auth-links">${linkBtn('login','J’ai confirmé, me connecter')}</div>`,
    offline: `<h1>Pas de <em>connexion.</em></h1>
      <p class="lead">Impossible de joindre ta boutique. Vérifie ton réseau puis réessaie.</p>
      <button class="btn mango block" type="button" id="retryBoot">Réessayer</button>`
  };
  const w = $('#welcome');
  w.innerHTML = `<div class="w-photo short cover"><img src="cover.jpg" alt="Vendeuse de Comptoir qui suit ses ventes sur son téléphone" decoding="async"><div class="w-top">${logo(true,36)}</div></div>
    <div class="w-body">${F_[mode]}<p class="auth-msg${ok?' ok':''}" id="authMsg" role="alert">${esc(msg||'')}</p></div>`;
  w.classList.add('show');
  const first = w.querySelector('input'); if(first && !first.value) setTimeout(()=>first.focus(), 50);
}
async function onAuth(e){
  e.preventDefault();
  const f = e.target, mode = f.dataset.mode, d = Object.fromEntries(new FormData(f));
  const btn = f.querySelector('button[type=submit]');
  const msg = (t, ok) => { const m = $('#authMsg'); if(m){ m.textContent = t; m.className = 'auth-msg' + (ok?' ok':''); } };
  const email = String(d.email||'').trim().toLowerCase(), pw = String(d.password||'');
  if(('email' in d) && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return msg('Tape un email valide.');
  if((mode==='signup' || mode==='reset') && pw.length < 8) return msg('Mot de passe trop court : au moins 8 caractères.');
  if(mode==='login' && !pw) return msg('Tape ton mot de passe.');
  if((mode==='signup' || mode==='shop') && !String(d.shop||'').trim()) return msg('Donne un nom à ta boutique.');
  if((mode==='signup' || mode==='shop') && String(d.whatsapp||'').trim() && !phoneOk(d.whatsapp)) return msg('Numéro invalide : 9 chiffres commençant par 70, 75, 76, 77 ou 78.');
  btn.disabled = true;
  try{
    if(mode==='login'){
      const {data, error} = await sb.auth.signInWithPassword({email, password:pw}); if(error) throw error;
      await afterLogin(data.user);
    } else if(mode==='signup'){
      const {data, error} = await sb.auth.signUp({email, password:pw, options:{data:{shop_name:String(d.shop).trim(), whatsapp:fmtPhone(d.whatsapp||'')}, emailRedirectTo:baseUrl()}});
      if(error) throw error;
      if(data.user && Array.isArray(data.user.identities) && data.user.identities.length===0) throw new Error('already registered');
      if(data.session) await afterLogin(data.user); else { USER = data.user; authScreen('check'); }
    } else if(mode==='forgot'){
      const {error} = await sb.auth.resetPasswordForEmail(email, {redirectTo:baseUrl()}); if(error) throw error;
      msg('C’est parti. Ouvre le mail reçu et touche le lien pour choisir un nouveau mot de passe.', true);
    } else if(mode==='reset'){
      const {error} = await sb.auth.updateUser({password:pw}); if(error) throw error;
      RECOVERY = false; try{ history.replaceState(null, '', baseUrl()); }catch(e2){}
      const {data:{user}} = await sb.auth.getUser();
      toast('Mot de passe enregistré'); await afterLogin(user);
    } else if(mode==='shop'){
      const {error} = await sb.rpc('create_shop', {p_name:String(d.shop).trim(), p_whatsapp:phoneDigits(d.whatsapp||'')}); if(error) throw error;
      const {data:sh} = await sb.from('shops').select('id').eq('owner', USER.id).maybeSingle();
      if(sh) await sb.from('shops').update({descr:CFG.shopDesc||'', wave:CFG.wave||''}).eq('id', sh.id);
      await afterLogin(USER);
    }
  }catch(err){ console.warn(err); msg(errText(err)); }
  finally{ if(document.body.contains(btn)) btn.disabled = false; }
}
async function afterLogin(user){
  USER = user;
  authScreen('loading');
  try{
    const ok = await loadAll();
    if(!ok) return authScreen('shop');
    await loadSub();
    if(!SUB.active) return paywall();
    startApp();
    setInterval(subWatch, 10 * 60 * 1000);
    if(SUB.is_admin){ setTimeout(adminCheck, 1500); setInterval(adminCheck, 2 * 60 * 1000); }
    setTimeout(subWatch, 1200);
  }catch(e){ console.warn(e); authScreen(isNetErr(e) ? 'offline' : 'login', isNetErr(e) ? '' : errText(e)); }
}
let started = false;
function startApp(){
  $('#welcome').classList.remove('show');
  const h = (location.hash||'').slice(1); if(ROUTES.some(r=>r[0]===h)) route = h;
  render();
  if(started) return;
  started = true;
  listenRealtime();
  setInterval(()=>{ if(!document.hidden) poll(); }, 20000);
  window.addEventListener('focus', poll);
  document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) poll(); });
  window.addEventListener('online', ()=>{ if(pending) flush(); poll(); });
  setTimeout(checkNew, 900);
}
async function logout(){
  try{ if(pending) await flush(); await sb.auth.signOut(); }catch(e){}
  location.replace(baseUrl());
}

/* ===================== Abonnement Comptoir (9 900 F, échéance le 5) ===================== */
let SUB = null, subTimer = null, subPayMode = 'om', subMonths = 1, adminSeen = -1;
const MOIS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
function dateFr(iso){ if(!iso) return ''; const d = new Date(iso); const k = new Date(d.getTime()); return `${k.getUTCDate()} ${MOIS[k.getUTCMonth()]} ${k.getUTCFullYear()}`; }
function daysLeft(iso){ if(!iso) return -1; return Math.ceil((Date.parse(iso) - Date.now()) / 86400000); }
async function loadSub(){ const {data, error} = await sb.rpc('my_subscription'); if(error) throw error; SUB = data; return SUB; }
function subBanner(){
  if(!SUB || SUB.exempt || !SUB.active) return '';
  if(SUB.pending) return `<div class="subbar wait"><span>⏳ Paiement de ${F(SUB.pending.amount)} envoyé. On le vérifie, ton abonnement sera prolongé.</span></div>`;
  const d = daysLeft(SUB.paid_until);
  if(d > (SUB.notice_days || 5)) return '';
  const when = d <= 0 ? 'aujourd’hui' : d === 1 ? 'demain' : `dans ${d} jours`;
  return `<div class="subbar ${d<=1?'hot':''}"><span>🔔 Ton abonnement Comptoir se termine ${when} (${dateFr(SUB.paid_until)}). Paie avant pour ne pas être bloqué.</span><button class="btn small mango" data-paysub>Payer ${F(SUB.price)}</button></div>`;
}
function payBox(inSheet){
  const s = SUB || {}, modes = [['om','Orange Money', s.om], ['wave','Wave', s.wave]].filter(m=>phoneOk(m[2]));
  if(!modes.some(m=>m[0]===subPayMode)) subPayMode = (modes[0]||['om'])[0];
  const num = (modes.find(m=>m[0]===subPayMode)||[])[2] || '';
  const total = (s.price||9900) * subMonths;
  if(s.pending) return `<div class="paybox">
      <div class="pb-ok">⏳</div><h3>Paiement reçu, en cours de vérification</h3>
      <p>${F(s.pending.amount)} par ${s.pending.mode==='wave'?'Wave':'Orange Money'} · référence <b>${esc(s.pending.ref)}</b>.<br>On vérifie et on active ton compte, en général en moins d’une heure. ${inSheet?'':'Cette page s’ouvre toute seule dès que c’est validé.'}</p>
      ${phoneOk(s.whatsapp)?`<a class="btn ${inSheet?'':'mango'} block" target="_blank" rel="noopener" href="https://wa.me/221${phoneDigits(s.whatsapp)}?text=${encodeURIComponent(`Bonjour, je viens de payer mon abonnement Comptoir pour la boutique « ${s.shop_name||''} ». Montant : ${F(s.pending.amount)}. Référence : ${s.pending.ref}.`)}">Prévenir sur WhatsApp</a>`:''}
      <button type="button" class="linkbtn" data-subretry>Je me suis trompé, refaire la déclaration</button>
    </div>`;
  return `<form id="subForm" class="paybox" novalidate>
    ${s.refused?`<p class="pb-err">Le paiement avec la référence « ${esc(s.refused.ref)} » n’a pas été retrouvé. Vérifie le code et recommence.</p>`:''}
    <div class="pb-months">${[1,3,6,12].map(m=>`<button type="button" class="${m===subMonths?'on':''}" data-submonths="${m}">${m} mois<small>${F((s.price||9900)*m)}</small></button>`).join('')}</div>
    <ol class="pb-steps">
      <li><b>Envoie ${F(total)}</b> par ${modes.length>1?`<span class="pb-modes">${modes.map(m=>`<button type="button" class="${m[0]===subPayMode?'on':''}" data-submode="${m[0]}">${m[1]}</button>`).join('')}</span>`:esc((modes[0]||['', 'Orange Money'])[1])} au <b class="num">${esc(num)}</b> <button type="button" class="linkbtn" data-copy="${esc(phoneDigits(num))}">copier</button>
        ${subPayMode==='om'?`<br><a class="linkbtn" href="tel:%23144%23">Ouvrir Orange Money (#144#)</a>`:''}</li>
      <li><b>Recopie la référence</b> reçue par SMS après le paiement.</li>
    </ol>
    <div class="field"><label for="subRef">Référence de la transaction</label><input id="subRef" name="ref" type="text" autocomplete="off" placeholder="Ex. : MP251109.1532.A12345"></div>
    <div class="field"><label for="subPhone">Numéro qui a payé</label><input id="subPhone" name="phone" type="tel" placeholder="77 123 45 67" value="${esc(S?.shop?.whatsapp||'')}"></div>
    <p class="pb-err" id="subErr" hidden></p>
    <button class="btn mango block" type="submit">J’ai payé ${F(total)}</button>
    <p class="pb-note">Échéance le ${s.due_day||5} de chaque mois. On te prévient quelques jours avant.</p>
  </form>`;
}
function paywall(msg){
  const s = SUB || {};
  const w = $('#welcome');
  const first = !s.paid_until;
  w.innerHTML = `<div class="w-photo short cover"><img src="cover.jpg" alt="" decoding="async"><div class="w-top">${logo(true,36)}</div></div>
    <div class="w-body pay">
      <h1>${first?'Active ton <em>Comptoir.</em>':'Ton abonnement est <em>terminé.</em>'}</h1>
      <p class="lead">${first?`Un seul prix, tout compris : <b>${F(s.price||9900)} par mois</b>. Paie une première fois pour ouvrir ta boutique.`:`Il s’est terminé le ${dateFr(s.paid_until)}. Ta boutique est fermée aux clients et tes données sont gardées : paie pour tout retrouver.`}</p>
      ${payBox(false)}
      ${msg?`<p class="auth-msg">${esc(msg)}</p>`:''}
      <div class="auth-links">${s.is_admin?'':''}<button type="button" class="linkbtn" data-auth="logout">Me déconnecter</button></div>
    </div>`;
  w.classList.add('show');
  clearInterval(subTimer);
  subTimer = setInterval(async ()=>{
    if(document.hidden) return;
    try{ const was = !!(SUB && SUB.pending); await loadSub(); if(SUB.active){ clearInterval(subTimer); location.reload(); } else if(!!SUB.pending !== was) paywall(); }catch(e){}
  }, 15000);
}
async function submitSub(e){
  e.preventDefault();
  const f = e.target, ref = f.ref.value.trim(), phone = f.phone.value.trim(), err = f.querySelector('#subErr');
  const fail = m => { err.textContent = m; err.hidden = false; };
  if(ref.length < 4) return fail('Recopie la référence reçue par SMS après le paiement.');
  if(!phoneOk(phone)) return fail('Numéro invalide : 9 chiffres commençant par 70, 75, 76, 77 ou 78.');
  const b = f.querySelector('button[type=submit]'); b.disabled = true;
  const {data, error} = await sb.rpc('declare_subscription', {p_mode:subPayMode, p_ref:ref, p_phone:phoneDigits(phone), p_months:subMonths});
  b.disabled = false;
  if(error) return fail(errText(error));
  SUB = data;
  if(SUB.active){ toast('Paiement envoyé : on le vérifie'); closeSheet(); render(); } else paywall();
}
function openPaySheet(){ openSheet(sheetHead('Payer mon abonnement') + `<p class="muted" style="margin-top:0">${F(SUB.price)} par mois. Ton abonnement actuel va jusqu’au ${dateFr(SUB.paid_until)} : le paiement s’ajoute à la suite.</p>` + payBox(true)); }
function subCard(){
  if(!SUB) return '';
  const st = SUB.exempt ? 'Offert (boutique du patron)' : SUB.active ? `Actif jusqu’au ${dateFr(SUB.paid_until)}` : 'Non payé';
  return `<div class="card"><h2>Abonnement Comptoir</h2><p class="muted" style="margin-top:0">${esc(st)} · ${F(SUB.price)} par mois, échéance le ${SUB.due_day} de chaque mois.</p>
    ${SUB.exempt?'':`<button class="btn mango" data-paysub>Payer mon abonnement</button>`}
    ${SUB.is_admin?`<button class="btn" data-admin style="margin-left:8px">Gérer les abonnements</button>`:''}</div>`;
}
/* Espace patron */
async function openAdmin(){
  const {data, error} = await sb.rpc('admin_overview'); if(error) return toast(errText(error));
  const A = data, now = Date.now();
  const badge = sh => sh.exempt ? '<span class="ab ex">Offert</span>' : !sh.paid_until ? '<span class="ab no">Jamais payé</span>' : !sh.active ? '<span class="ab no">Bloqué</span>' : daysLeft(sh.paid_until) <= (SUB.notice_days||5) ? '<span class="ab soon">Bientôt</span>' : '<span class="ab ok">Actif</span>';
  const remind = sh => { if(!phoneOk(sh.whatsapp)) return ''; const txt = sh.active ? `Bonjour, petit rappel : ton abonnement Comptoir pour « ${sh.name} » se termine le ${dateFr(sh.paid_until)}. Pense à payer ${F(SUB.price)} avant pour ne pas être bloqué. Merci !` : `Bonjour, ton abonnement Comptoir pour « ${sh.name} » n’est pas payé : ta boutique est fermée aux clients. Paie ${F(SUB.price)} depuis l’appli pour la rouvrir. Merci !`; return `<a class="btn small ghost" target="_blank" rel="noopener" href="https://wa.me/221${phoneDigits(sh.whatsapp)}?text=${encodeURIComponent(txt)}">Relancer</a>`; };
  openSheet(sheetHead('Abonnements') + `
    <h3 class="adm-h">Paiements à vérifier (${A.pending.length})</h3>
    ${A.pending.length ? A.pending.map(p=>`<div class="adm-pay"><div><b>${esc(p.shop)}</b><div class="muted">${F(p.amount)} · ${p.months} mois · ${p.mode==='wave'?'Wave':'Orange Money'} · du ${esc(p.payer_phone)}</div><div>Référence : <b>${esc(p.ref)}</b></div><div class="muted" style="font-size:.8rem">${new Date(p.at).toLocaleString('fr-FR')}</div></div>
        <div class="adm-act"><button class="btn small mango" data-subok="${p.id}">Valider</button><button class="btn small ghost" data-subko="${p.id}">Refuser</button></div></div>`).join('') : '<p class="muted">Rien à vérifier pour le moment.</p>'}
    <p class="muted" style="font-size:.85rem">Avant de valider, vérifie dans ton Orange Money ou ton Wave que tu as bien reçu ce montant avec cette référence.</p>
    <h3 class="adm-h">Boutiques (${A.shops.length})</h3>
    ${A.shops.map(sh=>`<div class="adm-shop"><div><b>${esc(sh.name)}</b> ${badge(sh)}<div class="muted" style="font-size:.85rem">${esc(sh.email||'')}${sh.whatsapp?' · '+esc(sh.whatsapp):''}</div><div class="muted" style="font-size:.85rem">${sh.exempt?'Ne paie pas':sh.paid_until?'Payé jusqu’au '+dateFr(sh.paid_until):'Aucun paiement'}</div></div>
      <div class="adm-act">${sh.exempt?'':remind(sh)}${sh.exempt?'':`<button class="btn small ghost" data-subplus="${sh.id}">+1 mois</button>`}</div></div>`).join('')}`);
  adminSeen = A.pending.length;
}
async function adminAct(fn, args, okMsg){ const {error} = await sb.rpc(fn, args); if(error) return toast(errText(error)); toast(okMsg); openAdmin(); }
async function adminCheck(){
  if(!SUB || !SUB.is_admin) return;
  try{ const {data} = await sb.rpc('admin_overview'); if(!data) return; const n = data.pending.length;
    if(n > 0 && n !== adminSeen){ toast(`💰 ${n} paiement${n>1?'s':''} d’abonnement à vérifier`); if('Notification' in window && Notification.permission==='granted' && document.hidden){ try{ new Notification('Comptoir · abonnements', {body:`${n} paiement${n>1?'s':''} à vérifier`}); }catch(e){} } }
    adminSeen = n; }catch(e){}
}
async function subWatch(){
  try{ await loadSub(); }catch(e){ return; }
  if(!SUB.active){ paywall(); return; }
  const d = daysLeft(SUB.paid_until);
  if(!SUB.exempt && !SUB.pending && d >= 0 && d <= (SUB.notice_days||5)){
    const key = 'comptoir-rappel-' + new Date().toDateString();
    let shown = false; try{ shown = !!localStorage.getItem(key); localStorage.setItem(key, '1'); }catch(e){}
    if(!shown){ toast(`🔔 Ton abonnement se termine le ${dateFr(SUB.paid_until)}`); try{ if('Notification' in window && Notification.permission==='granted'){ new Notification('Comptoir', {body:`Ton abonnement se termine le ${dateFr(SUB.paid_until)}. Paie ${F(SUB.price)} pour ne pas être bloqué.`}); } }catch(e){} }
  }
  render();
}

/* ===================== Démarrage ===================== */
const LIBS = ['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.93.0/dist/umd/supabase.js',
              'https://unpkg.com/@supabase/supabase-js@2.93.0/dist/umd/supabase.js'];
async function getSupabase(){
  if(window.supabase && window.supabase.createClient) return window.supabase;
  for(const u of LIBS){ try{ await loadScript(u); if(window.supabase && window.supabase.createClient) return window.supabase; }catch(e){} }
  throw new Error('Failed to fetch supabase');
}
function storeMessage(title, text, retry){
  document.body.classList.add('storefront');
  $('.app').style.display = 'none'; $('#tabs').style.display = 'none';
  const root = $('#store'); root.hidden = false;
  root.innerHTML = `<div class="sf"><div class="sf-cover" aria-hidden="true"></div><div class="sf-head"><h1>${esc(title)}</h1><div class="muted">${esc(text)}</div>
    ${retry?'<button class="btn mango" style="margin-top:14px" id="retryBoot">Réessayer</button>':''}</div><div class="sf-foot">${logo(false, 20)}</div></div>`;
}
async function loadStore(){
  const {data, error} = await sb.rpc('get_store', {p_slug:STORE_SLUG});
  if(error) throw error;
  if(!data) return false;
  S = {shop:data.shop, zones:data.zones||[], products:(data.products||[]).map(p=>prodFromRow(Object.assign({}, p, {active:true, kw:[]}))), orders:(S && S.orders) || [], drivers:[], remitsLog:[]};
  return true;
}
async function bootStore(){
  storeMessage('Chargement…', '');
  try{
    if(!(await loadStore())) return storeMessage('Boutique introuvable', 'Vérifiez le lien reçu sur WhatsApp.');
    renderStore();
  }catch(e){ console.warn(e); storeMessage('Pas de connexion', 'Impossible d’ouvrir la boutique. Vérifiez votre réseau.', true); }
}
async function boot(){
  if(!STORE) authScreen('loading');
  try{
    const lib = await getSupabase();
    if(!sb) sb = lib.createClient(CFG.supabaseUrl, CFG.supabaseKey, {auth:{persistSession:true, autoRefreshToken:true, detectSessionInUrl:true}});
  }catch(e){ return STORE ? storeMessage('Pas de connexion', 'Impossible d’ouvrir la boutique. Vérifiez votre réseau.', true) : authScreen('offline'); }
  if(STORE) return bootStore();
  sb.auth.onAuthStateChange((ev)=>{ if(ev==='PASSWORD_RECOVERY'){ RECOVERY = true; authScreen('reset'); } });
  let session = null;
  try{ ({data:{session}} = await sb.auth.getSession()); }catch(e){}
  if(RECOVERY) return authScreen('reset');
  if(session) return afterLogin(session.user);
  authScreen('login');
}
if('serviceWorker' in navigator && location.protocol==='https:'){ window.addEventListener('load', ()=>{ navigator.serviceWorker.register('sw.js').catch(()=>{}); }); }
boot();
