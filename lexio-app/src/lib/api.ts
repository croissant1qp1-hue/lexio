import { router } from "expo-router";
import { supabase } from "./supabase";
import { apiBasisUrl } from "./umgebung";

/**
 * fetch fuer alle API-Aufrufe der App – das Pendant zu lib/api-client.ts
 * im Web. Wenn die App auf denselben Server zielt (Phase 7), sollen die
 * Fehler auch derselben Sprache folgen: ein 401 ist kein Nutzerfehler,
 * sondern ein Zustand, aus dem die App herausfuehrt.
 */
export class ApiFehler extends Error {
  readonly status: number;
  /** Feldname -> Meldung, so wie es die API zurueckgibt. */
  readonly felder: Record<string, string>;

  constructor(nachricht: string, status: number, felder: Record<string, string> = {}) {
    super(nachricht);
    this.name = "ApiFehler";
    this.status = status;
    this.felder = felder;
  }
}

/**
 * Holt JSON von der Web-API, angemeldet ueber `Authorization: Bearer …`.
 *
 * Die API versteht den Bearer-Header seit Etappe 2 (lib/supabase/server.ts
 * und token.ts im Web-Repo). Ohne Sitzung schickt die App keinen Header –
 * dann antwortet die API 401, und die App bietet als Reaktion nicht den
 * Fehler an, sondern den Anmelden-Bildschirm.
 *
 * `abfall` ist der Wert fuer Listen, die im Fehlerfall einfach leer bleiben
 * duerfen. Ohne `abfall` wird im Fehlerfall geworfen – richtig fuer
 * Formulare, die den Fehler selbst anzeigen wollen. (Siehe Web-Vorbild.)
 */
export async function holeJson<T>(
  weg: string,
  abfall?: T,
  init?: RequestInit,
): Promise<T> {
  const url = `${apiBasisUrl()}${weg}`;
  let antwort: Response;

  try {
    antwort = await fetch(url, {
      ...init,
      // Antworten sind personenbezogen: ohne das kaeme beim Wiedereinstieg
      // moeglicherweise eine gecachte Antwort einer anderen Person.
      cache: "no-store",
      headers: {
        ...init?.headers,
        ...(await authHeader()),
      },
    });
  } catch {
    throw new ApiFehler("Keine Verbindung zum Server.", 0);
  }

  if (antwort.status === 401) {
    /*
     * Abgelaufene Sitzung: Der Zustand, nicht der Nutzer, ist das Problem.
     * Die lokale Session ist offensichtlich nicht mehr gueltig, also wird
     * sie hier verworfen, und die App fuehrt zur Anmeldung. Wie im Web,
     * nur dass es hier keinen Browser-Umweg braucht.
     */
    await supabase.auth.signOut();
    router.replace("/anmelden");
    throw new ApiFehler("Nicht angemeldet.", 401);
  }

  let daten: unknown = null;
  try {
    daten = await antwort.json();
  } catch {
    if (!antwort.ok) {
      throw new ApiFehler("Unerwartete Antwort vom Server.", antwort.status);
    }
  }

  if (!antwort.ok) {
    const koerper = (daten ?? {}) as { error?: string; felder?: Record<string, string> };
    const fehler = new ApiFehler(
      koerper.error ?? `Fehler ${antwort.status}`,
      antwort.status,
      koerper.felder ?? {},
    );

    /*
     * 503 wird immer geworfen: "es weiss gerade niemand" ist kein Zustand,
     * den man als leere Liste ausgeben darf – das haette eine Luege fuer
     * einen Lernstand. (Siehe Web-Vorbild lib/api-client.ts.)
     */
    if (antwort.status === 503) throw fehler;

    if (abfall === undefined) throw fehler;
    console.warn(`[api] ${url}: ${fehler.message}`);
    return abfall;
  }

  return daten as T;
}

/**
 * POST mit JSON-Body, wie im Web: `undefined` wird zu `{}` statt zu einem
 * Request ohne Body, der sonst als "Ungueltiges JSON" abgewiesen wuerde.
 */
export async function sendeJson<T>(
  weg: string,
  daten: unknown,
  abfall?: T,
  init?: Omit<RequestInit, "body" | "method">,
): Promise<T> {
  return holeJson<T>(
    weg,
    abfall,
    {
      ...init,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
      body: daten === undefined ? "{}" : JSON.stringify(daten),
    },
  );
}

async function authHeader(): Promise<{ Authorization?: string }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}