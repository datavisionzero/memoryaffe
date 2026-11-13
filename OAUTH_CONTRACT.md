# OAuth- und CIMD-Vertrag

Stand: 13. November 2026. Die folgenden Entscheidungen sind bestätigt.
Sie beschreiben geplantes Verhalten; ein realer ChatGPT-Kompatibilitätsnachweis
steht noch aus und ist vor dem Grundgerüst erforderlich.

## Umfang

memoryaffe implementiert einen begrenzten eigenen OAuth-Server ohne
OpenIddict, dynamische Clientregistrierung oder vollständigen OpenID-Connect-
Anbieter. ASP.NET Core Identity bleibt für Benutzeranmeldung, Passwörter und
optionales TOTP zuständig. Unterstützt werden Authorization Code mit
verpflichtendem PKCE/S256 und rotierende Refresh-Tokens. CIMD-Clients verwenden
zunächst die Token-Endpunkt-Authentifizierungsmethode `none`.

Access- und Refresh-Tokens sind kryptografisch zufällige, undurchsichtige
Geheimnisse; gespeichert werden nur ihre Hashes. Kryptografische Primitive
werden nicht selbst entwickelt. Die Fachregeln des
[Schnittstellenvertrags](API_CONTRACT.md) gelten für Produktoperationen;
OAuth-Protokollfehler behalten ihr vorgeschriebenes Format.

## Installation, Discovery und Ressource

Die konfigurierte öffentliche Basis-URL ist der OAuth-`issuer`. Die vollständige
URL mit `/mcp` identifiziert die geschützte Ressource. Beide Werte werden exakt
geprüft und nicht aus eingehenden Host-Headern abgeleitet.
Die Installation veröffentlicht standardisierte OAuth-Authorization-Server-
und Protected-Resource-Metadaten. Die Resource-Bindung wird im
Autorisierungsablauf, bei der Tokenausgabe und bei jedem Zugriff geprüft.

## ChatGPT-Client und Rückleitung

Der Server unterstützt Issuer-Identifikation: `iss` wird bei erfolgreichen
und fehlerhaften OAuth-Weiterleitungen zurückgegeben und entspricht exakt dem
veröffentlichten Issuer. Die Discovery-Metadaten kündigen diese Unterstützung an.

Für ChatGPT sind zunächst diese stabilen Adressen vorgesehen:

- CIMD-Client-ID: `https://chatgpt.com/oauth/client.json`
- Redirect-URI: `https://chatgpt.com/connector_platform_oauth_redirect`

Beim realen Verbindungstest werden beide mit den tatsächlich von ChatGPT
angezeigten Werten abgeglichen. Ungültige Client- oder Redirect-Angaben führen
zu einer lokalen Fehlerseite, niemals zu einer Weiterleitung an eine
ungeprüfte Adresse. Client-ID im Metadatendokument und angeforderte
Redirect-URI werden exakt validiert.

## Scopes und Zustimmung

Die fachlichen Scopes sind `memory:read`, `memory:write` und `memory:delete`.
Die drei Berechtigungsstufen verwenden sie kumulativ. Vault-IDs sind kein
Bestandteil der Scope-Namen.

Wirksame Rechte ergeben sich immer aus der Schnittmenge von genehmigten
OAuth-Scopes, aktuellen Vault-Rechten des Agentenzugangs und Kontoregeln wie
der Erlaubnis zur Tag-Erstellung. Scopes erweitern keine Vault-Rechte.

Jede OAuth-Verbindung erhält einen eigenen benannten Agentenzugang. Eine neue
Verbindung erfordert mindestens einen ausdrücklich ausgewählten eigenen Vault
und eine ausdrückliche Zustimmung. Eine vorhandene Verbindung darf nach
Rechteentzug ohne Vault-Zugriff verbleiben. Zusätzliche Rechte benötigen eine
ausdrückliche Nutzerentscheidung. Eine gültige Webanmeldung darf wiederverwendet
werden; sie ersetzt nicht die Zustimmung zur neuen Verbindung.

## Autorisierungsablauf und Code

