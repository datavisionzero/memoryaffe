using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Memoryaffe.Domain;

namespace Memoryaffe.Application;

public static class J
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);
    public static JsonObject Obj(object value) => JsonSerializer.SerializeToNode(value, Options)!.AsObject();
    public static JsonNode Node(object value) => JsonSerializer.SerializeToNode(value, Options)!;
    public static string Str(this JsonObject j, string key, string fallback = "") => j[key]?.GetValue<string>() ?? fallback;
    public static bool Bool(this JsonObject j, string key, bool fallback = false) => j[key]?.GetValue<bool>() ?? fallback;
    public static int Int(this JsonObject j, string key, int fallback = 0) => j[key]?.GetValue<int>() ?? fallback;
    public static Guid Id(this JsonObject j, string key) => Guid.TryParse(j.Str(key), out var id) ? id : throw Fail(400, "validation_failed", $"Ungültige ID: {key}.");
    public static Guid[] Ids(this JsonObject j, string key) => (j[key]?.AsArray() ?? []).Select(x => Guid.Parse(x!.GetValue<string>())).ToArray();
    public static string Rev(long value) => value.ToString(System.Globalization.CultureInfo.InvariantCulture);
    public static string Time(DateTime value) => value.ToUniversalTime().ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'");
    public static string? Time(DateTime? value) => value == null ? null : Time(value.Value);
    public static ProductException Fail(int status, string code, string message) => new(status, code, message);
    public static void Require(bool condition, int status, string code, string message) { if (!condition) throw Fail(status, code, message); }
    public static void Revision(JsonObject input, long revision, string field = "expectedRevision") => Require(input.Str(field) == Rev(revision), 409, "revision_conflict", "Der Stand wurde zwischenzeitlich geändert. Bitte neu laden.");
    public static string Secret() => Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
    public static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value))).ToLowerInvariant();
    public static string Canonical(JsonNode? value) => value switch { JsonObject o => "{" + string.Join(",", o.OrderBy(x => x.Key, StringComparer.Ordinal).Select(x => JsonSerializer.Serialize(x.Key) + ":" + CanonicalField(x.Key, x.Value))) + "}", JsonArray a => "[" + string.Join(",", a.Select(Canonical).Order(StringComparer.Ordinal)) + "]", null => "null", _ => value.ToJsonString() };
    private static string CanonicalField(string key, JsonNode? value)
    {
        if ((key == "id" || key.EndsWith("Id", StringComparison.Ordinal)) && value is JsonValue v && v.GetValueKind() == JsonValueKind.String && Guid.TryParse(v.GetValue<string>(), out var id)) return JsonSerializer.Serialize(id.ToString());
        if (key == "tagIds" && value is JsonArray tags) return "[" + string.Join(",", tags.Select(x => Guid.Parse(x!.GetValue<string>()).ToString()).Order(StringComparer.Ordinal).Select(x => JsonSerializer.Serialize(x))) + "]";
        return Canonical(value);
    }
    public static object Ok => new { ok = true };
    public static int Level(string value) => value switch { "read" => 1, "write" => 2, "delete" => 3, _ => throw Fail(400, "validation_failed", "Ungültige Berechtigungsstufe.") };
    public static string Level(int value) => value switch { 1 => "read", 2 => "write", _ => "delete" };
}

