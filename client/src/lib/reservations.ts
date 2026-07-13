import { getApiBaseUrl, getAuthToken } from "@/lib/auth";

type ApiMessage = { message?: string };

export type ReservationSource =
  | "site_web"
  | "booking"
  | "airbnb"
  | "agence"
  | "telephone"
  | "walk_in"
  | "autre";

export type ReservationStatut =
  | "en_attente"
  | "confirmee"
  | "annulee"
  | "terminee"
  | "no_show";

export type ReservationStatutPaiement =
  | "non_paye"
  | "acompte_paye"
  | "paye_totalement"
  | "rembourse";

export type ReservationTypeReduction = "%" | "MAD";

export type ReservationOccupantType = "adulte" | "enfant" | "bebe";

export type ReservationOccupant = {
  id?: number;
  reservation_id?: number;
  type_occupant: ReservationOccupantType;
  nom: string | null;
  prenom: string | null;
  age_enfant: number | null;
  tranche_age_id: number | null;
  tranche_age_nom?: string | null;
  supplement_id?: number | null;
  supplement_nom?: string | null;
  date_naissance?: string | null;
  piece_identite?: string | null;
  allergies_regime?: string | null;
  prix_unitaire?: number | string;
  prix_total?: number | string;
  date_creation?: string;
};

export type ReservationOccupantFormData = {
  type_occupant: ReservationOccupantType;
  nom?: string | null;
  prenom?: string | null;
  age_enfant?: number | null;
  tranche_age_id?: number | null;
  supplement_id?: number | null;
  date_naissance?: string | null;
  piece_identite?: string | null;
  allergies_regime?: string | null;
  prix_unitaire?: number;
  prix_total?: number;
};

export type Reservation = {
  id: number;
  reference: string;
  client_id: number;
  chambre_id: number;
  maison_id: number;
  date_arrivee: string;
  date_depart: string;
  nb_nuits: number;
  nb_adultes: number;
  nbrs_enfants: number;
  nbrs_bebe: number;
  age_enfant: number;
  source: ReservationSource;
  promotion_id: number | null;
  type_reduction: ReservationTypeReduction | null;
  valeur_reduction: number | string;
  supplement_id: number | null;
  prix_chambre_total: number | string;
  prix_bebe_total: number | string;
  prix_enfants_total: number | string;
  prix_total_ht: number | string;
  taux_tva_applique: number | string;
  montant_tva: number | string;
  prix_total_ttc: number | string;
  statut_reservation: ReservationStatut;
  statut_paiement: ReservationStatutPaiement;
  montant_paye: number | string;
  notes: string | null;
  date_creation: string;
  date_maj: string;
  client_nom?: string | null;
  client_email?: string | null;
  maison_nom?: string | null;
  chambre_nom?: string | null;
  promotion_nom?: string | null;
  supplement_nom?: string | null;
  occupants?: ReservationOccupant[];
};

