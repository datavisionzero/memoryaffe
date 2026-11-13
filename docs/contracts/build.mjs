// Planning artifacts only: no application or server implementation.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const dialect = 'https://json-schema.org/draft/2020-12/schema';
const obj = (properties, required = Object.keys(properties)) => ({ type: 'object', properties, required, additionalProperties: false });
const ref = name => ({ $ref: `#/$defs/${name}` });
const str = { type: 'string' };
const array = items => ({ type: 'array', items });
const enumeration = values => ({ type: 'string', enum: values });
const id = { type: 'string', format: 'uuid', pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$(?![\\s\\S])' };
const time = { type: 'string', format: 'date-time', pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$(?![\\s\\S])' };
const title = { type: 'string', minLength: 1, maxLength: 200, description: 'Validate after outer trimming; must not be empty.' };
const summary = { type: ['string', 'null'], maxLength: 1000, description: 'Empty string is normalized to null on input.' };
const tagIds = { ...array(ref('Id')), uniqueItems: true, maxItems: 50 };
const cursor = { type: 'string', minLength: 1, maxLength: 8192, pattern: '^[\\x01-\\x7F]+$' };
const retryKey = { type: 'string', minLength: 1, maxLength: 128, pattern: '^[A-Za-z0-9_.:-]+$(?![\\s\\S])' };
const page = { pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 }, cursor };
const content = { title, markdown: { type: 'string', description: 'Preserve text including line endings; at most 1048576 UTF-8 bytes. Byte limit requires application validation.' }, summary, tagIds };
const codes = ['validation_failed', 'authentication_required', 'permission_denied', 'not_found', 'revision_conflict', 'idempotency_conflict', 'name_conflict', 'request_in_progress', 'cursor_expired', 'payload_too_large', 'rate_limited', 'temporarily_unavailable', 'internal_error'];
const defs = {
  Id: id, Timestamp: time, Revision: { type: 'string', pattern: '^[1-9][0-9]*$(?![\\s\\S])' },
  Tag: obj({ id: ref('Id'), name: { type: 'string', minLength: 1, maxLength: 50 } }),
  Vault: obj({ id: ref('Id'), name: { type: 'string', minLength: 1, maxLength: 100 } }),
  WriteResult: obj({ id: ref('Id'), revision: ref('Revision'), updatedAt: ref('Timestamp') }),
  Error: obj({ code: enumeration(codes), message: str, requestId: { type: 'string', minLength: 1 }, fields: array(obj({ field: str, message: str })), retryAfterSeconds: { type: 'integer', minimum: 1 } }, ['code', 'message', 'requestId']),
  ListVaultsInput: obj(page, []),
  ListTagsInput: obj({ vaultId: ref('Id'), ...page }, ['vaultId']),
  GetMemoryInput: obj({ id: ref('Id') }),
  CreateMemoryInput: obj({ vaultId: ref('Id'), ...content }, ['vaultId', 'title', 'markdown']),
  UpdateMemoryInput: obj({ id: ref('Id'), expectedRevision: ref('Revision'), ...content }, ['id', 'expectedRevision']),
  DeleteMemoryInput: obj({ id: ref('Id'), expectedRevision: ref('Revision') }),
  CreateTagInput: obj({ vaultId: ref('Id'), name: { type: 'string', minLength: 1, maxLength: 50 } }),
  SearchInput: {
    ...obj({ vaultId: ref('Id'), allVaults: { const: true }, query: { type: 'string', maxLength: 4096, default: '' }, tagIds: { ...tagIds },
      tagMatch: { ...enumeration(['all', 'any']), default: 'all' }, sort: enumeration(['relevance', 'updatedAt']), ...page }, []),
    oneOf: [{ required: ['vaultId'], not: { required: ['allVaults'] } }, { required: ['allVaults'], not: { required: ['vaultId'] } }]
  }
};
// The record tag limit is not a search-filter limit.
defs.SearchInput.properties.tagIds.maxItems = 100;
defs.Error.allOf = [{ if: { properties: { code: { const: 'request_in_progress' } }, required: ['code'] }, then: { required: ['retryAfterSeconds'], properties: { retryAfterSeconds: { const: 1 } } } }];
const metadata = { id: ref('Id'), vaultId: ref('Id'), title, summary, tags: { ...array(ref('Tag')), maxItems: 50 }, revision: ref('Revision'), createdAt: ref('Timestamp'), updatedAt: ref('Timestamp') };
defs.Memory = obj({ ...metadata, markdown: content.markdown });
defs.SearchHit = obj({ ...metadata, snippet: str });
for (const [name, item] of [['VaultPage', 'Vault'], ['TagPage', 'Tag'], ['SearchPage', 'SearchHit']]) {
  defs[name] = obj({ items: array(ref(item)), nextCursor: { ...cursor, type: ['string', 'null'] } });
}
// Clone before transformations; shared schema objects must not be mutated.
const clone = value => structuredClone(value);
const bundle = name => {
  const needed = {};
  const visit = value => {
    if (!value || typeof value !== 'object') return;
    if (value.$ref) {
      const key = value.$ref.split('/').at(-1);
      if (!needed[key]) { needed[key] = clone(defs[key]); visit(needed[key]); }
    }
    Object.values(value).forEach(visit);
  };
  visit(defs[name]);
  return { $schema: dialect, ...clone(defs[name]), $defs: needed };
};
const write = (name, value) => writeFileSync(join(root, name), JSON.stringify(value, null, 2) + '\n');
mkdirSync(root, { recursive: true });
write('models.schema.json', { $schema: dialect, $defs: defs });

const operations = [
  ['list_vaults', 'ListVaultsInput', 'VaultPage', 'get', '/api/v1/vaults', true],
  ['list_tags', 'ListTagsInput', 'TagPage', 'get', '/api/v1/vaults/{vaultId}/tags', true],
  ['search_memories', 'SearchInput', 'SearchPage', 'post', '/api/v1/memories/search', true],
  ['get_memory', 'GetMemoryInput', 'Memory', 'get', '/api/v1/memories/{id}', true],
  ['create_memory', 'CreateMemoryInput', 'WriteResult', 'post', '/api/v1/memories', false],
  ['update_memory', 'UpdateMemoryInput', 'WriteResult', 'patch', '/api/v1/memories/{id}', false],
  ['delete_memory', 'DeleteMemoryInput', 'WriteResult', 'delete', '/api/v1/memories/{id}', false],
  ['create_tag', 'CreateTagInput', 'Tag', 'post', '/api/v1/vaults/{vaultId}/tags', false]
];
const descriptions = {
  list_vaults: 'List active vaults accessible to this agent.',
  list_tags: 'List existing tags in an accessible vault.',
  search_memories: 'Search active current records in one explicit vault or all accessible vaults. Returns snippets, not full Markdown.',
  get_memory: 'Read the current complete record, including Markdown and revision.',
  create_memory: 'Create a record in an explicitly authorized vault. Tags must already exist in that vault.',
  update_memory: 'Update specified fields only. Requires the revision last read; conflicts must be resolved by reading again.',
  delete_memory: 'Move a record to trash using the revision last read. Permanent deletion is not available to agents.',
  create_tag: 'Create a vault-local tag. Requires write access and the account permission to create tags.'
};
const tools = operations.map(([name, input, output, , , read]) => {
  const inputSchema = bundle(input);
  if (!read) inputSchema.properties.idempotencyKey = { ...retryKey, description: 'Optional retry key, retained for 24 hours. Same actor and logical request across HTTP/MCP.' };
  return { name, description: descriptions[name], inputSchema, outputSchema: bundle(output),
    annotations: { readOnlyHint: read, destructiveHint: name === 'update_memory' || name === 'delete_memory', idempotentHint: read, openWorldHint: false } };
});
write('mcp-tools.json', { tools });

function apiRefs(value) {
  if (Array.isArray(value)) return value.map(apiRefs);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, k === '$ref' ? v.replace('#/$defs/', '#/components/schemas/') : apiRefs(v)]));
  return value;
}
const api = { openapi: '3.1.1', info: { title: 'memoryaffe agent data API — planning contract', version: '0.1.0', description: 'Agent data surface only. Web account/admin/lifecycle and OAuth contracts are tracked separately; no running implementation.' },
  security: [{ agentToken: [] }], paths: {}, components: { securitySchemes: { agentToken: { type: 'http', scheme: 'bearer', description: 'Revocable CLI agent token. OAuth tokens for the MCP resource are not implicitly valid here.' } }, schemas: apiRefs(defs) } };
