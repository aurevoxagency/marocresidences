import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardList, FileText, MoreVertical, Pencil, Plus, Search, Trash2 } from "lucide-react";

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
import {
  calculateCommandeTotals,
  createCommande,
  datetimeInput,
  deleteCommande,
  fetchCommandeById,
  fetchCommandes,
  buildCommandeFormDataFromCommande,
  isCommandeInvoiced,
  nowDatetimeLocal,
  updateCommande,
  type Commande,
  type CommandeFormData,
  type CommandeItem,
  type CommandeStatut,
  type CommandeStatutPaiement,
} from "@/lib/commandes";
import { fetchDevis, fetchDevisById, type Devis } from "@/lib/devis";
import {
  buildFacturePayloadFromCommande,
  createFacture,
  fetchFactures,
  type Facture,
} from "@/lib/factures";
import { fetchSupplementTarifs } from "@/lib/hebergement";
import { fetchReservation, fetchReservations, type Reservation } from "@/lib/reservations";
import {
  buildDocumentLinesFromReservation,
  buildNotesFromReservation,
} from "@/lib/reservation-document-items";

const STATUT_LABELS: Record<CommandeStatut, string> = {
  en_attente: "En attente",
  validee: "Validée",
  livree: "Livrée",
  annulee: "Annulée",
};

const STATUT_VARIANTS: Record<
  CommandeStatut,
  "default" | "secondary" | "destructive" | "outline"
> = {
  en_attente: "secondary",
  validee: "default",
  livree: "default",
  annulee: "destructive",
};

const PAIEMENT_LABELS: Record<CommandeStatutPaiement, string> = {
  non_paye: "Non payé",
  paye: "Payé",
  ajoute_facture: "Ajouté à la facture",
};

type ItemDraft = {
  key: string;
  supplement_id: string;
  description: string;
  quantite: string;
  prix_unitaire: string;
};

type FormState = {
  devis_id: string;
  reservation_id: string;
  client_id: string;
  maison_id: string;
  date_commande: string;
  taux_tva: string;
  statut: CommandeStatut;
  statut_paiement: CommandeStatutPaiement;
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

  return new Date(String(value).replace(" ", "T")).toLocaleString("fr-FR");
}

function dateInput(value?: string | null) {
  return value ? String(value).slice(0, 10) : "";
}

function emptyItem(): ItemDraft {
  return {
    key: crypto.randomUUID(),
    supplement_id: "",
    description: "",
    quantite: "1",
    prix_unitaire: "",
  };
}

function buildItemsFromReservation(reservation: Reservation): ItemDraft[] {
  const lines = buildDocumentLinesFromReservation(reservation);

  if (lines.length === 0) {
    return [emptyItem()];
  }

  return lines.map((line) => ({
    key: crypto.randomUUID(),
    supplement_id: line.supplement_id ? String(line.supplement_id) : "",
    description: line.description,
    quantite: String(line.quantite),
    prix_unitaire: String(line.prix_unitaire),
  }));
}

function buildDefaultForm(): FormState {
  return {
    devis_id: "",
    reservation_id: "",
    client_id: "",
    maison_id: "",
    date_commande: nowDatetimeLocal(),
    taux_tva: "10",
    statut: "en_attente",
    statut_paiement: "non_paye",
    notes: "",
    items: [emptyItem()],
  };
}

function commandeToForm(commande: Commande): FormState {
  return {
    devis_id: commande.devis_id ? String(commande.devis_id) : "",
    reservation_id: String(commande.reservation_id),
    client_id: String(commande.client_id),
    maison_id: String(commande.maison_id),
    date_commande: datetimeInput(commande.date_commande) || nowDatetimeLocal(),
    taux_tva: String(commande.taux_tva ?? 10),
    statut: commande.statut,
    statut_paiement: commande.statut_paiement,
    notes: commande.notes || "",
    items:
      commande.items && commande.items.length > 0
        ? commande.items.map((item) => ({
            key: crypto.randomUUID(),
            supplement_id: item.supplement_id ? String(item.supplement_id) : "",
            description: item.description,
            quantite: String(item.quantite),
            prix_unitaire: String(item.prix_unitaire),
          }))
        : [emptyItem()],
  };
}

