/* =====================================================================
   LIBERDADE 65 — núcleo: utilitários, dinheiro, datas e estado
   Valores monetários são inteiros em centavos.
   Os arquivos js/*.js são scripts clássicos (não módulos) para funcionar
   abrindo o index.html direto do computador (file://).
   ===================================================================== */
const KEY='liberdade65_v1';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const uid=()=>Math.random().toString(36).slice(2,10);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

/* ---------- dinheiro ---------- */
const brl=(c,opt={})=>{
  const v=(c||0)/100;
  const s=v.toLocaleString('pt-BR',{minimumFractionDigits:opt.dec===0?0:2,maximumFractionDigits:opt.dec===0?0:2});
  return (opt.sign&&c>0?'+':'')+(opt.noPrefix?'':'R$ ')+s;
};
const brlK=c=>{const v=Math.abs(c||0)/100;const sg=c<0?'−':'';
  if(v>=1e6)return sg+'R$ '+(v/1e6).toLocaleString('pt-BR',{maximumFractionDigits:2})+' mi';
  if(v>=10000)return sg+'R$ '+(v/1000).toLocaleString('pt-BR',{maximumFractionDigits:1})+' mil';
  return sg+'R$ '+v.toLocaleString('pt-BR',{maximumFractionDigits:0});};
const pct=(x,d=1)=>(x*100).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d})+'%';
/* padrão único para números com sinal: verde positivo, vermelho negativo */
const sinalCls=v=>v>0?'pos':(v<0?'neg':'zero');
const brlS=(c,opt={})=>(c>0?'+':(c<0?'−':''))+brl(Math.abs(c||0),opt);
const pctS=(x,d=2)=>(x>0?'+':(x<0?'−':''))+pct(Math.abs(x||0),d);
const comSinal=(html,v)=>`<span class="${sinalCls(v)}">${html}</span>`;

/* número no formato brasileiro ou internacional → float */
function parseNumero(s){
  if(typeof s==='number')return isFinite(s)?s:NaN;
  if(s===null||s===undefined)return NaN;
  let t=String(s).replace(/\s|R\$| /gi,'').replace(/[^0-9,.\-+]/g,'');
  if(!t)return NaN;
  const neg=/-/.test(t); t=t.replace(/[-+]/g,'');
  if(t.includes(',')&&t.includes('.')){ t = t.lastIndexOf(',')>t.lastIndexOf('.') ? t.replace(/\./g,'').replace(',','.') : t.replace(/,/g,''); }
  else if(t.includes(',')) t=t.replace(/\./g,'').replace(',','.');
  else if((t.match(/\./g)||[]).length>1) t=t.replace(/\./g,'');
  const v=parseFloat(t); if(isNaN(v))return NaN;
  return neg?-v:v;
}
/* quantidade: "1.000" = mil (milhar BR), "1,5" = um e meio, "0.25" = 0,25 */
function parseQtd(s){
  const t=String(s??'').trim();
  if(!t)return 0;
  if(/^[1-9]\d{0,2}(\.\d{3})+$/.test(t))return +t.replace(/\./g,'');
  const v=parseNumero(t);
  return isFinite(v)&&v>0?v:0;
}
function parseMoney(s){
  if(typeof s==='number')return Math.round(s*100);
  if(!s)return 0;
  const v=parseNumero(s);
  return isNaN(v)?0:Math.round(v*100);
}
/* centavos → texto para campo de formulário ("1.234,56") */
const campoMoney=c=>c?(c/100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}):'';

/* ---------- datas ---------- */
const MES=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const MES3=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const hoje=()=>new Date();
const ymOf=d=>d.slice(0,7);
const todayISO=()=>{const d=new Date();return d.toISOString().slice(0,10)};
const ymNow=()=>todayISO().slice(0,7);
function addMonthYM(ym,n){let[y,m]=ym.split('-').map(Number);m+=n;y+=Math.floor((m-1)/12);m=((m-1)%12+12)%12+1;return y+'-'+String(m).padStart(2,'0')}
function ymLabel(ym){const[y,m]=ym.split('-').map(Number);return MES[m-1]+' '+y}
function ymShort(ym){const[y,m]=ym.split('-').map(Number);return MES3[m-1]+'/'+String(y).slice(2)}
function diasNoMes(ym){const[y,m]=ym.split('-').map(Number);return new Date(y,m,0).getDate()}
function diffMesesYM(a,b){const[ay,am]=a.split('-').map(Number),[by,bm]=b.split('-').map(Number);return (by-ay)*12+(bm-am)}
function dLabel(iso){const[y,m,d]=iso.split('-');return d+' '+MES3[+m-1]}
/* aceita ISO, data simples ou epoch (s/ms) → ms; NaN se inválido */
function paraMs(q){
  if(q===null||q===undefined||q==='')return NaN;
  if(typeof q==='number')return q<1e12?q*1000:q;
  const t=new Date(q).getTime();
  return isNaN(t)?NaN:t;
}
const dataHora=iso=>{const d=new Date(paraMs(iso));if(isNaN(d))return '—';
  return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})+' '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})};
