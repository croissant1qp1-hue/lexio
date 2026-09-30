-- =============================================================================
-- 010 – Antworten je Bewertung zaehlen
--
-- Erst NACH 009 ausfuehren.
--
-- Worum es hier geht
-- ------------------
-- Plan 1.8 soll die Runde nicht mehr stur nach `stufe` ordnen, sondern nach
-- den Antworten des Accounts zwischen „schwer" und „einfach". Dafuer braucht
-- die Datenbank, was sie bisher nicht weiss: wie haeufig eine Karte mit
-- WELCHER Bewertung beantwortet wurde.
--
-- Bisher kennt karten_fortschritt nur `treffer` (schwer+gut+einfach
-- zusammengezaehlt) und `fehler` (nur nochmal). Aus diesen zwei Zahlen ist
-- die Mischung zwischen „schwer" und „einfach" nicht rekonstruierbar – genau
-- diese Mischung ist aber das Lernmaterial des Modells aus 1.8.
--
-- Diese Migration ergaenzt vier Zaehler: z_nochmal, z_schwer, z_gut,
-- z_einfach. `antwort_verbuchen` erhoeht den passenden Zaehler, und der
-- Rueckgaengig-Schnappschuss sichert sie, damit `antwort_rueckgaengig` eine
-- Antwort vollstaendig zuruecknehmen kann.
--
-- Was hier bewusst NICHT passiert
-- -------------------------------
--   - Keine Historien-Rekonstruktion: alte `treffer`/`fehler` lassen sich
--     nicht in die vier Bewertungen aufspalten (treffer vermischt schwer mit
--     gut und einfach). Die neuen F,aehler starten bei 0 und zaehlen ab jetzt.
--     Die alten Spalten bleiben unveraendert bestehen – die Leech-Ansicht
--     (1.7) und fremder Code stuetzen sich auf `fehler`.
--   - `treffer`/`fehler` werden NICHT aus den Zaehlern nachgezogen. Zwei
--     Quellen fuer dieselbe Wahrheit sind eine Fehlerquelle; die alten
--     Spalten sind fuer die View und bleiben, was sie sind.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Zaehler-Spalten
-- -----------------------------------------------------------------------------

alter table public.karten_fortschritt
  add column if not exists z_nochmal integer not null default 0,
  add column if not exists z_schwer  integer not null default 0,
  add column if not exists z_gut     integer not null default 0,
  add column if not exists z_einfach integer not null default 0;

-- -----------------------------------------------------------------------------
-- 2. antwort_verbuchen erweitern (gleiche Signatur wie in 007/009)
-- -----------------------------------------------------------------------------

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
   * Fortschritt. Neu vs. bestehende Zeile wie in 009, jetzt mit den
   * Bewertungs-Zaehlern. Der Zaehler zur Bewertung wird genau um eins
   * erhoeht, und der Schnappschuss sichert alle vier Zaehler in den
   * VORHER-Zustand.
   */
  insert into public.karten_fortschritt
    (karte_id, user_id, stufe, gelernt, gesehen, faellig_am,
     treffer, fehler, z_nochmal, z_schwer, z_gut, z_einfach,
     letzte_wiederholung, letzte_antwort)
  values
    (p_karte_id, v_user, p_neue_stufe, p_gelernt, p_gesehen, p_faellig_am,
     case when p_bewertung = 'nochmal' then 0 else 1 end,
     case when p_bewertung = 'nochmal' then 1 else 0 end,
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
        fehler              = public.karten_fortschritt.fehler
                               + case when p_bewertung = 'nochmal' then 1 else 0 end,
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
                               'fehler_vorher',           public.karten_fortschritt.fehler,
                               'z_nochmal_vorher',        public.karten_fortschritt.z_nochmal,
                               'z_schwer_vorher',         public.karten_fortschritt.z_schwer,
                               'z_gut_vorher',            public.karten_fortschritt.z_gut,
                               'z_einfach_vorher',        public.karten_fortschritt.z_einfach,
                               'letzte_wiederholung_vorher', public.karten_fortschritt.letzte_wiederholung,
                               'xp', greatest(p_xp, 0),
                               'tag', current_date
                             );

  /*
   * XP des Tages – unveraendert zu 007/009: pro Tag genau eine Zeile.
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
-- 3. antwort_rueckgaengig erweitern (gleiche Signatur wie in 009)
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
           z_nochmal           = coalesce((v_snap->>'z_nochmal_vorher')::int, 0),
           z_schwer            = coalesce((v_snap->>'z_schwer_vorher')::int, 0),
           z_gut               = coalesce((v_snap->>'z_gut_vorher')::int, 0),
           z_einfach           = coalesce((v_snap->>'z_einfach_vorher')::int, 0),
           letzte_wiederholung = (v_snap->>'letzte_wiederholung_vorher')::timestamptz,
           letzte_antwort      = null
     where karte_id = p_karte_id and user_id = v_user;
  else
    delete from public.karten_fortschritt
     where karte_id = p_karte_id and user_id = v_user;
  end if;

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

-- Rechte wie in 009: anonym nichts, angemeldete alles.
revoke execute on function public.antwort_verbuchen(
  uuid, uuid, text, integer, boolean, date, integer, boolean
) from public;
grant execute on function public.antwort_verbuchen(
  uuid, uuid, text, integer, boolean, date, integer, boolean
) to authenticated;

revoke execute on function public.antwort_rueckgaengig(uuid) from public;
grant execute on function public.antwort_rueckgaengig(uuid) to authenticated;