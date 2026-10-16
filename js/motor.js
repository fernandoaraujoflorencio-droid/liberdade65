/* =====================================================================
   LIBERDADE 65 — motor financeiro: orçamento, liberdade, gráficos, insights
   ===================================================================== */
const catById=id=>S.categorias.find(c=>c.id===id)||{id:'outros',nome:'Outros',tipo:'variavel',ic:'❓'};
const txDoMes=ym=>S.transacoes.filter(t=>t.competencia===ym);
const rendaMensal=()=>(S.perfil.rendaLiquida||0)+(S.perfil.outrasRendas||0);

function receitasDoMes(ym){
  const lanc=txDoMes(ym).filter(t=>t.valor>0).reduce((a,t)=>a+t.valor,0);
  return lanc>0?lanc:rendaMensal();
}
function despesasDoMes(ym){return -txDoMes(ym).filter(t=>t.valor<0&&catById(t.catId).tipo!=='investimento').reduce((a,t)=>a+t.valor,0)}
function aportesDoMes(ym){return -txDoMes(ym).filter(t=>t.valor<0&&catById(t.catId).tipo==='investimento').reduce((a,t)=>a+t.valor,0)}
function despesasPorTipo(ym,tipo){return -txDoMes(ym).filter(t=>t.valor<0&&catById(t.catId).tipo===tipo).reduce((a,t)=>a+t.valor,0)}
function gastoPorCategoria(ym){
  const m={};txDoMes(ym).filter(t=>t.valor<0&&catById(t.catId).tipo!=='investimento').forEach(t=>{m[t.catId]=(m[t.catId]||0)-t.valor});
  return Object.entries(m).map(([id,v])=>({cat:catById(id),valor:v})).sort((a,b)=>b.valor-a.valor);
}
/* parcelas futuras já compradas e ainda não pagas */
function comprometidoFuturo(aPartirYM){
  const m={};
  S.transacoes.filter(t=>t.valor<0&&t.competencia>=aPartirYM).forEach(t=>{m[t.competencia]=(m[t.competencia]||0)-t.valor});
  return m;
}
function parcelasEmAberto(ym){
  return S.transacoes.filter(t=>t.valor<0&&t.parcelaDe>1&&t.competencia>=ym)
    .reduce((a,t)=>a+(-t.valor),0);
}

function orcamento(ym){
  const renda=receitasDoMes(ym);
  const meta=S.perfil.metaPoupanca;
  const metaValor=Math.round(renda*meta);
  const tetoGasto=renda-metaValor;
  const gasto=despesasDoMes(ym);
  const aporte=aportesDoMes(ym);
  const disponivel=tetoGasto-gasto;
  const guardado=renda-gasto;                 // sobra do mês (poupado de fato)
  const taxa=renda>0?guardado/renda:0;
  const dias=diasNoMes(ym);
  const ehMesAtual=ym===ymNow();
  const diaHoje=ehMesAtual?new Date().getDate():dias;
  const diasRestantes=ehMesAtual?Math.max(1,dias-diaHoje+1):0;
  const porDia=ehMesAtual?Math.floor(disponivel/diasRestantes):0;
  const ritmoIdeal=Math.round(tetoGasto*(diaHoje/dias));
  return{renda,meta,metaValor,tetoGasto,gasto,aporte,disponivel,guardado,taxa,dias,diaHoje,diasRestantes,porDia,ritmoIdeal,ehMesAtual,
    ritmo:gasto-ritmoIdeal, projecaoFimMes:diaHoje>0?Math.round(gasto/diaHoje*dias):0};
}

/* média de despesa dos últimos N meses com lançamento */
function despesaMediaMensal(n=6){
  if(S.perfil.despesaMediaManual>0)return S.perfil.despesaMediaManual;
  const meses=[...new Set(S.transacoes.filter(t=>t.valor<0).map(t=>t.competencia))].sort().slice(-n);
  if(!meses.length){const r=rendaMensal();return r?Math.round(r*(1-S.perfil.metaPoupanca)):0}
  const soma=meses.reduce((a,m)=>a+despesasDoMes(m),0);
  return Math.round(soma/meses.length);
}
function despesaEssencialMensal(n=6){
  const meses=[...new Set(S.transacoes.filter(t=>t.valor<0).map(t=>t.competencia))].sort().slice(-n);
  if(!meses.length)return Math.round(despesaMediaMensal()*.6);
  const soma=meses.reduce((a,m)=>a+despesasPorTipo(m,'essencial'),0);
  const v=Math.round(soma/meses.length);
  return v||Math.round(despesaMediaMensal()*.6);
}
const patrimonio=()=>S.ativos.reduce((a,x)=>a+(x.valor||0),0)+(S.saldoContas||0)+(S.reservaAtual||0);
const patrimonioInvestido=()=>S.ativos.reduce((a,x)=>a+(x.valor||0),0)+(S.reservaAtual||0);

