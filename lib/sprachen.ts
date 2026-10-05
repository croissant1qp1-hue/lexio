/**
 * Die Sprachliste – ein Typ, eine Farbregel, ein Rückfall.
 *
 * Vorher standen die Farben als zwei Objekte in lib/sprachen-farbe.ts (die
 * Datei ist geloescht, die Farben stehen jetzt hier), und
 * welche Farbe zu welchem Set gehörte, entschied eine Funktion, die nur das
 * erste Wort des Freitextes nahm. Daraus folgten drei Fehler, die alle
 * stillschweigend aussahen:
 *
 *   - "Chinesisch (Mandarin)" und "Chinesisch" teilten sich denselben Schlüssel.
 *   - "Italienisch Alltag" bekam keine Farbe, wenn es nicht genau "italienisch"
 *     hieß, und blieb weiß.
 *   - Ein Set mit einer Sprache, die es nicht gab, bekam den Rückfall und
 *     sah aus, als hätte es absichtlich keine Farbe.
 *
 * Jetzt steht die Sprache als Code an jedem Set, und die Farbe kommt aus der
 * Sprachliste der Datenbank (public.sprachen, Migration 005) mit. Diese Datei
 * kennt deshalb keine Farbtabelle mehr, sondern nur noch den Rückfall für den
 * Fall, dass die Sprache wirklich unbekannt ist.
 *
 * Bewusst ohne Server-Import: die Datei wird sowohl in Route Handlers als
 * auch in Client-Komponenten benutzt. Ein React-Native-Client soll später
 * dieselben Typen benutzen können (Phase 7), und die stehen dann auch hier.
 */

/** Eine Sprache aus public.sprachen. */
export type Sprache = {
  /** Der Code, den speechSynthesis und die Fremdschluesselung benutzen: "en". */
  code: string;
  /** Wie der Nutzer sie sieht: "Englisch". */
  name: string;
  /** Grundfarbe der Kachel. */
  flaeche: string;
  /** Hellerer Ton fuer Text und Fortschrittsbalken auf der Flaeche. */
  akzent: string;
};

/**
 * Die Sprache eines Sets, so wie die API sie liefert.
 *
 * `code` ist `string | null` und nicht `string`: nach 005 kann ein Set eine
 * Sprache haben, die nicht in der Liste steht – etwa weil jemand eine
 * Kartenkombination angelegt hat, bevor es die Liste gab. Das ist ein
 * Zustand, den man anzeigen kann, kein Fehler, den man verstecken sollte.
 */
export type SpracheInfo = {
  code: string | null;
  name: string;
  flaeche: string;
  akzent: string;
};

export type SprachFarbe = {
  /** Flaeche der Kachel. */
  flaeche: string;
  /** Hellerer Ton fuer Text und Balken auf der Flaeche. */
  akzent: string;
};

/**
 * Der Rueckfall fuer eine Sprache, die public.sprachen nicht kennt.
 *
 * Dieselben zwei Werte wie in 006 (`coalesce(sp.flaeche, ...)`) – dort, wo
 * die Datenbank die Farbe nicht liefern kann, und hier, wo der Client eine
 * unvollstaendige Antwort bekommt. Ein neutrales Blaugrau mit warmem Akzent:
 * es hebt sich von der Standardflaeche ab, ohne eine Sprache zu behaupten.
 */
export const UNBEKANNTE_SPRACHE: SpracheInfo = {
  code: null,
  name: "Ohne Sprache",
  flaeche: "#17232B",
  akzent: "#E7B14A",
};

/**
 * Flaeche und Akzent einer Sprache.
 *
 * Nimmt das fertige `SpracheInfo` aus der API und nicht mehr einen Text. Es
 * gibt hier bewusst keinen Weg mehr, eine Farbe aus einem Freitext zu
 * erraten – die beiden Stellen, die das taten, sind weg, und eine dritte
 * waere ein Rueckschritt.
 */
export function farbeVonSprache(sprache: SpracheInfo | null | undefined): SprachFarbe {
  if (!sprache) return { flaeche: UNBEKANNTE_SPRACHE.flaeche, akzent: UNBEKANNTE_SPRACHE.akzent };
  return {
    flaeche: sprache.flaeche || UNBEKANNTE_SPRACHE.flaeche,
    akzent: sprache.akzent || UNBEKANNTE_SPRACHE.akzent,
  };
}

/** Wie die Sprache heisst. Ohne Sprache steht der Rueckfall da. */
export function nameVonSprache(sprache: SpracheInfo | null | undefined): string {
  return sprache?.name?.trim() || UNBEKANNTE_SPRACHE.name;
}
