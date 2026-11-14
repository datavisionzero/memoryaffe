# Web- und Administrationsvertrag

Stand: 13. November 2026. Die folgenden fünf Entscheidungsblöcke sind bestätigt.
Sie beschreiben geplantes Verhalten, keine implementierte Anwendung. Der
[Schnittstellenvertrag](API_CONTRACT.md) und bestehende Konto-, Rechte- und
Datenregeln gelten zusätzlich. Maschinenlesbare Schemas stehen in
[web.openapi.json](docs/contracts/web.openapi.json), technische Semantik in
[WEB_PROTOCOL.md](docs/contracts/WEB_PROTOCOL.md).

## 1. Browseranmeldung und Sitzungen

Webapp und Backend verwenden dieselbe Origin. Der Browser verwendet ein
geschütztes HttpOnly-Sitzungscookie und serverseitig widerrufbare Sitzungen.
Zustandsändernde Browseranfragen benötigen zusätzlich den CSRF-Nachweis von
ASP.NET Core, auch Anmeldung und Abmeldung. Agententokens bleiben ein separater
Zugang und erhalten keine nutzervorbehaltenen Funktionen.

Der Browser holt den CSRF-Nachweis über einen gleichursprünglichen Endpunkt
und sendet ihn in einem Request-Header. Nach einem Wechsel der Anmeldeidentität
wird der Nachweis erneuert. Geheimnisse gehören nicht in URLs oder Logs;
Authentifizierungsantworten dürfen nicht zwischengespeichert werden.
Die bestehenden Sitzungsfristen mit und ohne rememberMe gelten weiter.

Die eigene Sitzungsübersicht zeigt Browser/Gerät, Anmeldezeit und letzte
Aktivität. Gerätebezeichnungen sind beschreibende Angaben, kein Identitätsbeweis.
Die aktuelle Sitzung ist markiert. Andere Sitzungen lassen sich einzeln oder
gesammelt serverseitig abmelden. Abmelden der aktuellen Sitzung beendet ihren
Zugriff ebenfalls. Fremde Sitzungen bleiben unsichtbar.

## 2. Freiwilliges TOTP und Wiederherstellungscodes

Bei aktivierter 2FA erzeugt ein korrektes Passwort nur einen an den begonnenen
Browserablauf gebundenen Zwischenzustand ohne Produktzugriff. Er gilt fünf
Minuten. Erst ein gültiger TOTP- oder Wiederherstellungscode erzeugt die Sitzung
mit der zuvor gewählten rememberMe-Einstellung. Erfolgreicher Abschluss
verbraucht den Zwischenzustand atomar, auch bei parallelen Anfragen.

Nach fünf falschen Faktorversuchen wird der Zwischenzustand ungültig; die
Anmeldung muss beim Passwort neu beginnen. Übergreifende Anfragelimits verhindern
das Umgehen durch wiederholtes Beginnen. Die konkrete Betriebsmatrix steht
in [OPERATIONS.md](docs/contracts/OPERATIONS.md).

TOTP-Einrichtung ist eine freiwillige Profilfunktion. Die Vorbereitung gilt
zehn Minuten. Secret-Ausgabe aktiviert 2FA noch nicht; ein korrekter Testcode
schließt die Einrichtung ab. Abgelaufene Vorbereitungen können nicht bestätigt
werden. Eine bestehende Konfiguration bleibt bei nicht abgeschlossener
Ersetzung wirksam. Erstmalige Aktivierung verlangt Passwort und Test des neuen
Faktors; dabei gibt es naturgemäß keinen bisherigen zweiten Faktor.

Es werden zehn einzeln verwendbare Wiederherstellungscodes ausgegeben. Codes
werden nicht im Klartext gespeichert oder nachträglich angezeigt. Ihr Verbrauch
ist atomar. Neue Codes entwerten sämtliche alten Codes. Die Ausgabe neuer Codes und das Abschalten von 2FA verlangen innerhalb einer
angemeldeten Sitzung keine erneute Passwort- oder Faktorbestätigung.
Ersteinrichtung und Kontoanlage enthalten weder 2FA-Pflicht noch Aufforderung
zur Einrichtung, auch nicht für Administratoren.

