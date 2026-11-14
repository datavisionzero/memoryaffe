# Implementierungs- und Prüfstand

Stand: 13. November 2026. Ein durchgehend nutzbarer erster Prototyp ist implementiert.
Diese Datei trennt beobachtete Anwendungsprüfungen vom weiterhin verbindlichen
Planungs-/Vertragswerk. Start, Konfiguration und Betreiberbefehle stehen in der
[README](../README.md). Der echte ChatGPT-Verbindungstest bleibt ausdrücklich offen.

## Gelieferter Umfang

| Paket | Implementierung | Tatsächlicher Nachweis |
|---|---|---|
| P0 | Vier .NET10-Schichten, React/TypeScript/Vite, Go-CLI, EF-Migrationen, PostgreSQL18, Container und CI | Locked Restore, Releasebuild ohne Warnungen, Linux/amd64-Imagebuild und Start mit leerem persistentem Volume |
| P1 | Betreibersecret/Einmalsetup, Identity-Passworthashing, widerrufbare Cookie-Sessions, ASP.NET-CSRF, Einladungslinks ohne SMTP, Konten/Adminrollen | Zwei Konten und direkte fremde IDs, Admin ohne fremde Inhalte, paralleler Schutz des letzten aktiven Admins in separater DB |
| P2 | Eigene Vaults, Markdown/Summary/Tags, Revisionen/Noop, Historie/Restore, Moves, Papierkorb, Wiederholungsschlüssel | Echte PostgreSQL-Schreibrennen, Retention0/2 und Limitsenkung im Papierkorb, historische Tag-Namen, Tagrename/merge/delete im Papierkorb, Move/Grant-/Vault-Lifecycle |
| P3 | Suchshell, CodeMirror/Vorschau, explizites Speichern, Konfliktentwurf, Historie, Adminbereich, Dark/Light/System, DE/EN | Sieben Playwright-Tests gemeinsam bestanden (18,9s) gegen echte API/PG: Desktop/Mobil390, zwei Browserkontexte, Konflikterhalt, sichere Links/RawHTML, Bildfreigabe, Dialogtastatur/Fokus, Sessionverlust und Wiederanmeldung |
| P4 | PostgreSQL-Wörterbücher, segmentierte Lexeme mit absoluten Feldpositionen, feldübergreifendes AND, feldbegrenzte Phrasen, signierte Keysetcursor, persistierter Hintergrund-Sprachwechsel mit Dualwrites | Vollständiger vertraglicher Suchkorpus einschließlich1MiB, Begriff nach20000Positionen, Phrase nach350Vorkommen, Segmentgrenze, Ranking, kontrollierter UUID-/Zeitgleichstand und paralleles Schreiben während Reindex |
| P5 | Acht gemeinsame HTTP-/MCP-Operationen, Go-CLI mit generierten DTOs/Routen, offizielles MCP2.4-SDK, OAuth/CIMD/S256/Consent/Rotation/Widerruf | Alle acht realen Go-CLI-Operationen und alle acht Tools mit offiziellem C#-SDK-Client; kontrollierte CIMD-/PKCE-/Code-/Refresh-/Widerrufsabläufe und negative Fälle |
| P6 | Freiwilliges TOTP im Profil, verschlüsselte Secrets, gehashte Recovery-Codes, zweistufige Anmeldung, konkrete einmalige Aktionsnachweise, Tokenrotation, Reset und Kontowiederherstellung | Replayschutz, paralleler Recovery-Codeverbrauch, Sessionwiderruf, Reset erhält2FA, umfassende Recovery setzt sie zurück; HTTPS-Restore entschlüsselt den gesicherten TOTP-Faktor erfolgreich |
| P7 | Streaming-ZIP-Export, vollständige Importprüfung, private Vorbereitung/Vorschau, neue IDs und atomarer einmaliger Import | Roundtrip mit Unicode/CRLF/leerem Markdown, Originalzeiten und Tagabbildung;20 bösartige ZIP-Fälle; parallele Übernahme mit verschiedenen Schlüsseln erzeugt denselben Vault |
| P8 | Integrierte Anwendung, dokumentierter Start, HTTPS-Proxybeispiel, Diagnose, Backup und Restore, Screenshots | Frischer Windows-Gesamtlauf14/14Prüfgruppen ohne Resume; echte HTTPS-Composeinstallation und Backup/Restore in neue DB-/Keyvolumes, danach Passwort+TOTP und exakter Markdown-/Vault-ID-Vergleich |
| P9 | Externe Client- und Releaseabnahme | Offen; keine bestätigte ChatGPT-Kompatibilität oder Produktionsreife |

