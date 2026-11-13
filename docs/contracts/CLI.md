# CLI-Vertrag für den Prototypen

Binärname `memoryaffe`, keine lokale Datenbank und kein Offline-Synchronisieren.
CLI spricht ausschließlich die Agenten-HTTP-API. Alle Operationen laufen ohne
Rückfragen, außer ausdrücklich gewähltem `profile configure --interactive`.
JSON-Flag global `--json`, Profilwahl `--profile NAME`, Hilfe `--help`, Version
`--version`. Fehlende Pflichtangaben ergeben Exit2, niemals wartenden Prompt.

| Befehl | Wesentliche Eingabe / Ergebnis |
|---|---|
| `profile configure --interactive` | Profilname, HTTPS-Server, verdeckte Tokenabfrage; ausdrückliche Frage nach Speicherung |
| `profile list` | Namen, Server und Standardmarkierung, keine Tokens |
| `profile use NAME` | Standardprofil wählen |
| `profile remove NAME` | Lokale Profilreferenz löschen, kein Serverwiderruf |
| `doctor` | Erreichbarkeit, Authentifizierung, erste Vaultseite; keine Inhalte ändern |
| `vault list` | `--page-size`, `--cursor` |
| `tag list --vault ID` | Pagination |
| `tag create --vault ID --name TEXT` | Explizite Tag-Erstellung, optionale `--idempotency-key` |
| `memory search --vault ID` oder `--all-vaults` | `--query TEXT`, wiederholtes `--tag ID`, `--tag-match all/any`, `--sort relevance/updatedAt`, Pagination |
| `memory get ID` | Vollständiges aktuelles Memory |
| `memory create --vault ID --title TEXT --file PATH` | `--stdin` statt Datei, optional `--summary TEXT`, wiederholtes `--tag ID` |
| `memory update ID --revision REV` | Nur angegebene Felder: `--title`, `--file`/`--stdin`, `--summary`, `--clear-summary`, wiederholtes `--tag`, `--clear-tags` |
| `memory delete ID --revision REV` | Softdelete; vollständige Angaben gelten als Auftrag, keine interaktive Zusatzfrage |

Keine Agentenbefehle für Vaultanlage/-löschung, Historie, Moves, Papierkorb,
Konten oder Tokenverwaltung. `--file` und `--stdin` schließen sich aus;
`--summary`/`--clear-summary` und `--tag`/`--clear-tags` ebenfalls. Leere stdin-
Datei ist gültiges leeres Markdown. Kein implizites Lesen von stdin ohne Flag.
UTF-8 strikt prüfen, Bytes und Zeilenumbrüche erhalten. Record-Tagliste im
Update ersetzt die Menge; Weglassen erhält sie. Kein implizites Taganlegen.

Automatisch zufällige UUIDv4 pro Schreibauftrag als Idempotency-Key; explizites
`--idempotency-key` ermöglicht Wiederholung über Prozessstarts. Dasselbe Key
über alle internen Versuche. `--revision` bleibt dezimale Zeichenfolge.
Keine automatische Konfliktauflösung oder erneutes Lesen mit Überschreiben.

Token aus `MEMORYAFFE_TOKEN` hat Vorrang vor ausdrücklich gespeicherten
Profiltokens. `MEMORYAFFE_SERVER` erlaubt nichtinteraktive einmalige Konfiguration;
zusammen mit Umgebungs-Token ist kein gespeichertes Profil nötig. Kein Tokenflag.
Profilpfad OS-konform (Windows LocalAppData, Linux XDG_CONFIG_HOME,
macOS Application Support). Speicherung atomar mit Owner-Only-Rechten;
Windows explizite ACL, Unix0600/Verzeichnis0700. Fehler bei Rechtevergabe statt
stiller unsicherer Datei. Nicht interaktive Konfiguration speichert nie Tokens
ungefragt. Profil/list/doctor/Fehler dürfen Secrets nicht ausgeben.

TLS standardmäßig prüfen, Systemtrust plus optional `--ca-file PATH` für LAN.
Kein allgemein beworbenes `--insecure`. HTTP nur expliziter localhost-Entwicklungs-
modus. Redirects mit Authorization nicht an andere Origins weiterreichen.
Verbindungs-/Requesttimeout10s/30s. Höchstens drei Versuche insgesamt bei
Netzwerkfehlern,429 und503, Backoff250ms/1s mit Jitter; Retry-After beachten bis
maximal30s, sonst Fehler samt Wiederholungshinweis. Writes nur mit gleichem Key,
nie erneute automatische Übermittlung bei409 revision_conflict.

JSON auf stdout entspricht dem API-Ergebnis; Fehler ebenfalls strukturierter
Error auf stdout im JSON-Modus, Diagnosetexte ausschließlich stderr. Menschliche
Ausgabe standardmäßig kompakt mit ID/Revision und verständlichen Fehlermeldungen.
Exitcodes aus API_CONTRACT.md: 0 Erfolg,1 sonstig,2 Eingabe,3 Anmeldung,4 Rechte,
5 nicht gefunden,6 Konflikt,7 Rate-Limit,8 Netzwerk/temporär. Cursor werden
ausgegeben; kein verstecktes unbegrenztes Nachladen sämtlicher Datensätze.

Abnahme: Dateitreue LF/CRLF/Unicode, stdinEOF, fehlende Angaben, Token redaction,
Dateirechte, TLS-Fehler, Retry mit gleichem Key, Cursor, alle Exitcodes sowie
Windows/Linux/macOS-Smokes. Implementierungs- und Generatorversionen beim
Bootstrap pinnen; dokumentierte Commands dürfen keine Mockfunktion bleiben.
