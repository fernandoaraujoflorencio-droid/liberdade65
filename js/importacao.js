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
    if(/^(total|fatura|pagamento recebido|limite|saldo|resumo|transações|período|valor máximo|em cumprimento|como assegurado|o nubank|\d+ de \d+)/i.test(ln))continue;
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
        const dupe=x=>x.parcelaN===k&&x.competencia===comp&&Math.abs(x.valor-t.valor)<=5&&chaveEstab(x.desc)===ch;
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
      toast('PDF lido: '+paginas.length+' página'+(paginas.length>1?'s':'')+' — conferindo lançamentos');
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

function importar(){
  const texto=$('#impTexto').value.trim();
  if(!texto){toast('Escolha um arquivo ou cole o conteúdo da fatura');return}
  let linhas=texto.includes('<OFX')||texto.includes('OFXHEADER')?parseOFX(texto)
    :(texto.split('\n')[0].split(/[,;\t]/).length>=2&&/date|data|title|amount|valor|desc/i.test(texto.split('\n')[0])?parseCSV(texto):parseLinhas(texto));
  if(!linhas.length){toast('Não reconheci nenhum lançamento — confira o formato');return}
  const competencia=$('#impMes').value||ymNow(), cartaoId=$('#impCartao').value||null;
  if(!cartaoId){toast('Cadastre um cartão antes de importar a fatura');return}
  const novas=montarImportacao(linhas,{competencia,cartaoId});
  /* dedup contra o que já existe */
  const jaTem=new Set(S.transacoes.map(t=>t.competencia+'|'+chaveEstab(t.desc)+'|'+t.valor+'|'+(t.parcelaN||1)));
  const unicas=novas.filter(t=>!jaTem.has(t.competencia+'|'+chaveEstab(t.desc)+'|'+t.valor+'|'+(t.parcelaN||1)));
  impLinhas={unicas,dup:novas.length-unicas.length,competencia};
  revisarImportacao();
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
  const{unicas,dup,competencia}=impLinhas;
  const marcado=unicas.map(()=>true);
  const cats=S.categorias.filter(x=>x.tipo!=='receita');
  sheet(`<h2>Revisar importação</h2>
  <div class="sh-sub" id="impResumo"></div>
  <div class="card flat" style="padding:var(--s3) var(--s4);margin-bottom:var(--s3)"><h3 style="margin-bottom:var(--s1)">Gastos por categoria</h3><div id="impCats"></div></div>
  <div id="impParc"></div>
  <div class="row" style="margin-bottom:var(--s2)"><span class="sub">Desmarque o que não for gasto (ex.: pagamento, estorno).</span>
    <button class="btn ghost sm" id="impTodos">Desmarcar todos</button></div>
  <div class="list" style="max-height:40vh;overflow-y:auto" id="impLista">
    ${unicas.map((t,i)=>{const c=catById(t.catId);return `<div class="item">
      <input type="checkbox" class="impchk" data-i="${i}" checked aria-label="Importar ${esc(t.desc)}" style="width:18px;height:18px;accent-color:var(--accent);flex:none">
      <div class="ic" aria-hidden="true">${c.ic}</div>
      <div class="mid"><div class="t">${esc(t.desc)}</div>
        <div class="s">${dLabel(t.data)} · <select data-i="${i}" class="impcat" aria-label="Categoria de ${esc(t.desc)}" style="background:none;border:0;color:var(--accent);font-weight:650;font-size:11.5px;padding:0">${cats.map(x=>`<option value="${x.id}" ${x.id===t.catId?'selected':''}>${esc(x.nome)}</option>`).join('')}</select>
        ${t.parcelaDe>1?` · <b style="color:var(--warn)">${t.parcelaN}/${t.parcelaDe}</b>`:''}</div></div>
      <div class="val ${sinalCls(t.valor)}">${t.valor<0?'−':'+'}${brl(Math.abs(t.valor),{noPrefix:true})}</div></div>`}).join('')}
  </div>
  <button class="btn" id="impConfirma" style="margin-top:var(--s3)"></button>`);
  const escolhidas=()=>unicas.filter((t,i)=>marcado[i]);
  function atualizar(){
    const sel=escolhidas(), tot=sel.reduce((a,t)=>a+Math.abs(t.valor),0), parc=sel.filter(t=>t.parcelaDe>1).length;
    $('#impResumo').textContent=`${sel.length} de ${unicas.length} lançamentos · ${brl(tot)} · fatura de ${ymLabel(competencia)}${dup?` · ${dup} duplicados ignorados`:''}`;
    const m={};sel.filter(t=>t.valor<0).forEach(t=>{m[t.catId]=(m[t.catId]||0)-t.valor});
    const lista=Object.entries(m).map(([id,v])=>({n:catById(id).ic+'  '+catById(id).nome,v})).sort((a,b)=>b.v-a.v);
    const totG=lista.reduce((a,x)=>a+x.v,0);
    $('#impCats').innerHTML=lista.length?barrasH(lista.slice(0,6),{tot:totG}):'<div class="sub">Nenhum gasto marcado.</div>';
    $('#impParc').innerHTML=parc?`<div class="warnbox" style="margin-bottom:var(--s3)">${parc} compra${parc>1?'s':''} parcelada${parc>1?'s':''} — as parcelas futuras serão lançadas sozinhas nos meses seguintes.</div>`:'';
    const b=$('#impConfirma');b.textContent=`Confirmar ${sel.length} lançamento${sel.length===1?'':'s'}`;b.disabled=!sel.length;
    $('#impTodos').textContent=sel.length?'Desmarcar todos':'Marcar todos';
  }
  atualizar();
  $$('.impchk').forEach(c=>c.onchange=e=>{marcado[+e.target.dataset.i]=e.target.checked;atualizar()});
  $('#impTodos').onclick=()=>{const v=!escolhidas().length;marcado.fill(v);$$('.impchk').forEach(c=>c.checked=v);atualizar()};
  $$('.impcat').forEach(s=>s.onchange=e=>{
    const t=unicas[+e.target.dataset.i];t.catId=e.target.value;S.aprendizado[chaveEstab(t.desc)]=t.catId;atualizar();
  });
  $('#impConfirma').onclick=()=>{
    const sel=escolhidas();if(!sel.length)return;
    S.transacoes.push(...sel);
    S.transacoes.push(...projetarParcelas(sel));
    sel.forEach(t=>{if(t.catId!=='outros')S.aprendizado[chaveEstab(t.desc)]=t.catId});
    salvar();fecharSheet();render();
    toast(sel.length+' lançamentos importados');
    $('#impTexto')&&($('#impTexto').value='');
  };
}
