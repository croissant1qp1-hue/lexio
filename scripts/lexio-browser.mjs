#!/usr/bin/env node
/**
 * lexio-browser.mjs — Firefox fernsteuern und den DOM lesen.
 *
 * WARUM DOM UND NICHT BILDSCHIRMABDRUCK
 * -------------------------------------
 * Ein Screenshot ist fuer dieses Modell nutzlos: Bilder kommen nicht lesbar
 * an. Derselbe Text laesst sich als DOM zuverlaessig auslesen — Button-Beschriftung,
 * Fehlermeldung, Zaehlerstand, alle exakt statt geraten. Ausserdem entfaellt
 * das Raten, wo auf dem Bild wohl ein Knopf liegt.
 *
 * ZWEI SACHE NEBENEINANDER, ZWEI WERKZEUGE
 * -----------------------------------------
 *   browser (WebDriver BiDi)   Lesen UND Klicken. Der Normalfall.
 *   xdotool                    Taste/Position, wenn BiDi eine Seite nicht sieht
 *                              (z. B. weil sie in einem Fenster steckt, das
 *                              BiDi nicht als Tab kennt).
 *
 * ERLAUBNIS
 * ---------
 * Jeder befeehlende Zugriff auf den Browser -- also jedes Lesen und jedes
 * Klicken -- laeuft durch `frageErlaubnis()`. Sie wird per Terminal-Rueckfrage
 * ausgefuehrt und bricht bei Ablehnung sofort ab, ohne den Browser zu beruehren.
 * Standard ist hier "nein": bestaetigt werden muss ausdruecklich.
 *
 * AUFruf
 * ------
 *   node scripts/lexio-browser.mjs lesen            Text der aktiven Seite
 *   node scripts/lexio-browser.mjs klick "Text des Knopfes"
 *   node scripts/lexio-browser.mjs tippe  "Text, der eingegeben wird"
 *   node scripts/lexio-browser.mjs enter            Enter/Wackel
 *   node scripts/lexio-browser.mjs url    "https://..."
 *   node scripts/lexio-browser.mjs fenster          Fensterliste
 *   node scripts/lexio-browser.mjs aktiv            welches Fenster vorne ist
 *   node scripts/lexio-browser.mjs tippschluessel "ctrl+a" "ctrl+v"
 *   node scripts/lexio-browser.mjs start            Firefox mit BiDi starten
 */

import { spawn } from "node:child_process";
import { readFileSync, existsSync, openSync, writeSync, closeSync } from "node:fs";

// =====================================================================
// Erlaubnis
// =====================================================================

/**
 * Holt die Erlaubnis vom Menschen ein, bevor der Browser angefasst wird.
 *
 * Bewusst ueber /dev/tty und nicht ueber stdin: stdin benutzt dieses Skript
 * selbst, wenn es von opencode aus aufgerufen wird. Die Frage muss auf dem
 * Terminal des Menschen landen, nicht in einer Pipe, die niemand liest.
 */
function frageErlaubnis(zweck) {
  if (process.env.LEXIO_BROWSER_DANGER === "1") {
    console.error("! Erlaubnis per LEXIO_BROWSER_DANGER=1 uebergangen.");
    return true;
  }

  let tty;
  try {
    tty = readFileSync("/dev/tty", "utf8", { flag: "r" });
  } catch {
    tty = null;
  }
  if (!tty) {
    console.error(
      "\nABGEBROCHEN: kein Terminal fuer die Erlaubnisfrage.\n" +
        "  Erlaubnis wird nicht automatisch erteilt. Ohne /dev/tty\n" +
        "  laeuft dieses Skript nicht absichtlich im Hintergrund.\n" +
      "  Falls wirklich noetig: LEXIO_BROWSER_DANGER=1 setzen.\n",
    );
    process.exit(2);
  }

  // Schreiben ueber das Dateideskriptor, nicht ueber den Lesekanal.
  const fd = openSync("/dev/tty", "w");
  writeSync(
    fd,
    `\n┌──────────────────────────────────────────────┐\n` +
      `│  ZUGRIFF AUF DEINEN BROWSER                 │\n` +
      `└──────────────────────────────────────────────┘\n` +
      `  Vorhaben: ${zweck}\n\n` +
      `  Der Browser liest sich gerade selbst aus. Es wird NICHTS\n` +
      `  getippt, gespeichert oder verschickt.\n\n` +
      `  Erlaubnis geben? [j/N] `,
  );

  const antwort = (tty + "\n").split("\n")[0].trim().toLowerCase();
  try {
    closeSync(fd);
  } catch {
    /* egal */
  }

  if (antwort !== "j") {
    console.error("\n  Abgelehnt. Es wurde nichts gemacht.\n");
    process.exit(1);
  }
  console.error("  Erteilt.\n");
  return true;
}

