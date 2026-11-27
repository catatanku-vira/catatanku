// Service worker Catatanku: hanya menyimpan file tampilan. Jawaban API TIDAK pernah disimpan.
const VERSI = 'catatanku-v4';
const FILE = ['./', './index.html', './stylesheet.css', './javascript.js', './manifest.webmanifest', './icon-192.png', './icon-512.png',
  ...['login.jpg', 'login.mp4', 'login-wide.jpg', 'login-wide.mp4', 'profil.png', 'gear.png', 'happy.png', 'worried.png', 'masuk.png', 'jual.png', 'kresek.png', 'struk.png', 'buku.png', 'plus.png', 'home.png', 'bell.png', 'flag.png', 'jam.png', 'lunas.png', 'chest.png', 'deck.png', 'app.png'].map(f => './img/' + f)];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSI).then(c => c.addAll(FILE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== VERSI).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // API Google & login tidak disentuh
  if (e.request.headers.has('range')) return; // video diputar langsung dari jaringan/HTTP cache
  e.respondWith(caches.match(e.request, {ignoreSearch: true}).then(r => r || fetch(e.request)));
});
