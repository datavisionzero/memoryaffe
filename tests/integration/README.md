# Echte API-/CLI-Integration

`api-cli.mjs` verwendet die laufende Anwendung mit PostgreSQL18.7, keinen
Mockserver und keine In-Memory-Datenbank. Voraussetzungen: Node24.22.3,
Go1.27.4, ein bereites Backend und eine **leere dedizierte Testdatenbank**.
Das Standardszenario weist eingerichtete Installationen vor Schreibzugriffen ab.
Es hinterlässt seine eigenen Konten/Vaults zur Prüfung und löscht die
Zieldatenbank nicht. Der optionale Admin-Race legt eine weitere temporäre
Datenbank an und entfernt ausschließlich diese wieder.

Start im Repositorywurzelverzeichnis; Geheimnisse aus einer sicheren Quelle
in die Umgebung übernehmen, niemals als Argumente übergeben:

```powershell
$env:MEMORYAFFE_TEST_SETUP_SECRET = $env:Memoryaffe__SetupSecret
$env:MEMORYAFFE_TEST_BASE_URL = 'http://127.0.0.1:5080'
$env:MEMORYAFFE_TEST_GO = "$env:LOCALAPPDATA/memoryaffe-toolchains/go127/go/bin/go.exe"
$env:MEMORYAFFE_TEST_DOTNET = "$env:LOCALAPPDATA/memoryaffe-tools/dotnet/dotnet.exe"
$env:MEMORYAFFE_TEST_DATABASE_PASSWORD = $env:PGPASSWORD
$env:MEMORYAFFE_TEST_DATABASE_NAME = 'memoryaffe'
$env:MEMORYAFFE_TEST_LIFECYCLE = '1'
$env:MEMORYAFFE_TEST_ADMIN_RACE = '1'
$env:MEMORYAFFE_TEST_SEARCH = '1'
$env:MEMORYAFFE_TEST_ARCHIVES = '1'
$env:MEMORYAFFE_TEST_OAUTH = '1'
$env:MEMORYAFFE_TEST_TOTP = '1'
$env:MEMORYAFFE_TEST_REPORT = 'tests/integration/results-local.json'
node tests/integration/api-cli.mjs
```

`MEMORYAFFE_TEST_SETUP_SECRET` benötigt mindestens24 Zeichen und muss mit dem
Betreibersecret des Backendprozesses übereinstimmen. Ohne explizite
`MEMORYAFFE_TEST_ADMIN_EMAIL`/`MEMORYAFFE_TEST_ADMIN_PASSWORD` erzeugt der Runner
Testzugangsdaten im Arbeitsspeicher. Explizite Zugangsdaten ermöglichen danach
Browserprüfungen. `MEMORYAFFE_TEST_REUSE=1` setzt eine ausdrücklich bestehende
Testinstallation und ein bekanntes Test-Adminpasswort voraus; dieser Modus
meldet Login/CSRF/Setup-Replay und keine erneute erfolgreiche Ersteinrichtung.

Der schnelle Gesamtkorpus setzt die dokumentierten Produktionsraten bewusst
nicht unter Last. Für den Testserver ist in Development
`Memoryaffe__TestRateMultiplier=20` vorgesehen; Production weist diese Option ab.
Lokales HTTP benötigt ebenfalls ausdrücklich Development. TLS im normalen
CLI-Betrieb prüft Systemvertrauen. Die Tests aktivieren nur Loopback-HTTP.

Die Module prüfen:

- Kern: CSRF/Setup, Einladung ohne SMTP, zwei Konten, fremde IDs auch als Admin,
  erklärende Passwortvalidierung für Setup/Einladung mit Unicodegrenzen,
  strikte Eingabe, parallele Revisionen, Noop/Historie, Idempotenz/Löschreplay,
  einmalige aktionsgebundene Bestätigung und alle acht echten Go-CLI-Operationen.
- `account-actions.mjs`: Admin-Einladung, Rollen-/E-Mail-Änderung und Recovery
  ohne erneute Anmeldung; Passwortänderung sowie eigene/administrative
  Kontolöschung bleiben geschützt, einschließlich CSRF und Nachweisbindung.
- `lifecycle.mjs`: Versionslimit0/2 und Senkung im Papierkorb, Tagaktionen auf
  Papierkorbinhalten mit unveränderten alten Snapshots, Moves mit ID/Historie,
  unmittelbare Agentenrechte, Vaultlöschung/Restore ohne wiederbelebte Grants,
  Namensreservierung, letzter eigener Vault, Sessions, Reset und 2FA-Recovery
  ausschließlich eines neu angelegten separaten Nutzers.
