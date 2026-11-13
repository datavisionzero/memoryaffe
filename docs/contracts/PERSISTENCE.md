# Persistenz- und Transaktionsplan

Technische Arbeitsvorgabe für die Umsetzung, keine vorhandene Migration.
PostgreSQL mit EF Core/Npgsql; gezieltes parametrisiertes SQL in Infrastructure.
Domain bleibt unabhängig von EF/HTTP/MCP. Einträge werden nicht als einzelne
Dateien gespiegelt; Markdown ist text in PostgreSQL.

## Tabellen und Invarianten

| Aggregat | Speicherung / notwendige Constraints |
|---|---|
| Accounts | Identity mit UUID; eindeutige normalisierte E-Mail, role/status, administrativeRevision, Profilpräferenzen, Tag-Erlaubnis |
| Vaults | UUID, ownerId, name/nameKey, revision, versionLimit0..100, active/pendingSearchLanguage, activeIndexGeneration, deletedAt/expiresAt |
| Memories | UUID, ownerId/vaultId, title/summary/markdown, revision bigint>0, timestamps, currentActor, deletedAt/expiresAt, optionale Importherkunft |
| Versions | memoryId+sourceRevision eindeutig, vollständiger vorheriger Inhalt inkl. Tag-Namen, savedAt/actor; keine Fremdschlüssel auf alte Tag-IDs |
| Tags | UUID, ownerId/vaultId, name/nameKey, revision; unique(vaultId,nameKey) |
| RecordTags | memoryId/tagId eindeutig; beide müssen zum selben Vault und Konto gehören |
| AgentAccesses | UUID, ownerId, name, kind cli/oauth, revision, revokedAt; keine versteckte Freigabe über Rolle |
| VaultGrants | accessId/vaultId eindeutig, level; Eigentümer muss auf beiden Seiten gleich sein |
| CliCredentials | accessId, Hash, created/expires/revoked/lastUsedAt, Rotationsbezug; Klartext nur Ausgabe |
| OAuthFamilies/Tokens/Codes | Client/Resource/Scopes, Hashes, family, Ablauf/Widerruf/Verbrauch; absolute Refreshfrist unveränderlich |
| WebSessions/AuthFlows | zufälliger gehashter Handle, owner, Fristen, remembered, revoked, Sicherheitsstand/Faktorversuche |
| Invitations/Reset/Recovery | Hash und Zweck, gebundene Adresse/Konto, expiry/consumed/revoked, Aussteller; keine universellen Tokens |
| ActionProofs | Session/Akteur/Auftragsfingerprint, expiry/consumed; keine Passwortkopie |
| IdempotencyResults | actorKind/actorId/key eindeutig, Fingerprint, kompakte Antwort, originalVaultId, Status, Ablauf |
| ImportPreparations | ownerId, unveränderliche Datei-/Hashreferenz, Gültigkeit/Status, Ziel-/Ergebnisbindung, resultVaultId |
| SearchGeneration/Segments | Vaultgeneration, memoryId/revision, Feld, globale Positionen und lexikalische Segmente, GIN |

Owner-Spalten sind keine Clientangaben, sondern aus authentifiziertem Kontext
und bestehenden Beziehungen abgeleitet. Zusammengesetzte FK/Unique-Constraints
sichern Gleichheit von Eigentümer/Vault zusätzlich zur Application-Prüfung.
RecordTags brauchen dazu entsprechende alternative Schlüssel. Ein Vault-Wechsel
ersetzt Tagzuordnungen und aktualisiert Beziehungen in einer Transaktion.
Keine API akzeptiert ownerId als Berechtigung. Keine globale Admin-Ausnahme in
Inhaltsqueries. RLS ist nicht als zusätzliche Produktpflicht vorgesehen.

Revisionen als bigint speichern, JSON stets dezimale Zeichenfolge. UTC timestamptz,
Schreibzeiten auf Millisekunden präzisieren; keine Uhrzeit als Konkurrenzschutz.
Bei Revisionserhöhung Überlauf abfangen, niemals umrollen. SQL-Collation für
normalisierte Schlüssel ordinal; Unicode-Regeln stehen in SEARCH_UNICODE.md.

## Locking und atomare Operationen

