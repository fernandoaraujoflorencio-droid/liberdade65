/* =====================================================================
   LIBERDADE 65 — carteira: classes, rebalanceamento, ativos, cotações,
   preço teto (Bazin / Graham) e importação de CSV.

   Campos de um ativo (todos os valores em centavos):
     id, nome, valor, classe                      (já existiam)
     ticker, qtd, cotacao, variacao, cotacaoEm    (já existiam)
     precoMedio, investido, dpa, lpa, vpa,
     cotacaoFonte                                 (novos, opcionais)
   ===================================================================== */
function porClasse(){
  const m={};
  Object.keys(S.alocacaoAlvo).forEach(k=>m[k]=0);
  S.ativos.forEach(a=>{m[a.classe]=(m[a.classe]||0)+a.valor});
  if(S.reservaAtual>0)m['Renda fixa']=(m['Renda fixa']||0)+S.reservaAtual;
  return m;
}
function rebalancear(aporte){
  const atual=porClasse(), tot=Object.values(atual).reduce((a,b)=>a+b,0);
  const somaAlvo=Object.values(S.alocacaoAlvo).reduce((a,b)=>a+b,0)||100;
  const futuro=tot+aporte;
  const linhas=Object.keys(S.alocacaoAlvo).map(k=>{
    const alvoP=S.alocacaoAlvo[k]/somaAlvo;
    const v=atual[k]||0;
    const pAtual=tot>0?v/tot:0;
    const ideal=futuro*alvoP;
    return{classe:k,valor:v,pAtual,alvoP,falta:Math.max(0,ideal-v),desvio:pAtual-alvoP};
  });
  const somaFalta=linhas.reduce((a,l)=>a+l.falta,0);
  linhas.forEach(l=>l.aportar=somaFalta>0?Math.round(aporte*l.falta/somaFalta):Math.round(aporte*l.alvoP));
  return{linhas,tot};
}

/* ---------- métricas por ativo e da carteira ---------- */
function metricasAtivo(a,totalCarteira){
  const valor=a.valor||0;
  let investido=null;
  if(a.qtd>0&&a.precoMedio>0)investido=Math.round(a.qtd*a.precoMedio);
  else if(a.investido>0)investido=a.investido;
  const lucro=investido!==null?valor-investido:null;
  const lucroPct=investido>0?lucro/investido:null;
  const temDia=a.cotacao>0&&isFinite(a.variacao);
  const varDiaPct=temDia?a.variacao/100:null;               /* variacao é guardada em % (ex.: 1,23) */
  const varDia=temDia?Math.round(valor-valor/(1+a.variacao/100)):null;
  const peso=totalCarteira>0?valor/totalCarteira:0;
  const preco=a.cotacao>0?a.cotacao:null;
  const taxa=S.premissas.taxaBazin>0?S.premissas.taxaBazin:.06;
  const bazin=a.dpa>0?Math.round(a.dpa/taxa):null;
  const graham=a.lpa>0&&a.vpa>0?Math.round(Math.sqrt(22.5*(a.lpa/100)*(a.vpa/100))*100):null;
  const margem=t=>t&&preco?(t-preco)/t:null;
  return{valor,investido,lucro,lucroPct,varDia,varDiaPct,peso,preco,bazin,graham,
    margemBazin:margem(bazin),margemGraham:margem(graham),dy:a.dpa>0&&preco?a.dpa/preco:null};
}
function totaisCarteira(){
  const total=S.ativos.reduce((s,a)=>s+(a.valor||0),0);
  let investido=0,valorComCusto=0,varDia=0,valorComDia=0,nCusto=0;
  for(const a of S.ativos){
    const m=metricasAtivo(a,total);
    if(m.investido!==null){investido+=m.investido;valorComCusto+=m.valor;nCusto++}
    if(m.varDia!==null){varDia+=m.varDia;valorComDia+=m.valor}
  }
  const lucro=nCusto?valorComCusto-investido:null;
  return{total,investido:nCusto?investido:null,lucro,lucroPct:investido>0?lucro/investido:null,
    varDia:valorComDia?varDia:null,varDiaPct:valorComDia?varDia/(valorComDia-varDia):null,nCusto};
}
function seloTeto(nome,teto,preco){
  if(!teto||!preco)return '';
  const abaixo=preco<=teto;
  return `<span class="selo ${abaixo?'ok':'bad'}">${nome}: ${abaixo?'abaixo do teto':'acima do teto'}</span>`;
}
const FONTE_NOME={brapi:'brapi.dev',robo:'robô do GitHub'};

