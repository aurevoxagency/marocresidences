export type AuthUser = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  role_id: number | null;
  terms_accepted: boolean;
  email_verified_at: string | null;
  created_at: string;
  updated_at: string;
};

const AUTH_TOKEN_KEY = "marocresidences.auth.token";

function logAuth(scope: string, data?: unknown) {
  console.log(`[AUTH] ${scope}`, data ?? "");
}

function logAuthError(scope: string, error: unknown) {
  console.error(`[AUTH ERROR] ${scope}`, error);
}

export function getApiBaseUrl() {
  return import.meta.env.VITE_API_URL || "http://localhost:3500/api";
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue =
    window.localStorage.getItem(AUTH_TOKEN_KEY) ||
    window.sessionStorage.getItem(AUTH_TOKEN_KEY);

  if (!rawValue) {
    return null;
  }

  return rawValue;
}

export function saveAuthToken(token: string, persist = true) {
  if (typeof window === "undefined") {
    return;
  }

  logAuth("Saving token", { persist, tokenPreview: `${token.slice(0, 12)}...` });

  const storage = persist ? window.localStorage : window.sessionStorage;
  const otherStorage = persist ? window.sessionStorage : window.localStorage;

  otherStorage.removeItem(AUTH_TOKEN_KEY);
  storage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(AUTH_TOKEN_KEY);
  window.sessionStorage.removeItem(AUTH_TOKEN_KEY);
}

export async function fetchCurrentUser(token: string) {
  const url = `${getApiBaseUrl()}/users/me`;
  logAuth("Fetching current user", { url });

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = (await response.json().catch((error) => {
    logAuthError("Failed to parse /users/me response", error);
    return {};
  })) as {
    message?: string;
    user?: AuthUser;
  };

  logAuth("Current user response", {
    status: response.status,
    ok: response.ok,
    message: data.message,
    user: data.user,
    role_id: data.user?.role_id,
  });

  if (!response.ok || !data.user) {
    throw new Error(data.message || "Unable to fetch current user.");
  }

  return data.user;
}
