import { existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// A separate database and process protect the shared test administrator.
export async function runLastAdminRace({ Browser, processRun, check, expect, secrets, root }) {
  const password = process.env.MEMORYAFFE_TEST_DATABASE_PASSWORD; check(password, 'Admin race requires MEMORYAFFE_TEST_DATABASE_PASSWORD');
  const database = 'memoryaffe_lifecycle_' + randomBytes(6).toString('hex'); check(/^memoryaffe_lifecycle_[a-f0-9]{12}$/.test(database), 'Unsafe lifecycle database name');
  const docker = process.env.MEMORYAFFE_TEST_DOCKER ?? 'docker', sql = command => processRun(docker, ['exec', '-e', 'PGPASSWORD', 'memoryaffe-dev-pg', 'psql', '-U', 'memoryaffe', '-d', 'memoryaffe', '-v', 'ON_ERROR_STOP=1', '-c', command], { env: { ...process.env, PGPASSWORD: password } });
  const created = await sql(`CREATE DATABASE "${database}";`); check(created.code === 0, 'Could not create isolated last-admin test database');
  const directory = await mkdtemp(join(tmpdir(), 'memoryaffe-adminrace-')); let child;
  try {
    const setupSecret = randomBytes(32).toString('hex'), adminPassword = randomBytes(24).toString('base64url'), baseUrl = 'http://127.0.0.1:5081'; secrets.add(setupSecret); secrets.add(adminPassword);
    const debug = join(root, 'src', 'Memoryaffe.Api', 'bin', 'Debug', 'net10.0', 'Memoryaffe.Api.dll'), release = join(root, 'src', 'Memoryaffe.Api', 'bin', 'Release', 'net10.0', 'Memoryaffe.Api.dll'), published = join(root, '.tools', 'ci-app', 'Memoryaffe.Api.dll');
    const candidates = process.env.CI ? [published, release, debug] : [debug, release, published];
    const assembly = process.env.MEMORYAFFE_TEST_API_ASSEMBLY ?? candidates.find(existsSync); check(assembly && existsSync(assembly), 'Isolated admin race requires a built API assembly (MEMORYAFFE_TEST_API_ASSEMBLY)');
    child = spawn(process.env.MEMORYAFFE_TEST_DOTNET ?? 'dotnet', [assembly], { cwd: join(root, 'src', 'Memoryaffe.Api'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ASPNETCORE_ENVIRONMENT: 'Development', ASPNETCORE_URLS: baseUrl, Memoryaffe__BaseUrl: baseUrl, Memoryaffe__SetupSecret: setupSecret, Memoryaffe__KeyDirectory: directory, MEMORYAFFE_IMPORT_DIRECTORY: join(directory, 'imports'), ConnectionStrings__Database: `Host=127.0.0.1;Port=55432;Database=${database};Username=memoryaffe;Password="${password.replaceAll('"', '""')}"` } });
    let startError = false; child.on('error', () => { startError = true; }); child.stdout.resume(); child.stderr.resume();
    let ready = false;
    for (let i = 0; i < 300; i++) { if (startError || child.exitCode !== null) break; try { const r = await fetch(baseUrl + '/health/ready', { signal: AbortSignal.timeout(1000) }); if (r.status === 200) { ready = true; break; } } catch {} await new Promise(r => setTimeout(r, 100)); }
    check(ready, 'Isolated last-admin API failed to become ready');
    const first = new Browser({ baseUrl, password: adminPassword }); await first.refreshCsrf(); const a = await first.ok('POST', '/api/v1/setup', { setupSecret, email: 'first-admin@example.test', password: adminPassword }); await first.refreshCsrf();
    const invite = await first.proved('POST', '/api/v1/admin/invitations', { email: 'second-admin@example.test', role: 'admin', sendEmail: false }, 'admin_invite');
    const token = new URLSearchParams(new URL(invite.link.url).hash.slice(1)).get('token'); secrets.add(token);
    const second = new Browser({ baseUrl, password: adminPassword }); await second.refreshCsrf(); const b = await second.ok('POST', '/api/v1/auth/invitations/redeem', { token, password: adminPassword }); await second.refreshCsrf();
    const race = await Promise.all([[first, a], [second, b]].map(([browser, profile]) => browser.request('PATCH', `/api/v1/admin/accounts/${profile.id}`, { expectedRevision: profile.revision, status: 'suspended' })));
    check(race.filter(r => r.status === 200).length === 1 && race.filter(r => r.status === 409).length === 1, 'Last-active-admin race must allow exactly one suspension'); expect(race.find(r => r.status === 409), 409, 'last_admin_required');
    const remaining = race[0].status === 409 ? first : second, list = await remaining.ok('GET', '/api/v1/admin/accounts'); check(list.items.filter(x => x.role === 'admin' && x.status === 'active').length === 1, 'Race left zero or multiple active admins');
    return { isolatedDatabase: true, sharedAdminTouched: false, exactlyOneActiveAdmin: true };
  } finally {
    if (child && child.exitCode === null) { const ended = new Promise(resolve => child.once('close', resolve)); child.kill(); await Promise.race([ended, new Promise(resolve => { const timer = setTimeout(resolve, 5000); timer.unref(); })]); }
    const dropped = await sql(`DROP DATABASE "${database}" WITH (FORCE);`); check(dropped.code === 0, 'Isolated last-admin database cleanup failed');
    await rm(directory, { recursive: true, force: true });
  }
}
