"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { SetupHinweis } from "@/components/gesundheit/setup-hinweis";
import styles from "@/app/anmelden/anmelden.module.css";

/**
 * "Passwort vergessen" – Schritt 1 von 2: den Reset-Link anfordern.
 *
 * Der zweite Schritt ist /passwort-aendern. Zwei Seiten, weil der Link aus
 * der Mail eine eigene Sitzung mitbringt: wer ihn oeffnet, ist angemeldet,
 * aber nur zum Zweck des Passwortwechsels.
 *
 * Zwei Regeln, die hier mehr zaehlen als die Optik:
 *
 *  1. Die Antwort ist IMMER dieselbe, ob es die Adresse gibt oder nicht.
 *     "Diese E-Mail ist nicht registriert" waere eine Adressliste fuer jeden,
 *     der eine beliebige Adresse eingibt.
 *
 *  2. Der Hinweis auf einen fehlenden Mailserver steht hier. Ohne SMTP
 *     geht die Mail nicht raus, der Nutzer wartet vergeblich – und diese
 *     Seite ist der einzige Ort, an dem er es erfahren kann, ohne selbst zu
 *     suchen.
 */
export default function PasswortZuruecksetzenSeite() {
    const [email, setEmail] = useState("");
    const [abgeschickt, setAbgeschickt] = useState(false);
    const [laeuft, setLaeuft] = useState(false);
    const [fehler, setFehler] = useState<string | null>(null);

    async function absenden(event: React.FormEvent) {
        event.preventDefault();
        if (laeuft) return;
        const mail = email.trim().toLowerCase();
        if (!mail) {
            setFehler("Bitte gib deine E-Mail-Adresse ein.");
            return;
        }

        setLaeuft(true);
        setFehler(null);
        try {
            const supabase = createClient();
            const ziel = `${window.location.origin}/passwort-aendern`;
            const { error } = await supabase.auth.resetPasswordForEmail(mail, {
                /*
                 * Muss eine absolute URL sein, und Supabase muss sie kennen:
                 * unter Authentication → URL Configuration → Redirect URLs.
                 * Fehlt sie dort, lehnt GoTrue den Aufruf ab.
                 */
                redirectTo: ziel,
            });

            /*
             * Drei Ausgänge, drei Behandlungen. "Adresse unbekannt" und
             * "Adresse bekannt" bekommen bewusst denselben Text – sonst lässt
             * sich mit dieser Seite ausprobieren, welche Adressen ein Konto
             * haben.
             *
             * Der dritte Fall ist der Redirect-Fehler, und der entsteht nicht
             * aus der Adresse, sondern aus dem Projekt. GoTrue lehnt dann den
             * Aufruf selbst ab und erzeugt gar keine Mail. Das wie Erfolg zu
             * behandeln – so wie es vorher lief – heißt: "Die E-Mail ist
             * unterwegs", während jemand auf eine Nachricht wartet, die es
             * nie gab. Bei "Adresse unbekannt" darf man das nicht unterscheiden,
             * weil die Antwort sonst verrät, welche Konten es gibt. Bei einem
             * Konfigurationsfehler schon: Der gilt für jede Adresse gleich und
             * verrät damit nichts über den Nutzer.
             */
            const redirectFehler =
                error !== null && /not allowed|invalid redirect|requested path|redirect_to/i.test(error.message);

            if (redirectFehler) {
                setFehler(
                    `Supabase kennt die Rücksprung-Adresse nicht und hat den Versand deshalb ` +
                        `abgelehnt – es wurde keine E-Mail erzeugt. Trage ${ziel} unter ` +
                        `Authentication → URL Configuration → Redirect URLs ein.`,
                );
                return;
            }
            if (error) {
                setFehler(error.message);
                return;
            }
            setAbgeschickt(true);
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
                    <i className="fa-solid fa-key" />
                </span>
                <h1 className={styles.titelFastFertig}>Neues Passwort</h1>

                {abgeschickt ? (
                    <>
                        <p className={styles.text}>
                            Wenn es zu dieser Adresse ein Konto gibt, ist jetzt eine E-Mail mit
                            einem Link unterwegs. Der Link ist eine Stunde gültig.
                        </p>
                        <SetupHinweis variante="gross" />
                        <p className={styles.fussnote}>
                            Nichts angekommen? Sieh im Spam-Ordner nach. Fehlt die Mail auch dort,
                            steht oben, woran es liegt.
                        </p>
                    </>
                ) : (
                    <>
                        <p className={styles.text}>
                            Gib deine E-Mail-Adresse ein. Wir schicken dir einen Link, mit dem du
                            ein neues Passwort vergeben kannst.
                        </p>

                        <SetupHinweis variante="gross" />

                        {fehler && (
                            <p className={styles.fehler} role="alert">
                                <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />
                                {fehler}
                            </p>
                        )}

                        <form className={styles.form} onSubmit={absenden}>
                            <label className={styles.feld}>
                                <span className={styles.label}>E-Mail</span>
                                <input
                                    className={styles.eingabe}
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="du@example.com"
                                    autoComplete="email"
                                    autoCapitalize="none"
                                    spellCheck={false}
                                    required
                                    autoFocus
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
                                    <i className="fa-solid fa-paper-plane" aria-hidden="true" />
                                )}
                                {laeuft ? "Einen Moment…" : "Link schicken"}
                            </button>
                        </form>
                    </>
                )}

                <Link href="/anmelden" className={styles.textKnopf}>
                    Zurück zur Anmeldung
                </Link>
            </div>
        </div>
    );
}