/* =====================================================================
   MOTOR — independência financeira
   ===================================================================== */
function fire(){
  const P=S.premissas;
  const despMes=despesaMediaMensal();
  const despAno=despMes*12;
  const numero=P.swr>0?Math.round(despAno/P.swr):0;
  const pv=patrimonioInvestido();
  const aporteMes=Math.max(0,Math.round(receitasDoMes(ymNow())*S.perfil.metaPoupanca));
  const rAno=P.retornoRealAA;
  const r=Math.pow(1+rAno,1/12)-1;
  const meses=nper(pv,aporteMes,numero,r);
  const anosCoast=Math.max(0,P.idadeCoast-P.idadeAtual);
  const coast=Math.round(numero/Math.pow(1+rAno,anosCoast));
  const rendaPassiva=Math.round(pv*P.swr/12);
  const rendaPassivaDY=Math.round(pv*P.dyCarteira/12);
  const progresso=numero>0?clamp(pv/numero,0,1):0;
  const reserva=despesaEssencialMensal()*P.mesesReserva;
  return{despMes,despAno,numero,pv,aporteMes,r,rAno,meses,coast,anosCoast,rendaPassiva,rendaPassivaDY,progresso,reserva,
    lean:Math.round(numero*.7),fat:Math.round(numero*1.5),barista:Math.round(numero*.5),
    coberto:despMes>0?rendaPassiva/despMes:0};
}
/* nº de meses para PV+PMT chegarem a FV com juros r ao mês */
function nper(pv,pmt,fv,r){
  if(fv<=pv)return 0;
  if(r<=0)return pmt>0?Math.ceil((fv-pv)/pmt):Infinity;
  if(pmt<=0){ if(pv<=0)return Infinity; return Math.log(fv/pv)/Math.log(1+r); }
  const num=fv*r+pmt, den=pv*r+pmt;
  if(den<=0)return Infinity;
  const n=Math.log(num/den)/Math.log(1+r);
  return n>0&&isFinite(n)?n:Infinity;
}
/* valor futuro de PV com aportes mensais PMT por n meses */
function fv(pv,pmt,r,n){ if(r===0)return pv+pmt*n; const f=Math.pow(1+r,n); return pv*f+pmt*(f-1)/r; }
function mesesTexto(m){
  if(!isFinite(m))return 'nunca com este aporte';
  if(m<=0)return 'você já chegou';
  const a=Math.floor(m/12), s=Math.round(m%12);
  if(a===0)return s+(s===1?' mês':' meses');
  return a+(a===1?' ano':' anos')+(s?' e '+s+(s===1?' mês':' meses'):'');
}
function dataAlvo(m){
  if(!isFinite(m))return '—';
  const d=new Date(); d.setMonth(d.getMonth()+Math.round(m));
  return MES3[d.getMonth()]+'/'+d.getFullYear();
}


/* =====================================================================
   GRÁFICOS — SVG próprio, sem dependências
   ===================================================================== */
const COR=['var(--c1)','var(--c2)','var(--c3)','var(--c4)','var(--c5)','var(--c6)'];

