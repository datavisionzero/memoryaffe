// Local restored metadata only. No registry refresh and no private application data.
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
const root = resolve(import.meta.dirname, '..');
const records = new Map();
const notices = [];
const clean = name => name.replaceAll(/[^A-Za-z0-9._-]/g, '_');
async function licenseText(directory, candidates, key) {
  for (const name of candidates) {
    try { const text = await readFile(join(directory, name), 'utf8'); const file = `licenses/${clean(key)}.txt`; await writeFile(join(root, 'docs', file), text); return { licenseText: file, sha256: createHash('sha256').update(text).digest('hex') }; } catch (e) { if (e.code !== 'ENOENT' && e.code !== 'EISDIR') throw e; }
  }
  return {};
}
await mkdir(join(root, 'docs/licenses'), { recursive: true });
for (const project of ['src/Memoryaffe.Infrastructure', 'src/Memoryaffe.Api', 'tests/Memoryaffe.Tests', 'tests/Memoryaffe.ProtocolTests']) {
  const assets = JSON.parse(await readFile(join(root, project, 'obj/project.assets.json'), 'utf8'));
  for (const [identity, library] of Object.entries(assets.libraries)) {
    if (library.type !== 'package') continue;
    const slash = identity.lastIndexOf('/'), name = identity.slice(0, slash), version = identity.slice(slash + 1); const key = `nuget:${name}@${version}`;
    if (records.has(key)) { records.get(key).projects.push(project); continue; }
    const directory = join(homedir(), '.nuget/packages', name.toLowerCase(), version);
    const xml = await readFile(join(directory, name.toLowerCase() + '.nuspec'), 'utf8');
    const match = xml.match(/<license\s+type="([^"]+)"[^>]*>([^<]+)<\/license>/);
    const license = match?.[1] === 'expression' ? match[2].replaceAll('&amp;', '&') : null;
    const listed = (await readdir(directory)).filter(x => /^(licen[sc]e|copying|notice)(\.|$)/i.test(x));
    const text = await licenseText(directory, [...(match?.[1] === 'file' ? [match[2]] : []), ...listed], key);
    records.set(key, { ecosystem: 'NuGet', name, version, license, ...text, projects: [project], metadataSource: 'restored .nuspec', ...(license == null ? { requiresReview: true } : {}) });
  }
}
const lock = JSON.parse(await readFile(join(root, 'src/web/package-lock.json'), 'utf8'));
for (const [path, p] of Object.entries(lock.packages)) {
  if (!path) continue; const directory = join(root, 'src/web', path); let metadata;
  try { metadata = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8')); } catch { if (p.optional) continue; throw new Error('Missing restored npm package: ' + path); }
  const name = metadata.name, version = metadata.version, key = `npm:${name}@${version}`;
  const license = typeof metadata.license === 'string' ? metadata.license : metadata.license?.type ?? null;
  const files = (await readdir(directory)).filter(x => /^(licen[sc]e|copying|notice)(\.|$)/i.test(x));
  records.set(key, { ecosystem: 'npm', name, version, license, developmentOnly: !!p.dev, ...(await licenseText(directory, files, key)), metadataSource: 'npm lock and restored package.json', ...(license == null ? { requiresReview: true } : {}) });
}
const go = await readFile(join(root, 'src/cli/go.mod'), 'utf8');
for (const match of go.matchAll(/(golang\.org\/x\/[a-z]+)\s+(v[0-9.]+)/g)) {
  const [, name, version] = match; const key = `go:${name}@${version}`; const directory = join(process.env.GOMODCACHE ?? join(homedir(), 'go/pkg/mod'), name + '@' + version);
  const text = await licenseText(directory, ['LICENSE'], key); const content = text.licenseText ? await readFile(join(root, 'docs', text.licenseText), 'utf8') : '';
  const license = /Neither the name of Google (?:Inc\.|LLC)/.test(content) && content.includes('Redistributions in binary form') ? 'BSD-3-Clause' : null;
  records.set(key, { ecosystem: 'Go', name, version, license, ...text, metadataSource: 'go.mod and restored module LICENSE', ...(license == null ? { requiresReview: true } : {}) });
}
const overrides = JSON.parse(await readFile(join(root, 'tools/license-overrides.json'), 'utf8'));
for (const [key, override] of Object.entries(overrides)) {
  const record = records.get(key); if (!record) continue;
  Object.assign(record, override); delete record.requiresReview;
  if (record.licenseText) record.sha256 = createHash('sha256').update(await readFile(join(root, 'docs', record.licenseText))).digest('hex');
}
const sorted = [...records.values()].sort((a, b) => `${a.ecosystem}:${a.name}@${a.version}`.localeCompare(`${b.ecosystem}:${b.name}@${b.version}`, 'en'));
await writeFile(join(root, 'docs/DEPENDENCY_LICENSES.json'), JSON.stringify({ scope: 'Restored managed, Go and current-platform npm packages including build/test dependencies; OS/base-image packages and uninstalled optional platform binaries are not covered.', packages: sorted }, null, 2) + '\n');
for (const p of sorted) notices.push(`${p.ecosystem} ${p.name}@${p.version}: ${p.license ?? 'REVIEW REQUIRED'}${p.licenseText ? '\n  license text: docs/' + p.licenseText : ''}`);
await writeFile(join(root, 'THIRD_PARTY_NOTICES.txt'), 'memoryaffe dependency notices\n\nProject code: MIT. Dependency licenses remain applicable.\nThis inventory includes build/test packages. Base container OS/runtime notices remain in their images.\nUnicode 17 data: src/Memoryaffe.Infrastructure/Unicode/LICENSE.txt\n\n' + notices.join('\n\n') + '\n');
console.log(`Inventoried ${sorted.length} restored packages; ${sorted.filter(x => x.requiresReview).length} require license review.`);
for (const p of sorted.filter(x => x.requiresReview)) console.log(`${p.ecosystem} ${p.name}@${p.version}`);
