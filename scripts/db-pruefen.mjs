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

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const WURZEL = join(import.meta.dirname, "..");
const MIGRATIONEN = join(WURZEL, "supabase", "migrations");

/* ------------------------------------------------------------------ Umgebung */

function liesEnv() {
  const ausProcess = { ...process.env };
  const datei = join(WURZEL, ".env");
  let inhalt = "";
  try {
    inhalt = readFileSync(datei, "utf8");
  } catch {
    // Ohne .env laeuft der Aufruf mit gesetzten Variablen.
  }
  const ausDatei = {};
  for (const zeile of inhalt.split("\n")) {
    const treffer = zeile.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!treffer) continue;
    let wert = treffer[2].trim();
    if (
      (wert.startsWith('"') && wert.endsWith('"')) ||
      (wert.startsWith("'") && wert.endsWith("'"))
    ) {
      wert = wert.slice(1, -1);
    }
    ausDatei[treffer[1]] = wert;
  }
  return { ...ausDatei, ...ausProcess };
}

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

const ref = url.match(/^https:\/\/([a-z0-9]+)\.supabase\./i)?.[1];
if (!ref) {
  console.error(`Aus "${url}" liess sich kein Projektname ab.`);
  process.exit(1);
}

/* ------------------------------------------------------------------ Abfragen */

async function frage(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
    signal: AbortSignal.timeout(20000),
  });
  const text = await r.text();
  if (!r.ok) {
    throw new Error(text.slice(0, 300));
  }
  const daten = JSON.parse(text);
  return Array.isArray(daten) ? daten[0] : daten;
}

const ok = (t) => `\x1b[32m${t}\x1b[0m`;
const schlecht = (t) => `\x1b[31m${t}\x1b[0m`;
const gelb = (t) => `\x1b[33m${t}\x1b[0m`;

/* ------------------------------------------------------- Die Merkmalsliste */

/*
 * `merkmal` ist der Satz, der erklaert, warum dieses Merkmal fuer die Datei
 * spricht. `optional: true` heisst: die Datei darf ungelaufen sein. Bei 003b
 * ist das nicht nur erlaubt, sondern richtig: die Datei tut nichts mehr.
 */
