/* Comptoir : garde l'appli sur le téléphone pour qu'elle s'ouvre même avec un réseau faible */
const V = 'comptoir-v6';
const SHELL = ['./', './index.html', './app.js?v=6', './config.js?v=2', './cover.jpg', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('supabase.co')) return;            /* données : toujours en direct */
  if (url.origin === location.origin) {                         /* l'appli : réseau d'abord, copie si hors ligne */
    e.respondWith(fetch(req).then(r => { if (r.ok) { const c = r.clone(); caches.open(V).then(x => x.put(req, c)); } return r; })
      .catch(() => caches.match(req, {ignoreSearch: req.mode === 'navigate'}).then(r => r || caches.match('./index.html'))));
    return;
  }
  if (/cdn\.jsdelivr\.net|unpkg\.com|fonts\.(googleapis|gstatic)\.com|images\.pexels\.com/.test(url.hostname)) {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => { const c = res.clone(); caches.open(V).then(x => x.put(req, c)); return res; })));
  }
});
