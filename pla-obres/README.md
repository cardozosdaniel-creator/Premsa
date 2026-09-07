# Pla de comunicació d'obres — aplicació col·laborativa

Eina web per planificar la comunicació d'obres i actuacions del Govern, amb
edició en temps real per part de diverses persones alhora, filtres per
departament / encarregat / vegueria / nivell del pla de comunicació, i
exportació a PDF.

- **Backend:** Supabase (Postgres + Realtime)
- **Frontend:** una sola pàgina HTML autònoma, hostejada a Vercel
- **Auth:** contrasenya compartida + nom per identificar l'autor de cada canvi
- **Cost:** 0 € amb els plans gratuïts (pilot fins a ~50 col·laboradors)

---

## Què hi ha en aquesta carpeta

```
pla-obres/
├── index.html              ← l'aplicació sencera
├── vegueries-geo.js        ← formes SVG de les vegueries (mapa)
├── vegueries-map.js        ← municipi → vegueria (auto-map)
├── build.mjs               ← genera dist/ + config.js des de variables d'entorn
├── vercel.json             ← configuració del hosting
├── config.js.example       ← plantilla de configuració (per treballar en local)
├── supabase/
│   ├── 01-schema.sql       ← crea les taules
│   └── 02-seed.sql         ← insereix les 118 obres inicials
├── tests/                  ← proves automàtiques (Playwright)
└── README.md               ← aquest fitxer
```

> **Nota sobre `vegueries-geo.js`.** Són les 8 vegueries projectades al viewBox
> `0 0 800 600` a partir del GeoJSON oficial de l'ICGC (divisions
> administratives v2r2, vegueries 1:5.000), simplificades a ~180 punts per
> polígon perquè el fitxer sigui lleuger al navegador. La Val d'Aran hi va
> fusionada dins d'`alt-pirineu-aran`. Si el regeneres, exporta sempre
> `window.VEGUERIA_SHAPES` i `window.VEGUERIA_VIEWBOX` alhora.

---

## Desplegament automàtic: GitHub → Vercel

Aquest és el flux recomanat. Un cop configurat, **cada canvi que es pugi a
GitHub es publica sol**: no cal descarregar ni tornar a pujar res a mà.

```
   canvis al codi  →  push a GitHub  →  Vercel detecta el push
                                     →  executa build.mjs
                                     →  publica la web
                                        ↕ (des del navegador)
                                        Supabase (dades en temps real)
```

Supabase **no** cal connectar-lo a GitHub: l'app hi parla directament des del
navegador de cada usuari. El que sí que canvia és **d'on surten les
credencials**.

### 1. Les credencials van a Vercel, no al repositori

Aquest repositori és **públic**. Per això `config.js` està al `.gitignore` i
**no es puja mai**. En comptes d'això, `build.mjs` el genera durant el
desplegament a partir de tres variables d'entorn.

A Vercel: **Settings → Environment Variables**, i afegeix-hi (marcant els tres
entorns: Production, Preview i Development):

| Nom | Valor |
|---|---|
| `SUPABASE_URL` | `https://XXXX.supabase.co` |
| `SUPABASE_ANON_KEY` | la clau `anon public` / `publishable` |
| `ADMIN_EMAILS` | correus d'admin separats per comes |

### 2. Connectar el repositori a Vercel

1. A Vercel: **Add New → Project → Import Git Repository**
2. Tria el repositori `Premsa`
3. A «Configure Project»:
    - **Framework Preset**: `Other`
    - **Root Directory**: `pla-obres` ← **important**, l'arrel del repositori
      conté un projecte diferent
    - Build Command i Output Directory els agafa de `vercel.json`
      (`node build.mjs` → `dist`)
4. **Deploy**

### 3. Branca de producció

Per defecte Vercel publica a producció la branca per defecte del repositori
(`main`). Les altres branques generen **desplegaments de previsualització**
amb URL pròpia, útils per revisar un canvi abans de publicar-lo.

Si vols que els canvis d'una branca de treball surtin a producció, cal
fusionar-la a `main` (o canviar la branca de producció a
**Settings → Git → Production Branch**).

### ⚠️ Nota de seguretat important

Les taules de Supabase tenen **RLS desactivat**. Això vol dir que qualsevol
que tingui la clau `anon` pot llegir i escriure a la base de dades
directament, sense passar per la contrasenya de l'app. Com que la clau
s'envia al navegador, l'obté qualsevol persona que obri la web.

