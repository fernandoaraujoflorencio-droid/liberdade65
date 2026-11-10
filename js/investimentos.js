/* =====================================================================
   LIBERDADE 65 — movimentações de investimento, aportes do mês,
   união de ativos parecidos e relatório da carteira em PDF.

   S.movimentos (campo novo, padrão []) — valores em centavos:
     {id, data:'AAAA-MM-DD', ativoId, ticker, nome, classe,
      tipo:'compra'|'venda'|'aplicacao'|'resgate',
      qtd, preco, taxas, valor, resultado, origem:'manual'|'ajuste'}
   ===================================================================== */
const TIPO_MOV={compra:'Compra',venda:'Venda',aplicacao:'Aplicação',resgate:'Resgate'};
const ehEntrada=t=>t==='compra'||t==='aplicacao';
const usaQtd=a=>!!(a&&(a.ticker||a.qtd>0));

function movimentos(){if(!Array.isArray(S.movimentos))S.movimentos=[];return S.movimentos}
function movsDoMes(ym){return movimentos().filter(m=>(m.data||'').slice(0,7)===ym)}
function resumoAportes(ym){
  const ms=movsDoMes(ym);
  const entradas=ms.filter(m=>ehEntrada(m.tipo)).reduce((s,m)=>s+m.valor,0);
  const saidas=ms.filter(m=>!ehEntrada(m.tipo)).reduce((s,m)=>s+m.valor,0);
  const resultado=ms.reduce((s,m)=>s+(m.resultado||0),0);
  return{entradas,saidas,liquido:entradas-saidas,resultado,n:ms.length,ms};
}

/* aplica a movimentação na posição do ativo e guarda o registro */
function registrarMovimento(a,{tipo,qtd=0,preco=0,taxas=0,valor=0,data=todayISO(),origem='manual'}){
  const m={id:uid(),data,ativoId:a.id,ticker:a.ticker||null,nome:a.nome,classe:a.classe,tipo,origem};
  if(tipo==='compra'){
    const q0=a.qtd||0, custo0=q0*(a.precoMedio||0);
    m.qtd=qtd;m.preco=preco;m.taxas=taxas;m.valor=Math.round(qtd*preco+taxas);
    a.qtd=Math.round((q0+qtd)*1e8)/1e8;
    a.precoMedio=Math.round((custo0+qtd*preco+taxas)/a.qtd);
    a.valor=a.cotacao>0?Math.round(a.qtd*a.cotacao):(a.valor||0)+m.valor;
  }else if(tipo==='venda'){
    const q=Math.min(qtd,a.qtd||0), pm=a.precoMedio||0;
    m.qtd=q;m.preco=preco;m.taxas=taxas;m.valor=Math.round(q*preco-taxas);
    m.resultado=pm?Math.round(q*(preco-pm)-taxas):0;
    a.qtd=Math.round(((a.qtd||0)-q)*1e8)/1e8;
    a.valor=a.cotacao>0?Math.round(a.qtd*a.cotacao):Math.max(0,(a.valor||0)-Math.round(q*(pm||preco)));
  }else if(tipo==='aplicacao'){
    m.valor=valor;
    a.investido=(a.investido||0)+valor;a.valor=(a.valor||0)+valor;
  }else{ /* resgate: baixa o custo na proporção do valor resgatado */
    const v=Math.min(valor,a.valor||valor), prop=a.valor>0?v/a.valor:1, custo=Math.round((a.investido||0)*prop);
    m.valor=v;m.resultado=a.investido?v-custo:0;
    a.investido=Math.max(0,(a.investido||0)-custo);a.valor=Math.max(0,(a.valor||0)-v);
  }
  movimentos().push(m);
  const zerou=usaQtd(a)?!(a.qtd>0):!(a.valor>0);
  if(zerou)S.ativos=S.ativos.filter(x=>x.id!==a.id);
  return{m,zerou};
}

