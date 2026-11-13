# Umsetzungsplan

Stand: 13. November 2026. Basis: [Vision](VISION.md) und
[Architekturentwurf](ARCHITECTURE.md). Alle Etappen sind geplant, keine ist
bereits umgesetzt. Der MVP ist erst nach Etappe 7 vollständig.

## 0. Entscheidungen vor dem Grundgerüst abschließen

Architektur/Toolchains sowie die Regeln zu Anmeldung und Sicherheit sind
bestätigt. Sicherheitsdetails wie die Wiederherstellung bei verlorenem zweiten
Faktor, Datenrandfälle, Schnittstellen, UI-Abläufe sowie Betrieb und Lieferung
werden noch gemeinsam entschieden. Paketversionen und Lizenzen, MCP-/OAuth-Bibliotheken und das
Registrierungsverfahren werden vorab geprüft. Falls ein technischer Versuch
notwendig ist, wird er ausdrücklich als isolierte Kompatibilitätsprüfung
geplant; er ist kein Beginn des Produktbaus.

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

Das in Etappe 0 ausgewählte MCP-SDK und die OAuth-Bibliothek integrieren.
Discovery, Anmeldung/Consent, Tokenprüfung und ein authentifiziertes Lesetool
mit minimalem Testdatensatz implementieren. Registrierungsmethode anhand der
realen ChatGPT-Verbindung gegen die festgelegte Architektur überprüfen.
Testcode darf nur mit klarer Trennung von Produktionsfunktionen landen.

**Abnahme:** MCP Inspector prüft Initialisierung, Schemas und Fehler.
ChatGPT verbindet sich tatsächlich über HTTPS, liest den freigegebenen
Testdatensatz und verliert nach Widerruf den Zugriff. Tokenablauf, Refresh,
falsche Resource/Audience und ungültige Redirects werden geprüft.

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

## 4. Inhalte, Tags, Historie und Suche

CRUD, Tag-Verwaltung, Volltextsuche, Konflikterkennung, Versionierung und
Verschieben bauen. Schema und Migrationen gegen echte PostgreSQL testen.

**Abnahme:** Zwei konkurrierende Änderungen derselben Revision ergeben genau
einen erfolgreichen Schreibvorgang. Keine Teiländerungen oder zusätzliche
Version bei Fehlern beziehungsweise unveränderten Daten. Limit 0, Standard 20,
Limitsenkung und Wiederherstellung funktionieren. Snapshots enthalten alle
vier Inhaltsbestandteile und Verursacher. Verschieben prüft Quell-/Zielrechte
und Ziel-Limit. Tag-Regeln gelten identisch über alle Zugangswege.

Suche findet deutsche und englische Beispieldatensätze, filtert Tags und
Vaults, bleibt stabil paginiert und verrät weder fremde noch gelöschte Daten
in Treffern, Textausschnitten oder Trefferzahlen.

## 5. Vollständige Agentenanbindung

CLI-Befehle und alle vorgesehenen MCP-Tools auf die gemeinsamen Anwendungsfälle
setzen. JSON-Ausgabe, stabile Exitcodes, Datei-/stdin-Eingabe für Markdown,
Konfigurationshilfe und kopierbare Verbindungsbeispiele ergänzen.

**Abnahme:** ChatGPT führt Anlegen, Lesen, Suche, Bearbeiten und Löschen
erfolgreich durch. Negative Fälle: fremder Vault, Leserechte bei Schreibversuch,
veraltete Revision, verbotene Tag-Erstellung und widerrufener Zugang.
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
Ungespeicherte Änderungen warnen beim Verlassen; Speichern ist ausdrücklich.
Markdown führt keine eingebetteten Skripte aus. Papierkorb bleibt 30 Tage,
vorzeitig endgültiges Löschen ist nutzervorbehalten. Vault-Restore aktiviert
keine alten Agentenrechte und keine zuvor einzeln gelöschten Datensätze.
Bereinigung ist nach Neustart wiederholbar. Export/Import erhält aktuelle
Inhalte und Metadaten, erstellt neue IDs und überschreibt nichts. Ungültige,
überdimensionierte und pfadmanipulierte ZIPs werden ohne Teilimport abgewiesen.

## 7. Installation, Betrieb und erste Veröffentlichung

Compose-Beispiele für Internet und LAN, HTTPS-Anleitung, optionale SMTP-
Konfiguration, Release-Artefakte mit Prüfsummen und Versionshinweise erstellen.
Upgrade-, Backup- und Wiederherstellungsanleitung praktisch erproben.

**Abnahme:** Frische Installation und Ersteinrichtung gelingen anhand der
Dokumentation. LAN-Betrieb funktioniert nach Bereitstellung der Artefakte ohne
Internetzugriff. Upgrade erhält Daten; Wiederherstellung auf frischer Instanz
stellt Konten, Einstellungen und Versionen wieder her. Logs enthalten keine
Inhalte oder Zugangsdaten. Finaler ChatGPT-Test und sämtliche erforderlichen
CI-Prüfungen sind erfolgreich. Erst dann Release als vollständigen MVP markieren.

## Lieferregel je Etappe

Änderungen werden mit passenden Tests und aktualisierten Verträgen/Dokumenten
geliefert, committed, gepusht und gemäß Repository-Workflow integriert.
Dokumentationsänderungen benötigen Diff-/Link- und Konsistenzprüfung;
Implementierung zusätzlich die betroffenen Build-, Integrations- und
End-to-End-Prüfungen. Ein grüner Build ersetzt keine reale Clientabnahme.
Offene externe Voraussetzungen werden konkret dokumentiert und aktiv geklärt.
