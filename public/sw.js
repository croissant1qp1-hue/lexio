/**
 * Service Worker für die tägliche Erinnerung – und, seit Phase 3.5, für
 * die PWA.
 *
 * 1. Push (Phase 3.1): nimmt die Push-Nachricht entgegen, die
 *    scripts/erinnerung-senden.mjs verschickt, und zeigt sie als
 *    System-Benachrichtigung. Der Klick darauf öffnet (oder fokussiert) die
 *    Übersichtsseite.
 * 2. Offline (Phase 3.5): hält die App-Shell (HTML, CSS, JavaScript,
 *    Fonts, Icons) im Cache, damit Lexio nach dem ersten Laden auch ohne
 *    Netz öffnet – die Idee dahinter ist "Lernen im Zug". Die eigentlichen
 *    Daten (Karten, Fortschritt) kommen weiterhin live von der API: die
 *    Fetchs bleiben `cache: "no-store"`, damit nie eine alte Vokabel
 *    statt der frischen erscheint. Bewusst kein Cachen von /api/*.
 *
 * Die Datei liegt in public/ und wird deshalb unter /sw.js ausgeliefert.
 * Registriert wird sie beim App-Start (components/pwa/pwa-registrierung.tsx)
 * und beim Push-Einschalten (lib/push-client.ts).
 *
 * Wichtig: kein ES-Modul. Ein Service Worker in der untersten Verzeichnis-
 * ebene verwendet klassische Skript-Semantik, kein `import` – und genau so
 * unterstützen ihn alle Browser. Wird die Datei später doch ein Modul,
 * muss die Registrierung `{ type: "module" }` mitgeben.
 */

/* Cache-Name mit Versionsnummer; beim Aktivieren fliegen alle älteren
   lexio-*-Caches raus, damit ein Update nicht auf die alte App-Shell
   zurückfällt, die auf eine neue Version zeigen könnte. */
const CACHE_NAME = "lexio-shell-v1";

/* Der Mindestsatz, damit die App ohne Netz aufklappt: das Start-HTML, das
   Manifest und die beiden installierten Icons. Alles Weitere kommt beim
   ersten Besuch über den fetch-Handler in denselben Cache. */
const PRE_CACHE = [
  "/",
  "/manifest.webmanifest",
  "/images/icon-192.png",
  "/images/icon-512.png",
  "/images/icon-maskable-512.png",
];

self.addEventListener("install", (event) => {
  // Pre-Cache nicht an der Oberflaeche scheitern lassen: haengt das Netz,
  // soll der Worker trotzdem installiert bleiben und beim naechsten Start
  // die Shell nachholen.
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => Promise.allSettled(PRE_CACHE.map((u) => cache.add(u)))),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((namen) =>
        Promise.all(
          namen.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/* Offline-Strategie (Phase 3.5):
   – Navigationen: erst Netz, bei Fehlschlag der Cache ("network-first").
     So ist online immer die frische Seite da, offline die zuletzt
     gesehene App-Shell.
   – Statische Teile (/_next/static, /images): erst Cache, daneben wird
     im Hintergrund vom Netz nachgeladen ("stale-while-revalidate"). Die
     gehashten Asset-Namen aendern sich mit jedem Build, veraltete Treffer
     sind deshalb selten, aber ehrlich.
   – /api/*: nie in den Cache. Dort sagt `cache: "no-store"` ohnehin, dass
     nichts wiederverwendet werden darf; die Daten bleiben live.
   – Fremde URLs (Google-Buttons, Supabase) und Nicht-GET lassen wir
     durchlaufen, die hoeren nicht auf uns. */
self.addEventListener("fetch", (event) => {
  const anfrage = event.request;
  if (anfrage.method !== "GET") return;

  const url = new URL(anfrage.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (anfrage.mode === "navigate") {
    event.respondWith(
      fetch(anfrage)
        .then((antwort) => {
          if (antwort.ok) {
            const kopie = antwort.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(anfrage, kopie));
          }
          return antwort;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          const getroffen = await cache.match(anfrage);
          if (getroffen) return getroffen;
          const shell = await cache.match("/");
          if (shell) return shell;
          return Response.error();
        }),
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/images/")) {
    event.respondWith(
      caches.match(anfrage).then((getroffen) => {
        const netz = fetch(anfrage)
          .then((antwort) => {
            if (antwort.ok) {
              const kopie = antwort.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(anfrage, kopie));
            }
            return antwort;
          })
          .catch(() => getroffen ?? Response.error());
        return getroffen ?? netz;
      }),
    );
  }
});

self.addEventListener("push", (event) => {
  let titel = "Lexio";
  let text = "Zeit, eine Runde zu lernen.";

  if (event.data) {
    try {
      const daten = event.data.json();
      if (typeof daten.titel === "string" && daten.titel) titel = daten.titel;
      if (typeof daten.text === "string" && daten.text) text = daten.text;
    } catch {
      /* roher Text: dann den als Meldung nehmen */
      text = event.data.text();
    }
  }

  // Die Benachrichtigung überlebt, auch wenn der Tab zu ist: das ist der
  // Sinn einer Erinnerung. Das ganze Fenster ist der Griff zur App.
  event.waitUntil(
    self.registration.showNotification(titel, {
      body: text,
      icon: "/images/logo.png",
      badge: "/images/logo.png",
      tag: "lexio-erinnerung",
      renotify: true,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((offen) => {
      // Ein offenes Lexio-Fenster nehmen und dorthin springen, statt ein
      // zweites zu oeffnen.
      for (const f of offen) {
        if ("focus" in f) {
          f.focus();
          f.navigate("/");
          return;
        }
      }
      return self.clients.openWindow("/");
    }),
  );
});