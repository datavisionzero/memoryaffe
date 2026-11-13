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
Die Inhaltsgrenzen und Schnittstellenregeln zu Teiländerungen,
Wiederholungsschlüsseln, Seitengrößen, einzelnen Schreiboperationen und
nicht zugänglichen IDs sind ebenfalls bestätigt.
Die Suchregeln zu Vault-Sprache, Suchsyntax, Gewichtung, Tag-Filtern,
leerer Suche, Suchumfang und Trefferanzeige sind bestätigt.
Bestätigt sind außerdem Exportformat und -umfang, konsistenter Export,
Importziel und Herkunftsdaten, vollständige Importprüfung, Importgrenzen,
Beschränkung auf memoryaffe-Archive und betreibergeführte Datensicherung.
Die neun Webapp-Bedienregeln zu Einstieg, Navigation, Datensatzansicht,
Editor, Entwürfen, Historie, Löschen, externen Bildern und Bedienbarkeit
sind ebenfalls bestätigt.
Bestätigt sind Kontoverwaltung und Wiederherstellung: mehrere Admins mit Schutz
des letzten aktiven Admins, E-Mail-Bindung der Einladung, E-Mail-Änderung,
2FA-Verwaltung, getrennter Passwort-Reset und umfassende Kontowiederherstellung,
endgültige Kontolöschung sowie erneute Authentifizierung für Sicherheitsaktionen.
Der Betriebs- und Veröffentlichungsumfang ist bestätigt: eine Anwendungsinstanz,
HTTPS, feste Basis-URL, Infrastrukturkonfiguration, bewusste Updates,
Zielplattformen, GitHub-Veröffentlichung, getrennte Zustandsprüfungen und
dokumentierte Leistungsmessungen.
Bestätigt sind CLI-Profile, sichere Token-Eingabe und ausdrückliche lokale
Speicherung, Datei-/stdin-Eingabe, Ausgabe-/Exitcode-Konventionen,
nichtinteraktive Agentenaufrufe, begrenzte Wiederholungen, kompakte
MCP-Schreibergebnisse und ein lesender Verbindungsprüfbefehl.
Die übergreifenden Randfälle sind bestätigt: reservierte Vault-Namen im
Papierkorb, versionierte Tag-Löschung, Suchsprachenwechsel mit verfügbarer
bisheriger Suche, sofortige Rechtereduktion, Export oberhalb der Importgrenzen,
restriktive Startwerte für Agenten und Einstieg bei fehlendem letztem Vault.
Der [Datenvertrag](DATA_CONTRACT.md) ist bestätigt: UUIDv4-IDs,
Revisionsregeln, Unicode-Codepunktlimits und Namensvergleich, leere Werte und
Teiländerungen, UTC-Zeitformat sowie die Regeln für Vault-Archive in Format 1.
Der [Schnittstellenvertrag](API_CONTRACT.md) bestätigt API-Versionierung,
PATCH mit erwarteter Revision, gemeinsame fachliche Fehler, Cursor-Pagination,
adapterübergreifende atomare Wiederholungen und Ergebnis-/Tool-Grenzen.
Bestätigt sind außerdem camelCase-Felder, Antwortformen, expliziter Suchumfang,
Tag-Filter über IDs, HTTP-/Fehlercodes, 30-minütige geschützte Cursor,
Auftragsvergleich und Verhalten laufender Wiederholungen sowie CLI-Exitcodes.
Der [OAuth-/CIMD-Vertrag](OAUTH_CONTRACT.md) bestätigt feste Issuer-/Resource-
Identitäten, ChatGPT-Adressen mit Issuer-Identifikation, drei kumulative Scopes,
Zustimmung, Code-/Ablauffristen, CIMD-Abruf-/Cache-Limits und strikte Rotation.
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
Die Namensreservierung gilt auch für Vaults im Papierkorb bis zur endgültigen
Löschung, damit Wiederherstellung keinen Namenskonflikt erzeugt.

Historische Tag-Namen werden als Snapshot erhalten, damit spätere Umbenennungen
keine alten Versionen verändern. Wiederherstellung löst Namen im aktuellen
Vault auf und legt fehlende Tags an; die UI zeigt diese vorab in der Vorschau.
Tag-Vergleiche ignorieren Groß-/Kleinschreibung und Rand-Leerzeichen und
verwenden Unicode-Normalisierung. Anzeigenamen erhalten ihre Schreibweise;
Akzente und Umlaute werden nicht entfernt. Der Datenvertrag legt NFC und
sprachunabhängiges Unicode-Casefolding fest; Unicode-Version und technische
Abbildung werden vor dem Grundgerüst fixiert.
Umbenennen und Zusammenführen von Tags ändern aktuelle Zuordnungen und erzeugen
für betroffene Datensätze neue Revisionen und historische Snapshots gemäß
Vault-Limit. Alte Snapshots werden dabei nicht geändert.
Vollständiges Tag-Löschen entfernt aktuelle Zuordnungen, erzeugt für betroffene
Datensätze Revisionen und historische Snapshots nach denselben Regeln und
verändert keine alten Snapshots.

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

