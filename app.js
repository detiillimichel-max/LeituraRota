(() => {
  let DATA=window.LEITURAROTA_DATA;
  let routes=DATA?.routes||[];
  async function ensureRouteData(){
    if(routes.length) return true;
    return new Promise(resolve=>{
      const s=document.createElement("script");
      s.src="data/routes.js?v=2.0.1";
      s.onload=()=>{DATA=window.LEITURAROTA_DATA;routes=DATA?.routes||[];resolve(routes.length>0)};
      s.onerror=()=>resolve(false);
      document.head.appendChild(s);
    });
  }
  if(!routes.length){
    document.addEventListener("DOMContentLoaded",()=>{
      const el=document.createElement("div");
      el.style.cssText="position:fixed;inset:70px 16px auto;z-index:3000;background:#1b2029;color:#fff;padding:14px;border:1px solid #ef4444;border-radius:12px;font:12px system-ui";
      el.textContent="Não foi possível carregar data/routes.js. Recarregue a página e verifique o caminho do GitHub Pages.";
      document.body.appendChild(el);
    });
  }
  const state={routeId:Number(localStorage.getItem("lr-route")||1),filter:"",sheetOpen:true,selectedStreet:0,watching:false};
  let map,routeLine,userMarker,accuracyCircle,watchId,db;
  const $=id=>document.getElementById(id);
  const esc=s=>String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
  function icon(name){return '<i data-lucide="'+name+'"></i>'}
  function drawIcons(){if(window.lucide)lucide.createIcons({attrs:{'stroke-width':2}})}
  function currentRoute(){return routes.find(r=>r.id===state.routeId)||routes[0]}
  function toast(msg){const el=$("toast");el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2200)}
  function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open("leiturarota-db",1);req.onupgradeneeded=()=>{const d=req.result;if(!d.objectStoreNames.contains("readings"))d.createObjectStore("readings",{keyPath:"id"});if(!d.objectStoreNames.contains("media"))d.createObjectStore("media",{keyPath:"id"})};req.onsuccess=()=>{db=req.result;resolve(db)};req.onerror=()=>reject(req.error)})}
  function tx(store,mode="readonly"){return db.transaction(store,mode).objectStore(store)}
  function readAll(store){if(!db)return Promise.resolve([]);return new Promise((resolve,reject)=>{const r=tx(store).getAll();r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error)})}
  function put(store,obj){if(!db)return Promise.resolve();return new Promise((resolve,reject)=>{const r=tx(store,"readwrite").put(obj);r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error)})}
  async function getReading(id){if(!db)return null;return new Promise((resolve,reject)=>{const r=tx("readings").get(id);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error)})}
  async function saveReading(route,idx,data){const id=route.id+"-"+idx;const old=await getReading(id)||{};await put("readings",{id,routeId:route.id,streetIndex:idx,street:route.streets[idx],updatedAt:new Date().toISOString(),...old,...data});}
  async function countSaved(routeId){return (await readAll("readings")).filter(x=>x.routeId===routeId&&x.saved).length}
  function renderRoutes(){
    const list=$("routeList");
    list.innerHTML=routes.map(r=>{const saved=localStorage.getItem("lr-progress-"+r.id)||"0";return '<button class="route-item '+(r.id===state.routeId?"active":"")+'" data-route="'+r.id+'"><span class="route-dot" style="background:'+r.color+'"></span><span class="route-copy"><strong>'+r.name+'</strong><span>'+r.streets.length+' endereços · '+saved+' salvos</span></span><span class="route-progress">'+saved+'/'+r.streets.length+'</span></button>'}).join("");
    list.querySelectorAll("[data-route]").forEach(b=>b.addEventListener("click",()=>selectRoute(Number(b.dataset.route))));
    const nav=$("routeNav");
    if(nav) nav.innerHTML=routes.map(r=>'<button class="route-nav-btn '+(r.id===state.routeId?"active":"")+'" data-route-nav="'+r.id+'" style="--route-color:'+r.color+'" aria-label="Selecionar '+r.name+'"><span class="route-nav-dot" style="background:'+r.color+'"></span>'+r.id+'</button>').join("");
    nav?.querySelectorAll("[data-route-nav]").forEach(b=>b.addEventListener("click",()=>selectRoute(Number(b.dataset.routeNav))));
    drawIcons();
  }
  async function selectRoute(id){if(!routes.some(r=>r.id===id))return;state.routeId=id;state.filter="";$("streetSearch").value="";localStorage.setItem("lr-route",id);renderRoutes();renderSheet();drawRoute();closeMenu();$("routeNav")?.querySelector('[data-route-nav="'+id+'"]')?.scrollIntoView({behavior:"smooth",block:"nearest",inline:"center"})}
  function renderSheet(){const r=currentRoute();$("topRouteName").textContent=r.name;$("topRouteMeta").textContent=r.streets.length+" endereços";$("sheetRouteName").textContent=r.name;$("sheetRouteName").style.color=r.color;renderStreets();updateProgress();drawIcons()}
  async function renderStreets(){const r=currentRoute(),q=state.filter.toLowerCase();const saved=await readAll("readings");const byId=new Map(saved.map(x=>[x.id,x]));const items=r.streets.map((street,i)=>({street,i,data:byId.get(r.id+"-"+i)})).filter(x=>x.street.toLowerCase().includes(q));$("streetGrid").innerHTML=items.map(({street,i,data})=>{const done=!!data?.saved;return '<article class="street-card '+(done?"done":"")+'" style="--route-color:'+r.color+'" data-street="'+i+'"><div class="street-title">'+(i+1)+". "+esc(street)+'</div><label class="field-label">Leitura / hidrômetro</label><input class="field reading" inputmode="decimal" value="'+esc(data?.value||"")+'" placeholder="Digite a leitura, hidrômetro, número..."><label class="field-label">Ocorrências</label><select class="select occurrence"><option value="">Sem ocorrência</option><option value="Hidrômetro não visível" '+(data?.occurrence==="Hidrômetro não visível"?"selected":"")+'>Hidrômetro não visível</option><option value="Imóvel fechado" '+(data?.occurrence==="Imóvel fechado"?"selected":"")+'>Imóvel fechado</option><option value="Número errado" '+(data?.occurrence==="Número errado"?"selected":"")+'>Número errado</option><option value="Leitura impossível" '+(data?.occurrence==="Leitura impossível"?"selected":"")+'>Leitura impossível</option></select><label class="field-label">Observação</label><textarea class="textarea note" placeholder="Observação do campo...">'+esc(data?.note||"")+'</textarea><div class="card-actions"><button class="small-btn photo" title="Foto">'+icon("camera")+" Foto</button><button class="small-btn video" title="Vídeo">'+icon("video")+" Vídeo</button><button class="small-btn primary save" title="Salvar">'+icon(done?"circle-check":"save")+" "+(done?"Salvo":"Salvar")+"</button></div></article>"}).join("");$("streetGrid").querySelectorAll(".street-card").forEach(card=>{const i=Number(card.dataset.street);card.querySelector(".save").addEventListener("click",()=>saveCard(card,i));card.querySelector(".photo").addEventListener("click",()=>capture("photo",i));card.querySelector(".video").addEventListener("click",()=>capture("video",i))});drawIcons()}
  async function saveCard(card,i){const r=currentRoute();await saveReading(r,i,{value:card.querySelector(".reading").value,note:card.querySelector(".note").value,occurrence:card.querySelector(".occurrence").value,saved:true});const count=await countSaved(r.id);localStorage.setItem("lr-progress-"+r.id,count);toast("Leitura salva localmente");renderRoutes();renderStreets();updateProgress()}
  async function updateProgress(){const r=currentRoute();const n=await countSaved(r.id);$("progressText").textContent=n+"/"+r.streets.length;$("progressBar").style.width=(r.streets.length?(n/r.streets.length*100):0)+"%";$("sheetMeta").textContent=r.streets.length+" endereços · "+n+" salvos"}
  function drawRoute(){if(!map)return;const r=currentRoute();if(routeLine)routeLine.remove();const pts=r.coordinatesA||[];if(!pts.length)return;routeLine=L.polyline(pts,{color:r.color,weight:5,opacity:.9,dashArray:"12 8",lineCap:"round",lineJoin:"round"}).addTo(map);map.fitBounds(routeLine.getBounds(),{padding:[60,180],maxZoom:16})}
  function initMap(){map=L.map("map",{zoomControl:false,preferCanvas:true});L.control.zoom({position:"bottomright"}).addTo(map);L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);map.setView([-23.135,-46.304],14);map.on("locationfound",e=>{state.watching=true;const p=e.latlng;if(!userMarker)userMarker=L.circleMarker(p,{radius:8,color:"#fff",weight:3,fillColor:"#0b84ff",fillOpacity:1}).addTo(map);else userMarker.setLatLng(p);if(!accuracyCircle)accuracyCircle=L.circle(p,{radius:e.accuracy,color:"#0b84ff",weight:1,fillOpacity:.08}).addTo(map);else accuracyCircle.setLatLng(p).setRadius(e.accuracy);$("syncBadge").innerHTML=icon("locate-fixed")+" GPS "+Math.round(e.accuracy)+"m";drawIcons()});map.on("locationerror",()=>{$("syncBadge").innerHTML=icon("map-pin-off")+" GPS indisponível";drawIcons()});drawRoute();startLocation()}
  function startLocation(){if(!("geolocation" in navigator)){return}map.locate({watch:true,enableHighAccuracy:true,maximumAge:5000,timeout:15000,setView:false})}
  function locateNow(){if(map)map.locate({setView:true,maxZoom:17,enableHighAccuracy:true});}
  function capture(type,streetIndex){const input=type==="photo"?$("photoInput"):$("videoInput");input.dataset.route=String(state.routeId);input.dataset.street=String(streetIndex);input.value="";input.click()}
  async function saveMedia(type,file){const routeId=Number((type==="photo"?$("photoInput"):$("videoInput")).dataset.route);const streetIndex=Number((type==="photo"?$("photoInput"):$("videoInput")).dataset.street);const id=crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random();await put("media",{id,type,routeId,streetIndex,street:routes.find(r=>r.id===routeId).streets[streetIndex],blob:file,size:file.size,mime:file.type,createdAt:new Date().toISOString(),synced:false});await saveReading(routes.find(r=>r.id===routeId),streetIndex,{mediaPending:true});toast((type==="photo"?"Foto":"Vídeo")+" guardado no aparelho");}
  function setup(){renderRoutes();renderSheet();if(window.L&&document.getElementById("map"))initMap();else toast("Mapa ainda não carregou");$("streetSearch").addEventListener("input",e=>{state.filter=e.target.value;renderStreets()});$("locateBtn").addEventListener("click",locateNow);$("sheetToggle").addEventListener("click",()=>{$("routeSheet").classList.toggle("sheet-collapsed");state.sheetOpen=!$("routeSheet").classList.contains("sheet-collapsed");$("sheetToggle").innerHTML=icon(state.sheetOpen?"chevron-down":"chevron-up");drawIcons()});$("menuOpen").addEventListener("click",()=>{ $("sidebar").classList.add("open");$("overlay").classList.add("show")});$("menuClose").addEventListener("click",closeMenu);$("overlay").addEventListener("click",closeMenu);$("downloadBtn").addEventListener("click",()=>toast("Dados das rotas já estão no dispositivo"));$("photoInput").addEventListener("change",e=>e.target.files[0]&&saveMedia("photo",e.target.files[0]));$("videoInput").addEventListener("change",e=>e.target.files[0]&&saveMedia("video",e.target.files[0]));window.addEventListener("online",updateNetwork);window.addEventListener("offline",updateNetwork);updateNetwork();if("serviceWorker" in navigator)navigator.serviceWorker.register("service-worker.js?v=2.1.0").catch(()=>{});drawIcons()}
  function closeMenu(){$("sidebar").classList.remove("open");$("overlay").classList.remove("show")}
  function updateNetwork(){const online=navigator.onLine;$("networkBadge").innerHTML=icon(online?"wifi":"wifi-off")+" "+(online?"ONLINE":"OFFLINE");$("networkBadge").style.color=online?"#4ade80":"#facc15";drawIcons()}
  async function boot(){try{await ensureRouteData()}catch(e){}if(!routes.length){toast("Dados das rotas não carregaram");return}try{await openDB()}catch(e){db=null;toast("Modo local simplificado ativo")}setup()}boot();
})();