Deterministische Reihenfolge: Konto-Sicherheitsstatus → Vaults nach UUID →
Agentenzugänge/Tags nach UUID → Datensätze nach UUID. Gleichartige Operationen
verwenden dieselbe Reihenfolge; Deadlock/Serialization-Retry nur bei vollständig
zurückgerollter Transaktion und unverändertem Auftrag. Keine Wiederholung eines
bereits extern ausgegebenen Secrets oder einer SMTP-Sendung innerhalb eines
DB-Retryblocks.

Rechte-/Sperränderung und Schreiboperation müssen sich über Sperr-/Versionsprüfung
serialisieren. „Sofort“ bedeutet: Kein nach Commit des Widerrufs neu autorisierter
Request darf alte Rechte verwenden; bereits abgeschlossene Ergebnisse werden
nicht zurückgeholt. HTTP-/MCP-Adapter nutzen dieselbe Berechtigungsroutine.

Datensatz speichern: expectedRevision prüfen → echten Unterschied bestimmen →
vorherige Fassung snapshotten → Inhalte/Tags/Index/Actor aktualisieren → revision++
→ älteste Snapshots über **Limit pro Datensatz** entfernen → Idempotenzantwort
speichern → Commit. Einstellung ist pro Vault, nicht ein gemeinsames Budget
aller Vault-Datensätze. Noop prüft Revision/Rechte, ohne Snapshot/Zeitänderung.

Tagrename/-merge/-delete: Tags plus betroffene aktuelle Datensätze einschließlich
Papierkorb konsistent sperren; jede tatsächliche Inhaltsänderung durch denselben
Versionierungspfad. Historische Tags bleiben unverändert. Merge kann Zuordnungen
deduplizieren; keine doppelten Tags oder über50 pro Datensatz.

Vault löschen: Lifecycle-Revision erhöhen, Frist setzen, Grants atomar entfernen
und betroffene Agentenrevisionen erhöhen. Datensatz-Einzelfristen nicht verlängern.
RestoreVault setzt nur Vault aktiv, niemals Grants/individuell gelöschte Records.
Limitsenkung kürzt jede zugehörige Historie einschließlich Papierkorb atomar;
keine heimliche spätere Verlängerung oder Wiederkehr entfernter Snapshots.

Letzter aktiver Admin: gemeinsame DB-Sperre auf singleton Sicherheitszeile oder
serialisierbare Transaktion, nicht lediglich zwei getrennte Count-Abfragen.
Paralleles Degradieren/Sperren/Löschen muss mindestens einen aktiven Admin erhalten.
Initialsetup durch unique singleton Zustand und Einmalgeheimnis absichern.

Idempotenz: eindeutiger Akteur/Key plus Fingerprint; Mutation und Ergebnis in
derselben Transaktion. Konkurrenz maximal5s warten, danach409/Retry-After1.
Nicht auf vorab committeten „running“-Zeilen ohne Crash-Recovery verlassen.
Fehler/Conflict verbrauchen Schlüssel nicht. Replay prüft Live-Rechte. Secrets
sind von allgemeiner Antwortaufbewahrung ausgeschlossen.

Import: Konto-/Vorbereitungssperre verhindert parallele doppelte Übernahme und
Ersetzung während Commit. Gesamte DB-Übernahme plus Ergebnisbindung atomar.
Dateilöschung nach Commit wiederholbar; Crash zwischen Commit und Dateilöschung
verursacht nur nachholbare Bereinigung, keinen doppelten Vault. Während Upload
instanzweite reservierte Dateiquote auch bei Abbruch freigeben.

## Background-Work ohne Infrastrukturzuwachs

Ein HostedService führt fällige Bereinigung und persistierte Such-Reindexjobs
aus. Kein externer Broker, keine zusätzliche Workerinstallation. Jobstatus in
PostgreSQL, restartfähig, Einzeltasks mit begrenzter Laufzeit/Batchgröße.
Expiry wird bei jeder fachlichen Lese-/Schreibprüfung erzwungen, nicht erst
nach dem Cleanup. Einmal-Auth- und Wiederholungseinträge haben getrennte Fristen.

Migrationen versioniert, Startup-Migrationslock, Readiness erst nach Erfolg.
Keine automatische Erstellung fehlender Produktionsschemata per EnsureCreated.
In Tests ebenfalls Migrationen auf echter PostgreSQL. Rollback erfolgt über
Backup und passende Anwendungsversion, nicht pauschal Down-Migration.
