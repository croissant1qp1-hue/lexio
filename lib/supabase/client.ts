"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

/**
 * Supabase-Client fuer den Browser.
 *
 * Ein Client pro Aufruf. `createBrowserClient` merkt sich die Instanz
 * intern, ein zweiter `createClient` wuerde aber eine eigene Session
 * Verwaltung aufbauen – deshalb wird die Funktion bewusst so aufgerufen,
 * dass alle Komponenten denselben Browser-Client benutzen.
 */
export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
