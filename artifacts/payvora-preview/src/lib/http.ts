const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

/** Payvora API path helper — keeps the artifact base path prefix. */
export const api = (path: string) => `${BASE}/api${path}`;

export async function jsonOrThrow<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Request failed (${response.status}).`;
    try {
      const body = (await response.json()) as { message?: string };
      if (body?.message) message = body.message;
    } catch {
      /* keep default */
    }
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const getJson = <T>(path: string) => fetch(api(path), { credentials: "include" }).then(r => jsonOrThrow<T>(r));
export const sendJson = <T>(path: string, method: string, body?: unknown) =>
  fetch(api(path), {
    method,
    credentials: "include",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then(r => jsonOrThrow<T>(r));
