'use client';

import { useState } from "react";
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useDesign } from "@/components/design/design-anbieter";
import { liesStand, setzeMerken, vergissAnmeldung } from "@/lib/geraet";
import { liesTon, setzeTon, type TonStand } from "@/lib/ton";
import { holeAbo, pushAn, pushAus } from "@/lib/push-client";
import { setzeSessionDauer } from "@/lib/supabase/session-dauer";
import "./einstellung.css";
import { MIN_PASSWORT, PASSWORT_FEHLER } from "@/lib/passwort";

/**
 * Einstellungen.
 *
 * Der Design-Schalter war vorher ein `<select>` ohne `value`, ohne `onChange`
 * und ohne jede Verbindung zu einer Schriftart- oder Farbdatei: man konnte
 * waehlen, es passierte nichts, und nach einem Neuladen war die Wahl weg. Jetzt
 * haengt er am Anbieter aus components/design/design-anbieter.tsx, der das
 * Attribut data-design an <html> setzt – und damit auch global.css greift.
 *
 * Derselbe Fall, zweimal: der Konto-Bereich hatte zwei abgeschaltete
 * Eingabefelder (E-Mail, Passwort) und einen Text, der behauptete, beides
 * gehe nur über Supabase. Beides war falsch und war der Grund, warum es
 * niemand getestet hat. Jetzt sind es zwei funktionierende Dinge: das
 * Passwort aendern und entscheiden, ob dieses Geraet angemeldet bleibt.
 *
 * Die restlichen Regler (Sprache, Land) bleiben abgeschaltet: sie wollen
 * eine Speicherung, die es noch nicht gibt – eine Auswahl, die beim Klick
 * eine Einstellung verspricht und nichts speichert, ist schlimmer als kein
 * Schalter: Man glaubt ihm. Die Töne und die Tages-Erinnerung sind dagegen
 * echt: Töne laufen über lib/ton.ts (Geräte-Einstellung), die Erinnerung
 * über Web-Push (Plan 3.1).
 */

