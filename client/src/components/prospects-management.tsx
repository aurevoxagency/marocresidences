import { useCallback, useEffect, useMemo, useState } from "react";
import { MoreVertical, Pencil, Plus, Search, Trash2 } from "lucide-react";

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
import { fetchMaisons, type MaisonListItem } from "@/lib/maisons";
import {
  createProspect,
  deleteProspect,
  fetchProspects,
  updateProspect,
  type Prospect,
  type ProspectFormData,
  type ProspectSource,
  type ProspectStatut,
} from "@/lib/prospects";

const SOURCE_LABELS: Record<ProspectSource, string> = {
  site_web: "Site web",
  reseaux_sociaux: "Réseaux sociaux",
  booking: "Booking",
  airbnb: "Airbnb",
  agence: "Agence",
  bouche_a_oreille: "Bouche à oreille",
  walk_in: "Walk-in",
  autre: "Autre",
};

const STATUT_LABELS: Record<ProspectStatut, string> = {
  nouveau: "Nouveau",
  contacte: "Contacté",
  en_negociation: "En négociation",
  converti: "Converti",
  perdu: "Perdu",
};

type FormState = {
  civilite: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  pays: string;
  source: ProspectSource;
  canal_contact: string;
  maison_id: string;
  date_arrivee_souhaitee: string;
  date_depart_souhaitee: string;
  nb_personnes: string;
  budget_estime: string;
  message: string;
  notes_internes: string;
  statut: ProspectStatut;
  assigne_a: string;
  date_premier_contact: string;
  date_dernier_contact: string;
  raison_perte: string;
};

function emptyForm(): FormState {
  return {
    civilite: "",
    nom: "",
    prenom: "",
    email: "",
    telephone: "",
    pays: "",
    source: "autre",
    canal_contact: "",
    maison_id: "",
    date_arrivee_souhaitee: "",
    date_depart_souhaitee: "",
    nb_personnes: "",
    budget_estime: "",
    message: "",
    notes_internes: "",
    statut: "nouveau",
    assigne_a: "",
    date_premier_contact: "",
    date_dernier_contact: "",
    raison_perte: "",
  };
}

function dateInput(value?: string | null) {
  return value ? String(value).slice(0, 10) : "";
}

function toFormState(prospect: Prospect): FormState {
  return {
    civilite: prospect.civilite || "",
    nom: prospect.nom || "",
    prenom: prospect.prenom || "",
    email: prospect.email || "",
    telephone: prospect.telephone || "",
    pays: prospect.pays || "",
    source: prospect.source || "autre",
    canal_contact: prospect.canal_contact || "",
    maison_id: prospect.maison_id ? String(prospect.maison_id) : "",
    date_arrivee_souhaitee: dateInput(prospect.date_arrivee_souhaitee),
    date_depart_souhaitee: dateInput(prospect.date_depart_souhaitee),
    nb_personnes: prospect.nb_personnes != null ? String(prospect.nb_personnes) : "",
    budget_estime: prospect.budget_estime != null ? String(prospect.budget_estime) : "",
    message: prospect.message || "",
    notes_internes: prospect.notes_internes || "",
    statut: prospect.statut || "nouveau",
    assigne_a: prospect.assigne_a || "",
    date_premier_contact: dateInput(prospect.date_premier_contact),
    date_dernier_contact: dateInput(prospect.date_dernier_contact),
    raison_perte: prospect.raison_perte || "",
  };
}

function toPayload(form: FormState): ProspectFormData {
  return {
    civilite: (form.civilite as ProspectFormData["civilite"]) || "",
    nom: form.nom.trim(),
    prenom: form.prenom.trim() || undefined,
    email: form.email.trim() || undefined,
    telephone: form.telephone.trim() || undefined,
    pays: form.pays.trim() || undefined,
    source: form.source,
    canal_contact: form.canal_contact.trim() || undefined,
    maison_id: form.maison_id ? Number(form.maison_id) : null,
    date_arrivee_souhaitee: form.date_arrivee_souhaitee || undefined,
    date_depart_souhaitee: form.date_depart_souhaitee || undefined,
    nb_personnes: form.nb_personnes ? Number(form.nb_personnes) : null,
    budget_estime: form.budget_estime ? Number(form.budget_estime) : null,
    message: form.message.trim() || undefined,
    notes_internes: form.notes_internes.trim() || undefined,
    statut: form.statut,
    assigne_a: form.assigne_a.trim() || undefined,
    date_premier_contact: form.date_premier_contact || undefined,
    date_dernier_contact: form.date_dernier_contact || undefined,
    raison_perte: form.raison_perte.trim() || undefined,
  };
}

function statutBadgeClass(statut: ProspectStatut) {
  if (statut === "converti") return "bg-emerald-50 text-emerald-700";
  if (statut === "perdu") return "bg-red-50 text-red-700";
  if (statut === "en_negociation") return "bg-amber-50 text-amber-700";
  if (statut === "contacte") return "bg-blue-50 text-blue-700";
  return "bg-slate-100 text-slate-600";
}

