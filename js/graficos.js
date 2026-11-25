/* =====================================================================
   LIBERDADE 65 — gráficos detalhados, dicas ao tocar e animações
   ===================================================================== */
const FONTE_UI='Public Sans, system-ui, sans-serif', FONTE_NUM='IBM Plex Mono, ui-monospace, Consolas, monospace';

/* ---------- dica (tooltip) que funciona com mouse e com o dedo ----------
   Qualquer elemento com data-tip — ou um pedaço de gráfico SVG com <title> —
   mostra a dica ao passar o mouse ou tocar. */
const Dica=(()=>{
  let caixa=null, alvo=null, tempo=null;
  const caixaEl=()=>{if(!caixa){caixa=document.createElement('div');caixa.className='dica';caixa.setAttribute('role','tooltip');document.body.appendChild(caixa)}return caixa};
  function achar(n){
    for(let e=n;e&&e.nodeType===1&&e!==document.body;e=e.parentNode){
      if(e.dataset&&e.dataset.tip)return e;
      if(e.namespaceURI==='http://www.w3.org/2000/svg'&&e.tagName!=='svg'){
        const t=[...e.children].find(c=>c.tagName==='title');
        if(t){e.dataset.tip=t.textContent;e.setAttribute('aria-label',t.textContent);t.remove();return e}
      }
      if(e.matches&&e.matches('.empilhada>i[title]')){e.dataset.tip=e.title;e.removeAttribute('title');return e}
      if(e.tagName==='svg')return null;
    }
    return null;
  }
  function mostrar(e,x,y){
    if(alvo&&alvo!==e)alvo.classList.remove('hl');
    alvo=e;e.classList.add('hl');
    const c=caixaEl();c.textContent=e.dataset.tip;c.classList.add('on');
    const r=c.getBoundingClientRect(), W=innerWidth;
    let left=Math.min(W-r.width/2-8,Math.max(r.width/2+8,x)), top=y-14;
    if(top-r.height<8)top=y+r.height+22;
    c.style.left=left+'px';c.style.top=top+'px';
  }
  function esconder(){if(alvo)alvo.classList.remove('hl');alvo=null;caixa&&caixa.classList.remove('on')}
  document.addEventListener('pointermove',ev=>{
    if(ev.pointerType==='touch')return;
    const e=achar(ev.target);if(e)mostrar(e,ev.clientX,ev.clientY);else if(alvo)esconder();
  },{passive:true});
  document.addEventListener('pointerdown',ev=>{
    const e=achar(ev.target);
    if(!e){esconder();return}
    if(ev.pointerType==='touch'){mostrar(e,ev.clientX,ev.clientY);clearTimeout(tempo);tempo=setTimeout(esconder,2600)}
  },{passive:true});
  addEventListener('scroll',esconder,{passive:true});
  return{esconder};
})();

/* ---------- animação de entrada ao trocar de aba ou de mês ---------- */
function animarEntrada(){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const b=document.body;b.classList.remove('entra');void b.offsetWidth;b.classList.add('entra');
  clearTimeout(animarEntrada.t);animarEntrada.t=setTimeout(()=>b.classList.remove('entra'),1100);
}

/* número "redondo" para a escala dos eixos */
function escalaBonita(max){
  if(max<=0)return 1;
  const p=Math.pow(10,Math.floor(Math.log10(max))), f=max/p;
  return (f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10)*p;
}

