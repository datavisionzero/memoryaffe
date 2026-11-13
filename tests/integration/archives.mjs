import { randomUUID } from 'node:crypto';
import { deflateRawSync, inflateRawSync } from 'node:zlib';

const table = Array.from({ length: 256 }, (_, n) => { for (let i = 0; i < 8; i++) n = (n >>> 1) ^ (n & 1 ? 0xedb88320 : 0); return n >>> 0; });
function crc32(b) { let n = 0xffffffff; for (const c of b) n = (n >>> 8) ^ table[(n ^ c) & 255]; return (~n) >>> 0; }
// Independent ZIP fixture encoder: no application archive code is reused.
function zip(entries) {
  const chunks = [], central = []; let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name), data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data), packed = entry.deflate ? deflateRawSync(data) : data, method = entry.deflate ? 8 : 0;
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(entry.flags ?? 0x800, 6); local.writeUInt16LE(method, 8); local.writeUInt32LE(entry.crc ?? crc32(data), 14); local.writeUInt32LE(packed.length, 18); local.writeUInt32LE(entry.length ?? data.length, 22); local.writeUInt16LE(name.length, 26);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50); c.writeUInt16LE(0x314, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(entry.flags ?? 0x800, 8); c.writeUInt16LE(method, 10); c.writeUInt32LE(entry.crc ?? crc32(data), 16); c.writeUInt32LE(packed.length, 20); c.writeUInt32LE(entry.length ?? data.length, 24); c.writeUInt16LE(name.length, 28); c.writeUInt32LE((entry.attrs ?? 0x81a40000) >>> 0, 38); c.writeUInt32LE(offset, 42);
    chunks.push(local, name, packed); central.push(c, name); offset += local.length + name.length + packed.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16); return Buffer.concat([...chunks, directory, end]);
}
function unzip(buffer) {
  const files = new Map(); let end = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) if (buffer.readUInt32LE(i) === 0x06054b50) { end = i; break; }
  if (end < 0) throw new Error('Export has no ZIP directory'); let at = buffer.readUInt32LE(end + 16), count = buffer.readUInt16LE(end + 10);
  for (let i = 0; i < count; i++) { if (buffer.readUInt32LE(at) !== 0x02014b50) throw new Error('Invalid export ZIP directory'); const method = buffer.readUInt16LE(at + 10), size = buffer.readUInt32LE(at + 20), nameLength = buffer.readUInt16LE(at + 28), extra = buffer.readUInt16LE(at + 30), comment = buffer.readUInt16LE(at + 32), local = buffer.readUInt32LE(at + 42); const name = buffer.subarray(at + 46, at + 46 + nameLength).toString('utf8'), start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28), packed = buffer.subarray(start, start + size), data = method === 8 ? inflateRawSync(packed) : packed; if (crc32(data) !== buffer.readUInt32LE(at + 16)) throw new Error('Export CRC mismatch'); files.set(name, data); at += 46 + nameLength + extra + comment; }
  return files;
}

