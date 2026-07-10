import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FileText,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  Wand2,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { AssociatedDocumentHint } from "@/components/associated-document-hint";
import { fetchClients, type Client } from "@/lib/clients";
import {
  calculateDevisTotals,
  calculateNights,
  createDevis,
  defaultValiditeDate,
  deleteDevis,
  fetchDevis,
  fetchDevisById,
  buildDevisFormDataFromDevis,
  isDevisConverted,
  todayIsoDate,
  updateDevis,
  type Devis,
  type DevisFormData,
  type DevisItem,
  type DevisItemType,
  type DevisStatut,
} from "@/lib/devis";
import {
  buildCommandePayloadFromDevis,
  createCommande,
  fetchCommandes,
  type Commande,
} from "@/lib/commandes";
import { fetchChambres, fetchSaisons, fetchSupplementTarifs, type ChambreListItem, type Saison } from "@/lib/hebergement";
import { fetchMaisons, type MaisonListItem } from "@/lib/maisons";
import { fetchPromotions, type Promotion } from "@/lib/promotions";
import { fetchProspects, type Prospect } from "@/lib/prospects";
import { fetchReservations, type Reservation } from "@/lib/reservations";
import type { ReservationTypeReduction } from "@/lib/reservations";

const STATUT_LABELS: Record<DevisStatut, string> = {
  brouillon: "Brouillon",
  envoye: "Envoyé",
  accepte: "Accepté",
  refuse: "Refusé",
  expire: "Expiré",
  converti: "Converti",
};

const STATUT_VARIANTS: Record<
  DevisStatut,
  "default" | "secondary" | "destructive" | "outline"
> = {
  brouillon: "secondary",
  envoye: "default",
  accepte: "default",
  refuse: "destructive",
  expire: "outline",
  converti: "default",
};

const ITEM_TYPE_LABELS: Record<DevisItemType, string> = {
  chambre: "Chambre",
  enfant: "Enfant",
  bebe: "Bébé",
  supplement: "Supplément",
};

type DestinataireType = "client" | "prospect";

type ItemDraft = {
  key: string;
  type_item: DevisItemType;
  chambre_id: string;
  tranche_age_id: string;
  supplement_id: string;
  description: string;
  quantite: string;
  prix_unitaire: string;
};

type FormState = {
  reservation_id: string;
  destinataire_type: DestinataireType;
  client_id: string;
  prospect_id: string;
  maison_id: string;
  chambre_id: string;
  date_arrivee: string;
  date_depart: string;
  nb_adultes: string;
  nbrs_enfants: string;
  nbrs_bebe: string;
  promotion_id: string;
  type_reduction: ReservationTypeReduction | "";
  valeur_reduction: string;
  taux_tva: string;
  statut: DevisStatut;
  date_emission: string;
  date_validite: string;
  notes: string;
  items: ItemDraft[];
};

function formatCurrency(value: number | string | null | undefined) {
  const number = Number(value) || 0;
  return `${number.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD`;
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  return new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString("fr-FR");
}

function dateInput(value?: string | null) {
  return value ? String(value).slice(0, 10) : "";
}

function findSaisonForDate(saisons: Saison[], date?: string) {
  if (!date) {
    return undefined;
  }

  const target = new Date(`${date}T00:00:00`).getTime();

  const match = saisons.find((saison) => {
    const start = new Date(`${saison.date_debut}T00:00:00`).getTime();
    const end = new Date(`${saison.date_fin}T00:00:00`).getTime();
    return target >= start && target <= end;
  });

  return match?.id;
}

function emptyItem(): ItemDraft {
  return {
    key: crypto.randomUUID(),
    type_item: "chambre",
    chambre_id: "",
    tranche_age_id: "",
    supplement_id: "",
    description: "",
    quantite: "1",
    prix_unitaire: "",
  };
}

function buildDefaultForm(): FormState {
  return {
    reservation_id: "",
    destinataire_type: "client",
    client_id: "",
    prospect_id: "",
    maison_id: "",
    chambre_id: "",
    date_arrivee: "",
    date_depart: "",
    nb_adultes: "1",
    nbrs_enfants: "0",
    nbrs_bebe: "0",
    promotion_id: "",
    type_reduction: "",
    valeur_reduction: "",
    taux_tva: "10",
    statut: "brouillon",
    date_emission: todayIsoDate(),
    date_validite: defaultValiditeDate(),
    notes: "",
    items: [emptyItem()],
  };
}