/* ---------- ritmo do mês: gasto acumulado dia a dia × teto ---------- */
function gastoDiario(ym){
  const dias=diasNoMes(ym), d=new Array(dias).fill(0);
  txDoMes(ym).filter(t=>t.valor<0&&catById(t.catId).tipo!=='investimento').forEach(t=>{
    const dia=t.data&&t.data.slice(0,7)===ym?+t.data.slice(8,10):1;
    d[clamp(dia,1,dias)-1]+=-t.valor;
  });
  return d;
}
function graficoRitmo(ym){
  const o=orcamento(ym), dias=o.dias, porDia=gastoDiario(ym);
  const ate=o.ehMesAtual?o.diaHoje:dias;
  const acum=[];porDia.reduce((a,v,i)=>(acum[i]=a+v),0);
  const real=acum.slice(0,ate);
  const fim=o.ehMesAtual?o.projecaoFimMes:acum[dias-1];
  const max=escalaBonita(Math.max(o.tetoGasto,fim,real[real.length-1]||0,1));
  const W=320,H=132,pl=2,pr=2,pt=10,pb=16, w=W-pl-pr, h=H-pt-pb;
  const X=i=>pl+(i/(dias-1||1))*w, Y=v=>pt+h-(v/max)*h;
  let s='';
  [.5,1].forEach(f=>{const y=Y(max*f).toFixed(1);s+=`<line class="gridline" x1="0" x2="${W}" y1="${y}" y2="${y}"/><text x="${W-2}" y="${(+y-3).toFixed(1)}" text-anchor="end" font-size="7.5" fill="var(--ink-3)" font-family="${FONTE_NUM}">${esc(brlK(max*f))}</text>`});
  if(o.tetoGasto>0){
    s+=`<line x1="${X(0)}" y1="${Y(0)}" x2="${X(dias-1)}" y2="${Y(o.tetoGasto).toFixed(1)}" stroke="var(--ink-3)" stroke-dasharray="3 3" stroke-width="1.2"/>`;
    s+=`<line x1="0" x2="${W}" y1="${Y(o.tetoGasto).toFixed(1)}" y2="${Y(o.tetoGasto).toFixed(1)}" stroke="var(--warn)" stroke-width="1" opacity=".55"/>`;
    s+=`<text x="${W/2}" text-anchor="middle" y="${(Y(o.tetoGasto)-3).toFixed(1)}" font-size="8" fill="var(--warn)" font-family="${FONTE_UI}" font-weight="650">teto ${esc(brlK(o.tetoGasto))}</text>`;
  }
  if(real.length){
    const pts=real.map((v,i)=>X(i).toFixed(1)+','+Y(v).toFixed(1));
    const acima=o.tetoGasto>0&&real[real.length-1]>o.tetoGasto*(ate/dias);
    const cor=acima?'var(--bad)':'var(--good)';
    s+=`<path d="M${X(0)},${Y(0)} L${pts.join(' L')} L${X(real.length-1).toFixed(1)},${Y(0)} Z" fill="${cor}" opacity=".13"/>`;
    s+=`<path class="ln" pathLength="1" d="M${pts.join(' L')}" fill="none" stroke="${cor}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    if(o.ehMesAtual&&ate<dias)s+=`<line x1="${X(ate-1).toFixed(1)}" y1="${Y(real[ate-1]).toFixed(1)}" x2="${X(dias-1)}" y2="${Y(fim).toFixed(1)}" stroke="${cor}" stroke-dasharray="2 3" stroke-width="1.5" opacity=".8"/>
      <circle cx="${X(dias-1)-3}" cy="${Y(fim).toFixed(1)}" r="2.5" fill="${cor}"><title>Projeção para o fim do mês: ${brl(fim)}</title></circle>`;
    s+=`<circle cx="${X(real.length-1).toFixed(1)}" cy="${Y(real[real.length-1]).toFixed(1)}" r="3.5" fill="${cor}" stroke="var(--surface)" stroke-width="1.5"/>`;
  }
  /* faixas invisíveis para a dica de cada dia */
  const fx=w/dias;
  for(let i=0;i<dias;i++){
    const ideal=o.tetoGasto>0?Math.round(o.tetoGasto*(i+1)/dias):0;
    const txt=i<ate?`Dia ${i+1}: gastou ${brl(porDia[i])} · acumulado ${brl(acum[i])}${ideal?' · ritmo ideal '+brl(ideal):''}`:`Dia ${i+1}: ainda não chegou${ideal?' · ritmo ideal '+brl(ideal):''}`;
    s+=`<rect class="hit" x="${Math.max(0,X(i)-fx/2).toFixed(1)}" y="0" width="${fx.toFixed(1)}" height="${H-pb}" fill="transparent" data-tip="${esc(txt)}"/>`;
  }
  [1,Math.ceil(dias/2),dias].forEach(d=>s+=`<text x="${X(d-1).toFixed(1)}" y="${H-3}" text-anchor="${d===1?'start':d===dias?'end':'middle'}" font-size="8" fill="var(--ink-3)" font-family="${FONTE_UI}">dia ${d}</text>`);
  const status=!o.tetoGasto?'':fim>o.tetoGasto?`<span class="neg">no ritmo atual, fecha o mês em ${brl(fim)} — ${brl(fim-o.tetoGasto)} acima do teto</span>`
    :`<span class="pos">no ritmo atual, fecha o mês em ${brl(fim)} — sobram ${brl(o.tetoGasto-fim)}</span>`;
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block" role="img" aria-label="Gasto acumulado no mês comparado ao teto">${s}</svg>
    <div class="legend"><div><i style="background:var(--good)"></i>gasto acumulado</div><div><i style="background:var(--ink-3)"></i>ritmo ideal</div>${o.ehMesAtual?'<div><i style="background:var(--ink-3);opacity:.5"></i>projeção</div>':''}</div>
    ${status&&real.length?`<div class="sub" style="margin-top:var(--s2)">${o.ehMesAtual?status:status.replace('no ritmo atual, fecha o mês em','fechou o mês em')}</div>`:''}`;
}

/* ---------- categorias mês a mês (barras empilhadas) ---------- */
function graficoCategoriasMeses(ym,n=6){
  const meses=[];for(let i=n-1;i>=0;i--)meses.push(addMonthYM(ym,-i));
  const porMes=meses.map(m=>{const r={};gastoPorCategoria(m).forEach(c=>{r[c.cat.id]=c.valor});return r});
  const tot={};porMes.forEach(r=>Object.entries(r).forEach(([k,v])=>{tot[k]=(tot[k]||0)+v}));
  const top=Object.entries(tot).sort((a,b)=>b[1]-a[1]).slice(0,5).map(x=>x[0]);
  const series=[...top.map((id,i)=>({id,n:catById(id).nome,cor:COR[i%6]})),{id:'_out',n:'Outras',cor:'var(--ink-3)'}];
  const vals=porMes.map(r=>{const v=top.map(id=>r[id]||0);v.push(Object.entries(r).filter(([k])=>!top.includes(k)).reduce((a,[,x])=>a+x,0));return v});
  const somas=vals.map(v=>v.reduce((a,b)=>a+b,0));
  if(!somas.some(Boolean))return '';
  const max=escalaBonita(Math.max(...somas));
  const W=320,H=140,pt=12,pb=16,h=H-pt-pb, passo=W/n, bw=Math.min(30,passo*.6);
  let s='';
  [.5,1].forEach(f=>{const y=(pt+h-f*h).toFixed(1);s+=`<line class="gridline" x1="0" x2="${W}" y1="${y}" y2="${y}"/><text x="${W-2}" y="${(+y-3).toFixed(1)}" text-anchor="end" font-size="7.5" fill="var(--ink-3)" font-family="${FONTE_NUM}">${esc(brlK(max*f))}</text>`});
  meses.forEach((m,i)=>{
    let y=pt+h;const x=i*passo+(passo-bw)/2;
    vals[i].forEach((v,j)=>{
      if(!v)return;const hh=v/max*h;y-=hh;
      s+=`<rect class="br" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(.8,hh-1).toFixed(1)}" rx="2" fill="${series[j].cor}" style="animation-delay:${i*45}ms" data-tip="${esc(ymShort(m)+' · '+series[j].n+': '+brl(v)+' ('+pct(v/somas[i],0)+')')}"/>`;
    });
    s+=`<text x="${(x+bw/2).toFixed(1)}" y="${H-3}" text-anchor="middle" font-size="8" fill="${m===ym?'var(--ink)':'var(--ink-3)'}" font-weight="${m===ym?700:400}" font-family="${FONTE_UI}">${MES3[+m.slice(5)-1]}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block" role="img" aria-label="Gastos por categoria nos últimos ${n} meses">${s}</svg>
    <div class="legend">${series.filter((x,j)=>vals.some(v=>v[j])).map(x=>`<div><i style="background:${x.cor}"></i>${esc(x.n)}</div>`).join('')}</div>`;
}

/* ---------- histórico das faturas: meses passados, atual e futuros ---------- */
function totalFaturaMes(m){return -S.transacoes.filter(t=>t.cartaoId&&t.competencia===m&&t.valor<0).reduce((a,t)=>a+t.valor,0)}
function graficoHistoricoFaturas(ym,antes=6,depois=5){
  const meses=[];for(let i=-antes;i<=depois;i++)meses.push(addMonthYM(ym,i));
  const v=meses.map(totalFaturaMes);
  if(!v.some(Boolean))return '';
  const passados=v.slice(0,antes).filter(Boolean), media=passados.length?Math.round(passados.reduce((a,b)=>a+b,0)/passados.length):0;
  const max=escalaBonita(Math.max(...v,media,1));
  const W=320,H=136,pt=14,pb=16,h=H-pt-pb,n=meses.length,passo=W/n,bw=Math.min(18,passo*.62);
  let s='';
  [.5,1].forEach(f=>{const y=(pt+h-f*h).toFixed(1);s+=`<line class="gridline" x1="0" x2="${W}" y1="${y}" y2="${y}"/>`});
  meses.forEach((m,i)=>{
    const hh=Math.max(v[i]?1.5:0,v[i]/max*h), x=i*passo+(passo-bw)/2, y=pt+h-hh;
    const fut=i>antes, atual=i===antes;
    const cor=atual?'var(--accent)':fut?'var(--warn)':'var(--c1)';
    const var_=media&&!fut?` · ${v[i]>=media?'+':''}${pct((v[i]-media)/media,0)} da média`:'';
    s+=`<rect class="br" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${hh.toFixed(1)}" rx="3" fill="${cor}" opacity="${atual?1:fut?.55:.78}" ${fut?'stroke="var(--warn)" stroke-dasharray="2 2"':''} style="animation-delay:${i*35}ms" data-tip="${esc(ymLabel(m)+': '+brl(v[i])+(fut?' já comprometido em parcelas':var_))}"/>`;
    s+=`<text x="${(x+bw/2).toFixed(1)}" y="${H-3}" text-anchor="middle" font-size="7.5" fill="${atual?'var(--ink)':'var(--ink-3)'}" font-weight="${atual?700:400}" font-family="${FONTE_UI}">${MES3[+m.slice(5)-1]}</text>`;
  });
  if(media){const y=(pt+h-media/max*h).toFixed(1);
    s+=`<line x1="0" x2="${(antes+.9)*passo}" y1="${y}" y2="${y}" stroke="var(--ink-2)" stroke-dasharray="4 3" stroke-width="1"/><text x="2" y="${(+y-3).toFixed(1)}" font-size="8" fill="var(--ink-2)" font-family="${FONTE_UI}" font-weight="650">média ${esc(brlK(media))}</text>`}
  s+=`<text x="${W}" y="9" text-anchor="end" font-size="9" fill="var(--ink-2)" font-family="${FONTE_NUM}" font-weight="600">${esc(brl(v[antes]))}</text>`;
  const at=v[antes];
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block" role="img" aria-label="Total das faturas: 6 meses anteriores, mês atual e próximos meses">${s}</svg>
    <div class="legend"><div><i style="background:var(--c1)"></i>pagas</div><div><i style="background:var(--accent)"></i>${ymShort(ym)}</div><div><i style="background:var(--warn);opacity:.6"></i>já comprometidas</div></div>
    ${media&&at?`<div class="sub" style="margin-top:var(--s2)">Esta fatura está <b class="${at>media?'neg':'pos'}">${pct(Math.abs(at-media)/media,0)} ${at>media?'acima':'abaixo'}</b> da média dos últimos meses (${brl(media)}).</div>`:''}`;
}

/* ---------- calendário de gastos (mapa de calor do mês) ---------- */
function calendarioGastos(txs,ym){
  const dias=diasNoMes(ym), d=new Array(dias).fill(0), q=new Array(dias).fill(0);
  txs.forEach(t=>{if(t.data&&t.data.slice(0,7)===ym){const i=+t.data.slice(8,10)-1;d[i]+=-t.valor;q[i]++}});
  const fora=txs.filter(t=>!t.data||t.data.slice(0,7)!==ym);
  const max=Math.max(...d,1), ini=new Date(ym+'-01T12:00').getDay();
  const hoje=ym===ymNow()?new Date().getDate():0;
  let cel='';
  for(let i=0;i<ini;i++)cel+='<i class="vz"></i>';
  for(let i=0;i<dias;i++){
    const n=d[i]?.18+.82*Math.sqrt(d[i]/max):0;
    cel+=`<button class="dia${i+1===hoje?' hoje':''}${d[i]?' tem':''}${n>.5?' esc':''}" data-dia="${i+1}" style="--n:${n.toFixed(2)}" data-tip="${esc(String(i+1).padStart(2,'0')+'/'+ym.slice(5)+': '+(d[i]?brl(d[i])+' em '+q[i]+' compra'+(q[i]>1?'s':''):'sem gastos'))}"><span>${i+1}</span></button>`;
  }
  const top=d.map((v,i)=>({v,i})).filter(x=>x.v).sort((a,b)=>b.v-a.v).slice(0,3);
  const sem=['D','S','T','Q','Q','S','S'];
  return `<div class="cal" role="group" aria-label="Gastos por dia em ${ymLabel(ym)}">${sem.map(x=>`<b>${x}</b>`).join('')}${cel}</div>
    <div class="row" style="margin-top:var(--s2);font-size:var(--t-xs)"><span class="muted">menos</span><span class="calesc"><i style="--n:.18"></i><i style="--n:.45"></i><i style="--n:.72"></i><i style="--n:1"></i></span><span class="muted">mais</span></div>
    ${top.length?`<div class="sub" style="margin-top:var(--s2)">Dias mais pesados: ${top.map(x=>`<b style="color:var(--ink)">${x.i+1}/${ym.slice(5)}</b> (${brl(x.v)})`).join(' · ')}</div>`:''}
    ${fora.length?`<div class="sub" style="margin-top:4px">${fora.length} lançamento${fora.length>1?'s':''} com data de outro mês (parcelas e compras do ciclo anterior) não aparece${fora.length>1?'m':''} no calendário.</div>`:''}
    <div id="calDia"></div>`;
}
function ligarCalendario(el,txs,ym){
  $$('.cal [data-dia]',el).forEach(b=>b.onclick=()=>{
    const d=ym+'-'+String(b.dataset.dia).padStart(2,'0'), lst=txs.filter(t=>t.data===d);
    $$('.cal .sel',el).forEach(x=>x.classList.remove('sel'));b.classList.add('sel');
    $('#calDia',el).innerHTML=lst.length?`<div class="daygroup"><span>${dLabel(d)}</span><span class="num">${brl(-lst.reduce((a,t)=>a+t.valor,0))}</span></div><div class="list">${lst.map(itemTx).join('')}</div>`:'';
    $$('#calDia [data-tx]',el).forEach(x=>x.onclick=()=>abrirTx(x.dataset.tx));
  });
}

/* ---------- proventos recebidos por mês (rendimento por cota × quantidade) ---------- */
function proventosPorMes(n=12){
  const m={};
  for(const a of S.ativos||[]){
    if(!a.rendimentos||!(a.qtd>0))continue;
    for(const[ym,v]of Object.entries(a.rendimentos))m[ym]=(m[ym]||0)+Math.round(v*a.qtd);
  }
  return Object.keys(m).sort().slice(-n).map(ym=>({ym,v:m[ym]}));
}
