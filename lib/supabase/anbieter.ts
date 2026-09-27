/**
 * Die OAuth-Anbieter, mit denen man sich in Lexio anmelden kann.
 *
 * Warum überhaupt eine eigene Datei: Vorher standen die zwei Anbieter an drei
 * Stellen – in der Anmeldeseite (Liste und Beschriftung), in lib/gesundheit.ts
 * (der Typ des Rückgabewerts) und in next.config.ts (erlaubte Bildquellen).
 * Bei zwei Anbietern geht das. Bei sieben ist die dritte Stelle diejenige, die
 * man vergisst – und die Vergessene fällt erst auf, wenn sich jemand mit
 * Spotify anmeldet und in der Navbar ein kaputtes Bild sieht.
 *
 * Alles, was einen Anbieter ausmacht, steht hier: seine Kennung, sein Name,
 * die Schalter in der Supabase-API und die Domänen, von denen sein Profilbild
 * kommt. Die Icons liegen in der Anmeldeseite, weil sie JSX sind und diese
 * Datei bewusst kein TSX ist – sie wird auch von next.config.ts gelesen.
 */

/** Die Kennungen, die diese App kennt. */
export type AnbieterId = "google" | "github" | "facebook" | "discord" | "x" | "twitch" | "spotify";

export type Anbieter = {
  /** Eigene Kennung, unter der der Rest der App den Anbieter fuehrt. */
  id: AnbieterId;
  /** Wie der Knopf auf der Anmeldeseite heisst. */
  name: string;
  /**
   * Der Wert, der an `signInWithOAuth({ provider })` geht.
   *
   * Fast immer identisch mit `id`. Die Ausnahme ist X: der aktuelle Anbieter
   * heisst dort `x`, der alte hiess `twitter`. Siehe `settingsKeys`.
   */
  oauthProvider: string;
  /**
   * Die Schalter, unter denen `/auth/v1/settings` diesen Anbieter meldet.
   *
   * Mehrere Eintraege sind noetig, weil Supabase den X-Provider in der
   * Einstellungen-API noch unter dem alten Namen fuehrt. Diese API antwortet
   * mit `twitter`, waehrend signInWithOAuth `x` verlangt – beides wurde am
   * laufenden Projekt geprueft, nicht aus der Doku abgeleitet. Wer nur
   * `x` abfragt, bekommt `undefined`, zeigt nie einen Knopf an und
   * wundert sich ueber ein funktionierendes OAuth, das unsichtbar ist.
   */
  settingsKeys: readonly string[];
  /**
   * Hostnamen, von denen das Profilbild dieses Anbieters kommt. Ohne Eintrag
   * in next.config.ts verweigert next/image die fremde URL, und die Navbar
   * zeigt statt des Bildes einen kaputten Platzhalter.
   */
  bildQuellen: readonly string[];
};

/**
 * Reihenfolge ist Anzeigereihenfolge: die vier verbreitetsten zuerst, damit
 * man die Liste auf einem Handy nicht scrollen muss, um Discord zu finden.
 */
export const ANBIETER: readonly Anbieter[] = [
  {
    id: "google",
    name: "Google",
    oauthProvider: "google",
    settingsKeys: ["google"],
    bildQuellen: ["lh3.googleusercontent.com", "*.googleusercontent.com"],
  },
  {
    id: "github",
    name: "GitHub",
    oauthProvider: "github",
    settingsKeys: ["github"],
    bildQuellen: ["avatars.githubusercontent.com", "*.githubusercontent.com"],
  },
  {
    id: "discord",
    name: "Discord",
    oauthProvider: "discord",
    settingsKeys: ["discord"],
    // Neuere Avatare kommen als Hash auf cdn.discordapp.com, die aelteren
    // ueber media.discordapp.net. Beide, sonst fehlt genau bei den Konten
    // das Bild, die schon laenger dabei sind.
    bildQuellen: ["cdn.discordapp.com", "media.discordapp.net", "*.discordapp.net"],
  },
  {
    id: "spotify",
    name: "Spotify",
    oauthProvider: "spotify",
    settingsKeys: ["spotify"],
    bildQuellen: ["i.scdn.co", "*.scdn.co", "mosaic.scdn.co"],
  },
  {
    id: "facebook",
    name: "Facebook",
    oauthProvider: "facebook",
    settingsKeys: ["facebook"],
    // Die profilbilder liegen ueber die Lookaside-CDN der App, nicht ueber
    // graph.facebook.com – dort liefert nur ein Access Token ein Bild.
    bildQuellen: ["platform-lookaside.fbsbx.com", "scontent.*.fbcdn.net"],
  },
  {
    id: "x",
    name: "X",
    oauthProvider: "x",
    // OAuth 2.0 neu, OAuth 1.0a alt. Die Einstellungen-API kennt nur das
    // alte Flag, der Client nur den neuen Wert – siehe settingsKeys oben.
    settingsKeys: ["x", "twitter"],
    bildQuellen: ["pbs.twimg.com", "abs.twimg.com", "*.twimg.com"],
  },
  {
    id: "twitch",
    name: "Twitch",
    oauthProvider: "twitch",
    settingsKeys: ["twitch"],
    bildQuellen: ["static-cdn.jtvnw.net", "*.jtvnw.net"],
  },
] as const;

/** Der Anbieter mit dieser Kennung, oder undefined. */
export function anbieter(id: string): Anbieter | undefined {
  return ANBIETER.find((a) => a.id === id);
}

/**
 * Ob `/auth/v1/settings` diesen Anbieter als aktiviert meldet.
 *
 * Bewusst gegen `true` verglichen und nicht auf truthy: die API liefert bei
 * einem unbekannten Schalter `undefined`, und ein Anbieter, den es dort gar
 * nicht gibt, soll keinen Knopf erzeugen.
 */
export function istAktiv(flags: Record<string, unknown>, a: Anbieter): boolean {
  return a.settingsKeys.some((schluessel) => flags[schluessel] === true);
}
