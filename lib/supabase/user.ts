import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { isAuthError } from "@supabase/supabase-js";
import type { SupabaseServerClient } from "./server";
import { createClient } from "./server";

/**
 * "Da ist keine Session" – und nicht: "ich konnte es nicht wissen".
 *
 * `auth.getUser()` liefert bei BEIDEN `user: null` UND ein `error`. Das ist
 * der Teil, der leicht danebenliegt: `error` allein bedeutet nicht, dass
 * etwas kaputt ist.
 *
 * Es gibt drei Ausgaenge, nicht zwei:
 *
 *   - `AuthSessionMissingError` – es ist niemand angemeldet. Das ist eine
 *     vollstaendige Auskunft, keine Stoerung. Supabase gibt diesen Fehler
 *     zurueck, wenn das Cookie kein `access_token` enthaelt.
 *   - `AuthApiError` mit 401/403 (`invalid claim: missing sub claim`) –
 *     das Token ist da, aber nicht (mehr) gueltig. Ebenfalls "nicht
 *     angemeldet": eine abgelaufene Sitzung ist genau das, und sie soll
 *     401 ergeben, damit der Browser zur Anmeldeseite fuehrt.
 *   - alles andere – Timeout, DNS-Fehler, 5xx. Hier weiss der Server
 *     nichts, und das ist ein Unterschied, den man weitergeben muss.
 *
 * Ohne diese Trennung passiert Folgendes:
 *
 *   1. Supabase ist fuenf Sekunden nicht erreichbar.
 *   2. Der Proxy leitet eine angemeldete Person auf /anmelden um.
 *   3. Umgeleitete API-Aufrufe antworten 401.
 *   4. lib/api-client.ts loescht die gemerkte E-Mail aus dem localStorage.
 *
 * Aus einem kleinen Ausfall wird ein erzwungener Neulogin, und die Person
 * muss ihre Adresse noch einmal tippen. Der Server hat unterwegs nicht
 * gemerkt, dass er gar nichts weiss.
 */
export type SessionPruefung =
  /** Angemeldet. */
  | { user: User; fehler: null }
  /** Nicht angemeldet – eine saubere Auskunft, kein Fehler. */
  | { user: null; fehler: null }
  /** Supabase war nicht erreichbar. Die Session ist ungeklärt, nicht weg. */
  | { user: null; fehler: Error };

/**
 * Ist das ein Fehler, der wirklich eine Stoerung bedeutet?
 *
 * `AuthSessionMissingError` sagt "niemand angemeldet". Ein 401 oder 403 von
 * `/auth/v1/user` bedeutet "dieses Token gehoert zu niemandem (mehr)" –
 * eine abgelaufene Sitzung, und genau dafuer ist 401 die richtige Antwort,
 * damit der Client den Nutzer zur Anmeldeseite schickt. Beides wird als
 * "nicht angemeldet" behandelt.
 *
 * Alles andere – Netzwerkfehler, 5xx, unerwartete Form – bleibt ein
 * `fehler` und wird zu 503.
 *
 * Die Prüfung auf `isAuthError` ist wichtig: `error` ist laut Typ ein
 * `AuthError`, aber im Notbetrieb kommt alles zurueck, was der Fetch
 * geworfen hat. Ein `error.status` auf einem `TypeError` waere `undefined`
 * und wuerde stillschweigend als "nicht angemeldet" durchgehen.
 */
export function istEchteStoerung(error: unknown): boolean {
    if (!isAuthError(error)) return true;

    // Niemand angemeldet. Vollstaendige Auskunft.
    if (error.name === "AuthSessionMissingError") return false;

    // Token ungueltig oder unvollstaendig: das ist eine abgelaufene
    // Sitzung, keine Stoerung. Supabase antwortet hier mit 401 ("invalid
    // claim") oder 403 ("bad_jwt") – je nachdem, ob der JWT syntaktisch
    // kaputt ist oder nur kein `sub` hat.
    const status = (error as { status?: number }).status;
    if (status === 401 || status === 403) return false;

    return true;
}

/**
 * Eine angemeldete Person – oder null.
 *
 * `auth.getUser()` liest die Session aus dem Token, das der Server
 * gegenueber Supabase pruefen laesst. Das ist der einzige Aufruf, dem man
 * trauen darf: `getSession()` liest nur, was im Cookie steht, und ist
 * Signed-Attacken ausgesetzt. Guetige Dinge zu tun braucht `getUser()`.
 *
 * Das Token kann seit Phase 7 auf zwei Wegen ankommen: aus dem
 * Session-Cookie des Browsers oder – bei der App – aus
 * `Authorization: Bearer …` (siehe createClient in server.ts). Fuer
 * `holeUser` ist das egal, beide Wege munden in dasselbe `getUser()`.
 *
 * Siehe SessionPruefung: der Fehler wird bewusst nicht verschluckt.
 */
export async function holeUser(supabase: SupabaseServerClient): Promise<SessionPruefung> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    return istEchteStoerung(error) ? { user: null, fehler: error } : { user: null, fehler: null };
  }
  return { user, fehler: null };
}

/**
 * Erzwingt eine Anmeldung fuer eine API-Route.
 *
 * Ohne Session bekommt der Aufrufer 401 und die Route laeuft nicht weiter.
 * Das gehoert in jede schreibende Route und in jede Route, die fremde
 * Daten liefern koennte – nicht nur in die Oberflaeche. Ein Knopf, der
 * versteckt ist, ist kein Zugriffsschutz.
 *
 * DER NAME IST HISTORISCH: Bei einem Ausfall von Supabase kommt hier 503
 * zurueck, nicht 401. Beides heisst fuer die Route dasselbe – nichts
 * ausfuehren, diese Antwort weitergeben – aber die Zahl unterscheidet sich,
 * und der Client braucht diese Unterscheidung. Siehe SessionPruefung.
 */
export async function mitUser(
  supabase: SupabaseServerClient,
): Promise<
  | { user: User; antwort: null }
  | { user: null; antwort: NextResponse }
> {
  const { user, fehler } = await holeUser(supabase);
  if (user) return { user, antwort: null };

  if (fehler) {
    // 503 und nicht 401: "Service unavailable" sagt dem Browser, dass er es
    // gleich noch einmal versuchen soll. Ein 401 wuerde ihn auf die
    // Anmeldeseite schicken, wo der Nutzer ein Passwort eingibt, das
    // nicht das Problem ist.
    return {
      user: null,
      antwort: NextResponse.json(
        {
          error: "Anmeldestatus gerade nicht abfragbar. Bitte in einem Moment erneut versuchen.",
        },
        { status: 503 },
      ),
    };
  }

  return {
    user: null,
    antwort: NextResponse.json(
      { error: "Bitte zuerst anmelden." },
      { status: 401 },
    ),
  };
}

/** Bequemer Aufruf: Client holen und Session pruefen. */
export async function mitUserOder401() {
  const supabase = await createClient();
  const ergebnis = await mitUser(supabase);
  return { supabase, ...ergebnis };
}
