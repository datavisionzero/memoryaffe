# Betriebsgrenzen und technische Lieferbasis

Stand 13. November 2026. Startwerte für kleine vertrauensbasierte Installationen;
keine behaupteten Benchmark-Ergebnisse. Konfiguration nur durch Betreiber, mit
Startvalidierung positiver Grenzen. Keine UI für ein komplexes Quotenprodukt.

## Rate-Limits und Ressourcen

Grenzen kombinieren IP und Konto/Agent, damit weder Wechsel der Kontokennung
noch gemeinsame Haushalts-IP allein die Schutzwirkung bestimmt. Bekannte und
unbekannte Kontoangaben werden gleich behandelt. Keine dauerhafte Kontosperre.
Vertrauenswürdige Proxy-Adressen explizit konfigurieren, keine beliebigen
X-Forwarded-For-Header als Client-IP akzeptieren.

| Vorgang | Startwert |
|---|---|
| Login/Reauth | 30 Versuche/5min/IP und 10 Fehlversuche/15min/Konto-Kennung |
| Fehlversuchverzögerung | ab drittem Fehler 1,2,4,8 Sekunden, höchstens8; keine blockierten Workerthreads |
| Faktorprüfung | zusätzlich fünf Fehler je fünfminütigem Flow |
| Reset-Anfrage | 3/15min/Kennung, 20/15min/IP; Antwort immer generisch |
| Setup/Einmal-Link einlösen | 10/15min/IP, laufende Prüfungen begrenzen |
| OAuth authorize/token | 60/min/IP, Refresh zusätzlich30/min/Zugang |
| CIMD ausgehend | bestehende5s/64KiB; ein laufender Abruf je erlaubter URL |
| Produkt lesen/suchen | 120/min/Akteur, Burst20 |
| Produkt schreiben | 60/min/Akteur, Burst10 |
| Suchkonkurrenz | maximal2 je Akteur, 8 je Instanz; SQL-Timeout5s |
| Importprüfung/-übernahme und Export | zusammen maximal1 je Konto, 2 je Instanz |
| Temporäre Archive | standardmäßig2GiB Instanzbudget, vor Schreiben reservieren |
| Normale JSON-Requests | maximal8MiB (1MiB Markdown kann JSON-escaping benötigen) |
| Auth-/OAuth-Requests | maximal16KiB; Reauth mit typisiertem Verwaltungsauftrag maximal256KiB |
| Archiv-Upload | 101MiB Request, 100MiB ZIP, 500MiB entpackt, 10000 Datensätze |
| DB-Kommandos | normale Änderungen30s, Import/Export maximal5min |
| Bereinigungsintervall | jede5min plus beim Start; Fristen gelten unabhängig vom Job |

429 enthält Retry-After. Ausgeschöpfte Arbeits-/Speicherkapazität liefert
503/temporarily_unavailable, bestehende Daten bleiben unverändert. Kein
unbegrenztes Warten/Queuewachstum. Sicherheitsrelevante Konto-Fehlversuchzähler
serverseitig persistent; kurzfristige Burstzähler dürfen in der Einzelinstanz
im Speicher liegen. Dokumentierte Grenzen, konstante Speicherverwendung und
Abbruch bei Clientdisconnect beachten; transaktionale Bestätigungen können
bereits abgeschlossen sein, deshalb Wiederholungsergebnis prüfen.

Export streamt ZIP unter konsistentem PostgreSQL-Snapshot mit begrenzten Buffern,
nicht vollständig in RAM oder temporären Dateien. Export ist nicht auf
Importgrößen begrenzt; Ressourcen-/Zeitlimit meldet Fehler statt unvollständiges
ZIP als Erfolg auszugeben. Download erfolgt als Browserdatei, kein großer Blob
im React-State. Namenskollision und endgültige Übernahme sind DB-transaktional.

## Toolchains und direkte Abhängigkeiten

[dependencies.snapshot.json](dependencies.snapshot.json) hält 29 konkrete direkte
Pakete mit Registry-Quellen, Lizenzen, Peer-/Framework-Abhängigkeiten fest.
Erhebung13.11.2026, keine Aussage, dass Restore/Build bereits bestanden ist.
Die npm-Peerauflösung aller22 direkt gewählten Frontendpakete wurde außerhalb
des Repositorys mit `npm install --package-lock-only --ignore-scripts` erfolgreich
geprüft. Die ältere lokale Node24.11.0 erzeugte erwartete Engine-Warnungen für
jsdom und dessen XML-Serializer; die gepinnte Node24.22.3 erfüllt deren Bereich.
Kein Paketcode wurde ausgeführt und kein Frontendbuild als bestanden gewertet.

