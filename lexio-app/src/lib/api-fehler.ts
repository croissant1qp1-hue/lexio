/**
 * Fehlerform der App-API – rein und testbar, getrennt von `api.ts`.
 *
 * `api.ts` selbst importiert `supabase` und `expo-router` und laesst sich
 * damit nicht unter Node laden; die Regeln hier sind aber genau die, die
 * man falsch machen kann. Also stehen sie in einem eigenen Modul ohne
 * native Abhaengigkeiten.
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

type Koerper = { error?: string; felder?: Record<string, string> };

/**
 * Baut den ApiFehler aus dem Antwortkoerper.
 *
 * Die API gibt im Fehlerfall `{ error, felder }` zurueck. Fehlt `error`,
 * bleibt eine Meldung mit dem Status – besser als „undefined". Fehlt der
 * ganze Koerper (z. B. keine JSON-Antwort), greift derselbe Rueckfall.
 */
export function fehlerAusKoerper(status: number, koerper: unknown): ApiFehler {
  const k = (koerper ?? {}) as Koerper;
  return new ApiFehler(k.error ?? `Fehler ${status}`, status, k.felder ?? {});
}

/**
 * 503 wird immer geworfen, auch wenn ein `abfall` mitgegeben wurde:
 * „es weiss gerade niemand" ist kein Zustand, den man als leere Liste
 * ausgeben darf – das waere eine Luege fuer einen Lernstand.
 */
export function wirdImmerGeworfen(status: number): boolean {
  return status === 503;
}

/**
 * Body fuer POST-Aufrufe. `undefined` wird zu `{}` statt zu einem Request
 * ohne Body, den die API sonst als „Ungueltiges JSON" abweist.
 */
export function postBody(daten: unknown): string {
  return daten === undefined ? "{}" : JSON.stringify(daten);
}