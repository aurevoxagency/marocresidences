import { getApiBaseUrl, getAuthToken } from "@/lib/auth";

type ApiMessage = { message?: string };

export type JournalTypeMouvement =
  | "paiement"
  | "acompte"
  | "remboursement"
  | "depot_garantie"
  | "retenue_depot"
  | "autre";

export type JournalSens = "entree" | "sortie";

export type JournalModePaiement =
  | "especes"
  | "carte"
  | "virement"
  | "cheque"
  | "autre";

export type JournalTransaction = {
  id: number;
  reference: string;
  type_mouvement: JournalTypeMouvement;
  sens: JournalSens;
  montant: number | string;
  mode_paiement: JournalModePaiement | null;
  libelle: string;
  reservation_id: number | null;
  facture_id: number | null;
  commande_id: number | null;
  client_id: number | null;
  maison_id: number | null;
  effectue_par: string | null;
  notes: string | null;
  date_transaction: string;
  date_creation: string;
  client_nom?: string | null;
  maison_nom?: string | null;
  reservation_reference?: string | null;
  facture_numero?: string | null;
  commande_reference?: string | null;
};

export type JournalTransactionFormData = {
  type_mouvement?: JournalTypeMouvement;
  sens?: JournalSens;
  montant: number;
  mode_paiement?: JournalModePaiement | null;
  libelle: string;
  reservation_id?: number | null;
  facture_id?: number | null;
  commande_id?: number | null;
  client_id?: number | null;
  maison_id?: number | null;
  effectue_par?: string | null;
  notes?: string | null;
  date_transaction: string;
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

export async function fetchJournalTransactions(filters?: {
  maison_id?: number;
  type_mouvement?: JournalTypeMouvement;
  sens?: JournalSens;
}) {
  const params = new URLSearchParams();

  if (filters?.maison_id) {
    params.set("maison_id", String(filters.maison_id));
  }

  if (filters?.type_mouvement) {
    params.set("type_mouvement", filters.type_mouvement);
  }

  if (filters?.sens) {
    params.set("sens", filters.sens);
  }

  const query = params.toString();
  const response = await fetch(
    `${getApiBaseUrl()}/journal-transactions${query ? `?${query}` : ""}`,
    { headers: authHeaders() }
  );

  return parseResponse<JournalTransaction[]>(response);
}

export async function fetchJournalTransaction(id: number) {
  const response = await fetch(`${getApiBaseUrl()}/journal-transactions/${id}`, {
    headers: authHeaders(),
  });

  return parseResponse<JournalTransaction>(response);
}

export async function createJournalTransaction(data: JournalTransactionFormData) {
  const response = await fetch(`${getApiBaseUrl()}/journal-transactions`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });

  const result = await parseResponse<{ transaction: JournalTransaction }>(response);
  return result.transaction;
}

export async function updateJournalTransaction(
  id: number,
  data: JournalTransactionFormData
) {
  const response = await fetch(`${getApiBaseUrl()}/journal-transactions/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });

  const result = await parseResponse<{ transaction: JournalTransaction }>(response);
  return result.transaction;
}

export async function deleteJournalTransaction(id: number) {
  const response = await fetch(`${getApiBaseUrl()}/journal-transactions/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });

  await parseResponse<ApiMessage>(response);
}
