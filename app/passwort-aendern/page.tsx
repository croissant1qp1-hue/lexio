import type { Metadata } from "next";
import PasswortAendernSeite from "./passwort-aendern-seite";

export const metadata: Metadata = {
    title: "Neues Passwort setzen",
    robots: { index: false, follow: false },
};

export default function Seite() {
    return <PasswortAendernSeite />;
}
