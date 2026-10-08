import type { Bewertung } from "@lexio/lernlogik";

/**
 * Rotation einer Lernrunde – als reine Funktion, damit der Kern (das
 * "nochmal/riegel"-Verhalten) testbar ist und in Web und App dasselbe meint
 * (Web: lib/reihenfolge.ts + Client, App: dieselbe Regie).
 *
 * Regeln:
 * - "nochmal" (und "schwer", wenn der Würfel sagt, dass die Karte bleibt)
 *   legt die Karte ans Ende des Stapels. Der Index wandert keinen Schritt:
 *   die nächste Karte rutscht in dieselbe Position.
 * - Endgültig entnommen wird nur bei "gut", "einfach" und bei "schwer" mit
 *   bleibendem Würfel. Die Runde ist zu Ende, sobald der Index hinter der
 *   (geschrumpften) Länge liegt: alles entnommen, nichts nachgelegt.
 *
 * Der Würfel für "schwer" wird vom Aufrufer geworfen und hier als
 * `schwerBleibt` durchgereicht, damit die Funktion deterministisch und der
 * Zufall pro Antwort genau einmal fällt.
 */
export type Rotation<T> = {
  stapel: T[];
  fertig: boolean;
};

export function rotiere<T extends { id: string }>(
  stapel: T[],
  index: number,
  karte: T,
  bewertung: Bewertung,
  schwerBleibt: boolean,
): Rotation<T> {
  const bleibt = bewertung === "nochmal" || (bewertung === "schwer" && schwerBleibt);
  if (bleibt) {
    return {
      stapel: [...stapel.filter((k) => k.id !== karte.id), karte],
      fertig: false,
    };
  }
  const rest = stapel.filter((k) => k.id !== karte.id);
  return {
    stapel: rest,
    fertig: index >= rest.length,
  };
}