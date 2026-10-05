import assert from "node:assert/strict";
import test from "node:test";

import { MIGRATIONEN, PRUEFUNGEN, dateienAufPlatte, natuerlich } from "../scripts/migrationen.mjs";

/*
 * Diese Tests kennen keine Datenbank. Sie sichern die beiden Regeln, nach denen
 * `scripts/migrationen.mjs` zuvor von Hand gepflegt werden musste — und die
 * vorher nur existierten, wenn jemand `npm run db:pruefen` laufen liess:
 *
 *   1. Jede Migrationsdatei hat einen Eintrag mit Merkmal und Begruendung.
 *   2. Reihenfolge ist numerisch, nicht alphabetisch.
 *
 * Zu 1: Das Skript weigerte sich, eine Datei ohne Pruefung auszufuehren, weil es
 * dann nicht weiss, ob sie steht. Diese Weigerung ist nur so gut wie die
 * Vollstaendigkeit der Liste — und die Liste wurde von Hand gefuellt. Jetzt
 * schlaegt ein fehlender Eintrag hier fehl, ohne Token und ohne Projekt.
 */

test("Nummern werden numerisch sortiert, nicht als Text", () => {
  // String-Sort wuerde "10-x" vor "9-x" legen. Dann wird in der falschen
  // Reihenfolge migriert, und es faellt erst auf, wenn eine Tabelle fehlt,
  // die eine spaetere Datei gebraucht haette.
  const unsortiert = ["010-z.sql", "9-a.sql", "002-a.sql", "010-a.sql"];

  assert.deepEqual(natuerlich(unsortiert), [
    "002-a.sql",
    "9-a.sql",
    "010-a.sql",
    "010-z.sql",
  ]);
});

test("Der Buchstabe hinter der Nummer sortiert hinter die Datei ohne Buchstaben", () => {
  // 003b ist eine eigene Datei und laeuft nach 003, nicht davor.
  assert.deepEqual(natuerlich(["003b-demo.sql", "003-auth.sql"]), ["003-auth.sql", "003b-demo.sql"]);
});

test("Jede Migrationsdatei hat einen Eintrag", () => {
  const geprueft = new Set(PRUEFUNGEN.map((p) => p.datei));
  const ohneEintrag = dateienAufPlatte().filter((f) => !geprueft.has(f));

  assert.deepEqual(
    ohneEintrag,
    [],
    `Ohne Eintrag kann db-migrieren nicht entscheiden, ob die Datei steht: ${ohneEintrag.join(", ")}`,
  );
});

test("Jeder Eintrag hat auch eine Datei", () => {
  const vorhanden = new Set(dateienAufPlatte());
  const ohneDatei = PRUEFUNGEN.map((p) => p.datei).filter((f) => !vorhanden.has(f));

  assert.deepEqual(ohneDatei, [], `Umbenannt oder geloescht? ${ohneDatei.join(", ")}`);
});

test("Jedes Merkmal hat einen Satz dazu, wofuer es steht", () => {
  // Ein Merkmal ohne Grund wird beim naechsten Umbau umbenannt, ohne dass
  // jemand merkt, dass die Pruefung dann nichts mehr prueft.
  const ohneGrund = PRUEFUNGEN.filter((p) => !p.merkmal || p.merkmal.trim().length < 10).map((p) => p.datei);

  assert.deepEqual(ohneGrund, []);
});

test("Keine Datei hat zwei Eintraege", () => {
  const mehrfach = PRUEFUNGEN.map((p) => p.datei).filter((f, i, alle) => alle.indexOf(f) !== i);

  assert.deepEqual([...new Set(mehrfach)], []);
});

test("Die Pruefungen decken genau das Verzeichnis ab — nichts zu viel, nichts zu wenig", () => {
  // Beide Listen koennen auseinanderlaufen, das ist keine theoretische
  // Moeglichkeit: db-migrieren hatte eine eigene, fest verdrahtete Liste von
  // fuenf Dateien, waehrend fuenfzehn auf der Platte lagen.
  assert.equal(MIGRATIONEN.endsWith("supabase/migrations"), true);
  assert.ok(dateienAufPlatte().length >= 15, `erwartet mindestens 15 Migrationen, gefunden ${dateienAufPlatte().length}`);
});