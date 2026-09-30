import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Caveat, Fraunces, IBM_Plex_Mono, Inter } from "next/font/google";
import { DesignAnbieter } from "@/components/design/design-anbieter";
// DESIGN_SCRIPT kommt bewusst aus lib/design und nicht aus der
// Client-Komponente: aus einem "use client"-Modul darf der Server keinen
// String-Wert uebernehmen, er bekame eine Client-Referenz.
import { DESIGN_SCRIPT } from "@/lib/design";
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

export const metadata: Metadata = {
    title: {
        default: "Lexio – Vokabeln lernen",
        template: "%s · Lexio",
    },
    description:
        "Lexio verteilt deine Vokabeln nach der Karteikarten-Methode über den Tag. " +
        "Eigene Wortlisten, verteiltes Lernen, Statistiken.",
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
        icon: "/images/logo.png",
        apple: "/images/logo.png",
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
            </head>
            <body>
                <DesignAnbieter>{children}</DesignAnbieter>
            </body>
        </html>
    );
}
