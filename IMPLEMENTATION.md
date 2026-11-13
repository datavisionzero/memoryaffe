# Umsetzungsplan

Stand: 13. November 2026. Basis: [Vision](VISION.md) und
[Architekturentwurf](ARCHITECTURE.md). Alle Etappen sind geplant, keine ist
bereits umgesetzt. Der MVP ist erst nach Etappe 7 vollständig.

## 0. Entscheidungen vor dem Grundgerüst abschließen

Architektur/Toolchains sowie die Regeln zu Anmeldung und Sicherheit sind
bestätigt, ebenso Kontowiederherstellung, Datenregeln, Suchverhalten,
Datenmitnahme und zentrale UI-Abläufe. Weitere Vertragsdetails und Randfälle
sowie technische Betriebs- und Lieferdetails werden noch gemeinsam entschieden.
Der grundsätzliche Betriebs- und Veröffentlichungsumfang ist bestätigt.
Beschlossen ist eine begrenzte OAuth-
Eigenimplementierung mit CIMD und einer betreiberverwalteten Liste erlaubter
Client-URLs, zunächst ChatGPT, ohne DCR. ASP.NET Core Identity bleibt die
Anmeldebasis. Paketversionen und Lizenzen werden vorab geprüft. Der vollständige
OAuth-/CIMD-Vertrag und ein isolierter ChatGPT-Test mit Fehler- und
Widerrufsfällen werden vor dem Grundgerüst abgeschlossen; dieser Versuch ist
kein Beginn des Produktbaus. Externe Testvoraussetzungen aus Etappe 2 gelten
bereits hier. Fehlender realer Clientnachweis bleibt eine offene Voraussetzung.

**Abnahme:** Keine offenen wesentlichen Produkt- oder Architekturentscheidungen.
Verträge, Abhängigkeiten und Abnahmekriterien sind verbindlich dokumentiert.
Erst danach beginnt Etappe 1. Für die spätere autonome Arbeit mit Subagenten
werden Aufgaben, Zuständigkeiten, Abhängigkeiten und Integrationsprüfungen
festgelegt. Wesentliche Entscheidungen werden nicht an die Umsetzung delegiert.

## 1. Grundgerüst und Vertragskonventionen

Vier .NET-Projekte, React-Webapp, Go-CLI, PostgreSQL-Entwicklungskonfiguration
und CI nach den Entscheidungen aus Etappe 0 aufbauen. Festgelegte Toolchains
und Abhängigkeiten pinnen; vereinbarte Vertragskonventionen umsetzen.

**Abnahme:** Backend und beide Clients bauen reproduzierbar; CI prüft Format,
Typen und Tests. Ein Container startet mit PostgreSQL; Readiness meldet einen
Datenbankausfall korrekt. Noch keine Produktvollständigkeit behaupten.

## 2. Früher ChatGPT-Durchstich

Das in Etappe 0 geprüfte MCP-SDK und die eigene OAuth-Implementierung integrieren.
Discovery, Anmeldung/Consent, Tokenprüfung und ein authentifiziertes Lesetool
mit minimalem Testdatensatz implementieren. Registrierungsmethode anhand der
realen ChatGPT-Verbindung gegen die festgelegte Architektur überprüfen.
Testcode darf nur mit klarer Trennung von Produktionsfunktionen landen.

**Abnahme:** MCP Inspector prüft Initialisierung, Schemas und Fehler.
ChatGPT verbindet sich tatsächlich über HTTPS, liest den freigegebenen
Testdatensatz und verliert nach Widerruf den Zugriff. Tokenablauf, Refresh,
falsche Resource/Audience und ungültige Redirects werden geprüft. Ergänzend
werden PKCE-Fehler, doppelte Codeverwendung, Refresh-Token-Wiederverwendung,
unerlaubte CIMD-Clients sowie manipulierte Metadaten und interne Abrufziele
geprüft. Bereits vor dem Grundgerüst geprüfte Abläufe werden als integrierte
Produktfunktionen erneut abgenommen.

**Externe Voraussetzung:** erreichbarer Testendpunkt und Zugriff auf ein
ChatGPT-Konto mit erlaubten eigenen MCP-Verbindungen. Fehlen diese, wird der
reale Test ausdrücklich als ausstehend protokolliert, niemals durch einen
Inspector-Test als bestanden ersetzt. Keine echten privaten Inhalte verwenden.

## 3. Konten, Vaults und Rechte

Geführte geschützte Ersteinrichtung, Login/Logout, Einladung, Reset, optionales
SMTP und Kontosperre implementieren. Persönlichen Start-Vault, Agentenzugänge,
CLI-Token und OAuth-Zuordnung ergänzen. Rechte zentral durchsetzen.
Freiwilliges TOTP mit Wiederherstellungscodes im Profil, Sitzungsverwaltung,
Tokenwechsel und den operativen Admin-Wiederherstellungsweg ergänzen.

