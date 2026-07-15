import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FileSpreadsheet,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
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
import { fetchCommandeById, fetchCommandes, type Commande } from "@/lib/commandes";
import {
  calculateFactureLineTotals,
  calculateFactureTotals,
  createFacture,
  defaultEcheanceDate,
  deleteFacture,
  fetchFactureById,
  fetchFactures,
  todayIsoDate,
  updateFacture,
  type Facture,
  type FactureFormData,
  type FactureItem,
  type FactureModePaiement,
  type FactureStatut,
} from "@/lib/factures";
import { fetchMaisons, type MaisonListItem } from "@/lib/maisons";
import { fetchReservation, fetchReservations, type Reservation } from "@/lib/reservations";
import {
  buildDocumentLinesFromReservation,
  buildNotesFromReservation,
} from "@/lib/reservation-document-items";

const STATUT_LABELS: Record<FactureStatut, string> = {
  brouillon: "Brouillon",
  emise: "Émise",
  payee_partiellement: "Payée partiellement",
  payee: "Payée",
  annulee: "Annulée",
  en_retard: "En retard",
};

const STATUT_VARIANTS: Record<
  FactureStatut,
  "default" | "secondary" | "destructive" | "outline"
> = {
  brouillon: "secondary",
  emise: "default",
  payee_partiellement: "outline",
  payee: "default",
  annulee: "destructive",
  en_retard: "destructive",
};

const MODE_PAIEMENT_LABELS: Record<FactureModePaiement, string> = {
  especes: "Espèces",
  carte: "Carte",
  virement: "Virement",
  cheque: "Chèque",
  autre: "Autre",
};

type ItemDraft = {
  key: string;
  description: string;
  quantite: string;
  prix_unitaire: string;
  taux_tva: string;
};

type FormState = {
  commande_id: string;
  reservation_id: string;
  client_id: string;
  maison_id: string;
  date_facture: string;
  date_echeance: string;
  montant_paye: string;
  statut: FactureStatut;
  mode_paiement: FactureModePaiement | "";
  notes: string;
  items: ItemDraft[];
};

function formatCurrency(value: number | string | null | undefined) {
  const number = Number(value) || 0;
  return `${number.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD`;
}

function dateInput(value?: string | null) {
  return value ? String(value).slice(0, 10) : "";
}

function emptyItem(tauxTva = "10"): ItemDraft {
  return {
    key: crypto.randomUUID(),
    description: "",
    quantite: "1",
    prix_unitaire: "",
    taux_tva: tauxTva,
  };
}

function buildItemsFromReservation(reservation: Reservation): ItemDraft[] {
  const tauxTva = String(reservation.taux_tva_applique ?? 10);
  const lines = buildDocumentLinesFromReservation(reservation);

  if (lines.length === 0) {
    return [emptyItem(tauxTva)];
  }

  return lines.map((line) => ({
    key: crypto.randomUUID(),
    description: line.description,
    quantite: String(line.quantite),
    prix_unitaire: String(line.prix_unitaire),
    taux_tva: tauxTva,
  }));
}

function buildDefaultForm(): FormState {
  return {
    commande_id: "",
    reservation_id: "",
    client_id: "",
    maison_id: "",
    date_facture: todayIsoDate(),
    date_echeance: defaultEcheanceDate(),
    montant_paye: "0",
    statut: "brouillon",
    mode_paiement: "",
    notes: "",
    items: [emptyItem()],
  };
}

function itemLineTotals(item: ItemDraft) {
  return calculateFactureLineTotals({
    quantite: Number(item.quantite) || 0,
    prix_unitaire: Number(item.prix_unitaire) || 0,
    taux_tva: Number(item.taux_tva) || 0,
  });
}

