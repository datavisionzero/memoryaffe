using System.Text.Json.Nodes;
using Memoryaffe.Domain;

namespace Memoryaffe.Application;

public interface IDataStore
{
    IQueryable<Account> Accounts { get; }
    IQueryable<Vault> Vaults { get; }
    IQueryable<Memory> Memories { get; }
    IQueryable<Tag> Tags { get; }
    IQueryable<MemoryVersion> Versions { get; }
    IQueryable<AgentAccess> Accesses { get; }
    IQueryable<VaultGrant> Grants { get; }
    IQueryable<Credential> Credentials { get; }
    IQueryable<WebSession> Sessions { get; }
    IQueryable<Flow> Flows { get; }
    IQueryable<RepeatResult> Repeats { get; }
    IQueryable<OAuthFamily> Families { get; }
    void Add<T>(T entity) where T : class;
    void Remove<T>(T entity) where T : class;
    Task Save(CancellationToken ct = default);
    Task<IReadOnlyList<SearchMatch>> Search(Guid owner, Guid[] vaults, string query, CancellationToken ct);
    Task Index(Memory memory, string language, CancellationToken ct);
}
public record SearchMatch(Guid Id, double Rank, int Field = 2, string? Token = null);
public interface ISecurity
{
    string HashPassword(Account account, string password);
    bool VerifyPassword(Account? account, string password);
    string Protect(string value, string purpose);
    string Unprotect(string value, string purpose);
    string Name(string value, int max);
    string NameKey(string value);
    string NewTotpSecret();
    long? VerifyTotp(string secret, string code, long after);
}
public record Actor(Account Account, AgentAccess? Access = null, Credential? Credential = null, WebSession? Session = null)
{
    public Guid Id => Access?.Id ?? Account.Id;
    public bool IsAgent => Access != null;
    public string Name => Access?.Name ?? Account.Email;
}
public sealed class ProductException(int status, string code, string message) : Exception(message)
{
    public int Status { get; } = status;
    public string Code { get; } = code;
    public bool PersistState { get; init; }
}
public record Operation(string Id, JsonObject Body, JsonObject Path, JsonObject Query, string? IdempotencyKey = null, string? Proof = null);
public record ProductOptions(string BaseUrl, string SetupSecret, bool Development = false, int TestRateMultiplier = 1);
public record BrowserResult(object Data, string? SessionToken = null, string? FlowToken = null, bool ClearSession = false, TimeSpan? SessionLifetime = null);
