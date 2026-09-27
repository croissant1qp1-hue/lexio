#!/usr/bin/env node
/**
 * Zustand des Supabase-Projekts prüfen, ohne Dashboard und ohne DB-Passwort.
 *
 * Aufruf:  node scripts/db-status.mjs
 *
 * Wofür das da ist
 * ----------------
 * Die App zeigt ihre Einrichtungsschritte in der Oberfläche an. Das Skript
 * sagt dasselbe in der Konsole, und zwar an zwei Stellen, an denen die
 * Oberfläche nicht hilft:
 *
 *   - aus dem Terminal, während man die SQL-Datei einfuegt
 *   - aus einer CI, die pruefen soll, ob die App starten kann
 *
 * Es braucht nur die beiden oeffentlichen Schluessel aus .env, genau wie
 * der Browser. Es kann nichts schreiben – jede Abfrage liest.
 *
 * Exit-Code 0 = einsatzbereit, 1 = es fehlt noch etwas. Damit laesst sich
 * `node scripts/db-status.mjs` als Vorbedingung in ein Skript haengen.
 */

import fs from "node:fs";
import path from "node:path";

const WURZEL = path.resolve(import.meta.dirname, "..");

/** Liest .env ohne Bibliothek: keine Abhaengigkeit, keine Auswertung von Code. */
function liesEnv() {
  const datei = path.join(WURZEL, ".env");
  if (!fs.existsSync(datei)) {
    console.error(".env nicht gefunden. Erwartet wird die Projekt-URL und der anon Key.");
    process.exit(1);
  }
  const raus = {};
  for (const zeile of fs.readFileSync(datei, "utf8").split("\n")) {
    if (!zeile.includes("=") || zeile.trim().startsWith("#")) continue;
    const i = zeile.indexOf("=");
    raus[zeile.slice(0, i).trim()] = zeile
      .slice(i + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
  return raus;
}

const env = liesEnv();
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!URL_ || !KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL oder NEXT_PUBLIC_SUPABASE_ANON_KEY fehlt in .env.");
  process.exit(1);
}

const ok = (t) => `\x1b[32m${t}\x1b[0m`;
const schlecht = (t) => `\x1b[31m${t}\x1b[0m`;
const gelb = (t) => `\x1b[33m${t}\x1b[0m`;

/** Statuscode plus Fehlercode eines PostgREST-Aufrufs. */
async function frage(pfad, spalten) {
  try {
    const antwort = await fetch(`${URL_}/rest/v1/${pfad}?select=${spalten}&limit=1`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
      signal: AbortSignal.timeout(8000),
    });
    let code = null;
    try {
      code = (await antwort.clone().json()).code ?? null;
    } catch {
      /* Kein JSON, z. B. HTML einer Fehlerseite. */
    }
    return { status: antwort.status, code };
  } catch {
    return { status: 0, code: null };
  }
}

console.log(`\nProjekt: ${new URL(URL_).hostname}\n`);

/* ------------------------------------------------------ 1. Erreichbarkeit */

const erste = await frage("karteikarten_sets", "id");
if (erste.status === 0) {
  console.log(schlecht(`Die Datenbank antwortet nicht (${URL_}).`));
  process.exit(1);
}
console.log(ok("Datenbank erreichbar."));

/* --------------------------------------------------------- 2. Der anon-Key */

const rolle = (() => {
  try {
    return JSON.parse(Buffer.from(KEY.split(".")[1], "base64url").toString()).role;
  } catch {
    return "unlesbar";
  }
})();
if (rolle === "anon") {
  console.log(ok("anon-Key hat die Rolle anon."));
} else {
  console.log(
    schlecht(`Der anon-Key hat die Rolle "${rolle}".`) +
      " Damit umgeht jeder Aufruf die Datenbankregeln.",
  );
}

/* -------------------------------------------- 3. Migration 002 und 003 */

const pro005 = [
  ["karteikarten_sets", "user_id", "003", "Besitzrechte an Sets"],
  ["karteikarten_sets_uebersicht", "eigenes_set", "003", "View mit Besitz"],
  ["profil", "id", "003", "Profil-Tabelle"],
  ["karten_fortschritt", "karte_id", "003", "Fortschritt je Person"],
  ["mein_fortschritt", "streak", "003", "Streak und XP-Uebersicht"],
  ["karteikarten_sets_uebersicht", "karten_faellig", "002", "Fällige Karten"],
];

const fehlend = [];
for (const [pfad, spalte, datei, wofuer] of pro005) {
  const r = await frage(pfad, spalte);
  // 404 = Objekt fehlt wirklich. 401/403 = es ist da, nur nicht fuer die
  // Rolle "anon" lesbar – was nach 003 der Normalfall ist.
  const weg = r.status === 404 || r.status === 400;
  if (weg) fehlend.push({ datei, wofuer, pfad });
  console.log(
    weg
      ? schlecht(`fehlt   ${pfad}.${spalte}`) + gelb(`   (${datei}: ${wofuer})`)
      : ok(`da      ${pfad}.${spalte}`),
  );
}

/* ------------------------------------------------------- 4. Anmeldung */

const einstellungen = await (async () => {
  try {
    const r = await fetch(`${URL_}/auth/v1/settings`, {
      headers: { apikey: KEY },
      signal: AbortSignal.timeout(8000),
    });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
})();

if (!einstellungen) {
  console.log(gelb("Auth-Einstellungen nicht lesbar – Anmeldewege nicht prüfbar."));
} else {
  const offen = einstellungen.disable_signup !== true;
  const mitMail = einstellungen.mailer_autoconfirm !== false;
  const google = einstellungen.external?.google === true;
  const github = einstellungen.external?.github === true;

  console.log(offen ? ok("Registrierung offen.") : schlecht("Registrierung ist abgeschaltet."));
  console.log(
    mitMail
      ? ok("Keine E-Mail-Bestaetigung noetig – Konto sofort nutzbar.")
      : gelb("E-Mail-Bestaetigung aktiv. Pruefen, ob im Dashboard ein SMTP-Server haengt."),
  );
  if (google) console.log(ok("Google ist aktiviert."));
  if (github) console.log(ok("GitHub ist aktiviert."));
  if (!google && !github) console.log(gelb("Google und GitHub sind beide aus."));
}

/* ------------------------------------------------------------ 5. Ergebnis */

console.log("");
if (fehlend.length === 0) {
  console.log(ok("Datenbank ist bereit. Die App kann laufen.\n"));
  process.exit(0);
}

const dateien = [...new Set(fehlend.map((f) => f.datei))].sort();
console.log(
    schlecht(`Es fehlt noch ${fehlend.length} Objekt(e).`) +
        ` Im SQL Editor ausfuehren: supabase/${dateien.join(", supabase/")}`,
);
console.log(`\n${fehlend.map((f) => `  - ${f.wofuer}`).join("\n")}\n`);
process.exit(1);