**Abnahme:** Einladungen verfallen nach sieben Tagen, Reset-Links nach einer
Stunde und sind nur einmal verwendbar. Alles funktioniert ohne SMTP. Zwei
Konten sehen niemals gegenseitige Vaults, auch bei geratenen IDs. Ein Admin
erhält keinen Inhaltszugriff. Alle drei Rechtestufen, Widerruf und Sperre
werden über HTTP und MCP getestet; alte Sitzungen funktionieren nach Sperre
nicht weiter. Der Login zeigt den Infrastruktur-Vertrauenshinweis.
Ersteinrichtung und Einladung/Kontoanlage funktionieren für Nutzer und Admins
ohne 2FA-Schritt oder Einrichtungsaufforderung. TOTP lässt sich später freiwillig
im Profil aktivieren; Anmeldung mit und ohne aktivierte 2FA wird geprüft.
Sitzungs- und Tokenfristen, Rotation und sofortiger Widerruf entsprechen dem
Architekturvertrag. Passwortänderung beendet andere Web-Sitzungen; Passwort-Reset
beendet alle Web-Sitzungen und widerruft sämtliche Agentenzugangsdaten, erhält
aber benannte Zugänge und Rechte für deren erneute Einrichtung.
Ein normaler Passwort-Reset erhält aktivierte 2FA. Umfassende Wiederherstellung
setzt Passwort und 2FA zurück und widerruft Sitzungen sowie Agentenzugangsdaten;
der gesonderte Link ist einmalig und gilt eine Stunde. Der Containerweg für
Admins funktioniert ohne SMTP und zweiten Admin. 2FA-Aktivierung verlangt
Passwort und TOTP-Test; Abschalten/Ersetzen verlangt Passwort plus TOTP oder
Wiederherstellungscode. Neue Wiederherstellungscodes entwerten alte.

Einladungen erlauben keine Änderung der gebundenen Adresse. E-Mail-Änderungen
werden mit und ohne SMTP entsprechend dem Architekturvertrag geprüft.
Mehrere Admins sind möglich; auch konkurrierende Sperr-, Lösch- oder
Herabstufungsversuche können nicht den letzten aktiven Admin entfernen.
Eigene Kontolöschung und administrative Löschung anderer Konten entfernen
Konto, Vaults, Historie und Zugänge endgültig ohne Kontopapierkorb.
Kontolöschung, Rollenänderung und umfassende Wiederherstellung prüfen die
erneute Authentifizierung des Handelnden, einschließlich dessen aktivierter 2FA.

## 4. Inhalte, Tags, Historie und Suche

CRUD, Tag-Verwaltung, Volltextsuche, Konflikterkennung, Versionierung und
Verschieben bauen. Schema und Migrationen gegen echte PostgreSQL testen.

**Abnahme:** Zwei konkurrierende Änderungen derselben Revision ergeben genau
einen erfolgreichen Schreibvorgang. Keine Teiländerungen oder zusätzliche
Version bei Fehlern beziehungsweise unveränderten Daten. Limit 0, Standard 20,
Limitsenkung und Wiederherstellung funktionieren. Snapshots enthalten alle
vier Inhaltsbestandteile und Verursacher. Verschieben prüft Quell-/Zielrechte
und Ziel-Limit. Tag-Regeln gelten identisch über alle Zugangswege.
Tag-Umbenennung und Zusammenführung erzeugen Revisionen und Snapshots der
betroffenen Datensätze, ohne alte Snapshots zu verändern. Wiederherstellung
ordnet historische Tag-Namen zu oder legt fehlende Tags nach Vorschau an.
Tag-Vergleiche ignorieren Groß-/Kleinschreibung und Rand-Leerzeichen, erhalten
aber Akzente/Umlaute. Vault-Namen sind pro Konto eindeutig. Konflikte erhalten
den eigenen UI-Entwurf und zeigen die Serverfassung zum Vergleichen.
Inhaltsgrenzen werden an und unmittelbar über den Grenzwerten geprüft,
einschließlich UTF-8-Bytegröße bei mehrbyteigen Zeichen, maximal 50 Tags und
Versionslimit 100. Teiländerungen erhalten ausgelassene Felder und erlauben
das ausdrückliche Leeren der Zusammenfassung.