function factureToForm(facture: Facture): FormState {
  return {
    commande_id: facture.commande_id ? String(facture.commande_id) : "",
    reservation_id: facture.reservation_id ? String(facture.reservation_id) : "",
    client_id: String(facture.client_id),
    maison_id: String(facture.maison_id),
    date_facture: dateInput(facture.date_facture) || todayIsoDate(),
    date_echeance: dateInput(facture.date_echeance) || defaultEcheanceDate(),
    montant_paye: String(facture.montant_paye ?? 0),
    statut: facture.statut,
    mode_paiement: facture.mode_paiement || "",
    notes: facture.notes || "",
    items:
      facture.items && facture.items.length > 0
        ? facture.items.map((item) => ({
            key: crypto.randomUUID(),
            description: item.description,
            quantite: String(item.quantite),
            prix_unitaire: String(item.prix_unitaire),
            taux_tva: String(item.taux_tva ?? 10),
          }))
        : [emptyItem()],
  };
}

function importCommandeToForm(commande: Commande): FormState {
  const tauxTva = String(commande.taux_tva ?? 10);
  const items =
    commande.items && commande.items.length > 0
      ? commande.items.map((item) => ({
          key: crypto.randomUUID(),
          description: item.description,
          quantite: String(item.quantite),
          prix_unitaire: String(item.prix_unitaire),
          taux_tva: tauxTva,
        }))
      : [emptyItem(tauxTva)];

  return {
    commande_id: String(commande.id),
    reservation_id: String(commande.reservation_id),
    client_id: String(commande.client_id),
    maison_id: String(commande.maison_id),
    date_facture: todayIsoDate(),
    date_echeance: defaultEcheanceDate(),
    montant_paye: "0",
    statut: "brouillon",
    mode_paiement: "",
    notes: commande.notes
      ? `Facture issue de la commande ${commande.reference}\n${commande.notes}`
      : `Facture issue de la commande ${commande.reference}`,
    items,
  };
}

function formToPayload(form: FormState): FactureFormData {
  const items: FactureItem[] = form.items
    .filter((item) => item.description.trim())
    .map((item, index) => {
      const lineTotals = itemLineTotals(item);

      return {
        description: item.description.trim(),
        quantite: Number(item.quantite) || 1,
        prix_unitaire: Number(item.prix_unitaire) || 0,
        taux_tva: Number(item.taux_tva) || 0,
        prix_total_ht: lineTotals.prix_total_ht,
        prix_total_ttc: lineTotals.prix_total_ttc,
        ordre: index,
      };
    });

  const totals = calculateFactureTotals({
    items: items.map((item) => ({
      prix_total_ht: Number(item.prix_total_ht),
      prix_total_ttc: Number(item.prix_total_ttc),
    })),
    montant_paye: Number(form.montant_paye) || 0,
  });

  return {
    commande_id: form.commande_id ? Number(form.commande_id) : null,
    reservation_id: form.reservation_id ? Number(form.reservation_id) : null,
    client_id: Number(form.client_id),
    maison_id: Number(form.maison_id),
    date_facture: form.date_facture,
    date_echeance: form.date_echeance,
    montant_ht: totals.montant_ht,
    taux_tva: totals.taux_tva,
    montant_tva: totals.montant_tva,
    montant_ttc: totals.montant_ttc,
    montant_paye: Number(form.montant_paye) || 0,
    montant_restant: totals.montant_restant,
    statut: form.statut,
    mode_paiement: form.mode_paiement || null,
    notes: form.notes.trim() || null,
    items,
  };
}

