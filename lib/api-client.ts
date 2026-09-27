/**
 * fetch fuer alle API-Aufrufe aus dem Browser.
 *
 * Der Grund ist eine einzige Zeile: bisher riefen neun Komponenten `fetch`
 * direkt auf, und jede behandelte Fehler selbst – jede anders. Bei 401 kam
 * je nach Seite eine leere Liste, ein endloses Ladesymbol oder ein Fehler
 * mit "0 Sets". Kein Redirect auf die Anmeldung, obwohl das die richtige
 * Antwort auf eine abgelaufene Session ist.
 */

import { vergissAnmeldung } from "./geraet";

export class ApiFehler extends Error {
    readonly status: number;
    /** Feldname -> Meldung, so wie es /api/karten zurueckgibt. */
    readonly felder: Record<string, string>;

    constructor(nachricht: string, status: number, felder: Record<string, string> = {}) {
        super(nachricht);
        this.name = "ApiFehler";
        this.status = status;
        this.felder = felder;
    }
}

/**
 * Holt JSON von der eigenen API.
 *
 * `abfall` ist der Wert, den die aufrufende Komponente im Fehlerfall
 * anzeigt. Ohne `abfall` wirft die Funktion stattdessen – richtig fuer
 * Formulare, die den Fehler anzeigen wollen; mit `abfall` fuer Listen, die
 * dann einfach leer bleiben.
 */
export async function holeJson<T>(url: string, abfall?: T, init?: RequestInit): Promise<T> {
    let antwort: Response;

    try {
        antwort = await fetch(url, {
            ...init,
            // Ohne das holt der Browser bei GET moeglicherweise eine alte
            // Antwort aus dem HTTP-Cache. Die Antworten sind personenbezogen:
            // nach dem Abmelden zeigt die App sonst noch die Sets der
            // vorigen Person.
            cache: "no-store",
        });
    } catch {
        throw new ApiFehler("Keine Verbindung zum Server.", 0);
    }

    if (antwort.status === 401) {
        /*
         * Eine abgelaufene Session ist kein Fehler des Nutzers, sondern ein
         * Zustand, aus dem man ihn herausfuehren muss.
         *
         * `window.location.assign` statt next/navigation: die neuen
         * Session-Cookies kommen vom Server, und ein Client-Navigieren
         * wuerde die Seitenkomponente neu rendern, aber die Komponenten, die
         * den Nutzer geholt haben, nicht neu laden – der Proxy haette die
         * erneuerte Session dann nicht geprueft.
         *
         * next/no-location-assign ist hier bewusst uebergangen: die Regel
         * will Router-Navigation, und in diesem einen Fall ist eine
         * vollstaendige Neuladung die einzige Variante, die den Server
         * tatsaechlich neu betritt.
         */
        if (typeof window !== "undefined") {
            /*
             * Die Sitzung ist weg, also ist auch die Erinnerung an sie
             * falsch. Ohne das bliebe die zuletzt benutzte E-Mail im
             * localStorage stehen und würde im Anmeldeformular wieder
             * eingetragen sein – auch dann, wenn das Abmelden woanders
             * passiert ist (anderes Gerät, anderes Fenster, Sitzung
             * abgelaufen). Siehe lib/geraet.ts.
             */
            vergissAnmeldung();

            const weiter = window.location.pathname + window.location.search;
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination
            window.location.assign(`/anmelden?weiter=${encodeURIComponent(weiter)}`);
        }
        // Wuerfen, damit die aufrufende Komponente nicht weiterarbeitet und
        // nicht noch eine zweite Meldung anzeigt.
        throw new ApiFehler("Nicht angemeldet.", 401);
    }

    let daten: unknown = null;
    try {
        daten = await antwort.json();
    } catch {
        if (!antwort.ok) {
            throw new ApiFehler("Unerwartete Antwort vom Server.", antwort.status);
        }
    }

    if (!antwort.ok) {
        const koerper = (daten ?? {}) as { error?: string; felder?: Record<string, string> };
        const fehler = new ApiFehler(
            koerper.error ?? `Fehler ${antwort.status}`,
            antwort.status,
            koerper.felder ?? {},
        );

        /*
         * 503 wird IMMER geworfen, auch wenn ein `abfall` uebergeben wurde.
         *
         * Der Grund ist die Bedeutung: 401 heisst "deine Sitzung ist weg" –
         * das ist ein Zustand, und die aufrufende Liste darf dann leer sein.
         * 503 heisst "es weiss gerade niemand" – typischerweise weil
         * Supabase gerade nicht erreichbar ist (siehe lib/supabase/user.ts).
         *
         * Mit `abfall` zu arbeiten hiesse hier: kein Fehler, leere Liste,
         * kein Redirect. Der Nutzer schaut auf eine App, die behauptet, er
         * habe keine Sets und keine Karten. Bei einer App mit Lernstand ist
         * das nicht ein Schoenheitsfehler, sondern eine Luege, die man
         * bemerkt, nachdem man sich Sorgen gemacht hat.
         */
        if (antwort.status === 503) throw fehler;

        if (abfall === undefined) throw fehler;
        console.warn(`[api] ${url}: ${fehler.message}`);
        return abfall;
    }

    return daten as T;
}

/**
 * POST mit JSON-Body.
 *
 * Der Body wird hier serialisiert, nicht bei jedem Aufrufer. `undefined` ist
 * ein Sonderfall: JSON.stringify liefert dafuer `undefined` zurueck, und das
 * ergibt einen Request ohne Body, den der Server als "Ungültiges JSON"
 * abweist – die Meldung passt dann nicht zum Fehler.
 */
export async function sendeJson<T>(
    url: string,
    daten: unknown,
    abfall?: T,
    init?: Omit<RequestInit, "body" | "method">,
): Promise<T> {
    return holeJson<T>(
        url,
        abfall,
        {
            ...init,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...init?.headers,
            },
            body: daten === undefined ? "{}" : JSON.stringify(daten),
        },
    );
}