/* ---------- folha: novo lançamento de investimento ---------- */
function abrirMovimento(ativoId,tipoInicial){
  const lista=S.ativos.map(a=>a.ticker||a.nome);
  const a0=ativoId?S.ativos.find(x=>x.id===ativoId):null;
  let lado=tipoInicial==='venda'||tipoInicial==='resgate'?'saida':'entrada';
  sheet(`<h2>Lançamento de investimento</h2>
  <div class="sh-sub">Compra, venda, aplicação ou resgate. A quantidade e o preço médio do ativo se ajustam sozinhos.</div>
  <div class="seg" role="group" aria-label="Tipo" style="margin-bottom:var(--s3)">
    <button id="mvEnt" aria-pressed="${lado==='entrada'}">Comprar / aplicar</button>
    <button id="mvSai" aria-pressed="${lado==='saida'}">Vender / resgatar</button>
  </div>
  <div class="grid2">
    <div class="fgroup"><label class="f" for="mvAtivo">Ativo (ticker ou nome)</label>
      <input class="inp" id="mvAtivo" list="mvLista" autocapitalize="characters" value="${esc(a0?(a0.ticker||a0.nome):'')}" placeholder="Ex.: GARE11, CDB Nubank">
      <datalist id="mvLista">${lista.map(x=>`<option value="${esc(x)}">`).join('')}</datalist></div>
    <div class="fgroup"><label class="f" for="mvData">Data</label><input class="inp" id="mvData" type="date" value="${todayISO()}"></div>
  </div>
  <div id="mvInfo" class="hint" style="margin:-4px 0 var(--s3)"></div>
  <div id="mvQtdBox" class="grid2">
    <div class="fgroup"><label class="f" for="mvQtd">Quantidade</label><input class="inp" id="mvQtd" inputmode="decimal" placeholder="0"></div>
    <div class="fgroup"><label class="f" for="mvPreco">Preço unitário (R$)</label><input class="inp" id="mvPreco" inputmode="decimal" placeholder="0,00"></div>
    <div class="fgroup"><label class="f" for="mvTaxas">Taxas (R$, opcional)</label><input class="inp" id="mvTaxas" inputmode="decimal" placeholder="0,00"></div>
    <div class="fgroup"><div class="f" style="font-size:var(--t-2xs);letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3);font-weight:750;margin-bottom:6px">Total</div><div class="num" id="mvTotal" style="font-size:var(--t-lg);font-weight:600;padding:9px 0">R$ 0,00</div></div>
  </div>
  <div id="mvValorBox" class="grid2" hidden>
    <div class="fgroup"><label class="f" for="mvValor">Valor (R$)</label><input class="inp" id="mvValor" inputmode="decimal" placeholder="0,00"></div>
  </div>
  <div id="mvClasseBox" class="fgroup" hidden><label class="f" for="mvClasse">Classe (ativo novo)</label>
    <select class="inp" id="mvClasse">${Object.keys(S.alocacaoAlvo).map(k=>`<option>${esc(k)}</option>`).join('')}</select></div>
  <label class="row" style="justify-content:flex-start;gap:var(--s2);margin-bottom:var(--s4);font-size:var(--t-sm)" id="mvOrcBox">
    <input type="checkbox" id="mvOrc" checked style="width:18px;height:18px;accent-color:var(--accent)"> Contar como aporte no orçamento do mês</label>
  <button class="btn" id="mvSalvar">Registrar</button>`);
  const achar=()=>{const v=$('#mvAtivo').value.trim(), t=limparTicker(v);
    return S.ativos.find(a=>a.ticker&&a.ticker===t)||S.ativos.find(a=>semAcento(a.nome)===semAcento(v))||null};
  const modoQtd=()=>{const a=achar();if(a)return usaQtd(a);const t=limparTicker($('#mvAtivo').value);return /^[A-Z]{4}\d{1,2}$/.test(t)};
  function pintar(){
    const a=achar(), q=modoQtd(), ent=lado==='entrada';
    $('#mvEnt').setAttribute('aria-pressed',String(ent));$('#mvSai').setAttribute('aria-pressed',String(!ent));
    $('#mvQtdBox').hidden=!q;$('#mvValorBox').hidden=q;
    $('#mvClasseBox').hidden=!!a||!$('#mvAtivo').value.trim();
    $('#mvOrcBox').hidden=!ent;
    if(!a&&$('#mvAtivo').value.trim()){$('#mvClasse').value=q?mapClasse('',limparTicker($('#mvAtivo').value)):'Renda fixa'}
    $('#mvInfo').innerHTML=a?(q?`Você tem <b>${fmtQtd(a.qtd)}</b> · preço médio ${a.precoMedio?brl(a.precoMedio):'—'}${a.cotacao?' · cotação '+brl(Math.round(a.cotacao)):''}`
      :`Saldo ${brl(a.valor)}${a.investido?' · investido '+brl(a.investido):''}`):($('#mvAtivo').value.trim()?'Ativo novo — será criado na carteira.':'');
    if(q&&a&&!$('#mvPreco').value&&a.cotacao)$('#mvPreco').placeholder=campoMoney(Math.round(a.cotacao));
    const tot=Math.round(parseQtd($('#mvQtd').value)*parseMoney($('#mvPreco').value)+(ent?1:-1)*parseMoney($('#mvTaxas').value));
    $('#mvTotal').textContent=brl(Math.max(0,tot));
    $('#mvSalvar').textContent=q?(ent?'Registrar compra':'Registrar venda'):(ent?'Registrar aplicação':'Registrar resgate');
  }
  pintar();
  $('#mvEnt').onclick=()=>{lado='entrada';pintar()};$('#mvSai').onclick=()=>{lado='saida';pintar()};
  ['mvAtivo','mvQtd','mvPreco','mvTaxas'].forEach(id=>$('#'+id).addEventListener('input',pintar));
  $('#mvSalvar').onclick=()=>{
    const nomeDig=$('#mvAtivo').value.trim();
    if(!nomeDig){toast('Informe o ativo');$('#mvAtivo').focus();return}
    const data=$('#mvData').value||todayISO();
    let a=achar();const q=modoQtd(), ent=lado==='entrada';
    const qtd=parseQtd($('#mvQtd').value), preco=parseMoney($('#mvPreco').value), taxas=parseMoney($('#mvTaxas').value), valor=parseMoney($('#mvValor').value);
    if(q&&!(qtd>0)){toast('Informe a quantidade');$('#mvQtd').focus();return}
    if(q&&!(preco>0)){toast('Informe o preço unitário');$('#mvPreco').focus();return}
    if(!q&&!(valor>0)){toast('Informe o valor');$('#mvValor').focus();return}
    if(!a&&!ent){toast('Esse ativo não está na carteira');return}
    if(a&&q&&!ent&&qtd>(a.qtd||0)+1e-9){toast('Você só tem '+Number(a.qtd||0).toLocaleString('pt-BR')+' para vender');$('#mvQtd').focus();return}
    if(!a){
      const t=limparTicker(nomeDig);
      a={id:uid(),nome:q?t:normDesc(nomeDig),valor:0,classe:$('#mvClasse').value};
      if(q){a.ticker=t;a.qtd=0}
      S.ativos.push(a);
    }
    const tipo=q?(ent?'compra':'venda'):(ent?'aplicacao':'resgate');
    const {m,zerou}=registrarMovimento(a,{tipo,qtd,preco,taxas,valor,data});
    if(ent&&$('#mvOrc').checked){
      S.transacoes.push({id:uid(),data,competencia:ymOf(data),desc:'Aporte '+(a.ticker||a.nome),valor:-m.valor,catId:'aporte',cartaoId:null,
        parcelaN:1,parcelaDe:1,origem:'investimento',grupo:null,movId:m.id});
    }
    if(typeof aplicarCotacoesRobo==='function')aplicarCotacoesRobo();
    salvar();fecharSheet();render();
    toast(TIPO_MOV[tipo]+' registrada: '+(a.ticker||a.nome)+' · '+brl(m.valor)+(zerou?' · posição zerada':''));
    if(q&&ent&&!a.cotacaoEm)atualizarCotacoes({silencioso:true});
  };
}

