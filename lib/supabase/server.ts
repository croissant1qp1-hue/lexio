import { createServerClient } from "@supabase/ssr";
import { createClient as supabaseCreateClient } from "@supabase/supabase-js";
import type { GoTrueClientOptions } from "@supabase/auth-js";
import { cookies, headers } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";
import { tokenAusAuthorizationHeader } from "./token";

/**
 * Kein Cookie, keine Persistenz, kein Auto-Refresh – der Client legt nichts
 * ab und haelt kein Geheimnis. `hasCustomAuthorizationHeader` (offiziell,
 * aber @experimental in @supabase/auth-js) sagt Supabase, dass der Header
 * von aussen kommt und nicht von der Session-Verwaltung ueberschrieben
 * werden darf; `auth.getUser()` prueft das Token trotzdem gegen Supabase,
 * statt ihm zu vertrauen.
 *
 * Der Cast ist noetig, weil supabase-js die Option zur Laufzeit an den
 * Auth-Client durchreicht, sein oeffentlicher Typ sie aber - anders als
 * @supabase/auth-js - nicht auflistet. Genau hier steht sie deshalb einmal.
 */
const AUTH_OPTIONEN = {
  persistSession: false,
  autoRefreshToken: false,
  detectSessionInUrl: false,
  hasCustomAuthorizationHeader: true,
} as GoTrueClientOptions;

export function createClientVomToken(accessToken: string) {
  return supabaseCreateClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: AUTH_OPTIONEN,
  });
}

/**
 * Supabase-Client fuer Server Components und Route Handler.
 *
 * Bringt der Aufrufer ein Access-Token mit (`Authorization: Bearer …`),
 * gilt das als Session – so laeuft die App gegen dieselben Routen wie der
 * Browser. Ohne Token bleibt es beim Cookie-Weg.
 *
 * `setAll` schreibt in die Antwort-Cookies. Das wirft, sobald die Session
 * aus einem Server Component heraus erneuert werden soll – dort sind
 * Cookies nicht mehr aenderbar. Der Fehler ist nicht abfangbar-relevant:
 * dann gibt es keine neue Session und der naechste Request holt sie nach.
 */
export async function createClient() {
  const autorisierung = (await headers()).get("authorization");
  const token = tokenAusAuthorizationHeader(autorisierung);
  if (token) return createClientVomToken(token);

  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Kommt vor, wenn aus einem Server Component geschrieben wird.
        }
      },
    },
  });
}

export type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;