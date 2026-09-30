/**
 * Tests fuer lib/lernlogik.ts – die Stufen- und XP-Logik.
 *
 * Warum ueberhaupt: diese Datei ist die einzige Stelle, die entscheidet, wie
 * sich eine Karte nach einer Antwort verhaelt. Sie wird aus der Route
 * aufgerufen, ohne dass irgendwo eine Typabweichung entstehen kann – ein
 * falscher Wert landet still in der Datenbank und faellt erst Wochen spaeter
 * auf, wenn sich jemand wundert, warum eine Karte zu selten kommt.
 *
 * Aufruf: `npm test`
 * Laeuft mit dem eingebauten Testrunner von Node (>= 22.6 mit
 * --experimental-strip-types, ab 24 ohne Flag). Kein Framework noetig.
 *
 * Die zweite Testdatei (sql-paritaet.test.ts) prueft die andere Haelfte:
 * dass TypeScript und SQL dieselben Bewertungen kennen.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  BEWERTUNGEN,
  LEECH_FEHLER,
  faelligAb,
  intervallFuerStufe,
  intervallVorschau,
  istBewertung,
  stufeNachAntwort,
  xpFuerBewertung,
  type Bewertung,
} from "../lib/lernlogik.ts";

/**
 * Stufenuebergaenge, an einer Stelle festgeschrieben.
 *
 * Nicht aus BEWERTUNGEN abgeleitet: ein Test, der die erwartete Zahl aus der
 * gleichen Quelle zieht, die er pruefen soll, prueft nichts. Diese Tabelle
 * ist die Absicht, der Code ist die Umsetzung.
 */
const UEBERGAENGE: {
  bewertung: Bewertung;
  von: number;
  nach: number;
}[] = [
  { bewertung: "einfach", von: 0, nach: 2 },
  { bewertung: "einfach", von: 3, nach: 5 },
  { bewertung: "gut", von: 0, nach: 1 },
  { bewertung: "gut", von: 5, nach: 6 },
  { bewertung: "schwer", von: 5, nach: 4 },
  { bewertung: "schwer", von: 1, nach: 0 },
  { bewertung: "nochmal", von: 5, nach: 3 },
  { bewertung: "nochmal", von: 1, nach: 0 },
];

test("stufeNachAntwort: Stufen folgen der erwarteten Kurve", () => {
  for (const { bewertung, von, nach } of UEBERGAENGE) {
    assert.equal(
      stufeNachAntwort(von, bewertung),
      nach,
      `${bewertung} von Stufe ${von} sollte Stufe ${nach} ergeben`,
    );
  }
});

test("stufeNachAntwort: keine negative Stufe", () => {
  // Untergrenze ist 0, nicht -1. Eine negative Stufe waere ein Index
  // ausserhalb des Intervall-Arrays und hiesse in der View "faellig",
  // ohne dass die Route es so berechnet hat.
  for (const bewertung of BEWERTUNGEN.map((b) => b.id)) {
    for (const stufe of [0, 1, 2]) {
      const ergebnis = stufeNachAntwort(stufe, bewertung);
      assert.ok(
        ergebnis >= 0,
        `${bewertung} von ${stufe} ergab ${ergebnis}, das ist negativ`,
      );
    }
  }
  assert.equal(stufeNachAntwort(0, "nochmal"), 0);
  assert.equal(stufeNachAntwort(1, "schwer"), 0);
});

test("stufeNachAntwort: negative Eingabe wird wie 0 behandelt", () => {
  // Defensiv: die Spalte ist nullable im Altbestand. -3 darf nicht zu -5
  // werden, sondern bleibt bei 0.
  for (const bewertung of BEWERTUNGEN.map((b) => b.id)) {
    assert.equal(stufeNachAntwort(-3, bewertung), stufeNachAntwort(0, bewertung));
  }
});

test("intervallFuerStufe: haelt sich an die Intervalltabelle", () => {
  const erwartet = [0, 1, 3, 7, 16, 35, 60];
  for (const [stufe, tage] of erwartet.entries()) {
    assert.equal(
      intervallFuerStufe(stufe),
      tage,
      `Stufe ${stufe} sollte ${tage} Tage warten`,
    );
  }
});

test("intervallFuerStufe: ueber der letzten Stufe wird nicht geklemmt-unendlich", () => {
  // Ohne Math.min waere INTERVALLE[99] undefined und faelligAb ergaebe
  // "NaN" als Datum – Postgres wuerde das ablehnen, die Runde waere weg.
  const letzte = 60;
  assert.equal(intervallFuerStufe(7), letzte);
  assert.equal(intervallFuerStufe(50), letzte);
  assert.equal(intervallFuerStufe(999), letzte);
});

test("intervallFuerStufe: negative Stufe wartet nicht", () => {
  assert.equal(intervallFuerStufe(-1), 0);
  assert.equal(intervallFuerStufe(-99), 0);
});

test("faelligAb: liefert ein ISO-Datum fuer Postgres", () => {
  assert.equal(
    faelligAb(3, new Date("2026-03-10T00:00:00Z")),
    "2026-03-17",
    "Stufe 3 wartet 7 Tage",
  );
  assert.equal(
    faelligAb(0, new Date("2026-03-10T00:00:00Z")),
    "2026-03-10",
    "Stufe 0 ist sofort wieder faellig",
  );
  assert.equal(
    faelligAb(6, new Date("2026-03-10T00:00:00Z")),
    "2026-05-09",
    "Stufe 6 wartet 60 Tage",
  );
});

