import type { NextConfig } from "next";

import { ANBIETER } from "./lib/supabase/anbieter";

/**
 * Profilbilder kommen von den OAuth-Anbietern, nicht vom eigenen Server.
 * next/image laedt fremde URLs nur, wenn sie hier ausdruecklich erlaubt sind
 * – ohne das zeigte die Navbar nach der Anmeldung mit einem Anbieter kein
 * Bild, sondern einen kaputten Platzhalter.
 *
 * Die Liste kommt aus lib/supabase/anbieter.ts, damit sie nicht an zwei
 * Stellen gepflegt werden muss. Der Import ist relativ, weil next.config.ts
 * ausserhalb von Next laeuft und den @/Alias nicht kennt.
 *
 * NUR Hostnamen, ohne Schema und ohne Pfad. Next baut daraus selbst die
 * Vergleichsform. Ein Eintrag wie "https://avatars.githubusercontent.com"
 * wird nicht als Muster gelesen, sondern als Hostname, der nie matcht – und
 * Next verweigert den Start mit "hostname must not include protocol".
 *
 * Muster bewusst auf die konkreten Domains, nicht auf "alle": eine
 * frei schaltbare Bildquelle holt sonst beim Rendern beliebiges Material
 * von beliebigen Servern nach.
 */
const PROFILBILD_QUELLEN = ANBIETER.flatMap((anbieter) => anbieter.bildQuellen);

const nextConfig: NextConfig = {
    // Next haengt an jede Antwort standardmaessig "X-Powered-By: Next.js".
    // Die Zeile verraet Technik, die niemanden interessiert, ausser jemandem,
    // der nach Angriffsflaechen sucht. Die Angriffsflaeche ist gleich, aber
    // die Reklame ist weg.
    poweredByHeader: false,
    images: {
        // `pathname: "**"` ist der Default, steht hier aber ausdruecklich da,
        // weil die Muster ohne Pfadangabe sonst auf den Wurzelpfad
        // eingeschraenkt waeren.
        remotePatterns: PROFILBILD_QUELLEN.map((hostname) => ({
            protocol: "https" as const,
            hostname,
            pathname: "/**",
        })),
    },
    // Statische Sicherheits-Header (Phase 3.7).
    //
    // Was hier liegt, ist fuer jede Antwort gleich und braucht keinen Nonce:
    //   – X-Content-Type-Options: der Browser errät MIME-Typen nicht neu
    //     ("nosniff") – eine Datei, die der Server als text/html meint, wird
    //     nicht als HTML ausgefuehrt.
    //   – Referrer-Policy: beim Verlassen der Seite geht die volle Adresse
    //     nur an den eigenen Ursprung, nach aussen nur der Ursprung. Die
    //     Adresszeile von Lexio enthaelt nach der Anmeldung keine
    //     Geheimnisse, aber niemand muss sie an Google & Co. weiterreichen.
    //   – X-Frame-Options: die App laesst sich nicht in ein fremdes Fenster
    //     einbetten (Clickjacking-Schutz). Die CSP ergaenzt das mit
    //     frame-ancestors 'none' – beides ist bewusst da.
    //   – Permissions-Policy: nichts, was die Seiten nicht nutzen, wird dem
    //     Besucher angeboten: kein Geolocation, kein Mikro, keine Kamera.
    //   – HSTS: "nur noch HTTPS". Ueber http ignoriert der Browser den
    //     Header (solange die Seite nicht einmal ueber https da war), sobald
    //     Lexio ueber HTTPS ausgeliefert wird, merkt er ihn sich und heisst
    //     kuenftige http-Versuche ab. Kein preload: der Flags-Eintrag in der
    //     HSTS-Liste der Browser ist ein Versprechen auf Kosten des ganzen
    //     Hosts, das man nur mit Absicht abgibt.
    //
    // Die Content-Security-Policy steht NICHT hier: sie braucht einen Nonce
    // fuer das Theme-Skript in app/layout.tsx und wird deshalb pro Anfrage
    // im Proxy (proxy.ts) erzeugt.
    async headers() {
        return [
            {
                source: "/:path*",
                headers: [
                    { key: "X-Content-Type-Options", value: "nosniff" },
                    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                    { key: "X-Frame-Options", value: "DENY" },
                    {
                        key: "Permissions-Policy",
                        value: "camera=(), geolocation=(), microphone=(), payment=()",
                    },
                    {
                        key: "Strict-Transport-Security",
                        value: "max-age=15552000; includeSubDomains",
                    },
                ],
            },
        ];
    },
};

export default nextConfig;
