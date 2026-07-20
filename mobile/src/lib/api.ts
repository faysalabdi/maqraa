import { supabase } from "./supabase";

const API_URL = process.env.EXPO_PUBLIC_API_URL!;

/** The API origin, for callers that build their own fetch (e.g. WebRTC). */
export const API_BASE = API_URL;

/** Bearer auth header for a manual fetch. Empty object when signed out. */
export async function authHeader(): Promise<Record<string, string>> {
  const token = await accessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function accessToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

/**
 * Authenticated fetch against the Next.js /api routes. Sends the Supabase
 * access token as a Bearer header; on a 401 refreshes the session once and
 * retries, so an expired token doesn't surface as a sign-out.
 */
export async function api<T>(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const doFetch = async (token: string | null) => {
    return fetch(`${API_URL}${path}`, {
      method: init?.method ?? (init?.body !== undefined ? "POST" : "GET"),
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  };

  let res = await doFetch(await accessToken());

  if (res.status === 401) {
    const { data } = await supabase.auth.refreshSession();
    if (data.session) res = await doFetch(data.session.access_token);
  }

  const json = (await res.json().catch(() => null)) as
    | (T & { error?: string })
    | { error?: string }
    | null;
  if (!res.ok) {
    const message =
      (json && "error" in json && json.error) || `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }
  return json as T;
}

/** Multipart upload to the API (book imports). `fileUri` comes from a document picker. */
export async function apiUpload<T>(
  path: string,
  fileUri: string,
  fileName: string,
  fields?: Record<string, string>,
): Promise<T> {
  const token = await accessToken();
  const form = new FormData();
  const mime = fileName.toLowerCase().endsWith(".epub")
    ? "application/epub+zip"
    : fileName.toLowerCase().endsWith(".pdf")
      ? "application/pdf"
      : "text/plain";
  // React Native FormData file part: { uri, name, type }. Send via XMLHttpRequest,
  // not fetch: RN 0.86's global fetch is spec-compliant and rejects the { uri }
  // file-part shape ("unsupported FormDataPart implementation"). RN's XHR still
  // serializes it natively from the file URI.
  form.append("file", {
    uri: fileUri,
    name: fileName,
    type: mime,
  } as unknown as Blob);
  for (const [k, v] of Object.entries(fields ?? {})) form.append(k, v);

  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}${path}`);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.onload = () => {
      let json: (T & { error?: string }) | null = null;
      try {
        json = JSON.parse(xhr.responseText) as T & { error?: string };
      } catch {
        json = null;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(json as T);
      } else {
        reject(new ApiError(json?.error ?? `Upload failed (${xhr.status})`, xhr.status));
      }
    };
    xhr.onerror = () => reject(new ApiError("Upload failed (network error)", 0));
    xhr.send(form);
  });
}