function donut(dados,opt={}){
  const total=dados.reduce((a,d)=>a+d.v,0)||1;
  const R=52,r=33,cx=60,cy=60,gap=.028;
  let ang=-Math.PI/2, paths='';
  dados.forEach((d,i)=>{
    const frac=d.v/total; let a0=ang+gap/2, a1=ang+frac*2*Math.PI-gap/2;
    if(a1<a0)a1=a0+.001; ang+=frac*2*Math.PI;
    const large=(a1-a0)>Math.PI?1:0;
    const p=(rad,a)=>[cx+rad*Math.cos(a),cy+rad*Math.sin(a)];
    const[x1,y1]=p(R,a0),[x2,y2]=p(R,a1),[x3,y3]=p(r,a1),[x4,y4]=p(r,a0);
    paths+=`<path d="M${x1.toFixed(2)} ${y1.toFixed(2)} A${R} ${R} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L${x3.toFixed(2)} ${y3.toFixed(2)} A${r} ${r} 0 ${large} 0 ${x4.toFixed(2)} ${y4.toFixed(2)} Z" fill="${d.cor||COR[i%6]}"><title>${esc(d.n)}: ${brl(d.v)} (${pct(d.v/total,1)})</title></path>`;
  });
  return `<svg viewBox="0 0 120 120" width="120" height="120" role="img" aria-label="${esc(opt.alt||'Distribuição')}">${paths}
    <text x="60" y="57" text-anchor="middle" font-size="9" fill="var(--ink-3)" font-family="Public Sans, system-ui, sans-serif" font-weight="700" letter-spacing=".5">${esc(opt.lab||'TOTAL')}</text>
    <text x="60" y="70" text-anchor="middle" font-size="12.5" fill="var(--ink)" font-family="IBM Plex Mono, ui-monospace, Consolas, monospace" font-weight="600">${esc(opt.centro||brlK(total))}</text></svg>`;
}
function barrasH(dados,opt={}){
  const max=Math.max(...dados.map(d=>d.v),1);
  return `<div class="list">`+dados.map((d,i)=>`
    <div style="padding:7px 0">
      <div class="row" style="margin-bottom:5px">
        <span style="font-size:13px;font-weight:600;display:flex;align-items:center;gap:7px;min-width:0">
          <i style="width:9px;height:9px;border-radius:3px;background:${d.cor||COR[i%6]};flex:none"></i>
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(d.n)}</span></span>
        <span class="num" style="font-size:13px;font-weight:600;white-space:nowrap">${brl(d.v)}<span class="muted" style="font-size:11px"> · ${opt.tot?pct(d.v/opt.tot,0):''}</span></span>
      </div>
      <div class="bar"><i style="width:${(d.v/max*100).toFixed(1)}%;background:${d.cor||COR[i%6]}"></i></div>
    </div>`).join('')+`</div>`;
}
/* linha/área com projeção */
function areaChart(serie,opt={}){
  const W=320,H=118,pad={l:2,r:2,t:8,b:16};
  const n=serie.length; if(n<2)return '<div class="empty">Sem histórico ainda</div>';
  const max=Math.max(...serie.map(s=>s.v),opt.meta||0)*1.06||1, min=0;
  const X=i=>pad.l+i/(n-1)*(W-pad.l-pad.r);
  const Y=v=>pad.t+(1-(v-min)/(max-min))*(H-pad.t-pad.b);
  let d='',a='';
  serie.forEach((s,i)=>{d+=(i?'L':'M')+X(i).toFixed(1)+' '+Y(s.v).toFixed(1)+' '});
  a=d+`L${X(n-1).toFixed(1)} ${Y(0)} L${X(0).toFixed(1)} ${Y(0)} Z`;
  const gl=[.25,.5,.75,1].map(f=>`<line class="gridline" x1="0" x2="${W}" y1="${Y(max*f).toFixed(1)}" y2="${Y(max*f).toFixed(1)}"/>`).join('');
  const metaLine=opt.meta?`<line x1="0" x2="${W}" y1="${Y(opt.meta).toFixed(1)}" y2="${Y(opt.meta).toFixed(1)}" stroke="var(--accent)" stroke-width="1.4" stroke-dasharray="4 3"/>
    <text x="${W-2}" y="${(Y(opt.meta)-4).toFixed(1)}" text-anchor="end" font-size="8.5" fill="var(--accent)" font-family="Public Sans, system-ui, sans-serif" font-weight="700">meta ${brlK(opt.meta)}</text>`:'';
  const marcas=serie.map((s,i)=>(i%Math.ceil(n/4)===0||i===n-1)?`<text x="${X(i).toFixed(1)}" y="${H-3}" text-anchor="${i===0?'start':(i===n-1?'end':'middle')}" font-size="8" fill="var(--ink-3)" font-family="Public Sans, system-ui, sans-serif">${esc(s.l)}</text>`:'').join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(opt.alt||'Evolução')}" style="display:block">
    <defs><linearGradient id="gA" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="var(--good)" stop-opacity=".30"/><stop offset="100%" stop-color="var(--good)" stop-opacity="0"/></linearGradient></defs>
    ${gl}${metaLine}<path d="${a}" fill="url(#gA)"/><path d="${d}" fill="none" stroke="var(--good)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${X(n-1).toFixed(1)}" cy="${Y(serie[n-1].v).toFixed(1)}" r="3.6" fill="var(--good)" stroke="var(--surface)" stroke-width="2"/>
    ${marcas}</svg>`;
}
/* barras verticais (aporte x juros) */
function barrasV(serie,opt={}){
  const W=320,H=110,pad={t:6,b:16};
  const max=Math.max(...serie.map(s=>s.a+s.b),1);
  const bw=Math.max(2,(W/serie.length)-2.5);
  let out='';
  serie.forEach((s,i)=>{
    const x=i*(W/serie.length);
    const ha=(s.a/max)*(H-pad.t-pad.b), hb=(s.b/max)*(H-pad.t-pad.b);
    out+=`<rect x="${x.toFixed(1)}" y="${(H-pad.b-ha).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0,ha).toFixed(1)}" fill="var(--c3)" rx="1.5"><title>${esc(s.l)} · aportado ${brlK(s.a)}</title></rect>
    <rect x="${x.toFixed(1)}" y="${(H-pad.b-ha-hb-2).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0,hb).toFixed(1)}" fill="var(--accent)" rx="1.5"><title>${esc(s.l)} · juros ${brlK(s.b)}</title></rect>`;
    if(i%Math.ceil(serie.length/5)===0||i===serie.length-1)
      out+=`<text x="${(x+bw/2).toFixed(1)}" y="${H-3}" text-anchor="middle" font-size="8" fill="var(--ink-3)" font-family="Public Sans, system-ui, sans-serif">${esc(s.l)}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block" role="img" aria-label="${esc(opt.alt||'Composição do patrimônio')}">${out}</svg>`;
}
/* arco de progresso da taxa de poupança */
function gauge(valor,meta,opt={}){
  const W=150,H=86,cx=75,cy=76,R=62;
  const ang=t=>Math.PI+clamp(t,0,1)*Math.PI;
  const pt=(a,rad=R)=>[cx+rad*Math.cos(a),cy+rad*Math.sin(a)];
  const arc=(t0,t1,cor,w)=>{const a0=ang(t0),a1=ang(t1);const[x0,y0]=pt(a0),[x1,y1]=pt(a1);
    return `<path d="M${x0.toFixed(1)} ${y0.toFixed(1)} A${R} ${R} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}" fill="none" stroke="${cor}" stroke-width="${w}" stroke-linecap="round"/>`};
  const esc_=clamp(valor,0,1.2)/1.2, mesc=clamp(meta,0,1.2)/1.2;
  const[mx,my]=pt(ang(mesc),R+9),[mx2,my2]=pt(ang(mesc),R-9);
  const cor=valor>=meta?'var(--good)':(valor>=meta*.7?'var(--warn)':'var(--bad)');
  return `<svg viewBox="0 0 ${W} ${H}" width="150" height="86" role="img" aria-label="Taxa de poupança ${pct(valor,0)} contra meta ${pct(meta,0)}">
    ${arc(0,1,'var(--sunken)',11)}${valor>0?arc(0,esc_,cor,11):''}
    <line x1="${mx.toFixed(1)}" y1="${my.toFixed(1)}" x2="${mx2.toFixed(1)}" y2="${my2.toFixed(1)}" stroke="var(--ink)" stroke-width="2"/>
    <text x="75" y="58" text-anchor="middle" font-size="24" font-family="IBM Plex Mono, ui-monospace, Consolas, monospace" font-weight="600" fill="${cor}">${pct(valor,0)}</text>
    <text x="75" y="72" text-anchor="middle" font-size="9" font-family="Public Sans, system-ui, sans-serif" font-weight="700" fill="var(--ink-3)" letter-spacing=".6">META ${pct(meta,0)}</text></svg>`;
}

