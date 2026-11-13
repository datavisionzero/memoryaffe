using System.Text;
using System.Text.Json.Nodes;
using Memoryaffe.Application;
using Memoryaffe.Infrastructure;

public static class ApiTransport
{
    public static async Task<string> Read(HttpRequest request, int limit, CancellationToken ct)
    {
        if (request.ContentLength > limit) throw J.Fail(413, "payload_too_large", "Anfrage ist zu groß.");
        using var memory = new MemoryStream(); var buffer = new byte[16384]; int count;
        while ((count = await request.Body.ReadAsync(buffer, ct)) > 0) { if (memory.Length + count > limit) throw J.Fail(413, "payload_too_large", "Anfrage ist zu groß."); memory.Write(buffer, 0, count); }
        return new UTF8Encoding(false, true).GetString(memory.ToArray());
    }
    public static async Task Error(HttpContext context, ProductException error)
    {
        if (context.Response.HasStarted) { context.Abort(); return; }
        context.Response.StatusCode = error.Status;
        if (error.Status == 429) context.Response.Headers.RetryAfter = "60";
        if (error.Code == "request_in_progress") context.Response.Headers.RetryAfter = "1";
        var body = J.Obj(new { code = error.Code, message = error.Message, requestId = context.TraceIdentifier });
        if (error.Code == "request_in_progress") body["retryAfterSeconds"] = 1;
        await context.Response.WriteAsJsonAsync(body, J.Options);
    }
    public static void ValidateParameters(Contracts contracts, JsonObject spec, JsonObject path, JsonObject query)
    {
        var allowed = new HashSet<string>();
        foreach (var parameter in spec["parameters"]?.AsArray() ?? []) { var p = parameter!.AsObject(); var input = p.Str("in") == "path" ? path : p.Str("in") == "query" ? query : null; if (input == null) continue; var key = p.Str("name"); if (p.Str("in") == "query") allowed.Add(key); if (p.Bool("required")) J.Require(input.ContainsKey(key), 400, "validation_failed", $"Pflichtangabe fehlt: {key}."); if (input.TryGetPropertyValue(key, out var value)) contracts.Validate(value, p["schema"]!); }
        J.Require(query.All(x => allowed.Contains(x.Key)), 400, "validation_failed", "Unbekannter Queryparameter.");
    }
}
