import { randomUUID } from 'node:crypto';

// Expected values follow SEARCH_UNICODE.md; no search implementation is reused.
export async function runSearch({ owner, other, check, same, expect, nonce, processRun }) {
  const vault = async (suffix, language) => owner.ok('POST', '/api/v1/vaults', { name: `Search ${nonce} ${suffix}`, searchLanguage: language, versionLimit: 20 });
  const A = await vault('neutral', 'neutral'), B = await vault('de', 'de'), C = await vault('en', 'en');
  const D = await other.ok('POST', '/api/v1/vaults', { name: `Search foreign ${nonce}`, searchLanguage: 'neutral', versionLimit: 20 });
  const create = (vault, title, markdown = '', summary, tagIds, browser = owner) => browser.ok('POST', '/api/v1/memories', { vaultId: vault.id, title, markdown, ...(summary !== undefined ? { summary } : {}), ...(tagIds ? { tagIds } : {}) });
  const search = (vault, query, extra = {}, browser = owner) => browser.ok('POST', '/api/v1/memories/search', { ...(vault ? { vaultId: vault.id } : { allVaults: true }), query, pageSize: 100, ...extra });
  const ids = result => result.items.map(x => x.id);
  const has = async (vault, query, yes, no = [], extra = {}) => { const result = await search(vault, query, extra); for (const row of yes) check(ids(result).includes(row.id), `Search missing expected result: ${query}`); for (const row of no) check(!ids(result).includes(row.id), `Search returned forbidden result: ${query}`); check(result.items.every(m => typeof m.snippet === 'string' && [...m.snippet].length <= 320 && !('markdown' in m)), 'Search snippet is unsafe or too long'); return result; };
  const cross = await create(A, 'alpha', 'beta');
  const alpha = await create(A, 'alpha');
  const phrase = await create(A, 'Phrase', 'alpha beta');
  const boundary = await create(A, 'alpha', '', 'beta');
  const beta = await create(A, 'beta');
  const neutralCats = await create(A, 'neutral', 'cats');
  const englishCats = await create(C, 'English', 'cats');
  const germanHouses = await create(B, 'Deutsch', 'Häuser');
  const accent = await create(A, 'Akzente', 'für');
  const stop = await create(C, 'Stopword', 'the');
  const foreign = await create(D, 'alpha', 'alpha beta privateforeignmarker', undefined, undefined, other);
  await has(A, 'alpha beta', [cross, phrase, boundary], [alpha, beta]);
  await has(A, '"alpha beta"', [phrase], [cross, boundary]);
  await has(A, 'alpha OR beta', [cross, alpha, phrase, boundary, beta]);
  await has(A, 'alpha -beta', [alpha], [cross, phrase, boundary]);
  await has(A, '-beta', [alpha], [cross, phrase, boundary, beta]);
  await has(A, 'cat', [], [neutralCats]); await has(C, 'cat', [englishCats]); await has(B, 'Haus', [germanHouses]); await has(A, 'fur', [], [accent]);
  const stops = await search(C, 'the'); check(stops.items.length === 0, 'Stopword-only query returned content');
  const all = await search(null, 'alpha'); check(!ids(all).includes(foreign.id) && all.items.every(m => !m.snippet.includes('privateforeignmarker')), 'Cross-account search leaked content');
  expect(await other.request('POST', '/api/v1/memories/search', { vaultId: A.id, query: 'alpha' }), 404, 'not_found');
  const old = await create(A, 'history', 'historyonlymarker'); await owner.ok('PATCH', `/api/v1/memories/${old.id}`, { expectedRevision: old.revision, markdown: 'currentonlymarker' });
  await has(A, 'historyonlymarker', [], [old]); await has(A, 'currentonlymarker', [old]);
  const trash = await create(A, 'trash', 'trashonlymarker'); await owner.ok('DELETE', `/api/v1/memories/${trash.id}?expectedRevision=${trash.revision}`); await has(A, 'trashonlymarker', [], [trash]);
  const t1 = await owner.ok('POST', `/api/v1/vaults/${A.id}/tags`, { name: `Same ${nonce}` }), t2 = await owner.ok('POST', `/api/v1/vaults/${A.id}/tags`, { name: `Other ${nonce}` }), tb = await owner.ok('POST', `/api/v1/vaults/${B.id}/tags`, { name: `Same ${nonce}` });
  const tagged = await create(A, 'Tagged', 'tagfiltermarker', undefined, [t1.id]), taggedB = await create(B, 'Tagged B', 'tagfiltermarker', undefined, [tb.id]);
  await has(A, 'tagfiltermarker', [], [tagged], { tagIds: [t1.id, t2.id], tagMatch: 'all' }); await has(A, 'tagfiltermarker', [tagged], [], { tagIds: [t1.id, t2.id], tagMatch: 'any' });
  const concreteIds = await search(null, 'tagfiltermarker', { tagIds: [t1.id], tagMatch: 'all' }); check(ids(concreteIds).includes(tagged.id) && !ids(concreteIds).includes(taggedB.id), 'Same tag name was mapped across vaults');
  const ranking = await vault('ranking', 'neutral'); const titleRank = await create(ranking, 'rankmarker', 'other'), summaryRank = await create(ranking, 'other', 'other', 'rankmarker'), bodyRank = await create(ranking, 'other', 'rankmarker');
  const ranked = await search(ranking, 'rankmarker'); same(ids(ranked), [titleRank.id, summaryRank.id, bodyRank.id], 'Search ranking weights are wrong');
  const latest = await search(ranking, ''); same(ids(latest), [bodyRank.id, summaryRank.id, titleRank.id], 'Empty query is not latest-first');
  // Distances and occurrences exceed PostgreSQL's single-tsvector position caps.
  const distant = await create(A, 'Distant', 'filler '.repeat(20050) + 'distantmarker'); await has(A, 'distantmarker', [distant]);
  const frequent = await create(A, 'Frequent', 'echo '.repeat(350) + 'echo phrasetail'); await has(A, '"echo phrasetail"', [frequent]);
  const segment = await create(A, 'Segment', 'filler '.repeat(1023) + 'segmentleft segmentright'); await has(A, '"segmentleft segmentright"', [segment]);
  const suffix = ' largeendmarker', count = Math.floor((1048576 - suffix.length) / 7), giant = 'normal '.repeat(count) + ' '.repeat(1048576 - suffix.length - count * 7) + suffix;
  check(Buffer.byteLength(giant) === 1048576, 'Invalid 1MiB test fixture'); const large = await create(A, 'Large', giant); const read = await owner.ok('GET', `/api/v1/memories/${large.id}`); same(read.markdown, giant, '1MiB Markdown was truncated'); await has(A, 'largeendmarker', [large]);
  const language = await vault('language-change', 'neutral'), cats = await create(language, 'Language cats', 'cats'); await has(language, 'cat', [], [cats]);
  const before = await owner.ok('GET', `/api/v1/vaults/${language.id}`);
  const outcomes = await Promise.all([owner.ok('PATCH', `/api/v1/vaults/${language.id}`, { expectedRevision: before.revision, searchLanguage: 'en' }), create(language, 'Concurrent cats', 'cats')]);
  const concurrent = outcomes[1]; let switched;
  if (outcomes[0].pendingSearchLanguage) check(outcomes[0].searchLanguage === 'neutral' && outcomes[0].pendingSearchLanguage === 'en', 'Pending reindex exposed target language before atomic switch');
  for (let i = 0; i < 100; i++) { switched = await owner.ok('GET', `/api/v1/vaults/${language.id}`); if (switched.searchLanguage === 'en' && !switched.pendingSearchLanguage) break; check(switched.searchLanguage === 'neutral' && switched.pendingSearchLanguage === 'en', 'Pending reindex changed active language'); const during = await search(language, 'cat'); const afterQuery = await owner.ok('GET', '/api/v1/vaults/' + language.id); if (afterQuery.pendingSearchLanguage === 'en') check(!ids(during).includes(cats.id), 'Pending generation leaked into active search'); await new Promise(r => setTimeout(r, 100)); }
  check(switched.searchLanguage === 'en' && !switched.pendingSearchLanguage, 'Search-language switch did not complete'); await has(language, 'cat', [cats, concurrent]);
  const original = await owner.ok('GET', `/api/v1/memories/${cats.id}`); check(original.revision === cats.revision, 'Reindex changed content revision');
  // Name equality/normalization fixtures exercise the actual unique DB indexes.
  const names = await vault('names', 'neutral');
  const nameTag = name => owner.request('POST', `/api/v1/vaults/${names.id}/tags`, { name });
  for (const [firstName, alias] of [[' Projekt ', 'projekt'], ['Straße', 'STRASSE'], ['Café', 'Cafe\u0301'], ['Σ', 'ς']]) { const first = await nameTag(firstName); expect(first, 201); expect(await nameTag(alias), 409, 'name_conflict'); }
  for (const name of ['für', 'fur', 'İ', 'i', 'ı', '\u200bName']) expect(await nameTag(name), 201);
  const nbsp = await nameTag('\u00a0Name\u00a0'); expect(nbsp, 201); check(nbsp.data.name === 'Name', 'NBSP trimming is wrong');
  for (const name of ['\u00a0\u2009 ', '\ud800', '\u0000']) expect(await nameTag(name), 400, 'validation_failed');
  // A title-only match must choose a matching accessible field for its snippet.
  const titleSnippet = await create(A, 'uniquetitlesnippetmarker', 'unrelated body'); const snippetResult = await has(A, 'uniquetitlesnippetmarker', [titleSnippet]); check(snippetResult.items.find(m => m.id === titleSnippet.id).snippet.includes('uniquetitlesnippetmarker'), 'Title-only match snippet omitted its matching field');
  let fixedTimestampUuidTie = 'not executed: MEMORYAFFE_TEST_DATABASE_PASSWORD missing';
  if (process.env.MEMORYAFFE_TEST_DATABASE_PASSWORD) {
    const ties = await vault('fixed-time-tie', 'neutral'), left = await create(ties, 'tiemarker', 'identical'), right = await create(ties, 'tiemarker', 'identical');
    for (const id of [ties.id, left.id, right.id]) check(/^[a-f0-9-]{36}$/.test(id), 'Unsafe fixture ID');
    const sql = `UPDATE "Memories" SET "UpdatedAt"='2020-01-01T00:00:00.000Z'::timestamptz WHERE "Id" IN ('${left.id}','${right.id}') AND "VaultId"='${ties.id}';`;
    const patched = await processRun(process.env.MEMORYAFFE_TEST_DOCKER ?? 'docker', ['exec', '-e', 'PGPASSWORD', 'memoryaffe-dev-pg', 'psql', '-U', 'memoryaffe', '-d', process.env.MEMORYAFFE_TEST_DATABASE_NAME ?? 'memoryaffe', '-v', 'ON_ERROR_STOP=1', '-c', sql], { env: { ...process.env, PGPASSWORD: process.env.MEMORYAFFE_TEST_DATABASE_PASSWORD } });
    check(patched.code === 0 && patched.stdout.includes('UPDATE 2'), 'Controlled PostgreSQL tie fixture update failed');
    const expected = [left.id, right.id].sort(); same(ids(await search(ties, 'tiemarker')), expected, 'Equal-rank/time search is not UUID ascending'); same(ids(await search(ties, '', { sort: 'updatedAt' })), expected, 'Equal-time updatedAt search is not UUID ascending'); fixedTimestampUuidTie = 'executed against dedicated PostgreSQL fixture';
  }
  return { fixtures: 'API-generated IDs, two controlled equal timestamps', fixedTimestampUuidTie };
}
