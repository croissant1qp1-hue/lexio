#!/bin/sh
# Rohdaten fuer den Wortlisten-Generator beschaffen.
#
# Aufruf:
#   sh scripts/wortlisten-quellen-holen.sh [zielordner]
#
# Voreinstellung ist scripts/quellen – der Ordner steht in .gitignore, weil
# Kaikki allein rund 500 MB und die Tatoeba-Archive rund 300 MB gross sind.
# Wer sie woanders ablegt (z. B. /tmp, wo mehr Platz ist), ruft das Skript mit
# dem Ordner und gibt ihn dann an den Generator weiter:
#
#   npm run wortlisten:erzeugen -- --quellen /tmp/lexio-quellen --top 0 \
#     --name ngsl-voll --mengen
#
# Die Satzdateien und die Links werden danach von
# wortlisten-links-bauen.sh entpackt und gefiltert; dieses Skript laedt nur.
set -eu

ZIEL="${1:-scripts/quellen}"
mkdir -p "$ZIEL"

# Jede Datei laedt erst nach "<name>.teil" und wird danach umbenannt. Ein
# halb geladener Kasten, der wie eine fertige Datei aussieht, ist der
# uebliche Weg, aus dem spaeter stille Datenfehler werden: der Generator
# liest eine halbe Kaikki-Datei und liefert zu wenig Karten, ohne zu meckern.
#
# --fail ist wichtig: ohne die Option legt curl bei HTTP 404 oder 500 eine
# Fehlerseite als Datei ab, die beim JSON-Parsen scheitert. Mit --fail ist ein
# falscher Pfad ein harter Fehler und nicht eine Liste mit drei Woertern.
hole() {
  url="$1"; ziel="$2"
  if [ -s "$ziel" ]; then echo "uebersprungen: $ziel"; return 0; fi
  echo "hole $(basename "$ziel") ..."
  if curl -sSLf --retry 3 --retry-delay 5 -o "$ziel.teil" "$url"; then
    mv "$ziel.teil" "$ziel"
  else
    rm -f "$ziel.teil"
    echo "FEHLER: $url" >&2
    return 1
  fi
}

# NGSL 1.2: die Wortliste, nach deren Frequenzrang die Sets geschnitten sind.
# Der Dateiname ist der des Generators (ngsl.json), nicht der der Quelle.
hole \
  "https://raw.githubusercontent.com/FabriceBoyer/word_lists/main/ngsl/1.2/json/NGSL_1.2_stats.json" \
  "$ZIEL/ngsl.json"

# Tatoeba: Saetze je Sprache und die Link-Matrix aller Sprachpaare.
# Die Links sind ein 143-MB-Archiv aller Paare der Welt - eng_deu gibt es
# dort nicht, das entsteht im naechsten Skript.
hole "https://downloads.tatoeba.org/exports/per_language/eng/eng_sentences.tsv.bz2" \
  "$ZIEL/eng_sentences.tsv.bz2" &
hole "https://downloads.tatoeba.org/exports/per_language/deu/deu_sentences.tsv.bz2" \
  "$ZIEL/deu_sentences.tsv.bz2" &
hole "https://downloads.tatoeba.org/exports/links.tar.bz2" \
  "$ZIEL/links.tar.bz2" &

# Kaikki: der englische Wiktionary-Dump mit den deutschen Uebersetzungen.
hole "https://kaikki.org/dictionary/English/kaikki.org-dictionary-English.jsonl.gz" \
  "$ZIEL/kaikki.jsonl.gz" &

wait
echo
echo "ALLE DOWNLOADS FERTIG. Jetzt: sh scripts/wortlisten-links-bauen.sh $ZIEL"