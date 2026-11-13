# Technische Abbildung der Browserverträge

Stand: 13. November 2026. Technische Konkretisierung der bestätigten Regeln.
[web.openapi.json](web.openapi.json) definiert 74 Browseroperationen einschließlich
der acht gemeinsamen Inhaltsfunktionen. Dieses Dokument regelt deren Semantik;
es ist keine Behauptung über eine vorhandene Implementierung.

## Transport und Fehler

Produktpfade `/api/v1`, JSON camelCase, keine DELETE-Bodies. GET verändert keine
Fachdaten. Browseraufrufe verwenden ausschließlich Cookieauthentifizierung;
Agenten-Bearer werden nur an der gemeinsamen Agenten-Datenfläche akzeptiert.
Bei Cookie und Authorization-Header im selben Request: `400/validation_failed`,
keine Prioritätsheuristik. Gemeinsame Pfade wählen ihre Antwortform anhand der
expliziten Authentifizierungsart (beispielsweise zusätzliche Vault-Revisionen
für Browser); Fachoperation und Autorisierungsprüfung bleiben zentral.

Sitzungscookie: `__Host-memoryaffe-session`, Path=/, Secure, HttpOnly,
SameSite=Lax, kein Domain-Attribut. Für lokale HTTP-Entwicklung separater
unpräfixierter Cookiename; Produktionskonfiguration darf dies nicht aktivieren.
CSRF-Requesttoken aus GET `/auth/csrf` im Header `X-CSRF-Token`; ASP.NET Core
verwaltet das zugehörige Secure/HttpOnly-Antiforgery-Cookie. Requesttoken nur
im Arbeitsspeicher, nach Identitätswechsel neu holen. Alle POST/PATCH/DELETE-
Browseroperationen einschließlich anonymer Auth-Flows prüfen CSRF. Keine
Cross-Origin-Credentials-Freigabe. Proxy-Forwarding nur von konfigurierten
vertrauenswürdigen Proxies, feste öffentliche Basis-URL.

Authentifizierungs-, Profil-, Inhalts- und Secret-Antworten verwenden
`Cache-Control: no-store`. Fehler nutzen den gemeinsamen Error-Typ; zusätzliche
Browsercodes sind:

| HTTP | Code | Bedeutung |
|---|---|---|
| 403 | csrf_failed | Nachweis fehlt/ungültig; neu holen, Schreibaktion nicht blind wiederholen |
| 403 | reauthentication_required | Aktionsnachweis fehlt, abgelaufen oder passt nicht |
| 410 | flow_expired | Anmelde-/Einrichtungsablauf abgelaufen; neu beginnen |
| 410 | import_expired | Eigene Importvorbereitung abgelaufen/ersetzt |
| 409 | last_admin_required | Letzter aktiver Admin würde entfernt |
| 503 | smtp_unavailable | E-Mail-abhängiger Vorgang momentan nicht möglich |

Falsches Passwort/Faktor: generischer 401-Fehler, keine Auskunft über fremde
Konten. Passwort-Reset-Anfrage liefert stets dieselbe 200-Antwort, auch ohne
SMTP oder bei unbekannter Adresse. Unbekannte/fremde Flow- oder Import-IDs
ergeben 404; 410 darf nur eigene bekannte Vorbereitungen identifizieren.
Fachlich gesperrte aktive Operationen ergeben 403. Anonyme Einmalgeheimnisse
werden bei ungültigem/verbrauchtem Token einheitlich abgewiesen.

## Anmelde- und Einmalabläufe

Login liefert entweder `authenticated` plus Profil und Sitzungscookie oder
`secondFactorRequired` plus Ablaufzeit. Im zweiten Fall speichert ein separates
Secure/HttpOnly/SameSite=Lax-Cookie nur eine zufällige Flow-Referenz; keine volle
Sitzung. Server hält Konto, rememberMe, Ablauf und Fehlversuche. Faktorabschluss
verbraucht Flow und ggf. Recovery-Code transaktional. Passwortänderung, Sperre
und Reset entwerten offene Auth-Flows. Einrichtung und Einladung erzeugen nach
Erfolg eine Sitzung; Reset/Wiederherstellung führen dagegen zur normalen
Anmeldung und umgehen keine erhaltene 2FA.

