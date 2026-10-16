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

/* ---------- leitura por posição (tabelas: rótulo em cima, valor embaixo) ----------
   Cada item do PDF tem x, y, largura e altura. Para um rótulo, procura o número
   mais perto ABAIXO dele na mesma coluna (ou logo à direita, na mesma linha). */
const RE_NUM=/-?\d{1,3}(?:\.\d{3})*,\d{1,4}|-?\d+,\d{1,4}/g;
function tokensNumero(it){
  const out=[], s=it.s, n=s.length||1;
  for(const m of s.matchAll(RE_NUM)){
    const ini=m.index, fim=ini+m[0].length, depois=semAcento(s.slice(fim,fim+12));
    out.push({v:numBR(m[0]),cx:it.x+it.w*((ini+fim)/2/n),y:it.y,
      pct:/^\s*%/.test(depois),grande:/^\s*(bi|bilh|mi|milh|mil\b|mm\b|k\b)/.test(depois)||/(bilh|milh)/.test(semAcento(s))});
  }
  return out;
}
function porLayout(itensPaginas,reRotulo,{min=0,max=Infinity,naoPct=true}={}){
  if(!itensPaginas)return null;
  for(const [pg,itens] of itensPaginas.entries()){
    const nums=itens.flatMap(tokensNumero).filter(t=>t.v>=min&&t.v<=max&&!t.grande&&!(naoPct&&t.pct));
    if(!nums.length)continue;
    for(const it of itens){
      const t=semAcento(it.s), m=t.match(reRotulo);
      if(!m)continue;
      const n=t.length||1, lx=it.x+it.w*(m.index/n), lw=Math.max(it.w*(m[0].length/n),30), lcx=lx+lw/2;
      let melhor=null;
      for(const c of nums){
        const dy=it.y-c.y;                         /* positivo = abaixo do rótulo */
        const naColuna=dy>1&&dy<=Math.max(70,it.h*6)&&c.cx>=lx-25&&c.cx<=lx+lw+25;
        const aDireita=Math.abs(dy)<=2&&c.cx>lx+lw&&c.cx<lx+lw+220;
        if(!naColuna&&!aDireita)continue;
        const custo=naColuna?dy+Math.abs(c.cx-lcx)*.25:(c.cx-lx-lw)*.5+5;
        if(!melhor||custo<melhor.custo)melhor={v:c.v,custo,pagina:pg+1};
      }
      if(melhor)return melhor;
    }
  }
  return null;
}
/* mês de referência: o "mês/ano" que mais se repete (o cabeçalho de cada página) */
const MES_ABR=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
function mesReferencia(t){
  const cont={};let ordem=0;
  const re=/\b(jan(?:eiro)?|fev(?:ereiro)?|mar(?:co)?|abr(?:il)?|mai(?:o)?|jun(?:ho)?|jul(?:ho)?|ago(?:sto)?|set(?:embro)?|out(?:ubro)?|nov(?:embro)?|dez(?:embro)?)\.?\s*(?:de\s+|\/\s*|-\s*)?((?:20)?\d{2})\b/g;
  for(const m of t.matchAll(re)){
    let a=+m[2];if(a<100)a+=2000;if(a<2015||a>2035)continue;
    const ym=a+'-'+String(MES_ABR.indexOf(m[1].slice(0,3))+1).padStart(2,'0');
    if(!cont[ym])cont[ym]={n:0,ordem:ordem++};
    cont[ym].n+=m[1].length>3?1.2:1;             /* nome completo pesa um pouco mais */
  }
  const lista=Object.entries(cont).sort((a,b)=>b[1].n-a[1].n||a[1].ordem-b[1].ordem);
  if(lista.length)return lista[0][0];
  const m2=t.match(/(?:referencia|competencia|ref\.?)\s*:?\s*(\d{2})\/(20\d{2})/);
  return m2?m2[2]+'-'+m2[1]:null;
}
/* linha "distribuição por cota" com 12 meses e o total no fim → DPA 12 meses */
function dpaDaTabela(bruto){
  for(const linha of bruto.split('\n')){
    const t=semAcento(linha);
    if(!/^(?:distribuicao|rendimento|dividendo|provento)s?\s*(?:distribuid[oa]s?\s*)?(?:por cota|\/cota)/.test(t))continue;
    const v=[...linha.matchAll(/(?<![\d.,])\d+,\d{2,4}(?![\d.,])/g)].map(x=>numBR(x[0]));
    if(v.length<13)continue;
    const doze=v.slice(-13,-1), total=v[v.length-1], soma=doze.reduce((a,b)=>a+b,0);
    if(total>0&&Math.abs(soma-total)/total<.03&&doze.every(x=>x>0&&x<50))return{dpa:total,meses:doze};
  }
  return null;
}

