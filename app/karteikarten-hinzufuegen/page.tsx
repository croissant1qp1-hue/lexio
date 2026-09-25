import { redirect } from "next/navigation";

// Die alte Auswahl-Seite (Sprache waehlen, dann Formular) ist durch einen
// einzigen Schritt ersetzt: Sprache waehlen und Wort eingeben auf einer Seite.
export default function Seite() {
    redirect("/karteikarten-hinzufuegen/vokabeln-hinzufuegen");
}
