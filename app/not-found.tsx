import type { Metadata } from "next";
import Link from "next/link";

/*
 * Eigener Titel und noindex. Ohne dieses export stand hier der Grundtitel
 * "Lexio – Vokabeln lernen" – eine 404-Seite, die sich wie die Startseite
 * benennt, und die Suchmaschine indiziert sie obendrein, weil nirgends
 * etwas Gegenteiliges steht.
 */
export const metadata: Metadata = {
    title: "Seite nicht gefunden",
    robots: { index: false, follow: false },
};

export default function NotFound() {
    return (
        <div className="not-found-page">
            <div className="not-found-card">
                <span className="not-found-badge">404 Error</span>
                <h1>Seite nicht gefunden</h1>
                <p>
                    Die Seite, die du gesucht hast, existiert nicht oder wurde verschoben.
                </p>

                <div className="not-found-actions">
                    <Link href="/" className="not-found-button primary">
                        Zur Startseite
                    </Link>
                </div>
            </div>
        </div>
    );
}