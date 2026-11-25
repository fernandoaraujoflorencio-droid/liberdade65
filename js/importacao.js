/* =====================================================================
   LIBERDADE 65 — importação de faturas (Nubank CSV/XLSX, texto do PDF, OFX)
   ===================================================================== */
const MESABR={jan:1,fev:2,mar:3,abr:4,mai:5,jun:6,jul:7,ago:8,set:9,out:10,nov:11,dez:12};
function normDesc(s){return String(s).replace(/\s+/g,' ').trim()}
function chaveEstab(desc){
  return normDesc(desc).toLowerCase()
    .replace(/\s*-?\s*parcela\s*\d+\s*\/\s*\d+/i,'')
    .replace(/[^a-zà-ú0-9 *]/gi,'').replace(/\s+/g,' ').trim().slice(0,28);
}
function detectaParcela(desc){
  let m=desc.match(/parcela\s*(\d{1,2})\s*[\/de ]{1,4}\s*(\d{1,2})/i)||desc.match(/\b(\d{1,2})\s*\/\s*(\d{1,2})\b(?!\d)/);
  if(!m)return null;
  const n=+m[1],de=+m[2];
  if(de<2||de>72||n<1||n>de)return null;
  return{n,de};
}
function classifica(desc){
  const k=chaveEstab(desc);
  if(S.aprendizado[k])return S.aprendizado[k];
  for(const[cat,re]of REGRAS_PADRAO) if(re.test(desc))return cat;
  return 'outros';
}
/* --- parsers --- */
function parseLinhas(texto){
  const out=[],linhas=String(texto).split(/\r?\n/);
  const reNu=/^(\d{1,2})\s+(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\s+(?:•+\s*\d{4}\s+)?(.+?)\s+(−|-)?R\$\s*([\d.,]+)\s*$/i;
  const reISO=/^(\d{4}-\d{2}-\d{2})[;,\t]\s*(.+?)[;,\t]\s*(-?[\d.,]+)\s*$/;
  const reBR=/^(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)[;,\t]?\s+(.+?)\s+(-?R?\$?\s*[\d.,]+)\s*$/;
  for(let ln of linhas){
    ln=ln.trim(); if(!ln||ln.length<6)continue;
    if(/^(total|fatura|pagamento recebido|pagamentos|créditos|encargos|juros|iof de|multa|limite|saldo|resumo|transações|período|valor máximo|valor total|em cumprimento|como assegurado|o nubank|próxima fatura|próximas faturas|\d+ de \d+)/i.test(ln))continue;
    let m;
    if((m=ln.match(reNu))){
      const dia=+m[1],mes=MESABR[m[2].toLowerCase()],desc=normDesc(m[3]),neg=!!m[4],v=parseMoney(m[5]);
      out.push({dia,mes,desc,valor:neg?-v:v}); continue;
    }
    if((m=ln.match(reISO))){out.push({iso:m[1],desc:normDesc(m[2]),valor:parseMoney(m[3])});continue}
    if((m=ln.match(reBR))){
      const p=m[1].split('/'); out.push({dia:+p[0],mes:+p[1],ano:p[2]?(p[2].length===2?2000+ +p[2]:+p[2]):null,desc:normDesc(m[2]),valor:parseMoney(m[3])});continue}
  }
  return out;
}
function parseCSV(texto){
  const linhas=String(texto).split(/\r?\n/).filter(l=>l.trim());
  if(!linhas.length)return[];
  const sep=[',',';','\t'].map(s=>({s,n:(linhas[0].split(s).length)})).sort((a,b)=>b.n-a.n)[0];
  if(sep.n<2)return parseLinhas(texto);
  const split=l=>{const o=[];let cur='',q=false;
    for(const ch of l){ if(ch==='"'){q=!q} else if(ch===sep.s&&!q){o.push(cur);cur=''} else cur+=ch }
    o.push(cur);return o.map(x=>x.trim().replace(/^"|"$/g,''))};
  const head=split(linhas[0]).map(h=>h.toLowerCase());
  const iD=head.findIndex(h=>/^(date|data|dt)/.test(h));
  const iT=head.findIndex(h=>/(title|desc|hist|estabelec|lanç|lanc|memo|nome)/.test(h));
  const iV=head.findIndex(h=>/(amount|valor|value|vlr|montante)/.test(h));
  if(iD<0||iV<0)return parseLinhas(texto);
  const out=[];
  for(const l of linhas.slice(1)){
    const c=split(l); if(c.length<2)continue;
    const raw=c[iD],desc=normDesc(iT>=0?c[iT]:'Lançamento'),valor=parseMoney(c[iV]);
    if(!valor)continue;
    let iso=null,dia=null,mes=null,ano=null;
    if(/^\d{4}-\d{2}-\d{2}/.test(raw))iso=raw.slice(0,10);
    else{const p=raw.split(/[\/\-]/);if(p.length>=2){dia=+p[0];mes=+p[1];ano=p[2]?(p[2].length===2?2000+ +p[2]:+p[2]):null}}
    out.push(iso?{iso,desc,valor}:{dia,mes,ano,desc,valor});
  }
  return out;
}
/* transforma linhas cruas em transações do app */
function montarImportacao(linhas,{competencia,cartaoId,sinal=-1}){
  const anoRef=+competencia.slice(0,4), mesRef=+competencia.slice(5,7);
  const res=[];
  for(const l of linhas){
    let iso=l.iso;
    if(!iso){
      let ano=l.ano;
      if(!ano){ ano=anoRef; if(l.mes>mesRef+1)ano=anoRef-1; if(l.mes<mesRef-6)ano=anoRef; }
      if(!l.mes||!l.dia)continue;
      iso=`${ano}-${String(l.mes).padStart(2,'0')}-${String(l.dia).padStart(2,'0')}`;
    }
    const p=detectaParcela(l.desc);
    const ehPagamento=/pagamento (em|recebido)|estorno|crédito de/i.test(l.desc);
    if(ehPagamento)continue;
    const bruto=Math.abs(l.valor);
    if(!bruto)continue;
    const valor=(l.valor<0?-1:1)*sinal*bruto;
    res.push({id:uid(),data:iso,competencia,desc:normDesc(l.desc.replace(/\s*-\s*parcela\s*\d+\s*\/\s*\d+/i,'')),
      valor,catId:classifica(l.desc),cartaoId,parcelaN:p?p.n:1,parcelaDe:p?p.de:1,origem:'fatura',grupo:p?chaveEstab(l.desc)+'|'+p.de+'|'+bruto:null});
  }
  return res;
}
/* gera as parcelas futuras que ainda vão cair em faturas seguintes */
function projetarParcelas(txs){
  const novas=[];
  for(const t of txs){
    if(t.parcelaDe>1&&t.parcelaN<t.parcelaDe){
      for(let k=t.parcelaN+1;k<=t.parcelaDe;k++){
        const comp=addMonthYM(t.competencia,k-t.parcelaN);
        const ch=chaveEstab(t.desc);
        const dupe=x=>(x.cartaoId||null)===(t.cartaoId||null)&&x.parcelaN===k&&(x.parcelaDe||1)===t.parcelaDe&&Math.abs(diffMesesYM(x.competencia,comp))<=1&&tolValor(x.valor,t.valor)&&chaveEstab(x.desc)===ch;
        if(S.transacoes.some(dupe)||novas.some(dupe))continue;
        novas.push({...t,id:uid(),competencia:comp,data:comp+'-'+t.data.slice(8),parcelaN:k,futura:true});
      }
    }
  }
  return novas;
}

/* ---------- fluxo de importação ---------- */
let impLinhas=null;
function lerArquivo(f){
  if(!f)return;
  const nome=f.name.toLowerCase();
  if(nome.endsWith('.xlsx')||nome.endsWith('.xls')){lerXLSX(f);return}
  if(nome.endsWith('.pdf')){
    toast('Lendo o PDF…');
    lerPdfComSenha(f,({texto,paginas})=>{
      $('#impTexto').value=texto.slice(0,200000);
      const cartao=S.cartoes.find(c=>c.id===$('#impCartao')?.value), ciclo=detectarCiclo(texto,cartao);
      if(ciclo&&$('#impMes')){$('#impMes').value=ciclo.ym}
      toast('PDF lido: '+paginas.length+' página'+(paginas.length>1?'s':'')+(ciclo?' · fatura de '+ymLabel(ciclo.ym)+' ('+ciclo.como+')':'')+' — conferindo lançamentos');
      importar();
    });
    return;
  }
  const r=new FileReader();
  r.onload=()=>{$('#impTexto').value=r.result.slice(0,200000);toast('Arquivo lido — confira e toque em Ler lançamentos')};
  r.readAsText(f,'utf-8');
}
/* leitor xlsx mínimo: inflate raw do zip + sharedStrings */
async function lerXLSX(f){
  try{
    const buf=new Uint8Array(await f.arrayBuffer());
    const files=unzip(buf);
    const dec=b=>new TextDecoder().decode(b);
    const shared=[];
    if(files['xl/sharedStrings.xml']){
      const x=dec(files['xl/sharedStrings.xml']);
      for(const m of x.matchAll(/<si>([\s\S]*?)<\/si>/g)){
        shared.push([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t=>desentity(t[1])).join(''));
      }
    }
    const sh=Object.keys(files).find(k=>/xl\/worksheets\/sheet1?\.xml/.test(k))||Object.keys(files).find(k=>k.startsWith('xl/worksheets/'));
    if(!sh){toast('Planilha vazia ou fora do padrão');return}
    const xml=dec(files[sh]); const linhas=[];
    for(const row of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)){
      const cels=[];
      for(const c of row[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)){
        const attrs=c[1], vm=c[2].match(/<v>([\s\S]*?)<\/v>/);
        let val=vm?vm[1]:'';
        if(/t="s"/.test(attrs))val=shared[+val]??'';
        else if(/t="str"/.test(attrs))val=desentity(val);
        else if(vm&&/^\d+(\.\d+)?$/.test(val)){
          const n=+val;
          if(n>40000&&n<70000){const d=new Date(Date.UTC(1899,11,30)+n*86400000);val=d.toISOString().slice(0,10)}
        }
        cels.push(val);
      }
      if(cels.length)linhas.push(cels);
    }
    const csv=linhas.map(l=>l.map(v=>/[,"]/.test(v)?'"'+String(v).replace(/"/g,'""')+'"':v).join(',')).join('\n');
    $('#impTexto').value=csv;
    toast(linhas.length-1+' linhas lidas do Excel — toque em Ler lançamentos');
  }catch(e){toast('Não consegui ler este Excel — exporte como CSV e tente de novo')}
}
function desentity(s){return s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&')}
/* unzip: aceita STORED e DEFLATE (via DecompressionStream) — síncrono p/ stored, async p/ deflate */
function unzip(buf){
  const files={}, dv=new DataView(buf.buffer,buf.byteOffset,buf.byteLength);
  let i=0;
  while(i+30<=buf.length){
    if(dv.getUint32(i,true)!==0x04034b50)break;
    const method=dv.getUint16(i+8,true), flags=dv.getUint16(i+6,true);
    let csize=dv.getUint32(i+18,true);
    const nlen=dv.getUint16(i+26,true), elen=dv.getUint16(i+28,true);
    const name=new TextDecoder().decode(buf.subarray(i+30,i+30+nlen));
    let dataStart=i+30+nlen+elen;
    if(flags&8){ /* data descriptor: procura assinatura do próximo header */
      let j=dataStart;
      while(j<buf.length-4&&dv.getUint32(j,true)!==0x08074b50&&dv.getUint32(j,true)!==0x04034b50&&dv.getUint32(j,true)!==0x02014b50)j++;
      csize=j-dataStart;
      if(dv.getUint32(j,true)===0x08074b50)j+=16; 
      i=j;
    } else i=dataStart+csize;
    const raw=buf.subarray(dataStart,dataStart+csize);
    files[name]=method===0?raw:inflateRaw(raw);
  }
  return files;
}
/* inflate raw (DEFLATE) — implementação compacta */
function inflateRaw(data){
  let pos=0,bit=0;const out=[];
  const rb=n=>{let v=0;for(let k=0;k<n;k++){v|=((data[pos]>>bit)&1)<<k;bit++;if(bit===8){bit=0;pos++}}return v};
  const build=(lens)=>{const cnt=[],code=[],map=new Map();const max=Math.max(...lens,0);
    for(let l=1;l<=max;l++)cnt[l]=0; lens.forEach(l=>{if(l)cnt[l]=(cnt[l]||0)+1});
    let c=0;for(let l=1;l<=max;l++){c=(c+(cnt[l-1]||0))<<1;code[l]=c}
    lens.forEach((l,s)=>{if(l){map.set(l+'|'+(code[l]++),s)}});
    return{map,max}};
  const decode=h=>{let c=0;for(let l=1;l<=h.max;l++){c=(c<<1)|rb(1);const s=h.map.get(l+'|'+c);if(s!==undefined)return s}throw 0};
  const LB=[3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258];
  const LE=[0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
  const DB=[1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577];
  const DE=[0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];
  while(true){
    const fim=rb(1),tipo=rb(2);
    if(tipo===0){if(bit){bit=0;pos++}const len=data[pos]|(data[pos+1]<<8);pos+=4;
      for(let k=0;k<len;k++)out.push(data[pos++]);}
    else{
      let hl,hd;
      if(tipo===1){
        const l=[];for(let s=0;s<144;s++)l.push(8);for(let s=144;s<256;s++)l.push(9);for(let s=256;s<280;s++)l.push(7);for(let s=280;s<288;s++)l.push(8);
        hl=build(l);hd=build(Array(30).fill(5));
      }else{
        const hlit=rb(5)+257,hdist=rb(5)+1,hclen=rb(4)+4;
        const ord=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];
        const cl=Array(19).fill(0);for(let k=0;k<hclen;k++)cl[ord[k]]=rb(3);
        const hc=build(cl);const lens=[];
        while(lens.length<hlit+hdist){
          const s=decode(hc);
          if(s<16)lens.push(s);
          else if(s===16){const r=3+rb(2),p=lens[lens.length-1];for(let k=0;k<r;k++)lens.push(p)}
          else if(s===17){const r=3+rb(3);for(let k=0;k<r;k++)lens.push(0)}
          else{const r=11+rb(7);for(let k=0;k<r;k++)lens.push(0)}
        }
        hl=build(lens.slice(0,hlit));hd=build(lens.slice(hlit));
      }
      while(true){
        const s=decode(hl);
        if(s===256)break;
        if(s<256)out.push(s);
        else{const li=s-257;const len=LB[li]+rb(LE[li]);const ds=decode(hd);const dist=DB[ds]+rb(DE[ds]);
          const start=out.length-dist;for(let k=0;k<len;k++)out.push(out[start+k]);}
      }
    }
    if(fim)break;
  }
  return Uint8Array.from(out);
}

/* ---------- ciclo da fatura lido do próprio texto ----------
   "TRANSAÇÕES DE 29 AGO A 28 SET" → ciclo = mês do fechamento (set);
   senão, pela data de vencimento e os dias do cartão. */
const MES_TXT={jan:1,fev:2,mar:3,abr:4,mai:5,jun:6,jul:7,ago:8,set:9,out:10,nov:11,dez:12};
function anoMaisCitado(t){
  const c={};for(const m of t.matchAll(/\b(20[2-3]\d)\b/g))c[m[1]]=(c[m[1]]||0)+1;
  const l=Object.entries(c).sort((a,b)=>b[1]-a[1]);return l.length?+l[0][0]:+ymNow().slice(0,4);
}
function detectarCiclo(texto,cartao){
  const t=semAcento(texto);
  const ano=anoMaisCitado(t);
  let venc=null,m=t.match(/venc\w*[^\d\n]{0,40}(\d{1,2})\s*(?:de\s+|\/|\s)\s*(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez|\d{1,2})[a-z]*\.?\s*(?:de\s+|\/|\s)\s*(20\d{2})/);
  if(m){const mes=MES_TXT[m[2]]||+m[2];if(mes>=1&&mes<=12)venc={ym:m[3]+'-'+String(mes).padStart(2,'0'),dia:+m[1]}}
  m=t.match(/transac\w*\s+de\s+\d{1,2}\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*\.?\s+a\s+\d{1,2}\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)/);
  if(m){
    let a=venc?+venc.ym.slice(0,4):ano;const fim=MES_TXT[m[2]];
    if(venc&&fim>+venc.ym.slice(5))a--;                         /* fecha em dezembro, vence em janeiro */
    return{ym:a+'-'+String(fim).padStart(2,'0'),como:'período da fatura'};
  }
  if(venc){
    const fech=cartao?.fechamento||29, vdia=cartao?.vencimento||venc.dia;
    return{ym:vdia<fech?addMonthYM(venc.ym,-1):venc.ym,como:'vencimento '+String(venc.dia).padStart(2,'0')+'/'+venc.ym.slice(5)+'/'+venc.ym.slice(0,4)};
  }
  return null;
}

/* ---------- classificação de cada compra lida ---------- */
const tolValor=(a,b)=>Math.abs(a-b)<=Math.max(15,Math.abs(b)*.03);   /* parcelas variam alguns centavos */
function classificarImport(novas,cartaoId){
  const doCartao=S.transacoes.filter(t=>(t.cartaoId||null)===(cartaoId||null));
  const vistos=new Map(), usados=new Set(), out=[];
  for(const t of novas){
    const ch=chaveEstab(t.desc), p=t.parcelaN||1, pd=t.parcelaDe||1;
    const chArq=t.data+'|'+ch+'|'+t.valor+'|'+p+'/'+pd;
    if(vistos.has(chArq)){out.push({t,status:'repetida'});continue}
    vistos.set(chArq,1);
    /* já lançada: mesma data, estabelecimento, valor e parcela — em qualquer mês */
    const ja=doCartao.find(x=>!usados.has(x.id)&&!x.futura&&chaveEstab(x.desc)===ch&&(x.parcelaN||1)===p&&(x.parcelaDe||1)===pd
      &&Math.abs(x.valor-t.valor)<=2&&(x.data===t.data||(pd>1&&x.competencia===t.competencia)));
    if(ja){usados.add(ja.id);out.push({t,status:'ja',alvo:ja});continue}
    /* parcela que o app já tinha previsto: troca a prevista pela real (sem duplicar) */
    if(pd>1){
      const prev=doCartao.find(x=>!usados.has(x.id)&&x.futura&&chaveEstab(x.desc)===ch&&(x.parcelaN||1)===p&&(x.parcelaDe||1)===pd
        &&Math.abs(diffMesesYM(x.competencia,t.competencia))<=1&&tolValor(x.valor,t.valor));
      if(prev){usados.add(prev.id);out.push({t,status:'substitui',alvo:prev});continue}
    }
    out.push({t,status:'nova'});
  }
  return out;
}

function importar(){
  const texto=$('#impTexto').value.trim();
  if(!texto){toast('Escolha um arquivo ou cole o conteúdo da fatura');return}
  let linhas=texto.includes('<OFX')||texto.includes('OFXHEADER')?parseOFX(texto)
    :(texto.split('\n')[0].split(/[,;\t]/).length>=2&&/date|data|title|amount|valor|desc/i.test(texto.split('\n')[0])?parseCSV(texto):parseLinhas(texto));
  if(!linhas.length){toast('Não reconheci nenhum lançamento — confira o formato');return}
  const competencia=$('#impMes').value||ymNow(), cartaoId=$('#impCartao').value||null;
  if(!cartaoId){toast('Cadastre um cartão antes de importar a fatura');return}
  const novas=montarImportacao(linhas,{competencia,cartaoId});
  impLinhas={itens:classificarImport(novas,cartaoId),competencia,cartaoId,arquivo:$('#impArq')?.files?.[0]?.name||'texto colado'};
  revisarImportacao();
}

/* ---------- desfazer uma importação ---------- */
function importacoes(){if(!Array.isArray(S.importacoes))S.importacoes=[];return S.importacoes}
function desfazerImportacao(id){
  const imp=importacoes().find(x=>x.id===id);if(!imp)return;
  const ids=new Set(imp.ids||[]);
  S.transacoes=S.transacoes.filter(t=>!ids.has(t.id)&&t.importId!==id);
  for(const s of imp.substituidas||[]){const t=S.transacoes.find(x=>x.id===s.id);if(t)Object.assign(t,s.antes)}
  S.importacoes=importacoes().filter(x=>x.id!==id);
  salvar();fecharSheet();render();toast('Importação desfeita: '+(imp.ids||[]).length+' lançamentos removidos'+((imp.substituidas||[]).length?', '+imp.substituidas.length+' parcelas previstas restauradas':''));
}

/* ---------- lançamentos duplicados que já estão no app ---------- */
function acharDuplicados(){
  const grupos=new Map();
  for(const t of S.transacoes){
    if(t.valor>=0)continue;
    const k=(t.cartaoId||'-')+'|'+t.competencia+'|'+chaveEstab(t.desc)+'|'+(t.parcelaN||1)+'/'+(t.parcelaDe||1);
    (grupos.get(k)||grupos.set(k,[]).get(k)).push(t);
  }
  const out=[];
  for(const lista of grupos.values()){
    if(lista.length<2)continue;
    const parcela=(lista[0].parcelaDe||1)>1;
    /* dentro do grupo, junta os que têm valor parecido (parcelas) ou igual (à vista) */
    const restantes=[...lista];
    while(restantes.length){
      const base=restantes.shift();
      const iguais=restantes.filter(x=>parcela?tolValor(x.valor,base.valor):(x.valor===base.valor&&x.data===base.data));
      if(!iguais.length)continue;
      iguais.forEach(x=>restantes.splice(restantes.indexOf(x),1));
      const todos=[base,...iguais].sort((a,b)=>(a.futura?1:0)-(b.futura?1:0)||(a.origem==='fatura'?-1:1));
      out.push({manter:todos[0],remover:todos.slice(1),parcela});
    }
  }
  return out;
}
function abrirDuplicados(){
  const gs=acharDuplicados();
  const rot=t=>`${esc(t.desc)} · ${dLabel(t.data)}${(t.parcelaDe||1)>1?' · '+t.parcelaN+'/'+t.parcelaDe:''}${t.futura?' · prevista':''}`;
  sheet(`<h2>Lançamentos duplicados</h2>
  <div class="sh-sub">${gs.length?`Encontrei ${gs.length} caso${gs.length>1?'s':''}. Marcados para apagar: as cópias extras (o app mantém o lançamento real da fatura). Desmarque se for uma compra repetida de verdade.`:'Nenhum lançamento duplicado.'}</div>
  ${gs.length?`<div class="list" style="max-height:52vh;overflow-y:auto">${gs.map((g,i)=>`<div class="dupgrupo">
      <div class="sub"><b style="color:var(--ink)">Manter:</b> ${rot(g.manter)} · <span class="num">${brl(-g.manter.valor)}</span></div>
      ${g.remover.map(r=>`<label class="dupitem"><input type="checkbox" class="dupchk" data-id="${r.id}" checked style="width:18px;height:18px;accent-color:var(--bad)">
        <span>Apagar: ${rot(r)} · <span class="num">${brl(-r.valor)}</span></span></label>`).join('')}
    </div>`).join('')}</div>
    <button class="btn danger" id="dupApagar" style="margin-top:var(--s3)">Apagar duplicados marcados</button>`
  :vazio({ic:'check',t:'Tudo certo',p:'Não há compras repetidas nas suas faturas.'})}`);
  $('#dupApagar')?.addEventListener('click',()=>{
    const ids=new Set($$('.dupchk').filter(c=>c.checked).map(c=>c.dataset.id));
    if(!ids.size){toast('Nada marcado');return}
    S.transacoes=S.transacoes.filter(t=>!ids.has(t.id));
    salvar();fecharSheet();render();toast(ids.size+' duplicado'+(ids.size>1?'s':'')+' apagado'+(ids.size>1?'s':''));
  });
}

function parseOFX(t){
  const out=[];
  for(const m of t.matchAll(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi)){
    const b=m[1];
    const g=tag=>{const x=b.match(new RegExp('<'+tag+'>([^<\\r\\n]+)','i'));return x?x[1].trim():''};
    const dt=g('DTPOSTED').slice(0,8), memo=g('MEMO')||g('NAME'), amt=g('TRNAMT');
    if(dt.length===8)out.push({iso:dt.slice(0,4)+'-'+dt.slice(4,6)+'-'+dt.slice(6,8),desc:memo,valor:parseMoney(amt)});
  }
  return out;
}
function revisarImportacao(){
  const{itens,competencia,cartaoId,arquivo}=impLinhas;
  const sel=itens.filter(x=>x.status!=='ja');            /* o que pode entrar */
  const ja=itens.filter(x=>x.status==='ja');
  const marcado=sel.map(x=>x.status!=='repetida');
  const unicas=sel.map(x=>x.t);
  const cats=S.categorias.filter(x=>x.tipo!=='receita');
  const nSub=sel.filter(x=>x.status==='substitui').length, nRep=sel.filter(x=>x.status==='repetida').length;
  sheet(`<h2>Revisar importação</h2>
  <div class="sh-sub" id="impResumo"></div>
  <div class="chips" style="margin-bottom:var(--s3)">
    <span class="selo ok">${sel.filter(x=>x.status==='nova').length} nova${sel.filter(x=>x.status==='nova').length===1?'':'s'}</span>
    ${nSub?`<span class="selo neutral" title="Parcelas que o app já tinha previsto: o valor real substitui o previsto">${nSub} atualiza${nSub>1?'m':''} parcela prevista</span>`:''}
    ${ja.length?`<span class="selo neutral">${ja.length} já lançada${ja.length>1?'s':''} (ignorada${ja.length>1?'s':''})</span>`:''}
    ${nRep?`<span class="selo bad">${nRep} repetida${nRep>1?'s':''} no arquivo (desmarcada${nRep>1?'s':''})</span>`:''}
  </div>
  <div class="empilhada" id="impBarra" style="margin-bottom:var(--s2)"></div>
  <div class="legend" id="impLegenda" style="margin:0 0 var(--s3)"></div>
  <div id="impParc"></div>
  ${sel.length?`<div class="row" style="margin-bottom:var(--s2)"><span class="sub">Agrupado por categoria. Desmarque o que não for gasto.</span>
    <button class="btn ghost sm" id="impTodos">Desmarcar todos</button></div>`:''}
  <div id="impLista" style="max-height:44vh;overflow-y:auto">${sel.length?'':vazio({ic:'check',t:'Nada novo nesta fatura',p:'Todas as compras deste arquivo já estão no app.'})}</div>
  ${ja.length?`<details class="acc" style="margin-top:var(--s3)"><summary>Já lançadas antes (${ja.length}) — não entram de novo</summary><div class="body"><div class="list">
    ${ja.map(x=>`<div class="item"><div class="mid"><div class="t">${esc(x.t.desc)}</div><div class="s">${dLabel(x.t.data)}${x.t.parcelaDe>1?' · '+x.t.parcelaN+'/'+x.t.parcelaDe:''} · já está em ${ymShort(x.alvo.competencia)}</div></div><div class="val">${brl(Math.abs(x.t.valor),{noPrefix:true})}</div></div>`).join('')}
  </div></div></details>`:''}
  <button class="btn" id="impConfirma" style="margin-top:var(--s3)"></button>`);
  const escolhidos=()=>sel.filter((x,i)=>marcado[i]);
  const abertos=new Set();
  let ordemCats=[];
  function pintarLista(){
    if(!sel.length)return;
    $$('#impLista details[open]').forEach(d=>abertos.add(d.dataset.cat));
    const gs={};unicas.forEach((t,i)=>{(gs[t.catId]=gs[t.catId]||[]).push(i)});
    const ordem=Object.entries(gs).map(([id,ix])=>({id,ix,tot:ix.reduce((a,i)=>a+Math.abs(unicas[i].valor),0)})).sort((a,b)=>b.tot-a.tot);
    ordemCats=ordem.map(g=>g.id);
    $('#impLista').innerHTML=ordem.map((g,gi)=>{const c=catById(g.id);return `<details class="grupo" data-cat="${g.id}" ${abertos.has(g.id)||ordem.length===1?'open':''}>
      <summary><i style="width:10px;height:10px;border-radius:3px;background:${COR[gi%6]};flex:none"></i><span class="gnome">${c.ic} ${esc(c.nome)}</span>
        <span class="gqtd" data-gq="${g.id}"></span><span class="gval" data-gv="${g.id}"></span></summary>
      <div class="gcorpo">${g.ix.map(i=>{const t=unicas[i],st=sel[i].status;return `<div class="item">
        <input type="checkbox" class="impchk" data-i="${i}" ${marcado[i]?'checked':''} aria-label="Importar ${esc(t.desc)}" style="width:18px;height:18px;accent-color:var(--accent);flex:none">
        <div class="mid"><div class="t">${esc(t.desc)}${st==='substitui'?' <span class="selo neutral">atualiza prevista</span>':st==='repetida'?' <span class="selo bad">repetida no arquivo</span>':''}</div>
          <div class="s">${dLabel(t.data)}${t.parcelaDe>1?` · <b style="color:var(--warn)">${t.parcelaN}/${t.parcelaDe}</b>`:''} · <select data-i="${i}" class="impcat" aria-label="Categoria de ${esc(t.desc)}" style="background:none;border:0;color:var(--accent);font-weight:650;font-size:11.5px;padding:0">${cats.map(x=>`<option value="${x.id}" ${x.id===t.catId?'selected':''}>${esc(x.nome)}</option>`).join('')}</select></div></div>
        <div class="val ${sinalCls(t.valor)}">${t.valor<0?'−':'+'}${brl(Math.abs(t.valor),{noPrefix:true})}</div></div>`}).join('')}</div></details>`}).join('');
    $$('#impLista .impchk').forEach(c=>c.onchange=e=>{marcado[+e.target.dataset.i]=e.target.checked;atualizar()});
    $$('#impLista .impcat').forEach(s=>s.onchange=e=>{
      const t=unicas[+e.target.dataset.i];t.catId=e.target.value;S.aprendizado[chaveEstab(t.desc)]=t.catId;abertos.add(t.catId);pintarLista();atualizar();
    });
  }
  function atualizar(){
    const es=escolhidos(), tot=es.reduce((a,x)=>a+Math.abs(x.t.valor),0), parc=es.filter(x=>x.t.parcelaDe>1&&x.status==='nova').length;
    $('#impResumo').textContent=`${es.length} de ${itens.length} lançamentos · ${brl(tot)} · fatura de ${ymLabel(competencia)}`;
    const m={};es.filter(x=>x.t.valor<0).forEach(x=>{m[x.t.catId]=(m[x.t.catId]||0)-x.t.valor});
    const lista=Object.entries(m).map(([id,v])=>({id,c:catById(id),v})).sort((a,b)=>b.v-a.v);
    const totG=lista.reduce((a,x)=>a+x.v,0)||1;
    const corDe=id=>COR[Math.max(0,ordemCats.indexOf(id))%6];
    $('#impBarra').innerHTML=lista.map(x=>`<i style="width:${(x.v/totG*100).toFixed(1)}%;background:${corDe(x.id)}" data-tip="${esc(x.c.nome)}: ${brl(x.v)}"></i>`).join('');
    $('#impLegenda').innerHTML=lista.slice(0,4).map(x=>`<div><i style="background:${corDe(x.id)}"></i>${esc(x.c.nome)} <b class="num" style="color:var(--ink)">${pct(x.v/totG,0)}</b></div>`).join('');
    for(const id of ordemCats){
      const ix=unicas.map((t,i)=>({t,i})).filter(x=>x.t.catId===id), on=ix.filter(x=>marcado[x.i]);
      const q=$(`#impLista [data-gq="${id}"]`), v=$(`#impLista [data-gv="${id}"]`);
      if(q)q.textContent=on.length+' de '+ix.length;
      if(v)v.textContent=brl(on.reduce((a,x)=>a+Math.abs(x.t.valor),0));
    }
    $('#impParc').innerHTML=parc?`<div class="warnbox" style="margin-bottom:var(--s3)">${parc} compra${parc>1?'s':''} parcelada${parc>1?'s':''} nova${parc>1?'s':''} — as parcelas futuras serão lançadas sozinhas nos meses seguintes.</div>`:'';
    const b=$('#impConfirma');b.textContent=es.length?`Confirmar ${es.length} lançamento${es.length===1?'':'s'}`:'Fechar';b.disabled=false;
    const bt=$('#impTodos');if(bt)bt.textContent=es.length?'Desmarcar todos':'Marcar todos';
  }
  pintarLista();atualizar();
  $('#impTodos')?.addEventListener('click',()=>{const v=!escolhidos().length;marcado.fill(v);$$('.impchk').forEach(c=>c.checked=v);atualizar()});
  $('#impConfirma').onclick=()=>{
    const es=escolhidos();
    if(!es.length){fecharSheet();return}
    const importId=uid(), novos=[], substituidas=[];
    for(const x of es){
      const t=x.t;
      if(x.status==='substitui'){
        const alvo=S.transacoes.find(y=>y.id===x.alvo.id);
        if(alvo){
          substituidas.push({id:alvo.id,antes:{valor:alvo.valor,data:alvo.data,desc:alvo.desc,futura:alvo.futura,origem:alvo.origem,catId:alvo.catId}});
          Object.assign(alvo,{valor:t.valor,data:t.data,desc:t.desc,futura:false,origem:'fatura',catId:t.catId});
          continue;
        }
      }
      t.importId=importId;novos.push(t);
    }
    S.transacoes.push(...novos);
    const futuras=projetarParcelas([...novos,...substituidas.map(s=>S.transacoes.find(y=>y.id===s.id)).filter(Boolean)]);
    futuras.forEach(f=>{f.importId=importId});
    S.transacoes.push(...futuras);
    es.forEach(x=>{if(x.t.catId!=='outros')S.aprendizado[chaveEstab(x.t.desc)]=x.t.catId});
    importacoes().push({id:importId,em:new Date().toISOString(),cartaoId,competencia,arquivo,
      ids:[...novos,...futuras].map(t=>t.id),substituidas,n:es.length});
    S.importacoes=importacoes().slice(-20);
    salvar();fecharSheet();render();
    toast(novos.length+' lançamento'+(novos.length===1?'':'s')+' importado'+(novos.length===1?'':'s')+(substituidas.length?' · '+substituidas.length+' parcela'+(substituidas.length>1?'s':'')+' prevista'+(substituidas.length>1?'s':'')+' atualizada'+(substituidas.length>1?'s':''):''));
    $('#impTexto')&&($('#impTexto').value='');
  };
}
