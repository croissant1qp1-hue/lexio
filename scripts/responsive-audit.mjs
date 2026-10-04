/**
 * Phase 5: Responsive-Audit.
 *
 * Der Plan sagt ausdrücklich: "CSS lesen zeigt keine gerenderte Seite." Also
 * wird hier gemessen, im echten Browser, auf den echten Breiten – und nicht
 * geschätzt.
 *
 * Geprüft wird genau die Abnahmeliste aus LEXIO-PLAN.md, Phase 5:
 *   – kein waagerechter Bildlauf
 *   – kein Text kleiner als 14 px
 *   – kein Bedienelement kleiner als 44 × 44 px
 *   – kein Inhalt verdeckt durch die untere Tabellenleiste
 *   – die vier Bewertungsknöpfe auf 360 px erreichbar und lesbar
 *   – Sticky-Elemente überlappen keinen Inhalt
 *   – Hoch- und Querformat
 *
 * Aufruf:
 *   node --env-file=.env scripts/responsive-audit.mjs
 *   node --env-file=.env scripts/responsive-audit.mjs --sichtbar   (mit Fenster)
 *
 * Das Skript startet keinen Server: es misst, was laeuft. Fuer den
 * Produktionsstand `npm run start` verwenden, nicht `npm run dev`.
 */
import { chromium } from "playwright";
import { readFileSync, writeFileSync as writeFile } from "node:fs";

const BASIS = process.env.AUDIT_BASIS ?? "http://localhost:3000";
const KONTO = JSON.parse(readFileSync("/tmp/audit-konto.json", "utf8"));
const SICHTBAR = process.argv.includes("--sichtbar");

/**
 * Seiten aus der Abnahmeliste des Plans.
 *
 * Der Slug beim Lernen ist der des Demosets. Er stand hier erst als "demo"
 * und lieferte damit 404 – das ist kein Befund an der App, sondern ein
 * Tippfehler im Audit. Das Demoset aus 002 heißt "englisch-grundlagen".
 *
 * /karteikarten-hinzufuegen/sprache-auswählen war in der Liste, weil der
 * Plan alle vier Wizard-Schritte nennt, und lieferte 404: dort liegt nur eine
 * CSS-Datei, keine page.tsx. Die Seite wurde am 2026-10-02 aus der Liste
 * genommen, nachdem `grep` bestaetigt hat, dass **kein** Element der App auf
 * diesen Pfad verweist – sie ist also fuer niemanden erreichbar, auch nicht
 * fuer einen Besucher mit einer falschen Adresse. Solange sie nicht
 * existiert, ist ein Befund von dort nur eine Messung der 404-Seite unter
 * falschem Namen. Sobald die `page.tsx` committet ist, gehoert der Pfad
 * wieder in die Liste.
 */
const SEITEN = [
  { pfad: "/anmelden", name: "Anmelden", ohneLogin: true },
  { pfad: "/", name: "Startseite", ohneLogin: true },
  // Seit dem Quellenseiten-Pass mit drin: die Seite ist Text mit Aufzählung
  // und Lizenz-Plaketten, und der Fuß der Startseite hat inzwischen drei
  // Kinder. Beides ist ohne Messung nicht zu beurteilen – besonders die
  // Zeilenhöhe der Links und das Umbrechen der Plaketten bei 360 px.
  { pfad: "/quellen", name: "Quellen", ohneLogin: true },
  { pfad: "/uebersicht", name: "Übersicht" },
  { pfad: "/wortschatz", name: "Wortschatz" },
  { pfad: "/lernen/englisch-grundlagen", name: "Lernansicht" },
  { pfad: "/statistiken", name: "Statistiken" },
  { pfad: "/profil", name: "Profil" },
  { pfad: "/einstellungen", name: "Einstellungen" },
  { pfad: "/karteikarten", name: "Karteikarten" },
  { pfad: "/karteikarten-hinzufuegen", name: "Hinzufügen 1" },
  // "Hinzufügen 3" ist eine reine Umleitungsseite: Die page.tsx dort ruft
  // `redirect("/karteikarten-hinzufuegen/vokabeln-hinzufuegen")` auf und
  // enthaelt sonst nichts (so seit dem Stand 1.0). Das Audit hat den Pfad
  // trotzdem gemessen und danach jedes Mal "Umleitung" gemeldet – 6 Befunde,
  // die nichts mit dem Layout zu tun haben und nur dafür sorgen, dass eine
  // echte Zahl untergeht. Gewartet wird das Ziel, nicht die Vorstufe.
  { pfad: "/karteikarten-hinzufuegen/vokabeln-hinzufuegen", name: "Hinzufügen 3", erwartet: "/karteikarten-hinzufuegen/vokabeln-hinzufuegen" },
];

