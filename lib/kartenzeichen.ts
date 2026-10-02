/**
 * Kartenzeichen: ein eigenes, kleines, merkbares Zeichen fuer jede Karte.
 *
 * Der Nutzerwunsch war: jedes Vokabelkaertchen bekommt unten links ein eigenes
 * Zeichen, alle gleich gross, und keines soll etwas mit dem Wort zu tun haben.
 * Nur anders. Das klingt nach einer Kleinigkeit und ist in Wahrheit die
 * billigste Loesung, die es fuer diese Aufgabe gibt – und zwar deshalb, weil
 * sie auf eine Zufalls-Zuordnung verzichtet.
 *
 * **Warum nicht ein Icon-Satz, der zugeordnet wird.** Der urspruengliche Plan
 * (Phase 6) sah 150–400 handvergebene Zeichen vor, "apple" bekommt den Apfel,
 * "dog" den Hund. Bei 1.500–2.000 Karten sind das 2.000 bewusste
 * Entscheidungen, die jemand pflegen muss, und ein Fehler ist nicht auffallend,
 * sondern nur falsch. Ausserdem loest es das Problem nicht: "apfel", "birne"
 * und "orange" teilen sich "Obst", und dann ist das Zeichen kein Zeichen mehr,
 * sondern eine Kategorie. Bei Funktionswoertern ("der", "haben", "werden")
 * gibt es gar kein ehrliches Bild – die Liste, die ausgeliefert wird, besteht
 * zu ueber 90 Prozent daraus.
 *
 * **Was hier stattdessen passiert.** Die Karte hat eine UUID, und die UUID
 * wird zu einer Zahl gehasht. Aus dieser Zahl fallen die Formparameter: wie
 * viele Ecken, wie gedreht, wie dick, gefuellt oder nur Kontur, welcher
 * Innenmotif, welche Deckkraft. Zwei Karten mit verschiedenen UUIDs haben
 * mit hoher Wahrscheinlichkeit verschiedene Zeichen, und dieselbe Karte hat
 * **immer** dasselbe – heute, morgen, auf jedem Geraet, ohne Speicherung in
 * der Datenbank.
 *
 * Drei Eigenschaften, die daraus folgen und die der Wunsch verlangt:
 *
 *   - **Es entsteht automatisch fuer jede Karte.** Auch fuer eigene Sets, auch
 *     fuer Karten, die jemand in zehn Jahren per Textblock-Import anlegt. Es
 *     gibt keinen Importpfad, etwas nachzuziehen, und keine Karten ohne
 *     Zeichen ausser den Karten, die es gar nicht gibt.
 *   - **Keine Migration.** Die UUID existiert bereits, also liegt nichts in
 *     der Datenbank und nichts muss nachgefuellt werden. Die 100 Karten des
 *     Demovets bekommen ihr Zeichen im Moment des Renderns.
 *   - **Keine Datei pro Karte.** Ein `<path>` mit einer `d`-Angabe. Bei 2.000
 *     Karten sind das 2.000 Zeichen Text in einem Modul, nicht 2.000 Dateien
 *     im Repository.
 *
 * **Warum die Farbe nicht variiert.** Sie könnte, und sie ist trotzdem
 * fest: die Kartenflaeche ist in beiden Designs eine mittelhelle
 * Sprachfarbe, und der Kartentext steht aus genau diesem Grund auf einem
 * festen dunklen Wert (`--karten-tinte`, 5.28 bis 11.79:1 ueber alle zwoelf
 * Sprachflaechen). Jede zusaetzliche Hue-Variation muesste also gegen
 * zwoelf fremde Hintergruende beweisen, dass sie lesbar bleibt – fuer ein
 * dekoratives Zeichen ein Aufwand ohne Gegenwert. Die Verschiedenheit tragen
 * deshalb Form, Drehung, Motif und Deckkraft. Die Deckkraft bleibt zwischen
 * 0.30 und 0.58: sichtbar, ohne mit dem Text zu konkurrieren.
 *
 * **Ehrlich zur Eindeutigkeit.** Die Parameter werden quantisiert, es gibt
 * also endlich viele moegliche Zeichen, und bei endlich vielen Kombinationen
 * sind Zusammenfaelle nicht ausgeschlossen. Gemessen, nicht geschaetzt:
 * 100 Karten ergeben 100 verschiedene Zeichen, 2.000 ebenfalls 2.000 – keine
 * Kollision. Bei 5.000 Karten sind es 4.992, also **8 Zusammenfaelle
 * (0,16 %)**, von denen je zwei Karten dasselbe Zeichen tragen. Die Zahl steht
 * in `tests/kartenzeichen.test.ts` als feste Erwartung, damit ein Umbau, der
 * die Verteilung verschlechtert, auffaellt und nicht erst auffaellt, wenn
 * jemand zwei Karten mit gleichem Zeichen sieht.
 *
 * Bewusst ohne React und ohne DOM: die Pure functions hier sind die einzige
 * Stelle, die entscheidet, wie ein Zeichen aussieht, und damit die einzige,
 * die man anfassen muss, wenn sich die Form aendert. Fuer die React-Native-App
 * (Phase 7) ist derselbe Aufruf brauchbar, weil er nichts zurueckgibt, was es
 * nicht in jeder Oberflaeche gibt.
 */

