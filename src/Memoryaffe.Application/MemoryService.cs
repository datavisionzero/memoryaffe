using System.Text;
using System.Text.Json.Nodes;
using Memoryaffe.Domain;

namespace Memoryaffe.Application;

public class MemoryService(IDataStore db, ISecurity security, ProductOptions options) : Service(db, security, options)
{
    public async Task<object> Run(Actor a, Operation op, CancellationToken ct)
    {
        var b = op.Body; var p = op.Path; var q = op.Query;
        if (op.Id == "web_list_vaults")
        {
            var vaults = Db.Vaults.Where(x => x.OwnerId == a.Account.Id && x.DeletedAt == null).ToList();
            if (a.IsAgent) { var grants = Db.Grants.Where(x => x.AccessId == a.Access!.Id).Select(x => x.VaultId).ToList(); vaults = vaults.Where(x => grants.Contains(x.Id)).ToList(); }
            return Page(vaults.OrderBy(x => x.NameKey, StringComparer.Ordinal).ThenBy(x => x.Id).Select(v => a.IsAgent ? new { v.Id, v.Name } : VaultView(v)), a, op);
        }
        if (op.Id == "web_create_vault")
        {
            User(a); var v = NewVault(a.Account.Id, b); Db.Add(v); await Db.Save(ct); return VaultView(v);
        }
        if (op.Id is "web_get_vault" or "web_update_vault" or "web_delete_vault")
        {
            User(a); var v = GetVault(a, p.Id("id"));
            if (op.Id == "web_get_vault") return VaultView(v);
            J.Revision(op.Id == "web_delete_vault" ? q : b, v.Revision);
            if (op.Id == "web_delete_vault")
            {
                v.DeletedAt = Clock.Now; v.ExpiresAt = Clock.Now.AddDays(30); Bump(v);
                foreach (var g in Db.Grants.Where(x => x.VaultId == v.Id).ToList()) { Db.Accesses.Single(x => x.Id == g.AccessId).Revision++; Db.Remove(g); }
                return Write(v);
            }
            var name = b.ContainsKey("name") ? Security.Name(b.Str("name"), 100) : v.Name;
            var key = Security.NameKey(name); NameFree(v.OwnerId, key, v.Id);
            var language = b.Str("searchLanguage", v.PendingSearchLanguage ?? v.SearchLanguage); var limit = b.Int("versionLimit", v.VersionLimit);
            if (v.Name != name || (v.PendingSearchLanguage ?? v.SearchLanguage) != language || v.VersionLimit != limit)
            {
                v.Name = name; v.NameKey = key; v.PendingSearchLanguage = language == v.SearchLanguage ? null : language; v.VersionLimit = limit; Bump(v);
                foreach (var m in Db.Memories.Where(x => x.VaultId == v.Id).ToList()) Trim(m, limit);
            }
            return VaultView(v);
        }
        if (op.Id is "web_list_tags" or "web_create_tag")
        {
            var v = GetVault(a, p.Id("vaultId"), op.Id == "web_create_tag" ? 2 : 1);
            if (op.Id == "web_list_tags") return Page(Db.Tags.Where(x => x.VaultId == v.Id).ToList().OrderBy(x => x.NameKey, StringComparer.Ordinal).ThenBy(x => x.Id).Select(t => TagView(t, a.IsAgent)), a, op);
            J.Require(!a.IsAgent || a.Account.AllowAgentTagCreation, 403, "permission_denied", "Agenten dürfen keine neuen Tags anlegen.");
            var name = Security.Name(b.Str("name"), 50); var key = Security.NameKey(name);
            J.Require(!Db.Tags.Any(x => x.VaultId == v.Id && x.NameKey == key), 409, "name_conflict", "Dieser Tag existiert bereits.");
            var t = new Tag { OwnerId = a.Account.Id, VaultId = v.Id, Name = name, NameKey = key }; Db.Add(t); return TagView(t, a.IsAgent);
        }
        if (op.Id == "web_search_memories")
        {
            Guid[] vaults;
            if (b.ContainsKey("vaultId")) vaults = [GetVault(a, b.Id("vaultId")).Id];
            else { vaults = Db.Vaults.Where(x => x.OwnerId == a.Account.Id && x.DeletedAt == null).Select(x => x.Id).ToArray(); if (a.IsAgent) { var grants = Db.Grants.Where(x => x.AccessId == a.Access!.Id).Select(x => x.VaultId).ToArray(); vaults = vaults.Intersect(grants).ToArray(); } }
            var query = b.Str("query"); using var searchTimeout = CancellationTokenSource.CreateLinkedTokenSource(ct); searchTimeout.CancelAfter(TimeSpan.FromSeconds(5)); IReadOnlyList<SearchMatch> matches;
            try { matches = await Db.Search(a.Account.Id, vaults, query, searchTimeout.Token); } catch (OperationCanceledException) when (!ct.IsCancellationRequested) { throw J.Fail(503, "temporarily_unavailable", "Suche hat das Zeitlimit erreicht. Bitte Suche eingrenzen."); }
            var ranks = matches.ToDictionary(x => x.Id, x => x.Rank);
            var memories = Db.Memories.Where(x => x.OwnerId == a.Account.Id && vaults.Contains(x.VaultId) && x.DeletedAt == null).ToList();
            if (!string.IsNullOrWhiteSpace(query)) memories = memories.Where(x => ranks.ContainsKey(x.Id)).ToList();
            var tags = b.Ids("tagIds"); if (tags.Length > 0) memories = memories.Where(x => b.Str("tagMatch", "all") == "any" ? tags.Any(t => x.TagIds.Contains(t)) : tags.All(t => x.TagIds.Contains(t))).ToList();
            var ordered = b.Str("sort", "relevance") == "updatedAt" || string.IsNullOrWhiteSpace(query) ? memories.OrderByDescending(x => x.UpdatedAt).ThenBy(x => x.Id) : memories.OrderByDescending(x => ranks.GetValueOrDefault(x.Id)).ThenByDescending(x => x.UpdatedAt).ThenBy(x => x.Id);
            var matchDetails = matches.ToDictionary(x => x.Id);
            return Page(ordered.Select(m => View(m, true, query, matchDetails.GetValueOrDefault(m.Id))), a, op, ranks);
        }
        if (op.Id == "web_create_memory")
        {
            var v = GetVault(a, b.Id("vaultId"), 2); var m = new Memory { OwnerId = a.Account.Id, VaultId = v.Id };
            Apply(m, b, v); SetActor(m, a); Db.Add(m); await Db.Save(ct); await Db.Index(m, v.SearchLanguage, ct); return Write(m);
        }
        if (op.Id is "web_get_memory" or "web_update_memory" or "web_delete_memory")
        {
            var m = GetMemory(a, p.Id("id"), op.Id == "web_delete_memory" ? 3 : op.Id == "web_update_memory" ? 2 : 1);
            if (op.Id == "web_get_memory") return View(m);
            J.Revision(op.Id == "web_delete_memory" ? q : b, m.Revision);
            if (op.Id == "web_delete_memory") { m.DeletedAt = Clock.Now; m.ExpiresAt = Clock.Now.AddDays(30); Bump(m, a); return Write(m); }
            var v = GetVault(a, m.VaultId, 2); var old = Snapshot(m); var before = Fingerprint(m); Apply(m, b, v);
            if (before != Fingerprint(m)) { Db.Add(old); Bump(m, a); Trim(m, v.VersionLimit, old); await Db.Save(ct); await Db.Index(m, v.SearchLanguage, ct); }
            return Write(m);
        }
        if (op.Id is "web_rename_tag" or "web_delete_tag" or "web_merge_tags")
        {
            User(a); var v = GetVault(a, p.Id("vaultId")); var t = Db.Tags.SingleOrDefault(x => x.Id == p.Id("id") && x.VaultId == v.Id) ?? throw J.Fail(404, "not_found", "Tag nicht gefunden.");
            J.Revision(op.Id == "web_delete_tag" ? q : b, t.Revision);
            Tag? target = null; var name = t.Name;
            if (op.Id == "web_merge_tags") { target = Db.Tags.SingleOrDefault(x => x.Id == b.Id("targetTagId") && x.VaultId == v.Id) ?? throw J.Fail(404, "not_found", "Zieltag nicht gefunden."); J.Revision(b, target.Revision, "expectedTargetRevision"); J.Require(t.Id != target.Id, 400, "validation_failed", "Quelle und Ziel müssen verschieden sein."); }
            if (op.Id == "web_rename_tag") { name = Security.Name(b.Str("name"), 50); var key = Security.NameKey(name); J.Require(!Db.Tags.Any(x => x.VaultId == v.Id && x.Id != t.Id && x.NameKey == key), 409, "name_conflict", "Tagname bereits vergeben."); if (name == t.Name) return TagView(t); }
            foreach (var m in Db.Memories.Where(x => x.VaultId == v.Id && x.TagIds.Contains(t.Id)).ToList())
            {
                var old = Snapshot(m); Db.Add(old);
                if (op.Id != "web_rename_tag") m.TagIds = m.TagIds.Where(x => x != t.Id).Concat(target == null ? [] : [target.Id]).Distinct().ToArray();
                Bump(m, a); Trim(m, v.VersionLimit, old);
            }
            if (op.Id == "web_rename_tag") { t.Name = name; t.NameKey = Security.NameKey(name); t.Revision++; return TagView(t); }
            Db.Remove(t); return target == null ? J.Ok : TagView(target);
        }
        if (op.Id == "web_move_memory")
        {
            User(a); var m = GetMemory(a, p.Id("id")); J.Revision(b, m.Revision); var v = GetVault(a, b.Id("targetVaultId"));
            if (m.VaultId != v.Id) { var names = Names(m); m.VaultId = v.Id; m.TagIds = ResolveTags(v, names); Bump(m, a); Trim(m, v.VersionLimit); await Db.Save(ct); await Db.Index(m, v.SearchLanguage, ct); }
            return Write(m);
        }
        if (op.Id is "web_list_versions" or "web_get_version" or "web_preview_restore" or "web_restore_version")
        {
            User(a); var m = GetMemory(a, p.Id("id")); var versions = Db.Versions.Where(x => x.MemoryId == m.Id).OrderByDescending(x => x.Revision).ToList();
            if (op.Id == "web_list_versions") return Page(versions.Select(v => VersionView(v, true)), a, op);
            var revision = op.Id == "web_restore_version" ? b.Str("sourceRevision") : p.Str("revision");
            var ver = versions.SingleOrDefault(x => J.Rev(x.Revision) == revision) ?? throw J.Fail(404, "not_found", "Version nicht gefunden.");
            if (op.Id == "web_get_version") return VersionView(ver);
            var vault = GetVault(a, m.VaultId); var tags = Db.Tags.Where(x => x.VaultId == vault.Id).ToList();
            var signature = J.Obj(new { actor = a.Id, memory = m.Id, source = ver.Revision, current = m.Revision, tagFingerprint = J.Hash(J.Canonical(J.Node(tags.OrderBy(x => x.Id).Select(x => new { x.Id, x.Revision })))), expires = J.Time(Clock.Now.AddMinutes(5)) });
            if (op.Id == "web_preview_restore") return new { sourceRevision = J.Rev(ver.Revision), currentRevision = J.Rev(m.Revision), restoreToken = Security.Protect(signature.ToJsonString(), "restore"), tagsToCreate = ver.TagNames.Where(n => !tags.Any(t => t.NameKey == Security.NameKey(n))), tagsToReuse = tags.Where(t => ver.TagNames.Any(n => Security.NameKey(n) == t.NameKey)).Select(t => TagView(t)) };
            J.Revision(b, m.Revision); JsonObject token;
            try { token = JsonNode.Parse(Security.Unprotect(b.Str("restoreToken"), "restore"))!.AsObject(); } catch { throw J.Fail(400, "validation_failed", "Ungültige Wiederherstellungsvorschau."); }
            J.Require(token.Str("actor") == a.Id.ToString() && token.Str("memory") == m.Id.ToString() && token["source"]!.GetValue<long>() == ver.Revision && token["current"]!.GetValue<long>() == m.Revision && DateTime.Parse(token.Str("expires")).ToUniversalTime() > Clock.Now && token.Str("tagFingerprint") == signature.Str("tagFingerprint"), 409, "revision_conflict", "Vorschau ist veraltet. Bitte erneut vergleichen.");
            var old = Snapshot(m); var before = Fingerprint(m); m.Title = ver.Title; m.Summary = ver.Summary; m.Markdown = ver.Markdown; m.TagIds = ResolveTags(vault, ver.TagNames);
            if (before != Fingerprint(m)) { Db.Add(old); Bump(m, a); Trim(m, vault.VersionLimit, old); await Db.Save(ct); await Db.Index(m, vault.SearchLanguage, ct); }
            return Write(m);
        }
        if (op.Id == "web_list_trashed_vaults") { User(a); return Page(Db.Vaults.Where(x => x.OwnerId == a.Account.Id && x.DeletedAt != null && x.ExpiresAt > Clock.Now).ToList().OrderByDescending(x => x.DeletedAt).Select(v => (object)new { v.Id, v.Name, revision = J.Rev(v.Revision), deletedAt = J.Time(v.DeletedAt), expiresAt = J.Time(v.ExpiresAt), recordCount = Db.Memories.Count(x => x.VaultId == v.Id) }), a, op); }
        if (op.Id == "web_list_trashed_memories") { User(a); var v = GetVault(a, p.Id("id")); return Page(Db.Memories.Where(x => x.VaultId == v.Id && x.DeletedAt != null && x.ExpiresAt > Clock.Now).ToList().OrderByDescending(x => x.DeletedAt).Select(m => (object)new { m.Id, m.VaultId, m.Title, revision = J.Rev(m.Revision), deletedAt = J.Time(m.DeletedAt), expiresAt = J.Time(m.ExpiresAt) }), a, op); }
        if (op.Id is "web_restore_vaults" or "web_purge_vaults") { User(a); var v = GetVault(a, p.Id("id"), trash: true); J.Revision(op.Id == "web_purge_vaults" ? q : b, v.Revision); if (op.Id == "web_purge_vaults") { Db.Remove(v); return J.Ok; } v.DeletedAt = null; v.ExpiresAt = null; Bump(v); return Write(v); }
        if (op.Id is "web_restore_memories" or "web_purge_memories") { User(a); var m = GetMemory(a, p.Id("id"), trash: true); J.Revision(op.Id == "web_purge_memories" ? q : b, m.Revision); if (op.Id == "web_purge_memories") { Db.Remove(m); return J.Ok; } m.DeletedAt = null; m.ExpiresAt = null; Bump(m, a); return Write(m); }
        throw J.Fail(404, "not_found", "Operation nicht gefunden.");
    }

