/* =====================================================================
   LIBERDADE 65 — telas: painel, lançar, faturas, investir, liberdade, config
   ===================================================================== */
const TITULOS={painel:'Painel',lancar:'Lançamentos',faturas:'Faturas',investir:'Investir',liberdade:'Liberdade',config:'Configurações'};

/* limites de gasto por categoria — guardados em S.metas (campo que já existia vazio):
   {id, tipo:'limite', catId, valor(centavos por mês)} */
const limites=()=>(S.metas||[]).filter(m=>m&&m.tipo==='limite'&&m.valor>0);
const limiteDe=catId=>limites().find(m=>m.catId===catId)?.valor||0;

function renderPainel(){
  const ym=S.ui.ym, o=orcamento(ym), F=fire(), el=$('#v-painel');
  const semRenda=o.renda<=0;
  const corDisp=o.disponivel<0?'var(--bad)':(o.disponivel<o.tetoGasto*.15?'var(--warn)':'var(--good)');
  const valorHero=o.ehMesAtual?Math.max(0,o.porDia):Math.max(0,o.disponivel);
  const [ints,dec]=brl(valorHero,{noPrefix:true}).split(',');
  const meta=S.perfil.metaPoupanca, ok=o.taxa>=meta;
  const parcelas=-txDoMes(ym).filter(t=>t.valor<0&&t.parcelaDe>1).reduce((a,t)=>a+t.valor,0);
  const ins=insights(ym);
  const cats=gastoPorCategoria(ym);
  const totCat=cats.reduce((a,c)=>a+c.valor,0);
  const A=typeof resumoAportes==='function'?resumoAportes(ym):{liquido:0,n:0};
  const sm=serieMeses(ym,6), temHist=sm.some(m=>m.vals.some(v=>v>0));

  el.innerHTML=`
  ${avisoBackupHTML()}
  ${semRenda?`<button class="card span2" id="cta-renda" style="text-align:left;width:100%;border-color:var(--accent);background:var(--accent-soft);cursor:pointer">
    <h3 style="color:var(--accent)">Comece por aqui <span class="tag">passo 1</span></h3>
    <div style="font-size:var(--t-base);font-weight:650;margin-bottom:4px">Quanto cai na sua conta por mês?</div>
    <div class="sub">Informe a renda líquida para eu calcular quanto você pode gastar guardando ${pct(meta,0)}.</div>
  </button>`:''}

  <div class="hero span2">
    <div class="lab">${o.ehMesAtual?'Você pode gastar hoje':'Sobrou no mês'}</div>
    <div class="big"><span class="cur">R$</span>${ints}<span class="cents">,${dec}</span></div>
    <div class="note">${semRenda?'Informe sua renda para eu calcular este número.'
      :o.ehMesAtual?`${brl(Math.max(0,o.disponivel))} livres até o fim do mês (${o.diasRestantes} dia${o.diasRestantes>1?'s':''}), já separando ${brl(o.metaValor)} para investir.`
      :`O teto do mês era ${brl(o.tetoGasto)}.`}</div>
    <div class="kpis">
      <div><div class="k">Entrou</div><div class="v pos">${brl(o.renda)}</div></div>
      <div><div class="k">Gastou</div><div class="v ${o.gasto>o.tetoGasto&&o.tetoGasto>0?'neg':''}">${brl(o.gasto)}</div><div class="d">teto ${brl(o.tetoGasto)}</div></div>
      <div><div class="k">Investiu</div><div class="v">${brl(o.aporte||Math.max(0,A.liquido))}</div><div class="d">${A.n?A.n+' movimentaç'+(A.n>1?'ões':'ão'):'aportes do mês'}</div></div>
      <div><div class="k">Guardou</div><div class="v ${ok?'pos':'neg'}">${pct(o.taxa,0)}</div><div class="d">meta ${pct(meta,0)} ${ok?'✓':''}</div></div>
    </div>
  </div>

  <div class="card">
    <h3>Orçamento de ${ymShort(ym)} <span class="tag ${ok?'pill ok':'pill warn'}">${ok?'no alvo':'atenção'}</span></h3>
    <div class="track" role="img" aria-label="Gasto de ${brl(o.gasto)} de um teto de ${brl(o.tetoGasto)}">
      <i style="width:${clamp(o.gasto/Math.max(1,o.tetoGasto),0,1)*100}%;background:${corDisp};opacity:.9"></i>
      ${o.ehMesAtual?`<b style="left:${clamp(o.diaHoje/o.dias,0,1)*100}%" title="hoje"></b>`:''}
    </div>
    <div class="row" style="margin:6px 0 var(--s3);font-size:var(--t-xs)">
      <span class="muted num">${pct(o.tetoGasto>0?o.gasto/o.tetoGasto:0,0)} do teto usado</span>
      <span class="muted">${o.ehMesAtual?'o traço marca hoje':''}</span>
    </div>
    <div class="linhas">
      <div class="row"><span>Essenciais</span><span class="num">${brl(despesasPorTipo(ym,'essencial'))}</span></div>
      <div class="row"><span>Variáveis</span><span class="num">${brl(despesasPorTipo(ym,'variavel'))}</span></div>
      ${parcelas?`<div class="row"><span>· das quais parcelas de cartão</span><span class="num" style="color:var(--warn)">${brl(parcelas)}</span></div>`:''}
      <div class="row"><span><b>Sobra do mês</b></span><span class="num ${sinalCls(o.guardado)}"><b>${brlS(o.guardado)}</b></span></div>
    </div>
  </div>

  <div class="card"><h3>Últimos 6 meses</h3>
    ${temHist?barrasGrupo(sm,[{n:'Entradas',cor:'var(--good)'},{n:'Gastos',cor:'var(--bad)'},{n:'Aportes',cor:'var(--c3)'}],{alt:'Entradas, gastos e aportes nos últimos 6 meses'})
      +(()=>{const g=sm.map(m=>m.vals[1]).filter(v=>v>0);const med=g.length?Math.round(g.reduce((a,b)=>a+b,0)/g.length):0;
        return med?`<div class="sub" style="margin-top:var(--s2)">Gasto médio <b class="num" style="color:var(--ink)">${brl(med)}</b>/mês · este mês ${o.gasto>med?'<span class="neg">acima</span>':'<span class="pos">abaixo</span>'} da média</div>`:''})()
      :vazio({ic:'investir',t:'Sem histórico ainda',p:'O gráfico aparece quando houver lançamentos nos meses anteriores.'})}
  </div>

  <div class="card"><h3>Gastos por categoria <button class="btn ghost sm" id="btnLimites" style="text-transform:none;letter-spacing:0">Limites</button></h3>
    ${cats.length?`<div class="empilhada" role="img" aria-label="Divisão dos gastos">${cats.slice(0,6).map((c,i)=>`<i style="width:${(c.valor/totCat*100).toFixed(1)}%;background:${COR[i%6]}" title="${esc(c.cat.nome)}"></i>`).join('')}</div>
      <div style="margin-top:var(--s3)">${cats.slice(0,6).map((c,i)=>{const lim=limiteDe(c.cat.id), base=Math.max(lim,c.valor), passou=lim&&c.valor>lim;
        return `<div class="catbar"><div class="row"><span>${c.cat.ic} ${esc(c.cat.nome)}</span>
          <span class="num"><b>${brl(c.valor)}</b> ${lim?`<span class="${passou?'neg':'muted'}" style="font-size:var(--t-xs)">/ ${brl(lim,{dec:0})}</span>`:`<span class="muted" style="font-size:var(--t-xs)">${pct(c.valor/totCat,0)}</span>`}</span></div>
          <div class="trk"><i style="width:${(c.valor/base*100).toFixed(1)}%;background:${passou?'var(--bad)':COR[i%6]}"></i>${lim?`<b style="left:${Math.min(100,lim/base*100).toFixed(1)}%"></b>`:''}</div></div>`}).join('')}</div>
      ${cats.length>6?`<button class="btn ghost sm block" data-goto="lancar" style="margin-top:var(--s2)">Ver todas as ${cats.length} categorias</button>`:''}`
    :vazio({ic:'lista',t:'Nenhum gasto em '+ymLabel(ym),p:'Lance um gasto pelo <b>+</b> ou importe a fatura do cartão.',acao:'Importar fatura',attrs:'data-goto="faturas"'})}
  </div>

  <div class="card"><h3>Atenção</h3>
    ${ins.length?`<div class="list">${ins.slice(0,3).map(itemInsight).join('')}</div>
      ${ins.length>3?`<details class="acc" style="margin-top:var(--s2)"><summary>Mais ${ins.length-3} ponto${ins.length-3>1?'s':''}</summary><div class="body" style="padding:0 var(--s3)"><div class="list">${ins.slice(3).map(itemInsight).join('')}</div></div></details>`:''}`
      :vazio({ic:'check',t:'Tudo em ordem',p:'Nada que precise da sua atenção neste mês.'})}
  </div>

  <div class="card span2">
    <h3>Patrimônio e liberdade <button class="btn ghost sm" data-goto="liberdade" style="text-transform:none;letter-spacing:0">Ver plano</button></h3>
    <div class="grid3">
      <div class="stat"><div class="k">Patrimônio investido</div><div class="v">${brl(F.pv)}</div></div>
      <div class="stat"><div class="k">Aporte líquido do mês</div><div class="v ${sinalCls(A.liquido)}">${A.n?brlS(A.liquido):brl(o.aporte)}</div><div class="d">${A.n?'compras − vendas':'pelos lançamentos'}</div></div>
      <div class="stat"><div class="k">Número da liberdade</div><div class="v">${brlK(F.numero)}</div><div class="d">${F.numero>0&&isFinite(F.meses)?'faltam '+mesesTexto(F.meses):'defina renda e aporte'}</div></div>
    </div>
    <div class="bar" style="height:10px;margin-top:var(--s3)" role="progressbar" aria-label="Progresso até o número da liberdade" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${(F.progresso*100).toFixed(0)}"><i style="width:${(F.progresso*100).toFixed(2)}%;background:var(--accent)"></i></div>
    <div class="sub" style="margin-top:6px">${pct(F.progresso,1)} do caminho até a liberdade financeira</div>
  </div>`;
  el.querySelector('#cta-renda')?.addEventListener('click',()=>abrirConfigRenda());
  $('#btnLimites')?.addEventListener('click',()=>abrirLimites());
}
function itemInsight(i){
  return `<div class="item" style="align-items:flex-start">
    <div class="ic" aria-hidden="true" style="background:var(--${i.t==='ok'?'good':i.t==='bad'?'bad':i.t==='warn'?'warn':'sunken'}-soft, var(--sunken))">${i.ic}</div>
    <div class="mid"><div class="t" style="white-space:normal">${esc(i.h)}</div><div class="s" style="white-space:normal;color:var(--ink-2);margin-top:2px">${esc(i.p)}</div></div>
  </div>`;
}
function abrirLimites(){
  const cats=S.categorias.filter(c=>c.tipo==='essencial'||c.tipo==='variavel');
  const med=id=>{const meses=[1,2,3].map(n=>addMonthYM(S.ui.ym,-n));const v=meses.map(m=>-txDoMes(m).filter(t=>t.catId===id&&t.valor<0).reduce((a,t)=>a+t.valor,0));return Math.round(v.reduce((a,b)=>a+b,0)/3)};
  sheet(`<h2>Limites por categoria</h2><div class="sh-sub">Quanto você quer gastar no máximo, por mês, em cada categoria. Deixe vazio para não ter limite. O Painel avisa quando passar.</div>
  <div class="grid2">${cats.map(c=>{const m=med(c.id);return `<div class="fgroup"><label class="f" for="lim-${c.id}">${c.ic} ${esc(c.nome)}</label>
    <input class="inp lim" id="lim-${c.id}" data-cat="${c.id}" inputmode="decimal" value="${campoMoney(limiteDe(c.id))}" placeholder="sem limite" ${m?`aria-describedby="limh-${c.id}"`:''}>
    ${m?`<div class="hint" id="limh-${c.id}">média dos últimos 3 meses: ${brl(m)}</div>`:''}</div>`}).join('')}</div>
  <button class="btn" id="limSalvar">Salvar limites</button>`);
  $('#limSalvar').onclick=()=>{
    const outros=(S.metas||[]).filter(m=>!(m&&m.tipo==='limite'));
    const novos=$$('.lim').map(i=>({id:'lim-'+i.dataset.cat,tipo:'limite',catId:i.dataset.cat,valor:parseMoney(i.value)})).filter(m=>m.valor>0);
    S.metas=[...outros,...novos];salvar();fecharSheet();render();toast(novos.length?novos.length+' limite'+(novos.length>1?'s':'')+' salvo'+(novos.length>1?'s':''):'Limites removidos');
  };
}