/* ---------- cotações automáticas (brapi.dev, plano gratuito) ---------- */
const TOKEN_KEY='liberdade65_brapi_token';
const getToken=()=>{try{return localStorage.getItem(TOKEN_KEY)||''}catch(e){return ''}};
const setToken=t=>{try{t?localStorage.setItem(TOKEN_KEY,t):localStorage.removeItem(TOKEN_KEY)}catch(e){}};
let cotRodando=false;
async function buscarCotacao(t,token){
  const tentativas=[];
  /* v1: token na URL (sem preflight) */
  tentativas.push(()=>fetch('https://brapi.dev/api/quote/'+encodeURIComponent(t)+(token?'?token='+encodeURIComponent(token):'')));
  /* v2: token no cabeçalho */
  tentativas.push(()=>fetch('https://brapi.dev/api/v2/stocks/quote?symbols='+encodeURIComponent(t),token?{headers:{Authorization:'Bearer '+token}}:{}));
  let ultimoErro='dados';
  for(const tent of tentativas){
    try{
      const r=await tent();
      if(!r.ok){ultimoErro=r.status===401||r.status===403?'token':(r.status===404?'ticker':'http');continue}
      const j=await r.json();
      const it=(j.results||[])[0];if(!it){ultimoErro='ticker';continue}
      const d=it.data||it;
      const preco=+d.regularMarketPrice;
      if(!isFinite(preco)||preco<=0){ultimoErro='dados';continue}
      return{preco,variacao:+d.regularMarketChangePercent||0,quando:d.regularMarketTime||new Date().toISOString()};
    }catch(e){if(ultimoErro!=='token')ultimoErro='rede'}
  }
  throw new Error(ultimoErro);
}
/* aplica uma cotação ao ativo só se ela for MAIS RECENTE que a que ele já tem */
function aplicarCotacao(a,q){
  const novo=paraMs(q.quando), atual=paraMs(a.cotacaoEm);
  if(!(q.preco>0)||isNaN(novo))return false;
  if(a.cotacao>0&&!isNaN(atual)&&atual>novo)return false;
  a.cotacao=Math.round(q.preco*10000)/100;
  a.variacao=isFinite(q.variacao)?q.variacao:0;
  a.cotacaoEm=new Date(novo).toISOString();
  a.cotacaoFonte=q.fonte;
  if(a.qtd>0)a.valor=Math.round(a.qtd*a.cotacao);
  return true;
}
const MSG_ERRO_COT={
  rede:'A brapi.dev não respondeu — sem internet ou o navegador bloqueou a chamada (comum ao abrir o arquivo pelo computador).',
  token:'A brapi.dev recusou a busca: falta o token grátis ou ele está inválido. Cadastre em Configurações.',
  ticker:'A brapi.dev não encontrou alguns tickers. Confira se estão escritos como na B3 (ex.: PETR4, MXRF11).',
  http:'A brapi.dev está com instabilidade agora. Tente de novo mais tarde.',
  dados:'A brapi.dev respondeu sem preço para alguns ativos.'
};
async function atualizarCotacoes(opt={}){
  if(cotRodando)return;
  const alvos=S.ativos.filter(a=>a.ticker&&a.qtd>0);
  if(!alvos.length){if(!opt.silencioso)toast('Cadastre ticker e quantidade nos ativos');return}
  cotRodando=true;
  const btn=$('#btnCot');if(btn){btn.disabled=true;btn.textContent='Atualizando…'}
  const token=getToken();
  const tickers=[...new Set(alvos.map(a=>a.ticker))];
  let ok=0;const falhas=[];const tipos=new Set();
  for(const t of tickers){
    try{
      const q=await buscarCotacao(t,token);
      S.ativos.filter(a=>a.ticker===t).forEach(a=>aplicarCotacao(a,{...q,fonte:'brapi'}));
      ok++;
    }catch(e){falhas.push(t);tipos.add(e.message)}
  }
  if(ok)S.cotacoesEm=new Date().toISOString();
  S.cotacoesFalhas=falhas;
  const tipo=['token','rede','ticker','http','dados'].find(k=>tipos.has(k));
  S.cotacoesErro=falhas.length?{tipo,em:new Date().toISOString()}:null;
  salvar();cotRodando=false;
  if(S.ui.tab==='investir'||S.ui.tab==='painel'||S.ui.tab==='liberdade')render();
  if(!opt.silencioso){
    if(!falhas.length)toast(ok+' cotaç'+(ok===1?'ão atualizada':'ões atualizadas'));
    else if(!ok)toast('Não consegui atualizar — mantive o último preço salvo');
    else toast('Atualizadas: '+ok+' · mantive o último preço de: '+falhas.join(', '));
  }
}
function cotacoesVelhas(){
  if(!S.cotacoesEm)return true;
  return Date.now()-new Date(S.cotacoesEm).getTime()>60*60*1000; /* mais de 1 hora */
}

