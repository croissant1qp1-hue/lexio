"use client";

import { useEffect } from "react";

/**
 * Registriert den Service Worker beim App-Start (Phase 3.5 PWA).
 *
 * Bisher wurde public/sw.js nur aus den Einstellungen registriert, wenn der
 * Benutzer Push einschaltete – die Offline-App-Shell griff also nur, wenn
 * jemand zuvor die Erinnerung aktiviert hatte. Das hier registriert den
 * Worker (idempotent) immer, sobald die Seite geladen ist, ohne nach einer
 * Benachrichtigungs-Permission zu fragen.
 *
 * `updateViaCache: "none"` haelt den Worker frisch, statt auf die
 * http-Cache-Entscheidung des Browsers zu bauen: bei jedem Seitenstart wird
 * gegen /sw.js geprüft, ob eine neue Version da ist.
 */
export default function PwaRegistrierung() {
    useEffect(() => {
        if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
        navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(() => undefined);
    }, []);

    return null;
}