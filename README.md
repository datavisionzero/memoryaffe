# memoryaffe

Selbst gehostetes Langzeitgedächtnis für Menschen und KI-Agenten, unter MIT. Der erste funktionsfähige Prototyp enthält eine deutsche/englische Webapp, Go-CLI und HTTP-MCP. PostgreSQL speichert Markdown, Tags, Revisionen, Konten und Agentenrechte. Alle Nutzer besitzen ausschließlich eigene Vaults.

## Lokal starten

Voraussetzungen: Docker mit Linuxcontainern, PowerShell7, .NET SDK **10.0.404**, Node **24.22.3**. Go **1.27.4** wird für CLI und Integrationstests benötigt. Die Versionen stehen in [global.json](global.json), [Paket-Snapshot](docs/contracts/dependencies.snapshot.json) und den Lockdateien.

```powershell
pwsh -File scripts/dev.ps1
```

Das Skript startet eine eigene PostgreSQL18.7-Instanz auf Loopback55432, baut Backend/Webapp und startet denselben Ursprung unter **http://127.0.0.1:5080**. Bestehende Volumes werden nicht gelöscht. Einen bereits belegten Appport zuerst freigeben oder `-Port 5082 -DatabasePort 55433` wählen. Eigene lokale Einstellungen und zufällige Geheimnisse liegen ausschließlich in der ignorierten Datei `.tools/dev-settings.json`.

1. `http://127.0.0.1:5080/setup` öffnen. Das Betreibersecret aus der privaten lokalen Einstellungsdatei in die Seite übernehmen und ein Administratorkonto mit mindestens15 Passwortzeichen anlegen.
2. Einen Vault anlegen, Markdown mit Summary/Tags speichern, suchen und bearbeiten. Die Historie lässt sich vergleichen/wiederherstellen; konkurrierende Änderungen erhalten den lokalen Entwurf.
3. Über **Administration → Einladungen** einen manuellen Einladungslink ausgeben und in einem anderen Browserprofil einlösen. Es wird kein SMTP benötigt.
4. Unter **Agenten** ausdrücklich Vault/Rechte wählen, einen CLI-Zugang bestätigen und einen einmalig sichtbaren Token ausgeben. Unter **Profil** kann freiwillig TOTP eingerichtet werden.
5. Löschen/Papierkorb und unter **Vault-Einstellungen** ZIP-Export/Import ausprobieren.

`pwsh -File scripts/smoke.ps1` prüft Health, CSRF und die gleichursprünglich ausgelieferte Webapp. Für schnelle Webentwicklung: API starten, dann `npm run dev --prefix src/web`; Vite leitet `/api` zur lokalen API5080 weiter. Details stehen in [src/web/README.md](src/web/README.md) und [CLI-Anleitung](src/cli/README.md).

## Mit HTTPS betreiben

[deploy/compose.yaml](deploy/compose.yaml) enthält App/PostgreSQL und getrennte persistente Datenbank-, Data-Protection- und Importvolumes. [deploy/compose.https.yaml](deploy/compose.https.yaml) ergänzt Caddy mit automatischem HTTPS. DNS und öffentliche Ports80/443 müssen zur Maschine führen.

```powershell
pwsh -File scripts/initialize-deployment.ps1 -PublicBaseUrl https://memory.example.org
docker compose -f deploy/compose.yaml -f deploy/compose.https.yaml --env-file deploy/.env up -d --build
```

Das Initialisierungsskript schreibt zufällige Secrets in die private, nicht versionierte `deploy/.env`; es gibt sie nicht aus und überschreibt keine vorhandene Datei. Für die Erstinstallation das dortige Betreibersecret lokal übernehmen. Weder `.env` noch Schlüssel, Archive, Tokens oder private Inhalte in Git/Logs kopieren.

Die App läuft ohne Root, mit schreibgeschütztem Rootdateisystem und ohne Linux-Capabilities. Nur Loopback5080 wird direkt veröffentlicht; PostgreSQL bleibt intern. Der optionale Proxy besitzt eine explizite interne IP, der ausschließlich für Forwarded-Headers vertraut wird. Bei Netzwerkkollision `MEMORYAFFE_PROXY_SUBNET` und `MEMORYAFFE_PROXY_IP` passend ändern. Bei einem eigenen Reverseproxy dessen tatsächliche feste IP ausdrücklich unter `Memoryaffe:KnownProxies` konfigurieren. Eine feste öffentliche HTTPS-Origin bleibt erforderlich. HTTP-Entwicklungsoptionen und Test-CIMD gehören nicht in Produktion.

