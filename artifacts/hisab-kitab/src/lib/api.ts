import { enqueueAction } from "./offlineSync";

const BASE_URL = "/api";

const WRITE_METHODS = new Set(["POST", "PUT", "DELETE", "PATCH"]);

// Token lives in memory only so a browser reload requires a fresh login.
let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export async function fetchApi(endpoint: string, options: RequestInit = {}) {
  const token = authToken;
  const method = (options.method ?? "GET").toUpperCase();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // If offline and it's a write request, queue it for later
  if (!navigator.onLine && WRITE_METHODS.has(method)) {
    await enqueueAction({
      endpoint,
      method: method as "POST" | "PUT" | "DELETE" | "PATCH",
      body: options.body as string | undefined,
      headers,
    });
    // Return a synthetic "queued" response so callers don't crash
    return { success: true, queued: true, offline: true };
  }

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(data?.message || data?.error || `API Error: ${response.status}`);
    }

    return data;
  } catch (err) {
    // Network failure during a write — queue for later
    if (WRITE_METHODS.has(method) && err instanceof TypeError && err.message.includes("fetch")) {
      await enqueueAction({
        endpoint,
        method: method as "POST" | "PUT" | "DELETE" | "PATCH",
        body: options.body as string | undefined,
        headers,
      });
      return { success: true, queued: true, offline: true };
    }
    throw err;
  }
}
