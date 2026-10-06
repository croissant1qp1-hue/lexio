-- =============================================================================
-- 016: Ein Erfolg senkt die Fehlerzahl wieder
--
-- Ausgangspunkt ist eine Messung an einem Wegwerf-Konto mit 12 bewusst
-- erzeugten Problemskarten (fehler = 9). Vier Karten wurden in einer Runde
-- beantwortet, zwei davon mit "Einfach", zwei mit "Gut". Ergebnis in der
-- Datenbank:
--
--   z_gut = 2, z_einfach = 2   (die Bewertungszaehler steigen)
--   fehler = 9                  (die Fehlerzahl bleibt)
--   stufe  = 0 -> 2             (die Lernstufe steigt)
--
-- `leech` in app/api/lernen/route.ts ist `fehler >= LEECH_FEHLER` (8). Damit
-- bleibt eine Karte fuer immer leech, sobald sie die Schwelle einmal erreicht
-- hat – unabhaengig davon, wie oft sie danach richtig beantwortet wird. Sie
-- taucht nie wieder von selbst in der normalen Runde auf, nur ueber
-- "?modus=leech", und der Zaehler im Hinweis bleibt bei derselben Zahl
-- stehen. In einem Set mit 1582 Karten ist das keine Kleinigkeit: es ist die
-- Summe aller Karten, die man irgendwann einmal falsch hatte.
--
-- Die Ursache ist nicht in der Lernlogik, sondern in der Formel:
--
--   fehler = fehler + case when p_bewertung = 'nochmal' then 1 else 0 end
--
-- Ein Erfolg konnte den Fehlerstand nie senken. Die Bewertung "nochmal" ist
-- zugleich die *schwerste* der vier (stufeNachAntwort senkt die Stufe um 2,
-- BEWERTUNGEN vergibt 0 XP) – sie ist keine falsche Antwort, sondern die
-- richtige Antwort mit dem Hinweis "das war schwer". Die Spalte zaehlt damit
-- Fehlschlaege, verhaelt sich aber wie ein monotoner Zaehler.
--
-- Die Korrektur, in derselben Reihenfolge wie 010 es fuer die Zaehler macht:
--
--   nochmal -> +1   (die Karte hat nicht gesessen)
--   schwer  ->  0   (sitzen, aber schwer; ein Fehler waere doppelt gezaehlt)
--   gut     -> -1   (gesessen; mindestens 0)
--   einfach -> -1
--
-- Warum "schwer" 0 und nicht -1: "schwer" heisst in dieser App ausdruecklich
-- nicht "falsch". Es senkt die Stufe nur um 1 statt um 2 und kommt mit
-- 2 statt 0 XP. Wer es als Fehler zaehlte, wuerde eine Karte dafuer
-- bestrafen, dass sie ehrlich als schwer markiert wurde, und sie schneller
-- zur Problemskarte machen. Das waere die genaue Umkehrung von Plan 1.7.
--
-- VORLAGE: 014, nicht 010.
-- ----------------------
-- Das steht hier so ausdruecklich, weil der erste Entwurf dieser Datei auf 010
-- aufsetzte und damit zwei Aenderungen rueckgaengig machte, die inzwischen
-- gelten: 013 stellt das Tagesziel auf 100, 014 schreibt die Set-Zeile des
-- Tages in xp_tag_sets. Beides ist in der ersten Fassung verschwunden, und
-- der Fehler war am Code unsichtbar – er tauchte erst auf, als
-- `npm run db:pruefen` die Merkmale von 013 und 014 gegen die jetzt
-- angelegte Definition geprueft hat. Wer eine Funktion kopiert, muss die
-- LETZTE Fassung nehmen; `create or replace` ueberschreibt alles, was nicht
-- ausdruecklich mitgeschrieben wird. Darum steht unten kein Gerede, sondern
-- der komplette Rumpf aus 014 mit genau zwei Aenderungen: der Delta-Variable
-- im INSERT und der Delta-Variable im UPDATE. Alles andere, auch die
-- Rueckgabe, ist unveraendert aus 014.
--
-- Zwei Stellen muessen dieselbe Zahl anwenden, sonst passiert die Haelfte
-- davon: der Fortschrittszaehler im UPDATE und die Einfuegung einer neuen
-- Zeile. Darum steht die Aenderung einmal als Variable und nicht zweimal
-- als ausgeschriebener Case.
--
-- Der Rueckwaerts-Schnappschuss in `letzte_antwort` bleibt unveraendert: er
-- merkt sich den VORHER-Wert von `fehler`, und `antwort_rueckgaengig` spielt
-- genau ihn wieder zurueck. Damit bleibt auch das Rueckgaengig exakt – eine
-- rueckgaengig gemachte Senkung stellt einen Stand wieder her, den es wirklich
-- gab. Der Schnappschuss braucht die neue Formel also gerade nicht; er
-- speichert den Zustand, nicht die Rechnung.
--
-- Und die Rechte aus 015 bleiben Pflicht: eine create-or-replace-Funktion
-- erbt die Rechte nicht, sie muss sie neu bekommen.
-- =============================================================================