public abstract class Service(IDataStore store, ISecurity security, ProductOptions options)
{
    protected IDataStore Db { get; } = store;
    protected ISecurity Security { get; } = security;
    protected ProductOptions Options { get; } = options;
    protected static void User(Actor actor) => J.Require(!actor.IsAgent, 403, "permission_denied", "Diese Aktion ist dem Nutzer vorbehalten.");
    protected static void Admin(Actor actor) { User(actor); J.Require(actor.Account.IsAdmin, 403, "permission_denied", "Administratorrechte erforderlich."); }
    protected Vault GetVault(Actor actor, Guid id, int level = 1, bool trash = false)
    {
        var v = Db.Vaults.SingleOrDefault(x => x.Id == id && x.OwnerId == actor.Account.Id);
        J.Require(v != null && (trash ? v.DeletedAt != null && v.ExpiresAt > Clock.Now : v.DeletedAt == null), 404, "not_found", "Vault nicht gefunden.");
        if (actor.IsAgent)
        {
            J.Require(!trash, 404, "not_found", "Vault nicht gefunden.");
            var grant = Db.Grants.SingleOrDefault(x => x.AccessId == actor.Access!.Id && x.VaultId == id);
            J.Require(grant != null, 404, "not_found", "Vault nicht gefunden.");
            J.Require(grant!.Level >= level && actor.Credential!.Scopes.Contains(level == 3 ? "memory:delete" : level == 2 ? "memory:write" : "memory:read"), 403, "permission_denied", "Für diese Aktion fehlen Rechte.");
        }
        return v!;
    }
    protected Memory GetMemory(Actor actor, Guid id, int level = 1, bool trash = false)
    {
        var m = Db.Memories.SingleOrDefault(x => x.Id == id && x.OwnerId == actor.Account.Id);
        J.Require(m != null && (trash ? m.DeletedAt != null && m.ExpiresAt > Clock.Now : m.DeletedAt == null), 404, "not_found", "Erinnerung nicht gefunden.");
        GetVault(actor, m!.VaultId, level);
        return m;
    }
    protected object VaultView(Vault v) => new { v.Id, v.Name, revision = J.Rev(v.Revision), v.SearchLanguage, v.PendingSearchLanguage, v.VersionLimit, activeRecordCount = Db.Memories.Count(x => x.VaultId == v.Id && x.DeletedAt == null), createdAt = J.Time(v.CreatedAt), updatedAt = J.Time(v.UpdatedAt) };
    protected static object TagView(Tag t, bool agent = false) => agent ? new { t.Id, t.Name } : new { t.Id, t.Name, revision = J.Rev(t.Revision) };
    protected static object Write(Memory m) => new { m.Id, revision = J.Rev(m.Revision), updatedAt = J.Time(m.UpdatedAt) };
    protected static object Write(Vault v) => new { v.Id, revision = J.Rev(v.Revision), updatedAt = J.Time(v.UpdatedAt) };
    protected object Page(IEnumerable<object> values, Actor a, Operation op, IReadOnlyDictionary<Guid, double>? ranks = null)
    {
        var input = (JsonObject)op.Body.DeepClone(); foreach (var p in op.Query) input[p.Key] = p.Value?.DeepClone();
        var size = input.Int("pageSize", 20); var cursor = input.Str("cursor"); input.Remove("cursor");
        var fingerprint = J.Hash(op.Id + J.Canonical(op.Path) + J.Canonical(input));
        JsonArray? after = null;
        if (cursor.Length > 0)
        {
            JsonObject c;
            try { c = JsonNode.Parse(Security.Unprotect(cursor, "cursor"))!.AsObject(); } catch { throw J.Fail(400, "validation_failed", "Ungültiger Cursor."); }
            J.Require(c.Str("actor") == a.Id.ToString() && c.Str("fingerprint") == fingerprint, 400, "validation_failed", "Cursor gehört zu einem anderen Auftrag.");
            J.Require(DateTime.Parse(c.Str("expiresAt")).ToUniversalTime() > Clock.Now, 410, "cursor_expired", "Cursor ist abgelaufen.");
            after = c["after"]!.AsArray();
        }
        JsonArray SortKey(JsonObject row)
        {
            var id = row.Str("id", row.Str("revision"));
            if (op.Id is "web_list_vaults" or "web_list_tags") return new(Security.NameKey(row.Str("name")), id);
            if (op.Id == "admin_list_accounts") return new(row.Str("email").ToUpperInvariant(), id);
            if (op.Id == "web_list_versions") return new(-long.Parse(row.Str("revision"), System.Globalization.CultureInfo.InvariantCulture));
            var timeField = op.Id == "web_search_memories" ? "updatedAt" : op.Id == "web_list_sessions" ? "lastActiveAt" : op.Id is "web_list_trashed_vaults" or "web_list_trashed_memories" ? "deletedAt" : "createdAt";
            var ticks = -DateTime.Parse(row.Str(timeField), System.Globalization.CultureInfo.InvariantCulture).ToUniversalTime().Ticks;
            if (op.Id == "web_search_memories" && input.Str("sort", "relevance") == "relevance" && !string.IsNullOrWhiteSpace(input.Str("query"))) return new(-(ranks?.GetValueOrDefault(Guid.Parse(id)) ?? 0), ticks, id);
            return new(ticks, id);
        }
        var comparer = Comparer<JsonArray>.Create((left, right) =>
        {
            for (var i = 0; i < Math.Min(left.Count, right.Count); i++)
            {
                var l = left[i]!.AsValue(); var r = right[i]!.AsValue();
                var result = l.GetValueKind() == JsonValueKind.Number ? decimal.Parse(l.ToJsonString(), System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture).CompareTo(decimal.Parse(r.ToJsonString(), System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture)) : StringComparer.Ordinal.Compare(l.GetValue<string>(), r.GetValue<string>());
                if (result != 0) return result;
            }
            return left.Count.CompareTo(right.Count);
        });
        var list = values.Select(x => x as JsonObject ?? J.Obj(x)).Select(x => (Value: x, Key: SortKey(x))).Where(x => after == null || comparer.Compare(x.Key, after) > 0).OrderBy(x => x.Key, comparer).Take(size + 1).ToList();
        var next = list.Count > size ? Security.Protect(J.Obj(new { actor = a.Id, fingerprint, after = list[size - 1].Key, expiresAt = J.Time(Clock.Now.AddMinutes(30)) }).ToJsonString(), "cursor") : null;
        return new { items = list.Take(size).Select(x => x.Value), nextCursor = next };
    }
    protected void Proof(Actor a, Operation op)
    {
        User(a);
        // DELETE action contracts have no body; transport uses an empty object internally.
        JsonObject? body = op.Id is "web_delete_account" or "admin_delete_account" ? null : op.Body;
        var fingerprint = J.Hash(J.Canonical(J.Obj(new { operationId = op.Id, path = op.Path, query = op.Query, body })));
        var h = J.Hash(op.Proof ?? "");
        var flow = Db.Flows.SingleOrDefault(x => x.Kind == "proof" && x.Hash == h && x.OwnerId == a.Account.Id && x.SessionId == a.Session!.Id);
        J.Require(flow != null && !flow.Consumed && flow.ExpiresAt > Clock.Now && flow.Data == fingerprint, 403, "reauthentication_required", "Bitte diese Aktion erneut mit Passwort bestätigen.");
        flow!.Consumed = true;
    }
}
