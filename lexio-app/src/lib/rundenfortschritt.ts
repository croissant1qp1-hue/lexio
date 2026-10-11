/**
 * Der Fortschritt in der Kopfzeile der Lernrunde.
 *
 * Die App fuehrt den Stapel als "was noch kommt" (siehe `rundenrotation.ts`):
 * die beantwortete Karte faellt vorne heraus, `index` bleibt auf 0 stehen.
 * Aus `index` laesst sich der Fortschritt deshalb nicht ableiten — er stuende
 * still. Er kommt aus der Rundengroesse und dem, was noch uebrig ist:
 *
 *   position = (runde - verbleibend) + 1      (1-basiert, wie im Web)
 *   gesamt   = runde
 *
 * Beide Werte werden auf sinnvolle Grenzen geklemmt, damit eine unerwartete
 * Zahl (z. B. `verbleibend` groesser als `runde`) keine Anzeige wie "3 / 2"
 * erzeugt. Bei einer leeren Runde ist beides 0.
 */
export function rundenFortschritt(
  runde: number,
  verbleibend: number,
): { position: number; gesamt: number } {
  const gesamt = Math.max(0, Math.trunc(runde));
  const rest = Math.min(Math.max(0, Math.trunc(verbleibend)), gesamt);
  const erledigt = gesamt - rest;
  const position = gesamt === 0 ? 0 : Math.min(erledigt + 1, gesamt);
  return { position, gesamt };
}