## Reproduzierbare Prüfpunkte

### Kontoeinstellungen und Aktionsbestätigung am 14. November 2026

Nach Nutzerentscheidung verlangen angemeldete Sitzungen nur noch bei
Passwortänderung, eigener/administrativer Kontolöschung und vor dem TOTP-Setup
(einschließlich Ersetzung) ein erneutes Passwort. Ein vorhandener zweiter Faktor
bleibt bei Setup und Löschung erforderlich. CLI-Zugänge/Tokens, Rechte,
Agenten-Tag-Erlaubnis, Adminrollen/E-Mail/Recovery, neue Recovery-Codes und
2FA-Abschaltung verwenden Sitzung/CSRF ohne zusätzlichen Passwortdialog.
Eigentümer-, Admin-, Revisions- und letzter-Admin-Prüfungen bleiben erhalten.
Der gezielte Löschtest deckte einen bestehenden Unterschied zwischen `null`
im Vertragsnachweis und internem leerem DELETE-Body auf; die Prüfung verwendet
jetzt dieselbe kanonische Darstellung, ohne die Aktionsbindung aufzuheben.

Die Kontoseite besitzt eine obere Navigation mit je einer Ansicht für
Darstellung, Passwort, Zwei-Faktor-Schutz, Sitzungen, Agenteneinstellungen und
Kontolöschung. Deep-Links, Reload und Zurücknavigation sind geprüft;
Passwortfelder werden beim Themenwechsel geleert. Der Einstieg bleibt nur
oben rechts. Themes heißen Dark/Light/System; werbliche Untertitel und
Seitenüberschriften sind entfernt. Sitzungen zeigen Browser, Betriebssystem
und letzte Aktivität statt doppelter roher User-Agent-Zeilen.

Sachfelder haben fachliche Namen, `autocomplete=off` und Ignore-Hinweise für
Passwortmanager; Zugangsdaten verwenden username/current-password/new-password
und Einmalcodes one-time-code. Echte Passwortmanager-Erweiterungen wurden nicht
getestet; eigene Heuristiken können diese Hinweise übergehen.

Nachweise: frischer Windows-Lauf mit Node24.22.3 gegen separate echte
PostgreSQL-Datenbank, 12 API-/CLI-Prüfgruppen erfolgreich, einschließlich acht
Go-CLI-Operationen, Kontolöschung, Passwortwechsel, Recovery, CSRF,
Aktionsbindung/-verbrauch und TOTP-Replay. 27 Playwright-Tests gemeinsam in
26,5 s bestanden, einschließlich mobiler/desktop Kontonavigation, Autofill,
Agentenaktionen ohne Passwort, Auth-, Markdown-, ZIP- und OAuth-Abläufen.
Screenshots der Kontoseiten auf Desktop/Mobil wurden visuell geprüft.
26 .NET-Unit-Tests und 94 Vertragsfälle bestanden; Webbuild und Clientdrift
waren erfolgreich. Der OAuth-/MCP-SDK-Korpus bestand ebenfalls. Die bestehenden
Such-/Archiv-Grenzkorpora und der separate Admin-Race wurden für diese Änderung
lokal nicht erneut ausgeführt. Der bekannte Vite-Chunkhinweis bleibt bestehen.

### Überarbeitete Oberfläche am 13. November 2026

