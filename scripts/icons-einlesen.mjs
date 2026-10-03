/**
 * Liest die benötigten Lucide-Icons ein und schreibt sie als TypeScript-Datei.
 *
 * **Wozu.** `lucide-static` liefert die Icons als einzelne `.svg`-Dateien. Der
 * Next-Build kann sie nicht als Markup importieren — ohne Zusatzkonfiguration
 * wird eine SVG-Datei im webpack-Setup als *Asset* behandelt und landet als
 * Dateiname im `<img>`. Damit gingen zwei Dinge verloren, die hier zählen:
 * `currentColor` (das Zeichen muss die Sprachfarbe erben) und das Server-
 * Rendering (die Karte soll ohne Nachladen ein Icon haben).
 *
 * Deshalb wird der innere Markup-Text der Icons hier einmalig in eine
 * TypeScript-Datei geschrieben. Sie ist eingecheckt, damit ein Build nichts
 * voraussetzt außer `node_modules`. Neu erzeugen nur, wenn sich die Tabelle
 * oder das Paket ändert.
 *
 * **Aufruf:** `node --import tsx scripts/icons-einlesen.mjs [--schreiben]`
 *
 * Ohne `--schreiben` prüft das Skript nur und sagt, was sich ändern würde.
 * Das ist Absicht: eine Generator-Datei, die sich beim Blättern im Repository
 * selbst überschreibt, ist eine Fehlerquelle mit Extra-Schritten.
 *
 * **Lizenz.** Lucide steht unter ISC. Die Lizenz verlangt, dass der
 * Copyright-Hinweis mitgeliefert wird, also steht er im Kopf der erzeugten
 * Datei. Lucide ist keine verpflichtende Namensnennung — anders als
 * FontAwesome Free unter CC BY 4.0.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { alleWortIcon } from "../lib/kartenzeichen-semantik.ts";

const ZIEL = "lib/kartenzeichen-svg.generated.ts";
const QUELLE = "node_modules/lucide-static/icons";
const PAKET = JSON.parse(readFileSync("node_modules/lucide-static/package.json", "utf8"));
const LIZENZ = readFileSync("node_modules/lucide-static/LICENSE", "utf8").trim();

/** `house` → den inneren Markup-Text, ohne den Lizenzkommentar. */
function markup(name) {
    const roh = readFileSync(`${QUELLE}/${name}.svg`, "utf8");
    const ohneKommentar = roh.replace(/<!--[\s\S]*?-->\s*/g, "");
    const innen = ohneKommentar.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
    // Die Lucide-Dateien sind über mehrere Zeilen umgebrochen; für die
    // TypeScript-Datei wird das Markup auf eine Zeite gezogen.
    return innen.replace(/\s*\n\s*/g, "").trim();
}

const namen = [...new Set(Object.values(alleWortIcon()))].sort();
const teile = [
    "/**",
    " * Lucide-Icons als Markup. Erzeugt – bitte nicht von Hand ändern.",
    " *",
    ` * Quelle: lucide-static ${PAKET.version} (\`${QUELLE}\`)`,
    " * Neu erzeugen: `node --import tsx scripts/icons-einlesen.mjs --schreiben`",
    " *",
    " * Die Lizenz der Icons muss mitgeliefert werden, deshalb steht sie hier",
    " * vollständig und nicht nur als Verweis.",
    " *",
    ...LIZENZ.split("\n").map((z) => ` * ${z}`.trimEnd()),
    " */",
    "",
    '/** Markup-Rumpf eines Lucide-Icons, passend für ein 24er-`viewBox`. */',
    "export const ICON_RUMPF: Record<string, string> = {",
];
for (const name of namen) {
    teile.push(`    ${JSON.stringify(name)}: ${JSON.stringify(markup(name))},`);
}
teile.push("};", "");

const neu = teile.join("\n");
// Beim ersten Lauf gibt es die Datei noch nicht, das ist kein Fehler.
const alt = existsSync(ZIEL) ? readFileSync(ZIEL, "utf8") : "";

if (neu === alt) {
    console.log(`${ZIEL} ist aktuell (${namen.length} Icons).`);
} else if (process.argv.includes("--schreiben")) {
    writeFileSync(ZIEL, neu, "utf8");
    console.log(`${ZIEL} geschrieben: ${namen.length} Icons, ${neu.length} Zeichen.`);
} else {
    console.log(`${ZIEL} waere zu aendern. Noch einmal mit --schreiben.`);
    process.exitCode = 1;
}