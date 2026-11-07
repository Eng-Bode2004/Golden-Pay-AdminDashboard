/**
 * Backend address. The dev servers forward /api to the backend, so the default is the same
 * origin; a dashboard built for hosting on its own address sets VITE_API_URL at build time
 * (see .env.production).
 */
const API_ORIGIN = ((import.meta as { env?: Record<string, string | undefined> }).env?.VITE_API_URL ?? "").replace(/\/+$/, "");
export const API = `${API_ORIGIN}/api/v1`;

export interface ApiErrorShape {
  status: number;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export class ApiRequestError extends Error {
  constructor(readonly error: ApiErrorShape) {
    super(error.message);
    this.name = "ApiRequestError";
  }
}

const TOKEN_KEY = "gp.access";
const REFRESH_KEY = "gp.refresh";

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setSession(access: string, refresh: string): void {
  localStorage.setItem(TOKEN_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

async function parse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function send(
  path: string,
  init: RequestInit & { auth?: boolean },
  headers: Headers,
): Promise<Response> {
  const response = await fetch(`${API}${path}`, { ...init, headers });
  if (response.status !== 401 || init.auth === false) return response;
  if (!(await tryRefresh())) return response;
  headers.set("Authorization", `Bearer ${getAccessToken()}`);
  return fetch(`${API}${path}`, { ...init, headers });
}

/** Authenticated image download; document images are never public URLs. */
export async function apiBlob(path: string, signal?: AbortSignal): Promise<Blob> {
  const headers = new Headers();
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await send(path, { signal }, headers);
  if (!response.ok) {
    throw new ApiRequestError({
      status: response.status,
      code: "REQUEST_FAILED",
      message: "Request failed",
    });
  }
  return response.blob();
}

export async function api<T>(
  path: string,
  init: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  // File uploads set their own multipart boundary.
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (init.auth !== false) {
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await send(path, init, headers);

  const body = (await parse(response)) as {
    success?: boolean;
    data?: T;
    error?: {
      code?: string;
      message?: string;
      details?: Record<string, unknown>;
    };
  } | null;

  if (!response.ok || body?.success === false) {
    throw new ApiRequestError({
      status: response.status,
      code: body?.error?.code ?? "REQUEST_FAILED",
      message: body?.error?.message ?? "Request failed",
      details: body?.error?.details,
    });
  }

  return (body?.data ?? body) as T;
}

let refreshInFlight: Promise<boolean> | null = null;
function tryRefresh(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = performRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function performRefresh(): Promise<boolean> {
  const refresh = localStorage.getItem(REFRESH_KEY);
  if (!refresh) return false;
  try {
    const response = await fetch(`${API}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    });
    const body = (await parse(response)) as {
      success?: boolean;
      data?: { access_token?: string; refresh_token?: string };
    } | null;
    if (!response.ok || !body?.data?.access_token) {
      clearSession();
      return false;
    }
    setSession(body.data.access_token, body.data.refresh_token ?? refresh);
    return true;
  } catch {
    return false;
  }
}
