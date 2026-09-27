import type { Metadata } from "next";
import PasswortZuruecksetzenSeite from "./passwort-zuruecksetzen-seite";

export const metadata: Metadata = {
    title: "Neues Passwort anfordern",
    // Diese Seite steht nie in einem Suchindex: sie gehört zu
    // /anmelden, und beide sagen dasselbe.
    robots: { index: false, follow: false },
};

export default function Seite() {
    return <PasswortZuruecksetzenSeite />;
}
