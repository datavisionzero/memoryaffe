using System.Net;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Memoryaffe.Application;
using ModelContextProtocol.Client;
using ModelContextProtocol.Protocol;

var baseUrl = Environment.GetEnvironmentVariable("MEMORYAFFE_TEST_BASE_URL") ?? "http://127.0.0.1:5080";
var email = Environment.GetEnvironmentVariable("MEMORYAFFE_TEST_ADMIN_EMAIL") ?? throw new InvalidOperationException("Testkonto fehlt.");
var password = Environment.GetEnvironmentVariable("MEMORYAFFE_TEST_ADMIN_PASSWORD") ?? throw new InvalidOperationException("Testpasswort fehlt.");
var fixturesPath = Environment.GetEnvironmentVariable("MEMORYAFFE_TEST_CIMD_FILE") ?? throw new InvalidOperationException("Test-CIMD-Datei fehlt.");
var allowedPath = Environment.GetEnvironmentVariable("MEMORYAFFE_TEST_ALLOWED_CLIENTS_FILE") ?? throw new InvalidOperationException("Testfreigaben fehlen.");
const string clientId = "https://client.example.test/metadata.json", redirectUri = "https://client.example.test/callback";
var browser = new Browser(baseUrl); await browser.Csrf(); var login = await browser.Json("POST", "/api/v1/auth/login", new { email, password }); Check(login.Data!["status"]!.GetValue<string>() == "authenticated", "Testkonto muss ohne 2FA angemeldet sein."); await browser.Csrf();
var discovery = await browser.Json("GET", "/.well-known/oauth-authorization-server"); Check(discovery.Data!["issuer"]!.GetValue<string>() == baseUrl && discovery.Data["registration_endpoint"] == null, "Discovery identities/capabilities");
var vault = (await browser.Json("POST", "/api/v1/vaults", new { name = "Protocol " + Guid.NewGuid().ToString("N")[..8] })).Data!;
var vaultId = vault["id"]!.GetValue<string>();
var profile = (await browser.Json("GET", "/api/v1/me")).Data!;
if (!profile["allowAgentTagCreation"]!.GetValue<bool>()) await browser.Json("PATCH", "/api/v1/me", new { expectedRevision = profile["revision"]!.GetValue<string>(), allowAgentTagCreation = true });
var goodFixtures = await File.ReadAllTextAsync(fixturesPath); var goodAllowed = await File.ReadAllTextAsync(allowedPath);
try
{
    using var anonymous = new HttpClient(new HttpClientHandler { AllowAutoRedirect = false });
    foreach (var bytes in new[] { new byte[] { 0xff }, Encoding.ASCII.GetBytes("grant_type=%ff") })
    {
        var content = new ByteArrayContent(bytes); content.Headers.ContentType = new MediaTypeHeaderValue("application/x-www-form-urlencoded"); var malformed = await anonymous.PostAsync(baseUrl + "/oauth/token", content); var error = JsonNode.Parse(await malformed.Content.ReadAsStringAsync()); Check((int)malformed.StatusCode == 400 && error?["error"]?.GetValue<string>() == "invalid_request", "Malformed OAuth UTF8 has OAuth error format");
    }
    Error(await browser.Form("/oauth/revoke", new { client_id = clientId, token = "unrecognized", client_secret = "unsupported" }), "invalid_request");
    var challenge = await anonymous.PostAsync(baseUrl + "/mcp", new StringContent("{}", Encoding.UTF8, "application/json")); Check(challenge.StatusCode == HttpStatusCode.Unauthorized && challenge.Headers.WwwAuthenticate.ToString().Contains("resource_metadata"), "MCP challenge");
    var unsafeRedirect = await browser.Raw("GET", "/oauth/authorize?" + Query(new { client_id = clientId, redirect_uri = "https://evil.example/callback", resource = baseUrl + "/mcp", response_type = "code", code_challenge = new string('a', 43), code_challenge_method = "S256" })); Check(unsafeRedirect.StatusCode == HttpStatusCode.BadRequest && unsafeRedirect.Headers.Location == null, "Unregistered redirect remains local");
    var grant = await Grant();
    var wrongResource = await Token(new { grant_type = "authorization_code", client_id = clientId, resource = "https://wrong.example/mcp", redirect_uri = redirectUri, code = grant.Code, code_verifier = grant.Verifier }); Error(wrongResource, "invalid_target");
    var wrongPkce = await Token(new { grant_type = "authorization_code", client_id = clientId, resource = baseUrl + "/mcp", redirect_uri = redirectUri, code = grant.Code, code_verifier = new string('x', 43) }); Error(wrongPkce, "invalid_grant");
    var issued = await Exchange(grant); var access = issued["access_token"]!.GetValue<string>(); var refresh = issued["refresh_token"]!.GetValue<string>();
    Error(await Token(new { grant_type = "authorization_code", client_id = clientId, resource = baseUrl + "/mcp", redirect_uri = redirectUri, code = grant.Code, code_verifier = grant.Verifier }), "invalid_grant");
    await using (var transport = new HttpClientTransport(new HttpClientTransportOptions { Endpoint = new Uri(baseUrl + "/mcp"), TransportMode = HttpTransportMode.StreamableHttp, AdditionalHeaders = new Dictionary<string, string> { ["Authorization"] = "Bearer " + access } }))
    await using (var mcp = await McpClient.CreateAsync(transport, new McpClientOptions { ProtocolVersion = "2025-11-25" }))
    {
        var tools = await mcp.ListToolsAsync(); Check(tools.Count == 8, "Exactly eight SDK tools");
        var vaults = await Tool(mcp, "list_vaults", new()); Check(vaults["items"]!.AsArray().Count == 1, "OAuth explicit vault boundary");
        var tag = await Tool(mcp, "create_tag", new() { ["vaultId"] = vaultId, ["name"] = "Protocol", ["idempotencyKey"] = Guid.NewGuid().ToString() });
        var tags = await Tool(mcp, "list_tags", new() { ["vaultId"] = vaultId }); Check(tags["items"]!.AsArray().Count == 1, "MCP list tags");
        var created = await Tool(mcp, "create_memory", new() { ["vaultId"] = vaultId, ["title"] = "SDK alpha", ["markdown"] = "Protocol beta\r\nGrüße 😀", ["tagIds"] = new[] { tag["id"]!.GetValue<string>() }, ["idempotencyKey"] = Guid.NewGuid().ToString() });
        var id = created["id"]!.GetValue<string>();
        var memory = await Tool(mcp, "get_memory", new() { ["id"] = id }); Check(memory["markdown"]!.GetValue<string>().EndsWith("Grüße 😀"), "SDK text fidelity");
        var search = await Tool(mcp, "search_memories", new() { ["vaultId"] = vaultId, ["query"] = "alpha beta" }); Check(search["items"]!.AsArray().Count == 1, "MCP search AND across fields");
        var updated = await Tool(mcp, "update_memory", new() { ["id"] = id, ["expectedRevision"] = created["revision"]!.GetValue<string>(), ["summary"] = "SDK update" });
        var conflict = await mcp.CallToolAsync("update_memory", new Dictionary<string, object?> { ["id"] = id, ["expectedRevision"] = "1", ["title"] = "conflict" }); Check(conflict.IsError == true && conflict.StructuredContent == null, "MCP business error mapping");
        await Tool(mcp, "delete_memory", new() { ["id"] = id, ["expectedRevision"] = updated["revision"]!.GetValue<string>() });
    }
    Console.WriteLine("PASS OAuth discovery/CIMD/consent/PKCE/code-reuse and all eight official SDK MCP calls");
    await File.WriteAllTextAsync(fixturesPath, "{}"); var unavailable = await Token(new { grant_type = "refresh_token", client_id = clientId, resource = baseUrl + "/mcp", refresh_token = refresh }); Check(unavailable.Status == 503 && unavailable.Data!["error"]!.GetValue<string>() == "temporarily_unavailable", "Expired CIMD cache fails refresh without consume");
    await File.WriteAllTextAsync(fixturesPath, goodFixtures); var rotated = (await Token(new { grant_type = "refresh_token", client_id = clientId, resource = baseUrl + "/mcp", refresh_token = refresh })).Data!; Check(rotated["access_token"] != null, "Refresh remained unconsumed on metadata failure");
    Error(await Token(new { grant_type = "refresh_token", client_id = clientId, resource = baseUrl + "/mcp", refresh_token = refresh }), "invalid_grant");
    Check(await McpStatus(access) == 401 && await McpStatus(rotated["access_token"]!.GetValue<string>()) == 401, "Refresh reuse revokes entire family");
    var second = await Exchange(await Grant()); var secondAccess = second["access_token"]!.GetValue<string>();
    await File.WriteAllTextAsync(allowedPath, "[]"); Check(await McpStatus(secondAccess) == 401, "Allowlist removal immediately blocks existing access");
    Error(await Token(new { grant_type = "refresh_token", client_id = clientId, resource = baseUrl + "/mcp", refresh_token = second["refresh_token"]!.GetValue<string>() }), "invalid_client");
    await File.WriteAllTextAsync(allowedPath, goodAllowed); Check(await McpStatus(secondAccess) != 401, "Restored allowlist restores otherwise valid access");
    var revoked = await browser.Form("/oauth/revoke", new { client_id = clientId, token = second["refresh_token"]!.GetValue<string>() }); Check(revoked.Status == 200 && await McpStatus(secondAccess) == 401, "RFC7009 refresh revokes family");
    var readOnly = await Exchange(await Grant("memory:read")); var readToken = readOnly["access_token"]!.GetValue<string>();
    using var rawMcp = new HttpClient(); rawMcp.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", readToken); rawMcp.DefaultRequestHeaders.Accept.ParseAdd("application/json, text/event-stream");
    var denied = await rawMcp.PostAsync(baseUrl + "/mcp", new StringContent("{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"delete_memory\",\"arguments\":{}}}", Encoding.UTF8, "application/json")); Check((int)denied.StatusCode == 403 && denied.Headers.WwwAuthenticate.ToString().Contains("memory:read memory:write memory:delete"), "Cumulative insufficient-scope challenge");
    var origin = new HttpRequestMessage(HttpMethod.Post, baseUrl + "/mcp") { Content = new StringContent("{}", Encoding.UTF8, "application/json") }; origin.Headers.Authorization = new("Bearer", readToken); origin.Headers.Add("Origin", "https://evil.example"); Check((int)(await rawMcp.SendAsync(origin)).StatusCode == 403, "MCP foreign Origin");
    Console.WriteLine("PASS CIMD outage preserves refresh, strict refresh reuse, allowlist live revocation, OAuth revocation, scopes and Origin negatives");
}
finally { await File.WriteAllTextAsync(fixturesPath, goodFixtures); await File.WriteAllTextAsync(allowedPath, goodAllowed); }

