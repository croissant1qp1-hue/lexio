/**
 * Liest das Access-Token aus `Authorization: Bearer …`.
 *
 * Das ist die einzige Stelle, die entscheidet, was ein Zugangs-Header wert
 * ist – deshalb als pure Funktion. Die App (Phase 7) schickt ihr
 * Access-Token diesen Weg; ein krummer Header darf nicht als Session
 * durchgehen, weder ein leerer Token noch ploetzlich mehrere. Und das kleine
 * Modul bleibt testbar, ohne Next.js einbinden zu muessen.
 */
export function tokenAusAuthorizationHeader(autorisierung: string | null): string | null {
  if (!autorisierung) return null;
  const teile = autorisierung.trim().split(/\s+/);
  if (teile.length !== 2) return null;
  const [schema, token] = teile;
  if (schema?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}