Treure `config.js` del repositori públic evita que els robots que rastregen
GitHub la trobin, però **no resol el fons del problema**. Per a un pilot
intern amb una URL discreta pot ser acceptable; abans d'obrir-ho més, cal
decidir entre:

- fer el repositori **privat**, i/o
- activar **RLS** amb autenticació real de Supabase (no només la contrasenya
  compartida).

---

## Provar-ho en local

```bash
cd pla-obres
cp config.js.example config.js     # omple-hi les credencials (ignorat per git)
python3 -m http.server 8000        # i obre http://localhost:8000
```

Per executar les proves automàtiques:

```bash
npm install playwright
node tests/test-v5.mjs             # calendari, PDF, mapa, nivells
node tests/test-import.mjs         # importació d'Excel (els dos modes)
# atenció: sobreescriuen config.js amb un mock — recupera'l després
```

---

## Desplegament manual (alternativa, 15 minuts)

Si prefereixes no passar per GitHub, aquests són els passos originals per
muntar-ho tot des de zero i pujar la carpeta a mà.

### 1. Crear el projecte de Supabase (5 minuts)

1. Ves a **https://supabase.com** i clica **Start your project** (registra't amb GitHub o correu si no tens compte)
2. Un cop dins, clica **New project**
    - **Name**: `pla-comunicacio-obres`
    - **Database password**: en genera una amb el botó **Generate**, i **desa-la** (la necessitarà si mai vols accedir directament a la BD, però no per a l'app)
    - **Region**: `West EU (Ireland)` — la més propera a Catalunya
    - **Pricing plan**: `Free`
3. Prem **Create new project** i espera 1-2 minuts que el projecte s'aprovisioni

### 2. Crear les taules i posar-hi les dades inicials (2 minuts)

Un cop el projecte estigui llest:

1. Al menú lateral esquerre, clica **SQL Editor**
2. Prem **+ New query** (a dalt)
3. Obre el fitxer `supabase/01-schema.sql` d'aquest paquet en un editor de text, copia'n tot el contingut, enganxa'l al SQL Editor de Supabase
4. Clica **Run** (a baix a la dreta). Ha de dir **Success. No rows returned**
5. Torna a fer **+ New query**, i ara amb el contingut de `supabase/02-seed.sql`. Clica **Run**. Ha de dir **Success. No rows returned** de nou

### 3. Copiar les credencials de Supabase (1 minut)

1. Al menú lateral, clica **Settings** (roda dentada) → **API**
2. Copia dos valors:
    - **Project URL** (comença per `https://XXX.supabase.co`)
    - **anon public** (la clau curta que apareix a "Project API keys")

### 4. Crear el fitxer `config.js` (1 minut)

Al mateix directori d'aquest paquet:

```bash
cp config.js.example config.js
```

Obre `config.js` amb un editor i omple els valors:

```js
window.APP_CONFIG = {
  supabaseUrl: "https://XXXX.supabase.co",        // el que has copiat
  supabaseAnonKey: "eyJhbG…",                     // la clau anon
  adminEmails: [ "admin@exemple.cat" ]           // el teu correu; després n'hi pots afegir més
};
```

### 5. Desplegar a Vercel (5 minuts)

**Opció A — via web (més fàcil):**

1. Registra't a **https://vercel.com** (pots fer-ho amb GitHub o correu)
2. A la pantalla d'inici de Vercel, clica **Add New** → **Project**
3. Tria **Import Third-Party Git Repository** i selecciona **Deploy without Git repository** — o més senzill: arrossega directament tota la carpeta `pla-obres/` a l'àrea que et dirà «Drop your project here»
4. Al pas «Configure Project»:
    - **Framework Preset**: Other
    - **Root Directory**: `./` (per defecte)
    - No cal build command ni output directory (és un lloc estàtic)
5. Clica **Deploy**. Al cap d'un minut tindràs una URL del tipus `pla-comunicacio-obres.vercel.app`

**Opció B — via CLI (per si estàs còmoda amb el terminal):**

```bash
npm install -g vercel
cd pla-obres/
vercel                    # segueix les instruccions (accepta defaults)
vercel --prod             # per publicar-ho a l'URL definitiva
```

### 6. La primera visita (1 minut)

1. Obre l'URL de Vercel al navegador
2. Et demanarà una contrasenya. La inicial és **`canviam`** (l'has de canviar tot seguit)
3. Introdueix el teu nom i el teu correu (el que has posat a `adminEmails`)
4. Vés al menú **Dades ▾ → Panell d'admin**
5. Posa una contrasenya nova i comunica-la als teus companys

Fet. Els companys ja poden entrar amb l'URL i la nova contrasenya.

---

## Ús diari

### Signar-se

Cada persona introdueix el seu nom la primera vegada. Els canvis que faci queden signats al panell «Canvis recents» i tothom hi veu qui ha fet què.

### Editar

- **Sense mode edició** — pots escriure a la caixa d'accions de comunicació, canviar el nivell, canviar l'encarregat, marcar com a fet.
- **Amb mode edició** (botó ✎ Mode edició a la barra) — a més pots canviar el nom de l'obra, la ubicació, l'import, la fita, la data, moure de trimestre, afegir/esborrar actuacions.

### Filtres

Multi-selecció: pots combinar departaments, nivells, encarregats i vegueries. La cerca lliure funciona sobre tot el text visible.

### Enganxar dades d'Excel

**Dades ▾ → Enganxa dades d'Excel** obre un modal. Copia les cel·les de l'Excel (l'ordre esperat és **Departament, Obra, Ubicació, Import, Fita, Data, Encarregat, Nivell**), enganxa-les i veuràs un preview amb:

- N noves (que s'afegiran)
- M actualitzades (les que coincideixen pel nom d'obra — **es preserven els comentaris, nivell, encarregat i estat**)
- K desapareixen (les que ja no hi són)

Quan confirmes, es substitueix la llista sencera al servidor i tothom veu els canvis en temps real.

### Descarregar en PDF

Botó **🖨 Imprimeix / Desa en PDF** de la barra. Obre el diàleg del navegador; a «Destinació» tria **Desa com a PDF**.

### Còpia de seguretat

**Dades ▾ → Desa una còpia** descarrega un JSON amb tot (obres + historial). Guarda'l periòdicament fora de Supabase.

---

## Manteniment

### Canviar la contrasenya

Qualsevol admin (els correus llistats a `config.js`) veurà **Dades ▾ → Panell d'admin**. Des d'aquí es canvia la contrasenya. Els que ja estiguin dins segueixen dins fins que tanquin la pestanya (no els expulsa).

### Afegir més admins

Edita `config.js`, afegeix el correu nou a `adminEmails`, i torna a desplegar a Vercel (`vercel --prod` o arrossega la carpeta de nou al panell de Vercel).

### Veure la BD directament

Al panell de Supabase, **Table Editor** al menú lateral. Hi pots veure les taules `works`, `history`, `active_users`, `app_settings` — i editar valors a mà si cal.

### Reiniciar les dades

Al SQL Editor de Supabase, `truncate table works; truncate table history;` i torna a executar `02-seed.sql`.

---

## Notes de seguretat

Aquesta configuració està pensada per a un ús **intern d'equip**, no per a un servei públic. Concretament:

- La contrasenya és compartida (com una porta d'entrada d'oficina): la coneix tothom qui té accés
- La URL de Vercel és pública, però necessita la contrasenya per veure res
- Les regles de seguretat de fila (RLS) estan desactivades al nivell de Supabase per simplicitat. La clau anon podria ser usada per algú tècnic per llegir les dades sense la contrasenya de l'app, si mai la teva URL es filtra. Per un pla d'obres del Govern d'accés restringit, això és **acceptable si els companys tracten la URL amb discreció**; per a dades sensibles o públic ampli, cal endurir amb RLS + auth de Supabase.

Si en algun moment vols passar a un model més segur (per exemple, magic links amb correus @gencat.cat), digues-m'ho i t'ajudo a migrar-hi.

---

## Suport

- **Aplicació trencada després d'una actualització?** — Revisa la consola del navegador (F12 → Console) i mira si hi ha errors en vermell. Sovint és la variable `supabaseAnonKey` mal copiada
- **Els canvis no apareixen als altres usuaris?** — Verifica que a Supabase, **Database → Replication**, la publicació `supabase_realtime` tingui activades les taules `works`, `history`, `active_users`. Si no, torna a executar `01-schema.sql` — les línies `alter publication ...` s'encarreguen d'això
- **Vull tornar a la contrasenya inicial** — Al SQL Editor de Supabase: `update app_settings set value = '5e22854f87ae1293d56afa21fe1ab6461d5d91f61ed84617cd54944f626fdb6a' where key = 'password_hash';` (és el hash SHA-256 de `canviam`)
