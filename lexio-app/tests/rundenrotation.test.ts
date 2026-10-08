import { strict as assert } from "node:assert";
import { test } from "node:test";

import type { Bewertung } from "@lexio/lernlogik";

import { rotiere } from "../src/lib/rundenrotation.ts";

type K = { id: string };

test("nochmal legt die Karte ans Ende, Index bleibt", () => {
  const stapel: K[] = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const r = rotiere(stapel, 0, stapel[0], "nochmal", false);
  assert.deepEqual(r.stapel.map((k) => k.id), ["b", "c", "a"]);
  assert.equal(r.fertig, false);
});

test("gut entnimmt die Karte, die naechste rutscht nach", () => {
  const stapel: K[] = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const r = rotiere(stapel, 0, stapel[0], "gut", false);
  assert.deepEqual(r.stapel.map((k) => k.id), ["b", "c"]);
  assert.equal(r.fertig, false);
});

test("letzte Karte mit gut beendet die Runde", () => {
  const stapel: K[] = [{ id: "a" }];
  const r = rotiere(stapel, 0, stapel[0], "einfach", false);
  assert.deepEqual(r.stapel.map((k) => k.id), []);
  assert.equal(r.fertig, true);
});

test("letzte Karte mit nochmal endet nicht", () => {
  const stapel: K[] = [{ id: "a" }];
  const r = rotiere(stapel, 0, stapel[0], "nochmal", false);
  assert.deepEqual(r.stapel.map((k) => k.id), ["a"]);
  assert.equal(r.fertig, false);
});

test("Karte in der Mitte weg: Index hinter der neuen Laenge macht fertig", () => {
  const stapel: K[] = [{ id: "a" }, { id: "b" }];
  const r = rotiere(stapel, 1, stapel[1], "gut", false);
  assert.deepEqual(r.stapel.map((k) => k.id), ["a"]);
  assert.equal(r.fertig, true);
});

test("schwer mit scharfem Wuerfel bleibt in der Runde", () => {
  const stapel: K[] = [{ id: "a" }, { id: "b" }];
  const r = rotiere(stapel, 0, stapel[0], "schwer", true);
  assert.deepEqual(r.stapel.map((k) => k.id), ["b", "a"]);
  assert.equal(r.fertig, false);
});

test("schwer mit weichem Wuerfel nimmt die Karte raus", () => {
  const stapel: K[] = [{ id: "a" }, { id: "b" }];
  const r = rotiere(stapel, 0, stapel[0], "schwer", false);
  assert.deepEqual(r.stapel.map((k) => k.id), ["b"]);
  assert.equal(r.fertig, false);
});

test("nur nochmal in der Runde: fertig erst, wenn alle endgueltig raus sind", () => {
  let stapel: K[] = [{ id: "a" }, { id: "b" }];
  let index = 0;
  let fertig = false;
  const bewertungen: Bewertung[] = ["nochmal", "nochmal", "gut", "nochmal", "gut"];
  for (const bewertung of bewertungen) {
    const r = rotiere(stapel, index, stapel[index], bewertung, false);
    stapel = r.stapel;
    fertig = r.fertig;
  }
  assert.equal(fertig, true);
  assert.equal(stapel.length, 0);
});