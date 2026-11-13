# Architekturentwurf

Stand: 13. November 2026. Grundlage ist [VISION.md](VISION.md).
Dieses Dokument legt die technische Arbeitsgrundlage fest; es beschreibt noch
keine implementierte oder getestete Anwendung. Paketversionen, Kompatibilität
und Lizenzen werden vor dem Grundgerüstbau geprüft und festgehalten.

## Entscheidungsstatus

Block 1 (Architektur und Toolchains) wurde vom Nutzer bestätigt: modularer
Monolith mit vier Backend-Schichten, EF Core/Npgsql, Go-CLI, React/TypeScript/
Vite und die unten benannten UI-Bausteine sowie generierte OpenAPI-Clients.
Block 2 (Anmeldung, Agentenzugänge und Sicherheit) ist ebenfalls bestätigt,
einschließlich freiwilliger TOTP-Zwei-Faktor-Anmeldung ausschließlich im Profil.
Die OAuth-Auswahl ist bestätigt: eine begrenzte Eigenimplementierung mit CIMD
und einer betreiberverwalteten Liste erlaubter Client-Metadaten-URLs. Diese
Entscheidung ersetzt die frühere Vorgabe, keinen eigenen OAuth-Stack zu bauen.
ASP.NET Core Identity bleibt die Basis für Benutzeranmeldung und TOTP.
Bestätigt sind außerdem die acht Datenregeln zu Vault-Namen, Tag-Normalisierung,
Tag-Änderungen, Versionswiederherstellung, Vault-Papierkorb und dessen Fristen,
Löschen des letzten Vaults sowie Konfliktbehandlung.
Die übrigen technischen Konkretisierungen dieses Dokuments bleiben Entwurf,
soweit sie nicht bereits ausdrücklich in der Produktvision beschlossen sind.
Vor dem Grundgerüst werden alle weiteren Entscheidungsblöcke gemeinsam geklärt.

## Bezug zu planaffe

