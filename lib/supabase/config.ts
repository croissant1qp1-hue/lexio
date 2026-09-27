/**
 * Supabase-Zugangsdaten an einer Stelle.
 *
 * Vorher standen dieselben beiden Zugriffe in drei Dateien. Jede davon
 * haette ihre eigene `!`-Behauptung tragen muessen, und eine davon
 * (`app/api/lernen/antwort/route.ts`) benutzte den Key gar nicht.
 *
 * Es sind zwei Umgebungsvariablen, und beide muessen beim Bauen vorhanden
 * sein. Fehlen sie, ist der Fehler hier lesbar statt in einer leeren
 * Supabase-Antwort mit HTTP 400 irgendwo im Client.
 */
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function fehlend(name: string, wert: string | undefined): never {
  throw new Error(
    `${name} fehlt in der Umgebung. ` +
      `Erwartet wird die Projekt-URL und der anon Key aus dem Supabase-Dashboard ` +
      `(Authentication → API). In .env eintragen, nicht in .env.example. ` +
      `Gefunden wurde: ${wert === undefined ? "nichts" : JSON.stringify(wert.slice(0, 8) + "…")}`,
  );
}

if (!URL) fehlend("NEXT_PUBLIC_SUPABASE_URL", URL);
if (!ANON_KEY) fehlend("NEXT_PUBLIC_SUPABASE_ANON_KEY", ANON_KEY);

export const SUPABASE_URL: string = URL;
export const SUPABASE_ANON_KEY: string = ANON_KEY;
