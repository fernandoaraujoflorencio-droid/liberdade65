/* =====================================================================
   LIBERDADE 65 — relatórios gerenciais (FIIs) e releases (ações)
   Lê o PDF (ou texto colado), encontra os indicadores, você confere e
   corrige, e o app guarda por ativo:
     rendimentos {AAAA-MM: centavos por cota}   (histórico mensal)
     relatorios  [{ym, arquivo, em}]           (o que já foi importado)
     dpa, vpa, lpa                             (centavos por cota/ação)
     dpaFonte   {meses, estimado}              (como o DPA foi calculado)
   Com isso o preço teto é calculado pelos vários métodos (carteira.js).
   ===================================================================== */
const MESES_NOME=['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const NUM_BR='(\\d{1,3}(?:\\.\\d{3})*,\\d{2,4}|\\d+,\\d{2,4})';
const numBR=s=>s==null?null:parseNumero(String(s));
const primeiro=(txt,res)=>{for(const re of res){const m=txt.match(re);if(m)return m}return null};

function parseRelatorio(texto,nomeArquivo=''){
  const bruto=String(texto||'');
  const t=semAcento(bruto).replace(/[ \t]+/g,' ');
  const r={arquivo:nomeArquivo,ticker:null,ym:null,rendimento:null,vp:null,cota:null,lpa:null,dy:null,pvp:null,achados:[]};

  /* ticker: o código que mais aparece (prefere um que já está na carteira) */
  const cont={};
  for(const m of (bruto+' '+nomeArquivo.toUpperCase()).matchAll(/\b([A-Z]{4}(?:11|3|4|5|6|33|34|35))\b/g))cont[m[1]]=(cont[m[1]]||0)+1;
  const cands=Object.entries(cont).sort((a,b)=>b[1]-a[1]).map(x=>x[0]);
  r.ticker=cands.find(c=>S.ativos.some(a=>a.ticker===c))||cands[0]||null;

  /* mês de referência */
  const mm=t.match(new RegExp('('+MESES_NOME.join('|')+')\\s*(?:de\\s*|/\\s*)?(20\\d{2})'));
  if(mm)r.ym=mm[2]+'-'+String(MESES_NOME.indexOf(mm[1])+1).padStart(2,'0');
  else{const m2=t.match(/(?:referencia|competencia|ref\.?)\s*:?\s*(\d{2})\/(20\d{2})/);if(m2)r.ym=m2[2]+'-'+m2[1]}

  /* rendimento (dividendo) por cota no mês */
  let m=primeiro(t,[
    new RegExp('(?:rendimento|dividendo|distribui\\w*|provento)s?[^\\n]{0,120}?r\\$\\s*'+NUM_BR+'\\s*(?:por cota|/cota|por acao)'),
    new RegExp('(?:rendimento|dividendo|distribui\\w*|provento)s?\\s*(?:por cota|/cota|por acao)[^\\n\\d]{0,40}r?\\$?\\s*'+NUM_BR),
    new RegExp('r\\$\\s*'+NUM_BR+'\\s*(?:por cota|/cota)[^\\n]{0,60}(?:rendimento|distribu|dividend|provento)'),
  ]);
  if(m){r.rendimento=numBR(m[1]);r.achados.push('rendimento')}

  /* valor patrimonial por cota (VP/cota ou VPA) */
  m=primeiro(t,[
    new RegExp('valor patrimonial\\s*(?:por cota|/cota|da cota|por acao)[^\\n\\d]{0,30}r?\\$?\\s*'+NUM_BR),
    new RegExp('(?<!p/)\\b(?:vp|vpa)\\s*(?:por cota|/cota)?\\s*[:=]?\\s*r\\$\\s*'+NUM_BR),
  ]);
  if(m){r.vp=numBR(m[1]);r.achados.push('vp')}
  else{
    const pl=t.match(new RegExp('patrimonio liquido[^\\n\\d]{0,30}r?\\$?\\s*'+NUM_BR));
    const qc=t.match(/(?:numero|quantidade|total) de cotas[^\n\d]{0,30}(\d{1,3}(?:\.\d{3})+|\d{4,})/);
    if(pl&&qc){const v=numBR(pl[1])/(+qc[1].replace(/\./g,''));if(isFinite(v)&&v>0){r.vp=Math.round(v*100)/100;r.achados.push('vp (PL ÷ cotas)')}}
  }

  /* cota / preço de fechamento */
  m=t.match(new RegExp('(?:cota de fechamento|cota de mercado|valor de mercado da cota|preco de fechamento|cotacao de fechamento|cota na b3)(?:\\s*(?:na|da)?\\s*\\(?b3\\)?)?[^\\n\\d]{0,30}r?\\$?\\s*'+NUM_BR));
  if(m){r.cota=numBR(m[1]);r.achados.push('cota')}

  /* lucro por ação (releases de resultado) */
  m=t.match(new RegExp('(?:lucro (?:liquido )?por acao|\\blpa\\b)[^\\n\\d-]{0,30}r?\\$?\\s*(-?'+NUM_BR.slice(1)));
  if(m){r.lpa=numBR(m[1]);r.achados.push('lpa')}

  /* informativos */
  m=t.match(/(?:dividend yield|\bdy\b)[^\n%]{0,60}?(\d{1,2},\d{1,2})\s*%/);if(m)r.dy=numBR(m[1])/100;
  m=t.match(/p\/vp[^\n\d]{0,10}(\d,\d{2})/);if(m)r.pvp=numBR(m[1]);
  return r;
}

/* ---------- interface ---------- */
function abrirImportRelatorio(tickerPadrao){
  sheet(`<h2>Importar relatório gerencial</h2>
  <div class="sh-sub">Relatório gerencial de FII ou release de resultados de ações, em PDF. Pode escolher <b>vários meses de uma vez</b> — com 12 meses eu calculo o DPA real dos últimos 12 meses.</div>
  <div class="fgroup"><label class="f" for="relArq">PDFs dos relatórios</label><input class="inp" type="file" id="relArq" accept=".pdf,.txt" multiple></div>
  <div class="fgroup"><label class="f" for="relTexto">Ou cole o texto de um relatório</label>
    <textarea class="inp" id="relTexto" placeholder="Ex.: O Fundo distribuiu rendimentos de R$ 0,95 por cota… Valor patrimonial por cota: R$ 118,42"></textarea></div>
  <div class="infobox" style="margin-bottom:var(--s3)">O PDF é lido aqui no navegador e não sai do computador. Eu procuro: <b>rendimento por cota</b>, <b>valor patrimonial por cota</b>, <b>LPA</b>, <b>cota de fechamento</b> e o <b>mês de referência</b>. Você confere tudo antes de gravar.</div>
  <button class="btn" id="relLer">Ler relatório</button>`);
  $('#relLer').onclick=async()=>{
    const arqs=[...$('#relArq').files], txt=$('#relTexto').value.trim();
    if(!arqs.length&&!txt){toast('Escolha o PDF ou cole o texto do relatório');return}
    const lidos=[];
    if(txt)lidos.push(parseRelatorio(txt,'texto colado'));
    $('#relLer').disabled=true;$('#relLer').textContent='Lendo…';
    for(const f of arqs){
      try{
        const r=f.name.toLowerCase().endsWith('.txt')?await f.text():(await lerTextoPDF(f)).texto;
        lidos.push(parseRelatorio(r,f.name));
      }catch(e){lidos.push({arquivo:f.name,erro:MSG_PDF[e.tipo]||MSG_PDF.pdf})}
    }
    lidos.forEach(r=>{if(!r.ticker&&tickerPadrao)r.ticker=tickerPadrao});
    conferirRelatorios(lidos);
  };
}
function conferirRelatorios(lidos){
  const tickers=[...new Set(S.ativos.filter(a=>a.ticker).map(a=>a.ticker))];
  const vMoney=v=>v==null?'':Number(v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:4});
  sheet(`<h2>Conferir relatórios</h2>
  <div class="sh-sub">${lidos.length} relatório${lidos.length>1?'s':''} · confira e corrija o que eu li. Campos vazios não mudam nada.</div>
  ${lidos.map((r,i)=>r.erro?`<div class="badbox" style="margin-bottom:var(--s3)"><b>${esc(r.arquivo)}</b><br>${esc(r.erro)}</div>`:`
  <div class="card flat" style="padding:var(--s3) var(--s4);margin-bottom:var(--s3)" data-rel="${i}">
    <h3 style="margin-bottom:var(--s2)"><span style="text-transform:none;letter-spacing:0;font-size:var(--t-sm);color:var(--ink-2)">${esc(r.arquivo)}</span>
      <span class="selo ${r.achados.length?'ok':'bad'}">${r.achados.length?r.achados.length+' dado'+(r.achados.length>1?'s':'')+' encontrado'+(r.achados.length>1?'s':''):'nada encontrado'}</span></h3>
    <div class="grid2">
      <div class="fgroup"><label class="f" for="rt${i}">Ativo (ticker)</label>
        <input class="inp" id="rt${i}" list="relTickers" autocapitalize="characters" value="${esc(r.ticker||'')}" placeholder="Ex.: GARE11"></div>
      <div class="fgroup"><label class="f" for="rm${i}">Mês de referência</label><input class="inp" id="rm${i}" type="month" value="${r.ym||''}"></div>
      <div class="fgroup"><label class="f" for="rr${i}">Rendimento por cota (R$)</label><input class="inp" id="rr${i}" inputmode="decimal" value="${vMoney(r.rendimento)}" placeholder="não achei"></div>
      <div class="fgroup"><label class="f" for="rv${i}">VP por cota / VPA (R$)</label><input class="inp" id="rv${i}" inputmode="decimal" value="${vMoney(r.vp)}" placeholder="não achei"></div>
      <div class="fgroup"><label class="f" for="rl${i}">LPA (R$, ações)</label><input class="inp" id="rl${i}" inputmode="decimal" value="${vMoney(r.lpa)}" placeholder="não achei"></div>
      <div class="fgroup"><label class="f" for="rc${i}">Cota de fechamento (R$)</label><input class="inp" id="rc${i}" inputmode="decimal" value="${vMoney(r.cota)}" placeholder="não achei"></div>
    </div>
    ${r.dy!=null||r.pvp!=null?`<div class="hint">No relatório: ${r.dy!=null?'DY '+pct(r.dy,1):''}${r.dy!=null&&r.pvp!=null?' · ':''}${r.pvp!=null?'P/VP '+r.pvp.toLocaleString('pt-BR'):''}</div>`:''}
  </div>`).join('')}
  <datalist id="relTickers">${tickers.map(t=>`<option value="${esc(t)}">`).join('')}</datalist>
  ${lidos.some(r=>!r.erro)?'<button class="btn" id="relSalvar">Salvar e calcular preço teto</button>':'<button class="btn ghost" data-close>Fechar</button>'}`);
  $('#relSalvar')?.addEventListener('click',()=>{
    const afetados=new Set();let n=0;
    for(const[i,r]of lidos.entries()){
      if(r.erro)continue;
      const ticker=limparTicker($('#rt'+i).value);
      if(!ticker){toast('Informe o ticker do relatório '+(i+1));$('#rt'+i).focus();return}
      const ym=$('#rm'+i).value;
      const val=id=>{const v=parseNumero($(id).value);return isFinite(v)&&v>0?Math.round(v*10000)/100:null}; /* centavos, até 2 casas */
      const rend=val('#rr'+i), vp=val('#rv'+i), cota=val('#rc'+i);
      const lpaV=parseNumero($('#rl'+i).value), lpa=isFinite(lpaV)?Math.round(lpaV*100):null;
      if(rend&&!ym){toast('Informe o mês de referência do relatório '+(i+1));$('#rm'+i).focus();return}
      let a=S.ativos.find(x=>x.ticker===ticker);
      if(!a){a={id:uid(),nome:ticker,valor:0,classe:mapClasse('',ticker),ticker};S.ativos.push(a)}
      if(rend&&ym){a.rendimentos={...(a.rendimentos||{}),[ym]:rend}}
      if(vp)a.vpa=Math.round(vp);
      if(lpa!==null&&lpa!==0)a.lpa=lpa;
      if(cota&&ym){const[y,mo]=ym.split('-').map(Number);aplicarCotacao(a,{preco:cota/100,variacao:a.variacao||0,quando:new Date(Date.UTC(y,mo,0,21)).toISOString(),fonte:'relatorio'})}
      if(ym)a.relatorios=[...(a.relatorios||[]).filter(x=>x.ym!==ym),{ym,arquivo:r.arquivo,em:new Date().toISOString()}].sort((x,y)=>x.ym.localeCompare(y.ym)).slice(-36);
      recalcularDPA(a);afetados.add(a.id);n++;
    }
    salvar();render();
    toast(n+' relatório'+(n>1?'s':'')+' importado'+(n>1?'s':''));
    if(afetados.size===1)abrirAtivo([...afetados][0]);else fecharSheet();
  });
}
/* DPA dos últimos 12 meses a partir do histórico de rendimentos */
function recalcularDPA(a){
  const r=a.rendimentos||{};
  const meses=Object.keys(r).sort().slice(-12);
  if(!meses.length)return;
  const soma=meses.reduce((s,m)=>s+(+r[m]||0),0);
  if(ehFII(a)){ /* FIIs pagam todo mês: com menos de 12 meses, média × 12 */
    a.dpa=Math.round(meses.length>=12?soma:soma/meses.length*12);
    a.dpaFonte={meses:meses.length,estimado:meses.length<12};
  }else if(diffMesesYM(meses[0],ymNow())>=11){ /* ações: só com 12 meses de histórico */
    a.dpa=Math.round(soma);a.dpaFonte={meses:meses.length,estimado:false};
  }
}
