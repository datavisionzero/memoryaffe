# Schnittstellenvertrag

Stand: 13. November 2026. Die folgenden Regeln sind bestätigt. Sie ergänzen
den [Datenvertrag](DATA_CONTRACT.md) und beschreiben geplantes, noch nicht
implementiertes Verhalten. Konkrete Schemas und der ergänzende
[OAuth-/CIMD-Vertrag](OAUTH_CONTRACT.md) werden vor dem Grundgerüst vervollständigt.

## Zugangswege

Produktendpunkte liegen unter `/api/v1`, MCP separat unter `/mcp`. Webapp,
HTTP-Agenten und MCP verwenden dieselben Anwendungsfälle und Fachregeln.
Benutzervorbehaltene Aktionen wie Vault-Verwaltung bleiben für Agentenzugänge
gesperrt, unabhängig vom gewählten Transport.

## Änderungen und Konflikte

HTTP-Teiländerungen verwenden `PATCH` mit einem einfachen Feldobjekt, ohne
JSON-Patch-Befehle. Ausgelassene Felder bleiben gemäß Datenvertrag unverändert.
Bearbeiten und Löschen eines Datensatzes verlangen die erwartete Revision.
Eine fehlende Revision ist ein Eingabefehler, eine veraltete ein Konflikt.
Es gibt kein automatisches Überschreiben.

## Fehler

Fachliche Fehler enthalten einen stabilen englischen Fehlercode, eine
verständliche Beschreibung und eine Anfrage-ID. Eingabefehler nennen zusätzlich
betroffene Felder. Beispiele sind `revision_conflict`, `validation_failed` und
`permission_denied`. Die Webapp übersetzt anhand der Codes, nicht anhand von
Fehlertexten. MCP bildet dieselben fachlichen Fehler in seinem Ergebnisformat ab.

Fremde und unbekannte IDs bleiben ununterscheidbar. Fehlende Schreibrechte auf
einen lesbaren Datensatz ergeben einen ausdrücklichen Berechtigungsfehler.

| HTTP-Status | Fehlercode | Bedeutung |
|---|---|---|
| 400 | `validation_failed` | Ungültige oder fehlende Angaben |
| 401 | `authentication_required` | Anmeldung fehlt oder ist ungültig |
| 403 | `permission_denied` | Aktion auf sichtbaren Daten nicht erlaubt |
| 404 | `not_found` | Unbekannt oder nicht sichtbar |
| 409 | `revision_conflict` | Datensatz inzwischen geändert |
| 409 | `idempotency_conflict` | Schlüssel für anderen Auftrag verwendet |
| 409 | `name_conflict` | Vault- oder Tag-Name bereits vergeben |
| 409 | `request_in_progress` | Identischer Auftrag läuft noch; Wiederholungshinweis |
| 410 | `cursor_expired` | Suche muss neu gestartet werden |
| 413 | `payload_too_large` | Größenlimit überschritten |
| 429 | `rate_limited` | Zu viele Anfragen |
| 503 | `temporarily_unavailable` | Dienst vorübergehend nicht verfügbar |
| 500 | `internal_error` | Unerwarteter Serverfehler |

Unerwartete Serverfehler enthalten eine Anfrage-ID, aber keine internen
technischen Details. OAuth- und MCP-Protokollfehler behalten ihre eigenen
vorgeschriebenen Formate.

## Listen und Suche

Listen und Suche liefern standardmäßig 20, maximal 100 Einträge sowie einen
Fortsetzungscursor. Der Cursor ist an Suchtext, Filter und Sortierung gebunden.
Jede Seite prüft aktuelle Rechte; Rechtefilter wirken vor Ergebnissen und
Trefferzahlen. Die festgelegten eindeutigen Sortierkriterien gelten weiterhin.

Ein Suchdurchlauf hält keinen dauerhaften Snapshot des Datenbestands fest.
Gleichzeitige Änderungen können die Trefferliste zwischen Seiten verändern.
Die konsistente Snapshot-Regel für ZIP-Exporte bleibt davon unberührt.

Cursor gelten 30 Minuten, sind zusätzlich an den Nutzer beziehungsweise
Agentenzugang gebunden und gegen Manipulation geschützt. Clients behandeln sie
als undurchsichtige Zeichenfolge. Ablauf ergibt `cursor_expired`; manipulierte
Cursor oder Verwendung mit anderen Suchparametern ergeben `validation_failed`.

Die Suche verlangt entweder genau einen Vault oder ausdrücklich alle
zugänglichen Vaults. Es gibt keinen versteckten Suchumfang aus einer Websitzung;
die UI überträgt ihre aktuelle Auswahl ausdrücklich.
Tag-Filter verwenden IDs. Die Modi „alle“ und „mindestens einer“ beziehen sich
auch bei mehreren Vaults auf diese konkreten Tags. Gleichnamige Tags anderer
Vaults werden nicht automatisch einbezogen.

## Wiederholungsschlüssel

Anlegen, Bearbeiten und Löschen unterstützen optionale Wiederholungsschlüssel
mit 24 Stunden Aufbewahrung. Der Schlüsselbereich ist der handelnde Nutzer
beziehungsweise Agentenzugang und gilt gemeinsam über HTTP und MCP hinweg.

Ein identischer Auftrag mit demselben Schlüssel führt innerhalb dieser Frist
höchstens eine Änderung aus. Abweichende Aufträge mit demselben Schlüssel
werden abgewiesen. Änderung und gespeichertes Ergebnis werden atomar
abgeschlossen, auch bei konkurrierenden Aufrufen. Wiederholungen prüfen
weiterhin aktuelle Zugangsrechte. Nach Ablauf der Frist besteht keine
Wiederholungsgarantie mehr.

