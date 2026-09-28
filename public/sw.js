/**
 * Service Worker für die tägliche Erinnerung.
 *
 * Nimmt die Push-Nachricht entgegen, die scripts/erinnerung-senden.mjs
 * verschickt, und zeigt sie als System-Benachrichtigung. Der Klick darauf
 * öffnet (oder fokussiert) die Übersichtsseite.
 *
 * Die Datei liegt in public/ und wird deshalb unter /sw.js ausgeliefert.
 * Der Broker (Notification.requestPermission in den Einstellungen) meldet
 * den Push-Dienst dem Server; dieser hier ist das Gegenstück zum Empfangen.
 *
 * Wichtig: kein ES-Modul. Ein Service Worker in der untersten Verzeichnis-
 * ebene verwendet klassische Skript-Semantik, kein `import` – und genau so
 * unterstützen ihn alle Browser. Wird die Datei später doch ein Modul,
 * muss die Registrierung `{ type: "module" }` mitgeben.
 */

self.addEventListener("install", () => {
  // Aktiv bleiben, ohne sich selbst zu erneuern: kein alte Version, die
  // eine Erinnerung abfängt. Der Worker ist werkzeuglos, es gibt kein Cache
  // zu räumen.
  self.skipWaiting();
});

self.addEventListener("activate", () => {
  // Alte Arbeitskopien sofort übernehmen statt auf den nächsten Start.
  self.clients.claim();
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