let filtroLanc={q:'',tipo:'todos'};
function renderLancar(){
  const ym=S.ui.ym, el=$('#v-lancar');
  let txs=txDoMes(ym);
  if(filtroLanc.tipo==='despesas')txs=txs.filter(t=>t.valor<0);
  if(filtroLanc.tipo==='receitas')txs=txs.filter(t=>t.valor>0);
  if(filtroLanc.tipo==='parcelas')txs=txs.filter(t=>t.parcelaDe>1);
  if(filtroLanc.q){const q=filtroLanc.q.toLowerCase();txs=txs.filter(t=>t.desc.toLowerCase().includes(q)||catById(t.catId).nome.toLowerCase().includes(q))}
  txs=[...txs].sort((a,b)=>b.data.localeCompare(a.data)||b.id.localeCompare(a.id));
  const dias={}; txs.forEach(t=>{(dias[t.data]=dias[t.data]||[]).push(t)});
  const tot=-txs.filter(t=>t.valor<0).reduce((a,t)=>a+t.valor,0);
  const ent=txs.filter(t=>t.valor>0).reduce((a,t)=>a+t.valor,0);
  const filtrando=filtroLanc.q||filtroLanc.tipo!=='todos';

  el.innerHTML=`
  <div class="card flat span2" style="padding:var(--s3)">
    <label class="sr-only" for="buscaLanc">Buscar lançamentos</label>
    <input class="inp" id="buscaLanc" type="search" placeholder="Buscar estabelecimento ou categoria" value="${esc(filtroLanc.q)}" style="margin-bottom:var(--s2)">
    <div class="seg" role="group" aria-label="Filtrar lançamentos">
      ${[['todos','Tudo'],['despesas','Saídas'],['receitas','Entradas'],['parcelas','Parcelas']].map(([k,n])=>
        `<button data-filtro="${k}" aria-pressed="${filtroLanc.tipo===k}">${n}</button>`).join('')}
    </div>
  </div>
  <div class="card span2">
    <div class="row" style="margin-bottom:2px;flex-wrap:wrap">
      <span class="sub">${txs.length} lançamento${txs.length===1?'':'s'} em ${ymLabel(ym)}</span>
      <span style="display:flex;gap:var(--s3)">${ent?`<span class="num pos" style="font-weight:600">${brlS(ent)}</span>`:''}<span class="num ${tot?'neg':''}" style="font-weight:600">${brlS(-tot)}</span></span>
    </div>
    ${txs.length?Object.entries(dias).map(([d,arr])=>`
      <div class="daygroup"><span>${dLabel(d)}</span>${(()=>{const v=arr.reduce((a,t)=>a+t.valor,0);return `<span class="num ${sinalCls(v)}">${brlS(v)}</span>`})()}</div>
      <div class="list">${arr.map(t=>itemTx(t)).join('')}</div>`).join('')
      :(filtrando?vazio({ic:'lista',t:'Nada encontrado',p:'Nenhum lançamento combina com a busca ou o filtro escolhido.',acao:'Limpar filtros',attrs:'id="limparFiltro"'})
        :vazio({ic:'lista',t:'Nenhum lançamento em '+ymLabel(ym),p:'Toque no <b>+</b> para lançar um gasto, uma receita ou um aporte — ou importe a fatura do cartão.',acao:'Novo lançamento',attrs:'id="novoLancVazio"'}))}
  </div>
  <button class="btn ghost" data-goto="faturas">Importar uma fatura</button>`;
  $('#buscaLanc').addEventListener('input',e=>{filtroLanc.q=e.target.value;const p=e.target.selectionStart;renderLancar();const b=$('#buscaLanc');b.focus();b.setSelectionRange(p,p)});
  $$('[data-filtro]',el).forEach(b=>b.onclick=()=>{filtroLanc.tipo=b.dataset.filtro;renderLancar()});
  $$('[data-tx]',el).forEach(b=>b.onclick=()=>abrirTx(b.dataset.tx));
  $('#limparFiltro')?.addEventListener('click',()=>{filtroLanc={q:'',tipo:'todos'};renderLancar()});
  $('#novoLancVazio')?.addEventListener('click',()=>abrirTx());
}
function itemTx(t){
  const c=catById(t.catId), cart=S.cartoes.find(x=>x.id===t.cartaoId);
  return `<button class="item" data-tx="${t.id}" aria-label="${esc(t.desc)}, ${t.valor<0?'saída':'entrada'} de ${brl(Math.abs(t.valor))}">
    <div class="ic" aria-hidden="true">${c.ic}</div>
    <div class="mid">
      <div class="t">${esc(t.desc)}</div>
      <div class="s">${esc(c.nome)}${cart?' · '+esc(cart.nome):''}${t.parcelaDe>1?` · <b style="color:var(--warn)">${t.parcelaN}/${t.parcelaDe}</b>`:''}${t.futura?' · futura':''}</div>
    </div>
    <div class="val ${sinalCls(t.valor)}">${t.valor<0?'−':'+'}${brl(Math.abs(t.valor),{noPrefix:true})}</div>
  </button>`;
}

