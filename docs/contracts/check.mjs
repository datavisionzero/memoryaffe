// Schema verification only; does not test an application implementation.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

if (!process.argv[2]) throw new Error('Usage: node docs/contracts/check.mjs <validation-tool-directory>');
const requireTool = createRequire(join(process.argv[2], 'package.json'));
const Ajv = requireTool('ajv/dist/2020');
const addFormats = requireTool('ajv-formats');
const SwaggerParser = requireTool('@apidevtools/swagger-parser');
const root = dirname(fileURLToPath(import.meta.url));
const load = name => JSON.parse(readFileSync(join(root, name), 'utf8'));
const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
let checks = 0;
const expect = (validate, data, valid) => {
  assert.equal(validate(data), valid, JSON.stringify({ data, errors: validate.errors }));
  checks++;
};
const tools = load('mcp-tools.json').tools;
assert.equal(tools.length, 8);
assert.equal(new Set(tools.map(t => t.name)).size, 8);
const inputs = {};
for (const tool of tools) {
  inputs[tool.name] = ajv.compile(tool.inputSchema);
  ajv.compile(tool.outputSchema);
}
const id = '10000000-0000-4000-8000-000000000001';
const other = '10000000-0000-4000-8000-000000000002';
const create = { vaultId: id, title: 'Titel', markdown: '' };
expect(inputs.create_memory, create, true);
expect(inputs.create_memory, { ...create, summary: null, tagIds: [] }, true);
expect(inputs.create_memory, { ...create, markdown: null }, false);
expect(inputs.create_memory, { ...create, title: '' }, false);
expect(inputs.create_memory, { ...create, title: '😀'.repeat(200) }, true);
expect(inputs.create_memory, { ...create, title: '😀'.repeat(201) }, false);
expect(inputs.create_memory, { ...create, summary: 'x'.repeat(1001) }, false);
expect(inputs.create_memory, { ...create, tagIds: [id, id] }, false);
const manyTags = Array.from({ length: 51 }, (_, n) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`);
expect(inputs.create_memory, { ...create, tagIds: manyTags.slice(0, 50) }, true);
expect(inputs.create_memory, { ...create, tagIds: manyTags }, false);
expect(inputs.create_memory, { ...create, ownerId: other }, false);
expect(inputs.update_memory, { id, expectedRevision: '2', summary: null, tagIds: [] }, true);
expect(inputs.update_memory, { id, title: 'Neu' }, false);
expect(inputs.update_memory, { id, expectedRevision: 2, title: 'Neu' }, false);
expect(inputs.delete_memory, { id, expectedRevision: '0' }, false);
expect(inputs.delete_memory, { id, expectedRevision: '10', idempotencyKey: 'retry-example' }, true);
expect(inputs.search_memories, { vaultId: id }, true);
expect(inputs.search_memories, { allVaults: true }, true);
expect(inputs.search_memories, {}, false);
expect(inputs.search_memories, { vaultId: id, allVaults: true }, false);
expect(inputs.search_memories, { allVaults: false }, false);
expect(inputs.search_memories, { allVaults: true, pageSize: 100 }, true);
expect(inputs.search_memories, { allVaults: true, pageSize: 101 }, false);
expect(inputs.search_memories, { allVaults: true, tagIds: manyTags }, true);
expect(inputs.list_tags, { vaultId: id, pageSize: 0 }, false);
expect(inputs.create_tag, { vaultId: id, name: 'x'.repeat(51) }, false);
const manifest = ajv.compile(load('vault-manifest.schema.json'));
const example = load('manifest.example.json');
expect(manifest, example, true);
expect(manifest, { ...example, formatVersion: 2 }, false);
expect(manifest, { ...example, exportedAt: '2026-11-13T14:25:30Z' }, false);
expect(manifest, { ...example, exportedAt: '2026-02-30T14:25:30.000Z' }, false);
expect(manifest, { ...example, vault: { ...example.vault, versionLimit: 101 } }, false);
expect(manifest, { ...example, credentials: [] }, false);
const api = load('agent.openapi.json');
await SwaggerParser.validate(structuredClone(api));
const ids = Object.values(api.paths).flatMap(path => Object.values(path).map(op => op.operationId));
assert.deepEqual(ids.sort(), tools.map(t => t.name).sort());
// Local JSON pointers in every generated artifact must resolve without network.
for (const file of ['models.schema.json', 'mcp-tools.json', 'agent.openapi.json', 'vault-manifest.schema.json']) {
  const doc = load(file);
  const visit = (value, scope) => {
    if (!value || typeof value !== 'object') return;
    if (value.$schema) scope = value;
    if (value.$ref) {
      assert.ok(value.$ref.startsWith('#/'));
      const target = value.$ref.slice(2).split('/').reduce((v, k) => v?.[k], scope);
      assert.notEqual(target, undefined, `${file}: ${value.$ref}`);
    }
    Object.values(value).forEach(child => visit(child, scope));
  };
  visit(doc, doc);
}
console.log(`${checks} positive/negative schema cases passed; 8 MCP input/output schemas compiled; OpenAPI and all local references validated.`);
