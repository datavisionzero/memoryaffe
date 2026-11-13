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

### Versionierung und Aufbewahrung

Eine Version umfasst Markdown-Inhalt, Titel, Zusammenfassung und zugewiesene
Tags. Jede tatsächliche Änderung erzeugt eine Version, unabhängig davon, ob
sie über die Webapp, die CLI oder MCP erfolgt.

Zu jeder Änderung werden Zeitpunkt und Verursacher gespeichert: der Nutzer
oder der benannte Agentenzugang. Diese Angaben sind in der Historie sichtbar.

Standardmäßig bleiben pro Datensatz 20 historische Versionen zusätzlich zur
aktuellen Fassung erhalten. Nutzer können dieses Limit pro Vault einstellen;
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

### Vaults

Vaults bilden die oberste Ebene der Inhaltshierarchie. Jeder Datensatz gehört
zu einem Vault. Nutzer entscheiden, ob sie ihr gesamtes Wissen in einem großen
Vault sammeln oder auf mehrere Vaults verteilen.

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

Agenten mit Schreibrechten dürfen vorhandene Tags an einzelnen Datensätzen
hinzufügen oder entfernen. Neue Tags dürfen sie nur mit Schreibrechten im
betreffenden Vault und bei entsprechender kontoweiter Erlaubnis anlegen.
Tags umbenennen, zusammenführen oder vollständig entfernen darf ausschließlich
der Nutzer. Diese Regeln gelten gleichermaßen für CLI und MCP.

### Löschen und Papierkorb

Gelöschte Datensätze bleiben einschließlich ihrer noch vorhandenen Versionen
30 Tage im Papierkorb und werden danach endgültig entfernt. Sie erscheinen
nicht in der Suche und sind über den regulären Agentenzugriff nicht erreichbar.
Nur der Nutzer darf sie wiederherstellen oder vorzeitig endgültig löschen.

Vaults werden nach ausdrücklicher Bestätigung durch den Nutzer ebenfalls für
30 Tage in den Papierkorb verschoben, einschließlich ihrer enthaltenen
Datensätze. Agentenzugriffe sind sofort ausgeschlossen. Nach einer
Wiederherstellung muss der Nutzer den Vault erneut für Agenten freigeben.

## Suche

Der MVP bietet Volltextsuche über Titel, Zusammenfassung und Markdown-Inhalt
sowie Tag-Filter. Die Suche erfolgt standardmäßig im aktuellen Vault, optional
über alle eigenen Vaults. Agenten können ausschließlich ihre freigegebenen
Vaults durchsuchen. Semantische Suche ist eine spätere Erweiterung.

Suchergebnisse zeigen Titel, Zusammenfassung beziehungsweise Textausschnitt,
Tags, Vault und Änderungsdatum. Standardmäßig werden sie nach Relevanz
sortiert, alternativ nach Änderungsdatum.

## Export, Import und Backups

Bereits im MVP können Nutzer einen Vault als ZIP mit Markdown-Dateien und
strukturierten Metadaten exportieren und wieder importieren. Der Export
umfasst zunächst die aktuellen Fassungen einschließlich Tags. Der Import
erstellt einen neuen Vault und überschreibt keine bestehenden Inhalte.

Zusätzlich wird ein Weg zur Sicherung und Wiederherstellung der gesamten
Installation dokumentiert. Diese Sicherung umfasst auch Konten, Einstellungen
und die noch aufbewahrten Versionen.

## Zugriff durch KI-Agenten

Nutzer können beliebig viele benannte Agentenzugänge anlegen, beispielsweise
„Coding-Agent“ oder „Persönlicher Assistent“, und jeden Zugang einzeln widerrufen.
Je Zugang und freigegebenem Vault wählen sie eine von drei aufeinander
aufbauenden Berechtigungsstufen:

1. Lesen und Suchen.
2. Zusätzlich Anlegen und Bearbeiten.
3. Zusätzlich Löschen.

Vault-Verwaltung bleibt unabhängig von diesen Stufen ausschließlich beim Nutzer.

memoryaffe bietet zwei gleichwertig gedachte Zugangswege für die Arbeit mit
Erinnerungen: eine CLI und eine MCP-Schnittstelle. Über beide sollen Agenten
innerhalb ihrer freigegebenen Vaults und entsprechend ihrer Berechtigungsstufe:

- Datensätze lesen,
- neue Datensätze schreiben,
- Inhalte suchen,
- bestehende Datensätze und ihre Metadaten bearbeiten,
- Datensätze löschen können.

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

Die Webapp zeigt je Agentenzugang passende Verbindungsinformationen und
kopierbare Konfigurationsbeispiele. Die konkreten Authentifizierungsverfahren
werden nach Prüfung der vorgesehenen MCP-Clients festgelegt.

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

Die Webapp ist responsiv: Suche, Lesen und einfache Bearbeitung funktionieren
auch auf Smartphones. Eine separate native App gehört nicht zum MVP.

