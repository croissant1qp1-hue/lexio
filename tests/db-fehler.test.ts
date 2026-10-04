/**
 * Welche Migrationsdatei nennt die App bei welchem Postgres-Fehler?
 *
 * `migrationsMeldung` ist die einzige Stelle im Projekt, die das entscheidet.
 * Das ist Absicht: Bis dahin hatte jede API-Route ihre eigene Antwort auf
 * dieselbe Frage gebaut, und die Antworten widersprachen sich. In
 * `app/api/sets/route.ts` stand ein eigener 42501-Zweig mit dem Kommentar
 * "kommt vor, wenn 003 nicht gelaufen ist" – der aber nie erreicht wurde,
 * weil `migrationsMeldung` zwei Zeilen darüber schon antwortet. Er ist weg;
 * dieser Test verhindert, dass so eine zweite Meinung wieder eingebaut wird.
 *
 * Die Erwartungen sind keine Vermutungen: dieselben codes und Texte wurden am
 * 2026-09-27 gegen die echte Datenbank gelesen, die Zuordnung steht im
 * Kopfkommentar von `lib/db-fehler.ts`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { migrationsMeldung } from "../lib/db-fehler.ts";

test("fehlende Spalte user_id nennt 003", () => {
  // Ohne Migration 003 kennt die Tabelle user_id nicht. Postgres sagt das
  // klar: 42703, nicht 42501.
  const meldung = migrationsMeldung({
    code: "42703",
    message: 'column "user_id" does not exist',
  });
  assert.ok(meldung, "muss eine Meldung geben");
  assert.ok(meldung.includes("003-auth-und-user-daten.sql"), meldung);
});

test("fehlende Spalte aus 005/006 nennt 005 und 006, nicht 003", () => {
  // Das ist der Grund fuer die ganze Datei: die Meldung darf nicht die
  // falsche Datei nennen. Wer 003 ausfuehrt, obwohl 005 fehlt, repariert
  // nichts und glaubt, die Datenbank sei kaputt.
  const meldung = migrationsMeldung({
    code: "42703",
    message: 'column "sprache_code" does not exist',
  });
  assert.ok(meldung);
  assert.ok(meldung.includes("005-sprachen-und-beisatz.sql"), meldung);
  assert.ok(meldung.includes("006-views-auf-sprachcode.sql"), meldung);
  assert.ok(!meldung.includes("003-auth"), meldung);
});

test("PGRST204 wie 42703 behandeln", () => {
  // PostgREST meldet fehlende Spalten je nach Weg als 42703 oder PGRST204.
  const meldung = migrationsMeldung({ code: "PGRST204", message: "user_id" });
  assert.ok(meldung);
  assert.ok(meldung.includes("003-auth-und-user-daten.sql"), meldung);
});

test("RLS-Blockade (42501) nennt 003", () => {
  const meldung = migrationsMeldung({ code: "42501", message: "new row violates row-level security policy" });
  assert.ok(meldung, "42501 ist ein Migrationsproblem und muss eine Meldung geben");
  assert.ok(meldung.includes("003-auth-und-user-daten.sql"), meldung);
});

test("fehlende Sprachtabelle (PGRST205) nennt 005", () => {
  const mitSprachen = migrationsMeldung({
    code: "PGRST205",
    message: "Could not find the table 'public.sprachen'",
  });
  assert.ok(mitSprachen?.includes("005-sprachen-und-beisatz.sql"), String(mitSprachen));
});

test("unbekannte Tabelle (PGRST205) faellt auf 003 zurueck", () => {
  const meldung = migrationsMeldung({ code: "PGRST205", message: "Could not find the table 'public.profil'" });
  assert.ok(meldung?.includes("003-auth-und-user-daten.sql"), String(meldung));
});

test("Fehler ohne Migrationsbezug bleiben der Route ueberlassen", () => {
  // null ist wichtig: die Route baut fuer einen echten Datenbankausfall eine
  // bessere Meldung als jede allgemeine Aussage ueber Migrationen.
  assert.equal(migrationsMeldung({ code: "23505", message: "duplicate key value" }), null);
  assert.equal(migrationsMeldung({ code: "PGRST116", message: "JSON object requested, multiple rows" }), null);
  assert.equal(migrationsMeldung({ code: "08006", message: "Connection failure" }), null);
});

test("Fehler ohne Code loesen keinen Absturz aus", () => {
  // supabase-js liefert nicht in jedem Fehlerfall ein Objekt mit code.
  assert.equal(migrationsMeldung(null), null);
  assert.equal(migrationsMeldung(undefined), null);
  assert.equal(migrationsMeldung({}), null);
});