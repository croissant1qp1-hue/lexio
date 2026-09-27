import { NextResponse } from "next/server";
import { mitUserOder401 } from "@/lib/supabase/user";
import { levelInfo } from "@/lib/profil";

/**
 * Alles, was die Seitenleiste ueber die angemeldete Person braucht.
 *
 * Eine Route statt drei. Navbar und Uebersicht zeigen Name, Bild, Level und
 * Streak an – vorher stand das als Text im JSX ("Mustermann", "Level 5 •
 * 6777 XP", "18 Tage Streak") und konnte nicht von der Datenbank abweichen,
 * weil es nicht aus ihr kam.
 *
 * XP und Streak kommen aus public.mein_fortschritt, das die RLS-Policies auf
 * xp_events greifen laesst: die View sieht nur eigene Zeilen.
 */
export async function GET() {
  const { supabase, user, antwort } = await mitUserOder401();
  if (antwort) return antwort;

  /*
   * Profil und Fortschritt parallel. Sie haengen nicht voneinander ab, und
   * zwei sequentielle Roundtrips waeren doppelt so lang.
   *
   * allSettled statt all: fehlt public.mein_fortschritt (Migration 003
   * nicht gelaufen), soll die App trotzdem starten – mit 0 XP, nicht mit
   * einem 500 und einer leeren Seite.
   */
  const [profil, fortschritt] = await Promise.allSettled([
    supabase
      .from("profil")
      .select("vorname, avatar_url")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("mein_fortschritt").select("xp_gesamt, streak, lerntage, sets_gelernt").maybeSingle(),
  ]);

  const profildaten =
    profil.status === "fulfilled" && profil.value.data ? profil.value.data : null;

  const stand =
    fortschritt.status === "fulfilled" && fortschritt.value.data
      ? fortschritt.value.data
      : { xp_gesamt: 0, streak: 0, lerntage: 0, sets_gelernt: 0 };

  const info = levelInfo(stand.xp_gesamt ?? 0);

  /*
   * Name in dieser Reihenfolge: das Profil aus 003, dann die Angaben aus
   * auth.users, dann die E-Mail vor dem @. Der letzte Fall kommt vor, wenn
   * jemand die Registrierung mit OAuth gemacht hat, aber die Datei 003
   * noch nicht gelaufen ist – der Trigger haette das Profil dann nie
   * angelegt.
   */
  const ausMeta = user.user_metadata?.full_name ?? user.user_metadata?.name;
  const emailname = (user.email ?? "").split("@")[0];
  const vorname =
    profildaten?.vorname?.trim() || ausMeta?.trim() || emailname || "Lexio";

  return NextResponse.json({
    // Die E-Mail wird mitgeschickt, aber nur fuer die eigene Anzeige in den
    // Einstellungen. Es gibt keine Route, die fremde Konten auslesen kann.
    email: user.email,
    vorname,
    avatarUrl:
      profildaten?.avatar_url ??
      user.user_metadata?.avatar_url ??
      user.user_metadata?.picture ??
      null,
    xp: info.xp,
    level: info.level,
    xpImLevel: info.xpImLevel,
    levelProzent: info.prozent,
    bisNaechstes: info.bisNaechstes,
    streak: stand.streak ?? 0,
    lerntage: stand.lerntage ?? 0,
    setsGelernt: stand.sets_gelernt ?? 0,
  });
}
