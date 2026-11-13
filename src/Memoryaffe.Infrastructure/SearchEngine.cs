using System.Data;
using System.Globalization;
using System.Text;
using Memoryaffe.Application;
using Memoryaffe.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Npgsql;

namespace Memoryaffe.Infrastructure;

internal static class SearchEngine
{
    private static string Config(string language) => language switch { "de" => "pg_catalog.german", "en" => "pg_catalog.english", _ => "pg_catalog.simple" };
    public static async Task Index(Database db, Memory memory, string language, CancellationToken ct)
    {
        foreach (var old in db.SearchSegments.Where(x => x.MemoryId == memory.Id && x.Language == language)) db.Remove(old);
        db.Add(new SearchSegment { MemoryId = memory.Id, Language = language, SourceRevision = memory.Revision, Field = -1 });
        var texts = new[] { memory.Title, memory.Summary ?? "", memory.Markdown };
        for (var field = 0; field < texts.Length; field++)
        {
            var segments = new List<SearchSegment>(); var segment = new SearchSegment { MemoryId = memory.Id, Field = field }; var words = new List<string>(); var positions = new List<int>(); var position = 0;
            await using var command = Command(db, "SELECT lexemes, cardinality(dictionaries) > 0 FROM ts_debug(@config::regconfig,@text)");
            command.Parameters.AddWithValue("config", Config(language)); command.Parameters.AddWithValue("text", texts[field]);
            await using var reader = await command.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                if (!reader.GetBoolean(1)) continue;
                position++; if (reader.IsDBNull(0)) continue;
                foreach (var lexeme in reader.GetFieldValue<string[]>(0)) { words.Add(lexeme); positions.Add(position); }
                if (words.Count >= 1024) { segment.Lexemes = words.ToArray(); segment.Positions = positions.ToArray(); segments.Add(segment); segment = new SearchSegment { MemoryId = memory.Id, Field = field }; words.Clear(); positions.Clear(); }
            }
            if (words.Count > 0) { segment.Lexemes = words.ToArray(); segment.Positions = positions.ToArray(); segments.Add(segment); }
            foreach (var item in segments) { item.Language = language; item.SourceRevision = memory.Revision; db.Add(item); }
        }
    }
    public static async Task<IReadOnlyList<SearchMatch>> Search(Database db, Guid owner, Guid[] vaults, string query, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(query) || vaults.Length == 0) return [];
        var results = new List<SearchMatch>();
        foreach (var vault in db.Vaults.Where(x => x.OwnerId == owner && vaults.Contains(x.Id)).ToList())
        {
            await using var command = Command(db, "SELECT websearch_to_tsquery(@config::regconfig,@query)::text"); command.CommandTimeout = 5;
            command.Parameters.AddWithValue("config", Config(vault.SearchLanguage)); command.Parameters.AddWithValue("query", query);
            var text = (string)(await command.ExecuteScalarAsync(ct))!; if (text.Length == 0) continue;
            var root = new QueryParser(text).Parse(); var terms = new HashSet<string>(); root.PositiveTerms(terms, false);
            var ids = db.Memories.Where(x => x.OwnerId == owner && x.VaultId == vault.Id && x.DeletedAt == null).Select(x => x.Id).ToArray();
            // Lexical segments retain absolute field positions; no tsvector position/occurrence truncation.
            var segments = await db.SearchSegments.Where(x => ids.Contains(x.MemoryId) && x.Language == vault.SearchLanguage).ToListAsync(ct);
            foreach (var id in ids)
            {
                var postings = new Dictionary<string, HashSet<Position>>(StringComparer.Ordinal); var lengths = new int[3];
                foreach (var s in segments.Where(x => x.MemoryId == id)) for (var i = 0; i < s.Lexemes.Length; i++) { if (!postings.TryGetValue(s.Lexemes[i], out var list)) postings[s.Lexemes[i]] = list = []; list.Add(new Position(s.Field, s.Positions[i])); lengths[s.Field]++; }
                if (!root.Evaluate(postings).Matches) continue;
                var rank = 0d; foreach (var term in terms) if (postings.TryGetValue(term, out var occurrences)) foreach (var field in occurrences.Select(x => x.Field).Distinct()) rank += new[] { 1.0, 0.4, 0.1 }[field] / (1 + Math.Log(1 + lengths[field]));
                var matchField = terms.Where(postings.ContainsKey).SelectMany(t => postings[t]).Select(x => x.Field).DefaultIfEmpty(2).Min();
                var memory = db.Memories.Single(x => x.Id == id); var source = matchField == 0 ? memory.Title : matchField == 1 ? memory.Summary ?? "" : memory.Markdown;
                await using var snippetCommand = Command(db, "SELECT token FROM ts_debug(@config::regconfig,@text) WHERE lexemes && @terms LIMIT 1");
                snippetCommand.Parameters.AddWithValue("config", Config(vault.SearchLanguage)); snippetCommand.Parameters.AddWithValue("text", source); snippetCommand.Parameters.AddWithValue("terms", terms.ToArray());
                var token = await snippetCommand.ExecuteScalarAsync(ct) as string;
                results.Add(new SearchMatch(id, rank, matchField, token));
            }
        }
        return results;
    }
    private static NpgsqlCommand Command(Database db, string sql)
    {
        var connection = (NpgsqlConnection)db.Database.GetDbConnection(); if (connection.State != ConnectionState.Open) connection.Open();
        return new NpgsqlCommand(sql, connection, (NpgsqlTransaction?)db.Database.CurrentTransaction?.GetDbTransaction());
    }
    private record struct Position(int Field, int Offset);
    private record Evaluation(bool Matches, HashSet<Position> Positions);
    private record QueryNode(string Op, string? Term = null, QueryNode? Left = null, QueryNode? Right = null, int Distance = 1)
    {
        public Evaluation Evaluate(Dictionary<string, HashSet<Position>> postings)
        {
            if (Op == "term") { var positions = postings.GetValueOrDefault(Term!, []); return new(positions.Count > 0, positions); }
            var left = Left!.Evaluate(postings); if (Op == "!") return new(!left.Matches, []);
            var right = Right!.Evaluate(postings);
            if (Op == "&") return new(left.Matches && right.Matches, left.Positions.Union(right.Positions).ToHashSet());
            if (Op == "|") return new(left.Matches || right.Matches, left.Positions.Union(right.Positions).ToHashSet());
            var matches = right.Positions.Where(p => left.Positions.Contains(new Position(p.Field, p.Offset - Distance))).ToHashSet(); return new(matches.Count > 0, matches);
        }
        public void PositiveTerms(HashSet<string> terms, bool negative) { if (Op == "term") { if (!negative) terms.Add(Term!); return; } Left!.PositiveTerms(terms, Op == "!" ? !negative : negative); Right?.PositiveTerms(terms, negative); }
    }
    private sealed class QueryParser(string input)
    {
        private int index;
        public QueryNode Parse() => Or();
        private QueryNode Or() { var n = And(); while (Eat('|')) n = new("|", Left: n, Right: And()); return n; }
        private QueryNode And() { var n = Phrase(); while (Eat('&')) n = new("&", Left: n, Right: Phrase()); return n; }
        private QueryNode Phrase() { var n = Atom(); while (Eat('<')) { var start = index; while (index < input.Length && input[index] != '>') index++; var distance = input[start..index] == "-" ? 1 : int.Parse(input[start..index], CultureInfo.InvariantCulture); index++; n = new("phrase", Left: n, Right: Atom(), Distance: distance); } return n; }
        private QueryNode Atom()
        {
            if (Eat('!')) return new("!", Left: Atom());
            if (Eat('(')) { var n = Or(); if (!Eat(')')) throw new FormatException("tsquery"); return n; }
            if (!Eat('\'')) throw new FormatException("tsquery term"); var word = new StringBuilder();
            while (index < input.Length) { var c = input[index++]; if (c == '\\' && index < input.Length) word.Append(input[index++]); else if (c == '\'') { if (index < input.Length && input[index] == '\'') { word.Append('\''); index++; } else break; } else word.Append(c); }
            return new("term", word.ToString());
        }
        private bool Eat(char c) { while (index < input.Length && char.IsWhiteSpace(input[index])) index++; if (index >= input.Length || input[index] != c) return false; index++; return true; }
    }
}