const dataCurta=iso=>{const d=new Date(paraMs(iso));if(isNaN(d))return '—';
  return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'})};
const carimbo=()=>{const d=new Date(),p=n=>String(n).padStart(2,'0');
  return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'-'+p(d.getHours())+'h'+p(d.getMinutes())};

/* ---------- estado ---------- */
const CAT_PADRAO=[
  {id:'moradia',nome:'Moradia',tipo:'essencial',ic:'🏠'},
  {id:'mercado',nome:'Mercado',tipo:'essencial',ic:'🛒'},
  {id:'transporte',nome:'Transporte',tipo:'essencial',ic:'⛽'},
  {id:'saude',nome:'Saúde',tipo:'essencial',ic:'🩺'},
  {id:'educacao',nome:'Educação',tipo:'essencial',ic:'📚'},
  {id:'contas',nome:'Contas e serviços',tipo:'essencial',ic:'💡'},
  {id:'delivery',nome:'Delivery e restaurantes',tipo:'variavel',ic:'🍽️'},
  {id:'assinaturas',nome:'Assinaturas',tipo:'variavel',ic:'📺'},
  {id:'lazer',nome:'Lazer',tipo:'variavel',ic:'🎬'},
  {id:'compras',nome:'Compras',tipo:'variavel',ic:'🛍️'},
  {id:'vestuario',nome:'Vestuário',tipo:'variavel',ic:'👕'},
  {id:'pet',nome:'Pet',tipo:'variavel',ic:'🐾'},
  {id:'taxas',nome:'Taxas e juros',tipo:'variavel',ic:'🧾'},
  {id:'outros',nome:'Outros',tipo:'variavel',ic:'❓'},
  {id:'aporte',nome:'Aporte / investimento',tipo:'investimento',ic:'📈'},
  {id:'salario',nome:'Salário',tipo:'receita',ic:'💼'},
  {id:'extra',nome:'Renda extra',tipo:'receita',ic:'✨'},
];
const REGRAS_PADRAO=[
  ['mercado',/mercado|supermerc|atacad|assai|assaí|carrefour|extra |pao de acucar|pão de açúcar|comper|fort atacad|big bom|hortifruti|acougue|açougue|makro|tenda/i],
  ['delivery',/ifood|i food|rappi|uber\s*eats|restaurante|lanchonete|burger|pizz|padaria|cafe|café|sushi|churrasc|espetinho|acai|açaí|subway|mcdonald|bk |habib/i],
  ['transporte',/uber|99app|99 |cabify|posto |combustivel|combustível|shell|ipiranga|petrobras|br mania|estacionament|zul |detran|pedagio|pedágio|onibus|ônibus|mecanic|autopec|pneu/i],
  ['assinaturas',/netflix|spotify|prime video|amazon prime|hbo|max |disney|globoplay|deezer|youtube|google\s*(one|storage|play)|apple\.com|icloud|itunes|microsoft|office 365|adobe|chatgpt|openai|anthropic|claude|canva|dropbox|paramount|crunchyroll/i],
  ['contas',/energisa|enel|cemig|copel|light |agua |água |sanesul|guariroba|sabesp|claro|vivo|tim |oi fibra|net |internet|telefon|gas |condomin|condomín|iptu|seguro|cpfl/i],
  ['saude',/farmacia|farmácia|drogaria|drogasil|pague menos|panvel|raia|unimed|amil|hapvida|clinica|clínica|laborat|hospital|odonto|dentist|otica|ótica|academia|smart fit|gympass/i],
  ['educacao',/faculdade|universidade|ufms|anhanguera|estacio|unopar|curso|udemy|alura|coursera|escola|colegio|colégio|livraria|amazon\.com\.br livros|kindle|apostila|concurso|gran cursos|qconcursos|estrategia concursos/i],
  ['lazer',/cinema|ingresso|cinemark|kinoplex|teatro|show |bar |pub |balada|viagem|hotel|airbnb|booking|latam|gol linhas|azul linhas|decolar|123milhas|parque/i],
  ['vestuario',/renner|riachuelo|c&a|c e a|marisa|zara|hering|centauro|netshoes|nike|adidas|calcad|calçad|shein|shopee moda/i],
  ['compras',/magazine|magalu|americanas|mercado livre|mercadolivre|shopee|aliexpress|amazon|casas bahia|ponto frio|leroy|telha norte|kalunga|havan/i],
  ['pet',/petz|cobasi|petshop|pet shop|veterinar|veterinár|ração|racao pet/i],
  ['taxas',/anuidade|juros|iof|multa|encargo|tarifa|mora |rotativo|parcelamento de fatura/i],
  ['aporte',/tesouro|b3 |cblc|clear |rico invest|xp invest|nuinvest|easynvest|btg|inter dtvm|avenue|binance|mercado bitcoin|fundo |cdb |lci|lca|previdenc/i],
  ['salario',/salario|salário|remunerac|remuneraç|folha de pagamento|proventos|vencimentos/i],
];
/* Formato dos dados (não mudar): campos novos só são ADICIONADOS, com padrão. */
const DEFAULT={
  v:1,
  perfil:{nome:'',rendaLiquida:0,outrasRendas:0,metaPoupanca:.65,diaPagamento:5,despesaMediaManual:0},
  premissas:{swr:.04,retornoRealAA:.06,inflacaoAA:.045,cdiAA:.1065,dyCarteira:.08,mesesReserva:6,idadeAtual:30,idadeCoast:60,
    taxaBazin:.06 /* novo: taxa mínima do preço teto de Bazin */},
  categorias:CAT_PADRAO.map(c=>({...c})),
  cartoes:[],
  transacoes:[],
  ativos:[],
  alocacaoAlvo:{'Renda fixa':40,'FIIs':25,'Ações BR':15,'Exterior':15,'Cripto':0,'Caixa':5},
  patrimonioHist:[],
  aprendizado:{},
  metas:[],
  saldoContas:0,
  reservaAtual:0,
  ultimoBackupEm:null, /* novo: data do último backup exportado */
  ui:{tab:'painel',ym:ymNow(),tema:''}
};
let S=carregar();
function carregar(){
  try{const raw=localStorage.getItem(KEY);if(!raw)return structuredClone(DEFAULT);
    const p=JSON.parse(raw);return deepMerge(structuredClone(DEFAULT),p);}
  catch(e){return structuredClone(DEFAULT)}
}
function deepMerge(base,over){
  for(const k in over){
    if(over[k]&&typeof over[k]==='object'&&!Array.isArray(over[k])&&base[k]&&typeof base[k]==='object'&&!Array.isArray(base[k])) deepMerge(base[k],over[k]);
    else base[k]=over[k];
  } return base;
}
let saveT=null, bloquearSalvar=false; /* bloquearSalvar: ligado ao apagar tudo, para nada regravar os dados */
function salvarAgora(){clearTimeout(saveT);saveT=null;if(bloquearSalvar)return false;
  try{localStorage.setItem(KEY,JSON.stringify(S));return true}catch(e){toast('Não consegui salvar — armazenamento cheio ou bloqueado');return false}}
function salvar(){clearTimeout(saveT);saveT=setTimeout(salvarAgora,120)}
window.addEventListener('pagehide',()=>{if(saveT)salvarAgora()}); /* grava o que estava pendente ao fechar */
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('on'),3200)}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

