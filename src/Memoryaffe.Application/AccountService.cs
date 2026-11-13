using System.Net.Mail;
using System.Text.Json.Nodes;
using Memoryaffe.Domain;

namespace Memoryaffe.Application;

public class AccountService(IDataStore db, ISecurity security, ProductOptions options) : Service(db, security, options)
{
    public Actor? Authenticate(string? bearer, string? cookie, bool mcp, Func<string, bool> allowedClient)
    {
        if (!string.IsNullOrEmpty(bearer))
        {
            var hash = J.Hash(bearer); var c = Db.Credentials.SingleOrDefault(x => x.Hash == hash);
            if (c == null || c.RevokedAt != null || c.ExpiresAt <= Clock.Now || (mcp ? c.Kind != "access" : c.Kind != "cli")) return null;
            var access = Db.Accesses.SingleOrDefault(x => x.Id == c.AccessId && x.RevokedAt == null); if (access == null) return null;
            if (access.Kind == "oauth" && (access.ClientId == null || !allowedClient(access.ClientId))) return null;
            if (c.FamilyId != null && !Db.Families.Any(x => x.Id == c.FamilyId && x.AccessId == access.Id && x.ClientId == access.ClientId && x.Resource == Options.BaseUrl + "/mcp" && !x.Revoked)) return null;
            var account = Db.Accounts.SingleOrDefault(x => x.Id == access.OwnerId && !x.Suspended); if (account == null) return null;
            c.LastUsedAt = Clock.Now; access.LastUsedAt = Clock.Now;
            return new Actor(account, access, c);
        }
        if (mcp || string.IsNullOrEmpty(cookie)) return null;
        var h = J.Hash(cookie); var s = Db.Sessions.SingleOrDefault(x => x.Hash == h && !x.Revoked);
        if (s == null || s.ExpiresAt <= Clock.Now || s.LastActiveAt.Add(s.Remembered ? TimeSpan.FromDays(7) : TimeSpan.FromHours(12)) <= Clock.Now) return null;
        var a = Db.Accounts.SingleOrDefault(x => x.Id == s.OwnerId && !x.Suspended); if (a == null) return null;
        s.LastActiveAt = Clock.Now; return new Actor(a, Session: s);
    }