/* ---------- plano B: cotacoes.js gerado pelo robô do GitHub ----------
   index.html carrega <script src="cotacoes.js">; se o arquivo não existir,
   window.COTACOES fica indefinido e nada quebra. */
function cotacoesRobo(){
  const C=window.COTACOES;
  return C&&typeof C==='object'&&C.ativos&&typeof C.ativos==='object'?C:null;
}
function aplicarCotacoesRobo(){
  const C=cotacoesRobo(); if(!C)return 0;
  let n=0;
  for(const a of S.ativos){
    if(!a.ticker)continue;
    const q=C.ativos[a.ticker]; if(!q)continue;
    if(aplicarCotacao(a,{preco:+q.preco,variacao:+q.variacao,quando:q.data||C.atualizado_em,fonte:'robo'}))n++;
  }
  return n;
}
function resumoRobo(){
  const C=cotacoesRobo();
  if(!C)return S.ativos.some(a=>a.ticker)?'<br><span class="fonte">Robô do GitHub: arquivo cotacoes.js ainda não encontrado.</span>':'';
  const n=Object.keys(C.ativos).length;
  if(!n)return '<br><span class="fonte">Robô do GitHub: ainda sem cotações — ele preenche o cotacoes.js na primeira execução.</span>';
  return `<br><span class="fonte">Robô do GitHub: ${n} cotaç${n===1?'ão':'ões'} de ${dataHora(C.atualizado_em)}. Uso sempre a mais recente.</span>`;
}

