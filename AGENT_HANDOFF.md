# Auftrag für den autonomen Umsetzungsagenten

Stand: 13. November 2026. **Ein erster funktionsfähiger Prototyp ist implementiert.**
Aktueller Umfang, tatsächlich ausgeführte Prüfungen und offene externe Abnahmen
stehen in [docs/IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md).
Die folgenden Pakete und Verträge bleiben die Arbeitsgrundlage; aus einer
beschriebenen Funktion allein niemals erfolgreiche Prüfung ableiten.

## Ziel und Freigabe

Baue memoryaffe als selbst hostbares Langzeitgedächtnis für KI-Agenten mit Webapp,
CLI und echtem HTTP-MCP. Grundlage sind VISION.md und die verlinkten Verträge.
Ziel ist ein durchgehend nutzbarer, gut getesteter erster Prototyp, anschließend
die restlichen MVP-Abnahmen. Keine erneute Bestätigung bereits entschiedener
Produktfragen. Routinemäßige Implementierungsdetails selbst entscheiden und
mit passenden Tests/kurzer Dokumentation liefern.

**Neueste Nutzerentscheidung:** Der reale ChatGPT-Verbindungstest wird auf später
verschoben. Grundgerüst und Prototyp dürfen vorher entstehen. Das ersetzt die
ältere Vorbedingung eines realen Tests vor dem Grundgerüst. Echte ChatGPT-
Kompatibilität darf erst nach diesem Test behauptet werden; kein Inspector-
oder Mocklauf ersetzt ihn. Keine Abschwächung von OAuth/CIMD zur Umgehung des Tests.

Der Nutzer wünscht möglichst autonome Umsetzung, später auch mit Subagenten.
Arbeitspakete dürfen entlang der unten definierten Grenzen delegiert werden.
Ein Integrationsverantwortlicher prüft Verträge/Tests und führt Änderungen
zusammen; parallel arbeitende Agenten bearbeiten keine gemeinsamen generierten
Dateien oder Migrationen ohne vorherige Zuweisung.

## Vor Start lesen

1. [VISION.md](VISION.md), [ARCHITECTURE.md](ARCHITECTURE.md).
2. [DATA_CONTRACT.md](DATA_CONTRACT.md), [API_CONTRACT.md](API_CONTRACT.md),
   [WEB_CONTRACT.md](WEB_CONTRACT.md), [OAUTH_CONTRACT.md](OAUTH_CONTRACT.md).
3. [Vertragsindex](docs/contracts/README.md), insbesondere Web-/OAuth-Protokoll,
   Persistenz, Unicode/Suche, Betriebslimits und Paket-Snapshot.
4. [IMPLEMENTATION.md](IMPLEMENTATION.md) für vollständige MVP-Abnahmekriterien.

Neuere ausdrückliche Nutzerentscheidungen haben Vorrang. Technische Ergänzungen
konkretisieren die Vision, führen keine Freigabe fremder Vaults ein. Bei echtem
Widerspruch zuerst gemeinsam erfüllbare Auslegung prüfen; nur eine notwendige
Produktänderung aktiv beim Nutzer klären. Implementierungshürden sind kein Grund,
bereits entschiedene Technikpräferenzen wieder aufzurollen.

## Feststehender Umfang

MIT, selbst hostbar, wenige bekannte Nutzer, ausschließlich eigene Vaults.
Admin verwaltet Konten, hat keinen UI-Inhaltszugriff anderer Nutzer; Infrastruktur
kann Daten lesen, Login weist darauf hin. .NET10/PG18/React/Go, modularer Monolith.
Keine Cloud-/KI-Abhängigkeit, keine eingebaute Textgenerierung, kein Sharing,
keine Anhänge, keine Dateisynchronisierung, kein OIDC-/DCR-Server, kein OpenIddict.

Markdown-CRUD mit Titel/optionaler Textsummary, Tags/Agenten-Tag-Regel,
Versionierung0..100 historischer Fassungen je Datensatz (Vaultsetting), Suche,
Vaultwechsel, Papierkorb, Export/Import. Einladung/Reset funktionieren ohne SMTP,
freiwillige2FA ausschließlich Profil. Darkmode/default, Light/System, de/en,
linke Nutzernavigation und separate Adminnavigation. Acht Agententools, Scopes
und drei Vault-Rechtestufen. Vollständige Regeln stehen in den Verträgen.

