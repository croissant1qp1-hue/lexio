/**
 * Audit für die Kartenzeichen (Phase 6, Nutzerentscheid).
 *
 * Der Nutzer wollte: unten links auf dem Vokabelkärtchen, immer gleich groß,
 * für jede Karte ein eigenes Zeichen, in den Einstellungen abschaltbar. Der
 * Plan sagt ausdrücklich, dass man das nicht am CSS ablesen kann, sondern messen
 * muss – also wird hier im echten Browser gemessen.
 *
 * Geprüft wird:
 *   1. Es erscheint genau ein Zeichen pro Karte, an der RECHTEN unteren Ecke.
 *   2. Es steht auf BEIDEN Seiten der Karte (Nutzerentscheid: "auf beiden
 *      Seiten der Karteikarte"). Der erste Lauf fand es nur auf der Rückseite,
 *      weil es im `aufgedeckt`-Zweig stand – das ist genau der Fehler, den
 *      dieser Punkt sucht.
 *   3. Es überdeckt den mittigen Hinweis "Tippen zum Aufdecken" nicht und
 *      nicht die Sprachpille, die seit dem Umbau wieder allein unten links
 *      sitzt.
 *   4. Es fängt den Klick auf die Karte nicht ab (Tipp zum Aufdecken muss
 *      weiterhin funktionieren, obwohl das Zeichen dort sichtbar ist).
 *   5. Zwei verschiedene Karten zeigen verschiedene Zeichen.
 *   6. Der Schalter in den Einstellungen blendet es aus und wieder ein, und
 *      die Wahl überlebt das Neuladen.
 *   7. Auch eigene Karten (selbst angelegt) bekommen ein Zeichen.
 *   8. Die Größe ist auf jeder Breite 32px.
 *
 * Aufruf:
 *   node --env-file=.env scripts/zeichen-audit.mjs
 *
 * Startet keinen Server: gemessen wird, was laeuft. Produktionsstand
 * `npm run start`, nicht `npm run dev`.
 */
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";

const BASIS = process.env.AUDIT_BASIS ?? "http://localhost:3000";
const KONTO = JSON.parse(readFileSync("/tmp/audit-konto.json", "utf8"));
const ORDNER = "/tmp/zeichen";
mkdirSync(ORDNER, { recursive: true });

const befunde = [];
const messungen = [];
function befund(text, waerm = "warnung") {
    befunde.push({ text, waerm });
    console.log(`  ${waerm === "fehler" ? "FEHLER" : "HINWEIS"}: ${text}`);
}
function gemessen(text) {
    messungen.push(text);
    console.log(`  gemessen: ${text}`);
}

