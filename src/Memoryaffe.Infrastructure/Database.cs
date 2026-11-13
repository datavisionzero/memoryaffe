using Memoryaffe.Application;
using Memoryaffe.Domain;
using Microsoft.EntityFrameworkCore;

namespace Memoryaffe.Infrastructure;

public class Database(DbContextOptions<Database> options) : DbContext(options), IDataStore
{
    public DbSet<Account> Accounts => Set<Account>();
    public DbSet<Vault> Vaults => Set<Vault>();
    public DbSet<Memory> Memories => Set<Memory>();
    public DbSet<Tag> Tags => Set<Tag>();
    public DbSet<MemoryVersion> Versions => Set<MemoryVersion>();
    public DbSet<AgentAccess> Accesses => Set<AgentAccess>();
    public DbSet<VaultGrant> Grants => Set<VaultGrant>();
    public DbSet<Credential> Credentials => Set<Credential>();
    public DbSet<WebSession> Sessions => Set<WebSession>();
    public DbSet<Flow> Flows => Set<Flow>();
    public DbSet<RepeatResult> Repeats => Set<RepeatResult>();
    public DbSet<OAuthFamily> Families => Set<OAuthFamily>();
    public DbSet<SearchSegment> SearchSegments => Set<SearchSegment>();
    IQueryable<Account> IDataStore.Accounts => Accounts;
    IQueryable<Vault> IDataStore.Vaults => Vaults;
    IQueryable<Memory> IDataStore.Memories => Memories;
    IQueryable<Tag> IDataStore.Tags => Tags;
    IQueryable<MemoryVersion> IDataStore.Versions => Versions;
    IQueryable<AgentAccess> IDataStore.Accesses => Accesses;
    IQueryable<VaultGrant> IDataStore.Grants => Grants;
    IQueryable<Credential> IDataStore.Credentials => Credentials;
    IQueryable<WebSession> IDataStore.Sessions => Sessions;
    IQueryable<Flow> IDataStore.Flows => Flows;
    IQueryable<RepeatResult> IDataStore.Repeats => Repeats;
    IQueryable<OAuthFamily> IDataStore.Families => Families;
    void IDataStore.Add<T>(T entity) => Add(entity);
    void IDataStore.Remove<T>(T entity) => Remove(entity);
    public async Task Save(CancellationToken ct = default) => await SaveChangesAsync(ct);

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Account>().HasIndex(x => x.EmailKey).IsUnique();
        b.Entity<Vault>().HasAlternateKey(x => new { x.Id, x.OwnerId });
        b.Entity<Vault>().HasIndex(x => new { x.OwnerId, x.NameKey }).IsUnique();
        b.Entity<Vault>().HasOne<Account>().WithMany().HasForeignKey(x => x.OwnerId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<Memory>().HasOne<Vault>().WithMany().HasForeignKey(x => new { x.VaultId, x.OwnerId }).HasPrincipalKey(x => new { x.Id, x.OwnerId }).OnDelete(DeleteBehavior.Cascade);
        b.Entity<Tag>().HasOne<Vault>().WithMany().HasForeignKey(x => new { x.VaultId, x.OwnerId }).HasPrincipalKey(x => new { x.Id, x.OwnerId }).OnDelete(DeleteBehavior.Cascade);
        b.Entity<Tag>().HasIndex(x => new { x.VaultId, x.NameKey }).IsUnique();
        b.Entity<MemoryVersion>().HasOne<Memory>().WithMany().HasForeignKey(x => x.MemoryId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<MemoryVersion>().HasIndex(x => new { x.MemoryId, x.Revision }).IsUnique();
        b.Entity<AgentAccess>().HasAlternateKey(x => new { x.Id, x.OwnerId });
        b.Entity<AgentAccess>().HasOne<Account>().WithMany().HasForeignKey(x => x.OwnerId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<VaultGrant>().HasOne<AgentAccess>().WithMany().HasForeignKey(x => new { x.AccessId, x.OwnerId }).HasPrincipalKey(x => new { x.Id, x.OwnerId }).OnDelete(DeleteBehavior.Cascade);
        b.Entity<VaultGrant>().HasOne<Vault>().WithMany().HasForeignKey(x => new { x.VaultId, x.OwnerId }).HasPrincipalKey(x => new { x.Id, x.OwnerId }).OnDelete(DeleteBehavior.Cascade);
        b.Entity<VaultGrant>().HasIndex(x => new { x.AccessId, x.VaultId }).IsUnique();
        b.Entity<Credential>().HasOne<AgentAccess>().WithMany().HasForeignKey(x => x.AccessId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<Credential>().HasIndex(x => x.Hash).IsUnique();
        b.Entity<WebSession>().HasOne<Account>().WithMany().HasForeignKey(x => x.OwnerId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<WebSession>().HasIndex(x => x.Hash).IsUnique();
        b.Entity<RepeatResult>().HasIndex(x => new { x.ActorId, x.Key }).IsUnique();
        b.Entity<Flow>().HasIndex(x => new { x.Kind, x.Hash });
        b.Entity<OAuthFamily>().HasOne<AgentAccess>().WithMany().HasForeignKey(x => x.AccessId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<SearchSegment>().HasOne<Memory>().WithMany().HasForeignKey(x => x.MemoryId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<SearchSegment>().HasIndex(x => x.Lexemes).HasMethod("gin");
        b.Entity<Vault>().ToTable(t => t.HasCheckConstraint("CK_Vault_Settings", "\"VersionLimit\" BETWEEN 0 AND 100 AND \"SearchLanguage\" IN ('neutral','de','en') AND \"Revision\" > 0"));
        b.Entity<Memory>().ToTable(t => t.HasCheckConstraint("CK_Memory_Limits", "\"Revision\" > 0 AND char_length(\"Title\") BETWEEN 1 AND 200 AND char_length(\"Summary\") <= 1000 AND octet_length(\"Markdown\") <= 1048576 AND cardinality(\"TagIds\") <= 50"));
        b.Entity<Tag>().ToTable(t => t.HasCheckConstraint("CK_Tag_Limits", "\"Revision\" > 0 AND char_length(\"Name\") BETWEEN 1 AND 50"));
        b.Entity<VaultGrant>().ToTable(t => t.HasCheckConstraint("CK_Grant_Level", "\"Level\" BETWEEN 1 AND 3"));
        foreach (var t in b.Model.GetEntityTypes())
        {
            foreach (var p in t.GetProperties().Where(x => x.Name is "NameKey" or "EmailKey")) p.SetCollation("C");
            foreach (var p in t.GetProperties().Where(x => x.Name == "Revision")) p.IsConcurrencyToken = true;
        }
    }

    public Task<IReadOnlyList<SearchMatch>> Search(Guid owner, Guid[] vaults, string query, CancellationToken ct) => SearchEngine.Search(this, owner, vaults, query, ct);
    public async Task Index(Memory memory, string language, CancellationToken ct)
    {
        await SearchEngine.Index(this, memory, language, ct);
        var pending = Vaults.Single(x => x.Id == memory.VaultId).PendingSearchLanguage;
        if (pending != null && pending != language) await SearchEngine.Index(this, memory, pending, ct);
    }
}
public class SearchSegment : Entity
{
    public Guid MemoryId { get; set; }
    public string Language { get; set; } = "neutral";
    public long SourceRevision { get; set; }
    public int Field { get; set; }
    public string[] Lexemes { get; set; } = [];
    public int[] Positions { get; set; } = [];
}
