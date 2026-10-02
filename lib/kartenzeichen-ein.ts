/**
 * Sichtbarkeit der Kartenzeichen.
 *
 * Bewusst dieselbe Form wie `lib/ton.ts` und `lib/geraet.ts`: die Wahl gehört
 * zum Gerät, nicht zum Konto. Ein Kartenzeichen ist eine Dekoration, und sie
 * vom Konto abhängig zu machen hieße, sie auf einem zweiten Gerät anders
 * aussehen zu lassen — ohne Grund und ohne dass jemand es bemerkt, warum.
 *
 * Es gibt hier keinen Kontext und keinen Provider. Der Stand ist eine
 *_external store_-Quelle, und beide Seiten hängen sich mit
 * `useSyncExternalStore` daran: die Lernseite liest, die Einstellungen-Seite
 * schreibt. Damit kann es keinen Zustand geben, in dem die beiden Orte
 * auseinanderlaufen.
 *
 * **Warum nicht `useState(() => liesZeichen())`.** Diese Schreibweise liest
 * localStorage im Zustands-Initializer. Der Server hat kein `window` und
 * rendert den Vorgabe-Stand, der erste Client-Render aber den gespeicherten –
 * bei ausgeschalteten Zeichen sieht der Server das Zeichen und der Browser
 * nicht, und React meldet das als Hydration-Fehler #418. Im Audit war genau
 * das zu sehen. Mit `useSyncExternalStore` ist der Server-Stand ausdrücklich
 * der Vorgabewert, beide Renderings stimmen überein.
 *
 * Kein Feld in der Datenbank, also keine Migration. Der Preis dafür ist
 * ehrlich zu benennen: die Einstellung folgt einem nicht in ein anderes
 * Gerät. Für ein dekoratives Zeichen ist das richtig so — dieselbe Karte
 * bekommt ihre Zeichen nicht plötzlich anders, weil man angemeldet ist.
 */
export const ZEICHEN_SPEICHER = "lexio.kartenzeichen.v1";

/**
 * Eigenes Ereignis zusätzlich zum `storage`-Ereignis.
 *
 * `storage` feuert nur in *anderen* Tabs. Wer den Schalter im Tab bedient, in
 * dem er auch lernt, bekäme sonst keine Rückmeldung – und dieselbe Seite
 * zeigte weiter das alte Zeichen. Dies hier wird im selben Tab ausgelöst und
 * schließt die Lücke, ohne einen fremden Ereignistypen zu simulieren.
 */
const EREIGNIS = "lexio:kartenzeichen";

export type ZeichenStand = {
    /** Schema-Version. Eine alte, unbekannte Version wird verworfen. */
    v: 1;
    /** Zeichen an (Vorgabe) oder aus. */
    an: boolean;
};

/** Der Standard, wenn nichts gespeichert ist: Zeichen an. */
const VORGABE: ZeichenStand = { v: 1, an: true };

/**
 * Was der Server rendert und was auch der erste Client-Render annimmt.
 *
 * Wichtig, dass es *dieselbe* Funktion für beide ist: React vergleicht das
 * Ergebnis von `getServerSnapshot` mit dem ersten `getSnapshot`, und zwei
 * verschiedene Objekte wären sofort wieder ein Hydration-Unterschied. Deshalb
 * ein einfaches `true` und nicht das Stand-Objekt.
 */
export function zeichenVorgabe(): boolean {
    return true;
}

function speicher(): Storage | null {
    try {
        if (typeof window === "undefined") return null;
        return window.localStorage;
    } catch {
        return null;
    }
}

/** Den gespeicherten Stand lesen, mit dem Standard, wenn nichts da ist. */
export function liesZeichen(): ZeichenStand {
    const s = speicher();
    if (!s) return VORGABE;
    try {
        const roh = s.getItem(ZEICHEN_SPEICHER);
        if (!roh) return VORGABE;
        const wert = JSON.parse(roh) as Partial<ZeichenStand>;
        if (wert?.v !== 1) return VORGABE;
        return { v: 1, an: wert.an !== false };
    } catch {
        // Kaputter Eintrag (Handeingetragen, andere App-Version): wegwerfen.
        return VORGABE;
    }
}

/**
 * Nur das Ja oder Nein – als `getSnapshot` von `useSyncExternalStore`.
 *
 * Bewusst ein `boolean` und nicht das ganze Objekt: `getSnapshot` muss
 * denselben Wert liefern, solange sich im Speicher nichts geändert hat. Ein
 * frisch gebautes `{v: 1, an: true}` wäre zwar gleichwertig, aber nicht
 * identisch, und React würde die Render-Schleife endlos wiederholen.
 */
export function liesZeichenAn(): boolean {
    return liesZeichen().an;
}

/** Den Stand speichern. Im privaten Modus gilt er nur für diese Sitzung. */
export function setzeZeichen(stand: ZeichenStand): void {
    const s = speicher();
    if (!s) return;
    try {
        s.setItem(ZEICHEN_SPEICHER, JSON.stringify(stand));
    } catch {
        // Speicher voll oder gesperrt: die Einstellung gilt dann nur für den
        // aktuellen Durchlauf. Besser als ein Absturz beim Speichern.
    }
    if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(EREIGNIS));
    }
}

/**
 * Anmelden für Änderungen. Liefert die Abmeldung zurück, wie es
 * `useSyncExternalStore` verlangt.
 */
export function beobachteZeichen(rueckruf: () => void): () => void {
    if (typeof window === "undefined") return () => {};
    const imSelbenTab = () => rueckruf();
    const imAnderenTab = (e: StorageEvent) => {
        if (e.storageArea !== window.localStorage) return;
        // `key === null` heißt: der ganze Speicher wurde geleert.
        if (e.key === null || e.key === ZEICHEN_SPEICHER) rueckruf();
    };
    window.addEventListener(EREIGNIS, imSelbenTab);
    window.addEventListener("storage", imAnderenTab);
    return () => {
        window.removeEventListener(EREIGNIS, imSelbenTab);
        window.removeEventListener("storage", imAnderenTab);
    };
}