let faturaVista='categorias';
function renderFaturas(){
  const ym=S.ui.ym, el=$('#v-faturas');
  const futuro=comprometidoFuturo(addMonthYM(ym,1));
  const mesesFut=Object.keys(futuro).sort().slice(0,12);
  const totalFut=mesesFut.reduce((a,m)=>a+futuro[m],0);
  const temCartao=S.cartoes.length>0;
  const txs=S.transacoes.filter(t=>t.cartaoId&&t.competencia===ym&&t.valor<0);
  const totMes=-txs.reduce((a,t)=>a+t.valor,0);
  const parc=txs.filter(t=>t.parcelaDe>1);

  const vistas={
    categorias:()=>{const gs=gruposPorCategoria(txs);
      return `<div class="empilhada" style="margin-bottom:var(--s3)" role="img" aria-label="Divisão da fatura por categoria">${gs.slice(0,6).map((g,i)=>`<i style="width:${(g.total/totMes*100).toFixed(1)}%;background:${COR[i%6]}" title="${esc(g.cat.nome)}"></i>`).join('')}</div>
      ${gs.map((g,i)=>`<details class="grupo"><summary><i style="width:10px;height:10px;border-radius:3px;background:${COR[i%6]};flex:none"></i>
        <span class="gnome">${g.cat.ic} ${esc(g.cat.nome)}</span><span class="gqtd">${g.itens.length} · ${pct(g.total/totMes,0)}</span><span class="gval">${brl(g.total)}</span></summary>
        <div class="gcorpo"><div class="list">${g.itens.map(itemTx).join('')}</div></div></details>`).join('')}`},
    lancamentos:()=>{const dias={};[...txs].sort((a,b)=>b.data.localeCompare(a.data)).forEach(t=>{(dias[t.data]=dias[t.data]||[]).push(t)});
      return Object.entries(dias).map(([d,arr])=>`<div class="daygroup"><span>${dLabel(d)}</span><span class="num">${brl(-arr.reduce((a,t)=>a+t.valor,0))}</span></div>
        <div class="list">${arr.map(itemTx).join('')}</div>`).join('')},
    parcelas:()=>parc.length?`<div class="list">${[...parc].sort((a,b)=>(b.parcelaDe-b.parcelaN)*-b.valor-(a.parcelaDe-a.parcelaN)*-a.valor).map(t=>{
        const falta=(t.parcelaDe-t.parcelaN)*-t.valor;
        return `<button class="item parc" data-tx="${t.id}">
          <div class="mid"><div class="t">${esc(t.desc)}</div>
            <div class="bar" style="height:5px;margin:6px 0 4px"><i style="width:${(t.parcelaN/t.parcelaDe*100).toFixed(0)}%;background:var(--warn)"></i></div>
            <div class="s">parcela ${t.parcelaN} de ${t.parcelaDe} · ${falta?'faltam '+brl(falta):'última parcela'}</div></div>
          <div class="val neg">−${brl(-t.valor,{noPrefix:true})}</div></button>`}).join('')}</div>
        <div class="sub" style="margin-top:var(--s2)">Ainda vão cair <b class="num" style="color:var(--ink)">${brl(parc.reduce((a,t)=>a+(t.parcelaDe-t.parcelaN)*-t.valor,0))}</b> destas compras nos próximos meses.</div>`
      :vazio({ic:'check',t:'Nenhuma compra parcelada',p:'Todas as compras desta fatura são à vista.'})
  };
  if(!vistas[faturaVista])faturaVista='categorias';

  el.innerHTML=`
  ${temCartao?S.cartoes.map(c=>{
    const r=cartaoResumo(c);
    const venc=`${String(c.vencimento).padStart(2,'0')}/${addMonthYM(ym,1).slice(5)}`;
    const corUso=r.uso>.8?'var(--bad)':r.uso>.5?'var(--warn)':'var(--good)';
    return `<div class="card cartao">
      <div class="row" style="align-items:flex-start">
        <div style="min-width:0"><div class="cnome"><i style="background:${esc(c.cor||'var(--c5)')}"></i>${esc(c.nome)}</div>
          <div class="num cval">${brl(r.atual)}</div>
          <div class="sub">fatura de ${ymShort(ym)} · vence ${venc}</div></div>
        <div class="btnrow" style="flex:none">
          <button class="btn ghost sm" data-fatura="${c.id}">Detalhes</button>
          <button class="iconbtn" data-edit-cartao="${c.id}" aria-label="Editar cartão ${esc(c.nome)}" title="Editar cartão">${svgIc('config',16)}</button>
        </div>
      </div>
      <div class="bar" style="height:6px;margin-top:var(--s3)" role="progressbar" aria-label="Limite usado" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${(r.uso*100).toFixed(0)}"><i style="width:${(r.uso*100).toFixed(1)}%;background:${corUso}"></i></div>
      <div class="row" style="font-size:var(--t-xs);margin-top:6px"><span class="muted">limite usado ${pct(r.uso,0)}</span><span class="muted num">disponível ${brl(r.disponivel)}</span></div>
    </div>`}).join('')
  :`<div class="card span2">${vazio({ic:'cartao',t:'Nenhum cartão cadastrado',
      p:'Cadastre o seu cartão (nome, limite, dia de fechamento e de vencimento) para importar faturas e acompanhar as parcelas futuras.',acao:'Cadastrar cartão',attrs:'data-novo-cartao'})}</div>`}
  ${temCartao?`<button class="addtile" data-novo-cartao><span class="vic" aria-hidden="true">${svgIc('cartao',22)}</span><span>+ Novo cartão</span></button>`:''}

  ${temCartao?`<div class="card span2" id="cardFaturaMes">
    <h3>Fatura de ${ymLabel(ym)} <span class="tag num">${txs.length} compra${txs.length===1?'':'s'} · ${brl(totMes)}</span></h3>
    ${txs.length?`<div class="seg" role="group" aria-label="Ver a fatura por" style="margin-bottom:var(--s3)">
        ${[['categorias','Categorias'],['lancamentos','Lançamentos'],['parcelas','Parcelas'+(parc.length?' ('+parc.length+')':'')]].map(([k,n])=>`<button data-fvista="${k}" aria-pressed="${faturaVista===k}">${n}</button>`).join('')}
      </div><div id="faturaCorpo">${vistas[faturaVista]()}</div>`
      :vazio({ic:'cartao',t:'Nenhuma compra no cartão em '+ymLabel(ym),p:'Importe o PDF ou a planilha da fatura logo abaixo.'})}
  </div>`:''}

  <div class="card">
    <h3>Próximas faturas <span class="tag num">${brl(totalFut)}</span></h3>
    ${mesesFut.length?barrasMeses(mesesFut.map(m=>({l:MES3[+m.slice(5)-1],v:futuro[m],t:brl(futuro[m])})),{alt:'Valor já comprometido nas próximas faturas',cor:'var(--warn)'})
      +`<div class="sub" style="margin-top:var(--s2)">Parcelas que já vão cair sozinhas. Investidos hoje, esses ${brl(totalFut)} virariam ${brl(custoOportunidade(totalFut).futuro)} em 10 anos.</div>`
      :vazio({ic:'check',t:'Nada comprometido',p:'Nenhuma parcela em aberto nos próximos meses.'})}
  </div>

  <details class="card importar" ${temCartao&&!txs.length?'open':''}>
    <summary><h3 style="margin:0">Importar fatura</h3><span class="sub">PDF, CSV, XLSX ou OFX</span></summary>
    <div style="margin-top:var(--s3)">
    ${temCartao?`<div class="grid2">
      <div class="fgroup"><label class="f" for="impCartao">Cartão</label>
        <select class="inp" id="impCartao">${S.cartoes.map(c=>`<option value="${c.id}">${esc(c.nome)}</option>`).join('')}</select></div>
      <div class="fgroup"><label class="f" for="impMes">Mês do ciclo</label>
        <input class="inp" type="month" id="impMes" value="${ym}"></div>
    </div>
    <div class="fgroup"><label class="f" for="impArq">Arquivo da fatura (.pdf .csv .xlsx .ofx .txt)</label>
      <input class="inp" type="file" id="impArq" accept=".csv,.xlsx,.xls,.txt,.ofx,.pdf"></div>
    <div class="fgroup"><label class="f" for="impTexto">Ou cole o conteúdo aqui</label>
      <textarea class="inp" id="impTexto" placeholder="29 JUL •••• 1234 Mercado*Mercadolivre - Parcela 2/10 R$ 369,99&#10;03 AGO Google Youtube R$ 7,99"></textarea></div>
    <button class="btn" id="btnImportar">Ler lançamentos</button>
    <div class="hint" style="margin-top:var(--s2)">O arquivo é lido aqui no navegador. Você confere tudo antes de gravar e as parcelas futuras são criadas sozinhas.</div>`
    :vazio({ic:'cartao',t:'Primeiro, o cartão',p:'A fatura precisa de um cartão para entrar.',acao:'Cadastrar cartão',attrs:'data-novo-cartao'})}
    </div>
  </details>

  <details class="acc span2"><summary>Como o app trata cartão de crédito</summary><div class="body">
    O gasto conta no <b>mês do ciclo</b> em que a compra entrou na fatura — não no mês em que você paga. É assim que o gasto aparece perto da decisão que o gerou.<br><br>
    Cada parcela vira um lançamento no mês em que ela vai cair. Por isso o app já sabe hoje o que você vai pagar em março, e desconta isso do seu teto de gastos daquele mês.
  </div></details>`;

  $$('[data-fatura]',el).forEach(b=>b.onclick=()=>abrirFatura(b.dataset.fatura));
  $$('[data-edit-cartao]',el).forEach(b=>b.onclick=()=>abrirCartao(b.dataset.editCartao));
  $$('[data-novo-cartao]',el).forEach(b=>b.onclick=()=>abrirCartao());
  $$('[data-fvista]',el).forEach(b=>b.onclick=()=>{faturaVista=b.dataset.fvista;renderFaturas();$(`[data-fvista="${faturaVista}"]`)?.focus()});
  $$('#faturaCorpo [data-tx]',el).forEach(b=>b.onclick=()=>abrirTx(b.dataset.tx));
  if($('#btnImportar')){
    $('#btnImportar').onclick=()=>importar();
    $('#impArq').onchange=e=>lerArquivo(e.target.files[0]);
  }
}

