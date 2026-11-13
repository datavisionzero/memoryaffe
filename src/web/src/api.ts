import type { operations } from "./generated/web-api";
type JsonBody<T> = T extends {
  requestBody: { content: { "application/json": infer B } };
}
  ? B
  : never;
type ResponseBody<T> = T extends {
  responses: { 200: { content: { "application/json": infer B } } };
}
  ? B
  : T extends {
        responses: { 201: { content: { "application/json": infer B } } };
      }
    ? B
    : unknown;
export async function operation<Id extends keyof operations>(
  operationId: Id,
  path: string,
  method: string,
  body: JsonBody<operations[Id]>,
  extra: Record<string, string> = {},
): Promise<ResponseBody<operations[Id]>> {
  void operationId;
  return api(path, method, body, extra);
}
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
let csrf = "";
// Keep uncertain outcomes replayable in memory; successful actions release their key.
const uncertainWrites = new Map<string, { key: string; created: number }>();
export async function refreshCsrf() {
  const r = await fetch("/api/v1/auth/csrf", {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!r.ok) throw new Error("CSRF-Verbindung fehlgeschlagen");
  csrf = (await r.json()).requestToken;
}
export async function api(
  path: string,
  method = "GET",
  body?: unknown,
  extra: Record<string, string> = {},
): Promise<any> {
  if (method !== "GET" && !csrf) await refreshCsrf();
  const needsKey =
    (path === "/memories" && method === "POST") ||
    (/^\/memories\/[^/?]+(?:\?|$)/.test(path) &&
      ["PATCH", "DELETE"].includes(method)) ||
    (/^\/vaults\/[^/]+\/tags$/.test(path) && method === "POST") ||
    (path === "/imports" && method === "POST");
  const fingerprint = needsKey
    ? method + "\n" + path + "\n" + JSON.stringify(body)
    : "";
  for (const [entry, value] of uncertainWrites)
    if (Date.now() - value.created > 86400000) uncertainWrites.delete(entry);
  if (needsKey && !uncertainWrites.has(fingerprint))
    uncertainWrites.set(fingerprint, {
      key: crypto.randomUUID(),
      created: Date.now(),
    });
  const r = await fetch("/api/v1" + path, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      ...(body !== undefined && !(body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...(method !== "GET" ? { "X-CSRF-Token": csrf } : {}),
      ...(needsKey
        ? { "Idempotency-Key": uncertainWrites.get(fingerprint)!.key }
        : {}),
      ...extra,
    },
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    if (r.status < 500 && e.code !== "request_in_progress")
      uncertainWrites.delete(fingerprint);
    if (e.code === "csrf_failed") csrf = "";
    throw new ApiError(
      e.code,
      e.message || `Anfrage fehlgeschlagen (${r.status})`,
    );
  }
  const result = r.status === 204 ? undefined : await r.json();
  uncertainWrites.delete(fingerprint);
  return result;
}
export async function all(path: string) {
  const items: any[] = [];
  let cursor: string | null = null;
  do {
    const p = await api(
      path +
        (path.includes("?") ? "&" : "?") +
        "pageSize=100" +
        (cursor ? "&cursor=" + encodeURIComponent(cursor) : ""),
    );
    items.push(...p.items);
    cursor = p.nextCursor;
  } while (cursor);
  return items;
}
