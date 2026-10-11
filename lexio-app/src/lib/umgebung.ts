import Constants from "expo-constants";

import { apiBasis } from "./api-basis";

/**
 * Basis-URL der Web-API, die die App aufruft.
 *
 * Nur ein dünner Wrapper um die reine Ableitung in `api-basis.ts` – der
 * Unterschied ist allein die Umgebung: hier kommen der env-Wert und der
 * Metro-Host zusammen.
 */
export function apiBasisUrl(): string {
  return apiBasis(process.env.EXPO_PUBLIC_API_URL, Constants.expoConfig?.hostUri);
}