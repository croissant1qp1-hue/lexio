#!/usr/bin/env node
/**
 * Baut den Beispielsatz-Korpus (012-beispielsatz-korpus-und-cache.sql) aus
 * den Tatoeba-Dateien und spielt ihn in die Datenbank ein.
 *
 * Wofuer das da ist
 * -----------------
 * Im Vokabel-Wizard liefert die Route /api/beispielsatz zu einem eingegebenen
 * Wort einen Beispielsatz. Erste (kostenlose, deterministische) Quelle ist
 * dieser Korpus: je normalisiertem englischem Wort der kuerzeste brauchbare
 * Tatoeba-Satz samt deutscher Uebersetzung (~35k Woerter).
 *
 * Aufruf
 * ------
 *   npm run beispielsatz:korpus -- /pfad/zu/tatoeba
 *
 * Der Pfad muss die drei Dateien enthalten:
 *   eng_sentences.tsv  deu_sentences.tsv  eng_deu_links.tsv
 *   (Paket "eng-deu" von tatoeba.org/downloads – in /tmp/opencode liegen sie
 *    bereits entpackt von Phase 2.2.)
 *
 * Ablauf
 * ------
 *   1. deu-Saetze und eng-deu-Links in Maps laden.
 *   2. eng-Saetze lesen: je Wort den qualitativ besten Satz mit Link merken
 *      (satzQualitaet filtert Musterphasen und minimales Englisch raus).
 *   3. Tabelle leeren und in Batches von 1.000 Zeilen per Management-API
 *      einspielen – kompletter Neuaufbau, kein Halbzustand, nichts doppelt.
 *
 * Voraussetzung: SUPABASE_ACCESS_TOKEN in .env (wie fuer db:migrieren).
 */

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://api.supabase.com/v1";

/** Liest .env ohne Bibliothek: keine Abhaengigkeit, keine Auswertung von Code. */
function liesEnv() {
  const datei = path.join(WURZEL, ".env");
  if (!fs.existsSync(datei)) {
    console.error(".env nicht gefunden.");
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
    const fehler = new Error(daten?.message || daten?.error || text.slice(0, 400));
    fehler.status = antwort.status;
    throw fehler;
  }
  return daten;
}

async function zeilenLesen(datei, cb) {
  const rl = readline.createInterface({
    input: fs.createReadStream(datei),
    crlfDelay: Infinity,
  });
  for await (const zeile of rl) {
    if (zeile.trim()) cb(zeile);
  }
}

/** Teilt einen Satz in Woerter und normalisiert jedes. */
function woerterDes(satz) {
  return satz.match(/[a-z0-9äöüß]+/g) ?? [];
}

/**
 * Bewertet einen englischen Satz als Beispielsatz.
 *
 * Gibt -1 fuer Saetze, die als Lern- oder Marketing-Beispiel nicht taugen,
 * sonst eine Punktzahl: hoehere Werte sind natuerlichere Saetze.
 *
 * Die alte Regel "kuerzester Satz gewinnt" waehlte systematisch die duennen,
 * musterhaften Saetze aus dem Korpus (Beispiel: "go" -> "Is it to go?").
 * Hier zaehlt stattdessen zuerst die Form: vollstaendiger Satz mit Punkt,
 * Beginn mit Grossbuchstabe, keine generischen Phrasen und keine minimalen
 * Fragmente. Innerhalb dessen ist ein Satz um acht Woerter (typische
 * natuerliche Laenge) am besten; jedes Wort bekommt zusaetzlich Bonuspunkte,
 * wenn es mittig steht und nur einmal vorkommt.
 */