export async function runArchives({ owner, other, base, check, same, expect, nonce }) {
  const raw = async (browser, method, path, body, extra = {}) => { const headers = { Origin: base, ...extra }; if (browser.cookies.size) headers.Cookie = [...browser.cookies].map(([k, v]) => `${k}=${v}`).join('; '); if (browser.csrf && method !== 'GET') headers['X-CSRF-Token'] = browser.csrf; return fetch(base + path, { method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(120000) }); };
  const upload = async (buffer, browser = owner) => { const form = new FormData(); form.set('archive', new Blob([buffer], { type: 'application/zip' }), 'archive.zip'); const r = await raw(browser, 'POST', '/api/v1/imports/validate', form); let data; try { data = await r.json(); } catch { throw new Error('Import returned non-JSON response'); } return { status: r.status, data, headers: r.headers }; };
  const source = await owner.ok('POST', '/api/v1/vaults', { name: `Archive source ${nonce}`, searchLanguage: 'de', versionLimit: 7 });
  const tag = await owner.ok('POST', `/api/v1/vaults/${source.id}/tags`, { name: 'Straße α' });
  const markdown = '# Archiv\r\n\r\nGrüße α😀\r\n';
  const first = await owner.ok('POST', '/api/v1/memories', { vaultId: source.id, title: 'Archiv Eins', summary: 'Unveränderte Summary\nα', markdown, tagIds: [tag.id] });
  await owner.ok('PATCH', `/api/v1/memories/${first.id}`, { expectedRevision: first.revision, title: 'Archiv Eins geändert' });
  const full = await owner.ok('GET', `/api/v1/memories/${first.id}`);
  const second = await owner.ok('POST', '/api/v1/memories', { vaultId: source.id, title: 'Leer', markdown: '' });
  const deleted = await owner.ok('POST', '/api/v1/memories', { vaultId: source.id, title: 'Nicht exportieren', markdown: 'trash only' });
  await owner.ok('DELETE', `/api/v1/memories/${deleted.id}?expectedRevision=${deleted.revision}`);
  const exportResponse = await raw(owner, 'GET', `/api/v1/vaults/${source.id}/export`); check(exportResponse.status === 200 && exportResponse.headers.get('content-type')?.includes('application/zip'), 'Export did not return ZIP');
  const exported = Buffer.from(await exportResponse.arrayBuffer()), files = unzip(exported), manifest = JSON.parse(files.get('manifest.json').toString('utf8'));
  check(manifest.formatVersion === 1 && manifest.records.length === 2 && manifest.tags.length === 1 && files.size === 3, 'Export included trash/history or omitted active data');
  same(files.get(`records/${first.id}.md`).toString('utf8'), markdown, 'Export changed Markdown bytes'); same(files.get(`records/${second.id}.md`).length, 0, 'Export omitted empty Markdown');
  check(manifest.vault.versionLimit === 7 && manifest.vault.searchLanguage === 'de', 'Export lost vault settings');
  console.log('CHECK ZIP export bytes/CRC/settings passed; checking foreign export rejection');
  const denied = await raw(other, 'GET', `/api/v1/vaults/${source.id}/export`); expect({ status: denied.status, data: await denied.json() }, 404, 'not_found');
  let preparation = await upload(exported); expect(preparation, 201); check(preparation.data.recordCount === 2 && preparation.data.tagCount === 1, 'Import preview counts differ'); const readyId = preparation.data.id;
  expect(await other.request('GET', `/api/v1/imports/${readyId}`), 404, 'not_found'); expect(await other.request('DELETE', `/api/v1/imports/${readyId}`), 404, 'not_found');
  const fixtureManifest = structuredClone(manifest), originalEntries = [...files].map(([name, data]) => ({ name, data }));
  const pack = (m, additions = [], markdownOverride) => zip([{ name: 'manifest.json', data: typeof m === 'string' ? m : JSON.stringify(m), deflate: true }, ...originalEntries.filter(e => e.name !== 'manifest.json').map((e, i) => ({ ...e, data: i === 0 && markdownOverride !== undefined ? markdownOverride : e.data, deflate: true })), ...additions]);
  const attacks = [
    ['missing manifest', zip(originalEntries.filter(e => e.name !== 'manifest.json'))],
    ['duplicate filename', zip([...originalEntries, originalEntries[1]])],
    ['path traversal', pack(fixtureManifest, [{ name: '../outside.md', data: '' }])],
    ['absolute path', pack(fixtureManifest, [{ name: '/outside.md', data: '' }])],
    ['unexpected file', pack(fixtureManifest, [{ name: 'extra.txt', data: '' }])],
    ['missing Markdown', zip(originalEntries.filter((_, i) => i !== 1))],
    ['unsupported format', pack({ ...fixtureManifest, formatVersion: 2 })],
    ['duplicate JSON key', pack(JSON.stringify(fixtureManifest).replace('"formatVersion":1', '"formatVersion":1,"formatVersion":1'))],
    ['unknown manifest property', pack({ ...fixtureManifest, unknown: true })],
    ['invalid UTF-8 Markdown', pack(fixtureManifest, [], Buffer.from([0xff]))],
    ['NUL Markdown', pack(fixtureManifest, [], Buffer.from('a\0b'))],
    ['invalid CRC', zip(originalEntries.map((e, i) => i === 1 ? { ...e, crc: 1 } : e))],
    ['symlink', zip(originalEntries.map((e, i) => i === 1 ? { ...e, attrs: 0xa1ff0000 } : e))],
    ['encrypted flag', zip(originalEntries.map((e, i) => i === 1 ? { ...e, flags: 0x801 } : e))],
    ['expanded budget', zip(originalEntries.map((e, i) => i === 1 ? { ...e, length: 501 * 1024 * 1024 } : e))],
    ['uppercase duplicate record ID', pack({ ...fixtureManifest, records: [...fixtureManifest.records, { ...fixtureManifest.records[0], id: fixtureManifest.records[0].id.toUpperCase() }] })],
    ['unknown tag reference', pack({ ...fixtureManifest, records: fixtureManifest.records.map((r, i) => i === 0 ? { ...r, tagIds: [randomUUID()] } : r) })],
    ['duplicate casefold tag name', pack({ ...fixtureManifest, tags: [...fixtureManifest.tags, { id: randomUUID(), name: 'STRASSE α' }] })],
    ['isolated surrogate title', pack({ ...fixtureManifest, records: fixtureManifest.records.map((r, i) => i === 0 ? { ...r, title: '\ud800' } : r) })],
    ['NUL vault name', pack({ ...fixtureManifest, vault: { ...fixtureManifest.vault, name: 'bad\0name' } })],
  ];
  for (const [label, archive] of attacks) { const r = await upload(archive); check(r.status === 400 && r.data?.code === 'validation_failed', `Unsafe ZIP accepted or wrong error: ${label} (HTTP ${r.status}, ${r.data?.code ?? 'no code'})`); }
  const retained = await owner.ok('GET', `/api/v1/imports/${readyId}`); check(retained.state === 'ready', 'Failed upload invalidated previous preparation');
  preparation = await upload(exported); expect(preparation, 201); const id = preparation.data.id; expect(await owner.request('GET', `/api/v1/imports/${readyId}`), 410, 'import_expired');
  const body = { preparationId: id, targetName: `Archive roundtrip ${nonce}` }, key = randomUUID();
  expect(await owner.request('POST', '/api/v1/imports', body), 400, 'validation_failed');
  const committed = await Promise.all([key, randomUUID()].map(k => owner.request('POST', '/api/v1/imports', body, { headers: { 'Idempotency-Key': k } }))); check(committed.every(r => r.status === 201 || r.status === 200), 'Concurrent import confirmation failed'); check(committed[0].data.id === committed[1].data.id && committed[0].data.id !== source.id, 'Import was duplicated or reused source vault ID');
  const result = committed[0].data; check(result.searchLanguage === 'de' && result.versionLimit === 7 && result.activeRecordCount === 2, 'Import lost vault metadata');
  const found = await owner.ok('POST', '/api/v1/memories/search', { vaultId: result.id, query: '' }); check(found.items.length === 2 && found.items.every(m => m.revision === '1' && ![first.id, second.id].includes(m.id)), 'Import reused IDs or revisions');
  const imported = await owner.ok('GET', `/api/v1/memories/${found.items.find(m => m.title === full.title).id}`); same(imported.markdown, markdown, 'Roundtrip changed Markdown'); same(imported.summary, full.summary, 'Roundtrip changed summary'); check(imported.createdAt === full.createdAt && imported.updatedAt === full.updatedAt, 'Import lost original timestamps'); check(imported.tags.length === 1 && imported.tags[0].name === tag.name && imported.tags[0].id !== tag.id, 'Import lost tag mapping');
  const history = await owner.ok('GET', `/api/v1/memories/${imported.id}/versions`); check(history.items.length === 0, 'Import unexpectedly brought source history');
  await owner.ok('DELETE', `/api/v1/imports/${id}`); await owner.ok('GET', `/api/v1/vaults/${result.id}`);
  const replay = await owner.ok('POST', '/api/v1/imports', body, { headers: { 'Idempotency-Key': key } }); check(replay.id === result.id, 'Completed cancellation broke import replay');
  expect(await owner.request('POST', '/api/v1/imports', { ...body, targetName: 'different target' }, { headers: { 'Idempotency-Key': key } }), 409, 'idempotency_conflict');
  const afterCancel = await upload(exported); expect(afterCancel, 201); await owner.ok('DELETE', `/api/v1/imports/${afterCancel.data.id}`); expect(await owner.request('GET', `/api/v1/imports/${afterCancel.data.id}`), 410, 'import_expired');
}
