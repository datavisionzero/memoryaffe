using System.Buffers.Binary;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using Memoryaffe.Application;
using Memoryaffe.Domain;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;

namespace Memoryaffe.Infrastructure;

public sealed class Security(IDataProtectionProvider protection) : ISecurity
{
    private readonly PasswordHasher<Account> hasher = new();
    private static readonly Account DummyAccount = Dummy();
    private static Account Dummy() { var account = new Account(); account.PasswordHash = new PasswordHasher<Account>().HashPassword(account, J.Secret()); return account; }
    public string HashPassword(Account account, string password) => hasher.HashPassword(account, password);
    public bool VerifyPassword(Account? account, string password) { var target = account ?? DummyAccount; try { return hasher.VerifyHashedPassword(target, target.PasswordHash, password) != PasswordVerificationResult.Failed; } catch { return false; } }
    public string Protect(string value, string purpose) => protection.CreateProtector("memoryaffe.v1." + purpose).Protect(value);
    public string Unprotect(string value, string purpose) => protection.CreateProtector("memoryaffe.v1." + purpose).Unprotect(value);
    public string Name(string value, int max) { var name = Unicode17.Normalize(value.Trim(Unicode17.WhiteSpace)); J.Require(name.EnumerateRunes().Count() is > 0 && name.EnumerateRunes().Count() <= max, 400, "validation_failed", $"Name benötigt 1 bis {max} Zeichen."); return name; }
    public string NameKey(string value) => Unicode17.Fold(value);
    public string NewTotpSecret() => Base32(RandomNumberGenerator.GetBytes(20));
    public long? VerifyTotp(string secret, string code, long after)
    {
        if (code.Length != 6 || code.Any(x => x < '0' || x > '9')) return null;
        var key = FromBase32(secret); var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds() / 30;
        Span<byte> counter = stackalloc byte[8];
        foreach (var step in new[] { now, now - 1, now + 1 })
        {
            if (step <= after) continue;
            BinaryPrimitives.WriteInt64BigEndian(counter, step);
            var digest = HMACSHA1.HashData(key, counter); var offset = digest[^1] & 15;
            var number = BinaryPrimitives.ReadInt32BigEndian(digest.AsSpan(offset, 4)) & 0x7fffffff;
            var expected = (number % 1000000).ToString("D6", CultureInfo.InvariantCulture);
            if (CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(expected), Encoding.ASCII.GetBytes(code))) return step;
        }
        return null;
    }
    private static string Base32(byte[] bytes) { const string alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; var result = new StringBuilder(); int buffer = 0, bits = 0; foreach (var b in bytes) { buffer = (buffer << 8) | b; bits += 8; while (bits >= 5) { bits -= 5; result.Append(alphabet[(buffer >> bits) & 31]); } } if (bits > 0) result.Append(alphabet[(buffer << (5 - bits)) & 31]); return result.ToString(); }
    private static byte[] FromBase32(string text) { var result = new List<byte>(); int buffer = 0, bits = 0; foreach (var c in text) { var n = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".IndexOf(c); if (n < 0) throw new FormatException(); buffer = (buffer << 5) | n; bits += 5; if (bits >= 8) { bits -= 8; result.Add((byte)(buffer >> bits)); } } return result.ToArray(); }
}

// NFC and full case folding are fixed to the embedded Unicode 17 data on every OS.
public static class Unicode17
{
    public static readonly char[] WhiteSpace = ['\u0009','\u000a','\u000b','\u000c','\u000d','\u0020','\u0085','\u00a0','\u1680','\u2000','\u2001','\u2002','\u2003','\u2004','\u2005','\u2006','\u2007','\u2008','\u2009','\u200a','\u2028','\u2029','\u202f','\u205f','\u3000'];
    private static readonly Dictionary<int, int[]> Decompositions = [];
    private static readonly Dictionary<int, int> Classes = [];
    private static readonly Dictionary<(int, int), int> Compositions = [];
    private static readonly Dictionary<int, int[]> Folds = [];
    static Unicode17()
    {
        var excluded = Lines("CompositionExclusions.txt").Select(x => x.Split('#')[0].Trim()).Where(x => x.Length > 0).Select(x => int.Parse(x, NumberStyles.HexNumber)).ToHashSet();
        foreach (var line in Lines("UnicodeData.txt")) { var f = line.Split(';'); var code = int.Parse(f[0], NumberStyles.HexNumber); var cc = int.Parse(f[3]); if (cc != 0) Classes[code] = cc; if (f[5].Length > 0 && !f[5].StartsWith('<')) Decompositions[code] = Parse(f[5]); }
        foreach (var (code, seq) in Decompositions) if (seq.Length == 2 && !excluded.Contains(code) && Class(seq[0]) == 0) Compositions[(seq[0], seq[1])] = code;
        foreach (var line in Lines("CaseFolding.txt")) { var content = line.Split('#')[0].Trim(); if (content.Length == 0) continue; var f = content.Split(';'); if (f[1].Trim() is "C" or "F") Folds[int.Parse(f[0], NumberStyles.HexNumber)] = Parse(f[2].Trim()); }
    }
    public static IEnumerable<string> Lines(string name) { using var stream = typeof(Unicode17).Assembly.GetManifestResourceStream("Memoryaffe.Infrastructure.Unicode." + name)!; using var reader = new StreamReader(stream); while (reader.ReadLine() is { } line) yield return line; }
    private static int[] Parse(string value) => value.Split(' ', StringSplitOptions.RemoveEmptyEntries).Select(x => int.Parse(x, NumberStyles.HexNumber)).ToArray();
    private static int Class(int code) => Classes.GetValueOrDefault(code);
    public static string Fold(string value) => Normalize(string.Concat(value.EnumerateRunes().SelectMany(r => Folds.GetValueOrDefault(r.Value, [r.Value])).Select(char.ConvertFromUtf32)));
    public static string Normalize(string value)
    {
        var d = new List<int>(); foreach (var r in value.EnumerateRunes()) Decompose(r.Value, d);
        for (var i = 1; i < d.Count; i++) { var cc = Class(d[i]); if (cc == 0) continue; var k = i; while (k > 0 && Class(d[k - 1]) > cc) { (d[k - 1], d[k]) = (d[k], d[k - 1]); k--; } }
        if (d.Count == 0) return "";
        var c = new List<int> { d[0] }; var starterIndex = 0; var starter = d[0]; var lastClass = Class(d[0]);
        for (var i = 1; i < d.Count; i++) { var code = d[i]; var cc = Class(code); var composite = Compose(starter, code); if (composite != 0 && (lastClass < cc || lastClass == 0)) { c[starterIndex] = starter = composite; } else { if (cc == 0) { starterIndex = c.Count; starter = code; } c.Add(code); lastClass = cc; } }
        return string.Concat(c.Select(char.ConvertFromUtf32));
    }
    private static void Decompose(int code, List<int> result) { if (code is >= 0xAC00 and < 0xD7A4) { var n = code - 0xAC00; result.Add(0x1100 + n / 588); result.Add(0x1161 + (n % 588) / 28); if (n % 28 > 0) result.Add(0x11A7 + n % 28); } else if (Decompositions.TryGetValue(code, out var d)) { foreach (var c in d) Decompose(c, result); } else result.Add(code); }
    private static int Compose(int a, int b) { if (a is >= 0x1100 and < 0x1113 && b is >= 0x1161 and < 0x1176) return 0xAC00 + ((a - 0x1100) * 21 + b - 0x1161) * 28; if (a is >= 0xAC00 and < 0xD7A4 && (a - 0xAC00) % 28 == 0 && b is > 0x11A7 and < 0x11C3) return a + b - 0x11A7; return Compositions.GetValueOrDefault((a, b)); }
}
