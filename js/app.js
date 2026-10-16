/* =====================================================================
   LIBERDADE 65 — backup, navegação e inicialização
   ===================================================================== */

/* ---------- backup ----------
   - aviso no Painel quando o último backup tem mais de 15 dias
   - antes de restaurar ou apagar, baixa uma cópia automática do estado atual
   - valida o arquivo e mostra um resumo antes de restaurar */
const DIAS_AVISO_BACKUP=15;
function baixarArquivo(nome,conteudo,tipo='application/json'){
  const blob=new Blob([conteudo],{type:tipo});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=nome;a.style.display='none';
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),4000);
}
const temDados=()=>S.transacoes.length>0||S.ativos.length>0||S.cartoes.length>0||S.perfil.rendaLiquida>0;
function diasDesdeBackup(){const t=paraMs(S.ultimoBackupEm);return isNaN(t)?Infinity:(Date.now()-t)/864e5}
function avisoBackupHTML(){
  if(!temDados())return '';
  const d=diasDesdeBackup();
  if(d<=DIAS_AVISO_BACKUP)return '';
  return `<div class="warnbox aviso span2" id="avisoBackup" role="status"><div class="aic" aria-hidden="true">🛟</div><div class="acorpo">
    <b>${isFinite(d)?'Seu último backup foi há '+Math.floor(d)+' dias.':'Você ainda não fez nenhum backup.'}</b>
    Seus dados ficam só neste navegador: se ele for limpo ou trocado, eles somem. Guarde o arquivo fora do GitHub (pen drive, Google Drive ou e-mail para você mesmo).
    <div><button class="btn sm" data-backup-agora>Fazer backup agora</button></div></div></div>`;
}
async function exportarBackup(){
  S.ultimoBackupEm=new Date().toISOString();
  const json=JSON.stringify(S,null,1), nome='liberdade65-backup-'+todayISO()+'.json';
  salvarAgora();
  try{baixarArquivo(nome,json);toast('Backup salvo: '+nome)}
  catch(e){
    try{await navigator.clipboard.writeText(json);toast('Backup copiado para a área de transferência')}
    catch(x){toast('Não consegui exportar neste navegador')}
  }
  if(S.ui.tab==='painel')render();
}
/* cópia de segurança automática, antes de ações que substituem os dados */
function baixarCopiaSeguranca(motivo){
  try{baixarArquivo('liberdade65-backup-auto-'+motivo+'-'+carimbo()+'.json',JSON.stringify(S,null,1));return true}
  catch(e){return false}
}
function validarBackup(txt){
  let p;
  try{p=JSON.parse(String(txt).replace(/^﻿/,''))}
  catch(e){return{erro:'O arquivo está quebrado ou incompleto — não é um JSON válido.'}}
  if(!p||typeof p!=='object'||Array.isArray(p))return{erro:'Este arquivo não é um backup do Liberdade 65.'};
  const principais=['perfil','premissas','categorias','cartoes','transacoes','ativos','alocacaoAlvo'];
  if(typeof p.v!=='number'||principais.filter(k=>k in p).length<4)
    return{erro:'Este arquivo não parece ser um backup do Liberdade 65 (faltam as partes principais). Pode ser de outro app.'};
  for(const k of ['categorias','cartoes','transacoes','ativos','patrimonioHist','metas'])
    if(k in p&&!Array.isArray(p[k]))return{erro:`A parte “${k}” do backup está corrompida.`};
  for(const k of ['perfil','premissas','alocacaoAlvo','aprendizado','ui'])
    if(k in p&&(!p[k]||typeof p[k]!=='object'||Array.isArray(p[k])))return{erro:`A parte “${k}” do backup está corrompida.`};
  const tx=p.transacoes||[], at=p.ativos||[], ca=p.cartoes||[];
  const iT=tx.findIndex(t=>!t||typeof t!=='object'||typeof t.valor!=='number'||!isFinite(t.valor)||!/^\d{4}-\d{2}$/.test(String(t.competencia))||typeof t.desc!=='string');
  if(iT>=0)return{erro:`O lançamento nº ${iT+1} do backup está quebrado.`};
  const iA=at.findIndex(a=>!a||typeof a!=='object'||typeof a.nome!=='string'||typeof a.valor!=='number'||!isFinite(a.valor));
  if(iA>=0)return{erro:`O ativo nº ${iA+1} do backup está quebrado.`};
  const iC=ca.findIndex(c=>!c||typeof c!=='object'||!c.id||typeof c.nome!=='string');
  if(iC>=0)return{erro:`O cartão nº ${iC+1} do backup está quebrado.`};
  return{dados:p,resumo:{lanc:tx.length,futuras:tx.filter(t=>t.futura).length,cartoes:ca.length,ativos:at.length,
    data:p.ultimoBackupEm||null,renda:p.perfil?.rendaLiquida||0}};
}
function abrirRestaurar(txt,nomeArq){
  const r=validarBackup(txt);
  if(r.erro){
    sheet(`<h2>Arquivo recusado</h2><div class="sh-sub">${esc(nomeArq||'')}</div>
      <div class="badbox" role="alert" style="margin-bottom:var(--s4)"><b>${esc(r.erro)}</b><br>Nada foi alterado. Escolha um arquivo <span class="kbd">liberdade65-backup-….json</span> exportado pelo app.</div>
      <button class="btn ghost" data-close>Entendi</button>`);
    return;
  }
  const z=r.resumo;
  sheet(`<h2>Restaurar este backup?</h2><div class="sh-sub">${esc(nomeArq||'')}${z.data?' · feito em '+dataHora(z.data):''}</div>
    <div class="metricas">
      <div class="stat"><div class="k">Lançamentos</div><div class="v">${z.lanc}</div><div class="d">${z.futuras} parcela${z.futuras===1?'':'s'} futura${z.futuras===1?'':'s'}</div></div>
      <div class="stat"><div class="k">Cartões</div><div class="v">${z.cartoes}</div></div>
      <div class="stat"><div class="k">Ativos</div><div class="v">${z.ativos}</div></div>
      <div class="stat"><div class="k">Renda líquida</div><div class="v">${z.renda?brl(z.renda):'—'}</div></div>
    </div>
    <div class="warnbox" style="margin-bottom:var(--s4)">Os dados atuais deste navegador (${S.transacoes.length} lançamentos, ${S.cartoes.length} cartões, ${S.ativos.length} ativos) serão substituídos.
      ${temDados()?' <b>Antes, vou baixar uma cópia automática deles</b> — se algo der errado, é só restaurá-la.':''}</div>
    <div class="btnrow"><button class="btn ghost" data-close>Cancelar</button><button class="btn" id="bkConfirma">Restaurar backup</button></div>`);
  $('#bkConfirma').onclick=()=>{
    if(temDados())baixarCopiaSeguranca('antes-de-restaurar');
    S=deepMerge(structuredClone(DEFAULT),r.dados);
    aplicarCotacoesRobo();
    salvarAgora();fecharSheet();aplicarTema(S.ui.tema||'');
    $('#brandsub').textContent='meta '+Math.round(S.perfil.metaPoupanca*100)+'%';
    render();toast('Backup restaurado: '+z.lanc+' lançamentos, '+z.cartoes+' cartões, '+z.ativos+' ativos');
  };
}
function apagarTudo(){
  confirmar({titulo:'Apagar todos os dados?',perigo:true,botao:'Apagar tudo',
    texto:'Lançamentos, cartões, ativos e configurações deste navegador serão apagados. O token da brapi continua salvo.'+(temDados()?' <b>Antes, vou baixar uma cópia automática</b> para você poder voltar atrás.':''),
    aoConfirmar:()=>{
      if(temDados())baixarCopiaSeguranca('antes-de-apagar');
      bloquearSalvar=true;clearTimeout(saveT);saveT=null;
      setTimeout(()=>{localStorage.removeItem(KEY);location.reload()},700); /* dá tempo do download começar */
    }});
}
function ligarBackup(el){
  $('#btnExport',el).onclick=()=>exportarBackup();
  $('#btnImportBk',el).onclick=()=>$('#arqBk',el).click();
  $('#arqBk',el).onchange=e=>{const f=e.target.files[0];if(!f)return;
    const r=new FileReader();r.onload=()=>{abrirRestaurar(String(r.result),f.name);e.target.value=''};
    r.onerror=()=>toast('Não consegui ler o arquivo');r.readAsText(f)};
  $('#btnReset',el).onclick=()=>apagarTudo();
}

