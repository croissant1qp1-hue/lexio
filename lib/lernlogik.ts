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
 * Abstand in Tagen, bis eine Karte mit der aktuellen Stufe wieder faellig wird.
 * Bewusst flach: eine Karte, die auf Stufe 6 sitzt, wartet 60 Tage. Wer eine
 * Karte 60 Tage nicht sieht, hat sie entweder vergessen oder braucht sie nicht
 * mehr. Beides ist ein guter Grund, sie seltener zu zeigen.
 */
const INTERVALLE = [0, 1, 3, 7, 16, 35, 60];

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