| Basis | Festgelegter Startwert |
|---|---|
| .NET SDK / Runtime | 10.0.404 / 10.0.15, net10.0 |
| EF Core / Identity / ASP.NET OpenAPI | 10.0.15, kein automatischer Wechsel auf11 |
| Npgsql EF Provider | 10.0.3, dessen EF-Bereich umfasst10.0.15 |
| MCP ASP.NET SDK | 2.4.0, net10.0-Unterstützung laut Registry |
| PostgreSQL | 18.7, Debian-basiertes Image, keine Preview19 |
| Node | 24.22.3 LTS; nur Build, nicht Serverruntime |
| React / ReactDOM | beide19.3.1 |
| TypeScript | 5.9.3 wegen openapi-typescript-Peerbereich5.x |
| Vite / React-Plugin | 8.3.8 / 6.3.0 |
| Go | 1.27.4, Standardbibliothek für CLI-Kern |

Containerdigest beim Bootstrap für beide Architekturen auflösen und einchecken,
nicht raten. Zentralversionen, npm-lockfile, NuGet-lockfiles und go.sum einchecken;
CI verwendet npm ci / locked restore. Optionale Peerpakete nur installieren,
wenn eine verwendete Funktion sie benötigt. Kein React Compiler als Nebenprojekt.
TS-Typen/Client: openapi-typescript7.13.0 mit dünnem typisiertem fetch-Adapter.
Go: aus Agenten-OpenAPI generierte DTOs/Methoden durch gepinnten Generator oder
kleinen reproduzierbaren schemaorientierten Generator; keine per Hand abweichenden
Modelle. Generatorversion und Ausgabedrift im Bootstrap nachweisen.

Direkte Registry-Lizenzen sind MIT, Apache-2.0 oder PostgreSQL; MCP2.4.0 wird
laut Registry als Apache-2.0 ausgewiesen. Ältere pauschale Annahme „SDK MIT“
nicht ungeprüft übernehmen. Projektcode bleibt MIT. Abhängigkeiten behalten
eigene Lizenztexte/NOTICE, Unicode-Daten ihre Unicode-Lizenz. Vor Veröffentlichung
transitive Abhängigkeiten/SBOM prüfen; direkte Metadaten sind kein vollständiger
Lizenzaudit. Keine ungeprüfte Behauptung, sämtliche ausgelieferten Dateien
seien allein MIT-lizenziert.

## Lokaler Ausgangszustand und Bootstrap-Prüfung

Diese Sitzung fand .NET SDK10.0.103 und Node24.11.0 lokal vor; beide sind älter
als die ausgewählte Basis. Go wurde im PATH nicht gefunden. Docker-CLI ist
vorhanden, Linux-Daemon war nicht erreichbar. Deshalb wurden keine echten
PostgreSQL-, .NET10.0.404- oder Container-Builds als bestanden erklärt.
Der Umsetzungsagent darf Toolchains lokal/isoliert bereitstellen und Docker
starten. Keine bestehenden fremden Container/Volumes entfernen. Ist Docker
technisch nicht verfügbar, unabhängige Implementierung fortsetzen, DB-Tests
als offen dokumentieren und den konkreten Bedarf melden.

## Liefer- und CI-Matrix

PR/Push: Format, Backend-Unit-/Integrationsprüfungen gegen echte PostgreSQL18.7,
Web-Typecheck/Vitest, Go-Tests, Vertragsgenerierung ohne Diff, Secrets-/Dependency-
Checks und Playwright-Kernabläufe. PostgreSQL nicht durch EF-InMemory ersetzen.
E2E: Chromium plus Firefox/WebKit-Smoke; Desktop1280px, mobile390px, Dark/Light,
de/en. Auth-, Rechte-, Versions- und Import-Races sind Pflichtintegrationstests.

Serverimage linux/amd64 und linux/arm64 bauen und starten; arm64 notfalls QEMU,
Emulation im Bericht kennzeichnen. CLI windows/linux/darwin jeweils amd64/arm64
bauen; native Smoke-Läufe mindestens Windows-amd64/Linux-amd64/macOS-arm64.
Nicht nativ ausgeführte Ziele als nur gebaut kennzeichnen, nicht als vollständig
getestet. Alle Artefakte mit SHA256. Release erst nach vorgeschriebenen Checks;
realer ChatGPT-Nachweis bleibt Gate für die Behauptung „ChatGPT-kompatibel“.

Backup/Restore auf frischer Datenbank einschließlich Identity, Versionen,
Papierkorb, persistenten Data-Protection-Schlüsseln und Konfiguration testen.
Secrets niemals ins Image oder Git. Compose-DB-Port intern. Betrieb ohne SMTP
und ohne Internet für CLI/LAN nach Bereitstellung der Artefakte testen.

## Primärquellen zur Versionserhebung

- [NuGet API](https://api.nuget.org/v3/index.json), exakte Paketquellen im Snapshot
- [npm Registry](https://registry.npmjs.org/), exakte Paketquellen im Snapshot
- [.NET10 Release-Metadaten](https://dotnetcli.blob.core.windows.net/dotnet/release-metadata/10.0/releases.json)
- [Go-Releases](https://go.dev/dl/?mode=json)
- [Node-Releases](https://nodejs.org/dist/index.json)
- [PostgreSQL18](https://www.postgresql.org/docs/18/index.html)
