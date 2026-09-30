import { createClient } from "@/lib/supabase/server";
import { holeUser } from "@/lib/supabase/user";
import { levelInfo, xpFormatieren } from "@/lib/profil";
import { anbieter } from "@/lib/supabase/anbieter";
import Image from "next/image";
import Link from "next/link";
import styles from "./profil.module.css";

/**
 * Das eigene Profil.
 *
 * Ein Server Component, aus demselben Grund wie die Seitenleiste: sie liest
 * Session und Profil direkt. Ein Client-Fetch wuerde die Seite zuerst leer
 * zeigen und die Werte einen Moment spaeter einsetzen – bei einer Seite, die
 * nur aus Zahlen besteht, faellt das als Flackern auf.
 *
 * Dieselbe Reihenfolge fuer den Namen wie in app/api/profil: Profil aus 003,
 * dann die Angaben aus auth.users, dann die E-Mail vor dem @. Steht an
 * drei Stellen im Projekt und muss an allen gleich sein, sonst zeigt die
 * Seitenleiste "theo" und die Profilseite "Theo".
 */

/** Erster Buchstabe, wenn es kein Profilbild gibt. */
function initial(name: string): string {
    const zeichen = name.trim().charAt(0);
    return zeichen ? zeichen.toLocaleUpperCase("de-DE") : "?";
}

