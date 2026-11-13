# Namensvergleich und Suchabbildung

Stand 13. November 2026. Technische Konkretisierung der bestehenden Fachregeln.
Implementierung und PostgreSQL-Ausführung des Korpus sind noch ausstehend.

## Namen: explizite Unicode-Regeln

Unicode **17.0.0** ist die feste Datenbasis. Anzeigename = NFC(trim(input)).
Vergleichsschlüssel = NFC(Default Full Case Folding(Anzeigename)); C- und
F-Mappings aus CaseFolding.txt, keine Turkic-T-Mappings. Akzente bleiben erhalten.
Unbekannte, nicht zugewiesene gültige Unicode-Skalare bleiben unverändert;
Surrogate und U+0000 werden abgewiesen. Keine NFKC-Kompatibilitätsnormalisierung.

Trimming verwendet exakt Unicode17 White_Space:
U+0009–000D, U+0020, U+0085, U+00A0, U+1680, U+2000–200A, U+2028,
U+2029, U+202F, U+205F, U+3000. U+200B und U+FEFF sind keine Trimzeichen.
Titel verwenden nur dieses Trimming, kein Casefolding/NFC-Zwang. Erst danach
Längenlimit prüfen. Namen zusätzlich nach NFC zählen. Markdown, Zusammenfassung
und Passwort bleiben von diesen Umformungen ausgenommen.

Backend ist maßgeblich; Frontend zeigt dieselben Grenzen, entscheidet aber nicht
über Eindeutigkeit. Persistierte nameKey-Spalten mit binärem ordinalem Vergleich,
keine sprachabhängigen DB-Collations/CITEXT als Ersatz. Eindeutiger Index
(ownerId,nameKey) für Vaults einschließlich Papierkorb, (vaultId,nameKey) für
Tags. Namenlimits gelten für Anzeigenamen, nicht den eventuell längeren Schlüssel.
Runtime-ToLowerInvariant ist kein Ersatz für Full Case Folding.

Beim Bootstrap Unicode-Datendateien aus den unten verlinkten versionierten
Quellen mit SHA256 und Unicode-Lizenz aufnehmen; Normalisierung muss gegen
NormalizationTest.txt17 geprüft werden. Runtime-NFC darf nur verwendet werden,
wenn die gebaute Linux-Runtime diese festgelegte Version/Tests erfüllt; andernfalls
versionierte Normalisierungsdaten verwenden. OS-Upgrades dürfen nameKey nicht
still ändern. Spätere Unicode-Upgrades benötigen explizite Kollisionsmigration.

Pflichtfixtures:

| Eingaben | Ergebnis |
|---|---|
| ` Projekt ` / `projekt` | gleicher Schlüssel |
| `Straße` / `STRASSE` | gleicher Schlüssel |
| `Café` / `Cafe` + U+0301 | gleicher Schlüssel |
| `für` / `fur` | verschiedene Schlüssel |
| `Σ` / `σ` / `ς` | gleicher Schlüssel |
| `İ` / `i` | verschiedene Schlüssel (erstes faltet zu i + combining dot) |
| `I` / `ı` | verschiedene Schlüssel |
| NBSP + `Name` + NBSP | Anzeigename `Name` |
| U+200B + `Name` | U+200B bleibt |
| nur White_Space | ungültiger Name/Titel |
| isoliertes Surrogat / U+0000 | Validierungsfehler |

## Suchsprache und Auswertung

PostgreSQL18.7: neutral→pg_catalog.simple, de→pg_catalog.german,
en→pg_catalog.english. Konfiguration ausdrücklich übergeben, nie Serverdefault.
Kein unaccent, kein Vektor-/Embedding-Dienst, keine Synonym-/Fuzzy-Erweiterung.
Indexiert werden Titel, Zusammenfassung und unveränderter Markdown-Quelltext.
Markdown-Syntax kann daher Wörter beitragen; Darstellung bleibt sicherer Text.

