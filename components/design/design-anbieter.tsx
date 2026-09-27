"use client";

import { DESIGN_SPEICHER } from "@/lib/design";
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";

/**
 * Helles oder dunkles Design.
 *
 * Vorher gab es den Schalter in den Einstellungen, und er tat nichts: die
 * Auswahl wurde in localStorage geschrieben, aber nirgends gelesen. Und der
 * Versuch, das ueber `html.dark { filter: invert(1) }` zu loesen, haette
 * jeden Screenshot invertiert.
 *
 * Der Schalter setzt `data-design` auf <html>. global.css haengt daran die
 * hellen Werte. Das Script in app/layout.tsx setzt dasselbe Attribut vor dem
 * ersten Paint, damit es nicht kurz dunkel aufblitzt.
 */

export type Design = "dunkel" | "hell";

type Kontext = {
    design: Design;
    hell: boolean;
    setDesign: (design: Design) => void;
    umschalten: () => void;
};

const DesignKontext = createContext<Kontext | null>(null);

/**
 * Wert, den das Script vor dem Paint gesetzt hat. Der Server kennt ihn nicht,
 * deshalb wird er hier clientseitig gelesen statt ueber Props gereicht.
 *
 * Es gibt keinen Effekt zum Nachfuehren: localStorage wird hier direkt
 * gelesen. Ein zweiter Effekt, der dasselbe Ergebnis noch einmal in State
 * schreibt, wuerde nur einen weiteren Render-Durchlauf erzeugen.
 */
function startwert(): Design {
    if (typeof document === "undefined") return "dunkel";
    return document.documentElement.dataset.design === "hell" ? "hell" : "dunkel";
}

export function DesignAnbieter({ children }: { children: React.ReactNode }) {
    const [design, setDesignZustand] = useState<Design>(startwert);

    // Dokument und localStorage gemeinsam aktualisieren. Der Effekt ist die
    // einzige Wahrheit: setDesign schreibt direkt, der Effekt zieht nach. So
    // gibt es nur einen Weg, auf dem sich etwas aendert, und keinen Zustand,
    // in dem die drei Orte auseinanderlaufen.
    useEffect(() => {
        document.documentElement.dataset.design = design;
        try {
            window.localStorage.setItem(DESIGN_SPEICHER, design);
        } catch {
            /*
             * Privater Modus, voller Speicher, abgelehnte Berechtigung.
             * Das Design gilt fuer diese Sitzung, gespeichert wird es nicht.
             * Ein Fehler hier darf die App nicht zum Absturz bringen.
             */
        }
    }, [design]);

    const setDesign = useCallback((neu: Design) => setDesignZustand(neu), []);
    const umschalten = useCallback(
        () => setDesignZustand((d) => (d === "hell" ? "dunkel" : "hell")),
        [],
    );

    const wert = useMemo<Kontext>(
        () => ({ design, hell: design === "hell", setDesign, umschalten }),
        [design, setDesign, umschalten],
    );

    return <DesignKontext.Provider value={wert}>{children}</DesignKontext.Provider>;
}

export function useDesign(): Kontext {
    const kontext = useContext(DesignKontext);
    if (!kontext) {
        // Aufrufer ausserhalb des Anbieters: kein Absturz, nur kein Umschalten.
        return {
            design: "dunkel",
            hell: false,
            setDesign: () => undefined,
            umschalten: () => undefined,
        };
    }
    return kontext;
}

/**
 * Das Script fuer den <head> liegt bewusst nicht in dieser Datei, sondern in
 * lib/design.ts. Dieses Model ist `"use client"`; ein daraus in den Server
 * importierter Wert waere eine Client-Referenz und kein String. app/layout.tsx
 * holt sich DESCRIPT_SCRIPT deshalb direkt von dort.
 */
