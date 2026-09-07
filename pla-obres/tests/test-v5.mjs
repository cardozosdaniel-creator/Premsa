import { chromium } from 'playwright';
import fs from 'fs';

const rows = [
  { id:'a', dept:'SLT', obra:'Hospital Mataró', loc:'Mataró', imp:'61,74 M€', fita:'Licitació', data:'Setembre 2026', bucket:'2026-Q3', vegueria:'barcelona', encarregat:'', nivell:'3', top:false, comms:'Roda de premsa', status:'doing', sort_order:1, updated_at:new Date().toISOString() },
  { id:'b', dept:'SLT', obra:'CAP Torredembarra', loc:'Torredembarra', imp:'11,51 M€', fita:'Licitació', data:'Setembre 2026', bucket:'2026-Q3', vegueria:'camp-tarragona', encarregat:'delegacio', nivell:'2', top:false, comms:'', status:'todo', sort_order:2, updated_at:new Date().toISOString() },
  { id:'c', dept:'PRE', obra:'CAP Palafrugell', loc:'Palafrugell', imp:'4,99 M€', fita:'Licitació', data:'Setembre 2026', bucket:'2026-Q3', vegueria:'comarques-gironines', encarregat:'', nivell:'1', top:false, comms:'', status:'todo', sort_order:3, updated_at:new Date().toISOString() },
  { id:'d', dept:'ISP', obra:'Obra sense import', loc:'Vic', imp:'', fita:'Inici', data:'Setembre 2026', bucket:'2026-Q3', vegueria:'catalunya-central', encarregat:'', nivell:'', top:false, comms:'', status:'todo', sort_order:4, updated_at:new Date().toISOString() },
  { id:'e', dept:'TER', obra:'Variant C-59', loc:'Sant Feliu de Codines', imp:'15 M€', fita:'Inici obres', data:'Octubre 2026', bucket:'2026-Q4', vegueria:'barcelona', encarregat:'conseller', nivell:'3', top:true, comms:'Visita del conseller', status:'todo', sort_order:5, updated_at:new Date().toISOString() },
  { id:'f', dept:'ARP', obra:'Fotovoltaica Flix', loc:'Flix', imp:'2 M€', fita:'Obra', data:'Desembre 2026', bucket:'2026-Q4', vegueria:'terres-ebre', encarregat:'', nivell:'1', top:false, comms:'', status:'todo', sort_order:6, updated_at:new Date().toISOString() }
];

