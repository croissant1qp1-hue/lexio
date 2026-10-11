import { strict as assert } from "node:assert";
import { test } from "node:test";

import { sprechText } from "../src/lib/sprechtext.ts";

test("antwort und beispielsatz werden zu einem Text", () => {
  assert.equal(sprechText(["world", "I go to school."]), "world. I go to school.");
});

test("ein einzelnes Wort bekommt den Schlusspunkt", () => {
  assert.equal(sprechText(["world"]), "world.");
});

test("leere und null-Teile fallen weg", () => {
  assert.equal(sprechText(["world", null, "", "   "]), "world.");
});

test("nur leere Teile ergeben null (nichts zum Sprechen)", () => {
  assert.equal(sprechText([null, undefined, "", "  "]), null);
  assert.equal(sprechText([]), null);
});

test("doppelter Schlusspunkt wird geschluckt", () => {
  assert.equal(sprechText(["I go to school."]), "I go to school.");
});

test("Teile werden getrimmt", () => {
  assert.equal(sprechText(["  world  ", " yes "]), "world. yes.");
});