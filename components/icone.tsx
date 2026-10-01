/*
 * Eigene Icons statt Emoji.
 *
 * Warum ueberhaupt zeichnen
 * -------------------------
 * Emoji in einer Oberflaeche sind eine Fehlentscheidung, sobald man sie
 * einmal anfasst:
 *
 *   - Sie haben keine Farbkontrolle. Das Emoticon bringt seine eigenen
 *     Farben mit und sieht neben Gold und Papier aus wie ein Fremdkoerper.
 *   - Sie sind je nach System verschieden. Auf dem Handy ein anderes Bild
 *     als auf dem Desktop, in Screenshots ein anderes als im Original.
 *   - Ihre Groesse folgt nicht der Schrift. ☕ neben 3,4rem Oversized-Ueberschrift
 *     ist eine Lotterie, je nachdem welche Schrift das System gerade waehlt.
 *   - Manche sind gar nicht vorhanden. 🏁 fehlt auf aelteren Systemen, dann
 *     steht ein leeres Kaestchen da, genau dort, wo der Nutzer den Abschluss
 *     einer Lernrunde sehen soll.
 *
 * Deshalb: 24x24-Raster, eine Strichstaerke, `currentColor`. Alles erbt die
 * Farbe und die Groesse der Stelle, an der es steht, und sieht auf jedem
 * System gleich aus.
 *
 * Der Entwurfsraster
 * ------------------
 * Alle Icons zeichnen in dasselbe 24x24-Feld mit 2er Rand. Die Formen sind
 * bewusst nicht ausgefuellt, sondern nur umrandet: Eine Kontur von 1,6
 * wirkt bei 20px ruhiger als eine Flaeche, und dieselbe Kontur laesst sich
 * mit `strokewidth` vergroessern, ohne dass das Icon kaputtgeht.
 *
 * Ecken sind ueberall radius 2 oder 3. Bei Hitzearea und Envelope gilt das
 * aus demselben Grund wie bei einer Taste – weiche Ecken lesen sich als
 * freundlicher.
 */

import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement> & {
    /** Nur fuer Icons, die allein stehen und eine Rolle spielen. */
    title?: string;
};

/*
 * Der Rahmen ist bei jedem Icon gleich. Das spart 8 Zeilen pro Icon und
 * stellt sicher, dass keines aus Versehen 25 Einheiten breit wird.
 */
function Rahmen({ kind, children, title, ...rest }: Props & { kind: string; children: React.ReactNode }) {
    return (
        <svg
            viewBox="0 0 24 24"
            width="1em"
            height="1em"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            data-icon={kind}
            aria-hidden={title ? undefined : true}
            role={title ? "img" : undefined}
            focusable="false"
            {...rest}
        >
            {title ? <title>{title}</title> : null}
            {children}
        </svg>
    );
}

/*
 * Der Wecker fuer "Fast geschafft": Die Mail ist raus, der Nutzer muss nur
 * noch klicken. Eine Tasse waere hier falsch – sie steht an anderer Stelle
 * fuer "heute ist nichts faellig".
 */
export function IconEnvelope(props: Props) {
    return (
        <Rahmen kind="envelope" {...props}>
            <rect x="2.75" y="5.25" width="18.5" height="13.5" rx="2.5" />
            {/* Der Klappdeckel: von Ecke zu Ecke, damit er als Umschlag lesbar bleibt. */}
            <path d="M3.5 7.25 10.9 12.4a1.9 1.9 0 0 0 2.2 0L20.5 7.25" />
        </Rahmen>
    );
}

/*
 * Tasse fuer den Bildschirm "Alles gelernt". Der Dampf ist das eigentliche
 * Detail: Er sagt "Ruhe" und faellt auf, weil eine Tasse allein nach Wartezeit
 * aussieht. Zwei kursive Striche, kein Rauch.
 */
export function IconTasse(props: Props) {
    return (
        <Rahmen kind="tasse" {...props}>
            {/* Tasse: Boden bei 18, Oeffnung bei 9. */}
            <path d="M4.25 9.25h12.5v4.25a5.5 5.5 0 0 1-5.5 5.5H9.75a5.5 5.5 0 0 1-5.5-5.5V9.25Z" />
            {/* Henkel: zwei kurze Stuecke plus Rundung, sonst sieht er wie ein Klammer aus. */}
            <path d="M16.75 11.25h1a2.75 2.75 0 0 1 0 5.5h-1" />
            {/* Untertasse. */}
            <path d="M2.75 21.25h15.5" />
            {/* Dampf. */}
            <path d="M8.5 2.5c0 1.1-1.25 1.35-1.25 2.5" />
            <path d="M12.75 2.5c0 1.1-1.25 1.35-1.25 2.5" />
        </Rahmen>
    );
}

