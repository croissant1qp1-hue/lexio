"use client";

import { alsUint8Array, vapidPublicKey } from "@/lib/push";

/**
 * Web-Push verdrahten: der Teil, der im Browser läuft.
 *
 * Reihenfolge ist wichtig und wird hier zusammengefasst, weil sie an genau
 * einer Stelle stehen soll – in den Einstellungen will der Benutzer "an",
 * und dafür müssen mehrere Dinge zusammenkommen:
 *
 *   1. Service Worker registrieren (public/sw.js). Erst dann kann der
 *      Browser Push empfangen.
 *   2. Benachrichtigungs-Permission erfragen. Ohne die Zustimmung des
 *      Benutzers zeigt der Browser keine Meldung an.
 *   3. Beim Push-Dienst abonnieren. Der Browser verhandelt mit dem Dienst
 *      ein Abo, das aus endpoint + Schlüsseln besteht.
 *   4. Das Abo an den Server melden (app/api/push/abonnement), damit
 *      scripts/erinnerung-senden.mjs es beim täglichen Versand kennt.
 *
 * Die Reihenfolge ist keine Willkür: `pushManager.subscribe` schlägt ohne
 * registrierten Service Worker fehl, und ein Abo für jemanden, der die
 * Berechtigung abgelehnt hat, wäre ein Betrug an der Zustimmung.
 */

const SW_PFAD = "/sw.js";

type PushErgebnis = { ok: boolean; fehler?: string };

/** Aktives Abo zu diesem Gerät finden, falls vorhanden. */
export async function holeAbo(): Promise<PushSubscription | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  if (!("PushManager" in window)) return null;
  const registrierung = await navigator.serviceWorker.getRegistration(SW_PFAD);
  if (!registrierung) return null;
  return registrierung.pushManager.getSubscription();
}

/**
 * Push einschalten. Liefert true, wenn das Abo danach wirklich aktiv ist.
 * Ein abgelehntes Nein (der Browser-Fenster-Permission) ist kein Fehler,
 * sondern eine Auskunft.
 */
export async function pushAn(): Promise<PushErgebnis> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return { ok: false, fehler: "Dieser Browser unterstützt keine Benachrichtigungen." };
  }
  if (!("PushManager" in window)) {
    return { ok: false, fehler: "Dieser Browser unterstützt keine Push-Benachrichtigungen." };
  }
  try {
    const registrierung = await navigator.serviceWorker.register(SW_PFAD);
    const berechtigung = await Notification.requestPermission();
    if (berechtigung !== "granted") {
      return { ok: false, fehler: "Die Benachrichtigungen wurden nicht erlaubt." };
    }
    const abo = await registrierung.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: alsUint8Array(vapidPublicKey()),
    });

    const antwort = await fetch("/api/push/abonnement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(abo.toJSON()),
    });
    if (!antwort.ok) {
      // Abo wieder beenden, damit kein "an" ohne Server-Eintrag bleibt.
      await abo.unsubscribe().catch(() => undefined);
      const daten = (await antwort.json().catch(() => null)) as { error?: string } | null;
      return { ok: false, fehler: daten?.error ?? `Abo nicht gespeichert (${antwort.status}).` };
    }
    return { ok: true };
  } catch (fehler) {
    return { ok: false, fehler: fehler instanceof Error ? fehler.message : "Benachrichtigungen konfigurieren schlug fehl." };
  }
}

/** Push ausschalten: das Server-Abo dieses Geräts entfernen und das Browser-Abo beenden. */
export async function pushAus(): Promise<PushErgebnis> {
  try {
    const abo = await holeAbo();
    if (abo) {
      const antwort = await fetch("/api/push/abonnement", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: abo.endpoint }),
      });
      await abo.unsubscribe().catch(() => undefined);
      if (!antwort.ok) {
        const daten = (await antwort.json().catch(() => null)) as { error?: string } | null;
        return { ok: false, fehler: daten?.error ?? "Abmelden schlug fehl." };
      }
    }
    return { ok: true };
  } catch (fehler) {
    return { ok: false, fehler: fehler instanceof Error ? fehler.message : "Ausschalten schlug fehl." };
  }
}