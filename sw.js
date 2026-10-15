// Speichert die eigenen Dateien des Helfers, damit er auch ohne Netz startet.
// Holt nur Dateien von der eigenen Adresse, nie etwas von Vinted oder anderen Seiten.
const C='vinted-helfer-6';
const F=['./','index.html','manifest.webmanifest','icon-180.png','icon-192.png','icon-512.png'];
// no-cache: beim Server nachfragen statt alte Kopien aus dem Browser-Zwischenspeicher zu nehmen
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(F.map(u=>new Request(u,{cache:'no-cache'})))))});
self.addEventListener('activate',e=>e.waitUntil(
  caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim())
));
// iOS zeigt eine weiße Seite, wenn der Service Worker eine umgeleitete Antwort liefert. Darum neu verpacken.
const glatt=x=>x&&x.redirected?x.blob().then(b=>new Response(b,{status:x.status,statusText:x.statusText,headers:x.headers})):x;
const gespeichert=()=>caches.match('index.html').then(x=>x||caches.match('./')).then(glatt);
// Letzter Rückfall statt Fehler-Antwort (die wäre vom Home-Bildschirm ein weißer Bildschirm)
const ohneNetz=()=>new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Vinted-Helfer</title><p style="font:17px -apple-system,sans-serif;padding:40px 24px">Kein Netz und noch nichts gespeichert. Bitte einmal mit Netz öffnen.</p>',{headers:{'Content-Type':'text/html; charset=utf-8'}});
self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET'||new URL(r.url).origin!==location.origin)return;
  if(r.mode==='navigate'){
    // Seite: erst das Netz (neueste Fassung). Nach 3 Sekunden oder ohne Netz die gespeicherte Seite.
    e.respondWith(new Promise(ok=>{
      let fertig=false;const gib=x=>{if(!fertig&&x){fertig=true;ok(x)}};
      const t=setTimeout(()=>gespeichert().then(gib,()=>{}),3000);
      fetch(r.url,{cache:'no-cache',redirect:'manual'}).then(x=>{
        clearTimeout(t);
        if(x.ok&&/text\/html/.test(x.headers.get('content-type')||'')){const k=x.clone();caches.open(C).then(c=>c.put('index.html',k))}
        // Server-Störung bei GitHub: lieber die gespeicherte Seite
        if(x.status>=500)return gespeichert().then(y=>y||x);
        return glatt(x);
      }).then(gib).catch(()=>{clearTimeout(t);gespeichert().catch(()=>null).then(x=>gib(x||ohneNetz()))});
    }));
    return;
  }
  // Übrige Dateien (Icons, Manifest): erst das Netz, sonst die gespeicherte Fassung
  e.respondWith(fetch(r).then(x=>{
    if(x.ok){const k=x.clone();caches.open(C).then(c=>c.put(r,k))}
    return x;
  }).catch(()=>caches.match(r,{ignoreSearch:true}).then(x=>x||Response.error())));
});
