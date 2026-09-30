import type { MetadataRoute } from "next";

/**
 * Web-App-Manifest (Phase 3.5 PWA).
 *
 * Macht aus Lexio eine installierbare App: Startbildschirm, Fenster ohne
 * Browserleisten, eigenes Icon. Das Design nutzt zwei Farbtöne – dunkles
 * #0D171D und helles #F7F1E4 (aus dem Theme-Skript) –, der Hintergrund
 * passt sich den bevorzugten Betriebssystem-Farben an.
 *
 * Die zwei hinterlegten Icons entstehen einmalig aus dem Logo (1254×1254);
 * die 512er-Variante ist zusätzlich maskable, damit das Icon auf runden
 * (iOS) beziehungsweise quadratisch-beschneidenden Launchern (Android) nicht
 * angeschnitten wird.
 */
export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "Lexio – Vokabeln lernen",
        short_name: "Lexio",
        description:
            "Lexio verteilt deine Vokabeln nach der Karteikarten-Methode über den Tag. " +
            "Eigene Wortlisten, verteiltes Lernen, Statistiken.",
        start_url: "/",
        display: "standalone",
        background_color: "#F7F1E4",
        theme_color: "#0D171D",
        categories: ["education", "productivity"],
        icons: [
            {
                src: "/images/icon-192.png",
                sizes: "192x192",
                type: "image/png",
            },
            {
                src: "/images/icon-512.png",
                sizes: "512x512",
                type: "image/png",
            },
            {
                src: "/images/icon-maskable-512.png",
                sizes: "512x512",
                type: "image/png",
                purpose: "maskable",
            },
        ],
    };
}