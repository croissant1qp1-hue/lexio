"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { levelInfo, xpFormatieren } from "@/lib/profil";
import styles from "./profil-karte.module.css";

export type ProfilDaten = {
    vorname: string;
    email: string | null;
    avatarUrl: string | null;
    xp: number;
    level: number;
    xpImLevel: number;
    levelProzent: number;
    bisNaechstes: number;
    streak: number;
    lerntage: number;
    setsGelernt: number;
};

/** Erster Buchstabe vom Namen, fuer den Fall ohne Profilbild. */
function initial(name: string): string {
    const zeichen = name.trim().charAt(0);
    // toLocaleUpperCase("de") gibt "ß" nicht zu "SS" – das will hier
    // keiner, ein Zeichen soll ein Zeichen bleiben.
    return zeichen ? zeichen.toLocaleUpperCase("de-DE") : "?";
}

/**
 * Profilkarte in der Seitenleiste: Bild, Name, Level, XP-Balken, Abmelden.
 *
 * Stand vorher als statischer Text ("Mustermann", "Level 5 • 6777 XP", 65 %,
 * 🔥18). Die Zahl im Lernmodul kam dagegen aus dem localStorage. Zwei
 * Quellen fuer dieselbe Sache, von denen keine die andere je gesehen hat.
 */
export default function ProfilKarte({ daten }: { daten: ProfilDaten }) {
    const router = useRouter();
    const [offen, setOffen] = useState(false);
    const [meldung, setMeldung] = useState<string | null>(null);

    const karteRef = useRef<HTMLDivElement>(null);
    const knopfRef = useRef<HTMLButtonElement>(null);

    const info = levelInfo(daten.xp);

    // Klick daneben schliesst das Menue. Ohne das bleibt es offen, bis man
    // genau denselben Knopf noch einmal trifft.
    useEffect(() => {
        if (!offen) return;

        function draussenKlicken(ereignis: MouseEvent) {
            if (!karteRef.current?.contains(ereignis.target as Node)) {
                setOffen(false);
                knopfRef.current?.focus();
            }
        }
        function taste(ereignis: KeyboardEvent) {
            if (ereignis.key === "Escape") {
                setOffen(false);
                knopfRef.current?.focus();
            }
        }

        document.addEventListener("mousedown", draussenKlicken);
        document.addEventListener("keydown", taste);
        return () => {
            document.removeEventListener("mousedown", draussenKlicken);
            document.removeEventListener("keydown", taste);
        };
    }, [offen]);

    async function abmelden() {
        setMeldung("Abmelden…");
        // Fehler werden bewusst geschluckt: was danach passiert, ist
        // ohnehin /anmelden. Ein Fehlertext an dieser Stelle wuerde nur
        // stehen bleiben, bis die Seite ohnehin neu laedt.
        await createClient().auth.signOut().catch(() => undefined);
        router.replace("/anmelden");
        router.refresh();
    }

    return (
        <div className={styles.karte} ref={karteRef}>
            {/*
             * Das Profil ist ein Link.
             *
             * Vorher stand hier Name, Level und XP als reiner Text: man
             * konnte es ansehen, aber nicht anklicken, und die einzige
             * Alternative zu /einstellungen war das Aufklappmenue
             * rechts daneben. Die Daten waren also da – Level, XP, Streak,
             * Lerntage – nur nicht erreichbar, obwohl die App sie
             * an drei Stellen schon berechnet.
             *
             * `next/link` statt <a>: damit bleibt der Wechsel ein
             * Client-Navigieren, die Seitenleiste bleibt stehen und der
             * Server liefert nur die neue Seite. Ein <a href> wuerde die
             * ganze App neu laden – bei einer Lern-App mit offenen
             * Karten ein spuerbarer Unterschied.
             */}
            <Link href="/profil" className={styles.profilLink} aria-label="Mein Profil">
                <div className={styles.daten}>
                    <div className={styles.bildRahmen}>
                        {daten.avatarUrl ? (
                            <Image
                                src={daten.avatarUrl}
                                alt=""
                                width={38}
                                height={38}
                                className={styles.bild}
                                unoptimized
                                referrerPolicy="no-referrer"
                            />
                        ) : (
                            <span className={styles.initialen} aria-hidden="true">
                                {initial(daten.vorname)}
                            </span>
                        )}
                    </div>

                    <div className={styles.text}>
                        <span className={styles.name}>{daten.vorname}</span>
                        <span className={styles.level}>
                            Level {daten.level} · {xpFormatieren(daten.xp)} XP
                        </span>
                    </div>
                </div>
            </Link>

            {/* Balken: der Wert kommt aus derselben Rechnung wie die Zahl
                darüber. Zwei unabhaengige Werte wären irgendwann
                widerspruechlich. */}
            <div
                className={styles.balken}
                role="progressbar"
                aria-valuenow={info.prozent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Fortschritt zu Level ${info.level + 1}`}
            >
                <div className={styles.fuellung} style={{ width: `${info.prozent}%` }} />
            </div>
            <div className={styles.fuss}>
                <span className={styles.prozent}>{info.prozent} %</span>
                <span className={styles.rest}>noch {xpFormatieren(info.bisNaechstes)} XP</span>
            </div>

            <button
                type="button"
                ref={knopfRef}
                className={styles.ausklappen}
                onClick={() => setOffen((o) => !o)}
                aria-expanded={offen}
                aria-haspopup="menu"
                aria-label="Kontomenü öffnen"
            >
                <i
                    className={offen ? "fa-solid fa-chevron-up" : "fa-solid fa-chevron-down"}
                    aria-hidden="true"
                />
            </button>

            {offen && (
                <div className={styles.menue} role="menu">
                    {daten.email && <p className={styles.email}>{daten.email}</p>}

                    <div className={styles.werte}>
                        <div className={styles.wert}>
                            <span className={styles.wertZahl}>{daten.streak}</span>
                            <span className={styles.wertLabel}>
                                {daten.streak === 1 ? "Tag Serie" : "Tage Serie"}
                            </span>
                        </div>
                        <div className={styles.wert}>
                            <span className={styles.wertZahl}>{daten.lerntage}</span>
                            <span className={styles.wertLabel}>
                                {daten.lerntage === 1 ? "Lerntag" : "Lerntage"}
                            </span>
                        </div>
                        <div className={styles.wert}>
                            <span className={styles.wertZahl}>{daten.setsGelernt}</span>
                            <span className={styles.wertLabel}>
                                {daten.setsGelernt === 1 ? "Set" : "Sets"}
                            </span>
                        </div>
                    </div>

                    <button type="button" className={styles.abmelden} onClick={abmelden} role="menuitem">
                        <i className="fa-solid fa-arrow-right-from-bracket" aria-hidden="true" />
                        {meldung ?? "Abmelden"}
                    </button>
                </div>
            )}
        </div>
    );
}
