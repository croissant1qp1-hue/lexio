import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normiereWeiterZiel } from "@/lib/weiter-ziel";

/**
 * Ziel des OAuth-Rundlaufs.
 *
 * Google und GitHub schicken den Browser hierher mit einem `code`. Der Code
 * wird gegen ein Cookie getauscht – erst danach hat man eine Session. Ohne
 * diesen Schritt waere der Nutzer angemeldet, aber ohne Cookie, und die App
 * wuerde ihn beim naechsten Request wieder als abgemeldet behandeln.
 *
 * Der Austausch passiert absichtlich im Server, nicht im Browser: der Code
 * ist kurzlebig und einzeigig, und ein Client, der ihn selbst tauscht,
 * wuerde die Session nur in JS verwalten statt in einem HttpOnly-Cookie.
 */
export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const rohZiel = url.searchParams.get("weiter");

    /*
     * Open Redirect. `weiter` kommt aus der Query, also aus dem Request
     * eines Besuchers. Ohne diese Pruefung koennte jemand
     * /api/auth/callback?weiter=https://fremde-seite.example schicken und
     * die frisch angemeldete Person samt Return-Token dorthin lotsen.
     *
     * Die eigentliche Regel steht in lib/weiter-ziel.ts und wird auch von
     * der Anmeldeseite und dem Proxy benutzt – eine Pruefung an drei Stellen
     * waare drei Chancen auf eine zu schwache Formulierung.
     */
    const ziel = normiereWeiterZiel(rohZiel);

    if (!code) {
        // Kein Code: der Besucher ist direkt hierher gekommen, etwa ueber
        // den Zurueck-Knopf. Kein Fehler, aber auch kein Grund fuer eine
        // Fehlermeldung.
        return NextResponse.redirect(new URL("/anmelden?fehler=kein-code", url.origin));
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
        // Der Grund landet im Log, nicht in der URL: die Adresse ist
        // Lesezeichen-faehig und wuerde das Detail an jeden weitergeben, der
        // sie sieht.
        console.error("[auth] Code konnte nicht getauscht werden:", error.message);

        const hinweis = new URL("/anmelden", url.origin);
        hinweis.searchParams.set(
            "fehler",
            "Die Anmeldung konnte nicht abgeschlossen werden. Bitte noch einmal versuchen.",
        );
        return NextResponse.redirect(hinweis);
    }

    return NextResponse.redirect(new URL(ziel, url.origin));
}
