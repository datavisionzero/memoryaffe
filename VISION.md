# Produktvision: memoryaffe

memoryaffe ist ein selbst gehostetes Langzeitgedächtnis für KI-Agenten. Nutzer
behalten die volle Kontrolle über ihre Daten und entscheiden, welche Agenten
auf welche Erinnerungen zugreifen dürfen. Die Software ist Open Source unter
der MIT-Lizenz.

Diese Vision beschreibt das angestrebte Produkt, nicht den aktuellen
Implementierungsstand. Offene Entscheidungen sind am Ende ausdrücklich benannt.

## Zielgruppe und Grundprinzipien

memoryaffe richtet sich an Einzelpersonen sowie kleine, vertraute Nutzerkreise,
insbesondere Familien und Haushalte. Eine Installation kann mehrere Konten
beherbergen, etwa für Partner oder Kinder. Das Produkt ist von Grund auf
mehrbenutzerfähig, aber nicht als Plattform für große Organisationen oder
einander unbekannte Mandanten gedacht.

Die zentralen Prinzipien sind:

- **Eigene Daten, eigene Infrastruktur:** Nutzer betreiben ihr Gedächtnis selbst
  und bestimmen über Inhalte und Agentenzugänge.
- **Lesbare Inhalte:** Erinnerungen werden als Markdown gespeichert und können
  von Menschen und Agenten gelesen und bearbeitet werden.
- **Suche zuerst:** Gespeichertes Wissen soll schnell auffindbar sein. Die Suche
  ist ein zentraler Bestandteil der täglichen Nutzung.
- **Überschaubare Bedienung:** Eine aufgeräumte Webapp stellt Inhalte und Suche
  in den Vordergrund; Administration erhält einen eigenen Bereich.
- **Transparente Vertrauensgrenzen:** Andere Konten sind in der Anwendung
  getrennt, gegenüber dem Betreiber der Infrastruktur aber nicht geheim.

## Inhalte und Organisation

### Markdown-Datensätze

Jede Erinnerung ist ein Datensatz mit:

- einem Titel,
- dem eigentlichen Inhalt im Markdown-Format,
- einer optionalen Kurzzusammenfassung als reinem Text,
- optionalen Tags.

Die Webapp ermöglicht das Ansehen, Anlegen, Bearbeiten, Suchen und Löschen
dieser Datensätze. Markdown soll sowohl lesbar dargestellt als auch bearbeitet
werden können. Markdown-Inhalte werden als Text in PostgreSQL gespeichert,
gemeinsam mit Metadaten und Versionen. Markdown-Dateien entstehen beim Export;
ein zusätzlich synchronisierter Ordner auf dem Server ist nicht vorgesehen.

Jeder Datensatz besitzt eine stabile ID. Titel dürfen mehrfach vorkommen und
sich ändern; Agenten adressieren Datensätze beim Bearbeiten über ihre ID.
Die optionale Zusammenfassung wird vom Nutzer oder Agenten geschrieben.
memoryaffe erzeugt sie zunächst nicht selbst und benötigt keinen eigenen
KI-Anbieter. Der MVP unterstützt Markdown und Metadaten, jedoch keine
Dateianhänge wie hochgeladene Bilder oder PDFs. Normale Links im Markdown
sind möglich.

Titel sind verpflichtend und auf 200 Zeichen begrenzt, optionale
Zusammenfassungen auf 1.000 Zeichen. Markdown darf leer sein und umfasst
höchstens 1 MiB (1.048.576 Bytes) in UTF-8 pro Datensatz. Pro Datensatz sind
maximal 50 Tags erlaubt. Vault-Namen haben maximal 100, Tag-Namen maximal
50 Zeichen; beide dürfen nicht leer sein.

### Versionierung und Aufbewahrung

Eine Version umfasst Markdown-Inhalt, Titel, Zusammenfassung und zugewiesene
Tags. Jede tatsächliche Änderung erzeugt eine Version, unabhängig davon, ob
sie über die Webapp, die CLI oder MCP erfolgt.

Zu jeder Änderung werden Zeitpunkt und Verursacher gespeichert: der Nutzer
oder der benannte Agentenzugang. Diese Angaben sind in der Historie sichtbar.

