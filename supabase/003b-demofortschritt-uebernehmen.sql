-- =============================================================================
-- Lexio – 003b: Demofortschritt einer Person zuweisen (optional)
-- =============================================================================
-- Ausfuehren im Supabase Dashboard -> SQL Editor -> New query -> Run
--
-- WARUM
-- ----
-- Vor 003 lag der Lernstand auf der Karte selbst: public.karten.gelernt,
-- .stufe, .faellig_am, .treffer, .fehler. Diese Spalten beschreiben den
-- Fortschritt eines einzigen Nutzers, standen aber global in der Tabelle.
--
-- Nach 003 liegt der Stand in public.karten_fortschritt, je Nutzer eine
-- Zeile. Wer sich neu anmeldet, hat deshalb korrekt 0 gelernte Karten und
-- alle Demokarten sofort faellig. Das ist richtig – aber es sieht nach
-- kaputter App aus, obwohl nur nichts uebernommen wurde.
--
-- Diese Datei uebernimmt den alten Stand fuer genau eine Person, damit die
-- Demodaten so aussehen wie vorher. Ab dem Moment gehoert der Stand aber
-- auch nur noch dieser Person. Eine zweite Person startet bei null. Das ist
-- kein Fehler, sondern der Punkt: der Lernstand ist jetzt wirklich privat.
--
-- ANWENDUNG
-- ---------
-- Diese Datei enthaelt KEINE psql-Befehle. Ein Aufruf wie \set eigene_uuid
-- ist ein Meta-Befehl des psql-Kommandos, kein SQL. Im Supabase SQL Editor
-- – auch im "Run"-Modus – ergibt er einen Syntaxfehler und die Datei
-- laeuft gar nicht. Die UUID steht deshalb als Literal in der Datei, und
-- zwar an genau EINER Stelle: unten bei `eigene`.
--
-- Schritt 1: eigene UUID heraussuchen
--
--   select id, email from auth.users order by created_at;
--
-- Schritt 2: unten `eigene` ersetzen, einmal ausfuehren, Ergebnis im
-- Messages-Fenster ablesen.
-- =============================================================================


do $$
declare
  -- >>> HIER ERSETZEN <<<  (id aus auth.users, nicht die email)
  eigene constant uuid := '00000000-0000-0000-0000-000000000000'::uuid;
  gefunden boolean;
  gesamt bigint;
  uebernommen bigint;
  zeile record;
begin
  -- Verhindert, dass der Platzhalter still nichts tut. Ein Import, der 0
  -- Zeilen bewegt, ist kein Fehler: die naechsten 300 Karten bekommen
  -- trotzdem eine faellig_am und gelten als frisch. Genau das sieht dann
  -- aus, als waere die App kaputt.
  select exists (select 1 from auth.users where id = eigene) into gefunden;

  if not gefunden then
    raise exception
      'Kein Konto mit dieser UUID gefunden. Bitte oben bei `eigene` die echte '
      'ID aus auth.users eintragen. 00000000-... ist nur ein Platzhalter.';
  end if;

  select count(*) into gesamt
  from public.karten k
  join public.karteikarten_sets s on s.id = k.set_id
  where s.user_id is null;

  raise notice 'Demokarten gefunden: %', gesamt;

  /*
   * Idempotent: wer die Datei zweimal laeuft, bekommt keine doppelten
   * Zeilen, weil der Primaerschluessel (karte_id, user_id) den zweiten
   * Versuch abweist.
   */
  insert into public.karten_fortschritt
    (karte_id, user_id, stufe, gelernt, gesehen, faellig_am, treffer, fehler, letzte_wiederholung)
  select
    k.id,
    eigene,
    k.stufe,
    -- gelernt ist seit 007 ehrlich: erst ab Stufe 2 zaehlt eine Karte.
    k.stufe >= 2,
    -- Eine uebernommene Zeile existiert, weil die Karte beantwortet wurde.
    true,
    k.faellig_am,
    k.treffer,
    k.fehler,
    /*
     * Nur Karten, die wirklich gelernt wurden, bekommen einen Zeitstempel.
     * Sonst stuende in der Wortschatz-Tabelle "heute" fuer jede Karte, die
     * jemand einmal angesehen und dann falsch beantwortet hat.
     */
    case when k.stufe >= 2 then now() - interval '21 days' else null end
  from public.karten k
  join public.karteikarten_sets s on s.id = k.set_id
  where s.user_id is null
  on conflict (karte_id, user_id) do nothing;

  get diagnostics uebernommen = row_count;
  raise notice 'Fortschrittszeilen geschrieben: %', uebernommen;

  /*
   * Kontrolle. Seit 007 zaehlt gelernt erst ab Stufe 2, die Werte liegen
   * damit unter den alten 65 % / 32 % / 48 %. Steht hier ueberall 0, ist beim
   * Einsetzen etwas schiefgegangen.
   */
  for zeile in
    select
      s.name,
      count(k.id)                                                     as gesamt,
      count(k.id) filter (where f.gelernt)                            as gelernt,
      round(
        count(k.id) filter (where f.gelernt) * 100.0
        / nullif(count(k.id), 0)
      )::int                                                          as prozent
    from public.karteikarten_sets s
    left join public.karten k on k.set_id = s.id
    left join public.karten_fortschritt f
           on f.karte_id = k.id and f.user_id = eigene
    where s.user_id is null
    group by s.id, s.name
    order by s.name
  loop
    raise notice '%: % von % Karten gelernt (%)', zeile.name, zeile.gelernt, zeile.gesamt, zeile.prozent;
  end loop;
end;
$$;
