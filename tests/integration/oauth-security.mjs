// Discovery and negative protocol tests only. This is not an OAuth happy-path
// or real ChatGPT interoperability test; controlled CIMD coverage remains open.
export async function runOAuthSecurity({ base, check, expect }) {
  const request = async (path, options = {}) => {
    const r = await fetch(base + path, { redirect: 'manual', signal: AbortSignal.timeout(30000), ...options });
    const text = await r.text(); let data;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    return { status: r.status, data, headers: r.headers };
  };
  const metadata = await request('/.well-known/oauth-authorization-server'); expect(metadata, 200);
  check(metadata.data.issuer === base, 'OAuth issuer mismatch');
  check(metadata.data.authorization_endpoint === base + '/oauth/authorize' && metadata.data.token_endpoint === base + '/oauth/token', 'OAuth endpoint mismatch');
  check(!('registration_endpoint' in metadata.data) && !('userinfo_endpoint' in metadata.data), 'OAuth metadata announced unsupported DCR/OIDC');
  for (const scope of ['memory:read', 'memory:write', 'memory:delete']) check(metadata.data.scopes_supported?.includes(scope), 'OAuth scope metadata missing');
  check(metadata.data.code_challenge_methods_supported?.length === 1 && metadata.data.code_challenge_methods_supported[0] === 'S256', 'Only S256 PKCE may be advertised');
  check(metadata.data.token_endpoint_auth_methods_supported?.length === 1 && metadata.data.token_endpoint_auth_methods_supported[0] === 'none', 'Unsupported OAuth client authentication advertised');
  const resource = await request('/.well-known/oauth-protected-resource/mcp'); expect(resource, 200);
  check(resource.data.resource === base + '/mcp' && resource.data.authorization_servers?.includes(base), 'Protected-resource metadata mismatch');
  const challenge = await request('/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: '{}' });
  check(challenge.status === 401, 'Anonymous MCP must be rejected before JSON-RPC dispatch');
  const auth = challenge.headers.get('www-authenticate') ?? ''; check(auth.includes('Bearer') && auth.includes('resource_metadata=') && auth.includes('/.well-known/oauth-protected-resource/mcp'), 'MCP challenge missing resource metadata');
  for (const client of ['http://127.0.0.1:9/private', 'https://127.0.0.1:9/private', 'file:///etc/passwd']) {
    const query = new URLSearchParams({ client_id: client, redirect_uri: 'https://untrusted.example/callback', response_type: 'code', resource: base + '/mcp', code_challenge: 'a'.repeat(43), code_challenge_method: 'S256' });
    const r = await request('/oauth/authorize?' + query); check(r.status >= 400 && r.status < 500, 'Untrusted CIMD client accepted'); check(!r.headers.has('location'), 'Unvalidated client/redirect must not receive a redirect');
  }
  const malformed = await request('/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: Buffer.from([0xff]) });
  check(malformed.status === 400 && malformed.data?.error === 'invalid_request' && !('code' in malformed.data), 'Malformed OAuth UTF-8 must return OAuth invalid_request, not product/internal error');
  const form = new URLSearchParams({ grant_type: 'not_supported', client_id: 'https://untrusted.example/client.json' });
  const invalid = await request('/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString() });
  check(invalid.status === 400 && typeof invalid.data?.error === 'string', 'Token errors must use OAuthError');
  check(!('code' in invalid.data) && !('requestId' in invalid.data) && !('access_token' in invalid.data), 'Token endpoint returned product error or token for invalid request');
}