HTTP überträgt den Schlüssel als `Idempotency-Key`, MCP als `idempotencyKey`.
Die CLI erzeugt ihn für Schreibaufrufe automatisch und verwendet ihn bei
technischen Wiederholungen erneut.

Der Auftragsvergleich umfasst Aktion, Ziel, erwartete Revision und übergebene
Felder. JSON-Feldreihenfolge und Tag-Reihenfolge sind irrelevant; ausgelassene
und ausdrücklich geleerte Felder bleiben unterscheidbar.

Läuft derselbe Auftrag noch, wartet der Server höchstens fünf Sekunden auf das
Ergebnis. Danach meldet er `409/request_in_progress` mit `retryAfterSeconds: 1`
und über HTTP zusätzlich `Retry-After: 1`.
Validierungsfehler und Versionskonflikte verbrauchen den Schlüssel nicht.
Erfolgreiche Änderungen und erfolgreiche unveränderte Speicherungen erhalten
ein gespeichertes Ergebnis.

Ein erfolgreicher Löschauftrag kann trotz inzwischen unsichtbarem Datensatz
wiederholt werden: Der Eintrag speichert ursprünglichen Vault und Akteur.
Replay prüft aktuelle Konto-/Zugangsgültigkeit, Scopes und erforderliche Rechte
auf diesen Vault und liefert nur das gespeicherte kompakte Schreibergebnis.
Gelöschter Vault oder entzogene Rechte verhindern Replay. Bei noch vorhandenen
Datensätzen wird zusätzlich aktuelle Sichtbarkeit geprüft, damit Verschieben
keine Daten offenlegt. Papierkorbinhalte werden nicht zugänglich gemacht.

## Technische Eingabegrenzen

Suchtext ist auf 4.096 Unicode-Codepunkte, Suchfilter auf 100 Tag-IDs begrenzt.
Pro Datensatz bleiben maximal 50 Tags erlaubt. Cursor enthalten höchstens
8.192 ASCII-Zeichen. Wiederholungsschlüssel enthalten 1 bis 128 ASCII-Zeichen
aus Buchstaben, Ziffern, `-`, `_`, `.`, `:`. Die CLI erzeugt dafür UUIDv4.
Unbekannte Eingabefelder werden abgewiesen; Clients tolerieren zusätzliche
Antwortfelder. Ungültiges Unicode und U+0000 werden semantisch abgewiesen,
nicht durch Ersatzzeichen oder Abschneiden repariert.

## Ergebnisse und MCP-Werkzeuge

JSON-Feldnamen verwenden durchgängig `camelCase`, beispielsweise `vaultId`,
`expectedRevision`, `createdAt` und `updatedAt`. IDs und Revisionen sind
Zeichenfolgen. Listen enthalten `items` und `nextCursor`; ohne Folgeseite ist
`nextCursor` gleich `null`.

Ein vollständiger Datensatz enthält ID, Vault-ID, Titel, Zusammenfassung,
Markdown, Tags, Revision und Zeitpunkte. Suchtreffer verwenden `snippet`
anstelle vollständigen Markdowns. Kompakte Datensatz-Schreibantworten enthalten
die Felder `id`, `revision` und `updatedAt`.

Die Suche liefert Metadaten und Ausschnitte. `get_memory` liefert den
vollständigen aktuellen Datensatz. Schreiboperationen an Datensätzen liefern
ID, Revision und Änderungszeitpunkt ohne vollständiges Markdown.

Beim Schreiben werden Tags anhand ihrer IDs zugeordnet. Agenten legen Tags
ausschließlich über `create_tag` mit entsprechender Berechtigung an;
Datensatz-Schreibaufrufe erstellen keine Tags implizit.

Vorgesehen sind genau diese Agentenwerkzeuge:

- `list_vaults`
- `list_tags`
- `search_memories`
- `get_memory`
- `create_memory`
- `update_memory`
- `delete_memory`
- `create_tag`

Versionswiederherstellung, Verschieben, Vault-Verwaltung, Papierkorb und
Administration erhalten keine Agentenwerkzeuge. MCP-Annotationen ersetzen
keine serverseitige Berechtigungsprüfung.

## CLI-Exitcodes

| Exitcode | Bedeutung |
|---|---|
| 0 | Erfolg |
| 1 | Sonstiger Fehler |
| 2 | Eingabe |
| 3 | Anmeldung |
| 4 | Berechtigung |
| 5 | Nicht gefunden |
| 6 | Konflikt |
| 7 | Rate-Limit |
| 8 | Netzwerk oder vorübergehende Nichtverfügbarkeit |

Die JSON-Fehlerausgabe enthält zusätzlich den genauen Fehlercode, damit
Skripte keine sprachabhängigen Meldungen auswerten müssen.

## Noch zu vervollständigen

Die [maschinelle Vertragsausarbeitung](docs/contracts/README.md) enthält
OpenAPI für die acht Agentenoperationen, MCP-Ein-/Ausgabeschemas und gemeinsame
Datentypen. Das Web-/Admin-Inventar ist angelegt; vollständige Schemas dafür
stehen noch aus. Die fünf ergänzenden Randfallentscheidungen sind bestätigt.

Vor dem Grundgerüst folgen vollständige maschinenlesbare Request-/Response-
Schemas und die technische Umsetzung der festgelegten Cursor- und
Wiederholungsregeln mit den festgelegten Grenzen. OAuth-/CIMD-Endpunkte
folgen dem eigenen [Protokollvertrag](OAUTH_CONTRACT.md); ihre Protokollfehler
folgen nicht pauschal dem Produktformat.
