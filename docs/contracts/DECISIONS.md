# Gebündelte Entscheidungen aus der Vertragsausarbeitung

Stand: 13. November 2026. **Alle fünf Entscheidungen sind bestätigt.**
Dieses Dokument hält die bei der Vertragsausarbeitung geklärten Randfälle fest.

## 1. Wiederholung eines erfolgreichen Löschens

Problem: Die erste Löschung macht den Datensatz für Agenten unsichtbar. Eine
identische technische Wiederholung soll dennoch das gespeicherte Ergebnis
liefern können, ohne den Papierkorb als Agenten-Lesezugriff zu öffnen.

Festlegung: Den ursprünglichen Vault und Akteur im Wiederholungseintrag
speichern. Bei Wiederholung aktuelle Konto-/Zugangsgültigkeit, Scopes und
erforderliche Rechte auf diesen Vault prüfen, dann ausschließlich das kompakte
gespeicherte Schreibergebnis liefern. Keine Papierkorbinhalte ausgeben.
Bei inzwischen gelöschtem Vault oder entzogenen Rechten kein Replay-Ergebnis.
Bei noch vorhandenen Datensätzen zusätzlich deren aktuelle Sichtbarkeit
prüfen, damit zwischenzeitliches Verschieben keine Daten offenlegt.

## 2. CIMD-Cache bei bestehenden Verbindungen

Ausgangsfrage: Wie wirkt ein abgelaufener CIMD-Cache auf bestehende Verbindungen?

Festlegung: Refresh benötigt gültige gecachte oder erfolgreich neu geladene
Metadaten. Ein vorübergehender Abruffehler lehnt den Refresh vorübergehend ab,
verbraucht dabei aber das Refresh-Token nicht. Bereits ausgegebene Access-Tokens
gelten bis zu ihrem normalen Ablauf weiter, sofern Konto, Freigabeliste und
Vault-Rechte weiterhin passen. Entfernen des Clients aus der lokalen
Freigabeliste bleibt ausdrücklich sofort wirksam.

## 3. Grenzen für technische Eingaben und Wiederholungswartezeit

Verbindliche Werte:

| Wert | Festlegung |
|---|---|
| Suchtext | Maximal 4.096 Unicode-Codepunkte |
| Such-Tag-Filter | Maximal 100 IDs; weiterhin höchstens 50 Tags pro Datensatz |
| Wiederholungsschlüssel | 1 bis 128 ASCII-Zeichen aus Buchstaben, Ziffern, `-`, `_`, `.`, `:` |
| Cursor | Maximal 8.192 ASCII-Zeichen |
| Warten auf identischen laufenden Auftrag | Maximal fünf Sekunden |
| Wiederholungshinweis bei laufendem Auftrag | Eine Sekunde, über HTTP `Retry-After` und fachlich `retryAfterSeconds` |

CLI verwendet zufällige UUIDv4 als Wiederholungsschlüssel. Diese Obergrenzen
sind in den Schemas ergänzt. Authentifizierungs-Ratelimits und
Ressourcenbegrenzung für Import/Export benötigen eine eigene Betriebsmatrix.

## 4. Tag-Verwaltung und Papierkorb

Problem: Datensätze im Papierkorb können aktuelle Tag-Zuordnungen enthalten.
Die bestehenden Regeln sagen noch nicht ausdrücklich, ob Tag-Umbenennung,
Zusammenführung und vollständige Löschung auch diese Zuordnungen aktualisieren.

Festlegung: Diese Aktionen gelten auch für aktuelle Zuordnungen von Datensätzen
im Papierkorb desselben aktiven Vaults, mit Revision und Inhaltsversion nach
derselben Regel wie bei aktiven Datensätzen. Löschfristen bleiben unverändert;
alte Snapshots bleiben unverändert. Vaults im Papierkorb sind insgesamt nicht
bearbeitbar. Historische Inhaltswiederherstellung setzt einen aktiven Datensatz
voraus; gegebenenfalls zuerst aus dem Papierkorb wiederherstellen.

## 5. Strikte Eingaben und Grenzen der Formatvalidierung

Die Schemas lehnen unbekannte Eingabefelder ab
(`additionalProperties: false`), damit Tippfehler nicht unbemerkt wirkungslos
bleiben. Clients müssen unbekannte Ausgabefelder für spätere additive
Erweiterungen tolerieren; das veröffentlichte Serverschema beschreibt jeweils
die aktuell bekannten Felder.

Ungültiges Unicode (einschließlich isolierter Surrogate) und U+0000 werden mit
Eingabefehler abgelehnt statt durch Ersatzzeichen oder Abschneiden in
die PostgreSQL-Texte zu gelangen. Texttreue gilt für akzeptierte Eingaben.
Dies ist zusätzliche semantische Validierung und noch keine implementierte
Anwendungsprüfung. JSON-Schemas allein ersetzen diese Prüfung nicht.