/**
 * Breiten aus der Abnahmeliste, plus Hoehen fuer Hoch- und Querformat.
 * Querformat heisst: gleiche Breite, kurze Hoehe – da bricht ein
 * Sticky-Element eher um als im Hochformat.
 */
const GROESSEN = [
  { name: "360 hoch", breite: 360, hoehe: 800 },
  { name: "360 quer", breite: 360, hoehe: 420 },
  { name: "414 hoch", breite: 414, hoehe: 896 },
  { name: "414 quer", breite: 414, hoehe: 420 },
  { name: "768 hoch", breite: 768, hoehe: 1024 },
  { name: "768 quer", breite: 768, hoehe: 420 },
];

/**
 * Die Messung selbst, im Browser ausgefuehrt.
 *
 * Bewusst als eine Funktion im Format einer Seite: Playwright uebergibt den
 * Quelltext, alles darin laeuft im gerenderten Dokument. Kein Serialisieren
 * von Elementen ueber die Prozessgrenze, das waere fehleranfaellig.
 */
const MESSUNG = () => {
  const befunde = [];
  const hinweis = (regel, text, element) =>
    befunde.push({ regel, text, element });

  // ---------------------------------------------------------------
  // 1. Waagerechter Bildlauf
  // ---------------------------------------------------------------
  const doc = document.documentElement;
  const ueberlauf = doc.scrollWidth - doc.clientWidth;

  if (ueberlauf > 1) {
    // Was schiesst ueber den Rand? Nur die Breite zu melden ist nicht
    // genug – der Plan will wissen, was es ist, damit man es finden kann.
    const schuldige = [];
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const cs = getComputedStyle(el);
      if (cs.position === "fixed") continue;
      if (r.right > doc.clientWidth + 1 || r.left < -1) {
        const kennung = el.tagName.toLowerCase()
          + (el.id ? `#${el.id}` : "")
          + (el.className && typeof el.className === "string"
            ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".")
            : "");
        schuldige.push({
          kennung,
          links: Math.round(r.left),
          rechts: Math.round(r.right),
          breite: Math.round(r.width),
        });
      }
    }
    hinweis(
      "Bildlauf waagerecht",
      `Dokument ${ueberflussText(doc)}px breiter als der sichtbare Bereich`,
      schuldige.slice(0, 6),
    );
  }

  function ueberflussText(d) {
    return `${d.scrollWidth} statt ${d.clientWidth}`;
  }

  // ---------------------------------------------------------------
  // 2. Text kleiner als 14 px
  // ---------------------------------------------------------------
  // Geprueft wird die *effektive* Schriftgroesse, nicht die in der CSS-Datei.
  // Ein 10px-Text wird durch ein Verzeichnis erst sichtbar, wenn man die
  // berechnete Groesse ansieht.
  const kleinerText = [];
  for (const el of document.querySelectorAll("body *")) {
    // Nur Elemente, die selbst Text tragen – sonst meldet jedes Kind eines
    // kleinen Labels denselben Fehler.
    const eigenerText = Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join("")
      .trim();
    if (!eigenerText) continue;

    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (getComputedStyle(el).visibility === "hidden") continue;

    /*
     * SetupHinweis auslassen. Der erscheint, weil SUPABASE_SERVICE_ROLE_KEY
     * in dieser Umgebung ein Platzhalter ist – er ist eine Diagnoseanzeige,
     * keine Oberflaeche. Ihn zu messen hiesse, ein Testumgebungsproblem als
     * Layoutproblem zu melden. Im Betrieb mit echtem Key ist die Leiste weg.
     */
    if (el.closest("[class*='setup-hinweis']")) continue;

    const groesse = parseFloat(getComputedStyle(el).fontSize);
    if (groesse < 14) {
      kleinerText.push({
        kennung: beschreibung(el),
        px: groesse,
        text: eigenerText.slice(0, 40),
      });
    }
  }
  if (kleinerText.length) {
    hinweis("Text unter 14px", `${kleinerText.length} Fundstellen`, kleinerText.slice(0, 10));
  }

  function beschreibung(el) {
    return el.tagName.toLowerCase()
      + (el.id ? `#${el.id}` : "")
      + (typeof el.className === "string" && el.className.trim()
        ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".")
        : "");
  }

  // ---------------------------------------------------------------
  // 3. Bedienelemente kleiner als 44 x 44 px
  // ---------------------------------------------------------------
  const klein = [];
  for (const el of document.querySelectorAll(
    "button, a[href], input, select, textarea, [role='button'], [role='tab']",
  )) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    // Siehe Kommentar bei der Textgroesse: SetupHinweis ist Diagnoseanzeige.
    if (el.closest("[class*='setup-hinweis']")) continue;

    // Reine Textlinks im Fliesstext sind keine Bedienelemente in diesem
    // Sinn. Der Plan meint Knöpfe und Felder. Erkennbar daran, dass sie
    // nicht im Absatzfluss stehen: display inline ohne Feste Groesse.
    const istTextlink = el.tagName === "A"
      && cs.display === "inline"
      && el.closest("p, li, td");

    /*
     * Checkbox: die Zielflaeche ist das umschliessende `<label>`, nicht das
     * Quadrat.
     *
     * Zwei Faenge, eine Regel. Versteckt (`clip: rect(0,0,0,0)`) misst das
     * Quadrat 1x1px, sichtbar 20x20px – in beiden Faellen trifft ein Tipp die
     * Beschriftung, weil sie das Quadrat umschliesst. Ist das Label 44x44 oder
     * groesser, gibt es nichts zu melden; ist es kleiner, auch nicht das
     * Quadrat, sondern der Befund "Label zu klein".
     *
     * Ohne diese Ausnahme stand der Punkt in jedem Lauf und war damit nutzlos:
     * ein Messbefund, der immer dasselbe sagt, wird ignoriert. Bei /anmelden
     * ist `.merkenZeile` 44px hoch, bei /einstellungen der Umschalter daneben.
     * Eine Checkbox ganz ohne grosses Label zaehlt weiterhin – das ist einer.
     */
    if (el.matches("input[type=checkbox]")) {
      const label = el.closest("label");
      if (!label) continue;
      const lr = label.getBoundingClientRect();
      if (lr.width >= 44 && lr.height >= 44) continue;
    }

    if (!istTextlink && (r.width < 44 || r.height < 44)) {
      klein.push({
        kennung: beschreibung(el),
        breite: Math.round(r.width),
        hoehe: Math.round(r.height),
        text: (el.textContent || el.value || "").trim().slice(0, 30),
      });
    }
  }
  if (klein.length) {
    hinweis("Bedienelement unter 44x44px", `${klein.length} Fundstellen`, klein.slice(0, 12));
  }

  // ---------------------------------------------------------------
  // 4. Untere Leiste verdeckt Inhalt
  // ---------------------------------------------------------------
  // Die Leiste liegt am unteren Rand. Sie darf Inhalt verdecken, solange
  // die Seite scrollbar ist und am Ende genug Platz bleibt – das ist
  // Standard. Sie darf es nicht, wenn der letzte Inhalt *hinter* der Leiste
  // landet und nicht mehr erreichbar ist, weil der Seitenende-Padding
  // fehlt.
  const leiste = document.querySelector(
    ".tab-bar, .bottom-bar, .mobile-nav, nav[class*='tab'], [class*='bottom-nav'], [class*='tab-bar']",
  );
  if (leiste) {
    const lr = leiste.getBoundingClientRect();
    // Nach ganz unten scrollen und schauen, ob der letzte sichtbare
    // Inhalt ueber der Leiste endet.
    window.scrollTo(0, document.body.scrollHeight);
    const amEnde = new Promise((r) => requestAnimationFrame(() => r(null)));
    return amEnde.then(() => {
      const letzterInhalt = document.querySelector("main > *:last-child, .main-body > *:last-child");
      const ergebnis = { leiste: beschreibung(leiste) };

      if (letzterInhalt) {
        const ir = letzterInhalt.getBoundingClientRect();
        // Relativ zum Leisten-Oberkanten. Positiv = verdeckt.
        const verdeckt = ir.bottom - lr.top;
        ergebnis.letzterInhalt = beschreibung(letzterInhalt);
        ergebnis.ueberlappungPx = Math.round(verdeckt);
        ergebnis.leistenHoehe = Math.round(lr.height);
        if (verdeckt > 4) {
          hinweis(
            "Leiste verdeckt letzten Inhalt",
            `Letztes Element ragt ${Math.round(verdeckt)}px unter den Leisten-Oberrand`,
            ergebnis,
          );
        }
      }
      window.scrollTo(0, 0);
      return befunde;
    });
  }

  window.scrollTo(0, 0);
  return befunde;
};

