import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Rate-Limiting (Phase 3.6) und Security-Header (Phase 3.7).
 *
 * Zwei Aufgaben vor jeder Route:
 *
 *   1. /api/*  – Rate-Limiting. Bis hierher konnte jeder unbegrenzt auf
 *      /api/* schiessen: Lesen, Schreiben, jede Route – alles ohne Zaehler.
 *      Fuer eine oeffentliche Seite Pflicht, und genau das ist der Punkt:
 *      das Limit liegt VOR den Routen, nicht in ihnen, und gilt fuer jede
 *      Route, auch fuer die, die jemand noch baut und vergisst zu schuetzen.
 *
 *   2. Seiten  – Content-Security-Policy mit frischem Nonce pro Anfrage.
 *      Was die Policy regelt: Skripte nur von der eigenen Seite (self) und
 *      von Inline-Skripten mit dem Nonce dieser einen Anfrage
 *      (script-src 'self' 'nonce-…' 'strict-dynamic'). Das Theme-Skript in
 *      app/layout.tsx, das synchron vor dem ersten Paint laufen muss, ist
 *      ein Inline-Skript – genau der Fall, fuer den der Nonce da ist: ohne
 *      Nonce wuerde die Policy es blockieren.
 *
 * Die statischen Header (X-Content-Type-Options, Referrer-Policy,
 * X-Frame-Options, Permissions-Policy, HSTS) stehen in next.config.ts –
 * sie sind fuer jede Antwort gleich und brauchen keinen Nonce. Die CSP
 * nicht: sie darf nicht zwischen zwei Anfragen wiederverwendet werden.
 *
 * Was bewusst NICHT als Nonce-source scharf geschaltet ist, ist
 * style-src: die App setzt an dutzenden Stellen Inline-Style-Attribute
 * (Fortschrittsbalken, Diagramme, Grid-Bereiche). Eine strenge Style-Policy
 * wuerde das Layout zerschiessen, ohne ein echtes Sicherheitsproblem zu
 * loesen. Der Sicherheitsgewinn liegt bei den Skripten, und dort ist die
 * Policy streng.
 *
 * Beim Ablauf in diesem Projekt:
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

function rateLimit(request: NextRequest): NextResponse {
  const weg = request.nextUrl.pathname;

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
 * Erzeugt die Content-Security-Policy fuer genau diese eine Anfrage.
 *
 * – `script-src 'self' 'nonce-…' 'strict-dynamic'`: Skripte kommen nur von
 *   Lexio selbst oder tragen den Nonce dieser Anfrage. `strict-dynamic`
 *   heisst: einmal gebilligte Skripte duerfen weitere laden, bloede
 *   Umgehungen ueber `'self'`-Whitelists ohne Nonce sind ausgeschlossen.
 *   In der Entwicklung braucht React `'unsafe-eval'` fuer Debug-Information.
 * – `connect-src`: Der Browser ruft Supabase direkt an (Anmeldung, REST),
 *   deshalb steht der Supabase-Ursprung hier – Laufzeit-URL aus der Env,
 *   nicht hart kodiert.
 * – `style-src 'self' 'unsafe-inline'`: siehe Kommentar oben. Die App
 *   braucht Inline-Style-Attribute; ohne sie ist das Layout kaputt.
 * – `upgrade-insecure-requests` nur ueber https. Ueber http wuerde die
 *   Direktive jede Subresource auf https umschreiben und die Seite lokal
 *   kaputtmachen, wo kein TLS laeuft.
 */
function contentSecurityPolicy(nonce: string, request: NextRequest): string {
  const isDev = process.env.NODE_ENV === "development";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseUrsprung = supabaseUrl
    ? new URL(supabaseUrl).origin
    : "";
  const upgrade = request.nextUrl.protocol === "https:" ? " upgrade-insecure-requests;" : "";

  const header = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""};
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: blob:;
    font-src 'self';
    connect-src 'self' ${supabaseUrsprung};
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';${upgrade}
  `;
  // Zusaetzliche Whitespace-Zeilen aus dem Template-Literal herausnehmen.
  return header.replace(/\s{2,}/g, " ").trim();
}

/**
 * Fuegt die CSP samt Frisch-Nonce an Seite und Antwort an. Next.js findet
 * den Nonce selbststaendig ueber den `x-nonce`-Header und haengt ihn an
 * seine eigenen Skripte und Styles – nur das handgeschriebene Inline-Skript
 * in app/layout.tsx bekommt ihn ausdruecklich (ueber `headers()` dort).
 */
function securityHeader(request: NextRequest): NextResponse {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = contentSecurityPolicy(nonce, request);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

export function proxy(request: NextRequest): NextResponse {
  const weg = request.nextUrl.pathname;
  if (weg.startsWith("/api/")) {
    return rateLimit(request);
  }
  return securityHeader(request);
}

/**
 * Zwei Matcher:
 *
 *   1. /api/* – Rate-Limiting, wie gehabt.
 *   2. Seiten – die CSP. Ausgeschlossen sind die Pfade, die den Header nicht
 *      brauchen oder nicht vertragen: API-Routen (oben geregelt), Next-
 *      Assets (_next/static, _next/image), Favicon, die Service-Worker auf
 *      oeffenen Pfaden (sw.js), das Manifest und die eigenen Bilder. Eine
 *      CSP auf einer Bildantwort ist sinnlos; auf der Service-Worker-Antwort
 *      sogar gefaehrlich, weil eine strenge script-src-Policy den Worker
 *      selbst einschraenken kann.
 *
 *      Prefetches von next/link (RSC-Payloads) bekommen bewusst keine CSP:
 *      sie sind keine Dokumente, und der Nonce im Prefetch wuerde nur
 *      verwirren.
 */
export const config = {
  matcher: [
    "/api/:path*",
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|images/).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};