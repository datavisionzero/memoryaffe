using System.Buffers.Binary;
using System.IO.Compression;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Memoryaffe.Application;
using Memoryaffe.Domain;

namespace Memoryaffe.Infrastructure;

// All database mutations run inside ProductRuntime's transaction. Cleanup must
// run only after its commit, with a fresh scope; archive deletion is repeatable.
public sealed class ArchiveService(IDataStore db, ISecurity security, ProductOptions options, MemoryService memories) : Service(db, security, options)
{
    private const long ZipLimit = 100L * 1024 * 1024, ExpandedLimit = 500L * 1024 * 1024, DiskLimit = 2L * 1024 * 1024 * 1024;
    private static readonly SemaphoreSlim InstanceSlots = new(2, 2);
    private static readonly System.Collections.Concurrent.ConcurrentDictionary<Guid, byte> AccountsInUse = new();
    private static readonly object DiskGate = new();
    private static readonly System.Collections.Concurrent.ConcurrentDictionary<Guid, byte> ActiveFiles = new();
    private static long reserved;
    private static readonly UTF8Encoding Utf8 = new(false, true);
    private static readonly uint[] CrcTable = BuildCrcTable();
    private static uint[] BuildCrcTable() { var table = new uint[256]; for (uint i = 0; i < table.Length; i++) { var n = i; for (var j = 0; j < 8; j++) n = (n >> 1) ^ ((n & 1) != 0 ? 0xedb88320u : 0); table[i] = n; } return table; }
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web) { PropertyNameCaseInsensitive = false, AllowDuplicateProperties = false, UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow, MaxDepth = 32 };
    private string DirectoryPath => Path.GetFullPath(Environment.GetEnvironmentVariable("MEMORYAFFE_IMPORT_DIRECTORY") ?? Path.Combine(AppContext.BaseDirectory, "data", "imports"));
    public long TemporaryBytes => Directory.Exists(DirectoryPath) ? Directory.EnumerateFiles(DirectoryPath, "*.zip").Sum(path => new FileInfo(path).Length) : 0;
    private string ArchivePath(Guid id) => Path.Combine(DirectoryPath, id.ToString("D") + ".zip");
    private static ProductException Invalid(string message = "Das Archiv ist ungültig.") => J.Fail(400, "validation_failed", message);
    private static void Require([System.Diagnostics.CodeAnalysis.DoesNotReturnIf(false)] bool condition, string message = "Das Archiv ist ungültig.") { if (!condition) throw Invalid(message); }
    private sealed class Lease(Guid account) : IDisposable { public void Dispose() { AccountsInUse.TryRemove(account, out _); InstanceSlots.Release(); } }
    private static Lease Enter(Actor a) { User(a); if (!AccountsInUse.TryAdd(a.Account.Id, 0)) throw J.Fail(503, "temporarily_unavailable", "Ein Archivauftrag für dieses Konto läuft bereits."); if (!InstanceSlots.Wait(0)) { AccountsInUse.TryRemove(a.Account.Id, out _); throw J.Fail(503, "temporarily_unavailable", "Archivkapazität ist momentan ausgelastet."); } return new(a.Account.Id); }
    private void PrivateDirectory()
    {
        var dir = DirectoryPath;
        Require(!dir.Split(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar).Any(x => x.Equals("wwwroot", StringComparison.OrdinalIgnoreCase)), "Das Importverzeichnis darf nicht im Webroot liegen.");
        Directory.CreateDirectory(dir);
        Require((File.GetAttributes(dir) & FileAttributes.ReparsePoint) == 0, "Das Importverzeichnis darf kein symbolischer Link sein.");
        if (OperatingSystem.IsWindows()) { var acl = new DirectorySecurity(); acl.SetAccessRuleProtection(true, false); var sid = WindowsIdentity.GetCurrent().User!; acl.SetOwner(sid); acl.AddAccessRule(new FileSystemAccessRule(sid, FileSystemRights.FullControl, InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit, PropagationFlags.None, AccessControlType.Allow)); new DirectoryInfo(dir).SetAccessControl(acl); }
        else File.SetUnixFileMode(dir, UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.UserExecute);
    }
    public async Task<object> Prepare(Actor a, Stream source, CancellationToken ct)
    {
        using var lease = Enter(a); using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct); timeout.CancelAfter(TimeSpan.FromMinutes(5)); ct = timeout.Token; PrivateDirectory(); var flow = new Flow { Kind = "import", OwnerId = a.Account.Id, ExpiresAt = Clock.Now.AddMinutes(30) }; var path = ArchivePath(flow.Id); var kept = false;
        lock (DiskGate) { var used = Directory.EnumerateFiles(DirectoryPath, "*.zip").Sum(p => new FileInfo(p).Length); if (used + reserved + ZipLimit > DiskLimit) throw J.Fail(503, "temporarily_unavailable", "Temporäres Archivbudget ist ausgeschöpft."); reserved += ZipLimit; ActiveFiles.TryAdd(flow.Id, 0); }
        try
        {
            await using (var output = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None, 65536, FileOptions.Asynchronous))
            {
                if (!OperatingSystem.IsWindows()) File.SetUnixFileMode(path, UnixFileMode.UserRead | UnixFileMode.UserWrite);
                var buffer = new byte[65536]; long total = 0; int n;
                while ((n = await source.ReadAsync(buffer, ct)) > 0) { total += n; if (total > ZipLimit) throw J.Fail(413, "payload_too_large", "ZIP darf höchstens 100 MiB umfassen."); await output.WriteAsync(buffer.AsMemory(0, n), ct); }
            }
            var manifest = await Validate(path, ct); string hash;
            await using (var file = File.OpenRead(path)) hash = Convert.ToHexString(await SHA256.HashDataAsync(file, ct));
            // Only a fully validated replacement invalidates the previous preparation.
            foreach (var old in Db.Flows.Where(x => x.Kind == "import" && x.OwnerId == a.Account.Id && !x.Consumed).ToList()) old.Consumed = true;
            flow.Data = J.Obj(new { hash, suggestedName = manifest.Vault.Name, recordCount = manifest.Records.Length, tagCount = manifest.Tags.Length, searchLanguage = manifest.Vault.SearchLanguage, versionLimit = manifest.Vault.VersionLimit, expiresAt = J.Time(flow.ExpiresAt), resultVaultId = (string?)null }).ToJsonString();
            Db.Add(flow); await Db.Save(ct); kept = true; return Preview(flow);
        }
        catch (Exception e) when (e is InvalidDataException or EndOfStreamException or JsonException or DecoderFallbackException or OverflowException) { throw Invalid(); }
        finally { ActiveFiles.TryRemove(flow.Id, out _); lock (DiskGate) reserved -= ZipLimit; if (!kept) File.Delete(path); }
    }
    private object Preview(Flow flow) { var d = JsonNode.Parse(flow.Data)!.AsObject(); return new { flow.Id, state = d["resultVaultId"] == null ? "ready" : "completed", expiresAt = d.Str("expiresAt"), suggestedName = d.Str("suggestedName"), recordCount = d.Int("recordCount"), tagCount = d.Int("tagCount"), searchLanguage = d.Str("searchLanguage"), versionLimit = d.Int("versionLimit"), resultVaultId = d["resultVaultId"]?.GetValue<string>() }; }
    public async Task<object> Run(Actor a, Operation op, CancellationToken ct)
    {
        User(a); var id = op.Id == "web_commit_import" ? op.Body.Id("preparationId") : op.Path.Id("id");
        var flow = Db.Flows.SingleOrDefault(x => x.Id == id && x.Kind == "import" && x.OwnerId == a.Account.Id) ?? throw J.Fail(404, "not_found", "Importvorbereitung nicht gefunden.");
        var data = JsonNode.Parse(flow.Data)!.AsObject(); var completed = data["resultVaultId"] != null;
        if (op.Id == "web_cancel_import") { if (!completed) flow.Consumed = true; return J.Ok; }
        J.Require(flow.ExpiresAt > Clock.Now && (!flow.Consumed || completed), 410, "import_expired", "Importvorbereitung ist abgelaufen oder wurde ersetzt.");
        if (op.Id == "web_get_import") return Preview(flow);
        Require(op.Id == "web_commit_import");
        using var lease = Enter(a);
        var name = Security.Name(op.Body.Str("targetName"), 100); var key = op.IdempotencyKey;
        Require(key != null && Regex.IsMatch(key, "^[A-Za-z0-9_.:-]{1,128}$"), "Ein gültiger Idempotency-Key ist erforderlich.");
        var fingerprint = J.Hash("web_commit_import:" + flow.Id + ":" + name);
        var repeat = Db.Repeats.SingleOrDefault(x => x.ActorId == a.Account.Id && x.Key == key);
        if (repeat != null && repeat.ExpiresAt <= Clock.Now) { Db.Remove(repeat); await Db.Save(ct); repeat = null; }
        if (repeat != null) J.Require(repeat.Fingerprint == fingerprint, 409, "idempotency_conflict", "Schlüssel wurde für einen anderen Auftrag verwendet.");
        if (completed)
        {
            J.Require(data.Str("targetName") == name, 409, "idempotency_conflict", "Vorbereitung wurde bereits mit anderem Ziel übernommen.");
            var replayVault = GetVault(a, Guid.Parse(data.Str("resultVaultId"))); var replayResult = VaultView(replayVault); if (repeat == null) Db.Add(new RepeatResult { ActorId = a.Account.Id, Key = key!, Fingerprint = fingerprint, VaultId = replayVault.Id, Level = 1, Result = J.Node(replayResult).ToJsonString(), ExpiresAt = flow.ExpiresAt }); return replayResult;
        }
        var path = ArchivePath(flow.Id); J.Require(File.Exists(path), 410, "import_expired", "Importdatei ist nicht mehr verfügbar.");
        await using (var source = File.OpenRead(path)) Require(Convert.ToHexString(await SHA256.HashDataAsync(source, ct)) == data.Str("hash"), "Archiv wurde nach der Vorschau verändert.");
        var manifest = await Validate(path, ct);
        var vault = memories.NewVault(a.Account.Id, J.Obj(new { name, searchLanguage = manifest.Vault.SearchLanguage, versionLimit = manifest.Vault.VersionLimit })); Db.Add(vault);
        var tags = new Dictionary<Guid, Guid>(); foreach (var source in manifest.Tags) { var tagName = Security.Name(source.Name, 50); var tag = new Tag { OwnerId = a.Account.Id, VaultId = vault.Id, Name = tagName, NameKey = Security.NameKey(tagName) }; Db.Add(tag); tags.Add(Guid.Parse(source.Id), tag.Id); }
        await Db.Save(ct);
        using (var zip = ZipFile.OpenRead(path))
        {
            var files = zip.Entries.ToDictionary(x => CanonicalPath(x.FullName), StringComparer.Ordinal);
            foreach (var source in manifest.Records)
            {
                await using var input = files["records/" + Guid.Parse(source.Id).ToString("D") + ".md"].Open();
                using var reader = new StreamReader(input, Utf8, false, 65536, true); var markdown = await reader.ReadToEndAsync(ct);
                var memory = new Memory { OwnerId = a.Account.Id, VaultId = vault.Id, Title = source.Title.Trim(Unicode17.WhiteSpace), Summary = string.IsNullOrEmpty(source.Summary) ? null : source.Summary, Markdown = markdown, TagIds = source.TagIds.Select(x => tags[Guid.Parse(x)]).Order().ToArray(), CreatedAt = ParseTime(source.CreatedAt), UpdatedAt = ParseTime(source.UpdatedAt), ImportedAt = Clock.Now, ActorKind = "user", ActorId = a.Account.Id, ActorName = a.Account.Email };
                Db.Add(memory); await Db.Save(ct); await Db.Index(memory, vault.SearchLanguage, ct);
            }
        }
        flow.Consumed = true; flow.ExpiresAt = Clock.Now.AddHours(24); data["resultVaultId"] = vault.Id.ToString(); data["targetName"] = name; flow.Data = data.ToJsonString();
        var result = VaultView(vault); Db.Add(new RepeatResult { ActorId = a.Account.Id, Key = key!, Fingerprint = fingerprint, VaultId = vault.Id, Level = 1, Result = J.Node(result).ToJsonString(), ExpiresAt = flow.ExpiresAt });
        return result;
    }
    public async Task Export(Actor a, Guid id, Stream destination, CancellationToken ct)
    {
        using var lease = Enter(a); using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct); timeout.CancelAfter(TimeSpan.FromMinutes(5)); ct = timeout.Token; var vault = GetVault(a, id);
        await using var zip = await ZipArchive.CreateAsync(new ExportWriteBridge(destination, ct), ZipArchiveMode.Create, true, Utf8, ct);
        var manifest = zip.CreateEntry("manifest.json", CompressionLevel.Fastest);
        await using (var output = await manifest.OpenAsync(ct))
        await using (var writer = new Utf8JsonWriter(output))
        {
            writer.WriteStartObject(); writer.WriteNumber("formatVersion", 1); writer.WriteString("exportedAt", J.Time(Clock.Now));
            writer.WritePropertyName("vault"); writer.WriteStartObject(); writer.WriteString("name", vault.Name); writer.WriteString("searchLanguage", vault.SearchLanguage); writer.WriteNumber("versionLimit", vault.VersionLimit); writer.WriteEndObject();
            writer.WritePropertyName("tags"); writer.WriteStartArray(); foreach (var tag in Db.Tags.Where(x => x.VaultId == id).OrderBy(x => x.Id).Select(x => new { x.Id, x.Name })) { writer.WriteStartObject(); writer.WriteString("id", tag.Id); writer.WriteString("name", tag.Name); writer.WriteEndObject(); await writer.FlushAsync(ct); }
            writer.WriteEndArray();
            writer.WritePropertyName("records"); writer.WriteStartArray();
            foreach (var row in Db.Memories.Where(x => x.VaultId == id && x.DeletedAt == null).OrderBy(x => x.Id).Select(x => new { x.Id, x.Title, x.Summary, x.TagIds, x.CreatedAt, x.UpdatedAt })) { writer.WriteStartObject(); writer.WriteString("id", row.Id); writer.WriteString("title", row.Title); writer.WriteString("summary", row.Summary); writer.WritePropertyName("tagIds"); writer.WriteStartArray(); foreach (var tagId in row.TagIds) writer.WriteStringValue(tagId); writer.WriteEndArray(); writer.WriteString("createdAt", J.Time(row.CreatedAt)); writer.WriteString("updatedAt", J.Time(row.UpdatedAt)); writer.WriteEndObject(); await writer.FlushAsync(ct); }
            writer.WriteEndArray(); writer.WriteEndObject(); await writer.FlushAsync(ct);
        }
        // One full record at a time; neither the complete archive nor all Markdown
        // bodies are accumulated in memory. No import-size restriction on exports.
        foreach (var row in Db.Memories.Where(x => x.VaultId == id && x.DeletedAt == null).OrderBy(x => x.Id).Select(x => new { x.Id, x.Markdown }))
        {
            ct.ThrowIfCancellationRequested(); var entry = zip.CreateEntry("records/" + row.Id.ToString("D") + ".md", CompressionLevel.Fastest); await using var output = await entry.OpenAsync(ct); await using var writer = new StreamWriter(output, Utf8, 65536, true); await writer.WriteAsync(row.Markdown.AsMemory(), ct);
        }
    }
    // ZipArchiveEntry.OpenAsync currently returns a WrappedStream whose inherited
    // DisposeAsync falls back to synchronous DeflateStream finalization. Keep
    // Kestrel synchronous I/O disabled: that short final write uses WriteAsync
    // through this bridge, with the same cancellation deadline and no archive
    // buffering. Normal writes remain fully asynchronous.
    private sealed class ExportWriteBridge(Stream destination, CancellationToken deadline) : Stream
    {
        public override bool CanRead => false; public override bool CanSeek => false; public override bool CanWrite => true;
        public override long Length => throw new NotSupportedException(); public override long Position { get => throw new NotSupportedException(); set => throw new NotSupportedException(); }
        public override void Write(byte[] buffer, int offset, int count) => destination.WriteAsync(buffer.AsMemory(offset, count), deadline).AsTask().GetAwaiter().GetResult();
        public override void Write(ReadOnlySpan<byte> buffer) => Write(buffer.ToArray(), 0, buffer.Length);
        public override ValueTask WriteAsync(ReadOnlyMemory<byte> buffer, CancellationToken ct = default) => destination.WriteAsync(buffer, deadline);
        public override Task WriteAsync(byte[] buffer, int offset, int count, CancellationToken ct) => destination.WriteAsync(buffer.AsMemory(offset, count), deadline).AsTask();
        public override void Flush() => destination.FlushAsync(deadline).GetAwaiter().GetResult(); public override Task FlushAsync(CancellationToken ct) => destination.FlushAsync(deadline);
        public override int Read(byte[] buffer, int offset, int count) => throw new NotSupportedException(); public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException(); public override void SetLength(long value) => throw new NotSupportedException();
    }
    public Task Cleanup(CancellationToken ct)
    {
        PrivateDirectory(); var live = Db.Flows.Where(x => x.Kind == "import" && !x.Consumed && x.ExpiresAt > Clock.Now).Select(x => x.Id).ToHashSet();
        foreach (var file in Directory.EnumerateFiles(DirectoryPath, "*.zip")) { ct.ThrowIfCancellationRequested(); if (Guid.TryParseExact(Path.GetFileNameWithoutExtension(file), "D", out var id) && !live.Contains(id) && !ActiveFiles.ContainsKey(id)) File.Delete(file); }
        return Task.CompletedTask;
    }
    public sealed class Manifest { public required int FormatVersion { get; set; } public required string ExportedAt { get; set; } public required VaultInfo Vault { get; set; } public required TagInfo[] Tags { get; set; } public required RecordInfo[] Records { get; set; } }
    public sealed class VaultInfo { public required string Name { get; set; } public required string SearchLanguage { get; set; } public required int VersionLimit { get; set; } }
    public sealed class TagInfo { public required string Id { get; set; } public required string Name { get; set; } }
    public sealed class RecordInfo { public required string Id { get; set; } public required string Title { get; set; } public required string? Summary { get; set; } public required string[] TagIds { get; set; } public required string CreatedAt { get; set; } public required string UpdatedAt { get; set; } }
    private static readonly Regex Uuid = new("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$");
    private static Guid Id(string? value) { Require(value != null && Uuid.IsMatch(value), "Ungültige Archiv-ID."); return Guid.Parse(value!); }
    private static void Text(string? value, int max, bool required = false) { Require(value != null && value.EnumerateRunes().Count() <= max && (!required || value.Trim(Unicode17.WhiteSpace).Length > 0), "Ungültiger Archivtext."); for (var i = 0; i < value!.Length; i++) { var c = value[i]; Require(c != 0); if (char.IsHighSurrogate(c)) { Require(i + 1 < value.Length && char.IsLowSurrogate(value[i + 1])); i++; } else Require(!char.IsLowSurrogate(c)); } }
    private static DateTime ParseTime(string? value) { Require(DateTime.TryParseExact(value, "yyyy-MM-dd'T'HH:mm:ss.fff'Z'", System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.AssumeUniversal | System.Globalization.DateTimeStyles.AdjustToUniversal, out var date), "Ungültiger Archivzeitpunkt."); return date; }
    private static string CanonicalPath(string name) { if (name == "manifest.json") return name; Require(name.StartsWith("records/", StringComparison.Ordinal) && name.EndsWith(".md", StringComparison.Ordinal) && name.Length == 47, "Unerwarteter oder unsicherer ZIP-Pfad."); return "records/" + Id(name[8..^3]).ToString("D") + ".md"; }
    private async Task<Manifest> Validate(string path, CancellationToken ct)
    {
        try
        {
            var central = ReadDirectory(path); using var zip = ZipFile.OpenRead(path); Require(zip.Entries.Count == central.Count && zip.Entries.Count <= 10001);
            var files = new Dictionary<string, ZipArchiveEntry>(StringComparer.Ordinal); foreach (var entry in zip.Entries) { var name = CanonicalPath(entry.FullName); Require(files.TryAdd(name, entry), "Doppelte ZIP-Datei."); }
            Require(files.ContainsKey("manifest.json"), "Manifest fehlt.");
            var budget = new Budget(); Manifest? manifest;
            await using (var input = new CheckedStream(files["manifest.json"].Open(), central["manifest.json"], budget)) manifest = await JsonSerializer.DeserializeAsync<Manifest>(input, JsonOptions, ct);
            Require(manifest != null && manifest.FormatVersion == 1 && manifest.Vault != null && manifest.Tags != null && manifest.Records != null && manifest.Records.Length <= 10000);
            ParseTime(manifest!.ExportedAt); Text(manifest.Vault.Name, 100, true); Security.Name(manifest.Vault.Name, 100); Require(manifest.Vault.SearchLanguage is "neutral" or "de" or "en" && manifest.Vault.VersionLimit is >= 0 and <= 100);
            var tagIds = new HashSet<Guid>(); var names = new HashSet<string>(StringComparer.Ordinal);
            foreach (var tag in manifest.Tags) { Require(tag != null); var name = Security.Name(tag!.Name, 50); Text(tag.Name, 50, true); Require(tagIds.Add(Id(tag.Id)) && names.Add(Security.NameKey(name)), "Doppelte Tag-ID oder Tag-Namen."); }
            var records = new HashSet<Guid>(); Require(files.Count == manifest.Records.Length + 1, "ZIP-Dateien stimmen nicht mit dem Manifest überein.");
            foreach (var record in manifest.Records)
            {
                ct.ThrowIfCancellationRequested(); Require(record != null); var id = Id(record!.Id); Require(records.Add(id), "Doppelte Datensatz-ID."); Text(record.Title, 200, true); if (record.Summary != null) Text(record.Summary, 1000); ParseTime(record.CreatedAt); ParseTime(record.UpdatedAt);
                Require(record.TagIds != null && record.TagIds.Length <= 50); var ids = record.TagIds!.Select(Id).ToArray(); Require(ids.Distinct().Count() == ids.Length && ids.All(tagIds.Contains), "Ungültige Tag-Verweise.");
                var name = "records/" + id.ToString("D") + ".md"; Require(files.TryGetValue(name, out var entry), "Markdown-Datei fehlt."); Require(entry!.Length <= 1048576, "Markdown überschreitet 1 MiB.");
                await using var input = new CheckedStream(entry.Open(), central[name], budget); using var reader = new StreamReader(input, Utf8, false, 65536, true); var text = await reader.ReadToEndAsync(ct); Text(text, int.MaxValue); Require(Utf8.GetByteCount(text) <= 1048576);
            }
            return manifest;
        }
        catch (Exception e) when (e is InvalidDataException or EndOfStreamException or JsonException or DecoderFallbackException or OverflowException or ArgumentException or InvalidOperationException) { throw Invalid(); }
    }
    private record EntryCheck(uint Crc, long Length);
    private static Dictionary<string, EntryCheck> ReadDirectory(string path)
    {
        using var file = File.OpenRead(path); Require(file.Length >= 22); var tail = new byte[(int)Math.Min(file.Length, 65557)]; file.Position = file.Length - tail.Length; file.ReadExactly(tail); var end = -1;
        for (var i = tail.Length - 22; i >= 0; i--) if (BinaryPrimitives.ReadUInt32LittleEndian(tail.AsSpan(i)) == 0x06054b50 && i + 22 + BinaryPrimitives.ReadUInt16LittleEndian(tail.AsSpan(i + 20)) == tail.Length) { end = i; break; }
        Require(end >= 0); var eocd = tail.AsSpan(end); var count = BinaryPrimitives.ReadUInt16LittleEndian(eocd[10..]); var size = BinaryPrimitives.ReadUInt32LittleEndian(eocd[12..]); var offset = BinaryPrimitives.ReadUInt32LittleEndian(eocd[16..]);
        Require(BinaryPrimitives.ReadUInt16LittleEndian(eocd[4..]) == 0 && BinaryPrimitives.ReadUInt16LittleEndian(eocd[6..]) == 0 && BinaryPrimitives.ReadUInt16LittleEndian(eocd[8..]) == count && count is > 0 and <= 10001 && offset + (long)size == file.Length - tail.Length + end);
        file.Position = offset; var result = new Dictionary<string, EntryCheck>(StringComparer.Ordinal); long expanded = 0;
        for (var i = 0; i < count; i++)
        {
            var header = new byte[46]; file.ReadExactly(header); Require(BinaryPrimitives.ReadUInt32LittleEndian(header) == 0x02014b50); var flags = BinaryPrimitives.ReadUInt16LittleEndian(header.AsSpan(8)); var method = BinaryPrimitives.ReadUInt16LittleEndian(header.AsSpan(10)); var length = BinaryPrimitives.ReadUInt32LittleEndian(header.AsSpan(24)); var attrs = BinaryPrimitives.ReadUInt32LittleEndian(header.AsSpan(38)); var mode = (attrs >> 16) & 0xf000;
            Require((flags & 0x0041) == 0 && method is 0 or 8 && (mode == 0 || mode == 0x8000) && (attrs & 0x10) == 0, "Verschlüsselte ZIPs, Symlinks und Sonderdateien sind unzulässig.");
            var nameLength = BinaryPrimitives.ReadUInt16LittleEndian(header.AsSpan(28)); var extraLength = BinaryPrimitives.ReadUInt16LittleEndian(header.AsSpan(30)); var commentLength = BinaryPrimitives.ReadUInt16LittleEndian(header.AsSpan(32)); var nameBytes = new byte[nameLength]; file.ReadExactly(nameBytes); var name = CanonicalPath(Utf8.GetString(nameBytes));
            Require(result.TryAdd(name, new(BinaryPrimitives.ReadUInt32LittleEndian(header.AsSpan(16)), length)), "Doppelte ZIP-Datei."); expanded += length; Require(expanded <= ExpandedLimit, "Entpacktes Archiv überschreitet 500 MiB.");
            var next = file.Position + extraLength + commentLength; Require(next <= offset + (long)size); var localOffset = BinaryPrimitives.ReadUInt32LittleEndian(header.AsSpan(42)); Require(localOffset < offset); file.Position = localOffset; var local = new byte[30]; file.ReadExactly(local); Require(BinaryPrimitives.ReadUInt32LittleEndian(local) == 0x04034b50 && BinaryPrimitives.ReadUInt16LittleEndian(local.AsSpan(6)) == flags && BinaryPrimitives.ReadUInt16LittleEndian(local.AsSpan(8)) == method && BinaryPrimitives.ReadUInt16LittleEndian(local.AsSpan(26)) == nameLength); var localName = new byte[nameLength]; file.ReadExactly(localName); Require(localName.AsSpan().SequenceEqual(nameBytes)); file.Position = next;
        }
        Require(file.Position == offset + size); return result;
    }
    private sealed class Budget { public long Total; }
    private sealed class CheckedStream(Stream source, EntryCheck expected, Budget budget) : Stream
    {
        private uint crc = uint.MaxValue; private long count; private bool checkedEnd;
        private void Count(ReadOnlySpan<byte> data) { count += data.Length; budget.Total += data.Length; Require(count <= expected.Length && budget.Total <= ExpandedLimit, "Archiv überschreitet Entpackgrenze."); foreach (var b in data) crc = (crc >> 8) ^ CrcTable[(crc ^ b) & 255]; if (data.Length == 0 && !checkedEnd) { checkedEnd = true; Require(count == expected.Length && ~crc == expected.Crc, "ZIP-Prüfsumme stimmt nicht."); } }
        public override int Read(byte[] buffer, int offset, int length) { var n = source.Read(buffer, offset, length); Count(buffer.AsSpan(offset, n)); return n; }
        public override async ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken ct = default) { var n = await source.ReadAsync(buffer, ct); Count(buffer.Span[..n]); return n; }
        public override bool CanRead => true; public override bool CanSeek => false; public override bool CanWrite => false; public override long Length => expected.Length; public override long Position { get => count; set => throw new NotSupportedException(); }
        public override void Flush() { }
        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException(); public override void SetLength(long value) => throw new NotSupportedException(); public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException(); protected override void Dispose(bool disposing) { if (disposing) source.Dispose(); base.Dispose(disposing); }
    }
}
