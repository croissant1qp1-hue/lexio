"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { liesStand, merkeAnmeldung } from "@/lib/geraet";
import { setzeSessionDauer } from "@/lib/supabase/session-dauer";
import styles from "@/app/anmelden/anmelden.module.css";
import { MIN_PASSWORT, PASSWORT_FEHLER } from "@/lib/passwort";

/**
 * "Passwort vergessen" – Schritt 2 von 2: das neue Passwort setzen.
 *
 * Diese Seite wird direkt aus dem Link in der Mail aufgerufen. Supabase legt
 * die Sitzung dabei als Fragment in die Adresse (#access_token=…&refresh_token=…).
 * `createBrowserClient` verarbeitet das von sich aus (detectSessionInUrl), und
 * danach ist man fuer diesen Vorgang angemeldet.
 *
 * Zwei Faelle, die hier auftreten und beide behandelt sein muessen:
 *
 *  - Der Link ist gut. Dann wird das Passwort gesetzt, und weil die Sitzung
 *    schon steht, geht es ohne erneute Anmeldung weiter in die App.
 *
 *  - Der Link ist abgelaufen, wurde schon benutzt oder die Mail kam beim
 *    Provider nicht an. Dann gibt es keine Sitzung, und die Seite darf nicht
 *    behaupten, man sei angemeldet. Sie sagt es und verweist zurueck.
 *
 * Ausserdem: `useEffect` mit Abbruch-Flag. Ohne das setzt der spaete
 * Promise das Feld in eine Komponente, die der Router schon abgebaut hat.
 */
type Zustand = "prueft" | "bereit" | "ungueltig" | "fertig";

export default function PasswortAendernSeite() {
    const router = useRouter();
    const [zustand, setZustand] = useState<Zustand>("prueft");
    const [passwort, setPasswort] = useState("");
    const [wiederholung, setWiederholung] = useState("");
    const [fehler, setFehler] = useState<string | null>(null);
    const [laeuft, setLaeuft] = useState(false);

    useEffect(() => {
        let abgebrochen = false;

        /*
         * `getSession` reicht hier aus, obwohl die Regel lautet, niemals
         * getSession zu vertrauen: hier wird nichts entschieden, nur geprüft,
         * OB eine Sitzung da ist. Das Setzen des Passworts ruft
         * `updateUser` auf, und das prüft sein Token gegen Supabase - es
         * kann ohne Sitzung gar nicht erst laufen.
         */
        void createClient()
            .auth.getSession()
            .then(({ data }) => {
                if (abgebrochen) return;
                setZustand(data.session ? "bereit" : "ungueltig");
            })
            .catch(() => {
                if (!abgebrochen) setZustand("ungueltig");
            });

        return () => {
            abgebrochen = true;
        };
    }, []);

    async function speichern(event: React.FormEvent) {
        event.preventDefault();
        if (laeuft) return;

        if (passwort.length < MIN_PASSWORT) {
            setFehler(PASSWORT_FEHLER);
            return;
        }
        if (passwort !== wiederholung) {
            setFehler("Die beiden Passwörter stimmen nicht überein.");
            return;
        }

        setLaeuft(true);
        setFehler(null);
        try {
            const supabase = createClient();
            const { error } = await supabase.auth.updateUser({ password: passwort });
            if (error) {
                setFehler(error.message);
                return;
            }

            /*
             * Die Sitzung aus dem Reset-Link ist jetzt eine ganz normale.
             * Das Geraet merkt sie sich wie bei jeder anderen Anmeldung –
             * sonst waere nach dem Passwortwechsel die E-Mail plötzlich
             * wieder leer, obwohl die Checkbox "angemeldet bleiben" noch
             * angeklickt ist.
             */
            const { data } = await supabase.auth.getUser();
            if (data.user?.email) {
                const merken = liesStand().merken;
                merkeAnmeldung(data.user.email, merken);
                setzeSessionDauer(merken);
            }

            setZustand("fertig");
            // Kurzer Moment zum Lesen, dann weiter – ohne Router, weil der
            // Server diese neue Sitzung noch nicht gesehen hat.
            window.setTimeout(() => router.replace("/"), 900);
        } catch {
            setFehler("Keine Verbindung zum Server. Versuche es gleich noch einmal.");
        } finally {
            setLaeuft(false);
        }
    }

    return (
        <div className={styles.seite}>
            <div className={styles.karte}>
                <span className={styles.zeichen} aria-hidden="true">
                    <i className="fa-solid fa-lock-open" />
                </span>

                {zustand === "prueft" && (
                    <>
                        <h1 className={styles.titelFastFertig}>Einen Moment…</h1>
                        <p className={styles.text}>Der Link wird geprüft.</p>
                    </>
                )}

                {zustand === "ungueltig" && (
                    <>
                        <h1 className={styles.titelFastFertig}>Link abgelaufen</h1>
                        <p className={styles.text}>
                            Dieser Link funktioniert nicht mehr. Das kann zwei Gründe haben: Er ist
                            älter als eine Stunde, oder er wurde schon benutzt. Beides ist
                            normal – ein neuer Link genügt.
                        </p>
                        <Link href="/passwort-zuruecksetzen" className={styles.absenden}>
                            <i className="fa-solid fa-paper-plane" aria-hidden="true" />
                            Neuen Link anfordern
                        </Link>
                    </>
                )}

                {zustand === "bereit" && (
                    <>
                        <h1 className={styles.titelFastFertig}>Passwort setzen</h1>
                        <p className={styles.text}>
                            Vergib ein neues Passwort. Damit bist du direkt angemeldet – kein
                            erneutes Einloggen nötig.
                        </p>

                        {fehler && (
                            <p className={styles.fehler} role="alert">
                                <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />
                                {fehler}
                            </p>
                        )}

                        <form className={styles.form} onSubmit={speichern}>
                            <label className={styles.feld}>
                                <span className={styles.label}>Neues Passwort</span>
                                <input
                                    className={styles.eingabe}
                                    type="password"
                                    value={passwort}
                                    onChange={(e) => setPasswort(e.target.value)}
                                    placeholder={`Mindestens ${MIN_PASSWORT} Zeichen`}
                                    autoComplete="new-password"
                                    required
                                    autoFocus
                                />
                            </label>
                            <label className={styles.feld}>
                                <span className={styles.label}>Wiederholen</span>
                                <input
                                    className={styles.eingabe}
                                    type="password"
                                    value={wiederholung}
                                    onChange={(e) => setWiederholung(e.target.value)}
                                    autoComplete="new-password"
                                    required
                                />
                            </label>
                            <button
                                type="submit"
                                className={styles.absenden}
                                disabled={laeuft}
                            >
                                {laeuft ? (
                                    <i className="fa-solid fa-spinner fa-spin" aria-hidden="true" />
                                ) : (
                                    <i className="fa-solid fa-check" aria-hidden="true" />
                                )}
                                {laeuft ? "Einen Moment…" : "Passwort speichern"}
                            </button>
                        </form>
                    </>
                )}

                {zustand === "fertig" && (
                    <>
                        <h1 className={styles.titelFastFertig}>Geschafft</h1>
                        <p className={styles.text}>
                            Das Passwort ist gespeichert. Du wirst weitergeleitet.
                        </p>
                    </>
                )}
            </div>
        </div>
    );
}
