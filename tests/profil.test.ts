/**
 * Tests fuer lib/profil.ts – Level-Kurve, Fortschrittsbalken, Tagesziel.
 *
 * Warum ueberhaupt: `lib/profil.ts` ist laut eigenem Kommentar "die einzige
 * Stelle, die definiert, was ein Level ist, und damit die einzige, die man
 * aendern muss, wenn sich die Formel aendert". Genau daran hat Phase 3.2
 * gedreht (flache 1500 -> Kurve mit 10 % Wachstum) – und die hatte als
 * einzige Logik in diesem Projekt keinen Regressionstest. Dabei ist die
 * Formel genau die Sorte Code, die beim naechsten Umbau leise kaputtgeht:
 * `levelAusXp` loopt, `levelInfo` loopt ein zweites Mal, und wenn beide
 * nicht dieselbe Aufstiegstabelle benutzen, zeigt der Balken einen Fortschritt,
 * den das Level gar nicht kennt.
 *
 * Die drei Fehler, die ein Test hier verhindert:
 *
 *   - **Der Balken erreicht 100 % vor dem Aufstieg.** 999 von 1000 XP sahen
 *     vorher schon voll aus. Das ist die Regel `Math.min(99, ...)`.
 *   - **`xpImLevel` laeuft negativ.** Wenn die Aufstiegstabelle zwischen
 *     `levelAusXp` und der Summenschleife in `levelInfo` auseinanderliefe,
 *     zeigte die Seite XP im aktuellen Level, die nie gesammelt wurden.
 *   - **Ein Aufstieg um genau eine Stufe.** Genau auf der Schwelle muss die
 *     Anzeige umspringen auf Level+1, xpImLevel 0 – nicht auf Level mit
 *     xpImLevel == Kosten, was wie ein halber Aufstieg aussieht.
 *
 * Aufruf: `npm test`
 * Laeuft mit dem eingebauten Testrunner von Node, wie die anderen Tests.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
    TAGESZIEL_XP,
    levelAusXp,
    levelInfo,
    xpFormatieren,
    xpFuerAufstieg,
} from "../lib/profil";

// --- xpFuerAufstieg: die Kosten je Stufe -------------------------------

test("xpFuerAufstieg: Stufe 1 kostet die Basis 1000", () => {
    assert.equal(xpFuerAufstieg(1), 1000);
});

test("xpFuerAufstieg: waechst um zehn Prozent je Stufe", () => {
    // 1000 * 1.1 = 1100, * 1.1 = 1210, * 1.1 = 1331, * 1.1 = 1464.1
    assert.equal(xpFuerAufstieg(2), 1100);
    assert.equal(xpFuerAufstieg(3), 1210);
    assert.equal(xpFuerAufstieg(4), 1330);
    assert.equal(xpFuerAufstieg(5), 1460);
});

test("xpFuerAufstieg: rundet auf volle Zehn, damit die Anzeige keine Centbetraege zeigt", () => {
    // 1000 * 1.1^11 = 2853.11… -> 2850
    assert.equal(xpFuerAufstieg(12), 2850);
    for (let l = 1; l <= 40; l += 1) {
        assert.equal(xpFuerAufstieg(l) % 10, 0, `Stufe ${l} ist nicht auf Zehn gerundet`);
    }
});

test("xpFuerAufstieg: ist an jeder Stufe echt teurer als an der davor", () => {
    // Das ist der eigentliche Punkt von 3.2. Ohne diese Eigenschaft waere die
    // Kurte flach und der alte Zustand wieder da.
    for (let l = 1; l < 60; l += 1) {
        assert.ok(
            xpFuerAufstieg(l + 1) > xpFuerAufstieg(l),
            `Stufe ${l + 1} ist nicht teurer als Stufe ${l}`,
        );
    }
});

test("xpFuerAufstieg: verträgt 0, negative und kaputte Eingaben", () => {
    // Alles unter 1 wird auf Stufe 1 gezogen, statt eine Schleife mit
    // negativem Index zu bekommen.
    assert.equal(xpFuerAufstieg(0), 1000);
    assert.equal(xpFuerAufstieg(-5), 1000);
    assert.equal(xpFuerAufstieg(Number.NaN), 1000);
});

// --- levelAusXp: welche Stufe bei wie viel XP ---------------------------

test("levelAusXp: wer nichts gelernt hat, ist Stufe 1", () => {
    assert.equal(levelAusXp(0), 1);
});

test("levelAusXp: 999 XP sind noch Stufe 1, 1000 genau der Aufstieg", () => {
    assert.equal(levelAusXp(999), 1);
    assert.equal(levelAusXp(1000), 2);
});

test("levelAusXp: springt auf genau der Schwelle um genau eine Stufe", () => {
    // Summen der Aufstiege bis Stufe n
    const kosten = (n: number) => {
        let summe = 0;
        for (let l = 1; l < n; l += 1) summe += xpFuerAufstieg(l);
        return summe;
    };
    for (let n = 1; n <= 20; n += 1) {
        const schwelle = kosten(n + 1);
        assert.equal(levelAusXp(schwelle - 1), n, `${schwelle - 1} XP muessen Stufe ${n} sein`);
        assert.equal(levelAusXp(schwelle), n + 1, `${schwelle} XP muessen Stufe ${n + 1} sein`);
    }
});

test("levelAusXp: bricht am Deckel ab statt endlos zu laufen", () => {
    // MAX_LEVEL ist 120. Eine Schleife ohne Deckel waere bei absurdem XP
    // eine Endlosschleife im Request.
    assert.equal(levelAusXp(1_000_000_000), 120);
});

// --- levelInfo: der Fortschrittsbalken ---------------------------------

test("levelInfo: bei 0 XP ist der Balken leer, nicht voll", () => {
    const info = levelInfo(0);
    assert.equal(info.level, 1);
    assert.equal(info.xpImLevel, 0);
    assert.equal(info.prozent, 0);
    assert.equal(info.bisNaechstes, 1000);
});

test("levelInfo: der Balken erreicht nie 100 %, solange noch XP fehlen", () => {
    // Die Regel, um die es hier geht: 999 von 1000 XP sahen vorher voll aus.
    for (let xp = 0; xp < 1000; xp += 1) {
        const info = levelInfo(xp);
        assert.ok(info.prozent <= 99, `${xp} XP zeigen ${info.prozent} %`);
    }
    assert.equal(levelInfo(999).prozent, 99);
});

test("levelInfo: bisNaechstes passt zur xpImLevel-Angabe", () => {
    for (const xp of [0, 1, 250, 999, 1000, 1500, 4321, 9999]) {
        const info = levelInfo(xp);
        assert.equal(
            info.xpImLevel + info.bisNaechstes,
            xpFuerAufstieg(info.level),
            `Bei ${xp} XP passen xpImLevel und bisNaechstes nicht zur Stufe`,
        );
    }
});

test("levelInfo: xpImLevel bleibt in den gekauften XP, nie negativ", () => {
    // Wenn die Summenschleife hier eine andere Tabelle benutzt als
    // levelAusXp, laeuft xpImLevel ins Minus.
    for (let xp = 0; xp <= 30_000; xp += 97) {
        const info = levelInfo(xp);
        assert.ok(info.xpImLevel >= 0, `Bei ${xp} XP ist xpImLevel ${info.xpImLevel}`);
        assert.ok(
            info.xpImLevel < xpFuerAufstieg(info.level),
            `Bei ${xp} XP ist xpImLevel ${info.xpImLevel} zu gross`,
        );
    }
});

test("levelInfo: nach einem Aufstieg beginnt die Anzeige wieder bei null", () => {
    const info = levelInfo(1000);
    assert.equal(info.level, 2);
    assert.equal(info.xpImLevel, 0);
    assert.equal(info.prozent, 0);
    assert.equal(info.bisNaechstes, xpFuerAufstieg(2));
});

test("levelInfo: die angezeigte Summe ergibt wieder die Gesamtzahl", () => {
    // Der Test, der beide Schleifen im selben Aufruf klemmt: Was levelInfo
    // als "XP innerhalb der Stufe" ausweist, muss genau das sein, was seit
    // dem Aufstieg dazugekommen ist.
    let summe = 0;
    for (let xp = 0; xp <= 20_000; xp += 31) {
        const info = levelInfo(xp);
        assert.equal(info.xp, xp);
        if (info.xp > summe) summe = info.xp;
    }
    const info = levelInfo(20_000);
    let davor = 0;
    for (let l = 1; l < info.level; l += 1) davor += xpFuerAufstieg(l);
    assert.equal(davor + info.xpImLevel, 20_000);
});

test("levelInfo: kaputte Eingaben landen bei 0 XP statt bei NaN", () => {
    // Die Datenbank koennte einmal null liefern. NaN im Balken waere ein
    // leerer Fortschritt ohne Erklaerung.
    for (const kaputt of [Number.NaN, -100, -0]) {
        const info = levelInfo(kaputt);
        assert.equal(info.xp, 0);
        assert.equal(info.prozent, 0);
        assert.ok(Number.isFinite(info.bisNaechstes));
    }
    assert.equal(levelInfo(Number.POSITIVE_INFINITY).xp, 0);
});

// --- Tagesziel ---------------------------------------------------------

test("TAGESZIEL_XP ist eine Lernrunde und nicht die alten 20", () => {
    // 20 war absurd wenig: eine Runde mit 20 Karten und "gut" bringt 100 XP,
    // der Balken war nach der halben Runde voll.
    assert.equal(TAGESZIEL_XP, 100);
});

// --- xpFormatieren -----------------------------------------------------

test("xpFormatieren: Punkt als Tausendertrenner", () => {
    assert.equal(xpFormatieren(0), "0");
    assert.equal(xpFormatieren(999), "999");
    assert.equal(xpFormatieren(1000), "1.000");
    assert.equal(xpFormatieren(1234567), "1.234.567");
});

test("xpFormatieren: rundet ab und ueberlebt kaputte Werte", () => {
    assert.equal(xpFormatieren(1000.9), "1.000");
    assert.equal(xpFormatieren(Number.NaN), "0");
    assert.equal(xpFormatieren(-5), "0");
});
