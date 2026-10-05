/**
 * Prüft, ob das Supabase-Projekt so beschaffen ist, dass die App laufen kann.
 *
 * Warum das überhaupt existiert: Die App braucht drei Dinge aus dem Dashboard,
 * von denen zwei nichts in der Datenbank stehen – die Freischaltung der
 * Registrierung und die E-Mail-Bestätigung. Fehlt eines davon, sieht man auf
 * der Anmeldeseite nur einen Knopf, der nichts tut, und in der Datenbank nur
 * eine Fehlermeldung mit einer SQL-Nummer. Beides führt nowherehin.
 *
 * Diese Prüfung beantwortet die Frage "was ist noch nicht eingestellt" mit
 * einer Liste, statt sie dem Anwender zu überlassen. Sie läuft ohne
 * Anmeldung, weil sie gerade auf der Anmeldeseite gebraucht wird.
 *
 * Was hier NICHT steht: Schlüssel, Projektreferenz, E-Mail-Adressen, Namen von
 * Nutzern. Nur boolesche Zustände. Der Endpunkt ist bewusst öffentlich, also
 * darf sein Inhalt nichts erzählen, was ein Angreifer nicht auch durch
 * Raten erfährt.
 */

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/config";
import { ANBIETER, istAktiv, type AnbieterId } from "@/lib/supabase/anbieter";

/**
 * Welche Anbieter das Supabase-Projekt gerade freigeschaltet hat.
 *
 * Ein Datensatz je Anbieter aus lib/supabase/anbieter.ts, statt wie vorher
 * zwei fest benannter Felder. Die Liste waechst, ohne dass diese Datei davon
 * wissen muss – ein neuer Anbieter braucht nur einen Eintrag dort.
 */
export type ProviderStatus = Record<AnbieterId, boolean>;

/** Alle Anbieter aus: der Zustand, bevor eine Antwort da ist. */
function anbieterAus(): ProviderStatus {
  return Object.fromEntries(ANBIETER.map((a) => [a.id, false])) as ProviderStatus;
}

/** Ein Schritt, der noch zu tun ist. */
export type Aufgabe = {
  /** Kurz-ID, damit die Oberfläche einen Text nicht per Vergleich erraten muss. */
  id:
    | "migration"
    | "bestaetigung"
    | "oauth"
    | "registrierung"
    | "anon-key"
    | "service-key"
    | "db-passwort";
  kuerzel: string;
  titel: string;
  warum: string;
  /** Wo das im Supabase-Dashboard einzustellen ist. */
  ort: string;
  /** Blockiert die App wirklich, oder ist es nur ein Hinweis? */
  schwerwiegend: boolean;
};

export type Gesundheit = {
  /** Migration 003 ist vollständig: die App kann loslegen. */
  datenbankBereit: boolean;
  /** Supabase antwortet überhaupt. */
  erreichbar: boolean;
  anmeldung: {
    /** Registrierung ist im Projekt abgeschaltet? */
    registrierungFrei: boolean;
    /** Mails an neue Konten werden verlangt? */
    bestaetigungPflicht: boolean;
    provider: ProviderStatus;
    /**
     * Mindestens ein Weg, sich anzumelden.
     *
     * `null` heißt: nicht entscheidbar. Bei ausstehender E-Mail-Bestätigung
     * lässt sich aus der API heraus nicht ablesen, ob überhaupt ein
     * Mailserver hängt. "Konto erstellen" kann funktionieren oder seit
     * Wochen scheitern, je nachdem was im Dashboard eingestellt ist. rate
     * würde hier eine falsche Sicherheit erzeugen.
     */
    moeglich: boolean | null;
  };
  /** Fehlende Datenbank-Objekte, menschenlesbar benannt. */
  fehlend: string[];
  aufgaben: Aufgabe[];
};