- `admin-race.mjs`: zwei Admins und konkurrierende Suspendierung in eigener
  Testdatenbank/API5081. Der gemeinsame Testadmin bleibt unangetastet. Benötigt
  Dockercontainer `memoryaffe-dev-pg` und PostgreSQL-Zugang. Das API-Assembly lässt
  sich mit `MEMORYAFFE_TEST_API_ASSEMBLY` wählen; CI bevorzugt sonst Published/
  Release vor Debug. Eigener Prozess, Datenbank und Schlüssel werden bereinigt.
- `search.mjs`: AND/OR/Minus/Phrasen/Feldgrenzen, neutral/de/en/Stopwörter,
  Rechte/Trash/Historie, konkrete Tag-IDs/all/any, Rang/Sortierung, Unicode-Namen,
  1-MiB-Markdown, >20000 Positionen, >256 Vorkommen, Segmentphrase und Schreiben
  während asynchronem Sprachwechsel. Mit DB-Passwort werden ausschließlich zwei
  eigene Fixture-IDs auf denselben Zeitstempel gesetzt und UUID-Gleichstände
  geprüft; ohne Passwort nennt die Ergebnisdatei diesen Teil als offen.
- `archives.mjs`: Export/Import-Roundtrip mit CRLF/Unicode/leerer Datei,
  neuen IDs, Tags, Originalzeiten, Revision1 ohne Historie/Papierkorbinhalte;
  20 manipulierte Archive; parallele Übernahme; fehlgeschlagene Ersetzung;
  Abbruch nach erfolgreichem Import ohne Vault-Datenverlust.
- `oauth-security.mjs`: Discovery, MCP-Challenge, unsichere CIMD-Ziele,
  OAuth-Fehlerformat einschließlich ungültigem UTF-8. Erfolgreiche OAuth-/MCP-
  SDK-Abläufe werden separat in `tests/Memoryaffe.ProtocolTests` geprüft.
- `totp.mjs`: Aktivierung, Code-Replay, atomarer Recovery-Code-Race und Abschaltung.
  Zusätzlich Cookie-/Serversitzungsdauer nach zweitem Faktor (7/30 Tage).

Exit0 bedeutet, dass sämtliche aktivierten Assertions erfolgreich waren. Die
PASS-Zeilen und JSON-Ergebnisdatei enthalten keine Cookies, Tokens, Passwörter
oder Markdown-Inhalte. CLI-Binärdatei/Testdatei liegen temporär außerhalb des
Repositorys; Tokens gehen ausschließlich über Kindprozess-Umgebungen.

## Native Linux-CLI und Race-Test

`linux-cli.mjs` benötigt explizite Test-Adminzugangsdaten und ein erreichbares
Backend. Es erstellt einen separaten Vault/Zugang, startet den Go-Debiancontainer
und widerruft das Token anschließend. Gemountet werden nur CLI- und Testquellen
schreibgeschützt. `linux-cli.sh` führt `go test -race -count=1`, `go vet`, Build
und alle acht CLI-Operationen samt doctor gegen das echte Backend aus. Ein
containerlokaler Reverseproxy erhält die strenge Loopback-HTTP-Regel der CLI;
Standardziel ist `http://host.docker.internal:5080`.

```powershell
node tests/integration/linux-cli.mjs
```

Bewusst gezogener, geprüfter Go1.27.4-Image-Digest:
`golang@sha256:4fa7c968ba93f1635670522dbb01a2c78150443e1385746924566079f36570ea`.
Mit `MEMORYAFFE_TEST_GO_IMAGE`/`MEMORYAFFE_TEST_PROXY_TARGET` kann die Testumgebung
explizit gewählt werden; keine Root-Deploymentlocks werden durch den Runner geändert.

## Ausgeführte Belege am 13.11.2026

`results-final-windows-2026-11-13.json` dokumentiert14 erfolgreiche Prüfgruppen
mit frischem Setup, allen Modulen und echter PostgreSQL-Instanz. Der frühere
`results-windows-2026-11-13.json` dokumentiert denselben Korpus im Wiederaufnahmemodus.
Linux-amd64 Go1.27.4: Race-Test, vet, Build und alle acht CLI-Operationen gegen
HTTP/PostgreSQL erfolgreich. Windows-amd64: Go-Tests/vet und echter CLI-Lauf
innerhalb des Gesamtkorpus erfolgreich. Alle sechs CLI-Crossbuilds für
windows/linux/darwin und amd64/arm64 erfolgreich.

Native macOS-Prüfung, manuelle verdeckte Terminaleingabe sowie der reale
ChatGPT-Verbindungstest bleiben offen. Syntaxprüfungen und Crossbuilds sind
keine Ersatznachweise für diese Läufe. Kein Produktionsreifeversprechen.
