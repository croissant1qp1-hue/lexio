import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Caveat, Fraunces, IBM_Plex_Mono, Inter } from "next/font/google";
import { DesignAnbieter } from "@/components/design/design-anbieter";
// DESIGN_SCRIPT kommt bewusst aus lib/design und nicht aus der
// Client-Komponente: aus einem "use client"-Modul darf der Server keinen
// String-Wert uebernehmen, er bekame eine Client-Referenz.
import { DESIGN_SCRIPT } from "@/lib/design";
import { SITE_URL } from "@/lib/meta";
import "@/app/styles/global.css";

/*
 * FontAwesome, lokal aus node_modules statt ueber ein CDN.
 *
 * Vorher stand hier ein <link> auf cdnjs. Das ist beim Umbau verloren
 * gegangen, das <head> blieb leer stehen – und damit waren alle Icons der
 * App weg, nicht nur die der Seitenleiste: jede Stelle, die ein
 * `fa-solid fa-…` setzt, rendert seitdem ein leeres <i>. Die Icons sind nur
 * Klassenamen, es gab also keinen Fehler, nur unsichtbare Symbole.
 *
 * Bewusst als Paket und nicht wieder als CDN-Link: die Schriften kommen
 * weiterhin ueber next/font aus lokalen Dateien statt von Google (siehe
 * Kommentar unten), und fuer die Icons gilt derselbe Gedanke. Kein
 * externer Request beim Laden, kein Flackern, und die Seite haengt nicht
 * daran, dass cdnjs erreichbar ist.
 */
import "@fortawesome/fontawesome-free/css/all.min.css";

/*
 * Vier Schriften, die das Design benutzt.
 *
 * Vorher waren nur Caveat und Oswald ueber ein `@import` in main-body.css
 * geladen. Fraunces, Inter und IBM Plex Mono standen als --serif, --sans und
 * --mono in global.css, wurden aber nirgends geladen – Ueberschriften in
 * var(--serif) sahen deshalb in Times aus, waehrend andere in Caveat. Zwei
 * various Schriftarten fuer dieselbe Sache.
 *
 * next/font laedt sie selbst, liefert sie lokal aus (kein Request zu Google
 * zur Laufzeit, kein Datenschutzproblem, kein Flicker) und erzeugt die
 * passenden @font-face-Regeln.
 *
 * Die Variablen heissen hier absichtlich --next-font-*: global.css setzt
 * --font-sans auf var(--next-font-sans) und haengt eine Fallback-Liste an.
 * Beide auf demselben Namen zu vergeben ergaebe einen Zirkelschluss, bei dem
 * der Wert davon abhaengt, wer ihn zuletzt definiert hat.
 */

const inter = Inter({
    subsets: ["latin"],
    display: "swap",
    variable: "--next-font-sans",
});

const fraunces = Fraunces({
    subsets: ["latin"],
    display: "swap",
    // Fraunces hat eine Optical-Size-Achse. Ohne diese Angabe greift die
    // Achse nicht, und die Ueberschriften sehen bei kleiner Schrift anders
    // aus als bei grosser – das war mit hoher Wahrscheinlichkeit der Grund,
    // warum zwei Ueberschriften auf derselben Seite unterschiedlich wirkten.
    axes: ["SOFT", "WONK", "opsz"],
    variable: "--next-font-serif",
});

const plexMono = IBM_Plex_Mono({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
    display: "swap",
    variable: "--next-font-mono",
});

const caveat = Caveat({
    subsets: ["latin"],
    display: "swap",
    variable: "--next-font-caveat",
});

/*
 * Ein Platz fuer den Text, der dreimal dasselbe sagt: Meta-Description,
 * Open Graph und die strukturierten Daten unten. Kopien davon laufen
 * auseinander, sobald sich der Satz aendert – und dann steht in einem
 * Suchergebnis etwas anderes als im geteilten Link.
 */
const BESCHREIBUNG =
    "Lexio verteilt deine Vokabeln nach der Karteikarten-Methode über den Tag. " +
    "Eigene Wortlisten, verteiltes Lernen, Statistiken.";

