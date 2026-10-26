/** Fetch one of this app's own /api routes (marks the request as ours; see middleware.ts). */
export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("X-Smart-Radio", "1");
  return fetch(path, { ...init, headers, credentials: "same-origin" });
}
