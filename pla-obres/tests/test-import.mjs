// Proves de la importació des d'Excel: els dos modes (afegir vs substituir),
// la preservació dels comentaris i el reconeixement de departaments.
//
// El client de Supabase és simulat i registra què s'hi crida, perquè el que
// volem comprovar és precisament si s'esborra o no s'esborra res.
import { chromium } from 'playwright';
import fs from 'fs';

const rows = [
  { id:'a', dept:'SLT', obra:'Hospital Mataró', loc:'Mataró', imp:'61,74 M€', fita:'Licitació', data:'Setembre 2026', bucket:'2026-Q3', vegueria:'barcelona', encarregat:'', nivell:'3', top:false, comms:'Roda de premsa amb la consellera', status:'doing', sort_order:1, updated_at:new Date().toISOString() },
  { id:'b', dept:'SLT', obra:'CAP Torredembarra', loc:'Torredembarra', imp:'11,51 M€', fita:'Licitació', data:'Setembre 2026', bucket:'2026-Q3', vegueria:'camp-tarragona', encarregat:'delegacio', nivell:'2', top:false, comms:'', status:'todo', sort_order:2, updated_at:new Date().toISOString() },
  { id:'c', dept:'TER', obra:'Variant C-59', loc:'Sant Feliu de Codines', imp:'15 M€', fita:'Inici obres', data:'Octubre 2026', bucket:'2026-Q4', vegueria:'barcelona', encarregat:'conseller', nivell:'3', top:true, comms:'Visita del conseller', status:'todo', sort_order:3, updated_at:new Date().toISOString() }
];

const mockSb = `
window.__sb = { deletes:0, inserts:[], upserts:[] };
window.createSupabaseClient=function(){
  const rows=${JSON.stringify(rows)};
  const settings={password_hash:'5e22854f87ae1293d56afa21fe1ab6461d5d91f61ed84617cd54944f626fdb6a'};
  const history=[]; const chan={on:()=>chan,subscribe:()=>chan};
  function b(t){const o={};let fv=null;
    o.select=()=>o;o.order=()=>o;o.limit=()=>o;o.neq=()=>o;
    o.delete=()=>{ if(t==='works') window.__sb.deletes++; return o; };
    o.eq=(c,v)=>{fv=v;return o;};
    o.maybeSingle=async()=>t==='app_settings'?{data:settings[fv]?{value:settings[fv]}:null,error:null}:{data:null,error:null};
    o.insert=async(v)=>{ if(t==='works') window.__sb.inserts.push(...[].concat(v)); return {error:null}; };
    o.upsert=async(v)=>{ if(t==='works') window.__sb.upserts.push(...[].concat(v)); return {error:null}; };
    o.then=(r)=>{let d=[];if(t==='works')d=rows;else if(t==='history')d=history;r({data:d,error:null});};
    return o;}
  return {from:b, channel:()=>chan};
};
window.dispatchEvent(new Event('supabase-ready'));
`;

fs.writeFileSync('config.js', `window.APP_CONFIG={supabaseUrl:"https://x.supabase.co",supabaseAnonKey:"k",adminEmails:["admin@exemple.cat"]};`);

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport:{ width:1500, height:1000 }});
const page = await ctx.newPage();
await page.addInitScript(mockSb);
await page.route('**/esm.sh/**', r=>r.abort());
await page.route('**/fonts.googleapis.com/**', r=>r.abort());
await page.route('**/fonts.gstatic.com/**', r=>r.abort());

const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('console', m => { const t=m.text(); if (m.type()==='error' && !t.includes('net::ERR') && !t.includes('Failed to load')) errors.push('['+m.type()+'] '+t); });

await page.goto('file://' + process.cwd() + '/index.html');
await page.waitForTimeout(1200);
const R = [];
const check = (n, ok, d='') => R.push(`${ok?'PASS':'FAIL'}  ${n}${d?' — '+d:''}`);

await page.fill('#pw-input','canviam'); await page.click('#pw-ok'); await page.waitForTimeout(1100);
await page.fill('#signin-input','Anna Sala');
await page.fill('#signin-email','admin@exemple.cat');
await page.click('#signin-ok'); await page.waitForTimeout(600);

const worksCount = () => page.locator('.pill-item, .fc').count();
const openImport = async () => {
  await page.click('[data-act="excel-paste"]');
  await page.waitForTimeout(400);
};
const UNA_NOVA = 'Cultura\tBiblioteca de Reus\tReus\t3,5 M€\tInici obres\tSetembre 2026\tDelegació\t2';

check('Partim de 3 actuacions', (await worksCount()) === 3, String(await worksCount()));

// ═══ 1. MODE PER DEFECTE ═══
await openImport();
check('El mode per defecte és afegir, no substituir',
  (await page.locator('[data-mode="merge"]').getAttribute('aria-pressed')) === 'true');
check('El botó diu "Afegeix i actualitza"',
  /afegeix i actualitza/i.test(await page.locator('#xls-apply').innerText()));