/* ---------- investir ---------- */
function renderInvestir(){
  const el=$('#v-investir'), F=fire(), P=S.premissas;
  const cls=porClasse(), tot=Object.values(cls).reduce((a,b)=>a+b,0);
  const reb=rebalancear(F.aporteMes);
  const dados=Object.entries(cls).filter(([,v])=>v>0).map(([n,v])=>({n,v}));

  const parecidos=ativosParecidos();
  el.innerHTML=`
  ${parecidos.length?`<div class="warnbox aviso span2" id="avisoParecidos"><div class="aic" aria-hidden="true">🧩</div><div class="acorpo">
    <b>${parecidos.length===1?'Encontrei 2 ativos que parecem o mesmo':'Encontrei '+parecidos.length+' pares de ativos que parecem o mesmo'}</b>
    (${parecidos.slice(0,3).map(([a,b])=>esc(a.ticker||a.nome)+' e '+esc(b.ticker||b.nome)).join('; ')}). Unir soma as quantidades e refaz o preço médio.
    <div><button class="btn sm" id="btnParecidos">Revisar e unir</button></div></div></div>`:''}
  ${cardAtivos()}
  ${cardAportes(S.ui.ym)}

  <div class="pilha">${cardEvolucao()}${cardProventos(F,P)}</div>

  <div class="card">
    <h3>Carteira por classe <span class="tag muted">${S.ativos.length} ativo${S.ativos.length===1?'':'s'}</span></h3>
    ${tot>0?`<div class="donutrow">
      ${donut(dados,{lab:'CARTEIRA',centro:brlK(tot),alt:'Carteira por classe de ativo'})}
      <div style="flex:1;min-width:0" class="legend col">
        ${dados.map((d,i)=>`<div style="width:100%"><i style="background:${COR[i%6]}"></i><span style="flex:1">${esc(d.n)}</span><b class="num" style="color:var(--ink)">${pct(d.v/tot,0)}</b></div>`).join('')}
      </div></div>
    <div class="hair"></div>
    <div class="sub" style="margin-bottom:var(--s3)">Atual × alvo <span class="muted">(o traço é o alvo)</span></div>
    <div class="alvos">${reb.linhas.filter(l=>l.valor>0||l.alvoP>0).map(l=>{const ci=Math.max(0,dados.findIndex(d=>d.n===l.classe));
      return `<div class="alvo"><div class="row"><span>${esc(l.classe)}</span><span class="num"><b>${pct(l.pAtual,0)}</b> <span class="muted">/ ${pct(l.alvoP,0)}</span></span></div>
      <div class="trk" role="img" aria-label="${esc(l.classe)}: ${pct(l.pAtual,0)} hoje, alvo ${pct(l.alvoP,0)}"><i style="width:${Math.min(100,l.pAtual*100).toFixed(1)}%;background:${l.valor>0?COR[ci%6]:'var(--line-strong)'}"></i><b style="left:${Math.min(100,l.alvoP*100).toFixed(1)}%"></b></div></div>`}).join('')}</div>
    <button class="btn ghost sm block" style="margin-top:var(--s4)" data-add-ativo>+ Adicionar ativo</button>`
    :vazio({ic:'carteira',t:'Carteira vazia',p:'Cadastre o que você já tem investido — ou importe um CSV ou os relatórios gerenciais — para o plano de liberdade ficar real.',acao:'+ Adicionar ativo',attrs:'data-add-ativo'})
      +`<div class="btnrow" style="justify-content:center"><button class="btn ghost sm" id="btnImpCsv">Importar CSV</button><button class="btn ghost sm" id="btnImpRel">Relatórios</button></div>`}
  </div>

  <div class="pilha">${cardRendaFixa()}${cardResultados()}</div>

  <div class="card">
    <h3>Onde aportar <span class="tag muted">rebalanceamento · ${pct(S.perfil.metaPoupanca,0)} da renda</span></h3>
    <div class="sub" style="margin-bottom:var(--s3)">Rebalanceamento por aporte: em vez de vender para acertar a carteira (o que gera IR e custo), o app manda o dinheiro novo para a classe mais atrasada. É o método que planejadores usam com quem ainda está acumulando.</div>
    <div class="tblwrap"><table>
      <caption class="sr-only">Sugestão de aporte por classe</caption>
      <thead><tr><th scope="col">Classe</th><th scope="col" class="tnum">Hoje</th><th scope="col" class="tnum">Alvo</th><th scope="col" class="tnum">Aportar</th></tr></thead>
      <tbody>${reb.linhas.map(l=>`<tr>
        <td>${esc(l.classe)}</td>
        <td class="tnum">${pct(l.pAtual,0)}</td>
        <td class="tnum muted">${pct(l.alvoP,0)}</td>
        <td class="tnum ${l.aportar>0?'pos':'zero'}" style="font-weight:600">${l.aportar>0?brl(l.aportar,{noPrefix:true}):'—'}</td>
      </tr>`).join('')}</tbody>
    </table></div>
    <div class="okbox" style="margin-top:var(--s3)">Desvio maior que <b>5 pontos percentuais</b> em qualquer classe é o gatilho clássico para rebalancear de verdade.
      ${reb.linhas.filter(l=>Math.abs(l.desvio)>.05&&tot>0).map(l=>`<br>• <b>${esc(l.classe)}</b> está ${l.desvio>0?'acima':'abaixo'} em ${pct(Math.abs(l.desvio),1)}`).join('')||'<br>Nenhuma classe fora da banda hoje.'}</div>
    <button class="btn ghost sm block" style="margin-top:var(--s3)" id="editAloc">Editar alocação alvo</button>
  </div>

  <div class="card">
    <h3>Simuladores</h3>
    <details class="acc" open><summary>Quanto preciso aportar por mês?</summary><div class="body">
      <div class="grid2">
        <div><label class="f" for="s1meta">Quero chegar a (R$)</label><input class="inp sim" id="s1meta" type="text" inputmode="decimal" value="${(F.numero/100).toFixed(0)}"></div>
        <div><label class="f" for="s1anos">Em quantos anos</label><input class="inp sim" id="s1anos" type="number" min="1" value="15"></div>
      </div>
      <div id="s1out" style="margin-top:var(--s3)" aria-live="polite"></div>
    </div></details>
    <details class="acc"><summary>Quanto vou ter em X anos?</summary><div class="body">
      <div class="grid2">
        <div><label class="f" for="s2ap">Aporte mensal (R$)</label><input class="inp sim" id="s2ap" type="text" inputmode="decimal" value="${(F.aporteMes/100).toFixed(0)}"></div>
        <div><label class="f" for="s2anos">Anos</label><input class="inp sim" id="s2anos" type="number" min="1" value="10"></div>
      </div>
      <div id="s2out" style="margin-top:var(--s3)" aria-live="polite"></div>
    </div></details>
    <details class="acc"><summary>O que um gasto custa de verdade</summary><div class="body">
      <label class="f" for="s3v">Valor do gasto (R$)</label><input class="inp sim" id="s3v" type="text" inputmode="decimal" value="500">
      <div id="s3out" style="margin-top:var(--s3)" aria-live="polite"></div>
    </div></details>
    <details class="acc"><summary>Poder de antecipar um aporte</summary><div class="body">
      <label class="f" for="s4v">Aporte extra único, hoje (R$)</label><input class="inp sim" id="s4v" type="text" inputmode="decimal" value="5000">
      <div id="s4out" style="margin-top:var(--s3)" aria-live="polite"></div>
    </div></details>
  </div>

  <div class="card">
    <h3>Premissas em uso</h3>
    <div class="grid2">
      <div class="stat"><div class="k">Retorno real</div><div class="v">${pct(P.retornoRealAA,1)} a.a.</div><div class="d">já descontada a inflação</div></div>
      <div class="stat"><div class="k">Taxa de retirada</div><div class="v">${pct(P.swr,2)} a.a.</div><div class="d">o quanto dá para sacar por ano</div></div>
    </div>
    <button class="btn ghost sm block" style="margin-top:var(--s3)" data-goto="config">Ajustar premissas</button>
  </div>`;

  $$('[data-add-ativo]',el).forEach(b=>b.onclick=()=>abrirAtivo());
  $('#btnParecidos')?.addEventListener('click',()=>abrirParecidos());
  $('#btnMovTodos')?.addEventListener('click',()=>abrirMovimentos());
  $('#btnMovNovo')?.addEventListener('click',()=>abrirMovimento());
  $('#editAloc').onclick=()=>abrirAlocacao();
  ligarCardAtivos(el);
  $$('.sim',el).forEach(i=>i.addEventListener('input',simular));
  simular();
}
function simular(){
  const F=fire(), r=F.r;
  const g=(id,def=0)=>{const e=$('#'+id);if(!e)return def;const v=parseMoney(e.value);return v};
  const n=(id,def=0)=>{const e=$('#'+id);if(!e)return def;const v=parseFloat(String(e.value).replace(',','.'));return isFinite(v)?v:def};
  if($('#s1out')){
    const meta=g('s1meta')*1, anos=n('s1anos',15), N=anos*12;
    const f=Math.pow(1+r,N);
    const pmt=r>0?Math.max(0,(meta-F.pv*f)*r/(f-1)):Math.max(0,(meta-F.pv)/N);
    const rendaNec=Math.round(pmt/Math.max(.01,S.perfil.metaPoupanca));
    $('#s1out').innerHTML=`<div class="stat"><div class="k">Aporte mensal necessário</div>
      <div class="v" style="font-size:var(--t-xl);color:var(--accent)">${brl(Math.round(pmt))}</div>
      <div class="d">partindo de ${brl(F.pv)} a ${pct(F.rAno,1)} reais ao ano · exige renda de ${brl(rendaNec)} guardando ${pct(S.perfil.metaPoupanca,0)}</div></div>`;
  }
  if($('#s2out')){
    const ap=g('s2ap'), anos=n('s2anos',10), N=anos*12;
    const val=Math.round(fv(F.pv,ap,r,N));
    const aportado=F.pv+ap*N, juros=val-aportado;
    $('#s2out').innerHTML=`<div class="grid2">
      <div class="stat"><div class="k">Patrimônio em ${anos} anos</div><div class="v pos">${brlK(val)}</div><div class="d num">${brl(val)}</div></div>
      <div class="stat"><div class="k">Só de juros</div><div class="v" style="color:var(--accent)">${brlK(juros)}</div><div class="d">${val>0?pct(juros/val,0):'—'} do total</div></div></div>
      <div class="sub" style="margin-top:9px">Renda passiva de ${brl(Math.round(val*S.premissas.swr/12))} por mês a ${pct(S.premissas.swr,0)} ao ano.</div>`;
  }
  if($('#s3out')){
    const v=g('s3v'), co=custoOportunidade(v);
    const horas=S.perfil.rendaLiquida>0?(v/(S.perfil.rendaLiquida/220)).toFixed(1).replace('.',','):null;
    $('#s3out').innerHTML=`<div class="sub">Gastar <b style="color:var(--ink)">${brl(v)}</b> hoje significa:</div>
      <div class="grid2" style="margin-top:9px">
        <div class="stat"><div class="k">Em 10 anos seriam</div><div class="v">${brl(co.futuro)}</div></div>
        <div class="stat"><div class="k">Adia sua liberdade</div><div class="v ${co.dias>0?'neg':''}">${co.dias>0?co.dias+' dia'+(co.dias>1?'s':''):'—'}</div></div>
      </div>${horas?`<div class="sub" style="margin-top:8px">Equivale a <b>${horas} horas</b> do seu trabalho.</div>`:''}`;
  }
  if($('#s4out')){
    const v=g('s4v');
    const m1=F.meses, m2=nper(F.pv+v,F.aporteMes,F.numero,r);
    const gan=isFinite(m1)&&isFinite(m2)?m1-m2:0;
    $('#s4out').innerHTML=`<div class="sub">Um aporte extra de <b style="color:var(--ink)">${brl(v)}</b> hoje antecipa sua liberdade em
      <b class="pos">${gan>0?mesesTexto(gan):'—'}</b>.</div>
      <div class="sub" style="margin-top:6px">No fim do plano esse valor sozinho terá virado ${brl(Math.round(fv(v,0,r,isFinite(m1)?m1:120)))}.</div>`;
  }
}

