#!/usr/bin/env node
/**
 * Ein globales Starter-Set samt Karten in die Produktivdatenbank einspielen.
 *
 * Wofuer das da ist
 * -----------------
 * Der Wortlisten-Generator erzeugt nur Dateien (scripts/wortlisten/*.json).
 * Damit Karten in der App erscheinen, muessen sie in die Datenbank. Das hier
 * ist der einmalige Import-Schritt, der die generierte JSON als Set anlegt.
 *
 * Das Set ist GLOBAL: user_id = NULL, eigenes_set = false. Das heisst, jeder
 * Nutzer sieht es in der Uebersicht, und niemand kann es veraendern oder
 * loeschen. Genau wie die frueheren Demo-Kacheln – nur mit echtem Inhalt.
 * Die App-Route POST /api/karten blockt das Schreiben in fremde Sets
 * absichtlich; ein globales Set gehoert niemandem, also muss der Import
 * daran vorbei. Er geht ueber die Management-API (SUPABASE_ACCESS_TOKEN,
 * dieselbe Verbindung, die auch db-migrieren.mjs nutzt) mit einer einzigen
 * SQL-Anweisung.
 *
 * Aufruf
 * ------
 *   npm run wortlisten:importieren -- scripts/wortlisten/ngsl-top100.json englisch-grundlagen "Englisch Grundlagen"
 *
 * Idempotent: laeuft das Skript ein zweites Mal, findet es das Set und
 * traegt nur noch fehlende Karten nach, ohne zu duplizieren.
 *
 * Voraussetzung
 * -------------
 * SUPABASE_ACCESS_TOKEN in .env (wie fuer db:migrieren).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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

function konfiguration() {
  const args = process.argv.slice(2);
  const [kartenJson, slug, name, sprache] = args;
  if (!kartenJson || !slug || !name) {
    console.error(
      "Aufruf: node scripts/wortlisten-importieren.mjs <karten.json> <slug> <name> [sprache=Englisch]",
    );
    process.exit(1);
  }
  const datei = path.resolve(WURZEL, kartenJson);
  if (!fs.existsSync(datei)) {
    console.error(`Karten-Datei nicht gefunden: ${datei}`);
    process.exit(1);
  }
  return {
    datei,
    karten: JSON.parse(fs.readFileSync(datei, "utf8")),
    slug,
    name,
    sprache: sprache || "Englisch",
  };
}

function sqlEscape(text) {
  return String(text ?? "").replace(/'/g, "''");
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
    const fehler = new Error(
      daten?.message || daten?.error || text.slice(0, 400),
    );
    fehler.status = antwort.status;
    throw fehler;
  }
  return daten;
}

/**
 * Welche Paare stehen mehrfach in derselben Datei?
 *
 * Das ist die Luecke, die der NOT EXISTS-Block im SQL NICHT schliesst — und
 * die ein Live-Test am 2026-10-04 gefunden hat. Der Block vergleicht
 * `lower(k.antwort)` mit dem, was schon in der Datenbank steht, und er sieht
 * dabei die Zeilen NICHT, die dasselbe Statement gerade einfuegt. Postgres
 * wertet die Abfrage gegen den Zustand vor dem Statement aus. Zwei gleiche
 * Paare in einer Datei landen deshalb beide in der Tabelle.
 *
 * Nachgewiesen mit einer Probedatei (6 Eintraege, davon eines zweimal):
 * Das Skript meldete "6 Karten", die Datenbank enthielt 6 Karten — davon
 * zweimal "probe eins / probe one". Die Mengenpruefung blieb gruen, weil sie
 * nur zaehlt.
 *
 * Und public.karten hat ausser dem Primaerschluessel gar keine Eindeutigkeits-
 * bedingung (geprueft: pg_constraint und pg_indexes). Niemand faengt es auf.
 *
 * Geprueft wird auf das Paar (frage, antwort), nicht auf die englische Seite
 * allein: "Köter" und "Hund" sind zwei woertlicher verschiedene Karten, auch
 * wenn beide "dog" bedeuten. Ob der Import auf der englischen Seite
 * zusammenfasst (das behauptet sein Kommentar), ist eine eigene Frage — siehe
 * OFFENE-PUNKTE.md.
 */
