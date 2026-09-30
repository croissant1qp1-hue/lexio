#!/usr/bin/env node
/**
 * Migrationen ausfuehren ueber die Supabase Management-API.
 *
 * Wofuer das da ist
 * -----------------
 * DDL geht per REST nicht. Ein `service_role`-Key darf ueber PostgREST
 * ausschliesslich das, was PostgREST kennt: Tabellen, Views und Funktionen.
 * Gelesen und geschrieben werden kann damit, `create table` nicht – dafuer
 * braucht es eine SQL-Verbindung. Die zwei Wege davor waren: Passwort in
 * `.env` und Handarbeit im SQL Editor. Beides im Projekt nicht brauchbar, das
 * erste nicht da, das zweite nur mit Anmeldung im Dashboard.
 *
 * Der Weg hier ist ein Personal Access Token: einmal in `.env` abgelegt, und
 * jede weitere Migration laeuft danach mit einem Befehl. Reihenfolge,
 * Pruefung und Ausgabe bleiben dabei in einem Skript, statt in vier offenen
 * Tabs.
 *
 * Voraussetzung
 * -------------
 * In `.env` steht:
 *
 *   SUPABASE_ACCESS_TOKEN=sbp_...
 *
 * Den Token gibt es unter Supabase → Settings → Account → Access Tokens.
 * Er wird nur gelesen, nie ausgegeben, und kommt in keine Datei ausser
 * `.env`. Der Token kann alles am Projekt, auch das Loeschen. Er gehoert
 * darum in `.env` und nicht in den Code und nicht in eine Doku.
 *
 * Aufruf
 * ------
 *   npm run db:migrieren                  # 003, 004, 005, 006 in dieser Reihenfolge
 *   npm run db:migrieren 005 006          # nur die genannten, in dieser Reihenfolge
 *   npm run db:migrieren -- --trocken     # zeigt, was laufen wuerde, fuehrt nichts aus
 *
 * Abbruch
 * -------
 * Beim ersten Fehler stoppt das Skript. Eine halb gelaufene Migration ist
 * schlimmer als eine nicht gelaufene, weil danach nicht mehr klar ist, wo man
 * war. Jede Datei muss selbst fuer sich lauffaehig sein, dann ist ein
 * Neustart an der naechsten Datei moeglich.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://api.supabase.com/v1";

/** Reihenfolge ist Absicht: 003 legt user_id an, 004 indiziert darauf,
 *  005 braucht 003, 006 braucht 005, 007 braucht 006. */
const STAND = ["003-auth-und-user-daten.sql", "004-leistung.sql", "005-sprachen-und-beisatz.sql", "006-views-auf-sprachcode.sql", "007-gelernt-und-gesehen.sql"];

/** Liest .env ohne Bibliothek: keine Abhaengigkeit, keine Auswertung von Code. */
function liesEnv() {
  const datei = path.join(WURZEL, ".env");
  if (!fs.existsSync(datei)) {
    console.error(".env nicht gefunden.");
    process.exit(1);
  }
  const raus = {};
  for (const zeile of fs.readFileSync(datei, "utf8").split("\n")) {
    const t = zeile.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    let wert = t.slice(i + 1).trim();
    if (wert.startsWith('"') && wert.endsWith('"')) wert = wert.slice(1, -1);
    raus[t.slice(0, i).trim()] = wert;
  }
  return raus;
}

function projektRef(env) {
  // Aus der Projekt-URL. https://<ref>.supabase.co -> <ref>
  const u = env.NEXT_PUBLIC_SUPABASE_URL || "";
  const m = u.match(/^https:\/\/([a-z0-9]+)\.supabase\./i);
  if (!m) {
    console.error("NEXT_PUBLIC_SUPABASE_URL in .env hat kein https://<ref>.supabase.co");
    process.exit(1);
  }
  return m[1];
}