const PRUEFUNGEN = [
  {
    datei: "002-sets-anlegen-und-loeschen.sql",
    merkmal: "die Karten-Tabelle (heißt `karten`, nicht `karteikarten`) – ohne sie gibt es nichts zu lernen",
    sql: `select exists (
            select 1 from information_schema.tables
             where table_schema='public' and table_name='karten'
          ) as da`,
  },
  {
    datei: "003-auth-und-user-daten.sql",
    merkmal: "karten_fortschritt mit karte_id – der persönliche Lernstand",
    sql: `select exists (
            select 1 from information_schema.columns
             where table_schema='public' and table_name='karten_fortschritt'
               and column_name='karte_id'
          ) as da`,
  },
  {
    datei: "003b-demofortschritt-uebernehmen.sql",
    merkmal:
      "darf ungelaufen bleiben, und ist es auch: die Datei tut nichts mehr, " +
      "sie meldet nur, warum (Stand 2026-10-04)",
    optional: true,
    sql: `select true as da`,
  },
  {
    datei: "004-leistung.sql",
    merkmal: "die drei Indizes, ohne die die Lernrunde bei vielen Karten bremst",
    sql: `select (
            exists (select 1 from pg_indexes where indexname='karten_set_faellig_idx')
        and exists (select 1 from pg_indexes where indexname='xp_events_user_set_idx')
        and exists (select 1 from pg_indexes where indexname='xp_events_datum_idx')
          ) as da`,
  },
  {
    datei: "005-sprachen-und-beisatz.sql",
    merkmal: "die Sprachliste – ohne sie hat ein Set keine Sprache",
    sql: `select exists (
            select 1 from information_schema.tables
             where table_schema='public' and table_name='sprachen'
          ) as da`,
  },
  {
    datei: "006-views-auf-sprachcode.sql",
    merkmal: "sprache_code an den Sets – danach erst kann nach Sprache sortiert werden",
    sql: `select exists (
            select 1 from information_schema.columns
             where table_schema='public' and table_name='karteikarten_sets'
               and column_name='sprache_code'
          ) as da`,
  },
  {
    datei: "007-gelernt-und-gesehen.sql",
    merkmal: "gesehen und gelernt – ohne sie zählt keine Karte als gelernt",
    sql: `select (
            exists (select 1 from information_schema.columns
                     where table_schema='public' and table_name='karten_fortschritt'
                       and column_name='gesehen')
        and exists (select 1 from information_schema.columns
                     where table_schema='public' and table_name='karten_fortschritt'
                       and column_name='gelernt')
          ) as da`,
  },
  {
    datei: "008-push-abonnements.sql",
    merkmal: "die Tabelle push_abonnements – das Gerät merkt sich daran",
    sql: `select exists (
            select 1 from information_schema.tables
             where table_schema='public' and table_name='push_abonnements'
          ) as da`,
  },
  {
    datei: "009-leech-und-rueckgaengig.sql",
    merkmal:
      "die Funktion antwort_rueckgaengig – ohne sie meldet der Rückgängig-Knopf " +
      "stillschweigend, es sei nichts passiert",
    sql: `select exists (
            select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname='public' and p.proname='antwort_rueckgaengig'
          ) as da`,
  },
  {
    datei: "010-antworten-zaehlen.sql",
    merkmal: "die Bewertungszähler z_nochmal … – sie steuern die Reihenfolge (1.8)",
    sql: `select (
            exists (select 1 from information_schema.columns
                     where table_schema='public' and table_name='karten_fortschritt'
                       and column_name='z_nochmal')
        and exists (select 1 from information_schema.columns
                     where table_schema='public' and table_name='karten_fortschritt'
                       and column_name='z_einfach')
          ) as da`,
  },
{
    /*
     * Vorsicht bei diesem Eintrag. 011 löscht drei Demo-Sets per Slug, und einer der drei
     * Slugs ist inzwischen eine kuratierte Wortliste: `englisch-grundlagen`
     * trägt ngsl-top100 mit 100 Karten (siehe scripts/wortlisten-importieren.mjs).
     *
     * Ein Lauf ist heute nicht mehr gefährlich: 011 hat inzwischen eine Löschsperre
     * und löscht ein Set nur noch, wenn *jede* Karte dem Platzhalter-Muster
     * `Frage n` / `Antwort n` entspricht. Gegenprobe am echten Datensatz:
     * `englisch-grundlagen` (100 Karten) käme nicht infrage.
     *
     * Geprüft wird hier trotzdem nur, was tatsächlich Platzhalter war und immer
     * Platzhalter bleibt: `englisch-grundlagen` gehört nicht mehr dazu. Hätte man
     * es mitgeprüft, meldete diese Prüfung „fehlt" — und die naheliegende Reaktion
     * auf „fehlt" wäre `npm run db:migrieren -- 011`, also genau die Sache, vor der
     * wir sie bewahren. Ein Eintrag, der zum Löschen von Produktionsdaten
     * auffordert, ist schlimmer als keiner.
     */
    datei: "011-platzhalter-entfernen.sql",
    merkmal:
      "die beiden echten Demo-Sets sind weg (italienisch-urlaub, spanisch-alltag). " +
      "englisch-grundlagen ist heute eine Wortliste und wäre als Merkmal falsch",
    sql: `select not exists (
            select 1 from public.karteikarten_sets
             where slug in ('italienisch-urlaub','spanisch-alltag')
               and user_id is null
          ) as da`,
  },

  {
    datei: "012-beispielsatz-korpus-und-cache.sql",
    merkmal: "der Beispielsatz-Cache – ohne ihn fragt die App jedes Mal den Korpus ab",
    sql: `select (
            exists (select 1 from information_schema.tables
                     where table_schema='public' and table_name='beispielsatz_korpus')
        and exists (select 1 from information_schema.tables
                     where table_schema='public' and table_name='beispielsatz_cache')
          ) as da`,
  },
  {
    datei: "013-tagesziel-ehrlich.sql",
    merkmal:
      "antwort_verbuchen schreibt den Snapshot (vorhanden_vorher) und Ziel 100 – " +
      "ohne beides tut Rückgängig nichts und das Tagesziel bleibt bei 20",
    sql: `select (
            exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                     where n.nspname='public' and p.proname='antwort_verbuchen'
                       and pg_get_functiondef(p.oid) like '%vorhanden_vorher%')
        and exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                     where n.nspname='public' and p.proname='antwort_verbuchen'
                       and pg_get_functiondef(p.oid) like '%ziel%100%')
          ) as da`,
  },
  {
    datei: "014-sets-gelernt-reparieren.sql",
    merkmal:
      "die Tabelle xp_tag_sets und dass antwort_verbuchen sie füllt – " +
      "ohne beides zählt sets_gelernt ein Set zu wenig",
    sql: `select (
            exists (select 1 from information_schema.tables
                     where table_schema='public' and table_name='xp_tag_sets')
        and exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                     where n.nspname='public' and p.proname='antwort_verbuchen'
                       and pg_get_functiondef(p.oid) like '%xp_tag_sets%')
          ) as da`,
  },
  {
    datei: "015-antwort-verbuchen-rechte.sql",
    merkmal:
      "anon darf beide Antwort-Funktionen nicht ausführen, authenticated darf – " +
      "Supabase vergibt das Recht sonst von selbst",
    sql: `select (
            not has_function_privilege('anon','public.antwort_verbuchen(uuid,uuid,text,integer,boolean,date,integer,boolean)'::regprocedure,'execute')
        and not has_function_privilege('anon','public.antwort_rueckgaengig(uuid)'::regprocedure,'execute')
        and has_function_privilege('authenticated','public.antwort_verbuchen(uuid,uuid,text,integer,boolean,date,integer,boolean)'::regprocedure,'execute')
        and has_function_privilege('authenticated','public.antwort_rueckgaengig(uuid)'::regprocedure,'execute')
          ) as da`,
  },
];

/* ---------------------------------------------------------------- Auswertung */

console.log(`\nProjekt ${ref} — Migrationen gegen die Datenbank prüfen\n`);

const vorhanden = readdirSync(MIGRATIONEN)
  .filter((f) => f.endsWith(".sql"))
  .sort();
const geprueft = new Set(PRUEFUNGEN.map((p) => p.datei));

const ohnePruefung = vorhanden.filter((f) => !geprueft.has(f));
if (ohnePruefung.length > 0) {
  console.error(
    schlecht("Dateien ohne Eintrag in scripts/db-pruefen.mjs:") +
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
