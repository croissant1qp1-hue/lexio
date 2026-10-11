import { strict as assert } from "node:assert";
import { test } from "node:test";

import { apiBasis } from "../src/lib/api-basis.ts";

test("gesetzte API-URL gewinnt und verliert trailing Slashes", () => {
  assert.equal(apiBasis("https://lexio.example/", "192.168.1.5:8081"), "https://lexio.example");
  assert.equal(apiBasis("https://lexio.example/a//", undefined), "https://lexio.example/a");
});

test("Metro-hostUri wird zum Host, Port 3210 haengt an", () => {
  assert.equal(apiBasis(undefined, "192.168.1.5:8081"), "http://192.168.1.5:3210");
  assert.equal(apiBasis(undefined, "localhost:19006"), "http://localhost:3210");
});

test("hostUri ohne Port behaelt den Namen (Tunnel-Mode)", () => {
  assert.equal(apiBasis(undefined, "abc-123.exp.direct"), "http://abc-123.exp.direct:3210");
});

test("ohne alles bleibt der lokale Rueckfall", () => {
  assert.equal(apiBasis(undefined, undefined), "http://localhost:3210");
});