function devisToForm(devis: Devis): FormState {
  return {
    reservation_id: devis.reservation_id ? String(devis.reservation_id) : "",
    destinataire_type: devis.client_id ? "client" : "prospect",
    client_id: devis.client_id ? String(devis.client_id) : "",
    prospect_id: devis.prospect_id ? String(devis.prospect_id) : "",
    maison_id: String(devis.maison_id),
    chambre_id: devis.chambre_id ? String(devis.chambre_id) : "",
    date_arrivee: dateInput(devis.date_arrivee),
    date_depart: dateInput(devis.date_depart),
    nb_adultes: String(devis.nb_adultes ?? 1),
    nbrs_enfants: String(devis.nbrs_enfants ?? 0),
    nbrs_bebe: String(devis.nbrs_bebe ?? 0),
    promotion_id: devis.promotion_id ? String(devis.promotion_id) : "",
    type_reduction: devis.type_reduction || "",
    valeur_reduction: devis.valeur_reduction ? String(devis.valeur_reduction) : "",
    taux_tva: String(devis.taux_tva ?? 10),
    statut: devis.statut,
    date_emission: dateInput(devis.date_emission) || todayIsoDate(),
    date_validite: dateInput(devis.date_validite) || defaultValiditeDate(),
    notes: devis.notes || "",
    items:
      devis.items && devis.items.length > 0
        ? devis.items.map((item) => ({
            key: crypto.randomUUID(),
            type_item: item.type_item,
            chambre_id: item.chambre_id ? String(item.chambre_id) : "",
            tranche_age_id: item.tranche_age_id ? String(item.tranche_age_id) : "",
            supplement_id: item.supplement_id ? String(item.supplement_id) : "",
            description: item.description,
            quantite: String(item.quantite),
            prix_unitaire: String(item.prix_unitaire),
          }))
        : [emptyItem()],
  };
}

function itemLineTotal(item: ItemDraft) {
  const qty = Number(item.quantite) || 0;
  const unit = Number(item.prix_unitaire) || 0;
  return Math.round(qty * unit * 100) / 100;
}

function formToPayload(form: FormState): DevisFormData {
  const items: DevisItem[] = form.items
    .filter((item) => item.description.trim())
    .map((item, index) => {
      const prixTotal = itemLineTotal(item);

      return {
        type_item: item.type_item,
        chambre_id: item.chambre_id ? Number(item.chambre_id) : null,
        tranche_age_id: item.tranche_age_id ? Number(item.tranche_age_id) : null,
        supplement_id: item.supplement_id ? Number(item.supplement_id) : null,
        description: item.description.trim(),
        quantite: Number(item.quantite) || 1,
        prix_unitaire: Number(item.prix_unitaire) || 0,
        prix_total: prixTotal,
        ordre: index,
      };
    });

  const totals = calculateDevisTotals({
    items: items.map((item) => ({ prix_total: Number(item.prix_total) })),
    type_reduction: form.type_reduction || null,
    valeur_reduction: Number(form.valeur_reduction) || 0,
    taux_tva: Number(form.taux_tva) || 0,
  });

  return {
    client_id:
      form.destinataire_type === "client" && form.client_id ? Number(form.client_id) : null,
    prospect_id:
      form.destinataire_type === "prospect" && form.prospect_id
        ? Number(form.prospect_id)
        : null,
    maison_id: Number(form.maison_id),
    chambre_id: form.chambre_id ? Number(form.chambre_id) : null,
    date_arrivee: form.date_arrivee || undefined,
    date_depart: form.date_depart || undefined,
    nb_nuits: calculateNights(form.date_arrivee, form.date_depart),
    nb_adultes: Number(form.nb_adultes) || 1,
    nbrs_enfants: Number(form.nbrs_enfants) || 0,
    nbrs_bebe: Number(form.nbrs_bebe) || 0,
    promotion_id: form.promotion_id ? Number(form.promotion_id) : null,
    type_reduction: form.type_reduction || null,
    valeur_reduction: Number(form.valeur_reduction) || 0,
    montant_ht: totals.montant_ht,
    taux_tva: Number(form.taux_tva) || 0,
    montant_tva: totals.montant_tva,
    montant_ttc: totals.montant_ttc,
    statut: form.statut,
    date_emission: form.date_emission,
    date_validite: form.date_validite,
    reservation_id: form.reservation_id ? Number(form.reservation_id) : null,
    notes: form.notes.trim() || null,
    items,
  };
}

