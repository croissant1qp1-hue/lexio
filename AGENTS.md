# Anweisung für Arbeiten in diesem Projekt

**Sagt der Nutzer „fixx lexio", „setze das jetzt alles um", „mach lexio
fertig" oder „arbeite die Phasen ab": lies zuerst `LEXIO-PLAN.md` vollständig
und arbeite die Phasen in der dort beschriebenen Reihenfolge ab.**

Drei Regeln gelten für jede Arbeit hier, sie stehen in `LEXIO-PLAN.md` unter
„Arbeitsregeln":

1. **Zeitnehmen.** Kein Punkt gilt als fertig, bevor er am laufenden System
   geprüft ist. `npm run build`, `npm run lint`, dann live testen.
2. **Responsiv von Anfang an.** Jede Komponente direkt für Handy und Desktop.
   Nicht am Ende nachziehen.
3. **Öffentlich denken.** Kein geteilter Zustand, keine Annahme über eine
   einzelne Sitzung, Besitzprüfung immer über die Datenbank (RLS).

## Nach jedem Schritt committen und pushen

Sagt der Nutzer **„setze das jetzt alles um"**, gilt zusätzlich:

**Nach jedem funktionierenden Schritt committen und auf `origin/main` pushen.**

Ein „funktionierender Schritt" ist einer, der im laufenden System geprüft ist
— also `npm run build` und `npm run lint` sauber und die Änderung tut, was sie
soll. Kein Zwischenschand, kein „mal eben zwischenspeichern". Halbe Sachen
gehören nicht auf `main`.

Beim Commit:

- **Nur die Dateien dieses Schritts vormerken.** Immer mit ausdrücklichen
  Pfaden (`git add app/... lib/...`), **nie** `git add -A` und **nie**
  `git add .`. Im Arbeitsbaum liegen erfahrungsgemäß fremde, noch nicht
  fertige Änderungen — die dürfen nicht mit rutschen.
- Ein Schritt, ein Commit. Der Betreff ist eine kurze deutsche Zeile, die
  sagt, was dieser Schritt getan hat. Im Stil kurz wie die bisherigen
  Einträge, aber ohne deren Tippfehler nachzumachen.
- Vor dem Commit `git status` und `git diff` ansehen, damit nichts
  Unerwartetes mitgeht.
- Nie force-pushen, kein `git add .`, keine Commits von Geheimnissen.
- `.env` und alles mit Schlüsseln bleiben draußen.

Der Plan wird mitcommitted, wenn er sich ändert — die Phasenmarkierung ist
der Fortschrittsnachweis.

Der Plan enthält die Produktentscheidungen des Nutzers, die verifizierte
Lage der Datenbank und die Phasen 0 bis 7 mit Abnahmekriterien. Er ist die
verbindliche Referenz.

Nicht verwechseln: `OFFENE-PUNKTE.md` beschreibt den **Zustand des Codes**,
`LEXIO-PLAN.md` beschreibt den **Umbauauftrag**.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
