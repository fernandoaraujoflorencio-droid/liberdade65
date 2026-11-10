/* =====================================================================
   LIBERDADE 65 — visão "home broker": mapa da carteira, tabela de
   cotações, ficha com gráfico e boleta; filtros da lista de ativos;
   renda fixa (% do CDI, IPCA+, prefixado).

   Campos novos (opcionais), todos em centavos quando são preço:
     ativo.cotMax, cotMin, cotAnt, cotVol, max52, min52   (dados do dia)
     ativo.rf = {indexador:'cdi'|'ipca'|'pre'|'selic', taxa, vencimento,
                 liquidez:'diaria'|'vencimento', isento}
     S.ui.filtroAtivos = {vista, ordem, classe, q}
   O histórico de preços vem do cotacoes.js do robô (não é salvo no backup).
   ===================================================================== */

/* ---------- renda fixa ---------- */
const RF_IDX={cdi:'% do CDI',selic:'% da Selic',ipca:'IPCA +',pre:'Prefixado'};
function detectarRF(nome){
  const t=semAcento(nome||'');
  let m;
  const isento=/\b(lci|lca|cri|cra|debenture incentivada)\b/.test(t);
  const liquidez=/liquidez diaria|caixinha|reserva/.test(t)?'diaria':null;
  if((m=t.match(/(\d+(?:[.,]\d+)?)\s*%\s*(?:do\s*)?cdi/)))return{indexador:'cdi',taxa:parseNumero(m[1]),isento,liquidez,inferido:true};
  if((m=t.match(/ipca\s*\+\s*(\d+(?:[.,]\d+)?)/)))return{indexador:'ipca',taxa:parseNumero(m[1]),isento,liquidez,inferido:true};
  if((m=t.match(/pre-?fixad[oa][^\d]{0,12}(\d+(?:[.,]\d+)?)\s*%/)))return{indexador:'pre',taxa:parseNumero(m[1]),isento,liquidez,inferido:true};
  if(/tesouro selic|\bselic\b/.test(t))return{indexador:'selic',taxa:100,isento:false,liquidez:'diaria',inferido:true};
  return null;
}
const rfDe=a=>a.rf&&a.rf.taxa>0?a.rf:detectarRF(a.nome);
function rfInfo(a){
  const rf=rfDe(a); if(!rf)return null;
  const P=S.premissas, cdi=P.cdiAA>0?P.cdiAA:.1065, ipca=P.inflacaoAA>0?P.inflacaoAA:.045;
  const aa=rf.indexador==='cdi'||rf.indexador==='selic'?cdi*rf.taxa/100:rf.indexador==='ipca'?(1+ipca)*(1+rf.taxa/100)-1:rf.taxa/100;
  const mensal=Math.round((a.valor||0)*(Math.pow(1+aa,1/12)-1));
  const n=x=>Number(x).toLocaleString('pt-BR',{maximumFractionDigits:2});
  const texto=rf.indexador==='cdi'?n(rf.taxa)+'% do CDI':rf.indexador==='selic'?n(rf.taxa)+'% da Selic':rf.indexador==='ipca'?'IPCA + '+n(rf.taxa)+'%':'Prefixado '+n(rf.taxa)+'%';
  return{...rf,aa,mensal,mensalLiq:rf.isento?mensal:Math.round(mensal*.85),texto};
}

/* ---------- filtros e ordenação ---------- */
const ORDENS=[['valor','Maior posição'],['alta','Maior alta do dia'],['baixa','Maior baixa do dia'],['preco','Maior preço'],['precoMenor','Menor preço'],
  ['resultado','Melhor resultado (%)'],['pior','Pior resultado (%)'],['teto','Mais abaixo do teto'],['nome','Nome (A–Z)']];
