namespace Memoryaffe.Domain;

public abstract class Entity { public Guid Id { get; set; } = Guid.NewGuid(); }
public class Account : Entity
{
    public string Email { get; set; } = "";
    public string EmailKey { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public bool IsAdmin { get; set; }
    public bool Suspended { get; set; }
    public long Revision { get; set; } = 1;
    public string Theme { get; set; } = "dark";
    public string Language { get; set; } = "de";
    public bool AllowAgentTagCreation { get; set; }
    public string? TotpSecret { get; set; }
    public long LastTotpStep { get; set; } = -1;
    public string[] RecoveryHashes { get; set; } = [];
    public DateTime CreatedAt { get; set; } = Clock.Now;
}
public class Vault : Entity
{
    public Guid OwnerId { get; set; }
    public string Name { get; set; } = "";
    public string NameKey { get; set; } = "";
    public long Revision { get; set; } = 1;
    public int VersionLimit { get; set; } = 20;
    public string SearchLanguage { get; set; } = "neutral";
    public string? PendingSearchLanguage { get; set; }
    public DateTime CreatedAt { get; set; } = Clock.Now;
    public DateTime UpdatedAt { get; set; } = Clock.Now;
    public DateTime? DeletedAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
}
public class Memory : Entity
{
    public Guid OwnerId { get; set; }
    public Guid VaultId { get; set; }
    public string Title { get; set; } = "";
    public string? Summary { get; set; }
    public string Markdown { get; set; } = "";
    public long Revision { get; set; } = 1;
    public Guid[] TagIds { get; set; } = [];
    public DateTime CreatedAt { get; set; } = Clock.Now;
    public DateTime UpdatedAt { get; set; } = Clock.Now;
    public DateTime? DeletedAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public string ActorKind { get; set; } = "user";
    public Guid ActorId { get; set; }
    public string ActorName { get; set; } = "";
    public DateTime? ImportedAt { get; set; }
}
public class Tag : Entity
{
    public Guid OwnerId { get; set; }
    public Guid VaultId { get; set; }
    public string Name { get; set; } = "";
    public string NameKey { get; set; } = "";
    public long Revision { get; set; } = 1;
}
public class MemoryVersion : Entity
{
    public Guid MemoryId { get; set; }
    public long Revision { get; set; }
    public string Title { get; set; } = "";
    public string? Summary { get; set; }
    public string Markdown { get; set; } = "";
    public string[] TagNames { get; set; } = [];
    public DateTime SavedAt { get; set; }
    public string ActorKind { get; set; } = "user";
    public Guid ActorId { get; set; }
    public string ActorName { get; set; } = "";
}
public class AgentAccess : Entity
{
    public Guid OwnerId { get; set; }
    public string Name { get; set; } = "";
    public string Kind { get; set; } = "cli";
    public long Revision { get; set; } = 1;
    public DateTime CreatedAt { get; set; } = Clock.Now;
    public DateTime? RevokedAt { get; set; }
    public DateTime? LastUsedAt { get; set; }
    public string? ClientId { get; set; }
}
public class VaultGrant : Entity
{
    public Guid OwnerId { get; set; }
    public Guid AccessId { get; set; }
    public Guid VaultId { get; set; }
    public int Level { get; set; } = 1;
}
public class Credential : Entity
{
    public Guid AccessId { get; set; }
    public string Hash { get; set; } = "";
    public DateTime CreatedAt { get; set; } = Clock.Now;
    public DateTime? ExpiresAt { get; set; }
    public DateTime? RevokedAt { get; set; }
    public DateTime? LastUsedAt { get; set; }
    public string Kind { get; set; } = "cli";
    public Guid? FamilyId { get; set; }
    public string[] Scopes { get; set; } = ["memory:read", "memory:write", "memory:delete"];
}
public class WebSession : Entity
{
    public Guid OwnerId { get; set; }
    public string Hash { get; set; } = "";
    public DateTime CreatedAt { get; set; } = Clock.Now;
    public DateTime LastActiveAt { get; set; } = Clock.Now;
    public DateTime ExpiresAt { get; set; }
    public bool Remembered { get; set; }
    public bool Revoked { get; set; }
    public string Device { get; set; } = "Browser";
}
// Purpose-specific flows use hashed bearer handles; Data never contains bearer secrets.
public class Flow : Entity
{
    public Guid? OwnerId { get; set; }
    public Guid? SessionId { get; set; }
    public string Kind { get; set; } = "";
    public string Hash { get; set; } = "";
    public string Data { get; set; } = "{}";
    public DateTime CreatedAt { get; set; } = Clock.Now;
    public DateTime ExpiresAt { get; set; }
    public bool Consumed { get; set; }
    public int Attempts { get; set; }
}
public class RepeatResult : Entity
{
    public Guid ActorId { get; set; }
    public string Key { get; set; } = "";
    public string Fingerprint { get; set; } = "";
    public Guid VaultId { get; set; }
    public Guid? MemoryId { get; set; }
    public int Level { get; set; }
    public string Result { get; set; } = "";
    public DateTime ExpiresAt { get; set; }
}
public class OAuthFamily : Entity
{
    public Guid AccessId { get; set; }
    public string ClientId { get; set; } = "";
    public string Resource { get; set; } = "";
    public string[] Scopes { get; set; } = [];
    public DateTime CreatedAt { get; set; } = Clock.Now;
    public DateTime LastUsedAt { get; set; } = Clock.Now;
    public bool Revoked { get; set; }
}
public static class Clock { public static DateTime Now { get { var value = DateTime.UtcNow; return value.AddTicks(-(value.Ticks % TimeSpan.TicksPerMillisecond)); } } }
public static class TextRules
{
    public static readonly char[] WhiteSpace = ['\u0009','\u000a','\u000b','\u000c','\u000d','\u0020','\u0085','\u00a0','\u1680','\u2000','\u2001','\u2002','\u2003','\u2004','\u2005','\u2006','\u2007','\u2008','\u2009','\u200a','\u2028','\u2029','\u202f','\u205f','\u3000'];
}
