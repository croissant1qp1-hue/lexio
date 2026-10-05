/**
 * Wissen ueber die Migrationen — fuer beide Skripte, die davon abhaengen.
 *
 * Wofuer es da ist
 * ----------------
 * `db-pruefen.mjs` weiss, welche Datei in der Datenbank steht (Merkmal
 * messen). `db-migrieren.mjs` weiss, welche Datei er ausfuehren soll. Bis
 * 2026-10-04 hatte jedes Skript eine eigene Liste, und `db-migrieren.mjs`
 * eine fest verdrahtete von fuenf Dateien (003 bis 007) — bei fuenfzehn auf
 * der Platte. `npm run db:migrieren` ohne Argumente fuehrt also nur diese
 * fuenf aus und meldet danach "Alle Dateien gelaufen", waehrend 008 bis 015
 * nie laufen. Gemessen mit `--trocken`; die Zahl stand so im Skript.
 *
 * Zwei Listen an derselben Sache driften auseinander, das ist kein Zufall,
 * sondern der Normalfall. Deshalb liegt hier beides: das Verzeichnis und die
 * Pruefungen, und beide Skripte holen sich ihre Antwort von hier.
 *
 * Enthalten
 * ---------
 *   `PRUEFUNGEN`     ein Merkmal pro Migrationsdatei, mit Begruendung
 *   `dateienAufPlatte()`  was wirklich da ist, natuerlich sortiert
 *   `natuerlich()`   "9-x" vor "10-x", im Gegensatz zu String-Sort
 *   `frage()`        eine Abfrage ueber die Management-API
 *   `projektRef()`   Projektname aus der URL
 *
 * Bewusst eine Handliste und kein Parser: `create or replace` ist idempotent
 * und beweist nichts, `drop ... if exists` beweist nichts, und eine abgebrochene
 * Datei hinterlaesst genau die Objekte, die vorher schon da waren. Ein von Hand
 * gesetztes Merkmal mit Begruendung ist ehrlicher als eine Heuristik, die in
 * genau den Faellen falsch liegt, um die es hier geht.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const WURZEL = join(import.meta.dirname, "..");
export const MIGRATIONEN = join(WURZEL, "supabase", "migrations");

/**
 * Natuerliche Reihenfolge. `sort()` liefert "010-x" vor "9-x", sobald eine
 * Datei ohne fuehrende Null dazukommt — dann wird in der falschen Reihenfolge
 * migriert, und das faellt erst auf, wenn eine Tabelle fehlt, die eine spaetere
 * Datei brauchte. Geprueft in tests/migrationen.test.ts.
 */
export function natuerlich(dateien) {
  return [...dateien].sort((a, b) => {
    const z = (s) => s.match(/\d+|\D+/g)?.map((t) => (/^\d+$/.test(t) ? Number(t) : t)) ?? [s];
    const la = z(a);
    const lb = z(b);
    for (let i = 0; i < Math.max(la.length, lb.length); i++) {
      const x = la[i];
      const y = lb[i];
      if (x === undefined) return -1;
      if (y === undefined) return 1;
      if (typeof x === "number" && typeof y === "number") {
        if (x !== y) return x - y;
      } else {
        const vx = String(x);
        const vy = String(y);
        if (vx !== vy) return vx < vy ? -1 : 1;
      }
    }
    return 0;
  });
}

/** Was wirklich auf der Platte liegt — die einzige Wahrheit ueber den Bestand. */
export function dateienAufPlatte(verzeichnis = MIGRATIONEN) {
  return natuerlich(readdirSync(verzeichnis).filter((f) => f.endsWith(".sql")));
}

/** Liest .env ohne Bibliothek: keine Abhaengigkeit, keine Auswertung von Code. */
export function liesEnv() {
  const ausProcess = { ...process.env };
  let inhalt = "";
  try {
    inhalt = readFileSync(join(WURZEL, ".env"), "utf8");
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

/** Der Projektname aus der URL. Wirft, statt zu beenden — testbar. */
export function projektRef(env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL || "";
  const ref = url.match(/^https:\/\/([a-z0-9]+)\.supabase\./i)?.[1];
  if (!ref) throw new Error(`Aus "${url}" liess sich kein Projektname ab.`);
  return ref;
}

/**
 * Eine Abfrage mit den Rechten von `postgres`. Der anon-Key sieht zu wenig, um
 * eine Migration zu beurteilen; genau deshalb laeuft das hier ueber die
 * Management-API und nicht ueber PostgREST.
 */
export async function frage(ref, token, sql, timeoutMs = 20000) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(text.slice(0, 300));
  const daten = JSON.parse(text);
  return Array.isArray(daten) ? daten[0] : daten;
}

/**
 * `merkmal` ist der Satz, der erklaert, warum dieses Merkmal fuer die Datei
 * spricht. `optional: true` heisst: die Datei darf ungelaufen sein. Bei 003b
 * ist das nicht nur erlaubt, sondern richtig: die Datei tut nichts mehr.
 *
 * Zwei Regeln, damit die Liste nicht veraltet — beide jetzt auch als Test:
 *
 *   - Jede Datei in `supabase/migrations/` braucht einen Eintrag. Fehlt einer,
 *     gilt die Datei als nicht gelaufen, weil niemand weiss, ob sie steht.
 *   - Jeder Eintrag nennt in einem Satz, wofuer das Merkmal steht. Ein Merkmal
 *     ohne Grund ist ein Merkmal, das beim naechsten Umbau versehentlich
 *     umbenannt wird.
 */
export const PRUEFUNGEN = [
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
