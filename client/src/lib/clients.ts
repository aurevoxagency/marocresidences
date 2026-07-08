import { getApiBaseUrl, getAuthToken } from "@/lib/auth";

type ApiMessage = { message?: string };

export type ClientCivilite = "M." | "Mme" | "Mlle";
export type ClientTypePiece = "CIN" | "Passeport" | "Carte_sejour";

export type Client = {
  id: number;
  civilite: ClientCivilite | null;
  nom: string;
  prenom: string | null;
  date_naissance: string | null;
  nationalite: string | null;
  type_piece: ClientTypePiece | null;
  numero_piece: string | null;
  email: string | null;
  telephone: string | null;
  adresse: string | null;
  ville: string | null;
  pays: string | null;
  langue_preferee: string | null;
  allergies_regime: string | null;
  notes_preferences: string | null;
  is_vip: boolean;
  nb_reservations_total: number;
  montant_total_depense: number | string;
  date_premiere_reservation: string | null;
  date_derniere_reservation: string | null;
  date_creation: string;
  date_maj: string;
};

export type ClientFormData = {
  civilite?: ClientCivilite | "";
  nom: string;
  prenom?: string;
  date_naissance?: string;
  nationalite?: string;
  type_piece?: ClientTypePiece | "";
  numero_piece?: string;
  email?: string;
  telephone?: string;
  adresse?: string;
  ville?: string;
  pays?: string;
  langue_preferee?: string;
  allergies_regime?: string;
  notes_preferences?: string;
  is_vip?: boolean;
  nb_reservations_total?: number;
  montant_total_depense?: number;
  date_premiere_reservation?: string;
  date_derniere_reservation?: string;
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

export async function fetchClients() {
  const response = await fetch(`${getApiBaseUrl()}/clients`, {
    headers: authHeaders(),
  });

  return parseResponse<Client[]>(response);
}

export async function createClient(data: ClientFormData) {
  const response = await fetch(`${getApiBaseUrl()}/clients`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });

  const result = await parseResponse<{ client: Client }>(response);
  return result.client;
}

export async function updateClient(id: number, data: ClientFormData) {
  const response = await fetch(`${getApiBaseUrl()}/clients/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });

  const result = await parseResponse<{ client: Client }>(response);
  return result.client;
}

export async function deleteClient(id: number) {
  const response = await fetch(`${getApiBaseUrl()}/clients/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });

  await parseResponse<ApiMessage>(response);
}
