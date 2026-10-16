/* =====================================================================
   LIBERDADE 65 — telas: painel, lançar, faturas, investir, liberdade, config
   ===================================================================== */
const TITULOS={painel:'Painel',lancar:'Lançamentos',faturas:'Faturas',investir:'Investir',liberdade:'Liberdade',config:'Configurações'};

function renderPainel(){
  const ym=S.ui.ym, o=orcamento(ym), F=fire(), el=$('#v-painel');
  const cats=gastoPorCategoria(ym).slice(0,6);
  const totCat=cats.reduce((a,c)=>a+c.valor,0);
  const ins=insights(ym);
  const semRenda=o.renda<=0;
  const corDisp=o.disponivel<0?'var(--bad)':(o.disponivel<o.tetoGasto*.15?'var(--warn)':'var(--good)');
  const valorHero=o.ehMesAtual?Math.max(0,o.porDia):Math.max(0,o.disponivel);
  const [ints,dec]=brl(valorHero,{noPrefix:true}).split(',');
  const avisoBk=avisoBackupHTML();

  el.innerHTML=`
  ${avisoBk}
  ${semRenda?`<button class="card span2" id="cta-renda" style="text-align:left;width:100%;border-color:var(--accent);background:var(--accent-soft);cursor:pointer">
    <h3 style="color:var(--accent)">Comece por aqui <span class="tag">passo 1</span></h3>
    <div style="font-size:var(--t-base);font-weight:650;margin-bottom:4px">Quanto cai na sua conta por mês?</div>
    <div class="sub">Informe a renda líquida para eu calcular quanto você pode gastar guardando ${pct(S.perfil.metaPoupanca,0)}. Depois, importe a fatura do cartão na aba Faturas.</div>
  </button>`:''}

  <div class="hero span2">
    <div class="lab">${o.ehMesAtual?'Você pode gastar hoje':'Sobrou no mês'}</div>
    <div class="big"><span class="cur">R$</span>${ints}<span class="cents">,${dec}</span></div>
    <div class="note">${semRenda?'Informe sua renda para eu calcular este número.'
      :o.ehMesAtual?`${brl(o.disponivel)} disponíveis ÷ ${o.diasRestantes} dia${o.diasRestantes>1?'s':''} até o fim do mês, já reservando ${brl(o.metaValor)} para investir.`
      :`Teto do mês era ${brl(o.tetoGasto)} e você gastou ${brl(o.gasto)}.`}</div>
    <div class="strip">
      <div><div class="k">Guardar</div><div class="v pos">${brl(o.metaValor)}</div></div>
      <div><div class="k">Gasto</div><div class="v">${brl(o.gasto)}</div></div>
      <div><div class="k">Teto</div><div class="v" style="color:${corDisp}">${brl(o.tetoGasto)}</div></div>
    </div>
  </div>

  <div class="card">
    <h3>Regra dos ${pct(S.perfil.metaPoupanca,0)} <span class="tag ${o.taxa>=S.perfil.metaPoupanca?'pill ok':'pill warn'}">${o.taxa>=S.perfil.metaPoupanca?'no alvo':'abaixo'}</span></h3>
    <div class="donutrow">
      <div>${gauge(o.taxa,S.perfil.metaPoupanca)}</div>
      <div style="flex:1;min-width:0">
        <div class="sub" style="margin-bottom:9px">De cada R$ 100 que entram, você guardou <b style="color:var(--ink)">R$ ${(o.taxa*100).toFixed(0)}</b>.</div>
        <div class="track" role="img" aria-label="Consumo do teto de gastos: ${brl(o.gasto)} de ${brl(o.tetoGasto)}">
          <i style="width:${clamp(o.gasto/Math.max(1,o.tetoGasto),0,1)*100}%;background:${corDisp};opacity:.9"></i>
          ${o.ehMesAtual?`<b style="left:${clamp(o.diaHoje/o.dias,0,1)*100}%"></b>`:''}
        </div>
        <div class="row" style="margin-top:6px;font-size:var(--t-xs)">
          <span class="muted num">${brl(o.gasto)} de ${brl(o.tetoGasto)}</span>
          <span class="muted">${o.ehMesAtual?'ritmo ideal hoje: '+brl(o.ritmoIdeal):''}</span>
        </div>
      </div>
    </div>
    <div class="hair"></div>
    <div class="grid3">
      <div class="stat"><div class="k">Essencial</div><div class="v">${brlK(despesasPorTipo(ym,'essencial'))}</div><div class="d">contas que não param</div></div>
      <div class="stat"><div class="k">Variável</div><div class="v">${brlK(despesasPorTipo(ym,'variavel'))}</div><div class="d">onde o corte cabe</div></div>
      <div class="stat"><div class="k">Investido</div><div class="v pos">${brlK(o.aporte)}</div><div class="d">aportes do mês</div></div>
    </div>
  </div>

  ${ins.length?`<div class="card"><h3>O que eu olharia primeiro</h3><div class="list">
    ${ins.map(i=>`<div class="item" style="align-items:flex-start">
      <div class="ic" aria-hidden="true" style="background:var(--${i.t==='ok'?'good':i.t==='bad'?'bad':i.t==='warn'?'warn':'sunken'}-soft, var(--sunken))">${i.ic}</div>
      <div class="mid"><div class="t" style="white-space:normal">${esc(i.h)}</div><div class="s" style="white-space:normal;color:var(--ink-2);margin-top:2px">${esc(i.p)}</div></div>
    </div>`).join('')}</div></div>`:''}

  ${cats.length?`<div class="card"><h3>Para onde foi o dinheiro <span class="tag muted">${ymShort(ym)}</span></h3>
    <div class="donutrow" style="margin-bottom:4px">
      ${donut(cats.map(c=>({n:c.cat.nome,v:c.valor})),{lab:'GASTO',centro:brlK(totCat),alt:'Gastos por categoria'})}
      <div style="flex:1;min-width:0" class="legend col">
        ${cats.map((c,i)=>`<div><i style="background:${COR[i%6]}"></i><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.cat.nome)}</span><b class="num" style="color:var(--ink)">${pct(c.valor/totCat,0)}</b></div>`).join('')}
      </div>
    </div>
    <div class="hair"></div>
    ${barrasH(cats.map(c=>({n:c.cat.ic+'  '+c.cat.nome,v:c.valor})),{tot:totCat})}
  </div>`:`<div class="card">${vazio({ic:'lista',t:'Nenhum gasto em '+ymLabel(ym),
      p:'Lance um gasto pelo botão <b>+</b> ou importe a fatura do cartão para ver para onde vai o dinheiro.',acao:'Importar fatura',attrs:'data-goto="faturas"'})}</div>`}

  <div class="card">
    <h3>Rumo à liberdade</h3>
    <div class="row" style="align-items:flex-end;margin-bottom:9px">
      <div class="stat" style="border:0;background:none;padding:0">
        <div class="k">Patrimônio investido</div><div class="v" style="font-size:var(--t-xl)">${brl(F.pv)}</div></div>
      <div style="text-align:right"><div class="stat" style="border:0;background:none;padding:0"><div class="k">Número da liberdade</div>
        <div class="v" style="font-size:var(--t-base)">${brlK(F.numero)}</div></div></div>
    </div>
    <div class="bar" style="height:12px" role="progressbar" aria-label="Progresso até o número da liberdade" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${(F.progresso*100).toFixed(0)}"><i style="width:${(F.progresso*100).toFixed(2)}%;background:var(--accent)"></i></div>
    <div class="row" style="margin-top:7px">
      <span class="sub">${pct(F.progresso,1)} do caminho</span>
      <span class="sub">${F.numero>0&&isFinite(F.meses)?'faltam '+mesesTexto(F.meses):'defina renda e aporte'}</span>
    </div>
    <button class="btn ghost sm block" style="margin-top:var(--s3)" data-goto="liberdade">Ver o plano completo</button>
  </div>`;
  el.querySelector('#cta-renda')?.addEventListener('click',()=>abrirConfigRenda());
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

function renderFaturas(){
  const ym=S.ui.ym, el=$('#v-faturas');
  const futuro=comprometidoFuturo(addMonthYM(ym,1));
  const mesesFut=Object.keys(futuro).sort().slice(0,12);
  const totalFut=mesesFut.reduce((a,m)=>a+futuro[m],0);
  const maxFut=Math.max(...mesesFut.map(m=>futuro[m]),1);
  const temCartao=S.cartoes.length>0;

  el.innerHTML=`
  ${temCartao?S.cartoes.map(c=>{
    const r=cartaoResumo(c);
    const venc=`${String(c.vencimento).padStart(2,'0')}/${addMonthYM(ym,1).slice(5)}`;
    const corUso=r.uso>.8?'var(--bad)':r.uso>.5?'var(--warn)':'var(--good)';
    return `<div class="card">
      <h3><span style="display:flex;align-items:center;gap:8px"><i style="width:10px;height:10px;border-radius:3px;background:${esc(c.cor||'var(--c5)')}"></i>${esc(c.nome)}</span>
        <span class="tag muted">fecha dia ${c.fechamento} · vence dia ${c.vencimento}</span></h3>
      <div class="row" style="align-items:flex-end">
        <div class="stat" style="border:0;background:none;padding:0;min-width:0"><div class="k">Fatura de ${ymShort(ym)} · vence ${venc}</div>
          <div class="v" style="font-size:var(--t-2xl)">${brl(r.atual)}</div></div>
        <div class="btnrow" style="flex:none">
          <button class="btn ghost sm" data-edit-cartao="${c.id}" aria-label="Editar cartão ${esc(c.nome)}">Editar</button>
          <button class="btn ghost sm" data-fatura="${c.id}">Detalhes</button>
        </div>
      </div>
      <div class="hair"></div>
      <div class="row" style="font-size:var(--t-xs);margin-bottom:6px">
        <span class="muted">Limite usado</span><span class="num" style="font-weight:600">${brl(r.emAberto)} de ${brl(c.limite)}</span>
      </div>
      <div class="bar" style="height:10px" role="progressbar" aria-label="Limite usado" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${(r.uso*100).toFixed(0)}"><i style="width:${(r.uso*100).toFixed(1)}%;background:${corUso}"></i></div>
      <div class="grid3" style="margin-top:var(--s3)">
        <div class="stat"><div class="k">Disponível</div><div class="v" style="font-size:var(--t-base)">${brlK(r.disponivel)}</div></div>
        <div class="stat"><div class="k">Parcelas futuras</div><div class="v" style="font-size:var(--t-base);color:var(--warn)">${brlK(r.futuro)}</div></div>
        <div class="stat"><div class="k">Em aberto</div><div class="v" style="font-size:var(--t-base)">${brlK(r.emAberto)}</div></div>
      </div>
    </div>`}).join('')
  :`<div class="card span2">${vazio({ic:'cartao',t:'Nenhum cartão cadastrado',
      p:'Cadastre o seu cartão (nome, limite, dia de fechamento e de vencimento) para importar faturas e acompanhar as parcelas futuras.',acao:'Cadastrar cartão',attrs:'data-novo-cartao'})}</div>`}
  ${temCartao?`<button class="addtile" data-novo-cartao><span class="vic" aria-hidden="true">${svgIc('cartao',22)}</span><span>+ Novo cartão</span></button>`:''}

  <div class="card">
    <h3>Compromissos já assumidos <span class="tag num">${brl(totalFut)}</span></h3>
    <div class="sub" style="margin-bottom:var(--s3)">Parcelas que vão cair sozinhas nas próximas faturas. Esse dinheiro já saiu da sua liberdade — ele só ainda não saiu da conta.</div>
    ${mesesFut.length?mesesFut.map(m=>`
      <div style="padding:6px 0">
        <div class="row" style="font-size:var(--t-sm);margin-bottom:4px"><span style="font-weight:650">${ymShort(m)}</span><span class="num">${brl(futuro[m])}</span></div>
        <div class="bar" style="height:7px"><i style="width:${(futuro[m]/maxFut*100).toFixed(1)}%;background:var(--warn)"></i></div>
      </div>`).join(''):vazio({ic:'check',t:'Nenhuma parcela em aberto',p:'Excelente: nada comprometido nos próximos meses.'})}
    ${totalFut>0?`<div class="warnbox" style="margin-top:var(--s3)"><b>Custo real do parcelamento:</b> esses ${brl(totalFut)} deixariam de virar ${brl(custoOportunidade(totalFut).futuro)} em 10 anos se estivessem investidos hoje.</div>`:''}
  </div>

  <div class="card">
    <h3>Importar fatura</h3>
    ${temCartao?`<div class="sub" style="margin-bottom:var(--s3)">Aceito o <b>CSV/XLSX</b> que o Nubank exporta, o <b>texto do PDF</b> da fatura ou qualquer lista com data, descrição e valor. As parcelas futuras são criadas sozinhas.</div>
    <div class="grid2">
      <div class="fgroup"><label class="f" for="impCartao">Cartão</label>
        <select class="inp" id="impCartao">${S.cartoes.map(c=>`<option value="${c.id}">${esc(c.nome)}</option>`).join('')}</select></div>
      <div class="fgroup"><label class="f" for="impMes">Mês do ciclo</label>
        <input class="inp" type="month" id="impMes" value="${ym}"></div>
    </div>
    <div class="fgroup"><label class="f" for="impArq">Arquivo (.csv .xlsx .txt .ofx)</label>
      <input class="inp" type="file" id="impArq" accept=".csv,.xlsx,.xls,.txt,.ofx,.pdf"></div>
    <div class="fgroup"><label class="f" for="impTexto">Ou cole o conteúdo aqui</label>
      <textarea class="inp" id="impTexto" placeholder="29 JUL •••• 1234 Mercado*Mercadolivre - Parcela 2/10 R$ 369,99&#10;03 AGO Google Youtube R$ 7,99"></textarea></div>
    <button class="btn" id="btnImportar">Ler lançamentos</button>`
    :vazio({ic:'cartao',t:'Primeiro, o cartão',p:'A fatura precisa de um cartão para entrar. Cadastre o cartão e volte aqui.',acao:'Cadastrar cartão',attrs:'data-novo-cartao'})}
  </div>

  <details class="acc span2"><summary>Como o app trata cartão de crédito</summary><div class="body">
    O gasto conta no <b>mês do ciclo</b> em que a compra entrou na fatura — não no mês em que você paga. É assim que o gasto aparece perto da decisão que o gerou.<br><br>
    Cada parcela vira um lançamento no mês em que ela vai cair. Por isso o app já sabe hoje o que você vai pagar em março, e desconta isso do seu teto de gastos daquele mês.
  </div></details>`;

  $$('[data-fatura]',el).forEach(b=>b.onclick=()=>abrirFatura(b.dataset.fatura));
  $$('[data-edit-cartao]',el).forEach(b=>b.onclick=()=>abrirCartao(b.dataset.editCartao));
  $$('[data-novo-cartao]',el).forEach(b=>b.onclick=()=>abrirCartao());
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

  el.innerHTML=`
  ${cardAtivos()}

  <div class="card">
    <h3>Carteira por classe <span class="tag muted">${S.ativos.length} ativo${S.ativos.length===1?'':'s'}</span></h3>
    ${tot>0?`<div class="donutrow">
      ${donut(dados,{lab:'CARTEIRA',centro:brlK(tot),alt:'Carteira por classe de ativo'})}
      <div style="flex:1;min-width:0" class="legend col">
        ${dados.map((d,i)=>`<div style="width:100%"><i style="background:${COR[i%6]}"></i><span style="flex:1">${esc(d.n)}</span><b class="num" style="color:var(--ink)">${pct(d.v/tot,0)}</b></div>`).join('')}
      </div></div>`
    :vazio({ic:'carteira',t:'Carteira vazia',p:'Cadastre o que você já tem investido — ou importe um CSV — para o plano de liberdade ficar real.',acao:'+ Adicionar ativo',attrs:'data-add-ativo'})}
    <div class="hair"></div>
    <div class="grid2">
      <div class="stat"><div class="k">Renda passiva ${pct(P.swr,0)} a.a.</div><div class="v pos">${brl(F.rendaPassiva)}</div><div class="d">por mês, sem tocar no principal</div></div>
      <div class="stat"><div class="k">Se viver de dividendos</div><div class="v">${brl(F.rendaPassivaDY)}</div><div class="d">a ${pct(P.dyCarteira,1)} de DY ao ano</div></div>
    </div>
    ${tot>0?`<button class="btn ghost sm block" style="margin-top:var(--s3)" data-add-ativo>+ Adicionar ativo</button>`:''}
  </div>

  <div class="card">
    <h3>Aporte do mês <span class="tag muted">${pct(S.perfil.metaPoupanca,0)} da renda</span></h3>
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
function campoCfg(k,label,{money,pctn,pctSel,tipo,valor,ph,hint}={}){
  const id='cfg-'+k.replace(/\./g,'-');
  const attrs=`class="inp cfg" id="${id}" data-k="${k}" ${money?'data-money="1" inputmode="decimal"':''} ${pctn?'data-pctn="1" inputmode="decimal"':''} ${tipo?`type="${tipo}"`:''}`;
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
      ${typeof P.taxaBazin==='number'?campoCfg('premissas.taxaBazin','Taxa mínima Bazin (%)',{pctn:1,valor:pv(P.taxaBazin),hint:'Preço teto = DPA ÷ esta taxa'}):''}
    </div>
    <div class="sub">Retorno <b>real</b> = acima da inflação. 6% reais ≈ IPCA+6, próximo do juro longo brasileiro. Taxa de retirada entre 3,5% e 4% é o consenso conservador.</div>
  </div>
  <div class="card">
    <h3>Cotações automáticas</h3>
    <div class="fgroup"><label class="f" for="cfgToken">Token da brapi.dev (grátis)</label>
      <input class="inp" id="cfgToken" type="password" autocomplete="off" value="${esc(getToken())}" placeholder="cole aqui o seu token" aria-describedby="cfgTokenH"></div>
    <div class="sub" id="cfgTokenH">As cotações vêm da brapi.dev, plano gratuito. PETR4, VALE3, ITUB4 e MGLU3 funcionam sem token; para os demais, crie uma conta grátis em brapi.dev, copie o token e cole acima. O token fica salvo só neste navegador e não entra no backup. O app atualiza sozinho ao abrir (se a última busca tiver mais de 1 hora) e pelo botão ↻ na aba Investir.</div>
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
  ligarBackup(el);
}
function abrirConfigRenda(){irPara('config');setTimeout(()=>$('#cfg-perfil-rendaLiquida')?.focus(),80)}