function filtroAtivos(){ /* sempre o mesmo objeto, para os botões não gravarem numa cópia antiga */
  if(!S.ui.filtroAtivos||typeof S.ui.filtroAtivos!=='object')S.ui.filtroAtivos={};
  const f=S.ui.filtroAtivos, pad={vista:'lista',ordem:'valor',classe:'',q:''};
  for(const k in pad)if(typeof f[k]!=='string')f[k]=pad[k];
  return f;
}
function ativosFiltrados(){
  const f=filtroAtivos(), T=totaisCarteira();
  let l=S.ativos.map(a=>({a,m:metricasAtivo(a,T.total)}));
  if(f.classe)l=l.filter(x=>x.a.classe===f.classe);
  if(f.q){const q=semAcento(f.q);l=l.filter(x=>semAcento(x.a.nome+' '+(x.a.ticker||'')).includes(q))}
  const nul=v=>v==null||!isFinite(v);
  const por=(fn,desc=true)=>(x,y)=>{const a=fn(x),b=fn(y);if(nul(a)&&nul(b))return y.m.valor-x.m.valor;if(nul(a))return 1;if(nul(b))return -1;return desc?b-a:a-b};
  const ord={valor:por(x=>x.m.valor),alta:por(x=>x.m.varDiaPct),baixa:por(x=>x.m.varDiaPct,false),preco:por(x=>x.m.preco),precoMenor:por(x=>x.m.preco,false),
    resultado:por(x=>x.m.lucroPct),pior:por(x=>x.m.lucroPct,false),teto:por(x=>metodosTeto(x.a).margem),nome:(x,y)=>(x.a.ticker||x.a.nome).localeCompare(y.a.ticker||y.a.nome,'pt-BR')};
  return l.sort(ord[f.ordem]||ord.valor);
}
function barraFiltros(){
  const f=filtroAtivos(), classes=[...new Set(S.ativos.map(a=>a.classe))];
  return `<div class="filtros">
    <div class="seg vistas" role="group" aria-label="Forma de ver os ativos">
      ${[['lista','Lista'],['broker','Home broker'],['mapa','Mapa']].map(([k,n])=>`<button data-vista="${k}" aria-pressed="${f.vista===k}">${n}</button>`).join('')}
    </div>
    <div class="filtros-linha">
      <label class="sr-only" for="fatBusca">Buscar ativo</label>
      <input class="inp" id="fatBusca" type="search" placeholder="Buscar ticker ou nome" value="${esc(f.q)}">
      <label class="sr-only" for="fatOrdem">Ordenar por</label>
      <select class="inp" id="fatOrdem">${ORDENS.map(([k,n])=>`<option value="${k}" ${f.ordem===k?'selected':''}>${n}</option>`).join('')}</select>
    </div>
    <div class="chips" role="group" aria-label="Filtrar por classe">
      <button class="chip" data-fclasse="" aria-pressed="${!f.classe}">Todas</button>
      ${classes.map(c=>`<button class="chip" data-fclasse="${esc(c)}" aria-pressed="${f.classe===c}">${esc(c)} <span class="muted">${S.ativos.filter(a=>a.classe===c).length}</span></button>`).join('')}
    </div>
  </div>`;
}
function ligarFiltros(el){
  const f=filtroAtivos();
  const re=(foco)=>{salvar();render();if(foco){const b=$(foco);if(b){b.focus();if(b.setSelectionRange&&b.type==='search')b.setSelectionRange(b.value.length,b.value.length)}}};
  $$('[data-vista]',el).forEach(b=>b.onclick=()=>{f.vista=b.dataset.vista;re(`[data-vista="${f.vista}"]`)});
  $$('[data-fclasse]',el).forEach(b=>b.onclick=()=>{f.classe=b.dataset.fclasse;re(`[data-fclasse="${f.classe}"]`)});
  $('#fatOrdem',el)?.addEventListener('change',e=>{f.ordem=e.target.value;re('#fatOrdem')});
  $('#fatBusca',el)?.addEventListener('input',e=>{f.q=e.target.value;re('#fatBusca')});
  $$('[data-mapa]',el).forEach(b=>b.onclick=()=>{mapaModo=b.dataset.mapa;re(`[data-mapa="${mapaModo}"]`)});
}

