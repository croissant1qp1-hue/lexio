import { chromium } from "playwright";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const WURZEL = join(import.meta.dirname, "..");
const CHUNKS = join(WURZEL, ".next", "static", "chunks");
const ZIEL = join(WURZEL, "public", "images", "og-1200x630.png");

/*
 * Das Vorschaubild fuer geteilte Links (og:image, 1200x630).
 *
 * Aufruf: `node scripts/og-bild.mjs`, nach einem `npm run build` – die
 * Schriften kommen aus dem Build, nicht aus dem Netz (siehe unten). Das
 * Bild selbst liegt versioniert in public/images/; dieses Skript braucht
 * es nur, wenn sich die Schlagzeile oder die Anordnung aendert.
 *
 * Ein Word-Template waere der bequemere Weg, aber es gibt kein Werkzeug
 * dafuer, das nicht Word selbst waere – und ein Skript, das dasselbe CSS
 * wie die Seite benutzt, kann nicht auseinanderlaufen.
 */
function schriftSuchen(wasSuchen) {
  for (const datei of readdirSync(CHUNKS).filter((f) => f.endsWith(".css"))) {
    const css = readFileSync(join(CHUNKS, datei), "utf8");
    // Minifiziertes CSS: font-family:Inter; … src:url(../media/xxx.woff2)format("woff2")
    const teile = css.matchAll(
      /@font-face\{font-family:([^;]+);[^}]*?src:url\(([^)]+)\)/g,
    );
    for (const t of teile) {
      const familie = t[1].replace(/^['"]|['"]$/g, "").trim();
      if (!familie.toLowerCase().includes(wasSuchen)) continue;
      const rel = t[2].replace(/^["']|["']$/g, "");
      return { familie, datei: join(CHUNKS, rel) };
    }
  }
  return null;
}

const serif = schriftSuchen("fraunces");
const mono = schriftSuchen("plex mono") ?? schriftSuchen("mono");
if (!serif) {
  console.error(
    "Fraunces nicht gefunden – Skript braucht einen frischen Build (.next/static/chunks).",
  );
  process.exit(1);
}
const monoFamilie = mono ? `'${mono.familie}', ui-monospace, monospace` : "ui-monospace, monospace";
const serifFamilie = `'${serif.familie}', Georgia, serif`;

const html = `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><style>
  @font-face { font-family: '${serif.familie}'; src: url("file://${serif.datei}") format('woff2'); font-weight: 100 900; font-display: block; }
  ${mono ? `@font-face { font-family: '${mono.familie}'; src: url("file://${mono.datei}") format('woff2'); font-weight: 400 700; font-display: block; }` : ""}
  * { margin: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 630px; overflow: hidden;
    background: #0D171D; color: #f3efe3;
    font-family: ${serifFamilie};
    position: relative;
  }
  .glanz {
    position: absolute; inset: 0;
    background: radial-gradient(120% 90% at 18% -10%, rgba(231,177,74,0.20), transparent 55%),
                radial-gradient(80% 70% at 110% 110%, rgba(231,177,74,0.10), transparent 60%);
  }
  .marke {
    position: absolute; top: 52px; left: 64px;
    font-family: ${monoFamilie}; font-size: 22px; font-weight: 600;
    letter-spacing: 0.28em; text-transform: uppercase; color: #e7b14a;
  }
  h1 {
    position: absolute; left: 64px; top: 168px; width: 640px;
    font-size: 74px; line-height: 1.06; font-weight: 700; letter-spacing: -0.015em;
    color: #f3efe3;
  }
  .unterzeile {
    position: absolute; left: 64px; top: 400px; width: 620px;
    font-family: ${monoFamilie}; font-size: 23px; line-height: 1.5; color: #bdb5a3;
  }
  .leiter { position: absolute; left: 64px; top: 508px; display: flex; gap: 8px; }
  .leiter i { display: block; width: 74px; height: 8px; border-radius: 999px; background: rgba(243,239,227,0.16); }
  .leiter i.voll { background: #e7b14a; }
  .leiter i.halb { background: linear-gradient(90deg, #e7b14a 55%, rgba(243,239,227,0.16) 55%); }
  .karte {
    position: absolute; right: 74px; top: 118px;
    width: 392px; height: 396px; border-radius: 26px;
    background: #f0e8d5; color: #20252a;
    box-shadow: 0 30px 60px rgba(0,0,0,0.45), inset 0 2px 0 rgba(255,255,255,0.6);
    transform: rotate(-3.5deg);
    padding: 40px 38px; overflow: hidden;
  }
  .karte::after {
    content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 96px;
    background: radial-gradient(90% 100% at 50% 130%, rgba(32,37,42,0.10), transparent 70%);
  }
  .begriff { font-size: 52px; font-weight: 700; letter-spacing: -0.01em; }
  .antwort { font-family: ${monoFamilie}; font-size: 34px; color: #8a6a1f; margin-top: 6px; font-weight: 600; }
  .linie { height: 2px; background: rgba(32,37,42,0.16); margin: 30px 0 24px; }
  .satz { font-size: 25px; line-height: 1.45; font-style: italic; color: #4a5057; }
</style></head>
<body>
  <div class="glanz"></div>
  <div class="marke">Lexio</div>
  <h1>Vokabeln lernen, das hängen bleibt.</h1>
  <p class="unterzeile">Beispielsatz zu jedem Wort · Gestufte Wiederholung über 1, 3, 7, 16, 35, 60 Tage · Eigene Wortlisten</p>
  <div class="leiter"><i class="voll"></i><i class="voll"></i><i class="voll"></i><i class="halb"></i><i></i><i></i><i></i></div>
  <div class="karte">
    <div class="begriff">welcher</div>
    <div class="antwort">which</div>
    <div class="linie"></div>
    <div class="satz">Which one do you take?</div>
  </div>
</body></html>`;

const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const seite = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await seite.setContent(html, { waitUntil: "load" });
await seite.evaluate(() => document.fonts.ready);
await seite.waitForTimeout(300);

/*
 * Nachmessen statt hinsehen: Koordinaten pruefen, bevor das Bild gilt.
 * Wenn eine Box ueber den Rand hinausragt oder zwei sich ueberlappen,
 * steht das hier – sonst muesste jemand das PNG ansehen, um es zu merken.
 */
const boxes = await seite.evaluate(() => {
  const names = [".marke", "h1", ".unterzeile", ".leiter", ".karte", ".karte .begriff", ".karte .satz"];
  const r = {};
  for (const n of names) {
    const el = document.querySelector(n);
    if (!el) { r[n] = "FEHLT"; continue; }
    const b = el.getBoundingClientRect();
    r[n] = { x: Math.round(b.x), y: Math.round(b.y), rechts: Math.round(b.right), unten: Math.round(b.bottom) };
  }
  return r;
});
console.log(JSON.stringify(boxes, null, 1));
const problem = (() => {
  const h1 = boxes["h1"], unter = boxes[".unterzeile"], leiter = boxes[".leiter"];
  if (h1 && unter && typeof h1 === "object" && typeof unter === "object" && h1.unten > unter.y) return `h1 unten ${h1.unten} > unterzeile y ${unter.y}`;
  if (unter && leiter && typeof unter === "object" && typeof leiter === "object" && unter.unten > leiter.y) return `unterzeile unten ${unter.unten} > leiter y ${leiter.y}`;
  for (const [k, v] of Object.entries(boxes)) {
    if (v && typeof v === "object" && (v.rechts > 1200 || v.unten > 630 || v.x < 0 || v.y < 0)) return `${k} ragt ueber den Rand: ${JSON.stringify(v)}`;
  }
  return null;
})();
if (problem) {
  console.error(`PROBLEM: ${problem}`);
  await browser.close();
  process.exit(1);
}
console.log("Anordnung passt: keine Ueberlappung, nichts ragt ueber den Rand.");

await seite.screenshot({ path: ZIEL, type: "png" });
await browser.close();

const groesse = readFileSync(ZIEL).length;
console.log(`geschrieben: ${ZIEL} (${Math.round(groesse / 1024)} KB)`);