Mehrere Admins sind erlaubt. Sperre, Löschung oder Herabstufung dürfen niemals
den letzten aktiven Admin entfernen; dies gilt auch bei konkurrierenden
Operationen. Einladungen sind an die vom Admin angegebene, beim Einlösen
unveränderbare E-Mail-Adresse gebunden. Ohne SMTP dient diese als Anmeldename
ohne behauptete Mailbox-Verifizierung. Mit SMTP erfordert eine E-Mail-Änderung
das Passwort des Nutzers und Bestätigung der neuen Adresse per Link; ohne SMTP
nimmt der Admin die Änderung nach persönlicher Abstimmung vor.

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
Ein normaler Passwort-Reset deaktiviert keine bestehende 2FA.

TOTP mit Wiederherstellungscodes gehört zum MVP und funktioniert ohne SMTP.
Die Einrichtung ist für alle Konten freiwillig, ausdrücklich auch für Admins.
Sie wird ausschließlich später im Profil angeboten. Weder Ersteinrichtung noch
Einladung/Kontoanlage enthalten einen 2FA-Schritt oder eine Aufforderung dazu.
Passkeys und externe Loginanbieter sind zunächst nicht vorgesehen.
Aktivierung erfordert das aktuelle Passwort und einen erfolgreichen TOTP-Test.
Abschalten oder Ersetzen erfordert Passwort plus TOTP oder Wiederherstellungscode.
Neue Wiederherstellungscodes machen sämtliche alten Codes ungültig.

Für einen vollständig verlorenen zweiten Faktor erzeugt der Admin einen
gesonderten einmaligen Kontowiederherstellungslink mit einer Stunde Gültigkeit.
Beim Einlösen setzt der Betroffene ein neues Passwort; 2FA wird zurückgesetzt
und alle Sitzungen und Agentenzugangsdaten werden widerrufen. Ein dokumentierter
Befehl innerhalb des Servercontainers erzeugt für einen bestehenden Admin
denselben Link. Dieser Weg benötigt Infrastrukturzugriff, aber weder SMTP
noch einen zweiten Admin.

Nutzer können das eigene Konto löschen, Admins andere Konten. Nach ausdrücklicher
Bestätigung werden Konto, Vaults, Historie und Zugänge endgültig entfernt,
ohne Kontopapierkorb. Kontolöschung, Rollenänderungen und umfassende
Kontowiederherstellung verlangen eine erneute Passwortbestätigung des
Handelnden und bei aktivierter 2FA zusätzlich den zweiten Faktor. Der
Container-Wiederherstellungsweg setzt stattdessen Infrastrukturzugriff voraus.
Extern aufbewahrte Backups bleiben in Verantwortung des Betreibers.

Für die CLI werden widerrufbare Agententokens vorgesehen, nur bei Ausgabe im
Klartext sichtbar. Übergabe über geschützte Konfiguration oder Umgebungsvariable,
nicht als Kommandozeilenargument. Der Server prüft bei jedem Zugriff Konto,
Agentenzugang und aktuelle Vault-Rechte. Sperren und Widerruf wirken dadurch
auch auf bereits ausgegebene Zugangsdaten.
Auch Rechtereduktionen wirken sofort auf bestehende Tokens. Neue Agentenzugänge
haben keine automatisch ausgewählten Vaults; die angebotene Stufe ist
Lesen/Suchen. Neue Konten erlauben Agenten standardmäßig keine Tag-Erstellung.

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
abgeschlossen. CIMD-URL und Cache-Regeln sind im
[OAuth-/CIMD-Vertrag](OAUTH_CONTRACT.md) festgehalten; die ChatGPT-Adressen
werden im realen Versuch abgeglichen. Paket-/Protokollversionen und vollständige
Endpunktverträge werden ergänzt. Die gemeinsame Kompatibilität ist noch nicht
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

### CLI- und Agentenverhalten

