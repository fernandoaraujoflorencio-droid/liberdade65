/* =====================================================================
   LIBERDADE 65 — folhas (diálogos): lançamento, fatura, cartão, alocação
   Acessível: role="dialog", foco preso dentro da folha, Esc fecha,
   o foco volta para o botão que abriu.
   ===================================================================== */
let sheetOrigem=null;
const FOCAVEIS='button:not([disabled]),[href],input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])';
function sheet(html){
  const s=$('#sheet'), body=$('#sheetBody'), panel=$('#sheet .panel');
  if(!s.classList.contains('on'))sheetOrigem=document.activeElement;
  body.innerHTML=html;
  const h=body.querySelector('h2');
  if(h){h.id='sheetTitulo';panel.setAttribute('aria-labelledby','sheetTitulo')}
  s.classList.add('on');
  $('#app').inert=true;$('nav.tabs').inert=true;
  panel.scrollTop=0;
  panel.focus({preventScroll:true});
}
function fecharSheet(){
  const s=$('#sheet');
  if(!s.classList.contains('on'))return;
  s.classList.remove('on');
  $('#app').inert=false;$('nav.tabs').inert=false;
  const o=sheetOrigem;sheetOrigem=null;
  if(o&&document.contains(o))o.focus({preventScroll:true});
  else $('#conteudo')?.focus({preventScroll:true});
}
$('#sheet').addEventListener('click',e=>{if(e.target.closest('[data-close]'))fecharSheet()});
document.addEventListener('keydown',e=>{
  const s=$('#sheet');
  if(!s.classList.contains('on'))return;
  if(e.key==='Escape'){e.preventDefault();fecharSheet();return}
  if(e.key==='Tab'){
    const f=$$(FOCAVEIS,$('#sheet .panel')).filter(x=>x.offsetParent!==null);
    if(!f.length)return;
    const first=f[0],last=f[f.length-1];
    if(e.shiftKey&&(document.activeElement===first||document.activeElement===$('#sheet .panel'))){e.preventDefault();last.focus()}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
  }
});
/* confirmação padronizada (substitui o confirm() do navegador) */
function confirmar({titulo,texto,botao='Confirmar',perigo=false,aoConfirmar}){
  sheet(`<h2>${esc(titulo)}</h2><div class="sh-sub">${texto}</div>
    <div class="btnrow"><button class="btn ghost" data-close>Cancelar</button>
    <button class="btn ${perigo?'danger':''}" id="cfOk">${esc(botao)}</button></div>`);
  $('#cfOk').onclick=()=>aoConfirmar();
}