function importDevisToForm(devis: Devis): FormState {
  const items =
    devis.items && devis.items.length > 0
      ? devis.items.map((item) => ({
          key: crypto.randomUUID(),
          supplement_id: item.supplement_id ? String(item.supplement_id) : "",
          description: item.description,
          quantite: String(item.quantite),
          prix_unitaire: String(item.prix_unitaire),
        }))
      : [emptyItem()];

  return {
    devis_id: String(devis.id),
    reservation_id: devis.reservation_id ? String(devis.reservation_id) : "",
    client_id: devis.client_id ? String(devis.client_id) : "",
    maison_id: String(devis.maison_id),
    date_commande: nowDatetimeLocal(),
    taux_tva: String(devis.taux_tva ?? 10),
    statut: "en_attente",
    statut_paiement: "non_paye",
    notes: devis.notes
      ? `Commande issue du devis ${devis.reference}\n${devis.notes}`
      : `Commande issue du devis ${devis.reference}`,
    items,
  };
}

function itemLineTotal(item: ItemDraft) {
  const qty = Number(item.quantite) || 0;
  const unit = Number(item.prix_unitaire) || 0;
  return Math.round(qty * unit * 100) / 100;
}

function formToPayload(form: FormState): CommandeFormData {
  const items: CommandeItem[] = form.items
    .filter((item) => item.description.trim())
    .map((item) => ({
      supplement_id: item.supplement_id ? Number(item.supplement_id) : null,
      description: item.description.trim(),
      quantite: Number(item.quantite) || 1,
      prix_unitaire: Number(item.prix_unitaire) || 0,
      prix_total: itemLineTotal(item),
    }));

  const totals = calculateCommandeTotals({
    items: items.map((item) => ({ prix_total: Number(item.prix_total) })),
    taux_tva: Number(form.taux_tva) || 0,
  });

  return {
    reservation_id: Number(form.reservation_id),
    devis_id: form.devis_id ? Number(form.devis_id) : null,
    client_id: Number(form.client_id),
    maison_id: Number(form.maison_id),
    date_commande: form.date_commande.replace("T", " "),
    montant_ht: totals.montant_ht,
    taux_tva: Number(form.taux_tva) || 0,
    montant_tva: totals.montant_tva,
    montant_ttc: totals.montant_ttc,
    statut: form.statut,
    statut_paiement: form.statut_paiement,
    notes: form.notes.trim() || null,
    items,
  };
}