// ═══ 2. AFEGIR UNA SOLA OBRA ═══
await page.fill('#xls-input', UNA_NOVA);
await page.waitForTimeout(300);
const prev1 = await page.locator('#xls-preview').innerText();
check('Compta 1 nova', /1\s*\n?\s*noves/i.test(prev1) || prev1.includes('1'), prev1.replace(/\n/g,' | '));
check('Diu que la resta es queda', /es queden com estan/i.test(prev1));
check('No avisa de cap esborrat', !/desapareixen/i.test(prev1));
check('Reconeix "Cultura" com a departament', !/no reconeixem/i.test(prev1));

await page.click('#xls-apply');
await page.waitForTimeout(800);
const sb1 = await page.evaluate(() => window.__sb);
check('NO esborra res del servidor', sb1.deletes === 0, 'deletes=' + sb1.deletes);
check('Només escriu la fila nova', sb1.upserts.length === 1, 'upserts=' + sb1.upserts.length);
check('Ara hi ha 4 actuacions', (await worksCount()) === 4, String(await worksCount()));

const totText = await page.locator('.content').innerText();
check('Les 3 anteriors segueixen', totText.includes('Hospital Mataró') && totText.includes('CAP Torredembarra') && totText.includes('Variant C-59'));
check("S'ha afegit la nova", totText.includes('Biblioteca de Reus'));

// ═══ 3. ACTUALITZAR CONSERVANT ELS COMENTARIS ═══
await openImport();
await page.fill('#xls-input', 'Salut\tHospital Mataró\tMataró\t70 M€\tAdjudicació\tSetembre 2026\t\t');
await page.waitForTimeout(300);
const prev2 = await page.locator('#xls-preview').innerText();
check('La detecta com a actualització, no com a nova', /actualitzades/i.test(prev2));
await page.click('#xls-apply');
await page.waitForTimeout(800);
const sb2 = await page.evaluate(() => window.__sb);
check('Segueix sense esborrar res', sb2.deletes === 0, 'deletes=' + sb2.deletes);
const mataro = sb2.upserts.find(r => r.obra === 'Hospital Mataró');
check("Manté el comentari escrit a l'app", mataro && mataro.comms === 'Roda de premsa amb la consellera', mataro ? mataro.comms : 'no trobada');
check('Manté el nivell', mataro && mataro.nivell === '3', mataro ? mataro.nivell : '—');
check('Manté la vegueria', mataro && mataro.vegueria === 'barcelona', mataro ? mataro.vegueria : '—');
check("Actualitza l'import", mataro && mataro.imp === '70 M€', mataro ? mataro.imp : '—');
check('Encara hi ha 4 actuacions', (await worksCount()) === 4, String(await worksCount()));

// ═══ 4. DEPARTAMENT NO RECONEGUT ═══
await openImport();
await page.fill('#xls-input', 'Vialitat\tPont nou\tLleida\t1 M€\tInici\tSetembre 2026\t\t');
await page.waitForTimeout(300);
const prev3 = await page.locator('#xls-preview').innerText();
check('Avisa del departament desconegut', /no reconeixem/i.test(prev3), prev3.replace(/\n/g,' | '));
await page.click('[data-close]');
await page.waitForTimeout(300);

// ═══ 4b. CAPÇALERA D'EXCEL ═══
// Enganxar amb la fila de títols no ha de crear una actuació fantasma.
await openImport();
await page.fill('#xls-input',
  'Departament\tObra\tUbicació\tImport\tFita\tData\tEncarregat\tNivell\n' +
  'Esports\tPavelló de Tremp\tTremp\t2 M€\tInici obres\tSetembre 2026\t\t1');
await page.waitForTimeout(300);
const prev3b = await page.locator('#xls-preview').innerText();
check('La capçalera no compta com a actuació', /\b1\b/.test(prev3b) && !/2\s*\n?\s*noves/i.test(prev3b), prev3b.replace(/\n/g,' | '));
check('Reconeix "Esports"', !/no reconeixem/i.test(prev3b));
await page.click('[data-close]');
await page.waitForTimeout(300);

// ═══ 5. MODE SUBSTITUIR ═══
await openImport();
await page.click('[data-mode="replace"]');
await page.fill('#xls-input', UNA_NOVA);
await page.waitForTimeout(300);
const prev4 = await page.locator('#xls-preview').innerText();
check('En mode substituir avisa que desapareixen', /desapareixen/i.test(prev4), prev4.replace(/\n/g,' | '));
check('Mostra l\'avís vermell', (await page.locator('#xls-preview .modal-err').count()) >= 1);
check('El botó canvia a "Substitueix-ho tot"',
  /substitueix-ho tot/i.test(await page.locator('#xls-apply').innerText()));

await page.click('#xls-apply');
await page.waitForTimeout(800);
const sb3 = await page.evaluate(() => window.__sb);
check('Ara sí esborra la taula', sb3.deletes === 1, 'deletes=' + sb3.deletes);
check('I insereix només la fila de l\'Excel', sb3.inserts.length === 1, 'inserts=' + sb3.inserts.length);
check('Queda 1 sola actuació', (await worksCount()) === 1, String(await worksCount()));

console.log(R.join('\n'));
console.log('\nErrors: ' + (errors.length ? '\n' + errors.join('\n') : 'cap'));
console.log('Fallades: ' + R.filter(r => r.startsWith('FAIL')).length);
await browser.close();
