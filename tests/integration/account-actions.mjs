import { randomBytes } from 'node:crypto';

export async function runAccountActions({ owner, Browser, check, expect, secrets, nonce }) {
  for (const deletion of ['self', 'admin']) {
    const password = randomBytes(24).toString('base64url'); secrets.add(password);
    const email = `actions-${deletion}-${nonce}@example.test`;
    const invitation = await owner.ok('POST', '/api/v1/admin/invitations', { email, role: 'admin', sendEmail: false });
    const token = new URLSearchParams(new URL(invitation.link.url).hash.slice(1)).get('token'); secrets.add(token);
    const user = new Browser({ password }); await user.refreshCsrf();
    let account = await user.ok('POST', '/api/v1/auth/invitations/redeem', { token, password }); await user.refreshCsrf();
    check(account.role === 'admin', 'Admin invitation should work without password confirmation');
    const target = `/api/v1/admin/accounts/${account.id}`;
    account = await owner.ok('PATCH', target, { expectedRevision: account.revision, role: 'user', email: `changed-${email}` });
    check(account.role === 'user' && account.email === `changed-${email}`, 'Admin role and email changes failed');
    const recovery = await owner.ok('POST', target + '/account-recovery', { expectedRevision: account.revision, sendEmail: false });
    secrets.add(recovery.url); check(recovery.url.includes('/recover-account#token='), 'Recovery link missing');
    expect(await user.request('PATCH', target, { expectedRevision: account.revision, role: 'admin' }), 403, 'permission_denied');
    expect(await user.request('POST', '/api/v1/me/change-password', { currentPassword: 'incorrect-password', newPassword: password }), 401, 'authentication_required');
    const changed = randomBytes(24).toString('base64url'); secrets.add(changed);
    await user.ok('POST', '/api/v1/me/change-password', { currentPassword: password, newPassword: changed }); user.password = changed;
    account = await user.ok('GET', '/api/v1/me');
    const actor = deletion === 'self' ? user : owner;
    const operationId = deletion === 'self' ? 'web_delete_account' : 'admin_delete_account';
    const query = { expectedRevision: account.revision }, path = deletion === 'self' ? {} : { id: account.id };
    const url = (deletion === 'self' ? '/api/v1/me' : target) + `?expectedRevision=${account.revision}`;
    expect(await actor.request('DELETE', url), 403, 'reauthentication_required');
    const proof = await actor.ok('POST', '/api/v1/me/reauthenticate', { password: actor.password, request: { operationId, path, query, body: null } }); secrets.add(proof.proof);
    expect(await actor.request('DELETE', url, undefined, { csrf: false, headers: { 'X-Action-Proof': proof.proof } }), 403, 'csrf_failed');
    await actor.ok('DELETE', url, undefined, { headers: { 'X-Action-Proof': proof.proof } });
    expect(await user.request('GET', '/api/v1/me'), 401, 'authentication_required');
  }
}
