import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ClipboardList,
  MoreVertical,
  Pencil,
  Plus,
  Search,
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
import { fetchCurrentUser, getAuthToken } from "@/lib/auth";
import { fetchClients, type Client } from "@/lib/clients";
import {
  createJournalTransaction,
  deleteJournalTransaction,
  fetchJournalTransactions,
  updateJournalTransaction,
  type JournalModePaiement,
  type JournalSens,
  type JournalTransaction,
  type JournalTransactionFormData,
  type JournalTypeMouvement,
} from "@/lib/journal-transactions";
import { fetchMaisons, type MaisonListItem } from "@/lib/maisons";
import { fetchReservations, type Reservation } from "@/lib/reservations";

const TYPE_LABELS: Record<JournalTypeMouvement, string> = {
  paiement: "Paiement",
  acompte: "Acompte",
  remboursement: "Remboursement",
  depot_garantie: "Dépôt de garantie",
  retenue_depot: "Retenue dépôt",
  autre: "Autre",
};

const SENS_LABELS: Record<JournalSens, string> = {
  entree: "Entrée",
  sortie: "Sortie",
};

const MODE_LABELS: Record<JournalModePaiement, string> = {
  especes: "Espèces",
  carte: "Carte",
  virement: "Virement",
  cheque: "Chèque",
  autre: "Autre",
};

type FormState = {
  type_mouvement: JournalTypeMouvement;
  sens: JournalSens;
  montant: string;
  mode_paiement: string;
  libelle: string;
  reservation_id: string;
  client_id: string;
  maison_id: string;
  effectue_par: string;
  notes: string;
  date_transaction: string;
};

function nowDateTimeLocal() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function toDateTimeLocal(value?: string | null) {
  if (!value) {
    return "";
  }

  return String(value).replace(" ", "T").slice(0, 16);
}

function formatDateDisplay(value?: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(String(value).includes("T") ? value : String(value).replace(" ", "T"));

  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 16);
  }

  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMoney(value?: number | string | null) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  return `${number.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} MAD`;
}

function emptyForm(staffName = ""): FormState {
  return {
    type_mouvement: "paiement",
    sens: "entree",
    montant: "0",
    mode_paiement: "especes",
    libelle: "",
    reservation_id: "",
    client_id: "",
    maison_id: "",
    effectue_par: staffName,
    notes: "",
    date_transaction: nowDateTimeLocal(),
  };
}

function recordToForm(record: JournalTransaction): FormState {
  return {
    type_mouvement: record.type_mouvement,
    sens: record.sens,
    montant: String(record.montant ?? 0),
    mode_paiement: record.mode_paiement || "",
    libelle: record.libelle || "",
    reservation_id: record.reservation_id ? String(record.reservation_id) : "",
    client_id: record.client_id ? String(record.client_id) : "",
    maison_id: record.maison_id ? String(record.maison_id) : "",
    effectue_par: record.effectue_par || "",
    notes: record.notes || "",
    date_transaction: toDateTimeLocal(record.date_transaction),
  };
}

function formToPayload(form: FormState): JournalTransactionFormData {
  return {
    type_mouvement: form.type_mouvement,
    sens: form.sens,
    montant: Number(form.montant) || 0,
    mode_paiement: (form.mode_paiement || null) as JournalModePaiement | null,
    libelle: form.libelle.trim(),
    reservation_id: form.reservation_id ? Number(form.reservation_id) : null,
    client_id: form.client_id ? Number(form.client_id) : null,
    maison_id: form.maison_id ? Number(form.maison_id) : null,
    effectue_par: form.effectue_par.trim() || null,
    notes: form.notes.trim() || null,
    date_transaction: form.date_transaction,
  };
}