/* ---------- card de ativos ---------- */
function cardAtivos(){
  if(!S.ativos.length)return '';
  const T=totaisCarteira();
  const n=S.ativos.filter(a=>a.ticker&&a.qtd>0).length;
  const falhas=(S.cotacoesFalhas||[]).filter(t=>S.ativos.some(a=>a.ticker===t));
  const erro=S.cotacoesErro&&falhas.length?S.cotacoesErro:null;
  const lista=[...S.ativos].sort((a,b)=>b.valor-a.valor);
  const qtdTxt=q=>Number(q).toLocaleString('pt-BR',{maximumFractionDigits:8});
  return `
  <div class="card span2" id="cardCarteira">
    <h3>Resumo da carteira <span class="tag muted">${S.ativos.length} ativo${S.ativos.length===1?'':'s'}</span></h3>
    <div class="grid4">
      <div class="stat"><div class="k">Valor atual</div><div class="v">${brl(T.total)}</div><div class="d">soma dos ativos</div></div>
      <div class="stat"><div class="k">Valor investido</div><div class="v">${T.investido!==null?brl(T.investido):'—'}</div><div class="d">${T.nCusto?T.nCusto+' com preço médio':'informe o preço médio'}</div></div>
      <div class="stat"><div class="k">Lucro / prejuízo</div><div class="v ${T.lucro!==null?sinalCls(T.lucro):''}">${T.lucro!==null?brlS(T.lucro):'—'}</div><div class="d ${T.lucroPct!==null?sinalCls(T.lucroPct):''}">${T.lucroPct!==null?pctS(T.lucroPct):'sem custo informado'}</div></div>
      <div class="stat"><div class="k">Variação do dia</div><div class="v ${T.varDia!==null?sinalCls(T.varDia):''}">${T.varDia!==null?brlS(T.varDia):'—'}</div><div class="d ${T.varDiaPct!==null?sinalCls(T.varDiaPct):''}">${T.varDiaPct!==null?pctS(T.varDiaPct):'sem cotação'}</div></div>
    </div>
  </div>

  <div class="card span2" id="cardAtivos">
    <h3>Ativos
      <span class="btnrow" style="text-transform:none;letter-spacing:0">
        <button class="btn ghost sm" id="btnImpCsv">Importar CSV</button>
        ${n?'<button class="btn ghost sm" id="btnCot">↻ Atualizar</button>':''}
      </span></h3>
    <div class="sub" style="margin-bottom:var(--s3)" id="cotStatus">${n?(S.cotacoesEm?'Última busca na brapi.dev: <b>'+dataHora(S.cotacoesEm)+'</b> · '+n+' ativo'+(n>1?'s':'')+' com cotação automática':'Cotações ainda não buscadas na brapi.dev'):'Para atualizar sozinho, edite o ativo e informe ticker e quantidade.'}
      ${typeof resumoRobo==='function'?resumoRobo():''}</div>
    ${erro?`<div class="warnbox" role="alert" style="margin-bottom:var(--s3)"><b>Sem cotação nova para ${falhas.map(esc).join(', ')}.</b> ${MSG_ERRO_COT[erro.tipo]||MSG_ERRO_COT.dados} Mantive o último preço salvo de cada um.</div>`:''}
    <div class="carteira-head" aria-hidden="true"><span></span><span>Ativo</span><span>Qtd × preço</span><span>Valor atual</span><span>Resultado</span><span>Dia</span><span>Peso</span></div>
    <div class="list">
    ${lista.map(a=>{
      const m=metricasAtivo(a,T.total);
      const preco=m.preco?brl(Math.round(m.preco)):null;
      const fonte=a.cotacaoEm?`${FONTE_NOME[a.cotacaoFonte]||'cotação'} · ${dataHora(a.cotacaoEm)}`:'';
      const selos=seloTeto('Bazin',m.bazin,m.preco)+seloTeto('Graham',m.graham,m.preco);
      return `<button class="ativo" data-ativo="${a.id}" aria-label="${esc(a.nome)}, valor ${brl(m.valor)}${m.lucro!==null?', resultado '+brlS(m.lucro):''}">
        <span class="tk" aria-hidden="true">${esc((a.ticker||a.nome).slice(0,5).toUpperCase())}</span>
        <span class="nm">${esc(a.nome)}</span>
        <span class="vl">${brl(m.valor)}</span>
        <span class="ds">${esc(a.classe)}${a.ticker&&a.ticker!==a.nome?' · '+esc(a.ticker):''}<span class="so-mobile">${a.qtd&&preco?' · '+qtdTxt(a.qtd)+' × '+preco:''} · ${pct(m.peso,1)}${m.varDiaPct!==null?' · dia '+comSinal(pctS(m.varDiaPct),m.varDiaPct):''}</span>${fonte?`<span class="fonte" style="display:block">${fonte}</span>`:''}</span>
        <span class="rs ${m.lucro!==null?sinalCls(m.lucro):'zero'}">${m.lucro!==null?brlS(m.lucro)+'<br>'+pctS(m.lucroPct):'<span class="muted">sem custo</span>'}</span>
        <span class="col-qtd">${a.qtd?qtdTxt(a.qtd):'—'}<br><span class="muted">${preco||'—'}</span></span>
        <span class="col-dia ${m.varDiaPct!==null?sinalCls(m.varDiaPct):'zero'}">${m.varDiaPct!==null?pctS(m.varDiaPct)+'<br>'+brlS(m.varDia):'—'}</span>
        <span class="col-peso">${pct(m.peso,1)}</span>
        <span class="selos">${selos}</span>
      </button>`}).join('')}</div>
  </div>`;
}
function ligarCardAtivos(el){
  if($('#btnCot'))$('#btnCot').onclick=()=>atualizarCotacoes();
  $('#btnImpCsv')?.addEventListener('click',()=>abrirImportCarteira());
  $$('[data-ativo]',el).forEach(b=>b.onclick=()=>abrirAtivo(b.dataset.ativo));
}

