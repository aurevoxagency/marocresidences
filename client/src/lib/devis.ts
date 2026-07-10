import { getApiBaseUrl, getAuthToken } from "@/lib/auth";
import {
  calculateNights,
  computeMontantReduction,
  type ReservationTypeReduction,
} from "@/lib/reservations";

type ApiMessage = { message?: string };

export type DevisStatut =
  | "brouillon"
  | "envoye"
  | "accepte"
  | "refuse"
  | "expire"
  | "converti";

export type DevisItemType = "chambre" | "enfant" | "bebe" | "supplement";

export type DevisItem = {
  id?: number;
  devis_id?: number;
  type_item: DevisItemType;
  chambre_id?: number | null;
  tranche_age_id?: number | null;
  supplement_id?: number | null;
  description: string;
  quantite: number | string;
  prix_unitaire: number | string;
  prix_total: number | string;
  ordre?: number;
};

export type Devis = {
  id: number;
  reference: string;
  prospect_id: number | null;
  client_id: number | null;
  maison_id: number;
  chambre_id: number | null;
  date_arrivee: string | null;
  date_depart: string | null;
  nb_nuits: number | null;
  nb_adultes: number;
  nbrs_enfants: number;
  nbrs_bebe: number;
  promotion_id: number | null;
  type_reduction: ReservationTypeReduction | null;
  valeur_reduction: number | string;
  montant_ht: number | string;
  taux_tva: number | string;
  montant_tva: number | string;
  montant_ttc: number | string;
  statut: DevisStatut;
  date_emission: string | null;
  date_validite: string | null;
  date_reponse: string | null;
  reservation_id: number | null;
  notes: string | null;
  date_creation: string;
  date_maj: string;
  client_nom?: string | null;
  client_email?: string | null;
  prospect_nom?: string | null;
  prospect_email?: string | null;
  maison_nom?: string | null;
  chambre_nom?: string | null;
  promotion_nom?: string | null;
  items?: DevisItem[];
};

export type DevisFormData = {
  prospect_id?: number | null;
  client_id?: number | null;
  maison_id: number;
  chambre_id?: number | null;
  date_arrivee?: string;
  date_depart?: string;
  nb_nuits?: number;
  nb_adultes?: number;
  nbrs_enfants?: number;
  nbrs_bebe?: number;
  promotion_id?: number | null;
  type_reduction?: ReservationTypeReduction | null;
  valeur_reduction?: number;
  montant_ht?: number;
  taux_tva?: number;
  montant_tva?: number;
  montant_ttc?: number;
  statut?: DevisStatut;
  date_emission?: string;
  date_validite?: string;
  date_reponse?: string | null;
  reservation_id?: number | null;
  notes?: string | null;
  items: DevisItem[];
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

export function calculateDevisTotals(fields: {
  items: Array<{ prix_total: number }>;
  type_reduction?: ReservationTypeReduction | null;
  valeur_reduction?: number;
  taux_tva?: number;
}) {
  const subtotal = fields.items.reduce((sum, item) => sum + (Number(item.prix_total) || 0), 0);
  const montantReduction = computeMontantReduction(
    subtotal,
    fields.type_reduction,
    fields.valeur_reduction
  );
  const montantHt = Math.max(0, subtotal - montantReduction);
  const tauxTva = Number(fields.taux_tva) || 0;
  const montantTva = Math.round(montantHt * (tauxTva / 100) * 100) / 100;
  const montantTtc = Math.round((montantHt + montantTva) * 100) / 100;

  return {
    subtotal,
    montant_reduction: montantReduction,
    montant_ht: montantHt,
    montant_tva: montantTva,
    montant_ttc: montantTtc,
  };
}

export function defaultValiditeDate(days = 30) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export { calculateNights };

export async function fetchDevis() {
  const response = await fetch(`${getApiBaseUrl()}/devis`, {
    headers: authHeaders(),
  });

  return parseResponse<Devis[]>(response);
}

export async function fetchDevisById(id: number) {
  const response = await fetch(`${getApiBaseUrl()}/devis/${id}`, {
    headers: authHeaders(),
  });

  return parseResponse<Devis>(response);
}

export async function createDevis(data: DevisFormData) {
  const response = await fetch(`${getApiBaseUrl()}/devis`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });

  return parseResponse<Devis>(response);
}

export async function updateDevis(id: number, data: DevisFormData) {
  const response = await fetch(`${getApiBaseUrl()}/devis/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });

  return parseResponse<Devis>(response);
}

export async function deleteDevis(id: number) {
  const response = await fetch(`${getApiBaseUrl()}/devis/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });

  return parseResponse<{ message: string }>(response);
}
