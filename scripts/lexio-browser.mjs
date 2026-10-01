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
 *   browser (WebDriver BiDi)  Lesen UND Klicken. Der Normalfall.
 *   xdotool                  Taste/Position, wenn BiDi eine Seite nicht sieht
 *                              (z. B. weil sie in einem Fenster steckt, das
 *                              BiDi nicht als Tab kennt).
 *
 * ERLAUBNIS
 * ---------
 * Jeder befeehlende Zugriff auf den Browser -- also Start, Lesen und Klicken --
 * laeuft durch `frageErlaubnis()`. Sie wird per Terminal-Rueckfrage
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
import { readFileSync, existsSync, mkdirSync, openSync, writeSync, closeSync } from "node:fs";

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
  // Kein Bypass. Es gibt bewusst keinen Environment-Schalter, der die
  // Frage ueberspringt -- sonst waere die Zusage "ich frage immer" nur
  // noch eine Behauptung.
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
        "  Es gibt keinen Weg, diese Frage zu ueberspringen.\n",
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
// Firefox starten
// =====================================================================

const PROFIL = "/tmp/lexio-firefox-profil";
const PORT = 9222;

/**
 * Startet Firefox mit dem BiDi-Port.
 *
 * Zwei Stolpersteine, beide an diesem Rechner erprobt:
 *
 * 1. Das Profilverzeichnis muss existieren. Fehlt es, startet Firefox gar
 *    erst nicht -- ohne jede Fehlermeldung, der Prozess ist einfach weg.
 * 2. `firefox-esr` statt `/usr/bin/firefox`: letzteres ist ein
 *    Wrapper-Skript, das den Aufruf haengt, statt zurueckzukehren.
 */
function starteFirefox() {
  mkdirSync(PROFIL, { recursive: true });

  // Eine alte Instanz mit diesem Profil blockiert alles: Firefox nimmt
  // dann keine zweite BiDi-Sitzung mehr an ("session not created") und
  // --no-remote hilft nur beim Start, nicht danach. Deshalb erst beenden.
  //
  // Zwei Feinheiten, beide hier schon passiert:
  //   * "--" vor dem Muster. Sonst liest pkill das "--profile ..." als
  //     Option und bricht mit "Unbekannte Option" ab, statt zu killen.
  //   * `spawn` statt `exec`, damit kein Shell-Prozess entsteht, dessen
  //     eigene Kommandozeile das Suchmuster enthaelt und sich mit toetet.
  spawn("pkill", ["-f", "--", `--profile ${PROFIL}`], { stdio: "ignore" });
}

