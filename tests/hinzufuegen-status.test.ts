/**
 * Regressionstest fuer den Zustand nach dem Speichern.
 *
 * Fund am laufenden System, 2026-10-05: Nach dem ersten erfolgreichen
 * Speichern liess sich kein weiteres Wort mehr eintragen. Weder ein
 * gueltiges noch ein doppeltes. Der Knopf stand dauerhaft auf "Speichert…",
 * war `disabled`, und es ging kein einziger Request raus – der Server
 * bekam nichts zu sehen.
 *
 * Ursache: `status` wird nach dem Erfolg nicht zurueckgesetzt. Der
 * Erfolgsbildschirm zeigt den Knopf nicht, der Zustand lebt aber weiter.
 * "Noch mehr Woerter" fuehrt zurueck in die Eingabe, wo derselbe Zustand
 * den Knopf sperrt – und `speichern()` steigt ueber
 * `if (status === "speichert") return` sofort aus. Das ist einer der Faelle,
 * in denen TypeScript nichts zu melden hat: der Zustand ist typkorrekt
 * gesetzt, nur die Reihenfolge ist falsch.
 *
 * Geprueft wird deshalb die Quelle, nicht die Oberflaeche: eine
 * React-Testlaufzeit gibt es hier nicht, und der Fehler liegt genau in der
 * Stelle, die ein Oberflaechentest nur umstaendlich faesse.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const WURZEL = join(import.meta.dirname, "..");
const QUELLE = readFileSync(
  join(WURZEL, "app/(app)/karteikarten-hinzufuegen/vokabeln-hinzufuegen/vokabeln-hinzufuegen-seite.tsx"),
  "utf8",
);

test("nach dem Speichern wird der Status zurueckgesetzt", () => {
  const erfolg = QUELLE.slice(
    QUELLE.indexOf("setAuswahl(slug);"),
    QUELLE.indexOf("} catch (fehler) {"),
  );

  assert.match(
    erfolg,
    /setStatus\("idle"\)/,
    "Im Erfolgszweig von speichern() muss status zurueckgesetzt werden",
  );
});

test("das Zuruecksetzen steht nach setFertig, nicht davor", () => {
  const erfolg = QUELLE.slice(QUELLE.indexOf("setFertig("), QUELLE.indexOf("} catch (fehler) {"));
  const fertig = erfolg.indexOf("setFertig(");
  const status = erfolg.indexOf('setStatus("idle")');

  assert.ok(status > fertig, "sonst steht der Knopf schon vor dem Erfolg auf 'idle'");
});

test("'Noch mehr Woerter' kann den Zustand nicht allein zuruecksetzen", () => {
  // Die Absicherung sitzt im Erfolgszweig, weil dort der Fehler entstand.
  // Wer sie spaeter in den Klickhandler verschiebt, verliert die anderen
  // Wege zurueck in die Eingabe.
  const knopf = QUELLE.slice(QUELLE.indexOf("Noch mehr Wörter") - 400, QUELLE.indexOf("Noch mehr Wörter"));

  assert.doesNotMatch(knopf, /setStatus\("speichert"\)/);
});
