// Speichert die eigenen Dateien des Helfers, damit er auch ohne Netz startet.
// Holt nur Dateien von der eigenen Adresse, nie etwas von Vinted oder anderen Seiten.
const C='vinted-helfer-4';
const F=['./','index.html','manifest.webmanifest','icon-180.png','icon-192.png','icon-512.png'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(F)))});
self.addEventListener('activate',e=>e.waitUntil(
  caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim())
));
// Erst das Netz (neueste Fassung). Nach 3 Sekunden oder ohne Netz die gespeicherte Fassung.
self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET'||new URL(r.url).origin!==location.origin)return;
  e.respondWith(new Promise(ok=>{
    let fertig=false;const gib=x=>{if(!fertig&&x){fertig=true;ok(x)}};
    const alt=()=>caches.match(r,{ignoreSearch:true}).then(x=>x||(r.mode==='navigate'?caches.match('./'):undefined));
    const t=setTimeout(()=>alt().then(gib),3000);
    fetch(r).then(x=>{
      if(x.ok){const k=x.clone();caches.open(C).then(c=>c.put(r,k))}
      clearTimeout(t);gib(x);
    }).catch(()=>{clearTimeout(t);alt().then(x=>gib(x||Response.error()))});
  }));
});
