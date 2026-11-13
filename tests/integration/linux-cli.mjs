import { Browser } from './api-cli.mjs';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
async function main() {
  const email = process.env.MEMORYAFFE_TEST_ADMIN_EMAIL, password = process.env.MEMORYAFFE_TEST_ADMIN_PASSWORD;
  if (!email || !password) throw new Error('Explicit test admin credentials required');
  const owner = new Browser(); await owner.refreshCsrf(); await owner.ok('POST', '/api/v1/auth/login', { email, password }); await owner.refreshCsrf();
  const vault = await owner.ok('POST', '/api/v1/vaults', { name: 'Linux native ' + randomUUID(), searchLanguage: 'neutral', versionLimit: 20 });
  const profile = await owner.ok('GET', '/api/v1/me'); if (!profile.allowAgentTagCreation) await owner.proved('PATCH', '/api/v1/me', { expectedRevision: profile.revision, allowAgentTagCreation: true }, 'web_update_profile');
  const access = await owner.proved('POST', '/api/v1/agent-accesses', { name: 'Linux native smoke', grants: [{ vaultId: vault.id, level: 'delete' }] }, 'web_create_agent_access');
  const issued = await owner.proved('POST', `/api/v1/agent-accesses/${access.id}/tokens`, { expectedRevision: access.revision, lifetimeDays: 30 }, 'web_issue_token', { id: access.id });
  try {
    const image = process.env.MEMORYAFFE_TEST_GO_IMAGE ?? 'golang@sha256:4fa7c968ba93f1635670522dbb01a2c78150443e1385746924566079f36570ea';
    const args = ['run', '--rm', '--mount', `type=bind,src=${resolve(root, 'src/cli')},dst=/cli,readonly`, '--mount', `type=bind,src=${resolve(root, 'tests/integration')},dst=/test,readonly`, '--env', 'MEMORYAFFE_TOKEN', '--env', 'MEMORYAFFE_SERVER', '--env', 'MEMORYAFFE_TEST_VAULT', '--env', 'MEMORYAFFE_PROXY_TARGET', image, 'sh', '/test/linux-cli.sh'];
    const code = await new Promise((resolveRun, reject) => { const child = spawn(process.env.MEMORYAFFE_TEST_DOCKER ?? 'docker', args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, MEMORYAFFE_TOKEN: issued.token, MEMORYAFFE_SERVER: 'http://127.0.0.1:15080', MEMORYAFFE_TEST_VAULT: vault.id, MEMORYAFFE_PROXY_TARGET: process.env.MEMORYAFFE_TEST_PROXY_TARGET ?? 'http://host.docker.internal:5080' } }); child.stdout.on('data', b => process.stdout.write(b.toString().split(issued.token).join('[REDACTED]'))); child.stderr.on('data', b => process.stderr.write(b.toString().split(issued.token).join('[REDACTED]'))); child.on('error', () => reject(new Error('Docker native-Linux runner could not start'))); child.on('close', resolveRun); });
    if (code !== 0) throw new Error(`Native Linux container exited ${code}`);
  } finally { const live = await owner.ok('GET', `/api/v1/agent-accesses/${access.id}`); await owner.ok('DELETE', `/api/v1/agent-accesses/${access.id}/tokens/${issued.credential.id}?expectedRevision=${live.revision}`); }
}
main().catch(error => { console.error('FAIL ' + error.message); process.exitCode = 1; });
