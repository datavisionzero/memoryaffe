using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Memoryaffe.Application;
using Memoryaffe.Domain;

namespace Memoryaffe.Infrastructure;

public class OAuthService(IDataStore db, ISecurity security, ProductOptions options, CimdClient clients, ManagementService management) : Service(db, security, options)
{
    public string Resource => Options.BaseUrl + "/mcp";
    public object Discovery => new { issuer = Options.BaseUrl, authorization_endpoint = Options.BaseUrl + "/oauth/authorize", token_endpoint = Options.BaseUrl + "/oauth/token", revocation_endpoint = Options.BaseUrl + "/oauth/revoke", response_types_supported = new[] { "code" }, grant_types_supported = new[] { "authorization_code", "refresh_token" }, code_challenge_methods_supported = new[] { "S256" }, token_endpoint_auth_methods_supported = new[] { "none" }, scopes_supported = new[] { "memory:read", "memory:write", "memory:delete" }, client_id_metadata_document_supported = true, authorization_response_iss_parameter_supported = true };
    public object ResourceMetadata => new { resource = Resource, authorization_servers = new[] { Options.BaseUrl }, bearer_methods_supported = new[] { "header" }, scopes_supported = new[] { "memory:read", "memory:write", "memory:delete" } };
    public async Task<string> Authorize(JsonObject input, string browser, CancellationToken ct)
    {
        var client = await clients.Get(input.Str("client_id"), ct);
        if (!client.Redirects.Contains(input.Str("redirect_uri"), StringComparer.Ordinal)) throw new OAuthException("invalid_request", "Rückleitungsadresse ist nicht erlaubt.");
        try
        {
            if (input.Str("response_type") != "code") throw new OAuthException("unsupported_response_type", "Nur Authorization Code wird unterstützt.");
            Target(input.Str("resource")); Scopes(input.Str("scope", "memory:read"));
            if (input.Str("code_challenge_method") != "S256" || !Regex.IsMatch(input.Str("code_challenge"), "^[A-Za-z0-9_-]{43}$")) throw new OAuthException("invalid_request", "PKCE S256 ist erforderlich.");
            if (input.Str("state").EnumerateRunes().Count() > 2048 || ClientAuthentication(input)) throw new OAuthException("invalid_request", "Ungültiger Autorisierungsauftrag.");
            var data = (JsonObject)input.DeepClone(); data["clientName"] = client.Name; data["scopes"] = J.Node(Scopes(input.Str("scope", "memory:read")));
            var flow = new Flow { Kind = "oauth-request", Hash = J.Hash(browser), Data = data.ToJsonString(), ExpiresAt = Clock.Now.AddMinutes(15) }; Db.Add(flow);
            return Options.BaseUrl + "/oauth/consent/" + flow.Id;
        }
        catch (OAuthException e) { return Callback(input, "error", e.Code); }
    }
    public async Task<object> Consent(Actor a, Operation op, string browser, CancellationToken ct)
    {
        User(a); var f = Db.Flows.SingleOrDefault(x => x.Id == op.Path.Id("id") && x.Kind == "oauth-request" && x.Hash == J.Hash(browser));
        J.Require(f != null && (f.OwnerId == null || f.OwnerId == a.Account.Id), 404, "not_found", "Autorisierungsanfrage nicht gefunden.");
        J.Require(!f!.Consumed && f.ExpiresAt > Clock.Now, 410, "flow_expired", "Autorisierungsanfrage ist abgelaufen.");
        var data = JsonNode.Parse(f.Data)!.AsObject(); await clients.Get(data.Str("client_id"), ct);
        var requested = data["scopes"]!.AsArray().Select(x => x!.GetValue<string>()).ToArray();
        if (op.Id == "web_get_oauth_consent") return new { f.Id, clientName = data.Str("clientName"), clientId = data.Str("client_id"), resource = Resource, requestedScopes = requested, expiresAt = J.Time(f.ExpiresAt) };
        f.OwnerId = a.Account.Id; f.Consumed = true;
        if (op.Body.Str("decision") == "deny") return new { redirectUrl = Callback(data, "error", "access_denied") };
        var scopes = Scopes(string.Join(' ', op.Body["scopes"]!.AsArray().Select(x => x!.GetValue<string>()))); if (scopes.Except(requested).Any()) throw J.Fail(400, "validation_failed", "Nicht angeforderte Scopes dürfen nicht genehmigt werden.");
        var access = new AgentAccess { OwnerId = a.Account.Id, Name = Security.Name(op.Body.Str("name"), 100), Kind = "oauth", ClientId = data.Str("client_id") }; Db.Add(access); management.ApplyGrants(a, access, op.Body);
        var code = J.Secret(); data["accessId"] = access.Id.ToString(); data["scopes"] = J.Node(scopes);
        Db.Add(new Flow { Kind = "oauth-code", OwnerId = a.Account.Id, Hash = J.Hash(code), Data = data.ToJsonString(), ExpiresAt = Clock.Now.AddMinutes(5) });
        return new { redirectUrl = Callback(data, "code", code) };
    }
    public async Task<object> Token(JsonObject input, CancellationToken ct)
    {
        var client = input.Str("client_id"); await clients.Get(client, ct); Target(input.Str("resource"));
        if (ClientAuthentication(input)) throw new OAuthException("invalid_request", "Clientauthentifizierung wird nicht unterstützt.");
        if (input.Str("grant_type") == "authorization_code")
        {
            var hash = J.Hash(input.Str("code")); var flow = Db.Flows.SingleOrDefault(x => x.Kind == "oauth-code" && x.Hash == hash);
            if (flow == null || flow.Consumed || flow.ExpiresAt <= Clock.Now) throw new OAuthException("invalid_grant", "Code ungültig oder abgelaufen.");
            var d = JsonNode.Parse(flow.Data)!.AsObject(); var verifier = input.Str("code_verifier"); var challenge = Convert.ToBase64String(SHA256.HashData(Encoding.ASCII.GetBytes(verifier))).TrimEnd('=').Replace('+', '-').Replace('/', '_');
            if (d.Str("client_id") != client || d.Str("redirect_uri") != input.Str("redirect_uri") || d.Str("resource") != input.Str("resource") || !Regex.IsMatch(verifier, "^[A-Za-z0-9._~-]{43,128}$") || challenge != d.Str("code_challenge")) throw new OAuthException("invalid_grant", "Codebindung oder PKCE ungültig.");
            var access = Live(d.Id("accessId")); var family = new OAuthFamily { AccessId = access.Id, ClientId = client, Resource = Resource, Scopes = d["scopes"]!.AsArray().Select(x => x!.GetValue<string>()).ToArray() }; Db.Add(family); flow.Consumed = true;
            return Issue(family, access);
        }
        if (input.Str("grant_type") != "refresh_token") throw new OAuthException("unsupported_grant_type", "Grant wird nicht unterstützt.");
        var refreshHash = J.Hash(input.Str("refresh_token")); var refresh = Db.Credentials.SingleOrDefault(x => x.Hash == refreshHash && x.Kind == "refresh");
        if (refresh?.FamilyId == null) throw new OAuthException("invalid_grant", "Refresh-Token ungültig.");
        var familyState = Db.Families.SingleOrDefault(x => x.Id == refresh.FamilyId);
        if (familyState == null || familyState.ClientId != client || familyState.Resource != input.Str("resource")) throw new OAuthException("invalid_grant", "Refresh-Bindung ungültig.");
        if (refresh.RevokedAt != null) { familyState.Revoked = true; foreach (var c in Db.Credentials.Where(x => x.FamilyId == familyState.Id)) c.RevokedAt = Clock.Now; throw new OAuthException("invalid_grant", "Refresh-Wiederverwendung hat die Verbindung widerrufen.") { PersistState = true }; }
        if (familyState.Revoked || refresh.ExpiresAt <= Clock.Now || familyState.CreatedAt.AddDays(180) <= Clock.Now || familyState.LastUsedAt.AddDays(30) <= Clock.Now) throw new OAuthException("invalid_grant", "Verbindung ist abgelaufen.");
        var live = Live(familyState.AccessId);
        if (input.ContainsKey("scope")) { var scopes = Scopes(input.Str("scope")); if (scopes.Except(familyState.Scopes).Any()) throw new OAuthException("invalid_scope", "Scopes dürfen nur reduziert werden."); familyState.Scopes = scopes; }
        refresh.RevokedAt = Clock.Now; familyState.LastUsedAt = Clock.Now; return Issue(familyState, live);
    }
    public Task Revoke(JsonObject input, CancellationToken ct)
    {
        if (ClientAuthentication(input)) throw new OAuthException("invalid_request", "Clientauthentifizierung wird nicht unterstützt.");
        var client = input.Str("client_id"); if (!clients.Allowed(client)) throw new OAuthException("invalid_client", "Client ist nicht freigegeben.");
        var hash = J.Hash(input.Str("token")); var token = Db.Credentials.SingleOrDefault(x => x.Hash == hash && (x.Kind == "access" || x.Kind == "refresh"));
        if (token?.FamilyId is { } id) { var family = Db.Families.SingleOrDefault(x => x.Id == id && x.ClientId == client); if (family != null) { if (token.Kind == "refresh") { family.Revoked = true; foreach (var c in Db.Credentials.Where(x => x.FamilyId == id)) c.RevokedAt = Clock.Now; } else token.RevokedAt = Clock.Now; } }
        return Task.CompletedTask;
    }
    private object Issue(OAuthFamily family, AgentAccess access)
    {
        var token = J.Secret(); var refresh = J.Secret(); Db.Add(new Credential { AccessId = access.Id, Kind = "access", FamilyId = family.Id, Hash = J.Hash(token), ExpiresAt = Clock.Now.AddMinutes(15), Scopes = family.Scopes });
        Db.Add(new Credential { AccessId = access.Id, Kind = "refresh", FamilyId = family.Id, Hash = J.Hash(refresh), ExpiresAt = new[] { Clock.Now.AddDays(30), family.CreatedAt.AddDays(180) }.Min(), Scopes = family.Scopes });
        return new { access_token = token, token_type = "Bearer", expires_in = 900, refresh_token = refresh, scope = string.Join(' ', family.Scopes) };
    }
    private AgentAccess Live(Guid id) { var a = Db.Accesses.SingleOrDefault(x => x.Id == id && x.RevokedAt == null); if (a == null || !Db.Accounts.Any(x => x.Id == a.OwnerId && !x.Suspended) || a.ClientId == null || !clients.Allowed(a.ClientId)) throw new OAuthException("invalid_grant", "Verbindung wurde widerrufen."); return a; }
    private void Target(string resource) { if (resource != Resource) throw new OAuthException("invalid_target", "Ressource stimmt nicht überein."); }
    private static bool ClientAuthentication(JsonObject input) => input.ContainsKey("client_secret") || input.ContainsKey("client_assertion") || input.ContainsKey("client_assertion_type");
    private static string[] Scopes(string text) { var s = text.Split(' ', StringSplitOptions.RemoveEmptyEntries).Distinct().Order().ToArray(); if (s.Length == 0 || s.Except(new[] { "memory:read", "memory:write", "memory:delete" }).Any() || !s.Contains("memory:read") || s.Contains("memory:delete") && !s.Contains("memory:write")) throw new OAuthException("invalid_scope", "Scopes müssen bekannt und kumulativ sein."); return s; }
    private string Callback(JsonObject data, string key, string value) { var target = data.Str("redirect_uri"); return target + (target.Contains('?') ? "&" : "?") + key + "=" + Uri.EscapeDataString(value) + "&iss=" + Uri.EscapeDataString(Options.BaseUrl) + (data.ContainsKey("state") ? "&state=" + Uri.EscapeDataString(data.Str("state")) : ""); }
}