/* ---------- liberdade (plano completo) ---------- */
function renderLiberdade(){
  const el=$('#v-liberdade'), F=fire(), P=S.premissas;
  const anosProj=Math.min(30,Math.max(10,isFinite(F.meses)?Math.ceil(F.meses/12)+2:20));
  const serie=[],comp=[];
  for(let a=0;a<=anosProj;a++){
    const n=a*12, val=Math.round(fv(F.pv,F.aporteMes,F.r,n));
    serie.push({l:a===0?'hoje':new Date().getFullYear()+a+'',v:val});
    if(a>0&&a%Math.ceil(anosProj/10)===0){
      const aportado=F.pv+F.aporteMes*n;
      comp.push({l:''+(new Date().getFullYear()+a),a:aportado,b:Math.max(0,val-aportado)});
    }
  }
  const marcos=[
    {n:'Reserva de emergência',v:F.reserva,d:P.mesesReserva+' meses de essenciais — vem antes de tudo',feito:S.reservaAtual>=F.reserva},
    {n:'Barista FI',v:F.barista,d:'metade do número: um trabalho leve já sustenta o resto'},
    {n:'Lean FIRE',v:F.lean,d:'liberdade num padrão de vida enxuto (70% do número)'},
    {n:'Coast FIRE',v:F.coast,d:'daqui os juros sozinhos te levam até lá aos '+P.idadeCoast+' anos'},
    {n:'Número da liberdade',v:F.numero,d:'gastos pagos para sempre a '+pct(P.swr,0)+' a.a.'},
    {n:'Fat FIRE',v:F.fat,d:'liberdade com folga (150% do número)'},
  ].sort((a,b)=>a.v-b.v);
  let virada=Infinity;
  for(let n=1;n<=600;n++){ if(fv(F.pv,F.aporteMes,F.r,n)*F.r>F.aporteMes){virada=n;break} }
  const corte=S.ui.corte||0;
  const mesesCorte=nper(F.pv,F.aporteMes+corte,Math.round((F.despMes-corte/1)*12/P.swr),F.r);
  const ganhoCorte=isFinite(F.meses)&&isFinite(mesesCorte)?F.meses-mesesCorte:0;
  const [ni,nd]=brl(F.numero,{noPrefix:true}).split(',');

  el.innerHTML=`
  <div class="hero span2">
    <div class="lab">Número da liberdade</div>
    <div class="big"><span class="cur">R$</span>${ni}<span class="cents">,${nd}</span></div>
    <div class="note">Seus gastos de ${brl(F.despMes)}/mês (${S.perfil.despesaMediaManual>0?'média que você definiu':'média real dos seus lançamentos'}) × 12, divididos pela taxa de retirada de ${pct(P.swr,0)} ao ano. Com esse patrimônio, o rendimento paga a sua vida para sempre.</div>
    <div class="strip">
      <div><div class="k">Chegada</div><div class="v">${isFinite(F.meses)?dataAlvo(F.meses):'—'}</div></div>
      <div><div class="k">Faltam</div><div class="v">${mesesTexto(F.meses)}</div></div>
      <div><div class="k">Idade</div><div class="v">${isFinite(F.meses)?Math.floor(P.idadeAtual+F.meses/12)+' anos':'—'}</div></div>
    </div>
  </div>

  <div class="card">
    <h3>Evolução projetada</h3>
    <div class="chartwrap">${areaChart(serie,{meta:F.numero,alt:'Projeção do patrimônio até a meta'})}</div>
    <div class="sub" style="margin-top:8px">Aporte de ${brl(F.aporteMes)}/mês (${pct(S.perfil.metaPoupanca,0)} da renda) rendendo ${pct(P.retornoRealAA,1)} reais ao ano — retorno já descontada a inflação, então os valores são em dinheiro de hoje.</div>
    ${isFinite(virada)?`<div class="okbox" style="margin-top:10px"><b>Ponto de virada em ${mesesTexto(virada)}:</b> a partir daí os juros do mês superam o seu aporte — o dinheiro passa a trabalhar mais que você.</div>`:''}
  </div>

  <div class="card">
    <h3>De onde vem o patrimônio</h3>
    ${comp.length?barrasV(comp,{alt:'Aportado versus juros ao longo dos anos'}):vazio({ic:'investir',t:'Sem projeção ainda',p:'Informe a renda em Configurações para eu projetar os aportes.'})}
    <div class="legend"><div><i style="background:var(--c3)"></i>Dinheiro que você aportou</div><div><i style="background:var(--accent)"></i>Juros compostos</div></div>
  </div>

  <div class="card">
    <h3>Marcos no caminho</h3>
    <div class="list">${marcos.map(m=>{
      const p=clamp(F.pv/Math.max(1,m.v),0,1), done=m.feito||p>=1;
      return `<div class="item" style="align-items:flex-start">
        <div class="ic" aria-hidden="true" style="background:${done?'var(--good-soft)':'var(--sunken)'};color:${done?'var(--good)':'var(--ink-3)'}">${done?'✓':'◦'}</div>
        <div class="mid">
          <div class="row"><span class="t" style="white-space:normal">${esc(m.n)}${done?' <span class="sr-only">(concluído)</span>':''}</span><span class="num" style="font-size:var(--t-sm);font-weight:600">${brlK(m.v)}</span></div>
          <div class="s" style="white-space:normal">${esc(m.d)}</div>
          <div class="bar" style="height:5px;margin-top:6px"><i style="width:${(p*100).toFixed(1)}%;background:${done?'var(--good)':'var(--accent)'}"></i></div>
        </div></div>`}).join('')}
    </div>
  </div>

  <div class="card">
    <h3>E se eu cortar gastos?</h3>
    <div class="sub" style="margin-bottom:8px">Cortar gasto age em dobro: sobra mais para aportar <i>e</i> o número da liberdade diminui, porque sua vida custa menos.</div>
    <div class="row" style="margin-bottom:4px"><label class="sub" for="rgCorte">Corte mensal</label><b class="num">${brl(corte)}</b></div>
    <input type="range" id="rgCorte" min="0" max="200000" step="5000" value="${corte}" aria-valuetext="${brl(corte)} por mês">
    <div class="grid2" style="margin-top:8px">
      <div class="stat"><div class="k">Novo prazo</div><div class="v txt" style="font-size:var(--t-base)">${isFinite(mesesCorte)?mesesTexto(mesesCorte):'—'}</div></div>
      <div class="stat"><div class="k">Você antecipa</div><div class="v txt pos" style="font-size:var(--t-base)">${ganhoCorte>0?mesesTexto(ganhoCorte):'—'}</div></div>
    </div>
  </div>

  <details class="acc span2"><summary>Como este plano é calculado</summary><div class="body">
    <b>Número da liberdade</b> = despesa anual ÷ taxa segura de retirada (${pct(P.swr,0)}). A regra dos 4% vem do estudo Trinity (EUA); simulações brasileiras com carteira diversificada entre IPCA+ e bolsa internacional sustentam algo entre 3,5% e 4%. Ajuste nas premissas se quiser mais conservadorismo.<br><br>
    <b>Retorno real</b> de ${pct(P.retornoRealAA,1)} a.a. significa retorno acima da inflação — por isso todos os valores do plano são em poder de compra de hoje.<br><br>
    <b>Coast FIRE</b>: o valor que, deixado rendendo sem nenhum aporte novo, chega ao seu número na idade escolhida (${P.idadeCoast} anos).<br><br>
    <b>Sua taxa de ${pct(S.perfil.metaPoupanca,0)}</b> é agressiva no melhor sentido: a matemática da independência depende muito mais da taxa de poupança que da rentabilidade. Quem guarda 65% precisa de ~10 anos; quem guarda 15%, de ~40.
  </div></details>`;

  $('#rgCorte').addEventListener('input',e=>{S.ui.corte=+e.target.value;renderLiberdade();$('#rgCorte').focus()});
}