/** Läuft im Browser und sammelt Befunde für eine Seite/Größe. */
async function messe(context, seite, groesse) {
  // Eigene Seite je Durchlauf: die Viewportgroesse und die
  // prefers-reduced-motion-Emulation duerfen sich nicht ueberschreiben.
  const p = await context.newPage();
  await p.setViewportSize({ width: groesse.breite, height: groesse.hoehe });

  const antworten = [];
  p.on("response", (r) => {
    if (r.status() >= 400) antworten.push(`${r.status()} ${r.url().replace(BASIS, "")}`);
  });

  await p.goto(`${BASIS}${seite.pfad}`, { waitUntil: "networkidle", timeout: 30000 });
  // Einen Moment warten: Kartenanimationen und Daten aus der API
  // brauchen nach dem networkidle noch einen Frame.
  await p.waitForTimeout(700);

  const befunde = await p.evaluate(MESSUNG);

  // Reduzierte Bewegung pruefen: bei prefers-reduced-motion darf keine
  // Daueranimation laufen.
  await p.emulateMedia({ reducedMotion: "reduce" });
  const bewegung = await p.evaluate(() => {
    const laufende = [];
    for (const el of document.querySelectorAll("*")) {
      const cs = getComputedStyle(el);
      if (cs.animationName === "none" || cs.animationDuration === "0s") continue;
      if (cs.animationIterationCount === "infinite") {
        laufende.push({
          kennung: el.tagName.toLowerCase() + (typeof el.className === "string" && el.className.trim()
            ? "." + el.className.trim().split(/\s+/)[0] : ""),
          animation: cs.animationName,
          dauer: cs.animationDuration,
        });
      }
    }
    return laufende.slice(0, 8);
  });
  await p.emulateMedia({ reducedMotion: "no-preference" });

  const gelandet = p.url().replace(BASIS, "") || seite.pfad;
  // Eine Umleitung ist nur dann ein Befund, wenn niemand sie erwartet hat.
  // Steht `erwartet` in der Seitenliste, ist der Sprung der dokumentierte
  // Weg der Seite und die Messung galt dem Ziel.
  const umgeleitet = !gelandet.startsWith(seite.pfad) && !seite.erwartet;
  const erwartetGehalten = seite.erwartet ? gelandet.startsWith(seite.erwartet) : true;

  await p.close();
  // Ein 404 auf einer Seite, die es noch gar nicht gibt (unvollstaendig),
  // ist kein Befund – die erwartete Antwort waere auch ein Fehler.
  const echteFehler = seite.unvollstaendig
    ? []
    : [...new Set(antworten)].slice(0, 5);

  if (seite.erwartet && !erwartetGehalten) {
    befunde.push({
      regel: "erwartete Umleitung",
      text: `sollte nach ${seite.erwartet} fuehren, landete aber auf ${gelandet}`,
      element: "url",
    });
  }

  return {
    seite: seite.name,
    pfad: seite.pfad,
    unvollstaendig: Boolean(seite.unvollstaendig),
    groesse: groesse.name,
    gelandet,
    umgeleitet,
    antworten: echteFehler,
    bewegung,
    befunde,
  };
}

