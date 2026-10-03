/**
 * Das Kartenzeichen: eine kleine Marke fuer eine Karte.
 *
 * Zwei Wege, ein Ziel – ein Zeichen, das zur Karte gehoert:
 *
 *   - **Hat das Wort ein Bild, bekommt die Karte es.** `haus` wird ein 🏠,
 *     `katze` eine 🐱. Die Zuordnung steht in
 *     `lib/kartenzeichen-semantik.ts` und ist von Hand gepflegt, weil sie
 *     eine Entscheidung ist und keine Erfindung: 🏠 statt 🏚️, ☀️ statt ⛅.
 *   - **Hat das Wort kein ehrliches Bild, bekommt die Karte eine Form.**
 *     Die Geometrie kommt aus `lib/kartenzeichen.ts` und entsteht aus der
 *     UUID der Karte. Das deckt jedes Wort ab, auch eigene Karten und
 *     Importe, ohne dass ein Importpfad etwas nachziehen muss. Bei der
 *     Demowortliste sind das vier von fünf Karten – die Liste besteht fast
 *     nur aus „der, sein, und, haben, werden", und für die wäre ein Bild
 *     eine Lüge.
 *
 * Beide Wege teilen sich dieselbe Grössenvorgabe und dieselbe Sichtbarkeits-
 * regel, damit der Wechsel auf der Karte nicht auffällt.
 *
 * Vier Eigenschaften, die hier fest verdrahtet sind und nicht von der
 * aufrufenden Seite kommen duerfen:
 *
 *   - **Immer gleich gross.** Das `viewBox` ist 24er-Feld, die Groesse ist ein
 *     Prop mit einem festen Vorgabewert. Ein Nonagon ist nicht sichtbar kleiner
 *     als ein Dreieck, weil beide dieselbe Kantenlaenge im selben Feld haben.
 *     Für das Emoji gilt dasselbe, mit einer Ausnahme, die unten steht.
 *   - **Nie ein Bedienelement.** `aria-hidden`, weil es keine Information
 *     traegt, die nicht woanders stuende, und `pointer-events: none`, weil es
 *     in einem Knopf liegt: die Karte dreht sich beim Tippen, und das Zeichen
 *     darf den Klick nicht auffangen oder gar selbst zum Ziel werden.
 *   - **Die Farbe ist die Kartentinte.** Die Kartenflaeche ist in beiden
 *     Designs eine mittelhelle Sprachfarbe, und der Text steht dort aus
 *     genau diesem Grund auf einem festen dunklen Wert. Das erzeugte Zeichen
 *     erbt `currentColor` und setzt nur seine Deckkraft – eine eigene
 *     Hue-Auswahl muesste gegen zwoelf fremde Hintergruende beweisen, dass sie
 *     lesbar bleibt. Ein Emoji bringt seine eigenen Farben mit; das ist der
 *     Preis des Bildes und der Grund, warum es nicht auf eine Karte gehört,
 *     die keine aussagekraeftige Antwort hat.
 *   - **Die Karten-ID ist die einzige Zufallsquelle.** Auch beim Emoji kommen
 *     Groesse und Versatz aus derselben UUID, damit die Karten eines Stapels
 *     nicht wie eine ausgedruckte Seite wirken.
 */
import { ZEICHEN_FELD, kartenzeichen, kartenzeichenFormen } from "@/lib/kartenzeichen";
import { semantischesZeichen } from "@/lib/kartenzeichen-semantik";

type Props = {
    /** Die Karten-ID. Aus ihr kommen Form und Bildvariation. */
    karteId: string;
    /**
     * Kantenlaenge in Pixel. Der Vorgabewert ist 32px: mit 26px war das Zeichen
     * auf der Karte so leise, dass es beim Durchblättern nicht als eigenes
     * Merkmal auffiel – der Nutzer hat es dann ausdrücklich "auffälliger" und
     * "größer" gewünscht. 32px ist groß genug, um auf 360px neben dem Begriff
     * zu stehen, und klein genug, um nicht mit dem Text zu konkurrieren. Alle
     * Zeichen bekommen denselben Wert, sonst wäre das genau das nicht, was hier
     * versprochen wird.
     */
    groesse?: number;
    /**
     * Der deutsche Begriff der Karte. Steht hier ein Wort, für das es ein
     * Bild gibt, wird dieses statt der erzeugten Form gezeigt. Bleibt das Feld
     * leer, verhält sich die Komponente wie früher und zeichnet die Form.
     */
    begriff?: string;
    /** Die Übersetzung. Wird nur nachgesehen, wenn beim Begriff nichts passt. */
    uebersetzung?: string;
    className?: string;
};

/**
 * Wie weit das Emoji von der Sollgrösse abweicht und wo es sitzt.
 *
 * Aus derselben UUID wie die Geometrie, aber über andere Kanäle, damit ein
 * Wechsel zwischen Bild und Form das Bild nicht plötzlich auf 32px springen
 * lässt. Die Spanne ist eng von Haus aus: 86 bis 100 Prozent, und zwei
 * Pixel Versatz. Größere Abstände sähen aus wie ein Fehler im Layout, nicht
 * wie eine Absicht.
 */
function bildVersatz(z: ReturnType<typeof kartenzeichen>) {
    const radiusAnteil = (z.radius - 8.4) / (10 - 8.4);
    const groesse = 0.86 + 0.14 * radiusAnteil;
    const versatzX = ((z.drehung % 5) - 2) * 0.7;
    const versatzY = ((z.ecken % 5) - 2) * 0.7;
    return { groesse, versatzX, versatzY };
}

export default function Kartenzeichen({ karteId, groesse = 32, begriff, uebersetzung, className }: Props) {
    const zeichen = kartenzeichen(karteId);
    const bild = begriff || uebersetzung ? semantischesZeichen(begriff ?? "", uebersetzung ?? "") : null;

    if (bild) {
        const { groesse: faktor, versatzX, versatzY } = bildVersatz(zeichen);
        return (
            <span
                className={className}
                aria-hidden="true"
                style={{
                    display: "block",
                    width: groesse,
                    height: groesse,
                    lineHeight: 1,
                    fontSize: Math.round(groesse * faktor),
                    textAlign: "center",
                    transform: `translate(${versatzX.toFixed(2)}px, ${versatzY.toFixed(2)}px)`,
                    pointerEvents: "none",
                    userSelect: "none",
                }}
            >
                {bild.emoji}
            </span>
        );
    }

    const formen = kartenzeichenFormen(zeichen);
    const staerke = 1.5 * zeichen.strich;

    return (
        <svg
            className={className}
            width={groesse}
            height={groesse}
            viewBox={`0 0 ${ZEICHEN_FELD} ${ZEICHEN_FELD}`}
            fill="none"
            aria-hidden="true"
            focusable="false"
            style={{
                opacity: zeichen.deckkraft,
                pointerEvents: "none",
                display: "block",
                overflow: "visible",
            }}
        >
            {formen.map((form, i) =>
                form.gefuellt ? (
                    <path key={i} d={form.d} fill="currentColor" />
                ) : (
                    <path
                        key={i}
                        d={form.d}
                        stroke="currentColor"
                        strokeWidth={staerke}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                ),
            )}
        </svg>
    );
}
