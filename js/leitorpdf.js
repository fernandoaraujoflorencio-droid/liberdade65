/* =====================================================================
   LIBERDADE 65 — leitor de PDF (faturas e relatórios gerenciais)
   Usa o pdf.js (vendor/pdfjs, Apache 2.0) carregado só quando preciso.
   Tudo acontece no navegador: o arquivo não sai do seu computador.
   Funciona via file:// porque o "worker" do pdf.js roda na própria página.
   ===================================================================== */
let pdfjsPronto=null;
function carregarScript(src){
  return new Promise((ok,erro)=>{
    const s=document.createElement('script');s.src=src;s.onload=ok;
    s.onerror=()=>erro(new Error('não carregou '+src));document.head.appendChild(s);
  });
}
function carregarPdfjs(){
  if(window.pdfjsLib)return Promise.resolve(window.pdfjsLib);
  if(!pdfjsPronto)pdfjsPronto=(async()=>{
    await carregarScript('vendor/pdfjs/pdf.worker.min.js');  /* define globalThis.pdfjsWorker */
    await carregarScript('vendor/pdfjs/pdf.min.js');
    return window.pdfjsLib;
  })().catch(e=>{pdfjsPronto=null;throw e});
  return pdfjsPronto;
}
/* Lê o texto do PDF e remonta as linhas pela posição vertical.
   Retorna { paginas: [[linha, ...], ...], texto } ou lança
   Error com .tipo = 'senha' | 'senha-errada' | 'sem-texto' | 'pdf'. */
async function lerTextoPDF(arquivo,senha){
  const lib=await carregarPdfjs();
  const dados=new Uint8Array(await arquivo.arrayBuffer());
  let doc;
  try{doc=await lib.getDocument({data:dados,password:senha||undefined,verbosity:0,isEvalSupported:false}).promise}
  catch(e){
    const x=new Error(e&&e.message||'pdf');
    x.tipo=e&&e.name==='PasswordException'?(senha?'senha-errada':'senha'):'pdf';
    throw x;
  }
  const paginas=[], itens=[];
  for(let n=1;n<=doc.numPages;n++){
    const pg=await doc.getPage(n);
    const tc=await pg.getTextContent();
    const brutos=tc.items.filter(it=>it.str&&it.str.trim()).map(it=>({s:it.str,x:it.transform[4],y:it.transform[5],w:it.width||0,h:Math.abs(it.transform[3])||8}));
    const pagItens=removerCamadas(brutos);
    itens.push(pagItens);                       /* com posição, para ler tabelas pela coluna */
    paginas.push(montarLinhas(pagItens));
  }
  const texto=paginas.map(p=>p.join('\n')).join('\n');
  if(texto.replace(/\s/g,'').length<20){const x=new Error('sem texto');x.tipo='sem-texto';throw x}
  return{paginas,texto,itens};
}
/* Alguns PDFs desenham o mesmo texto duas vezes (efeito de negrito, sombra ou
   camada de acessibilidade). Itens com o mesmo texto quase na mesma posição
   viram um só — era isso que duplicava compras na leitura. */
function removerCamadas(lista){
  const out=[];
  for(const it of lista){
    const t=it.s.trim();
    const dup=out.some(o=>o.s.trim()===t&&Math.abs(o.x-it.x)<2.5&&Math.abs(o.y-it.y)<2.5);
    if(!dup)out.push(it);
  }
  return out;
}
const RE_INICIO_DATA=/^\s*(\d{1,2}\s+(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\b|\d{1,2}\/\d{1,2}\b)/i;
/* Junta os itens em linhas pela altura (com tolerância, para a data e o valor
   não se separarem) e separa colunas quando há duas compras lado a lado. */
function montarLinhas(lista){
  const ord=[...lista].sort((a,b)=>b.y-a.y||a.x-b.x);
  const grupos=[];
  for(const it of ord){
    const tol=Math.max(2.5,Math.min(it.h,12)*.4);
    const g=grupos.find(g=>Math.abs(g.y-it.y)<=tol);
    if(g){g.itens.push(it);g.y=(g.y*(g.itens.length-1)+it.y)/g.itens.length}
    else grupos.push({y:it.y,itens:[it]});
  }
  grupos.sort((a,b)=>b.y-a.y);
  const linhas=[];
  for(const g of grupos){
    const itensX=g.itens.sort((a,b)=>a.x-b.x);
    let seg=[],fim=null;
    const fecha=()=>{if(seg.length)linhas.push(juntar(seg));seg=[]};
    for(const i of itensX){
      const gap=fim===null?0:i.x-fim;
      /* espaço grande seguido de uma data = outra coluna, outra compra */
      if(fim!==null&&gap>40&&RE_INICIO_DATA.test(i.s)&&/\d,\d{2}\s*$/.test(juntar(seg)))fecha();
      seg.push(i);fim=Math.max(fim??-Infinity,i.x+i.w);
    }
    fecha();
  }
  return linhas.filter(Boolean);
}
function juntar(seg){
  let txt='',fim=null;
  for(const i of seg){
    if(fim!==null&&i.x-fim>1&&!/\s$/.test(txt))txt+=' ';
    txt+=i.s;fim=i.x+i.w;
  }
  return txt.replace(/\s+/g,' ').trim();
}
const MSG_PDF={
  'senha':'Este PDF tem senha. Digite a senha para eu ler (ela não é guardada).',
  'senha-errada':'Senha incorreta. Tente de novo.',
  'sem-texto':'Este PDF não tem texto selecionável (parece uma imagem escaneada). Copie o texto à mão ou use o CSV.',
  'pdf':'Não consegui abrir este PDF. Confira se o arquivo não está corrompido.'
};
/* lê o PDF pedindo a senha numa folha quando necessário */
async function lerPdfComSenha(arquivo,aoLer,senha){
  try{const r=await lerTextoPDF(arquivo,senha);aoLer(r);}
  catch(e){
    if(e.tipo==='senha'||e.tipo==='senha-errada'){
      sheet(`<h2>PDF protegido</h2><div class="sh-sub">${esc(arquivo.name)}</div>
        <div class="${e.tipo==='senha-errada'?'badbox':'infobox'}" style="margin-bottom:var(--s3)">${MSG_PDF[e.tipo]}</div>
        <div class="fgroup"><label class="f" for="pdfSenha">Senha do PDF</label><input class="inp" id="pdfSenha" type="password" autocomplete="off"></div>
        <button class="btn" id="pdfSenhaOk">Abrir PDF</button>`);
      setTimeout(()=>$('#pdfSenha')?.focus(),50);
      const ir=()=>{const s=$('#pdfSenha').value;fecharSheet();lerPdfComSenha(arquivo,aoLer,s)};
      $('#pdfSenhaOk').onclick=ir;$('#pdfSenha').onkeydown=k=>{if(k.key==='Enter')ir()};
    }else toast(MSG_PDF[e.tipo]||MSG_PDF.pdf);
  }
}
