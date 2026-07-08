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
  createCategorieChambre,
  deleteCategorieChambre,
  fetchCategoriesChambre,
  updateCategorieChambre,
  type CategorieChambre,
} from "@/lib/hebergement";

export function CategoriesChambreManagement() {
  const [categories, setCategories] = useState<CategorieChambre[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategorie, setEditingCategorie] = useState<CategorieChambre | null>(null);
  const [nom, setNom] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CategorieChambre | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const data = await fetchCategoriesChambre();
      setCategories(data);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Impossible de charger les catégories."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  const openCreate = () => {
    setEditingCategorie(null);
    setNom("");
    setFormError("");
    setDialogOpen(true);
  };

  const openEdit = (categorie: CategorieChambre) => {
    setEditingCategorie(categorie);
    setNom(categorie.nom);
    setFormError("");
    setDialogOpen(true);
  };

  const saveCategorie = async () => {
    const trimmed = nom.trim();

    if (!trimmed) {
      setFormError("Le nom est requis.");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      if (editingCategorie) {
        await updateCategorieChambre(editingCategorie.id, { nom: trimmed });
      } else {
        await createCategorieChambre({ nom: trimmed });
      }

      setDialogOpen(false);
      await loadCategories();
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Impossible d'enregistrer la catégorie."
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
      await deleteCategorieChambre(deleteTarget.id);
      setDeleteTarget(null);
      await loadCategories();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Impossible de supprimer la catégorie."
      );
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Chargement des catégories…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-[22px]">
            Gestion des catégories
          </h2>
          <p className="mt-1 text-[13px] text-slate-500">
            Définissez les catégories de chambres (Standard, Luxe, Suite…).
          </p>
        </div>

        <Button onClick={openCreate} className="rounded-full">
          <Plus className="h-4 w-4" />
          Nouvelle catégorie
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
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className="py-8 text-center text-slate-500">
                  Aucune catégorie définie.
                </TableCell>
              </TableRow>
            ) : (
              categories.map((categorie) => (
                <TableRow key={categorie.id}>
                  <TableCell className="font-medium">{categorie.nom}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(categorie)}>
                          <Pencil className="h-4 w-4" />
                          Modifier
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => setDeleteTarget(categorie)}
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
              {editingCategorie ? "Modifier la catégorie" : "Nouvelle catégorie"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="categorie-nom">Nom</Label>
              <Input
                id="categorie-nom"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Ex. Standard, Luxe, Suite"
              />
            </div>

            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={() => void saveCategorie()} disabled={saving}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette catégorie ?</AlertDialogTitle>
            <AlertDialogDescription>
              La catégorie « {deleteTarget?.nom} » sera définitivement supprimée si elle n&apos;est
              pas utilisée par des chambres ou des promotions.
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
