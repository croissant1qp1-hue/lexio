-- =============================================================================
-- 009 – Leech-Karten ausschließen und die letzte Antwort zurücknehmen
--
-- Erst NACH 008 ausführen.
--
-- Worum es hier geht
-- ------------------
-- Plan 1.7 entschärft zweierlei:
--
--   1. Leech-Karten. Eine Karte wird mit der Bewertung "nochmal" als Fehler
--      gezählt (sein 007). Ab einer Schwelle von 8 Fehlern ist sie eine
--      "Problemskarte". Sie taucht künftig nicht mehr von selbst in der
--      Runde auf – wer sie trotzdem üben will, holt sie sich über den
--      Knopf "Trotzdem üben" (?modus=leech). Damit die Kacheln oben
--      ("Lerne heute N Wörter") ehrlich bleiben, zählt die View diese
--      Karten auch nicht mehr als fällig.
--
--   2. Rückgängig. Die letzte Antwort soll zurücknehmbar sein. Dafür wird
--      bei jeder Antwort ein Snapshot des VORHER-Zustands der Zeile in
--      karten_fortschritt gelegt. Die Funktion antwort_rueckgaengig
--      stellt die Zeile aus dem Snapshot wieder her, nimmt die XP des
--      Tages zurück und gibt den neuen Gesamtstand zurück.
--
-- Was hier bewusst NICHT passiert
-- -------------------------------
--   - Die Leech-Schwelle steht an zwei Stellen: in lib/lernlogik.ts
--     (Konstante LEECH_FEHLER = 8, im Code) und hier in der View (fehler < 8).
--     Das ist Absicht und im Projekt schon einmal so dokumentiert (007):
--     die Regeln für die Runde gehören in den Code, die Zähler für die
--     Übersicht gehören in die Datenbank.
--   - Nur die letzte Antwort ist rückgängig machbar. Der Snapshot wird mit
--     jeder neuen Antwort überschrieben – es gibt keinen Verlauf über
--     mehrere Antworten auf dieselbe Karte.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Spalte für den Snapshot
-- -----------------------------------------------------------------------------

alter table public.karten_fortschritt
  add column if not exists letzte_antwort jsonb;

