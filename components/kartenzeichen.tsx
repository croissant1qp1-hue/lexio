/**
 * Das Kartenzeichen: eine kleine, rein dekorative Marke fuer eine Karte.
 *
 * Die Geometrie kommt aus `lib/kartenzeichen.ts` und wird hier nur als Inline-
 * SVG hingesetzt. Bewusst kein Icon-Satz und keine Bilddatei: die Form entsteht
 * aus der UUID der Karte, also ist fuer jede Karte automatisch eine da –
 * auch fuer eigene Sets, auch fuer Karten aus einem Textblock-Import, ohne
 * dass ein Importpfad etwas nachziehen muss.
 *
 * Drei Eigenschaften, die hier fest verdrahtet sind und nicht von der
 * aufrufenden Seite kommen duerfen:
 *
 *   - **Immer gleich gross.** Das `viewBox` ist 24er-Feld, die Groesse ist ein
 *     Prop mit einem festen Vorgabewert. Ein Nonagon ist nicht sichtbar kleiner
 *     als ein Dreieck, weil beide dieselbe Kantenlaenge im selben Feld haben.
 *   - **Nie ein Bedienelement.** `aria-hidden`, weil es keine Information
 *     traegt, die nicht woanders stuende, und `pointer-events: none`, weil es
 *     in einem Knopf liegt: die Karte dreht sich beim Tippen, und das Zeichen
 *     darf den Klick nicht auffangen oder gar selbst zum Ziel werden.
 *   - **Die Farbe ist die Kartentinte.** Die Kartenflaeche ist in beiden
 *     Designs eine mittelhelle Sprachfarbe, und der Text steht dort aus
 *     genau diesem Grund auf einem festen dunklen Wert. Das Zeichen erbt
 *     `currentColor` und setzt nur seine Deckkraft – eine eigene Hue-Auswahl
 *     muesste gegen zwoelf fremde Hintergruende beweisen, dass sie lesbar
 *     bleibt.
 */
import { ZEICHEN_FELD, kartenzeichen, kartenzeichenFormen } from "@/lib/kartenzeichen";

type Props = {
    /** Die Karten-ID. Aus ihr kommt das Zeichen, und es aendert sich nie. */
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
    className?: string;
};

export default function Kartenzeichen({ karteId, groesse = 32, className }: Props) {
    const zeichen = kartenzeichen(karteId);
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
