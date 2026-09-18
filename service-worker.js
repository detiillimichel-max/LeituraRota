const CACHE="leiturarota-shell-v3";
const PRECACHE=[
  "/LeituraRota/",
  "/LeituraRota/index.html",
  "/LeituraRota/style.css",
  "/LeituraRota/app.js",
  "/LeituraRota/data/routes.js",
  "/LeituraRota/manifest.json"
];

self.addEventListener("install",event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(cache=>cache.addAll(PRECACHE))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET") return;
  const url=new URL(event.request.url);
  if(url.origin!==location.origin) return;

  const path=url.pathname;
  const important=/\/(index\.html|app\.js|style\.css|data\/routes\.js|manifest\.json)$/.test(path);

  if(important){
    event.respondWith(
      fetch(event.request)
        .then(response=>{
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put(event.request,copy));
          return response;
        })
        .catch(()=>caches.match(event.request,{ignoreSearch:true}))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request,{ignoreSearch:true})
      .then(cached=>cached||fetch(event.request))
  );
});