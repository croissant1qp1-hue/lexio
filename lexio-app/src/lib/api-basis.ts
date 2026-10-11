/**
 * Basis-URL der Web-API – rein und testbar.
 *
 * Gesetztes EXPO_PUBLIC_API_URL gewinnt (trailing Slashes werden gekappt).
 * Sonst wird der Host aus dem Metro-hostUri abgeleitet (die IP bzw. der
 * Hostname des Entwicklungsrechners, mit dem der Start ein Gerät erreicht)
 * und auf Port 3210 gelegt – solange die Web-API dort läuft, ist das auf
 * einem echten Telefon die richtige Adresse. Ist gar kein Host bekannt,
 * bleibt es beim lokalen Rückfall.
 */
export function apiBasis(
  apiUrl: string | undefined,
  hostUri: string | undefined,
): string {
  if (apiUrl) return apiUrl.replace(/\/+$/, "");
  const host = hostUri ? hostUri.split(":")[0] : "";
  if (host) return `http://${host}:3210`;
  return "http://localhost:3210";
}