function satzQualitaet(satz) {
  const woerter = satz.trim().split(/\s+/).filter(Boolean);
  const n = woerter.length;
  if (n < 4 || n > 15) return -1;
  if (satz.length > 160) return -1;

  // Vollstaendiger Satz: beginnt mit Grossbuchstabe, endet mit . ! oder ?.
  if (!/^[A-Z\u00c4\u00d6\u00dc]/.test(satz.trim())) return -1;
  if (!/[.!?]$/.test(satz.trim())) return -1;
  // Klammern und Maskierungen sind fast immer Fehler- oder Fremdzeichen.
  if (/[\[\]{}|<>@]/.test(satz)) return -1;

  const lc = satz.toLowerCase();
  // Generische Hilfssaetze: sagen nichts ueber das Wort aus.
  if (/^(this|that) is (a|an|the) /.test(lc)) return -1;
  if (/^i am (a|an) /.test(lc)) return -1;
  // "Man is 70% water." -- veraltet und inhaltsleer, nur in kurzer Form.
  if (n <= 7 && /^(man|one|it) (is|was) /.test(lc)) return -1;
  // Kurze Fragen mit nur einem Hilfsverb: "Is it to go?", "Do you buy it?"
  if (
    n <= 6 &&
    /^(is|are|am|do|does|did|was|were|can|could|will|would|should|may|might|must|have|has|had) /.test(lc)
  )
    return -1;

  // Umbestpunkt: satz um acht Woerter natuerlich, groesser/kleiner wird
  // linear schlechter.
  return 20 - Math.abs(n - 8);
}

/**
 * Baut den Korpus aus den drei Tatoeba-Dateien.
 * Je Wort bleibt der qualitativ beste brauchbare Satz (4-15 Woerter) mit Link.
 */
async function korpusBauen(ordner) {
  const deuDatei = path.join(ordner, "deu_sentences.tsv");
  // Tatoeba liefert "eng-deu_links.tsv"; aeltere Entpackungen trugen Unterstrich.
  const linksDatei =
    fs.existsSync(path.join(ordner, "eng-deu_links.tsv"))
      ? path.join(ordner, "eng-deu_links.tsv")
      : path.join(ordner, "eng_deu_links.tsv");
  const engDatei = path.join(ordner, "eng_sentences.tsv");

  for (const d of [deuDatei, linksDatei, engDatei]) {
    if (!fs.existsSync(d)) {
      console.error(`Datei fehlt: ${d}`);
      process.exit(1);
    }
  }

  /* 1. Deutsche Saetze: id -> satz. */
  const deu = new Map();
  await zeilenLesen(deuDatei, (zeile) => {
    const t = zeile.split("\t");
    if (t[0] && t[2]) deu.set(t[0], t[2]);
  });
  console.log(`deu-Saetze      : ${deu.size.toLocaleString("de-DE")}`);

  /* 2. Links: eng-id -> erste deu-id. */
  const links = new Map();
  await zeilenLesen(linksDatei, (zeile) => {
    const t = zeile.split("\t");
    if (t[0] && t[1] && !links.has(t[0])) links.set(t[0], t[1]);
  });
  console.log(`Links           : ${links.size.toLocaleString("de-DE")}`);

  /* 3. englische Saetze: bester brauchbarer je Wort. */
  const index = new Map();
  let eng = 0;
  let verlinkt = 0;
  await zeilenLesen(engDatei, (zeile) => {
    const t = zeile.split("\t");
    const id = t[0];
    const satz = t[2];
    if (!id || !satz) return;
    eng += 1;

    const deuId = links.get(id);
    if (!deuId) return;
    const deuSatz = deu.get(deuId);
    if (!deuSatz) return;

    const basisPunkte = satzQualitaet(satz);
    if (basisPunkte < 0) return;

    verlinkt += 1;
    const tokens = woerterDes(satz);
    const tokenZahl = tokens.length;
    const fest = new Set(tokens);
    for (const w of fest) {
      if (w.length < 2) continue;
      let punkte = basisPunkte;
      // Wort steht natuerlich in der Satzmitte, nicht nur als Randwort.
      const pos = tokens.findIndex((tok) => tok === w);
      if (pos > 0 && pos < tokenZahl - 1) punkte += 5;
      // Genau einmal ist sauberer als mehrfach.
      if (tokens.filter((tok) => tok === w).length === 1) punkte += 2;

      // Ein Satz, der mit einer Frage beginnt und dann einen zweiten Gedanken
      // anhaengt ("What happened? There's water..."), wirkt als Lernbeispiel
      // zerfasert. Die Bewertung erfolgt auf Tokens: zwei Satzzeilen = Abstufung.
      const zweisatz = (satz.match(/[.!?]\s+\S/) || []).length;
      if (zweisatz >= 1) punkte -= 4;

      const vor = index.get(w);
      if (!vor || punkte > vor.punkte) {
        index.set(w, { wort: w, satz, uebersetzung: deuSatz, punkte });
      }
    }
  });

  console.log(`eng-Saetze      : ${eng.toLocaleString("de-DE")}`);
  console.log(`verlinkt+nutzbar: ${verlinkt.toLocaleString("de-DE")}`);
  console.log(`Korpus-Woerter  : ${index.size.toLocaleString("de-DE")}`);

  return [...index.values()].sort((a, b) => a.wort.localeCompare(b.wort));
}

