# Gebündelte Entscheidungen aus der Vertragsausarbeitung

Stand: 13. November 2026. **Vorschläge, noch nicht bestätigt.** Diese Regeln
werden nicht allein durch dieses Dokument zu Implementierungsvorgaben.

## 1. Wiederholung eines erfolgreichen Löschens

Problem: Die erste Löschung macht den Datensatz für Agenten unsichtbar. Eine
identische technische Wiederholung soll dennoch das gespeicherte Ergebnis
liefern können, ohne den Papierkorb als Agenten-Lesezugriff zu öffnen.

Empfehlung: Den ursprünglichen Vault und Akteur im Wiederholungseintrag
speichern. Bei Wiederholung aktuelle Konto-/Zugangsgültigkeit, Scopes und
erforderliche Rechte auf diesen Vault prüfen, dann ausschließlich das kompakte
gespeicherte Schreibergebnis liefern. Keine Papierkorbinhalte ausgeben.
Bei inzwischen gelöschtem Vault oder entzogenen Rechten kein Replay-Ergebnis.
Bei noch vorhandenen Datensätzen zusätzlich deren aktuelle Sichtbarkeit
prüfen, damit zwischenzeitliches Verschieben keine Daten offenlegt.

## 2. CIMD-Cache bei bestehenden Verbindungen

Problem: Bestätigt ist, dass neue Verbindungen nach Cache-Ablauf keine alten
Metadaten verwenden. Das Verhalten bei Token-Erneuerung ist noch nicht explizit.

Empfehlung: Refresh benötigt gültige gecachte oder erfolgreich neu geladene
Metadaten. Ein vorübergehender Abruffehler lehnt den Refresh vorübergehend ab,
verbraucht dabei aber das Refresh-Token nicht. Bereits ausgegebene Access-Tokens
gelten bis zu ihrem normalen Ablauf weiter, sofern Konto, Freigabeliste und
Vault-Rechte weiterhin passen. Entfernen des Clients aus der lokalen
Freigabeliste bleibt ausdrücklich sofort wirksam.

## 3. Grenzen für technische Eingaben und Wiederholungswartezeit

Empfehlung für die ersten konkreten Werte:

| Wert | Empfehlung |
|---|---|
| Suchtext | Maximal 4.096 Unicode-Codepunkte |
| Such-Tag-Filter | Maximal 100 IDs; weiterhin höchstens 50 Tags pro Datensatz |
| Wiederholungsschlüssel | 1 bis 128 ASCII-Zeichen aus Buchstaben, Ziffern, `-`, `_`, `.`, `:` |
| Cursor | Maximal 8.192 ASCII-Zeichen |
| Warten auf identischen laufenden Auftrag | Maximal fünf Sekunden |
| Wiederholungshinweis bei laufendem Auftrag | Eine Sekunde, über HTTP `Retry-After` und fachlich `retryAfterSeconds` |

CLI verwendet zufällige UUIDv4 als Wiederholungsschlüssel. Diese Obergrenzen
werden nach Bestätigung in Schemas ergänzt. Authentifizierungs-Ratelimits und
Ressourcenbegrenzung für Import/Export benötigen eine eigene Betriebsmatrix.

## 4. Tag-Verwaltung und Papierkorb

Problem: Datensätze im Papierkorb können aktuelle Tag-Zuordnungen enthalten.
Die bestehenden Regeln sagen noch nicht ausdrücklich, ob Tag-Umbenennung,
Zusammenführung und vollständige Löschung auch diese Zuordnungen aktualisieren.

Empfehlung: Diese Aktionen gelten auch für aktuelle Zuordnungen von Datensätzen
im Papierkorb desselben aktiven Vaults, mit Revision und Inhaltsversion nach
derselben Regel wie bei aktiven Datensätzen. Löschfristen bleiben unverändert;
alte Snapshots bleiben unverändert. Vaults im Papierkorb sind insgesamt nicht
bearbeitbar. Historische Inhaltswiederherstellung setzt einen aktiven Datensatz
voraus; gegebenenfalls zuerst aus dem Papierkorb wiederherstellen.

## 5. Strikte Eingaben und Grenzen der Formatvalidierung

Die ausgearbeiteten Schemas schlagen vor, unbekannte Eingabefelder abzulehnen
(`additionalProperties: false`), damit Tippfehler nicht unbemerkt wirkungslos
bleiben. Diese technische Konvention ist noch ausdrücklich zu bestätigen.
Unbekannte Ausgabefelder sollten Clients dagegen für spätere additive
Erweiterungen tolerieren; das veröffentlichte Serverschema beschreibt jeweils
die aktuell bekannten Felder.

Ungültiges Unicode (einschließlich isolierter Surrogate und U+0000) sollte mit
Eingabefehler abgelehnt werden statt durch Ersatzzeichen oder Abschneiden in
die PostgreSQL-Texte zu gelangen. Texttreue gilt für akzeptierte Eingaben.
Dies wird nach Bestätigung als zusätzliche semantische Validierung festgehalten.