/* ---------- config ---------- */
function campoCfg(k,label,{money,pctn,pctSel,tipo,step,valor,ph,hint}={}){
  const id='cfg-'+k.replace(/\./g,'-');
  const attrs=`class="inp cfg" id="${id}" data-k="${k}" ${money?'data-money="1" inputmode="decimal"':''} ${pctn?'data-pctn="1" inputmode="decimal"':''} ${tipo?`type="${tipo}"`:''} ${step?`step="${step}" inputmode="decimal"`:''}`;
  return `<div class="fgroup"><label class="f" for="${id}">${label}</label>
    <input ${attrs} value="${esc(valor)}" ${ph?`placeholder="${esc(ph)}"`:''} ${hint?`aria-describedby="${id}-h"`:''}>
    ${hint?`<div class="hint" id="${id}-h">${hint}</div>`:''}</div>`;
}
function renderConfig(){
  const el=$('#v-config'), p=S.perfil, P=S.premissas;
  const mv=c=>c?(c/100).toLocaleString('pt-BR'):'';
  const pv=x=>(x*100).toLocaleString('pt-BR');
  el.innerHTML=`
  <div class="card">
    <h3>Você e sua renda</h3>
    <div class="grid2">
      ${campoCfg('perfil.rendaLiquida','Renda líquida mensal',{money:1,valor:mv(p.rendaLiquida),ph:'0,00'})}
      ${campoCfg('perfil.outrasRendas','Outras rendas',{money:1,valor:mv(p.outrasRendas),ph:'0,00'})}
      ${campoCfg('premissas.idadeAtual','Idade atual',{tipo:'number',valor:P.idadeAtual})}
      <div class="fgroup"><label class="f" for="cfg-perfil-metaPoupanca">Meta de poupança</label>
        <select class="inp cfg" id="cfg-perfil-metaPoupanca" data-k="perfil.metaPoupanca" data-pct="1">
          ${[.5,.55,.6,.65,.7,.75,.8].map(v=>`<option value="${v}" ${Math.abs(v-p.metaPoupanca)<.001?'selected':''}>${(v*100).toFixed(0)}% da renda</option>`).join('')}
        </select></div>
    </div>
    ${campoCfg('perfil.despesaMediaManual','Média de gastos mensais (opcional)',{money:1,valor:mv(p.despesaMediaManual),ph:'deixe vazio para calcular das faturas'})}
  </div>
  <div class="card">
    <h3>Dinheiro que você já tem</h3>
    <div class="grid2">
      ${campoCfg('reservaAtual','Reserva de emergência',{money:1,valor:mv(S.reservaAtual),ph:'0,00'})}
      ${campoCfg('saldoContas','Saldo em contas',{money:1,valor:mv(S.saldoContas),ph:'0,00'})}
    </div>
    <div class="sub">Os investimentos são cadastrados na aba Investir, ativo por ativo. A média de gastos manual, se preenchida, passa a ser a base do plano de liberdade — útil enquanto o histórico de faturas ainda é curto.</div>
  </div>
  <div class="card">
    <h3>Premissas do plano</h3>
    <div class="grid2">
      ${campoCfg('premissas.retornoRealAA','Retorno real ao ano (%)',{pctn:1,valor:pv(P.retornoRealAA)})}
      ${campoCfg('premissas.swr','Taxa de retirada (%)',{pctn:1,valor:pv(P.swr)})}
      ${campoCfg('premissas.dyCarteira','DY da carteira a.a. (%)',{pctn:1,valor:pv(P.dyCarteira)})}
      ${campoCfg('premissas.mesesReserva','Meses de reserva',{tipo:'number',valor:P.mesesReserva})}
      ${campoCfg('premissas.idadeCoast','Idade Coast FIRE',{tipo:'number',valor:P.idadeCoast})}
      ${campoCfg('premissas.cdiAA','CDI ao ano (%)',{pctn:1,valor:pv(P.cdiAA),hint:'Usado no rendimento da renda fixa'})}
      ${campoCfg('premissas.inflacaoAA','IPCA ao ano (%)',{pctn:1,valor:pv(P.inflacaoAA),hint:'Usado nos títulos IPCA+'})}
    </div>
    <div class="sub">Retorno <b>real</b> = acima da inflação. 6% reais ≈ IPCA+6, próximo do juro longo brasileiro. Taxa de retirada entre 3,5% e 4% é o consenso conservador.</div>
  </div>
  <div class="card">
    <h3>Preço teto</h3>
    <div class="grid2">
      ${campoCfg('premissas.taxaBazin','Bazin — ações (%)',{pctn:1,valor:pv(P.taxaBazin),hint:'DY mínimo: teto = DPA ÷ taxa'})}
      ${campoCfg('premissas.taxaFII','Bazin — FIIs (%)',{pctn:1,valor:pv(P.taxaFII),hint:'DY mínimo para fundos'})}
      ${campoCfg('premissas.gordonK','Gordon — retorno exigido (%)',{pctn:1,valor:pv(P.gordonK)})}
      ${campoCfg('premissas.gordonG','Gordon — crescimento (%)',{pctn:1,valor:pv(P.gordonG),hint:'Precisa ser menor que o retorno'})}
      ${campoCfg('premissas.pvpMax','P/VP máximo (FIIs)',{tipo:'number',step:'0.05',valor:P.pvpMax})}
      ${campoCfg('premissas.plAlvo','P/L justo (ações)',{tipo:'number',step:'0.5',valor:P.plAlvo})}
    </div>
    <div class="sub">Cada ativo mostra o preço teto por método e a <b>mediana</b> entre eles. Importe os relatórios gerenciais em Investir → Ativos → Relatórios para eu preencher DPA, VP e LPA.</div>
  </div>
  <div class="card">
    <h3>Cotações automáticas</h3>
    <div class="fgroup"><label class="f" for="cfgToken">Token da brapi.dev (grátis)</label>
      <input class="inp" id="cfgToken" type="password" autocomplete="off" value="${esc(getToken())}" placeholder="cole aqui o seu token" aria-describedby="cfgTokenH"></div>
    <div class="sub" id="cfgTokenH">As cotações vêm da brapi.dev, plano gratuito. PETR4, VALE3, ITUB4 e MGLU3 funcionam sem token; para os demais, crie uma conta grátis em brapi.dev, copie o token e cole acima. O token fica salvo só neste navegador e não entra no backup. O app atualiza sozinho ao abrir (se a última busca tiver mais de 1 hora) e pelo botão ↻ na aba Investir.</div>
  </div>
  <div class="card">
    <h3>Aparência</h3>
    <div class="fgroup"><label class="f" for="cfgTema">Tema</label>
      <select class="inp" id="cfgTema">${[['','Automático (segue o aparelho)'],['light','Claro'],['dark','Escuro'],['amoled','AMOLED — preto puro']].map(([v,n])=>`<option value="${v}" ${(S.ui.tema||'')===v?'selected':''}>${n}</option>`).join('')}</select></div>
    <div class="sub">O AMOLED usa preto absoluto: fica mais confortável à noite e economiza bateria em telas OLED.</div>
  </div>
  <div class="card" id="cardDados">
    <h3>Seus dados</h3>
    <div class="grid2">
      <button class="btn ghost sm" id="btnExport">Exportar backup</button>
      <button class="btn ghost sm" id="btnImportBk">Restaurar backup</button>
    </div>
    <label class="sr-only" for="arqBk">Arquivo de backup</label>
    <input type="file" id="arqBk" accept=".json,application/json" hidden>
    <div class="hair"></div>
    <button class="btn danger sm block" id="btnReset">Apagar tudo e recomeçar</button>
    <div class="sub" style="margin-top:8px">${S.ultimoBackupEm?'Último backup: <b>'+dataHora(S.ultimoBackupEm)+'</b>. ':'<b>Nenhum backup feito ainda.</b> '}Tudo fica salvo só neste navegador. Guarde os arquivos de backup fora do GitHub. A única coisa que sai daqui são os tickers, enviados à brapi.dev para buscar as cotações.</div>
  </div>`;

  $$('.cfg',el).forEach(i=>i.addEventListener('change',e=>{
    const path=e.target.dataset.k.split('.');
    let v;
    if(e.target.dataset.money)v=parseMoney(e.target.value);
    else if(e.target.dataset.pct)v=parseFloat(e.target.value);
    else if(e.target.dataset.pctn)v=(parseFloat(String(e.target.value).replace(',','.'))||0)/100;
    else v=parseFloat(e.target.value)||0;
    let o=S;while(path.length>1)o=o[path.shift()];
    o[path[0]]=v;salvar();toast('Atualizado');
    if(e.target.dataset.k==='perfil.metaPoupanca')$('#brandsub').textContent='meta '+Math.round(v*100)+'%';
  }));
  $('#cfgToken').addEventListener('change',e=>{
    setToken(e.target.value.trim());
    toast(e.target.value.trim()?'Token salvo — buscando cotações':'Token removido');
    if(e.target.value.trim()){S.cotacoesEm=null;atualizarCotacoes({silencioso:false})}
  });
  $('#cfgTema').onchange=e=>{S.ui.tema=e.target.value;salvar();aplicarTema(S.ui.tema);toast('Tema '+TEMA_ROTULO[S.ui.tema])};
  ligarBackup(el);
}
function abrirConfigRenda(){irPara('config');setTimeout(()=>$('#cfg-perfil-rendaLiquida')?.focus(),80)}