export function JournalTransactionsManagement() {
  const [logs, setLogs] = useState<JournalTransaction[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [maisons, setMaisons] = useState<MaisonListItem[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<JournalTypeMouvement | "all">("all");
  const [sensFilter, setSensFilter] = useState<JournalSens | "all">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<JournalTransaction | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<JournalTransaction | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [staffName, setStaffName] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [logsData, clientsData, maisonsData, reservationsData] = await Promise.all([
        fetchJournalTransactions(),
        fetchClients(),
        fetchMaisons(),
        fetchReservations(),
      ]);
      setLogs(logsData);
      setClients(clientsData);
      setMaisons(maisonsData);
      setReservations(reservationsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger le journal.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    let cancelled = false;
    const token = getAuthToken();

    if (!token) {
      return;
    }

    void fetchCurrentUser(token)
      .then((user) => {
        if (cancelled || !user) {
          return;
        }

        const name = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
        if (name) {
          setStaffName(name);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase();

    return logs.filter((log) => {
      if (typeFilter !== "all" && log.type_mouvement !== typeFilter) {
        return false;
      }

      if (sensFilter !== "all" && log.sens !== sensFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [
        log.reference,
        log.libelle,
        log.client_nom,
        log.maison_nom,
        log.reservation_reference,
        log.facture_numero,
        log.commande_reference,
        log.effectue_par,
        TYPE_LABELS[log.type_mouvement],
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [logs, search, typeFilter, sensFilter]);

  const totals = useMemo(() => {
    return filteredLogs.reduce(
      (acc, log) => {
        const amount = Number(log.montant) || 0;

        if (log.sens === "entree") {
          acc.entrees += amount;
        } else {
          acc.sorties += amount;
        }

        return acc;
      },
      { entrees: 0, sorties: 0 }
    );
  }, [filteredLogs]);

  const openCreateDialog = () => {
    setEditing(null);
    setForm(emptyForm(staffName));
    setFormError("");
    setDialogOpen(true);
  };

  const openEditDialog = (log: JournalTransaction) => {
    setEditing(log);
    setForm(recordToForm(log));
    setFormError("");
    setDialogOpen(true);
  };

  const handleReservationChange = (reservationId: string) => {
    const reservation = reservations.find((item) => String(item.id) === reservationId);

    setForm((current) => ({
      ...current,
      reservation_id: reservationId,
      client_id: reservation ? String(reservation.client_id) : current.client_id,
      maison_id: reservation ? String(reservation.maison_id) : current.maison_id,
      libelle:
        current.libelle.trim() ||
        (reservation
          ? `${TYPE_LABELS[current.type_mouvement]} · ${reservation.reference}`
          : current.libelle),
    }));
  };

  const handleSave = async () => {
    if (!form.libelle.trim()) {
      setFormError("Le libellé est requis.");
      return;
    }

    if (!form.date_transaction) {
      setFormError("La date de transaction est requise.");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const payload = formToPayload(form);

      if (editing) {
        await updateJournalTransaction(editing.id, payload);
      } else {
        await createJournalTransaction(payload);
      }

      setDialogOpen(false);
      await loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    setDeleting(true);

    try {
      await deleteJournalTransaction(deleteTarget.id);
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Suppression impossible.");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Journal des transactions
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Historique des mouvements financiers (paiements, acomptes, dépôts, remboursements).
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Nouveau mouvement
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            Entrées
          </p>
          <p className="mt-1 text-lg font-semibold text-emerald-700">
            {formatMoney(totals.entrees)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            Sorties
          </p>
          <p className="mt-1 text-lg font-semibold text-rose-700">
            {formatMoney(totals.sorties)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            Solde filtré
          </p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {formatMoney(totals.entrees - totals.sorties)}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Rechercher par référence, libellé, client..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Select
          value={typeFilter}
          onValueChange={(value) => setTypeFilter(value as JournalTypeMouvement | "all")}
        >
          <SelectTrigger className="w-full lg:w-[200px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {(Object.keys(TYPE_LABELS) as JournalTypeMouvement[]).map((type) => (
              <SelectItem key={type} value={type}>
                {TYPE_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={sensFilter}
          onValueChange={(value) => setSensFilter(value as JournalSens | "all")}
        >
          <SelectTrigger className="w-full lg:w-[160px]">
            <SelectValue placeholder="Sens" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Entrées & sorties</SelectItem>
            <SelectItem value="entree">Entrées</SelectItem>
            <SelectItem value="sortie">Sorties</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Référence</TableHead>
              <TableHead>Libellé</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Client / Maison</TableHead>
              <TableHead>Montant</TableHead>
              <TableHead>Par</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-slate-500">
                  Chargement du journal...
                </TableCell>
              </TableRow>
            ) : filteredLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-slate-500">
                  Aucun mouvement enregistré.
                </TableCell>
              </TableRow>
            ) : (
              filteredLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap text-[13px]">
                    {formatDateDisplay(log.date_transaction)}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{log.reference}</div>
                    {log.reservation_reference ? (
                      <div className="text-xs text-slate-500">{log.reservation_reference}</div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[240px] truncate font-medium">{log.libelle}</div>
                    {log.mode_paiement ? (
                      <div className="text-xs text-slate-500">
                        {MODE_LABELS[log.mode_paiement]}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{TYPE_LABELS[log.type_mouvement]}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{log.client_nom || "—"}</div>
                    <div className="text-xs text-slate-500">{log.maison_nom || "—"}</div>
                  </TableCell>
                  <TableCell>
                    <div
                      className={[
                        "flex items-center gap-1.5 font-semibold",
                        log.sens === "entree" ? "text-emerald-700" : "text-rose-700",
                      ].join(" ")}
                    >
                      {log.sens === "entree" ? (
                        <ArrowDownLeft className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      )}
                      {log.sens === "sortie" ? "− " : "+ "}
                      {formatMoney(log.montant)}
                    </div>
                    <div className="text-xs text-slate-500">{SENS_LABELS[log.sens]}</div>
                  </TableCell>
                  <TableCell className="text-[13px] text-slate-600">
                    {log.effectue_par || "—"}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(log)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Modifier
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => setDeleteTarget(log)}
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
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              {editing ? `Modifier ${editing.reference}` : "Nouveau mouvement"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Date / heure *</Label>
              <Input
                type="datetime-local"
                value={form.date_transaction}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    date_transaction: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Effectué par</Label>
              <Input
                value={form.effectue_par}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    effectue_par: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Libellé *</Label>
              <Input
                value={form.libelle}
                onChange={(event) =>
                  setForm((current) => ({ ...current, libelle: event.target.value }))
                }
                placeholder="Ex. Acompte réservation RES-..."
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={form.type_mouvement}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    type_mouvement: value as JournalTypeMouvement,
                    sens:
                      value === "remboursement" || value === "retenue_depot"
                        ? "sortie"
                        : current.sens,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TYPE_LABELS) as JournalTypeMouvement[]).map((type) => (
                    <SelectItem key={type} value={type}>
                      {TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sens</Label>
              <Select
                value={form.sens}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, sens: value as JournalSens }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entree">Entrée</SelectItem>
                  <SelectItem value="sortie">Sortie</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Montant (MAD) *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.montant}
                onChange={(event) =>
                  setForm((current) => ({ ...current, montant: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Mode de paiement</Label>
              <Select
                value={form.mode_paiement || "none"}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    mode_paiement: value === "none" ? "" : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Non renseigné</SelectItem>
                  {(Object.keys(MODE_LABELS) as JournalModePaiement[]).map((mode) => (
                    <SelectItem key={mode} value={mode}>
                      {MODE_LABELS[mode]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Réservation liée</Label>
              <Select
                value={form.reservation_id || "none"}
                onValueChange={(value) => {
                  if (value === "none") {
                    setForm((current) => ({ ...current, reservation_id: "" }));
                    return;
                  }

                  handleReservationChange(value);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Aucune" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune</SelectItem>
                  {reservations.map((reservation) => (
                    <SelectItem key={reservation.id} value={String(reservation.id)}>
                      {reservation.reference} · {reservation.client_nom?.trim() || "Client"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Client</Label>
              <Select
                value={form.client_id || "none"}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    client_id: value === "none" ? "" : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Aucun" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={String(client.id)}>
                      {[client.prenom, client.nom].filter(Boolean).join(" ") || client.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Maison</Label>
              <Select
                value={form.maison_id || "none"}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    maison_id: value === "none" ? "" : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Aucune" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune</SelectItem>
                  {maisons.map((maison) => (
                    <SelectItem key={maison.id} value={String(maison.id)}>
                      {maison.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Notes</Label>
              <Textarea
                rows={3}
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({ ...current, notes: event.target.value }))
                }
              />
            </div>
          </div>

          {formError ? <p className="mt-3 text-sm text-destructive">{formError}</p> : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce mouvement ?</AlertDialogTitle>
            <AlertDialogDescription>
              La transaction {deleteTarget?.reference} sera définitivement retirée du journal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={deleting}
              onClick={() => void handleDelete()}
            >
              {deleting ? "Suppression…" : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