Suche findet deutsche und englische Beispieldatensätze, filtert Tags und
Vaults, bleibt stabil paginiert und verrät weder fremde noch gelöschte Daten
in Treffern, Textausschnitten oder Trefferzahlen.
Geprüft werden alle drei Vault-Suchsprachen unabhängig von der UI-Sprache,
UND über mehrere Inhaltsfelder, Wortgruppen, OR und Ausschlüsse sowie
Tag-Filter mit „alle“ und „mindestens einer“. Leere Suche liefert zuletzt
geänderte Datensätze mit optionalen Tag-Filtern. Historie bleibt ausgeschlossen.
Rangfolge und Gleichstandsauflösung sowie Ausschnitte beziehungsweise
Zusammenfassung/Inhaltsanfang entsprechen dem Suchvertrag in allen Adaptern.

## 5. Vollständige Agentenanbindung

CLI-Befehle und alle vorgesehenen MCP-Tools auf die gemeinsamen Anwendungsfälle
setzen. JSON-Ausgabe, stabile Exitcodes, Datei-/stdin-Eingabe für Markdown,
Konfigurationshilfe und kopierbare Verbindungsbeispiele ergänzen.
Benannte Verbindungsprofile mit Standard und Auswahl pro Aufruf, verdeckte
Token-Eingabe beziehungsweise Umgebungsvariable und ausdrücklich gewählte
lokale Speicherung mit eingeschränkten Dateirechten ergänzen. Ein lesender
Prüfbefehl kontrolliert Erreichbarkeit, Anmeldung und zugängliche Vaults.

**Abnahme:** ChatGPT führt Anlegen, Lesen, Suche, Bearbeiten und Löschen
erfolgreich durch. Negative Fälle: fremder Vault, Leserechte bei Schreibversuch,
veraltete Revision, verbotene Tag-Erstellung und widerrufener Zugang.
Identische Wiederholungen von Anlegen, Ändern und Löschen mit demselben Schlüssel
erzeugen innerhalb von 24 Stunden keine zweite Änderung; abweichende Aufträge
werden abgewiesen. Listen-/Suchseitengrößen entsprechen Standard 20 und Maximum
100. Fremde und unbekannte IDs liefern dieselbe Antwort, fehlende Schreibrechte
auf sichtbare Datensätze dagegen einen Berechtigungsfehler.
Profile wechseln die Verbindung korrekt. Tokens erscheinen nicht als
Kommandozeilenargument; lokale Speicherung erfolgt nur ausdrücklich.
Datei-/stdin-Eingaben erhalten Markdown unverändert. JSON auf stdout bleibt
maschinenlesbar, Diagnosen verwenden stderr und Fehler stabile Exitcodes.
Vollständig angegebene Agentenbefehle warten nicht auf Eingaben; fehlende
Pflichtangaben führen zu Fehlern. Vorübergehende Lesefehler werden begrenzt
wiederholt, Schreibwiederholungen verwenden denselben Schlüssel und
Versionskonflikte werden nicht überschrieben. MCP-Schreibergebnisse enthalten
ID, neue Revision und Änderungszeitpunkt ohne vollständiges Markdown.
Der Verbindungsprüfbefehl verändert keine Inhalte.
Protokolliert werden Testdatum, Client/Oberfläche, Tool-Auswahl und Ergebnis,
ohne Geheimnisse. Keine Agententools für Nutzer-only-Aktionen vorhanden.
CLI-Smoke-Tests laufen unter Windows, Linux und macOS. Claude folgt als
separate spätere Kompatibilitätsprüfung und blockiert den ersten MVP nicht.

## 6. Vollständige Webapp und Datenlebenszyklus

Suchorientierte Shell, Vault-Wechsel, Editor/Vorschau, Historie und
Wiederherstellung, Tags, Agentenverwaltung, getrennte Administration sowie
responsive DE/EN-Oberfläche und Themes fertigstellen. Papierkorb, Bereinigung,
Export und Import integrieren.