Ein begonnener Anmelde-/Zustimmungsablauf gilt höchstens 15 Minuten.
Autorisierungscodes gelten fünf Minuten und sind an Client-ID, exakte
Redirect-URI, Ressource, PKCE-Challenge, Nutzer und bestätigte Rechte gebunden.
Ein Code wird atomar genau einmal verbraucht.

## CIMD-Abruf und Betreiberfreigabe

Der Betreiber erlaubt konkrete HTTPS-Dokumentadressen, zunächst ChatGPT.
Abrufe verwenden ausschließlich exakt freigegebene Adressen, ohne
HTTP-Weiterleitungen. Pro Abruf gelten höchstens fünf Sekunden und 64 KiB
Dokumentgröße. Interne Netzwerkziele werden sowohl bei der DNS-Auflösung als
auch beim tatsächlichen Verbindungsaufbau ausgeschlossen. Die Freigabeliste
ersetzt diese Prüfungen nicht.

Metadaten werden höchstens eine Stunde zwischengespeichert; kürzere
Servervorgaben werden respektiert. Nach Cache-Ablauf wird keine neue
OAuth-Verbindung mit ungeprüften alten Metadaten aufgebaut.
Die Entfernung einer Client-Adresse aus der Betreiberfreigabe sperrt auch
bereits vorhandene Verbindungen dieses Clients unmittelbar.

Refresh benötigt gültige gecachte oder erfolgreich neu geladene Metadaten.
Ein vorübergehender Abruffehler lehnt den Refresh vorübergehend ab, ohne das
Refresh-Token zu verbrauchen. Bereits ausgegebene Access-Tokens gelten bis zum
normalen Ablauf weiter, sofern Konto, Freigabeliste und Vault-Rechte passen.
Die Entfernung aus der lokalen Freigabeliste wirkt weiterhin sofort.

## Tokenlaufzeiten, Rotation und Widerruf

Access-Tokens gelten 15 Minuten. Refresh-Tokens erlauben Erneuerung bis zu
30 Tagen Inaktivität beziehungsweise höchstens 180 Tagen Gesamtdauer seit
Anmeldung. Danach ist erneute Anmeldung erforderlich.

Jeder erfolgreiche Refresh entwertet das alte Refresh-Token. Erneute
Verwendung widerruft die gesamte Tokenfamilie einschließlich der zugehörigen
Access-Tokens. Es gibt zunächst keine Kulanzfrist für doppelte Refresh-Aufrufe.
Jeder Zugriff und Refresh prüft die aktuellen Sperr-, Rechte- und
Widerrufszustände unabhängig von den Tokenlaufzeiten.

Der reale ChatGPT-Test prüft ausdrücklich parallele Erneuerung und verlorene
Antworten. Notwendige Abweichungen von der strikten Rotation werden vor der
Produktimplementierung entschieden, nicht stillschweigend eingebaut.

## Abnahme vor dem Grundgerüst

Der isolierte Test verwendet einen öffentlich erreichbaren HTTPS-Endpunkt,
ein geeignetes ChatGPT-Konto und ausschließlich Testdaten. Er prüft Discovery,
CIMD, Anmeldung/Zustimmung, authentifiziertes Lesen, Refresh und Widerruf.
Negative Tests umfassen falsche Ressource, ungültige Redirects/Clients, PKCE-
Fehler, doppelte Codeverwendung, Refresh-Wiederverwendung, manipulierte
Metadaten und interne Abrufziele. Code-/Ablauffristen, Cache-Grenzen und
Entfernung aus der Betreiberfreigabe werden ebenfalls geprüft.

Ein MCP-Inspector-Test ersetzt keinen realen ChatGPT-Nachweis. Paket- und
Protokollversionen, vollständige Endpunkt-/Parameterverträge sowie Ergebnisse
des Kompatibilitätsversuchs werden vor dem Grundgerüst ergänzt. Claude folgt
später und blockiert die erste ChatGPT-Abnahme nicht.

## Referenzen

- [OpenAI: Authentication](https://developers.openai.com/plugins/build/auth.md)
- [MCP: Authorization](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)

Die Referenzen begründen den Protokollrahmen. Zeit-, Größen- und Cache-Limits
in diesem Dokument sind bestätigte memoryaffe-Entscheidungen.