// -------------------------------------------------------------------
// Durchlauf
// -------------------------------------------------------------------
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: !SICHTBAR,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const context = await browser.newContext({
  viewport: { width: 360, height: 800 },
  deviceScaleFactor: 2,
  locale: "de-DE",
  isMobile: true,
  hasTouch: true,
  // Ohne das bekommt die Testseite keine Session.
  storageState: {
    cookies: [
      {
        name: KONTO.cookieName,
        value: KONTO.cookieValue,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
      },
    ],
    origins: [],
  },
});

const ergebnisse = [];
for (const seite of SEITEN) {
  for (const groesse of GROESSEN) {
    try {
      ergebnisse.push(await messe(context, seite, groesse));
    } catch (fehler) {
      ergebnisse.push({
        seite: seite.name,
        pfad: seite.pfad,
        unvollstaendig: Boolean(seite.unvollstaendig),
        groesse: groesse.name,
        fehler: fehler.message.split("\n")[0],
        befunde: [],
      });
    }
  }
}

await browser.close();

/*
 * Rohdaten ablegen. Der Textbericht unten ist zum Lesen da, aber zum
 * Auswerten (welcher Fehler auf wie vielen Seiten, welcher Breite) sind die
 * Daten praktischer als 72 Blöcke Text.
 */
