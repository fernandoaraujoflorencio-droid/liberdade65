/* Liberdade 65 — service worker (app instalável e uso sem internet).
   Estratégia: tenta a rede primeiro (sempre a versão mais nova quando há
   internet) e cai no que está guardado quando a conexão falha.
   Não guarda dados pessoais: os dados do app ficam no localStorage. */
const CACHE='liberdade65-v1';
const ARQUIVOS=['./','./index.html','./css/app.css','./cotacoes.js','./manifest.webmanifest',
  './js/nucleo.js','./js/motor.js','./js/importacao.js','./js/carteira.js','./js/leitorpdf.js','./js/relatorios.js',
  './js/investimentos.js','./js/homebroker.js','./js/telas.js','./js/folhas.js','./js/app.js',
  './icones/icon-192.png','./icones/icon-512.png'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>Promise.all(ARQUIVOS.map(u=>c.add(u).catch(()=>null)))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  const req=e.request, url=new URL(req.url);
  if(req.method!=='GET'||url.origin!==location.origin)return;   /* brapi, fontes etc. seguem direto */
  e.respondWith(fetch(req).then(r=>{
    if(r&&r.ok){const copia=r.clone();caches.open(CACHE).then(c=>c.put(req,copia))}
    return r;
  }).catch(()=>caches.match(req,{ignoreSearch:true}).then(r=>r||caches.match('./index.html'))));
});