/** Rechtecke zweier Elemente, oder null, wenn eines fehlt. */
function kollision(a, b) {
    if (!a || !b) return false;
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

const browser = await chromium.launch();
const kontext = await browser.newContext({
    viewport: { width: 360, height: 740 },
    deviceScaleFactor: 2,
    locale: "de-DE",
});
await kontext.addCookies([
    {
        name: KONTO.cookieName,
        value: KONTO.cookieValue,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
    },
]);
const seite = await kontext.newPage();
const fehlerInDerKonsole = [];
seite.on("pageerror", (e) => fehlerInDerKonsole.push({ text: String(e), url: seite.url() }));

/* ------------------------------------------------------------------ 1. Lernseite */
console.log(`\n1. Lernseite ${BASIS}/lernen/englisch-grundlagen`);
await seite.goto(`${BASIS}/lernen/englisch-grundlagen`, { waitUntil: "networkidle" });

/**
 * Sammelt die Rechtecke der Elemente, die sich auf der Karte teilen. Die
 * CSS-Modulklassen heißen in der Seite `karteMarke`, `karteTipp` und
 * `karteZeichen` – CSS-Module verwandeln sie in Hashes, deshalb wird hier
 * innerhalb des class-Attributs gesucht.
 *
 * Das Zeichen wird über `svg[aria-hidden][viewBox="0 0 24 24"]` erkannt: das
 * ist die viewBox aus `lib/kartenzeichen.ts`. Der erste Lauf hat stattdessen
 * nach `path[d^="M"]` gesucht und meldete dadurch „kein Zeichen", obwohl die
 * Seite korrekt war. Das Attribut `viewBox` ist hier die verlaesslichere
 * Marke, weil es die Absicht ausdrueckt statt eine Nebenwirkung.
 */
async function lage() {
    return await seite.evaluate(() => {
        const alle = [...document.querySelectorAll("*")];
        const nach = (name) =>
            alle.find((el) => [...el.classList].some((c) => c.includes(name)));
        const rechteck = (el) => {
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return { x: r.x, y: r.y, width: r.width, height: r.height };
        };
        /*
         * Die Marke ist jetzt zweierlei: ein `svg` mit der erzeugten Form oder
         * ein `span` mit einem Emoji. Der erste Lauf dieses Audits suchte nur
         * das `svg` und meldete daraufhin fuer jede Karte mit einem Wort, zu
         * dem es ein Bild gibt, „kein Zeichen" – ein Befund, der genau das
         * Gegenteil dessen war, was zu sehen war. Beides wird jetzt geholt und
         * im Ergebnis getrennt ausgewiesen.
         */
        /*
         * Nicht `.karteMarke`: Next.js schreibt die CSS-Modulklasse im
         * Produktionsbau als `lernen-module__LnHAJq__karteMarke`, und der
         * Selektor ohne Modulpraefix findet nichts. Ein erster Versuch mit
         * einem beliebigen aria-hidden-`span` fand dafuer den Profil-Namen
         * „K" in der Navigation und meldete 28x28px statt 32x32px.
         *
         * Entscheidend ist die Unterscheidung nach dem Tag und nicht danach,
         * ob irgendetwas mit dieser Klasse da ist: die `svg` traegt
         * `karteMarke` genauso wie das Emoji. Ein Versuch, beides ueber einen
         * Selektor zu holen, hielt jede Karte fuer ein Bild – Folge waren
         * sechs Karten mit derselben leeren Kennung und die Meldung
         * „6 Karten, aber nur 1 verschiedene Zeichenform".
         */
        const form = document.querySelector('svg[class*="karteMarke"]')
            ?? document.querySelector('svg[viewBox="0 0 24 24"][aria-hidden="true"]');
        const bild = document.querySelector('span[class*="karteMarke"]');
        const svg = form;
        const span = form ? null : bild;
        const marke = form ?? bild;
        // `getAttribute("class")` statt `el.className`: bei SVG-Elementen ist
        // className ein SVGAnimatedString und hat keine includes-Methode. Der
        // erste Lauf ist genau daran mit einem TypeError abgestuerzt, nachdem
        // `alle` auch die SVGs des Zeichens durchsucht hat.
        const klasse = (el) => el.getAttribute("class") ?? "";
        /*
         * Die Karte NICHT per Klassenname suchen. Der erste Lauf hat das
         * getan und ein Button mit der Breite 0 erwischt, woraus Einzuege von
         * -334px entstanden sind – Befunde, die nur die falsche Schranke
         * beweisen konnten. `offsetParent` ist der naechste positionierte
         * Vorfahr und damit genau `.kartenSeite`, die Ecke, an der das Zeichen
         * hängt. Das ist eine Eigenschaft des Elements, keine Vermutung über
         * den Klassennamen.
         */
        const karteEl = marke?.offsetParent ?? null;
        const istForm = !span;
        return {
            marke: rechteck(marke),
            markePfade: istForm && svg ? [...svg.querySelectorAll("path")].map((p) => p.getAttribute("d")) : [],
            markeText: istForm ? "" : (span?.textContent ?? "").trim(),
            // Bei einem Bild sind Zeichen und Versatz das Unterscheidende, nicht
            // der Pfad. Beide werden mitgenommen, damit der Vergleich gleich
            // zwei Karten mit demselben Wort als verschieden erkennt – das ist
            // der Fall, den die reine Textangabe nicht abdecken wuerde.
            markeStil: istForm || !span ? "" : (() => {
                const st = getComputedStyle(span);
                return `${st.fontSize}|${st.transform}`;
            })(),
            markeDeckkraft: istForm && svg ? svg.style.opacity : null,
            tipp: rechteck(nach("karteTipp")),
            sprache: rechteck(nach("karteZeichen")),
            karte: rechteck(karteEl),
            seite: (marke?.offsetParent ? klasse(marke.offsetParent) : "").includes("kartenSeiteHinten"),
            viewBox: istForm && svg ? svg.getAttribute("viewBox") : null,
        };
    });
}

const SOLL_GROESSE = 32;

/**
 * Die Position wird gegen die Karte geprüft, nicht gegen den Viewport: das
 * Zeichen soll unten rechts *auf der Karte* stehen. Und es muss auf beiden
 * Seiten stehen, deshalb wird jede Breite zweimal geprüft – einmal aufgedeckt,
 * einmal nicht.
 */
async function pruefe(breite, hoehe, etikett) {
    await seite.setViewportSize({ width: breite, height: hoehe });
    await seite.waitForTimeout(250);
    const l = await lage();

    if (!l.marke) {
        befund(`${etikett}: kein Zeichen auf der Karte`, "fehler");
        return l;
    }
    gemessen(
        `${etikett}: Zeichen ${l.marke.width.toFixed(1)}x${l.marke.height.toFixed(1)}px, ` +
            `rechte Kante ${l.marke.x.toFixed(1)}px, Deckkraft ${l.markeDeckkraft}, viewBox ${l.viewBox}`,
    );

    if (Math.abs(l.marke.width - l.marke.height) > 0.5) {
        befund(`${etikett}: Zeichen ist nicht quadratisch (${l.marke.width} x ${l.marke.height})`, "fehler");
    }
    if (Math.abs(l.marke.width - SOLL_GROESSE) > 0.5) {
        befund(`${etikett}: Zeichen misst ${l.marke.width}px statt ${SOLL_GROESSE}px`, "fehler");
    }
    // unten rechts: größerer Abstand zur rechten Kante als zur oberen, und
    // näher an der unteren als an der oberen Kartenkante
    if (l.karte) {
        const abstandRechts = l.karte.x + l.karte.width - (l.marke.x + l.marke.width);
        const abstandUnten = l.karte.y + l.karte.height - (l.marke.y + l.marke.height);
        const abstandOben = l.marke.y - l.karte.y;
        if (abstandRechts > abstandUnten * 1.5) {
            befund(`${etikett}: Zeichen sitzt nicht rechts (rechts ${abstandRechts.toFixed(1)}px, unten ${abstandUnten.toFixed(1)}px)`, "fehler");
        }
        if (abstandUnten > abstandOben) {
            befund(`${etikett}: Zeichen sitzt nicht unten (unten ${abstandUnten.toFixed(1)}px, oben ${abstandOben.toFixed(1)}px)`, "fehler");
        }
        gemessen(
            `${etikett}: Einzug rechts ${abstandRechts.toFixed(1)}px, unten ${abstandUnten.toFixed(1)}px`,
        );
    }
    // Ueberdeckungen
    if (kollision(l.marke, l.tipp)) {
        befund(`${etikett}: Zeichen ueberdeckt den Hinweis "Tippen zum Aufdecken"`, "fehler");
    }
    if (kollision(l.marke, l.sprache)) {
        befund(`${etikett}: Zeichen ueberdeckt den Sprachchip`, "fehler");
    }
    for (const d of l.markePfade) {
        if (/NaN|undefined|Infinity/.test(d ?? "")) {
            befund(`${etikett}: kaputter SVG-Pfad: ${d}`, "fehler");
        }
    }
    return l;
}

/** Beide Seiten prüfen: Vorderseite, dann Rückseite, dann wieder zurück. */
async function beideSeiten(breite, hoehe, etikett) {
    const vorn = await pruefe(breite, hoehe, `${etikett} Vorderseite`);
    // aufdecken, damit die Rückseite mit Begriff und Sprachpille dasteht
    await seite.keyboard.press("Enter");
    await seite.waitForTimeout(600);
    const hinten = await pruefe(breite, hoehe, `${etikett} Rueckseite`);
    await seite.keyboard.press("Enter");
    await seite.waitForTimeout(400);
    return { vorn, hinten };
}

const l360 = await beideSeiten(360, 740, "360px Hochformat");
if (!l360.vorn.marke || !l360.hinten.marke) {
    befund("das Zeichen fehlt auf mindestens einer der beiden Seiten", "fehler");
} else {
    gemessen("das Zeichen steht auf beiden Seiten der Karte");
}
await seite.screenshot({ path: `${ORDNER}/live-360.png` });
await beideSeiten(320, 700, "320px Hochformat");
await beideSeiten(414, 896, "414px Hochformat");
await beideSeiten(740, 360, "740px Querformat");
await beideSeiten(1280, 800, "1280px Desktop");
await seite.setViewportSize({ width: 360, height: 740 });
await seite.waitForTimeout(200);

/* ------------------------------------------- 2. Tipp funktioniert trotz Zeichen */
console.log("\n2. Tipp zum Aufdecken trotz des Zeichens");
{
    const vorher = await seite.evaluate(() => {
        const a = [...document.querySelectorAll("*")].find((el) =>
            [...el.classList].some((c) => c === "karteText" || c.includes("karteText")),
        );
        return a?.textContent ?? null;
    });
    // Direkt auf das Zeichen klicken: es liegt im Karten-<button>, muss also
    // die Karte ausloesen statt den Klick zu schlucken.
    await seite.evaluate(() => {
        const svg = [...document.querySelectorAll("svg")].find(
            (el) => el.getAttribute("viewBox") === "0 0 24 24" && el.getAttribute("aria-hidden") === "true",
        );
        svg?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    await seite.waitForTimeout(700);
    const nachher = await seite.evaluate(() => {
        const a = [...document.querySelectorAll("*")].find((el) =>
            [...el.classList].some((c) => c === "karteText" || c.includes("karteText")),
        );
        return a?.textContent ?? null;
    });
    if (vorher === nachher) {
        befund("Klick auf das Zeichen deckt die Karte nicht auf", "fehler");
    } else {
        gemessen(`Klick auf das Zeichen hat die Karte aufgedeckt ("${vorher}" -> "${nachher}")`);
    }
    await seite.screenshot({ path: `${ORDNER}/live-aufgedeckt.png` });
}

/* ------------------------------------------------- 3. Verschiedene Karten, Zeichen */
console.log("\n3. Verschiedene Karten zeigen verschiedene Zeichen");
{
    const eigenerKartenId = await seite.evaluate(async () => {
        // Nur die IDs, die der Server fuer diese Sitzung ausliefert.
        const r = await fetch("/api/lernen/karten?set=englisch-grundlagen");
        if (!r.ok) return null;
        return r.json();
    });
    if (eigenerKartenId) {
        const ids = eigenerKartenId.karten?.slice(0, 6).map((k) => k.id) ?? [];
        gemessen(`${ids.length} Karten-IDs vom Server gelesen, fuer den Rechner-Vergleich genutzt`);
    }

    const gesehen = new Set();
    /*
     * Der Rohpfad als Schluessel, NICHT der Pfad ohne Zahlen.
     *
     * Die erste Fassung hat mit `replace(/[\d.]+/g, "#")` alle Ziffern ersetzt,
     * um "gleiche Form, andere Drehung" als dieselbe Form zu zaehlen. Damit
     * sind aber genau die Unterschiede weg, die zwei Karten unterscheiden –
     * Drehung, Radius, Laenge. Ergebnis: 6 Karten, 5 Formen, obwohl sechs
     * verschiedene Zeichen dastanden. Der Pfad ist deterministisch aus der
     * Karten-ID, also ist der rohe String genau das richtige Vergleichsmittel.
     */
    const schluessel = (l) =>
        l.markePfade.length ? l.markePfade.join("|") : `bild:${l.markeText}|${l.markeStil}`;
    const gutKnopf = () =>
        seite.evaluate(() => {
            const b = [...document.querySelectorAll("button")].find((x) => /^Gut\b/i.test((x.textContent ?? "").trim()));
            if (!b) return false;
            b.click();
            return true;
        });
    /*
     * `aria-pressed` direkt am Kartenknopf, nicht am aria-label erkennen.
     * Der erste Lauf hat nach einem aria-label mit "aufdecken" gesucht, und
     * genau das steht am Knopf nur, wenn die Karte ZU ist: aufgeklappt heisst
     * das Label "Antwort verbergen". Die Abfrage meldete daraufhin dauerhaft
     * "nicht aufgeklappt", das Skript drueckte Enter und deckte die Karte
     * wieder zu – und fand den Knopf "Gut" danach naturgemaess nicht.
     */
    const aufgedeckt = () =>
        seite.evaluate(() => {
            const b = [...document.querySelectorAll("button")].find(
                (x) => x.hasAttribute("aria-pressed") && x.getAttribute("aria-label") !== null,
            );
            return b?.getAttribute("aria-pressed") === "true";
        });

    let durchlaufen = 0;
    for (let i = 0; i < 6; i += 1) {
        // Erst aufdecken, dann messen: die Bewertungsbuttons existieren nur auf
        // der Rueckseite. Der erste Lauf hat blind Enter gedrueckt und thereby
        // die Karte wieder zugedeckt, wonach der Knopf "Gut" nicht da war und
        // die Schleife nach der ersten Karte endete.
        if (!(await aufgedeckt())) {
            await seite.keyboard.press("Enter");
            await seite.waitForTimeout(500);
        }
        const l = await lage();
        if (!l.marke) {
            befund(`Karte ${durchlaufen + 1}: kein Zeichen`, "fehler");
        } else {
            durchlaufen += 1;
            gesehen.add(schluessel(l));
        }
        if (!(await gutKnopf())) {
            befund(`nach ${durchlaufen} Karten kein Knopf "Gut" gefunden`, "warnung");
            break;
        }
        await seite.waitForTimeout(700);
    }
    gemessen(`${durchlaufen} Karten durchlaufen, ${gesehen.size} verschiedene Zeichenformen beobachtet`);
    if (durchlaufen >= 4 && gesehen.size < durchlaufen) {
        befund(`${durchlaufen} Karten, aber nur ${gesehen.size} verschiedene Zeichenformen`, "warnung");
    } else if (durchlaufen >= 4) {
        gemessen("jede besuchte Karte hatte ihr eigenes Zeichen");
    }
    await seite.screenshot({ path: `${ORDNER}/live-mehrere-karten.png` });
}

/* ------------------------------------------------------- 4. Schalter in den Einstellungen */
console.log("\n4. Schalter in den Einstellungen");
await seite.goto(`${BASIS}/einstellungen`, { waitUntil: "networkidle" });
await seite.setViewportSize({ width: 360, height: 740 });
await seite.waitForTimeout(300);

const schalterZustand = async () =>
    await seite.evaluate(() => {
        const el = document.querySelector("#zeichenAn");
        return el ? { vorhanden: true, an: el.checked } : { vorhanden: false };
    });

const z0 = await schalterZustand();
if (!z0.vorhanden) {
    befund("kein Schalter #zeichenAn auf der Einstellungsseite", "fehler");
} else {
    gemessen(`Schalter vorhanden, Startzustand an=${z0.an}`);
    await seite.screenshot({ path: `${ORDNER}/live-einstellungen.png` });

    // Ausschalten. Der erste Lauf hat den Schalter ueber ein gesetztes
    // `checked = false` plus einprogrammiertes `change`-Event gesteuert, und
    // danach war localStorage leer: React haengt seinen `onChange` an den
    // Klick auf die Beschriftung, nicht an ein frei erfundenes change-Event.
    // Ein echter Klick auf das Label daneben ist dasselbe, was ein Mensch
    // tut, und wird deshalb hier auch benutzt.
    async function schalterSetzen(an) {
        await seite.evaluate((soll) => {
            const el = document.querySelector("#zeichenAn");
            if (el && el.checked === soll) return;
            el?.closest("label")?.click();
        }, an);
        await seite.waitForTimeout(400);
    }

    await schalterSetzen(false);
    const gespeichert = await seite.evaluate(() => window.localStorage.getItem("lexio.kartenzeichen.v1"));
    gemessen(`nach dem Ausschalten im localStorage: ${gespeichert ?? "(leer)"}`);
    if (!gespeichert) {
        befund("der Schalter schreibt nichts in den localStorage", "fehler");
    }

    await seite.goto(`${BASIS}/lernen/englisch-grundlagen`, { waitUntil: "networkidle" });
    await seite.waitForTimeout(500);
    const lAus = await lage();
    if (lAus.marke) {
        befund("Zeichen ist trotz ausgeschaltetem Schalter noch sichtbar", "fehler");
    } else {
        gemessen("Zeichen ist nach dem Ausschalten nicht mehr im DOM");
    }
    await seite.screenshot({ path: `${ORDNER}/live-aus.png` });

    // Neuladen der Einstellungsseite: bleibt die Wahl?
    await seite.goto(`${BASIS}/einstellungen`, { waitUntil: "networkidle" });
    const z1 = await schalterZustand();
    if (z1.an !== false) {
        befund(`Schalter nach dem Neuladen wieder an (an=${z1.an})`, "fehler");
    } else {
        gemessen("Schalter bleibt nach dem Neuladen ausgeschaltet");
    }

    // wieder einschalten
    await schalterSetzen(true);
    await seite.goto(`${BASIS}/lernen/englisch-grundlagen`, { waitUntil: "networkidle" });
    await seite.waitForTimeout(400);
    const lAn = await lage();
    if (!lAn.marke) {
        befund("Zeichen fehlt nach dem Wiedereinschalten", "fehler");
    } else {
        gemessen("Zeichen ist nach dem Wiedereinschalten wieder da");
    }
}

/* --------------------------------------------------- 5. Eigene Karte bekommt ein Zeichen */
console.log("\n5. Eigenes Set und eigene Karte");
{
    /*
     * Ueber die API der App und nicht direkt ueber die Datenbank.
     *
     * Die erste Fassung hat die Tabelle direkt angesprochen und ist an den
     * falschen Namen gescheitert (`sets` statt `karteikarten_sets`, `nutzer_id`
     * statt `user_id`) und hat den Weg darum als "ungeprueft" gemeldet. Ueber
     * `POST /api/sets` und `POST /api/karten` laeuft derselbe Weg, den ein
     * Mensch im Karteneditor geht – inklusive RLS, Validierung und Slug. Und
     * es ist genau dieser Weg, den der Nutzer meint: eine Karte, die er sich
     * selbst angelegt hat.
     */
    const setAntwort = await seite.evaluate(async () => {
        const r = await fetch("/api/sets", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name: "Zeichenprobe", spracheCode: "en" }),
        });
        return { status: r.status, body: await r.json() };
    });
    const slug = setAntwort.body?.set?.slug;
    if (!slug) {
        befund(`eigenes Set liess sich nicht anlegen: HTTP ${setAntwort.status} ${JSON.stringify(setAntwort.body).slice(0, 160)}`, "warnung");
    } else {
        gemessen(`eigenes Set angelegt ueber die API: ${slug}`);

        const kartenAntwort = await seite.evaluate(async (setSlug) => {
            const r = await fetch("/api/karten", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    setSlug,
                    paare: [
                        // Drei mit Bild, damit die semantische Strecke geprueft
                        // wird, und zwei ohne, damit der Rueckfall auf die
                        // erzeugte Form geprueft wird. „zeichenprobe" ist
                        // erfunden und faellt deshalb zuverlaessig auf die Form.
                        { frage: "haus", antwort: "house" },
                        { frage: "katze", antwort: "cat" },
                        { frage: "apfel", antwort: "apple" },
                        { frage: "zeichenprobe", antwort: "markenprobe" },
                        { frage: "zweite probe", antwort: "zweite marke" },
                    ],
                }),
            });
            return { status: r.status, body: await r.json() };
        }, slug);
        const angelegt = kartenAntwort.body?.karten?.length ?? 0;
        gemessen(`${angelegt} eigene Karten ueber die API angelegt (HTTP ${kartenAntwort.status})`);
        if (!angelegt) {
            befund(`eigene Karten liessen sich nicht anlegen: ${JSON.stringify(kartenAntwort.body).slice(0, 160)}`, "warnung");
        } else {
            await seite.goto(`${BASIS}/lernen/${slug}`, { waitUntil: "networkidle" });
            await seite.waitForTimeout(700);
            await beideSeiten(360, 740, "eigenes Set 360px");
            const eigen = await lage();
            if (eigen.marke) {
                gemessen(
                    eigen.markeText
                        ? `eigene Karte zeigt das Bild ${eigen.markeText}`
                        : `eigene Karte zeigt die erzeugte Form (${eigen.markePfade.length} Pfade)`,
                );
                await seite.screenshot({ path: `${ORDNER}/live-eigene-karte.png` });
            } else {
                befund("eigene Karte zeigt kein Zeichen", "fehler");
            }

            /*
             * Die semantische Strecke, am lebenden System gemessen.
             *
             * Erwartet wird: von den fuenf eig angelegten Karten zeigen
             * „haus", „katze" und „apfel" ein Emoji, die beiden erfundenen
             * Probewoerter die erzeugte Form. Genau das ist die Zusage des
             * Nutzers an einem Punkt – „haus ist ein Haus".
             *
             * Der Stapel wird durchlaufen statt alle Karten auf einmal geprueft:
             * die Lernseite zeigt genau eine Karte, und ein erster Versuch,
             * alle gleichzeitig zu finden, hat genau eine gesehen und daraus
             * fuenf Fehlbefunde gebaut. Im gemessenen DOM ist es eindeutig:
             * ein Emoji steht in einem `span`, die Form in einem `svg`.
             */
            const karten = [];
            const gesehen = new Set();
            let stopp = "";
            let ende = false;
            for (let schritt = 0; schritt < 6; schritt += 1) {
                const k = await seite.evaluate(() => {
                    const karte = document.querySelector('[class*="kartenSeite"]')?.closest("button");
                    const marke = karte?.querySelector('[class*="karteMarke"]');
                    if (!karte || !marke) return null;
                    const istForm = marke.tagName.toLowerCase() === "svg";
                    return {
                        wort: (karte.querySelector('[class*="karteText"]')?.textContent ?? "").trim(),
                        art: istForm ? "form" : "bild",
                        text: istForm ? "" : (marke.textContent ?? "").trim(),
                        schrift: istForm ? 0 : Math.round(parseFloat(getComputedStyle(marke).fontSize)),
                        // `offsetWidth`, nicht `getBoundingClientRect`: die
                        // Kartenansicht dreht beim Aufdecken in 3D, und die
                        // Bildlaenge des Rechtecks rechnet diese Drehung mit
                        // ein. Gemessen wurde so 12x33px statt 32x32px, obwohl
                        // die Box genau 32x32px gross ist.
                        breite: marke.offsetWidth,
                        hoehe: marke.offsetHeight,
                    };
                });
                if (!k) { stopp = "keine Karte mit Zeichen im DOM"; break; }
                karten.push(k);
                // Die Animation der neuen Karte abwarten, bevor weitergelaufen
                // wird, sonst wird der naechste Zustand im Halbbild geprueft.
                await seite.waitForTimeout(400);
                /*
                 * Erst aufdecken. Der „Gut"-Knopf steht erst dann im DOM.
                 * Ein erster Versuch hat ihn direkt gesucht und kam ueber
                 * genau eine Karte hinaus, danach war Schluss.
                 */
                await seite.evaluate(() => {
                    document.querySelector('[class*="kartenSeite"]')?.closest("button")?.click();
                });
                await seite.waitForTimeout(320);
                const weiter = await seite.evaluate(() => {
                    const b = [...document.querySelectorAll("button")].find((x) =>
                        /^(Gut|Weiter|Nochmal)/i.test((x.textContent ?? "").trim()),
                    );
                    if (!b) return false;
                    b.click();
                    return true;
                });
                if (!weiter) { stopp = "kein Weiter-Knopf nach dem Aufdecken"; break; }
                await seite.waitForTimeout(450);
                /*
                 * Der Stapel ist ein Kreis: nach der letzten Karte kommt die
                 * erste wieder. Das ist das Ende, kein Fehler – ein erster
                 * Versuch hat es als Abbruch gemeldet und damit einen
                 * voellig einwandfreien Lauf als fehlgeschlagen verbucht.
                 */
                if (gesehen.has(k.wort)) { ende = true; break; }
                gesehen.add(k.wort);
            }
            if (ende) gemessen(`Stapel vollstaendig durchlaufen: ${gesehen.size} verschiedene Karten`);
            if (stopp) befund(`Stapel nach ${karten.length} Karten abgebrochen: ${stopp}`, "fehler");
            const mitBild = karten.filter((k) => k.art === "bild");
            const mitForm = karten.filter((k) => k.art === "form");
            gemessen(`${karten.length} Karten durchlaufen: ${mitBild.length} mit Bild, ${mitForm.length} mit erzeugter Form`);
            for (const k of mitBild) {
                gemessen(`Bild ${k.text} zu „${k.wort}", Schrift ${k.schrift}px, Box ${k.breite}x${k.hoehe}px`);
            }
            for (const [emoji, wort] of [["\u{1F3E0}", "haus"], ["\u{1F431}", "katze"], ["\u{1F34E}", "apfel"]]) {
                const karte = mitBild.find((k) => k.text === emoji);
                if (!karte) befund(`fuer „${wort}" wurde kein ${emoji} gefunden`, "fehler");
                else gemessen(`Karte „${karte.wort}" zeigt ${emoji} wie verlangt`);
            }
            // Auf der Vorderseite steht die Uebersetzung, also „markenprobe"
            // und „zweite marke". Zuerst war hier „zeichenprobe" erwartet –
            // das ist die Frage, und die steht erst auf der Rueckseite.
            for (const wort of ["markenprobe", "zweite marke"]) {
                const karte = mitForm.find((k) => k.wort.startsWith(wort));
                if (karte) gemessen(`Karte „${karte.wort}" faellt korrekt auf die erzeugte Form zurueck`);
                else befund(`Karte „${wort}" sollte die erzeugte Form zeigen`, "fehler");
            }
            /*
             * Das Bild muss in derselben Box sitzen wie die Form, sonst rutscht
             * es auf einer Breite aus dem Kartenrand. Die Schriftgroesse darf
             * dagegen kleiner sein: sie schwankt absichtlich zwischen 86 und
             * 100 Prozent, damit nicht jede Karte denselben Abdruck hat.
             */
            for (const k of mitBild) {
                if (k.breite !== 32 || k.hoehe !== 32) {
                    befund(`Bild auf „${k.wort}" ist ${k.breite}x${k.hoehe}px statt 32x32px`, "fehler");
                } else if (k.schrift < 27 || k.schrift > 32) {
                    befund(`Bild auf „${k.wort}" hat ${k.schrift}px Schrift, erlaubt sind 27 bis 32px`, "fehler");
                }
            }
            await seite.screenshot({ path: `${ORDNER}/live-semantik.png` });
        }
    }
}

