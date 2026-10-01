/**
 * Tests fuer lib/einzelimport.ts – der milde Parser.
 *
 * Warum eigene Tests und nicht im ersten Parser: Der erste Parser hat eine
 * klare Aufgabe (Trennzeichen finden). Dieser hier macht eine
 * ANNNAHME darueber, was eine Zeile bedeutet, und eine falsche Annahme
 * erzeugt eine falsche Vokabelkarte. Diese Datei ist der Ort, an dem die
 * Annahme festgeschrieben wird.
 *
 * Jeder Testfall ist eine echte Form, die beim Kopieren aus einer fremden
 * Quelle entsteht. Erfundene Beispiele pruefen nichts.
 *
 * Aufruf: `npm test`
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { meldungFuer, textblockEinlesen } from "../lib/einzelimport";

test("Nummerierung wird abgeschnitten", () => {
  const e = textblockEinlesen(["1. Haus = house", "2. Baum = tree", "3. Fluss = river"].join("\n"));
  assert.equal(e.paare.length, 3);
  assert.deepEqual(
    e.paare.map((p) => p.frage),
    ["Haus", "Baum", "Fluss"],
  );
  assert.equal(e.paare[0].antwort, "house");
  assert.equal(e.ohneUebersetzung, 0);
});

test("Nummerierung mit Klammer und Spiegelstrich", () => {
  const e = textblockEinlesen(["1) Haus = house", "- Baum = tree", "• Fluss = river"].join("\n"));
  assert.equal(e.paare.length, 3);
  assert.deepEqual(
    e.paare.map((p) => p.frage),
    ["Haus", "Baum", "Fluss"],
  );
});

test("Bindestrich als Trennzeichen mit Leerzeichen drumherum", () => {
  const e = textblockEinlesen("Haus - house");
  assert.equal(e.paare.length, 1);
  assert.equal(e.paare[0].frage, "Haus");
  assert.equal(e.paare[0].antwort, "house");
});

test("Ausdruck als Trenner: die Uebersetzung steht am Ende", () => {
  const e = textblockEinlesen("der Hund means dog");
  assert.equal(e.paare.length, 1);
  assert.equal(e.paare[0].frage, "der Hund");
  assert.equal(e.paare[0].antwort, "dog");
});

test("'ist' und 'heisst' werden erkannt", () => {
  const e = textblockEinlesen(["Baum ist tree", "Fluss heißt river"].join("\n"));
  assert.equal(e.paare.length, 2);
  assert.equal(e.paare[0].frage, "Baum");
  assert.equal(e.paare[0].antwort, "tree");
  assert.equal(e.paare[1].frage, "Fluss");
  assert.equal(e.paare[1].antwort, "river");
});

test("Wortliste ohne Trenner kommt als offene Zeilen durch", () => {
  const e = textblockEinlesen(["Haus", "Baum", "Fluss"].join("\n"));
  assert.equal(e.paare.length, 3);
  assert.deepEqual(
    e.paare.map((p) => p.frage),
    ["Haus", "Baum", "Fluss"],
  );
  // Der entscheidende Punkt: leer, aber nicht verloren.
  assert.deepEqual(
    e.paare.map((p) => p.antwort),
    ["", "", ""],
  );
  assert.equal(e.ohneUebersetzung, 3);
});

test("Gemischte Liste: fertige Zeilen und offene Zeilen zusammen", () => {
  const e = textblockEinlesen(["1. Haus = house", "Baum", "3. Fluss = river"].join("\n"));
  assert.equal(e.paare.length, 3);
  assert.equal(e.paare[0].antwort, "house");
  assert.equal(e.paare[1].frage, "Baum");
  assert.equal(e.paare[1].antwort, "");
  assert.equal(e.paare[2].antwort, "river");
  assert.equal(e.ohneUebersetzung, 1);
});

test("Tabulator aus der Tabellenkalkulation liefert vier Spalten", () => {
  const e = textblockEinlesen("Haus\thouse\tThe house is big\tDas Haus ist groß");
  assert.equal(e.paare.length, 1);
  assert.equal(e.paare[0].frage, "Haus");
  assert.equal(e.paare[0].antwort, "house");
  assert.equal(e.paare[0].beispiel, "The house is big");
  // Das Umlaut bleibt unangetastet: der Parser raeumt nur Leerraum auf.
  // (Der Test schreibt es mit ss, weil er vorher einmal an einem Encoding
  // im Testfile gescheitert ist – die Quelle ist die Datei, nicht der Code.)
  assert.equal(e.paare[0].beispielUebersetzung, "Das Haus ist groß");
});

test("Mehr als vier Spalten werden verworfen, nicht geraten", () => {
  // Fuenf Spalten: eine Tabelle, keine Wortliste. Lieber weg als falsch.
  // Wichtig: die Zeile darf auch nicht als "irgendwas" durchfallen – sie
  // muss als uebersprungen gemeldet werden, damit die Zahl stimmt.
  const e = textblockEinlesen("a\tb\tc\td\te");
  assert.equal(e.paare.length, 0);
  assert.equal(e.uebersprungen, 1);
});

test("Fliesstext wird nicht zu Vokabeln", () => {
  const e = textblockEinlesen(
    "Das Kapitel handelt von den vergangenen Tagen und ihren Folgen fuer die Stadt.",
  );
  assert.equal(e.paare.length, 0);
});

test("'bedeutet' ist absichtlich KEIN Trennner", () => {
  /*
   * Bewusst eine offene Zeile und keine Aufteilung.
   *
   * "bedeutet" steht in Wörterbüchern und in Schulaufgaben ("Was bedeutet
   * blau?"), aber genauso in Sätzen, in denen es nichts mit einem Wortpaar
   * zu tun hat. Wer es als Trenner führt, macht aus jedem deutschen Satz
   * mit dem Wort eine falsche Vokabelkarte – und zwar still.
   *
   * Die offene Zeile ist der sichere Ausgang: sichtbar, löschbar, und sie
   * steht am Ende der Liste, wo man sie ohnehin noch einmal liest.
   */
  const e = textblockEinlesen("das bedeutet mir viel und mehr");
  assert.equal(e.paare.length, 1);
  assert.equal(e.paare[0].frage, "das bedeutet mir viel und mehr");
  assert.equal(e.paare[0].antwort, "");
  assert.equal(e.ohneUebersetzung, 1);
});

