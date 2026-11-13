# Maschinenlesbare Verträge

Stand: 13. November 2026. Planungsartefakte, keine Serverimplementierung.
Bestätigte Fachregeln stehen in [API_CONTRACT.md](../../API_CONTRACT.md),
[DATA_CONTRACT.md](../../DATA_CONTRACT.md) und
[OAUTH_CONTRACT.md](../../OAUTH_CONTRACT.md).

## Umfang und Status

| Datei | Inhalt |
|---|---|
| `models.schema.json` | Gemeinsame Datentypen und Agentenaufträge |
| `agent.openapi.json` | Acht HTTP-Operationen für den CLI-Agentenzugang, OpenAPI 3.1.1 |
| `mcp-tools.json` | Dieselben acht Fachoperationen mit eigenständigen Ein-/Ausgabeschemas |
| `vault-manifest.schema.json` | Vault-Exportformat 1, JSON Schema 2020-12 |
| `manifest.example.json` | Gültiges Manifest mit einem Datensatz, kein vollständiges ZIP |

Dies ist der ausgearbeitete **Agenten-Datenvertrag**, nicht die vollständige
Web-/Admin-API. Die noch ausstehenden Bereiche sind unten ausdrücklich benannt.
Feldnamen und Routen konkretisieren bestätigte Regeln. Die fünf ergänzenden
[Randfallentscheidungen](DECISIONS.md) sind ebenfalls bestätigt.

## HTTP-Abbildung

| MCP-Tool / operationId | HTTP | Eingabe |
|---|---|---|
| `list_vaults` | GET `/api/v1/vaults` | Optionale Seitengröße und Cursor als Query |
| `list_tags` | GET `/api/v1/vaults/{vaultId}/tags` | Vault im Pfad, Pagination als Query |
| `search_memories` | POST `/api/v1/memories/search` | Expliziter Suchumfang und Filter als JSON |
| `get_memory` | GET `/api/v1/memories/{id}` | ID im Pfad |
| `create_memory` | POST `/api/v1/memories` | Vault und Inhalte als JSON |
| `update_memory` | PATCH `/api/v1/memories/{id}` | ID im Pfad, erwartete Revision und Änderungen als JSON |
| `delete_memory` | DELETE `/api/v1/memories/{id}` | ID im Pfad, `expectedRevision` als Query |
| `create_tag` | POST `/api/v1/vaults/{vaultId}/tags` | Vault im Pfad, Name als JSON |

Die Suche verwendet POST, bleibt fachlich lesend und verwendet keinen
Wiederholungsschlüssel. Dadurch stehen Suchtext und Filter nicht im URL-Pfad
oder Query-String. Auch Request-Bodies dürfen nicht mit privaten Inhalten
protokolliert werden. DELETE verwendet keinen Request-Body.
Erstellung liefert 201, andere erfolgreiche Operationen 200 mit JSON.
`create_tag` liefert den Tag mit `id` und `name`, keine Datensatzrevision.

HTTP verwendet den Header `Idempotency-Key`, MCP das Feld `idempotencyKey`.
Transportdaten werden vor dem fachlichen Auftragsvergleich entfernt; Pfad-,
Query- und JSON-Daten ergeben denselben logischen Auftrag. Bearbeiten ohne
Inhaltsfelder ist derzeit strukturell möglich und fällt unter die bestätigte
Regel für unverändertes Speichern; die erwartete Revision ist dennoch Pflicht.
Bei Erstellung bedeuten ausgelassene Zusammenfassung/Tags `null`/leere Menge;
bei Bearbeitung bedeuten ausgelassene Felder unverändert.

MCP liefert erfolgreiche Daten gemäß `outputSchema` als `structuredContent`
und zusätzlich als serialisiertes JSON in einem Text-Contentblock. Fachliche
Fehler werden mit `isError: true` und dem Fehlerobjekt im Text-Contentblock
zurückgegeben, nicht als erfolgreicher Datensatz. Protokollfehler bleiben
Protokollfehler. Die Clientkompatibilität dieser Abbildung ist noch praktisch
zu prüfen. MCP-Annotationen sind Hinweise, keine Berechtigungen; Schreibtools
werden wegen optionaler Wiederholungsschlüssel nicht pauschal als idempotent
ausgewiesen.

## Zusätzliche semantische Prüfung

JSON Schema allein ersetzt keine Anwendungsvalidierung. Verpflichtend bleiben:

- Titel nach Trimming nicht leer, Namen normalisiert/eindeutig; Unicode-Version
  und genaue White-Space-Regel werden noch festgelegt.