Querysyntax folgt `websearch_to_tsquery`: AND implizit, OR-Alternativen,
Minus-Ausschluss, doppelte Anführungszeichen für Wortgruppen, keine eigene
SQL-/tsquery-Syntax. Anführungszeichen/Punktuation werden wie PostgreSQL-Websearch
behandelt; niemals ungeprüft in to_tsquery/SQL interpolieren. SQL ist parametrisiert.
Leere/Whitespace-Query = zuletzt geändert. Nichtleere Query, die durch Stopwörter
keine Lexeme mehr enthält, liefert null Treffer, nicht sämtliche Inhalte.
Reine Ausschlüsse bleiben erlaubt und unterliegen Suchtimeout/Rechtefilter.

Normale UND-Begriffe dürfen über Inhaltsfelder verteilt sein. Eine Wortgruppe
muss innerhalb eines Felds stehen; Ende des Titels und Anfang der Zusammenfassung
bilden keine künstliche Phrase. Bei mehreren Vaults erfolgt Auswertung mit der
aktiven Sprache jedes Vaults. Kein Übersetzen der Query und kein Tag-Namensmapping.

Relevanz: positive Titel-Treffer Gewicht1.0, Zusammenfassung0.4, Markdown0.1;
normierter Rang, dann updatedAt absteigend, dann UUID aufsteigend. Ausschlüsse
erhöhen den Rang nicht. Alternate sort updatedAt verwendet dieselben letzten
beiden Kriterien. Rankingwerte dürfen nicht zwischen zwei Seiten durch
unterschiedliche Rundung neu interpretiert werden: vollständigen Sortierschlüssel
im signierten Cursor führen. Keine Leistungszusage aus dieser Festlegung ableiten.

## Index, große Inhalte und Sprachwechsel

GIN für lexikalische Kandidatensuche, Eigentümer/Vault/Löschzustand vor Ergebnis,
Snippet und Pagination filtern. AND über Felder und Phrasenbegrenzung müssen in
SQL/Query-Auswertung ausdrücklich berücksichtigt werden; drei unabhängige
`field @@ fullQuery` mit OR würden das vereinbarte feldübergreifende AND verletzen.

PostgreSQL begrenzt tsvector-Größe, Positionswerte und Positionen pro Lexem.
Deshalb darf der Agent nicht einfach jeden erlaubten 1-MiB-Inhalt in genau einen
positionsbehafteten tsvector pressen. Index in begrenzte Feldsegmente zerlegen;
globale Feldpositionen für Phraseprüfung erhalten. Kandidatensuche per GIN und
exakte Prüfung der Querylogik gegen vollständige normalisierte Tokenpositionen
trennen. Segmentgrenzen dürfen weder AND noch Phrasen verlieren; keine Änderung
oder Kürzung des gespeicherten Markdowns. SQL-native Tokenisierung/Wörterbücher
verwenden, keinen zweiten inkompatiblen Tokenizer im Browser.

Empfohlener Implementierungsweg: expliziter Querybaum für logische Verknüpfung,
je Suchatom EXISTS über segmentierte Lexeme desselben Datensatzes, Phrasen über
absolute Positionen innerhalb desselben Felds. Stopwortabstände erhalten. Die
SQL-Implementierung wird an Referenzfällen gegen websearch_to_tsquery abgeglichen.
Überlange einzelne Lexeme folgen den dokumentierten PostgreSQL-Grenzen; die
Inhalte bleiben speicher-/exportierbar. Keine automatische Präfixsuche hinzufügen.
Segmentierung ist interne Datenrepräsentation, keine zusätzliche Produktfunktion.

Suchsprachenwechsel: pro Vault aktive Indexgeneration und neue Zielgeneration.
Hintergrundauftrag baut Zielgeneration, merkt geprüfte Datensatzrevisionen und
holt parallele Änderungen nach. Schreibaktionen aktualisieren aktive Generation
transaktional und markieren Zielgeneration bei Bedarf veraltet. Umschalten nur
nach letzter atomarer Konsistenzprüfung aller aktiven Datensätze; danach alte
Generation bereinigen. Bis dahin bleibt alte Suchsprache wirksam. Neustart setzt
den Auftrag fort; erneuter Sprachwechsel ersetzt den Zielauftrag. Import baut
seinen Index vor Sichtbarkeit; gelöschte Datensätze werden nicht gefunden.

