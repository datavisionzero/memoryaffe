using Memoryaffe.Domain;
using Memoryaffe.Infrastructure;
using Microsoft.EntityFrameworkCore;

public sealed class Maintenance(IServiceScopeFactory scopes, ILogger<Maintenance> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope(); var db = scope.ServiceProvider.GetRequiredService<Database>(); var runtime = scope.ServiceProvider.GetRequiredService<ProductRuntime>();
                await runtime.Transaction(async () =>
                {
                    foreach (var vault in await db.Vaults.Where(x => x.ExpiresAt <= Clock.Now).ToListAsync(stoppingToken)) db.Remove(vault);
                    foreach (var memory in await db.Memories.Where(x => x.ExpiresAt <= Clock.Now).ToListAsync(stoppingToken)) db.Remove(memory);
                    foreach (var repeat in await db.Repeats.Where(x => x.ExpiresAt <= Clock.Now).ToListAsync(stoppingToken)) db.Remove(repeat);
                    foreach (var flow in await db.Flows.Where(x => x.Kind != "import" && x.ExpiresAt < Clock.Now.AddDays(-1)).ToListAsync(stoppingToken)) db.Remove(flow);
                    await db.Save(stoppingToken); await scope.ServiceProvider.GetRequiredService<ArchiveService>().Cleanup(stoppingToken); return true;
                }, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { return; }
            catch (Exception e) { log.LogWarning("Maintenance failed ({ExceptionType}); retrying next cycle.", e.GetType().Name); }
            await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
        }
    }
}