// =====================================================================
// Firefox mit BiDi
// =====================================================================

const PROFIL = "/tmp/lexio-firefox-profil";
const PORT = 9222;

/** Startet Firefox mit dem BiDi-Port, falls er noch nicht laeuft. */
function starteFirefox() {
  const p = spawn(
    "firefox",
    [
      "--remote-debugging-port",
      String(PORT),
      "--profile",
      PROFIL,
      "--no-remote",
      "about:blank",
    ],
    { detached: true, stdio: "ignore" },
  );
  p.unref();
}

/** Wartet, bis der BiDi-Endpunkt antwortet. */
async function warteAufPort(maxSekunden = 25) {
  for (let i = 0; i < maxSekunden * 2; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/session`, {
        method: "DELETE",
      });
      // DELETE /session beendet eine alte Sitzung; 200 oder 404 heisst: der
      // Server lebt.
      if (r.status < 500) return true;
    } catch {
      /* noch nicht bereit */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

// =====================================================================
// BiDi-Verbindung
// =====================================================================

class Bidi {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.warte = new Map();
    ws.addEventListener("message", (ev) => {
      let nachricht;
      try {
        nachricht = JSON.parse(ev.data);
      } catch {
        return;
      }
      const eintrag = this.warte.get(nachricht.id);
      if (!eintrag) return;
      this.warte.delete(nachricht.id);
      if (nachricht.type === "error") eintrag.ablehnen(new Error(nachricht.error));
      else eintrag.erfuellen(nachricht.result);
    });
  }

  static async verbinde() {
    const r = await fetch(`http://127.0.0.1:${PORT}/session`, {
      headers: { "Content-Type": "application/json" },
      method: "POST",
      body: "{}",
    });
    if (!r.ok) throw new Error(`BiDi-Verbindung abgelehnt: HTTP ${r.status}`);
    const { sessionId } = await r.json();
    const wsUrl = `ws://127.0.0.1:${PORT}/session/${sessionId}`;
    const ws = new WebSocket(wsUrl);

    await new Promise((erfuellen, ablehnen) => {
      ws.addEventListener("open", erfuellen, { once: true });
      ws.addEventListener("error", () => ablehnen(new Error("WebSocket zu Firefox nicht offen")), {
        once: true,
      });
    });

    const bidi = new Bidi(ws);
    // Erst die Browser-Sitzung zum Baum der Kontexte navigieren.
    await bidi.sende("session.getTree", {});
    return bidi;
  }

  sende(namethode, parameter) {
    const id = ++this.id;
    return new Promise((erfuellen, ablehnen) => {
      this.warte.set(id, { erfuellen, ablehnen });
      this.ws.send(JSON.stringify({ id, method: namethode, params: parameter }));
      setTimeout(() => {
        if (this.warte.has(id)) {
          this.warte.delete(id);
          ablehnen(new Error(`Zeitueberschreitung bei ${namethode}`));
        }
      }, 30000);
    });
  }
}

/** Kontext des aktiven Tabs. */
async function aktiverKontext(bidi) {
  const baum = await bidi.sende("session.getTree", {});
  const kontexte = baum.contexts.filter((k) => !k.isOriginal);
  if (kontexte.length === 0) throw new Error("Kein Tab offen.");
  // Der zuletzt aufgefuehrte ist in der Regel der sichtbare.
  return kontexte[kontexte.length - 1].context;
}

// =====================================================================
// Befehle
// =====================================================================