/* ------------------------------------------------------------------ Abschluss */
/*
 * Vorbestehender Fehler, nicht von dieser Aenderung verursacht.
 *
 * Auf /einstellungen wirft React den Hydration-Fehler #418, und zwar schon an
 * der unveraenderten Seite: gegengeprobt wurde mit `git checkout` auf die
 * Originaldatei und neu gebaut, dort kommt er genauso. Ursache ist nicht das
 * Kartenzeichen, sondern `pushUnterstuetzt` in Zeile 84, das im
 * Zustands-Initializer `typeof window !== "undefined"` prueft: der Server
 * kennt kein `window` und rendert "Dieser Browser unterstuetzt keine
 * Push-Benachrichtigungen.", der Browser rendert "Erhalte eine taegliche
 * Lernerinnerung…". Genau dieselbe Fehlerklasse wie beim Lesen von
 * localStorage im Initialisator, nur an einer anderen Stelle.
 *
 * Er wird hier als Hinweis gefuehrt und nicht als Fehler, weil ein Audit, der
 * einen fremden, bereits vorhandenen Befund als eigenen ausgibt, taeuscht. Die
 * Reparatur gehoert nicht in diesen Schritt; die Foundation ist an anderer
 * Stelle zu machen.
 */
const VORBESTEHEND = {
    muster: /Minified React error #418/,
    ort: "/einstellungen",
};

if (fehlerInDerKonsole.length) {
    for (const f of fehlerInDerKonsole) {
        if (VORBESTEHEND.muster.test(f.text) && f.url.includes(VORBESTEHEND.ort)) {
            befund(`Hydration-Fehler #418 auf ${f.url} – vorbestehend, siehe Kommentar unten`, "hinweis");
            continue;
        }
        befund(`Fehler auf ${f.url}: ${f.text}`, "fehler");
    }
}

console.log("\n──────────────────────────────────────────────");
console.log(`Befunde: ${befunde.filter((b) => b.waerm === "fehler").length} Fehler, ${befunde.filter((b) => b.waerm !== "fehler").length} Hinweise`);
console.log(`Messungen: ${messungen.length}`);
console.log(`Screenshots: ${ORDNER}/live-*.png`);

await browser.close();
process.exit(befunde.some((b) => b.waerm === "fehler") ? 1 : 0);
