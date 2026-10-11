import { strict as assert } from "node:assert";
import { test } from "node:test";

import { rundenFortschritt } from "../src/lib/rundenfortschritt.ts";

test("zu Beginn steht die erste Karte von der Rundengroesse", () => {
  assert.deepEqual(rundenFortschritt(20, 20), { position: 1, gesamt: 20 });
});

test("nach einer entnommenen Karte eine weiter", () => {
  assert.deepEqual(rundenFortschritt(20, 19), { position: 2, gesamt: 20 });
});

test("die letzte Karte ist die letzte der Runde", () => {
  assert.deepEqual(rundenFortschritt(20, 1), { position: 20, gesamt: 20 });
});

test("nochmal (Karte bleibt) bewegt die Anzeige nicht", () => {
  assert.deepEqual(rundenFortschritt(20, 20), rundenFortschritt(20, 20));
  assert.deepEqual(rundenFortschritt(3, 3).position, 1);
});

test("leere Runde zeigt 0 / 0", () => {
  assert.deepEqual(rundenFortschritt(0, 0), { position: 0, gesamt: 0 });
});

test("unerwartete Zahlen werden geklemmt", () => {
  assert.deepEqual(rundenFortschritt(20, 25), { position: 1, gesamt: 20 });
  assert.deepEqual(rundenFortschritt(20, -1), { position: 20, gesamt: 20 });
  assert.deepEqual(rundenFortschritt(-5, 3), { position: 0, gesamt: 0 });
});

test("Kommateil wird abgeschnitten", () => {
  assert.deepEqual(rundenFortschritt(20.9, 19.4), { position: 2, gesamt: 20 });
});
