import type { SpracheInfo } from "./sprachen";

export type KarteikartenSet = {
    //ts typ damit es sichere ist
  id: string;
  name: string;
  /** Seit 0.1 ein Objekt aus public.sprachen, kein Freitext mehr. */
  sprache: SpracheInfo;
  anzahlKarten: number;
  fortschrittProzent: number;
  updatedAt?: string;
};

/**
 * Eine Zeile der Set-Uebersicht, so wie GET /api/karteikarten sie liefert
 * (fast 1:1 die View karteikarten_sets_uebersicht). Gemeinsam fuer Web und
 * App (Phase 7): eine zweite Abschrift nur fuer die App wuerde irgendwann
 * auseinanderlaufen, und niemand merkt es, weil beide richtig aussehen.
 *
 * `setLevel` (1–7) und `setLevelAnteil` (0–1) sind seit 017 Teil der View:
 * der Durchschnitt der Kartenstufen dieses Sets, dieselbe Skala wie bei
 * einer einzelnen Karte. `eigen` heisst: gehoert dieser Person.
 */
export type SetUebersicht = {
  id: string;
  name: string;
  sprache: SpracheInfo;
  anzahlKarten: number;
  zielKarten: number;
  fortschrittProzent: number;
  kartenGesamt: number;
  kartenGelernt: number;
  kartenFaellig: number;
  setLevel: number;
  setLevelAnteil: number;
  stufeDurchschnitt: number;
  eigenesSet: boolean;
  eigen: boolean;
  zuletztGelernt: string | null;
};
/**
 * Eine Karte, so wie GET /api/lernen sie ausliefert. Geteilt mit der App
 * (Phase 7): der Vertrag der Lernrunde liegt hier, nicht im einzelnen
 * Client.
 *
 * `beispielsatz` ist seit Migration 005 optional – die Haelfte der Karten in
 * einem gemischten Set stammt noch ohne Satz, und der Typ sagt das, statt
 * die Anzeige auf "" pruefen zu lassen. `schwierigkeit` kommt nur, wenn die
 * Route ein Modell trainieren konnte (Plan 1.8); ohne sie faellt die
 * schwer-Chance im Client auf ihre Basis zurueck. `faelligAm` ist das Datum
 * (YYYY-MM-DD), ab dem die Karte faellig war, gesteuert von lernlogik.
 */
export type LernKarte = {
  id: string;
  frage: string;
  antwort: string;
  beispielsatz: string | null;
  beispielUebersetzung: string | null;
  stufe: number;
  gelernt: boolean;
  faelligAm: string;
  /** Probleme mit der Fehlerschwelle – in der normalen Runde ausgeblendet. */
  leech: boolean;
  schwierigkeit?: number;
};

/** Der Set-Kopf einer Lernrunde, so wie GET /api/lernen ihn meldet. */
export type LernSetInfo = {
  slug: string;
  name: string;
  sprache: SpracheInfo;
};

/**
 * Antwort von GET /api/lernen. Uebungs- und Leech-Modus kommen nur gesetzt,
 * wenn die Adresse sie verlangte (`&modus=ueben` / `&modus=leech`); so kann
 * der Client den Stapel ehrlich benennen, ohne zu raten. `faelligGesamt` ist
 * der Stapel (karten.length ist die Runde); `kartenGesamt` ist der Bestand
 * des Sets, damit „nichts faellig" von „noch nichts angelegt" zu
 * unterscheiden ist.
 */
export type LernAntwort = {
  set: LernSetInfo;
  karten: LernKarte[];
  faelligGesamt: number;
  kartenGesamt: number;
  setZuGross?: boolean;
  hinweis?: string;
  uebungsmodus?: boolean;
  leechAnzahl?: number;
  leechModus?: boolean;
};

export type WochenXpTyp = {
  mo: number;
  di: number;
  mi: number;
  do: number;
  fr: number;
  sa: number;
  so: number;
}
export type TagesXpTyp = {
    erreicht: number;
    ziel: number;
    updatedAt?: string;
}

/**
 * Eine Zeile aus /api/sprachen-stats, also je Sprache.
 *
 * `code` ist der Schluessel fuer alles, was spaeter zugeordnet wird: die XP in
 * der Wortschatz-Tabelle, die Farbe einer Kachel, die Stimme fuer die
 * Sprachausgabe. `null` heisst: Die View kennt diese Sprache nicht (siehe 005,
 * Abschnitt 4) – ein Zustand zum Anzeigen, kein Fehler zum Weglassen.
 */
export type SprachStat = {
  code: string | null;
  sprache: string;
  /** Grundfarbe der Kachel. Aus public.sprachen, seit 006 auch in der View. */
  flaeche: string;
  /** Hellerer Ton fuer Text und Balken auf der Flaeche. */
  akzent: string;
  gelernt: number;
  total: number;
  xp: number;
  updatedAt?: string;
}
