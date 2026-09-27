import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { holeUser } from "@/lib/supabase/user";
import { levelInfo } from "@/lib/profil";
import NavLink from "./nav-link";
import ProfilKarte from "./profil-karte";
import type { ProfilDaten } from "./profil-karte";

/**
 * Seitenleiste.
 *
 * Ein Server Component. Sie liest Session und Profil direkt und gibt die
 * Werte fertig an die Client-Komponenten weiter. Ein Client-Fetch wuerde
 * bedeuten, dass die Seitenleiste im ersten Frame "Level 1" anzeigt und den
 * echten Wert erst einen Moment spaeter einsetzt – sichtbar, weil die Zahl
 * bei jedem Laden springt.
 *
 * Die Korrekturtheit haengt an der Datenbank: die Policies in 003 lassen
 * ausschliesslich eigene Zeilen zu. Ein ausgelassener getUser()-Aufruf wuerde
 * hier zwar keine fremden Daten zeigen, aber die Route ist trotzdem die
 * richtige Stelle fuer die Pruefung.
 */

/**
 * Fuenf Eintraege, nicht sieben.
 *
 * "Karteikarten" und "Wortschatz" zeigten dieselbe Liste zweimal, einmal als
 * Tabelle und einmal als Aufzaehlung. Auf dem Telefon standen dadurch
 * Eintraege nebeneinander, die dasselbe taten, und die Beschriftung wurde
 * zweizeilig, weil die Leiste breiter wurde als das Label.
 */
const NAVBAR_ELEMENTE = [
    { name: "Übersicht", abkuerzung: "Start", icon: "fa-solid fa-house", href: "/" },
    { name: "Wortschatz", icon: "fa-solid fa-layer-group", href: "/karteikarten" },
    { name: "Statistiken", icon: "fa-solid fa-chart-simple", href: "/statistiken" },
    // Frueher stand hier "Profil" als Kurzel. Seit es /profil gibt, waeren
    // zwei Eintraege in der unteren Tableiste gleich beschriftet – und der
    // falsche angeklickt. "Mehr" sagt, was der Eintrag ist: der Rest, der
    // sich nicht in eine eigene Kategorie pressen laesst.
    { name: "Einstellungen", abkuerzung: "Mehr", icon: "fa-solid fa-gear", href: "/einstellungen" },
];

/**
 * Erster Buchstabe vom Namen, fuer die Tableiste ohne Profilbild.
 *
 * Steht auch in profil-karte.tsx und auf /profil – dreimal derselbe
 * Einzeiler, und in app/(app)/profil/page.tsx exportiert, damit die
 * Anzeige nicht auseinanderlaufen kann. toLocaleUpperCase("de") gibt "ß"
 * nicht zu "SS" zurueck; hier soll ein Zeichen ein Zeichen bleiben.
 */
export function initialAus(name: string): string {
    const zeichen = name.trim().charAt(0);
    return zeichen ? zeichen.toLocaleUpperCase("de-DE") : "?";
}

/** Fuer den Fall, dass der Proxy laeuft und trotzdem niemand angemeldet ist. */
const LEER: ProfilDaten = {
    vorname: "Gast",
    email: null,
    avatarUrl: null,
    xp: 0,
    level: 1,
    xpImLevel: 0,
    levelProzent: 0,
    bisNaechstes: 0,
    streak: 0,
    lerntage: 0,
    setsGelernt: 0,
};