- Markdown maximal 1.048.576 UTF-8-Bytes; keine Änderung von Zeilenumbrüchen.
- Ungültiges Unicode, isolierte Surrogate und U+0000 abweisen, nicht ersetzen.
  Das ist zusätzliche semantische Validierung, noch kein implementierter Test
  der Anwendung. Clients tolerieren additive Antwortfelder; Eingaben bleiben strikt.
- UUIDs vor Mengen-/Identitätsvergleichen kanonisieren, damit unterschiedliche
  Großschreibung derselben ID keine doppelten Tags zulässt.
- Jeder Tag gehört zum Ziel-Vault; IDs, Rechte und Revisionen werden serverseitig
  geprüft. Suchfilter über mehrere Vaults erzeugen keine Namenszuordnung.
- Ausgabefelder erfüllen dieselben Inhaltslimits; eine leere Zusammenfassung
  wird als `null` ausgegeben, obwohl das gemeinsame Eingabeschema auch `""` erlaubt.
- Sortierung, Volltextsyntax, Cursorbindung und -ablauf sowie Snapshot-Konsistenz
  richten sich nach den Fachverträgen.
- Manifest-IDs sind innerhalb der jeweiligen Entitätsliste eindeutig, Tag-
  Verweise gültig, Namen normalisiert eindeutig; Zeitpunkte sind gültige Daten.
- Im ZIP existiert genau `manifest.json` plus je Datensatz
  `records/<id>.md`. Keine zusätzlichen Dateien, doppelten ZIP-Einträge,
  Pfadtraversierung, absoluten Pfade oder symbolischen Links. Dateien werden
  strikt als UTF-8 gelesen, nicht mit Ersatzzeichen repariert.
- Import prüft komprimierte und tatsächlich entpackte Größe sowie Anzahl,
  bevor atomar Daten übernommen werden. Die 10.000-Datensatz-Importgrenze ist
  absichtlich keine `maxItems`-Grenze des Exportformats: größere Exporte sind erlaubt.

## Reproduzierbare Prüfung

`node docs/contracts/build.mjs` erzeugt die JSON-Artefakte deterministisch.
Der Generator ist Planungswerkzeug, keine zusätzliche Produkt-Toolchain. Sobald
die Backend-API besteht, übernimmt deren vereinbarter OpenAPI-Export die
Quelle; ein Vertragsvergleich muss Abweichungen sichtbar machen.

Zur Prüfung werden ausschließlich außerhalb des Repositorys installierte
Werkzeuge verwendet: `ajv@8.20.0`, `ajv-formats@3.0.1` und
`@apidevtools/swagger-parser@13.1.0`. Installation beispielsweise mit
`npm install --prefix <tool-directory> --ignore-scripts --no-audit --no-fund`
und diesen drei exakten Paketangaben. Danach:

```text
node docs/contracts/check.mjs <absolute-tool-directory>
```

Die Prüfung kompiliert die MCP-Schemas, prüft positive und negative Beispiele,
lokale Referenzen und das OpenAPI-Dokument. Sie bestätigt keine implementierten
Berechtigungen, Byte-Limits, ZIP-Sicherheit oder echte Clientkompatibilität.

## Noch ausstehende Vertragsbereiche

1. [Web-/Admin-Endpunktinventar](WEB_ENDPOINTS.md) mit vollständigen Schemas für Konten, Sitzungen, 2FA,
   Einladungen, Wiederherstellung, Vault-Verwaltung, Historie/Papierkorb,
   Agenten-/Tokenverwaltung, Import/Export und Diagnose.
2. OAuth-Endpunktparameter, Discovery-Dokumente und Fehler-/Challenge-Matrix;
   CIMD-Methodenauswahl anhand des realen ChatGPT-Dokuments.
3. Suchkorpus/SQL-Abbildung, genaue Unicode-Normalisierung und White-Space-Tabelle.
4. Verbleibende Betriebsgrenzen für Authentifizierungs-Ratelimits und
   Import-/Exportressourcen. Suchtext-, Cursor-, Schlüsselgrenzen und
   Wiederholungswartezeit sind entschieden und in den Verträgen festgehalten.
5. Paket-/Lizenzmatrix, Zielplattformprüfungen und realer ChatGPT-Versuch.

Die fünf ergänzenden fachlichen Entscheidungen stehen in [DECISIONS.md](DECISIONS.md).
Die oben noch ausstehenden Bereiche bleiben Voraussetzungen vor dem Grundgerüst.

## Primärquellen

- [OpenAPI 3.1.1](https://spec.openapis.org/oas/v3.1.1.html)
- [JSON Schema Validation 2020-12](https://json-schema.org/draft/2020-12/json-schema-validation)
- [MCP Tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)

Diese Formatgrundlagen sind von der noch festzulegenden MCP-SDK-/Protokollversion
und deren realer ChatGPT-Abnahme zu unterscheiden.
