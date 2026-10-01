import { redirect } from "next/navigation";
import VokabelnSeite from "./vokabeln-seite";

/**
 * Alle Vokabeln eines Sets.
 *
 * Warum eine eigene Seite und kein Aufklappbereich im Wortschatz: die
 * Wortliste dort ist ein flacher Durchlauf quer ueber alle Sets, sie hat
 * gar keine Zeile, in die ein Set gehoeren wuerde. Und die Lernansicht
 * zeigt nur den Stapel von heute – bei einem Set mit 100 Karten sieht man
 * so 20 davon und haelt das fuer den Bestand.
 *
 * Die Route ist `/wortschatz/[set]`, damit die Vokabeln eines Sets beim
 * Wortschatz liegen und nicht bei den Karten, wo man sie nicht suchen
 * wuerde.
 */
export default async function Seite({
  params,
}: {
  // Next 16 liefert params als Promise – siehe die anderen Routen dieses
  // Projekts, die denselben Zugriff benutzen.
  params: Promise<{ set: string }>;
}) {
  const { set } = await params;
  if (!set) redirect("/wortschatz");
  return <VokabelnSeite setSlug={set} />;
}