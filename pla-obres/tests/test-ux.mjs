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

// ═══ 6. PLANTILLES PER NIVELL, PER FASES ═══
await page.click('.pill-item:has-text("CAP Torredembarra")'); await page.waitForTimeout(500);
check('Sense nivell, convida a triar-ne un',
  /tria un nivell/i.test(await page.locator('#drawer').innerText()));
check("Ofereix calcular el nivell per impacte",
  (await page.locator('[data-act="dw-impacte"]').count()) === 1);
check("Diu que la inversió no és qui mana",
  /criteri més exigent/i.test(await page.locator('.dw-suggest').innerText()),
  await page.locator('.dw-suggest').innerText());

// ── Calculadora d'impacte (secció 5 del protocol) ──
await page.click('[data-act="dw-impacte"]'); await page.waitForTimeout(500);
check('La calculadora té els 12 factors', (await page.locator('.imp-row').count()) === 12,
  String(await page.locator('.imp-row').count()));
check('Cada factor va de 0 a 3', (await page.locator('.imp-row >> nth=0 >> .imp-v').count()) === 4);
check('Comença a 0 punts i nivell 1',
  /\b0\b/.test(await page.locator('.imp-total').innerText()) &&
  /nivell 1/i.test(await page.locator('.imp-lv').innerText()));

// 12 factors × 1 punt = 12 → tram de 9 a 20 → nivell 2
for (let i = 0; i < 12; i++) await page.click(`.imp-row >> nth=${i} >> .imp-v[data-v="1"]`);
await page.waitForTimeout(300);
check('12 punts donen nivell 2',
  /nivell 2/i.test(await page.locator('.imp-lv').innerText()),
  await page.locator('.imp-total').innerText() + ' → ' + await page.locator('.imp-lv').innerText());

// 12 × 2 = 24 → més de 20 → nivell 3
for (let i = 0; i < 12; i++) await page.click(`.imp-row >> nth=${i} >> .imp-v[data-v="2"]`);
await page.waitForTimeout(300);
check('24 punts donen nivell 3', /nivell 3/i.test(await page.locator('.imp-lv').innerText()));

// L'afectació crítica mana per damunt de la puntuació
for (let i = 0; i < 12; i++) await page.click(`.imp-row >> nth=${i} >> .imp-v[data-v="0"]`);
await page.waitForTimeout(300);
check('Sense punts torna a nivell 1', /nivell 1/i.test(await page.locator('.imp-lv').innerText()));
await page.check('#imp-critica'); await page.waitForTimeout(300);
check("L'afectació crítica porta al nivell 3 amb 0 punts",
  /nivell 3/i.test(await page.locator('.imp-lv').innerText()),
  await page.locator('.imp-total').innerText());
await page.uncheck('#imp-critica'); await page.waitForTimeout(200);
for (let i = 0; i < 12; i++) await page.click(`.imp-row >> nth=${i} >> .imp-v[data-v="1"]`);
await page.waitForTimeout(300);
await page.click('#imp-apply'); await page.waitForTimeout(700);

const dw = await page.locator('#drawer').innerText();
check('Aplicar la puntuació posa el nivell a la fitxa', /nivell 2/i.test(dw));

// ── Accions per fases ──
check('Les accions surten separades per fases', (await page.locator('.tpl-fase').count()) === 3,
  String(await page.locator('.tpl-fase').count()));
check("Les fases són abans, durant i després",
  /abans de l'obra/i.test(dw) && /durant l'obra/i.test(dw) && /després de l'obra/i.test(dw));
// Nivell 2 del protocol: 10 abans + 11 durant + 6 després = 27
check('El comptador suma les 27 accions del Nivell 2',
  /0\s*\/\s*27/.test(await page.locator('.dw-tpl-n').innerText()),
  await page.locator('.dw-tpl-n').innerText());
// Aquesta ja té encarregat assignat: no ha de sortir cap avís.
check("Amb responsable assignat no avisa de res",
  (await page.locator('.dw-tpl-warn').count()) === 0);

await page.click('.tpl-fase >> nth=0 >> .tpl-item >> nth=0'); await page.waitForTimeout(600);
const comms1 = await page.locator('#drawer [data-dwfield="comms"]').inputValue();
check("Clicar una acció l'escriu al pla",
  comms1.includes("Pla específic de comunicació de proximitat"), comms1.replace(/\n/g,' | '));
check("I l'escriu sota la seva fase", /ABANS DE L'OBRA/i.test(comms1), comms1.replace(/\n/g,' | '));

await page.click('.tpl-fase >> nth=0 >> .tpl-all'); await page.waitForTimeout(800);
const comms2 = await page.locator('#drawer [data-dwfield="comms"]').inputValue();
check('Afegeix tota la fase completa les 10 de "abans"',
  /10\s*\/\s*10/.test(await page.locator('.tpl-fase >> nth=0 >> .tpl-fase-n').innerText()),
  await page.locator('.tpl-fase >> nth=0 >> .tpl-fase-n').innerText());
check('Sense duplicar la que ja hi era',
  comms2.split("Pla específic de comunicació de proximitat").length - 1 === 1);
check("Les altres fases segueixen buides",
  /0\s*\/\s*11/.test(await page.locator('.tpl-fase >> nth=1 >> .tpl-fase-n').innerText()));

await page.click('.dw-close'); await page.waitForTimeout(400);
check('Ja no surt com a pendent',
  (await page.locator('.pill-item.pending').count()) === 2,
  String(await page.locator('.pill-item.pending').count()));

// El protocol demana responsable de comunicació als nivells 2 i 3: aquesta
// no en té, així que en posar-li un nivell 2 ha d'avisar.
await page.click('.pill-item:has-text("Biblioteca de Reus")'); await page.waitForTimeout(500);
check('Sense nivell encara no avisa', (await page.locator('.dw-tpl-warn').count()) === 0);
await page.click('[data-act="dw-nivell"][data-key="1"]'); await page.waitForTimeout(600);
check('El nivell 1 no necessita responsable', (await page.locator('.dw-tpl-warn').count()) === 0);
await page.click('[data-act="dw-nivell"][data-key="2"]'); await page.waitForTimeout(600);
check("El nivell 2 sí que reclama responsable",
  (await page.locator('.dw-tpl-warn').count()) === 1,
  await page.locator('#drawer').innerText().then(x => /responsable/i.test(x) ? 'avisa' : 'no avisa'));
await page.click('[data-act="dw-enc"][data-key="delegacio"]'); await page.waitForTimeout(600);
check("En assignar-lo, l'avís desapareix", (await page.locator('.dw-tpl-warn').count()) === 0);
await page.click('.dw-close'); await page.waitForTimeout(400);

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
