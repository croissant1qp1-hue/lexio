import "@/components/navbar/side-bar.css";
import "@/app/styles/main-body.css";
import Navbar from "@/components/navbar/navbar";
import { SetupHinweis } from "@/components/gesundheit/setup-hinweis";

/**
 * Rahmen aller Seiten, die zur App gehoeren.
 *
 * (app) ist eine Route Group: der Klammern-Ordner erscheint nicht in der
 * URL, fasst aber die Seiten zusammen, die die Seitenleiste bekommen. /anmelden
 * liegt bewusst ausserhalb – ein Anmeldeformular in einer 210px breiten
 * Spalte ist keine Anmeldung, sondern ein Streit mit dem Layout.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="container">
            <Navbar />
            <main className="main-body">
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
