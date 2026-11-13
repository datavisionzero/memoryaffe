# memoryaffe CLI

Go 1.27.4; Build im Verzeichnis `src/cli`: `go build -o memoryaffe.exe .`.
`go test ./...` und `go vet ./...` prüfen die Implementierung.

Server und Token für einmalige Aufträge per `MEMORYAFFE_SERVER` und
`MEMORYAFFE_TOKEN` setzen. Tokens gehören niemals in Argumente. `memoryaffe --help`
zeigt alle acht Agentenoperationen. Beispiel:

```powershell
$env:MEMORYAFFE_SERVER = 'https://memory.example.test'
# MEMORYAFFE_TOKEN über eine sichere Umgebungsquelle setzen.
./memoryaffe.exe --json vault list
./memoryaffe.exe memory create --vault UUID --title 'Notiz' --file notiz.md
./memoryaffe.exe memory update UUID --revision 1 --clear-summary
```

`profile configure --interactive` fragt Token verdeckt und Speicherung ausdrücklich
ab. Konfiguration: Windows LocalAppData/memoryaffe, Linux XDG_CONFIG_HOME/memoryaffe
(sonst ~/.config/memoryaffe), macOS ~/Library/Application Support/memoryaffe.
Dateien werden atomar und ausschließlich für den Eigentümer lesbar geschrieben;
Windows verwendet explizite ACLs. `profile list` zeigt niemals Tokens.
`MEMORYAFFE_TOKEN` und `MEMORYAFFE_SERVER` überschreiben das ausgewählte Profil.

HTTPS prüft Systemvertrauen; `--ca-file` ergänzt eine private CA. Lokales HTTP ist
nur auf Loopback und ausdrücklich mit `--allow-local-http` erlaubt. Redirects werden
nicht verfolgt. `doctor` liest die erste Vaultseite und prüft damit Erreichbarkeit
und Agentenauthentifizierung. Die CLI lädt keine weiteren Seiten heimlich nach.

Markdown aus Datei oder explizitem stdin bleibt bytegetreu als UTF-8-Text erhalten.
Revisionen bleiben Zeichenfolgen. Schreibaufträge erzeugen eine UUIDv4 und behalten
sie über maximal drei technische Versuche; `--idempotency-key` erlaubt Wiederholung
über Prozessstarts. Konflikte werden unverändert zurückgegeben. JSON-Ausgabe entspricht
dem API-Ergebnis; Fehler-Exitcodes entsprechen API_CONTRACT.md.

Prüfstand: Windows-httptest-Tests für alle acht Routen, Cursor, UTF-8/LF/CRLF/leeres
stdin, fehlende Eingaben, Status-Exitcodes, Retry-Schlüssel, TLS-Ablehnung,
Redirectblock und sichere Profil-ACLs. Das sind Transporttests gegen lokale
Testserver, kein Nachweis echter Backend-/PostgreSQL- oder ChatGPT-Kompatibilität.
Native macOS-Smokes und manuelle verdeckte Terminaleingabe sind weiterhin separat
abzunehmen. Linux-Nachweise stehen unten.


Ausgeführt am 13.11.2026 unter Windows/amd64 mit Go 1.27.4:
`go test ./...` und `go vet ./...` erfolgreich; `GOOS=linux go build` und
`GOOS=darwin go build` erfolgreich (amd64, Crossbuild ist kein nativer Lauf).
`go test -race ./...` war nicht ausführbar: cgo-Toolchain fehlt.
Ein echter Windows-Backend-Smoke gegen HTTP und PostgreSQL18.7 war erfolgreich:
alle acht Operationen, Cursor, Unicode/CRLF-Datei, leeres stdin, sofortige
Rechtereduktion/Grantentzug und Tokenwiderruf (tests/integration/api-cli.mjs).


DTOs und die tatsächlich verwendeten HTTP-Routen/Verben werden reproduzierbar aus
`docs/contracts/agent.openapi.json` erzeugt (schemaorientierter Generator v1):

```powershell
node src/cli/generate.mjs
# Danach im CLI-Verzeichnis: go fmt ./...
node src/cli/generate.mjs --check
```

Der Driftcheck vergleicht den generierten Go-Vertrag unabhängig von gofmt-Whitespace;
der SHA256 bindet zusätzlich die exakte OpenAPI-Quelle. Teiländerungen verwenden
weiterhin Feldmaps, um Auslassen und ausdrückliches Leeren zu unterscheiden.
Generierte nullable Teiländerungsfelder bewahren diese Unterscheidung ebenfalls.
Go-Builds für windows/linux/darwin mit amd64/arm64 sind erfolgreich crosskompiliert;
nativ ausgeführt wurden Windows-amd64-Tests sowie Linux-amd64 in Debian/Docker.
Linux: `go test -race -count=1 ./...`, vet, Build, doctor und alle acht CLI-
Operationen gegen echte HTTP-/PG-Schnittstellen erfolgreich. Reproduzierbare
Runner und Belege: `tests/integration/linux-cli.mjs` und die dortige README.
