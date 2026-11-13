import { randomBytes, randomUUID } from 'node:crypto';
import { totp } from './totp.mjs';

export async function runLifecycle({ owner, Browser, check, same, expect, secrets, nonce, agent }) {
  const vault = (name, versionLimit = 20) => owner.ok('POST', '/api/v1/vaults', { name: `Lifecycle ${nonce} ${name}`, versionLimit, searchLanguage: 'neutral' });
  const create = (v, title, tags = []) => owner.ok('POST', '/api/v1/memories', { vaultId: v.id, title, markdown: 'initial', tagIds: tags });
  const current = m => owner.ok('GET', `/api/v1/memories/${m.id}`);
  const versions = m => owner.ok('GET', `/api/v1/memories/${m.id}/versions`);
  const trashEntry = async (v, m) => (await owner.ok('GET', `/api/v1/vaults/${v.id}/trash`)).items.find(x => x.id === m.id);
  const V = await vault('limits', 0); let m = await create(V, 'Limit');
  m = await owner.ok('PATCH', `/api/v1/memories/${m.id}`, { expectedRevision: m.revision, markdown: 'change1' }); check((await versions(m)).items.length === 0, 'Version limit zero retained history');
  let vv = await owner.ok('GET', `/api/v1/vaults/${V.id}`); await owner.ok('PATCH', `/api/v1/vaults/${V.id}`, { expectedRevision: vv.revision, versionLimit: 2 });
  for (const markdown of ['change2', 'change3', 'change4']) m = await owner.ok('PATCH', `/api/v1/memories/${m.id}`, { expectedRevision: m.revision, markdown });
  same((await versions(m)).items.map(x => x.revision), ['4', '3'], 'Version retention did not keep the latest two snapshots');
  await owner.ok('DELETE', `/api/v1/memories/${m.id}?expectedRevision=${m.revision}`); const trashed = await trashEntry(V, m); check(trashed, 'Deleted record not in trash');
  vv = await owner.ok('GET', `/api/v1/vaults/${V.id}`); await owner.ok('PATCH', `/api/v1/vaults/${V.id}`, { expectedRevision: vv.revision, versionLimit: 0 });
  await owner.ok('POST', `/api/v1/trash/memories/${m.id}/restore`, { expectedRevision: trashed.revision }); check((await versions(m)).items.length === 0, 'Lowered version limit did not trim trash history');

  const T = await vault('tags'), tag = await owner.ok('POST', `/api/v1/vaults/${T.id}/tags`, { name: 'OriginalTag' }), target = await owner.ok('POST', `/api/v1/vaults/${T.id}/tags`, { name: 'TargetTag' });
  let tagged = await create(T, 'Tag lifecycle', [tag.id]); tagged = await owner.ok('PATCH', `/api/v1/memories/${tagged.id}`, { expectedRevision: tagged.revision, markdown: 'updated' });
  await owner.ok('DELETE', `/api/v1/memories/${tagged.id}?expectedRevision=${tagged.revision}`); const beforeRename = await trashEntry(T, tagged);
  const renamed = await owner.ok('PATCH', `/api/v1/vaults/${T.id}/tags/${tag.id}`, { expectedRevision: '1', name: 'RenamedTag' });
  const afterRename = await trashEntry(T, tagged); check(BigInt(afterRename.revision) === BigInt(beforeRename.revision) + 1n && afterRename.expiresAt === beforeRename.expiresAt, 'Tag rename did not version trash or changed expiry');
  await owner.ok('POST', `/api/v1/vaults/${T.id}/tags/${tag.id}/merge`, { expectedRevision: renamed.revision, targetTagId: target.id, expectedTargetRevision: '1' });
  const afterMerge = await trashEntry(T, tagged); check(BigInt(afterMerge.revision) === BigInt(afterRename.revision) + 1n, 'Tag merge did not version trash');
  await owner.ok('DELETE', `/api/v1/vaults/${T.id}/tags/${target.id}?expectedRevision=1`);
  const afterDelete = await trashEntry(T, tagged); check(BigInt(afterDelete.revision) === BigInt(afterMerge.revision) + 1n, 'Tag delete did not version trash');
  await owner.ok('POST', `/api/v1/trash/memories/${tagged.id}/restore`, { expectedRevision: afterDelete.revision });
  check((await current(tagged)).tags.length === 0, 'Deleted tag survived trash restore');
  const earliest = await owner.ok('GET', `/api/v1/memories/${tagged.id}/versions/1`); same(earliest.tagNames, ['OriginalTag'], 'Historical tag names were rewritten');

  const A = await vault('move-source'), B = await vault('move-target');
  const ta = await owner.ok('POST', `/api/v1/vaults/${A.id}/tags`, { name: 'MoveTag' }), tb = await owner.ok('POST', `/api/v1/vaults/${B.id}/tags`, { name: 'movetag' });
  let moved = await create(A, 'Move identity', [ta.id]); moved = await owner.ok('PATCH', `/api/v1/memories/${moved.id}`, { expectedRevision: moved.revision, markdown: 'history preserved' });
  const priorHistory = await versions(moved);
  const access = async (v, level) => { const a = await owner.proved('POST', '/api/v1/agent-accesses', { name: `Lifecycle ${nonce} ${v.id}`, grants: [{ vaultId: v.id, level }] }, 'web_create_agent_access'); const issued = await owner.proved('POST', `/api/v1/agent-accesses/${a.id}/tokens`, { expectedRevision: a.revision, lifetimeDays: 30 }, 'web_issue_token', { id: a.id }); secrets.add(issued.token); return { ...a, token: issued.token }; };
  const sourceAccess = await access(A, 'delete'), targetAccess = await access(B, 'read');
  expect(await agent(sourceAccess.token, 'GET', `/api/v1/memories/${moved.id}`), 200); expect(await agent(targetAccess.token, 'GET', `/api/v1/memories/${moved.id}`), 404, 'not_found');
  const result = await owner.ok('POST', `/api/v1/memories/${moved.id}/move`, { expectedRevision: moved.revision, targetVaultId: B.id }); check(result.id === moved.id && BigInt(result.revision) === BigInt(moved.revision) + 1n, 'Move changed identity or failed revision');
  same((await versions(moved)).items, priorHistory.items, 'Move rewrote content history');
  const afterMove = await current(moved); check(afterMove.vaultId === B.id && afterMove.tags.length === 1 && afterMove.tags[0].id === tb.id, 'Move did not reuse target-vault tag');
  expect(await agent(sourceAccess.token, 'GET', `/api/v1/memories/${moved.id}`), 404, 'not_found'); expect(await agent(targetAccess.token, 'GET', `/api/v1/memories/${moved.id}`), 200);
  expect(await agent(targetAccess.token, 'PATCH', `/api/v1/memories/${moved.id}`, { expectedRevision: result.revision, title: 'denied' }), 403, 'permission_denied');
  const individuallyDeleted = await create(A, 'Remain individually deleted'); await owner.ok('DELETE', `/api/v1/memories/${individuallyDeleted.id}?expectedRevision=${individuallyDeleted.revision}`);
  const activeInVault = await create(A, 'Returns with vault');
  let av = await owner.ok('GET', `/api/v1/vaults/${A.id}`); const deletedVault = await owner.ok('DELETE', `/api/v1/vaults/${A.id}?expectedRevision=${av.revision}`);
  expect(await owner.request('POST', '/api/v1/vaults', { name: A.name }), 409, 'name_conflict');
  const noGrants = await owner.ok('GET', `/api/v1/agent-accesses/${sourceAccess.id}`); check(noGrants.grants.length === 0 && BigInt(noGrants.revision) > BigInt(sourceAccess.revision), 'Vault trash did not revoke grants/revision');
  await owner.ok('POST', `/api/v1/trash/vaults/${A.id}/restore`, { expectedRevision: deletedVault.revision });
  const afterVaultRestore = await owner.ok('GET', `/api/v1/agent-accesses/${sourceAccess.id}`); check(afterVaultRestore.grants.length === 0, 'Vault restoration resurrected grants');
  await current(activeInVault); expect(await owner.request('GET', `/api/v1/memories/${individuallyDeleted.id}`), 404, 'not_found'); expect(await agent(sourceAccess.token, 'GET', `/api/v1/memories/${activeInVault.id}`), 404, 'not_found');

  // New account only: session/reset/recovery never touches the shared test admin.
  const email = `lifecycle-user-${nonce}@example.test`, password = randomBytes(24).toString('base64url'); secrets.add(password);
  const invitation = await owner.ok('POST', '/api/v1/admin/invitations', { email, role: 'user', sendEmail: false }); const inviteToken = new URLSearchParams(new URL(invitation.link.url).hash.slice(1)).get('token'); secrets.add(inviteToken);
  const user = new Browser({ password }); await user.refreshCsrf(); const profile = await user.ok('POST', '/api/v1/auth/invitations/redeem', { token: inviteToken, password }); await user.refreshCsrf();
  const onlyVault = await user.ok('POST', '/api/v1/vaults', { name: 'Only vault' }); await user.ok('DELETE', `/api/v1/vaults/${onlyVault.id}?expectedRevision=${onlyVault.revision}`); check((await user.ok('GET', '/api/v1/vaults')).items.length === 0, 'Last own vault could not be deleted');
  const second = new Browser({ password }); await second.refreshCsrf(); await second.ok('POST', '/api/v1/auth/login', { email, password }); await second.refreshCsrf();
  await user.ok('POST', '/api/v1/me/sessions/revoke-others', {}); expect(await second.request('GET', '/api/v1/me'), 401, 'authentication_required'); await user.ok('GET', '/api/v1/me');
  const reset = await owner.ok('POST', `/api/v1/admin/accounts/${profile.id}/password-reset`, { expectedRevision: profile.revision, sendEmail: false }); const resetToken = new URLSearchParams(new URL(reset.url).hash.slice(1)).get('token'); secrets.add(resetToken);
  const newPassword = '😀'.repeat(128); secrets.add(newPassword); const resetBrowser = new Browser({ password: newPassword }); await resetBrowser.refreshCsrf();
  for (const invalid of ['😀'.repeat(14), '😀'.repeat(129)]) {
    const rejected = await resetBrowser.request('POST', '/api/v1/auth/password-reset/redeem', { token: resetToken, newPassword: invalid });
    expect(rejected, 400, 'validation_failed'); check(rejected.data.message === 'Neues Passwort benötigt 15 bis 128 Zeichen.', 'Reset must explain the new-password limits');
  }
  await resetBrowser.ok('POST', '/api/v1/auth/password-reset/redeem', { token: resetToken, newPassword });
  expect(await user.request('GET', '/api/v1/me'), 401, 'authentication_required'); expect(await resetBrowser.request('POST', '/api/v1/auth/password-reset/redeem', { token: resetToken, newPassword }), 410, 'flow_expired');
  await resetBrowser.ok('POST', '/api/v1/auth/login', { email, password: newPassword }); await resetBrowser.refreshCsrf();
  const setup = await resetBrowser.proved('POST', '/api/v1/me/totp/setup', {}, 'web_setup_totp'); secrets.add(setup.secret); const code = totp(setup.secret); secrets.add(code); const codes = await resetBrowser.ok('POST', '/api/v1/me/totp/confirm', { setupId: setup.setupId, code }); for (const c of codes.codes) secrets.add(c);
  const targetProfile = await resetBrowser.ok('GET', '/api/v1/me');
  const recovery = await owner.proved('POST', `/api/v1/admin/accounts/${profile.id}/account-recovery`, { expectedRevision: targetProfile.revision, sendEmail: false }, 'admin_issue_recovery', { id: profile.id }); const recoveryToken = new URLSearchParams(new URL(recovery.url).hash.slice(1)).get('token'); secrets.add(recoveryToken);
  const recoveredPassword = randomBytes(24).toString('base64url'); secrets.add(recoveredPassword); const recovered = new Browser({ password: recoveredPassword }); await recovered.refreshCsrf(); await recovered.ok('POST', '/api/v1/auth/account-recovery/redeem', { token: recoveryToken, newPassword: recoveredPassword });
  expect(await resetBrowser.request('GET', '/api/v1/me'), 401, 'authentication_required'); const login = await recovered.ok('POST', '/api/v1/auth/login', { email, password: recoveredPassword }); check(login.status === 'authenticated' && login.profile.totpEnabled === false, 'Recovery did not clear lost second factor');
  return { mainAdminUntouched: true, versionLimits: [0, 2], isolatedUserResetRecovery: true };
}