/** Ein einziger PostgREST-Aufruf. Wirft nie. */
async function sonde(pfad: string, spalten: string): Promise<number> {
  const url = `${SUPABASE_URL}/rest/v1/${pfad}?select=${spalten}&limit=1`;
  try {
    const antwort = await fetch(url, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      // Ohne Timeout hängt die Anmeldeseite, wenn die Datenbank nicht
      // antwortet – und zwar genau dann, wenn man sie am dringendsten braucht.
      signal: AbortSignal.timeout(4000),
    });
    return antwort.status;
  } catch {
    return 0;
  }
}

/**
 * Liest die Rolle aus einem JWT, ohne ihn zu prüfen.
 *
 * Ein JWT ist nur base64 kodiert, das Lesen des Inhalts beweist also nichts –
 * es geht hier nicht um Vertrauen, sondern um einen Fehlalarm: Wer den
 * Service-Role-Key in eine andere Variable kopiert, nimmt einem anderen
 * Werkzeug die Rechte, die es nicht braucht. Genau dieser Fehlstand ist in
 * dieser .env passiert, deshalb wird er hier sichtbar gemacht, statt nur im
 * Verdacht.
 *
 * Es wird nichts ausgegeben, was nicht die Rollenbezeichnung ist.
 */
export function rolleDesKeys(schluessel: string | undefined): string {
  try {
    if (!schluessel) return "fehlt";
    const teil = schluessel.split(".")[1];
    if (!teil) return "unbekannt";
    const nutzlast = JSON.parse(Buffer.from(teil, "base64url").toString("utf8")) as {
      role?: string;
    };
    return typeof nutzlast.role === "string" ? nutzlast.role : "unbekannt";
  } catch {
    return "unbekannt";
  }
}

/** Auth-Einstellungen des Projekts. Antwortet nur mit booleschen Zuständen. */
async function liesAnmeldeMoeglichkeiten(): Promise<{
  registrierungFrei: boolean;
  bestaetigungPflicht: boolean;
  provider: ProviderStatus;
}> {
  const leer = {
    registrierungFrei: true,
    bestaetigungPflicht: false,
    provider: anbieterAus(),
  };
  try {
    const antwort = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: SUPABASE_ANON_KEY },
      signal: AbortSignal.timeout(4000),
    });
    if (!antwort.ok) return leer;
    const s = (await antwort.json()) as {
      disable_signup?: boolean;
      mailer_autoconfirm?: boolean;
      external?: Record<string, boolean | undefined>;
    };
    const external = s.external ?? {};
    return {
      registrierungFrei: s.disable_signup !== true,
      // `false` heißt: Supabase schickt eine Bestätigungsmail und meldet den
      // Nutzer erst danach an. Fehlt der Schlüssel, ist es neuerdings
      // Voreinstellung "keine Mail".
      bestaetigungPflicht: s.mailer_autoconfirm === false,
      // Aus der Liste gebaut statt fest benannt: sonst muesste hier ein
      // Eintrag pro Anbieter gepflegt werden, und ein vergessener zeigt sich
      // als ein Knopf, der fehlt, obwohl das Dashboard ihn freigeschaltet hat.
      provider: Object.fromEntries(
        ANBIETER.map((a) => [a.id, istAktiv(external, a)]),
      ) as ProviderStatus,
    };
  } catch {
    return leer;
  }
}

