import LernenSeite from "./lernen-seite";

// Next 16: params und searchParams sind in Server Components Promises.
export default async function Seite(props: {
    params: Promise<{ set: string }>;
    searchParams: Promise<{ modus?: string | string[]; runde?: string | string[] }>;
}) {
    const { set } = await props.params;
    const { modus, runde } = await props.searchParams;

    /*
     * `?modus=ueben` heisst "Faelligkeit ignorieren" – der Weg, den der
     * Knopf "Nochmal lernen" auf der_sets-Uebersicht geht.
     *
     * Hier wird nur auf den exakten Wert "ueben" geprueft, nicht auf
     * irgendeintrue: was nicht genau ueben ist, ist ein normaler
     * Lerndurchgang. Sonst wuerde ein Tippfehler in der Adresse still eine
     * Wiederholung mit 40 Karten starten.
     */
    const ueben = modus === "ueben";

    /*
     * `?modus=leech` (Plan 1.7) holt die ausgeschlossenen Problemskarten
     * gezielt zurück – der Gegenknopf zum Hinweis "N Problemskarten sind
     * ausgeblendet". Einzig "leech" ist gültig; alles andere ist ein
     * normaler Lerndurchgang.
     */
    const leech = modus === "leech";

    /*
     * `runde` zaehlt die Durchlaeufe im Uebungsmodus.
     *
     * Wofuer: "Weitere Runde" soll dieselben Karten noch einmal bringen. Ohne
     * diesen Zaehler zeigt Next auf dieselbe URL dieselbe Server-Ausgabe
     * wieder, der Client laedt nichts neu, und der Knopf tut so, als
     * waere nichts passiert. Genau das war vorher der Fall – "Nochmal lernen"
     * waere an dieser Stelle eine Luege.
     *
     * Die Abhaengigkeit steckt unten in `rundeNr` im Client, nicht in der
     * Route: fuer den Server ist eine weitere Runde derselbe Auftrag.
     */
    const rundeNr = Number(runde) || 0;

    return <LernenSeite setSlug={set} ueben={ueben} leech={leech} rundeNr={rundeNr} />;
}
