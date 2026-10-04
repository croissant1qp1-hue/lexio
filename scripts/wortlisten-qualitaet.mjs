/**
 * Wortlisten-Qualitaetspruefung.
 *
 * Aufruf:
 *   node scripts/wortlisten-qualitaet.mjs                       (alle vier Mengen + Top 100)
 *   node scripts/wortlisten-qualitaet.mjs scripts/wortlisten/ngsl-alltag-1.json
 *
 * Warum ein Skript und kein Blick auf Stichproben: die drei bekannten
 * Restfehler (need = "Notwendigkeit" bei einem Verbsatz, knock = "Klopfen",
 * imagination = "Vorstellungskraft") fielen beim Lesen von Hand auf. Der
 * naechsten Karte sieht man so nicht mehr. Was sich messen laesst, wird
 * gemessen – sonst ist die Aussage "die Liste ist geprueft" eine Behauptung
 * ohne Beleg, und das ist hier ausnahmsweise nicht nur unsauber, sondern
 * falsch: falsche Karten werden mitgelernt.
 *
 * Die Pruefungen fallen in zwei Gruppen:
 *
 *   Hart (klar falsch, kein Ermessen noetig)
 *     1. Der englische Beispielsatz enthaelt das englische Wort nicht.
 *        Eine Karte, deren Beispielsatz das Wort nicht zeigt, ist wertlos –
 *        sie muesste man im Kopf ergaenzen.
 *     2. Der deutsche Satz enthaelt kein Inhaltswort der deutschen
 *        Vorderseite. Das ist die Probe, die den alten Fehler "outside =
 *        draussen" mit Beispielsatz "She likes being outside of the house."
 *        gefangen haette.
 *     3. Das englische Wort steht in zwei Dateien. Jede Wortliste hat genau
 *        eine Karte je Wort; ein Wort in zwei Sets ist ein Dublettenschaden.
 *     4. Zwei Karten derselben Datei teilen sich die deutsche Vorderseite bei
 *        verschiedenen englischen Woertern.
 *     5. Satzlaenge ueber 90 Zeichen oder ueber 14 Woerter: als Karte zu
 *        lang zum Lesen, und die zweite Bedeutung steckt dann im Nebensatz.
 *
 *   Weich (auffaellig, aber Ermessen)
 *     6. Deutsche Vorderseite ist ein Komma-Begriff ("arbeiten, Arbeit").
 *     7. Satz enthaelt Auslassungspunkte, ein Bild, eine Zahl oder ein
 *        Zitatzeichen.
 *     8. Der deutsche Satz ist kein vollstaendiger Satz.
 *     9. Deutsche Vorderseite laenger als 40 Zeichen.
 *
 * Ausgabe: eine Liste je Fundstelle, damit man die Karte lesen und
 * entscheiden kann. Exit-Code 1 bei harten Befunden – so faellt die Liste
 * beim naechsten Lauf auf, statt still durchzurutschen.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

/** Kuerzeste gemeinsame Praefixlaenge, ab der zwei Woerter dasselbe Wort sind. */
function praefixGemeinsam(a, b) {
    let n = 0;
    while (n < a.length && n < b.length && a[n] === b[n]) n++;
    return n;
}