/* ---------- ícones (SVG em linha, sem dependências) ---------- */
const ICONE={
  painel:'<path d="M3 13h4l2.5 6L14 5l2.5 8H21"/>',
  lancar:'<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M7.5 9h9M7.5 13h6M7.5 16.5h4"/>',
  faturas:'<rect x="2.5" y="5.5" width="19" height="13" rx="2.5"/><path d="M2.5 10h19M6.5 14.5h3"/>',
  investir:'<path d="M4 19V9M9.6 19V5M15.2 19v-6M20.8 19v-9"/>',
  liberdade:'<path d="M12 21c4.4-3.3 7-6.6 7-10a7 7 0 1 0-14 0c0 3.4 2.6 6.7 7 10z"/><circle cx="12" cy="10.6" r="2.5"/>',
  config:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
  carteira:'<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18v3"/><rect x="3" y="8" width="18" height="11" rx="2.5"/><circle cx="16.5" cy="13.5" r="1.3"/>',
  cartao:'<rect x="2.5" y="5.5" width="19" height="13" rx="2.5"/><path d="M2.5 10h19M6.5 14.5h3"/>',
  lista:'<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  escudo:'<path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V6z"/><path d="M9 12l2.2 2.2L15.5 10"/>',
  x:'<path d="M6 6l12 12M18 6L6 18"/>',
  sol:'<circle cx="12" cy="12" r="4.2"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/>',
  lua:'<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  auto:'<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17A8.5 8.5 0 0 0 12 3.5z" fill="currentColor"/>',
};
const svgIc=(n,w=20)=>`<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONE[n]||''}</svg>`;

/* estado vazio padronizado: ícone, título, orientação e ação */
function vazio({ic='lista',t,p,acao,attrs=''}){
  return `<div class="vazio"><div class="vic">${svgIc(ic,26)}</div>
    <div class="vt">${esc(t)}</div>${p?`<div class="vp">${p}</div>`:''}
    ${acao?`<button class="btn sm" ${attrs}>${esc(acao)}</button>`:''}</div>`;
}