/* mudança de quantidade/valor investido feita direto no ativo vira registro */
function registrarAjuste(a,antes){
  const out=[];
  const ref=a.cotacao>0?Math.round(a.cotacao):(antes.precoMedio||a.precoMedio||0);
  const dq=Math.round(((a.qtd||0)-(antes.qtd||0))*1e8)/1e8;
  if(dq&&ref){
    const tipo=dq>0?'compra':'venda', q=Math.abs(dq);
    const m={id:uid(),data:todayISO(),ativoId:a.id,ticker:a.ticker||null,nome:a.nome,classe:a.classe,tipo,qtd:q,preco:ref,taxas:0,
      valor:Math.round(q*ref),origem:'ajuste'};
    if(tipo==='venda'&&antes.precoMedio)m.resultado=Math.round(q*(ref-antes.precoMedio));
    movimentos().push(m);out.push(m);
  }
  const di=(a.investido||0)-(antes.investido||0);
  if(!usaQtd(a)&&di){
    const m={id:uid(),data:todayISO(),ativoId:a.id,ticker:null,nome:a.nome,classe:a.classe,tipo:di>0?'aplicacao':'resgate',valor:Math.abs(di),origem:'ajuste'};
    movimentos().push(m);out.push(m);
  }
  return out;
}

/* ---------- lista de movimentações ---------- */
function itemMov(m){
  const ent=ehEntrada(m.tipo);
  return `<div class="item">
    <div class="ic" aria-hidden="true" style="background:${ent?'var(--good-soft)':'var(--bad-soft)'};color:${ent?'var(--good)':'var(--bad)'};font-weight:800">${ent?'+':'−'}</div>
    <div class="mid"><div class="t">${esc(TIPO_MOV[m.tipo])} · ${esc(m.ticker||m.nome)}</div>
      <div class="s">${dLabel(m.data)}${m.qtd?' · '+fmtQtd(m.qtd)+' × '+brl(m.preco,{real:true}):''}${m.origem==='ajuste'?' · ajuste':''}${m.resultado?` · resultado <span class="${sinalCls(m.resultado)}">${brlS(m.resultado)}</span>`:''}</div></div>
    <div class="val ${ent?'pos':'neg'}">${ent?'+':'−'}${brl(m.valor,{noPrefix:true})}</div>
  </div>`;
}
function abrirMovimentos(){
  const ms=[...movimentos()].sort((a,b)=>b.data.localeCompare(a.data));
  sheet(`<h2>Movimentações</h2><div class="sh-sub">${ms.length} registro${ms.length===1?'':'s'} de compras, vendas, aplicações e resgates</div>
  <div class="list">${ms.map(m=>`<div class="movrow">${itemMov(m)}<button class="btn ghost sm" data-delmov="${m.id}" aria-label="Apagar registro de ${esc(TIPO_MOV[m.tipo])} ${esc(m.ticker||m.nome)}">Apagar</button></div>`).join('')
    ||vazio({ic:'lista',t:'Nenhuma movimentação ainda',p:'Use o botão <b>+</b> na aba Investir para lançar compras e vendas.'})}</div>
  <div class="hint" style="margin-top:var(--s3)">Apagar um registro não muda a posição do ativo — só remove do histórico.</div>`);
  $$('[data-delmov]').forEach(b=>b.onclick=()=>{S.movimentos=movimentos().filter(x=>x.id!==b.dataset.delmov);salvar();render();abrirMovimentos();toast('Registro apagado')});
}

