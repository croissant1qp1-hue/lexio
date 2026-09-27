import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/config";
import { normiereWeiterZiel } from "@/lib/weiter-ziel";
import { istEchteStoerung } from "@/lib/supabase/user";

/**
 * Zwei Aufgaben, und beide sind noetig:
 *
 *  1. Die Session auffrischen. Supabase schreibt das Refresh-Token in ein
 *     Cookie, das nur kurze Zeit gueltig ist. Ohne diesen Aufruf laeuft die
 *     App nach einer Stunde aus, obwohl der Nutzer angemeldet ist. Der
 *     Aufruf schreibt das neue Token zurueck, deshalb muss die Antwort
 *     weiter unten mit `request` erzeugt werden.
 *
 *  2. Optimistisch umleiten. Wer nicht angemeldet ist, kommt nicht in die
 *     App, sondern auf /anmelden.
 *
 * WAS DAS NICHT IST: Ein Zugriffsschutz. Hier wird nur umgeleitet, was ein
 * schoenes Muster fuer nicht angemeldet ist. Ob jemand fremde Daten sehen
 * darf, entscheidet ausschliesslich die Datenbank ueber ihre RLS-Policies –
 * jede API-Route prueft die Session zusaetzlich selbst. Eine im Proxy
 * umgeleitete Seite ist keine Speicherung.
 */

/**
 * Seiten und Pfade, die ohne Anmeldung erreichbar sind.
 *
 * `/api` steht hier mit drin, und das ist der entscheidende Punkt:
 * Eine API-Route, die keine Session hat, antwortet selbst mit 401 – per
 * JSON, mit Statuscode, ohne Umleitung. Ohne diesen Eintrag bekaeme der
 * Browser statt dessen 307 auf /anmelden und als "Antwort" das
 * Anmeldeformular. Der Client haette dann eine 200-HTML-Seite in den
 * Haenden, `res.json()` wuerfe scheitern, und `holeJson` faellt still auf
 * seinen Fallback zurueck: leere Listen, "0 Sets", keine Erkennung der
 * abgelaufenen Session. Nach 45 Minuten waere genau das die Erfahrung –
 * die App wirkt leer, statt zur Anmeldung zu fuehren.
 *
 * Das ist kein Loch: jede API-Route prueft die Session ueber
 * `mitUserOder401`. Der Proxy liefert nur den Anmelde-Status fuer Seiten.
 *
 * Die beiden Passwort-Seiten sind ebenfalls oeffentlich, und das ist
 * keineswegs eine Ausnahme, sondern die Bedingung dafuer, dass sie
 * funktionieren: /passwort-zuruecksetzten erreicht man gerade, weil man
 * NICHT angemeldet ist, und /passwort-aendern oeffnet den Link aus der
 * Mail – dort ist erst eine Recovery-Sitzung vorhanden, keine normale.
 * Beides im Proxy umzuleiten hiesse: die Person kommt nie bei ihrem
 * Passwortformular an.
 */
const OEFFENTLICH = [
  "/anmelden",
  "/api",
  "/passwort-zuruecksetzen",
  "/passwort-aendern",
];

function istOeffentlich(pfad: string): boolean {
  return OEFFENTLICH.some((p) => pfad === p || pfad.startsWith(`${p}/`));
}

export async function proxy(request: NextRequest) {
  let antwort = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(neueCookies) {
        // Erst die Anfrage-Cookies, damit der naechste getAll()-Aufruf in
        // derselben Anfrage das neue Token sieht, dann die Antwort.
        neueCookies.forEach(({ name, value }) => request.cookies.set(name, value));
        antwort = NextResponse.next({ request });
        neueCookies.forEach(({ name, value, options }) =>
          antwort.cookies.set(name, value, options),
        );
      },
    },
  });

  // Refresht die Session und liefert sie zugleich. Ohne `await` waere
  // `user` hier immer null.
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  const pfad = request.nextUrl.pathname;

  /*
   * Supabase war nicht erreichbar – oder das Token war ungueltig.
   *
   * `getUser()` liefert in BEIDEN Faellen `user: null` und ein `error`.
   * "Da ist niemand" (AuthSessionMissingError) und "das weiss ich nicht"
   * (Timeout, 5xx) sind hier dasselbe Feld, aber nicht dasselbe Ereignis.
   *
   * Ohne die Unterscheidung leitet unten jeder Netzausfall auf /anmelden
   * um – und loescht dabei ueber den 401 der API-Aufrufe die gemerkte
   * E-Mail aus dem localStorage. Fuenf Sekunden Supabase-Stoerung, ein
   * erzwungener Neulogin, und die Person muss ihre Adresse noch einmal
   * tippen. Siehe lib/supabase/user.ts, dort steht dieselbe Pruefung.
   *
   * Ein ungueltiges Token (401/403 von /auth/v1/user) landet bewusst NICHT
   * hier, sondern wird unten wie eine normale fehlende Session behandelt:
   * eine abgelaufene Sitzung ist genau das, wofuer 401 steht.
   */
  if (error && istEchteStoerung(error)) return antwort;

  if (istOeffentlich(pfad)) {
    // Wer schon angemeldet ist, hat auf der Anmeldeseite nichts zu suchen.
    // /api/auth/callback wird hier bewusst nicht umgeleitet: dort landet
    // der Browser nach dem OAuth, und eine Umleitung wuerde den Code
    // verwerfen.
    if (user && pfad === "/anmelden") {
      /*
       * `weiter` stammt aus der Adresszeile, also von aussen. Ohne
       * Pruefung genuegt ein Link wie /anmelden?weiter=//fremde-seite –
       * der Browser interpretiert das als Adresse dieser fremden Seite, mit
       * allem, was im Referer mitgeht. Dieselbe Regel wie in der
       * Callback-Route und in der Anmeldeseite, siehe lib/weiter-ziel.ts.
       *
       * `pathname` und `search` werden neu gesetzt statt nur `pathname`:
       * sonst behaelt die Antwort die alte Query (?weiter=…&fehler=…) und
       * landet auf der Anmeldeseite weiter.
       */
      const url = request.nextUrl.clone();
      const ziel = new URL(normiereWeiterZiel(request.nextUrl.searchParams.get("weiter")), url.origin);
      return NextResponse.redirect(ziel);
    }
    return antwort;
  }

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/anmelden";
    // Wohin zurueck, sobald die Anmeldung durch ist. Nur der Pfad, keine
    // Query-Parameter: sonst landet man auf /anmelden?weiter=/anmelden.
    url.search = "";
    url.searchParams.set("weiter", `${pfad}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  return antwort;
}

export const config = {
  // Ohne diese Liste liefe der Proxy auch fuer CSS, Bilder und
  // _next/static – und wuerde dort eine Umleitung erzwingen, an der nichts
  // ankommt.
  matcher: [
    /*
     * Alles ausser:
     *   _next/static   Build-Ausgaben, unveraenderlich
     *   _next/image    Bildoptimierung
     *   favicon.ico    Browser-Anfrage
     *   /images        statische Dateien aus public/
     *   Dateien mit Endung (Bild, CSS, JS, Schrift) – die Regex muss
     *   escaped werden, sonst ist die . ein Jeder-Zeichen.
     */
    "/((?!_next/static|_next/image|favicon.ico|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?|ttf|css|js|map|txt|xml|webmanifest)$).*)",
  ],
};
