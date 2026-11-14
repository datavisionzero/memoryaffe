# Web- und Administrationsoberfläche: Vertragsinventar

Stand: 13. November 2026. Lesbare Routenübersicht. Die vollständige Feldabbildung
steht in [web.openapi.json](web.openapi.json), die Semantik in
[WEB_PROTOCOL.md](WEB_PROTOCOL.md). Die Fachfunktionen sind beschlossen;
die Anwendung ist noch nicht implementiert.
Alle Produktpfade verwenden das Präfix `/api/v1`.

Die fünf Ablaufentscheidungen im [Web-/Administrationsvertrag](../../WEB_CONTRACT.md)
sind bestätigt; die Routenabbildung konkretisiert sie für die Umsetzung.

Die Agenten-OpenAPI beschreibt bewusst nur Agententokens. Die Web-API erhält
einen getrennten Cookie-/CSRF-Vertrag. Administratorrechte erweitern niemals
den Inhaltsscope; Inhaltspfade prüfen stets das eigene Konto. Agententokens
dürfen keinen der folgenden nutzervorbehaltenen Anwendungsfälle aufrufen.

| Bereich | Geplante Endpunkte / Methoden | Zentrale Vertragsanforderung |
|---|---|---|
| Ersteinrichtung | GET `/setup`, POST `/setup` | Status ohne Geheimnisse; einmaliges Betreibergeheimnis; kein 2FA-Schritt |
| Anmeldung | POST `/auth/login`, `/auth/login/second-factor`, `/auth/logout` | Passwort, optional rememberMe; kurzlebiger 2FA-Zwischenzustand, keine Sitzung vor erfolgreichem Faktor |
| Sitzungen | GET `/me/sessions`, DELETE `/me/sessions/{id}` | Nur eigene Sitzungen; serverseitiger Widerruf |
| Andere Sitzungen | POST `/me/sessions/revoke-others` | Alle eigenen Sitzungen außer der aktuellen widerrufen |
| CSRF | GET `/auth/csrf` | Gleichursprünglicher Nachweis; nach Identitätswechsel erneuern |
| Aktionsbestätigung | POST `/me/reauthenticate` | Passwort und ggf. Faktor; fünf Minuten, an Sitzung, Aktion, Ziel und Angaben gebunden |
| Profil | GET/PATCH `/me`, POST `/me/change-password`, DELETE `/me` | Theme/Sprache/Tag-Erlaubnis; aktuelle Authentifizierung für sensible Aktionen |
| E-Mail | POST `/me/email-change`, `/auth/email-change/confirm` | Mit SMTP neue Adresse bestätigen; ohne SMTP administrative Änderung |
| Einladung | POST `/auth/invitations/redeem` | Gebundene E-Mail; Einmalverbrauch; sieben Tage |
| Passwort-Reset | POST `/auth/password-reset/request`, `/auth/password-reset/redeem` | Generische Anfrageantwort; Reset erhält TOTP, widerruft Sitzungen und Credentials |
| Kontowiederherstellung | POST `/auth/account-recovery/redeem` | Gesondertes einmaliges Geheimnis; setzt Passwort und TOTP zurück |
| TOTP | POST `/me/totp/setup`, `/me/totp/confirm`, `/me/totp/disable`, `/me/totp/recovery-codes` | Nur Profil; kein implizites Aktivieren bei Secret-Ausgabe; Reauthentifizierung nur vor Setup |
| Vaults | POST `/vaults`, PATCH/DELETE `/vaults/{id}` | Eigener Eigentümer; Name, Suchsprache, Versionslimit; Löschung entfernt Grants |
| Tags | PATCH/DELETE `/vaults/{vaultId}/tags/{id}`, POST `/vaults/{vaultId}/tags/{id}/merge` | Nutzer-only; transaktionale Versionierung betroffener Zuordnungen |
| Verschieben | POST `/memories/{id}/move` | Ziel-Vault und erwartete Revision; gleicher Eigentümer, atomare Tag-Abbildung |
| Historie | GET `/memories/{id}/versions`, GET `/memories/{id}/versions/{revision}`, POST `/memories/{id}/restore-version` | Snapshots/Verursacher, aktueller Revisionskonflikt, keine alten Agentenrechte |
| Papierkorb | GET `/trash/vaults`, GET `/vaults/{id}/trash`, POST `/trash/vaults/{id}/restore`, POST `/trash/memories/{id}/restore` | Fristen, reservierte Namen, Vault-Restore stellt keine Grants wieder her |
| Endgültiges Löschen | DELETE `/trash/vaults/{id}`, DELETE `/trash/memories/{id}` | Nutzer-only, keine Inhaltswiederherstellung nach Ablauf |
| Agentenzugänge | GET/POST `/agent-accesses`, GET/PATCH/DELETE `/agent-accesses/{id}` | Benannter Zugang, eigene Vault-Grants, aktuelle Rechte sofort wirksam |
| CLI-Credentials | POST `/agent-accesses/{id}/tokens`, DELETE `/agent-accesses/{id}/tokens/{tokenId}` | Geheimnis nur einmal; Ablauf/Überlappung; keine Tokenwerte in Listen |
| Export/Import | GET `/vaults/{id}/export`, POST `/imports/validate`, POST `/imports` | Konsistentes ZIP; Vorprüfung kein Teilimport, Zielname und neue IDs |
| Importvorbereitung | GET/DELETE `/imports/{id}` | Eigene Vorschau/Ergebnis beziehungsweise Abbruch; 30 Minuten, eine Vorbereitung pro Nutzer |
| Admin-Konten | GET `/admin/accounts`, PATCH/DELETE `/admin/accounts/{id}` | Status/Rolle/E-Mail, keine fremden Inhaltsfelder, Schutz letzten aktiven Admins |
| Admin-Einladungen | GET/POST `/admin/invitations`, DELETE `/admin/invitations/{id}` | Manueller Link, optional SMTP, Ablauf/Widerruf |
| Admin-Wiederherstellung | POST `/admin/accounts/{id}/password-reset`, `/admin/accounts/{id}/account-recovery` | Zwei getrennte Prozesse, angemeldete Adminsitzung und CSRF |
| Diagnose | GET `/admin/diagnostics` | Version/Bereitschaft/Speicher, keine fremden Inhalte oder Geheimnisse |
| OAuth-Zustimmung | GET `/oauth/requests/{id}`, POST `/oauth/requests/{id}/decision` | Eigener browsergebundener Ablauf, ausdrückliche Vaultauswahl, geprüfte Rückleitung |

CSRF wird über einen Request-Header transportiert. Aktionsnachweise gelten fünf
Minuten für genau einen vorbereiteten Auftrag. Der 2FA-Zwischenzustand gilt
fünf Minuten mit maximal fünf Fehlversuchen; die Einrichtung zehn Minuten.
Zehn Recovery-Codes sind einzeln verwendbar. Verwaltungsänderungen verlangen
Revisionen, ausgenommen Theme und Anzeigesprache. Geprüfte Importvorbereitungen
gelten 30 Minuten und werden höchstens einmal übernommen. Die maschinenlesbaren
Schemas ergänzen Einzelabruf des Vaults, Tokenlisten und Restore-Vorschau.
Unveröffentlichte Geheimnisse gehören nicht in URLs oder
normale Diagnoseausgaben. Öffentliche Liveness/Readiness und OAuth/MCP werden
außerhalb dieses Produktpräfixes getrennt beschrieben.
