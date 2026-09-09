//das ist eine liste mit den farben für die verschiedenen sprachen
export const sprachenFarben = {
    englisch: "#df9b35",
    französisch: "#801e2e",
    spanisch: "#c85d43",
    italienisch: "#5c7d64"
} as const;
export function getFarbeforSprache(sprache:string): string {
    return(
        //findet farbe für sprache
        sprachenFarben[sprache.toLowerCase()as keyof typeof sprachenFarben]
    );
}
