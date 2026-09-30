/**
 * Level aus XP.
 *
 * Stand vorher an drei Stellen fest: "Level 5 • 6777 XP", "65%" im
 * Profilbalken, "6777" auf der Uebersicht. Drei Zahlen, die nicht
 * zusammenpassen konnten und sich nie geaendert haben.
 *
 * Bewusst eine reine Funktion ohne React und ohne Datenbank: sie ist die
 * einzige Stelle, die definiert, was ein Level ist, und damit die einzige,
 * die man aendern muss, wenn sich die Formel aendert.
 *
 * Seit Phase 3.2 ist Level nicht mehr flach (1500 XP je Stufe), sondern
 * eine Kurve: jeder Aufstieg kostet zehn Prozent mehr als der letzte.
 * Konstante 1500 ueber alle Ebenen hiess 187 perfekte Antworten je Level,
 * egal ob man gerade anfaengt oder seit einem Jahr lernt. Mit zehn Prozent
 * Wachstum fangen niedrige Level leicht an, ab 20 ist gut spuerbar, dass es
 * weitergeht. Basis 1000 ist auf acht XP je Karte eine Runde mit ~125
 * perfekten Antworten fuer den ersten Aufstieg – hoch genug, dass Level 1
 * nicht schon nach einer Sitzung vorbei ist.
 */

/**
 * XP fuer den Aufstieg aus `zuLevel` heraus, gerundet auf volle Zehn.
 *
 * Der Faktor ist absichtlich konservativ: Level 1 kostet mit 1000 etwas
 * weniger als die alten 1500, aber die Kurve waechst gleichmaessig statt zu
 * springen. Zehn Prozent lassen sich an den Zahlen schoen erklaeren
 * („Level 12 kostet 3130 XP"), ohne dass die Anzeige einzelne Centbetraege
 * zeigt.
 */
export function xpFuerAufstieg(zuLevel: number): number {
    const n = Math.max(1, Math.floor(zuLevel));
    return Math.round((1000 * Math.pow(1.1, n - 1)) / 10) * 10;
}

/** Sicherer Deckel, damit die Schleife nie ewig laeuft. */
const MAX_LEVEL = 120;

/** Level 1 beginnt bei 0 XP – wer gerade erst angefangen hat, ist Level 1. */
export function levelAusXp(xp: number): number {
    if (!Number.isFinite(xp) || xp <= 0) return 1;
    let verbleib = Math.floor(xp);
    for (let level = 1; level < MAX_LEVEL; level += 1) {
        const kosten = xpFuerAufstieg(level);
        if (verbleib < kosten) return level;
        verbleib -= kosten;
    }
    return MAX_LEVEL;
}

export type LevelInfo = {
    xp: number;
    level: number;
    /** XP innerhalb der aktuellen Stufe. */
    xpImLevel: number;
    /** 0–100, für den Fortschrittsbalken. */
    prozent: number;
    /** Was bis zum naechsten Level fehlt. */
    bisNaechstes: number;
};

export function levelInfo(xp: number): LevelInfo {
    const sicher = Number.isFinite(xp) && xp > 0 ? Math.floor(xp) : 0;
    const level = levelAusXp(sicher);

    let davor = 0;
    for (let l = 1; l < level; l += 1) davor += xpFuerAufstieg(l);

    const xpImLevel = sicher - davor;
    const schwellenXp = xpFuerAufstieg(level);

    return {
        xp: sicher,
        level,
        xpImLevel,
        // Nie 100 gefuellt, solange noch XP fehlen: 999 von 1000 XP wuerde
        // sonst schon den vollen Balken zeigen. 100 gibt es nur am Deckel.
        prozent: Math.min(99, Math.floor((xpImLevel / schwellenXp) * 100)),
        bisNaechstes: Math.max(0, schwellenXp - xpImLevel),
    };
}

/**
 * Tagesziel in XP (Phase 3.3).
 *
 * Frueher fest 20 – absurd wenig neben einer Runde, die mit 20 Karten
 * und "gut" 100 XP bringt: der Balken war nach einer halben Runde voll.
 * Das ehrliche Ziel ist eine Lernrunde pro Tag, also 5 XP je Karte mal
 * 20 Karten. Als einzige Konstante hier steht es, statt in SQL-RPC,
 * API-Fallback und Statistik je einmal zu stecken – drei Stellen fuer
 * dieselbe Zahl waren genau das Problem, das 3.3 behebt. Die Datenbank
 * kennt 100 ebenfalls (Migration 013), der Fallback hier deckt den Zeitraum
 * ab, in dem die eigene Bindung noch nachzieht.
 */
export const TAGESZIEL_XP = 100;

/** "1.234 XP" – Punkt als Tausendertrenner, ohne Nicht-umbrechende Leerzeichen. */
export function xpFormatieren(xp: number): string {
    const sicher = Number.isFinite(xp) && xp > 0 ? Math.floor(xp) : 0;
    return sicher.toLocaleString("de-DE");
}