export function FacturesManagement() {
  const [factures, setFactures] = useState<Facture[]>([]);
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [maisons, setMaisons] = useState<MaisonListItem[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingEditForm, setLoadingEditForm] = useState(false);
  const [importingCommande, setImportingCommande] = useState(false);
  const [importingReservation, setImportingReservation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statutFilter, setStatutFilter] = useState<FactureStatut | "all">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFacture, setEditingFacture] = useState<Facture | null>(null);
  const [form, setForm] = useState<FormState>(buildDefaultForm);
  const [deleteTarget, setDeleteTarget] = useState<Facture | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [facturesData, commandesData, reservationsData, clientsData, maisonsData] =
        await Promise.all([
          fetchFactures(),
          fetchCommandes(),
          fetchReservations(),
          fetchClients(),
          fetchMaisons(),
        ]);

      setFactures(facturesData);
      setCommandes(commandesData);
      setClients(clientsData);
      setMaisons(maisonsData);
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

  const usedCommandeIds = useMemo(
    () =>
      new Set(factures.filter((facture) => facture.commande_id).map((facture) => facture.commande_id)),
    [factures]
  );

  const importableCommandes = useMemo(
    () =>
      commandes.filter(
        (commande) =>
          ["validee", "livree"].includes(commande.statut) &&
          !usedCommandeIds.has(commande.id)
      ),
    [commandes, usedCommandeIds]
  );

  const selectedCommande = useMemo(
    () => commandes.find((commande) => String(commande.id) === form.commande_id),
    [commandes, form.commande_id]
  );

  const selectedReservation = useMemo(
    () => reservations.find((reservation) => String(reservation.id) === form.reservation_id),
    [reservations, form.reservation_id]
  );

  const totals = useMemo(() => {
    const items = form.items
      .filter((item) => item.description.trim())
      .map((item) => itemLineTotals(item));

    return calculateFactureTotals({
      items,
      montant_paye: Number(form.montant_paye) || 0,
    });
  }, [form.items, form.montant_paye]);

  const filteredFactures = useMemo(() => {
    const query = search.trim().toLowerCase();

    return factures.filter((facture) => {
      if (statutFilter !== "all" && facture.statut !== statutFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [
        facture.numero_facture,
        facture.client_nom,
        facture.maison_nom,
        facture.commande_reference,
        facture.reservation_reference,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [factures, search, statutFilter]);

  const openCreateDialog = () => {
    setEditingFacture(null);
    setForm(buildDefaultForm());
    setDialogOpen(true);
  };

  const openEditDialog = async (facture: Facture) => {
    setEditingFacture(facture);
    setForm(factureToForm(facture));
    setDialogOpen(true);
    setLoadingEditForm(true);

    try {
      const detailed = await fetchFactureById(facture.id);
      setEditingFacture(detailed);
      setForm(factureToForm(detailed));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Impossible de charger la facture.");
    } finally {
      setLoadingEditForm(false);
    }
  };

  const handleCommandeImport = async (commandeId: string) => {
    if (!commandeId || commandeId === "none") {
      setForm(buildDefaultForm());
      return;
    }

    setImportingCommande(true);
    setError(null);

    try {
      const commande = await fetchCommandeById(Number(commandeId));
      setForm(importCommandeToForm(commande));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Import de la commande impossible.");
    } finally {
      setImportingCommande(false);
    }
  };

  const handleReservationChange = async (reservationId: string) => {
    if (!reservationId) {
      setForm((current) => ({ ...current, reservation_id: "" }));
      return;
    }

    setImportingReservation(true);
    setError(null);

    try {
      const reservation = await fetchReservation(Number(reservationId));

      setReservations((current) => {
        const exists = current.some((item) => item.id === reservation.id);
        if (exists) {
          return current.map((item) => (item.id === reservation.id ? reservation : item));
        }
        return [...current, reservation];
      });

      setForm((current) => ({
        ...current,
        commande_id: "",
        reservation_id: String(reservation.id),
        client_id: String(reservation.client_id),
        maison_id: String(reservation.maison_id),
        notes: buildNotesFromReservation(reservation, current.notes),
        items: buildItemsFromReservation(reservation),
      }));
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "Impossible d'importer la réservation."
      );
    } finally {
      setImportingReservation(false);
    }
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
      items: [...current.items, emptyItem(current.items[0]?.taux_tva || "10")],
    }));
  };

  const removeItem = (key: string) => {
    setForm((current) => ({
      ...current,
      items: current.items.length > 1 ? current.items.filter((item) => item.key !== key) : current.items,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const payload = formToPayload(form);

      if (editingFacture) {
        await updateFacture(editingFacture.id, payload);
      } else {
        await createFacture(payload);
      }

      setDialogOpen(false);
      await loadData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await deleteFacture(deleteTarget.id);
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
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Factures</h1>
          <p className="mt-1 text-sm text-slate-500">
            Émettez et suivez les factures clients liées aux commandes et réservations.
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Nouvelle facture
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
            placeholder="Rechercher par numéro, client, commande..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Select
          value={statutFilter}
          onValueChange={(value) => setStatutFilter(value as FactureStatut | "all")}
        >
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {(Object.keys(STATUT_LABELS) as FactureStatut[]).map((statut) => (
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
              <TableHead>N° facture</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Commande</TableHead>
              <TableHead>Total TTC</TableHead>
              <TableHead>Restant</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Échéance</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-slate-500">
                  Chargement des factures...
                </TableCell>
              </TableRow>
            ) : filteredFactures.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-slate-500">
                  Aucune facture trouvée.
                </TableCell>
              </TableRow>
            ) : (
              filteredFactures.map((facture) => (
                <TableRow key={facture.id}>
                  <TableCell>
                    <div className="font-medium">{facture.numero_facture}</div>
                    {facture.commande_reference ? (
                      <AssociatedDocumentHint
                        label="Commande associée"
                        reference={facture.commande_reference}
                      />
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{facture.client_nom?.trim() || "—"}</div>
                    <div className="text-xs text-slate-500">{facture.maison_nom}</div>
                  </TableCell>
                  <TableCell>{facture.commande_reference || "—"}</TableCell>
                  <TableCell>{formatCurrency(facture.montant_ttc)}</TableCell>
                  <TableCell>{formatCurrency(facture.montant_restant)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUT_VARIANTS[facture.statut]}>
                      {STATUT_LABELS[facture.statut]}
                    </Badge>
                  </TableCell>
                  <TableCell>{dateInput(facture.date_echeance) || "—"}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => void openEditDialog(facture)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Modifier
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => setDeleteTarget(facture)}
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
              <FileSpreadsheet className="h-5 w-5" />
              {editingFacture
                ? `Modifier ${editingFacture.numero_facture}`
                : "Nouvelle facture"}
            </DialogTitle>
          </DialogHeader>

          <div className="relative grid gap-6">
            {loadingEditForm ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/80">
                <span className="text-sm text-slate-500">Chargement de la facture...</span>
              </div>
            ) : null}

            {!editingFacture ? (
              <section className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-emerald-700" />
                  <h3 className="font-medium text-slate-900">Créer à partir d&apos;une commande</h3>
                </div>
                <div className="space-y-2">
                  <Label>Commande source</Label>
                  <Select
                    value={form.commande_id || "none"}
                    onValueChange={(value) => void handleCommandeImport(value)}
                    disabled={importingCommande}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une commande validée" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucune — saisie manuelle</SelectItem>
                      {importableCommandes.map((commande) => (
                        <SelectItem key={commande.id} value={String(commande.id)}>
                          {commande.reference} · {commande.client_nom?.trim()} ·{" "}
                          {formatCurrency(commande.montant_ttc)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {importingCommande ? (
                    <p className="text-sm text-slate-500">Import des données de la commande...</p>
                  ) : null}
                </div>
              </section>
            ) : editingFacture.commande_reference ? (
              <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-600">
                Liée à la commande{" "}
                <span className="font-medium text-slate-900">{editingFacture.commande_reference}</span>
              </section>
            ) : null}

            <section className="grid gap-4 rounded-xl border border-slate-200 p-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2 md:col-span-2">
                <Label>Réservation (optionnelle)</Label>
                <Select
                  value={form.reservation_id || "none"}
                  onValueChange={(value) =>
                    void handleReservationChange(value === "none" ? "" : value)
                  }
                  disabled={importingReservation}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        importingReservation ? "Import de la réservation…" : "Aucune"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune</SelectItem>
                    {reservations.map((reservation) => (
                      <SelectItem key={reservation.id} value={String(reservation.id)}>
                        {reservation.reference} · {reservation.client_nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {importingReservation ? (
                  <p className="text-xs text-slate-500">
                    Import des informations, chambre, prix et lignes en cours…
                  </p>
                ) : form.reservation_id && !form.commande_id ? (
                  <p className="text-xs text-slate-500">
                    Client, maison et lignes de facture sont importés depuis la réservation
                    {selectedReservation ? ` ${selectedReservation.reference}` : ""}.
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label>Client</Label>
                {form.commande_id || form.reservation_id ? (
                  <Input
                    value={
                      selectedReservation?.client_nom ||
                      selectedCommande?.client_nom?.trim() ||
                      editingFacture?.client_nom ||
                      "—"
                    }
                    disabled
                  />
                ) : (
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
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2">
                <Label>Maison</Label>
                {form.commande_id || form.reservation_id ? (
                  <Input
                    value={
                      selectedReservation?.maison_nom ||
                      selectedCommande?.maison_nom ||
                      editingFacture?.maison_nom ||
                      "—"
                    }
                    disabled
                  />
                ) : (
                  <Select
                    value={form.maison_id}
                    onValueChange={(value) =>
                      setForm((current) => ({ ...current, maison_id: value }))
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
                )}
              </div>

              <div className="space-y-2">
                <Label>Date facture</Label>
                <Input
                  type="date"
                  value={form.date_facture}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, date_facture: event.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Date échéance</Label>
                <Input
                  type="date"
                  value={form.date_echeance}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, date_echeance: event.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Statut</Label>
                <Select
                  value={form.statut}
                  onValueChange={(value) =>
                    setForm((current) => ({ ...current, statut: value as FactureStatut }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUT_LABELS) as FactureStatut[]).map((statut) => (
                      <SelectItem key={statut} value={statut}>
                        {STATUT_LABELS[statut]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Mode de paiement</Label>
                <Select
                  value={form.mode_paiement || "none"}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      mode_paiement: value === "none" ? "" : (value as FactureModePaiement),
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Non défini" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Non défini</SelectItem>
                    {(Object.keys(MODE_PAIEMENT_LABELS) as FactureModePaiement[]).map((mode) => (
                      <SelectItem key={mode} value={mode}>
                        {MODE_PAIEMENT_LABELS[mode]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Montant payé</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.montant_paye}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, montant_paye: event.target.value }))
                  }
                />
              </div>
            </section>

            <section className="space-y-4 rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-slate-900">Lignes de facture</h3>
                  <p className="text-sm text-slate-500">TVA par ligne, totaux calculés automatiquement.</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="mr-2 h-4 w-4" />
                  Ajouter une ligne
                </Button>
              </div>

              <div className="space-y-3">
                {form.items.map((item, index) => {
                  const line = itemLineTotals(item);

                  return (
                    <div
                      key={item.key}
                      className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3 md:grid-cols-12"
                    >
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
                        <Label className="text-xs">Prix unitaire HT</Label>
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
                      <div className="md:col-span-2">
                        <Label className="text-xs">TVA (%)</Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={item.taux_tva}
                          onChange={(event) =>
                            updateItem(item.key, { taux_tva: event.target.value })
                          }
                        />
                      </div>
                      <div className="flex items-end justify-between gap-2 md:col-span-2">
                        <div>
                          <Label className="text-xs">Total TTC</Label>
                          <div className="py-2 text-sm font-medium">
                            {formatCurrency(line.prix_total_ttc)}
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
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  rows={4}
                  value={form.notes}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, notes: event.target.value }))
                  }
                  placeholder="Conditions de paiement, mentions légales..."
                />
              </div>

              <div className="rounded-lg bg-slate-900 p-4 text-white">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-300">Total HT</span>
                    <span>{formatCurrency(totals.montant_ht)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">TVA</span>
                    <span>{formatCurrency(totals.montant_tva)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">Total TTC</span>
                    <span>{formatCurrency(totals.montant_ttc)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">Montant payé</span>
                    <span>{formatCurrency(form.montant_paye)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-700 pt-2 text-base font-semibold">
                    <span>Restant dû</span>
                    <span>{formatCurrency(totals.montant_restant)}</span>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => void handleSave()}
              disabled={saving || loadingEditForm || importingCommande || importingReservation}
            >
              {saving ? "Enregistrement..." : editingFacture ? "Mettre à jour" : "Créer la facture"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette facture ?</AlertDialogTitle>
            <AlertDialogDescription>
              La facture {deleteTarget?.numero_facture} sera définitivement supprimée avec toutes ses
              lignes.
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
    </div>
  );
}