export function dateiBefund(karten) {
  const gesehen = new Set();
  const doppelt = [];

  for (const karte of karten) {
    const frage = String(karte.frage ?? "").trim();
    const antwort = String(karte.antwort ?? "").trim();
    const schluessel = JSON.stringify([frage.toLowerCase(), antwort.toLowerCase()]);
    if (gesehen.has(schluessel)) doppelt.push({ frage, antwort });
    else gesehen.add(schluessel);
  }

  return doppelt;
}

/**
 * Muss die Datenbank nach dem Import mindestens so viele Karten haben, wie die
 * Datei vorsieht?
 *
 * Der Kommentar am Import versprach diese Pruefung von Anfang an — sie war aber
 * nirgends: das Skript las die Zahl aus der Datenbank, druckte sie und meldete
 * "fertig". Ein Import, der 300 von 342 Karten geschafft haette, waere als
 * Erfolg gemeldet worden. Genau diese Sorte Fehler steht inzwischen dreimal
 * im Plan (erfundene Null bei /api/sets, "Ergebnis: nichts" beim toten Code,
 * "ja, die Datei ist geloescht" bei 003b).
 *
 * Die Regel ist absichtlich einseitig:
 *
 *   inDb < erwartet   FEHLER. Karten fehlen. Der Import hat sie nicht
 *                     gebracht — etwa weil ein früherer Lauf das Set halb
 *                     angelegt hat. Was hier NICHT aufgefangen wird, sind
 *                     doppelte Karten: dieDatei kann zwei gleiche Paare
 *                     enthalten, und dann stimmt die Zahl trotzdem. Dafuer ist
 *                     `dateiBefund` da, weiter oben.
 *   inDb = erwartet   Alles da.
 *   inDb > erwartet   Erlaubt. Karten werden absichtlich nie geloescht: ein
 *                     DELETE nimmt per on delete cascade den ganzen
 *                     Lernfortschritt mit. Wer ein Wort aus der Datei
 *                     entfernt, laesst die Karte in der Datenbank stehen.
 *                     Deshalb ist "mehr" kein Fehler, sondern der Normalfall
 *                     nach dem Weglassen eines Wortes.
 */
export function mengenBefund(erwartet, inDb) {
  if (inDb < erwartet) {
    return {
      ok: false,
      text:
        `FEHLER: Die Datenbank hat ${inDb} Karten, die Datei ${erwartet}. ` +
        `Es fehlen ${erwartet - inDb}. Der Import hat sie nicht gebracht. ` +
        `Nichts ist dabei kaputt, aber die Wortliste ist unvollstaendig, ` +
        `und das sieht niemand.`,
    };
  }
  if (inDb > erwartet) {
    return {
      ok: true,
      text:
        `Hinweis: ${inDb - erwartet} Karten mehr als in der Datei. ` +
        `Das ist erlaubt: Karten werden nie geloescht, weil ein DELETE per ` +
        `cascade den Lernfortschritt mitnimmt.`,
    };
  }
  return { ok: true, text: `Mengen stimmen: ${inDb} Karten.` };
}

