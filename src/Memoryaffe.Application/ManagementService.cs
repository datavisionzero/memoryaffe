using System.Text.Json.Nodes;
using Memoryaffe.Domain;

namespace Memoryaffe.Application;

public class ManagementService(IDataStore db, ISecurity security, ProductOptions options, AccountService accounts) : Service(db, security, options)
{
    public async Task<object> Run(Actor a, Operation op, CancellationToken ct)
    {
        User(a); var b = op.Body; var p = op.Path; var q = op.Query;
        if (op.Id == "web_list_agent_accesses") return Page(Db.Accesses.Where(x => x.OwnerId == a.Account.Id && x.RevokedAt == null).ToList().OrderByDescending(x => x.CreatedAt).Select(AccessView), a, op);
        if (op.Id == "web_create_agent_access")
        {
            Proof(a, op); var access = new AgentAccess { OwnerId = a.Account.Id, Name = Security.Name(b.Str("name"), 100) }; Db.Add(access); ApplyGrants(a, access, b); await Db.Save(ct); return AccessView(access);
        }
        if (op.Id is "web_get_agent_access" or "web_update_agent_access" or "web_delete_agent_access" or "web_list_tokens" or "web_issue_token" or "web_revoke_token")
        {
            var access = Db.Accesses.SingleOrDefault(x => x.Id == p.Id("id") && x.OwnerId == a.Account.Id && x.RevokedAt == null) ?? throw J.Fail(404, "not_found", "Agentenzugang nicht gefunden.");
            if (op.Id == "web_get_agent_access") return AccessView(access);
            if (op.Id == "web_list_tokens") return Page(Db.Credentials.Where(x => x.AccessId == access.Id && x.Kind == "cli").ToList().OrderByDescending(x => x.CreatedAt).Select(CredentialView), a, op);
            J.Revision(op.Id is "web_delete_agent_access" or "web_revoke_token" ? q : b, access.Revision);
            if (op.Id == "web_delete_agent_access") { access.RevokedAt = Clock.Now; access.Revision++; foreach (var c in Db.Credentials.Where(x => x.AccessId == access.Id)) c.RevokedAt = Clock.Now; return J.Ok; }
            if (op.Id == "web_revoke_token") { var c = Db.Credentials.SingleOrDefault(x => x.Id == p.Id("tokenId") && x.AccessId == access.Id && x.Kind == "cli") ?? throw J.Fail(404, "not_found", "Token nicht gefunden."); if (c.RevokedAt == null) { c.RevokedAt = Clock.Now; access.Revision++; } return J.Ok; }
            if (op.Id == "web_issue_token")
            {
                J.Require(access.Kind == "cli", 403, "permission_denied", "OAuth-Zugänge verwenden keine CLI-Tokens."); Proof(a, op);
                var days = b.ContainsKey("lifetimeDays") ? b["lifetimeDays"]?.GetValue<int>() : 90;
                if (b.ContainsKey("replacesTokenId")) { var old = Db.Credentials.SingleOrDefault(x => x.Id == b.Id("replacesTokenId") && x.AccessId == access.Id && x.Kind == "cli" && x.RevokedAt == null) ?? throw J.Fail(404, "not_found", "Zu ersetzendes Token nicht gefunden."); var expiry = Clock.Now.AddSeconds(b.Int("overlapSeconds")); if (old.ExpiresAt == null || old.ExpiresAt > expiry) old.ExpiresAt = expiry; }
                else J.Require(!b.ContainsKey("overlapSeconds"), 400, "validation_failed", "Überlappung benötigt ein zu ersetzendes Token.");
                var token = J.Secret(); var credential = new Credential { AccessId = access.Id, Hash = J.Hash(token), ExpiresAt = days.HasValue ? Clock.Now.AddDays(days.Value) : null }; Db.Add(credential); access.Revision++;
                return new { credential = CredentialView(credential), token, agentRevision = J.Rev(access.Revision) };
            }
            var changed = false; if (b.ContainsKey("name")) { var name = Security.Name(b.Str("name"), 100); changed = access.Name != name; access.Name = name; }
            if (b.ContainsKey("grants"))
            {
                var old = Db.Grants.Where(x => x.AccessId == access.Id).ToList(); var grants = ParseGrants(a, b);
                if (grants.Any(g => !old.Any(x => x.VaultId == g.VaultId && x.Level >= g.Level))) Proof(a, op);
                if (!old.Select(x => (x.VaultId, x.Level)).Order().SequenceEqual(grants.Order())) { foreach (var g in old) Db.Remove(g); await Db.Save(ct); foreach (var g in grants) Db.Add(new VaultGrant { OwnerId = a.Account.Id, AccessId = access.Id, VaultId = g.VaultId, Level = g.Level }); changed = true; }
            }
            if (changed) access.Revision++; await Db.Save(ct); return AccessView(access);
        }
        if (op.Id == "web_delete_account") { J.Revision(q, a.Account.Revision); Proof(a, op); DeleteAccount(a.Account); return new BrowserResult(J.Ok, ClearSession: true); }
        Admin(a);
        if (op.Id == "admin_list_accounts") return Page(Db.Accounts.ToList().OrderBy(x => x.EmailKey).Select(AccountService.AccountView), a, op);
        if (op.Id is "admin_update_account" or "admin_delete_account" or "admin_issue_password_reset" or "admin_issue_recovery")
        {
            var target = Db.Accounts.SingleOrDefault(x => x.Id == p.Id("id")) ?? throw J.Fail(404, "not_found", "Konto nicht gefunden."); J.Revision(op.Id == "admin_delete_account" ? q : b, target.Revision);
            if (op.Id == "admin_delete_account") { Proof(a, op); DeleteAccount(target); return J.Ok; }
            if (op.Id is "admin_issue_password_reset" or "admin_issue_recovery") { if (op.Id == "admin_issue_recovery") Proof(a, op); J.Require(!b.Bool("sendEmail"), 503, "smtp_unavailable", "SMTP ist nicht konfiguriert. Bitte Link manuell übergeben."); return IssueLink(target.Id, op.Id == "admin_issue_recovery" ? "recovery" : "reset", TimeSpan.FromHours(1)); }
            if ((b.ContainsKey("role") && (b.Str("role") == "admin") != target.IsAdmin) || (b.ContainsKey("email") && b.Str("email") != target.Email)) Proof(a, op);
            var admin = b.Str("role", target.IsAdmin ? "admin" : "user") == "admin"; var suspended = b.Str("status", target.Suspended ? "suspended" : "active") == "suspended";
            LastAdmin(target, admin && !suspended); var email = b.Str("email", target.Email).Trim(TextRules.WhiteSpace); AccountService.Email(email); var key = email.ToUpperInvariant(); J.Require(!Db.Accounts.Any(x => x.Id != target.Id && x.EmailKey == key), 409, "name_conflict", "E-Mail-Adresse ist bereits vergeben.");
            if (target.Email != email || target.IsAdmin != admin || target.Suspended != suspended) { target.Email = email; target.EmailKey = key; target.IsAdmin = admin; target.Suspended = suspended; target.Revision++; if (suspended) accounts.Revoke(target.Id, true); }
            return AccountService.AccountView(target);
        }
        if (op.Id == "admin_list_invitations") return Page(Db.Flows.Where(x => x.Kind == "invitation").ToList().OrderByDescending(x => x.CreatedAt).Select(InvitationView), a, op);
        if (op.Id == "admin_invite")
        {
            if (b.Str("role") == "admin") Proof(a, op); J.Require(!b.Bool("sendEmail"), 503, "smtp_unavailable", "SMTP ist nicht konfiguriert. Bitte Link manuell übergeben."); AccountService.Email(b.Str("email"));
            var key = b.Str("email").ToUpperInvariant(); J.Require(!Db.Accounts.Any(x => x.EmailKey == key), 409, "name_conflict", "Konto bereits vorhanden.");
            foreach (var old in Db.Flows.Where(x => x.Kind == "invitation" && !x.Consumed).ToList().Where(x => JsonNode.Parse(x.Data)!["email"]!.GetValue<string>().ToUpperInvariant() == key)) old.Consumed = true;
            var token = J.Secret(); var flow = new Flow { Kind = "invitation", Hash = J.Hash(token), Data = J.Obj(new { email = b.Str("email"), role = b.Str("role") }).ToJsonString(), ExpiresAt = Clock.Now.AddDays(7) }; Db.Add(flow);
            return new { invitation = InvitationView(flow), link = new { url = Options.BaseUrl + "/invite#token=" + token, expiresAt = J.Time(flow.ExpiresAt), delivery = "manual" } };
        }
        if (op.Id == "admin_revoke_invitation") { var f = Db.Flows.SingleOrDefault(x => x.Id == p.Id("id") && x.Kind == "invitation") ?? throw J.Fail(404, "not_found", "Einladung nicht gefunden."); f.Consumed = true; f.Data = J.Obj(new { email = JsonNode.Parse(f.Data)!["email"]!.GetValue<string>(), role = JsonNode.Parse(f.Data)!["role"]!.GetValue<string>(), revoked = true }).ToJsonString(); return J.Ok; }
        throw J.Fail(404, "not_found", "Operation nicht gefunden.");
    }
    public object AccessView(AgentAccess access) => new { access.Id, access.Name, revision = J.Rev(access.Revision), access.Kind, grants = Db.Grants.Where(x => x.AccessId == access.Id).ToList().OrderBy(x => x.VaultId).Select(x => new { x.VaultId, level = J.Level(x.Level) }), createdAt = J.Time(access.CreatedAt), lastUsedAt = J.Time(access.LastUsedAt), access.ClientId };
    public static object CredentialView(Credential c) => new { c.Id, createdAt = J.Time(c.CreatedAt), expiresAt = J.Time(c.ExpiresAt), lastUsedAt = J.Time(c.LastUsedAt), revokedAt = J.Time(c.RevokedAt) };
    private object InvitationView(Flow f) { var d = JsonNode.Parse(f.Data)!.AsObject(); return new { f.Id, email = d.Str("email"), role = d.Str("role"), createdAt = J.Time(f.CreatedAt), expiresAt = J.Time(f.ExpiresAt), status = d.Bool("revoked") ? "revoked" : f.Consumed ? f.OwnerId != null ? "redeemed" : "revoked" : f.ExpiresAt <= Clock.Now ? "expired" : "pending" }; }
    public object IssueLink(Guid owner, string kind, TimeSpan duration)
    {
        foreach (var old in Db.Flows.Where(x => x.Kind == kind && x.OwnerId == owner && !x.Consumed)) old.Consumed = true;
        var token = J.Secret(); var f = new Flow { OwnerId = owner, Kind = kind, Hash = J.Hash(token), ExpiresAt = Clock.Now.Add(duration) }; Db.Add(f);
        return new { url = Options.BaseUrl + (kind == "recovery" ? "/recover-account" : "/reset-password") + "#token=" + token, expiresAt = J.Time(f.ExpiresAt), delivery = "manual" };
    }
    public void ApplyGrants(Actor a, AgentAccess access, JsonObject b) { foreach (var grant in ParseGrants(a, b)) Db.Add(new VaultGrant { OwnerId = a.Account.Id, AccessId = access.Id, VaultId = grant.VaultId, Level = grant.Level }); }
    private List<(Guid VaultId, int Level)> ParseGrants(Actor a, JsonObject b)
    {
        var grants = (b["grants"]?.AsArray() ?? []).Select(x => (VaultId: x!.AsObject().Id("vaultId"), Level: J.Level(x.AsObject().Str("level")))).ToList();
        J.Require(grants.Select(x => x.VaultId).Distinct().Count() == grants.Count, 400, "validation_failed", "Vaults müssen eindeutig sein."); foreach (var g in grants) GetVault(a, g.VaultId); return grants;
    }
    private void LastAdmin(Account target, bool remainsActive) => J.Require(!target.IsAdmin || target.Suspended || remainsActive || Db.Accounts.Any(x => x.Id != target.Id && x.IsAdmin && !x.Suspended), 409, "last_admin_required", "Mindestens ein aktiver Administrator muss erhalten bleiben.");
    private void DeleteAccount(Account target) { LastAdmin(target, false); foreach (var f in Db.Flows.Where(x => x.OwnerId == target.Id)) Db.Remove(f); var actorIds = Db.Accesses.Where(x => x.OwnerId == target.Id).Select(x => x.Id).ToList(); actorIds.Add(target.Id); foreach (var r in Db.Repeats.Where(x => actorIds.Contains(x.ActorId))) Db.Remove(r); Db.Remove(target); }
}