Geprüft wurde der lokale, unveränderte planaffe-Stand
`483f9463095592ea324fd7a614c89233c942d11e`, insbesondere
[Codeaufbau](https://github.com/datavisionzero/planaffe/blob/483f9463095592ea324fd7a614c89233c942d11e/docs/codebase.md),
ADRs 0002–0005 und 0017, Projektdateien, Web-Paketmanifest und Compose.

Übernommen werden vier Backend-Schichten, EF Core/PostgreSQL, React mit eigener
Toolchain, eine Go-CLI, generierte HTTP-Clients und ein gemeinsames Serverimage
für Backend und gebaute Webapp. Go folgt hier bewusst planaffe und erlaubt eine
CLI-Auslieferung ohne installierte .NET-Laufzeit. Diese Technologieauswahl
ist als Teil von Block 1 bestätigt.

Nicht übernommen werden Issue-Workflow, Projektrollen, Claims, die dortige
Token-Anmeldung für die Webapp oder eine allgemeine Gleichstellung von CLI und
Nutzeroberfläche. memoryaffe hat eigene Konten, Vaults und ausdrücklich
nutzervorbehaltene Aktionen. planaffes Repository-Regeln gelten nicht automatisch
für dieses Repository. Bestehende Produktdokumentation bleibt deutsch;
Codebezeichner und API-Verträge werden englisch.

## Aufbau und Abhängigkeiten

Ein modularer Monolith genügt für kleine Installationen. Es gibt keinen
zusätzlichen Suchserver, Message-Broker oder Cloud-Dienst.

```text
Webapp ── HTTP/Cookie ─┐
CLI ── HTTP/Token ─────┼─ ASP.NET Core Host ─ Application ─ Domain
ChatGPT ─ MCP/OAuth ───┘          │               │
                         Infrastructure ─ PostgreSQL
```

Geplante Struktur:

| Pfad | Verantwortung |
|---|---|
| `src/Memoryaffe.Domain` | Fachregeln ohne Infrastrukturabhängigkeiten |
| `src/Memoryaffe.Application` | Anwendungsfälle, Berechtigungsprüfung, Ports |
| `src/Memoryaffe.Infrastructure` | Persistenz, Transaktionen, Authentifizierung, SMTP |
| `src/Memoryaffe.Api` | HTTP, MCP-Adapter, OAuth-Endpunkte, Hintergrundjobs, Komposition |
| `src/web` | React/TypeScript/Vite, Nutzer- und Adminoberfläche |
| `src/cli` | Go-Client, lesbare Ausgabe und JSON |
| `tests` | Fachtests, PostgreSQL-Integration, Vertrags- und Oberflächentests |
| `deploy` | Dockerfile, Compose, Proxy-Konfiguration, Beispielumgebung |
| `docs/api` | Versionierter OpenAPI-Vertrag |

Domain hat keine äußeren Abhängigkeiten, Application hängt von Domain ab,
Infrastructure implementiert Application-Ports. Api verbindet diese Teile.
HTTP und MCP rufen dieselben Anwendungsfälle auf; die CLI spricht ausschließlich
HTTP. Kein Adapter führt eigene Datenbankabfragen oder Berechtigungslogik ein.

EF Core mit Npgsql übernimmt Datenzugriff und versionierte Schema-Migrationen.
Gezieltes SQL in Infrastructure ist für Suche und atomare Operationen zulässig.
Es gibt keine generische Repository-Abstraktion pro Tabelle; Ports beschreiben
benötigte Operationen mit klaren Transaktionsgrenzen.

## Datenmodell

| Entität | Wesentliche Daten und Regeln |
|---|---|
| Account | ID, E-Mail, Passwort-Hash, Adminstatus, Sperre, Sprache, Theme, Agenten-Tag-Erlaubnis |
| Vault | ID, Eigentümerkonto, Name, Versionslimit, Lösch- und Ablaufzeitpunkt |
| MemoryRecord | Stabile ID, Vault, Titel, Markdown, optionale Zusammenfassung, Revision, Zeitpunkte, Verursacher, Löschstatus |
| RecordVersion | Historischer Snapshot mit Titel, Markdown, Zusammenfassung und Tag-Namen, Revision und Verursacher |
| Tag / RecordTag | Vault-lokale Tags und Zuordnungen; definierte Namensnormalisierung |
| AgentAccess | Konto, Name, Widerrufsstatus; getrennt von technischen Zugangsdaten |
| VaultGrant | AgentAccess, Vault, eine der drei Berechtigungsstufen |
| Credential / OAuthGrant | Gehashte Geheimnisse beziehungsweise Tokenreferenzen, Ablauf und Bindung an AgentAccess |
| Session / Invitation / PasswordReset | Konto beziehungsweise Einladung, Ablauf, Einmalverbrauch, Widerruf |

Eigentümerzugehörigkeit wird bei jeder Operation geprüft und durch passende
Fremdschlüssel/Constraints abgesichert. Konto-IDs aus Clientdaten begründen
niemals Rechte. Auch ein Admin erhält über Inhalte-Endpunkte nur eigene Daten.
Zeitpunkte werden in UTC gespeichert. IDs sind unabhängig von Titeln.
Vault-Namen sind pro Konto ohne Unterscheidung der Groß-/Kleinschreibung
eindeutig; Datensatztitel dürfen mehrfach vorkommen. Das Löschen des letzten
Vaults ist erlaubt und erzeugt keinen automatischen Ersatz.

Historische Tag-Namen werden als Snapshot erhalten, damit spätere Umbenennungen
keine alten Versionen verändern. Wiederherstellung löst Namen im aktuellen
Vault auf und legt fehlende Tags an; die UI zeigt diese vorab in der Vorschau.
Tag-Vergleiche ignorieren Groß-/Kleinschreibung und Rand-Leerzeichen und
verwenden Unicode-Normalisierung. Anzeigenamen erhalten ihre Schreibweise;
Akzente und Umlaute werden nicht entfernt. Die genaue Unicode-Normalform und
Vergleichsabbildung werden vor dem Grundgerüst im Datenvertrag festgeschrieben.
Umbenennen und Zusammenführen von Tags ändern aktuelle Zuordnungen und erzeugen
für betroffene Datensätze neue Revisionen und historische Snapshots gemäß
Vault-Limit. Alte Snapshots werden dabei nicht geändert.

## Transaktionen und Aufbewahrung

Eine Inhaltsänderung prüft die erwartete Revision, legt bei tatsächlicher
Änderung einen historischen Snapshot an, aktualisiert Inhalt und Tags und
kürzt die Historie auf das Vault-Limit: alles in einer Transaktion.
Bei Limit 0 bleibt nur die aktuelle Fassung. Wiederherstellung ist eine neue
Änderung; ein veralteter Schreibversuch erzeugt weder Version noch Teiländerung.
Die Webapp behält bei Konflikten den eigenen Entwurf und zeigt die aktuelle
Serverfassung zum Vergleichen. Agenten erhalten einen eindeutigen Konfliktfehler
und müssen erneut lesen; es gibt kein stilles Überschreiben.

Beim Verschieben bleiben ID und vorhandene Historie erhalten, soweit das
Ziel-Limit es zulässt. Tag-Zuordnung, Vault-Wechsel, Revisionserhöhung und
Historienkürzung sind atomar. Rechte auf Quelle und Ziel werden geprüft.

Datensätze und Vaults verwenden Soft-Delete mit 30 Tagen Aufbewahrung.
Abgelaufene Objekte sind auch dann nicht verfügbar, wenn der Bereinigungsjob
verspätet läuft. Ein wiederholbar ausführbarer Job entfernt sie endgültig.
Beim Wiederherstellen eines Vaults werden vorher bereits einzeln gelöschte
Datensätze nicht automatisch aktiviert; deren eigene Fristen bleiben bestehen.
Vault-Freigaben werden beim Löschen entfernt und nicht wiederhergestellt.
Beim Ablauf des gelöschten Vaults werden alle verbliebenen Inhalte endgültig
entfernt. Verschachteltes Löschen verlängert keine Fristen. Diese Randfälle
sind ausdrücklich bestätigte Produktregeln.

## Identitäten und Zugänge

Webanmeldung verwendet sichere HttpOnly-Cookies, CSRF-Schutz für Änderungen und
serverseitig widerrufbare Sitzungen. Passwörter werden mit einem etablierten
Passwort-Hasher gespeichert. Einladungs- und Reset-Geheimnisse werden nur
gehasht gespeichert und atomar einmalig verbraucht. Die erste Einrichtung wird
durch ein einmaliges Betreibergeheimnis geschützt und nach Abschluss gesperrt.

Passwörter haben 15 bis 128 Zeichen; Leerzeichen, Einfügen und Passwortmanager
werden unterstützt. Es gibt keine erzwungenen Zeichengruppen und keinen
regelmäßigen Wechselzwang. Wiederholte Anmeldefehler werden pro Konto und
Quelladresse begrenzt beziehungsweise zeitweilig verzögert, ohne dauerhafte
automatische Kontosperre. Login- und Reset-Antworten verraten keine Kontoexistenz.

Web-Sitzungen enden standardmäßig nach 12 Stunden Inaktivität, spätestens nach
sieben Tagen. Mit „Angemeldet bleiben“ gelten sieben Tage Inaktivität und
höchstens 30 Tage Gesamtdauer. Im Profil lassen sich aktive Sitzungen ansehen
und einzeln oder gemeinsam beenden. Logout widerruft die aktuelle Sitzung
serverseitig.

Eine normale Passwortänderung verlangt das bisherige Passwort und beendet
andere Web-Sitzungen. Ein Passwort-Reset beendet alle Web-Sitzungen und widerruft
sämtliche Agentenzugangsdaten einschließlich OAuth-Verbindungen. Die benannten
Agentenzugänge und ihre Rechte bleiben für eine erneute Einrichtung erhalten.

TOTP mit Wiederherstellungscodes gehört zum MVP und funktioniert ohne SMTP.
Die Einrichtung ist für alle Konten freiwillig, ausdrücklich auch für Admins.
Sie wird ausschließlich später im Profil angeboten. Weder Ersteinrichtung noch
Einladung/Kontoanlage enthalten einen 2FA-Schritt oder eine Aufforderung dazu.
Passkeys und externe Loginanbieter sind zunächst nicht vorgesehen.

Ein dokumentierter Befehl innerhalb des Servercontainers kann für einen
bestehenden Admin einen einmaligen Wiederherstellungslink erzeugen. Damit ist
Wiederherstellung ohne SMTP und zweiten Admin möglich; sie erfordert Zugriff
auf die Infrastruktur. Die genaue Behandlung eines verlorenen zweiten Faktors
und die Absicherung dieses Ablaufs werden vor Implementierung konkretisiert.

Für die CLI werden widerrufbare Agententokens vorgesehen, nur bei Ausgabe im
Klartext sichtbar. Übergabe über geschützte Konfiguration oder Umgebungsvariable,
nicht als Kommandozeilenargument. Der Server prüft bei jedem Zugriff Konto,
Agentenzugang und aktuelle Vault-Rechte. Sperren und Widerruf wirken dadurch
auch auf bereits ausgegebene Zugangsdaten.

CLI-Tokens gelten standardmäßig 90 Tage; bei Erstellung sind 30, 90, 365 Tage
oder unbegrenzte Gültigkeit wählbar. Die UI zeigt Ablauf und letzte Nutzung.
Bei einem Tokenwechsel kann das alte Token sofort oder nach einer Überlappung
von höchstens 24 Stunden ungültig werden. Ein ausdrücklicher Widerruf wirkt
immer sofort.

ChatGPT erhält einen OAuth-Ablauf statt eines CLI-Tokens. Der Nutzer meldet sich
bei memoryaffe an und ordnet die Verbindung einem eigenen benannten
Agentenzugang mit ausgewählten Vault-Rechten zu. OAuth-Scopes können diese
Rechte begrenzen, aber niemals erweitern. Token und Refresh-Vorgänge prüfen
weiterhin den aktuellen Sperr- und Widerrufsstatus.

Jede OAuth-Verbindung wird einem eigenen benannten Agentenzugang zugeordnet.
Beim Verbinden bestätigt der Nutzer Vaults und Rechte; zusätzliche Rechte
erfordern eine ausdrückliche Nutzerentscheidung. Access-Tokens gelten 15 Minuten.
Rotierende Refresh-Tokens ermöglichen Erneuerung bis zu 30 Tagen Inaktivität
beziehungsweise höchstens 180 Tagen seit Anmeldung. Danach ist erneute Anmeldung
erforderlich. Kontosperre und Widerruf greifen unabhängig von Tokenlaufzeiten
sofort.

## MCP und ChatGPT

Erster Abnahmeclient ist ChatGPT, danach Claude. Geplant ist Streamable HTTP
unter `/mcp`, im Internet über HTTPS. Für private Daten beschreibt OpenAI
OAuth 2.1 mit Authorization Code/PKCE, Discovery-Metadaten und Resource-Bindung.
CIMD ist das festgelegte Verfahren zur Clientidentifikation. Es gibt im MVP
keine dynamische Clientregistrierung (DCR). Eine vom Betreiber erweiterbare
Liste erlaubt konkrete CIMD-Dokument-URLs, zunächst für ChatGPT. Die Zulassung
eines Clients erteilt keine Vault-Rechte: Jeder Nutzer bestätigt seine eigene
Verbindung und deren Rechte. Ein einfacher API-Key ersetzt OAuth nicht.
[Quelle: OpenAI Authentication](https://developers.openai.com/plugins/build/auth)

Für MCP ist das offizielle C# SDK mit `ModelContextProtocol.AspNetCore`
vorgesehen. OAuth wird bewusst als begrenzte Eigenimplementierung umgesetzt,
ohne OpenIddict und ohne vollständigen OpenID-Connect-Anbieter. Unterstützt
werden Authorization Code mit verpflichtendem PKCE/S256 und rotierende
Refresh-Tokens. CIMD-Clients verwenden zunächst die Token-Endpunkt-Methode
`none` mit PKCE. ASP.NET Core Identity übernimmt weiterhin Benutzeranmeldung,
Passwortprüfung und optionales TOTP; kryptografische Primitive werden nicht
selbst entwickelt.

Access- und Refresh-Tokens sind kryptografisch zufällige, undurchsichtige
Geheimnisse, deren Hashes in PostgreSQL liegen. Jeder Zugriff prüft Ablauf,
Resource-Bindung und aktuelle Rechte. Autorisierungscodes werden atomar
einmalig verbraucht. Wiederverwendung verbrauchter Refresh-Tokens widerruft
die betroffene Tokenfamilie. Discovery und Consent folgen dem OAuth-/MCP-Vertrag.

CIMD-Dokumente werden über HTTPS abgerufen; Client-ID und Redirect-URI werden
exakt validiert. Abrufe erhalten Größen- und Zeitlimits sowie Schutz gegen
Zugriffe auf interne Netzwerkadressen, einschließlich Umleitungen und
DNS-Wechseln. Die erlaubte Client-URL ersetzt diese Prüfungen nicht.
[Quellen: MCP-Autorisierung](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization),
[offizielles C# SDK](https://github.com/modelcontextprotocol/csharp-sdk).

Vor dem Grundgerüst werden der vollständige Protokollvertrag und eine isolierte
ChatGPT-Kompatibilitätsprüfung einschließlich Fehler- und Widerrufsfällen
abgeschlossen. Paket-/Protokollversionen, genaue CIMD-URL und Cache-Regeln
werden dabei festgehalten. Die gemeinsame Kompatibilität ist noch nicht
praktisch nachgewiesen. CIMD benötigt zum Metadatenabruf Netzwerkzugriff;
der rein lokale CLI-Betrieb bleibt davon unabhängig.

Vorgesehene Tools: `list_vaults`, `list_tags`, `search_memories`, `get_memory`,
`create_memory`, `update_memory`, `delete_memory` und `create_tag`.
Sie haben explizite Schemas, strukturierte Ergebnisse und passende Lese-/
Schreibannotationen. Updates und Löschungen tragen die erwartete Revision.
Vault-Verwaltung, Historie, Verschieben, Papierkorb und Administration werden
nicht als Agententools angeboten. Annotationen ersetzen keine serverseitigen
Rechteprüfungen. Eine eigene eingebettete ChatGPT-UI ist nicht nötig.
[Quelle: OpenAI MCP-Server](https://developers.openai.com/plugins/build/mcp-server)

Der erste reale Test verwendet einen erreichbaren HTTPS-Endpunkt und ein
ChatGPT-Konto, dessen Einstellungen eigene MCP-Verbindungen erlauben. Die
Dokumentation nennt auch Tunnel als Testoption; memoryaffe setzt keinen
solchen Dienst voraus. Cloud-ChatGPT erreicht eine reine LAN-Adresse nicht
ohne zusätzlichen Verbindungsweg. Lokale MCP-Clients können denselben
HTTP-Endpunkt im LAN verwenden; stdio bleibt eine spätere Bedarfsprüfung.
[Quelle: Verbindung und Test](https://developers.openai.com/plugins/deploy/connect-chatgpt)

## HTTP, Suche und Oberfläche

HTTP-Verträge werden aus Endpunkten erzeugt, als OpenAPI eingecheckt und in CI
auf Drift geprüft. Web- und Go-Client werden daraus generiert. Listen liefern
kompakte, paginierte Ergebnisse, Einzelabrufe den vollständigen Datensatz.
Fehler haben stabile Codes, insbesondere für fehlende Rechte, Konflikte und
Validierungsfehler. Nicht zugängliche IDs verraten keine fremden Inhalte.

PostgreSQL-Volltextsuche mit gewichtetem Titel, Zusammenfassung und Inhalt
sowie GIN-Index ist der Startpunkt. Sprachbehandlung für deutsche und englische
Inhalte wird anhand eines Testkorpus festgelegt. Rechte, Tags und Löschstatus
filtern vor Pagination und Trefferzählung. Sortierung besitzt einen stabilen
ID-Tiebreaker; kein Treffertext wird als ungeprüftes HTML ausgegeben.

Die bestätigte Frontend-Basis ist eine React-Single-Page-App mit TypeScript und
Vite. ASP.NET Core liefert die gebauten statischen Dateien aus; Node ist nur
zum Bauen erforderlich. Server-seitiges React-Rendering ist nicht vorgesehen.
Tailwind CSS mit zentralen Designvariablen, Base UI mit eigenen Komponenten,
React Router, CodeMirror sowie react-markdown mit remark-gfm bilden die UI-Basis.
Vitest und Testing Library sind für Frontend-Tests vorgesehen. Versionen und
gemeinsame Kompatibilität werden vor dem Grundgerüstbau geprüft.
Keine ungefilterte HTML-Ausführung im Markdown.
Navigation, Vault-Wechsel, Suche, Editor, Historie, Papierkorb und Einstellungen
bilden den Nutzerbereich; Administration bekommt eigene Routen und Navigation.
Deutsch/Englisch, Themes, Tastaturbedienung und mobile Darstellung werden von
Beginn an berücksichtigt. Fonts und Assets werden lokal ausgeliefert.

## Betrieb und Datenmitnahme

Compose startet Anwendung und PostgreSQL; ein optionaler Reverse Proxy nach
planaffe-Vorbild übernimmt HTTPS. PostgreSQL erhält keinen öffentlichen Port.
LAN-Betrieb dokumentiert lokale Zertifikate und Vertrauensstellung ohne
öffentlichen Zertifikatsdienst. Secrets liegen außerhalb des Images.

Migrationen laufen vor Annahme von Requests, gegen parallele Ausführung
gesichert. Ein fehlgeschlagener Start meldet nicht bereit. Upgrades sind
betreibergeführt; Rückkehr erfolgt über passende Vorversion und vorheriges
Backup statt über ungeprüfte Rückwärtsmigrationen.

ZIP-Export enthält aktuelle aktive Datensätze als Markdown und ein versioniertes
Manifest mit Metadaten/Tags. Import validiert Größe, Anzahl, Pfade und Schema,
erstellt neue IDs in einem neuen Vault und übernimmt keine Agentenrechte.
Fehler hinterlassen keinen halbfertigen sichtbaren Vault. Historie und Papierkorb
gehören zur vollständigen Installationssicherung, nicht zum MVP-Vault-Export.

Backups umfassen PostgreSQL, erforderliche Konfiguration und persistente
Schlüssel. Wiederherstellung wird auf einer frischen Instanz geprobt.
Bereinigung in der Live-Datenbank entfernt keine externen alten Backups;
deren Aufbewahrung verantwortet der Betreiber. Diagnose zeigt Version,
Bereitschaft und Speicherverbrauch, ohne fremde Inhalte offenzulegen.
Logs vermeiden Inhalte und Geheimnisse; Telemetrie wird nicht eingebaut.

## Noch vor Implementierung zu konkretisieren

- OAuth-/CIMD-Protokollvertrag und isolierter ChatGPT-Kompatibilitätsnachweis.
- Genaue Request-Schemas, Fehlercodes, Limits und Wiederholungsbehandlung.
- Tag-Normalisierung, Volltext-Sprachkonfiguration und ZIP-Manifest.
- Runtime-/Paketversionen, CLI-Zielarchitekturen und Release-Matrix.

Diese Punkte werden vor dem Grundgerüstbau entschieden und dokumentiert.
Der [Umsetzungsplan](IMPLEMENTATION.md) trennt diese Vorarbeit von der Umsetzung.
