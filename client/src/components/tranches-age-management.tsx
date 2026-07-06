import { useCallback, useEffect, useState } from "react";
import { MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createTrancheAge,
  deleteTrancheAge,
  fetchTranchesAge,
  updateTrancheAge,
  type TrancheAge,
  type TrancheAgeFormData,
} from "@/lib/hebergement";

type TrancheAgeFormState = {
  nom: string;
  age_min: string;
  age_max: string;
};

const emptyForm = (): TrancheAgeFormState => ({
  nom: "",
  age_min: "0",
  age_max: "0",
});

function toFormState(tranche?: TrancheAge | null): TrancheAgeFormState {
  if (!tranche) {
    return emptyForm();
  }

  return {
    nom: tranche.nom,
    age_min: String(tranche.age_min),
    age_max: String(tranche.age_max),
  };
}

function formatAgeRange(tranche: TrancheAge) {
  return `${tranche.age_min} – ${tranche.age_max} ans`;
}

export function TranchesAgeManagement() {
  const [tranches, setTranches] = useState<TrancheAge[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTranche, setEditingTranche] = useState<TrancheAge | null>(null);
  const [form, setForm] = useState<TrancheAgeFormState>(emptyForm());
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TrancheAge | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadTranches = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const data = await fetchTranchesAge();
      setTranches(data);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Impossible de charger les tranches d'âge."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTranches();
  }, [loadTranches]);

  const openCreate = () => {
    setEditingTranche(null);
    setForm(emptyForm());
    setFormError("");
    setDialogOpen(true);
  };

  const openEdit = (tranche: TrancheAge) => {
    setEditingTranche(tranche);
    setForm(toFormState(tranche));
    setFormError("");
    setDialogOpen(true);
  };

  const saveTranche = async () => {
    const payload: TrancheAgeFormData = {
      nom: form.nom.trim(),
      age_min: Number(form.age_min),
      age_max: Number(form.age_max),
    };

    if (!payload.nom) {
      setFormError("Le nom est requis.");
      return;
    }

    if (!Number.isFinite(payload.age_min) || !Number.isFinite(payload.age_max)) {
      setFormError("Les âges doivent être des nombres valides.");
      return;
    }

    if (payload.age_max < payload.age_min) {
      setFormError("L'âge maximum doit être supérieur ou égal à l'âge minimum.");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      if (editingTranche) {
        await updateTrancheAge(editingTranche.id, payload);
      } else {
        await createTrancheAge(payload);
      }

      setDialogOpen(false);
      await loadTranches();
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Impossible d'enregistrer la tranche d'âge."
      );
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    setDeleting(true);
    setErrorMessage("");

    try {
      await deleteTrancheAge(deleteTarget.id);
      setDeleteTarget(null);
      await loadTranches();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Impossible de supprimer la tranche d'âge."
      );
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Chargement des tranches d'âge…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-[22px]">
            Gestion des tranches d'âge
          </h2>
          <p className="mt-1 text-[13px] text-slate-500">
            Définissez les tranches d'âge utilisées pour les tarifs enfants des chambres et
            suppléments.
          </p>
        </div>

        <Button onClick={openCreate} className="rounded-full">
          <Plus className="h-4 w-4" />
          Nouvelle tranche
        </Button>
      </div>

      {errorMessage ? (
        <p className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Âge minimum</TableHead>
              <TableHead>Âge maximum</TableHead>
              <TableHead>Plage</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {tranches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-slate-500">
                  Aucune tranche d'âge définie.
                </TableCell>
              </TableRow>
            ) : (
              tranches.map((tranche) => (
                <TableRow key={tranche.id}>
                  <TableCell className="font-medium">{tranche.nom}</TableCell>
                  <TableCell>{tranche.age_min} ans</TableCell>
                  <TableCell>{tranche.age_max} ans</TableCell>
                  <TableCell>{formatAgeRange(tranche)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(tranche)}>
                          <Pencil className="h-4 w-4" />
                          Modifier
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => setDeleteTarget(tranche)}
                        >
                          <Trash2 className="h-4 w-4" />
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingTranche ? "Modifier la tranche d'âge" : "Nouvelle tranche d'âge"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tranche-nom">Nom</Label>
              <Input
                id="tranche-nom"
                value={form.nom}
                onChange={(e) => setForm((current) => ({ ...current, nom: e.target.value }))}
                placeholder="Ex. Enfant, Adolescent"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tranche-age-min">Âge minimum</Label>
                <Input
                  id="tranche-age-min"
                  type="number"
                  min="0"
                  value={form.age_min}
                  onChange={(e) => setForm((current) => ({ ...current, age_min: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tranche-age-max">Âge maximum</Label>
                <Input
                  id="tranche-age-max"
                  type="number"
                  min="0"
                  value={form.age_max}
                  onChange={(e) => setForm((current) => ({ ...current, age_max: e.target.value }))}
                />
              </div>
            </div>

            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={() => void saveTranche()} disabled={saving}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette tranche d'âge ?</AlertDialogTitle>
            <AlertDialogDescription>
              La tranche « {deleteTarget?.nom} » sera définitivement supprimée si elle n'est pas
              utilisée dans des tarifs.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
            >
              {deleting ? "Suppression…" : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
