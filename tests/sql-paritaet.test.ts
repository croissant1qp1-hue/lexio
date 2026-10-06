/**
 * Paritaet zwischen lib/lernlogik.ts und den SQL-Migrationen.
 *
 * Das ist der Grund fuer diese Tests. Die Level-Logik gibt es an zwei
 * Stellen: BEWERTUNGEN in TypeScript und die Bewertungsliste in
 * public.antwort_verbuchen in SQL. Beide muessen dieselben vier Werte
 * kennen – sonst schreibt die Funktion fuer eine Bewertung, die es in der
 * App gar nicht gibt (raise exception), oder schlaegt eine neue Bewertung
 * fehl.
 *
 * Ausserdem steht die Leech-Schwelle an zwei Stellen: LEECH_FEHLER im Code
 * und "fehler < 8" in der View karteikarten_sets_uebersicht. Laufend auseinander
 * hiesse: die Kachel oben blendet die Karte aus, die Lernroute zeigt sie
 * trotzdem.
 *
 * Es wird nicht gegen eine laufende Datenbank getestet, sondern gegen den
 * Quelltext der Migrationen: laeuft die DB auseinander, faellt es hier auf,
 * und zwar bei jedem Build. Der Test liest bewusst die LETZTE Definition
 * jeder Funktion (die hoechste Migrationsnummer), weil fruehere Dateien
 * historische Zwischenstaende sind.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { BEWERTUNGEN, LEECH_FEHLER } from "../lib/lernlogik.ts";

const MIGRATIONEN = join(import.meta.dirname, "..", "supabase", "migrations");

/** Migrationsdateien in Ausfuehrungsreihenfolge (nach Nummernpraefix). */
function migrationen(): string[] {
  return readdirSync(MIGRATIONEN)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

/**
 * Rumpf der LETZTEN Definition von public.NAME.
 *
 * Wichtig ist das "letzte", das eine Funktion tatsaechlich DEFINIERT – nicht
 * die letzte Datei, die ihren Namen nur erwaehnt. Migration 015 etwa revoked
 * die Rechte mit `revoke execute on function public.antwort_verbuchen(...)`
 * und aendert den Rumpf nicht. Nimmt man dort die ganze Datei, prueft man
 * Rechte-Zeilen gegen eine Bewertungsliste und der Test schlaegt fehl, ohne
 * dass sich am Verhalten etwas geaendert haette.
 *
 * Gesucht wird deshalb `create [or replace] function public.NAME`, und der
 * Block endet beim schliessenden $$ des Rumpfes.
 */
function letzteDefinition(name: string): string {
  const muster = new RegExp(
    `create\\s+(?:or\\s+replace\\s+)?function\\s+public\\.${name}\\s*\\([\\s\\S]*?\\$\\$;`,
    "gi",
  );
  const dateien = migrationen();
  for (let i = dateien.length - 1; i >= 0; i--) {
    const inhalt = readFileSync(join(MIGRATIONEN, dateien[i]), "utf8");
    const treffer = [...inhalt.matchAll(muster)];
    if (treffer.length > 0) return treffer[treffer.length - 1][0];
  }
  throw new Error(`Keine Migration definiert public.${name}`);
}

/**
 * Inhalt der View `karteikarten_sets_uebersicht` – aus der LETZTEN
 * Definition.
 *
 * Die View wird von 002, 006, 007 und 009 ersetzt. Frühere Fassungen kennen
 * den Leech-Filter noch gar nicht (er kam mit 009 dazu); zuerst den ersten
 * Treffer zu nehmen, würde also eine uralte Definition prüfen und die
 * Änderung in 009 nicht bemerken. Deshalb von hinten suchen.
 */
function viewUebersicht(): string {
  const dateien = migrationen();
  for (let i = dateien.length - 1; i >= 0; i--) {
    const inhalt = readFileSync(join(MIGRATIONEN, dateien[i]), "utf8");
    const treffer = inhalt.match(
      /create or replace view public\.karteikarten_sets_uebersicht[\s\S]*?;/i,
    );
    if (treffer) return treffer[0];
  }
  throw new Error("View karteikarten_sets_uebersicht wird nicht gefunden");
}

test("SQL kennt genau die Bewertungen, die TypeScript kennt", () => {
  const sql = letzteDefinition("antwort_verbuchen");

  // Die Pruefung in der Funktion: "if p_bewertung not in (...) then raise".
  const validierung = sql.match(/p_bewertung\s+not\s+in\s*\(([^)]*)\)/i);
  assert.ok(
    validierung,
    "antwort_verbuchen validiert p_bewertung nicht – die Liste wurde entfernt?",
  );

  const inSql = [...validierung[1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
  const inTs = BEWERTUNGEN.map((b) => b.id).sort();

  assert.deepEqual(
    inSql,
    inTs,
    "Die Bewertungsliste in SQL und die BEWERTUNGEN in TypeScript " +
      "stimmen nicht überein. Eine neue Bewertung braucht es an beiden Stellen.",
  );
});

test("SQL zählt jede Bewertung auf den passenden Zähler", () => {
  const sql = letzteDefinition("antwort_verbuchen");

  // Pro Bewertung muss es einen Zähler geben, der genau bei ihr hochgeht:
  // z_einfach nur bei 'einfach'. Sonst stimmen die Statistiken nicht.
  for (const { id } of BEWERTUNGEN) {
    const zaehler = new RegExp(
      `z_${id}\\s*=\\s*public\\.karten_fortschritt\\.z_${id}\\s*\\+\\s*` +
        `case when p_bewertung = '${id}'\\s+then 1 else 0 end`,
      "i",
    );
    assert.match(
      sql,
      zaehler,
      `Zähler z_${id} wird nicht bei Bewertung '${id}' hochgezählt.`,
    );
  }
});

test("Ein Erfolg senkt die Fehlerzahl, 'nochmal' hebt sie", () => {
  const sql = letzteDefinition("antwort_verbuchen");

  /*
   * Die Zuteilung steckt in v_fehler_delta, nicht mehr im SQL des UPDATE –
   * dieselbe Variable, die der INSERT braucht. Zwei Schreibweisen fuer
   * dieselbe Spalte waeren der Grund, warum diese Zelle hier ohne
   * Quelltext nicht mehr nachvollziehbar waere.
   */
  const zuweisung = sql.match(/v_fehler_delta\s+integer\s*:=\s*case\s+p_bewertung\s*([\s\S]*?)\bend/i);
  assert.ok(
    zuweisung,
    "v_fehler_delta fehlt – die Fehlerzahl wird wieder nur nach oben zaehlt.",
  );

  const erwartet: Record<string, number> = {
    nochmal: 1,
    schwer: 0,
    gut: -1,
    einfach: -1,
  };
  const gefunden: Record<string, number> = {};
  for (const treffer of zuweisung[1].matchAll(/when\s+'(\w+)'\s+then\s+(-?\d+)/gi)) {
    gefunden[treffer[1]] = Number(treffer[2]);
  }
  assert.deepEqual(
    Object.keys(gefunden).sort(),
    Object.keys(erwartet).sort(),
    "Nicht jede Bewertung bekommt eine Fehleraenderung – eine Neue " +
      "haette sonst einen Stummwert von null.",
  );
  for (const [bewertung, delta] of Object.entries(erwartet)) {
    assert.equal(
      gefunden[bewertung],
      delta,
      `Bewertung '${bewertung}' soll die Fehlerzahl um ${delta} aendern.`,
    );
  }

  /*
   * Die Anwendung in beiden Zwei-Wege-Zweigen. Fehlte dort das
   * greatest(..., 0), wuerde eine saubere Karte in negative Fehler laufen
   * und bei -1 haetten wir eine Schwelle von 8, die nie mehr etwas filtert.
   */
  assert.match(
    sql,
    /fehler\s*=\s*greatest\(\s*public\.karten_fortschritt\.fehler\s*\+\s*v_fehler_delta\s*,\s*0\s*\)/i,
    "Der UPDATE-Zweig senkt die Fehlerzahl nicht über v_fehler_delta (bzw. ohne Untergrenze 0).",
  );
  assert.match(
    sql,
    /values[\s\S]*?greatest\(v_fehler_delta,\s*0\)/i,
    "Der INSERT-Zweig setzt die Fehlerzahl nicht auf v_fehler_delta – eine neue Zeile waere dadurch immer falsch.",
  );

  /*
   * Treffer bleibt so, wie es war: 'nochmal' ist der einzige Nicht-Treffer.
   * Es zaehlt nicht als Erfolg, aber auch nicht (mehr) als Fehler – das
   * wuerde eine Karte dafuer bestrafen, dass sie ehrlich als schwer markiert
   * wurde.
   */
  const treffer = sql.match(
    /treffer\s*=\s*public\.karten_fortschritt\.treffer\s*\+\s*case when p_bewertung = '(\w+)'\s+then 0 else 1 end/i,
  );
  assert.ok(treffer, "treffer wird in antwort_verbuchen nicht nachgefuehrt");
  assert.equal(treffer[1], "nochmal", "nur 'nochmal' darf den Trefferzaehler senken");
});

test("Leech-Schwelle stimmt zwischen Code und View ueberein", () => {
  const view = viewUebersicht();

  // "karten_faellig" blendet Karten mit fehler >= 8 aus. Die View rechnet das
  // als "coalesce(f.fehler, 0) < 8". Wenn LEECH_FEHLER sich aendert, muss
  // diese Zahl hier mitziehen – sonst laufen Kacheln und Lernroute auseinander.
  // Bewusst grosszuegig: coalesce(...) ist im Laufe der Migrationen gewandert,
  // die Bedeutung ist dieselbe. Gesucht wird die eine 8, nicht die Form.
  const schwelle = view.match(/coalesce\(\s*f\.fehler\s*,\s*0\s*\)\s*<\s*(\d+)/i);
  assert.ok(
    schwelle,
    "Die View filtert karten_faellig nicht mehr ueber 'fehler < n' – " +
      "die Leech-Regel wurde verschoben.",
  );
  assert.equal(
    Number(schwelle[1]),
    LEECH_FEHLER,
    `View sagt "fehler < ${schwelle[1]}", Code sagt LEECH_FEHLER = ${LEECH_FEHLER}.`,
  );
});

test("die Route rechnet Stufe und XP mit der getesteten Logik", () => {
  // Schluessen der Kette: app/api/lernen/antwort/route.ts ruft die Funktion
  // auf. Rechnet sie dort mit eigenen Zahlen statt mit stufeNachAntwort und
  // xpFuerBewertung, waeren die Tests hier gruen und die Daten trotzdem falsch.
  const route = readFileSync(
    join(import.meta.dirname, "..", "app", "api", "lernen", "antwort", "route.ts"),
    "utf8",
  );

  assert.match(route, /stufeNachAntwort\(/, "die Route nutzt stufeNachAntwort nicht");
  assert.match(route, /xpFuerBewertung\(/, "die Route nutzt xpFuerBewertung nicht");
  assert.match(route, /p_neue_stufe:\s*neueStufe/, "p_neue_stufe wird nicht gesetzt");
  assert.match(route, /p_xp:\s*xp/, "p_xp wird nicht gesetzt");
});