async function fuehrenAus(ref, token, sql) {
  const antwort = await fetch(`${API}/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const text = await antwort.text();
  let daten = null;
  try {
    daten = JSON.parse(text);
  } catch {
    /* keine JSON-Antwort: siehe unten */
  }
  if (!antwort.ok) {
    const detail = daten?.message || daten?.error || text.slice(0, 400);
    const neuer = new Error(detail);
    neuer.status = antwort.status;
    throw neuer;
  }
  return daten;
}

/** Kuerzt sehr lange Ausgaben, damit ein Terminal nicht zuschwimmt. */
function kurz(text, max = 400) {
  const s = String(text ?? "").replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

const argumente = process.argv.slice(2);
const trocken = argumente.includes("--trocken");
const dateien = argumente.filter((a) => !a.startsWith("--")).map((a) => `${a}.sql`);
const liste = dateien.length ? dateien : STAND;

const env = liesEnv();
const token = env.SUPABASE_ACCESS_TOKEN;
const ref = projektRef(env);

console.log(`Projekt  ${ref}`);
console.log(`Dateien  ${liste.length ? liste.join(" -> ") : "keine"}`);

if (!token) {
  console.error(
    "\nSUPABASE_ACCESS_TOKEN fehlt in .env.\n" +
      "  Supabase → Settings → Account → Access Tokens → Generate new token,\n" +
      "  dann die Zeile SUPABASE_ACCESS_TOKEN=sbp_... in .env eintragen.",
  );
  process.exit(1);
}
if (/^dein|^\s*$|xxx|platzhalter/i.test(token)) {
  console.error("\nSUPABASE_ACCESS_TOKEN sieht noch nach einem Platzhalter aus. Bitte einen echten Token eintragen.");
  process.exit(1);
}
if (trocken) {
  console.log("\n--trocken: es wird nichts ausgeführt. Die Dateien sind:");
  for (const d of liste) {
    const p = path.join(WURZEL, "supabase", "migrations", d);
    const da = fs.existsSync(p);
    const gross = da ? fs.statSync(p).size : 0;
    const zeilen = da ? fs.readFileSync(p, "utf8").split("\n").length : 0;
    console.log(`  ${da ? "  " : "! "}supabase/migrations/${d}  ${da ? `${zeilen} Zeilen, ${gross} Byte` : "FEHLT"}`);
  }
  process.exit(0);
}

console.log(`Token    vorhanden (${token.length} Zeichen, wird nicht ausgegeben)\n`);

let schritt = 0;
for (const datei of liste) {
  schritt += 1;
  const pfad = path.join(WURZEL, "supabase", "migrations", datei);
  if (!fs.existsSync(pfad)) {
    console.error(`FEHLER  supabase/migrations/${datei} gibt es nicht.`);
    process.exit(1);
  }
  const sql = fs.readFileSync(pfad, "utf8");
  const t0 = Date.now();
  process.stdout.write(`[${schritt}/${liste.length}] ${datei} … `);
  try {
    const ergebnis = await fuehrenAus(ref, token, sql);
    const dauer = ((Date.now() - t0) / 1000).toFixed(1);
    const anzahl = Array.isArray(ergebnis) ? `${ergebnis.length} Zeilen` : kurz(ergebnis);
    console.log(`ok (${dauer}s)${anzahl ? ` — ${anzahl}` : ""}`);
  } catch (fehler) {
    console.log("FEHLGESCHLAGEN");
    console.error(`\n${fehler.message}\n`);
    if (fehler.status === 401) {
      console.error("  Der Token wurde abgelehnt. Wahrscheinlich ist er abgelaufen oder widerrufen.");
    }
    console.error(
      `  Ab hier laeuft nichts mehr. ${liste.length - schritt} Datei(en) wurden nicht ausgefuehrt.\n` +
        `  Nach dem Beheben erneut starten:\n` +
        `    npm run db:migrieren -- ${liste.slice(schritt).map((d) => d.replace(/\.sql$/, "")).join(" ")}`,
    );
    process.exit(1);
  }
}

console.log("\nAlle Dateien gelaufen. Jetzt pruefen, ob die Datenbank wirklich das zeigt:");
console.log("  npm run db:status");
console.log("  curl -s \"$NEXT_PUBLIC_SUPABASE_URL/rest/v1/sprachen?select=code,name&limit=3\" \\");
console.log("    -H \"apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY\"");
