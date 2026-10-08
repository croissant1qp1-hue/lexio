import Constants from "expo-constants";

/**
 * Basis-URL der Web-API, die die App aufruft.
 *
 * Ohne EXPO_PUBLIC_API_URL wird die Adresse aus dem Metro-Host abgeleitet
 * (die IP des Entwicklungsrechners, mit der der Launch ein Gerät erreicht).
 * Auf einem echten Telefon ist das die richtige Adresse, solange die
 * Web-API auf Port 3210 laeuft – sonst EXPO_PUBLIC_API_URL setzen
 * (siehe .env.example).
 */
export function apiBasisUrl(): string {
  const gesetzt = process.env.EXPO_PUBLIC_API_URL;
  if (gesetzt) return gesetzt.replace(/\/+$/, "");

  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) return `http://${hostUri.split(":")[0]}:3210`;
  return "http://localhost:3210";
}