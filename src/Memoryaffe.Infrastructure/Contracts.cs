using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Memoryaffe.Application;

namespace Memoryaffe.Infrastructure;

public sealed class Contracts
{
    public JsonObject Web { get; }
    public JsonObject Agent { get; }
    public JsonObject Tools { get; }
    public JsonObject Manifest { get; }
    public Contracts(string directory)
    {
        Web = JsonNode.Parse(File.ReadAllText(Path.Combine(directory, "web.openapi.json")))!.AsObject();
        Agent = JsonNode.Parse(File.ReadAllText(Path.Combine(directory, "agent.openapi.json")))!.AsObject();
        Tools = JsonNode.Parse(File.ReadAllText(Path.Combine(directory, "mcp-tools.json")))!.AsObject();
        Manifest = JsonNode.Parse(File.ReadAllText(Path.Combine(directory, "vault-manifest.schema.json")))!.AsObject();
    }
    public static JsonNode Parse(string text)
    {
        try { using var document = JsonDocument.Parse(text, new JsonDocumentOptions { MaxDepth = 64 }); Check(document.RootElement); return JsonNode.Parse(text)!; }
        catch (InvalidOperationException) { throw J.Fail(400, "validation_failed", "Ungültiges Unicode im JSON."); }
    }
    private static void Check(JsonElement element)
    {
        if (element.ValueKind == JsonValueKind.Object) { var names = new HashSet<string>(); foreach (var prop in element.EnumerateObject()) { if (!names.Add(prop.Name)) throw J.Fail(400, "validation_failed", "Doppelte JSON-Felder sind nicht erlaubt."); Check(prop.Value); } }
        if (element.ValueKind == JsonValueKind.Array) foreach (var child in element.EnumerateArray()) Check(child);
        if (element.ValueKind == JsonValueKind.String) { var text = element.GetString()!; if (text.Contains('\0')) throw J.Fail(400, "validation_failed", "U+0000 ist nicht erlaubt."); for (var i = 0; i < text.Length; i++) if (char.IsSurrogate(text[i])) { if (!char.IsHighSurrogate(text[i]) || i + 1 >= text.Length || !char.IsLowSurrogate(text[++i])) throw J.Fail(400, "validation_failed", "Ungültiges Unicode."); } }
    }
    public void Validate(JsonNode? input, JsonNode schema, JsonObject? root = null)
    {
        try { if (!Valid(input, schema, root ?? Web)) throw J.Fail(400, "validation_failed", PasswordValidationMessage(input, schema, root ?? Web) ?? "Die Eingabe entspricht nicht dem Schnittstellenvertrag."); }
        catch (Exception ex) when (ex is FormatException or InvalidOperationException or ArgumentException) { throw J.Fail(400, "validation_failed", "Ungültige Eingabe."); }
    }
    // Explain public password limits without reflecting submitted values or weakening the schema.
    private static string? PasswordValidationMessage(JsonNode? input, JsonNode schema, JsonObject root)
    {
        JsonNode Resolve(JsonNode node)
        {
            if (node["$ref"] is not { } reference) return node;
            JsonNode target = root;
            foreach (var key in reference.GetValue<string>().Split('/').Skip(1)) target = target[key.Replace("~1", "/").Replace("~0", "~")]!;
            return Resolve(target);
        }
        if (input is not JsonObject body || Resolve(schema)["properties"] is not JsonObject properties) return null;
        foreach (var name in new[] { "password", "newPassword", "currentPassword" })
        {
            if (properties[name] is not { } property) continue;
            var rule = Resolve(property);
            if (rule["minLength"] is not { } min || rule["maxLength"] is not { } max) continue;
            var label = name == "newPassword" ? "Neues Passwort" : name == "currentPassword" ? "Aktuelles Passwort" : "Passwort";
            if (body[name] is not JsonValue value || value.GetValueKind() != JsonValueKind.String) return $"{label} fehlt oder ist ungültig.";
            var length = value.GetValue<string>().EnumerateRunes().Count();
            if (length < min.GetValue<int>() || length > max.GetValue<int>()) return $"{label} benötigt {min.GetValue<int>()} bis {max.GetValue<int>()} Zeichen.";
        }
        return null;
    }
    private static bool Valid(JsonNode? value, JsonNode schema, JsonObject root)
    {
        if (schema is JsonValue boolean) return boolean.GetValue<bool>();
        var s = schema.AsObject();
        if (s["$ref"] is { } r) { JsonNode target = root; foreach (var key in r.GetValue<string>().Split('/').Skip(1)) target = target[key.Replace("~1", "/").Replace("~0", "~")]!; return Valid(value, target, root); }
        if (s.ContainsKey("const") && !JsonNode.DeepEquals(value, s["const"])) return false;
        if (s["enum"] is JsonArray e && !e.Any(x => JsonNode.DeepEquals(value, x))) return false;
        if (s["allOf"] is JsonArray all && !all.All(x => Valid(value, x!, root))) return false;
        if (s["anyOf"] is JsonArray any && !any.Any(x => Valid(value, x!, root))) return false;
        if (s["oneOf"] is JsonArray one && one.Count(x => Valid(value, x!, root)) != 1) return false;
        if (s["not"] is { } not && Valid(value, not, root)) return false;
        if (s["if"] is { } condition && Valid(value, condition, root) && s["then"] is { } then && !Valid(value, then, root)) return false;
        if (s["type"] is { } type)
        {
            var types = type is JsonArray ts ? ts.Select(x => x!.GetValue<string>()).ToArray() : [type.GetValue<string>()];
            var kind = value == null ? "null" : value is JsonObject ? "object" : value is JsonArray ? "array" : value.AsValue().GetValueKind() switch { JsonValueKind.String => "string", JsonValueKind.True or JsonValueKind.False => "boolean", JsonValueKind.Number => "number", _ => "null" };
            if (!types.Contains(kind) && !(kind == "number" && types.Contains("integer") && decimal.TryParse(value!.ToJsonString(), NumberStyles.Number, CultureInfo.InvariantCulture, out var d) && decimal.Truncate(d) == d)) return false;
        }
        if (value is JsonObject obj)
        {
            if (s["required"] is JsonArray required && required.Any(x => !obj.ContainsKey(x!.GetValue<string>()))) return false;
            var props = s["properties"]?.AsObject();
            foreach (var (key, val) in obj) { if (props != null && props.TryGetPropertyValue(key, out var child)) { if (!Valid(val, child!, root)) return false; } else if (s["additionalProperties"] is JsonValue ap && !ap.GetValue<bool>()) return false; }
        }
        if (value is JsonArray arr)
        {
            if (s["minItems"] != null && arr.Count < s["minItems"]!.GetValue<int>()) return false;
            if (s["maxItems"] != null && arr.Count > s["maxItems"]!.GetValue<int>()) return false;
            if (s["uniqueItems"]?.GetValue<bool>() == true && arr.Select(J.Canonical).Distinct().Count() != arr.Count) return false;
            if (s["items"] is { } items && !arr.All(x => Valid(x, items, root))) return false;
        }
        if (value is JsonValue v && v.GetValueKind() == JsonValueKind.String)
        {
            var text = v.GetValue<string>(); var length = text.EnumerateRunes().Count();
            if (s["minLength"] != null && length < s["minLength"]!.GetValue<int>() || s["maxLength"] != null && length > s["maxLength"]!.GetValue<int>()) return false;
            if (s["pattern"] is { } pat && !Regex.IsMatch(text, pat.GetValue<string>(), RegexOptions.CultureInvariant, TimeSpan.FromSeconds(1))) return false;
            if (s["format"]?.GetValue<string>() == "uuid" && (!Guid.TryParse(text, out var id) || id.ToString()[14] != '4')) return false;
            if (s["format"]?.GetValue<string>() == "date-time" && !DateTimeOffset.TryParse(text, out _)) return false;
            if (s["format"]?.GetValue<string>() == "uri" && !Uri.TryCreate(text, UriKind.Absolute, out _)) return false;
        }
        if (value is JsonValue number && number.GetValueKind() == JsonValueKind.Number)
        {
            var n = double.Parse(number.ToJsonString(), CultureInfo.InvariantCulture); if (s["minimum"] != null && n < double.Parse(s["minimum"]!.ToJsonString(), CultureInfo.InvariantCulture) || s["maximum"] != null && n > double.Parse(s["maximum"]!.ToJsonString(), CultureInfo.InvariantCulture)) return false;
        }
        return true;
    }
}