    public async Task<BrowserResult> Anonymous(Operation op, string? factorCookie, string device, string ip, CancellationToken ct)
    {
        var b = op.Body;
        if (op.Id == "web_setup_status") return new(new { setupRequired = !Db.Accounts.Any() });
        if (op.Id == "web_setup")
        {
            J.Require(!Db.Accounts.Any(), 403, "permission_denied", "Die Einrichtung ist bereits abgeschlossen.");
            J.Require(Options.SetupSecret.Length >= 24 && System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(System.Text.Encoding.UTF8.GetBytes(J.Hash(b.Str("setupSecret"))), System.Text.Encoding.UTF8.GetBytes(J.Hash(Options.SetupSecret))), 403, "permission_denied", "Ungültiges Betreibersecret.");
            var a = CreateAccount(b.Str("email"), b.Str("password"), true); await Db.Save(ct); return SignIn(a, false, device);
        }
        if (op.Id == "web_login")
        {
            var email = b.Str("email").Trim(TextRules.WhiteSpace).ToUpperInvariant(); var key = J.Hash(email); var rate = Db.Flows.SingleOrDefault(x => x.Kind == "login-rate" && x.Hash == key && x.ExpiresAt > Clock.Now);
            if (rate?.Attempts >= 10) throw new ProductException(429, "rate_limited", "Zu viele Anmeldeversuche. Bitte später erneut versuchen.") { PersistState = true };
            var a = Db.Accounts.SingleOrDefault(x => x.EmailKey == email);
            var valid = Security.VerifyPassword(a, b.Str("password"));
            if (a == null || !valid || a.Suspended)
            {
                if (rate == null) { rate = new Flow { Kind = "login-rate", Hash = key, ExpiresAt = Clock.Now.AddMinutes(15) }; Db.Add(rate); }
                rate.Attempts++;
                if (rate.Attempts >= 3) await Task.Delay(TimeSpan.FromSeconds(Math.Min(8, Math.Pow(2, rate.Attempts - 3))), ct);
                throw new ProductException(401, "authentication_required", "Anmeldung fehlgeschlagen.") { PersistState = true };
            }
            if (rate != null) Db.Remove(rate);
            if (a.TotpSecret == null) { var result = SignIn(a, b.Bool("rememberMe"), device); return result with { Data = new { status = "authenticated", profile = Profile(a) } }; }
            var secret = J.Secret(); var flow = new Flow { Kind = "login-factor", Hash = J.Hash(secret), OwnerId = a.Id, Data = J.Obj(new { remembered = b.Bool("rememberMe"), device }).ToJsonString(), ExpiresAt = Clock.Now.AddMinutes(5) }; Db.Add(flow);
            return new(new { status = "secondFactorRequired", expiresAt = J.Time(flow.ExpiresAt) }, FlowToken: secret);
        }
        if (op.Id == "web_login_factor")
        {
            var hash = J.Hash(factorCookie ?? ""); var flow = Db.Flows.SingleOrDefault(x => x.Kind == "login-factor" && x.Hash == hash);
            J.Require(flow != null && !flow.Consumed && flow.ExpiresAt > Clock.Now && flow.Attempts < 5, 410, "flow_expired", "Bitte Anmeldung erneut beginnen.");
            var a = Db.Accounts.SingleOrDefault(x => x.Id == flow!.OwnerId && !x.Suspended) ?? throw J.Fail(401, "authentication_required", "Anmeldung fehlgeschlagen.");
            if (!Factor(a, b["factor"]?.AsObject())) { flow!.Attempts++; if (flow.Attempts >= 5) flow.Consumed = true; throw new ProductException(401, "authentication_required", "Ungültiger zweiter Faktor.") { PersistState = true }; }
            flow!.Consumed = true; var data = JsonNode.Parse(flow.Data)!.AsObject(); return SignIn(a, data.Bool("remembered"), data.Str("device"));
        }
        if (op.Id == "web_redeem_invitation")
        {
            var flow = TakeFlow(b.Str("token"), "invitation"); var info = JsonNode.Parse(flow.Data)!.AsObject(); var a = CreateAccount(info.Str("email"), b.Str("password"), info.Str("role") == "admin"); flow.OwnerId = a.Id; await Db.Save(ct); return SignIn(a, false, device);
        }
        if (op.Id == "web_request_password_reset")
        {
            var hash = J.Hash(b.Str("email").Trim(TextRules.WhiteSpace).ToUpperInvariant()); var rate = Db.Flows.SingleOrDefault(x => x.Kind == "reset-rate" && x.Hash == hash && x.ExpiresAt > Clock.Now);
            if (rate == null) { rate = new Flow { Kind = "reset-rate", Hash = hash, ExpiresAt = Clock.Now.AddMinutes(15) }; Db.Add(rate); }
            J.Require(rate.Attempts < 3, 429, "rate_limited", "Bitte vor einer weiteren Anfrage warten."); rate.Attempts++; return new(J.Ok);
        }
        if (op.Id is "web_redeem_password_reset" or "web_redeem_recovery")
        {
            var flow = TakeFlow(b.Str("token"), op.Id == "web_redeem_recovery" ? "recovery" : "reset"); var a = Db.Accounts.SingleOrDefault(x => x.Id == flow.OwnerId && !x.Suspended) ?? throw J.Fail(410, "flow_expired", "Link ungültig oder abgelaufen.");
            Password(b.Str("newPassword")); a.PasswordHash = Security.HashPassword(a, b.Str("newPassword")); a.Revision++;
            if (op.Id == "web_redeem_recovery") { a.TotpSecret = null; a.RecoveryHashes = []; a.LastTotpStep = -1; }
            Revoke(a.Id, true); return new(J.Ok, ClearSession: true);
        }
        throw J.Fail(404, "not_found", "Operation nicht gefunden.");
    }