/*
 * Leerer Stapel fuer "Noch keine Vokabeln". Zwei Karten, die sich
 * gegenseitig verdecken, plus ein Plus: Das sagt gleichzeitig "hier ist Platz
 * fuer mehr" und "es ist noch nichts drin". Ein leeres Notizbuch wuerde nur
 * den ersten Teil sagen und eher nach Verlust aussehen.
 */
export function IconLeererStapel(props: Props) {
    return (
        <Rahmen kind="leerer-stapel" {...props}>
            {/* Die hintere Karte, leicht versetzt. */}
            <rect x="3.75" y="3.25" width="12.5" height="15.5" rx="2.5" opacity="0.45" />
            {/* Die vordere Karte traegt das Plus. */}
            <rect x="7.75" y="5.75" width="12.5" height="15.5" rx="2.5" />
            <path d="M14 11.75v4.5M11.75 14h4.5" />
        </Rahmen>
    );
}

/*
 * Sternenglanz fuer "Runde geschafft, es sind noch welche uebrig".
 * Das alte 🎉 hat Konfetti geworfen; hier sorgen drei Sterne fuer
 * Feier, ohne dass die Seite aus einem Kindergeburtstag wird.
 */
export function IconSterne(props: Props) {
    return (
        <Rahmen kind="sterne" {...props}>
            {/* Der grosse Stern links oben. */}
            <path d="M9 3.25l1.55 3.7 3.7 1.55-3.7 1.55L9 13.75l-1.55-3.7L3.75 8.5l3.7-1.55L9 3.25Z" />
            {/* Der kleine rechts, bewusst ohne Punkte: sonst zerfaellt das Bild. */}
            <path d="M17.25 13l.85 2 2 .85-2 .85-.85 2-.85-2-2-.85 2-.85.85-2Z" />
            <path d="M16.5 3.25l.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5.5-1.2Z" />
        </Rahmen>
    );
}

/*
 * Zielfahne fuer "Wiederholt" bzw. alles erledigt. Das 🏁 war eine
 * Ziellinie aus Rasterpixeln, die in Farbe und Kantenstaerke nichts mit dem
 * Rest der Seite zu tun hatte. Hier: Stange und wehende Flagge, gezeichnet
 * in derselben Konturstaerke wie alles andere.
 */
export function IconZielfahne(props: Props) {
    return (
        <Rahmen kind="zielfahne" {...props}>
            <path d="M6.25 3.25v17.5" />
            {/* Die Flagge: an der Stange hoch, dann in die Tiefe, wieder hoch – das Wellenprofil. */}
            <path d="M6.25 4.25h12l-2.75 4.5 2.75 4.5h-12" />
        </Rahmen>
    );
}

/*
 * Haken. In zwei Bauweisen dabei:
 *   1. Als Komponente <IconHaken /> fuer Stellen im JSX.
 *   2. Als Maske fuer Stellen, die CSS erzeugt (siehe mask-bild-haken in
 *      global.css) – dort kann man kein SVG in die Seite einhaengen, aber
 *      sehr wohl eines als Maske benutzen. Dadurch sieht der Haken aus wie
 *      alle anderen Strichicons und erbt die Farbe.
 * Beide muessen dasselbe Bild zeichnen, sonst faellt der Unterschied an der
 * Sprachauswahl sofort auf.
 */
export function IconHaken(props: Props) {
    return (
        <Rahmen kind="haken" {...props}>
            <path d="M5.25 12.5l4.5 4.5L18.75 7" />
        </Rahmen>
    );
}

/*
 * Flamme fuer die Streak-Anzeige. Gehoert nicht zum Emoji-Umstieg (das stand
 * im alten Legacy-Navbar), ist aber dieselbe Familie und liegt hier, damit
 * sie nicht wieder als Zeichenfolge eingebaut wird.
 */
export function IconFlamme(props: Props) {
    return (
        <Rahmen kind="flamme" {...props}>
            {/* Die aeussere Form: unten breit, oben in die Spitze gezogen. */}
            <path d="M12 2.75s5.75 4.35 5.75 9.5a5.75 5.75 0 1 1-11.5 0c0-2.1.95-3.6.95-3.6s.8 1.35 2.05 1.85c0-3.05 2.75-6.6 2.75-7.75Z" />
            {/* Die innere Flamme gibt der Form Tiefe. */}
            <path d="M12 13.5s2.1 1.6 2.1 3.15a2.1 2.1 0 1 1-4.2 0c0-1.55 2.1-3.15 2.1-3.15Z" />
        </Rahmen>
    );
}

