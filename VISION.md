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
werden können. Die genaue technische Speicherung von Markdown-Inhalten und
Metadaten bleibt eine Implementierungsentscheidung.

### Versionierung und Aufbewahrung

Änderungen an Markdown-Inhalten werden versioniert, unabhängig davon, ob sie
über die Webapp, die CLI oder MCP erfolgen. Die Versionshistorie wird nur
begrenzt aufbewahrt. Nutzer können die Aufbewahrungsgrenze einstellen,
beispielsweise auf maximal X Versionen je Datensatz. Wird diese Grenze
überschritten, werden die ältesten Versionen automatisch entfernt; der aktuelle
Inhalt bleibt erhalten.

Der genaue Geltungsbereich der Einstellung, der Standardwert und die Zählweise
der aktuellen Fassung gegenüber historischen Versionen werden bei der
Umsetzung festgelegt.

### Vaults

Vaults bilden die oberste Ebene der Inhaltshierarchie. Jeder Datensatz gehört
zu einem Vault. Nutzer entscheiden, ob sie ihr gesamtes Wissen in einem großen
Vault sammeln oder auf mehrere Vaults verteilen.

Nur Nutzer dürfen Vaults anlegen und löschen; Agenten erhalten diese Befugnis
nicht. Jeder Agentenzugang wird ausdrücklich für einen oder mehrere Vaults
freigeschaltet. Zugriffe und Suchergebnisse bleiben auf diese freigegebenen
Vaults begrenzt.

### Tags

Tags ergänzen die Organisation innerhalb der Vault-Struktur und unterstützen
das Wiederfinden von Inhalten. Nutzer legen fest, ob Agenten generell neue
Tags anlegen dürfen oder ob ausschließlich Nutzer dies über die Webapp tun
dürfen. Das Zuweisen vorhandener Tags zu Datensätzen ist davon zu unterscheiden.
Die gewählte Regel muss auch bei Zugriffen über CLI und MCP durchgesetzt werden.

## Zugriff durch KI-Agenten

memoryaffe bietet zwei gleichwertig gedachte Zugangswege für die Arbeit mit
Erinnerungen: eine CLI und eine MCP-Schnittstelle. Über beide sollen Agenten
innerhalb ihrer freigegebenen Vaults:

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

## Webapp und Bedienung

Die Benutzeroberfläche ist eine moderne, klare Webapp mit Darkmode. Sie dient
als direkter Zugang zum eigenen Langzeitgedächtnis und zur Verwaltung der
Agentenzugänge.

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

Die reguläre Anmeldung erfolgt mit E-Mail-Adresse und Passwort. Zusätzlich
soll ein Zugang über Einladungslinks möglich sein. Einladungslinks können
manuell weitergegeben werden; ihr Versand darf keinen Mailserver voraussetzen.

Die gesamte Anwendung muss ohne SMTP-Server betreibbar sein. Optional kann
ein SMTP-Server für den E-Mail-Versand konfiguriert werden. Kontoeinrichtung und
Kontowiederherstellung müssen diesen Betrieb ohne SMTP berücksichtigen; die
genauen Abläufe werden noch festgelegt.

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
erreichbar. Ob und wie zusätzlich ein lokaler MCP-Betrieb unterstützt wird,
wird gesondert evaluiert.

## Technische Ausrichtung

Die technische Grundlage orientiert sich an planaffe:

- .NET 10 für das Backend,
- PostgreSQL als Datenbank,
- React für die Webapp.

Die konkrete Architektur und gemeinsame Konventionen mit planaffe werden bei
der Umsetzung festgelegt. Self-Hosting, kleine Mehrbenutzerinstallationen und
der Betrieb ohne SMTP sind dabei grundlegende Anforderungen.

## Offene Produkt- und Architekturentscheidungen

- **Lokales MCP:** Welche Transport- und Betriebsvarianten sind für rein lokale
  Installationen sinnvoll und mit den vorgesehenen Agenten kompatibel?
- **Suche:** Welche Suchverfahren, Filter und Suchbereiche werden angeboten?
  Volltextsuche, semantische Suche und deren Kombination sind noch nicht festgelegt.
- **Tag-Geltungsbereich:** Gelten Tags und die Erlaubnis zur Tag-Erstellung pro
  Konto, pro Vault oder auf einer anderen Ebene?
- **Einladungslinks:** Dienen sie der erstmaligen Kontoeinrichtung oder auch
  späteren Anmeldungen? Gültigkeit und Wiederverwendbarkeit sind zu definieren.
- **Konten ohne SMTP:** Wie funktionieren insbesondere Passwortzurücksetzung
  und Kontowiederherstellung?
- **Agentenzugänge:** Wie werden Zugangsdaten ausgegeben, verwaltet und
  widerrufen? Sind neben Vault-Freigaben feinere Rechte erforderlich?
- **Löschen von Vaults:** Wie werden enthaltene Datensätze behandelt und
  unbeabsichtigte Datenverluste vermieden?
- **Datenkontrolle im Betrieb:** Welche Export-, Backup- und
  Wiederherstellungswege unterstützen den Anspruch voller Datenkontrolle?

## Zielbild

Ein Nutzer kann memoryaffe selbst betreiben, sein Wissen als Markdown in einem
oder mehreren Vaults pflegen und gezielt für seine KI-Agenten freigeben. Die
Agenten nutzen dieses Wissen dauerhaft über CLI oder MCP. Eine suchorientierte
Webapp hält die Inhalte für den Nutzer sichtbar und bearbeitbar. Weitere
Mitglieder eines vertrauten Haushalts können eigene Konten verwenden und
werden verständlich über die Einsichtsmöglichkeiten des Betreibers informiert.
