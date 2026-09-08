// Un mateix projecte pot tenir diverses fites («Nova seu DTG Lleida» n'arriba
// a tenir 4 al seed real). Abans, l'importador feia correspondre les files
// del full només per "obra": si dues files enganxades compartien el nom
// d'una obra que ja existia, totes dues es lligaven a LA MATEIXA fila
// existent i una fita es perdia en silenci — exactament el que va passar
// amb dades reals ("Nova seu corporativa del Tribunal d'Instància").
import { chromium } from 'playwright';
import fs from 'fs';

const rows = [
  // Un projecte amb una sola fita existent, que ara rep una actualització
  // d'aquesta fita I una fita nova alhora (cas real).
  { id:'a', dept:'JUS', obra:"Nova seu del Tribunal", loc:'Falset', imp:'3,0 M€', fita:'Licitació de la construcció', data:'', bucket:'SENSE', vegueria:'', encarregat:'', nivell:'', top:false, comms:'', status:'todo', sort_order:1, updated_at:new Date().toISOString() },
  // Un projecte que ja té dues fites amb el mateix nom d'obra (com passa
  // de veritat al pla amb "Nova seu DTG Lleida").
  { id:'b', dept:'TER', obra:'Nova seu DTG', loc:'Lleida', imp:'', fita:'Entrega avantprojecte', data:'Juliol 2026', bucket:'SENSE', vegueria:'', encarregat:'', nivell:'', top:false, comms:'', status:'todo', sort_order:2, updated_at:new Date().toISOString() },
  { id:'c', dept:'TER', obra:'Nova seu DTG', loc:'Lleida', imp:'', fita:'Entrega projecte bàsic', data:'Desembre 2026', bucket:'SENSE', vegueria:'', encarregat:'', nivell:'', top:false, comms:'', status:'todo', sort_order:3, updated_at:new Date().toISOString() }
];

const mockSb = `
window.__sb = { upserts:[] };
window.createSupabaseClient=function(){
  const rows=${JSON.stringify(rows)};
  const settings={password_hash:'5e22854f87ae1293d56afa21fe1ab6461d5d91f61ed84617cd54944f626fdb6a'};
  const history=[]; const chan={on:()=>chan,subscribe:()=>chan};
  function b(t){const o={};let fv=null;
    o.select=()=>o;o.order=()=>o;o.limit=()=>o;o.neq=()=>o;o.delete=()=>o;
    o.eq=(c,v)=>{fv=v;return o;};
    o.maybeSingle=async()=>t==='app_settings'?{data:settings[fv]?{value:settings[fv]}:null,error:null}:{data:null,error:null};
    o.insert=async()=>({error:null});
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
await page.click('.fb-clear'); await page.waitForTimeout(500);

const worksCount = () => page.locator('.pill-item, .fc').count();
const openImport = async () => {
  await page.click('details.menu > summary');
  await page.waitForTimeout(150);
  await page.click('[data-act="excel-paste"]');
  await page.waitForTimeout(400);
};

check('Partim de 3 fites (2 projectes)', (await worksCount()) === 3, String(await worksCount()));

// ═══ CAS 1: una fita s'actualitza I n'arriba una de nova, mateixa obra ═══
await openImport();
await page.fill('#xls-input',
  "Justícia i Qualitat Democràtica\tNova seu del Tribunal\tFalset\t3,0 M€\tLicitació del projecte\t1T 2027\t\t\n" +
  "Justícia i Qualitat Democràtica\tNova seu del Tribunal\tFalset\t3,0 M€\tSignatura del protocol\t4T 2026\t\t");
await page.waitForTimeout(400);
const prev = await page.locator('#xls-preview').innerText();
// Una és actualització de la fita existent, l'altra és una fita nova pel mateix projecte.
check('Detecta 1 nova i 1 actualitzada, no 2 noves ni 2 actualitzades',
  /1\s*\n?\s*noves/.test(prev) && /1\s*\n?\s*actualitzades/.test(prev), prev.replace(/\n/g,' | '));

await page.click('#xls-apply'); await page.waitForTimeout(800);
const sb = await page.evaluate(() => window.__sb);
check('No hi ha dos registres amb el mateix identificador',
  new Set(sb.upserts.map(r => r.id)).size === sb.upserts.length,
  'ids: ' + sb.upserts.map(r => r.id).join(','));
check('Ara hi ha 4 fites en total (3 originals + 1 de nova)',
  (await worksCount()) === 4, String(await worksCount()));

const fites1 = await page.evaluate(() => window.state.rows.filter(r => r.obra === 'Nova seu del Tribunal').map(r => r.fita));
check('La fita antiga ha canviat de nom (ja no hi és)', !fites1.includes('Licitació de la construcció'), fites1.join(' | '));
check('Hi ha la fita actualitzada', fites1.includes('Licitació del projecte'), fites1.join(' | '));
check('I també la fita nova, no n\'ha desaparegut cap', fites1.includes('Signatura del protocol'), fites1.join(' | '));

// ═══ CAS 2: un projecte amb 2 fites existents; el full només en toca una ═══
await openImport();
await page.fill('#xls-input',
  "Territori, Habitatge i Transició Ecològica\tNova seu DTG\tLleida\t\tEntrega projecte bàsic\tGener 2027\t\t");
await page.waitForTimeout(400);
const prev2 = await page.locator('#xls-preview').innerText();
check('Amb 2 fites existents i la mateixa obra, actualitza la que coincideix per fita',
  /1\s*\n?\s*actualitzades/.test(prev2) && /0\s*\n?\s*noves/.test(prev2), prev2.replace(/\n/g,' | '));
await page.click('#xls-apply'); await page.waitForTimeout(800);
check('Segueixen sent 4 fites: no se n\'ha duplicat ni perdut cap',
  (await worksCount()) === 4, String(await worksCount()));
const seu = await page.evaluate(() => window.state.rows.filter(r => r.obra === 'Nova seu DTG').map(r => [r.fita, r.data]));
check('La data de la fita tocada s\'ha actualitzat', seu.some(([f,d]) => f === 'Entrega projecte bàsic' && d === 'Gener 2027'), JSON.stringify(seu));
check('L\'altra fita del mateix projecte no s\'ha tocat', seu.some(([f,d]) => f === 'Entrega avantprojecte' && d === 'Juliol 2026'), JSON.stringify(seu));

console.log(R.join('\n'));
console.log('\nErrors: ' + (errors.length ? '\n' + errors.join('\n') : 'cap'));
console.log('Fallades: ' + R.filter(r => r.startsWith('FAIL')).length);
await browser.close();
