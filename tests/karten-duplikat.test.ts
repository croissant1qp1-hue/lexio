import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { doppelteIndizes, duplikatMeldung, paarSchluessel } from "../lib/karten-duplikat";
import { dateiBefund } from "../scripts/wortlisten-importieren.mjs";

/*
 * Grundlage ist ein Fund am eigenen Testset: `POST /api/karten` nahm dasselbe
 * Paar zweimal an (dog/Hund und cat/Katze), weil nichts geprueft wurde und
 * `public.karten` ausser `karten_pkey (id)` keine Eindeutigkeit kennt.
 */

test("Ein Paar, das schon im Set steht, wird abgelehnt", () => {
  const treffer = doppelteIndizes([{ frage: "Hund", antwort: "dog" }], [
    { frage: "Hund", antwort: "dog" },
  ]);

  assert.deepEqual(treffer, [0]);
});

test("Gross-/Kleinschreibung und Randleerzeichen sind kein Unterschied", () => {
  const treffer = doppelteIndizes([{ frage: " hund ", antwort: "Dog" }], [
    { frage: "Hund", antwort: "dog" },
  ]);

  assert.deepEqual(treffer, [0]);
});

test("Dasselbe Paar zweimal im Stapel wird abgelehnt — auch ohne Bestand", () => {
  // Nur gegen den Bestand zu pruefen waere die halbe Sache: dann waere ein
  // Stapel mit zwei gleichen Zeilen genau der Weg, an dem der Import am
  // 2026-10-04 durchgerutscht ist.
  const treffer = doppelteIndizes(
    [
      { frage: "probe eins", antwort: "probe one" },
      { frage: "probe zwei", antwort: "probe two" },
      { frage: "Probe Eins", antwort: "probe one" },
    ],
    [],
  );

  assert.deepEqual(treffer, [2]);
});

test("Der Index zeigt auf die spätere Zeile, nicht auf beide", () => {
  const treffer = doppelteIndizes(
    [
      { frage: "A", antwort: "a" },
      { frage: "B", antwort: "b" },
      { frage: "A", antwort: "a" },
      { frage: "B", antwort: "b" },
    ],
    [],
  );

  assert.deepEqual(treffer, [2, 3]);
});

test("Gleiche englische Seite bei anderem deutschen Wort ist KEIN Dublett", () => {
  // "Bank" heisst Bench und Bank. Der Import fasst auf der englischen Seite
  // zusammen (sein Kommentar sagt das), diese Pruefung darf es nicht — sonst
  // koennte jemand zwei woertlich verschiedene Karten nicht anlegen.
  const treffer = doppelteIndizes(
    [
      { frage: "Bank (Geld)", antwort: "bank" },
      { frage: "Bank (Sitz)", antwort: "bench" },
      { frage: "Bank", antwort: "Bank" },
    ],
    [],
  );

  assert.deepEqual(treffer, []);
});

test("Verschiedene Paare bleiben unangetastet", () => {
  const treffer = doppelteIndizes(
    [
      { frage: "Hund", antwort: "dog" },
      { frage: "Katze", antwort: "cat" },
      { frage: "Beispiel", antwort: "sample" },
    ],
    [
      { frage: "Vogel", antwort: "bird" },
      { frage: "Fisch", antwort: "fish" },
    ],
  );

  assert.deepEqual(treffer, []);
});

test("Der Schluessel verwechselt kein Trennzeichen mit einem Wort", () => {
  // Mit einem Trennzeichen waere "a|b" + "c" nicht von "a" + "b|c" zu
  // unterscheiden — zwei verschiedene Paare, die gleich aussehen.
  assert.notEqual(paarSchluessel("a|b", "c"), paarSchluessel("a", "b|c"));
});

test("Fehlender Begriff und leerer Begriff sind derselbe Schluessel", () => {
  // Bewusst gleich, und nicht etwa einVersehen: beide heissen "es gibt keine
  // deutsche Seite". Die Karte faellt vorher sowieso bei `pruefePaar` heraus
  // ("Begriff fehlt") und erreicht diese Pruefung nie — die Gleichheit hier
  // kann also nichts falsch zurueckweisen.
  assert.equal(paarSchluessel(undefined, "dog"), paarSchluessel("", "dog"));
  assert.equal(paarSchluessel("Hund", undefined), paarSchluessel("Hund", ""));
});

test("Die Meldung nennt das Paar, das schon da ist", () => {
  const meldung = duplikatMeldung({ frage: " Hund ", antwort: " dog " });

  assert.match(meldung, /Hund \/ dog/);
});

/*
 * Der Import liest eine fertige Datei, die API nimmt Handeingaben. Beide
 * brauchen dieselbe Antwort auf "ist das dasselbe Paar", sonst ist eine der
 * beiden Sperren wertlos. Geprueft wird dieselbe Eingabe durch beide Wege.
 */
test("Import und API sind sich ueber Dubletten einig", () => {
  const eingabe = [
    { frage: "Hund", antwort: "dog" },
    { frage: " hund ", antwort: "Dog" },
    { frage: "Katze", antwort: "cat" },
    { frage: "Bank", antwort: "bench" },
    { frage: "Bank", antwort: "Bank" },
  ];

  /*
   * Verglichen werden die Schluessel, nicht die Rueckgaben: die beiden Wege
   * liefern verschiedene Formen (der Import trimmed, die API gibt das Paar
   * unveraendert zurueck). Vergleicht man die Objekte, vergleicht man die
   * falsche Sache — geprueft ist hier die Frage "welche Zeilen sind Dubletten".
   */
  const ausDerApi = doppelteIndizes(eingabe, []).map((i) =>
    paarSchluessel(eingabe[i].frage, eingabe[i].antwort),
  );
  const ausDemImport = dateiBefund(eingabe).map((d) => paarSchluessel(d.frage, d.antwort));

  assert.deepEqual(ausDerApi, ausDemImport);
  assert.equal(ausDerApi.length, 1, "genau eine Dublette in der Vorlage");
});

/*
 * Und die Verdrahtung. Diese Tests treffen sonst nur die reine Funktion, und
 * eine Sperre, die im Modul steht und von keiner Route benutzt wird, waere
 * unauffindbar.
 */
const WURZEL = join(import.meta.dirname, "..");

test("POST /api/karten benutzt die Dublettenpruefung", () => {
  const quelle = readFileSync(join(WURZEL, "app/api/karten/route.ts"), "utf8");

  assert.match(quelle, /doppelteIndizes/);
  assert.match(quelle, /duplikatMeldung/);
  // Gegen den Bestand im Set, nicht gegen eine Liste aus dem Aufruf.
  assert.match(quelle, /\.from\("karten"\)[\s\S]{0,120}select\("frage, antwort"\)/);
});

test("PATCH /api/karten benutzt die Dublettenpruefung ebenfalls", () => {
  // Nur POST zu pruefen waere halbe Arbeit: `bearbeiten` macht dasselbe Paar
  // genauso leicht wie `hinzufuegen`.
  const quelle = readFileSync(join(WURZEL, "app/api/karten/[id]/route.ts"), "utf8");

  assert.match(quelle, /doppelteIndizes/);
  assert.match(quelle, /duplikatMeldung/);
});