## 3. Erneute Authentifizierung für konkrete Aktionen

Erneut erforderlich sind das Passwort des Handelnden und, falls eingerichtet,
dessen TOTP- oder Wiederherstellungscode bei:

- eigener oder administrativer Kontolöschung;
- Vorbereitung der Einrichtung oder Ersetzung von 2FA.

Bei Passwortänderung wird das aktuelle Passwort direkt im Änderungsauftrag geprüft.
Alle anderen Aktionen angemeldeter Nutzer benötigen kein erneutes Passwort,
insbesondere CLI-Zugänge/Tokens, Rechteerweiterungen, Tag-Erlaubnis,
Adminrollen, E-Mail-Änderungen und administrative Kontowiederherstellung.
Sitzungs-, CSRF-, Rollen-, Eigentümer- und Revisionsprüfungen bleiben erforderlich.

Der Nachweis gilt fünf Minuten und ist an die aktuelle Sitzung, die konkrete
Aktion, ihr Ziel und die vorbereiteten Angaben gebunden. Ein Setup-Nachweis kann keine Kontolöschung freigeben. Änderung des
Auftrags verlangt einen neuen Nachweis. Die Aktion prüft Rechte, Revision und
Kontostatus erneut. Der Nachweis schaltet keine allgemeine Adminsitzung frei.
Erfolgreiche Ausführung verbraucht ihn atomar; technische Ergebniswiederholung
darf keine zweite Aktion auslösen. Nachweise gehören nicht in URLs oder Logs.

Rechtereduzierung und Widerruf bleiben ohne zusätzliche Passwortabfrage möglich.
Normales Suchen, Bearbeiten und Löschen von Markdown benötigt ebenfalls keine
solche Abfrage; vorgesehene Löschdialoge bleiben bestehen. Bestehende Regeln für
Passwortänderung und der beschlossene Betreiberweg zur Adminrettung
gelten weiter. Erstmalige OAuth-Zustimmung folgt dem eigenen OAuth-Vertrag.

## 4. Konkurrenzschutz außerhalb von Markdown

Vault-Einstellungen, Tags, Agentenrechte und Kontoverwaltung verwenden wie
Markdown eine erwartete Revision als dezimale Zeichenfolge. Fehlende Angaben
ergeben `400/validation_failed`, veraltete `409/revision_conflict`. Prüfung und
Änderung sind atomar; unveränderte Speicherung erzeugt keine neue Revision.

Der Schutz umfasst jeweils das bearbeitete Verwaltungsobjekt. Markdown-Änderung
macht nicht allein dadurch Vault-Einstellungen veraltet. Bei Tag-Zusammenführung
werden Quelle und Ziel geprüft; Tag-Aktion und betroffene Datensatzversionen
bleiben atomar. Rechteänderungen prüfen die Revision des gesamten betroffenen
Agentenzugangs. Kontostatus, Rolle und sicherheitsrelevante Kontoeinstellungen
werden ebenfalls gegen konkurrierende Verwaltungsänderungen geschützt.

Theme und Anzeigesprache verwenden die zuletzt gespeicherte Änderung. Ihr Patch
verändert keine sicherheitsrelevanten Felder. Konflikte anderer Einstellungen
erhalten den lokalen UI-Entwurf und verlangen eine bewusste erneute Entscheidung.
Die transaktionale Prüfung des letzten aktiven Admins bleibt zusätzlich nötig;
Einzelrevisionen allein ersetzen diese Prüfung nicht.

## 5. Import mit Vorschau und atomarer Übernahme