## Abhängige Arbeitspakete

| Paket | Voraussetzung | Lieferobjekt und Abschlussnachweis |
|---|---|---|
| P0 Bootstrap | Dokumente gelesen | Toolchains/Locks, vier .NET-Projekte, Vite/React, Go, ComposePG, CI; Restore/Build aller Teile, Basismigration, Health, Vertragsdrift |
| P1 Konto und Grenze | P0 | Identity, einmaliges Setup, Login/Cookie/CSRF, eigene Vaults, Einladung ohne SMTP, Adminrollen; zwei Konten/kein Fremdzugriff und letzter Admin getestet |
| P2 Memory-Kern | P1 | CRUD, Tags, Revisionen/Versionen, Papierkorb, Moves, Wiederholungsschlüssel; echte DB-Race-/Aufbewahrungstests |
| P3 Web-Kern | P1, stabile P2-Verträge | Suchorientierte Shell, Vaultwechsel, Listen/Lesen/Editor, Tags, Historie/Diff, Konflikterhalt, Dark/Light/DE/EN; Playwright-Kernabläufe |
| P4 Suche | P2 | PostgreSQL-Index, Querylogik, Cursor, Unicode17, Sprachwechsel; vollständiger Suchkorpus inkl. großer Dokumente und Rechtefilter |
| P5 Agenten | P2/P4 | Go-CLI, acht MCP-Tools, CIMD/OAuth inklusive Consent/Refresh/Widerruf; API-/SDK-/Negativtests, kein echter ChatGPT-Erfolg behauptet |
| P6 Kontosicherheit | P1/P3 | freiwilligesTOTP, Codes, Sitzungsverwaltung, Aktionsnachweis, Tokenrotation, Reset/Recovery, SMTPoptional; Zeit-/Replay-/Race-Tests |
| P7 Datenmitnahme | P2/P3 | ZIP-Export, Importvorschau/Übernahme/Bereinigung, vollständige Verwaltung; Roundtrip und bösartige ZIP-/Concurrent-Tests |
| P8 Zusammenführung | P0–P7 | dokumentierter Start von leerer Installation, integrierte E2E, lokale Demo-Testdaten, Backup/Restore, Screenshots, bekannte Grenzen |
| P9 Externe Abnahme/Release | Prototyp plus Nutzerzugang | realer ChatGPT-Test, Plattformmatrix, Releaseartefakte und vollständige MVP-Abnahme |

P3 kann gegen echte Verträge mit begrenzten Testfixtures parallel zu P2 laufen,
aber finale UI-Abnahme muss das echte Backend nutzen. P4/P5/P6/P7 können nach
gemeinsamer Basisschnittstelle getrennt bearbeitet werden. Integrationsagent
besitzt shared contracts, Authpolicy, Migrationen und Root-CI. Datenagent besitzt
Domain/Application/Infrastructure-Inhalte, UI-Agent Webapp, CLI-Agent Go.
Keine separate Berechtigungslogik im Frontend, CLI oder MCP erfinden.

## Prototyp-Abnahme: konkreter Nutzerdurchlauf

1. Compose auf leerem persistentem Volume starten; Admin mit Betreibersecret
   anlegen, Login-Vertrauenshinweis sehen, ohne2FA-Zwang zur Suche gelangen.
2. Zweiten Nutzer mit kopiertem Einladungslink ohne SMTP anlegen. Beide sehen
   ausschließlich eigene Vaults, auch über direkte API-IDs.
3. Zweiten Vault anlegen; Markdown mit Summary/Tags speichern, bearbeiten,
   suchen und zwischen Vaults wechseln. Historie vergleichen/wiederherstellen.
   Konflikt aus zweitem Tab erhalten statt überschreiben.
4. Lesenden und schreibenden CLI-Zugang anlegen; lesen/suchen/schreiben über
   Go-CLI, verbotene Aktionen sehen, Rechte reduzieren und sofortige Wirkung
   prüfen. Alle acht MCP-Tools mit SDK-Testclient durchlaufen.
5. OAuth-Testclient: Discovery, CIMD mit kontrollierten erlaubten Testmetadaten,
   S256, Anmeldung/Consent, Token/Refresh, Widerruf und negative Fälle.
   Test-Freigaben nur in Testkonfiguration; Produktionsschutz bleibt aktiv.
