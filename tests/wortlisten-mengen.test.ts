import { test } from "node:test";
import assert from "node:assert/strict";
import { mengenBefund, dateiBefund } from "../scripts/wortlisten-importieren.mjs";

/*
 * Der Import von Wortlisten hat von Anfang an versprochen, die Mengen zu
 * prüfen ("Die Mengengleichheit pruefen wir abschliessend") — und tat es nicht.
 * Er las die Zahl aus der Datenbank, druckte sie und meldete "fertig". Ein
 * Import, der 300 von 342 Karten geschafft haette, waere als Erfolg durchgegangen.
 *
 * Der Test haelt die Regel fest, nach der heute entschieden wird. Sie ist
 * einseitig, und genau das ist der Punkt:
 *
 *   inDb < erwartet    Fehler. Karten fehlen.
 *   inDb = erwartet    Alles da.
 *   inDb > erwartet    Erlaubt und ausdruecklich kein Fehler.
 *
 * Warum "mehr" erlaubt ist: Karten werden absichtlich nie geloescht. Ein DELETE
 * auf public.karten nimmt per on delete cascade den Lernfortschritt mit, und
 * genau daran sind frueher Wordlisten-Daten verloren gegangen (Migration 011).
 * Wer ein Wort aus der Datei entfernt, laesst die Karte deshalb stehen. Ein
 * Import darf diese Karten nicht als "unvollstaendig" ablehnen — sonst
 * muesste man sie loeschen, um die Warnung loszuwerden.
 *
 * Importiert wird ohne Side Effects: wortlisten-importieren.mjs startet seinen
 * Lauf nur, wenn die Datei direkt aufgerufen wird.
 */

test("Fehlende Karten sind ein Fehler, mit klarer Zahl", () => {
  const befund = mengenBefund(342, 300);

  assert.equal(befund.ok, false);
  assert.match(befund.text, /FEHLER/);
  assert.match(befund.text, /42/);
});

test("Gleiche Mengen sind in Ordnung", () => {
  const befund = mengenBefund(100, 100);

  assert.equal(befund.ok, true);
  assert.match(befund.text, /stimmen/);
});

test("Mehr Karten in der Datenbank sind erlaubt — Karten werden nicht geloescht", () => {
  const befund = mengenBefund(100, 118);

  assert.equal(befund.ok, true, "18 Karten mehr darf den Import nicht abbrechen");
  assert.match(befund.text, /18/);
  // Nicht auf "geloescht" pruefen: der Code schreibt Kommentare in ASCII, die
  // Doku mit Umlaut. "Karten werden nie" ueberlebt beide Schreibweisen.
  assert.match(befund.text, /Karten werden nie/);
});

test("Eine Karte fehlt und wird nicht als Erfolg durchgewunken", () => {
  // Die Grenze, an der ein "fast fertig" zum Irrtum wurde.
  const befund = mengenBefund(2275, 2274);

  assert.equal(befund.ok, false);
  assert.match(befund.text, /1/);
});
/*
 * Der zweite Teil ist der eigentliche Fund. Der NOT EXISTS-Block im SQL sollte
 * doppelte Karten verhindern — und verhindert sie nicht. Er vergleicht mit dem,
 * was schon in der Datenbank steht, und sieht die Zeilen nicht, die sein
 * eigenes Statement gerade einfuegt. Der Live-Beleg: eine Probedatei mit
 * 6 Eintraegen, davon einer doppelt, ergab 6 Karten in der Datenbank, davon
 * zweimal dasselbe Paar. Die Mengenpruefung blieb gruen, weil 6 = 6.
 */
test("Ein zweites Mal dasselbe Paar in der Datei wird erkannt", () => {
  const doppelt = dateiBefund([
    { frage: "probe eins", antwort: "probe one" },
    { frage: "probe zwei", antwort: "probe two" },
    { frage: "probe eins", antwort: "probe one" },
  ]);

  assert.equal(doppelt.length, 1);
  assert.equal(doppelt[0].frage, "probe eins");
});

test("Gross-/Kleinschreibung und Randleerzeichen sind dieselbe Karte", () => {
  // Sonst waeren es zwei Karten, die ein Lernender nicht unterscheiden kann.
  const doppelt = dateiBefund([
    { frage: "Hund", antwort: "dog" },
    { frage: " hund ", antwort: "Dog" },
  ]);

  assert.equal(doppelt.length, 1);
});

test("Gleiche englische Seite bei anderem deutschen Wort ist KEINE Dublette", () => {
  // Koeter und Hund sind beide "dog" — zwei woertlich verschiedene Karten.
  // Der Import fasst auf der englischen Seite zusammen (sein Kommentar sagt
  // das); diese Pruefung tut es bewusst nicht, sonst wuerde sie hier anschlagen.
  const doppelt = dateiBefund([
    { frage: "Koeter", antwort: "dog" },
    { frage: "Hund", antwort: "dog" },
  ]);

  assert.deepEqual(doppelt, []);
});

test("Eine saubere Wortliste meldet nichts", () => {
  const doppelt = dateiBefund([
    { frage: "Hund", antwort: "dog" },
    { frage: "Katze", antwort: "cat" },
    { frage: "Beispiel", antwort: "sample" },
  ]);

  assert.deepEqual(doppelt, []);
});
