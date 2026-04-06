import { getSession } from "next-auth/react";

import type {
  ApiError,
  ApiKeys,
  CreateDebateRequest,
  Debate,
  DebateListResponse,
  DecryptedKeysResponse,
  KeyInfo,
  KeyListResponse,
  ListDebatesParams,
} from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

class ApiRequestError extends Error {
  status: number;
  code: string;

  constructor({ status, code, message }: ApiError) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
  }
}

let cachedToken: string | null = null;
let tokenFetchedAt = 0;
let inflightRequest: Promise<string | null> | null = null;
const TOKEN_TTL_MS = 5 * 60 * 1000;

async function getAuthToken(): Promise<string | null> {
  if (cachedToken && Date.now() - tokenFetchedAt < TOKEN_TTL_MS) {
    return cachedToken;
  }
  if (inflightRequest) {
    return inflightRequest;
  }
  inflightRequest = getSession().then((session) => {
    cachedToken = session?.accessToken ?? null;
    tokenFetchedAt = Date.now();
    inflightRequest = null;
    return cachedToken;
  });
  return inflightRequest;
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getAuthToken();

  const headers = new Headers(options.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (
    options.method &&
    options.method !== "GET" &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorBody: { detail?: string; code?: string; message?: string };
    try {
      errorBody = await response.json();
    } catch {
      errorBody = {};
    }

    throw new ApiRequestError({
      status: response.status,
      code: errorBody.code ?? `http_${response.status}`,
      message:
        errorBody.message ?? errorBody.detail ?? response.statusText,
    });
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

// ─── API Key Methods ───────────────────────────────────────────────────────

export async function saveKey(
  provider: string,
  apiKey: string,
): Promise<KeyInfo> {
  return apiFetch<KeyInfo>("/api/v1/keys", {
    method: "POST",
    body: JSON.stringify({ provider, api_key: apiKey }),
  });
}

export async function listKeys(): Promise<KeyListResponse> {
  return apiFetch<KeyListResponse>("/api/v1/keys");
}

export async function decryptKeys(): Promise<DecryptedKeysResponse> {
  return apiFetch<DecryptedKeysResponse>("/api/v1/keys/decrypt");
}

export async function deleteKey(provider: string): Promise<void> {
  return apiFetch<void>(`/api/v1/keys/${provider}`, {
    method: "DELETE",
  });
}

// ─── Debate Methods ────────────────────────────────────────────────────────

export async function createDebate(
  data: CreateDebateRequest,
): Promise<Debate> {
  return apiFetch<Debate>("/api/v1/debates", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function listDebates(
  params?: ListDebatesParams,
): Promise<DebateListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set("status", params.status);
  if (params?.limit !== undefined)
    searchParams.set("limit", String(params.limit));
  if (params?.offset !== undefined)
    searchParams.set("offset", String(params.offset));

  const query = searchParams.toString();
  const path = query ? `/api/v1/debates?${query}` : "/api/v1/debates";
  return apiFetch<DebateListResponse>(path);
}

export async function getDebate(id: string): Promise<Debate> {
  return apiFetch<Debate>(`/api/v1/debates/${id}`);
}

export async function getSharedDebate(id: string): Promise<Debate> {
  // No auth — fetch directly without token
  const response = await fetch(`${API_BASE}/api/v1/debates/${id}`);

  if (!response.ok) {
    let errorBody: { detail?: string; code?: string; message?: string };
    try {
      errorBody = await response.json();
    } catch {
      errorBody = {};
    }
    throw new ApiRequestError({
      status: response.status,
      code: errorBody.code ?? `http_${response.status}`,
      message:
        errorBody.message ?? errorBody.detail ?? response.statusText,
    });
  }

  return response.json() as Promise<Debate>;
}

// ─── SSE / Next Turn ───────────────────────────────────────────────────────

export async function fetchNextTurn(
  debateId: string,
  apiKeys: ApiKeys,
  signal: AbortSignal,
): Promise<Response> {
  const token = await getAuthToken();

  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (apiKeys.openai) {
    headers["X-OpenAI-Key"] = apiKeys.openai;
  }
  if (apiKeys.anthropic) {
    headers["X-Anthropic-Key"] = apiKeys.anthropic;
  }

  const response = await fetch(
    `${API_BASE}/api/v1/debates/${debateId}/next-turn`,
    {
      method: "POST",
      headers,
      signal,
    },
  );

  if (!response.ok) {
    let errorBody: { detail?: string; code?: string; message?: string };
    try {
      errorBody = await response.json();
    } catch {
      errorBody = {};
    }
    throw new ApiRequestError({
      status: response.status,
      code: errorBody.code ?? `http_${response.status}`,
      message:
        errorBody.message ?? errorBody.detail ?? response.statusText,
    });
  }

  return response;
}

export { ApiRequestError };
