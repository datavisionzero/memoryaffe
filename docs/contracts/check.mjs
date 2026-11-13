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
expect(inputs.delete_memory, { id, expectedRevision: '1\n' }, false);
expect(inputs.get_memory, { id: id + '\n' }, false);
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
for (const [length, valid] of [[4096, true], [4097, false]]) expect(inputs.search_memories, { allVaults: true, query: '😀'.repeat(length) }, valid);
const searchTags = Array.from({ length: 101 }, (_, n) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`);
expect(inputs.search_memories, { allVaults: true, tagIds: searchTags.slice(0, 100) }, true);
expect(inputs.search_memories, { allVaults: true, tagIds: searchTags }, false);
for (const [value, valid] of [['a'.repeat(128), true], ['a'.repeat(129), false], ['', false], ['uuid:abc-DEF_1.2', true], ['ä', false], ['a b', false], ['a\n', false]]) {
  expect(inputs.create_memory, { ...create, idempotencyKey: value }, valid);
}
for (const [value, valid] of [['a'.repeat(8192), true], ['a'.repeat(8193), false], ['ä', false], ['\u0000', false]]) {
  expect(inputs.list_vaults, { cursor: value }, valid);
}
const modelDefinitions = load('models.schema.json');
const error = ajv.compile({ ...modelDefinitions, $ref: '#/$defs/Error' });
const running = { code: 'request_in_progress', message: 'Running', requestId: 'test' };
expect(error, running, false);
expect(error, { ...running, retryAfterSeconds: 1 }, true);
expect(error, { ...running, retryAfterSeconds: 2 }, false);
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
// Full browser/OAuth surfaces: compile every declared schema and operation payload.
function schemaFor(doc, schema) {
  const rewrite = value => {
    if (Array.isArray(value)) return value.map(rewrite);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, key === '$ref' ? item.replace('#/components/schemas/', '#/$defs/') : rewrite(item)]));
    return value;
  };
  return { $schema: 'https://json-schema.org/draft/2020-12/schema', ...rewrite(schema), $defs: rewrite(doc.components.schemas) };
}
const web = load('web.openapi.json'), oauth = load('oauth.openapi.json');
const validators = {};
for (const [label, doc] of [['web', web], ['oauth', oauth]]) {
  await SwaggerParser.validate(structuredClone(doc));
  const seen = new Set();
  for (const schema of Object.values(doc.components.schemas)) ajv.compile(schemaFor(doc, schema));
  for (const [path, methods] of Object.entries(doc.paths)) for (const [method, op] of Object.entries(methods)) {
    assert.ok(!seen.has(op.operationId), `Duplicate operationId ${op.operationId}`); seen.add(op.operationId);
    const body = op.requestBody && Object.values(op.requestBody.content)[0].schema;
    if (body) validators[op.operationId] = ajv.compile(schemaFor(doc, body));
    for (const response of Object.values(op.responses)) for (const media of Object.values(response.content ?? {})) ajv.compile(schemaFor(doc, media.schema));
    for (const parameter of op.parameters ?? []) ajv.compile(schemaFor(doc, parameter.schema));
    if (label === 'web') {
      assert.ok(!JSON.stringify(op.security).includes('agentToken'));
      if (method !== 'get') assert.ok(op.security.every(x => Object.hasOwn(x, 'csrf')), `Missing CSRF: ${path}`);
      if (path.startsWith('/api/v1/admin/')) { assert.equal(op['x-account-scope'], 'admin-metadata-only'); assert.ok(op.security.every(x => Object.hasOwn(x, 'webSession'))); }
    }
  }
  console.log(`${label}: ${seen.size} operations; all declared schemas compiled and OpenAPI validated.`);
}
expect(validators.web_login, { email: 'a@example.org', password: 'password' }, true);
expect(validators.web_login, { email: 'invalid', password: 'password' }, false);
expect(validators.web_login, { email: 'a@example.org', password: 'password', role: 'admin' }, false);
expect(validators.web_setup, { email: 'a@example.org', password: 'x'.repeat(15), setupSecret: 'secret' }, true);
expect(validators.web_setup, { email: 'a@example.org', password: 'short', setupSecret: 'secret' }, false);
expect(validators.web_login_factor, { factor: { kind: 'totp', code: '012345' } }, true);
expect(validators.web_login_factor, { factor: { kind: 'totp', code: '012345\n' } }, false);
expect(validators.web_login_factor, { factor: { kind: 'recoveryCode', code: 'one-use-code' } }, true);
expect(validators.web_login_factor, { factor: { kind: 'totp', code: '12345' } }, false);
expect(validators.web_update_profile, { theme: 'dark' }, true);
expect(validators.web_update_profile, { allowAgentTagCreation: true }, false);
expect(validators.web_update_profile, { expectedRevision: '1', allowAgentTagCreation: true }, true);
expect(validators.web_update_profile, { role: 'admin' }, false);
expect(validators.web_create_vault, { name: 'Wissen', versionLimit: 100 }, true);
expect(validators.web_create_vault, { name: 'Wissen', versionLimit: 101 }, false);
expect(validators.web_update_vault, { name: 'Neu' }, false);
expect(validators.web_create_agent_access, { name: 'Agent', grants: [] }, false);
expect(validators.web_create_agent_access, { name: 'Agent', grants: [{ vaultId: id, level: 'write' }] }, true);
expect(validators.web_create_agent_access, { name: 'Agent', grants: [{ vaultId: id, level: 'admin' }] }, false);
expect(validators.web_issue_token, { expectedRevision: '1', lifetimeDays: null, overlapSeconds: 86400 }, true);
expect(validators.web_issue_token, { expectedRevision: '1', overlapSeconds: 86401 }, false);
expect(validators.web_issue_token, { expectedRevision: '1', lifetimeDays: 7 }, false);
expect(validators.web_merge_tags, { expectedRevision: '1', targetTagId: other }, false);
expect(validators.web_restore_version, { expectedRevision: '2', sourceRevision: '1', restoreToken: 'proof' }, true);
expect(validators.web_restore_version, { expectedRevision: '2', sourceRevision: '1' }, false);
expect(validators.web_commit_import, { preparationId: id, targetName: 'Import' }, true);
expect(validators.web_commit_import, { preparationId: id, targetName: 'Import', ownerId: other }, false);
expect(validators.admin_update_account, { expectedRevision: '1', role: 'admin' }, true);
expect(validators.admin_update_account, { role: 'admin' }, false);
expect(validators.web_reauthenticate, { password: 'password', request: { operationId: 'web_delete_account', path: {}, query: { expectedRevision: '1' }, body: null } }, true);
expect(validators.web_reauthenticate, { password: 'password', request: { operationId: 'arbitrary_sql', path: {}, query: {}, body: null } }, false);
const exchange = { grant_type: 'authorization_code', client_id: 'https://chatgpt.com/oauth/client.json', code: 'secret', redirect_uri: 'https://chatgpt.com/connector_platform_oauth_redirect', resource: 'https://memory.example.org/mcp', code_verifier: 'a'.repeat(43) };
expect(validators.oauth_token, exchange, true);
expect(validators.oauth_token, { ...exchange, future_extension: 'ignored' }, true);
expect(validators.oauth_token, { ...exchange, code_verifier: 'a'.repeat(42) }, false);
expect(validators.oauth_token, { ...exchange, client_secret: 'not-supported' }, false);
expect(validators.oauth_token, { grant_type: 'refresh_token', client_id: exchange.client_id, refresh_token: 'refresh', resource: exchange.resource }, true);
expect(validators.oauth_token, { grant_type: 'refresh_token', client_id: exchange.client_id, refresh_token: 'refresh' }, false);
expect(validators.oauth_token, { grant_type: 'password', username: 'user', password: 'pw' }, false);
expect(validators.oauth_revoke, { client_id: exchange.client_id, token: 'token' }, true);
expect(validators.web_decide_oauth_consent, { decision: 'deny' }, true);
expect(validators.web_decide_oauth_consent, { decision: 'approve', name: 'ChatGPT', grants: [], scopes: ['memory:read'] }, false);
expect(validators.web_decide_oauth_consent, { decision: 'approve', name: 'ChatGPT', grants: [{ vaultId: id, level: 'read' }], scopes: ['memory:read'] }, true);
console.log(`${checks} positive/negative schema cases passed; all agent, browser and OAuth contracts validated. No application behavior tested.`);