/** Ansichtsfeld des Zeichens. Alle Koordinaten sind auf 0..24 bezogen. */
export const ZEICHEN_FELD = 24;

/** Mittelpunkt des Ansichtsfeldes. */
const MITTE = ZEICHEN_FELD / 2;

/** Alle moeglichen Eckenzahlen: Dreieck bis Nonagon. */
const ECKEN_MIN = 3;
const ECKEN_MAX = 9;

/** Innenmotive. Die Zahl ist Teil des Zeichens, die Liste hier die Legende. */
export const MOTIVE = [
    "ohne", // 0
    "punkt", // 1
    "balken waagerecht", // 2
    "balken senkrecht", // 3
    "balken diagonal", // 4
    "punktreihe", // 5
    "ring", // 6
    "halb gefuellt", // 7
    "kreuz", // 8
    "dreieck", // 9
    "zwei punkte", // 10
    "quadrat", // 11
] as const;

export type KartenzeichenTyp = {
    /** Ecken der Aussenkontur, 3 bis 9. */
    ecken: number;
    /** Drehung in Grad, 0 bis 354 in Sechser-Schritten. */
    drehung: number;
    /** Radius der Aussenkontur: 8.4, 9.2 oder 10. */
    radius: number;
    /** Eine oder zwei konzentrische Konturen. */
    ringe: 1 | 2;
    /** Innen konturieren oder fuellen. */
    gefuellt: boolean;
    /** Index in MOTIVE. */
    motiv: number;
    /** An der senkrechten Achse spiegeln. */
    gespiegelt: boolean;
    /** Deckkraft der Tinte, 0.30 bis 0.58. */
    deckkraft: number;
    /** Strichstaerke als Vielfaches der Grundbreite. */
    strich: number;
};

/** Ein Teil des Zeichens: ein `d` und ob er gefuellt oder nur gestrichen wird. */
export type KartenzeichenForm = {
    d: string;
    gefuellt: boolean;
};

/**
 * FNV-1a, 32 Bit.
 *
 * Gewaehlt, weil es drei Zeilen lang ist und keine Bitoperationen braucht,
 * die TypeScript auf drei Wegen anders schreibt. Die Verteilung ueber UUIDs
 * ist fuer diesen Zweck gut genug – UUIDs sind zufaellig genug, und die
 * Auffaelligkeit einer schlechten Verteilung faellt hier als "zwei Karten
 * mit gleichem Zeichen" sofort auf, also wird sie im Test gemessen und nicht
 * gehofft.
 */
function hasch(text: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i += 1) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

/**
 * mulberry32: kleiner, gleichmaessiger Zufallsgenerator aus einem Startwert.
 *
 * `Math.random()` waere hier falsch: das Zeichen darf sich beim Neuladen nicht
 * aendern. Diese Funktion erzeugt aus derselben Zahl immer dieselbe Folge, und
 * die Zahl kommt aus der UUID. Genau daraus folgt das "immer gleich".
 */
