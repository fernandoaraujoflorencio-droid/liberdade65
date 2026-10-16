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
  const paginas=[];
  for(let n=1;n<=doc.numPages;n++){
    const pg=await doc.getPage(n);
    const tc=await pg.getTextContent();
    const porY=new Map();
    for(const it of tc.items){
      if(!it.str||!it.str.trim())continue;
      const y=Math.round(it.transform[5]/2)*2, x=it.transform[4];
      if(!porY.has(y))porY.set(y,[]);
      porY.get(y).push({x,s:it.str,w:it.width||0});
    }
    const linhas=[...porY.entries()].sort((a,b)=>b[0]-a[0]).map(([,itens])=>{
      itens.sort((a,b)=>a.x-b.x);
      let txt='',fim=null;
      for(const i of itens){
        if(fim!==null&&i.x-fim>1&&!/\s$/.test(txt))txt+=' ';
        txt+=i.s;fim=i.x+i.w;
      }
      return txt.replace(/\s+/g,' ').trim();
    }).filter(Boolean);
    paginas.push(linhas);
  }
  const texto=paginas.map(p=>p.join('\n')).join('\n');
  if(texto.replace(/\s/g,'').length<20){const x=new Error('sem texto');x.tipo='sem-texto';throw x}
  return{paginas,texto};
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
