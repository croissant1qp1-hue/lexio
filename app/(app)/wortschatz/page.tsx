import { redirect } from "next/navigation";

/**
 * /wortschatz ist weg.
 *
 * Es gab zwei Seiten fuer denselben Inhalt: /wortschatz als Kachelraster
 * und /karteikarten als Tabelle mit Suche. Beide holten /api/karteikarten,
 * beide zeigten dieselben Zahlen in zwei Formaten, und beide waren in der
 * Navigation erreichbar. In der unteren Tableiste standen sie nebeneinander
 * und unterschieden sich in zwei Wörtern.
 *
 * /karteikarten gewinnt: die Tabelle hat Suche, XP und "zuletzt gelernt",
 * und sie verträgt viele Sets besser als ein Raster.
 *
 * Diese Datei ist ein 301-artiger Redirect, kein Redirect im Proxy. Eine
 * alte Lesezeichen-Adresse soll funktionieren – nicht als Fehlerseite, und
 * nicht als 404, aus der man nicht herausfindet, wohin es geht.
 */
export default function WortschatzWeiterleitung() {
    redirect("/karteikarten");
}
