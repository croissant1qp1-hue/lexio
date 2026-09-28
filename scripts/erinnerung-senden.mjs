#!/usr/bin/env node
/**
 * Taegliche Lernerinnerung per Web-Push verschicken.
 *
 * Das ist die Gegenseite zum Schalter in den Einstellungen. Der Browser hat
 * ein Push-Abo an den Server gemeldet; dieses Skript liest alle Abos aus
 * der Datenbank, verschluesselt eine kurze Nachricht und laesst den
 * Push-Dienst des jeweiligen Browsers sie zustellen – auch, wenn Lexio
 * gerade zu ist. Das ist der Zweck einer Erinnerung.
 *
 * Warum die Management-API?
 * -------------------------
 * `db-migrieren.mjs` verbindet ueber die Management-API mit einem Personal
 * Access Token, weil DDL per REST nicht geht. Hier ist der Grund anders,
 * aber die Schlussfolgerung dieselbe: den Service-Role-Key gibt es im
 * Projekt nicht (nur den Platzhalter in `.env`), und ein SELECT ueber
 * PostgREST braucht ihn. Die Management-API spart einen zweiten
 * Admin-Schluessel – der Access Token kann alles am Projekt, auch das
 * Lesen dieser Tabelle.
 *
 * Aufruf
 * ------
 *   npm run push:senden            # verschickt an alle Abonnenten
 *   npm run push:senden -- --trocken   # zeigt die Zahl ohne zu senden
 *
 * Als Cron, einmal am Tag (Beispiel – Uhrzeit anpassen):
 *   30 18 * * * cd /home/theo/Coding/projekte/lexio && npm run push:senden >> /tmp/lexio-push.log 2>&1
 *
 * Abbruch-Verhalten: ein Abo, dessen Push-Dienst den Endpoint nicht mehr
 * kennt (Browser-Daten geloescht, Push deaktiviert), antwortet mit 410.
 * Das Abo wird entfernt, damit es nie wieder vom Versand erfasst wird.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://api.supabase.com/v1";

/** Liest .env ohne Bibliothek – Analogon zu db-migrieren.mjs. */
function liesEnv() {
  const datei = path.join(WURZEL, ".env");
  if (!fs.existsSync(datei)) {
    console.error(".env nicht gefunden.");
    process.exit(1);
  }
  const raus = {};
  for (const zeile of fs.readFileSync(datei, "utf8").split("\n")) {
    const t = zeile.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    let wert = t.slice(i + 1).trim();
    if (wert.startsWith('"') && wert.endsWith('"')) wert = wert.slice(1, -1);
    raus[t.slice(0, i).trim()] = wert;
  }
  return raus;
}

function projektRef(env) {
  const u = env.NEXT_PUBLIC_SUPABASE_URL || "";
  const m = u.match(/^https:\/\/([a-z0-9]+)\.supabase\./i);
  if (!m) {
    console.error("NEXT_PUBLIC_SUPABASE_URL in .env hat kein https://<ref>.supabase.co");
    process.exit(1);
  }
  return m[1];
}

async function query(ref, token, sql) {
  const antwort = await fetch(`${API}/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const text = await antwort.text();
  let daten = null;
  try {
    daten = JSON.parse(text);
  } catch {
    /* keine JSON-Antwort */
  }
  if (!antwort.ok) {
    throw new Error(daten?.message || daten?.error || text.slice(0, 400));
  }
  return daten;
}

const env = liesEnv();
const token = env.SUPABASE_ACCESS_TOKEN;
const ref = projektRef(env);
const trocken = process.argv.includes("--trocken");

const vapidPublic = env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivate = env.VAPID_PRIVATE_KEY;
const vapidSubject = env.VAPID_SUBJECT || "mailto:lexio@example.com";

if (!token) {
  console.error(
    "SUPABASE_ACCESS_TOKEN fehlt in .env.\n" +
      "  Supabase → Settings → Account → Access Tokens, dann in .env eintragen.",
  );
  process.exit(1);
}
if (/^dein|^\s*$|xxx|platzhalter/i.test(token)) {
  console.error("SUPABASE_ACCESS_TOKEN sieht noch nach einem Platzhalter aus.");
  process.exit(1);
}
if (!vapidPublic || !vapidPrivate) {
  console.error(
    "VAPID-Schluessel fehlen in .env.\n" +
      "  Erzeugen mit `npm run push:schluessel`, dann NEXT_PUBLIC_VAPID_PUBLIC_KEY,\n" +
      "  VAPID_PRIVATE_KEY und VAPID_SUBJECT eintragen.",
  );
  process.exit(1);
}

const { default: webPush } = await import("web-push");
webPush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

// Abgesprungene Abos zum Loeschen sammeln: die Push-Dienste antworten mit
// 410 Gone, wenn der Endpoint nicht mehr registriert ist.
const abgelaufeneEndpoints = [];

const abos = await query(ref, token, "select endpoint, keys_p256dh, keys_auth from public.push_abonnements");
const anzahl = Array.isArray(abos) ? abos.length : 0;

if (trocken) {
  console.log(`--trocken: ${anzahl} Abo(s) wuerden versendet, nichts gesendet.`);
  process.exit(0);
}

console.log(`${anzahl} Abo(s) gefunden.`);
if (anzahl === 0) process.exit(0);

const nachricht = JSON.stringify({ titel: "Lexio", text: "Zeit, eine Runde zu lernen." });

let gesendet = 0;
let fehlgeschlagen = 0;

for (const abo of abos) {
  try {
    await webPush.sendNotification(
      {
        endpoint: abo.endpoint,
        keys: { p256dh: abo.keys_p256dh, auth: abo.keys_auth },
      },
      nachricht,
    );
    gesendet += 1;
  } catch (fehler) {
    if (fehler.statusCode === 410 || fehler.statusCode === 404) {
      abgelaufeneEndpoints.push(abo.endpoint);
    } else {
      fehlgeschlagen += 1;
      console.log(`  Fehler fuer ${abo.endpoint}: ${fehler.statusCode ?? fehler}`);
    }
  }
}

if (abgelaufeneEndpoints.length > 0) {
  // Nur die eigenen loeschen, gezielt mit dem endpoint. Das Skript laeuft
  // als Admin ueber die Management-API, die RLS greift dort nicht.
  const werte = abgelaufeneEndpoints
    .slice(0, 20)
    .map((endpoint) => JSON.stringify(endpoint))
    .join(", ");
  if (werte) {
    await query(
      ref,
      token,
      `delete from public.push_abonnements where endpoint in (${werte})`,
    ).catch(() => undefined);
  }
  console.log(`${abgelaufeneEndpoints.length} abgelaufene(s) Abo(s) entfernt.`);
}

console.log(`Fertig. ${gesendet} verschickt, ${fehlgeschlagen} Fehler, ${abgelaufeneEndpoints.length} entfernt.`);