function parseRelatorio(texto,nomeArquivo='',itensPaginas=null){
  const bruto=String(texto||'');
  const t=semAcento(bruto).replace(/[ \t]+/g,' ');
  const r={arquivo:nomeArquivo,ticker:null,ym:null,rendimento:null,vp:null,cota:null,lpa:null,dy:null,pvp:null,dpa12:null,achados:[]};
  const achou=(campo,v,como)=>{r[campo]=v;r.achados.push(campo+(como?' ('+como+')':''))};

  /* ticker: o código que mais aparece (prefere um que já está na carteira) */
  const cont={};
  for(const m of (bruto+' '+nomeArquivo.toUpperCase()).matchAll(/\b([A-Za-z]{4}(?:11|3|4|5|6|33|34|35))\b/g)){
    const k=m[1].toUpperCase();if(/^[A-Z]/.test(m[1]))cont[k]=(cont[k]||0)+1;
  }
  const cands=Object.entries(cont).sort((a,b)=>b[1]-a[1]).map(x=>x[0]);
  r.ticker=cands.find(c=>S.ativos.some(a=>a.ticker===c))||cands[0]||null;
  r.ym=mesReferencia(t);

  /* rendimento por cota do mês: frase do texto, senão tabela */
  let m=primeiro(t,[
    new RegExp('(?:rendimento|dividendo|distribui\\w*|provento)s?[^\\n]{0,120}?r\\$\\s*'+NUM_BR+'\\s*,?\\s*(?:por cota|/cota|por acao)'),
    new RegExp('(?:rendimento|dividendo|distribui\\w*|provento)s?\\s*(?:distribuid[oa]s?\\s*)?(?:por cota|/cota|por acao)[^\\n\\d]{0,40}r?\\$?\\s*'+NUM_BR),
    new RegExp('r\\$\\s*'+NUM_BR+'\\s*,?\\s*(?:por cota|/cota)[^\\n]{0,60}(?:rendimento|distribu|dividend|provento)'),
  ]);
  if(m&&numBR(m[1])>0&&numBR(m[1])<50)achou('rendimento',numBR(m[1]));
  else{const l=porLayout(itensPaginas,/dividendo (?:distribuido|pago|do mes|[a-z]{3}\/\d{2})|rendimento (?:distribuido|do mes|por cota)|distribuicao (?:por cota|do mes)/,{min:.001,max:50});
    if(l)achou('rendimento',l.v,'tabela, pág. '+l.pagina)}

  /* valor patrimonial POR COTA (não confundir com o PL total) */
  m=primeiro(t,[
    new RegExp('(?:valor patrimonial|cota patrimonial)\\s*(?:da cota|por cota|/cota|cota|por acao)?\\s*(?:\\(vp\\))?\\s*[:=]?\\s*(?:de\\s*)?r\\$\\s*'+NUM_BR),
    new RegExp('(?<!p/)\\b(?:vp|vpa)\\s*(?:por cota|/cota)\\s*[:=]?\\s*r?\\$?\\s*'+NUM_BR),
  ]);
  if(m&&numBR(m[1])>.5&&numBR(m[1])<10000&&!/(bilh|milh)/.test(t.slice(m.index,m.index+m[0].length+12)))achou('vp',numBR(m[1]));
  else{const l=porLayout(itensPaginas,/valor patrimonial (?:da |por |de )?cota|cota patrimonial|valor patrimonial cota|vp ?(?:\/|por) ?cota|\bvpa\b/,{min:.5,max:10000});
    if(l)achou('vp',l.v,'tabela, pág. '+l.pagina)}

  /* cota de mercado / fechamento */
  m=primeiro(t,[
    new RegExp('(?:cota de fechamento|cota de mercado|valor de mercado da cota|preco de fechamento|cotacao de fechamento|cota na b3)(?:\\s*(?:na|da)?\\s*\\(?b3\\)?)?[^\\n\\d]{0,30}r\\$\\s*'+NUM_BR),
    new RegExp('cota (?:do fundo )?(?:encerrou|fechou)[^\\n]{0,80}?r\\$\\s*'+NUM_BR),
  ]);
  if(m&&numBR(m[1])>.5)achou('cota',numBR(m[1]));
  else{const l=porLayout(itensPaginas,/valor de mercado da cota|preco (?:da )?cota|cota de fechamento|cotacao de fechamento|cota de mercado|preco de fechamento/,{min:.5,max:10000});
    if(l)achou('cota',l.v,'tabela, pág. '+l.pagina)}

  /* lucro por ação (releases de resultado) */
  m=t.match(new RegExp('(?:lucro (?:liquido )?por acao|\\blpa\\b)[^\\n\\d-]{0,30}r?\\$?\\s*(-?'+NUM_BR.slice(1)));
  if(m)achou('lpa',numBR(m[1]));

  /* P/VP e DY (informativos; P/VP ajuda a achar o VP quando falta) */
  m=t.match(/p\/vp[^\n\d]{0,12}(\d,\d{2})/);
  if(m)r.pvp=numBR(m[1]);else{const l=porLayout(itensPaginas,/p\/vp/,{min:.2,max:3});if(l)r.pvp=l.v}
  if(!r.vp&&r.pvp&&r.cota){r.vp=Math.round(r.cota/r.pvp*100)/100;r.achados.push('vp (cota ÷ P/VP)')}
  m=t.match(/(?:dividend yield|\bdy\b)[^\n%]{0,60}?(\d{1,2},\d{1,2})\s*%/);if(m)r.dy=numBR(m[1])/100;

  /* DPA dos últimos 12 meses quando o relatório traz a tabela completa */
  const d=dpaDaTabela(bruto);
  if(d){r.dpa12=d.dpa;r.achados.push('DPA 12 meses');if(!r.rendimento)achou('rendimento',d.meses[d.meses.length-1],'tabela')}
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
        if(f.name.toLowerCase().endsWith('.txt'))lidos.push(parseRelatorio(await f.text(),f.name));
        else{const pdf=await lerTextoPDF(f);lidos.push(parseRelatorio(pdf.texto,f.name,pdf.itens))}
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
      <span class="selo ${r.achados.length>=2?'ok':r.achados.length?'neutral':'bad'}">${r.achados.length?r.achados.length+' dado'+(r.achados.length>1?'s':'')+' encontrado'+(r.achados.length>1?'s':''):'nada encontrado'}</span></h3>
    <div class="grid2">
      <div class="fgroup"><label class="f" for="rt${i}">Ativo (ticker)</label>
        <input class="inp" id="rt${i}" list="relTickers" autocapitalize="characters" value="${esc(r.ticker||'')}" placeholder="Ex.: GARE11"></div>
      <div class="fgroup"><label class="f" for="rm${i}">Mês de referência</label><input class="inp" id="rm${i}" type="month" value="${r.ym||''}"></div>
      <div class="fgroup"><label class="f" for="rr${i}">Rendimento por cota (R$)</label><input class="inp" id="rr${i}" inputmode="decimal" value="${vMoney(r.rendimento)}" placeholder="não achei"></div>
      <div class="fgroup"><label class="f" for="rv${i}">VP por cota / VPA (R$)</label><input class="inp" id="rv${i}" inputmode="decimal" value="${vMoney(r.vp)}" placeholder="não achei"></div>
      <div class="fgroup"><label class="f" for="rl${i}">LPA (R$, ações)</label><input class="inp" id="rl${i}" inputmode="decimal" value="${vMoney(r.lpa)}" placeholder="não achei"></div>
      <div class="fgroup"><label class="f" for="rc${i}">Cota de fechamento (R$)</label><input class="inp" id="rc${i}" inputmode="decimal" value="${vMoney(r.cota)}" placeholder="não achei"></div>
      <div class="fgroup"><label class="f" for="rd${i}">DPA 12 meses (R$, se o relatório trouxer)</label><input class="inp" id="rd${i}" inputmode="decimal" value="${vMoney(r.dpa12)}" placeholder="eu calculo pelo histórico"></div>
    </div>
    ${r.achados.length?`<div class="hint">Encontrei: ${r.achados.map(esc).join(' · ')}${r.dy!=null?' · DY '+pct(r.dy,2):''}${r.pvp!=null?' · P/VP '+r.pvp.toLocaleString('pt-BR'):''}</div>`:''}
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
      recalcularDPA(a);
      const d12=val('#rd'+i);
      if(d12){a.dpa=Math.round(d12);a.dpaFonte={meses:12,estimado:false,relatorio:true}}
      afetados.add(a.id);n++;
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
