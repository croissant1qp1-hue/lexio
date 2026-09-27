/**
 * Was sich dieses Gerät merkt.
 *
 * DER WICHTIGE PUNKT ZUERST
 * -------------------------
 * Die Anmeldung selbst wird hier nicht gespeichert. Der Sitzungsnachweis
 * bleibt im Supabase-Cookie, und nur der Server entscheidet anhand davon,
 * wer jemand ist. Das ist Absicht:
 *
 *   - localStorage ist für jedes Skript der Seite lesbar. Ein Token dort
 *     wäre für ein eingeschleustes Script genauso erreichbar wie der Inhalt
 *     des Cookies – aber zusätzlich überlebt er das Abmelden in fremden
 *     Werkzeugen, in Exporten und in Backups.
 *   - Das Cookie wird bei jedem Aufruf mitausgeschickt, das localStorage
 *     nicht. Die RLS der Datenbank prüft die Anfrage serverseitig. Ein
 *     Eintrag im localStorage kann diese Prüfung nicht ersetzen, nur so
 *     tun als ob.
 *   - @supabase/ssr legt die Session ohnehin im Cookie ab (400 Tage) und
 *     ignoriert `auth.storage` ausdrücklich. Ein zweiter Ort für dasselbe
 *     Geheimnis wäre also nur eine zweite Gelegenheit, es zu verlieren.
 *
 * Was hier gespeichert wird, ist die *Bequemlichkeit*: die zuletzt
 * benutzte E-Mail, damit das Formular nicht leer ist, und der Wunsch, auf
 * diesem Gerät angemeldet zu bleiben. Beides ist unkritisch, beides wird
 * beim Abmelden gelöscht, und beides ersetzt niemals eine Prüfung.
 */

/** localStorage-Schlüssel. Mit Version, weil sich das Format noch ändert. */
export const GERAET_SPEICHER = "lexio.geraet.v1";

export type GeraeteStand = {
  /** Schema-Version. Eine alte, unbekannte Version wird verworfen. */
  v: 1;
  /**
   * Auf diesem Gerät angemeldet bleiben?
   *
   * true (Vorgabe): Das Session-Cookie bekommt eine lange Lebensdauer und
   * überlebt den Neustart des Browsers.
   *
   * false: Das Cookie gilt nur für die laufende Browser-Sitzung. Beim
   * nächsten Start des Browsers ist die Anmeldung weg. Auf einem fremden
   * Rechner ist das der Unterschied zwischen "bequem" und "fremd hat
   * Zugriff".
   */
  merken: boolean;
  /** Nur gespeichert, wenn `merken` true ist. Sonst ist das Feld weg. */
  email?: string;
  /** Unix-Millisekunden. Nur ein Hinweis, nie eine Frist. */
  zuletztAngemeldet?: number;
};

/**
 * Alles, was `localStorage` anstellen kann, und warum es hier nicht
 * auftaucht: Im privaten Modus von Safari und bei blockierten Cookies wirft
 * der erste Zugriff einen SecurityError. Ein abgelehnter Speicher darf die
 * App nicht daran hindern, sich anzumelden.
 */
function speicher(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function liesStand(): GeraeteStand {
  const s = speicher();
  if (!s) return { v: 1, merken: true };
  try {
    const roh = s.getItem(GERAET_SPEICHER);
    if (!roh) return { v: 1, merken: true };
    const wert = JSON.parse(roh) as Partial<GeraeteStand>;
    if (wert?.v !== 1) return { v: 1, merken: true };
    return {
      v: 1,
      merken: wert.merken !== false,
      ...(typeof wert.email === "string" ? { email: wert.email } : {}),
      ...(typeof wert.zuletztAngemeldet === "number" ? { zuletztAngemeldet: wert.zuletztAngemeldet } : {}),
    };
  } catch {
    // Kaputter Eintrag (Handeingetragen, andere App-Version): wegwerfen.
    return { v: 1, merken: true };
  }
}

function schreibe(stand: GeraeteStand): void {
  const s = speicher();
  if (!s) return;
  try {
    s.setItem(GERAET_SPEICHER, JSON.stringify(stand));
  } catch {
    /* Speicher voll oder verboten – die Einstellung gilt dann nur jetzt. */
  }
}

/**
 * Nach einer erfolgreichen Anmeldung.
 *
 * `merken` schreibt absichtlich nichts über `email`, wenn es false ist: Wer
 * nicht angemeldet bleiben will, erwartet auch nicht, dass die Adresse auf
 * dem Gerät liegen bleibt. Sonst wäre die Checkbox nur Kosmetik.
 */
export function merkeAnmeldung(email: string, merken: boolean): void {
  schreibe({
    v: 1,
    merken,
    ...(merken ? { email: email.trim().toLowerCase(), zuletztAngemeldet: Date.now() } : {}),
  });
}

/** Umschalten, ohne den Nutzer abzumelden. */
export function setzeMerken(merken: boolean): void {
  const alt = liesStand();
  schreibe(
    merken
      ? { v: 1, merken: true, zuletztAngemeldet: alt.zuletztAngemeldet ?? Date.now() }
      : { v: 1, merken: false },
  );
}

/**
 * Alles Vergessliche weg. Beim Abmelden, bei einer abgelaufenen Session und
 * wenn die Anmeldeseite ohne gültige Sitzung betreten wird.
 *
 * `behalteMerken` lässt die Wunscheinstellung stehen – die Person hat sie
 * bewusst gewählt, und sie gilt für die nächste Anmeldung. Nur die Person
 * selbst wird vergessen.
 */
export function vergissAnmeldung(behalteMerken = true): void {
  const alt = liesStand();
  schreibe(behalteMerken ? { v: 1, merken: alt.merken } : { v: 1, merken: true });
}

/** Für das Formular: die zuletzt benutzte Adresse, falls gespeichert. */
export function gemerkteEmail(): string {
  return liesStand().email ?? "";
}
