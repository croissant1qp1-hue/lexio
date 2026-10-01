"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { ANBIETER, anbieter, type AnbieterId } from "@/lib/supabase/anbieter";
import { gemerkteEmail, liesStand, merkeAnmeldung } from "@/lib/geraet";
import { MIN_PASSWORT, PASSWORT_FEHLER } from "@/lib/passwort";
import { setzeSessionDauer } from "@/lib/supabase/session-dauer";
import { SetupHinweis } from "@/components/gesundheit/setup-hinweis";
import { IconEnvelope } from "@/components/icone";
import { useGesundheit } from "@/components/gesundheit/use-gesundheit";
import styles from "./anmelden.module.css";

/**
 * Anmeldung und Registrierung in einer Seite.
 *
 * Die sieben Anmeldeanbieter zuerst, weil fuer die meisten davon Google der
 * schnellste Weg ist. E-Mail und Passwort darunter, damit niemand
 * ausgeschlossen ist, der keines dieser Konten hat.
 *
 * Welche Knöpfe erscheinen, entscheidet das Supabase-Projekt – siehe
 * lib/supabase/anbieter.ts fuer die Liste und lib/gesundheit.ts fuer die
 * Sonde. Jeder Weg landet ueber dieselbe Session in derselben Datenbank: es
 * gibt kein "OAuth-Konto" und kein "Passwort-Konto" getrennt.
 */

/** Was gerade laeuft, damit Knopfe nicht mehrfach geklickt werden. */
type Status = "leer" | "oauth" | "prueft" | "mail";

/*
 * Client-Cooldown (Phase 3.6). Der Passwort-Versuch geht direkt vom Browser
 * an Supabase, unser Proxy-Limiter sieht ihn nicht. Deshalb veroegelt die
 * Seite selbst: wer es mehrmals in kurzer Zeit vergeblich versucht, bekommt
 * den Absenden-Knopf kurz gesperrt. Das ist kein Ersatz fuer den
 * Server-seitigen Schutz (den haelt Supabase an seiner Auth-API), sondern
 * ein ehrlicher Drosselknopf, der verhindert, dass die eigene Seite zum
 * Hammering-Werkzeug wird.
 */
const MAX_FEHLVERSUCHE = 5;
const FEHLVERSUCH_FENSTER_MS = 60_000;
const SPERRE_MS = 30_000;

/**
 * Die Logos, je Anbieter.
 *
 * Auskommentierte Inline-SVGs statt einer Icon-Bibliothek: Font Awesome hat
 * kein Google-Logo, und ein Icon von einer Fremd-URL waere eine weitere
 * Abhaengigkeit, die ausfallen kann – auf der Anmeldeseite, also auf der
 * Seite, an der eine fehlende Datei am meisten auffaellt.
 *
 * Die Pfade stammen von den Simple Icons (MIT-Lizenz). Google und X haben
 * dort kein einfarbiges Wortzeichen, deshalb sind sie aus mehreren Pfaden
 * aufgebaut.
 */
const ICON: Record<AnbieterId, React.ReactNode> = {
  google: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.4 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.7l4-3Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.8c1.8 0 3.3.6 4.5 1.8l3.4-3.4A12 12 0 0 0 1.4 6.7l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z"
      />
    </svg>
  ),
  github: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M12 .5a11.5 11.5 0 0 0-3.6 22.4c.6.1.8-.2.8-.6v-2c-3.3.7-4-1.6-4-1.6-.5-1.4-1.3-1.8-1.3-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.4-1.3-5.4-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.5 4.6 18.5 5 18.5 5c.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .4.2.7.8.6A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  ),
  discord: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="#5865F2" aria-hidden="true">
      <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
    </svg>
  ),
  spotify: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="#1DB954" aria-hidden="true">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  ),
  facebook: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="#0866FF" aria-hidden="true">
      <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z" />
    </svg>
  ),
  x: (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
      <path d="M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z" />
    </svg>
  ),
  twitch: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="#9146FF" aria-hidden="true">
      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z" />
    </svg>
  ),
};