test("Mehrere Woerter sind ein Begriff, kein Fehlversuch", () => {
  const e = textblockEinlesen("zum Bahnhof");
  assert.equal(e.paare.length, 1);
  assert.equal(e.paare[0].frage, "zum Bahnhof");
  assert.equal(e.paare[0].antwort, "");
});

test("Leerzeilen und Leerraum stoeren nicht", () => {
  const e = textblockEinlesen("\n\nHaus = house\n\n   \nBaum = tree\n\n");
  assert.equal(e.paare.length, 2);
});

test("Mehrere Leerzeichen werden zu einem", () => {
  const e = textblockEinlesen("Haus    =    house");
  assert.equal(e.paare[0].frage, "Haus");
  assert.equal(e.paare[0].antwort, "house");
});

test("Pfeilzeichen wie aus einer Notizliste", () => {
  const e = textblockEinlesen(["Apfel -> apple", "Birne -> pear"].join("\n"));
  assert.equal(e.paare.length, 2);
  assert.equal(e.paare[0].frage, "Apfel");
  assert.equal(e.paare[0].antwort, "apple");
});

test("Meldung nennt die Zahl und warnt vor fehlenden Uebersetzungen", () => {
  const voll = textblockEinlesen(["Haus = house", "Baum = tree"].join("\n"));
  assert.equal(meldungFuer(voll), "2 Zeilen erkannt.");

  const offen = textblockEinlesen(["Haus", "Baum", "Fluss"].join("\n"));
  const m = meldungFuer(offen);
  assert.ok(m.includes("3 Zeilen"));
  assert.ok(m.includes("fehlt bei 3 Zeilen die Übersetzung"));

  const eins = textblockEinlesen(["Haus = house", "Baum"].join("\n"));
  assert.ok(meldungFuer(eins).includes("fehlt bei 1 Zeile die Übersetzung"));
});

test("Leere Eingabe ist kein Fehler, sondern eine leere Liste", () => {
  const e = textblockEinlesen("");
  assert.equal(e.paare.length, 0);
  assert.equal(e.ohneUebersetzung, 0);
});

test("Doppelpunkt aus einer zweispaltigen Liste", () => {
  const e = textblockEinlesen(["Haus: house", "Baum: tree"].join("\n"));
  assert.equal(e.paare.length, 2);
  assert.equal(e.paare[0].antwort, "house");
});