import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

/**
 * Supabase-Client fuer Server Components und Route Handler.
 *
 * `setAll` schreibt in die Antwort-Cookies. Das wirft, sobald die Session
 * aus einem Server Component heraus erneuert werden soll – dort sind
 * Cookies nicht mehr aenderbar. Der Fehler ist nicht abfangbar-relevant:
 * dann gibt es keine neue Session und der naechste Request holt sie nach.
 */
export async function createClient() {
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
