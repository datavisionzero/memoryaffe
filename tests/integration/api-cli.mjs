import { runLastAdminRace } from './admin-race.mjs';
import { runLifecycle } from './lifecycle.mjs';
import { runSearch } from './search.mjs';
import { runArchives } from './archives.mjs';
import { runOAuthSecurity } from './oauth-security.mjs';
import { runTotp } from './totp.mjs';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const base = (process.env.MEMORYAFFE_TEST_BASE_URL ?? 'http://localhost:5080').replace(/\/$/, '');
const adminPassword = process.env.MEMORYAFFE_TEST_ADMIN_PASSWORD ?? randomBytes(24).toString('base64url');
const userPassword = randomBytes(24).toString('base64url');
const setupSecret = process.env.MEMORYAFFE_TEST_SETUP_SECRET;
const adminEmail = process.env.MEMORYAFFE_TEST_ADMIN_EMAIL ?? 'integration-admin@example.test';
const nonce = randomUUID().slice(0, 8);
const reuse = process.env.MEMORYAFFE_TEST_REUSE === '1';
const checks = [];
let searchEvidence = null;
const secrets = new Set([adminPassword, userPassword, setupSecret].filter(Boolean));
function check(value, label) { if (!value) throw new Error(label); }
function same(a, b, label) { check(JSON.stringify(a) === JSON.stringify(b), label); }
function redact(s) { for (const secret of secrets) s = s.split(secret).join('[REDACTED]'); return s; }
async function step(name, action) { await action(); checks.push(name); console.log(`PASS ${name}`); }

export class Browser {
  constructor({ baseUrl = base, password = adminPassword } = {}) { this.baseUrl = baseUrl; this.password = password; }
  cookies = new Map(); csrf = undefined;
  async request(method, path, body, options = {}) {
    const headers = { Accept: 'application/json', Origin: this.baseUrl, ...options.headers };
    if (this.cookies.size) headers.Cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    if (this.csrf && options.csrf !== false && method !== 'GET') headers['X-CSRF-Token'] = this.csrf;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetch(this.baseUrl + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual', signal: AbortSignal.timeout(30000) });
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(';'); const at = pair.indexOf('=');
      if (at >= 0) { const k = pair.slice(0, at), v = pair.slice(at + 1); if (v) this.cookies.set(k, v); else this.cookies.delete(k); }
    }
    const text = await response.text();
    let data; try { data = text ? JSON.parse(text) : null; } catch { throw new Error(`Non-JSON response: ${method} ${path.split('?')[0]} HTTP ${response.status}`); }
    return { status: response.status, data, headers: response.headers };
  }
  async refreshCsrf() { const r = await this.request('GET', '/api/v1/auth/csrf'); expect(r, 200); check(typeof r.data.requestToken === 'string', 'CSRF token missing'); this.csrf = r.data.requestToken; secrets.add(this.csrf); return r; }
  async ok(method, path, body, options) { const r = await this.request(method, path, body, options); check(r.status >= 200 && r.status < 300, `${method} ${path.split('?')[0]} returned HTTP ${r.status}, code ${r.data?.code ?? 'missing'}`); return r.data; }
  async proved(method, path, body, operationId, pathValues = {}, query = {}) {
    const r = await this.ok('POST', '/api/v1/me/reauthenticate', { password: this.password, request: { operationId, path: pathValues, query, body } });
    secrets.add(r.proof); return this.ok(method, path, body, { headers: { 'X-Action-Proof': r.proof } });
  }
}
function expect(r, status, code) { check(r.status === status, `Expected HTTP ${status}, received ${r.status} (${r.data?.code ?? 'no code'})`); if (code) { check(r.data?.code === code, `Expected error ${code}, received ${r.data?.code ?? 'no code'}`); check(typeof r.data.requestId === 'string' && r.data.requestId.length > 0, 'Error requestId missing'); } }
async function agent(token, method, path, body, key) { const browser = new Browser(); return browser.request(method, path, body, { headers: { Authorization: `Bearer ${token}`, ...(key ? { 'Idempotency-Key': key } : {}) } }); }
async function processRun(file, args, options = {}) { return new Promise((resolveRun, reject) => { const child = spawn(file, args, { ...options, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }); let stdout = '', stderr = ''; child.stdout.on('data', b => stdout += b); child.stderr.on('data', b => stderr += b); child.on('error', () => reject(new Error(`Cannot start ${file.split(/[\\/]/).at(-1)}`))); child.on('close', code => resolveRun({ code, stdout, stderr })); child.stdin.end(options.input ?? ''); }); }