export type ReservationFormData = {
  client_id: number;
  chambre_id: number;
  maison_id: number;
  date_arrivee: string;
  date_depart: string;
  nb_adultes?: number;
  nbrs_enfants?: number;
  nbrs_bebe?: number;
  age_enfant?: number;
  source?: ReservationSource;
  promotion_id?: number | null;
  type_reduction?: ReservationTypeReduction | null;
  valeur_reduction?: number;
  supplement_id?: number | null;
  prix_chambre_total: number;
  prix_bebe_total?: number;
  prix_enfants_total?: number;
  prix_total_ht?: number;
  taux_tva_applique: number;
  montant_tva?: number;
  prix_total_ttc?: number;
  statut_reservation?: ReservationStatut;
  statut_paiement?: ReservationStatutPaiement;
  montant_paye?: number;
  notes?: string | null;
  occupants?: ReservationOccupantFormData[];
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

export function calculateNights(dateArrivee: string, dateDepart: string) {
  if (!dateArrivee || !dateDepart) {
    return 0;
  }

  const start = new Date(`${dateArrivee}T00:00:00`);
  const end = new Date(`${dateDepart}T00:00:00`);
  const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  return diff > 0 ? diff : 0;
}

export function computeMontantReduction(
  subtotal: number,
  typeReduction?: ReservationTypeReduction | null,
  valeurReduction?: number
) {
  const value = Number(valeurReduction) || 0;

  if (!typeReduction || value <= 0) {
    return 0;
  }

  if (typeReduction === "%") {
    return Math.round(subtotal * (value / 100) * 100) / 100;
  }

  return Math.min(subtotal, Math.round(value * 100) / 100);
}

export function calculateReservationTotals(fields: {
  prix_chambre_total: number;
  prix_bebe_total?: number;
  prix_enfants_total?: number;
  supplement_total?: number;
  type_reduction?: ReservationTypeReduction | null;
  valeur_reduction?: number;
  taux_tva_applique: number;
}) {
  const subtotal =
    fields.prix_chambre_total +
    (fields.prix_bebe_total ?? 0) +
    (fields.prix_enfants_total ?? 0) +
    (fields.supplement_total ?? 0);
  const montantReduction = computeMontantReduction(
    subtotal,
    fields.type_reduction,
    fields.valeur_reduction
  );
  const prixTotalHt = Math.max(0, subtotal - montantReduction);
  const montantTva = Math.round(prixTotalHt * (fields.taux_tva_applique / 100) * 100) / 100;
  const prixTotalTtc = Math.round((prixTotalHt + montantTva) * 100) / 100;

  return {
    montant_reduction: montantReduction,
    prix_total_ht: prixTotalHt,
    montant_tva: montantTva,
    prix_total_ttc: prixTotalTtc,
  };
}

export function applyPromotionDiscount(
  price: number,
  promotion: { type_reduction: "pourcentage" | "valeur"; valeur_reduction: number }
) {
  if (promotion.type_reduction === "pourcentage") {
    return Math.max(0, Math.round(price * (1 - promotion.valeur_reduction / 100) * 100) / 100);
  }

  return Math.max(0, Math.round((price - promotion.valeur_reduction) * 100) / 100);
}

export function calculateChambreStayTotal(
  prixNuit: number | null | undefined,
  nbNuits: number,
  promotion?: { type_reduction: "pourcentage" | "valeur"; valeur_reduction: number } | null
) {
  const base = Number(prixNuit);

  if (!Number.isFinite(base) || base <= 0) {
    return null;
  }

  const nightly = promotion ? applyPromotionDiscount(base, promotion) : base;
  const nights = Math.max(nbNuits, 1);

  return Math.round(nightly * nights * 100) / 100;
}

export function getBebeTranche(chambre: {
  tarifs_enfant?: Array<{ tranche_nom: string; age_max: number; prix: number }>;
}) {
  return (chambre.tarifs_enfant || []).find(
    (tarif) => /b[eé]b[eé]/i.test(tarif.tranche_nom) || Number(tarif.age_max) <= 2
  );
}

export function findTrancheTarifForAge(
  tarifs: Array<{ tranche_nom: string; age_min: number; age_max: number; prix: number }>,
  age: number
) {
  return tarifs.find((tarif) => age >= tarif.age_min && age <= tarif.age_max);
}

export function resolveTrancheAgeId(
  tranches: Array<{ id: number; age_min: number; age_max: number }>,
  age: number
) {
  return tranches.find((tranche) => age >= tranche.age_min && age <= tranche.age_max)?.id ?? null;
}

export function calculateEnfantsStayTotalFromAges(
  chambre: {
    prix_enfant?: number | null;
    tarifs_enfant?: Array<{
      tranche_nom: string;
      age_min: number;
      age_max: number;
      prix: number;
    }>;
  },
  nbNuits: number,
  ages: number[],
  promotion?: { type_reduction: "pourcentage" | "valeur"; valeur_reduction: number } | null
) {
  return ages.reduce((total, age) => {
    return total + calculateEnfantStayTotal(chambre, nbNuits, age, promotion);
  }, 0);
}

export function getEnfantAgeOptions(chambre: {
  tarifs_enfant?: Array<{
    tranche_nom: string;
    age_min: number;
    age_max: number;
    prix: number;
  }>;
}) {
  const bebeTranche = getBebeTranche(chambre);
  const tarifs = (chambre.tarifs_enfant || []).filter((tarif) => tarif !== bebeTranche);
  const options: Array<{ age: number; label: string }> = [];

  for (const tarif of tarifs) {
    for (let age = tarif.age_min; age <= tarif.age_max; age++) {
      options.push({
        age,
        label: `${age} an${age > 1 ? "s" : ""} · ${tarif.tranche_nom} (${tarif.age_min}-${tarif.age_max} ans)`,
      });
    }
  }

  return options.sort((a, b) => a.age - b.age);
}

export function calculateBebeStayTotal(
  chambre: {
    prix_bebe?: number | null;
    tarifs_enfant?: Array<{ tranche_nom: string; age_max: number; prix: number }>;
  },
  nbNuits: number,
  promotion?: { type_reduction: "pourcentage" | "valeur"; valeur_reduction: number } | null
) {
  const bebeTranche = getBebeTranche(chambre);
  const prixNuit = bebeTranche?.prix ?? chambre.prix_bebe;

  return calculateChambreStayTotal(prixNuit, nbNuits, promotion) ?? 0;
}

export function calculateEnfantStayTotal(
  chambre: {
    prix_enfant?: number | null;
    tarifs_enfant?: Array<{
      tranche_nom: string;
      age_min: number;
      age_max: number;
      prix: number;
    }>;
  },
  nbNuits: number,
  ageEnfant?: number,
  promotion?: { type_reduction: "pourcentage" | "valeur"; valeur_reduction: number } | null
) {
  const bebeTranche = getBebeTranche(chambre);
  const autresEnfants = (chambre.tarifs_enfant || []).filter((tarif) => tarif !== bebeTranche);

  if (autresEnfants.length === 0) {
    if (ageEnfant == null || ageEnfant < 0) {
      return 0;
    }

    return calculateChambreStayTotal(chambre.prix_enfant, nbNuits, promotion) ?? 0;
  }

  if (ageEnfant == null || ageEnfant < 0) {
    return 0;
  }

  const tranche = findTrancheTarifForAge(autresEnfants, ageEnfant);

  if (!tranche) {
    return 0;
  }

  const nights = Math.max(nbNuits, 1);

  return calculateChambreStayTotal(tranche.prix, nights, promotion) ?? 0;
}

export function calculateOccupantSupplementStayTotal(
  supplement: {
    tarifs: Array<{
      saison_id: number;
      prix_adulte: number;
      prix_bebe: number;
      tarifs_enfant: Array<{ tranche_age_id: number; prix: number }>;
    }>;
  } | null | undefined,
  saisonId: number | undefined,
  type: ReservationOccupantType,
  ageEnfant: number | null | undefined,
  nbNuits: number,
  tranchesAge: Array<{ id: number; age_min: number; age_max: number }>,
  promotion?: { type_reduction: "pourcentage" | "valeur"; valeur_reduction: number } | null
) {
  if (!supplement || !saisonId) {
    return 0;
  }

  const tarif = supplement.tarifs.find((item) => item.saison_id === saisonId);

  if (!tarif) {
    return 0;
  }

  const nights = Math.max(nbNuits, 1);

  if (type === "adulte") {
    return calculateChambreStayTotal(tarif.prix_adulte, nights, promotion) ?? 0;
  }

  if (type === "bebe") {
    return calculateChambreStayTotal(tarif.prix_bebe, nights, promotion) ?? 0;
  }

  if (ageEnfant == null || ageEnfant < 0) {
    return 0;
  }

  const tranche = tranchesAge.find(
    (item) => ageEnfant >= item.age_min && ageEnfant <= item.age_max
  );
  const childTarif = tranche
    ? tarif.tarifs_enfant.find((item) => item.tranche_age_id === tranche.id)
    : null;

  return calculateChambreStayTotal(childTarif?.prix, nights, promotion) ?? 0;
}

export function calculateSupplementStayTotal(
  supplement: {
    tarifs: Array<{
      saison_id: number;
      prix_adulte: number;
      prix_bebe: number;
      tarifs_enfant: Array<{ tranche_age_id: number; prix: number }>;
    }>;
  } | null | undefined,
  saisonId: number | undefined,
  params: {
    nbAdultes: number;
    nbrsEnfants: number;
    nbrsBebe: number;
    ageEnfant?: number;
    nbNuits: number;
  },
  tranchesAge: Array<{ id: number; age_min: number; age_max: number }>,
  promotion?: { type_reduction: "pourcentage" | "valeur"; valeur_reduction: number } | null
) {
  if (!supplement || !saisonId) {
    return 0;
  }

  const adultStay = calculateOccupantSupplementStayTotal(
    supplement,
    saisonId,
    "adulte",
    null,
    params.nbNuits,
    tranchesAge,
    promotion
  );
  const bebeStay = calculateOccupantSupplementStayTotal(
    supplement,
    saisonId,
    "bebe",
    null,
    params.nbNuits,
    tranchesAge,
    promotion
  );
  const enfantStay = calculateOccupantSupplementStayTotal(
    supplement,
    saisonId,
    "enfant",
    params.ageEnfant,
    params.nbNuits,
    tranchesAge,
    promotion
  );

  return (
    Math.round(
      (adultStay * Math.max(1, params.nbAdultes) +
        bebeStay * Math.max(0, params.nbrsBebe) +
        enfantStay * Math.max(0, params.nbrsEnfants)) *
        100
    ) / 100
  );
}

export async function fetchReservations(filters?: {
  maison_id?: number;
  statut_reservation?: ReservationStatut;
}) {
  const params = new URLSearchParams();

  if (filters?.maison_id) {
    params.set("maison_id", String(filters.maison_id));
  }

  if (filters?.statut_reservation) {
    params.set("statut_reservation", filters.statut_reservation);
  }

  const query = params.toString();
  const response = await fetch(
    `${getApiBaseUrl()}/reservations${query ? `?${query}` : ""}`,
    { headers: authHeaders() }
  );

  return parseResponse<Reservation[]>(response);
}

export async function fetchReservation(id: number) {
  const response = await fetch(`${getApiBaseUrl()}/reservations/${id}`, {
    headers: authHeaders(),
  });

  return parseResponse<Reservation>(response);
}

export async function createReservation(data: ReservationFormData) {
  const response = await fetch(`${getApiBaseUrl()}/reservations`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });

  const result = await parseResponse<{ reservation: Reservation }>(response);
  return result.reservation;
}

export async function updateReservation(id: number, data: ReservationFormData) {
  const response = await fetch(`${getApiBaseUrl()}/reservations/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });

  const result = await parseResponse<{ reservation: Reservation }>(response);
  return result.reservation;
}

export async function deleteReservation(id: number) {
  const response = await fetch(`${getApiBaseUrl()}/reservations/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });

  await parseResponse<ApiMessage>(response);
}