async function main() {
  const cfg = konfiguration();
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
    console.error("NEXT_PUBLIC_SUPABASE_URL in .env hat kein https://<ref>.supabase.co");
    process.exit(1);
  }

  if (!Array.isArray(cfg.karten) || cfg.karten.length === 0) {
    console.error("Keine Karten in der JSON gefunden – nichts zu tun.");
    process.exit(1);
  }
  console.log(`\nProjekt ${ref}`);
  console.log(`${cfg.karten.length} Karten im Import, Set "${cfg.name}" (${cfg.slug})\n`);

  /*
   * Vor dem Schreiben. Dubletten in der Datei wuerde der Import stillschweigend
   * doppelt anlegen — sie entstehen trotz des NOT EXISTS-Blocks im SQL, weil
   * ein Statement seine eigenen Zeilen nicht sieht. Abbrechen ist die einzige
   * Stelle, an der hier noch nichts in der Datenbank passiert ist.
   */
  const doppelt = dateiBefund(cfg.karten);
  if (doppelt.length > 0) {
    console.error(`ABBRUCH: ${doppelt.length} Paar(e) stehen mehrfach in der Datei.`);
    console.error("Ohne diese Pruefung wuerde der Import zwei gleiche Karten anlegen;");
    console.error("die Mengenpruefung am Ende saehe nichts, weil die Zahl dann stimmt.\n");
    for (const d of doppelt) console.error(`  "${d.frage}" / "${d.antwort}"`);
    console.error("\nIn der Datei nachsehen, das doppelte Paar entfernen, dann erneut.");
    process.exit(1);
  }

  /*
   * Ein Befehl, eine Anweisung. Das Set wird mit "on conflict do nothing"
   * gelegt; danach werden nur Karten eingefuegt, deren Sprachpaar noch fehlt.
   * Die Mengengleichheit pruefen wir abschliessend, damit das Skript nach
   * aussen behauptet, was in der Datenbank steht.
   */
  const kartenSql = cfg.karten
    .map(
      (k) =>
        `('${sqlEscape(k.frage)}', '${sqlEscape(k.antwort)}', ${k.beispielsatz ? `'${sqlEscape(k.beispielsatz)}'` : "null"}, ${k.beispiel_uebersetzung || k.beispielUebersetzung ? `'${sqlEscape(k.beispiel_uebersetzung || k.beispielUebersetzung)}'` : "null"})`,
    )
    .join(",\n    ");

  const sql = `
begin;

insert into public.karteikarten_sets (slug, name, sprache, sprache_code, anzahl_karten, eigenes_set, user_id)
values ('${sqlEscape(cfg.slug)}', '${sqlEscape(cfg.name)}', '${sqlEscape(cfg.sprache)}', 'en', 0, false, null)
on conflict (slug) do nothing;

insert into public.karten (set_id, frage, antwort, beispielsatz, beispiel_uebersetzung)
select
  s.id,
  v.frage,
  v.antwort,
  v.beispielsatz,
  v.beispiel_uebersetzung
from (
  values
    ${kartenSql}
) as v(frage, antwort, beispielsatz, beispiel_uebersetzung)
left join public.karteikarten_sets s on s.slug = '${sqlEscape(cfg.slug)}'
/*
 * Der Schluessel ist die englische Seite, nicht das Paar aus beiden Seiten.
 *
 * Nach dem ersten Lauf mit dem korrigierten Generator ist das nicht mehr
 * theoretisch: 27 Karten bekamen eine bessere Uebersetzung, die Dubletten-
 * pruefung auf (frage, antwort) erkannte sie nicht als vorhanden, und das
 * Set wuchs von 100 auf 127 Karten – jede doppelt, mit veralteter
 * Uebersetzung daneben. Der Fortschritt blieb erhalten, weil er an der
 * Karten-Id haengt, aber ein Set mit Doppelkarten ist ein Fehler, kein
 * Nebeneffekt. Die Datei enthaelt zu jedem Wort genau eine Karte; also ist
 * die englische Seite der Schluessel.
 */
where not exists (
  select 1 from public.karten k
  where k.set_id = s.id
    and lower(k.antwort) = lower(v.antwort)
);

/*
 * Zweiter Schritt: Karten, die es schon gibt, deren Text aber nicht mehr
 * stimmt, werden auf den Stand der Datei gebracht.
 *
 * Warum das noetig ist und nicht nur "fehlende ergaenzt": der Generator hat
 * die Bedeutungswahl des Wortes an den Beispielsatz gebunden. Dadurch
 * ändert sich bei vorhandenen Karten der Text – etwa "use" von "Benutzung"
 * auf "benutzen, verwenden", weil der Beispielsatz die Verbform zeigt.
 *
 * Der Fortschritt liegt in public.karten_fortschritt und verweigt über
 * karte_id. Ein UPDATE der Karte lässt ihn unberührt – anders als ein
 * DELETE, das per on delete cascade alles mitnimmt. Genau deshalb wird hier
 * aktualisiert und nicht ersetzt.
 *
 * Zuordnung ueber die englische Seite (antwort): die Datei enthaelt zu
 * jedem Wort genau eine Karte, und die englische Seite ist damit der
 * Schluessel. Der NOT EXISTS-Block verhindert, dass durch die Aenderung
 * zwei Karten mit identischem Paar im selben Set entstehen.
 */
update public.karten k
set
  frage = v.frage,
  beispielsatz = v.beispielsatz,
  beispiel_uebersetzung = v.beispiel_uebersetzung
from (
  values
    ${kartenSql}
) as v(frage, antwort, beispielsatz, beispiel_uebersetzung),
  public.karteikarten_sets s
where s.slug = '${sqlEscape(cfg.slug)}'
  and k.set_id = s.id
  and lower(k.antwort) = lower(v.antwort)
  and (k.frage is distinct from v.frage
    or k.beispielsatz is distinct from v.beispielsatz
    or k.beispiel_uebersetzung is distinct from v.beispiel_uebersetzung)
  and not exists (
    select 1 from public.karten k2
    where k2.set_id = k.set_id
      and k2.frage = v.frage
      and k2.antwort = v.antwort
      and k2.id <> k.id
  );

update public.karteikarten_sets s
set anzahl_karten = (select count(*) from public.karten k where k.set_id = s.id)
where s.slug = '${sqlEscape(cfg.slug)}';

select
  s.id,
  s.slug,
  count(k.id)::int as karten_gesamt
from public.karteikarten_sets s
left join public.karten k on k.set_id = s.id
where s.slug = '${sqlEscape(cfg.slug)}'
group by s.id, s.slug;
commit;
`;

  try {
    const ergebnis = await fuehrenAus(ref, token, sql);
    const zeile = Array.isArray(ergebnis) ? ergebnis.at(-1) : null;
    if (zeile && typeof zeile === "object" && "karten_gesamt" in zeile) {
      const befund = mengenBefund(cfg.karten.length, zeile.karten_gesamt);
      if (!befund.ok) {
        // Die SQL laeuft in begin/commit und ist damit geschrieben — zurueck
        // gerollt ist hier nichts. exit 1 heisst also nicht "der Import ist
        // ungeschehen", sondern "die Datenbank enthaelt jetzt weniger Karten,
        // als die Datei versprochen hat". Der Zustand bleibt, er wird nur
        // gemeldet statt verschwiegen; wer ihn reparieren will, muss die
        // doppelten Woerter in der Datei finden, nicht noch einmal laufen.
        console.error(`\n${befund.text}\n`);
        process.exit(1);
      }
      console.log(`Set "${zeile.slug}" ist fertig – ${zeile.karten_gesamt} Karten darin.`);
      console.log(`${befund.text}\n`);
    } else {
      console.log(`SQL gelaufen. Ergebnis nicht eindeutig: ${JSON.stringify(ergebnis).slice(0, 200)}\n`);
    }
  } catch (fehler) {
    console.error(`\nImport fehlgeschlagen: ${fehler.message}`);
    if (fehler.status === 401) {
      console.error("  Der Access Token wurde abgelehnt. Er ist womoeglich abgelaufen oder widerrufen.");
    }
    process.exit(1);
  }
}

// Nur starten, wenn diese Datei direkt aufgerufen wird. Sonst kann ein Test
// `mengenBefund` importieren, ohne dass der Import daneben laeuft.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((fehler) => {
    console.error(`Fehler: ${fehler.message}`);
    process.exit(1);
  });
}