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
      console.log(`Set "${zeile.slug}" ist fertig – ${zeile.karten_gesamt} Karten darin.\n`);
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

main().catch((fehler) => {
  console.error(`Fehler: ${fehler.message}`);
  process.exit(1);
});