Einladungs-/Reset-/Recovery-Links tragen das einmalige Geheimnis im URL-Fragment,
nicht im Query. Die gleichursprüngliche Webapp übernimmt es in den Arbeitsspeicher,
entfernt das Fragment sofort aus dem Verlauf und sendet das Token erst beim
ausdrücklichen POST. Öffnen/Linkscanner verbrauchen nichts. Referrer-Policy
`no-referrer`; keine fremden Ressourcen auf diesen Seiten. Manuelle Links werden
nur bei Ausgabe gezeigt, nie in Listen. Einladungsemail ist serverseitig gebunden.
SMTP-Ausfall bei optional versandtem Adminlink liefert `delivery: failed` mit
weiter verwendbarem manuellem Link. Bestehende Einladungen können widerrufen und
neu erstellt, nicht mit ihrem Geheimnis erneut ausgelesen werden.

E-Mail-Änderung mit SMTP bindet alten Kontostand, neue Adresse und Bestätigung;
Token eine Stunde, einmalig. Änderung ohne SMTP ist administrative Änderung
und erfordert Aktionsbestätigung, da sie die Anmeldeidentität verändert. E-Mail
ist nach Standardvalidierung außen getrimmt, Identitätsvergleich wie Identity
normalisiert, eindeutiger Index; keine Gmail-Punkt-/Plus-Adressheuristik.
E-Mail-Änderung ohne Nachweis markiert `emailVerified=false`. Sichtbarkeit des
Infrastruktur-Vertrauenshinweises bei jeder Loginansicht bleibt verpflichtend.

## Aktionsbestätigung und sensible Antworten

POST `/me/reauthenticate` enthält Passwort, ggf. Faktor und `request` mit
Operation-ID, Pfadwerten, Querywerten und dem vollständigen vorbereiteten Body.
Das Schema begrenzt die möglichen Aufträge ausdrücklich. Server prüft diesen
Auftrag und bindet den Nachweis an einen kanonischen Fingerprint. Fachliche
Reihenfolgeirrelevanz gilt wie bei Idempotenz; keine Speicherung des Passworts.
Der tatsächliche Aufruf sendet den Nachweis im Header `X-Action-Proof`.
Passwort/Faktor werden nicht an jeder Fachroute erneut übertragen.

Bedingt nötig bei Agenten-PATCH nur für neue Vault-Rechte oder höhere Stufen,
bei Profil-PATCH für false→true der Agenten-Tag-Erlaubnis, bei Admin-PATCH für
Rollen-/E-Mail-Änderung und bei Einladung mit Adminrolle. Normale Rechteverringerung
bleibt ohne Nachweis. Neue CLI-Zugänge starten ausdrücklich ausgewählt; ihre
Erstellung und die getrennte Tokenausgabe werden bestätigt. OAuth-Zugänge
entstehen ausschließlich im OAuth-Ablauf; CLI-Tokenausgabe für OAuth-Zugänge
wird abgewiesen. Grant-Duplikate und fremde Vaults sind ungültig.

Token-/Recovery-Code-Ausgabe ist nicht über allgemeine Idempotenz erneut im
Klartext abrufbar. Bei verlorener Tokenantwort vorhandenes Credential anhand
der Metadaten widerrufen und neu ausgeben; bei verlorenen Recovery-Codes nach
erneuter Bestätigung neue erzeugen. Niemals Secrets in Request-/Response-Logs.
TOTP-Setup gilt zehn Minuten; ein zweites Setup ersetzt die Vorbereitung,
nicht die bestehende aktive Konfiguration. Aktivierung/Ersetzung verlangt
Bestätigung des neuen Codes. Recovery-Codes mindestens 128 Bit Entropie, zehn
Codes, Hashspeicherung; TOTP-Secret muss dagegen mit persistiertem ASP.NET
Data-Protection-Schlüssel geschützt wieder entschlüsselbar sein. Das ist kein
Schutz der Markdown-Inhalte vor dem Infrastrukturbetreiber.

