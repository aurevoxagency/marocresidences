import { getApiBaseUrl, getAuthToken } from "@/lib/auth";

type ApiMessage = { message?: string };

export type AvisStatut = "en_attente" | "publie" | "masque" | "signale";

export type AvisClient = {
  id: number;
  maison_id: number;
  nom: string;
  email: string;
  note: number;
  titre: string | null;
  commentaire: string;
  reponse_gerant: string | null;
  date_reponse: string | null;
  ip_soumission: string | null;
  statut: AvisStatut;
  date_creation: string;
  date_maj: string;
  maison_nom?: string | null;
  maison_ville?: string | null;
};

export type PublishedAvis = {
  id: number;
  nom: string;
  note: number;
  titre: string | null;
  commentaire: string;
  maison_nom: string | null;
  maison_ville: string | null;
  date_creation: string;
};

export type PublicAvisFormData = {
  maison_id: number;
  nom: string;
  email: string;
  note: number;
  titre?: string | null;
  commentaire: string;
};

export type AvisUpdateData = {
  statut?: AvisStatut;
  reponse_gerant?: string | null;
  date_reponse?: string | null;
};

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

export async function createPublicAvis(payload: PublicAvisFormData) {
  const response = await fetch(`${getApiBaseUrl()}/avis-clients/public`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return parseResponse<{ message: string; avis: AvisClient }>(response);
}

export async function fetchPublishedAvis() {
  const response = await fetch(`${getApiBaseUrl()}/avis-clients/public`);
  return parseResponse<PublishedAvis[]>(response);
}

export async function fetchAvisClients(filters?: {
  maison_id?: number;
  statut?: AvisStatut | "";
}) {
  const params = new URLSearchParams();

  if (filters?.maison_id) {
    params.set("maison_id", String(filters.maison_id));
  }

  if (filters?.statut) {
    params.set("statut", filters.statut);
  }

  const suffix = params.toString() ? `?${params.toString()}` : "";
  const response = await fetch(`${getApiBaseUrl()}/avis-clients${suffix}`, {
    headers: authHeaders(),
  });

  return parseResponse<AvisClient[]>(response);
}

export async function updateAvisClient(id: number, data: AvisUpdateData) {
  const response = await fetch(`${getApiBaseUrl()}/avis-clients/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });

  return parseResponse<{ message: string; avis: AvisClient }>(response);
}

export async function deleteAvisClient(id: number) {
  const response = await fetch(`${getApiBaseUrl()}/avis-clients/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });

  await parseResponse<ApiMessage>(response);
}
