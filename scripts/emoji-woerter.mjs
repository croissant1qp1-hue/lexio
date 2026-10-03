/**
 * Baut aus den Unicode-Daten der Maschine einen Index von Wort zu Emoji.
 *
 * **Wozu das da ist.** Die Zuordnung „Haus -> Haus" ist eine von Menschen
 * gemachte Zuordnung, und sie existiert bereits: in den Emoji-Namen. Das ist
 * dasselbe Wissen, das eine KI-API liefern wuerde, nur ohne Konto, ohne
 * Schluessel, ohne Kosten und ohne Wartezeit — und, anders als ein Bildmodell,
 * in einem einzigen Stil, der sich nie veraendert.
 *
 * **Was hier entsteht** ist bewusst kein Automatismus fuer die Produktion,
 * sondern ein Vorschlagsgenerator: Das Skript liefert Kandidaten, ein Mensch
 * entscheidet. Denn die Namen sind englische Begriffe, und ein Name wie
 * `WELL` gehoert zu einer Bohrinsel, nicht zu einem Befinden — das kann kein
 * Skript wissen. Was es kann, ist Arbeit abnehmen, die sonst niemand macht.
 *
 * **Der Laufzeitcode sieht diese Datei nicht.** Sie wird nur auf ausdruecklichen
 * Wunsch geschrieben (`--schreiben`), steht neben dem Skript statt in `lib/`
 * und ist von Git ausgenommen. Grund: sie ist ein Arbeitsmittel, kein Anwendungs-
 * code, und1300 Zeilen Daten, die nichts einbindet, gehoeren nicht in den Bau
 * einer Lern-App.
 *
 * Aufruf:
 *   node scripts/emoji-woerter.mjs --schreiben          Tabelle erzeugen
 *   node scripts/emoji-woerter.mjs haus house zeit      Kandidaten nachschlagen
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const UNICODE = "/usr/share/unicode/emoji";
const ZIEL = new URL("./emoji-woerter.generated.ts", import.meta.url);

/**
 * Woerter, die in Emoji-Namen vorkommen, aber nichts ueber das Ding sagen, das
 * gemeint ist. Nach dem ersten Treffer wird nicht weiter gesucht, wenn eines
 * davon matched: `well` soll die Bohrinsel 🛢️ nicht schlagen, wenn die Karte
 * „mir geht es gut" heisst.
 */
const FUELLWORTER = new Set([
    "face", "hand", "left", "right", "with", "and", "sign", "symbol", "button",
    "selector", "keycap", "square", "circle", "triangle", "flag", "dot", "arrow",
    "mark", "ornament", "decoration", "style", "unicode", "character",
    // Haut- und Haarbausteine, die es als eigene Emoji gibt, aber nie gemeint sind.
    "skin", "tone", "hair", "component",
]);

/**
 * Ein einzelner Codepoint als Zeichen, sonst `null` bei Sequenzen.
 */
const HAUTTONE = /[\u{1F3FB}-\u{1F3FF}]/u;
const ZWJ = "\u200D";

function liesEmoji() {
    const datei = `${UNICODE}/emoji-test.txt`;
    if (!existsSync(datei)) {
        throw new Error(`Fehlt: ${datei}. Ohne die Unicode-Daten laeuft dieses Skript nicht.`);
    }
    const raus = [];
    for (const zeile of readFileSync(datei, "utf8").split("\n")) {
        if (!zeile.trim() || zeile.startsWith("#")) continue;
        // Nur die vollstaendig qualifizierte Form. Die kurzform ist eine
        // Textvariante desselben Zeichens und wuerde jedes Wort, zu dem es
        // sie gibt, grundlos mehrdeutig machen.
        if (!/;\s*fully-qualified\s*#/.test(zeile)) continue;
        const datenteil = zeile.split("#")[1];
        if (!datenteil) continue;
        // `# <zeichen> E<version> <name>` – das Zeichen steht bei einzelnen
        // Codepunkten in Klammern, bei Sequenzen ohne.
        const treffer = datenteil.trim().match(/^(?:\((.+?)\)|(\S+))\s+E[\d.]+\s+(.+)$/u);
        if (!treffer) continue;
        const zeichen = treffer[1] ?? treffer[2];
        const name = treffer[3].trim();
        if (!zeichen || !name) continue;
        // Hauttonvarianten sind nie gemeint und wuerden `people` auf 34
        // Kandidaten aufblaehen lassen.
        if (HAUTTONE.test(zeichen)) continue;
        raus.push({ zeichen, name });
    }
    return raus;
}

/** Aus einem Namen die beschreibenden Woerter machen. */
function nameWoerter(name) {
    return name
        .toLowerCase()
        .replace(/flag: /, "")
        .replace(/\(.*?\)/g, " ")
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 1 && !FUELLWORTER.has(w))
        .filter((w) => !/^[0-9]+$/.test(w));
}

