using System.Security.Claims;
using System.Text;
using System.Text.Json.Nodes;
using Memoryaffe.Application;
using Memoryaffe.Domain;
using Memoryaffe.Infrastructure;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.HttpOverrides;

var builder = WebApplication.CreateBuilder(args);
var baseUrl = (builder.Configuration["Memoryaffe:BaseUrl"] ?? "http://127.0.0.1:5080").TrimEnd('/');
var development = builder.Environment.IsDevelopment();
if (!Uri.TryCreate(baseUrl, UriKind.Absolute, out var baseUri) || baseUri.AbsolutePath != "/" || baseUri.Query.Length > 0 || baseUri.Fragment.Length > 0 || baseUri.UserInfo.Length > 0 || (baseUri.Scheme != "https" && !(development && baseUri.IsLoopback && baseUri.Scheme == "http"))) throw new InvalidOperationException("Memoryaffe:BaseUrl muss eine HTTPS-Origin sein (HTTP localhost nur in Development).");
var rateMultiplier = development ? builder.Configuration.GetValue("Memoryaffe:TestRateMultiplier", 1) : 1;
if (rateMultiplier is < 1 or > 100 || !development && builder.Configuration["Memoryaffe:TestRateMultiplier"] != null) throw new InvalidOperationException("Testraten sind nur in Development zwischen1und100 erlaubt.");
var productOptions = new ProductOptions(baseUrl, builder.Configuration["Memoryaffe:SetupSecret"] ?? "", development, rateMultiplier);
var keyDirectory = builder.Configuration["Memoryaffe:KeyDirectory"] ?? Path.Combine(builder.Environment.ContentRootPath, "keys");
PrivateStorage.Directory(keyDirectory);
if (!development && builder.Configuration["Memoryaffe:TestCimdFile"] != null) throw new InvalidOperationException("CIMD-Testmetadaten sind in Production nicht erlaubt.");
builder.Services.Configure<ForwardedHeadersOptions>(o => { o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto; o.ForwardLimit = 1; o.KnownProxies.Clear(); o.KnownIPNetworks.Clear(); foreach (var proxy in builder.Configuration.GetSection("Memoryaffe:KnownProxies").GetChildren()) o.KnownProxies.Add(System.Net.IPAddress.Parse(proxy.Value!)); });
builder.Services.AddDataProtection().PersistKeysToFileSystem(new DirectoryInfo(keyDirectory)).SetApplicationName("memoryaffe");
builder.Services.AddAntiforgery(o => { o.HeaderName = "X-CSRF-Token"; o.Cookie.Name = development ? "memoryaffe.csrf" : "__Host-memoryaffe.csrf"; o.Cookie.SecurePolicy = development ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always; o.Cookie.SameSite = SameSiteMode.Strict; o.Cookie.HttpOnly = true; });
builder.Services.AddSingleton(productOptions);
builder.Services.AddSingleton(new Contracts(Path.Combine(AppContext.BaseDirectory, "contracts")));
builder.Services.AddDbContext<Database>(o => o.UseNpgsql(builder.Configuration.GetConnectionString("Database") ?? throw new InvalidOperationException("ConnectionStrings:Database fehlt.")));
builder.Services.AddScoped<IDataStore>(s => s.GetRequiredService<Database>());
builder.Services.AddSingleton<ISecurity, Security>();
builder.Services.AddScoped<AccountService>(); builder.Services.AddScoped<MemoryService>(); builder.Services.AddScoped<ManagementService>();
builder.Services.AddScoped<ProductRuntime>();
builder.Services.AddSingleton<RequestBudgets>();
builder.Services.AddSingleton<CimdClient>(); builder.Services.AddScoped<OAuthService>();
builder.Services.AddScoped<ArchiveService>(); builder.Services.AddHostedService<Maintenance>();
builder.Services.AddHostedService<SearchReindexer>();
builder.Services.AddHttpContextAccessor();
builder.AddAgents();
builder.WebHost.ConfigureKestrel(o => o.Limits.MaxRequestBodySize = 101L * 1024 * 1024);
builder.Logging.AddFilter("Microsoft.AspNetCore", LogLevel.Warning).AddFilter("ModelContextProtocol", LogLevel.Warning).AddFilter("Microsoft.EntityFrameworkCore.Database.Command", LogLevel.Warning);
var app = builder.Build();
await using (var scope = app.Services.CreateAsyncScope())
{
    var db = scope.ServiceProvider.GetRequiredService<Database>(); await db.Database.OpenConnectionAsync();
    await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_lock(734102801)");
    try { await db.Database.MigrateAsync(); } finally { await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_unlock(734102801)"); }
    if (builder.Configuration["recover-admin"] is { } rescueEmail)
    {
        var account = await db.Accounts.SingleOrDefaultAsync(x => x.EmailKey == rescueEmail.Trim().ToUpperInvariant() && x.IsAdmin && !x.Suspended) ?? throw new InvalidOperationException("Aktives Administratorkonto nicht gefunden.");
        var link = await scope.ServiceProvider.GetRequiredService<ProductRuntime>().Transaction(() => Task.FromResult(scope.ServiceProvider.GetRequiredService<ManagementService>().IssueLink(account.Id, "recovery", TimeSpan.FromHours(1))), CancellationToken.None);
        Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(link, J.Options)); return;
    }
    if (!await db.Accounts.AnyAsync() && productOptions.SetupSecret.Length < 24) throw new InvalidOperationException("Memoryaffe:SetupSecret benötigt vor Ersteinrichtung mindestens24Zeichen.");
}
if (builder.Configuration.GetSection("Memoryaffe:KnownProxies").GetChildren().Any()) app.UseForwardedHeaders();
app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["Referrer-Policy"] = "no-referrer";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    context.Response.Headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: http: data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
    if (context.Request.Path.StartsWithSegments("/api") || context.Request.Path.StartsWithSegments("/oauth") || context.Request.Path.StartsWithSegments("/mcp")) context.Response.Headers.CacheControl = "no-store";
    try { await next(); }
    catch (ProductException e) { await ApiTransport.Error(context, e); }
    catch (Exception e) when ((e is System.Text.Json.JsonException or FormatException or DecoderFallbackException) && context.Request.Path.StartsWithSegments("/api")) { await ApiTransport.Error(context, J.Fail(400, "validation_failed", "Ungültige Anfrage.")); }
    catch (Exception e) { app.Logger.LogError("Request {RequestId} failed ({ExceptionType}): {SafeStack} Inner type: {InnerType}.", context.TraceIdentifier, e.GetType().Name, e.StackTrace, e.InnerException?.GetType().Name); await ApiTransport.Error(context, J.Fail(500, "internal_error", "Die Anfrage konnte nicht abgeschlossen werden.")); }
});
app.MapGet("/health/live", () => Results.Json(new { status = "ok" }));
app.MapGet("/health/ready", async (Database db) => await db.Database.CanConnectAsync() ? Results.Json(new { status = "ready" }) : Results.StatusCode(503));
app.MapAgents();
var contracts = app.Services.GetRequiredService<Contracts>();
foreach (var (path, verbs) in contracts.Web["paths"]!.AsObject())
foreach (var (verb, specNode) in verbs!.AsObject())
{
    var spec = specNode!.AsObject(); var operationId = spec.Str("operationId");
    app.MapMethods(path, [verb.ToUpperInvariant()], async (HttpContext context, ProductRuntime runtime, IAntiforgery antiforgery) =>
    {
        var budget = context.RequestServices.GetRequiredService<RequestBudgets>(); var ip = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        if (operationId is "web_login" or "web_login_factor" or "web_reauthenticate") budget.Take("login:" + ip, 30 * rateMultiplier, TimeSpan.FromMinutes(5));
        else if (operationId is "web_setup" or "web_redeem_invitation" or "web_redeem_recovery" or "web_redeem_password_reset") budget.Take("link:" + ip, 10 * rateMultiplier, TimeSpan.FromMinutes(15));
        else if (operationId == "web_request_password_reset") budget.Take("reset:" + ip, 20 * rateMultiplier, TimeSpan.FromMinutes(15));
        var pathInput = new JsonObject(); foreach (var (key, value) in context.Request.RouteValues) pathInput[key] = value?.ToString();
        var query = new JsonObject(); foreach (var (key, value) in context.Request.Query) { J.Require(value.Count == 1, 400, "validation_failed", "Doppelte Queryparameter sind nicht erlaubt."); query[key] = value.ToString(); }
        foreach (var parameter in spec["parameters"]?.AsArray() ?? [])
        {
            var parameterSchema = parameter!.AsObject(); if (parameterSchema.Str("in") != "query") continue;
            var key = parameterSchema.Str("name"); var schema = parameterSchema["schema"]!;
            if (query.ContainsKey(key) && schema["type"]?.GetValue<string>() == "integer") { if (!int.TryParse(query.Str(key), out var number)) throw J.Fail(400, "validation_failed", "Ungültige Seitengröße."); query[key] = number; }
        }
        ApiTransport.ValidateParameters(contracts, spec, pathInput, query);
        var body = new JsonObject();
        if (spec["requestBody"]?["content"]?["application/json"]?["schema"] is { } schemaNode)
        {
            J.Require(context.Request.ContentType?.StartsWith("application/json", StringComparison.OrdinalIgnoreCase) == true, 400, "validation_failed", "JSON erwartet.");
            var limit = operationId.StartsWith("web_login", StringComparison.Ordinal) || operationId.StartsWith("web_setup", StringComparison.Ordinal) ? 16384 : operationId == "web_reauthenticate" ? 262144 : 8388608;
            var raw = await ApiTransport.Read(context.Request, limit, context.RequestAborted);
            var parsed = Contracts.Parse(raw); J.Require(parsed is JsonObject, 400, "validation_failed", "JSON-Objekt erwartet."); body = parsed.AsObject(); contracts.Validate(body, schemaNode);
        }
        var op = new Operation(operationId, body, pathInput, query, context.Request.Headers["Idempotency-Key"].FirstOrDefault(), context.Request.Headers["X-Action-Proof"].FirstOrDefault());
        return await runtime.Http(context, op, antiforgery);
    });
}
app.UseDefaultFiles(); app.UseStaticFiles();
app.MapFallback(async context => { if (context.Request.Path.StartsWithSegments("/api") || (context.Request.Path.StartsWithSegments("/oauth") && !context.Request.Path.StartsWithSegments("/oauth/consent")) || context.Request.Path.StartsWithSegments("/mcp")) { context.Response.StatusCode = 404; return; } var file = Path.Combine(app.Environment.WebRootPath ?? Path.Combine(app.Environment.ContentRootPath, "wwwroot"), "index.html"); if (File.Exists(file)) { context.Response.ContentType = "text/html"; await context.Response.SendFileAsync(file); } else { context.Response.StatusCode = 503; await context.Response.WriteAsync("Webapp fehlt: npm ci --prefix src/web und npm run build --prefix src/web; dist nach src/Memoryaffe.Api/wwwroot kopieren oder Vite verwenden."); } });
await app.RunAsync();

public partial class Program;
