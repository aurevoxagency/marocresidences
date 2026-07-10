import { getApiBaseUrl, getAuthToken } from "@/lib/auth";
import type { Devis } from "@/lib/devis";

type ApiMessage = { message?: string };

export type CommandeStatut = "en_attente" | "validee" | "livree" | "annulee";

export type CommandeStatutPaiement = "non_paye" | "paye" | "ajoute_facture";

export type CommandeItem = {
  id?: number;
  commande_id?: number;
  supplement_id?: number | null;
  supplement_nom?: string | null;
  description: string;
  quantite: number | string;
  prix_unitaire: number | string;
  prix_total: number | string;
};

export type Commande = {
  id: number;
  reference: string;
  reservation_id: number;
  devis_id: number | null;
  client_id: number;
  maison_id: number;
  date_commande: string;
  montant_ht: number | string;
  taux_tva: number | string;
  montant_tva: number | string;
  montant_ttc: number | string;
  statut: CommandeStatut;
  statut_paiement: CommandeStatutPaiement;
  notes: string | null;
  date_creation: string;
  date_maj: string;
  client_nom?: string | null;
  client_email?: string | null;
  maison_nom?: string | null;
  reservation_reference?: string | null;
  reservation_date_arrivee?: string | null;
  reservation_date_depart?: string | null;
  devis_reference?: string | null;
  items?: CommandeItem[];
};

export type CommandeFormData = {
  reservation_id: number;
  devis_id?: number | null;
  client_id: number;
  maison_id: number;
  date_commande?: string;
  montant_ht?: number;
  taux_tva?: number;
  montant_tva?: number;
  montant_ttc?: number;
  statut?: CommandeStatut;
  statut_paiement?: CommandeStatutPaiement;
  notes?: string | null;
  items: CommandeItem[];
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

export function calculateCommandeTotals(fields: {
  items: Array<{ prix_total: number }>;
  taux_tva?: number;
}) {
  const montantHt = fields.items.reduce((sum, item) => sum + (Number(item.prix_total) || 0), 0);
  const tauxTva = Number(fields.taux_tva) || 0;
  const montantTva = Math.round(montantHt * (tauxTva / 100) * 100) / 100;
  const montantTtc = Math.round((montantHt + montantTva) * 100) / 100;

  return {
    montant_ht: montantHt,
    montant_tva: montantTva,
    montant_ttc: montantTtc,
  };
}

export function nowDatetimeLocal() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

export function datetimeInput(value?: string | null) {
  if (!value) {
    return "";
  }

  return String(value).replace(" ", "T").slice(0, 16);
}

export async function fetchCommandes() {
  const response = await fetch(`${getApiBaseUrl()}/commandes`, {
    headers: authHeaders(),
  });

  return parseResponse<Commande[]>(response);
}

export async function fetchCommandeById(id: number) {
  const response = await fetch(`${getApiBaseUrl()}/commandes/${id}`, {
    headers: authHeaders(),
  });

  return parseResponse<Commande>(response);
}

export async function createCommande(data: CommandeFormData) {
  const response = await fetch(`${getApiBaseUrl()}/commandes`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });

  return parseResponse<Commande>(response);
}

export async function updateCommande(id: number, data: CommandeFormData) {
  const response = await fetch(`${getApiBaseUrl()}/commandes/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });

  return parseResponse<Commande>(response);
}

export async function deleteCommande(id: number) {
  const response = await fetch(`${getApiBaseUrl()}/commandes/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });

  return parseResponse<{ message: string }>(response);
}

export function buildCommandePayloadFromDevis(devis: Devis): CommandeFormData {
  if (!devis.client_id) {
    throw new Error("Ce devis est lié à un prospect. Un client est requis pour créer une commande.");
  }

  if (!devis.reservation_id) {
    throw new Error("Ce devis doit être lié à une réservation pour créer une commande.");
  }

  const items = (devis.items ?? [])
    .filter((item) => item.description?.trim())
    .map((item) => {
      const quantite = Number(item.quantite) || 1;
      const prixUnitaire = Number(item.prix_unitaire) || 0;
      const prixTotal =
        Number(item.prix_total) || Math.round(quantite * prixUnitaire * 100) / 100;

      return {
        supplement_id: item.supplement_id ?? null,
        description: item.description.trim(),
        quantite,
        prix_unitaire: prixUnitaire,
        prix_total: prixTotal,
      };
    });

  if (items.length === 0) {
    throw new Error("Le devis ne contient aucune ligne à convertir.");
  }

  const tauxTva = Number(devis.taux_tva) || 10;
  const totals = calculateCommandeTotals({
    items: items.map((item) => ({ prix_total: item.prix_total })),
    taux_tva: tauxTva,
  });

  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());

  return {
    reservation_id: devis.reservation_id,
    devis_id: devis.id,
    client_id: devis.client_id,
    maison_id: devis.maison_id,
    date_commande: now.toISOString().slice(0, 16).replace("T", " "),
    montant_ht: totals.montant_ht,
    taux_tva: tauxTva,
    montant_tva: totals.montant_tva,
    montant_ttc: totals.montant_ttc,
    statut: "en_attente",
    statut_paiement: "non_paye",
    notes: devis.notes
      ? `Commande issue du devis ${devis.reference}\n${devis.notes}`
      : `Commande issue du devis ${devis.reference}`,
    items,
  };
}

export function buildCommandeFormDataFromCommande(
  commande: Commande,
  patch?: Partial<CommandeFormData>
): CommandeFormData {
  const items = (commande.items ?? []).map((item) => ({
    supplement_id: item.supplement_id ?? null,
    description: item.description,
    quantite: Number(item.quantite) || 1,
    prix_unitaire: Number(item.prix_unitaire) || 0,
    prix_total: Number(item.prix_total) || 0,
  }));

  return {
    reservation_id: commande.reservation_id,
    devis_id: commande.devis_id,
    client_id: commande.client_id,
    maison_id: commande.maison_id,
    date_commande: String(commande.date_commande).replace("T", " ").slice(0, 19),
    montant_ht: Number(commande.montant_ht),
    taux_tva: Number(commande.taux_tva),
    montant_tva: Number(commande.montant_tva),
    montant_ttc: Number(commande.montant_ttc),
    statut: commande.statut,
    statut_paiement: commande.statut_paiement,
    notes: commande.notes,
    items,
    ...patch,
  };
}

export function isCommandeInvoiced(
  commande: Commande,
  facturesWithCommande: Array<{ commande_id: number | null }>
) {
  if (commande.statut_paiement === "ajoute_facture") {
    return true;
  }

  return facturesWithCommande.some((facture) => facture.commande_id === commande.id);
}