/**
 * Fehlermeldungen von Supabase auf Deutsch.
 *
 * Die Originaltexte sind englisch und halbwegs technisch ("Invalid login
 * credentials"). Sie werden hier ersetzt, statt sie anzuzeigen – und
 * absichtlich nicht im Klartext, ob das Konto existiert: das wuerde einem
 * Angreifer sagen, welche Adressen im System sind.
 */
function uebersetzeFehler(text: string, beimAnmelden: boolean): string {
  // Meldungen, die im jeweiligen Modus gar nicht entstehen koennen. Ohne diese
  // Abfrage wuerde bei einem Registrierungsfehler der Text "E-Mail oder
  // Passwort stimmt nicht" stehen – man hat ja gar kein Passwort eingegeben,
  // und die Meldung beschreibt einen Fehler, den man nicht gemacht haben kann.
  if (!beimAnmelden && /invalid login credentials/i.test(text)) {
    return "Die Registrierung ist fehlgeschlagen. Bitte versuche es erneut.";
  }

  if (/invalid login credentials/i.test(text)) {
    return "E-Mail oder Passwort stimmt nicht.";
  }
  if (/email not confirmed/i.test(text)) {
    return "Bitte bestätige zuerst die E-Mail, die wir dir geschickt haben.";
  }
  if (/user already registered/i.test(text)) {
    return "Zu dieser E-Mail gibt es schon ein Konto. Melde dich stattdessen an.";
  }
  if (/password should be at least/i.test(text)) {
    return PASSWORT_FEHLER;
  }
  if (/rate limit|too many/i.test(text)) {
    return "Zu viele Versuche. Warte einen Moment und probiere es erneut.";
  }
  if (/email address .* invalid|unable to validate email/i.test(text)) {
    return "Diese E-Mail-Adresse sieht nicht gültig aus.";
  }
  // Unbekannter Text: die technische Meldung ist meist hilfreicher als eine
  // generische Entschuldigung, die den Fehler nur versteckt.
  return text;
}

type AnmeldenSeiteProps = {
    /** Schon geprueft: kommt normalisiert aus app/anmelden/page.tsx. */
    weiter: string;
    weiterleitungsFehler: string | null;
};