/* ---------- folha do ativo ---------- */
function abrirAtivo(id){
  const a=id?S.ativos.find(x=>x.id===id):null;
  const classes=Object.keys(S.alocacaoAlvo);
  const T=totaisCarteira(), m=a?metricasAtivo(a,T.total):null;
  const taxa=S.premissas.taxaBazin>0?S.premissas.taxaBazin:.06;
  const linhaTeto=(nome,teto,margem,formula)=>`<div class="teto"><div><b>${nome}</b><div class="hint" style="margin:0">${formula}</div></div>
    <div style="text-align:right">${teto?`<div class="num" style="font-weight:600">${brl(teto)}</div>
      ${margem!==null?`<div class="num ${sinalCls(margem)}" style="font-size:var(--t-xs)">margem ${pctS(margem,1)}</div>`:'<div class="hint" style="margin:0">sem cotação</div>'}`
      :'<span class="muted" style="font-size:var(--t-xs)">preencha os dados abaixo</span>'}</div></div>`;
  sheet(`<h2>${a?esc(a.nome):'Novo ativo'}</h2><div class="sh-sub">${a?esc(a.classe)+(a.ticker?' · '+esc(a.ticker):''):'Com ticker e quantidade, o valor passa a ser atualizado sozinho pela cotação do dia.'}</div>
  ${m?`<div class="metricas">
    <div class="stat"><div class="k">Valor atual</div><div class="v">${brl(m.valor)}</div><div class="d">peso ${pct(m.peso,1)} na carteira</div></div>
    <div class="stat"><div class="k">Lucro / prejuízo</div><div class="v ${m.lucro!==null?sinalCls(m.lucro):''}">${m.lucro!==null?brlS(m.lucro):'—'}</div><div class="d ${m.lucroPct!==null?sinalCls(m.lucroPct):''}">${m.lucroPct!==null?pctS(m.lucroPct):'informe o preço médio'}</div></div>
    <div class="stat"><div class="k">Cotação</div><div class="v">${m.preco?brl(Math.round(m.preco)):'—'}</div><div class="d">${a.cotacaoEm?(FONTE_NOME[a.cotacaoFonte]||'cotação')+' · '+dataHora(a.cotacaoEm):'ainda sem cotação'}</div></div>
    <div class="stat"><div class="k">Variação do dia</div><div class="v ${m.varDiaPct!==null?sinalCls(m.varDiaPct):''}">${m.varDiaPct!==null?pctS(m.varDiaPct):'—'}</div><div class="d ${m.varDia!==null?sinalCls(m.varDia):''}">${m.varDia!==null?brlS(m.varDia):''}</div></div>
  </div>
  <div class="card flat" style="padding:var(--s3) var(--s4);margin-bottom:var(--s4)">
    <h3 style="margin-bottom:var(--s1)">Preço teto ${seloTeto('Bazin',m.bazin,m.preco)}${seloTeto('Graham',m.graham,m.preco)}</h3>
    ${linhaTeto('Bazin',m.bazin,m.margemBazin,'DPA ÷ '+pct(taxa,1)+(m.dy!==null?' · DY atual '+pct(m.dy,1):''))}
    ${linhaTeto('Graham',m.graham,m.margemGraham,'√(22,5 × LPA × VPA)')}
  </div>`:''}
  <div class="fgroup"><label class="f" for="atNome">Nome</label><input class="inp" id="atNome" value="${a?esc(a.nome):''}" placeholder="Ex.: Tesouro IPCA+ 2035, MXRF11, IVVB11"></div>
  <div class="grid2">
    <div class="fgroup"><label class="f" for="atTicker">Ticker B3 (opcional)</label><input class="inp" id="atTicker" autocapitalize="characters" value="${a&&a.ticker?esc(a.ticker):''}" placeholder="Ex.: BBSE3, MXRF11"></div>
    <div class="fgroup"><label class="f" for="atClasse">Classe</label><select class="inp" id="atClasse">${classes.map(k=>`<option ${a&&a.classe===k?'selected':''}>${esc(k)}</option>`).join('')}</select></div>
    <div class="fgroup"><label class="f" for="atQtd">Quantidade</label><input class="inp" id="atQtd" inputmode="decimal" value="${a&&a.qtd?String(a.qtd).replace('.',','):''}" placeholder="0"></div>
    <div class="fgroup"><label class="f" for="atPm">Preço médio (R$)</label><input class="inp" id="atPm" inputmode="decimal" value="${a?campoMoney(a.precoMedio):''}" placeholder="opcional"></div>
    <div class="fgroup"><label class="f" for="atValor">Valor atual (R$)</label><input class="inp" id="atValor" inputmode="decimal" value="${a?campoMoney(a.valor):''}" placeholder="0,00" aria-describedby="atValorH">
      <div class="hint" id="atValorH">Com ticker e quantidade, vira quantidade × cotação.</div></div>
    <div class="fgroup"><label class="f" for="atInv">Valor investido (R$)</label><input class="inp" id="atInv" inputmode="decimal" value="${a?campoMoney(a.investido):''}" placeholder="sem quantidade" aria-describedby="atInvH">
      <div class="hint" id="atInvH">Só para ativos sem quantidade (ex.: Tesouro, CDB).</div></div>
  </div>
  <details class="acc" style="margin-bottom:var(--s4)" ${a&&(a.dpa||a.lpa||a.vpa)?'open':''}><summary>Indicadores para o preço teto (opcional)</summary><div class="body">
    <div class="grid2" style="grid-template-columns:repeat(3,minmax(0,1fr))">
      <div class="fgroup"><label class="f" for="atDpa">DPA 12 meses</label><input class="inp" id="atDpa" inputmode="decimal" value="${a?campoMoney(a.dpa):''}" placeholder="R$ por ação"></div>
      <div class="fgroup"><label class="f" for="atLpa">LPA</label><input class="inp" id="atLpa" inputmode="decimal" value="${a?campoMoney(a.lpa):''}" placeholder="R$"></div>
      <div class="fgroup"><label class="f" for="atVpa">VPA</label><input class="inp" id="atVpa" inputmode="decimal" value="${a?campoMoney(a.vpa):''}" placeholder="R$"></div>
    </div>
    <b>DPA</b> = dividendos por ação pagos nos últimos 12 meses (você encontra no Investidor10 ou no RI da empresa). <b>LPA</b> = lucro por ação; <b>VPA</b> = valor patrimonial por ação. A taxa mínima do Bazin (${pct(taxa,1)}) muda em Configurações.
  </div></details>
  <button class="btn" id="atSalvar">${a?'Salvar':'Adicionar'}</button>
  ${a?'<button class="btn ghost danger-txt" id="atExcluir" style="margin-top:8px">Remover ativo</button>':''}`);
  $('#atSalvar').onclick=()=>{
    const nome=normDesc($('#atNome').value), classe=$('#atClasse').value;
    const ticker=limparTicker($('#atTicker').value);
    const qtd=parseQtd($('#atQtd').value);
    if(!nome&&!ticker){toast('Dê um nome ao ativo');$('#atNome').focus();return}
    let alvo;
    if(a){alvo=a}
    else{alvo={id:uid(),nome:'',valor:0,classe};S.ativos.push(alvo)}
    alvo.nome=nome||ticker;alvo.valor=parseMoney($('#atValor').value);alvo.classe=classe;
    const mudouTicker=(alvo.ticker||'')!==ticker;
    if(ticker)alvo.ticker=ticker;else delete alvo.ticker;
    if(qtd>0)alvo.qtd=qtd;else delete alvo.qtd;
    const opc={precoMedio:'#atPm',investido:'#atInv',dpa:'#atDpa',lpa:'#atLpa',vpa:'#atVpa'};
    for(const[k,sel]of Object.entries(opc)){const v=parseMoney($(sel).value);if(v>0)alvo[k]=v;else delete alvo[k]}
    if(mudouTicker){delete alvo.cotacao;delete alvo.variacao;delete alvo.cotacaoEm;delete alvo.cotacaoFonte}
    if(mudouTicker&&typeof aplicarCotacoesRobo==='function')aplicarCotacoesRobo();
    if(alvo.ticker&&alvo.qtd&&alvo.cotacao)alvo.valor=Math.round(alvo.qtd*alvo.cotacao);
    else if(!alvo.valor&&alvo.qtd&&alvo.precoMedio)alvo.valor=Math.round(alvo.qtd*alvo.precoMedio);
    salvar();fecharSheet();render();toast(a?'Ativo atualizado':'Ativo adicionado');
    if(alvo.ticker&&alvo.qtd&&mudouTicker)atualizarCotacoes({silencioso:true});
  };
  if(a)$('#atExcluir').onclick=()=>confirmar({titulo:'Remover '+a.nome+'?',perigo:true,botao:'Remover ativo',
    texto:'O ativo sai da carteira e do plano de liberdade.',
    aoConfirmar:()=>{S.ativos=S.ativos.filter(x=>x.id!==a.id);salvar();fecharSheet();render();toast('Ativo removido')}});
}
const limparTicker=s=>String(s||'').trim().toUpperCase().replace(/\.SA$/,'').replace(/[^A-Z0-9]/g,'');

