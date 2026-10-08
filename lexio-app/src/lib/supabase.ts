import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupportedStorage } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Beim Web-Export rendert der Router die Seiten auch auf dem Server (SSR).
 * Dort existiert kein `window`, und AsyncStorage wuerde beim ersten Zugriff
 * scheitern. Ein leerer Speicher reicht dort: die Anmeldung laeuft erst im
 * Browser (und auf dem Geraet bleibt es bei AsyncStorage).
 */
const serverSpeicher: SupportedStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

const speicher: SupportedStorage = typeof window === "undefined" ? serverSpeicher : AsyncStorage;

/**
 * Supabase direkt in der App (Phase 7, siehe LEXIO-PLAN.md): Die Daten sind
 * dieselben wie im Web, deshalb ist dieselbe Auth richtig – kein zweites
 * Nutzer-Universum. Die Session liegt in AsyncStorage; die App zeigt ihre
 * eigenen Schluessel nur in .env, nie im Code.
 *
 * Der Client ist bewusst schlank: Er meldet an/ab und haelt die Session.
 * Jede Abfrage an Lexio laeuft ueber die API mit Authorization-Header
 * (src/lib/api.ts), damit der Server eine Stelle ist und RLS prueft.
 */
export const supabase = createClient(url ?? "", anonKey ?? "", {
  auth: {
    storage: speicher,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});