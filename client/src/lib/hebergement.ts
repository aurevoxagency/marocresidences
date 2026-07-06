import { getApiBaseUrl, getAuthToken } from "@/lib/auth";

type ApiMessage = { message?: string };

export type HebergementReferences = {
  categories_chambre: { id: number; nom: string }[];
  types_chambre: { id: number; nom: string }[];
  tranches_age: TrancheAge[];
  supplements: {
    id: number;
    nom: string;
    description: string | null;
    statut: "actif" | "inactif";
  }[];
};

export type Saison = {
  id: number;
  maison_id: number;
  nom: string;
  date_debut: string;
  date_fin: string;
  couleur: string | null;
};

export type TrancheAge = {
  id: number;
  nom: string;
  age_min: number;
  age_max: number;
};

export type TrancheAgeFormData = {
  nom: string;
  age_min: number;
  age_max: number;
};

export type TarifEnfant = {
  tranche_age_id: number;
  prix: number;
};

export type TarifChambre = {
  saison_id: number;
  prix_adulte: number;
  tarifs_enfant: TarifEnfant[];
};

export type TarifSupplement = TarifChambre & {
  prix_bebe: number;
};

export type ChambreTarifEnfantListItem = {
  tranche_age_id: number;
  tranche_nom: string;
  age_min: number;
  age_max: number;
  prix: number;
};

export type ChambrePromotion = {
  id: number;
  nom: string;
  type_reduction: "pourcentage" | "valeur";
  valeur_reduction: number;
};

export type ChambreListItem = {
  id: number;
  maison_id: number;
  nom: string;
  categorie_id: number;
  type_id: number;
  allotement: number;
  capacite_max: number;
  marge_type: "pourcentage" | "valeur";
  marge_valeur: number | string;
  statut: "actif" | "inactif";
  categorie_nom: string;
  type_nom: string;
  prix_adulte?: number | null;
  prix_bebe?: number | null;
  prix_enfant?: number | null;
  tarifs_enfant?: ChambreTarifEnfantListItem[];
  promotion?: ChambrePromotion | null;
  has_promotion?: boolean;
  nb_promotions?: number;
  date_creation: string;
  date_maj: string;
};

export type ChambreDetail = ChambreListItem & {
  tarifs: TarifChambre[];
};

export type ChambreFormData = {
  maison_id: number;
  nom: string;
  categorie_id: number;
  type_id: number;
  allotement?: number;
  capacite_max?: number;
  marge_type?: "pourcentage" | "valeur";
  marge_valeur?: number;
  statut?: "actif" | "inactif";
  tarifs?: TarifChambre[];
};

export type SaisonFormData = {
  maison_id: number;
  nom: string;
  date_debut: string;
  date_fin: string;
  couleur?: string | null;
};

export type SupplementTarifRow = {
  id: number;
  nom: string;
  description: string | null;
  statut: "actif" | "inactif";
  tarifs: TarifSupplement[];
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

export async function fetchHebergementReferences() {
  const response = await fetch(`${getApiBaseUrl()}/hebergement/meta/references`, {
    headers: authHeaders(),
  });

  return parseResponse<HebergementReferences>(response);
}

export async function fetchSaisons(maisonId: number) {
  const response = await fetch(`${getApiBaseUrl()}/hebergement/saisons?maison_id=${maisonId}`, {
    headers: authHeaders(),
  });

  return parseResponse<Saison[]>(response);
}

export async function createSaison(data: SaisonFormData) {
  const response = await fetch(`${getApiBaseUrl()}/hebergement/saisons`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });

  const result = await parseResponse<{ saison: Saison }>(response);
  return result.saison;
}

export async function updateSaison(id: number, data: Omit<SaisonFormData, "maison_id">) {
  const response = await fetch(`${getApiBaseUrl()}/hebergement/saisons/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });

  const result = await parseResponse<{ saison: Saison }>(response);
  return result.saison;
}

export async function deleteSaison(id: number) {
  const response = await fetch(`${getApiBaseUrl()}/hebergement/saisons/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });

  await parseResponse<ApiMessage>(response);
}

export async function fetchTranchesAge() {
  const response = await fetch(`${getApiBaseUrl()}/hebergement/tranches-age`, {
    headers: authHeaders(),
  });

  return parseResponse<TrancheAge[]>(response);
}

export async function createTrancheAge(data: TrancheAgeFormData) {
  const response = await fetch(`${getApiBaseUrl()}/hebergement/tranches-age`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });

  const result = await parseResponse<{ tranche: TrancheAge }>(response);
  return result.tranche;
}

