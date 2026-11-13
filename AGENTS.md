# Arbeitsregeln für memoryaffe

## Einstieg und Stand

Lies zuerst [AGENT_HANDOFF.md](AGENT_HANDOFF.md). Es beschreibt den autonomen
Auftrag bis zum ersten guten Prototypen, die verbindlichen Verträge und die
Abnahmegrenzen. Produktdokumentation deutsch, Code-/API-Bezeichner englisch.
Der Repositorystand enthält inzwischen den ersten funktionsfähigen Prototypen.
Tatsächliche Nachweise und verbleibende Grenzen stehen in
docs/IMPLEMENTATION_STATUS.md. Nicht aus einer beschriebenen Funktion ihre
Umsetzung oder erfolgreiche Prüfung ableiten.

Die jüngste Nutzerentscheidung erlaubt Grundgerüst und Prototyp vor dem echten
ChatGPT-Test. Dieser Test bleibt offen, blockiert den Bau aber nicht. Bereits
entschiedene Fragen nicht erneut zur Freigabe stellen. Routinemäßige technische
Details innerhalb der Verträge autonom lösen; echte Produktänderungen klären.

## Lieferung

Der Nutzer hat routinegemäßes Committen, Pushen und Integrieren nach relevanten
Checks dauerhaft autorisiert. Repositorykonvention ist derzeit direkt main.
Bei künftigem PR-Workflow erforderliche CI/Reviews abwarten und erst zulässig
mergen. Schutzregeln nicht umgehen. Keine fremden Änderungen in eigene Commits
aufnehmen; finalen Remotezustand prüfen und Commit/PR sowie Prüfstatus berichten.
Nicht erfolgreich erledigte Arbeit grundlos nur lokal liegen lassen.

## Verträge und Prüfungen

Generierte Vertragsdateien über `node docs/contracts/build-all.mjs` aktualisieren.
Keine Handänderungen an erzeugtem JSON ohne Generatoränderung. Prüfung gemäß
docs/contracts/README.md. Registry-Snapshot separat und bewusst aktualisieren;
Routinechecks brauchen keinen Netzwerkrefresh.

Für Implementierung echte PostgreSQL-Integrationstests, passende UI-/CLI-/MCP-
Tests und Vertragsdrift ausführen. Dokumentationsprüfungen sind keine Belege für
Laufzeitverhalten. Keine Secrets/private Inhalte loggen oder committen. Keine
ungeprüften Aussagen zu ChatGPT, Plattformtests, Performance oder Produktionsreife.