Standardmäßig bleiben pro Datensatz 20 historische Versionen zusätzlich zur
aktuellen Fassung erhalten. Nutzer können dieses Limit pro Vault zwischen
0 und 100 historischen Versionen einstellen;
0 bedeutet keine Historie. Beim Überschreiten oder Senken des Limits werden
die überzähligen ältesten Versionen automatisch entfernt. Die aktuelle
Fassung bleibt erhalten.

Nutzer können historische Versionen in der Webapp ansehen und wiederherstellen.
Eine Wiederherstellung erzeugt eine neue aktuelle Fassung und unterliegt
derselben Aufbewahrungsregel. Agenten erhalten zunächst keinen eigenen Zugriff
auf die Versionshistorie.

### Gleichzeitige Änderungen

Hat sich ein Datensatz seit dem Lesen geändert, wird ein Schreibversuch auf
Basis der veralteten Fassung abgelehnt. Nutzer oder Agent müssen den aktuellen
Stand erneut laden, bevor sie ihre Änderung darauf anwenden. Diese Regel gilt
für Webapp, CLI und MCP und verhindert unbemerktes Überschreiben.
Bei einem Konflikt behält die Webapp den eigenen Entwurf und zeigt die aktuelle
Serverfassung zum Vergleichen. Agenten erhalten einen eindeutigen Konfliktfehler
und müssen den Datensatz erneut lesen.

### Vaults

Vaults bilden die oberste Ebene der Inhaltshierarchie. Jeder Datensatz gehört
zu einem Vault. Nutzer entscheiden, ob sie ihr gesamtes Wissen in einem großen
Vault sammeln oder auf mehrere Vaults verteilen.
Vault-Namen sind innerhalb eines Kontos ohne Unterscheidung der Groß- und
Kleinschreibung eindeutig. Auch der letzte Vault darf gelöscht werden; danach
zeigt die Webapp einen leeren Zustand mit der Aktion „Vault anlegen“ und
erzeugt keinen automatischen Ersatz.
Vault-Namen bleiben im Papierkorb bis zur endgültigen Löschung reserviert.

Jeder Vault gehört genau einem Nutzerkonto. Nutzer haben ausschließlich eigene
Vaults; gemeinsame Vaults und Freigaben zwischen Konten sind nicht vorgesehen.
Ein Agentenzugang gehört ebenfalls zu einem Konto und kann nur für dessen
Vaults freigeschaltet werden.

Nur Nutzer dürfen Vaults anlegen und löschen; Agenten erhalten diese Befugnis
nicht. Jeder Agentenzugang wird ausdrücklich für einen oder mehrere Vaults
freigeschaltet. Zugriffe und Suchergebnisse bleiben auf diese freigegebenen
Vaults begrenzt.

Nutzer können Datensätze über die Webapp zwischen eigenen Vaults verschieben;
Agenten erhalten diese Möglichkeit zunächst nicht. Die Historie bleibt dabei
erhalten, unterliegt aber ab dem Verschieben dem Versionslimit des Ziel-Vaults.
Ab diesem Zeitpunkt gelten auch dessen Zugriffsrechte. Tags werden im Ziel-Vault
nach Namen zugeordnet oder dort angelegt.

### Tags

Tags gehören jeweils zu einem Vault und unterstützen das Wiederfinden von
Inhalten. Nutzer entscheiden einmal kontoweit, ob Agenten neue Tags anlegen
dürfen oder ob ausschließlich Nutzer dies über die Webapp tun dürfen.
Standardmäßig dürfen Agenten keine neuen Tags anlegen.

Agenten mit Schreibrechten dürfen vorhandene Tags an einzelnen Datensätzen
hinzufügen oder entfernen. Neue Tags dürfen sie nur mit Schreibrechten im
betreffenden Vault und bei entsprechender kontoweiter Erlaubnis anlegen.
Tags umbenennen, zusammenführen oder vollständig entfernen darf ausschließlich
der Nutzer. Diese Regeln gelten gleichermaßen für CLI und MCP.

Tag-Namen werden für Vergleiche Unicode-normalisiert, ohne Leerzeichen am Rand
und ohne Unterscheidung der Groß- und Kleinschreibung behandelt. Die Schreibweise
bleibt zur Anzeige erhalten; Akzente und Umlaute bleiben unterscheidbar.
Umbenennen und Zusammenführen aktualisieren aktuelle Zuordnungen und erzeugen
bei betroffenen Datensätzen eine neue Revision und einen Versionsstand nach
dem Vault-Limit. Historische Fassungen bleiben unverändert. Beim Wiederherstellen
einer Version werden historische Tag-Namen aktuellen Tags zugeordnet; fehlende
Tags werden neu angelegt. Die Vorschau zeigt, welche Tags zurückkommen.
Vollständiges Löschen eines Tags entfernt aktuelle Zuordnungen und versioniert
betroffene Datensätze nach denselben Regeln; historische Fassungen bleiben erhalten.