Die Registry-Indexdigests und amd64/arm64-Manifeste stehen in [deploy/images.lock.json](deploy/images.lock.json). Linux/amd64-Containerbuild und echter HTTPS-Leerstart wurden lokal geprüft; das ist kein Nachweis nativer arm64-/macOS-Ausführung. Der Infrastrukturbetreiber kann Daten lesen; der Login weist darauf hin.

## Backup und Wiederherstellung

```powershell
pwsh -File scripts/backup.ps1 -Destination C:/private-backups/memoryaffe-2026-11-13
pwsh -File scripts/restore.ps1 -Backup C:/private-backups/memoryaffe-2026-11-13 -NewProject memoryaffe-restored -HttpPort 5081
```

Backup stoppt die App kurz, erstellt einen konsistenten PostgreSQL-Dump und sichert **Data-Protection-Schlüssel sowie die private Konfiguration**; anschließend startet es die App wieder. Das neue Backupverzeichnis erhält eingeschränkte Dateirechte. Zusätzlich verschlüsselt/offline aufbewahren. Temporäre Importvorbereitungen sind keine Backups und werden nicht übernommen.

Restore verweigert vorhandene Zielcontainer oder Zielvolumes, erstellt eine neue Datenbank und Schlüsselvolume und verändert die Quelle nicht. Es verwendet das lokal gebaute Appimage; auf einer neuen Maschine zunächst denselben Gitstand aus `backup.json` auschecken und das Image bauen. Optional ermöglichen `-PublicBaseUrl`, `-AdditionalComposeFiles`, `-ProxyIp` und `-ProxySubnet` einen getrennten HTTPS-Testaufbau. Vor produktiver Proxy-/DNS-Umschaltung Login, TOTP und gespeicherte Inhalte am korrekten HTTPS-Ursprung prüfen. Fehlende Data-Protection-Schlüssel machen vorhandene TOTP-Secrets unlesbar.

Für die Wiederherstellung eines Administratorkontos durch den Infrastrukturbetreiber:

```powershell
docker compose -f deploy/compose.yaml --env-file deploy/.env exec app dotnet Memoryaffe.Api.dll --recover-admin admin@example.org
```

Dieser ausdrücklich gestartete Betreiberweg gibt einen einmaligen, eine Stunde gültigen Wiederherstellungslink aus. Nur lokal geschützt übernehmen, nicht in Supportlogs veröffentlichen.

## Prüfen

```powershell
dotnet restore memoryaffe.sln --locked-mode
dotnet test tests/Memoryaffe.Tests -c Release
npm ci --prefix src/web
npm run build --prefix src/web
node src/cli/generate.mjs --check
# Im Verzeichnis src/cli:
go test ./...
go vet ./...
```

[API-/CLI-Prüfungen](tests/integration/README.md) benötigen eine dedizierte echte Datenbank. Browserprüfungen benötigen `E2E_EMAIL`/`E2E_PASSWORD` eines synthetischen Testkontos. `npm run test:e2e --prefix src/web` prüft CRUD, Konflikte, Historie, Dark/Light/System, DE/EN, Mobilansicht, Dialogtastatur, manuelle Einladung, TOTP/Recovery, Agentenrechte/Token, Kontowechsel, ZIP und OAuth-Consent. Geheimnisse bleiben im Prozessspeicher; Traces sind ausgeschaltet.

[CI](.github/workflows/ci.yaml) verwendet gesperrte Restores, Schema-/Generatordrift, Go/.NET, PostgreSQL-Integration, den echten MCP-SDK-Client, Chromium und Containerbuild. [scripts/test-ci.sh](scripts/test-ci.sh) ist für einen dedizierten Linux-Testhost und verweigert bestehende Testprozesse/Container. Ausführungsnachweise und verbleibende Abnahmen stehen in [docs/IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md).

Der reale ChatGPT-Verbindungstest bleibt offen. Der Prototyp ist kein Versprechen vollständiger MVP-Abnahme oder Produktionsreife. Produkt-/Schnittstellenregeln: [Vision](VISION.md), [Architektur](ARCHITECTURE.md), [Datenvertrag](DATA_CONTRACT.md), [API](API_CONTRACT.md), [Web](WEB_CONTRACT.md), [OAuth](OAUTH_CONTRACT.md). Projektcode: [MIT](LICENSE). Fremdlizenzen: [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt), [Inventar](docs/DEPENDENCY_LICENSES.json); deren Lizenztexte werden auch im Container ausgeliefert.