create or replace function public.antwort_verbuchen (
  p_karte_id    uuid,
  p_set_id      uuid,
  p_bewertung   text,
  p_neue_stufe  integer,
  p_gelernt     boolean,
  p_faellig_am  date,
  p_xp          integer,
  p_gesehen     boolean
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_ganz bigint;
  /*
   * Fehleraenderung je Bewertung. Steht als eigene Variable und nicht
   * dreimal im SQL, weil INSERT, UPDATE und die Rueckgabe dieselbe Zahl
   * brauchen – und weil sonst die drei Stellen auseinanderlaufen koennen,
   * ohne dass es jemand bemerkt.
   *
   * Das greatest(..., 0) unten halbiert die Variable: -1 bringt sie auf
   * nichts, eine saubere Karte faellt also nicht unter null, wo die
   * Schwelle 8 dann jede Bedeutung verloren haette.
   */
  v_fehler_delta integer := case p_bewertung
    when 'nochmal' then  1
    when 'schwer'  then  0
    when 'gut'     then -1
    when 'einfach' then -1
  end;
begin
  if v_user is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  if p_bewertung not in ('nochmal', 'schwer', 'gut', 'einfach') then
    raise exception 'Unbekannte Bewertung: %', p_bewertung using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.karten k
    join public.karteikarten_sets s on s.id = k.set_id
    where k.id = p_karte_id
      and k.set_id = p_set_id
      and (s.user_id is null or s.user_id = v_user)
  ) then
    raise exception 'Karte nicht gefunden.' using errcode = 'P0002';
  end if;

  insert into public.karten_fortschritt
    (karte_id, user_id, stufe, gelernt, gesehen, faellig_am,
     treffer, fehler, z_nochmal, z_schwer, z_gut, z_einfach,
     letzte_wiederholung, letzte_antwort)
  values
    (p_karte_id, v_user, p_neue_stufe, p_gelernt, p_gesehen, p_faellig_am,
     case when p_bewertung = 'nochmal' then 0 else 1 end,
     greatest(v_fehler_delta, 0),
     case when p_bewertung = 'nochmal' then 1 else 0 end,
     case when p_bewertung = 'schwer'  then 1 else 0 end,
     case when p_bewertung = 'gut'     then 1 else 0 end,
     case when p_bewertung = 'einfach' then 1 else 0 end,
     now(),
     jsonb_build_object(
       'vorhanden_vorher', false,
       'xp', greatest(p_xp, 0),
       'tag', current_date
     ))
  on conflict (karte_id, user_id) do update
    set stufe               = excluded.stufe,
        gelernt             = excluded.gelernt,
        gesehen             = public.karten_fortschritt.gesehen or excluded.gesehen,
        faellig_am          = excluded.faellig_am,
        letzte_wiederholung = now(),
        treffer             = public.karten_fortschritt.treffer
                               + case when p_bewertung = 'nochmal' then 0 else 1 end,
        /*
         * Der einzige Unterschied zu 014: `v_fehler_delta` statt
         * "case when p_bewertung = 'nochmal' then 1 else 0 end".
         */
        fehler              = greatest(public.karten_fortschritt.fehler
                               + v_fehler_delta, 0),
        z_nochmal           = public.karten_fortschritt.z_nochmal
                               + case when p_bewertung = 'nochmal' then 1 else 0 end,
        z_schwer            = public.karten_fortschritt.z_schwer
                               + case when p_bewertung = 'schwer'  then 1 else 0 end,
        z_gut               = public.karten_fortschritt.z_gut
                               + case when p_bewertung = 'gut'     then 1 else 0 end,
        z_einfach           = public.karten_fortschritt.z_einfach
                               + case when p_bewertung = 'einfach' then 1 else 0 end,
        letzte_antwort      = jsonb_build_object(
                               'vorhanden_vorher', true,
                               'stufe_vorher',            public.karten_fortschritt.stufe,
                               'gelernt_vorher',          public.karten_fortschritt.gelernt,
                               'gesehen_vorher',          public.karten_fortschritt.gesehen,
                               'faellig_am_vorher',       public.karten_fortschritt.faellig_am,
                               'treffer_vorher',          public.karten_fortschritt.treffer,
                               /*
                                * Unveraendert als VORHER gesichert – genau
                                * deshalb bleibt "Letzte Antwort
                                * zuruecknehmen" korrekt, auch wenn die
                                * Formel inzwischen senkt statt nur zaehlt.
                                */
                               'fehler_vorher',           public.karten_fortschritt.fehler,
                               'z_nochmal_vorher',        public.karten_fortschritt.z_nochmal,
                               'z_schwer_vorher',         public.karten_fortschritt.z_schwer,
                               'z_gut_vorher',            public.karten_fortschritt.z_gut,
                               'z_einfach_vorher',        public.karten_fortschritt.z_einfach,
                               'letzte_wiederholung_vorher', public.karten_fortschritt.letzte_wiederholung,
                               'xp', greatest(p_xp, 0),
                               'tag', current_date
                             );

  -- XP des Tages (Tagesziel, Streak) – unveraendert aus 013.
  insert into public.xp_events (user_id, set_id, datum, xp, ziel)
  values (v_user, p_set_id, current_date, greatest(p_xp, 0), 100)
  on conflict (user_id, datum) do update
    set xp    = public.xp_events.xp + greatest(p_xp, 0),
        set_id = coalesce(public.xp_events.set_id, excluded.set_id);

  -- Set des Tages (Phase 3.4): eine Zeile je (Tag, Set), damit mehrere Sets
  -- am selben Tag nicht mehr gegeneinander antreten.
  insert into public.xp_tag_sets (user_id, datum, set_id, xp_punktzahl)
  values (v_user, current_date, p_set_id, greatest(p_xp, 0))
  on conflict (user_id, datum, set_id) do update
    set xp_punktzahl = public.xp_tag_sets.xp_punktzahl + greatest(p_xp, 0);

  select coalesce(sum(xp), 0) into v_ganz
  from public.xp_events
  where user_id = v_user;

  /*
   * Rueckgabe wie in 014.
   *
   * Bewusst NICHT "fehler" oder "leech" mit dabei, obwohl das nett
   * waere. Der erste Entwurf hatte sie – und ist daran gescheitert: im
   * RETURN-Block steht der Namen der Tabelle, auf die sich die Spalte
   * bezieht, aber nach dem INSERT ist keine FROM-Klausel mehr offen. Das
   * ergibt "missing FROM-clause entry for table karten_fortschritt", und
   * die Meldung kommt als 42P01 zurueck – was die Lernseite als
   * "Migration 003 fehlt" anzeigt, also genau die falsche Richtung.
   *
   * Es wird auch nicht gebraucht: der naechste Rundenaufbau liest
   * leechAnzahl frisch aus der Tabelle, und der Hinweis "N Problemskarten
   * sind ausgeblendet" haengt daran. Zwei Wahrheiten fuer dieselbe Spalte
   * waeren hier der eigentliche Fehler.
   */
  return jsonb_build_object(
    'xp',        p_xp,
    'neueStufe', p_neue_stufe,
    'xpGesamt',  v_ganz::int
  );
