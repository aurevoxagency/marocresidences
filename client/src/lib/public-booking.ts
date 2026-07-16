import { getApiBaseUrl } from "@/lib/auth";
import type { ChambreListItem, SupplementTarifRow } from "@/lib/hebergement";
import type {
  Reservation,
  ReservationOccupantFormData,
  ReservationTypeReduction,
} from "@/lib/reservations";

type ApiMessage = { message?: string };

export type PublicBookingMaison = {
  id: number;
  nom: string;
  description: string | null;
  categorie: string | null;
  nb_chambres: number;
  lits_bebe_disponibles: boolean;
  nb_lits_bebe: number;
  adresse: string | null;
  quartier: string | null;
  ville: string | null;
  pays: string | null;
  telephone: string | null;
  whatsapp: string | null;
  note_moyenne: number | string | null;
  heure_checkin: string | null;
  heure_checkout: string | null;
  devise: string | null;
  taux_tva: number | string | null;
  taxe_de_sejour?: number | string | null;
  photo_principale: string | null;
  photos?: Array<{
    url: string;
    legende?: string | null;
    est_principale?: boolean;
    ordre?: number;
  }>;
};

export type PublicBookingSaison = {
  id: number;
  maison_id: number;
  nom: string;
  date_debut: string;
  date_fin: string;
  couleur: string | null;
};

export type PublicBookingTrancheAge = {
  id: number;
  nom: string;
  age_min: number;
  age_max: number;
};

export type PublicBookingContext = {
  maison: PublicBookingMaison;
  saisons: PublicBookingSaison[];
  saison_id: number | null;
  tranches_age: PublicBookingTrancheAge[];
  chambres: ChambreListItem[];
  supplements: SupplementTarifRow[];
};

export type PublicBookingClient = {
  civilite?: string | null;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  date_naissance?: string | null;
  piece_identite?: string | null;
};

export type PublicReservationPayload = {
  maison_id: number;
  chambre_id: number;
  date_arrivee: string;
  date_depart: string;
  nb_adultes: number;
  nbrs_enfants: number;
  nbrs_bebe: number;
  lit_bebe?: boolean | number;
  age_enfant?: number;
  promotion_id?: number | null;
  code_promo?: string | null;
  type_reduction?: ReservationTypeReduction | null;
  valeur_reduction?: number;
  prix_chambre_total: number;
  prix_bebe_total: number;
  prix_enfants_total: number;
  taux_tva_applique: number;
  prix_total_ht: number;
  montant_tva: number;
  prix_total_ttc: number;
  taxe_sejour_montant?: number;
  notes?: string | null;
  client: PublicBookingClient;
  occupants: ReservationOccupantFormData[];
};

async function parseResponse<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => ({}))) as T & ApiMessage;

  if (!response.ok) {
    throw new Error(data.message || "Une erreur est survenue.");
  }

  return data;
}

export async function fetchPublicBookingContext(
  maisonId: number,
  dateArrivee?: string
) {
  const params = new URLSearchParams();

  if (dateArrivee) {
    params.set("date_arrivee", dateArrivee);
  }

  const suffix = params.toString() ? `?${params.toString()}` : "";
  const response = await fetch(
    `${getApiBaseUrl()}/public/booking/${maisonId}${suffix}`
  );

  return parseResponse<PublicBookingContext>(response);
}

export type PublicPromoCode = {
  id: number;
  nom: string;
  code_promo: string | null;
  description: string | null;
  type_reduction: "pourcentage" | "valeur";
  valeur_reduction: number;
};

export async function validatePublicPromoCode(payload: {
  code: string;
  maison_id: number;
  chambre_id?: number;
  date_arrivee?: string;
  date_depart?: string;
}) {
  const response = await fetch(`${getApiBaseUrl()}/public/promotions/validate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseResponse<{ promotion: PublicPromoCode }>(response);
}

export async function createPublicReservation(payload: PublicReservationPayload) {
  const response = await fetch(`${getApiBaseUrl()}/public/reservations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseResponse<{ message: string; reservation: Reservation }>(response);
}
