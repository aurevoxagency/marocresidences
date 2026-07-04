import { getApiBaseUrl, getAuthToken, type AuthUser } from "@/lib/auth";

type ApiMessage = { message?: string };

function authHeaders() {
  const token = getAuthToken();

  if (!token) {
    throw new Error("Session expirée. Veuillez vous reconnecter.");
  }

  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function parseResponse<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => ({}))) as T & ApiMessage;

  if (!response.ok) {
    throw new Error(data.message || "Une erreur est survenue.");
  }

  return data;
}

export async function fetchUsers() {
  const response = await fetch(`${getApiBaseUrl()}/users`, {
    headers: authHeaders(),
  });

  return parseResponse<AuthUser[]>(response);
}

export type UserFormData = {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  password?: string;
  role_id: number;
  terms_accepted?: boolean;
};

export async function createUser(data: UserFormData) {
  const response = await fetch(`${getApiBaseUrl()}/users`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      ...data,
      terms_accepted: data.terms_accepted ?? true,
    }),
  });

  const result = await parseResponse<{ user: AuthUser }>(response);
  return result.user;
}

export async function updateUser(id: number, data: Partial<UserFormData>) {
  const response = await fetch(`${getApiBaseUrl()}/users/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });

  const result = await parseResponse<{ user: AuthUser }>(response);
  return result.user;
}

export type ProfileFormData = {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  password?: string;
};

export async function updateCurrentUser(data: ProfileFormData) {
  const response = await fetch(`${getApiBaseUrl()}/users/me`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });

  const result = await parseResponse<{ user: AuthUser }>(response);
  return result.user;
}

export async function deleteUser(id: number) {
  const response = await fetch(`${getApiBaseUrl()}/users/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });

  await parseResponse<ApiMessage>(response);
}