/* limite / dívida do cartão */
function cartaoResumo(c){
  const txs=S.transacoes.filter(t=>t.cartaoId===c.id&&t.valor<0);
  const ciclo=S.ui.ym;
  const atual=-txs.filter(t=>t.competencia===ciclo).reduce((a,t)=>a+t.valor,0);
  const emAberto=-txs.filter(t=>t.competencia>=ciclo).reduce((a,t)=>a+t.valor,0);
  const futuro=-txs.filter(t=>t.competencia>ciclo).reduce((a,t)=>a+t.valor,0);
  return{atual,emAberto,futuro,uso:c.limite?clamp(emAberto/c.limite,0,1):0,disponivel:Math.max(0,c.limite-emAberto)};
}
function dividaTotal(){return S.cartoes.reduce((a,c)=>a+cartaoResumo(c).emAberto,0)}

/* =====================================================================
   INSIGHTS — o que um planejador olharia primeiro
   ===================================================================== */
function insights(ym){
  const o=orcamento(ym), F=fire(), out=[];
  const div=dividaTotal();
  if(o.renda<=0) out.push({t:'bad',ic:'⚠️',h:'Falta a sua renda líquida',p:'Sem ela nenhum limite de gasto é confiável. Toque na engrenagem e informe quanto cai na conta por mês.'});
  if(div>0&&o.renda>0){
    const meses=o.renda?div/o.renda:0;
    out.push({t:meses>1.5?'bad':'warn',ic:'💳',h:'Dívida de cartão: '+brl(div),
      p:'É '+meses.toFixed(1).replace('.',',')+' vez(es) a sua renda mensal já comprometida. Enquanto existir parcela, ela rende contra você: quitar antecipado costuma ser o melhor "investimento" disponível.'});
  }
  if(o.renda>0&&o.taxa<S.perfil.metaPoupanca)
    out.push({t:'warn',ic:'🎯',h:'Taxa de poupança em '+pct(o.taxa,0),p:'Faltam '+brl(Math.max(0,o.metaValor-o.guardado))+' para fechar o mês nos '+pct(S.perfil.metaPoupanca,0)+'. Cortar aqui vale mais que render 1% a mais na carteira.'});
  if(o.renda>0&&o.taxa>=S.perfil.metaPoupanca)
    out.push({t:'ok',ic:'✅',h:'Meta de '+pct(S.perfil.metaPoupanca,0)+' cumprida',p:'Sobra de '+brl(o.guardado)+' neste mês. Transfira para a carteira ainda hoje — dinheiro parado na conta corrente vira gasto.'});
  /* assinaturas recorrentes */
  const rec=recorrentes();
  if(rec.length) out.push({t:'neutral',ic:'🔁',h:rec.length+' cobranças recorrentes: '+brl(rec.reduce((a,r)=>a+r.valor,0))+'/mês',
    p:'Em 12 meses são '+brl(rec.reduce((a,r)=>a+r.valor,0)*12)+'. '+rec.slice(0,3).map(r=>r.desc).join(', ')+'.'});
  /* ritmo */
  if(o.ehMesAtual&&o.renda>0&&o.gasto>0){
    const dif=o.projecaoFimMes-o.tetoGasto;
    out.push({t:dif>0?'warn':'ok',ic:dif>0?'📈':'📉',h:dif>0?'Ritmo acima do teto':'Ritmo dentro do teto',
      p:'No passo atual você fecha o mês em '+brl(o.projecaoFimMes)+' de gasto, contra um teto de '+brl(o.tetoGasto)+'.'});
  }
  /* reserva */
  if(S.reservaAtual<F.reserva)
    out.push({t:'warn',ic:'🛟',h:'Reserva de emergência incompleta',p:'O alvo é '+brl(F.reserva)+' ('+S.premissas.mesesReserva+' meses de despesa essencial). Você tem '+brl(S.reservaAtual)+'. A reserva vem antes de qualquer aporte de risco.'});
  return out;
}
function recorrentes(){
  const m={};
  S.transacoes.filter(t=>t.valor<0&&t.parcelaDe===1).forEach(t=>{
    const k=chaveEstab(t.desc);(m[k]=m[k]||{desc:t.desc,meses:new Set(),valor:0});
    m[k].meses.add(t.competencia);m[k].valor=Math.max(m[k].valor,-t.valor);
  });
  return Object.values(m).filter(x=>x.meses.size>=2).sort((a,b)=>b.valor-a.valor);
}
/* custo de oportunidade: quanto R$ X viram no futuro, e quantos dias adiam a liberdade */
function custoOportunidade(valorCents){
  const F=fire(), anos=10, n=anos*12;
  const futuro=Math.round(valorCents*Math.pow(1+F.r,n));
  let dias=0;
  if(isFinite(F.meses)&&F.aporteMes>0){
    const m2=nper(F.pv-valorCents,F.aporteMes,F.numero,F.r);
    dias=Math.round((m2-F.meses)*30.4);
  }
  return{futuro,anos,dias};
}