**Abnahme:** Kernabläufe funktionieren per Tastatur und auf Smartphonebreite.
Login führt zur Suche im zuletzt verwendeten vorhandenen Vault. Datensatzseiten
sind direkt verlinkbar; Rückkehr zur Suche erhält Suchtext, Filter und Position.
Desktop-Editor zeigt Quelle und Vorschau nebeneinander, mobil sind sie
umschaltbar. Button und `Strg/Cmd+S` speichern. Vault-Wechsel warnt vor
ungespeicherten Änderungen; private Entwürfe werden nicht dauerhaft im
Browserspeicher gespeichert. Konflikte erhalten den geöffneten Entwurf.
Historie bietet Versionsansicht und Textvergleich mit der aktuellen Fassung;
Wiederherstellung wird bestätigt. Rückgängig nach Datensatzlöschung,
Vault-Löschdialog mit Inhaltsanzahl und gesonderte Bestätigung endgültigen
Löschens werden geprüft. Externe Markdown-Bilder lösen vor ausdrücklichem
Klick keine Abrufe aus. Fokusführung und einklappbare Navigation werden geprüft.
Ungespeicherte Änderungen warnen beim Verlassen; Speichern ist ausdrücklich.
Markdown führt keine eingebetteten Skripte aus. Papierkorb bleibt 30 Tage,
vorzeitig endgültiges Löschen ist nutzervorbehalten. Vault-Restore aktiviert
keine alten Agentenrechte und keine zuvor einzeln gelöschten Datensätze.
Bereinigung ist nach Neustart wiederholbar. Bereits einzeln gelöschte Datensätze
behalten ihre Frist auch in einem
gelöschten Vault; dessen Ablauf entfernt alle verbliebenen Inhalte. Der letzte
Vault kann gelöscht werden, ohne automatisch ersetzt zu werden.
Export/Import erhält aktuelle
Inhalte und Metadaten, erstellt neue IDs und überschreibt nichts. Ungültige,
überdimensionierte und pfadmanipulierte ZIPs werden ohne Teilimport abgewiesen.
Der Export bleibt bei parallelen Schreibzugriffen konsistent und enthält
`records/<id>.md`, `manifest.json`, alle vorhandenen Tags und Vault-Einstellungen,
aber keine Historie, Papierkorbinhalte, Kontodaten oder Agentenzugänge.
Import übernimmt Suchsprache, Versionslimit und ursprüngliche Zeitpunkte,
speichert zusätzliche Importherkunft und zeigt Namenskollisionen vorab an.
Grenzwerte von 100 MiB ZIP, 500 MiB entpackt und 10.000 Datensätzen werden
zusammen mit den Einzelgrenzen geprüft. Fehler ergeben eine verständliche
Fehlerliste ohne stilles Abschneiden. Fremde Archivformate werden abgewiesen.

## 7. Installation, Betrieb und erste Veröffentlichung

Compose-Beispiele für Internet und LAN, HTTPS-Anleitung, optionale SMTP-
Konfiguration, Release-Artefakte mit Prüfsummen und Versionshinweise erstellen.
Upgrade-, Backup- und Wiederherstellungsanleitung praktisch erproben.
Betreiberbefehle sichern Datenbank, erforderliche Konfiguration und Schlüssel;
Zeitplanung bleibt beim Betreiber, ohne Backup-Planer in der Webapp.
Linux-Container für `amd64`/`arm64` in der GitHub Container Registry und
eigenständige CLI-Downloads für Windows/Linux/macOS jeweils `amd64`/`arm64`
mit Prüfsummen in GitHub Releases bereitstellen. Versionen werden ausdrücklich
gewählt; keine automatischen Updates und zunächst keine Paketmanager-Repositories.

**Abnahme:** Frische Installation und Ersteinrichtung gelingen anhand der
Dokumentation. LAN-Betrieb funktioniert nach Bereitstellung der Artefakte ohne
Internetzugriff. Upgrade erhält Daten; Wiederherstellung auf frischer Instanz
stellt Konten, Einstellungen und Versionen wieder her. Logs enthalten keine
Inhalte oder Zugangsdaten. Finaler ChatGPT-Test und sämtliche erforderlichen
CI-Prüfungen sind erfolgreich. Erst dann Release als vollständigen MVP markieren.
Die dokumentierten Installationen verwenden genau eine Anwendungsinstanz;
HTTPS wird sowohl mit optionalem mitgeliefertem als auch vorhandenem Proxy
und im LAN geprüft. HTTP bleibt lokaler Entwicklung vorbehalten. Feste Basis-URL,
Domainwechsel mit MCP-Neuverbindung und Infrastrukturkonfiguration über
Umgebungsvariablen/Secret-Dateien sind dokumentiert. Migrationsfehler verhindern
Readiness. Getrennte Liveness-/Readiness-Antworten enthalten keine internen Details.
Alle Zielartefakte werden gebaut und nach der vorab festgelegten Testmatrix
geprüft. Messungen für Suche, Import und Versionierung nennen Testdaten und
Hardware und begründen veröffentlichte Leistungsangaben.

## Lieferregel je Etappe

Änderungen werden mit passenden Tests und aktualisierten Verträgen/Dokumenten
geliefert, committed, gepusht und gemäß Repository-Workflow integriert.
Dokumentationsänderungen benötigen Diff-/Link- und Konsistenzprüfung;
Implementierung zusätzlich die betroffenen Build-, Integrations- und
End-to-End-Prüfungen. Ein grüner Build ersetzt keine reale Clientabnahme.
Offene externe Voraussetzungen werden konkret dokumentiert und aktiv geklärt.
