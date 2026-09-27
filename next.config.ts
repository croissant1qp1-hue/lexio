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
};

export default nextConfig;