function abrirTx(id){
  const t=id?S.transacoes.find(x=>x.id===id):null;
  const catsDesp=S.categorias.filter(c=>c.tipo!=='receita');
  const catsRec=S.categorias.filter(c=>c.tipo==='receita');
  const ehRec=t?t.valor>0:false;
  sheet(`
  <h2>${t?'Editar lançamento':'Novo lançamento'}</h2>
  <div class="sh-sub">${t?esc(t.desc):'Gasto, receita ou aporte'}</div>
  <div class="seg" role="group" aria-label="Tipo de lançamento" style="margin-bottom:var(--s3)">
    <button id="txDesp" aria-pressed="${!ehRec}">Saída</button>
    <button id="txRec" aria-pressed="${ehRec}">Entrada</button>
  </div>
  <div class="fgroup"><label class="f" for="txDesc">Descrição</label><input class="inp" id="txDesc" value="${t?esc(t.desc):''}" placeholder="Ex.: Mercado, iFood, aporte Tesouro"></div>
  <div class="grid2">
    <div class="fgroup"><label class="f" for="txVal">Valor (R$)</label><input class="inp" id="txVal" inputmode="decimal" value="${t?(Math.abs(t.valor)/100).toLocaleString('pt-BR',{minimumFractionDigits:2}):''}" placeholder="0,00"></div>
    <div class="fgroup"><label class="f" for="txData">Data</label><input class="inp" id="txData" type="date" value="${t?t.data:todayISO()}"></div>
  </div>
  <div class="fgroup" role="group" aria-labelledby="txCatsL"><div class="f" id="txCatsL" style="font-size:var(--t-2xs);letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3);font-weight:750;margin-bottom:6px">Categoria</div><div class="chips" id="txCats"></div></div>
  <div class="grid2">
    <div class="fgroup"><label class="f" for="txCartao">Cartão (opcional)</label>
      <select class="inp" id="txCartao"><option value="">Dinheiro / conta</option>${S.cartoes.map(c=>`<option value="${c.id}" ${t&&t.cartaoId===c.id?'selected':''}>${esc(c.nome)}</option>`).join('')}</select></div>
    <div class="fgroup"><label class="f" for="txParc">Parcelas</label><input class="inp" id="txParc" type="number" min="1" max="48" value="${t?t.parcelaDe:1}" ${t?'disabled':''}></div>
  </div>
  <button class="btn" id="txSalvar">${t?'Salvar alterações':'Lançar'}</button>
  ${t?`<button class="btn ghost" id="txExcluir" style="margin-top:8px">Excluir${t.grupo?' (só esta parcela)':''}</button>
  ${t.grupo?`<button class="btn ghost danger-txt" id="txExcluirTodas" style="margin-top:8px">Excluir todas as parcelas</button>`:''}`:''}`);

  let catSel=t?t.catId:'mercado', tipoSel=ehRec?'rec':'desp';
  function pintaCats(){
    const lista=tipoSel==='rec'?catsRec:catsDesp;
    if(!lista.some(c=>c.id===catSel))catSel=lista[0].id;
    $('#txCats').innerHTML=lista.map(c=>`<button class="chip" data-c="${c.id}" aria-pressed="${c.id===catSel}">${c.ic} ${esc(c.nome)}</button>`).join('');
    $$('#txCats .chip').forEach(b=>b.onclick=()=>{catSel=b.dataset.c;pintaCats();$(`#txCats [data-c="${catSel}"]`)?.focus()});
  }
  pintaCats();
  $('#txDesp').onclick=()=>{tipoSel='desp';$('#txDesp').setAttribute('aria-pressed','true');$('#txRec').setAttribute('aria-pressed','false');pintaCats()};
  $('#txRec').onclick=()=>{tipoSel='rec';$('#txRec').setAttribute('aria-pressed','true');$('#txDesp').setAttribute('aria-pressed','false');pintaCats()};
  $('#txDesc').addEventListener('blur',e=>{ if(!t&&tipoSel==='desp'&&e.target.value){const sug=classifica(e.target.value); if(sug!=='outros'){catSel=sug;pintaCats()} }});
  $('#txSalvar').onclick=()=>{
    const desc=normDesc($('#txDesc').value), val=parseMoney($('#txVal').value), data=$('#txData').value;
    if(!desc){toast('Dê um nome ao lançamento');$('#txDesc').focus();return}
    if(!val){toast('Informe o valor');$('#txVal').focus();return}
    if(!data){toast('Escolha a data');$('#txData').focus();return}
    const sinal=tipoSel==='rec'?1:-1, cartaoId=$('#txCartao').value||null;
    if(t){
      t.desc=desc;t.valor=sinal*Math.abs(val);t.data=data;t.competencia=ymOf(data);t.catId=catSel;t.cartaoId=cartaoId;
      S.aprendizado[chaveEstab(desc)]=catSel;
    }else{
      const nParc=clamp(parseInt($('#txParc').value)||1,1,48);
      const v=Math.abs(val), porParc=Math.round(v/nParc);
      const grupo=nParc>1?chaveEstab(desc)+'|'+nParc+'|'+porParc:null;
      for(let k=1;k<=nParc;k++){
        const comp=addMonthYM(ymOf(data),k-1);
        S.transacoes.push({id:uid(),data:k===1?data:comp+'-'+data.slice(8),competencia:comp,desc,
          valor:sinal*(k===nParc?v-porParc*(nParc-1):porParc),catId:catSel,cartaoId,parcelaN:k,parcelaDe:nParc,origem:'manual',grupo,futura:k>1});
      }
      S.aprendizado[chaveEstab(desc)]=catSel;
    }
    salvar();fecharSheet();render();toast(t?'Alterado':'Lançado');
  };
  if(t){
    $('#txExcluir').onclick=()=>{S.transacoes=S.transacoes.filter(x=>x.id!==t.id);salvar();fecharSheet();render();toast('Excluído')};
    const bt=$('#txExcluirTodas');
    if(bt)bt.onclick=()=>{S.transacoes=S.transacoes.filter(x=>x.grupo!==t.grupo);salvar();fecharSheet();render();toast('Parcelas excluídas')};
  }
}

