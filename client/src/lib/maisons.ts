import { getApiBaseUrl, getAuthToken } from "@/lib/auth";

type ApiMessage = { message?: string };

export type MaisonStatut = "actif" | "inactif" | "en_attente";

export type MaisonPhoto = {
  id?: number;
  url: string;
  legende?: string | null;
  est_principale?: boolean;
  ordre?: number;
};

export type MaisonHoraire = {
  id?: number;
  jour_semaine: string;
  heure_ouverture?: string | null;
  heure_fermeture?: string | null;
  ferme?: boolean;
};

export type MaisonListItem = {
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
  code_postal: string | null;
  pays: string | null;
  telephone: string | null;
  whatsapp: string | null;
  email: string | null;
  site_web: string | null;
  devise: string | null;
  taux_tva: number | string | null;
  taxe_de_sejour?: number | string | null;
  numero_patente: string | null;
  numero_ice: string | null;
  numero_classement: string | null;
  statut: MaisonStatut;
  note_moyenne: number | string | null;
  heure_checkin: string | null;
  heure_checkout: string | null;
  photo_principale?: string | null;
  prix_adulte_min?: number | string | null;
  capacite_prix?: number | string | null;
  services?: string[];
  equipements?: string[];
  date_creation: string;
  date_maj: string;
};

export type MaisonDetail = Omit<MaisonListItem, "services" | "equipements"> & {
  latitude: number | string | null;
  longitude: number | string | null;
  photos: MaisonPhoto[];
  services: { id: number; nom: string; icone: string | null }[];
  equipements: {
    id: number;
    nom: string;
    categorie: string | null;
    icone: string | null;
  }[];
  langues: { id: number; code: string; nom: string }[];
  horaires: MaisonHoraire[];
  service_ids: number[];
  equipement_ids: number[];
  langue_ids: number[];
};

export type MaisonFormData = {
  nom: string;
  description?: string;
  categorie?: string;
  nb_chambres?: number;
  lits_bebe_disponibles?: boolean;
  nb_lits_bebe?: number;
  adresse?: string;
  quartier?: string;
  ville?: string;
  code_postal?: string;
  pays?: string;
  latitude?: number | null;
  longitude?: number | null;
  telephone?: string;
  whatsapp?: string;
  email?: string;
  site_web?: string;
  devise?: string;
  taux_tva?: number;
  taxe_de_sejour?: number;
  numero_patente?: string;
  numero_ice?: string;
  numero_classement?: string;
  statut?: MaisonStatut;
  heure_checkin?: string;
  heure_checkout?: string;
  service_ids?: number[];
  equipement_ids?: number[];
  langue_ids?: number[];
  photos?: MaisonPhoto[];
  horaires?: MaisonHoraire[];
};

export type MaisonReferences = {
  services: { id: number; nom: string; icone: string | null }[];
  equipements: {
    id: number;
    nom: string;
    categorie: string | null;
    icone: string | null;
  }[];
  langues: { id: number; code: string; nom: string }[];
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

export async function fetchMaisonsCatalog(
  query?: string,
  options?: { adults?: number }
) {
  const params = new URLSearchParams();

  if (query?.trim()) {
    params.set("q", query.trim());
  }

  if (options?.adults != null && options.adults >= 1) {
    params.set("adults", String(Math.min(12, Math.floor(options.adults))));
  }

  const suffix = params.toString() ? `?${params.toString()}` : "";
  const response = await fetch(`${getApiBaseUrl()}/maisons/catalog${suffix}`);

  return parseResponse<MaisonListItem[]>(response);
}

export async function fetchMaisons() {
  const response = await fetch(`${getApiBaseUrl()}/maisons`, {
    headers: authHeaders(),
  });

  return parseResponse<MaisonListItem[]>(response);
}

export async function fetchMaison(id: number) {
  const response = await fetch(`${getApiBaseUrl()}/maisons/${id}`, {
    headers: authHeaders(),
  });

  return parseResponse<MaisonDetail>(response);
}

export async function fetchMaisonReferences() {
  const response = await fetch(`${getApiBaseUrl()}/maisons/meta/references`, {
    headers: authHeaders(),
  });

  return parseResponse<MaisonReferences>(response);
}

export async function createMaison(data: MaisonFormData) {
  const response = await fetch(`${getApiBaseUrl()}/maisons`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });

  const result = await parseResponse<{ maison: MaisonDetail }>(response);
  return result.maison;
}

export async function updateMaison(id: number, data: MaisonFormData) {
  const response = await fetch(`${getApiBaseUrl()}/maisons/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });

  const result = await parseResponse<{ maison: MaisonDetail }>(response);
  return result.maison;
}

export async function deleteMaison(id: number) {
  const response = await fetch(`${getApiBaseUrl()}/maisons/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });

  await parseResponse<ApiMessage>(response);
}

export function getServerBaseUrl() {
  return getApiBaseUrl().replace(/\/api\/?$/, "");
}

export function resolvePhotoUrl(url?: string | null) {
  if (!url) {
    return "";
  }

  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("blob:")) {
    return url;
  }

  return `${getServerBaseUrl()}${url.startsWith("/") ? url : `/${url}`}`;
}

export async function uploadMaisonPhoto(file: File) {
  const token = getAuthToken();

  if (!token) {
    throw new Error("Session expirée. Veuillez vous reconnecter.");
  }

  const formData = new FormData();
  formData.append("photo", file);

  const response = await fetch(`${getApiBaseUrl()}/maisons/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const result = await parseResponse<{ url?: string; path?: string }>(response);
  const uploadedUrl = result.url || result.path;

  if (!uploadedUrl) {
    throw new Error("Aucune URL de photo reçue.");
  }

  return resolvePhotoUrl(uploadedUrl);
}