export const metadata: Metadata = {
    metadataBase: new URL(SITE_URL),
    title: {
        default: "Lexio – Vokabeln lernen",
        template: "%s · Lexio",
    },
    description: BESCHREIBUNG,
    openGraph: {
        title: "Lexio – Vokabeln lernen",
        description: BESCHREIBUNG,
        url: "/",
        siteName: "Lexio",
        locale: "de_DE",
        type: "website",
        /*
         * Ohne Bild zeigt jeder Link in WhatsApp, Slack oder Telegram nur
         * Text – und wirkt wie eine Weiterleitung, nicht wie eine Seite. Das
         * Bild ist 1200x630, das Format, das die meisten Netzwerke als
         * Vorschaubild akzeptieren. Der Pfad ist relativ; metadataBase oben
         * macht daraus die absolute URL, ohne die das Meta-Tag fuer
         * ausserhalb der eigenen Domain wertlos waere.
         */
        images: [
            {
                url: "/images/og-1200x630.png",
                width: 1200,
                height: 630,
                alt: "Lexio – Vokabeln lernen mit Beispielsätzen",
            },
        ],
    },
    twitter: {
        // summary_large_image, nicht summary: eine Karte ohne Bild ist
        // unsichtbar, und mit Bild will Twitter das grosse Format.
        card: "summary_large_image",
        title: "Lexio – Vokabeln lernen",
        description:
            "Lexio verteilt deine Vokabeln nach der Karteikarten-Methode über den Tag.",
        images: ["/images/og-1200x630.png"],
    },
    applicationName: "Lexio",
    appleWebApp: {
        capable: true,
        title: "Lexio",
        statusBarStyle: "black-translucent",
    },
    formatDetection: {
        telephone: false,
    },
    icons: {
        /*
         * Bewusst icon-192 und nicht logo.png: das Logo wiegt 1,9 MB, und
         * der Browser laedt den Favicon bei jedem Seitenaufruf neu – fuer
         * ein 32-Pixel-Bild. icon-192 ist dieselbe Marke, 31 KB, und wird
         * herunter skaliert. logo.png bleibt fuer die Navigationsleiste und
         * die Anmeldeseite, die es gross zeigen.
         */
        icon: "/images/icon-192.png",
        apple: "/images/icon-192.png",
    },
};

/*
 * Ohne das deklarierte viewport benutzt Next einen Standard, der auf
 * manchen Androids `user-scalable=no` setzt –zoomen ist dann nicht mehr
 * moeglich. `viewport-fit=cover` ist noetig, damit env(safe-area-inset-*)
 * auf dem iPhone ueberhaupt etwas liefert; die untere Tableiste haengt
 * sonst in der Home-Anzeige.
 */
export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    themeColor: [
        { media: "(prefers-color-scheme: dark)", color: "#0D171D" },
        { media: "(prefers-color-scheme: light)", color: "#F7F1E4" },
    ],
};

/*
 * Strukturierte Daten fuer Suchmaschinen, im Root-Layout damit sie auf
 * jeder Seite stehen – eine Seite, die das vergisst, waere die Regel und
 * nicht die Ausnahme.
 *
 * Bewusst ohne `offers`, `aggregateRating` oder `review`: die App hat kein
 * Preismodell und keine Bewertungen, und erfundene Werte sind nicht nur
 * unbrauchbar, sondern Grund fuer eine Abmahnung bei Google. `@graph`
 * haelt WebSite und SoftwareApplication zusammen, ohne sie zu verschmelzen.
 */
const SUCH_DATEN = {
    "@context": "https://schema.org",
    "@graph": [
        {
            "@type": "WebSite",
            name: "Lexio",
            url: SITE_URL,
            inLanguage: "de",
            description: BESCHREIBUNG,
        },
        {
            "@type": "SoftwareApplication",
            name: "Lexio",
            applicationCategory: "EducationalApplication",
            operatingSystem: "Web",
            inLanguage: "de",
            url: SITE_URL,
            description: BESCHREIBUNG,
        },
    ],
};

/*
 * Nur html und body. Seitenleiste und Inhaltsbereich stehen in
 * app/(app)/layout.tsx – so bekommt /anmelden keine Seitenleiste, was ein
 * Anmeldeformular auf 210px Breite absurd aussehen lassen wuerde.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
    // Der Nonce kommt aus dem Proxy (proxy.ts, Phase 3.7). Dort wird er pro
    // Anfrage frisch erzeugt und als `x-nonce`-Request-Header an Next
    // gereicht. Ohne ihn wuerde die Content-Security-Policy das
    // Inline-Skript unten blockieren – deshalb muss diese Stelle den Wert
    // kennen und ihn an das Script-Tag weiterreichen.
    const nonce = (await headers()).get("x-nonce") ?? undefined;

    return (
        <html
            lang="de"
            className={`${inter.variable} ${fraunces.variable} ${plexMono.variable} ${caveat.variable}`}
            // Ohne Attribut wuerde es bis zum ersten clientseitigen Effekt
            // gar keins geben und das helle Design einen schwarzen Blitz
            // zeigen. Der Wert wird so im Server-HTML gesetzt.
            data-design="dunkel"
            suppressHydrationWarning
        >
            <head>
                {/*
                  Muss synchron laufen, bevor der Browser malt. Deshalb ein
                  klassisches Script statt useEffect – ein Effekt waere erst
                  nach dem Paint fertig.
                */}
                <script nonce={nonce} dangerouslySetInnerHTML={{ __html: DESIGN_SCRIPT }} />
                {/*
                  Strukturierte Daten. Der Nonce steht drauf wie beim
                  Design-Skript: ohne ihn blockiert die CSP das Inline-Script,
                  und der Browser meldet den Fehler in der Konsole. Crawlieren
                  tut Google den Inhalt trotzdem, aber eine Konsolenwarnung
                  auf eigener Seite ist kein Zustand.
                */}
                <script
                    type="application/ld+json"
                    nonce={nonce}
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(SUCH_DATEN) }}
                />
            </head>
            <body>
                <DesignAnbieter>{children}</DesignAnbieter>
            </body>
        </html>
    );
}