/* ---------- ativos parecidos (diferença mínima de digitação) ---------- */
function distancia(a,b){
  if(a===b)return 0;
  const d=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){let prev=d[0];d[0]=i;
    for(let j=1;j<=b.length;j++){const t=d[j];d[j]=Math.min(d[j]+1,d[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=t}}
  return d[b.length];
}
const chaveAtivo=a=>semAcento(a.ticker||a.nome).replace(/[^a-z0-9]/g,'');
function ativosParecidos(){
  const pares=[], at=S.ativos;
  for(let i=0;i<at.length;i++)for(let j=i+1;j<at.length;j++){
    const a=at[i],b=at[j];
    if(a.ticker&&b.ticker&&a.ticker!==b.ticker)continue;          /* tickers diferentes são ativos diferentes */
    const ka=chaveAtivo(a),kb=chaveAtivo(b), na=semAcento(a.nome).replace(/[^a-z0-9]/g,''), nb=semAcento(b.nome).replace(/[^a-z0-9]/g,'');
    if((ka.match(/\d+/g)||[]).join()!==(kb.match(/\d+/g)||[]).join()&&ka!==nb&&na!==kb)continue; /* CDB 100% ≠ CDB 120% */
    const lim=Math.min(ka.length,kb.length)>=8?2:1;
    if(ka===kb||ka===nb||na===kb||distancia(ka,kb)<=lim)pares.push([a,b]);
  }
  return pares;
}
function unirAtivos(alvo,outro){
  const qa=alvo.qtd||0,qb=outro.qtd||0;
  if(qa+qb>0){
    const custo=qa*(alvo.precoMedio||0)+qb*(outro.precoMedio||0);
    alvo.qtd=Math.round((qa+qb)*1e8)/1e8;
    if(custo>0)alvo.precoMedio=Math.round(custo/alvo.qtd);
  }
  if(!alvo.ticker&&outro.ticker)alvo.ticker=outro.ticker;
  alvo.investido=(alvo.investido||0)+(outro.investido||0)||undefined;if(!alvo.investido)delete alvo.investido;
  for(const k of['dpa','lpa','vpa','dpaFonte'])if(alvo[k]==null&&outro[k]!=null)alvo[k]=outro[k];
  if(outro.rendimentos)alvo.rendimentos={...outro.rendimentos,...(alvo.rendimentos||{})};
  if(outro.relatorios)alvo.relatorios=[...(outro.relatorios||[]),...(alvo.relatorios||[])].filter((x,i,arr)=>arr.findIndex(y=>y.ym===x.ym)===i);
  if(paraMs(outro.cotacaoEm)>(paraMs(alvo.cotacaoEm)||0)){for(const k of['cotacao','variacao','cotacaoEm','cotacaoFonte'])alvo[k]=outro[k]}
  alvo.valor=alvo.cotacao>0&&alvo.qtd>0?Math.round(alvo.qtd*alvo.cotacao):(alvo.valor||0)+(outro.valor||0);
  movimentos().forEach(m=>{if(m.ativoId===outro.id)m.ativoId=alvo.id});
  S.ativos=S.ativos.filter(x=>x.id!==outro.id);
}
function abrirParecidos(){
  const pares=ativosParecidos();
  const peso=a=>(a.ticker?4:0)+(a.qtd?2:0)+(a.precoMedio?1:0)+(a.relatorios?.length||0);
  sheet(`<h2>Ativos parecidos</h2><div class="sh-sub">Parecem o mesmo ativo digitado de jeitos diferentes. Unir soma quantidades e valores e refaz o preço médio.</div>
  ${pares.length?pares.map(([a,b],i)=>{const[al,ou]=peso(a)>=peso(b)?[a,b]:[b,a];
    return `<div class="card flat" style="padding:var(--s3) var(--s4);margin-bottom:var(--s3)">
      <div class="row" style="align-items:flex-start"><div class="sub"><b style="color:var(--ink)">${esc(al.nome)}</b>${al.ticker&&al.ticker!==al.nome?' ('+esc(al.ticker)+')':''} · ${brl(al.valor)}<br>
        <b style="color:var(--ink)">${esc(ou.nome)}</b>${ou.ticker&&ou.ticker!==ou.nome?' ('+esc(ou.ticker)+')':''} · ${brl(ou.valor)}</div>
      <button class="btn sm" data-unir="${i}">Unir em “${esc(al.ticker||al.nome)}”</button></div></div>`}).join('')
    :vazio({ic:'check',t:'Nenhum ativo duplicado',p:'Todos os ativos da carteira são diferentes.'})}`);
  $$('[data-unir]').forEach(btn=>btn.onclick=()=>{
    const[a,b]=pares[+btn.dataset.unir];const[al,ou]=peso(a)>=peso(b)?[a,b]:[b,a];
    unirAtivos(al,ou);salvar();render();toast('Unidos em '+(al.ticker||al.nome));abrirParecidos();
  });
}

/* ---------- relatório da carteira em PDF (imprimir → salvar como PDF) ---------- */
function gerarRelatorioCarteira(){
  const T=totaisCarteira(), A=resumoAportes(ymNow());
  /* só os ativos (sem reserva/saldo), para bater com o valor atual do topo */
  const cls={};Object.keys(S.alocacaoAlvo).forEach(k=>cls[k]=0);S.ativos.forEach(a=>{cls[a.classe]=(cls[a.classe]||0)+(a.valor||0)});
  const tot=Object.values(cls).reduce((a,b)=>a+b,0);
  const somaAlvo=Object.values(S.alocacaoAlvo).reduce((a,b)=>a+b,0)||100;
  const lista=[...S.ativos].sort((a,b)=>b.valor-a.valor);
  const qtdTxt=q=>q?fmtQtd(q):'—';
  const agora=new Date();
  const dados=Object.entries(cls).filter(([,v])=>v>0).map(([n,v])=>({n,v}));
  return `<header class="rp-cab"><div><div class="rp-marca">Liberdade 65</div><h1>Relatório da carteira</h1></div>
    <div class="rp-data">${agora.toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'})} · ${agora.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</div></header>
  <section class="rp-kpis">
    <div><span>Valor atual</span><b>${brl(T.total)}</b></div>
    <div><span>Valor investido</span><b>${T.investido!=null?brl(T.investido):'—'}</b></div>
    <div><span>Resultado</span><b class="${T.lucro!=null?sinalCls(T.lucro):''}">${T.lucro!=null?brlS(T.lucro)+' ('+pctS(T.lucroPct)+')':'—'}</b></div>
    <div><span>Aporte em ${MES[agora.getMonth()]}</span><b>${brlS(A.liquido)}</b></div>
  </section>
  <section class="rp-dois">
    <div>${tot>0?donut(dados,{lab:'CARTEIRA',centro:brlK(tot),alt:'Carteira por classe'}):''}</div>
    <table><thead><tr><th>Classe</th><th class="tnum">Valor</th><th class="tnum">Atual</th><th class="tnum">Alvo</th></tr></thead>
      <tbody>${Object.keys(cls).filter(k=>cls[k]>0||S.alocacaoAlvo[k]>0).map((k,i)=>`<tr><td><i class="rp-cor" style="background:${dados.findIndex(d=>d.n===k)>=0?COR[dados.findIndex(d=>d.n===k)%6]:'#C2CCC8'}"></i>${esc(k)}</td>
        <td class="tnum">${brl(cls[k])}</td><td class="tnum">${tot?pct(cls[k]/tot,1):'—'}</td><td class="tnum">${pct((S.alocacaoAlvo[k]||0)/somaAlvo,0)}</td></tr>`).join('')}</tbody></table>
  </section>
  <h2>Ativos (${lista.length})</h2>
  <table class="rp-ativos"><thead><tr><th>Ativo</th><th>Classe</th><th class="tnum">Qtd</th><th class="tnum">Preço médio</th><th class="tnum">Cotação</th><th class="tnum">Valor</th><th class="tnum">Resultado</th><th class="tnum">Peso</th><th class="tnum">Preço teto</th></tr></thead>
    <tbody>${lista.map(a=>{const m=metricasAtivo(a,T.total),mt=metodosTeto(a);
      return `<tr><td><b>${esc(a.ticker||a.nome)}</b>${a.ticker&&a.nome!==a.ticker?`<br><small>${esc(a.nome)}</small>`:''}</td><td>${esc(a.classe)}</td>
        <td class="tnum">${qtdTxt(a.qtd)}</td><td class="tnum">${a.precoMedio?brl(a.precoMedio):'—'}</td><td class="tnum">${m.preco?brl(Math.round(m.preco)):'—'}</td>
        <td class="tnum"><b>${brl(m.valor)}</b></td><td class="tnum ${m.lucro!=null?sinalCls(m.lucro):''}">${m.lucro!=null?brlS(m.lucro)+'<br><small>'+pctS(m.lucroPct)+'</small>':'—'}</td>
        <td class="tnum">${pct(m.peso,1)}</td><td class="tnum">${mt.mediana?brl(mt.mediana)+(mt.margem!=null?`<br><small class="${sinalCls(mt.margem)}">${pctS(mt.margem,1)}</small>`:''):'—'}</td></tr>`}).join('')}</tbody>
    <tfoot><tr><td colspan="5">Total</td><td class="tnum"><b>${brl(T.total)}</b></td><td class="tnum ${T.lucro!=null?sinalCls(T.lucro):''}">${T.lucro!=null?brlS(T.lucro):'—'}</td><td class="tnum">100%</td><td></td></tr></tfoot></table>
  ${A.n?`<h2>Movimentações de ${MES[agora.getMonth()]}</h2>
  <table><thead><tr><th>Data</th><th>Tipo</th><th>Ativo</th><th class="tnum">Qtd</th><th class="tnum">Preço</th><th class="tnum">Valor</th></tr></thead>
    <tbody>${[...A.ms].sort((a,b)=>a.data.localeCompare(b.data)).map(m=>`<tr><td>${dLabel(m.data)}</td><td>${TIPO_MOV[m.tipo]}</td><td>${esc(m.ticker||m.nome)}</td>
      <td class="tnum">${qtdTxt(m.qtd)}</td><td class="tnum">${m.preco?brl(m.preco):'—'}</td><td class="tnum ${ehEntrada(m.tipo)?'pos':'neg'}">${ehEntrada(m.tipo)?'+':'−'}${brl(m.valor,{noPrefix:true})}</td></tr>`).join('')}</tbody></table>`:''}
  <footer class="rp-rodape">Cotações: ${S.cotacoesEm?'última busca em '+dataHora(S.cotacoesEm):'preço salvo de cada ativo'}. Preço teto = mediana dos métodos (referência, não é recomendação de compra). Gerado no navegador — os dados não saem do seu computador.</footer>`;
}
function exportarCarteiraPDF(){
  if(!S.ativos.length){toast('Cadastre ativos para gerar o relatório');return}
  let r=$('#relatorioPdf');
  if(!r){r=document.createElement('div');r.id='relatorioPdf';r.setAttribute('aria-hidden','true');document.body.appendChild(r)}
  r.innerHTML=gerarRelatorioCarteira();
  const titulo=document.title;
  document.title='liberdade65-carteira-'+todayISO();
  document.body.classList.add('imprimindo');
  const fim=()=>{document.body.classList.remove('imprimindo');document.title=titulo;window.removeEventListener('afterprint',fim)};
  window.addEventListener('afterprint',fim);
  toast('Escolha “Salvar como PDF” na janela de impressão');
  setTimeout(()=>{try{window.print()}finally{setTimeout(fim,500)}},60);
}