export default async function Navbar() {
    const supabase = await createClient();
    /*
     * `holeUser` liefert drei Ausgaenge, nicht zwei: angemeldet, nicht
     * angemeldet, oder Supabase war nicht erreichbar. In den beiden letzten
     * Faellen zeigen die Daten unten LEER an – aber das ist ein Unterschied:
     * "Gast" behauptet, es gaebe niemanden, und der Proxy leitet dann auf
     * die Anmeldeseite um. Bei einer Stoerung will man das nicht, man will
     * ein paar Sekunden warten. Der Proxy entscheidet das inzwischen
     * richtig (siehe proxy.ts); hier genuegt es, ihn nicht zu unterlaufen.
     */
    const { user } = await holeUser(supabase);

    /*
     * Profil und Fortschritt parallel, und beide mit Fehlertoleranz.
     * Fehlt die Migration 003, liefern beide Abfragen Fehler – die
     * Seitenleiste soll dann ohne Zahlen erscheinen, nicht gar nicht.
     */
    const [profil, fortschritt] = user
        ? await Promise.allSettled([
              supabase
                  .from("profil")
                  .select("vorname, avatar_url")
                  .eq("id", user.id)
                  .maybeSingle(),
              supabase
                  .from("mein_fortschritt")
                  .select("xp_gesamt, streak, lerntage, sets_gelernt")
                  .maybeSingle(),
          ])
        : ([null, null] as const);

    const profildaten =
        profil && profil.status === "fulfilled" && profildatenAus(profil.value.data)
            ? profildatenAus(profil.value.data)!
            : null;

    const stand =
        fortschritt && fortschritt.status === "fulfilled" && fortschritt.value.data
            ? fortschritt.value.data
            : null;

    const info = levelInfo(stand?.xp_gesamt ?? 0);

    const ausMeta = user?.user_metadata?.full_name ?? user?.user_metadata?.name;
    const emailname = (user?.email ?? "").split("@")[0];

    const daten: ProfilDaten = user
        ? {
              vorname:
                  profildaten?.vorname?.trim() ||
                  ausMeta?.trim() ||
                  emailname ||
                  "Lexio",
              email: user.email ?? null,
              avatarUrl:
                  profildaten?.avatar_url ??
                  user.user_metadata?.avatar_url ??
                  user.user_metadata?.picture ??
                  null,
              xp: info.xp,
              level: info.level,
              xpImLevel: info.xpImLevel,
              levelProzent: info.prozent,
              bisNaechstes: info.bisNaechstes,
              streak: stand?.streak ?? 0,
              lerntage: stand?.lerntage ?? 0,
              setsGelernt: stand?.sets_gelernt ?? 0,
          }
        : LEER;

    return (
        <nav className="side-bar" aria-label="Hauptnavigation">
            <div className="logo-title">
                <Link href="/" className="logo-link" aria-label="Lexio – zur Übersicht">
                    <Image
                        alt=""
                        className="logo"
                        src="/images/logo.png"
                        width={38}
                        height={38}
                        priority
                    />
                </Link>
                <h4 className="title">Lexio</h4>
            </div>

            <div className="side-bar-menu">
                {NAVBAR_ELEMENTE.map((element) => (
                    <NavLink
                        key={element.href}
                        name={element.name}
                        abkuerzung={element.abkuerzung}
                        icon={element.icon}
                        href={element.href}
                    />
                ))}

                {/*
                 * Das Hinzufuegen liegt bewusst in der Liste und nicht als
                 * schwebender Knopf daneben. Ein FAB ueber der unteren
                 * Tableiste ueberlagert den Inhalt und steht im Konflikt mit
                 * dem Systemrand auf dem iPhone.
                 */}
                <NavLink
                    name="Vokabeln hinzufügen"
                    abkuerzung="Hinzufügen"
                    icon="fa-solid fa-plus"
                    href="/karteikarten-hinzufuegen"
                    zusatzKlasse="add"
                />

                {/*
                 * Profil als eigener Eintrag, nicht nur als Karte unten in
                 * der Leiste.
                 *
                 * Die Karte ist auf dem Telefon per `display: none`
                 * ausgeblendet – dort stand als Begruendung, der
                 * Abmelde-Weg liege in den Einstellungen. Damit war auf
                 * dem Handy nicht sichtbar, wer angemeldet ist, und die
                 * Frage "wer bin ich hier" hatte keine Antwort.
                 *
                 * Steht am Ende der Liste: die vier Hauptbereiche und das
                 * Hinzufuegen stehen links, das Profil rechts, wie in
                 * fast jeder App. Haette es ganz vorne gestanden, waere
                 * "Übersicht" nicht mehr der erste Eintrag.
                 *
                 * Avatar und Initiale kommen aus denselben Werten wie die
                 * Karte darueber – es ist dieselbe Person, sie soll nur
                 * einmal im Code stehen. Faellt das Profilbild aus, gibt
                 * es den ersten Buchstaben statt eines leeren Kreises.
                 */}
                <NavLink
                    name="Mein Profil"
                    abkuerzung="Profil"
                    icon="fa-solid fa-user"
                    href="/profil"
                    avatarUrl={daten.avatarUrl}
                    initialen={daten.vorname ? initialAus(daten.vorname) : null}
                    zusatzKlasse="profil"
                />
            </div>

            <ProfilKarte daten={daten} />
        </nav>
    );
}

/** Typ-Guard: PostgREST liefert `any`, auch wenn man es nicht so tippt. */
function profildatenAus(
    zeile: { vorname?: string | null; avatar_url?: string | null } | null,
): { vorname: string | null; avatar_url: string | null } | null {
    if (!zeile) return null;
    return {
        vorname: zeile.vorname ?? null,
        avatar_url: zeile.avatar_url ?? null,
    };
}