for (const [name, input, output, method, path, read] of operations) {
  const schema = clone(defs[input]);
  const parameters = [];
  for (const match of path.matchAll(/\{(\w+)\}/g)) {
    const key = match[1];
    parameters.push({ name: key, in: 'path', required: true, schema: schema.properties[key] });
    delete schema.properties[key];
    schema.required = schema.required.filter(x => x !== key);
  }
  if (method === 'get' || method === 'delete') {
    for (const [key, value] of Object.entries(schema.properties)) parameters.push({ name: key, in: 'query', required: schema.required.includes(key), schema: value });
  }
  if (!read) parameters.push({ name: 'Idempotency-Key', in: 'header', required: false, schema: retryKey });
  const response = name === 'create_memory' || name === 'create_tag' ? '201' : '200';
  const operation = { operationId: name, description: descriptions[name], parameters,
    responses: { [response]: { description: 'Success', content: { 'application/json': { schema: { $ref: `#/components/schemas/${output}` } } } }, default: { description: 'Product error; see API_CONTRACT.md for status/code mapping.', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } } } };
  operation.responses.default.headers = { 'Retry-After': { description: 'For request_in_progress: 1 second; mirrors retryAfterSeconds.', schema: { type: 'integer', minimum: 1 } } };
  if (method !== 'get' && method !== 'delete') operation.requestBody = { required: true, content: { 'application/json': { schema } } };
  (api.paths[path] ??= {})[method] = apiRefs(operation);
}
write('agent.openapi.json', api);

const manifest = obj({ formatVersion: { const: 1 }, exportedAt: time,
  vault: obj({ name: { type: 'string', minLength: 1, maxLength: 100 }, searchLanguage: enumeration(['neutral', 'de', 'en']), versionLimit: { type: 'integer', minimum: 0, maximum: 100 } }),
  tags: array(obj({ id, name: { type: 'string', minLength: 1, maxLength: 50 } })),
  records: array(obj({ id, title, summary, tagIds: { ...array(id), uniqueItems: true, maxItems: 50 }, createdAt: time, updatedAt: time }))
});
write('vault-manifest.schema.json', { $schema: dialect, title: 'memoryaffe vault archive format 1', ...manifest });
const exampleId = '10000000-0000-4000-8000-000000000001';
write('manifest.example.json', { formatVersion: 1, exportedAt: '2026-11-13T14:25:30.123Z', vault: { name: 'Wissen', searchLanguage: 'neutral', versionLimit: 20 }, tags: [], records: [{ id: exampleId, title: 'Beispiel', summary: null, tagIds: [], createdAt: '2026-11-13T14:25:30.123Z', updatedAt: '2026-11-13T14:25:30.123Z' }] });
console.log('Generated models, eight MCP tools, agent OpenAPI and archive schema/example.');
