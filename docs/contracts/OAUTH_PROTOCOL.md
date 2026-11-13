# OAuth-/MCP-Protokollabbildung

Stand 13. November 2026. Ergänzt [OAUTH_CONTRACT.md](../../OAUTH_CONTRACT.md).
Wire-Schemas: [oauth.openapi.json](oauth.openapi.json). Der Nutzer hat den
realen ChatGPT-Test ausdrücklich hinter den Prototypenbau verschoben. Diese
Spezifikation und Metadatenprüfung ersetzen den ausstehenden echten Test nicht.

## Identitäten und Discovery

Im ersten Prototyp ist die Basis-URL eine HTTPS-Origin ohne Pfad, Query oder
Fragment, beispielsweise `https://memory.example.org`. Issuer ist diese Origin
ohne abschließenden Slash, Ressource exakt `<issuer>/mcp`. Subpath-Hosting wird
nicht stillschweigend halb unterstützt; Konfiguration weist es verständlich ab.
Discovery liegt unter `/.well-known/oauth-authorization-server` und
`/.well-known/oauth-protected-resource/mcp`. Letztere URL steht in der Challenge.
Servermetadaten enthalten ausschließlich implementierte Fähigkeiten: code,
authorization_code/refresh_token, S256, none, drei Memory-Scopes, CIMD und iss.
Kein registration_endpoint, OIDC, UserInfo oder ID-Token.

GET `/oauth/authorize`: Parameter gemäß Schema, doppelte bekannte Parameter
ablehnen. Unbekannte OAuth-Erweiterungsparameter werden ignoriert und verleihen
keine Rechte; das strikte Produkt-JSON-Verhalten gilt hier nicht pauschal.
Bekannte unzulässige Clientauthentifizierung wird abgewiesen.
Fehlender scope bedeutet `memory:read`; angeforderte Scopes müssen
bekannt und kumulativ sein. Fehlender state ist protokollseitig zulässig;
vorhandenen state unverändert zurückgeben. Nicht unterstützte Erweiterungen
geben keine zusätzlichen Rechte. Client/Redirect zuerst prüfen. Bei Fehlern
vor dieser Prüfung lokale Seite, nie ungeprüfte Weiterleitung. Danach
Fehlerrückleitung mit error, ggf. state und immer iss. Erfolg entsprechend mit
code, ggf. state und iss. Kein Token im Redirect. Kein Weiterleitungsziel aus
einem Login-returnUrl ungeprüft übernehmen.

Login und Consent verwenden serverseitige 15-Minuten-Transaktion, CSRF und
Websession. Consent nennt Client, Ressource und Rechte sowie ausdrücklich
ausgewählte eigene Vaults. Eine Bestätigung verbraucht die Transaktion und
erzeugt genau einen benannten OAuth-Zugang und Code. Abbruch `access_denied`.
Rechte dürfen gegenüber der Anforderung reduziert werden; ausgegebener Scope
ist die genehmigte kumulative Menge. Code gilt fünf Minuten, Hashspeicherung,
bindet Client/Redirect/Resource/PKCE/Konto/Zugang/Scopes. Kein Auth-Code-Replay.

## Token, Fehler und Widerruf

POST `/oauth/token` ausschließlich form-urlencoded, 16 KiB Bodylimit. Kein
client_secret, keine Basic-Authentifizierung, keine JWT-Assertions. `none`
bedeutet weiterhin verpflichtende client_id und PKCE beim Codeaustausch.
Codeverifier RFC7636 mit 43–128 erlaubten Zeichen, SHA256→base64url ohne Padding.
Code, Ablauf, sämtliche Bindungen und Live-Rechte werden atomar geprüft.
Refresh verlangt dieselbe Client-ID und Ressource; optionaler scope darf nur
reduzieren. Refreshfamilie behält ursprüngliche absolute Laufzeit, auch nach
Scope-Reduktion. Zugriff maximal 900 Sekunden; Refresh30 Tage inaktiv/180 Tage
ab Erstanmeldung. 256 Bit kryptografischer Zufall für Codes, Tokens und Flow-
Referenzen; Hashspeicherung, keine selbst erfundene Kryptografie.

Erfolgreicher Austausch liefert access_token, token_type Bearer, expires_in900,
refresh_token und genehmigten scope. Cache-Control:no-store, Pragma:no-cache.
Fehlerformat ausschließlich OAuthError. Übliche Zuordnung:

| Fall | HTTP / OAuth-Fehler |
|---|---|
| Fehlende/doppelte/falsche Parameter | 400 invalid_request |
| Unbekannter/verbotener Client | 400 invalid_client bei öffentlichem Client ohne HTTP-Auth |
| Falsche Resource | 400 invalid_target |
| Ungültiger Code, PKCE, Refresh oder Bindung | 400 invalid_grant |
| Unzulässiger Scope | 400 invalid_scope |
| Nicht unterstützter Grant | 400 unsupported_grant_type |
| CIMD vorübergehend nicht ladbar | 503 temporarily_unavailable, Refresh unverbraucht |
| Rate-Limit | 429 temporarily_unavailable und Retry-After |

