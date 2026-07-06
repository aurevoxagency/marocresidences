import { getApiBaseUrl, getAuthToken } from "@/lib/auth";

type ApiMessage = { message?: string };

export type DashboardSummary = {
  maisons: number;
  maisons_actives: number;
  chambres: number;
  capacite_totale: number;
  chambres_actives: number;
  saisons: number;
  supplements_actifs: number;
  tranches_age: number;
  prospects: number;
  prospects_convertis: number;
  taux_conversion: number;
  clients: number;
  utilisateurs: number | null;
};

export type DashboardCountItem = {
  key: string;
  label: string;
  total: number;
};

export type DashboardStats = {
  summary: DashboardSummary;
  maisons_par_statut: DashboardCountItem[];
  maisons_par_ville: { ville: string; total: number }[];
  prospects_par_statut: DashboardCountItem[];
  prospects_par_source: DashboardCountItem[];
  evolution_mensuelle: {
    month: string;
    label: string;
    prospects: number;
    clients: number;
  }[];
  chambres_par_maison: {
    maison: string;
    chambres: number;
    allotement: number;
  }[];
  chambres_par_statut: DashboardCountItem[];
  saisons_par_maison: { maison: string; total: number }[];
  clients_par_nationalite: { nationalite: string; total: number }[];
  clients_vip: { vip: boolean; label: string; total: number }[];
  utilisateurs_par_role: { role_id: number; label: string; total: number }[] | null;
};

export async function fetchDashboardStats() {
  const token = getAuthToken();

  if (!token) {
    throw new Error("Session expirée. Veuillez vous reconnecter.");
  }

  const response = await fetch(`${getApiBaseUrl()}/dashboard/stats`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = (await response.json().catch(() => ({}))) as DashboardStats & ApiMessage;

  if (!response.ok) {
    throw new Error(data.message || "Impossible de charger les statistiques.");
  }

  return data;
}
