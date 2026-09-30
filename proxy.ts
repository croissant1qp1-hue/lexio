import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Rate-Limiting (Phase 3.6).
 *
 * Bis hierher konnte jeder unbegrenzt auf /api/* schiessen: Lesen, Schreiben,
 * jede Route – alles ohne Zaehler. Fuer eine oeffentliche Seite Pflicht, und
 * genau das ist der Punkt: das Limit liegt VOR den Routen, nicht in ihnen, und
 * gilt fuer jede Route, auch fuer die, die jemand noch baut und vergisst zu
 * schuetzen.
 *
 * Was hier steht, ist bewusst einfach:
 *
 *   – Ein Fenster von 60 Sekunden pro IP und Gruppe. Wer in dem Fenster das
 *     Limit reisst, bekommt 429 mit `Retry-After` und einer ehrlichen
 *     Meldung; die Route laeuft gar nicht erst.
 *   – Drei Gruppen mit unterschiedlich strengen Grenzen:
 *       auth        /api/auth/*   – 10/Minute. Der OAuth-Code-Tausch
 *                                   (callback) ist der wertvollste Endpunkt:
 *                                   er verwandelt einen Code in eine Session.
 *       gesundheit  /api/gesundheit – 60/Minute. Wird von der Anmeldeseite
 *                                   von jedem gerufen, der die Seite oeffnet.
 *       schreiben   alles andere mit POST/PUT/PATCH/DELETE – 30/Minute.
 *       lesen       alles andere mit GET – 120/Minute.
 *
 * Der Speicher ist bewusst im Prozess (Map), nicht in der Datenbank: ein
 * Rate-Limit, das jede Anfrage erst in die Tabelle schreibt, verlangsamt die
 * ehrlichen Nutzer, um die Unehrlichen zu treffen. Fuer eine einzelne Instanz
 * (dieses Projekt laeuft auf einer Maschine) ist der im-Prozess-Zaehler die
 * richtige Groesse; mehrere Instanzen muessten das in Redis o.ae. verschieben.
 *
 * Die IP kommt aus `X-Forwarded-For`. Next hat `request.ip` in v15 entfernt
 * (siehe Doku-Eintrag "ip and geo removed"), und hinter einem Reverse-Proxy
 * ist der auf dem Socket ankommende Header ohnehin nicht die IP des
 * Besuchers. Steht kein Forwarded-Header da, laeuft alles unter einem
 * gemeinsamen Schluessel – korrekt statt falsch-sicher: in dem Fall ist
 * nicht erkennbar, wer was ist.
 */

type Eimer = { fensterStart: number; zaehler: number };

const FENSTER_MS = 60_000;

const GRENZEN: Record<string, number> = {
  auth: 10,
  gesundheit: 60,
  schreiben: 30,
  lesen: 120,
};

/** IP-scharfer Speicher: Schluessel = ip|gruppe. */
const speicher = new Map<string, Eimer>();

function gruppe(weg: string, methode: string): string {
  if (weg.startsWith("/api/auth")) return "auth";
  if (weg === "/api/gesundheit") return "gesundheit";
  if (methode !== "GET") return "schreiben";
  return "lesen";
}

function ip(request: NextRequest): string {
  // Erster Eintrag von X-Forwarded-For, wenn vorhanden; sonst ein
  // gemeinsamer Schluessel fuer alles ohne Forwarding.
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded && forwarded.trim()) {
    return forwarded.split(",")[0]!.trim();
  }
  return "kein-forwarding";
}

export function proxy(request: NextRequest): NextResponse {
  const weg = request.nextUrl.pathname;
  if (!weg.startsWith("/api/")) return NextResponse.next();

  const gruppenName = gruppe(weg, request.method);
  const grenze = GRENZEN[gruppenName];

  const jetzt = Date.now();
  const schluessel = `${ip(request)}|${gruppenName}`;
  const eimer = speicher.get(schluessel);

  if (!eimer || jetzt - eimer.fensterStart >= FENSTER_MS) {
    // Frisches Fenster (oder das alte abgelaufen): zuruecksetzen.
    speicher.set(schluessel, { fensterStart: jetzt, zaehler: 1 });
    return NextResponse.next();
  }

  eimer.zaehler += 1;

  if (eimer.zaehler <= grenze) {
    return NextResponse.next();
  }

  // Limit gerissen. `Retry-After` in Sekunden, damit der Client weiss, wann
  // er es wieder versuchen darf, statt im Leeren zu raten.
  const verbleibendSek = Math.max(1, Math.ceil((FENSTER_MS - (jetzt - eimer.fensterStart)) / 1000));

  return NextResponse.json(
    { error: "Zu viele Anfragen. Bitte kurz warten und es dann erneut versuchen." },
    { status: 429, headers: { "Retry-After": String(verbleibendSek) } },
  );
}

/**
 * Nur /api/*. Alles andere – Seiten, _next/static, Bilder – laeuft weiter
 * ohne Rate-Limit: das kostet nur Umdrehungen und nutzt niemandem.
 */
export const config = {
  matcher: "/api/:path*",
};