async function warteAufFreienPort(maxSekunden = 15) {
  for (let i = 0; i < maxSekunden * 2; i++) {
    try {
      await fetch(`http://127.0.0.1:${PORT}/session`);
    } catch {
      return true; // nichts mehr lauscht -> Port ist frei
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function starteFirefoxFrisch() {
  starteFirefox();
  // Ohne diese Pause startet der neue Firefox, waehrend der alte noch
  // am Beenden ist -- und stirbt dann sofort wieder, ohne jede Meldung.
  const frei = await warteAufFreienPort();
  if (!frei) {
    throw new Error(
      `Port ${PORT} ist noch belegt. Bitte den alten Firefox mit diesem\n` +
        "  Profil schliessen und es noch einmal versuchen.",
    );
  }

  const p = spawn(
    "firefox-esr",
    ["--remote-debugging-port", String(PORT), "--profile", PROFIL, "--no-remote", "about:blank"],
    { detached: true, stdio: "ignore" },
  );
  p.unref();
  return true;
}

/**
 * Wartet, bis Firefox die BiDi-Adresse meldet.
 *
 * Es gibt keinen HTTP-Endpunkt, den man abfragen koennte: /json/list
 * antwortet mit 404, und der WebSocket lehnt jeden normalen GET ab. Der
 * Trick ist deshalb, den Handshake zu versuchen -- die Fehlermeldung
 * "handshake request has incorrect Upgrade header" beweist, dass der
 * Server lebt.
 */
async function warteAufPort(maxSekunden = 30) {
  for (let i = 0; i < maxSekunden * 2; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/session`);
      const text = await r.text();
      if (text.includes("handshake")) return true;
    } catch {
      /* noch nicht bereit */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

// =====================================================================
// Verbindung
// =====================================================================

/** Die zuletzt geoeffnete Sitzung, damit sie beim Beenden freigegeben wird. */
let aktiveSitzung = null;

class Bidi {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.sessionId = null;
    this.waitetAuf = new Map();

    ws.addEventListener("message", (ev) => {
      let nachricht;
// Strg+C laeuft an `finally` vorbei und wuerde die Sitzung wieder
// liegen lassen -- also eigens abfangen und sauber beenden.
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    const aufraeumen = aktiveSitzung ? aktiveSitzung.beenden() : Promise.resolve();
    aufraeumen.finally(() => process.exit(130));
  });
}

try {
        nachricht = JSON.parse(ev.data);
      } catch {
        return;
      }
      const eintrag = this.waitetAuf.get(nachricht.id);
      if (!eintrag) return;
      this.waitetAuf.delete(nachricht.id);
      if (nachricht.type === "error") {
        eintrag.ablehnen(new Error(nachricht.error));
      } else {
        eintrag.erfuellen(nachricht.result);
      }
    });
  }

  static async verbinde() {
    // Wichtig: ohne Sub-Protokoll. Mit "web-bidi-devtools" verlangt
    // Firefox eine Freigabe, die hier nicht erteilt wird, und schliesst
    // die Verbindung sofort (Fehler 1006).
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/session`);

    await new Promise((erfuellen, ablehnen) => {
      ws.addEventListener("open", erfuellen, { once: true });
      ws.addEventListener("error", () => ablehnen(new Error("WebSocket zu Firefox nicht offen")), {
        once: true,
      });
    });

    const bidi = new Bidi(ws);
    aktiveSitzung = bidi;

    /*
     * Jeder Befehl traegt die Kennung der Sitzung, die Firefox selbst
     * vergibt. Ohne sie kommt "invalid session id" zurueck. Und die
     * Befehlsnamen sind nicht die, die man aus dem WebDriver-Kommandokompendium
     * kennt: aus browsingContext.getTree wird der Tab, aus
     * script.evaluate der Seiteninhalt. "session.getTree" existiert nicht.
     */
    const neu = await bidi.sende("session.new", { capabilities: {} }).catch((f) => {
      if (f.message.includes("session not created")) {
        throw new Error(
          "Firefox haelt noch eine alte Sitzung fest und nimmt keine neue an.\n" +
            "  Loesung: erst 'start' ausfuehren -- das beendet die alte Instanz und\n" +
            "  startet Firefox mit einem frischen Profil neu.",
        );
      }
      throw f;
    });
    bidi.sessionId = neu.sessionId;
    return bidi;
  }

  sende(namethode, parameter = {}) {
    const id = ++this.id;
    // session.new selbst darf keine Kennung tragen -- sie entsteht ja erst.
    const mitKennung =
      this.sessionId && namethode !== "session.new"
        ? { ...parameter, sessionId: this.sessionId }
        : parameter;

    return new Promise((erfuellen, ablehnen) => {
      this.waitetAuf.set(id, { erfuellen, ablehnen });
      this.ws.send(JSON.stringify({ id, method: namethode, params: mitKennung }));
      setTimeout(() => {
        if (this.waitetAuf.has(id)) {
          this.waitetAuf.delete(id);
          ablehnen(new Error(`Zeitueberschreitung bei ${namethode}`));
        }
      }, 30000);
    });
  }

  /** Der sichtbare Tab. */
  async tab() {
    const baum = await this.sende("browsingContext.getTree", {});
    const oben = baum.contexts.filter((k) => !k.parent);
    if (oben.length === 0) throw new Error("Firefox hat keinen offenen Tab.");
    const seiten = oben[oben.length - 1];
    return { kontext: seiten.context, url: seiten.url, alle: baum.contexts };
  }

  /**
 * Gibt die Sitzung wieder frei.
   *
   * Firefox erlaubt nur eine BiDi-Sitzung zur Zeit. Bricht ein Lauf ab --
   * durch einen Fehler, ein Ctrl+C oder ein Timeout --, bleibt sie sonst
   * liegen, und der naechste Aufruf scheitert an "session not created".
   * Deshalb wird hier im finally immer aufgeraeumt.
   */
  async beenden() {
    if (!this.sessionId) return;
    try {
      await this.sende("session.end", {});
    } catch {
      /* Firefox ist schon weg -- dann ist nichts zu tun. */
    }
  }

  /** Wert eines Ausdrucks in der Seite, als Text. */
  async ausdruck(quelle) {
    const { kontext } = await this.tab();
    const r = await this.sende("script.evaluate", {
      expression: `JSON.stringify(${quelle})`,
      target: { context: kontext },
      awaitPromise: true,
    });
    if (r.type === "exception") {
      throw new Error(r.exceptionDetails?.text ?? "Fehler im Ausdruck");
    }
    // Bei einem String liefert BiDi { type: "string", value: "..." },
    // sonst den Wert direkt.
    return typeof r.result === "object" && r.result !== null && "value" in r.result
      ? r.result.value
      : r.result;
  }
}

// =====================================================================
// Befehle
// =====================================================================

async function seiteLesen(bidi) {
  return JSON.parse(
    await bidi.ausdruck(
      `{ url: location.href, kopf: document.title, text: document.body ? document.body.innerText : "" }`,
    ),
  );
}

/**
 * Klickt auf ein Element mit passendem Text.
 *
 * Eine Seite hat oft mehrere gleichnamige Knöpfe -- auf Lexio etwa den
 * Reiter "Konto erstellen" und den Senden-Knopf "Konto erstellen".
 * Blind der erste Treffer zu sein, klikkt also daneben. Deshalb wird
 * zuerst sortiert: was wirklich ein Knopf ist und in einem Formular
 * liegt, gewinnt vor einem Reiter oder einem Link. Bei Restgleichstand
 * wird nichts geklickt, sondern die Auswahl gezeigt -- erraten gehoert
 * sich nicht.
 */
async function knopfSuchenUndKlicken(bidi, gesuchterText, gewaehlt = null) {
  return JSON.parse(
    await bidi.ausdruck(`(function () {
      const gesucht = ${JSON.stringify(gesuchterText)}.toLowerCase();
      const gewaehlt = ${JSON.stringify(gewaehlt)};
      const textVon = (el) =>
        (el.innerText || el.value || el.getAttribute("aria-label") || "").trim();

      const treffer = Array.from(
        document.querySelectorAll("button, a, [role=button], input[type=submit]")
      ).filter((el) => textVon(el).toLowerCase().includes(gesucht));

      // Rangfolge: echter Knopf im Formular > Knopf > Link > sonstiges
      const rang = (el) => {
        const istFormularKnopf =
          (el.tagName === "BUTTON" || el.type === "submit") && el.closest("form");
        if (istFormularKnopf) return 0;
        if (el.tagName === "BUTTON" || el.type === "submit" || el.getAttribute("role") === "button") return 1;
        if (el.tagName === "A" && el.getAttribute("href")) return 2;
        return 3;
      };
      treffer.sort((a, b) => rang(a) - rang(b));

      const liste = treffer.map((el, i) => ({
        i, rang: rang(el), text: textVon(el), tag: el.tagName.toLowerCase(),
        imFormular: !!el.closest("form"),
      }));

      if (treffer.length === 0) {
        return { geklickt: false, grund: "nichts gefunden",
          vorhanden: Array.from(document.querySelectorAll("button, a, [role=button]"))
            .map(textVon).filter(Boolean).slice(0, 40) };
      }
      if (treffer.length > 1 && gewaehlt === null) {
        const besterRang = rang(treffer[0]);
        const gleichwertig = treffer.filter((el) => rang(el) === besterRang).length;
        if (gleichwertig > 1) {
          return { geklickt: false, mehrdeutig: true, treffer: liste };
        }
      }

      const el = gewaehlt === null ? treffer[0] : treffer[gewaehlt];
      if (!el) return { geklickt: false, grund: "Nummer existiert nicht", treffer: liste };
      el.scrollIntoView({ block: "center" });
      el.click();
      return { geklickt: true, text: textVon(el), tag: el.tagName.toLowerCase(), von: treffer.length };
    })()`),
  );
}

/**
 * Tippt in ein Formularfeld.
 *
 * Zwei Feinheiten, ohne die es bei React-Formularen nicht geht:
 *
 * 1. Der Wert darf nicht mit `el.value = ...` gesetzt werden. React
 *    haengt an jedes Feld einen Tracker, der den alten Wert merkt, und
 *    schluckt das Ereignis dann als "unveraendert". Der native Setter
 *    umgeht den Tracker.
 * 2. Ist nichts fokussiert, wird das Feld über einen Hinweis gesucht --
 *    sonst wäre man auf Glück und Tabulator angewiesen.
 */
async function inFeldTippen(bidi, eingabe, feldhinweis) {
  return JSON.parse(
    await bidi.ausdruck(`(function () {
      const istEingabefeld = (el) =>
        el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      const hinweis = ${JSON.stringify(feldhinweis ?? null)};

      let el = document.activeElement;
      let wie = "Fokus";

      // Ein Hinweis gewinnt immer. Sonst landet alles im ersten Feld:
      // nach dem Tippen bleibt dieses fokussiert, und der naechste
      // Aufruf schreibt wieder hinein.
      if (hinweis) {
        const nadel = hinweis.toLowerCase();
        const alle = Array.from(document.querySelectorAll("input, textarea, [contenteditable]"));
        el = alle.find((f) => {
          const beschreibung = [
            f.placeholder, f.name, f.id, f.getAttribute("aria-label"),
            f.labels && f.labels[0] ? f.labels[0].innerText : "",
          ].filter(Boolean).join(" ").toLowerCase();
          return beschreibung.includes(nadel) && f.type !== "checkbox";
        });
        if (!el) {
          return {
            ok: false,
            grund: "kein Feld mit dem Hinweis",
            vorhanden: Array.from(document.querySelectorAll("input, textarea")).map(
              (f) => f.type + ": " + (f.placeholder || f.name || f.id || "?")
            ),
          };
        }
        wie = "gefunden";
      } else if (!istEingabefeld(el) || el === document.body) {
        return { ok: false, grund: "nichts fokussiert und kein Feldhinweis angegeben" };
      }

      el.focus();
      const text = ${JSON.stringify(eingabe)};
      if (el.isContentEditable) {
        el.textContent = text;
      } else {
        // Der native Setter, nicht el.value = ...
        const proto = el instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setzen = Object.getOwnPropertyDescriptor(proto, "value").set;
        setzen.call(el, text);
      }
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return { ok: true, tag: el.tagName.toLowerCase(), wie, laenge: String(text).length };
    })()`),
  );
}

/**
 * Sendet eine einzelne Taste an die Seite.
 *
 * Bewusst ueber BiDi und nicht ueber xdotool: xdotool schickt an das
 * gerade vorne liegende Fenster des Desktops -- und das ist nicht
 * zwangslaeufig das Testfenster. Bei einer falschen Taste im falschen
 * Fenster loescht man dem Nutzer gerade Texte. BiDi bleibt im Tab.
 */
const TASTEN = {
  enter: String.fromCharCode(0xe007),
  space: String.fromCharCode(0xe00d),
  tab: String.fromCharCode(0xe004),
  esc: String.fromCharCode(0xe00c),
  pfeilup: String.fromCharCode(0xe013),
  pfeilunten: String.fromCharCode(0xe015),
  pfeillinks: String.fromCharCode(0xe012),
  pfeilrechts: String.fromCharCode(0xe014),
};

async function tasteDruecken(bidi, name) {
  const klein = String(name).toLowerCase();
  const wert = TASTEN[klein] ?? name;

  const { kontext } = await bidi.tab();
  await bidi.sende("input.performActions", {
    context: kontext,
    actions: [
      {
        type: "key",
        id: "tastatur",
        actions: [
          { type: "keyDown", value: wert },
          { type: "keyUp", value: wert },
        ],
      },
    ],
  });
  return { taste: name };
}

async function navigieren(bidi, url) {
  const { kontext } = await bidi.tab();
  await bidi.sende("browsingContext.navigate", { context: kontext, url, wait: "complete" });
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
    // Auch das Starten greift auf den Browser zu: ein Fenster geht auf,
    // das vorher nicht da war. Also gehoert es unter dieselbe Schranke
    // wie alles andere.
    frageErlaubnis("Firefox mit einem eigenen Fenster starten, zum Lesen und Bedienen");
    console.log(`Firefox starte auf Port ${PORT}`);
    if (existsSync(PROFIL)) console.log("Profil:", PROFIL);
    await starteFirefoxFrisch();
    const ok = await warteAufPort();
    console.log(ok ? "Bereit." : "Timeout – Firefox antwortet nicht.");
    return ok;
  },

  async lesen() {
    frageErlaubnis("Die aktuelle Seite als Text lesen (nur lesen, nichts klicken)");
    const bidi = await Bidi.verbinde();
    const daten = await seiteLesen(bidi);
    console.log("URL :", daten.url);
    console.log("TITEL:", daten.kopf);
    console.log("---------------------------------------------");
    console.log(daten.text);
  },

  async klick(text, nummer) {
    if (!text) throw new Error('Aufruf: klick "Beschriftung" [Nummer]');
    const gewaehlt = nummer === undefined ? null : Number(nummer);
    frageErlaubnis(
      `Im Browser auf etwas klicken, das "${text}" heisst` +
        (gewaehlt === null ? "" : ` (Nummer ${gewaehlt})`),
    );
    const bidi = await Bidi.verbinde();
    const r = await knopfSuchenUndKlicken(bidi, text, gewaehlt);
    if (r.geklickt) {
      console.log(`Geklickt: <${r.tag}> "${r.text}" (von ${r.von} Treffern)`);
    } else if (r.mehrdeutig) {
      console.log(`"${text}" ist mehrdeutig -- es gibt ${r.treffer.length} Treffer:`);
      for (const t of r.treffer) {
        console.log(`  [${t.i}] <${t.tag}> "${t.text}"${t.imFormular ? " (im Formular)" : ""}`);
      }
      console.log(`Erneut mit Nummer: klick "${text}" 0`);
    } else {
      console.log(`Nichts gefunden, das "${text}" entspricht. ${r.grund ?? ""}`);
      if (r.vorhanden) {
        console.log("Sichtbare Knöpfe auf der Seite:");
        for (const v of r.vorhanden) console.log("  ·", v);
      }
    }
  },

  async tippe(text, feldhinweis) {
    if (text === undefined) throw new Error('Aufruf: tippe "Text" [Feldhinweis]');
    frageErlaubnis(
      `Text in ein Formularfeld eintippen: "${text.slice(0, 40)}"` +
        (feldhinweis ? ` (Feld: ${feldhinweis})` : " (ins fokussierte Feld)"),
    );
    const bidi = await Bidi.verbinde();
    const r = await inFeldTippen(bidi, text, feldhinweis);
    if (r.ok) {
      console.log(`Eingetragen in <${r.tag}> (${r.wie}), ${r.laenge} Zeichen.`);
    } else {
      console.log(`Nicht geklappt: ${r.grund}`);
      if (r.vorhanden) {
        console.log("Felder auf der Seite:");
        for (const v of r.vorhanden) console.log("  ·", v);
      }
    }
  },

  async enter() {
    frageErlaubnis("Enter druecken, um abzuschicken");
    const bidi = await Bidi.verbinde();
    await tasteDruecken(bidi, "enter");
    console.log("Enter gesendet.");
  },

  async taste(name) {
    if (!name) throw new Error('Aufruf: taste "space" | taste "1" | taste "enter"');
    frageErlaubnis(`Taste "${name}" an die Seite senden`);
    const bidi = await Bidi.verbinde();
    await tasteDruecken(bidi, name);
    console.log(`Gesendet: ${name}`);
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
  klick "Text" [Nr.]  Knopf oder Link anklicken, optional der n-te Treffer
  tippe "Text" [Feld]  In ein Formularfeld eintragen
  enter            Enter druecken
  taste "space"    Eine Taste an die Seite senden (z. B. space, 1, enter)
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
  process.exitCode = 1;
} finally {
  // Immer freigeben, sonst blockiert die verwaiste Sitzung den naechsten Aufruf.
  if (aktiveSitzung) await aktiveSitzung.beenden();
}