await writeFile("/tmp/audit-rohdaten.json", JSON.stringify(ergebnisse, null, 1));

// -------------------------------------------------------------------
// Bericht
// -------------------------------------------------------------------
const mitBefund = ergebnisse.filter((e) => e.befunde.length || e.fehler || e.umgeleitet);
const fehlerSeiten = ergebnisse.filter((e) => e.fehler);

console.log(`\nDurchläufe: ${ergebnisse.length}  |  mit Befund: ${mitBefund.length}  |  Fehler: ${fehlerSeiten.length}\n`);

for (const e of mitBefund) {
  const kopf = `${e.groesse.padEnd(9)} ${e.seite}${e.umgeleitet ? ` → ${e.gelandet}` : ""}`;
  if (e.fehler) {
    console.log(`FEHLER    ${kopf}: ${e.fehler}`);
    continue;
  }
  console.log(`PRÜFEN    ${kopf}`);
  for (const b of e.befunde) {
    console.log(`            → ${b.regel}: ${b.text}`);
    for (const el of Array.isArray(b.element) ? b.element : [b.element]) {
      console.log(`              ${JSON.stringify(el)}`);
    }
  }
  if (e.bewegung.length) {
    console.log(`            → Bewegung trotz prefers-reduced-motion: ${e.bewegung.length}`);
    for (const m of e.bewegung) console.log(`              ${JSON.stringify(m)}`);
  }
  if (e.antworten.length) {
    console.log(`            → HTTP-Fehler: ${e.antworten.join(", ")}`);
  }
}

if (!mitBefund.length) console.log("Keine Befunde. Das ist ungewoehnlich – pruefen, ob die Seiten ueberhaupt Inhalt hatten.");