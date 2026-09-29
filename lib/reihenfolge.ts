/**
 * Plan 1.8 – Schlaue Reihenfolge.
 *
 * Ein kleines Modell pro Account: aus den Zaehlern je Bewertung (Migration
 * 010) lernt eine logistische Regression, wie schwer eine Karte diesem
 * Nutzer faellt. Die Lernroute sortiert die Runde danach statt stur nach
 * `stufe` – und der Client nutzt den Wert, um die „schwer"-Chance beim
 * Wiederkommen in der Runde zu faerben.
 *
 * Bewusst klein und ohne Bibliothek. Eine Karte trainiert mit ihrem
 * Zaehlerverhaeltnis; jede Karte ist EIN gewichtetes Beispiel. Der Gewicht
 * lernt das Modell pro Anfrage aus allen Karten des Accounts – es gibt also
 * keine persistierten Gewichte, kein gelegentlich veraltetes Modell. Bei
 * weniger als MIN_STICHPROBEN beantworteten Karten liefert trainieren einen
 * Rueckfall (null), und die Route ordnet wie bisher nach stufe.
 */

export type KartenZeile = {
  stufe: number;
  treffer: number;
  fehler: number;
  zNochmal: number;
  zSchwer: number;
  zGut: number;
  zEinfach: number;
};

/** Wie viele beantwortete Karten ein Account braucht, bevor trainiert wird. */
export const MIN_STICHPROBEN = 5;

/** Lernrate und Regularisierung der Gradientenabstiege – kunstanten, kein
 *  Tuning-Bedarf fuer so ein kleines Modell. */
const LERN_RATE = 0.1;
const L2 = 1e-4;
const ITERATIONEN = 300;

/** So viele Merkmale hat eine Karte: bias, stufe, vier log-Zaehler, fehler. */
const MERKMAL_ANZAHL = 7;

/** Merkmale einer Karte. ln(x+1), damit ein hoher Zaehler nicht alles
 *  ueberschreit: 40 Fehler sind schwer, aber nicht 40x so schwer wie 1. */
export function merkmale(z: KartenZeile): number[] {
  return [
    1,
    z.stufe,
    Math.log1p(z.zNochmal),
    Math.log1p(z.zSchwer),
    Math.log1p(z.zGut),
    Math.log1p(z.zEinfach),
    Math.log1p(z.fehler),
  ];
}

export function sigmoid(x: number): number {
  if (x >= 0) {
    const e = Math.exp(-x);
    return 1 / (1 + e);
  }
  const e = Math.exp(x);
  return e / (1 + e);
}

/** Mittlerer quadratischer Abstand (for Debug/Tests nicht noetig, aber ehrlich). */

/**
 * Trainiert die Gewichte aus den Karten des Accounts.
 *
 * Ziel je Karte ist der Anteil schwerer Antworten:
 *   p = (z_nochmal + z_schwer) / gesamt
 * Gewichtet mit der Gesamtzahl Antworten, damit eine viel beantwortete Karte
 * mehr zaehlt als eine kaum beantwortete. Gradientenabstieg minimiert die
 * gewichtete log-loss; ein kleines L2 haelt die Gewichte zusammen, wenn
 * wenige Karten da sind.
 *
 * Rueckgabe: Gewichtsvektor [w0..w6] oder null, wenn der Account noch keine
 * MIN_STICHPROBEN beantworteten Karten hat.
 */
export function trainiereModell(zeilen: KartenZeile[]): number[] | null {
  const trainierbar = zeilen.filter((z) => {
    const gesamt = z.zNochmal + z.zSchwer + z.zGut + z.zEinfach;
    return gesamt > 0;
  });

  if (trainierbar.length < MIN_STICHPROBEN) return null;

  const w: number[] = new Array(MERKMAL_ANZAHL).fill(0);
  const grad: number[] = new Array(MERKMAL_ANZAHL).fill(0);

  for (let it = 0; it < ITERATIONEN; it++) {
    grad.fill(0);
    for (const zeile of trainierbar) {
      const gesamt = zeile.zNochmal + zeile.zSchwer + zeile.zGut + zeile.zEinfach;
      const p = (zeile.zNochmal + zeile.zSchwer) / gesamt;
      const x = merkmale(zeile);
      const sigma = sigmoid(dot(w, x));
      for (let j = 0; j < MERKMAL_ANZAHL; j++) {
        grad[j] -= gesamt * (p - sigma) * x[j];
      }
    }
    for (let j = 0; j < MERKMAL_ANZAHL; j++) {
      w[j] -= LERN_RATE * (grad[j] + 2 * L2 * w[j]);
    }
  }

  return w;
}

/** Schwierigkeit einer Karte laut Modell: 0 = ganz leicht, 1 = ganz schwer. */
export function schwierigkeit(gew: number[], zeile: KartenZeile): number {
  return sigmoid(dot(gew, merkmale(zeile)));
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/**
 * Wie wahrscheinlich eine mit „schwer" bewertete Karte in DERSELBEN Runde
 * noch einmal kommt (Plan 1.8).
 *
 * Basis sind 50 %. Dazu mischt das Modell mit: eine Karte, die der Account
 * laut Modell schwer findet, kommt eher nochmal – eine, die er eigentlich
 * kann, seltener. Und wer dieselbe Karte in dieser Runde schon einmal
 * „schwer" nannte (zweimal schwer), der bekommt eine Zusatz-Eskalation,
 * wie der Nutzer es beschrieben hat: man merkt, dass die Karte nicht sitzt.
 *
 * Schick ohne Zufall hier: die Funktion ist die reine Wahrscheinlichkeit.
 * Der Würfel fällt im Client (bewerten), damit die Runde widerspruchsfrei
 * und testbar bleibt.
 */
export function schwerChance(
  schwierigkeit: number | undefined,
  vorherSchwerInRunde: number,
): number {
  const basis = 0.5;
  // ±0.2 um die Basis herum: schwierigkeit 1 → 0.7, schwierigkeit 0 → 0.3.
  const modell = schwierigkeit === undefined ? 0 : (schwierigkeit - 0.5) * 0.4;
  const eskalation = vorherSchwerInRunde >= 1 ? 0.25 : 0;
  return Math.min(0.9, Math.max(0.15, basis + modell + eskalation));
}