using System.Security.Claims;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Memoryaffe.Application;
using Memoryaffe.Domain;
using Memoryaffe.Infrastructure;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;
using Npgsql;

public class ProductRuntime(Database db, AccountService accounts, MemoryService memories, ManagementService management, ProductOptions options, OAuthService oauth, CimdClient clients, ArchiveService archives, IServiceScopeFactory scopes, RequestBudgets budgets)
{
    private static readonly DateTime StartedAt = DateTime.UtcNow;
    private static readonly HashSet<string> Anonymous = ["web_setup_status", "web_setup", "web_login", "web_login_factor", "web_redeem_invitation", "web_request_password_reset", "web_redeem_password_reset", "web_redeem_recovery", "web_confirm_email"];
    private static readonly HashSet<string> Shared = ["web_list_vaults", "web_list_tags", "web_create_tag", "web_search_memories", "web_get_memory", "web_create_memory", "web_update_memory", "web_delete_memory"];
    public string Cookie => options.Development ? "memoryaffe.session" : "__Host-memoryaffe.session";
    public string FlowCookie => options.Development ? "memoryaffe.factor" : "__Host-memoryaffe.factor";
    public async Task<IResult> Http(HttpContext context, Operation op, IAntiforgery csrf)
    {
        if (op.Id == "web_export_vault") return new ExportResponse(async stream => await Transaction(async () => { J.Require(Bearer(context) == null || !context.Request.Cookies.ContainsKey(Cookie), 400, "validation_failed", "Cookie und Bearer dürfen nicht kombiniert werden."); J.Require(Bearer(context) == null, 403, "permission_denied", "Export ist dem Nutzer vorbehalten."); var actor = accounts.Authenticate(null, context.Request.Cookies[Cookie], false, clients.Allowed) ?? throw J.Fail(401, "authentication_required", "Bitte anmelden."); await archives.Export(actor, op.Path.Id("id"), stream, context.RequestAborted); return true; }, context.RequestAborted));
        var result = await Transaction(async () =>
        {
            var bearer = Bearer(context); J.Require(bearer == null || !context.Request.Cookies.ContainsKey(Cookie), 400, "validation_failed", "Cookie und Bearer dürfen nicht kombiniert werden."); var actor = accounts.Authenticate(bearer, context.Request.Cookies[Cookie], false, clients.Allowed);
            if (actor != null) context.User = Principal(actor);
            if (op.Id == "web_get_csrf") { var tokens = csrf.GetAndStoreTokens(context); return (object)new { requestToken = tokens.RequestToken!, headerName = "X-CSRF-Token" }; }
            if (context.Request.Method is not ("GET" or "HEAD") && bearer == null) { try { await csrf.ValidateRequestAsync(context); } catch (AntiforgeryValidationException) { throw J.Fail(403, "csrf_failed", "Die Sicherheitsbestätigung ist ungültig. Bitte erneut versuchen."); } }
            if (Anonymous.Contains(op.Id)) return await accounts.Anonymous(op, context.Request.Cookies[FlowCookie], context.Request.Headers.UserAgent.ToString(), context.Connection.RemoteIpAddress?.ToString() ?? "unknown", context.RequestAborted);
            J.Require(actor != null, 401, "authentication_required", "Bitte anmelden.");
            if (!Shared.Contains(op.Id)) budgets.Product(actor!.Id, context.Request.Method != "GET", options.TestRateMultiplier);
            if (actor!.IsAgent) J.Require(Shared.Contains(op.Id), 403, "permission_denied", "Diese Aktion ist dem Nutzer vorbehalten.");
            if (op.Id == "web_prepare_import") { var form = await context.Request.ReadFormAsync(context.RequestAborted); J.Require(form.Count == 0 && form.Files.Count == 1 && form.Files[0].Name == "archive", 400, "validation_failed", "Genau ein ZIP im Feld archive erwartet."); await using var stream = form.Files[0].OpenReadStream(); return await archives.Prepare(actor, stream, context.RequestAborted); }
            if (op.Id is "web_get_import" or "web_cancel_import" or "web_commit_import") return await archives.Run(actor, op, context.RequestAborted);
            if (op.Id is "web_get_oauth_consent" or "web_decide_oauth_consent") return await oauth.Consent(actor, op, context.Request.Cookies["memoryaffe.oauth"] ?? "", context.RequestAborted);
            if (op.Id == "admin_diagnostics") { J.Require(!actor.IsAgent && actor.Account.IsAdmin, 403, "permission_denied", "Administratorrechte erforderlich."); var bytes = await db.Database.SqlQueryRaw<long>("SELECT pg_database_size(current_database()) AS \"Value\"").SingleAsync(context.RequestAborted); return new { version = "0.1.0", databaseReady = true, databaseBytes = bytes, temporaryBytes = archives.TemporaryBytes, uptimeSeconds = (long)(DateTime.UtcNow - StartedAt).TotalSeconds }; }
            return await Run(actor, op, context.RequestAborted);
        }, context.RequestAborted, op.IdempotencyKey != null);
        if (op.Id is "web_prepare_import" or "web_cancel_import" or "web_commit_import")
        {
            await using var cleanupScope = scopes.CreateAsyncScope();
            await cleanupScope.ServiceProvider.GetRequiredService<ProductRuntime>().Transaction(async () => { await cleanupScope.ServiceProvider.GetRequiredService<ArchiveService>().Cleanup(context.RequestAborted); return true; }, context.RequestAborted);
        }
        if (result is BrowserResult browser)
        {
            var cookieOptions = new CookieOptions { HttpOnly = true, Secure = !options.Development, SameSite = SameSiteMode.Strict, Path = "/", IsEssential = true };
            if (browser.SessionToken != null) { cookieOptions.SameSite = SameSiteMode.Lax; cookieOptions.MaxAge = browser.SessionLifetime ?? throw new InvalidOperationException("Sitzungsdauer fehlt."); context.Response.Cookies.Append(Cookie, browser.SessionToken, cookieOptions); context.Response.Cookies.Delete(FlowCookie); }
            if (browser.FlowToken != null) { cookieOptions.MaxAge = TimeSpan.FromMinutes(5); context.Response.Cookies.Append(FlowCookie, browser.FlowToken, cookieOptions); }
            if (browser.ClearSession) context.Response.Cookies.Delete(Cookie);
            result = browser.Data;
        }
        var created = op.Id is "web_setup" or "web_redeem_invitation" or "web_create_vault" or "web_create_memory" or "web_create_tag" or "web_create_agent_access" or "web_issue_token" or "admin_invite" or "web_prepare_import" or "web_commit_import";
        return Results.Json(result, J.Options, statusCode: created ? 201 : 200);
    }
    public async Task<object> Run(Actor actor, Operation op, CancellationToken ct)
    {
        if (Shared.Contains(op.Id)) budgets.Product(actor.Id, op.Id is "web_create_memory" or "web_update_memory" or "web_delete_memory" or "web_create_tag", options.TestRateMultiplier);
        var level = op.Id == "web_delete_memory" ? 3 : op.Id is "web_create_memory" or "web_update_memory" or "web_create_tag" ? 2 : 1;
        if (actor.IsAgent) J.Require(actor.Credential!.Scopes.Contains(level == 3 ? "memory:delete" : level == 2 ? "memory:write" : "memory:read"), 403, "permission_denied", "Erforderlicher Scope fehlt.");
        var repeatable = op.Id is "web_create_memory" or "web_update_memory" or "web_delete_memory" or "web_create_tag";
        RepeatResult? repeat = null; string? fingerprint = null;
        if (op.IdempotencyKey != null && repeatable)
        {
            J.Require(Regex.IsMatch(op.IdempotencyKey, "^[A-Za-z0-9_.:-]{1,128}$"), 400, "validation_failed", "Ungültiger Wiederholungsschlüssel.");
            var body = (JsonObject)op.Body.DeepClone(); if (body.ContainsKey("tagIds")) body["tagIds"] = J.Node(body.Ids("tagIds").Order());
            fingerprint = J.Hash(op.Id + J.Canonical(op.Path) + J.Canonical(op.Query) + J.Canonical(body));
            repeat = db.Repeats.SingleOrDefault(x => x.ActorId == actor.Id && x.Key == op.IdempotencyKey);
            if (repeat != null && repeat.ExpiresAt <= Clock.Now) { db.Remove(repeat); await db.Save(ct); repeat = null; }
            if (repeat != null)
            {
                J.Require(repeat.Fingerprint == fingerprint, 409, "idempotency_conflict", "Schlüssel wurde für einen anderen Auftrag verwendet.");
                var replayOp = new Operation("web_list_tags", new(), new JsonObject { ["vaultId"] = repeat.VaultId.ToString() }, new()); await memories.Run(actor, replayOp, ct);
                if (actor.IsAgent) { var grant = db.Grants.SingleOrDefault(x => x.AccessId == actor.Id && x.VaultId == repeat.VaultId); J.Require(grant?.Level >= repeat.Level, 403, "permission_denied", "Aktuelle Rechte reichen nicht aus."); }
                if (repeat.MemoryId is { } memoryId) { var m = db.Memories.SingleOrDefault(x => x.Id == memoryId && x.OwnerId == actor.Account.Id); if (m != null && m.VaultId != repeat.VaultId) await memories.Run(actor, new Operation("web_get_memory", new(), new JsonObject { ["id"] = memoryId.ToString() }, new()), ct); }
                return JsonNode.Parse(repeat.Result)!;
            }
        }
        Guid? originalVault = op.Id == "web_create_memory" ? op.Body.Id("vaultId") : op.Id == "web_create_tag" ? op.Path.Id("vaultId") : op.Id is "web_update_memory" or "web_delete_memory" ? db.Memories.Where(x => x.Id == op.Path.Id("id") && x.OwnerId == actor.Account.Id).Select(x => (Guid?)x.VaultId).SingleOrDefault() : null;
        object result;
        if (op.Id.StartsWith("web_", StringComparison.Ordinal) && (op.Id.Contains("memory", StringComparison.Ordinal) || op.Id.Contains("memories", StringComparison.Ordinal) || op.Id.Contains("vault", StringComparison.Ordinal) || op.Id.Contains("tag", StringComparison.Ordinal) || op.Id.Contains("version", StringComparison.Ordinal) || op.Id.Contains("restore", StringComparison.Ordinal))) result = await memories.Run(actor, op, ct);
        else if (op.Id.StartsWith("admin_", StringComparison.Ordinal) || op.Id.Contains("agent_access", StringComparison.Ordinal) || op.Id.Contains("token", StringComparison.Ordinal) || op.Id == "web_delete_account") result = await management.Run(actor, op, ct);
        else result = await accounts.Run(actor, op, ct);
        if (op.IdempotencyKey != null && repeatable && originalVault.HasValue) { var json = J.Node(result); db.Add(new RepeatResult { ActorId = actor.Id, Key = op.IdempotencyKey, Fingerprint = fingerprint!, VaultId = originalVault.Value, MemoryId = op.Id == "web_create_tag" ? null : Guid.Parse(json["id"]!.GetValue<string>()), Level = level, Result = json.ToJsonString(), ExpiresAt = Clock.Now.AddHours(24) }); }
        return result;
    }
    public async Task<T> Transaction<T>(Func<Task<T>> action, CancellationToken ct, bool idempotent = false)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        try
        {
            await db.Database.ExecuteSqlRawAsync("SET LOCAL lock_timeout = '5s'", ct);
            await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(734102802)", ct);
            var value = await action(); await db.Save(ct); await tx.CommitAsync(ct); return value;
        }
        catch (ProductException e) when (e.PersistState) { await db.Save(ct); await tx.CommitAsync(ct); throw; }
        catch (OAuthException e) when (e.PersistState) { await db.Save(ct); await tx.CommitAsync(ct); throw; }
        catch (PostgresException e) when (e.SqlState == "55P03") { throw J.Fail(idempotent ? 409 : 503, idempotent ? "request_in_progress" : "temporarily_unavailable", "Die Anwendung ist beschäftigt. Bitte erneut versuchen."); }
    }
    public static string? Bearer(HttpContext c) { var auth = c.Request.Headers.Authorization.ToString(); if (auth.Length == 0) return null; J.Require(auth.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) && auth.Length > 7, 401, "authentication_required", "Ungültige Anmeldung."); return auth[7..]; }
    public static ClaimsPrincipal Principal(Actor a) => new(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, a.Account.Id.ToString()), new Claim(ClaimTypes.Name, a.Name)], a.IsAgent ? "Bearer" : "Session"));
}