function sqlEscape(text) {
  return String(text).replace(/'/g, "''");
}

async function main() {
  const [ordnerArg] = process.argv.slice(2);
  if (!ordnerArg) {
    console.error("Aufruf: node scripts/beispielsatz-korpus.mjs </pfad/zu/tatoeba>");
    process.exit(1);
  }
  const ordner = path.resolve(ordnerArg);

  const env = liesEnv();
  const token = env.SUPABASE_ACCESS_TOKEN;
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || !token) {
    console.error("NEXT_PUBLIC_SUPABASE_URL oder SUPABASE_ACCESS_TOKEN fehlt in .env.");
    process.exit(1);
  }
  if (/^dein|^\s*$|xxx|platzhalter/i.test(token)) {
    console.error("\nSUPABASE_ACCESS_TOKEN sieht noch nach einem Platzhalter aus. Bitte einen echten Token eintragen.");
    process.exit(1);
  }
  const ref = (url.match(/^https:\/\/([a-z0-9]+)\.supabase\./i) || [])[1];
  if (!ref) {
    console.error("NEXT_PUBLIC_SUPABASE_URL hat kein https://<ref>.supabase.co");
    process.exit(1);
  }

  console.log(`\nProjekt ${ref}`);

  /* Der Korpus ist abgeleiteter Datenbestand: kompletter Neuaufbau statt
     nur ergaenzen. So landen keine Saetze, die unter den neuen Regeln gar
     nicht mehr taugen, still im Bestand – "on conflict do update" wuerde
     nur geaenderte ueberschreiben, aufgegebene Woerter aber behalten. */
  await fuehrenAus(ref, token, "truncate table public.beispielsatz_korpus;");

  const korpus = await korpusBauen(ordner);
  if (korpus.length === 0) {
    console.error("Korpus ist leer – nichts zu tun.");
    process.exit(1);
  }

  /* Batches von 1.000 – eine einzige Riesen-INSERT-Anweisung haengt die
     Management-API auf und ist im Fehlerfall nicht zu diagnostizieren. */
  const BATCH = 1000;
  const start = Date.now();
  let eingespielt = 0;

  for (let i = 0; i < korpus.length; i += BATCH) {
    const teil = korpus.slice(i, i + BATCH);
    const werte = teil
      .map((k) => `('${sqlEscape(k.wort)}', '${sqlEscape(k.satz)}', '${sqlEscape(k.uebersetzung)}')`)
      .join(",\n      ");
    const sql = `insert into public.beispielsatz_korpus (wort, satz, uebersetzung)
values
      ${werte}
on conflict (wort) do update set satz = excluded.satz, uebersetzung = excluded.uebersetzung;`;

    process.stdout.write(`  Batch ${i / BATCH + 1}/${Math.ceil(korpus.length / BATCH)} … `);
    await fuehrenAus(ref, token, sql);
    eingespielt += teil.length;
    const dauerSec = ((Date.now() - start) / 1000).toFixed(0);
    console.log(`ok (${eingespielt.toLocaleString("de-DE")} Zeilen, ${dauerSec}s)`);
  }

  /* Abschluss: was steht wirklich in der Tabelle? */
  const ergebnis = await fuehrenAus(
    ref,
    token,
    "select count(*)::int as zeilen from public.beispielsatz_korpus;",
  );
  const zeilen = Array.isArray(ergebnis) ? ergebnis[0]?.zeilen : null;
  console.log(`\nKorpus eingespielt. In der Datenbank: ${zeilen?.toLocaleString("de-DE") ?? "?"} Zeilen.`);
  console.log("Jetzt pruefen:\n  node -e \"…suche like apple…\" oder der Wizard-Knopf im Browser.\n");
}

main().catch((fehler) => {
  console.error(`\nFehler: ${fehler.message}`);
  process.exit(1);
});