POST `/oauth/revoke` gemäß RFC7009, öffentlicher Client identifiziert sich mit
client_id. Ein gültiger Refresh widerruft Familie einschließlich Access-Tokens;
Access-Token-Widerruf widerruft dieses Token. Fremdes/unbekanntes Token ergibt
wie Erfolg leere 200-Antwort, ohne Offenlegung. Gesamten Agentenzugang in der UI
zu widerrufen beendet sämtliche zugehörigen Familien und Credentials sofort.

## CIMD und echte ChatGPT-Metadaten

Am 13.11.2026 direkt gelesen:
`https://chatgpt.com/oauth/client.json`. Enthält die erwartete Client-ID und
`https://chatgpt.com/connector_platform_oauth_redirect`. Die pluralen
`token_endpoint_auth_methods_supported` enthalten `none` und `private_key_jwt`;
das singuläre `token_endpoint_auth_method` nennt `private_key_jwt`.
Entscheidend für diese Integration ist die unterstützte Schnittmenge mit
unserem `none`, wie in OpenAIs Auth-Dokumentation beschrieben. Nicht irrtümlich
aus dem singulären Feld ableiten, dass CIMD für uns unmöglich ist. Diese
Feststellung ist kein realer Verbindungstest.

Unbekannte CIMD-Metadatenfelder tolerieren, sicherheitsrelevante bekannte Felder
streng prüfen; ein string-array mit gültigen exakten HTTPS-Redirects, passende
Client-ID, authorization_code und refresh_token sowie code und none-Unterstützung.
Kein JWKS-Abruf, solange private_key_jwt nicht implementiert wird. Nicht
benötigte Logo-/Client-Links werden nicht serverseitig geladen. SSRF-, Cache-,
Freigabe- und Timeoutregeln aus dem Hauptvertrag bleiben verbindlich.

## MCP-Transport

Offizielles C# SDK, Streamable HTTP `/mcp`, zunächst zustandslos ohne resumierbare
Ereigniswarteschlange und ohne eigenen MCP-Session-Authentifizierungsersatz.
JSON-RPC/Initialisierung/Protokollversion durch SDK, keine Handimplementierung.
Ziel-Baseline `2025-11-25`; zusätzliche SDK-Versionen nur nach Tests zulassen.
POST akzeptiert JSON, Clients dürfen JSON/SSE per Accept anbieten. GET darf im
zustandslosen Modus 405 liefern; kein alter separater `/sse`-Transport. Browser-
Origin sofern vorhanden gegen konfigurierte Origin erlauben, fremde403;
fehlende Origin bei nativen Clients ist zulässig. Keine allgemeine CORS-Freigabe.
Jeder Request prüft Bearer und aktuelle Rechte; nie Tokens in Query/Cookies.

| Fall | Antwort |
|---|---|
| Kein Bearer | 401, WWW-Authenticate Bearer mit resource_metadata und scope |
| Abgelaufen/ungültig/widerrufen | 401, zusätzlich error="invalid_token" |
| Fehlender OAuth-Scope | 403, error="insufficient_scope", erforderlicher kumulativer scope |
| Fachlich fehlende Vault-Rechte | Toolfehler isError mit permission_denied/not_found gemäß Sichtbarkeit |
| Falsche Origin | 403 vor Ausführung |
| Unbekanntes Tool/ungültiges JSON-RPC | SDK-Protokollfehler |
| Fachlicher Konflikt | isError und Produktfehler, keine erfolgreiche structuredContent-Ausgabe |

MCP bietet exakt acht Tools, keine Resources/Prompts/Sampling/Tasks. Fehlende
Fähigkeiten nicht annoncieren. Tokenprüfung erfolgt vor tools/list ebenso wie
vor tools/call. Tool-Schemas sind in mcp-tools.json festgelegt. SDK-Annotationen
begrenzen keine Rechte. CLI-Bearertokens werden hier nicht als OAuth akzeptiert.

## Quellen und Nachweisgrenzen

- [OpenAI Auth](https://developers.openai.com/plugins/build/auth.md)
- [ChatGPT CIMD](https://chatgpt.com/oauth/client.json)
- [MCP Transport 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)
- [RFC7636 PKCE](https://www.rfc-editor.org/rfc/rfc7636)
- [RFC7009 Widerruf](https://www.rfc-editor.org/rfc/rfc7009)

Komplette Sicherheits-/Negativtests des Hauptvertrags bleiben Pflicht. Wenn der
reale Client eine Abweichung erfordert, Entscheidung und Vertrag ändern, nicht
Authentifizierung abschalten oder einen Inspector-Lauf als ChatGPT-Erfolg melden.
