import { strict as assert } from "node:assert";
import { test } from "node:test";

import { ApiFehler, fehlerAusKoerper, postBody, wirdImmerGeworfen } from "../src/lib/api-fehler.ts";

test("ApiFehler traegt Name, Status und Felder", () => {
  const f = new ApiFehler("kaputt", 422, { email: "fehlt" });
  assert.equal(f.name, "ApiFehler");
  assert.equal(f.message, "kaputt");
  assert.equal(f.status, 422);
  assert.deepEqual(f.felder, { email: "fehlt" });
});

test("ApiFehler ohne Felder hat leere Felder, nicht undefined", () => {
  assert.deepEqual(new ApiFehler("x", 500).felder, {});
});

test("fehlerAusKoerper nimmt die Meldung der API", () => {
  const f = fehlerAusKoerper(400, { error: "E-Mail fehlt", felder: { email: "bitte" } });
  assert.equal(f.status, 400);
  assert.equal(f.message, "E-Mail fehlt");
  assert.deepEqual(f.felder, { email: "bitte" });
});

test("fehlerAusKoerper erfindet eine Meldung, wenn error fehlt", () => {
  assert.equal(fehlerAusKoerper(500, {}).message, "Fehler 500");
  assert.equal(fehlerAusKoerper(502, null).message, "Fehler 502");
  assert.equal(fehlerAusKoerper(503, undefined).message, "Fehler 503");
});

test("fehlerAusKoerper vertraegt einen fremden Koerper ohne Absturz", () => {
  const f = fehlerAusKoerper(500, "kein Objekt");
  assert.equal(f.message, "Fehler 500");
  assert.deepEqual(f.felder, {});
});

test("nur 503 wird immer geworfen", () => {
  assert.equal(wirdImmerGeworfen(503), true);
  assert.equal(wirdImmerGeworfen(401), false);
  assert.equal(wirdImmerGeworfen(500), false);
  assert.equal(wirdImmerGeworfen(200), false);
});

test("postBody macht aus undefined ein leeres Objekt", () => {
  assert.equal(postBody(undefined), "{}");
  assert.equal(postBody({ kartenId: "a" }), '{"kartenId":"a"}');
  assert.equal(postBody(null), "null");
  assert.equal(postBody({}), "{}");
});