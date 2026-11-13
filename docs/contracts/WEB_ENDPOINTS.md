# Web- und Administrationsoberfläche: Vertragsinventar

Stand: 13. November 2026. Technischer Routenentwurf zur Vervollständigung der
Verträge, **noch keine vollständige OpenAPI-Abdeckung**. Die Fachfunktionen
sind bereits beschlossen. Einzelne Routen sind keine neuen Produktfähigkeiten.
Alle Produktpfade verwenden das Präfix `/api/v1`.

Die Agenten-OpenAPI beschreibt bewusst nur Agententokens. Die Web-API erhält
einen getrennten Cookie-/CSRF-Vertrag. Administratorrechte erweitern niemals
den Inhaltsscope; Inhaltspfade prüfen stets das eigene Konto. Agententokens
dürfen keinen der folgenden nutzervorbehaltenen Anwendungsfälle aufrufen.

| Bereich | Geplante Endpunkte / Methoden | Zentrale Vertragsanforderung |
|---|---|---|
| Ersteinrichtung | GET `/setup`, POST `/setup` | Status ohne Geheimnisse; einmaliges Betreibergeheimnis; kein 2FA-Schritt |
| Anmeldung | POST `/auth/login`, `/auth/login/second-factor`, `/auth/logout` | Passwort, optional rememberMe; kurzlebiger 2FA-Zwischenzustand, keine Sitzung vor erfolgreichem Faktor |
| Sitzungen | GET `/me/sessions`, DELETE `/me/sessions/{id}` | Nur eigene Sitzungen; serverseitiger Widerruf |
| Profil | GET/PATCH `/me`, POST `/me/change-password`, DELETE `/me` | Theme/Sprache/Tag-Erlaubnis; aktuelle Authentifizierung für sensible Aktionen |
| E-Mail | POST `/me/email-change`, `/auth/email-change/confirm` | Mit SMTP neue Adresse bestätigen; ohne SMTP administrative Änderung |
| Einladung | POST `/auth/invitations/redeem` | Gebundene E-Mail; Einmalverbrauch; sieben Tage |
| Passwort-Reset | POST `/auth/password-reset/request`, `/auth/password-reset/redeem` | Generische Anfrageantwort; Reset erhält TOTP, widerruft Sitzungen und Credentials |
| Kontowiederherstellung | POST `/auth/account-recovery/redeem` | Gesondertes einmaliges Geheimnis; setzt Passwort und TOTP zurück |
| TOTP | POST `/me/totp/setup`, `/me/totp/confirm`, `/me/totp/disable`, `/me/totp/recovery-codes` | Nur Profil; kein implizites Aktivieren bei Secret-Ausgabe; Reauthentifizierung |
| Vaults | POST `/vaults`, PATCH/DELETE `/vaults/{id}` | Eigener Eigentümer; Name, Suchsprache, Versionslimit; Löschung entfernt Grants |
| Tags | PATCH/DELETE `/vaults/{vaultId}/tags/{id}`, POST `/vaults/{vaultId}/tags/{id}/merge` | Nutzer-only; transaktionale Versionierung betroffener Zuordnungen |
| Verschieben | POST `/memories/{id}/move` | Ziel-Vault und erwartete Revision; gleicher Eigentümer, atomare Tag-Abbildung |
| Historie | GET `/memories/{id}/versions`, GET `/memories/{id}/versions/{revision}`, POST `/memories/{id}/restore-version` | Snapshots/Verursacher, aktueller Revisionskonflikt, keine alten Agentenrechte |
| Papierkorb | GET `/trash/vaults`, GET `/vaults/{id}/trash`, POST `/trash/vaults/{id}/restore`, POST `/trash/memories/{id}/restore` | Fristen, reservierte Namen, Vault-Restore stellt keine Grants wieder her |
| Endgültiges Löschen | DELETE `/trash/vaults/{id}`, DELETE `/trash/memories/{id}` | Nutzer-only, keine Inhaltswiederherstellung nach Ablauf |
| Agentenzugänge | GET/POST `/agent-accesses`, GET/PATCH/DELETE `/agent-accesses/{id}` | Benannter Zugang, eigene Vault-Grants, aktuelle Rechte sofort wirksam |
| CLI-Credentials | POST `/agent-accesses/{id}/tokens`, DELETE `/agent-accesses/{id}/tokens/{tokenId}` | Geheimnis nur einmal; Ablauf/Überlappung; keine Tokenwerte in Listen |
| Export/Import | GET `/vaults/{id}/export`, POST `/imports/validate`, POST `/imports` | Konsistentes ZIP; Vorprüfung kein Teilimport, Zielname und neue IDs |
| Admin-Konten | GET `/admin/accounts`, PATCH/DELETE `/admin/accounts/{id}` | Status/Rolle/E-Mail, keine fremden Inhaltsfelder, Schutz letzten aktiven Admins |
| Admin-Einladungen | GET/POST `/admin/invitations`, DELETE `/admin/invitations/{id}` | Manueller Link, optional SMTP, Ablauf/Widerruf |
| Admin-Wiederherstellung | POST `/admin/accounts/{id}/password-reset`, `/admin/accounts/{id}/account-recovery` | Zwei getrennte Prozesse, erneute Authentifizierung bei umfassender Wiederherstellung |
| Diagnose | GET `/admin/diagnostics` | Version/Bereitschaft/Speicher, keine fremden Inhalte oder Geheimnisse |

Vor maschinenlesbarer Vervollständigung müssen insbesondere CSRF-Transport,
Reauthentifizierungsnachweis, 2FA-Zwischenzustand, Konkurrenzschutz für
Vault-/Grant-/Profiländerungen sowie Import-Vorprüfung und Upload-Lebensdauer
konkretisiert werden. Unveröffentlichte Geheimnisse gehören nicht in URLs oder
normale Diagnoseausgaben. Öffentliche Liveness/Readiness und OAuth/MCP werden
außerhalb dieses Produktpräfixes getrennt beschrieben.