export default async function ProfilSeite() {
    const supabase = await createClient();
    const { user } = await holeUser(supabase);

    /*
     * `holeUser` unterscheidet drei Faelle. Ohne Session zeigt die Seite
     * einen Hinweis statt Zahlen zu erfinden – der Proxy leitet in diesem
     * Fall ohnehin um, diese Seite ist nur der Moment davor. Bei einer
     * Stoerung (503) darf man das nicht als Abmeldung lesen, siehe
     * lib/supabase/user.ts.
     */
    if (!user) {
        return (
            <div className={styles.seite}>
                <div className={styles.leerKarte}>
                    <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />
                    <p className={styles.leerText}>
                        Dein Profil konnte gerade nicht geladen werden. Lade die Seite neu.
                    </p>
                </div>
            </div>
        );
    }

    const [profil, fortschritt] = await Promise.all([
        supabase.from("profil").select("vorname, avatar_url").eq("id", user.id).maybeSingle(),
        supabase
            .from("mein_fortschritt")
            .select("xp_gesamt, streak, lerntage, sets_gelernt")
            .maybeSingle(),
    ]);

    const profildaten = profil.data;
    const stand = fortschritt.data;
    const info = levelInfo(stand?.xp_gesamt ?? 0);

    const ausMeta = user.user_metadata?.full_name ?? user.user_metadata?.name;
    const emailname = (user.email ?? "").split("@")[0];
    const vorname = profildaten?.vorname?.trim() || ausMeta?.trim() || emailname || "Lexio";
    const avatarUrl =
        profildaten?.avatar_url ?? user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null;

    /*
     * Womit man sich angemeldet hat. `provider` nennt den Weg, ueber den
     * das Konto entstanden ist – bei "email" hat die Person ein Passwort
     * gesetzt, sonst nicht. Nur darum geht es hier: ein OAuth-Konto hat
     * keins, und "Passwort aendern" waere dann ein Knopf ins Leere.
     */
    const rohAnbieter = String(user.app_metadata?.provider ?? "email");
    const gefundener = anbieter(rohAnbieter);
    const perAnbieter = Boolean(gefundener);
    const anbieterName = perAnbieter ? (gefundener?.name ?? rohAnbieter) : "E-Mail";

    /*
     * "Dabei seit" aus created_at.
     *
     * Kein `new Date()` ohne Argument als Rueckfall: das waere `Date.now()`,
     * und react-hooks/purity beanstandet den Aufruf in einem Server
     * Component zu Recht – der Wert waere nicht aus der Datenbank und
     * damit nicht nachvollziehbar. Fehlt created_at (kommt bei
     * OAuth-Registrierungen vor, wenn der Trigger aus 003 noch nicht
     * gelaufen ist), steht dort "unbekannt" statt eines geratenen
     * Datums. Ein erfundenes Datum waere hier besonders schlecht: es
     * stuende als Fakt neben Name und E-Mail.
     */
    const startDatum = user.created_at
        ? new Date(user.created_at).toLocaleDateString("de-DE", { month: "long", year: "numeric" })
        : null;

    return (
        <div className={styles.seite}>
            <header className={styles.kopf}>
                <h1 className={styles.titel}>Mein Profil</h1>
                <p className={styles.untertitel}>Dein Konto und dein Fortschritt.</p>
            </header>

            {/* Identitaet: gross, weil das der Grund fuer die Seite ist. */}
            <section className={styles.karte}>
                <div className={styles.kopfzeile}>
                    <div className={styles.bildRahmen}>
                        {avatarUrl ? (
                            <Image
                                src={avatarUrl}
                                alt=""
                                width={72}
                                height={72}
                                className={styles.bild}
                                unoptimized
                                referrerPolicy="no-referrer"
                                priority
                            />
                        ) : (
                            <span className={styles.initialen} aria-hidden="true">
                                {initial(vorname)}
                            </span>
                        )}
                    </div>

                    <div className={styles.identitaet}>
                        <span className={styles.name}>{vorname}</span>
                        {user.email && <span className={styles.email}>{user.email}</span>}
                        <span className={styles.mitgliedSeit}>
                            {startDatum ? `Dabei seit ${startDatum}` : "Dabei seit unbekannt"}
                        </span>
                    </div>
                </div>

                {/* Balken mit derselben Rechnung wie die Zahl daneben. Die Kerben bei
                    50 % und 80 % sind die Meilensteine aus Phase 3.2. */}
                <div
                    className={styles.balken}
                    role="progressbar"
                    aria-valuenow={info.prozent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Fortschritt zu Level ${info.level + 1}`}
                >
                    <div className={styles.fuellung} style={{ width: `${info.prozent}%` }} />
                    <span className={styles.kerbe} style={{ left: "50%" }} aria-hidden="true" />
                    <span className={styles.kerbe} style={{ left: "80%" }} aria-hidden="true" />
                </div>
                <div className={styles.fuss}>
                    <span className={styles.levelText}>
                        Level {info.level} · {xpFormatieren(info.xp)} XP
                    </span>
                    <span className={styles.rest}>
                        noch {xpFormatieren(info.bisNaechstes)} XP bis Level {info.level + 1}
                    </span>
                </div>
            </section>

            {/*
              * `auto-fit` statt fester Spaltenzahl: auf dem Telefon steht
              * eine Kennzahl je Zeile, ab Tablet zwei, auf dem Desktop vier.
              * Eine feste Zahl von vier Spalten wuerde auf 360px bedeuten,
              * dass jede Kachel 60px breit ist und die Zahl umbricht.
            */}
            <section className={styles.kacheln}>
                <div className={styles.kachel}>
                    <span className={styles.kachelZahl}>{info.level}</span>
                    <span className={styles.kachelLabel}>Level</span>
                </div>
                <div className={styles.kachel}>
                    <i className={`${styles.kachelIcon} fa-solid fa-fire`} aria-hidden="true" />
                    <span className={styles.kachelZahl}>{stand?.streak ?? 0}</span>
                    <span className={styles.kachelLabel}>
                        {stand?.streak === 1 ? "Tag Serie" : "Tage Serie"}
                    </span>
                </div>
                <div className={styles.kachel}>
                    <i className={`${styles.kachelIcon} fa-solid fa-bolt`} aria-hidden="true" />
                    <span className={styles.kachelZahl}>{stand?.lerntage ?? 0}</span>
                    <span className={styles.kachelLabel}>
                        {stand?.lerntage === 1 ? "Lerntag" : "Lerntage"}
                    </span>
                </div>
                <div className={styles.kachel}>
                    <i
                        className={`${styles.kachelIcon} fa-solid fa-layer-group`}
                        aria-hidden="true"
                    />
                    <span className={styles.kachelZahl}>{stand?.sets_gelernt ?? 0}</span>
                    <span className={styles.kachelLabel}>
                        {stand?.sets_gelernt === 1 ? "Set gelernt" : "Sets gelernt"}
                    </span>
                </div>
            </section>

            {/*
              * Konto. Der Knopf zum Passwort aendern ist nur da, wenn es
              * ueberhaupt ein Passwort gibt – ein OAuth-Konto hat keins, und
              * die Seite wuerde dann in einer Fehlermeldung enden.
            */}
            <section className={styles.karte}>
                <h2 className={styles.abschnittTitel}>Konto</h2>

                <dl className={styles.liste}>
                    <div className={styles.zeile}>
                        <dt className={styles.begriff}>Angemeldet über</dt>
                        <dd className={styles.wert}>{anbieterName}</dd>
                    </div>
                    {user.email && (
                        <div className={styles.zeile}>
                            <dt className={styles.begriff}>E-Mail</dt>
                            <dd className={styles.wert}>{user.email}</dd>
                        </div>
                    )}
                    {startDatum && (
                        <div className={styles.zeile}>
                            <dt className={styles.begriff}>Beim</dt>
                            <dd className={styles.wert}>{startDatum}</dd>
                        </div>
                    )}
                </dl>

                <div className={styles.aktionen}>
                    <Link href="/einstellungen" className={styles.knopf}>
                        <i className="fa-solid fa-gear" aria-hidden="true" />
                        Einstellungen
                    </Link>
                    {!perAnbieter && (
                        <Link href="/passwort-aendern" className={styles.knopf}>
                            <i className="fa-solid fa-key" aria-hidden="true" />
                            Passwort ändern
                        </Link>
                    )}
                </div>
            </section>
        </div>
    );
}
