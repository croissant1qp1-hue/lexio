/**
 * Findet versionierte Dateien, auf die niemand verweist.
 *
 *   node scripts/toten-code.mjs
 *   npm run toter-code
 *
 * Warum es das als Skript gibt und nicht als einmaliger Befehl: Der Scan für
 * Punkt 11 am 2026-10-04 fand "nichts" — und lag falsch. Zwei tote CSS-Dateien
 * mit Umlauten im Namen waren übersehen, beide in `sprache-auswählen`. Der
 * Befehl damals stützte sich auf `git ls-files`, und git maskiert Pfade mit
 * Nicht-ASCII-Zeichen als `\303\244`. Gesucht wurde nach dem unmaskierten
 * Namen, gefunden wurde die maskierte Form. Ein Ergebnis, das seine eigenen
 * Eingabedateien nicht sieht, ist kein Ergebnis.
 *
 * Also drei Regeln, die dieser Scan einhält:
 *
 *   1. `git ls-files -z`, damit die Namen roh und mit Trennzeichen-NUL kommen.
 *   2. Gesucht wird nach dem Basisnamen ohne Endung, nicht nach dem
 *      vollständigen Pfad. Ein CSS-Modul wird über `./name.module.css`
 *      importiert, nie über seinen Ordner.
 *   3. Was Next.js per Konvention auflöst, wird nicht als "unreferenziert"
 *      gemeldet — `page.tsx`, `layout.tsx`, `route.ts` und Freunde sind
 *      referenziert, ohne dass irgendwo ihr Name steht.
 *
 * Das Skript meldet Verdächtige und beendet sich mit 1, wenn es welche gibt.
 * Es beweist nicht, dass eine Datei tot ist — es beweist, dass niemand ihren
 * Namen schreibt. Die Entscheidung trifft ein Mensch, die Liste ist nur das
 * Argument dafür.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const WURZEL = join(import.meta.dirname, "..");

/** Verzeichnisse, die Next oder npm per Konvention auflöst. */
const KONVENTION = [
  /^app\/.*\/(page|layout|route|template|default|error|global-error|not-found|loading)\.(t|j)sx?$/,
  /^app\/.*\/(page|layout|route)\.module\.css$/,
  /^(middleware|proxy|instrumentation)\.(t|j)sx?$/,
  /^app\/globals\.css$/,
];

/** Dateien, die niemand zu importieren braucht. */
const AUSGENOMMEN = [
  /^(public|legacy|node_modules|\.next|\.vscode|\.github)\//,
  /\.md$/,
  /^(package(-lock)?\.json|tsconfig\.json|next\.config\.[cm]?[jt]s|eslint\.config\.[cm]?[jt]s|postcss\.config\.[cm]?[jt]s|\.gitignore|\.env\.example)$/,
  /^tests\//,
];

/**
 * Daten, keine Code-Dateien.
 *
 * `scripts/wortlisten/` enthaelt Datenkoerper: die fuenf Teilmengen als `.json`
 * (die `wortlisten-qualitaet.mjs` und `wortlisten-importieren.mjs` beim Namen
 * aufrufen), dazu `.csv`-Exporte und `ngsl-voll` als Archiv. Ein `.csv`-Export
 * wird nie von einer Datei referenziert — er existiert zum Anschauen und
 * Weitergeben. Das gehoert getrennt gemeldet: interessant, aber kein Befund,
 * der ein Skript stoppen sollte.
 */
const DATEN = [/^scripts\/wortlisten\//];

/** Wird von npm aufgerufen, nicht von einer anderen Datei. */
const WERTE_VON_NPM = new Set();

function alleDateien() {
  // -z: Rohdaten mit NUL-Trenner. Ohne das maskiert git Nicht-ASCII.
  const roh = execFileSync("git", ["ls-files", "-z"], {
    cwd: WURZEL,
    maxBuffer: 64 * 1024 * 1024,
    encoding: "utf8",
  });
  return roh.split("\0").filter(Boolean);
}

/** Dateien, in denen überhaupt nach Verweisen gesucht wird. */
function suchkoerper(dateien) {
  const text = [];
  for (const d of dateien) {
    if (/^(public|legacy|node_modules|\.next)\//.test(d)) continue;
    if (/\.(png|jpe?g|gif|svg|webp|ico|woff2?|ttf|eot|zip|pdf)$/i.test(d)) continue;
    try {
      if (statSync(join(WURZEL, d)).size > 2 * 1024 * 1024) continue;
    } catch {
      continue; // geloescht, aber noch im Index
    }
    try {
      text.push(readFileSync(join(WURZEL, d), "utf8"));
    } catch {
      // binaer oder unlesbar: kein Fundort, aber auch kein Kandidat
    }
  }
  return text;
}

function ausgenommen(datei) {
  return AUSGENOMMEN.some((m) => m.test(datei)) || KONVENTION.some((m) => m.test(datei));
}

/** Der Name, unter dem andere Dateien dieses Modul importieren. */
function suchbegriff(datei) {
  const name = datei.split("/").pop();
  return name.replace(/\.(module\.)?\.[a-z]+$/i, "").replace(/\.(t|j)sx?$/i, "");
}

const ok = (t) => `\x1b[32m${t}\x1b[0m`;
const schlecht = (t) => `\x1b[31m${t}\x1b[0m`;
const gelb = (t) => `\x1b[33m${t}\x1b[0m`;

const dateien = alleDateien();
const koerper = suchkoerper(dateien);

// npm-Skripte zaehlen als Verweis: sie werden ueber package.json aufgerufen,
// nicht ueber einen Import.
try {
  const pkg = JSON.parse(readFileSync(join(WURZEL, "package.json"), "utf8"));
  for (const wert of Object.values(pkg.scripts ?? {})) {
    for (const teil of wert.split(/\s+/)) WERTE_VON_NPM.add(teil);
  }
} catch {
  // ohne package.json gibt es auch keine npm-Skripte
}

const verdächtig = [];
const loseDaten = [];

for (const datei of dateien) {
  if (ausgenommen(datei)) continue;
  if (WERTE_VON_NPM.has(datei)) continue;

  const begriff = suchbegriff(datei);
  if (!begriff || begriff.length < 4) continue; // zu kurz, Raten bringt nichts

  const gefunden = koerper.some((inhalt) => inhalt.includes(begriff));
  if (gefunden) continue;

  if (DATEN.some((m) => m.test(datei))) loseDaten.push(datei);
  else verdächtig.push(datei);
}

console.log(`\n${dateien.length} versionierte Dateien geprüft.\n`);

if (loseDaten.length > 0) {
  console.log(gelb(`${loseDaten.length} Daten Datei(en) ohne Verweis — kein Befund:`));
  for (const d of loseDaten) console.log(`  ${d}`);
  console.log(gelb("  Werden von Hand geladen oder sind Exporte. Kurz prüfen, nichts Automatisches.\n"));
}

if (verdächtig.length === 0) {
  console.log(ok("Keine Datei ohne Verweis.\n"));
  process.exit(0);
}

console.log(schlecht(`${verdächtig.length} Datei(en) ohne Verweis:`));
for (const d of verdächtig) console.log(`  ${d}`);
console.log(
  gelb(
    "\n  Das heisst: niemand schreibt diesen Namen. Ob die Datei wirklich tot\n" +
      "  ist, bleibt eine Entscheidung fuer einen Menschen — eine unbenutzte\n" +
      "  Seite mit Namen ist kein toter Code, sie ist nur unauffindbar.",
  ),
);
process.exit(1);
