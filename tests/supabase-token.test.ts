/**
 * Tests fuer lib/supabase/token.ts – die einzige Stelle, die einen
 * `Authorization: Bearer …`-Header in ein Access-Token verwandelt.
 *
 * Die App aus Phase 7 haengt ihr Token an genau diesen Header und laeuft
 * dann gegen dieselben Routen wie der Browser. Die reine Funktion lebt
 * bewusst ohne Next.js-Bezug in einer eigenen Datei: hier wird geprueft,
 * was als Session durchgehen darf, und das soll ohne Framework-Last
 * testbar sein.
 *
 * Aufruf: `npm test`
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { tokenAusAuthorizationHeader } from "../lib/supabase/token.ts";

test("ohne Header: kein Token", () => {
  assert.equal(tokenAusAuthorizationHeader(null), null);
  assert.equal(tokenAusAuthorizationHeader(undefined as unknown as string), null);
  assert.equal(tokenAusAuthorizationHeader(""), null);
});

test("richtiger Bearer-Header: das Access-Token", () => {
  const token = "eyJhbGciOiJIUzI1NiJ9.token";
  assert.equal(tokenAusAuthorizationHeader(`Bearer ${token}`), token);
});

test("Schema ist case-insensitive", () => {
  assert.equal(
    tokenAusAuthorizationHeader("bearer abc"),
    "abc",
  );
  assert.equal(
    tokenAusAuthorizationHeader("BEARER abc"),
    "abc",
  );
});

test("aufgelesene Whitespaces stoert nicht", () => {
  assert.equal(tokenAusAuthorizationHeader("  Bearer   abc  "), "abc");
});

test("fremdes Schema: kein Token", () => {
  assert.equal(tokenAusAuthorizationHeader("Basic abc"), null);
  assert.equal(tokenAusAuthorizationHeader("digest abc"), null);
});

test("fehlende oder leere Token: kein Token", () => {
  assert.equal(tokenAusAuthorizationHeader("Bearer"), null);
  assert.equal(tokenAusAuthorizationHeader("Bearer "), null);
});

test("mehrere Token: kein Token statt das erste zu nehmen", () => {
  assert.equal(tokenAusAuthorizationHeader("Bearer abc def"), null);
});