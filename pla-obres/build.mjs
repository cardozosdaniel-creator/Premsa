// Build per a Vercel.
//
// L'aplicació és HTML estàtic: no hi ha res a compilar. L'única feina d'aquest
// script és copiar els fitxers a `dist/` i **generar-hi el `config.js`** a
// partir de les variables d'entorn del projecte de Vercel.
//
// Per què? Perquè aquest repositori és públic. Si hi committéssim el
// `config.js` amb la URL i la clau de Supabase, qualsevol bot que rastreja
// GitHub les trobaria. Generant-lo aquí, les credencials viuen només a
// Vercel (Settings → Environment Variables) i mai passen pel repositori.
//
// Variables necessàries a Vercel:
//   SUPABASE_URL        https://XXXX.supabase.co
//   SUPABASE_ANON_KEY   la clau "anon public" / "publishable"
//   ADMIN_EMAILS        correus d'admin separats per comes
//
// Ús local:  node build.mjs   (amb les variables exportades a la shell)

import fs from "node:fs";
import path from "node:path";

const root = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(root, "dist");

const STATIC = ["index.html", "vegueries-geo.js", "vegueries-map.js"];

const url = process.env.SUPABASE_URL || "";
const key = process.env.SUPABASE_ANON_KEY || "";
const admins = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (!url || !key) {
  console.error(
    "\n[build] Falten variables d'entorn: cal SUPABASE_URL i SUPABASE_ANON_KEY.\n" +
      "        A Vercel: Settings → Environment Variables.\n" +
      "        En local:  SUPABASE_URL=... SUPABASE_ANON_KEY=... node build.mjs\n"
  );
  process.exit(1);
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

for (const f of STATIC) {
  fs.copyFileSync(path.join(root, f), path.join(out, f));
}

// Generat, no committejat: aquest fitxer no existeix al repositori.
const config =
  "// Fitxer generat automàticament per build.mjs a partir de les variables\n" +
  "// d'entorn de Vercel. No l'editis a mà i no el pugis al repositori.\n" +
  "window.APP_CONFIG = " +
  JSON.stringify(
    { supabaseUrl: url, supabaseAnonKey: key, adminEmails: admins },
    null,
    2
  ) +
  ";\n";
fs.writeFileSync(path.join(out, "config.js"), config);

console.log(
  "[build] dist/ preparat: " +
    STATIC.concat("config.js").join(", ") +
    " · admins: " +
    (admins.length || 0)
);