### Löschen und Papierkorb

Gelöschte Datensätze bleiben einschließlich ihrer noch vorhandenen Versionen
30 Tage im Papierkorb und werden danach endgültig entfernt. Sie erscheinen
nicht in der Suche und sind über den regulären Agentenzugriff nicht erreichbar.
Nur der Nutzer darf sie wiederherstellen oder vorzeitig endgültig löschen.

Vaults werden nach ausdrücklicher Bestätigung durch den Nutzer ebenfalls für
30 Tage in den Papierkorb verschoben, einschließlich ihrer enthaltenen
Datensätze. Agentenzugriffe sind sofort ausgeschlossen. Nach einer
Wiederherstellung muss der Nutzer den Vault erneut für Agenten freigeben.
Vorher einzeln gelöschte Datensätze bleiben bei einer Vault-Wiederherstellung
gelöscht und behalten ihre ursprüngliche Papierkorbfrist. Beim Ablauf des
gelöschten Vaults werden alle verbliebenen Inhalte endgültig entfernt.
Verschachteltes Löschen verlängert keine Aufbewahrungsfrist.

## Suche

Der MVP bietet Volltextsuche über Titel, Zusammenfassung und Markdown-Inhalt
sowie Tag-Filter. Die Suche erfolgt standardmäßig im aktuellen Vault, optional
über alle eigenen Vaults. Agenten können ausschließlich ihre freigegebenen
Vaults durchsuchen. Semantische Suche ist eine spätere Erweiterung.

Die Suchsprache ist pro Vault als Deutsch, Englisch oder sprachneutral wählbar;
Standard ist sprachneutral. Sie ist unabhängig von der Oberflächensprache.
Bei Änderung der Suchsprache werden bestehende Inhalte neu indexiert. Die
bisherige Suche bleibt bis zum vollständigen Abschluss der Umstellung verfügbar.
Mehrere Suchbegriffe müssen standardmäßig alle vorkommen, dürfen aber über
Titel, Zusammenfassung und Inhalt verteilt sein. Anführungszeichen suchen
Wortgruppen, `OR` verbindet Alternativen und Minuszeichen schließen Begriffe
aus. Diese Bedeutung ist in Webapp, CLI und MCP identisch.

Mehrere Tag-Filter verlangen standardmäßig alle ausgewählten Tags; alternativ
kann auf „mindestens einer“ umgeschaltet werden. Tags bleiben ein eigener
Filter. Eine leere Suche zeigt zuletzt geänderte Datensätze und unterstützt
weiterhin Tag-Filter. Durchsucht werden nur aktuelle, aktive Fassungen, weder
Historie noch Papierkorb. Automatische Tippfehlerkorrektur und automatische
Wortanfangssuche gehören nicht zum MVP.

Suchergebnisse zeigen Titel, Tags, Vault, Änderungsdatum und einen kurzen
passenden Textausschnitt. Bei leerer Suche erscheint stattdessen die
Zusammenfassung oder der Inhaltsanfang. Standardmäßig wird nach Relevanz
sortiert, alternativ nach Änderungsdatum. Titel zählt stärker als
Zusammenfassung, diese stärker als Markdown-Inhalt. Bei gleichem Rang
entscheidet das jüngste Änderungsdatum, danach die ID.

## Export, Import und Backups

Bereits im MVP können Nutzer einen Vault als ZIP mit Markdown-Dateien und
strukturierten Metadaten exportieren und wieder importieren. Das ZIP enthält
eine Markdown-Datei je Datensatz unter `records/<id>.md` und eine zentrale
`manifest.json` mit Formatversion, Titeln, Zusammenfassungen, Tags, Zeitpunkten
und Vault-Einstellungen. Der Export umfasst alle aktuellen aktiven Datensätze
und vorhandenen Tags eines Vaults, ohne Historie, Papierkorb, Kontodaten oder
Agentenzugänge. Er bildet auch bei gleichzeitigen Änderungen einen konsistenten
Datenstand ab.

