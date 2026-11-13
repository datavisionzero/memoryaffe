import { createHmac } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

export function totp(secret) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = '';
  for (const c of secret.toUpperCase().replaceAll('=', '')) { const n = alphabet.indexOf(c); if (n < 0) throw new Error('TOTP setup secret is not Base32'); bits += n.toString(2).padStart(5, '0'); }
  const key = Buffer.from(bits.match(/.{8}/g).map(b => Number.parseInt(b, 2)));
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const hmac = createHmac('sha1', key).update(counter).digest(); const offset = hmac.at(-1) & 15;
  return String((hmac.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, '0');
}

export async function runTotp({ owner, Browser, adminEmail, adminPassword, check, expect, secrets }) {
  const setup = await owner.proved('POST', '/api/v1/me/totp/setup', {}, 'web_setup_totp');
  secrets.add(setup.secret); secrets.add(setup.otpauthUri);
  // Keep confirmation and replay in the same time step without a 30-second wait.
  const remaining = 30000 - Date.now() % 30000; if (remaining < 3000) await delay(remaining + 50);
  const code = totp(setup.secret); secrets.add(code);
  const recovery = await owner.ok('POST', '/api/v1/me/totp/confirm', { setupId: setup.setupId, code });
  check(Array.isArray(recovery.codes) && recovery.codes.length === 10, 'Expected ten recovery codes');
  check(new Set(recovery.codes).size === 10, 'Recovery codes must be distinct');
  check(recovery.codes.every(c => typeof c === 'string' && c.length >= 32), 'Recovery code representation must retain at least 128 bits');
  for (const c of recovery.codes) secrets.add(c);
  const profile = await owner.ok('GET', '/api/v1/me'); check(profile.totpEnabled === true, 'TOTP not enabled');
  check(!JSON.stringify(profile).includes(setup.secret), 'Profile leaked TOTP secret');
  const login = async (rememberMe = false) => { const browser = new Browser(); await browser.refreshCsrf(); const result = await browser.ok('POST', '/api/v1/auth/login', { email: adminEmail, password: adminPassword, rememberMe }); check(result.status === 'secondFactorRequired', 'TOTP login did not require factor'); expect(await browser.request('GET', '/api/v1/me'), 401, 'authentication_required'); await browser.refreshCsrf(); return browser; };
  const replay = await login(); expect(await replay.request('POST', '/api/v1/auth/login/second-factor', { factor: { kind: 'totp', code } }), 401, 'authentication_required');
  const browsers = await Promise.all([login(), login()]);
  const concurrent = await Promise.all(browsers.map(browser => browser.request('POST', '/api/v1/auth/login/second-factor', { factor: { kind: 'recoveryCode', code: recovery.codes[0] } })));
  check(concurrent.filter(r => r.status === 200).length === 1 && concurrent.filter(r => r.status === 401).length === 1, 'Recovery-code race must authenticate exactly once');
  for (const [rememberMe, days, index] of [[false, 7, 2], [true, 30, 3]]) {
    const browser = await login(rememberMe);
    const signedIn = await browser.request('POST', '/api/v1/auth/login/second-factor', { factor: { kind: 'recoveryCode', code: recovery.codes[index] } });
    expect(signedIn, 200);
    const cookie = signedIn.headers.getSetCookie().find(c => /^(?:__Host-)?memoryaffe\.session=/.test(c));
    check(cookie?.includes(`max-age=${days * 86400}`), 'Second-factor cookie lifetime differs from rememberMe');
    await browser.refreshCsrf();
    const sessions = await browser.ok('GET', '/api/v1/me/sessions'), current = sessions.items.find(s => s.current);
    const lifetime = Date.parse(current.expiresAt) - Date.parse(current.createdAt);
    check(Math.abs(lifetime - days * 86400000) < 1000, 'Second-factor server session lifetime differs from cookie');
  }
  const request = { operationId: 'web_disable_totp', path: {}, query: {}, body: {} };
  const proof = await owner.ok('POST', '/api/v1/me/reauthenticate', { password: adminPassword, factor: { kind: 'recoveryCode', code: recovery.codes[1] }, request }); secrets.add(proof.proof);
  await owner.ok('POST', '/api/v1/me/totp/disable', {}, { headers: { 'X-Action-Proof': proof.proof } });
  const disabled = await owner.ok('GET', '/api/v1/me'); check(disabled.totpEnabled === false, 'TOTP disable failed');
}