6. OptionalesTOTP im Profil aktivieren; Login mit Code/Recovery-Code, neue Codes,
   Lost-factor-Recovery und Sessionwiderruf testen. SMTP bleibt optional.
7. Löschen/Undo/Papierkorb, Vaultlöschung mit Grantentzug, Export/Import in neuen
   Vault, doppelte Importbestätigung ohne Duplikat. Backup auf frischer DB testen.
8. Browserprüfung Desktop/Mobil, Tastatur, Dark/Light, DE/EN. Sichtbare Lade-,
   Leer-, Fehler- und Konfliktzustände; keine toten Buttons oder Mock-Erfolgsmeldungen.

Dies ist die Zielabnahme P8. Zwischenstände dürfen als Teilprototyp geliefert
werden, müssen fehlende Punkte nennen. Eine Loginseite mit CRUD-Mock ist kein
fertiger Prototyp. Kein Produktionsreifeversprechen vor P9/MVP-Prüfungen.

## UI-Umsetzungsleitplanken

Routen: `/login`, `/setup`, `/invite`, `/reset-password`, `/recover-account`,
`/app/search`, `/app/memories/:id`, `/app/memories/:id/edit`, `/app/tags`,
`/app/trash`, `/app/vault-settings`, `/app/agents`, `/app/profile`,
`/admin/accounts`, `/admin/invitations`, `/admin/diagnostics`, `/oauth/consent/:id`.
Vaultscope ausdrücklich in Suchrequests, UI-Auswahl in Route/Query; keine
heimliche Übernahme von OAuth-/CLI-Kontext. Profilbutton oben rechts, Vaultwechsel
oben links, Suchfeld prominent. Adminlink führt in separate Shell mit Rückweg.

Zentrale Themevariablen, lokale Assets, Systemfont; keine Design-/Fontsuche nötig.
CodeMirror mit Vorschau, explizites Speichern, sichere Markdownlinks
(http/https/mailto; kein javascript/data), RawHTML aus. Fremde Bilder erst nach
bewusstem Laden. Escape schließt Dialog, Fokus kehrt zum Auslöser zurück.
Entwürfe nur Arbeitsspeicher; Navigation/Reload soweit Browser erlaubt warnen.
Keine privaten Suchtexte/Inhalte in Telemetrie, Logs oder Fehlerreports.

## Autonomie und Lieferung

Mit P0 beginnen, fortlaufend bis P8 integrieren. Kleine reversible technische
Entscheidungen selbst treffen; Sicherheits-/Vertragsabweichungen sichtbar
dokumentieren und nicht durch Stubs kaschieren. Nur fragen bei externem Zugang,
echtem Produktwiderspruch oder notwendiger destruktiver Änderung außerhalb des
Arbeitsbereichs. Fehlende Toolchain ist zunächst ein lösbares Bootstrap-Thema.

Repositorykonvention: main, relevante Checks, dann commit/push; Remotezustand
prüfen. Unabhängige Änderungen ausschließen, keine Schutzregeln umgehen.
Nicht bei einem grünen lokalen Build enden, wenn die Integration noch offen ist.
Jedes Paket aktualisiert seinen Status und Belege in `docs/IMPLEMENTATION_STATUS.md`
(beim Bootstrap anlegen). Tests als ausgeführt, fehlgeschlagen oder ausstehend
kennzeichnen. Finale Lieferung nennt Startbefehle, Commit/PR, Checks, Demoablauf
und konkrete Einschränkungen. Echte Zugangsdaten nicht in Demo oder Git ablegen.

## Noch externe bzw. ausführungsabhängige Punkte

- Reales ChatGPT-Konto/öffentliche HTTPS-Adresse: später mit Nutzer koordinieren,
  blockiert P0–P8 nicht mehr.
- Docker/Toolchains: lokaler Ausgangszustand und Pins in OPERATIONS.md. Restore,
  transitive Lizenzen und native Plattformausführung sind Bootstrap-/CI-Aufgaben,
  keine als erledigt behaupteten Planungsprüfungen.
- Suchkorpus/PKCE-/Race-/ZIP-Fälle sind ausführliche Testvorgaben; erst die
  implementierte Anwendung kann deren Bestehen nachweisen.

Es bestehen damit keine weiteren notwendigen Produktfragen vor P0. Wesentliche
Änderungen der bestätigten Regeln weiterhin mit dem Nutzer klären.