Die CLI unterstützt benannte Profile mit Serveradresse und Agentenzugang,
ein Standardprofil und Auswahl pro Aufruf. Token-Eingabe erfolgt verdeckt
oder über Umgebungsvariable, niemals als Kommandozeilenargument. Lokales
Speichern verlangt eine ausdrückliche Entscheidung und eine Datei mit
eingeschränkten Zugriffsrechten. Markdown wird aus Datei oder stdin gelesen.

Standardausgabe ist menschenlesbar; `--json` liefert ausschließlich strukturierte
Ausgabe auf stdout, Diagnosen auf stderr. Stabile Exitcodes unterscheiden
Validierung, Anmeldung, Berechtigung, Konflikt und Verbindungsfehler.
Vollständig angegebene Befehle laufen ohne Rückfragen, fehlende Pflichtangaben
ergeben verständliche Fehler. Agentenaufrufe dürfen nicht auf Eingaben warten.
Interaktive Einrichtung ist ein ausdrücklich gewählter separater Ablauf.

Lesezugriffe dürfen bei vorübergehenden Verbindungsfehlern begrenzt wiederholt
werden. Schreibzugriffe werden nur mit demselben Wiederholungsschlüssel erneut
gesendet; Versionskonflikte werden nicht automatisch überschrieben.
MCP-Schreibergebnisse enthalten ID, neue Revision und Änderungszeitpunkt,
aber kein vollständiges Markdown; dieses wird ausdrücklich gelesen.
Ein CLI-Prüfbefehl prüft Erreichbarkeit, Anmeldung und zugängliche Vaults
ohne Inhaltsänderung. Die Webapp liefert passende Konfigurationsbeispiele.

### HTTP-Verträge und Suche

HTTP-Verträge werden aus Endpunkten erzeugt, als OpenAPI eingecheckt und in CI
auf Drift geprüft. Web- und Go-Client werden daraus generiert. Listen liefern
kompakte, paginierte Ergebnisse, Einzelabrufe den vollständigen Datensatz.
Fehler haben stabile Codes, insbesondere für fehlende Rechte, Konflikte und
Validierungsfehler. Fremde und unbekannte IDs liefern dieselbe Antwort
„nicht gefunden“. Bei sichtbaren Datensätzen ohne erforderliche Schreibrechte
wird dagegen „keine Berechtigung“ zurückgegeben.

Verbindliche Inhaltsgrenzen für alle Zugangswege:

| Feld | Grenze |
|---|---|
| Titel | Verpflichtend, maximal 200 Zeichen |
| Zusammenfassung | Optional, maximal 1.000 Zeichen |
| Markdown | Leer erlaubt, maximal 1.048.576 UTF-8-Bytes (1 MiB) |
| Vault-Name | Nicht leer, maximal 100 Zeichen |
| Tag-Name | Nicht leer, maximal 50 Zeichen |
| Tags pro Datensatz | Maximal 50 |
| Historische Versionen pro Vault | Einstellbar von 0 bis 100, Standard 20 |
| Listen-/Suchseitengröße | Standard 20, maximal 100 Ergebnisse |

Listen enthalten Metadaten und kurze Ausschnitte, Einzelabrufe vollständiges
Markdown. Teiländerungen erhalten nicht übergebene Felder; die Zusammenfassung
kann ausdrücklich geleert werden. Markdown wird vollständig ersetzt, ohne
zusätzliche Suchen-und-Ersetzen-Operation. Schreibaufrufe bearbeiten jeweils
einen Datensatz; ZIP-Import ist der Weg für größere Übernahmen.

Anlegen, Ändern und Löschen unterstützen einen optionalen Wiederholungsschlüssel:
Identische Aufträge mit demselben Schlüssel erzeugen innerhalb von 24 Stunden
keine zweite Änderung. Abweichende Aufträge mit demselben Schlüssel werden
abgewiesen. Der Schlüsselbereich ist der handelnde Nutzer beziehungsweise
Agentenzugang, gemeinsam über HTTP und MCP. Änderung und gespeichertes Ergebnis
werden atomar abgeschlossen, auch bei konkurrierenden Aufrufen. Wiederholungen
dürfen keine aktuellen Rechteprüfungen umgehen. Nach 24 Stunden besteht keine
Wiederholungsgarantie. Weitere Transport- und Vergleichsdetails werden im
[Schnittstellenvertrag](API_CONTRACT.md) vor dem Grundgerüst konkretisiert.

PostgreSQL-Volltextsuche mit gewichtetem Titel, Zusammenfassung und Inhalt
sowie GIN-Index ist der Startpunkt. Pro Vault ist die Suchsprache Deutsch,
Englisch oder sprachneutral wählbar, mit sprachneutral als Standard und
unabhängig von der Oberflächensprache. Die konkrete Index-/Abfragekonfiguration
und der Wechsel der Suchsprache werden vor dem Grundgerüst anhand eines
Testkorpus festgelegt, einschließlich vaultübergreifender Suche.
Änderung der Suchsprache indexiert bestehende Inhalte neu. Bis zur vollständig
abgeschlossenen Umstellung bleibt die bisherige Suche verfügbar.