Der Import erstellt einen neuen Vault mit neuen IDs und überschreibt keine
bestehenden Inhalte. Nutzer können vorab den Vault-Namen ändern;
Namenskollisionen werden angezeigt. Suchsprache und Versionslimit werden
übernommen. Ursprüngliche Erstellungs- und Änderungszeitpunkte bleiben erhalten;
Importzeitpunkt und importierender Nutzer werden zusätzlich festgehalten.
Frühere Agentenidentitäten erzeugen keine lokalen Zugänge.

Vor dem Import wird das gesamte Archiv geprüft. Fehler führen zu einer
verständlichen Fehlerliste und Ablehnung des gesamten Imports, ohne stilles
Abschneiden oder Teilimport. Grenzen sind 100 MiB ZIP-Datei, 500 MiB entpackt
und 10.000 Datensätze; zusätzlich gelten die Grenzen pro Datensatz. Im MVP
wird nur das dokumentierte memoryaffe-ZIP-Format unterstützt, kein allgemeiner
Import beliebiger Markdown-Ordner.
Exporte sind auch oberhalb dieser Importgrenzen möglich. Die UI weist bei
solchen Archiven darauf hin, dass sie die Grenzen des normalen Imports
überschreiten. Die vollständige Installationswiederherstellung erfolgt über
ein separat erstelltes Installationsbackup, nicht über einen Vault-Export.

Zusätzlich wird ein Weg zur Sicherung und Wiederherstellung der gesamten
Installation dokumentiert. Diese Sicherung umfasst auch Konten, Einstellungen
und die noch aufbewahrten Versionen. Dokumentierte Betreiberbefehle sichern
Datenbank, erforderliche Konfiguration und Schlüssel. Wiederherstellung auf
einer frischen Installation wird getestet. Die automatische Zeitplanung
übernimmt zunächst der Betreiber; die Webapp enthält keinen Backup-Planer.

## Zugriff durch KI-Agenten

Nutzer können beliebig viele benannte Agentenzugänge anlegen, beispielsweise
„Coding-Agent“ oder „Persönlicher Assistent“, und jeden Zugang einzeln widerrufen.
Je Zugang und freigegebenem Vault wählen sie eine von drei aufeinander
aufbauenden Berechtigungsstufen:

1. Lesen und Suchen.
2. Zusätzlich Anlegen und Bearbeiten.
3. Zusätzlich Löschen.

Vault-Verwaltung bleibt unabhängig von diesen Stufen ausschließlich beim Nutzer.
Bei neuen Agentenzugängen sind keine Vaults automatisch ausgewählt; die
angebotene Berechtigungsstufe ist zunächst Lesen/Suchen. Reduzierte Rechte
wirken sofort auch für bereits ausgegebene Tokens. Zusätzliche Rechte werden
weiterhin ausdrücklich vom Nutzer vergeben.

memoryaffe bietet zwei gleichwertig gedachte Zugangswege für die Arbeit mit
Erinnerungen: eine CLI und eine MCP-Schnittstelle. Über beide sollen Agenten
innerhalb ihrer freigegebenen Vaults und entsprechend ihrer Berechtigungsstufe:

- Datensätze lesen,
- neue Datensätze schreiben,
- Inhalte suchen,
- bestehende Datensätze und ihre Metadaten bearbeiten,
- Datensätze löschen können.

Agenten können einzelne Felder ändern: ausgelassene Felder bleiben erhalten,
die Zusammenfassung kann ausdrücklich geleert werden. Markdown wird bei einer
Änderung vollständig ersetzt; eine zusätzliche Suchen-und-Ersetzen-Schnittstelle
gehört nicht zum MVP. Schreibaufrufe bearbeiten jeweils einen Datensatz;
größere Datenübernahmen erfolgen über ZIP-Import.

Anlegen, Ändern und Löschen unterstützen einen optionalen Wiederholungsschlüssel.
Derselbe Schlüssel mit identischem Auftrag erzeugt innerhalb von 24 Stunden
keine zweite Änderung; ein abweichender Auftrag mit demselben Schlüssel wird
abgewiesen. Listen und Suchtreffer liefern standardmäßig 20, höchstens 100
Ergebnisse pro Abruf mit Metadaten und kurzen Ausschnitten. Vollständiges
Markdown wird beim Einzelabruf geliefert.