async Task<(string Code, string Verifier)> Grant(string scope = "memory:read memory:write memory:delete")
{
    var verifier = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant(); var challenge = Convert.ToBase64String(SHA256.HashData(Encoding.ASCII.GetBytes(verifier))).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    var start = await browser.Raw("GET", "/oauth/authorize?" + Query(new { response_type = "code", client_id = clientId, redirect_uri = redirectUri, resource = baseUrl + "/mcp", code_challenge_method = "S256", code_challenge = challenge, scope, state = "state/ü?&" })); Check((int)start.StatusCode == 302, "Authorization redirect");
    var id = start.Headers.Location!.Segments.Last(); var request = await browser.Json("GET", "/api/v1/oauth/requests/" + id); Check(request.Status == 200 && request.Data!["clientId"]!.GetValue<string>() == clientId, "Bound consent request");
    var other = new Browser(baseUrl); await other.Csrf(); await other.Json("POST", "/api/v1/auth/login", new { email, password }); await other.Csrf(); Check((await other.Json("GET", "/api/v1/oauth/requests/" + id)).Status == 404, "Consent is browser bound");
    var decided = await browser.Json("POST", "/api/v1/oauth/requests/" + id + "/decision", new { decision = "approve", name = "SDK test", grants = new[] { new { vaultId, level = "delete" } }, scopes = scope.Split(' ') }); Check(decided.Status == 200, "Explicit consent");
    var callback = new Uri(decided.Data!["redirectUrl"]!.GetValue<string>()); var parameters = Microsoft.AspNetCore.WebUtilities.QueryHelpers.ParseQuery(callback.Query); Check(parameters["iss"] == baseUrl && parameters["state"] == "state/ü?&", "Callback issuer and state");
    return (parameters["code"].ToString(), verifier);
}
async Task<JsonNode> Exchange((string Code, string Verifier) grant) { var r = await Token(new { grant_type = "authorization_code", client_id = clientId, redirect_uri = redirectUri, resource = baseUrl + "/mcp", code = grant.Code, code_verifier = grant.Verifier }); Check(r.Status == 200, "Code exchange"); return r.Data!; }
Task<Response> Token(object value) => browser.Form("/oauth/token", value);
async Task<int> McpStatus(string token) { using var http = new HttpClient(); var req = new HttpRequestMessage(HttpMethod.Post, baseUrl + "/mcp") { Content = new StringContent("{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/list\",\"params\":{}}", Encoding.UTF8, "application/json") }; req.Headers.Authorization = new("Bearer", token); req.Headers.Accept.ParseAdd("application/json, text/event-stream"); req.Headers.Add("MCP-Protocol-Version", "2025-11-25"); return (int)(await http.SendAsync(req)).StatusCode; }
static async Task<JsonNode> Tool(McpClient client, string name, Dictionary<string, object?> arguments) { var result = await client.CallToolAsync(name, arguments); Check(result.IsError != true, "MCP tool failed: " + name + " " + string.Join(' ', result.Content.OfType<TextContentBlock>().Select(x => x.Text))); Check(result.StructuredContent != null, "MCP structured result: " + name); return JsonNode.Parse(result.StructuredContent!.Value.GetRawText())!; }
static void Error(Response r, string code) => Check(r.Status == 400 && r.Data?["error"]?.GetValue<string>() == code, "OAuth error " + code + ", received " + r.Status + "/" + r.Data?["error"]?.GetValue<string>());
static void Check(bool condition, string message) { if (!condition) throw new Exception(message); }
static string Query(object value) => string.Join('&', J.Obj(value).Select(x => Uri.EscapeDataString(x.Key) + "=" + Uri.EscapeDataString(x.Value!.GetValue<string>())));
record Response(int Status, JsonNode? Data);
sealed class Browser(string baseUrl)
{
    private readonly HttpClient http = new(new HttpClientHandler { CookieContainer = new CookieContainer(), AllowAutoRedirect = false });
    private string csrf = "";
    public async Task Csrf() { var r = await Json("GET", "/api/v1/auth/csrf"); csrf = r.Data!["requestToken"]!.GetValue<string>(); }
    public async Task<HttpResponseMessage> Raw(string method, string path, HttpContent? content = null) { var request = new HttpRequestMessage(new HttpMethod(method), baseUrl + path) { Content = content }; if (method != "GET" && path.StartsWith("/api", StringComparison.Ordinal)) request.Headers.Add("X-CSRF-Token", csrf); return await http.SendAsync(request); }
    public async Task<Response> Json(string method, string path, object? value = null, string? proof = null) { var request = new HttpRequestMessage(new HttpMethod(method), baseUrl + path); if (value != null) request.Content = new StringContent(JsonSerializer.Serialize(value, J.Options), Encoding.UTF8, "application/json"); if (method != "GET") request.Headers.Add("X-CSRF-Token", csrf); if (proof != null) request.Headers.Add("X-Action-Proof", proof); var response = await http.SendAsync(request); var text = await response.Content.ReadAsStringAsync(); return new((int)response.StatusCode, text.Length == 0 ? null : JsonNode.Parse(text)); }
    public async Task<Response> Form(string path, object value) { var content = new FormUrlEncodedContent(J.Obj(value).Select(x => KeyValuePair.Create(x.Key, x.Value!.GetValue<string>()))); var response = await Raw("POST", path, content); var text = await response.Content.ReadAsStringAsync(); return new((int)response.StatusCode, text.Length == 0 ? null : JsonNode.Parse(text)); }
}
