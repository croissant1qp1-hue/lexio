export type Bewertung = "nochmal" | "schwer" | "gut" | "einfach";

export const BEWERTUNGEN: {
  id: Bewertung;
  label: string;
  xp: number;
  knopf: string;
}[] = [
  { id: "nochmal", label: "Nochmal", xp: 0, knopf: "Nochmal" },
  { id: "schwer", label: "Schwer", xp: 2, knopf: "Schwer" },
  { id: "gut", label: "Gut", xp: 5, knopf: "Gut" },
  { id: "einfach", label: "Einfach", xp: 8, knopf: "Einfach" },
];

/**
 * Schwelle für "Problemskarten" (Plan 1.7).
 *
 * Eine Karte mit so vielen Fehlern ("nochmal") taucht nicht mehr von selbst
 * in der Runde auf – sie ist leech. Die View
 * karteikarten_sets_uebersicht kennt dieselbe Schwelle (fehler < 8), damit
 * die Kacheln oben und die Lernroute nicht auseinanderlaufen. Die Zahl
 * gehört deshalb an beide Stellen.
 */
export const LEECH_FEHLER = 8;

/**
 * Abstand in Tagen, bis eine Karte mit der aktuellen Stufe wieder faellig wird.
 *
 * Exportiert, weil die oeffentliche Startseite dieselben Zahlen nennt. Eine
 * zweite Liste im Text waere eine, die irgendwann falsch wird – und niemand
 * faellt auf, weil beide Zahlen plausibel aussehen.
 * Bewusst flach: eine Karte, die auf Stufe 6 sitzt, wartet 60 Tage. Wer eine
 * Karte 60 Tage nicht sieht, hat sie entweder vergessen oder braucht sie nicht
 * mehr. Beides ist ein guter Grund, sie seltener zu zeigen.
 */
export const INTERVALLE = [0, 1, 3, 7, 16, 35, 60];

export function intervallFuerStufe(stufe: number): number {
  if (stufe < 0) return 0;
  return INTERVALLE[Math.min(stufe, INTERVALLE.length - 1)];
}

/**
 * Neue Stufe nach einer Antwort. Fehler senken die Stufe, damit eine
 * schwierige Karte wieder häufiger kommt statt in Vergessenheit zu geraten.
 */
export function stufeNachAntwort(stufe: number, bewertung: Bewertung): number {
  const aktuelle = Math.max(0, stufe);
  switch (bewertung) {
    case "nochmal":
      return Math.max(0, aktuelle - 2);
    case "schwer":
      return Math.max(0, aktuelle - 1);
    case "gut":
      return aktuelle + 1;
    case "einfach":
      return aktuelle + 2;
  }
}

export function xpFuerBewertung(bewertung: Bewertung): number {
  return BEWERTUNGEN.find((b) => b.id === bewertung)?.xp ?? 0;
}

export function istBewertung(wert: unknown): wert is Bewertung {
  return BEWERTUNGEN.some((b) => b.id === wert);
}

/** Faelligkeitsdatum als ISO-Datum (YYYY-MM-DD) fuer Postgres. */
export function faelligAb(stufe: number, von: Date = new Date()): string {
  const tage = intervallFuerStufe(stufe);
  const datum = new Date(von);
  datum.setUTCDate(datum.getUTCDate() + tage);
  return datum.toISOString().slice(0, 10);
}

/** Nächste Stufe, die der Nutzer sehen könnte – für die Intervall-Vorschau. */
export function intervallVorschau(stufe: number, bewertung: Bewertung): number {
  return intervallFuerStufe(stufeNachAntwort(stufe, bewertung));
}