TOTP verwendet den Identity-kompatiblen Standard mit sechs Dezimalstellen,
30-Sekunden-Schritten, HMAC-SHA1 und höchstens einem Zeitschritt Toleranz vor/zurück.
Bereits erfolgreich verwendete Zeitschritte werden je Konto atomar gespeichert,
um Wiederverwendung desselben Codes zu verhindern. Wiederholungen aus Netzwerk-
fehlern erzeugen keine zweite Sitzung. Die UI erklärt den nächsten Zeitschritt,
statt die Prüfung zu lockern. Recovery-Codes bleiben der getrennte Notfallweg.

## Verwaltung, Listen und Lebenszyklus

Verwaltungsrevisionen beginnen bei 1; zu prüfende Revision im Body oder bei
DELETE in der Query. Agentenrevision steigt auch bei Tokenrotation und
Vault-bedingtem Grantentzug. Profil-/Admin-Ansichten verwenden dieselbe
Kontoverwaltungsrevision. Anmeldezeiten und Anzeigepräferenzen ändern diese
Revision nicht. Beschlossene Tagaktionen versionieren betroffene aktuelle
Datensätze einschließlich Papierkorb unter atomarem Konkurrenzschutz.

Listen: Standard 20/maximal 100, Cursor30min, Bindung an Nutzer, Route, Filter
und Sortierung. Namenlisten nach normalisiertem Namen/ID; Konten nach
normalisierter E-Mail/ID; Sitzungen letzte Aktivität absteigend/ID;
Historie Revision numerisch absteigend; Papierkorb Löschzeit absteigend/ID;
Einladungen/Tokens Erstellung absteigend/ID. Kein impliziter eigener
Verwaltungsscope für Agenten.

Versionsvorschau nennt wiederzuverwendende und neu anzulegende Tags; Restore
prüft aktuelle Revision erneut. Zwischenzeitliche Tagänderungen erfordern
erneute Vorschau, falls die bestätigte Zuordnung nicht mehr passt. Dazu die
Vorschau serverseitig an Tag-Katalogstand binden: `restoreToken` gilt fünf Minuten
für Konto, Datensatz, Quell-/Zielrevision und Tag-Zuordnung. Abweichung ergibt
409/revision_conflict und verlangt erneute Vorschau. Historische Snapshot-Tagnamen
bleiben erhalten.

Importvalidierung empfängt multipart `archive`; eigentliche ZIP-Grenze 100 MiB,
Transportgrenze 101 MiB wegen Multipart-Overhead. Entpackte Bytes werden laufend
gezählt. Kein unkontrolliertes Entpacken ins Dateisystem; Dateien über geprüfte
ZIP-Einträge lesen. JSON-Manifest streamend innerhalb der 500-MiB-Gesamtgrenze
prüfen, ohne zusätzliche kleinere Inhaltsgrenze. Nullbytes,
ungültiges UTF-8, doppelte JSON-Schlüssel und ZIP-Namen, Verschlüsselung,
Symlinks und Sonderdateien abweisen. Nicht prüfbare Archive sind ungültig.
Semantisch gleiche UUIDs werden vor Zuordnung kanonisiert. Ablauf beginnt nach
erfolgreicher Prüfung. POST `/imports` verlangt Idempotency-Key und nutzt
zusätzlich eine eindeutige Ergebnisbindung pro preparationId. Nach Erfolg
wird die Archivdatei entfernt; nur Ergebnisreferenz bleibt 24 Stunden.
Abbruch einer bereits abgeschlossenen Vorbereitung löscht niemals den Vault.

## Diagnose und Abgrenzung

Admin-Diagnose liefert aggregierte Datenbank-/Temporärgröße, Version, Laufzeit
und Datenbankbereitschaft. Keine Vaultnamen, Datensätze oder Inhaltsausschnitte
anderer Konten. Öffentliche GET `/health/live` und `/health/ready`: 200 bei
Erfolg, Readiness503 bei nicht bereit, keine internen Details. Diagnose und
Adminrollen ermöglichen keinen versteckten Inhaltszugriff.
