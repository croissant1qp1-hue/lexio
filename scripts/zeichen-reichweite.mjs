/**
 * Misst, wie viele Karten überhaupt ein semantisches Bild bekommen.
 *
 * **Wozu.** Die Funktion soll nützlich sein, nicht nur vorhanden. Diese Zahl
 * ist der ehrliche Nachweis dafür, und sie ist ohne jede KI erreichbar. Sie
 * sagt auch genauso klar, wo das Verfahren nicht hilft: bei den Karten, deren
 * Wort kein Bild hat. Die bekommen weiterhin das erzeugte Zeichen, und das ist
 * kein Fehler, sondern die Grenze von „Bild passt zum Wort".
 *
 * Aufruf: `node --import tsx scripts/zeichen-reichweite.mjs`
 */
import { readFileSync } from "node:fs";
import { semantischesZeichen } from "../lib/kartenzeichen-semantik.ts";

function liesWortliste() {
    const pfad = new URL("../scripts/wortlisten/ngsl-top100.json", import.meta.url);
    return JSON.parse(readFileSync(pfad, "utf8"));
}

const wortliste = liesWortliste();

/**
 * Eine Prüfliste gebräuchlicher deutscher Sachwörter.
 *
 * **Wozu die zweite Liste.** Die Demowortliste besteht fast nur aus
 * Funktionswörtern, und für die sagt jede Methode „16 Prozent" – eine Zahl,
 * die nichts über das Verfahren aussagt, sondern nur über das Material. Die
 * Frage des Nutzers war „haus", und Haus ist ein Sachwort. Diese Liste
 * enthält eine stellvertretende Auswahl konkreter Sachwörter und zeigt,
 * was das Verfahren mit dem Material macht, für das es gedacht ist.
 *
 * **Kein Beweis für beliebige Wortlisten.** Es ist eine von mir zusammengestellte
 * Liste, keine gemessene. Sie sagt: die Tabelle deckt den üblichen
 * Grundwortschatz ab. Sie sagt nicht, wie jede künftige Liste ausfällt.
 */
const SACHE_WORTER = `haus hund katze auto fahrrad bus zug flugzeug schiff boot taxi
baum blume strauch gras stein sand berg fluss meer insel strand wald park garten
brot milch ei kaese obst gemuese apfel birne orange banane kartoffel tomate karotte
zwiebel fleisch wurst fisch huhn reis nudeln suppe kuchen schokolade kaffee tee bier wein
sonne mond stern wolke regen schnee wind feuer wetter blau
tisch stuhl bett sofa schrank spiegel tuer fenster treppe schluessel uhr dusche seife
brief buch heft zeitung karte teller gabel messer loeffel pfanne topf glas tasse
schule kirche krankenhaus hotel restaurant cafe bank post bibliothek museum theater
buero stadt land welt dorf platz schloss turm bruecke fabrik
hand kopf auge ohr nase mund zahn haar arm bein fuss herz knochen
hemd hose kleid schuh mantel hut handschuh
computer laptop telefon handy fernseher kamera drucker
musik gitarre film foto gemelde kunst spiel
kind baby mann frau familie lehrer arzt
geld muenze preis geschenk flagge schild karte
gehen kommen laufen sehen hoeren sprechen sagen schreiben lesen lernen singen tanzen
kochen schlafen trinken essen schwimmen fahren oeffnen schliessen kaufen bezahlen finden
helfen zeigen bauen reparieren putzen waschen trocknen`.split(/\s+/).filter(Boolean);

function misse(karten, titel) {
    const treffer = [];
    const ohne = [];
    for (const eintrag of karten) {
        const gefunden = semantischesZeichen(eintrag.frage, eintrag.antwort);
        if (gefunden) treffer.push({ ...eintrag, ...gefunden });
        else ohne.push(eintrag);
    }
    const anteil = Math.round((treffer.length / karten.length) * 100);
    console.log(`\n${titel}`);
    console.log(`  ${karten.length} Karten, davon ${treffer.length} mit Bild (${anteil} %)`);
    return { treffer, ohne, anteil };
}

const demo = misse(wortliste, "Demowortliste (NGSL top 100, viele Funktionswörter)");
const sache = misse(
    SACHE_WORTER.map((wort) => ({ frage: wort, antwort: "" })),
    "Prüfliste Sachwörter (stellvertretende Auswahl konkreter Begriffe)",
);

console.log("\nmit Bild (Demowortliste):");
for (const t of demo.treffer) {
    console.log(`  ${t.icon.padEnd(14)}  ${t.frage} / ${t.antwort}   [über ${t.quelle}]`);
}

console.log("\nohne Bild (bekommen das erzeugte Zeichen):");
console.log(`  ${demo.ohne.map((k) => k.frage).join(", ")}`);

console.log("\nohne Bild in der Prüfliste:");
console.log(`  ${sache.ohne.map((k) => k.frage).join(", ")}`);