Mehrere Begriffe werden standardmäßig mit UND verknüpft und dürfen über die
drei Inhaltsfelder verteilt vorkommen. Anführungszeichen bedeuten Wortgruppen,
`OR` Alternativen und Minuszeichen Ausschlüsse, identisch in allen Adaptern.
Tag-Filter sind separat: Standard ist „alle“, alternativ „mindestens einer“.
Eine leere Suche liefert zuletzt geänderte Datensätze mit optionalen Tag-Filtern.
Nur aktuelle aktive Fassungen werden durchsucht. Automatische Tippfehlerkorrektur
und automatische Wortanfangssuche sind nicht Teil des MVP.

Die Gewichtung lautet Titel vor Zusammenfassung vor Markdown. Bei gleichem
Rang entscheidet das jüngste Änderungsdatum, danach ein stabiler ID-Tiebreaker.
Alternativ kann nach Änderungsdatum sortiert werden. Rechte, Tags und Löschstatus
filtern vor Pagination und Trefferzählung. Treffer enthalten Titel, Tags,
Vault, Änderungsdatum und einen kurzen passenden Textausschnitt; bei leerer
Suche stattdessen Zusammenfassung oder Inhaltsanfang. Kein Treffertext wird
als ungeprüftes HTML ausgegeben.

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

Nach Anmeldung führt der Einstieg zur Suche im zuletzt verwendeten, noch
vorhandenen Vault. Fehlt der zuletzt verwendete Vault, wird
ein vorhandener eigener Vault gewählt; ohne Vault erscheint der leere Zustand
mit „Vault anlegen“. Die linke Navigation enthält Suche, Datensätze, Tags,
Papierkorb und Vault-Einstellungen; Agentenzugänge und Profil sind kontoweit.
Datensätze besitzen eigene verlinkbare Leseseiten mit Bearbeitungsaktion.
Bei Rückkehr zur Suche bleiben Suchtext, Filter und Position erhalten.

Titel und Zusammenfassung stehen oberhalb des Editors, Tags darunter.
Markdown und Vorschau stehen auf großen Bildschirmen nebeneinander und sind
mobil umschaltbar. Button und `Strg/Cmd+S` speichern ausdrücklich. Navigation
und Vault-Wechsel warnen vor ungespeicherten Änderungen. Private Entwürfe
werden nicht dauerhaft im Browserspeicher gespeichert; bei Konflikten bleibt
der Entwurf im geöffneten Editor erhalten.

Historie zeigt Zeitpunkt und Verursacher, Versionsansicht und Textvergleich
mit der aktuellen Fassung. Wiederherstellung verlangt Bestätigung.
Datensatzlöschung bietet kurz eine Rückgängig-Aktion; Vault-Löschung verlangt
Bestätigung mit Inhaltsanzahl, endgültiges Löschen eine gesonderte Bestätigung.
Externe Markdown-Bilder werden erst nach ausdrücklichem Klick geladen.
Mobile Navigation ist einklappbar; Kernabläufe sind per Tastatur bedienbar,
mit nachvollziehbarer Fokusführung nach Dialogen und Aktionen.

## Betrieb und Datenmitnahme

Compose startet genau eine Anwendungsinstanz und PostgreSQL. Clusterbetrieb
und Hochverfügbarkeitsversprechen gehören nicht zum MVP. HTTPS wird mit einem
optionalen mitgelieferten Reverse Proxy oder einem vorhandenen Proxy
dokumentiert. PostgreSQL erhält keinen öffentlichen Port. HTTPS gilt auch
im LAN; unverschlüsseltes HTTP bleibt auf lokale Entwicklung beschränkt.
LAN-Betrieb dokumentiert lokale Zertifikate und Vertrauensstellung ohne
öffentlichen Zertifikatsdienst. Secrets liegen außerhalb des Images.
Eine feste Basis-URL gilt für Webapp, Links und OAuth; ein Domainwechsel
verlangt erneute Verbindung der MCP-Clients. Datenbank, Basis-URL und SMTP
werden über Umgebungsvariablen beziehungsweise Secret-Dateien konfiguriert.
Persönliche Einstellungen verwalten Nutzer in der Webapp.