/* ---------- gráficos de preço ---------- */
/* histórico: formato do robô privado (hist:[[data,fech]]) ou compacto do público (datas + h:[fech]) */
const histDe=t=>{const C=typeof cotacoesRobo==='function'?cotacoesRobo():null, e=C&&C.ativos[t];if(!e)return [];
  if(Array.isArray(e.hist))return e.hist.filter(p=>p&&p[1]>0);
  if(Array.isArray(e.h)&&Array.isArray(C.datas))return e.h.map((v,i)=>[C.datas[i],v]).filter(p=>p[0]&&p[1]>0);
  return []};
function sparkline(hist,{w=96,h=28}={}){
  if(hist.length<2)return '<span class="muted" aria-hidden="true">—</span>';
  const v=hist.map(p=>p[1]), min=Math.min(...v), max=Math.max(...v), r=max-min||1;
  const pts=v.map((x,i)=>(i/(v.length-1)*w).toFixed(1)+','+(h-2-(x-min)/r*(h-4)).toFixed(1)).join(' ');
  const cor=v[v.length-1]>=v[0]?'var(--good)':'var(--bad)';
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true" style="display:block"><polyline points="${pts}" fill="none" stroke="${cor}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}
function graficoPreco(hist,{pm,alt}={}){
  const W=320,H=150,pad={l:2,r:44,t:10,b:16};
  if(hist.length<2)return vazio({ic:'investir',t:'Sem histórico de preços ainda',p:'O robô do GitHub grava os últimos 3 meses a cada dia útil. Depois do próximo Pull, o gráfico aparece aqui.'});
  const v=hist.map(p=>p[1]), lo=Math.min(...v,pm||Infinity), hi=Math.max(...v,pm||0), r=(hi-lo)||1, min=lo-r*.08, max=hi+r*.08;
  const X=i=>pad.l+i/(v.length-1)*(W-pad.l-pad.r), Y=x=>pad.t+(1-(x-min)/(max-min))*(H-pad.t-pad.b);
  const d=v.map((x,i)=>(i?'L':'M')+X(i).toFixed(1)+' '+Y(x).toFixed(1)).join(' ');
  const sobe=v[v.length-1]>=v[0], cor=sobe?'var(--good)':'var(--bad)';
  const rs=x=>'R$ '+x.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const grid=[.25,.5,.75].map(f=>{const val=min+(max-min)*f;return `<line class="gridline" x1="0" x2="${W-pad.r}" y1="${Y(val).toFixed(1)}" y2="${Y(val).toFixed(1)}"/><text x="${W-pad.r+4}" y="${(Y(val)+3).toFixed(1)}" font-size="8" fill="var(--ink-3)" font-family="IBM Plex Mono, ui-monospace, monospace">${val.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}</text>`}).join('');
  const meses=[];hist.forEach((p,i)=>{const m=p[0].slice(0,7);if(!meses.length||meses[meses.length-1].m!==m)meses.push({m,i})});
  const rot=meses.map(x=>`<text x="${X(x.i).toFixed(1)}" y="${H-3}" font-size="8" fill="var(--ink-3)" font-family="Public Sans, system-ui, sans-serif">${MES3[+x.m.slice(5)-1]}</text>`).join('');
  const pmL=pm?`<line x1="0" x2="${W-pad.r}" y1="${Y(pm).toFixed(1)}" y2="${Y(pm).toFixed(1)}" stroke="var(--accent)" stroke-width="1.2" stroke-dasharray="4 3"/>
    <text x="4" y="${(Y(pm)-4).toFixed(1)}" font-size="8.5" fill="var(--accent)" font-weight="700" font-family="Public Sans, system-ui, sans-serif">preço médio ${rs(pm)}</text>`:'';
  const ult=v[v.length-1];
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block" role="img" aria-label="${esc(alt||'Preço nos últimos meses')}: de ${rs(v[0])} para ${rs(ult)}">
    <defs><linearGradient id="gP" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${cor}" stop-opacity=".28"/><stop offset="100%" stop-color="${cor}" stop-opacity="0"/></linearGradient></defs>
    ${grid}${rot}<path d="${d} L${X(v.length-1).toFixed(1)} ${H-pad.b} L${X(0).toFixed(1)} ${H-pad.b} Z" fill="url(#gP)"/>
    <path d="${d}" fill="none" stroke="${cor}" stroke-width="1.8" stroke-linejoin="round"/>${pmL}
    <circle cx="${X(v.length-1).toFixed(1)}" cy="${Y(ult).toFixed(1)}" r="3.2" fill="${cor}" stroke="var(--surface)" stroke-width="1.5"/></svg>`;
}
/* faixa do dia: mínima — máxima, com a posição do preço atual */
function faixaDia(a){
  const p=a.cotacao, lo=a.cotMin, hi=a.cotMax;
  if(!(p>0&&lo>0&&hi>0&&hi>=lo))return '<span class="muted">—</span>';
  const pos=hi>lo?clamp((p-lo)/(hi-lo),0,1)*100:50;
  return `<span class="faixa" title="mín ${brl(Math.round(lo))} · máx ${brl(Math.round(hi))}"><i style="left:${pos.toFixed(0)}%"></i></span>`;
}

/* ---------- mapa da carteira (treemap) ---------- */
function squarify(itens,x,y,w,h){
  const out=[];let rest=itens.filter(i=>i.v>0);
  while(rest.length){
    const total=rest.reduce((s,i)=>s+i.v,0), area=i=>i.v/total*w*h, curto=Math.min(w,h);
    let linha=[],melhor=Infinity;
    while(rest.length){
      const c=[...linha,rest[0]], s=c.reduce((a,i)=>a+area(i),0), mx=Math.max(...c.map(area)), mn=Math.min(...c.map(area));
      const pior=Math.max(curto*curto*mx/(s*s),(s*s)/(curto*curto*mn));
      if(pior<=melhor){linha=c;melhor=pior;rest.shift()}else break;
    }
    const s=linha.reduce((a,i)=>a+area(i),0);
    if(w>=h){const lw=s/h;let yy=y;for(const i of linha){const ih=area(i)/lw;out.push({...i,x,y:yy,w:lw,h:ih});yy+=ih}x+=lw;w-=lw}
    else{const lh=s/w;let xx=x;for(const i of linha){const iw=area(i)/lh;out.push({...i,x:xx,y,w:iw,h:lh});xx+=iw}y+=lh;h-=lh}
  }
  return out;
}
let mapaModo='dia';
function mapaCarteira(lista){
  const itens=lista.filter(x=>x.m.valor>0).map(x=>({v:x.m.valor,a:x.a,m:x.m}));
  if(!itens.length)return vazio({ic:'carteira',t:'Nada para mostrar',p:'Nenhum ativo com valor neste filtro.'});
  const tot=itens.reduce((s,i)=>s+i.v,0);
  const tiles=squarify(itens.sort((a,b)=>b.v-a.v),0,0,100,100);
  const cor=t=>{const p=mapaModo==='dia'?t.m.varDiaPct:t.m.lucroPct;if(p==null||!isFinite(p))return 'var(--sunken)';
    const k=Math.round(18+Math.min(1,Math.abs(p)/(mapaModo==='dia'?.03:.2))*27);return `color-mix(in srgb, var(--${p>=0?'good':'bad'}) ${k}%, var(--sunken))`};
  return `<div class="row" style="margin-bottom:var(--s2)"><span class="sub">Tamanho = valor da posição · cor = ${mapaModo==='dia'?'variação do dia':'resultado desde a compra'}</span>
    <div class="seg" role="group" aria-label="Cor do mapa" style="flex:none"><button data-mapa="dia" aria-pressed="${mapaModo==='dia'}">Dia</button><button data-mapa="resultado" aria-pressed="${mapaModo==='resultado'}">Resultado</button></div></div>
  ${(()=>{const cw=Math.min(innerWidth,1120)*(innerWidth>=960?.78:.86), ch=innerWidth<600?300:340;
  return `<div class="mapa" role="list" aria-label="Mapa da carteira">${tiles.map(t=>{const p=mapaModo==='dia'?t.m.varDiaPct:t.m.lucroPct, wp=t.w*cw/100, hp=t.h*ch/100, grande=wp>120&&hp>64, medio=wp>58&&hp>36;
    return `<button class="mtile" role="listitem" data-broker="${t.a.id}" style="left:${t.x.toFixed(2)}%;top:${t.y.toFixed(2)}%;width:${t.w.toFixed(2)}%;height:${t.h.toFixed(2)}%;background:${cor(t)}"
      aria-label="${esc(t.a.ticker||t.a.nome)}, ${pct(t.v/tot,1)} da carteira${p!=null&&isFinite(p)?', '+pctS(p):''}">
      ${medio?`<b>${esc(t.a.ticker||t.a.nome)}</b>${p!=null&&isFinite(p)?`<span>${pctS(p,mapaModo==='dia'?2:1)}</span>`:''}${grande?`<small>${pct(t.v/tot,1)} · ${brlK(t.v)}</small>`:''}`:''}</button>`}).join('')}</div>`})()}`;
}

/* ---------- tabela "home broker" ---------- */
function tabelaBroker(lista){
  const rv=lista.filter(x=>x.a.ticker);
  const outros=lista.filter(x=>!x.a.ticker);
  const comDia=rv.filter(x=>x.m.varDiaPct!=null);
  const altas=[...comDia].sort((a,b)=>b.m.varDiaPct-a.m.varDiaPct).slice(0,3), baixas=[...comDia].sort((a,b)=>a.m.varDiaPct-b.m.varDiaPct).filter(x=>x.m.varDiaPct<0).slice(0,3);
  const chip=x=>`<button class="tchip ${sinalCls(x.m.varDiaPct)}" data-broker="${x.a.id}"><b>${esc(x.a.ticker)}</b> ${pctS(x.m.varDiaPct)}</button>`;
  return `${comDia.length?`<div class="fita" aria-label="Destaques do dia"><span class="muted">Altas</span>${altas.filter(x=>x.m.varDiaPct>=0).map(chip).join('')||'<span class="muted">—</span>'}<span class="muted" style="margin-left:var(--s2)">Baixas</span>${baixas.map(chip).join('')||'<span class="muted">—</span>'}</div>`:''}
  <div class="broker-head" aria-hidden="true"><span>Ativo</span><span>3 meses</span><span>Último</span><span>Dia</span><span>Faixa do dia</span><span>Posição</span><span>Resultado</span></div>
  <div class="broker">${rv.map(({a,m})=>{const h=histDe(a.ticker);
    return `<button class="brow" data-broker="${a.id}" aria-label="${esc(a.ticker)}: ${m.preco?brl(Math.round(m.preco)):'sem cotação'}${m.varDiaPct!=null?', '+pctS(m.varDiaPct)+' no dia':''}">
      <span class="b-at"><b>${esc(a.ticker)}</b><small>${esc(a.nome!==a.ticker?a.nome:a.classe)}</small></span>
      <span class="b-sp">${sparkline(h)}</span>
      <span class="b-px num">${m.preco?brl(Math.round(m.preco),{noPrefix:true,real:true}):'—'}</span>
      <span class="b-var"><span class="badge ${m.varDiaPct!=null?sinalCls(m.varDiaPct):'zero'}">${m.varDiaPct!=null?pctS(m.varDiaPct):'—'}</span></span>
      <span class="b-fx">${faixaDia(a)}</span>
      <span class="b-pos num">${brl(m.valor,{noPrefix:true})}<small>${a.qtd?fmtQtd(a.qtd)+' un':''}</small></span>
      <span class="b-res num ${m.lucro!=null?sinalCls(m.lucro):'zero'}">${m.lucroPct!=null?pctS(m.lucroPct):'—'}<small>${m.lucro!=null?brlS(m.lucro):''}</small></span>
    </button>`}).join('')||vazio({ic:'investir',t:'Nenhuma ação ou fundo com ticker',p:'O home broker mostra ativos negociados na B3 (com ticker).'})}</div>
  ${outros.length?`<div class="sub" style="margin-top:var(--s3)">${outros.length} ativo${outros.length>1?'s':''} sem ticker (renda fixa, cripto) aparece${outros.length>1?'m':''} na vista <b>Lista</b>.</div>`:''}`;
}

/* ---------- ficha estilo corretora, com boleta ---------- */
function abrirBroker(id){
  const a=S.ativos.find(x=>x.id===id);if(!a)return;
  if(!a.ticker){abrirAtivo(id);return}
  const T=totaisCarteira(), m=metricasAtivo(a,T.total), mt=metodosTeto(a), h=histDe(a.ticker);
  const v3=h.length>1?h[h.length-1][1]/h[0][1]-1:null;
  const rs=c=>c>0?brl(Math.round(c),{real:true}):'—', n2=c=>(c/100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const hv=h.map(x=>x[1]), lo3=hv.length?Math.min(...hv)*100:0, hi3=hv.length?Math.max(...hv)*100:0;
  sheet(`<h2>${esc(a.ticker)}</h2><div class="sh-sub">${esc(a.nome!==a.ticker?a.nome+' · ':'')}${esc(a.classe)}${a.cotacaoEm?' · '+(FONTE_NOME[a.cotacaoFonte]||'cotação')+' '+dataHora(a.cotacaoEm):''}</div>
  <div class="row" style="align-items:flex-end;margin-bottom:var(--s3)">
    <div><div class="num" style="font-size:32px;font-weight:600;letter-spacing:-.03em">${m.preco?brl(Math.round(m.preco),{real:true}):'—'}</div>
      <div class="sub">${m.varDiaPct!=null?`<span class="badge ${sinalCls(m.varDiaPct)}">${pctS(m.varDiaPct)}</span> hoje`:''}${v3!=null?` · <span class="${sinalCls(v3)}">${pctS(v3,1)}</span> em 3 meses`:''}</div></div>
    <div class="btnrow" style="flex:none"><button class="btn compra" id="bkComprar">Comprar</button><button class="btn venda" id="bkVender" ${a.qtd>0?'':'disabled'}>Vender</button></div>
  </div>
  <div class="card flat" style="padding:var(--s3);margin-bottom:var(--s3)">${graficoPreco(h,{pm:a.precoMedio?a.precoMedio/100:null,alt:'Preço de '+a.ticker+' nos últimos 3 meses'})}</div>
  <div class="grid4 bk-dados">
    <div class="stat"><div class="k">Fech. anterior</div><div class="v">${rs(a.cotAnt)}</div></div>
    <div class="stat"><div class="k">Mín – máx do dia</div><div class="v" style="font-size:var(--t-md)">${a.cotMin>0?n2(a.cotMin)+' – '+n2(a.cotMax):'—'}</div></div>
    ${a.min52>0?`<div class="stat"><div class="k">Mín – máx 52 sem.</div><div class="v" style="font-size:var(--t-md)">${n2(a.min52)+' – '+n2(a.max52)}</div></div>`
      :`<div class="stat"><div class="k">Mín – máx 3 meses</div><div class="v" style="font-size:var(--t-md)">${lo3>0?n2(lo3)+' – '+n2(hi3):'—'}</div></div>`}
    <div class="stat"><div class="k">Volume</div><div class="v">${a.cotVol>0?Number(a.cotVol).toLocaleString('pt-BR',{notation:'compact',maximumFractionDigits:1}):'—'}</div></div>
    <div class="stat"><div class="k">Sua posição</div><div class="v">${brl(m.valor)}</div><div class="d">${a.qtd?fmtQtd(a.qtd)+' × PM '+rs(a.precoMedio):'—'}</div></div>
    <div class="stat"><div class="k">Resultado</div><div class="v ${m.lucro!=null?sinalCls(m.lucro):''}">${m.lucro!=null?brlS(m.lucro):'—'}</div><div class="d ${m.lucroPct!=null?sinalCls(m.lucroPct):''}">${m.lucroPct!=null?pctS(m.lucroPct):''}</div></div>
    <div class="stat"><div class="k">Preço teto</div><div class="v">${mt.mediana?brl(mt.mediana):'—'}</div><div class="d ${mt.margem!=null?sinalCls(mt.margem):''}">${mt.margem!=null?'margem '+pctS(mt.margem,1):'importe relatórios'}</div></div>
    <div class="stat"><div class="k">Dividend yield</div><div class="v">${mt.dy!=null?pct(mt.dy,1):'—'}</div><div class="d">${a.dpa?'DPA '+brl(a.dpa):''}</div></div>
  </div>
  <button class="btn ghost block" id="bkFicha" style="margin-top:var(--s3)">Ficha completa, preço teto e relatórios</button>`);
  $('#bkComprar').onclick=()=>abrirMovimento(a.id,'compra');
  $('#bkVender').onclick=()=>abrirMovimento(a.id,'venda');
  $('#bkFicha').onclick=()=>abrirAtivo(a.id);
}

/* ---------- resultado por ativo (barras divergentes) e renda fixa ---------- */
function cardResultados(){
  const T=totaisCarteira();
  const l=S.ativos.map(a=>({a,m:metricasAtivo(a,T.total)})).filter(x=>x.m.lucroPct!=null).sort((x,y)=>y.m.lucroPct-x.m.lucroPct);
  if(l.length<2)return '';
  const max=Math.max(...l.map(x=>Math.abs(x.m.lucroPct)),.01);
  return `<div class="card"><h3>Resultado por ativo <span class="tag muted">desde a compra</span></h3>
    <div class="diverg">${l.map(({a,m})=>{const w=(Math.abs(m.lucroPct)/max*50).toFixed(1);
      return `<button class="drow" data-broker="${a.id}"><span class="dnome">${esc(a.ticker||a.nome)}</span>
        <span class="dtrk"><i class="${m.lucroPct>=0?'pos':'neg'}" style="${m.lucroPct>=0?'left:50%':'right:50%'};width:${w}%"></i><b></b></span>
        <span class="dval num ${sinalCls(m.lucroPct)}">${pctS(m.lucroPct,1)}</span></button>`}).join('')}</div>
  </div>`;
}
function cardRendaFixa(){
  const l=S.ativos.filter(a=>a.classe==='Renda fixa'||a.rf).map(a=>({a,i:rfInfo(a)}));
  if(!l.length)return '';
  const tot=l.reduce((s,x)=>s+(x.a.valor||0),0), comTaxa=l.filter(x=>x.i);
  const mensal=comTaxa.reduce((s,x)=>s+x.i.mensal,0), mensalLiq=comTaxa.reduce((s,x)=>s+x.i.mensalLiq,0);
  const P=S.premissas;
  return `<div class="card"><h3>Renda fixa <span class="tag num">${brl(tot)}</span></h3>
    <div class="grid2" style="margin-bottom:var(--s3)">
      <div class="stat"><div class="k">Rende por mês (estimado)</div><div class="v pos">${comTaxa.length?brl(mensal):'—'}</div><div class="d">${comTaxa.length?'≈ '+brl(mensalLiq)+' líquido de IR':'informe a taxa dos títulos'}</div></div>
      <div class="stat"><div class="k">CDI usado</div><div class="v">${pct(P.cdiAA||.1065,2)}</div><div class="d">ao ano · muda em Configurações</div></div>
    </div>
    <div class="list">${l.sort((x,y)=>y.a.valor-x.a.valor).map(({a,i})=>`<button class="item" data-ativo="${a.id}">
      <div class="mid"><div class="t">${esc(a.nome)}</div>
        <div class="s">${i?esc(i.texto)+' · ≈ '+pct(i.aa,1)+' a.a.'+(i.isento?' · isento':''):'<span style="color:var(--warn)">toque para informar a taxa</span>'}${a.rf?.vencimento?' · vence '+dataCurta(a.rf.vencimento+'T12:00:00'):(i?.liquidez==='diaria'?' · liquidez diária':'')}</div></div>
      <div style="text-align:right"><div class="val">${brl(a.valor,{noPrefix:true})}</div>${i?`<div class="s pos num">+${brl(i.mensal,{noPrefix:true})}/mês</div>`:''}</div>
    </button>`).join('')}</div>
    ${comTaxa.some(x=>x.i.inferido&&!x.a.rf)?'<div class="hint" style="margin-top:var(--s2)">Taxas lidas do nome do título (ex.: “120% CDI”). Confirme ou ajuste tocando no título.</div>':''}
  </div>`;
}
