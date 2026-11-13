using System.Globalization;
using System.Net;
using Memoryaffe.Infrastructure;
using Xunit;

namespace Memoryaffe.Tests;

public class UnicodeSecurityTests
{
    [Fact]
    public void EveryUnicode17NormalizationFixturePasses()
    {
        var count = 0;
        foreach (var line in Unicode17.Lines("NormalizationTest.txt"))
        {
            var content = line.Split('#')[0].Trim(); if (content.Length == 0 || content.StartsWith('@')) continue;
            var cols = content.Split(';').Take(5).Select(c => string.Concat(c.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries).Select(x => char.ConvertFromUtf32(int.Parse(x, NumberStyles.HexNumber))))).ToArray();
            Assert.Equal(cols[1], Unicode17.Normalize(cols[0])); Assert.Equal(cols[1], Unicode17.Normalize(cols[1])); Assert.Equal(cols[1], Unicode17.Normalize(cols[2])); Assert.Equal(cols[3], Unicode17.Normalize(cols[3])); Assert.Equal(cols[3], Unicode17.Normalize(cols[4])); count++;
        }
        Assert.True(count > 19000);
    }
    [Theory]
    [InlineData("Straße", "STRASSE", true)]
    [InlineData("Café", "Cafe\u0301", true)]
    [InlineData("Σ", "ς", true)]
    [InlineData("für", "fur", false)]
    [InlineData("İ", "i", false)]
    [InlineData("I", "ı", false)]
    public void FullCaseFoldingHasContractSemantics(string a, string b, bool equal) => Assert.Equal(equal, Unicode17.Fold(Unicode17.Normalize(a)) == Unicode17.Fold(Unicode17.Normalize(b)));
    [Theory]
    [InlineData("127.0.0.1", false)] [InlineData("10.1.2.3", false)] [InlineData("169.254.169.254", false)] [InlineData("192.168.1.1", false)] [InlineData("172.31.1.2", false)] [InlineData("100.64.1.1", false)] [InlineData("192.88.99.1", false)] [InlineData("::1", false)] [InlineData("::ffff:127.0.0.1", false)] [InlineData("fe80::1", false)] [InlineData("fc00::1", false)] [InlineData("2001:db8::1", false)] [InlineData("3fff::1", false)] [InlineData("2002:7f00:1::", false)] [InlineData("8.8.8.8", true)] [InlineData("2606:4700:4700::1111", true)]
    public void MetadataAddressFilterRejectsSpecialNetworks(string address, bool allowed) => Assert.Equal(allowed, CimdClient.PublicAddress(IPAddress.Parse(address)));
    [Theory]
    [InlineData("{\"x\":1,\"x\":2}")]
    [InlineData("{\"x\":\"\\u0000\"}")]
    [InlineData("{\"x\":\"\\ud800\"}")]
    public void StrictJsonRejectsAmbiguousOrInvalidUnicode(string json) => Assert.ThrowsAny<Exception>(() => Contracts.Parse(json));
}
