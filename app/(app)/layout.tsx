import "@/components/navbar/side-bar.css";
import "@/app/styles/main-body.css";
import type { Metadata } from "next";
import Navbar from "@/components/navbar/navbar";
import PwaRegistrierung from "@/components/pwa/pwa-registrierung";
import { SetupHinweis } from "@/components/gesundheit/setup-hinweis";

/**
 * Rahmen aller Seiten, die zur App gehoeren.
 *
 * (app) ist eine Route Group: der Klammern-Ordner erscheint nicht in der
 * URL, fasst aber die Seiten zusammen, die die Seitenleiste bekommen. /anmelden
 * liegt bewusst ausserhalb – ein Anmeldeformular in einer 210px breiten
 * Spalte ist keine Anmeldung, sondern ein Streit mit dem Layout.
 */

/*
 * Der gesamte (app)-Bereich liegt hinter einer Anmeldung, Google kann hier
 * nie etwas finden oder sinnvoll indexieren. noindex wird zentral hier
 * gesetzt statt auf jeder einzelnen Seite – dann kann eine neue Seite auch
 * nicht vergessen werden, sich selbst auszuschliessen. Sobald eine
 * oeffentliche Landing-Page existiert, lebt die ausserhalb dieser Gruppe.
 */
export const metadata: Metadata = {
    robots: { index: false, follow: false },
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="container">
            <Navbar />
            <main className="main-body">
                <PwaRegistrierung />
                {/*
                 * Nur sichtbar, wenn die Datenbank fehlt. Dann ist die App
                 * nicht benutzbar, und eine leere Liste oder ein 503toast
                 * sagt nicht, warum. Sobald 003 gelaufen ist, verschwindet
                 * die Leiste, ohne dass jemand Code anfassen muss.
                 */}
                <SetupHinweis variante="leiste" />
                {children}
            </main>
        </div>
    );
}
