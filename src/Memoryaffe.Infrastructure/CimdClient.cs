using System.Collections.Concurrent;
using System.Net;
using System.Net.Sockets;
using System.Text.Json.Nodes;
using Memoryaffe.Application;
using Microsoft.Extensions.Configuration;

namespace Memoryaffe.Infrastructure;

public class OAuthException(string code, string message, int status = 400) : Exception(message)
{
    public string Code { get; } = code;
    public int Status { get; } = status;
    public bool PersistState { get; init; }
}
public record ClientMetadata(string Id, string Name, string[] Redirects);
public sealed class CimdClient(IConfiguration configuration, ProductOptions options)
{
    private readonly ConcurrentDictionary<string, (ClientMetadata Metadata, DateTime Expires)> cache = new();
    private readonly ConcurrentDictionary<string, SemaphoreSlim> locks = new();
    public bool Allowed(string client)
    {
        var file = configuration["Memoryaffe:AllowedClientsFile"];
        if (file != null) { try { var allowed = JsonNode.Parse(File.ReadAllText(file))!.AsArray(); return allowed.Any(x => x?.GetValue<string>() == client); } catch { return false; } }
        var configured = configuration.GetSection("Memoryaffe:AllowedClients").GetChildren().Select(x => x.Value).ToArray();
        return (configured.Length == 0 ? ["https://chatgpt.com/oauth/client.json"] : configured).Contains(client, StringComparer.Ordinal);
    }
    public async Task<ClientMetadata> Get(string client, CancellationToken ct)
    {
        if (!Allowed(client) || !Uri.TryCreate(client, UriKind.Absolute, out var uri) || uri.Scheme != "https" || uri.UserInfo.Length > 0 || uri.Fragment.Length > 0) throw new OAuthException("invalid_client", "Client ist nicht freigegeben.");
        if (cache.TryGetValue(client, out var hit) && hit.Expires > DateTime.UtcNow) return hit.Metadata;
        var gate = locks.GetOrAdd(client, _ => new SemaphoreSlim(1));
        if (!await gate.WaitAsync(TimeSpan.FromSeconds(5), ct)) throw new OAuthException("temporarily_unavailable", "Clientmetadaten sind vorübergehend nicht verfügbar.", 503);
        try
        {
            if (cache.TryGetValue(client, out hit) && hit.Expires > DateTime.UtcNow) return hit.Metadata;
            JsonObject document; var age = TimeSpan.FromHours(1);
            var fixture = configuration["Memoryaffe:TestCimdFile"];
            if (fixture != null)
            {
                if (!options.Development) throw new InvalidOperationException("TestCimdFile ist ausschließlich in Development erlaubt.");
                var fixtures = JsonNode.Parse(await File.ReadAllTextAsync(fixture, ct))!.AsObject();
                document = fixtures[client]?.AsObject() ?? throw new OAuthException("temporarily_unavailable", "Testmetadaten fehlen.", 503);
                age = TimeSpan.FromSeconds(document["testCacheSeconds"]?.GetValue<int>() ?? 0);
            }
            else
            {
                using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct); timeout.CancelAfter(TimeSpan.FromSeconds(5));
                var addresses = await Dns.GetHostAddressesAsync(uri.DnsSafeHost, timeout.Token);
                if (addresses.Length == 0 || addresses.Any(a => !PublicAddress(a))) throw new OAuthException("invalid_client", "Interne Netzwerkziele sind nicht erlaubt.");
                using var handler = new SocketsHttpHandler { AllowAutoRedirect = false, UseProxy = false, ConnectTimeout = TimeSpan.FromSeconds(5), ConnectCallback = async (context, token) =>
                {
                    var resolved = await Dns.GetHostAddressesAsync(context.DnsEndPoint.Host, token);
                    if (resolved.Length == 0 || resolved.Any(a => !PublicAddress(a))) throw new HttpRequestException("Internal network target rejected.");
                    foreach (var address in resolved)
                    {
                        var socket = new Socket(address.AddressFamily, SocketType.Stream, ProtocolType.Tcp);
                        try { await socket.ConnectAsync(new IPEndPoint(address, context.DnsEndPoint.Port), token); if (socket.RemoteEndPoint is not IPEndPoint remote || !PublicAddress(remote.Address)) throw new HttpRequestException("Internal peer rejected."); return new NetworkStream(socket, true); } catch { socket.Dispose(); }
                    }
                    throw new HttpRequestException("Client metadata connection failed.");
                } };
                using var http = new HttpClient(handler); using var response = await http.GetAsync(uri, HttpCompletionOption.ResponseHeadersRead, timeout.Token);
                if (!response.IsSuccessStatusCode || response.Content.Headers.ContentLength > 65536) throw new OAuthException("temporarily_unavailable", "Clientmetadaten sind vorübergehend nicht verfügbar.", 503);
                await using var stream = await response.Content.ReadAsStreamAsync(timeout.Token); using var memory = new MemoryStream(); var buffer = new byte[8192]; int count;
                while ((count = await stream.ReadAsync(buffer, timeout.Token)) > 0) { if (memory.Length + count > 65536) throw new OAuthException("invalid_client", "Clientmetadaten sind zu groß."); memory.Write(buffer, 0, count); }
                document = Contracts.Parse(new System.Text.UTF8Encoding(false, true).GetString(memory.ToArray())).AsObject();
                if (response.Headers.CacheControl?.NoStore == true || response.Headers.CacheControl?.NoCache == true) age = TimeSpan.Zero;
                else if (response.Headers.CacheControl?.MaxAge is { } maxAge && maxAge < age) age = maxAge;
            }
            var result = Validate(client, document);
            cache[client] = (result, DateTime.UtcNow.Add(age < TimeSpan.Zero ? TimeSpan.Zero : age)); return result;
        }
        catch (OAuthException) { throw; }
        catch (Exception e) when (e is ProductException or System.Text.DecoderFallbackException or InvalidOperationException) { throw new OAuthException("invalid_client", "Clientmetadaten sind ungültig."); }
        catch (Exception e) when (e is HttpRequestException or OperationCanceledException or System.Text.Json.JsonException or IOException or FormatException) { throw new OAuthException("temporarily_unavailable", "Clientmetadaten sind vorübergehend nicht verfügbar.", 503); }
        finally { gate.Release(); }
    }
    public static ClientMetadata Validate(string client, JsonObject d)
    {
        try
        {
            var redirects = d["redirect_uris"]!.AsArray().Select(x => x!.GetValue<string>()).ToArray();
            var methods = d["token_endpoint_auth_methods_supported"]?.AsArray().Select(x => x!.GetValue<string>()).ToArray() ?? [d.Str("token_endpoint_auth_method")];
            var grants = d["grant_types"]!.AsArray().Select(x => x!.GetValue<string>()).ToArray();
            var responses = d["response_types"]!.AsArray().Select(x => x!.GetValue<string>()).ToArray();
            if (d.Str("client_id") != client || redirects.Length == 0 || !redirects.All(x => Uri.TryCreate(x, UriKind.Absolute, out var u) && u.Scheme == "https" && u.UserInfo.Length == 0 && u.Fragment.Length == 0) || !methods.Contains("none") || !grants.Contains("authorization_code") || !grants.Contains("refresh_token") || !responses.Contains("code")) throw new OAuthException("invalid_client", "Clientmetadaten sind ungültig.");
            return new(client, d.Str("client_name", client), redirects);
        }
        catch (Exception e) when (e is InvalidOperationException or NullReferenceException) { throw new OAuthException("invalid_client", "Clientmetadaten sind ungültig."); }
    }
    public static bool PublicAddress(IPAddress address)
    {
        if (address.IsIPv4MappedToIPv6) address = address.MapToIPv4();
        if (IPAddress.IsLoopback(address)) return false;
        var b = address.GetAddressBytes();
        if (address.AddressFamily == AddressFamily.InterNetwork) return !(b[0] is 0 or 10 or 127 || b[0] >= 224 || b[0] == 169 && b[1] == 254 || b[0] == 172 && b[1] is >= 16 and <= 31 || b[0] == 192 && (b[1] == 168 || b[1] == 0 || b[1] == 2 || b[1] == 88 && b[2] == 99) || b[0] == 100 && b[1] is >= 64 and <= 127 || b[0] == 198 && (b[1] is 18 or 19 || b[1] == 51 && b[2] == 100) || b[0] == 203 && b[1] == 0 && b[2] == 113);
        // Only global-unicast 2000::/3, excluding special-purpose/documentation/transition space.
        return b[0] is >= 0x20 and <= 0x3f && !(b[0] == 0x20 && b[1] == 0x01 && (b[2] < 0x20 || b[2] == 0x0d && b[3] == 0xb8)) && !(b[0] == 0x20 && b[1] == 0x02) && !(b[0] == 0x3f && b[1] == 0xff && (b[2] & 0xf0) == 0);
    }
}