/*
 * Datei fuer den Import aus dem Rechner. Der Pfeil nach unten in den
 * geoeffneten Kasten ist der Teil, der die Funktion erklaert – ein blasses
 * Blatt allein tut es nicht.
 */
export function IconDatei(props: Props) {
    return (
        <Rahmen kind="datei" {...props}>
            <path d="M13.75 2.75H7a2.5 2.5 0 0 0-2.5 2.5v13.5A2.5 2.5 0 0 0 7 21.25h10a2.5 2.5 0 0 0 2.5-2.5V8.5l-5.75-5.75Z" />
            {/* Die umgeknickte Ecke. */}
            <path d="M13.75 2.75V6.5a2 2 0 0 0 2 2h2.5" />
            <path d="M12 11.25v5M9.5 13.75l2.5 2.5 2.5-2.5" />
        </Rahmen>
    );
}

/*
 * Doppelte Kachel fuer "Set duplizieren". Anders als der Kopierknopf im
 * Menue der Dateiverwaltung hat das hier kein Kaestchen mit Fuenf Linien:
 * die App kennt keine Liste, sie kennt Karten.
 */
export function IconDuplizieren(props: Props) {
    return (
        <Rahmen kind="duplizieren" {...props}>
            <rect x="2.75" y="2.75" width="12" height="12" rx="2.25" />
            <path d="M6.75 21.25h11a3.5 3.5 0 0 0 3.5-3.5v-11" />
        </Rahmen>
    );
}

/*
 * Stift fuer "bearbeiten". Ein echter Stift mit Spitze und Fuellung – der
 * haeufige Trick aus dem Rahmen-symbol (Bleistift im Quadrat) wirkt bei
 * 20px wie ein Symbol aus einer Werkzeugleiste.
 */
export function IconBearbeiten(props: Props) {
    return (
        <Rahmen kind="bearbeiten" {...props}>
            <path d="M4.25 19.75l.95-4.2L16.4 4.35a2.1 2.1 0 0 1 3 0l.35.35a2.1 2.1 0 0 1 0 3L8.55 18.9l-4.3.85Z" />
            <path d="M14.75 6l3.4 3.4" />
        </Rahmen>
    );
}

/*
 * Muellkorb fuer "loeschen". Die Streben sind weggelassen, weil sie bei
 * 20px verschwinden und nur den Umriss uebriglassen – der Umriss allein ist
 * aber genau das, was man erkennt.
 */
export function IconLoeschen(props: Props) {
    return (
        <Rahmen kind="loeschen" {...props}>
            <path d="M3.75 6.25h16.5" />
            <path d="M8.75 6.25V4.5a1.75 1.75 0 0 1 1.75-1.75h3A1.75 1.75 0 0 1 15.25 4.5v1.75" />
            <path d="M5.75 6.25l.9 13.1a2 2 0 0 0 2 1.9h6.7a2 2 0 0 0 2-1.9l.9-13.1" />
        </Rahmen>
    );
}

/*
 * Funkenwunder fuer "Beispielsaetze ergaenzen". Der Zauberstab ist nicht
 * neu (nur die Farbe ist es), aber die drei Funken machen klar, dass hier
 * etwas erzeugt und nicht nur kopiert wird.
 */
export function IconZauberstab(props: Props) {
    return (
        <Rahmen kind="zauberstab" {...props}>
            <path d="M4.25 20.25l11.5-11.5 3.5 3.5-11.5 11.5H4.25v-3.5Z" />
            <path d="M14.75 5.75l1.75 1.75" />
            <path d="M6.25 3.25l.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5.5-1.2Z" />
            <path d="M19.5 13.5l.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5.5-1.2Z" />
        </Rahmen>
    );
}

/*
 * Pfeil nach links fuer den Zurueck-Knopf im Kopf. Bewusst ein Pfeil und
 * kein Pfeil-im-Kreis: die Kopfzeile hat links schon eine Fläche, ein
 * zweiter Kreis darum herum macht die Ecke eng.
 */
export function IconZurueck(props: Props) {
    return (
        <Rahmen kind="zurueck" {...props}>
            <path d="M19.25 12H4.75" />
            <path d="M10.75 5.25L4 12l6.75 6.75" />
        </Rahmen>
    );
}