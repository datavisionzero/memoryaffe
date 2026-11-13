// Planning contract, not server code. Run after build.mjs.
import { readFileSync, writeFileSync } from 'node:fs';
const load = name => JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));
const save = (name, data) => writeFileSync(new URL(name, import.meta.url), JSON.stringify(data, null, 2) + '\n');
const api = structuredClone(load('agent.openapi.json'));
api.info = { title: 'memoryaffe browser and administration API — planning contract', version: '0.1.0', description: 'Cookie-authenticated browser surface. No agent credential authorizes administrative or user-only operations. Semantics: WEB_CONTRACT.md and WEB_PROTOCOL.md.' };
api.security = [{ webSession: [] }];
api.components.securitySchemes = {
  webSession: { type: 'apiKey', in: 'cookie', name: '__Host-memoryaffe-session', description: 'Secure HttpOnly SameSite=Lax; server-revocable. HTTPS outside local development.' },
  csrf: { type: 'apiKey', in: 'header', name: 'X-CSRF-Token', description: 'ASP.NET Core antiforgery request token, paired with browser antiforgery cookie.' }
};
const s = api.components.schemas;
const ref = name => ({ $ref: `#/components/schemas/${name}` });
const obj = (properties, required = Object.keys(properties)) => ({ type: 'object', properties, required, additionalProperties: false });
const str = { type: 'string' }, bool = { type: 'boolean' };
const int = { type: 'integer', minimum: 0 };
const en = (...values) => ({ type: 'string', enum: values });
const arr = items => ({ type: 'array', items });
const nullable = schema => ({ anyOf: [schema, { type: 'null' }] });
const id = ref('Id'), rev = ref('Revision'), time = ref('Timestamp');
const text = maxLength => ({ type: 'string', minLength: 1, maxLength });
const email = { type: 'string', format: 'email', maxLength: 254 };
const password = { type: 'string', minLength: 15, maxLength: 128, writeOnly: true };
const oldPassword = { type: 'string', minLength: 1, maxLength: 128, writeOnly: true };
const secret = { type: 'string', minLength: 1, maxLength: 1024, writeOnly: true };
const tokenOutput = { type: 'string', minLength: 1, maxLength: 2048, description: 'Secret; no logs, URLs or persistent browser storage.' };
const page = { pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 }, cursor: s.ListVaultsInput.properties.cursor };
const list = item => obj({ items: arr(item), nextCursor: nullable(s.ListVaultsInput.properties.cursor) });
const lang = en('neutral', 'de', 'en');
const limit = { type: 'integer', minimum: 0, maximum: 100, default: 20 };
const factor = { oneOf: [obj({ kind: { const: 'totp' }, code: { type: 'string', pattern: '^[0-9]{6}$(?![\\s\\S])' } }), obj({ kind: { const: 'recoveryCode' }, code: text(128) })] };
Object.assign(s, {
  Ok: obj({ ok: { const: true } }),
  Profile: obj({ id, email, role: en('user', 'admin'), revision: rev, theme: en('dark', 'light', 'system'), language: en('de', 'en'), allowAgentTagCreation: bool, totpEnabled: bool, emailVerified: bool, smtpEnabled: bool }),
  ProfilePatch: obj({ expectedRevision: rev, theme: en('dark', 'light', 'system'), language: en('de', 'en'), allowAgentTagCreation: bool }, []),
  Session: obj({ id, browser: str, device: str, createdAt: time, lastActiveAt: time, expiresAt: time, current: bool }),
  WebVault: obj({ id, name: text(100), revision: rev, searchLanguage: lang, pendingSearchLanguage: nullable(lang), versionLimit: limit, activeRecordCount: int, createdAt: time, updatedAt: time }),
  WebTag: obj({ id, name: text(50), revision: rev }),
  VaultCreate: obj({ name: text(100), searchLanguage: lang, versionLimit: limit }, ['name']),
  VaultPatch: obj({ expectedRevision: rev, name: text(100), searchLanguage: lang, versionLimit: limit }, ['expectedRevision']),
  ExpectedRevision: obj({ expectedRevision: rev }),
  Grant: obj({ vaultId: id, level: en('read', 'write', 'delete') }),
  AgentAccess: obj({ id, name: text(100), revision: rev, kind: en('cli', 'oauth'), grants: arr(ref('Grant')), createdAt: time, lastUsedAt: nullable(time), clientId: nullable({ type: 'string', format: 'uri' }) }),
  AgentCreate: obj({ name: text(100), grants: { ...arr(ref('Grant')), minItems: 1 } }),
  AgentPatch: obj({ expectedRevision: rev, name: text(100), grants: arr(ref('Grant')) }, ['expectedRevision']),
  Credential: obj({ id, createdAt: time, expiresAt: nullable(time), lastUsedAt: nullable(time), revokedAt: nullable(time) }),
  TokenCreate: obj({ expectedRevision: rev, lifetimeDays: { enum: [30, 90, 365, null], default: 90 }, replacesTokenId: id, overlapSeconds: { type: 'integer', minimum: 0, maximum: 86400, default: 0 } }, ['expectedRevision']),
  TokenIssued: obj({ credential: ref('Credential'), token: tokenOutput, agentRevision: rev }),
  Actor: obj({ kind: en('user', 'agent', 'import'), id: nullable(id), name: str }),
  Version: obj({ revision: rev, title: s.Memory.properties.title, summary: s.Memory.properties.summary, markdown: s.Memory.properties.markdown, tagNames: { ...arr(text(50)), maxItems: 50 }, savedAt: time, actor: ref('Actor') }),
  VersionSummary: obj({ revision: rev, savedAt: time, actor: ref('Actor') }),
  RestorePreview: obj({ sourceRevision: rev, currentRevision: rev, restoreToken: tokenOutput, tagsToCreate: arr(text(50)), tagsToReuse: arr(ref('WebTag')) }),
  TrashMemory: obj({ id, vaultId: id, title: s.Memory.properties.title, revision: rev, deletedAt: time, expiresAt: time }),
  TrashVault: obj({ id, name: text(100), revision: rev, deletedAt: time, expiresAt: time, recordCount: int }),
  ImportPreparation: obj({ id, state: en('ready', 'completed'), expiresAt: time, suggestedName: text(100), recordCount: int, tagCount: int, searchLanguage: lang, versionLimit: limit, resultVaultId: nullable(id) }),
  Account: obj({ id, email, role: en('user', 'admin'), status: en('active', 'suspended'), revision: rev, totpEnabled: bool, createdAt: time }),
  AccountPatch: obj({ expectedRevision: rev, role: en('user', 'admin'), status: en('active', 'suspended'), email }, ['expectedRevision']),
  Invitation: obj({ id, email, role: en('user', 'admin'), createdAt: time, expiresAt: time, status: en('pending', 'redeemed', 'revoked', 'expired') }),
  LinkIssued: obj({ url: { type: 'string', format: 'uri', description: 'One-time secret link; display only in issuing response.' }, expiresAt: time, delivery: en('manual', 'sent', 'failed') }),
  ReauthResult: obj({ proof: tokenOutput, expiresAt: time }),
  Factor: factor,
  LoginResult: { oneOf: [obj({ status: { const: 'authenticated' }, profile: ref('Profile') }), obj({ status: { const: 'secondFactorRequired' }, expiresAt: time })] },
  RecoveryCodes: obj({ codes: { ...arr(text(128)), minItems: 10, maxItems: 10, uniqueItems: true } })
});
s.ProfilePatch.allOf = [{ if: { required: ['allowAgentTagCreation'] }, then: { required: ['expectedRevision'] } }];
for (const code of ['csrf_failed', 'reauthentication_required', 'flow_expired', 'import_expired', 'last_admin_required', 'smtp_unavailable']) s.Error.properties.code.enum.push(code);
// Browser equivalents of the eight shared content operations.
for (const [path, methods] of Object.entries(api.paths)) for (const [method, op] of Object.entries(methods)) {
  op.operationId = `web_${op.operationId}`;
  op.security = method === 'get' ? [{ webSession: [] }] : [{ webSession: [], csrf: [] }];
  op.description = 'Own account content; shared application rules. Browser session authentication.';
}
const added = [];
function route(method, suffix, operationId, input, output = ref('Ok'), options = {}) {
  const path = '/api/v1' + suffix;
  const parameters = [...suffix.matchAll(/\{(\w+)\}/g)].map(([, name]) => ({ name, in: 'path', required: true, schema: name === 'revision' ? rev : id }));
  const inputSchema = typeof input === 'string' ? ref(input) : input;
  if (options.query) for (const [name, schema] of Object.entries(options.query)) parameters.push({ name, in: 'query', required: (options.requiredQuery ?? []).includes(name), schema });
  if (options.proof) parameters.push({ name: 'X-Action-Proof', in: 'header', required: options.proof === true, schema: tokenOutput, description: 'Required for the sensitive action or rights expansion; see WEB_PROTOCOL.md.' });
  if (options.retry) parameters.push({ name: 'Idempotency-Key', in: 'header', required: true, schema: { type: 'string', minLength: 1, maxLength: 128, pattern: '^[A-Za-z0-9_.:-]+$(?![\\s\\S])' } });
  const op = { operationId, parameters, security: options.public ? (method === 'get' ? [] : [{ csrf: [] }]) : (method === 'get' ? [{ webSession: [] }] : [{ webSession: [], csrf: [] }]),
    'x-account-scope': options.admin ? 'admin-metadata-only' : options.public ? 'anonymous-flow' : 'own-account',
    responses: { [options.status ?? '200']: { description: 'Success', content: { [options.zip ? 'application/zip' : 'application/json']: { schema: options.zip ? { type: 'string', format: 'binary' } : output } } }, default: { description: 'Product error; see WEB_PROTOCOL.md.', content: { 'application/json': { schema: ref('Error') } } } } };
  if (inputSchema) op.requestBody = { required: true, content: { [options.multipart ? 'multipart/form-data' : 'application/json']: { schema: inputSchema } } };
  if (options.admin) op.description = 'Active admin required; no other-account content access.';
  (api.paths[path] ??= {})[method] = op;
  added.push({ method, path, op, inputSchema, options });
}
const revisionQuery = { query: { expectedRevision: rev }, requiredQuery: ['expectedRevision'] };
route('get', '/auth/csrf', 'web_get_csrf', null, obj({ requestToken: tokenOutput, headerName: { const: 'X-CSRF-Token' } }), { public: true });
route('get', '/setup', 'web_setup_status', null, obj({ setupRequired: bool }), { public: true });
route('post', '/setup', 'web_setup', obj({ setupSecret: secret, email, password }), ref('Profile'), { public: true, status: '201' });
route('post', '/auth/login', 'web_login', obj({ email, password: oldPassword, rememberMe: bool }, ['email', 'password']), ref('LoginResult'), { public: true });
route('post', '/auth/login/second-factor', 'web_login_factor', obj({ factor: ref('Factor') }), ref('Profile'), { public: true });
route('post', '/auth/logout', 'web_logout', obj({}));
route('get', '/me', 'web_get_profile', null, ref('Profile'));
route('patch', '/me', 'web_update_profile', 'ProfilePatch', ref('Profile'), { proof: 'conditional' });
route('delete', '/me', 'web_delete_account', null, ref('Ok'), { ...revisionQuery, proof: true });
route('get', '/me/sessions', 'web_list_sessions', null, list(ref('Session')), { query: page });
route('delete', '/me/sessions/{id}', 'web_revoke_session', null);
route('post', '/me/sessions/revoke-others', 'web_revoke_other_sessions', obj({}));
route('post', '/me/change-password', 'web_change_password', obj({ currentPassword: oldPassword, newPassword: password }));
route('post', '/me/email-change', 'web_request_email_change', obj({ currentPassword: oldPassword, newEmail: email }));
route('post', '/auth/email-change/confirm', 'web_confirm_email', obj({ token: secret }), ref('Ok'), { public: true });
route('post', '/auth/invitations/redeem', 'web_redeem_invitation', obj({ token: secret, password }), ref('Profile'), { public: true, status: '201' });
route('post', '/auth/password-reset/request', 'web_request_password_reset', obj({ email }), ref('Ok'), { public: true });
route('post', '/auth/password-reset/redeem', 'web_redeem_password_reset', obj({ token: secret, newPassword: password }), ref('Ok'), { public: true });
route('post', '/auth/account-recovery/redeem', 'web_redeem_recovery', obj({ token: secret, newPassword: password }), ref('Ok'), { public: true });
route('post', '/me/totp/setup', 'web_setup_totp', obj({}), obj({ setupId: id, secret: tokenOutput, otpauthUri: { type: 'string', format: 'uri' }, expiresAt: time }), { proof: true });
route('post', '/me/totp/confirm', 'web_confirm_totp', obj({ setupId: id, code: { type: 'string', pattern: '^[0-9]{6}$(?![\\s\\S])' } }), ref('RecoveryCodes'));
route('post', '/me/totp/disable', 'web_disable_totp', obj({}), ref('Ok'), { proof: true });
route('post', '/me/totp/recovery-codes', 'web_replace_recovery_codes', obj({}), ref('RecoveryCodes'), { proof: true });
route('get', '/vaults', 'web_list_vaults', null, list(ref('WebVault')), { query: page });
route('get', '/vaults/{id}', 'web_get_vault', null, ref('WebVault'));
route('post', '/vaults', 'web_create_vault', 'VaultCreate', ref('WebVault'), { status: '201' });
route('patch', '/vaults/{id}', 'web_update_vault', 'VaultPatch', ref('WebVault'));
route('delete', '/vaults/{id}', 'web_delete_vault', null, ref('WriteResult'), revisionQuery);
route('get', '/vaults/{vaultId}/tags', 'web_list_tags', null, list(ref('WebTag')), { query: page });
route('post', '/vaults/{vaultId}/tags', 'web_create_tag', obj({ name: text(50) }), ref('WebTag'), { status: '201' });
route('patch', '/vaults/{vaultId}/tags/{id}', 'web_rename_tag', obj({ expectedRevision: rev, name: text(50) }), ref('WebTag'));
route('delete', '/vaults/{vaultId}/tags/{id}', 'web_delete_tag', null, ref('Ok'), revisionQuery);
route('post', '/vaults/{vaultId}/tags/{id}/merge', 'web_merge_tags', obj({ expectedRevision: rev, targetTagId: id, expectedTargetRevision: rev }), ref('WebTag'));
route('post', '/memories/{id}/move', 'web_move_memory', obj({ expectedRevision: rev, targetVaultId: id }), ref('WriteResult'));
route('get', '/memories/{id}/versions', 'web_list_versions', null, list(ref('VersionSummary')), { query: page });
route('get', '/memories/{id}/versions/{revision}', 'web_get_version', null, ref('Version'));
route('get', '/memories/{id}/versions/{revision}/restore-preview', 'web_preview_restore', null, ref('RestorePreview'));
route('post', '/memories/{id}/restore-version', 'web_restore_version', obj({ expectedRevision: rev, sourceRevision: rev, restoreToken: secret }), ref('WriteResult'));
route('get', '/trash/vaults', 'web_list_trashed_vaults', null, list(ref('TrashVault')), { query: page });
route('get', '/vaults/{id}/trash', 'web_list_trashed_memories', null, list(ref('TrashMemory')), { query: page });
for (const kind of ['vaults', 'memories']) {
  route('post', `/trash/${kind}/{id}/restore`, `web_restore_${kind}`, 'ExpectedRevision', ref('WriteResult'));
  route('delete', `/trash/${kind}/{id}`, `web_purge_${kind}`, null, ref('Ok'), revisionQuery);
}
route('get', '/agent-accesses', 'web_list_agent_accesses', null, list(ref('AgentAccess')), { query: page });
route('get', '/agent-accesses/{id}', 'web_get_agent_access', null, ref('AgentAccess'));
route('post', '/agent-accesses', 'web_create_agent_access', 'AgentCreate', ref('AgentAccess'), { status: '201', proof: true });
route('patch', '/agent-accesses/{id}', 'web_update_agent_access', 'AgentPatch', ref('AgentAccess'), { proof: 'conditional' });
route('delete', '/agent-accesses/{id}', 'web_delete_agent_access', null, ref('Ok'), revisionQuery);
route('get', '/agent-accesses/{id}/tokens', 'web_list_tokens', null, list(ref('Credential')), { query: page });
route('post', '/agent-accesses/{id}/tokens', 'web_issue_token', 'TokenCreate', ref('TokenIssued'), { status: '201', proof: true });
route('delete', '/agent-accesses/{id}/tokens/{tokenId}', 'web_revoke_token', null);
route('get', '/vaults/{id}/export', 'web_export_vault', null, null, { zip: true });
route('post', '/imports/validate', 'web_prepare_import', obj({ archive: { type: 'string', format: 'binary', description: 'ZIP, max 100 MiB compressed and 500 MiB expanded, 10000 records.' } }), ref('ImportPreparation'), { multipart: true, status: '201' });
route('get', '/imports/{id}', 'web_get_import', null, ref('ImportPreparation'));
route('delete', '/imports/{id}', 'web_cancel_import', null);
route('post', '/imports', 'web_commit_import', obj({ preparationId: id, targetName: text(100) }), ref('WebVault'), { status: '201', retry: true });
route('get', '/admin/accounts', 'admin_list_accounts', null, list(ref('Account')), { query: page, admin: true });
route('patch', '/admin/accounts/{id}', 'admin_update_account', 'AccountPatch', ref('Account'), { admin: true, proof: 'conditional' });
route('delete', '/admin/accounts/{id}', 'admin_delete_account', null, ref('Ok'), { ...revisionQuery, admin: true, proof: true });
route('get', '/admin/invitations', 'admin_list_invitations', null, list(ref('Invitation')), { query: page, admin: true });
route('post', '/admin/invitations', 'admin_invite', obj({ email, role: en('user', 'admin'), sendEmail: bool }, ['email', 'role']), obj({ invitation: ref('Invitation'), link: ref('LinkIssued') }), { admin: true, status: '201', proof: 'conditional' });
route('delete', '/admin/invitations/{id}', 'admin_revoke_invitation', null, ref('Ok'), { admin: true });
for (const [suffix, operationId, proof] of [['password-reset', 'admin_issue_password_reset', false], ['account-recovery', 'admin_issue_recovery', true]]) route('post', `/admin/accounts/{id}/${suffix}`, operationId, obj({ expectedRevision: rev, sendEmail: bool }, ['expectedRevision']), ref('LinkIssued'), { admin: true, proof });
route('get', '/admin/diagnostics', 'admin_diagnostics', null, obj({ version: str, databaseReady: bool, databaseBytes: int, temporaryBytes: int, uptimeSeconds: int }), { admin: true });
route('get', '/oauth/requests/{id}', 'web_get_oauth_consent', null, obj({ id, clientName: str, clientId: { type: 'string', format: 'uri' }, resource: { type: 'string', format: 'uri' }, requestedScopes: arr(en('memory:read','memory:write','memory:delete')), expiresAt: time }));
route('post', '/oauth/requests/{id}/decision', 'web_decide_oauth_consent', { oneOf: [obj({ decision: { const: 'deny' } }), obj({ decision: { const: 'approve' }, name: text(100), grants: { ...arr(ref('Grant')), minItems: 1 }, scopes: { ...arr(en('memory:read','memory:write','memory:delete')), minItems: 1, maxItems: 3, uniqueItems: true } })] }, obj({ redirectUrl: { type: 'string', format: 'uri', description: 'Server-validated callback with code/error, state if supplied, and iss.' } }));
// Reauthentication carries the exact typed proposed request, not an arbitrary JSON blob.
const actions = added.filter(x => x.options.proof).map(({ path, op, inputSchema, options }) => {
  const targets = Object.fromEntries([...path.matchAll(/\{(\w+)\}/g)].map(([, k]) => [k, id]));
  const query = options.query ? obj(options.query, options.requiredQuery ?? []) : obj({});
  return obj({ operationId: { const: op.operationId }, path: obj(targets), query, body: inputSchema ?? { type: 'null' } });
});
s.ActionRequest = { oneOf: actions };
route('post', '/me/reauthenticate', 'web_reauthenticate', obj({ password: oldPassword, factor: ref('Factor'), request: ref('ActionRequest') }, ['password', 'request']), ref('ReauthResult'));
save('web.openapi.json', api);
console.log(`Generated web OpenAPI: ${Object.values(api.paths).reduce((n, p) => n + Object.keys(p).length, 0)} operations.`);
