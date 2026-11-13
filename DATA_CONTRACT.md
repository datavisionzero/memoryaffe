# Datenvertrag

Stand: 13. November 2026. Die folgenden Regeln sind bestätigt und gelten
gemeinsam für Backend, Webapp, CLI, MCP und Datenexport. Sie beschreiben die
geplante Anwendung, keine bereits implementierten Funktionen.

## Identitäten

Konten, Vaults, Datensätze, Tags und Agentenzugänge erhalten serverseitig
erzeugte UUIDv4-IDs. Namen und Titel sind keine technischen Identitäten.
Umbenennen, Bearbeiten und Verschieben erhalten die ID. Beim Import entstehen
neue IDs; sämtliche enthaltenen Verweise werden auf diese neuen IDs abgebildet.

## Revisionen und Inhaltsversionen

Neue Datensätze beginnen bei Revision 1. Revisionen steigen je Datensatz
atomar und werden in Schnittstellen als dezimale Zeichenfolge übertragen,
beispielsweise `"revision": "12"`.

Inhaltsänderungen erhöhen die Revision und erzeugen historische Snapshots
gemäß dem Aufbewahrungslimit. Verschieben, Löschen und Wiederherstellen aus
dem Papierkorb erhöhen ebenfalls die Revision, benötigen aber keinen
zusätzlichen identischen Inhaltssnapshot. Historische Inhaltsversionen und
Revisionen sind deshalb nicht gleichzusetzen; die Historie muss nicht jede
Revisionsnummer enthalten.

Speichern ohne tatsächliche Änderung verändert weder Revision noch
Änderungszeitpunkt. Wiederherstellung einer alten Inhaltsfassung setzt die
Revision niemals zurück; eine tatsächliche Inhaltsänderung erhält eine neue
Revision. Konfliktprüfung verwendet Revisionen, nicht Zeitstempel, und erkennt
dadurch auch zwischenzeitliches Verschieben.

## Zeichen, Namen und Texttreue

Zeichenlimits zählen Unicode-Codepunkte, nicht Bytes oder UTF-16-Codeeinheiten.
Zusammengesetzte Emojis können mehrere Codepunkte zählen. Webapp und Server
verwenden dieselbe Zählregel. Für Markdown gilt zusätzlich die beschlossene
Grenze von 1.048.576 UTF-8-Bytes.

Vault- und Tag-Namen werden außen getrimmt und auf NFC normalisiert.
Eindeutigkeit wird mit sprachunabhängigem Unicode-Casefolding geprüft;
Anzeigenamen behalten ihre Schreibweise. Akzente werden nicht entfernt.
`Projekt` und `projekt` sind gleich, ebenso `Straße` und `STRASSE`;
`für` und `fur` sind verschieden. Die dafür verwendete Unicode-Version und
die genaue technische Abbildung werden vor dem Grundgerüst fixiert und dürfen
bei Updates die Eindeutigkeit nicht unbemerkt verändern.

Titel werden außen getrimmt. Markdown und Zusammenfassungen werden nicht
automatisch umformatiert. Insbesondere bleiben Markdown-Zeilenumbrüche
unverändert; Größenprüfung und Export verwenden die UTF-8-Darstellung dieses
Inhalts. Passwörter werden weder getrimmt noch normalisiert.
Ungültiges Unicode einschließlich isolierter Surrogate sowie U+0000 werden
abgewiesen, nicht ersetzt oder abgeschnitten. Texttreue gilt für akzeptierte
Eingaben; diese semantische Prüfung ergänzt die JSON-Schemas.

## Tags und Papierkorb

Tag-Umbenennung, Zusammenführung und vollständige Löschung ändern auch aktuelle
Zuordnungen von Datensätzen im Papierkorb desselben aktiven Vaults. Dabei gelten
dieselben Revisions- und Inhaltsversionsregeln wie für aktive Datensätze.
Löschfristen und alte Snapshots bleiben unverändert. Vaults im Papierkorb sind
nicht bearbeitbar. Historische Inhaltswiederherstellung setzt einen aktiven
Datensatz voraus; gegebenenfalls muss zuerst aus dem Papierkorb wiederhergestellt
werden.

## Leere Werte und Teiländerungen

| Feld | Regel |
|---|---|
| Titel | Erforderlich, nach Trimming nicht leer; `null` ist ungültig |
| Markdown | Erforderlich, leere Zeichenfolge erlaubt; `null` ist ungültig |
| Zusammenfassung | Optional; `null` und leere Zeichenfolge werden als `null` gespeichert |
| Tags | Ungeordnete Menge; doppelte Tag-IDs werden abgewiesen |

Bei Teiländerungen bleibt jedes ausgelassene Feld unverändert.
`summary: null` entfernt die Zusammenfassung, `tags: []` entfernt alle
Tag-Zuordnungen. Die bestehenden Größen- und Berechtigungsregeln gelten weiter.

## Zeitpunkte

Schnittstellen und Export verwenden UTC mit Millisekunden im Format
`2026-11-13T14:25:30.123Z`. Die UI zeigt Zeitpunkte in der lokalen Zeitzone.
Erstellung, Änderung, Löschung und Ablauf werden vom Server datiert.
Beim Import werden ursprüngliche Erstellungs- und Änderungszeitpunkte
übernommen; Importzeitpunkt und importierendes Konto werden separat erfasst.

## Vault-Archiv, Formatversion 1

Das ZIP enthält `manifest.json` und pro Datensatz genau eine Datei
`records/<ursprüngliche-id>.md`. Alle Textdateien verwenden UTF-8.
Markdown steht ausschließlich in diesen Dateien, ohne hinzugefügtes Frontmatter.

Das Manifest enthält:

- `formatVersion: 1` und den Exportzeitpunkt;
- Vault-Einstellungen einschließlich Name, Suchsprache und Versionslimit;
- sämtliche vorhandenen Vault-Tags mit IDs und Namen;
- je Datensatz ID, Titel, optionale Zusammenfassung, Tag-Verweise sowie
  ursprünglichen Erstellungs- und Änderungszeitpunkt.

Jeder Datensatzeintrag hat genau eine passende Markdown-Datei. Unbekannte
Formatversionen, doppelte IDs, ungültige Tag-Verweise sowie fehlende oder
unerwartete Dateien führen zur vollständigen Ablehnung. Die bereits
beschlossenen Größen-, Pfad- und Schema-Prüfungen gelten zusätzlich.

Konten, Zugangsdaten, historische Agentenidentitäten, Inhaltsversionen und
Papierkorbinhalte sind nicht enthalten. Export bleibt ein konsistenter Snapshot.
Import erzeugt einen neuen Vault ohne Agentenrechte und Datensätze mit neuen
IDs, jeweils Revision 1 und ohne importierte Historie.

Das [maschinenlesbare Manifest-Schema](docs/contracts/vault-manifest.schema.json)
legt Feldnamen und Pflichtfelder fest. Zusätzliche semantische ZIP-, Referenz-
und Größenprüfungen sind in der [Vertragsausarbeitung](docs/contracts/README.md)
beschrieben; ihre Implementierung steht noch aus.
Die bestehenden Importgrenzen und Hinweise für größere Exporte bleiben gültig.
