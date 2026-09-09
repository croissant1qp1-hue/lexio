import Link from "next/link";

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