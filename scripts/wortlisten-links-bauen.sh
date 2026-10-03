#!/bin/sh
# Aus den Tatoeba-Archiven die englisch-deutschen Satzpaare ziehen.
#
# Aufruf:
#   sh scripts/wortlisten-quellen-holen.sh scripts/quellen
#   sh scripts/wortlisten-links-bauen.sh scripts/quellen
#
# Der Generator braucht genau vier Datei-Namen: ngsl.json, kaikki.jsonl.gz,
# eng_sentences.tsv, deu_sentences.tsv und eng_deu_links.tsv. Die letzten drei
# entstehen hier aus den Archiven.
set -eu

Q="${1:-scripts/quellen}"

# Es gibt keine eng_deu-Datei im Tatoeba-Export, nur die eine 143-MB-Matrix
# aller Sprachpaare der Welt. Die gewollten Paare sind die Schnittmenge aus
# "linkt mit englischem Satz" und "linkt mit deutschem Satz" - beides steht in
# den beiden Sprachdateien, die ohnehin da sind. Also: die Paare streamen und
# wegwerfen, nicht die Matrix auf die Platte schreiben (die ist unkomprimiert
# rund 1,5 GB).
#
# Satzspiegel: eng -> deu, weil die App Englisch auf der Rueckseite traegt.
echo "Sprach-IDs sammeln ..."
bzcat "$Q/eng_sentences.tsv.bz2" | cut -f1 | sort -u > "$Q/eng.ids"
bzcat "$Q/deu_sentences.tsv.bz2" | cut -f1 | sort -u > "$Q/deu.ids"
echo "  eng $(wc -l < "$Q/eng.ids") | deu $(wc -l < "$Q/deu.ids")"

echo "Links filtern ..."
bzcat "$Q/links.tar.bz2" | awk -F'\t' -v eng="$Q/eng.ids" -v deu="$Q/deu.ids" '
BEGIN {
  while ((getline l < eng) > 0) e[l] = 1;
  while ((getline l < deu) > 0) d[l] = 1;
}
{
  a = $1; b = $2;
  if (a in e && b in d) print a "\t" b;
  else if (b in e && a in d) print b "\t" a;
}' | sort -u > "$Q/eng_deu_links.tsv"

echo "  $(wc -l < "$Q/eng_deu_links.tsv") eng->deu Verknuepfungen"

echo "Satzdateien entpacken ..."
bzcat "$Q/eng_sentences.tsv.bz2" > "$Q/eng_sentences.tsv"
bzcat "$Q/deu_sentences.tsv.bz2" > "$Q/deu_sentences.tsv"
echo "  eng $(wc -l < "$Q/eng_sentences.tsv") | deu $(wc -l < "$Q/deu_sentences.tsv") Zeilen"

# Die Hilfsdateien koennen weg. Die Archive bleiben liegen: wer die Wortliste
# neu erzeugt, braucht sie wieder, und ein zweiter Download von rund 840 MB
# ist der Grund, warum diese Dateien in /tmp nicht jedes Mal neu geholt
# werden sollten.
rm -f "$Q/eng.ids" "$Q/deu.ids"
echo "FERTIG"