function abrirFatura(cartaoId){
  const c=S.cartoes.find(x=>x.id===cartaoId), ym=S.ui.ym;
  if(!c)return;
  const txs=S.transacoes.filter(t=>t.cartaoId===cartaoId&&t.competencia===ym&&t.valor<0)
    .sort((a,b)=>a.data.localeCompare(b.data));
  const tot=-txs.reduce((a,t)=>a+t.valor,0);
  sheet(`<h2>${esc(c.nome)} · ${ymLabel(ym)}</h2>
  <div class="sh-sub">${txs.length} lançamentos · total ${brl(tot)}</div>
  <div class="list">${txs.map(t=>itemTx(t)).join('')||vazio({ic:'cartao',t:'Fatura vazia neste ciclo',p:'Importe a fatura na aba Faturas ou lance a compra pelo botão +.'})}</div>`);
  $$('#sheetBody [data-tx]').forEach(b=>b.onclick=()=>abrirTx(b.dataset.tx));
}

/* cadastro de cartão — mesmos campos do formato atual:
   {id,nome,limite(centavos),fechamento,vencimento,cor,bandeira} */
const CORES_CARTAO=['var(--c5)','var(--c3)','var(--c1)','var(--c2)','var(--c4)','var(--c6)'];
function abrirCartao(id){
  const c=id?S.cartoes.find(x=>x.id===id):null;
  let cor=c?.cor||CORES_CARTAO[S.cartoes.length%CORES_CARTAO.length];
  const usos=c?S.transacoes.filter(t=>t.cartaoId===c.id).length:0;
  sheet(`<h2>${c?'Editar cartão':'Novo cartão'}</h2><div class="sh-sub">Os dias de fechamento e vencimento ajudam a ler a fatura no mês certo.</div>
  <div class="fgroup"><label class="f" for="cNome">Nome</label><input class="inp" id="cNome" value="${c?esc(c.nome):''}" placeholder="Ex.: Nubank"></div>
  <div class="grid2">
    <div class="fgroup"><label class="f" for="cLimite">Limite (R$)</label><input class="inp" id="cLimite" inputmode="decimal" value="${c?campoMoney(c.limite):''}" placeholder="0,00"></div>
    <div class="fgroup"><label class="f" for="cBandeira">Apelido curto (opcional)</label><input class="inp" id="cBandeira" maxlength="6" value="${c?esc(c.bandeira||''):''}" placeholder="Ex.: Nu"></div>
    <div class="fgroup"><label class="f" for="cFech">Dia de fechamento</label><input class="inp" id="cFech" type="number" min="1" max="31" value="${c?c.fechamento:''}" placeholder="1 a 31"></div>
    <div class="fgroup"><label class="f" for="cVenc">Dia de vencimento</label><input class="inp" id="cVenc" type="number" min="1" max="31" value="${c?c.vencimento:''}" placeholder="1 a 31"></div>
  </div>
  <div class="fgroup" role="group" aria-labelledby="cCorL"><div id="cCorL" style="font-size:var(--t-2xs);letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3);font-weight:750;margin-bottom:6px">Cor</div>
    <div class="chips" id="cCores">${CORES_CARTAO.map((k,i)=>`<button class="chip" data-cor="${k}" aria-pressed="${k===cor}" aria-label="Cor ${i+1}"><i style="display:inline-block;width:14px;height:14px;border-radius:4px;background:${k};vertical-align:-2px"></i></button>`).join('')}</div></div>
  <button class="btn" id="cSalvar">${c?'Salvar':'Cadastrar cartão'}</button>
  ${c?`<button class="btn ghost danger-txt" id="cExcluir" style="margin-top:8px">Remover cartão</button>`:''}`);
  $$('#cCores .chip').forEach(b=>b.onclick=()=>{cor=b.dataset.cor;$$('#cCores .chip').forEach(x=>x.setAttribute('aria-pressed',String(x===b)))});
  $('#cSalvar').onclick=()=>{
    const nome=normDesc($('#cNome').value);
    const fech=parseInt($('#cFech').value), venc=parseInt($('#cVenc').value);
    if(!nome){toast('Dê um nome ao cartão');$('#cNome').focus();return}
    if(!(fech>=1&&fech<=31)){toast('Dia de fechamento entre 1 e 31');$('#cFech').focus();return}
    if(!(venc>=1&&venc<=31)){toast('Dia de vencimento entre 1 e 31');$('#cVenc').focus();return}
    const dados={nome,limite:parseMoney($('#cLimite').value),fechamento:fech,vencimento:venc,cor,bandeira:normDesc($('#cBandeira').value)||nome.slice(0,2)};
    if(c)Object.assign(c,dados);else S.cartoes.push({id:uid(),...dados});
    salvar();fecharSheet();render();toast(c?'Cartão atualizado':'Cartão cadastrado');
  };
  if(c)$('#cExcluir').onclick=()=>confirmar({titulo:'Remover '+c.nome+'?',perigo:true,botao:'Remover cartão',
    texto:usos?`Os ${usos} lançamentos deste cartão continuam no app, mas passam a contar como “Dinheiro / conta”.`:'Nenhum lançamento usa este cartão.',
    aoConfirmar:()=>{S.transacoes.forEach(t=>{if(t.cartaoId===c.id)t.cartaoId=null});S.cartoes=S.cartoes.filter(x=>x.id!==c.id);salvar();fecharSheet();render();toast('Cartão removido')}});
}

