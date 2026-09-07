// Prova del resum «novetats des de la teva última visita»: hi ha d'aparèixer
// només el que han tocat els altres després de la nostra última entrada.
import { chromium } from 'playwright';
import fs from 'fs';

const now = Date.now();
const lastVisit = now - 3 * 3600 * 1000;          // vam entrar fa tres hores
const t = (msAgo) => new Date(now - msAgo).toISOString();

const rows = [
  { id:'a', dept:'SLT', obra:'Hospital Mataró', loc:'Mataró', imp:'61,74 M€', fita:'Licitació', data:'Setembre 2026', bucket:'2026-Q3', vegueria:'barcelona', encarregat:'', nivell:'3', top:false, comms:'Roda de premsa', status:'doing', sort_order:1, updated_at:t(0) }
];

const history = [
  // Abans de la nostra última visita: no ha de comptar.
  { id:'h0', ts:t(5*3600*1000), user_name:'Marc Puig', kind:'edit', row_id:'a', row_label:'Hospital Mataró', field:'comms', before_val:'', after_val:'Nota', extra:null },
  // Després, i d'altres persones: sí.
  { id:'h1', ts:t(2*3600*1000), user_name:'Marc Puig', kind:'edit', row_id:'a', row_label:'Hospital Mataró', field:'comms', before_val:'Nota', after_val:'Roda de premsa', extra:null },
  { id:'h2', ts:t(1*3600*1000), user_name:'Júlia Roca', kind:'add', row_id:'z', row_label:'Nova obra', field:null, before_val:null, after_val:null, extra:null },
  // Nostre: no ens hem d'anunciar els propis canvis.
  { id:'h3', ts:t(30*60*1000), user_name:'Anna Sala', kind:'edit', row_id:'a', row_label:'Hospital Mataró', field:'fita', before_val:'x', after_val:'y', extra:null }
];

const mockSb = `
window.createSupabaseClient=function(){
  const rows=${JSON.stringify(rows)};
  const history=${JSON.stringify(history)};
  const settings={password_hash:'5e22854f87ae1293d56afa21fe1ab6461d5d91f61ed84617cd54944f626fdb6a'};
  const chan={on:()=>chan,subscribe:()=>chan};
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

// Simulem que ja hem entrat abans: nom, departament i marca de temps.
// Només un cop: si ho sembréssim a cada navegació, la recàrrega del final
// esborraria justament el que volem comprovar.
const seedPrefs = `
try{
  if (!sessionStorage.getItem("test-seeded")){
    localStorage.setItem("plaObresLocal.v3", JSON.stringify({
      currentUser:"Anna Sala", currentEmail:"admin@exemple.cat", myDept:null,
      depts:[], statuses:[], pending:false, hidePast:false, seenAt:${lastVisit}
    }));
    sessionStorage.setItem("test-seeded","1");
  }
}catch(e){}
try{ sessionStorage.setItem("pla-obres-auth","1"); }catch(e){}
`;

fs.writeFileSync('config.js', `window.APP_CONFIG={supabaseUrl:"https://x.supabase.co",supabaseAnonKey:"k",adminEmails:["admin@exemple.cat"]};`);

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport:{ width:1500, height:1000 }});
const page = await ctx.newPage();
await page.addInitScript(seedPrefs);
await page.addInitScript(mockSb);
await page.route('**/esm.sh/**', r=>r.abort());
await page.route('**/fonts.googleapis.com/**', r=>r.abort());
await page.route('**/fonts.gstatic.com/**', r=>r.abort());

const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('console', m => { const x=m.text(); if (m.type()==='error' && !x.includes('net::ERR') && !x.includes('Failed to load')) errors.push('['+m.type()+'] '+x); });

await page.goto('file://' + process.cwd() + '/index.html');
await page.waitForTimeout(1600);
const R = [];
const check = (n, ok, d='') => R.push(`${ok?'PASS':'FAIL'}  ${n}${d?' — '+d:''}`);

check('No torna a demanar la contrasenya ni el nom', (await page.locator('#signin-input').count()) === 0);

const wn = await page.locator('#whatsnew').innerText();
check('Surt el resum de novetats', wn.trim().length > 0, wn.replace(/\n/g,' | '));
check('Compta només els posteriors a l\'última visita', /\b2 canvis\b/.test(wn), wn.replace(/\n/g,' | '));
check('No compta els nostres', !/Anna Sala/.test(wn));
check('Anomena qui els ha fet', /Marc Puig/.test(wn) && /Júlia Roca/.test(wn));

await page.click('.wn-close'); await page.waitForTimeout(300);
check('Es pot descartar', (await page.locator('#whatsnew').innerText()).trim() === '');

await page.reload(); await page.waitForTimeout(1600);
check('Després de tornar a entrar, ja no hi ha novetats pendents',
  (await page.locator('#whatsnew').innerText()).trim() === '');

console.log(R.join('\n'));
console.log('\nErrors: ' + (errors.length ? '\n' + errors.join('\n') : 'cap'));
console.log('Fallades: ' + R.filter(r => r.startsWith('FAIL')).length);
await browser.close();