Die grundlegende Navigation folgt einer vertrauten Anordnung:

- eine klassische Navigation auf der linken Seite,
- eine gut erreichbare Vault-Schnellauswahl oben links, sofern mehrere Vaults
  vorhanden sind,
- ein Profilbutton oben rechts mit kontobezogenen Aktionen wie Logout,
- eine prominent platzierte Suche als wesentlicher Einstieg zu den Inhalten.

Die normale Nutzeransicht konzentriert sich auf Suche, Datensätze, Tags und
Vaults. Adminfunktionen liegen in einem aus Navigationssicht separaten
Adminbereich, damit sie die alltägliche Nutzung nicht überfrachten.

## Konten, Anmeldung und Einladungen

Es gibt keine öffentliche Registrierung. Der erste Admin richtet die
Installation über eine geführte Einrichtung ein; weitere Nutzer erhalten
ausschließlich Einladungen vom Admin. Einladungslinks dienen einmalig zur
Kontoeinrichtung mit E-Mail-Adresse
und Passwort. Sie gelten sieben Tage, sind widerrufbar und können zur manuellen
Weitergabe kopiert oder optional per SMTP versendet werden. Danach erfolgt
die reguläre Anmeldung mit E-Mail-Adresse und Passwort.

Neue Nutzer starten mit einem automatisch angelegten persönlichen Vault,
den sie umbenennen können.

Bereits im MVP ist Zwei-Faktor-Anmeldung per TOTP mit Wiederherstellungscodes
verfügbar. Sie ist für alle Nutzer freiwillig, auch für Administratoren, und
funktioniert ohne SMTP. Die Aktivierung erfolgt ausschließlich später im Profil.
Bei der Ersteinrichtung und der Kontoanlage gibt es weder einen 2FA-Schritt
noch eine Aufforderung zur Einrichtung.

Die gesamte Anwendung muss ohne SMTP-Server betreibbar sein. Ohne SMTP erzeugt
der Admin bei vergessenem Passwort einen einmaligen Reset-Link zur manuellen
Weitergabe. Mit konfiguriertem SMTP können Nutzer einen Reset-Link selbst
anfordern und per E-Mail erhalten. Reset-Links gelten jeweils eine Stunde.

Der Admin kann Konten sperren. Dadurch enden bestehende Sitzungen und die
Agentenzugänge des Kontos werden sofort unbrauchbar. Inhalte bleiben erhalten.

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

Updates werden bewusst vom Betreiber durchgeführt. Zum Veröffentlichungsprozess
gehören Versionshinweise, Datenbankmigrationen und eine Anleitung zur vorherigen
Sicherung.

Der separate Adminbereich zeigt Anwendungsversion, Systemzustand und
Speicherverbrauch. Betriebslogs enthalten standardmäßig keine Markdown-Inhalte,
Passwörter oder Zugangsschlüssel.

## Technische Ausrichtung

Die technische Grundlage orientiert sich an planaffe:

- .NET 10 für das Backend,
- PostgreSQL als Datenbank,
- React für die Webapp.

Die konkrete Architektur und gemeinsame Konventionen mit planaffe werden bei
der Umsetzung festgelegt. Self-Hosting, kleine Mehrbenutzerinstallationen und
der Betrieb ohne SMTP sind dabei grundlegende Anforderungen.

## Umfang der ersten Version

Zum MVP gehören Webapp, CLI und ein echter Remote-MCP-Zugang, einschließlich
der hier festgelegten Berechtigungen, Versionierung, Suche, Papierkörbe,
Kontoverwaltung und Datenmitnahme. Semantische Suche und zusätzliche
Komfortfunktionen folgen später.

## Offene Produkt- und Architekturentscheidungen

- **MCP-Kompatibilität:** ChatGPT wird als erster Client getestet, Claude
  anschließend. Anhand dieser Clients wird auch der Bedarf für eine zusätzliche
  lokale Prozessanbindung geprüft.
- **Agentenauthentifizierung:** Wie werden Zugangsdaten technisch ausgegeben
  und der Widerruf umgesetzt? Die benannten Zugänge und Berechtigungsstufen
  pro Vault sind festgelegt.
- **Datenmitnahme und Betriebssicherung:** Das genaue ZIP- und Metadatenformat
  sowie die technischen Backup- und Wiederherstellungsabläufe sind festzulegen.
  Der Funktionsumfang von Export, Import und Installationssicherung steht fest.

## Zielbild

Ein Nutzer kann memoryaffe selbst betreiben, sein Wissen als Markdown in einem
oder mehreren Vaults pflegen und gezielt für seine KI-Agenten freigeben. Die
Agenten nutzen dieses Wissen dauerhaft über CLI oder MCP. Eine suchorientierte
Webapp hält die Inhalte für den Nutzer sichtbar und bearbeitbar. Weitere
Mitglieder eines vertrauten Haushalts können eigene Konten verwenden und
werden verständlich über die Einsichtsmöglichkeiten des Betreibers informiert.