Migrationen laufen vor Annahme von Requests, gegen parallele Ausführung
gesichert. Ein fehlgeschlagener Start meldet nicht bereit. Upgrades sind
betreibergeführt; Rückkehr erfolgt über passende Vorversion und vorheriges
Backup statt über ungeprüfte Rückwärtsmigrationen.
Containerimages sind versioniert, Versionen ausdrücklich gewählt und Updates
nicht automatisch. Linux-Serverimages werden für `amd64` und `arm64` gebaut.
Eigenständige CLI-Downloads mit Prüfsummen gibt es für Windows, Linux und macOS,
jeweils `amd64` und `arm64`. GitHub Releases enthalten CLI und Versionshinweise,
GitHub Container Registry die Images. Veröffentlichung setzt erfolgreiche
automatisierte Prüfungen voraus; zusätzliche Paketmanager-Repositories sind
zunächst nicht vorgesehen.

Liveness und Readiness prüfen getrennt laufenden Prozess und Betriebsbereitschaft.
Öffentliche Antworten enthalten keine internen Details; weitergehende Diagnose
liegt im Adminbereich. Suche, Import und Versionierung werden vor Veröffentlichung
mit dokumentiertem Testdatenbestand und angegebener Hardware gemessen; es gibt
keine ungeprüften Leistungszusagen.

ZIP-Export enthält alle aktuellen aktiven Datensätze als `records/<id>.md`
und eine zentrale `manifest.json` mit Formatversion, Titeln, Zusammenfassungen,
allen vorhandenen Vault-Tags, Zeitpunkten und Vault-Einstellungen. Der Export
bildet einen konsistenten Datenstand auch bei parallelen Schreibzugriffen ab.
Historie, Papierkorb, Kontodaten und Agentenzugänge werden nicht exportiert.

Import erstellt neue IDs in einem neuen Vault ohne Agentenrechte. Der Nutzer
kann den Zielnamen vorab ändern; Namenskollisionen werden angezeigt.
Suchsprache und Versionslimit sowie ursprüngliche Erstellungs- und
Änderungszeitpunkte werden übernommen. Importzeitpunkt und importierendes
Konto werden zusätzlich gespeichert, ohne frühere Agentenidentitäten als
lokale Zugänge anzulegen.

Das gesamte Archiv wird vor dem Import auf Größe, Anzahl, Pfade, Schema und
Datensatzgrenzen geprüft. Fehler führen zur Ablehnung mit verständlicher
Fehlerliste, ohne Teilimport oder stilles Abschneiden. Verbindliche Grenzen:
100 MiB komprimiert, 500 MiB entpackt und 10.000 Datensätze pro Import.
Nur das dokumentierte memoryaffe-ZIP-Format ist im MVP unterstützt.
Die Importgrenzen begrenzen nicht den Export. Größere Exporte bleiben möglich;
die UI weist auf die Überschreitung der normalen Importgrenzen hin.
Eine vollständige Wiederherstellung benötigt das separate Installationsbackup;
ein Vault-Export ist kein Ersatz dafür.
Historie und Papierkorb gehören zur vollständigen Installationssicherung.

Backups umfassen PostgreSQL, erforderliche Konfiguration und persistente
Schlüssel. Dafür werden Betreiberbefehle dokumentiert; automatische Zeitplanung
liegt beim Betreiber, ohne Backup-Planer in der Webapp. Wiederherstellung wird
auf einer frischen Instanz geprobt.
Bereinigung in der Live-Datenbank entfernt keine externen alten Backups;
deren Aufbewahrung verantwortet der Betreiber. Diagnose zeigt Version,
Bereitschaft und Speicherverbrauch, ohne fremde Inhalte offenzulegen.
Logs vermeiden Inhalte und Geheimnisse; Telemetrie wird nicht eingebaut.

## Noch vor Implementierung zu konkretisieren

- OAuth-/CIMD-Protokollvertrag und isolierter ChatGPT-Kompatibilitätsnachweis.
- Genaue Request-Schemas, Fehlercodes, technische Abbildung der beschlossenen
  Limits/Wiederholungsregeln sowie verbleibende Betriebslimits.
- Unicode-Version und technische Vergleichsabbildung, Volltext-Sprachkonfiguration
  und maschinenlesbares ZIP-Manifest-Schema gemäß [Datenvertrag](DATA_CONTRACT.md).
- Runtime-/Paketversionen und konkrete Build-/Testmatrix für die beschlossenen
  Server- und CLI-Zielplattformen.

Diese Punkte werden vor dem Grundgerüstbau entschieden und dokumentiert.
Der [Umsetzungsplan](IMPLEMENTATION.md) trennt diese Vorarbeit von der Umsetzung.