    public Task<object> Run(Actor a, Operation op, CancellationToken ct)
    {
        User(a); var b = op.Body; var p = op.Path; var q = op.Query; var account = a.Account;
        object result;
        switch (op.Id)
        {
            case "web_get_profile": result = Profile(account); break;
            case "web_logout": a.Session!.Revoked = true; result = new BrowserResult(J.Ok, ClearSession: true); break;
            case "web_update_profile":
                if (b.ContainsKey("allowAgentTagCreation")) { J.Revision(b, account.Revision); if (account.AllowAgentTagCreation != b.Bool("allowAgentTagCreation")) { if (b.Bool("allowAgentTagCreation")) Proof(a, op); account.AllowAgentTagCreation = b.Bool("allowAgentTagCreation"); account.Revision++; } }
                account.Theme = b.Str("theme", account.Theme); account.Language = b.Str("language", account.Language); result = Profile(account); break;
            case "web_list_sessions": result = Page(Db.Sessions.Where(x => x.OwnerId == account.Id && !x.Revoked && x.ExpiresAt > Clock.Now).ToList().Where(x => x.LastActiveAt.Add(x.Remembered ? TimeSpan.FromDays(7) : TimeSpan.FromHours(12)) > Clock.Now).OrderByDescending(x => x.LastActiveAt).Select(s => (object)new { s.Id, browser = s.Device, device = s.Device, createdAt = J.Time(s.CreatedAt), lastActiveAt = J.Time(s.LastActiveAt), expiresAt = J.Time(s.ExpiresAt), current = s.Id == a.Session!.Id }), a, op); break;
            case "web_revoke_session": var session = Db.Sessions.SingleOrDefault(x => x.Id == p.Id("id") && x.OwnerId == account.Id) ?? throw J.Fail(404, "not_found", "Sitzung nicht gefunden."); session.Revoked = true; result = J.Ok; break;
            case "web_revoke_other_sessions": foreach (var s in Db.Sessions.Where(x => x.OwnerId == account.Id && x.Id != a.Session!.Id)) s.Revoked = true; result = J.Ok; break;
            case "web_change_password":
                J.Require(Security.VerifyPassword(account, b.Str("currentPassword")), 401, "authentication_required", "Passwort ungültig."); Password(b.Str("newPassword")); account.PasswordHash = Security.HashPassword(account, b.Str("newPassword")); account.Revision++; foreach (var s in Db.Sessions.Where(x => x.OwnerId == account.Id && x.Id != a.Session!.Id)) s.Revoked = true; result = J.Ok; break;
            case "web_request_email_change": throw J.Fail(503, "smtp_unavailable", "Ohne SMTP ändert ein Administrator die E-Mail-Adresse nach persönlicher Abstimmung.");
            case "web_reauthenticate":
                J.Require(Security.VerifyPassword(account, b.Str("password")) && (account.TotpSecret == null || Factor(account, b["factor"]?.AsObject())), 401, "authentication_required", "Bestätigung fehlgeschlagen.");
                var token = J.Secret(); var proof = new Flow { Kind = "proof", OwnerId = account.Id, SessionId = a.Session!.Id, Hash = J.Hash(token), Data = J.Hash(J.Canonical(b["request"])), ExpiresAt = Clock.Now.AddMinutes(5) }; Db.Add(proof); result = new { proof = token, expiresAt = J.Time(proof.ExpiresAt) }; break;
            case "web_setup_totp":
                Proof(a, op); foreach (var prior in Db.Flows.Where(x => x.Kind == "totp-setup" && x.OwnerId == account.Id && !x.Consumed)) prior.Consumed = true; var secret = Security.NewTotpSecret(); var setup = new Flow { Kind = "totp-setup", OwnerId = account.Id, SessionId = a.Session!.Id, Data = Security.Protect(secret, "totp"), ExpiresAt = Clock.Now.AddMinutes(10) }; Db.Add(setup); result = new { setupId = setup.Id, secret, otpauthUri = $"otpauth://totp/memoryaffe:{Uri.EscapeDataString(account.Email)}?secret={secret}&issuer=memoryaffe&algorithm=SHA1&digits=6&period=30", expiresAt = J.Time(setup.ExpiresAt) }; break;
            case "web_confirm_totp":
                var pending = Db.Flows.SingleOrDefault(x => x.Id == b.Id("setupId") && x.Kind == "totp-setup" && x.OwnerId == account.Id && x.SessionId == a.Session!.Id);
                J.Require(pending != null && !pending.Consumed && pending.ExpiresAt > Clock.Now, 410, "flow_expired", "Einrichtung ist abgelaufen.");
                var step = Security.VerifyTotp(Security.Unprotect(pending!.Data, "totp"), b.Str("code"), -1); J.Require(step.HasValue, 400, "validation_failed", "Ungültiger Testcode.");
                pending.Consumed = true; account.TotpSecret = pending.Data; account.LastTotpStep = step!.Value; account.Revision++; result = Codes(account); break;
            case "web_disable_totp": Proof(a, op); account.TotpSecret = null; account.LastTotpStep = -1; account.RecoveryHashes = []; account.Revision++; result = J.Ok; break;
            case "web_replace_recovery_codes": Proof(a, op); J.Require(account.TotpSecret != null, 400, "validation_failed", "2FA ist nicht aktiviert."); result = Codes(account); break;
            default: throw J.Fail(404, "not_found", "Operation nicht gefunden.");
        }
        return Task.FromResult(result);
    }
    public object Profile(Account a) => new { a.Id, a.Email, role = a.IsAdmin ? "admin" : "user", revision = J.Rev(a.Revision), a.Theme, a.Language, a.AllowAgentTagCreation, totpEnabled = a.TotpSecret != null, emailVerified = false, smtpEnabled = false };
    public static object AccountView(Account a) => new { a.Id, a.Email, role = a.IsAdmin ? "admin" : "user", status = a.Suspended ? "suspended" : "active", revision = J.Rev(a.Revision), totpEnabled = a.TotpSecret != null, createdAt = J.Time(a.CreatedAt) };
    public Account CreateAccount(string email, string password, bool admin)
    {
        email = email.Trim(TextRules.WhiteSpace); Email(email); Password(password); var key = email.ToUpperInvariant(); J.Require(!Db.Accounts.Any(x => x.EmailKey == key), 409, "name_conflict", "Konto kann nicht angelegt werden.");
        var a = new Account { Email = email, EmailKey = key, IsAdmin = admin }; a.PasswordHash = Security.HashPassword(a, password); Db.Add(a); return a;
    }
    public BrowserResult SignIn(Account a, bool remembered, string device)
    {
        var lifetime = TimeSpan.FromDays(remembered ? 30 : 7);
        var token = J.Secret(); var s = new WebSession { OwnerId = a.Id, Hash = J.Hash(token), Remembered = remembered, Device = string.Concat(device.EnumerateRunes().Take(150).Select(x => x.ToString())), ExpiresAt = Clock.Now.Add(lifetime) }; Db.Add(s); return new(Profile(a), SessionToken: token, SessionLifetime: lifetime);
    }
    public void Revoke(Guid id, bool credentials, Guid? except = null)
    {
        foreach (var s in Db.Sessions.Where(x => x.OwnerId == id && x.Id != except)) s.Revoked = true;
        foreach (var f in Db.Flows.Where(x => x.OwnerId == id && !x.Consumed)) f.Consumed = true;
        if (credentials) { var access = Db.Accesses.Where(x => x.OwnerId == id).Select(x => x.Id).ToList(); foreach (var c in Db.Credentials.Where(x => access.Contains(x.AccessId))) c.RevokedAt = Clock.Now; foreach (var f in Db.Families.Where(x => access.Contains(x.AccessId))) f.Revoked = true; }
    }
    public Flow TakeFlow(string token, string kind)
    {
        var hash = J.Hash(token); var f = Db.Flows.SingleOrDefault(x => x.Kind == kind && x.Hash == hash);
        J.Require(f != null && !f.Consumed && f.ExpiresAt > Clock.Now, 410, "flow_expired", "Link ungültig oder abgelaufen."); f!.Consumed = true; return f;
    }
    public bool Factor(Account a, JsonObject? factor)
    {
        if (a.TotpSecret == null || factor == null) return false;
        if (factor.Str("kind") == "recoveryCode") { var hash = J.Hash(factor.Str("code")); if (!a.RecoveryHashes.Contains(hash)) return false; a.RecoveryHashes = a.RecoveryHashes.Where(x => x != hash).ToArray(); return true; }
        var step = Security.VerifyTotp(Security.Unprotect(a.TotpSecret, "totp"), factor.Str("code"), a.LastTotpStep); if (!step.HasValue) return false; a.LastTotpStep = step.Value; return true;
    }
    private static object Codes(Account a) { var codes = Enumerable.Range(0, 10).Select(_ => J.Secret()[..32]).ToArray(); a.RecoveryHashes = codes.Select(J.Hash).ToArray(); return new { codes }; }
    public static void Password(string value) => J.Require(value.EnumerateRunes().Count() is >= 15 and <= 128, 400, "validation_failed", "Passwort benötigt 15 bis 128 Zeichen.");
    public static void Email(string value) => J.Require(value.Length <= 254 && MailAddress.TryCreate(value, out var address) && address.Address == value, 400, "validation_failed", "Ungültige E-Mail-Adresse.");
}