Die Webapp verwendet jetzt durchgängige semantische Farbtokens für Snow (hell)
und Monokai (dunkel), einschließlich Formularen, Fehlern, Dialogen, Markdown und
CodeMirror. Die gespeicherten Vertragswerte bleiben `light`, `dark`, `system`.
Eine schmale Navigation mit fester Neu-Aktion und die Suche in der oberen Leiste
ersetzen die bisherige Suchstartfläche. Erinnerungen erscheinen in kompakten
Zeilen mit Trennlinien; auf breiten Bildschirmen stehen Titel, Ausschnitt, Tags
und Datum nebeneinander. Mobile Navigation verwendet einen modalen Drawer mit
Fokusführung und Escape; der Editor schaltet mobil zwischen Markdown und
Vorschau um. Die Tags bleiben unter dem Editor erreichbar. Ohne Vault führt der
Leerzustand direkt zur Vaultanlage.

Nachweise: Web-Produktionsbuild, TypeScript und Clientdrift bestanden;
25 Playwright-Tests gemeinsam in 26,4 s gegen isolierte echte API/PostgreSQL
bestanden. Darunter die 17 bestehenden Auth-/Kernfälle, sechs Ansichten mit
langen Titeln, Texten, Code und Tabellen bei 390/1440/1920 px in beiden Themes,
die Anmeldethemes und ein laufender Systemfarbwechsel einschließlich CodeMirror.
Die Bildschirmbreite wird bei Editor, Vorschau, Lesen und Profil geprüft;
mobile Dialoge geben den Fokus zurück. Bestehende Markdown-Sicherheitsprüfungen
bleiben erfolgreich. Suche, Editor, Login, Vault-Einstellungen und Profil wurden
zusätzlich anhand echter Screenshots visuell geprüft. Eine gequetschte
Tabellenspalte wurde dabei korrigiert und nachgeprüft.

Zusätzlich bestanden 13 API-/PostgreSQL-Prüfgruppen einschließlich acht echter
CLI-Operationen, der OAuth-/MCP-SDK-Korpus, 26 .NET-Unit-Tests, Go-Tests/vet und
94 Vertragsfälle. Der zusätzliche Admin-Race und die fest an einen anderen
Container gebundene Zeitstempelfixture wurden in diesem lokalen Designlauf nicht
erneut ausgeführt; die früheren Nachweise oben bleiben davon getrennt.
Alle neuen Tests und Screenshots verwenden synthetische Daten in einer eigenen
Testinstallation; die bestehende Entwicklungsdatenbank wurde nicht verändert.

Aktuelle Beispiele: [Snow Desktop](screenshots/desktop-light.png),
[Monokai Desktop](screenshots/desktop-dark.png) und
[mobile Leseansicht](screenshots/mobile-reading.png). Der Build meldet weiterhin
den bekannten Vite-Hinweis auf große JavaScript-Chunks; eine Performanceabnahme
oder vollständige Plattformprüfung wird daraus nicht abgeleitet.

### Korrektur der Kontoformulare am 13. November 2026

Setup, Einladung, Reset und Passwortänderung zeigen die unveränderte Regel
15–128 Unicodezeichen und feldbezogene Fehler. Die Browserprüfung zählt
Codepoints statt UTF-16-Einheiten; Login bleibt bei 1–128 Zeichen. Der Server
erklärt verletzte Passwortgrenzen ohne eingegebene Werte zurückzugeben.
Einmallinks und Zweitfaktorformulare behalten nach Navigation keinen fremden
Formularzustand. Abgelaufene Faktorabläufe erlauben einen neuen Login;
„Angemeldet bleiben“ setzt auch nach dem zweiten Faktor Cookie und Serversitzung
konsistent auf 30 statt 7 Tage.