-- -----------------------------------------------------------------------------
-- 2. Funktion antwort_verbuchen erweitern (gleiche Signatur)
-- -----------------------------------------------------------------------------
-- Signatur bleibt identisch zu 007, deshalb reicht create or replace. Die
-- Funktion schreibt den Snapshot so, wie er bei der Antwort war: aus der
-- Konflikt-Zeile (public.karten_fortschritt.*) – nicht aus einem Wert, der
-- vorher im App-Code gelesen wurde. Ein App-Wert könnte zwischen Lesen und
-- Schreiben veralten; der Wert der Konflikt-Zeile ist atomar.

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

  /*
   * Fortschritt. Neue Zeile (noch nie beantwortet) vs. bestehende Zeile
   * (on conflict). Im UPDATE wird der Snapshot aus der Konflikt-Zeile
   * gebaut – das ist der Zustand VOR dieser Antwort, den
   * antwort_rueckgaengig später wiederherstellt.
   */
  insert into public.karten_fortschritt
    (karte_id, user_id, stufe, gelernt, gesehen, faellig_am,
     treffer, fehler, letzte_wiederholung, letzte_antwort)
  values
    (p_karte_id, v_user, p_neue_stufe, p_gelernt, p_gesehen, p_faellig_am,
     case when p_bewertung = 'nochmal' then 0 else 1 end,
     case when p_bewertung = 'nochmal' then 1 else 0 end,
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
        fehler              = public.karten_fortschritt.fehler
                               + case when p_bewertung = 'nochmal' then 1 else 0 end,
        letzte_antwort      = jsonb_build_object(
                               'vorhanden_vorher', true,
                               'stufe_vorher',            public.karten_fortschritt.stufe,
                               'gelernt_vorher',          public.karten_fortschritt.gelernt,
                               'gesehen_vorher',          public.karten_fortschritt.gesehen,
                               'faellig_am_vorher',       public.karten_fortschritt.faellig_am,
                               'treffer_vorher',          public.karten_fortschritt.treffer,
                               'fehler_vorher',           public.karten_fortschritt.fehler,
                               'letzte_wiederholung_vorher', public.karten_fortschritt.letzte_wiederholung,
                               'xp', greatest(p_xp, 0),
                               'tag', current_date
                             );

  /*
   * XP des Tages – unverändert zu 007: pro Tag genau eine Zeile.
   */
  insert into public.xp_events (user_id, set_id, datum, xp, ziel)
  values (v_user, p_set_id, current_date, greatest(p_xp, 0), 20)
  on conflict (user_id, datum) do update
    set xp    = public.xp_events.xp + greatest(p_xp, 0),
        set_id = coalesce(public.xp_events.set_id, excluded.set_id);

  select coalesce(sum(xp), 0) into v_ganz
  from public.xp_events
  where user_id = v_user;

  return jsonb_build_object(
    'xp',        p_xp,
    'neueStufe', p_neue_stufe,
    'xpGesamt',  v_ganz::int
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Funktion antwort_rueckgaengig
-- -----------------------------------------------------------------------------

create or replace function public.antwort_rueckgaengig (
  p_karte_id uuid
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_snap jsonb;
  v_ganz bigint;
begin
  if v_user is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  /* Besitzprüfung wie in antwort_verbuchen: die Karte muss zu einem Set
     gehören, das diese Person sehen darf. */
  if not exists (
    select 1
    from public.karten k
    join public.karteikarten_sets s on s.id = k.set_id
    where k.id = p_karte_id
      and (s.user_id is null or s.user_id = v_user)
  ) then
    raise exception 'Karte nicht gefunden.' using errcode = 'P0002';
  end if;

  select letzte_antwort into v_snap
  from public.karten_fortschritt
  where karte_id = p_karte_id and user_id = v_user;

  /* Kein Snapshot = es gibt nichts zurückzunehmen. Kein Fehler: für die
     Route ist das ein normaler Zustand (z. B. Seite neu geladen), und die
     Meldung `erledigt false` reicht dem Client. */
  if v_snap is null or v_snap = 'null'::jsonb then
    return jsonb_build_object('erledigt', false);
  end if;

  if (v_snap->>'vorhanden_vorher')::boolean then
    update public.karten_fortschritt
       set stufe               = (v_snap->>'stufe_vorher')::int,
           gelernt             = coalesce((v_snap->>'gelernt_vorher')::boolean, false),
           gesehen             = coalesce((v_snap->>'gesehen_vorher')::boolean, false),
           faellig_am          = (v_snap->>'faellig_am_vorher')::date,
           treffer             = coalesce((v_snap->>'treffer_vorher')::int, 0),
           fehler              = coalesce((v_snap->>'fehler_vorher')::int, 0),
           letzte_wiederholung = (v_snap->>'letzte_wiederholung_vorher')::timestamptz,
           letzte_antwort      = null
     where karte_id = p_karte_id and user_id = v_user;
  else
    /* Vor der Antwort gab es keine Zeile: die Antwort hat sie erzeugt.
       Zurücknehmen heißt: die Zeile entfernen. */
    delete from public.karten_fortschritt
     where karte_id = p_karte_id and user_id = v_user;
  end if;

  /* XP des Tages zurücknehmen, aber nie unter Null. */
  update public.xp_events
     set xp = greatest(0, xp - coalesce((v_snap->>'xp')::int, 0))
   where user_id = v_user
     and datum = (v_snap->>'tag')::date;

  select coalesce(sum(xp), 0) into v_ganz
  from public.xp_events
  where user_id = v_user;

  return jsonb_build_object('erledigt', true, 'xpGesamt', v_ganz::int);
end;
$$;

-- Rechte: wie in 007 – anonym nichts, angemeldete alles.
revoke execute on function public.antwort_verbuchen(
  uuid, uuid, text, integer, boolean, date, integer, boolean
) from public;
grant execute on function public.antwort_verbuchen(
  uuid, uuid, text, integer, boolean, date, integer, boolean
) to authenticated;

revoke execute on function public.antwort_rueckgaengig(uuid) from public;
grant execute on function public.antwort_rueckgaengig(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. View: fällig ohne Leech-Karten
-- -----------------------------------------------------------------------------
-- create or replace reicht: die Spaltenliste ändert sich nicht, nur der
-- Filter für karten_faellig. Leech = fehler >= 8 (Schwelle wie
-- lib/lernlogik.ts, LEECH_FEHLER). Eine nie beantwortete Karte hat fehler
-- null und zählt nicht dazu.

create or replace view public.karteikarten_sets_uebersicht
with (security_invoker = true) as
select
  s.id,
  s.slug,
  s.name,
  s.sprache_code,
  coalesce(sp.name, s.sprache)     as sprache,
  coalesce(sp.flaeche, '#17232B')  as sprache_flaeche,
  coalesce(sp.akzent,  '#E7B14A')  as sprache_akzent,
  s.anzahl_karten,
  s.user_id,
  s.eigenes_set,
  count(k.id)                                                          as karten_gesamt,
  count(k.id) filter (where f.gesehen)                                  as karten_gesehen,
  count(k.id) filter (where f.gelernt)                                  as karten_gelernt,
  count(k.id)
    filter (where coalesce(f.faellig_am, current_date) <= current_date
            and coalesce(f.fehler, 0) < 8)                              as karten_faellig,
  max(f.letzte_wiederholung)                                           as zuletzt_gelernt,
  case
    when count(k.id) = 0 then 0
    else round(count(k.id) filter (where f.gelernt) * 100.0 / count(k.id))::int
  end                                                                  as fortschritt_prozent
from public.karteikarten_sets s
left join public.sprachen sp
       on sp.code = s.sprache_code
left join public.karten k on k.set_id = s.id
left join public.karten_fortschritt f
       on f.karte_id = k.id
      and f.user_id = auth.uid()
group by
  s.id, s.slug, s.name, s.sprache_code, s.sprache, s.anzahl_karten, s.user_id, s.eigenes_set,
  sp.name, sp.flaeche, sp.akzent;

-- Rechte wiederherstellen (vom create or replace unverändert, aber
-- ausdrücklich wie in 007).
grant select on public.karteikarten_sets_uebersicht to anon, authenticated;