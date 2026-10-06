-- =============================================================================
-- 017: Set-Level – dieselbe Leiter wie eine einzelne Karte
--
-- Aufgabe: die Übersicht zeigt pro Set "X von Y gelernt" und einen
-- Prozentbalken. Beides beantwortet "wie viel", nicht "wie weit". Ein Set,
-- in dem jede Karte drei Runden überstanden hat, und ein Set, in dem zwei
-- Karten sitzen und der Rest nie vorkam, können dasselbe Prozent haben.
--
-- Neu ist deshalb eine Stufe 1–7 je Set. Nicht erfunden, sondern
-- abgeleitet: `INTERVALLE` in lib/lernlogik.ts hat genau sieben Stufen
-- (0 bis 6, zuletzt 60 Tage Abstand), und eine einzelne Karte klettert
-- daran hoch. Das Set-Level ist die Stufe, auf der der DURCHSCHNITT seiner
-- Karten steht – dieselbe Skala, dieselbe Bedeutung:
--
--   stufe_durchschnitt = avg(coalesce(f.stufe, 0))   ueber alle Karten
--   set_level           = 1 + floor(durchschnitt)    auf 1–7 begrenzt
--   set_level_anteil    = der Rest bis zur naechsten Stufe (0–1)
--
-- Die Nullstellung ist Absicht: ein Set ohne eine einzige Antwort beginnt
-- bei Level 1, nicht bei 0 – Level 0 ist für Sets ohne Karten reserviert,
-- damit die Oberfläche "noch nichts angelegt" von "noch nichts gelernt"
-- unterscheiden kann.
--
-- WARUM DER DURCHSCHNITT UND NICHT DAS MAXIMUM:
-- `max(f.stufe)` würde ein Set mit einer einzigen fertigen Karte auf Level 7
-- setzen. Das wäre die eine Zahl, die am schnellsten falsch wird. Der
-- Durchschnitt über ALLE Karten (unbeantwortete zählen als 0) senkt sich
-- dagegen, sobald weitere Karten dazukommen – er ist die ehrliche Antwort
-- auf "wie weit ist dieses Set".
--
-- Was der Preis ist: in einem Set mit 1582 Wörtern bewegt sich der
-- Durchschnitt träge. Wer 100 Karten auf Stufe 4 hat, steht bei 0,25 und
-- damit weiter auf Level 1. Das ist kein Fehler, sondern dieselbe Wahrheit,
-- die der Prozentbalken heute zeigt (100 von 1582 ≈ 6 %) – nur mit dem
-- Unterschied, dass der Durchschnitt auch die TIEFE zählt, während
-- `fortschritt_prozent` nur ab Stufe 2 überhaupt zählt. Wer also 1500
-- Karten einzeln einmal gesehen hat, gewinnt beim Prozent nichts und beim
-- Level etwas.
--
-- `fortschritt_prozent` bleibt unangetastet: die Wortschatz-Seite und die
-- Route /api/karteikarten lesen es weiter. Hier wird nichts ersetzt, es
-- kommt eine Sicht dazu.
--
-- Spalten ANHAENGEN, nicht einfügen: `create or replace view` verweigert
-- eine geänderte Reihenfolge bestehender Spalten. Die drei neuen stehen
-- deshalb hinter `fortschritt_prozent`.
--
-- Vorlage ist die letzte Fassung der View, die in 009 liegt (nicht 007 und
-- nicht 006). Wer hier eine ältere nimmt, verliert den Leech-Filter aus
-- `karten_faellig` – dieselbe Art von Fehler wie bei 016.
-- =============================================================================

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
  end                                                                  as fortschritt_prozent,

  -- ---------------------------------------------------------------------------
  -- Set-Level (Anhang zu 009). Dieselbe Rechnung dreimal, weil eine View keine
  -- Zwischenvariable hat: `avg()` steht hier als Ausdruck, nicht als Name.
  -- Postgres wertet den Aggregate einmal aus, es wird nicht dreimal gezählt.
  -- ---------------------------------------------------------------------------

  -- Zwei Nachkommastellen reichen – die Zahl dient dem Menschen, nicht einer
  -- weiteren Rechnung. Ohne Rundung wäre es eine endlose Nachkommazahl in
  -- jeder API-Antwort.
  round(avg(coalesce(f.stufe, 0)), 2)                                   as stufe_durchschnitt,

  case
    when count(k.id) = 0 then 0
    -- floor statt round: die Stufe springt erst, wenn der Schnitt WIRKLICH
    -- über der Grenze liegt. Mit round waere ein Schnitt von 0,6 schon Level 2,
    -- obwohl keine einzige Karte ueber Stufe 0 waere.
    else least(7, (1 + floor(avg(coalesce(f.stufe, 0))))::int)
  end                                                                  as set_level,

  case
    when count(k.id) = 0 then 0
    -- Auf Level 7 gibt es nichts mehr zu fuellen – ein Restwert von 0,4 dort
    -- wuerde den Eindruck erzeugen, es fehle noch etwas zu einer achten Stufe.
    when least(7, (1 + floor(avg(coalesce(f.stufe, 0))))::int) >= 7 then 0
    else round(avg(coalesce(f.stufe, 0)) - floor(avg(coalesce(f.stufe, 0))), 3)
  end                                                                  as set_level_anteil
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

-- Rechte wiederherstellen (vom create or replace unverändert, aber wie in 009
-- ausdrücklich gesetzt – dieselbe Gewohnheit, aus genau demselben Grund).
grant select on public.karteikarten_sets_uebersicht to anon, authenticated;
