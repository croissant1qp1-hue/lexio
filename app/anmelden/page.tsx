import type { Metadata } from "next";
import AnmeldenSeite from "./anmelden-seite";
import { normiereWeiterZiel } from "@/lib/weiter-ziel";

export const metadata: Metadata = {
    title: "Anmelden",
    robots: { index: false, follow: false },
};

type SeiteProps = {
    searchParams: Promise<{ weiter?: string | string[]; fehler?: string | string[] }>;
};

/** Suchparameter koennen mehrfach kommen; fuer uns zaehlt der erste. */
function erst(wert: string | string[] | undefined): string | null {
    if (Array.isArray(wert)) return wert[0] ?? null;
    return wert ?? null;
}

/**
 * `weiter` und `fehler` werden hier auf dem Server gelesen, nicht im Client.
 *
 * Vorher stand in der Client-Komponente ein useSearchParams(). Das ist in
 * App-Routern nur mit einer Suspense-Grenze erlaubt, und deren Fallback war
 * ein leeres div – die Anmeldeseite kam also erst nach dem Laden von JavaScript
 * und dem ersten Rendern im Browser. Bei schwacher Verbindung war das ein
 * weisses Nichts, und ohne JavaScript blieb es dauerhaft leer. Das Formular
 * selbst braucht diese Information aber nur einmal, am Anfang.
 *
 * Nebenbei faellt der Aufruf von normiereWeiterZiel() auf dem Server weg: der
 * Wert kommt geprueft an und muss im Client nicht noch einmal durch dieselbe
 * Pruefung. Und weil die Seite jetzt searchParams liest, ist sie dynamisch –
 * was sie als Anmeldeseite ohnehin sein sollte.
 */
export default async function Seite({ searchParams }: SeiteProps) {
    const parameter = await searchParams;
    const weiter = normiereWeiterZiel(erst(parameter.weiter));
    const weiterleitungsFehler = erst(parameter.fehler);
    return <AnmeldenSeite weiter={weiter} weiterleitungsFehler={weiterleitungsFehler} />;
}