test("faelligAb: Monatswechsel und Schaltjahr stimmen", () => {
  // Das Datum rechnet in UTC, damit ein Lauf um 23 Uhr Ortszeit nicht
  // plötzlich einen Tag danebenliegt.
  assert.equal(faelligAb(1, new Date("2026-01-31T12:00:00Z")), "2026-02-01");
  assert.equal(faelligAb(1, new Date("2024-02-28T12:00:00Z")), "2024-02-29");
  assert.equal(faelligAb(2, new Date("2025-12-30T12:00:00Z")), "2026-01-02");
});

test("faelligAb: Rueckgabe ist immer YYYY-MM-DD", () => {
  for (const stufe of [0, 1, 2, 3, 4, 5, 6, 7, 20]) {
    const datum = faelligAb(stufe, new Date("2026-06-15T23:30:00Z"));
    assert.match(datum, /^\d{4}-\d{2}-\d{2}$/, `Stufe ${stufe} ergab ${datum}`);
  }
});

test("xpFuerBewertung: die vier XP-Werte", () => {
  assert.equal(xpFuerBewertung("nochmal"), 0);
  assert.equal(xpFuerBewertung("schwer"), 2);
  assert.equal(xpFuerBewertung("gut"), 5);
  assert.equal(xpFuerBewertung("einfach"), 8);
});

test("xpFuerBewertung: unbekannte Bewertung ist 0, nicht NaN", () => {
  assert.equal(xpFuerBewertung("quatsch" as Bewertung), 0);
  assert.equal(xpFuerBewertung(undefined as unknown as Bewertung), 0);
});

test("BEWERTUNGEN: nochmal gibt 0 XP, Reihenfolge aufsteigend", () => {
  // "nochmal" mit 0 XP ist Absicht (Plan 1.3): eine Wiederholung soll kein
  // Fortschritt bedeuten, sonst farmt man XP durchs Scheitern.
  assert.deepEqual(
    BEWERTUNGEN.map((b) => b.id),
    ["nochmal", "schwer", "gut", "einfach"],
  );
  const xps = BEWERTUNGEN.map((b) => b.xp);
  assert.equal(xps[0], 0);
  for (let i = 1; i < xps.length; i++) {
    assert.ok(
      xps[i] > xps[i - 1],
      `XP sind nicht aufsteigend sortiert: ${xps.join(", ")}`,
    );
  }
});

test("BEWERTUNGEN: jede Bewertung hat Label und Knopfbeschriftung", () => {
  for (const b of BEWERTUNGEN) {
    assert.ok(b.label.length > 0, `${b.id} hat kein Label`);
    assert.ok(b.knopf.length > 0, `${b.id} hat keine Knopfbeschriftung`);
  }
});

test("istBewertung: erkennt gueltige und weist ungueltige ab", () => {
  for (const b of BEWERTUNGEN) {
    assert.equal(istBewertung(b.id), true, `${b.id} sollte gueltig sein`);
  }
  for (const wert of ["", "GUT", "Nochmal", "gut ", null, undefined, 5, {}, []]) {
    assert.equal(
      istBewertung(wert),
      false,
      `${JSON.stringify(wert)} ist keine Bewertung`,
    );
  }
});

test("intervallVorschau: zeigt den naechsten Termin, nicht den jetzigen", () => {
  // Die Lernansicht zeigt vor dem Klick, wann die Karte wiederkommt. Das ist
  // intervallFuerStufe auf der STUFE NACH der Antwort.
  assert.equal(intervallVorschau(2, "einfach"), intervallFuerStufe(4));
  assert.equal(intervallVorschau(2, "gut"), intervallFuerStufe(3));
  assert.equal(intervallVorschau(5, "nochmal"), intervallFuerStufe(3));
  assert.equal(intervallVorschau(0, "schwer"), intervallFuerStufe(0));
});

test("intervallVorschau: 'einfach' schiebt weiter weg als 'gut'", () => {
  // Bis zum Deckel gilt: zwei Stufen mehr bedeutet einen laengeren Weg.
  // Ab Stufe 5 stehen beide auf dem letzten Intervall (60 Tage) – der Deckel
  // in intervallFuerStufe macht die Vorschau dort bewusst gleich, statt
  // einenitraeger zu erfinden.
  for (let stufe = 0; stufe <= 4; stufe++) {
    assert.ok(
      intervallVorschau(stufe, "einfach") > intervallVorschau(stufe, "gut"),
      `Ab Stufe ${stufe}: einfach sollte weiter weg liegen als gut`,
    );
  }
  // Und nie umgekehrt, auch nicht am Deckel.
  for (let stufe = 0; stufe < 8; stufe++) {
    assert.ok(
      intervallVorschau(stufe, "einfach") >= intervallVorschau(stufe, "gut"),
      `Ab Stufe ${stufe}: einfach liegt nie weiter weg als gut`,
    );
  }
});

test("LEECH_FEHLER: Schwelle ist 8 und steht nicht im Konflikt mit den Intervallen", () => {
  // Der Wert steht auch in der View karteikarten_sets_uebersicht
  // ("fehler < 8"). Beide muessen uebereinstimmen – sonst blendet die
  // Uebersicht eine Karte aus, die die Lernroute noch anzeigt.
  assert.equal(LEECH_FEHLER, 8);
  assert.ok(LEECH_FEHLER > 0, "Schwelle 0 wuerde jede Karte zum Leech machen");
});

test("stufeNachAntwort: acht Fehler in Folge ergeben die Leech-Schwelle", () => {
  // Deckt sich mit LEECH_FEHLER und macht den Zusammenhang zwischen den
  // beiden Konstanten pruefbar: wer diese Karte achtmal "nochmal" beantwortet,
  // landet bei 8 Fehlern und damit genau auf der Schwelle.
  let stufe = 6;
  for (let i = 0; i < 8; i++) stufe = stufeNachAntwort(stufe, "nochmal");
  assert.equal(stufe, 0, "nach acht Fehlern ist die Stufe am Boden");
});