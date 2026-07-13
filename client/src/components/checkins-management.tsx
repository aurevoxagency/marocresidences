import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DoorOpen,
  LogIn,
  LogOut,
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
import {
  createCheckin,
  deleteCheckin,
  fetchCheckins,
  getCheckinFlowStatus,
  updateCheckin,
  type CheckinCheckout,
  type CheckinCheckoutFormData,
  type CheckinFlowStatus,
  type DepotGarantieStatut,
  type EtatChambreCheckin,
  type EtatChambreCheckout,
} from "@/lib/checkins";
import { fetchReservations, type Reservation } from "@/lib/reservations";

const FLOW_LABELS: Record<CheckinFlowStatus, string> = {
  attente_checkin: "En attente check-in",
  en_sejour: "En séjour",
  termine: "Check-out effectué",
};

const FLOW_VARIANTS: Record<
  CheckinFlowStatus,
  "secondary" | "default" | "outline"
> = {
  attente_checkin: "secondary",
  en_sejour: "default",
  termine: "outline",
};

const ETAT_CHECKIN_LABELS: Record<EtatChambreCheckin, string> = {
  bon: "Bon état",
  a_signaler: "À signaler",
};

const ETAT_CHECKOUT_LABELS: Record<EtatChambreCheckout, string> = {
  bon: "Bon état",
  a_signaler: "À signaler",
  degats: "Dégâts",
};

const DEPOT_LABELS: Record<DepotGarantieStatut, string> = {
  non_pris: "Non pris",
  pris: "Pris",
  rendu: "Rendu",
  retenu: "Retenu",
};

type FormState = {
  reservation_id: string;
  date_checkin_reel: string;
  date_checkout_reel: string;
  checkin_par: string;
  checkout_par: string;
  etat_chambre_checkin: string;
  etat_chambre_checkout: string;
  depot_garantie_montant: string;
  depot_garantie_statut: DepotGarantieStatut;
  notes_checkin: string;
  notes_checkout: string;
};

type FormMode = "create" | "edit" | "checkout";

function toDateTimeLocal(value?: string | null) {
  if (!value) {
    return "";
  }

  const raw = String(value).trim();
  if (!raw) {
    return "";
  }

  return raw.replace(" ", "T").slice(0, 16);
}

function nowDateTimeLocal() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
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
    reservation_id: "",
    date_checkin_reel: nowDateTimeLocal(),
    date_checkout_reel: "",
    checkin_par: staffName,
    checkout_par: "",
    etat_chambre_checkin: "bon",
    etat_chambre_checkout: "",
    depot_garantie_montant: "0",
    depot_garantie_statut: "non_pris",
    notes_checkin: "",
    notes_checkout: "",
  };
}

function recordToForm(record: CheckinCheckout, mode: FormMode, staffName = ""): FormState {
  return {
    reservation_id: String(record.reservation_id),
    date_checkin_reel: toDateTimeLocal(record.date_checkin_reel),
    date_checkout_reel:
      mode === "checkout" && !record.date_checkout_reel
        ? nowDateTimeLocal()
        : toDateTimeLocal(record.date_checkout_reel),
    checkin_par: record.checkin_par || "",
    checkout_par:
      mode === "checkout" && !record.checkout_par
        ? staffName
        : record.checkout_par || "",
    etat_chambre_checkin: record.etat_chambre_checkin || "",
    etat_chambre_checkout:
      mode === "checkout" && !record.etat_chambre_checkout
        ? "bon"
        : record.etat_chambre_checkout || "",
    depot_garantie_montant: String(record.depot_garantie_montant ?? 0),
    depot_garantie_statut: record.depot_garantie_statut || "non_pris",
    notes_checkin: record.notes_checkin || "",
    notes_checkout: record.notes_checkout || "",
  };
}

function formToPayload(form: FormState): CheckinCheckoutFormData {
  return {
    reservation_id: Number(form.reservation_id),
    date_checkin_reel: form.date_checkin_reel || null,
    date_checkout_reel: form.date_checkout_reel || null,
    checkin_par: form.checkin_par.trim() || null,
    checkout_par: form.checkout_par.trim() || null,
    etat_chambre_checkin: (form.etat_chambre_checkin || null) as EtatChambreCheckin | null,
    etat_chambre_checkout: (form.etat_chambre_checkout ||
      null) as EtatChambreCheckout | null,
    depot_garantie_montant: Number(form.depot_garantie_montant) || 0,
    depot_garantie_statut: form.depot_garantie_statut,
    notes_checkin: form.notes_checkin.trim() || null,
    notes_checkout: form.notes_checkout.trim() || null,
  };
}