Nachweise für diese Korrektur: eigener frischer PostgreSQL18-/API-Lauf auf
Windows mit 11 erfolgreichen Prüfgruppen einschließlich Setup, Einladung,
128-Emoji-Reset/Login, CLI, Lifecycle und TOTP; 11 Playwright-Tests bestanden
(32,9 s), darunter vier neue Authformularfälle und Faktorabbruch/Neustart.
Der neue Setup-UI-Negativtest simuliert ausschließlich den Setupstatus, um das
Formular auch auf einer eingerichteten Testinstanz zu prüfen; erfolgreiche
Einrichtung und Login wurden zusätzlich gegen echte API/PostgreSQL geprüft.
Ein unabhängiger Nachreview auf weiterer leerer Testdatenbank prüfte alle vier
Fehler sowie ASCII-/Emoji-Grenzen 14/15/128/129 und unveränderte Leerzeichen.
.NET-Releasebuild ohne Warnungen, 26 Unit-Tests, 94 Vertragsfälle,
Clientdrift und der echte OAuth-/MCP-SDK-Korpus bestanden ebenfalls.
Bestehende Entwicklungsdaten wurden für die Tests nicht geändert.

Der erste Linux-CI-Lauf dieser Korrektur bestand alle 14 API-/PG-Prüfgruppen
und den MCP-SDK-Korpus, deckte im erweiterten Browsertest aber zusätzlich ein
Navigationsrennen auf: Eine noch ausstehende Loginantwort konnte nach einem
Routenwechsel erneut das Faktorformular aktivieren. Authantworten sind nun
an die aktuelle Navigation gebunden, einschließlich verzögerter Fehler und
CSRF-Aktualisierung. Die Ladeanzeige verwaltet einzelne laufende Anfragen;
veraltete Authanfragen blockieren keine neue Form und geben neuere Anfragen
beim Abschluss nicht vorzeitig frei. Sechs weitere deterministische
Browserregressionen prüfen verzögerte Antworten, Zurücknavigation, parallele
Anfragen und den CSRF-Abschluss. Ein erneuter unabhängiger Nachreview bestand
neun gezielte Prüfgruppen. Der abschließende Windows-Browserlauf bestand
alle 17 Tests gemeinsam in 16,6 s; Webbuild und Typ-/Vertragsdrift waren grün.

### Bestehende Prototypnachweise

- `dotnet restore memoryaffe.sln --locked-mode` und
  `dotnet build memoryaffe.sln -c Release --no-restore`: bestanden.
- `dotnet test tests/Memoryaffe.Tests -c Release --no-restore`:26Tests bestanden.
  Darunter sämtliche offiziellen Unicode17-Normalisierungsfixtures, Full Case
  Folding, spezielle SSRF-Netze und striktes JSON/Unicode.
- `node docs/contracts/build-all.mjs`, anschließende Vertragsprüfung gemäß
  [Vertrags-README](contracts/README.md):94positive/negative Schemafälle bestanden.
  Das ist zusätzlich zu den Laufzeittests und ersetzt sie nicht.
- Go- und TypeScript-Clientgenerierung sind reproduzierbar und haben einen
  Driftcheck. Die Webapp verwendet Typen aus dem Web-OpenAPI-Vertrag.
- [Finaler frischer API-/PG-/CLI-Lauf](../tests/integration/results-final-windows-2026-11-13.json):
 14Prüfgruppen bestanden, `reusedExistingTestAccount=false`, Node24.22.3.
  [Runner und Optionen](../tests/integration/README.md).
- `tests/Memoryaffe.ProtocolTests`: positiver kontrollierter CIMD-Flow,
  browsergebundenes Consent, S256, falsche Resource/PKCE, einmaliger Code,
  alle acht MCP-Tools mit strukturierten Ergebnissen und Toolfehlern, temporärer
  Metadatenausfall ohne Refreshverbrauch, strikter Refresh-Reuse mit familienweitem
  Widerruf, Allowlistentzug, RFC7009, Scope-/Origin- und UTF8-Negativfälle bestanden.
- CLI: native Windows-Tests/vet/Build sowie nativer Linux/amd64-Test mit
  `go test -race -count=1 ./...`, vet, Build und echten HTTP-/PG-Operationen
  bestanden. Sechs Crossbuilds Windows/Linux/macOS für amd64/arm64 bestanden;
  Crossbuilds sind keine nativen macOS- oder arm64-Ausführungsnachweise.
