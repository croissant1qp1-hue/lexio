#!/usr/bin/env node
/**
 * VAPID-Schluessel fuer Web-Push erzeugen.
 *
 * Gibt die drei Zeilen aus, die in `.env` gehoeren (Public-Key,
 * Private-Key, Subject). Der Public-Key darf als NEXT_PUBLIC in den
 * Browser; der Private-Key nur in Server-Skripte, nie ins Frontend.
 *
 * Aufruf: npm run push:schluessel
 *
 * Die Ausgabe direkt in den Editor uebernehmen:
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
 *   VAPID_PRIVATE_KEY=...
 *   VAPID_SUBJECT=mailto:du@beispiel.de
 */

import { generateVAPIDKeys } from "web-push";

const schluessel = generateVAPIDKeys();

console.log("Diese drei Zeilen in .env eintragen:\n");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${schluessel.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${schluessel.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:deine@email.de`);
console.log("\nDanach laeuft `npm run push:senden -- --trocken` ohne Schluessel-Fehler.");