Der Nutzer lädt das ZIP einmal hoch. Der Server prüft das gesamte Archiv nach
dem Datenvertrag. Eine erfolgreiche Vorschau zeigt Vaultname, Datensatz- und
Tag-Anzahl. Fehler werden verständlich gemeldet; ungültige Archive sind nicht
übernehmbar. Der Zielname kann vor Bestätigung angepasst werden. Die Vorschau
reserviert noch keinen Vaultnamen.

Ein geprüfter Upload gilt ab abgeschlossener Prüfung 30 Minuten. Pro Nutzer
ist eine Vorbereitung erlaubt; eine neue ersetzt die vorherige. Sie gehört
zum eigenen Konto, ohne Zugriff für Agenten oder andere Konten. Die Datei liegt
in einem privaten Serververzeichnis außerhalb des Webroots. Übernahme, Abbruch
und Ablauf entfernen die temporäre Datei. Bereinigung wird auch nach Neustart
nachgeholt; Ablauf sperrt Nutzung sofort, unabhängig vom Bereinigungszeitpunkt.

Die Bestätigung referenziert genau die unveränderten geprüften Daten. Vor der
Übernahme werden Konto, Gültigkeit und Zielname samt Namenskollision erneut
geprüft. Neue IDs, Referenzen, Vault und Inhalte entstehen atomar oder gar nicht.
Die vorhandenen Importgrenzen bleiben bestehen.

Pro Vorbereitung entsteht höchstens ein Vault. Gleichzeitige oder wiederholte
Bestätigung führt zu keiner zweiten Übernahme. Import und Ergebniszuordnung
werden transaktional gemeinsam festgehalten. Technische Wiederholungen folgen
der bestehenden 24-Stunden-Regel mit aktueller Zugangsprüfung, ohne das ZIP
weiter aufzubewahren. Ein geänderter Zielname nach Erfolg erzeugt keinen zweiten
Import unter derselben Vorbereitung. Eine abgelaufene oder ersetzte, noch nicht
übernommene Vorbereitung verlangt einen neuen Upload.

## Vertragsartefakte und ausstehende Anwendungsabnahme

Das [Endpunktinventar](docs/contracts/WEB_ENDPOINTS.md) bildet diese Abläufe ab.
Request-/Response-Schemas, konkrete Header-/Fehlerdefinitionen und die
Ratelimit-/Ressourcenmatrix sind in docs/contracts ergänzt.
Die fünf Fachentscheidungen selbst sind abgeschlossen.

Die spätere Anwendung muss insbesondere Ablaufgrenzen, fünf Fehlversuche,
einmaligen Codeverbrauch, Sitzungswiderruf, Aktions-/Zielbindung, parallele
Verwaltungsänderungen und wiederholte Importbestätigung nachweisen. Schema-
oder Dokumentationsprüfungen ersetzen diese Integrationsprüfungen nicht.

## Referenzen

- [ASP.NET Core: CSRF-Schutz](https://learn.microsoft.com/aspnet/core/security/anti-request-forgery?view=aspnetcore-10.0)
- [OWASP: erneute Authentifizierung](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)

Konkrete Fristen, Mengen und Aktionsgrenzen sind memoryaffe-Entscheidungen.

## Kontonavigation und Formularsemantik

Profileinstellungen sind ausschließlich oben rechts erreichbar. Unter `/app/profile`
steht die Darstellung; obere Navigation führt zu getrennten Ansichten
`appearance`, `password`, `two-factor`, `sessions`, `agents` und `delete`.
Deep-Links, Neuladen und Browser-Zurück erhalten das gewählte Thema. Themes
heißen Dark, Light und System. Seiten tragen sachliche Überschriften ohne Werbetexte.

Fachliche Textfelder tragen eindeutige Namen und `autocomplete=off`, ergänzt um
Ignore-Hinweise für Passwortmanager. Loginadresse verwendet `username`, bestehende
Passwörter `current-password`, neue Passwörter `new-password`, Einmalcodes
`one-time-code`. Betreibersecret und Einladungs-/Ausgabetokens sind keine
Loginpasswörter. Passwortmanager können diese Hinweise durch eigene Heuristiken übergehen.