export async function runIntegration() {
  check(setupSecret?.length >= 24, 'MEMORYAFFE_TEST_SETUP_SECRET (at least 24 characters) is required');
  const owner = new Browser(), other = new Browser(), anonymous = new Browser();
  let vault, foreignVault, memory, access, issued, token;
  const initialMarkdown = '# Integration\r\n\r\nGrüße α😀\r\n';
  await step(reuse ? 'readiness and explicit existing-test-account guard' : 'readiness and empty-database guard', async () => {
    const ready = await fetch(base + '/health/ready', { signal: AbortSignal.timeout(10000) }); check(ready.status === 200, 'Backend is not ready');
    const r = await anonymous.request('GET', '/api/v1/setup'); expect(r, 200); check(r.data.setupRequired === true || reuse, 'Integration requires an empty dedicated database; it will not erase an existing installation');
  });
  await step(reuse ? 'explicit test-account login, identity CSRF refresh and forbidden setup replay' : 'anonymous CSRF, setup and single-use setup', async () => {
    const payload = { setupSecret, email: adminEmail, password: adminPassword };
    if (reuse) { check(process.env.MEMORYAFFE_TEST_ADMIN_PASSWORD, 'Reuse requires an explicit admin password'); await owner.refreshCsrf(); await owner.ok('POST', '/api/v1/auth/login', { email: adminEmail, password: adminPassword }); await owner.refreshCsrf(); expect(await owner.request('POST', '/api/v1/setup', payload), 403, 'permission_denied'); return; }
    expect(await owner.request('POST', '/api/v1/setup', payload, { csrf: false }), 403, 'csrf_failed');
    await owner.refreshCsrf();
    expect(await owner.request('POST', '/api/v1/setup', { ...payload, setupSecret: randomUUID() }), 403, 'permission_denied');
    const account = await owner.ok('POST', '/api/v1/setup', payload); check(account.role === 'admin', 'Setup did not create admin');
    await owner.refreshCsrf(); const profile = await owner.ok('GET', '/api/v1/me'); check(profile.email === adminEmail, 'Setup session missing');
    const diagnostics = await owner.ok('GET', '/api/v1/admin/diagnostics'); check(diagnostics.databaseReady === true && diagnostics.databaseBytes > 0, 'PostgreSQL diagnostics not ready');
    expect(await owner.request('POST', '/api/v1/setup', payload), 403, 'permission_denied');
    expect(await anonymous.request('GET', '/api/v1/vaults'), 401, 'authentication_required');
  });
  await step('manual invitation, redemption and account isolation', async () => {
    const invitation = await owner.ok('POST', '/api/v1/admin/invitations', { email: `integration-user-${nonce}@example.test`, role: 'user', sendEmail: false });
    const url = new URL(invitation.link.url); check(!url.searchParams.has('token') && url.hash.startsWith('#token='), 'Invitation token must be in URL fragment');
    const inviteToken = new URLSearchParams(url.hash.slice(1)).get('token'); check(inviteToken, 'Invitation link has no token'); secrets.add(inviteToken);
    await other.refreshCsrf(); await other.ok('POST', '/api/v1/auth/invitations/redeem', { token: inviteToken, password: userPassword }); await other.refreshCsrf();
    const user = await other.ok('GET', '/api/v1/me'); check(user.role === 'user', 'Invitation role changed');
    const replay = await other.request('POST', '/api/v1/auth/invitations/redeem', { token: inviteToken, password: userPassword }); expect(replay, 410, 'flow_expired');
    expect(await other.request('GET', '/api/v1/admin/accounts'), 403, 'permission_denied');
    vault = await owner.ok('POST', '/api/v1/vaults', { name: `Integration own ${nonce}`, searchLanguage: 'neutral', versionLimit: 20 });
    foreignVault = await other.ok('POST', '/api/v1/vaults', { name: `Integration foreign ${nonce}`, searchLanguage: 'neutral', versionLimit: 20 });
    expect(await owner.request('GET', `/api/v1/vaults/${foreignVault.id}`), 404, 'not_found');
    expect(await other.request('GET', `/api/v1/vaults/${vault.id}`), 404, 'not_found');
    const list = await owner.ok('GET', '/api/v1/vaults'); check(!list.items.some(v => v.id === foreignVault.id), 'Admin received foreign vault');
    const invitations = await owner.ok('GET', '/api/v1/admin/invitations'); check(!JSON.stringify(invitations).includes(inviteToken), 'Invitation list leaked secret');
  });
  await step('strict input, unchanged Markdown and foreign memory IDs', async () => {
    expect(await owner.request('POST', '/api/v1/memories', { vaultId: vault.id, title: 'Bad', markdown: '', unknown: true }), 400, 'validation_failed');
    memory = await owner.ok('POST', '/api/v1/memories', { vaultId: vault.id, title: 'Integration initial', markdown: initialMarkdown, summary: 'Initial summary' });
    const full = await owner.ok('GET', `/api/v1/memories/${memory.id}`); same(full.markdown, initialMarkdown, 'Markdown CRLF/Unicode changed');
    expect(await other.request('GET', `/api/v1/memories/${memory.id}`), 404, 'not_found');
    expect(await other.request('PATCH', `/api/v1/memories/${memory.id}`, { expectedRevision: memory.revision, title: 'foreign write' }), 404, 'not_found');
    expect(await owner.request('PATCH', `/api/v1/memories/${memory.id}`, { title: 'missing revision' }), 400, 'validation_failed');
    expect(await owner.request('POST', '/api/v1/memories/search', { query: '' }), 400, 'validation_failed');
  });
  await step('concurrent revision conflict, noop and historical snapshot', async () => {
    const requests = await Promise.all(['race A', 'race B'].map(title => owner.request('PATCH', `/api/v1/memories/${memory.id}`, { expectedRevision: memory.revision, title })));
    same(requests.map(r => r.status).sort(), [200, 409], 'Concurrent writes must produce exactly one success and one conflict');
    expect(requests.find(r => r.status === 409), 409, 'revision_conflict');
    const current = await owner.ok('GET', `/api/v1/memories/${memory.id}`);
    const versions = await owner.ok('GET', `/api/v1/memories/${memory.id}/versions`); check(versions.items.length === 1, 'Race should store one history entry');
    const previous = await owner.ok('GET', `/api/v1/memories/${memory.id}/versions/${memory.revision}`); same(previous.markdown, initialMarkdown, 'Historical Markdown changed'); check(previous.title === 'Integration initial', 'History snapshot is not previous state');
    const noop = await owner.ok('PATCH', `/api/v1/memories/${memory.id}`, { expectedRevision: current.revision, title: current.title, markdown: current.markdown });
    check(noop.revision === current.revision && noop.updatedAt === current.updatedAt, 'Noop changes revision or timestamp');
    expect(await owner.request('PATCH', '/api/v1/memories/' + memory.id, { expectedRevision: current.revision, title: 'Must roll back', tagIds: [randomUUID()] }), 400, 'validation_failed');
    const unchanged = await owner.ok('GET', '/api/v1/memories/' + memory.id); check(unchanged.title === current.title && unchanged.revision === current.revision, 'Invalid update partially persisted');
    const after = await owner.ok('GET', `/api/v1/memories/${memory.id}/versions`); same(after.items, versions.items, 'Noop creates a history entry'); memory = current;
  });
  await step('idempotent concurrent create and mismatched key rejection', async () => {
    const key = randomUUID(), body = { vaultId: vault.id, title: `Idempotent ${nonce}`, markdown: '' };
    const results = await Promise.all([1, 2].map(() => owner.request('POST', '/api/v1/memories', body, { headers: { 'Idempotency-Key': key } })));
    check(results.every(r => r.status === 200 || r.status === 201), 'Concurrent idempotent request failed'); same(results[0].data, results[1].data, 'Idempotent responses differ');
    expect(await owner.request('POST', '/api/v1/memories', { ...body, title: 'Different request' }, { headers: { 'Idempotency-Key': key } }), 409, 'idempotency_conflict');
    const id = results[0].data.id, revision = results[0].data.revision, deletionKey = randomUUID();
    const deletion = await owner.ok('DELETE', `/api/v1/memories/${id}?expectedRevision=${revision}`, undefined, { headers: { 'Idempotency-Key': deletionKey } });
    expect(await owner.request('GET', `/api/v1/memories/${id}`), 404, 'not_found');
    const replay = await owner.ok('DELETE', `/api/v1/memories/${id}?expectedRevision=${revision}`, undefined, { headers: { 'Idempotency-Key': deletionKey } }); same(replay, deletion, 'Delete replay differs after soft deletion');
  });
  await step('action proof binding, explicit agent creation and token metadata', async () => {
    const body = { name: `CLI integration ${nonce}`, grants: [{ vaultId: vault.id, level: 'delete' }] };
    expect(await owner.request('POST', '/api/v1/agent-accesses', body), 403, 'reauthentication_required');
    const proof = await owner.ok('POST', '/api/v1/me/reauthenticate', { password: adminPassword, request: { operationId: 'web_create_agent_access', path: {}, query: {}, body } }); secrets.add(proof.proof);
    expect(await owner.request('POST', '/api/v1/agent-accesses', { ...body, name: 'Different action' }, { headers: { 'X-Action-Proof': proof.proof } }), 403, 'reauthentication_required');
    access = await owner.ok('POST', '/api/v1/agent-accesses', body, { headers: { 'X-Action-Proof': proof.proof } });
    expect(await owner.request('POST', '/api/v1/agent-accesses', body, { headers: { 'X-Action-Proof': proof.proof } }), 403, 'reauthentication_required');
    const tokenBody = { expectedRevision: access.revision, lifetimeDays: 30 };
    issued = await owner.proved('POST', `/api/v1/agent-accesses/${access.id}/tokens`, tokenBody, 'web_issue_token', { id: access.id });
    token = issued.token; check(typeof token === 'string' && token.length >= 32, 'Issued token missing'); secrets.add(token);
    const metadata = await owner.ok('GET', `/api/v1/agent-accesses/${access.id}/tokens`); check(!JSON.stringify(metadata).includes(token), 'Token metadata leaked secret');
    expect(await agent(token, 'GET', '/api/v1/me'), 403, 'permission_denied');
    expect(await agent(token, 'GET', `/api/v1/memories/${randomUUID()}`), 404, 'not_found');
    expect(await agent(token, 'GET', `/api/v1/vaults/${foreignVault.id}/tags`), 404, 'not_found');
    expect(await owner.request('GET', '/api/v1/vaults', undefined, { headers: { Authorization: `Bearer ${token}` } }), 400, 'validation_failed');
    const priorProfile = await owner.ok('GET', '/api/v1/me'); if (priorProfile.allowAgentTagCreation) await owner.ok('PATCH', '/api/v1/me', { expectedRevision: priorProfile.revision, allowAgentTagCreation: false });
    expect(await agent(token, 'POST', `/api/v1/vaults/${vault.id}/tags`, { name: 'Denied tag' }), 403, 'permission_denied');
    const profile = await owner.ok('GET', '/api/v1/me'); await owner.proved('PATCH', '/api/v1/me', { expectedRevision: profile.revision, allowAgentTagCreation: true }, 'web_update_profile');
  });
  let temp;
  try {
    await step('all eight Go CLI operations against real HTTP/PostgreSQL', async () => {
      temp = await mkdtemp(join(tmpdir(), 'memoryaffe-integration-'));
      const binary = join(temp, process.platform === 'win32' ? 'memoryaffe.exe' : 'memoryaffe');
      const build = await processRun(process.env.MEMORYAFFE_TEST_GO ?? 'go', ['build', '-o', binary, '.'], { cwd: join(root, 'src', 'cli'), env: process.env }); check(build.code === 0, 'Go CLI build failed (set MEMORYAFFE_TEST_GO)');
      const cli = async (args, input, expected = 0) => { const r = await processRun(binary, ['--json', ...(base.startsWith('http:') ? ['--allow-local-http'] : []), ...args], { env: { ...process.env, MEMORYAFFE_SERVER: base, MEMORYAFFE_TOKEN: token }, input }); check(r.code === expected, `CLI ${args.slice(0, 2).join(' ')} exit ${r.code}, expected ${expected}`); check(!r.stdout.includes(token) && !r.stderr.includes(token), 'CLI leaked token'); try { return JSON.parse(r.stdout); } catch { throw new Error('CLI stdout is not JSON'); } };
      const vaults = await cli(['vault', 'list', '--page-size', '100']); check(vaults.items.some(v => v.id === vault.id) && !vaults.items.some(v => v.id === foreignVault.id), 'CLI vault list violated isolation');
      const tag = await cli(['tag', 'create', '--vault', vault.id, '--name', `CLI tag ${nonce}`]);
      const tags = await cli(['tag', 'list', '--vault', vault.id]); check(tags.items.some(t => t.id === tag.id), 'CLI created tag not listed');
      const file = join(temp, 'unicode.md'); await writeFile(file, initialMarkdown, 'utf8');
      const created = await cli(['memory', 'create', '--vault', vault.id, '--title', `CLI ${nonce}`, '--file', file, '--tag', tag.id]);
      const got = await cli(['memory', 'get', created.id]); same(got.markdown, initialMarkdown, 'CLI file bytes changed');
      const first = await cli(['memory', 'search', '--vault', vault.id, '--page-size', '1']); check(first.items.length === 1 && typeof first.nextCursor === 'string', 'First search page/cursor missing');
      const second = await cli(['memory', 'search', '--vault', vault.id, '--page-size', '1', '--cursor', first.nextCursor]); check(second.items.length === 1 && second.items[0].id !== first.items[0].id, 'Search cursor repeated an item');
      expect(await agent(token, 'POST', '/api/v1/memories/search', { vaultId: vault.id, pageSize: 1, query: 'changed filter', cursor: first.nextCursor }), 400, 'validation_failed');
      const updated = await cli(['memory', 'update', created.id, '--revision', created.revision, '--stdin', '--clear-summary', '--clear-tags'], '');
      const empty = await cli(['memory', 'get', created.id]); same(empty.markdown, '', 'CLI empty stdin was not preserved'); check(empty.tags.length === 0 && empty.summary === null, 'CLI clear fields failed');
      const search = await cli(['memory', 'search', '--vault', vault.id, '--query', nonce]); check(search.items.some(m => m.id === created.id), 'CLI search missed new memory');
      await cli(['memory', 'delete', created.id, '--revision', updated.revision]); await cli(['memory', 'get', created.id], undefined, 5);
      const live = await owner.ok('GET', `/api/v1/agent-accesses/${access.id}`); await owner.ok('PATCH', `/api/v1/agent-accesses/${access.id}`, { expectedRevision: live.revision, grants: [{ vaultId: vault.id, level: 'read' }] });
      await cli(['memory', 'get', memory.id]); await cli(['memory', 'create', '--vault', vault.id, '--title', 'Denied', '--stdin'], '', 4);
      expect(await agent(token, 'PATCH', `/api/v1/memories/${memory.id}`, { expectedRevision: memory.revision, title: 'Denied' }), 403, 'permission_denied');
      expect(await agent(token, 'DELETE', `/api/v1/memories/${memory.id}?expectedRevision=${memory.revision}`), 403, 'permission_denied');
      const reduced = await owner.ok('GET', `/api/v1/agent-accesses/${access.id}`); await owner.ok('PATCH', `/api/v1/agent-accesses/${access.id}`, { expectedRevision: reduced.revision, grants: [] });
      const noVaults = await cli(['vault', 'list']); check(noVaults.items.length === 0, 'Grant removal was not immediate'); await cli(['memory', 'get', memory.id], undefined, 5);
      const beforeRevoke = await owner.ok('GET', `/api/v1/agent-accesses/${access.id}`); await owner.ok('DELETE', `/api/v1/agent-accesses/${access.id}/tokens/${issued.credential.id}?expectedRevision=${beforeRevoke.revision}`); await cli(['vault', 'list'], undefined, 3);
    });
  } finally { if (temp) await rm(temp, { recursive: true, force: true }); }
  if (process.env.MEMORYAFFE_TEST_LIFECYCLE === '1') await step('Version retention, trash tags, moves, grant lifecycle, sessions and isolated recovery', () => runLifecycle({ owner, Browser, check, same, expect, secrets, nonce, agent }));
  if (process.env.MEMORYAFFE_TEST_ADMIN_RACE === '1') await step('Last-active-admin race in isolated database and API process', () => runLastAdminRace({ Browser, processRun, check, expect, secrets, root }));
  if (process.env.MEMORYAFFE_TEST_SEARCH === '1') await step('PostgreSQL search corpus, Unicode names, 1MiB, distant phrases and language switch', async () => { searchEvidence = await runSearch({ owner, other, check, same, expect, nonce, processRun }); });
  if (process.env.MEMORYAFFE_TEST_ARCHIVES === '1') await step('ZIP roundtrip, concurrent import, cancellation and malicious archives', () => runArchives({ owner, other, base, check, same, expect, nonce }));
  if (process.env.MEMORYAFFE_TEST_OAUTH === '1') await step('OAuth discovery, MCP challenge and unsafe-client rejection', () => runOAuthSecurity({ base, check, expect }));
  if (process.env.MEMORYAFFE_TEST_TOTP === '1') await step('TOTP activation, replay rejection and atomic recovery-code race', () => runTotp({ owner, Browser, adminEmail, adminPassword, check, expect, secrets }));
  return { passed: checks.length, checks, base, reusedExistingTestAccount: reuse, searchEvidence, platform: process.platform, node: process.version, totp: process.env.MEMORYAFFE_TEST_TOTP === '1' ? 'executed' : 'not requested', oauth: process.env.MEMORYAFFE_TEST_OAUTH === '1' ? 'discovery and negative protocol only; controlled CIMD/code/refresh success not covered' : 'not requested; success flow not covered' };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runIntegration().then(async result => { console.log(JSON.stringify(result, null, 2)); if (process.env.MEMORYAFFE_TEST_REPORT) await writeFile(process.env.MEMORYAFFE_TEST_REPORT, JSON.stringify(result, null, 2) + '\n'); }).catch(error => { console.error(`FAIL after ${checks.length} checks: ${redact(error.message)}`); process.exitCode = 1; });
}