export function ProspectsManagement() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [maisons, setMaisons] = useState<MaisonListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Prospect | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState("all");
  const [filterSource, setFilterSource] = useState("all");

  const loadMaisons = useCallback(async () => {
    try {
      const maisonsData = await fetchMaisons();
      setMaisons(maisonsData);
    } catch {
      // La liste des maisons est optionnelle pour le formulaire
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [prospectsResult, maisonsResult] = await Promise.allSettled([
        fetchProspects(),
        fetchMaisons(),
      ]);

      if (prospectsResult.status === "fulfilled") {
        setProspects(prospectsResult.value);
      } else {
        setError(
          prospectsResult.reason instanceof Error
            ? prospectsResult.reason.message
            : "Impossible de charger les prospects."
        );
      }

      if (maisonsResult.status === "fulfilled") {
        setMaisons(maisonsResult.value);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredProspects = useMemo(() => {
    const query = search.trim().toLowerCase();

    return prospects.filter((prospect) => {
      if (filterStatut !== "all" && prospect.statut !== filterStatut) return false;
      if (filterSource !== "all" && prospect.source !== filterSource) return false;
      if (!query) return true;

      const haystack = [
        prospect.nom,
        prospect.prenom,
        prospect.email,
        prospect.telephone,
        prospect.pays,
        prospect.assigne_a,
        prospect.maison_nom,
        SOURCE_LABELS[prospect.source],
        STATUT_LABELS[prospect.statut],
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [prospects, search, filterStatut, filterSource]);

  const openCreateDialog = () => {
    setEditingId(null);
    setForm(emptyForm());
    setFormError(null);
    setDialogOpen(true);
    if (maisons.length === 0) {
      void loadMaisons();
    }
  };

  const openEditDialog = (prospect: Prospect) => {
    setEditingId(prospect.id);
    setForm(toFormState(prospect));
    setFormError(null);
    setDialogOpen(true);
    if (maisons.length === 0) {
      void loadMaisons();
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError(null);

    const payload = toPayload(form);

    if (!payload.nom) {
      setFormError("Le nom est obligatoire.");
      setSaving(false);
      return;
    }

    try {
      if (editingId) {
        await updateProspect(editingId, payload);
      } else {
        await createProspect(payload);
      }

      setDialogOpen(false);
      await loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Impossible d'enregistrer le prospect.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);

    try {
      await deleteProspect(deleteTarget.id);
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de supprimer le prospect.");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="w-full">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h2 className="hidden text-[22px] font-semibold tracking-tight text-slate-900 lg:block">
            Prospects
          </h2>
          <p className="text-[13px] text-slate-500 lg:mt-1">
            Suivi des leads et contacts non encore convertis.
          </p>
        </div>
        <Button
          type="button"
          onClick={openCreateDialog}
          className="w-full rounded-xl bg-[#3b82f6] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#2563eb] sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          Ajouter un prospect
        </Button>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-600">
          {error}
        </div>
      )}

      <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:mt-5 sm:rounded-[22px] sm:p-4 sm:grid-cols-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un prospect..."
            className="pl-9"
          />
        </div>
        <Select value={filterStatut} onValueChange={setFilterStatut}>
          <SelectTrigger>
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {Object.entries(STATUT_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterSource} onValueChange={setFilterSource}>
          <SelectTrigger>
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les sources</SelectItem>
            {Object.entries(SOURCE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4 overflow-hidden rounded-[22px] border border-slate-200 bg-white">
        {loading ? (
          <p className="px-5 py-8 text-[13px] text-slate-500">Chargement des prospects...</p>
        ) : prospects.length === 0 ? (
          <p className="px-5 py-8 text-[13px] text-slate-500">Aucun prospect trouvé.</p>
        ) : filteredProspects.length === 0 ? (
          <p className="px-5 py-8 text-[13px] text-slate-500">
            Aucun résultat pour cette recherche ou ces filtres.
          </p>
        ) : (
          <Table>
            <TableHeader className="bg-[#fbfcff]">
              <TableRow>
                <TableHead className="text-[12px] font-semibold text-slate-400">Nom</TableHead>
                <TableHead className="text-[12px] font-semibold text-slate-400">Contact</TableHead>
                <TableHead className="text-[12px] font-semibold text-slate-400">Source</TableHead>
                <TableHead className="text-[12px] font-semibold text-slate-400">Maison</TableHead>
                <TableHead className="text-[12px] font-semibold text-slate-400">Statut</TableHead>
                <TableHead className="text-right text-[12px] font-semibold text-slate-400">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProspects.map((prospect) => (
                <TableRow key={prospect.id}>
                  <TableCell className="text-[13px] font-medium text-slate-800">
                    {[prospect.civilite, prospect.prenom, prospect.nom].filter(Boolean).join(" ")}
                  </TableCell>
                  <TableCell className="text-[13px] text-slate-500">
                    <div>{prospect.email || "—"}</div>
                    <div className="text-[11px] text-slate-400">{prospect.telephone || "—"}</div>
                  </TableCell>
                  <TableCell className="text-[13px] text-slate-500">
                    {SOURCE_LABELS[prospect.source] || prospect.source}
                  </TableCell>
                  <TableCell className="text-[13px] text-slate-500">
                    {prospect.maison_nom || "—"}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${statutBadgeClass(prospect.statut)}`}
                    >
                      {STATUT_LABELS[prospect.statut] || prospect.statut}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-lg border-slate-200"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem
                          className="cursor-pointer gap-2"
                          onClick={() => openEditDialog(prospect)}
                        >
                          <Pencil className="h-4 w-4" />
                          Modifier
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="cursor-pointer gap-2 text-red-600 focus:bg-red-50 focus:text-red-700"
                          onClick={() => setDeleteTarget(prospect)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Modifier le prospect" : "Ajouter un prospect"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Civilité</Label>
                <Select
                  value={form.civilite || "none"}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, civilite: value === "none" ? "" : value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Civilité" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    <SelectItem value="M.">M.</SelectItem>
                    <SelectItem value="Mme">Mme</SelectItem>
                    <SelectItem value="Mlle">Mlle</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="prospect-prenom">Prénom</Label>
                <Input
                  id="prospect-prenom"
                  value={form.prenom}
                  onChange={(e) => setForm((prev) => ({ ...prev, prenom: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prospect-nom">Nom *</Label>
                <Input
                  id="prospect-nom"
                  value={form.nom}
                  onChange={(e) => setForm((prev) => ({ ...prev, nom: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="prospect-email">Email</Label>
                <Input
                  id="prospect-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prospect-tel">Téléphone</Label>
                <Input
                  id="prospect-tel"
                  value={form.telephone}
                  onChange={(e) => setForm((prev) => ({ ...prev, telephone: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prospect-pays">Pays</Label>
                <Input
                  id="prospect-pays"
                  value={form.pays}
                  onChange={(e) => setForm((prev) => ({ ...prev, pays: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Maison intéressée</Label>
                <Select
                  value={form.maison_id || "none"}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, maison_id: value === "none" ? "" : value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Maison" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune</SelectItem>
                    {maisons.map((maison) => (
                      <SelectItem key={maison.id} value={String(maison.id)}>
                        {maison.nom}
                        {maison.ville ? ` — ${maison.ville}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {maisons.length === 0 ? (
                  <p className="text-[11px] text-slate-400">
                    Aucune maison disponible. Ajoutez-en dans « Maisons d&apos;hôtes ».
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label>Source</Label>
                <Select
                  value={form.source}
                  onValueChange={(value: ProspectSource) =>
                    setForm((prev) => ({ ...prev, source: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SOURCE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Statut</Label>
                <Select
                  value={form.statut}
                  onValueChange={(value: ProspectStatut) =>
                    setForm((prev) => ({ ...prev, statut: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUT_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="prospect-canal">Canal de contact</Label>
                <Input
                  id="prospect-canal"
                  value={form.canal_contact}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, canal_contact: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prospect-assigne">Assigné à</Label>
                <Input
                  id="prospect-assigne"
                  value={form.assigne_a}
                  onChange={(e) => setForm((prev) => ({ ...prev, assigne_a: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prospect-arrivee">Arrivée souhaitée</Label>
                <Input
                  id="prospect-arrivee"
                  type="date"
                  value={form.date_arrivee_souhaitee}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, date_arrivee_souhaitee: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prospect-depart">Départ souhaité</Label>
                <Input
                  id="prospect-depart"
                  type="date"
                  value={form.date_depart_souhaitee}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, date_depart_souhaitee: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prospect-personnes">Nb personnes</Label>
                <Input
                  id="prospect-personnes"
                  type="number"
                  min="0"
                  value={form.nb_personnes}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, nb_personnes: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prospect-budget">Budget estimé</Label>
                <Input
                  id="prospect-budget"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.budget_estime}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, budget_estime: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="prospect-message">Message</Label>
              <Textarea
                id="prospect-message"
                value={form.message}
                onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prospect-notes">Notes internes</Label>
              <Textarea
                id="prospect-notes"
                value={form.notes_internes}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, notes_internes: e.target.value }))
                }
                rows={3}
              />
            </div>

            {form.statut === "perdu" ? (
              <div className="space-y-2">
                <Label htmlFor="prospect-perte">Raison de la perte</Label>
                <Input
                  id="prospect-perte"
                  value={form.raison_perte}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, raison_perte: e.target.value }))
                  }
                />
              </div>
            ) : null}

            {formError && <p className="text-[13px] text-red-600">{formError}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Enregistrement..." : editingId ? "Mettre à jour" : "Créer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce prospect ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le prospect{" "}
              <strong>
                {deleteTarget?.prenom} {deleteTarget?.nom}
              </strong>{" "}
              sera définitivement supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