/* ---------- cards extras do Investir ---------- */
function cardEvolucao(){
  const h=(S.patrimonioHist||[]).filter(x=>x&&x.ym&&x.valor>=0).sort((a,b)=>a.ym.localeCompare(b.ym)).slice(-24);
  const ult=h[h.length-1], prim=h[0];
  return `<div class="card"><h3>Evolução do patrimônio ${h.length>1?`<span class="tag ${sinalCls(ult.valor-prim.valor)}">${brlS(ult.valor-prim.valor)} desde ${ymShort(prim.ym)}</span>`:''}</h3>
    ${h.length>1?areaChart(h.map(x=>({l:ymShort(x.ym),v:x.valor})),{alt:'Evolução mensal do patrimônio investido'})
      :`<div class="sub">Eu guardo um retrato do patrimônio investido a cada mês. O gráfico aparece a partir do 2º mês${ult?` — hoje: <b class="num" style="color:var(--ink)">${brl(ult.valor)}</b>`:''}.</div>`}
  </div>`;
}
function cardProventos(F,P){
  const itens=S.ativos.filter(a=>a.qtd>0&&a.dpa>0).map(a=>({n:a.ticker||a.nome,v:Math.round(a.qtd*a.dpa)})).sort((a,b)=>b.v-a.v);
  const ano=itens.reduce((s,x)=>s+x.v,0);
  return `<div class="card"><h3>Renda passiva</h3>
    <div class="grid2">
      <div class="stat"><div class="k">Proventos estimados</div><div class="v pos">${ano?brl(Math.round(ano/12)):'—'}</div><div class="d">${ano?'por mês · '+brl(ano)+'/ano pelo DPA':'informe o DPA ou importe relatórios'}</div></div>
      <div class="stat"><div class="k">Regra dos ${pct(P.swr,0)}</div><div class="v">${brl(F.rendaPassiva)}</div><div class="d">por mês, sem tocar no principal</div></div>
    </div>
    ${itens.length?`<div class="hair"></div><div class="sub" style="margin-bottom:var(--s2)">Quem paga mais por ano</div>${barrasH(itens.slice(0,6),{tot:ano})}`:''}
  </div>`;
}