Die MCP-Anbindung implementiert das tatsächliche Model Context Protocol und
soll als entfernter MCP-Server über das Internet erreichbar betrieben werden
können. Eine lediglich ähnlich benannte HTTP-API genügt diesem Anspruch nicht.
Agentenzugänge müssen authentifiziert sein; Vault-Freigaben und Tag-Regeln
gelten unabhängig vom Zugangsweg.

Die CLI verbindet sich mit einer memoryaffe-Installation. Sie besitzt weder
eine separate lokale Datenbank noch einen Offline-Synchronisationsmodus. Im
Heimnetz verbindet sie sich über die lokale Serveradresse. Sie unterstützt
Windows, Linux und macOS sowie lesbare Ausgabe und einen JSON-Modus für
Agenten und Skripte.

Benannte Verbindungsprofile enthalten Serveradresse und Agentenzugang. Ein
Profil ist Standard, pro Aufruf kann ein anderes gewählt werden. Tokens werden
über verdeckte Eingabe oder Umgebungsvariable entgegengenommen, nicht als
Kommandozeilenargument. Lokales Speichern erfolgt nur ausdrücklich in einer
Datei mit eingeschränkten Zugriffsrechten. Markdown wird aus Datei oder
Standardeingabe gelesen.

Standardausgabe ist menschenlesbar. Mit `--json` enthält stdout ausschließlich
strukturierte Ausgabe; Diagnosemeldungen gehen an stderr. Stabile Exitcodes
unterscheiden Validierung, Anmeldung, Berechtigung, Konflikt und
Verbindungsfehler. Vollständig angegebene Befehle laufen ohne Rückfragen;
Agentenaufrufe warten nicht auf Eingaben. Fehlende Pflichtangaben ergeben Fehler.

Lesezugriffe werden bei vorübergehenden Verbindungsfehlern begrenzt wiederholt.
Schreibzugriffe werden nur mit demselben Wiederholungsschlüssel erneut gesendet;
Versionskonflikte werden niemals automatisch überschrieben. MCP-Schreiboperationen
liefern ID, neue Revision und Änderungszeitpunkt, vollständiges Markdown nur
bei ausdrücklichem Lesen. Ein CLI-Prüfbefehl kontrolliert Erreichbarkeit,
Anmeldung und zugängliche Vaults, ohne Inhalte zu verändern.

Die Webapp zeigt je Agentenzugang passende Verbindungsinformationen und
kopierbare Konfigurationsbeispiele. CLI-Tokens und OAuth mit CIMD für MCP sind
festgelegt; die praktische MCP-Clientkompatibilität wird vorab geprüft.

## Webapp und Bedienung

Die Benutzeroberfläche ist eine moderne, klare Webapp mit Darkmode als Standard,
zusätzlichem Lightmode und der Option, der Systemeinstellung zu folgen. Sie
dient als direkter Zugang zum eigenen Langzeitgedächtnis und zur Verwaltung
der Agentenzugänge. Die UI wird zunächst auf Deutsch und Englisch angeboten;
die Sprache lässt sich im Profil auswählen.

Ein Markdown-Quelltexteditor mit Vorschau ermöglicht die Bearbeitung.
Änderungen werden ausdrücklich gespeichert; es gibt zunächst kein Autosave.
Vor dem Verlassen ungespeicherter Änderungen wird gewarnt. Dadurch erzeugen
Tipp-Pausen keine historischen Versionen.
Titel und Zusammenfassung stehen oberhalb des Editors, Tags darunter.
Auf großen Bildschirmen stehen Markdown und Vorschau nebeneinander, mobil
sind sie umschaltbar. Speichern ist per Button oder `Strg/Cmd+S` möglich.
Navigation und Vault-Wechsel warnen bei ungespeicherten Änderungen. Private
Entwürfe werden im MVP nicht dauerhaft im Browserspeicher abgelegt; bei
Konflikten bleibt der Entwurf im geöffneten Editor erhalten.

Jeder Datensatz hat eine eigene verlinkbare Seite mit Leseansicht und der
Aktion „Bearbeiten“. Die Rückkehr zur Suche erhält Suchtext, Filter und Position.
Nach Anmeldung öffnet sich die Suche im zuletzt verwendeten, noch vorhandenen
Vault. Ohne Suchtext erscheinen zuletzt geänderte Datensätze.
Ist der zuletzt verwendete Vault nicht verfügbar, wird ein vorhandener eigener
Vault gewählt. Ohne vorhandenen Vault erscheint „Vault anlegen“ im leeren Zustand.

