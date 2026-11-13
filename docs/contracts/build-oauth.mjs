// Wire contract for bounded OAuth; protocol behavior still needs integration tests.
import { writeFileSync } from 'node:fs';
const str = { type: 'string' }, uri = { type: 'string', format: 'uri' };
const obj = (properties, required = Object.keys(properties)) => ({ type: 'object', properties, required, additionalProperties: false });
const en = (...values) => ({ type: 'string', enum: values });
const arr = items => ({ type: 'array', items });
const ref = name => ({ $ref: `#/components/schemas/${name}` });
const token = { type: 'string', minLength: 1, maxLength: 1024 };
const scope = { type: 'string', description: 'Space-separated cumulative memory:read/write/delete; no OIDC scopes.' };
const clientId = { type: 'string', format: 'uri', maxLength: 2048 };
const auth = obj({ response_type: { const: 'code' }, client_id: clientId, redirect_uri: uri, resource: uri, scope, state: { type: 'string', minLength: 1, maxLength: 2048 }, code_challenge: { type: 'string', pattern: '^[A-Za-z0-9_-]{43}$(?![\\s\\S])' }, code_challenge_method: { const: 'S256' } }, ['response_type','client_id','redirect_uri','resource','code_challenge','code_challenge_method']);
auth.additionalProperties = true; // OAuth extensions are ignored, unlike strict product JSON.
const schemas = {
  AuthorizationRequest: auth,
  TokenRequest: { oneOf: [obj({ grant_type: { const: 'authorization_code' }, client_id: clientId, code: token, redirect_uri: uri, resource: uri, code_verifier: { type: 'string', minLength: 43, maxLength: 128, pattern: '^[A-Za-z0-9._~-]+$(?![\\s\\S])' } }), obj({ grant_type: { const: 'refresh_token' }, client_id: clientId, refresh_token: token, resource: uri, scope }, ['grant_type','client_id','refresh_token','resource'])] },
  TokenResponse: obj({ access_token: token, token_type: { const: 'Bearer' }, expires_in: { const: 900 }, refresh_token: token, scope }),
  OAuthError: obj({ error: en('invalid_request','invalid_client','invalid_grant','unauthorized_client','unsupported_grant_type','invalid_scope','invalid_target','access_denied','unsupported_response_type','server_error','temporarily_unavailable'), error_description: str }, ['error']),
  ServerMetadata: obj({ issuer: uri, authorization_endpoint: uri, token_endpoint: uri, revocation_endpoint: uri, response_types_supported: { const: ['code'] }, grant_types_supported: { const: ['authorization_code','refresh_token'] }, code_challenge_methods_supported: { const: ['S256'] }, token_endpoint_auth_methods_supported: { const: ['none'] }, revocation_endpoint_auth_methods_supported: { const: ['none'] }, scopes_supported: { const: ['memory:read','memory:write','memory:delete'] }, authorization_response_iss_parameter_supported: { const: true }, client_id_metadata_document_supported: { const: true } }),
  ResourceMetadata: obj({ resource: uri, authorization_servers: { ...arr(uri), minItems: 1, maxItems: 1 }, scopes_supported: { const: ['memory:read','memory:write','memory:delete'] }, bearer_methods_supported: { const: ['header'] } }),
  RevocationRequest: obj({ token, client_id: clientId, token_type_hint: en('access_token','refresh_token') }, ['token','client_id'])
};
for (const schema of schemas.TokenRequest.oneOf) {
  schema.additionalProperties = true;
  schema.not = { anyOf: [{ required: ['client_secret'] }, { required: ['client_assertion'] }, { required: ['client_assertion_type'] }] };
}
schemas.RevocationRequest.additionalProperties = true;
const json = schema => ({ 'application/json': { schema } });
const error = { description: 'OAuth error, never the product Error envelope. No secret details.', content: json(ref('OAuthError')) };
const api = { openapi: '3.1.1', info: { title: 'memoryaffe OAuth discovery and token wire contract', version: '0.1.0' }, security: [], paths: {}, components: { schemas } };
for (const [path, name, type] of [['/.well-known/oauth-authorization-server','oauth_discovery','ServerMetadata'], ['/.well-known/oauth-protected-resource/mcp','oauth_resource_metadata','ResourceMetadata']]) api.paths[path] = { get: { operationId: name, responses: { '200': { description: 'Configured public identities', content: json(ref(type)) } } } };
api.paths['/oauth/authorize'] = { get: { operationId: 'oauth_authorize', parameters: Object.entries(auth.properties).map(([name,schema]) => ({name,in:'query',required:auth.required.includes(name),schema})), responses: { '200': { description: 'Local login/consent page; no redirect to unchecked client URI.', content: { 'text/html': { schema: str } } }, '302': { description: 'Validated callback: code or OAuth error, supplied state unchanged, always iss.', headers: { Location: { required: true, schema: uri } } }, '400': { description: 'Local error page for invalid client/redirect', content: { 'text/html': { schema: str } } }, default: error } } };
for (const [path,name,input] of [['/oauth/token','oauth_token','TokenRequest'], ['/oauth/revoke','oauth_revoke','RevocationRequest']]) api.paths[path] = { post: { operationId: name, requestBody: { required: true, content: { 'application/x-www-form-urlencoded': { schema: ref(input) } } }, responses: { '200': path.endsWith('token') ? { description: 'Token issued, Cache-Control:no-store and Pragma:no-cache', content: json(ref('TokenResponse')) } : { description: 'Revoked or unknown token; empty body' }, '400': error, '401': error, '429': { ...error, headers: { 'Retry-After': { schema: { type: 'integer', minimum: 1 } } } }, '503': error } } };
writeFileSync(new URL('oauth.openapi.json', import.meta.url), JSON.stringify(api,null,2)+'\n');
console.log('Generated OAuth OpenAPI: five operations.');
