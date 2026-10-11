/**
 * Tests fuer lib/rundenrotation.ts – was mit einer Karte in der Runde passiert.
 *
 * Warum ueberhaupt: hier ging eine Karte verloren. Die Stelle hieß einmal
 * `[...liste.slice(index + 1), karte]` und warf damit den gesehenen Anfang
 * der Runde weg. Sichtbar wurde das nicht in den Daten – der Server bekam
 * jede Antwort – sondern nur im Verlauf: ab der dritten Karte wurde jede
 * "nochmal"-Bewertung zur uebersprungenen Karte. Der Test haelt die beiden
 * Zusicherungen fest, die das verhindern: die Laenge bleibt gleich, und der
 * Cursor zeigt danach auf den direkten Nachfolger.
 *
 * Aufruf: `npm test`
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { nachHinten } from "../lib/rundenrotation.ts";

test("Karte wandert ans Ende, die anderen behalten ihre Reihenfolge", () => {
    assert.deepEqual(nachHinten(["a", "b", "c", "d", "e"], 1), ["a", "c", "d", "e", "b"]);
});

test("Die Runde behaelt ihre Laenge (karten.length ist die Rundengroesse)", () => {
    const liste = ["a", "b", "c", "d", "e"];
    assert.equal(nachHinten(liste, 2).length, liste.length);
});

test("Regression: der gesehene Anfang darf nicht wegfallen", () => {
    // Frueher: [...liste.slice(3), liste[2]] === ["d", "e", "f", "c"] – "a"
    // und "b" waren weg, und karten[2] zeigte auf "f" statt auf "d".
    const liste = ["a", "b", "c", "d", "e", "f"];
    assert.deepEqual(nachHinten(liste, 2), ["a", "b", "d", "e", "f", "c"]);
});

test("Am Index 0 verhaelt sich die Drehung wie zuvor", () => {
    assert.deepEqual(nachHinten(["a", "b", "c"], 0), ["b", "c", "a"]);
});

test("Der Cursor zeigt danach auf den direkten Nachfolger (kein Sprung)", () => {
    const liste = ["a", "b", "c", "d", "e", "f"];
    const index = 2;
    assert.equal(nachHinten(liste, index)[index], liste[index + 1]);
});

test("Ausserhalb der Liste passiert nichts", () => {
    const liste = ["a", "b", "c"];
    assert.deepEqual(nachHinten(liste, 3), liste);
    assert.deepEqual(nachHinten(liste, -1), liste);
});

test("Mehrfaches Nochmal dreht dieselbe Karte immer wieder ans Ende", () => {
    let liste = ["a", "b", "c"];
    // Cursor bleibt bei 0: "a" kommt nach jedem Nochmal wieder an Position 0.
    liste = nachHinten(liste, 0);
    assert.deepEqual(liste, ["b", "c", "a"]);
    liste = nachHinten(liste, 0);
    assert.deepEqual(liste, ["c", "a", "b"]);
    liste = nachHinten(liste, 0);
    assert.deepEqual(liste, ["a", "b", "c"]);
    assert.equal(liste.length, 3);
});
