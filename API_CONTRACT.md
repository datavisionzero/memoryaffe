# Schnittstellenvertrag

Stand: 13. November 2026. Die folgenden Regeln sind bestätigt. Sie ergänzen
den [Datenvertrag](DATA_CONTRACT.md) und beschreiben geplantes, noch nicht
implementiertes Verhalten. Konkrete Schemas und der OAuth-/CIMD-Vertrag werden
vor dem Grundgerüst vervollständigt.

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

## Listen und Suche

Listen und Suche liefern standardmäßig 20, maximal 100 Einträge sowie einen
Fortsetzungscursor. Der Cursor ist an Suchtext, Filter und Sortierung gebunden.
Jede Seite prüft aktuelle Rechte; Rechtefilter wirken vor Ergebnissen und
Trefferzahlen. Die festgelegten eindeutigen Sortierkriterien gelten weiterhin.

Ein Suchdurchlauf hält keinen dauerhaften Snapshot des Datenbestands fest.
Gleichzeitige Änderungen können die Trefferliste zwischen Seiten verändern.
Die konsistente Snapshot-Regel für ZIP-Exporte bleibt davon unberührt.

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

Die transportübergreifende Darstellung des Schlüssels, die genaue
Auftragsvergleichsregel und Antworten bei noch laufenden Aufträgen werden im
folgenden Schemablock konkretisiert.

## Ergebnisse und MCP-Werkzeuge

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

## Noch zu vervollständigen

Vor dem Grundgerüst folgen konkrete Request-/Response-Schemas, HTTP-Status-
und Fehlercodes, Cursorformat und -gültigkeit, Wiederholungsdetails sowie die
Abbildung auf CLI-Exitcodes. OAuth-/CIMD-Endpunkte erhalten einen eigenen
Protokollvertrag; ihre Protokollfehler folgen nicht pauschal dem Produktformat.