Snippets maximal320 Codepunkte, passende Stelle aus einem zugänglichen aktuellen
Feld. Leere Query: Zusammenfassung, sonst Markdownanfang. Reiner Text, kein
ts_headline-HTML direkt rendern. Such- und Indexänderungen haben keine Auswirkung
auf Inhaltsrevision oder historische Versionen.

## Verbindlicher Suchkorpus für die spätere PostgreSQL-Prüfung

Eigener Vault A neutral, eigener B deutsch, eigener C englisch; zusätzlich fremdes
Konto D. Gleiche Tag-Namen in A/B besitzen verschiedene IDs. Alle Datensätze
erhalten feste IDs/Zeitpunkte, damit Sortierung reproduzierbar geprüft wird.

| Fall | Fixture / Query | Erwartung |
|---|---|---|
| Feldübergreifendes AND | Titel alpha, Body beta / alpha beta | Treffer |
| Fehlendes AND | nur alpha / alpha beta | kein Treffer |
| Phrase | Body alpha beta / "alpha beta" | Treffer |
| Feldgrenze | Titel alpha, Summary beta / "alpha beta" | kein Treffer |
| OR | alpha oder beta / alpha OR beta | beide |
| Ausschluss | alpha beta / alpha -beta | kein Treffer |
| Neutral | cats / cat | kein Treffer |
| Englisch | cats / cat | Treffer |
| Deutsch | Häuser / Haus | Treffer |
| Akzente neutral | für / fur | kein Treffer |
| Leere Suche | leerer Query | zuletzt geänderte aktive Inhalte |
| Stopwörter | en: the / the | keine Treffer |
| Rechte | fremder identischer Text | weder Treffer noch Snippet |
| Trash/Historie | Begriff nur gelöscht/alte Version | kein Treffer |
| Tag all/any | zwei IDs, nur eine zugeordnet | all nein, any ja |
| Gleiche Tagnamen | A-Tag-ID bei Suche A+B | keine automatische B-Tag-Zuordnung |
| Rang | alpha jeweils Titel/Summary/Body | Titel vor Summary vor Body |
| Gleichstand | gleicher Rang/Zeit, unterschiedliche IDs | UUID aufsteigend |
| Große Texte | Begriff nach 20000 Tokenpositionen | auffindbar |
| Häufige Lexeme | Phrase nach >256 Vorkommen eines Worts | auffindbar |
| Segmentgrenze | Phrase über interner Indexgrenze | auffindbar |
| Unicode-Limit | gültiges 1-MiB-Markdown | gespeichert und Index ohne Kürzung |
| Sprachwechsel | Schreiben während Reindex | alte Suche bis atomarem Wechsel; kein verlorener Datensatz |

Dieser Korpus ist eine Abnahmevorgabe, kein als bestanden deklarierter Testlauf.
Zum Ende des Such-Arbeitspakets Fixture-JSON/SQL und tatsächliche Testergebnisse
einchecken. Algorithmische Details dürfen innerhalb dieser Semantik autonom
optimiert werden; keine Suchfunktion stillschweigend streichen.

## Primärquellen

- [Unicode17 CaseFolding](https://www.unicode.org/Public/17.0.0/ucd/CaseFolding.txt)
- [Unicode17 White_Space](https://www.unicode.org/Public/17.0.0/ucd/PropList.txt)
- [Unicode17 Normalisierungstests](https://www.unicode.org/Public/17.0.0/ucd/NormalizationTest.txt)
- [PostgreSQL Suche](https://www.postgresql.org/docs/18/textsearch-controls.html)
- [PostgreSQL Suchgrenzen](https://www.postgresql.org/docs/18/textsearch-limitations.html)