export function DevisManagement() {
  const [devisList, setDevisList] = useState<Devis[]>([]);
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [maisons, setMaisons] = useState<MaisonListItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [chambres, setChambres] = useState<ChambreListItem[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [supplements, setSupplements] = useState<
    Array<{ id: number; nom: string; prix: number }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statutFilter, setStatutFilter] = useState<DevisStatut | "all">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDevis, setEditingDevis] = useState<Devis | null>(null);
  const [loadingEditForm, setLoadingEditForm] = useState(false);
  const [form, setForm] = useState<FormState>(buildDefaultForm);
  const [deleteTarget, setDeleteTarget] = useState<Devis | null>(null);
  const [convertTarget, setConvertTarget] = useState<Devis | null>(null);
  const [converting, setConverting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [devisData, commandesData, maisonsData, clientsData, prospectsData, reservationsData] =
        await Promise.all([
          fetchDevis(),
          fetchCommandes(),
          fetchMaisons(),
          fetchClients(),
          fetchProspects(),
          fetchReservations(),
        ]);

      setDevisList(devisData);
      setCommandes(commandesData);
      setMaisons(maisonsData);
      setClients(clientsData);
      setProspects(prospectsData.filter((p) => p.statut !== "converti"));
      setReservations(
        reservationsData.filter((reservation) => reservation.statut_reservation !== "annulee")
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Chargement impossible.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!form.maison_id) {
      setChambres([]);
      setPromotions([]);
      setSupplements([]);
      return;
    }

    const maisonId = Number(form.maison_id);

    void Promise.all([
      fetchSaisons(maisonId).then(async (saisonsData) => {
        const saisonId = findSaisonForDate(saisonsData, form.date_arrivee);
        const chambresData = await fetchChambres(maisonId, saisonId);
        setChambres(chambresData.filter((chambre) => chambre.statut === "actif"));
      }),
      fetchPromotions(),
      fetchSupplementTarifs(maisonId),
    ])
      .then(([, promotionsData, supplementsData]) => {
        setPromotions(
          promotionsData.filter(
            (promo) => !promo.maison_id || promo.maison_id === maisonId
          )
        );
        setSupplements(
          supplementsData.supplements
            .filter((row) => row.statut === "actif")
            .map((row) => ({
              id: row.id,
              nom: row.nom,
              prix: Number(row.tarifs[0]?.prix_adulte) || 0,
            }))
        );
      })
      .catch(() => {
        setChambres([]);
        setPromotions([]);
        setSupplements([]);
      });
  }, [form.maison_id, form.date_arrivee]);

  const nbNuits = useMemo(
    () => calculateNights(form.date_arrivee, form.date_depart),
    [form.date_arrivee, form.date_depart]
  );

  const totals = useMemo(() => {
    const items = form.items
      .filter((item) => item.description.trim())
      .map((item) => ({ prix_total: itemLineTotal(item) }));

    return calculateDevisTotals({
      items,
      type_reduction: form.type_reduction || null,
      valeur_reduction: Number(form.valeur_reduction) || 0,
      taux_tva: Number(form.taux_tva) || 0,
    });
  }, [form.items, form.type_reduction, form.valeur_reduction, form.taux_tva]);

  const filteredDevis = useMemo(() => {
    const query = search.trim().toLowerCase();

    return devisList.filter((devis) => {
      if (statutFilter !== "all" && devis.statut !== statutFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [
        devis.reference,
        devis.client_nom,
        devis.prospect_nom,
        devis.maison_nom,
        devis.chambre_nom,
        devis.reservation_reference,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [devisList, search, statutFilter]);

  const commandeByDevisId = useMemo(() => {
    const map = new Map<number, Commande>();

    for (const commande of commandes) {
      if (commande.devis_id != null) {
        map.set(commande.devis_id, commande);
      }
    }

    return map;
  }, [commandes]);

  const selectedChambre = useMemo(
    () => chambres.find((chambre) => String(chambre.id) === form.chambre_id),
    [chambres, form.chambre_id]
  );

  const reservationOptions = useMemo(() => {
    let options = reservations;

    if (form.client_id) {
      const byClient = options.filter(
        (reservation) => String(reservation.client_id) === form.client_id
      );
      if (byClient.length > 0) {
        options = byClient;
      }
    }

    if (form.maison_id) {
      const byMaison = options.filter(
        (reservation) => String(reservation.maison_id) === form.maison_id
      );
      if (byMaison.length > 0) {
        options = byMaison;
      }
    }

    return options;
  }, [reservations, form.client_id, form.maison_id]);

  const selectedReservation = useMemo(
    () => reservations.find((reservation) => String(reservation.id) === form.reservation_id),
    [reservations, form.reservation_id]
  );

  const openCreateDialog = () => {
    setEditingDevis(null);
    setForm(buildDefaultForm());
    setDialogOpen(true);
  };

  const openEditDialog = async (devis: Devis) => {
    setEditingDevis(devis);
    setForm(devisToForm(devis));
    setDialogOpen(true);
    setLoadingEditForm(true);

    try {
      const detailed = await fetchDevisById(devis.id);
      setEditingDevis(detailed);
      setForm(devisToForm(detailed));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Impossible de charger le devis.");
    } finally {
      setLoadingEditForm(false);
    }
  };

  const handleReservationChange = (reservationId: string) => {
    if (!reservationId || reservationId === "none") {
      setForm((current) => ({ ...current, reservation_id: "" }));
      return;
    }

    const reservation = reservations.find((item) => String(item.id) === reservationId);

    if (!reservation) {
      return;
    }

    setForm((current) => ({
      ...current,
      reservation_id: reservationId,
      destinataire_type: "client",
      client_id: String(reservation.client_id),
      prospect_id: "",
      maison_id: String(reservation.maison_id),
      chambre_id: String(reservation.chambre_id),
      date_arrivee: dateInput(reservation.date_arrivee),
      date_depart: dateInput(reservation.date_depart),
      nb_adultes: String(reservation.nb_adultes ?? 1),
      nbrs_enfants: String(reservation.nbrs_enfants ?? 0),
      nbrs_bebe: String(reservation.nbrs_bebe ?? 0),
      promotion_id: reservation.promotion_id ? String(reservation.promotion_id) : "",
      type_reduction: reservation.type_reduction || "",
      valeur_reduction: String(reservation.valeur_reduction ?? 0),
      taux_tva: String(reservation.taux_tva_applique ?? 10),
    }));
  };

  const updateItem = (key: string, patch: Partial<ItemDraft>) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    }));
  };

  const addItem = () => {
    setForm((current) => ({
      ...current,
      items: [...current.items, emptyItem()],
    }));
  };

  const removeItem = (key: string) => {
    setForm((current) => ({
      ...current,
      items: current.items.length > 1 ? current.items.filter((item) => item.key !== key) : current.items,
    }));
  };

  const generateChambreLine = () => {
    if (!selectedChambre || nbNuits <= 0) {
      return;
    }

    const prixNuit = Number(selectedChambre.prix_adulte) || 0;
    const description = `Hébergement — ${selectedChambre.nom} (${nbNuits} nuit${nbNuits > 1 ? "s" : ""})`;

    setForm((current) => ({
      ...current,
      items: [
        ...current.items.filter((item) => item.description.trim()),
        {
          key: crypto.randomUUID(),
          type_item: "chambre",
          chambre_id: String(selectedChambre.id),
          tranche_age_id: "",
          supplement_id: "",
          description,
          quantite: String(nbNuits),
          prix_unitaire: String(prixNuit),
        },
      ],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const payload = formToPayload(form);

      if (editingDevis) {
        await updateDevis(editingDevis.id, payload);
      } else {
        await createDevis(payload);
      }

      setDialogOpen(false);
      await loadData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  const handleConvertToCommande = async () => {
    if (!convertTarget) {
      return;
    }

    setConverting(true);
    setError(null);

    try {
      const detailed = await fetchDevisById(convertTarget.id);
      const commandePayload = buildCommandePayloadFromDevis(detailed);
      await createCommande(commandePayload);
      await updateDevis(
        detailed.id,
        buildDevisFormDataFromDevis(detailed, { statut: "converti" })
      );
      setConvertTarget(null);
      await loadData();
    } catch (convertError) {
      setError(
        convertError instanceof Error ? convertError.message : "Conversion en commande impossible."
      );
    } finally {
      setConverting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await deleteDevis(deleteTarget.id);
      setDeleteTarget(null);
      await loadData();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Suppression impossible.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Devis</h1>
          <p className="mt-1 text-sm text-slate-500">
            Créez et gérez vos propositions commerciales professionnelles.
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Nouveau devis
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Rechercher par référence, client, prospect, maison..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Select
          value={statutFilter}
          onValueChange={(value) => setStatutFilter(value as DevisStatut | "all")}
        >
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {(Object.keys(STATUT_LABELS) as DevisStatut[]).map((statut) => (
              <SelectItem key={statut} value={statut}>
                {STATUT_LABELS[statut]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Référence</TableHead>
              <TableHead>Destinataire</TableHead>
              <TableHead>Séjour</TableHead>
              <TableHead>Montant TTC</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Validité</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-slate-500">
                  Chargement des devis...
                </TableCell>
              </TableRow>
            ) : filteredDevis.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-slate-500">
                  Aucun devis trouvé.
                </TableCell>
              </TableRow>
            ) : (
              filteredDevis.map((devis) => (
                <TableRow key={devis.id}>
                  <TableCell>
                    <div className="font-medium">{devis.reference}</div>
                    {commandeByDevisId.get(devis.id) ? (
                      <AssociatedDocumentHint
                        label="Commande associée"
                        reference={commandeByDevisId.get(devis.id)!.reference}
                      />
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">
                      {devis.client_nom?.trim() || devis.prospect_nom?.trim() || "—"}
                    </div>
                    <div className="text-xs text-slate-500">
                      {devis.client_email || devis.prospect_email || "—"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>{devis.maison_nom}</div>
                    <div className="text-xs text-slate-500">
                      {devis.reservation_reference
                        ? `${devis.reservation_reference} · `
                        : ""}
                      {devis.date_arrivee && devis.date_depart
                        ? `${formatDate(devis.date_arrivee)} → ${formatDate(devis.date_depart)}`
                        : "Dates non définies"}
                    </div>
                  </TableCell>
                  <TableCell>{formatCurrency(devis.montant_ttc)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUT_VARIANTS[devis.statut]}>
                      {STATUT_LABELS[devis.statut]}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(devis.date_validite)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => void openEditDialog(devis)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Modifier
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={isDevisConverted(devis, commandes) || converting}
                          onClick={() => setConvertTarget(devis)}
                        >
                          <ShoppingBag className="mr-2 h-4 w-4" />
                          {isDevisConverted(devis, commandes)
                            ? "Déjà converti en commande"
                            : "Convertir en commande"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => setDeleteTarget(devis)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {editingDevis ? `Modifier ${editingDevis.reference}` : "Nouveau devis"}
            </DialogTitle>
          </DialogHeader>

          <div className="relative grid gap-6">
            {loadingEditForm ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/80">
                <span className="text-sm text-slate-500">Chargement du devis...</span>
              </div>
            ) : null}

            <section className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Statut</Label>
                <Select
                  value={form.statut}
                  onValueChange={(value) =>
                    setForm((current) => ({ ...current, statut: value as DevisStatut }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUT_LABELS) as DevisStatut[]).map((statut) => (
                      <SelectItem key={statut} value={statut}>
                        {STATUT_LABELS[statut]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date d&apos;émission</Label>
                <Input
                  type="date"
                  value={form.date_emission}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, date_emission: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Date de validité</Label>
                <Input
                  type="date"
                  value={form.date_validite}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, date_validite: event.target.value }))
                  }
                />
              </div>
            </section>

            <section className="grid gap-4 rounded-xl border border-slate-200 p-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Réservation liée (optionnelle)</Label>
                <Select
                  value={form.reservation_id || "none"}
                  onValueChange={handleReservationChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Aucune réservation" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune</SelectItem>
                    {form.reservation_id &&
                    !reservationOptions.some((r) => String(r.id) === form.reservation_id) ? (
                      <SelectItem value={form.reservation_id}>
                        {editingDevis?.reservation_reference || `Réservation #${form.reservation_id}`}
                      </SelectItem>
                    ) : null}
                    {reservationOptions.map((reservation) => (
                      <SelectItem key={reservation.id} value={String(reservation.id)}>
                        {reservation.reference} · {reservation.client_nom} · {reservation.maison_nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.reservation_id ? (
                  <p className="text-xs text-slate-500">
                    Les informations client, maison, chambre et dates sont préremplies depuis la
                    réservation{selectedReservation ? ` ${selectedReservation.reference}` : ""}.
                  </p>
                ) : null}
              </div>

              <div className="space-y-3">
                <Label>Destinataire</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={form.destinataire_type === "client" ? "default" : "outline"}
                    size="sm"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        destinataire_type: "client",
                        prospect_id: "",
                      }))
                    }
                  >
                    Client
                  </Button>
                  <Button
                    type="button"
                    variant={form.destinataire_type === "prospect" ? "default" : "outline"}
                    size="sm"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        destinataire_type: "prospect",
                        client_id: "",
                        reservation_id: "",
                      }))
                    }
                  >
                    Prospect
                  </Button>
                </div>
                {form.destinataire_type === "client" ? (
                  <Select
                    value={form.client_id}
                    onValueChange={(value) =>
                      setForm((current) => ({ ...current, client_id: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={String(client.id)}>
                          {[client.prenom, client.nom].filter(Boolean).join(" ")}
                          {client.email ? ` · ${client.email}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Select
                    value={form.prospect_id}
                    onValueChange={(value) =>
                      setForm((current) => ({ ...current, prospect_id: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un prospect" />
                    </SelectTrigger>
                    <SelectContent>
                      {prospects.map((prospect) => (
                        <SelectItem key={prospect.id} value={String(prospect.id)}>
                          {[prospect.prenom, prospect.nom].filter(Boolean).join(" ")}
                          {prospect.email ? ` · ${prospect.email}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2">
                <Label>Maison d&apos;hôtes</Label>
                <Select
                  value={form.maison_id}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      maison_id: value,
                      chambre_id: "",
                      promotion_id: "",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une maison" />
                  </SelectTrigger>
                  <SelectContent>
                    {maisons.map((maison) => (
                      <SelectItem key={maison.id} value={String(maison.id)}>
                        {maison.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </section>

            <section className="grid gap-4 rounded-xl border border-slate-200 p-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label>Chambre</Label>
                <Select
                  value={form.chambre_id}
                  onValueChange={(value) =>
                    setForm((current) => ({ ...current, chambre_id: value }))
                  }
                  disabled={!form.maison_id}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Optionnelle" />
                  </SelectTrigger>
                  <SelectContent>
                    {form.chambre_id &&
                    !chambres.some((chambre) => String(chambre.id) === form.chambre_id) ? (
                      <SelectItem value={form.chambre_id}>
                        {editingDevis?.chambre_nom || `Chambre #${form.chambre_id}`}
                      </SelectItem>
                    ) : null}
                    {chambres.map((chambre) => (
                      <SelectItem key={chambre.id} value={String(chambre.id)}>
                        {chambre.nom}
                        {chambre.prix_adulte
                          ? ` · ${Number(chambre.prix_adulte).toLocaleString("fr-FR")} MAD/nuit`
                          : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Arrivée</Label>
                <Input
                  type="date"
                  value={form.date_arrivee}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, date_arrivee: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Départ</Label>
                <Input
                  type="date"
                  value={form.date_depart}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, date_depart: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Nuits</Label>
                <Input value={nbNuits > 0 ? String(nbNuits) : "—"} disabled />
              </div>
              <div className="space-y-2">
                <Label>Adultes</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.nb_adultes}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, nb_adultes: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Enfants</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.nbrs_enfants}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, nbrs_enfants: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Bébés</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.nbrs_bebe}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, nbrs_bebe: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Promotion</Label>
                <Select
                  value={form.promotion_id || "none"}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      promotion_id: value === "none" ? "" : value,
                    }))
                  }
                  disabled={!form.maison_id}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Aucune" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune</SelectItem>
                    {promotions.map((promo) => (
                      <SelectItem key={promo.id} value={String(promo.id)}>
                        {promo.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </section>

            <section className="space-y-4 rounded-xl border border-slate-200 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-medium text-slate-900">Lignes du devis</h3>
                  <p className="text-sm text-slate-500">
                    Détaillez chaque prestation facturée au client.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={generateChambreLine}
                    disabled={!selectedChambre || nbNuits <= 0}
                  >
                    <Wand2 className="mr-2 h-4 w-4" />
                    Ligne chambre
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={addItem}>
                    <Plus className="mr-2 h-4 w-4" />
                    Ajouter une ligne
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                {form.items.map((item, index) => (
                  <div
                    key={item.key}
                    className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3 md:grid-cols-12"
                  >
                    <div className="md:col-span-2">
                      <Label className="text-xs">Type</Label>
                      <Select
                        value={item.type_item}
                        onValueChange={(value) =>
                          updateItem(item.key, { type_item: value as DevisItemType })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(ITEM_TYPE_LABELS) as DevisItemType[]).map((type) => (
                            <SelectItem key={type} value={type}>
                              {ITEM_TYPE_LABELS[type]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-4">
                      <Label className="text-xs">Description</Label>
                      <Input
                        value={item.description}
                        placeholder={`Ligne ${index + 1}`}
                        onChange={(event) =>
                          updateItem(item.key, { description: event.target.value })
                        }
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-xs">Quantité</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.quantite}
                        onChange={(event) =>
                          updateItem(item.key, { quantite: event.target.value })
                        }
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-xs">Prix unitaire</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.prix_unitaire}
                        onChange={(event) =>
                          updateItem(item.key, { prix_unitaire: event.target.value })
                        }
                      />
                    </div>
                    <div className="flex items-end justify-between gap-2 md:col-span-2">
                      <div>
                        <Label className="text-xs">Total</Label>
                        <div className="py-2 text-sm font-medium">
                          {formatCurrency(itemLineTotal(item))}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(item.key)}
                      >
                        <Trash2 className="h-4 w-4 text-slate-500" />
                      </Button>
                    </div>
                    {item.type_item === "supplement" ? (
                      <div className="md:col-span-4">
                        <Label className="text-xs">Supplément</Label>
                        <Select
                          value={item.supplement_id || "none"}
                          onValueChange={(value) => {
                            const supplement = supplements.find(
                              (row) => String(row.id) === value
                            );
                            updateItem(item.key, {
                              supplement_id: value === "none" ? "" : value,
                              description: supplement
                                ? supplement.nom
                                : item.description,
                              prix_unitaire: supplement
                                ? String(supplement.prix)
                                : item.prix_unitaire,
                            });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choisir" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Manuel</SelectItem>
                            {supplements.map((supplement) => (
                              <SelectItem key={supplement.id} value={String(supplement.id)}>
                                {supplement.nom} · {formatCurrency(supplement.prix)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>

            <section className="grid gap-4 rounded-xl border border-slate-200 p-4 lg:grid-cols-2">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Type réduction</Label>
                  <Select
                    value={form.type_reduction || "none"}
                    onValueChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        type_reduction: value === "none" ? "" : (value as ReservationTypeReduction),
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Aucune" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucune</SelectItem>
                      <SelectItem value="%">Pourcentage (%)</SelectItem>
                      <SelectItem value="MAD">Montant (MAD)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Valeur réduction</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.valeur_reduction}
                    disabled={!form.type_reduction}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, valeur_reduction: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>TVA (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.taux_tva}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, taux_tva: event.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="rounded-lg bg-slate-900 p-4 text-white">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-300">Sous-total lignes</span>
                    <span>{formatCurrency(totals.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">Réduction</span>
                    <span>- {formatCurrency(totals.montant_reduction)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">Montant HT</span>
                    <span>{formatCurrency(totals.montant_ht)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">TVA ({form.taux_tva || 0}%)</span>
                    <span>{formatCurrency(totals.montant_tva)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-700 pt-2 text-base font-semibold">
                    <span>Total TTC</span>
                    <span>{formatCurrency(totals.montant_ttc)}</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-2">
              <Label>Notes internes</Label>
              <Textarea
                rows={3}
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({ ...current, notes: event.target.value }))
                }
                placeholder="Conditions particulières, remarques commerciales..."
              />
            </section>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving || loadingEditForm}>
              {saving ? "Enregistrement..." : editingDevis ? "Mettre à jour" : "Créer le devis"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce devis ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le devis {deleteTarget?.reference} sera définitivement supprimé avec toutes ses lignes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => void handleDelete()}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(convertTarget)} onOpenChange={() => setConvertTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Convertir en commande ?</AlertDialogTitle>
            <AlertDialogDescription>
              Une commande sera créée à partir du devis {convertTarget?.reference}. Le devis sera
              marqué comme converti.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={converting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={converting}
              onClick={() => void handleConvertToCommande()}
            >
              {converting ? "Conversion..." : "Convertir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