/* ---------- importar carteira por CSV ----------
   Formato: ticker; quantidade; preço médio; classe  (cabeçalho opcional)
   Aceita ; , ou tab como separador e números no formato brasileiro. */
const semAcento=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
const ETF_EXTERIOR=/^(IVVB|NASD|WRLD|SPXI|EURP|ACWI|XINA|ASIA|GOLD|HASH|QBTC|BITH|ETHE|USTK|BNDX|SMAC|TECK|NDIV|BIVB)\d{2}$/;
function mapClasse(raw,ticker){
  const k=semAcento(raw), cls=Object.keys(S.alocacaoAlvo);
  const exato=cls.find(c=>semAcento(c)===k);
  if(exato)return exato;
  const ok=c=>cls.includes(c)?c:null;
  if(k){
    if(/fii|imobili|fiagro/.test(k))return ok('FIIs')||cls[0];
    if(/cripto|crypto|bitcoin/.test(k))return ok('Cripto')||cls[0];
    if(/renda fixa|tesouro|cdb|lci|lca|debenture|cri|cra|^rf$/.test(k))return ok('Renda fixa')||cls[0];
    if(/caixa|conta/.test(k))return ok('Caixa')||cls[0];
    if(/bdr|stock|exterior|reit|internacional|eua/.test(k))return ok('Exterior')||cls[0];
    if(/etf/.test(k))return ETF_EXTERIOR.test(ticker)?(ok('Exterior')||cls[0]):(ok('Ações BR')||cls[0]);
    if(/acao|acoes|acoe|bolsa|unit/.test(k))return ok('Ações BR')||cls[0];
  }
  if(ETF_EXTERIOR.test(ticker)||/^[A-Z]{4}3[2-59]$/.test(ticker))return ok('Exterior')||cls[0];
  if(/^[A-Z]{4}11$/.test(ticker))return ok('FIIs')||cls[0];
  return ok('Ações BR')||cls[0];
}
function dividirLinhaCSV(l,sep){
  const o=[];let cur='',q=false;
  for(const ch of l){ if(ch==='"'){q=!q} else if(ch===sep&&!q){o.push(cur);cur=''} else cur+=ch }
  o.push(cur);return o.map(x=>x.trim().replace(/^"|"$/g,'').trim());
}
function parseCarteiraCSV(texto){
  const linhas=String(texto||'').replace(/^﻿/,'').split(/\r?\n/).map(l=>l.trim()).filter(l=>l&&!l.startsWith('#'));
  const itens=[],erros=[];
  if(!linhas.length)return{itens,erros};
  const sep=linhas[0].includes(';')?';':(linhas[0].includes('\t')?'\t':',');
  let col={t:0,q:1,p:2,c:3}, ini=0;
  const cab=dividirLinhaCSV(linhas[0],sep).map(semAcento);
  const pareceCab=cab.some(h=>/ticker|ativo|codigo|papel|quant|qtd|qtde|preco|classe|tipo/.test(h));
  if(pareceCab){
    ini=1;
    const idx=re=>cab.findIndex(h=>re.test(h));
    const t=idx(/ticker|ativo|codigo|papel|simbolo/), q=idx(/quant|qtd|qtde/), p=idx(/preco medio|pm|medio|preco|custo/), c=idx(/classe|tipo|categoria/);
    col={t:t>=0?t:0,q:q>=0?q:1,p,c};
  }
  for(let i=ini;i<linhas.length;i++){
    const cel=dividirLinhaCSV(linhas[i],sep);
    const ticker=limparTicker(cel[col.t]);
    const qtd=parseQtd(cel[col.q]);
    const pm=col.p>=0&&cel[col.p]!==undefined?parseMoney(cel[col.p]):0;
    const classeRaw=col.c>=0?cel[col.c]:'';
    if(!ticker||!/^[A-Z0-9]{3,12}$/.test(ticker)){erros.push({linha:i+1,motivo:'ticker vazio ou inválido'});continue}
    if(!(qtd>0)){erros.push({linha:i+1,motivo:'quantidade inválida para '+ticker});continue}
    itens.push({ticker,qtd,precoMedio:pm>0?pm:0,classe:mapClasse(classeRaw,ticker),classeInformada:!!semAcento(classeRaw)});
  }
  /* mesmo ticker repetido: soma as quantidades e faz o preço médio ponderado */
  const porTicker={};
  for(const it of itens){
    const x=porTicker[it.ticker];
    if(!x){porTicker[it.ticker]={...it};continue}
    const custo=x.qtd*x.precoMedio+it.qtd*it.precoMedio;
    x.qtd+=it.qtd; x.precoMedio=x.qtd?Math.round(custo/x.qtd):0;
  }
  return{itens:Object.values(porTicker),erros};
}
function abrirImportCarteira(){
  sheet(`<h2>Importar carteira (CSV)</h2>
  <div class="sh-sub">Uma linha por ativo: <span class="kbd">ticker; quantidade; preço médio; classe</span>. Serve para trazer a carteira do Investidor10 ou de uma planilha.</div>
  <div class="fgroup"><label class="f" for="csvArq">Arquivo .csv</label><input class="inp" type="file" id="csvArq" accept=".csv,.txt,text/csv"></div>
  <div class="fgroup"><label class="f" for="csvTexto">Ou cole aqui</label>
    <textarea class="inp" id="csvTexto" placeholder="ticker;quantidade;preco_medio;classe&#10;GGRC11;120;10,45;FII&#10;BBSE3;50;31,20;Ação"></textarea></div>
  <div class="infobox" style="margin-bottom:var(--s3)">Ativos que já existem (mesmo ticker) têm <b>quantidade e preço médio atualizados</b>; os novos são adicionados. Nada é apagado. A classe aceita FII, Ação, ETF, BDR, Renda fixa, Cripto — se faltar, eu deduzo pelo ticker.</div>
  <button class="btn" id="csvLer">Conferir antes de importar</button>`);
  $('#csvArq').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();
    r.onload=()=>{$('#csvTexto').value=String(r.result).slice(0,200000);toast('Arquivo lido — confira e toque em Conferir')};r.readAsText(f,'utf-8')};
  $('#csvLer').onclick=()=>{
    const {itens,erros}=parseCarteiraCSV($('#csvTexto').value);
    if(!itens.length){toast(erros.length?'Nenhuma linha válida — '+erros[0].motivo+' (linha '+erros[0].linha+')':'Escolha um arquivo ou cole o CSV');return}
    revisarImportCarteira(itens,erros);
  };
}
function revisarImportCarteira(itens,erros){
  const existe=t=>S.ativos.find(a=>a.ticker===t);
  const novos=itens.filter(i=>!existe(i.ticker)), atual=itens.filter(i=>existe(i.ticker));
  sheet(`<h2>Conferir importação</h2>
  <div class="sh-sub">${novos.length} novo${novos.length===1?'':'s'} · ${atual.length} atualizado${atual.length===1?'':'s'}${erros.length?` · ${erros.length} linha${erros.length>1?'s':''} ignorada${erros.length>1?'s':''}`:''}</div>
  ${erros.length?`<div class="warnbox" style="margin-bottom:var(--s3)">${erros.slice(0,5).map(e=>'Linha '+e.linha+': '+esc(e.motivo)).join('<br>')}${erros.length>5?'<br>…':''}</div>`:''}
  <div class="tblwrap" style="max-height:46vh;overflow-y:auto"><table>
    <caption class="sr-only">Ativos que serão importados</caption>
    <thead><tr><th scope="col">Ticker</th><th scope="col" class="tnum">Qtd</th><th scope="col" class="tnum">Preço médio</th><th scope="col">Classe</th><th scope="col"></th></tr></thead>
    <tbody>${itens.map(i=>`<tr><td><b>${esc(i.ticker)}</b></td><td class="tnum">${i.qtd.toLocaleString('pt-BR',{maximumFractionDigits:8})}</td>
      <td class="tnum">${i.precoMedio?brl(i.precoMedio):'—'}</td><td>${esc(i.classe)}</td>
      <td>${existe(i.ticker)?'<span class="selo neutral">atualiza</span>':'<span class="selo ok">novo</span>'}</td></tr>`).join('')}</tbody>
  </table></div>
  <button class="btn" id="csvConfirma" style="margin-top:var(--s4)">Importar ${itens.length} ativo${itens.length===1?'':'s'}</button>`);
  $('#csvConfirma').onclick=()=>{
    for(const i of itens){
      let a=existe(i.ticker);
      if(a){a.qtd=i.qtd;if(i.precoMedio)a.precoMedio=i.precoMedio;if(i.classeInformada)a.classe=i.classe}
      else{a={id:uid(),nome:i.ticker,valor:0,classe:i.classe,ticker:i.ticker,qtd:i.qtd};if(i.precoMedio)a.precoMedio=i.precoMedio;S.ativos.push(a)}
      if(a.cotacao>0)a.valor=Math.round(a.qtd*a.cotacao);
      else if(a.precoMedio)a.valor=Math.round(a.qtd*a.precoMedio);
    }
    if(typeof aplicarCotacoesRobo==='function')aplicarCotacoesRobo();
    salvar();fecharSheet();render();
    toast(itens.length+' ativo'+(itens.length===1?'':'s')+' importado'+(itens.length===1?'':'s')+' — buscando cotações');
    S.cotacoesEm=null;atualizarCotacoes({silencioso:true});
  };
}