/* ---------- navegação ---------- */
const VIEWS={painel:renderPainel,lancar:renderLancar,faturas:renderFaturas,investir:renderInvestir,liberdade:renderLiberdade,config:renderConfig};
function render(){
  const tab=S.ui.tab in VIEWS?S.ui.tab:'painel';
  $$('.view').forEach(v=>v.classList.toggle('on',v.id==='v-'+tab));
  $$('nav.tabs button[data-tab]').forEach(b=>{if(b.dataset.tab===tab)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
  $('#viewTitle').textContent=TITULOS[tab];
  document.title=(tab==='painel'?'':TITULOS[tab]+' · ')+'Liberdade 65';
  $('#mLabel').childNodes[0].textContent=ymLabel(S.ui.ym);
  $('#mSmall').textContent=S.ui.ym===ymNow()?'mês atual':(S.ui.ym>ymNow()?'projeção':'fechado');
  VIEWS[tab]();
}
function irPara(tab){
  S.ui.tab=tab;salvar();render();scrollTo({top:0});
}
document.body.addEventListener('click',e=>{
  const g=e.target.closest('[data-goto]');
  if(g){e.preventDefault();irPara(g.dataset.goto);return}
  if(e.target.closest('[data-backup-agora]'))exportarBackup();
});
$$('nav.tabs button[data-tab]').forEach(b=>b.onclick=()=>irPara(b.dataset.tab));
$('#mPrev').onclick=()=>{S.ui.ym=addMonthYM(S.ui.ym,-1);salvar();render()};
$('#mNext').onclick=()=>{S.ui.ym=addMonthYM(S.ui.ym,1);salvar();render()};
$('#fab').onclick=()=>abrirTx();
$('#btnCfg').onclick=()=>irPara('config');

/* tema: automático (segue o sistema) → escuro → claro */
const TEMA_ROTULO={'':'automático','dark':'escuro','light':'claro'};
function aplicarTema(t){
  if(t)document.documentElement.dataset.theme=t;else delete document.documentElement.dataset.theme;
  const b=$('#btnTheme');
  b.innerHTML=svgIc(t==='dark'?'lua':t==='light'?'sol':'auto',18);
  b.setAttribute('aria-label','Tema: '+TEMA_ROTULO[t]+'. Alternar tema');
  b.title='Tema '+TEMA_ROTULO[t];
  const meta=document.querySelector('meta[name=theme-color]');
  if(meta)meta.content=getComputedStyle(document.documentElement).getPropertyValue('--ground').trim()||'#0D1416';
}
$('#btnTheme').onclick=()=>{
  const cur=S.ui.tema||'';
  const next=cur===''?'dark':(cur==='dark'?'light':'');
  S.ui.tema=next;salvar();aplicarTema(next);toast('Tema '+TEMA_ROTULO[next]);
};

/* ---------- inicialização ---------- */
aplicarTema(S.ui.tema||'');
if(aplicarCotacoesRobo())salvar();
$('#brandsub').textContent='meta '+Math.round(S.perfil.metaPoupanca*100)+'%';
render();
/* cotações: busca ao abrir se estiverem velhas, e de novo quando o app volta a ficar visível */
if(cotacoesVelhas())setTimeout(()=>atualizarCotacoes({silencioso:true}),400);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&cotacoesVelhas())atualizarCotacoes({silencioso:true})});
