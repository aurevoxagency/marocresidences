import { getApiBaseUrl, getAuthToken } from "@/lib/auth";

type ApiMessage = { message?: string };

export type ProspectCivilite = "M." | "Mme" | "Mlle";
export type ProspectSource =
  | "site_web"
  | "reseaux_sociaux"
  | "booking"
  | "airbnb"
  | "agence"
  | "bouche_a_oreille"
  | "walk_in"
  | "autre";
export type ProspectStatut =
  | "nouveau"
  | "contacte"
  | "en_negociation"
  | "converti"
  | "perdu";

export type Prospect = {
  id: number;
  civilite: ProspectCivilite | null;
  nom: string;
  prenom: string | null;
  email: string | null;
  telephone: string | null;
  pays: string | null;
  source: ProspectSource;
  canal_contact: string | null;
  maison_id: number | null;
  maison_nom?: string | null;
  date_arrivee_souhaitee: string | null;
  date_depart_souhaitee: string | null;
  nb_personnes: number | null;
  budget_estime: number | string | null;
  message: string | null;
  notes_internes: string | null;
  statut: ProspectStatut;
  assigne_a: string | null;
  date_premier_contact: string | null;
  date_dernier_contact: string | null;
  raison_perte: string | null;
  date_creation: string;
  date_maj: string;
};

export type ProspectFormData = {
  civilite?: ProspectCivilite | "";
  nom: string;
  prenom?: string;
  email?: string;
  telephone?: string;
  pays?: string;
  source?: ProspectSource;
  canal_contact?: string;
  maison_id?: number | null;
  date_arrivee_souhaitee?: string;
  date_depart_souhaitee?: string;
  nb_personnes?: number | null;
  budget_estime?: number | null;
  message?: string;
  notes_internes?: string;
  statut?: ProspectStatut;
  assigne_a?: string;
  date_premier_contact?: string;
  date_dernier_contact?: string;
  raison_perte?: string;
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

export async function fetchProspects() {
  const response = await fetch(`${getApiBaseUrl()}/prospects`, {
    headers: authHeaders(),
  });

  return parseResponse<Prospect[]>(response);
}

export async function createProspect(data: ProspectFormData) {
  const response = await fetch(`${getApiBaseUrl()}/prospects`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });

  const result = await parseResponse<{ prospect: Prospect }>(response);
  return result.prospect;
}

export async function updateProspect(id: number, data: ProspectFormData) {
  const response = await fetch(`${getApiBaseUrl()}/prospects/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });

  const result = await parseResponse<{ prospect: Prospect }>(response);
  return result.prospect;
}

export async function deleteProspect(id: number) {
  const response = await fetch(`${getApiBaseUrl()}/prospects/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });

  await parseResponse<ApiMessage>(response);
}

export async function convertProspectToClient(id: number) {
  const response = await fetch(`${getApiBaseUrl()}/prospects/${id}/convert`, {
    method: "POST",
    headers: authHeaders(),
  });

  return parseResponse<{
    message?: string;
    client: { id: number };
    prospect: Prospect;
  }>(response);
}