    public Vault NewVault(Guid owner, JsonObject b)
    {
        var name = Security.Name(b.Str("name"), 100); var key = Security.NameKey(name); NameFree(owner, key);
        return new Vault { OwnerId = owner, Name = name, NameKey = key, SearchLanguage = b.Str("searchLanguage", "neutral"), VersionLimit = b.Int("versionLimit", 20) };
    }
    private void NameFree(Guid owner, string key, Guid? except = null) => J.Require(!Db.Vaults.Any(x => x.OwnerId == owner && x.NameKey == key && x.Id != except), 409, "name_conflict", "Dieser Vaultname ist bereits vergeben, gegebenenfalls im Papierkorb.");
    public object View(Memory m, bool hit = false, string query = "", SearchMatch? match = null)
    {
        var data = J.Obj(new { m.Id, m.VaultId, m.Title, m.Summary, tags = Db.Tags.Where(x => m.TagIds.Contains(x.Id)).ToList().OrderBy(x => x.NameKey).Select(t => TagView(t, true)), revision = J.Rev(m.Revision), createdAt = J.Time(m.CreatedAt), updatedAt = J.Time(m.UpdatedAt) });
        data[hit ? "snippet" : "markdown"] = hit ? Snippet(m, query, match) : m.Markdown; return data;
    }
    private static string Snippet(Memory m, string query, SearchMatch? match)
    {
        var source = string.IsNullOrWhiteSpace(query) ? m.Summary ?? m.Markdown : match?.Field switch { 0 => m.Title, 1 => m.Summary ?? "", _ => m.Markdown };
        var terms = query.Split([' ', '"'], StringSplitOptions.RemoveEmptyEntries).Where(x => x != "OR" && !x.StartsWith('-'));
        var index = match?.Token is { } token ? Math.Max(0, source.IndexOf(token, StringComparison.Ordinal)) : terms.Select(t => source.IndexOf(t, StringComparison.OrdinalIgnoreCase)).Where(x => x >= 0).DefaultIfEmpty(0).Min();
        var start = Math.Max(0, index - 60); if (start > 0 && char.IsLowSurrogate(source[start])) start--;
        return string.Concat(source[start..].EnumerateRunes().Take(320).Select(x => x.ToString()));
    }
    private void Apply(Memory m, JsonObject b, Vault v)
    {
        if (b.ContainsKey("title")) { var title = b.Str("title").Trim(TextRules.WhiteSpace); J.Require(title.EnumerateRunes().Count() is > 0 and <= 200, 400, "validation_failed", "Titel benötigt 1 bis 200 Zeichen."); m.Title = title; }
        if (b.ContainsKey("summary")) { var s = b.Str("summary"); J.Require(s.EnumerateRunes().Count() <= 1000, 400, "validation_failed", "Zusammenfassung ist zu lang."); m.Summary = s.Length == 0 ? null : s; }
        if (b.ContainsKey("markdown")) { var text = b.Str("markdown"); J.Require(Encoding.UTF8.GetByteCount(text) <= 1048576, 413, "payload_too_large", "Markdown darf höchstens 1 MiB umfassen."); m.Markdown = text; }
        if (b.ContainsKey("tagIds")) { var ids = b.Ids("tagIds"); J.Require(ids.Length <= 50 && ids.Distinct().Count() == ids.Length && Db.Tags.Count(x => x.VaultId == v.Id && ids.Contains(x.Id)) == ids.Length, 400, "validation_failed", "Tags müssen eindeutig sein und zu diesem Vault gehören."); m.TagIds = ids.Order().ToArray(); }
    }
    public string[] Names(Memory m) => Db.Tags.Where(x => m.TagIds.Contains(x.Id)).ToList().OrderBy(x => x.NameKey).Select(x => x.Name).ToArray();
    public Guid[] ResolveTags(Vault v, string[] names)
    {
        var tags = Db.Tags.Where(x => x.VaultId == v.Id).ToList(); var result = new List<Guid>();
        foreach (var n in names) { var key = Security.NameKey(n); var tag = tags.SingleOrDefault(x => x.NameKey == key); if (tag == null) { tag = new Tag { OwnerId = v.OwnerId, VaultId = v.Id, Name = n, NameKey = key }; Db.Add(tag); tags.Add(tag); } result.Add(tag.Id); }
        return result.Distinct().Order().ToArray();
    }
    private MemoryVersion Snapshot(Memory m) => new() { MemoryId = m.Id, Revision = m.Revision, Title = m.Title, Summary = m.Summary, Markdown = m.Markdown, TagNames = Names(m), SavedAt = m.UpdatedAt, ActorKind = m.ActorKind, ActorId = m.ActorId, ActorName = m.ActorName };
    private static string Fingerprint(Memory m) => J.Canonical(J.Obj(new { m.Title, m.Summary, m.Markdown, tags = m.TagIds.Order() }));
    private void Trim(Memory m, int limit, MemoryVersion? added = null) { var versions = Db.Versions.Where(x => x.MemoryId == m.Id).ToList(); if (added != null) versions.Add(added); foreach (var v in versions.DistinctBy(x => x.Id).OrderByDescending(x => x.Revision).Skip(limit)) Db.Remove(v); }
    private static void SetActor(Memory m, Actor a) { m.ActorKind = a.IsAgent ? "agent" : "user"; m.ActorId = a.Id; m.ActorName = a.Name; }
    private static void Bump(Memory m, Actor a) { m.Revision = checked(m.Revision + 1); m.UpdatedAt = Clock.Now; SetActor(m, a); }
    private static void Bump(Vault v) { v.Revision = checked(v.Revision + 1); v.UpdatedAt = Clock.Now; }
    private static object VersionView(MemoryVersion v, bool summary = false) { var obj = J.Obj(new { revision = J.Rev(v.Revision), savedAt = J.Time(v.SavedAt), actor = new { kind = v.ActorKind, id = v.ActorId, name = v.ActorName } }); if (!summary) { obj["title"] = v.Title; obj["summary"] = v.Summary; obj["markdown"] = v.Markdown; obj["tagNames"] = J.Node(v.TagNames); } return obj; }
}