export default function Einstellungen() {
    const router = useRouter();
    const { design, setDesign } = useDesign();
    const [abmeldenLaeuft, setAbmeldenLaeuft] = useState(false);

    const [merken, setMerken] = useState(() => liesStand().merken);
    const [ton, setTon] = useState(() => liesTon());
    const [passwort, setPasswort] = useState("");
    const [wiederholung, setWiederholung] = useState("");
    const [passwortLaeuft, setPasswortLaeuft] = useState(false);
    const [passwortMeldung, setPasswortMeldung] = useState<{
        art: "ok" | "fehler";
        text: string;
    } | null>(null);

    /*
     * Tägliche Erinnerung. `null` bedeutet "noch unbekannt": der Stand wird
     * erst beim Öffnen der Seite geladen (hat dieses Gerät ein Abo?).
     */
    const [erinnerung, setErinnerung] = useState<boolean | null>(null);
    const [erinnerungLaeuft, setErinnerungLaeuft] = useState(false);
    const [erinnerungMeldung, setErinnerungMeldung] = useState<{
        art: "ok" | "fehler";
        text: string;
    } | null>(null);
    const [pushUnterstuetzt] = useState(
        () =>
            typeof window !== "undefined" &&
            "serviceWorker" in navigator &&
            "PushManager" in window,
    );

    useEffect(() => {
        let weg = false;
        holeAbo()
            .then((abo) => {
                if (!weg) setErinnerung(abo !== null);
            })
            .catch(() => {
                if (!weg) setErinnerung(false);
            });
        return () => {
            weg = true;
        };
    }, []);

    async function abmelden() {
        if (abmeldenLaeuft) return;
        setAbmeldenLaeuft(true);
        // Fehler werden geschluckt: was danach passiert, ist ohnehin
        // /anmelden. Ein Fehlertext wuerde nur stehen bleiben, bis die Seite
        // ohnehin neu laedt.
        await createClient().auth.signOut().catch(() => undefined);
        /*
         * Abgemeldet heisst auch: auf diesem Geraet ist niemand mehr
         * eingetragen. Ohne das bliebe die E-Mail-Adresse im localStorage
         * stehen – auf einem gemeinsamen Rechner sieht die naechste Person
         * damit, wer hier angemeldet war. Siehe lib/geraet.ts.
         */
        vergissAnmeldung();
        router.replace("/anmelden");
        router.refresh();
    }

    function merkenUmschalten(neu: boolean) {
        setMerken(neu);
        setzeMerken(neu);
        // Wirkt sofort, nicht erst beim naechsten Anmelden: das Cookie
        // bekommt seine Lebensdauer jetzt.
        setzeSessionDauer(neu);
    }

    function toeneUmschalten(an: boolean) {
        setTon((alt) => {
            const neu = { ...alt, an };
            setzeTon(neu);
            return neu;
        });
    }

    function lautstaerkeWaehlen(lautstaerke: TonStand["lautstaerke"]) {
        setTon((alt) => {
            const neu = { ...alt, lautstaerke };
            setzeTon(neu);
            return neu;
        });
    }

    async function erinnerungUmschalten(an: boolean) {
        if (erinnerungLaeuft) return;
        setErinnerungLaeuft(true);
        setErinnerungMeldung(null);
        const ergebnis = an ? await pushAn() : await pushAus();
        if (ergebnis.ok) {
            setErinnerung(an);
            setErinnerungMeldung(an ? { art: "ok", text: "Die Erinnerung wird täglich zugestellt." }
                : { art: "ok", text: "Die Erinnerung ist ausgeschaltet." });
        } else {
            setErinnerung(!an);
            setErinnerungMeldung({
                art: "fehler",
                text: ergebnis.fehler ?? "Das Umschalten hat nicht geklappt.",
            });
        }
        setErinnerungLaeuft(false);
    }

    async function passwortSpeichern(event: React.FormEvent) {
        event.preventDefault();
        if (passwortLaeuft) return;
        setPasswortMeldung(null);

        if (passwort.length < MIN_PASSWORT) {
            setPasswortMeldung({ art: "fehler", text: PASSWORT_FEHLER });
            return;
        }
        if (passwort !== wiederholung) {
            setPasswortMeldung({ art: "fehler", text: "Die beiden Passwörter stimmen nicht überein." });
            return;
        }

        setPasswortLaeuft(true);
        try {
            const { error } = await createClient().auth.updateUser({ password: passwort });
            if (error) {
                setPasswortMeldung({ art: "fehler", text: error.message });
                return;
            }
            setPasswort("");
            setWiederholung("");
            setPasswortMeldung({ art: "ok", text: "Das Passwort ist gespeichert." });
        } catch {
            setPasswortMeldung({ art: "fehler", text: "Keine Verbindung zum Server." });
        } finally {
            setPasswortLaeuft(false);
        }
    }

    return (
        <div className="einstellungen">
            <div className="kopfzeile">
                <h4 className="überschrift">Einstellungen</h4>
                <p className="unterüberschrift">Passe Lexio an deine Bedürfnisse an</p>
            </div>

            <div className="main-content">
                <div className="allgemein">
                    <h4 className="text-prog">Allgemein</h4>

                    <label className="überschrift-sprache" htmlFor="design">
                        Design
                    </label>
                    <select
                        id="design"
                        className="input-field"
                        name="design"
                        value={design}
                        onChange={(e) => setDesign(e.target.value === "hell" ? "hell" : "dunkel")}
                    >
                        <option value="hell">Hell</option>
                        <option value="dunkel">Dunkel</option>
                    </select>
                    <p className="unterüberschrift-töne">
                        Gilt sofort und bleibt auch nach dem Neuladen erhalten.
                    </p>

                    <p className="überschrift-töne">Töne</p>
                    <div className="töne">
                        <div>
                            <p className="unterüberschrift-töne">
                                Das Vorlesen der Karten im Lernmodus spricht und ist laut.
                            </p>
                        </div>
                        <label className="switch2">
                            <input
                                id="tonAn"
                                type="checkbox"
                                checked={ton.an}
                                onChange={(e) => toeneUmschalten(e.target.checked)}
                            />
                            <span className="slider" />
                        </label>
                    </div>

                    <label className="überschrift-tonstärke" htmlFor="tonstärke">
                        Ton Lautstärke
                    </label>
                    <select
                        id="tonstärke"
                        className="input-field"
                        name="tonstärke"
                        value={ton.lautstaerke}
                        onChange={(e) =>
                            lautstaerkeWaehlen(e.target.value as TonStand["lautstaerke"])
                        }
                    >
                        <option value="leise">Leise</option>
                        <option value="normal">Normal</option>
                        <option value="laut">Laut</option>
                    </select>
                    <p className="unterüberschrift-töne">
                        Gilt sofort im Lernmodus und bleibt auf diesem Gerät erhalten.
                    </p>

                    <fieldset className="todo-gruppe" disabled>
                        <legend className="text-prog">Noch nicht umgesetzt</legend>
                        <p className="todo-hinweis">
                            Diese Regler sind im aktuellen Stand Attrappen. Sie werden erst
                            bedienbar, wenn es eine Speicherung dafür gibt – eine Auswahl, die beim
                            Neuladen verschwindet, ist keine Einstellung.
                        </p>

                        <p className="überschrift-sprache">Sprache</p>
                        <select id="sprache" className="input-field" name="sprache" defaultValue="deutsch">
                            <option value="deutsch">🇩🇪 Deutsch</option>
                            <option value="englisch">🇬🇧🇺🇸 Englisch</option>
                        </select>

                        <p className="überschrift-land">Land</p>
                        <select id="land" className="input-field" name="land" defaultValue="deutschland">
                            <option value="deutschland">🇩🇪 Deutschland</option>
                            <option value="österreich">🇦🇹 Österreich</option>
                            <option value="schweiz">🇨🇭 Schweiz</option>
                        </select>
                    </fieldset>
                </div>

                <div className="restliche-einstellungen">
                    <div className="benarichtigung">
                <h4 className="text-prog">Benachrichtigung</h4>
                <div className="dayly-reminders">
                    <div>
                        <p className="überschrift-reminder">Tägliche Erinnerung</p>
                        <p className="unterüberschrift-reminder">
                            {pushUnterstuetzt
                                ? "Erhalte eine tägliche Lernerinnerung, auch wenn Lexio zu ist."
                                : "Dieser Browser unterstützt keine Push-Benachrichtigungen."}
                        </p>
                    </div>
                    <label className={`switch ${pushUnterstuetzt ? "" : "switch-deaktiviert"}`} aria-label="Tägliche Erinnerung">
                        <input
                            id="dailyReminder"
                            type="checkbox"
                            checked={erinnerung === true}
                            disabled={!pushUnterstuetzt || erinnerungLaeuft || erinnerung === null}
                            onChange={(e) => void erinnerungUmschalten(e.target.checked)}
                        />
                        <span className="slider" />
                    </label>
                </div>
                {erinnerungMeldung && (
                    <p
                        className={erinnerungMeldung.art === "ok" ? "meldung-ok" : "meldung-fehler"}
                        role="status"
                    >
                        {erinnerungMeldung.text}
                    </p>
                )}
            </div>

                    <div className="daten">
                        <h4 className="text-prog">Konto</h4>

                        {/*
                         * Ohne das alte Passwort. `updateUser` verlangt es
                         * nicht, weil die Sitzung schon beweist, wer hier ist.
                         * Wer an einem angemeldeten Geraet sitzt, kann ohnehin
                         * alles lesen – ein Passwortwechsel wäre danach nur
                         * eine Selbstschaetzung, keine Sicherheitsgrenze.
                         */}
                        <form className="passwort-formular" onSubmit={passwortSpeichern}>
                            <label className="überschrift-passwort" htmlFor="neues-passwort">
                                Passwort ändern
                            </label>
                            <input
                                id="neues-passwort"
                                className="passwort-input"
                                type="password"
                                value={passwort}
                                onChange={(e) => setPasswort(e.target.value)}
                                placeholder="Neues Passwort"
                                autoComplete="new-password"
                            />
                            <input
                                className="passwort-input"
                                type="password"
                                value={wiederholung}
                                onChange={(e) => setWiederholung(e.target.value)}
                                placeholder="Wiederholen"
                                autoComplete="new-password"
                                aria-label="Neues Passwort wiederholen"
                            />
                            <button
                                type="submit"
                                className="save-button"
                                disabled={passwortLaeuft}
                            >
                                {passwortLaeuft ? "Speichert…" : "Speichern"}
                            </button>
                        </form>

                        {passwortMeldung && (
                            <p
                                className={
                                    passwortMeldung.art === "ok" ? "meldung-ok" : "meldung-fehler"
                                }
                                role="status"
                            >
                                {passwortMeldung.text}
                            </p>
                        )}

                        <p className="unterüberschrift-about">
                            {/*
                             * Wer sich nicht mehr an sein Passwort erinnert,
                             * ist mit dem Konto eingeschlossen – dieser Weg
                             * hilft nur, wenn man noch angemeldet ist. Sonst
                             * führt nur der Link aus der Mail weiter, und der
                             * braucht wiederum einen Mailserver.
                             */}
                            <Link href="/passwort-zuruecksetzen">Passwort vergessen?</Link>
                        </p>

                        <div className="dayly-reminders geraet-reihe">
                            <div>
                                <p className="überschrift-reminder">
                                    Auf diesem Gerät angemeldet bleiben
                                </p>
                                <p className="unterüberschrift-reminder">
                                    {merken
                                        ? "Du bleibst auch nach dem Schließen des Browsers angemeldet. Auf einem fremden Rechner bitte abschalten."
                                        : "Beim nächsten Start des Browsers musst du dich neu anmelden. Auf einem fremden Rechner die richtige Wahl."}
                                </p>
                            </div>
                            <label className="switch">
                                <input
                                    type="checkbox"
                                    checked={merken}
                                    onChange={(e) => merkenUmschalten(e.target.checked)}
                                    aria-label="Auf diesem Gerät angemeldet bleiben"
                                />
                                <span className="slider" />
                            </label>
                        </div>
                    </div>

                    <div className="sonstiges">
                        <h4 className="text-prog">Sonstiges</h4>
                        <div className="about">
                            <div className="about-container">
                                <p className="überschrift-about">Über Lexio</p>
                                <p className="unterüberschrift-about">Version 1.0.0</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="footer">
                {/*
                 * Auf dem Telefon ist die Profilkarte in der Seitenleiste
                 * ausgeblendet. Ohne diesen Knopf gaebe es dort gar keinen
                 * Weg aus dem Konto heraus.
                 */}
                <button
                    type="button"
                    className="reset-button"
                    onClick={() => void abmelden()}
                    disabled={abmeldenLaeuft}
                >
                    {abmeldenLaeuft ? "Abmelden…" : "Abmelden"}
                </button>
            </div>
        </div>
    );
}
