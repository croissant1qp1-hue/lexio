/**
 * Wohin nach der Anmeldung.
 *
 * `weiter` steht in der Adresszeile und kommt damit von aussen: aus einem
 * Redirect des Proxys, aus dem `redirectTo` des OAuth-Angebots, aus einem
 * Link. Wer die Seite betritt, bestimmt den Wert. Steht dort eine fremde
 * Adresse, schickt man die gerade angemeldete Person samt Session dorthin.
 *
 * Deshalb gibt es hier eine einzige Pruefung fuer alle drei Stellen, die das
 * Ziel verwenden: proxy.ts, /api/auth/callback und die Anmeldeseite. Drei
 * eigene Varianten waren drei Chancen, eine davon zu weak zu formulieren –
 * und die schwächste gewinnt, weil sie zuletzt geaendert wird.
 *
 * Was zurueckkommt, ist immer ein brauchbarer Zielpfad: "/" als Auffangwert.
 */

const BASIS = "https://lexio.intern";

/** Seiten, die man nach der Anmeldung nicht erneut aufruft. */
const ANMELDE_ROUTE = "/anmelden";

/**
 * Prueft einen `weiter`-Wert und gibt ihn unveraendert zurueck, wenn er
 * sicher ist – sonst "/".
 *
 * Abgelehnt werden:
 *   - alles, was nicht mit "/" beginnt (http://evil.example, javascript:…),
 *   - "//evil.example" – der Browser liest das als scheme-relative Adresse,
 *   - "/\evil.example" – genau so, mit Backslash. Chrome, Safari und Firefox
 *     normalisieren das vor dem Resolve zu "//evil.example", also ist es der
 *     gleiche Angriff mit einem anderen Zeichen,
 *   - "/%2f%2fevil.example" – nach dem Dekodieren durch den Router dasselbe;
 *     deshalb wird der Pfad einmal dekodiert und noch einmal geprueft,
 *   - "/anmelden" und alles darunter, sonst landet man nach dem Einloggen
 *     direkt wieder im Anmeldeformular.
 */
export function normiereWeiterZiel(roh: string | null | undefined): string {
    if (!roh) return "/";

    // Einmal dekodieren, aber nur fuer die Pruefung. Zurueckgegeben wird
    // spaeter die geparste, normalisierte Fassung – nicht der Rohwert.
    const dekodiert = (() => {
        try {
            return decodeURIComponent(roh);
        } catch {
            // kaputte Prozentzeichen: nicht interpretierbar, also ablehnen
            return "";
        }
    })();

    for (const wert of [roh, dekodiert]) {
        if (!/^\/(?![/\\])/.test(wert)) return "/";
    }

    /*
     * Ab hier entscheidet der echte URL-Parser, nicht mehr die Regex. Das ist
     * der Punkt, an dem sich Normalisierungen nicht mehr umgehen lassen:
     * `new URL` entfernt Tab und Zeilenumbrueche aus dem Pfad, also ist
     * "/\tevil.example" danach schlicht "/evil.example" – dieselbe Seite,
     * harmlos. Was vorher zurueckgegeben wuerde, ist eine Zeichenkette, die
     * kein Browser so interpretiert, wie man sie gelesen hat.
     */
    let url: URL;
    try {
        url = new URL(roh, BASIS);
    } catch {
        return "/";
    }

    // Fremde Herkunft: so oder so nicht.
    if (url.origin !== BASIS) return "/";
    if (url.pathname.startsWith("//") || url.pathname.includes("\\")) return "/";

    /*
     * Nach der Anmeldung nicht wieder auf der Anmeldeseite landen. Ueber den
     * Pfad, nicht ueber den rohen String: "/anmelden?weiter=/" waere mit
     * einem Vergleich auf den Anfang des Strings durchgerutscht, obwohl es
     * dieselbe Seite ist.
     */
    if (url.pathname === ANMELDE_ROUTE || url.pathname.startsWith(`${ANMELDE_ROUTE}/`)) {
        return "/";
    }

    return `${url.pathname}${url.search}${url.hash}`;
}