export default function AnmeldenSeite({ weiter, weiterleitungsFehler }: AnmeldenSeiteProps) {
    const router = useRouter();

    const [modus, setModus] = useState<"anmelden" | "registrieren">("anmelden");
    const [vorname, setVorname] = useState("");
    // Startwert aus dem Gerätespeicher. useState liest die Funktion nur beim
    // ersten Rendern – und der erste Render passiert im Browser, also ist das
    // hier der richtige Moment. Beim Server gibt es kein localStorage, dort
    // liefert liesStand() die Vorgabe.
    const [email, setEmail] = useState(() => gemerkteEmail());
    const [passwort, setPasswort] = useState("");
    const [zeigePasswort, setZeigePasswort] = useState(false);
    const [merken, setMerken] = useState(() => liesStand().merken);
    const [status, setStatus] = useState<Status>("leer");
    const [fehler, setFehler] = useState<string | null>(weiterleitungsFehler);

    /** Zeitpunkt, bis zu dem der Absenden-Knopf gesperrt ist (0 = frei). */
    const [sperreBis, setSperreBis] = useState(0);
    /** Verbleibende Sperrsekunden fuer den Countdown. */
    const [sperreSekunden, setSperreSekunden] = useState(0);
    /** Zeitstempel der vergangenen Fehlversuche, fuer das Fenster. */
    const fehlversuche = useRef<number[]>([]);

    /*
     * Countdown waehrend der Sperre: alle Sekunde die Anzeige nachziehen,
     * damit der Nutzer sieht, wann er es wieder versuchen darf. Ohne das
     * stuende "Bitte warten" einfach da, ohne zu sagen, wie lange.
     */
    useEffect(() => {
        if (sperreBis <= Date.now()) return;
        const timer = window.setInterval(() => {
            const rest = Math.max(0, Math.ceil((sperreBis - Date.now()) / 1000));
            setSperreSekunden(rest);
            if (rest === 0) setSperreBis(0);
        }, 500);
        return () => window.clearInterval(timer);
    }, [sperreBis]);

    /*
     * Fehlversuch vermerken und, wenn es zu viele in kurzer Zeit werden,
     * den Absenden-Knopf fuer 30 Sekunden sperren. Die Fensterangabe macht
     * sie zu einer echten Drossel: Einzelne Versuche ueber den Tag verteilt
     * zaehlen nicht aufeinander.
     */
    function vermerkeFehlversuch(): boolean {
        const jetzt = Date.now();
        const fenster = fehlversuche.current.filter((t) => jetzt - t < FEHLVERSUCH_FENSTER_MS);
        fenster.push(jetzt);
        fehlversuche.current = fenster;
        if (fenster.length >= MAX_FEHLVERSUCHE) {
            fehlversuche.current = [];
            const bis = jetzt + SPERRE_MS;
            setSperreBis(bis);
            setSperreSekunden(Math.ceil(SPERRE_MS / 1000));
            return true;
        }
        return false;
    }

    const emailRef = useRef<HTMLInputElement>(null);

    /*
     * Welche OAuth-Knöpfe es gibt, entscheidet das Supabase-Projekt, nicht
     * diese Datei. Vorher standen beide fest da, und waren die Provider nicht
     * aktiviert, kam statt der Anmeldung "Google ist im Supabase-Dashboard
     * noch nicht aktiviert" – eine Meldung über ein Dashboard, das man
     * vielleicht gar nicht hat.
     *
     * Solange keine Antwort da ist, wird nichts angezeigt. Das ist
     * absichtlich gegen das fruehere Verhalten getauscht: vorher standen die
     * Knöpfe sofort da und verschwanden einen Augenblick spaeter wieder, wenn
     * die Sonde geantwortet hatte. Auf der wichtigsten Seite der App ein
     * Knopf, der aufpoppt und wieder weggeht, ist schlimmer als ein Knopf, der
     * einen Moment spaeter kommt. Fällt die Sonde komplett aus, bleiben sie
     * weg – dann ist eben nur die Anmeldung mit Passwort moeglich, und das
     * ist immerhin eine Anmeldung, die funktioniert.
     */
    const { bericht: gesundheit } = useGesundheit();
    const aktiveAnbieter = ANBIETER.filter((a) => gesundheit?.anmeldung.provider[a.id] === true);

    useEffect(() => {
        if (!weiterleitungsFehler) return;
        /*
         * Das `fehler`-Param setzt die Callback-Route, wenn der OAuth-Rundlauf
         * nicht durchkam. Es wird einmal gelesen und dann aus der
         * Adresszeile entfernt: ein Reload wuerde sonst dieselbe Meldung noch
         * einmal zeigen, obwohl inzwischen ein Versuch mehr stattgefunden hat.
         *
         * replaceState statt router.replace: es aendert nur die URL und
         * laesst den React-Baum unangetastet. Ein Router-Wechsel wuerde
         * denselben Zustand neu aufbauen, nur um ein Zeichen in der
         * Adresszeile zu loeschen.
         */
        const url = new URL(window.location.href);
        url.searchParams.delete("fehler");
        window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }, [weiterleitungsFehler]);

    // Nach einem OAuth-Rundlauf landet man auf /anmelden?weiter=... – der
    // Proxy leitet angemeldete Nutzer dann schon weiter. Dieser Effekt
    // faengt den Fall ab, in dem die Session im selben Moment frisch
    // geworden ist, ohne dass der Proxy sie gesehen hat.
    //
    // `weiterZiel` ist zugleich das redirectTo fuer Google und GitHub. Ein
    // ungepruefter Wert von hier landet also direkt in der Supabase-URL –
    // dieselbe Luecke wie in der Callback-Route. normiereWeiterZiel() hat
    // den Wert deshalb bereits auf dem Server geprueft, bevor er hier ankam.
    const weiterZiel = weiter;

    useEffect(() => {
        let abgebrochen = false;
        createClient()
            .auth.getUser()
            .then(({ data }) => {
                if (abgebrochen) return;
                if (data.user) {
                    /*
                     * Auch nach dem OAuth-Rundlauf hierher: der Server kann
                     * localStorage nicht schreiben, also holt der Browser die
                     * bestehende Sitzung ab und vermerkt sie selbst. Sonst
                     * waere die E-Mail nach einem Google-Login nicht
                     * gespeichert, obwohl die Checkbox angeklickt war.
                     */
                    if (data.user.email) merkeAnmeldung(data.user.email, merken);
                    setzeSessionDauer(merken);
                    router.replace(weiterZiel);
                }
            })
            .catch(() => undefined);
        return () => {
            abgebrochen = true;
        };
    }, [router, weiterZiel, merken]);

    function wechseln(neu: "anmelden" | "registrieren") {
        setModus(neu);
        setFehler(null);
        // Gleich das erste sinnvolle Feld fokussieren, statt ans oberste
        // Ende der Seite zu springen.
        window.setTimeout(() => {
            if (neu === "registrieren" && vorname === "") return;
            emailRef.current?.focus();
        }, 30);
    }

    async function mitProvider(id: AnbieterId) {
        setStatus("oauth");
        setFehler(null);

        const a = anbieter(id);
        if (!a) {
            setStatus("leer");
            setFehler("Dieser Anmeldeanbieter ist nicht eingerichtet.");
            return;
        }

        const supabase = createClient();
        const { error } = await supabase.auth.signInWithOAuth({
            provider: a.oauthProvider as Parameters<
                ReturnType<typeof createClient>["auth"]["signInWithOAuth"]
            >[0]["provider"],
            options: {
                // Muss eine absolute URL sein. Ohne sie landet man nach dem
                // OAuth wieder auf der Anmeldeseite statt in der App.
                redirectTo: `${window.location.origin}/api/auth/callback?weiter=${encodeURIComponent(weiterZiel)}`,
            },
        });

        if (error) {
            // Bei aktivem Provider springt der Browser zum Anbieter. Ein
            // Fehler hier heisst in aller Regel: der Provider ist im
            // Supabase-Dashboard nicht eingeschaltet. Genau das sagen – mit
            // dem Namen aus der Liste, damit die Meldung auch bei Discord
            // noch stimmt und nicht "GitHub" sagt.
            setStatus("leer");
            setFehler(
                /provider is not enabled|not enabled/i.test(error.message)
                    ? `${a.name} ist im Supabase-Dashboard noch nicht aktiviert ` +
                      `(Authentication → Providers → ${a.name} → Enable).`
                    : uebersetzeFehler(error.message, false),
            );
        }
        // Sonst: der Browser wird von Supabase weitergeleitet, dieser
        // Code-Rest ist nicht mehr zustaendig.
    }

    async function absenden(event: React.FormEvent) {
        event.preventDefault();
        if (status !== "leer") return;
        if (Date.now() < sperreBis) return;

        const mail = email.trim().toLowerCase();
        if (!mail || !passwort) {
            setFehler("E-Mail und Passwort gehören beide ausgefüllt.");
            return;
        }
        if (modus === "registrieren" && passwort.length < MIN_PASSWORT) {
            setFehler(PASSWORT_FEHLER);
            return;
        }

        setStatus("prueft");
        setFehler(null);

        const supabase = createClient();
        const rueckkehr = `${window.location.origin}/api/auth/callback?weiter=${encodeURIComponent(weiterZiel)}`;

        const { error } =
            modus === "registrieren"
                ? await supabase.auth.signUp({
                      email: mail,
                      password: passwort,
                      options: {
                          emailRedirectTo: rueckkehr,
                          // Landet im raw_user_meta_data und wird vom Trigger
                          // aus 003 in public.profil uebernommen. Ohne das
                          // hiesse jeder neue Nutzer erstmal "Nutzer".
                          data: { full_name: vorname.trim() },
                      },
                  })
                : await supabase.auth.signInWithPassword({ email: mail, password: passwort });

        if (error) {
            setStatus("leer");
            const durchSupabaseGedrosselt = /rate limit|too many/i.test(error.message);
            if (!durchSupabaseGedrosselt) {
                const gesperrt = vermerkeFehlversuch();
                setFehler(
                    gesperrt
                        ? "Zu viele Versuche. Bitte warte einen Moment."
                        : uebersetzeFehler(error.message, modus === "anmelden"),
                );
            } else {
                // Supabase selbst hat gedrosselt: eine eigene Sperre waere
                // Doppelvernunft. Die Meldung von Supabase zaehlt, und der
                // Fehlertext sagt, was zu tun ist.
                setFehler(uebersetzeFehler(error.message, modus === "anmelden"));
            }
            return;
        }

        // Registrierung mit bestaetigter E-Mail liefert noch keine Session.
        // In dem Fall gibt es nichts zu senden – der Nutzer muss erst den
        // Link aus der Mail klicken. Ihm zu sagen, er sei angemeldet, waere
        // die freundlichste Moeglichkeit, ihn vor einer leeren App zu
        // lassen, die angeblich funktioniert.
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
            setStatus("mail");
            return;
        }

        /*
         * Zwei Dinge festhalten, beide in einem Aufruf:
         *
         * 1. Gerätespeicher: die Adresse (nur wenn "merken" angeklickt ist) und
         *    der Wunsch, wie lange die Sitzung gelten soll.
         * 2. Cookie-Lebensdauer: @supabase/ssr schreibt es immer mit 400 Tagen.
         *    Wer "nicht merken" gewählt hat, bekommt es hier auf Sitzungsdauer
         *    gedreht – sonst würde die Checkbox eine Zusage machen, die sie
         *    nicht einhält.
         *
         * Vorher wäre das ohne Folgen gewesen: `createBrowserClient` ist ein
         * Singleton und schreibt sein Cookie direkt beim Anmelden. Deshalb
         * muss es hierher, nach getSession(), und nicht vorher.
         */
        merkeAnmeldung(mail, merken);
        setzeSessionDauer(merken);

        router.replace(weiterZiel);
        router.refresh();
    }

    if (status === "mail") {
        /*
         * Der wahrscheinlichste Grund für "nichts angekommen" ist nicht der
         * Spam-Ordner, sondern dass gar kein Mailserver hängt. Genau das
         * prüft /api/gesundheit – und diese Seite ist der einzige Ort, an dem
         * die Frage überhaupt gestellt wird, denn der Nutzer ist hier
         * hängengeblieben und sieht sonst gar nichts.
         */
        const mailBereit = gesundheit ? !gesundheit.anmeldung.bestaetigungPflicht : null;

        return (
            <div className={styles.seite}>
                <div className={styles.karte}>
                    <span className={styles.zeichen} aria-hidden="true">
                        <IconEnvelope />
                    </span>
                    <h1 className={styles.titelFastFertig}>Fast geschafft</h1>
                    <p className={styles.text}>
                        Wir haben eine E-Mail an <strong>{email.trim().toLowerCase()}</strong> geschickt.
                        Klick auf den Link darin, dann bist du angemeldet. Der Link ist eine Stunde
                        gültig.
                    </p>

                    <SetupHinweis variante="gross" />

                    {mailBereit !== false && (
                        <p className={styles.fussnote}>
                            Nichts angekommen? Sieh im Spam-Ordner nach – bei Gmail landet
                            Supabase gelegentlich dort.
                        </p>
                    )}
                    <button
                        type="button"
                        className={styles.nebenKnopf}
                        onClick={() => {
                            setStatus("leer");
                        }}
                    >
                        Andere E-Mail verwenden
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.seite}>
            <div className={styles.gitter}>
                {/* ------------------------------------------------ Markenseite */}
                <section className={styles.marke} aria-hidden="true">
                    <div className={styles.markeKopf}>
                        <Image
                            src="/images/logo.png"
                            alt=""
                            width={52}
                            height={52}
                            className={styles.logo}
                            priority
                        />
                        <span className={styles.markeName}>Lexio</span>
                    </div>

                    <div className={styles.markeText}>
                        <h2 className={styles.markeUeberschrift}>
                            Vokabeln, die
                            <br />
                            hängen bleiben.
                        </h2>
                        <p className={styles.markeZeile}>
                            Verteiltes Lernen nach der Karteikarten-Methode. Jedes Set hat seinen
                            eigenen Rhythmus – angepasst an das, was du wirklich kannst.
                        </p>
                    </div>

                    <ul className={styles.markeListe}>
                        <li>
                            <i className="fa-solid fa-layer-group" aria-hidden="true" />
                            Sets statt Kapitel. Was du brauchst, kommt zuerst.
                        </li>
                        <li>
                            <i className="fa-solid fa-bolt" aria-hidden="true" />
                            XP für jede richtige Antwort, Streak für jeden Tag.
                        </li>
                        <li>
                            <i className="fa-solid fa-chart-simple" aria-hidden="true" />
                            Statistiken, die zeigen, wo es hakt.
                        </li>
                    </ul>
                </section>

                {/* ------------------------------------------------- Formular */}
                <section className={styles.formular}>
                    <div
                        className={styles.reiterLeiste}
                        role="tablist"
                        aria-label="Anmelden oder registrieren"
                    >
                        <button
                            type="button"
                            role="tab"
                            aria-selected={modus === "anmelden"}
                            className={`${styles.reiter} ${modus === "anmelden" ? styles.reiterAktiv : ""}`}
                            onClick={() => wechseln("anmelden")}
                        >
                            Anmelden
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={modus === "registrieren"}
                            className={`${styles.reiter} ${modus === "registrieren" ? styles.reiterAktiv : ""}`}
                            onClick={() => wechseln("registrieren")}
                        >
                            Konto erstellen
                        </button>
                    </div>

                    <h1 className={styles.titel}>
                        {modus === "anmelden" ? "Willkommen zurück" : "Lern mit Lexio"}
                    </h1>
                    <p className={styles.untertitel}>
                        {modus === "anmelden"
                            ? "Melde dich an, um weiterzulernen."
                            : "Dauert eine Minute. Dein Fortschritt gehört dir."}
                    </p>

                    {fehler && (
                        <p className={styles.fehler} role="alert">
                            <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />
                            {fehler}
                        </p>
                    )}

                    <SetupHinweis variante="gross" />

                    {aktiveAnbieter.length > 0 && (
                        <div className={styles.anbieter}>
                            {aktiveAnbieter.map((p) => (
                                <button
                                    key={p.id}
                                    type="button"
                                    className={styles.anbieterKnopf}
                                    onClick={() => void mitProvider(p.id)}
                                    disabled={status !== "leer"}
                                >
                                    {status === "oauth" ? (
                                        <i className="fa-solid fa-spinner fa-spin" aria-hidden="true" />
                                    ) : (
                                        ICON[p.id]
                                    )}
                                    <span>
                                        {status === "oauth" ? "Einen Moment…" : `Mit ${p.name} anmelden`}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}

                    {aktiveAnbieter.length > 0 && (
                        <div className={styles.trenner}>
                            <span className={styles.trennerLinie} />
                            <span className={styles.trennerText}>oder mit E-Mail</span>
                            <span className={styles.trennerLinie} />
                        </div>
                    )}

                    <form className={styles.form} onSubmit={absenden}>
                        {modus === "registrieren" && (
                            <label className={styles.feld}>
                                <span className={styles.label}>Name</span>
                                <input
                                    className={styles.eingabe}
                                    value={vorname}
                                    onChange={(e) => setVorname(e.target.value)}
                                    placeholder="Wie sollen wir dich nennen?"
                                    autoComplete="name"
                                    maxLength={60}
                                />
                            </label>
                        )}

                        <label className={styles.feld}>
                            <span className={styles.label}>E-Mail</span>
                            <input
                                ref={emailRef}
                                className={styles.eingabe}
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="du@example.com"
                                autoComplete="email"
                                autoCapitalize="none"
                                spellCheck={false}
                                required
                            />
                        </label>

                        <label className={styles.feld}>
                            <span className={styles.label}>Passwort</span>
                            <span className={styles.passwortFeld}>
                                <input
                                    className={styles.eingabe}
                                    type={zeigePasswort ? "text" : "password"}
                                    value={passwort}
                                    onChange={(e) => setPasswort(e.target.value)}
                                    placeholder={modus === "registrieren" ? `Mindestens ${MIN_PASSWORT} Zeichen` : "••••••••"}
                                    autoComplete={
                                        modus === "registrieren" ? "new-password" : "current-password"
                                    }
                                    required
                                />
                                <button
                                    type="button"
                                    className={styles.auge}
                                    onClick={() => setZeigePasswort((s) => !s)}
                                    aria-label={
                                        zeigePasswort ? "Passwort verbergen" : "Passwort anzeigen"
                                    }
                                    /*
                                     * Frueher tabIndex={-1}. Begruendet war das
                                     * vermutlich damit, dass die Leertaste dann
                                     * nicht umschaltet – aber sie wuerde den
                                     * Knopf ohnehin ausloesen, weil er
                                     * type="button" ist und nicht absendet. Der
                                     * Preis war hoch: mit der Tastatur war das
                                     * Passwort nie sichtbar zu machen.
                                     */
                                >
                                    <i
                                        className={
                                            zeigePasswort
                                                ? "fa-regular fa-eye-slash"
                                                : "fa-regular fa-eye"
                                        }
                                        aria-hidden="true"
                                    />
                                </button>
                            </span>
                        </label>

                        <button
                            type="submit"
                            className={styles.absenden}
                            disabled={status !== "leer" || sperreBis > 0}
                        >
                            {status === "prueft" ? (
                                <i className="fa-solid fa-spinner fa-spin" aria-hidden="true" />
                            ) : (
                                <i
                                    className={
                                        modus === "anmelden" ? "fa-solid fa-arrow-right-to-bracket" : "fa-solid fa-user-plus"
                                    }
                                    aria-hidden="true"
                                />
                            )}
                            {status === "prueft" ? (
                                "Einen Moment…"
                            ) : sperreBis > 0 ? (
                                <>
                                    <i className="fa-solid fa-hourglass-half" aria-hidden="true" />
                                    {sperreSekunden} s warten
                                </>
                            ) : modus === "anmelden" ? (
                                "Anmelden"
                            ) : (
                                "Konto erstellen"
                            )}
                        </button>

                        <label className={styles.merkenZeile}>
                            <input
                                type="checkbox"
                                checked={merken}
                                onChange={(e) => setMerken(e.target.checked)}
                            />
                            <span>
                                Auf diesem Gerät angemeldet bleiben
                                <br />
                                <small style={{ opacity: 0.75 }}>
                                    {merken
                                        ? "Bleibt auch nach dem Schließen des Browsers angemeldet."
                                        : "Beim nächsten Start des Browsers musst du dich neu anmelden."}
                                </small>
                            </span>
                        </label>
                    </form>

                    {modus === "anmelden" && (
                        <Link href="/passwort-zuruecksetzen" className={styles.textKnopf}>
                            Passwort vergessen?
                        </Link>
                    )}
                </section>
            </div>
        </div>
    );
}
