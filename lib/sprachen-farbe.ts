//das ist eine liste mit den farben für die verschiedenen sprachen
export const sprachenFarben = {
    englisch: "#FFC857",
    französisch: "#FF3D67",
    spanisch: "#FF6B5B",
    italienisch: "#42D6A4"
} as const;
export function getFarbeforSprache(sprache:string): string {
    return(
        //findet farbe für sprache
        sprachenFarben[sprache.toLowerCase()as keyof typeof sprachenFarben]
    );
}
