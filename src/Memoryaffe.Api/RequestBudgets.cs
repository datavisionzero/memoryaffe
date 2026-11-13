using Memoryaffe.Application;

// Single-instance burst limits; account login failure counters remain persistent.
public sealed class RequestBudgets
{
    private readonly Dictionary<string, Queue<DateTime>> buckets = new(StringComparer.Ordinal);
    private readonly Dictionary<string, (double Tokens, DateTime Updated)> tokens = new(StringComparer.Ordinal);
    private DateTime lastSweep = DateTime.UtcNow;
    public void Take(string key, int maximum, TimeSpan period)
    {
        lock (buckets)
        {
            var now = DateTime.UtcNow;
            if (now - lastSweep > TimeSpan.FromMinutes(5)) { foreach (var item in buckets.Where(x => x.Value.Count == 0 || x.Value.Last() < now.AddMinutes(-15)).Select(x => x.Key).ToList()) { buckets.Remove(item); tokens.Remove(item); } lastSweep = now; }
            if (!buckets.TryGetValue(key, out var queue)) { if (buckets.Count >= 10000) throw J.Fail(503, "temporarily_unavailable", "Anfragekapazität ist ausgeschöpft."); buckets[key] = queue = new Queue<DateTime>(); }
            while (queue.Count > 0 && queue.Peek() <= now - period) queue.Dequeue();
            J.Require(queue.Count < maximum, 429, "rate_limited", "Zu viele Anfragen. Bitte später erneut versuchen."); queue.Enqueue(now);
        }
    }
    public void Product(Guid actor, bool write, int multiplier)
    {
        var key = (write ? "write:" : "read:") + actor;
        Take(key, (write ? 60 : 120) * multiplier, TimeSpan.FromMinutes(1));
        lock (buckets)
        {
            var now = DateTime.UtcNow; var capacity = (write ? 10 : 20) * multiplier;
            var state = tokens.GetValueOrDefault(key, (capacity, now));
            var available = Math.Min(capacity, state.Tokens + (now - state.Updated).TotalSeconds * (write ? 1 : 2) * multiplier);
            tokens[key] = (Math.Max(0, available - 1), now);
            J.Require(available >= 1, 429, "rate_limited", "Zu viele gleichzeitige Anfragen. Bitte kurz warten.");
        }
    }
}