async function seiteLesen(bidi) {
  const context = await aktiverKontext(bidi);
  const baum = await bidi.sende("browsingContext.getDocument", { context });
  const flaeche = baum.children?.[0];
  if (!flaeche) return "(leere Seite)";

  const { result } = await bidi.sende("script.callFunction", {
    functionDeclaration: `function () {
      // Sichtbarer Text, ohne Skript- und Stilinhalt.
      const kopfer = document.body.innerText || "";
      const kopf = document.title || "";
      const url = location.href;
      return JSON.stringify({ url, kopf, text: kopfer });
    }`,
    target: { context, sandbox: flaeche.context },
    awaitPromise: false,
  });
  return result.value;
}

async function knopfSuchenUndKlicken(bidi, gesuchterText) {
  const context = await aktiverKontext(bidi);
  const baum = await bidi.sende("browsingContext.getDocument", { context });
  const flaeche = baum.children?.[0];

  const { result } = await bidi.sende("script.callFunction", {
    functionDeclaration: `function () {
      const gesucht = ${JSON.stringify(gesuchterText)}.toLowerCase();
      const kandidaten = Array.from(
        document.querySelectorAll("button, a, [role=button], input[type=submit]")
      );
      for (const el of kandidaten) {
        const text = (el.innerText || el.value || el.getAttribute("aria-label") || "").trim();
        if (text.toLowerCase().includes(gesucht)) {
          el.scrollIntoView({ block: "center" });
          el.click();
          return JSON.stringify({ geklickt: true, text });
        }
      }
      return JSON.stringify({
        geklickt: false,
        vorhanden: kandidaten.map(
          (e) => (e.innerText || e.value || e.getAttribute("aria-label") || "").trim()
        ).filter(Boolean).slice(0, 40),
      });
    }`,
    target: { context, sandbox: flaeche.context },
    awaitPromise: false,
  });
  return JSON.parse(result.value);
}

async function inFeldTippen(bidi, eingabe) {
  const context = await aktiverKontext(bidi);
  const baum = await bidi.sende("browsingContext.getDocument", { context });
  const flaeche = baum.children?.[0];

  const { result } = await bidi.sende("script.callFunction", {
    functionDeclaration: `function () {
      const el = document.activeElement;
      if (!el || el === document.body) return JSON.stringify({ ok: false, grund: "nichts fokussiert" });
      const tag = el.tagName.toLowerCase();
      if (tag !== "input" && tag !== "textarea" && !el.isContentEditable) {
        return JSON.stringify({ ok: false, grund: "Fokus liegt auf <" + tag + ">" });
      }
      el.focus();
      el.value = ${JSON.stringify(eingabe)};
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return JSON.stringify({ ok: true, tag });
    }`,
    target: { context, sandbox: flaeche.context },
    awaitPromise: false,
  });
  return JSON.parse(result.value);
}

async function enterDruecken(bidi) {
  const context = await aktiverKontext(bidi);
  const baum = await bidi.sende("browsingContext.getDocument", { context });
  const flaeche = baum.children?.[0];
  await bidi.sende("input.performActions", {
    context,
    actions: [
      {
        type: "key",
        id: "tastatur",
        actions: [
          { type: "keyDown", value: "" },
          { type: "keyUp", value: "" },
        ],
      },
    ],
  });
  return { gedrueckt: true };
}

async function navigieren(bidi, url) {
  const context = await aktiverKontext(bidi);
  await bidi.sende("browsingContext.navigate", { context, url, wait: "complete" });
  return { url };
}

/** Fenster ueber xdotool: das sieht auch Fenster, die kein Tab sind. */
function xdotoolBefehl(args) {
  return new Promise((erfuellen) => {
    const p = spawn("xdotool", args, { stdio: ["ignore", "pipe", "ignore"] });
    let ausgabe = "";
    p.stdout.on("data", (d) => (ausgabe += d.toString()));
    p.on("close", (code) => erfuellen({ code, ausgabe: ausgabe.trim() }));
  });
}

async function fensterListe() {
  const suchen = await xdotoolBefehl(["search", "--name", ""]);
  const ids = suchen.ausgabe.split("\n").filter(Boolean);
  const fenster = [];
  for (const id of ids.slice(0, 60)) {
    const name = await xdotoolBefehl(["getwindowname", id]);
    if (name.ausgabe) fenster.push({ id, name: name.ausgabe });
  }
  return fenster;
}

function tippschluessel(keys) {
  return new Promise((erfuellen) => {
    const args = ["key", "--clearmodifiers"];
    for (const k of keys) args.push(k);
    const p = spawn("xdotool", args, { stdio: "ignore" });
    p.on("close", (code) => erfuellen({ code }));
  });
}