export function CommandesManagement() {
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [factures, setFactures] = useState<Facture[]>([]);
  const [devisList, setDevisList] = useState<Devis[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [supplements, setSupplements] = useState<
    Array<{ id: number; nom: string; prix: number }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingEditForm, setLoadingEditForm] = useState(false);
  const [importingDevis, setImportingDevis] = useState(false);
  const [importingReservation, setImportingReservation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statutFilter, setStatutFilter] = useState<CommandeStatut | "all">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCommande, setEditingCommande] = useState<Commande | null>(null);
  const [form, setForm] = useState<FormState>(buildDefaultForm);
  const [deleteTarget, setDeleteTarget] = useState<Commande | null>(null);
  const [convertTarget, setConvertTarget] = useState<Commande | null>(null);
  const [converting, setConverting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [commandesData, facturesData, reservationsData, devisData] = await Promise.all([
        fetchCommandes(),
        fetchFactures(),
        fetchReservations(),
        fetchDevis(),
      ]);

      setCommandes(commandesData);
      setFactures(facturesData);
      setDevisList(devisData);
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
      setSupplements([]);
      return;
    }

    void fetchSupplementTarifs(Number(form.maison_id))
      .then((data) => {
        setSupplements(
          data.supplements
            .filter((row) => row.statut === "actif")
            .map((row) => ({
              id: row.id,
              nom: row.nom,
              prix: Number(row.tarifs[0]?.prix_adulte) || 0,
            }))
        );
      })
      .catch(() => setSupplements([]));
  }, [form.maison_id]);

  const selectedReservation = useMemo(
    () => reservations.find((reservation) => String(reservation.id) === form.reservation_id),
    [reservations, form.reservation_id]
  );

  const usedDevisIds = useMemo(
    () => new Set(commandes.filter((commande) => commande.devis_id).map((commande) => commande.devis_id)),
    [commandes]
  );

  const importableDevis = useMemo(
    () =>
      devisList.filter(
        (devis) =>
          devis.client_id &&
          ["accepte", "envoye"].includes(devis.statut) &&
          !usedDevisIds.has(devis.id)
      ),
    [devisList, usedDevisIds]
  );

  const reservationOptions = useMemo(() => {
    if (!form.client_id || !form.maison_id) {
      return reservations;
    }

    const filtered = reservations.filter(
      (reservation) =>
        String(reservation.client_id) === form.client_id &&
        String(reservation.maison_id) === form.maison_id
    );

    return filtered.length > 0 ? filtered : reservations;
  }, [reservations, form.client_id, form.maison_id]);

  const selectedDevis = useMemo(
    () => devisList.find((devis) => String(devis.id) === form.devis_id),
    [devisList, form.devis_id]
  );

  const totals = useMemo(() => {
    const items = form.items
      .filter((item) => item.description.trim())
      .map((item) => ({ prix_total: itemLineTotal(item) }));

    return calculateCommandeTotals({
      items,
      taux_tva: Number(form.taux_tva) || 0,
    });
  }, [form.items, form.taux_tva]);

  const filteredCommandes = useMemo(() => {
    const query = search.trim().toLowerCase();

    return commandes.filter((commande) => {
      if (statutFilter !== "all" && commande.statut !== statutFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [
        commande.reference,
        commande.client_nom,
        commande.maison_nom,
        commande.reservation_reference,
        commande.devis_reference,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [commandes, search, statutFilter]);

  const factureByCommandeId = useMemo(() => {
    const map = new Map<number, Facture>();

    for (const facture of factures) {
      if (facture.commande_id != null) {
        map.set(facture.commande_id, facture);
      }
    }

    return map;
  }, [factures]);

  const openCreateDialog = () => {
    setEditingCommande(null);
    setForm(buildDefaultForm());
    setDialogOpen(true);
  };

  const openEditDialog = async (commande: Commande) => {
    setEditingCommande(commande);
    setForm(commandeToForm(commande));
    setDialogOpen(true);
    setLoadingEditForm(true);

    try {
      const detailed = await fetchCommandeById(commande.id);
      setEditingCommande(detailed);
      setForm(commandeToForm(detailed));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Impossible de charger la commande.");
    } finally {
      setLoadingEditForm(false);
    }
  };

  const handleDevisImport = async (devisId: string) => {
    if (!devisId || devisId === "none") {
      setForm(buildDefaultForm());
      return;
    }

    setImportingDevis(true);
    setError(null);

    try {
      const devis = await fetchDevisById(Number(devisId));

      if (!devis.client_id) {
        setError("Ce devis est lié à un prospect. Convertissez-le en client d'abord.");
        return;
      }

      setForm(importDevisToForm(devis));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Import du devis impossible.");
    } finally {
      setImportingDevis(false);
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
        devis_id: "",
        reservation_id: String(reservation.id),
        client_id: String(reservation.client_id),
        maison_id: String(reservation.maison_id),
        taux_tva: String(
          reservation.taux_tva_applique ?? (current.taux_tva || 10)
        ),
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
      items: [...current.items, emptyItem()],
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

      if (editingCommande) {
        await updateCommande(editingCommande.id, payload);
      } else {
        await createCommande(payload);
      }

      setDialogOpen(false);
      await loadData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  const handleConvertToFacture = async () => {
    if (!convertTarget) {
      return;
    }

    setConverting(true);
    setError(null);

    try {
      const detailed = await fetchCommandeById(convertTarget.id);
      const facturePayload = buildFacturePayloadFromCommande(detailed);
      await createFacture(facturePayload);
      await updateCommande(
        detailed.id,
        buildCommandeFormDataFromCommande(detailed, { statut_paiement: "ajoute_facture" })
      );
      setConvertTarget(null);
      await loadData();
    } catch (convertError) {
      setError(
        convertError instanceof Error ? convertError.message : "Conversion en facture impossible."
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
      await deleteCommande(deleteTarget.id);
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
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Commandes</h1>
          <p className="mt-1 text-sm text-slate-500">
            Gérez les commandes de suppléments liées aux réservations.
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Nouvelle commande
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
            placeholder="Rechercher par référence, client, réservation..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Select
          value={statutFilter}
          onValueChange={(value) => setStatutFilter(value as CommandeStatut | "all")}
        >
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {(Object.keys(STATUT_LABELS) as CommandeStatut[]).map((statut) => (
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
              <TableHead>Devis</TableHead>
              <TableHead>Réservation</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Montant TTC</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Paiement</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-slate-500">
                  Chargement des commandes...
                </TableCell>
              </TableRow>
            ) : filteredCommandes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-slate-500">
                  Aucune commande trouvée.
                </TableCell>
              </TableRow>
            ) : (
              filteredCommandes.map((commande) => (
                <TableRow key={commande.id}>
                  <TableCell>
                    <div className="font-medium">{commande.reference}</div>
                    {factureByCommandeId.get(commande.id) ? (
                      <AssociatedDocumentHint
                        label="Facture associée"
                        reference={factureByCommandeId.get(commande.id)!.numero_facture}
                      />
                    ) : null}
                  </TableCell>
                  <TableCell>{commande.devis_reference || "—"}</TableCell>
                  <TableCell>
                    <div>{commande.reservation_reference}</div>
                    <div className="text-xs text-slate-500">
                      {dateInput(commande.reservation_date_arrivee)} →{" "}
                      {dateInput(commande.reservation_date_depart)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{commande.client_nom?.trim() || "—"}</div>
                    <div className="text-xs text-slate-500">{commande.maison_nom}</div>
                  </TableCell>
                  <TableCell>{formatCurrency(commande.montant_ttc)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUT_VARIANTS[commande.statut]}>
                      {STATUT_LABELS[commande.statut]}
                    </Badge>
                  </TableCell>
                  <TableCell>{PAIEMENT_LABELS[commande.statut_paiement]}</TableCell>
                  <TableCell>{formatDate(commande.date_commande)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => void openEditDialog(commande)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Modifier
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={isCommandeInvoiced(commande, factures) || converting}
                          onClick={() => setConvertTarget(commande)}
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          {isCommandeInvoiced(commande, factures)
                            ? "Déjà converti en facture"
                            : "Convertir en facture"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => setDeleteTarget(commande)}
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
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              {editingCommande ? `Modifier ${editingCommande.reference}` : "Nouvelle commande"}
            </DialogTitle>
          </DialogHeader>

          <div className="relative grid gap-6">
            {loadingEditForm ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/80">
                <span className="text-sm text-slate-500">Chargement de la commande...</span>
              </div>
            ) : null}

            {!editingCommande ? (
              <section className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-700" />
                  <h3 className="font-medium text-slate-900">Créer à partir d&apos;un devis</h3>
                </div>
                <div className="space-y-2">
                  <Label>Devis source</Label>
                  <Select
                    value={form.devis_id || "none"}
                    onValueChange={(value) => void handleDevisImport(value)}
                    disabled={importingDevis}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un devis accepté ou envoyé" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun — saisie manuelle</SelectItem>
                      {importableDevis.map((devis) => (
                        <SelectItem key={devis.id} value={String(devis.id)}>
                          {devis.reference} · {devis.client_nom?.trim() || "Client"} ·{" "}
                          {formatCurrency(devis.montant_ttc)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {importingDevis ? (
                    <p className="text-sm text-slate-500">Import des données du devis...</p>
                  ) : null}
                  {form.devis_id && !form.reservation_id ? (
                    <p className="text-sm text-amber-700">
                      Ce devis n&apos;a pas de réservation liée. Sélectionnez une réservation du même
                      client et de la même maison.
                    </p>
                  ) : null}
                </div>
              </section>
            ) : editingCommande?.devis_reference ? (
              <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <div className="text-sm text-slate-600">
                  Liée au devis{" "}
                  <span className="font-medium text-slate-900">{editingCommande.devis_reference}</span>
                </div>
              </section>
            ) : null}

            <section className="grid gap-4 rounded-xl border border-slate-200 p-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Réservation</Label>
                <Select
                  value={form.reservation_id}
                  onValueChange={(value) => void handleReservationChange(value)}
                  disabled={importingReservation}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        importingReservation
                          ? "Import de la réservation…"
                          : "Sélectionner une réservation"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {form.reservation_id &&
                    !reservationOptions.some((r) => String(r.id) === form.reservation_id) ? (
                      <SelectItem value={form.reservation_id}>
                        {editingCommande?.reservation_reference || selectedDevis?.reservation_id
                          ? `Réservation liée au devis`
                          : `Réservation #${form.reservation_id}`}
                      </SelectItem>
                    ) : null}
                    {reservationOptions.map((reservation) => (
                      <SelectItem key={reservation.id} value={String(reservation.id)}>
                        {reservation.reference} · {reservation.client_nom} · {reservation.maison_nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {importingReservation ? (
                  <p className="text-xs text-slate-500">
                    Import des informations, chambre, prix et lignes en cours…
                  </p>
                ) : form.reservation_id && !form.devis_id ? (
                  <p className="text-xs text-slate-500">
                    Client, maison, TVA et lignes de commande sont importés depuis la réservation
                    {selectedReservation ? ` ${selectedReservation.reference}` : ""}.
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label>Client</Label>
                <Input
                  value={
                    selectedReservation?.client_nom ||
                    selectedDevis?.client_nom?.trim() ||
                    editingCommande?.client_nom ||
                    "—"
                  }
                  disabled
                />
              </div>

              <div className="space-y-2">
                <Label>Maison d&apos;hôtes</Label>
                <Input
                  value={
                    selectedReservation?.maison_nom ||
                    selectedDevis?.maison_nom ||
                    editingCommande?.maison_nom ||
                    "—"
                  }
                  disabled
                />
              </div>

              <div className="space-y-2">
                <Label>Date de commande</Label>
                <Input
                  type="datetime-local"
                  value={form.date_commande}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, date_commande: event.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Statut</Label>
                <Select
                  value={form.statut}
                  onValueChange={(value) =>
                    setForm((current) => ({ ...current, statut: value as CommandeStatut }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUT_LABELS) as CommandeStatut[]).map((statut) => (
                      <SelectItem key={statut} value={statut}>
                        {STATUT_LABELS[statut]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Statut paiement</Label>
                <Select
                  value={form.statut_paiement}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      statut_paiement: value as CommandeStatutPaiement,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PAIEMENT_LABELS) as CommandeStatutPaiement[]).map((statut) => (
                      <SelectItem key={statut} value={statut}>
                        {PAIEMENT_LABELS[statut]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
            </section>

            <section className="space-y-4 rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-slate-900">Lignes de commande</h3>
                  <p className="text-sm text-slate-500">Suppléments et prestations commandés.</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="mr-2 h-4 w-4" />
                  Ajouter une ligne
                </Button>
              </div>

              <div className="space-y-3">
                {form.items.map((item, index) => (
                  <div
                    key={item.key}
                    className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3 md:grid-cols-12"
                  >
                    <div className="md:col-span-3">
                      <Label className="text-xs">Supplément</Label>
                      <Select
                        value={item.supplement_id || "none"}
                        onValueChange={(value) => {
                          const supplement = supplements.find((row) => String(row.id) === value);
                          updateItem(item.key, {
                            supplement_id: value === "none" ? "" : value,
                            description: supplement ? supplement.nom : item.description,
                            prix_unitaire: supplement ? String(supplement.prix) : item.prix_unitaire,
                          });
                        }}
                        disabled={!form.maison_id}
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
                    <div className="flex items-end justify-between gap-2 md:col-span-1">
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
                  </div>
                ))}
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
                  placeholder="Instructions, remarques..."
                />
              </div>

              <div className="rounded-lg bg-slate-900 p-4 text-white">
                <div className="space-y-2 text-sm">
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
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving || loadingEditForm || importingDevis || importingReservation}>
              {saving ? "Enregistrement..." : editingCommande ? "Mettre à jour" : "Créer la commande"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette commande ?</AlertDialogTitle>
            <AlertDialogDescription>
              La commande {deleteTarget?.reference} sera définitivement supprimée avec toutes ses lignes.
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
            <AlertDialogTitle>Convertir en facture ?</AlertDialogTitle>
            <AlertDialogDescription>
              Une facture sera créée à partir de la commande {convertTarget?.reference}. La commande
              sera marquée comme ajoutée à une facture.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={converting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={converting}
              onClick={() => void handleConvertToFacture()}
            >
              {converting ? "Conversion..." : "Convertir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