Die Historie zeigt Zeitpunkt und Verursacher. Historische Versionen lassen
sich ansehen und als Textvergleich der Änderungen mit der aktuellen Fassung
vergleichen. Wiederherstellung verlangt eine ausdrückliche Bestätigung.
Nach Löschen eines Datensatzes wird eine kurze Rückgängig-Aktion angeboten.
Vault-Löschung verlangt einen Bestätigungsdialog mit Inhaltsanzahl; endgültiges
Löschen eine gesonderte Bestätigung. Externe Markdown-Bilder werden zunächst
blockiert und erst auf ausdrücklichen Klick geladen.

Die Webapp ist responsiv: Suche, Lesen und einfache Bearbeitung funktionieren
auch auf Smartphones. Eine separate native App gehört nicht zum MVP.
Die mobile Navigation ist einklappbar. Kernabläufe sind vollständig per
Tastatur bedienbar; der Fokus bleibt nach Dialogen und Aktionen nachvollziehbar.

Die grundlegende Navigation folgt einer vertrauten Anordnung:

- eine klassische Navigation auf der linken Seite,
- eine gut erreichbare Vault-Schnellauswahl oben links, sofern mehrere Vaults
  vorhanden sind,
- ein Profilbutton oben rechts mit kontobezogenen Aktionen wie Logout,
- eine prominent platzierte Suche als wesentlicher Einstieg zu den Inhalten.

Die normale Nutzeransicht konzentriert sich auf Suche, Datensätze, Tags und
Vaults. Adminfunktionen liegen in einem aus Navigationssicht separaten
Adminbereich, damit sie die alltägliche Nutzung nicht überfrachten.
Die linke Navigation enthält Suche, Datensätze, Tags, Papierkorb und
Vault-Einstellungen. Agentenzugänge und Profil sind kontoweit erreichbar;
der Adminbereich hat einen separaten Einstieg.

## Konten, Anmeldung und Einladungen

Es gibt keine öffentliche Registrierung. Der erste Admin richtet die
Installation über eine geführte Einrichtung ein; weitere Nutzer erhalten
ausschließlich Einladungen vom Admin. Einladungslinks dienen einmalig zur
Kontoeinrichtung mit E-Mail-Adresse
und Passwort. Sie gelten sieben Tage, sind widerrufbar und können zur manuellen
Weitergabe kopiert oder optional per SMTP versendet werden. Danach erfolgt
die reguläre Anmeldung mit E-Mail-Adresse und Passwort.
Einladungen sind an die vom Admin angegebene E-Mail-Adresse gebunden; beim
Einlösen ist diese nicht änderbar. Ohne SMTP dient sie als Anmeldename, ohne
behauptete Bestätigung der Mailbox-Inhaberschaft. Mit SMTP können Nutzer ihre
Adresse nach Passwortbestätigung und Bestätigung der neuen Adresse per Link
ändern. Ohne SMTP ändert der Admin sie nach persönlicher Abstimmung.

Mehrere Admins sind erlaubt. Der letzte aktive Admin darf weder gesperrt noch
gelöscht oder zum normalen Nutzer herabgestuft werden.

Neue Nutzer starten mit einem automatisch angelegten persönlichen Vault,
den sie umbenennen können.

Bereits im MVP ist Zwei-Faktor-Anmeldung per TOTP mit Wiederherstellungscodes
verfügbar. Sie ist für alle Nutzer freiwillig, auch für Administratoren, und
funktioniert ohne SMTP. Die Aktivierung erfolgt ausschließlich später im Profil.
Bei der Ersteinrichtung und der Kontoanlage gibt es weder einen 2FA-Schritt
noch eine Aufforderung zur Einrichtung.
Die Aktivierung verlangt das aktuelle Passwort und einen erfolgreichen
TOTP-Test. Abschalten oder Ersetzen verlangt Passwort plus TOTP oder einen
Wiederherstellungscode. Neue Wiederherstellungscodes machen alte ungültig.

Die gesamte Anwendung muss ohne SMTP-Server betreibbar sein. Ohne SMTP erzeugt
der Admin bei vergessenem Passwort einen einmaligen Reset-Link zur manuellen
Weitergabe. Mit konfiguriertem SMTP können Nutzer einen Reset-Link selbst
anfordern und per E-Mail erhalten. Reset-Links gelten jeweils eine Stunde.
Ein normaler Passwort-Reset lässt aktivierte 2FA bestehen und widerruft alle
Sitzungen und Agentenzugangsdaten.

