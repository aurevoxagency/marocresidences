import { getApiBaseUrl, getAuthToken } from "@/lib/auth";

type ApiMessage = { message?: string };

export type EtatChambreCheckin = "bon" | "a_signaler";
export type EtatChambreCheckout = "bon" | "a_signaler" | "degats";
export type DepotGarantieStatut = "non_pris" | "pris" | "rendu" | "retenu";

export type CheckinCheckout = {
  id: number;
  reservation_id: number;
  date_checkin_reel: string | null;
  date_checkout_reel: string | null;
  checkin_par: string | null;
  checkout_par: string | null;
  etat_chambre_checkin: EtatChambreCheckin | null;
  etat_chambre_checkout: EtatChambreCheckout | null;
  depot_garantie_montant: number | string;
  depot_garantie_statut: DepotGarantieStatut;
  notes_checkin: string | null;
  notes_checkout: string | null;
  date_creation: string;
  reservation_reference?: string | null;
  reservation_date_arrivee?: string | null;
  reservation_date_depart?: string | null;
  reservation_statut?: string | null;
  nb_adultes?: number;
  nbrs_enfants?: number;
  nbrs_bebe?: number;
  client_nom?: string | null;
  client_email?: string | null;
  client_telephone?: string | null;
  maison_nom?: string | null;
  chambre_nom?: string | null;
};

export type CheckinCheckoutFormData = {
  reservation_id: number;
  date_checkin_reel?: string | null;
  date_checkout_reel?: string | null;
  checkin_par?: string | null;
  checkout_par?: string | null;
  etat_chambre_checkin?: EtatChambreCheckin | null;
  etat_chambre_checkout?: EtatChambreCheckout | null;
  depot_garantie_montant?: number;
  depot_garantie_statut?: DepotGarantieStatut;
  notes_checkin?: string | null;
  notes_checkout?: string | null;
};

export type CheckinFlowStatus = "attente_checkin" | "en_sejour" | "termine";

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

export function getCheckinFlowStatus(record: {
  date_checkin_reel?: string | null;
  date_checkout_reel?: string | null;
}): CheckinFlowStatus {
  if (record.date_checkout_reel) {
    return "termine";
  }

  if (record.date_checkin_reel) {
    return "en_sejour";
  }

  return "attente_checkin";
}

export async function fetchCheckins(filters?: { maison_id?: number }) {
  const params = new URLSearchParams();

  if (filters?.maison_id) {
    params.set("maison_id", String(filters.maison_id));
  }

  const query = params.toString();
  const response = await fetch(
    `${getApiBaseUrl()}/checkins${query ? `?${query}` : ""}`,
    { headers: authHeaders() }
  );

  return parseResponse<CheckinCheckout[]>(response);
}

export async function fetchCheckin(id: number) {
  const response = await fetch(`${getApiBaseUrl()}/checkins/${id}`, {
    headers: authHeaders(),
  });

  return parseResponse<CheckinCheckout>(response);
}

export async function fetchCheckinByReservation(reservationId: number) {
  const response = await fetch(
    `${getApiBaseUrl()}/checkins/reservation/${reservationId}`,
    { headers: authHeaders() }
  );

  return parseResponse<CheckinCheckout>(response);
}

export async function createCheckin(data: CheckinCheckoutFormData) {
  const response = await fetch(`${getApiBaseUrl()}/checkins`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });

  const result = await parseResponse<{ checkin: CheckinCheckout }>(response);
  return result.checkin;
}

export async function updateCheckin(id: number, data: CheckinCheckoutFormData) {
  const response = await fetch(`${getApiBaseUrl()}/checkins/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });

  const result = await parseResponse<{ checkin: CheckinCheckout }>(response);
  return result.checkin;
}

export async function deleteCheckin(id: number) {
  const response = await fetch(`${getApiBaseUrl()}/checkins/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });

  await parseResponse<ApiMessage>(response);
}