end;
$$;

/*
 * Rechte aus 015 erneut setzen: eine create-or-replace-Funktion erbt die
 * Rechte nicht. Ohne diese Zeile darf wieder jeder mit anon antworten.
 */
revoke execute on function public.antwort_verbuchen(uuid, uuid, text, integer, boolean, date, integer, boolean) from public;
revoke execute on function public.antwort_verbuchen(uuid, uuid, text, integer, boolean, date, integer, boolean) from anon;
grant execute on function public.antwort_verbuchen(uuid, uuid, text, integer, boolean, date, integer, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- Gegenprobe, im Kommentar statt im Code, die vier Werte:
--
--   nochmal  9 -> 10   (schlimmer)
--   schwer   9 ->  9   (unveraendert: kein Fehler, aber auch keine Erloesung)
--   gut      9 ->  8   (die Schwelle: ab hier wieder normale Runde)
--   gut      8 ->  7
--   gut      0 ->  0   (greatest, kein negatives Ergebnis)
--
-- `schwer` bei 9 laesst die Karte leech – das ist beabsichtigt. Sie kommt
-- ohnehin in dieser Runde gerade durch, und wer sie einmal mehr mit "Schwer"
-- beantwortet, hat sie nicht behalten. Ein Erfolg ist "gut" oder "einfach".
--
-- Bewusst NICHT mit aufgenommen: eine Neuberechnung der Historie. Wer heute
-- 12 Fehler hat und die Karte danach nur "schwer" bewertet hat, wird nicht
-- rueckwirkend rehabilitiert – dafuer fehlt die Information, welche
-- Bewertung damals fiel, und `z_*` zaehlt sie ja gerade. Die Rueckwaerts-
-- rechnung waere eine Erfindung.
--
-- Ein zweiter Lauf der Datei ist unschaedlich: create or replace ist
-- idempotent, die Rechte werden gesetzt, und es wird keine Zeile geschrieben.