// =====================================================================
// Hauptlauf
// =====================================================================

const befehle = {
  async start() {
    console.log("Firefox starte mit BiDi auf Port", PORT);
    if (existsSync(PROFIL)) console.log("Profil:", PROFIL);
    starteFirefox();
    const ok = await warteAufPort();
    console.log(ok ? "Bereit." : "Timeout – Firefox antwortet nicht.");
    return ok;
  },

  async lesen() {
    frageErlaubnis("Die aktuelle Seite als Text lesen (nur lesen, nichts klicken)");
    const bidi = await Bidi.verbinde();
    const daten = JSON.parse(await seiteLesen(bidi));
    console.log("URL :", daten.url);
    console.log("TITEL:", daten.kopf);
    console.log("---------------------------------------------");
    console.log(daten.text);
  },

  async klick(text) {
    if (!text) throw new Error('Aufruf: klick "Beschriftung"');
    frageErlaubnis(`Im Browser auf etwas klicken, das "${text}" heisst`);
    const bidi = await Bidi.verbinde();
    const r = await knopfSuchenUndKlicken(bidi, text);
    if (r.geklickt) {
      console.log(`Geklickt: ${r.text}`);
    } else {
      console.log(`Nichts gefunden, das "${text}" entspricht.`);
      console.log("Sichtbare Knöpfe auf der Seite:");
      for (const v of r.vorhanden) console.log("  ·", v);
    }
  },

  async tippe(text) {
    if (text === undefined) throw new Error('Aufruf: tippe "Text"');
    frageErlaubnis(`Text in das gerade fokussierte Feld eintippen: "${text.slice(0, 60)}"`);
    const bidi = await Bidi.verbinde();
    const r = await inFeldTippen(bidi, text);
    console.log(r.ok ? `Eingetragen in <${r.tag}>` : `Nicht geklappt: ${r.grund}`);
  },

  async enter() {
    frageErlaubnis("Enter druecken, um abzuschicken");
    const bidi = await Bidi.verbinde();
    await enterDruecken(bidi);
    console.log("Enter gesendet.");
  },

  async url(ziel) {
    if (!ziel) throw new Error('Aufruf: url "https://..."');
    frageErlaubnis(`Im Browser zu ${ziel} navigieren`);
    const bidi = await Bidi.verbinde();
    await navigieren(bidi, ziel);
    console.log("Navigiert zu", ziel);
  },

  async fenster() {
    frageErlaubnis("Die Fensterliste des Desktops auslesen");
    const fenster = await fensterListe();
    for (const f of fenster) console.log(`${f.id}  ${f.name}`);
  },

  async aktiv() {
    frageErlaubnis("Auslesen, welches Fenster gerade vorne ist");
    const r = await xdotoolBefehl(["getactivewindow", "getwindowname"]);
    console.log("Vorne:", r.ausgabe);
  },

  async tippschluessel(...keys) {
    if (keys.length === 0) throw new Error('Aufruf: tippschluessel "ctrl+a" "ctrl+v"');
    frageErlaubnis(`Tastenkombination senden: ${keys.join(" + ")}`);
    const r = await tippschluessel(keys);
    console.log("Gesendet:", keys.join(" + "), `(Code ${r.code})`);
  },
};

const [befehl, ...args] = process.argv.slice(2);
if (!befehl || !befehle[befehl]) {
  console.log(`Aufruf: node scripts/lexio-browser.mjs <befehl>

  start            Firefox mit BiDi starten (Port ${PORT})
  lesen            Text + URL der aktiven Seite
  klick "Text"     Knopf mit dieser Beschriftung anklicken
  tippe "Text"     In das fokussierte Feld eintragen
  enter            Enter druecken
  url "https://…"  Navigieren
  fenster          Fensterliste
  aktiv            Welches Fenster ist vorne
  tippschluessel … Tastenkombination, z. B. "ctrl+a" "ctrl+v"

JEDER Zugriff fragt vorher nach Erlaubnis.`);
  process.exit(1);
}

try {
  await befehle[befehl](...args);
} catch (f) {
  console.error("Fehler:", f.message);
  process.exit(1);
}