export async function pruefeGesundheit(optionen: {
  /** Server-Env-Diagnosen ausgeben (Service-Role-Key, DB-Passwort). */
  inklusiveServerKonfiguration: boolean;
} = { inklusiveServerKonfiguration: false }): Promise<Gesundheit> {
  const [setUserId, viewSpalten, profil, fortschritt, fortschrittKarten, anmeldung] =
    await Promise.all([
      sonde("karteikarten_sets", "user_id"),
      sonde("karteikarten_sets_uebersicht", "eigenes_set"),
      sonde("profil", "id"),
      sonde("mein_fortschritt", "streak"),
      sonde("karten_fortschritt", "karte_id"),
      liesAnmeldeMoeglichkeiten(),
    ]);

  const fehlend: string[] = [];
  if (setUserId === 0) fehlend.push("Die Datenbank antwortet gar nicht.");
  // 42703 = Spalte existiert nicht, 400 ist der PostgREST-Wrapper darum herum.
  if (setUserId === 400) fehlend.push("karteikarten_sets.user_id");
  if (viewSpalten === 400) fehlend.push("karteikarten_sets_uebersicht.eigenes_set");
  // 404 = Tabelle fehlt wirklich. 401/403 heißt nur, dass die Rolle "anon"
  // nichts lesen darf – die Tabelle kann trotzdem da sein, und genau das ist
  // nach der Migration der Fall, weil profil nur für angemeldete Nutzer
  // freigegeben ist. Beides zählt hier als "vorhanden".
  if (profil === 404) fehlend.push("profil");
  if (fortschrittKarten === 404) fehlend.push("karten_fortschritt");
  if (fortschritt === 404) fehlend.push("mein_fortschritt");

  const datenbankBereit =
    setUserId !== 0 && !fehlend.some((f) => f !== "Die Datenbank antwortet gar nicht.");

  const rolle = rolleDesKeys(SUPABASE_ANON_KEY);

  // Ueber die Liste statt ueber zwei fest benannte Felder: ein Anbieter, der
  // im Dashboard freigeschaltet ist, macht die App benutzbar – unabhaengig
  // davon, welcher es ist.
  const oauthDa = ANBIETER.some((a) => anmeldung.provider[a.id]);
  // Bei Pflichtbestätigung ohne sichtbaren Mailserver: nicht entscheidbar.
  const moeglich = anmeldung.registrierungFrei
    ? anmeldung.bestaetigungPflicht
      ? oauthDa
        ? true
        : null
      : true
    : oauthDa;

  const aufgaben: Aufgabe[] = [];

  // Env-Diagnosen: nur fuer den Entwickler, nicht fuer jeden Besucher.
  // Der oeffentliche Endpunkt verraet mit diesen drei Pruefungen, ob auf
  // diesem Server SUPABASE_SERVICE_ROLE_KEY und SUPABASE_DB_PASSWORD richtig
  // gesetzt sind – nichts, was ein Besucher wissen muss. Der anon-Key ist
  // zwar im Client-Bundle, die Rollenpruefung ist dort also harmlos; aber
  // die beiden anderen betreffen reine Server-Geheimnisse und bleiben
  // deshalb im Entwicklungsbetrieb. Siehe OFFENE-PUNKTE.md Punkt 8.
  if (optionen.inklusiveServerKonfiguration) {
    const rolleAdmin = rolleDesKeys(process.env.SUPABASE_SERVICE_ROLE_KEY);
    /*
     * Beide Fehlstände sind in dieser .env passiert und beide kosten Zeit:
     * Der Service-Role-Schlüssel stand im Feld für das Datenbankpasswort, und
     * im Feld für den Service-Role-Schlüssel stand noch der Platzhaltertext aus
     * der Beispieldatei.
     */
    const pwIstKey = rolleDesKeys(process.env.SUPABASE_DB_PASSWORD) === "service_role";
    const adminFehlt = rolleAdmin === "fehlt" || rolleAdmin === "unbekannt";

    if (rolle !== "anon") {
      aufgaben.push({
        id: "anon-key",
        kuerzel: "!",
        titel: `Der anon-Key hat die Rolle "${rolle}"`,
        warum:
          "Damit umgeht jeder Aufruf die Datenbankregeln. Für den Browser gehört " +
          "der Schlüssel mit der Rolle anon in NEXT_PUBLIC_SUPABASE_ANON_KEY.",
        ort: ".env → Schlüssel aus Dashboard → Settings → API → anon public",
        schwerwiegend: true,
      });
    }

    if (pwIstKey) {
      aufgaben.push({
        id: "db-passwort",
        kuerzel: "!",
        titel: "In SUPABASE_DB_PASSWORD steht ein Schlüssel, kein Passwort",
        warum:
          "Dort gehört das Passwort des Datenbanknutzers postgres hinein. " +
          "Der eingetragene Wert ist ein Service-Role-Schlüssel – damit lassen " +
          "sich die Migrationen nicht ausführen, weil psql damit keine " +
          "Anmeldung bekommt.",
        ort: ".env → Passwort aus Dashboard → Settings → Database, dort lässt es sich auch neu erzeugen",
        schwerwiegend: false,
      });
    }

    if (adminFehlt) {
      aufgaben.push({
        id: "service-key",
        kuerzel: "i",
        titel: "SUPABASE_SERVICE_ROLE_KEY ist nicht gesetzt",
        warum:
          "Die App braucht ihn nicht – sie läuft mit dem anon-Key und den " +
          "Datenbankregeln. Er wird nur gebraucht, um die Migrationen " +
          "automatisch auszuführen statt über den SQL Editor.",
        ort: ".env → service_role aus Dashboard → Settings → API",
        schwerwiegend: false,
      });
    }
  }

  if (!datenbankBereit) {
    aufgaben.push({
      id: "migration",
      kuerzel: "1",
      titel: "Migration 003 in der Datenbank ausführen",
      warum:
        "Ohne sie hat die Tabelle karteikarten_sets keine Spalte user_id. " +
        "Jedes Set gehört dann niemandem, und jede Lernantwort scheitert.",
      ort: "SQL Editor → Inhalt von supabase/migrations/003-auth-und-user-daten.sql einfügen → Run",
      schwerwiegend: true,
    });
  }

  if (!anmeldung.registrierungFrei) {
    aufgaben.push({
      id: "registrierung",
      kuerzel: "2",
      titel: "Registrierung ist abgeschaltet",
      warum: "Dann kann sich niemand ein Konto anlegen – nur wer schon eines hat.",
      ort: "Dashboard → Authentication → Sign In / Providers → Enable signup",
      schwerwiegend: true,
    });
  }

  if (anmeldung.bestaetigungPflicht && !oauthDa) {
    aufgaben.push({
      id: "bestaetigung",
      kuerzel: "2",
      titel: "E-Mail-Bestätigung ist an, aber vermutlich kein Mailserver",
      warum:
        "Neue Konten bekommen erst eine Mail und gelten danach erst als angemeldet. " +
        "Ohne SMTP kommt diese Mail nie an – die Registrierung hängt dann lautlos.",
      ort:
        "Dashboard → Authentication → Emails → SMTP. Oder für einen schnellen " +
        "Start: \"Confirm email\" abschalten, dann ist die Registrierung sofort möglich.",
      schwerwiegend: true,
    });
  }

  if (!oauthDa) {
    aufgaben.push({
      id: "oauth",
      kuerzel: "3",
      // Aus der Liste gebaut, damit der Hinweis nicht mehr behauptet, es
      // gaebe nur Google und GitHub, während im Dashboard sieben Schalter
      // aufwarten.
      titel: `Kein Anmeldeanbieter aktiviert (${ANBIETER.map((a) => a.name).join(", ")})`,
      warum:
        "Die Anmeldeseite zeigt einen Knopf für einen Anbieter von selbst an, " +
        "sobald er hier eingeschaltet ist. Solange keiner aktiv ist, bleibt " +
        "nur die Anmeldung mit E-Mail und Passwort.",
      ort: "Dashboard → Authentication → Providers → gewünschten Anbieter aufklappen → Enable",
      schwerwiegend: false,
    });
  }

  return {
    datenbankBereit,
    erreichbar: setUserId !== 0,
    anmeldung: { ...anmeldung, moeglich },
    fehlend,
    aufgaben,
  };
}
