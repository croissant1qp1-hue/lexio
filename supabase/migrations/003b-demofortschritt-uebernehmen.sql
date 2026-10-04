-- =============================================================================
-- Lexio – 003b: Demofortschritt einer Person zuweisen (VERALTET, tut nichts)
-- =============================================================================
-- Ausfuehren loescht sich nicht aus: Die Datei laesst sich weiterhin ohne
-- Fehler durchlaufen und schreibt nur `raise notice`-Meldungen. Sie bewegt
-- keine Zeile mehr. Warum, ist unten gemessen und nicht vermutet.
--
-- Geprueft am 2026-10-04: die Datei laeuft durch, und `karten_fortschritt`
-- bleibt bei 12 Zeilen (6 davon aus Wortlisten) vorher wie nachher. Die
-- Notices selbst sieht die Management-API nicht zurueck -- im SQL Editor
-- stehen sie im Messages-Fenster.
--
-- WAS SIE FRUEHER SOLLTE (Stand 2026-09-30)
-- ----------------------------------------
-- Vor 003 lag der Lernstand auf der Karte selbst: public.karten.gelernt,
-- .stufe, .faellig_am, .treffer, .fehler. Diese Spalten beschreiben den
-- Fortschritt eines *einzigen* Nutzers, standen aber global in der Tabelle.
--
-- Nach 003 liegt der Stand in public.karten_fortschritt, je Nutzer eine
-- Zeile. Wer sich neu anmeldet, hat deshalb korrekt 0 gelernte Karten und
-- alle Demokarten sofort faellig. Das ist richtig – aber es sieht nach
-- kaputter App aus, obwohl nur nichts uebernommen wurde.
--
-- Diese Datei sollte den alten Stand fuer genau eine Person uebernehmen, damit
-- die Demodaten aussehen wie vorher.
--
-- WAS SIE HEUTE TUT (gemessen am 2026-10-04)
-- ------------------------------------------
-- Gemessen, nicht geschaetzt:
--
--  Sets ohne user_id          5    (die fuenf kuratierten Wortlisten)
--   Karten darin          2.275    (nicht 65, nicht 100)
--   davon mit stufe > 0        0
--   davon mit stufe >= 2       0
--
-- Zwei Fehler der Datei, beide von damals:
--
--   1. Sie zaehlt an `user_id is null`, und das sind heute nicht mehr die
--      Demo-Sets, sondern die Wordlisten. Der alte Kopftext spricht von 100
--      Demokarten; es sind 2.275 echte Karten in fuenf Produktionslisten.
--   2. Sie setzt `gesehen = true` fuer jede uebernommene Karte, weil "eine
--      Zeile existiert, weil die Karte beantwortet wurde". Bei 0 Karten mit
--      Fortschritt heisst das: 2.275 Zeilen, davon 2.269 neue, alle mit
--      "gesehen", alle auf Stufe 0 — in einem echten Konto.
--
-- Warum das schlimmer ist als nichts zu tun: Der Import koennte nichts
-- wiederherstellen, weil es nichts zu holen gibt (0 Karten mit stufe > 0).
-- Er koennte aber sehr wohl 2.269 erfundene "gesehen"-Zeilen in ein Konto
-- schreiben, und damit Fortschrittsanzeige und Statistiken des echten
-- Nutzers beschreiben, den es nie gab.
--
-- Darum ist der Rumpf unten durch eine Meldung ersetzt. Sie sagt, was passiert
-- ist und dass hier bewusst nichts passiert. Das ist ehrlicher als eine Datei,
-- die auf eine alte Welt wartet.
--
-- DIE UUID VON DAMALS
-- -------------------
-- Der alte Rumpf hatte die echte Konto-ID eines echten Kontos fest im Text.
-- Sie steht hier nicht mehr, und zwar nicht aus Sparsamkeit: eine Datei, die
-- man versehentlich laufen laesst, soll nicht die richtige Person treffen
-- koennen. Sie ist in der Git-Historie dieses Repositories weiterhin
-- sichtbar; wer sie dort braucht, findet sie in der Version vor dieser
-- Aenderung. Eine Konto-ID ist kein Geheimnis, aber ein Grund, sie nicht
-- ungefragt in ein Skript zu schreiben, ist das trotzdem.
-- =============================================================================

do $$
begin
  raise notice
    '003b tut nichts mehr — richtig so.';
  raise notice
    'Die Datei sollte den alten globalen Demo-Fortschritt in karten_fortschritt '
    'uebernehmen. Diese Zeit ist vorbei: 003 hat den Stand je Nutzer gemacht.';
  raise notice
    'Heute wuerde sie 2.275 Karten aus fuenf Wortlisten treffen, davon 0 mit '
    'Fortschritt, und 2.269 neue Zeilen mit gesehen=true in ein echtes Konto '
    'schreiben. Sie koennte also nichts retten und nur etwas erfinden.';
  raise notice
    'Nach dem 2026-10-04 gibt es keinen alten Stand mehr zum Uebernehmen. Die '
    'Wordlisten sind importiert, der Lernstand gehoert je Person.';
end;
$$;
