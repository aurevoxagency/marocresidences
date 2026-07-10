import { getApiBaseUrl, getAuthToken } from "@/lib/auth";
import type { Commande } from "@/lib/commandes";

type ApiMessage = { message?: string };

export type FactureStatut =
  | "brouillon"
  | "emise"
  | "payee_partiellement"
  | "payee"
  | "annulee"
  | "en_retard";

export type FactureModePaiement = "especes" | "carte" | "virement" | "cheque" | "autre";

export type FactureItem = {
  id?: number;
  facture_id?: number;
  description: string;
  quantite: number | string;
  prix_unitaire: number | string;
  taux_tva: number | string;
  prix_total_ht: number | string;
  prix_total_ttc: number | string;
  ordre?: number;
};

export type Facture = {
  id: number;
  numero_facture: string;
  reservation_id: number | null;
  commande_id: number | null;
  client_id: number;
  maison_id: number;
  date_facture: string;
  date_echeance: string | null;
  montant_ht: number | string;
  taux_tva: number | string;
  montant_tva: number | string;
  montant_ttc: number | string;
  montant_paye: number | string;
  montant_restant: number | string;
  statut: FactureStatut;
  mode_paiement: FactureModePaiement | null;
  notes: string | null;
  date_creation: string;
  date_maj: string;
  client_nom?: string | null;
  client_email?: string | null;
  maison_nom?: string | null;
  reservation_reference?: string | null;
  commande_reference?: string | null;
  items?: FactureItem[];
};

export type FactureFormData = {
  reservation_id?: number | null;
  commande_id?: number | null;
  client_id: number;
  maison_id: number;
  date_facture: string;
  date_echeance?: string;
  montant_ht?: number;
  taux_tva?: number;
  montant_tva?: number;
  montant_ttc?: number;
  montant_paye?: number;
  montant_restant?: number;
  statut?: FactureStatut;
  mode_paiement?: FactureModePaiement | null;
  notes?: string | null;
  items: FactureItem[];
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

export function calculateFactureLineTotals(item: {
  quantite: number;
  prix_unitaire: number;
  taux_tva: number;
}) {
  const prixTotalHt = Math.round(item.quantite * item.prix_unitaire * 100) / 100;
  const prixTotalTtc = Math.round(prixTotalHt * (1 + item.taux_tva / 100) * 100) / 100;

  return { prix_total_ht: prixTotalHt, prix_total_ttc: prixTotalTtc };
}

export function calculateFactureTotals(fields: {
  items: Array<{ prix_total_ht: number; prix_total_ttc: number }>;
  montant_paye?: number;
}) {
  const montantHt = fields.items.reduce((sum, item) => sum + item.prix_total_ht, 0);
  const montantTtc = fields.items.reduce((sum, item) => sum + item.prix_total_ttc, 0);
  const montantTva = Math.round((montantTtc - montantHt) * 100) / 100;
  const montantPaye = Number(fields.montant_paye) || 0;
  const montantRestant = Math.max(0, Math.round((montantTtc - montantPaye) * 100) / 100);
  const tauxTva =
    montantHt > 0 ? Math.round((montantTva / montantHt) * 10000) / 100 : 10;

  return {
    montant_ht: Math.round(montantHt * 100) / 100,
    montant_tva: montantTva,
    montant_ttc: Math.round(montantTtc * 100) / 100,
    taux_tva: tauxTva,
    montant_restant: montantRestant,
  };
}

export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function defaultEcheanceDate(days = 30) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export async function fetchFactures() {
  const response = await fetch(`${getApiBaseUrl()}/factures`, {
    headers: authHeaders(),
  });

  return parseResponse<Facture[]>(response);
}

export async function fetchFactureById(id: number) {
  const response = await fetch(`${getApiBaseUrl()}/factures/${id}`, {
    headers: authHeaders(),
  });

  return parseResponse<Facture>(response);
}

export async function createFacture(data: FactureFormData) {
  const response = await fetch(`${getApiBaseUrl()}/factures`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });

  return parseResponse<Facture>(response);
}

export async function updateFacture(id: number, data: FactureFormData) {
  const response = await fetch(`${getApiBaseUrl()}/factures/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });

  return parseResponse<Facture>(response);
}

export async function deleteFacture(id: number) {
  const response = await fetch(`${getApiBaseUrl()}/factures/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });

  return parseResponse<{ message: string }>(response);
}

export function buildFacturePayloadFromCommande(commande: Commande): FactureFormData {
  const tauxTva = Number(commande.taux_tva) || 10;
  const items = (commande.items ?? [])
    .filter((item) => item.description?.trim())
    .map((item, index) => {
      const quantite = Number(item.quantite) || 1;
      const prixUnitaire = Number(item.prix_unitaire) || 0;
      const lineTotals = calculateFactureLineTotals({
        quantite,
        prix_unitaire: prixUnitaire,
        taux_tva: tauxTva,
      });

      return {
        description: item.description.trim(),
        quantite,
        prix_unitaire: prixUnitaire,
        taux_tva: tauxTva,
        prix_total_ht: lineTotals.prix_total_ht,
        prix_total_ttc: lineTotals.prix_total_ttc,
        ordre: index,
      };
    });

  if (items.length === 0) {
    throw new Error("La commande ne contient aucune ligne à facturer.");
  }

  const totals = calculateFactureTotals({
    items: items.map((item) => ({
      prix_total_ht: Number(item.prix_total_ht),
      prix_total_ttc: Number(item.prix_total_ttc),
    })),
    montant_paye: 0,
  });

  return {
    commande_id: commande.id,
    reservation_id: commande.reservation_id,
    client_id: commande.client_id,
    maison_id: commande.maison_id,
    date_facture: todayIsoDate(),
    date_echeance: defaultEcheanceDate(),
    montant_ht: totals.montant_ht,
    taux_tva: totals.taux_tva,
    montant_tva: totals.montant_tva,
    montant_ttc: totals.montant_ttc,
    montant_paye: 0,
    montant_restant: totals.montant_restant,
    statut: "brouillon",
    mode_paiement: null,
    notes: commande.notes
      ? `Facture issue de la commande ${commande.reference}\n${commande.notes}`
      : `Facture issue de la commande ${commande.reference}`,
    items,
  };
}
