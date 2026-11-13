using System.Text.Json;
using System.Text.Json.Nodes;
using Memoryaffe.Application;
using Memoryaffe.Infrastructure;
using ModelContextProtocol;
using ModelContextProtocol.AspNetCore;
using ModelContextProtocol.Protocol;

public static class AgentTransport
{
    public static void AddAgents(this WebApplicationBuilder builder)
    {
        var catalog = new Contracts(Path.Combine(AppContext.BaseDirectory, "contracts"));
        builder.Services.AddMcpServer(o => { o.ServerInfo = new Implementation { Name = "memoryaffe", Version = "0.1.0" }; o.ProtocolVersion = "2025-11-25"; })
            .WithHttpTransport(o => o.SessionMode = HttpServerSessionMode.Stateless)
            .WithListToolsHandler((request, ct) => ValueTask.FromResult(JsonSerializer.Deserialize<ListToolsResult>(catalog.Tools.ToJsonString(), J.Options)!))
            .WithCallToolHandler(async (request, ct) =>
            {
                var http = request.Services!.GetRequiredService<IHttpContextAccessor>().HttpContext!;
                var runtime = http.RequestServices.GetRequiredService<ProductRuntime>(); var accounts = http.RequestServices.GetRequiredService<AccountService>(); var clients = http.RequestServices.GetRequiredService<CimdClient>();
                var name = request.Params?.Name ?? "";
                var tool = catalog.Tools["tools"]!.AsArray().SingleOrDefault(x => x!["name"]!.GetValue<string>() == name);
                if (tool == null) throw new McpException("Unknown tool.");
                try
                {
                    var input = Contracts.Parse(J.Obj(request.Params!.Arguments ?? new Dictionary<string, JsonElement>()).ToJsonString()).AsObject(); catalog.Validate(input, tool["inputSchema"]!, tool["inputSchema"]!.AsObject());
                    var result = await runtime.Transaction(async () =>
                    {
                        var actor = accounts.Authenticate(ProductRuntime.Bearer(http), null, true, clients.Allowed) ?? throw J.Fail(401, "authentication_required", "Ungültige Anmeldung.");
                        return await runtime.Run(actor, ToolOperation(name, input), ct);
                    }, ct, input.ContainsKey("idempotencyKey"));
                    var node = J.Node(result); catalog.Validate(node, tool["outputSchema"]!, tool["outputSchema"]!.AsObject());
                    return JsonSerializer.Deserialize<CallToolResult>(J.Obj(new { content = new[] { new { type = "text", text = node.ToJsonString(J.Options) } }, structuredContent = node, isError = false }).ToJsonString(), J.Options)!;
                }
                catch (ProductException e)
                {
                    var error = J.Obj(new { code = e.Code, message = e.Message, requestId = http.TraceIdentifier });
                    return JsonSerializer.Deserialize<CallToolResult>(J.Obj(new { content = new[] { new { type = "text", text = error.ToJsonString() } }, isError = true }).ToJsonString(), J.Options)!;
                }
            });
    }
    public static void MapAgents(this WebApplication app)
    {
        app.Use(async (context, next) =>
        {
            if (!context.Request.Path.StartsWithSegments("/mcp")) { await next(); return; }
            var options = context.RequestServices.GetRequiredService<ProductOptions>();
            var origin = context.Request.Headers.Origin.ToString(); if (origin.Length > 0 && origin != options.BaseUrl) { context.Response.StatusCode = 403; return; }
            var runtime = context.RequestServices.GetRequiredService<ProductRuntime>(); var accounts = context.RequestServices.GetRequiredService<AccountService>(); var clients = context.RequestServices.GetRequiredService<CimdClient>();
            if (context.Request.Cookies.ContainsKey(runtime.Cookie)) { context.Response.StatusCode = 400; return; }
            var actor = await runtime.Transaction(() => Task.FromResult(accounts.Authenticate(ProductRuntime.Bearer(context), null, true, clients.Allowed)), context.RequestAborted);
            if (actor == null)
            {
                context.Response.StatusCode = 401; context.Response.Headers.WWWAuthenticate = $"Bearer resource_metadata=\"{options.BaseUrl}/.well-known/oauth-protected-resource/mcp\", scope=\"memory:read\"" + (context.Request.Headers.ContainsKey("Authorization") ? ", error=\"invalid_token\"" : ""); return;
            }
            context.User = ProductRuntime.Principal(actor);
            var required = "memory:read";
            if (context.Request.Method == "POST")
            {
                context.Request.EnableBuffering(); string raw;
                try { raw = await ApiTransport.Read(context.Request, 8388608, context.RequestAborted); }
                catch (System.Text.DecoderFallbackException) { context.Request.Body.Position = 0; await next(); return; }
                context.Request.Body.Position = 0;
                try { var message = Contracts.Parse(raw); if (message["method"]?.GetValue<string>() == "tools/call") { var name = message["params"]?["name"]?.GetValue<string>(); if (name == "delete_memory") required = "memory:delete"; else if (name is "create_memory" or "update_memory" or "create_tag") required = "memory:write"; } } catch (Exception e) when (e is JsonException or ProductException or InvalidOperationException) { /* SDK returns the JSON-RPC parse error. */ }
            }
            if (!actor.Credential!.Scopes.Contains(required)) { context.Response.StatusCode = 403; var cumulative = required == "memory:delete" ? "memory:read memory:write memory:delete" : required == "memory:write" ? "memory:read memory:write" : "memory:read"; context.Response.Headers.WWWAuthenticate = $"Bearer error=\"insufficient_scope\", scope=\"{cumulative}\""; return; }
            await next();
        });
        app.MapMcp("/mcp");
        app.MapGet("/.well-known/oauth-authorization-server", (OAuthService oauth) => Results.Json(oauth.Discovery));
        app.MapGet("/.well-known/oauth-protected-resource/mcp", (OAuthService oauth) => Results.Json(oauth.ResourceMetadata));
        app.MapGet("/oauth/authorize", async (HttpContext http, OAuthService oauth, ProductRuntime runtime, ProductOptions options) => await OAuthResult(http, async () =>
        {
            var input = Query(http.Request.Query); var browser = http.Request.Cookies["memoryaffe.oauth"];
            if (browser == null) { browser = J.Secret(); http.Response.Cookies.Append("memoryaffe.oauth", browser, new CookieOptions { HttpOnly = true, Secure = !options.Development, SameSite = SameSiteMode.Lax, Path = "/", MaxAge = TimeSpan.FromMinutes(15) }); }
            var redirect = await runtime.Transaction(() => oauth.Authorize(input, browser, http.RequestAborted), http.RequestAborted); return Results.Redirect(redirect);
        }));
        app.MapPost("/oauth/token", async (HttpContext http, OAuthService oauth, ProductRuntime runtime) => await OAuthResult(http, async () =>
        {
            var input = await Form(http); var result = await runtime.Transaction(() => oauth.Token(input, http.RequestAborted), http.RequestAborted); return Results.Json(result);
        }));
        app.MapPost("/oauth/revoke", async (HttpContext http, OAuthService oauth, ProductRuntime runtime) => await OAuthResult(http, async () =>
        {
            var input = await Form(http); await runtime.Transaction(async () => { await oauth.Revoke(input, http.RequestAborted); return true; }, http.RequestAborted); return Results.Ok();
        }));
    }
    private static async Task<IResult> OAuthResult(HttpContext http, Func<Task<IResult>> handler)
    {
        http.Response.Headers.CacheControl = "no-store"; http.Response.Headers.Pragma = "no-cache";
        try { return await handler(); }
        catch (OAuthException e) { if (e.Status is 429 or 503) http.Response.Headers.RetryAfter = "5"; return Results.Json(new { error = e.Code, error_description = e.Message }, statusCode: e.Status); }
        catch (ProductException e) { return Results.Json(new { error = "invalid_request", error_description = e.Message }, statusCode: 400); }
        catch (Exception e) when (e is System.Text.DecoderFallbackException or JsonException or FormatException) { return Results.Json(new { error = "invalid_request", error_description = "Ungültige UTF-8-/Formkodierung." }, statusCode: 400); }
    }
    private static JsonObject Query(IQueryCollection query) { var result = new JsonObject(); foreach (var (key, value) in query) { if (value.Count != 1) throw new OAuthException("invalid_request", "Doppelte Parameter sind nicht erlaubt."); result[key] = value.ToString(); } return result; }
    private static async Task<JsonObject> Form(HttpContext http)
    {
        if (http.Request.Headers.Authorization.Count > 0 || http.Request.ContentType?.StartsWith("application/x-www-form-urlencoded", StringComparison.OrdinalIgnoreCase) != true || http.Request.ContentLength > 16384) throw new OAuthException("invalid_request", "Formparameter ohne Clientauthentifizierung erwartet.");
        var text = await ApiTransport.Read(http.Request, 16384, http.RequestAborted); var result = new JsonObject();
        foreach (var field in text.Split('&', StringSplitOptions.RemoveEmptyEntries)) { var pair = field.Split('=', 2); var key = DecodeForm(pair[0]); var value = pair.Length == 2 ? DecodeForm(pair[1]) : ""; if (result.ContainsKey(key)) throw new OAuthException("invalid_request", "Doppelte Parameter sind nicht erlaubt."); result[key] = value; }
        return result;
    }
    private static string DecodeForm(string input)
    {
        var raw = System.Text.Encoding.UTF8.GetBytes(input.Replace('+', ' ')); using var bytes = new MemoryStream();
        for (var i = 0; i < raw.Length; i++) { if (raw[i] == '%') { if (i + 2 >= raw.Length || !byte.TryParse(System.Text.Encoding.ASCII.GetString(raw, i + 1, 2), System.Globalization.NumberStyles.HexNumber, System.Globalization.CultureInfo.InvariantCulture, out var decoded)) throw new OAuthException("invalid_request", "Ungültige Formkodierung."); bytes.WriteByte(decoded); i += 2; } else bytes.WriteByte(raw[i]); }
        var text = new System.Text.UTF8Encoding(false, true).GetString(bytes.ToArray()); if (text.Contains('\0')) throw new OAuthException("invalid_request", "Ungültige Formkodierung."); return text;
    }
    private static Operation ToolOperation(string name, JsonObject input)
    {
        var body = (JsonObject)input.DeepClone(); var path = new JsonObject(); var query = new JsonObject(); var key = body.Str("idempotencyKey"); body.Remove("idempotencyKey");
        if (name is "list_tags" or "create_tag") { path["vaultId"] = body["vaultId"]?.DeepClone(); body.Remove("vaultId"); }
        if (name is "get_memory" or "update_memory" or "delete_memory") { path["id"] = body["id"]?.DeepClone(); body.Remove("id"); }
        if (name is "list_vaults" or "list_tags") { query = body; body = new(); }
        if (name == "delete_memory") { query["expectedRevision"] = body["expectedRevision"]?.DeepClone(); body.Remove("expectedRevision"); }
        return new("web_" + name, body, path, query, key.Length > 0 ? key : null);
    }
}