Bei vollständig verlorenem zweiten Faktor kann der Admin einen gesonderten,
einmaligen Kontowiederherstellungslink mit einer Stunde Gültigkeit erzeugen.
Beim Einlösen wird ein neues Passwort gesetzt, 2FA zurückgesetzt und sämtliche
Sitzungen sowie Agentenzugangsdaten widerrufen. Für ausgesperrte Admins ist
derselbe Ablauf über einen dokumentierten Containerbefehl mit Infrastrukturzugriff
verfügbar.

Der Admin kann Konten sperren. Dadurch enden bestehende Sitzungen und die
Agentenzugänge des Kontos werden sofort unbrauchbar. Inhalte bleiben erhalten.
Nutzer können ihr eigenes Konto löschen; Admins können andere Konten löschen.
Nach ausdrücklicher Bestätigung werden Konto, Vaults, Historie und Zugänge
endgültig entfernt, ohne zusätzlichen Kontopapierkorb. Kontolöschung,
Rollenänderungen und umfassende Kontowiederherstellung verlangen erneut das
Passwort des Handelnden und bei aktivierter 2FA zusätzlich den zweiten Faktor.
Der Container-Wiederherstellungsweg setzt stattdessen Infrastrukturzugriff voraus.

## Vertrauen und Privatsphäre

Die Webapp gewährt Administratoren keinen direkten Zugriff auf Inhalte anderer
Konten. Die Anwendung setzt die Trennung der Konten und die Berechtigungen
der Agentenzugänge durch.

Diese Trennung ist jedoch keine Vertraulichkeitsgarantie gegenüber Personen
mit Zugriff auf die technische Infrastruktur: Der Betreiber kann die
gespeicherten Markdown-Inhalte technisch einsehen. Eine zusätzliche
Verschlüsselung der Datenbank oder Inhalte zum Schutz vor dem Betreiber ist
nicht vorgesehen.

Beim Login weist die Webapp klar auf diese Grenze hin. Andere Nutzer müssen
erkennen können, dass ihre Inhalte gegenüber dem Betreiber beziehungsweise
Personen mit entsprechendem Infrastrukturzugriff nicht geheim sind. Diese
Transparenz gehört zum Produkt und ist kein versteckter Hinweis in der
Dokumentation.

## Betriebsmodelle

### Selbst gehostet mit Internetzugriff

Der Betreiber stellt memoryaffe auf eigener Infrastruktur bereit. Insbesondere
der entfernte MCP-Zugang kann über das Internet für autorisierte Agenten
erreichbar gemacht werden. Authentifizierung, Berechtigungsprüfung und ein
geschützter Transport gehören zu diesem Betriebsmodell.

### Ausschließlich im lokalen Netz

memoryaffe soll auch vollständig im lokalen Netz betrieben werden können,
ohne öffentliche Erreichbarkeit. Für Agenten, die ausschließlich die CLI
verwenden, ist dies ein vorgesehener Betriebsmodus. Die Webapp ist dabei lokal
erreichbar. Ziel ist, denselben MCP-Server auch ausschließlich im Heimnetz
erreichbar betreiben zu können. Ob zusätzlich eine lokale Prozessanbindung
benötigt wird, wird anhand der vorgesehenen Clients geprüft.

### Installation und laufender Betrieb

Docker Compose ist der primäre Installationsweg mit Anwendung und PostgreSQL.
Eine dokumentierte Beispielkonfiguration gehört zum MVP. Im laufenden Betrieb
sind keine Cloud-Dienste verpflichtend; es gibt keine Telemetrie und keine
eigene KI-Anbindung. Rein lokale Nutzung erfordert keinen Internetzugriff.
Der MVP betreibt genau eine Anwendungsinstanz plus PostgreSQL, ohne
Clusterbetrieb oder Hochverfügbarkeitsversprechen. Dokumentiert werden Betrieb
mit optionalem mitgeliefertem Reverse Proxy und hinter einem vorhandenen Proxy.
HTTPS gilt auch im LAN; unverschlüsseltes HTTP ist nur für lokale Entwicklung
vorgesehen.

