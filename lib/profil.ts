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
 */

/** XP, die man je Level braucht. */
export const XP_PRO_LEVEL = 1500;

/** Level 1 beginnt bei 0 XP – wer gerade erst angefangen hat, ist Level 1. */
export function levelAusXp(xp: number): number {
    if (!Number.isFinite(xp) || xp <= 0) return 1;
    return Math.floor(xp / XP_PRO_LEVEL) + 1;
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
    const xpImLevel = sicher % XP_PRO_LEVEL;

    return {
        xp: sicher,
        level,
        xpImLevel,
        prozent: Math.round((xpImLevel / XP_PRO_LEVEL) * 100),
        bisNaechstes: XP_PRO_LEVEL - xpImLevel,
    };
}

/** "1.234 XP" – Punkt als Tausendertrenner, ohne Nicht-umbrechende Leerzeichen. */
export function xpFormatieren(xp: number): string {
    const sicher = Number.isFinite(xp) && xp > 0 ? Math.floor(xp) : 0;
    return sicher.toLocaleString("de-DE");
}
