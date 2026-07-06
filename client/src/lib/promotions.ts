import { getApiBaseUrl, getAuthToken } from "@/lib/auth";

type ApiMessage = { message?: string };

export type PromotionTypeReduction = "pourcentage" | "valeur";
export type PromotionTypeCondition =
  | "early_booking"
  | "last_minute"
  | "duree_minimum"
  | "code_promo"
  | "saisonniere"
  | "sans_condition";
export type PromotionApplicableA =
  | "toutes_chambres"
  | "categorie"
  | "chambre_specifique";
export type PromotionStatut = "active" | "inactive" | "expiree";

export type Promotion = {
  id: number;
  maison_id: number | null;
  maison_nom?: string | null;
  nom: string;
  code_promo: string | null;
  description: string | null;
  type_reduction: PromotionTypeReduction;
  valeur_reduction: number | string;
  type_condition: PromotionTypeCondition;
  jours_avant_min: number | null;
  jours_avant_max: number | null;
  duree_sejour_min: number | null;
  applicable_a: PromotionApplicableA;
  categorie_id: number | null;
  categorie_nom?: string | null;
  chambre_id: number | null;
  chambre_nom?: string | null;
  inclut_supplements: boolean | number;
  date_debut_validite: string;
  date_fin_validite: string;
  date_debut_sejour: string | null;
  date_fin_sejour: string | null;
  utilisation_max: number | null;
  utilisation_actuelle: number;
  cumulable: boolean | number;
  statut: PromotionStatut;
  date_creation: string;
};

export type PromotionFormData = {
  maison_id?: number | null;
  nom: string;
  code_promo?: string;
  description?: string;
  type_reduction?: PromotionTypeReduction;
  valeur_reduction: number;
  type_condition?: PromotionTypeCondition;
  jours_avant_min?: number | null;
  jours_avant_max?: number | null;
  duree_sejour_min?: number | null;
  applicable_a?: PromotionApplicableA;
  categorie_id?: number | null;
  chambre_id?: number | null;
  inclut_supplements?: boolean;
  date_debut_validite: string;
  date_fin_validite: string;
  date_debut_sejour?: string;
  date_fin_sejour?: string;
  utilisation_max?: number | null;
  cumulable?: boolean;
  statut?: PromotionStatut;
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

export async function fetchPromotions(maisonId?: number) {
  const query = maisonId ? `?maison_id=${maisonId}` : "";
  const response = await fetch(`${getApiBaseUrl()}/promotions${query}`, {
    headers: authHeaders(),
  });

  return parseResponse<Promotion[]>(response);
}

export async function fetchPromotion(id: number) {
  const response = await fetch(`${getApiBaseUrl()}/promotions/${id}`, {
    headers: authHeaders(),
  });

  return parseResponse<Promotion>(response);
}

export async function createPromotion(data: PromotionFormData) {
  const response = await fetch(`${getApiBaseUrl()}/promotions`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });

  const result = await parseResponse<{ promotion: Promotion }>(response);
  return result.promotion;
}

export async function updatePromotion(id: number, data: PromotionFormData) {
  const response = await fetch(`${getApiBaseUrl()}/promotions/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });

  const result = await parseResponse<{ promotion: Promotion }>(response);
  return result.promotion;
}

export async function deletePromotion(id: number) {
  const response = await fetch(`${getApiBaseUrl()}/promotions/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });

  await parseResponse<ApiMessage>(response);
}