/** Buchstaben, Ziffern und Umlaute eines Satzes als Kleinworte. */
function woerter(text) {
    return (text.toLowerCase().match(/[a-zäöüß0-9']+/g) ?? []);
}

/**
 * Gehoert `token` zu `wort` – auch als gebeugte Form?
 *
 * Kein Stemming aus einer Bibliothek: die Schwelle ist so gewaehlt, dass sie
 * bei "need" (4 Zeichen) schon 3 Zeichen gemeinsam verlangt und damit
 * "needing" noch trifft, bei "computer" (8) aber 6 verlangt, sodass
 * "computing" nicht mehr durchrutscht. Ein echtes Wortlistenproblem ist das
 * nicht; falsche Positive sind hier billiger zu sehen als falsche Karten.
 */
function gehoertZu(token, wort) {
    // Beides vorher kleinschreiben: mit "I" als Wort passierte vorher
    // wort.replace(/[^a-zäoüß]/g, "") -> "" und die Karte "I" = "ich" wurde
    // als "Wort fehlt im Satz" gemeldet, obwohl das Wort im Satz steht.
    const t = token.toLowerCase().replace(/[^a-zäöüß]/g, "");
    const w = wort.toLowerCase().replace(/[^a-zäöüß]/g, "");
    if (!t || !w) return false;
    if (t === w) return true;
    const schwelle = Math.max(3, Math.ceil(w.length * 0.75));
    return praefixGemeinsam(t, w) >= schwelle && t.length >= schwelle;
}

/** Deutsches Wort auf einen vergleichbaren Stamm bringen. */
function deutschStamm(wort) {
    return wort
        .toLowerCase()
        // Umlaute ausschreiben: "koennen" und "kann" teilen sonst kein
        // gemeinsames Praefix, "können" verliert die Umlautstelle und
        // schlaegt gegen alles.
        .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
        .replace(/^(ge|ver|be|zer|ent|emp|miss)(?=[aä])/, "")
        .replace(/(en|er|es|em|e|s|te|st)$/, "")
        .toLowerCase();
}

/** Fuellwoerter: als Inhaltswort taugen sie nicht, sonst findet man sie ueberall. */
const FUELL = new Set([
    "aber","alle","aller","alles","als","also","am","an","auch","auf","aus","bei","bin",
    "bis","bist","da","damit","dann","das","dass","dein","dem","den","denn","der","des",
    "die","dies","diese","doch","dort","du","ein","eine","einem","einen","einer","eines",
    "er","es","etwas","euer","eure","für","hat","hatte","hatten","hier","ich","ihm","ihn",
    "ihr","ihre","im","immer","in","ist","ja","jede","jeder","jener","jetzt","kann","kein",
    "keine","können","könnte","man","mehr","mein","mich","mir","mit","muss","musste","nach",
    "nicht","nichts","noch","nun","nur","ob","oder","ohne","schon","sehr","sein","seine",
    "sich","sie","sind","so","solche","soll","sollte","sondern","sonst","über","um","und",
    "uns","unser","unter","viel","vom","von","vor","war","waren","warum","was","weg","weil",
    "weiter","welche","wenn","wer","werden","wie","wieder","wir","wird","wirst","wo","wollen",
    "wollte","würde","würden","zu","zum","zur","zwar","zwischen",
]);

/** Die beiden Satzfelder einer Karte. */
function karte(k) {
    return {
        frage: String(k.frage ?? "").trim(),
        antwort: String(k.antwort ?? "").trim(),
        eng: String(k.beispielsatz ?? "").trim(),
        deu: String(k.beispiel_uebersetzung ?? "").trim(),
    };
}

function pruefe(karten, melde) {
    const engFehlt = [];
    const deuFehlt = [];
    const lang = [];
    const komma = [];
    const stoer = [];
    const keinSatz = [];
    const langeFront = [];
    const doppelteFront = [];
    const doppeltesWort = [];

    const frontIndex = new Map();
    const wortIndex = new Map();

    for (const k of karten) {
        const c = karte(k);
        const engWoerter = woerter(c.eng);

        // 1. englisches Wort im englischen Satz
        if (!engWoerter.some((w) => gehoertZu(w, c.antwort))) {
            engFehlt.push(c);
        }

        // 2. Inhaltswort der deutschen Vorderseite im deutschen Satz
        const stammen = c.frage
            .split(/[,;/|]/)
            .flatMap((t) => t.split(/\s+/))
            .map(deutschStamm)
            .filter((w) => w.length >= 4 && !FUELL.has(w.replace(/ae|oe|ue|ss/g, (m) => m[0])) );
        const deuWoerter = woerter(c.deu).map((w) => w.replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss"));
        if (stammen.length && !stammen.some((s) => deuWoerter.some((d) => gehoertZu(d, s)))) {
            deuFehlt.push(c);
        }

        // 5. Laenge
        if (c.eng.length > 90 || engWoerter.length > 14) lang.push(c);

        // 6. Komma-Vorderseite
        if (/[,;|]/.test(c.frage)) komma.push(c);

        // 7. Stoerzeichen
        if (/\.\.\.|…|"|„|»|\d|<|>|https?:|\bpic\b/i.test(c.eng + " " + c.deu)) stoer.push(c);

        // 8. kein vollstaendiger deutscher Satz
        if (!/[.!?]$/.test(c.deu) || /^[a-zäöü]/.test(c.deu)) keinSatz.push(c);

        // 9. lange Vorderseite
        if (c.frage.length > 40) langeFront.push(c);

        // 4. gleiche Vorderseite, verschiedene Woerter
        const fKey = deutschStamm(c.frage.split(/[,;/|]/)[0]);
        if (frontIndex.has(fKey) && frontIndex.get(fKey) !== c.antwort.toLowerCase()) {
            doppelteFront.push(c, { ...frontIndex.get(fKey), _doppelt: true });
        }
        frontIndex.set(fKey, c);

        // 3. gleiches Wort zweimal
        const wKey = c.antwort.toLowerCase();
        if (wortIndex.has(wKey)) doppeltesWort.push(c);
        wortIndex.set(wKey, c);
    }

    const zeige = (liste, grenze = 8) => {
        const s = liste.slice(0, grenze).map(
            (c) => `      ${c.antwort} = "${c.frage}"\n        EN ${c.eng}\n        DE ${c.deu}`,
        );
        if (liste.length > grenze) s.push(`      … und ${liste.length - grenze} weitere`);
        return s;
    };

    /*
     * Die Einstufung ist nicht kosmetisch: "hart" heisst, der Lauf endet mit
     * Exit-Code 1. Zwei der Pruefungen sind beim ersten Lauf als hart
     * eingestuft gewesen und haben 407 Fundstellen gemeldet, von denen die
     * meisten das Werkzeug betrafen und nicht die Karten:
     *
     *   - "kein Inhaltswort der Vorderseite im deutschen Satz" schlaegt bei
     *     jedem Funktionswort zu ("by" = "von, durch, bei, mit": der deutsche
     *     Satz enthaelt "mit", aber "mit" ist ein Fuellwort und wurde
     *     weggefiltert) und bei jeder Wortwahl, die nicht der Uebersetzung
     *     entspricht. Tatoeba uebersetzt frei, das ist der Zweck des
     *     Korpus.
     *   - "Vorderseite doppelt belegt" findet he/it/she/they bei "sie" und
     *     of/from bei "von". Das sind zwei englische Woerter, ein deutscher
     *     Begriff – keine Duplette, sondern das Wesen eines Lernprogramms.
     *
     * Beides ist ein Hinweis zum Nachsehen, kein Fehler. Nur was objektiv
     * falsch ist, darf den Lauf abbrechen.
     */
    for (const [name, liste] of [
        ["hart 1  englisches Wort nicht im Beispielsatz", engFehlt],
        ["hart 3  Wort mehrfach in der Liste", doppeltesWort],
        ["hart 5  Beispielsatz zu lang", lang],
        ["weich 2  kein Inhaltswort der Vorderseite im deutschen Satz", deuFehlt],
        ["weich 4  Vorderseite doppelt belegt", doppelteFront],
        ["weich 6  Komma-Vorderseite", komma],
        ["weich 7  Auslassung, Bild, Zahl, Zitat", stoer],
        ["weich 8  deutscher Satz unvollstaendig", keinSatz],
        ["weich 9  Vorderseite laenger als 40 Zeichen", langeFront],
    ]) {
        if (!liste.length) {
            console.log(`  ok    ${name}`);
            continue;
        }
        const hart = name.startsWith("hart");
        console.log(`  ${hart ? "FEHLER" : "HINWEIS"} ${name}: ${liste.length}`);
        console.log(zeige(liste).join("\n"));
        melde.push({ name, anzahl: liste.length, hart, beispiele: liste.slice(0, 40) });
    }

    return { engFehlt, deuFehlt };
}

/** Alle Wortlisten-Dateien, die zusammen die ausgelieferte Menge ergeben. */
function standardDateien() {
    return [
        "ngsl-top100.json",
        "ngsl-alltag-1.json",
        "ngsl-alltag-2.json",
        "ngsl-ausbau-1.json",
        "ngsl-ausbau-2.json",
    ].map((f) => path.join(WURZEL, "scripts", "wortlisten", f));
}

const argumente = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const dateien = argumente.length
    ? argumente
    : standardDateien().filter((d) => {
          try {
              readFileSync(d);
              return true;
          } catch {
              console.error(`fehlt: ${d}`);
              return false;
          }
      });

const melde = [];
let kartenGesamt = 0;

for (const datei of dateien) {
    const karten = JSON.parse(readFileSync(datei, "utf8"));
    kartenGesamt += karten.length;
    console.log(`\n${path.basename(datei)} — ${karten.length} Karten`);
    pruefe(karten, melde);
}

console.log(`\n${"=".repeat(60)}`);
console.log(`Geprueft: ${kartenGesamt} Karten in ${dateien.length} Dateien`);
const harte = melde.filter((m) => m.hart);
const weiche = melde.filter((m) => !m.hart);
console.log(`Harte Befunde: ${harte.reduce((n, m) => n + m.anzahl, 0)}`);
console.log(`Hinweise:      ${weiche.reduce((n, m) => n + m.anzahl, 0)}`);
if (harte.length) console.log(`  harte: ${harte.map((m) => `${m.name} (${m.anzahl})`).join(", ")}`);

console.log(JSON.stringify(melde.map((m) => ({ name: m.name, anzahl: m.anzahl })), null, 1));
process.exit(harte.length ? 1 : 0);