export function CheckinsManagement() {
  const [records, setRecords] = useState<CheckinCheckout[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CheckinFlowStatus | "all">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<CheckinCheckout | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CheckinCheckout | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [staffName, setStaffName] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [checkinsData, reservationsData] = await Promise.all([
        fetchCheckins(),
        fetchReservations(),
      ]);
      setRecords(checkinsData);
      setReservations(
        reservationsData.filter(
          (item) => item.statut_reservation === "confirmee" || item.statut_reservation === "terminee"
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les données.");
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
      .catch(() => {
        // ignore — staff name is optional
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const usedReservationIds = useMemo(
    () => new Set(records.map((item) => item.reservation_id)),
    [records]
  );

  const availableReservations = useMemo(() => {
    return reservations.filter((reservation) => {
      if (editing && reservation.id === editing.reservation_id) {
        return true;
      }

      return (
        reservation.statut_reservation === "confirmee" &&
        !usedReservationIds.has(reservation.id)
      );
    });
  }, [reservations, usedReservationIds, editing]);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();

    return records.filter((record) => {
      const status = getCheckinFlowStatus(record);

      if (statusFilter !== "all" && status !== statusFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [
        record.reservation_reference,
        record.client_nom,
        record.maison_nom,
        record.chambre_nom,
        record.checkin_par,
        record.checkout_par,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [records, search, statusFilter]);

  const openCreateDialog = () => {
    setFormMode("create");
    setEditing(null);
    setForm(emptyForm(staffName));
    setFormError("");
    setDialogOpen(true);
  };

  const openEditDialog = (record: CheckinCheckout, mode: FormMode = "edit") => {
    setFormMode(mode);
    setEditing(record);
    setForm(recordToForm(record, mode, staffName));
    setFormError("");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.reservation_id) {
      setFormError("Sélectionnez une réservation.");
      return;
    }

    if (formMode === "create" && !form.date_checkin_reel) {
      setFormError("La date de check-in est requise.");
      return;
    }

    if (formMode === "checkout" && !form.date_checkout_reel) {
      setFormError("La date de check-out est requise.");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const payload = formToPayload(form);

      if (editing) {
        await updateCheckin(editing.id, payload);
      } else {
        await createCheckin(payload);
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
      await deleteCheckin(deleteTarget.id);
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Suppression impossible.");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const dialogTitle =
    formMode === "create"
      ? "Nouveau check-in"
      : formMode === "checkout"
        ? `Check-out · ${editing?.reservation_reference || ""}`
        : `Modifier · ${editing?.reservation_reference || ""}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Check-in / Check-out
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Enregistrez l&apos;accueil, l&apos;état des chambres et le dépôt de garantie.
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Nouveau check-in
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
            placeholder="Rechercher par réservation, client, chambre..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as CheckinFlowStatus | "all")}
        >
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {(Object.keys(FLOW_LABELS) as CheckinFlowStatus[]).map((status) => (
              <SelectItem key={status} value={status}>
                {FLOW_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Réservation</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Chambre</TableHead>
              <TableHead>Check-in</TableHead>
              <TableHead>Check-out</TableHead>
              <TableHead>Dépôt</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-slate-500">
                  Chargement...
                </TableCell>
              </TableRow>
            ) : filteredRecords.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-slate-500">
                  Aucun check-in / check-out trouvé.
                </TableCell>
              </TableRow>
            ) : (
              filteredRecords.map((record) => {
                const status = getCheckinFlowStatus(record);

                return (
                  <TableRow key={record.id}>
                    <TableCell>
                      <div className="font-medium">{record.reservation_reference}</div>
                      <div className="text-xs text-slate-500">{record.maison_nom}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{record.client_nom || "—"}</div>
                      <div className="text-xs text-slate-500">{record.client_telephone || "—"}</div>
                    </TableCell>
                    <TableCell>{record.chambre_nom || "—"}</TableCell>
                    <TableCell>
                      <div>{formatDateDisplay(record.date_checkin_reel)}</div>
                      <div className="text-xs text-slate-500">{record.checkin_par || "—"}</div>
                    </TableCell>
                    <TableCell>
                      <div>{formatDateDisplay(record.date_checkout_reel)}</div>
                      <div className="text-xs text-slate-500">{record.checkout_par || "—"}</div>
                    </TableCell>
                    <TableCell>
                      <div>{formatMoney(record.depot_garantie_montant)}</div>
                      <div className="text-xs text-slate-500">
                        {DEPOT_LABELS[record.depot_garantie_statut]}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={FLOW_VARIANTS[status]}>{FLOW_LABELS[status]}</Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(record, "edit")}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Modifier
                          </DropdownMenuItem>
                          {status === "en_sejour" ? (
                            <DropdownMenuItem
                              onClick={() => openEditDialog(record, "checkout")}
                            >
                              <LogOut className="mr-2 h-4 w-4" />
                              Faire le check-out
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => setDeleteTarget(record)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DoorOpen className="h-5 w-5" />
              {dialogTitle}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-800">Réservation</h3>
              <div className="space-y-2">
                <Label>Réservation *</Label>
                <Select
                  value={form.reservation_id || undefined}
                  onValueChange={(value) =>
                    setForm((current) => ({ ...current, reservation_id: value }))
                  }
                  disabled={formMode !== "create"}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une réservation confirmée" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableReservations.map((reservation) => (
                      <SelectItem key={reservation.id} value={String(reservation.id)}>
                        {reservation.reference} · {reservation.client_nom?.trim() || "Client"} ·{" "}
                        {reservation.chambre_nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <LogIn className="h-4 w-4" />
                Check-in
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Date / heure check-in</Label>
                  <Input
                    type="datetime-local"
                    value={form.date_checkin_reel}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        date_checkin_reel: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Check-in par</Label>
                  <Input
                    value={form.checkin_par}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        checkin_par: event.target.value,
                      }))
                    }
                    placeholder="Nom de l'employé"
                  />
                </div>
                <div className="space-y-2">
                  <Label>État chambre (check-in)</Label>
                  <Select
                    value={form.etat_chambre_checkin || "none"}
                    onValueChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        etat_chambre_checkin: value === "none" ? "" : value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Non renseigné</SelectItem>
                      {(Object.keys(ETAT_CHECKIN_LABELS) as EtatChambreCheckin[]).map(
                        (etat) => (
                          <SelectItem key={etat} value={etat}>
                            {ETAT_CHECKIN_LABELS[etat]}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Notes check-in</Label>
                  <Textarea
                    rows={3}
                    value={form.notes_checkin}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        notes_checkin: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-800">Dépôt de garantie</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Montant (MAD)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.depot_garantie_montant}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        depot_garantie_montant: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Statut dépôt</Label>
                  <Select
                    value={form.depot_garantie_statut}
                    onValueChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        depot_garantie_statut: value as DepotGarantieStatut,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(DEPOT_LABELS) as DepotGarantieStatut[]).map((statut) => (
                        <SelectItem key={statut} value={statut}>
                          {DEPOT_LABELS[statut]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            {formMode !== "create" || form.date_checkout_reel ? (
              <section className="space-y-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <LogOut className="h-4 w-4" />
                  Check-out
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Date / heure check-out</Label>
                    <Input
                      type="datetime-local"
                      value={form.date_checkout_reel}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          date_checkout_reel: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Check-out par</Label>
                    <Input
                      value={form.checkout_par}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          checkout_par: event.target.value,
                        }))
                      }
                      placeholder="Nom de l'employé"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>État chambre (check-out)</Label>
                    <Select
                      value={form.etat_chambre_checkout || "none"}
                      onValueChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          etat_chambre_checkout: value === "none" ? "" : value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Non renseigné</SelectItem>
                        {(Object.keys(ETAT_CHECKOUT_LABELS) as EtatChambreCheckout[]).map(
                          (etat) => (
                            <SelectItem key={etat} value={etat}>
                              {ETAT_CHECKOUT_LABELS[etat]}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Notes check-out</Label>
                    <Textarea
                      rows={3}
                      value={form.notes_checkout}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          notes_checkout: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              </section>
            ) : null}

            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          </div>

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
            <AlertDialogTitle>Supprimer ce check-in / check-out ?</AlertDialogTitle>
            <AlertDialogDescription>
              La fiche liée à {deleteTarget?.reservation_reference} sera définitivement
              supprimée.
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