function baueIndex() {
    const index = new Map();
    for (const { zeichen, name } of liesEmoji()) {
        const woerter = nameWoerter(name);
        if (!woerter.length) continue;
        for (const wort of woerter) {
            if (!index.has(wort)) index.set(wort, []);
            const treffer = index.get(wort);
            if (!treffer.includes(zeichen)) treffer.push(zeichen);
        }
    }
    return index;
}

/**
 * Ein Wort ist erst dann eindeutig, wenn nur ein Bild übrig bleibt.
 *
 * Bei ZWJ-Sequenzen gilt eine Reihenfolge: gibt es zu einem Wort auch eine
 * Darstellung ohne Verknüpfung, gewinnt die. `people` hat mit 👯 und 🧑‍🤝‍🧑
 * gleich zwei figurative Kandidaten neben 👥, und keiner davon ist allgemeiner
 * als die Gruppe selbst. Nur wo es gar keine einfache Form gibt – so wie bei
 * `family`, wo die Verbindung Teil der Bedeutung ist – bleibt die Sequenz
 * stehen.
 */
function eindeutig(index) {
    const raus = {};
    for (const [wort, kandidaten] of index) {
        let enge = kandidaten.filter((k) => !k.includes(ZWJ));
        if (!enge.length) enge = kandidaten;
        if (enge.length !== 1) continue;
        raus[wort] = enge[0];
    }
    return raus;
}

function schreibeTabelle(woerter) {
    const zeilen = Object.entries(woerter).sort(([a], [b]) => (a < b ? -1 : 1));
    const inhalt = [
        "/**",
        " * GENERIERTE DATEI. Nicht von Hand aendern.",
        " *",
        " * Erzeugt von `scripts/emoji-woerter.mjs` aus den Unicode-Daten dieser",
        " * Maschine. Das Skript ist die Quelle der Wahrheit, nicht diese Datei.",
        " *",
        " * Enthaelt nur Woerter, die zu genau einem Emoji gehoeren. Ein Wort mit",
        " * mehreren moeglichen Bildern fehlt hier bewusst: `lock` koennte ein",
        " * Schloss oder ein Sportgericht sein, und rateweise etwas davon zu",
        " * waehlen ist schlimmer als gar nichts.",
        " *",
        " * Nur der englische Teil des Alphabets – Emoji-Namen sind englisch. Fuer",
        " * deutsche Woerter ist `lib/kartenzeichen-semantik.ts` zustaendig.",
        " */",
        "",
        "export const EMOJI_WOERTER: Record<string, string> = {",
        ...zeilen.map(([w, e]) => `    ${JSON.stringify(w)}: ${JSON.stringify(e)},`),
        "};",
        "",
    ].join("\n");
    writeFileSync(ZIEL, inhalt, "utf8");
    return zeilen.length;
}

const index = baueIndex();
const woerter = eindeutig(index);

const argumente = process.argv.slice(2);
if (argumente.length) {
    for (const frage of argumente) {
        const wort = frage.toLowerCase().trim();
        const treffer = woerter[wort];
        const mehrdeutig = index.get(wort);
        if (treffer) {
            console.log(`${frage.padEnd(12)} ${treffer}  (eindeutig)`);
        } else if (mehrdeutig) {
            console.log(`${frage.padEnd(12)} ~  ${mehrdeutig.join(" ")}  (mehrdeutig, nicht übernommen)`);
        } else {
            console.log(`${frage.padEnd(12)} -  kein Treffer`);
        }
    }
} else if (argumente.includes("--schreiben")) {
    const anzahl = schreibeTabelle(woerter);
    console.log(`${anzahl} eindeutige Wörter geschrieben.`);
} else {
    console.log(`${Object.keys(woerter).length} eindeutige Wörter, ${index.size} insgesamt.`);
    console.log("Nichts geschrieben – mit --schreiben legt das Skript die Tabelle an.");
}