- Docker: gepinnte Images und tatsächlich aufgelöste Registry-/Plattformdigests
  in [images.lock.json](../deploy/images.lock.json). Linux/amd64 wurde ausgeführt;
  arm64-Manifestauflösung allein belegt keinen Lauf auf arm64.

Die schnellen Integrationskorpora verwenden ausdrücklich erhöhte Testraten und
kontrollierte CIMD-Metadaten nur in `Development`. Beide Testoptionen werden in
`Production` abgewiesen. Der produktive CIMD-Abruf behält genaue HTTPS-Allowlist,
DNS-/Verbindungs-/Peerprüfung, Redirectverbot, Timeout und Größenlimit.
Es wurden ausschließlich synthetische Inhalte und zufällige Testgeheimnisse benutzt.
Secrets, Schlüssel, Archive und lokale Zugangskonfigurationen gehören nicht zu Git.

## Technische Abbildung und bewusste Grenzen

Die Einzelinstanz serialisiert Fachdaten- und Rechteänderungen konservativ mit
einem transaktionalen PostgreSQL-Advisory-Lock. Revisions-Concurrency, FK-/Unique-/
Check-Constraints und verzögerte Tag-/Vault-/Eigentümerprüfungen sichern die
Persistenz zusätzlich. Der Ansatz bevorzugt nachvollziehbare Konsistenz für wenige
bekannte Nutzer; er ist keine behauptete Skalierungs- oder Leistungsabnahme.

Suchgenerationen werden pro Datensatz in kurzen Transaktionen aufgebaut. Die alte
Suchsprache bleibt wirksam, bis die Zielgeneration alle aktuellen Revisionen
enthält. Änderungen aktualisieren beide Generationen; ein Neustart setzt den
persistierten Auftrag fort. Die private ZIP-Vorbereitung liegt außerhalb des
Webroots, und abgelaufene Vorbereitungen sind sofort fachlich gesperrt.

Der Tokenwiderrufs-Endpunkt hat jetzt wie die bestätigte Verwaltungsregel eine
erwartete Agentenrevision. Die zuvor fehlende Querydefinition wurde ausschließlich
im Generator `docs/contracts/build-web.mjs` ergänzt und anschließend regeneriert.
Das ist eine technische Schließung der vorhandenen Vertragslücke, keine neue
Produktentscheidung. Entsprechende Clients senden `expectedRevision`.

SMTP ist in dieser ersten Version nicht angebunden. Einladungen, Passwortreset
und umfassende Recovery funktionieren über manuell übergebene Einmallinks;
E-Mail-Änderung erfolgt nach persönlicher Abstimmung durch einen Administrator.
Die Oberfläche behauptet keine Mailboxverifizierung und bietet keinen falschen
Mailversand-Erfolg. Eine spätere SMTP-Anbindung und deren Zustelltests bleiben offen.

Weitere offene Abnahmen: echtes ChatGPT-Konto an öffentlichem HTTPS, native
macOS-/arm64-Läufe, vollständige Browser-/Plattformmatrix, Last-/Dauermessungen
und umfassende zeitgesteuerte Grenztests sämtlicher Fristen. Die gezielten
Rennen-/Replay-/Wiederherstellungsprüfungen ersetzen diese Releaseabnahme nicht.

## Lizenzen

Projektcode steht unter MIT. Unicode17-Daten und ihre SHA256-Summen liegen unter
`src/Memoryaffe.Infrastructure/Unicode`. Die Inventur
[DEPENDENCY_LICENSES.json](DEPENDENCY_LICENSES.json) identifiziert289restaurierte
managed-, Go- und aktuelle Plattform-npm-Pakete einschließlich Build/Test sowie
ihre deklarierten Lizenzen. [THIRD_PARTY_NOTICES](../THIRD_PARTY_NOTICES.txt) und
zugehörige Lizenztexte werden mitgeliefert. Das ist kein pauschaler MIT-Anspruch
für Abhängigkeiten; Betriebssystempakete der Basisimages und nicht installierte
optionale Plattformbinärdateien liegen außerhalb dieser lokalen Inventur.