/* ---------- fatura do mês agrupada por categoria ---------- */
function gruposPorCategoria(txs){
  const m={};
  for(const t of txs){(m[t.catId]=m[t.catId]||{cat:catById(t.catId),itens:[],total:0});m[t.catId].itens.push(t);m[t.catId].total+=-t.valor}
  return Object.values(m).sort((a,b)=>b.total-a.total).map(g=>({...g,itens:g.itens.sort((a,b)=>a.valor-b.valor)}));
}
function cardFaturaCategorias(ym){
  const txs=S.transacoes.filter(t=>t.cartaoId&&t.competencia===ym&&t.valor<0);
  if(!txs.length)return '';
  const gs=gruposPorCategoria(txs), tot=gs.reduce((a,g)=>a+g.total,0);
  return `<div class="card span2"><h3>Cartão em ${ymShort(ym)} por categoria <span class="tag num">${brl(tot)}</span></h3>
    <div class="empilhada" style="margin-bottom:var(--s3)" role="img" aria-label="Divisão da fatura por categoria">${gs.slice(0,6).map((g,i)=>`<i style="width:${(g.total/tot*100).toFixed(1)}%;background:${COR[i%6]}" title="${esc(g.cat.nome)}"></i>`).join('')}</div>
    ${gs.map((g,i)=>`<details class="grupo"><summary><i style="width:10px;height:10px;border-radius:3px;background:${COR[i%6]};flex:none"></i>
      <span class="gnome">${g.cat.ic} ${esc(g.cat.nome)}</span><span class="gqtd">${g.itens.length} · ${pct(g.total/tot,0)}</span><span class="gval">${brl(g.total)}</span></summary>
      <div class="gcorpo"><div class="list">${g.itens.map(itemTx).join('')}</div></div></details>`).join('')}
  </div>`;
}

/* ---------- aportes do mês (movimentações de investimento) ---------- */
function cardAportes(ym){
  const A=resumoAportes(ym);
  const serie=[];for(let i=5;i>=0;i--){const m=addMonthYM(ym,-i),r=resumoAportes(m);serie.push({l:MES3[+m.slice(5)-1],vals:[r.entradas,r.saidas]})}
  const temSerie=serie.some(x=>x.vals.some(v=>v>0));
  const recentes=[...A.ms].sort((a,b)=>b.data.localeCompare(a.data)).slice(0,5);
  return `<div class="card span2" id="cardAportes"><h3>Aportes de ${ymShort(ym)}
      <span class="btnrow" style="text-transform:none;letter-spacing:0"><button class="btn sm" id="btnMovNovo">+ Lançar</button><button class="btn ghost sm" id="btnMovTodos">Histórico</button></span></h3>
    <div class="grid4">
      <div class="stat"><div class="k">Compras e aplicações</div><div class="v pos">${brl(A.entradas)}</div></div>
      <div class="stat"><div class="k">Vendas e resgates</div><div class="v ${A.saidas?'neg':''}">${brl(A.saidas)}</div></div>
      <div class="stat"><div class="k">Aporte líquido</div><div class="v ${sinalCls(A.liquido)}">${brlS(A.liquido)}</div><div class="d">o que ficou investido</div></div>
      <div class="stat"><div class="k">Resultado das vendas</div><div class="v ${sinalCls(A.resultado)}">${A.resultado?brlS(A.resultado):'—'}</div><div class="d">venda − preço médio</div></div>
    </div>
    ${temSerie||recentes.length?`<div class="aportes-dois">
      <div>${temSerie?barrasGrupo(serie,[{n:'Entradas',cor:'var(--good)'},{n:'Saídas',cor:'var(--bad)'}],{alt:'Aportes e resgates nos últimos 6 meses'}):''}</div>
      <div>${recentes.length?`<div class="list">${recentes.map(itemMov).join('')}</div>`:'<div class="sub">Nenhuma movimentação neste mês.</div>'}</div>
    </div>`:`<div class="sub" style="margin-top:var(--s3)">Use <b>+ Lançar</b> (ou o botão <b>+</b> desta aba) para registrar compras e vendas. Mudar a quantidade de um ativo também vira registro.</div>`}
  </div>`;
}