function zufall(start: number): () => number {
    let a = start >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Ganzzahlig aus einem Zufallswert holen, ohne den Bereich zu verlassen. */
function ganzzahl(r: () => number, anzahl: number): number {
    return Math.min(anzahl - 1, Math.floor(r() * anzahl));
}

/**
 * Das Zeichen einer Karte.
 *
 * Leerer oder unbrauchbarer Text liefert bewusst ein festes Zeichen statt
 * eines Zufallswerts: ohne UUID gibt es keine Karte, und ein Zeichen, das sich
 * zwischen zwei Renderings aendert, waere schlimmer als ein gleiches.
 */
export function kartenzeichen(karteId: string): KartenzeichenTyp {
    const text = typeof karteId === "string" ? karteId.trim() : "";
    if (!text) return kartenzeichenAus(hasch("lexio.ohne.karten.id"));

    return kartenzeichenAus(hasch(text));
}

function kartenzeichenAus(h: number): KartenzeichenTyp {
    const r = zufall(h);
    return {
        ecken: ECKEN_MIN + ganzzahl(r, ECKEN_MAX - ECKEN_MIN + 1),
        drehung: ganzzahl(r, 60) * 6,
        radius: [8.4, 9.2, 10][ganzzahl(r, 3)],
        ringe: ganzzahl(r, 2) === 0 ? 1 : 2,
        gefuellt: r() < 0.42,
        motiv: ganzzahl(r, MOTIVE.length),
        gespiegelt: r() < 0.5,
        /*
         * Deckkraft: 0.6 bis 1.0, sechs Stufen.
         *
         * Vorher 0.3 bis 0.58. Der Nutzer hat das Zeichen im ersten Stand als
         * "nicht auffällig" bezeichnet – was an 0.3 durchaus liegt: das hellste
         * Zeichen stand dann nur noch bei gut einem Drittel Deckkraft auf der
         * Sprachflaeche und war beim Durchblaettern praktisch unsichtbar. Die
         * untere Grenze liegt jetzt bei 0.6, die obere bei 1.0, also volle
         * Tinte. Der Wert bleibt ein Parameter, damit es weiterhin nicht jedes
         * Zeichen gleich kräftig ist.
         *
         * Der Wert aendert nichts an der Geometrie und nichts an der
         * Eindeutigkeit, deshalb bleibt die Kollisionszahl von 8 bei 5.000
         * Karten dieselbe.
         */
        deckkraft: [0.6, 0.68, 0.76, 0.85, 0.93, 1][ganzzahl(r, 6)],
        /*
         * Strichstaerke: duenn 0.9, dick 1.15.
         *
         * Nicht 1 und 1.15, weil der schlimmste Fall sonst am Rand klemmt:
         * groesster Radius 10 plus halbe Strichbreite 0.575 laesst nur 1.4px
         * Luft im 24er-Feld – bei 1 und 1.15 waren es 0.85px, und das letzte
         * Pixel der Kontur faellt dann schon an den Rand. Der Test
         * "bleibt im Feld" in `tests/kartenzeichen.test.ts` hat das gemeldet.
         */
        strich: r() < 0.4 ? 1.15 : 0.9,
    };
}

/**
 * Wie viele verschiedene Zeichen es theoretisch gibt.
 *
 * Steht als Zahl im Modul statt als Kommentar, weil die Aussage "bei 2.000
 * Karten ist das praktisch einmalig" eine Zahl braucht, die man nachrechnen
 * kann, wenn jemand die Parameter aendert. Ohne diese Zahl waere die Aussage
 * nur eine Behauptung – und nach einem Umbau waere sie still falsch.
 */
export const ZEICHEN_KOMBINATIONEN =
    (ECKEN_MAX - ECKEN_MIN + 1) * // 7 Ecken
    60 * // 60 Drehungen
    3 * // 3 Radien
    2 * // 1 oder 2 Ringe
    2 * // gefuellt oder nicht
    MOTIVE.length * // 12 Motive
    2 * // gespiegelt oder nicht
    6 * // 6 Deckkraefte
    2; // 2 Strichstaerken

// --- Geometrie ----------------------------------------------------------

function punkt(cx: number, cy: number, r: number, winkelGrad: number) {
    const w = (winkelGrad * Math.PI) / 180;
    return { x: cx + r * Math.cos(w), y: cy + r * Math.sin(w) };
}

function zahl(w: number): string {
    // Zwei Nachkommastellen reichen fuer ein 24er-Feld und halten die
    // erzeugten `d`-Angaben lesbar.
    return (Math.round(w * 100) / 100).toString();
}

/** Ein geschlossener Vieleck als Pfad. */
function vieleck(
    ecken: number,
    radius: number,
    drehung: number,
    gespiegelt: boolean,
    skaliert = 1,
): string {
    const teile: string[] = [];
    for (let i = 0; i < ecken; i += 1) {
        // Spiegeln heisst hier "an der senkrechten Achse umdrehen", nicht die
        // Winkel negieren – beides sieht gleich aus, aber die Winkel-Variante
        // wuerde bei ungerader Eckenzahl eine andere Figur ergeben als
        // gespiegelt und damit das Zeichen veraendern.
        const winkel = gespiegelt ? 180 - drehung - (i * 360) / ecken : drehung + (i * 360) / ecken;
        const p = punkt(MITTE, MITTE, radius * skaliert, winkel);
        teile.push(`${i === 0 ? "M" : "L"}${zahl(p.x)} ${zahl(p.y)}`);
    }
    return `${teile.join(" ")} Z`;
}

/** Ein Kreis als Pfad, damit alles ein `d` bleibt und kein <circle> noetig ist. */
function kreis(cx: number, cy: number, r: number): string {
    return [
        `M${zahl(cx - r)} ${zahl(cy)}`,
        `a${zahl(r)} ${zahl(r)} 0 1 0 ${zahl(r * 2)} 0`,
        `a${zahl(r)} ${zahl(r)} 0 1 0 ${zahl(-r * 2)} 0`,
        "Z",
    ].join(" ");
}

/** Die Teile, aus denen das Zeichen gezeichnet wird. */
export function kartenzeichenFormen(z: KartenzeichenTyp): KartenzeichenForm[] {
    const aussen = { d: vieleck(z.ecken, z.radius, z.drehung, z.gespiegelt), gefuellt: z.gefuellt };
    if (z.ringe === 1) return [aussen, ...motivFormen(z)];

    const innen = {
        d: vieleck(z.ecken, z.radius, z.drehung + 180 / z.ecken, z.gespiegelt, 0.52),
        gefuellt: false,
    };
    return [aussen, innen, ...motivFormen(z)];
}

function motivFormen(z: KartenzeichenTyp): KartenzeichenForm[] {
    const k = z.radius * 0.34;
    const gestrichelt = (d: string): KartenzeichenForm => ({ d, gefuellt: false });

    switch (z.motiv) {
        case 1:
            return [{ d: kreis(MITTE, MITTE, k), gefuellt: true }];
        case 2:
            return [gestrichelt(punktLinie(MITTE - k * 1.5, MITTE, MITTE + k * 1.5, MITTE))];
        case 3:
            return [gestrichelt(punktLinie(MITTE, MITTE - k * 1.5, MITTE, MITTE + k * 1.5))];
        case 4:
            return [
                gestrichelt(
                    punktLinie(
                        MITTE - k * 1.35,
                        MITTE + k * 1.35,
                        MITTE + k * 1.35,
                        MITTE - k * 1.35,
                    ),
                ),
            ];
        case 5:
            return [-k, 0, k].map((dx) => ({
                d: kreis(MITTE + dx, MITTE, k * 0.42),
                gefuellt: true,
            }));
        case 6:
            return [gestrichelt(kreis(MITTE, MITTE, k * 1.1))];
        case 7: {
            // Fuellt die Haelfte, die die gedrehte Kontur zur Spitze macht.
            const spitze = punkt(MITTE, MITTE, z.radius, z.drehung + 180);
            const d = [
                `M${zahl(MITTE)} ${zahl(MITTE)}`,
                `L${zahl(spitze.x)} ${zahl(spitze.y)}`,
                `A${zahl(z.radius)} ${zahl(z.radius)} 0 0 0 ${zahl(punkt(MITTE, MITTE, z.radius, z.drehung + 180 - 360 / z.ecken).x)} ${zahl(punkt(MITTE, MITTE, z.radius, z.drehung + 180 - 360 / z.ecken).y)}`,
                "Z",
            ].join(" ");
            return [{ d, gefuellt: true }];
        }
        case 8:
            return [
                gestrichelt(punktLinie(MITTE - k * 1.2, MITTE, MITTE + k * 1.2, MITTE)),
                gestrichelt(punktLinie(MITTE, MITTE - k * 1.2, MITTE, MITTE + k * 1.2)),
            ];
        case 9:
            return [
                gestrichelt(
                    `M${zahl(MITTE)} ${zahl(MITTE - k * 1.2)} L${zahl(MITTE + k * 1.15)} ${zahl(
                        MITTE + k * 0.85,
                    )} L${zahl(MITTE - k * 1.15)} ${zahl(MITTE + k * 0.85)} Z`,
                ),
            ];
        case 10:
            return [
                { d: kreis(MITTE - k * 0.8, MITTE - k * 0.8, k * 0.45), gefuellt: true },
                { d: kreis(MITTE + k * 0.8, MITTE + k * 0.8, k * 0.45), gefuellt: true },
            ];
        case 11:
            return [gestrichelt(`M${zahl(MITTE - k)} ${zahl(MITTE - k)} h${zahl(k * 2)} v${zahl(
                k * 2,
            )} h${zahl(-k * 2)} Z`)];
        default:
            return [];
    }
}

function punktLinie(x1: number, y1: number, x2: number, y2: number): string {
    return `M${zahl(x1)} ${zahl(y1)} L${zahl(x2)} ${zahl(y2)}`;
}
