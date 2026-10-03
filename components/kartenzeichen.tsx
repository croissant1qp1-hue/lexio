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
 *     Für ein Lucide-Icon gilt dasselbe: es ist ein Strichbild im selben
 *     Feld und wird auf dieselbe Kante gebracht, damit nichts aus der Reihe
 *     faellt, nur weil es ein Wort mit eigener Bedeutung traegt.
 *   - **Nie ein Bedienelement.** `aria-hidden`, weil es keine Information
 *     traegt, die nicht woanders stuende, und `pointer-events: none`, weil es
 *     in einem Knopf liegt: die Karte dreht sich beim Tippen, und das Zeichen
 *     darf den Klick nicht auffangen oder gar selbst zum Ziel werden.
 *   - **Die Farbe ist die Kartentinte.** Die Kartenflaeche ist in beiden
 *     Designs eine mittelhelle Sprachfarbe, und der Text steht dort aus
 *     genau diesem Grund auf einem festen dunklen Wert. Das erzeugte Zeichen
 *     erbt `currentColor` und setzt nur seine Deckkraft – eine eigene
 *     Hue-Auswahl muesste gegen zwoelf fremde Hintergruende beweisen, dass sie
 *     lesbar bleibt. Genau darum ist es ein Strichbild in `currentColor`
 *     und kein Emoji: ein Emoji bringt seine eigenen Farben mit und damit
 *     eine Palette, die auf keinem Hintergrund geprueft wurde.
 *   - **Die Karten-ID ist die einzige Zufallsquelle.** Auch beim Icon kommen
 *     Groesse und Versatz aus derselben UUID, damit die Karten eines Stapels
 *     nicht wie eine ausgedruckte Seite wirken.
 */
import { ZEICHEN_FELD, kartenzeichen, kartenzeichenFormen } from "@/lib/kartenzeichen";
import { semantischesZeichen } from "@/lib/kartenzeichen-semantik";
import { ICON_RUMPF } from "@/lib/kartenzeichen-svg.generated";

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

export default function Kartenzeichen({ karteId, groesse = 32, begriff, uebersetzung, className }: Props) {
    const zeichen = kartenzeichen(karteId);
    const bild = begriff || uebersetzung ? semantischesZeichen(begriff ?? "", uebersetzung ?? "") : null;

    if (bild) {
        const rumpf = ICON_RUMPF[bild.icon];
        /*
         * Ein unbekannter Iconname darf die Karte nicht verlieren: dann
         * schlicht die erzeugte Form nehmen. Das ist keine Absicherung gegen
         * einen Fehler, sondern die Antwort auf die Frage, was mit einer Karte
         * geschieht, deren Wort in der Tabelle steht, das Icon aber fehlt.
         */
        if (rumpf) {
            return (
                <svg
                    className={className}
                    width={groesse}
                    height={groesse}
                    viewBox={`0 0 ${ZEICHEN_FELD} ${ZEICHEN_FELD}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.9 * zeichen.strich}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    focusable="false"
                    /*
                     * `data-zeichen` unterscheidet Icon und erzeugte Form. Beide
                     * sind ein `svg` mit derselben `viewBox`, am Tag sind sie
                     * nicht zu unterscheiden – und genau daran ist eine frühere
                     * Fassung des Audits gescheitert.
                     */
                    data-zeichen="icon"
                    data-icon={bild.icon}
                    style={{
                        opacity: zeichen.deckkraft,
                        pointerEvents: "none",
                        display: "block",
                        overflow: "visible",
                    }}
                    /*
                     * Das Markup stammt aus `lib/kartenzeichen-svg.generated.ts`
                     * und damit aus unserem eigenen Build, nicht aus einem
                     * Kartenfeld. Über `dangerouslySetInnerHTML` zu setzen ist
                     * hier die einzige Möglichkeit, an einem 24er-`viewBox`
                     * Strichzeichnungen einzuhängen: sie bestehen aus
                     * `circle`, `rect` und `polyline` neben `path`, und eine
                     * Liste von React-Elementen müsste den Icon-Satz
                     * nachbauen. Nichts davon ist eine Benutzereingabe.
                     */
                    dangerouslySetInnerHTML={{ __html: rumpf }}
                />
            );
        }
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
            data-zeichen="form"
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
