/**
 * Tests fuer `pruefeRohKarten`.
 *
 * Der Grund ist derselbe wie in sql-paritaet.test.ts: die Logik, auf die sich
 * die Lernrunde verlaesst, liegt an zwei Stellen – im select-String der Route
 * und in diesem Modul – und TypeScript sieht die Luecke nicht. Diese Tests
 * halten fest, welche Formen erlaubt sind und welche als Fehler auffallen
 * muessen.
 *
 * Der wichtigste Fall steht unten: eine Fortschrittszeile, deren `stufe`
 * verschwunden ist. Ohne diese Pruefung wuerde die Route daraus stillschweigend
 * Stufe 0 machen und damit jede Karte als neu ausgeben.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { pruefeRohKarten } from "../lib/fortschritts-form.ts";

const zeile = { stufe: 3, gelernt: true, faellig_am: "2026-10-01", fehler: 0, treffer: 7 };

test("null und undefined sind eine leere Runde, kein Fehler", () => {
  assert.deepEqual(pruefeRohKarten(null), { ok: true, karten: [] });
  assert.deepEqual(pruefeRohKarten(undefined), { ok: true, karten: [] });
});

test("eine Karte ohne Fortschritt zaehlt als neu", () => {
  const r = pruefeRohKarten([{ id: "a", fortschritt: null }]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.ok && r.karten, [{ id: "a", fortschritt: null }]);
});

test("fehlender Fortschritt und leeres Array sind dasselbe: neu", () => {
  for (const eingebettet of [undefined, [], null]) {
    const r = pruefeRohKarten([{ id: "a", fortschritt: eingebettet }]);
    assert.equal(r.ok, true, `Form ${JSON.stringify(eingebettet)} sollte gelten`);
    assert.deepEqual(r.ok && r.karten[0].fortschritt, null);
  }
});

test("Fortschritt als Objekt wird uebernommen", () => {
  const r = pruefeRohKarten([{ id: "a", fortschritt: zeile }]);
  assert.equal(r.ok, true);
  assert.equal(r.ok && (r.karten[0].fortschritt as { stufe: number }).stufe, 3);
});

test("Fortschritt als einelementiges Array wird genauso gelesen", () => {
  const r = pruefeRohKarten([{ id: "a", fortschritt: [zeile] }]);
  assert.equal(r.ok, true);
  assert.equal(r.ok && (r.karten[0].fortschritt as { stufe: number }).stufe, 3);
});

test("mehrere Karten behalten ihre Reihenfolge", () => {
  const r = pruefeRohKarten([
    { id: "a", fortschritt: zeile },
    { id: "b", fortschritt: null },
  ]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.ok && r.karten.map((k) => k.id), ["a", "b"]);
});

test("DER Regressionstest: stufe fehlt, und das muss auffallen", () => {
  const ohneStufe = pruefeRohKarten([{ id: "a", fortschritt: { gelernt: false } }]);
  assert.equal(ohneStufe.ok, false);
  assert.match(ohneStufe.ok ? "" : ohneStufe.grund, /stufe/);
});

test("stufe als String ist ein Fehler, nicht die Zahl 0", () => {
  const r = pruefeRohKarten([{ id: "a", fortschritt: { stufe: "3" } }]);
  assert.equal(r.ok, false);
  assert.match(r.ok ? "" : r.grund, /stufe/);
});

test("stufe als NaN oder Infinity faellt ebenfalls auf", () => {
  for (const wert of [Number.NaN, Number.POSITIVE_INFINITY]) {
    const r = pruefeRohKarten([{ id: "a", fortschritt: { stufe: wert } }]);
    assert.equal(r.ok, false, `stufe=${wert} sollte auffallen`);
  }
});

test("eine Karte ohne id faellt auf", () => {
  assert.equal(pruefeRohKarten([{ fortschritt: null }]).ok, false);
  assert.equal(pruefeRohKarten([{ id: "", fortschritt: null }]).ok, false);
  assert.equal(pruefeRohKarten([{ id: 7, fortschritt: null }]).ok, false);
});

test("die Liste selbst ist Pflicht: ein Objekt statt einer Liste faellt auf", () => {
  const r = pruefeRohKarten({ id: "a" });
  assert.equal(r.ok, false);
  assert.match(r.ok ? "" : r.grund, /Liste/);
});

test("eine Zeile, die kein Objekt ist, faellt auf", () => {
  for (const eingebettet of ["stufe 3", 3, true]) {
    const r = pruefeRohKarten([{ id: "a", fortschritt: eingebettet }]);
    assert.equal(r.ok, false, `Fortschritt=${JSON.stringify(eingebettet)} sollte auffallen`);
  }
});

test("der Grund nennt die Position der Karte, nicht nur dass es klemmt", () => {
  const r = pruefeRohKarten([
    { id: "a", fortschritt: zeile },
    { id: "b", fortschritt: null },
    { id: "c", fortschritt: { stufe: null } },
  ]);
  assert.equal(r.ok, false);
  assert.match(r.ok ? "" : r.grund, /Karte 2/);
});

test("eine abweichende Zusatzform macht die Runde nicht kaputt", () => {
  /*
   * Bewusst kein Fehler: unbekannte Zusatzfelder, falsche Woerter als Schluessel
   * oder eine Zahl, die keine ist – davon haengt der Lernstand nicht ab. Nur
   * `stufe` ist kritisch, weil aus ihr der gesamte Fortschritt berechnet wird.
   * Wer hier zu streng waere, wuerde bei jedem harmlosen Schema-Wort einen
   * Fehler bekommen, den niemand gebraucht hat.
   */
  const r = pruefeRohKarten([
    { id: "a", fortschritt: { ...zeile, z_gut: "viele", quatsch: { tiefer: 1 } } },
  ]);
  assert.equal(r.ok, true);
});
