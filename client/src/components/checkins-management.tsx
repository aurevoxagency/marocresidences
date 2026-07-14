import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DoorOpen,
  LogIn,
  LogOut,
  MoreVertical,
  Pencil,
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

type DayRow = {
  reservation: Reservation;
  checkin: CheckinCheckout | null;
};

function todayIsoLocal() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function toDateOnly(value?: string | Date | null) {
  if (!value) {
    return "";
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return "";
    }

    const pad = (n: number) => String(n).padStart(2, "0");
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }

  const raw = String(value).trim();

  if (!raw) {
    return "";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return raw.slice(0, 10);
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatDayLabel(isoDate: string) {
  const date = new Date(`${isoDate}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }

  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatShortDate(value?: string | null) {
  const iso = toDateOnly(value);

  if (!iso) {
    return "—";
  }

  const date = new Date(`${iso}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

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

function emptyForm(staffName = "", reservationId = ""): FormState {
  return {
    reservation_id: reservationId,
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
      mode === "checkout" && !record.checkout_par ? staffName : record.checkout_par || "",
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

function matchesSearch(row: DayRow, query: string) {
  if (!query) {
    return true;
  }

  const haystack = [
    row.reservation.reference,
    row.reservation.client_nom,
    row.reservation.maison_nom,
    row.reservation.chambre_nom,
    row.checkin?.checkin_par,
    row.checkin?.checkout_par,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

export function CheckinsManagement() {
  const [records, setRecords] = useState<CheckinCheckout[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<CheckinCheckout | null>(null);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CheckinCheckout | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [staffName, setStaffName] = useState("");

  const today = useMemo(() => todayIsoLocal(), []);

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
          (item) =>
            item.statut_reservation !== "annulee" &&
            item.statut_reservation !== "no_show"
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

  const checkinByReservationId = useMemo(() => {
    const map = new Map<number, CheckinCheckout>();

    for (const record of records) {
      map.set(record.reservation_id, record);
    }

    return map;
  }, [records]);

  const arriveesDuJour = useMemo(() => {
    const query = search.trim().toLowerCase();

    return reservations
      .filter((reservation) => toDateOnly(reservation.date_arrivee) === today)
      .map((reservation) => ({
        reservation,
        checkin: checkinByReservationId.get(reservation.id) || null,
      }))
      .filter((row) => matchesSearch(row, query))
      .sort((a, b) => a.reservation.reference.localeCompare(b.reservation.reference));
  }, [reservations, checkinByReservationId, today, search]);

  const departsDuJour = useMemo(() => {
    const query = search.trim().toLowerCase();

    return reservations
      .filter((reservation) => toDateOnly(reservation.date_depart) === today)
      .map((reservation) => ({
        reservation,
        checkin: checkinByReservationId.get(reservation.id) || null,
      }))
      .filter((row) => matchesSearch(row, query))
      .sort((a, b) => a.reservation.reference.localeCompare(b.reservation.reference));
  }, [reservations, checkinByReservationId, today, search]);

  const openCheckinDialog = (reservation: Reservation) => {
    const existing = checkinByReservationId.get(reservation.id) || null;

    setSelectedReservation(reservation);
    setFormError("");

    if (existing) {
      setFormMode("edit");
      setEditing(existing);
      setForm(recordToForm(existing, "edit", staffName));
    } else {
      setFormMode("create");
      setEditing(null);
      setForm(emptyForm(staffName, String(reservation.id)));
    }

    setDialogOpen(true);
  };

  const openCheckoutDialog = (reservation: Reservation, record: CheckinCheckout) => {
    setSelectedReservation(reservation);
    setFormMode("checkout");
    setEditing(record);
    setForm(recordToForm(record, "checkout", staffName));
    setFormError("");
    setDialogOpen(true);
  };

  const openEditDialog = (reservation: Reservation, record: CheckinCheckout) => {
    setSelectedReservation(reservation);
    setFormMode("edit");
    setEditing(record);
    setForm(recordToForm(record, "edit", staffName));
    setFormError("");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.reservation_id) {
      setFormError("Réservation introuvable.");
      return;
    }

    if ((formMode === "create" || formMode === "edit") && !form.date_checkin_reel) {
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
      ? `Check-in · ${selectedReservation?.reference || ""}`
      : formMode === "checkout"
        ? `Check-out · ${selectedReservation?.reference || editing?.reservation_reference || ""}`
        : `Modifier · ${selectedReservation?.reference || editing?.reservation_reference || ""}`;

  const renderArriveeActions = (row: DayRow) => {
    const status = row.checkin
      ? getCheckinFlowStatus(row.checkin)
      : ("attente_checkin" as const);

    if (!row.checkin) {
      return (
        <Button size="sm" onClick={() => openCheckinDialog(row.reservation)}>
          <LogIn className="mr-1.5 h-3.5 w-3.5" />
          Faire le check-in
        </Button>
      );
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => openEditDialog(row.reservation, row.checkin!)}>
            <Pencil className="mr-2 h-4 w-4" />
            Modifier
          </DropdownMenuItem>
          {status === "en_sejour" ? (
            <DropdownMenuItem
              onClick={() => openCheckoutDialog(row.reservation, row.checkin!)}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Faire le check-out
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-red-600"
            onClick={() => setDeleteTarget(row.checkin)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Supprimer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const renderDepartActions = (row: DayRow) => {
    const status = row.checkin
      ? getCheckinFlowStatus(row.checkin)
      : ("attente_checkin" as const);

    if (!row.checkin || status === "attente_checkin") {
      return (
        <Button size="sm" variant="outline" onClick={() => openCheckinDialog(row.reservation)}>
          <LogIn className="mr-1.5 h-3.5 w-3.5" />
          Check-in d’abord
        </Button>
      );
    }

    if (status === "en_sejour") {
      return (
        <Button size="sm" onClick={() => openCheckoutDialog(row.reservation, row.checkin!)}>
          <LogOut className="mr-1.5 h-3.5 w-3.5" />
          Faire le check-out
        </Button>
      );
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => openEditDialog(row.reservation, row.checkin!)}>
            <Pencil className="mr-2 h-4 w-4" />
            Modifier
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-red-600"
            onClick={() => setDeleteTarget(row.checkin)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Supprimer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const renderDayTable = (
    rows: DayRow[],
    kind: "arrivee" | "depart",
    emptyLabel: string
  ) => (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Réservation</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Chambre</TableHead>
            <TableHead>{kind === "arrivee" ? "Arrivée prévue" : "Départ prévu"}</TableHead>
            <TableHead>Check-in / out</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="w-[160px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={7} className="py-10 text-center text-slate-500">
                Chargement...
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="py-10 text-center text-slate-500">
                {emptyLabel}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => {
              const status = row.checkin
                ? getCheckinFlowStatus(row.checkin)
                : ("attente_checkin" as const);

              return (
                <TableRow key={`${kind}-${row.reservation.id}`}>
                  <TableCell>
                    <div className="font-medium">{row.reservation.reference}</div>
                    <div className="text-xs text-slate-500">
                      {row.reservation.maison_nom || "—"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">
                      {row.reservation.client_nom?.trim() || "—"}
                    </div>
                    <div className="text-xs text-slate-500">
                      {row.reservation.client_email || "—"}
                    </div>
                  </TableCell>
                  <TableCell>{row.reservation.chambre_nom || "—"}</TableCell>
                  <TableCell>
                    {kind === "arrivee"
                      ? formatShortDate(row.reservation.date_arrivee)
                      : formatShortDate(row.reservation.date_depart)}
                    <div className="text-xs text-slate-500">
                      {kind === "arrivee"
                        ? `Départ ${formatShortDate(row.reservation.date_depart)}`
                        : `Arrivée ${formatShortDate(row.reservation.date_arrivee)}`}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      In · {formatDateDisplay(row.checkin?.date_checkin_reel)}
                    </div>
                    <div className="text-xs text-slate-500">
                      Out · {formatDateDisplay(row.checkin?.date_checkout_reel)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={FLOW_VARIANTS[status]}>{FLOW_LABELS[status]}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {kind === "arrivee"
                      ? renderArriveeActions(row)
                      : renderDepartActions(row)}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Check-in / Check-out
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Arrivées et départs du jour extraits des réservations confirmées ·{" "}
          <span className="font-medium capitalize text-slate-700">
            {formatDayLabel(today)}
          </span>
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Rechercher par réservation, client, chambre..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <LogIn className="h-5 w-5" style={{ color: "var(--olive-deep)" }} />
            Arrivées du jour
          </h2>
          <Badge variant="secondary">{arriveesDuJour.length}</Badge>
        </div>
        {renderDayTable(
          arriveesDuJour,
          "arrivee",
          "Aucune arrivée prévue aujourd’hui."
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <LogOut className="h-5 w-5" style={{ color: "var(--terracotta)" }} />
            Départs du jour
          </h2>
          <Badge variant="secondary">{departsDuJour.length}</Badge>
        </div>
        {renderDayTable(departsDuJour, "depart", "Aucun départ prévu aujourd’hui.")}
      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DoorOpen className="h-5 w-5" />
              {dialogTitle}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <section className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <p className="font-medium text-slate-900">
                {selectedReservation?.reference || editing?.reservation_reference || "—"}
              </p>
              <p className="mt-1 text-slate-600">
                {selectedReservation?.client_nom?.trim() || editing?.client_nom || "—"}
                {" · "}
                {selectedReservation?.chambre_nom || editing?.chambre_nom || "—"}
                {" · "}
                {selectedReservation?.maison_nom || editing?.maison_nom || "—"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Séjour {formatShortDate(selectedReservation?.date_arrivee)} →{" "}
                {formatShortDate(selectedReservation?.date_depart)}
              </p>
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
                    disabled={formMode === "checkout"}
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
                    disabled={formMode === "checkout"}
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
                    disabled={formMode === "checkout"}
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
                    disabled={formMode === "checkout"}
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
