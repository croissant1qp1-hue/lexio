/**
 * Tests fuer lib/kopie-name.ts – der Name einer Kopie.
 *
 * Warum das eine eigene Datei ist: der Name entscheidet, ob der Nutzer seine
 * Kopie in der Uebersicht wiederfindet. "Italienisch (Kopie) (Kopie)" ist
 * nicht unschoen, es ist ein Satz ohne Bedeutung. Und die Kopie landet im
 * Slug, also in der URL – ein kaputter Name wird fuer alle Welt sichtbar.
 *
 * Zwei Faelle sind hier ausdruecklich festgeschrieben, weil sie in der
 * Oberflaeche nicht vorkommen und trotzdem passieren werden:
 *
 *   - ein Name, der genau "(Kopie)" ist (was der Server zurueckgibt, wenn der
 *     Basisname leer war),
 *   - ein Name, der schon zwei Kopien hat, gekuerzt auf 60 Zeichen.
 *
 * Beides ist entstanden, als diese Funktion zum ersten Mal lief. Der Grund
 * steht am Test, nicht im Code, wo man ihn beim Lesen nicht erwartet.
 *
 * Aufruf: `npm test`
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { kopieName, naechsterKopieName, ohneKopieEndung } from "../lib/kopie-name";

test("ein einfacher Name bekommt den Zusatz ohne Nummer", () => {
  assert.equal(kopieName("Italienisch"), "Italienisch (Kopie)");
});

test("eine Kopie kopiert sich nicht ein zweites Mal mit demselben Zusatz", () => {
  assert.equal(kopieName("Italienisch (Kopie)"), "Italienisch (Kopie 2)");
  assert.equal(kopieName("Italienisch (Kopie 2)"), "Italienisch (Kopie 3)");
  assert.equal(kopieName("Italienisch (Kopie 12)"), "Italienisch (Kopie 13)");
});

test("der Zusatz bleibt auch nach mehrfachem Kopieren am Ende", () => {
  // Ohne Entfernen entsteht hier "Italienisch (Kopie 2) (Kopie)" – der Test
  // steht dafuer, weil die Reihenfolge in der Funktion einmal falsch war.
  assert.equal(kopieName("Italienisch (Kopie) (Kopie)"), "Italienisch (Kopie 2)");
  assert.equal(kopieName("Italienisch (Kopie 2) (Kopie)"), "Italienisch (Kopie 3)");
});

test("Klammern, die nicht zum Zusatz gehoeren, bleiben stehen", () => {
  // "(Konversation)" ist Teil des Namens, nicht der Kopiemarker.
  assert.equal(kopieName("Auto (Konversation)"), "Auto (Konversation) (Kopie)");
  // Und eine Zahl danach wird nicht faelschlich als Kopienummer gelesen.
  assert.equal(kopieName("Liste (Kopie) 2"), "Liste (Kopie) 2 (Kopie)");
});

test("ein Name, der genau aus dem Zusatz besteht, bleibt benannt", () => {
  // Kann passieren, wenn der Basisname leer war. Leer waere schlimmer als
  // doppelt, deshalb faellt hier der Originalname zurueck – und die Regel
  // "Nummer hochzaehlen" gilt auch dann. "(Kopie) (Kopie)" waere der
  // unlesbarere Name von beiden.
  assert.equal(kopieName("(Kopie)"), "(Kopie) (Kopie 2)");
  assert.equal(kopieName("(Kopie 4)"), "(Kopie 4) (Kopie 5)");
});

test("leerer Name ergibt den Zusatz allein, ohne Absturz", () => {
  assert.equal(kopieName(""), " (Kopie)");
});

test("lange Namen werden VOR dem Zusatz gekuerzt, nie danach", () => {
  const lang = "A".repeat(60);
  const ergebnis = kopieName(lang);

  assert.equal(ergebnis.length, 60);
  // Das ist der eigentliche Punkt: ein gekuerzter Name, der seinen Zusatz
  // verloren hat, waere eine zweite "A…A" ohne erkennbaren Unterschied.
  assert.ok(ergebnis.endsWith(" (Kopie)"), `erwartete Suffix am Ende, bekam "${ergebnis}"`);
  assert.equal(ergebnis.slice(0, 60 - " (Kopie)".length), "A".repeat(60 - " (Kopie)".length));
});

test("auch der nummerierte Zusatz passt bei langem Namen", () => {
  const lang = "B".repeat(60);
  for (const nummer of [2, 12, 123]) {
    const ergebnis = kopieName(lang, nummer);
    assert.equal(ergebnis.length, 60, `Nummer ${nummer} ergab ${ergebnis.length} Zeichen`);
    assert.ok(ergebnis.endsWith(` (Kopie ${nummer})`));
  }
});

test("ein Name, der fast voll ist, wird auf den Zusatz gekuerzt", () => {
  // Der Basisname passt nicht mehr neben dem Suffix. Abgeschnitten wird er,
  // nicht der Suffix – sonst waere die Kopie namenlos.
  const ergebnis = kopieName("C".repeat(60), 12);
  assert.equal(ergebnis.length, 60);
  assert.ok(ergebnis.startsWith("C"));
});

test("ohneKopieEndung entfernt nur echte Kopiemarker", () => {
  assert.equal(ohneKopieEndung("Italienisch"), "Italienisch");
  assert.equal(ohneKopieEndung("Italienisch (Kopie)"), "Italienisch");
  assert.equal(ohneKopieEndung("Italienisch (Kopie 7)"), "Italienisch");
  assert.equal(ohneKopieEndung("Italienisch (Kopie 7)   "), "Italienisch");
  assert.equal(ohneKopieEndung("Auto (Konversation)"), "Auto (Konversation)");
});

test("ohneKopieEndung gibt bei einem reinen Marker einen leeren String zurueck", () => {
  // Der Aufrufer entscheidet dann ueber `|| name.trim()`. Das muss hier
  // sichtbar sein, sonst faellt die Entscheidung irgendwo anders.
  assert.equal(ohneKopieEndung("(Kopie)"), "");
});

test("naechsterKopieName zaehlt vorhandene Kopien statt Klicks", () => {
  assert.equal(naechsterKopieName("Italienisch", []), "Italienisch (Kopie)");
  assert.equal(
    naechsterKopieName("Italienisch", ["Italienisch (Kopie)"]),
    "Italienisch (Kopie 2)",
  );
  assert.equal(
    naechsterKopieName("Italienisch", ["Italienisch (Kopie)", "Italienisch (Kopie 2)"]),
    "Italienisch (Kopie 3)",
  );
});

test("naechsterKopieName springt ueber eine geloeschte Nummer hinweg", () => {
  // Kopie 2 geloescht, 1 und 3 da. Neu wird 4, nicht wieder 2 – sonst
  // entstuende ein Name, den es schon gab.
  assert.equal(
    naechsterKopieName(
      "Italienisch",
      ["Italienisch (Kopie)", "Italienisch (Kopie 3)"],
    ),
    "Italienisch (Kopie 4)",
  );
});

test("naechsterKopieName beachtet ein fremdes Namensschema nicht", () => {
  // Ein Set, das zufaellig aehnlich heisst, darf die Nummer nicht verschieben.
  assert.equal(
    naechsterKopieName("Italienisch", ["Italienisch Kopie", "Italienischischer Wortschatz"]),
    "Italienisch (Kopie)",
  );
});

test("naechsterKopieName erbt einen langen Ursprung korrekt", () => {
  const lang = "D".repeat(60);
  const ergebnis = naechsterKopieName(lang, [`${"D".repeat(50)} (Kopie 2)`]);

  assert.ok(ergebnis.length <= 60);
  assert.ok(ergebnis.endsWith(" (Kopie)"));
});