function abrirAlocacao(){
  const ks=Object.keys(S.alocacaoAlvo);
  sheet(`<h2>Alocação alvo</h2><div class="sh-sub">Percentual desejado por classe — a soma deve dar 100</div>
  <div class="grid2">${ks.map((k,i)=>`<div class="fgroup"><label class="f" for="aloc${i}">${esc(k)} (%)</label>
    <input class="inp aloc" id="aloc${i}" data-k="${esc(k)}" type="number" min="0" max="100" value="${S.alocacaoAlvo[k]}"></div>`).join('')}</div>
  <div class="sub" id="alocSoma" aria-live="polite" style="margin-bottom:10px"></div>
  <button class="btn" id="alocSalvar">Salvar alocação</button>`);
  const soma=()=>{const s=$$('.aloc').reduce((a,i)=>a+(+i.value||0),0);
    $('#alocSoma').innerHTML=s===100?'<b class="pos">Soma: 100% ✓</b>':`<b style="color:var(--warn)">Soma: ${s}%</b> — ajuste para 100`;return s};
  $$('.aloc').forEach(i=>i.addEventListener('input',soma));soma();
  $('#alocSalvar').onclick=()=>{
    if(soma()!==100){toast('A soma precisa dar 100%');return}
    $$('.aloc').forEach(i=>S.alocacaoAlvo[i.dataset.k]=+i.value||0);
    salvar();fecharSheet();render();toast('Alocação salva');
  };
}
