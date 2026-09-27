"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Ein Eintrag der Navigation.
 *
 * Als Client-Komponente, obwohl er nur aus einem Link besteht: die
 * Seitenleiste selbst ist ein Server Component (sie liest die Session), und
 * nur die aktive Markierung braucht den aktuellen Pfad. Das haelt Name,
 * Level und XP im ersten Frame korrekt – ein Client-Fetch wuerde sie erst
 * nach dem ersten Paint einsetzen, also mit einem kurzen "Level 1".
 *
 * Link statt router.push(): ein Link ist ein Link. Er ist mit der rechten
 * Maustaste anklickbar, funktioniert mitmittelklick, und Next
 * kann das Ziel vorab laden.
 */
export default function NavLink({
    name,
    icon,
    href,
    abkuerzung,
    zusatzKlasse,
    avatarUrl,
    initialen,
}: {
    name: string;
    icon: string;
    href: string;
    /** Kuerzere Beschriftung fuer die untere Tableiste. */
    abkuerzung?: string;
    /**
     * Zusaetzliche Klasse neben "button" und "button active".
     *
     * Der Hinzufuegen-Eintrag braucht "add" fuer seine eigene Optik – und
     * war vorher ein nackter <Link> ohne jede aktive Markierung. Auf dem
     * Telefon leuchtete beim Wortschatz-Tab nichts auf, obwohl man im
     * Hinzufuegen-Wizard war und sich in einem Unterordner davon befindet.
     */
    zusatzKlasse?: string;
    /**
     * Profilbild statt eines Symbols. Nur der Profil-Tab benutzt das.
     *
     * Bewusst kein Pflichtfeld: die anderen fuenf Eintraege brauchen kein
     * Bild, und ein Icon-Slot, den man erst mit `null` fuellen muss, ist
     * eine Fehlerquelle ohne Nutzen.
     */
    avatarUrl?: string | null;
    /** Ersatz fuer das Bild: erster Buchstabe des Namens. */
    initialen?: string | null;
}) {
    const pathname = usePathname();

    // /karteikarten-hinzufuegen/xyz ist auch "Hinzufuegen". Ohne das bleibt
    // beim Wizard kein Eintrag markiert und man weiss nicht, wo man ist.
    const aktiv = pathname === href || (pathname?.startsWith(`${href}/`) ?? false);

    const klassen = ["button"];
    if (aktiv) klassen.push("active");
    if (zusatzKlasse) klassen.push(zusatzKlasse);

    return (
        <Link
            href={href}
            className={klassen.join(" ")}
            // aria-current ist das, was Screenreader vorlesen. Die
            // Farbmarkierung allein sagt einem Screenreader nichts.
            aria-current={aktiv ? "page" : undefined}
            title={name}
        >
            {/*
              * `unoptimized` wie in der Profilkarte: die Bilder kommen von
              * OAuth-Servern, die Next nicht optimieren kann. `sizes` waere
              * trotzdem nuetzlich, aber bei einem 28px-Bild in einer
              * Tableiste ist der Unterschied zur Auslieferung in Original-
              * groesse nicht messbar – und `unoptimized` heisst, es wird
              * gar nicht erst durch die Bildoptimierung geschickt.
              */}
            {avatarUrl ? (
                <Image
                    src={avatarUrl}
                    alt=""
                    width={28}
                    height={28}
                    className="nav-avatar"
                    unoptimized
                    referrerPolicy="no-referrer"
                />
            ) : initialen ? (
                <span className="nav-avatar nav-initialen" aria-hidden="true">
                    {initialen}
                </span>
            ) : (
                <i className={icon} aria-hidden="true" />
            )}
            <span className="button-text">{abkuerzung ?? name}</span>
        </Link>
    );
}
