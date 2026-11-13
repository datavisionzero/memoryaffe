using Memoryaffe.Infrastructure;
using Microsoft.EntityFrameworkCore;

// Persisted pending language plus revision markers make rebuilding restartable.
public sealed class SearchReindexer(IServiceScopeFactory scopes, ILogger<SearchReindexer> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            var worked = false;
            try
            {
                await using var scope = scopes.CreateAsyncScope(); var db = scope.ServiceProvider.GetRequiredService<Database>();
                worked = await scope.ServiceProvider.GetRequiredService<ProductRuntime>().Transaction(async () =>
                {
                    var vault = await db.Vaults.Where(x => x.PendingSearchLanguage != null && x.DeletedAt == null).OrderBy(x => x.Id).FirstOrDefaultAsync(ct); if (vault == null) return false;
                    var language = vault.PendingSearchLanguage!;
                    var stale = await db.Memories.Where(m => m.VaultId == vault.Id && !db.SearchSegments.Any(s => s.MemoryId == m.Id && s.Language == language && s.Field == -1 && s.SourceRevision == m.Revision)).OrderBy(x => x.Id).FirstOrDefaultAsync(ct);
                    if (stale != null) await db.Index(stale, language, ct);
                    else
                    {
                        vault.SearchLanguage = language; vault.PendingSearchLanguage = null;
                        var ids = db.Memories.Where(x => x.VaultId == vault.Id).Select(x => x.Id).ToArray();
                        foreach (var old in await db.SearchSegments.Where(x => ids.Contains(x.MemoryId) && x.Language != language).ToListAsync(ct)) db.Remove(old);
                    }
                    return true;
                }, ct);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { return; }
            catch (Exception e) { log.LogWarning("Search rebuild failed ({ExceptionType}); will retry.", e.GetType().Name); }
            await Task.Delay(worked ? TimeSpan.FromMilliseconds(50) : TimeSpan.FromSeconds(1), ct);
        }
    }
}
