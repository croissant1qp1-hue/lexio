//das ist eine liste mit den farben für die verschiedenen sprachen
export const sprachenFarben = {
    englisch: "#FFC857",
    französisch: "#FF3D67",
    spanisch: "#FF6B5B",
    italienisch: "#42D6A4"
} as const;

/**
 * Der jeweils hellere Ton derselben Sprache. Wird auf der Kachelflaeche fuer
 * Beschriftung, Rahmen und Fortschrittsbalken benutzt – also dort, wo die
 * Flaeche selbst schon hell ist. Ein dunkler Akzent waere darauf nicht mehr
 * zu lesen, deshalb sind es aufgehellte Varianten, keine zusaetzlichen
 * Farben.
 */
export const sprachenAkzente = {
    englisch: "#FFCE73",
    französisch: "#FF8FA3",
    spanisch: "#FF9E8F",
    italienisch: "#6FE0BA"
} as const;

export type SprachFarbe = {
    /** Flaeche der Kachel. */
    flaeche: string;
    /** Hellerer Ton fuer Text und Balken auf der Flaeche. */
    akzent: string;
};

/**
 * Nimmt nur das erste Wort: "Italienisch Urlaub" ist ein Set, keine Sprache,
 * und soll trotzdem die italienische Farbe bekommen.
 */
function schluessel(sprache: string): keyof typeof sprachenFarben {
    return (sprache.trim().toLowerCase().split(/[\s\-_/]+/)[0] ?? "") as keyof typeof sprachenFarben;
}

/**
 * Die Flaechenfarbe einer Sprache, oder `undefined`, wenn sie nicht in der
 * Liste steht.
 *
 * Vorher stand hier `sprachenFarben[sprache.toLowerCase()]` mit dem Typ
 * `string`. Das war in zweierlei Hinsicht falsch: Der Laufzeitwert war bei
 * unbekannten Sprachen `undefined` – der Typ behauptete das Gegenteil, also
 * zerfiel jedes `?? "fallback"` im Aufrufer stillschweigend – und der ganze
 * String wurde verglichen, nicht das erste Wort. Ein Set namens
 * "Italienisch Alltag" bekam deshalb keine Farbe und blieb weiss.
 */
export function getFarbeforSprache(sprache: string | undefined | null): string | undefined {
    return sprachenFarben[schluessel(sprache ?? "")];
}

/** Flaeche und Akzent zusammen. */
export function getSprachFarbe(sprache: string | undefined | null): SprachFarbe {
    const key = schluessel(sprache ?? "");
    return {
        flaeche: sprachenFarben[key] ?? "#17232B",
        akzent: sprachenAkzente[key] ?? "#E7B14A"
    };
}
