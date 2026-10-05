/**
 * Prueft, welche Migrationen wirklich in der Datenbank stehen.
 *
 *   node --env-file=.env scripts/db-pruefen.mjs
 *
 * Worum es geht: In diesem Projekt gibt es keine Tabelle mit angewandten
 * Migrationen. `db-migrieren.mjs` schickt jede Datei als EINE Anfrage an die
 * Management-API und meldet `ok`, wenn die Anfrage durchging. Das ist eine
 * schlechte Messung, denn sie sieht nur, ob die LETZTE Anweisung keinen
 * Fehler geworfen hat. Bricht eine Datei mittendrin ab, bleiben die vorherigen
 * Anweisungen stehen und trotzdem steht sie im Protokoll als gelaufen.
 *
 * Genau das ist am 2026-10-04 passiert: 013 hatte sein Datenupdate geschafft
 * und seine Funktionsersetzung nicht, 014 hatte Tabelle und Bestand geschafft
 * und Funktion und View nicht. Beide meldeten `ok`. Danach lief die App
 * scheinbar normal, aber Rueckgaengig tat nichts, das Tagesziel war 20 statt
 * 100 und `sets_gelernt` zaehlte ein Set zu wenig — ueber Wochen im Plan als
 * "erledigt" gefuehrt.
 *
 * Deshalb wird hier nicht nach dem Namen der Datei gefragt, sondern nach dem
 * Merkmal, das sie in der Datenbank hinterlaesst: eine Tabelle, eine Spalte,
 * eine Funktion, ein Index, ein Datensatz, der weg sein muss. Alles laeuft
 * ueber die Management-API mit den Rechten von `postgres`, also genau so, wie
 * die Migrationen selbst geschrieben sind — PostgREST und der anon-Key sehen
 * zu wenig, um das beurteilen zu koennen.
 *
 * Bewusst eine Handliste und kein Parser. Eine Datei, die sich aus ihrem
 * Quelltext selbst pruefen liesse, waere eleganter, aber sie wuerde in genau
 * den Faellen falsch liegen, um die es hier geht: `create or replace` ist
 * idempotent und beweist nichts, `drop ... if exists` beweist nichts, und eine
 * abgebrochene Datei hinterlaesst genau die Objekte, die vorher schon da waren.
 * Ein Merkmal pro Datei, von Hand gesetzt und begruendet, ist ehrlicher.
 *
 * Zwei Regeln, damit die Liste nicht veraltet:
 *
 *   - Jede Datei in `supabase/migrations/` braucht einen Eintrag. Fehlt einer,
 *     bricht das Skript mit exit 1 ab. Eine neue Migration ohne Pruefung ist
 *     genau der Zustand, den dieses Skript verhindern soll.
 *   - Jeder Eintrag nennt in einem Satz, wofuer das Merkmal steht. Ein Merkmal
 *     ohne Grund ist ein Merkmal, das beim naechsten Umbau versehentlich
 *     umbenannt wird.
 *
 * Rueckgabewert 0 heisst: alle Merkmale vorhanden. 1 heisst: mindestens eines
 * fehlt — dann bitte `npm run db:migrieren -- <datei ohne .sql>` fuer die
 * genannten Dateien, und danach noch einmal hierher.
 */

import { PRUEFUNGEN, dateienAufPlatte, frage as frageApi, liesEnv, projektRef } from "./migrationen.mjs";

const env = liesEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const token = env.SUPABASE_ACCESS_TOKEN;

if (!url || !token) {
  console.error(
    "Es fehlt eine der beiden Angaben:\n" +
      "  NEXT_PUBLIC_SUPABASE_URL   aus .env\n" +
      "  SUPABASE_ACCESS_TOKEN      aus den Supabase-Projekteinstellungen\n" +
      "\nOhne Token laeuft diese Pruefung nicht: Der anon-Key sieht nur zu wenig " +
      "von der Datenbank, um eine Migration zu beurteilen.",
  );
  process.exit(1);
}

let ref;
try {
  ref = projektRef(env);
} catch (fehler) {
  console.error(fehler.message);
  process.exit(1);
}

/* ------------------------------------------------------------------ Abfragen */

async function frage(sql) {
  return frageApi(ref, token, sql);
}

const ok = (t) => `\x1b[32m${t}\x1b[0m`;
const schlecht = (t) => `\x1b[31m${t}\x1b[0m`;
const gelb = (t) => `\x1b[33m${t}\x1b[0m`;

/* ---------------------------------------------------------------- Auswertung */

console.log(`\nProjekt ${ref} — Migrationen gegen die Datenbank prüfen\n`);

const vorhanden = dateienAufPlatte();
const geprueft = new Set(PRUEFUNGEN.map((p) => p.datei));

const ohnePruefung = vorhanden.filter((f) => !geprueft.has(f));
if (ohnePruefung.length > 0) {
  console.error(
    schlecht("Dateien ohne Eintrag in scripts/migrationen.mjs:") +
      `\n  ${ohnePruefung.join("\n  ")}\n` +
      gelb(
        "\n  Eine neue Migration ohne Merkmalsprüfung ist genau der Zustand, den " +
          "\n  dieses Skript verhindern soll. Bitte einen Eintrag ergänzen – mit einem " +
          "\n  Satz, wofür das Merkmal steht.",
      ),
  );
}

const fehlendeDateien = [...geprueft.keys()].filter((f) => !vorhanden.includes(f));
for (const datei of fehlendeDateien) {
  console.error(
    schlecht(`Eintrag ohne Datei: ${datei}`) +
      gelb("  – Migration umbenannt oder gelöscht? Eintrag mit anpassen."),
  );
}

const fehlt = [];

for (const { datei, merkmal, sql, optional } of PRUEFUNGEN) {
  if (!vorhanden.includes(datei)) continue;
  let da;
  try {
    da = (await frage(sql)).da === true;
  } catch (fehler) {
    console.log(schlecht(`?       ${datei}`) + gelb(`   (Abfrage fehlgeschlagen: ${fehler.message})`));
    fehlt.push(datei);
    continue;
  }
  if (da) {
    console.log(ok(`da      ${datei}`));
  } else if (optional) {
    console.log(gelb(`egal    ${datei}`) + gelb(`   (${merkmal})`));
  } else {
    console.log(schlecht(`FEHLT   ${datei}`) + gelb(`   (${merkmal})`));
    fehlt.push(datei);
  }
}

console.log();

if (fehlendeDateien.length > 0 || ohnePruefung.length > 0) {
  console.error(
    schlecht("Die Liste der Migrationen und der Ordner stimmen nicht überein.") +
      gelb(" Erst das in Ordnung bringen, dann ist die Prüfung wieder aussagekräftig."),
  );
  process.exit(1);
}

if (fehlt.length > 0) {
  console.error(
    schlecht(`${fehlt.length} Migration(en) fehlen in der Datenbank:`) +
      `\n\n  npm run db:migrieren -- ${fehlt
        .map((f) => f.replace(/\.sql$/, ""))
        .join(" ")}\n\n` +
      gelb(
        "  Danach dieses Skript erneut. Ein Lauf, der mitten im Protokoll abbricht,\n" +
          "  lässt die vorherigen Anweisungen stehen – deshalb wird hier nicht\n" +
          "  abgefragt, ob es geklappt hat, sondern was am Ende vorliegt.",
      ),
  );
  process.exit(1);
}

console.log(ok(`Alle ${PRUEFUNGEN.filter((p) => !p.optional).length} geprüften Migrationen stehen in der Datenbank.`));
console.log(gelb("003b tut nichts mehr und darf ungelaufen bleiben – siehe Liste oben.\n"));
