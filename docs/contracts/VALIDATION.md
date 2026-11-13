# Prüfprotokoll der Planungsübergabe

Datum: 13. November 2026. Geprüft wurden Planungsartefakte, keine Anwendung.

## Ausgeführt

- Drei OpenAPI3.1.1-Dokumente validiert: acht Agenten-, 74 Browser-/Admin- und
  fünf OAuth-Operationen. Acht MCP-Ein-/Ausgabeschemas kompiliert.
- 94 positive/negative Schemafälle, einschließlich Limits, unbekannter
  Produkteingaben, Revisionen, Faktorformen, Grants, typisierter Aktionsnachweise,
  Importauftrag, OAuth-Code-/Refresh-Requests und Consent.
- Browseroperationen auf Cookie-/CSRF-Abbildung und administrative Scopes geprüft.
- Offline-Neugenerierung aller Vertragsartefakte per SHA256-Vergleich als
  deterministisch geprüft; 77 lokale Dokumentationslinks und Git-Diff geprüft.
- TypeScript-Typgenerierung aus allen drei OpenAPI-Dokumenten mit
  openapi-typescript7.13.0; erzeugte Deklarationen mit TypeScript5.9.3 unter
  `--noEmit --strict --target ES2022 --moduleResolution node` erfolgreich geprüft.
  Dateien liegen nur im externen Prüfverzeichnis, kein Produktgerüst erzeugt.
- 29 direkte Paketversionen/Lizenz-/Framework-/Peer-Metadaten aus npm/NuGet
  erfasst. 22 Frontendpakete gemeinsam per npm package-lock-only/ignore-scripts
  aufgelöst. Ältere lokale Nodeversion meldete Engine-Warnungen; Zielversion
  erfüllt die betroffenen Anforderungen. Kein Build oder Paketcode ausgeführt.
- ChatGPT-CIMD-Dokument und offizielle Auth-Dokumentation gelesen; Client-ID,
  Redirect und angebotene none-Methode stimmen mit geplanter Integration überein.

## Ausdrücklich nicht als bestanden behauptet

- Kein echter ChatGPT-/Claude-Verbindungstest.
- Kein Backend-/Frontend-/Go-Produktbuild und keine laufende Webapp.
- Keine PostgreSQL-Suchkorpus-, Race-, Auth-, ZIP- oder Backup/Restore-Ausführung.
- Kein vollständiger transitiver Lizenz-/Vulnerability-Audit, kein Plattformrelease.

Diese Punkte sind im Agentenauftrag als konkrete Implementierungs-/Abnahmeaufgaben
zugeordnet. Der Nutzer hat den echten ChatGPT-Test nach hinten verschoben.

## Reproduktion

Werkzeuge außerhalb des Repositorys installieren:

```text
npm install --prefix <tool-dir> --ignore-scripts --no-audit --no-fund ajv@8.20.0 ajv-formats@3.0.1 @apidevtools/swagger-parser@13.1.0 openapi-typescript@7.13.0 typescript@5.9.3
node docs/contracts/build-all.mjs
node docs/contracts/check.mjs <absolute-tool-dir>
```

Für die Typprüfung je OpenAPI-Dokument die openapi-typescript-CLI aus dem
Toolverzeichnis mit `--output <temp>/<name>.generated.d.ts` aufrufen, anschließend
alle drei Dateien mit den oben genannten tsc-Flags prüfen. Reproduzierbare
Generierung darf keine inhaltlichen Änderungen der eingecheckten Artefakte ergeben.