export async function updateTrancheAge(id: number, data: TrancheAgeFormData) {
  const response = await fetch(`${getApiBaseUrl()}/hebergement/tranches-age/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });

  const result = await parseResponse<{ tranche: TrancheAge }>(response);
  return result.tranche;
}

export async function deleteTrancheAge(id: number) {
  const response = await fetch(`${getApiBaseUrl()}/hebergement/tranches-age/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });

  await parseResponse<ApiMessage>(response);
}

export async function fetchChambres(maisonId: number, saisonId?: number) {
  const params = new URLSearchParams({ maison_id: String(maisonId) });

  if (saisonId) {
    params.set("saison_id", String(saisonId));
  }

  const response = await fetch(`${getApiBaseUrl()}/hebergement/chambres?${params}`, {
    headers: authHeaders(),
  });

  return parseResponse<ChambreListItem[]>(response);
}

export async function fetchChambre(id: number) {
  const response = await fetch(`${getApiBaseUrl()}/hebergement/chambres/${id}`, {
    headers: authHeaders(),
  });

  return parseResponse<ChambreDetail>(response);
}

export async function createChambre(data: ChambreFormData) {
  const response = await fetch(`${getApiBaseUrl()}/hebergement/chambres`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });

  const result = await parseResponse<{ chambre: ChambreDetail }>(response);
  return result.chambre;
}

export async function updateChambre(id: number, data: Omit<ChambreFormData, "maison_id">) {
  const response = await fetch(`${getApiBaseUrl()}/hebergement/chambres/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });

  const result = await parseResponse<{ chambre: ChambreDetail }>(response);
  return result.chambre;
}

export async function deleteChambre(id: number) {
  const response = await fetch(`${getApiBaseUrl()}/hebergement/chambres/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });

  await parseResponse<ApiMessage>(response);
}

export async function fetchSupplementTarifs(maisonId: number) {
  const response = await fetch(
    `${getApiBaseUrl()}/hebergement/supplements/tarifs?maison_id=${maisonId}`,
    {
      headers: authHeaders(),
    }
  );

  return parseResponse<{ saisons: Saison[]; supplements: SupplementTarifRow[] }>(response);
}

export async function updateSupplementTarifs(
  supplementId: number,
  maisonId: number,
  tarifs: TarifSupplement[]
) {
  const response = await fetch(
    `${getApiBaseUrl()}/hebergement/supplements/${supplementId}/tarifs`,
    {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ maison_id: maisonId, tarifs }),
    }
  );

  await parseResponse<ApiMessage>(response);
}

export function buildEmptyChambreTarifs(
  saisons: Saison[],
  tranches: HebergementReferences["tranches_age"]
) {
  return saisons.map((saison) => ({
    saison_id: saison.id,
    prix_adulte: 0,
    tarifs_enfant: tranches.map((tranche) => ({
      tranche_age_id: tranche.id,
      prix: 0,
    })),
  }));
}

export function buildEmptySupplementTarifs(
  saisons: Saison[],
  tranches: HebergementReferences["tranches_age"]
) {
  return saisons.map((saison) => ({
    saison_id: saison.id,
    prix_adulte: 0,
    prix_bebe: 0,
    tarifs_enfant: tranches.map((tranche) => ({
      tranche_age_id: tranche.id,
      prix: 0,
    })),
  }));
}

export function mergeChambreTarifs(
  saisons: Saison[],
  tranches: HebergementReferences["tranches_age"],
  existing: TarifChambre[] = []
) {
  return saisons.map((saison) => {
    const current = existing.find((tarif) => tarif.saison_id === saison.id);

    return {
      saison_id: saison.id,
      prix_adulte: current?.prix_adulte ?? 0,
      tarifs_enfant: tranches.map((tranche) => {
        const child = current?.tarifs_enfant?.find(
          (row) => row.tranche_age_id === tranche.id
        );

        return {
          tranche_age_id: tranche.id,
          prix: child?.prix ?? 0,
        };
      }),
    };
  });
}

export function mergeSupplementTarifs(
  saisons: Saison[],
  tranches: HebergementReferences["tranches_age"],
  existing: TarifSupplement[] = []
) {
  return saisons.map((saison) => {
    const current = existing.find((tarif) => tarif.saison_id === saison.id);

    return {
      saison_id: saison.id,
      prix_adulte: current?.prix_adulte ?? 0,
      prix_bebe: current?.prix_bebe ?? 0,
      tarifs_enfant: tranches.map((tranche) => {
        const child = current?.tarifs_enfant?.find(
          (row) => row.tranche_age_id === tranche.id
        );

        return {
          tranche_age_id: tranche.id,
          prix: child?.prix ?? 0,
        };
      }),
    };
  });
}
