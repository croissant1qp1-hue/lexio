#!/usr/bin/env node
/**
 * Migrationen ausfuehren ueber die Supabase Management-API.
 *
 * Wofuer das da ist
 * -----------------
 * DDL geht per REST nicht. Ein `service_role`-Key darf ueber PostgREST
 * ausschliesslich das, was PostgREST kennt: Tabellen, Views und Funktionen.
 * Gelesen und geschrieben werden kann damit, `create table` nicht – dafuer
 * braucht es eine SQL-Verbindung. Die zwei Wege davor waren: Passwort in
 * `.env` und Handarbeit im SQL Editor. Beides im Projekt nicht brauchbar, das
 * erste nicht da, das zweite nur mit Anmeldung im Dashboard.
 *
 * Der Weg hier ist ein Personal Access Token: einmal in `.env` abgelegt, und
 * jede weitere Migration laeuft danach mit einem Befehl. Reihenfolge,
 * Pruefung und Ausgabe bleiben dabei in einem Skript, statt in vier offenen
 * Tabs.
 *
 * Voraussetzung
 * -------------
 * In `.env` steht:
 *
 *   SUPABASE_ACCESS_TOKEN=sbp_...
 *
 * Den Token gibt es unter Supabase → Settings → Account → Access Tokens.
 * Er wird nur gelesen, nie ausgegeben, und kommt in keine Datei ausser
 * `.env`. Der Token kann alles am Projekt, auch das Loeschen. Er gehoert
 * darum in `.env` und nicht in den Code und nicht in eine Doku.
 *
 * Aufruf
 * ------
 *   npm run db:migrieren                  # fragt die Datenbank und laeuft nur, was fehlt
 *   npm run db:migrieren 005 006          # nur die genannten, in dieser Reihenfolge
 *   npm run db:migrieren -- --trocken     # zeigt den Plan, fuehrt nichts aus
 *   npm run db:migrieren -- --alle        # jede Datei erneut, auch die schon steht
 *
 * Warum es die Datenbank fragt
 * ----------------------------
 * Bis 2026-10-04 stand hier eine fest verdrahtete Liste von fuenf Dateien
 * (003 bis 007), waehrend auf der Platte fuenfzehn lagen. `npm run
 * db:migrieren` ohne Argumente fuehrte also nur diese fuenf aus und schloss mit
 * "Alle Dateien gelaufen" — 008 bis 015 wuerden nie laufen, darunter die
 * Rechte-Reparatur aus 015. Nachgewiesen mit `--trocken`.
 *
 * Eine Datei, die schon steht, ist nicht harmlos wiederholbar: 014 musste dafuer
 * erst ein `on conflict` bekommen, und eine abgebrochene Datei laesst alles
 * stehen, was vorher in ihr passiert ist, und meldet trotzdem `ok`. Deshalb
 * wird der Stand gemessen (Merkmale aus `scripts/migrationen.mjs`) statt
 * geraten, und es laeuft nur, was nachweislich fehlt.
 *
 * Zwei Dinge laeuft dieses Skript nie: eine Datei ohne Merkmalspruefung — es
 * weiss dann nicht, ob sie steht — und eine Datei ohne Messergebnis, weil die
 * Abfrage fehlschlug. Beides waere geraten.
 *
 * Abbruch
 * -------
 * Beim ersten Fehler stoppt das Skript. Eine halb gelaufene Migration ist
 * schlimmer als eine nicht gelaufene, weil danach nicht mehr klar ist, wo man
 * war. Jede Datei muss selbst fuer sich lauffaehig sein, dann ist ein
 * Neustart an der naechsten Datei moeglich.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import {
  MIGRATIONEN,
  PRUEFUNGEN,
  dateienAufPlatte,
  frage,
  liesEnv,
  projektRef,
} from "./migrationen.mjs";

const argumente = process.argv.slice(2);
const trocken = argumente.includes("--trocken");
const alle = argumente.includes("--alle");
const genannt = argumente.filter((a) => !a.startsWith("--")).map((a) => `${a}.sql`);

const ok = (t) => `\x1b[32m${t}\x1b[0m`;
const schlecht = (t) => `\x1b[31m${t}\x1b[0m`;
const gelb = (t) => `\x1b[33m${t}\x1b[0m`;
const dick = (t) => `\x1b[1m${t}\x1b[0m`;

/** Kuerzt sehr lange Ausgaben, damit ein Terminal nicht zuschwimmt. */
function kurz(text, max = 400) {
  const s = String(text ?? "").replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function zeigeZeile(datei, zustand) {
  const p = path.join(MIGRATIONEN, datei);
  const gross = existsSync(p) ? statSync(p).size : 0;
  const zeilen = existsSync(p) ? readFileSync(p, "utf8").split("\n").length : 0;
  const zustandsText = {
    da: ok("da      "),
    fehlt: schlecht("FEHLT   "),
    egal: gelb("egal    "),
    unbekannt: gelb("?       "),
  }[zustand] ?? gelb("offen   ");
  console.log(`  ${zustandsText} supabase/migrations/${datei}  ${zeilen} Zeilen, ${gross} Byte`);
}

/**
 * Wiederholung fuer Leseabfragen, mit wachsender Wartezeit.
 *
 * Bewusst NICHT in `frage()` und bewusst nur fuer Messungen: die Management-API
 * drosselt, und beim ersten Durchlauf nach einer Pause flog genau eine der
 * fuenfzehn Abfragen heraus. Eine Migrationsanfrage darf man dagegen nicht
 * wiederholen — bricht sie nach dem Senden ab, kann die Datei halb gelaufen
 * sein, und derselbe Aufruf koennte sie ein zweites Mal anwenden.
 */
async function messeMitWiederholung(ref, token, sql) {
  let letzter;
  for (let versuch = 1; versuch <= 3; versuch += 1) {
    try {
      return await frage(ref, token, sql);
    } catch (fehler) {
      letzter = fehler;
      if (versuch < 3) await new Promise((r) => setTimeout(r, 400 * versuch));
    }
  }
  throw letzter;
}

/** Misst jede Merkmalspruefung. null heisst: Abfrage fehlgeschlagen, also unbekannt. */
async function messe(ref, token, vorhanden) {
  const stand = new Map();
  for (const p of PRUEFUNGEN) {
    if (!vorhanden.includes(p.datei)) continue;
    try {
      stand.set(p.datei, {
        zustand: (await messeMitWiederholung(ref, token, p.sql)).da === true,
        merkmal: p.merkmal,
        optional: !!p.optional,
      });
    } catch (fehler) {
      stand.set(p.datei, { zustand: null, merkmal: p.merkmal, optional: !!p.optional, fehler: fehler.message });
    }
  }
  return stand;
}

const env = liesEnv();
const token = env.SUPABASE_ACCESS_TOKEN;

if (!env.NEXT_PUBLIC_SUPABASE_URL || !token) {
  console.error(
    "\nEs fehlt eine der beiden Angaben:\n" +
      "  NEXT_PUBLIC_SUPABASE_URL   aus .env\n" +
      "  SUPABASE_ACCESS_TOKEN      aus den Supabase-Projekteinstellungen\n",
  );
  process.exit(1);
}

let ref;
try {
  ref = projektRef(env);
} catch (fehler) {
  console.error(fehler.message);
  process.exit(1);
}

if (/^dein|^\s*$|xxx|platzhalter/i.test(token)) {
  console.error("\nSUPABASE_ACCESS_TOKEN sieht noch nach einem Platzhalter aus. Bitte einen echten Token eintragen.");
  process.exit(1);
}

console.log(`Projekt  ${ref}`);

/* -------------------------------------------------- Was steht ueberhaupt da */

const vorhanden = dateienAufPlatte();
const bekannt = new Set(PRUEFUNGEN.map((p) => p.datei));
const ohnePruefung = vorhanden.filter((f) => !bekannt.has(f));

if (ohnePruefung.length > 0) {
  console.error(
    schlecht("\nDateien ohne Merkmalspruefung in scripts/migrationen.mjs:") +
      `\n  ${ohnePruefung.join("\n  ")}\n` +
      gelb(
        "\n  Ohne Pruefung weiss dieses Skript nicht, ob die Datei schon steht, und\n" +
          "  wuerde sie nach einem Zufall ausfuehren oder ueberspringen. Beides ist\n" +
          "  geraten. Bitte erst einen Eintrag mit Merkmal ergaenzen — mit einem\n" +
          "  Satz, wofuer das Merkmal steht.",
      ),
  );
  process.exit(1);
}

const eintraegeOhneDatei = [...bekannt].filter((f) => !vorhanden.includes(f));
if (eintraegeOhneDatei.length > 0) {
  console.error(
    schlecht("\nPruefungen ohne Datei: " + eintraegeOhneDatei.join(", ")) +
      gelb("\n  Umbenannt oder geloescht? Eintrag mit anpassen."),
  );
  process.exit(1);
}

/* -------------------------------------------------------------- Der Plan */

const stand = await messe(ref, token, vorhanden);

/*
 * "egal" heisst: die Datei darf ungelaufen sein (003b tut nichts mehr). Sie wird
 * gezeigt, aber nicht ausgefuehrt — sonst laeuft bei jedem Aufruf ein migration
 * ohne Wirkung und das Log sieht nach Arbeit aus.
 */
function zustandVon(datei) {
  const e = stand.get(datei);
  if (!e) return "unbekannt";
  if (e.zustand === true) return "da";
  if (e.zustand === false) return e.optional ? "egal" : "fehlt";
  return "unbekannt";
}

const fehlend = vorhanden.filter((d) => zustandVon(d) === "fehlt");
const unbestimmt = vorhanden.filter((d) => zustandVon(d) === "unbekannt");

if (alle) {
  /* nichts zu validieren: --alle nimmt jede Datei auf der Platte */
} else if (genannt.length > 0) {
  for (const d of genannt) {
    if (!vorhanden.includes(d)) {
      console.error(schlecht(`FEHLER  supabase/migrations/${d} gibt es nicht.`));
      process.exit(1);
    }
  }
  /* genannte Dateien sind bereits auf Existenz geprueft */
}

console.log(`Dateien  ${vorhanden.length} auf der Platte, ${fehlend.length} fehlen laut Messung\n`);

if (unbestimmt.length > 0) {
  console.error(
    gelb(`${unbestimmt.length} Pruefung(en) fehlgeschlagen, Stand unbekannt:`) +
      `\n${unbestimmt
        .map((d) => `  ${d}\n    ${kurz(stand.get(d).fehler, 200)}`)
        .join("\n")}\n` +
      gelb(
        "  Sie werden weder ausgefuehrt noch als erledigt gemeldet — dreimal " +
          "versucht.\n  `npm run db:pruefen` sagt mehr.\n",
      ),
  );
}

/*
 * Wer laeuft, steht genau einmal hier fest. Sonst zeigen Anzeige und Ausfuehrung
 * leicht verschiedene Dateien — und das waere genau die Sorte Fehler, die dieses
 * Projekt gerade abstellt.
 */
/*
 * Gezeigt wird immer der ganze Bestand, nicht nur die Auswahl: der Wert von
 * --trocken ist gerade, dass man sieht, was steht und was fehlt. Angezeigt wird
 * jede Datei; "→ laeuft" steht nur an den, die diese Runde wirklich trifft.
 */
const gezeigt = genannt.length > 0 ? vorhanden.filter((d) => genannt.includes(d)) : vorhanden;
const plan = gezeigt.map((datei) => {
  const zustand = zustandVon(datei);
  const ausdruecklich = genannt.length > 0 && genannt.includes(datei);
  const laeuft = (alle || ausdruecklich || zustand === "fehlt") && zustand !== "unbekannt";
  return { datei, zustand, laeuft };
});

console.log(dick("Plan"));
for (const eintrag of plan) {
  zeigeZeile(eintrag.datei, eintrag.laeuft ? "fehlt" : eintrag.zustand);
  if (eintrag.laeuft) {
    console.log(`         ${gelb("→ laeuft")}`);
  } else if (eintrag.zustand === "da" && (alle || genannt.length > 0)) {
    console.log(`         ${gelb("→ steht bereits, wird nur auf ausdruecklichen Wunsch wiederholt")}`);
  }
}

const laufende = plan.filter((e) => e.laeuft);

if (alle) {
  console.log(
    gelb(
      "\n--alle: jede Datei laeuft erneut, auch die, die schon steht. Ein erneuter Lauf\n" +
        "  kann Daten veraendern (015 setzt Rechte zurueck, 014 rechnet Bestand um).\n" +
        "  Nur mit Absicht.",
    ),
  );
} else if (fehlend.length === 0) {
  console.log(ok("\nEs fehlt nichts. Nichts auszufuehren."));
}

if (trocken) {
  console.log("\n--trocken: es wird nichts ausgefuehrt.");
  process.exit(0);
}

if (laufende.length === 0) {
  console.log(ok("\nNichts ausgefuehrt."));
  process.exit(0);
}

console.log(`\nToken    vorhanden (${token.length} Zeichen, wird nicht ausgegeben)\n`);

let schritt = 0;
for (const { datei } of laufende) {
  schritt += 1;
  const pfad = path.join(MIGRATIONEN, datei);
  const sql = readFileSync(pfad, "utf8");
  const t0 = Date.now();
  process.stdout.write(`[${schritt}/${laufende.length}] ${datei} … `);
  try {
    const ergebnis = await frage(ref, token, sql);
    const dauer = ((Date.now() - t0) / 1000).toFixed(1);
    const anzahl = Array.isArray(ergebnis) ? `${ergebnis.length} Zeilen` : kurz(ergebnis);
    console.log(`ok (${dauer}s)${anzahl ? ` — ${anzahl}` : ""}`);
  } catch (fehler) {
    console.log("FEHLGESCHLAGEN");
    console.error(`\n${fehler.message}\n`);
    if (fehler.status === 401) {
      console.error("  Der Token wurde abgelehnt. Wahrscheinlich ist er abgelaufen oder widerrufen.");
    }
    const rest = laufende.slice(schritt).map((d) => d.datei.replace(/\.sql$/, ""));
    console.error(
      `  Ab hier laeuft nichts mehr. ${rest.length} Datei(en) wurden nicht ausgefuehrt.\n` +
        `  Nach dem Beheben erneut starten:\n` +
        `    npm run db:migrieren -- ${rest.join(" ")}\n` +
        gelb(
          "  Danach bitte `npm run db:pruefen` — ob eine Datei wirklich steht, zeigt\n" +
            "  erst ihr Merkmal, nicht ihre Protokollzeile.",
        ),
    );
    process.exit(1);
  }
}

console.log(ok(`\n${laufende.length} Datei(en) gelaufen. Jetzt das, was wirklich zaehlt:`));
console.log("  npm run db:pruefen");
console.log(gelb("  Und danach `npm run db:status` fuer die Daten selbst.\n"));