const mockSb = `
window.createSupabaseClient=function(){
  const rows=${JSON.stringify(rows)};
  const settings={password_hash:'5e22854f87ae1293d56afa21fe1ab6461d5d91f61ed84617cd54944f626fdb6a'};
  const history=[]; const chan={on:()=>chan,subscribe:()=>chan};
  function b(t){const o={};let fv=null;
    o.select=()=>o;o.order=()=>o;o.limit=()=>o;o.neq=()=>o;o.delete=()=>o;
    o.eq=(c,v)=>{fv=v;return o;};
    o.maybeSingle=async()=>t==='app_settings'?{data:settings[fv]?{value:settings[fv]}:null,error:null}:{data:null,error:null};
    o.insert=async()=>({error:null}); o.upsert=async()=>({error:null});
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
// La primera visita entra enfocada (pendents, sense mesos passats).
// Per a la resta de proves volem el tauler sencer.
await page.click('.fb-clear'); await page.waitForTimeout(500);

// ═══ 5. ORDRE PER INVERSIÓ ═══
const setLane = page.locator('.lane[data-month="2026-09"]');
const names = await setLane.locator('.pill-name').allInnerTexts();
check('Ordre per inversió (gran→petita)',
  names[0].includes('Mataró') && names[1].includes('Torredembarra') && names[2].includes('Palafrugell'),
  names.join(' / '));
check('Sense import va al final', names[3].includes('sense import'), names[3]);

// ═══ 1. DESPLEGAR UN MES ═══
check('Carrils comencen plegats', (await page.locator('.lane.expanded').count()) === 0);
check('Cel·la del mes és clicable', (await setLane.locator('.lane-gutter[data-act="toggle-month"]').count()) === 1);
await setLane.locator('.lane-gutter').click();
await page.waitForTimeout(400);
check('Clicar el mes desplega el carril', (await page.locator('.lane[data-month="2026-09"].expanded').count()) === 1);
check('Es mostren fitxes completes', (await setLane.locator('.fc').count()) === 4);
check('Les píndoles compactes desapareixen', (await setLane.locator('.pill-item').count()) === 0);
check('Fitxa mostra ubicació', (await setLane.locator('.fc').first().innerText()).includes('Mataró'));
check('Fitxa mostra import', (await setLane.locator('.fc').first().innerText()).includes('61,74'));
check('Fitxa mostra accions de comunicació', (await setLane.locator('.fc').first().innerText()).includes('Roda de premsa'));
check('Altres mesos segueixen plegats', (await page.locator('.lane[data-month="2026-10"] .pill-item').count()) === 1);
// Clic a una fitxa completa obre el drawer
await setLane.locator('.fc').first().click();
await page.waitForTimeout(400);
check('Clicar la fitxa completa obre el drawer', (await page.locator('#drawer.open').count()) === 1);
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
// Plegar
await setLane.locator('.lane-gutter').click();
await page.waitForTimeout(400);
check('Tornar a clicar plega el carril', (await page.locator('.lane[data-month="2026-09"].expanded').count()) === 0);
// Botó global
await page.click('#btn-expand-all');
await page.waitForTimeout(500);
check('Botó global desplega tots els mesos', (await page.locator('.lane.expanded').count()) === 3);
check('El botó canvia a "Plega-ho tot"', (await page.locator('#btn-expand-all').innerText()).includes('Plega'));
await page.click('#btn-expand-all');
await page.waitForTimeout(400);
check('Botó global plega tot', (await page.locator('.lane.expanded').count()) === 0);

// ═══ 4. EXPLICACIÓ DELS NIVELLS ═══
check('Hi ha ajuda dels nivells', (await page.locator('.lvl-help').count()) === 1);
await page.click('.lvl-help > summary');
await page.waitForTimeout(300);
const lvlText = await page.locator('.lvl-help-body').innerText();
check('Explica N1 (bàsic)', /b[àa]sica/i.test(lvlText) && /cartell/i.test(lvlText));
check('Explica N2 (reforçat)', /refor/i.test(lvlText) && /bustiada/i.test(lvlText));
check('Explica N3 (intensiu)', /intensiva/i.test(lvlText) && /oficina/i.test(lvlText));
check('Explica el criteri (el més exigent)', /m[ée]s exigent/.test(lvlText));
// El protocol és explícit sobre això i és el que més es malinterpreta.
check("Diu que l'impacte mana sobre la inversió", /impacte.*determinar la intensitat/is.test(lvlText));
check('Recull el cas de baixa inversió amb molt impacte',
  /baixa inversió amb afectació ciutadana molt elevada/i.test(lvlText));

// ═══ 2. PDF NO EN BLANC ═══
await page.emulateMedia({ media:'print' });
await page.waitForTimeout(400);
const pvVisible = await page.locator('#printview').isVisible();
check('El printview és VISIBLE en imprimir (bug del PDF en blanc)', pvVisible);
const pvBox = await page.locator('#printview').boundingBox();
check('El printview té alçada real', pvBox && pvBox.height > 500, pvBox ? `${Math.round(pvBox.height)}px` : 'null');
const pvTxt = await page.locator('#printview').innerText();
check('PDF conté la portada', pvTxt.includes('Dossier executiu'));
check('PDF conté el sumari', pvTxt.includes('Sumari executiu'));
check('PDF conté les obres', pvTxt.includes('Hospital Mataró'));
check('PDF agrupat per mes', pvTxt.includes('Setembre 2026'));
check('PDF diu la selecció aplicada', /selecci/i.test(pvTxt));   // el títol va en majúscules per CSS
await page.emulateMedia({ media:'screen' });
await page.waitForTimeout(200);

// PDF amb filtres aplicats
await page.click('.sidebar #deptchips .chip:has-text("Salut")');
await page.waitForTimeout(400);
const pvFiltered = await page.locator('#printview').innerText();
check('El PDF respecta els filtres', pvFiltered.includes('Salut') && !pvFiltered.includes('Variant C-59'));
check('El PDF llista el filtre actiu', /Departaments: Salut/.test(pvFiltered));
await page.click('#btn-clear'); await page.waitForTimeout(400);

// ═══ 3. FITXES SOTA EL MAPA ═══
await page.click('.view-tab[data-view="mapa"]');
await page.waitForTimeout(600);
check('El mapa mostra el llistat sota', (await page.locator('.map-list').count()) === 1);
check('Fitxes completes sota el mapa', (await page.locator('.map-list .fc').count()) === 6);
check('Agrupades per vegueria', (await page.locator('.mv-group').count()) >= 4);
const mapTxt = await page.locator('.map-list').innerText();
check('Els grups porten el nom de la vegueria', mapTxt.includes('Barcelona') && mapTxt.includes("Terres de l'Ebre"));
// Clicar una vegueria filtra el llistat
await page.locator('g[data-key="barcelona"] .veg-shape').first().click();
await page.waitForTimeout(500);
check('Clicar la vegueria filtra el llistat', (await page.locator('.map-list .fc').count()) === 2);
check('El títol del llistat reflecteix la selecció',
  /barcelona/i.test(await page.locator('.map-list-head').innerText()));   // majúscules per CSS
await page.click('[data-act="veg-clear"]');
await page.waitForTimeout(400);
check('Netejar torna a mostrar-ho tot', (await page.locator('.map-list .fc').count()) === 6);
await page.click('.view-tab[data-view="calendari"]'); await page.waitForTimeout(400);

// Sense scroll horitzontal
await page.evaluate(() => document.querySelectorAll('details.menu[open]').forEach(d => d.open = false));
await page.waitForTimeout(200);
const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
check('Sense scroll horitzontal', ov <= 0, `${ov}px`);

// Captures
await page.click('#btn-expand-all'); await page.waitForTimeout(500);
await page.screenshot({ path:'v5-expanded.png' });
await page.click('#btn-expand-all'); await page.waitForTimeout(300);
await page.click('.view-tab[data-view="mapa"]'); await page.waitForTimeout(600);
await page.screenshot({ path:'v5-map.png', fullPage:true });
await page.click('.view-tab[data-view="calendari"]'); await page.waitForTimeout(300);
await page.emulateMedia({ media:'print' }); await page.waitForTimeout(400);
await page.screenshot({ path:'v5-pdf.png', fullPage:true });
await page.emulateMedia({ media:'screen' });

console.log(R.join('\n'));
console.log('\nErrors: ' + (errors.length ? errors.join('\n') : 'cap'));
console.log('Fallades: ' + R.filter(r=>r.startsWith('FAIL')).length);

fs.unlinkSync('config.js');
await browser.close();