Eine fest konfigurierte Basis-URL gilt für Webapp, Links und OAuth. Ein
Domainwechsel ist eine bewusste Betreiberaktion und erfordert erneutes
Verbinden der MCP-Clients. Datenbank, Basis-URL und SMTP werden über
Umgebungsvariablen beziehungsweise Secret-Dateien konfiguriert, persönliche
Nutzereinstellungen über die Webapp.

Updates werden bewusst vom Betreiber durchgeführt. Zum Veröffentlichungsprozess
gehören Versionshinweise, Datenbankmigrationen und eine Anleitung zur vorherigen
Sicherung.
Containerimages sind versioniert und Versionen werden ausdrücklich gewählt;
automatische Updates gibt es nicht. Migrationen laufen beim Start; bei Fehlern
bleibt die Anwendung nicht bereit.

Serverimages werden als Linux-Container für `amd64` und `arm64` ausgeliefert.
Die CLI erscheint als eigenständiger Download für Windows, Linux und macOS,
jeweils für `amd64` und `arm64`, mit Prüfsummen. GitHub Releases enthalten CLI
und Versionshinweise, die GitHub Container Registry die Images. Veröffentlichung
erfolgt erst nach erfolgreichen automatisierten Prüfungen. Zusätzliche
Paketmanager-Repositories gehören zunächst nicht zum Umfang.

Der separate Adminbereich zeigt Anwendungsversion, Systemzustand und
Speicherverbrauch. Betriebslogs enthalten standardmäßig keine Markdown-Inhalte,
Passwörter oder Zugangsschlüssel.
Getrennte Zustandsprüfungen melden laufenden Prozess und Betriebsbereitschaft;
öffentliche Antworten enthalten keine internen Details. Vor Veröffentlichung
werden Suche, Import und Versionierung mit dokumentiertem Testdatenbestand
und angegebener Hardware gemessen. Ungeprüfte Leistungszusagen gibt es nicht.

## Technische Ausrichtung

Die technische Grundlage orientiert sich an planaffe:

- .NET 10 für das Backend,
- PostgreSQL als Datenbank,
- React für die Webapp.

Die konkrete Architektur und gemeinsame Konventionen mit planaffe sind in
[ARCHITECTURE.md](ARCHITECTURE.md) festgelegt. Self-Hosting, kleine Mehrbenutzerinstallationen und
der Betrieb ohne SMTP sind dabei grundlegende Anforderungen.

## Umfang der ersten Version

Zum MVP gehören Webapp, CLI und ein echter Remote-MCP-Zugang, einschließlich
der hier festgelegten Berechtigungen, Versionierung, Suche, Papierkörbe,
Kontoverwaltung und Datenmitnahme. Semantische Suche und zusätzliche
Komfortfunktionen folgen später.

## Planungsstand und ausstehende Abnahmen

- **MCP-Kompatibilität:** ChatGPT wird als erster Client getestet, Claude
  anschließend. Anhand dieser Clients wird auch der Bedarf für eine zusätzliche
  lokale Prozessanbindung geprüft.
- **Agentenauthentifizierung:** CLI-Tokens sowie eigene OAuth-Implementierung
  mit CIMD sind beschlossen und im Protokollvertrag ausgearbeitet. Der Nutzer
  hat den realen ChatGPT-Test ausdrücklich hinter den Prototypenbau verschoben;
  der Bau darf vorher starten, Kompatibilität bleibt bis zum Test ungeprüft.
- **Datenmitnahme und Betriebssicherung:** ZIP-/Metadatenformat, Importablauf
  und Umfang der Installationssicherung stehen fest. Die praktische Backup- und
  Wiederherstellungsprobe erfolgt während der Umsetzung.
- **Autonome Umsetzung:** [AGENT_HANDOFF.md](AGENT_HANDOFF.md) bündelt Verträge,
  Arbeitspakete und Abnahmen. Keine weiteren notwendigen Produktfragen vor dem
  ersten Grundgerüst; die Anwendung ist noch zu implementieren und zu prüfen.

## Zielbild

Ein Nutzer kann memoryaffe selbst betreiben, sein Wissen als Markdown in einem
oder mehreren Vaults pflegen und gezielt für seine KI-Agenten freigeben. Die
Agenten nutzen dieses Wissen dauerhaft über CLI oder MCP. Eine suchorientierte
Webapp hält die Inhalte für den Nutzer sichtbar und bearbeitbar. Weitere
Mitglieder eines vertrauten Haushalts können eigene Konten verwenden und
werden verständlich über die Einsichtsmöglichkeiten des Betreibers informiert.
