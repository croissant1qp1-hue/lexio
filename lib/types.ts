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
