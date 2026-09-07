// Proves del recorregut d'ús: entrada enfocada, marca de pendent, alta d'una
// actuació, plantilles per nivell i novetats des de l'última visita.
import { chromium } from 'playwright';
import fs from 'fs';

const rows = [
  { id:'a', dept:'SLT', obra:'Hospital Mataró', loc:'Mataró', imp:'61,74 M€', fita:'Licitació', data:'Setembre 2026', bucket:'2026-Q3', vegueria:'barcelona', encarregat:'', nivell:'3', top:false, comms:'Roda de premsa amb la consellera', status:'doing', sort_order:1, updated_at:new Date().toISOString() },
  { id:'b', dept:'SLT', obra:'CAP Torredembarra', loc:'Torredembarra', imp:'11,51 M€', fita:'Licitació', data:'Setembre 2026', bucket:'2026-Q3', vegueria:'camp-tarragona', encarregat:'delegacio', nivell:'', top:false, comms:'', status:'todo', sort_order:2, updated_at:new Date().toISOString() },
  { id:'c', dept:'CLT', obra:'Biblioteca de Reus', loc:'Reus', imp:'3,2 M€', fita:'Inici obres', data:'Octubre 2026', bucket:'2026-Q4', vegueria:'camp-tarragona', encarregat:'', nivell:'', top:false, comms:'', status:'todo', sort_order:3, updated_at:new Date().toISOString() }
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

// ═══ 1. IDENTIFICACIÓ AMB DEPARTAMENT ═══
check('Es demana el departament en identificar-se', (await page.locator('#signin-dept').count()) === 1);
await page.fill('#signin-input','Anna Sala');
await page.selectOption('#signin-dept','SLT');
await page.fill('#signin-email','admin@exemple.cat');
await page.click('#signin-ok'); await page.waitForTimeout(700);

// ═══ 2. ENTRADA ENFOCADA ═══
const fb = await page.locator('#focus-bar').innerText();
check('Hi ha banda de context', fb.length > 0, fb.replace(/\n/g,' | '));
check('Diu el departament', /salut/i.test(fb));
check('Diu que només mostra les pendents', /pendents/i.test(fb));
check('Ofereix la sortida', (await page.locator('.fb-clear').count()) === 1);
// Només la de Salut sense accions: l'Hospital ja té comentari, i Cultura no és seu.
check('Només veu la seva feina pendent', (await page.locator('.pill-item').count()) === 1,
  String(await page.locator('.pill-item').count()));

await page.click('.fb-clear'); await page.waitForTimeout(500);
check('Veure-ho tot mostra les 3', (await page.locator('.pill-item').count()) === 3,
  String(await page.locator('.pill-item').count()));
check('La banda desapareix sense filtres', (await page.locator('#focus-bar').innerText()).trim() === '');

// ═══ 3. MARCA DE PENDENT ═══
check('Les que no tenen accions surten marcades', (await page.locator('.pill-item.pending').count()) === 2,
  String(await page.locator('.pill-item.pending').count()));
check("La que en té no surt marcada", (await page.locator('.pill-item:not(.pending)').count()) === 1);

// ═══ 4. SELECTOR TOTES / PENDENTS ═══
await page.click('[data-act="scope-pending"]'); await page.waitForTimeout(400);
check('Pendents en filtra dues', (await page.locator('.pill-item').count()) === 2);
check('El selector marca on som',
  (await page.locator('[data-act="scope-pending"]').getAttribute('aria-pressed')) === 'true');
await page.click('[data-act="scope-all"]'); await page.waitForTimeout(400);
check('Totes les torna a mostrar', (await page.locator('.pill-item').count()) === 3);

// ═══ 5. ALTA D'UNA ACTUACIÓ ═══
check('Hi ha botó global de nova actuació', (await page.locator('#btn-new').count()) === 1);
await page.click('#btn-new'); await page.waitForTimeout(700);
check("S'obre la fitxa de la nova", (await page.locator('#drawer.open').count()) === 1);
check('Amb el títol buit i enfocat',
  (await page.evaluate(() => document.activeElement?.dataset?.dwfield)) === 'obra');
await page.click('.dw-close'); await page.waitForTimeout(400);
check('Ara n\'hi ha 4', (await page.locator('.pill-item').count()) === 4,
  String(await page.locator('.pill-item').count()));

// El botó del carril hi és també amb el mes desplegat (abans desapareixia)
await page.click('.lane[data-month="2026-09"] .lane-gutter'); await page.waitForTimeout(500);
check('El botó d\'afegir sobreviu al mes desplegat',
  (await page.locator('.lane[data-month="2026-09"] .pill-add').count()) === 1);
await page.click('.lane[data-month="2026-09"] .lane-gutter'); await page.waitForTimeout(400);

// ═══ 6. PLANTILLES PER NIVELL ═══
await page.click('.pill-item:has-text("CAP Torredembarra")'); await page.waitForTimeout(500);
check('Sense nivell, convida a triar-ne un',
  /tria un nivell/i.test(await page.locator('#drawer').innerText()));
check('Proposa un nivell per inversió',
  /per inversió/i.test(await page.locator('#drawer').innerText()),
  (await page.locator('.dw-suggest').count()) ? 'hi és' : 'no hi és');
// 11,51 M€ → entre 5 i 20 → Nivell 2
await page.click('.dw-suggest-go'); await page.waitForTimeout(600);
const dw = await page.locator('#drawer').innerText();
check('Aplicar la proposta posa el Nivell 2', /nivell 2/i.test(dw));
check('Apareixen les accions del nivell', (await page.locator('.tpl-item').count()) === 8,
  String(await page.locator('.tpl-item').count()));
check('Cap marcada encara', (await page.locator('.tpl-item.on').count()) === 0);

await page.click('.tpl-item >> nth=0'); await page.waitForTimeout(600);
const comms1 = await page.locator('#drawer [data-dwfield="comms"]').inputValue();
check("Clicar una acció l'escriu al pla", comms1.includes("Cartell informatiu a peu d'obra"), comms1);
check('I queda marcada', (await page.locator('.tpl-item.on').count()) === 1);

await page.click('.tpl-all'); await page.waitForTimeout(700);
const comms2 = await page.locator('#drawer [data-dwfield="comms"]').inputValue();
check('Afegeix-les totes completa la llista', (await page.locator('.tpl-item.on').count()) === 8,
  String(await page.locator('.tpl-item.on').count()));
check('Sense duplicar la que ja hi era',
  comms2.split("Cartell informatiu a peu d'obra").length - 1 === 1);
check('El comptador ho reflecteix', /8\s*\/\s*8/.test(await page.locator('.dw-tpl-n').innerText()));
await page.click('.dw-close'); await page.waitForTimeout(400);
check('Ja no surt com a pendent',
  (await page.locator('.pill-item.pending').count()) === 2,
  String(await page.locator('.pill-item.pending').count()));

// ═══ 7. EL QUE HEM TRET ═══
check("No queda el mode d'edició global", (await page.locator('#btn-edit').count()) === 0);
check('Un sol botó de PDF', (await page.locator('[data-act="print"]').count()) === 1);
check('Sense menú d\'exportació', (await page.locator('[data-act="download-pdf"]').count()) === 0);
check("L'import Excel ja no és el botó estrella del lateral",
  (await page.locator('.sidebar .cta-import').count()) === 0);

console.log(R.join('\n'));
console.log('\nErrors: ' + (errors.length ? '\n' + errors.join('\n') : 'cap'));
console.log('Fallades: ' + R.filter(r => r.startsWith('FAIL')).length);
await browser.close();
